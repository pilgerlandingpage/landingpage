import { createServerSupabase } from '@/lib/supabase/server'
import { broadcastPush, sendPushToVisitor, PushPayload } from '@/lib/push'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    const supabase = await createServerSupabase()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json()
        const { title, message, url, icon, target, visitor_id } = body

        if (!title || !message) {
            return NextResponse.json({ error: 'Missing title or message' }, { status: 400 })
        }

        const payload: PushPayload = {
            title,
            body: message,
            url: url || '/',
            icon: icon || 'https://placehold.co/192x192/c9a96e/ffffff.png?text=P',
            badge: 'https://placehold.co/72x72/c9a96e/ffffff.png?text=P'
        }

        let result

        if (target === 'broadcast') {
            result = await broadcastPush(payload)
        } else if (target === 'visitor' && visitor_id) {
            result = await sendPushToVisitor(visitor_id, payload)
        } else {
            return NextResponse.json({ error: 'Invalid target' }, { status: 400 })
        }

        console.log(`[Push Send] Result - Sent: ${result?.sent}, Failed: ${result?.failed}`)

        return NextResponse.json({ success: true, ...result })

    } catch (error) {
        console.error('Push send error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
