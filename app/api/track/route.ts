import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { extractTrackingData, generateVisitorId } from '@/lib/tracking'
import { phoneCandidates } from '@/lib/whatsapp/lead-sync'

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

function buildPhoneOrFilter(candidates: string[]): string {
    const safe = candidates
        .map(candidate => candidate.replace(/[^0-9]/g, ''))
        .filter(Boolean)
    return `phone.in.(${safe.join(',')}),phone_e164.in.(${safe.join(',')})`
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

function buildClickMetadata(params: {
    landingPageId: string | null
    searchParams: URLSearchParams
}) {
    const redirectUrl = params.searchParams.get('redirect') || params.searchParams.get('to') || null
    return {
        clicked_at: new Date().toISOString(),
        event_type: params.searchParams.get('event_type') || 'whatsapp_link_click',
        link_type: params.searchParams.get('link_type') || null,
        link_label: params.searchParams.get('link_label') || null,
        link_title: params.searchParams.get('link_title') || null,
        target_url: redirectUrl,
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

async function attachTrackedVisitorToLead(params: {
    visitorId: string
    landingPageId: string | null
    trackingData: ReturnType<typeof extractTrackingData>
    searchParams: URLSearchParams
    skipFunnelEvent?: boolean
}) {
    const phone = normalizeLeadPhone(
        params.searchParams.get('lead_phone')
        || params.searchParams.get('wa_phone')
        || params.searchParams.get('wpp_phone')
    )
    const candidates = phoneCandidates(phone)
    if (!candidates.length) return null

    const { data: lead, error } = await supabase
        .from('leads')
        .select('id, metadata, landing_page_id')
        .or(buildPhoneOrFilter(candidates))
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

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
    const isPropertyClick =
        params.searchParams.get('utm_campaign') === 'property_recommendation'
        || whatsappClick.event_type === 'whatsapp_property_click'
        || whatsappClick.link_type === 'property'

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
                },
                last_whatsapp_click: whatsappClick,
                whatsapp_clicks: nextClicks,
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
    const targetUrl = safeHttpUrl(url.searchParams.get('redirect') || url.searchParams.get('to'))
    const fallbackUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || new URL('/', request.url).toString()

    if (!targetUrl) {
        return NextResponse.redirect(fallbackUrl)
    }

    try {
        const cookieId = request.cookies.get(VISITOR_COOKIE_NAME)?.value || generateVisitorId()
        const trackingData = extractTrackingData(request.headers, url.searchParams, request.headers.get('referer') || undefined)
        trackingData.visitor_cookie_id = cookieId

        const landingPageId = await findLandingPageId(url.searchParams.get('landing_page_slug'))
        const visitorId = await upsertTrackedVisitor({ cookieId, landingPageId, trackingData })
        const clickMetadata = buildClickMetadata({ landingPageId, searchParams: url.searchParams })

        const linkedLeadId = await attachTrackedVisitorToLead({
            visitorId,
            landingPageId,
            trackingData,
            searchParams: url.searchParams,
            skipFunnelEvent: true,
        })

        await supabase.from('funnel_events').insert({
            visitor_id: visitorId,
            lead_id: linkedLeadId,
            landing_page_id: landingPageId,
            event_type: clickMetadata.event_type || 'whatsapp_link_click',
            metadata: clickMetadata,
        })

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

        const searchParams = new URLSearchParams(search_params || '')
        const trackingData = extractTrackingData(request.headers, searchParams, referrer)

        const cookieId = visitor_cookie_id || generateVisitorId()
        trackingData.visitor_cookie_id = cookieId

        // Look up landing page ID by slug
        let landingPageId = null
        if (landing_page_slug) {
            const { data: lp } = await supabase
                .from('landing_pages')
                .select('id')
                .eq('slug', landing_page_slug)
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
            })

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
            if (event_type) {
                await supabase.from('funnel_events').insert({
                    visitor_id: existing.id,
                    landing_page_id: landingPageId,
                    event_type: event_type,
                    metadata: metadata || {}
                })
            } else {
                // Default: Page View
                await supabase.from('funnel_events').insert({
                    visitor_id: existing.id,
                    landing_page_id: landingPageId,
                    event_type: 'page_view',
                    metadata: { page_views: (existing.page_views || 1) + 1 },
                })
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
                linked_lead_id: linkedLeadId,
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
        })

        // Log initial funnel event
        if (event_type) {
            await supabase.from('funnel_events').insert({
                visitor_id: visitor.id,
                landing_page_id: landingPageId,
                event_type: event_type,
                metadata: metadata || {}
            })
        } else {
            // Default: Page View
            await supabase.from('funnel_events').insert({
                visitor_id: visitor.id,
                landing_page_id: landingPageId,
                event_type: 'page_view',
                metadata: { first_visit: true },
            })
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
            linked_lead_id: linkedLeadId,
            vapid_public_key: vapidKey?.value || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        })
    } catch (error) {
        console.error('Track error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
