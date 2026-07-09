import { getContactAvatar, getInstanceStatus } from '@/lib/connectyhub/whatsapp'

export const GLOBAL_PROPERTY_WHATSAPP_PHONE = '5547992528080'
export const GLOBAL_PROPERTY_BROKER_NAME = 'Guilherme Pilger'
const INSTANCE_PHOTO_CACHE_TTL_MS = 10 * 60 * 1000
const instancePhotoCache = new Map<string, { photoUrl: string; expiresAt: number }>()

export type ResponsibleBrokerContact = {
    broker_id: string | null
    admin_user_id: string | null
    whatsapp_instance_id: string | null
    legacy_name: string | null
    legacy_login: string | null
    name: string
    phone: string
    photo_url: string | null
    email: string | null
    creci: string | null
    is_connected: boolean
    source: 'virtual_broker' | 'admin_user' | 'global'
}

type SupabaseLike = {
    from: (table: string) => any
}

type PropertyLike = {
    id?: string | null
    [key: string]: any
}

function normalizeName(value?: string | null) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function normalizePhone(value?: string | null) {
    let digits = String(value || '').replace(/\D/g, '')
    if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
        digits = `55${digits}`
    }
    return digits
}

function extractLivePhone(liveData: unknown): string {
    if (!liveData || typeof liveData !== 'object') return ''
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

function firstLiveString(...values: unknown[]) {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) return value.trim()
    }
    return ''
}

function extractLivePhotoUrl(liveData: unknown): string {
    if (!liveData || typeof liveData !== 'object') return ''
    const data = liveData as Record<string, any>
    const instance = data.instance || data.data?.instance || null
    const me = data.me || instance?.me || null

    return firstLiveString(
        data.profileImageUrl,
        data.profile_image_url,
        data.profilePicUrl,
        data.profilePictureUrl,
        data.picture,
        data.avatar,
        data.photo_url,
        data.url,
        data.imgUrl,
        data.imagePreview,
        data.image,
        data.data?.profileImageUrl,
        data.data?.profile_image_url,
        data.data?.profilePicUrl,
        data.data?.profilePictureUrl,
        data.data?.picture,
        data.data?.avatar,
        data.data?.url,
        data.data?.imgUrl,
        data.data?.imagePreview,
        data.data?.image,
        instance?.profileImageUrl,
        instance?.profile_image_url,
        instance?.profilePicUrl,
        instance?.profilePictureUrl,
        instance?.picture,
        instance?.avatar,
        instance?.url,
        instance?.imgUrl,
        instance?.imagePreview,
        instance?.image,
        me?.profileImageUrl,
        me?.profilePicUrl,
        me?.profilePictureUrl,
        me?.picture,
        me?.avatar,
        me?.url,
        me?.imgUrl,
        me?.imagePreview,
        me?.image
    )
}

function isGlobalInstance(instance: any) {
    const type = normalizeName(instance?.instance_type)
    const name = normalizeName(instance?.instance_name)
    return type === 'global' || name === 'agente global' || name === 'whatsapp global'
}

function isConnectedStatus(status: unknown) {
    const value = String(status || '').trim().toLowerCase()
    return value === 'connected' || value === 'open'
}

function timeValue(value: unknown) {
    const time = Date.parse(String(value || ''))
    return Number.isFinite(time) ? time : 0
}

function globalInstanceFor(instances: any[]) {
    return instances
        .filter(isGlobalInstance)
        .sort((a, b) => {
            const byStatus = Number(!isConnectedStatus(a?.status)) - Number(!isConnectedStatus(b?.status))
            if (byStatus !== 0) return byStatus
            return timeValue(b?.connected_at || b?.created_at) - timeValue(a?.connected_at || a?.created_at)
        })[0] || null
}

export async function resolveWhatsAppInstancePhotoUrl(instance: any): Promise<string> {
    const storedPhotoUrl = extractLivePhotoUrl(instance?.live_data)
    if (storedPhotoUrl) return storedPhotoUrl

    const instanceToken = String(instance?.instance_token || '').trim()
    if (!instanceToken) return ''

    const cacheKey = String(instance?.id || instanceToken)
    const cached = instancePhotoCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) return cached.photoUrl

    let photoUrl = ''

    try {
        const liveStatus = await getInstanceStatus(instanceToken)
        photoUrl = extractLivePhotoUrl(liveStatus)
    } catch (error) {
        console.warn('[responsible-broker] WhatsApp status photo lookup failed:', error instanceof Error ? error.message : error)
    }

    if (!photoUrl) {
        const phone = extractLivePhone(instance?.live_data) || normalizePhone(instance?.phone_number)
        if (phone) {
            try {
                const avatarData = await getContactAvatar(phone, instanceToken)
                photoUrl = extractLivePhotoUrl(avatarData)
            } catch (error) {
                console.warn('[responsible-broker] WhatsApp avatar lookup failed:', error instanceof Error ? error.message : error)
            }
        }
    }

    if (photoUrl) {
        instancePhotoCache.set(cacheKey, {
            photoUrl,
            expiresAt: Date.now() + INSTANCE_PHOTO_CACHE_TTL_MS,
        })
    }

    return photoUrl
}

function isGuilhermeBrokerReference(legacyName?: string | null, legacyLogin?: string | null) {
    const normalizedName = normalizeName(legacyName)
    const normalizedLogin = normalizeName(legacyLogin)

    return (
        normalizedLogin === 'guilherme10' ||
        normalizedName.includes('guilherme pilger') ||
        normalizedName.includes('guilherme pliger') ||
        normalizedName.includes('comercial guilherme')
    )
}

function candidateNames(legacyName?: string | null, legacyLogin?: string | null) {
    const names = new Set<string>()
    const normalizedName = normalizeName(legacyName)
    const normalizedLogin = normalizeName(legacyLogin)

    if (normalizedName) names.add(normalizedName)
    if (normalizedLogin) names.add(normalizedLogin)

    if (normalizedName.includes('comercial guilherme pilger') || normalizedLogin === 'guilherme10') {
        names.add('guilherme pilger')
        names.add('guilherme pliger')
    }

    if (normalizedName === 'guilherme pilger') {
        names.add('guilherme pliger')
    }

    if (normalizedName.includes('reginaldo')) {
        names.add('reginaldo')
    }

    return [...names].filter(Boolean)
}

function namesMatch(target: string, candidates: string[]) {
    if (!target) return false
    return candidates.some(candidate => (
        target === candidate ||
        (candidate.length >= 4 && target.includes(candidate)) ||
        (target.length >= 4 && candidate.includes(target))
    ))
}

function connectedInstanceFor(instances: any[], match: { id?: string | null; whatsapp_instance_id?: string | null }, key: 'broker_id' | 'admin_user_id') {
    return instances.find(instance => (
        instance?.status === 'connected' &&
        (
            (match.id && instance?.[key] === match.id) ||
            (match.whatsapp_instance_id && instance?.id === match.whatsapp_instance_id)
        )
    )) || null
}

function connectedVirtualBrokerMatch(instances: any[], brokers: any[]) {
    for (const broker of brokers) {
        const instance = connectedInstanceFor(instances, broker, 'broker_id')
        if (instance) return { broker, instance }
    }

    return null
}

function globalContact(legacyName?: string | null, legacyLogin?: string | null, instances: any[] = [], resolvedPhotoUrl?: string | null): ResponsibleBrokerContact {
    const globalInstance = globalInstanceFor(instances)
    const globalPhone = extractLivePhone(globalInstance?.live_data) ||
        normalizePhone(globalInstance?.phone_number) ||
        GLOBAL_PROPERTY_WHATSAPP_PHONE
    const globalPhotoUrl = resolvedPhotoUrl || extractLivePhotoUrl(globalInstance?.live_data) || null

    return {
        broker_id: null,
        admin_user_id: null,
        whatsapp_instance_id: globalInstance?.id || null,
        legacy_name: legacyName || null,
        legacy_login: legacyLogin || null,
        name: GLOBAL_PROPERTY_BROKER_NAME,
        phone: globalPhone,
        photo_url: globalPhotoUrl,
        email: null,
        creci: null,
        is_connected: Boolean(globalInstance && isConnectedStatus(globalInstance.status)),
        source: 'global',
    }
}

async function fetchAllRows(supabase: SupabaseLike, table: string, select: string) {
    const rows: any[] = []
    const pageSize = 1000

    for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
            .from(table)
            .select(select)
            .range(from, from + pageSize - 1)

        if (error) throw error
        rows.push(...(data || []))
        if (!data || data.length < pageSize) break
    }

    return rows
}

async function fetchWhatsappInstances(supabase: SupabaseLike) {
    const selectWithoutLiveData = 'id, admin_user_id, broker_id, instance_name, instance_type, phone_number, instance_token, status, connected_at, created_at'

    try {
        return await fetchAllRows(
            supabase,
            'whatsapp_instances',
            `${selectWithoutLiveData}, live_data`,
        )
    } catch (error) {
        const message = String((error as any)?.message || '')
        const code = String((error as any)?.code || '')
        if (code !== '42703' && !message.includes('live_data')) {
            throw error
        }

        const rows = await fetchAllRows(supabase, 'whatsapp_instances', selectWithoutLiveData)
        return rows.map(row => ({ ...row, live_data: null }))
    }
}

async function resolveBrokerContactsByPropertyId(supabase: SupabaseLike, propertyIds: string[]) {
    if (propertyIds.length === 0) return new Map<string, ResponsibleBrokerContact>()

    const [{ data: privateRows, error }, virtualBrokers, adminUsers, instances] = await Promise.all([
        supabase
            .from('property_private_details')
            .select('property_id, broker_name, broker_login')
            .in('property_id', propertyIds),
        fetchAllRows(supabase, 'virtual_brokers', 'id, name, creci, phone, photo_url, is_active, whatsapp_instance_id'),
        fetchAllRows(supabase, 'admin_users', 'id, name, email, phone, is_active, whatsapp_instance_id'),
        fetchWhatsappInstances(supabase),
    ])

    if (error) throw error

    const contactByPropertyId = new Map<string, ResponsibleBrokerContact>()
    const globalInstance = globalInstanceFor(instances)
    const globalPhotoUrl = await resolveWhatsAppInstancePhotoUrl(globalInstance)

    for (const row of privateRows || []) {
        const legacyName = row?.broker_name || null
        const legacyLogin = row?.broker_login || null

        if (isGuilhermeBrokerReference(legacyName, legacyLogin)) {
            contactByPropertyId.set(row.property_id, globalContact(legacyName, legacyLogin, instances, globalPhotoUrl))
            continue
        }

        const candidates = candidateNames(legacyName, legacyLogin)

        const matchingVirtualBrokers = virtualBrokers.filter(broker => (
            namesMatch(normalizeName(broker?.name), candidates)
        ))
        const connectedVirtualBroker = connectedVirtualBrokerMatch(instances, matchingVirtualBrokers)
        const activeVirtualBroker = matchingVirtualBrokers.find(broker => broker?.is_active !== false) || null
        const virtualBroker = connectedVirtualBroker?.broker || activeVirtualBroker
        const virtualInstance = connectedVirtualBroker?.instance || (virtualBroker
            ? connectedInstanceFor(instances, virtualBroker, 'broker_id')
            : null)

        if (virtualBroker && virtualInstance) {
            contactByPropertyId.set(row.property_id, {
                broker_id: virtualBroker.id || null,
                admin_user_id: null,
                whatsapp_instance_id: virtualInstance.id || null,
                legacy_name: legacyName,
                legacy_login: legacyLogin,
                name: virtualBroker.name || legacyName || 'Corretor responsavel',
                phone: normalizePhone(virtualInstance.phone_number || virtualBroker.phone) || GLOBAL_PROPERTY_WHATSAPP_PHONE,
                photo_url: virtualBroker.photo_url || extractLivePhotoUrl(virtualInstance.live_data) || null,
                email: null,
                creci: virtualBroker.creci || null,
                is_connected: true,
                source: 'virtual_broker',
            })
            continue
        }

        const adminUser = adminUsers.find(user => (
            user?.is_active !== false &&
            namesMatch(normalizeName(user?.name), candidates)
        )) || null
        const adminInstance = adminUser
            ? connectedInstanceFor(instances, adminUser, 'admin_user_id')
            : null

        if (adminUser && adminInstance) {
            contactByPropertyId.set(row.property_id, {
                broker_id: null,
                admin_user_id: adminUser.id || null,
                whatsapp_instance_id: adminInstance.id || null,
                legacy_name: legacyName,
                legacy_login: legacyLogin,
                name: adminUser.name || legacyName || 'Corretor responsavel',
                phone: normalizePhone(adminInstance.phone_number || adminUser.phone) || GLOBAL_PROPERTY_WHATSAPP_PHONE,
                photo_url: extractLivePhotoUrl(adminInstance.live_data) || null,
                email: adminUser.email || null,
                creci: null,
                is_connected: true,
                source: 'admin_user',
            })
            continue
        }

        contactByPropertyId.set(row.property_id, globalContact(legacyName, legacyLogin, instances, globalPhotoUrl))
    }

    for (const propertyId of propertyIds) {
        if (!contactByPropertyId.has(propertyId)) {
            contactByPropertyId.set(propertyId, globalContact(null, null, instances, globalPhotoUrl))
        }
    }

    return contactByPropertyId
}

export async function enrichPropertiesWithResponsibleBrokers<T extends PropertyLike>(
    supabase: SupabaseLike,
    properties: T[],
): Promise<Array<T & { responsible_broker: ResponsibleBrokerContact }>> {
    const propertyIds = properties.map(property => String(property.id || '')).filter(Boolean)
    const contacts = await resolveBrokerContactsByPropertyId(supabase, propertyIds)

    return properties.map(property => ({
        ...property,
        responsible_broker: contacts.get(String(property.id || '')) || globalContact(),
    }))
}

export async function getResponsibleBrokerForProperty(
    supabase: SupabaseLike,
    propertyId: string,
) {
    const contacts = await resolveBrokerContactsByPropertyId(supabase, [propertyId])
    return contacts.get(propertyId) || globalContact()
}
