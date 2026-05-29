'use client'

import { useEffect, useRef } from 'react'
import { getVisitorId, isTrackingDisabled } from '@/lib/tracking/client'

interface TrackerProps {
    landingPageSlug?: string
    onVisitorReady?: (visitorId: string, vapidPublicKey?: string) => void
}

export default function Tracker({ landingPageSlug, onVisitorReady }: TrackerProps) {
    const tracked = useRef(false)
    const scrollMilestones = useRef(new Set<number>())

    useEffect(() => {
        if (isTrackingDisabled()) return

        const cookieId = getVisitorId()
        const pageMetadata = () => ({
            page_path: window.location.pathname,
            page_url: window.location.href,
            page_title: document.title,
        })

        const trackEvent = async (eventType: string, metadata: any = {}) => {
            if (isTrackingDisabled()) return

            try {
                await fetch('/api/track', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        visitor_cookie_id: cookieId,
                        landing_page_slug: landingPageSlug,
                        event_type: eventType,
                        metadata: {
                            ...pageMetadata(),
                            ...metadata,
                        }
                    }),
                })
            } catch (e) {
                console.error('[Tracker] Event error:', e)
            }
        }

        if (!tracked.current) {
            tracked.current = true
            const trackInit = async () => {
                try {
                    const response = await fetch('/api/track', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            visitor_cookie_id: cookieId,
                            landing_page_slug: landingPageSlug,
                            referrer: document.referrer,
                            search_params: window.location.search,
                            metadata: pageMetadata(),
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
            trackInit()
        }

        // Scroll Depth Tracking
        let timeout: NodeJS.Timeout
        const handleScroll = () => {
            clearTimeout(timeout)
            timeout = setTimeout(() => {
                const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
                if (scrollHeight <= 0) return

                const scrollPercent = Math.round((window.scrollY / scrollHeight) * 100)
                const milestones = [25, 50, 75, 90]

                milestones.forEach(m => {
                    if (scrollPercent >= m && !scrollMilestones.current.has(m)) {
                        scrollMilestones.current.add(m)
                        trackEvent('scroll_depth', { percentage: m, page: landingPageSlug || 'home' })
                    }
                })
            }, 500) // Debounce 500ms
        }

        window.addEventListener('scroll', handleScroll)
        return () => {
            window.removeEventListener('scroll', handleScroll)
            clearTimeout(timeout)
        }
    }, [landingPageSlug, onVisitorReady])

    return null
}
