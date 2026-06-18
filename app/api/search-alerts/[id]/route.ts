import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    leadIntentColumnsFromMetadata,
    mergeLeadSiteActivity,
    type LeadActivityEventRow,
} from '@/lib/tracking/lead-activity'

const VISITOR_COOKIE_NAME = 'pilger_visitor_id'
const MUTABLE_STATUSES = new Set(['active', 'paused'])

type RouteContext = {
    params: Promise<{ id: string }>
}

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function cleanText(value: unknown): string {
    return String(value || '').replace(/\s+/g, ' ').trim()
}

function metadataRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {}
}

function channelsArray(value: unknown): string[] | null {
    if (!Array.isArray(value)) return null
    const channels = Array.from(new Set(
        value.map(item => cleanText(item)).filter(Boolean)
    ))
    return channels.length ? channels : null
}

async function resolveVisitorId(supabase: ReturnType<typeof getSupabase>, request: NextRequest, body?: Record<string, unknown>) {
    const visitorCookieId = cleanText(body?.visitor_cookie_id)
        || cleanText(request.nextUrl.searchParams.get('visitor_cookie_id'))
        || request.cookies.get(VISITOR_COOKIE_NAME)?.value
        || ''

    if (!visitorCookieId) return null

    const { data, error } = await supabase
        .from('visitors')
        .select('id')
        .eq('visitor_cookie_id', visitorCookieId)
        .maybeSingle()

    if (error) throw error
    return data?.id as string | null
}

async function fetchOwnedAlert(params: {
    supabase: ReturnType<typeof getSupabase>
    alertId: string
    visitorId: string
}) {
    const { data, error } = await params.supabase
        .from('property_search_alerts')
        .select('id, visitor_id, lead_id, title, status, notification_channels')
        .eq('id', params.alertId)
        .eq('visitor_id', params.visitorId)
        .maybeSingle()

    if (error) throw error
    return data
}

async function appendAlertActivity(params: {
    supabase: ReturnType<typeof getSupabase>
    alert: any
    eventType: string
    metadata: Record<string, unknown>
}) {
    const { data: eventRow, error: eventError } = await params.supabase
        .from('funnel_events')
        .insert({
            visitor_id: params.alert.visitor_id,
            lead_id: params.alert.lead_id || null,
            event_type: params.eventType,
            metadata: params.metadata,
        })
        .select('id, event_type, metadata, created_at')
        .single()

    if (eventError) {
        console.warn('[Search Alerts] action event skipped:', eventError.message)
        return
    }

    if (!params.alert.lead_id) return

    const { data: lead } = await params.supabase
        .from('leads')
        .select('id, metadata, lead_score, lead_classification')
        .eq('id', params.alert.lead_id)
        .maybeSingle()

    if (!lead?.id) return

    const { data: eventRows } = await params.supabase
        .from('funnel_events')
        .select('id, event_type, metadata, created_at')
        .eq('visitor_id', params.alert.visitor_id)
        .order('created_at', { ascending: false })
        .limit(120)

    const nextMetadata = mergeLeadSiteActivity(
        lead.metadata || {},
        ((eventRows?.length ? eventRows : [eventRow]) as LeadActivityEventRow[]).reverse()
    )

    await params.supabase
        .from('leads')
        .update({
            metadata: nextMetadata,
            ...leadIntentColumnsFromMetadata(
                nextMetadata,
                lead.lead_score,
                lead.lead_classification
            ),
            updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id)
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params
        const body = metadataRecord(await request.json().catch(() => ({})))
        const status = cleanText(body.status)
        const notificationChannels = channelsArray(body.notification_channels)
        const supabase = getSupabase()
        const visitorId = await resolveVisitorId(supabase, request, body)

        if (!visitorId) {
            return NextResponse.json({ success: false, error: 'Visitante nao encontrado.' }, { status: 404 })
        }

        const alert = await fetchOwnedAlert({ supabase, alertId: id, visitorId })
        if (!alert?.id) {
            return NextResponse.json({ success: false, error: 'Alerta nao encontrado.' }, { status: 404 })
        }

        const update: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        }

        if (status) {
            if (!MUTABLE_STATUSES.has(status)) {
                return NextResponse.json({ success: false, error: 'Status invalido.' }, { status: 400 })
            }
            update.status = status
        }

        if (notificationChannels) update.notification_channels = notificationChannels

        if (Object.keys(update).length === 1) {
            return NextResponse.json({ success: false, error: 'Nada para atualizar.' }, { status: 400 })
        }

        const { data: updated, error } = await supabase
            .from('property_search_alerts')
            .update(update)
            .eq('id', alert.id)
            .eq('visitor_id', visitorId)
            .select('id, title, status, notification_channels, updated_at')
            .single()

        if (error) throw error

        const eventType = status === 'paused'
            ? 'property_search_alert_paused'
            : status === 'active'
                ? 'property_search_alert_resumed'
                : 'property_search_alert_updated'

        await appendAlertActivity({
            supabase,
            alert,
            eventType,
            metadata: {
                event_label: eventType === 'property_search_alert_paused'
                    ? 'Pausou alerta de busca'
                    : eventType === 'property_search_alert_resumed'
                        ? 'Reativou alerta de busca'
                        : 'Atualizou alerta de busca',
                alert_id: alert.id,
                title: alert.title,
                previous_status: alert.status,
                status: updated.status,
                notification_channels: updated.notification_channels,
                source: cleanText(body.source) || 'search_alerts_panel',
                page_path: cleanText(body.page_path) || '/busca',
            },
        })

        return NextResponse.json({ success: true, alert: updated })
    } catch (error) {
        console.error('[Search Alerts] PATCH error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params
        const supabase = getSupabase()
        const visitorId = await resolveVisitorId(supabase, request)

        if (!visitorId) {
            return NextResponse.json({ success: false, error: 'Visitante nao encontrado.' }, { status: 404 })
        }

        const alert = await fetchOwnedAlert({ supabase, alertId: id, visitorId })
        if (!alert?.id) {
            return NextResponse.json({ success: false, error: 'Alerta nao encontrado.' }, { status: 404 })
        }

        const { data: updated, error } = await supabase
            .from('property_search_alerts')
            .update({
                status: 'deleted',
                updated_at: new Date().toISOString(),
            })
            .eq('id', alert.id)
            .eq('visitor_id', visitorId)
            .select('id, title, status, updated_at')
            .single()

        if (error) throw error

        await appendAlertActivity({
            supabase,
            alert,
            eventType: 'property_search_alert_deleted',
            metadata: {
                event_label: 'Removeu alerta de busca',
                alert_id: alert.id,
                title: alert.title,
                previous_status: alert.status,
                status: 'deleted',
                source: 'search_alerts_panel',
                page_path: '/busca',
            },
        })

        return NextResponse.json({ success: true, alert: updated })
    } catch (error) {
        console.error('[Search Alerts] DELETE error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
