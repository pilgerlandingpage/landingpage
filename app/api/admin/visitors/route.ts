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

        // Fetch leads associated with these visitors to check conversion status
        const visitorUUIDs = visitors.map(v => v.id)

        const { data: leads } = await supabase
            .from('leads')
            .select('visitor_id, funnel_stage, push_subscribed')
            .in('visitor_id', visitorUUIDs)

        // Enhance visitors with lead info
        const enhancedVisitors = visitors.map(visitor => {
            const lead = leads?.find(l => l.visitor_id === visitor.id)
            return {
                ...visitor,
                is_lead: !!lead,
                funnel_stage: lead?.funnel_stage || 'visitor',
                push_subscribed: lead?.push_subscribed || false
            }
        })

        return NextResponse.json(enhancedVisitors)

    } catch (error) {
        console.error('Visitor API Error:', error)
        return NextResponse.json({ error: 'Failed to fetch visitors' }, { status: 500 })
    }
}
