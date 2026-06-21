import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { phoneCandidates } from '@/lib/whatsapp/lead-sync'
import {
    leadIntentColumnsFromMetadata,
    mergeLeadSiteActivity,
    type LeadActivityEventRow,
} from '@/lib/tracking/lead-activity'
import { getOptionalAdminActorContext, type AdminActorContext } from '@/lib/events/admin-auth'
import { propertyDetailsPath } from '@/lib/properties/responsive-destination'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function buildPhoneOrFilter(candidates: string[]): string {
    const safe = candidates
        .map(candidate => candidate.replace(/[^0-9]/g, ''))
        .filter(Boolean)
    return `phone.in.(${safe.join(',')}),phone_e164.in.(${safe.join(',')})`
}

function buildCollectedPhoneFilter(candidates: string[]): string {
    const safe = candidates
        .map(candidate => candidate.replace(/[^0-9]/g, ''))
        .filter(Boolean)
    return `lead_phone.in.(${safe.join(',')})`
}

function conversationKey(brokerId: string | null | undefined, phone: string | null | undefined) {
    const normalizedPhone = phoneCandidates(phone).find(Boolean)
    return brokerId && normalizedPhone ? `${brokerId}:${normalizedPhone}` : ''
}

function metadataValue(source: any, path: string[]): string | null {
    let cursor = source
    for (const key of path) {
        if (!cursor || typeof cursor !== 'object') return null
        cursor = cursor[key]
    }
    return cursor == null ? null : String(cursor)
}

function asRecord(value: any): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asString(value: any): string {
    return typeof value === 'string' ? value.trim() : ''
}

function normalizeFollowupStatus(value: any) {
    const status = String(value || '').toLowerCase()
    if (status === 'sent') return 'sent'
    if (status === 'responded') return 'responded'
    if (status === 'converted') return 'converted'
    if (status === 'dismissed') return 'dismissed'
    return 'pending'
}

function followupStatusLabel(status: string) {
    if (status === 'sent') return 'Enviada'
    if (status === 'responded') return 'Respondida'
    if (status === 'converted') return 'Convertida'
    if (status === 'dismissed') return 'Descartada'
    return 'Pendente'
}

function followupEventType(status: string) {
    if (status === 'sent') return 'crm_search_alert_followup_sent'
    if (status === 'responded') return 'crm_search_alert_followup_responded'
    if (status === 'converted') return 'crm_search_alert_followup_converted'
    if (status === 'dismissed') return 'crm_search_alert_followup_dismissed'
    return 'crm_search_alert_followup_pending'
}

function followupActionKey(value: any) {
    const record = asRecord(value)
    const explicit = asString(record.key || record.followup_key)
    if (explicit) return explicit

    return [
        asString(record.alert_id),
        asString(record.property_id),
        asString(record.message),
    ].filter(Boolean).join(':')
}

function recommendationMatchesFollowup(recommendation: Record<string, any>, action: Record<string, any>) {
    const recommendationKey = asString(recommendation.followup_key)
    const actionKey = asString(action.key)
    if (recommendationKey && actionKey && recommendationKey === actionKey) return true

    const recommendationAlertId = asString(recommendation.alert_id)
    const actionAlertId = asString(action.alert_id)
    if (recommendationAlertId && actionAlertId && recommendationAlertId === actionAlertId) return true

    const recommendationPropertyId = asString(recommendation.property_id)
    const actionPropertyId = asString(action.property_id)
    return Boolean(recommendationPropertyId && actionPropertyId && recommendationPropertyId === actionPropertyId)
}

function isPremiumRecommendationType(type: string) {
    return [
        'premium_intent_no_contact',
        'private_visit_pending',
        'availability_pending',
        'reserved_negotiation_pending',
        'value_reading_pending',
    ].includes(type)
}

function isBehaviorSignalRecommendationType(type: string) {
    return [
        'favorite_property_pending',
        'revisited_property_pending',
        'street_view_pending',
        'price_history_pending',
    ].includes(type)
}

function shouldResolveConsultativeRecommendation(type: string, status: string) {
    if ((type === 'alert_opened_no_contact' || type === 'stale_pending') && status !== 'pending') return true
    if (type === 'stale_sent' && ['responded', 'converted', 'dismissed'].includes(status)) return true
    if (isPremiumRecommendationType(type) && status !== 'pending') return true
    if (isBehaviorSignalRecommendationType(type) && status !== 'pending') return true
    return false
}

function resolveFollowupRecommendationSnapshot(metadata: Record<string, any>, action: Record<string, any>, now: string) {
    const snapshot = asRecord(metadata.crm_action_recommendations)
    const items = Array.isArray(snapshot.items) ? snapshot.items : []
    if (!items.length) return snapshot.items ? snapshot : null

    const status = normalizeFollowupStatus(action.status)
    let changed = false
    const nextItems = items.map((item: any) => {
        const record = asRecord(item)
        const type = asString(record.type)
        if (!['alert_opened_no_contact', 'stale_pending', 'stale_sent'].includes(type) && !isPremiumRecommendationType(type) && !isBehaviorSignalRecommendationType(type)) return item
        if (!recommendationMatchesFollowup(record, action)) return item

        const nextRecord = {
            ...record,
            action_status: status,
            action_updated_at: now,
            action_actor_type: action.actor_type || record.action_actor_type || null,
            action_actor_id: action.actor_id || record.action_actor_id || null,
            action_actor_name: action.actor_name || record.action_actor_name || null,
            action_actor_email: action.actor_email || record.action_actor_email || null,
        }

        if (!shouldResolveConsultativeRecommendation(type, status)) return nextRecord

        changed = true
        return {
            ...nextRecord,
            resolved_status: status,
            resolved_at: record.resolved_at || now,
            resolved_reason: 'followup_status_updated',
        }
    })

    const unresolvedItems = nextItems
        .map(asRecord)
        .filter(item => !item.applied_at && item.applied_status !== 'applied' && !item.resolved_at)

    return {
        ...snapshot,
        items: nextItems,
        ...(changed ? { last_resolved_at: now } : {}),
        active_summary: {
            total: unresolvedItems.length,
            alert_opened_no_contact: unresolvedItems.filter(item => item.type === 'alert_opened_no_contact').length,
            stale_pending: unresolvedItems.filter(item => item.type === 'stale_pending').length,
            stale_sent: unresolvedItems.filter(item => item.type === 'stale_sent').length,
            unassigned: unresolvedItems.filter(item => item.type === 'unassigned').length,
            redistribution: unresolvedItems.filter(item => item.type === 'redistribution').length,
            premium_intent_no_contact: unresolvedItems.filter(item => item.type === 'premium_intent_no_contact').length,
            private_visit_pending: unresolvedItems.filter(item => item.type === 'private_visit_pending').length,
            availability_pending: unresolvedItems.filter(item => item.type === 'availability_pending').length,
            reserved_negotiation_pending: unresolvedItems.filter(item => item.type === 'reserved_negotiation_pending').length,
            value_reading_pending: unresolvedItems.filter(item => item.type === 'value_reading_pending').length,
            favorite_property_pending: unresolvedItems.filter(item => item.type === 'favorite_property_pending').length,
            revisited_property_pending: unresolvedItems.filter(item => item.type === 'revisited_property_pending').length,
            street_view_pending: unresolvedItems.filter(item => item.type === 'street_view_pending').length,
            price_history_pending: unresolvedItems.filter(item => item.type === 'price_history_pending').length,
        },
    }
}

function actionForFollowup(actions: Record<string, any>, followup: any) {
    const key = followupActionKey(followup)
    if (key && actions[key]) return asRecord(actions[key])

    const fallbackKey = [
        asString(followup?.alert_id),
        asString(followup?.property_id),
    ].filter(Boolean).join(':')

    return fallbackKey ? asRecord(actions[fallbackKey]) : {}
}

function applyFollowupActionsToSummary(summary: any, actionsSource: any) {
    const summaryRecord = asRecord(summary)
    if (!summary || Object.keys(summaryRecord).length === 0) return summary || null

    const actions = asRecord(actionsSource)
    const followups = Array.isArray(summaryRecord.search_alert_followups)
        ? summaryRecord.search_alert_followups
        : []

    if (!followups.length) return summaryRecord

    return {
        ...summaryRecord,
        search_alert_followups: followups.map((item: any) => {
            const action = actionForFollowup(actions, item)
            const status = normalizeFollowupStatus(action.status)

            return {
                ...item,
                action_status: status,
                action_updated_at: action.updated_at || null,
                action_note: action.note || null,
                action_actor_type: action.actor_type || null,
                action_actor_id: action.actor_id || action.updated_by_admin_user_id || null,
                action_actor_name: action.actor_name || action.updated_by_name || null,
                action_actor_email: action.actor_email || action.updated_by_email || null,
                sent_at: action.sent_at || null,
                responded_at: action.responded_at || null,
                converted_at: action.converted_at || null,
            }
        }),
    }
}

function isMissingBrokerProfilesTable(error: any) {
    return /broker_lead_profiles|schema cache|relation .* does not exist|could not find the table/i.test(String(error?.message || error || ''))
}

function normalizeCrmStatusFromConversation(status: any) {
    const value = String(status || '').toLowerCase()
    if (value === 'transferred') return 'transferred'
    if (value === 'closed') return 'converted'
    return 'new'
}

function normalizeConversationStatusFromCrm(status: any) {
    const value = String(status || '').toLowerCase()
    if (value === 'transferred') return 'transferred'
    if (value === 'converted' || value === 'lost') return 'closed'
    return 'active'
}

function rowMatchesSearch(row: any, searchTerm: string, emailMatchedPhones: string[]) {
    if (!searchTerm) return true
    const needle = searchTerm.toLowerCase()
    const fields = [
        row.lead_name,
        row.lead_phone,
        row.region,
        row.interest,
    ]

    if (fields.some(field => String(field || '').toLowerCase().includes(needle))) return true

    const rowPhones = phoneCandidates(row.lead_phone)
    return emailMatchedPhones.some(phone => rowPhones.includes(phone))
}

function conversationToCrmRow(conversation: any) {
    const extracted = conversation?.lead_data_extracted || {}
    const messages = Array.isArray(conversation?.messages) ? conversation.messages : []
    const fallbackName = messages
        .map((message: any) => message?.senderName || message?.sender_name || message?.name)
        .find(Boolean)

    return {
        id: `conversation:${conversation.id}`,
        lead_id: conversation.lead_id || null,
        lead_phone: conversation.lead_phone,
        lead_name: extracted.name || extracted.lead_name || fallbackName || null,
        interest: extracted.interest || extracted.intent || null,
        region: extracted.region || extracted.location || extracted.city || null,
        budget_min: null,
        budget_max: extracted.budget_number || null,
        bedrooms_wanted: extracted.bedrooms || extracted.bedrooms_wanted || null,
        property_type: extracted.property_type || extracted.type || null,
        timeline: extracted.timeline || extracted.timeframe || null,
        qualification_score: 0,
        lead_classification: null,
        status: normalizeCrmStatusFromConversation(conversation.status),
        notes: conversation.summary || null,
        documents_received: [],
        latitude: null,
        longitude: null,
        broker_id: conversation.broker_id || null,
        instance_id: conversation.instance_id || null,
        conversation_id: conversation.id,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
    }
}

const LEAD_ENRICH_SELECT = `
    id,
    name,
    email,
    phone,
    phone_e164,
    avatar_url,
    avatar_source,
    avatar_updated_at,
    metadata,
    acquired_via,
    funnel_stage,
    lead_score,
    lead_classification,
    ai_summary,
    lead_purpose,
    lead_budget,
    lead_timeframe,
    visitor:visitors (
        detected_source,
        device_type,
        browser,
        os,
        country,
        city,
        region,
        utm_source,
        utm_medium,
        utm_campaign,
        referrer,
        last_visit_at
    ),
    landing_page:landing_pages (
        title,
        slug
    )
`

async function fetchLeadsForRows(supabase: ReturnType<typeof getSupabase>, rows: any[]) {
    const byId = new Map<string, any>()
    const byPhone = new Map<string, any>()
    const leadIds = Array.from(new Set(rows.map((row: any) => String(row.lead_id || '').trim()).filter(Boolean)))
    const allCandidates = Array.from(new Set(rows.flatMap((row: any) => phoneCandidates(row.lead_phone))))

    if (leadIds.length > 0) {
        const { data, error } = await supabase
            .from('leads')
            .select(LEAD_ENRICH_SELECT)
            .in('id', leadIds)

        if (error) {
            console.warn('[Lead CRM] enrich leads by id failed:', error.message)
        } else {
            for (const lead of data || []) {
                byId.set(lead.id, lead)
                for (const candidate of phoneCandidates(lead.phone_e164 || lead.phone)) {
                    byPhone.set(candidate, lead)
                }
            }
        }
    }

    if (allCandidates.length > 0) {
        const { data, error } = await supabase
            .from('leads')
            .select(LEAD_ENRICH_SELECT)
            .or(buildPhoneOrFilter(allCandidates))

        if (error) {
            console.warn('[Lead CRM] enrich leads by phone failed:', error.message)
        } else {
            for (const lead of data || []) {
                byId.set(lead.id, lead)
                for (const candidate of phoneCandidates(lead.phone_e164 || lead.phone)) {
                    byPhone.set(candidate, lead)
                }
            }
        }
    }

    return { byId, byPhone }
}

async function fetchBrokerMap(supabase: ReturnType<typeof getSupabase>, rows: any[]) {
    const brokerIds = Array.from(new Set(rows.map((row: any) => row.broker_id).filter(Boolean)))
    const brokerMap = new Map<string, any>()
    if (brokerIds.length === 0) return brokerMap

    const { data, error } = await supabase
        .from('virtual_brokers')
        .select('id, name, is_active')
        .in('id', brokerIds)

    if (error) {
        console.warn('[Lead CRM] broker enrichment failed:', error.message)
        return brokerMap
    }

    for (const broker of data || []) brokerMap.set(broker.id, broker)
    return brokerMap
}

async function fetchConversationsForRows(supabase: ReturnType<typeof getSupabase>, rows: any[]) {
    const byId = new Map<string, any>()
    const byBrokerPhone = new Map<string, any>()
    const conversationIds = Array.from(new Set(rows.map((row: any) => String(row.conversation_id || '').trim()).filter(Boolean)))
    const brokerIds = Array.from(new Set(rows.map((row: any) => row.broker_id).filter(Boolean)))
    const phones = Array.from(new Set(rows.flatMap((row: any) => phoneCandidates(row.lead_phone))))

    if (conversationIds.length > 0) {
        const { data, error } = await supabase
            .from('whatsapp_ai_conversations')
            .select('id, broker_id, instance_id, lead_phone, messages, status, summary, created_at, updated_at')
            .in('id', conversationIds)

        if (error) {
            console.warn('[Lead CRM] conversation enrichment by id failed:', error.message)
        } else {
            for (const conversation of data || []) {
                byId.set(conversation.id, conversation)
                const key = conversationKey(conversation.broker_id, conversation.lead_phone)
                if (key) byBrokerPhone.set(key, conversation)
            }
        }
    }

    if (brokerIds.length > 0 && phones.length > 0) {
        const { data, error } = await supabase
            .from('whatsapp_ai_conversations')
            .select('id, broker_id, instance_id, lead_phone, messages, status, summary, created_at, updated_at')
            .in('broker_id', brokerIds)
            .in('lead_phone', phones)
            .order('updated_at', { ascending: false })

        if (error) {
            console.warn('[Lead CRM] conversation enrichment by phone failed:', error.message)
        } else {
            for (const conversation of data || []) {
                byId.set(conversation.id, conversation)
                const key = conversationKey(conversation.broker_id, conversation.lead_phone)
                if (key && !byBrokerPhone.has(key)) byBrokerPhone.set(key, conversation)
            }
        }
    }

    return { byId, byBrokerPhone }
}

function enrichCrmRow(row: any, source: 'profile' | 'legacy' | 'conversation', lead: any, broker: any, conversation: any) {
    const metadata = lead?.metadata || {}
    const tracking = typeof metadata?.tracking === 'object' && metadata.tracking ? metadata.tracking : {}
    const visitor = lead?.visitor || {}
    const landingPage = lead?.landing_page || {}
    const selfReportedSource = metadataValue(tracking, ['self_reported_source'])
    const behaviorSummary = metadata?.behavior_summary || null
    const followupActions = metadata?.crm_followup_actions || {}
    const behaviorSummaryWithActions = applyFollowupActionsToSummary(behaviorSummary, followupActions)
    const behaviorScore = Number(behaviorSummary?.engagement_score || 0)

    return {
        ...row,
        crm_source: source,
        broker_name: broker?.name || null,
        broker_is_active: broker?.is_active ?? null,
        lead_id: lead?.id || row.lead_id || null,
        lead_name: row.lead_name || lead?.name || null,
        lead_email: lead?.email || null,
        avatar_url: lead?.avatar_url || null,
        avatar_source: lead?.avatar_source || null,
        avatar_updated_at: lead?.avatar_updated_at || null,
        source: selfReportedSource || visitor.detected_source || metadataValue(tracking, ['detected_source']) || lead?.acquired_via || null,
        utm_source: visitor.utm_source || metadataValue(tracking, ['utm_source']) || null,
        utm_medium: visitor.utm_medium || metadataValue(tracking, ['utm_medium']) || null,
        utm_campaign: visitor.utm_campaign || metadataValue(tracking, ['utm_campaign']) || null,
        landing_page_title: landingPage.title || null,
        landing_page_slug: landingPage.slug || metadataValue(metadata, ['landing_page_slug']) || null,
        device_type: visitor.device_type || metadataValue(tracking, ['device_type']) || null,
        browser: visitor.browser || metadataValue(tracking, ['browser']) || null,
        os: visitor.os || metadataValue(tracking, ['os']) || null,
        city: visitor.city || metadataValue(tracking, ['city']) || null,
        state: visitor.region || metadataValue(tracking, ['region']) || null,
        country: visitor.country || metadataValue(tracking, ['country']) || null,
        ai_summary: lead?.ai_summary || null,
        lead_classification: row.lead_classification || lead?.lead_classification || behaviorSummary?.lead_classification || null,
        lead_score: lead?.lead_score || behaviorScore || null,
        last_whatsapp_click: metadata?.last_whatsapp_click || null,
        whatsapp_clicks: Array.isArray(metadata?.whatsapp_clicks)
            ? metadata.whatsapp_clicks.slice(-10).reverse()
            : [],
        site_activity: Array.isArray(metadata?.site_activity)
            ? metadata.site_activity.slice(-15).reverse()
            : [],
        behavior_summary: behaviorSummaryWithActions,
        crm_action_recommendations: metadata?.crm_action_recommendations || null,
        crm_action_recommendation_actions: metadata?.crm_action_recommendation_actions || null,
        crm_executive_brief: metadata?.crm_executive_brief || null,
        crm_executive_brief_history: Array.isArray(metadata?.crm_executive_brief_history)
            ? metadata.crm_executive_brief_history.slice(0, 8)
            : [],
        precise_location: metadata?.precise_location || metadata?.gps_location || null,
        gps_permission: metadata?.gps_permission || null,
        conversation_id: conversation?.id || row.conversation_id || null,
        conversation_status: conversation?.status || null,
        conversation_updated_at: conversation?.updated_at || null,
        conversation_summary: conversation?.summary || null,
        conversation_messages: Array.isArray(conversation?.messages) ? conversation.messages : [],
    }
}

async function loadCrmRows(params: {
    supabase: ReturnType<typeof getSupabase>
    brokerId: string
    status: string | null
    searchTerm: string
    emailMatchedPhones: string[]
    limit: number
}) {
    const { supabase, brokerId, status, searchTerm, emailMatchedPhones, limit } = params
    let query = supabase
        .from('broker_lead_profiles')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(limit)

    if (brokerId) query = query.eq('broker_id', brokerId)
    if (status && status !== 'all') query = query.eq('status', status)

    if (searchTerm) {
        const safeSearch = searchTerm.replace(/[,%()]/g, ' ')
        const filters = [
            `lead_name.ilike.%${safeSearch}%`,
            `lead_phone.ilike.%${safeSearch}%`,
            `region.ilike.%${safeSearch}%`,
            `interest.ilike.%${safeSearch}%`,
        ]
        if (emailMatchedPhones.length > 0) {
            filters.push(buildCollectedPhoneFilter(emailMatchedPhones))
        }
        query = query.or(filters.join(','))
    }

    const profileResult = await query
    if (!profileResult.error) {
        return { rows: profileResult.data || [], source: 'profile' as const }
    }

    if (!isMissingBrokerProfilesTable(profileResult.error)) throw profileResult.error

    if (brokerId) {
        let conversationQuery = supabase
            .from('whatsapp_ai_conversations')
            .select('id, lead_id, broker_id, instance_id, lead_phone, messages, summary, lead_data_extracted, status, created_at, updated_at')
            .eq('broker_id', brokerId)
            .order('updated_at', { ascending: false })
            .limit(limit)

        if (status === 'transferred') conversationQuery = conversationQuery.eq('status', 'transferred')
        if (status === 'converted') conversationQuery = conversationQuery.eq('status', 'closed')

        const conversationResult = await conversationQuery
        if (conversationResult.error) throw conversationResult.error

        const rows = (conversationResult.data || [])
            .map(conversationToCrmRow)
            .filter(row => !status || status === 'all' || row.status === status)
            .filter(row => rowMatchesSearch(row, searchTerm, emailMatchedPhones))

        return { rows, source: 'conversation' as const }
    }

    let legacyQuery = supabase
        .from('lead_collected_data')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(limit)

    if (brokerId) legacyQuery = legacyQuery.eq('broker_id', brokerId)
    if (status && status !== 'all') legacyQuery = legacyQuery.eq('status', status)

    if (searchTerm) {
        const safeSearch = searchTerm.replace(/[,%()]/g, ' ')
        const filters = [
            `lead_name.ilike.%${safeSearch}%`,
            `lead_phone.ilike.%${safeSearch}%`,
            `region.ilike.%${safeSearch}%`,
        ]
        if (emailMatchedPhones.length > 0) {
            filters.push(buildCollectedPhoneFilter(emailMatchedPhones))
        }
        legacyQuery = legacyQuery.or(filters.join(','))
    }

    const legacyResult = await legacyQuery
    if (legacyResult.error) throw legacyResult.error

    return { rows: legacyResult.data || [], source: 'legacy' as const }
}

async function findLeadForFollowup(supabase: ReturnType<typeof getSupabase>, body: any) {
    const leadId = asString(body.lead_id)
    if (leadId) {
        const { data, error } = await supabase
            .from('leads')
            .select('id, visitor_id, metadata, lead_score, lead_classification')
            .eq('id', leadId)
            .maybeSingle()

        if (error) throw error
        if (data?.id) return data
    }

    const phones = phoneCandidates(body.lead_phone)
    if (phones.length === 0) return null

    const { data, error } = await supabase
        .from('leads')
        .select('id, visitor_id, metadata, lead_score, lead_classification')
        .or(buildPhoneOrFilter(phones))
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error) throw error
    return data || null
}

async function appendFollowupActionEvent(params: {
    supabase: ReturnType<typeof getSupabase>
    lead: any
    action: Record<string, any>
}) {
    const status = normalizeFollowupStatus(params.action.status)
    const metadata = {
        event_label: 'Atualizou abordagem comercial',
        followup_key: params.action.key,
        followup_status: status,
        followup_status_label: followupStatusLabel(status),
        alert_id: params.action.alert_id || null,
        alert_title: params.action.alert_title || null,
        property_id: params.action.property_id || null,
        property_title: params.action.property_title || null,
        property_url: params.action.property_url || null,
        title: params.action.property_title || params.action.alert_title || 'Abordagem de alerta salvo',
        match_score: params.action.match_score ?? null,
        actor_type: params.action.actor_type || null,
        actor_id: params.action.actor_id || null,
        actor_name: params.action.actor_name || null,
        actor_email: params.action.actor_email || null,
        auth_user_id: params.action.auth_user_id || null,
        source: 'crm_followup_queue',
        page_path: params.action.property_id ? propertyDetailsPath({
            id: String(params.action.property_id),
            source_slug: asString(params.action.source_slug || params.action.property_slug) || null,
            slug: asString(params.action.slug) || null,
            title: asString(params.action.property_title || params.action.title) || null,
            seo_title: asString(params.action.seo_title) || null,
            property_type: asString(params.action.property_type) || null,
        }) : null,
    }

    const { data, error } = await params.supabase
        .from('funnel_events')
        .insert({
            visitor_id: params.lead.visitor_id || null,
            lead_id: params.lead.id,
            event_type: followupEventType(status),
            metadata,
        })
        .select('id, event_type, metadata, created_at')
        .single()

    if (error) {
        console.warn('[Lead CRM] followup action event skipped:', error.message)
        return null
    }

    return data as LeadActivityEventRow
}

async function fetchFollowupActivityRows(params: {
    supabase: ReturnType<typeof getSupabase>
    lead: any
    fallback: LeadActivityEventRow | null
}) {
    let eventRows: LeadActivityEventRow[] = params.fallback ? [params.fallback] : []
    let query = params.supabase
        .from('funnel_events')
        .select('id, event_type, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(120)

    if (params.lead.visitor_id) {
        query = query.eq('visitor_id', params.lead.visitor_id)
    } else {
        query = query.eq('lead_id', params.lead.id)
    }

    const { data, error } = await query

    if (error) {
        console.warn('[Lead CRM] followup activity fetch skipped:', error.message)
    } else if (data?.length) {
        eventRows = data as LeadActivityEventRow[]
    }

    return eventRows.reverse()
}

async function updateLeadFollowupAction(supabase: ReturnType<typeof getSupabase>, body: any, actor: AdminActorContext | null = null) {
    const payload = asRecord(body.followup_action)
    const key = followupActionKey(payload)

    if (!key) {
        return NextResponse.json({ success: false, error: 'followup key required' }, { status: 400 })
    }

    const lead = await findLeadForFollowup(supabase, body)
    if (!lead?.id) {
        return NextResponse.json({ success: false, error: 'lead not found for followup action' }, { status: 404 })
    }

    const now = new Date().toISOString()
    const metadata = asRecord(lead.metadata)
    const currentActions = asRecord(metadata.crm_followup_actions)
    const previous = asRecord(currentActions[key])
    const status = normalizeFollowupStatus(payload.status)
    const action = {
        ...previous,
        key,
        status,
        alert_id: asString(payload.alert_id) || previous.alert_id || null,
        alert_title: asString(payload.alert_title) || previous.alert_title || null,
        property_id: asString(payload.property_id) || previous.property_id || null,
        property_title: asString(payload.property_title) || previous.property_title || null,
        property_url: asString(payload.property_url) || previous.property_url || null,
        message: asString(payload.message) || previous.message || null,
        match_score: Number.isFinite(Number(payload.match_score)) ? Number(payload.match_score) : previous.match_score ?? null,
        note: asString(payload.note) || previous.note || null,
        actor_type: actor?.actor_type || previous.actor_type || null,
        actor_id: actor?.actor_id || previous.actor_id || previous.updated_by_admin_user_id || null,
        actor_name: actor?.actor_name || previous.actor_name || previous.updated_by_name || null,
        actor_email: actor?.actor_email || previous.actor_email || previous.updated_by_email || null,
        auth_user_id: actor?.auth_user_id || previous.auth_user_id || null,
        updated_by_admin_user_id: actor?.actor_id || previous.updated_by_admin_user_id || null,
        updated_by_name: actor?.actor_name || previous.updated_by_name || null,
        updated_by_email: actor?.actor_email || previous.updated_by_email || null,
        source: 'crm',
        updated_at: now,
        sent_at: status === 'sent' ? previous.sent_at || now : previous.sent_at || null,
        responded_at: status === 'responded' ? previous.responded_at || now : previous.responded_at || null,
        converted_at: status === 'converted' ? previous.converted_at || now : previous.converted_at || null,
        dismissed_at: status === 'dismissed' ? previous.dismissed_at || now : previous.dismissed_at || null,
    }

    const nextActions = {
        ...currentActions,
        [key]: action,
    }
    const nextRecommendationSnapshot = resolveFollowupRecommendationSnapshot(metadata, action, now)
    const baseMetadata = {
        ...metadata,
        crm_followup_actions: nextActions,
        ...(nextRecommendationSnapshot ? { crm_action_recommendations: nextRecommendationSnapshot } : {}),
    }

    const eventRow = await appendFollowupActionEvent({ supabase, lead, action })
    const eventRows = await fetchFollowupActivityRows({ supabase, lead, fallback: eventRow })
    const mergedMetadata = mergeLeadSiteActivity(baseMetadata, eventRows)
    const nextMetadata = {
        ...mergedMetadata,
        crm_followup_actions: nextActions,
        ...(nextRecommendationSnapshot ? { crm_action_recommendations: nextRecommendationSnapshot } : {}),
        behavior_summary: applyFollowupActionsToSummary(mergedMetadata.behavior_summary, nextActions),
    }

    const { error } = await supabase
        .from('leads')
        .update({
            metadata: nextMetadata,
            ...leadIntentColumnsFromMetadata(
                nextMetadata,
                lead.lead_score,
                lead.lead_classification
            ),
            updated_at: now,
        })
        .eq('id', lead.id)

    if (error) throw error

    return NextResponse.json({
        success: true,
        source: 'lead_metadata',
        lead_id: lead.id,
        followup_action: action,
        crm_action_recommendations: nextRecommendationSnapshot || null,
    })
}

export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        const search = searchParams.get('search')
        const brokerId = String(searchParams.get('broker_id') || '').trim()
        const limit = parseInt(searchParams.get('limit') || '80', 10)
        const searchTerm = String(search || '').trim()
        let emailMatchedPhones: string[] = []

        if (searchTerm) {
            const { data: emailMatches, error: emailSearchError } = await supabase
                .from('leads')
                .select('phone, phone_e164')
                .ilike('email', `%${searchTerm}%`)
                .limit(100)

            if (emailSearchError) {
                console.warn('[Lead CRM] email search failed:', emailSearchError.message)
            } else {
                emailMatchedPhones = Array.from(new Set(
                    (emailMatches || []).flatMap((lead: any) => phoneCandidates(lead.phone_e164 || lead.phone))
                ))
            }
        }

        const { rows, source } = await loadCrmRows({
            supabase,
            brokerId,
            status,
            searchTerm,
            emailMatchedPhones,
            limit,
        })

        const [{ byId, byPhone }, brokerMap, conversationMap] = await Promise.all([
            fetchLeadsForRows(supabase, rows),
            fetchBrokerMap(supabase, rows),
            fetchConversationsForRows(supabase, rows),
        ])

        const enriched = rows.map((row: any) => {
            const lead = row.lead_id
                ? byId.get(row.lead_id)
                : phoneCandidates(row.lead_phone)
                    .map(candidate => byPhone.get(candidate))
                    .find(Boolean)
            const broker = row.broker_id ? brokerMap.get(row.broker_id) : null
            const conversation = row.conversation_id
                ? conversationMap.byId.get(row.conversation_id)
                : conversationMap.byBrokerPhone.get(conversationKey(row.broker_id, row.lead_phone))
            return enrichCrmRow(row, source, lead, broker, conversation)
        })

        return NextResponse.json({ success: true, leads: enriched, source })
    } catch (error) {
        console.error('[Lead CRM] GET error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

export async function PUT(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const body = await request.json()
        const { id, ...updates } = body

        if (!id) {
            return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 })
        }

        if (updates.followup_action) {
            const actor = await getOptionalAdminActorContext()
            return updateLeadFollowupAction(supabase, body, actor)
        }

        updates.updated_at = new Date().toISOString()

        if (String(id).startsWith('conversation:')) {
            const conversationId = String(id).replace(/^conversation:/, '')
            const conversationUpdates: Record<string, any> = {
                updated_at: updates.updated_at,
            }

            if (Object.prototype.hasOwnProperty.call(updates, 'status')) {
                conversationUpdates.status = normalizeConversationStatusFromCrm(updates.status)
            }

            if (Object.prototype.hasOwnProperty.call(updates, 'notes')) {
                conversationUpdates.summary = updates.notes
            }

            const { error } = await supabase
                .from('whatsapp_ai_conversations')
                .update(conversationUpdates)
                .eq('id', conversationId)

            if (error) throw error

            return NextResponse.json({ success: true, source: 'conversation' })
        }

        const profileResult = await supabase
            .from('broker_lead_profiles')
            .update(updates)
            .eq('id', id)
            .select('id')
            .maybeSingle()

        if (!profileResult.error && profileResult.data?.id) {
            return NextResponse.json({ success: true, source: 'profile' })
        }

        if (profileResult.error && !isMissingBrokerProfilesTable(profileResult.error)) {
            throw profileResult.error
        }

        const { error } = await supabase
            .from('lead_collected_data')
            .update(updates)
            .eq('id', id)

        if (error) throw error

        return NextResponse.json({ success: true, source: 'legacy' })
    } catch (error) {
        console.error('[Lead CRM] PUT error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
