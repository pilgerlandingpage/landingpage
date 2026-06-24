import { recordEcosystemEvent } from '@/lib/intelligence/ecosystem'

export type WhatsAppGlobalIdentityType =
    | 'admin_user'
    | 'broker_user'
    | 'property_owner'
    | 'broker_authorized'
    | 'lead'
    | 'blocked'

export type WhatsAppGlobalIdentity = {
    type: WhatsAppGlobalIdentityType
    phone: string
    label: string
    identityId?: string | null
    permissions: string[]
    source: string
    adminUser?: any | null
    authorizedPhone?: any | null
    ownerProperties?: any[]
    confidence: number
}

export type WhatsAppGlobalCommandIntent = {
    commandType: string
    targetAgent: string
    requiredPermission?: string | null
    label: string
}

type SupabaseLike = {
    from: (table: string) => any
}

const TRAFFIC_WORDS = [
    'trafego',
    'tráfego',
    'campanha',
    'anuncio',
    'anúncio',
    'ads',
    'meta',
    'google ads',
    'criativo',
    'creative',
    'cpl',
]

const TRAFFIC_MONITOR_WORDS = [
    'status',
    'monitor',
    'monitorar',
    'relatorio',
    'resultado',
    'performance',
    'metricas',
    'saude',
    'resumo',
]

const BLOG_WORDS = ['blog', 'noticia', 'notícia', 'conteudo', 'conteúdo', 'post']
const PROPERTY_WORDS = ['imovel', 'imóvel', 'apartamento', 'casa', 'disponivel', 'disponível', 'link']
const REPORT_WORDS = ['relatorio', 'relatório', 'resultado', 'performance', 'metricas', 'métricas', 'resumo']

const IDENTITY_CHECK_RE = /\b(me reconhec|qual perfil|perfil.*numero|permiss|administrador|admin|master)\b/

function safeText(value: unknown, max = 500) {
    return String(value || '').trim().slice(0, max)
}

export function normalizeGlobalPhone(value: unknown): string {
    let digits = String(value || '').replace(/\D/g, '')
    if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
        digits = `55${digits}`
    }
    return digits
}

export function globalPhoneCandidates(value: unknown): string[] {
    const normalized = normalizeGlobalPhone(value)
    const raw = String(value || '').replace(/\D/g, '')
    const candidates = new Set<string>([normalized, raw].filter(Boolean))
    const localForms = new Set<string>()

    for (const candidate of Array.from(candidates)) {
        localForms.add(candidate)
        if (candidate.startsWith('55')) localForms.add(candidate.slice(2))
        if (candidate.startsWith('550')) {
            candidates.add(`55${candidate.slice(3)}`)
            localForms.add(candidate.slice(3))
        }
    }

    for (const local of Array.from(localForms)) {
        if (local.startsWith('0')) localForms.add(local.slice(1))
        if (local.startsWith('55')) localForms.add(local.slice(2))
    }

    for (const local of Array.from(localForms)) {
        if (!local) continue
        candidates.add(local)

        if (local.length === 11) {
            localForms.add(`${local.slice(0, 2)}${local.slice(3)}`)
        }
        if (local.length === 10) {
            localForms.add(`${local.slice(0, 2)}9${local.slice(2)}`)
        }

        if (local.length >= 10) {
            const ddd = local.slice(0, 2)
            const last8 = local.slice(-8)
            const last9 = local.slice(-9)
            localForms.add(`${ddd}${last8}`)
            localForms.add(`${ddd}${last9}`)
            localForms.add(`${ddd}9${last8}`)
        }

        if (local.length >= 12) {
            localForms.add(local.slice(1))
            localForms.add(`${local.slice(0, 2)}${local.slice(4)}`)
        }
    }

    for (const local of localForms) {
        if (!local) continue
        candidates.add(local)
        if ((local.length === 10 || local.length === 11) && !local.startsWith('55')) {
            candidates.add(`55${local}`)
        }
    }

    return Array.from(candidates).filter(Boolean)
}

function phoneLooksSame(a: unknown, b: unknown): boolean {
    const aCandidates = new Set(globalPhoneCandidates(a))
    return globalPhoneCandidates(b).some(candidate => aCandidates.has(candidate))
}

function includesAny(text: string, words: string[]) {
    return words.some(word => text.includes(word))
}

export function detectWhatsAppGlobalCommandIntent(text: unknown, hasMedia = false): WhatsAppGlobalCommandIntent {
    const normalized = String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

    if (
        (includesAny(normalized, TRAFFIC_WORDS) || normalized.includes('vitor')) &&
        includesAny(normalized, TRAFFIC_MONITOR_WORDS) &&
        !/(criativo|imagem|video|carrossel|subir|rodar|promover|impulsionar)/.test(normalized)
    ) {
        return {
            commandType: 'paid_traffic_monitoring',
            targetAgent: 'ads-analyst',
            requiredPermission: 'ads',
            label: 'Monitoramento de trafego pago',
        }
    }

    if (includesAny(normalized, TRAFFIC_WORDS) || (hasMedia && /(rodar|subir|promover|impulsionar)/.test(normalized))) {
        return {
            commandType: 'paid_traffic',
            targetAgent: 'ads-analyst',
            requiredPermission: 'ads',
            label: 'Trafego pago',
        }
    }

    if (includesAny(normalized, BLOG_WORDS)) {
        return {
            commandType: 'content_request',
            targetAgent: 'blog-intelligence',
            requiredPermission: normalized.includes('noticia') ? 'news' : 'blog',
            label: 'Conteudo editorial',
        }
    }

    if (includesAny(normalized, REPORT_WORDS)) {
        return {
            commandType: 'report_request',
            targetAgent: 'ceo-agent',
            requiredPermission: 'dashboard',
            label: 'Relatorio interno',
        }
    }

    if (includesAny(normalized, PROPERTY_WORDS)) {
        return {
            commandType: 'property_request',
            targetAgent: 'property-register',
            requiredPermission: 'properties',
            label: 'Consulta de imoveis',
        }
    }

    if (IDENTITY_CHECK_RE.test(normalized)) {
        return {
            commandType: 'identity_check',
            targetAgent: 'whatsapp-global-agent',
            requiredPermission: null,
            label: 'Reconhecimento de identidade',
        }
    }

    return {
        commandType: hasMedia ? 'media_received' : 'general',
        targetAgent: 'whatsapp-global-agent',
        requiredPermission: null,
        label: hasMedia ? 'Midia recebida' : 'Mensagem geral',
    }
}

export function isWhatsAppGlobalOperatorMessage(text: unknown, hasMedia = false): boolean {
    const intent = detectWhatsAppGlobalCommandIntent(text, hasMedia)
    if (!['general', 'media_received'].includes(intent.commandType)) return true

    const normalized = String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

    return IDENTITY_CHECK_RE.test(normalized) ||
        /\b(vitor|trafego|campanha|criativo|ads|meta|google|subir|rodar|promover|impulsionar|comando interno)\b/.test(normalized)
}

function hasPermission(identity: WhatsAppGlobalIdentity, permission?: string | null) {
    if (!permission) return true
    return identity.permissions.includes('master_all') || identity.permissions.includes(permission)
}

async function getAdminPermissions(supabase: SupabaseLike, adminUser: any): Promise<string[]> {
    if (!adminUser?.id) return []
    if (adminUser.is_master) return ['master_all']

    const { data: userSectors, error: sectorError } = await supabase
        .from('admin_user_sectors')
        .select('sector_id')
        .eq('user_id', adminUser.id)

    if (sectorError || !userSectors?.length) return []

    const sectorIds = userSectors.map((row: any) => row.sector_id).filter(Boolean)
    if (!sectorIds.length) return []

    const { data: sectorPerms, error: permError } = await supabase
        .from('admin_sector_permissions')
        .select('admin_permissions(module_key)')
        .in('sector_id', sectorIds)

    if (permError) return []

    return Array.from(new Set(
        (sectorPerms || [])
            .map((row: any) => row.admin_permissions?.module_key)
            .filter(Boolean)
            .map(String)
    ))
}

function classifyAdminIdentity(adminUser: any, permissions: string[]): WhatsAppGlobalIdentityType {
    if (adminUser?.is_master || permissions.includes('ads') || permissions.includes('settings_users')) return 'admin_user'
    return 'broker_user'
}

async function findOverride(supabase: SupabaseLike, phone: string) {
    try {
        const { data, error } = await supabase
            .from('whatsapp_global_identity_overrides')
            .select('*')
            .eq('is_active', true)
            .in('phone', globalPhoneCandidates(phone))
            .limit(1)

        if (error) return null
        if (data?.[0]) return data[0]

        const { data: fallbackData, error: fallbackError } = await supabase
            .from('whatsapp_global_identity_overrides')
            .select('*')
            .eq('is_active', true)
            .limit(500)

        if (fallbackError) return null
        return (fallbackData || []).find((row: any) => phoneLooksSame(row.phone, phone)) || null
    } catch {
        return null
    }
}

async function findAdminUser(supabase: SupabaseLike, phone: string) {
    const candidates = globalPhoneCandidates(phone)
    const { data, error } = await supabase
        .from('admin_users')
        .select('id, name, email, phone, is_master, is_active')
        .eq('is_active', true)
        .in('phone', candidates)
        .limit(1)

    if (error) return null
    if (data?.[0]) return data[0]

    const { data: fallbackData, error: fallbackError } = await supabase
        .from('admin_users')
        .select('id, name, email, phone, is_master, is_active')
        .eq('is_active', true)
        .not('phone', 'is', null)
        .limit(500)

    if (fallbackError) return null
    return (fallbackData || []).find((row: any) => phoneLooksSame(row.phone, phone)) || null
}

async function findBrokerAuthorization(supabase: SupabaseLike, phone: string) {
    try {
        const { data, error } = await supabase
            .from('broker_assistant_authorized_phones')
            .select('*, virtual_brokers(id, name, phone, is_active)')
            .eq('is_active', true)
            .in('phone', globalPhoneCandidates(phone))
            .limit(1)

        if (error) return null
        if (data?.[0]) return data[0]

        const { data: fallbackData, error: fallbackError } = await supabase
            .from('broker_assistant_authorized_phones')
            .select('*, virtual_brokers(id, name, phone, is_active)')
            .eq('is_active', true)
            .limit(500)

        if (fallbackError) return null
        return (fallbackData || []).find((row: any) => phoneLooksSame(row.phone, phone)) || null
    } catch {
        return null
    }
}

function ownerPropertyLabel(row: any) {
    return row?.title || row?.source_reference || row?.id || row?.property_id || 'Imovel'
}

async function findPropertyOwner(supabase: SupabaseLike, phone: string) {
    const candidates = globalPhoneCandidates(phone)
    const lastEight = normalizeGlobalPhone(phone).slice(-8)
    const found: any[] = []

    try {
        const { data } = await supabase
            .from('properties')
            .select('id, title, status, owner_name, owner_phone')
            .in('owner_phone', candidates)
            .limit(20)
        found.push(...(data || []))
    } catch {
        // ignore legacy column differences
    }

    if (lastEight && found.length === 0) {
        try {
            const { data } = await supabase
                .from('properties')
                .select('id, title, status, owner_name, owner_phone')
                .ilike('owner_phone', `%${lastEight}%`)
                .limit(30)
            found.push(...(data || []).filter((row: any) => phoneLooksSame(row.owner_phone, phone)))
        } catch {
            // ignore legacy column differences
        }
    }

    try {
        const privateQuery = supabase
            .from('property_private_details')
            .select('property_id, owner_name, owner_phones, properties(id, title, status)')
            .ilike('owner_phones', `%${lastEight || normalizeGlobalPhone(phone)}%`)
            .limit(30)
        const { data } = await privateQuery
        const privateMatches = (data || []).filter((row: any) => phoneLooksSame(row.owner_phones, phone))
        for (const row of privateMatches) {
            const property = Array.isArray(row.properties) ? row.properties[0] : row.properties
            found.push({
                id: row.property_id,
                title: property?.title || row.property_id,
                status: property?.status || null,
                owner_name: row.owner_name,
                owner_phone: row.owner_phones,
                source: 'property_private_details',
            })
        }
    } catch {
        // private details may not exist in every environment
    }

    const byId = new Map<string, any>()
    for (const row of found) {
        const id = String(row.id || row.property_id || '')
        if (!id || byId.has(id)) continue
        byId.set(id, row)
    }

    return Array.from(byId.values())
}

export async function resolveWhatsAppGlobalIdentity(params: {
    supabase: SupabaseLike
    phone: string
    senderName?: string | null
}): Promise<WhatsAppGlobalIdentity> {
    const { supabase, phone, senderName } = params
    const normalizedPhone = normalizeGlobalPhone(phone)
    const fallbackLabel = safeText(senderName) || normalizedPhone || 'Contato WhatsApp'

    const override = await findOverride(supabase, normalizedPhone)
    if (override?.identity_type) {
        return {
            type: override.identity_type,
            phone: normalizedPhone,
            label: override.display_name || fallbackLabel,
            identityId: override.identity_id || null,
            permissions: Array.isArray(override.permission_keys) ? override.permission_keys.map(String) : [],
            source: 'whatsapp_global_identity_overrides',
            confidence: 100,
        }
    }

    const adminUser = await findAdminUser(supabase, normalizedPhone)
    if (adminUser?.id) {
        const permissions = await getAdminPermissions(supabase, adminUser)
        const type = classifyAdminIdentity(adminUser, permissions)
        return {
            type,
            phone: normalizedPhone,
            label: adminUser.name || adminUser.email || fallbackLabel,
            identityId: adminUser.id,
            permissions,
            source: 'admin_users',
            adminUser,
            confidence: 98,
        }
    }

    const authorization = await findBrokerAuthorization(supabase, normalizedPhone)
    if (authorization?.id) {
        const permissions = [
            authorization.can_manage_agenda !== false ? 'agenda' : '',
            authorization.can_view_properties !== false ? 'properties' : '',
            authorization.can_manage_leads ? 'leads' : '',
            authorization.can_update_crm ? 'crm' : '',
            authorization.can_send_messages ? 'send_messages' : '',
            authorization.can_view_reports ? 'dashboard' : '',
            authorization.can_manage_finance ? 'finance' : '',
        ].filter(Boolean)

        return {
            type: 'broker_authorized',
            phone: normalizedPhone,
            label: authorization.name || authorization.virtual_brokers?.name || fallbackLabel,
            identityId: authorization.id,
            permissions,
            source: 'broker_assistant_authorized_phones',
            authorizedPhone: authorization,
            confidence: 92,
        }
    }

    const ownerProperties = await findPropertyOwner(supabase, normalizedPhone)
    if (ownerProperties.length > 0) {
        const ownerName = ownerProperties.find(row => row.owner_name)?.owner_name
        return {
            type: 'property_owner',
            phone: normalizedPhone,
            label: ownerName || fallbackLabel,
            identityId: ownerProperties.map(row => row.id || row.property_id).filter(Boolean).join(','),
            permissions: ['owner_properties'],
            source: 'property_owner_phone',
            ownerProperties: ownerProperties.slice(0, 20),
            confidence: 88,
        }
    }

    return {
        type: 'lead',
        phone: normalizedPhone,
        label: fallbackLabel,
        identityId: null,
        permissions: [],
        source: 'fallback_lead',
        confidence: 50,
    }
}

export function isWhatsAppGlobalInstance(instance: any): boolean {
    if (!instance) return false
    if (instance.instance_type === 'global') return true
    const name = String(instance.instance_name || '').toLowerCase()
    return name === 'agente global' || name === 'whatsapp global'
}

export async function getOrCreateWhatsAppGlobalSession(params: {
    supabase: SupabaseLike
    phone: string
    identity: WhatsAppGlobalIdentity
    message?: Record<string, any>
}) {
    const { supabase, phone, identity, message } = params
    const normalizedPhone = normalizeGlobalPhone(phone)

    try {
        const { data: existing } = await supabase
            .from('whatsapp_global_sessions')
            .select('*')
            .eq('phone', normalizedPhone)
            .maybeSingle()

        const nextMessage = message ? [message] : []
        if (existing?.id) {
            const currentMessages = Array.isArray(existing.messages) ? existing.messages : []
            const { data } = await supabase
                .from('whatsapp_global_sessions')
                .update({
                    identity_type: identity.type,
                    identity_id: identity.identityId || null,
                    identity_label: identity.label,
                    permission_keys: identity.permissions,
                    messages: [...currentMessages, ...nextMessage].slice(-80),
                    last_message_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id)
                .select('*')
                .single()
            return data || existing
        }

        const { data } = await supabase
            .from('whatsapp_global_sessions')
            .insert({
                phone: normalizedPhone,
                identity_type: identity.type,
                identity_id: identity.identityId || null,
                identity_label: identity.label,
                permission_keys: identity.permissions,
                messages: nextMessage,
            })
            .select('*')
            .single()

        return data || null
    } catch {
        return null
    }
}

export async function recordWhatsAppGlobalCommand(params: {
    supabase: SupabaseLike
    instance?: any
    phone: string
    identity: WhatsAppGlobalIdentity
    text?: string | null
    hasMedia?: boolean
    payload?: Record<string, any>
}) {
    const { supabase, instance, phone, identity, text, hasMedia, payload } = params
    const intent = detectWhatsAppGlobalCommandIntent(text || '', Boolean(hasMedia))
    const allowed = hasPermission(identity, intent.requiredPermission)
    const normalizedPhone = normalizeGlobalPhone(phone)
    const message = {
        role: 'user',
        content: safeText(text, 1600),
        has_media: Boolean(hasMedia),
        timestamp: new Date().toISOString(),
    }
    const session = await getOrCreateWhatsAppGlobalSession({
        supabase,
        phone: normalizedPhone,
        identity,
        message,
    })

    let command: any = null
    try {
        const { data } = await supabase
            .from('whatsapp_global_commands')
            .insert({
                session_id: session?.id || null,
                instance_id: instance?.id || null,
                phone: normalizedPhone,
                identity_type: identity.type,
                identity_id: identity.identityId || null,
                identity_label: identity.label,
                command_type: intent.commandType,
                target_agent: intent.targetAgent,
                required_permission: intent.requiredPermission || null,
                status: allowed ? 'received' : 'blocked',
                command_text: safeText(text, 2400) || null,
                payload: {
                    ...(payload || {}),
                    has_media: Boolean(hasMedia),
                    identity_source: identity.source,
                    permissions: identity.permissions,
                },
            })
            .select('*')
            .single()
        command = data || null
    } catch {
        command = null
    }

    try {
        await recordEcosystemEvent({
            supabase,
            eventType: allowed ? 'whatsapp_global_command_received' : 'whatsapp_global_command_blocked',
            actorType: identity.type === 'lead' ? 'lead' : 'human',
            entityType: 'whatsapp_global_command',
            entityId: command?.id || normalizedPhone,
            source: 'whatsapp-global',
            label: `${identity.label} enviou ${intent.label} ao WhatsApp Global`,
            importanceScore: allowed ? 72 : 86,
            metadata: {
                instance_id: instance?.id || null,
                instance_name: instance?.instance_name || null,
                phone: normalizedPhone,
                identity_type: identity.type,
                identity_source: identity.source,
                command_type: intent.commandType,
                target_agent: intent.targetAgent,
                required_permission: intent.requiredPermission || null,
                allowed,
                text_preview: safeText(text, 360) || null,
            },
        })
    } catch {
        // Central intelligence should never break the WhatsApp webhook.
    }

    return { command, intent, allowed, session }
}

export function buildWhatsAppGlobalAcknowledgement(params: {
    identity: WhatsAppGlobalIdentity
    intent: WhatsAppGlobalCommandIntent
    allowed: boolean
}) {
    const { identity, intent, allowed } = params
    if (!allowed) {
        return [
            `${identity.label}, identifiquei seu usuario no WhatsApp Global, mas este numero nao tem permissao para ${intent.label.toLowerCase()}.`,
            'Se precisar desse acesso, solicite a liberacao a um administrador master no painel.',
        ].join('\n')
    }

    if (identity.type === 'property_owner') {
        const properties = identity.ownerProperties || []
        const firstProperty = properties[0]
        const propertyText = firstProperty
            ? `Identifiquei voce como proprietario de ${ownerPropertyLabel(firstProperty)}.`
            : 'Identifiquei voce como proprietario cadastrado.'
        return [
            propertyText,
            'Vou tratar esta conversa como atendimento de proprietario, separado dos leads comerciais.',
        ].join('\n')
    }

    if (intent.commandType === 'identity_check') {
        const profile = identity.type === 'admin_user'
            ? 'administrador do sistema'
            : identity.type === 'broker_user' || identity.type === 'broker_authorized'
                ? 'corretor/usuario autorizado'
                : identity.type
        const permissionText = identity.permissions.includes('master_all')
            ? 'Permissao identificada: master_all.'
            : identity.permissions.length
                ? `Permissoes identificadas: ${identity.permissions.slice(0, 12).join(', ')}.`
                : 'Nao encontrei permissoes operacionais para este numero.'

        return [
            `${identity.label}, reconheci este numero como ${profile}.`,
            permissionText,
        ].join('\n')
    }

    if (intent.targetAgent === 'ads-analyst') {
        return [
            `${identity.label}, recebi seu pedido para o Vitor Trafego Pago.`,
            'Nesta fase eu ja registrei o comando e vou usar essa entrada para a fila do gestor de trafego IA.',
        ].join('\n')
    }

    return [
        `${identity.label}, recebi sua solicitacao no WhatsApp Global.`,
        `Classifiquei como ${intent.label.toLowerCase()} e registrei para o setor ${intent.targetAgent}.`,
    ].join('\n')
}
