import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { GLOBAL_PROPERTY_BROKER_NAME, GLOBAL_PROPERTY_WHATSAPP_PHONE, resolveWhatsAppInstancePhotoUrl } from '@/lib/properties/responsible-broker'

export const dynamic = 'force-dynamic'

type BrokerRow = {
    id: string
    name: string
    phone: string | null
    photo_url: string | null
    greeting_message: string | null
    assignment_type: string | null
    assigned_page_slugs: string[] | null
    is_active: boolean | null
}

type InstanceRow = {
    id: string
    broker_id: string | null
    instance_name: string | null
    instance_type: string | null
    status: string | null
    phone_number: string | null
    instance_token: string | null
    live_data: Record<string, any> | null
    connected_at: string | null
    created_at: string | null
}

function normalizePhone(value: unknown): string | null {
    let digits = String(value || '').replace(/\D/g, '')
    if (!digits) return null
    if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
        digits = `55${digits}`
    }
    return digits
}

function normalizeName(value: unknown): string {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
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

function isGlobalInstance(instance: InstanceRow): boolean {
    const type = normalizeName(instance.instance_type)
    const name = normalizeName(instance.instance_name)
    return type === 'global' || name === 'agente global' || name === 'whatsapp global'
}

function isGlobalBrokerName(name: unknown): boolean {
    const normalizedName = normalizeName(name)
    return normalizedName.includes('global') || normalizedName === 'whatsapp global' || normalizedName === 'agente global'
}

function isGuilhermeBrokerName(name: unknown): boolean {
    const normalizedName = normalizeName(name)
    return (
        normalizedName.includes('guilherme pilger') ||
        normalizedName.includes('guilherme pliger') ||
        normalizedName.includes('comercial guilherme')
    )
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

async function getAssignedBrokerId(supabase: any, slug: string): Promise<string | null> {
    if (!slug) return null

    const { data, error } = await supabase
        .from('landing_pages')
        .select('assigned_broker_id')
        .eq('slug', slug)
        .maybeSingle()

    if (error) {
        console.warn('[broker-for-page] Landing assignment warning:', error.message)
        return null
    }

    return data?.assigned_broker_id ? String(data.assigned_broker_id) : null
}

async function getBrokerWhatsAppInstance(supabase: any, brokerId: string): Promise<InstanceRow | null> {
    const withLiveData = await supabase
        .from('whatsapp_instances')
        .select('id, broker_id, instance_name, instance_type, status, phone_number, instance_token, live_data, connected_at, created_at')
        .eq('broker_id', brokerId)
        .order('created_at', { ascending: false })

    const result = !withLiveData.error
        ? withLiveData
        : await supabase
            .from('whatsapp_instances')
            .select('id, broker_id, instance_name, instance_type, status, phone_number, instance_token, connected_at, created_at')
            .eq('broker_id', brokerId)
            .order('created_at', { ascending: false })

    if (result.error) {
        console.warn('[broker-for-page] WhatsApp instance warning:', result.error.message)
        return null
    }

    const instances = ((result.data || []) as InstanceRow[])
        .map(instance => ({ ...instance, live_data: instance.live_data || null }))
        .filter(instance => !isGlobalInstance(instance))
        .sort((a, b) => {
            const byStatus = statusRank(a.status) - statusRank(b.status)
            if (byStatus !== 0) return byStatus
            return timeValue(b.connected_at || b.created_at) - timeValue(a.connected_at || a.created_at)
        })

    return instances[0] || null
}

async function getGlobalWhatsAppInstance(supabase: any): Promise<InstanceRow | null> {
    const withLiveData = await supabase
        .from('whatsapp_instances')
        .select('id, broker_id, instance_name, instance_type, status, phone_number, instance_token, live_data, connected_at, created_at')
        .order('created_at', { ascending: false })

    const result = !withLiveData.error
        ? withLiveData
        : await supabase
            .from('whatsapp_instances')
            .select('id, broker_id, instance_name, instance_type, status, phone_number, instance_token, connected_at, created_at')
            .order('created_at', { ascending: false })

    if (result.error) {
        console.warn('[broker-for-page] Global WhatsApp instance warning:', result.error.message)
        return null
    }

    const instances = ((result.data || []) as InstanceRow[])
        .map(instance => ({ ...instance, live_data: instance.live_data || null }))
        .filter(isGlobalInstance)
        .sort((a, b) => {
            const byStatus = statusRank(a.status) - statusRank(b.status)
            if (byStatus !== 0) return byStatus
            return timeValue(b.connected_at || b.created_at) - timeValue(a.connected_at || a.created_at)
        })

    return instances[0] || null
}

/**
 * Retorna o corretor atribuido a uma pagina especifica.
 *
 * Query: ?slug=home ou ?slug=brava-concetto
 *
 * Logica:
 * 1. Busca corretor selecionado na landing page (assigned_broker_id)
 * 2. Fallback: busca corretor IA com assigned_page_slugs contendo o slug
 * 3. Fallback: busca corretor com assignment_type = 'all'
 * 4. Se multiplos, retorna o primeiro ativo
 */
export async function GET(request: NextRequest) {
    try {
        const slug = request.nextUrl.searchParams.get('slug') || ''
        const supabase = createAdminClient()

        const { data } = await supabase
            .from('virtual_brokers')
            .select('id, name, phone, photo_url, greeting_message, assignment_type, assigned_page_slugs, is_active')
            .order('name')

        const brokers = (data || []) as BrokerRow[]

        if (brokers.length === 0) {
            return NextResponse.json({ broker: null, message: 'Nenhum corretor IA ativo' })
        }

        const assignedBrokerId = await getAssignedBrokerId(supabase, slug)
        const activeBrokers = brokers.filter(broker => broker.is_active !== false)

        let matchedBroker: BrokerRow | null = assignedBrokerId
            ? brokers.find(broker => broker.id === assignedBrokerId) || null
            : null

        if (!matchedBroker) {
            matchedBroker = activeBrokers.find(broker =>
                broker.assignment_type === 'landing_pages' &&
                broker.assigned_page_slugs?.includes(slug)
            ) || null
        }

        if (!matchedBroker) {
            matchedBroker = activeBrokers.find(broker => broker.assignment_type === 'all') || null
        }

        if (!matchedBroker) {
            matchedBroker = activeBrokers[0] || brokers[0]
        }

        if (isGuilhermeBrokerName(matchedBroker.name) || isGlobalBrokerName(matchedBroker.name)) {
            const globalInstance = await getGlobalWhatsAppInstance(supabase)
            const phone = extractLivePhone(globalInstance?.live_data) ||
                normalizePhone(globalInstance?.phone_number) ||
                GLOBAL_PROPERTY_WHATSAPP_PHONE
            const photoUrl = await resolveWhatsAppInstancePhotoUrl(globalInstance)

            return NextResponse.json({
                broker: {
                    id: 'global',
                    name: GLOBAL_PROPERTY_BROKER_NAME,
                    phone,
                    photo_url: photoUrl,
                    greeting_message: 'Olá, quero falar com Guilherme Pilger sobre os imóveis.',
                    whatsapp_instance_id: globalInstance?.id || null,
                    whatsapp_instance_name: globalInstance?.instance_name || null,
                    whatsapp_instance_status: globalInstance?.status || null,
                }
            })
        }

        const whatsappInstance = await getBrokerWhatsAppInstance(supabase, matchedBroker.id)
        const phone = extractLivePhone(whatsappInstance?.live_data) ||
            normalizePhone(whatsappInstance?.phone_number) ||
            normalizePhone(matchedBroker.phone)

        return NextResponse.json({
            broker: {
                id: matchedBroker.id,
                name: matchedBroker.name,
                phone,
                photo_url: matchedBroker.photo_url || await resolveWhatsAppInstancePhotoUrl(whatsappInstance),
                greeting_message: matchedBroker.greeting_message || 'Ola, gostaria de mais informacoes sobre os imoveis',
                whatsapp_instance_id: whatsappInstance?.id || null,
                whatsapp_instance_name: whatsappInstance?.instance_name || null,
                whatsapp_instance_status: whatsappInstance?.status || null,
            }
        })
    } catch (error) {
        console.error('[broker-for-page] Erro:', error)
        return NextResponse.json({ broker: null, error: 'Erro interno' }, { status: 500 })
    }
}
