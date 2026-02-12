'use client'

import { useState, useEffect } from 'react'

interface ExitIntentProps {
    onAccept?: () => void
}

export default function ExitIntentModal({ onAccept }: ExitIntentProps) {
    const [show, setShow] = useState(false)
    const [dismissed, setDismissed] = useState(false)

    useEffect(() => {
        const handleMouseLeave = (e: MouseEvent) => {
            if (e.clientY <= 0 && !dismissed) {
                setShow(true)
            }
        }

        document.addEventListener('mouseleave', handleMouseLeave)
        return () => document.removeEventListener('mouseleave', handleMouseLeave)
    }, [dismissed])

    const handleDismiss = () => {
        setShow(false)
        setDismissed(true)
    }

    const handleAccept = () => {
        setShow(false)
        setDismissed(true)
        onAccept?.()
    }

    if (!show) return null

    return (
        <div className="exit-modal-overlay" onClick={handleDismiss}>
            <div className="exit-modal" onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🏠</div>
                <h2>Não perca esta oportunidade!</h2>
                <p>
                    Gostaria de ser avisado quando este imóvel tiver uma condição especial
                    ou redução de preço?
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button className="btn btn-gold" onClick={handleAccept}>
                        Sim, me avise!
                    </button>
                    <button className="btn btn-outline" onClick={handleDismiss}>
                        Não, obrigado
                    </button>
                </div>
            </div>
        </div>
    )
}
