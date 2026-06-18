import { phoneCandidates } from '@/lib/whatsapp/lead-sync'
import type { AdminActorContext } from '@/lib/events/admin-auth'

export const CRM_ACTION_RECOMMENDATION_VERSION = 'crm-action-recommendations-v1'
export const PENDING_FOLLOWUP_SLA_HOURS = 24
export const SENT_FOLLOWUP_SLA_HOURS = 48

type SupabaseAdminLike = {
    from: (table: string) => any
}

type FollowupStatus = 'pending' | 'sent' | 'responded' | 'converted' | 'dismissed'
type RecommendationType =
    | 'alert_opened_no_contact'
    | 'stale_pending'
    | 'stale_sent'
    | 'unassigned'
    | 'redistribution'
    | 'premium_intent_no_contact'
    | 'private_visit_pending'
    | 'availability_pending'
    | 'reserved_negotiation_pending'
    | 'value_reading_pending'
    | 'favorite_property_pending'
    | 'revisited_property_pending'
    | 'street_view_pending'
    | 'price_history_pending'

type LeadRow = {
    id: string
    name?: string | null
    email?: string | null
    phone?: string | null
    phone_e164?: string | null
    metadata?: Record<string, any> | null
    lead_score?: number | null
    lead_classification?: string | null
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

type FollowupTask = {
    lead: LeadRow
    profile: BrokerProfileRow | null
    broker: BrokerRow | null
    followup: Record<string, any>
    followupKey: string
    status: FollowupStatus
    ageHours: number
    brokerId: string
    brokerName: string
    leadName: string
    leadPhone: string
    alertOpenedCount: number
    alertOpenedAt: string
    alertOpenSource: string
}

type BrokerPerformance = {
    id: string
    name: string
    canFilter: boolean
    total: number
    pending: number
    sent: number
    responded: number
    converted: number
    dismissed: number
    active: number
    responseRate: number
    conversionRate: number
    avgScore: number
    scoreSum: number
}

export type CrmActionRecommendationItem = {
    id: string
    type: RecommendationType
    priority: 'high' | 'medium' | 'low'
    title: string
    action: string
    reason: string
    followup_key: string
    status: FollowupStatus
    age_hours: number
    lead_id: string
    lead_name: string | null
    lead_phone: string | null
    broker_id: string | null
    broker_name: string | null
    suggested_broker_id: string | null
    suggested_broker_name: string | null
    alert_id: string | null
    alert_title: string | null
    property_id: string | null
    property_title: string | null
    property_url: string | null
    match_score: number | null
    message: string | null
    generated_at: string
}

export type CrmActionRecommendationSnapshot = {
    version: string
    generated_at: string
    source: string
    summary: {
        total: number
        alert_opened_no_contact: number
        stale_pending: number
        stale_sent: number
        unassigned: number
        redistribution: number
        premium_intent_no_contact: number
        private_visit_pending: number
        availability_pending: number
        reserved_negotiation_pending: number
        value_reading_pending: number
        favorite_property_pending: number
        revisited_property_pending: number
        street_view_pending: number
        price_history_pending: number
    }
    strongest_broker: {
        id: string
        name: string
        response_rate: number
        conversion_rate: number
    } | null
    items: CrmActionRecommendationItem[]
}

export type CrmActionProcessResult = {
    processed_leads: number
    leads_with_followups: number
    updated_leads: number
    total_recommendations: number
    summary: CrmActionRecommendationSnapshot['summary']
    strongest_broker: CrmActionRecommendationSnapshot['strongest_broker']
    generated_at: string
    errors: string[]
}

export type CrmActionApplyResult = {
    lead_id: string
    recommendation_id: string
    recommendation_type: CrmActionRecommendationItem['type']
    target_broker_id: string
    target_broker_name: string | null
    profile_id: string | null
    applied_at: string
    actor_name?: string | null
    actor_email?: string | null
}

function asRecord(value: any): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asString(value: any): string {
    return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: any): number | null {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

function percent(value: number, total: number) {
    return total > 0 ? Math.round((value / total) * 100) : 0
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

function getFollowupStatus(followup: any, actions: Record<string, any>): FollowupStatus {
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

function ageHoursFrom(referenceDate: string, nowMs: number) {
    const referenceTime = Date.parse(referenceDate)
    if (!Number.isFinite(referenceTime)) return 0
    return Math.max(0, Math.floor((nowMs - referenceTime) / 36e5))
}

function eventCount(behaviorSummary: Record<string, any>, eventType: string) {
    const counts = asRecord(behaviorSummary.event_counts)
    return Math.max(0, Number(counts[eventType] || 0))
}

function premiumIntentLabel(value: string) {
    if (value === 'private_visit') return 'visita privada'
    if (value === 'availability') return 'disponibilidade'
    if (value === 'reserved_negotiation') return 'negociacao reservada'
    if (value === 'value_reading') return 'leitura de valor'
    return 'intencao premium'
}

function premiumIntentTitle(value: string) {
    if (value === 'private_visit') return 'Visita privada solicitada'
    if (value === 'availability') return 'Disponibilidade solicitada'
    if (value === 'reserved_negotiation') return 'Negociacao reservada solicitada'
    if (value === 'value_reading') return 'Leitura de valor solicitada'
    return 'Intencao premium registrada'
}

function premiumIntentAction(value: string) {
    if (value === 'private_visit') return 'Confirmar visita privada'
    if (value === 'availability') return 'Validar disponibilidade'
    if (value === 'reserved_negotiation') return 'Abrir negociacao reservada'
    if (value === 'value_reading') return 'Enviar leitura de valor'
    return 'Abrir atendimento consultivo'
}

function premiumIntentRecommendationType(value: string): RecommendationType {
    if (value === 'private_visit') return 'private_visit_pending'
    if (value === 'availability') return 'availability_pending'
    if (value === 'reserved_negotiation') return 'reserved_negotiation_pending'
    if (value === 'value_reading') return 'value_reading_pending'
    return 'premium_intent_no_contact'
}

function premiumIntentMessage(intent: Record<string, any>) {
    const action = asString(intent.requested_action)
    const label = premiumIntentLabel(asString(intent.premium_intent))
    const title = asString(intent.property_title)
    if (title) return `Oi! Vi que voce pediu ${action || label} para ${title}. Posso confirmar os detalhes agora?`
    return `Oi! Vi que voce pediu ${action || label}. Posso confirmar os detalhes agora?`
}

function buildPremiumIntentFollowups(behaviorSummary: Record<string, any>) {
    const intents = Array.isArray(behaviorSummary.premium_intents)
        ? behaviorSummary.premium_intents.map(asRecord)
        : []

    return intents
        .filter(intent => asString(intent.event_type) || asString(intent.premium_intent))
        .map((intent, index) => {
            const premiumIntent = asString(intent.premium_intent)
            const occurredAt = asString(intent.occurred_at)
            const propertyId = asString(intent.property_id)
            const eventType = asString(intent.event_type)
            const key = [
                'premium',
                eventType || premiumIntent || 'intent',
                propertyId || 'sem-imovel',
                occurredAt || index,
            ].join(':')

            return {
                ...intent,
                key,
                followup_key: key,
                source: 'premium_intent',
                title: premiumIntentTitle(premiumIntent),
                priority: 'high',
                match_score: asNumber(intent.match_score) ?? 100,
                message: asString(intent.message) || premiumIntentMessage(intent),
            }
        })
}

function behaviorSignalTypeFromEvent(activity: Record<string, any>) {
    const eventType = asString(activity.event_type)
    const source = asString(activity.source)
    const sectionId = asString(activity.section_id)
    const sectionLabel = asString(activity.section_label).toLowerCase()

    if (eventType === 'property_favorited') return 'favorite_property_pending'
    if (eventType === 'property_details_continuation_favorites_clicked') return 'favorite_property_pending'
    if (eventType === 'property_feed_saved_history_clicked' && source === 'favorites') return 'favorite_property_pending'
    if (eventType === 'search_results_memory_property_clicked' && source === 'favorite') return 'favorite_property_pending'
    if (eventType === 'search_results_memory_property_clicked' || eventType === 'property_details_continuation_property_clicked') return 'revisited_property_pending'
    if (eventType === 'property_feed_saved_history_clicked' && source === 'history') return 'revisited_property_pending'
    if (eventType === 'property_location_street_view_opened') return 'street_view_pending'
    if (eventType === 'property_details_landing_section_viewed' && (sectionId === 'historico-precos' || sectionLabel.includes('historico'))) return 'price_history_pending'
    return ''
}

function behaviorSignalTitle(type: string) {
    if (type === 'favorite_property_pending') return 'Favorito com oportunidade ativa'
    if (type === 'revisited_property_pending') return 'Imovel revisitado pelo lead'
    if (type === 'street_view_pending') return 'Lead explorou Street View'
    if (type === 'price_history_pending') return 'Lead analisou valor historico'
    return 'Sinal comercial ativo'
}

function behaviorSignalAction(type: string) {
    if (type === 'favorite_property_pending') return 'Comparar favorito com alternativas'
    if (type === 'revisited_property_pending') return 'Retomar imovel revisitado'
    if (type === 'street_view_pending') return 'Contextualizar rua e vizinhanca'
    if (type === 'price_history_pending') return 'Enviar leitura de valor'
    return 'Abrir atendimento consultivo'
}

function behaviorSignalMessage(type: string, activity: Record<string, any>) {
    const title = asString(activity.property_title || activity.title) || 'o imovel que voce viu'
    if (type === 'favorite_property_pending') {
        return `Oi! Vi que voce salvou ${title}. Posso te mandar uma comparacao objetiva com opcoes parecidas e pontos de decisao?`
    }
    if (type === 'revisited_property_pending') {
        return `Oi! Notei que voce voltou em ${title}. Quer que eu te ajude a entender disponibilidade, diferenciais e proximos passos?`
    }
    if (type === 'street_view_pending') {
        return `Oi! Vi que voce explorou a rua de ${title}. Posso te passar um resumo da vizinhanca, acesso e perfil da regiao?`
    }
    if (type === 'price_history_pending') {
        return `Oi! Vi que voce analisou valor e historico de ${title}. Posso te mandar uma leitura de valor, liquidez e comparaveis?`
    }
    return `Oi! Vi um sinal de interesse em ${title}. Posso te ajudar com uma leitura consultiva?`
}

function behaviorSignalReason(type: string) {
    if (type === 'favorite_property_pending') return 'Lead salvou ou comparou favorito e ainda precisa de abordagem consultiva.'
    if (type === 'revisited_property_pending') return 'Lead voltou a um imovel ja visto, indicando reconsideracao ativa.'
    if (type === 'street_view_pending') return 'Lead explorou rua e entorno, sinal forte de validacao de localizacao.'
    if (type === 'price_history_pending') return 'Lead analisou historico/valor, momento ideal para conversa consultiva.'
    return 'Lead gerou sinal comercial relevante no site.'
}

function buildBehaviorSignalFollowups(metadata: Record<string, any>) {
    const activity = Array.isArray(metadata.site_activity)
        ? metadata.site_activity.map(asRecord)
        : []
    const byKey = new Map<string, Record<string, any>>()

    for (const item of activity) {
        const recommendationType = behaviorSignalTypeFromEvent(item)
        if (!recommendationType) continue

        const propertyId = asString(item.property_id || item.target_property_id)
        if (!propertyId) continue

        const occurredAt = asString(item.occurred_at || item.created_at)
        const key = [
            'signal',
            recommendationType,
            propertyId,
        ].join(':')
        const existing = byKey.get(key)
        const existingTime = Date.parse(asString(existing?.occurred_at) || '')
        const nextTime = Date.parse(occurredAt || '')
        if (existing && Number.isFinite(existingTime) && Number.isFinite(nextTime) && existingTime >= nextTime) continue

        byKey.set(key, {
            ...item,
            key,
            followup_key: key,
            source: 'behavior_signal',
            recommendation_type: recommendationType,
            title: behaviorSignalTitle(recommendationType),
            priority: recommendationType === 'favorite_property_pending' || recommendationType === 'price_history_pending' ? 'high' : 'normal',
            message: behaviorSignalMessage(recommendationType, item),
            property_id: propertyId,
            property_title: asString(item.property_title || item.title) || null,
            property_url: asString(item.property_url) || null,
            match_score: recommendationType === 'favorite_property_pending' ? 88 : recommendationType === 'price_history_pending' ? 84 : 78,
            occurred_at: occurredAt || null,
        })
    }

    return Array.from(byKey.values())
        .sort((a, b) => Date.parse(asString(b.occurred_at) || '') - Date.parse(asString(a.occurred_at) || ''))
        .slice(0, 6)
}

function getFollowupAlertOpenInsight(lead: LeadRow, followup: Record<string, any>) {
    const metadata = asRecord(lead.metadata)
    const behaviorSummary = asRecord(metadata.behavior_summary)
    const siteActivity = Array.isArray(metadata.site_activity) ? metadata.site_activity : []
    const followupAlertId = asString(followup.alert_id)
    const followupPropertyId = asString(followup.property_id)
    const openEvents = siteActivity
        .map(asRecord)
        .filter(activity => asString(activity.event_type) === 'property_search_alert_match_opened')
    const matchingOpenEvents = openEvents.filter(activity => {
        const alertId = asString(activity.alert_id)
        const propertyId = asString(activity.property_id || activity.target_property_id)
        if (followupAlertId && alertId && followupAlertId === alertId) return true
        if (followupPropertyId && propertyId && followupPropertyId === propertyId) return true
        return !followupAlertId && !followupPropertyId
    })
    const events = matchingOpenEvents.length > 0 ? matchingOpenEvents : openEvents
    const latest = [...events].sort((a, b) => Date.parse(asString(b.occurred_at)) - Date.parse(asString(a.occurred_at)))[0] || {}

    return {
        count: matchingOpenEvents.length || eventCount(behaviorSummary, 'property_search_alert_match_opened'),
        openedAt: asString(latest.occurred_at),
        source: asString(latest.source),
    }
}

function leadDisplayName(lead: LeadRow, profile: BrokerProfileRow | null) {
    return profile?.lead_name || lead.name || lead.email || lead.phone_e164 || lead.phone || 'Lead sem nome'
}

function missingBrokerProfilesTable(error: any) {
    return /broker_lead_profiles|schema cache|relation .* does not exist|could not find the table/i.test(String(error?.message || error || ''))
}

function buildCollectedPhoneFilter(candidates: string[]) {
    const safe = candidates.map(candidate => candidate.replace(/[^0-9]/g, '')).filter(Boolean)
    return `lead_phone.in.(${safe.join(',')})`
}

function recommendationActionKey(value: any) {
    const record = asRecord(value)
    return asString(record.id || record.recommendation_id || record.followup_key)
}

async function fetchLeadRows(supabase: SupabaseAdminLike, limit: number): Promise<LeadRow[]> {
    const { data, error } = await supabase
        .from('leads')
        .select('id, name, email, phone, phone_e164, metadata, lead_score, lead_classification, visitor_id, created_at, updated_at')
        .not('metadata', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(limit)

    if (error) throw error
    return (data || []) as LeadRow[]
}

async function fetchProfiles(supabase: SupabaseAdminLike, leads: LeadRow[]) {
    const byLeadId = new Map<string, BrokerProfileRow>()
    const byPhone = new Map<string, BrokerProfileRow>()
    const leadIds = leads.map(lead => lead.id).filter(Boolean)
    const phones = Array.from(new Set(leads.flatMap(lead => phoneCandidates(lead.phone_e164 || lead.phone))))
    const rows: BrokerProfileRow[] = []

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

    return { byLeadId, byPhone }
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

function resolveProfileForLead(lead: LeadRow, profiles: Awaited<ReturnType<typeof fetchProfiles>>) {
    if (profiles.byLeadId.has(lead.id)) return profiles.byLeadId.get(lead.id) || null

    for (const phone of phoneCandidates(lead.phone_e164 || lead.phone)) {
        const profile = profiles.byPhone.get(phone)
        if (profile) return profile
    }

    return null
}

function buildFollowupTasks(params: {
    leads: LeadRow[]
    profiles: Awaited<ReturnType<typeof fetchProfiles>>
    brokerMap: Map<string, BrokerRow>
    nowMs: number
}) {
    const tasks: FollowupTask[] = []

    for (const lead of params.leads) {
        const metadata = asRecord(lead.metadata)
        const behaviorSummary = asRecord(metadata.behavior_summary)
        const alertFollowups = Array.isArray(behaviorSummary.search_alert_followups)
            ? behaviorSummary.search_alert_followups
            : []
        const premiumFollowups = buildPremiumIntentFollowups(behaviorSummary)
        const behaviorSignalFollowups = buildBehaviorSignalFollowups(metadata)
        const followups = [...premiumFollowups, ...behaviorSignalFollowups, ...alertFollowups]
        if (!followups.length) continue

        const profile = resolveProfileForLead(lead, params.profiles)
        const brokerId = asString(profile?.broker_id)
        const broker = brokerId ? params.brokerMap.get(brokerId) || null : null
        const actions = asRecord(metadata.crm_followup_actions)
        const leadPhone = phoneCandidates(lead.phone_e164 || lead.phone)[0] || lead.phone_e164 || lead.phone || ''

        for (const followup of followups) {
            if (!asString(followup?.message)) continue
            const status = getFollowupStatus(followup, actions)
            const referenceDate = getFollowupStatusTimestamp(followup, actions) || followup?.occurred_at || lead.updated_at || lead.created_at || ''
            const alertOpenInsight = getFollowupAlertOpenInsight(lead, asRecord(followup))

            tasks.push({
                lead,
                profile,
                broker,
                followup: asRecord(followup),
                followupKey: getFollowupActionKey(followup),
                status,
                ageHours: ageHoursFrom(String(referenceDate), params.nowMs),
                brokerId,
                brokerName: broker?.name || (brokerId ? 'Corretor atribuido' : 'Sem corretor'),
                leadName: leadDisplayName(lead, profile),
                leadPhone,
                alertOpenedCount: alertOpenInsight.count,
                alertOpenedAt: alertOpenInsight.openedAt,
                alertOpenSource: alertOpenInsight.source,
            })
        }
    }

    return tasks
}

function buildBrokerPerformance(tasks: FollowupTask[]) {
    const performance = new Map<string, BrokerPerformance>()

    for (const task of tasks) {
        const brokerKey = task.brokerId || task.brokerName
        const current = performance.get(brokerKey) || {
            id: task.brokerId || brokerKey,
            name: task.brokerName,
            canFilter: Boolean(task.brokerId),
            total: 0,
            pending: 0,
            sent: 0,
            responded: 0,
            converted: 0,
            dismissed: 0,
            active: 0,
            responseRate: 0,
            conversionRate: 0,
            avgScore: 0,
            scoreSum: 0,
        }

        current.total += 1
        current[task.status] += 1
        const rawScore = asNumber(task.followup.match_score ?? task.lead.lead_score ?? 0)
        current.scoreSum += rawScore || 0
        performance.set(brokerKey, current)
    }

    return Array.from(performance.values())
        .map(metric => {
            const contacted = metric.sent + metric.responded + metric.converted
            const actionable = metric.total - metric.dismissed
            return {
                ...metric,
                active: metric.pending + metric.sent + metric.responded,
                responseRate: percent(metric.responded + metric.converted, contacted),
                conversionRate: percent(metric.converted, actionable),
                avgScore: metric.total > 0 ? Math.round(metric.scoreSum / metric.total) : 0,
            }
        })
        .sort((a, b) => b.converted - a.converted || b.responseRate - a.responseRate || b.total - a.total)
}

function createRecommendation(params: {
    type: CrmActionRecommendationItem['type']
    priority: CrmActionRecommendationItem['priority']
    title: string
    action: string
    reason: string
    task: FollowupTask
    generatedAt: string
    suggestedBroker: BrokerPerformance | null
}): CrmActionRecommendationItem {
    const { task, suggestedBroker } = params

    return {
        id: `${params.type}:${task.followupKey}`,
        type: params.type,
        priority: params.priority,
        title: params.title,
        action: params.action,
        reason: params.reason,
        followup_key: task.followupKey,
        status: task.status,
        age_hours: task.ageHours,
        lead_id: task.lead.id,
        lead_name: task.leadName || null,
        lead_phone: task.leadPhone || null,
        broker_id: task.brokerId || null,
        broker_name: task.brokerName || null,
        suggested_broker_id: suggestedBroker?.id || null,
        suggested_broker_name: suggestedBroker?.name || null,
        alert_id: asString(task.followup.alert_id) || null,
        alert_title: asString(task.followup.alert_title || task.followup.title) || null,
        property_id: asString(task.followup.property_id) || null,
        property_title: asString(task.followup.property_title || task.followup.title) || null,
        property_url: asString(task.followup.property_url) || null,
        match_score: asNumber(task.followup.match_score),
        message: asString(task.followup.message) || null,
        generated_at: params.generatedAt,
    }
}

function buildRecommendations(tasks: FollowupTask[], generatedAt: string) {
    const actionableTasks = tasks
        .filter(task => task.status !== 'converted' && task.status !== 'dismissed')
        .sort((a, b) => b.ageHours - a.ageHours)
    const performance = buildBrokerPerformance(tasks)
    const overallResponseRate = percent(
        tasks.filter(task => task.status === 'responded' || task.status === 'converted').length,
        tasks.filter(task => task.status === 'sent' || task.status === 'responded' || task.status === 'converted').length
    )
    const strongestBroker = performance
        .filter(metric => metric.canFilter)
        .sort((a, b) => b.conversionRate - a.conversionRate || b.responseRate - a.responseRate || a.active - b.active)[0] || null
    const overloadedBrokerIds = new Set(performance
        .filter(metric => metric.canFilter && metric.active >= 3 && metric.responseRate < overallResponseRate && metric.id !== strongestBroker?.id)
        .map(metric => metric.id))
    const recommendations: CrmActionRecommendationItem[] = []

    for (const task of actionableTasks) {
        const premiumType = premiumIntentRecommendationType(asString(task.followup.premium_intent))
        const isPremiumTask = asString(task.followup.source) === 'premium_intent'

        const behaviorRecommendationType = asString(task.followup.recommendation_type) as RecommendationType
        const isBehaviorSignalTask = asString(task.followup.source) === 'behavior_signal'

        if (isPremiumTask && task.status === 'pending') {
            recommendations.push(createRecommendation({
                type: premiumType,
                priority: 'high',
                title: asString(task.followup.title) || premiumIntentTitle(asString(task.followup.premium_intent)),
                action: premiumIntentAction(asString(task.followup.premium_intent)),
                reason: `Lead acionou ${premiumIntentLabel(asString(task.followup.premium_intent))} no imovel e ainda precisa de atendimento consultivo.`,
                task,
                generatedAt,
                suggestedBroker: null,
            }))
        } else if (isBehaviorSignalTask && task.status === 'pending') {
            recommendations.push(createRecommendation({
                type: behaviorRecommendationType,
                priority: behaviorRecommendationType === 'favorite_property_pending' || behaviorRecommendationType === 'price_history_pending' ? 'high' : 'medium',
                title: asString(task.followup.title) || behaviorSignalTitle(behaviorRecommendationType),
                action: behaviorSignalAction(behaviorRecommendationType),
                reason: behaviorSignalReason(behaviorRecommendationType),
                task,
                generatedAt,
                suggestedBroker: null,
            }))
        } else if (task.status === 'pending' && task.alertOpenedCount > 0) {
            const matchScore = asNumber(task.followup.match_score) || 0
            recommendations.push(createRecommendation({
                type: 'alert_opened_no_contact',
                priority: task.ageHours >= PENDING_FOLLOWUP_SLA_HOURS || task.alertOpenedCount > 1 || matchScore >= 80 ? 'high' : 'medium',
                title: 'Alerta aberto sem abordagem',
                action: 'Abrir conversa consultiva',
                reason: `Lead abriu ${task.alertOpenedCount} match(es) de alerta salvo e ainda esta sem abordagem enviada.`,
                task,
                generatedAt,
                suggestedBroker: null,
            }))
        } else if (task.status === 'pending' && task.ageHours >= PENDING_FOLLOWUP_SLA_HOURS) {
            recommendations.push(createRecommendation({
                type: 'stale_pending',
                priority: task.ageHours >= 72 ? 'high' : 'medium',
                title: 'Pendente fora do SLA',
                action: 'Enviar abordagem',
                reason: `Sem envio ha mais de ${PENDING_FOLLOWUP_SLA_HOURS}h.`,
                task,
                generatedAt,
                suggestedBroker: null,
            }))
        }

        if (task.status === 'sent' && task.ageHours >= SENT_FOLLOWUP_SLA_HOURS) {
            recommendations.push(createRecommendation({
                type: 'stale_sent',
                priority: task.ageHours >= 96 ? 'high' : 'medium',
                title: 'Enviada sem resposta',
                action: 'Reativar conversa',
                reason: `Sem retorno ha mais de ${SENT_FOLLOWUP_SLA_HOURS}h.`,
                task,
                generatedAt,
                suggestedBroker: null,
            }))
        }

        if (!task.brokerId) {
            recommendations.push(createRecommendation({
                type: 'unassigned',
                priority: 'high',
                title: 'Lead sem corretor',
                action: 'Distribuir lead',
                reason: strongestBroker ? `Sugerir para ${strongestBroker.name}.` : 'Aguardando corretor disponivel.',
                task,
                generatedAt,
                suggestedBroker: strongestBroker,
            }))
        }

        if (task.brokerId && overloadedBrokerIds.has(task.brokerId)) {
            recommendations.push(createRecommendation({
                type: 'redistribution',
                priority: 'low',
                title: 'Redistribuicao sugerida',
                action: 'Rebalancear fila',
                reason: strongestBroker ? `Mover gargalo para ${strongestBroker.name}.` : 'Comparar carga por corretor.',
                task,
                generatedAt,
                suggestedBroker: strongestBroker,
            }))
        }
    }

    const summary = {
        total: recommendations.length,
        alert_opened_no_contact: recommendations.filter(item => item.type === 'alert_opened_no_contact').length,
        stale_pending: recommendations.filter(item => item.type === 'stale_pending').length,
        stale_sent: recommendations.filter(item => item.type === 'stale_sent').length,
        unassigned: recommendations.filter(item => item.type === 'unassigned').length,
        redistribution: recommendations.filter(item => item.type === 'redistribution').length,
        premium_intent_no_contact: recommendations.filter(item => item.type === 'premium_intent_no_contact').length,
        private_visit_pending: recommendations.filter(item => item.type === 'private_visit_pending').length,
        availability_pending: recommendations.filter(item => item.type === 'availability_pending').length,
        reserved_negotiation_pending: recommendations.filter(item => item.type === 'reserved_negotiation_pending').length,
        value_reading_pending: recommendations.filter(item => item.type === 'value_reading_pending').length,
        favorite_property_pending: recommendations.filter(item => item.type === 'favorite_property_pending').length,
        revisited_property_pending: recommendations.filter(item => item.type === 'revisited_property_pending').length,
        street_view_pending: recommendations.filter(item => item.type === 'street_view_pending').length,
        price_history_pending: recommendations.filter(item => item.type === 'price_history_pending').length,
    }

    return {
        recommendations,
        summary,
        strongestBroker: strongestBroker ? {
            id: strongestBroker.id,
            name: strongestBroker.name,
            response_rate: strongestBroker.responseRate,
            conversion_rate: strongestBroker.conversionRate,
        } : null,
    }
}

export async function processCrmActionRecommendations(
    supabase: SupabaseAdminLike,
    options: { limit?: number; source?: string } = {}
): Promise<CrmActionProcessResult> {
    const limit = Math.min(Math.max(Number(options.limit || 300), 1), 1000)
    const source = asString(options.source) || 'manual'
    const generatedAt = new Date().toISOString()
    const nowMs = Date.parse(generatedAt)
    const errors: string[] = []
    const leads = await fetchLeadRows(supabase, limit)
    const profiles = await fetchProfiles(supabase, leads)
    const profileRows = Array.from(new Set([
        ...Array.from(profiles.byLeadId.values()),
        ...Array.from(profiles.byPhone.values()),
    ]))
    const brokerIds = profileRows.map(profile => profile.broker_id || '').filter(Boolean)
    const brokerMap = await fetchBrokerMap(supabase, brokerIds)
    const tasks = buildFollowupTasks({ leads, profiles, brokerMap, nowMs })
    const { recommendations, summary, strongestBroker } = buildRecommendations(tasks, generatedAt)
    const byLeadId = new Map<string, CrmActionRecommendationItem[]>()

    for (const recommendation of recommendations) {
        const current = byLeadId.get(recommendation.lead_id) || []
        current.push(recommendation)
        byLeadId.set(recommendation.lead_id, current)
    }

    const leadsWithFollowups = new Set(tasks.map(task => task.lead.id))
    let updatedLeads = 0

    for (const lead of leads) {
        if (!leadsWithFollowups.has(lead.id) && !asRecord(lead.metadata).crm_action_recommendations) continue

        const leadItems = byLeadId.get(lead.id) || []
        const leadSummary = {
            total: leadItems.length,
            alert_opened_no_contact: leadItems.filter(item => item.type === 'alert_opened_no_contact').length,
            stale_pending: leadItems.filter(item => item.type === 'stale_pending').length,
            stale_sent: leadItems.filter(item => item.type === 'stale_sent').length,
            unassigned: leadItems.filter(item => item.type === 'unassigned').length,
            redistribution: leadItems.filter(item => item.type === 'redistribution').length,
            premium_intent_no_contact: leadItems.filter(item => item.type === 'premium_intent_no_contact').length,
            private_visit_pending: leadItems.filter(item => item.type === 'private_visit_pending').length,
            availability_pending: leadItems.filter(item => item.type === 'availability_pending').length,
            reserved_negotiation_pending: leadItems.filter(item => item.type === 'reserved_negotiation_pending').length,
            value_reading_pending: leadItems.filter(item => item.type === 'value_reading_pending').length,
            favorite_property_pending: leadItems.filter(item => item.type === 'favorite_property_pending').length,
            revisited_property_pending: leadItems.filter(item => item.type === 'revisited_property_pending').length,
            street_view_pending: leadItems.filter(item => item.type === 'street_view_pending').length,
            price_history_pending: leadItems.filter(item => item.type === 'price_history_pending').length,
        }
        const snapshot: CrmActionRecommendationSnapshot = {
            version: CRM_ACTION_RECOMMENDATION_VERSION,
            generated_at: generatedAt,
            source,
            summary: leadSummary,
            strongest_broker: strongestBroker,
            items: leadItems,
        }
        const metadata = {
            ...asRecord(lead.metadata),
            crm_action_recommendations: snapshot,
        }
        const { error } = await supabase
            .from('leads')
            .update({ metadata })
            .eq('id', lead.id)

        if (error) {
            errors.push(`${lead.id}: ${error.message}`)
            continue
        }

        updatedLeads += 1
    }

    return {
        processed_leads: leads.length,
        leads_with_followups: leadsWithFollowups.size,
        updated_leads: updatedLeads,
        total_recommendations: recommendations.length,
        summary,
        strongest_broker: strongestBroker,
        generated_at: generatedAt,
        errors,
    }
}

export async function applyCrmActionRecommendation(
    supabase: SupabaseAdminLike,
    input: {
        lead_id?: string | null
        recommendation_id?: string | null
        followup_key?: string | null
        target_broker_id?: string | null
        source?: string | null
        actor?: AdminActorContext | null
    }
): Promise<CrmActionApplyResult> {
    const leadId = asString(input.lead_id)
    if (!leadId) throw new Error('lead_id required')

    const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('id, name, email, phone, phone_e164, metadata, lead_score, lead_classification, created_at, updated_at')
        .eq('id', leadId)
        .maybeSingle()

    if (leadError) throw leadError
    if (!lead?.id) throw new Error('lead not found')

    const metadata = asRecord(lead.metadata)
    const snapshot = asRecord(metadata.crm_action_recommendations)
    const items = Array.isArray(snapshot.items) ? snapshot.items : []
    const recommendationLookup = recommendationActionKey(input)
    const recommendation = items.find((item: any) => {
        const record = asRecord(item)
        return asString(record.id) === recommendationLookup
            || asString(record.followup_key) === recommendationLookup
            || asString(record.followup_key) === asString(input.followup_key)
    }) as CrmActionRecommendationItem | undefined

    if (!recommendation) throw new Error('recommendation not found')
    if (recommendation.type !== 'unassigned' && recommendation.type !== 'redistribution') {
        throw new Error('recommendation type is not assignable')
    }

    const targetBrokerId = asString(input.target_broker_id || recommendation.suggested_broker_id)
    if (!targetBrokerId) throw new Error('target broker required')

    const { data: broker, error: brokerError } = await supabase
        .from('virtual_brokers')
        .select('id, name, is_active')
        .eq('id', targetBrokerId)
        .maybeSingle()

    if (brokerError) throw brokerError
    if (!broker?.id) throw new Error('target broker not found')

    const normalizedPhone = phoneCandidates(lead.phone_e164 || lead.phone || recommendation.lead_phone).find(Boolean)
    if (!normalizedPhone) throw new Error('lead phone required for broker profile')

    const now = new Date().toISOString()
    const profileNote = [
        `Recomendacao IA aplicada em ${now}.`,
        recommendation.title,
        recommendation.reason,
    ].filter(Boolean).join(' ')
    const { data: existingProfile, error: existingProfileError } = await supabase
        .from('broker_lead_profiles')
        .select('id, lead_name, qualification_score, status, notes')
        .eq('broker_id', targetBrokerId)
        .eq('lead_phone', normalizedPhone)
        .maybeSingle()

    if (existingProfileError && !missingBrokerProfilesTable(existingProfileError)) throw existingProfileError

    let profileId: string | null = existingProfile?.id || null

    if (existingProfile?.id) {
        const nextScore = Math.max(
            Number(existingProfile.qualification_score || 0),
            Number(recommendation.match_score || 0),
            Number(lead.lead_score || 0)
        )
        const { data: updatedProfile, error: updateProfileError } = await supabase
            .from('broker_lead_profiles')
            .update({
                lead_id: lead.id,
                lead_name: existingProfile.lead_name || recommendation.lead_name || lead.name || null,
                qualification_score: Math.max(0, Math.min(100, Number.isFinite(nextScore) ? nextScore : 0)),
                status: existingProfile.status || 'qualifying',
                notes: existingProfile.notes || profileNote,
                updated_at: now,
            })
            .eq('id', existingProfile.id)
            .select('id')
            .maybeSingle()

        if (updateProfileError) throw updateProfileError
        profileId = updatedProfile?.id || existingProfile.id
    } else {
        const { data: insertedProfile, error: insertProfileError } = await supabase
            .from('broker_lead_profiles')
            .insert({
                lead_id: lead.id,
                lead_phone: normalizedPhone,
                broker_id: targetBrokerId,
                lead_name: recommendation.lead_name || lead.name || lead.email || null,
                qualification_score: Math.max(0, Math.min(100, Number(recommendation.match_score || lead.lead_score || 0))),
                status: 'qualifying',
                notes: profileNote,
                documents_received: [],
                first_contact_at: now,
                updated_at: now,
            })
            .select('id')
            .maybeSingle()

        if (insertProfileError) throw insertProfileError
        profileId = insertedProfile?.id || null
    }

    const actionKey = recommendation.id || recommendation.followup_key
    const currentActions = asRecord(metadata.crm_action_recommendation_actions)
    const previousAction = asRecord(currentActions[actionKey])
    const actor = input.actor || null
    const action = {
        status: 'applied',
        source: asString(input.source) || 'crm',
        applied_at: now,
        actor_type: actor?.actor_type || previousAction.actor_type || null,
        actor_id: actor?.actor_id || previousAction.actor_id || previousAction.applied_by_admin_user_id || null,
        actor_name: actor?.actor_name || previousAction.actor_name || previousAction.applied_by_name || null,
        actor_email: actor?.actor_email || previousAction.actor_email || previousAction.applied_by_email || null,
        auth_user_id: actor?.auth_user_id || previousAction.auth_user_id || null,
        applied_by_admin_user_id: actor?.actor_id || previousAction.applied_by_admin_user_id || null,
        applied_by_name: actor?.actor_name || previousAction.applied_by_name || null,
        applied_by_email: actor?.actor_email || previousAction.applied_by_email || null,
        recommendation_id: recommendation.id,
        recommendation_type: recommendation.type,
        recommendation_title: recommendation.title || null,
        recommendation_reason: recommendation.reason || null,
        followup_key: recommendation.followup_key,
        property_id: recommendation.property_id || null,
        property_title: recommendation.property_title || null,
        alert_id: recommendation.alert_id || null,
        alert_title: recommendation.alert_title || null,
        source_broker_id: recommendation.broker_id || null,
        source_broker_name: recommendation.broker_name || null,
        target_broker_id: targetBrokerId,
        target_broker_name: broker.name || null,
        profile_id: profileId,
    }
    const nextItems = items.map((item: any) => {
        const record = asRecord(item)
        if (asString(record.id) !== recommendation.id && asString(record.followup_key) !== recommendation.followup_key) return item
        return {
            ...record,
            applied_status: 'applied',
            applied_at: now,
            target_broker_id: targetBrokerId,
            target_broker_name: broker.name || null,
            profile_id: profileId,
            applied_by_name: actor?.actor_name || previousAction.applied_by_name || null,
            applied_by_email: actor?.actor_email || previousAction.applied_by_email || null,
        }
    })
    const nextMetadata = {
        ...metadata,
        crm_action_recommendation_actions: {
            ...currentActions,
            [actionKey]: action,
        },
        crm_action_recommendations: {
            ...snapshot,
            items: nextItems,
            last_applied_at: now,
        },
    }

    const { error: leadUpdateError } = await supabase
        .from('leads')
        .update({
            metadata: nextMetadata,
            updated_at: now,
        })
        .eq('id', lead.id)

    if (leadUpdateError) throw leadUpdateError

    await supabase
        .from('funnel_events')
        .insert({
            lead_id: lead.id,
            event_type: 'crm_action_recommendation_applied',
            metadata: {
                event_label: 'Aplicou recomendacao comercial',
                recommendation_id: recommendation.id,
                recommendation_type: recommendation.type,
                recommendation_title: recommendation.title,
                recommendation_reason: recommendation.reason,
                followup_key: recommendation.followup_key,
                property_id: recommendation.property_id || null,
                property_title: recommendation.property_title || null,
                alert_id: recommendation.alert_id || null,
                alert_title: recommendation.alert_title || null,
                source_broker_id: recommendation.broker_id || null,
                source_broker_name: recommendation.broker_name || null,
                target_broker_id: targetBrokerId,
                target_broker_name: broker.name || null,
                profile_id: profileId,
                actor_type: action.actor_type,
                actor_id: action.actor_id,
                actor_name: action.actor_name,
                actor_email: action.actor_email,
                auth_user_id: action.auth_user_id,
                applied_by_admin_user_id: action.applied_by_admin_user_id,
                applied_by_name: action.applied_by_name,
                applied_by_email: action.applied_by_email,
                source: asString(input.source) || 'crm',
            },
        })
        .then(({ error }: any) => {
            if (error) console.warn('[CRM Action Recommendations] applied event skipped:', error.message)
        })

    return {
        lead_id: lead.id,
        recommendation_id: recommendation.id,
        recommendation_type: recommendation.type,
        target_broker_id: targetBrokerId,
        target_broker_name: broker.name || null,
        profile_id: profileId,
        applied_at: now,
        actor_name: action.actor_name,
        actor_email: action.actor_email,
    }
}
