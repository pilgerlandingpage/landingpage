import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const NULL_ADMIN_USER_ID = '00000000-0000-0000-0000-000000000000'

function normalizeDigits(value: unknown): string {
    return String(value || '').replace(/\D/g, '')
}

function phoneCandidates(value: unknown): string[] {
    const digits = normalizeDigits(value)
    if (!digits) return []

    const set = new Set<string>()
    const add = (raw: string) => {
        const v = normalizeDigits(raw)
        if (!v) return
        set.add(v)

        const noLeadingZero = v.replace(/^0+/, '')
        if (noLeadingZero) set.add(noLeadingZero)

        if (v.startsWith('55') && v.length > 2) {
            set.add(v.slice(2))
        }

        if (!v.startsWith('55') && (v.length === 10 || v.length === 11)) {
            set.add(`55${v}`)
        }
    }

    add(digits)

    for (const candidate of [...set]) {
        if (candidate.startsWith('55')) {
            const local = candidate.slice(2)
            if (local.length === 11 && local[2] === '9') add(`55${local.slice(0, 2)}${local.slice(3)}`)
            if (local.length === 10) add(`55${local.slice(0, 2)}9${local.slice(2)}`)
        } else {
            if (candidate.length === 11 && candidate[2] === '9') add(`${candidate.slice(0, 2)}${candidate.slice(3)}`)
            if (candidate.length === 10) add(`${candidate.slice(0, 2)}9${candidate.slice(2)}`)
        }
    }

    return [...set]
}

function phonesMatch(left: unknown, right: unknown): boolean {
    const leftSet = new Set(phoneCandidates(left))
    const rightSet = new Set(phoneCandidates(right))
    for (const candidate of leftSet) {
        if (rightSet.has(candidate)) return true
    }
    return false
}

async function getAdminUserForSession() {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { user: null, adminUser: null, error: 'Nao autorizado' }

    const admin = createAdminClient()
    const { data: adminUser, error: adminError } = await admin
        .from('admin_users')
        .select(`
            id,
            auth_user_id,
            name,
            email,
            phone,
            is_master,
            is_active,
            whatsapp_instance_id
        `)
        .eq('auth_user_id', user.id)
        .single()

    if (adminError || !adminUser) return { user, adminUser: null, error: 'Usuario nao encontrado' }
    return { user, adminUser, error: null }
}

async function getUserSectors(admin: any, adminUserId: string) {
    const { data } = await admin
        .from('admin_user_sectors')
        .select('admin_sectors(id, name, color, icon)')
        .eq('user_id', adminUserId)

    return (data || [])
        .map((row: any) => row.admin_sectors)
        .filter(Boolean)
}

async function getLinkedWhatsAppInstances(admin: any, adminUser: any) {
    const seen = new Map<string, any>()
    const addRows = (rows?: any[] | null) => {
        for (const row of rows || []) {
            if (row?.id) seen.set(row.id, row)
        }
    }

    const { data: directInstances } = await admin
        .from('whatsapp_instances')
        .select('*')
        .eq('admin_user_id', adminUser.id)
        .order('created_at', { ascending: false })
    addRows(directInstances)

    if (adminUser.whatsapp_instance_id) {
        const { data: selectedInstance } = await admin
            .from('whatsapp_instances')
            .select('*')
            .eq('id', adminUser.whatsapp_instance_id)
            .maybeSingle()
        addRows(selectedInstance ? [selectedInstance] : [])
    }

    const candidates = phoneCandidates(adminUser.phone)
    if (candidates.length > 0) {
        const { data: phoneInstances } = await admin
            .from('whatsapp_instances')
            .select('*')
            .in('phone_number', candidates)
            .order('created_at', { ascending: false })
        addRows(phoneInstances)
    }

    const instances = [...seen.values()].sort((a, b) => {
        if (a.id === adminUser.whatsapp_instance_id) return -1
        if (b.id === adminUser.whatsapp_instance_id) return 1
        if (a.status === 'connected' && b.status !== 'connected') return -1
        if (b.status === 'connected' && a.status !== 'connected') return 1
        return String(b.created_at || '').localeCompare(String(a.created_at || ''))
    })

    const primary = instances[0]
    if (primary) {
        const updates: Record<string, any> = {}
        if (primary.admin_user_id !== adminUser.id) updates.admin_user_id = adminUser.id
        if (!adminUser.whatsapp_instance_id || adminUser.whatsapp_instance_id !== primary.id) {
            await admin
                .from('admin_users')
                .update({ whatsapp_instance_id: primary.id, updated_at: new Date().toISOString() })
                .eq('id', adminUser.id)
            adminUser.whatsapp_instance_id = primary.id
        }
        if (Object.keys(updates).length > 0) {
            updates.updated_at = new Date().toISOString()
            await admin.from('whatsapp_instances').update(updates).eq('id', primary.id)
            primary.admin_user_id = adminUser.id
        }
    }

    return instances
}

async function syncLinkedProfiles(admin: any, adminUser: any, phone: string | null, name: string | null) {
    const { data: instances } = await admin
        .from('whatsapp_instances')
        .select('id, broker_id, phone_number')
        .eq('admin_user_id', adminUser.id)

    for (const instance of instances || []) {
        const instancePhone = normalizeDigits(instance.phone_number)
        const shouldUpdateInstancePhone = phone && !instancePhone
        if (shouldUpdateInstancePhone) {
            await admin
                .from('whatsapp_instances')
                .update({ phone_number: phone, updated_at: new Date().toISOString() })
                .eq('id', instance.id)
        }

        if (instance.broker_id) {
            const brokerUpdates: Record<string, any> = { updated_at: new Date().toISOString() }
            if (phone) brokerUpdates.phone = phone
            if (name) brokerUpdates.name = name
            await admin.from('virtual_brokers').update(brokerUpdates).eq('id', instance.broker_id)
        }
    }
}

async function getAgentReport(admin: any, adminUser: any, instances: any[]) {
    const brokerIds = [...new Set(instances.map((instance: any) => instance.broker_id).filter(Boolean))]
    const instanceIds = [...new Set(instances.map((instance: any) => instance.id).filter(Boolean))]

    let brokers: any[] = []
    if (brokerIds.length > 0) {
        const { data } = await admin
            .from('virtual_brokers')
            .select('id, name, phone, photo_url, is_active, whatsapp_instance_id, updated_at')
            .in('id', brokerIds)
        brokers = data || []
    }

    let conversations: any[] = []
    if (brokerIds.length > 0 || instanceIds.length > 0) {
        let query = admin
            .from('whatsapp_ai_conversations')
            .select('id, broker_id, instance_id, lead_phone, messages, status, created_at, updated_at')
            .order('updated_at', { ascending: false })
            .limit(30)

        if (brokerIds.length > 0 && instanceIds.length > 0) {
            query = query.or(`broker_id.in.(${brokerIds.join(',')}),instance_id.in.(${instanceIds.join(',')})`)
        } else if (brokerIds.length > 0) {
            query = query.in('broker_id', brokerIds)
        } else {
            query = query.in('instance_id', instanceIds)
        }

        const { data } = await query
        conversations = data || []
    }

    const leadPhones = [...new Set(conversations.map((conversation: any) => normalizeDigits(conversation.lead_phone)).filter(Boolean))]
    const leadCandidates = [...new Set(leadPhones.flatMap(phoneCandidates))]

    const leadByPhone = new Map<string, any>()
    if (leadCandidates.length > 0) {
        const { data: leads } = await admin
            .from('leads')
            .select('id, name, email, phone, phone_e164, ai_summary, lead_classification, lead_purpose, lead_budget, lead_timeframe, conversation_log, created_at, updated_at')
            .or(`phone.in.(${leadCandidates.join(',')}),phone_e164.in.(${leadCandidates.join(',')})`)
            .limit(100)

        for (const lead of leads || []) {
            for (const candidate of phoneCandidates(lead.phone || lead.phone_e164)) {
                leadByPhone.set(candidate, lead)
            }
        }
    }

    const enrichedConversations = conversations.map((conversation: any) => {
        const phone = normalizeDigits(conversation.lead_phone)
        const lead = phoneCandidates(phone).map(candidate => leadByPhone.get(candidate)).find(Boolean) || null
        const messages = Array.isArray(conversation.messages) ? conversation.messages : []
        const extracted: any = {}

        return {
            id: conversation.id,
            broker_id: conversation.broker_id,
            instance_id: conversation.instance_id,
            lead_phone: phone || conversation.lead_phone,
            lead_name: lead?.name || extracted?.name || extracted?.lead_name || null,
            lead_email: lead?.email || extracted?.email || null,
            status: conversation.status || 'active',
            summary: lead?.ai_summary || extracted?.summary || null,
            lead_classification: lead?.lead_classification || extracted?.classification || null,
            lead_purpose: lead?.lead_purpose || extracted?.purpose || extracted?.finalidade || null,
            lead_budget: lead?.lead_budget || extracted?.budget || extracted?.orcamento || null,
            lead_timeframe: lead?.lead_timeframe || extracted?.timeframe || extracted?.prazo || null,
            messages,
            message_count: messages.length,
            created_at: conversation.created_at,
            updated_at: conversation.updated_at,
        }
    })

    const totalMessages = enrichedConversations.reduce((sum, conversation) => sum + conversation.message_count, 0)

    return {
        brokers,
        conversations: enrichedConversations,
        stats: {
            brokers: brokers.length,
            conversations: enrichedConversations.length,
            active_conversations: enrichedConversations.filter(conversation => conversation.status === 'active').length,
            messages: totalMessages,
        },
    }
}

export async function GET(request: NextRequest) {
    try {
        const { adminUser, error } = await getAdminUserForSession()
        if (error === 'Nao autorizado') {
            return NextResponse.json({ success: false, message: error }, { status: 401 })
        }
        if (!adminUser) {
            return NextResponse.json({ success: false, message: error || 'Usuario nao encontrado' }, { status: 404 })
        }

        const admin = createAdminClient()
        const [sectors, instances] = await Promise.all([
            getUserSectors(admin, adminUser.id),
            getLinkedWhatsAppInstances(admin, adminUser),
        ])
        const agentReport = await getAgentReport(admin, adminUser, instances)

        return NextResponse.json({
            success: true,
            user: {
                id: adminUser.id,
                name: adminUser.name,
                email: adminUser.email,
                phone: adminUser.phone,
                is_master: adminUser.is_master,
                whatsapp_instance_id: adminUser.whatsapp_instance_id || instances[0]?.id || null,
                sectors,
            },
            whatsapp_instances: instances,
            agent_report: agentReport,
        })
    } catch (err: any) {
        console.error('[Admin Me API GET]', err)
        return NextResponse.json({ success: false, message: err.message }, { status: 500 })
    }
}

export async function PUT(request: NextRequest) {
    try {
        const supabase = await createServerSupabase()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, message: 'Nao autorizado' }, { status: 401 })
        }

        const admin = createAdminClient()
        const { data: adminUser, error: adminError } = await admin
            .from('admin_users')
            .select('id, name, phone')
            .eq('auth_user_id', user.id)
            .single()

        if (adminError || !adminUser) {
            return NextResponse.json({ success: false, message: 'Usuario nao encontrado' }, { status: 404 })
        }

        const body = await request.json()
        const updateData: Record<string, any> = { updated_at: new Date().toISOString() }

        const nextName = body.name !== undefined ? String(body.name || '').trim() : null
        const nextPhone = body.phone !== undefined ? normalizeDigits(body.phone) : null

        if (body.name !== undefined && nextName) updateData.name = nextName
        if (body.phone !== undefined) updateData.phone = nextPhone || null

        if (body.password && String(body.password).length >= 6) {
            const { error: pwdErr } = await supabase.auth.updateUser({ password: String(body.password) })
            if (pwdErr) throw new Error(`Erro ao atualizar senha auth: ${pwdErr.message}`)
        }

        const { data: updatedUser, error: updateErr } = await admin
            .from('admin_users')
            .update(updateData)
            .eq('id', adminUser.id)
            .select('id, name, email, phone, is_master, whatsapp_instance_id')
            .single()

        if (updateErr) throw new Error(updateErr.message)

        await syncLinkedProfiles(
            admin,
            adminUser,
            nextPhone,
            nextName || String(updatedUser?.name || adminUser.name || '').trim()
        )

        return NextResponse.json({ success: true, user: updatedUser })
    } catch (err: any) {
        console.error('[Admin Me API PUT]', err)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}
