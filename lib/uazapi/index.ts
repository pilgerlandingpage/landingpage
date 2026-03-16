// ═══════════════════════════════════════════════════════════════
// uazapi — WhatsApp API Integration
// Lib centralizada para todas as operações com a uazapi
// Docs: https://docs.uazapi.com
// ═══════════════════════════════════════════════════════════════

interface UazapiConfig {
    baseUrl: string
    adminToken: string
}

interface SendTextOptions {
    phone: string
    message: string
    instanceToken?: string
    delay?: number
}

interface SendMenuOptions {
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
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', ['uazapi_base_url', 'uazapi_admin_token'])

    const config: Record<string, string> = {}
    data?.forEach((row: { key: string; value: string }) => {
        config[row.key] = row.value
    })

    return {
        baseUrl: config.uazapi_base_url || '',
        adminToken: config.uazapi_admin_token || '',
    }
}

// ── Helper: Fetch com auth ──────────────────────────────────────

async function uazapiFetch(
    path: string,
    options: {
        method?: string
        body?: unknown
        token?: string       // token da instância
        adminToken?: string  // admin token (para operações admin)
    } = {}
) {
    const config = await getUazapiConfig()
    const url = `${config.baseUrl}${path}`

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    }

    // Admin token para operações administrativas
    if (options.adminToken) {
        headers['admintoken'] = options.adminToken
    } else if (options.token) {
        headers['token'] = options.token
    }

    const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`uazapi error (${response.status}): ${error}`)
    }

    return response.json()
}

// ═══════════════════════════════════════════════════════════════
// INSTÂNCIAS
// ═══════════════════════════════════════════════════════════════

/** Criar nova instância (requer admin token) */
export async function createInstance(instanceName: string) {
    const config = await getUazapiConfig()
    return uazapiFetch('/instance/init', {
        method: 'POST',
        adminToken: config.adminToken,
        body: { name: instanceName, instanceName },
    })
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
export async function deleteInstance(instanceName: string) {
    const config = await getUazapiConfig()
    return uazapiFetch(`/instance/delete`, {
        method: 'DELETE',
        adminToken: config.adminToken,
        body: { name: instanceName },
    })
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

/** Enviar mensagem de texto */
export async function sendWhatsAppMessage({ phone, message, instanceToken, delay }: SendTextOptions) {
    if (!instanceToken) {
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        const { data } = await supabase.from('whatsapp_instances').select('instance_token').eq('status', 'connected').limit(1).maybeSingle()
        if (data && data.instance_token) {
            instanceToken = data.instance_token
        } else {
            throw new Error('Token da instância é obrigatório e nenhuma instância conectada foi encontrada')
        }
    }

    return uazapiFetch('/send/text', {
        method: 'POST',
        token: instanceToken,
        body: {
            number: cleanPhone(phone),
            text: message,
            ...(delay ? { delay } : {}),
        },
    })
}

/** Enviar menu interativo (botões ou listas) */
export async function sendMenuMessage({ phone, title, description, footer, buttons, sections, instanceToken }: SendMenuOptions) {
    if (!instanceToken) {
        throw new Error('Token da instância é obrigatório')
    }

    const body: Record<string, unknown> = {
        number: cleanPhone(phone),
        title,
        description,
    }

    if (footer) body.footer = footer
    if (buttons) body.buttons = buttons
    if (sections) body.sections = sections

    return uazapiFetch('/send/menu', {
        method: 'POST',
        token: instanceToken,
        body,
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

    return uazapiFetch('/send/audio', {
        method: 'POST',
        token: instanceToken,
        body: {
            number: cleanPhone(phone),
            url: audioUrl,
            ptt: ptt ?? true,
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

/** Listar contatos */
export async function listContacts(instanceToken: string) {
    return uazapiFetch('/contact/all', {
        token: instanceToken,
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
    return uazapiFetch('/webhook/set', {
        method: 'POST',
        token: instanceToken,
        body: { url: webhookUrl },
    })
}

/** Obter webhook configurado */
export async function getWebhook(instanceToken: string) {
    return uazapiFetch('/webhook/get', {
        token: instanceToken,
    })
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
export async function markAsRead(phone: string, instanceToken: string) {
    return uazapiFetch('/chat/read', {
        method: 'POST',
        token: instanceToken,
        body: { number: cleanPhone(phone) },
    })
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
export async function setPresenceAvailable(instanceToken: string) {
    return uazapiFetch('/message/presence', {
        method: 'POST',
        token: instanceToken,
        body: { presence: 'available' },
    })
}

// ═══════════════════════════════════════════════════════════════
//  UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════

/** Interpolar variáveis em template de mensagem */
export function interpolateTemplate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || `{{${key}}}`)
}
