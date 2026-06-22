import { createAdminClient } from '@/lib/supabase/server'
import {
    findChats,
    findMessages,
    listContacts,
    listContactsPage,
    requestHistorySync,
} from '@/lib/uazapi'
import { normalizeWhatsAppInstanceConfig } from './instance-config'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

type AttendanceInstance = {
    id: string
    instance_name: string
    instance_token: string | null
    phone_number?: string | null
    broker_id?: string | null
    admin_user_id?: string | null
    status?: string | null
    config?: Record<string, any> | null
}

type SyncOptions = {
    supabase?: SupabaseAdmin | any
    instanceId?: string | null
    force?: boolean
    respectReportHour?: boolean
    maxContacts?: number
    maxChats?: number
    messagesPerChat?: number
    includeHistorySync?: boolean
}

type ReportOptions = {
    supabase?: SupabaseAdmin | any
    instanceId?: string | null
    date?: string | null
    force?: boolean
    respectReportHour?: boolean
}

type NormalizedChat = {
    chatId: string
    phone: string | null
    name: string | null
    isGroup: boolean
    lastMessageAt: string | null
    raw: any
}

type NormalizedMessage = {
    chatId: string
    messageId: string
    phone: string | null
    direction: 'inbound' | 'outbound' | 'unknown'
    fromMe: boolean
    authorType: 'lead' | 'broker' | 'agent' | 'unknown'
    senderName: string | null
    messageType: string | null
    body: string | null
    messageTimestamp: string | null
    raw: any
}

const SAO_PAULO_TZ = 'America/Sao_Paulo'

function cleanPhone(raw: unknown): string {
    const text = String(raw || '').trim()
    const beforeAt = text.split('@')[0] || text
    const beforeDevice = beforeAt.split(':')[0] || beforeAt
    return beforeDevice.replace(/\D/g, '')
}

function jidFromPhoneOrJid(raw: unknown): string {
    const text = String(raw || '').trim()
    if (text.includes('@')) return text
    const phone = cleanPhone(text)
    return phone ? `${phone}@s.whatsapp.net` : text
}

function asArray(payload: any, keys: string[]): any[] {
    if (Array.isArray(payload)) return payload
    for (const key of keys) {
        const value = payload?.[key]
        if (Array.isArray(value)) return value
    }
    const data = payload?.data || payload?.result || payload?.response
    if (Array.isArray(data)) return data
    if (data && typeof data === 'object') {
        for (const key of keys) {
            if (Array.isArray(data[key])) return data[key]
        }
    }
    return []
}

function parseDateLike(raw: unknown): string | null {
    if (raw === null || raw === undefined || raw === '') return null
    if (typeof raw === 'number') {
        const millis = raw > 9999999999 ? raw : raw * 1000
        const date = new Date(millis)
        return Number.isNaN(date.getTime()) ? null : date.toISOString()
    }
    const text = String(raw).trim()
    if (!text) return null
    const numeric = Number(text)
    if (Number.isFinite(numeric) && /^\d+$/.test(text)) return parseDateLike(numeric)
    const date = new Date(text)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function getMessageText(raw: any): string | null {
    const candidates = [
        raw?.text,
        raw?.body,
        raw?.caption,
        raw?.content,
        raw?.message?.conversation,
        raw?.message?.extendedTextMessage?.text,
        raw?.message?.imageMessage?.caption,
        raw?.message?.videoMessage?.caption,
        raw?.message?.documentMessage?.caption,
    ]
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
    }
    return null
}

function normalizeContact(raw: any) {
    const jid = String(raw?.jid || raw?.id || raw?.wa_id || raw?.number || raw?.phone || '').trim()
    const phone = cleanPhone(jid || raw?.phone || raw?.number)
    return {
        jid: jid || jidFromPhoneOrJid(phone),
        phone: phone || null,
        contact_name: raw?.contact_name || raw?.contactName || raw?.name || raw?.pushName || null,
        first_name: raw?.contact_FirstName || raw?.firstName || raw?.first_name || null,
        raw,
        updated_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
    }
}

function normalizeChat(raw: any): NormalizedChat | null {
    const chatId = String(
        raw?.wa_chatid ||
        raw?.chatid ||
        raw?.chatId ||
        raw?.jid ||
        raw?.wa_id ||
        raw?.remoteJid ||
        raw?.key?.remoteJid ||
        raw?.id ||
        ''
    ).trim()
    if (!chatId) return null
    const isGroup = chatId.includes('@g.us') || raw?.isGroup === true || raw?.wa_isGroup === true
    const phone = cleanPhone(chatId || raw?.phone || raw?.number)
    return {
        chatId,
        phone: phone || null,
        name: raw?.name || raw?.pushName || raw?.wa_name || raw?.wa_contactName || raw?.contact_name || null,
        isGroup,
        lastMessageAt: parseDateLike(raw?.wa_lastMsgTimestamp || raw?.lastMessageTimestamp || raw?.timestamp || raw?.updatedAt),
        raw,
    }
}

function normalizeMessage(raw: any, fallbackChatId?: string | null): NormalizedMessage | null {
    const chatId = String(
        raw?.chatid ||
        raw?.chatId ||
        raw?.chat?.id ||
        raw?.key?.remoteJid ||
        raw?.remoteJid ||
        fallbackChatId ||
        ''
    ).trim()
    if (!chatId) return null
    const messageId = String(
        raw?.id ||
        raw?.messageid ||
        raw?.messageId ||
        raw?.key?.id ||
        raw?.message?.key?.id ||
        ''
    ).trim()
    if (!messageId) return null

    const fromMe = Boolean(raw?.fromMe ?? raw?.key?.fromMe ?? raw?.message?.key?.fromMe ?? false)
    const body = getMessageText(raw)
    const type = String(raw?.type || raw?.messageType || raw?.mediaType || '').trim() || (body ? 'text' : null)
    return {
        chatId,
        messageId,
        phone: cleanPhone(chatId) || null,
        direction: fromMe ? 'outbound' : 'inbound',
        fromMe,
        authorType: fromMe ? 'broker' : 'lead',
        senderName: raw?.senderName || raw?.pushName || raw?.participant || null,
        messageType: type,
        body,
        messageTimestamp: parseDateLike(raw?.messageTimestamp || raw?.timestamp || raw?.date || raw?.createdAt),
        raw,
    }
}

function rememberOldestMessageAnchor(
    anchors: Map<string, { messageId: string; timestamp: number }>,
    message: NormalizedMessage
) {
    const timestamp = message.messageTimestamp ? new Date(message.messageTimestamp).getTime() : 0
    if (!message.chatId || !message.messageId || !timestamp) return
    const current = anchors.get(message.chatId)
    if (!current || timestamp < current.timestamp) {
        anchors.set(message.chatId, { messageId: message.messageId, timestamp })
    }
}

async function upsertInChunks(supabase: any, table: string, rows: any[], onConflict: string, size = 500) {
    if (rows.length === 0) return 0
    let saved = 0
    for (let i = 0; i < rows.length; i += size) {
        const chunk = rows.slice(i, i + size)
        const { error } = await supabase.from(table).upsert(chunk, { onConflict })
        if (error) throw error
        saved += chunk.length
    }
    return saved
}

async function loadInstances(supabase: any, instanceId?: string | null): Promise<AttendanceInstance[]> {
    let query = supabase
        .from('whatsapp_instances')
        .select('id, instance_name, instance_token, phone_number, broker_id, admin_user_id, status, config')
        .eq('status', 'connected')
        .not('instance_token', 'is', null)
    if (instanceId) query = query.eq('id', instanceId)
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    return (data || []) as AttendanceInstance[]
}

function currentHourInTimezone(timezone: string) {
    const text = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone || SAO_PAULO_TZ,
        hour: '2-digit',
        hourCycle: 'h23',
    }).format(new Date())
    const hour = Number(text)
    return Number.isFinite(hour) ? hour : null
}

function isReportHourDue(instance: AttendanceInstance) {
    const config = normalizeWhatsAppInstanceConfig(instance.config || {})
    const hour = currentHourInTimezone(config.attendance_report_timezone || SAO_PAULO_TZ)
    return hour === Number(config.attendance_report_hour)
}

function shouldSyncInstance(instance: AttendanceInstance, force?: boolean, respectReportHour?: boolean) {
    if (force) return true
    const config = normalizeWhatsAppInstanceConfig(instance.config || {})
    if (respectReportHour && !isReportHourDue(instance)) return false
    return Boolean(config.attendance_monitor_enabled || config.attendance_history_import_enabled)
}

function shouldReportInstance(instance: AttendanceInstance, force?: boolean, respectReportHour?: boolean) {
    if (force) return true
    const config = normalizeWhatsAppInstanceConfig(instance.config || {})
    if (respectReportHour && !isReportHourDue(instance)) return false
    return Boolean(config.attendance_monitor_enabled || config.attendance_daily_report_enabled)
}

async function fetchContacts(instance: AttendanceInstance, maxContacts: number) {
    const token = instance.instance_token!
    const contacts: any[] = []
    let offset = 0
    const limit = Math.min(1000, Math.max(100, maxContacts))

    try {
        while (contacts.length < maxContacts) {
            const payload = await listContactsPage({ limit, offset }, token)
            const page = asArray(payload, ['contacts'])
            contacts.push(...page)
            const hasMore = Boolean(payload?.pagination && (payload.pagination.offset + payload.pagination.limit) < payload.pagination.totalRecords)
            if (!hasMore || page.length === 0) break
            offset += limit
        }
    } catch {
        const payload = await listContacts(token)
        contacts.push(...asArray(payload, ['contacts']))
    }

    return contacts.slice(0, maxContacts)
}

async function fetchChats(instance: AttendanceInstance, maxChats: number) {
    const token = instance.instance_token!
    const chats: any[] = []
    let offset = 0
    const limit = Math.min(100, Math.max(20, maxChats))
    while (chats.length < maxChats) {
        const payload = await findChats({ limit, offset, sort: '-wa_lastMsgTimestamp' }, token)
        const page = asArray(payload, ['chats', 'items', 'data'])
        chats.push(...page)
        const hasMore = payload?.hasMore === true || Boolean(payload?.nextOffset && payload.nextOffset > offset)
        if (!hasMore || page.length === 0) break
        offset = Number(payload?.nextOffset ?? offset + limit)
    }
    return chats.slice(0, maxChats)
}

async function fetchMessagesForChat(instance: AttendanceInstance, chat: NormalizedChat, messagesPerChat: number) {
    const token = instance.instance_token!
    const messages: any[] = []
    let offset = 0
    const limit = Math.min(100, Math.max(20, messagesPerChat))
    while (messages.length < messagesPerChat) {
        const payload = await findMessages({ chatid: chat.chatId, limit, offset }, token)
        const page = asArray(payload, ['messages', 'items', 'data'])
        messages.push(...page)
        const hasMore = payload?.hasMore === true || Boolean(payload?.nextOffset && payload.nextOffset > offset)
        if (!hasMore || page.length === 0) break
        offset = Number(payload?.nextOffset ?? offset + limit)
    }
    return messages.slice(0, messagesPerChat)
}

async function createImportJob(supabase: any, instanceId: string, jobType: string) {
    const { data, error } = await supabase
        .from('whatsapp_import_jobs')
        .insert({ instance_id: instanceId, job_type: jobType, status: 'running' })
        .select('id')
        .single()
    if (error) throw error
    return data?.id as string
}

async function finishImportJob(supabase: any, jobId: string | null, status: 'completed' | 'failed', summary: any, error?: string | null) {
    if (!jobId) return
    await supabase
        .from('whatsapp_import_jobs')
        .update({
            status,
            summary: summary || {},
            error: error || null,
            finished_at: new Date().toISOString(),
        })
        .eq('id', jobId)
}

export async function syncAttendanceForConnectedInstances(options: SyncOptions = {}) {
    const supabase = options.supabase || createAdminClient()
    const instances = await loadInstances(supabase, options.instanceId)
    const results = []

    for (const instance of instances) {
        if (!instance.instance_token || !shouldSyncInstance(instance, options.force, options.respectReportHour)) {
            results.push({ instance_id: instance.id, skipped: true })
            continue
        }

        let jobId: string | null = null
        const summary = {
            contacts: 0,
            chats: 0,
            messages: 0,
            history_sync_requested: 0,
            history_sync_skipped_no_anchor: 0,
            errors: [] as string[],
        }

        try {
            jobId = await createImportJob(supabase, instance.id, 'attendance_snapshot')
            const contacts = (await fetchContacts(instance, options.maxContacts ?? 5000))
                .map(normalizeContact)
                .filter((contact) => contact.jid)
                .map((contact) => ({ ...contact, instance_id: instance.id }))
            summary.contacts = await upsertInChunks(supabase, 'whatsapp_instance_contacts', contacts, 'instance_id,jid')

            const normalizedChats = (await fetchChats(instance, options.maxChats ?? 150))
                .map(normalizeChat)
                .filter(Boolean) as NormalizedChat[]
            const chatRows = normalizedChats.map((chat) => ({
                instance_id: instance.id,
                chat_id: chat.chatId,
                phone: chat.phone,
                chat_name: chat.name,
                is_group: chat.isGroup,
                last_message_at: chat.lastMessageAt,
                raw: chat.raw,
                updated_at: new Date().toISOString(),
                last_synced_at: new Date().toISOString(),
            }))
            summary.chats = await upsertInChunks(supabase, 'whatsapp_instance_chats', chatRows, 'instance_id,chat_id')

            const messageRows: any[] = []
            const oldestMessageAnchors = new Map<string, { messageId: string; timestamp: number }>()
            for (const chat of normalizedChats) {
                if (chat.isGroup) continue
                try {
                    const rawMessages = await fetchMessagesForChat(instance, chat, options.messagesPerChat ?? 100)
                    for (const raw of rawMessages) {
                        const msg = normalizeMessage(raw, chat.chatId)
                        if (!msg) continue
                        rememberOldestMessageAnchor(oldestMessageAnchors, msg)
                        messageRows.push({
                            instance_id: instance.id,
                            chat_id: msg.chatId,
                            message_id: msg.messageId,
                            phone: msg.phone || chat.phone,
                            direction: msg.direction,
                            from_me: msg.fromMe,
                            author_type: msg.authorType,
                            sender_name: msg.senderName,
                            message_type: msg.messageType,
                            body: msg.body,
                            message_timestamp: msg.messageTimestamp,
                            source: 'uazapi_message_find',
                            raw: msg.raw,
                            updated_at: new Date().toISOString(),
                        })
                    }
                } catch (error: any) {
                    summary.errors.push(`chat ${chat.chatId}: ${error?.message || String(error)}`)
                }
            }
            summary.messages = await upsertInChunks(supabase, 'whatsapp_message_history', messageRows, 'instance_id,message_id')

            if (options.includeHistorySync !== false) {
                for (const chat of normalizedChats.filter((item) => !item.isGroup).slice(0, 30)) {
                    const anchor = oldestMessageAnchors.get(chat.chatId)
                    if (!anchor?.messageId) {
                        summary.history_sync_skipped_no_anchor += 1
                        continue
                    }
                    try {
                        await requestHistorySync({ number: chat.chatId, count: 100, messageid: anchor.messageId }, instance.instance_token)
                        summary.history_sync_requested += 1
                    } catch (error: any) {
                        summary.errors.push(`history ${chat.chatId}: ${error?.message || String(error)}`)
                    }
                }
            }

            await finishImportJob(supabase, jobId, 'completed', summary)
            results.push({ instance_id: instance.id, instance_name: instance.instance_name, ...summary })
        } catch (error: any) {
            await finishImportJob(supabase, jobId, 'failed', summary, error?.message || String(error))
            results.push({ instance_id: instance.id, instance_name: instance.instance_name, failed: true, error: error?.message || String(error), ...summary })
        }
    }

    return {
        success: true,
        instances: results,
        totals: results.reduce((acc: any, item: any) => ({
            contacts: acc.contacts + Number(item.contacts || 0),
            chats: acc.chats + Number(item.chats || 0),
            messages: acc.messages + Number(item.messages || 0),
            history_sync_requested: acc.history_sync_requested + Number(item.history_sync_requested || 0),
            history_sync_skipped_no_anchor: acc.history_sync_skipped_no_anchor + Number(item.history_sync_skipped_no_anchor || 0),
        }), { contacts: 0, chats: 0, messages: 0, history_sync_requested: 0, history_sync_skipped_no_anchor: 0 }),
    }
}

export async function saveHistoryWebhookMessages(input: {
    supabase?: SupabaseAdmin | any
    instanceName?: string | null
    payload: any
}) {
    const supabase = input.supabase || createAdminClient()
    if (!input.instanceName) return { saved: 0, reason: 'missing_instance_name' }
    const { data: instance, error } = await supabase
        .from('whatsapp_instances')
        .select('id')
        .eq('instance_name', input.instanceName)
        .maybeSingle()
    if (error || !instance?.id) return { saved: 0, reason: 'instance_not_found' }

    const messages = asArray(input.payload, ['messages', 'history', 'data'])
    const rows = messages
        .map((raw) => normalizeMessage(raw))
        .filter((msg): msg is NormalizedMessage => Boolean(msg))
        .slice(0, 500)
        .map((msg) => ({
            instance_id: instance.id,
            chat_id: msg.chatId,
            message_id: msg.messageId,
            phone: msg.phone,
            direction: msg.direction,
            from_me: msg.fromMe,
            author_type: msg.authorType,
            sender_name: msg.senderName,
            message_type: msg.messageType,
            body: msg.body,
            message_timestamp: msg.messageTimestamp,
            source: 'uazapi_history_webhook',
            raw: msg.raw,
            updated_at: new Date().toISOString(),
        }))

    const saved = await upsertInChunks(supabase, 'whatsapp_message_history', rows, 'instance_id,message_id')
    return { saved, messages_seen: messages.length }
}

function currentSaoPauloDate() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: SAO_PAULO_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date())
}

function dayRange(dateInput?: string | null) {
    const date = String(dateInput || currentSaoPauloDate()).slice(0, 10)
    const [year, month, day] = date.split('-').map(Number)
    const start = new Date(Date.UTC(year, month - 1, day, 3, 0, 0))
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
    return { date, start: start.toISOString(), end: end.toISOString() }
}

function potentialFor(messages: NormalizedMessage[]) {
    const text = messages.map((m) => m.body || '').join(' ').toLowerCase()
    const hotWords = ['visita', 'agendar', 'hoje', 'amanha', 'amanhã', 'comprar', 'entrada', 'financiamento', 'proposta', 'fechar', 'valor', 'preco', 'preço']
    const warmWords = ['interesse', 'bairro', 'quartos', 'condominio', 'condomínio', 'metragem', 'investir', 'imovel', 'imóvel', 'apartamento', 'casa']
    const hot = hotWords.filter((word) => text.includes(word)).length
    const warm = warmWords.filter((word) => text.includes(word)).length
    if (hot >= 2) return 'hot'
    if (hot >= 1 || warm >= 2) return 'warm'
    if (text.length > 20) return 'cold'
    return 'unknown'
}

function scoreConversation(chatId: string, messages: NormalizedMessage[], leadName?: string | null) {
    const sorted = [...messages].sort((a, b) => {
        const ta = a.messageTimestamp ? new Date(a.messageTimestamp).getTime() : 0
        const tb = b.messageTimestamp ? new Date(b.messageTimestamp).getTime() : 0
        return ta - tb
    })
    const inbound = sorted.filter((m) => !m.fromMe)
    const outbound = sorted.filter((m) => m.fromMe)
    let pendingInboundAt: number | null = null
    const responseTimes: number[] = []
    for (const msg of sorted) {
        const ts = msg.messageTimestamp ? new Date(msg.messageTimestamp).getTime() : 0
        if (!ts) continue
        if (!msg.fromMe) {
            if (pendingInboundAt === null) pendingInboundAt = ts
        } else if (pendingInboundAt !== null && ts >= pendingInboundAt) {
            responseTimes.push(Math.round((ts - pendingInboundAt) / 1000))
            pendingInboundAt = null
        }
    }
    const lastInboundAt = inbound.at(-1)?.messageTimestamp ? new Date(inbound.at(-1)!.messageTimestamp!).getTime() : 0
    const lastOutboundAt = outbound.at(-1)?.messageTimestamp ? new Date(outbound.at(-1)!.messageTimestamp!).getTime() : 0
    const unanswered = lastInboundAt > lastOutboundAt
    const avgResponse = responseTimes.length
        ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length)
        : null
    const brokerText = outbound.map((m) => m.body || '').join(' ').toLowerCase()
    const leadPotential = potentialFor(sorted)
    const rapportHits = ['perfeito', 'entendo', 'claro', 'obrigado', 'obrigada', 'me conta', 'posso te ajudar', 'vamos'].filter((word) => brokerText.includes(word)).length
    const salesHits = ['agendar', 'visita', 'orcamento', 'orçamento', 'entrada', 'financiamento', 'bairro', 'quartos', 'valor', 'proposta', 'proximo passo', 'próximo passo'].filter((word) => brokerText.includes(word)).length

    let score = 55
    if (avgResponse !== null) {
        if (avgResponse <= 300) score += 18
        else if (avgResponse <= 900) score += 10
        else if (avgResponse <= 3600) score += 2
        else score -= 12
    } else if (inbound.length > 0) {
        score -= 18
    }
    if (unanswered) score -= 18
    score += Math.min(12, rapportHits * 4)
    score += Math.min(14, salesHits * 3)
    if (leadPotential === 'hot' && unanswered) score -= 10
    if (leadPotential === 'hot') score += 6
    if (outbound.length === 0 && inbound.length > 0) score -= 25
    score = Math.max(0, Math.min(100, score))

    const risks: string[] = []
    const recommendations: string[] = []
    if (unanswered) {
        risks.push('Lead ficou sem ultima resposta do corretor')
        recommendations.push('Retomar a conversa com uma pergunta objetiva e proximo passo claro')
    }
    if (avgResponse !== null && avgResponse > 900) {
        risks.push('Tempo medio de resposta acima do ideal')
        recommendations.push('Reduzir intervalo de resposta nos primeiros contatos')
    }
    if (rapportHits === 0 && outbound.length > 0) {
        risks.push('Poucos sinais de rapport na abordagem')
        recommendations.push('Validar a necessidade do lead antes de ofertar imoveis')
    }
    if (salesHits === 0 && outbound.length > 0) {
        risks.push('Conversa sem condução comercial clara')
        recommendations.push('Perguntar bairro, faixa de valor, prazo e sugerir agendamento')
    }
    if (leadPotential === 'hot' && score < 75) {
        risks.push('Lead com potencial alto recebeu atendimento abaixo do ideal')
        recommendations.push('Priorizar este lead no follow-up do dia')
    }

    return {
        chat_id: chatId,
        phone: sorted[0]?.phone || cleanPhone(chatId) || null,
        lead_name: leadName || null,
        score,
        lead_potential: leadPotential,
        response_time_seconds: avgResponse,
        unanswered,
        summary: `${inbound.length} mensagens do lead, ${outbound.length} respostas do corretor. Potencial ${leadPotential}.`,
        risks,
        recommendations,
        metrics: {
            inbound_messages: inbound.length,
            outbound_messages: outbound.length,
            response_count: responseTimes.length,
            avg_response_seconds: avgResponse,
            rapport_hits: rapportHits,
            sales_hits: salesHits,
        },
    }
}

export async function generateAttendanceReports(options: ReportOptions = {}) {
    const supabase = options.supabase || createAdminClient()
    const range = dayRange(options.date)
    const instances = (await loadInstances(supabase, options.instanceId)).filter((instance) => shouldReportInstance(instance, options.force, options.respectReportHour))
    const reports = []

    for (const instance of instances) {
        const { data: messagesData, error: messagesError } = await supabase
            .from('whatsapp_message_history')
            .select('*')
            .eq('instance_id', instance.id)
            .gte('message_timestamp', range.start)
            .lt('message_timestamp', range.end)
            .order('message_timestamp', { ascending: true })
        if (messagesError) throw messagesError

        const messages = (messagesData || []).map((row: any) => ({
            chatId: row.chat_id,
            messageId: row.message_id,
            phone: row.phone,
            direction: row.direction,
            fromMe: Boolean(row.from_me),
            authorType: row.author_type,
            senderName: row.sender_name,
            messageType: row.message_type,
            body: row.body,
            messageTimestamp: row.message_timestamp,
            raw: row.raw,
        })) as NormalizedMessage[]

        const { count: contactsCount } = await supabase
            .from('whatsapp_instance_contacts')
            .select('id', { count: 'exact', head: true })
            .eq('instance_id', instance.id)
        const { count: chatsCount } = await supabase
            .from('whatsapp_instance_chats')
            .select('id', { count: 'exact', head: true })
            .eq('instance_id', instance.id)

        const grouped = new Map<string, NormalizedMessage[]>()
        for (const msg of messages) {
            const list = grouped.get(msg.chatId) || []
            list.push(msg)
            grouped.set(msg.chatId, list)
        }

        const conversationScores = Array.from(grouped.entries()).map(([chatId, list]) => scoreConversation(chatId, list))
        const score = conversationScores.length
            ? Math.round(conversationScores.reduce((sum, item) => sum + item.score, 0) / conversationScores.length)
            : 0
        const unansweredCount = conversationScores.filter((item) => item.unanswered).length
        const hotLeads = conversationScores.filter((item) => item.lead_potential === 'hot').length
        const warmLeads = conversationScores.filter((item) => item.lead_potential === 'warm').length
        const coldLeads = conversationScores.filter((item) => item.lead_potential === 'cold').length
        const poorConversations = conversationScores.filter((item) => item.score < 60).length
        const strongConversations = conversationScores.filter((item) => item.score >= 80).length
        const needsAttention = conversationScores.filter((item) => item.unanswered || item.score < 60).length
        const hotUnanswered = conversationScores.filter((item) => item.lead_potential === 'hot' && item.unanswered).length
        const professionalStatus = conversationScores.length === 0
            ? 'sem_base'
            : score >= 78 && unansweredCount === 0 && poorConversations <= Math.max(1, Math.floor(conversationScores.length * 0.15))
                ? 'profissional_qualificado'
                : score >= 62 && unansweredCount <= Math.max(2, Math.floor(conversationScores.length * 0.25))
                    ? 'qualificado_com_melhorias'
                    : 'precisa_acompanhamento'
        const avgResponseValues = conversationScores
            .map((item) => item.response_time_seconds)
            .filter((value): value is number => typeof value === 'number')
        const avgResponse = avgResponseValues.length
            ? Math.round(avgResponseValues.reduce((sum, value) => sum + value, 0) / avgResponseValues.length)
            : null

        const recommendations = [
            unansweredCount > 0 ? `Retomar ${unansweredCount} conversa(s) que ficaram sem ultima resposta.` : null,
            hotLeads > 0 ? `Priorizar ${hotLeads} lead(s) com potencial alto.` : null,
            avgResponse !== null && avgResponse > 900 ? 'Criar meta de primeira resposta abaixo de 15 minutos.' : null,
            'Usar perguntas de descoberta: bairro, faixa de valor, prazo, forma de pagamento e objetivo.',
            'Encerrar cada conversa ativa com proximo passo claro: visita, envio de opcoes ou retorno combinado.',
        ].filter(Boolean)

        const coverage = {
            contacts_synced: contactsCount || 0,
            chats_synced: chatsCount || 0,
            conversations_analyzed: conversationScores.length,
            messages_analyzed: messages.length,
            period_start: range.start,
            period_end: range.end,
        }
        const metrics = {
            score,
            unanswered_conversations: unansweredCount,
            hot_leads: hotLeads,
            warm_leads: warmLeads,
            cold_leads: coldLeads,
            poor_conversations: poorConversations,
            strong_conversations: strongConversations,
            needs_attention: needsAttention,
            hot_unanswered_leads: hotUnanswered,
            professional_status: professionalStatus,
            avg_response_seconds: avgResponse,
            inbound_messages: messages.filter((m) => !m.fromMe).length,
            outbound_messages: messages.filter((m) => m.fromMe).length,
        }

        const summary = conversationScores.length
            ? `Parecer IA: status ${professionalStatus.replace(/_/g, ' ')}. Foram analisadas ${conversationScores.length} conversa(s) e ${messages.length} mensagem(ns). Score geral ${score}/100, com ${unansweredCount} conversa(s) sem ultima resposta, ${hotLeads} lead(s) quentes e ${poorConversations} conversa(s) ruins.`
            : 'Nao havia mensagens importadas para o periodo selecionado. Rode a sincronizacao para ampliar a cobertura.'

        const { data: report, error: reportError } = await supabase
            .from('broker_attendance_reports')
            .upsert({
                instance_id: instance.id,
                broker_id: instance.broker_id || null,
                report_date: range.date,
                period_start: range.start,
                period_end: range.end,
                score,
                title: `Relatorio de atendimento - ${range.date}`,
                summary,
                coverage,
                metrics,
                recommendations,
                generated_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }, { onConflict: 'instance_id,report_date' })
            .select('*')
            .single()
        if (reportError) throw reportError

        await upsertInChunks(
            supabase,
            'broker_attendance_conversation_scores',
            conversationScores.map((item) => ({
                report_id: report.id,
                instance_id: instance.id,
                broker_id: instance.broker_id || null,
                chat_id: item.chat_id,
                phone: item.phone,
                lead_name: item.lead_name,
                score: item.score,
                lead_potential: item.lead_potential,
                response_time_seconds: item.response_time_seconds,
                unanswered: item.unanswered,
                summary: item.summary,
                risks: item.risks,
                recommendations: item.recommendations,
                metrics: item.metrics,
            })),
            'report_id,chat_id'
        )

        reports.push({ ...report, conversation_scores: conversationScores })
    }

    return { success: true, date: range.date, reports }
}

export async function syncAndGenerateAttendanceReports(options: SyncOptions & ReportOptions = {}) {
    const supabase = options.supabase || createAdminClient()
    const sync = await syncAttendanceForConnectedInstances({ ...options, supabase })
    const reports = await generateAttendanceReports({ ...options, supabase })
    return { success: true, sync, reports }
}
