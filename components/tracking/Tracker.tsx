'use client'

import { useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'

const COOKIE_NAME = 'pilger_visitor_id'
const COOKIE_DAYS = 30

function getCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
    return match ? decodeURIComponent(match[2]) : null
}

function setCookie(name: string, value: string, days: number) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString()
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

interface TrackerProps {
    landingPageSlug?: string
    onVisitorReady?: (visitorId: string) => void
}

export default function Tracker({ landingPageSlug, onVisitorReady }: TrackerProps) {
    const tracked = useRef(false)

    useEffect(() => {
        if (tracked.current) return
        tracked.current = true

        const track = async () => {
            let cookieId = getCookie(COOKIE_NAME)
            if (!cookieId) {
                cookieId = uuidv4()
                setCookie(COOKIE_NAME, cookieId, COOKIE_DAYS)
            }

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
                    onVisitorReady(data.visitor_id)
                }
            } catch (error) {
                console.error('Tracking error:', error)
            }
        }

        track()
    }, [landingPageSlug, onVisitorReady])

    return null
}
