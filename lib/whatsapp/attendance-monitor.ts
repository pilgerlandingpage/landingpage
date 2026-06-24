import { createAdminClient } from '@/lib/supabase/server'
import {
    findChats,
    findMessages,
    listContacts,
    listContactsPage,
    requestHistorySync,
} from '@/lib/uazapi'
import {
    loadAttendanceCoachSettings,
    runAttendanceCoachAnalysis,
    WHATSAPP_ATTENDANCE_COACH_AGENT_ID,
    type AttendanceCoachConversationAnalysis,
    type AttendanceCoachConversationInput,
} from './attendance-coach-agent'
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
    const content = raw?.content && typeof raw.content === 'object' ? raw.content : null
    const candidates = [
        raw?.text,
        raw?.body,
        raw?.caption,
        raw?.content,
        content?.text,
        content?.body,
        content?.caption,
        content?.conversation,
        content?.extendedTextMessage?.text,
        content?.imageMessage?.caption,
        content?.videoMessage?.caption,
        content?.documentMessage?.caption,
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
        raw?.messageid ||
        raw?.messageId ||
        raw?.providerMessageId ||
        raw?.key?.id ||
        raw?.message?.key?.id ||
        raw?.id ||
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

function getCrmMessageBody(raw: any): string | null {
    const metadata = raw?.metadata && typeof raw.metadata === 'object' ? raw.metadata : null
    const candidates = [
        raw?.content,
        raw?.text,
        raw?.body,
        raw?.message,
        raw?.transcription,
        raw?.transcript,
        raw?.audio_transcription,
        raw?.messageText,
        metadata?.transcription,
        metadata?.transcript,
        metadata?.audio_transcription,
        metadata?.message_text,
        metadata?.text,
    ]
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
    }
    return null
}

function getCrmMessageTimestamp(raw: any, fallback?: string | null): string | null {
    return parseDateLike(raw?.timestamp || raw?.created_at || raw?.createdAt || raw?.sent_at || raw?.sentAt || raw?.date || fallback)
}

function internalMessageBelongsToInstance(raw: any, instance: AttendanceInstance) {
    const metadata = raw?.metadata && typeof raw.metadata === 'object' ? raw.metadata : {}
    const instanceId = String(raw?.instance_id || metadata.instance_id || '').trim()
    const brokerId = String(raw?.broker_id || metadata.broker_id || '').trim()
    const adminUserId = String(raw?.admin_user_id || metadata.admin_user_id || raw?.broker_user_id || '').trim()

    if (instance.id && instanceId === instance.id) return true
    if (instance.broker_id && brokerId === instance.broker_id) return true
    if (instance.admin_user_id && adminUserId === instance.admin_user_id) return true
    return false
}

function normalizeCrmConversationMessage(conversation: any, raw: any, index: number): NormalizedMessage | null {
    const phone = cleanPhone(conversation?.lead_phone)
    const chatId = jidFromPhoneOrJid(phone)
    if (!phone || !chatId) return null

    const body = getCrmMessageBody(raw)
    if (!body) return null

    const role = String(raw?.role || '').toLowerCase()
    const source = String(raw?.source || '').toLowerCase()
    const fromMe = source === 'human' ||
        source === 'agent' ||
        source === 'whatsapp_agent' ||
        source === 'ai' ||
        source === 'assistant' ||
        role === 'assistant'
    const timestamp = getCrmMessageTimestamp(raw, conversation?.updated_at || conversation?.created_at)
    const messageId = String(raw?.message_id || raw?.id || '').trim() ||
        `crm:${conversation?.id || phone}:${timestamp || conversation?.updated_at || index}:${index}`
    const extracted = conversation?.lead_data_extracted && typeof conversation.lead_data_extracted === 'object'
        ? conversation.lead_data_extracted
        : {}

    return {
        chatId,
        messageId,
        phone,
        direction: fromMe ? 'outbound' : 'inbound',
        fromMe,
        authorType: fromMe ? (source === 'human' ? 'broker' : 'agent') : 'lead',
        senderName: raw?.senderName || raw?.sender_name || raw?.name || extracted?.name || extracted?.lead_name || null,
        messageType: String(raw?.type || '').trim() || 'text',
        body,
        messageTimestamp: timestamp,
        raw: {
            attendance_source: 'crm_conversation',
            crm_conversation_id: conversation?.id || null,
            lead_id: conversation?.lead_id || null,
            broker_id: conversation?.broker_id || null,
            instance_id: conversation?.instance_id || null,
            lead_name: extracted?.name || extracted?.lead_name || null,
            original: raw,
        },
    }
}

function normalizeLeadConversationLogMessage(lead: any, raw: any, index: number, instance: AttendanceInstance): NormalizedMessage | null {
    const phone = cleanPhone(lead?.phone_e164 || lead?.phone || raw?.lead_phone || raw?.phone)
    const chatId = jidFromPhoneOrJid(phone)
    if (!phone || !chatId) return null

    const body = getCrmMessageBody(raw)
    if (!body) return null

    const role = String(raw?.role || '').toLowerCase()
    const source = String(raw?.source || '').toLowerCase()
    const fromMe = role === 'assistant' ||
        source === 'human' ||
        source === 'agent' ||
        source === 'whatsapp_agent' ||
        source === 'shadow_agent' ||
        source === 'ai' ||
        source === 'assistant' ||
        source === 'from_me_pending'
    const timestamp = getCrmMessageTimestamp(raw, lead?.updated_at || lead?.created_at)
    const messageId = String(raw?.message_id || raw?.id || '').trim() ||
        `lead-log:${lead?.id || phone}:${timestamp || lead?.updated_at || index}:${index}`
    const rawBrokerId = raw?.broker_id || raw?.metadata?.broker_id || null
    const rawInstanceId = raw?.instance_id || raw?.metadata?.instance_id || null

    return {
        chatId,
        messageId,
        phone,
        direction: fromMe ? 'outbound' : 'inbound',
        fromMe,
        authorType: fromMe ? (source === 'human' || source === 'from_me_pending' ? 'broker' : 'agent') : 'lead',
        senderName: raw?.senderName || raw?.sender_name || raw?.name || lead?.name || null,
        messageType: String(raw?.type || '').trim() || 'text',
        body,
        messageTimestamp: timestamp,
        raw: {
            attendance_source: 'lead_conversation_log',
            lead_id: lead?.id || null,
            broker_id: rawBrokerId || instance.broker_id || null,
            instance_id: rawInstanceId || instance.id || null,
            lead_name: lead?.name || null,
            original: raw,
        },
    }
}

function normalizeBrokerConversationMessage(conversation: any, raw: any, index: number, instance: AttendanceInstance): NormalizedMessage | null {
    const phone = cleanPhone(conversation?.lead_phone || raw?.lead_phone || raw?.phone)
    const chatId = jidFromPhoneOrJid(phone)
    if (!phone || !chatId) return null

    const body = getCrmMessageBody(raw)
    if (!body) return null

    const role = String(raw?.role || '').toLowerCase()
    const source = String(raw?.source || '').toLowerCase()
    const fromMe = role === 'assistant' || source !== 'lead'
    const timestamp = getCrmMessageTimestamp(raw, conversation?.updated_at || conversation?.created_at)
    const messageId = String(raw?.message_id || raw?.id || '').trim() ||
        `broker-conv:${conversation?.id || phone}:${timestamp || conversation?.updated_at || index}:${index}`

    return {
        chatId,
        messageId,
        phone,
        direction: fromMe ? 'outbound' : 'inbound',
        fromMe,
        authorType: fromMe ? (source === 'shadow_agent' ? 'agent' : 'broker') : 'lead',
        senderName: raw?.senderName || raw?.sender_name || raw?.name || null,
        messageType: String(raw?.type || '').trim() || 'text',
        body,
        messageTimestamp: timestamp,
        raw: {
            attendance_source: 'broker_conversation',
            broker_user_id: conversation?.broker_user_id || instance.admin_user_id || null,
            broker_id: instance.broker_id || null,
            instance_id: raw?.instance_id || instance.id || null,
            lead_id: conversation?.lead_id || null,
            original: raw,
        },
    }
}

function messageNaturalKey(message: NormalizedMessage) {
    const body = String(message.body || '').trim().toLowerCase().replace(/\s+/g, ' ')
    const timestamp = message.messageTimestamp
        ? new Date(message.messageTimestamp).toISOString().slice(0, 19)
        : ''
    return [
        message.chatId,
        message.fromMe ? 'out' : 'in',
        timestamp,
        body,
    ].join('|')
}

function mergeUniqueMessages(messages: NormalizedMessage[]) {
    const seen = new Set<string>()
    const merged: NormalizedMessage[] = []
    for (const message of messages) {
        const key = message.messageId
            ? `${message.chatId}:id:${message.messageId}`
            : messageNaturalKey(message)
        const natural = messageNaturalKey(message)
        if (seen.has(key) || seen.has(natural)) continue
        seen.add(key)
        seen.add(natural)
        merged.push(message)
    }
    return merged.sort((a, b) => {
        const ta = a.messageTimestamp ? new Date(a.messageTimestamp).getTime() : 0
        const tb = b.messageTimestamp ? new Date(b.messageTimestamp).getTime() : 0
        return ta - tb
    })
}

async function fetchCrmConversationMessages(
    supabase: any,
    instance: AttendanceInstance,
    range: { start: string; end: string }
) {
    if (!instance.id && !instance.broker_id) return []

    let query = supabase
        .from('whatsapp_ai_conversations')
        .select('id, lead_id, broker_id, instance_id, lead_phone, messages, lead_data_extracted, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(1000)

    if (instance.id && instance.broker_id) {
        query = query.or(`instance_id.eq.${instance.id},broker_id.eq.${instance.broker_id}`)
    } else if (instance.id) {
        query = query.eq('instance_id', instance.id)
    } else if (instance.broker_id) {
        query = query.eq('broker_id', instance.broker_id)
    }

    const { data, error } = await query
    if (error) {
        console.warn('[attendance-monitor] CRM conversations unavailable:', error.message)
        return []
    }

    const startMs = new Date(range.start).getTime()
    const endMs = new Date(range.end).getTime()
    const rows: NormalizedMessage[] = []

    for (const conversation of data || []) {
        const messages = Array.isArray(conversation?.messages) ? conversation.messages : []
        messages.forEach((raw: any, index: number) => {
            const normalized = normalizeCrmConversationMessage(conversation, raw, index)
            if (!normalized?.messageTimestamp) return
            const timestamp = new Date(normalized.messageTimestamp).getTime()
            if (!Number.isFinite(timestamp) || timestamp < startMs || timestamp >= endMs) return
            rows.push(normalized)
        })
    }

    return rows
}

async function fetchLeadConversationLogMessages(
    supabase: any,
    instance: AttendanceInstance,
    range: { start: string; end: string },
    scopedPhones: Set<string>
) {
    const { data, error } = await supabase
        .from('leads')
        .select('id, name, phone, phone_e164, conversation_log, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(2000)

    if (error) {
        console.warn('[attendance-monitor] Lead conversation logs unavailable:', error.message)
        return []
    }

    const startMs = new Date(range.start).getTime()
    const endMs = new Date(range.end).getTime()
    const rows: NormalizedMessage[] = []

    for (const lead of data || []) {
        const phone = cleanPhone(lead?.phone_e164 || lead?.phone)
        const messages = Array.isArray(lead?.conversation_log) ? lead.conversation_log : []
        messages.forEach((raw: any, index: number) => {
            const timestamp = getCrmMessageTimestamp(raw, lead?.updated_at || lead?.created_at)
            if (!timestamp) return
            const time = new Date(timestamp).getTime()
            if (!Number.isFinite(time) || time < startMs || time >= endMs) return
            const scopedByInstance = internalMessageBelongsToInstance(raw, instance)
            const scopedByKnownPhone = phone ? scopedPhones.has(phone) : false
            if (!scopedByInstance && !scopedByKnownPhone) return
            const normalized = normalizeLeadConversationLogMessage(lead, raw, index, instance)
            if (normalized) rows.push(normalized)
        })
    }

    return rows
}

async function fetchBrokerConversationMessages(
    supabase: any,
    instance: AttendanceInstance,
    range: { start: string; end: string }
) {
    const adminUserId = String(instance.admin_user_id || '').trim()
    if (!adminUserId || adminUserId === '00000000-0000-0000-0000-000000000000') return []

    const { data, error } = await supabase
        .from('whatsapp_broker_conversations')
        .select('id, lead_id, broker_user_id, ai_conversation_id, lead_phone, messages, is_shadow_agent, created_at, updated_at')
        .eq('broker_user_id', adminUserId)
        .order('updated_at', { ascending: false })
        .limit(1000)

    if (error) {
        console.warn('[attendance-monitor] Broker conversation logs unavailable:', error.message)
        return []
    }

    const startMs = new Date(range.start).getTime()
    const endMs = new Date(range.end).getTime()
    const rows: NormalizedMessage[] = []

    for (const conversation of data || []) {
        const messages = Array.isArray(conversation?.messages) ? conversation.messages : []
        messages.forEach((raw: any, index: number) => {
            const normalized = normalizeBrokerConversationMessage(conversation, raw, index, instance)
            if (!normalized?.messageTimestamp) return
            const timestamp = new Date(normalized.messageTimestamp).getTime()
            if (!Number.isFinite(timestamp) || timestamp < startMs || timestamp >= endMs) return
            rows.push(normalized)
        })
    }

    return rows
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
            const payload = await listContactsPage({ limit, offset, contactScope: 'all' }, token)
            const page = asArray(payload, ['contacts'])
            contacts.push(...page)
            const pagination = payload?.pagination || {}
            const totalRecords = Number(pagination.totalRecords ?? pagination.total_records ?? 0)
            const currentOffset = Number(pagination.offset ?? offset)
            const currentLimit = Number(pagination.limit ?? limit) || limit
            const hasMore = totalRecords
                ? currentOffset + currentLimit < totalRecords
                : page.length >= limit
            if (!hasMore || page.length === 0) break
            offset = currentOffset + currentLimit
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
        const pagination = payload?.pagination || {}
        const totalRecords = Number(pagination.totalRecords ?? pagination.total_records ?? 0)
        const currentOffset = Number(pagination.offset ?? offset)
        const currentLimit = Number(pagination.limit ?? limit) || limit
        const hasMore = payload?.hasMore === true ||
            Boolean(payload?.nextOffset && payload.nextOffset > offset) ||
            (totalRecords ? currentOffset + currentLimit < totalRecords : page.length >= limit)
        if (!hasMore || page.length === 0) break
        offset = Number(payload?.nextOffset ?? currentOffset + currentLimit)
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
        const pagination = payload?.pagination || {}
        const totalRecords = Number(pagination.totalRecords ?? pagination.total_records ?? 0)
        const currentOffset = Number(payload?.offset ?? pagination.offset ?? offset)
        const currentLimit = Number(payload?.limit ?? pagination.limit ?? limit) || limit
        const hasMore = payload?.hasMore === true ||
            Boolean(payload?.nextOffset && payload.nextOffset > offset) ||
            (totalRecords ? currentOffset + currentLimit < totalRecords : page.length >= limit)
        if (!hasMore || page.length === 0) break
        offset = Number(payload?.nextOffset ?? currentOffset + currentLimit)
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
            history_sync_requested_without_anchor: 0,
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
                    try {
                        await requestHistorySync({ number: chat.chatId, count: 100, ...(anchor?.messageId ? { messageid: anchor.messageId } : {}) }, instance.instance_token)
                        summary.history_sync_requested += 1
                        if (!anchor?.messageId) summary.history_sync_requested_without_anchor += 1
                    } catch (error: any) {
                        if (!anchor?.messageId) summary.history_sync_skipped_no_anchor += 1
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
            history_sync_requested_without_anchor: acc.history_sync_requested_without_anchor + Number(item.history_sync_requested_without_anchor || 0),
        }), { contacts: 0, chats: 0, messages: 0, history_sync_requested: 0, history_sync_skipped_no_anchor: 0, history_sync_requested_without_anchor: 0 }),
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

function classifyCommercialOpportunity(params: {
    messages: NormalizedMessage[]
    score: number
    unanswered: boolean
    leadPotential: string
    avgResponse: number | null
}) {
    const text = params.messages.map((m) => m.body || '').join(' ').toLowerCase()
    const lastMessageAt = params.messages.at(-1)?.messageTimestamp || null
    const daysSinceLastMessage = lastMessageAt
        ? Math.floor((Date.now() - new Date(lastMessageAt).getTime()) / (24 * 60 * 60 * 1000))
        : null
    const readyTerms = ['quero fechar', 'fechar', 'proposta', 'valor', 'preco', 'forma de pagamento', 'entrada', 'pix', 'disponivel', 'visitar', 'visita', 'agenda', 'agendar', 'proximo passo']
    const objectionTerms = ['caro', 'desconto', 'prazo', 'documentacao', 'financiamento', 'medo', 'concorrente', 'comparando', 'localizacao', 'condominio']
    const readyHits = readyTerms.filter((term) => text.includes(term)).length
    const objectionHits = objectionTerms.filter((term) => text.includes(term)).length

    if (params.unanswered && params.leadPotential === 'hot') {
        return {
            category: 'oportunidade_perdida',
            reason: 'Lead quente ficou sem ultima resposta ou sem fechamento objetivo.',
            next_action: 'Retomar com proposta objetiva e CTA de fechamento.',
            suggested_message: 'Oi, vi que voce tinha interesse. Posso te mandar agora a melhor condicao e o proximo passo para avancarmos?',
            days_since_last_message: daysSinceLastMessage,
        }
    }
    if (params.unanswered) {
        return {
            category: 'cliente_abandonado',
            reason: 'A ultima mensagem foi do cliente e nao houve resposta posterior registrada.',
            next_action: 'Responder com acolhimento e pergunta curta para reabrir a conversa.',
            suggested_message: 'Oi, retomei sua mensagem aqui. Ainda faz sentido te ajudar com essa busca?',
            days_since_last_message: daysSinceLastMessage,
        }
    }
    if (readyHits >= 2 || (params.leadPotential === 'hot' && params.score >= 75)) {
        return {
            category: 'cliente_pronto_para_comprar',
            reason: 'A conversa tem sinais de preco, disponibilidade, visita, proposta ou proximo passo.',
            next_action: 'Enviar proposta, condicao ou convite direto para visita/fechamento.',
            suggested_message: 'Perfeito. Vou te passar a condicao mais objetiva e ja deixo o proximo passo encaminhado.',
            days_since_last_message: daysSinceLastMessage,
        }
    }
    if (objectionHits >= 2) {
        return {
            category: 'cliente_com_objecao',
            reason: 'A conversa tem sinais de duvida sobre preco, prazo, financiamento, localizacao ou comparacao.',
            next_action: 'Tratar a objecao antes de ofertar outro imovel.',
            suggested_message: 'Entendi seu ponto. Posso te mostrar a melhor alternativa considerando essa preocupacao?',
            days_since_last_message: daysSinceLastMessage,
        }
    }
    if (daysSinceLastMessage !== null && daysSinceLastMessage >= 3 && params.leadPotential !== 'cold') {
        return {
            category: 'reativacao',
            reason: 'Lead com sinal comercial ficou alguns dias sem nova interacao.',
            next_action: 'Enviar follow-up consultivo com uma pergunta simples.',
            suggested_message: 'Oi, passando para saber se voce ainda quer que eu filtre as melhores opcoes para o seu momento.',
            days_since_last_message: daysSinceLastMessage,
        }
    }
    if (params.avgResponse !== null && params.avgResponse > 3600) {
        return {
            category: 'cliente_mal_atendido',
            reason: 'Tempo medio de resposta ficou alto para uma conversa comercial.',
            next_action: 'Retomar com pedido de contexto e caminho claro.',
            suggested_message: 'Desculpa a demora no retorno. Vou ser direto: qual faixa de valor e prazo fazem sentido para voce agora?',
            days_since_last_message: daysSinceLastMessage,
        }
    }

    return {
        category: 'monitorar',
        reason: 'Conversa sem alerta comercial forte no periodo.',
        next_action: 'Manter acompanhamento e qualificar melhor se houver nova resposta.',
        suggested_message: '',
        days_since_last_message: daysSinceLastMessage,
    }
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
    const commercialOpportunity = classifyCommercialOpportunity({
        messages: sorted,
        score,
        unanswered,
        leadPotential,
        avgResponse,
    })

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
            commercial_category: commercialOpportunity.category,
            commercial_reason: commercialOpportunity.reason,
            next_action: commercialOpportunity.next_action,
            suggested_message: commercialOpportunity.suggested_message,
            days_since_last_message: commercialOpportunity.days_since_last_message,
        },
    }
}

type ConversationScoreDraft = Omit<ReturnType<typeof scoreConversation>, 'metrics'> & {
    metrics: ReturnType<typeof scoreConversation>['metrics'] & Record<string, any>
}

function uniqueTextList(...lists: unknown[]) {
    const seen = new Set<string>()
    const items: string[] = []
    for (const list of lists) {
        const values = Array.isArray(list) ? list : typeof list === 'string' ? [list] : []
        for (const value of values) {
            const text = String(value || '').trim()
            if (!text || seen.has(text)) continue
            seen.add(text)
            items.push(text)
        }
    }
    return items.slice(0, 8)
}

function coachCandidateWeight(score: ConversationScoreDraft, messages: NormalizedMessage[]) {
    const lastMessageAt = messages.at(-1)?.messageTimestamp
    const ageHours = lastMessageAt
        ? Math.max(0, (Date.now() - new Date(lastMessageAt).getTime()) / (60 * 60 * 1000))
        : 999
    return (
        (score.unanswered ? 100 : 0) +
        (score.lead_potential === 'hot' ? 80 : score.lead_potential === 'warm' ? 45 : 0) +
        (score.score < 60 ? 70 : score.score < 75 ? 35 : 0) +
        (Number(score.metrics?.commercial_category === 'oportunidade_perdida') ? 60 : 0) +
        Math.max(0, 30 - Math.min(30, ageHours)) +
        Math.min(20, messages.length)
    )
}

function selectCoachCandidates(
    conversationScores: ConversationScoreDraft[],
    groupedMessages: Map<string, NormalizedMessage[]>,
    maxConversations: number
) {
    return [...conversationScores]
        .map((score) => ({
            score,
            messages: groupedMessages.get(score.chat_id) || [],
            weight: coachCandidateWeight(score, groupedMessages.get(score.chat_id) || []),
        }))
        .filter((item) => item.messages.some((message) => String(message.body || '').trim()))
        .sort((a, b) => b.weight - a.weight || a.score.score - b.score.score)
        .slice(0, maxConversations)
}

function toCoachInput(item: { score: ConversationScoreDraft; messages: NormalizedMessage[] }): AttendanceCoachConversationInput {
    const sorted = [...item.messages].sort((a, b) => {
        const ta = a.messageTimestamp ? new Date(a.messageTimestamp).getTime() : 0
        const tb = b.messageTimestamp ? new Date(b.messageTimestamp).getTime() : 0
        return ta - tb
    })
    return {
        chat_id: item.score.chat_id,
        phone: item.score.phone || null,
        lead_name: item.score.lead_name || null,
        baseline_score: item.score.score,
        baseline_potential: item.score.lead_potential,
        unanswered: item.score.unanswered,
        response_time_seconds: item.score.response_time_seconds,
        messages: sorted
            .map((message) => ({
                role: message.authorType || (message.fromMe ? 'broker' : 'lead'),
                text: String(message.body || '').trim(),
                at: message.messageTimestamp || null,
            }))
            .filter((message) => message.text),
    }
}

function mergeCoachAnalysis(score: ConversationScoreDraft, analysis?: AttendanceCoachConversationAnalysis | null): ConversationScoreDraft {
    if (!analysis) return score
    return {
        ...score,
        score: analysis.score,
        lead_potential: analysis.lead_potential,
        summary: analysis.summary || score.summary,
        risks: uniqueTextList(analysis.risks, score.risks),
        recommendations: uniqueTextList(analysis.recommendations, score.recommendations, analysis.recommended_next_action),
        metrics: {
            ...score.metrics,
            llm_agent_id: WHATSAPP_ATTENDANCE_COACH_AGENT_ID,
            llm_analyzed: true,
            llm_score: analysis.score,
            lead_intent: analysis.lead_intent,
            funnel_stage: analysis.funnel_stage,
            commercial_status: analysis.commercial_status,
            lost_opportunity: analysis.lost_opportunity,
            recoverable: analysis.recoverable,
            communication_quality: analysis.communication_quality,
            response_quality: analysis.response_quality,
            closing_quality: analysis.closing_quality,
            empathy_quality: analysis.empathy_quality,
            qualification_quality: analysis.qualification_quality,
            main_issue: analysis.main_issue,
            what_broker_did_well: analysis.what_broker_did_well,
            what_broker_missed: analysis.what_broker_missed,
            recommended_next_action: analysis.recommended_next_action,
            suggested_message: analysis.suggested_message,
            commercial_category: analysis.commercial_status || score.metrics?.commercial_category,
            commercial_reason: analysis.main_issue || score.metrics?.commercial_reason,
            next_action: analysis.recommended_next_action || score.metrics?.next_action,
        },
    }
}

function formatDurationBrief(seconds: number | null) {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return 'sem tempo medio calculado'
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes}min`
    const hours = Math.round(minutes / 60)
    return `${hours}h`
}

function percentage(part: number, total: number) {
    if (!total) return 0
    return Math.round((part / total) * 100)
}

function professionalStatusLabel(status: string) {
    if (status === 'profissional_qualificado') return 'profissional qualificado'
    if (status === 'qualificado_com_melhorias') return 'qualificado com pontos de melhoria'
    if (status === 'precisa_acompanhamento') return 'precisa de acompanhamento'
    return 'sem base suficiente'
}

function buildLeadQualityReport(params: {
    total: number
    hotLeads: number
    warmLeads: number
    coldLeads: number
    unknownLeads: number
}) {
    const { total, hotLeads, warmLeads, coldLeads, unknownLeads } = params
    if (!total) return 'Ainda nao ha conversas suficientes para medir a qualidade dos leads desta instancia.'

    const opportunity = hotLeads + warmLeads
    const opportunityPct = percentage(opportunity, total)
    const coldPct = percentage(coldLeads, total)
    const base = `A base analisada trouxe ${hotLeads} lead(s) quente(s), ${warmLeads} morno(s), ${coldLeads} frio(s) e ${unknownLeads} sem sinal claro.`

    if (hotLeads > 0 && opportunityPct >= 45) {
        return `${base} Qualidade boa: ha volume relevante de oportunidades com intencao comercial, entao a prioridade deve ser resposta rapida e proximo passo objetivo.`
    }
    if (opportunityPct >= 30) {
        return `${base} Qualidade mista: existem oportunidades, mas parte relevante ainda precisa de qualificacao antes de receber ofertas.`
    }
    if (coldPct >= 55) {
        return `${base} Qualidade baixa no periodo: a maioria das conversas teve pouco sinal de compra, prazo ou visita. O corretor precisa qualificar melhor antes de investir tempo comercial.`
    }
    return `${base} Qualidade ainda indefinida: o atendimento precisa fazer perguntas de descoberta para separar curiosos de compradores reais.`
}

function buildAttendanceNarrative(params: {
    score: number
    total: number
    messages: number
    crmMessages: number
    unansweredCount: number
    hotLeads: number
    warmLeads: number
    coldLeads: number
    unknownLeads: number
    poorConversations: number
    strongConversations: number
    hotUnanswered: number
    professionalStatus: string
    avgResponse: number | null
    inboundMessages: number
    outboundMessages: number
    rapportHits: number
    salesHits: number
}) {
    const statusLabel = professionalStatusLabel(params.professionalStatus)
    const poorPct = percentage(params.poorConversations, params.total)
    const unansweredPct = percentage(params.unansweredCount, params.total)
    const opportunity = params.hotLeads + params.warmLeads
    const opportunityPct = percentage(opportunity, params.total)
    const leadQualityReport = buildLeadQualityReport({
        total: params.total,
        hotLeads: params.hotLeads,
        warmLeads: params.warmLeads,
        coldLeads: params.coldLeads,
        unknownLeads: params.unknownLeads,
    })

    const strengths = [
        params.strongConversations > 0 ? `${params.strongConversations} conversa(s) ficaram com 80 pontos ou mais.` : null,
        params.avgResponse !== null && params.avgResponse <= 900 ? `Tempo medio de resposta dentro de uma faixa competitiva (${formatDurationBrief(params.avgResponse)}).` : null,
        opportunity > 0 ? `A instancia recebeu ${opportunity} lead(s) com algum sinal de oportunidade (${opportunityPct}% da base analisada).` : null,
        params.rapportHits > 0 ? `Foram encontrados sinais de rapport e acolhimento em mensagens do corretor.` : null,
        params.salesHits > 0 ? `A conversa teve sinais de conducoes comerciais como visita, valor, financiamento, bairro ou proposta.` : null,
    ].filter(Boolean) as string[]

    if (strengths.length === 0 && params.total > 0) {
        strengths.push('O principal ponto positivo e que ja existe base registrada para auditar o atendimento e acompanhar evolucao diaria.')
    }

    const improvementPoints = [
        params.unansweredCount > 0 ? `Retomar ${params.unansweredCount} conversa(s) que ficaram sem ultima resposta (${unansweredPct}% da base).` : null,
        params.hotUnanswered > 0 ? `Priorizar ${params.hotUnanswered} lead(s) quente(s) que ficaram sem retorno.` : null,
        params.poorConversations > 0 ? `Revisar ${params.poorConversations} conversa(s) abaixo de 60 pontos (${poorPct}% da base) para corrigir abordagem, rapport e fechamento.` : null,
        params.avgResponse !== null && params.avgResponse > 900 ? `Reduzir o tempo medio de resposta, hoje em ${formatDurationBrief(params.avgResponse)}.` : null,
        params.salesHits === 0 && params.outboundMessages > 0 ? 'Incluir perguntas objetivas sobre bairro, faixa de valor, prazo, forma de pagamento e agendamento.' : null,
        params.rapportHits === 0 && params.outboundMessages > 0 ? 'Melhorar acolhimento: demonstrar entendimento, confirmar necessidade e criar conexao antes de ofertar imoveis.' : null,
    ].filter(Boolean) as string[]

    if (improvementPoints.length === 0 && params.total > 0) {
        improvementPoints.push('Manter consistencia e acompanhar se o padrao se sustenta nos proximos dias.')
    }

    const coachingReport = params.total
        ? [
            `O atendimento foi classificado como ${statusLabel}.`,
            `Foram analisadas ${params.total} conversa(s), ${params.messages} mensagem(ns), ${params.inboundMessages} do lead e ${params.outboundMessages} do corretor/agente, incluindo ${params.crmMessages} mensagem(ns) internas/CRM ja gravadas.`,
            `O principal risco operacional e ${params.unansweredCount} conversa(s) sem resposta e ${params.poorConversations} conversa(s) ruins.`,
            leadQualityReport,
        ].join(' ')
        : 'Ainda nao ha base suficiente para avaliar postura profissional, qualidade dos leads ou pontos de melhoria desta instancia.'

    const summary = params.total
        ? `Parecer IA: atendimento ${statusLabel}, score ${params.score}/100. ${coachingReport}`
        : 'Nao havia mensagens importadas para o periodo selecionado. Rode a sincronizacao para ampliar a cobertura.'

    return {
        summary,
        strengths,
        improvement_points: improvementPoints,
        lead_quality_report: leadQualityReport,
        coaching_report: coachingReport,
        professional_status_label: statusLabel,
    }
}

export async function generateAttendanceReports(options: ReportOptions = {}) {
    const supabase = options.supabase || createAdminClient()
    const range = dayRange(options.date)
    const instances = (await loadInstances(supabase, options.instanceId)).filter((instance) => shouldReportInstance(instance, options.force, options.respectReportHour))
    const coachSettings = await loadAttendanceCoachSettings(supabase)
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
            raw: {
                ...(row.raw && typeof row.raw === 'object' ? row.raw : {}),
                attendance_source: row.source || 'whatsapp_message_history',
            },
        })) as NormalizedMessage[]
        const crmMessages = await fetchCrmConversationMessages(supabase, instance, range)
        const scopedPhones = new Set(
            [...messages, ...crmMessages]
                .map((message) => cleanPhone(message.phone || message.chatId))
                .filter(Boolean)
        )
        const [leadLogMessages, brokerConversationMessages] = await Promise.all([
            fetchLeadConversationLogMessages(supabase, instance, range, scopedPhones),
            fetchBrokerConversationMessages(supabase, instance, range),
        ])
        const mergedMessages = mergeUniqueMessages([...messages, ...crmMessages, ...leadLogMessages, ...brokerConversationMessages])
        const mergedCrmMessages = mergedMessages.filter((message) => message.raw?.attendance_source === 'crm_conversation')
        const mergedLeadLogMessages = mergedMessages.filter((message) => message.raw?.attendance_source === 'lead_conversation_log')
        const mergedBrokerConversationMessages = mergedMessages.filter((message) => message.raw?.attendance_source === 'broker_conversation')
        const mergedInternalMessages = [...mergedCrmMessages, ...mergedLeadLogMessages, ...mergedBrokerConversationMessages]
        const mergedUazapiMessages = mergedMessages.filter((message) =>
            !['crm_conversation', 'lead_conversation_log', 'broker_conversation'].includes(String(message.raw?.attendance_source || ''))
        )

        const { count: contactsCount } = await supabase
            .from('whatsapp_instance_contacts')
            .select('id', { count: 'exact', head: true })
            .eq('instance_id', instance.id)
        const { count: chatsCount } = await supabase
            .from('whatsapp_instance_chats')
            .select('id', { count: 'exact', head: true })
            .eq('instance_id', instance.id)

        const grouped = new Map<string, NormalizedMessage[]>()
        const leadNameByChat = new Map<string, string>()
        for (const msg of mergedMessages) {
            const list = grouped.get(msg.chatId) || []
            list.push(msg)
            grouped.set(msg.chatId, list)
            const leadName = typeof msg.raw?.lead_name === 'string' ? msg.raw.lead_name.trim() : ''
            if (leadName && !leadNameByChat.has(msg.chatId)) leadNameByChat.set(msg.chatId, leadName)
        }

        let conversationScores: ConversationScoreDraft[] = Array.from(grouped.entries()).map(([chatId, list]) => scoreConversation(chatId, list, leadNameByChat.get(chatId)))
        const coachCandidates = selectCoachCandidates(conversationScores, grouped, coachSettings.maxConversations)
        const coachResult = await runAttendanceCoachAnalysis({
            settings: coachSettings,
            ownerName: instance.instance_name || instance.phone_number || instance.id,
            reportDate: range.date,
            conversations: coachCandidates.map(toCoachInput),
        })
        if (coachResult.conversations.size > 0) {
            conversationScores = conversationScores.map((item) => mergeCoachAnalysis(item, coachResult.conversations.get(item.chat_id)))
        }
        const score = conversationScores.length
            ? Math.round(conversationScores.reduce((sum, item) => sum + item.score, 0) / conversationScores.length)
            : 0
        const unansweredCount = conversationScores.filter((item) => item.unanswered).length
        const hotLeads = conversationScores.filter((item) => item.lead_potential === 'hot').length
        const warmLeads = conversationScores.filter((item) => item.lead_potential === 'warm').length
        const coldLeads = conversationScores.filter((item) => item.lead_potential === 'cold').length
        const unknownLeads = conversationScores.filter((item) => item.lead_potential === 'unknown').length
        const poorConversations = conversationScores.filter((item) => item.score < 60).length
        const strongConversations = conversationScores.filter((item) => item.score >= 80).length
        const needsAttention = conversationScores.filter((item) => item.unanswered || item.score < 60).length
        const hotUnanswered = conversationScores.filter((item) => item.lead_potential === 'hot' && item.unanswered).length
        const llmAnalyzedConversations = conversationScores.filter((item) => item.metrics?.llm_analyzed === true).length
        const lostOpportunities = conversationScores.filter((item) => item.metrics?.lost_opportunity === true || item.metrics?.commercial_status === 'oportunidade_perdida').length
        const recoverableOpportunities = conversationScores.filter((item) => item.metrics?.recoverable === true).length
        const avgCoachMetric = (key: string) => {
            const values = conversationScores
                .map((item) => Number(item.metrics?.[key]))
                .filter((value) => Number.isFinite(value))
            return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null
        }
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
        const inboundMessages = mergedMessages.filter((m) => !m.fromMe).length
        const outboundMessages = mergedMessages.filter((m) => m.fromMe).length
        const rapportHits = conversationScores.reduce((sum, item) => sum + Number(item.metrics?.rapport_hits || 0), 0)
        const salesHits = conversationScores.reduce((sum, item) => sum + Number(item.metrics?.sales_hits || 0), 0)
        const narrative = buildAttendanceNarrative({
            score,
            total: conversationScores.length,
            messages: mergedMessages.length,
            crmMessages: mergedInternalMessages.length,
            unansweredCount,
            hotLeads,
            warmLeads,
            coldLeads,
            unknownLeads,
            poorConversations,
            strongConversations,
            hotUnanswered,
            professionalStatus,
            avgResponse,
            inboundMessages,
            outboundMessages,
            rapportHits,
            salesHits,
        })

        const recommendations = [
            unansweredCount > 0 ? `Retomar ${unansweredCount} conversa(s) que ficaram sem ultima resposta.` : null,
            hotLeads > 0 ? `Priorizar ${hotLeads} lead(s) com potencial alto.` : null,
            lostOpportunities > 0 ? `Revisar ${lostOpportunities} oportunidade(s) perdida(s) apontadas pela Helena Auditoria Comercial.` : null,
            recoverableOpportunities > 0 ? `Atacar ${recoverableOpportunities} conversa(s) recuperavel(is) com mensagem objetiva.` : null,
            avgResponse !== null && avgResponse > 900 ? 'Criar meta de primeira resposta abaixo de 15 minutos.' : null,
            'Usar perguntas de descoberta: bairro, faixa de valor, prazo, forma de pagamento e objetivo.',
            'Encerrar cada conversa ativa com proximo passo claro: visita, envio de opcoes ou retorno combinado.',
            ...(coachResult.summary?.recovery_actions || []),
            ...(coachResult.summary?.training_focus || []),
            ...narrative.improvement_points,
        ].filter(Boolean)

        const coverage = {
            contacts_synced: contactsCount || 0,
            chats_synced: chatsCount || 0,
            conversations_analyzed: conversationScores.length,
            messages_analyzed: mergedMessages.length,
            uazapi_messages_analyzed: mergedUazapiMessages.length,
            crm_messages_analyzed: mergedCrmMessages.length,
            lead_log_messages_analyzed: mergedLeadLogMessages.length,
            broker_conversation_messages_analyzed: mergedBrokerConversationMessages.length,
            internal_messages_analyzed: mergedInternalMessages.length,
            llm_agent_id: WHATSAPP_ATTENDANCE_COACH_AGENT_ID,
            llm_enabled: coachSettings.enabled,
            llm_candidate_conversations: coachCandidates.length,
            llm_conversations_analyzed: llmAnalyzedConversations,
            llm_errors: coachResult.errors,
            period_start: range.start,
            period_end: range.end,
        }
        const coachStrengths = uniqueTextList(coachResult.summary?.strengths, narrative.strengths)
        const coachImprovementPoints = uniqueTextList(coachResult.summary?.improvement_points, narrative.improvement_points)
        const coachTrainingFocus = uniqueTextList(coachResult.summary?.training_focus)
        const coachRecoveryActions = uniqueTextList(coachResult.summary?.recovery_actions)
        const coachExecutiveSummary = coachResult.summary?.executive_summary || narrative.coaching_report
        const metrics = {
            score,
            unanswered_conversations: unansweredCount,
            hot_leads: hotLeads,
            warm_leads: warmLeads,
            cold_leads: coldLeads,
            unknown_leads: unknownLeads,
            poor_conversations: poorConversations,
            strong_conversations: strongConversations,
            needs_attention: needsAttention,
            hot_unanswered_leads: hotUnanswered,
            professional_status: professionalStatus,
            professional_status_label: narrative.professional_status_label,
            avg_response_seconds: avgResponse,
            inbound_messages: inboundMessages,
            outbound_messages: outboundMessages,
            rapport_hits: rapportHits,
            sales_hits: salesHits,
            attendance_coach_agent_id: WHATSAPP_ATTENDANCE_COACH_AGENT_ID,
            attendance_coach_enabled: coachSettings.enabled,
            attendance_coach_conversations_analyzed: llmAnalyzedConversations,
            attendance_coach_candidate_conversations: coachCandidates.length,
            attendance_coach_errors: coachResult.errors,
            lost_opportunities: lostOpportunities,
            recoverable_opportunities: recoverableOpportunities,
            communication_quality_avg: avgCoachMetric('communication_quality'),
            response_quality_avg: avgCoachMetric('response_quality'),
            closing_quality_avg: avgCoachMetric('closing_quality'),
            empathy_quality_avg: avgCoachMetric('empathy_quality'),
            qualification_quality_avg: avgCoachMetric('qualification_quality'),
            training_focus: coachTrainingFocus,
            recovery_actions: coachRecoveryActions,
            strengths: coachStrengths,
            improvement_points: coachImprovementPoints,
            lead_quality_report: narrative.lead_quality_report,
            coaching_report: coachExecutiveSummary,
        }

        const summary = coachResult.summary?.executive_summary
            ? `Parecer IA: ${coachResult.summary.executive_summary}`
            : narrative.summary

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

        const { error: deleteScoresError } = await supabase
            .from('broker_attendance_conversation_scores')
            .delete()
            .eq('report_id', report.id)
        if (deleteScoresError) throw deleteScoresError

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
