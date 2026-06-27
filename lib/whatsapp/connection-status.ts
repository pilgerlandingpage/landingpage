export type WhatsAppConnectionStatus = 'connected' | 'connecting' | 'disconnected'

export const REQUIRED_WHATSAPP_WEBHOOK_EVENTS = [
    'history',
    'messages',
    'messages_update',
    'connection',
    'chats',
    'contacts',
    'labels',
    'chat_labels',
]

export const REQUIRED_WHATSAPP_WEBHOOK_EXCLUDES = ['wasSentByApi', 'isGroupYes']

function cleanText(value: unknown): string {
    return String(value || '').trim().toLowerCase()
}

function normalizeStatusToken(value: unknown): string {
    return cleanText(value)
        .replace(/[\s-]+/g, '_')
        .replace(/^wa_/, '')
}

function hasQrPayload(payload: any): boolean {
    return Boolean(
        payload?.instance?.qrcode ||
        payload?.instance?.qr ||
        payload?.qrcode ||
        payload?.qr
    )
}

function collectStatusTokens(payload: any): string[] {
    const tokens = [
        payload?.instance?.status,
        payload?.instance?.state,
        payload?.instance?.connectionStatus,
        payload?.instance?.connection,
        payload?.status?.status,
        typeof payload?.status === 'string' ? payload.status : '',
        payload?.state,
        payload?.connectionStatus,
        payload?.connection,
        payload?.status?.connection,
        payload?.event?.status,
        payload?.event?.state,
    ]

    const type = normalizeStatusToken(payload?.type)
    if (type && type !== 'connection') tokens.push(type)

    return tokens
        .map(normalizeStatusToken)
        .filter(Boolean)
}

export function normalizeWhatsAppConnectionStatus(payload: any): WhatsAppConnectionStatus | null {
    const tokens = collectStatusTokens(payload)
    const connectedText = tokens.some((token) =>
        ['connected', 'open', 'online', 'loggedin', 'logged_in', 'ready'].includes(token)
    )
    const connectingText = tokens.some((token) =>
        ['connecting', 'pairing', 'qr', 'qrcode', 'loading', 'initializing'].includes(token)
    )
    const disconnectedText = tokens.some((token) =>
        ['disconnected', 'loggedout', 'logged_out', 'logout', 'offline', 'close', 'closed'].includes(token)
    )

    const connectedTrue =
        payload?.status?.connected === true ||
        payload?.connected === true ||
        payload?.instance?.connected === true
    const connectedFalse =
        payload?.status?.connected === false ||
        payload?.connected === false ||
        payload?.instance?.connected === false
    const loggedInTrue =
        payload?.status?.loggedIn === true ||
        payload?.loggedIn === true ||
        payload?.instance?.loggedIn === true
    const loggedInFalse =
        payload?.status?.loggedIn === false ||
        payload?.loggedIn === false ||
        payload?.instance?.loggedIn === false

    if ((connectedText || connectedTrue || loggedInTrue) && !connectedFalse && !loggedInFalse && !disconnectedText) {
        return 'connected'
    }

    if ((connectingText || hasQrPayload(payload)) && !connectedFalse && !loggedInFalse && !disconnectedText) {
        return 'connecting'
    }

    if (disconnectedText || connectedFalse || loggedInFalse) {
        return 'disconnected'
    }

    return null
}

export function normalizeWhatsAppAddress(raw: unknown): string {
    if (raw && typeof raw === 'object') {
        const value = raw as Record<string, unknown>
        return normalizeWhatsAppAddress(
            value.user ||
            value.id ||
            value.phone ||
            value.number ||
            value.jid ||
            value.owner ||
            value.ownerJid ||
            ''
        )
    }

    const text = String(raw || '').trim()
    if (!text) return ''
    const beforeAt = text.split('@')[0] || ''
    const beforeDevice = beforeAt.split(':')[0] || ''
    return beforeDevice.replace(/\D/g, '')
}

export function extractPhoneFromWhatsAppStatus(payload: any, fallback?: string | null): string | null {
    const candidates = [
        payload?.status?.jid?.user,
        payload?.status?.jid?.id,
        payload?.status?.jid,
        payload?.instance?.jid?.user,
        payload?.instance?.jid?.id,
        payload?.instance?.jid,
        payload?.jid?.user,
        payload?.jid?.id,
        payload?.jid,
        payload?.me?.id,
        payload?.me?.user,
        payload?.instance?.me?.id,
        payload?.instance?.me?.user,
        payload?.instance?.owner,
        payload?.instance?.ownerJid,
        payload?.instance?.phone,
        payload?.owner,
        payload?.phone,
        payload?.number,
        fallback,
    ]

    for (const candidate of candidates) {
        const digits = normalizeWhatsAppAddress(candidate)
        if (digits) return digits
    }

    return null
}

export function normalizeProviderInstances(raw: any): any[] {
    if (Array.isArray(raw)) return raw
    if (Array.isArray(raw?.instances)) return raw.instances
    if (Array.isArray(raw?.data)) return raw.data
    return []
}

export function extractProviderInstanceName(instance: any): string {
    return String(
        instance?.displayName ||
        instance?.display_name ||
        instance?.name ||
        instance?.instanceName ||
        instance?.instance_name ||
        instance?.instance?.name ||
        ''
    ).trim()
}

export function extractProviderInstanceToken(instance: any): string {
    return String(
        instance?.id ||
        instance?.instanceId ||
        instance?.connectyhubInstanceId ||
        instance?.publicInstanceId ||
        instance?.token ||
        instance?.instanceToken ||
        instance?.instance_token ||
        instance?.instance?.token ||
        ''
    ).trim()
}

export function normalizeWebhookStringList(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value.map((item) => String(item || '').trim()).filter(Boolean)
}

export function extractWebhookUrl(webhook: any): string {
    return String(
        webhook?.url ||
        webhook?.webhook ||
        webhook?.webhookUrl ||
        webhook?.webhook_url ||
        webhook?.data?.url ||
        webhook?.data?.webhook ||
        ''
    ).trim()
}

export function webhookNeedsUpdate(currentWebhook: any, webhookUrl: string): boolean {
    const currentUrl = extractWebhookUrl(currentWebhook)
    const events = normalizeWebhookStringList(currentWebhook?.events || currentWebhook?.data?.events)
    const excludes = normalizeWebhookStringList(currentWebhook?.excludeMessages || currentWebhook?.data?.excludeMessages)

    return currentUrl !== webhookUrl ||
        REQUIRED_WHATSAPP_WEBHOOK_EVENTS.some((event) => !events.includes(event)) ||
        REQUIRED_WHATSAPP_WEBHOOK_EXCLUDES.some((exclude) => !excludes.includes(exclude))
}
