'use client'

import { useState, useEffect } from 'react'
import { grantConsent, hasConsent } from '@/lib/tracking/client'
import { ShieldCheck } from 'lucide-react'

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
            // 1. Grant Cookie Consent
            grantConsent()

            // 2. Request Push Permission (if supported)
            if ('Notification' in window && 'serviceWorker' in navigator) {
                const permission = await Notification.requestPermission()
                if (permission === 'granted') {
                    // Subscribe logic
                    await subscribeToPush()
                }
            }
        } catch (error) {
            console.error('Consent error:', error)
        } finally {
            setIsProcessing(false)
            setShow(false)
        }
    }

    const subscribeToPush = async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js')
            await navigator.serviceWorker.ready

            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
            if (!vapidKey) return

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey),
            })

            // Initial visitor ID might be freshly created by grantConsent
            const { getVisitorId } = await import('@/lib/tracking/client')
            const visitorId = getVisitorId()

            await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    visitor_id: visitorId,
                    subscription: subscription.toJSON(),
                }),
            })
        } catch (e) {
            console.error('Push subscription failed:', e)
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/10 backdrop-blur-none animate-in fade-in duration-300">
            <div
                className="bg-white rounded-2xl p-8 sm:p-10 max-w-lg w-full relative shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col items-center text-center"
                style={{
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)'
                }}
            >
                <div className="w-16 h-16 rounded-full bg-[#c9a96e] flex items-center justify-center mb-6 shadow-lg shadow-[#c9a96e]/30">
                    <ShieldCheck size={32} className="text-[#1a1a1a]" strokeWidth={1.5} />
                </div>

                <h3 className="text-2xl font-bold text-gray-900 mb-3 font-serif">
                    Termos e Privacidade
                </h3>

                <p className="text-gray-600 mb-8 leading-relaxed text-[0.95rem]">
                    Para garantir sua exclusividade e segurança, aceite nossos termos de uso e política de privacidade para continuar.
                </p>

                <button
                    onClick={handleAccept}
                    disabled={isProcessing}
                    className="w-full py-3.5 px-6 bg-[#c9a96e] hover:bg-[#b0935d] text-[#1a1a1a] font-bold text-lg rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-[#c9a96e]/20 disabled:opacity-70 disabled:cursor-wait mb-4"
                >
                    {isProcessing ? 'Processando...' : 'Aceitar e Continuar'}
                </button>

                <button
                    onClick={() => setShow(false)}
                    className="text-sm text-gray-400 hover:text-gray-600 underline transition-colors"
                >
                    Ler Termos ou Recusar
                </button>
            </div>
        </div>
    )
}
