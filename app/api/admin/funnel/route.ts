
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
    try {
        const [
            { count: pageViews },
            { count: cookieConsent },
            { count: chatOpened },
            { data: messageSentData },
            { count: pushSubscribed },
            { count: leadCaptured },
            { count: qualified },
            { count: converted }
        ] = await Promise.all([
            supabase.from('visitors').select('*', { count: 'exact', head: true }),
            supabase.from('funnel_events').select('*', { count: 'exact', head: true }).eq('event_type', 'cookie_consent'),
            supabase.from('funnel_events').select('*', { count: 'exact', head: true }).eq('event_type', 'chat_opened'),
            supabase.from('chat_history').select('visitor_id'),
            supabase.from('push_subscriptions').select('*', { count: 'exact', head: true }).eq('active', true),
            supabase.from('leads').select('*', { count: 'exact', head: true }).not('phone', 'is', null),
            supabase.from('leads').select('*', { count: 'exact', head: true }).eq('funnel_stage', 'qualified'),
            supabase.from('leads').select('*', { count: 'exact', head: true }).eq('funnel_stage', 'converted'),
        ])

        return NextResponse.json({
            pageViews: pageViews || 0,
            cookieConsent: cookieConsent || 0,
            chatOpened: chatOpened || 0,
            messageSent: new Set((messageSentData as any[])?.map(m => m.visitor_id)).size || 0,
            pushSubscribed: pushSubscribed || 0,
            leadCaptured: leadCaptured || 0,
            qualified: qualified || 0,
            converted: converted || 0
        })

    } catch (error) {
        console.error('Funnel API Error:', error)
        return NextResponse.json({ error: 'Failed to fetch funnel data' }, { status: 500 })
    }
}
