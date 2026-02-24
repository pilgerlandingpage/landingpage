'use client'

import { useState, useCallback } from 'react'
import Tracker from '@/components/tracking/Tracker'

interface LandingPageLogicProps {
    slug: string
    agentName?: string
    greetingMessage?: string
    landingPageId?: string
    pageContext?: string
}

export default function LandingPageLogic({
    slug,
    agentName,
    greetingMessage,
    landingPageId,
    pageContext
}: LandingPageLogicProps) {
    const [visitorId, setVisitorId] = useState<string>('')

    const handleVisitorReady = useCallback((id: string) => {
        setVisitorId(id)
    }, [])

    return (
        <>
            <Tracker landingPageSlug={slug} onVisitorReady={handleVisitorReady} />
        </>
    )
}
