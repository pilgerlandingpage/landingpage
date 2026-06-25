'use client'

import { useEffect, useState } from 'react'
import { grantConsent, isTrackingDisabled, revokeConsent, trackEvent } from '@/lib/tracking/client'

async function unsubscribePush() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    try {
        const registration = await navigator.serviceWorker.getRegistration('/sw.js')
        const subscription = await registration?.pushManager.getSubscription()
        await subscription?.unsubscribe()
    } catch {
        // Push unsubscribe is best-effort; cookie opt-out still stops site tracking.
    }
}

export default function PrivacyControls() {
    const [disabled, setDisabled] = useState(false)

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            setDisabled(isTrackingDisabled())
        })
        return () => window.cancelAnimationFrame(frame)
    }, [])

    const handleDisable = async () => {
        await trackEvent('privacy_opt_out', { source: 'privacy_policy_page' })
        revokeConsent()
        await unsubscribePush()
        setDisabled(true)
    }

    const handleEnable = () => {
        grantConsent()
        setDisabled(false)
    }

    return (
        <section className="privacy-controls">
            <h2>Controle de rastreamento</h2>
            <p>
                Você pode pausar a coleta de eventos deste navegador. Isso não apaga históricos legais ou conversas já registradas,
                mas impede novos eventos anonimos deste dispositivo enquanto estiver desativado.
            </p>
            <button type="button" onClick={disabled ? handleEnable : handleDisable}>
                {disabled ? 'Reativar rastreamento neste navegador' : 'Pausar rastreamento neste navegador'}
            </button>
            <small>{disabled ? 'Rastreamento pausado neste navegador.' : 'Rastreamento ativo neste navegador.'}</small>

            <style jsx>{`
                .privacy-controls {
                    margin-top: 24px;
                    padding: 18px;
                    border: 1px solid rgba(184,148,95,0.24);
                    border-radius: 12px;
                    background: #fffaf0;
                }
                .privacy-controls h2 {
                    margin: 0 0 8px;
                    color: #211c16;
                    font-size: 1.05rem;
                }
                .privacy-controls p {
                    margin: 0 0 14px;
                    color: #5f574b;
                    line-height: 1.6;
                }
                .privacy-controls button {
                    min-height: 40px;
                    padding: 0 14px;
                    border: 0;
                    border-radius: 8px;
                    background: #171410;
                    color: #fff8ea;
                    cursor: pointer;
                    font-weight: 800;
                }
                .privacy-controls small {
                    display: block;
                    margin-top: 10px;
                    color: #746858;
                    font-weight: 700;
                }
            `}</style>
        </section>
    )
}
