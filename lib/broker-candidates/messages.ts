import { getPublicAppUrl } from '@/lib/app-url'
import { buildTrackedWhatsAppLink } from '@/lib/tracking/whatsapp-links'
import { resolveDefaultWhatsAppInstanceToken, sendLocationRequest, sendMenuMessage, sendWhatsAppMessage } from '@/lib/uazapi'
import {
    DEFAULT_CANDIDATE_WELCOME_TEMPLATE,
    appendCandidateInteractionLinks,
    candidateMatchesSegment,
    computeCandidateRuleSchedule,
    interpolateCandidateTemplate,
    normalizePhone,
} from './utils'

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
        tracking_tag: metadata.tracking_tag || 'broker_candidate_interaction',
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

function addCandidateTrackingParams(rawUrl: string, metadata: Record<string, any>) {
    try {
        const url = new URL(rawUrl)
        if (metadata.candidate_id) url.searchParams.set('broker_candidate_id', String(metadata.candidate_id))
        if (metadata.queue_id) url.searchParams.set('broker_candidate_queue_id', String(metadata.queue_id))
        if (metadata.rule_id) url.searchParams.set('broker_candidate_rule_id', String(metadata.rule_id))
        if (metadata.tracking_tag) url.searchParams.set('broker_candidate_tracking_tag', String(metadata.tracking_tag))
        return url.toString()
    } catch {
        return rawUrl
    }
}

function withTrackedCandidateButtons(buttons: any[], metadata: Record<string, any>, phone: string) {
    if (metadata.tracking_enabled === false) return buttons

    return buttons.map(button => {
        const url = String(button?.url || '').trim()
        if (!/^https?:\/\//i.test(url)) return button

        const trackedUrl = buildTrackedWhatsAppLink({
            url,
            leadPhone: phone,
            label: String(button.label || button.action || 'Trabalhe Conosco'),
            title: String(metadata.candidate_name || 'Candidato corretor'),
            type: String(button.action || 'broker_candidate_button'),
            campaign: String(metadata.tracking_tag || 'broker_candidate_button'),
            content: String(button.id || button.action || button.label || 'broker_candidate_button'),
            source: 'broker_candidate_agent',
            medium: 'whatsapp',
        })

        return {
            ...button,
            url: addCandidateTrackingParams(trackedUrl, metadata),
        }
    })
}

async function sendCandidateQueueContent(params: {
    phone: string
    content: string
    metadata: Record<string, any>
    instanceToken?: string
}) {
    const interactionType = String(params.metadata.interaction_type || 'none')
    const buttons = withTrackedCandidateButtons(
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
        message: appendCandidateInteractionLinks(params.content, trackedMetadata),
        instanceToken: params.instanceToken,
    })
}

export async function resolveGlobalCandidateInstanceToken() {
    return resolveDefaultWhatsAppInstanceToken()
}

export async function logCandidateAgent(supabase: any, payload: {
    candidate_id?: string | null
    rule_id?: string | null
    message_queue_id?: string | null
    level?: 'info' | 'warning' | 'error'
    action: string
    message?: string | null
    metadata?: Record<string, unknown>
}) {
    try {
        await supabase.from('broker_candidate_agent_logs').insert({
            candidate_id: payload.candidate_id || null,
            rule_id: payload.rule_id || null,
            message_queue_id: payload.message_queue_id || null,
            level: payload.level || 'info',
            action: payload.action,
            message: payload.message || null,
            metadata: payload.metadata || {},
        })
    } catch (err) {
        console.warn('[broker-candidates] failed to write agent log', err)
    }
}

export async function enqueueCandidateMessages(supabase: any, params: {
    candidate: any
    rules?: any[]
    publicUrl?: string
    triggerType?: string
}) {
    const candidate = params.candidate
    const rules = params.rules || []
    const activeRules = rules.filter(rule => rule?.is_active !== false)
    const selectedRules = activeRules.length > 0
        ? activeRules
        : [{
            id: null,
            name: 'Boas-vindas padrao',
            trigger_type: 'immediate',
            offset_minutes: 0,
            segment: 'all',
            message_template: DEFAULT_CANDIDATE_WELCOME_TEMPLATE,
            metadata: { interaction_type: 'none', tracking_enabled: true, tracking_tag: 'broker_candidate_welcome' },
        }]

    const publicUrl = params.publicUrl || `${getPublicAppUrl()}/trabalhe-conosco`
    const triggerType = String(params.triggerType || '')
    const queueRows = selectedRules
        .filter(rule => !triggerType || rule.trigger_type === triggerType || (triggerType === 'created' && ['immediate', 'after_signup'].includes(rule.trigger_type)))
        .filter(rule => candidateMatchesSegment(candidate, rule.segment || 'all'))
        .map(rule => {
            const content = interpolateCandidateTemplate(rule.message_template || DEFAULT_CANDIDATE_WELCOME_TEMPLATE, {
                candidate,
                publicUrl,
            })

            return {
                candidate_id: candidate.id,
                rule_id: rule.id || null,
                target_phone: normalizePhone(candidate.phone),
                target_name: candidate.full_name,
                content,
                scheduled_for: computeCandidateRuleSchedule(rule, candidate),
                status: 'pending',
                metadata: {
                    candidate_id: candidate.id,
                    candidate_name: candidate.full_name,
                    rule_id: rule.id || null,
                    trigger_type: rule.trigger_type || 'immediate',
                    segment: rule.segment || 'all',
                    agent: 'broker_candidate_recruiter',
                    ...getRuleInteractionMetadata(rule),
                },
            }
        })
        .filter(row => row.target_phone && row.content.trim())

    if (queueRows.length === 0) return []

    const { data: existingRows, error: existingError } = await supabase
        .from('broker_candidate_message_queue')
        .select('rule_id, metadata')
        .eq('candidate_id', candidate.id)

    if (existingError) throw existingError

    const existingKeys = new Set((existingRows || []).map(messageQueueKey))
    const newQueueRows = queueRows.filter(row => !existingKeys.has(messageQueueKey(row)))
    if (newQueueRows.length === 0) return []

    const { data, error } = await supabase
        .from('broker_candidate_message_queue')
        .insert(newQueueRows)
        .select('*')

    if (error) throw error

    await logCandidateAgent(supabase, {
        candidate_id: candidate.id,
        action: 'messages_queued',
        message: `${data?.length || 0} mensagens agendadas pelo agente de recrutamento.`,
        metadata: { queued: data?.length || 0 },
    })

    return data || []
}

export async function sendQueuedCandidateMessage(supabase: any, queueId: string) {
    const { data: queue, error } = await supabase
        .from('broker_candidate_message_queue')
        .select('*, candidate:broker_candidates(*)')
        .eq('id', queueId)
        .maybeSingle()

    if (error) throw error
    if (!queue) return { sent: false, reason: 'not_found' }
    if (queue.status !== 'pending') return { sent: false, reason: `status_${queue.status}` }
    if (new Date(queue.scheduled_for).getTime() > Date.now() + 30_000) {
        return { sent: false, reason: 'not_due' }
    }

    try {
        const instanceToken = await resolveGlobalCandidateInstanceToken()
        let response: any
        const queueMetadata: Record<string, any> = {
            ...metadataRecord(queue.metadata),
            candidate_id: queue.candidate_id,
            candidate_name: queue.candidate?.full_name,
            rule_id: queue.rule_id,
            queue_id: queue.id,
        }

        try {
            response = await sendCandidateQueueContent({
                phone: queue.target_phone,
                content: queue.content,
                metadata: queueMetadata,
                instanceToken: instanceToken || undefined,
            })
        } catch (interactiveError) {
            if (!['buttons', 'poll', 'link_buttons', 'list', 'location_request'].includes(String(queueMetadata.interaction_type || 'none'))) {
                throw interactiveError
            }

            response = await sendWhatsAppMessage({
                phone: queue.target_phone,
                message: appendCandidateInteractionLinks(queue.content, queueMetadata),
                instanceToken: instanceToken || undefined,
            })

            await logCandidateAgent(supabase, {
                candidate_id: queue.candidate_id,
                rule_id: queue.rule_id,
                message_queue_id: queue.id,
                level: 'warning',
                action: 'whatsapp_interactive_fallback',
                message: interactiveError instanceof Error ? interactiveError.message : String(interactiveError),
                metadata: { queue_id: queue.id, interaction_type: queueMetadata.interaction_type || 'none' },
            })
        }

        await supabase
            .from('broker_candidate_message_queue')
            .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                provider_response: response || null,
                error_message: null,
            })
            .eq('id', queue.id)

        await logCandidateAgent(supabase, {
            candidate_id: queue.candidate_id,
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
            .from('broker_candidate_message_queue')
            .update({
                status: 'failed',
                sent_at: new Date().toISOString(),
                error_message: message,
            })
            .eq('id', queue.id)

        await logCandidateAgent(supabase, {
            candidate_id: queue.candidate_id,
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

export async function processDueCandidateMessages(supabase: any, limit = 20) {
    const { data, error } = await supabase
        .from('broker_candidate_message_queue')
        .select('id')
        .eq('status', 'pending')
        .lte('scheduled_for', new Date().toISOString())
        .order('scheduled_for', { ascending: true })
        .limit(limit)

    if (error) throw error

    const results = []
    for (const row of data || []) {
        results.push(await sendQueuedCandidateMessage(supabase, row.id))
    }
    return results
}
