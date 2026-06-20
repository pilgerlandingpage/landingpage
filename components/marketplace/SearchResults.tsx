'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, BellRing, Check, Clock3, Heart, Loader2, MapPinned, Search, SearchX, Sparkles, X } from 'lucide-react'
import MapSearch from './MapSearch'
import SearchViews from './SearchViews'
import PropertyCard from './PropertyCard'
import MapPropertyPreviewCard from './MapPropertyPreviewCard'
import SearchAlertsPanel from './SearchAlertsPanel'
import HomeSearchBar, { type HomeSearchValues } from './HomeSearchBar'
import type { MapDrawArea } from './PropertyMap'
import { replaceItajaiWithPraiaBrava } from '@/lib/locations/display'
import { findMapRegionForSearchParams } from '@/lib/locations/map-regions'
import { propertyDetailsPath } from '@/lib/properties/responsive-destination'
import { getVisitorId, trackEvent } from '@/lib/tracking/client'

const MAX_RENDERED_CARDS = 60
const FAVORITES_KEY = 'pilger_property_favorites'
const HISTORY_KEY = 'pilger_property_history'
const MAX_MEMORY_PROPERTIES = 10
const OFFICE_SEARCH_PARAM_VALUE = '1'
const MAP_PROPERTY_PARAM = 'mapProperty'
const DRAW_AREA_PARAM = 'drawArea'
const MAP_BOUNDS_PARAM = 'mapBounds'
type SearchMemorySource = 'favorite' | 'history'
const OFFICE_LOCATION_MARKER = {
    latLng: [-26.95665680834595, -48.62979654548911] as [number, number],
    title: 'Imobiliária Guilherme Pilger',
    subtitle: 'Praia Brava',
    address: 'Av. Carlos Drummond de Andrade, 33 - Loja 01 - Praia Brava, Itajaí - SC, 88306-800',
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
        lancamento: 'Lancamento',
        'em-construcao': 'Em construcao',
        pronto: 'Pronto',
        mobiliado: 'Mobiliado',
    }

    const labels: Record<string, string> = {
        q: `Busca: ${replaceItajaiWithPraiaBrava(value)}`,
        city: cityLabels[value] || replaceItajaiWithPraiaBrava(value),
        type: value,
        price: `Valor: ${priceLabels[value] || value.replace('-', ' ate ')}`,
        offer: value === 'rent' ? 'Aluguel' : 'Venda',
        bedroomsMin: `${value}+ dormitórios`,
        suitesMin: `${value}+ suites`,
        bathroomsMin: `${value}+ banheiros`,
        parkingMin: `${value}+ vagas`,
        areaMin: `A partir de ${value}m2`,
        areaMax: `Ate ${value}m2`,
        priceMin: `Min. R$ ${Number(value).toLocaleString('pt-BR')}`,
        priceMax: `Max. R$ ${Number(value).toLocaleString('pt-BR')}`,
        office: 'Imobiliária Guilherme Pilger',
        subtype: value.replace(/-/g, ' '),
        tag: tagLabels[value] || value.replace(/-/g, ' '),
    }

    return labels[key] || `${key}: ${value}`
}

function buildSearchAlertTitle(filters: Array<{ label: string }>, selectedRegion?: string | null, hasDrawArea = false) {
    const labels = filters.map(filter => filter.label).filter(Boolean).slice(0, 3)
    if (labels.length) return labels.join(' + ')
    if (selectedRegion) return `Alerta em ${selectedRegion}`
    if (hasDrawArea) return 'Alerta na area desenhada'
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
    return replaceItajaiWithPraiaBrava(property.seo_title || property.title || 'Imovel selecionado')
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

interface MapBounds {
    north: number
    south: number
    east: number
    west: number
}

interface SearchResultsProps {
    properties: any[]
    propertiesWithCoords: any[]
    lpMap: Record<string, string>
}

export default function SearchResults({ properties, propertiesWithCoords, lpMap }: SearchResultsProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const searchKey = searchParams.toString()
    const isOfficeSearch = searchParams.get('office') === OFFICE_SEARCH_PARAM_VALUE
    const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null)
    const [mapHoveredId, setMapHoveredId] = useState<string | null>(null)
    const [showRefineSearch, setShowRefineSearch] = useState(false)
    const [selectedMapPropertyOverride, setSelectedMapPropertyOverride] = useState<{ key: string; id: string | null } | null>(null)
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
    const mapViewKey = `${searchKey}:${shouldShowOfficeOnMap ? 'office' : 'properties'}`
    const urlMapBounds = useMemo(() => parseMapBoundsParam(searchParams.get(MAP_BOUNDS_PARAM)), [searchKey, searchParams])
    const mapBounds = urlMapBounds
    const selectedMapPropertyId = selectedMapPropertyOverride?.key === searchKey
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

    const activeFilters = useMemo(() => {
        const ignored = new Set(['page', MAP_PROPERTY_PARAM, DRAW_AREA_PARAM, MAP_BOUNDS_PARAM])

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
        return filterPropertiesByDrawArea(filterPropertiesByBounds(properties, mapBounds), selectedDrawArea)
    }, [properties, mapBounds, selectedDrawArea])

    const visibleMapProperties = useMemo(() => {
        if (shouldShowOfficeOnMap) return []
        return filterPropertiesByDrawArea(filterPropertiesByBounds(propertiesWithCoords, mapBounds), selectedDrawArea)
    }, [mapBounds, propertiesWithCoords, selectedDrawArea, shouldShowOfficeOnMap])

    const selectedMapProperty = useMemo(() => {
        if (!selectedMapPropertyId || shouldShowOfficeOnMap) return null
        const property = propertiesWithCoords.find(item => item.id === selectedMapPropertyId) || null
        if (!property) return null
        if (mapBounds && !filterPropertiesByBounds([property], mapBounds).length) return null
        if (selectedDrawArea && !filterPropertiesByDrawArea([property], selectedDrawArea).length) return null
        return property
    }, [mapBounds, propertiesWithCoords, selectedDrawArea, selectedMapPropertyId, shouldShowOfficeOnMap])
    const visibleCount = visibleProperties.length
    const totalCount = properties.length
    const renderedProperties = visibleProperties.slice(0, MAX_RENDERED_CARDS)
    const hiddenVisibleCount = Math.max(0, visibleCount - renderedProperties.length)
    const isSpatiallyFiltered = Boolean(selectedDrawArea || (mapBounds && visibleCount < totalCount))
    const searchAlertTitle = useMemo(
        () => buildSearchAlertTitle(activeFilters, selectedRegionArea?.label, Boolean(selectedDrawArea)),
        [activeFilters, selectedDrawArea, selectedRegionArea]
    )
    const samplePropertyIds = useMemo(
        () => visibleProperties.slice(0, 18).map(property => String(property.id || '')).filter(Boolean),
        [visibleProperties]
    )
    const countLabel = selectedDrawArea
        ? 'imoveis na area desenhada'
        : mapBounds && visibleCount < totalCount
            ? 'imoveis nesta area'
            : 'imoveis encontrados'
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
                    body: 'Ative as notificacoes para ser avisado quando entrar um imovel com esse perfil.',
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
        replaceSpatialSearchParams({ drawArea: area, mapPropertyId: null })

        if (area) {
            const nextVisibleCount = filterPropertiesByDrawArea(filterPropertiesByBounds(properties, mapBounds), area).length

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
                visible_count: filterPropertiesByBounds(properties, mapBounds).length,
                bounds: mapBounds,
                selected_region: selectedRegionArea?.id || null,
                selected_region_label: selectedRegionArea?.label || null,
            })
        }
    }, [activeFilters, mapBounds, properties, replaceSpatialSearchParams, searchKey, selectedRegionArea, totalCount])

    const handleMapPropertySelect = useCallback((property: any) => {
        setSelectedMapPropertyOverride({ key: searchKey, id: property.id })
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
    }, [activeFilters, searchKey, selectedRegionArea, totalCount, visibleCount])

    const handleMapPropertyPreviewClose = useCallback(() => {
        const property = selectedMapProperty
        setSelectedMapPropertyOverride({ key: searchKey, id: null })
        replaceMapPropertyParam(null)

        if (property) {
            void trackEvent('property_map_preview_closed', {
                property_id: property.id,
                title: property.title,
            })
        }
    }, [searchKey, selectedMapProperty])

    const handleMapPreviewPropertySelect = useCallback((property: any, source: string) => {
        if (!property?.id) return
        if (property.id === selectedMapPropertyId) return

        setSelectedMapPropertyOverride({ key: searchKey, id: property.id })
        replaceMapPropertyParam(property.id)
        const nextIndex = visibleMapProperties.findIndex(item => item.id === property.id)

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
    }, [activeFilters, searchKey, selectedMapPropertyId, selectedRegionArea, totalCount, visibleMapProperties])

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
                .search-results-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 22px 18px;
                    min-width: 0;
                }
                .result-lux-header {
                    position: sticky;
                    top: 0;
                    z-index: 20;
                    margin: 0 0 18px;
                    padding: 14px 0 16px;
                    background:
                        linear-gradient(180deg, rgba(247,245,240,0.98) 0%, rgba(247,245,240,0.9) 82%, rgba(247,245,240,0) 100%);
                    backdrop-filter: blur(16px);
                }
                .result-kicker {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    margin-bottom: 8px;
                    color: #a78042;
                    font: 900 0.68rem/1 'Inter', sans-serif;
                    letter-spacing: 0.18em;
                    text-transform: uppercase;
                }
                .result-main-row {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    gap: 14px;
                }
                .result-title {
                    margin: 0;
                    color: #201d19;
                    font-family: 'Noto Serif', Georgia, serif;
                    font-size: clamp(1.38rem, 2vw, 2rem);
                    font-weight: 700;
                    line-height: 1.05;
                    letter-spacing: 0;
                }
                .result-count {
                    margin-top: 6px;
                    color: #6d665c;
                    font: 650 0.84rem/1.3 'Inter', sans-serif;
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
                .search-memory-panel {
                    margin: 0 0 18px;
                    padding: 13px;
                    border: 1px solid rgba(184,148,95,0.16);
                    border-radius: 16px;
                    background: rgba(255,255,255,0.82);
                    box-shadow: 0 14px 32px rgba(31,24,16,0.08);
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
                    display: grid;
                    gap: 9px;
                    grid-template-columns: repeat(auto-fit, minmax(168px, 1fr));
                }
                .search-memory-card {
                    display: grid;
                    grid-template-columns: 54px minmax(0, 1fr);
                    gap: 9px;
                    min-width: 0;
                    min-height: 70px;
                    padding: 8px;
                    border: 1px solid rgba(35,31,26,0.08);
                    border-radius: 12px;
                    background: #fff;
                    color: #211d18;
                    text-decoration: none;
                    box-shadow: 0 8px 18px rgba(30,24,17,0.06);
                    transition: transform 0.18s ease, border-color 0.18s ease;
                }
                .search-memory-card:hover {
                    border-color: rgba(184,148,95,0.38);
                    transform: translateY(-1px);
                }
                .search-memory-media {
                    position: relative;
                    width: 54px;
                    min-height: 54px;
                    overflow: hidden;
                    border-radius: 9px;
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
                previewOpen={Boolean(selectedMapProperty)}
                map={
                    <div className="search-map-interactive-layer">
                        <MapSearch
                            properties={visibleMapProperties}
                            hoveredPropertyId={hoveredPropertyId || selectedMapPropertyId}
                            selectedPropertyId={selectedMapPropertyId}
                            drawArea={selectedDrawArea}
                            regionArea={selectedRegionArea}
                            onMarkerHover={handleMarkerHover}
                            onPropertySelect={handleMapPropertySelect}
                            onDrawAreaChange={handleDrawAreaChange}
                            refitKey={mapViewKey}
                            officeMarker={shouldShowOfficeOnMap ? OFFICE_LOCATION_MARKER : null}
                            initialMapStyle="luxury"
                        />
                    </div>
                }
                overlay={selectedMapProperty && (
                    <MapPropertyPreviewCard
                        property={selectedMapProperty}
                        properties={visibleMapProperties}
                        selectedPropertyId={selectedMapPropertyId}
                        onClose={handleMapPropertyPreviewClose}
                        onPropertySelect={visibleMapProperties.length > 1 ? handleMapPreviewPropertySelect : undefined}
                    />
                )}
            >
                <header className="result-lux-header">
                    <div className="result-kicker">
                        <Sparkles size={13} />
                        Curadoria Pilger
                    </div>
                    <div className="result-main-row">
                        <div>
                            <h1 className="result-title">Imoveis selecionados</h1>
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

                {(memoryItems.length > 0 || memoryLoading) && (
                    <section className="search-memory-panel" aria-label="Imoveis salvos e vistos recentemente">
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
                                        href={propertyDetailsPath(property.id)}
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

                {visibleProperties.length === 0 ? (
                    <div className="search-empty-state">
                        <div className="search-empty-icon">
                            <SearchX size={20} />
                        </div>
                        <h2 className="search-empty-title">Nenhum imovel nesta area</h2>
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
                ) : (
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
                                        imagePriority={index < 4}
                                        variant="homeCompact"
                                    />
                                </div>
                            ))}
                        </div>
                        {hiddenVisibleCount > 0 && (
                            <div className="search-render-limit">
                                Mostrando os primeiros {renderedProperties.length} imoveis desta area. Aproxime o mapa para refinar os resultados.
                            </div>
                        )}
                    </>
                )}

                <footer className="search-footer">
                    {new Date().getFullYear()} Guilherme Pilger Corretor de Imoveis
                </footer>
            </SearchViews>
        </>
    )
}
