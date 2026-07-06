import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type BrokerRow = {
    id: string
    name: string | null
    phone: string | null
    is_active: boolean | null
}

type InstanceRow = {
    id: string
    broker_id: string | null
    admin_user_id: string | null
    instance_name: string | null
    instance_type: string | null
    status: string | null
    phone_number: string | null
    live_data: Record<string, any> | null
    connected_at: string | null
    created_at: string | null
}

type AdminUserRow = {
    id: string
    name: string | null
    email: string | null
}

type BrokerOption = {
    id: string
    name: string
    phone: string | null
    is_active: boolean
    source: 'whatsapp_instance' | 'virtual_broker'
    instance_id: string | null
    instance_name: string | null
    instance_status: string | null
}

function normalizePhone(value: unknown): string | null {
    let digits = String(value || '').replace(/\D/g, '')
    if (!digits) return null
    if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
        digits = `55${digits}`
    }
    return digits
}

function extractLivePhone(liveData: unknown): string | null {
    if (!liveData || typeof liveData !== 'object') return null
    const data = liveData as Record<string, any>
    return normalizePhone(
        data.phone ||
        data.phoneNumber ||
        data.phone_number ||
        data.number ||
        data.jid ||
        data.me?.id ||
        data.me?.jid ||
        data.instance?.phone ||
        data.instance?.me?.id ||
        data.data?.phone
    )
}

function isTechnicalName(value: unknown): boolean {
    const text = String(value || '').trim().toLowerCase()
    if (!text) return true
    return (
        /^user_[a-z0-9-]{8,}(?:[_-]\d+)?$/i.test(text) ||
        /^ch-api-user-[a-z0-9-]{8,}(?:-\d+)?$/i.test(text) ||
        /^instance[_-]?[a-z0-9-]{8,}(?:[_-]\d+)?$/i.test(text) ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)
    )
}

function cleanDisplayName(value: unknown): string | null {
    const text = String(value || '').trim()
    return text && !isTechnicalName(text) ? text : null
}

function isGlobalInstance(instance: InstanceRow): boolean {
    const type = String(instance.instance_type || '').trim().toLowerCase()
    const name = String(instance.instance_name || '').trim().toLowerCase()
    return type === 'global' || name === 'agente global' || name === 'whatsapp global'
}

function statusRank(status: unknown): number {
    const value = String(status || '').trim().toLowerCase()
    if (value === 'connected' || value === 'open') return 0
    if (value === 'connecting') return 1
    return 2
}

function timeValue(value: unknown): number {
    const time = Date.parse(String(value || ''))
    return Number.isFinite(time) ? time : 0
}

function resolveBrokerName(broker: BrokerRow, adminUser?: AdminUserRow | null): string {
    return cleanDisplayName(adminUser?.name) ||
        cleanDisplayName(broker.name) ||
        adminUser?.email ||
        broker.name ||
        'Corretor'
}

async function listBrokerInstances(supabase: any): Promise<{ data: InstanceRow[]; error: any }> {
    const withLiveData = await supabase
        .from('whatsapp_instances')
        .select('id, broker_id, admin_user_id, instance_name, instance_type, status, phone_number, live_data, connected_at, created_at')
        .not('broker_id', 'is', null)
        .order('created_at', { ascending: false })

    if (!withLiveData.error) return { data: (withLiveData.data || []) as InstanceRow[], error: null }

    const withoutLiveData = await supabase
        .from('whatsapp_instances')
        .select('id, broker_id, admin_user_id, instance_name, instance_type, status, phone_number, connected_at, created_at')
        .not('broker_id', 'is', null)
        .order('created_at', { ascending: false })

    return {
        data: ((withoutLiveData.data || []) as Omit<InstanceRow, 'live_data'>[]).map(instance => ({
            ...instance,
            live_data: null,
        })),
        error: withoutLiveData.error,
    }
}

export async function GET() {
    try {
        const supabase = createAdminClient()

        const [brokersResult, instancesResult] = await Promise.all([
            supabase
                .from('virtual_brokers')
                .select('id, name, phone, is_active')
                .order('name'),
            listBrokerInstances(supabase),
        ])

        if (brokersResult.error) {
            return NextResponse.json({ error: brokersResult.error.message }, { status: 400 })
        }

        const brokers = (brokersResult.data || []) as BrokerRow[]
        const instances = instancesResult.error
            ? []
            : ((instancesResult.data || []) as InstanceRow[]).filter(instance => instance.broker_id && !isGlobalInstance(instance))

        if (instancesResult.error) {
            console.warn('[landing-page-brokers] WhatsApp instances warning:', instancesResult.error.message)
        }

        const adminIds = Array.from(new Set(instances.map(instance => instance.admin_user_id).filter(Boolean))) as string[]
        const adminsById = new Map<string, AdminUserRow>()

        if (adminIds.length > 0) {
            const { data: admins, error: adminsError } = await supabase
                .from('admin_users')
                .select('id, name, email')
                .in('id', adminIds)

            if (!adminsError) {
                for (const admin of (admins || []) as AdminUserRow[]) {
                    adminsById.set(admin.id, admin)
                }
            } else {
                console.warn('[landing-page-brokers] Admin users warning:', adminsError.message)
            }
        }

        const brokersById = new Map(brokers.map(broker => [broker.id, broker]))
        const bestInstanceByBroker = new Map<string, InstanceRow>()

        for (const instance of [...instances].sort((a, b) => {
            const byStatus = statusRank(a.status) - statusRank(b.status)
            if (byStatus !== 0) return byStatus
            return timeValue(b.connected_at || b.created_at) - timeValue(a.connected_at || a.created_at)
        })) {
            const brokerId = String(instance.broker_id || '')
            if (!brokerId || bestInstanceByBroker.has(brokerId)) continue
            bestInstanceByBroker.set(brokerId, instance)
        }

        const options = Array.from(bestInstanceByBroker.entries())
            .map(([brokerId, instance]): BrokerOption | null => {
                const broker = brokersById.get(brokerId)
                if (!broker) return null
                const adminUser = instance.admin_user_id ? adminsById.get(instance.admin_user_id) || null : null
                const name = resolveBrokerName(broker, adminUser)
                return {
                    id: broker.id,
                    name,
                    phone: extractLivePhone(instance.live_data) || normalizePhone(instance.phone_number) || normalizePhone(broker.phone),
                    is_active: broker.is_active !== false,
                    source: 'whatsapp_instance',
                    instance_id: instance.id,
                    instance_name: instance.instance_name,
                    instance_status: instance.status,
                }
            })
            .filter((option): option is BrokerOption => Boolean(option))

        const optionBrokerIds = new Set(options.map(option => option.id))

        for (const broker of brokers) {
            if (optionBrokerIds.has(broker.id) || broker.is_active === false) continue
            options.push({
                id: broker.id,
                name: cleanDisplayName(broker.name) || broker.name || 'Corretor',
                phone: normalizePhone(broker.phone),
                is_active: true,
                source: 'virtual_broker',
                instance_id: null,
                instance_name: null,
                instance_status: null,
            })
        }

        options.sort((a, b) => {
            if (a.source !== b.source) return a.source === 'whatsapp_instance' ? -1 : 1
            const byStatus = statusRank(a.instance_status) - statusRank(b.instance_status)
            if (byStatus !== 0) return byStatus
            return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')
        })

        return NextResponse.json({ data: options })
    } catch (error) {
        console.error('[landing-page-brokers] Error:', error)
        return NextResponse.json({ error: 'Erro ao carregar corretores das instancias' }, { status: 500 })
    }
}
