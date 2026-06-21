type JsonRecord = Record<string, unknown>

export type LeadActivityEntry = {
    id?: string
    event_type: string
    label: string
    occurred_at: string
    property_id?: string
    property_slug?: string
    property_path?: string
    target_property_id?: string
    target_property_slug?: string
    target_property_path?: string
    property_title?: string
    alert_id?: string
    alert_title?: string
    property_url?: string
    match_score?: number
    match_reasons?: string[]
    suggested_message?: string
    followup_title?: string
    followup_priority?: string
    source?: string
    page_path?: string
    page_url?: string
    page_title?: string
    detail?: string
    selected_region?: string
    selected_region_label?: string
    coordinate_count?: number
    visible_count?: number
    bounds_summary?: string
    map_view?: string
    section_id?: string
    section_label?: string
    premium_intent?: string
    requested_action?: string
    cta_context?: string
}

export type LeadActivityEventRow = {
    id?: string | null
    event_type: string
    metadata?: unknown
    created_at?: string | null
}

const ACTIVITY_LIMIT = 120

function asRecord(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function asNumberString(value: unknown): string | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    return asString(value)
}

function asFiniteNumber(value: unknown): number | undefined {
    const number = Number(value)
    return Number.isFinite(number) ? number : undefined
}

function asStringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.map(asString).filter((item): item is string => Boolean(item))
        : []
}

function mapViewLabel(value?: string) {
    if (value === 'map') return 'Mapa'
    if (value === 'satellite') return 'Satelite'
    if (value === 'street') return 'Street View'
    return value
}

function formatBoundsSummary(value: unknown) {
    const bounds = asRecord(value)
    const north = asFiniteNumber(bounds.north)
    const south = asFiniteNumber(bounds.south)
    const east = asFiniteNumber(bounds.east)
    const west = asFiniteNumber(bounds.west)

    if (
        typeof north !== 'number'
        || typeof south !== 'number'
        || typeof east !== 'number'
        || typeof west !== 'number'
    ) {
        return undefined
    }

    return `N ${north.toFixed(4)} / S ${south.toFixed(4)} / L ${east.toFixed(4)} / O ${west.toFixed(4)}`
}

const PREMIUM_INTENT_EVENTS = [
    'property_private_visit_requested',
    'property_availability_requested',
    'property_reserved_negotiation_requested',
    'property_value_reading_requested',
]

function isPremiumIntentEvent(eventType: string) {
    return PREMIUM_INTENT_EVENTS.includes(eventType)
}

function premiumIntentLabel(value?: string) {
    if (value === 'private_visit') return 'Visita privada'
    if (value === 'availability') return 'Disponibilidade'
    if (value === 'reserved_negotiation') return 'Negociacao reservada'
    if (value === 'value_reading') return 'Leitura de valor'
    return value
}

function eventDetail(eventType: string, metadata: JsonRecord): string | undefined {
    if (eventType === 'scroll_depth') {
        const percentage = asNumberString(metadata.percentage)
        return percentage ? `${percentage}% da pagina` : undefined
    }

    if (eventType === 'property_feed_tab_clicked') {
        const tab = asString(metadata.tab)
        if (tab === 'photos') return 'Fotos'
        if (tab === 'videos') return 'Videos'
        if (tab === 'map') return 'Mapa'
        if (tab === 'docs') return 'Documentos'
        return tab
    }

    if (eventType === 'property_gallery_opened') {
        const imageIndex = asNumberString(metadata.image_index)
        return imageIndex ? `Foto ${Number(imageIndex) + 1}` : undefined
    }

    if (isPremiumIntentEvent(eventType)) {
        const intent = premiumIntentLabel(asString(metadata.premium_intent))
        const action = asString(metadata.requested_action)
        const title = asString(metadata.property_title) || asString(metadata.title)
        const context = asString(metadata.cta_context) || asString(metadata.cta_label)
        return [intent, action, title, context].filter(Boolean).join(' | ') || undefined
    }

    if (eventType === 'property_feed_saved_history_clicked') {
        const source = asString(metadata.source)
        if (source === 'favorites') return 'Historico de curtidos'
        if (source === 'history') return 'Historico de visualizados'
        return source
    }

    if (eventType === 'home_map_filter_changed') {
        const filter = asString(metadata.filter_label)
        const value = asString(metadata.value_label)
        return [filter, value].filter(Boolean).join(': ') || undefined
    }

    if (eventType === 'home_map_quiz_next_clicked') {
        const step = asNumberString(metadata.step_number)
        const total = asNumberString(metadata.step_total)
        const filter = asString(metadata.filter_label)
        const value = asString(metadata.value_label)
        return [`Etapa ${step || '?'} de ${total || '?'}`, [filter, value].filter(Boolean).join(': ')].filter(Boolean).join(' | ')
    }

    if (eventType === 'home_map_search_submitted') {
        const results = asNumberString(metadata.results_count)
        const query = asString(metadata.query)
        const type = asString(metadata.type_label)
        const price = asString(metadata.price_label)
        const purpose = asString(metadata.purpose_label)
        const summary = [query, type, price, purpose].filter(Boolean).join(' | ')
        return [results ? `${results} imoveis` : undefined, summary].filter(Boolean).join(' | ') || undefined
    }

    if (eventType === 'home_map_feature_filter_toggled') {
        const label = asString(metadata.chip_label)
        const action = metadata.active === false ? 'Removeu' : 'Ativou'
        return label ? `${action} ${label}` : undefined
    }

    if (eventType === 'property_details_landing_section_viewed') {
        return asString(metadata.section_label)
            || asString(metadata.target_section)
            || asString(metadata.title)
    }

    if (eventType === 'search_results_search_this_area_clicked') {
        const results = asNumberString(metadata.visible_count)
        const region = asString(metadata.selected_region_label) || asString(metadata.selected_region)
        const bounds = formatBoundsSummary(metadata.bounds)
        return [
            results ? `${results} imoveis` : undefined,
            region ? `Regiao ${region}` : undefined,
            bounds ? `Recorte ${bounds}` : undefined,
        ].filter(Boolean).join(' | ') || undefined
    }

    if (eventType.startsWith('crm_search_alert_followup_')) {
        const status = asString(metadata.followup_status_label)
        const propertyTitle = asString(metadata.property_title) || asString(metadata.title)
        const alertTitle = asString(metadata.alert_title)
        const score = asNumberString(metadata.match_score)
        return [
            status,
            propertyTitle,
            alertTitle,
            score ? `${score}% aderente` : undefined,
        ].filter(Boolean).join(' | ') || undefined
    }

    if (
        eventType === 'property_search_alert_clicked'
        || eventType === 'property_search_alert_saved'
        || eventType === 'property_search_alert_failed'
        || eventType === 'property_search_alert_matched'
        || eventType === 'property_search_alert_match_opened'
        || eventType === 'property_search_alert_paused'
        || eventType === 'property_search_alert_resumed'
        || eventType === 'property_search_alert_deleted'
        || eventType === 'property_search_alert_push_requested'
        || eventType === 'property_search_alerts_panel_opened'
    ) {
        const title = asString(metadata.alert_title) || asString(metadata.title)
        const propertyTitle = asString(metadata.property_title)
        const results = asNumberString(metadata.visible_count)
        const region = asString(metadata.selected_region_label) || asString(metadata.selected_region)
        const score = asNumberString(metadata.match_score)
        return [
            title,
            propertyTitle,
            score ? `${score}% aderente` : undefined,
            results ? `${results} imoveis` : undefined,
            region,
        ].filter(Boolean).join(' | ') || undefined
    }

    if (eventType === 'home_map_advanced_filters_toggled' || eventType === 'home_search_advanced_toggled') {
        return metadata.open === false ? 'Fechou filtros' : 'Abriu filtros'
    }

    if (eventType === 'home_search_submitted') {
        const query = asString(metadata.query)
        const type = asString(metadata.property_type_label)
        const price = asString(metadata.price_range_label)
        const purpose = asString(metadata.purpose)
        return [query, type, price, purpose].filter(Boolean).join(' | ') || undefined
    }

    if (eventType === 'home_search_suggestion_clicked') {
        const type = asString(metadata.suggestion_type)
        const label = asString(metadata.label)
        return [type, label].filter(Boolean).join(': ') || undefined
    }

    if (
        eventType === 'home_property_mobile_feed_clicked'
        || eventType === 'home_property_desktop_details_clicked'
        || eventType === 'home_property_details_clicked'
        || eventType === 'site_property_share_click'
        || eventType === 'property_feed_desktop_redirected_to_details'
        || eventType === 'property_details_landing_viewed'
        || eventType === 'property_details_landing_anchor_clicked'
        || eventType === 'property_details_landing_gallery_opened'
        || eventType === 'property_details_landing_map_clicked'
        || eventType === 'property_details_landing_related_clicked'
        || eventType === 'property_details_landing_section_viewed'
    ) {
        return asString(metadata.title)
            || asString(metadata.link_title)
            || asString(metadata.link_label)
            || asString(metadata.section_label)
            || asString(metadata.target_section)
            || asString(metadata.destination)
    }

    if (eventType === 'whatsapp_property_click' || eventType === 'chat_opened') {
        const label = asString(metadata.cta_label) || asString(metadata.link_label) || asString(metadata.template)
        const context = asString(metadata.cta_context) || asString(metadata.section_label)
        return [label, context].filter(Boolean).join(' | ') || undefined
    }

    if (eventType === 'property_map_quick_filter_clicked') {
        return asString(metadata.filter_label)
    }

    if (eventType === 'property_map_style_changed') {
        return asString(metadata.style_label)
    }

    if (eventType === 'property_map_draw_area_applied') {
        const points = asNumberString(metadata.coordinate_count)
        const results = asNumberString(metadata.visible_count)
        const region = asString(metadata.selected_region_label) || asString(metadata.selected_region)
        return [
            points ? `${points} pontos` : undefined,
            results ? `${results} imoveis` : undefined,
            region ? `Regiao ${region}` : undefined,
        ].filter(Boolean).join(' | ') || undefined
    }

    if (eventType === 'property_map_draw_area_cleared' || eventType === 'property_map_draw_area_cleared_from_map') {
        return metadata.had_draw_area === false ? 'Sem area ativa' : 'Area removida'
    }

    if (
        eventType === 'property_map_pin_selected'
        || eventType === 'property_map_preview_opened'
        || eventType === 'property_map_preview_closed'
        || eventType === 'property_map_preview_details_clicked'
        || eventType === 'property_map_popup_opened'
    ) {
        return asString(metadata.title)
            || asString(metadata.neighborhood)
            || asString(metadata.destination)
    }

    if (eventType === 'property_map_preview_photo_changed') {
        const index = asFiniteNumber(metadata.image_index)
        const galleryCount = asNumberString(metadata.gallery_count)
        return [
            Number.isFinite(index) ? `Foto ${Number(index) + 1}` : undefined,
            galleryCount ? `${galleryCount} fotos` : undefined,
        ].filter(Boolean).join(' | ') || undefined
    }

    if (eventType === 'property_location_view_changed' || eventType === 'property_location_street_view_opened') {
        const view = mapViewLabel(asString(metadata.view))
        const label = asString(metadata.link_label)
        return [view, label].filter(Boolean).join(' | ') || asString(metadata.title)
    }

    if (eventType === 'property_location_google_maps_opened') {
        const view = mapViewLabel(asString(metadata.view))
        const label = asString(metadata.link_label)
        return [view, label, asString(metadata.title)].filter(Boolean).join(' | ') || 'Google Maps'
    }

    if (
        eventType === 'push_soft_prompt_shown'
        || eventType === 'push_soft_prompt_clicked'
        || eventType === 'push_soft_prompt_dismissed'
    ) {
        return asString(metadata.title) || asString(metadata.reason)
    }

    if (
        eventType === 'search_results_filter_removed'
        || eventType === 'search_results_clear_clicked'
        || eventType === 'search_results_adjust_filters_clicked'
    ) {
        return asString(metadata.filter_label)
            || asNumberString(metadata.visible_count)
            || undefined
    }

    if (eventType === 'search_results_memory_property_clicked') {
        const title = asString(metadata.title) || asString(metadata.property_title)
        const source = asString(metadata.source)
        const sourceLabel = source === 'favorite' ? 'Salvo' : source === 'history' ? 'Visto recentemente' : source
        return [title, sourceLabel].filter(Boolean).join(' | ') || undefined
    }

    if (
        eventType === 'property_details_continuation_viewed'
        || eventType === 'property_details_continuation_favorites_clicked'
        || eventType === 'property_details_continuation_property_clicked'
    ) {
        const shown = Array.isArray(metadata.shown_property_ids) ? metadata.shown_property_ids.length : 0
        const favorites = asNumberString(metadata.favorite_count)
        const history = asNumberString(metadata.history_count)
        const title = asString(metadata.title) || asString(metadata.property_title)
        return [
            title,
            shown ? `${shown} imoveis retomados` : undefined,
            favorites ? `${favorites} salvos` : undefined,
            history ? `${history} vistos` : undefined,
        ].filter(Boolean).join(' | ') || asString(metadata.title)
    }

    return asString(metadata.link_label)
        || asString(metadata.link_title)
        || asString(metadata.template)
        || asString(metadata.source)
        || undefined
}

function eventLabel(eventType: string, metadata: JsonRecord): string {
    switch (eventType) {
        case 'page_view':
            return 'Entrou no site'
        case 'scroll_depth':
            return 'Rolou a pagina'
        case 'cookie_consent':
            return 'Consentiu rastreamento'
        case 'push_consent':
            return 'Aceitou push'
        case 'push_denied':
            return 'Recusou push'
        case 'push_soft_prompt_shown':
            return 'Viu convite de push'
        case 'push_soft_prompt_clicked':
            return 'Clicou para ativar push'
        case 'push_soft_prompt_dismissed':
            return 'Dispensou convite de push'
        case 'home_map_filter_changed':
            return 'Ajustou filtro do mapa'
        case 'home_map_quiz_next_clicked':
            return 'Avancou no quiz do mapa'
        case 'home_map_quiz_back_clicked':
            return 'Voltou no quiz do mapa'
        case 'home_map_search_submitted':
            return 'Buscou imoveis no mapa'
        case 'home_map_search_cleared':
            return 'Limpou busca do mapa'
        case 'home_map_feature_filter_toggled':
            return 'Ajustou filtro rapido do mapa'
        case 'search_results_search_this_area_clicked':
            return 'Buscou nesta area do mapa'
        case 'property_search_alert_clicked':
            return 'Tentou salvar alerta de busca'
        case 'property_search_alert_saved':
            return 'Salvou alerta de busca'
        case 'property_search_alert_failed':
            return 'Erro ao salvar alerta de busca'
        case 'property_search_alert_matched':
            return 'Recebeu match de alerta'
        case 'property_search_alert_match_opened':
            return 'Abriu match de alerta'
        case 'property_search_alert_paused':
            return 'Pausou alerta de busca'
        case 'property_search_alert_resumed':
            return 'Reativou alerta de busca'
        case 'property_search_alert_deleted':
            return 'Removeu alerta de busca'
        case 'property_search_alert_push_requested':
            return 'Pediu ativacao de push'
        case 'property_search_alerts_panel_opened':
            return 'Abriu painel de alertas'
        case 'property_private_visit_requested':
            return 'Pediu visita privada'
        case 'property_availability_requested':
            return 'Pediu disponibilidade'
        case 'property_reserved_negotiation_requested':
            return 'Pediu negociacao reservada'
        case 'property_value_reading_requested':
            return 'Pediu leitura de valor'
        case 'crm_search_alert_followup_pending':
            return 'Reabriu abordagem comercial'
        case 'crm_search_alert_followup_sent':
            return 'Marcou abordagem enviada'
        case 'crm_search_alert_followup_responded':
            return 'Marcou abordagem respondida'
        case 'crm_search_alert_followup_converted':
            return 'Marcou abordagem convertida'
        case 'crm_search_alert_followup_dismissed':
            return 'Descartou abordagem comercial'
        case 'home_map_advanced_filters_toggled':
            return 'Mexeu nos filtros do mapa'
        case 'home_search_submitted':
            return 'Buscou imoveis'
        case 'home_search_suggestion_clicked':
            return 'Clicou sugestao de busca'
        case 'home_property_mobile_feed_clicked':
            return 'Abriu imovel pela home'
        case 'home_property_desktop_details_clicked':
            return 'Abriu descricao pela home'
        case 'home_property_details_clicked':
            return 'Abriu imovel pela home'
        case 'site_property_share_click':
            return 'Abriu link compartilhado de imovel'
        case 'property_details_landing_viewed':
            return 'Visualizou landing completa do imovel'
        case 'property_details_landing_anchor_clicked':
            return 'Navegou na landing do imovel'
        case 'property_details_landing_gallery_opened':
            return 'Abriu galeria da landing'
        case 'property_details_landing_map_clicked':
            return 'Abriu mapa da landing'
        case 'property_details_landing_related_clicked':
            return 'Clicou em imovel relacionado'
        case 'property_details_landing_section_viewed':
            return 'Viu secao do imovel'
        case 'home_search_cleared':
            return 'Limpou busca'
        case 'home_search_advanced_toggled':
            return 'Mexeu nos filtros da busca'
        case 'property_map_quick_filter_clicked':
            return 'Filtrou mapa'
        case 'property_map_style_changed':
            return 'Mudou estilo do mapa'
        case 'property_map_popup_opened':
            return 'Abriu imovel no mapa'
        case 'property_map_pin_selected':
            return 'Selecionou pin no mapa'
        case 'property_map_preview_opened':
            return 'Abriu preview no mapa'
        case 'property_map_preview_photo_changed':
            return 'Passou fotos no preview'
        case 'property_map_preview_details_clicked':
            return 'Abriu detalhes pelo mapa'
        case 'property_map_preview_closed':
            return 'Fechou preview do mapa'
        case 'property_map_draw_mode_toggled':
            return metadata.enabled === false ? 'Saiu do desenho no mapa' : 'Ativou desenho no mapa'
        case 'property_map_draw_area_applied':
            return 'Desenhou area no mapa'
        case 'property_map_draw_area_cleared':
        case 'property_map_draw_area_cleared_from_map':
            return 'Removeu area desenhada'
        case 'property_location_view_changed':
            return 'Alternou mapa do imovel'
        case 'property_location_street_view_opened':
            return 'Abriu Street View'
        case 'property_location_google_maps_opened':
            return 'Abriu localizacao no Google Maps'
        case 'search_results_filter_removed':
            return 'Removeu filtro da busca'
        case 'search_results_clear_clicked':
            return 'Limpou resultados da busca'
        case 'search_results_adjust_filters_clicked':
            return 'Voltou para ajustar filtros'
        case 'search_results_memory_property_clicked':
            return 'Retomou imovel salvo ou visto'
        case 'property_details_continuation_viewed':
            return 'Viu salvos e recentes'
        case 'property_details_continuation_favorites_clicked':
            return 'Foi comparar favoritos'
        case 'property_details_continuation_property_clicked':
            return 'Retomou imovel salvo ou visto'
        case 'search_results_empty_view_all_clicked':
            return 'Pediu todos os imoveis'
        case 'chat_opened':
            return 'Abriu atendimento'
        case 'form_submitted':
            return 'Virou lead no site'
        case 'whatsapp_link_click':
        case 'whatsapp_property_click':
            return 'Clicou no WhatsApp'
        case 'email_blog_click':
            return 'Clicou em artigo pelo e-mail'
        case 'email_news_click':
            return 'Clicou em noticia pelo e-mail'
        case 'whatsapp_blog_click':
            return 'Clicou em artigo pelo WhatsApp'
        case 'whatsapp_news_click':
            return 'Clicou em noticia pelo WhatsApp'
        case 'email_event_click':
            return 'Clicou no evento pelo e-mail'
        case 'email_event_map_click':
            return 'Clicou no mapa pelo e-mail do evento'
        case 'whatsapp_evento_email_click':
            return 'Clicou no WhatsApp pelo e-mail do evento'
        case 'property_feed_slide_viewed':
            return 'Visualizou imovel'
        case 'property_favorited':
            return 'Curtiu imovel'
        case 'property_unfavorited':
            return 'Removeu curtida'
        case 'property_disliked':
            return 'Nao gostou do imovel'
        case 'property_undisliked':
            return 'Removeu nao gostei'
        case 'property_shared':
            return 'Compartilhou imovel'
        case 'property_gallery_opened':
            return 'Abriu galeria'
        case 'property_gallery_swiped':
            return 'Passou fotos'
        case 'property_feed_swiped':
            return 'Passou para outro imovel'
        case 'property_feed_tab_clicked':
            return 'Abriu aba do imovel'
        case 'property_feed_message_clicked':
        case 'property_feed_whatsapp_clicked':
        case 'property_feed_menu_specialist_clicked':
            return 'Chamou no WhatsApp'
        case 'property_details_clicked':
            return 'Abriu descricao completa'
        case 'property_feed_desktop_redirected_to_details':
            return 'Redirecionado para descricao completa'
        case 'property_feed_similar_clicked':
            return 'Pediu imoveis parecidos'
        case 'property_feed_saved_history_clicked':
            return 'Abriu historico no feed'
        case 'gallery_image_clicked':
            return 'Clicou em foto'
        case 'chat_cta_clicked':
            return 'Clicou para conversar'
        default:
            return metadata.event_label && typeof metadata.event_label === 'string'
                ? metadata.event_label
                : eventType.replace(/_/g, ' ')
    }
}

export function leadActivityFromEvent(row: LeadActivityEventRow): LeadActivityEntry {
    const metadata = asRecord(row.metadata)
    const suggestedFollowup = asRecord(metadata.suggested_followup)
    const propertyId = asString(metadata.property_id)
        || asString(metadata.from_property_id)
        || asString(metadata.lead_property_id)
    const propertySlug = asString(metadata.property_slug)
        || asString(metadata.propertySlug)
        || asString(metadata.slug)
    const propertyPath = asString(metadata.property_path)
        || asString(metadata.propertyPath)
        || asString(metadata.canonical_path)
    const targetPropertyId = asString(metadata.target_property_id)
        || asString(metadata.to_property_id)
    const targetPropertySlug = asString(metadata.target_property_slug)
        || asString(metadata.targetPropertySlug)
    const targetPropertyPath = asString(metadata.target_property_path)
        || asString(metadata.targetPropertyPath)
    const coordinateCount = asFiniteNumber(metadata.coordinate_count)
    const visibleCount = asFiniteNumber(metadata.visible_count)
    const boundsSummary = formatBoundsSummary(metadata.bounds)
    const matchScore = asFiniteNumber(metadata.match_score) ?? asFiniteNumber(suggestedFollowup.match_score)
    const matchReasons = asStringArray(metadata.match_reasons).length
        ? asStringArray(metadata.match_reasons)
        : asStringArray(suggestedFollowup.match_reasons)
    const suggestedMessage = asString(metadata.suggested_whatsapp_message)
        || asString(metadata.suggested_message)
        || asString(suggestedFollowup.message)
    const propertyUrl = asString(metadata.property_url) || asString(suggestedFollowup.property_url)
    const propertyTitle = asString(metadata.property_title)
        || asString(metadata.title)
        || asString(metadata.link_title)
        || asString(suggestedFollowup.property_title)

    return {
        ...(row.id ? { id: row.id } : {}),
        event_type: row.event_type,
        label: eventLabel(row.event_type, metadata),
        occurred_at: row.created_at || new Date().toISOString(),
        ...(propertyId ? { property_id: propertyId } : {}),
        ...(propertySlug ? { property_slug: propertySlug } : {}),
        ...(propertyPath ? { property_path: propertyPath } : {}),
        ...(targetPropertyId ? { target_property_id: targetPropertyId } : {}),
        ...(targetPropertySlug ? { target_property_slug: targetPropertySlug } : {}),
        ...(targetPropertyPath ? { target_property_path: targetPropertyPath } : {}),
        ...(propertyTitle ? { property_title: propertyTitle } : {}),
        ...(asString(metadata.alert_id) ? { alert_id: asString(metadata.alert_id) } : {}),
        ...(asString(metadata.alert_title) ? { alert_title: asString(metadata.alert_title) } : {}),
        ...(propertyUrl ? { property_url: propertyUrl } : {}),
        ...(typeof matchScore === 'number' ? { match_score: matchScore } : {}),
        ...(matchReasons.length ? { match_reasons: matchReasons } : {}),
        ...(suggestedMessage ? { suggested_message: suggestedMessage } : {}),
        ...(asString(suggestedFollowup.title) ? { followup_title: asString(suggestedFollowup.title) } : {}),
        ...(asString(metadata.followup_priority) || asString(suggestedFollowup.priority) ? { followup_priority: asString(metadata.followup_priority) || asString(suggestedFollowup.priority) } : {}),
        ...(asString(metadata.source) ? { source: asString(metadata.source) } : {}),
        ...(asString(metadata.page_path) ? { page_path: asString(metadata.page_path) } : {}),
        ...(asString(metadata.page_url) ? { page_url: asString(metadata.page_url) } : {}),
        ...(asString(metadata.page_title) ? { page_title: asString(metadata.page_title) } : {}),
        ...(eventDetail(row.event_type, metadata) ? { detail: eventDetail(row.event_type, metadata) } : {}),
        ...(asString(metadata.selected_region) ? { selected_region: asString(metadata.selected_region) } : {}),
        ...(asString(metadata.selected_region_label) ? { selected_region_label: asString(metadata.selected_region_label) } : {}),
        ...(typeof coordinateCount === 'number' ? { coordinate_count: coordinateCount } : {}),
        ...(typeof visibleCount === 'number' ? { visible_count: visibleCount } : {}),
        ...(boundsSummary ? { bounds_summary: boundsSummary } : {}),
        ...(asString(metadata.view) ? { map_view: asString(metadata.view) } : {}),
        ...(asString(metadata.section_id) ? { section_id: asString(metadata.section_id) } : {}),
        ...(asString(metadata.section_label) ? { section_label: asString(metadata.section_label) } : {}),
        ...(asString(metadata.premium_intent) ? { premium_intent: asString(metadata.premium_intent) } : {}),
        ...(asString(metadata.requested_action) ? { requested_action: asString(metadata.requested_action) } : {}),
        ...(asString(metadata.cta_context) ? { cta_context: asString(metadata.cta_context) } : {}),
    }
}

function dedupeKey(entry: LeadActivityEntry): string {
    return entry.id
        || [entry.event_type, entry.property_id || entry.target_property_id || '', entry.occurred_at].join(':')
}

function addRecent(list: string[], value?: string): string[] {
    if (!value) return list
    return [value, ...list.filter(item => item !== value)].slice(0, 80)
}

function addRecentFollowup(list: JsonRecord[], followup: JsonRecord): JsonRecord[] {
    const key = [
        asString(followup.alert_id),
        asString(followup.property_id),
        asString(followup.message),
    ].filter(Boolean).join(':')

    return [
        followup,
        ...list.filter(item => [
            asString(item.alert_id),
            asString(item.property_id),
            asString(item.message),
        ].filter(Boolean).join(':') !== key),
    ].slice(0, 10)
}

function removeValue(list: string[], value?: string): string[] {
    if (!value) return list
    return list.filter(item => item !== value)
}

function countEvents(counts: Record<string, number>, types: string[]) {
    return types.reduce((sum, type) => sum + (counts[type] || 0), 0)
}

function scoreClassification(score: number) {
    if (score >= 85) return 'vip'
    if (score >= 70) return 'hot'
    if (score >= 40) return 'warm'
    return 'cold'
}

function scoreTemperature(score: number) {
    if (score >= 85) return 'Pronto para abordagem VIP'
    if (score >= 70) return 'Quente'
    if (score >= 40) return 'Morno'
    if (score >= 20) return 'Observando'
    return 'Novo'
}

function scoreNextAction(params: {
    score: number
    searchCount: number
    likedCount: number
    detailCount: number
    whatsappCount: number
    pushCount: number
    contentCount: number
    mapIntentCount: number
    priceHistoryCount: number
    continuationCount: number
    savedSearchCount: number
    searchAlertMatchCount: number
    premiumIntentCount: number
    privateVisitCount: number
    availabilityCount: number
    reservedNegotiationCount: number
    valueReadingCount: number
}) {
    if (params.privateVisitCount > 0) return 'Confirmar disponibilidade de agenda e propor visita privada com contexto do imovel.'
    if (params.reservedNegotiationCount > 0) return 'Abrir tratativa reservada com leitura comercial e margem real de negociacao.'
    if (params.availabilityCount > 0) return 'Validar disponibilidade do imovel e responder com opcoes objetivas de proximo passo.'
    if (params.valueReadingCount > 0) return 'Enviar leitura de valor, comparaveis e pontos de liquidez antes da visita.'
    if (params.premiumIntentCount > 0) return 'Responder com abordagem consultiva de alto padrao e conduzir para WhatsApp.'
    if (params.whatsappCount > 0) return 'Responder com curadoria direta e pedir criterio de decisao.'
    if (params.searchAlertMatchCount > 0) return 'Abordar com o imovel que acabou de bater no alerta salvo.'
    if (params.savedSearchCount > 0) return 'Manter contato com oportunidades novas dentro da busca salva.'
    if (params.continuationCount > 0) return 'Retomar pelos imoveis salvos ou revisitados e oferecer comparacao objetiva.'
    if (params.likedCount > 0) return 'Retomar pelos imoveis curtidos e oferecer alternativas parecidas.'
    if (params.detailCount > 0) return 'Usar os imoveis abertos como ponto de comparacao.'
    if (params.priceHistoryCount > 0) return 'Abordar com leitura de valor, custos e comparaveis da regiao.'
    if (params.mapIntentCount > 0) return 'Retomar pela regiao explorada no mapa e oferecer opcoes proximas.'
    if (params.searchCount > 0) return 'Enviar uma selecao curta baseada nos filtros usados.'
    if (params.contentCount > 0) return 'Puxar conversa pelo conteudo clicado e conectar com uma oportunidade relevante.'
    if (params.pushCount > 0) return 'Nutrir com oportunidade forte e chamada leve para WhatsApp.'
    if (params.score >= 40) return 'Acompanhar com mensagem consultiva curta.'
    return 'Continuar coletando sinais antes de abordar forte.'
}

function buildBehaviorSummary(activity: LeadActivityEntry[]) {
    let viewed_property_ids: string[] = []
    let viewed_property_slugs: string[] = []
    let liked_property_ids: string[] = []
    let disliked_property_ids: string[] = []
    let shared_property_ids: string[] = []
    let whatsapp_property_ids: string[] = []
    let detail_property_ids: string[] = []
    let map_property_ids: string[] = []
    let preview_property_ids: string[] = []
    let price_history_property_ids: string[] = []
    let location_property_ids: string[] = []
    let search_alert_match_property_ids: string[] = []
    let selected_regions: string[] = []
    let map_area_summaries: string[] = []
    let saved_search_titles: string[] = []
    let search_alert_followups: JsonRecord[] = []
    let premium_intents: JsonRecord[] = []
    let premium_intent_property_ids: string[] = []
    let last_map_intent: JsonRecord | null = null
    let latest_premium_intent: JsonRecord | null = null
    let last_property_id: string | undefined
    let last_property_slug: string | undefined
    let last_page_path: string | undefined
    let last_activity_at: string | undefined
    let last_location_view: string | undefined
    const event_counts: Record<string, number> = {}

    for (const entry of activity) {
        event_counts[entry.event_type] = (event_counts[entry.event_type] || 0) + 1
        const propertyId = entry.property_id || entry.target_property_id
        const propertySlug = entry.property_slug || entry.target_property_slug
        if (propertyId) last_property_id = propertyId
        if (propertySlug) last_property_slug = propertySlug
        if (entry.page_path) last_page_path = entry.page_path
        if (entry.map_view) last_location_view = entry.map_view
        const regionSignal = entry.selected_region_label || entry.selected_region
        if (regionSignal) selected_regions = addRecent(selected_regions, regionSignal)
        if (
            entry.event_type === 'property_map_draw_area_applied'
            || entry.event_type === 'search_results_search_this_area_clicked'
        ) {
            if (entry.bounds_summary) map_area_summaries = addRecent(map_area_summaries, entry.bounds_summary)
            last_map_intent = {
                event_type: entry.event_type,
                label: entry.label,
                detail: entry.detail || null,
                selected_region: regionSignal || null,
                visible_count: entry.visible_count ?? null,
                coordinate_count: entry.coordinate_count ?? null,
                bounds_summary: entry.bounds_summary || null,
                occurred_at: entry.occurred_at,
            }
        }
        if (isPremiumIntentEvent(entry.event_type)) {
            premium_intent_property_ids = addRecent(premium_intent_property_ids, propertyId)
            const premiumIntent = {
                event_type: entry.event_type,
                label: entry.label,
                detail: entry.detail || null,
                premium_intent: entry.premium_intent || null,
                requested_action: entry.requested_action || null,
                cta_context: entry.cta_context || null,
                property_id: propertyId || null,
                property_title: entry.property_title || null,
                property_url: entry.property_url || null,
                occurred_at: entry.occurred_at,
            }
            latest_premium_intent = premiumIntent
            premium_intents = [
                premiumIntent,
                ...premium_intents.filter(item => [
                    asString(item.event_type),
                    asString(item.property_id),
                    asString(item.occurred_at),
                ].join(':') !== [
                    entry.event_type,
                    propertyId || '',
                    entry.occurred_at,
                ].join(':')),
            ].slice(0, 12)
        }
        if (entry.event_type === 'property_search_alert_saved') {
            saved_search_titles = addRecent(saved_search_titles, entry.detail || entry.property_title || 'Alerta de busca')
        }
        if (entry.event_type === 'property_search_alert_matched' || entry.event_type === 'property_search_alert_match_opened') {
            search_alert_match_property_ids = addRecent(search_alert_match_property_ids, propertyId)
            if (entry.detail) saved_search_titles = addRecent(saved_search_titles, entry.detail)
        }
        if (
            (entry.event_type === 'property_search_alert_matched' || entry.event_type === 'property_search_alert_match_opened')
            && entry.suggested_message
        ) {
            search_alert_followups = addRecentFollowup(search_alert_followups, {
                alert_id: entry.alert_id || null,
                alert_title: entry.alert_title || null,
                property_id: propertyId || null,
                property_title: entry.property_title || null,
                property_url: entry.property_url || null,
                match_score: entry.match_score ?? null,
                match_reasons: entry.match_reasons || [],
                title: entry.followup_title || 'Retomar alerta salvo',
                priority: entry.followup_priority || 'normal',
                message: entry.suggested_message,
                occurred_at: entry.occurred_at,
            })
        }
        last_activity_at = entry.occurred_at

        if (
            entry.event_type === 'property_feed_slide_viewed'
            || entry.event_type === 'home_property_mobile_feed_clicked'
            || entry.event_type === 'home_property_details_clicked'
            || entry.event_type === 'site_property_share_click'
            || entry.event_type === 'property_details_landing_viewed'
            || entry.event_type === 'property_map_pin_selected'
            || entry.event_type === 'property_map_preview_opened'
            || entry.event_type === 'property_map_popup_opened'
            || entry.event_type === 'property_search_alert_matched'
            || entry.event_type === 'property_search_alert_match_opened'
            || entry.event_type === 'search_results_memory_property_clicked'
            || entry.event_type === 'property_details_continuation_viewed'
            || entry.event_type === 'property_details_continuation_favorites_clicked'
            || entry.event_type === 'property_details_continuation_property_clicked'
            || isPremiumIntentEvent(entry.event_type)
        ) {
            viewed_property_ids = addRecent(viewed_property_ids, propertyId)
            viewed_property_slugs = addRecent(viewed_property_slugs, propertySlug)
        }
        if (entry.event_type === 'property_favorited') {
            liked_property_ids = addRecent(liked_property_ids, propertyId)
            disliked_property_ids = removeValue(disliked_property_ids, propertyId)
        }
        if (entry.event_type === 'property_unfavorited') {
            liked_property_ids = removeValue(liked_property_ids, propertyId)
        }
        if (entry.event_type === 'property_disliked') {
            disliked_property_ids = addRecent(disliked_property_ids, propertyId)
            liked_property_ids = removeValue(liked_property_ids, propertyId)
        }
        if (entry.event_type === 'property_undisliked') {
            disliked_property_ids = removeValue(disliked_property_ids, propertyId)
        }
        if (entry.event_type === 'property_shared') {
            shared_property_ids = addRecent(shared_property_ids, propertyId)
        }
        if (
            entry.event_type === 'property_feed_message_clicked'
            || entry.event_type === 'property_feed_whatsapp_clicked'
            || entry.event_type === 'property_feed_menu_specialist_clicked'
            || entry.event_type === 'whatsapp_property_click'
        ) {
            whatsapp_property_ids = addRecent(whatsapp_property_ids, propertyId)
        }
        if (
            entry.event_type === 'property_details_clicked'
            || entry.event_type === 'home_property_desktop_details_clicked'
            || entry.event_type === 'home_property_details_clicked'
            || entry.event_type === 'site_property_share_click'
            || entry.event_type === 'property_feed_desktop_redirected_to_details'
            || entry.event_type === 'property_details_landing_viewed'
            || entry.event_type === 'property_details_landing_anchor_clicked'
            || entry.event_type === 'property_details_landing_gallery_opened'
            || entry.event_type === 'property_details_landing_map_clicked'
            || entry.event_type === 'property_details_landing_section_viewed'
            || entry.event_type === 'property_map_preview_details_clicked'
            || entry.event_type === 'property_location_view_changed'
            || entry.event_type === 'property_location_street_view_opened'
            || entry.event_type === 'property_location_google_maps_opened'
            || entry.event_type === 'property_search_alert_match_opened'
            || entry.event_type === 'search_results_memory_property_clicked'
            || entry.event_type === 'property_details_continuation_viewed'
            || entry.event_type === 'property_details_continuation_favorites_clicked'
            || entry.event_type === 'property_details_continuation_property_clicked'
            || isPremiumIntentEvent(entry.event_type)
        ) {
            detail_property_ids = addRecent(detail_property_ids, propertyId)
        }
        if (
            entry.event_type === 'property_map_pin_selected'
            || entry.event_type === 'property_map_popup_opened'
            || entry.event_type === 'property_map_preview_opened'
            || entry.event_type === 'property_map_preview_photo_changed'
            || entry.event_type === 'property_map_preview_details_clicked'
        ) {
            map_property_ids = addRecent(map_property_ids, propertyId)
        }
        if (
            entry.event_type === 'property_map_preview_opened'
            || entry.event_type === 'property_map_preview_photo_changed'
            || entry.event_type === 'property_map_preview_details_clicked'
        ) {
            preview_property_ids = addRecent(preview_property_ids, propertyId)
        }
        if (
            entry.event_type === 'property_details_landing_section_viewed'
            && (entry.section_id === 'historico-precos' || entry.section_label === 'Historico e valor')
        ) {
            price_history_property_ids = addRecent(price_history_property_ids, propertyId)
        }
        if (
            entry.event_type === 'property_details_landing_map_clicked'
            || entry.event_type === 'property_location_view_changed'
            || entry.event_type === 'property_location_street_view_opened'
            || entry.event_type === 'property_location_google_maps_opened'
            || (entry.event_type === 'property_details_landing_section_viewed' && entry.section_id === 'localizacao')
        ) {
            location_property_ids = addRecent(location_property_ids, propertyId)
        }
    }

    const searchCount = countEvents(event_counts, [
        'home_search_submitted',
        'home_map_search_submitted',
        'search_results_search_this_area_clicked',
        'property_map_draw_area_applied',
        'property_search_alert_saved',
    ])
    const filterCount = countEvents(event_counts, [
        'home_map_filter_changed',
        'home_map_feature_filter_toggled',
        'property_map_quick_filter_clicked',
        'search_results_filter_removed',
        'property_map_style_changed',
    ])
    const whatsappCount = countEvents(event_counts, [
        'chat_opened',
        'whatsapp_link_click',
        'whatsapp_property_click',
        'property_feed_message_clicked',
        'property_feed_whatsapp_clicked',
        'property_feed_menu_specialist_clicked',
    ])
    const pushCount = countEvents(event_counts, ['push_consent'])
    const contentCount = countEvents(event_counts, [
        'email_blog_click',
        'email_news_click',
        'whatsapp_blog_click',
        'whatsapp_news_click',
        'email_event_click',
        'email_event_map_click',
        'whatsapp_evento_email_click',
    ])
    const mapIntentCount = countEvents(event_counts, [
        'property_feed_tab_clicked',
        'property_map_popup_opened',
        'property_map_pin_selected',
        'property_map_preview_opened',
        'property_map_preview_photo_changed',
        'property_map_preview_details_clicked',
        'property_map_draw_mode_toggled',
        'property_map_draw_area_applied',
        'search_results_search_this_area_clicked',
        'property_map_style_changed',
        'property_details_landing_map_clicked',
        'property_location_view_changed',
        'property_location_street_view_opened',
        'property_location_google_maps_opened',
    ])
    const previewCount = countEvents(event_counts, [
        'property_map_preview_opened',
        'property_map_preview_photo_changed',
        'property_map_preview_details_clicked',
    ])
    const drawAreaSearchCount = countEvents(event_counts, ['property_map_draw_area_applied'])
    const boundsSearchCount = countEvents(event_counts, ['search_results_search_this_area_clicked'])
    const areaSearchCount = drawAreaSearchCount + boundsSearchCount
    const savedSearchCount = countEvents(event_counts, ['property_search_alert_saved'])
    const searchAlertReceivedCount = countEvents(event_counts, ['property_search_alert_matched'])
    const searchAlertOpenedCount = countEvents(event_counts, ['property_search_alert_match_opened'])
    const searchAlertMatchCount = searchAlertReceivedCount + searchAlertOpenedCount
    const priceHistoryCount = price_history_property_ids.length
    const privateVisitCount = countEvents(event_counts, ['property_private_visit_requested'])
    const availabilityCount = countEvents(event_counts, ['property_availability_requested'])
    const reservedNegotiationCount = countEvents(event_counts, ['property_reserved_negotiation_requested'])
    const valueReadingCount = countEvents(event_counts, ['property_value_reading_requested'])
    const premiumIntentCount = privateVisitCount + availabilityCount + reservedNegotiationCount + valueReadingCount
    const continuationCount = countEvents(event_counts, [
        'property_details_continuation_viewed',
        'property_details_continuation_favorites_clicked',
        'property_details_continuation_property_clicked',
    ])
    const streetViewCount = countEvents(event_counts, ['property_location_street_view_opened'])
    const locationViewCount = countEvents(event_counts, [
        'property_location_view_changed',
        'property_location_street_view_opened',
        'property_location_google_maps_opened',
    ])
    const recencyMs = last_activity_at ? Date.now() - new Date(last_activity_at).getTime() : Number.POSITIVE_INFINITY
    const recencyBoost = recencyMs <= 1000 * 60 * 60 * 24
        ? 8
        : recencyMs <= 1000 * 60 * 60 * 24 * 7
            ? 4
            : 0
    const engagementScore = Math.max(0, Math.min(100, Math.round(
        Math.min(18, activity.length)
        + Math.min(24, viewed_property_ids.length * 4)
        + liked_property_ids.length * 12
        + shared_property_ids.length * 10
        + whatsappCount * 30
        + detail_property_ids.length * 8
        + searchCount * 10
        + Math.min(18, contentCount * 6)
        + Math.min(15, filterCount * 3)
        + Math.min(18, mapIntentCount * 4)
        + Math.min(12, previewCount * 3)
        + Math.min(12, areaSearchCount * 5)
        + Math.min(10, streetViewCount * 6)
        + Math.min(10, continuationCount * 5)
        + Math.min(14, savedSearchCount * 14)
        + Math.min(20, searchAlertMatchCount * 16)
        + Math.min(28, premiumIntentCount * 18)
        + Math.min(18, privateVisitCount * 18)
        + Math.min(16, reservedNegotiationCount * 16)
        + Math.min(12, availabilityCount * 12)
        + Math.min(10, valueReadingCount * 10)
        + pushCount * 12
        - disliked_property_ids.length * 2
        + recencyBoost
    )))
    const intentSignals = [
        privateVisitCount > 0 ? 'Pediu visita privada' : null,
        availabilityCount > 0 ? 'Pediu disponibilidade' : null,
        reservedNegotiationCount > 0 ? 'Pediu negociacao reservada' : null,
        valueReadingCount > 0 ? 'Pediu leitura de valor' : null,
        whatsappCount > 0 ? 'Chamou no WhatsApp' : null,
        liked_property_ids.length > 0 ? `Curtiu ${liked_property_ids.length} imovel(is)` : null,
        detail_property_ids.length > 0 ? `Abriu descricao de ${detail_property_ids.length} imovel(is)` : null,
        areaSearchCount > 0 ? `Refinou ${areaSearchCount} area(s) no mapa` : null,
        preview_property_ids.length > 0 ? `Explorou ${preview_property_ids.length} preview(s) no mapa` : null,
        streetViewCount > 0 ? 'Abriu Street View' : null,
        price_history_property_ids.length > 0 ? 'Analisou historico de preco' : null,
        continuationCount > 0 ? 'Retomou salvos ou vistos recentemente' : null,
        savedSearchCount > 0 ? 'Salvou alerta de busca' : null,
        searchAlertOpenedCount > 0 ? 'Abriu match de alerta salvo' : null,
        searchAlertReceivedCount > 0 ? 'Recebeu match de alerta salvo' : null,
        selected_regions.length > 0 ? `Regiao: ${selected_regions[0]}` : null,
        searchCount > 0 ? `Fez ${searchCount} busca(s)` : null,
        contentCount > 0 ? `Clicou em ${contentCount} conteudo(s)` : null,
        viewed_property_ids.length > 0 ? `Visualizou ${viewed_property_ids.length} imovel(is)` : null,
        shared_property_ids.length > 0 ? `Compartilhou ${shared_property_ids.length} imovel(is)` : null,
        pushCount > 0 ? 'Aceitou push' : null,
    ].filter(Boolean)

    return {
        total_events: activity.length,
        event_counts,
        last_activity_at: last_activity_at || null,
        last_property_id: last_property_id || null,
        last_property_slug: last_property_slug || null,
        last_page_path: last_page_path || null,
        last_location_view: last_location_view || null,
        engagement_score: engagementScore,
        lead_classification: scoreClassification(engagementScore),
        intent_temperature: scoreTemperature(engagementScore),
        intent_signals: intentSignals,
        next_best_action: scoreNextAction({
            score: engagementScore,
            searchCount,
            likedCount: liked_property_ids.length,
            detailCount: detail_property_ids.length,
            whatsappCount,
            pushCount,
            contentCount,
            mapIntentCount,
            priceHistoryCount,
            continuationCount,
            savedSearchCount,
            searchAlertMatchCount,
            premiumIntentCount,
            privateVisitCount,
            availabilityCount,
            reservedNegotiationCount,
            valueReadingCount,
        }),
        viewed_property_ids,
        viewed_property_slugs,
        liked_property_ids,
        disliked_property_ids,
        shared_property_ids,
        whatsapp_property_ids,
        detail_property_ids,
        map_property_ids,
        preview_property_ids,
        price_history_property_ids,
        location_property_ids,
        search_alert_match_property_ids,
        search_alert_followups,
        premium_intents,
        latest_premium_intent,
        premium_intent_property_ids,
        selected_regions,
        map_area_summaries,
        last_map_intent,
        saved_search_titles,
        saved_search_count: savedSearchCount,
        search_alert_match_count: searchAlertMatchCount,
        map_area_search_count: areaSearchCount,
        map_draw_area_count: drawAreaSearchCount,
        map_bounds_search_count: boundsSearchCount,
        map_preview_count: previewCount,
        continuation_count: continuationCount,
        map_intent_count: mapIntentCount,
        location_view_count: locationViewCount,
        street_view_count: streetViewCount,
        premium_intent_count: premiumIntentCount,
        private_visit_request_count: privateVisitCount,
        availability_request_count: availabilityCount,
        reserved_negotiation_request_count: reservedNegotiationCount,
        value_reading_request_count: valueReadingCount,
    }
}

export function mergeLeadSiteActivity(metadata: unknown, eventRows: LeadActivityEventRow[]) {
    const base = asRecord(metadata)
    const existing = Array.isArray(base.site_activity)
        ? base.site_activity.map(item => asRecord(item)).filter(item => item.event_type)
        : []
    const incoming = eventRows.map(leadActivityFromEvent)
    const byKey = new Map<string, LeadActivityEntry>()

    for (const item of existing) {
        const entry = leadActivityFromEvent({
            id: asString(item.id),
            event_type: String(item.event_type || ''),
            metadata: item,
            created_at: asString(item.occurred_at),
        })
        if (entry.event_type) byKey.set(dedupeKey(entry), { ...entry, ...item } as LeadActivityEntry)
    }

    for (const entry of incoming) {
        byKey.set(dedupeKey(entry), entry)
    }

    const siteActivity = Array.from(byKey.values())
        .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())
        .slice(-ACTIVITY_LIMIT)

    return {
        ...base,
        site_activity: siteActivity,
        behavior_summary: buildBehaviorSummary(siteActivity),
    }
}

export function leadIntentColumnsFromMetadata(
    metadata: unknown,
    currentScore?: unknown,
    currentClassification?: unknown
) {
    const summary = asRecord(asRecord(metadata).behavior_summary)
    const behaviorScore = Number(summary.engagement_score || 0)
    const existingScore = Number(currentScore || 0)
    const nextScore = Math.max(
        Number.isFinite(existingScore) ? existingScore : 0,
        Number.isFinite(behaviorScore) ? behaviorScore : 0
    )

    if (!nextScore) return {}

    const shouldUseBehaviorClass = behaviorScore >= existingScore || !asString(currentClassification)

    return {
        lead_score: Math.min(100, Math.round(nextScore)),
        lead_classification: shouldUseBehaviorClass
            ? scoreClassification(nextScore)
            : asString(currentClassification),
    }
}
