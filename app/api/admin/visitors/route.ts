import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
    try {
        // Fetch visitors ordered by last visit
        const { data: visitors, error } = await supabase
            .from('visitors')
            .select('*')
            .order('last_visit_at', { ascending: false })
            .limit(100)

        if (error) throw error

        if (!visitors || visitors.length === 0) {
            return NextResponse.json([])
        }

        // Fetch leads and scroll events associated with these visitors
        const visitorUUIDs = visitors.map(v => v.id)

        const [leadsResponse, scrollResponse] = await Promise.all([
            supabase
                .from('leads')
                .select('visitor_id, funnel_stage, push_subscribed')
                .in('visitor_id', visitorUUIDs),
            supabase
                .from('funnel_events')
                .select('visitor_id, event_type, metadata')
                .in('visitor_id', visitorUUIDs)
                .eq('event_type', 'scroll_depth')
        ])

        const leads = leadsResponse.data
        const scrollEvents = scrollResponse.data

        // Enhance visitors with lead info and max scroll
        const enhancedVisitors = visitors.map(visitor => {
            const lead = leads?.find(l => l.visitor_id === visitor.id)

            // Find max scroll percentage for this visitor
            const visitorScrolls = scrollEvents?.filter(e => e.visitor_id === visitor.id) || []
            const maxScroll = visitorScrolls.reduce((max, curr) => {
                const val = (curr.metadata as any)?.percentage || 0
                return val > max ? val : max
            }, 0)

            return {
                ...visitor,
                is_lead: !!lead,
                funnel_stage: lead?.funnel_stage || 'visitor',
                push_subscribed: lead?.push_subscribed || false,
                max_scroll: maxScroll
            }
        })

        return NextResponse.json(enhancedVisitors)

    } catch (error) {
        console.error('Visitor API Error:', error)
        return NextResponse.json({ error: 'Failed to fetch visitors' }, { status: 500 })
    }
}
