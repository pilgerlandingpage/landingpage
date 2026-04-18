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
    if (opts.readchat) body.readchat = opts.readchat

    return uazapiFetch('/send/menu', {
        method: 'POST',
        token: opts.instanceToken,
        body,
    })
}

/** Wrapper legado — converte buttons/sections antigo para formato choices */
async function sendMenuLegacy(opts: SendMenuOptionsLegacy): Promise<any> {
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
export async function markAsRead(phoneOrJid: string, instanceToken: string) {
    const raw = (phoneOrJid || '').trim()
    const number = cleanPhone(raw)
    const jid = raw.includes('@') ? raw : `${number}@s.whatsapp.net`
    return uazapiFetch('/chat/read', {
        method: 'POST',
        token: instanceToken,
        // Compatibility payload: some providers expect "number", others "id"/"jid"/"chatId".
        body: { number, id: jid, jid, chatId: jid },
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
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || `{{${key}}}`)
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
    return uazapiFetch('/webhook', {
        method: 'POST',
        token: instanceToken,
        body: config,
    })
}

/** Obter erros de webhook — GET /webhook/errors */
export async function getWebhookErrors(instanceToken: string) {
    return uazapiFetch('/webhook/errors', {
        token: instanceToken,
    })
}

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
