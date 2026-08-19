import { buildPropertySeoPath, slugifyPropertySegment } from './seo-url'

export const PROPERTY_DESKTOP_DETAIL_QUERY = '(min-width: 820px)'

type PropertyRouteInput = string | {
    id?: string | null
    source_slug?: string | null
    slug?: string | null
    title?: string | null
    seo_title?: string | null
    city?: string | null
    neighborhood?: string | null
    property_type?: string | null
}

type PlainClickLike = {
    button?: number
    defaultPrevented?: boolean
    metaKey?: boolean
    ctrlKey?: boolean
    shiftKey?: boolean
    altKey?: boolean
    preventDefault?: () => void
}

export function propertyDetailsSegment(property: PropertyRouteInput) {
    if (typeof property === 'string') return property

    const id = String(property.id || '').trim()
    if (id) {
        const seoSegment = buildPropertySeoPath(property).split('/').filter(Boolean).pop()
        if (seoSegment) return seoSegment
    }

    const titleSlug = slugifyPropertySegment(
        property.seo_title || property.title || property.property_type,
        'imovel-de-luxo'
    )

    return id ? `${titleSlug}-${id}` : titleSlug
}

export function propertyFeedPath(property: PropertyRouteInput) {
    return propertyDetailsPath(property)
}

export function propertyDetailsPath(property: PropertyRouteInput) {
    if (typeof property !== 'string' && String(property.id || '').trim()) {
        return buildPropertySeoPath(property)
    }

    return `/imovel/${encodeURIComponent(propertyDetailsSegment(property))}/detalhes`
}

export function shouldOpenPropertyDetailsOnDesktop() {
    return typeof window !== 'undefined' && window.matchMedia(PROPERTY_DESKTOP_DETAIL_QUERY).matches
}

export function propertyDestinationForViewport(property: PropertyRouteInput) {
    return propertyDetailsPath(property)
}

export function isPlainLeftClick(event: PlainClickLike) {
    return (
        !event.defaultPrevented &&
        (event.button ?? 0) === 0 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey
    )
}

function markPropertyNavigationPending() {
    document.documentElement.setAttribute('data-property-navigation-pending', 'true')

    window.setTimeout(() => {
        document.documentElement.removeAttribute('data-property-navigation-pending')
    }, 12000)
}

export function openPropertyDestinationOnDesktopClick(event: PlainClickLike, href: string, beforeNavigate?: () => void) {
    if (typeof window === 'undefined') return false
    if (!shouldOpenPropertyDetailsOnDesktop()) return false
    if (!isPlainLeftClick(event)) return false

    event.preventDefault?.()
    markPropertyNavigationPending()
    beforeNavigate?.()
    window.location.assign(new URL(href, window.location.origin).toString())
    return true
}
