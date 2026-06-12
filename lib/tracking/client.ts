import { v4 as uuidv4 } from 'uuid'
import { buildMetaCustomData, resolveMetaEventName, type MetaEventName } from '@/lib/tracking/meta-events'

const COOKIE_NAME = 'pilger_visitor_id'
const CONSENT_COOKIE_NAME = 'pilger_consent'
const TRACKING_DISABLED_COOKIE_NAME = 'pilger_tracking_disabled'
const COOKIE_DAYS = 365

declare global {
    interface Window {
        fbq?: (...args: any[]) => void
    }
}

type PushIntentPayload = {
    reason: string
    title: string
    body: string
    cta?: string
}

const PUSH_INTENT_EVENTS = new Set([
    'home_map_search_submitted',
    'home_search_submitted',
    'property_favorited',
    'property_details_clicked',
    'property_feed_similar_clicked',
    'property_map_popup_opened',
])

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

export function deleteCookie(name: string) {
    if (typeof document === 'undefined') return
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`
}

export function isTrackingDisabled(): boolean {
    return getCookie(TRACKING_DISABLED_COOKIE_NAME) === 'true'
}

export function hasConsent(): boolean {
    return !isTrackingDisabled() && !!getCookie(CONSENT_COOKIE_NAME)
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
    deleteCookie(TRACKING_DISABLED_COOKIE_NAME)
    setCookie(CONSENT_COOKIE_NAME, 'true', 365)
    const id = getVisitorId()
    setCookie(COOKIE_NAME, id, COOKIE_DAYS)

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('pilger_consent_granted'))
    }
}

export function createMetaEventId(prefix = 'meta'): string {
    return `${prefix}_${Date.now()}_${uuidv4()}`
}

export function getMetaBrowserData() {
    return {
        meta_fbp: getCookie('_fbp') || undefined,
        meta_fbc: getCookie('_fbc') || undefined,
    }
}

export function trackMetaPixelEvent(
    eventName: MetaEventName,
    metadata: Record<string, unknown> = {},
    eventId = createMetaEventId(eventName.toLowerCase())
) {
    const browserData = getMetaBrowserData()
    const metaMetadata = {
        meta_event_name: eventName,
        meta_event_id: eventId,
        ...browserData,
    }

    try {
        if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
            window.fbq('track', eventName, buildMetaCustomData(eventName, metadata), { eventID: eventId })
        }
    } catch (error) {
        console.warn('[Meta Pixel] event skipped:', error)
    }

    return metaMetadata
}

function trackMappedMetaPixelEvent(eventType: string, metadata: Record<string, unknown>) {
    const eventName = resolveMetaEventName(eventType)
    return eventName ? trackMetaPixelEvent(eventName, metadata) : {}
}

export function revokeConsent() {
    setCookie(TRACKING_DISABLED_COOKIE_NAME, 'true', COOKIE_DAYS)
    deleteCookie(CONSENT_COOKIE_NAME)

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('pilger_consent_revoked'))
    }
}

function maybeDispatchPushIntent(eventType: string, metadata: any) {
    if (typeof window === 'undefined') return

    let payload: PushIntentPayload | null = null
    const title = typeof metadata?.title === 'string' ? metadata.title : ''

    if (eventType === 'property_feed_slide_viewed') {
        const key = 'pilger_property_feed_views'
        const views = Number(sessionStorage.getItem(key) || '0') + 1
        sessionStorage.setItem(key, String(views))
        if (views === 3) {
            payload = {
                reason: eventType,
                title: 'Quer receber alertas da curadoria?',
                body: 'Voce ja esta explorando boas oportunidades. Avisamos quando surgir outro imovel alinhado ao seu perfil.',
                cta: 'Ativar alertas VIP',
            }
        }
    }

    if (!payload && PUSH_INTENT_EVENTS.has(eventType)) {
        if (eventType === 'property_favorited') {
            payload = {
                reason: eventType,
                title: 'Quer acompanhar este tipo de imovel?',
                body: title
                    ? `Avisamos quando surgir uma oportunidade parecida com ${title}.`
                    : 'Avisamos quando surgir uma oportunidade parecida com o imovel que voce acabou de curtir.',
                cta: 'Receber parecidos',
            }
        } else if (eventType === 'property_details_clicked') {
            payload = {
                reason: eventType,
                title: 'Receba novidades deste perfil',
                body: title
                    ? `Se aparecer algo parecido com ${title}, voce recebe o aviso antes de perder a oportunidade.`
                    : 'Se aparecer algo parecido com este imovel, voce recebe o aviso antes de perder a oportunidade.',
                cta: 'Ativar alerta',
            }
        } else if (eventType === 'property_feed_similar_clicked') {
            payload = {
                reason: eventType,
                title: 'Encontramos imoveis parecidos',
                body: 'Ative os alertas para ser avisado quando entrar uma oportunidade semelhante.',
                cta: 'Quero ser avisado',
            }
        } else if (eventType === 'home_map_search_submitted' || eventType === 'home_search_submitted') {
            payload = {
                reason: eventType,
                title: 'Salve sua busca de luxo',
                body: 'Avisamos quando surgir imovel dentro do perfil que voce acabou de pesquisar.',
                cta: 'Salvar alerta VIP',
            }
        } else if (eventType === 'property_map_popup_opened') {
            payload = {
                reason: eventType,
                title: 'Quer receber alertas da regiao?',
                body: 'Quando aparecer uma oportunidade proxima ou parecida, voce recebe o aviso direto no navegador.',
                cta: 'Ativar alertas',
            }
        }
    }

    if (!payload) return
    window.dispatchEvent(new CustomEvent('pilger_push_intent', { detail: payload }))
}

export async function trackEvent(eventType: string, metadata: any = {}) {
    // Auto-consent: always track (consent is granted automatically on page load)
    if (isTrackingDisabled() && eventType !== 'privacy_opt_out') return

    const visitorId = getVisitorId()
    const landingPageSlug = window.location.pathname.split('/')[1] || 'home' // Crude, but works for now. MainTracker passes it better.
    const pageMetadata = {
        page_path: window.location.pathname,
        page_url: window.location.href,
        page_title: document.title,
    }
    const mergedMetadata = {
        ...pageMetadata,
        ...metadata,
    }
    const metaMetadata = trackMappedMetaPixelEvent(eventType, mergedMetadata)

    try {
        await fetch('/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
            body: JSON.stringify({
                visitor_cookie_id: visitorId,
                landing_page_slug: landingPageSlug, // context might be missing here if not passed, but API handles slug lookup
                referrer: document.referrer,
                search_params: window.location.search,
                event_type: eventType,
                metadata: {
                    ...mergedMetadata,
                    ...metaMetadata,
                }
            }),
        })
        maybeDispatchPushIntent(eventType, metadata)
    } catch (error) {
        console.error('Track Event Error:', error)
    }
}

export async function trackChatOpened(landingPageSlug?: string, metadata: any = {}) {
    const visitorId = getVisitorId()
    const slug = landingPageSlug || window.location.pathname.split('/')[1] || 'home'
    const pageMetadata = {
        page_path: window.location.pathname,
        page_url: window.location.href,
        page_title: document.title,
    }
    const mergedMetadata = {
        channel: 'whatsapp',
        ...pageMetadata,
        ...metadata,
    }
    const metaMetadata = trackMappedMetaPixelEvent('chat_opened', mergedMetadata)

    try {
        await fetch('/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
            body: JSON.stringify({
                visitor_cookie_id: visitorId,
                landing_page_slug: slug,
                referrer: document.referrer,
                search_params: window.location.search,
                event_type: 'chat_opened',
                metadata: {
                    ...mergedMetadata,
                    ...metaMetadata,
                },
            }),
        })
    } catch (error) {
        console.error('Track chat_opened error:', error)
    }
}
