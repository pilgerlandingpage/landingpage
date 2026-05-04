import { getPublicAppUrl } from '@/lib/app-url'
import { normalizeWhatsAppPhone } from '@/lib/whatsapp/lead-sync'

type TrackedWhatsAppLinkOptions = {
    url: string
    leadPhone?: string | null
    label?: string | null
    title?: string | null
    type?: string | null
    campaign?: string | null
    content?: string | null
    source?: string | null
    medium?: string | null
}

function slug(value: string): string {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
}

export function inferWhatsAppLinkType(rawUrl: string, fallback?: string | null): string {
    const labelType = slug(String(fallback || ''))
    if (labelType.includes('instagram')) return 'instagram'
    if (labelType.includes('facebook')) return 'facebook'
    if (labelType.includes('youtube') || labelType.includes('video')) return 'youtube'
    if (labelType.includes('tiktok') || labelType.includes('tik_tok')) return 'tiktok'
    if (labelType.includes('linkedin')) return 'linkedin'
    if (labelType.includes('localizacao') || labelType.includes('como_chegar') || labelType.includes('maps')) return 'location'
    if (labelType.includes('site')) return 'site'
    if (labelType.includes('imovel')) return 'property'

    try {
        const parsed = new URL(rawUrl)
        if (/\/imovel\//i.test(parsed.pathname)) return 'property'
        const host = parsed.hostname.toLowerCase()
        if (host.includes('instagram.')) return 'instagram'
        if (host.includes('facebook.') || host.includes('fb.')) return 'facebook'
        if (host.includes('youtube.') || host.includes('youtu.be')) return 'youtube'
        if (host.includes('tiktok.')) return 'tiktok'
        if (host.includes('linkedin.')) return 'linkedin'
        if (host.includes('maps.') || host.includes('goo.gl')) return 'location'
    } catch { }

    return labelType || 'link'
}

export function whatsappClickEventType(linkType: string): string {
    const safeType = slug(linkType || 'link') || 'link'
    if (safeType === 'property' || safeType === 'imovel') return 'whatsapp_property_click'
    return `whatsapp_${safeType}_click`
}

export function buildTrackedWhatsAppLink(options: TrackedWhatsAppLinkOptions): string {
    const rawUrl = String(options.url || '').trim()
    if (!/^https?:\/\//i.test(rawUrl)) return rawUrl

    try {
        const destination = new URL(rawUrl)
        if (destination.pathname === '/api/track' && destination.searchParams.get('redirect')) {
            return destination.toString()
        }

        const linkType = inferWhatsAppLinkType(destination.toString(), options.type || options.label || options.title)
        const source = options.source || 'whatsapp_agent'
        const medium = options.medium || 'whatsapp'
        const campaign = options.campaign || (
            linkType === 'property' ? 'property_recommendation' : `${linkType}_button`
        )
        const phone = normalizeWhatsAppPhone(options.leadPhone)
        const appUrl = new URL(getPublicAppUrl())

        // For internal links, just append UTMs directly to avoid URL length limits in WhatsApp Buttons
        if (destination.hostname === appUrl.hostname) {
            destination.searchParams.set('utm_source', source)
            destination.searchParams.set('utm_medium', medium)
            destination.searchParams.set('utm_campaign', campaign)
            if (options.content) destination.searchParams.set('utm_content', String(options.content))
            if (phone) destination.searchParams.set('lead_phone', phone)
            // Optional but helps our tracker know what event triggered this
            destination.searchParams.set('event_type', whatsappClickEventType(linkType))
            
            return destination.toString()
        }

        // For external links, use the redirect wrapper
        destination.searchParams.set('utm_source', source)
        destination.searchParams.set('utm_medium', medium)
        destination.searchParams.set('utm_campaign', campaign)
        if (options.content) destination.searchParams.set('utm_content', String(options.content))

        const trackingUrl = new URL('/api/track', getPublicAppUrl())
        trackingUrl.searchParams.set('redirect', destination.toString())
        trackingUrl.searchParams.set('event_type', whatsappClickEventType(linkType))
        trackingUrl.searchParams.set('link_type', linkType)
        if (options.label) trackingUrl.searchParams.set('link_label', String(options.label).slice(0, 80))
        if (options.title) trackingUrl.searchParams.set('link_title', String(options.title).slice(0, 80))
        trackingUrl.searchParams.set('utm_source', source)
        trackingUrl.searchParams.set('utm_medium', medium)
        trackingUrl.searchParams.set('utm_campaign', campaign)
        if (options.content) trackingUrl.searchParams.set('utm_content', String(options.content))
        if (phone) trackingUrl.searchParams.set('lead_phone', phone)

        return trackingUrl.toString()
    } catch {
        return rawUrl
    }
}
