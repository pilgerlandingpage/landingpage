
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, any>
        : {}
}

function summarizeGpsLocation(leads: any[] = []) {
    const summary = {
        granted: 0,
        denied: 0,
        unavailable: 0,
        dismissed: 0,
        requested: 0,
        acceptanceRate: 0,
    }

    for (const lead of leads) {
        const metadata = asRecord(lead?.metadata)
        const preciseLocation = asRecord(metadata.precise_location || metadata.gps_location)
        const permission = asRecord(metadata.gps_permission)
        const latitude = Number(preciseLocation.latitude)
        const longitude = Number(preciseLocation.longitude)
        const hasPreciseLocation = Number.isFinite(latitude) && Number.isFinite(longitude)
        const status = String(permission.status || (hasPreciseLocation ? 'granted' : '')).toLowerCase()

        if (hasPreciseLocation || status === 'granted') summary.granted += 1
        else if (status === 'denied') summary.denied += 1
        else if (status === 'unavailable') summary.unavailable += 1
        else if (status === 'dismissed') summary.dismissed += 1
    }

    summary.requested = summary.granted + summary.denied + summary.unavailable + summary.dismissed
    summary.acceptanceRate = summary.requested > 0
        ? parseFloat(((summary.granted / summary.requested) * 100).toFixed(1))
        : 0

    return summary
}

export async function GET() {
    try {
        const [
            { count: pageViews },
            { count: cookieConsent },
            { count: formSubmitted },
            { count: chatOpened },
            { count: whatsappConversationStarted },
            { count: whatsappFollowupSent },
            { count: whatsappFollowupReplied },
            { data: messageSentData },
            { count: pushSubscribed },
            { count: leadCaptured },
            { count: qualified },
            { count: converted },
            { data: leadGpsRaw }
        ] = await Promise.all([
            supabase.from('visitors').select('*', { count: 'exact', head: true }),
            supabase.from('funnel_events').select('*', { count: 'exact', head: true }).eq('event_type', 'cookie_consent'),
            supabase.from('funnel_events').select('*', { count: 'exact', head: true }).eq('event_type', 'form_submitted'),
            supabase.from('funnel_events').select('*', { count: 'exact', head: true }).eq('event_type', 'chat_opened'),
            supabase.from('funnel_events').select('*', { count: 'exact', head: true }).eq('event_type', 'whatsapp_conversation_started'),
            supabase.from('funnel_events').select('*', { count: 'exact', head: true }).eq('event_type', 'whatsapp_followup_sent'),
            supabase.from('funnel_events').select('*', { count: 'exact', head: true }).eq('event_type', 'whatsapp_followup_replied'),
            supabase.from('chat_history').select('visitor_id'),
            supabase.from('push_subscriptions').select('*', { count: 'exact', head: true }).eq('active', true),
            supabase.from('leads').select('*', { count: 'exact', head: true }).not('phone', 'is', null),
            supabase.from('leads').select('*', { count: 'exact', head: true }).eq('funnel_stage', 'qualified'),
            supabase.from('leads').select('*', { count: 'exact', head: true }).eq('funnel_stage', 'converted'),
            supabase.from('leads').select('id, metadata'),
        ])

        const gpsLocation = summarizeGpsLocation(leadGpsRaw || [])

        return NextResponse.json({
            pageViews: pageViews || 0,
            cookieConsent: cookieConsent || 0,
            formSubmitted: formSubmitted || 0,
            chatOpened: chatOpened || 0,
            whatsappConversationStarted: whatsappConversationStarted || 0,
            whatsappFollowupSent: whatsappFollowupSent || 0,
            whatsappFollowupReplied: whatsappFollowupReplied || 0,
            messageSent: new Set((messageSentData as any[])?.map(m => m.visitor_id)).size || 0,
            pushSubscribed: pushSubscribed || 0,
            gpsLocationRequested: gpsLocation.requested,
            gpsLocationGranted: gpsLocation.granted,
            gpsLocationDenied: gpsLocation.denied,
            gpsLocationUnavailable: gpsLocation.unavailable,
            gpsLocationDismissed: gpsLocation.dismissed,
            gpsLocationAcceptanceRate: gpsLocation.acceptanceRate,
            leadCaptured: leadCaptured || 0,
            qualified: qualified || 0,
            converted: converted || 0
        })

    } catch (error) {
        console.error('Funnel API Error:', error)
        return NextResponse.json({ error: 'Failed to fetch funnel data' }, { status: 500 })
    }
}
