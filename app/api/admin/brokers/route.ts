import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function normalizeAssistantPhone(value: any): string {
    let digits = String(value || '').replace(/\D/g, '')
    if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
        digits = `55${digits}`
    }
    return digits
}

function normalizeBrokerPhone(value: any): string {
    return normalizeAssistantPhone(value)
}

function extractWhatsAppProfilePhoto(value: any): string | null {
    if (!value || typeof value !== 'object') return null

    const candidates = [
        value.profilePicUrl,
        value.profilePictureUrl,
        value.picture,
        value.avatar,
        value.photo_url,
        value.url,
        value.me?.profilePicUrl,
        value.me?.profilePictureUrl,
        value.me?.picture,
        value.instance?.profilePicUrl,
        value.instance?.profilePictureUrl,
        value.data?.url,
        value.data?.profilePicUrl,
        value.data?.profilePictureUrl,
    ]

    for (const candidate of candidates) {
        const url = String(candidate || '').trim()
        if (/^https?:\/\//i.test(url)) return url
    }

    return null
}

const ASSISTANT_PHONE_OPTIONAL_COLUMNS = [
    'can_manage_finance',
    'can_view_reports',
    'can_view_properties',
]

const BROKER_OPTIONAL_COLUMNS = [
    'transfer_to_phone',
    'concierge_enabled',
    'concierge_prompt',
    'concierge_require_confirmation',
]

const BROKER_BASE_SELECT_FIELDS = [
    'id',
    'name',
    'creci',
    'photo_url',
    'is_active',
    'assignment_type',
    'assigned_page_slugs',
    'phone',
    'whatsapp_instance_id',
    'system_prompt',
    'voice_id',
    'handoff_prompt',
]

const BROKER_GET_OPTIONAL_COLUMNS = [
    'transfer_to_phone',
    'summary_to_phone',
    'concierge_enabled',
    'concierge_prompt',
    'concierge_require_confirmation',
]

function findMissingOptionalColumn(error: any, columns: string[]) {
    const message = String(error?.message || error || '')
    return columns.find(column => message.includes(column)) || null
}

async function upsertAssistantPhonesWithCompatibility(supabase: any, rows: any[]) {
    let pendingRows = rows

    for (let attempt = 0; attempt <= ASSISTANT_PHONE_OPTIONAL_COLUMNS.length; attempt += 1) {
        const { error } = await supabase
            .from('broker_assistant_authorized_phones')
            .upsert(pendingRows, { onConflict: 'broker_id,phone' })

        if (!error) return

        const missing = findMissingOptionalColumn(error, ASSISTANT_PHONE_OPTIONAL_COLUMNS)
        if (!missing) throw error

        pendingRows = pendingRows.map((row: any) => {
            const { [missing]: _missingColumn, ...rest } = row
            return rest
        })
    }
}

async function listBrokersWithCompatibility(supabase: any) {
    let optionalColumns = [...BROKER_GET_OPTIONAL_COLUMNS]

    for (let attempt = 0; attempt <= BROKER_GET_OPTIONAL_COLUMNS.length; attempt += 1) {
        const result = await supabase
            .from('virtual_brokers')
            .select([...BROKER_BASE_SELECT_FIELDS, ...optionalColumns].join(', '))
            .order('name')

        if (!result.error) return result

        const missing = findMissingOptionalColumn(result.error, optionalColumns)
        if (!missing) return result

        optionalColumns = optionalColumns.filter(column => column !== missing)
    }

    return supabase
        .from('virtual_brokers')
        .select(BROKER_BASE_SELECT_FIELDS.join(', '))
        .order('name')
}

async function updateBrokerWithCompatibility(
    supabase: any,
    id: string,
    payload: Record<string, any>,
    requiredColumns: string[] = [],
) {
    let pendingPayload = { ...payload }

    for (let attempt = 0; attempt <= BROKER_OPTIONAL_COLUMNS.length; attempt += 1) {
        const result = await supabase
            .from('virtual_brokers')
            .update(pendingPayload)
            .eq('id', id)
            .select()
            .single()

        if (!result.error) return { ...result, payload: pendingPayload }

        const missing = findMissingOptionalColumn(result.error, BROKER_OPTIONAL_COLUMNS)
        if (!missing) return { ...result, payload: pendingPayload }
        if (requiredColumns.includes(missing)) {
            return { ...result, payload: pendingPayload, missingRequiredColumn: missing }
        }

        const { [missing]: _missingColumn, ...rest } = pendingPayload
        pendingPayload = rest
    }

    const result = await supabase
        .from('virtual_brokers')
        .update(pendingPayload)
        .eq('id', id)
        .select()
        .single()

    return { ...result, payload: pendingPayload }
}

async function syncAssistantPhones(supabase: any, brokerId: string, phones: any[]) {
    if (!Array.isArray(phones)) return

    const rows = phones
        .map((phone: any) => {
            const normalized = normalizeAssistantPhone(phone?.phone)
            if (!normalized) return null
            return {
                broker_id: brokerId,
                phone: normalized,
                name: String(phone?.name || '').trim() || null,
                role: String(phone?.role || 'broker'),
                can_manage_agenda: phone?.can_manage_agenda !== false,
                can_manage_leads: phone?.can_manage_leads === true,
                can_send_messages: phone?.can_send_messages === true,
                can_update_crm: phone?.can_update_crm === true,
                can_manage_finance: phone?.can_manage_finance === true,
                can_view_reports: phone?.can_view_reports === true,
                can_view_properties: phone?.can_view_properties !== false,
                is_active: phone?.is_active !== false,
            }
        })
        .filter(Boolean)

    await supabase
        .from('broker_assistant_authorized_phones')
        .delete()
        .eq('broker_id', brokerId)

    if (rows.length > 0) {
        await upsertAssistantPhonesWithCompatibility(supabase, rows)
    }
}

type BrokerWhatsappMetadata = {
    photoUrl: string | null
    instanceId: string | null
    instanceName: string | null
    instanceType: string | null
    status: string | null
    isGlobal: boolean
}

async function fetchBrokerWhatsappMetadataMap(supabase: any, brokerIds: string[]) {
    const metadataByBroker = new Map<string, BrokerWhatsappMetadata>()
    if (brokerIds.length === 0) return metadataByBroker

    const withLiveData = await supabase
        .from('whatsapp_instances')
        .select('id, broker_id, instance_name, instance_type, status, live_data')
        .in('broker_id', brokerIds)

    const result = !withLiveData.error
        ? withLiveData
        : await supabase
            .from('whatsapp_instances')
            .select('id, broker_id, instance_name, status')
            .in('broker_id', brokerIds)

    if (result.error) {
        console.warn('List broker WhatsApp metadata warning:', result.error.message)
        return metadataByBroker
    }

    for (const instance of result.data || []) {
        const brokerId = String(instance?.broker_id || '')
        if (!brokerId || metadataByBroker.has(brokerId)) continue
        const instanceType = String(instance?.instance_type || '').trim().toLowerCase()
        const instanceName = String(instance?.instance_name || '').trim()
        const photoUrl = extractWhatsAppProfilePhoto(instance?.live_data)
        metadataByBroker.set(brokerId, {
            photoUrl,
            instanceId: instance?.id ? String(instance.id) : null,
            instanceName: instanceName || null,
            instanceType: instanceType || null,
            status: instance?.status ? String(instance.status) : null,
            isGlobal: instanceType === 'global' || instanceName.toLowerCase().includes('agente global') || instanceName.toLowerCase().includes('whatsapp global'),
        })
    }

    return metadataByBroker
}

// GET - List brokers
export async function GET() {
    try {
        const supabase = createAdminClient()
        // Tenta seleção completa primeiro; se alguma coluna opcional não existir no ambiente,
        // cai para seleções progressivamente mais simples para não "sumir" com os corretores.
        const brokersQuery = await listBrokersWithCompatibility(supabase)
        let data: any[] | null = brokersQuery.data
        let error: any = brokersQuery.error

        if (error) {
            const safeQuery = await supabase
                .from('virtual_brokers')
                .select('*')
                .order('name')
            data = safeQuery.data
            error = safeQuery.error
        }

        if (error) {
            console.error('List brokers error:', error)
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        const brokers = data || []
        if (brokers.length === 0) return NextResponse.json({ data: [] })

        const brokerIds = brokers.map((b: any) => b.id)
        let links: any[] = []
        let assistantPhones: any[] = []
        const whatsappMetadataByBroker = await fetchBrokerWhatsappMetadataMap(supabase, brokerIds)
        try {
            const { data: linksData, error: linksError } = await supabase
                .from('broker_empreendimentos')
                .select('broker_id, empreendimento_id, prioridade, empreendimentos(id, nome, slug)')
                .in('broker_id', brokerIds)
                .eq('ativo', true)
            if (!linksError && Array.isArray(linksData)) {
                links = linksData
            } else if (linksError) {
                console.warn('List broker_empreendimentos warning:', linksError.message)
            }
        } catch (err) {
            console.warn('List broker_empreendimentos exception:', err)
        }

        try {
            const { data: phonesData, error: phonesError } = await supabase
                .from('broker_assistant_authorized_phones')
                .select('id, broker_id, phone, name, role, can_manage_agenda, can_manage_leads, can_send_messages, can_update_crm, can_manage_finance, can_view_reports, can_view_properties, is_active')
                .in('broker_id', brokerIds)
                .order('created_at')
            if (!phonesError && Array.isArray(phonesData)) {
                assistantPhones = phonesData
            } else if (phonesError) {
                const fallback = await supabase
                    .from('broker_assistant_authorized_phones')
                    .select('id, broker_id, phone, name, role, can_manage_agenda, can_manage_leads, can_send_messages, can_update_crm, is_active')
                    .in('broker_id', brokerIds)
                    .order('created_at')
                if (!fallback.error && Array.isArray(fallback.data)) {
                    assistantPhones = fallback.data
                } else {
                    console.warn('List broker assistant phones warning:', fallback.error?.message || phonesError.message)
                }
            }
        } catch (err) {
            console.warn('List broker assistant phones exception:', err)
        }

        const byBroker: Record<string, any[]> = {}
        for (const l of links) {
            const bid = (l as any).broker_id
            if (!byBroker[bid]) byBroker[bid] = []
            byBroker[bid].push(l)
        }

        const assistantByBroker: Record<string, any[]> = {}
        for (const row of assistantPhones) {
            const bid = (row as any).broker_id
            if (!assistantByBroker[bid]) assistantByBroker[bid] = []
            assistantByBroker[bid].push(row)
        }

        const enriched = brokers.map((b: any) => {
            const rows = byBroker[b.id] || []
            const empreendimento_ids = rows.map((r: any) => r.empreendimento_id)
            const empreendimento_names = rows
                .map((r: any) => r?.empreendimentos?.nome)
                .filter(Boolean)
            const whatsappMetadata = whatsappMetadataByBroker.get(b.id) || null
            const whatsappProfilePhotoUrl = whatsappMetadata?.photoUrl || null
            return {
                ...b,
                whatsapp_profile_photo_url: whatsappProfilePhotoUrl,
                broker_avatar_url: whatsappProfilePhotoUrl || b.photo_url || null,
                whatsapp_instance_type: whatsappMetadata?.instanceType || null,
                whatsapp_instance_name: whatsappMetadata?.instanceName || null,
                whatsapp_instance_status: whatsappMetadata?.status || null,
                is_global_whatsapp_agent: Boolean(whatsappMetadata?.isGlobal),
                empreendimento_ids,
                empreendimento_names,
                assistant_phones: assistantByBroker[b.id] || [],
            }
        })

        return NextResponse.json({ data: enriched })
    } catch (err) {
        console.error('API error:', err)
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}

// POST - Create broker
export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        const body = await request.json()
        const safeName = String(body?.name || '').trim()

        if (!safeName) {
            return NextResponse.json({ error: 'Nome do corretor é obrigatório' }, { status: 400 })
        }

        // Cadastro rápido (WhatsApp > Instâncias) pode enviar apenas "name".
        // Inserir apenas campos essenciais para evitar erro em colunas opcionais
        // que podem não existir em todos os ambientes.
        const empreendimento_ids: string[] = Array.isArray(body?.empreendimento_ids) ? body.empreendimento_ids : []

        const payload: Record<string, any> = {
            name: safeName,
            creci: String(body?.creci || 'N/A'),
            is_active: body?.is_active ?? true,
        }

        if (typeof body?.photo_url === 'string') payload.photo_url = body.photo_url
        if (typeof body?.system_prompt === 'string') payload.system_prompt = body.system_prompt
        if (typeof body?.voice_id === 'string') payload.voice_id = body.voice_id
        if (typeof body?.handoff_prompt === 'string') payload.handoff_prompt = body.handoff_prompt
        if (typeof body?.concierge_enabled === 'boolean') payload.concierge_enabled = body.concierge_enabled
        if (typeof body?.concierge_prompt === 'string') payload.concierge_prompt = body.concierge_prompt
        if (typeof body?.concierge_require_confirmation === 'boolean') payload.concierge_require_confirmation = body.concierge_require_confirmation
        if (typeof body?.phone === 'string') payload.phone = body.phone
        const transferPhone = normalizeBrokerPhone(body?.transfer_to_phone || body?.summary_to_phone)
        if (transferPhone) payload.transfer_to_phone = transferPhone
        if (typeof body?.assignment_type === 'string') payload.assignment_type = body.assignment_type
        if (Array.isArray(body?.assigned_page_slugs)) payload.assigned_page_slugs = body.assigned_page_slugs

        const { data, error } = await supabase
            .from('virtual_brokers')
            .insert([payload])
            .select()
            .single()

        if (error) {
            console.error('Insert broker error:', error)
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        if (empreendimento_ids.length > 0 && data?.id) {
            const links = empreendimento_ids.map((eid: string, idx: number) => ({
                broker_id: data.id,
                empreendimento_id: eid,
                ativo: true,
                prioridade: idx + 1,
            }))
            await supabase.from('broker_empreendimentos').upsert(links, { onConflict: 'broker_id,empreendimento_id' })
        }

        if (data?.id && Array.isArray(body?.assistant_phones)) {
            try {
                await syncAssistantPhones(supabase, data.id, body.assistant_phones)
            } catch (err) {
                console.warn('Sync assistant phones warning:', err)
            }
        }

        return NextResponse.json({ data })
    } catch (err) {
        console.error('API error:', err)
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}

// PUT - Update broker
export async function PUT(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        const body = await request.json()
        const { id, empreendimento_ids, assistant_phones, ...updates } = body

        if (!id) {
            return NextResponse.json({ error: 'Missing broker id' }, { status: 400 })
        }

        // Compatibilidade entre ambientes: algumas colunas opcionais podem não existir
        // (ex.: summary_to_phone). Tentamos salvar tudo e, se a API reclamar de coluna ausente,
        // removemos esse campo e tentamos novamente.
        const transferPhone = normalizeBrokerPhone((updates as any).transfer_to_phone || (updates as any).summary_to_phone)
        let payload: Record<string, any> = { ...updates }
        delete payload.summary_to_phone
        if (transferPhone) {
            payload.transfer_to_phone = transferPhone
        } else if ((updates as any).transfer_to_phone !== undefined || (updates as any).summary_to_phone !== undefined) {
            payload.transfer_to_phone = null
        }
        const requiredColumns = [
            typeof (updates as any).concierge_enabled === 'boolean' ? 'concierge_enabled' : null,
            typeof (updates as any).concierge_prompt === 'string' ? 'concierge_prompt' : null,
            typeof (updates as any).concierge_require_confirmation === 'boolean' ? 'concierge_require_confirmation' : null,
        ].filter(Boolean) as string[]

        const result = await updateBrokerWithCompatibility(supabase, id, payload, requiredColumns)

        if ((result as any).missingRequiredColumn) {
            const column = (result as any).missingRequiredColumn
            return NextResponse.json({
                error: 'missing_required_column',
                message: `A coluna ${column} ainda nao esta disponivel no Supabase. Execute a migracao do concierge ou aguarde o schema cache atualizar antes de salvar.`,
            }, { status: 409 })
        }

        if (result.error) {
            console.error('Update broker error:', result.error)
            return NextResponse.json({ error: result.error.message }, { status: 400 })
        }

        if (Array.isArray(empreendimento_ids)) {
            await supabase
                .from('broker_empreendimentos')
                .delete()
                .eq('broker_id', id)

            if (empreendimento_ids.length > 0) {
                const links = empreendimento_ids.map((eid: string, idx: number) => ({
                    broker_id: id,
                    empreendimento_id: eid,
                    ativo: true,
                    prioridade: idx + 1,
                }))
                await supabase
                    .from('broker_empreendimentos')
                    .upsert(links, { onConflict: 'broker_id,empreendimento_id' })
            }
        }

        if (Array.isArray(assistant_phones)) {
            try {
                await syncAssistantPhones(supabase, id, assistant_phones)
            } catch (err) {
                console.warn('Sync assistant phones warning:', err)
            }
        }

        return NextResponse.json({ data: result.data })
    } catch (err) {
        console.error('API error:', err)
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}
