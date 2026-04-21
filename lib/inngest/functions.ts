import { inngest } from './client'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsAppMessage, interpolateTemplate } from '../uazapi'
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

// EXPORT ALL FUNCTIONS
export const functions = [
    sendWelcome,
    sendFollowUp,
    sendWhatsAppRescue,
    runWhatsAppFollowupFlow,
    vipAlert,
    processAutomationRule,
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
