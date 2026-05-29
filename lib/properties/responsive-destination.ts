export const PROPERTY_DESKTOP_DETAIL_QUERY = '(min-width: 820px)'

type PlainClickLike = {
    button?: number
    defaultPrevented?: boolean
    metaKey?: boolean
    ctrlKey?: boolean
    shiftKey?: boolean
    altKey?: boolean
}

export function propertyFeedPath(propertyId: string) {
    return `/imovel/${propertyId}`
}

export function propertyDetailsPath(propertyId: string) {
    return `/imovel/${propertyId}/detalhes`
}

export function shouldOpenPropertyDetailsOnDesktop() {
    return typeof window !== 'undefined' && window.matchMedia(PROPERTY_DESKTOP_DETAIL_QUERY).matches
}

export function propertyDestinationForViewport(propertyId: string) {
    return shouldOpenPropertyDetailsOnDesktop() ? propertyDetailsPath(propertyId) : propertyFeedPath(propertyId)
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
