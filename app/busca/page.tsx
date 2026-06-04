import type { Metadata } from 'next'
import { createServerSupabase } from '@/lib/supabase/server'
import SearchResults from '@/components/marketplace/SearchResults'
import GlobalHeader from '@/components/layout/GlobalHeader'
import { JsonLd, absoluteUrl, breadcrumbJsonLd, organizationJsonLd, webPageJsonLd, DEFAULT_OG_IMAGE } from '@/lib/seo/json-ld'
import { normalizeLocationName } from '@/lib/locations/display'

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

function asNumber(value: string | string[] | undefined) {
    const number = Number(firstParam(value) || 0)
    return Number.isFinite(number) ? number : 0
}

function applyTextFilter(query: any, tag: string | undefined) {
    if (!tag) return query

    const filters: Record<string, string[]> = {
        'frente-mar': ['frente', 'mar'],
        'vista-mar': ['vista', 'mar'],
        'quadra-mar': ['quadra', 'mar'],
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
    'title',
    'city',
    'state',
    'price',
    'bedrooms',
    'bathrooms',
    'suites',
    'parking_spaces',
    'area_m2',
    'featured_image',
    'property_type',
    'exclusive',
    'latitude',
    'longitude',
    'neighborhood',
    'purpose',
    'source_status',
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
    const resolvedParams = await searchParams

    const q = firstParam(resolvedParams.q)
    const type = firstParam(resolvedParams.type)
    const subtype = firstParam(resolvedParams.subtype)
    const city = firstParam(resolvedParams.city)
    const tag = firstParam(resolvedParams.tag)
    const offer = firstParam(resolvedParams.offer)
    const price = firstParam(resolvedParams.price)
    const bedrooms = asNumber(resolvedParams.bedrooms)
    const bedroomsMin = asNumber(resolvedParams.bedroomsMin)
    const suites = asNumber(resolvedParams.suites)
    const suitesMin = asNumber(resolvedParams.suitesMin)
    const bathroomsMin = asNumber(resolvedParams.bathroomsMin)
    const parkingMin = asNumber(resolvedParams.parkingMin)
    const areaMin = asNumber(resolvedParams.areaMin)
    const areaMax = asNumber(resolvedParams.areaMax)
    const priceMin = asNumber(resolvedParams.priceMin)
    const priceMax = asNumber(resolvedParams.priceMax)

    let query = supabase.from('properties').select(SEARCH_PROPERTY_FIELDS).eq('status', 'active')

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
    if (subtype === 'condominio') query = query.or('property_type.ilike.%Condominio%,property_type.ilike.%Condomínio%')
    if (subtype === 'terreno-condominio') query = query.or('property_type.ilike.%Terreno em Condominio%,property_type.ilike.%Terreno em Condomínio%')
    if (subtype === 'terreno-comercial') query = query.ilike('property_type', '%Terreno Comercial%')
    if (subtype === 'galpao') query = query.or('property_type.ilike.%Galpao%,property_type.ilike.%Galpão%,property_type.ilike.%Deposito%,property_type.ilike.%Depósito%,title.ilike.%Galpao%,title.ilike.%Galpão%,title.ilike.%Deposito%,title.ilike.%Depósito%')
    if (subtype === 'sala-comercial') query = query.or('property_type.ilike.%Sala Comercial%,property_type.ilike.%Comercial%,title.ilike.%Sala Comercial%')

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

    query = applyTextFilter(query, tag)

    const { data: properties } = await query.order('created_at', { ascending: false })

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
                />
            </div>
        </div>
    )
}
