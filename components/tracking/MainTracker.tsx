'use client'

import { useState } from 'react'
import Tracker from '@/components/tracking/Tracker'
import PushConsent from '@/components/push/PushConsent'

interface MainTrackerProps {
    landingPageSlug?: string
}

export default function MainTracker({ landingPageSlug }: MainTrackerProps) {
    const [visitorId, setVisitorId] = useState<string | undefined>()
    const [vapidKey, setVapidKey] = useState<string | undefined>()

    return (
        <>
            <Tracker
                landingPageSlug={landingPageSlug}
                onVisitorReady={(id, key) => {
                    setVisitorId(id)
                    setVapidKey(key)
                }}
            />
            {visitorId && <PushConsent visitorId={visitorId} vapidPublicKey={vapidKey} />}
        </>
    )
}
