'use client'

import { useState, useEffect } from 'react'
import Tracker from '@/components/tracking/Tracker'
import UnifiedConsentBanner from '@/components/tracking/UnifiedConsentBanner'
import GeoCapturePrompt from '@/components/tracking/GeoCapturePrompt'
import PushConsent from '@/components/push/PushConsent'
import { hasConsent, isTrackingDisabled } from '@/lib/tracking/client'
import PixelInjector from '@/components/tracking/PixelInjector'

interface MainTrackerProps {
    landingPageSlug?: string
}

export default function MainTracker({ landingPageSlug }: MainTrackerProps) {
    const [consent, setConsent] = useState(() => !isTrackingDisabled() && hasConsent())
    const [visitorId, setVisitorId] = useState<string | undefined>()
    const [vapidPublicKey, setVapidPublicKey] = useState<string | undefined>()
    const [trackingConfig, setTrackingConfig] = useState<{
        metaPixelId?: string
        googleAnalyticsId?: string
        googleAdsId?: string
    } | null>(null)

    useEffect(() => {
        const handleConsent = () => setConsent(true)
        const handleRevoke = () => setConsent(false)
        if (typeof window !== 'undefined') {
            window.addEventListener('pilger_consent_granted', handleConsent)
            window.addEventListener('pilger_consent_revoked', handleRevoke)
            return () => {
                window.removeEventListener('pilger_consent_granted', handleConsent)
                window.removeEventListener('pilger_consent_revoked', handleRevoke)
            }
        }
    }, [])

    useEffect(() => {
        if (!consent || trackingConfig) return

        fetch('/api/public/tracking-config', { cache: 'no-store' })
            .then(response => response.ok ? response.json() : null)
            .then(payload => {
                if (!payload) return
                setTrackingConfig({
                    metaPixelId: payload.metaPixelId || undefined,
                    googleAnalyticsId: payload.googleAnalyticsId || undefined,
                    googleAdsId: payload.googleAdsId || undefined,
                })
            })
            .catch(() => setTrackingConfig({}))
    }, [consent, trackingConfig])

    return (
        <>
            {consent && trackingConfig && (
                <PixelInjector
                    metaPixelId={trackingConfig.metaPixelId}
                    googleAnalyticsId={trackingConfig.googleAnalyticsId}
                    googleAdsId={trackingConfig.googleAdsId}
                />
            )}
            {consent && (
                <Tracker
                    landingPageSlug={landingPageSlug}
                    onVisitorReady={(id, key) => {
                        setVisitorId(id)
                        if (key) setVapidPublicKey(key)
                    }}
                />
            )}
            <UnifiedConsentBanner />
            {consent && <GeoCapturePrompt visitorId={visitorId} />}
            {consent && <PushConsent visitorId={visitorId} vapidPublicKey={vapidPublicKey} />}
        </>
    )
}

