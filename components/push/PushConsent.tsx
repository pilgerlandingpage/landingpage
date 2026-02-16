'use client'

import { useState, useEffect } from 'react'

export default function PushConsent({ visitorId, vapidPublicKey }: { visitorId?: string, vapidPublicKey?: string }) {
    const [show, setShow] = useState(false)
    const [permission, setPermission] = useState<NotificationPermission>('default')

    const [isSubscribing, setIsSubscribing] = useState(false)

    const activeVapidKey = vapidPublicKey || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

    useEffect(() => {
        if (typeof window === 'undefined' || !('Notification' in window)) return
        if (!activeVapidKey) {
            console.warn('[PushConsent] No VAPID key available, not showing consent')
            return
        }

        setPermission(Notification.permission)

        // Show after 5 seconds if not determined
        if (Notification.permission === 'default') {
            const timer = setTimeout(() => setShow(true), 5000)
            return () => clearTimeout(timer)
        }
    }, [activeVapidKey])

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

    const subscribe = async () => {
        // Guard: need visitor and VAPID key
        if (!visitorId || !activeVapidKey) {
            console.error('[PushConsent] Missing visitorId or VAPID key:', { visitorId, hasVapidKey: !!activeVapidKey })
            alert('Erro: Dados de visitante não disponíveis. Recarregue a página.')
            return
        }

        setIsSubscribing(true)
        console.log('[PushConsent] Starting subscription flow, visitorId:', visitorId)

        // Timeout protection: max 15 seconds
        const timeout = setTimeout(() => {
            console.error('[PushConsent] Subscription timed out after 15s')
            setIsSubscribing(false)
            setShow(false)
        }, 15000)

        try {
            // 1. Request notification permission FIRST
            // Wrap in timeout because Edge can hang on requestPermission()
            console.log('[PushConsent] Requesting notification permission...')
            const result = await new Promise<NotificationPermission>((resolve) => {
                try {
                    // Try promise-based API (Chrome, Edge, Firefox)
                    const p = Notification.requestPermission()
                    if (p && typeof p.then === 'function') {
                        p.then(resolve).catch(() => resolve('denied'))
                    }
                } catch (e) {
                    // Fallback to callback-based API (older Safari)
                    Notification.requestPermission((perm) => resolve(perm))
                }
                // Emergency timeout: if browser hangs, read current state
                setTimeout(() => {
                    console.warn('[PushConsent] Permission prompt timed out, using current state:', Notification.permission)
                    resolve(Notification.permission || 'denied')
                }, 10000)
            })
            setPermission(result)
            console.log('[PushConsent] Permission result:', result)

            if (result !== 'granted') {
                console.log('[PushConsent] Permission not granted, aborting')
                clearTimeout(timeout)
                setIsSubscribing(false)
                setShow(false)
                return
            }

            // 2. Register service worker
            console.log('[PushConsent] Registering SW...')
            await navigator.serviceWorker.register('/sw.js')
            console.log('[PushConsent] SW registered, waiting for ready...')

            // 3. Wait for SW to be ready
            const registration = await navigator.serviceWorker.ready
            console.log('[PushConsent] SW is ready')

            // 4. Subscribe to push
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(activeVapidKey),
            })
            console.log('[PushConsent] Push subscription created')

            // 5. Send to backend
            const res = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    visitor_id: visitorId,
                    subscription: subscription.toJSON(),
                }),
            })

            if (res.ok) {
                console.log('[PushConsent] Subscription saved successfully!')
            } else {
                const data = await res.json()
                console.error('[PushConsent] Backend error:', data)
            }
        } catch (error: any) {
            console.error('[PushConsent] Error:', error)
            alert('Erro na inscrição push: ' + (error?.message || error))
        } finally {
            clearTimeout(timeout)
            setIsSubscribing(false)
            setShow(false)
        }
    }

    if (!show || permission !== 'default') return null

    return (
        <div style={{
            position: 'fixed',
            bottom: '80px', // Increased to avoid bottom navigation bars
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999, // Ensure it's on top of everything
            width: 'calc(100% - 32px)',
            maxWidth: '420px',
            backgroundColor: '#ffffff', // Solid white for better readability
            boxShadow: '0 20px 40px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
            borderRadius: '20px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            animation: 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
            color: '#1a1a1a'
        }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{
                    width: '48px',
                    height: '48px',
                    backgroundColor: 'var(--gold)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    color: '#000'
                }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /></svg>
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '10px', color: '#000' }}>
                    Termos e Privacidade
                </h3>
                <p style={{ fontSize: '0.95rem', color: '#4b5563', lineHeight: 1.6 }}>
                    Para garantir sua exclusividade e segurança, aceite nossos termos de uso e política de privacidade para continuar.
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                    onClick={subscribe}
                    disabled={isSubscribing}
                    style={{
                        width: '100%',
                        padding: '14px',
                        borderRadius: '12px',
                        border: 'none',
                        background: isSubscribing ? '#ccc' : 'linear-gradient(135deg, #c9a96e, #a88a4d)',
                        color: '#000',
                        fontWeight: 700,
                        cursor: isSubscribing ? 'not-allowed' : 'pointer',
                        fontSize: '0.95rem',
                        transition: 'transform 0.2s',
                    }}
                >
                    {isSubscribing ? 'Processando...' : 'Aceitar e Continuar'}
                </button>
                <button
                    onClick={() => setShow(false)}
                    style={{
                        width: '100%',
                        padding: '12px',
                        background: 'none',
                        border: 'none',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        textDecoration: 'underline'
                    }}
                >
                    Ler Termos ou Recusar
                </button>
            </div>

            <style>{`
                @keyframes slideUp {
                    from { transform: translate(-50%, 40px); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
            `}</style>
        </div>
    )
}
