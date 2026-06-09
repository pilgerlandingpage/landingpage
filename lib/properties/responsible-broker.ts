export const GLOBAL_PROPERTY_WHATSAPP_PHONE = '5547992528080'

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

function globalContact(legacyName?: string | null, legacyLogin?: string | null): ResponsibleBrokerContact {
    return {
        broker_id: null,
        admin_user_id: null,
        whatsapp_instance_id: null,
        legacy_name: legacyName || null,
        legacy_login: legacyLogin || null,
        name: legacyName || 'Comercial Guilherme Pilger',
        phone: GLOBAL_PROPERTY_WHATSAPP_PHONE,
        photo_url: null,
        email: null,
        creci: null,
        is_connected: false,
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

async function resolveBrokerContactsByPropertyId(supabase: SupabaseLike, propertyIds: string[]) {
    if (propertyIds.length === 0) return new Map<string, ResponsibleBrokerContact>()

    const [{ data: privateRows, error }, virtualBrokers, adminUsers, instances] = await Promise.all([
        supabase
            .from('property_private_details')
            .select('property_id, broker_name, broker_login')
            .in('property_id', propertyIds),
        fetchAllRows(supabase, 'virtual_brokers', 'id, name, creci, phone, photo_url, is_active, whatsapp_instance_id'),
        fetchAllRows(supabase, 'admin_users', 'id, name, email, phone, is_active, whatsapp_instance_id'),
        fetchAllRows(supabase, 'whatsapp_instances', 'id, admin_user_id, broker_id, phone_number, status, connected_at'),
    ])

    if (error) throw error

    const contactByPropertyId = new Map<string, ResponsibleBrokerContact>()

    for (const row of privateRows || []) {
        const legacyName = row?.broker_name || null
        const legacyLogin = row?.broker_login || null
        const candidates = candidateNames(legacyName, legacyLogin)

        const virtualBroker = virtualBrokers.find(broker => (
            broker?.is_active !== false &&
            namesMatch(normalizeName(broker?.name), candidates)
        )) || null
        const virtualInstance = virtualBroker
            ? connectedInstanceFor(instances, virtualBroker, 'broker_id')
            : null

        if (virtualBroker && virtualInstance) {
            contactByPropertyId.set(row.property_id, {
                broker_id: virtualBroker.id || null,
                admin_user_id: null,
                whatsapp_instance_id: virtualInstance.id || null,
                legacy_name: legacyName,
                legacy_login: legacyLogin,
                name: virtualBroker.name || legacyName || 'Corretor responsavel',
                phone: normalizePhone(virtualInstance.phone_number || virtualBroker.phone) || GLOBAL_PROPERTY_WHATSAPP_PHONE,
                photo_url: virtualBroker.photo_url || null,
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
                photo_url: null,
                email: adminUser.email || null,
                creci: null,
                is_connected: true,
                source: 'admin_user',
            })
            continue
        }

        contactByPropertyId.set(row.property_id, globalContact(legacyName, legacyLogin))
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
