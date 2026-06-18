import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { extractTrackingData, generateVisitorId } from '@/lib/tracking'
import { leadIntentColumnsFromMetadata, mergeLeadSiteActivity, type LeadActivityEventRow } from '@/lib/tracking/lead-activity'

const VISITOR_COOKIE_NAME = 'pilger_visitor_id'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function metadataRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {}
}

function cleanText(value: unknown): string | null {
    const text = String(value || '').replace(/\s+/g, ' ').trim()
    return text || null
}

function numberValue(value: unknown): number | null {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

function toStringArray(value: unknown, limit = 24): string[] {
    if (!Array.isArray(value)) return []
    return Array.from(new Set(value.map(item => cleanText(item)).filter(Boolean) as string[])).slice(0, limit)
}

function searchParamsToRecord(raw: unknown): Record<string, string | string[]> {
    const params = new URLSearchParams(String(raw || ''))
    const record: Record<string, string | string[]> = {}

    for (const [key, value] of params.entries()) {
        const current = record[key]
        if (Array.isArray(current)) record[key] = [...current, value]
        else if (current) record[key] = [current, value]
        else record[key] = value
    }

    return record
}

function stableValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stableValue)
    if (!value || typeof value !== 'object') return value

    return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
            acc[key] = stableValue((value as Record<string, unknown>)[key])
            return acc
        }, {})
}

function hashSearchIntent(value: unknown): string {
    return createHash('sha256')
        .update(JSON.stringify(stableValue(value)))
        .digest('hex')
}

function filtersArray(value: unknown): Array<Record<string, unknown>> {
    return Array.isArray(value)
        ? value.map(item => metadataRecord(item)).filter(item => Object.keys(item).length > 0)
        : []
}

function drawAreaArray(value: unknown): Array<[number, number]> | null {
    if (!Array.isArray(value)) return null
    const area = value
        .map(point => Array.isArray(point) && point.length >= 2
            ? [numberValue(point[0]), numberValue(point[1])]
            : null
        )
        .filter((point): point is [number, number] => Boolean(point && point[0] !== null && point[1] !== null))

    return area.length >= 3 ? area : null
}

function buildAlertTitle(params: {
    filters: Array<Record<string, unknown>>
    selectedRegion: string | null
    hasDrawArea: boolean
}) {
    const labels = params.filters
        .map(filter => cleanText(filter.label))
        .filter(Boolean)
        .slice(0, 3)

    if (labels.length) return labels.join(' + ')
    if (params.selectedRegion) return `Alerta em ${params.selectedRegion}`
    if (params.hasDrawArea) return 'Alerta na area desenhada'
    return 'Alerta de busca'
}

async function resolveVisitor(request: NextRequest, body: Record<string, unknown>) {
    const supabase = getSupabase()
    const searchParams = new URLSearchParams(String(body.search_params || ''))
    const visitorCookieId = cleanText(body.visitor_cookie_id)
        || request.cookies.get(VISITOR_COOKIE_NAME)?.value
        || generateVisitorId()
    const trackingData = extractTrackingData(
        request.headers,
        searchParams,
        cleanText(body.referrer) || request.headers.get('referer') || undefined
    )
    trackingData.visitor_cookie_id = visitorCookieId

    const { data: visitor, error } = await supabase
        .from('visitors')
        .upsert({
            ...trackingData,
            last_visit_at: new Date().toISOString(),
        }, { onConflict: 'visitor_cookie_id' })
        .select('id, visitor_cookie_id')
        .single()

    if (error) throw error

    return { supabase, visitor, visitorCookieId, searchParams, trackingData }
}

async function findLeadForVisitor(
    supabase: ReturnType<typeof getSupabase>,
    visitorId: string,
    requestedLeadId?: string | null
) {
    if (requestedLeadId) {
        const { data } = await supabase
            .from('leads')
            .select('id, metadata, lead_score, lead_classification')
            .eq('id', requestedLeadId)
            .maybeSingle()
        if (data?.id) return data
    }

    const { data } = await supabase
        .from('leads')
        .select('id, metadata, lead_score, lead_classification')
        .eq('visitor_id', visitorId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    return data || null
}

async function appendSearchAlertActivity(params: {
    supabase: ReturnType<typeof getSupabase>
    visitorId: string
    lead: any
    eventRow: LeadActivityEventRow | null
}) {
    if (!params.lead?.id || !params.eventRow?.event_type) return

    await params.supabase
        .from('funnel_events')
        .update({ lead_id: params.lead.id })
        .eq('visitor_id', params.visitorId)
        .is('lead_id', null)

    const { data: eventRows } = await params.supabase
        .from('funnel_events')
        .select('id, event_type, metadata, created_at')
        .eq('visitor_id', params.visitorId)
        .order('created_at', { ascending: false })
        .limit(120)

    const nextMetadata = mergeLeadSiteActivity(
        params.lead.metadata || {},
        ((eventRows?.length ? eventRows : [params.eventRow]) as LeadActivityEventRow[]).reverse()
    )

    await params.supabase
        .from('leads')
        .update({
            metadata: nextMetadata,
            ...leadIntentColumnsFromMetadata(
                nextMetadata,
                params.lead.lead_score,
                params.lead.lead_classification
            ),
            updated_at: new Date().toISOString(),
        })
        .eq('id', params.lead.id)
}

export async function POST(request: NextRequest) {
    try {
        const body = metadataRecord(await request.json())
        const { supabase, visitor, visitorCookieId } = await resolveVisitor(request, body)
        const visitorId = visitor.id as string
        const filters = filtersArray(body.filters)
        const searchParamsRecord = searchParamsToRecord(body.search_params)
        const drawArea = drawAreaArray(body.draw_area)
        const mapBounds = metadataRecord(body.bounds)
        const selectedRegion = cleanText(body.selected_region)
        const resultCount = Math.max(0, Math.round(numberValue(body.visible_count) || numberValue(body.result_count) || 0))
        const totalCount = Math.max(0, Math.round(numberValue(body.total_count) || 0))
        const samplePropertyIds = toStringArray(body.sample_property_ids)
        const favoritePropertyIds = toStringArray(body.favorite_property_ids)
        const recentPropertyIds = toStringArray(body.recent_property_ids)
        const favoriteCount = Math.max(0, Math.round(numberValue(body.favorite_count) || favoritePropertyIds.length || 0))
        const historyCount = Math.max(0, Math.round(numberValue(body.history_count) || recentPropertyIds.length || 0))
        const requestedLeadId = cleanText(body.lead_id)
        const lead = await findLeadForVisitor(supabase, visitorId, requestedLeadId)
        const title = cleanText(body.title) || buildAlertTitle({
            filters,
            selectedRegion,
            hasDrawArea: Boolean(drawArea),
        })
        const searchIntent = {
            search_params: searchParamsRecord,
            filters,
            selected_region: selectedRegion,
            draw_area: drawArea,
            bounds: Object.keys(mapBounds).length ? mapBounds : null,
        }
        const alertHash = hashSearchIntent(searchIntent)
        const metadata = {
            source: cleanText(body.source) || 'search_results',
            page_path: cleanText(body.page_path) || '/busca',
            page_url: cleanText(body.page_url),
            visitor_cookie_id: visitorCookieId,
            total_count: totalCount,
            result_count: resultCount,
            search_memory: {
                favorite_count: favoriteCount,
                history_count: historyCount,
                favorite_property_ids: favoritePropertyIds.slice(0, 20),
                recent_property_ids: recentPropertyIds.slice(0, 20),
            },
            search_intent: searchIntent,
        }

        const { data: alert, error: alertError } = await supabase
            .from('property_search_alerts')
            .upsert({
                visitor_id: visitorId,
                lead_id: lead?.id || null,
                alert_hash: alertHash,
                title,
                search_params: searchParamsRecord,
                filters,
                map_bounds: Object.keys(mapBounds).length ? mapBounds : null,
                draw_area: drawArea,
                selected_region: selectedRegion,
                result_count: resultCount,
                sample_property_ids: samplePropertyIds,
                notification_channels: ['push'],
                status: 'active',
                metadata,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'visitor_id,alert_hash' })
            .select('id, title, alert_hash, created_at, updated_at')
            .single()

        if (alertError) throw alertError

        const eventMetadata = {
            event_label: 'Salvou alerta de busca',
            alert_id: alert?.id || null,
            alert_hash: alertHash,
            title,
            selected_region: selectedRegion,
            active_filters: filters,
            search_params: searchParamsRecord,
            draw_area: drawArea,
            bounds: Object.keys(mapBounds).length ? mapBounds : null,
            visible_count: resultCount,
            total_count: totalCount,
            sample_property_ids: samplePropertyIds,
            favorite_count: favoriteCount,
            history_count: historyCount,
            favorite_property_ids: favoritePropertyIds.slice(0, 20),
            recent_property_ids: recentPropertyIds.slice(0, 20),
            source: cleanText(body.source) || 'search_results',
            page_path: cleanText(body.page_path) || '/busca',
            page_url: cleanText(body.page_url),
        }

        const { data: eventRow, error: eventError } = await supabase
            .from('funnel_events')
            .insert({
                visitor_id: visitorId,
                lead_id: lead?.id || null,
                event_type: 'property_search_alert_saved',
                metadata: eventMetadata,
            })
            .select('id, event_type, metadata, created_at')
            .single()

        if (eventError) {
            console.warn('[Search Alerts] funnel event skipped:', eventError.message)
        }

        await appendSearchAlertActivity({
            supabase,
            visitorId,
            lead,
            eventRow: eventRow as LeadActivityEventRow | null,
        })

        return NextResponse.json({
            success: true,
            alert,
            visitor_id: visitorId,
            visitor_cookie_id: visitorCookieId,
            lead_id: lead?.id || null,
        })
    } catch (error) {
        console.error('[Search Alerts] POST error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const visitorCookieId = request.nextUrl.searchParams.get('visitor_cookie_id')
            || request.cookies.get(VISITOR_COOKIE_NAME)?.value
            || ''
        const statusParam = cleanText(request.nextUrl.searchParams.get('status')) || 'visible'

        if (!visitorCookieId) {
            return NextResponse.json({ success: true, alerts: [], push_subscription_active: false })
        }

        const { data: visitor } = await supabase
            .from('visitors')
            .select('id')
            .eq('visitor_cookie_id', visitorCookieId)
            .maybeSingle()

        if (!visitor?.id) {
            return NextResponse.json({ success: true, alerts: [], push_subscription_active: false })
        }

        let query = supabase
            .from('property_search_alerts')
            .select('id, title, alert_hash, selected_region, result_count, filters, search_params, map_bounds, draw_area, notification_channels, status, match_count, last_matched_at, last_notified_at, last_match_property_ids, created_at, updated_at')
            .eq('visitor_id', visitor.id)
            .order('updated_at', { ascending: false })
            .limit(20)

        if (statusParam === 'all' || statusParam === 'visible') {
            query = query.in('status', ['active', 'paused'])
        } else {
            query = query.eq('status', statusParam)
        }

        const [{ data, error }, { count: pushCount }] = await Promise.all([
            query,
            supabase
                .from('push_subscriptions')
                .select('endpoint', { count: 'exact', head: true })
                .eq('visitor_id', visitor.id)
                .eq('active', true),
        ])

        if (error) throw error

        const alerts = data || []
        const alertIds = alerts.map((alert: any) => alert.id).filter(Boolean)
        let matchesByAlert = new Map<string, any[]>()

        if (alertIds.length > 0) {
            const { data: matches, error: matchesError } = await supabase
                .from('property_search_alert_matches')
                .select(`
                    id,
                    alert_id,
                    property_id,
                    match_score,
                    match_reasons,
                    notification_status,
                    metadata,
                    created_at,
                    notified_at,
                    property:properties (
                        id,
                        title,
                        city,
                        state,
                        neighborhood,
                        price,
                        featured_image,
                        images,
                        property_type,
                        bedrooms,
                        suites,
                        parking_spaces,
                        area_m2,
                        area_private_m2,
                        status
                    )
                `)
                .in('alert_id', alertIds)
                .order('created_at', { ascending: false })
                .limit(Math.min(100, Math.max(20, alertIds.length * 5)))

            if (matchesError) {
                console.warn('[Search Alerts] matches fetch skipped:', matchesError.message)
            } else {
                for (const match of matches || []) {
                    const list = matchesByAlert.get(match.alert_id) || []
                    if (list.length < 4) list.push(match)
                    matchesByAlert.set(match.alert_id, list)
                }
            }
        }

        return NextResponse.json({
            success: true,
            push_subscription_active: Number(pushCount || 0) > 0,
            alerts: alerts.map((alert: any) => ({
                ...alert,
                matches: matchesByAlert.get(alert.id) || [],
            })),
        })
    } catch (error) {
        console.error('[Search Alerts] GET error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
