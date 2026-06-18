export type MetaEventName = 'PageView' | 'ViewContent' | 'Search' | 'Contact' | 'Lead' | 'AddToWishlist'

const META_EVENT_BY_SITE_EVENT: Array<[RegExp, MetaEventName]> = [
    [/^page_view$/, 'PageView'],
    [/^(property_details_landing_viewed|property_details_landing_gallery_opened|property_details_landing_section_viewed|property_details_continuation_viewed|property_details_continuation_favorites_clicked|property_details_continuation_property_clicked|property_map_popup_opened|property_map_pin_selected|property_map_preview_opened|property_map_preview_details_clicked|property_location_view_changed|property_location_street_view_opened|property_search_alert_match_opened|property_details_clicked|home_property_details_clicked)$/, 'ViewContent'],
    [/^(home_map_search_submitted|property_search_submitted|home_search_submitted|home_guided_search_completed|search_results_search_this_area_clicked|property_map_draw_area_applied|property_search_alert_clicked|property_search_alert_saved|property_search_alert_matched|property_private_visit_requested|property_availability_requested|property_reserved_negotiation_requested|property_value_reading_requested|home_map_modal_search_this_area_clicked|property_map_modal_search_this_area_clicked)$/, 'Search'],
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
