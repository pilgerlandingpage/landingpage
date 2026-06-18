import { phoneCandidates } from '@/lib/whatsapp/lead-sync'
import type { AdminActorContext } from '@/lib/events/admin-auth'

export const LEAD_EXECUTIVE_BRIEF_VERSION = 'lead-executive-brief-v1'
export const PENDING_FOLLOWUP_SLA_HOURS = 24
export const SENT_FOLLOWUP_SLA_HOURS = 48

type SupabaseAdminLike = {
    from: (table: string) => any
}

type BriefLevel = 'high' | 'medium' | 'low'
type FollowupStatus = 'pending' | 'sent' | 'responded' | 'converted' | 'dismissed'

type LeadRow = {
    id: string
    name?: string | null
    email?: string | null
    phone?: string | null
    phone_e164?: string | null
    metadata?: Record<string, any> | null
    lead_score?: number | null
    lead_classification?: string | null
    ai_summary?: string | null
    visitor_id?: string | null
    created_at?: string | null
    updated_at?: string | null
}

type BrokerProfileRow = {
    id: string
    lead_id?: string | null
    lead_phone?: string | null
    lead_name?: string | null
    broker_id?: string | null
    status?: string | null
    created_at?: string | null
    updated_at?: string | null
}

type BrokerRow = {
    id: string
    name?: string | null
    is_active?: boolean | null
}

type ConversationRow = {
    id: string
    lead_id?: string | null
    broker_id?: string | null
    lead_phone?: string | null
    messages?: any[] | null
    summary?: string | null
    status?: string | null
    updated_at?: string | null
}

export type LeadExecutiveBriefSnapshot = {
    id: string | null
    version: string
    level: BriefLevel
    title: string
    summary: string
    risk: string
    next_action: string
    facts: Array<{ label: string; value: string; color: string }>
    signals: Record<string, any>
    source: string
    actor_type: string | null
    actor_id: string | null
    actor_name: string | null
    actor_email: string | null
    auth_user_id: string | null
    generated_at: string
}

export type LeadExecutiveBriefProcessResult = {
    processed_leads: number
    updated_leads: number
    inserted_history: number
    metadata_only: number
    high_risk: number
    medium_risk: number
    low_risk: number
    ai_narratives_requested: number
    ai_narratives_generated: number
    ai_narrative_skipped_reason: string | null
    generated_at: string
    source: string
    errors: string[]
}

function asRecord(value: any): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asString(value: any): string {
    return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: any): number {
    const number = Number(value)
    return Number.isFinite(number) ? number : 0
}

function ageHoursFrom(value: any, nowMs: number) {
    const time = Date.parse(String(value || ''))
    if (!Number.isFinite(time)) return null
    return Math.max(0, Math.floor((nowMs - time) / 36e5))
}

function missingBrokerProfilesTable(error: any) {
    return /broker_lead_profiles|schema cache|relation .* does not exist|could not find the table/i.test(String(error?.message || error || ''))
}

function missingBriefTable(error: any) {
    return /lead_executive_briefs|schema cache|relation .* does not exist|could not find the table/i.test(String(error?.message || error || ''))
}

function buildCollectedPhoneFilter(candidates: string[]) {
    const safe = candidates.map(candidate => candidate.replace(/[^0-9]/g, '')).filter(Boolean)
    return `lead_phone.in.(${safe.join(',')})`
}

function conversationKey(brokerId: string | null | undefined, phone: string | null | undefined) {
    const normalizedPhone = phoneCandidates(phone).find(Boolean)
    return brokerId && normalizedPhone ? `${brokerId}:${normalizedPhone}` : ''
}

function normalizeFollowupStatus(value: any): FollowupStatus {
    const status = String(value || '').toLowerCase()
    if (status === 'sent') return 'sent'
    if (status === 'responded') return 'responded'
    if (status === 'converted') return 'converted'
    if (status === 'dismissed') return 'dismissed'
    return 'pending'
}

function getFollowupActionKey(value: any) {
    const record = asRecord(value)
    const explicit = asString(record.key || record.followup_key)
    if (explicit) return explicit

    return [
        asString(record.alert_id),
        asString(record.property_id),
        asString(record.message),
    ].filter(Boolean).join(':') || asString(record.title || record.property_title || 'followup')
}

function getFollowupAction(actions: Record<string, any>, followup: any) {
    const key = getFollowupActionKey(followup)
    if (key && actions[key]) return asRecord(actions[key])

    const fallbackKey = [
        asString(followup?.alert_id),
        asString(followup?.property_id),
    ].filter(Boolean).join(':')

    return fallbackKey ? asRecord(actions[fallbackKey]) : {}
}

function getFollowupStatus(followup: any, actions: Record<string, any>) {
    const action = getFollowupAction(actions, followup)
    return normalizeFollowupStatus(action.status || followup?.action_status || followup?.status)
}

function getFollowupStatusTimestamp(followup: any, actions: Record<string, any>) {
    const action = getFollowupAction(actions, followup)
    const status = normalizeFollowupStatus(action.status || followup?.action_status || followup?.status)
    if (status === 'sent' && (action.sent_at || followup?.sent_at)) return String(action.sent_at || followup.sent_at)
    if (status === 'responded' && (action.responded_at || followup?.responded_at)) return String(action.responded_at || followup.responded_at)
    if (status === 'converted' && (action.converted_at || followup?.converted_at)) return String(action.converted_at || followup.converted_at)
    if (status === 'dismissed' && (action.dismissed_at || followup?.dismissed_at)) return String(action.dismissed_at || followup.dismissed_at)
    return action.updated_at || followup?.action_updated_at || ''
}

function leadDisplayName(lead: LeadRow, profile: BrokerProfileRow | null) {
    return profile?.lead_name || lead.name || lead.email || lead.phone_e164 || lead.phone || 'Lead sem nome'
}

function leadScore(lead: LeadRow, metadata: Record<string, any>) {
    const behavior = asRecord(metadata.behavior_summary)
    return Math.max(
        asNumber(lead.lead_score),
        asNumber(behavior.engagement_score),
        asNumber(behavior.score)
    )
}

function premiumIntentLabel(value: string) {
    if (value === 'private_visit') return 'visita privada'
    if (value === 'availability') return 'disponibilidade'
    if (value === 'reserved_negotiation') return 'negociacao reservada'
    if (value === 'value_reading') return 'leitura de valor'
    return 'intencao premium'
}

function premiumIntentNextAction(value: string) {
    if (value === 'private_visit') return 'Confirmar janela de visita privada e corretor responsavel.'
    if (value === 'availability') return 'Validar disponibilidade real do imovel e apresentar proximas opcoes equivalentes.'
    if (value === 'reserved_negotiation') return 'Abrir tratativa reservada com contexto do imovel e limite de negociacao.'
    if (value === 'value_reading') return 'Enviar leitura consultiva de valor, liquidez e comparaveis premium.'
    return 'Abrir atendimento consultivo para a intencao premium registrada.'
}

function parseJsonObject(text: string): Record<string, any> | null {
    const cleaned = String(text || '')
        .replace(/```json/gi, '```')
        .replace(/```/g, '')
        .trim()
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start < 0 || end <= start) return null

    try {
        return JSON.parse(cleaned.slice(start, end + 1))
    } catch {
        return null
    }
}

function trimText(value: any, maxLength: number) {
    const text = asString(value)
    if (!text) return ''
    return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text
}

function buildNarrativePrompt(params: {
    lead: LeadRow
    profile: BrokerProfileRow | null
    broker: BrokerRow | null
    conversation: ConversationRow | null
    snapshot: LeadExecutiveBriefSnapshot
}) {
    const metadata = asRecord(params.lead.metadata)
    const behavior = asRecord(metadata.behavior_summary)
    const recommendations = Array.isArray(asRecord(metadata.crm_action_recommendations).items)
        ? asRecord(metadata.crm_action_recommendations).items
        : []
    const conversationMessages = Array.isArray(params.conversation?.messages)
        ? (params.conversation?.messages || []).slice(-6).map((message: any) => ({
            role: message?.role || message?.sender || message?.author_type || null,
            text: trimText(message?.content || message?.text || message?.message || '', 320),
            at: message?.created_at || message?.timestamp || null,
        }))
        : []

    return JSON.stringify({
        lead: {
            name: leadDisplayName(params.lead, params.profile),
            score: params.snapshot.signals.score,
            classification: params.lead.lead_classification || null,
            status: params.profile?.status || null,
            broker: params.broker?.name || null,
            ai_summary: trimText(params.lead.ai_summary, 500),
        },
        deterministic_brief: {
            level: params.snapshot.level,
            title: params.snapshot.title,
            summary: params.snapshot.summary,
            risk: params.snapshot.risk,
            next_action: params.snapshot.next_action,
            signals: params.snapshot.signals,
        },
        behavior_summary: {
            intent_temperature: behavior.intent_temperature || null,
            next_best_action: behavior.next_best_action || null,
            selected_regions: behavior.selected_regions || [],
            search_alert_followups: Array.isArray(behavior.search_alert_followups)
                ? behavior.search_alert_followups.slice(0, 5)
                : [],
            premium_intents: Array.isArray(behavior.premium_intents)
                ? behavior.premium_intents.slice(0, 5)
                : [],
            latest_premium_intent: behavior.latest_premium_intent || null,
        },
        recommendations: recommendations.slice(0, 5),
        conversation: {
            summary: trimText(params.conversation?.summary, 500),
            status: params.conversation?.status || null,
            latest_messages: conversationMessages,
        },
    })
}

async function hasNarrativeProvider(): Promise<{
    available: boolean
    provider: 'gemini' | 'openai'
    model: string | null
    reason: string | null
}> {
    try {
        const { getActiveAIProvider, getGeminiApiKey, getOpenAIApiKey, getAIConfig } = await import('@/lib/ai/config')
        const [provider, geminiKey, openaiKey, geminiModel, openaiModel] = await Promise.all([
            getActiveAIProvider(),
            getGeminiApiKey(),
            getOpenAIApiKey(),
            getAIConfig('gemini_model'),
            getAIConfig('openai_model'),
        ])
        const normalizedProvider = provider === 'openai' ? 'openai' : 'gemini'

        if (normalizedProvider === 'openai' && openaiKey) {
            return { available: true, provider: 'openai' as const, model: openaiModel || 'gpt-4o-mini', reason: null as string | null }
        }
        if (normalizedProvider === 'gemini' && geminiKey) {
            return { available: true, provider: 'gemini' as const, model: geminiModel || 'gemini-2.5-flash', reason: null as string | null }
        }
        if (geminiKey) {
            return { available: true, provider: 'gemini' as const, model: geminiModel || 'gemini-2.5-flash', reason: null as string | null }
        }
        if (openaiKey) {
            return { available: true, provider: 'openai' as const, model: openaiModel || 'gpt-4o-mini', reason: null as string | null }
        }

        return { available: false, provider: normalizedProvider, model: null, reason: 'ai_key_missing' }
    } catch (error) {
        return {
            available: false,
            provider: 'gemini' as const,
            model: null,
            reason: `ai_config_error:${error instanceof Error ? error.message : String(error)}`,
        }
    }
}

async function enrichSnapshotWithAiNarrative(params: {
    lead: LeadRow
    profile: BrokerProfileRow | null
    broker: BrokerRow | null
    conversation: ConversationRow | null
    snapshot: LeadExecutiveBriefSnapshot
    provider: 'gemini' | 'openai'
    model: string | null
}) {
    const { generateChatResponse } = await import('@/lib/ai/generation')
    const systemPrompt = [
        'Voce e uma IA de inteligencia comercial para a Pilger Imoveis.',
        'Transforme dados de CRM em um resumo executivo curto, pragmatico e acionavel para um gestor ou corretor.',
        'Nunca invente dados. Use apenas os sinais recebidos.',
        'Responda somente JSON valido, sem markdown.',
        'Campos obrigatorios: title, summary, risk, next_action.',
        'summary deve ter ate 220 caracteres. risk e next_action devem ter ate 180 caracteres cada.',
        'Use portugues do Brasil, tom executivo, direto e comercial.',
    ].join('\n')
    const message = [
        'Gere uma narrativa comercial para este lead.',
        'Retorne JSON neste formato:',
        '{"title":"...","summary":"...","risk":"...","next_action":"..."}',
        'Dados:',
        buildNarrativePrompt(params),
    ].join('\n\n')
    const text = await generateChatResponse([], message, systemPrompt, {
        provider: params.provider,
        geminiModel: params.provider === 'gemini' ? params.model || undefined : undefined,
        openaiModel: params.provider === 'openai' ? params.model || undefined : undefined,
    })
    const parsed = parseJsonObject(text)

    if (!parsed) throw new Error('AI narrative returned invalid JSON')

    const title = trimText(parsed.title, 90)
    const summary = trimText(parsed.summary, 260)
    const risk = trimText(parsed.risk, 220)
    const nextAction = trimText(parsed.next_action || parsed.nextAction, 220)

    if (!title || !summary || !risk || !nextAction) {
        throw new Error('AI narrative missing required fields')
    }

    return {
        ...params.snapshot,
        title,
        summary,
        risk,
        next_action: nextAction,
        signals: {
            ...params.snapshot.signals,
            deterministic_title: params.snapshot.title,
            deterministic_summary: params.snapshot.summary,
            deterministic_risk: params.snapshot.risk,
            deterministic_next_action: params.snapshot.next_action,
            ai_narrative_generated: true,
            ai_narrative_provider: params.provider,
            ai_narrative_model: params.model,
        },
        source: `${params.snapshot.source}:ai_narrative`,
    }
}

async function fetchLeadRows(supabase: SupabaseAdminLike, limit: number): Promise<LeadRow[]> {
    const { data, error } = await supabase
        .from('leads')
        .select('id, name, email, phone, phone_e164, metadata, lead_score, lead_classification, ai_summary, visitor_id, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(limit)

    if (error) throw error
    return (data || []) as LeadRow[]
}

async function fetchProfiles(supabase: SupabaseAdminLike, leads: LeadRow[]) {
    const byLeadId = new Map<string, BrokerProfileRow>()
    const byPhone = new Map<string, BrokerProfileRow>()
    const rows: BrokerProfileRow[] = []
    const leadIds = leads.map(lead => lead.id).filter(Boolean)
    const phones = Array.from(new Set(leads.flatMap(lead => phoneCandidates(lead.phone_e164 || lead.phone))))

    if (leadIds.length > 0) {
        const { data, error } = await supabase
            .from('broker_lead_profiles')
            .select('id, lead_id, lead_phone, lead_name, broker_id, status, created_at, updated_at')
            .in('lead_id', leadIds)
            .order('updated_at', { ascending: false })

        if (error && !missingBrokerProfilesTable(error)) throw error
        if (!error) rows.push(...((data || []) as BrokerProfileRow[]))
    }

    if (phones.length > 0) {
        const { data, error } = await supabase
            .from('broker_lead_profiles')
            .select('id, lead_id, lead_phone, lead_name, broker_id, status, created_at, updated_at')
            .or(buildCollectedPhoneFilter(phones))
            .order('updated_at', { ascending: false })

        if (error && !missingBrokerProfilesTable(error)) throw error
        if (!error) rows.push(...((data || []) as BrokerProfileRow[]))
    }

    for (const row of rows) {
        if (row.lead_id && !byLeadId.has(row.lead_id)) byLeadId.set(row.lead_id, row)
        for (const phone of phoneCandidates(row.lead_phone)) {
            if (!byPhone.has(phone)) byPhone.set(phone, row)
        }
    }

    return { rows, byLeadId, byPhone }
}

async function fetchBrokerMap(supabase: SupabaseAdminLike, brokerIds: string[]) {
    const brokerMap = new Map<string, BrokerRow>()
    const uniqueIds = Array.from(new Set(brokerIds.filter(Boolean)))
    if (uniqueIds.length === 0) return brokerMap

    const { data, error } = await supabase
        .from('virtual_brokers')
        .select('id, name, is_active')
        .in('id', uniqueIds)

    if (error) throw error
    for (const broker of data || []) brokerMap.set(broker.id, broker)
    return brokerMap
}

async function fetchConversations(supabase: SupabaseAdminLike, leads: LeadRow[], profiles: BrokerProfileRow[]) {
    const byLeadId = new Map<string, ConversationRow>()
    const byBrokerPhone = new Map<string, ConversationRow>()
    const leadIds = leads.map(lead => lead.id).filter(Boolean)
    const phones = Array.from(new Set(leads.flatMap(lead => phoneCandidates(lead.phone_e164 || lead.phone))))
    const brokerIds = Array.from(new Set(profiles.map(profile => profile.broker_id || '').filter(Boolean)))

    if (leadIds.length > 0) {
        const { data, error } = await supabase
            .from('whatsapp_ai_conversations')
            .select('id, lead_id, broker_id, lead_phone, messages, summary, status, updated_at')
            .in('lead_id', leadIds)
            .order('updated_at', { ascending: false })

        if (!error) {
            for (const conversation of data || []) {
                if (conversation.lead_id && !byLeadId.has(conversation.lead_id)) byLeadId.set(conversation.lead_id, conversation)
                const key = conversationKey(conversation.broker_id, conversation.lead_phone)
                if (key && !byBrokerPhone.has(key)) byBrokerPhone.set(key, conversation)
            }
        }
    }

    if (brokerIds.length > 0 && phones.length > 0) {
        const { data, error } = await supabase
            .from('whatsapp_ai_conversations')
            .select('id, lead_id, broker_id, lead_phone, messages, summary, status, updated_at')
            .in('broker_id', brokerIds)
            .in('lead_phone', phones)
            .order('updated_at', { ascending: false })

        if (!error) {
            for (const conversation of data || []) {
                if (conversation.lead_id && !byLeadId.has(conversation.lead_id)) byLeadId.set(conversation.lead_id, conversation)
                const key = conversationKey(conversation.broker_id, conversation.lead_phone)
                if (key && !byBrokerPhone.has(key)) byBrokerPhone.set(key, conversation)
            }
        }
    }

    return { byLeadId, byBrokerPhone }
}

function resolveProfile(lead: LeadRow, profiles: Awaited<ReturnType<typeof fetchProfiles>>) {
    if (profiles.byLeadId.has(lead.id)) return profiles.byLeadId.get(lead.id) || null

    for (const phone of phoneCandidates(lead.phone_e164 || lead.phone)) {
        const profile = profiles.byPhone.get(phone)
        if (profile) return profile
    }

    return null
}

function resolveConversation(
    lead: LeadRow,
    profile: BrokerProfileRow | null,
    conversations: Awaited<ReturnType<typeof fetchConversations>>
) {
    if (conversations.byLeadId.has(lead.id)) return conversations.byLeadId.get(lead.id) || null

    const key = conversationKey(profile?.broker_id, profile?.lead_phone || lead.phone_e164 || lead.phone)
    return key ? conversations.byBrokerPhone.get(key) || null : null
}

function buildSnapshot(params: {
    lead: LeadRow
    profile: BrokerProfileRow | null
    broker: BrokerRow | null
    conversation: ConversationRow | null
    generatedAt: string
    source: string
    actor?: AdminActorContext | null
}): LeadExecutiveBriefSnapshot {
    const metadata = asRecord(params.lead.metadata)
    const behavior = asRecord(metadata.behavior_summary)
    const followups = Array.isArray(behavior.search_alert_followups) ? behavior.search_alert_followups : []
    const actions = asRecord(metadata.crm_followup_actions)
    const pendingFollowups = followups.filter((item: any) => getFollowupStatus(item, actions) === 'pending')
    const sentFollowups = followups.filter((item: any) => getFollowupStatus(item, actions) === 'sent')
    const respondedFollowups = followups.filter((item: any) => getFollowupStatus(item, actions) === 'responded')
    const convertedFollowups = followups.filter((item: any) => getFollowupStatus(item, actions) === 'converted')
    const nowMs = Date.parse(params.generatedAt)
    const score = leadScore(params.lead, metadata)
    const latestActivityAt = [
        params.conversation?.updated_at,
        behavior.last_activity_at,
        metadata.last_whatsapp_click?.clicked_at,
        params.profile?.updated_at,
        params.lead.updated_at,
        params.lead.created_at,
    ].filter(Boolean).sort((a, b) => Date.parse(String(b)) - Date.parse(String(a)))[0] || null
    const latestActivityAge = ageHoursFrom(latestActivityAt, nowMs)
    const stalePendingCount = pendingFollowups.filter((followup: any) => {
        const reference = followup.occurred_at || getFollowupStatusTimestamp(followup, actions) || params.lead.updated_at || params.lead.created_at
        const age = ageHoursFrom(reference, nowMs)
        return age !== null && age >= PENDING_FOLLOWUP_SLA_HOURS
    }).length
    const staleSentCount = sentFollowups.filter((followup: any) => {
        const reference = getFollowupStatusTimestamp(followup, actions) || followup.occurred_at || params.lead.updated_at || params.lead.created_at
        const age = ageHoursFrom(reference, nowMs)
        return age !== null && age >= SENT_FOLLOWUP_SLA_HOURS
    }).length
    const conversationMessages = Array.isArray(params.conversation?.messages) ? params.conversation?.messages || [] : []
    const whatsappClicks = Array.isArray(metadata.whatsapp_clicks) ? metadata.whatsapp_clicks : []
    const recommendations = Array.isArray(asRecord(metadata.crm_action_recommendations).items)
        ? asRecord(metadata.crm_action_recommendations).items
        : []
    const eventCounts = asRecord(behavior.event_counts)
    const alertOpenedCount = Math.max(0, Number(eventCounts.property_search_alert_match_opened || 0))
    const alertOpenRecommendationCount = recommendations.filter((item: any) => asString(item?.type) === 'alert_opened_no_contact').length
    const premiumIntents = Array.isArray(behavior.premium_intents)
        ? behavior.premium_intents.map(asRecord)
        : []
    const latestPremiumIntent = asRecord(behavior.latest_premium_intent || premiumIntents[0] || {})
    const premiumIntentCount = Math.max(0, Number(behavior.premium_intent_count || premiumIntents.length || 0))
    const privateVisitCount = Math.max(0, Number(behavior.private_visit_request_count || 0))
    const availabilityCount = Math.max(0, Number(behavior.availability_request_count || 0))
    const reservedNegotiationCount = Math.max(0, Number(behavior.reserved_negotiation_request_count || 0))
    const valueReadingCount = Math.max(0, Number(behavior.value_reading_request_count || 0))
    const latestPremiumIntentType = asString(latestPremiumIntent.premium_intent)
    const favoriteCount = Array.isArray(behavior.liked_property_ids) ? behavior.liked_property_ids.length : 0
    const revisitedCount = Math.max(0, Number(behavior.continuation_count || 0))
    const streetViewCount = Math.max(0, Number(behavior.street_view_count || 0))
    const priceHistoryCount = Array.isArray(behavior.price_history_property_ids) ? behavior.price_history_property_ids.length : 0
    const isHot = score >= 75 || /quente|hot|alta/i.test(String(behavior.intent_temperature || params.lead.lead_classification || ''))
    const hasBroker = Boolean(params.profile?.broker_id)
    const hasConversation = conversationMessages.length > 0
    const hasPremiumIntent = premiumIntentCount > 0
    const hasSavedPropertyIntent = favoriteCount > 0 || revisitedCount > 0 || streetViewCount > 0 || priceHistoryCount > 0
    const hasIntent = whatsappClicks.length > 0 || followups.length > 0 || recommendations.length > 0 || hasPremiumIntent || hasSavedPropertyIntent
    const level: BriefLevel = (
        hasPremiumIntent || staleSentCount > 0 || stalePendingCount > 0 || (isHot && !hasBroker) || (alertOpenedCount > 0 && !hasConversation)
            ? 'high'
            : isHot || alertOpenedCount > 0 || pendingFollowups.length > 0 || sentFollowups.length > 0 || recommendations.length > 0 || hasSavedPropertyIntent
                ? 'medium'
                : 'low'
    )
    const lastMovement = latestActivityAt
        ? `ultima atividade ha ${latestActivityAge !== null && latestActivityAge < 48 ? `${latestActivityAge}h` : `${Math.floor((latestActivityAge || 0) / 24)}d`}`
        : 'sem atividade recente consolidada'
    const title = level === 'high'
        ? 'Atencao comercial imediata'
        : level === 'medium'
            ? 'Lead com oportunidade ativa'
            : 'Lead em acompanhamento'
    const summary = [
        `Score ${score}/100`,
        params.broker?.name ? `corretor ${params.broker.name}` : 'sem corretor definido',
        lastMovement,
    ].join(' | ')

    let risk = 'Sem risco critico detectado; manter nutricao e observar novos sinais.'
    if (hasPremiumIntent && !hasConversation) {
        risk = `Lead acionou ${premiumIntentLabel(latestPremiumIntentType)} e ainda nao existe conversa registrada.`
    } else if (!hasBroker && isHot) {
        risk = 'Lead quente sem corretor responsavel; risco de perder velocidade comercial.'
    } else if (staleSentCount > 0) {
        risk = `${staleSentCount} abordagem(ns) enviada(s) sem resposta dentro do SLA.`
    } else if (stalePendingCount > 0) {
        risk = `${stalePendingCount} abordagem(ns) pendente(s) fora do SLA de primeiro contato.`
    } else if (alertOpenedCount > 0 && !hasConversation) {
        risk = 'Lead abriu match de alerta salvo, mas ainda nao existe conversa registrada.'
    } else if (favoriteCount > 0 && !hasConversation) {
        risk = 'Lead salvou imovel, mas ainda nao existe conversa registrada para qualificar a preferencia.'
    } else if (!hasConversation && hasIntent) {
        risk = 'Ha intencao comercial, mas nenhuma conversa registrada ainda.'
    }

    let nextAction = asString(behavior.next_best_action) || 'Acompanhar atividade e atualizar status quando houver novo contato.'
    if (hasPremiumIntent) {
        nextAction = premiumIntentNextAction(latestPremiumIntentType)
    } else if (pendingFollowups.length > 0) {
        nextAction = 'Enviar a abordagem pronta pelo WhatsApp e registrar como enviada.'
    } else if (staleSentCount > 0) {
        nextAction = 'Reativar a conversa e marcar o follow-up como respondido quando houver retorno.'
    } else if (!hasBroker) {
        nextAction = 'Definir corretor responsavel antes de avancar a tratativa.'
    } else if (alertOpenedCount > 0 && !hasConversation) {
        nextAction = 'Abrir conversa consultiva usando o imovel que o lead acabou de ver pelo alerta.'
    } else if (favoriteCount > 0 || revisitedCount > 0) {
        nextAction = 'Retomar pelos imoveis favoritos ou revisitados e oferecer comparacao objetiva.'
    } else if (convertedFollowups.length > 0) {
        nextAction = 'Consolidar conversao, atualizar notas do corretor e preparar proximo passo comercial.'
    }

    return {
        id: null,
        version: LEAD_EXECUTIVE_BRIEF_VERSION,
        level,
        title,
        summary,
        risk,
        next_action: nextAction,
        facts: [
            { label: 'Follow-ups', value: String(followups.length), color: '#0f172a' },
            { label: 'Pendentes', value: String(pendingFollowups.length), color: '#b45309' },
            { label: 'Enviadas', value: String(sentFollowups.length), color: '#047857' },
            { label: 'Conversao', value: String(convertedFollowups.length), color: '#7c3aed' },
            { label: 'Alertas abertos', value: String(alertOpenedCount), color: '#b45309' },
            { label: 'Intencoes premium', value: String(premiumIntentCount), color: '#7c2d12' },
            { label: 'Favoritos', value: String(favoriteCount), color: '#0f766e' },
        ],
        signals: {
            score,
            lead_status: params.profile?.status || null,
            lead_classification: params.lead.lead_classification || null,
            broker_id: params.profile?.broker_id || null,
            broker_name: params.broker?.name || null,
            latest_activity_at: latestActivityAt,
            latest_activity_age_hours: latestActivityAge,
            followups_total: followups.length,
            followups_pending: pendingFollowups.length,
            followups_sent: sentFollowups.length,
            followups_responded: respondedFollowups.length,
            followups_converted: convertedFollowups.length,
            stale_pending: stalePendingCount,
            stale_sent: staleSentCount,
            search_alert_opened: alertOpenedCount,
            alert_opened_no_contact_recommendations: alertOpenRecommendationCount,
            premium_intent_count: premiumIntentCount,
            private_visit_request_count: privateVisitCount,
            availability_request_count: availabilityCount,
            reserved_negotiation_request_count: reservedNegotiationCount,
            value_reading_request_count: valueReadingCount,
            latest_premium_intent: latestPremiumIntent,
            favorite_count: favoriteCount,
            revisited_count: revisitedCount,
            street_view_count: streetViewCount,
            price_history_count: priceHistoryCount,
            whatsapp_clicks: whatsappClicks.length,
            conversation_messages: conversationMessages.length,
            recommendations: recommendations.length,
            profile_id: params.profile?.id || null,
            conversation_id: params.conversation?.id || null,
        },
        source: params.source,
        actor_type: params.actor?.actor_type || null,
        actor_id: params.actor?.actor_id || null,
        actor_name: params.actor?.actor_name || null,
        actor_email: params.actor?.actor_email || null,
        auth_user_id: params.actor?.auth_user_id || null,
        generated_at: params.generatedAt,
    }
}

async function persistSnapshot(params: {
    supabase: SupabaseAdminLike
    lead: LeadRow
    profile: BrokerProfileRow | null
    snapshot: LeadExecutiveBriefSnapshot
}) {
    let insertedId: string | null = null
    let insertedHistory = false
    const leadPhone = phoneCandidates(params.lead.phone_e164 || params.lead.phone || params.profile?.lead_phone).find(Boolean)
        || params.lead.phone_e164
        || params.lead.phone
        || params.profile?.lead_phone
        || null

    const { data: inserted, error: insertError } = await params.supabase
        .from('lead_executive_briefs')
        .insert({
            lead_id: params.lead.id,
            lead_phone: leadPhone,
            lead_name: leadDisplayName(params.lead, params.profile),
            crm_row_id: params.profile?.id || null,
            broker_id: params.profile?.broker_id || null,
            level: params.snapshot.level,
            title: params.snapshot.title,
            summary: params.snapshot.summary,
            risk: params.snapshot.risk,
            next_action: params.snapshot.next_action,
            facts: params.snapshot.facts,
            signals: params.snapshot.signals,
            source: params.snapshot.source,
            actor_type: params.snapshot.actor_type,
            actor_id: params.snapshot.actor_id,
            actor_name: params.snapshot.actor_name,
            actor_email: params.snapshot.actor_email,
            auth_user_id: params.snapshot.auth_user_id,
            generated_at: params.snapshot.generated_at,
        })
        .select('id')
        .maybeSingle()

    if (insertError) {
        if (!missingBriefTable(insertError)) throw insertError
    } else {
        insertedHistory = true
        insertedId = inserted?.id || null
    }

    const snapshot = {
        ...params.snapshot,
        id: insertedId,
    }
    const metadata = asRecord(params.lead.metadata)
    const history = Array.isArray(metadata.crm_executive_brief_history)
        ? metadata.crm_executive_brief_history
        : []
    const nextMetadata = {
        ...metadata,
        crm_executive_brief: snapshot,
        crm_executive_brief_history: [snapshot, ...history].slice(0, 8),
    }
    const { error: updateError } = await params.supabase
        .from('leads')
        .update({
            metadata: nextMetadata,
            updated_at: snapshot.generated_at,
        })
        .eq('id', params.lead.id)

    if (updateError) throw updateError

    return {
        insertedHistory,
        metadataOnly: !insertedHistory,
        level: snapshot.level,
    }
}

export async function processLeadExecutiveBriefs(
    supabase: SupabaseAdminLike,
    options: {
        limit?: number
        source?: string
        actor?: AdminActorContext | null
        aiNarrative?: boolean
        aiLimit?: number
    } = {}
): Promise<LeadExecutiveBriefProcessResult> {
    const limit = Math.min(Math.max(Number(options.limit || 300), 1), 1000)
    const source = asString(options.source) || 'manual'
    const generatedAt = new Date().toISOString()
    const errors: string[] = []
    const wantsAiNarrative = options.aiNarrative === true
    const aiLimit = Math.min(Math.max(Number(options.aiLimit || 40), 0), 250)
    const aiProvider = wantsAiNarrative
        ? await hasNarrativeProvider()
        : { available: false, provider: 'gemini' as const, model: null, reason: 'ai_narrative_disabled' }
    let aiNarrativesRequested = 0
    let aiNarrativesGenerated = 0
    const leads = await fetchLeadRows(supabase, limit)
    const profiles = await fetchProfiles(supabase, leads)
    const brokerIds = profiles.rows.map(profile => profile.broker_id || '').filter(Boolean)
    const [brokerMap, conversations] = await Promise.all([
        fetchBrokerMap(supabase, brokerIds),
        fetchConversations(supabase, leads, profiles.rows),
    ])
    let updatedLeads = 0
    let insertedHistory = 0
    let metadataOnly = 0
    const riskTotals = {
        high: 0,
        medium: 0,
        low: 0,
    }

    for (const lead of leads) {
        try {
            const profile = resolveProfile(lead, profiles)
            const broker = profile?.broker_id ? brokerMap.get(profile.broker_id) || null : null
            const conversation = resolveConversation(lead, profile, conversations)
            let snapshot = buildSnapshot({
                lead,
                profile,
                broker,
                conversation,
                generatedAt,
                source,
                actor: options.actor || null,
            })
            if (
                wantsAiNarrative
                && aiProvider.available
                && aiNarrativesRequested < aiLimit
                && snapshot.level !== 'low'
            ) {
                aiNarrativesRequested += 1
                try {
                    snapshot = await enrichSnapshotWithAiNarrative({
                        lead,
                        profile,
                        broker,
                        conversation,
                        snapshot,
                        provider: aiProvider.provider,
                        model: aiProvider.model,
                    })
                    aiNarrativesGenerated += 1
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error)
                    errors.push(`${lead.id}: ai narrative failed: ${message}`)
                }
            }
            const result = await persistSnapshot({
                supabase,
                lead,
                profile,
                snapshot,
            })

            updatedLeads += 1
            if (result.insertedHistory) insertedHistory += 1
            if (result.metadataOnly) metadataOnly += 1
            riskTotals[result.level] += 1
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            errors.push(`${lead.id}: ${message}`)
        }
    }

    return {
        processed_leads: leads.length,
        updated_leads: updatedLeads,
        inserted_history: insertedHistory,
        metadata_only: metadataOnly,
        high_risk: riskTotals.high,
        medium_risk: riskTotals.medium,
        low_risk: riskTotals.low,
        ai_narratives_requested: aiNarrativesRequested,
        ai_narratives_generated: aiNarrativesGenerated,
        ai_narrative_skipped_reason: wantsAiNarrative ? aiProvider.reason : 'ai_narrative_disabled',
        generated_at: generatedAt,
        source,
        errors,
    }
}
