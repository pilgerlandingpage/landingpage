export type SectorNotificationDeliveryMode = 'all_sector' | 'sector_and_diretoria' | 'primary_only' | 'muted'

export type SectorNotificationMember = {
    id: string
    name: string
    phone: string
    role?: string
    enabled: boolean
    critical_only?: boolean
    event_types?: string[]
}

export type SectorNotificationRecipient = {
    key: string
    label: string
    responsible_name: string
    phone: string
    enabled: boolean
    destination_type?: 'phone' | 'instance'
    delivery_mode?: SectorNotificationDeliveryMode
    event_types?: string[]
    members?: SectorNotificationMember[]
    target_instance_id?: string
    whatsapp_instance_id?: string
}

export type SectorNotificationDelivery = {
    recipient: SectorNotificationRecipient
    member?: SectorNotificationMember
    phone: string
}

type SupabaseAdmin = {
    from: (table: string) => any
}

export const SECTOR_NOTIFICATION_CONFIG_KEY = 'sector_notification_recipients'

export const SECTOR_NOTIFICATION_EVENTS = [
    { key: 'property_review', label: 'Imovel em analise' },
    { key: 'blog_review', label: 'Blog aguardando aprovacao' },
    { key: 'blog_published', label: 'Blog publicado' },
    { key: 'news_review', label: 'Noticia aguardando aprovacao' },
    { key: 'news_published', label: 'Noticia publicada' },
    { key: 'meta_payment_issue', label: 'Problema de pagamento Meta' },
    { key: 'google_payment_issue', label: 'Problema de pagamento Google' },
    { key: 'ads_alert', label: 'Alerta de trafego' },
    { key: 'ads_daily_report', label: 'Relatorio diario de trafego' },
    { key: 'paid_report_ready', label: 'Relatorio pago IA' },
    { key: 'lead_received', label: 'Novo lead recebido' },
    { key: 'system_integration_error', label: 'Erro de integracao' },
] as const

export const DEFAULT_SECTOR_NOTIFICATION_EVENT_KEYS = SECTOR_NOTIFICATION_EVENTS.map(event => event.key)

export const DEFAULT_SECTOR_NOTIFICATION_EVENT_TYPES: Record<string, string[]> = {
    comercial: ['lead_received', 'system_integration_error'],
    diretoria: ['blog_published', 'news_published', 'meta_payment_issue', 'google_payment_issue', 'ads_alert', 'ads_daily_report', 'paid_report_ready', 'system_integration_error'],
    marketing: ['property_review', 'blog_review', 'blog_published', 'news_review', 'news_published', 'paid_report_ready', 'system_integration_error'],
    trafego_pago: ['meta_payment_issue', 'google_payment_issue', 'ads_alert', 'ads_daily_report', 'paid_report_ready', 'system_integration_error'],
}

export const DEFAULT_SECTOR_NOTIFICATION_RECIPIENTS: SectorNotificationRecipient[] = [
    { key: 'comercial', label: 'Comercial', responsible_name: '', phone: '', enabled: true, destination_type: 'phone', delivery_mode: 'all_sector', event_types: DEFAULT_SECTOR_NOTIFICATION_EVENT_TYPES.comercial, members: [], target_instance_id: '', whatsapp_instance_id: '' },
    { key: 'diretoria', label: 'Diretoria', responsible_name: '', phone: '', enabled: true, destination_type: 'phone', delivery_mode: 'all_sector', event_types: DEFAULT_SECTOR_NOTIFICATION_EVENT_TYPES.diretoria, members: [], target_instance_id: '', whatsapp_instance_id: '' },
    { key: 'marketing', label: 'Marketing', responsible_name: '', phone: '', enabled: true, destination_type: 'phone', delivery_mode: 'all_sector', event_types: DEFAULT_SECTOR_NOTIFICATION_EVENT_TYPES.marketing, members: [], target_instance_id: '', whatsapp_instance_id: '' },
    { key: 'trafego_pago', label: 'Trafego Pago', responsible_name: '', phone: '', enabled: true, destination_type: 'phone', delivery_mode: 'all_sector', event_types: DEFAULT_SECTOR_NOTIFICATION_EVENT_TYPES.trafego_pago, members: [], target_instance_id: '', whatsapp_instance_id: '' },
]

const SECTOR_ALIASES: Record<string, string> = {
    ads: 'trafego_pago',
    marketing: 'marketing',
    markeing: 'marketing',
    trafego: 'trafego_pago',
    trafego_pago: 'trafego_pago',
    'trÃ¡fego': 'trafego_pago',
    'trÃ¡fego_pago': 'trafego_pago',
}

export function normalizeSectorKey(value: string) {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_')
        .replace(/-+/g, '_')

    return SECTOR_ALIASES[normalized] || normalized
}

export function normalizeSectorPhone(value: unknown) {
    return String(value || '').replace(/\D/g, '')
}

function isEnabled(value: unknown) {
    return value !== false && value !== 'false'
}

function normalizeDeliveryMode(value: unknown, fallback?: SectorNotificationDeliveryMode): SectorNotificationDeliveryMode {
    const mode = String(value || fallback || 'all_sector')
    if (mode === 'sector_and_diretoria' || mode === 'primary_only' || mode === 'muted') return mode
    return 'all_sector'
}

function normalizeEventTypes(value: unknown, fallback: string[] | undefined, sectorKey: string) {
    if (Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean)
    if (typeof value === 'string') {
        const trimmed = value.trim()
        if (!trimmed) return []
        try {
            const parsed = JSON.parse(trimmed)
            if (Array.isArray(parsed)) return parsed.map(String).map(item => item.trim()).filter(Boolean)
        } catch {
            return trimmed.split(',').map(item => item.trim()).filter(Boolean)
        }
    }
    if (Array.isArray(fallback)) return [...fallback]
    return [...(DEFAULT_SECTOR_NOTIFICATION_EVENT_TYPES[sectorKey] || DEFAULT_SECTOR_NOTIFICATION_EVENT_KEYS)]
}

function memberIdFrom(index: number, member: Pick<SectorNotificationMember, 'name' | 'phone'>) {
    const basis = normalizeSectorPhone(member.phone) || String(member.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    return `member-${index + 1}${basis ? `-${basis}` : ''}`
}

function normalizeMemberEventTypes(value: unknown, fallback?: string[]) {
    if (Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean)
    if (typeof value === 'string') {
        const trimmed = value.trim()
        if (!trimmed) return []
        try {
            const parsed = JSON.parse(trimmed)
            if (Array.isArray(parsed)) return parsed.map(String).map(item => item.trim()).filter(Boolean)
        } catch {
            return trimmed.split(',').map(item => item.trim()).filter(Boolean)
        }
    }
    return Array.isArray(fallback) ? [...fallback] : undefined
}

function normalizeMember(item: any, index: number, fallbackEventTypes?: string[]): SectorNotificationMember {
    const phone = String(item?.phone || item?.whatsapp || '')
    const name = String(item?.name || item?.responsible_name || item?.responsibleName || '')
    const member = {
        id: String(item?.id || ''),
        name,
        phone,
        role: String(item?.role || item?.cargo || ''),
        enabled: isEnabled(item?.enabled),
        critical_only: item?.critical_only === true || item?.criticalOnly === true || item?.critical_only === 'true',
        event_types: normalizeMemberEventTypes(item?.event_types ?? item?.eventTypes, fallbackEventTypes),
    }
    return {
        ...member,
        id: member.id || memberIdFrom(index, member),
    }
}

function normalizeRecipient(item: any, fallback?: SectorNotificationRecipient): SectorNotificationRecipient | null {
    const key = normalizeSectorKey(item?.key || item?.sector || item?.label || fallback?.key || '')
    if (!key) return null

    const recipientEventTypes = normalizeEventTypes(item?.event_types ?? item?.eventTypes, fallback?.event_types, key)
    const rawMembers = Array.isArray(item?.members)
        ? item.members.map((member: any, index: number) => normalizeMember(member, index, recipientEventTypes))
        : []
    const legacyName = String(item?.responsible_name || item?.responsibleName || item?.name || fallback?.responsible_name || '')
    const legacyPhone = String(item?.phone || item?.whatsapp || fallback?.phone || '')
    const members: SectorNotificationMember[] = rawMembers.length
        ? rawMembers
        : (legacyName || legacyPhone)
            ? [normalizeMember({ id: 'primary', name: legacyName, phone: legacyPhone, role: 'Responsavel', enabled: true, event_types: recipientEventTypes }, 0, recipientEventTypes)]
            : [...(fallback?.members || [])]
    const primaryMember = members.find(member => member.enabled !== false && normalizeSectorPhone(member.phone))
        || members.find(member => normalizeSectorPhone(member.phone))
        || members[0]

    return {
        key,
        label: String(item?.label || item?.sector || fallback?.label || key),
        responsible_name: String(item?.responsible_name || item?.responsibleName || primaryMember?.name || fallback?.responsible_name || ''),
        phone: String(item?.phone || item?.whatsapp || primaryMember?.phone || fallback?.phone || ''),
        enabled: isEnabled(item?.enabled ?? fallback?.enabled),
        destination_type: item?.destination_type === 'instance' ? 'instance' : (fallback?.destination_type || 'phone'),
        delivery_mode: normalizeDeliveryMode(item?.delivery_mode || item?.deliveryMode, fallback?.delivery_mode),
        event_types: recipientEventTypes,
        members,
        target_instance_id: String(item?.target_instance_id || item?.targetInstanceId || fallback?.target_instance_id || ''),
        whatsapp_instance_id: String(item?.whatsapp_instance_id || item?.whatsappInstanceId || fallback?.whatsapp_instance_id || ''),
    }
}

function parseRecipients(raw?: string | null): SectorNotificationRecipient[] {
    if (!raw) return []

    try {
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []

        return parsed
            .map((item: any) => normalizeRecipient(item))
            .filter(Boolean) as SectorNotificationRecipient[]
    } catch {
        return []
    }
}

export function parseSectorNotificationRecipients(raw?: string | null) {
    return parseRecipients(raw)
}

function mergeRecipients(
    storedRecipients: SectorNotificationRecipient[],
    legacyMarketing?: Partial<SectorNotificationRecipient>
) {
    const byKey = new Map<string, SectorNotificationRecipient>()

    for (const recipient of DEFAULT_SECTOR_NOTIFICATION_RECIPIENTS) {
        byKey.set(recipient.key, { ...recipient, event_types: [...(recipient.event_types || [])], members: [...(recipient.members || [])] })
    }

    if (legacyMarketing?.phone || legacyMarketing?.responsible_name || legacyMarketing?.whatsapp_instance_id) {
        const fallback = byKey.get('marketing') || DEFAULT_SECTOR_NOTIFICATION_RECIPIENTS[2]
        byKey.set('marketing', normalizeRecipient({
            ...fallback,
            ...legacyMarketing,
            key: 'marketing',
            label: legacyMarketing.label || 'Marketing',
            enabled: legacyMarketing.enabled ?? true,
        }, fallback) || fallback)
    }

    for (const recipient of storedRecipients) {
        const key = normalizeSectorKey(recipient.key)
        const fallback = byKey.get(key)
        const normalized = normalizeRecipient(recipient, fallback)
        if (normalized) byKey.set(key, normalized)
    }

    return Array.from(byKey.values())
}

export function mergeSectorNotificationRecipients(
    storedRecipients: SectorNotificationRecipient[],
    legacyMarketing?: Partial<SectorNotificationRecipient>
) {
    return mergeRecipients(storedRecipients, legacyMarketing)
}

export function getSectorNotificationRecipientsFromConfig(configMap: Record<string, string>) {
    const storedRecipients = parseRecipients(configMap[SECTOR_NOTIFICATION_CONFIG_KEY])

    return mergeRecipients(storedRecipients, {
        label: configMap.property_review_sector_name || 'Marketing',
        responsible_name: configMap.property_review_responsible_name || '',
        phone: configMap.property_review_responsible_phone || '',
        whatsapp_instance_id: configMap.property_review_whatsapp_instance_id || '',
    })
}

export async function getSectorNotificationRecipients(supabase: SupabaseAdmin) {
    const { data, error } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', [
            SECTOR_NOTIFICATION_CONFIG_KEY,
            'property_review_sector_name',
            'property_review_responsible_name',
            'property_review_responsible_phone',
            'property_review_whatsapp_instance_id',
        ])

    if (error) throw error

    const configMap = Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')])) as Record<string, string>
    const storedRecipients = parseRecipients(configMap[SECTOR_NOTIFICATION_CONFIG_KEY])

    return mergeRecipients(storedRecipients, {
        label: configMap.property_review_sector_name || 'Marketing',
        responsible_name: configMap.property_review_responsible_name || '',
        phone: configMap.property_review_responsible_phone || '',
        whatsapp_instance_id: configMap.property_review_whatsapp_instance_id || '',
    })
}

export async function getSectorNotificationRecipient(supabase: SupabaseAdmin, sectorKey: string) {
    const normalizedKey = normalizeSectorKey(sectorKey)
    const recipients = await getSectorNotificationRecipients(supabase)
    return recipients.find(recipient => normalizeSectorKey(recipient.key) === normalizedKey) || null
}

async function getConfiguredGlobalInstanceId(supabase: SupabaseAdmin) {
    const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'agent_default_instance_id')
        .maybeSingle()

    return String(data?.value || '').trim()
}

async function getGlobalWhatsAppInstance(supabase: SupabaseAdmin) {
    const configuredInstanceId = await getConfiguredGlobalInstanceId(supabase)
    if (!configuredInstanceId) return null

    const { data } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_token, phone_number, status')
        .eq('id', configuredInstanceId)
        .maybeSingle()

    if (data?.instance_token && data.status === 'connected') return data
    return null
}

function eventAllowed(recipient: SectorNotificationRecipient, eventType?: string) {
    if (!eventType) return true
    const eventTypes = Array.isArray(recipient.event_types) ? recipient.event_types : []
    return eventTypes.includes(eventType)
}

function memberEventAllowed(member: SectorNotificationMember, eventType?: string) {
    if (!eventType) return true
    if (!Array.isArray(member.event_types)) return true
    if (member.event_types.length === 0) return false
    return member.event_types.includes(eventType)
}

async function resolveRecipientDeliveries(
    supabase: SupabaseAdmin,
    recipient: SectorNotificationRecipient,
    options: { eventType?: string; critical?: boolean } = {}
): Promise<SectorNotificationDelivery[]> {
    if (!recipient || !recipient.enabled || recipient.delivery_mode === 'muted') return []
    if (!eventAllowed(recipient, options.eventType)) return []

    if (recipient.destination_type === 'instance') {
        if (!recipient.target_instance_id) return []

        const [{ data: targetInstance }, globalInstance] = await Promise.all([
            supabase
                .from('whatsapp_instances')
                .select('id, instance_name, phone_number, status')
                .eq('id', recipient.target_instance_id)
                .maybeSingle(),
            getGlobalWhatsAppInstance(supabase),
        ])

        if (!targetInstance || targetInstance.status !== 'connected') return []
        if (globalInstance?.id && targetInstance.id === globalInstance.id) return []

        const phone = normalizeSectorPhone(targetInstance.phone_number)
        if (!phone) return []

        return [{
            recipient: {
                ...recipient,
                responsible_name: recipient.responsible_name || targetInstance.instance_name || recipient.label,
                phone,
            },
            phone,
        }]
    }

    const members = Array.isArray(recipient.members) ? recipient.members : []
    const normalizedMembers = members.length
        ? members
        : [normalizeMember({ id: 'primary', name: recipient.responsible_name, phone: recipient.phone, role: 'Responsavel', enabled: true, event_types: recipient.event_types }, 0, recipient.event_types)]
    const selectedMembers = recipient.delivery_mode === 'primary_only'
        ? normalizedMembers.slice(0, 1)
        : normalizedMembers

    return selectedMembers
        .filter(member => member.enabled !== false)
        .filter(member => memberEventAllowed(member, options.eventType))
        .filter(member => !member.critical_only || options.critical)
        .map(member => ({ member, recipient, phone: normalizeSectorPhone(member.phone) }))
        .filter(delivery => Boolean(delivery.phone))
}

export async function getSectorNotificationDeliveries(
    supabase: SupabaseAdmin,
    sectorKey: string,
    options: { eventType?: string; critical?: boolean; includeDiretoria?: boolean } = {}
) {
    const normalizedKey = normalizeSectorKey(sectorKey)
    const recipients = await getSectorNotificationRecipients(supabase)
    const baseRecipient = recipients.find(recipient => normalizeSectorKey(recipient.key) === normalizedKey)
    if (!baseRecipient) return []

    const keys = new Set<string>([normalizedKey])
    if ((baseRecipient.delivery_mode === 'sector_and_diretoria' || options.includeDiretoria) && normalizedKey !== 'diretoria') {
        keys.add('diretoria')
    }

    const deliveries: SectorNotificationDelivery[] = []
    const seenPhones = new Set<string>()
    for (const key of keys) {
        const recipient = recipients.find(item => normalizeSectorKey(item.key) === key)
        if (!recipient) continue

        const resolved = await resolveRecipientDeliveries(supabase, recipient, options)
        for (const delivery of resolved) {
            if (seenPhones.has(delivery.phone)) continue
            seenPhones.add(delivery.phone)
            deliveries.push(delivery)
        }
    }

    return deliveries
}

export async function getSectorNotificationDelivery(supabase: SupabaseAdmin, sectorKey: string) {
    const deliveries = await getSectorNotificationDeliveries(supabase, sectorKey)
    return deliveries[0] || null
}

export async function resolveSectorWhatsappInstance(supabase: SupabaseAdmin, configuredInstanceId?: string) {
    if (configuredInstanceId) {
        const { data } = await supabase
            .from('whatsapp_instances')
            .select('instance_token, status')
            .eq('id', configuredInstanceId)
            .maybeSingle()

        if (data?.instance_token && data.status === 'connected') return data.instance_token
    }

    const data = await getGlobalWhatsAppInstance(supabase)

    return data?.instance_token || ''
}

export async function resolveSystemNotificationWhatsappInstance(supabase: SupabaseAdmin) {
    return resolveSectorWhatsappInstance(supabase)
}
