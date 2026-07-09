'use client'

import { useEffect, useRef } from 'react'
import { grantConsent, hasConsent, getVisitorId, isTrackingDisabled } from '@/lib/tracking/client'

/**
 * Silent auto-consent component.
 * Automatically grants cookie consent and registers the visitor
 * without showing any banner or modal.
 * Existing push subscriptions are synchronized when notifications are already permitted.
 */
export default function UnifiedConsentBanner() {
    const hasRun = useRef(false)

    useEffect(() => {
        if (hasRun.current) return
        hasRun.current = true

        const waitForIdle = () => new Promise<void>(resolve => {
            const idleWindow = window as typeof window & {
                requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number
            }

            if (idleWindow.requestIdleCallback) {
                idleWindow.requestIdleCallback(() => resolve(), { timeout: 2500 })
                return
            }

            window.setTimeout(resolve, 1200)
        })

        const runAutoConsent = async () => {
            try {
                if (isTrackingDisabled()) {
                    console.log('[AutoConsent] Tracking disabled by visitor')
                    return
                }

                const alreadyConsented = hasConsent()

                if (!alreadyConsented) {
                    grantConsent()
                    console.log('[AutoConsent] Cookie consent granted automatically')
                }

                const cookieId = getVisitorId()
                console.log('[AutoConsent] Visitor ID:', cookieId)

                let dbVisitorId: string | null = null
                let vapidPublicKey: string | null = null

                try {
                    const trackRes = await fetch('/api/track', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            visitor_cookie_id: cookieId,
                            referrer: document.referrer,
                            search_params: window.location.search,
                            event_type: alreadyConsented ? 'page_view' : 'cookie_consent',
                            metadata: alreadyConsented ? {} : { granted: true, auto: true }
                        }),
                    })
                    const trackData = await trackRes.json()
                    dbVisitorId = trackData.visitor_id
                    vapidPublicKey = trackData.vapid_public_key || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null
                    console.log('[AutoConsent] DB visitor ID:', dbVisitorId)
                } catch (err) {
                    console.warn('[AutoConsent] Failed to register visitor:', err)
                }

                if (dbVisitorId && vapidPublicKey && 'serviceWorker' in navigator) {
                    const currentPermission = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'

                    if (currentPermission === 'granted') {
                        try {
                            await waitForIdle()
                            const swRegistration = await navigator.serviceWorker.getRegistration()

                            if (!swRegistration) {
                                console.log('[AutoConsent] No active push service worker; skipping silent push sync')
                                return
                            }

                            const existingSubscription = await swRegistration.pushManager.getSubscription()
                            if (!existingSubscription) {
                                console.log('[AutoConsent] No existing push subscription; skipping silent push sync')
                                return
                            }

                            console.log('[AutoConsent] Existing push subscription found')

                            const res = await fetch('/api/push/subscribe', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    visitor_id: dbVisitorId,
                                    subscription: existingSubscription.toJSON(),
                                }),
                            })

                            if (res.ok) {
                                console.log('[AutoConsent] Push subscription saved')
                            } else {
                                const details = await res.text().catch(() => '')
                                console.warn('[AutoConsent] Push subscription save skipped', {
                                    status: res.status,
                                    details: details.slice(0, 240),
                                })
                            }

                            try {
                                await fetch('/api/track', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        visitor_cookie_id: cookieId,
                                        event_type: 'push_consent',
                                        metadata: { granted: true }
                                    }),
                                })
                            } catch (e) {
                                console.warn('[AutoConsent] Failed to log push_consent event:', e)
                            }
                        } catch (pushErr) {
                            console.warn('[AutoConsent] Push flow skipped:', pushErr)
                        }
                    }
                }
            } catch (error) {
                console.warn('[AutoConsent] Error:', error)
            }
        }

        runAutoConsent()
    }, [])

    return null
}
