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
                console.log('[Consent] Database visitor ID:', dbVisitorId)
            } catch (err) {
                console.error('[Consent] Failed to register visitor:', err)
            }

            // 3. Request Push Permission + Subscribe (only if we have a DB visitor ID)
            if (dbVisitorId && 'Notification' in window && 'serviceWorker' in navigator) {
                try {
                    const permission = await Notification.requestPermission()
                    console.log('[Consent] Push permission:', permission)
                    if (permission === 'granted') {
                        await subscribeToPush(dbVisitorId)
                    }
                } catch (pushErr) {
                    console.error('[Consent] Push permission error:', pushErr)
                }
            }
        } catch (error) {
            console.error('[Consent] Error:', error)
        } finally {
            setIsProcessing(false)
            setShow(false)
        }
    }

    const subscribeToPush = async (dbVisitorId: string) => {
        try {
            console.log('[Consent] Registering service worker...')
            const registration = await navigator.serviceWorker.register('/sw.js')
            await navigator.serviceWorker.ready
            console.log('[Consent] Service worker ready')

            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
            if (!vapidKey) {
                console.warn('[Consent] No VAPID key configured, skipping push')
                return
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey),
            })
            console.log('[Consent] Push subscription created')

            // Use the DATABASE visitor ID (not the cookie ID)
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
                console.log('[Consent] Push subscription saved successfully!')
            } else {
                console.error('[Consent] Push subscription save failed:', data)
            }
        } catch (e) {
            console.error('[Consent] Push subscription failed:', e)
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
