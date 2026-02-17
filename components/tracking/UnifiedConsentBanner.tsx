'use client'

import { useState, useEffect } from 'react'
import { grantConsent, hasConsent, getVisitorId } from '@/lib/tracking/client'

export default function UnifiedConsentBanner() {
    const [show, setShow] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)

    useEffect(() => {
        // Show if no consent found
        if (!hasConsent()) {
            // Small delay for animation
            const timer = setTimeout(() => setShow(true), 1000)
            return () => clearTimeout(timer)
        }
    }, [])

    const handleAccept = async () => {
        setIsProcessing(true)

        try {
            // 1. Grant Cookie Consent (sets cookies + dispatches event)
            grantConsent()

            // 2. Register visitor in the database FIRST (so we get the DB visitor ID)
            const cookieId = getVisitorId()
            console.log('[Consent] Cookie visitor ID:', cookieId)

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
                        event_type: 'cookie_consent',
                        metadata: { granted: true }
                    }),
                })
                const trackData = await trackRes.json()
                dbVisitorId = trackData.visitor_id
                vapidPublicKey = trackData.vapid_public_key || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null
                console.log('[Consent] Database visitor ID:', dbVisitorId)
                console.log('[Consent] VAPID key available:', !!vapidPublicKey)
            } catch (err) {
                console.error('[Consent] Failed to register visitor:', err)
            }

            // 3. Push Notification Flow
            if (dbVisitorId && vapidPublicKey && 'serviceWorker' in navigator) {
                try {
                    // 3a. Register service worker FIRST (before permission request)
                    console.log('[Consent] Pre-registering service worker...')
                    const swRegistration = await navigator.serviceWorker.register('/sw.js')
                    await navigator.serviceWorker.ready
                    console.log('[Consent] Service worker ready')

                    // 3b. Check current permission state
                    const currentPermission = 'Notification' in window ? Notification.permission : 'unsupported'
                    console.log('[Consent] Current notification permission:', currentPermission)

                    let finalPermission = currentPermission

                    if (currentPermission === 'default') {
                        // Never asked — request permission now
                        console.log('[Consent] Requesting notification permission...')
                        finalPermission = await Notification.requestPermission()
                        console.log('[Consent] Permission result:', finalPermission)
                    } else if (currentPermission === 'denied') {
                        console.warn('[Consent] Push notifications are BLOCKED in this browser. User must manually reset permissions in browser settings.')
                    }

                    if (finalPermission === 'granted') {
                        // Subscribe to push
                        console.log('[Consent] Subscribing to push with VAPID key (length:', vapidPublicKey.length, ')')
                        const subscription = await swRegistration.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
                        })
                        console.log('[Consent] Push subscription created:', subscription.endpoint.substring(0, 60) + '...')

                        // Save to backend
                        const res = await fetch('/api/push/subscribe', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                visitor_id: dbVisitorId,
                                subscription: subscription.toJSON(),
                            }),
                        })

                        const data = await res.json()
                        if (res.ok) {
                            console.log('[Consent] ✅ Push subscription saved successfully!')
                        } else {
                            console.error('[Consent] ❌ Push subscription save failed:', data)
                        }

                        // Log push_consent funnel event
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
                            console.warn('[Consent] Failed to log push_consent event:', e)
                        }
                    } else {
                        console.log('[Consent] Push permission not granted:', finalPermission)
                        // Log push_denied funnel event
                        try {
                            await fetch('/api/track', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    visitor_cookie_id: cookieId,
                                    event_type: 'push_denied',
                                    metadata: { permission: finalPermission }
                                }),
                            })
                        } catch (e) {
                            console.warn('[Consent] Failed to log push_denied event:', e)
                        }
                    }
                } catch (pushErr) {
                    console.error('[Consent] Push flow error:', pushErr)
                }
            } else {
                if (!dbVisitorId) console.error('[Consent] ❌ No DB visitor ID — push cannot proceed!')
                if (!vapidPublicKey) console.warn('[Consent] No VAPID key available')
                if (!('serviceWorker' in navigator)) console.warn('[Consent] Service Worker not supported')
            }
        } catch (error) {
            console.error('[Consent] Error:', error)
        } finally {
            setIsProcessing(false)
            setShow(false)
        }
    }

    const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
        const rawData = window.atob(base64)
        const outputArray = new Uint8Array(rawData.length)
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i)
        }
        return outputArray
    }

    if (!show) return null

    return (
        <>
            {/* Backdrop overlay */}
            <div style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9998,
                backgroundColor: 'rgba(0, 0, 0, 0.35)',
            }} />

            {/* Centered modal */}
            <div style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                animation: 'consentFadeIn 0.4s ease-out',
            }}>
                <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '20px',
                    padding: '40px 36px 32px',
                    maxWidth: '420px',
                    width: '100%',
                    position: 'relative',
                    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    animation: 'consentScaleIn 0.4s ease-out',
                }}>
                    {/* Shield icon */}
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #c9a96e, #b8944f)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '24px',
                        boxShadow: '0 8px 20px rgba(201, 169, 110, 0.35)',
                    }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                            <path d="m9 12 2 2 4-4" />
                        </svg>
                    </div>

                    {/* Title */}
                    <h3 style={{
                        fontSize: '1.4rem',
                        fontWeight: 700,
                        color: '#111827',
                        marginBottom: '12px',
                        fontFamily: 'Georgia, "Times New Roman", serif',
                        letterSpacing: '-0.01em',
                    }}>
                        Termos e Privacidade
                    </h3>

                    {/* Description */}
                    <p style={{
                        fontSize: '0.92rem',
                        color: '#6b7280',
                        lineHeight: 1.65,
                        marginBottom: '28px',
                        maxWidth: '320px',
                    }}>
                        Para garantir sua exclusividade e segurança, aceite nossos termos de uso e política de privacidade para continuar.
                    </p>

                    {/* Accept button */}
                    <button
                        onClick={handleAccept}
                        disabled={isProcessing}
                        style={{
                            width: '100%',
                            padding: '15px 24px',
                            borderRadius: '12px',
                            border: 'none',
                            background: isProcessing ? '#d1d5db' : 'linear-gradient(135deg, #c9a96e, #b08a45)',
                            color: '#1a1a1a',
                            fontWeight: 700,
                            fontSize: '1rem',
                            cursor: isProcessing ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 4px 14px rgba(201, 169, 110, 0.3)',
                            marginBottom: '12px',
                            letterSpacing: '0.01em',
                        }}
                    >
                        {isProcessing ? 'Processando...' : 'Aceitar e Continuar'}
                    </button>

                    {/* Decline link */}
                    <button
                        onClick={() => setShow(false)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#9ca3af',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: '4px',
                            transition: 'color 0.2s',
                        }}
                    >
                        Ler Termos ou Recusar
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes consentFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes consentScaleIn {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </>
    )
}
