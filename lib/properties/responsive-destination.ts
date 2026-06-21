export const PROPERTY_DESKTOP_DETAIL_QUERY = '(min-width: 820px)'

type PropertyRouteInput = string | {
    id?: string | null
    source_slug?: string | null
    slug?: string | null
    title?: string | null
    seo_title?: string | null
    property_type?: string | null
}

type PlainClickLike = {
    button?: number
    defaultPrevented?: boolean
    metaKey?: boolean
    ctrlKey?: boolean
    shiftKey?: boolean
    altKey?: boolean
}

function slugifyPropertySegment(value?: string | null, fallback = 'imovel') {
    const slug = String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-')

    return slug || fallback
}

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export function propertyDetailsSegment(property: PropertyRouteInput) {
    if (typeof property === 'string') return property

    const publicSlug = slugifyPropertySegment(property.source_slug || property.slug || '')
    if (publicSlug && publicSlug !== 'imovel' && !isUuid(publicSlug)) return publicSlug

    const id = String(property.id || '').trim()
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
