import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { extractTrackingData, generateVisitorId } from '@/lib/tracking'
import { leadIntentColumnsFromMetadata, mergeLeadSiteActivity, type LeadActivityEventRow } from '@/lib/tracking/lead-activity'
import { sendMetaCapiEvent } from '@/lib/tracking/meta-capi'
import { phoneCandidates } from '@/lib/whatsapp/lead-sync'
import { extractPropertyIdFromSeoSlug } from '@/lib/properties/seo-url'
import { propertyDetailsPath } from '@/lib/properties/responsive-destination'

const VISITOR_COOKIE_NAME = 'pilger_visitor_id'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function normalizeLeadPhone(raw: string | null): string {
    const digits = String(raw || '').replace(/\D/g, '')
    if (!digits) return ''
    if (digits.startsWith('55') || digits.length > 11) return digits
    return `55${digits}`
}

function normalizeLeadId(raw: string | null): string {
    const id = String(raw || '').trim()
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        ? id
        : ''
}

function buildPhoneOrFilter(candidates: string[]): string {
    const safe = candidates
        .map(candidate => candidate.replace(/[^0-9]/g, ''))
        .filter(Boolean)
    return `phone.in.(${safe.join(',')}),phone_e164.in.(${safe.join(',')})`
}

function metadataRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {}
}

async function findLeadByVisitorId(visitorId: string) {
    const { data, error } = await supabase
        .from('leads')
        .select('id, metadata')
        .eq('visitor_id', visitorId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error) {
        console.warn('[Track] lead lookup by visitor failed:', error.message)
        return null
    }

    return data || null
}

async function appendSiteActivityToLead(
    leadId: string | null | undefined,
    visitorId: string | null | undefined,
    eventRow: LeadActivityEventRow | null | undefined
) {
    if (!leadId || !eventRow?.event_type) return

    if (visitorId) {
        await supabase
            .from('funnel_events')
            .update({ lead_id: leadId })
            .eq('visitor_id', visitorId)
            .is('lead_id', null)
    }

    const { data: lead, error } = await supabase
        .from('leads')
        .select('metadata, lead_score, lead_classification')
        .eq('id', leadId)
        .maybeSingle()

    if (error) {
        console.warn('[Track] lead activity metadata lookup failed:', error.message)
        return
    }

    let eventRows: LeadActivityEventRow[] = [eventRow]
    if (visitorId) {
        const { data: recentRows, error: eventError } = await supabase
            .from('funnel_events')
            .select('id, event_type, metadata, created_at')
            .eq('visitor_id', visitorId)
            .order('created_at', { ascending: false })
            .limit(120)

        if (eventError) {
            console.warn('[Track] lead activity history fetch failed:', eventError.message)
        } else if (recentRows?.length) {
            eventRows = (recentRows as LeadActivityEventRow[]).reverse()
        }
    }

    const nextMetadata = mergeLeadSiteActivity(lead?.metadata || {}, eventRows)
    const intentColumns = leadIntentColumnsFromMetadata(
        nextMetadata,
        lead?.lead_score,
        lead?.lead_classification
    )
    const { error: updateError } = await supabase
        .from('leads')
        .update({
            metadata: nextMetadata,
            ...intentColumns,
            updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)

    if (updateError) {
        console.warn('[Track] lead activity metadata update failed:', updateError.message)
    }
}

async function findBrokerCandidateByVisitorId(visitorId: string) {
    const { data, error } = await supabase
        .from('broker_candidates')
        .select('id, metadata')
        .eq('visitor_id', visitorId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error) {
        if (!String(error.message || '').includes('broker_candidates')) {
            console.warn('[Track] broker candidate lookup by visitor failed:', error.message)
        }
        return null
    }

    return data || null
}

async function appendSiteActivityToBrokerCandidate(
    visitorId: string | null | undefined,
    eventRow: LeadActivityEventRow | null | undefined
) {
    if (!visitorId || !eventRow?.event_type) return

    const candidate = await findBrokerCandidateByVisitorId(visitorId)
    if (!candidate?.id) return

    const { data: recentRows, error: eventError } = await supabase
        .from('funnel_events')
        .select('id, event_type, metadata, created_at')
        .eq('visitor_id', visitorId)
        .order('created_at', { ascending: false })
        .limit(120)

    if (eventError) {
        console.warn('[Track] broker candidate activity history fetch failed:', eventError.message)
    }

    const eventRows = (recentRows?.length ? recentRows : [eventRow]) as LeadActivityEventRow[]
    const metadata = metadataRecord(candidate.metadata)
    const previousActivity = metadataRecord((metadata as any).activity)
    const lastEvent = eventRows[0] || eventRow
    const brokerEvents = eventRows.filter(row => String(row?.event_type || '').includes('broker_candidate'))

    const nextMetadata = {
        ...metadata,
        activity: {
            ...previousActivity,
            events: eventRows.length,
            broker_candidate_events: brokerEvents.length,
            last_event_type: lastEvent?.event_type || eventRow.event_type,
            last_event_at: lastEvent?.created_at || new Date().toISOString(),
            recent_events: eventRows.slice(0, 20).map(row => ({
                event_type: row.event_type,
                created_at: row.created_at,
                metadata: metadataRecord(row.metadata),
            })),
        },
    }

    const { error: updateError } = await supabase
        .from('broker_candidates')
        .update({
            metadata: nextMetadata,
            last_activity_at: lastEvent?.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', candidate.id)

    if (updateError && !String(updateError.message || '').includes('broker_candidates')) {
        console.warn('[Track] broker candidate activity update failed:', updateError.message)
    }
}

async function insertFunnelEvent(params: {
    visitorId: string
    leadId?: string | null
    landingPageId?: string | null
    eventType: string
    metadata: Record<string, unknown>
}) {
    const { data, error } = await supabase
        .from('funnel_events')
        .insert({
            visitor_id: params.visitorId,
            lead_id: params.leadId || null,
            landing_page_id: params.landingPageId || null,
            event_type: params.eventType,
            metadata: params.metadata,
        })
        .select('id, event_type, metadata, created_at')
        .single()

    if (error) {
        console.warn('[Track] funnel event insert failed:', error.message)
        return null
    }

    return data as LeadActivityEventRow
}

async function sendMetaCapiForFunnelEvent(params: {
    request: NextRequest
    eventType: string
    metadata: Record<string, unknown>
    trackingData: ReturnType<typeof extractTrackingData>
    visitorCookieId: string
    visitorId: string
    leadId?: string | null
    searchParams: URLSearchParams
    createdAt?: string | null
}) {
    await sendMetaCapiEvent({
        siteEventType: params.eventType,
        metadata: {
            ...params.metadata,
            ...(params.createdAt ? { created_at: params.createdAt } : {}),
        },
        trackingData: params.trackingData,
        visitorCookieId: params.visitorCookieId,
        visitorId: params.visitorId,
        leadId: params.leadId,
        searchParams: params.searchParams,
        requestCookies: {
            fbp: params.request.cookies.get('_fbp')?.value || null,
            fbc: params.request.cookies.get('_fbc')?.value || null,
        },
    })
}

function safeHttpUrl(raw: string | null): string | null {
    try {
        const url = new URL(String(raw || '').trim())
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
        return url.toString()
    } catch {
        return null
    }
}

function expandCompactTrackingParams(input: URLSearchParams, requestUrl?: string) {
    const params = new URLSearchParams(input.toString())
    const aliases: Array<[string, string]> = [
        ['e', 'event_type'],
        ['s', 'utm_source'],
        ['m', 'utm_medium'],
        ['c', 'utm_campaign'],
        ['i', 'utm_content'],
        ['l', 'lead_id'],
        ['lp', 'lead_phone'],
        ['t', 'link_type'],
        ['lb', 'link_label'],
        ['lt', 'link_title'],
        ['ls', 'landing_page_slug'],
        ['ct', 'content_type'],
        ['pid', 'content_id'],
    ]

    for (const [shortKey, longKey] of aliases) {
        const shortValue = params.get(shortKey)
        if (shortValue && !params.get(longKey)) {
            params.set(longKey, shortValue)
        }
    }

    const compactPath = params.get('p') || params.get('path')
    if (!params.get('redirect') && compactPath && requestUrl) {
        try {
            if (compactPath.startsWith('/') && !compactPath.startsWith('//')) {
                params.set('redirect', new URL(compactPath, new URL(requestUrl).origin).toString())
            }
        } catch { }
    }

    return params
}

function normalizeTrackedContentType(raw: string | null) {
    const value = String(raw || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()

    if (['news', 'noticia', 'noticias'].includes(value)) return 'news'
    if (['blog', 'article', 'artigo'].includes(value)) return 'blog'
    if (['property', 'imovel', 'imoveis'].includes(value)) return 'property'
    return ''
}

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function safeDecode(value: string) {
    try {
        return decodeURIComponent(value)
    } catch {
        return value
    }
}

function propertyRouteInfoFromUrl(raw: string | null) {
    const value = String(raw || '').trim()
    if (!value) {
        return { property_path: null as string | null, property_slug: null as string | null }
    }

    try {
        const url = new URL(value, 'https://guilhermepilger.ai')
        const match = url.pathname.match(/^\/imovel\/([^/]+)(?:\/detalhes)?\/?$/i)
        const segment = match?.[1] ? safeDecode(match[1]) : ''
        return {
            property_path: match ? url.pathname : null,
            property_slug: segment && !isUuid(segment) ? segment : null,
        }
    } catch {
        return { property_path: null as string | null, property_slug: null as string | null }
    }
}

function propertySlugFromContentId(contentType: string, contentId: string) {
    if (contentType !== 'property') return null
    const decoded = safeDecode(contentId).trim()
    if (!decoded || isUuid(decoded)) return null
    return decoded
}

async function resolveTrackedTargetUrl(searchParams: URLSearchParams, requestUrl: string) {
    const explicitTarget = safeHttpUrl(searchParams.get('redirect') || searchParams.get('to'))
    if (explicitTarget) return explicitTarget

    const contentType = normalizeTrackedContentType(
        searchParams.get('content_type')
        || searchParams.get('link_type')
    )
    const contentId = String(
        searchParams.get('content_id')
        || searchParams.get('post_id')
        || searchParams.get('property_id')
        || ''
    ).trim()

    if (!contentType || !contentId) return null

    const origin = new URL(requestUrl).origin

    if (contentType === 'property') {
        try {
            const decodedContentId = decodeURIComponent(contentId)
            const propertyId = extractPropertyIdFromSeoSlug(decodedContentId) || decodedContentId
            let query = supabase
                .from('properties')
                .select('id, source_slug, title, seo_title, property_type')
                .limit(1)

            query = isUuid(propertyId)
                ? query.eq('id', propertyId)
                : query.eq('source_slug', decodedContentId)

            const { data, error } = await query.maybeSingle()
            if (error) {
                console.warn('[Track] property redirect lookup failed:', error.message)
            } else if (data?.id) {
                return new URL(propertyDetailsPath(data), origin).toString()
            }
        } catch (error) {
            console.warn('[Track] property redirect resolve failed:', error)
        }

        return new URL(`/imovel/${encodeURIComponent(contentId)}/detalhes`, origin).toString()
    }

    try {
        let query = supabase
            .from('blog_posts')
            .select('slug')
            .eq('status', 'published')
            .limit(1)

        query = isUuid(contentId)
            ? query.eq('id', contentId)
            : query.eq('slug', contentId)

        const { data, error } = await query.maybeSingle()
        if (error) {
            console.warn('[Track] content redirect lookup failed:', error.message)
            return null
        }

        const slug = String(data?.slug || '').trim()
        if (!slug) return null

        const path = contentType === 'news'
            ? `/noticias/${encodeURIComponent(slug)}`
            : `/blog/${encodeURIComponent(slug)}`
        return new URL(path, origin).toString()
    } catch (error) {
        console.warn('[Track] content redirect resolve failed:', error)
        return null
    }
}

function buildClickMetadata(params: {
    landingPageId: string | null
    searchParams: URLSearchParams
}) {
    const redirectUrl = params.searchParams.get('redirect') || params.searchParams.get('to') || null
    const contentType = normalizeTrackedContentType(
        params.searchParams.get('content_type')
        || params.searchParams.get('link_type')
    )
    const contentId = String(
        params.searchParams.get('content_id')
        || params.searchParams.get('post_id')
        || params.searchParams.get('property_id')
        || ''
    ).trim()
    const propertyId = resolvePropertyIdFromClick(params.searchParams, redirectUrl, contentType, contentId)
    const routeInfo = propertyRouteInfoFromUrl(redirectUrl)
    const contentPropertySlug = propertySlugFromContentId(contentType, contentId)
    const propertySlug = routeInfo.property_slug || contentPropertySlug
    const propertyPath = routeInfo.property_path || (propertySlug ? `/imovel/${encodeURIComponent(propertySlug)}/detalhes` : null)

    return {
        clicked_at: new Date().toISOString(),
        event_type: params.searchParams.get('event_type') || 'whatsapp_link_click',
        link_type: params.searchParams.get('link_type') || null,
        link_label: params.searchParams.get('link_label') || null,
        link_title: params.searchParams.get('link_title') || null,
        content_type: contentType || null,
        content_id: contentId || null,
        property_id: propertyId || null,
        property_slug: propertySlug || null,
        property_path: propertyPath || null,
        target_url: redirectUrl,
        lead_id: normalizeLeadId(params.searchParams.get('lead_id')) || null,
        lead_phone: normalizeLeadPhone(
            params.searchParams.get('lead_phone')
            || params.searchParams.get('wa_phone')
            || params.searchParams.get('wpp_phone')
        ) || null,
        utm_source: params.searchParams.get('utm_source') || null,
        utm_medium: params.searchParams.get('utm_medium') || null,
        utm_campaign: params.searchParams.get('utm_campaign') || null,
        utm_content: params.searchParams.get('utm_content') || null,
        landing_page_id: params.landingPageId,
    }
}

function resolvePropertyIdFromClick(
    searchParams: URLSearchParams,
    redirectUrl: string | null,
    contentType: string,
    contentId: string
) {
    const explicitPropertyId = String(searchParams.get('property_id') || '').trim()
    if (isUuid(explicitPropertyId)) return explicitPropertyId

    if (contentType === 'property' && isUuid(contentId)) return contentId

    const target = redirectUrl || searchParams.get('to') || ''
    const uuid = String(target).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0]
    return uuid || null
}

function isTrackedClickFromSearchParams(searchParams: URLSearchParams) {
    return Boolean(
        searchParams.get('event_type')
        && (
            searchParams.get('utm_source')
            || searchParams.get('utm_medium')
            || searchParams.get('utm_campaign')
            || searchParams.get('lead_id')
            || searchParams.get('lead_phone')
            || searchParams.get('link_type')
        )
    )
}

function isContentClick(click: Record<string, unknown>) {
    const eventType = String(click.event_type || '').toLowerCase()
    const linkType = String(click.link_type || '').toLowerCase()
    return ['blog', 'news', 'noticia', 'artigo', 'article', 'event'].includes(linkType)
        || /(^|_)(blog|news|noticia|artigo|event)(_|$)/.test(eventType)
}

async function attachTrackedVisitorToLead(params: {
    visitorId: string
    landingPageId: string | null
    trackingData: ReturnType<typeof extractTrackingData>
    searchParams: URLSearchParams
    skipFunnelEvent?: boolean
}) {
    const leadId = normalizeLeadId(params.searchParams.get('lead_id'))
    const phone = normalizeLeadPhone(
        params.searchParams.get('lead_phone')
        || params.searchParams.get('wa_phone')
        || params.searchParams.get('wpp_phone')
    )

    let lead: any = null
    let error: any = null

    if (leadId) {
        const lookup = await supabase
            .from('leads')
            .select('id, metadata, landing_page_id')
            .eq('id', leadId)
            .maybeSingle()
        lead = lookup.data
        error = lookup.error
    }

    if (!lead?.id) {
        const candidates = phoneCandidates(phone)
        if (!candidates.length) return null

        const lookup = await supabase
            .from('leads')
            .select('id, metadata, landing_page_id')
            .or(buildPhoneOrFilter(candidates))
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        lead = lookup.data
        error = lookup.error
    }

    if (error || !lead?.id) {
        if (error) console.warn('[Track] lead attach lookup failed:', error.message)
        return null
    }

    const metadata = lead.metadata && typeof lead.metadata === 'object' ? lead.metadata : {}
    const currentTracking = (metadata as any).tracking && typeof (metadata as any).tracking === 'object'
        ? (metadata as any).tracking
        : {}
    const whatsappClick = buildClickMetadata({
        landingPageId: params.landingPageId,
        searchParams: params.searchParams,
    })
    const previousClicks = Array.isArray((metadata as any).whatsapp_clicks)
        ? (metadata as any).whatsapp_clicks
        : []
    const nextClicks = [...previousClicks, whatsappClick].slice(-100)
    const previousLinkClicks = Array.isArray((metadata as any).link_clicks)
        ? (metadata as any).link_clicks
        : []
    const nextLinkClicks = [...previousLinkClicks, whatsappClick].slice(-150)
    const previousContentClicks = Array.isArray((metadata as any).content_clicks)
        ? (metadata as any).content_clicks
        : []
    const nextContentClicks = isContentClick(whatsappClick)
        ? [...previousContentClicks, whatsappClick].slice(-120)
        : previousContentClicks
    const isPropertyClick =
        params.searchParams.get('utm_campaign') === 'property_recommendation'
        || whatsappClick.event_type === 'whatsapp_property_click'
        || whatsappClick.link_type === 'property'
        || whatsappClick.content_type === 'property'
        || Boolean(whatsappClick.property_id)
        || Boolean(whatsappClick.property_slug)
        || Boolean(whatsappClick.property_path)
    const contentClick = isContentClick(whatsappClick)

    const { error: updateError } = await supabase
        .from('leads')
        .update({
            visitor_id: params.visitorId,
            landing_page_id: lead.landing_page_id || params.landingPageId,
            country: params.trackingData.country || null,
            city: params.trackingData.city || null,
            state: params.trackingData.region || null,
            metadata: {
                ...metadata,
                tracking: {
                    ...currentTracking,
                    detected_source: params.trackingData.detected_source || currentTracking.detected_source || 'WhatsApp',
                    utm_source: params.trackingData.utm_source || currentTracking.utm_source || null,
                    utm_medium: params.trackingData.utm_medium || currentTracking.utm_medium || null,
                    utm_campaign: params.trackingData.utm_campaign || currentTracking.utm_campaign || null,
                    utm_term: params.trackingData.utm_term || currentTracking.utm_term || null,
                    utm_content: params.trackingData.utm_content || currentTracking.utm_content || null,
                    referrer: params.trackingData.referrer || currentTracking.referrer || null,
                    device_type: params.trackingData.device_type || currentTracking.device_type || null,
                    browser: params.trackingData.browser || currentTracking.browser || null,
                    os: params.trackingData.os || currentTracking.os || null,
                    country: params.trackingData.country || currentTracking.country || null,
                    city: params.trackingData.city || currentTracking.city || null,
                    region: params.trackingData.region || currentTracking.region || null,
                    property_slug: whatsappClick.property_slug || currentTracking.property_slug || null,
                    property_path: whatsappClick.property_path || currentTracking.property_path || null,
                },
                last_link_click: whatsappClick,
                link_clicks: nextLinkClicks,
                last_whatsapp_click: whatsappClick,
                whatsapp_clicks: nextClicks,
                ...(contentClick ? {
                    last_content_click: whatsappClick,
                    content_clicks: nextContentClicks,
                } : {}),
                ...(isPropertyClick ? { whatsapp_property_click: whatsappClick } : {}),
            },
            updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id)

    if (updateError) {
        console.warn('[Track] lead attach update failed:', updateError.message)
        return lead.id
    }

    if (!params.skipFunnelEvent && isPropertyClick) {
        await supabase.from('funnel_events').insert({
            visitor_id: params.visitorId,
            lead_id: lead.id,
            landing_page_id: params.landingPageId,
            event_type: whatsappClick.event_type || 'whatsapp_property_click',
            metadata: whatsappClick,
        })
    }

    return lead.id
}

async function appendEventLinkClick(searchParams: URLSearchParams, clickMetadata: Record<string, unknown>) {
    const registrationId = searchParams.get('event_registration_id')
    const eventId = searchParams.get('event_id')
    const queueId = searchParams.get('event_queue_id')
    const ruleId = searchParams.get('event_rule_id')
    const phone = normalizeLeadPhone(searchParams.get('lead_phone'))

    if (!registrationId && !eventId && !phone) return

    let registration: any = null
    if (registrationId) {
        const { data } = await supabase
            .from('event_registrations')
            .select('*')
            .eq('id', registrationId)
            .maybeSingle()
        registration = data
    }

    if (!registration && eventId && phone) {
        const variants = phoneCandidates(phone)
        const { data } = await supabase
            .from('event_registrations')
            .select('*')
            .eq('event_id', eventId)
            .in('phone', variants)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        registration = data
    }

    if (!registration?.id) return

    const metadata = metadataRecord(registration.metadata)
    const interaction = {
        type: 'link_click',
        event_id: eventId || registration.event_id,
        registration_id: registration.id,
        rule_id: ruleId || null,
        queue_id: queueId || null,
        tracking_tag: searchParams.get('event_tracking_tag') || searchParams.get('utm_campaign') || 'event_agent_link',
        button_label: searchParams.get('link_label') || null,
        button_action: searchParams.get('link_type') || null,
        button_url: clickMetadata.target_url || null,
        target_url: clickMetadata.target_url || null,
        clicked_at: new Date().toISOString(),
    }
    const previous = Array.isArray((metadata as any).event_interactions) ? (metadata as any).event_interactions : []

    await supabase
        .from('event_registrations')
        .update({
            metadata: {
                ...metadata,
                last_event_interaction: interaction,
                event_interactions: [...previous, interaction].slice(-80),
            },
            updated_at: new Date().toISOString(),
        })
        .eq('id', registration.id)

    if (queueId) {
        const { data: queue } = await supabase
            .from('event_message_queue')
            .select('metadata')
            .eq('id', queueId)
            .maybeSingle()
        const queueMetadata = metadataRecord(queue?.metadata)
        const responses = Array.isArray((queueMetadata as any).responses) ? (queueMetadata as any).responses : []
        await supabase
            .from('event_message_queue')
            .update({
                metadata: {
                    ...queueMetadata,
                    last_response: interaction,
                    responses: [...responses, interaction].slice(-40),
                },
            })
            .eq('id', queueId)
    }

    await supabase.from('event_agent_logs').insert({
        event_id: interaction.event_id,
        registration_id: registration.id,
        rule_id: ruleId || null,
        message_queue_id: queueId || null,
        action: 'event_link_click_tracked',
        message: interaction.button_label
            ? `Clique registrado: ${interaction.button_label}.`
            : 'Clique de link do evento registrado.',
        metadata: interaction,
    })
}

async function appendBrokerCandidateLinkClick(searchParams: URLSearchParams, clickMetadata: Record<string, unknown>) {
    const candidateId = searchParams.get('broker_candidate_id')
    const queueId = searchParams.get('broker_candidate_queue_id')
    const ruleId = searchParams.get('broker_candidate_rule_id')
    const phone = normalizeLeadPhone(searchParams.get('lead_phone'))

    if (!candidateId && !queueId && !phone) return

    let candidate: any = null
    if (candidateId) {
        const { data } = await supabase
            .from('broker_candidates')
            .select('*')
            .eq('id', candidateId)
            .maybeSingle()
        candidate = data
    }

    if (!candidate && phone) {
        const candidates = phoneCandidates(phone)
        const { data } = await supabase
            .from('broker_candidates')
            .select('*')
            .in('phone_normalized', candidates)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        candidate = data
    }

    if (!candidate?.id) return

    const metadata = metadataRecord(candidate.metadata)
    const interaction = {
        type: 'link_click',
        candidate_id: candidate.id,
        rule_id: ruleId || null,
        queue_id: queueId || null,
        tracking_tag: searchParams.get('broker_candidate_tracking_tag') || searchParams.get('utm_campaign') || 'broker_candidate_link',
        button_label: searchParams.get('link_label') || null,
        button_action: searchParams.get('link_type') || null,
        button_url: clickMetadata.target_url || null,
        target_url: clickMetadata.target_url || null,
        clicked_at: new Date().toISOString(),
    }
    const previous = Array.isArray((metadata as any).candidate_interactions) ? (metadata as any).candidate_interactions : []

    await supabase
        .from('broker_candidates')
        .update({
            metadata: {
                ...metadata,
                last_candidate_interaction: interaction,
                candidate_interactions: [...previous, interaction].slice(-80),
            },
            last_activity_at: interaction.clicked_at,
            updated_at: new Date().toISOString(),
        })
        .eq('id', candidate.id)

    if (queueId) {
        const { data: queue } = await supabase
            .from('broker_candidate_message_queue')
            .select('metadata')
            .eq('id', queueId)
            .maybeSingle()
        const queueMetadata = metadataRecord(queue?.metadata)
        const responses = Array.isArray((queueMetadata as any).responses) ? (queueMetadata as any).responses : []
        await supabase
            .from('broker_candidate_message_queue')
            .update({
                metadata: {
                    ...queueMetadata,
                    last_response: interaction,
                    responses: [...responses, interaction].slice(-40),
                },
            })
            .eq('id', queueId)
    }

    await supabase.from('broker_candidate_agent_logs').insert({
        candidate_id: candidate.id,
        rule_id: ruleId || null,
        message_queue_id: queueId || null,
        action: 'candidate_link_click_tracked',
        message: interaction.button_label
            ? `Clique registrado: ${interaction.button_label}.`
            : 'Clique de link do candidato registrado.',
        metadata: interaction,
    })
}

async function findLandingPageId(landingPageSlug: string | null | undefined) {
    if (!landingPageSlug) return null
    const { data: lp } = await supabase
        .from('landing_pages')
        .select('id')
        .eq('slug', landingPageSlug)
        .maybeSingle()
    return lp?.id || null
}

async function upsertTrackedVisitor(params: {
    cookieId: string
    landingPageId: string | null
    trackingData: ReturnType<typeof extractTrackingData>
}) {
    const { data: existing } = await supabase
        .from('visitors')
        .select('id, page_views, country, city, region')
        .eq('visitor_cookie_id', params.cookieId)
        .maybeSingle()

    if (existing?.id) {
        await supabase
            .from('visitors')
            .update({
                last_visit_at: new Date().toISOString(),
                page_views: (existing.page_views || 1) + 1,
                country: params.trackingData.country || existing.country,
                city: params.trackingData.city || existing.city,
                region: params.trackingData.region || existing.region,
                utm_source: params.trackingData.utm_source || undefined,
                utm_medium: params.trackingData.utm_medium || undefined,
                utm_campaign: params.trackingData.utm_campaign || undefined,
                utm_term: params.trackingData.utm_term || undefined,
                utm_content: params.trackingData.utm_content || undefined,
                referrer: params.trackingData.referrer || undefined,
                detected_source: params.trackingData.detected_source || undefined,
                user_agent: params.trackingData.user_agent || undefined,
                device_type: params.trackingData.device_type || undefined,
                browser: params.trackingData.browser || undefined,
                os: params.trackingData.os || undefined,
            })
            .eq('id', existing.id)
        return existing.id as string
    }

    const { data: visitor, error } = await supabase
        .from('visitors')
        .upsert({
            ...params.trackingData,
            landing_page_id: params.landingPageId,
        }, { onConflict: 'visitor_cookie_id' })
        .select('id')
        .single()

    if (error) throw error
    return visitor.id as string
}

export async function GET(request: NextRequest) {
    const url = new URL(request.url)
    const searchParams = expandCompactTrackingParams(url.searchParams, request.url)
    const targetUrl = await resolveTrackedTargetUrl(searchParams, request.url)
    const fallbackUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || new URL('/', request.url).toString()

    if (!targetUrl) {
        return NextResponse.redirect(fallbackUrl)
    }
    searchParams.set('redirect', targetUrl)

    try {
        const cookieId = request.cookies.get(VISITOR_COOKIE_NAME)?.value || generateVisitorId()
        const trackingData = extractTrackingData(request.headers, searchParams, request.headers.get('referer') || undefined)
        trackingData.visitor_cookie_id = cookieId

        const landingPageId = await findLandingPageId(searchParams.get('landing_page_slug'))
        const visitorId = await upsertTrackedVisitor({ cookieId, landingPageId, trackingData })
        const clickMetadata = buildClickMetadata({ landingPageId, searchParams })
        await appendEventLinkClick(searchParams, clickMetadata)
        await appendBrokerCandidateLinkClick(searchParams, clickMetadata)

        const linkedLeadId = await attachTrackedVisitorToLead({
            visitorId,
            landingPageId,
            trackingData,
            searchParams,
            skipFunnelEvent: true,
        })

        const funnelEvent = await insertFunnelEvent({
            visitorId,
            leadId: linkedLeadId,
            landingPageId,
            eventType: clickMetadata.event_type || 'whatsapp_link_click',
            metadata: clickMetadata,
        })
        if (funnelEvent) {
            await sendMetaCapiForFunnelEvent({
                request,
                eventType: funnelEvent.event_type || clickMetadata.event_type || 'whatsapp_link_click',
                metadata: metadataRecord(funnelEvent.metadata),
                trackingData,
                visitorCookieId: cookieId,
                visitorId,
                leadId: linkedLeadId,
                searchParams,
                createdAt: funnelEvent.created_at,
            })
        }
        await appendSiteActivityToLead(linkedLeadId, visitorId, funnelEvent)
        await appendSiteActivityToBrokerCandidate(visitorId, funnelEvent)

        const response = NextResponse.redirect(targetUrl)
        response.cookies.set(VISITOR_COOKIE_NAME, cookieId, {
            path: '/',
            maxAge: 60 * 60 * 24 * 365,
            sameSite: 'lax',
        })
        return response
    } catch (error) {
        console.error('[Track] GET click redirect failed:', error)
        return NextResponse.redirect(targetUrl)
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { visitor_cookie_id, landing_page_slug, referrer, search_params, event_type, metadata } = body

        const searchParams = expandCompactTrackingParams(new URLSearchParams(search_params || ''), request.url)
        const trackingData = extractTrackingData(request.headers, searchParams, referrer)

        const cookieId = visitor_cookie_id || generateVisitorId()
        trackingData.visitor_cookie_id = cookieId

        // Look up landing page ID by slug
        let landingPageId = null
        const resolvedLandingPageSlug = landing_page_slug || searchParams.get('landing_page_slug')
        if (resolvedLandingPageSlug) {
            const { data: lp } = await supabase
                .from('landing_pages')
                .select('id')
                .eq('slug', resolvedLandingPageSlug)
                .maybeSingle()
            landingPageId = lp?.id
        }

        // Check if visitor already exists
        const { data: existing } = await supabase
            .from('visitors')
            .select('id, page_views, country, city, region')
            .eq('visitor_cookie_id', cookieId)
            .maybeSingle()

        // Handle race condition where visitor might be created between check and insert
        if (!existing) {
            const { data: doubleCheck } = await supabase
                .from('visitors')
                .select('id, page_views, country, city, region')
                .eq('visitor_cookie_id', cookieId)
                .maybeSingle()

            if (doubleCheck) {
                // It exists now, proceed as update
                // Recursively call or just carry on? 
                // Simplest is to treat as existing
                // Refactor: Logic below can be shared? 
                // For now, let's just use upsert for creation to be safe?
                // But we have different logic for create vs update (increment page views)
                // Let's just create a `visitor` variable that is either existing or new
            }
        }

        if (existing) {
            const linkedLeadId = await attachTrackedVisitorToLead({
                visitorId: existing.id,
                landingPageId,
                trackingData,
                searchParams,
                skipFunnelEvent: true,
            })
            const visitorLead = linkedLeadId ? null : await findLeadByVisitorId(existing.id)
            const resolvedLeadId = linkedLeadId || visitorLead?.id || null

            // Update existing visitor
            await supabase
                .from('visitors')
                .update({
                    last_visit_at: new Date().toISOString(),

                    page_views: (existing.page_views || 1) + 1,
                    country: trackingData.country || existing.country,
                    city: trackingData.city || existing.city,
                    region: trackingData.region || existing.region,
                    utm_source: trackingData.utm_source || undefined,
                    utm_medium: trackingData.utm_medium || undefined,
                    utm_campaign: trackingData.utm_campaign || undefined,
                    utm_term: trackingData.utm_term || undefined,
                    utm_content: trackingData.utm_content || undefined,
                    referrer: trackingData.referrer || undefined,
                    detected_source: (trackingData.utm_source || searchParams.get('lead_phone'))
                        ? trackingData.detected_source
                        : undefined,
                    user_agent: trackingData.user_agent || undefined,
                    device_type: trackingData.device_type || undefined,
                    browser: trackingData.browser || undefined,
                    os: trackingData.os || undefined,
                })
                .eq('id', existing.id)

            // Log funnel event
            const eventMetadata = event_type
                ? metadataRecord(metadata)
                : {
                    ...metadataRecord(metadata),
                    page_views: (existing.page_views || 1) + 1,
                }
            const funnelEvent = await insertFunnelEvent({
                visitorId: existing.id,
                leadId: resolvedLeadId,
                landingPageId,
                eventType: event_type || 'page_view',
                metadata: eventMetadata,
            })
            if (funnelEvent) {
                await sendMetaCapiForFunnelEvent({
                    request,
                    eventType: funnelEvent.event_type || event_type || 'page_view',
                    metadata: metadataRecord(funnelEvent.metadata),
                    trackingData,
                    visitorCookieId: cookieId,
                    visitorId: existing.id,
                    leadId: resolvedLeadId,
                    searchParams,
                    createdAt: funnelEvent.created_at,
                })
            }
            await appendSiteActivityToLead(resolvedLeadId, existing.id, funnelEvent)
            await appendSiteActivityToBrokerCandidate(existing.id, funnelEvent)

            if (!event_type && isTrackedClickFromSearchParams(searchParams)) {
                const clickMetadata = buildClickMetadata({ landingPageId, searchParams })
                const clickEvent = await insertFunnelEvent({
                    visitorId: existing.id,
                    leadId: resolvedLeadId,
                    landingPageId,
                    eventType: String(clickMetadata.event_type || searchParams.get('event_type') || 'link_click'),
                    metadata: clickMetadata,
                })
                if (clickEvent) {
                    await sendMetaCapiForFunnelEvent({
                        request,
                        eventType: clickEvent.event_type || String(clickMetadata.event_type || searchParams.get('event_type') || 'link_click'),
                        metadata: metadataRecord(clickEvent.metadata),
                        trackingData,
                        visitorCookieId: cookieId,
                        visitorId: existing.id,
                        leadId: resolvedLeadId,
                        searchParams,
                        createdAt: clickEvent.created_at,
                    })
                }
                await appendSiteActivityToLead(resolvedLeadId, existing.id, clickEvent)
                await appendSiteActivityToBrokerCandidate(existing.id, clickEvent)
            }

            // Get VAPID public key for push notifications
            const { data: vapidKey } = await supabase
                .from('app_config')
                .select('value')
                .eq('key', 'vapid_public_key')
                .maybeSingle()

            return NextResponse.json({
                visitor_id: existing.id,
                visitor_cookie_id: cookieId,
                is_returning: true,
                linked_lead_id: resolvedLeadId,
                vapid_public_key: vapidKey?.value || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
            })
        }

        // Create new visitor (upsert to handle race conditions safely)
        const { data: visitor, error } = await supabase
            .from('visitors')
            .upsert({
                ...trackingData,
                landing_page_id: landingPageId,
            }, { onConflict: 'visitor_cookie_id' })
            .select('id')
            .single()

        if (error) {
            console.error('Track error:', error)
            return NextResponse.json({ error: 'Failed to track visitor' }, { status: 500 })
        }

        const linkedLeadId = await attachTrackedVisitorToLead({
            visitorId: visitor.id,
            landingPageId,
            trackingData,
            searchParams,
            skipFunnelEvent: true,
        })
        const visitorLead = linkedLeadId ? null : await findLeadByVisitorId(visitor.id)
        const resolvedLeadId = linkedLeadId || visitorLead?.id || null

        // Log initial funnel event
        const eventMetadata = event_type
            ? metadataRecord(metadata)
            : {
                ...metadataRecord(metadata),
                first_visit: true,
            }
        const funnelEvent = await insertFunnelEvent({
            visitorId: visitor.id,
            leadId: resolvedLeadId,
            landingPageId,
            eventType: event_type || 'page_view',
            metadata: eventMetadata,
        })
        if (funnelEvent) {
            await sendMetaCapiForFunnelEvent({
                request,
                eventType: funnelEvent.event_type || event_type || 'page_view',
                metadata: metadataRecord(funnelEvent.metadata),
                trackingData,
                visitorCookieId: cookieId,
                visitorId: visitor.id,
                leadId: resolvedLeadId,
                searchParams,
                createdAt: funnelEvent.created_at,
            })
        }
        await appendSiteActivityToLead(resolvedLeadId, visitor.id, funnelEvent)
        await appendSiteActivityToBrokerCandidate(visitor.id, funnelEvent)

        if (!event_type && isTrackedClickFromSearchParams(searchParams)) {
            const clickMetadata = buildClickMetadata({ landingPageId, searchParams })
            const clickEvent = await insertFunnelEvent({
                visitorId: visitor.id,
                leadId: resolvedLeadId,
                landingPageId,
                eventType: String(clickMetadata.event_type || searchParams.get('event_type') || 'link_click'),
                metadata: clickMetadata,
            })
            if (clickEvent) {
                await sendMetaCapiForFunnelEvent({
                    request,
                    eventType: clickEvent.event_type || String(clickMetadata.event_type || searchParams.get('event_type') || 'link_click'),
                    metadata: metadataRecord(clickEvent.metadata),
                    trackingData,
                    visitorCookieId: cookieId,
                    visitorId: visitor.id,
                    leadId: resolvedLeadId,
                    searchParams,
                    createdAt: clickEvent.created_at,
                })
            }
            await appendSiteActivityToLead(resolvedLeadId, visitor.id, clickEvent)
            await appendSiteActivityToBrokerCandidate(visitor.id, clickEvent)
        }

        // Get VAPID public key for push notifications
        const { data: vapidKey } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', 'vapid_public_key')
            .maybeSingle()

        return NextResponse.json({
            visitor_id: visitor.id,
            visitor_cookie_id: cookieId,
            is_returning: false,
            linked_lead_id: resolvedLeadId,
            vapid_public_key: vapidKey?.value || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        })
    } catch (error) {
        console.error('Track error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
