'use client'

import { useEffect, useRef } from 'react'
import { getVisitorId } from '@/lib/tracking/client'

interface TrackerProps {
    landingPageSlug?: string
    onVisitorReady?: (visitorId: string, vapidPublicKey?: string) => void
}

export default function Tracker({ landingPageSlug, onVisitorReady }: TrackerProps) {
    const tracked = useRef(false)

    useEffect(() => {
        if (tracked.current) return
        tracked.current = true

        const track = async () => {
            const cookieId = getVisitorId()

            try {
                const response = await fetch('/api/track', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        visitor_cookie_id: cookieId,
                        landing_page_slug: landingPageSlug,
                        referrer: document.referrer,
                        search_params: window.location.search,
                    }),
                })

                const data = await response.json()
                if (data.visitor_id && onVisitorReady) {
                    onVisitorReady(data.visitor_id, data.vapid_public_key)
                }
            } catch (error) {
                console.error('Tracking error:', error)
            }
        }

        track()
    }, [landingPageSlug, onVisitorReady])

    return null
}
