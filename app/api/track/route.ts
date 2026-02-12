import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { extractTrackingData, generateVisitorId } from '@/lib/tracking'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { visitor_cookie_id, landing_page_slug, referrer, search_params } = body

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
                .single()
            landingPageId = lp?.id
        }

        // Check if visitor already exists
        const { data: existing } = await supabase
            .from('visitors')
            .select('id, page_views')
            .eq('visitor_cookie_id', cookieId)
            .single()

        if (existing) {
            // Update existing visitor
            await supabase
                .from('visitors')
                .update({
                    last_visit_at: new Date().toISOString(),
                    page_views: (existing.page_views || 1) + 1,
                })
                .eq('id', existing.id)

            // Log funnel event
            await supabase.from('funnel_events').insert({
                visitor_id: existing.id,
                landing_page_id: landingPageId,
                event_type: 'page_view',
                metadata: { page_views: (existing.page_views || 1) + 1 },
            })

            return NextResponse.json({
                visitor_id: existing.id,
                visitor_cookie_id: cookieId,
                is_returning: true,
            })
        }

        // Create new visitor
        const { data: visitor, error } = await supabase
            .from('visitors')
            .insert({
                ...trackingData,
                landing_page_id: landingPageId,
            })
            .select('id')
            .single()

        if (error) {
            console.error('Track error:', error)
            return NextResponse.json({ error: 'Failed to track visitor' }, { status: 500 })
        }

        // Log initial funnel event
        await supabase.from('funnel_events').insert({
            visitor_id: visitor.id,
            landing_page_id: landingPageId,
            event_type: 'page_view',
            metadata: { first_visit: true },
        })

        return NextResponse.json({
            visitor_id: visitor.id,
            visitor_cookie_id: cookieId,
            is_returning: false,
        })
    } catch (error) {
        console.error('Track error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
