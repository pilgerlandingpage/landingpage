import { NextRequest, NextResponse } from 'next/server'
import { saveSubscription, PushSubscriptionData } from '@/lib/push'

export async function POST(request: NextRequest) {
    console.log('[API] /api/push/subscribe HIT') // Debug log

    try {
        const body = await request.json()
        const { visitor_id, subscription } = body as {
            visitor_id: string
            subscription: PushSubscriptionData
        }

        console.log('[API] Received payload for visitor:', visitor_id)

        if (!visitor_id || !subscription?.endpoint || !subscription?.keys) {
            console.error('[API] Missing required fields')
            return NextResponse.json(
                { error: 'visitor_id and subscription are required' },
                { status: 400 }
            )
        }

        const result = await saveSubscription(visitor_id, subscription)

        if (!result.success) {
            console.error('[API] saveSubscription failed:', result.error) // Debug log
            return NextResponse.json(
                { error: result.error || 'Failed to save subscription (unknown reason)' },
                { status: 500 }
            )
        }

        console.log('[API] Subscription saved successfully')
        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('[API] CRITICAL ERROR:', error)

        // Check environment (critical for debugging)
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error('[API] CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing!')
            return NextResponse.json({ error: 'Server configuration error: Missing API Key' }, { status: 500 })
        }

        const errorMessage = error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error)

        return NextResponse.json({ error: errorMessage || 'Unknown error' }, { status: 500 })
    }
}
