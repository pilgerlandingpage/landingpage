import type { Metadata } from 'next'
import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'
import SearchResults from '@/components/marketplace/SearchResults'
import GlobalHeader from '@/components/layout/GlobalHeader'
import { JsonLd, absoluteUrl, breadcrumbJsonLd, organizationJsonLd, webPageJsonLd, DEFAULT_OG_IMAGE } from '@/lib/seo/json-ld'
import { normalizeLocationName } from '@/lib/locations/display'
import { parseNaturalSearch } from '@/lib/properties/natural-search'

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

function hasCoordinates(p: any) {
    return p.latitude && p.longitude
}

function firstParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value
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

function applyTextFilter(query: any, tag: string | undefined) {
    if (!tag) return query

    const filters: Record<string, string[]> = {
        'frente-mar': ['frente mar', 'frente ao mar', 'frente para o mar', 'beira mar', 'pe na areia', 'pé na areia'],
        'vista-mar': ['vista mar', 'vista para o mar', 'vista oceanica', 'vista panoramica'],
        'quadra-mar': ['quadra mar', 'quadra do mar', 'uma quadra do mar'],
        lancamento: ['lancamento', 'lançamento'],
        'em-construcao': ['construcao', 'construção', 'na planta'],
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

    const term = safeSearch(value)
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

function applySearchTermFilter(query: any, value: string | undefined) {
    if (!value) return query

    const term = safeSearch(value)
    const normalized = normalizeLocationName(term)

    if ([
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

    return query.or(`title.ilike.%${term}%,city.ilike.%${term}%,state.ilike.%${term}%,neighborhood.ilike.%${term}%,description.ilike.%${term}%,property_type.ilike.%${term}%,source_reference.ilike.%${term}%`)
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

export default async function SearchPage({
    searchParams
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
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
    const supabase = await createServerSupabase()
    const adminSupabase = createAdminClient()
    const resolvedParams = await searchParams

    const rawQ = firstParam(resolvedParams.q)
    const naturalSearch = parseNaturalSearch(rawQ)
    const q = naturalSearch.hasStructuredFilters ? naturalSearch.q : rawQ
    const type = firstParam(resolvedParams.type) || naturalSearch.type
    const subtype = firstParam(resolvedParams.subtype) || naturalSearch.subtype
    const city = firstParam(resolvedParams.city) || naturalSearch.city
    const tag = firstParam(resolvedParams.tag) || naturalSearch.tag
    const exclusiveOnly = asBooleanParam(resolvedParams.exclusive)
    const brokerName = firstParam(resolvedParams.broker)
    const brokerLogin = firstParam(resolvedParams.brokerLogin)
    const offer = firstParam(resolvedParams.offer)
    const price = firstParam(resolvedParams.price)
    const bedrooms = asNumber(resolvedParams.bedrooms)
    const bedroomsMin = asNumber(resolvedParams.bedroomsMin) || Number(naturalSearch.bedroomsMin || 0)
    const suites = asNumber(resolvedParams.suites)
    const suitesMin = asNumber(resolvedParams.suitesMin) || Number(naturalSearch.suitesMin || 0)
    const bathroomsMin = asNumber(resolvedParams.bathroomsMin) || Number(naturalSearch.bathroomsMin || 0)
    const parkingMin = asNumber(resolvedParams.parkingMin) || Number(naturalSearch.parkingMin || 0)
    const areaMin = asNumber(resolvedParams.areaMin) || Number(naturalSearch.areaMin || 0)
    const areaMax = asNumber(resolvedParams.areaMax) || Number(naturalSearch.areaMax || 0)
    const priceMin = asNumber(resolvedParams.priceMin) || Number(naturalSearch.priceMin || 0)
    const priceMax = asNumber(resolvedParams.priceMax) || Number(naturalSearch.priceMax || 0)
    const drawArea = parseDrawAreaParam(resolvedParams.drawArea)
    const mapBounds = parseMapBoundsParam(resolvedParams.mapBounds)
    const hasServerSpatialFilter = Boolean(drawArea || mapBounds)
    const brokerPropertyIds = await resolveBrokerPropertyIds(adminSupabase, brokerName, brokerLogin)

    const createPropertyQuery = (useSpatialFilter: boolean) => (
        useSpatialFilter && hasServerSpatialFilter
            ? supabase
                .rpc('search_active_properties_in_area', {
                    p_draw_area: drawArea,
                    p_bounds: mapBounds,
                })
                .select(SEARCH_PROPERTY_FIELDS)
            : supabase.from('properties').select(SEARCH_PROPERTY_FIELDS).eq('status', 'active')
    )

    const applyPropertyFilters = (initialQuery: any) => {
        let query = initialQuery

        query = applySearchTermFilter(query, q)

    query = applyLocationFilter(query, city)

    if (type && type !== 'Todos os Imoveis' && type !== 'Todos os Imóveis') {
        const normalizedType = type.toLowerCase()

        if (normalizedType === 'comercial') {
            query = query.or('property_type.ilike.%Comercial%,property_type.ilike.%Galpao%,property_type.ilike.%Galpão%,property_type.ilike.%Predio%,property_type.ilike.%Prédio%,title.ilike.%Comercial%,title.ilike.%Galpao%,title.ilike.%Galpão%')
        } else if (type === 'Duplex / Triplex') {
            query = query.or('property_type.ilike.%Duplex%,property_type.ilike.%Triplex%,title.ilike.%Duplex%,title.ilike.%Triplex%')
        } else if (normalizedType === 'casa em condominio') {
            query = query.or('property_type.ilike.%Casa em Condom%,title.ilike.%Casa em Condom%')
        } else {
            query = query.ilike('property_type', `%${type}%`)
        }
    }

    if (subtype === 'garden') query = query.ilike('property_type', '%Garden%')
    if (subtype === 'cobertura') query = query.ilike('property_type', '%Cobertura%')
    if (subtype === 'duplex') query = query.or('property_type.ilike.%Duplex%,property_type.ilike.%Triplex%,title.ilike.%Duplex%,title.ilike.%Triplex%')
    if (subtype === 'loft') query = query.ilike('property_type', '%Loft%')
    if (subtype === 'sobrado') query = query.ilike('property_type', '%Sobrado%')
    if (subtype === 'predio-residencial') query = query.or('property_type.ilike.%Predio Residencial%,property_type.ilike.%Predio%,property_type.ilike.%Prédio%,title.ilike.%Predio Residencial%,title.ilike.%Predio%,title.ilike.%Prédio%')
    if (subtype === 'condominio') query = query.or('property_type.ilike.%Casa em Cond%,title.ilike.%Casa%Cond%')
    if (subtype === 'terreno-condominio') query = query.or('property_type.ilike.%Terreno em Cond%,title.ilike.%Terreno%Cond%,title.ilike.%Cond%Terreno%')
    if (subtype === 'terreno-comercial') query = query.ilike('property_type', '%Terreno Comercial%')
    if (subtype === 'galpao') query = query.or('property_type.ilike.%Galpao%,property_type.ilike.%Galpão%,property_type.ilike.%Deposito%,property_type.ilike.%Depósito%,title.ilike.%Galpao%,title.ilike.%Galpão%,title.ilike.%Deposito%,title.ilike.%Depósito%')
    if (subtype === 'sala-comercial') query = query.or('property_type.ilike.%Sala Comercial%,title.ilike.%Sala Comercial%')

    let selectedPriceMin = MIN_SEARCH_PRICE
    let selectedPriceMax = 0

    if (price && price !== 'Todos os Valores') {
        const [minStr, maxStr] = price.split('-')
        const min = parseInt(minStr, 10)
        const max = maxStr ? parseInt(maxStr, 10) : 0

        if (Number.isFinite(min) && min > 0) selectedPriceMin = Math.max(MIN_SEARCH_PRICE, min)
        if (Number.isFinite(max) && max > 0) selectedPriceMax = max
    }

    if (priceMin > 0) selectedPriceMin = Math.max(MIN_SEARCH_PRICE, priceMin)
    if (priceMax > 0) selectedPriceMax = priceMax
    query = query.gte('price', selectedPriceMin)
    if (selectedPriceMax > 0) query = query.lte('price', selectedPriceMax)
    if (bedrooms > 0) query = query.eq('bedrooms', bedrooms)
    if (bedroomsMin > 0) query = query.gte('bedrooms', bedroomsMin)
    if (suites > 0) query = query.eq('suites', suites)
    if (suitesMin > 0) query = query.gte('suites', suitesMin)
    if (bathroomsMin > 0) query = query.gte('bathrooms', bathroomsMin)
    if (parkingMin > 0) query = query.gte('parking_spaces', parkingMin)
    if (areaMin > 0) query = query.gte('area_m2', areaMin)
    if (areaMax > 0) query = query.lte('area_m2', areaMax)
    if (offer === 'rent') query = query.not('rent', 'is', null)
    if (offer === 'sale') query = query.not('price', 'is', null)
    if (exclusiveOnly) query = query.eq('exclusive', true)
    if (brokerPropertyIds) {
        query = brokerPropertyIds.length > 0
            ? query.in('id', brokerPropertyIds)
            : query.eq('id', '00000000-0000-0000-0000-000000000000')
    }

        query = applyTextFilter(query, tag)

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
        lpMap[lp.property_id] = lp.slug
    })

    const propertiesWithCoords = properties?.filter(hasCoordinates) || []

    return (
        <div
            className="flex flex-col overflow-hidden bg-[#f7f7f5]"
            style={{ display: 'flex', flexDirection: 'column', height: '100dvh', minHeight: 0, overflow: 'hidden' }}
        >
            <GlobalHeader />
            <JsonLd data={jsonLd} />
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <SearchResults
                    properties={properties || []}
                    propertiesWithCoords={propertiesWithCoords}
                    lpMap={lpMap}
                    brokerSearchName={brokerName || null}
                />
            </div>
        </div>
    )
}
