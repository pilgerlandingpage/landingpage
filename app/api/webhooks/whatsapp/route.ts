import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { inngest } from '@/lib/inngest/client'
import { markAsRead, sendCarousel, sendLocationRequest, sendMenuMessage, sendPixButton, sendWhatsAppMessage, setPresenceAvailable } from '@/lib/uazapi'
import { uploadImageToR2 } from '@/lib/storage/r2'
import { appendLeadConversationLog, ensureWhatsAppLead, syncWhatsAppLeadSnapshot } from '@/lib/whatsapp/lead-sync'
import {
    buildAppointmentConfirmationText,
    detectConfirmedAppointment,
    extractAppointmentTimeFromText,
    generateAIResponse,
    getSaoPauloDate,
    loadAIConfigs,
    parseInteractiveElements,
    resolveSocialQuickReply,
    resolveRelativeAppointmentDate,
    saveDetectedAppointment,
    splitIntoHumanChunks,
    trackBotMessageId,
} from '@/lib/inngest/whatsapp-agent'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function safeSlug(input: string): string {
    return String(input || '')
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'unknown'
}

function extFromMime(mime?: string | null): string {
    const m = String(mime || '').toLowerCase()
    if (m.includes('jpeg') || m.includes('jpg')) return 'jpg'
    if (m.includes('png')) return 'png'
    if (m.includes('webp')) return 'webp'
    if (m.includes('gif')) return 'gif'
    if (m.includes('mp4')) return 'mp4'
    if (m.includes('mpeg') || m.includes('mp3')) return 'mp3'
    if (m.includes('ogg')) return 'ogg'
    if (m.includes('wav')) return 'wav'
    if (m.includes('pdf')) return 'pdf'
    if (m.includes('zip')) return 'zip'
    return 'bin'
}

const MAX_WEBHOOK_BODY_SIZE = 1024 * 1024
const MAX_AUDIT_STRING_SIZE = 2000
const MAX_AUDIT_ARRAY_ITEMS = 20
const MAX_AUDIT_OBJECT_KEYS = 60
const BOT_LOOP_PAUSE_DEFAULT_MINUTES = 60
const BOT_LOOP_WINDOW_MS = 30 * 60 * 1000

function compactAuditPayload(value: any, depth = 0): any {
    if (value == null) return value
    if (typeof value === 'string') {
        if (value.length <= MAX_AUDIT_STRING_SIZE) return value
        return `${value.slice(0, MAX_AUDIT_STRING_SIZE)}...[truncated ${value.length} chars]`
    }
    if (typeof value !== 'object') return value
    if (depth >= 4) return '[truncated depth]'
    if (Array.isArray(value)) {
        return value.slice(0, MAX_AUDIT_ARRAY_ITEMS).map((item) => compactAuditPayload(item, depth + 1))
    }

    const output: Record<string, any> = {}
    for (const key of Object.keys(value).slice(0, MAX_AUDIT_OBJECT_KEYS)) {
        output[key] = compactAuditPayload(value[key], depth + 1)
    }
    return output
}

function isConfigEnabled(value: unknown, defaultEnabled = true): boolean {
    if (value === undefined || value === null) return defaultEnabled
    return value !== false && value !== 'false' && value !== '0'
}

function normalizeLoopText(value: unknown): string {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/https?:\/\/\S+/g, ' link ')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function parseMessageTimestamp(value: unknown): number {
    const time = new Date(String(value || '')).getTime()
    return Number.isFinite(time) ? time : 0
}

function analyzeBotLoopRisk(messages: any[], nowMs = Date.now()): { detected: boolean; reason: string } {
    const recent = (Array.isArray(messages) ? messages : [])
        .map((message) => ({
            role: String(message?.role || ''),
            content: String(message?.content || ''),
            normalized: normalizeLoopText(message?.content),
            timestampMs: parseMessageTimestamp(message?.timestamp),
        }))
        .filter((message) => message.timestampMs > 0 && nowMs - message.timestampMs <= BOT_LOOP_WINDOW_MS)
        .slice(-30)

    const userMessages = recent.filter((message) => message.role === 'user' && message.normalized)
    const assistantMessages = recent.filter((message) => message.role === 'assistant' && message.normalized)
    if (userMessages.length < 3 || assistantMessages.length < 2) {
        return { detected: false, reason: '' }
    }

    const frequency = new Map<string, number>()
    for (const message of userMessages) {
        if (message.normalized.length < 2) continue
        frequency.set(message.normalized, (frequency.get(message.normalized) || 0) + 1)
    }
    const repeatedUserText = Math.max(0, ...Array.from(frequency.values()))

    const automatedPatterns = [
        /\bsou (um |uma )?(assistente|atendente|chatbot|bot|agente virtual)\b/,
        /\batendimento automatico\b/,
        /\bmensagem automatica\b/,
        /\bnao entendi\b/,
        /\bescolha uma opcao\b/,
        /\bdigite\s+\d+\b/,
        /\bmenu principal\b/,
        /\bcomo posso ajudar\b/,
        /\bestou aqui para ajudar\b/,
    ]
    const automatedPhraseHits = userMessages
        .slice(-8)
        .filter((message) => automatedPatterns.some((pattern) => pattern.test(message.normalized)))
        .length

    const last90sUserMessages = userMessages.filter((message) => nowMs - message.timestampMs <= 90 * 1000).length

    let rapidAssistantToUserReplies = 0
    let alternations = 0
    for (let index = 1; index < recent.length; index++) {
        const previous = recent[index - 1]
        const current = recent[index]
        if (previous.role && current.role && previous.role !== current.role) alternations++
        if (previous.role === 'assistant' && current.role === 'user') {
            const gapMs = current.timestampMs - previous.timestampMs
            if (gapMs >= 0 && gapMs <= 7000) rapidAssistantToUserReplies++
        }
    }

    if (last90sUserMessages >= 8) {
        return { detected: true, reason: 'muitas_mensagens_em_90s' }
    }
    if (repeatedUserText >= 4) {
        return { detected: true, reason: 'texto_repetido_pelo_contato' }
    }
    if (automatedPhraseHits >= 2) {
        return { detected: true, reason: 'frases_de_atendimento_automatico' }
    }
    if (
        rapidAssistantToUserReplies >= 3 &&
        alternations >= 6 &&
        (automatedPhraseHits >= 1 || repeatedUserText >= 2 || recent.length >= 14)
    ) {
        return { detected: true, reason: 'ping_pong_automatico_rapido' }
    }
    if (assistantMessages.length >= 10 && userMessages.length >= 10 && rapidAssistantToUserReplies >= 2) {
        return { detected: true, reason: 'muitas_rodadas_automaticas' }
    }

    return { detected: false, reason: '' }
}

function mergeWhatsappMetadata(current: unknown, patch: Record<string, unknown>) {
    const base = current && typeof current === 'object' && !Array.isArray(current) ? current as Record<string, any> : {}
    const whatsapp = base.whatsapp && typeof base.whatsapp === 'object' && !Array.isArray(base.whatsapp)
        ? base.whatsapp as Record<string, any>
        : {}

    return {
        ...base,
        whatsapp: {
            ...whatsapp,
            ...patch,
        },
    }
}

function normalizePresencePhone(value: unknown): string {
    return String(value || '').replace(/@.+$/, '').replace(/\D/g, '')
}

function extractPresencePayload(body: any, messageData: any) {
    const source = messageData && typeof messageData === 'object' ? messageData : {}
    const rawJid = source.id
        || source.jid
        || source.chatid
        || source.chatId
        || source.from
        || source.remoteJid
        || source.participant
        || source.sender
        || body?.jid
        || body?.chatid
        || body?.from
        || body?.phone
        || ''
    const phone = normalizePresencePhone(source.phone || rawJid)
    const presence = String(
        source.presence
        || source.status
        || source.type
        || source.lastKnownPresence
        || body?.presence
        || body?.status
        || ''
    ).toLowerCase()
    const lastSeenRaw = source.lastSeen || source.last_seen || source.lastSeenAt || source.last_seen_at || null
    const lastSeenAt = lastSeenRaw && !Number.isNaN(new Date(String(lastSeenRaw)).getTime())
        ? new Date(String(lastSeenRaw)).toISOString()
        : null
    const onlineValues = new Set(['available', 'online', 'composing', 'recording'])
    const offlineValues = new Set(['unavailable', 'offline', 'paused'])
    const isOnline = onlineValues.has(presence)
        ? true
        : offlineValues.has(presence)
            ? false
            : Boolean(source.isOnline ?? source.online ?? false)

    return {
        phone,
        jid: String(rawJid || ''),
        presence: presence || (isOnline ? 'online' : 'unknown'),
        isOnline,
        lastSeenAt,
    }
}

async function savePresenceEvent(params: {
    supabase: ReturnType<typeof getSupabase>
    instanceName: string
    body: any
    messageData: any
}) {
    const { supabase, instanceName, body, messageData } = params
    const presence = extractPresencePayload(body, messageData)
    if (!presence.phone) return { tracked: false, reason: 'missing_phone' }

    let instance: any = null
    if (instanceName) {
        const { data } = await supabase
            .from('whatsapp_instances')
            .select('id, broker_id')
            .eq('instance_name', instanceName)
            .maybeSingle()
        instance = data
    }

    const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .or(`phone.eq.${presence.phone},phone_e164.eq.${presence.phone}`)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    const now = new Date().toISOString()
    const row = {
        instance_id: instance?.id || null,
        broker_id: instance?.broker_id || null,
        lead_id: lead?.id || null,
        phone: presence.phone,
        jid: presence.jid || null,
        presence: presence.presence,
        is_online: presence.isOnline,
        last_online_at: presence.isOnline ? now : undefined,
        last_seen_at: presence.lastSeenAt || (!presence.isOnline ? now : undefined),
        last_event_at: now,
        raw_payload: compactAuditPayload(body),
        updated_at: now,
    }

    if (instance?.id) {
        const { data: existing } = await supabase
            .from('whatsapp_contact_presence')
            .select('id, last_online_at')
            .eq('instance_id', instance.id)
            .eq('phone', presence.phone)
            .maybeSingle()

        if (existing?.id) {
            await supabase
                .from('whatsapp_contact_presence')
                .update({
                    ...row,
                    last_online_at: presence.isOnline ? now : existing.last_online_at,
                })
                .eq('id', existing.id)
        } else {
            await supabase
                .from('whatsapp_contact_presence')
                .insert({
                    ...row,
                    created_at: now,
                })
        }
    } else {
        await supabase
            .from('whatsapp_contact_presence')
            .insert({
                ...row,
                created_at: now,
            })
    }

    return { tracked: true, phone: presence.phone, presence: presence.presence, isOnline: presence.isOnline }
}

async function enforceBotLoopProtection(params: {
    supabase: ReturnType<typeof getSupabase>
    leadId?: string | null
    instance: any
    phone: string
}): Promise<{ blocked: boolean; reason: string }> {
    const { supabase, leadId, instance, phone } = params
    if (!leadId) return { blocked: false, reason: '' }

    const config = instance?.config || {}
    if (!isConfigEnabled(config.bot_loop_protection_enabled, true)) {
        return { blocked: false, reason: '' }
    }

    const { data: lead } = await supabase
        .from('leads')
        .select('id, metadata, conversation_log')
        .eq('id', leadId)
        .maybeSingle()

    const now = Date.now()
    const botLoop = (lead?.metadata as any)?.whatsapp?.bot_loop
    const pausedUntilMs = parseMessageTimestamp(botLoop?.paused_until)
    if (pausedUntilMs > now) {
        return { blocked: true, reason: 'bot_loop_pause_active' }
    }

    const analysis = analyzeBotLoopRisk(lead?.conversation_log || [], now)
    if (!analysis.detected) return { blocked: false, reason: '' }

    const rawPauseMinutes = Number(config.bot_loop_pause_minutes || config.human_intervention_minutes || BOT_LOOP_PAUSE_DEFAULT_MINUTES)
    const pauseMinutes = Math.min(1440, Math.max(5, Number.isFinite(rawPauseMinutes) ? Math.floor(rawPauseMinutes) : BOT_LOOP_PAUSE_DEFAULT_MINUTES))
    const detectedAt = new Date(now).toISOString()
    const pausedUntil = new Date(now + pauseMinutes * 60 * 1000).toISOString()

    await supabase
        .from('leads')
        .update({
            metadata: mergeWhatsappMetadata(lead?.metadata, {
                bot_loop: {
                    detected_at: detectedAt,
                    paused_until: pausedUntil,
                    reason: analysis.reason,
                    instance_id: instance?.id || null,
                    instance_name: instance?.instance_name || null,
                },
            }),
            updated_at: detectedAt,
        })
        .eq('id', leadId)

    if (instance?.broker_id) {
        await supabase
            .from('whatsapp_ai_conversations')
            .update({
                status: 'human_takeover',
                human_takeover_at: detectedAt,
                updated_at: detectedAt,
            })
            .eq('broker_id', instance.broker_id)
            .eq('lead_phone', phone)
            .in('status', ['active', 'transferred'])
    }

    return { blocked: true, reason: analysis.reason }
}

function normalizePhoneDigits(value: any): string {
    return String(value || '').replace(/\D/g, '')
}

function normalizeOutboundBrazilPhone(value: any): string {
    let digits = normalizePhoneDigits(value)
    if (!digits) return ''
    if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
        digits = `55${digits}`
    }
    return digits
}

function phonesLookSame(a: any, b: any): boolean {
    const left = normalizePhoneDigits(a)
    const right = normalizePhoneDigits(b)
    if (!left || !right) return false
    return left === right || left.slice(-8) === right.slice(-8)
}

function formatAppointmentDatePt(dateKey: string): string {
    const date = new Date(`${dateKey}T12:00:00-03:00`)
    return date.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    })
}

async function notifyHumanAboutPendingAppointment(params: {
    supabase: ReturnType<typeof getSupabase>
    instance: any
    broker: any
    leadPhone: string
    senderName?: string | null
    appointment: { date: string; time: string }
}) {
    const { supabase, instance, broker, leadPhone, senderName, appointment } = params
    const blockedPhones = [leadPhone, instance?.phone_number, instance?.live_data?.phone, broker?.phone]
    const candidates: Array<{ phone?: string | null; label: string }> = [
        { phone: broker?.transfer_to_phone, label: 'broker_transfer_to_phone' },
        { phone: broker?.summary_to_phone, label: 'broker_summary_to_phone' },
    ]

    const adminIds = Array.from(new Set([
        instance?.admin_user_id,
        broker?.admin_user_id,
    ].filter((id: any) => id && String(id) !== '00000000-0000-0000-0000-000000000000')))

    if (adminIds.length > 0) {
        const { data: admins } = await supabase
            .from('admin_users')
            .select('id, phone')
            .in('id', adminIds as string[])
        for (const admin of admins || []) {
            candidates.push({ phone: admin?.phone, label: `admin_user:${admin?.id}` })
        }
    }

    const target = candidates
        .map(candidate => ({
            ...candidate,
            phone: normalizeOutboundBrazilPhone(candidate.phone),
        }))
        .find(candidate =>
            candidate.phone
            && !blockedPhones.some(blocked => phonesLookSame(candidate.phone, blocked))
        )

    if (!target?.phone) {
        console.warn('[Appointment] Pending appointment created without human notification target', {
            broker_id: broker?.id,
            instance_id: instance?.id,
        })
        return { sent: false, reason: 'no_human_target' as const }
    }

    const dateLabel = formatAppointmentDatePt(appointment.date)
    const leadLabel = senderName ? `${senderName} (${leadPhone})` : leadPhone
    const message = [
        'Pedido de visita para confirmar',
        '',
        `Lead: ${leadLabel}`,
        `Agente IA: ${broker?.name || instance?.instance_name || 'Agente IA'}`,
        `Data: ${dateLabel}`,
        `Horario: ${appointment.time}`,
        '',
        'Confirme no painel da agenda se esse horario esta disponivel. O lead ja foi avisado que estamos verificando.'
    ].join('\n')

    const result = await sendWhatsAppMessage({
        phone: target.phone,
        message,
        instanceToken: instance.instance_token,
    })

    return {
        sent: true,
        reason: target.label,
        targetPhone: target.phone,
        result,
    }
}

function normalizeAssistantText(text: string): string {
    return String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
}

function isAssistantConfirmationText(text: string): boolean {
    return /\b(sim|confirmo|confirma|pode|pode marcar|pode criar|isso|isso mesmo|ok|fechado|perfeito|confirmado)\b/.test(normalizeAssistantText(text))
}

function isAssistantCancelText(text: string): boolean {
    return /\b(nao|não|cancela|cancelar|deixa|esquece|volta|errado)\b/.test(normalizeAssistantText(text))
}

function parseAssistantAgendaCommand(text: string) {
    const normalized = normalizeAssistantText(text)
    const looksLikeAgenda =
        /(agenda|agendar|marca|marque|marcar|coloca|coloque|reuniao|visita|compromisso|bloqueia|bloquear)/.test(normalized)
    if (!looksLikeAgenda) return null

    const date = resolveRelativeAppointmentDate(text, getSaoPauloDate())
    const time = extractAppointmentTimeFromText(text)
    if (!date || !time) {
        return { incomplete: true as const, date, time }
    }

    const leadMatch = text.match(/\b(?:lead|cliente)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,40}?)(?=\s+(?:hoje|amanh[aã]|depois|dia|\d|as|às|na|no|para|por|$))/i)
        || text.match(/\bcom\s+(?:o\s+lead\s+|a\s+lead\s+|cliente\s+)?([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,40}?)(?=\s+(?:hoje|amanh[aã]|depois|dia|\d|as|às|na|no|para|por|$))/i)

    const leadName = leadMatch?.[1]?.trim().replace(/\s+/g, ' ') || null
    const type = normalized.includes('visita') ? 'visita' : normalized.includes('bloque') ? 'bloqueio' : 'reuniao'
    const title = leadName
        ? `${type === 'visita' ? 'Visita' : type === 'bloqueio' ? 'Bloqueio' : 'Reuniao'} com ${leadName}`
        : type === 'bloqueio'
            ? 'Bloqueio de agenda'
            : type === 'visita'
                ? 'Visita'
                : 'Reuniao'

    return {
        incomplete: false as const,
        date,
        time,
        leadName,
        type,
        title,
        requestedText: text,
    }
}

async function findAssistantAuthorization(params: {
    supabase: ReturnType<typeof getSupabase>
    brokerId: string
    phone: string
}) {
    const { supabase, brokerId, phone } = params
    const normalized = normalizeOutboundBrazilPhone(phone)
    const raw = normalizePhoneDigits(phone)
    const withoutBrazil = normalized.startsWith('55') ? normalized.slice(2) : ''
    const candidates = Array.from(new Set([normalized, raw, withoutBrazil].filter(Boolean)))
    if (!candidates.length) return null

    try {
        const { data, error } = await supabase
            .from('broker_assistant_authorized_phones')
            .select('*')
            .eq('broker_id', brokerId)
            .eq('is_active', true)
            .in('phone', candidates)
            .limit(1)

        if (error) {
            console.warn('[Broker Assistant] Authorization lookup skipped:', error.message)
            return null
        }
        return data?.[0] || null
    } catch (error) {
        console.warn('[Broker Assistant] Authorization lookup failed:', error)
        return null
    }
}

async function getOrCreateAssistantConversation(params: {
    supabase: ReturnType<typeof getSupabase>
    brokerId: string
    phone: string
    authorizedPhoneId: string
}) {
    const { supabase, brokerId, phone, authorizedPhoneId } = params
    const { data: existing } = await supabase
        .from('broker_assistant_conversations')
        .select('*')
        .eq('broker_id', brokerId)
        .eq('phone', phone)
        .maybeSingle()

    if (existing) return existing

    const { data, error } = await supabase
        .from('broker_assistant_conversations')
        .insert({
            broker_id: brokerId,
            authorized_phone_id: authorizedPhoneId,
            phone,
            messages: [],
            state: {},
        })
        .select()
        .single()

    if (error) throw error
    return data
}

async function updateAssistantConversation(params: {
    supabase: ReturnType<typeof getSupabase>
    conversationId: string
    messages: any[]
    state: any
}) {
    const { supabase, conversationId, messages, state } = params
    await supabase
        .from('broker_assistant_conversations')
        .update({
            messages: messages.slice(-80),
            state: state || {},
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
}

async function brokerAgendaSlotHasConflict(params: {
    supabase: ReturnType<typeof getSupabase>
    brokerId: string
    date: string
    time: string
}) {
    const { supabase, brokerId, date, time } = params
    const { data } = await supabase
        .from('appointments')
        .select('id, lead_name, appointment_type, status')
        .eq('broker_id', brokerId)
        .eq('appointment_date', date)
        .eq('appointment_time', time)
        .not('status', 'in', '("cancelled","expirado")')
        .limit(1)
    return data?.[0] || null
}

async function createAssistantAppointment(params: {
    supabase: ReturnType<typeof getSupabase>
    broker: any
    assistantPhone: string
    pending: any
}) {
    const { supabase, broker, assistantPhone, pending } = params
    const scheduledStartAt = `${pending.date}T${pending.time}:00-03:00`
    const end = new Date(scheduledStartAt)
    end.setMinutes(end.getMinutes() + 60)

    const payload = {
        lead_phone: pending.lead_phone || assistantPhone,
        lead_name: pending.leadName || pending.title || 'Compromisso do corretor',
        broker_id: broker?.id || null,
        admin_user_id: broker?.admin_user_id || null,
        appointment_date: pending.date,
        appointment_time: pending.time,
        appointment_type: pending.type || 'reuniao',
        property_title: pending.propertyTitle || null,
        status: 'confirmed',
        source: 'broker_assistant',
        scheduled_start_at: scheduledStartAt,
        scheduled_end_at: end.toISOString(),
        notes: pending.requestedText || null,
        metadata: {
            created_from: 'broker_assistant',
            assistant_phone: assistantPhone,
            requested_text: pending.requestedText || null,
        },
    }

    const { data, error } = await supabase
        .from('appointments')
        .insert([payload])
        .select()
        .single()

    if (error) throw error
    return data
}

async function handleBrokerAssistantMessage(params: {
    supabase: ReturnType<typeof getSupabase>
    instance: any
    brokerId: string
    phone: string
    text: string
    senderName?: string | null
}) {
    const { supabase, instance, brokerId, phone, text, senderName } = params
    const inputText = String(text || '').trim()
    if (!brokerId || !inputText) return { handled: false, reason: 'empty' }

    const authorization = await findAssistantAuthorization({ supabase, brokerId, phone })
    if (!authorization?.id) return { handled: false, reason: 'not_authorized_assistant_phone' }

    const { data: broker } = await supabase
        .from('virtual_brokers')
        .select('*')
        .eq('id', brokerId)
        .maybeSingle()

    const conversation = await getOrCreateAssistantConversation({
        supabase,
        brokerId,
        phone: normalizeOutboundBrazilPhone(phone),
        authorizedPhoneId: authorization.id,
    })

    const messages = Array.isArray(conversation?.messages) ? conversation.messages : []
    const state = conversation?.state && typeof conversation.state === 'object' ? conversation.state : {}
    const nextMessages = [...messages, {
        role: 'broker',
        content: inputText,
        sender_name: senderName || authorization.name || null,
        timestamp: new Date().toISOString(),
    }]

    const sendAssistantReply = async (reply: string, nextState: any) => {
        nextMessages.push({
            role: 'assistant',
            content: reply,
            timestamp: new Date().toISOString(),
        })
        await updateAssistantConversation({
            supabase,
            conversationId: conversation.id,
            messages: nextMessages,
            state: nextState,
        })
        await sendWhatsAppMessage({
            phone,
            message: reply,
            instanceToken: instance.instance_token,
        })
        return { handled: true, reason: 'broker_assistant' }
    }

    const pending = state?.pending_action
    if (pending?.assistant_action === 'create_appointment') {
        if (isAssistantCancelText(inputText)) {
            return sendAssistantReply('Sem problema, cancelei essa solicitação antes de gravar na agenda.', {
                ...state,
                pending_action: null,
            })
        }

        if (!isAssistantConfirmationText(inputText)) {
            return sendAssistantReply('Tenho uma ação aguardando confirmação. Me responde com "sim" para gravar ou "cancelar" para descartar.', state)
        }

        try {
            const conflict = await brokerAgendaSlotHasConflict({
                supabase,
                brokerId,
                date: pending.date,
                time: pending.time,
            })
            if (conflict) {
                return sendAssistantReply(`Não gravei porque já existe um compromisso nesse horário (${formatAppointmentDatePt(pending.date)}, ${pending.time}). Quer que eu marque em outro horário?`, {
                    ...state,
                    pending_action: null,
                })
            }

            const appointment = await createAssistantAppointment({
                supabase,
                broker,
                assistantPhone: normalizeOutboundBrazilPhone(phone),
                pending,
            })

            if (pending.action_id) {
                await supabase
                    .from('broker_assistant_actions')
                    .update({
                        status: 'executed',
                        confirmed_at: new Date().toISOString(),
                        executed_at: new Date().toISOString(),
                        result: { appointment_id: appointment.id },
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', pending.action_id)
            }

            return sendAssistantReply(`Feito. Registrei ${pending.title || 'o compromisso'} na sua agenda para ${formatAppointmentDatePt(pending.date)}, as ${pending.time}.`, {
                ...state,
                pending_action: null,
            })
        } catch (error) {
            console.error('[Broker Assistant] Failed to create appointment:', error)
            return sendAssistantReply('Tentei gravar na agenda, mas encontrei um erro. Vou deixar registrado que essa ação precisa ser revisada no painel.', {
                ...state,
                pending_action: null,
            })
        }
    }

    const parsed = parseAssistantAgendaCommand(inputText)
    if (!parsed) {
        return sendAssistantReply('Estou no modo assistente. Por enquanto consigo criar compromissos na agenda. Exemplo: "marca reunião com o lead João amanhã às 15h".', state)
    }

    if (parsed.incomplete) {
        const missing = [
            !parsed.date ? 'data' : '',
            !parsed.time ? 'horário' : '',
        ].filter(Boolean).join(' e ')
        return sendAssistantReply(`Consigo fazer isso, mas preciso que você me diga ${missing}. Exemplo: "amanhã às 15h".`, state)
    }

    const conflict = await brokerAgendaSlotHasConflict({
        supabase,
        brokerId,
        date: parsed.date,
        time: parsed.time,
    })
    if (conflict) {
        return sendAssistantReply(`Esse horário já tem um compromisso na sua agenda (${formatAppointmentDatePt(parsed.date)}, ${parsed.time}). Quer me passar outro horário?`, state)
    }

    const { data: action } = await supabase
        .from('broker_assistant_actions')
        .insert({
            conversation_id: conversation.id,
            broker_id: brokerId,
            authorized_phone_id: authorization.id,
            action_type: 'create_appointment',
            status: 'pending',
            payload: parsed,
        })
        .select()
        .single()

    const nextState = {
        ...state,
        pending_action: {
            ...parsed,
            assistant_action: 'create_appointment',
            action_id: action?.id || null,
        },
    }

    return sendAssistantReply([
        `Entendi. Vou registrar ${parsed.title} para ${formatAppointmentDatePt(parsed.date)}, as ${parsed.time}.`,
        'Confirma que posso gravar na sua agenda?'
    ].join('\n\n'), nextState)
}

async function tryFastTextBrokerResponse(params: {
    supabase: ReturnType<typeof getSupabase>
    instance: any
    phone: string
    text: string
    messageId?: string | null
    messageType?: string | null
    senderName?: string | null
}): Promise<{ handled: boolean; reason: string; responseLength?: number }> {
    const { supabase, instance, phone, text, messageId, messageType, senderName } = params
    const inputText = String(text || '').trim()
    if (!instance?.broker_id || !inputText) return { handled: false, reason: 'not_fast_candidate' }

    const configs = await loadAIConfigs(supabase, instance.id)
    if (configs['whatsapp_smart_timing_enabled'] !== 'false') return { handled: false, reason: 'smart_timing_enabled' }
    const debounceSeconds = Math.max(1, parseInt(configs['whatsapp_debounce_seconds'] || '15', 10) || 15)
    if (debounceSeconds > 5) return { handled: false, reason: 'debounce_above_fast_threshold' }
    if (configs['whatsapp_agent_enabled'] === 'false') return { handled: false, reason: 'agent_disabled' }
    if (configs['whatsapp_ai_schedule_enabled'] === 'true') return { handled: false, reason: 'schedule_requires_inngest' }

    const { data: broker } = await supabase
        .from('virtual_brokers')
        .select('*')
        .eq('id', instance.broker_id)
        .single()
    if (!broker?.is_active) return { handled: false, reason: 'no_active_broker' }

    const { data: existing } = await supabase
        .from('whatsapp_ai_conversations')
        .select('*')
        .eq('broker_id', broker.id)
        .eq('lead_phone', phone)
        .in('status', ['active', 'human_takeover', 'transferred'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    let conversation = existing
    if (conversation?.status === 'human_takeover' && configs['whatsapp_human_intervention'] !== 'false') {
        const interventionMinutes = parseInt(configs['whatsapp_human_intervention_minutes'] || '60', 10)
        const takeoverAt = conversation.human_takeover_at
        const elapsedMinutes = takeoverAt ? (Date.now() - new Date(takeoverAt).getTime()) / 60000 : 0
        if (!takeoverAt || elapsedMinutes < interventionMinutes) {
            return { handled: false, reason: 'human_takeover' }
        }
        await supabase
            .from('whatsapp_ai_conversations')
            .update({ status: 'active', human_takeover_at: null, updated_at: new Date().toISOString() })
            .eq('id', conversation.id)
        conversation = { ...conversation, status: 'active', human_takeover_at: null }
    }

    if (conversation?.status === 'transferred') {
        await supabase
            .from('whatsapp_ai_conversations')
            .update({ status: 'active', updated_at: new Date().toISOString() })
            .eq('id', conversation.id)
        conversation = { ...conversation, status: 'active' }
    }

    if (!conversation) {
        const { data: created } = await supabase
            .from('whatsapp_ai_conversations')
            .insert({
                broker_id: broker.id,
                instance_id: instance.id,
                lead_phone: phone,
                messages: [],
                bot_message_ids: [],
                status: 'active',
            })
            .select()
            .single()
        conversation = created
    }

    if (!conversation) return { handled: false, reason: 'conversation_unavailable' }

    try {
        await supabase
            .from('app_config')
            .delete()
            .like('key', `_pmq_${phone}_%`)
    } catch { /* ignore stale debounce cleanup failures */ }

    const historyMessages = (Array.isArray(conversation.messages) ? conversation.messages : [])
        .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')

    const updatedMessages = [...historyMessages, {
        role: 'user',
        content: inputText,
        type: messageType || 'text',
        source: 'lead',
        message_id: messageId || null,
        instance_id: instance.id,
        broker_id: broker.id,
        timestamp: new Date().toISOString(),
    }]

    const confirmedAppointment = detectConfirmedAppointment(updatedMessages)
    const confirmedAppointmentResult = confirmedAppointment
        ? await saveDetectedAppointment({
            supabase,
            appointment: confirmedAppointment,
            broker,
            leadPhone: phone,
            senderName,
            propertyTitle: null,
            createdFrom: 'fast_webhook_lead_confirmation',
        })
        : null

    if (confirmedAppointment && confirmedAppointmentResult === 'created') {
        await notifyHumanAboutPendingAppointment({
            supabase,
            instance,
            broker,
            leadPhone: phone,
            senderName,
            appointment: confirmedAppointment,
        }).catch(error => {
            console.warn('[Appointment] Human notification failed:', error?.message || error)
        })
    }

    const quickSocialReply = !confirmedAppointment ? resolveSocialQuickReply(inputText, configs) : null
    const aiResponse = confirmedAppointment && confirmedAppointmentResult !== 'failed'
        ? {
            text: buildAppointmentConfirmationText(confirmedAppointment),
            shouldTransfer: false,
            extractedData: {
                appointment_created_from_marker: confirmedAppointmentResult,
                appointment_date: confirmedAppointment.date,
                appointment_time: confirmedAppointment.time,
            } as any,
        }
        : quickSocialReply
            ? { text: quickSocialReply, shouldTransfer: false, extractedData: undefined as any }
            : await generateAIResponse(configs, broker, updatedMessages, senderName || undefined, phone)

    updatedMessages.push({
        role: 'assistant',
        content: aiResponse.text,
        type: 'text',
        source: quickSocialReply ? 'quick_reply' : 'agent',
        instance_id: instance.id,
        broker_id: broker.id,
        timestamp: new Date().toISOString(),
    })

    await supabase
        .from('whatsapp_ai_conversations')
        .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
        .eq('id', conversation.id)

    setPresenceAvailable(instance.instance_token, phone).catch(() => null)

    const interactive = parseInteractiveElements(aiResponse.text)
    const { cleanText, buttons, urlButtons, list, poll, locationRequest, pix, carousel } = interactive
    let botMessageIds: string[] = Array.isArray(conversation.bot_message_ids) ? conversation.bot_message_ids : []
    const sendTextRespectingSplit = async (message: string) => {
        const textToSend = String(message || '').trim()
        if (!textToSend) return null

        const splitEnabled = configs['whatsapp_split_messages'] !== 'false'
        const chunks = splitEnabled && textToSend.length > 120
            ? splitIntoHumanChunks(textToSend)
            : [textToSend]

        let lastResult: any = null
        for (let index = 0; index < chunks.length; index++) {
            if (index > 0) {
                await new Promise(resolve => setTimeout(resolve, Math.min(1800 + chunks[index].length * 18, 3500)))
            }
            lastResult = await sendWhatsAppMessage({
                phone,
                message: chunks[index],
                instanceToken: instance.instance_token,
            })
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, lastResult)
        }
        return lastResult
    }

    if (urlButtons && urlButtons.items.length > 0) {
        try {
            const sendResult = await sendMenuMessage({
                phone,
                text: cleanText || urlButtons.title || 'Acesse o link abaixo:',
                type: 'button',
                choices: urlButtons.items.map(item => `${item.text}|url:${item.url}`),
                instanceToken: instance.instance_token,
            })
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        } catch {
            const linksText = urlButtons.items.map(i => `${i.text}: ${i.url}`).join('\n')
            const sendResult = await sendWhatsAppMessage({
                phone,
                message: `${cleanText ? cleanText + '\n\n' : ''}${linksText}`,
                instanceToken: instance.instance_token,
            })
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        }
    } else if (buttons && buttons.options.length > 0) {
        try {
            const sendResult = await sendMenuMessage({
                phone,
                text: cleanText || buttons.title,
                type: 'button',
                choices: buttons.options.slice(0, 3).map(opt => opt.substring(0, 20)),
                instanceToken: instance.instance_token,
            })
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        } catch {
            await sendTextRespectingSplit(cleanText || aiResponse.text)
        }
    } else if (list && list.sections.length > 0) {
        try {
            const choices: string[] = []
            for (const section of list.sections) {
                choices.push(`[${section.title}]`)
                for (const row of section.rows) {
                    choices.push(row.description ? `${row.title}|${row.id}|${row.description}` : row.title)
                }
            }
            const sendResult = await sendMenuMessage({
                phone,
                text: cleanText || 'Escolha uma opção:',
                type: 'list',
                choices,
                listButton: list.buttonText,
                instanceToken: instance.instance_token,
            })
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        } catch {
            const fallbackText = list.sections.map(section =>
                `*${section.title}*\n${section.rows.map((row, index) => `${index + 1}. ${row.title}${row.description ? ` - ${row.description}` : ''}`).join('\n')}`
            ).join('\n\n')
            const sendResult = await sendWhatsAppMessage({ phone, message: `${cleanText ? cleanText + '\n\n' : ''}${fallbackText}`, instanceToken: instance.instance_token })
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        }
    } else if (poll && poll.options.length >= 2) {
        try {
            if (cleanText) await sendWhatsAppMessage({ phone, message: cleanText, instanceToken: instance.instance_token })
            const sendResult = await sendMenuMessage({
                phone,
                text: poll.question,
                type: 'poll',
                choices: poll.options,
                selectableCount: poll.multiSelect ? poll.options.length : 1,
                instanceToken: instance.instance_token,
            })
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        } catch {
            const fallbackText = `${poll.question}\n\n${poll.options.map((option, index) => `${index + 1}. ${option}`).join('\n')}`
            const sendResult = await sendWhatsAppMessage({ phone, message: `${cleanText ? cleanText + '\n\n' : ''}${fallbackText}`, instanceToken: instance.instance_token })
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        }
    } else if (locationRequest) {
        try {
            if (cleanText) await sendWhatsAppMessage({ phone, message: cleanText, instanceToken: instance.instance_token })
            const sendResult = await sendLocationRequest(phone, cleanText || 'Pode compartilhar sua localização?', instance.instance_token)
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        } catch {
            const sendResult = await sendWhatsAppMessage({ phone, message: cleanText || 'Pode nos informar sua localização por texto?', instanceToken: instance.instance_token })
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        }
    } else if (pix) {
        try {
            if (cleanText) await sendWhatsAppMessage({ phone, message: cleanText, instanceToken: instance.instance_token })
            const sendResult = await sendPixButton(phone, pix.pixKey, pix.pixName, pix.pixType === 'EVP' ? 'RANDOM' : pix.pixType, instance.instance_token)
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        } catch {
            const sendResult = await sendWhatsAppMessage({ phone, message: cleanText || `Chave PIX: ${pix.pixKey}`, instanceToken: instance.instance_token })
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        }
    } else if (carousel && carousel.cards.length > 0) {
        try {
            const sendResult = await sendCarousel(phone, cleanText || carousel.text, carousel.cards, instance.instance_token)
            botMessageIds = await trackBotMessageId(supabase, conversation.id, botMessageIds, sendResult)
        } catch {
            await sendTextRespectingSplit(cleanText || carousel.text)
        }
    } else {
        await sendTextRespectingSplit(cleanText || aiResponse.text)
    }

    await syncWhatsAppLeadSnapshot(supabase, {
        phone,
        senderName: senderName || undefined,
        instanceId: instance.id,
        instanceName: instance.instance_name,
        brokerId: broker.id,
        acquiredVia: 'whatsapp',
        messages: updatedMessages,
        extractedData: aiResponse.extractedData || null,
        shouldTransfer: aiResponse.shouldTransfer,
    }).catch(() => null)

    return { handled: true, reason: 'responded_fast_webhook', responseLength: aiResponse.text.length }
}

async function mirrorMediaToR2(params: {
    url: string
    mime?: string | null
    instanceName?: string
    phone?: string
    mediaKind: string
}) {
    const { url, mime, instanceName, phone, mediaKind } = params
    const now = new Date()
    const yyyy = now.getUTCFullYear()
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(now.getUTCDate()).padStart(2, '0')
    const ext = extFromMime(mime)
    const key = [
        'whatsapp-audit',
        `${yyyy}`,
        `${mm}`,
        `${dd}`,
        safeSlug(instanceName || 'unknown-instance'),
        safeSlug(phone || 'unknown-phone'),
        `${Date.now()}-${safeSlug(mediaKind)}.${ext}`,
    ].join('/')

    const r2Url = await uploadImageToR2(url, key)
    return {
        media_kind: mediaKind,
        original_url: url,
        r2_url: r2Url,
        key,
        mime: mime || null,
    }
}

function mediaKindFromMime(mime?: string | null): string {
    const value = String(mime || '').toLowerCase()
    if (value.startsWith('image/')) return 'image'
    if (value.startsWith('video/')) return 'video'
    if (value.startsWith('audio/')) return 'audio'
    return 'document'
}

function filenameFromMediaUrl(url: string, fallback: string): string {
    try {
        const parsed = new URL(url)
        const last = parsed.pathname.split('/').filter(Boolean).pop()
        return last || fallback
    } catch {
        return fallback
    }
}

async function saveInboundMediaArtifact(params: {
    supabase: ReturnType<typeof getSupabase>
    instanceName: string
    phone: string
    fileUrl: string
    mime?: string | null
    mediaKind: string
    messageIds: string[]
}) {
    const { supabase, instanceName, phone, fileUrl, mime, mediaKind, messageIds } = params
    const mirrored = await mirrorMediaToR2({
        url: fileUrl,
        mime,
        instanceName,
        phone,
        mediaKind,
    })
    const storedUrl = mirrored.r2_url || fileUrl
    const now = new Date().toISOString()
    const filename = filenameFromMediaUrl(storedUrl, `${mediaKind}_${Date.now()}.${extFromMime(mime)}`)

    let instance: any = null
    if (instanceName) {
        const { data } = await supabase
            .from('whatsapp_instances')
            .select('id, instance_name, broker_id, admin_user_id')
            .eq('instance_name', instanceName)
            .maybeSingle()
        instance = data
    }

    let lead: any = null
    if (phone) {
        lead = await ensureWhatsAppLead(supabase, {
            phone,
            instanceId: instance?.id || null,
            instanceName: instance?.instance_name || instanceName || null,
            brokerId: instance?.broker_id || null,
            acquiredVia: 'whatsapp',
        }).catch(() => null)
    }

    if (phone) {
        const docEntry = {
            type: mediaKind,
            filename,
            mimetype: mime || mirrored.mime || 'unknown',
            url: storedUrl,
            r2_url: storedUrl,
            original_url: fileUrl,
            storage: storedUrl === fileUrl ? 'uazapi' : 'r2',
            message_ids: messageIds,
            received_at: now,
            instance_id: instance?.id || null,
            broker_id: instance?.broker_id || null,
        }

        const { data: existing } = await supabase
            .from('lead_collected_data')
            .select('documents_received')
            .eq('lead_phone', phone)
            .maybeSingle()

        const docs = Array.isArray(existing?.documents_received) ? existing.documents_received : []
        const alreadySaved = docs.some((doc: any) => {
            const docIds = Array.isArray(doc?.message_ids) ? doc.message_ids.map(String) : []
            return doc?.url === storedUrl
                || doc?.r2_url === storedUrl
                || doc?.original_url === fileUrl
                || messageIds.some((id) => docIds.includes(String(id)))
        })
        if (!alreadySaved) docs.push(docEntry)

        const { error } = await supabase
            .from('lead_collected_data')
            .upsert({
                lead_phone: phone,
                documents_received: docs.slice(-80),
                updated_at: now,
            }, { onConflict: 'lead_phone' })
        if (error) console.warn('[Webhook] Failed to save media in lead_collected_data:', error.message)

        if (lead?.id && !alreadySaved) {
            await appendLeadConversationLog(supabase, lead.id, {
                role: 'user',
                content: `[${mediaKind} recebida] ${filename} | ${storedUrl}`,
                type: mediaKind,
                source: 'lead',
                message_id: messageIds[0] || null,
                instance_id: instance?.id || null,
                broker_id: instance?.broker_id || null,
                timestamp: now,
            }).catch(() => null)
        }
    }

    return { ...mirrored, stored_url: storedUrl, filename }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// WEBHOOK DISPATCHER â€” Recebe â†’ Dispara evento Inngest â†’ 200 OK
// Sem processamento pesado. Retorno imediato.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export async function POST(request: NextRequest) {
    try {
        const contentLength = Number(request.headers.get('content-length') || 0)
        if (contentLength > MAX_WEBHOOK_BODY_SIZE) {
            console.warn(`[Webhook] Ignored oversized payload: ${contentLength} bytes`)
            return NextResponse.json({ success: true, action: 'ignored_large_payload' }, { status: 202 })
        }

        const body = await request.json()
        const supabase = getSupabase()
        const auditPayload = compactAuditPayload(body)

        // â”€â”€ DEBUG: Log the incoming payload (truncated) â”€â”€
        console.log('[Webhook] ðŸ“© Payload:', JSON.stringify(body).substring(0, 500))

        // â”€â”€ Extract event type â”€â”€
        const eventPayload = body.event && typeof body.event === 'object' && !Array.isArray(body.event)
            ? body.event
            : null
        const event = typeof body.event === 'string'
            ? body.event
            : (body.EventType || body.action || '')
        const instanceName = body.instance
            || body.instanceName
            || body.server_url
            || eventPayload?.Instance
            || eventPayload?.instance
            || ''
        const messageData = body.data || body.message || eventPayload || body
        let auditPhone: string | null = null
        let auditSenderName: string | null = null
        let auditLeadId: string | null = null
        let auditMessageType: string | null = null
        let auditIsFromMe = false
        const auditMedia: any[] = []

        const saveAudit = async (params: { action: string; statusCode?: number; error?: string }) => {
            try {
                await supabase.from('whatsapp_webhook_audit_logs').insert({
                    instance_name: instanceName || null,
                    event_type: event || null,
                    message_type: auditMessageType,
                    action: params.action,
                    status_code: params.statusCode || 200,
                    is_from_me: auditIsFromMe,
                    from_phone: auditPhone,
                    lead_id: auditLeadId,
                    sender_name: auditSenderName,
                    payload: auditPayload,
                    media: auditMedia,
                    error: params.error || null,
                })
            } catch (e) {
                console.warn('[Webhook][Audit] Failed to save audit row:', e)
            }
        }

        if (String(event).toLowerCase() === 'presence') {
            const tracked = await savePresenceEvent({ supabase, instanceName, body, messageData })
            auditPhone = (tracked as any)?.phone || null
            await saveAudit({ action: (tracked as any)?.tracked ? 'presence_tracked' : 'presence_ignored' })
            return NextResponse.json({ success: true, action: (tracked as any)?.tracked ? 'presence_tracked' : 'presence_ignored', tracked })
        }

        const updateKind = String(messageData?.Type || messageData?.type || '').toLowerCase()
        if (String(event).toLowerCase() === 'messages_update' && updateKind === 'filedownloaded') {
            const fileUrl = messageData.FileURL
                || messageData.fileURL
                || messageData.fileUrl
                || messageData.url
                || messageData.URL
                || null
            const mime = messageData.MimeType || messageData.mimeType || messageData.mimetype || null
            const idsRaw = messageData.MessageIDs
                || messageData.messageIDs
                || messageData.messageIds
                || messageData.ids
                || messageData.IDs
                || messageData.id
                || null
            const messageIds = (Array.isArray(idsRaw) ? idsRaw : [idsRaw])
                .map((id) => String(id || '').trim())
                .filter(Boolean)
            const rawChat = messageData.Chat || messageData.chat || messageData.Sender || messageData.sender || ''
            const mediaPhone = String(rawChat).replace(/@.+$/, '').replace(/\D/g, '')
            auditPhone = mediaPhone || null
            auditMessageType = mediaKindFromMime(mime)

            if (!fileUrl || messageIds.length === 0) {
                console.warn('[Webhook] FileDownloaded ignored: missing fileUrl or message id')
                await saveAudit({ action: 'media_file_downloaded_incomplete' })
                return NextResponse.json({ success: true, action: 'media_file_downloaded_incomplete' })
            }

            let artifact: any = {
                media_kind: auditMessageType,
                original_url: fileUrl,
                stored_url: fileUrl,
                r2_url: null,
                mime,
                message_ids: messageIds,
            }
            try {
                artifact = await saveInboundMediaArtifact({
                    supabase,
                    instanceName,
                    phone: mediaPhone,
                    fileUrl,
                    mime,
                    mediaKind: auditMessageType,
                    messageIds,
                })
            } catch (e) {
                console.warn('[Webhook] Failed to persist inbound media artifact:', e)
            }

            const storedUrl = artifact?.stored_url || artifact?.r2_url || fileUrl
            const rows = messageIds.map((messageId) => ({
                key: `_wmedia_${messageId}`,
                value: JSON.stringify({
                    url: storedUrl,
                    r2Url: artifact?.r2_url || null,
                    originalUrl: fileUrl,
                    mime,
                    phone: mediaPhone || null,
                    instanceName: instanceName || null,
                    filename: artifact?.filename || null,
                    storage: storedUrl === fileUrl ? 'uazapi' : 'r2',
                    receivedAt: new Date().toISOString(),
                }),
                updated_at: new Date().toISOString(),
            }))

            await supabase.from('app_config').upsert(rows, { onConflict: 'key' })
            auditMedia.push({ ...artifact, message_ids: messageIds })
            console.log(`[Webhook] Media file ready for ${mediaPhone || 'unknown'} (${messageIds.join(', ')}): ${String(storedUrl).substring(0, 120)}`)
            await saveAudit({ action: 'media_file_ready' })
            return NextResponse.json({ success: true, action: 'media_file_ready', messageIds })
        }

        // Skip non-message events
        const messageEvents = ['messages.upsert', 'message', 'messages', 'chat', '']
        if (event && !messageEvents.includes(event)) {
            console.log(`[Webhook] â­ï¸ Skipped event: ${event}`)
            await saveAudit({ action: 'ignored_event' })
            return NextResponse.json({ success: true, action: 'ignored_event', event })
        }

        // â”€â”€ Extract phone number â”€â”€
        // ConnectyHub pode enviar LIDs internos no campo sender/sender_pn
        // O nÃºmero REAL vem em chatid, owner, ou chat.id
        // Prioridade: chatid > owner > chat.id > sender_pn > from > remoteJid
        const remotePhone = messageData.chatid           // "5511964830003@s.whatsapp.net" (BEST)
            || messageData.owner                         // sometimes has the real phone
            || body.chat?.id                             // nested chat object
            || messageData.key?.remoteJid                // Evolution/Baileys format
            || messageData.from
            || messageData.remoteJid
            || messageData.phone
            || body.from
            || body.phone
            || ''

        const senderNameRaw = messageData.senderName || messageData.sender_name || messageData.pushName || ''

        // Extract text â€” ensure it's always a string (audio msgs may have objects here)
        const rawText = messageData.text
            || messageData.caption
            || messageData.message?.conversation
            || messageData.message?.extendedTextMessage?.text
            // Only use content/body if they are strings (not audio objects like {URL: "..."})
            || (typeof messageData.content === 'string' ? messageData.content : '')
            || (typeof messageData.body === 'string' ? messageData.body : '')
            || body.text
            || body.body
            || ''
        const messageText = typeof rawText === 'string' ? rawText : ''

        const isFromMe = messageData.fromMe ?? messageData.key?.fromMe ?? body.fromMe ?? false
        auditIsFromMe = Boolean(isFromMe)

        // Audio detection â€” ConnectyHub uses type:"audio" or messageType:"AudioMessage"
        const msgType = (messageData.type || '').toString().toLowerCase()
        const msgMessageType = (messageData.messageType || '').toString().toLowerCase()
        const chatLastMsgType = (body.chat?.wa_lastMessageType || '').toString().toLowerCase()
        const genericContentUrl = messageData.content?.URL
            || messageData.content?.url
            || messageData.media?.url
            || body.chat?.media?.url
            || null
        const contentMime = String(
            messageData.content?.mimetype
            || messageData.media?.mimetype
            || messageData.message?.audioMessage?.mimetype
            || ''
        ).toLowerCase()
        const audioTypeHint = (
            msgType === 'audio'
            || msgType === 'audiomessage'
            || msgType === 'ptt'
            || msgMessageType === 'audio'
            || msgMessageType === 'audiomessage'
            || chatLastMsgType === 'audio'
            || chatLastMsgType === 'audiomessage'
        )
        const contentLooksAudio = contentMime.startsWith('audio/')
        const explicitAudioUrl = messageData.audioUrl
            || messageData.message?.audioMessage?.url
            || messageData.message?.body?.audioMessage?.url
            || messageData.body?.audioMessage?.url
            || messageData.audio?.url
            || messageData.message?.audio?.url
            || body.chat?.message?.audioMessage?.url
            || body.chat?.audioMessage?.url
            || body.chat?.audio?.url
            || null
        const audioUrl = explicitAudioUrl || ((audioTypeHint || contentLooksAudio) ? genericContentUrl : null)
        
        const isAudio = !!(audioUrl
            || msgType === 'audio'
            || msgType === 'audiomessage'
            || msgType === 'ptt'
            || msgType === 'media' && (msgMessageType === 'audiomessage' || msgMessageType === 'audio')
            || msgMessageType === 'audiomessage'
            || msgMessageType === 'audio'
            || chatLastMsgType === 'audiomessage'
            || messageData.message?.audioMessage
            || messageData.message?.body?.audioMessage
            || messageData.body?.audioMessage
            || messageData.audio
            || body.chat?.audioMessage
            || body.chat?.message?.audioMessage)

        // â”€â”€ Detect interactive button/list responses â”€â”€
        const buttonResponse = messageData.message?.buttonsResponseMessage
            || messageData.message?.listResponseMessage
            || messageData.buttonsResponseMessage
            || messageData.listResponseMessage
            || null
        const buttonResponseId = buttonResponse?.selectedButtonId
            || buttonResponse?.singleSelectReply?.selectedRowId
            || buttonResponse?.selectedRowId
            || messageData.selectedButtonId
            || messageData.selectedRowId
            || null
        const buttonResponseTitle = buttonResponse?.selectedDisplayText
            || buttonResponse?.title
            || messageData.selectedDisplayText
            || null
        const isButtonResponse = !!(buttonResponseId || buttonResponseTitle)

        // â”€â”€ Detect poll vote responses â”€â”€
        const pollUpdate = messageData.message?.pollUpdateMessage
            || messageData.pollUpdateMessage
            || null
        const pollVotes = pollUpdate?.vote?.selectedOptions
            || pollUpdate?.selectedOptions
            || (messageData.type === 'poll_vote' ? messageData.options : null)
            || null
        const isPollResponse = !!pollVotes

        // â”€â”€ Detect location received â”€â”€
        const locationMsg = messageData.message?.locationMessage
            || messageData.locationMessage
            || messageData.location
            || null
        const receivedLatitude = locationMsg?.degreesLatitude || locationMsg?.latitude || null
        const receivedLongitude = locationMsg?.degreesLongitude || locationMsg?.longitude || null
        const isLocation = !!(receivedLatitude && receivedLongitude)

        // â”€â”€ Detect documents/images/videos â”€â”€
        const contentTypeHint = String(
            msgType
            || msgMessageType
            || chatLastMsgType
            || messageData.content?.type
            || messageData.media?.type
            || ''
        ).toLowerCase()
        const genericMediaKind = contentMime.startsWith('image/')
            || ['image', 'imagem', 'photo', 'picture', 'imagemessage'].includes(contentTypeHint)
            ? 'image'
            : contentMime.startsWith('video/')
                || ['video', 'videomessage'].includes(contentTypeHint)
                ? 'video'
                : contentMime.startsWith('application/')
                    || contentMime.includes('pdf')
                    || ['document', 'documentmessage', 'file'].includes(contentTypeHint)
                    ? 'document'
                    : null

        const documentMsg = messageData.message?.documentMessage
            || messageData.message?.documentWithCaptionMessage?.message?.documentMessage
            || messageData.documentMessage
            || (genericMediaKind === 'document' ? messageData.content || messageData.media || null : null)
            || null
        const imageMsg = messageData.message?.imageMessage
            || messageData.imageMessage
            || (genericMediaKind === 'image' ? messageData.content || messageData.media || null : null)
            || null
        const videoMsg = messageData.message?.videoMessage
            || messageData.videoMessage
            || (genericMediaKind === 'video' ? messageData.content || messageData.media || null : null)
            || null
        const mediaMsg = documentMsg || imageMsg || videoMsg || null
        const mediaUrl = mediaMsg?.url
            || mediaMsg?.URL
            || messageData.content?.URL
            || messageData.content?.url
            || messageData.media?.url
            || null
        const mediaMimetype = mediaMsg?.mimetype
            || messageData.content?.mimetype
            || null
        const mediaFilename = documentMsg?.fileName
            || messageData.content?.fileName
            || messageData.fileName
            || null
        const isDocument = !!(documentMsg || (imageMsg && !isAudio) || videoMsg)
        const mediaType = documentMsg ? 'document' : imageMsg ? 'image' : videoMsg ? 'video' : null

        // â”€â”€ Detect reactions â”€â”€
        const reactionMsg = messageData.message?.reactionMessage
            || messageData.reactionMessage
            || null
        const reactionEmoji = reactionMsg?.text || reactionMsg?.emoji || null
        const isReaction = !!reactionEmoji

        // â”€â”€ Determine message type â”€â”€
        const messageType = isAudio ? 'audio'
            : isButtonResponse ? 'button_response'
            : isPollResponse ? 'poll_response'
            : isLocation ? 'location'
            : isDocument ? (mediaType || 'document')
            : isReaction ? 'reaction'
            : 'text'
        auditMessageType = messageType

        let storedMessageContent = messageText || ''
        if (!storedMessageContent && isButtonResponse) {
            storedMessageContent = buttonResponseTitle || `[botao: ${buttonResponseId}]`
        } else if (!storedMessageContent && isPollResponse) {
            storedMessageContent = `[enquete: ${Array.isArray(pollVotes) ? pollVotes.join(', ') : pollVotes}]`
        } else if (!storedMessageContent && isLocation) {
            storedMessageContent = `[localizacao: ${receivedLatitude}, ${receivedLongitude}]`
        } else if (!storedMessageContent && isAudio) {
            storedMessageContent = '[audio]'
        } else if (!storedMessageContent && isDocument) {
            storedMessageContent = `[${mediaType || 'midia'}${mediaFilename ? `: ${mediaFilename}` : ''}]`
        } else if (!storedMessageContent && isReaction) {
            storedMessageContent = `[reacao: ${reactionEmoji}]`
        }

        // â”€â”€ Extract media decryption data (WhatsApp E2EE media keys) â”€â”€
        const audioMediaKey = messageData.content?.mediaKey || messageData.message?.audioMessage?.mediaKey || null
        const audioDirectPath = messageData.content?.directPath || messageData.message?.audioMessage?.directPath || null

        // â”€â”€ Extract message ID (needed for UAZAPI /message/download fallback) â”€â”€
        // ConnectyHub uses 'messageid' (lowercase), other providers use 'id' or 'key.id'
        const messageId = messageData.messageid       // ConnectyHub: 'messageid' field
            || messageData.id?.id                      // nested {id: {id: 'xxx'}}
            || messageData.key?.id                     // Baileys format
            || (typeof messageData.id === 'string' ? messageData.id : null)  // string id
            || messageData.messageId                   // camelCase variant
            || body.chat?.id?.id
            || body.chat?.key?.id
            || null

        // â”€â”€ Audio detected: log details and save debug payload â”€â”€
        if (isAudio) {
            console.log(`[Webhook] ðŸŽ¤ AUDIO DETECTED | audioUrl=${audioUrl ? audioUrl.substring(0, 100) : 'NULL'} | messageId=${messageId || 'NULL'} | type=${msgType} | messageType=${msgMessageType}`)
            if (!audioUrl) {
                console.log('[Webhook] ðŸŽ¤ No direct audioUrl â€” agent will use UAZAPI /message/download with messageId')
            }
            // Save full payload to DB for debugging (we can query this!)
            try {
                await supabase.from('app_config').upsert({
                    key: '_debug_last_audio_payload',
                    value: JSON.stringify({
                        timestamp: new Date().toISOString(),
                        audioUrl: audioUrl || null,
                        messageId: messageId || null,
                        messageId_raw_messageid: messageData.messageid || null,
                        messageId_raw_id: typeof messageData.id === 'string' ? messageData.id : JSON.stringify(messageData.id)?.substring(0, 200) || null,
                        messageId_raw_keyid: messageData.key?.id || null,
                        msgType,
                        msgMessageType,
                        chatLastMsgType,
                        topLevelKeys: Object.keys(body),
                        dataKeys: messageData ? Object.keys(messageData) : [],
                        contentKeys: messageData?.content ? Object.keys(messageData.content) : [],
                        contentValue: typeof messageData?.content === 'object' ? JSON.stringify(messageData.content).substring(0, 500) : String(messageData?.content || '').substring(0, 200),
                        fullPayload: JSON.stringify(body).substring(0, 3000),
                    }).substring(0, 4000)
                }, { onConflict: 'key' })
            } catch (e) {
                console.error('[Webhook] Debug save error:', e)
            }
        }

        // â”€â”€ DEEP DEBUG: Log full structure when we get empty text (likely audio) â”€â”€
        if (!messageText && !isAudio) {
            console.log('[Webhook] ðŸ” AUDIO DEBUG â€” Empty message detected. Full key analysis:')
            console.log('[Webhook] ðŸ” Top-level keys:', Object.keys(body).join(', '))
            if (body.chat) console.log('[Webhook] ðŸ” body.chat keys:', Object.keys(body.chat).join(', '))
            if (body.chat?.message) console.log('[Webhook] ðŸ” body.chat.message keys:', Object.keys(body.chat.message).join(', '))
            if (body.data) console.log('[Webhook] ðŸ” body.data keys:', Object.keys(body.data).join(', '))
            if (body.message) console.log('[Webhook] ðŸ” body.message keys:', typeof body.message === 'object' ? Object.keys(body.message).join(', ') : body.message)
            console.log('[Webhook] ðŸ” FULL PAYLOAD:', JSON.stringify(body).substring(0, 2000))
        }

        // Clean phone number
        const cleanPhone = remotePhone?.toString().replace(/@.+$/, '').replace(/\D/g, '') || ''

        // â”€â”€ VALIDATION: Check phone number format â”€â”€
        if (!cleanPhone) {
            console.log('[Webhook] âš ï¸ No phone found. Keys:', Object.keys(messageData).join(', '))
            await saveAudit({ action: 'ignored_no_phone' })
            return NextResponse.json({ success: true, action: 'ignored_no_phone' })
        }

        // WhatsApp LIDs are ~20+ digits and start with a non-country-code pattern
        // Real BR numbers are 12-13 digits (55 + DDD + number)
        // Real international numbers are typically 10-15 digits
        if (cleanPhone.length > 15) {
            console.warn(`[Webhook] âš ï¸ Rejected LID/invalid number: ${cleanPhone} (${cleanPhone.length} digits). Full payload keys: ${JSON.stringify(Object.keys(messageData))}`)
            // Try to find the real phone in other fields
            const fallbackPhone = messageData.sender_pn?.toString().replace(/@.+$/, '').replace(/\D/g, '')
                || messageData.sender?.toString().replace(/@.+$/, '').replace(/\D/g, '')
                || ''
            
            if (fallbackPhone && fallbackPhone.length <= 15 && fallbackPhone.length >= 10) {
                console.log(`[Webhook] ðŸ”„ Using fallback phone: ${fallbackPhone}`)
                // Continue with fallback â€” reassign is handled below
            } else {
                console.error(`[Webhook] âŒ Could not find valid phone. chatid=${messageData.chatid}, sender_pn=${messageData.sender_pn}, sender=${messageData.sender}`)
                await saveAudit({ action: 'ignored_invalid_phone' })
                return NextResponse.json({ success: true, action: 'ignored_invalid_phone' })
            }
        }

        // Use the real phone (or fallback if LID was detected)
        const finalPhone = cleanPhone.length > 15
            ? (messageData.sender_pn?.toString().replace(/@.+$/, '').replace(/\D/g, '')
                || messageData.sender?.toString().replace(/@.+$/, '').replace(/\D/g, '')
                || cleanPhone)
            : cleanPhone
        auditPhone = finalPhone

        // Fallback do nome do lead: se WhatsApp nao trouxer senderName, usa nome do formulario salvo no CRM interno.
        let senderName = senderNameRaw
        try {
            const { data: leadByPhone } = await supabase
                .from('leads')
                .select('id, name')
                .or(`phone.eq.${finalPhone},phone_e164.eq.${finalPhone}`)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            if (leadByPhone?.id) auditLeadId = String(leadByPhone.id)
            if (!senderName && leadByPhone?.name) senderName = String(leadByPhone.name)
        } catch (e) {
            console.warn('[Webhook] Could not resolve senderName from leads:', e)
        }
        auditSenderName = senderName || null

        // Espelha midia no R2 para retencao forense de auditoria.
        try {
            const candidates = [
                { url: audioUrl, mime: 'audio/ogg', kind: 'audio' },
                { url: mediaUrl, mime: mediaMimetype, kind: mediaType || 'media' },
            ]
            const dedupe = new Set<string>()
            for (const item of candidates) {
                const sourceUrl = String(item.url || '').trim()
                if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl) || dedupe.has(sourceUrl)) continue
                dedupe.add(sourceUrl)

                const mirrored = await mirrorMediaToR2({
                    url: sourceUrl,
                    mime: item.mime,
                    instanceName,
                    phone: finalPhone,
                    mediaKind: item.kind,
                })
                auditMedia.push({
                    ...mirrored,
                    filename: mediaFilename || null,
                })
            }
        } catch (e) {
            console.warn('[Webhook] Media mirror to R2 failed:', e)
        }

        const logText = messageText ? messageText.substring(0, 80) : '[empty/audio]'
        console.log(`[Webhook] ðŸ“± Phone: ${finalPhone} | Name: ${senderName || '[unknown]'} | FromMe: ${isFromMe} | Audio: ${isAudio} | Instance: ${instanceName} | Text: "${logText}"`)

        // â”€â”€ Find instance in DB â”€â”€
        let instance: any = null

        if (instanceName) {
            const { data } = await supabase
                .from('whatsapp_instances')
                .select('id, instance_name, instance_token, phone_number, broker_id, admin_user_id, status, config')
                .eq('instance_name', instanceName)
                .maybeSingle()
            instance = data
        }

        if (!instance) {
            const { data } = await supabase
                .from('whatsapp_instances')
                .select('id, instance_name, instance_token, phone_number, broker_id, admin_user_id, status, config')
                .eq('status', 'connected')
                .limit(1)
                .maybeSingle()
            instance = data
        }

        if (!instance) {
            console.error(`[Webhook] âŒ No instance found. instanceName: ${instanceName}`)
            await saveAudit({ action: 'instance_not_found', statusCode: 404 })
            return NextResponse.json({ success: false, message: 'InstÃ¢ncia não encontrada' }, { status: 404 })
        }

        console.log(`[Webhook] âœ… Instance: ${instance.instance_name} (broker: ${instance.broker_id || 'none'})`)

        // Anti-loop: ignore inbound messages coming from another connected instance number.
        try {
            const allowInternalInstanceMessages =
                instance?.config?.allow_internal_instance_messages === true ||
                instance?.config?.allow_internal_instance_messages === 'true'
            const senderDigits = (finalPhone || '').replace(/\D/g, '')
            if (senderDigits) {
                const { data: connectedInstances } = await supabase
                    .from('whatsapp_instances')
                    .select('id, phone_number')
                    .eq('status', 'connected')
                const internalSender = (connectedInstances || []).find((row: any) => {
                    const rowDigits = String(row?.phone_number || '').replace(/\D/g, '')
                    return row.id !== instance.id && rowDigits && rowDigits === senderDigits
                })
                if (internalSender && !allowInternalInstanceMessages) {
                    console.log(`[Webhook] â›” Ignored internal instance-to-instance message from ${senderDigits}`)
                    await saveAudit({ action: 'ignored_internal_instance_message' })
                    return NextResponse.json({ success: true, action: 'ignored_internal_instance_message' })
                }
                if (internalSender) {
                    console.warn(`[Webhook] Internal instance-to-instance message allowed by config from ${senderDigits}`)
                }
            }
        } catch (e) {
            console.warn('[Webhook] Anti-loop check failed (non-fatal):', e)
        }

        if (!isFromMe && instance.broker_id && storedMessageContent?.trim()) {
            try {
                const assistantResult = await handleBrokerAssistantMessage({
                    supabase,
                    instance,
                    brokerId: instance.broker_id,
                    phone: finalPhone,
                    text: storedMessageContent,
                    senderName,
                })
                if (assistantResult.handled) {
                    console.log(`[Webhook] Broker assistant handled ${finalPhone}: ${assistantResult.reason}`)
                    await saveAudit({ action: 'broker_assistant_handled' })
                    return NextResponse.json({ success: true, action: 'broker_assistant_handled' })
                }
            } catch (e) {
                console.warn('[Webhook] Broker assistant mode failed, falling back to lead flow:', e)
            }
        }

        let syncedLead: any = null
        if (!isFromMe) {
            try {
                syncedLead = await ensureWhatsAppLead(supabase, {
                    phone: finalPhone,
                    senderName,
                    instanceId: instance.id,
                    instanceName: instance.instance_name,
                    instanceToken: instance.instance_token,
                    brokerId: instance.broker_id || null,
                    acquiredVia: 'whatsapp',
                })
                if (syncedLead?.id) {
                    auditLeadId = syncedLead.id
                    await appendLeadConversationLog(supabase, syncedLead.id, {
                        role: 'user',
                        content: storedMessageContent,
                        type: messageType,
                        source: 'lead',
                        message_id: messageId,
                        instance_id: instance.id,
                        broker_id: instance.broker_id || null,
                    })
                }
            } catch (e) {
                console.warn('[Webhook] Lead sync failed:', e)
            }
        }

        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // DISPATCH TO INNGEST (async processing)
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

        if (isFromMe) {
            // â”€â”€ Human Takeover Detection â”€â”€
            const botMsgId = messageData.id?.id || messageData.key?.id || ''
            const recipientPhone = messageData.to?.replace(/@.+$/, '').replace(/\D/g, '')
                || messageData.chatid?.replace(/@.+$/, '').replace(/\D/g, '')
                || ''

            try {
                const outboundLead = await ensureWhatsAppLead(supabase, {
                    phone: recipientPhone || finalPhone,
                    senderName: null,
                    instanceId: instance.id,
                    instanceName: instance.instance_name,
                    brokerId: instance.broker_id || null,
                    acquiredVia: 'whatsapp',
                })
                if (outboundLead?.id && storedMessageContent) {
                    auditLeadId = outboundLead.id
                    await appendLeadConversationLog(supabase, outboundLead.id, {
                        role: 'assistant',
                        content: storedMessageContent,
                        type: messageType,
                        source: 'human',
                        message_id: botMsgId || messageId,
                        instance_id: instance.id,
                        broker_id: instance.broker_id || null,
                    })
                }
            } catch (e) {
                console.warn('[Webhook] Outbound lead sync failed:', e)
            }

            if (botMsgId) {
                await inngest.send({
                    name: 'whatsapp/from-me-message',
                    data: {
                        botMsgId,
                        instanceId: instance.id,
                        recipientPhone,
                        messageText: messageText || null,
                    }
                })
                console.log(`[Webhook] ðŸ“¤ Dispatched human-takeover check to Inngest`)
            }

            await saveAudit({ action: 'from_me_dispatched' })
            return NextResponse.json({ success: true, action: 'from_me_dispatched' })
        }

        // Ignore truly empty messages (but allow button responses, polls, locations, reactions)
        if (!messageText && !isAudio && !isButtonResponse && !isPollResponse && !isLocation && !isDocument && !isReaction) {
            console.log('[Webhook] â­ï¸ Ignored empty message')
            await saveAudit({ action: 'ignored_empty' })
            return NextResponse.json({ success: true, action: 'ignored_empty' })
        }

        try {
            const botLoop = await enforceBotLoopProtection({
                supabase,
                leadId: syncedLead?.id || auditLeadId,
                instance,
                phone: finalPhone,
            })
            if (botLoop.blocked) {
                console.warn(`[Webhook] Bot/loop protection blocked ${finalPhone}: ${botLoop.reason}`)
                await saveAudit({ action: 'ignored_bot_loop_protection', error: botLoop.reason })
                return NextResponse.json({
                    success: true,
                    action: 'ignored_bot_loop_protection',
                    reason: botLoop.reason,
                })
            }
        } catch (e) {
            console.warn('[Webhook] Bot/loop protection check failed (non-fatal):', e)
        }

        // â”€â”€ Immediate actions (before async Inngest processing) â”€â”€

        // 1) Mark as read (blue ticks) â€” immediate + short retries for reliability
        try {
            const instanceMarkAsRead = (instance as any)?.config?.mark_as_read
            const shouldMarkAsRead = instanceMarkAsRead !== false && instanceMarkAsRead !== 'false'
            if (shouldMarkAsRead) {
                const readTargets = Array.from(new Set([
                    remotePhone || '',
                    finalPhone || '',
                    finalPhone ? `${finalPhone}@s.whatsapp.net` : '',
                ].filter(Boolean)))

                await Promise.allSettled(
                    readTargets.map((target) => markAsRead(target, instance.instance_token, messageId))
                )

                // Reliability fallback in background: retries over a few seconds
                // (helps when provider hasn't indexed the inbound message yet).
                await inngest.send({
                    name: 'whatsapp/mark-read',
                    data: {
                        instanceToken: instance.instance_token,
                        remotePhone: remotePhone || null,
                        cleanPhone: finalPhone,
                        messageId: messageId || null,
                    }
                })
            }
        } catch { /* ignore */ }

        // 1.1) Keep contact-level presence available when enabled
        try {
            const instanceAlwaysOnline = (instance as any)?.config?.always_online
            const shouldStayOnline = instanceAlwaysOnline !== false && instanceAlwaysOnline !== 'false'
            if (shouldStayOnline) {
                setPresenceAvailable(instance.instance_token, remotePhone || finalPhone).catch((err) => {
                    console.warn('[Webhook] setPresenceAvailable failed:', err)
                })
            }
        } catch { /* ignore */ }

        const isSimpleTextForFastPath = !!storedMessageContent?.trim()
            && !isAudio
            && !isButtonResponse
            && !isPollResponse
            && !isLocation
            && !isDocument
            && !isReaction

        if (instance.broker_id && isSimpleTextForFastPath) {
            try {
                const fastResult = await tryFastTextBrokerResponse({
                    supabase,
                    instance,
                    phone: finalPhone,
                    text: storedMessageContent,
                    messageId,
                    messageType,
                    senderName,
                })
                if (fastResult.handled) {
                    console.log(`[Webhook] ⚡ Fast text response sent for ${finalPhone} (${fastResult.responseLength || 0} chars)`)
                    await saveAudit({ action: 'responded_fast_webhook' })
                    return NextResponse.json({ success: true, action: 'responded_fast_webhook' })
                }
                console.log(`[Webhook] Fast path skipped for ${finalPhone}: ${fastResult.reason}`)
            } catch (e) {
                console.warn('[Webhook] Fast path failed, falling back to Inngest:', e)
            }
        }

        // 2) Queue message for debounce batching (atomic INSERT, no race condition)
        let queuedMessageKey: string | null = null
        try {
            // Build content from various message types
            const msgContent = storedMessageContent

            if (msgContent && !isAudio) {
                const queuedPayload = {
                    text: msgContent,
                    type: messageType,
                    mediaType,
                    hasMedia: Boolean(isDocument),
                    hasCaption: Boolean(messageText?.trim() && isDocument),
                    messageId: messageId || null,
                    mediaUrl: mediaUrl || null,
                    mediaMimetype: mediaMimetype || null,
                    mediaFilename: mediaFilename || null,
                    createdAt: new Date().toISOString(),
                }
                const pendingKey = `_pmq_${finalPhone}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
                const { error: queueError } = await supabase.from('app_config').insert({
                    key: pendingKey,
                    value: JSON.stringify(queuedPayload),
                    updated_at: new Date().toISOString()
                })
                if (queueError) {
                    console.warn('[Webhook] Failed to queue pending message:', queueError)
                } else {
                    queuedMessageKey = pendingKey
                    console.log(`[Webhook] ðŸ“ Queued pending message for ${finalPhone} (type: ${messageType})`)
                }
            }
        } catch (e) {
            console.warn('[Webhook] Failed to queue pending message:', e)
        }

        // â”€â”€ Route: AI Broker or Shadow Agent â”€â”€
        try {
            const { data: leadRow } = await supabase
                .from('leads')
                .select('id, visitor_id, landing_page_id, conversation_started_at, metadata')
                .or(`phone.eq.${finalPhone},phone_e164.eq.${finalPhone}`)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (leadRow?.visitor_id) {
                const followupAttempts = Number((leadRow.metadata as any)?.whatsapp_followup_attempts || 0)
                const isFirstInboundAfterFollowup = !leadRow.conversation_started_at && followupAttempts > 0

                await supabase.from('funnel_events').insert({
                    visitor_id: leadRow.visitor_id,
                    lead_id: leadRow.id || null,
                    landing_page_id: leadRow.landing_page_id || null,
                    event_type: 'whatsapp_conversation_started',
                    metadata: {
                        instance_id: instance.id,
                        instance_name: instance.instance_name,
                        message_type: messageType || 'text',
                    },
                })

                if (isFirstInboundAfterFollowup) {
                    await supabase.from('funnel_events').insert({
                        visitor_id: leadRow.visitor_id,
                        lead_id: leadRow.id || null,
                        landing_page_id: leadRow.landing_page_id || null,
                        event_type: 'whatsapp_followup_replied',
                        metadata: {
                            followup_attempts: followupAttempts,
                        },
                    })
                }

                await supabase
                    .from('leads')
                    .update({
                        conversation_started_at: new Date().toISOString(),
                    })
                    .eq('id', leadRow.id)
                    .is('conversation_started_at', null)
            }
        } catch (e) {
            console.warn('[Webhook] Failed to register whatsapp_conversation_started:', e)
        }

        if (instance.broker_id) {
            // AI Broker path
            await inngest.send({
                name: 'whatsapp/message-received',
                data: {
                    cleanPhone: finalPhone,
                    messageText,
                    messageType,
                    isAudio,
                    audioUrl,
                    audioMediaKey,
                    audioDirectPath,
                    messageId,
                    // Interactive message data
                    buttonResponseId: buttonResponseId || null,
                    buttonResponseTitle: buttonResponseTitle || null,
                    pollVotes: pollVotes || null,
                    receivedLatitude: receivedLatitude || null,
                    receivedLongitude: receivedLongitude || null,
                    reactionEmoji: reactionEmoji || null,
                    // Media/document data
                    mediaUrl: mediaUrl || null,
                    mediaMimetype: mediaMimetype || null,
                    mediaFilename: mediaFilename || null,
                    mediaType: mediaType || null,
                    queuedMessageKey,
                    // Instance/routing
                    instanceId: instance.id,
                    instanceToken: instance.instance_token,
                    instanceName: instance.instance_name,
                    brokerId: instance.broker_id || null,
                    senderName,
                }
            })
            console.log(`[Webhook] ðŸ“¤ Dispatched AI broker message to Inngest for ${finalPhone}`)
        } else if (instance.admin_user_id) {
            // Shadow Agent path
            await inngest.send({
                name: 'whatsapp/shadow-agent',
                data: {
                    cleanPhone: finalPhone,
                    messageText,
                    instanceId: instance.id,
                    instanceToken: instance.instance_token,
                    adminUserId: instance.admin_user_id,
                }
            })
            console.log(`[Webhook] ðŸ“¤ Dispatched shadow agent message to Inngest for ${finalPhone}`)
        } else {
            // No broker and no shadow owner: skip safely to avoid wrong persona/prompt.
            console.warn(`[Webhook] Skipped message: instance ${instance.id} has no broker_id/admin_user_id`)
            await saveAudit({ action: 'ignored_unassigned_instance' })
            return NextResponse.json({ success: true, action: 'ignored_unassigned_instance' })
        }

        await saveAudit({ action: 'dispatched' })
        return NextResponse.json({ success: true, action: 'dispatched' })
    } catch (error) {
        console.error('[Webhook Error]', error)
        try {
            const supabase = getSupabase()
            await supabase.from('whatsapp_webhook_audit_logs').insert({
                action: 'error',
                status_code: 500,
                payload: {},
                media: [],
                error: String(error),
            })
        } catch {
            // best effort
        }
        return NextResponse.json({ success: false, message: 'Erro no webhook' }, { status: 500 })
    }
}







