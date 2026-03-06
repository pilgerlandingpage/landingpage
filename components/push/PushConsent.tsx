'use client'

import { useState, useEffect, useRef } from 'react'
import { getVisitorId } from '@/lib/tracking/client'

/**
 * Persuasive Push Notification Trigger with Visual Guidance.
 * Appears after the user scrolls ~35% or after 15 seconds.
 * When the user clicks to enable, it shows a visual guide pointing to the 
 * browser's native "Allow" button to maximize acceptance rates.
 */
export default function PushConsent() {
    const [show, setShow] = useState(false)
    const [isSubscribing, setIsSubscribing] = useState(false)
    const [isDismissed, setIsDismissed] = useState(false)
    const [isWaitingForNative, setIsWaitingForNative] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const hasTriggered = useRef(false)

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

    useEffect(() => {
        // Detect mobile
        const checkMobile = () => {
            setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
        }
        checkMobile()

        if (typeof window === 'undefined') return
        if (!('Notification' in window)) return
        if (!('serviceWorker' in navigator)) return
        if (!vapidPublicKey) return
        if (Notification.permission !== 'default') return

        if (sessionStorage.getItem('push_prompt_dismissed')) return

        const trigger = () => {
            if (hasTriggered.current) return
            hasTriggered.current = true
            setShow(true)
        }

        const handleScroll = () => {
            const scrollPercent = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)
            if (scrollPercent > 0.35) trigger()
        }

        const timer = setTimeout(trigger, 15000)
        window.addEventListener('scroll', handleScroll, { passive: true })

        return () => {
            clearTimeout(timer)
            window.removeEventListener('scroll', handleScroll)
        }
    }, [vapidPublicKey])

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

    const handleEnable = async () => {
        if (!vapidPublicKey) return
        setIsSubscribing(true)
        setIsWaitingForNative(true) // Start visual guidance

        const timeout = setTimeout(() => {
            console.error('[PushTrigger] Subscription timed out')
            setIsSubscribing(false)
            setIsWaitingForNative(false)
            handleDismiss()
        }, 20000)

        try {
            console.log('[PushTrigger] Requesting notification permission...')
            let result: NotificationPermission = 'denied'
            try {
                const p = Notification.requestPermission()
                if (p && typeof p.then === 'function') {
                    result = await p
                } else {
                    result = await new Promise<NotificationPermission>((resolve) =>
                        Notification.requestPermission(resolve)
                    )
                }
            } catch (e) {
                console.warn('[PushTrigger] Permission error:', e)
                result = Notification.permission
            }

            console.log('[PushTrigger] Permission result:', result)

            if (result !== 'granted') {
                const cookieId = getVisitorId()
                try {
                    await fetch('/api/track', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            visitor_cookie_id: cookieId,
                            event_type: 'push_denied',
                            metadata: { permission: result }
                        }),
                    })
                } catch { }
                setIsWaitingForNative(false)
                handleDismiss()
                return
            }

            // SUCCESS FLOW
            setIsWaitingForNative(false) // Stop guidance overlay

            console.log('[PushTrigger] Registering service worker...')
            const swRegistration = await navigator.serviceWorker.register('/sw.js')
            await navigator.serviceWorker.ready

            const subscription = await swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
            })

            const cookieId = getVisitorId()
            const trackRes = await fetch('/api/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    visitor_cookie_id: cookieId,
                    event_type: 'push_consent',
                    metadata: { granted: true }
                }),
            })
            const trackData = await trackRes.json()
            const dbVisitorId = trackData.visitor_id

            if (dbVisitorId) {
                await fetch('/api/push/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        visitor_id: dbVisitorId,
                        subscription: subscription.toJSON(),
                    }),
                })
            }
        } catch (error) {
            console.error('[PushTrigger] Error:', error)
        } finally {
            clearTimeout(timeout)
            setIsSubscribing(false)
            setIsWaitingForNative(false)
            handleDismiss()
        }
    }

    const handleDismiss = () => {
        setIsDismissed(true)
        sessionStorage.setItem('push_prompt_dismissed', 'true')
        setTimeout(() => setShow(false), 400)
    }

    if (!show) return null

    return (
        <>
            {/* 1. NATIVE GUIDANCE OVERLAY (The "Tutorial") */}
            {isWaitingForNative && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 10000,
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: isMobile ? 'center' : 'flex-start',
                    padding: isMobile ? '20px' : '80px 40px',
                    textAlign: 'center',
                    animation: 'pushFadeIn 0.3s ease-out',
                }}>
                    {/* Animated Arrow for Desktop (Points Top-Left) */}
                    {!isMobile && (
                        <div style={{
                            position: 'absolute',
                            top: '20px',
                            left: '120px',
                            animation: 'pushPulseArrow 1.5s infinite ease-in-out',
                            zIndex: 10001,
                        }}>
                            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" transform="rotate(-45)">
                                <path d="M12 5V19M12 5L6 11M12 5L18 11" stroke="#c9a96e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    )}

                    {/* Instruction Box */}
                    <div style={{
                        maxWidth: '450px',
                        background: '#1a1a1a',
                        border: '2px solid #c9a96e',
                        borderRadius: '24px',
                        padding: '32px 24px',
                        boxShadow: '0 0 50px rgba(201, 169, 110, 0.3)',
                        marginTop: !isMobile ? '100px' : '0',
                    }}>
                        <div style={{
                            fontSize: '2rem',
                            marginBottom: '16px',
                            animation: 'pushBounce 2s infinite'
                        }}>
                            ☝️
                        </div>
                        <h2 style={{
                            color: '#ffffff',
                            fontFamily: 'Playfair Display, serif',
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            marginBottom: '16px',
                            lineHeight: 1.3,
                        }}>
                            QUASE LÁ!
                        </h2>
                        <p style={{
                            color: 'rgba(255,255,255,0.9)',
                            fontSize: '1.1rem',
                            lineHeight: 1.6,
                            marginBottom: '0',
                        }}>
                            {isMobile
                                ? "Clique em 'PERMITIR' na pequena janela que apareceu no topo da sua tela para confirmar."
                                : "Clique em 'PERMITIR' na caixa de aviso que apareceu no canto superior esquerdo para ativar seu acesso VIP."}
                        </p>
                    </div>
                </div>
            )}

            {/* 2. REGULAR TRIGGER UI */}
            {!isWaitingForNative && (
                <>
                    <div
                        onClick={handleDismiss}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 9997,
                            backgroundColor: 'rgba(0, 0, 0, 0.25)',
                            animation: isDismissed ? 'pushFadeOut 0.4s ease-out forwards' : 'pushFadeIn 0.3s ease-out',
                            cursor: 'pointer',
                        }}
                    />

                    <div style={{
                        position: 'fixed',
                        bottom: '24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 9998,
                        width: 'calc(100% - 32px)',
                        maxWidth: '400px',
                        animation: isDismissed
                            ? 'pushSlideOut 0.4s ease-in forwards'
                            : 'pushSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}>
                        <div style={{
                            background: 'linear-gradient(145deg, #1a1a1a 0%, #2d2d2d 100%)',
                            borderRadius: '20px',
                            padding: '28px 24px 24px',
                            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.06)',
                            position: 'relative',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: '3px',
                                background: 'linear-gradient(90deg, #c9a96e, #e8d5a8, #c9a96e)',
                            }} />

                            <button onClick={handleDismiss} style={{
                                position: 'absolute',
                                top: '12px',
                                right: '12px',
                                background: 'rgba(255,255,255,0.08)',
                                border: 'none',
                                color: 'rgba(255,255,255,0.4)',
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '16px',
                            }}>✕</button>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                <div style={{
                                    width: '44px', height: '44px', borderRadius: '12px',
                                    background: 'linear-gradient(135deg, #c9a96e, #b08a45)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    boxShadow: '0 4px 12px rgba(201, 169, 110, 0.3)',
                                }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /><circle cx="18" cy="4" r="3" fill="#ef4444" stroke="#ef4444" />
                                    </svg>
                                </div>
                                <div style={{ background: 'rgba(201, 169, 110, 0.15)', border: '1px solid rgba(201, 169, 110, 0.25)', borderRadius: '20px', padding: '2px 10px', fontSize: '0.7rem', fontWeight: 600, color: '#c9a96e', letterSpacing: '0.05em', textTransform: 'uppercase' }}>⭐ Acesso VIP</div>
                            </div>

                            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', marginBottom: '8px', fontFamily: 'Georgia, serif', lineHeight: 1.3 }}>Seja o primeiro a saber das oportunidades exclusivas</h3>
                            <p style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.55)', lineHeight: 1.6, marginBottom: '20px' }}>Receba alertas de novos imóveis, condições especiais e oportunidades antes de todos.</p>

                            <button
                                onClick={handleEnable}
                                disabled={isSubscribing}
                                style={{
                                    width: '100%', padding: '14px 20px', borderRadius: '12px', border: 'none',
                                    background: isSubscribing ? 'rgba(201, 169, 110, 0.3)' : 'linear-gradient(135deg, #c9a96e, #b08a45)',
                                    color: '#1a1a1a', fontWeight: 700, fontSize: '0.95rem', cursor: isSubscribing ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s ease', boxShadow: isSubscribing ? 'none' : '0 4px 14px rgba(201, 169, 110, 0.3)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                }}
                            >
                                {isSubscribing ? "⚙️ Ativando..." : "🔔 Quero receber novidades"}
                            </button>

                            <button onClick={handleDismiss} style={{ width: '100%', background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.25)', fontSize: '0.78rem', cursor: 'pointer', padding: '10px 0 0' }}>Agora não, obrigado</button>
                        </div>
                    </div>
                </>
            )}

            <style>{`
                @keyframes pushFadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes pushFadeOut { from { opacity: 1; } to { opacity: 0; } }
                @keyframes pushSlideIn { from { transform: translateX(-50%) translateY(100px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
                @keyframes pushSlideOut { from { transform: translateX(-50%) translateY(0); opacity: 1; } to { transform: translateX(-50%) translateY(100px); opacity: 0; } }
                @keyframes pushBounce { 0%, 20%, 50%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-10px); } 60% { transform: translateY(-5px); } }
                @keyframes pushPulseArrow { 0% { transform: scale(1) translate(0, 0); opacity: 0.8; } 50% { transform: scale(1.1) translate(-10px, -10px); opacity: 1; } 100% { transform: scale(1) translate(0, 0); opacity: 0.8; } }
            `}</style>
        </>
    )
}

