'use client'

import { useState, useCallback } from 'react'
import Tracker from '@/components/tracking/Tracker'
import ChatWidget from '@/components/chat/ChatWidget'

interface LandingPageLogicProps {
    slug: string
    agentName?: string
    greetingMessage?: string
    landingPageId?: string
}

export default function LandingPageLogic({
    slug,
    agentName,
    greetingMessage,
    landingPageId
}: LandingPageLogicProps) {
    const [visitorId, setVisitorId] = useState<string>('')

    const handleVisitorReady = useCallback((id: string) => {
        setVisitorId(id)
    }, [])

    return (
        <>
            <Tracker landingPageSlug={slug} onVisitorReady={handleVisitorReady} />

            {visitorId && (
                <ChatWidget
                    visitorId={visitorId}
                    agentName={agentName}
                    greetingMessage={greetingMessage}
                    landingPageId={landingPageId}
                />
            )}
        </>
    )
}
