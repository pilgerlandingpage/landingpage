import { getPublicAppUrl } from '@/lib/app-url'
import { sendPushToVisitor } from '@/lib/push'
import { normalizeLocationName } from '@/lib/locations/display'
import {
    leadIntentColumnsFromMetadata,
    mergeLeadSiteActivity,
    type LeadActivityEventRow,
} from '@/lib/tracking/lead-activity'
import { propertyDetailsPath } from '@/lib/properties/responsive-destination'

type JsonRecord = Record<string, unknown>
type SearchParamRecord = Record<string, string | string[]>

export type SearchAlertProperty = {
    id?: string | null
    source_slug?: string | null
    title?: string | null
    description?: string | null
    seo_title?: string | null
    seo_description?: string | null
    city?: string | null
    state?: string | null
    neighborhood?: string | null
    address?: string | null
    property_type?: string | null
    price?: number | string | null
    rent?: number | string | null
    bedrooms?: number | string | null
    bathrooms?: number | string | null
    suites?: number | string | null
    parking_spaces?: number | string | null
    area_m2?: number | string | null
    area_private_m2?: number | string | null
    latitude?: number | string | null
    longitude?: number | string | null
    featured_image?: string | null
    images?: unknown
    amenities?: unknown
    status?: string | null
    source_status?: string | null
    created_at?: string | null
    updated_at?: string | null
}

export const SEARCH_ALERT_PROPERTY_MATCH_FIELDS = [
    'id',
    'source_slug',
    'title',
    'description',
    'seo_title',
    'seo_description',
    'city',
    'state',
    'neighborhood',
    'address',
    'property_type',
    'price',
    'rent',
    'bedrooms',
    'bathrooms',
    'suites',
    'parking_spaces',
    'area_m2',
    'area_private_m2',
    'latitude',
    'longitude',
    'featured_image',
    'images',
    'amenities',
    'status',
    'source_status',
    'created_at',
    'updated_at',
].join(',')

export type SavedSearchAlert = {
    id: string
    visitor_id: string | null
    lead_id?: string | null
    title?: string | null
    search_params?: unknown
    filters?: unknown
    map_bounds?: unknown
    draw_area?: unknown
    selected_region?: string | null
    notification_channels?: unknown
    metadata?: unknown
    match_count?: number | null
    last_match_property_ids?: string[] | null
}

export type SearchAlertMatch = {
    alert: SavedSearchAlert
    matchScore: number
    reasons: string[]
    notificationStatus: string
    pushSent: number
    pushFailed: number
    duplicate?: boolean
}

export type ProcessSearchAlertMatchesResult = {
    processed: boolean
    property_id: string | null
    alert_count: number
    match_count: number
    notification_sent: number
    notification_failed: number
    matches: Array<{
        alert_id: string
        title: string | null
        match_score: number
        notification_status: string
        duplicate?: boolean
    }>
    skipped_reason?: string
    error?: string
}

const MAX_ALERTS_PER_PROPERTY = 600
const DEFAULT_MIN_SEARCH_PRICE = 4000000

const TEXT_FILTERS: Record<string, string[]> = {
    'frente-mar': ['frente', 'mar'],
    'vista-mar': ['vista', 'mar'],
    'quadra-mar': ['quadra', 'mar'],
    lancamento: ['lancamento', 'lançamento'],
    'em-construcao': ['construcao', 'construção', 'na planta'],
    pronto: ['pronto'],
    mobiliado: ['mobiliado'],
}

const SUBTYPE_TERMS: Record<string, string[]> = {
    garden: ['garden'],
    cobertura: ['cobertura'],
    duplex: ['duplex', 'triplex'],
    loft: ['loft'],
    sobrado: ['sobrado'],
    'predio-residencial': ['predio residencial', 'prédio residencial', 'predio', 'prédio'],
    condominio: ['casa em condominio', 'casa em condomínio'],
    'terreno-condominio': ['terreno em condominio', 'terreno em condomínio'],
    'terreno-comercial': ['terreno comercial'],
    galpao: ['galpao', 'galpão', 'deposito', 'depósito'],
    'sala-comercial': ['sala comercial'],
}

function asRecord(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function asString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : ''
}

function asFirst(value: unknown): string {
    if (Array.isArray(value)) return asString(value[0])
    return asString(value)
}

function asNumber(value: unknown): number | null {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

function normalize(value: unknown): string {
    return normalizeLocationName(value)
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function includesAll(haystack: string, terms: string[]) {
    return terms.every(term => haystack.includes(normalize(term)))
}

function includesAny(haystack: string, terms: string[]) {
    return terms.some(term => haystack.includes(normalize(term)))
}

function hasToken(haystack: string, token: string) {
    return haystack.split(' ').includes(normalize(token))
}

function hasTokenPrefix(haystack: string, prefix: string) {
    const normalizedPrefix = normalize(prefix)
    return haystack.split(' ').some(token => token.startsWith(normalizedPrefix))
}

function propertyText(property: SearchAlertProperty): string {
    const amenities = Array.isArray(property.amenities) ? property.amenities.join(' ') : ''
    return normalize([
        property.title,
        property.description,
        property.seo_title,
        property.seo_description,
        property.city,
        property.state,
        property.neighborhood,
        property.address,
        property.property_type,
        property.source_status,
        amenities,
    ].filter(Boolean).join(' '))
}

function getParams(alert: SavedSearchAlert): SearchParamRecord {
    const raw = asRecord(alert.search_params)
    const record: SearchParamRecord = {}

    for (const [key, value] of Object.entries(raw)) {
        if (Array.isArray(value)) {
            const values = value.map(asString).filter(Boolean)
            if (values.length) record[key] = values
        } else {
            const text = asString(value)
            if (text) record[key] = text
        }
    }

    return record
}

function getParam(params: SearchParamRecord, key: string) {
    return asFirst(params[key])
}

function asStringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? value.map(asString).filter(Boolean)
        : []
}

function getAlertSearchMemory(alert: SavedSearchAlert) {
    const metadata = asRecord(alert.metadata)
    const memory = asRecord(metadata.search_memory)
    return {
        favoriteIds: asStringArray(memory.favorite_property_ids),
        recentIds: asStringArray(memory.recent_property_ids),
        favoriteCount: asNumber(memory.favorite_count) || 0,
        historyCount: asNumber(memory.history_count) || 0,
    }
}

function getNumericParam(params: SearchParamRecord, key: string) {
    return asNumber(getParam(params, key)) || 0
}

function buildLocationTerms(value: string): string[] {
    const normalized = normalize(value)
    if (!normalized) return []
    if (normalized === 'bc') return ['balneario camboriu', 'balneário camboriú']
    if (normalized === 'balneario camboriu') return ['balneario camboriu', 'balneário camboriú', 'camboriu', 'camboriú']
    if (normalized === 'praia brava' || normalized === 'itajai') return ['praia brava', 'itajai', 'itajaí']
    if (normalized === 'camboriu') return ['camboriu', 'camboriú']
    return [value]
}

function matchesLocation(property: SearchAlertProperty, value: string) {
    const haystack = propertyText(property)
    const terms = buildLocationTerms(value)
    if (!terms.length) return true
    return includesAny(haystack, terms)
}

function matchesSearchTerm(property: SearchAlertProperty, value: string) {
    const normalized = normalize(value)
    if (!normalized) return true

    if (['balneario camboriu', 'bc', 'itajai', 'praia brava', 'porto belo', 'itapema', 'camboriu'].includes(normalized)) {
        return matchesLocation(property, value)
    }

    return propertyText(property).includes(normalized)
}

function matchesType(property: SearchAlertProperty, value: string) {
    const normalizedType = normalize(value)
    if (!normalizedType || normalizedType === 'todos os imoveis') return true
    const haystack = propertyText(property)
    const propertyTypeText = normalize(property.property_type)
    const titleText = normalize(property.title)

    if (normalizedType === 'apartamento') return hasToken(propertyTypeText, 'apartamento')
    if (normalizedType === 'casa') return hasToken(propertyTypeText, 'casa')
    if (normalizedType === 'terreno') return hasToken(propertyTypeText, 'terreno')
    if (normalizedType === 'comercial') {
        return ['comercial', 'galpao', 'galpão', 'predio', 'prédio', 'sala'].some(term => hasTokenPrefix(haystack, term))
    }

    if (normalizedType === 'duplex triplex') return includesAny(haystack, ['duplex', 'triplex'])
    if (normalizedType === 'casa em condominio') return (
        hasToken(propertyTypeText, 'casa') && hasTokenPrefix(propertyTypeText, 'cond')
    ) || (
        hasToken(titleText, 'casa') && hasTokenPrefix(titleText, 'cond')
    )

    return haystack.includes(normalizedType)
}

function matchesSubtype(property: SearchAlertProperty, value: string) {
    if (!value) return true
    const haystack = propertyText(property)
    if (value === 'condominio') return includesAll(haystack, ['casa', 'cond'])
    if (value === 'terreno-condominio') return includesAll(haystack, ['terreno', 'cond'])
    if (value === 'sala-comercial') return includesAll(haystack, ['sala', 'comercial'])
    const terms = SUBTYPE_TERMS[value] || [value]
    return includesAny(haystack, terms)
}

function matchesTag(property: SearchAlertProperty, value: string) {
    if (!value) return true
    const terms = TEXT_FILTERS[value] || [value]
    const haystack = propertyText(property)
    return value === 'frente-mar' || value === 'vista-mar' || value === 'quadra-mar'
        ? includesAll(haystack, terms)
        : includesAny(haystack, terms)
}

function priceRangeFromParams(params: SearchParamRecord) {
    let min = DEFAULT_MIN_SEARCH_PRICE
    let max = getNumericParam(params, 'priceMax')
    const range = getParam(params, 'price')

    if (range && range !== 'Todos os Valores') {
        const [minRaw, maxRaw] = range.split('-')
        const parsedMin = asNumber(minRaw) || 0
        const parsedMax = asNumber(maxRaw) || 0
        if (parsedMin > 0) min = Math.max(min, parsedMin)
        if (parsedMax > 0) max = parsedMax
    }

    return { min, max }
}

function numericAtLeast(propertyValue: unknown, expected: number) {
    if (!expected) return true
    const current = asNumber(propertyValue)
    return current !== null && current >= expected
}

function numericAtMost(propertyValue: unknown, expected: number) {
    if (!expected) return true
    const current = asNumber(propertyValue)
    return current !== null && current <= expected
}

function propertyArea(property: SearchAlertProperty) {
    return asNumber(property.area_m2) || asNumber(property.area_private_m2) || null
}

function parseBounds(value: unknown) {
    const bounds = asRecord(value)
    const north = asNumber(bounds.north)
    const south = asNumber(bounds.south)
    const east = asNumber(bounds.east)
    const west = asNumber(bounds.west)
    if ([north, south, east, west].some(item => item === null)) return null
    return { north: north!, south: south!, east: east!, west: west! }
}

function parseDrawArea(value: unknown): Array<[number, number]> {
    if (!Array.isArray(value)) return []
    return value
        .map(point => {
            if (!Array.isArray(point) || point.length < 2) return null
            const lat = asNumber(point[0])
            const lng = asNumber(point[1])
            return lat === null || lng === null ? null : [lat, lng] as [number, number]
        })
        .filter((point): point is [number, number] => Boolean(point))
}

function pointInPolygon(point: [number, number], polygon: Array<[number, number]>) {
    const [lat, lng] = point
    let inside = false

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [latI, lngI] = polygon[i]
        const [latJ, lngJ] = polygon[j]
        const intersects = ((lngI > lng) !== (lngJ > lng))
            && (lat < ((latJ - latI) * (lng - lngI)) / ((lngJ - lngI) || Number.EPSILON) + latI)
        if (intersects) inside = !inside
    }

    return inside
}

function matchesMapArea(property: SearchAlertProperty, alert: SavedSearchAlert) {
    const lat = asNumber(property.latitude)
    const lng = asNumber(property.longitude)
    const drawArea = parseDrawArea(alert.draw_area)
    const bounds = parseBounds(alert.map_bounds)

    if (!drawArea.length && !bounds) return true
    if (lat === null || lng === null) return false

    if (drawArea.length >= 3 && !pointInPolygon([lat, lng], drawArea)) return false
    if (bounds && (lat > bounds.north || lat < bounds.south || lng > bounds.east || lng < bounds.west)) return false

    return true
}

function filterLabels(alert: SavedSearchAlert): string[] {
    if (!Array.isArray(alert.filters)) return []
    return alert.filters
        .map(item => asString(asRecord(item).label))
        .filter(Boolean)
        .slice(0, 5)
}

function pushChannels(alert: SavedSearchAlert) {
    return Array.isArray(alert.notification_channels)
        ? alert.notification_channels.map(asString).filter(Boolean)
        : ['push']
}

function propertyPriceText(property: SearchAlertProperty) {
    const price = asNumber(property.price)
    if (!price) return null
    return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function propertyLocationText(property: SearchAlertProperty) {
    return [property.neighborhood, property.city].map(asString).filter(Boolean).join(' - ')
}

function propertyDetailsUrl(property: SearchAlertProperty, alertId: string, medium = 'whatsapp') {
    if (!property.id) return getPublicAppUrl()
    return `${getPublicAppUrl()}${propertyDetailsPath(property)}?utm_source=crm&utm_medium=${encodeURIComponent(medium)}&utm_campaign=property_search_alert&alert_id=${encodeURIComponent(alertId)}`
}

function sentenceList(items: string[], max = 3) {
    const clean = items.map(asString).filter(Boolean).slice(0, max)
    if (clean.length <= 1) return clean[0] || ''
    return `${clean.slice(0, -1).join(', ')} e ${clean[clean.length - 1]}`
}

function matchPriority(score: number) {
    if (score >= 85) return 'alta'
    if (score >= 70) return 'media'
    return 'normal'
}

function buildMatchFollowup(property: SearchAlertProperty, alert: SavedSearchAlert, reasons: string[], score: number) {
    const propertyId = asString(property.id)
    const title = asString(property.title) || 'uma nova oportunidade'
    const alertTitle = asString(alert.title)
    const price = propertyPriceText(property)
    const location = propertyLocationText(property)
    const reasonText = sentenceList(reasons)
    const propertyUrl = propertyDetailsUrl(property, alert.id)
    const context = [price ? `Valor: ${price}` : null, location ? `Localizacao: ${location}` : null].filter(Boolean).join(' | ')
    const message = [
        `Oi! Separei uma oportunidade de curadoria que encaixa na sua busca salva${alertTitle ? ` (${alertTitle})` : ''}: ${title}.`,
        context,
        reasonText ? `Pontos de encaixe: ${reasonText}.` : 'Ela combina com os criterios que voce salvou.',
        `Quer que eu te mande fotos, contexto da rua, liquidez e uma leitura rapida de valor? ${propertyUrl}`,
    ].filter(Boolean).join('\n')

    return {
        channel: 'whatsapp',
        title: 'Retomar alerta salvo',
        priority: matchPriority(score),
        message,
        property_url: propertyUrl,
        property_title: title,
        price_text: price,
        location: location || null,
        match_score: score,
        match_reasons: reasons,
    }
}

function buildMatchMetadata(property: SearchAlertProperty, alert: SavedSearchAlert, reasons: string[], score: number, source: string) {
    const propertyId = asString(property.id)
    const suggestedFollowup = buildMatchFollowup(property, alert, reasons, score)
    return {
        event_label: 'Match de alerta de busca',
        alert_id: alert.id,
        alert_title: alert.title || null,
        property_id: propertyId || null,
        title: property.title || null,
        property_title: property.title || null,
        price: asNumber(property.price),
        city: property.city || null,
        neighborhood: property.neighborhood || null,
        property_type: property.property_type || null,
        match_score: score,
        match_reasons: reasons,
        selected_region: alert.selected_region || null,
        active_filters: filterLabels(alert),
        search_memory: getAlertSearchMemory(alert),
        property_url: suggestedFollowup.property_url,
        suggested_followup: suggestedFollowup,
        suggested_whatsapp_message: suggestedFollowup.message,
        followup_priority: suggestedFollowup.priority,
        source,
        page_path: propertyId ? propertyDetailsPath(property) : null,
    }
}

function matchPropertyToAlert(property: SearchAlertProperty, alert: SavedSearchAlert) {
    const params = getParams(alert)
    const failures: string[] = []
    const reasons: string[] = []
    const selectedRegion = asString(alert.selected_region)
    const q = getParam(params, 'q')
    const city = getParam(params, 'city')
    const type = getParam(params, 'type')
    const subtype = getParam(params, 'subtype')
    const tag = getParam(params, 'tag')
    const { min: priceMin, max: priceMax } = priceRangeFromParams(params)
    const propertyPrice = asNumber(property.price)
    const offer = getParam(params, 'offer')
    const area = propertyArea(property)
    const propertyId = asString(property.id)
    const searchMemory = getAlertSearchMemory(alert)

    if (q && !matchesSearchTerm(property, q)) failures.push('Termo de busca diferente')
    else if (q) reasons.push('Termo de busca compatível')

    if (city && !matchesLocation(property, city)) failures.push('Cidade/bairro diferente')
    else if (city) reasons.push('Localização compatível')

    if (selectedRegion && !matchesLocation(property, selectedRegion)) failures.push('Fora da região selecionada')
    else if (selectedRegion) reasons.push('Região selecionada compatível')

    if (type && !matchesType(property, type)) failures.push('Tipo diferente')
    else if (type) reasons.push('Tipo compatível')

    if (subtype && !matchesSubtype(property, subtype)) failures.push('Subtipo diferente')
    else if (subtype) reasons.push('Subtipo compatível')

    if (tag && !matchesTag(property, tag)) failures.push('Tag diferente')
    else if (tag) reasons.push('Característica compatível')

    if (priceMin > 0 && (!propertyPrice || propertyPrice < priceMin)) failures.push('Preço abaixo do mínimo')
    else if (priceMin > 0) reasons.push('Preço acima do mínimo')

    if (priceMax > 0 && (!propertyPrice || propertyPrice > priceMax)) failures.push('Preço acima do máximo')
    else if (priceMax > 0) reasons.push('Preço dentro do teto')

    if (!numericAtLeast(property.bedrooms, getNumericParam(params, 'bedroomsMin'))) failures.push('Dormitórios abaixo do desejado')
    else if (getNumericParam(params, 'bedroomsMin') > 0) reasons.push('Dormitórios compatíveis')

    const bedroomsExact = getNumericParam(params, 'bedrooms')
    if (bedroomsExact > 0 && asNumber(property.bedrooms) !== bedroomsExact) failures.push('Quantidade de dormitórios diferente')
    else if (bedroomsExact > 0) reasons.push('Dormitórios exatos')

    if (!numericAtLeast(property.suites, getNumericParam(params, 'suitesMin'))) failures.push('Suítes abaixo do desejado')
    else if (getNumericParam(params, 'suitesMin') > 0) reasons.push('Suítes compatíveis')

    const suitesExact = getNumericParam(params, 'suites')
    if (suitesExact > 0 && asNumber(property.suites) !== suitesExact) failures.push('Quantidade de suítes diferente')
    else if (suitesExact > 0) reasons.push('Suítes exatas')

    if (!numericAtLeast(property.bathrooms, getNumericParam(params, 'bathroomsMin'))) failures.push('Banheiros abaixo do desejado')
    else if (getNumericParam(params, 'bathroomsMin') > 0) reasons.push('Banheiros compatíveis')

    if (!numericAtLeast(property.parking_spaces, getNumericParam(params, 'parkingMin'))) failures.push('Vagas abaixo do desejado')
    else if (getNumericParam(params, 'parkingMin') > 0) reasons.push('Vagas compatíveis')

    const areaMin = getNumericParam(params, 'areaMin')
    const areaMax = getNumericParam(params, 'areaMax')
    if (areaMin > 0 && (!area || area < areaMin)) failures.push('Área abaixo do mínimo')
    else if (areaMin > 0) reasons.push('Área acima do mínimo')
    if (areaMax > 0 && (!area || area > areaMax)) failures.push('Área acima do máximo')
    else if (areaMax > 0) reasons.push('Área dentro do teto')

    if (offer === 'rent' && !asNumber(property.rent)) failures.push('Não é locação')
    if (offer === 'sale' && !asNumber(property.price)) failures.push('Não é venda')

    if (!matchesMapArea(property, alert)) failures.push('Fora da área do mapa')
    else if (parseDrawArea(alert.draw_area).length || parseBounds(alert.map_bounds)) reasons.push('Dentro da área do mapa')

    if (propertyId && searchMemory.favoriteIds.includes(propertyId)) reasons.push('Ja estava entre os favoritos do lead')
    if (propertyId && searchMemory.recentIds.includes(propertyId)) reasons.push('Imovel revisitado pelo lead')
    if (searchMemory.favoriteCount > 1) reasons.push('Busca criada depois de comparar favoritos')
    if (propertyPrice && propertyPrice >= DEFAULT_MIN_SEARCH_PRICE) reasons.push('Faixa premium acima de R$ 4 milhoes')

    if (failures.length) return { matches: false, score: 0, reasons, failures }

    const score = Math.max(45, Math.min(100, 45 + reasons.length * 8))
    return {
        matches: true,
        score,
        reasons: reasons.length ? reasons : ['Busca salva sem filtros restritivos'],
        failures,
    }
}

async function appendMatchLeadActivity(params: {
    supabase: any
    visitorId: string | null
    leadId: string | null | undefined
    eventRow: LeadActivityEventRow | null
}) {
    if (!params.visitorId || !params.leadId || !params.eventRow?.event_type) return

    const { data: lead } = await params.supabase
        .from('leads')
        .select('id, metadata, lead_score, lead_classification')
        .eq('id', params.leadId)
        .maybeSingle()

    if (!lead?.id) return

    await params.supabase
        .from('funnel_events')
        .update({ lead_id: lead.id })
        .eq('visitor_id', params.visitorId)
        .is('lead_id', null)

    const { data: eventRows } = await params.supabase
        .from('funnel_events')
        .select('id, event_type, metadata, created_at')
        .eq('visitor_id', params.visitorId)
        .order('created_at', { ascending: false })
        .limit(120)

    const nextMetadata = mergeLeadSiteActivity(
        lead.metadata || {},
        ((eventRows?.length ? eventRows : [params.eventRow]) as LeadActivityEventRow[]).reverse()
    )

    await params.supabase
        .from('leads')
        .update({
            metadata: nextMetadata,
            ...leadIntentColumnsFromMetadata(
                nextMetadata,
                lead.lead_score,
                lead.lead_classification
            ),
            updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id)
}

async function fetchActiveAlerts(supabase: any, limit = MAX_ALERTS_PER_PROPERTY): Promise<SavedSearchAlert[]> {
    const { data, error } = await supabase
        .from('property_search_alerts')
        .select('id,visitor_id,lead_id,title,search_params,filters,map_bounds,draw_area,selected_region,notification_channels,metadata,match_count,last_match_property_ids')
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(limit)

    if (error) throw error
    return (data || []) as SavedSearchAlert[]
}

async function registerMatch(params: {
    supabase: any
    property: SearchAlertProperty
    alert: SavedSearchAlert
    score: number
    reasons: string[]
    source: string
}) {
    const propertyId = asString(params.property.id)
    const channels = pushChannels(params.alert)
    const metadata = buildMatchMetadata(params.property, params.alert, params.reasons, params.score, params.source)
    const { data, error } = await params.supabase
        .from('property_search_alert_matches')
        .insert({
            alert_id: params.alert.id,
            visitor_id: params.alert.visitor_id,
            lead_id: params.alert.lead_id || null,
            property_id: propertyId,
            match_score: params.score,
            match_reasons: params.reasons,
            notification_channels: channels,
            notification_status: 'queued',
            metadata,
        })
        .select('id')
        .single()

    if (error?.code === '23505') return { matchId: null, duplicate: true, metadata, channels }
    if (error) throw error

    return { matchId: data?.id as string | null, duplicate: false, metadata, channels }
}

async function updateAlertAfterMatch(params: {
    supabase: any
    alert: SavedSearchAlert
    propertyId: string
    sent: number
}) {
    const recentIds = [
        params.propertyId,
        ...(params.alert.last_match_property_ids || []).filter(id => id !== params.propertyId),
    ].slice(0, 24)
    const update: JsonRecord = {
        last_matched_at: new Date().toISOString(),
        last_match_property_ids: recentIds,
        match_count: Number(params.alert.match_count || 0) + 1,
        updated_at: new Date().toISOString(),
    }

    if (params.sent > 0) update.last_notified_at = new Date().toISOString()

    await params.supabase
        .from('property_search_alerts')
        .update(update)
        .eq('id', params.alert.id)
}

async function notifyMatch(params: {
    supabase: any
    matchId: string | null
    property: SearchAlertProperty
    alert: SavedSearchAlert
    channels: string[]
}) {
    const propertyId = asString(params.property.id)
    const url = `${getPublicAppUrl()}${propertyDetailsPath(params.property)}?utm_source=push&utm_medium=push&utm_campaign=property_search_alert&alert_id=${encodeURIComponent(params.alert.id)}`
    let pushSent = 0
    let pushFailed = 0
    let notificationStatus = 'queued'

    if (!params.alert.visitor_id) {
        notificationStatus = 'no_visitor'
    } else if (!params.channels.includes('push')) {
        notificationStatus = 'channel_skipped'
    } else {
        const title = 'Novo imóvel no seu alerta'
        const location = propertyLocationText(params.property)
        const price = propertyPriceText(params.property)
        const body = [
            asString(params.property.title) || 'Uma nova oportunidade',
            price,
            location,
        ].filter(Boolean).join(' | ')
        const push = await sendPushToVisitor(params.alert.visitor_id, {
            title,
            body,
            url,
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            data: {
                type: 'property_search_alert_match',
                alert_id: params.alert.id,
                property_id: propertyId,
            },
        })
        pushSent = push.sent
        pushFailed = push.failed
        notificationStatus = push.sent > 0 ? 'sent' : push.failed > 0 ? 'failed' : 'no_subscription'
    }

    if (params.matchId) {
        await params.supabase
            .from('property_search_alert_matches')
            .update({
                notification_status: notificationStatus,
                notified_at: pushSent > 0 ? new Date().toISOString() : null,
            })
            .eq('id', params.matchId)
    }

    return { notificationStatus, pushSent, pushFailed }
}

export async function processPropertySearchAlerts(
    supabase: any,
    property: SearchAlertProperty,
    options: { source?: string; limit?: number } = {}
): Promise<ProcessSearchAlertMatchesResult> {
    const propertyId = asString(property.id)
    if (!propertyId) {
        return {
            processed: false,
            property_id: null,
            alert_count: 0,
            match_count: 0,
            notification_sent: 0,
            notification_failed: 0,
            matches: [],
            skipped_reason: 'missing_property_id',
        }
    }

    if (property.status && property.status !== 'active') {
        return {
            processed: false,
            property_id: propertyId,
            alert_count: 0,
            match_count: 0,
            notification_sent: 0,
            notification_failed: 0,
            matches: [],
            skipped_reason: 'property_not_active',
        }
    }

    const source = options.source || 'property_update'
    const alerts = await fetchActiveAlerts(supabase, options.limit || MAX_ALERTS_PER_PROPERTY)
    const matches: SearchAlertMatch[] = []
    let notificationSent = 0
    let notificationFailed = 0

    for (const alert of alerts) {
        const result = matchPropertyToAlert(property, alert)
        if (!result.matches) continue

        const registered = await registerMatch({
            supabase,
            property,
            alert,
            score: result.score,
            reasons: result.reasons,
            source,
        })

        if (registered.duplicate) {
            matches.push({
                alert,
                matchScore: result.score,
                reasons: result.reasons,
                notificationStatus: 'duplicate',
                pushSent: 0,
                pushFailed: 0,
                duplicate: true,
            })
            continue
        }

        const eventMetadata = buildMatchMetadata(property, alert, result.reasons, result.score, source)
        const { data: eventRow, error: eventError } = await supabase
            .from('funnel_events')
            .insert({
                visitor_id: alert.visitor_id,
                lead_id: alert.lead_id || null,
                event_type: 'property_search_alert_matched',
                metadata: eventMetadata,
            })
            .select('id, event_type, metadata, created_at')
            .single()

        if (eventError) {
            console.warn('[Search Alert Matcher] funnel event skipped:', eventError.message)
        }

        await appendMatchLeadActivity({
            supabase,
            visitorId: alert.visitor_id,
            leadId: alert.lead_id,
            eventRow: eventRow as LeadActivityEventRow | null,
        })

        const notification = await notifyMatch({
            supabase,
            matchId: registered.matchId,
            property,
            alert,
            channels: registered.channels,
        })

        await updateAlertAfterMatch({
            supabase,
            alert,
            propertyId,
            sent: notification.pushSent,
        })

        notificationSent += notification.pushSent
        notificationFailed += notification.pushFailed
        matches.push({
            alert,
            matchScore: result.score,
            reasons: result.reasons,
            notificationStatus: notification.notificationStatus,
            pushSent: notification.pushSent,
            pushFailed: notification.pushFailed,
        })
    }

    return {
        processed: true,
        property_id: propertyId,
        alert_count: alerts.length,
        match_count: matches.filter(match => !match.duplicate).length,
        notification_sent: notificationSent,
        notification_failed: notificationFailed,
        matches: matches.map(match => ({
            alert_id: match.alert.id,
            title: match.alert.title || null,
            match_score: match.matchScore,
            notification_status: match.notificationStatus,
            ...(match.duplicate ? { duplicate: true } : {}),
        })),
    }
}
