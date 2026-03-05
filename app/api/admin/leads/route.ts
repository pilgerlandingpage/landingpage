import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
    try {
        const { data: leads, error } = await supabase
            .from('leads')
            .select(`
                *,
                lead_purpose,
                lead_budget,
                lead_timeframe,
                is_partner,
                push_subscribed_lead,
                landing_page:landing_pages (
                    title
                ),
                visitor:visitors (
                    detected_source,
                    browser,
                    device_type,
                    ip_address,
                    os,
                    country,
                    city,
                    region
                )
            `)
            .order('created_at', { ascending: false })

        if (error) throw error

        return NextResponse.json(leads)
    } catch (error) {
        console.error('Error fetching leads:', error)
        return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
    }
}
