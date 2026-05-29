type JsonRecord = Record<string, any>

function asRecord(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function normalizePhone(value: unknown) {
    let digits = String(value || '').replace(/\D/g, '')
    if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) digits = `55${digits}`
    return digits
}

function phoneVariants(value: unknown) {
    const phone = normalizePhone(value)
    const variants = new Set<string>()
    if (phone) variants.add(phone)
    if (phone.startsWith('55') && phone.length > 11) variants.add(phone.slice(2))
    if (phone.length > 11) variants.add(phone.slice(-11))
    return [...variants].filter(Boolean)
}

function clean(value: unknown, fallback = '') {
    return String(value || fallback).trim()
}

function recentArray(value: unknown, limit = 80) {
    return Array.isArray(value) ? value.slice(-limit) : []
}

function buildPhoneOrFilter(variants: string[]) {
    const safe = variants.map(item => item.replace(/\D/g, '')).filter(Boolean)
    return `phone.in.(${safe.join(',')}),phone_e164.in.(${safe.join(',')})`
}

function findButton(metadata: JsonRecord, responseId: string, responseTitle: string) {
    const buttons = Array.isArray(metadata.buttons) ? metadata.buttons : []
    const normalizedId = responseId.toLowerCase()
    const normalizedTitle = responseTitle.toLowerCase()

    return buttons.find((button: JsonRecord) => {
        const candidates = [
            button.id,
            button.label,
            button.action,
            button.value,
            button.url ? `url:${button.url}` : '',
        ].map(item => clean(item).toLowerCase()).filter(Boolean)

        return candidates.includes(normalizedId) || candidates.includes(normalizedTitle)
    }) || null
}

async function appendLeadEventInteraction(supabase: any, variants: string[], interaction: JsonRecord) {
    if (!variants.length) return
    const { data: lead } = await supabase
        .from('leads')
        .select('id, metadata')
        .or(buildPhoneOrFilter(variants))
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (!lead?.id) return

    const metadata = asRecord(lead.metadata)
    const previous = recentArray(metadata.event_interactions)
    const next = [...previous, interaction].slice(-80)

    await supabase
        .from('leads')
        .update({
            metadata: {
                ...metadata,
                last_event_interaction: interaction,
                event_interactions: next,
            },
            updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id)
}

export async function trackEventInteractionFromWhatsApp(supabase: any, params: {
    phone: string
    messageType: string
    buttonResponseId?: string | null
    buttonResponseTitle?: string | null
    pollVotes?: unknown
    messageId?: string | null
    instanceId?: string | null
    instanceName?: string | null
}) {
    const variants = phoneVariants(params.phone)
    if (!variants.length) return { tracked: false, reason: 'missing_phone' }
    if (!['button_response', 'poll_response'].includes(params.messageType)) {
        return { tracked: false, reason: 'not_interactive' }
    }

    const { data: registrations, error: registrationError } = await supabase
        .from('event_registrations')
        .select('*')
        .in('phone', variants)
        .order('created_at', { ascending: false })
        .limit(10)

    if (registrationError) throw registrationError
    if (!registrations?.length) return { tracked: false, reason: 'registration_not_found' }

    const registrationIds = registrations.map((row: JsonRecord) => row.id).filter(Boolean)
    const { data: queues } = await supabase
        .from('event_message_queue')
        .select('*')
        .in('registration_id', registrationIds)
        .eq('status', 'sent')
        .order('sent_at', { ascending: false })
        .limit(20)

    const interactiveQueues = (queues || []).filter((queue: JsonRecord) => {
        const metadata = asRecord(queue.metadata)
        return metadata.tracking_enabled !== false && ['buttons', 'poll', 'link_buttons'].includes(clean(metadata.interaction_type, 'none'))
    })

    const queue = interactiveQueues[0] || null
    const registration = registrations.find((row: JsonRecord) => row.id === queue?.registration_id) || registrations[0]
    const metadata = asRecord(queue?.metadata)
    const responseId = clean(params.buttonResponseId)
    const responseTitle = clean(params.buttonResponseTitle)
    const matchedButton = params.messageType === 'button_response'
        ? findButton(metadata, responseId, responseTitle)
        : null
    const pollVotes = Array.isArray(params.pollVotes)
        ? params.pollVotes.map(value => clean(value)).filter(Boolean)
        : clean(params.pollVotes)

    const interaction = {
        type: params.messageType === 'poll_response' ? 'poll_response' : 'button_response',
        event_id: queue?.event_id || registration.event_id,
        registration_id: registration.id,
        rule_id: queue?.rule_id || null,
        queue_id: queue?.id || null,
        tracking_tag: clean(metadata.tracking_tag, 'event_agent_interaction'),
        interaction_type: clean(metadata.interaction_type, params.messageType),
        button_id: responseId || clean(matchedButton?.id),
        button_label: responseTitle || clean(matchedButton?.label),
        button_action: clean(matchedButton?.action),
        button_value: clean(matchedButton?.value),
        button_url: clean(matchedButton?.url),
        poll_question: clean(asRecord(metadata.poll).question),
        poll_votes: pollVotes,
        message_id: clean(params.messageId),
        instance_id: clean(params.instanceId),
        instance_name: clean(params.instanceName),
        received_at: new Date().toISOString(),
    }

    const registrationMetadata = asRecord(registration.metadata)
    const previous = recentArray(registrationMetadata.event_interactions)
    if (interaction.message_id && previous.some(item => asRecord(item).message_id === interaction.message_id)) {
        return { tracked: false, reason: 'duplicate' }
    }

    await supabase
        .from('event_registrations')
        .update({
            metadata: {
                ...registrationMetadata,
                last_event_interaction: interaction,
                event_interactions: [...previous, interaction].slice(-80),
            },
            updated_at: new Date().toISOString(),
        })
        .eq('id', registration.id)

    if (queue?.id) {
        const queueMetadata = asRecord(queue.metadata)
        await supabase
            .from('event_message_queue')
            .update({
                metadata: {
                    ...queueMetadata,
                    last_response: interaction,
                    responses: [...recentArray(queueMetadata.responses, 40), interaction].slice(-40),
                },
            })
            .eq('id', queue.id)
    }

    await appendLeadEventInteraction(supabase, variants, interaction)

    await supabase.from('event_agent_logs').insert({
        event_id: interaction.event_id,
        registration_id: registration.id,
        rule_id: interaction.rule_id,
        message_queue_id: interaction.queue_id,
        action: 'event_interaction_tracked',
        message: interaction.button_label
            ? `Interacao registrada: ${interaction.button_label}.`
            : 'Interacao de enquete registrada.',
        metadata: interaction,
    })

    return { tracked: true, interaction }
}
