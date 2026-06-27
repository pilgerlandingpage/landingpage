// ═══════════════════════════════════════════════════════════════
// ConnectyHub WhatsApp API compatibility layer.
// Mantem a API interna legada, mas envia tudo pela ConnectyHub.
// ═══════════════════════════════════════════════════════════════

import { getConnectyHubConfig, resolveConnectyHubWebhookUrl, saveConnectyHubWebhookSecretIfMissing } from '@/lib/connectyhub/config'

interface UazapiConfig {
    baseUrl: string
    adminToken: string
    webhookSecret?: string
    webhookUrl?: string
}

interface SendTextOptions {
    phone: string
    message: string
    instanceToken?: string
    delay?: number
    readchat?: boolean
    readmessages?: boolean
}

interface SendMenuOptions {
    phone: string
    text: string
    type: 'button' | 'list' | 'poll' | 'carousel'
    choices: string[]
    footerText?: string
    listButton?: string         // texto do botão que abre a lista
    selectableCount?: number    // para polls: quantas opções selecionáveis
    imageButton?: string        // URL de imagem para botões
    delay?: number
    readchat?: boolean
    readmessages?: boolean
    instanceToken?: string
}

// Legacy interface for backward compatibility with existing agent code
interface SendMenuOptionsLegacy {
    phone: string
    title: string
    description: string
    footer?: string
    buttons?: { id: string; title: string }[]
    sections?: { title: string; rows: { id: string; title: string; description?: string }[] }[]
    instanceToken?: string
}

interface SendImageOptions {
    phone: string
    imageUrl: string
    caption?: string
    instanceToken?: string
}

interface SendAudioOptions {
    phone: string
    audioUrl: string
    ptt?: boolean // voice note (gravado na hora)
    instanceToken?: string
}

interface SendVideoOptions {
    phone: string
    videoUrl: string
    caption?: string
    thumbnail?: string
    instanceToken?: string
}

interface SendDocumentOptions {
    phone: string
    documentUrl: string
    fileName?: string
    caption?: string
    instanceToken?: string
}

interface SendLocationOptions {
    phone: string
    latitude: number
    longitude: number
    name?: string
    address?: string
    instanceToken?: string
}

interface SendContactOptions {
    phone: string
    contactName: string
    contactPhone: string
    instanceToken?: string
}

interface SendPollOptions {
    phone: string
    title: string
    options: string[]
    multiSelect?: boolean
    instanceToken?: string
}

// ── Config ──────────────────────────────────────────────────────

export async function getUazapiConfig(): Promise<UazapiConfig> {
    const config = await getConnectyHubConfig()

    return {
        baseUrl: config.apiUrl,
        adminToken: config.apiToken,
        webhookSecret: config.webhookSecret,
        webhookUrl: config.webhookUrl,
    }
}

// ── Helper: Fetch com auth ──────────────────────────────────────

function compactResponseText(value: string, limit = 500) {
    return value.replace(/\s+/g, ' ').trim().slice(0, limit)
}

function getUazapiErrorMessage(payload: unknown) {
    if (!payload) return 'resposta vazia'
    if (typeof payload === 'string') return compactResponseText(payload)
    if (typeof payload !== 'object') return String(payload)

    const data = payload as Record<string, any>
    const candidates = [
        data.error,
        data.message,
        data.details,
        data.detail,
        data.data?.error,
        data.data?.message,
    ]
    const text = candidates.find((item) => typeof item === 'string' && item.trim())
    if (text) return compactResponseText(text)

    try {
        return compactResponseText(JSON.stringify(data))
    } catch {
        return 'erro sem detalhes'
    }
}

async function readUazapiPayload(response: Response, path: string) {
    const raw = await response.text()
    const trimmed = raw.trim()
    if (!trimmed) return null

    const contentType = response.headers.get('content-type') || ''
    const looksLikeJson = contentType.includes('application/json') || /^[\[{]/.test(trimmed)

    if (!looksLikeJson) {
        const preview = compactResponseText(trimmed)
        if (response.ok) {
            throw new Error(`connectyhub invalid response (${response.status}) em ${path}: ${preview}`)
        }
        return preview
    }

    try {
        return JSON.parse(trimmed)
    } catch {
        const preview = compactResponseText(trimmed)
        throw new Error(`connectyhub invalid json (${response.status}) em ${path}: ${preview}`)
    }
}

function requireConnectyHubConfig(config: UazapiConfig) {
    if (!config.baseUrl || !config.adminToken) {
        throw new Error('ConnectyHub API nao configurada. Preencha CONNECTYHUB_API_URL e CONNECTYHUB_API_TOKEN na sala de manutencao.')
    }
}

function encodePathPart(value: string) {
    return encodeURIComponent(value).replace(/%2F/gi, '/')
}

async function resolveConnectyHubInstanceId(instanceToken?: string) {
    const candidate = String(instanceToken || '').trim()
    if (!candidate) return ''

    try {
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        const { data } = await supabase
            .from('whatsapp_instances')
            .select('config')
            .eq('instance_token', candidate)
            .maybeSingle()

        const configuredId = data?.config && typeof data.config === 'object'
            ? String((data.config as any).connectyhub_instance_id || '').trim()
            : ''
        if (configuredId) return configuredId
    } catch {
        // Mantem compatibilidade: se nao conseguir resolver no banco, usa o valor recebido.
    }

    return candidate
}

async function connectyHubFetch(
    path: string,
    options: {
        method?: string
        body?: unknown
        query?: URLSearchParams
    } = {}
) {
    const config = await getUazapiConfig()
    requireConnectyHubConfig(config)

    const url = new URL(`${config.baseUrl}${path}`)
    options.query?.forEach((value, key) => {
        url.searchParams.set(key, value)
    })

    const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.adminToken}`,
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        cache: 'no-store',
    })

    const payload = await readUazapiPayload(response, path)

    if (!response.ok) {
        throw new Error(`connectyhub error (${response.status}) em ${path}: ${getUazapiErrorMessage(payload)}`)
    }

    return payload ?? {}
}

async function connectyHubProviderProxy(
    path: string,
    options: {
        method?: string
        body?: unknown
        token?: string
    }
) {
    const instanceId = await resolveConnectyHubInstanceId(options.token)
    if (!instanceId) {
        throw new Error(`ConnectyHub instanceId obrigatorio para ${path}`)
    }

    const method = options.method || 'GET'
    const proxyPath = `/provider${path}`

    if (method === 'GET') {
        const query = new URLSearchParams({ instanceId })
        return connectyHubFetch(proxyPath, { method, query })
    }

    return connectyHubFetch(proxyPath, {
        method,
        body: {
            instanceId,
            payload: options.body ?? {},
        },
    })
}

async function uazapiFetch(
    path: string,
    options: {
        method?: string
        body?: unknown
        token?: string       // token da instância
        adminToken?: string  // admin token (para operações admin)
    } = {}
) {
    if (path === '/instance/all') {
        return connectyHubFetch('/instances', { method: 'GET' })
    }

    if (path === '/instance/connect') {
        const instanceId = await resolveConnectyHubInstanceId(options.token)
        return connectyHubFetch(`/instances/${encodePathPart(instanceId)}/connect`, { method: 'POST' })
    }

    if (path === '/instance/status') {
        const instanceId = await resolveConnectyHubInstanceId(options.token)
        return connectyHubFetch(`/instances/${encodePathPart(instanceId)}/status`, { method: 'GET' })
    }

    return connectyHubProviderProxy(path, options)
}

// ═══════════════════════════════════════════════════════════════
// INSTÂNCIAS
// ═══════════════════════════════════════════════════════════════

/** Criar nova instância (requer admin token) */
export interface UazapiWhatsAppRestrictionInfo {
    errorKey: string | null
    providerCode: number | null
    messagePtBr: string | null
    providerMessagePtBr: string | null
    diagnosticsEndpoint: string | null
    until: string | null
}

function parseUazapiErrorPayload(error: unknown): any | null {
    if (error && typeof error === 'object' && ('error_key' in error || 'details' in error)) {
        return error
    }

    const message = error instanceof Error ? error.message : String(error || '')
    const start = message.indexOf('{')
    const end = message.lastIndexOf('}')
    if (start < 0 || end <= start) return null

    try {
        return JSON.parse(message.slice(start, end + 1))
    } catch {
        return null
    }
}

export function extractUazapiWhatsAppRestriction(error: unknown): UazapiWhatsAppRestrictionInfo | null {
    const payload = parseUazapiErrorPayload(error)
    if (!payload || typeof payload !== 'object') return null

    const details = payload.details && typeof payload.details === 'object' ? payload.details : {}
    const reachoutTimelock = details.reachout_timelock || payload.reachout_timelock || null
    const errorKey = String(payload.error_key || '').trim() || null
    const providerCode = Number(payload.provider_code || 0) || null
    const isRestricted =
        errorKey === 'WHATSAPP_REACHOUT_TIMELOCK' ||
        providerCode === 463 ||
        payload.can_send_new_messages === false ||
        Boolean(reachoutTimelock?.active)

    if (!isRestricted) return null

    return {
        errorKey,
        providerCode,
        messagePtBr: String(payload.message_ptbr || '').trim() || null,
        providerMessagePtBr: String(payload.provider_message_ptbr || '').trim() || null,
        diagnosticsEndpoint: String(payload.diagnostics_endpoint || '').trim() || null,
        until: String(reachoutTimelock?.until || '').trim() || null,
    }
}

export function formatUazapiWhatsAppRestrictionMessage(info: UazapiWhatsAppRestrictionInfo): string {
    const base = info.providerMessagePtBr || info.messagePtBr ||
        'O WhatsApp recusou o envio pela conta conectada.'
    const until = info.until ? formatRestrictionUntil(info.until) : ''
    return until
        ? `${base} Liberacao indicada: ${until} (horario de Brasilia).`
        : base
}

function formatRestrictionUntil(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''

    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(date)
}

/** Criar nova instancia (requer admin token) */
export async function createInstance(instanceName: string) {
    const config = await getUazapiConfig()
    const webhookUrl = config.webhookUrl || await resolveConnectyHubWebhookUrl()
    const result = await connectyHubFetch('/instances', {
        method: 'POST',
        body: {
            name: instanceName,
            webhookUrl: webhookUrl || undefined,
            metadata: { created_from: 'pilger_legacy_whatsapp_admin' },
        },
    })
    const publicId = String((result as any)?.instance?.id || (result as any)?.id || '').trim()
    return {
        ...(result as any),
        token: publicId,
        instance: {
            ...((result as any)?.instance || {}),
            token: publicId,
        },
    }
}

/** Conectar instância — retorna QR Code base64 */
export async function connectInstance(instanceToken: string) {
    return uazapiFetch('/instance/connect', {
        method: 'POST',
        token: instanceToken,
    })
}

/** Status da instância (disconnected, connecting, connected) */
export async function getInstanceStatus(instanceToken: string) {
    return uazapiFetch('/instance/status', {
        token: instanceToken,
    })
}

/** Listar todas as instâncias (requer admin token) */
export async function listAllInstances() {
    const config = await getUazapiConfig()
    return uazapiFetch('/instance/all', {
        adminToken: config.adminToken,
    })
}

/** Desconectar instância */
export async function disconnectInstance(instanceToken: string) {
    return uazapiFetch('/instance/disconnect', {
        method: 'POST',
        token: instanceToken,
    })
}

/** Deletar instância (requer admin token) */
export async function deleteInstance(instanceToken: string, instanceName?: string) {
    try {
        return await uazapiFetch('/instance', {
            method: 'DELETE',
            token: instanceToken,
        })
    } catch (primaryError) {
        if (instanceName) {
            const config = await getUazapiConfig()
            return uazapiFetch('/instance/delete', {
                method: 'DELETE',
                adminToken: config.adminToken,
                body: { name: instanceName },
            })
        }
        throw primaryError
    }
}

// ═══════════════════════════════════════════════════════════════
//  ENVIO DE MENSAGENS
// ═══════════════════════════════════════════════════════════════

function cleanPhone(phone: string): string {
    let clean = phone.replace(/\D/g, '')
    // Auto-prepend Brazil country code '55' if missing
    if (clean.length === 10 || clean.length === 11) {
        clean = `55${clean}`
    }
    return clean
}

function normalizeProviderStatus(instance: any): string {
    return String(
        instance?.status?.status ||
        (typeof instance?.status === 'string' ? instance.status : '') ||
        instance?.state ||
        instance?.connectionStatus ||
        instance?.instance?.status ||
        ''
    ).toLowerCase()
}

function providerInstanceToken(instance: any): string {
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

function providerInstanceName(instance: any): string {
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

function normalizeProviderInstances(raw: any): any[] {
    if (Array.isArray(raw)) return raw
    if (Array.isArray(raw?.instances)) return raw.instances
    if (Array.isArray(raw?.data)) return raw.data
    return []
}

export async function resolveDefaultWhatsAppInstanceToken(): Promise<string | null> {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: config } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'agent_default_instance_id')
        .maybeSingle()

    const configuredInstanceId = String(config?.value || '').trim()
    if (configuredInstanceId) {
        const { data } = await supabase
            .from('whatsapp_instances')
            .select('instance_token, status, config')
            .eq('id', configuredInstanceId)
            .maybeSingle()

        if (data?.status === 'connected' && data.instance_token) {
            const connectyHubInstanceId = data.config && typeof data.config === 'object'
                ? String((data.config as any).connectyhub_instance_id || '').trim()
                : ''
            return connectyHubInstanceId || data.instance_token
        }
    }

    try {
        const providerInstances = normalizeProviderInstances(await listAllInstances())
        const connected = providerInstances
            .filter(instance => normalizeProviderStatus(instance) === 'connected')
            .filter(instance => providerInstanceToken(instance))

        const preferred =
            connected.find(instance => providerInstanceName(instance).toLowerCase().includes('agente global')) ||
            (connected.length === 1 ? connected[0] : null)

        return preferred ? providerInstanceToken(preferred) : null
    } catch {
        return null
    }
}

/** Enviar mensagem de texto */
export async function sendWhatsAppMessage({ phone, message, instanceToken, delay }: SendTextOptions) {
    if (!instanceToken) {
        instanceToken = await resolveDefaultWhatsAppInstanceToken() || undefined
    }

    if (!instanceToken) {
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        const { data: config } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', 'agent_default_instance_id')
            .maybeSingle()
        const configuredInstanceId = String(config?.value || '').trim()
        let data: { instance_token?: string | null; config?: any; status?: string | null } | null = null
        if (configuredInstanceId) {
            const result = await supabase
                .from('whatsapp_instances')
                .select('instance_token, status, config')
                .eq('id', configuredInstanceId)
                .maybeSingle()
            if (result.data?.status === 'connected') data = result.data
        }
        if (data && data.instance_token) {
            const connectyHubInstanceId = data.config && typeof data.config === 'object'
                ? String((data.config as any).connectyhub_instance_id || '').trim()
                : ''
            instanceToken = connectyHubInstanceId || data.instance_token
        } else {
            throw new Error('Token da instância é obrigatório e a instância global do agente não está conectada')
        }
    }

    return uazapiFetch('/send/text', {
        method: 'POST',
        token: instanceToken,
        body: {
            number: cleanPhone(phone),
            text: message,
            ...(delay ? { delay } : {}),
            readchat: true,
            readmessages: true,
        },
    })
}

/** Enviar menu interativo (botões, listas, enquetes, carrossel) — formato UAZAPI real */
export async function sendMenuMessage(options: SendMenuOptions | SendMenuOptionsLegacy): Promise<any> {
    // Detect if using legacy format and convert
    if ('title' in options && 'description' in options && !('type' in options)) {
        return sendMenuLegacy(options as SendMenuOptionsLegacy)
    }

    const opts = options as SendMenuOptions
    if (!opts.instanceToken) {
        opts.instanceToken = await resolveDefaultWhatsAppInstanceToken() || undefined
    }
    if (!opts.instanceToken) {
        throw new Error('Token da instância é obrigatório')
    }

    const body: Record<string, unknown> = {
        number: cleanPhone(opts.phone),
        type: opts.type,
        text: opts.text,
        choices: opts.choices,
    }

    if (opts.footerText) body.footerText = opts.footerText
    if (opts.listButton) body.listButton = opts.listButton
    if (opts.selectableCount !== undefined) body.selectableCount = opts.selectableCount
    if (opts.imageButton) body.imageButton = opts.imageButton
    if (opts.delay) body.delay = opts.delay
    body.readchat = opts.readchat ?? true
    body.readmessages = opts.readmessages ?? true

    return uazapiFetch('/send/menu', {
        method: 'POST',
        token: opts.instanceToken,
        body,
    })
}

/** Wrapper legado — converte buttons/sections antigo para formato choices */
async function sendMenuLegacy(opts: SendMenuOptionsLegacy): Promise<any> {
    if (!opts.instanceToken) {
        opts.instanceToken = await resolveDefaultWhatsAppInstanceToken() || undefined
    }
    if (!opts.instanceToken) {
        throw new Error('Token da instância é obrigatório')
    }

    // Convert legacy buttons to choices format
    if (opts.buttons && opts.buttons.length > 0) {
        const choices = opts.buttons.map(b => `${b.title}|${b.id}`)
        return sendMenuMessage({
            phone: opts.phone,
            text: opts.description || opts.title,
            type: 'button',
            choices,
            footerText: opts.footer,
            instanceToken: opts.instanceToken,
        })
    }

    // Convert legacy sections to list choices format
    if (opts.sections && opts.sections.length > 0) {
        const choices: string[] = []
        for (const section of opts.sections) {
            choices.push(`[${section.title}]`)
            for (const row of section.rows) {
                if (row.description) {
                    choices.push(`${row.title}|${row.id}|${row.description}`)
                } else {
                    choices.push(`${row.title}|${row.id}`)
                }
            }
        }
        return sendMenuMessage({
            phone: opts.phone,
            text: opts.description || opts.title,
            type: 'list',
            choices,
            listButton: opts.title,
            footerText: opts.footer,
            instanceToken: opts.instanceToken,
        })
    }

    // Fallback to text
    return sendWhatsAppMessage({
        phone: opts.phone,
        message: `${opts.title}\n\n${opts.description}`,
        instanceToken: opts.instanceToken,
    })
}

/** Enviar imagem */
export async function sendImageMessage({ phone, imageUrl, caption, instanceToken }: SendImageOptions) {
    if (!instanceToken) throw new Error('Token da instância é obrigatório')

    return uazapiFetch('/send/image', {
        method: 'POST',
        token: instanceToken,
        body: {
            number: cleanPhone(phone),
            url: imageUrl,
            ...(caption ? { caption } : {}),
        },
    })
}

/** Enviar áudio */
export async function sendAudioMessage({ phone, audioUrl, ptt, instanceToken }: SendAudioOptions) {
    if (!instanceToken) throw new Error('Token da instância é obrigatório')

    return uazapiFetch('/send/media', {
        method: 'POST',
        token: instanceToken,
        body: {
            number: cleanPhone(phone),
            file: audioUrl,           // UAZAPI uses 'file' not 'url'
            type: ptt ? 'ptt' : 'audio',  // 'ptt' for voice note, 'audio' for regular
        },
    })
}

/** Enviar video */
export async function sendVideoMessage({ phone, videoUrl, caption, thumbnail, instanceToken }: SendVideoOptions) {
    if (!instanceToken) throw new Error('Token da instÃ¢ncia Ã© obrigatÃ³rio')

    return uazapiFetch('/send/media', {
        method: 'POST',
        token: instanceToken,
        body: {
            number: cleanPhone(phone),
            file: videoUrl,
            type: 'video',
            ...(caption ? { text: caption } : {}),
            ...(thumbnail ? { thumbnail } : {}),
        },
    })
}

/** Enviar documento */
export async function sendDocumentMessage({ phone, documentUrl, fileName, caption, instanceToken }: SendDocumentOptions) {
    if (!instanceToken) throw new Error('Token da instância é obrigatório')

    return uazapiFetch('/send/document', {
        method: 'POST',
        token: instanceToken,
        body: {
            number: cleanPhone(phone),
            url: documentUrl,
            ...(fileName ? { fileName } : {}),
            ...(caption ? { caption } : {}),
        },
    })
}

/** Enviar localização */
export async function sendLocationMessage({ phone, latitude, longitude, name, address, instanceToken }: SendLocationOptions) {
    if (!instanceToken) throw new Error('Token da instância é obrigatório')

    return uazapiFetch('/send/location', {
        method: 'POST',
        token: instanceToken,
        body: {
            number: cleanPhone(phone),
            latitude,
            longitude,
            ...(name ? { name } : {}),
            ...(address ? { address } : {}),
        },
    })
}

/** Enviar contato */
export async function sendContactMessage({ phone, contactName, contactPhone, instanceToken }: SendContactOptions) {
    if (!instanceToken) throw new Error('Token da instância é obrigatório')

    return uazapiFetch('/send/contact', {
        method: 'POST',
        token: instanceToken,
        body: {
            number: cleanPhone(phone),
            name: contactName,
            phone: cleanPhone(contactPhone),
        },
    })
}

/** Enviar enquete */
export async function sendPollMessage({ phone, title, options, multiSelect, instanceToken }: SendPollOptions) {
    if (!instanceToken) throw new Error('Token da instância é obrigatório')

    return uazapiFetch('/send/poll', {
        method: 'POST',
        token: instanceToken,
        body: {
            number: cleanPhone(phone),
            title,
            options,
            multiSelect: multiSelect ?? false,
        },
    })
}

// ═══════════════════════════════════════════════════════════════
//  CONTATOS
// ═══════════════════════════════════════════════════════════════

/** Verificar se número tem WhatsApp */
export async function checkNumberExists(phone: string, instanceToken: string) {
    return uazapiFetch('/contact/check', {
        method: 'POST',
        token: instanceToken,
        body: { number: cleanPhone(phone) },
    })
}

interface ListContactsOptions {
    limit?: number
    offset?: number
    contactScope?: 'address_book' | 'outside_address_book' | 'all'
}

/** Listar contatos sem paginacao */
export async function listContacts(instanceToken: string) {
    return uazapiFetch('/contacts?contactScope=all', {
        token: instanceToken,
    })
}

/** Listar contatos com paginacao */
export async function listContactsPage(opts: ListContactsOptions, instanceToken: string) {
    return uazapiFetch('/contacts/list', {
        method: 'POST',
        token: instanceToken,
        body: {
            limit: opts.limit ?? 1000,
            offset: opts.offset ?? 0,
            contactScope: opts.contactScope ?? 'all',
        },
    })
}

/** Pegar foto/avatar de um contato */
export async function getContactAvatar(phone: string, instanceToken: string) {
    return uazapiFetch('/contact/avatar', {
        method: 'POST',
        token: instanceToken,
        body: { number: cleanPhone(phone) },
    })
}

export async function getChatDetails(phone: string, instanceToken: string, preview = true) {
    return uazapiFetch('/chat/details', {
        method: 'POST',
        token: instanceToken,
        body: { number: cleanPhone(phone), preview },
    })
}

// ═══════════════════════════════════════════════════════════════
//  GRUPOS
// ═══════════════════════════════════════════════════════════════

/** Listar grupos */
export async function listGroups(instanceToken: string) {
    return uazapiFetch('/group/all', {
        token: instanceToken,
    })
}

/** Info de um grupo */
export async function getGroupInfo(groupId: string, instanceToken: string) {
    return uazapiFetch('/group/info', {
        method: 'POST',
        token: instanceToken,
        body: { groupId },
    })
}

// ═══════════════════════════════════════════════════════════════
//  WEBHOOKS
// ═══════════════════════════════════════════════════════════════

/** Configurar webhook de uma instância */
export async function setWebhook(webhookUrl: string, instanceToken: string) {
    return configureWebhook({ enabled: true, url: webhookUrl }, instanceToken)
}

function normalizeWebhookResponse(result: any) {
    const data = result?.data ?? result
    const rows = Array.isArray(data)
        ? data
        : (Array.isArray(data?.webhooks) ? data.webhooks : [data])
    return rows.find((row: any) => row && typeof row === 'object') || null
}

/** Obter webhook configurado */
export async function getWebhook(instanceToken: string) {
    const configuredUrl = (await getUazapiConfig()).webhookUrl
    const result = await connectyHubFetch('/webhooks', { method: 'GET' })
    const webhooks = Array.isArray((result as any)?.webhooks) ? (result as any).webhooks : []
    const webhook = webhooks.find((webhook: any) => configuredUrl && webhook?.url === configuredUrl)
        || webhooks.find((webhook: any) => webhook?.status === 'active')
        || webhooks[0]
        || null
    return webhook
        ? {
            ...webhook,
            excludeMessages: webhook.excludeMessages || ['wasSentByApi', 'isGroupYes'],
        }
        : null
}

// ═══════════════════════════════════════════════════════════════
//  CHAT
// ═══════════════════════════════════════════════════════════════

/** Marcar como "digitando..." */
export async function setPresenceTyping(phone: string, instanceToken: string) {
    return uazapiFetch('/message/presence', {
        method: 'POST',
        token: instanceToken,
        body: { number: cleanPhone(phone), presence: 'composing', delay: 3000 },
    })
}

/** Marcar mensagens como lidas */
export async function markAsRead(phoneOrJid: string, instanceToken: string, messageId?: string | null) {
    const raw = (phoneOrJid || '').trim()
    const number = cleanPhone(raw)
    const jid = raw.includes('@') ? raw : `${number}@s.whatsapp.net`

    const chatRead = await uazapiFetch('/chat/read', {
        method: 'POST',
        token: instanceToken,
        body: {
            number: jid,
            read: true,
        },
    })

    if (!messageId) return { chatRead }

    const messageRead = await uazapiFetch('/message/markread', {
        method: 'POST',
        token: instanceToken,
        body: { id: [messageId] },
    }).catch((err) => {
        console.warn('[UAZAPI] /message/markread failed:', err)
        return null
    })

    return { chatRead, messageRead }
}

/** Mostrar "gravando áudio..." */
export async function setPresenceRecording(phone: string, instanceToken: string) {
    return uazapiFetch('/message/presence', {
        method: 'POST',
        token: instanceToken,
        body: { number: cleanPhone(phone), presence: 'recording', delay: 3000 },
    })
}

/** Ficar online (presença "available") */
export async function setPresenceAvailable(instanceToken: string, _phoneOrJid?: string) {
    // "Always online" is an instance-level presence control.
    // /message/presence only supports composing|recording|paused for a specific chat.
    return uazapiFetch('/instance/presence', {
        method: 'POST',
        token: instanceToken,
        body: {
            presence: 'available',
        },
    })
}

/** Ficar offline (presença "unavailable") */
export async function setPresenceUnavailable(instanceToken: string) {
    return uazapiFetch('/instance/presence', {
        method: 'POST',
        token: instanceToken,
        body: {
            presence: 'unavailable',
        },
    })
}

// ═══════════════════════════════════════════════════════════════
//  MEDIA DOWNLOAD
// ═══════════════════════════════════════════════════════════════

/** Download media (audio, image, etc.) from a received message using message ID */
export async function downloadMedia(messageId: string, instanceToken: string): Promise<Buffer | null> {
    try {
        const config = await getUazapiConfig()
        
        console.log(`[UAZAPI] downloadMedia: id=${messageId}, baseUrl=${config.baseUrl}`)
        
        const response = await fetch(`${config.baseUrl}/message/download`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'token': instanceToken,
            },
            body: JSON.stringify({
                id: messageId,           // UAZAPI uses 'id' NOT 'messageId'
                return_base64: true,     // Return as base64 string
                generate_mp3: true,      // Convert to MP3 for better compatibility
                return_link: false,      // We don't need a link, we have base64
            }),
        })

        console.log(`[UAZAPI] /message/download → status=${response.status}`)

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'could not read')
            console.error(`[UAZAPI] Download failed (${response.status}):`, errorText.substring(0, 300))
            return null
        }

        const contentType = response.headers.get('content-type') || ''

        if (contentType.includes('application/json')) {
            const data = await response.json()
            const keys = Object.keys(data)
            console.log(`[UAZAPI] Response JSON keys:`, keys.join(', '))

            // UAZAPI returns 'base64Data' field
            const b64 = data.base64Data || data.base64 || data.data
            if (b64 && typeof b64 === 'string') {
                const cleanB64 = b64.replace(/^data:[^;]+;base64,/, '')
                const buf = Buffer.from(cleanB64, 'base64')
                console.log(`[UAZAPI] ✅ Got base64 audio: ${buf.length} bytes`)
                return buf
            }

            // Handle URL response as fallback
            const mediaUrl = data.url || data.link || data.mediaUrl
            if (mediaUrl && typeof mediaUrl === 'string' && mediaUrl.startsWith('http')) {
                console.log(`[UAZAPI] Got media URL: ${mediaUrl.substring(0, 100)}...`)
                const mediaRes = await fetch(mediaUrl)
                if (mediaRes.ok) {
                    const buf = Buffer.from(await mediaRes.arrayBuffer())
                    console.log(`[UAZAPI] ✅ Downloaded ${buf.length} bytes from URL`)
                    return buf
                }
            }

            console.error('[UAZAPI] Unexpected response:', JSON.stringify(data).substring(0, 500))
            return null
        }

        // Binary response
        const buf = Buffer.from(await response.arrayBuffer())
        if (buf.length > 100) {
            console.log(`[UAZAPI] ✅ Got binary (${contentType}): ${buf.length} bytes`)
            return buf
        }
        
        console.error(`[UAZAPI] Response too small (${buf.length} bytes)`)
        return null
    } catch (e) {
        console.error('[UAZAPI] downloadMedia error:', e)
        return null
    }
}

// ═══════════════════════════════════════════════════════════════
//  UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════

/** Interpolar variáveis em template de mensagem */
export function interpolateTemplate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}|\{(\w+)\}/g, (_, keyA, keyB) => {
        const key = keyA || keyB
        if (!key) return _
        if (Object.prototype.hasOwnProperty.call(variables, key)) {
            return variables[key] ?? ''
        }
        return keyA ? `{{${key}}}` : `{${key}}`
    })
}

// ═══════════════════════════════════════════════════════════════
//  CARROSSEL (formato estruturado com botões tipados)
// ═══════════════════════════════════════════════════════════════

interface CarouselCard {
    text: string
    image?: string
    buttons: { id: string; text: string; type: 'REPLY' | 'URL' | 'CALL' | 'COPY' }[]
}

/** Enviar carrossel estruturado — /send/carousel */
export async function sendCarousel(
    phone: string,
    text: string,
    cards: CarouselCard[],
    instanceToken: string,
    options?: { delay?: number; readchat?: boolean }
) {
    return uazapiFetch('/send/carousel', {
        method: 'POST',
        token: instanceToken,
        body: {
            number: cleanPhone(phone),
            text,
            carousel: cards,
            ...(options?.delay ? { delay: options.delay } : {}),
            ...(options?.readchat ? { readchat: options.readchat } : {}),
        },
    })
}

// ═══════════════════════════════════════════════════════════════
//  PAGAMENTOS NATIVOS (PIX / Boleto)
// ═══════════════════════════════════════════════════════════════

interface PaymentRequestOptions {
    phone: string
    title: string
    text?: string
    footer?: string
    itemName: string
    invoiceNumber?: string
    amount: number   // em reais (ex: 5000.00)
    pixKey?: string
    pixType?: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM'
    pixName?: string
    boletoCode?: string
    fileUrl?: string    // URL do PDF do boleto
    fileName?: string
    paymentLink?: string
    instanceToken: string
}

/** Solicitar pagamento via WhatsApp nativo — /send/request-payment */
export async function sendRequestPayment(opts: PaymentRequestOptions) {
    return uazapiFetch('/send/request-payment', {
        method: 'POST',
        token: opts.instanceToken,
        body: {
            number: cleanPhone(opts.phone),
            title: opts.title,
            text: opts.text,
            footer: opts.footer,
            itemName: opts.itemName,
            invoiceNumber: opts.invoiceNumber,
            amount: opts.amount,
            pixKey: opts.pixKey,
            pixType: opts.pixType,
            pixName: opts.pixName,
            boletoCode: opts.boletoCode,
            fileUrl: opts.fileUrl,
            fileName: opts.fileName,
            paymentLink: opts.paymentLink,
        },
    })
}

/** Enviar botão PIX rápido — /send/pix-button */
export async function sendPixButton(
    phone: string,
    pixKey: string,
    pixName: string,
    pixType: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM',
    instanceToken: string
) {
    return uazapiFetch('/send/pix-button', {
        method: 'POST',
        token: instanceToken,
        body: { number: cleanPhone(phone), pixKey, pixName, pixType },
    })
}

// ═══════════════════════════════════════════════════════════════
//  SOLICITAR LOCALIZAÇÃO
// ═══════════════════════════════════════════════════════════════

/** Pedir localização do cliente — /send/location-button */
export async function sendLocationRequest(phone: string, text: string, instanceToken: string) {
    return uazapiFetch('/send/location-button', {
        method: 'POST',
        token: instanceToken,
        body: { number: cleanPhone(phone), text },
    })
}

// ═══════════════════════════════════════════════════════════════
//  CRM INTEGRADO (Gestão de Leads)
// ═══════════════════════════════════════════════════════════════

interface UpdateLeadOptions {
    /** JID do chat (ex: "5511999999999@s.whatsapp.net") ou número limpo */
    id: string
    lead_name?: string
    lead_fullName?: string
    lead_email?: string
    lead_personalid?: string
    lead_status?: string
    lead_notes?: string
    lead_isTicketOpen?: boolean
    lead_assignedAttendant_id?: string
    lead_kanbanOrder?: number
    lead_tags?: string[]
    /** Campos customizados 01-20 — mapeamento Pilger:
     * 01: Tipo de imóvel, 02: Orçamento, 03: Região,
     * 04: Prazo, 05: Agente, 06: Origem, 07: Imóveis visitados,
     * 08: Score, 09: Renda, 10: Pagamento, 11: Aprovação bancária,
     * 12: Último contato, 13: Motivo perda, 14: Campanha,
     * 15: Dependentes, 16: Pets, 17: Necessidades especiais,
     * 18: Corretor preferido, 19: Idioma, 20: Notas AI
     */
    lead_field01?: string; lead_field02?: string; lead_field03?: string
    lead_field04?: string; lead_field05?: string; lead_field06?: string
    lead_field07?: string; lead_field08?: string; lead_field09?: string
    lead_field10?: string; lead_field11?: string; lead_field12?: string
    lead_field13?: string; lead_field14?: string; lead_field15?: string
    lead_field16?: string; lead_field17?: string; lead_field18?: string
    lead_field19?: string; lead_field20?: string
    /** Desativar chatbot até timestamp UTC (0 = reativar) */
    chatbot_disableUntil?: number
}

/** Atualizar dados de um lead — /chat/editLead */
export async function updateLead(opts: UpdateLeadOptions, instanceToken: string) {
    // Garantir formato JID
    const id = opts.id.includes('@') ? opts.id : `${cleanPhone(opts.id)}@s.whatsapp.net`
    return uazapiFetch('/chat/editLead', {
        method: 'POST',
        token: instanceToken,
        body: { ...opts, id },
    })
}

interface FindChatsOptions {
    operator?: 'AND' | 'OR'
    sort?: string          // ex: "-wa_lastMsgTimestamp" (desc) ou "wa_lastMsgTimestamp" (asc)
    limit?: number
    offset?: number
    lead_status?: string   // use ~ para LIKE, != para diferente
    lead_tags?: string     // use ~ para contém
    lead_isTicketOpen?: boolean
    [key: string]: unknown // campos adicionais com operadores
}

/** Buscar chats com filtros avançados — /chat/find */
export async function findChats(opts: FindChatsOptions, instanceToken: string) {
    return uazapiFetch('/chat/find', {
        method: 'POST',
        token: instanceToken,
        body: opts,
    })
}

/** Salvar notas internas — /chat/notes/edit */
interface FindMessagesOptions {
    id?: string
    chatid?: string
    track_source?: string
    track_id?: string
    limit?: number
    offset?: number
}

/** Buscar mensagens com filtros */
export async function findMessages(opts: FindMessagesOptions, instanceToken: string) {
    return uazapiFetch('/message/find', {
        method: 'POST',
        token: instanceToken,
        body: opts,
    })
}

interface RequestHistorySyncOptions {
    number: string
    count?: number
    messageid?: string
}

/** Solicitar historico sob demanda de um chat */
export async function requestHistorySync(opts: RequestHistorySyncOptions, instanceToken: string) {
    return uazapiFetch('/message/history-sync', {
        method: 'POST',
        token: instanceToken,
        body: {
            number: opts.number,
            count: opts.count ?? 100,
            ...(opts.messageid ? { messageid: opts.messageid } : {}),
        },
    })
}

export async function updateNotes(phone: string, notes: string, instanceToken: string) {
    const jid = phone.includes('@') ? phone : `${cleanPhone(phone)}@s.whatsapp.net`
    return uazapiFetch('/chat/notes/edit', {
        method: 'POST',
        token: instanceToken,
        body: { number: jid, notes },
    })
}

/** Buscar notas de um chat — /chat/notes */
export async function getNotes(phone: string, instanceToken: string) {
    const jid = phone.includes('@') ? phone : `${cleanPhone(phone)}@s.whatsapp.net`
    return uazapiFetch('/chat/notes', {
        method: 'POST',
        token: instanceToken,
        body: { number: jid },
    })
}

// ═══════════════════════════════════════════════════════════════
//  WEBHOOK AVANÇADO
// ═══════════════════════════════════════════════════════════════

interface WebhookConfig {
    enabled: boolean
    url: string
    events?: string[]      // messages, messages_update, connection, presence, labels, chats, etc.
    excludeMessages?: string[]  // wasSentByApi, isGroupYes, fromMeYes, etc.
    addUrlEvents?: boolean     // adiciona /event_type na URL
    addUrlTypesMessages?: boolean
}

/** Configurar webhook de uma instância — POST /webhook */
export async function configureWebhook(config: WebhookConfig, instanceToken: string) {
    const webhookUrl = config.url || await resolveConnectyHubWebhookUrl()
    if (!webhookUrl) {
        throw new Error('CONNECTYHUB_WEBHOOK_URL nao configurado e nao foi possivel inferir a URL publica do webhook.')
    }

    const existing = await getWebhook(instanceToken).catch(() => null)
    const body = {
        url: webhookUrl,
        description: 'Pilger WhatsApp webhook',
        events: config.events || ['messages', 'messages_update', 'connection', 'history', 'presence', 'chats', 'contacts', 'labels', 'chat_labels'],
    }

    if (existing?.id) {
        return connectyHubFetch(`/webhooks/${existing.id}`, {
            method: 'PATCH',
            body: { ...body, status: config.enabled === false ? 'paused' : 'active' },
        })
    }

    const created = await connectyHubFetch('/webhooks', {
        method: 'POST',
        body,
    })
    const generatedSecret = String((created as any)?.secret || '').trim()
    if (generatedSecret) {
        await saveConnectyHubWebhookSecretIfMissing(generatedSecret)
    }
    return created
}

/** Obter erros de webhook — GET /webhook/errors */
export async function getWebhookErrors(instanceToken: string) {
    const webhook = await getWebhook(instanceToken).catch(() => null)
    const query = new URLSearchParams({ limit: '50' })
    if (webhook?.id) query.set('endpointId', webhook.id)
    return connectyHubFetch('/webhooks/deliveries', {
        method: 'GET',
        query,
    })
}

export { resolveConnectyHubWebhookUrl }

// ═══════════════════════════════════════════════════════════════
//  ETIQUETAS (Labels)
// ═══════════════════════════════════════════════════════════════

/** Listar todas as etiquetas — GET /labels */
export async function listLabels(instanceToken: string) {
    return uazapiFetch('/labels', {
        token: instanceToken,
    })
}

/** Criar, editar ou deletar etiqueta — POST /label/edit */
export async function editLabel(
    labelId: string,    // "new" para criar, ID existente para editar/deletar
    name: string,
    color: number,      // 0-19
    shouldDelete: boolean,
    instanceToken: string
) {
    return uazapiFetch('/label/edit', {
        method: 'POST',
        token: instanceToken,
        body: { labelid: labelId, name, color, delete: shouldDelete },
    })
}

/** Atribuir etiquetas a um chat — POST /chat/labels */
export async function setChatLabels(
    phone: string,
    labelIds: string[],
    instanceToken: string
) {
    const jid = phone.includes('@') ? phone : `${cleanPhone(phone)}@s.whatsapp.net`
    return uazapiFetch('/chat/labels', {
        method: 'POST',
        token: instanceToken,
        body: { number: jid, labels: labelIds },
    })
}

/** Recarregar etiquetas do WhatsApp — POST /labels/refresh */
export async function refreshLabels(instanceToken: string, force = false) {
    return uazapiFetch('/labels/refresh', {
        method: 'POST',
        token: instanceToken,
        body: { force },
    })
}

// ═══════════════════════════════════════════════════════════════
//  CAMPANHAS EM MASSA (Sender)
// ═══════════════════════════════════════════════════════════════

interface SimpleCampaignOptions {
    numbers: string[]       // JIDs (5511...@s.whatsapp.net)
    type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'button' | 'list' | 'poll'
    text?: string
    file?: string           // URL da mídia
    folder?: string         // nome da campanha
    delayMin?: number       // delay mínimo entre msgs (segundos)
    delayMax?: number       // delay máximo
    scheduled_for?: number  // timestamp para agendamento
    linkPreview?: boolean
    linkPreviewTitle?: string
    linkPreviewDescription?: string
    linkPreviewImage?: string
}

/** Enviar campanha simples — POST /sender/simple */
export async function sendSimpleCampaign(opts: SimpleCampaignOptions, instanceToken: string) {
    return uazapiFetch('/sender/simple', {
        method: 'POST',
        token: instanceToken,
        body: opts,
    })
}

interface AdvancedCampaignMessage {
    number: string
    type: string
    text?: string
    file?: string
    choices?: string[]
    [key: string]: unknown
}

interface AdvancedCampaignOptions {
    delayMin?: number
    delayMax?: number
    info?: string
    scheduled_for?: number
    messages: AdvancedCampaignMessage[]
}

/** Enviar campanha avançada (msg por destinatário) — POST /sender/advanced */
export async function sendAdvancedCampaign(opts: AdvancedCampaignOptions, instanceToken: string) {
    return uazapiFetch('/sender/advanced', {
        method: 'POST',
        token: instanceToken,
        body: opts,
    })
}

/** Gerenciar campanha (pausar, continuar, deletar) — POST /sender/edit */
export async function manageCampaign(
    folderId: string,
    action: 'stop' | 'continue' | 'delete',
    instanceToken: string
) {
    return uazapiFetch('/sender/edit', {
        method: 'POST',
        token: instanceToken,
        body: { id: folderId, action },
    })
}

/** Listar pastas/campanhas — GET /sender/listfolders */
export async function listCampaigns(instanceToken: string) {
    return uazapiFetch('/sender/listfolders', {
        token: instanceToken,
    })
}

// ═══════════════════════════════════════════════════════════════
//  RESPOSTAS RÁPIDAS (Quick Replies)
// ═══════════════════════════════════════════════════════════════

/** Listar todas as respostas rápidas — GET /quickreply/showall */
export async function listQuickReplies(instanceToken: string) {
    return uazapiFetch('/quickreply/showall', {
        token: instanceToken,
    })
}

/** Criar/editar/deletar resposta rápida — POST /quickreply/edit */
export async function editQuickReply(
    data: {
        id?: string          // omitir para criar
        shortCut: string
        type: 'text' | 'audio' | 'ptt' | 'document' | 'image' | 'video'
        text?: string
        file?: string        // URL da mídia  
        docName?: string
        delete?: boolean
    },
    instanceToken: string
) {
    return uazapiFetch('/quickreply/edit', {
        method: 'POST',
        token: instanceToken,
        body: data,
    })
}

// ═══════════════════════════════════════════════════════════════
//  CONFIGURAÇÕES DA INSTÂNCIA
// ═══════════════════════════════════════════════════════════════

interface PrivacySettings {
    groupadd?: 'all' | 'contacts' | 'contact_blacklist' | 'none'
    last?: 'all' | 'contacts' | 'contact_blacklist' | 'none'
    status?: 'all' | 'contacts' | 'contact_blacklist' | 'none'
    profile?: 'all' | 'contacts' | 'contact_blacklist' | 'none'
    readreceipts?: 'all' | 'none'
    online?: 'all' | 'match_last_seen'
    calladd?: 'all' | 'known'
}

/** Buscar configurações de privacidade — GET /instance/privacy */
export async function getPrivacy(instanceToken: string) {
    return uazapiFetch('/instance/privacy', { token: instanceToken })
}

/** Configurar privacidade — POST /instance/privacy */
export async function configurePrivacy(settings: PrivacySettings, instanceToken: string) {
    return uazapiFetch('/instance/privacy', {
        method: 'POST',
        token: instanceToken,
        body: settings,
    })
}

/** Configurar delay da fila de mensagens — POST /instance/updateDelaySettings */
export async function updateDelaySettings(
    minDelay: number,
    maxDelay: number,
    instanceToken: string
) {
    return uazapiFetch('/instance/updateDelaySettings', {
        method: 'POST',
        token: instanceToken,
        body: { msg_delay_min: minDelay, msg_delay_max: maxDelay },
    })
}

/** Obter limites de envio do WhatsApp — GET /instance/wa_messages_limits */
export async function getMessageLimits(instanceToken: string) {
    return uazapiFetch('/instance/wa_messages_limits', {
        token: instanceToken,
    })
}
