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

function metadataValue(source: any, path: string[]): string | null {
    let cursor = source
    for (const key of path) {
        if (!cursor || typeof cursor !== 'object') return null
        cursor = cursor[key]
    }
    return cursor == null ? null : String(cursor)
}

// GET — List all leads with collected data
export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        const search = searchParams.get('search')
        const limit = parseInt(searchParams.get('limit') || '50')
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

        let query = supabase
            .from('lead_collected_data')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(limit)

        if (status && status !== 'all') {
            query = query.eq('status', status)
        }

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
            query = query.or(filters.join(','))
        }

        const { data, error } = await query

        if (error) throw error

        const rows = data || []
        const allCandidates = Array.from(new Set(rows.flatMap((row: any) => phoneCandidates(row.lead_phone))))
        const leadsByPhone = new Map<string, any>()

        if (allCandidates.length > 0) {
            const { data: leadRows, error: leadError } = await supabase
                .from('leads')
                .select(`
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
                `)
                .or(buildPhoneOrFilter(allCandidates))

            if (leadError) {
                console.warn('[Lead CRM] enrich leads failed:', leadError.message)
            } else {
                for (const lead of leadRows || []) {
                    for (const candidate of phoneCandidates(lead.phone_e164 || lead.phone)) {
                        leadsByPhone.set(candidate, lead)
                    }
                }
            }
        }

        const enriched = rows.map((row: any) => {
            const lead = phoneCandidates(row.lead_phone)
                .map(candidate => leadsByPhone.get(candidate))
                .find(Boolean)
            const metadata = lead?.metadata || {}
            const tracking = typeof metadata?.tracking === 'object' && metadata.tracking ? metadata.tracking : {}
            const visitor = lead?.visitor || {}
            const landingPage = lead?.landing_page || {}
            const selfReportedSource = metadataValue(tracking, ['self_reported_source'])
            const behaviorSummary = metadata?.behavior_summary || null
            const behaviorScore = Number(behaviorSummary?.engagement_score || 0)
            return {
                ...row,
                lead_id: lead?.id || null,
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
                lead_classification: lead?.lead_classification || behaviorSummary?.lead_classification || null,
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
            }
        })

        return NextResponse.json({ success: true, leads: enriched })
    } catch (error) {
        console.error('[Lead CRM] GET error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

// PUT — Update lead status or notes
export async function PUT(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const body = await request.json()
        const { id, ...updates } = body

        if (!id) {
            return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 })
        }

        updates.updated_at = new Date().toISOString()

        const { error } = await supabase
            .from('lead_collected_data')
            .update(updates)
            .eq('id', id)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Lead CRM] PUT error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
