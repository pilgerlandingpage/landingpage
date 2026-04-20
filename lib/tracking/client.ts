import { v4 as uuidv4 } from 'uuid'

const COOKIE_NAME = 'pilger_visitor_id'
const CONSENT_COOKIE_NAME = 'pilger_consent'
const COOKIE_DAYS = 365

export function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
    return match ? decodeURIComponent(match[2]) : null
}

export function setCookie(name: string, value: string, days: number) {
    if (typeof document === 'undefined') return
    const expires = new Date(Date.now() + days * 864e5).toUTCString()
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

export function hasConsent(): boolean {
    return !!getCookie(CONSENT_COOKIE_NAME)
}

export function getVisitorId(): string {
    let id = getCookie(COOKIE_NAME)
    if (!id) {
        id = uuidv4()
        setCookie(COOKIE_NAME, id, COOKIE_DAYS)
    }
    return id
}

export function grantConsent() {
    setCookie(CONSENT_COOKIE_NAME, 'true', 365)
    const id = getVisitorId()
    setCookie(COOKIE_NAME, id, COOKIE_DAYS)

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('pilger_consent_granted'))
    }
}

export async function trackEvent(eventType: string, metadata: any = {}) {
    // Auto-consent: always track (consent is granted automatically on page load)

    const visitorId = getVisitorId()
    const landingPageSlug = window.location.pathname.split('/')[1] || 'home' // Crude, but works for now. MainTracker passes it better.

    try {
        await fetch('/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                visitor_cookie_id: visitorId,
                landing_page_slug: landingPageSlug, // context might be missing here if not passed, but API handles slug lookup
                referrer: document.referrer,
                search_params: window.location.search,
                event_type: eventType,
                metadata
            }),
        })
    } catch (error) {
        console.error('Track Event Error:', error)
    }
}

export async function trackChatOpened(landingPageSlug?: string, metadata: any = {}) {
    const visitorId = getVisitorId()
    const slug = landingPageSlug || window.location.pathname.split('/')[1] || 'home'

    try {
        await fetch('/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                visitor_cookie_id: visitorId,
                landing_page_slug: slug,
                referrer: document.referrer,
                search_params: window.location.search,
                event_type: 'chat_opened',
                metadata: {
                    channel: 'whatsapp',
                    ...metadata,
                },
            }),
        })
    } catch (error) {
        console.error('Track chat_opened error:', error)
    }
}
