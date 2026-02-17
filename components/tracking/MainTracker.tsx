'use client'

import { useState, useEffect } from 'react'
import Tracker from '@/components/tracking/Tracker'
import UnifiedConsentBanner from '@/components/tracking/UnifiedConsentBanner'
import { hasConsent } from '@/lib/tracking/client'

interface MainTrackerProps {
    landingPageSlug?: string
}

export default function MainTracker({ landingPageSlug }: MainTrackerProps) {
    const [consent, setConsent] = useState(false)
    const [visitorId, setVisitorId] = useState<string | undefined>()

    useEffect(() => {
        setConsent(hasConsent())

        const handleConsent = () => setConsent(true)
        if (typeof window !== 'undefined') {
            window.addEventListener('pilger_consent_granted', handleConsent)
            return () => window.removeEventListener('pilger_consent_granted', handleConsent)
        }
    }, [])

    return (
        <>
            {consent && (
                <Tracker
                    landingPageSlug={landingPageSlug}
                    onVisitorReady={(id) => setVisitorId(id)}
                />
            )}
            <UnifiedConsentBanner />
        </>
    )
}
