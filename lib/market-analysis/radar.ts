import type { PropertyPriceHistoryRow } from '@/lib/properties/price-history'

export const MARKET_ANALYSIS_PROPERTY_SELECT = [
    'id',
    'source_slug',
    'title',
    'seo_title',
    'city',
    'state',
    'neighborhood',
    'price',
    'bedrooms',
    'bathrooms',
    'suites',
    'parking_spaces',
    'area_m2',
    'area_private_m2',
    'area_total_m2',
    'property_type',
    'exclusive',
    'source_status',
    'status',
    'description',
    'latitude',
    'longitude',
    'featured_image',
    'images',
    'condo_fee',
    'iptu',
    'created_at',
    'updated_at',
    'source_created_at',
    'source_updated_at',
].join(', ')

const MARKET_COMPARABLES_FETCH_TIMEOUT_MS = 7000

function createMarketComparablesAbortSignal(timeoutMs = MARKET_COMPARABLES_FETCH_TIMEOUT_MS) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        return AbortSignal.timeout(timeoutMs)
    }

    const controller = new AbortController()
    setTimeout(() => controller.abort(), timeoutMs)
    return controller.signal
}

export type MarketAnalysisProperty = {
    id: string
    source_slug?: string | null
    title?: string | null
    seo_title?: string | null
    city?: string | null
    state?: string | null
    neighborhood?: string | null
    price?: number | string | null
    bedrooms?: number | string | null
    bathrooms?: number | string | null
    suites?: number | string | null
    parking_spaces?: number | string | null
    area_m2?: number | string | null
    area_private_m2?: number | string | null
    area_total_m2?: number | string | null
    property_type?: string | null
    exclusive?: boolean | null
    source_status?: string | null
    status?: string | null
    description?: string | null
    latitude?: number | string | null
    longitude?: number | string | null
    condo_fee?: number | string | null
    iptu?: number | string | null
    created_at?: string | null
    updated_at?: string | null
    source_created_at?: string | null
    source_updated_at?: string | null
}

export type MarketComparable = MarketAnalysisProperty & {
    images?: string[] | null
    featured_image?: string | null
}

export type MarketConfidence = 'high' | 'medium' | 'low' | 'insufficient'

export type MarketPositioning = {
    label: string
    description: string
}

export type MarketComparableScore = {
    property: MarketComparable
    score: number
    pricePerM2: number
    distanceKm: number | null
    reasons: string[]
}

export type MarketTimelineEvent = {
    date: string
    title: string
    value: string
    note: string
}

export type MarketRadarAnalysis = {
    currentPrice: number
    currentArea: number
    currentPriceM2: number
    averageM2: number
    medianM2: number
    minM2: number
    maxM2: number
    deltaToMedian: number | null
    percentile: number | null
    comparableCount: number
    rawComparableCount: number
    outlierCount: number
    confidence: MarketConfidence
    confidenceLabel: string
    positioning: MarketPositioning
    position: number
    chartPoints: string
    comparables: MarketComparableScore[]
    criteriaSummary: string[]
    calculationSummary: string
    reading: string
    disclaimers: string[]
    timeline: MarketTimelineEvent[]
}

type BuildMarketRadarAnalysisOptions = {
    property: MarketAnalysisProperty
    candidates: MarketComparable[]
    locationLabel?: string
    priceHistoryEvents?: PropertyPriceHistoryRow[]
}

export function numericValue(value: unknown) {
    if (value === null || value === undefined || value === '') return 0
    const parsed = typeof value === 'string'
        ? Number(value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value)
        : Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

function nullableNumericValue(value: unknown) {
    const parsed = numericValue(value)
    return parsed > 0 ? parsed : null
}

export function marketArea(property: Pick<MarketAnalysisProperty, 'area_private_m2' | 'area_m2' | 'area_total_m2'>) {
    return numericValue(property.area_private_m2) || numericValue(property.area_m2) || numericValue(property.area_total_m2)
}

export function marketPricePerM2(property: Pick<MarketAnalysisProperty, 'price' | 'area_private_m2' | 'area_m2' | 'area_total_m2'>) {
    const price = numericValue(property.price)
    const area = marketArea(property)
    return price && area ? price / area : 0
}

function normalizeKey(value: unknown) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
}

function propertyTypeGroup(value: unknown) {
    const type = normalizeKey(value)
    if (/(apartamento|cobertura|duplex|triplex|garden|loft)/.test(type)) return 'apartment'
    if (/(casa|sobrado|mansao|condominio)/.test(type)) return 'house'
    if (/(terreno|lote)/.test(type)) return 'land'
    if (/(sala|loja|comercial|galpao|ponto)/.test(type)) return 'commercial'
    return type
}

function compactStatus(value: unknown) {
    const status = normalizeKey(value)
    if (/(pronto|ready|disponivel|active)/.test(status)) return 'ready'
    if (/(obra|construcao|under construction)/.test(status)) return 'under_construction'
    if (/(lancamento|launch)/.test(status)) return 'launch'
    return status
}

function coordinatesFor(property: Pick<MarketAnalysisProperty, 'latitude' | 'longitude'>) {
    const lat = nullableNumericValue(property.latitude)
    const lng = nullableNumericValue(property.longitude)
    if (lat === null || lng === null) return null
    return { lat, lng }
}

function distanceKmBetween(first: MarketAnalysisProperty, second: MarketAnalysisProperty) {
    const firstCoords = coordinatesFor(first)
    const secondCoords = coordinatesFor(second)
    if (!firstCoords || !secondCoords) return null

    const toRadians = (value: number) => (value * Math.PI) / 180
    const earthRadiusKm = 6371
    const deltaLat = toRadians(secondCoords.lat - firstCoords.lat)
    const deltaLng = toRadians(secondCoords.lng - firstCoords.lng)
    const lat1 = toRadians(firstCoords.lat)
    const lat2 = toRadians(secondCoords.lat)
    const a = Math.sin(deltaLat / 2) ** 2
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return earthRadiusKm * c
}

function medianValue(values: number[]) {
    if (!values.length) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    if (sorted.length % 2) return sorted[middle]
    return (sorted[middle - 1] + sorted[middle]) / 2
}

function quantileValue(sortedValues: number[], ratio: number) {
    if (!sortedValues.length) return 0
    const position = (sortedValues.length - 1) * ratio
    const base = Math.floor(position)
    const rest = position - base
    if (sortedValues[base + 1] === undefined) return sortedValues[base]
    return sortedValues[base] + rest * (sortedValues[base + 1] - sortedValues[base])
}

function averageValue(values: number[]) {
    if (!values.length) return 0
    return values.reduce((sum, value) => sum + value, 0) / values.length
}

function clampPercent(value: number) {
    return Math.max(0, Math.min(100, value))
}

export function formatMarketPercent(value: number | null) {
    if (value === null || !Number.isFinite(value)) return 'Sem amostra'
    const prefix = value > 0 ? '+' : ''
    return `${prefix}${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

export function marketConfidenceLabel(confidence: MarketConfidence) {
    if (confidence === 'high') return 'Alta'
    if (confidence === 'medium') return 'Média'
    if (confidence === 'low') return 'Baixa'
    return 'Insuficiente'
}

function confidenceFor(count: number): MarketConfidence {
    if (count >= 20) return 'high'
    if (count >= 8) return 'medium'
    if (count >= 3) return 'low'
    return 'insufficient'
}

export function positioningFor(deltaToMedian: number | null): MarketPositioning {
    if (deltaToMedian === null || !Number.isFinite(deltaToMedian)) {
        return {
            label: 'Dados insuficientes',
            description: 'Ainda não há comparáveis suficientes para uma leitura confiável.',
        }
    }

    if (deltaToMedian <= -25) {
        return {
            label: 'Entrada competitiva',
            description: 'Preço por m² bem abaixo da mediana dos comparáveis analisados.',
        }
    }

    if (deltaToMedian <= -10) {
        return {
            label: 'Abaixo da mediana',
            description: 'Preço por m² abaixo da mediana do recorte comparável.',
        }
    }

    if (deltaToMedian <= 10) {
        return {
            label: 'Dentro da mediana',
            description: 'Preço por m² alinhado ao centro da amostra comparável.',
        }
    }

    if (deltaToMedian <= 25) {
        return {
            label: 'Acima da mediana',
            description: 'Posicionamento premium que deve ser justificado pelos diferenciais.',
        }
    }

    return {
        label: 'Topo de mercado',
        description: 'Preço por m² acima do topo médio da amostra comparável.',
    }
}

function scoreNumericSimilarity(currentValue: unknown, candidateValue: unknown, maxScore: number, tolerance: number) {
    const current = numericValue(currentValue)
    const candidate = numericValue(candidateValue)
    if (!current || !candidate) return 0
    const difference = Math.abs(current - candidate)
    if (difference === 0) return maxScore
    if (difference <= tolerance) return Math.round(maxScore * 0.75)
    if (difference <= tolerance * 2) return Math.round(maxScore * 0.45)
    return 0
}

function scoreComparable(property: MarketAnalysisProperty, candidate: MarketComparable): MarketComparableScore | null {
    if (!candidate?.id || candidate.id === property.id) return null

    const currentPrice = numericValue(property.price)
    const currentArea = marketArea(property)
    const candidatePrice = numericValue(candidate.price)
    const candidateArea = marketArea(candidate)
    const pricePerM2 = marketPricePerM2(candidate)

    if (!currentPrice || !currentArea || !candidatePrice || !candidateArea || !pricePerM2) return null

    const currentCity = normalizeKey(property.city)
    const candidateCity = normalizeKey(candidate.city)
    const currentNeighborhood = normalizeKey(property.neighborhood)
    const candidateNeighborhood = normalizeKey(candidate.neighborhood)
    const currentType = normalizeKey(property.property_type)
    const candidateType = normalizeKey(candidate.property_type)
    const sameCity = Boolean(currentCity && candidateCity && currentCity === candidateCity)
    const sameNeighborhood = Boolean(currentNeighborhood && candidateNeighborhood && currentNeighborhood === candidateNeighborhood)
    const sameType = Boolean(currentType && candidateType && currentType === candidateType)
    const sameTypeGroup = Boolean(propertyTypeGroup(currentType) && propertyTypeGroup(currentType) === propertyTypeGroup(candidateType))
    const areaRatio = Math.abs(candidateArea - currentArea) / currentArea
    const priceRatio = candidatePrice / currentPrice
    const distanceKm = distanceKmBetween(property, candidate)
    const currentStatus = compactStatus(property.source_status || '')
    const candidateStatus = compactStatus(candidate.source_status || '')
    const reasons: string[] = []

    if (!sameCity && !sameTypeGroup) return null
    if (areaRatio > 0.65 && !sameNeighborhood) return null

    let score = 0

    if (sameNeighborhood) {
        score += 36
        reasons.push('mesmo bairro')
    } else if (sameCity) {
        score += 22
        reasons.push('mesma cidade')
    }

    if (sameType) {
        score += 22
        reasons.push('mesmo tipo')
    } else if (sameTypeGroup) {
        score += 14
        reasons.push('tipo equivalente')
    }

    if (areaRatio <= 0.3) {
        score += 18
        reasons.push('area semelhante')
    } else if (areaRatio <= 0.5) {
        score += 9
    }

    score += scoreNumericSimilarity(property.suites || property.bedrooms, candidate.suites || candidate.bedrooms, 9, 1)
    score += scoreNumericSimilarity(property.parking_spaces, candidate.parking_spaces, 7, 1)

    if (priceRatio >= 0.5 && priceRatio <= 1.75) {
        score += 8
        reasons.push('faixa de preco compativel')
    } else if (priceRatio >= 0.35 && priceRatio <= 2.1) {
        score += 3
    }

    if (distanceKm !== null) {
        if (distanceKm <= 1) {
            score += 14
            reasons.push('ate 1 km')
        } else if (distanceKm <= 3) {
            score += 9
            reasons.push('ate 3 km')
        } else if (distanceKm <= 8) {
            score += 4
        }
    }

    if (currentStatus && candidateStatus && currentStatus === candidateStatus) score += 4

    if (score < 34) return null

    return {
        property: candidate,
        score,
        pricePerM2,
        distanceKm,
        reasons,
    }
}

function trimOutliers(values: MarketComparableScore[]) {
    const sorted = [...values].sort((a, b) => a.pricePerM2 - b.pricePerM2)
    if (sorted.length <= 20) return { values: sorted, outlierCount: 0 }

    const trimCount = Math.max(1, Math.floor(sorted.length * 0.05))
    return {
        values: sorted.slice(trimCount, sorted.length - trimCount),
        outlierCount: trimCount * 2,
    }
}

function chartPointsFor(values: number[], currentPriceM2: number) {
    const chartValuesRaw = values.length >= 3
        ? [
            quantileValue(values, 0),
            quantileValue(values, 0.25),
            quantileValue(values, 0.5),
            quantileValue(values, 0.75),
            quantileValue(values, 1),
        ]
        : values

    const chartValues = chartValuesRaw.length ? chartValuesRaw : [currentPriceM2 || 1]
    const chartMin = Math.min(...chartValues, currentPriceM2 || Infinity)
    const chartMax = Math.max(...chartValues, currentPriceM2 || 0)
    const chartRange = chartMax > chartMin ? chartMax - chartMin : 1

    return chartValues.map((value, index) => {
        const x = chartValues.length === 1 ? 50 : (index / (chartValues.length - 1)) * 100
        const y = 35 - ((value - chartMin) / chartRange) * 23
        return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
}

function timelineDateLabel(value?: string | null) {
    if (!value) return 'Data sob curadoria'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Data sob curadoria'
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(date)
}

function sameCalendarDay(first?: string | null, second?: string | null) {
    if (!first || !second) return false
    const firstDate = new Date(first)
    const secondDate = new Date(second)
    if (Number.isNaN(firstDate.getTime()) || Number.isNaN(secondDate.getTime())) return false
    return firstDate.toISOString().slice(0, 10) === secondDate.toISOString().slice(0, 10)
}

function money(value?: number | string | null) {
    const amount = numericValue(value)
    if (!amount) return 'Sob consulta'
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
    }).format(amount)
}

function priceHistoryTitle(eventType: string) {
    if (eventType === 'listed') return 'Entrada no catálogo'
    if (eventType === 'price_reduced') return 'Redução de preço'
    if (eventType === 'price_increased') return 'Reajuste de preço'
    if (eventType === 'price_updated') return 'Preço atualizado'
    if (eventType === 'costs_updated') return 'Custos atualizados'
    return 'Revisão comercial'
}

function recordedTimeline(events: PropertyPriceHistoryRow[], locationLabel: string): MarketTimelineEvent[] {
    return events
        .filter(event => event?.created_at)
        .map(event => {
            const price = numericValue(event.new_price)
            const condoFee = numericValue(event.new_condo_fee)
            const iptu = numericValue(event.new_iptu)
            const previousPrice = numericValue(event.previous_price)
            const priceM2 = numericValue(event.new_price_per_m2)
            const notes = [
                previousPrice && price && previousPrice !== price ? `antes ${money(previousPrice)}` : null,
                priceM2 ? `${money(Math.round(priceM2))}/m²` : null,
                condoFee ? `condomínio ${money(condoFee)}` : null,
                iptu ? `IPTU ${money(iptu)}` : null,
            ].filter(Boolean)

            return {
                date: timelineDateLabel(event.created_at),
                title: priceHistoryTitle(event.event_type),
                value: price ? money(price) : condoFee ? `Cond. ${money(condoFee)}` : iptu ? `IPTU ${money(iptu)}` : 'Registro atualizado',
                note: notes.join(' - ') || locationLabel || 'Registro de valor do anúncio.',
            }
        })
}

function fallbackTimeline(property: MarketAnalysisProperty, currentPriceM2: number, locationLabel: string): MarketTimelineEvent[] {
    const createdAt = property.source_created_at || property.created_at
    const updatedAt = property.source_updated_at || property.updated_at
    const timeline: MarketTimelineEvent[] = [
        {
            date: timelineDateLabel(createdAt),
            title: 'Entrada no catálogo',
            value: money(property.price),
            note: locationLabel || 'Localização sob curadoria',
        },
    ]

    if (!sameCalendarDay(createdAt, updatedAt)) {
        timeline.push({
            date: timelineDateLabel(updatedAt),
            title: 'Última revisão comercial',
            value: money(property.price),
            note: currentPriceM2 ? `${money(Math.round(currentPriceM2))}/m²` : 'Preço por m² sob consulta',
        })
    }

    if (property.condo_fee) {
        timeline.push({
            date: 'Custo recorrente',
            title: 'Condomínio informado',
            value: money(property.condo_fee),
            note: 'Valor sujeito a conferência documental.',
        })
    }

    if (property.iptu) {
        timeline.push({
            date: 'Custo anual',
            title: 'IPTU informado',
            value: money(property.iptu),
            note: 'Base pública do anúncio ou importação.',
        })
    }

    return timeline
}

function readingFor(params: {
    priceM2: number
    medianM2: number
    delta: number | null
    count: number
    confidence: MarketConfidence
    positioning: MarketPositioning
}) {
    if (!params.priceM2 || !params.medianM2 || params.delta === null || params.confidence === 'insufficient') {
        return 'Ainda não temos comparáveis suficientes para uma leitura confiável deste imóvel. O sistema continuará monitorando a base para gerar uma análise mais precisa.'
    }

    const deltaText = formatMarketPercent(params.delta)
    const confidenceText = marketConfidenceLabel(params.confidence).toLowerCase()
    return `Este imóvel apresenta preço por m² de ${money(Math.round(params.priceM2))}/m², ficando ${deltaText} em relação à mediana dos comparáveis ativos analisados. A leitura indica ${params.positioning.label.toLowerCase()} dentro do recorte de ${params.count} comparáveis, com confiança ${confidenceText}. Esta análise é uma leitura de mercado baseada nos dados disponíveis e não constitui promessa de valorização ou garantia de revenda.`
}

export function buildMarketRadarAnalysis(options: BuildMarketRadarAnalysisOptions): MarketRadarAnalysis {
    const { property, candidates, locationLabel = '', priceHistoryEvents = [] } = options
    const currentPrice = numericValue(property.price)
    const currentArea = marketArea(property)
    const currentPriceM2 = currentPrice && currentArea ? currentPrice / currentArea : 0
    const rawScored = candidates
        .map(candidate => scoreComparable(property, candidate))
        .filter((item): item is MarketComparableScore => Boolean(item))
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score
            return a.pricePerM2 - b.pricePerM2
        })

    const { values: scoredComparables, outlierCount } = trimOutliers(rawScored)
    const comparableValues = scoredComparables.map(item => item.pricePerM2).sort((a, b) => a - b)
    const minM2 = comparableValues[0] || 0
    const maxM2 = comparableValues[comparableValues.length - 1] || 0
    const medianM2 = medianValue(comparableValues)
    const averageM2 = averageValue(comparableValues)
    const deltaToMedian = currentPriceM2 && medianM2 ? ((currentPriceM2 - medianM2) / medianM2) * 100 : null
    const percentile = currentPriceM2 && comparableValues.length
        ? clampPercent((comparableValues.filter(value => value <= currentPriceM2).length / comparableValues.length) * 100)
        : null
    const position = currentPriceM2 && minM2 && maxM2 && maxM2 > minM2
        ? clampPercent(((currentPriceM2 - minM2) / (maxM2 - minM2)) * 100)
        : 50
    const confidence = confidenceFor(comparableValues.length)
    const positioning = positioningFor(confidence === 'insufficient' ? null : deltaToMedian)
    const chartPoints = chartPointsFor(comparableValues, currentPriceM2)
    const timeline = recordedTimeline(priceHistoryEvents, locationLabel)
    const criteriaSummary = [
        'Preço por m² = valor anunciado dividido pela área privativa informada.',
        'Comparáveis priorizam mesmo bairro, cidade, tipo, área semelhante, suítes, vagas e proximidade geográfica.',
        outlierCount > 0 ? `${outlierCount} extremos removidos da amostra antes da mediana.` : 'Sem remoção de extremos nesta amostra.',
        'A leitura não representa avaliação oficial nem promessa de valorização.',
    ]

    const reading = readingFor({
        priceM2: currentPriceM2,
        medianM2,
        delta: deltaToMedian,
        count: comparableValues.length,
        confidence,
        positioning,
    })

    return {
        currentPrice,
        currentArea,
        currentPriceM2,
        averageM2,
        medianM2,
        minM2,
        maxM2,
        deltaToMedian,
        percentile,
        comparableCount: comparableValues.length,
        rawComparableCount: rawScored.length,
        outlierCount,
        confidence,
        confidenceLabel: marketConfidenceLabel(confidence),
        positioning,
        position,
        chartPoints,
        comparables: scoredComparables,
        criteriaSummary,
        calculationSummary: `Base: ${comparableValues.length} comparáveis qualificados de ${rawScored.length} candidatos internos ativos.`,
        reading,
        disclaimers: [
            'Análise baseada em imóveis comparáveis ativos e dados disponíveis no momento.',
            'Não representa promessa de valorização, garantia de revenda ou avaliação oficial.',
        ],
        timeline: timeline.length ? timeline : fallbackTimeline(property, currentPriceM2, locationLabel),
    }
}

export async function fetchInternalMarketComparables(supabase: any, property: MarketAnalysisProperty): Promise<MarketComparable[]> {
    const candidates = new Map<string, MarketComparable>()
    const currentPrice = numericValue(property.price)
    const currentArea = marketArea(property)
    const addCandidates = (items?: MarketComparable[] | null) => {
        for (const item of items || []) {
            if (!item?.id || item.id === property.id) continue
            candidates.set(item.id, item)
        }
    }
    const baseQuery = (limit: number) => supabase
        .from('properties')
        .select(MARKET_ANALYSIS_PROPERTY_SELECT)
        .eq('status', 'active')
        .neq('id', property.id)
        .not('price', 'is', null)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(limit)
        .abortSignal(createMarketComparablesAbortSignal())

    const queries = []

    if (property.city && property.neighborhood && property.property_type) {
        queries.push(baseQuery(90).eq('city', property.city).eq('neighborhood', property.neighborhood).eq('property_type', property.property_type))
    }

    if (property.city && property.neighborhood) {
        queries.push(baseQuery(110).eq('city', property.city).eq('neighborhood', property.neighborhood))
    }

    if (property.city && property.property_type) {
        queries.push(baseQuery(140).eq('city', property.city).eq('property_type', property.property_type))
    }

    if (property.city) {
        queries.push(baseQuery(150).eq('city', property.city))
    }

    if (currentPrice) {
        queries.push(baseQuery(140).gte('price', Math.round(currentPrice * 0.45)).lte('price', Math.round(currentPrice * 1.9)))
    }

    if (currentArea) {
        const minArea = Math.round(currentArea * 0.7)
        const maxArea = Math.round(currentArea * 1.3)
        queries.push(baseQuery(140).gte('area_private_m2', minArea).lte('area_private_m2', maxArea))
    }

    if (queries.length === 0) queries.push(baseQuery(160))

    const results = await Promise.all(queries)
    for (const result of results) {
        if (result?.error) {
            console.warn('[Market Radar] comparable query unavailable:', result.error.message)
            continue
        }
        addCandidates(result?.data)
    }

    return Array.from(candidates.values())
}
