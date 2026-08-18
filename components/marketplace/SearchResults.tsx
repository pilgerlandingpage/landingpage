'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, BellRing, Building2, Check, Clock3, Heart, Home, Loader2, MapPin, MapPinned, Search, SearchX, Sparkles, X } from 'lucide-react'
import MapSearch from './MapSearch'
import SearchViews from './SearchViews'
import PropertyCard from './PropertyCard'
import MapPropertyPreviewCard from './MapPropertyPreviewCard'
import { orderPropertiesBySmoothGeoPath } from './mapRecommendationOrder'
import SearchAlertsPanel from './SearchAlertsPanel'
import HomeSearchBar, { type HomeSearchValues } from './HomeSearchBar'
import type { MapDrawArea, MapSearchFilters } from './PropertyMap'
import { replaceItajaiWithPraiaBrava } from '@/lib/locations/display'
import { findMapRegionByText, findMapRegionForSearchParams } from '@/lib/locations/map-regions'
import { propertyDetailsPath } from '@/lib/properties/responsive-destination'
import { getVisitorId, trackEvent } from '@/lib/tracking/client'

const MAX_RENDERED_CARDS = 60
const MAX_MAP_PREVIEW_PROPERTIES = 18
const FAVORITES_KEY = 'pilger_property_favorites'
const HISTORY_KEY = 'pilger_property_history'
const MAX_MEMORY_PROPERTIES = 10
const OFFICE_SEARCH_PARAM_VALUE = '1'
const DEVELOPMENT_SEARCH_CATEGORY_VALUE = 'empreendimentos'
const MAP_PROPERTY_PARAM = 'mapProperty'
const DRAW_AREA_PARAM = 'drawArea'
const MAP_BOUNDS_PARAM = 'mapBounds'
const SEARCH_MAP_SERVICE_AREA_BOUNDS = {
    north: -25.0,
    south: -30.5,
    east: -47.0,
    west: -54.5,
}
const MAP_FILTER_PARAM_KEYS = [
    'offer',
    'type',
    'price',
    'priceMin',
    'priceMax',
    'bedroomsMin',
    'suitesMin',
    'parkingMin',
    'areaMin',
    'areaMax',
    'exclusive',
    'tag',
    'tags',
]
type SearchMemorySource = 'favorite' | 'history'

type SearchDevelopmentResult = {
    slug: string
    name: string
    locationName: string
    priceRange: string
    availableUnitsCount: number | null
    heroImage: string
    latitude?: number | null
    longitude?: number | null
    stage: 'launch' | 'ready'
    stageLabel: string
    propertyIds?: string[]
    sourceReferences?: string[]
    sourceSlugs?: string[]
}

function isDevelopmentSearchCategory(value: string | null) {
    const normalized = String(value || '').trim().toLowerCase()
    return ['empreendimento', DEVELOPMENT_SEARCH_CATEGORY_VALUE, 'development', 'developments'].includes(normalized)
}

const OFFICE_LOCATION_MARKER = {
    latLng: [-26.9567429, -48.629818] as [number, number],
    title: 'Imobiliária Guilherme Pilger',
    subtitle: 'Praia Brava',
    address: 'Av. Carlos Drummond de Andrade, 33 - Loja 01 - Praia Brava - SC, 88306-800',
}

function toCoordinate(value: number | string | null | undefined) {
    if (typeof value === 'string') return Number(value.replace(',', '.'))
    return Number(value)
}

function getLatLng(property: any): [number, number] | null {
    const lat = toCoordinate(property.latitude)
    const lng = toCoordinate(property.longitude)

    if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
    ) {
        return [lat, lng]
    }

    if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lng >= -90 &&
        lng <= 90 &&
        lat >= -180 &&
        lat <= 180
    ) {
        return [lng, lat]
    }

    return null
}

function filterPropertiesByBounds(properties: any[], bounds: MapBounds | null) {
    if (!bounds) return properties

    return properties.filter(p => {
        const latLng = getLatLng(p)
        if (!latLng) return true
        const [lat, lng] = latLng

        return (
            lat >= bounds.south &&
            lat <= bounds.north &&
            lng >= bounds.west &&
            lng <= bounds.east
        )
    })
}

function isPointInsidePolygon(point: [number, number], polygon: MapDrawArea) {
    const [lat, lng] = point
    let isInside = false

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [latI, lngI] = polygon[i]
        const [latJ, lngJ] = polygon[j]
        const intersects = ((lngI > lng) !== (lngJ > lng))
            && (lat < ((latJ - latI) * (lng - lngI)) / ((lngJ - lngI) || Number.EPSILON) + latI)

        if (intersects) isInside = !isInside
    }

    return isInside
}

function filterPropertiesByDrawArea(properties: any[], area: MapDrawArea | null) {
    if (!area || area.length < 3) return properties

    return properties.filter(property => {
        const latLng = getLatLng(property)
        if (!latLng) return false
        return isPointInsidePolygon(latLng, area)
    })
}

function replaceMapPropertyParam(propertyId: string | null) {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    if (propertyId) params.set(MAP_PROPERTY_PARAM, propertyId)
    else params.delete(MAP_PROPERTY_PARAM)

    const query = params.toString()
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    window.history.replaceState(window.history.state, '', nextUrl)
}

function serializeDrawArea(area: MapDrawArea | null) {
    if (!area || area.length < 3) return ''
    return area.map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join(';')
}

function serializeMapBounds(bounds: MapBounds | null) {
    if (!bounds) return ''
    return [bounds.north, bounds.south, bounds.east, bounds.west]
        .map(value => value.toFixed(5))
        .join(',')
}

function parseDrawAreaParam(value: string | null): MapDrawArea | null {
    if (!value) return null

    const points = value
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

function parseMapBoundsParam(value: string | null): MapBounds | null {
    if (!value) return null

    const [northRaw, southRaw, eastRaw, westRaw] = value.split(',')
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

function getFilterLabel(key: string, value: string) {
    const cityLabels: Record<string, string> = {
        'Balneário Camboriú': 'B. Camboriú',
        'Itajaí': 'Praia Brava',
        Itajai: 'Praia Brava',
        Itapema: 'Itapema',
        'Porto Belo': 'Porto Belo',
    }

    const priceLabels: Record<string, string> = {
        '3000000-5000000': 'R$ 4 mi a R$ 5 mi',
        '4000000-6000000': 'R$ 4 mi a R$ 6 mi',
        '6000000-8000000': 'R$ 6 mi a R$ 8 mi',
        '8000000-10000000': 'R$ 8 mi a R$ 10 mi',
        '10000000-': 'Acima de R$ 10 mi',
    }
    const tagLabels: Record<string, string> = {
        'frente-mar': 'Frente mar',
        'vista-mar': 'Vista mar',
        'quadra-mar': 'Quadra mar',
        lancamento: 'Lançamento',
        'em-construcao': 'Em construção',
        pronto: 'Pronto',
        mobiliado: 'Mobiliado',
    }

    if (key === 'tags') {
        return value
            .split(',')
            .map(item => tagLabels[item] || item.replace(/-/g, ' '))
            .filter(Boolean)
            .join(' + ')
    }

    const labels: Record<string, string> = {
        q: `Busca: ${replaceItajaiWithPraiaBrava(value)}`,
        category: isDevelopmentSearchCategory(value) ? 'Empreendimentos' : value.replace(/-/g, ' '),
        resultType: isDevelopmentSearchCategory(value) ? 'Empreendimentos' : value.replace(/-/g, ' '),
        view: isDevelopmentSearchCategory(value) ? 'Empreendimentos' : value.replace(/-/g, ' '),
        city: cityLabels[value] || replaceItajaiWithPraiaBrava(value),
        type: value,
        price: `Valor: ${priceLabels[value] || value.replace('-', ' até ')}`,
        offer: value === 'rent' ? 'Aluguel' : 'Venda',
        bedroomsMin: `${value}+ dormitórios`,
        suitesMin: `${value}+ suítes`,
        bathroomsMin: `${value}+ banheiros`,
        parkingMin: `${value}+ vagas`,
        areaMin: `A partir de ${value} m²`,
        areaMax: `Até ${value} m²`,
        priceMin: `Min. R$ ${Number(value).toLocaleString('pt-BR')}`,
        priceMax: `Max. R$ ${Number(value).toLocaleString('pt-BR')}`,
        broker: `Corretor: ${value}`,
        office: 'Imobiliária Guilherme Pilger',
        exclusive: 'Exclusivos',
        subtype: value.replace(/-/g, ' '),
        tag: tagLabels[value] || value.replace(/-/g, ' '),
    }

    return labels[key] || `${key}: ${value}`
}

function buildSearchAlertTitle(filters: Array<{ label: string }>, selectedRegion?: string | null, hasDrawArea = false) {
    const labels = filters.map(filter => filter.label).filter(Boolean).slice(0, 3)
    if (labels.length) return labels.join(' + ')
    if (selectedRegion) return `Alerta em ${selectedRegion}`
    if (hasDrawArea) return 'Alerta na área desenhada'
    return 'Alerta de busca'
}

function readStorageIds(key: string): string[] {
    if (typeof window === 'undefined') return []

    try {
        const parsed = JSON.parse(window.localStorage.getItem(key) || '[]')
        return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : []
    } catch {
        return []
    }
}

function mergeUniqueIds(...lists: string[][]) {
    const seen = new Set<string>()
    const ids: string[] = []

    for (const list of lists) {
        for (const id of list) {
            if (!id || seen.has(id)) continue
            seen.add(id)
            ids.push(id)
        }
    }

    return ids
}

function formatMemoryPrice(price?: number | string | null) {
    const value = Number(price || 0)
    if (!Number.isFinite(value) || value <= 0) return 'Sob consulta'

    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
    }).format(value)
}

function memoryPropertyTitle(property: any) {
    return replaceItajaiWithPraiaBrava(property.seo_title || property.title || 'Imóvel selecionado')
}

function memoryPropertyLocation(property: any) {
    return [
        replaceItajaiWithPraiaBrava(property.neighborhood),
        replaceItajaiWithPraiaBrava(property.city),
    ].filter(Boolean).join(' - ') || 'Litoral catarinense'
}

function memoryPropertyImage(property: any) {
    return property.featured_image || property.images?.find(Boolean) || '/images/brava-concetto/20_CL_BC_LIVING_FINAL_01_ANG_02_EF_web.jpg'
}

function developmentUnitLabel(development: SearchDevelopmentResult) {
    const count = Number(development.availableUnitsCount || 0)
    if (count <= 0) return 'Unidades sob consulta'
    return count === 1 ? '1 unidade ativa' : `${count} unidades ativas`
}

function regionCenter(area: MapDrawArea): [number, number] | null {
    if (!area.length) return null

    const totals = area.reduce((acc, [lat, lng]) => {
        acc.lat += lat
        acc.lng += lng
        return acc
    }, { lat: 0, lng: 0 })

    return [totals.lat / area.length, totals.lng / area.length]
}

function developmentFallbackLatLng(development: SearchDevelopmentResult): [number, number] | null {
    const region = findMapRegionByText(`${development.locationName} ${development.name}`)
    return region ? regionCenter(region.area) : null
}

function isInsideSearchMapServiceArea(latLng: [number, number]) {
    const [lat, lng] = latLng

    return (
        lat >= SEARCH_MAP_SERVICE_AREA_BOUNDS.south &&
        lat <= SEARCH_MAP_SERVICE_AREA_BOUNDS.north &&
        lng >= SEARCH_MAP_SERVICE_AREA_BOUNDS.west &&
        lng <= SEARCH_MAP_SERVICE_AREA_BOUNDS.east
    )
}

function developmentMapProperty(development: SearchDevelopmentResult) {
    const ownLatLng = getLatLng(development)
    const latLng = (ownLatLng && isInsideSearchMapServiceArea(ownLatLng) ? ownLatLng : null)
        || developmentFallbackLatLng(development)

    return {
        id: `development:${development.slug}`,
        source_slug: development.slug,
        slug: development.slug,
        title: development.name,
        city: null,
        state: 'SC',
        price: null,
        bedrooms: null,
        bathrooms: null,
        suites: null,
        parking_spaces: null,
        area_m2: null,
        featured_image: development.heroImage || null,
        images: development.heroImage ? [development.heroImage] : [],
        video_url: null,
        property_type: 'Empreendimento',
        exclusive: false,
        latitude: latLng?.[0] ?? null,
        longitude: latLng?.[1] ?? null,
        neighborhood: development.locationName,
        purpose: null,
        source_status: development.stageLabel,
        description: development.priceRange || developmentUnitLabel(development),
        amenities: [],
        __developmentSlug: development.slug,
    }
}

interface MapBounds {
    north: number
    south: number
    east: number
    west: number
}

interface SearchResultsProps {
    properties: any[]
    mapProperties?: any[]
    totalPropertiesCount?: number
    lpMap: Record<string, string>
    developmentResults?: SearchDevelopmentResult[]
    brokerSearchName?: string | null
}

export default function SearchResults({
    properties,
    mapProperties = [],
    totalPropertiesCount,
    lpMap,
    developmentResults = [],
    brokerSearchName,
}: SearchResultsProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const searchKey = searchParams.toString()
    const isDevelopmentOnlySearch = isDevelopmentSearchCategory(
        searchParams.get('category') || searchParams.get('resultType') || searchParams.get('view')
    )
    const [hydratedMapProperties, setHydratedMapProperties] = useState<Record<string, any>>({})
    const baseMapProperties = useMemo(
        () => isDevelopmentOnlySearch ? [] : (mapProperties.length ? mapProperties : properties),
        [isDevelopmentOnlySearch, mapProperties, properties]
    )
    const fullPropertiesById = useMemo(() => {
        const map = new Map<string, any>()

        properties.forEach(property => {
            const id = String(property?.id || '')
            if (id) map.set(id, property)
        })

        Object.values(hydratedMapProperties).forEach(property => {
            const id = String(property?.id || '')
            if (id) map.set(id, property)
        })

        return map
    }, [hydratedMapProperties, properties])
    const enrichProperty = useCallback((property: any) => {
        const id = String(property?.id || '')
        return id ? fullPropertiesById.get(id) || property : property
    }, [fullPropertiesById])
    const searchProperties = useMemo(
        () => baseMapProperties.map(enrichProperty),
        [baseMapProperties, enrichProperty]
    )
    const propertiesWithCoords = useMemo(
        () => isDevelopmentOnlySearch ? [] : searchProperties.filter(property => Boolean(getLatLng(property))),
        [isDevelopmentOnlySearch, searchProperties]
    )
    const mapSelectionKey = useMemo(() => {
        const params = new URLSearchParams(searchKey)
        params.delete(MAP_PROPERTY_PARAM)
        return params.toString()
    }, [searchKey])
    const isOfficeSearch = searchParams.get('office') === OFFICE_SEARCH_PARAM_VALUE
    const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null)
    const [mapHoveredId, setMapHoveredId] = useState<string | null>(null)
    const [showRefineSearch, setShowRefineSearch] = useState(false)
    const [selectedMapPropertyOverride, setSelectedMapPropertyOverride] = useState<{ key: string; id: string | null; property?: any | null } | null>(null)
    const [mapPreviewAnchorOverride, setMapPreviewAnchorOverride] = useState<{ key: string; id: string | null; property?: any | null } | null>(null)
    const [drawAreaOverride, setDrawAreaOverride] = useState<{ key: string; area: MapDrawArea | null } | null>(null)
    const [refineOfficeSelection, setRefineOfficeSelection] = useState<{ key: string; selected: boolean }>({ key: '', selected: false })
    const [saveAlertState, setSaveAlertState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
    const [favoriteIds, setFavoriteIds] = useState<string[]>([])
    const [historyIds, setHistoryIds] = useState<string[]>([])
    const [memoryProperties, setMemoryProperties] = useState<any[]>([])
    const [memoryLoading, setMemoryLoading] = useState(false)
    const refinePanelRef = useRef<HTMLDivElement>(null)
    const isOfficeSelectedInRefine = refineOfficeSelection.key === searchKey && refineOfficeSelection.selected
    const shouldShowOfficeOnMap = isOfficeSearch || isOfficeSelectedInRefine
    const mapViewKey = `${searchKey}:${shouldShowOfficeOnMap ? 'office' : isDevelopmentOnlySearch ? 'developments' : 'properties'}`
    const urlMapBounds = useMemo(() => parseMapBoundsParam(searchParams.get(MAP_BOUNDS_PARAM)), [searchKey, searchParams])
    const mapBounds = urlMapBounds
    const selectedMapPropertyId = selectedMapPropertyOverride?.key === mapSelectionKey
        ? selectedMapPropertyOverride.id
        : searchParams.get(MAP_PROPERTY_PARAM)
    const urlDrawArea = useMemo(() => parseDrawAreaParam(searchParams.get(DRAW_AREA_PARAM)), [searchKey, searchParams])
    const selectedDrawArea = drawAreaOverride?.key === searchKey ? drawAreaOverride.area : urlDrawArea
    const selectedRegionArea = useMemo(
        () => shouldShowOfficeOnMap ? null : findMapRegionForSearchParams(searchParams),
        [searchKey, searchParams, shouldShowOfficeOnMap]
    )
    const memoryIds = useMemo(
        () => mergeUniqueIds(favoriteIds, historyIds).slice(0, MAX_MEMORY_PROPERTIES),
        [favoriteIds, historyIds]
    )
    const memoryIdsKey = memoryIds.join(',')
    const memoryItems = useMemo(() => {
        const order = new Map(memoryIds.map((id, index) => [id, index]))
        const sorted = [...memoryProperties]
            .filter(property => property?.id && order.has(String(property.id)))
            .sort((a, b) => (order.get(String(a.id)) ?? 999) - (order.get(String(b.id)) ?? 999))

        return sorted.map(property => ({
            property,
            source: (favoriteIds.includes(String(property.id)) ? 'favorite' : 'history') as SearchMemorySource,
        })).slice(0, 8)
    }, [favoriteIds, memoryIds, memoryProperties])

    useEffect(() => {
        const syncStoredPropertyIds = () => {
            setFavoriteIds(readStorageIds(FAVORITES_KEY))
            setHistoryIds(readStorageIds(HISTORY_KEY))
        }

        syncStoredPropertyIds()
        window.addEventListener('storage', syncStoredPropertyIds)
        window.addEventListener('pilger:favorites-changed', syncStoredPropertyIds)
        window.addEventListener('pilger:history-changed', syncStoredPropertyIds)

        return () => {
            window.removeEventListener('storage', syncStoredPropertyIds)
            window.removeEventListener('pilger:favorites-changed', syncStoredPropertyIds)
            window.removeEventListener('pilger:history-changed', syncStoredPropertyIds)
        }
    }, [])

    useEffect(() => {
        let cancelled = false

        async function loadMemoryProperties() {
            if (!memoryIds.length) {
                setMemoryProperties([])
                setMemoryLoading(false)
                return
            }

            setMemoryLoading(true)

            try {
                const response = await fetch(`/api/public/properties?ids=${encodeURIComponent(memoryIds.join(','))}`)
                const data = await response.json().catch(() => ({}))
                const list = Array.isArray(data.properties) ? data.properties : []
                if (!cancelled) setMemoryProperties(list)
            } catch {
                if (!cancelled) setMemoryProperties([])
            } finally {
                if (!cancelled) setMemoryLoading(false)
            }
        }

        void loadMemoryProperties()

        return () => {
            cancelled = true
        }
    }, [memoryIds, memoryIdsKey])

    useEffect(() => {
        if (!selectedMapPropertyId || shouldShowOfficeOnMap || isDevelopmentOnlySearch) return
        if (fullPropertiesById.has(String(selectedMapPropertyId))) return

        let cancelled = false

        async function loadSelectedMapProperty() {
            try {
                const response = await fetch(`/api/public/properties?ids=${encodeURIComponent(String(selectedMapPropertyId))}`)
                const data = await response.json().catch(() => ({}))
                const property = Array.isArray(data.properties) ? data.properties[0] : null
                if (cancelled || !property?.id) return

                setHydratedMapProperties(current => ({
                    ...current,
                    [String(property.id)]: property,
                }))
            } catch {
                // The lightweight marker remains enough to keep the map usable.
            }
        }

        void loadSelectedMapProperty()

        return () => {
            cancelled = true
        }
    }, [fullPropertiesById, isDevelopmentOnlySearch, selectedMapPropertyId, shouldShowOfficeOnMap])

    const activeFilters = useMemo(() => {
        const ignored = new Set(['page', MAP_PROPERTY_PARAM, DRAW_AREA_PARAM, MAP_BOUNDS_PARAM, 'brokerLogin'])

        return Array.from(searchParams.entries())
            .filter(([key, value]) => value && !ignored.has(key))
            .map(([key, value]) => ({
                key,
                value,
                label: getFilterLabel(key, value),
            }))
    }, [searchKey, searchParams])

    const makeRemoveFilterHref = useCallback((key: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete(key)
        const query = params.toString()
        return query ? `/busca?${query}` : '/busca'
    }, [searchParams])

    const replaceSpatialSearchParams = useCallback((next: {
        drawArea?: MapDrawArea | null
        bounds?: MapBounds | null
        mapPropertyId?: string | null
    }) => {
        const params = new URLSearchParams(searchParams.toString())

        if (next.drawArea !== undefined) {
            const serialized = serializeDrawArea(next.drawArea)
            if (serialized) params.set(DRAW_AREA_PARAM, serialized)
            else params.delete(DRAW_AREA_PARAM)
        }

        if (next.bounds !== undefined) {
            const serialized = serializeMapBounds(next.bounds)
            if (serialized) params.set(MAP_BOUNDS_PARAM, serialized)
            else params.delete(MAP_BOUNDS_PARAM)
        }

        if (next.mapPropertyId !== undefined) {
            if (next.mapPropertyId) params.set(MAP_PROPERTY_PARAM, next.mapPropertyId)
            else params.delete(MAP_PROPERTY_PARAM)
        }

        const query = params.toString()
        router.replace(`${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`, { scroll: false })
    }, [router, searchParams])

    const handleMapSearchFiltersApply = useCallback((filters: MapSearchFilters, nextFilters: URLSearchParams) => {
        const params = new URLSearchParams(searchParams.toString())

        MAP_FILTER_PARAM_KEYS.forEach(key => params.delete(key))
        params.delete(MAP_PROPERTY_PARAM)

        nextFilters.forEach((value, key) => {
            if (value) params.set(key, value)
        })

        const query = params.toString()
        const destination = `${window.location.pathname}${query ? `?${query}` : ''}`

        void trackEvent('search_results_map_filters_applied', {
            feature_count: filters.features.length,
            has_type: Boolean(filters.type),
            has_price: Boolean(filters.pricePreset || filters.priceMin || filters.priceMax),
            destination,
        })

        router.replace(`${destination}${window.location.hash}`, { scroll: false })
    }, [router, searchParams])

    const handleCardHover = useCallback((id: string | null) => {
        setHoveredPropertyId(id)
    }, [])

    const handleMarkerHover = useCallback((id: string | null) => {
        setMapHoveredId(id)
    }, [])

    const handleRefineSearchValuesChange = useCallback((values: HomeSearchValues) => {
        setRefineOfficeSelection({ key: searchKey, selected: values.locationType === 'office' })
    }, [searchKey])

    const visibleProperties = useMemo(() => {
        if (isDevelopmentOnlySearch) return []
        return filterPropertiesByDrawArea(filterPropertiesByBounds(searchProperties, mapBounds), selectedDrawArea)
    }, [isDevelopmentOnlySearch, searchProperties, mapBounds, selectedDrawArea])

    const developmentMapProperties = useMemo(() => {
        if (!isDevelopmentOnlySearch) return []
        return developmentResults
            .map(developmentMapProperty)
            .filter(property => Boolean(getLatLng(property)))
    }, [developmentResults, isDevelopmentOnlySearch])

    const visibleMapProperties = useMemo(() => {
        if (shouldShowOfficeOnMap) return []
        if (isDevelopmentOnlySearch) {
            return filterPropertiesByDrawArea(filterPropertiesByBounds(developmentMapProperties, mapBounds), selectedDrawArea)
        }
        return filterPropertiesByDrawArea(filterPropertiesByBounds(propertiesWithCoords, mapBounds), selectedDrawArea)
    }, [developmentMapProperties, isDevelopmentOnlySearch, mapBounds, propertiesWithCoords, selectedDrawArea, shouldShowOfficeOnMap])

    const selectedMapProperty = useMemo(() => {
        if (!selectedMapPropertyId || shouldShowOfficeOnMap || isDevelopmentOnlySearch) return null
        const overrideProperty = selectedMapPropertyOverride?.key === mapSelectionKey
            && selectedMapPropertyOverride.property
            && String(selectedMapPropertyOverride.property.id) === String(selectedMapPropertyId)
            ? selectedMapPropertyOverride.property
            : null

        return fullPropertiesById.get(String(selectedMapPropertyId))
            || propertiesWithCoords.find(item => String(item.id) === String(selectedMapPropertyId))
            || visibleMapProperties.find(item => String(item.id) === String(selectedMapPropertyId))
            || overrideProperty
            || null
    }, [fullPropertiesById, isDevelopmentOnlySearch, mapSelectionKey, propertiesWithCoords, selectedMapPropertyId, selectedMapPropertyOverride, shouldShowOfficeOnMap, visibleMapProperties])
    const mapPreviewAnchorProperty = useMemo(() => {
        const anchor = mapPreviewAnchorOverride?.key === mapSelectionKey ? mapPreviewAnchorOverride : null
        if (!anchor?.id) return selectedMapProperty
        const anchorProperty = anchor.property && String(anchor.property.id) === String(anchor.id)
            ? anchor.property
            : null

        return anchorProperty
            || fullPropertiesById.get(String(anchor.id))
            || propertiesWithCoords.find(item => String(item.id) === String(anchor.id))
            || visibleMapProperties.find(item => String(item.id) === String(anchor.id))
            || selectedMapProperty
    }, [fullPropertiesById, mapPreviewAnchorOverride, mapSelectionKey, propertiesWithCoords, selectedMapProperty, visibleMapProperties])
    const mapPreviewProperties = useMemo(() => {
        const hydratePreviewProperties = (items: any[]) => items.map(enrichProperty)

        if (!selectedMapProperty) {
            return hydratePreviewProperties(orderPropertiesBySmoothGeoPath(visibleMapProperties, mapPreviewAnchorProperty))
                .slice(0, MAX_MAP_PREVIEW_PROPERTIES)
        }

        const hasSelectedProperty = visibleMapProperties.some(item => String(item.id) === String(selectedMapProperty.id))
        const previewProperties = hasSelectedProperty ? visibleMapProperties : [selectedMapProperty, ...visibleMapProperties]
        const orderedProperties = hydratePreviewProperties(orderPropertiesBySmoothGeoPath(previewProperties, mapPreviewAnchorProperty || selectedMapProperty))
        const limitedProperties = orderedProperties.slice(0, MAX_MAP_PREVIEW_PROPERTIES)

        return limitedProperties.some(item => String(item.id) === String(selectedMapProperty.id))
            ? limitedProperties
            : [selectedMapProperty, ...limitedProperties.slice(0, MAX_MAP_PREVIEW_PROPERTIES - 1)]
    }, [enrichProperty, mapPreviewAnchorProperty, selectedMapProperty, visibleMapProperties])
    const developmentCount = developmentResults.length
    const totalMatchedPropertyCount = Math.max(
        searchProperties.length,
        Number.isFinite(Number(totalPropertiesCount)) ? Number(totalPropertiesCount) : 0
    )
    const visibleCount = isDevelopmentOnlySearch
        ? developmentCount
        : (selectedDrawArea || mapBounds ? visibleProperties.length : totalMatchedPropertyCount)
    const totalCount = isDevelopmentOnlySearch ? developmentCount : totalMatchedPropertyCount
    const brokerResultName = String(brokerSearchName || '').trim()
    const isBrokerSearch = brokerResultName.length > 0
    const renderedProperties = visibleProperties.slice(0, MAX_RENDERED_CARDS)
    const hiddenVisibleCount = Math.max(0, visibleCount - renderedProperties.length)
    const renderedPropertyIdsKey = useMemo(
        () => renderedProperties.map(property => String(property?.id || '')).filter(Boolean).join(','),
        [renderedProperties]
    )
    const isSpatiallyFiltered = !isDevelopmentOnlySearch && Boolean(selectedDrawArea || (mapBounds && visibleCount < totalCount))

    useEffect(() => {
        if (isDevelopmentOnlySearch || !renderedPropertyIdsKey) return

        const missingIds = renderedPropertyIdsKey
            .split(',')
            .filter(id => id && !fullPropertiesById.has(id))
            .slice(0, MAX_RENDERED_CARDS)

        if (missingIds.length === 0) return

        let cancelled = false

        async function loadRenderedProperties() {
            try {
                const response = await fetch(`/api/public/properties?ids=${encodeURIComponent(missingIds.join(','))}`)
                const data = await response.json().catch(() => ({}))
                const nextProperties = Array.isArray(data.properties) ? data.properties : []
                if (cancelled || nextProperties.length === 0) return

                setHydratedMapProperties(current => {
                    const next = { ...current }
                    nextProperties.forEach((property: any) => {
                        if (property?.id) next[String(property.id)] = property
                    })
                    return next
                })
            } catch {
                // Compact rows are still enough to keep the results usable.
            }
        }

        void loadRenderedProperties()

        return () => {
            cancelled = true
        }
    }, [fullPropertiesById, isDevelopmentOnlySearch, renderedPropertyIdsKey])

    const searchAlertTitle = useMemo(
        () => buildSearchAlertTitle(activeFilters, selectedRegionArea?.label, Boolean(selectedDrawArea)),
        [activeFilters, selectedDrawArea, selectedRegionArea]
    )
    const samplePropertyIds = useMemo(
        () => visibleProperties.slice(0, 18).map(property => String(property.id || '')).filter(Boolean),
        [visibleProperties]
    )
    const baseCountLabel = isDevelopmentOnlySearch
        ? (totalCount === 1 ? 'empreendimento encontrado' : 'empreendimentos encontrados')
        : selectedDrawArea
        ? 'imóveis na área desenhada'
        : mapBounds && visibleCount < totalCount
            ? 'imóveis nesta área'
            : 'imóveis encontrados'
    const countLabel = isBrokerSearch ? 'imóveis deste corretor' : baseCountLabel
    const resultTitle = isBrokerSearch ? 'Mais imóveis deste corretor' : 'Imóveis selecionados'
    const resultSubtitle = isBrokerSearch ? `Curadoria de ${brokerResultName}` : ''

    const developmentSubtitle = searchParams.get('tag') === 'pronto'
        ? 'Empreendimentos prontos para morar.'
        : searchParams.get('tag') === 'lancamento' || searchParams.get('tag') === 'em-construcao'
            ? 'Empreendimentos em lançamento e construção.'
            : 'Curadoria de empreendimentos.'
    const displayResultTitle = isDevelopmentOnlySearch ? 'Empreendimentos selecionados' : resultTitle
    const displayResultSubtitle = isDevelopmentOnlySearch ? developmentSubtitle : resultSubtitle
    const hasDevelopmentResults = developmentCount > 0

    const handleDevelopmentClick = useCallback((development: SearchDevelopmentResult, index: number) => {
        void trackEvent('search_results_development_clicked', {
            slug: development.slug,
            name: development.name,
            index,
            available_units_count: development.availableUnitsCount,
            active_filters: activeFilters,
            total_count: totalCount,
            visible_count: visibleCount,
        })
    }, [activeFilters, totalCount, visibleCount])

    const handleSearchButtonClick = useCallback(() => {
        const nextOpen = !showRefineSearch
        setShowRefineSearch(nextOpen)

        if (nextOpen) {
            window.setTimeout(() => {
                refinePanelRef.current?.querySelector('input')?.focus()
            }, 0)
        }

        void trackEvent('search_results_adjust_filters_clicked', {
            active_filters: activeFilters,
            total_count: totalCount,
            visible_count: visibleCount,
            opened: nextOpen,
        })
    }, [activeFilters, showRefineSearch, totalCount, visibleCount])

    const buildSearchAlertSnapshot = useCallback(() => ({
        title: searchAlertTitle,
        active_filters: activeFilters,
        search_params: searchParams.toString(),
        selected_region: selectedRegionArea?.id || selectedRegionArea?.label || null,
        selected_region_label: selectedRegionArea?.label || null,
        draw_area: selectedDrawArea,
        bounds: mapBounds,
        visible_count: visibleCount,
        total_count: totalCount,
        sample_property_ids: samplePropertyIds,
        favorite_count: favoriteIds.length,
        history_count: historyIds.length,
        favorite_property_ids: favoriteIds.slice(0, 20),
        recent_property_ids: historyIds.slice(0, 20),
        page_path: typeof window !== 'undefined' ? window.location.pathname : '/busca',
        page_url: typeof window !== 'undefined' ? window.location.href : null,
        source: 'search_results_header',
    }), [activeFilters, favoriteIds, historyIds, mapBounds, samplePropertyIds, searchAlertTitle, searchParams, selectedDrawArea, selectedRegionArea, totalCount, visibleCount])

    const handleSaveSearchAlert = useCallback(async () => {
        if (saveAlertState === 'saving') return

        const snapshot = buildSearchAlertSnapshot()
        setSaveAlertState('saving')
        void trackEvent('property_search_alert_clicked', snapshot)

        try {
            const response = await fetch('/api/search-alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    visitor_cookie_id: getVisitorId(),
                    referrer: document.referrer,
                    ...snapshot,
                    filters: activeFilters,
                }),
            })
            const data = await response.json().catch(() => ({}))

            if (!response.ok || !data?.success) {
                throw new Error(data?.error || `Falha ao salvar alerta (${response.status})`)
            }

            setSaveAlertState('saved')
            window.dispatchEvent(new CustomEvent('pilger_search_alert_saved', {
                detail: {
                    alert: data.alert || null,
                    title: searchAlertTitle,
                },
            }))
            window.dispatchEvent(new CustomEvent('pilger_push_intent', {
                detail: {
                    reason: 'property_search_alert_saved',
                    title: 'Alerta de busca salvo',
                    body: 'Ative as notificações para ser avisado quando entrar um imóvel com esse perfil.',
                    cta: 'Ativar alertas VIP',
                },
            }))

            window.setTimeout(() => setSaveAlertState('idle'), 4200)
        } catch (error) {
            console.error('[SearchResults] search alert save failed:', error)
            setSaveAlertState('error')
            void trackEvent('property_search_alert_failed', {
                ...snapshot,
                error: error instanceof Error ? error.message : String(error),
            })
            window.setTimeout(() => setSaveAlertState('idle'), 5200)
        }
    }, [activeFilters, buildSearchAlertSnapshot, saveAlertState])

    const handleDrawAreaChange = useCallback((area: MapDrawArea | null) => {
        setDrawAreaOverride({ key: searchKey, area })
        setSelectedMapPropertyOverride({ key: searchKey, id: null })
        setMapPreviewAnchorOverride({ key: searchKey, id: null })
        replaceSpatialSearchParams({ drawArea: area, mapPropertyId: null })

        if (area) {
            const nextVisibleCount = filterPropertiesByDrawArea(filterPropertiesByBounds(searchProperties, mapBounds), area).length

            void trackEvent('property_map_draw_area_applied', {
                active_filters: activeFilters,
                coordinate_count: area.length,
                coordinates: area,
                visible_count: nextVisibleCount,
                total_count: totalCount,
                bounds: mapBounds,
                selected_region: selectedRegionArea?.id || null,
                selected_region_label: selectedRegionArea?.label || null,
            })
        } else {
            void trackEvent('property_map_draw_area_cleared', {
                active_filters: activeFilters,
                total_count: totalCount,
                visible_count: filterPropertiesByBounds(searchProperties, mapBounds).length,
                bounds: mapBounds,
                selected_region: selectedRegionArea?.id || null,
                selected_region_label: selectedRegionArea?.label || null,
            })
        }
    }, [activeFilters, mapBounds, replaceSpatialSearchParams, searchKey, searchProperties, selectedRegionArea, totalCount])

    const handleMapPropertySelect = useCallback((property: any) => {
        setSelectedMapPropertyOverride({ key: mapSelectionKey, id: property.id, property })
        setMapPreviewAnchorOverride({ key: mapSelectionKey, id: property.id, property })
        replaceMapPropertyParam(property.id)

        void trackEvent('property_map_pin_selected', {
            property_id: property.id,
            title: property.title,
            price: property.price || null,
            active_filters: activeFilters,
            visible_count: visibleCount,
            total_count: totalCount,
            selected_region: selectedRegionArea?.id || null,
        })
    }, [activeFilters, mapSelectionKey, selectedRegionArea, totalCount, visibleCount])

    const handleDevelopmentMapSelect = useCallback((property: any) => {
        const slug = String(property?.__developmentSlug || property?.source_slug || property?.slug || '').replace(/^\/+/, '')
        if (!slug) return

        void trackEvent('search_results_development_map_pin_clicked', {
            slug,
            name: property?.title || null,
            active_filters: activeFilters,
            visible_count: visibleCount,
            total_count: totalCount,
        })

        router.push(`/${slug}`)
    }, [activeFilters, router, totalCount, visibleCount])

    const handleMapPropertyPreviewClose = useCallback(() => {
        const property = selectedMapProperty
        setSelectedMapPropertyOverride({ key: mapSelectionKey, id: null })
        setMapPreviewAnchorOverride({ key: mapSelectionKey, id: null })
        replaceMapPropertyParam(null)

        if (property) {
            void trackEvent('property_map_preview_closed', {
                property_id: property.id,
                title: property.title,
            })
        }
    }, [mapSelectionKey, selectedMapProperty])

    const handleMapPreviewPropertySelect = useCallback((property: any, source: string) => {
        if (!property?.id) return
        if (property.id === selectedMapPropertyId) return

        setSelectedMapPropertyOverride({ key: mapSelectionKey, id: property.id, property })
        replaceMapPropertyParam(property.id)
        const nextIndex = mapPreviewProperties.findIndex(item => item.id === property.id)

        void trackEvent('property_map_preview_similar_selected', {
            property_id: property.id,
            title: property.title,
            price: property.price || null,
            source,
            next_position: nextIndex >= 0 ? nextIndex + 1 : null,
            visible_count: visibleMapProperties.length,
            active_filters: activeFilters,
            total_count: totalCount,
            selected_region: selectedRegionArea?.id || null,
            selected_region_label: selectedRegionArea?.label || null,
        })
    }, [activeFilters, mapPreviewProperties, mapSelectionKey, selectedMapPropertyId, selectedRegionArea, totalCount, visibleMapProperties])

    const handleMemoryPropertyClick = useCallback((property: any, source: 'favorite' | 'history') => {
        void trackEvent('search_results_memory_property_clicked', {
            property_id: property.id,
            title: memoryPropertyTitle(property),
            source,
            favorite_count: favoriteIds.length,
            history_count: historyIds.length,
        })
    }, [favoriteIds.length, historyIds.length])

    return (
        <>
            <style>{`
                .search-map-interactive-layer {
                    position: absolute;
                    inset: 0;
                    overflow: hidden;
                }
                .search-map-property-preview {
                    position: absolute;
                    inset: 0;
                    overflow: hidden;
                    pointer-events: none !important;
                }
                .search-card-wrap {
                    position: relative;
                    min-width: 0;
                    border-radius: 12px;
                    transition: box-shadow 0.28s ease, transform 0.28s ease;
                }
                .search-card-wrap--highlighted {
                    box-shadow:
                        0 0 0 2px rgba(201,169,110,0.92),
                        0 14px 34px rgba(184,148,95,0.22);
                    transform: translateY(-2px);
                    z-index: 10;
                }
                @media (min-width: 1024px) {
                    .search-map-property-preview .map-property-preview {
                        bottom: 24px;
                        left: 50%;
                        right: auto;
                        width: min(980px, calc(100% - 48px));
                        transform: translateX(-50%);
                    }
                    .search-map-property-preview .map-preview-track {
                        gap: 12px;
                        padding-inline: 12px;
                        scroll-padding-inline: 12px;
                    }
                    .search-map-property-preview .map-preview-card {
                        flex-basis: clamp(260px, 28vw, 306px);
                        max-width: 100%;
                        grid-template-columns: 1fr;
                        min-height: 0;
                    }
                    .search-map-property-preview .map-preview-media,
                    .search-map-property-preview .map-preview-media img {
                        height: 150px;
                        min-height: 150px;
                    }
                    .search-map-property-preview .map-preview-body {
                        padding: 8px 12px 10px;
                    }
                    .search-map-property-preview .map-preview-body-link {
                        gap: 5px;
                    }
                    .search-map-property-preview .map-preview-location {
                        font-size: 0.48rem;
                    }
                    .search-map-property-preview .map-preview-title {
                        font-size: 0.78rem;
                        line-height: 1.08;
                        -webkit-line-clamp: 2;
                    }
                    .search-map-property-preview .map-preview-price {
                        font-size: 0.8rem;
                    }
                    .search-map-property-preview .map-preview-stats .map-preview-stat:nth-child(n+3) {
                        display: none;
                    }
                    .search-map-property-preview .map-preview-swipe-hint {
                        margin-top: 1px;
                    }
                }
                .search-results-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 20px 14px;
                    min-width: 0;
                }
                .result-lux-header {
                    position: sticky;
                    top: 0;
                    z-index: 20;
                    margin: 0 0 14px;
                    padding: 8px 0 13px;
                    background:
                        linear-gradient(180deg, rgba(247,245,240,0.98) 0%, rgba(247,245,240,0.9) 82%, rgba(247,245,240,0) 100%);
                    backdrop-filter: blur(16px);
                }
                .result-kicker {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    margin-bottom: 6px;
                    color: #a78042;
                    font: 900 0.58rem/1 'Inter', sans-serif;
                    letter-spacing: 0.15em;
                    text-transform: uppercase;
                }
                .result-main-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 14px;
                }
                .result-title {
                    margin: 0;
                    color: #201d19;
                    font-family: 'Noto Serif', Georgia, serif;
                    font-size: clamp(1.08rem, 1.35vw, 1.45rem);
                    font-weight: 700;
                    line-height: 1.08;
                    letter-spacing: 0;
                    white-space: nowrap;
                }
                .result-subtitle {
                    margin: 5px 0 0;
                    color: #8f6930;
                    font: 800 0.76rem/1.22 'Inter', sans-serif;
                }
                .result-count {
                    margin-top: 4px;
                    color: #6d665c;
                    font: 650 0.74rem/1.28 'Inter', sans-serif;
                }
                .result-count strong {
                    color: #b8945f;
                    font-size: 1.12em;
                    font-weight: 900;
                }
                .result-count span {
                    color: #aaa194;
                    font-weight: 500;
                }
                .result-actions {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    flex-shrink: 0;
                    margin-left: auto;
                }
                .result-action {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 7px;
                    height: 36px;
                    padding: 0 12px;
                    border: 1px solid rgba(36,31,24,0.12);
                    border-radius: 999px;
                    background: rgba(255,255,255,0.78);
                    color: #2a261f;
                    font: 850 0.72rem/1 'Inter', sans-serif;
                    text-decoration: none;
                    box-shadow: 0 10px 24px rgba(37,29,19,0.08);
                    white-space: nowrap;
                }
                .result-action--gold {
                    background: linear-gradient(135deg, #dfc18e, #b8945f);
                    border-color: rgba(255,255,255,0.34);
                    color: #111;
                }
                .result-action-button {
                    cursor: pointer;
                    font-family: inherit;
                }
                .result-action-button:disabled {
                    cursor: wait;
                    opacity: 0.82;
                }
                .result-action--saved {
                    background: #f4fbf5;
                    border-color: rgba(41,126,73,0.24);
                    color: #1f7a45;
                }
                .result-action--error {
                    background: #fff4f2;
                    border-color: rgba(194,65,12,0.22);
                    color: #9a3412;
                }
                .result-action .spin {
                    animation: searchSpin 0.8s linear infinite;
                }
                @keyframes searchSpin {
                    to { transform: rotate(360deg); }
                }
                .result-refine-panel {
                    margin-top: 13px;
                    padding: 13px;
                    border: 1px solid rgba(184,148,95,0.2);
                    border-radius: 16px;
                    background: rgba(255,255,255,0.86);
                    box-shadow: 0 14px 32px rgba(31,24,16,0.08);
                }
                .active-filter-row {
                    display: flex;
                    gap: 8px;
                    margin-top: 14px;
                    overflow-x: auto;
                    padding-bottom: 2px;
                    scrollbar-width: none;
                }
                .active-filter-row::-webkit-scrollbar { display: none; }
                .active-filter-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    height: 30px;
                    padding: 0 9px 0 11px;
                    border: 1px solid rgba(184,148,95,0.2);
                    border-radius: 999px;
                    background: rgba(255,255,255,0.74);
                    color: #53483a;
                    font: 800 0.68rem/1 'Inter', sans-serif;
                    text-decoration: none;
                    white-space: nowrap;
                }
                .active-filter-chip svg {
                    color: #a78042;
                }
                .search-development-panel {
                    margin: 0 0 14px;
                    padding: 12px;
                    border: 1px solid rgba(184,148,95,0.18);
                    border-radius: 14px;
                    background: rgba(255,255,255,0.86);
                    box-shadow: 0 12px 28px rgba(31,24,16,0.08);
                }
                .search-development-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    margin-bottom: 10px;
                }
                .search-development-title {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    color: #211d18;
                    font: 900 0.8rem/1 'Inter', sans-serif;
                }
                .search-development-title svg {
                    color: #a78042;
                }
                .search-development-count {
                    color: #8d8478;
                    font: 800 0.64rem/1 'Inter', sans-serif;
                    text-transform: uppercase;
                }
                .search-development-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(255px, 1fr));
                    gap: 10px;
                }
                .search-development-card {
                    display: grid;
                    grid-template-columns: 102px minmax(0, 1fr);
                    min-height: 124px;
                    overflow: hidden;
                    border: 1px solid rgba(35,31,26,0.09);
                    border-radius: 12px;
                    background: #fff;
                    color: #211d18;
                    text-decoration: none;
                    box-shadow: 0 9px 20px rgba(30,24,17,0.07);
                    transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
                }
                .search-development-card:hover {
                    border-color: rgba(184,148,95,0.42);
                    box-shadow: 0 16px 30px rgba(30,24,17,0.12);
                    transform: translateY(-1px);
                }
                .search-development-media {
                    position: relative;
                    min-height: 124px;
                    overflow: hidden;
                    background: #e6dfd1;
                }
                .search-development-media img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }
                .search-development-body {
                    display: grid;
                    align-content: center;
                    gap: 8px;
                    min-width: 0;
                    padding: 12px;
                }
                .search-development-kicker {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    color: #9b7136;
                    font: 900 0.58rem/1 'Inter', sans-serif;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                }
                .search-development-name {
                    margin: 0;
                    color: #211d18;
                    font-family: 'Noto Serif', Georgia, serif;
                    font-size: 1rem;
                    font-weight: 800;
                    line-height: 1.08;
                    letter-spacing: 0;
                }
                .search-development-meta {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    min-width: 0;
                }
                .search-development-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    max-width: 100%;
                    min-height: 24px;
                    padding: 4px 7px;
                    border-radius: 999px;
                    background: #f7f1e4;
                    color: #6d542d;
                    font: 850 0.6rem/1.08 'Inter', sans-serif;
                }
                .search-development-pill span {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .search-development-cta {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    color: #2c251a;
                    font: 900 0.68rem/1 'Inter', sans-serif;
                }
                .search-memory-panel {
                    margin: 0 0 14px;
                    padding: 11px;
                    border: 1px solid rgba(184,148,95,0.16);
                    border-radius: 14px;
                    background: rgba(255,255,255,0.82);
                    box-shadow: 0 10px 24px rgba(31,24,16,0.07);
                }
                .search-memory-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    margin-bottom: 10px;
                }
                .search-memory-title {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    color: #2a261f;
                    font: 900 0.78rem/1 'Inter', sans-serif;
                }
                .search-memory-title svg {
                    color: #a78042;
                }
                .search-memory-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    color: #8b642d;
                    font: 900 0.68rem/1 'Inter', sans-serif;
                    text-decoration: none;
                    white-space: nowrap;
                }
                .search-memory-row {
                    display: flex;
                    gap: 9px;
                    margin: 0 -11px;
                    overflow-x: auto;
                    overflow-y: hidden;
                    padding: 0 11px 2px;
                    scroll-snap-type: x proximity;
                    scrollbar-width: none;
                }
                .search-memory-row::-webkit-scrollbar {
                    display: none;
                }
                .search-memory-card {
                    display: grid;
                    grid-template-columns: 50px minmax(0, 1fr);
                    gap: 8px;
                    flex: 0 0 clamp(205px, 37%, 238px);
                    min-height: 64px;
                    padding: 7px;
                    border: 1px solid rgba(35,31,26,0.08);
                    border-radius: 11px;
                    background: #fff;
                    color: #211d18;
                    text-decoration: none;
                    box-shadow: 0 8px 18px rgba(30,24,17,0.06);
                    scroll-snap-align: start;
                    transition: transform 0.18s ease, border-color 0.18s ease;
                }
                .search-memory-card:hover {
                    border-color: rgba(184,148,95,0.38);
                    transform: translateY(-1px);
                }
                .search-memory-media {
                    position: relative;
                    width: 50px;
                    min-height: 50px;
                    overflow: hidden;
                    border-radius: 8px;
                    background: #e6dfd1;
                }
                .search-memory-media img {
                    display: block;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .search-memory-copy {
                    min-width: 0;
                    display: grid;
                    align-content: center;
                    gap: 4px;
                }
                .search-memory-copy strong {
                    display: block;
                    overflow: hidden;
                    color: #211d18;
                    font: 900 0.72rem/1.16 'Inter', sans-serif;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .search-memory-copy span {
                    overflow: hidden;
                    color: #746b60;
                    font: 720 0.62rem/1.15 'Inter', sans-serif;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .search-memory-meta {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    min-width: 0;
                }
                .search-memory-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    height: 20px;
                    padding: 0 7px;
                    border-radius: 999px;
                    background: #f7f1e4;
                    color: #8b642d;
                    font: 900 0.56rem/1 'Inter', sans-serif;
                    white-space: nowrap;
                }
                .search-memory-chip--favorite {
                    background: #fff0f3;
                    color: #b4234b;
                }
                .search-render-limit,
                .search-empty-state {
                    margin-top: 18px;
                    padding: 16px 18px;
                    border: 1px solid rgba(184,148,95,0.14);
                    border-radius: 14px;
                    background: rgba(255,255,255,0.76);
                    color: #71695d;
                    font: 700 0.82rem/1.45 'Inter', sans-serif;
                    text-align: center;
                    box-shadow: 0 10px 26px rgba(30,24,17,0.06);
                }
                .search-empty-state {
                    display: grid;
                    justify-items: center;
                    gap: 10px;
                    padding: 42px 20px;
                }
                .search-empty-icon {
                    display: grid;
                    place-items: center;
                    width: 46px;
                    height: 46px;
                    border-radius: 50%;
                    background: #1b1a18;
                    color: #dfc18e;
                    box-shadow: 0 16px 30px rgba(20,18,15,0.18);
                }
                .search-empty-title {
                    margin: 4px 0 0;
                    color: #211d18;
                    font-family: 'Noto Serif', Georgia, serif;
                    font-size: 1.12rem;
                    font-weight: 700;
                }
                .search-empty-copy {
                    margin: 0;
                    max-width: 330px;
                    color: #81786c;
                    font-size: 0.84rem;
                    font-weight: 650;
                }
                .search-footer {
                    margin-top: 28px;
                    padding: 22px 0 10px;
                    border-top: 1px solid rgba(184,148,95,0.16);
                    color: #9a9286;
                    font: 700 0.68rem/1 'Inter', sans-serif;
                    letter-spacing: 0.08em;
                    text-align: center;
                    text-transform: uppercase;
                }
                @media (max-width: 649px) {
                    .result-lux-header {
                        margin: 0 -2px 12px;
                        padding: 4px 2px 13px;
                        background:
                            linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(249,247,243,0.95) 82%, rgba(249,247,243,0) 100%);
                    }
                    .result-kicker {
                        display: none;
                    }
                    .result-main-row {
                        align-items: center;
                        gap: 10px;
                    }
                    .result-title {
                        font-size: 1rem;
                    }
                    .result-subtitle {
                        margin-top: 3px;
                        font-size: 0.68rem;
                    }
                    .result-count {
                        margin-top: 2px;
                        font-size: 0.78rem;
                    }
                    .result-actions {
                        gap: 6px;
                    }
                    .result-action {
                        width: 34px;
                        height: 34px;
                        padding: 0;
                        border-radius: 50%;
                        border: 1px solid rgba(31,27,21,0.12);
                    }
                    .result-action span {
                        display: none;
                    }
                    .result-refine-panel {
                        margin-top: 10px;
                        padding: 10px;
                        border-radius: 14px;
                    }
                    .search-empty-state .result-action {
                        width: auto;
                        height: 36px;
                        padding: 0 13px;
                        border-radius: 999px;
                    }
                    .active-filter-row {
                        margin-top: 10px;
                    }
                    .active-filter-chip {
                        height: 28px;
                        font-size: 0.64rem;
                    }
                    .search-development-panel {
                        margin: 0 -2px 13px;
                        padding: 10px;
                        border-radius: 14px;
                    }
                    .search-development-head {
                        margin-bottom: 8px;
                    }
                    .search-development-title {
                        font-size: 0.7rem;
                    }
                    .search-development-count {
                        display: none;
                    }
                    .search-development-grid {
                        grid-template-columns: 1fr;
                        gap: 8px;
                    }
                    .search-development-card {
                        grid-template-columns: 84px minmax(0, 1fr);
                        min-height: 112px;
                    }
                    .search-development-media {
                        min-height: 112px;
                    }
                    .search-development-body {
                        gap: 7px;
                        padding: 10px;
                    }
                    .search-development-name {
                        font-size: 0.9rem;
                    }
                    .search-development-pill {
                        min-height: 22px;
                        font-size: 0.56rem;
                    }
                    .search-memory-panel {
                        margin: 0 -2px 13px;
                        padding: 10px;
                        border-radius: 14px;
                    }
                    .search-memory-head {
                        margin-bottom: 8px;
                    }
                    .search-memory-title {
                        font-size: 0.68rem;
                    }
                    .search-memory-row {
                        display: flex;
                        gap: 8px;
                        margin: 0 -10px;
                        overflow-x: auto;
                        padding: 0 10px 2px;
                        scroll-snap-type: x proximity;
                        scrollbar-width: none;
                    }
                    .search-memory-row::-webkit-scrollbar {
                        display: none;
                    }
                    .search-memory-card {
                        flex: 0 0 min(245px, 78vw);
                        scroll-snap-align: start;
                    }
                    .search-results-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 18px 10px;
                    }
                    .search-card-wrap--highlighted {
                        transform: none;
                    }
                    .search-footer {
                        margin-top: 20px;
                        padding-bottom: 4px;
                        font-size: 0.58rem;
                    }
                }
            `}</style>

            <SearchViews
                previewOpen={!isDevelopmentOnlySearch && Boolean(selectedMapProperty)}
                map={
                    <div className="search-map-interactive-layer">
                        <MapSearch
                            properties={visibleMapProperties}
                            hoveredPropertyId={isDevelopmentOnlySearch ? null : hoveredPropertyId || selectedMapPropertyId}
                            selectedPropertyId={isDevelopmentOnlySearch ? null : selectedMapPropertyId}
                            drawArea={selectedDrawArea}
                            regionArea={selectedRegionArea}
                            onMarkerHover={handleMarkerHover}
                            onPropertySelect={isDevelopmentOnlySearch ? handleDevelopmentMapSelect : handleMapPropertySelect}
                            onDrawAreaChange={handleDrawAreaChange}
                            onSearchFiltersApply={handleMapSearchFiltersApply}
                            refitKey={mapViewKey}
                            officeMarker={shouldShowOfficeOnMap ? OFFICE_LOCATION_MARKER : null}
                            initialMapStyle="luxury"
                        />
                    </div>
                }
                overlay={selectedMapProperty && (
                    <div className="search-map-property-preview">
                        <MapPropertyPreviewCard
                            property={selectedMapProperty}
                            properties={mapPreviewProperties}
                            selectedPropertyId={selectedMapPropertyId}
                            onClose={handleMapPropertyPreviewClose}
                            onPropertySelect={mapPreviewProperties.length > 1 ? handleMapPreviewPropertySelect : undefined}
                        />
                    </div>
                )}
            >
                <header className="result-lux-header">
                    <div className="result-kicker">
                        <Sparkles size={13} />
                        Curadoria Pilger
                    </div>
                    <div className="result-main-row">
                        <div>
                            <h1 className="result-title">{displayResultTitle}</h1>
                            {displayResultSubtitle && (
                                <p className="result-subtitle">{displayResultSubtitle}</p>
                            )}
                            <p className="result-count">
                                <strong>{isSpatiallyFiltered ? visibleCount : totalCount}</strong> {countLabel}
                                {isSpatiallyFiltered && visibleCount < totalCount && (
                                    <span> ({totalCount} total)</span>
                                )}
                            </p>
                        </div>
                        <div className="result-actions">
                            <SearchAlertsPanel buttonClassName="result-action result-action-button" />
                            {activeFilters.length > 0 && (
                                <Link
                                    href="/busca"
                                    className="result-action"
                                    aria-label="Limpar filtros"
                                    onClick={() => {
                                        void trackEvent('search_results_clear_clicked', {
                                            active_filters: activeFilters,
                                            total_count: totalCount,
                                            visible_count: visibleCount,
                                        })
                                    }}
                                >
                                    <X size={15} />
                                    <span>Limpar</span>
                                </Link>
                            )}
                            <button
                                type="button"
                                className={`result-action result-action-button ${saveAlertState === 'saved' ? 'result-action--saved' : ''}${saveAlertState === 'error' ? ' result-action--error' : ''}`}
                                aria-label="Salvar alerta desta busca"
                                onClick={handleSaveSearchAlert}
                                disabled={saveAlertState === 'saving'}
                            >
                                {saveAlertState === 'saving' ? (
                                    <Loader2 size={15} className="spin" />
                                ) : saveAlertState === 'saved' ? (
                                    <Check size={15} />
                                ) : (
                                    <BellRing size={15} />
                                )}
                                <span>
                                    {saveAlertState === 'saving'
                                        ? 'Salvando'
                                        : saveAlertState === 'saved'
                                            ? 'Salvo'
                                            : saveAlertState === 'error'
                                                ? 'Tente de novo'
                                                : 'Salvar alerta'}
                                </span>
                            </button>
                            <button
                                type="button"
                                className="result-action result-action--gold result-action-button"
                                aria-expanded={showRefineSearch}
                                aria-label="Buscar imóveis"
                                onClick={handleSearchButtonClick}
                            >
                                <Search size={15} />
                                <span>Buscar</span>
                            </button>
                        </div>
                    </div>
                    {showRefineSearch && (
                        <div className="result-refine-panel" ref={refinePanelRef}>
                            <HomeSearchBar
                                initialSearchParams={searchParams.toString()}
                                onValuesChange={handleRefineSearchValuesChange}
                                variant="results"
                            />
                        </div>
                    )}
                    {activeFilters.length > 0 && (
                        <div className="active-filter-row" aria-label="Filtros ativos">
                            {activeFilters.map(filter => (
                                <Link
                                    key={`${filter.key}-${filter.value}`}
                                    href={makeRemoveFilterHref(filter.key)}
                                    className="active-filter-chip"
                                    onClick={() => {
                                        void trackEvent('search_results_filter_removed', {
                                            filter_key: filter.key,
                                            filter_value: filter.value,
                                            filter_label: filter.label,
                                            active_filters: activeFilters,
                                            total_count: totalCount,
                                            visible_count: visibleCount,
                                        })
                                    }}
                                >
                                    {filter.label}
                                    <X size={12} />
                                </Link>
                            ))}
                        </div>
                    )}
                </header>

                {hasDevelopmentResults && (
                    <section className="search-development-panel" aria-label="Empreendimentos encontrados">
                        <div className="search-development-head">
                            <div className="search-development-title">
                                <Building2 size={15} />
                                <span>Empreendimentos encontrados</span>
                            </div>
                            <span className="search-development-count">
                                {developmentResults.length === 1 ? '1 resultado' : `${developmentResults.length} resultados`}
                            </span>
                        </div>
                        <div className="search-development-grid">
                            {developmentResults.map((development, index) => (
                                <Link
                                    href={`/${development.slug}`}
                                    className="search-development-card"
                                    key={development.slug}
                                    onClick={() => handleDevelopmentClick(development, index)}
                                >
                                    <span className="search-development-media" aria-hidden="true">
                                        <img src={development.heroImage || '/placeholder-house.jpg'} alt="" loading={index < 2 ? 'eager' : 'lazy'} />
                                    </span>
                                    <span className="search-development-body">
                                        <span className="search-development-kicker">
                                            <Sparkles size={11} />
                                            {development.stageLabel}
                                        </span>
                                        <strong className="search-development-name">{development.name}</strong>
                                        <span className="search-development-meta">
                                            <span className="search-development-pill">
                                                <MapPin size={11} />
                                                <span>{replaceItajaiWithPraiaBrava(development.locationName)}</span>
                                            </span>
                                            <span className="search-development-pill">
                                                <Home size={11} />
                                                <span>{developmentUnitLabel(development)}</span>
                                            </span>
                                        </span>
                                        <span className="search-development-cta">
                                            Ver empreendimento
                                            <ArrowRight size={13} />
                                        </span>
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {!isDevelopmentOnlySearch && (memoryItems.length > 0 || memoryLoading) && (
                    <section className="search-memory-panel" aria-label="Imóveis salvos e vistos recentemente">
                        <div className="search-memory-head">
                            <div className="search-memory-title">
                                <Clock3 size={15} />
                                <span>Continue de onde parou</span>
                            </div>
                            {favoriteIds.length > 0 && (
                                <Link
                                    href="/favoritos"
                                    className="search-memory-link"
                                    onClick={() => {
                                        void trackEvent('search_results_favorites_shortcut_clicked', {
                                            favorite_count: favoriteIds.length,
                                            history_count: historyIds.length,
                                        })
                                    }}
                                >
                                    Comparar salvos
                                    <ArrowRight size={13} />
                                </Link>
                            )}
                        </div>
                        {memoryItems.length > 0 && (
                            <div className="search-memory-row">
                                {memoryItems.map(({ property, source }) => (
                                    <Link
                                        href={propertyDetailsPath(property)}
                                        className="search-memory-card"
                                        key={`${source}-${property.id}`}
                                        onClick={() => handleMemoryPropertyClick(property, source)}
                                    >
                                        <span className="search-memory-media" aria-hidden="true">
                                            <img src={memoryPropertyImage(property)} alt="" loading="lazy" />
                                        </span>
                                        <span className="search-memory-copy">
                                            <strong>{memoryPropertyTitle(property)}</strong>
                                            <span>{memoryPropertyLocation(property)}</span>
                                            <span className="search-memory-meta">
                                                <span className={`search-memory-chip ${source === 'favorite' ? 'search-memory-chip--favorite' : ''}`}>
                                                    {source === 'favorite' ? <Heart size={10} /> : <Clock3 size={10} />}
                                                    {source === 'favorite' ? 'Salvo' : 'Visto'}
                                                </span>
                                                <span>{formatMemoryPrice(property.price)}</span>
                                            </span>
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {visibleProperties.length === 0 && !hasDevelopmentResults ? (
                    <div className="search-empty-state">
                        <div className="search-empty-icon">
                            <SearchX size={20} />
                        </div>
                        <h2 className="search-empty-title">Nenhum imóvel nesta área</h2>
                        <p className="search-empty-copy">
                            Amplie o mapa ou remova um filtro para encontrar outras oportunidades.
                        </p>
                        <Link
                            href="/busca"
                            className="result-action result-action--gold"
                            onClick={() => {
                                void trackEvent('search_results_empty_view_all_clicked', {
                                    active_filters: activeFilters,
                                    total_count: totalCount,
                                    visible_count: visibleCount,
                                })
                            }}
                        >
                            <MapPinned size={15} />
                            Ver todos
                        </Link>
                    </div>
                ) : visibleProperties.length > 0 ? (
                    <>
                        <div className="search-results-grid">
                            {renderedProperties.map((property: any, index: number) => (
                                <div
                                    key={property.id}
                                    className={`search-card-wrap ${mapHoveredId === property.id ? 'search-card-wrap--highlighted' : ''}`}
                                    onMouseEnter={() => handleCardHover(property.id)}
                                    onMouseLeave={() => handleCardHover(null)}
                                >
                                    <PropertyCard
                                        property={property}
                                        landingPageSlug={lpMap[property.id]}
                                        imagePriority={index < 2}
                                        variant="homeCompact"
                                    />
                                </div>
                            ))}
                        </div>
                        {hiddenVisibleCount > 0 && (
                            <div className="search-render-limit">
                                Mostrando os primeiros {renderedProperties.length} imóveis desta área. Aproxime o mapa para refinar os resultados.
                            </div>
                        )}
                    </>
                ) : null}

                <footer className="search-footer">
                    {new Date().getFullYear()} Guilherme Pilger Corretor de Imóveis
                </footer>
            </SearchViews>
        </>
    )
}
