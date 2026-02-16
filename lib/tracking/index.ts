import { v4 as uuidv4 } from 'uuid'

export interface VisitorData {
    visitor_cookie_id: string
    landing_page_id?: string
    ip_address: string
    user_agent: string
    device_type: string
    browser: string
    os: string
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
    utm_term?: string
    utm_content?: string
    referrer?: string
    fbclid?: string
    gclid?: string
    detected_source?: string
    country?: string
    city?: string
    region?: string
}

export function parseUserAgent(ua: string): { browser: string; os: string; device_type: string } {
    const browser =
        ua.includes('Edg/') ? 'Edge' :
            ua.includes('OPR/') || ua.includes('Opera') ? 'Opera' :
                ua.includes('Chrome') ? 'Chrome' :
                    ua.includes('Safari') ? 'Safari' :
                        ua.includes('Firefox') ? 'Firefox' :
                            ua.includes('MSIE') || ua.includes('Trident') ? 'IE' : 'Other'

    const os =
        ua.includes('Windows') ? 'Windows' :
            ua.includes('Mac OS') ? 'macOS' :
                ua.includes('iPhone') || ua.includes('iPad') ? 'iOS' :
                    ua.includes('Android') ? 'Android' :
                        ua.includes('Linux') ? 'Linux' : 'Other'

    const device_type =
        ua.includes('Mobi') || ua.includes('Android') && !ua.includes('Tablet') ? 'mobile' :
            ua.includes('Tablet') || ua.includes('iPad') ? 'tablet' : 'desktop'

    return { browser, os, device_type }
}

export function detectSource(referrer: string, utmSource?: string, fbclid?: string, gclid?: string): string {
    if (utmSource) {
        const s = utmSource.toLowerCase()
        if (s.includes('facebook') || s.includes('fb')) return 'Facebook'
        if (s.includes('instagram') || s.includes('ig')) return 'Instagram'
        if (s.includes('google')) return 'Google'
        if (s.includes('linkedin')) return 'LinkedIn'
        if (s.includes('youtube') || s.includes('yt')) return 'YouTube'
        if (s.includes('tiktok')) return 'TikTok'
        if (s.includes('whatsapp') || s.includes('wpp')) return 'WhatsApp'
        if (s.includes('twitter') || s.includes('x.com')) return 'Twitter/X'
        return utmSource
    }

    if (fbclid) return 'Facebook Ads'
    if (gclid) return 'Google Ads'

    if (referrer) {
        const r = referrer.toLowerCase()
        if (r.includes('facebook.com') || r.includes('fb.com')) return 'Facebook'
        if (r.includes('instagram.com')) return 'Instagram'
        if (r.includes('google.')) return 'Google'
        if (r.includes('linkedin.com')) return 'LinkedIn'
        if (r.includes('youtube.com')) return 'YouTube'
        if (r.includes('tiktok.com')) return 'TikTok'
        if (r.includes('whatsapp.com') || r.includes('wa.me')) return 'WhatsApp'
        if (r.includes('twitter.com') || r.includes('x.com') || r.includes('t.co')) return 'Twitter/X'
    }

    return 'Direct'
}

export function generateVisitorId(): string {
    return uuidv4()
}

export function extractTrackingData(
    headers: Headers,
    searchParams: URLSearchParams,
    referrer?: string
): VisitorData {
    const ip = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || headers.get('x-real-ip')
        || '0.0.0.0'

    const ua = headers.get('user-agent') || ''
    const { browser, os, device_type } = parseUserAgent(ua)

    const utm_source = searchParams.get('utm_source') || undefined
    const utm_medium = searchParams.get('utm_medium') || undefined
    const utm_campaign = searchParams.get('utm_campaign') || undefined
    const utm_term = searchParams.get('utm_term') || undefined
    const utm_content = searchParams.get('utm_content') || undefined
    const fbclid = searchParams.get('fbclid') || undefined
    const gclid = searchParams.get('gclid') || undefined



    const detected_source = detectSource(referrer || '', utm_source, fbclid, gclid)

    // Vercel / Cloudflare Geolocation Headers
    const country = headers.get('x-vercel-ip-country') || headers.get('cf-ipcountry') || 'BR'
    const city = headers.get('x-vercel-ip-city') || headers.get('cf-ipcity') || undefined
    const region = headers.get('x-vercel-ip-country-region') || undefined

    return {
        visitor_cookie_id: '', // will be set by the caller
        ip_address: ip,
        user_agent: ua,
        device_type,
        browser,
        os,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_term,
        utm_content,
        referrer,
        fbclid,
        gclid,
        detected_source,
        country,
        city,
        region
    }
}
