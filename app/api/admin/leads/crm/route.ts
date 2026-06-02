import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { phoneCandidates } from '@/lib/whatsapp/lead-sync'

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
        behavior_summary: behaviorSummary,
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
