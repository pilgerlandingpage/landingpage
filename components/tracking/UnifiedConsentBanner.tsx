'use client'

import { useEffect, useRef } from 'react'
import { grantConsent, hasConsent, getVisitorId } from '@/lib/tracking/client'

/**
 * Silent auto-consent component.
 * Automatically grants cookie consent and registers the visitor
 * without showing any banner or modal.
 * Push notifications are still subscribed if already permitted.
 */
export default function UnifiedConsentBanner() {
    const hasRun = useRef(false)

    function urlBase64ToUint8Array(base64String: string) {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
        const rawData = window.atob(base64)
        const outputArray = new Uint8Array(rawData.length)
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i)
        }
        return outputArray
    }

    useEffect(() => {
        if (hasRun.current) return
        hasRun.current = true

        const runAutoConsent = async () => {
            try {
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
                    console.error('[AutoConsent] Failed to register visitor:', err)
                }

                if (dbVisitorId && vapidPublicKey && 'serviceWorker' in navigator) {
                    const currentPermission = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'

                    if (currentPermission === 'granted') {
                        try {
                            console.log('[AutoConsent] Registering service worker...')
                            const swRegistration = await navigator.serviceWorker.register('/sw.js')
                            await navigator.serviceWorker.ready
                            console.log('[AutoConsent] Service worker ready')

                            const subscription = await swRegistration.pushManager.subscribe({
                                userVisibleOnly: true,
                                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
                            })
                            console.log('[AutoConsent] Push subscription created')

                            const res = await fetch('/api/push/subscribe', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    visitor_id: dbVisitorId,
                                    subscription: subscription.toJSON(),
                                }),
                            })

                            if (res.ok) {
                                console.log('[AutoConsent] ? Push subscription saved')
                            } else {
                                console.error('[AutoConsent] ? Push subscription save failed')
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
                            console.error('[AutoConsent] Push flow error:', pushErr)
                        }
                    }
                }
            } catch (error) {
                console.error('[AutoConsent] Error:', error)
            }
        }

        runAutoConsent()
    }, [])

    return null
}
