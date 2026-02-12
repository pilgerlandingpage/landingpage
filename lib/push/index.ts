import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
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

    // Check if subscription already exists
    const { data: existing } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('endpoint', subscription.endpoint)
        .single()

    if (existing) {
        // Update existing
        await supabase
            .from('push_subscriptions')
            .update({
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
                active: true,
            })
            .eq('id', existing.id)
    } else {
        // Create new
        const { error } = await supabase.from('push_subscriptions').insert({
            visitor_id: visitorId,
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
        })

        if (error) return { success: false, error: error.message }
    }

    // Mark lead as push_subscribed
    await supabase
        .from('leads')
        .update({ push_subscribed: true })
        .eq('visitor_id', visitorId)

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
