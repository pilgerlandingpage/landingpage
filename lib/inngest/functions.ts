import { inngest } from './client'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsAppMessage, interpolateTemplate } from '../uazapi'
import { sendWorkflowWhatsAppAction, workflowStepHasSendableContent, type WorkflowActionType } from '../workflows/whatsapp-actions'
import { scrapePage } from '../scraper'
import { uploadImageToR2 } from '../storage/r2'
import { v4 as uuidv4 } from 'uuid'
import {
    publishCampaign,
    pollMetricsCron,
    aiAnalyzeMetrics,
    executeAiAction,
    dailyReportCron,
    syncMetaLeadsCron,
    generateDailyPilgerReportCron,
    generateWeeklyPilgerReportCron,
    radarCollectionCron
} from './ads-functions'
import {
    processWhatsAppMessage,
    detectHumanTakeover,
    shadowAgentResponse,
    reliableMarkAsRead,
    whatsappKeepOnline
} from './whatsapp-agent'
import { whatsappInstanceSetup } from './whatsapp-setup'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// Helper to slugify text
function slugify(text: string) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
}

function parseTimeHHMM(input: string): { hour: number; minute: number } | null {
    const m = String(input || '').match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return null
    const hour = Number(m[1])
    const minute = Number(m[2])
    if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
    return { hour, minute }
}

function buildFollowupOffsetsFromConfig(rawConfig: string | undefined): number[] {
    const base = new Date()
    const offsets = new Set<number>()

    if (!rawConfig) return [5, 4320, 10080]

    let parsed: any = null
    try {
        parsed = JSON.parse(rawConfig)
    } catch {
        return [5, 4320, 10080]
    }

    const pushOffset = (minutes: number) => {
        const v = Math.floor(Number(minutes))
        if (Number.isFinite(v) && v > 0) offsets.add(v)
    }

    // Legacy/simple mode: [5, 4320, 10080]
    if (Array.isArray(parsed)) {
        for (const item of parsed) pushOffset(item)
        return offsets.size ? Array.from(offsets).sort((a, b) => a - b) : [5, 4320, 10080]
    }

    if (!parsed || typeof parsed !== 'object') return [5, 4320, 10080]

    // 1) Explicit offsets
    if (Array.isArray(parsed.offsets_minutes)) {
        for (const item of parsed.offsets_minutes) pushOffset(item)
    }

    // 2) Absolute datetimes (ISO)
    if (Array.isArray(parsed.absolute_datetimes)) {
        for (const iso of parsed.absolute_datetimes) {
            const dt = new Date(String(iso || ''))
            if (Number.isNaN(dt.getTime())) continue
            const diffMin = Math.ceil((dt.getTime() - base.getTime()) / 60000)
            pushOffset(diffMin)
        }
    }

    // 3) Daily recurrence with N times per day
    // {
    //   "repeat_daily": { "times": ["09:00","15:00"], "days": 7, "start_in_days": 0 }
    // }
    if (parsed.repeat_daily && typeof parsed.repeat_daily === 'object') {
        const times = Array.isArray(parsed.repeat_daily.times) ? parsed.repeat_daily.times : []
        const days = Math.max(1, Math.floor(Number(parsed.repeat_daily.days || 1)))
        const startInDays = Math.max(0, Math.floor(Number(parsed.repeat_daily.start_in_days || 0)))

        for (let d = startInDays; d < startInDays + days; d++) {
            for (const t of times) {
                const hhmm = parseTimeHHMM(String(t || ''))
                if (!hhmm) continue
                const target = new Date(base)
                target.setDate(base.getDate() + d)
                target.setHours(hhmm.hour, hhmm.minute, 0, 0)
                const diffMin = Math.ceil((target.getTime() - base.getTime()) / 60000)
                pushOffset(diffMin)
            }
        }
    }

    // 4) Yearly recurrence
    // {
    //   "repeat_yearly": [{ "month": 12, "day": 31, "time": "10:00", "years": 2 }]
    // }
    if (Array.isArray(parsed.repeat_yearly)) {
        const currentYear = base.getFullYear()
        for (const rule of parsed.repeat_yearly) {
            const month = Math.floor(Number(rule?.month))
            const day = Math.floor(Number(rule?.day))
            const years = Math.max(1, Math.floor(Number(rule?.years || 1)))
            const hhmm = parseTimeHHMM(String(rule?.time || '09:00'))
            if (!hhmm) continue
            if (!Number.isFinite(month) || !Number.isFinite(day) || month < 1 || month > 12 || day < 1 || day > 31) continue

            for (let i = 0; i < years; i++) {
                const target = new Date(base)
                target.setFullYear(currentYear + i, month - 1, day)
                target.setHours(hhmm.hour, hhmm.minute, 0, 0)
                const diffMin = Math.ceil((target.getTime() - base.getTime()) / 60000)
                pushOffset(diffMin)
            }
        }
    }

    const list = Array.from(offsets).sort((a, b) => a - b)
    return list.length ? list : [5, 4320, 10080]
}

function normalizeWorkflowPhone(raw: unknown): string {
    return String(raw || '').replace(/\D/g, '')
}

function workflowNodes(workflow: any): any[] {
    const nodes = Array.isArray(workflow?.nodes) ? workflow.nodes : []
    return nodes
}

function workflowDelayMinutes(node: any): number {
    const value = Number(node?.data?.delay_minutes ?? node?.delay_minutes ?? 0)
    if (!Number.isFinite(value)) return 0
    return Math.max(0, Math.min(43200, Math.round(value)))
}

function minutesUntilWorkflowDateTime(value: unknown): number | null {
    if (!value) return null
    const target = new Date(String(value))
    if (Number.isNaN(target.getTime())) return null
    return Math.max(0, Math.min(43200, Math.ceil((target.getTime() - Date.now()) / 60000)))
}

function workflowTemplate(node: any): string {
    return String(
        node?.data?.message_template
        || node?.message_template
        || 'Oi {nome_lead}, passando para saber se posso te ajudar.'
    )
}

function workflowActionSteps(workflow: any): Array<{
    id: string
    waitNodeId: string
    messageNodeId: string
    delayMinutes: number
    waitMode: string
    waitUntil: string | null
    messageTemplate: string
    actionType: WorkflowActionType
    actionPayload: Record<string, any>
    stopIfReplied: boolean
}> {
    const metadataSteps = Array.isArray(workflow?.metadata?.steps) ? workflow.metadata.steps : []
    if (metadataSteps.length > 0) {
        return metadataSteps
            .slice(0, 8)
            .map((step: any, index: number) => ({
                id: String(step?.id || `step_${index + 1}`),
                waitNodeId: `wait_${index + 1}`,
                messageNodeId: `message_${index + 1}`,
                delayMinutes: Math.max(0, Math.min(43200, Number(step?.delay_minutes || 0))),
                waitMode: step?.wait_mode === 'datetime' ? 'datetime' : 'relative',
                waitUntil: step?.wait_until ? String(step.wait_until) : null,
                actionType: (step?.action_type || 'text') as WorkflowActionType,
                actionPayload: step?.action_payload && typeof step.action_payload === 'object' ? step.action_payload : {},
                messageTemplate: String(step?.message_template || '').trim(),
                stopIfReplied: step?.stop_if_replied !== false,
            }))
            .filter((step: any) => workflowStepHasSendableContent({
                action_type: step.actionType,
                action_payload: step.actionPayload,
                message_template: step.messageTemplate,
            }))
    }

    const nodes = workflowNodes(workflow)
    const waitNodes = nodes
        .filter((node: any) => node?.type === 'wait')
        .sort((a: any, b: any) => Number(a?.position?.x || 0) - Number(b?.position?.x || 0))
    const messageNodes = nodes
        .filter((node: any) => node?.type === 'agent_message' || node?.type === 'message')
        .sort((a: any, b: any) => Number(a?.position?.x || 0) - Number(b?.position?.x || 0))

    return messageNodes.slice(0, 8).map((messageNode: any, index: number) => {
        const waitNode = waitNodes[index]
        return {
            id: String(messageNode?.data?.step_id || `step_${index + 1}`),
            waitNodeId: String(waitNode?.id || `wait_${index + 1}`),
            messageNodeId: String(messageNode?.id || `message_${index + 1}`),
            delayMinutes: workflowDelayMinutes(waitNode),
            waitMode: waitNode?.data?.wait_mode === 'datetime' ? 'datetime' : 'relative',
            waitUntil: waitNode?.data?.wait_until ? String(waitNode.data.wait_until) : null,
            actionType: (messageNode?.data?.action_type || 'text') as WorkflowActionType,
            actionPayload: messageNode?.data?.action_payload && typeof messageNode.data.action_payload === 'object' ? messageNode.data.action_payload : {},
            messageTemplate: workflowTemplate(messageNode),
            stopIfReplied: messageNode?.data?.stop_if_replied !== false,
        }
    }).filter((step) => workflowStepHasSendableContent({
        action_type: step.actionType,
        action_payload: step.actionPayload,
        message_template: step.messageTemplate,
    }))
}

function saoPauloLocalParts(date = new Date()) {
    // Sao Paulo no longer observes DST. Keeping this local helper avoids server timezone drift.
    const shifted = new Date(date.getTime() - 3 * 60 * 60 * 1000)
    return {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth(),
        day: shifted.getUTCDate(),
        weekday: shifted.getUTCDay(),
        hour: shifted.getUTCHours(),
        minute: shifted.getUTCMinutes(),
    }
}

function localSaoPauloToUtcMs(parts: { year: number; month: number; day: number; hour: number; minute: number }) {
    return Date.UTC(parts.year, parts.month, parts.day, parts.hour + 3, parts.minute, 0, 0)
}

function minutesUntilNextBusinessSlot(fromDate = new Date()) {
    const local = saoPauloLocalParts(fromDate)
    const isBusinessDay = local.weekday >= 1 && local.weekday <= 5
    if (isBusinessDay && local.hour >= 9 && local.hour < 18) return 0

    let addDays = 0
    let targetHour = 9
    if (isBusinessDay && local.hour < 9) {
        addDays = 0
    } else {
        addDays = 1
    }

    while (true) {
        const targetLocal = new Date(Date.UTC(local.year, local.month, local.day + addDays, targetHour, 0, 0, 0))
        const weekday = targetLocal.getUTCDay()
        if (weekday >= 1 && weekday <= 5) {
            const targetUtcMs = localSaoPauloToUtcMs({
                year: targetLocal.getUTCFullYear(),
                month: targetLocal.getUTCMonth(),
                day: targetLocal.getUTCDate(),
                hour: targetHour,
                minute: 0,
            })
            return Math.max(0, Math.ceil((targetUtcMs - fromDate.getTime()) / 60000))
        }
        addDays += 1
    }
}

function minutesUntilSameLocalTime(fromDate: Date, sourceDate: Date) {
    const from = saoPauloLocalParts(fromDate)
    const source = saoPauloLocalParts(sourceDate)
    let targetUtcMs = localSaoPauloToUtcMs({
        year: from.year,
        month: from.month,
        day: from.day,
        hour: source.hour,
        minute: source.minute,
    })

    if (targetUtcMs <= fromDate.getTime()) {
        const tomorrowLocal = new Date(Date.UTC(from.year, from.month, from.day + 1, source.hour, source.minute, 0, 0))
        targetUtcMs = localSaoPauloToUtcMs({
            year: tomorrowLocal.getUTCFullYear(),
            month: tomorrowLocal.getUTCMonth(),
            day: tomorrowLocal.getUTCDate(),
            hour: source.hour,
            minute: source.minute,
        })
    }

    return Math.max(0, Math.ceil((targetUtcMs - fromDate.getTime()) / 60000))
}

function workflowSmartWait(workflow: any, lead: any, baseDelayMinutes: number) {
    const baseDelay = Math.max(0, Math.round(Number(baseDelayMinutes || 0)))
    const baseTarget = new Date(Date.now() + baseDelay * 60_000)
    const preferred = String(workflow?.preferred_send_time || 'same_time')
    let policyDelay = 0
    let policyReason = 'none'

    if (preferred === 'business_hours') {
        policyDelay = minutesUntilNextBusinessSlot(baseTarget)
        policyReason = policyDelay > 0 ? 'business_hours' : 'business_hours_already_open'
    } else if (preferred === 'same_time') {
        const startedAt = lead?.conversation_started_at ? new Date(String(lead.conversation_started_at)) : null
        if (startedAt && !Number.isNaN(startedAt.getTime()) && baseDelay >= 720) {
            policyDelay = minutesUntilSameLocalTime(baseTarget, startedAt)
            policyReason = policyDelay > 0 ? 'same_first_contact_time' : 'same_first_contact_time_now'
        } else {
            policyReason = baseDelay >= 720 ? 'same_time_without_first_contact' : 'short_delay_no_alignment'
        }
    } else {
        policyReason = 'anytime'
    }

    const totalMinutes = baseDelay + policyDelay
    return {
        totalMinutes,
        baseDelay,
        policyDelay,
        policyReason,
        scheduledFor: new Date(Date.now() + totalMinutes * 60_000).toISOString(),
    }
}

function workflowStepWaitPlan(workflow: any, lead: any, action: { delayMinutes: number; waitMode?: string; waitUntil?: string | null }) {
    if (action.waitMode === 'datetime') {
        const absoluteDelay = minutesUntilWorkflowDateTime(action.waitUntil)
        if (absoluteDelay !== null) {
            return {
                totalMinutes: absoluteDelay,
                baseDelay: absoluteDelay,
                policyDelay: 0,
                policyReason: 'fixed_datetime',
                scheduledFor: new Date(Date.now() + absoluteDelay * 60_000).toISOString(),
            }
        }
    }

    return workflowSmartWait(workflow, lead, action.delayMinutes)
}

async function getLeadOnlinePresence(params: {
    supabase: any
    instanceId: string | null
    phone: string
}) {
    const { supabase, instanceId, phone } = params
    let query = supabase
        .from('whatsapp_contact_presence')
        .select('id, is_online, presence, last_online_at, last_seen_at, last_event_at')
        .eq('phone', phone)
        .order('last_event_at', { ascending: false })
        .limit(1)

    if (instanceId) query = query.eq('instance_id', instanceId)

    const { data } = await query.maybeSingle()
    if (!data) return { isOnline: false, reason: 'no_presence_event' }

    const lastEventMs = new Date(String(data.last_event_at || '')).getTime()
    const fresh = Number.isFinite(lastEventMs) && Date.now() - lastEventMs <= 15 * 60 * 1000
    return {
        isOnline: Boolean(data.is_online) && fresh,
        reason: Boolean(data.is_online) ? (fresh ? 'online' : 'stale_presence') : 'offline',
        presence: data.presence,
        lastEventAt: data.last_event_at,
        lastOnlineAt: data.last_online_at,
        lastSeenAt: data.last_seen_at,
    }
}

async function leadHasRepliedAfterWorkflowStarted(supabase: any, leadId: string | null | undefined): Promise<string | null> {
    if (!leadId) return null
    const { data: latestLead } = await supabase
        .from('leads')
        .select('conversation_started_at, metadata')
        .eq('id', leadId)
        .maybeSingle()
    return latestLead?.conversation_started_at ? String(latestLead.conversation_started_at) : null
}

async function appendWorkflowMessageToConversation(params: {
    supabase: any
    brokerId: string | null
    instanceId: string | null
    leadId: string | null
    phone: string
    message: string
    workflowId: string
}) {
    const { supabase, brokerId, instanceId, leadId, phone, message, workflowId } = params
    if (!brokerId || !phone) return

    const now = new Date().toISOString()
    const { data: existingConv } = await supabase
        .from('whatsapp_ai_conversations')
        .select('id, messages')
        .eq('broker_id', brokerId)
        .eq('lead_phone', phone)
        .in('status', ['active', 'human_takeover', 'transferred'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    const assistantMsg = {
        role: 'assistant',
        content: message,
        type: 'text',
        source: 'agent_workflow',
        workflow_id: workflowId,
        timestamp: now,
    }

    if (existingConv?.id) {
        const current = Array.isArray(existingConv.messages) ? existingConv.messages : []
        await supabase
            .from('whatsapp_ai_conversations')
            .update({ messages: [...current, assistantMsg], updated_at: now })
            .eq('id', existingConv.id)
    } else {
        await supabase
            .from('whatsapp_ai_conversations')
            .insert({
                lead_id: leadId,
                broker_id: brokerId,
                instance_id: instanceId,
                lead_phone: phone,
                messages: [assistantMsg],
                bot_message_ids: [],
                status: 'active',
            })
    }
}

async function logWorkflowEvent(params: {
    supabase: any
    runId?: string | null
    workflowId?: string | null
    leadId?: string | null
    brokerId?: string | null
    instanceId?: string | null
    leadPhone?: string | null
    eventType: string
    nodeId?: string | null
    status?: string | null
    message?: string | null
    metadata?: Record<string, unknown>
}) {
    try {
        await params.supabase.from('agent_workflow_events').insert([{
            run_id: params.runId || null,
            workflow_id: params.workflowId || null,
            lead_id: params.leadId || null,
            broker_id: params.brokerId || null,
            instance_id: params.instanceId || null,
            lead_phone: params.leadPhone || null,
            event_type: params.eventType,
            node_id: params.nodeId || null,
            status: params.status || null,
            message: params.message || null,
            metadata: params.metadata || {},
        }])
    } catch (err) {
        console.warn('[Workflow Event] log failed:', err)
    }
}

async function upsertWorkflowLeadState(params: {
    supabase: any
    workflowId: string
    leadId?: string | null
    leadPhone: string
    brokerId?: string | null
    instanceId?: string | null
    status: string
    runId?: string | null
    triggerType?: string | null
    lastSentAt?: string | null
    lastRepliedAt?: string | null
    nextAllowedAt?: string | null
    metadata?: Record<string, unknown>
}) {
    try {
        await params.supabase
            .from('agent_workflow_lead_state')
            .upsert({
                workflow_id: params.workflowId,
                lead_id: params.leadId || null,
                lead_phone: params.leadPhone,
                broker_id: params.brokerId || null,
                instance_id: params.instanceId || null,
                status: params.status,
                last_run_id: params.runId || null,
                last_trigger_type: params.triggerType || null,
                last_sent_at: params.lastSentAt || null,
                last_replied_at: params.lastRepliedAt || null,
                next_allowed_at: params.nextAllowedAt || null,
                metadata: params.metadata || {},
                updated_at: new Date().toISOString(),
            }, { onConflict: 'workflow_id,lead_phone' })
    } catch (err) {
        console.warn('[Workflow State] upsert failed:', err)
    }
}


// ------------------------------------------------------------------
// EXISTING FUNCTIONS (Welcome, FollowUp, VIP, Automation)
// ------------------------------------------------------------------

// Send immediate welcome message
export const sendWelcome = inngest.createFunction(
    { id: 'send-welcome-message', name: 'Send Welcome WhatsApp Message' },
    { event: 'lead/created' },
    async ({ event }) => {
        const { lead_id, phone, name, property_title } = event.data

        if (!phone) return { skipped: true, reason: 'no phone' }

        const supabase = getSupabase()
        const { data: config } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', 'welcome_message_template')
            .single()

        const template = config?.value ||
            'Olá {{name}}! 👋 Obrigado pelo seu interesse em {{property}}. Um de nossos consultores entrará em contato em breve. 🏠✨'

        const message = interpolateTemplate(template, {
            name: name || 'visitante',
            property: property_title || 'nossos imóveis',
        })

        try {
            await sendWhatsAppMessage({ phone, message })
            await supabase.from('leads').update({ whatsapp_sent: true }).eq('id', lead_id)
            return { success: true }
        } catch (error) {
            console.error('Failed to send welcome message:', error)
            return { success: false, error: String(error) }
        }
    }
)

export const sendFollowUp = inngest.createFunction(
    { id: 'send-followup-message', name: 'Send Follow-up Message' },
    { event: 'lead/schedule-followup' },
    async ({ event, step }) => {
        const { phone, name, delay_minutes, message_template, property_title } = event.data
        await step.sleep('wait-before-followup', `${delay_minutes}m`)
        const message = interpolateTemplate(message_template, {
            name: name || 'visitante',
            property: property_title || 'nossos imóveis',
        })
        try {
            await sendWhatsAppMessage({ phone, message })
            return { success: true }
        } catch (error) {
            return { success: false, error: String(error) }
        }
    }
)

export const sendWhatsAppRescue = inngest.createFunction(
    { id: 'send-whatsapp-rescue', name: 'Send WhatsApp Rescue Message' },
    { event: 'lead/schedule-whatsapp-rescue' },
    async ({ event, step }) => {
        const { lead_id, phone, name, delay_minutes } = event.data
        if (!lead_id || !phone) return { skipped: true, reason: 'missing lead_id or phone' }

        const supabase = getSupabase()
        const { data: rescueConfigs } = await supabase
            .from('app_config')
            .select('key, value')
            .in('key', [
                'whatsapp_rescue_enabled',
                'whatsapp_rescue_delay_minutes',
                'whatsapp_rescue_max_attempts',
                'whatsapp_rescue_message_template',
            ])

        const rescueConfigMap = new Map<string, string>(
            (rescueConfigs || []).map((row: { key: string; value: string }) => [row.key, row.value])
        )

        const rescueEnabled = rescueConfigMap.get('whatsapp_rescue_enabled') !== 'false'
        if (!rescueEnabled) return { skipped: true, reason: 'whatsapp rescue disabled by admin' }

        const configuredDelay = Number(rescueConfigMap.get('whatsapp_rescue_delay_minutes') || '')
        const delayMinutes = Number.isFinite(configuredDelay) && configuredDelay > 0
            ? configuredDelay
            : Math.max(1, Number(delay_minutes || 5))

        await step.sleep('wait-before-whatsapp-rescue', `${delayMinutes}m`)

        const { data: lead, error } = await supabase
            .from('leads')
            .select('id, name, phone, phone_e164, visitor_id, landing_page_id, conversation_started_at, metadata')
            .eq('id', lead_id)
            .maybeSingle()

        if (error) return { success: false, error: String(error) }
        if (!lead) return { skipped: true, reason: 'lead not found' }
        if (lead.conversation_started_at) return { skipped: true, reason: 'conversation already started' }

        const metadata = (lead.metadata || {}) as Record<string, unknown>
        const rescueCount = Number(metadata.whatsapp_rescue_attempts || 0)
        const configuredMaxAttempts = Number(rescueConfigMap.get('whatsapp_rescue_max_attempts') || '')
        const maxAttempts = Number.isFinite(configuredMaxAttempts) && configuredMaxAttempts > 0
            ? configuredMaxAttempts
            : 2
        if (rescueCount >= maxAttempts) return { skipped: true, reason: 'rescue limit reached' }

        const template = rescueConfigMap.get('whatsapp_rescue_message_template') ||
            'Oi {nome_lead}! Vi seu cadastro e estou por aqui para te ajudar. Se quiser, ja te explico tudo rapidinho por aqui.'

        const message = interpolateTemplate(template, {
            name: lead.name || name || 'visitante',
            nome_lead: lead.name || name || 'visitante',
        })

        await sendWhatsAppMessage({
            phone: (lead.phone_e164 as string) || (lead.phone as string) || phone,
            message,
        })

        const now = new Date().toISOString()
        await supabase
            .from('leads')
            .update({
                metadata: {
                    ...metadata,
                    whatsapp_rescue_attempts: rescueCount + 1,
                    last_whatsapp_rescue_at: now,
                },
                updated_at: now,
            })
            .eq('id', lead.id)

        if (lead.visitor_id) {
            await supabase.from('funnel_events').insert({
                visitor_id: lead.visitor_id,
                lead_id: lead.id,
                landing_page_id: lead.landing_page_id || null,
                event_type: 'whatsapp_rescue_sent',
                metadata: {
                    attempts: rescueCount + 1,
                },
            })
        }

        return { success: true, lead_id: lead.id, attempts: rescueCount + 1 }
    }
)

export const runWhatsAppFollowupFlow = inngest.createFunction(
    { id: 'run-whatsapp-followup-flow', name: 'Run WhatsApp Follow-up Flow' },
    { event: 'lead/schedule-whatsapp-followup-flow' },
    async ({ event, step }) => {
        const { lead_id, phone, name } = event.data
        if (!lead_id || !phone) return { skipped: true, reason: 'missing lead_id or phone' }

        const supabase = getSupabase()
        const { data: cfgRows } = await supabase
            .from('app_config')
            .select('key, value')
            .in('key', [
                'whatsapp_rescue_enabled',
                'whatsapp_followup_enabled',
                'whatsapp_followup_schedule_json',
                'whatsapp_followup_message_template',
                'whatsapp_rescue_message_template',
                'agent_default_instance_id',
            ])

        const cfg = new Map<string, string>((cfgRows || []).map((r: { key: string; value: string }) => [r.key, r.value]))
        const rescueEnabled = cfg.get('whatsapp_rescue_enabled') !== 'false'
        const followupEnabled = cfg.get('whatsapp_followup_enabled') !== 'false'
        if (!rescueEnabled || !followupEnabled) return { skipped: true, reason: 'followup disabled by admin' }

        const schedule = buildFollowupOffsetsFromConfig(cfg.get('whatsapp_followup_schedule_json'))

        const template = cfg.get('whatsapp_followup_message_template')
            || cfg.get('whatsapp_rescue_message_template')
            || 'Oi {nome_lead}! Passando para saber se posso te ajudar com mais detalhes.'

        let defaultInstanceToken: string | null = null
        let defaultInstanceId: string | null = null
        let defaultBrokerId: string | null = null
        const defaultInstanceCfgId = cfg.get('agent_default_instance_id') || null
        if (defaultInstanceCfgId) {
            const { data: inst } = await supabase
                .from('whatsapp_instances')
                .select('id, instance_token, broker_id')
                .eq('id', defaultInstanceCfgId)
                .maybeSingle()
            if (inst?.instance_token) {
                defaultInstanceToken = inst.instance_token
                defaultInstanceId = inst.id
                defaultBrokerId = inst.broker_id || null
            }
        }

        let previous = 0
        let attemptsSent = 0
        for (let i = 0; i < schedule.length; i++) {
            const targetMinutes = schedule[i]
            const sleepMinutes = Math.max(1, targetMinutes - previous)
            previous = targetMinutes
            await step.sleep(`wait-followup-${i + 1}`, `${sleepMinutes}m`)

            const { data: lead, error } = await supabase
                .from('leads')
                .select('id, name, phone, phone_e164, visitor_id, landing_page_id, conversation_started_at, metadata')
                .eq('id', lead_id)
                .maybeSingle()

            if (error || !lead) return { success: false, error: String(error || 'lead not found') }
            if (lead.conversation_started_at) {
                if (lead.visitor_id) {
                    await supabase.from('funnel_events').insert({
                        visitor_id: lead.visitor_id,
                        lead_id: lead.id,
                        landing_page_id: lead.landing_page_id || null,
                        event_type: 'whatsapp_followup_stopped_replied',
                        metadata: { stopped_at_attempt: i + 1 },
                    })
                }
                return { success: true, stopped: 'lead_replied', attemptsSent }
            }

            const msg = interpolateTemplate(template, {
                name: lead.name || name || 'visitante',
                nome_lead: lead.name || name || 'visitante',
            })

            await sendWhatsAppMessage({
                phone: (lead.phone_e164 as string) || (lead.phone as string) || phone,
                message: msg,
                instanceToken: defaultInstanceToken || undefined,
            })

            attemptsSent += 1
            const now = new Date().toISOString()
            const metadata = (lead.metadata || {}) as Record<string, unknown>
            await supabase
                .from('leads')
                .update({
                    metadata: {
                        ...metadata,
                        whatsapp_followup_attempts: attemptsSent,
                        last_whatsapp_followup_at: now,
                    },
                    updated_at: now,
                })
                .eq('id', lead.id)

            if (lead.visitor_id) {
                await supabase.from('funnel_events').insert({
                    visitor_id: lead.visitor_id,
                    lead_id: lead.id,
                    landing_page_id: lead.landing_page_id || null,
                    event_type: 'whatsapp_followup_sent',
                    metadata: {
                        attempt: attemptsSent,
                        minute_offset: targetMinutes,
                    },
                })
            }

            // Garante memória do follow-up na conversa para o agente não soar "primeiro contato".
            if (defaultBrokerId) {
                const cleanPhone = ((lead.phone_e164 as string) || (lead.phone as string) || phone || '').replace(/\D/g, '')
                if (cleanPhone) {
                    const { data: existingConv } = await supabase
                        .from('whatsapp_ai_conversations')
                        .select('id, messages')
                        .eq('broker_id', defaultBrokerId)
                        .eq('lead_phone', cleanPhone)
                        .in('status', ['active', 'human_takeover', 'transferred'])
                        .order('updated_at', { ascending: false })
                        .limit(1)
                        .maybeSingle()

                    const assistantMsg = {
                        role: 'assistant',
                        content: msg,
                        type: 'text',
                        source: 'followup',
                        timestamp: now,
                    }

                    if (existingConv?.id) {
                        const current = Array.isArray(existingConv.messages) ? existingConv.messages : []
                        await supabase
                            .from('whatsapp_ai_conversations')
                            .update({ messages: [...current, assistantMsg], updated_at: now })
                            .eq('id', existingConv.id)
                    } else {
                        await supabase
                            .from('whatsapp_ai_conversations')
                            .insert({
                                lead_id: lead.id,
                                broker_id: defaultBrokerId,
                                instance_id: defaultInstanceId,
                                lead_phone: cleanPhone,
                                messages: [assistantMsg],
                                bot_message_ids: [],
                                status: 'active',
                            })
                    }
                }
            }
        }

        return { success: true, attemptsSent }
    }
)

export const vipAlert = inngest.createFunction(
    { id: 'vip-lead-alert', name: 'VIP Lead Alert to Realtor' },
    { event: 'lead/vip-detected' },
    async ({ event }) => {
        const { name, phone, property_title, ai_summary } = event.data
        const supabase = getSupabase()
        const { data: config } = await supabase.from('app_config').select('value').eq('key', 'realtor_phone').single()

        if (!config?.value) return { skipped: true, reason: 'no realtor phone configured' }

        const message = `🔥 *LEAD VIP DETECTADO!*\n\n👤 Nome: ${name || 'Não informado'}\n📱 Telefone: ${phone || 'Não informado'}\n🏠 Imóvel: ${property_title || 'N/A'}\n\n📊 *Resumo da IA:*\n${ai_summary || 'Sem resumo disponível'}\n\n⚡ Entre em contato agora!`

        try {
            await sendWhatsAppMessage({ phone: config.value, message })
            return { success: true }
        } catch (error) {
            return { success: false, error: String(error) }
        }
    }
)

export const processAutomationRule = inngest.createFunction(
    { id: 'process-automation-rule', name: 'Process Automation Rule' },
    { event: 'automation/execute-rule' },
    async ({ event, step }) => {
        const { rule_id, lead_id, phone, name, delay_minutes, message_template, property_title } = event.data
        if (delay_minutes > 0) await step.sleep('wait-for-rule', `${delay_minutes}m`)

        const message = interpolateTemplate(message_template, { name: name || 'visitante', property: property_title || 'nossos imóveis' })
        const supabase = getSupabase()

        try {
            await sendWhatsAppMessage({ phone, message })
            await supabase.from('lp_message_queue').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('lead_id', lead_id).eq('rule_id', rule_id).eq('status', 'pending')
            return { success: true }
        } catch (error) {
            await supabase.from('lp_message_queue').update({ status: 'failed' }).eq('lead_id', lead_id).eq('rule_id', rule_id).eq('status', 'pending')
            return { success: false, error: String(error) }
        }
    }
)

export const runAgentWorkflow = inngest.createFunction(
    { id: 'run-agent-workflow', name: 'Run Agent Workflow' },
    { event: 'automation/run-agent-workflow' },
    async ({ event, step }) => {
        const { workflow_id, lead_id, phone, name, trigger_type, context } = event.data
        if (!workflow_id) return { skipped: true, reason: 'missing workflow_id' }

        const supabase = getSupabase()
        const { data: workflow, error: workflowError } = await supabase
            .from('agent_workflows')
            .select('*')
            .eq('id', workflow_id)
            .maybeSingle()

        if (workflowError || !workflow) return { success: false, error: String(workflowError || 'workflow not found') }
        if (!workflow.is_active) return { skipped: true, reason: 'workflow_inactive' }

        let lead: any = null
        if (lead_id) {
            const leadRes = await supabase
                .from('leads')
                .select('id, name, phone, phone_e164, visitor_id, landing_page_id, conversation_started_at, metadata, lead_purpose, lead_budget, lead_timeframe, ai_summary')
                .eq('id', lead_id)
                .maybeSingle()
            lead = leadRes.data || null
        }

        const leadPhone = normalizeWorkflowPhone(lead?.phone_e164 || lead?.phone || phone)
        if (!leadPhone) return { skipped: true, reason: 'missing_phone' }

        const leadName = lead?.name || name || 'visitante'
        if ((trigger_type || workflow.trigger_type) !== 'manual') {
            const { data: state } = await supabase
                .from('agent_workflow_lead_state')
                .select('id, status, updated_at')
                .eq('workflow_id', workflow_id)
                .eq('lead_phone', leadPhone)
                .maybeSingle()
            if (state && ['queued', 'running', 'waiting'].includes(String(state.status))) {
                return { skipped: true, reason: 'workflow_already_running_for_lead' }
            }
        }

        let instanceId = workflow.instance_id || null
        let brokerId = workflow.broker_id || null
        let instanceToken: string | null = null

        if (instanceId) {
            const { data: instance } = await supabase
                .from('whatsapp_instances')
                .select('id, instance_token, broker_id')
                .eq('id', instanceId)
                .maybeSingle()
            instanceToken = instance?.instance_token || null
            brokerId = brokerId || instance?.broker_id || null
        }

        if (!instanceToken && brokerId) {
            const { data: instance } = await supabase
                .from('whatsapp_instances')
                .select('id, instance_token, broker_id')
                .eq('broker_id', brokerId)
                .eq('status', 'connected')
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            instanceToken = instance?.instance_token || null
            instanceId = instance?.id || instanceId
        }

        if (!instanceToken) return { skipped: true, reason: 'no_instance_token' }

        const now = new Date().toISOString()
        const { data: run } = await supabase
            .from('agent_workflow_runs')
            .insert([{
                workflow_id,
                lead_id: lead?.id || lead_id || null,
                broker_id: brokerId,
                instance_id: instanceId,
                lead_phone: leadPhone,
                lead_name: leadName,
                status: 'running',
                trigger_type: trigger_type || workflow.trigger_type,
                context: context || {},
                started_at: now,
            }])
            .select('id')
            .single()

        try {
            await logWorkflowEvent({
                supabase,
                runId: run?.id,
                workflowId: workflow_id,
                leadId: lead?.id || lead_id || null,
                brokerId,
                instanceId,
                leadPhone,
                eventType: 'workflow_started',
                status: 'running',
                metadata: { trigger_type: trigger_type || workflow.trigger_type },
            })
            await upsertWorkflowLeadState({
                supabase,
                workflowId: workflow_id,
                leadId: lead?.id || lead_id || null,
                leadPhone,
                brokerId,
                instanceId,
                status: 'running',
                runId: run?.id,
                triggerType: trigger_type || workflow.trigger_type,
                metadata: context || {},
            })

            const actionSteps = workflowActionSteps(workflow)
            let sent = 0
            const nodeResults: any[] = []
            for (let index = 0; index < actionSteps.length; index++) {
                const action = actionSteps[index]
                const waitPlan = workflowStepWaitPlan(workflow, lead, action)

                if (waitPlan.totalMinutes > 0) {
                    await supabase
                        .from('agent_workflow_runs')
                        .update({
                            status: 'waiting',
                            current_node_id: action.waitNodeId,
                            scheduled_for: waitPlan.scheduledFor,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', run?.id)
                    await logWorkflowEvent({
                        supabase,
                        runId: run?.id,
                        workflowId: workflow_id,
                        leadId: lead?.id || lead_id || null,
                        brokerId,
                        instanceId,
                        leadPhone,
                        eventType: 'workflow_waiting',
                        nodeId: action.waitNodeId,
                        status: 'waiting',
                        metadata: {
                            delay_minutes: waitPlan.totalMinutes,
                            base_delay_minutes: waitPlan.baseDelay,
                            policy_delay_minutes: waitPlan.policyDelay,
                            policy_reason: waitPlan.policyReason,
                            preferred_send_time: workflow.preferred_send_time || 'same_time',
                            scheduled_for: waitPlan.scheduledFor,
                            step: index + 1,
                        },
                    })
                    await upsertWorkflowLeadState({
                        supabase,
                        workflowId: workflow_id,
                        leadId: lead?.id || lead_id || null,
                        leadPhone,
                        brokerId,
                        instanceId,
                        status: 'waiting',
                        runId: run?.id,
                        triggerType: trigger_type || workflow.trigger_type,
                        nextAllowedAt: waitPlan.scheduledFor,
                        metadata: {
                            ...(context || {}),
                            step: index + 1,
                            preferred_send_time: workflow.preferred_send_time || 'same_time',
                            policy_reason: waitPlan.policyReason,
                        },
                    })
                    await step.sleep(`workflow-delay-${index + 1}`, `${waitPlan.totalMinutes}m`)
                }

                if (action.stopIfReplied) {
                    const repliedAt = await leadHasRepliedAfterWorkflowStarted(supabase, lead?.id || lead_id || null)
                    if (repliedAt) {
                        const finishedAt = new Date().toISOString()
                        await supabase
                            .from('agent_workflow_runs')
                            .update({
                                status: 'stopped',
                                stopped_reason: 'lead_replied',
                                current_node_id: action.messageNodeId,
                                completed_at: finishedAt,
                                updated_at: finishedAt,
                            })
                            .eq('id', run?.id)
                        await logWorkflowEvent({
                            supabase,
                            runId: run?.id,
                            workflowId: workflow_id,
                            leadId: lead?.id || lead_id || null,
                            brokerId,
                            instanceId,
                            leadPhone,
                            eventType: 'workflow_stopped',
                            nodeId: action.messageNodeId,
                            status: 'stopped',
                            message: 'Lead respondeu antes desta etapa.',
                            metadata: { reason: 'lead_replied', step: index + 1 },
                        })
                        await upsertWorkflowLeadState({
                            supabase,
                            workflowId: workflow_id,
                            leadId: lead?.id || lead_id || null,
                            leadPhone,
                            brokerId,
                            instanceId,
                            status: 'stopped',
                            runId: run?.id,
                            triggerType: trigger_type || workflow.trigger_type,
                            lastRepliedAt: repliedAt,
                            metadata: { reason: 'lead_replied', step: index + 1 },
                        })
                        return { success: true, stopped: 'lead_replied', sent }
                    }
                }

                if (workflow.wait_for_online === true) {
                    const maxOnlineWaitMinutes = Math.max(5, Math.min(240, Number(workflow?.metadata?.online_wait_max_minutes || 60)))
                    const checkEveryMinutes = Math.max(1, Math.min(15, Number(workflow?.metadata?.online_check_interval_minutes || 5)))
                    const maxChecks = Math.max(1, Math.ceil(maxOnlineWaitMinutes / checkEveryMinutes))
                    let onlineReady = false

                    for (let checkIndex = 0; checkIndex <= maxChecks; checkIndex++) {
                        const presence = await getLeadOnlinePresence({ supabase, instanceId, phone: leadPhone })
                        if (presence.isOnline) {
                            onlineReady = true
                            await logWorkflowEvent({
                                supabase,
                                runId: run?.id,
                                workflowId: workflow_id,
                                leadId: lead?.id || lead_id || null,
                                brokerId,
                                instanceId,
                                leadPhone,
                                eventType: 'lead_online_detected',
                                nodeId: action.messageNodeId,
                                status: 'running',
                                metadata: { step: index + 1, presence },
                            })
                            break
                        }

                        if (checkIndex >= maxChecks) {
                            await logWorkflowEvent({
                                supabase,
                                runId: run?.id,
                                workflowId: workflow_id,
                                leadId: lead?.id || lead_id || null,
                                brokerId,
                                instanceId,
                                leadPhone,
                                eventType: 'lead_online_wait_timeout',
                                nodeId: action.messageNodeId,
                                status: 'waiting',
                                metadata: { step: index + 1, presence, max_online_wait_minutes: maxOnlineWaitMinutes },
                            })
                            break
                        }

                        const nextCheckAt = new Date(Date.now() + checkEveryMinutes * 60_000).toISOString()
                        await supabase
                            .from('agent_workflow_runs')
                            .update({
                                status: 'waiting',
                                current_node_id: action.messageNodeId,
                                scheduled_for: nextCheckAt,
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', run?.id)
                        await logWorkflowEvent({
                            supabase,
                            runId: run?.id,
                            workflowId: workflow_id,
                            leadId: lead?.id || lead_id || null,
                            brokerId,
                            instanceId,
                            leadPhone,
                            eventType: 'waiting_for_lead_online',
                            nodeId: action.messageNodeId,
                            status: 'waiting',
                            metadata: {
                                step: index + 1,
                                check: checkIndex + 1,
                                check_every_minutes: checkEveryMinutes,
                                next_check_at: nextCheckAt,
                                presence,
                            },
                        })
                        await upsertWorkflowLeadState({
                            supabase,
                            workflowId: workflow_id,
                            leadId: lead?.id || lead_id || null,
                            leadPhone,
                            brokerId,
                            instanceId,
                            status: 'waiting',
                            runId: run?.id,
                            triggerType: trigger_type || workflow.trigger_type,
                            nextAllowedAt: nextCheckAt,
                            metadata: {
                                ...(context || {}),
                                step: index + 1,
                                waiting_for_online: true,
                                presence_reason: presence.reason,
                            },
                        })
                        await step.sleep(`workflow-online-wait-${index + 1}-${checkIndex + 1}`, `${checkEveryMinutes}m`)

                        if (action.stopIfReplied) {
                            const repliedAt = await leadHasRepliedAfterWorkflowStarted(supabase, lead?.id || lead_id || null)
                            if (repliedAt) {
                                const finishedAt = new Date().toISOString()
                                await supabase
                                    .from('agent_workflow_runs')
                                    .update({
                                        status: 'stopped',
                                        stopped_reason: 'lead_replied',
                                        current_node_id: action.messageNodeId,
                                        completed_at: finishedAt,
                                        updated_at: finishedAt,
                                    })
                                    .eq('id', run?.id)
                                await logWorkflowEvent({
                                    supabase,
                                    runId: run?.id,
                                    workflowId: workflow_id,
                                    leadId: lead?.id || lead_id || null,
                                    brokerId,
                                    instanceId,
                                    leadPhone,
                                    eventType: 'workflow_stopped',
                                    nodeId: action.messageNodeId,
                                    status: 'stopped',
                                    message: 'Lead respondeu durante espera online.',
                                    metadata: { reason: 'lead_replied', step: index + 1 },
                                })
                                return { success: true, stopped: 'lead_replied', sent }
                            }
                        }
                    }

                    if (!onlineReady) {
                        await upsertWorkflowLeadState({
                            supabase,
                            workflowId: workflow_id,
                            leadId: lead?.id || lead_id || null,
                            leadPhone,
                            brokerId,
                            instanceId,
                            status: 'running',
                            runId: run?.id,
                            triggerType: trigger_type || workflow.trigger_type,
                            metadata: {
                                ...(context || {}),
                                step: index + 1,
                                online_wait_fallback: true,
                            },
                        })
                    }
                }

                const variables = {
                    workflow_id,
                    workflowId: workflow_id,
                    name: leadName,
                    nome_lead: leadName,
                    phone: leadPhone,
                    telefone: leadPhone,
                    budget: lead?.lead_budget || '',
                    prazo: lead?.lead_timeframe || '',
                    finalidade: lead?.lead_purpose || '',
                }

                if (action.actionType === 'wait_only') {
                    await logWorkflowEvent({
                        supabase,
                        runId: run?.id,
                        workflowId: workflow_id,
                        leadId: lead?.id || lead_id || null,
                        brokerId,
                        instanceId,
                        leadPhone,
                        eventType: 'workflow_waited',
                        nodeId: action.waitNodeId,
                        status: 'completed',
                        message: 'Espera concluida sem envio.',
                        metadata: { step: index + 1, delay_minutes: action.delayMinutes },
                    })
                    continue
                }

                await supabase
                    .from('agent_workflow_runs')
                    .update({
                        status: 'running',
                        current_node_id: action.messageNodeId,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', run?.id)

                const sentAction = await sendWorkflowWhatsAppAction({
                    phone: leadPhone,
                    instanceToken,
                    step: {
                        id: action.id,
                        action_type: action.actionType,
                        action_payload: action.actionPayload,
                        message_template: action.messageTemplate,
                    },
                    variables,
                })
                sent += 1
                const sentAt = new Date().toISOString()
                nodeResults.push({
                    node_id: action.messageNodeId,
                    step_id: action.id,
                    type: sentAction.type,
                    status: 'sent',
                    sent_at: sentAt,
                })
                await logWorkflowEvent({
                    supabase,
                    runId: run?.id,
                    workflowId: workflow_id,
                    leadId: lead?.id || lead_id || null,
                    brokerId,
                    instanceId,
                    leadPhone,
                    eventType: 'message_sent',
                    nodeId: action.messageNodeId,
                    status: 'sent',
                    message: sentAction.message.slice(0, 500),
                    metadata: { preview: sentAction.preview.slice(0, 120), action_type: sentAction.type, step: index + 1 },
                })

                await appendWorkflowMessageToConversation({
                    supabase,
                    brokerId,
                    instanceId,
                    leadId: lead?.id || lead_id || null,
                    phone: leadPhone,
                    message: sentAction.message,
                    workflowId: workflow_id,
                })
            }

            await supabase
                .from('agent_workflow_runs')
                .update({
                    status: sent > 0 ? 'sent' : 'completed',
                    completed_at: new Date().toISOString(),
                    attempt_count: sent,
                    last_message_at: sent > 0 ? new Date().toISOString() : null,
                    node_results: nodeResults,
                    updated_at: new Date().toISOString(),
                    context: {
                        ...(context || {}),
                        messages_sent: sent,
                    },
                })
                .eq('id', run?.id)
            await logWorkflowEvent({
                supabase,
                runId: run?.id,
                workflowId: workflow_id,
                leadId: lead?.id || lead_id || null,
                brokerId,
                instanceId,
                leadPhone,
                eventType: 'workflow_completed',
                status: sent > 0 ? 'sent' : 'completed',
                metadata: { messages_sent: sent },
            })
            await upsertWorkflowLeadState({
                supabase,
                workflowId: workflow_id,
                leadId: lead?.id || lead_id || null,
                leadPhone,
                brokerId,
                instanceId,
                status: sent > 0 ? 'sent' : 'completed',
                runId: run?.id,
                triggerType: trigger_type || workflow.trigger_type,
                lastSentAt: sent > 0 ? new Date().toISOString() : null,
                metadata: { messages_sent: sent },
            })

            return { success: true, sent }
        } catch (error) {
            const failedAt = new Date().toISOString()
            await supabase
                .from('agent_workflow_runs')
                .update({
                    status: 'failed',
                    error_message: String(error instanceof Error ? error.message : error),
                    completed_at: failedAt,
                    updated_at: failedAt,
                })
                .eq('id', run?.id)
            await logWorkflowEvent({
                supabase,
                runId: run?.id,
                workflowId: workflow_id,
                leadId: lead?.id || lead_id || null,
                brokerId,
                instanceId,
                leadPhone,
                eventType: 'workflow_failed',
                status: 'failed',
                message: String(error instanceof Error ? error.message : error),
            })
            await upsertWorkflowLeadState({
                supabase,
                workflowId: workflow_id,
                leadId: lead?.id || lead_id || null,
                leadPhone,
                brokerId,
                instanceId,
                status: 'failed',
                runId: run?.id,
                triggerType: trigger_type || workflow.trigger_type,
                metadata: { error: String(error instanceof Error ? error.message : error) },
            })
            return { success: false, error: String(error) }
        }
    }
)

// EXPORT ALL FUNCTIONS
export const functions = [
    sendWelcome,
    sendFollowUp,
    sendWhatsAppRescue,
    runWhatsAppFollowupFlow,
    vipAlert,
    processAutomationRule,
    runAgentWorkflow,
    // Ads / Tráfego IA
    publishCampaign,
    pollMetricsCron,
    aiAnalyzeMetrics,
    executeAiAction,
    dailyReportCron,
    syncMetaLeadsCron,
    generateDailyPilgerReportCron,
    generateWeeklyPilgerReportCron,
    radarCollectionCron,
    // WhatsApp Agent IA
    processWhatsAppMessage,
    detectHumanTakeover,
    shadowAgentResponse,
    reliableMarkAsRead,
    whatsappKeepOnline,
    // WhatsApp Instance Setup
    whatsappInstanceSetup
]
