import { NextRequest, NextResponse } from 'next/server'
import { saveSubscription, PushSubscriptionData } from '@/lib/push'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { visitor_id, subscription } = body as {
            visitor_id: string
            subscription: PushSubscriptionData
        }

        if (!visitor_id || !subscription?.endpoint || !subscription?.keys) {
            return NextResponse.json(
                { error: 'visitor_id and subscription are required' },
                { status: 400 }
            )
        }

        const result = await saveSubscription(visitor_id, subscription)

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || 'Failed to save subscription' },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Push subscribe error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
