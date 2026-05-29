'use client'

import { useEffect, useRef, useState } from 'react'
import { getVisitorId, trackEvent } from '@/lib/tracking/client'

type PushConsentProps = {
    visitorId?: string
    vapidPublicKey?: string
}

type PushPromptContent = {
    reason: string
    title: string
    body: string
    cta: string
}

const DEFAULT_PROMPT: PushPromptContent = {
    reason: 'passive',
    title: 'Receba oportunidades antes de todo mundo',
    body: 'Avisamos quando aparecer um imovel alinhado ao seu perfil em Balneario, Praia Brava, Itapema ou Porto Belo.',
    cta: 'Ativar alertas VIP',
}

export default function PushConsent({ visitorId, vapidPublicKey: trackedVapidPublicKey }: PushConsentProps) {
    const [show, setShow] = useState(false)
    const [isSubscribing, setIsSubscribing] = useState(false)
    const [isDismissed, setIsDismissed] = useState(false)
    const [isWaitingForNative, setIsWaitingForNative] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [promptContent, setPromptContent] = useState<PushPromptContent>(DEFAULT_PROMPT)
    const hasTriggered = useRef(false)

    const vapidPublicKey = trackedVapidPublicKey || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

    useEffect(() => {
        if (typeof window === 'undefined') return

        setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))

        if (!('Notification' in window)) return
        if (!('serviceWorker' in navigator)) return
        if (!vapidPublicKey) return
        if (Notification.permission !== 'default') return
        if (sessionStorage.getItem('push_prompt_dismissed')) return

        const trigger = (content: PushPromptContent) => {
            if (hasTriggered.current) return
            if (sessionStorage.getItem('push_prompt_dismissed')) return
            hasTriggered.current = true
            setPromptContent(content)
            setShow(true)
            void trackEvent('push_soft_prompt_shown', {
                reason: content.reason,
                title: content.title,
            })
        }

        const handleScroll = () => {
            const scrollable = document.documentElement.scrollHeight - window.innerHeight
            if (scrollable <= 0) return
            const scrollPercent = window.scrollY / scrollable
            if (scrollPercent > 0.35) trigger({ ...DEFAULT_PROMPT, reason: 'scroll_35' })
        }

        const handleIntent = (event: Event) => {
            const detail = (event as CustomEvent<Partial<PushPromptContent>>).detail || {}
            trigger({
                reason: detail.reason || 'intent',
                title: detail.title || DEFAULT_PROMPT.title,
                body: detail.body || DEFAULT_PROMPT.body,
                cta: detail.cta || DEFAULT_PROMPT.cta,
            })
        }

        const timer = window.setTimeout(() => {
            trigger({ ...DEFAULT_PROMPT, reason: 'timer_15s' })
        }, 15000)

        window.addEventListener('scroll', handleScroll, { passive: true })
        window.addEventListener('pilger_push_intent', handleIntent)

        return () => {
            window.clearTimeout(timer)
            window.removeEventListener('scroll', handleScroll)
            window.removeEventListener('pilger_push_intent', handleIntent)
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

    const handleDismiss = (shouldTrack = true) => {
        if (shouldTrack) {
            void trackEvent('push_soft_prompt_dismissed', {
                reason: promptContent.reason,
                title: promptContent.title,
            })
        }

        setIsDismissed(true)
        sessionStorage.setItem('push_prompt_dismissed', 'true')
        window.setTimeout(() => setShow(false), 400)
    }

    const handleEnable = async () => {
        if (!vapidPublicKey) return

        void trackEvent('push_soft_prompt_clicked', {
            reason: promptContent.reason,
            title: promptContent.title,
        })

        setIsSubscribing(true)
        setIsWaitingForNative(true)

        const timeout = window.setTimeout(() => {
            setIsSubscribing(false)
            setIsWaitingForNative(false)
            handleDismiss(false)
        }, 20000)

        try {
            let result: NotificationPermission = 'denied'

            try {
                result = await Notification.requestPermission()
            } catch {
                result = Notification.permission
            }

            if (result !== 'granted') {
                const cookieId = getVisitorId()
                await fetch('/api/track', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        visitor_cookie_id: cookieId,
                        event_type: 'push_denied',
                        metadata: {
                            permission: result,
                            soft_prompt_reason: promptContent.reason,
                        },
                    }),
                }).catch(() => null)

                setIsWaitingForNative(false)
                handleDismiss(false)
                return
            }

            setIsWaitingForNative(false)

            const swRegistration = await navigator.serviceWorker.register('/sw.js')
            await navigator.serviceWorker.ready

            const existingSubscription = await swRegistration.pushManager.getSubscription()
            const subscription = existingSubscription || await swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
            })

            const cookieId = getVisitorId()
            let dbVisitorId = visitorId

            if (!dbVisitorId) {
                const trackRes = await fetch('/api/track', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        visitor_cookie_id: cookieId,
                        event_type: 'push_consent',
                        metadata: {
                            granted: true,
                            soft_prompt_reason: promptContent.reason,
                        },
                    }),
                })
                const trackData = await trackRes.json()
                dbVisitorId = trackData.visitor_id
            } else {
                await fetch('/api/track', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        visitor_cookie_id: cookieId,
                        event_type: 'push_consent',
                        metadata: {
                            granted: true,
                            soft_prompt_reason: promptContent.reason,
                        },
                    }),
                }).catch(() => null)
            }

            if (dbVisitorId) {
                const saveRes = await fetch('/api/push/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        visitor_id: dbVisitorId,
                        subscription: subscription.toJSON(),
                    }),
                })

                if (!saveRes.ok) {
                    const data = await saveRes.json().catch(() => ({}))
                    console.error('[PushTrigger] Failed to save subscription:', data?.error || saveRes.status)
                }
            }
        } catch (error) {
            console.error('[PushTrigger] Error:', error)
        } finally {
            window.clearTimeout(timeout)
            setIsSubscribing(false)
            setIsWaitingForNative(false)
            handleDismiss(false)
        }
    }

    if (!show) return null

    return (
        <>
            {isWaitingForNative && (
                <div className="push-native-guide">
                    {!isMobile && (
                        <div className="push-native-arrow" aria-hidden="true">
                            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" transform="rotate(-45)">
                                <path d="M12 5V19M12 5L6 11M12 5L18 11" stroke="#c9a96e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    )}

                    <div className="push-native-card">
                        <div className="push-native-symbol" aria-hidden="true">^</div>
                        <h2>Quase la</h2>
                        <p>
                            {isMobile
                                ? "Toque em Permitir na janela do navegador para confirmar seus alertas VIP."
                                : "Clique em Permitir no aviso do navegador para ativar seus alertas VIP."}
                        </p>
                    </div>
                </div>
            )}

            {!isWaitingForNative && (
                <>
                    <div className="push-backdrop" onClick={() => handleDismiss()} />

                    <div className={`push-card-wrap ${isDismissed ? 'is-dismissed' : ''}`}>
                        <div className="push-card">
                            <div className="push-card-bar" />
                            <button type="button" className="push-close" onClick={() => handleDismiss()} aria-label="Fechar convite de notificacao">
                                x
                            </button>

                            <div className="push-card-head">
                                <div className="push-icon" aria-hidden="true">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                                        <circle cx="18" cy="4" r="3" fill="#ef4444" stroke="#ef4444" />
                                    </svg>
                                </div>
                                <span>Acesso VIP</span>
                            </div>

                            <h3>{promptContent.title}</h3>
                            <p>{promptContent.body}</p>

                            <button type="button" className="push-enable" onClick={handleEnable} disabled={isSubscribing}>
                                {isSubscribing ? 'Ativando...' : promptContent.cta}
                            </button>

                            <button type="button" className="push-later" onClick={() => handleDismiss()}>
                                Agora nao
                            </button>
                        </div>
                    </div>
                </>
            )}

            <style jsx>{`
                .push-native-guide {
                    align-items: center;
                    animation: pushFadeIn 0.3s ease-out;
                    background: rgba(0, 0, 0, 0.85);
                    display: flex;
                    flex-direction: column;
                    inset: 0;
                    justify-content: ${isMobile ? 'center' : 'flex-start'};
                    padding: ${isMobile ? '20px' : '80px 40px'};
                    position: fixed;
                    text-align: center;
                    z-index: 10000;
                }
                .push-native-arrow {
                    animation: pushPulseArrow 1.5s infinite ease-in-out;
                    left: 120px;
                    position: absolute;
                    top: 20px;
                    z-index: 10001;
                }
                .push-native-card {
                    background: #1a1a1a;
                    border: 2px solid #c9a96e;
                    border-radius: 24px;
                    box-shadow: 0 0 50px rgba(201, 169, 110, 0.3);
                    margin-top: ${isMobile ? '0' : '100px'};
                    max-width: 450px;
                    padding: 32px 24px;
                }
                .push-native-symbol {
                    animation: pushBounce 2s infinite;
                    color: #c9a96e;
                    font-size: 2rem;
                    font-weight: 900;
                    margin-bottom: 16px;
                }
                .push-native-card h2 {
                    color: #fff;
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: 1.5rem;
                    line-height: 1.3;
                    margin: 0 0 16px;
                }
                .push-native-card p {
                    color: rgba(255,255,255,0.9);
                    font-size: 1.02rem;
                    line-height: 1.6;
                    margin: 0;
                }
                .push-backdrop {
                    animation: ${isDismissed ? 'pushFadeOut 0.4s ease-out forwards' : 'pushFadeIn 0.3s ease-out'};
                    background: rgba(0, 0, 0, 0.25);
                    cursor: pointer;
                    inset: 0;
                    position: fixed;
                    z-index: 9997;
                }
                .push-card-wrap {
                    animation: pushSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                    bottom: 24px;
                    left: 50%;
                    max-width: 400px;
                    position: fixed;
                    transform: translateX(-50%);
                    width: calc(100% - 32px);
                    z-index: 9998;
                }
                .push-card-wrap.is-dismissed {
                    animation: pushSlideOut 0.4s ease-in forwards;
                }
                .push-card {
                    background: linear-gradient(145deg, #1a1a1a 0%, #2d2d2d 100%);
                    border-radius: 20px;
                    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.06);
                    overflow: hidden;
                    padding: 28px 24px 24px;
                    position: relative;
                }
                .push-card-bar {
                    background: linear-gradient(90deg, #c9a96e, #e8d5a8, #c9a96e);
                    height: 3px;
                    inset: 0 0 auto;
                    position: absolute;
                }
                .push-close {
                    align-items: center;
                    background: rgba(255,255,255,0.08);
                    border: 0;
                    border-radius: 50%;
                    color: rgba(255,255,255,0.5);
                    cursor: pointer;
                    display: flex;
                    font-size: 16px;
                    height: 28px;
                    justify-content: center;
                    position: absolute;
                    right: 12px;
                    top: 12px;
                    width: 28px;
                }
                .push-card-head {
                    align-items: center;
                    display: flex;
                    gap: 12px;
                    margin-bottom: 16px;
                }
                .push-icon {
                    align-items: center;
                    background: linear-gradient(135deg, #c9a96e, #b08a45);
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(201, 169, 110, 0.3);
                    display: flex;
                    flex: 0 0 auto;
                    height: 44px;
                    justify-content: center;
                    width: 44px;
                }
                .push-card-head span {
                    background: rgba(201, 169, 110, 0.15);
                    border: 1px solid rgba(201, 169, 110, 0.25);
                    border-radius: 20px;
                    color: #c9a96e;
                    font-size: 0.7rem;
                    font-weight: 700;
                    letter-spacing: 0.05em;
                    padding: 3px 10px;
                    text-transform: uppercase;
                }
                .push-card h3 {
                    color: #fff;
                    font-family: Georgia, serif;
                    font-size: 1.15rem;
                    font-weight: 700;
                    line-height: 1.3;
                    margin: 0 0 8px;
                }
                .push-card p {
                    color: rgba(255, 255, 255, 0.62);
                    font-size: 0.85rem;
                    line-height: 1.6;
                    margin: 0 0 20px;
                }
                .push-enable {
                    align-items: center;
                    background: linear-gradient(135deg, #c9a96e, #b08a45);
                    border: 0;
                    border-radius: 12px;
                    box-shadow: 0 4px 14px rgba(201, 169, 110, 0.3);
                    color: #1a1a1a;
                    cursor: pointer;
                    display: flex;
                    font-size: 0.95rem;
                    font-weight: 800;
                    justify-content: center;
                    min-height: 46px;
                    padding: 0 20px;
                    width: 100%;
                }
                .push-enable:disabled {
                    background: rgba(201, 169, 110, 0.3);
                    box-shadow: none;
                    cursor: not-allowed;
                }
                .push-later {
                    background: none;
                    border: 0;
                    color: rgba(255, 255, 255, 0.32);
                    cursor: pointer;
                    font-size: 0.78rem;
                    padding: 10px 0 0;
                    width: 100%;
                }
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
