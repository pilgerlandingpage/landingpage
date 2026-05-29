import { resolveDefaultWhatsAppInstanceToken, sendLocationRequest, sendMenuMessage, sendWhatsAppMessage } from '@/lib/uazapi'
import { buildTrackedWhatsAppLink } from '@/lib/tracking/whatsapp-links'
import {
    DEFAULT_CONFIRMATION_TEMPLATE,
    DEFAULT_REMINDER_TEMPLATE,
    computeRuleSchedule,
    interpolateEventTemplate,
    normalizePhone,
    registrationMatchesSegment,
} from './utils'
import { appendEventInteractionLinks } from './automation-metadata'

function metadataRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function getRuleInteractionMetadata(rule: any) {
    const metadata = metadataRecord(rule?.metadata)
    const interactionType = String(metadata.interaction_type || 'none')
    if (!['buttons', 'poll', 'link_buttons', 'list', 'location_request'].includes(interactionType)) return {}
    return {
        interaction_type: interactionType,
        tracking_enabled: metadata.tracking_enabled !== false,
        tracking_tag: metadata.tracking_tag || 'event_agent_interaction',
        buttons: Array.isArray(metadata.buttons) ? metadata.buttons : [],
        poll: metadataRecord(metadata.poll),
    }
}

function messageQueueKey(row: any) {
    const ruleId = row?.rule_id ? String(row.rule_id) : ''
    if (ruleId) return `rule:${ruleId}`
    const metadata = metadataRecord(row?.metadata)
    return `fallback:${String(metadata.trigger_type || 'immediate')}`
}

function addEventTrackingParams(rawUrl: string, metadata: Record<string, any>) {
    try {
        const url = new URL(rawUrl)
        if (metadata.event_id) url.searchParams.set('event_id', String(metadata.event_id))
        if (metadata.registration_id) url.searchParams.set('event_registration_id', String(metadata.registration_id))
        if (metadata.queue_id) url.searchParams.set('event_queue_id', String(metadata.queue_id))
        if (metadata.rule_id) url.searchParams.set('event_rule_id', String(metadata.rule_id))
        if (metadata.tracking_tag) url.searchParams.set('event_tracking_tag', String(metadata.tracking_tag))
        return url.toString()
    } catch {
        return rawUrl
    }
}

function withTrackedEventButtons(buttons: any[], metadata: Record<string, any>, phone: string) {
    if (metadata.tracking_enabled === false) return buttons

    return buttons.map(button => {
        const url = String(button?.url || '').trim()
        if (!/^https?:\/\//i.test(url)) return button

        const trackedUrl = buildTrackedWhatsAppLink({
            url,
            leadPhone: phone,
            label: String(button.label || button.action || 'Evento'),
            title: String(metadata.event_title || 'Evento Guilherme Pilger'),
            type: String(button.action || 'event_button'),
            campaign: String(metadata.tracking_tag || 'event_agent_button'),
            content: String(button.id || button.action || button.label || 'event_button'),
            source: 'event_agent',
            medium: 'whatsapp',
        })

        return {
            ...button,
            url: addEventTrackingParams(trackedUrl, metadata),
        }
    })
}

async function sendEventQueueContent(params: {
    phone: string
    content: string
    metadata: Record<string, any>
    instanceToken?: string
}) {
    const interactionType = String(params.metadata.interaction_type || 'none')
    const buttons = withTrackedEventButtons(
        Array.isArray(params.metadata.buttons) ? params.metadata.buttons : [],
        params.metadata,
        params.phone
    )
    const trackedMetadata = { ...params.metadata, buttons }
    const poll = metadataRecord(params.metadata.poll)

    if (interactionType === 'location_request' && params.instanceToken) {
        if (params.content.trim()) {
            await sendWhatsAppMessage({
                phone: params.phone,
                message: params.content,
                instanceToken: params.instanceToken,
            })
        }

        return sendLocationRequest(
            params.phone,
            poll.question || 'Pode compartilhar sua localizacao?',
            params.instanceToken
        )
    }

    if ((interactionType === 'buttons' || interactionType === 'link_buttons' || interactionType === 'list') && buttons.length > 0 && params.instanceToken) {
        const choices = buttons
            .slice(0, interactionType === 'list' ? 10 : 3)
            .map((button: any) => {
                const label = String(button.label || button.value || button.action).slice(0, 42)
                const value = button.url ? `url:${button.url}` : (button.id || button.action || button.value)
                return `${label}|${value}`
            })
            .filter(choice => choice.split('|')[0])

        if (choices.length > 0) {
            return sendMenuMessage({
                phone: params.phone,
                text: params.content,
                type: interactionType === 'list' ? 'list' : 'button',
                choices,
                listButton: interactionType === 'list' ? 'Ver opcoes' : undefined,
                footerText: 'Guilherme Pilger',
                instanceToken: params.instanceToken,
            })
        }
    }

    if (interactionType === 'poll' && Array.isArray(poll.options) && poll.options.length >= 2 && params.instanceToken) {
        return sendMenuMessage({
            phone: params.phone,
            text: poll.question || params.content,
            type: 'poll',
            choices: poll.options.slice(0, 8).map((option: unknown) => String(option).slice(0, 48)),
            selectableCount: poll.multi_select ? Math.min(8, poll.options.length) : 1,
            instanceToken: params.instanceToken,
        })
    }

    return sendWhatsAppMessage({
        phone: params.phone,
        message: appendEventInteractionLinks(params.content, trackedMetadata),
        instanceToken: params.instanceToken,
    })
}

export async function resolveGlobalEventInstanceToken(supabase: any) {
    void supabase
    return resolveDefaultWhatsAppInstanceToken()
}

export async function logEventAgent(supabase: any, payload: {
    event_id?: string | null
    registration_id?: string | null
    rule_id?: string | null
    message_queue_id?: string | null
    level?: 'info' | 'warning' | 'error'
    action: string
    message?: string | null
    metadata?: Record<string, unknown>
}) {
    try {
        await supabase.from('event_agent_logs').insert({
            event_id: payload.event_id || null,
            registration_id: payload.registration_id || null,
            rule_id: payload.rule_id || null,
            message_queue_id: payload.message_queue_id || null,
            level: payload.level || 'info',
            action: payload.action,
            message: payload.message || null,
            metadata: payload.metadata || {},
        })
    } catch (err) {
        console.warn('[events] failed to write agent log', err)
    }
}

export async function enqueueRegistrationMessages(supabase: any, params: {
    event: any
    registration: any
    rules?: any[]
    publicUrl?: string
    leadInitiatedFirst?: boolean
}) {
    const { event, registration, publicUrl } = params
    const rules = params.rules || []
    const leadInitiatedFirst = params.leadInitiatedFirst === true
    const activeRules = rules.filter(rule => rule?.is_active !== false)
    const selectedRules = activeRules.length > 0
        ? activeRules
        : [{
            id: null,
            name: 'Confirmacao padrao',
            trigger_type: 'immediate',
            offset_minutes: 0,
            segment: 'all',
            message_template: event?.confirmation_message_template || DEFAULT_CONFIRMATION_TEMPLATE,
        }]

    const queueRows = selectedRules
        .filter(rule => registrationMatchesSegment(registration, rule.segment || 'all'))
        .map(rule => {
            const triggerType = String(rule.trigger_type || 'immediate')
            const skipFirstOutbound = leadInitiatedFirst && triggerType === 'immediate'
            const fallbackTemplate = triggerType === 'immediate'
                ? (event?.confirmation_message_template || DEFAULT_CONFIRMATION_TEMPLATE)
                : (event?.reminder_message_template || DEFAULT_REMINDER_TEMPLATE)
            const content = interpolateEventTemplate(rule.message_template || fallbackTemplate, {
                event,
                registration,
                publicUrl,
            })

            return {
                event_id: event.id,
                registration_id: registration.id,
                rule_id: rule.id || null,
                target_phone: normalizePhone(registration.phone),
                target_name: registration.full_name,
                content,
                scheduled_for: computeRuleSchedule(rule, event),
                status: skipFirstOutbound ? 'skipped' : 'pending',
                error_message: skipFirstOutbound
                    ? 'Fluxo alterado para WhatsApp iniciado pelo lead apos cadastro.'
                    : null,
                metadata: {
                    event_id: event.id,
                    event_title: event.title,
                    registration_id: registration.id,
                    rule_id: rule.id || null,
                    trigger_type: triggerType,
                    segment: rule.segment || 'all',
                    agent: 'eventos_guilherme_pilger',
                    delivery_strategy: skipFirstOutbound ? 'lead_initiated_first' : 'business_initiated',
                    skipped_reason: skipFirstOutbound ? 'cta_whatsapp_after_registration' : null,
                    ...getRuleInteractionMetadata(rule),
                },
            }
        })
        .filter(row => row.target_phone && row.content.trim())

    if (queueRows.length === 0) return []

    const { data: existingRows, error: existingError } = await supabase
        .from('event_message_queue')
        .select('rule_id, metadata')
        .eq('registration_id', registration.id)

    if (existingError) throw existingError

    const existingKeys = new Set((existingRows || []).map(messageQueueKey))
    const newQueueRows = queueRows.filter(row => !existingKeys.has(messageQueueKey(row)))

    if (newQueueRows.length === 0) return []

    const { data, error } = await supabase
        .from('event_message_queue')
        .insert(newQueueRows)
        .select('*')

    if (error) throw error

    await logEventAgent(supabase, {
        event_id: event.id,
        registration_id: registration.id,
        action: 'messages_queued',
        message: `${data?.length || 0} mensagens agendadas pelo Agente de Eventos.`,
        metadata: {
            queued: data?.length || 0,
            skipped_first_outbound: (data || []).filter((row: any) => row.status === 'skipped').length,
        },
    })

    return data || []
}

export async function sendQueuedEventMessage(supabase: any, queueId: string) {
    const { data: queue, error } = await supabase
        .from('event_message_queue')
        .select('*, event:event_events(*), registration:event_registrations(*)')
        .eq('id', queueId)
        .maybeSingle()

    if (error) throw error
    if (!queue) return { sent: false, reason: 'not_found' }
    if (queue.status !== 'pending') return { sent: false, reason: `status_${queue.status}` }
    if (new Date(queue.scheduled_for).getTime() > Date.now() + 30_000) {
        return { sent: false, reason: 'not_due' }
    }

    try {
        const instanceToken = await resolveGlobalEventInstanceToken(supabase)
        let response: any
        try {
            const queueMetadata: Record<string, any> = {
                ...metadataRecord(queue.metadata),
                event_id: queue.event_id,
                event_title: queue.event?.title,
                registration_id: queue.registration_id,
                rule_id: queue.rule_id,
                queue_id: queue.id,
            }
            response = await sendEventQueueContent({
                phone: queue.target_phone,
                content: queue.content,
                metadata: queueMetadata,
                instanceToken: instanceToken || undefined,
            })
        } catch (interactiveError) {
            const metadata: Record<string, any> = {
                ...metadataRecord(queue.metadata),
                event_id: queue.event_id,
                event_title: queue.event?.title,
                registration_id: queue.registration_id,
                rule_id: queue.rule_id,
                queue_id: queue.id,
            }
            if (!['buttons', 'poll', 'link_buttons', 'list', 'location_request'].includes(String(metadata.interaction_type || 'none'))) {
                throw interactiveError
            }
            response = await sendWhatsAppMessage({
                phone: queue.target_phone,
                message: appendEventInteractionLinks(queue.content, metadata),
                instanceToken: instanceToken || undefined,
            })
            await logEventAgent(supabase, {
                event_id: queue.event_id,
                registration_id: queue.registration_id,
                rule_id: queue.rule_id,
                message_queue_id: queue.id,
                level: 'warning',
                action: 'whatsapp_interactive_fallback',
                message: interactiveError instanceof Error ? interactiveError.message : String(interactiveError),
                metadata: { queue_id: queue.id, interaction_type: metadata.interaction_type || 'none' },
            })
        }

        await supabase
            .from('event_message_queue')
            .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                provider_response: response || null,
                error_message: null,
            })
            .eq('id', queue.id)

        await logEventAgent(supabase, {
            event_id: queue.event_id,
            registration_id: queue.registration_id,
            rule_id: queue.rule_id,
            message_queue_id: queue.id,
            action: 'whatsapp_sent',
            message: `Mensagem enviada para ${queue.target_name || queue.target_phone}.`,
            metadata: { queue_id: queue.id },
        })

        return { sent: true, queue_id: queue.id }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await supabase
            .from('event_message_queue')
            .update({
                status: 'failed',
                sent_at: new Date().toISOString(),
                error_message: message,
            })
            .eq('id', queue.id)

        await logEventAgent(supabase, {
            event_id: queue.event_id,
            registration_id: queue.registration_id,
            rule_id: queue.rule_id,
            message_queue_id: queue.id,
            level: 'error',
            action: 'whatsapp_failed',
            message,
            metadata: { queue_id: queue.id },
        })

        return { sent: false, reason: 'failed', error: message }
    }
}

export async function processDueEventMessages(supabase: any, limit = 20) {
    const { data, error } = await supabase
        .from('event_message_queue')
        .select('id')
        .eq('status', 'pending')
        .lte('scheduled_for', new Date().toISOString())
        .order('scheduled_for', { ascending: true })
        .limit(limit)

    if (error) throw error

    const results = []
    for (const row of data || []) {
        results.push(await sendQueuedEventMessage(supabase, row.id))
    }
    return results
}
