import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !key) {
        throw new Error(`Supabase configuration missing. URL: ${!!url}, Key: ${!!key}`)
    }

    return createClient(url, key)
}

async function configureVapid() {
    const supabase = getSupabase()
    let subject = process.env.VAPID_SUBJECT!
    let publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
    let privateKey = process.env.VAPID_PRIVATE_KEY!

    try {
        const { data } = await supabase
            .from('app_config')
            .select('key, value')
            .in('key', ['vapid_subject', 'vapid_public_key', 'vapid_private_key'])
        const config: Record<string, string> = {}
        data?.forEach((row: { key: string; value: string }) => {
            config[row.key] = row.value
        })
        if (config.vapid_subject) subject = config.vapid_subject
        if (config.vapid_public_key) publicKey = config.vapid_public_key
        if (config.vapid_private_key) privateKey = config.vapid_private_key
    } catch { /* fallback to env */ }

    webpush.setVapidDetails(subject, publicKey, privateKey)
}

export interface PushSubscriptionData {
    endpoint: string
    keys: {
        p256dh: string
        auth: string
    }
}

export interface PushPayload {
    title: string
    body: string
    icon?: string
    badge?: string
    url?: string
    data?: Record<string, unknown>
}

/**
 * Save a push subscription for a visitor
 */
export async function saveSubscription(
    visitorId: string,
    subscription: PushSubscriptionData
): Promise<{ success: boolean; error?: string }> {
    const supabase = getSupabase()

    const { error: subError } = await supabase.from('push_subscriptions').upsert({
        visitor_id: visitorId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        active: true
    }, { onConflict: 'endpoint' })

    if (subError) return { success: false, error: subError.message }

    // Check if lead exists
    const { data: existingLead } = await supabase
        .from('leads')
        .select('id')
        .eq('visitor_id', visitorId)
        .single()

    if (existingLead) {
        // Update existing lead
        await supabase
            .from('leads')
            .update({ push_subscribed: true })
            .eq('id', existingLead.id)
    } else {
        // Create new lead (Lead Push Over)
        // Fetch visitor data to populate lead
        const { data: visitor } = await supabase
            .from('visitors')
            .select('*')
            .eq('id', visitorId)
            .single()

        if (!visitor) {
            console.error('[Push] Visitor not found for ID:', visitorId)
            return { success: false, error: 'Visitor ID not found in database. Clear cookies?' }
        }

        const { error: insertError } = await supabase.from('leads').insert({
            visitor_id: visitorId,
            funnel_stage: 'lead',
            name: 'Inscrito Push', // Placeholder
            push_subscribed: true,
            created_at: new Date().toISOString(),
            country: visitor?.country,
            city: visitor?.city,
            state: visitor?.region
        })

        if (insertError) {
            console.error('[Push] Failed to create lead:', insertError)
            return { success: false, error: 'Failed to create lead record: ' + insertError.message }
        }
    }

    return { success: true }
}

/**
 * Send a push notification to a specific subscription
 */
export async function sendPushNotification(
    subscription: PushSubscriptionData,
    payload: PushPayload
): Promise<{ success: boolean; error?: string }> {
    try {
        await configureVapid()
        await webpush.sendNotification(
            {
                endpoint: subscription.endpoint,
                keys: subscription.keys,
            },
            JSON.stringify(payload)
        )
        return { success: true }
    } catch (error: unknown) {
        console.error('[WebPush] Send error:', error)
        const statusCode = (error as { statusCode?: number }).statusCode
        // If subscription expired or invalid, mark as inactive
        if (statusCode === 404 || statusCode === 410) {
            const supabase = getSupabase()
            await supabase
                .from('push_subscriptions')
                .update({ active: false })
                .eq('endpoint', subscription.endpoint)
        }
        return { success: false, error: String(error) }
    }
}

/**
 * Send push notification to all active subscriptions for a visitor
 */
export async function sendPushToVisitor(
    visitorId: string,
    payload: PushPayload
): Promise<{ sent: number; failed: number }> {
    const supabase = getSupabase()
    const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('visitor_id', visitorId)
        .eq('active', true)

    let sent = 0
    let failed = 0

    for (const sub of subscriptions || []) {
        const result = await sendPushNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
        )
        if (result.success) sent++
        else failed++
    }

    return { sent, failed }
}

/**
 * Broadcast push notification to all active subscriptions
 */
export async function broadcastPush(
    payload: PushPayload
): Promise<{ sent: number; failed: number }> {
    const supabase = getSupabase()
    const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('active', true)

    let sent = 0
    let failed = 0

    for (const sub of subscriptions || []) {
        const result = await sendPushNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
        )
        if (result.success) sent++
        else failed++
    }

    return { sent, failed }
}
