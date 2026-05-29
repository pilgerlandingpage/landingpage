type JsonRecord = Record<string, unknown>

export type LeadActivityEntry = {
    id?: string
    event_type: string
    label: string
    occurred_at: string
    property_id?: string
    target_property_id?: string
    property_title?: string
    page_path?: string
    page_title?: string
    detail?: string
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
        || eventType === 'property_feed_desktop_redirected_to_details'
        || eventType === 'property_details_landing_viewed'
        || eventType === 'property_details_landing_anchor_clicked'
        || eventType === 'property_details_landing_gallery_opened'
        || eventType === 'property_details_landing_map_clicked'
        || eventType === 'property_details_landing_related_clicked'
    ) {
        return asString(metadata.title)
            || asString(metadata.link_label)
            || asString(metadata.target_section)
            || asString(metadata.destination)
    }

    if (eventType === 'property_map_quick_filter_clicked') {
        return asString(metadata.filter_label)
    }

    if (eventType === 'property_map_style_changed') {
        return asString(metadata.style_label)
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
        case 'search_results_filter_removed':
            return 'Removeu filtro da busca'
        case 'search_results_clear_clicked':
            return 'Limpou resultados da busca'
        case 'search_results_adjust_filters_clicked':
            return 'Voltou para ajustar filtros'
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
    const propertyId = asString(metadata.property_id)
        || asString(metadata.from_property_id)
        || asString(metadata.lead_property_id)
    const targetPropertyId = asString(metadata.target_property_id)
        || asString(metadata.to_property_id)

    return {
        ...(row.id ? { id: row.id } : {}),
        event_type: row.event_type,
        label: eventLabel(row.event_type, metadata),
        occurred_at: row.created_at || new Date().toISOString(),
        ...(propertyId ? { property_id: propertyId } : {}),
        ...(targetPropertyId ? { target_property_id: targetPropertyId } : {}),
        ...(asString(metadata.title) ? { property_title: asString(metadata.title) } : {}),
        ...(asString(metadata.page_path) ? { page_path: asString(metadata.page_path) } : {}),
        ...(asString(metadata.page_title) ? { page_title: asString(metadata.page_title) } : {}),
        ...(eventDetail(row.event_type, metadata) ? { detail: eventDetail(row.event_type, metadata) } : {}),
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
}) {
    if (params.whatsappCount > 0) return 'Responder com curadoria direta e pedir criterio de decisao.'
    if (params.likedCount > 0) return 'Retomar pelos imoveis curtidos e oferecer alternativas parecidas.'
    if (params.detailCount > 0) return 'Usar os imoveis abertos como ponto de comparacao.'
    if (params.searchCount > 0) return 'Enviar uma selecao curta baseada nos filtros usados.'
    if (params.contentCount > 0) return 'Puxar conversa pelo conteudo clicado e conectar com uma oportunidade relevante.'
    if (params.pushCount > 0) return 'Nutrir com oportunidade forte e chamada leve para WhatsApp.'
    if (params.score >= 40) return 'Acompanhar com mensagem consultiva curta.'
    return 'Continuar coletando sinais antes de abordar forte.'
}

function buildBehaviorSummary(activity: LeadActivityEntry[]) {
    let viewed_property_ids: string[] = []
    let liked_property_ids: string[] = []
    let disliked_property_ids: string[] = []
    let shared_property_ids: string[] = []
    let whatsapp_property_ids: string[] = []
    let detail_property_ids: string[] = []
    let last_property_id: string | undefined
    let last_page_path: string | undefined
    let last_activity_at: string | undefined
    const event_counts: Record<string, number> = {}

    for (const entry of activity) {
        event_counts[entry.event_type] = (event_counts[entry.event_type] || 0) + 1
        const propertyId = entry.property_id || entry.target_property_id
        if (propertyId) last_property_id = propertyId
        if (entry.page_path) last_page_path = entry.page_path
        last_activity_at = entry.occurred_at

        if (
            entry.event_type === 'property_feed_slide_viewed'
            || entry.event_type === 'home_property_mobile_feed_clicked'
            || entry.event_type === 'property_details_landing_viewed'
        ) {
            viewed_property_ids = addRecent(viewed_property_ids, propertyId)
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
            || entry.event_type === 'property_feed_desktop_redirected_to_details'
            || entry.event_type === 'property_details_landing_viewed'
            || entry.event_type === 'property_details_landing_anchor_clicked'
            || entry.event_type === 'property_details_landing_gallery_opened'
            || entry.event_type === 'property_details_landing_map_clicked'
        ) {
            detail_property_ids = addRecent(detail_property_ids, propertyId)
        }
    }

    const searchCount = countEvents(event_counts, [
        'home_search_submitted',
        'home_map_search_submitted',
    ])
    const filterCount = countEvents(event_counts, [
        'home_map_filter_changed',
        'home_map_feature_filter_toggled',
        'property_map_quick_filter_clicked',
        'search_results_filter_removed',
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
        'property_map_style_changed',
        'property_details_landing_map_clicked',
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
        + Math.min(12, mapIntentCount * 4)
        + pushCount * 12
        - disliked_property_ids.length * 2
        + recencyBoost
    )))
    const intentSignals = [
        whatsappCount > 0 ? 'Chamou no WhatsApp' : null,
        liked_property_ids.length > 0 ? `Curtiu ${liked_property_ids.length} imovel(is)` : null,
        detail_property_ids.length > 0 ? `Abriu descricao de ${detail_property_ids.length} imovel(is)` : null,
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
        last_page_path: last_page_path || null,
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
        }),
        viewed_property_ids,
        liked_property_ids,
        disliked_property_ids,
        shared_property_ids,
        whatsapp_property_ids,
        detail_property_ids,
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
