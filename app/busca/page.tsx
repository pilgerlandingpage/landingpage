import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import SearchResults from '@/components/marketplace/SearchResults'
import GlobalHeader from '@/components/layout/GlobalHeader'
import { JsonLd, absoluteUrl, breadcrumbJsonLd, organizationJsonLd, webPageJsonLd, DEFAULT_OG_IMAGE } from '@/lib/seo/json-ld'
import { normalizeLocationName } from '@/lib/locations/display'
import { parseNaturalSearch } from '@/lib/properties/natural-search'
import { maskPublicPriceText } from '@/lib/properties/public-policy'

export const metadata: Metadata = {
    title: 'Busca de imóveis de luxo',
    description: 'Encontre apartamentos, coberturas, casas de alto padrão e imóveis frente mar no litoral catarinense. Filtre por cidade, preço e tipo de imóvel com curadoria de Guilherme Pilger.',
    alternates: {
        canonical: '/busca',
    },
    openGraph: {
        title: 'Busca de imóveis de luxo | Guilherme Pilger',
        description: 'Curadoria premium de imóveis de alto padrão no litoral catarinense. Filtre por Balneário Camboriú, Praia Brava, Itapema, coberturas, frente mar e muito mais.',
        url: '/busca',
        type: 'website',
        images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Busca de imóveis de luxo | Guilherme Pilger',
        description: 'Curadoria premium de imóveis de alto padrão no litoral catarinense. Filtre por Balneário Camboriú, Praia Brava, Itapema, coberturas, frente mar e muito mais.',
        images: [DEFAULT_OG_IMAGE],
    },
}

export const revalidate = 120

function firstParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value
}

function paramList(value: string | string[] | undefined) {
    const values = Array.isArray(value) ? value : value ? [value] : []

    return Array.from(new Set(
        values
            .flatMap(item => String(item || '').split(','))
            .map(item => safeSearch(item))
            .filter(Boolean)
    ))
}

function safeSearch(value: string) {
    return value.replace(/[(),{}]/g, ' ').trim()
}

function safeBrokerSearch(value?: string) {
    return safeSearch(value || '')
        .replace(/[%_*;:.]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80)
}

async function resolveBrokerPropertyIds(supabase: any, brokerName?: string, brokerLogin?: string) {
    const nameTerm = safeBrokerSearch(brokerName)
    const loginTerm = safeBrokerSearch(brokerLogin)
    const terms = Array.from(new Set([nameTerm, loginTerm].filter(Boolean)))

    if (terms.length === 0) return null

    const filters = terms.flatMap(term => [
        `broker_name.ilike.%${term}%`,
        `broker_login.ilike.%${term}%`,
    ])

    const { data, error } = await supabase
        .from('property_private_details')
        .select('property_id')
        .or(filters.join(','))
        .limit(2000)

    if (error) {
        console.warn('[Busca] Broker property filter unavailable:', error.message)
        return []
    }

    return Array.from(new Set((data || []).map((item: any) => String(item?.property_id || '')).filter(Boolean)))
}

function asNumber(value: string | string[] | undefined) {
    const number = Number(firstParam(value) || 0)
    return Number.isFinite(number) ? number : 0
}

function asBooleanParam(value: string | string[] | undefined) {
    const normalized = normalizeLocationName(firstParam(value) || '')
    return ['1', 'true', 'sim', 'yes'].includes(normalized)
}

type MapDrawArea = Array<[number, number]>

type MapBounds = {
    north: number
    south: number
    east: number
    west: number
}

type SearchPageParams = { [key: string]: string | string[] | undefined }

type SearchDataInput = {
    rawQ: string | undefined
    q: string | undefined
    developmentTerm: string | undefined
    type: string | undefined
    subtype: string | undefined
    city: string | undefined
    tag: string | undefined
    tags: string[]
    exclusiveOnly: boolean
    brokerName: string | undefined
    brokerLogin: string | undefined
    offer: string | undefined
    price: string | undefined
    bedrooms: number
    bedroomsMin: number
    suites: number
    suitesMin: number
    bathroomsMin: number
    parkingMin: number
    areaMin: number
    areaMax: number
    priceMin: number
    priceMax: number
    drawArea: MapDrawArea | null
    mapBounds: MapBounds | null
}

type SearchExpansion = {
    propertyIds: string[]
    sourceReferences: string[]
    sourceSlugs: string[]
}

type SearchDevelopmentResult = {
    slug: string
    name: string
    locationName: string
    priceRange: string
    availableUnitsCount: number | null
    heroImage: string
    stage: 'launch' | 'ready'
    stageLabel: string
    propertyIds: string[]
    sourceReferences: string[]
    sourceSlugs: string[]
    matchScore: number
}

function parseDrawAreaParam(value: string | string[] | undefined): MapDrawArea | null {
    const raw = firstParam(value)
    if (!raw) return null

    const points = raw
        .split(';')
        .map(pair => {
            const [latRaw, lngRaw] = pair.split(',')
            const lat = Number(latRaw)
            const lng = Number(lngRaw)

            if (
                Number.isFinite(lat) &&
                Number.isFinite(lng) &&
                lat >= -90 &&
                lat <= 90 &&
                lng >= -180 &&
                lng <= 180
            ) {
                return [lat, lng] as [number, number]
            }

            return null
        })
        .filter((point): point is [number, number] => Boolean(point))

    return points.length >= 3 ? points : null
}

function parseMapBoundsParam(value: string | string[] | undefined): MapBounds | null {
    const raw = firstParam(value)
    if (!raw) return null

    const [northRaw, southRaw, eastRaw, westRaw] = raw.split(',')
    const bounds = {
        north: Number(northRaw),
        south: Number(southRaw),
        east: Number(eastRaw),
        west: Number(westRaw),
    }

    if (
        Number.isFinite(bounds.north) &&
        Number.isFinite(bounds.south) &&
        Number.isFinite(bounds.east) &&
        Number.isFinite(bounds.west) &&
        bounds.north >= -90 &&
        bounds.north <= 90 &&
        bounds.south >= -90 &&
        bounds.south <= 90 &&
        bounds.east >= -180 &&
        bounds.east <= 180 &&
        bounds.west >= -180 &&
        bounds.west <= 180 &&
        bounds.north > bounds.south &&
        bounds.east > bounds.west
    ) {
        return bounds
    }

    return null
}

const DEVELOPMENT_RESULT_LIMIT = 6
const SEARCH_EXPANSION_IN_FILTER_LIMIT = 80

const DEVELOPMENT_STAGE_META: Record<SearchDevelopmentResult['stage'], { label: string }> = {
    launch: { label: 'Lancamentos' },
    ready: { label: 'Prontos' },
}

function asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function asArray(value: unknown): any[] {
    return Array.isArray(value) ? value : []
}

function asText(value: unknown, fallback = '') {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function asOptionalNumber(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }
    return null
}

function safePublicSearchTerm(value: string | undefined) {
    return safeSearch(value || '')
        .replace(/[%_*;:.]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100)
}

function normalizeSearchText(value: unknown) {
    return normalizeLocationName(value)
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
}

function normalizeLookupKey(value: unknown) {
    return normalizeSearchText(value)
        .replace(/\b(edificio|ed|condominio|cond|residencial|res)\b/g, ' ')
        .trim()
        .replace(/\s+/g, '')
}

function singularToken(token: string) {
    return token.endsWith('s') && token.length > 3 ? token.slice(0, -1) : token
}

function normalizedTokens(value: unknown) {
    return normalizeSearchText(value)
        .split(' ')
        .map(singularToken)
        .filter(token => token.length > 2)
}

function developmentMatchScore(candidates: unknown[], rawTerm: string) {
    const term = normalizeSearchText(rawTerm)
    const termKey = normalizeLookupKey(rawTerm)
    const termTokens = normalizedTokens(rawTerm)
    if (!term && !termKey) return 0

    let best = 0

    for (const candidate of candidates) {
        const text = normalizeSearchText(candidate)
        const key = normalizeLookupKey(candidate)
        if (!text && !key) continue

        if (text === term || key === termKey) best = Math.max(best, 100)
        if (text.startsWith(term) || (termKey.length >= 4 && key.startsWith(termKey))) best = Math.max(best, 90)
        if (term.length >= 3 && text.includes(term)) best = Math.max(best, 82)
        if (termKey.length >= 4 && key.includes(termKey)) best = Math.max(best, 76)

        const candidateTokens = normalizedTokens(candidate)
        if (candidateTokens.length > 0 && candidateTokens.every(token => termTokens.includes(token))) {
            best = Math.max(best, 72)
        }
    }

    return best
}

function firstImageFromGallery(content: Record<string, any>) {
    const development = asRecord(content.development)
    const gallery = [
        ...asArray(content.custom_gallery),
        ...asArray(development.gallery),
    ]

    for (const item of gallery) {
        if (typeof item === 'string' && item.trim()) return item.trim()
        const record = asRecord(item)
        const image = asText(record.image ?? record.url ?? record.src)
        if (image) return image
    }

    return '/placeholder-house.jpg'
}

function stageFromText(value: unknown): SearchDevelopmentResult['stage'] | null {
    const text = normalizeSearchText(value)
    if (!text) return null
    if (/\b(launch|construction|lancamento|pre lancamento|pre lancamento|na planta|em construcao|construcao|obra|em obra|entrega prevista)\b/.test(text)) return 'launch'
    if (/\b(ready|pronto|pronta|pronto para morar|entregue)\b/.test(text)) return 'ready'
    return null
}

function resolveDevelopmentStage(page: Record<string, any>, content: Record<string, any>, development: Record<string, any>) {
    return stageFromText(
        development.stage
        ?? development.status
        ?? development.constructionStatus
        ?? development.construction_status
        ?? content.development_stage
        ?? content.stage
    ) || stageFromText([
        page.title,
        content.custom_title,
        content.custom_description,
        development.name,
        development.tagline,
        development.description,
    ].filter(Boolean).join(' ')) || 'ready'
}

function collectDevelopmentUnitReferences(units: any[]) {
    const propertyIds = new Set<string>()
    const sourceReferences = new Set<string>()
    const sourceSlugs = new Set<string>()

    for (const unit of units) {
        const record = asRecord(unit)
        const propertyId = asText(record.propertyId ?? record.property_id)
        const sourceReference = asText(record.sourceReference ?? record.source_reference ?? record.id)
        const sourceSlug = asText(record.sourceSlug ?? record.source_slug ?? record.slug)

        if (propertyId) propertyIds.add(propertyId)
        if (sourceReference) sourceReferences.add(sourceReference)
        if (sourceSlug) sourceSlugs.add(sourceSlug)
    }

    return {
        propertyIds: [...propertyIds],
        sourceReferences: [...sourceReferences],
        sourceSlugs: [...sourceSlugs],
    }
}

function normalizeSearchDevelopment(page: Record<string, any>, rawTerm: string): SearchDevelopmentResult | null {
    const content = asRecord(page.content)
    const development = asRecord(content.development)
    if (Object.keys(development).length === 0) return null

    const slug = asText(page.slug)
    if (!slug) return null

    const name = asText(
        development.name,
        asText(content.custom_title, asText(page.title, 'Empreendimento'))
    )
    const aliases = [
        development.sourceCondominiumKey,
        development.source_condominium_key,
        development.sourceCondominiumName,
        development.source_condominium_name,
        ...asArray(development.sourceCondominiumAliases),
        ...asArray(development.source_condominium_aliases),
        ...asArray(asRecord(page.metadata).source_condominium_aliases),
    ]
    const candidates = [
        name,
        page.slug,
        content.custom_title,
        development.pageSlug,
        development.page_slug,
        ...aliases,
    ]
    const matchScore = developmentMatchScore(candidates, rawTerm)
    if (matchScore <= 0) return null

    const units = asArray(development.units)
    const stage = resolveDevelopmentStage(page, content, development)

    return {
        slug,
        name,
        locationName: asText(development.locationName ?? development.location_name, 'Litoral catarinense'),
        priceRange: maskPublicPriceText(asText(development.priceRange ?? development.price_range, 'Consultar valores'), 'Consultar valores'),
        availableUnitsCount: asOptionalNumber(development.availableUnitsCount ?? development.available_units_count ?? content.available_units_count) ?? (units.length || null),
        heroImage: asText(development.heroImage ?? development.hero_image ?? content.custom_hero_image, firstImageFromGallery(content)),
        stage,
        stageLabel: DEVELOPMENT_STAGE_META[stage].label,
        ...collectDevelopmentUnitReferences(units),
        matchScore,
    }
}

function mergeSearchExpansion(...items: SearchExpansion[]): SearchExpansion {
    return {
        propertyIds: Array.from(new Set(items.flatMap(item => item.propertyIds))).slice(0, SEARCH_EXPANSION_IN_FILTER_LIMIT),
        sourceReferences: Array.from(new Set(items.flatMap(item => item.sourceReferences))).slice(0, SEARCH_EXPANSION_IN_FILTER_LIMIT),
        sourceSlugs: Array.from(new Set(items.flatMap(item => item.sourceSlugs))).slice(0, SEARCH_EXPANSION_IN_FILTER_LIMIT),
    }
}

function safeInValues(values: string[]) {
    return Array.from(new Set(values))
        .map(value => String(value || '').trim())
        .filter(value => /^[a-zA-Z0-9_-]+$/.test(value))
        .slice(0, SEARCH_EXPANSION_IN_FILTER_LIMIT)
}

async function resolveDevelopmentSearch(supabase: any, rawTerm: string | undefined) {
    const term = safePublicSearchTerm(rawTerm)
    if (normalizeSearchText(term).length < 3) {
        return {
            developmentResults: [] as SearchDevelopmentResult[],
            expansion: { propertyIds: [], sourceReferences: [], sourceSlugs: [] } satisfies SearchExpansion,
        }
    }

    const [pagesResult, privateResult] = await Promise.all([
        supabase
            .from('landing_pages')
            .select('slug, title, description, content, metadata, property_id, created_at')
            .eq('status', 'published')
            .order('created_at', { ascending: true }),
        supabase
            .from('property_private_details')
            .select('property_id, source_reference, condominium_name')
            .ilike('condominium_name', `%${term}%`)
            .limit(250),
    ])

    if (pagesResult.error) {
        console.warn('[Busca] Development search unavailable:', pagesResult.error.message)
    }
    if (privateResult.error) {
        console.warn('[Busca] Private condominium expansion unavailable:', privateResult.error.message)
    }

    const developmentResults = ((pagesResult.data || []) as Array<Record<string, any>>)
        .map(page => normalizeSearchDevelopment(page, term))
        .filter((item): item is SearchDevelopmentResult => Boolean(item))
        .sort((a, b) => b.matchScore - a.matchScore || (b.availableUnitsCount || 0) - (a.availableUnitsCount || 0) || a.name.localeCompare(b.name, 'pt-BR'))
        .slice(0, DEVELOPMENT_RESULT_LIMIT)

    const developmentExpansion = mergeSearchExpansion(...developmentResults.map(result => ({
        propertyIds: result.propertyIds,
        sourceReferences: result.sourceReferences,
        sourceSlugs: result.sourceSlugs,
    })))
    const privateExpansion: SearchExpansion = {
        propertyIds: ((privateResult.data || []) as Array<Record<string, any>>).map(row => asText(row.property_id)).filter(Boolean),
        sourceReferences: ((privateResult.data || []) as Array<Record<string, any>>).map(row => asText(row.source_reference)).filter(Boolean),
        sourceSlugs: [],
    }

    return {
        developmentResults,
        expansion: mergeSearchExpansion(developmentExpansion, privateExpansion),
    }
}

function applyTextFilter(query: any, tag: string | undefined) {
    if (!tag) return query

    const filters: Record<string, string[]> = {
        'frente-mar': ['frente mar', 'frente ao mar', 'frente para o mar', 'beira mar', 'pe na areia', 'pé na areia'],
        'vista-mar': ['vista mar', 'vista para o mar', 'vista oceanica', 'vista panoramica'],
        'quadra-mar': ['quadra mar', 'quadra do mar', 'uma quadra do mar'],
        lancamento: ['lancamento', 'lançamento', 'pre lancamento', 'pré-lançamento', 'na planta', 'construcao', 'construção', 'em construcao', 'em construção', 'obra', 'em obra', 'entrega prevista'],
        'em-construcao': ['lancamento', 'lançamento', 'pre lancamento', 'pré-lançamento', 'na planta', 'construcao', 'construção', 'em construcao', 'em construção', 'obra', 'em obra', 'entrega prevista'],
        pronto: ['pronto'],
        mobiliado: ['mobiliado'],
    }

    const terms = filters[tag] || [safeSearch(tag)]
    const orFilter = terms
        .filter(Boolean)
        .flatMap(term => [
            `title.ilike.%${term}%`,
            `description.ilike.%${term}%`,
            `property_type.ilike.%${term}%`,
            `source_status.ilike.%${term}%`,
        ])
        .join(',')

    return orFilter ? query.or(orFilter) : query
}

function applyLocationFilter(query: any, value: string | undefined) {
    if (!value) return query

    const term = safeSearch(value || '')
    const normalized = normalizeLocationName(term)

    if (normalized === 'balneario camboriu' || normalized === 'bc') {
        return query.ilike('city', '%Balne%').ilike('city', '%Cambori%')
    }

    if (normalized === 'itajai' || normalized === 'praia brava') {
        return query.or('city.ilike.%Itaja%,neighborhood.ilike.%Praia Brava%,title.ilike.%Praia Brava%,description.ilike.%Praia Brava%')
    }

    if (normalized === 'porto belo') return query.ilike('city', '%Porto Belo%')
    if (normalized === 'itapema') return query.ilike('city', '%Itapema%')
    if (normalized === 'camboriu') return query.ilike('city', '%Cambori%')

    return query.or(`city.ilike.%${term}%,neighborhood.ilike.%${term}%`)
}

function buildExpansionOrFilters(expansion: SearchExpansion | null | undefined) {
    if (!expansion) return []

    const propertyIds = safeInValues(expansion.propertyIds)
    const sourceReferences = safeInValues(expansion.sourceReferences)
    const sourceSlugs = safeInValues(expansion.sourceSlugs)

    return [
        propertyIds.length ? `id.in.(${propertyIds.join(',')})` : '',
        sourceReferences.length ? `source_reference.in.(${sourceReferences.join(',')})` : '',
        sourceSlugs.length ? `source_slug.in.(${sourceSlugs.join(',')})` : '',
    ].filter(Boolean)
}

function applySearchTermFilter(query: any, value: string | undefined, expansion?: SearchExpansion) {
    const expansionFilters = buildExpansionOrFilters(expansion)
    if (!value && expansionFilters.length === 0) return query

    const term = safeSearch(value || '')
    const normalized = normalizeLocationName(term)

    if (value && [
        'balneario camboriu',
        'bc',
        'itajai',
        'praia brava',
        'porto belo',
        'itapema',
        'camboriu',
    ].includes(normalized)) {
        return applyLocationFilter(query, term)
    }

    const textFilters = value
        ? [
            `title.ilike.%${term}%`,
            `city.ilike.%${term}%`,
            `state.ilike.%${term}%`,
            `neighborhood.ilike.%${term}%`,
            `description.ilike.%${term}%`,
            `property_type.ilike.%${term}%`,
            `source_reference.ilike.%${term}%`,
        ]
        : []

    return query.or([...textFilters, ...expansionFilters].join(','))
}

const SEARCH_PROPERTY_FIELDS = [
    'id',
    'source_slug',
    'title',
    'city',
    'state',
    'price',
    'bedrooms',
    'bathrooms',
    'suites',
    'parking_spaces',
    'area_m2',
    'area_private_m2',
    'featured_image',
    'images',
    'video_url',
    'property_type',
    'exclusive',
    'latitude',
    'longitude',
    'neighborhood',
    'purpose',
    'source_status',
    'description',
    'amenities',
    'created_at',
    'updated_at',
].join(',')

const MIN_SEARCH_PRICE = 4000000
const SEARCH_PROPERTY_DESCRIPTION_LIMIT = 360
const SEARCH_PROPERTY_IMAGE_LIMIT = 6
const SEARCH_PROPERTY_AMENITY_LIMIT = 8
const COMMERCIAL_SUBTYPES = new Set(['terreno-comercial', 'galpao', 'sala-comercial'])

function shouldIncludeCommercialInventory(input: SearchDataInput) {
    const type = normalizeLocationName(input.type || '')
    const subtype = String(input.subtype || '').trim()
    const intentText = normalizeLocationName([
        input.q,
        input.tag,
        ...input.tags,
    ].filter(Boolean).join(' '))

    return (
        type === 'comercial' ||
        COMMERCIAL_SUBTYPES.has(subtype) ||
        /\b(comercial|galpao|deposito|industrial|logistico|logistica)\b/.test(intentText)
    )
}

function applyDefaultResidentialInventoryFilter(query: any) {
    return query
        .not('property_type', 'ilike', '%Comercial%')
        .not('property_type', 'ilike', '%Galp%')
        .not('property_type', 'ilike', '%Dep%')
        .not('title', 'ilike', '%Comercial%')
        .not('title', 'ilike', '%Galp%')
        .not('title', 'ilike', '%Dep%')
        .not('title', 'ilike', '%Industrial%')
        .not('title', 'ilike', '%Log%')
}

function hasExplicitPriceFilter(input: SearchDataInput) {
    return Boolean(input.price && input.price !== 'Todos os Valores') ||
        input.priceMin > 0 ||
        input.priceMax > 0 ||
        input.offer === 'sale'
}

function compactSearchProperty(property: any) {
    const description = String(property.description || '')

    return {
        ...property,
        description: description.length > SEARCH_PROPERTY_DESCRIPTION_LIMIT
            ? `${description.slice(0, SEARCH_PROPERTY_DESCRIPTION_LIMIT)}...`
            : description,
        images: Array.isArray(property.images)
            ? property.images.filter(Boolean).slice(0, SEARCH_PROPERTY_IMAGE_LIMIT)
            : property.images,
        amenities: Array.isArray(property.amenities)
            ? property.amenities.filter(Boolean).slice(0, SEARCH_PROPERTY_AMENITY_LIMIT)
            : property.amenities,
    }
}

function removeSearchPhrase(value: string, phrase: unknown) {
    const normalizedPhrase = normalizeSearchText(phrase)
    if (!normalizedPhrase) return value
    return value
        .replace(new RegExp(`\\b${normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function residualDevelopmentSearchTerm(rawQ: string | undefined, naturalSearch: ReturnType<typeof parseNaturalSearch>) {
    const raw = normalizeSearchText(rawQ)
    if (!raw) return undefined
    if (!naturalSearch.hasStructuredFilters) return rawQ

    let residual = raw
    const structuredPhrases = [
        naturalSearch.city,
        naturalSearch.type,
        naturalSearch.subtype,
        naturalSearch.tag,
        'balneario camboriu',
        'bc',
        'praia brava',
        'itajai',
        'itapema',
        'porto belo',
        'camboriu',
        'apartamento',
        'apto',
        'apt',
        'cobertura',
        'garden',
        'duplex',
        'triplex',
        'loft',
        'sobrado',
        'casa',
        'terreno',
        'comercial',
        'sala comercial',
        'galpao',
        'deposito',
        'condominio',
        'frente mar',
        'vista mar',
        'quadra mar',
        'lancamento',
        'em construcao',
        'construcao',
        'na planta',
        'pronto',
        'mobiliado',
    ]

    structuredPhrases.forEach(phrase => {
        residual = removeSearchPhrase(residual, phrase)
    })

    residual = residual
        .replace(/\b(com|de|do|da|dos|das|no|na|nos|nas|mais|acima|partir|ate|minimo|minima|maximo|maxima|quartos?|dormitorios?|suites?|banheiros?|vagas?|metros|m2|milhoes?|milhao|mi|r)\b/g, ' ')
        .replace(/\b\d+(?:[.,]\d+)?\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    return residual.length >= 3 ? residual : undefined
}

function buildSearchDataInput(resolvedParams: SearchPageParams): SearchDataInput {
    const rawQ = firstParam(resolvedParams.q)
    const naturalSearch = parseNaturalSearch(rawQ)

    return {
        rawQ,
        q: naturalSearch.hasStructuredFilters ? naturalSearch.q : rawQ,
        developmentTerm: residualDevelopmentSearchTerm(rawQ, naturalSearch),
        type: firstParam(resolvedParams.type) || naturalSearch.type,
        subtype: firstParam(resolvedParams.subtype) || naturalSearch.subtype,
        city: firstParam(resolvedParams.city) || naturalSearch.city,
        tag: firstParam(resolvedParams.tag) || naturalSearch.tag,
        tags: paramList(resolvedParams.tags),
        exclusiveOnly: asBooleanParam(resolvedParams.exclusive),
        brokerName: firstParam(resolvedParams.broker),
        brokerLogin: firstParam(resolvedParams.brokerLogin),
        offer: firstParam(resolvedParams.offer),
        price: firstParam(resolvedParams.price),
        bedrooms: asNumber(resolvedParams.bedrooms),
        bedroomsMin: asNumber(resolvedParams.bedroomsMin) || Number(naturalSearch.bedroomsMin || 0),
        suites: asNumber(resolvedParams.suites),
        suitesMin: asNumber(resolvedParams.suitesMin) || Number(naturalSearch.suitesMin || 0),
        bathroomsMin: asNumber(resolvedParams.bathroomsMin) || Number(naturalSearch.bathroomsMin || 0),
        parkingMin: asNumber(resolvedParams.parkingMin) || Number(naturalSearch.parkingMin || 0),
        areaMin: asNumber(resolvedParams.areaMin) || Number(naturalSearch.areaMin || 0),
        areaMax: asNumber(resolvedParams.areaMax) || Number(naturalSearch.areaMax || 0),
        priceMin: asNumber(resolvedParams.priceMin) || Number(naturalSearch.priceMin || 0),
        priceMax: asNumber(resolvedParams.priceMax) || Number(naturalSearch.priceMax || 0),
        drawArea: parseDrawAreaParam(resolvedParams.drawArea),
        mapBounds: parseMapBoundsParam(resolvedParams.mapBounds),
    }
}

const getCachedSearchData = unstable_cache(async (input: SearchDataInput) => {
    const supabase = createAdminClient()
    const hasServerSpatialFilter = Boolean(input.drawArea || input.mapBounds)
    const developmentSearch = await resolveDevelopmentSearch(supabase, input.q || input.developmentTerm)
    const brokerPropertyIds = await resolveBrokerPropertyIds(supabase, input.brokerName, input.brokerLogin)

    const createPropertyQuery = (useSpatialFilter: boolean) => (
        useSpatialFilter && hasServerSpatialFilter
            ? supabase
                .rpc('search_active_properties_in_area', {
                    p_draw_area: input.drawArea,
                    p_bounds: input.mapBounds,
                })
                .select(SEARCH_PROPERTY_FIELDS)
            : supabase.from('properties').select(SEARCH_PROPERTY_FIELDS).eq('status', 'active')
    )

    const applyPropertyFilters = (initialQuery: any) => {
        let query = initialQuery

        query = applySearchTermFilter(query, input.q, developmentSearch.expansion)
        query = applyLocationFilter(query, input.city)

        if (input.type && input.type !== 'Todos os Imoveis' && input.type !== 'Todos os Imóveis') {
            const normalizedType = input.type.toLowerCase()

            if (normalizedType === 'comercial') {
                query = query.or('property_type.ilike.%Comercial%,property_type.ilike.%Galpao%,property_type.ilike.%Galpão%,property_type.ilike.%Predio%,property_type.ilike.%Prédio%,title.ilike.%Comercial%,title.ilike.%Galpao%,title.ilike.%Galpão%')
            } else if (input.type === 'Duplex / Triplex') {
                query = query.or('property_type.ilike.%Duplex%,property_type.ilike.%Triplex%,title.ilike.%Duplex%,title.ilike.%Triplex%')
            } else if (normalizedType === 'casa em condominio') {
                query = query.or('property_type.ilike.%Casa em Condom%,title.ilike.%Casa em Condom%')
            } else {
                query = query.ilike('property_type', `%${input.type}%`)
            }
        }

        if (input.subtype === 'garden') query = query.ilike('property_type', '%Garden%')
        if (input.subtype === 'cobertura') query = query.ilike('property_type', '%Cobertura%')
        if (input.subtype === 'duplex') query = query.or('property_type.ilike.%Duplex%,property_type.ilike.%Triplex%,title.ilike.%Duplex%,title.ilike.%Triplex%')
        if (input.subtype === 'loft') query = query.ilike('property_type', '%Loft%')
        if (input.subtype === 'sobrado') query = query.ilike('property_type', '%Sobrado%')
        if (input.subtype === 'predio-residencial') query = query.or('property_type.ilike.%Predio Residencial%,property_type.ilike.%Predio%,property_type.ilike.%Prédio%,title.ilike.%Predio Residencial%,title.ilike.%Predio%,title.ilike.%Prédio%')
        if (input.subtype === 'condominio') query = query.or('property_type.ilike.%Casa em Cond%,title.ilike.%Casa%Cond%')
        if (input.subtype === 'terreno-condominio') query = query.or('property_type.ilike.%Terreno em Cond%,title.ilike.%Terreno%Cond%,title.ilike.%Cond%Terreno%')
        if (input.subtype === 'terreno-comercial') query = query.ilike('property_type', '%Terreno Comercial%')
        if (input.subtype === 'galpao') query = query.or('property_type.ilike.%Galpao%,property_type.ilike.%Galpão%,property_type.ilike.%Deposito%,property_type.ilike.%Depósito%,title.ilike.%Galpao%,title.ilike.%Galpão%,title.ilike.%Deposito%,title.ilike.%Depósito%')
        if (input.subtype === 'sala-comercial') query = query.or('property_type.ilike.%Sala Comercial%,title.ilike.%Sala Comercial%')

        if (!shouldIncludeCommercialInventory(input)) {
            query = applyDefaultResidentialInventoryFilter(query)
        }

        let selectedPriceMin = MIN_SEARCH_PRICE
        let selectedPriceMax = 0
        const explicitPriceFilter = hasExplicitPriceFilter(input)

        if (input.price && input.price !== 'Todos os Valores') {
            const [minStr, maxStr] = input.price.split('-')
            const min = parseInt(minStr, 10)
            const max = maxStr ? parseInt(maxStr, 10) : 0

            if (Number.isFinite(min) && min > 0) selectedPriceMin = Math.max(MIN_SEARCH_PRICE, min)
            if (Number.isFinite(max) && max > 0) selectedPriceMax = max
        }

        if (input.priceMin > 0) selectedPriceMin = Math.max(MIN_SEARCH_PRICE, input.priceMin)
        if (input.priceMax > 0) selectedPriceMax = input.priceMax
        query = explicitPriceFilter
            ? query.gte('price', selectedPriceMin)
            : query.or(`price.gte.${selectedPriceMin},price.is.null`)
        if (selectedPriceMax > 0) query = query.lte('price', selectedPriceMax)
        if (input.bedrooms > 0) query = query.eq('bedrooms', input.bedrooms)
        if (input.bedroomsMin > 0) query = query.gte('bedrooms', input.bedroomsMin)
        if (input.suites > 0) query = query.eq('suites', input.suites)
        if (input.suitesMin > 0) query = query.gte('suites', input.suitesMin)
        if (input.bathroomsMin > 0) query = query.gte('bathrooms', input.bathroomsMin)
        if (input.parkingMin > 0) query = query.gte('parking_spaces', input.parkingMin)
        if (input.areaMin > 0) query = query.gte('area_m2', input.areaMin)
        if (input.areaMax > 0) query = query.lte('area_m2', input.areaMax)
        if (input.offer === 'rent') query = query.not('rent', 'is', null)
        if (input.offer === 'sale') query = query.not('price', 'is', null)
        if (input.exclusiveOnly) query = query.eq('exclusive', true)
        if (brokerPropertyIds) {
            query = brokerPropertyIds.length > 0
                ? query.in('id', brokerPropertyIds)
                : query.eq('id', '00000000-0000-0000-0000-000000000000')
        }

        const textTags = Array.from(new Set([input.tag, ...input.tags].filter(Boolean) as string[]))
        textTags.forEach(tag => {
            query = applyTextFilter(query, tag)
        })

        return query.order('created_at', { ascending: false })
    }

    const spatialResult = await applyPropertyFilters(createPropertyQuery(hasServerSpatialFilter))
    let properties = spatialResult.data

    if (spatialResult.error && hasServerSpatialFilter) {
        console.warn('[Busca] Spatial property search failed; falling back to the regular property query.', spatialResult.error.message)
        const fallbackResult = await applyPropertyFilters(createPropertyQuery(false))
        properties = fallbackResult.data
    }

    const { data: landingPages } = await supabase
        .from('landing_pages')
        .select('slug, property_id')
        .eq('status', 'published')

    const lpMap: Record<string, string> = {}
    landingPages?.forEach((lp: any) => {
        if (lp.property_id) lpMap[lp.property_id] = lp.slug
    })
    developmentSearch.developmentResults.forEach((development) => {
        development.propertyIds.forEach((propertyId) => {
            if (propertyId && !lpMap[propertyId]) lpMap[propertyId] = development.slug
        })
    })

    return {
        developmentResults: developmentSearch.developmentResults,
        lpMap,
        properties: (properties || []).map(compactSearchProperty),
    }
}, ['public-search-data-v2'], { revalidate: 120, tags: ['public-search'] })

export default async function SearchPage({
    searchParams
}: {
    searchParams: Promise<SearchPageParams>
}) {
    const jsonLd = [
        organizationJsonLd(),
        webPageJsonLd({
            path: '/busca',
            name: 'Busca de imóveis de luxo',
            description: 'Encontre apartamentos, coberturas, casas de alto padrão e imóveis frente mar no litoral catarinense.',
            type: 'CollectionPage',
        }),
        breadcrumbJsonLd([
            { name: 'Home', url: '/' },
            { name: 'Busca', url: '/busca' },
        ]),
        {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Busca de imóveis de luxo',
            url: absoluteUrl('/busca'),
            description: 'Busca premium de imóveis de alto padrão no litoral catarinense.',
        },
    ]
    const resolvedParams = await searchParams
    const searchDataInput = buildSearchDataInput(resolvedParams)
    const { properties, lpMap, developmentResults } = await getCachedSearchData(searchDataInput)

    return (
        <div
            className="flex flex-col overflow-hidden bg-[#f7f7f5]"
            style={{ display: 'flex', flexDirection: 'column', height: '100dvh', minHeight: 0, overflow: 'hidden' }}
        >
            <GlobalHeader />
            <JsonLd data={jsonLd} />
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <SearchResults
                    properties={properties}
                    lpMap={lpMap}
                    developmentResults={developmentResults}
                    brokerSearchName={searchDataInput.brokerName || null}
                />
            </div>
        </div>
    )
}
