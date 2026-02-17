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
        const { visitor_cookie_id, landing_page_slug, referrer, search_params, event_type, metadata } = body

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
                .maybeSingle()
            landingPageId = lp?.id
        }

        // Check if visitor already exists
        const { data: existing } = await supabase
            .from('visitors')
            .select('id, page_views, country, city, region')
            .eq('visitor_cookie_id', cookieId)
            .maybeSingle()

        // Handle race condition where visitor might be created between check and insert
        if (!existing) {
            const { data: doubleCheck } = await supabase
                .from('visitors')
                .select('id, page_views, country, city, region')
                .eq('visitor_cookie_id', cookieId)
                .maybeSingle()

            if (doubleCheck) {
                // It exists now, proceed as update
                // Recursively call or just carry on? 
                // Simplest is to treat as existing
                // Refactor: Logic below can be shared? 
                // For now, let's just use upsert for creation to be safe?
                // But we have different logic for create vs update (increment page views)
                // Let's just create a `visitor` variable that is either existing or new
            }
        }

        if (existing) {
            // Update existing visitor
            await supabase
                .from('visitors')
                .update({
                    last_visit_at: new Date().toISOString(),

                    page_views: (existing.page_views || 1) + 1,
                    country: trackingData.country || existing.country,
                    city: trackingData.city || existing.city,
                    region: trackingData.region || existing.region,
                })
                .eq('id', existing.id)

            // Log funnel event
            if (event_type) {
                await supabase.from('funnel_events').insert({
                    visitor_id: existing.id,
                    landing_page_id: landingPageId,
                    event_type: event_type,
                    metadata: metadata || {}
                })
            } else {
                // Default: Page View
                await supabase.from('funnel_events').insert({
                    visitor_id: existing.id,
                    landing_page_id: landingPageId,
                    event_type: 'page_view',
                    metadata: { page_views: (existing.page_views || 1) + 1 },
                })
            }

            // Get VAPID public key for push notifications
            const { data: vapidKey } = await supabase
                .from('app_config')
                .select('value')
                .eq('key', 'vapid_public_key')
                .maybeSingle()

            return NextResponse.json({
                visitor_id: existing.id,
                visitor_cookie_id: cookieId,
                is_returning: true,
                vapid_public_key: vapidKey?.value || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
            })
        }

        // Create new visitor (upsert to handle race conditions safely)
        const { data: visitor, error } = await supabase
            .from('visitors')
            .upsert({
                ...trackingData,
                landing_page_id: landingPageId,
            }, { onConflict: 'visitor_cookie_id' })
            .select('id')
            .single()

        if (error) {
            console.error('Track error:', error)
            return NextResponse.json({ error: 'Failed to track visitor' }, { status: 500 })
        }

        // Log initial funnel event
        if (event_type) {
            await supabase.from('funnel_events').insert({
                visitor_id: visitor.id,
                landing_page_id: landingPageId,
                event_type: event_type,
                metadata: metadata || {}
            })
        } else {
            // Default: Page View
            await supabase.from('funnel_events').insert({
                visitor_id: visitor.id,
                landing_page_id: landingPageId,
                event_type: 'page_view',
                metadata: { first_visit: true },
            })
        }

        // Get VAPID public key for push notifications
        const { data: vapidKey } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', 'vapid_public_key')
            .maybeSingle()

        return NextResponse.json({
            visitor_id: visitor.id,
            visitor_cookie_id: cookieId,
            is_returning: false,
            vapid_public_key: vapidKey?.value || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        })
    } catch (error) {
        console.error('Track error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
