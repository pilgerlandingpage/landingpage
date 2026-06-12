export type MetaEventName = 'PageView' | 'ViewContent' | 'Search' | 'Contact' | 'Lead' | 'AddToWishlist'

const META_EVENT_BY_SITE_EVENT: Array<[RegExp, MetaEventName]> = [
    [/^page_view$/, 'PageView'],
    [/^(property_details_landing_viewed|property_map_popup_opened|property_details_clicked|home_property_details_clicked)$/, 'ViewContent'],
    [/^(home_map_search_submitted|property_search_submitted|home_search_submitted|home_guided_search_completed|search_results_search_this_area_clicked|home_map_modal_search_this_area_clicked|property_map_modal_search_this_area_clicked)$/, 'Search'],
    [/(whatsapp|chat_opened|chat_cta_clicked|specialist_clicked|message_clicked)/, 'Contact'],
    [/^(form_submitted|lead_captured|broker_candidate_form_submitted)$/, 'Lead'],
    [/^(property_favorited)$/, 'AddToWishlist'],
]

export function normalizeSiteEventType(value: unknown) {
    return String(value || '').trim().toLowerCase()
}

export function resolveMetaEventName(siteEventType: unknown, explicitEventName?: unknown): MetaEventName | null {
    const explicit = String(explicitEventName || '').trim()
    if (isMetaEventName(explicit)) return explicit

    const eventType = normalizeSiteEventType(siteEventType)
    for (const [pattern, eventName] of META_EVENT_BY_SITE_EVENT) {
        if (pattern.test(eventType)) return eventName
    }

    return null
}

export function isMetaEventName(value: string): value is MetaEventName {
    return ['PageView', 'ViewContent', 'Search', 'Contact', 'Lead', 'AddToWishlist'].includes(value)
}

function textValue(value: unknown) {
    const text = String(value || '').trim()
    return text || ''
}

function numberValue(value: unknown) {
    const num = Number(value)
    return Number.isFinite(num) && num > 0 ? num : null
}

export function buildMetaCustomData(metaEventName: MetaEventName, metadata: Record<string, unknown> = {}) {
    const propertyId = textValue(metadata.property_id || metadata.propertyId || metadata.content_id || metadata.id)
    const title = textValue(metadata.title || metadata.property_title || metadata.content_name || metadata.page_title)
    const search = textValue(metadata.search || metadata.query || metadata.q || metadata.location || metadata.city || metadata.neighborhood)
    const value = numberValue(metadata.value || metadata.price || metadata.price_value)
    const currency = textValue(metadata.currency) || (value ? 'BRL' : '')

    const customData: Record<string, unknown> = {}

    if (propertyId) {
        customData.content_ids = [propertyId]
        customData.content_type = 'home_listing'
    }

    if (title) customData.content_name = title
    if (search && metaEventName === 'Search') customData.search_string = search
    if (value) customData.value = value
    if (currency) customData.currency = currency

    return customData
}
