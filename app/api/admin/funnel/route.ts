
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
            { count: chatOpened },
            { count: messageSent },
            { count: pushSubscribed },
            { count: leadCaptured },
            { count: qualified },
            { count: converted }
        ] = await Promise.all([
            supabase.from('funnel_events').select('*', { count: 'exact', head: true }).eq('event_type', 'page_view'),
            supabase.from('funnel_events').select('*', { count: 'exact', head: true }).eq('event_type', 'chat_opened'),
            supabase.from('funnel_events').select('*', { count: 'exact', head: true }).eq('event_type', 'message_sent'),
            supabase.from('leads').select('*', { count: 'exact', head: true }).eq('push_subscribed', true),
            supabase.from('leads').select('*', { count: 'exact', head: true }).not('phone', 'is', null),
            supabase.from('leads').select('*', { count: 'exact', head: true }).eq('funnel_stage', 'qualified'),
            supabase.from('leads').select('*', { count: 'exact', head: true }).eq('funnel_stage', 'converted'),
        ])

        return NextResponse.json({
            pageViews: pageViews || 0,
            chatOpened: chatOpened || 0,
            messageSent: messageSent || 0,
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
