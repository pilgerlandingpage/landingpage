'use client'

import { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import { Circle, MapContainer, TileLayer, Marker, Polygon, Polyline, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import Link from 'next/link'
import { Anchor, Bath, Bed, Building2, CloudSun, Coffee, Cross, Eraser, Flame, Globe2, GraduationCap, Hand, Landmark, Layers, LocateFixed, Map as MapIcon, MapPin, Maximize, Satellite, ShoppingBag, SlidersHorizontal, Sparkles, ThermometerSun, TreePalm, Utensils, Waves, Wind, X } from 'lucide-react'
import { replaceItajaiWithPraiaBrava } from '@/lib/locations/display'
import { LEAFLET_OSM_ATTRIBUTION, LEAFLET_OSM_TILE_URL } from '@/lib/maps/leaflet-style'
import type { MapRegionArea } from '@/lib/locations/map-regions'
import { NEARBY_BENEFIT_LAYERS as MAP_AMENITY_LAYERS, getNearbyBenefitConfig, type NearbyBenefitLayer } from '@/lib/locations/nearby-benefits'
import { propertyDetailsPath } from '@/lib/properties/responsive-destination'
import { getVisitorId, trackEvent } from '@/lib/tracking/client'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

interface Property {
    id: string
    source_slug?: string | null
    title: string
    price: number | null
    latitude: number | string | null
    longitude: number | string | null
    featured_image: string | null
    images?: string[] | null
    video_url?: string | null
    bedrooms: number | null
    bathrooms: number | null
    suites?: number | null
    parking_spaces?: number | null
    area_m2: number | null
    property_type?: string | null
    neighborhood?: string | null
    description?: string | null
    source_status?: string | null
    exclusive?: boolean | null
    slug?: string
}

interface MapBounds {
    north: number
    south: number
    east: number
    west: number
}

interface PropertyMapProps {
    properties: Property[]
    hoveredPropertyId?: string | null
    selectedPropertyId?: string | null
    drawArea?: MapDrawArea | null
    regionArea?: MapRegionArea | null
    onMarkerHover?: (id: string | null) => void
    onPropertySelect?: (property: Property) => void
    onDrawAreaChange?: (area: MapDrawArea | null) => void
    onBoundsChange?: (bounds: MapBounds) => void
    onUserBoundsChange?: (bounds: MapBounds) => void
    refitKey?: string
    interactionEnabled?: boolean
    officeMarker?: OfficeMarker | null
    initialMapStyle?: MapStyle
    overviewMode?: boolean
    fixedOverviewView?: MapFixedView | null
}

type MappedProperty = {
    property: Property
    latLng: [number, number]
}

export type MapDrawArea = [number, number][]
export type MapFixedView = {
    center: [number, number]
    zoom: number
    mobileCenter?: [number, number]
    mobileZoom?: number
}

type OfficeMarker = {
    latLng: [number, number]
    title: string
    subtitle?: string
    address: string
}

type ClusterItem =
    | { kind: 'single'; item: MappedProperty }
    | { kind: 'cluster'; id: string; items: MappedProperty[]; latLng: [number, number]; minPrice: number | null }

export type MapStyle = 'luxury' | 'satellite' | 'classic'
type QuickFilter = 'all' | 'exclusive' | 'waterfront' | 'launch' | 'premium'
type MapContextLayer = 'flood' | 'fire' | 'wind' | 'air' | 'heat'
type MapAmenityLayer = NearbyBenefitLayer
type LocateState = 'idle' | 'loading' | 'active' | 'error'

type UserLocationSnapshot = {
    latitude: number
    longitude: number
    accuracy?: number | null
}

type UserMapLocation = UserLocationSnapshot & {
    latLng: [number, number]
    bounds: MapBounds
}

const QUICK_FILTERS: Array<{ value: QuickFilter; label: string }> = [
    { value: 'all', label: 'Todos' },
    { value: 'exclusive', label: 'Exclusivos' },
    { value: 'waterfront', label: 'Frente mar' },
    { value: 'launch', label: 'Lançamentos' },
    { value: 'premium', label: 'Alto padrão' },
]

const MAP_STYLES: Array<{ value: MapStyle; label: string; icon: 'sparkles' | 'satellite' | 'layers' }> = [
    { value: 'luxury', label: 'Leaflet', icon: 'sparkles' },
    { value: 'satellite', label: 'Satélite', icon: 'satellite' },
    { value: 'classic', label: 'Ruas', icon: 'layers' },
]
const MAP_OPTION_STYLES: Array<{ value: MapStyle; label: string; icon: 'map' | 'satellite' | 'sparkles' }> = [
    { value: 'classic', label: 'Ruas', icon: 'map' },
    { value: 'satellite', label: 'Satelite', icon: 'satellite' },
    { value: 'luxury', label: 'Leaflet', icon: 'sparkles' },
]
const MAP_CONTEXT_LAYERS: Array<{ value: MapContextLayer; label: string; icon: 'flood' | 'fire' | 'wind' | 'air' | 'heat' }> = [
    { value: 'flood', label: 'Alagamento', icon: 'flood' },
    { value: 'fire', label: 'Fogo', icon: 'fire' },
    { value: 'wind', label: 'Vento', icon: 'wind' },
    { value: 'air', label: 'Ar', icon: 'air' },
    { value: 'heat', label: 'Calor', icon: 'heat' },
]
const MAP_AMENITY_ICONS: Record<MapAmenityLayer, typeof MapPin> = {
    beach: TreePalm,
    school: GraduationCap,
    bank: Landmark,
    dining: Utensils,
    coffee: Coffee,
    health: Cross,
    shopping: ShoppingBag,
    marina: Anchor,
    park: TreePalm,
}
const AGENCY_MARKER_ICON_URL = 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/icon.png'
const AGENCY_CARD_IMAGE_URL = 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/unnamed.webp'
const MAP_CONTROL_HINT_STORAGE_KEY = 'pilger_map_control_hints_seen_v1'
const MIN_DRAW_PIXEL_DISTANCE = 10
const MAX_DRAW_AREA_POINTS = 96
const DRAW_AREA_POLYGON_OPTIONS: L.PathOptions = {
    color: '#2f7bff',
    weight: 2,
    opacity: 0.96,
    fillColor: '#2f7bff',
    fillOpacity: 0.14,
    className: 'map-draw-area-polygon',
}
const DRAW_AREA_DRAFT_OPTIONS: L.PathOptions = {
    color: '#2f7bff',
    weight: 3,
    opacity: 0.98,
    dashArray: '7 7',
    className: 'map-draw-area-draft',
}
const REGION_AREA_POLYGON_OPTIONS: L.PathOptions = {
    color: '#0b84ff',
    weight: 2.6,
    opacity: 0.96,
    fillColor: '#ffffff',
    fillOpacity: 0.72,
    className: 'map-region-area-polygon',
}
const REGION_AREA_HALO_OPTIONS: L.PathOptions = {
    color: '#0b84ff',
    weight: 7,
    opacity: 0.2,
    fillColor: '#ffffff',
    fillOpacity: 0,
    className: 'map-region-area-halo',
}
const REGION_AREA_MASK_OPTIONS: L.PathOptions = {
    color: '#4e6173',
    weight: 0,
    opacity: 0,
    fillColor: '#5f7082',
    fillOpacity: 0.34,
    className: 'map-region-area-mask',
}
const REGION_MASK_OUTER_RING: MapDrawArea = [
    [-85, -180],
    [-85, 180],
    [85, 180],
    [85, -180],
]

const SERVICE_AREA_BOUNDS = {
    north: -25.0,
    south: -30.5,
    east: -47.0,
    west: -54.5,
}

function toCoordinate(value: number | string | null | undefined) {
    if (typeof value === 'string') return Number(value.replace(',', '.'))
    return Number(value)
}

function isValidLatLng(lat: number, lng: number) {
    return (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
    )
}

function isInsideServiceArea(lat: number, lng: number) {
    return (
        lat >= SERVICE_AREA_BOUNDS.south &&
        lat <= SERVICE_AREA_BOUNDS.north &&
        lng >= SERVICE_AREA_BOUNDS.west &&
        lng <= SERVICE_AREA_BOUNDS.east
    )
}

function getPropertyLatLng(property: Property): [number, number] | null {
    const lat = toCoordinate(property.latitude)
    const lng = toCoordinate(property.longitude)

    if (isValidLatLng(lat, lng) && isInsideServiceArea(lat, lng)) return [lat, lng]
    if (isValidLatLng(lng, lat) && isInsideServiceArea(lng, lat)) return [lng, lat]

    return null
}

function formatFullPrice(price: number | null | undefined) {
    if (!price) return 'Consulte'

    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
    }).format(price)
}

function formatMapPrice(price: number | null | undefined) {
    const value = Number(price || 0)
    if (!value) return 'Consulte'

    if (value >= 1000000) {
        const millions = value / 1000000
        const label = millions >= 10
            ? Math.round(millions).toLocaleString('pt-BR')
            : millions.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
        return `R$ ${label} mi`
    }

    if (value >= 1000) return `R$ ${Math.round(value / 1000).toLocaleString('pt-BR')} mil`
    return `R$ ${Math.round(value).toLocaleString('pt-BR')}`
}

function propertyText(property: Property) {
    return [
        property.title,
        property.description,
        property.property_type,
        property.neighborhood,
        property.source_status,
    ].filter(Boolean).join(' ').toLowerCase()
}

function textHasAny(property: Property, terms: string[]) {
    const text = propertyText(property)
    return terms.some(term => text.includes(term))
}

function matchesQuickFilter(item: MappedProperty, filter: QuickFilter) {
    const { property } = item

    if (filter === 'all') return true
    if (filter === 'exclusive') return Boolean(property.exclusive)
    if (filter === 'premium') return Number(property.price || 0) >= 5000000
    if (filter === 'waterfront') return textHasAny(property, ['frente mar', 'frente ao mar', 'beira mar', 'vista mar'])
    if (filter === 'launch') return textHasAny(property, ['lancamento', 'lançamento', 'construcao', 'construção', 'na planta'])

    return true
}

function getStyleIcon(icon: 'sparkles' | 'satellite' | 'layers') {
    if (icon === 'satellite') return <Satellite size={14} />
    if (icon === 'layers') return <Layers size={14} />
    return <Sparkles size={14} />
}

function getMapOptionIcon(icon: 'map' | 'satellite' | 'sparkles') {
    if (icon === 'satellite') return <Satellite size={30} />
    if (icon === 'sparkles') return <Sparkles size={30} />
    return <MapIcon size={30} />
}

function getContextLayerIcon(icon: 'flood' | 'fire' | 'wind' | 'air' | 'heat') {
    if (icon === 'flood') return <Waves size={17} />
    if (icon === 'fire') return <Flame size={17} />
    if (icon === 'wind') return <Wind size={17} />
    if (icon === 'air') return <CloudSun size={17} />
    if (icon === 'heat') return <ThermometerSun size={17} />
    return <Waves size={17} />
}

function clampCoordinate(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value))
}

function buildBoundsAroundLocation(latitude: number, longitude: number, accuracy?: number | null): MapBounds {
    const radiusMeters = Math.max(1200, Math.min(4500, Number(accuracy || 0) * 1.8 || 1800))
    const latDelta = radiusMeters / 111320
    const lngDivisor = Math.max(0.18, Math.cos(latitude * Math.PI / 180))
    const lngDelta = radiusMeters / (111320 * lngDivisor)

    return {
        north: clampCoordinate(latitude + latDelta, -90, 90),
        south: clampCoordinate(latitude - latDelta, -90, 90),
        east: clampCoordinate(longitude + lngDelta, -180, 180),
        west: clampCoordinate(longitude - lngDelta, -180, 180),
    }
}

async function saveMapLocationSignal(location: UserLocationSnapshot) {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const hasLeadSignal = Boolean(
        params.get('lead_id')
        || params.get('lead_phone')
        || params.get('wa_phone')
        || params.get('wpp_phone')
    )
    if (!hasLeadSignal) return

    try {
        await fetch('/api/leads/location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                visitor_cookie_id: getVisitorId(),
                source: 'property_map_locate_button',
                permission_status: 'granted',
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy,
                page_url: window.location.href,
                page_path: window.location.pathname,
                search_params: window.location.search,
            }),
        })
    } catch (error) {
        console.warn('[PropertyMap] location signal save failed:', error)
    }
}

type GooglePlacesWindow = Window & {
    google?: any
    __pilgerGooglePlacesPromise?: Promise<void>
}

type NearbyAmenityPlace = {
    id: string
    layer: MapAmenityLayer
    name: string
    vicinity?: string
    latLng: [number, number]
    distanceMeters: number
}

function getGooglePlacesWindow() {
    if (typeof window === 'undefined') return null
    return window as GooglePlacesWindow
}

function hasModernPlacesLibrary(googleWindow: GooglePlacesWindow | null) {
    return Boolean(googleWindow?.google?.maps?.places?.Place)
}

function loadGooglePlacesLibrary(apiKey: string) {
    const googleWindow = getGooglePlacesWindow()
    if (!googleWindow) return Promise.reject(new Error('Google Places indisponível fora do navegador.'))
    if (hasModernPlacesLibrary(googleWindow)) return Promise.resolve()
    if (googleWindow.__pilgerGooglePlacesPromise) return googleWindow.__pilgerGooglePlacesPromise

    googleWindow.__pilgerGooglePlacesPromise = new Promise<void>((resolve, reject) => {
        const finishWithImportLibrary = (startedAt = Date.now()) => {
            if (hasModernPlacesLibrary(googleWindow)) {
                resolve()
                return
            }

            const importLibrary = googleWindow.google?.maps?.importLibrary
            if (!importLibrary) {
                if (Date.now() - startedAt < 9000) {
                    window.setTimeout(() => finishWithImportLibrary(startedAt), 90)
                    return
                }

                reject(new Error('Biblioteca Places não está disponível.'))
                return
            }

            Promise.resolve(importLibrary('places'))
                .then(() => resolve())
                .catch(() => reject(new Error('Falha ao carregar Google Places.')))
        }

        if (googleWindow.google?.maps) {
            finishWithImportLibrary()
            return
        }

        const existingScript = document.getElementById('pilger-google-maps-js') as HTMLScriptElement | null
        if (existingScript) {
            existingScript.addEventListener('load', () => finishWithImportLibrary(), { once: true })
            existingScript.addEventListener('error', () => reject(new Error('Falha ao carregar Google Maps.')), { once: true })
            return
        }

        const script = document.createElement('script')
        script.id = 'pilger-google-maps-js'
        script.async = true
        script.defer = true
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&libraries=places&language=pt-BR&region=BR&loading=async`
        script.addEventListener('load', () => finishWithImportLibrary(), { once: true })
        script.addEventListener('error', () => reject(new Error('Falha ao carregar Google Maps.')), { once: true })
        document.head.appendChild(script)
    })

    return googleWindow.__pilgerGooglePlacesPromise
}

function getAmenityOption(layer: MapAmenityLayer) {
    return getNearbyBenefitConfig(layer)
}

function formatDistance(meters: number) {
    if (!Number.isFinite(meters)) return 'Distancia sob consulta'
    if (meters < 1000) return `${Math.max(40, Math.round(meters / 10) * 10).toLocaleString('pt-BR')} m`
    return `${(meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
}

function getPlaceDisplayName(result: any, fallback: string) {
    const displayName = result?.displayName
    if (typeof displayName === 'string') return displayName
    if (displayName?.text) return String(displayName.text)
    if (result?.name) return String(result.name)
    if (result?.formattedAddress) return String(result.formattedAddress)
    return fallback
}

function getPlaceVicinity(result: any) {
    if (result?.vicinity) return String(result.vicinity)
    if (result?.shortFormattedAddress) return String(result.shortFormattedAddress)
    if (result?.formattedAddress) return String(result.formattedAddress)
    return undefined
}

function getPlaceLatLng(result: any): [number, number] | null {
    const location = result?.location || result?.geometry?.location
    const lat = typeof location?.lat === 'function' ? location.lat() : Number(location?.lat)
    const lng = typeof location?.lng === 'function' ? location.lng() : Number(location?.lng)
    return isValidLatLng(lat, lng) ? [lat, lng] : null
}

async function searchAmenityPlaces(googleMaps: any, layer: MapAmenityLayer, center: L.LatLng, radius: number): Promise<any[]> {
    const option = getAmenityOption(layer)
    const placesApi = googleMaps?.places
    const Place = placesApi?.Place
    if (!option || !Place) return []

    const centerLiteral = { lat: center.lat, lng: center.lng }
    const fields = ['id', 'displayName', 'formattedAddress', 'location', 'types', 'primaryType']
    const safeRadius = Math.max(500, Math.min(radius, 50000))

    if (option.type && typeof Place.searchNearby === 'function') {
        try {
            const request: Record<string, unknown> = {
                fields,
                locationRestriction: { center: centerLiteral, radius: safeRadius },
                includedPrimaryTypes: [option.type],
                maxResultCount: 12,
            }
            const rankPreference = placesApi.SearchNearbyRankPreference?.DISTANCE
            if (rankPreference) request.rankPreference = rankPreference

            const response = await Place.searchNearby(request)
            const places = Array.isArray(response?.places) ? response.places : []
            if (places.length > 0) return places
        } catch (error) {
            console.warn(`[PropertyMap] searchNearby falhou para ${layer}:`, error)
        }
    }

    if (typeof Place.searchByText !== 'function') return []

    try {
        const request: Record<string, unknown> = {
            textQuery: option.keyword || option.searchLabel,
            fields,
            locationBias: centerLiteral,
            language: 'pt-BR',
            region: 'br',
            maxResultCount: 12,
        }

        if (option.type) {
            request.includedType = option.type
            request.useStrictTypeFiltering = true
        }

        const response = await Place.searchByText(request)
        return Array.isArray(response?.places) ? response.places : []
    } catch (error) {
        console.warn(`[PropertyMap] searchByText falhou para ${layer}:`, error)
        return []
    }
}

function createAmenityIcon(place: NearbyAmenityPlace) {
    const option = getAmenityOption(place.layer)
    const color = option?.color || '#1478d4'
    const label = escapeHtml(option?.shortLabel || option?.label.slice(0, 2).toUpperCase() || 'PO')

    return L.divIcon({
        className: 'map-amenity-marker',
        html: `<div class="map-amenity-marker-wrap map-amenity-marker--${place.layer}" style="--amenity-color:${color}">
            <span>${label}</span>
        </div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18],
    })
}

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[char] || char))
}

function MapUpdater({
    points,
    refitKey = '',
    hasFocusArea = false,
    overviewMode = false,
    fixedOverviewView = null,
}: {
    points: [number, number][]
    refitKey?: string
    hasFocusArea?: boolean
    overviewMode?: boolean
    fixedOverviewView?: MapFixedView | null
}) {
    const map = useMap()
    const lastPointsKey = useRef('')

    const pointsKey = useMemo(
        () => {
            const fixedViewKey = fixedOverviewView
                ? `${fixedOverviewView.center.join(',')}::${fixedOverviewView.zoom}::${fixedOverviewView.mobileCenter?.join(',') || ''}::${fixedOverviewView.mobileZoom || ''}`
                : 'auto'
            return `${refitKey}::${overviewMode ? 'overview' : hasFocusArea ? 'focus' : 'default'}::${fixedViewKey}::${points.map(([lat, lng]) => `${lat.toFixed(6)},${lng.toFixed(6)}`).join('|')}`
        },
        [fixedOverviewView, hasFocusArea, overviewMode, points, refitKey]
    )

    useEffect(() => {
        if (lastPointsKey.current === pointsKey) {
            return
        }

        lastPointsKey.current = pointsKey

        const isMobile = window.matchMedia('(max-width: 767px)').matches

        if (overviewMode && fixedOverviewView && !hasFocusArea) {
            const center = isMobile && fixedOverviewView.mobileCenter
                ? fixedOverviewView.mobileCenter
                : fixedOverviewView.center
            const zoom = isMobile && typeof fixedOverviewView.mobileZoom === 'number'
                ? fixedOverviewView.mobileZoom
                : fixedOverviewView.zoom

            map.invalidateSize({ animate: false })
            map.setView(center, zoom, { animate: false })
            return
        }

        if (points.length > 0) {
            const container = map.getContainer()
            const mapHeight = points.length > 1
                ? container.clientHeight || window.innerHeight
                : 0

            map.invalidateSize({ animate: false })

            if (points.length === 1) {
                map.flyTo(points[0], 15, { duration: 0.65 })
                return
            }

            const bounds = L.latLngBounds(points.map(([lat, lng]) => L.latLng(lat, lng)))
            const focusBottomPadding = Math.min(
                340,
                Math.max(isMobile ? 126 : 210, Math.round(mapHeight * (isMobile ? 0.3 : 0.34)))
            )
            const fitOptions: L.FitBoundsOptions = overviewMode
                ? isMobile
                    ? {
                        paddingTopLeft: [34, 128],
                        paddingBottomRight: [34, 64],
                        maxZoom: 11,
                    }
                    : {
                        paddingTopLeft: [72, 108],
                        paddingBottomRight: [72, 72],
                        maxZoom: 11,
                    }
                : hasFocusArea
                ? isMobile
                    ? {
                        paddingTopLeft: [26, 72],
                        paddingBottomRight: [26, focusBottomPadding],
                        maxZoom: 14,
                    }
                    : {
                        padding: [96, 96],
                        maxZoom: 14,
                    }
                : {
                    padding: [64, 64],
                    maxZoom: 15,
                }

            map.flyToBounds(bounds, { ...fitOptions, duration: 0.75 })
        }
    }, [fixedOverviewView, hasFocusArea, map, overviewMode, points, pointsKey])

    useEffect(() => {
        let frame: number | null = null

        const invalidateMapSize = () => {
            if (frame !== null) return

            frame = window.requestAnimationFrame(() => {
                frame = null
                map.invalidateSize({ animate: false })
            })
        }

        const resizeObserver = new ResizeObserver(() => {
            invalidateMapSize()
        })
        const container = map.getContainer()
        resizeObserver.observe(container)

        const timers = [100, 300, 600, 1200].map(delay =>
            setTimeout(() => {
                invalidateMapSize()
            }, delay)
        )

        return () => {
            resizeObserver.disconnect()
            timers.forEach(clearTimeout)
            if (frame !== null) {
                window.cancelAnimationFrame(frame)
            }
        }
    }, [map, points])

    return null
}

function SelectedPropertyFocusController({
    items,
    selectedPropertyId,
    enabled = true,
}: {
    items: MappedProperty[]
    selectedPropertyId?: string | null
    enabled?: boolean
}) {
    const map = useMap()
    const lastFocusKey = useRef('')

    useEffect(() => {
        if (!enabled || !selectedPropertyId) return

        const item = items.find(candidate => String(candidate.property.id) === String(selectedPropertyId))
        if (!item) return

        const focusKey = `${selectedPropertyId}:${item.latLng[0].toFixed(6)},${item.latLng[1].toFixed(6)}`
        if (lastFocusKey.current === focusKey) return
        lastFocusKey.current = focusKey

        const frame = window.requestAnimationFrame(() => {
            const focusZoom = Math.max(map.getZoom(), 15)
            const container = map.getContainer()
            const containerRect = container.getBoundingClientRect()
            const previewCard = document.querySelector<HTMLElement>('.map-property-preview')
            const previewRect = previewCard?.getBoundingClientRect()
            const visibleBottom = previewRect && previewRect.top > containerRect.top && previewRect.top < containerRect.bottom
                ? previewRect.top - containerRect.top - 18
                : containerRect.height
            const targetPoint = L.point(
                containerRect.width / 2,
                Math.max(110, Math.min(containerRect.height * 0.46, visibleBottom / 2))
            )
            const mapCenterPoint = L.point(containerRect.width / 2, containerRect.height / 2)
            const adjustedCenter = map.unproject(
                map.project(item.latLng, focusZoom).add(mapCenterPoint.subtract(targetPoint)),
                focusZoom
            )

            map.invalidateSize({ animate: false })
            map.flyTo(adjustedCenter, focusZoom, {
                duration: 0.48,
                easeLinearity: 0.22,
            })
        })

        return () => window.cancelAnimationFrame(frame)
    }, [enabled, items, map, selectedPropertyId])

    return null
}

function BoundsEmitter({
    onBoundsChange,
    onUserBoundsChange,
}: {
    onBoundsChange?: (bounds: MapBounds) => void
    onUserBoundsChange?: (bounds: MapBounds) => void
}) {
    const map = useMap()
    const userIntentRef = useRef(false)
    const resetTimerRef = useRef<number | null>(null)

    useEffect(() => {
        if (!onBoundsChange && !onUserBoundsChange) return

        const markUserIntent = () => {
            userIntentRef.current = true

            if (resetTimerRef.current) {
                window.clearTimeout(resetTimerRef.current)
            }

            resetTimerRef.current = window.setTimeout(() => {
                userIntentRef.current = false
                resetTimerRef.current = null
            }, 1200)
        }

        const markZoomIntent = (event: L.LeafletEvent) => {
            if ('originalEvent' in event) {
                markUserIntent()
            }
        }

        const emitBounds = () => {
            const b = map.getBounds()
            const bounds = {
                north: b.getNorth(),
                south: b.getSouth(),
                east: b.getEast(),
                west: b.getWest(),
            }

            onBoundsChange?.(bounds)

            if (userIntentRef.current) {
                onUserBoundsChange?.(bounds)
                userIntentRef.current = false
            }
        }
        const container = map.getContainer()

        map.on('dragstart', markUserIntent)
        map.on('zoomstart', markZoomIntent)
        map.on('moveend', emitBounds)
        map.on('zoomend', emitBounds)
        container.addEventListener('wheel', markUserIntent, { passive: true })
        container.addEventListener('keydown', markUserIntent)

        return () => {
            map.off('dragstart', markUserIntent)
            map.off('zoomstart', markZoomIntent)
            map.off('moveend', emitBounds)
            map.off('zoomend', emitBounds)
            container.removeEventListener('wheel', markUserIntent)
            container.removeEventListener('keydown', markUserIntent)

            if (resetTimerRef.current) {
                window.clearTimeout(resetTimerRef.current)
            }
        }
    }, [map, onBoundsChange, onUserBoundsChange])

    return null
}

function UserLocationController({
    requestId,
    onLocated,
    onStatusChange,
}: {
    requestId: number
    onLocated: (location: UserMapLocation) => void
    onStatusChange: (state: LocateState) => void
}) {
    const map = useMap()

    useEffect(() => {
        if (!requestId) return

        if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
            onStatusChange('error')
            void trackEvent('property_map_user_location_unavailable', {
                reason: 'geolocation_not_supported',
            })
            return
        }

        onStatusChange('loading')
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const latitude = position.coords.latitude
                const longitude = position.coords.longitude
                const accuracy = position.coords.accuracy || null

                if (!isValidLatLng(latitude, longitude)) {
                    onStatusChange('error')
                    return
                }

                const bounds = buildBoundsAroundLocation(latitude, longitude, accuracy)
                const location: UserMapLocation = {
                    latitude,
                    longitude,
                    accuracy,
                    latLng: [latitude, longitude],
                    bounds,
                }

                map.stop()
                map.setView([latitude, longitude], Math.max(map.getZoom(), 14), {
                    animate: true,
                    duration: 0.45,
                })
                onLocated(location)
                onStatusChange('active')
            },
            (error) => {
                const permissionStatus = error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'
                onStatusChange('error')
                void trackEvent('property_map_user_location_failed', {
                    permission_status: permissionStatus,
                    message: error.message,
                })
            },
            {
                enableHighAccuracy: true,
                maximumAge: 60000,
                timeout: 9000,
            }
        )
    }, [map, onLocated, onStatusChange, requestId])

    return null
}

function MapInteractionController({ enabled }: { enabled: boolean }) {
    const map = useMap()

    useEffect(() => {
        const handlers = [
            map.dragging,
            map.touchZoom,
            map.scrollWheelZoom,
            map.doubleClickZoom,
            map.boxZoom,
            map.keyboard,
        ].filter(Boolean)

        handlers.forEach(handler => {
            if (enabled) handler.enable()
            else handler.disable()
        })
    }, [enabled, map])

    return null
}

function distanceBetweenPoints(a: L.Point, b: L.Point) {
    const dx = a.x - b.x
    const dy = a.y - b.y
    return Math.sqrt(dx * dx + dy * dy)
}

function simplifyDrawArea(points: MapDrawArea): MapDrawArea {
    if (points.length <= MAX_DRAW_AREA_POINTS) return points

    const step = Math.ceil(points.length / MAX_DRAW_AREA_POINTS)
    const simplified = points.filter((_, index) => index % step === 0)
    const lastPoint = points[points.length - 1]

    if (simplified[simplified.length - 1] !== lastPoint) {
        simplified.push(lastPoint)
    }

    return simplified.slice(0, MAX_DRAW_AREA_POINTS)
}

function pointerEventToLatLng(map: L.Map, event: PointerEvent): { latLng: [number, number]; point: L.Point } {
    const rect = map.getContainer().getBoundingClientRect()
    const point = L.point(event.clientX - rect.left, event.clientY - rect.top)
    const latLng = map.containerPointToLatLng(point)

    return {
        latLng: [latLng.lat, latLng.lng],
        point,
    }
}

function DrawAreaLayer({
    enabled,
    area,
    onCommit,
}: {
    enabled: boolean
    area?: MapDrawArea | null
    onCommit?: (area: MapDrawArea) => void
}) {
    const map = useMap()
    const [draftArea, setDraftArea] = useState<MapDrawArea>([])
    const drawingRef = useRef(false)
    const pointsRef = useRef<MapDrawArea>([])
    const lastPointRef = useRef<L.Point | null>(null)

    useEffect(() => {
        if (!enabled || !onCommit) {
            drawingRef.current = false
            pointsRef.current = []
            lastPointRef.current = null
            return
        }

        const container = map.getContainer()
        const previousCursor = container.style.cursor
        const previousTouchAction = container.style.touchAction

        container.style.cursor = 'crosshair'
        container.style.touchAction = 'none'

        const addPoint = (event: PointerEvent, force = false) => {
            const next = pointerEventToLatLng(map, event)

            if (lastPointRef.current) {
                const distance = distanceBetweenPoints(next.point, lastPointRef.current)
                if (distance < (force ? 1 : MIN_DRAW_PIXEL_DISTANCE)) {
                    return
                }
            }

            lastPointRef.current = next.point
            pointsRef.current = [...pointsRef.current, next.latLng]
            setDraftArea(pointsRef.current)
        }

        const resetDrawingRefs = () => {
            drawingRef.current = false
            pointsRef.current = []
            lastPointRef.current = null
        }

        const stopDrawing = () => {
            resetDrawingRefs()
            setDraftArea([])
        }

        const commitDrawing = (event: PointerEvent) => {
            if (!drawingRef.current) return

            event.preventDefault()
            event.stopPropagation()
            addPoint(event, true)

            const nextArea = simplifyDrawArea(pointsRef.current)
            stopDrawing()

            if (nextArea.length >= 3) {
                onCommit(nextArea)
            }
        }

        const handlePointerDown = (event: PointerEvent) => {
            if (event.pointerType === 'mouse' && event.button !== 0) return

            event.preventDefault()
            event.stopPropagation()
            container.setPointerCapture?.(event.pointerId)
            drawingRef.current = true
            pointsRef.current = []
            lastPointRef.current = null
            addPoint(event, true)
        }

        const handlePointerMove = (event: PointerEvent) => {
            if (!drawingRef.current) return

            event.preventDefault()
            event.stopPropagation()
            addPoint(event)
        }

        const handlePointerUp = (event: PointerEvent) => {
            if (!drawingRef.current) return

            commitDrawing(event)
            container.releasePointerCapture?.(event.pointerId)
        }

        const handlePointerCancel = (event: PointerEvent) => {
            if (!drawingRef.current) return

            event.preventDefault()
            event.stopPropagation()
            stopDrawing()
        }

        container.addEventListener('pointerdown', handlePointerDown, true)
        container.addEventListener('pointermove', handlePointerMove, true)
        container.addEventListener('pointerup', handlePointerUp, true)
        container.addEventListener('pointercancel', handlePointerCancel, true)

        return () => {
            container.removeEventListener('pointerdown', handlePointerDown, true)
            container.removeEventListener('pointermove', handlePointerMove, true)
            container.removeEventListener('pointerup', handlePointerUp, true)
            container.removeEventListener('pointercancel', handlePointerCancel, true)
            container.style.cursor = previousCursor
            container.style.touchAction = previousTouchAction
            resetDrawingRefs()
        }
    }, [enabled, map, onCommit])

    return (
        <>
            {area && area.length >= 3 && (
                <Polygon
                    positions={area}
                    pathOptions={DRAW_AREA_POLYGON_OPTIONS}
                    interactive={false}
                />
            )}
            {enabled && draftArea.length > 1 && (
                <Polyline
                    positions={draftArea}
                    pathOptions={DRAW_AREA_DRAFT_OPTIONS}
                    interactive={false}
                />
            )}
        </>
    )
}

function FocusAreaLayer({
    drawArea,
    regionArea,
}: {
    drawArea?: MapDrawArea | null
    regionArea?: MapRegionArea | null
}) {
    const activeArea = drawArea && drawArea.length >= 3
        ? drawArea
        : regionArea?.area && regionArea.area.length >= 3
            ? regionArea.area
            : null
    const shouldShowRegionBoundary = Boolean(!drawArea && regionArea?.area && regionArea.area.length >= 3)
    const maskPositions = useMemo(
        () => activeArea ? [REGION_MASK_OUTER_RING, activeArea] : null,
        [activeArea]
    )

    return (
        <>
            {maskPositions && (
                <Polygon
                    positions={maskPositions}
                    pathOptions={REGION_AREA_MASK_OPTIONS}
                    interactive={false}
                />
            )}
            {shouldShowRegionBoundary && regionArea?.area && (
                <>
                    <Polygon
                        positions={regionArea.area}
                        pathOptions={REGION_AREA_HALO_OPTIONS}
                        interactive={false}
                    />
                    <Polygon
                        positions={regionArea.area}
                        pathOptions={REGION_AREA_POLYGON_OPTIONS}
                        interactive={false}
                    />
                </>
            )}
        </>
    )
}

function NearbyAmenitiesLayer({ activeLayers }: { activeLayers: MapAmenityLayer[] }) {
    const map = useMap()
    const [places, setPlaces] = useState<NearbyAmenityPlace[]>([])
    const activeLayerSet = useMemo(() => new Set(activeLayers), [activeLayers])
    const visiblePlaces = useMemo(
        () => places.filter(place => activeLayerSet.has(place.layer)),
        [activeLayerSet, places]
    )
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    useEffect(() => {
        if (!activeLayers.length) {
            return
        }

        if (!apiKey) {
            console.warn('[PropertyMap] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ausente para filtros de entorno.')
            return
        }

        let cancelled = false
        let requestTimer: number | null = null

        const loadAmenities = async () => {
            const googleWindow = getGooglePlacesWindow()

            try {
                await loadGooglePlacesLibrary(apiKey)
                if (cancelled) return

                const googleMaps = googleWindow?.google?.maps
                if (!googleMaps?.places?.Place) {
                    setPlaces([])
                    return
                }

                const center = map.getCenter()
                const bounds = map.getBounds()
                const radius = Math.round(Math.max(900, Math.min(5200, map.distance(center, bounds.getNorthEast()) * 0.55)))

                const resultsByLayer = await Promise.all(activeLayers.map(async layer => {
                    const option = getAmenityOption(layer)
                    if (!option) return []

                    const results = await searchAmenityPlaces(googleMaps, layer, center, radius)

                    return results
                        .map((result): NearbyAmenityPlace | null => {
                            const latLng = getPlaceLatLng(result)
                            if (!latLng) return null

                            const [lat, lng] = latLng
                            const distanceMeters = map.distance(center, L.latLng(lat, lng))
                            if (distanceMeters > radius * 1.75) return null

                            const place: NearbyAmenityPlace = {
                                id: String(result.id || result.place_id || `${layer}-${lat.toFixed(6)}-${lng.toFixed(6)}`),
                                layer,
                                name: getPlaceDisplayName(result, option.searchLabel),
                                latLng: [lat, lng],
                                distanceMeters,
                            }

                            const vicinity = getPlaceVicinity(result)
                            if (vicinity) place.vicinity = vicinity
                            return place
                        })
                        .filter((item): item is NearbyAmenityPlace => item !== null)
                        .sort((a, b) => a.distanceMeters - b.distanceMeters)
                        .slice(0, 8)
                }))

                if (cancelled) return

                const uniquePlaces = new Map<string, NearbyAmenityPlace>()
                resultsByLayer.flat().forEach(place => {
                    const key = `${place.layer}:${place.id}`
                    if (!uniquePlaces.has(key)) uniquePlaces.set(key, place)
                })

                setPlaces(Array.from(uniquePlaces.values()))
            } catch (error) {
                if (cancelled) return
                console.warn('[PropertyMap] Não foi possível carregar benefícios do entorno:', error)
                setPlaces([])
            }
        }

        const scheduleLoad = () => {
            if (requestTimer) window.clearTimeout(requestTimer)
            requestTimer = window.setTimeout(loadAmenities, 650)
        }

        scheduleLoad()
        map.on('moveend', scheduleLoad)
        map.on('zoomend', scheduleLoad)

        return () => {
            cancelled = true
            if (requestTimer) window.clearTimeout(requestTimer)
            map.off('moveend', scheduleLoad)
            map.off('zoomend', scheduleLoad)
        }
    }, [activeLayers, apiKey, map])

    if (!activeLayers.length || visiblePlaces.length === 0) return null

    return (
        <>
            {visiblePlaces.map(place => {
                const option = getAmenityOption(place.layer)
                return (
                    <Marker
                        key={`${place.layer}-${place.id}`}
                        position={place.latLng}
                        icon={createAmenityIcon(place)}
                        zIndexOffset={650}
                    >
                        <Popup className="map-amenity-popup" minWidth={210} maxWidth={250}>
                            <div className="map-amenity-popup-content">
                                <span>{option?.searchLabel || 'Entorno'}</span>
                                <strong>{place.name}</strong>
                                {place.vicinity && <small>{place.vicinity}</small>}
                                <b>{formatDistance(place.distanceMeters)} do centro da busca</b>
                            </div>
                        </Popup>
                    </Marker>
                )
            })}
        </>
    )
}

function buildClusters(items: MappedProperty[], map: L.Map, zoom: number, overviewMode = false): ClusterItem[] {
    if (zoom >= 14 || (overviewMode && items.length <= 450) || (zoom < 13 && items.length <= 220)) {
        return items.map(item => ({ kind: 'single', item }))
    }

    const gridSize = zoom < 11 ? 58 : zoom < 13 ? 68 : 74
    const grouped = new Map<string, MappedProperty[]>()

    items.forEach(item => {
        const point = map.project(L.latLng(item.latLng), zoom)
        const key = `${Math.floor(point.x / gridSize)}:${Math.floor(point.y / gridSize)}`
        const group = grouped.get(key)
        if (group) {
            group.push(item)
        } else {
            grouped.set(key, [item])
        }
    })

    return Array.from(grouped.entries()).map(([id, group]) => {
        if (group.length === 1) return { kind: 'single', item: group[0] }

        const lat = group.reduce((sum, item) => sum + item.latLng[0], 0) / group.length
        const lng = group.reduce((sum, item) => sum + item.latLng[1], 0) / group.length
        const prices = group.map(item => Number(item.property.price || 0)).filter(price => price > 0)

        return {
            kind: 'cluster',
            id,
            items: group,
            latLng: [lat, lng],
            minPrice: prices.length ? Math.min(...prices) : null,
        }
    })
}

function createClusterIcon(count: number, minPrice: number | null, zoom: number, overviewMode = false) {
    const priceText = formatMapPrice(minPrice)

    if (overviewMode) {
        return L.divIcon({
            className: 'premium-cluster-marker',
            html: `<div class="cluster-dot-wrap cluster-dot-wrap--overview">
                <span class="cluster-dot cluster-dot--overview" aria-hidden="true"></span>
            </div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
        })
    }

    if (zoom < 13) {
        return L.divIcon({
            className: 'premium-cluster-marker',
            html: `<div class="cluster-dot-wrap">
                <span class="cluster-dot">${count > 1 ? count : ''}</span>
            </div>`,
            iconSize: [42, 42],
            iconAnchor: [21, 21],
        })
    }

    return L.divIcon({
        className: 'premium-cluster-marker',
        html: `<div class="cluster-orbit cluster-orbit--price">
            <span class="cluster-count">${count}</span>
            <span class="cluster-label">${priceText}</span>
        </div>`,
        iconSize: [98, 48],
        iconAnchor: [49, 42],
    })
}

type MarkerVisualState = {
    isHovered: boolean
    isSelected: boolean
    zoom: number
}

function ClusterLayer({
    items,
    hoveredPropertyId,
    selectedPropertyId,
    createIcon,
    onMarkerHover,
    onPropertySelect,
    overviewMode = false,
}: {
    items: MappedProperty[]
    hoveredPropertyId?: string | null
    selectedPropertyId?: string | null
    createIcon: (property: Property, markerState: MarkerVisualState) => L.DivIcon
    onMarkerHover?: (id: string | null) => void
    onPropertySelect?: (property: Property) => void
    overviewMode?: boolean
}) {
    const map = useMap()
    const [zoom, setZoom] = useState(map.getZoom())

    useEffect(() => {
        const updateZoom = () => setZoom(map.getZoom())
        map.on('zoomend', updateZoom)
        return () => {
            map.off('zoomend', updateZoom)
        }
    }, [map])

    const clusters = useMemo(() => buildClusters(items, map, zoom, overviewMode), [items, map, overviewMode, zoom])

    return (
        <>
            {clusters.map(cluster => {
                if (cluster.kind === 'cluster') {
                    return (
                        <Marker
                            key={`cluster-${cluster.id}`}
                            position={cluster.latLng}
                            icon={createClusterIcon(cluster.items.length, cluster.minPrice, zoom, overviewMode)}
                            zIndexOffset={400}
                            eventHandlers={{
                                click: () => {
                                    const bounds = L.latLngBounds(cluster.items.map(item => L.latLng(item.latLng)))
                                    map.flyToBounds(bounds, { padding: [82, 82], maxZoom: 15, duration: 0.75 })
                                },
                            }}
                        />
                    )
                }

                const { property, latLng } = cluster.item
                const isSelected = String(selectedPropertyId || '') === String(property.id)
                const isHovered = String(hoveredPropertyId || '') === String(property.id) || isSelected

                return (
                    <Marker
                        key={property.id}
                        position={latLng}
                        icon={createIcon(property, { isHovered, isSelected, zoom })}
                        zIndexOffset={isSelected ? 1400 : isHovered ? 1000 : 0}
                        eventHandlers={{
                            mouseover: (e: any) => {
                                if (!onPropertySelect) e.target.openPopup()
                                onMarkerHover?.(property.id)
                            },
                            mouseout: (e: any) => {
                                if (!onPropertySelect) e.target.closePopup()
                                onMarkerHover?.(null)
                            },
                            click: (e: any) => {
                                if (onPropertySelect) {
                                    map.closePopup()
                                    onPropertySelect(property)
                                } else {
                                    e.target.openPopup()
                                }
                                map.flyTo(latLng, Math.max(map.getZoom(), 15), { duration: 0.5 })
                            },
                        }}
                    >
                        {!onPropertySelect && (
                            <Popup className="property-popup">
                                <PropertyPopup property={property} />
                            </Popup>
                        )}
                    </Marker>
                )
            })}
        </>
    )
}

function PropertyPopup({ property }: { property: Property }) {
    const displayTitle = replaceItajaiWithPraiaBrava(property.title)
    const detailsHref = propertyDetailsPath(property)
    const displayKicker = replaceItajaiWithPraiaBrava(property.neighborhood || property.property_type || 'Seleção premium')

    return (
        <div className="popup-content">
            <div className="popup-img-wrapper">
                <img
                    src={property.featured_image || 'https://via.placeholder.com/300x200'}
                    alt={displayTitle}
                    className="popup-img"
                />
                {property.exclusive && <span className="popup-badge">Exclusivo</span>}
            </div>
            <div className="popup-info">
                <div className="popup-kicker">
                    {displayKicker}
                </div>
                <h3 className="popup-title">{displayTitle}</h3>
                <div className="popup-price">{formatFullPrice(property.price)}</div>
                <div className="popup-specs">
                    {property.bedrooms && <span><Bed size={12} /> {property.bedrooms}</span>}
                    {property.suites && <span>Suíte {property.suites}</span>}
                    {property.bathrooms && <span><Bath size={12} /> {property.bathrooms}</span>}
                    {property.area_m2 && <span><Maximize size={12} /> {property.area_m2}m²</span>}
                </div>
                <Link
                    href={detailsHref}
                    className="popup-link"
                    onClick={() => {
                        void trackEvent('property_map_popup_opened', {
                            property_id: property.id,
                            title: displayTitle,
                            price: property.price,
                            neighborhood: property.neighborhood,
                            property_type: property.property_type,
                            destination: detailsHref,
                        })
                    }}
                >
                    Ver detalhes
                </Link>
            </div>
        </div>
    )
}

function AgencyLocationPopup({ officeMarker }: { officeMarker: OfficeMarker }) {
    return (
        <article className="agency-location-card">
            <div className="agency-location-card-media">
                <img
                    src={AGENCY_CARD_IMAGE_URL}
                    alt={officeMarker.title}
                    className="agency-location-card-img"
                    loading="lazy"
                />
            </div>
            <div className="agency-location-card-info">
                <div className="agency-location-card-kicker">Localiza&ccedil;&atilde;o da imobili&aacute;ria</div>
                <h3>{officeMarker.title}</h3>
                <p>{officeMarker.address}</p>
            </div>
        </article>
    )
}

export default function PropertyMap({
    properties,
    hoveredPropertyId,
    selectedPropertyId,
    drawArea,
    regionArea,
    onMarkerHover,
    onPropertySelect,
    onDrawAreaChange,
    onBoundsChange,
    onUserBoundsChange,
    refitKey,
    interactionEnabled = true,
    officeMarker = null,
    initialMapStyle = 'luxury',
    overviewMode = false,
    fixedOverviewView = null,
}: PropertyMapProps) {
    const [mapStyle, setMapStyle] = useState<MapStyle>(initialMapStyle)
    const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
    const [mobileControlsOpen, setMobileControlsOpen] = useState(false)
    const [drawModeEnabled, setDrawModeEnabled] = useState(false)
    const [mapOptionsOpen, setMapOptionsOpen] = useState(false)
    const [activeContextLayers, setActiveContextLayers] = useState<MapContextLayer[]>([])
    const [activeAmenityLayers, setActiveAmenityLayers] = useState<MapAmenityLayer[]>([])
    const [locateRequestId, setLocateRequestId] = useState(0)
    const [locateState, setLocateState] = useState<LocateState>('idle')
    const [userMapLocation, setUserMapLocation] = useState<UserMapLocation | null>(null)
    const [showControlHints, setShowControlHints] = useState(false)
    const controlHintTimerRef = useRef<number | null>(null)
    const [quickFilterMenuOpen, setQuickFilterMenuOpen] = useState(false)

    const validProperties = useMemo<MappedProperty[]>(
        () => properties
            .map(property => ({ property, latLng: getPropertyLatLng(property) }))
            .filter((item): item is MappedProperty => Boolean(item.latLng)),
        [properties]
    )

    const filteredProperties = useMemo(
        () => validProperties.filter(item => matchesQuickFilter(item, quickFilter)),
        [validProperties, quickFilter]
    )
    const focusAreaPoints = useMemo(() => {
        if (drawArea && drawArea.length >= 3) return drawArea
        if (regionArea?.area && regionArea.area.length >= 3) return regionArea.area
        return []
    }, [drawArea, regionArea])
    const mapPoints = useMemo(() => {
        const points = filteredProperties.map(item => item.latLng)
        if (focusAreaPoints.length) return focusAreaPoints
        return officeMarker ? [officeMarker.latLng, ...points] : points
    }, [filteredProperties, focusAreaPoints, officeMarker])
    const defaultCenter: [number, number] = [-26.9446, -48.6292]
    const initialMapIsMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
    const initialMapCenter = overviewMode && fixedOverviewView
        ? initialMapIsMobile && fixedOverviewView.mobileCenter
            ? fixedOverviewView.mobileCenter
            : fixedOverviewView.center
        : defaultCenter
    const initialMapZoom = overviewMode && fixedOverviewView
        ? initialMapIsMobile && typeof fixedOverviewView.mobileZoom === 'number'
            ? fixedOverviewView.mobileZoom
            : fixedOverviewView.zoom
        : 14
    const mapWatermarkLabel = filteredProperties.length > 0
        ? `${filteredProperties.length} no mapa`
        : officeMarker
            ? officeMarker.title
            : '0 no mapa'
    const hasDrawArea = Boolean(drawArea && drawArea.length >= 3)
    const hasRegionArea = Boolean(regionArea?.area && regionArea.area.length >= 3)

    const handleQuickFilterChange = (filter: QuickFilter) => {
        const option = QUICK_FILTERS.find(item => item.value === filter)
        setQuickFilter(filter)
        void trackEvent('property_map_quick_filter_clicked', {
            filter,
            filter_label: option?.label || filter,
            results_count: validProperties.filter(item => matchesQuickFilter(item, filter)).length,
            total_count: validProperties.length,
        })
    }

    const handleQuickFilterSelect = (filter: QuickFilter) => {
        handleQuickFilterChange(filter)
        setQuickFilterMenuOpen(false)
        setMobileControlsOpen(false)
    }

    const handleMapStyleChange = (style: MapStyle) => {
        const option = MAP_STYLES.find(item => item.value === style)
        setMapStyle(style)
        setMapOptionsOpen(false)
        void trackEvent('property_map_style_changed', {
            style,
            style_label: option?.label || style,
        })
    }

    const handleDrawModeToggle = () => {
        const nextEnabled = !drawModeEnabled
        setDrawModeEnabled(nextEnabled)
        setMobileControlsOpen(false)

        void trackEvent('property_map_draw_mode_toggled', {
            enabled: nextEnabled,
            has_draw_area: hasDrawArea,
        })
    }

    const handleContextLayerToggle = (layer: MapContextLayer) => {
        setActiveContextLayers(current => {
            const isActive = current.includes(layer)
            const next = isActive
                ? current.filter(item => item !== layer)
                : [...current, layer]

            void trackEvent('property_map_context_layer_toggled', {
                layer,
                enabled: !isActive,
                active_layers: next,
            })

            return next
        })
    }

    const handleAmenityLayerToggle = (layer: MapAmenityLayer) => {
        setActiveAmenityLayers(current => {
            const isActive = current.includes(layer)
            const next = isActive
                ? current.filter(item => item !== layer)
                : [...current, layer]
            const option = getAmenityOption(layer)

            void trackEvent('property_map_amenity_layer_toggled', {
                layer,
                layer_label: option?.label || layer,
                enabled: !isActive,
                active_layers: next,
            })

            return next
        })
    }

    const handleLocateButtonClick = () => {
        setMapOptionsOpen(false)
        setMobileControlsOpen(false)
        setLocateRequestId(value => value + 1)
        void trackEvent('property_map_user_location_clicked', {
            has_draw_area: hasDrawArea,
            map_style: mapStyle,
        })
    }

    const handleUserLocated = useCallback((location: UserMapLocation) => {
        setUserMapLocation(location)
        window.setTimeout(() => {
            setLocateState(current => current === 'active' ? 'idle' : current)
        }, 2200)

        void saveMapLocationSignal({
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
        })

        void trackEvent('property_map_user_location_applied', {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy || null,
            bounds: location.bounds,
        })
    }, [])

    const handleDrawAreaCommit = useCallback((area: MapDrawArea) => {
        setDrawModeEnabled(false)
        onDrawAreaChange?.(area)
    }, [onDrawAreaChange])

    const handleDrawAreaClear = () => {
        setDrawModeEnabled(false)
        onDrawAreaChange?.(null)

        void trackEvent('property_map_draw_area_cleared_from_map', {
            had_draw_area: hasDrawArea,
        })
    }

    const createIcon = useCallback((property: Property, markerState: MarkerVisualState) => {
        const { isHovered, isSelected, zoom } = markerState
        const priceText = escapeHtml(formatMapPrice(property.price))
        const badgeClass = property.exclusive ? ' marker-wrap--exclusive' : ''
        const stateClass = isSelected ? ' marker-wrap--selected' : isHovered ? ' marker-wrap--active' : ''
        const overviewClass = overviewMode ? ' marker-wrap--overview' : ''
        const shouldUseDot = overviewMode || (zoom < 13 && !isHovered)

        return L.divIcon({
            className: 'custom-price-marker',
            html: `<div class="marker-wrap ${shouldUseDot ? 'marker-wrap--dot' : 'marker-wrap--bubble'}${stateClass}${badgeClass}${overviewClass}">
                ${shouldUseDot
                    ? '<span class="marker-dot" aria-hidden="true"></span>'
                    : `<span class="marker-price">${priceText}</span>`}
            </div>`,
            iconSize: overviewMode ? [24, 24] : shouldUseDot ? [34, 34] : [88, 48],
            iconAnchor: overviewMode ? [12, 12] : shouldUseDot ? [17, 17] : [44, 42],
        })
    }, [overviewMode])

    const officeIcon = useMemo(() => {
        if (!officeMarker) return null

        const subtitle = officeMarker.subtitle || 'Imobiliária'

        return L.divIcon({
            className: 'agency-location-marker',
            html: `<div class="agency-marker-wrap">
                <span class="agency-marker-pin">
                    <img src="${AGENCY_MARKER_ICON_URL}" alt="" loading="lazy" draggable="false" />
                </span>
                <strong>${escapeHtml(officeMarker.title)}</strong>
                <small>${escapeHtml(subtitle)}</small>
            </div>`,
            iconSize: [210, 118],
            iconAnchor: [105, 96],
            popupAnchor: [0, -84],
        })
    }, [officeMarker])

    const showControlHintsTemporarily = useCallback(() => {
        setShowControlHints(true)

        if (controlHintTimerRef.current) {
            window.clearTimeout(controlHintTimerRef.current)
        }

        controlHintTimerRef.current = window.setTimeout(() => {
            setShowControlHints(false)
            controlHintTimerRef.current = null
        }, 5200)
    }, [])

    useEffect(() => {
        if (officeMarker) return

        let alreadySeen = false
        try {
            alreadySeen = window.localStorage.getItem(MAP_CONTROL_HINT_STORAGE_KEY) === 'true'
        } catch {
            alreadySeen = false
        }

        if (alreadySeen) return

        const hintTimer = window.setTimeout(showControlHintsTemporarily, 260)

        try {
            window.localStorage.setItem(MAP_CONTROL_HINT_STORAGE_KEY, 'true')
        } catch {
            // localStorage may be unavailable in restricted browser contexts.
        }

        return () => window.clearTimeout(hintTimer)
    }, [officeMarker, showControlHintsTemporarily])

    useEffect(() => {
        return () => {
            if (controlHintTimerRef.current) {
                window.clearTimeout(controlHintTimerRef.current)
            }
        }
    }, [])

    const activeLayerCount = activeContextLayers.length + activeAmenityLayers.length
    const shouldShowControlHints = showControlHints && !officeMarker

    return (
        <div className={`map-shell map-style-${mapStyle}${mobileControlsOpen ? ' map-mobile-filters-open' : ''}${mapOptionsOpen ? ' map-options-open' : ''}${drawModeEnabled ? ' map-shell--drawing' : ''}${hasDrawArea ? ' map-shell--has-draw-area' : ''}${hasRegionArea ? ' map-shell--has-region-area' : ''}${activeContextLayers.length ? ' map-shell--has-context-layers' : ''}${activeAmenityLayers.length ? ' map-shell--has-amenities' : ''}${shouldShowControlHints ? ' map-shell--control-hints' : ''}`}>
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossOrigin="" />

            <div className={`map-topbar${quickFilterMenuOpen ? ' is-open' : ''}`}>
                <button
                    type="button"
                    className={`map-quick-filter-trigger${quickFilter !== 'all' ? ' active' : ''}`}
                    aria-expanded={quickFilterMenuOpen}
                    aria-haspopup="menu"
                    onClick={() => setQuickFilterMenuOpen(isOpen => !isOpen)}
                >
                    <SlidersHorizontal size={15} />
                    <span>Mais filtros</span>
                </button>
                {quickFilterMenuOpen && (
                    <div className="map-quick-filter-menu" role="menu" aria-label="Filtros rápidos do mapa">
                        {QUICK_FILTERS.map(filter => (
                            <button
                                key={filter.value}
                                type="button"
                                role="menuitemradio"
                                aria-checked={quickFilter === filter.value}
                                className={quickFilter === filter.value ? 'active' : ''}
                                onClick={() => handleQuickFilterSelect(filter.value)}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="map-mobile-style-stack" role="group" aria-label="Estilo do mapa">
                <div className="map-mobile-style-grid">
                    {MAP_STYLES.map(style => (
                        <button
                            key={style.value}
                            type="button"
                            className={mapStyle === style.value ? 'active' : ''}
                            aria-label={`Mapa ${style.label}`}
                            onClick={() => handleMapStyleChange(style.value)}
                        >
                            {getStyleIcon(style.icon)}
                            <span>{style.label}</span>
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    className={`map-mobile-more-filter-button${mobileControlsOpen ? ' active' : ''}`}
                    aria-label="Mais filtros"
                    aria-expanded={mobileControlsOpen}
                    onClick={() => setMobileControlsOpen(isOpen => !isOpen)}
                >
                    <SlidersHorizontal size={14} />
                    <span>Mais filtros</span>
                </button>
            </div>

            <div className={`map-mobile-filter-panel${mobileControlsOpen ? ' is-open' : ''}`} role="group" aria-label="Mais filtros do mapa">
                <div className="map-mobile-filter-grid">
                    {QUICK_FILTERS.map(filter => (
                        <button
                            key={filter.value}
                            type="button"
                            className={quickFilter === filter.value ? 'active' : ''}
                            onClick={() => handleQuickFilterSelect(filter.value)}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="map-watermark">
                <Building2 size={14} />
                <span>{mapWatermarkLabel}</span>
            </div>

            {regionArea && !officeMarker && (
                <div className="map-region-chip">
                    <MapPin size={13} />
                    <span>{regionArea.label}</span>
                </div>
            )}

            {hasDrawArea && onDrawAreaChange && !officeMarker && (
                <div className="map-draw-control" role="group" aria-label="Desenho de área no mapa">
                    <button
                        type="button"
                        aria-label="Limpar área desenhada"
                        onClick={handleDrawAreaClear}
                    >
                        <Eraser size={14} />
                        <span>Limpar área</span>
                    </button>
                </div>
            )}

            <div className="map-mobile-action-dock" role="group" aria-label="Controles do mapa" onPointerDown={showControlHintsTemporarily}>
                <button
                    type="button"
                    className={`${mapOptionsOpen ? 'active' : ''}${activeLayerCount > 0 ? ' has-active-layers' : ''}`}
                    aria-label="Abrir opções do mapa"
                    aria-expanded={mapOptionsOpen}
                    title="Opções do mapa"
                    onClick={() => setMapOptionsOpen(open => !open)}
                >
                    <Globe2 size={24} />
                    {activeLayerCount > 0 && (
                        <strong className="map-mobile-action-count" aria-label={`${activeLayerCount} filtros ativos`}>
                            {activeLayerCount}
                        </strong>
                    )}
                    <span>Mapa</span>
                </button>
                {onDrawAreaChange && !officeMarker && (
                    <button
                        type="button"
                        className={drawModeEnabled ? 'active' : ''}
                        aria-label={drawModeEnabled ? 'Cancelar desenho no mapa' : 'Desenhar no mapa'}
                        aria-pressed={drawModeEnabled}
                        title={drawModeEnabled ? 'Cancelar desenho' : 'Desenhar área'}
                        onClick={handleDrawModeToggle}
                    >
                        <Hand size={24} />
                        <span>{drawModeEnabled ? 'Cancelar' : 'Desenhar'}</span>
                    </button>
                )}
                {!officeMarker && (
                    <button
                        type="button"
                        className={locateState === 'active' ? 'active' : locateState === 'loading' ? 'loading' : ''}
                        aria-label="Buscar imóveis na minha localização"
                        title="Perto de mim"
                        onClick={handleLocateButtonClick}
                    >
                        <LocateFixed size={24} />
                        <span>{locateState === 'loading' ? 'Buscando' : 'Perto de mim'}</span>
                    </button>
                )}
            </div>

            {mapOptionsOpen && (
                <div className="map-options-scrim" role="presentation" onClick={() => setMapOptionsOpen(false)}>
                    <section className="map-options-sheet" role="dialog" aria-modal="true" aria-label="Opções do mapa" onClick={event => event.stopPropagation()}>
                        <header>
                            <h2>Opções do mapa</h2>
                            <button type="button" aria-label="Fechar opções do mapa" onClick={() => setMapOptionsOpen(false)}>
                                <X size={25} />
                            </button>
                        </header>
                        <div className="map-options-style-row" role="group" aria-label="Visualização do mapa">
                            {MAP_OPTION_STYLES.map(style => (
                                <button
                                    key={style.value}
                                    type="button"
                                    className={mapStyle === style.value ? 'active' : ''}
                                    aria-pressed={mapStyle === style.value}
                                    onClick={() => handleMapStyleChange(style.value)}
                                >
                                    {getMapOptionIcon(style.icon)}
                                    <span>{style.label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="map-options-divider" />
                        <div className="map-options-section">
                            <h3>Riscos e entorno</h3>
                            <div className="map-context-grid" role="group" aria-label="Camadas de risco e entorno">
                                {MAP_CONTEXT_LAYERS.map(layer => (
                                    <button
                                        key={layer.value}
                                        type="button"
                                        className={activeContextLayers.includes(layer.value) ? 'active' : ''}
                                        aria-pressed={activeContextLayers.includes(layer.value)}
                                        onClick={() => handleContextLayerToggle(layer.value)}
                                    >
                                        {getContextLayerIcon(layer.icon)}
                                        <span>{layer.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="map-options-section">
                            <h3>Benefícios próximos</h3>
                            <div className="map-amenity-grid" role="group" aria-label="Benefícios próximos no mapa">
                                {MAP_AMENITY_LAYERS.map(layer => {
                                    const Icon = MAP_AMENITY_ICONS[layer.value] || MapPin
                                    return (
                                        <button
                                            key={layer.value}
                                            type="button"
                                            className={activeAmenityLayers.includes(layer.value) ? 'active' : ''}
                                            aria-pressed={activeAmenityLayers.includes(layer.value)}
                                            onClick={() => handleAmenityLayerToggle(layer.value)}
                                        >
                                            <Icon size={17} />
                                            <span>{layer.label}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                        <div className="map-options-section">
                            <h3>Filtros rapidos</h3>
                            <div className="map-options-filter-grid" role="group" aria-label="Filtros rapidos do mapa">
                                {QUICK_FILTERS.map(filter => (
                                    <button
                                        key={filter.value}
                                        type="button"
                                        className={quickFilter === filter.value ? 'active' : ''}
                                        onClick={() => handleQuickFilterChange(filter.value)}
                                    >
                                        {filter.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>
                </div>
            )}

            <style>{`
                .map-shell {
                    position: absolute;
                    inset: 0;
                    overflow: hidden;
                    background: #111;
                }
                .map-shell::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    z-index: 401;
                    pointer-events: none;
                    box-shadow: inset 0 0 120px rgba(5, 8, 10, 0.22);
                    mix-blend-mode: multiply;
                }
                .map-style-luxury .leaflet-tile-pane {
                    filter: saturate(1.06) contrast(1.02) brightness(1.01);
                }
                .map-style-classic .leaflet-tile-pane {
                    filter: saturate(1.02) contrast(1.01);
                }
                .map-style-satellite .leaflet-tile-pane {
                    filter: saturate(1.08) contrast(1.04) brightness(0.94);
                }
                .leaflet-control-zoom {
                    border: none !important;
                    border-radius: 12px !important;
                    overflow: hidden;
                    box-shadow: 0 10px 28px rgba(0,0,0,0.26) !important;
                }
                .leaflet-control-zoom a {
                    width: 38px !important;
                    height: 38px !important;
                    line-height: 38px !important;
                    border: none !important;
                    border-bottom: 1px solid rgba(255,255,255,0.08) !important;
                    background: rgba(20,20,20,0.92) !important;
                    color: #e8dcc7 !important;
                    font-size: 18px !important;
                    backdrop-filter: blur(16px);
                }
                .leaflet-control-zoom a:hover {
                    background: #c9a96e !important;
                    color: #111 !important;
                }
                .leaflet-control-attribution {
                    background: rgba(12,12,12,0.58) !important;
                    color: rgba(255,255,255,0.48) !important;
                    font-size: 9px !important;
                }
                .leaflet-control-attribution a { color: rgba(255,255,255,0.66) !important; }

                .map-topbar {
                    position: absolute;
                    top: 14px;
                    left: 58px;
                    z-index: 920;
                    display: grid;
                    gap: 8px;
                    justify-items: start;
                }
                .map-quick-filter-trigger {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 7px;
                    height: 34px;
                    padding: 0 13px;
                    border: 1px solid rgba(232,220,199,0.14);
                    background: rgba(18, 18, 18, 0.76);
                    color: #e8dcc7;
                    border-radius: 999px;
                    cursor: pointer;
                    font: 900 0.72rem/1 'Inter', sans-serif;
                    white-space: nowrap;
                    backdrop-filter: blur(16px);
                    box-shadow: 0 10px 24px rgba(0,0,0,0.18);
                    transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
                }
                .map-quick-filter-trigger:hover {
                    transform: translateY(-1px);
                }
                .map-quick-filter-trigger.active,
                .map-topbar.is-open .map-quick-filter-trigger {
                    background: linear-gradient(135deg, #dfc18e, #b8945f);
                    color: #101010;
                    border-color: rgba(255,255,255,0.28);
                }
                .map-quick-filter-trigger svg {
                    width: 14px;
                    height: 14px;
                }
                .map-quick-filter-menu {
                    display: grid;
                    gap: 5px;
                    min-width: 172px;
                    padding: 7px;
                    border: 1px solid rgba(184,148,95,0.26);
                    border-radius: 12px;
                    background: rgba(247,244,239,0.94);
                    box-shadow: 0 18px 38px rgba(0,0,0,0.22);
                    backdrop-filter: blur(18px);
                }
                .map-quick-filter-menu button {
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                    min-height: 31px;
                    padding: 0 9px;
                    border: 1px solid rgba(184,148,95,0.18);
                    border-radius: 8px;
                    background: rgba(255,255,255,0.74);
                    color: #3c362e;
                    cursor: pointer;
                    font: 900 0.67rem/1 'Inter', sans-serif;
                    text-align: left;
                    white-space: nowrap;
                    transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
                }
                .map-quick-filter-menu button:hover {
                    transform: translateX(1px);
                    background: rgba(255,255,255,0.92);
                }
                .map-quick-filter-menu button.active {
                    background: linear-gradient(135deg, #dfc18e, #b8945f);
                    color: #101010;
                    border-color: rgba(255,255,255,0.28);
                }
                .map-mobile-style-stack,
                .map-mobile-filter-panel {
                    display: none;
                }
                .map-mobile-style-stack {
                    position: absolute;
                    top: 12px;
                    left: 12px;
                    right: 12px;
                    z-index: 900;
                    width: auto;
                    display: none;
                    align-items: center;
                    gap: 5px;
                    justify-content: center;
                    overflow-x: auto;
                    padding-bottom: 3px;
                    scrollbar-width: none;
                }
                .map-mobile-style-stack::-webkit-scrollbar {
                    display: none;
                }
                .map-shell:has(.leaflet-popup-pane .leaflet-popup) .map-mobile-style-stack,
                .map-shell:has(.leaflet-popup-pane .leaflet-popup) .map-mobile-filter-panel {
                    opacity: 0;
                    pointer-events: none;
                    transform: translateY(-6px);
                }
                .map-mobile-style-grid {
                    display: flex;
                    gap: 5px;
                    flex: 0 0 auto;
                }
                .map-mobile-style-grid button,
                .map-mobile-more-filter-button {
                    display: inline-flex;
                    align-items: center;
                    justify-content: flex-start;
                    gap: 4px;
                    min-width: 0;
                    height: 29px;
                    padding: 0 8px;
                    border: 1px solid rgba(184,148,95,0.22);
                    border-radius: 8px;
                    background: rgba(247,244,239,0.94);
                    color: #2f2a23;
                    cursor: pointer;
                    font: 900 0.56rem/1 'Inter', sans-serif;
                    white-space: nowrap;
                    box-shadow: 0 8px 18px rgba(0,0,0,0.14);
                    backdrop-filter: blur(16px);
                }
                .map-mobile-style-grid button svg,
                .map-mobile-more-filter-button svg {
                    width: 13px;
                    height: 13px;
                }
                .map-mobile-style-grid button.active,
                .map-mobile-more-filter-button.active {
                    background: linear-gradient(135deg, #dfc18e, #b8945f);
                    color: #101010;
                    border-color: rgba(255,255,255,0.28);
                }
                .map-mobile-more-filter-button {
                    width: auto;
                }
                .map-mobile-filter-panel {
                    position: absolute;
                    top: 47px;
                    right: 12px;
                    z-index: 900;
                    width: min(220px, calc(100% - 24px));
                    padding: 7px;
                    border: 1px solid rgba(184,148,95,0.26);
                    border-radius: 12px;
                    background: rgba(247,244,239,0.94);
                    box-shadow: 0 18px 38px rgba(0,0,0,0.22);
                    backdrop-filter: blur(18px);
                }
                .map-mobile-filter-grid {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                    justify-content: center;
                }
                .map-mobile-filter-grid button {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 0;
                    min-height: 29px;
                    padding: 0 6px;
                    border: 1px solid rgba(184,148,95,0.22);
                    border-radius: 8px;
                    background: rgba(255,255,255,0.72);
                    color: #3c362e;
                    cursor: pointer;
                    font: 900 0.56rem/1 'Inter', sans-serif;
                    text-align: center;
                    white-space: nowrap;
                }
                .map-mobile-filter-grid button.active {
                    background: linear-gradient(135deg, #dfc18e, #b8945f);
                    color: #101010;
                    border-color: rgba(255,255,255,0.28);
                }
                .map-watermark {
                    position: absolute;
                    left: 10px;
                    bottom: 10px;
                    z-index: 600;
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    height: 24px;
                    padding: 0 8px;
                    border: 1px solid rgba(232,220,199,0.1);
                    border-radius: 999px;
                    background: rgba(18,18,18,0.54);
                    color: #e8dcc7;
                    font: 800 0.56rem/1 'Inter', sans-serif;
                    opacity: 0.74;
                    backdrop-filter: blur(16px);
                    box-shadow: 0 8px 18px rgba(0,0,0,0.12);
                }
                .map-watermark svg {
                    height: 10px;
                    width: 10px;
                }
                .map-region-chip {
                    position: absolute;
                    left: 14px;
                    top: 102px;
                    z-index: 920;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    max-width: min(220px, calc(100% - 28px));
                    min-height: 32px;
                    padding: 0 11px;
                    border: 1px solid rgba(255,255,255,0.24);
                    border-radius: 999px;
                    background: rgba(8,14,28,0.78);
                    color: #f4efe7;
                    font: 900 0.66rem/1 'Inter', sans-serif;
                    box-shadow:
                        0 14px 28px rgba(0,0,0,0.26),
                        0 0 0 1px rgba(47,123,255,0.14) inset;
                    backdrop-filter: blur(16px);
                    pointer-events: none;
                }
                .map-region-chip svg {
                    color: #78a7ff;
                    flex: 0 0 auto;
                }
                .map-region-chip span {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .map-draw-control {
                    position: absolute;
                    left: 14px;
                    top: 58px;
                    z-index: 920;
                    display: flex;
                    flex-direction: column;
                    gap: 7px;
                    align-items: flex-start;
                }
                .map-draw-control button {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 7px;
                    height: 36px;
                    min-width: 106px;
                    padding: 0 12px;
                    border: 1px solid rgba(232,220,199,0.16);
                    border-radius: 10px;
                    background: rgba(18,18,18,0.78);
                    color: #e8dcc7;
                    cursor: pointer;
                    font: 900 0.68rem/1 'Inter', sans-serif;
                    box-shadow: 0 10px 24px rgba(0,0,0,0.2);
                    white-space: nowrap;
                    backdrop-filter: blur(16px);
                    transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
                }
                .map-draw-control button:hover {
                    transform: translateY(-1px);
                }
                .map-draw-control button.active,
                .map-shell--has-draw-area .map-draw-control button:first-child {
                    background: linear-gradient(135deg, #dfc18e, #b8945f);
                    border-color: rgba(255,255,255,0.3);
                    color: #101010;
                }
                .map-shell--drawing .leaflet-container {
                    cursor: crosshair !important;
                }
                .map-shell--drawing .leaflet-marker-pane,
                .map-shell--drawing .leaflet-popup-pane {
                    pointer-events: none;
                }
                .map-shell--drawing .map-topbar,
                .map-shell--drawing .map-mobile-style-stack,
                .map-shell--drawing .map-mobile-filter-panel {
                    opacity: 0.24;
                    pointer-events: none;
                    transform: translateY(-2px);
                }
                .map-mobile-action-dock {
                    position: absolute;
                    right: 14px;
                    top: 58px;
                    z-index: 1300;
                    display: flex;
                    align-items: center;
                    gap: 9px;
                    pointer-events: auto;
                }
                .map-mobile-action-dock button {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 42px;
                    height: 42px;
                    border: 1px solid rgba(18,24,30,0.08);
                    border-radius: 999px;
                    background: rgba(255,255,255,0.94);
                    color: #171a1d;
                    cursor: pointer;
                    box-shadow: 0 12px 26px rgba(18,24,30,0.18);
                    backdrop-filter: blur(14px);
                    -webkit-backdrop-filter: blur(14px);
                    transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
                }
                .map-mobile-action-dock button:hover {
                    transform: translateY(-1px);
                }
                .map-mobile-action-dock button svg {
                    width: 17px;
                    height: 17px;
                }
                .map-mobile-action-dock button span {
                    position: absolute;
                    left: 50%;
                    bottom: calc(100% + 8px);
                    width: max-content;
                    max-width: 112px;
                    height: auto;
                    overflow: visible;
                    clip: auto;
                    border: 1px solid rgba(255,255,255,0.16);
                    border-radius: 999px;
                    background: rgba(23,20,16,0.9);
                    box-shadow: 0 10px 24px rgba(18,24,30,0.22);
                    color: #fff8ea;
                    font: 900 0.56rem/1 'Inter', sans-serif;
                    opacity: 0;
                    padding: 6px 8px;
                    pointer-events: none;
                    text-align: center;
                    transform: translate(-50%, 6px);
                    transition: opacity 0.18s ease, transform 0.18s ease;
                    white-space: nowrap;
                    z-index: 1;
                }
                .map-shell--control-hints .map-mobile-action-dock button span,
                .map-mobile-action-dock button:hover span,
                .map-mobile-action-dock button:focus-visible span,
                .map-mobile-action-dock button.active span {
                    opacity: 1;
                    transform: translate(-50%, 0);
                }
                .map-mobile-action-dock button.has-active-layers {
                    border-color: rgba(184,148,95,0.48);
                    box-shadow:
                        0 12px 26px rgba(18,24,30,0.18),
                        0 0 0 3px rgba(184,148,95,0.16);
                }
                .map-mobile-action-dock button.active {
                    background: linear-gradient(135deg, #dfc18e, #b8945f);
                    color: #101010;
                    box-shadow: 0 14px 28px rgba(184,148,95,0.28);
                }
                .map-mobile-action-dock button.loading svg {
                    animation: mapLocateSpin 1s linear infinite;
                }
                .map-mobile-action-count {
                    position: absolute;
                    top: -5px;
                    right: -5px;
                    display: grid;
                    min-width: 19px;
                    height: 19px;
                    place-items: center;
                    padding: 0 5px;
                    border: 1px solid rgba(255,253,248,0.92);
                    border-radius: 999px;
                    background: #171410;
                    color: #dfc18e;
                    font: 950 0.58rem/1 'Inter', sans-serif;
                    box-shadow: 0 8px 16px rgba(18,24,30,0.24);
                }
                .map-context-layer-strip,
                .map-amenity-layer-strip {
                    display: none;
                }
                .map-options-scrim {
                    display: block;
                    position: absolute;
                    inset: 0;
                    z-index: 2200;
                    background: transparent;
                    backdrop-filter: blur(1px);
                }
                .map-options-sheet {
                    position: absolute;
                    top: 108px;
                    right: 14px;
                    width: min(360px, calc(100% - 28px));
                    max-height: calc(100% - 124px);
                    overflow-y: auto;
                    display: grid;
                    gap: 14px;
                    padding: 18px;
                    border: 1px solid rgba(18,24,30,0.08);
                    border-radius: 18px;
                    background: #fff;
                    color: #202326;
                    box-shadow: 0 22px 54px rgba(15,18,22,0.24);
                    animation: mapOptionsRise 0.22s ease both;
                }
                .map-options-sheet header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                }
                .map-options-sheet h2,
                .map-options-sheet h3 {
                    margin: 0;
                    color: #202326;
                    letter-spacing: 0;
                }
                .map-options-sheet h2 {
                    font: 950 1.6rem/1.1 'Inter', sans-serif;
                }
                .map-options-sheet h3 {
                    font: 950 1.18rem/1.1 'Inter', sans-serif;
                }
                .map-options-sheet header button {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 46px;
                    height: 46px;
                    border: 0;
                    border-radius: 999px;
                    background: #fff;
                    color: #202326;
                    cursor: pointer;
                }
                .map-options-style-row {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 12px;
                }
                .map-options-style-row button {
                    display: grid;
                    place-items: center;
                    gap: 9px;
                    min-height: 104px;
                    border: 1.5px solid #d8dde3;
                    border-radius: 999px;
                    background: #fff;
                    color: #2b3035;
                    font: 900 0.88rem/1 'Inter', sans-serif;
                    cursor: pointer;
                }
                .map-options-style-row button.active {
                    border-color: #b8945f;
                    background: linear-gradient(180deg, #fff8ea, #f4ead7);
                    color: #5d3e16;
                    box-shadow:
                        0 0 0 1px rgba(184,148,95,0.22) inset,
                        0 12px 24px rgba(184,148,95,0.16);
                }
                .map-options-divider {
                    height: 1px;
                    background: #e5e7eb;
                }
                .map-options-section {
                    display: grid;
                    gap: 12px;
                }
                .map-context-grid,
                .map-amenity-grid,
                .map-options-filter-grid {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                }
                .map-context-grid button,
                .map-amenity-grid button,
                .map-options-filter-grid button {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    min-height: 44px;
                    padding: 0 14px;
                    border: 1.5px solid #d8dde3;
                    border-radius: 999px;
                    background: #fff;
                    color: #2b3035;
                    font: 900 0.85rem/1 'Inter', sans-serif;
                    cursor: pointer;
                }
                .map-context-grid button.active,
                .map-amenity-grid button.active,
                .map-options-filter-grid button.active {
                    border-color: #b8945f;
                    background: linear-gradient(180deg, #fff8ea, #f4ead7);
                    color: #5d3e16;
                    box-shadow: 0 8px 18px rgba(184,148,95,0.14);
                }
                @keyframes mapOptionsRise {
                    from { transform: translateY(24px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes mapLocateSpin {
                    to { transform: rotate(360deg); }
                }
                .map-draw-area-polygon {
                    filter: drop-shadow(0 0 8px rgba(47,123,255,0.36));
                }
                .map-region-area-halo {
                    filter: drop-shadow(0 2px 5px rgba(11,132,255,0.18));
                    pointer-events: none;
                }
                .map-region-area-polygon {
                    filter:
                        drop-shadow(0 0 2px rgba(255,255,255,0.94))
                        drop-shadow(0 2px 8px rgba(11,132,255,0.26));
                    stroke-linejoin: round;
                    stroke-linecap: round;
                }
                .map-region-area-mask {
                    mix-blend-mode: normal;
                }
                .map-shell .leaflet-popup-pane {
                    z-index: 1200;
                }

                .custom-price-marker,
                .premium-cluster-marker,
                .agency-location-marker,
                .map-amenity-marker {
                    background: none !important;
                    border: none !important;
                }
                .map-amenity-marker-wrap {
                    position: relative;
                    display: grid;
                    place-items: center;
                    width: 34px;
                    height: 34px;
                    border: 2px solid rgba(255,255,255,0.94);
                    border-radius: 999px;
                    background: var(--amenity-color, #1478d4);
                    box-shadow:
                        0 12px 24px rgba(10,16,24,0.28),
                        0 0 0 5px color-mix(in srgb, var(--amenity-color, #1478d4) 16%, transparent);
                    color: #fff;
                    font: 950 0.56rem/1 'Inter', sans-serif;
                    letter-spacing: 0.02em;
                    transform-origin: center;
                    animation: markerRise 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
                }
                .map-amenity-marker-wrap::after {
                    content: '';
                    position: absolute;
                    left: 50%;
                    bottom: -7px;
                    border-left: 6px solid transparent;
                    border-right: 6px solid transparent;
                    border-top: 8px solid var(--amenity-color, #1478d4);
                    transform: translateX(-50%);
                }
                .map-amenity-popup .leaflet-popup-content-wrapper {
                    width: 250px;
                    border: 1px solid rgba(223,193,142,0.2);
                    border-radius: 16px;
                    padding: 0;
                    overflow: hidden;
                    background: #131313;
                    color: #f4efe7;
                    box-shadow: 0 18px 52px rgba(0,0,0,0.46);
                }
                .map-amenity-popup .leaflet-popup-content {
                    width: 250px !important;
                    margin: 0;
                }
                .map-amenity-popup .leaflet-popup-tip {
                    background: #131313;
                    border: 1px solid rgba(223,193,142,0.18);
                }
                .map-amenity-popup-content {
                    display: grid;
                    gap: 7px;
                    padding: 13px 14px 14px;
                    font-family: 'Inter', sans-serif;
                }
                .map-amenity-popup-content span {
                    color: #bda36b;
                    font-size: 0.62rem;
                    font-weight: 950;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                }
                .map-amenity-popup-content strong {
                    color: #f4efe7;
                    font-family: 'Noto Serif', Georgia, serif;
                    font-size: 0.95rem;
                    font-weight: 800;
                    line-height: 1.18;
                }
                .map-amenity-popup-content small {
                    color: rgba(244,239,231,0.68);
                    font-size: 0.72rem;
                    font-weight: 720;
                    line-height: 1.3;
                }
                .map-amenity-popup-content b {
                    width: max-content;
                    max-width: 100%;
                    padding: 6px 9px;
                    border-radius: 999px;
                    background: rgba(223,193,142,0.12);
                    color: #f0d08f;
                    font-size: 0.7rem;
                    font-weight: 950;
                    line-height: 1;
                }
                .agency-marker-wrap {
                    display: grid;
                    justify-items: center;
                    gap: 4px;
                    cursor: pointer;
                    filter: drop-shadow(0 14px 20px rgba(8,14,30,0.42));
                    animation: markerRise 0.38s cubic-bezier(0.22, 1, 0.36, 1) both;
                    transform-origin: center bottom;
                }
                .agency-marker-pin {
                    position: relative;
                    display: grid;
                    place-items: center;
                    width: 72px;
                    height: 76px;
                    overflow: hidden;
                }
                .agency-marker-pin img {
                    display: block;
                    height: auto !important;
                    left: 50%;
                    max-width: none;
                    object-fit: cover;
                    object-position: center;
                    position: absolute;
                    top: 50%;
                    transform: translate(-50%, -47%);
                    width: 164px !important;
                    filter: saturate(1.16) contrast(1.08);
                }
                .agency-marker-wrap strong,
                .agency-marker-wrap small {
                    display: block;
                    max-width: 176px;
                    padding: 4px 9px;
                    border: 1px solid rgba(223,193,142,0.44);
                    border-radius: 999px;
                    background: rgba(13,13,13,0.9);
                    color: #f1d693;
                    font-family: 'Inter', sans-serif;
                    text-align: center;
                    white-space: nowrap;
                    backdrop-filter: blur(12px);
                    box-shadow: 0 8px 16px rgba(0,0,0,0.2);
                }
                .agency-marker-wrap strong {
                    font-size: 0.66rem;
                    font-weight: 950;
                    line-height: 1;
                }
                .agency-marker-wrap small {
                    margin-top: -2px;
                    padding: 3px 8px;
                    color: rgba(244,239,231,0.86);
                    font-size: 0.56rem;
                    font-weight: 850;
                    line-height: 1;
                }
                .agency-location-popup .leaflet-popup-content-wrapper {
                    width: 292px;
                    border: 1px solid rgba(223,193,142,0.22);
                    border-radius: 18px;
                    padding: 0;
                    overflow: hidden;
                    background: #131313;
                    color: #f4efe7;
                    box-shadow: 0 18px 52px rgba(0,0,0,0.5);
                }
                .agency-location-popup .leaflet-popup-content {
                    width: 292px !important;
                    margin: 0;
                }
                .agency-location-popup .leaflet-popup-tip {
                    background: #131313;
                    border: 1px solid rgba(223,193,142,0.2);
                }
                .agency-location-popup .leaflet-popup-close-button {
                    top: 8px !important;
                    right: 8px !important;
                    z-index: 3;
                    width: 28px !important;
                    height: 28px !important;
                    border-radius: 50%;
                    background: rgba(12,12,12,0.72) !important;
                    color: #f4efe7 !important;
                    font-size: 18px !important;
                    line-height: 26px !important;
                }
                .agency-location-card {
                    display: block;
                    overflow: hidden;
                    font-family: 'Inter', sans-serif;
                }
                .agency-location-card-media {
                    position: relative;
                    width: 100%;
                    height: 158px;
                    overflow: hidden;
                    background: #221b12;
                }
                .agency-location-card-media::after {
                    content: '';
                    position: absolute;
                    inset: auto 0 0;
                    height: 62px;
                    background: linear-gradient(to top, #131313, transparent);
                }
                .agency-location-card-img {
                    display: block;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transform: scale(1.02);
                }
                .agency-location-card-info {
                    display: grid;
                    gap: 7px;
                    padding: 14px 15px 15px;
                    background:
                        linear-gradient(180deg, rgba(223,193,142,0.08), transparent 34%),
                        #131313;
                }
                .agency-location-card-kicker {
                    color: #bda36b;
                    font: 900 0.62rem/1 'Inter', sans-serif;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                }
                .agency-location-card h3 {
                    margin: 0;
                    color: #f0d08f;
                    font-family: 'Noto Serif', Georgia, serif;
                    font-size: 0.98rem;
                    font-weight: 800;
                    line-height: 1.2;
                }
                .agency-location-card p {
                    margin: 0;
                    color: rgba(244,239,231,0.78);
                    font-size: 0.72rem;
                    font-weight: 750;
                    line-height: 1.35;
                }
                .marker-wrap {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 3px;
                    cursor: pointer;
                    filter: drop-shadow(0 10px 16px rgba(0,0,0,0.46));
                    transform-origin: center bottom;
                    animation: markerRise 0.38s cubic-bezier(0.22, 1, 0.36, 1) both;
                    transition: transform 0.24s ease, filter 0.24s ease;
                }
                .marker-pin {
                    position: relative;
                    display: grid;
                    place-items: center;
                    width: 34px;
                    height: 34px;
                    border-radius: 50% 50% 50% 8px;
                    transform: rotate(45deg);
                    background: linear-gradient(145deg, #fff3c7 0%, #d7ad42 48%, #9c741b 100%);
                    border: 2px solid rgba(18,18,18,0.88);
                    box-shadow:
                        0 0 0 2px rgba(255,255,255,0.18),
                        0 10px 28px rgba(217, 172, 63, 0.28);
                }
                .marker-pin::before {
                    content: '';
                    position: absolute;
                    inset: -8px;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(223,193,142,0.32), transparent 64%);
                    z-index: -1;
                }
                .marker-glyph {
                    position: relative;
                    width: 11px;
                    height: 9px;
                    transform: rotate(-45deg);
                    border-radius: 2px;
                    background: #15130f;
                }
                .marker-glyph::before {
                    content: '';
                    position: absolute;
                    left: 1px;
                    top: -5px;
                    width: 9px;
                    height: 9px;
                    background: #15130f;
                    transform: rotate(45deg);
                    border-radius: 2px 1px 0 1px;
                }
                .marker-glyph::after {
                    content: '';
                    position: absolute;
                    left: 4px;
                    bottom: 0;
                    width: 3px;
                    height: 5px;
                    border-radius: 1px 1px 0 0;
                    background: #d7ad42;
                }
                .marker-price {
                    min-width: 112px;
                    padding: 3px 9px;
                    border: 1px solid rgba(223,193,142,0.54);
                    border-radius: 999px;
                    background: rgba(10,10,10,0.88);
                    color: #f0d08f;
                    font: 900 0.66rem/1.3 'Inter', sans-serif;
                    letter-spacing: 0.02em;
                    text-align: center;
                    white-space: nowrap;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 8px 16px rgba(0,0,0,0.24);
                }
                .marker-wrap--exclusive .marker-price::after {
                    content: 'EX';
                    margin-left: 5px;
                    color: #fff3c7;
                    font-size: 0.56rem;
                }
                .marker-wrap:hover,
                .marker-wrap--active {
                    transform: translateY(-4px) scale(1.18);
                    filter: drop-shadow(0 14px 28px rgba(223,193,142,0.42));
                }
                .marker-wrap:hover .marker-price,
                .marker-wrap--active .marker-price {
                    background: #dfc18e;
                    color: #0d0c0b;
                }
                .cluster-orbit {
                    position: relative;
                    display: grid;
                    place-items: center;
                    min-width: 128px;
                    height: 54px;
                    padding: 7px 12px;
                    border: 1px solid rgba(223,193,142,0.56);
                    border-radius: 18px;
                    background:
                        radial-gradient(circle at 32% 10%, rgba(255,244,198,0.28), transparent 30%),
                        rgba(8,8,8,0.9);
                    color: #f4d999;
                    box-shadow:
                        0 14px 28px rgba(0,0,0,0.36),
                        0 0 0 5px rgba(223,193,142,0.11),
                        0 0 38px rgba(223,193,142,0.26);
                    backdrop-filter: blur(12px);
                    cursor: pointer;
                    animation: clusterPulse 2.8s ease-in-out infinite;
                }
                .cluster-count {
                    font: 950 1.05rem/1 'Inter', sans-serif;
                }
                .cluster-label {
                    margin-top: 3px;
                    color: #d6c6a5;
                    font: 850 0.6rem/1 'Inter', sans-serif;
                    white-space: nowrap;
                }
                .marker-wrap {
                    gap: 0;
                    filter: drop-shadow(0 8px 15px rgba(8,38,82,0.32));
                }
                .marker-wrap--dot {
                    display: grid;
                    place-items: center;
                    width: 34px;
                    height: 34px;
                    animation: markerRise 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
                }
                .marker-dot {
                    display: block;
                    width: 14px;
                    height: 14px;
                    border: 2px solid #fff;
                    border-radius: 999px;
                    background: #1463ff;
                    box-shadow:
                        0 8px 18px rgba(0,0,0,0.26),
                        0 0 0 7px rgba(20,99,255,0.14);
                    transition: transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
                }
                .marker-wrap--dot.marker-wrap--active .marker-dot {
                    background: #0a3f9f;
                    transform: scale(1.22);
                    box-shadow:
                        0 10px 22px rgba(0,0,0,0.3),
                        0 0 0 8px rgba(10,63,159,0.18);
                }
                .marker-wrap--dot.marker-wrap--selected .marker-dot {
                    background: #0f8f5a;
                    transform: scale(1.28);
                    box-shadow:
                        0 12px 24px rgba(0,0,0,0.32),
                        0 0 0 8px rgba(15,143,90,0.2),
                        0 0 28px rgba(15,143,90,0.32);
                }
                .marker-wrap--overview {
                    width: 24px;
                    height: 24px;
                    animation: none;
                    filter: drop-shadow(0 5px 10px rgba(9,48,110,0.24));
                }
                .marker-wrap--overview .marker-dot {
                    width: 9px;
                    height: 9px;
                    border-width: 1.5px;
                    background: #1286ff;
                    box-shadow:
                        0 5px 12px rgba(6,51,116,0.26),
                        0 0 0 5px rgba(18,134,255,0.16);
                }
                .marker-wrap--bubble {
                    align-items: center;
                    animation: markerRise 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
                }
                .marker-wrap--bubble .marker-price {
                    position: relative;
                    min-width: auto;
                    padding: 7px 11px 8px;
                    border: 2px solid #fff;
                    border-radius: 18px;
                    background: #1463ff;
                    color: #fff;
                    font: 950 0.76rem/1 'Inter', sans-serif;
                    letter-spacing: 0;
                    box-shadow:
                        0 12px 26px rgba(0,0,0,0.28),
                        0 0 0 6px rgba(20,99,255,0.12);
                    backdrop-filter: none;
                }
                .marker-wrap--bubble .marker-price::before {
                    content: '';
                    position: absolute;
                    left: 50%;
                    bottom: -8px;
                    width: 0;
                    height: 0;
                    border-left: 7px solid transparent;
                    border-right: 7px solid transparent;
                    border-top: 9px solid #1463ff;
                    transform: translateX(-50%);
                }
                .marker-wrap--bubble.marker-wrap--active {
                    transform: translateY(-4px) scale(1.14);
                    filter: drop-shadow(0 14px 30px rgba(10,63,159,0.35));
                }
                .marker-wrap--bubble.marker-wrap--active .marker-price {
                    background: #0a3f9f;
                    color: #fff;
                    box-shadow:
                        0 14px 28px rgba(0,0,0,0.34),
                        0 0 0 7px rgba(10,63,159,0.16);
                }
                .marker-wrap--bubble.marker-wrap--active .marker-price::before {
                    border-top-color: #0a3f9f;
                }
                .marker-wrap--bubble.marker-wrap--selected {
                    transform: translateY(-4px) scale(1.16);
                    filter: drop-shadow(0 16px 34px rgba(15,143,90,0.36));
                }
                .marker-wrap--bubble.marker-wrap--selected .marker-price {
                    background: #0f8f5a;
                    color: #fff;
                    box-shadow:
                        0 16px 32px rgba(0,0,0,0.34),
                        0 0 0 7px rgba(15,143,90,0.18),
                        0 0 34px rgba(15,143,90,0.28);
                }
                .marker-wrap--bubble.marker-wrap--selected .marker-price::before {
                    border-top-color: #0f8f5a;
                }
                .cluster-dot-wrap {
                    display: grid;
                    place-items: center;
                    width: 42px;
                    height: 42px;
                    cursor: pointer;
                    filter: drop-shadow(0 8px 18px rgba(0,0,0,0.28));
                }
                .cluster-dot {
                    display: grid;
                    place-items: center;
                    min-width: 20px;
                    height: 20px;
                    padding: 0 5px;
                    border: 2px solid #fff;
                    border-radius: 999px;
                    background: #1463ff;
                    color: #fff;
                    font: 950 0.56rem/1 'Inter', sans-serif;
                    box-shadow: 0 0 0 8px rgba(20,99,255,0.15);
                }
                .cluster-dot-wrap--overview {
                    width: 26px;
                    height: 26px;
                    filter: drop-shadow(0 5px 11px rgba(9,48,110,0.24));
                }
                .cluster-dot--overview {
                    min-width: 10px;
                    width: 10px;
                    height: 10px;
                    padding: 0;
                    border-width: 1.5px;
                    background: #1286ff;
                    box-shadow:
                        0 5px 12px rgba(6,51,116,0.26),
                        0 0 0 5px rgba(18,134,255,0.16);
                }
                .cluster-orbit--price {
                    min-width: 86px;
                    height: 42px;
                    padding: 6px 10px;
                    border: 2px solid #fff;
                    border-radius: 19px;
                    background: #0b56b7;
                    color: #fff;
                    box-shadow:
                        0 12px 24px rgba(0,0,0,0.3),
                        0 0 0 6px rgba(11,86,183,0.13);
                    animation: none;
                }
                .cluster-orbit--price::after {
                    content: '';
                    position: absolute;
                    left: 50%;
                    bottom: -8px;
                    border-left: 7px solid transparent;
                    border-right: 7px solid transparent;
                    border-top: 9px solid #0b56b7;
                    transform: translateX(-50%);
                }
                .cluster-orbit--price .cluster-count {
                    font-size: 0.78rem;
                }
                .cluster-orbit--price .cluster-label {
                    margin-top: 2px;
                    color: rgba(255,255,255,0.82);
                    font-size: 0.52rem;
                }

                .property-popup .leaflet-popup-content-wrapper {
                    width: 292px;
                    border: 1px solid rgba(223,193,142,0.22);
                    border-radius: 18px;
                    padding: 0;
                    overflow: hidden;
                    background: #131313;
                    box-shadow: 0 18px 52px rgba(0,0,0,0.5);
                }
                .property-popup .leaflet-popup-content {
                    width: 292px !important;
                    margin: 0;
                }
                .property-popup .leaflet-popup-tip {
                    background: #131313;
                    border: 1px solid rgba(223,193,142,0.2);
                }
                .popup-content {
                    overflow: hidden;
                    font-family: 'Inter', sans-serif;
                }
                .popup-img-wrapper {
                    position: relative;
                    width: 100%;
                    height: 158px;
                    overflow: hidden;
                    background: #222;
                }
                .popup-img-wrapper::after {
                    content: '';
                    position: absolute;
                    inset: auto 0 0;
                    height: 62px;
                    background: linear-gradient(to top, #131313, transparent);
                }
                .popup-img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transform: scale(1.02);
                }
                .popup-badge {
                    position: absolute;
                    top: 12px;
                    left: 12px;
                    z-index: 2;
                    padding: 5px 8px;
                    border-radius: 999px;
                    background: rgba(223,193,142,0.92);
                    color: #111;
                    font: 900 0.62rem/1 'Inter', sans-serif;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }
                .popup-info {
                    padding: 14px 15px 15px;
                }
                .popup-kicker {
                    margin-bottom: 6px;
                    color: #bda36b;
                    font: 900 0.62rem/1 'Inter', sans-serif;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                }
                .popup-title {
                    display: -webkit-box;
                    margin: 0 0 8px;
                    overflow: hidden;
                    color: #f4efe7;
                    font-family: 'Noto Serif', Georgia, serif;
                    font-size: 0.95rem;
                    font-weight: 700;
                    line-height: 1.28;
                    -webkit-box-orient: vertical;
                    -webkit-line-clamp: 2;
                }
                .popup-price {
                    margin-bottom: 10px;
                    color: #f0d08f;
                    font: 950 1.06rem/1 'Inter', sans-serif;
                }
                .popup-specs {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 7px;
                    margin-bottom: 13px;
                    color: #aaa39a;
                    font: 750 0.72rem/1 'Inter', sans-serif;
                }
                .popup-specs span {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 5px 7px;
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 999px;
                    background: rgba(255,255,255,0.04);
                }
                .popup-link {
                    display: block;
                    padding: 11px;
                    border-radius: 10px;
                    background: linear-gradient(135deg, #dfc18e, #b8945f);
                    color: #0c0c0c;
                    font: 950 0.72rem/1 'Inter', sans-serif;
                    letter-spacing: 0.14em;
                    text-align: center;
                    text-decoration: none;
                    text-transform: uppercase;
                }
                .property-popup .leaflet-popup-close-button {
                    top: 8px !important;
                    right: 8px !important;
                    width: 28px !important;
                    height: 28px !important;
                    border-radius: 50%;
                    background: rgba(12,12,12,0.72) !important;
                    color: #f4efe7 !important;
                    font-size: 18px !important;
                    line-height: 26px !important;
                }
                @keyframes markerRise {
                    from { opacity: 0; transform: translateY(12px) scale(0.86); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes clusterPulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.045); }
                }
                @media (max-width: 1023px) {
                    .map-topbar {
                        display: none;
                    }
                    .map-mobile-style-stack {
                        display: none;
                    }
                    .map-mobile-filter-panel.is-open {
                        display: none;
                    }
                    .map-mobile-filters-open .leaflet-control-zoom {
                        display: none !important;
                    }
                    .map-watermark {
                        display: none;
                    }
                    .map-draw-control {
                        display: none;
                    }
                    .map-mobile-action-dock {
                        position: absolute;
                        left: max(12px, env(safe-area-inset-left));
                        right: auto;
                        top: clamp(96px, calc(var(--sv-sheet-top, 72%) - 58px), calc(100% - 58px));
                        bottom: auto;
                        z-index: 1300;
                        display: flex !important;
                        align-items: center;
                        gap: 9px;
                        pointer-events: auto;
                    }
                    .map-mobile-action-dock button {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 42px;
                        height: 42px;
                        border: 1px solid rgba(18,24,30,0.08);
                        border-radius: 999px;
                        background: rgba(255,255,255,0.94);
                        color: #171a1d;
                        cursor: pointer;
                        box-shadow: 0 12px 26px rgba(18,24,30,0.18);
                        backdrop-filter: blur(14px);
                        -webkit-backdrop-filter: blur(14px);
                    }
                    .map-mobile-action-dock button svg {
                        width: 17px;
                        height: 17px;
                    }
                    .map-mobile-action-dock button span {
                        position: absolute;
                        left: 50%;
                        bottom: calc(100% + 8px);
                        width: max-content;
                        max-width: 104px;
                        height: auto;
                        overflow: visible;
                        clip: auto;
                        border: 1px solid rgba(255,255,255,0.16);
                        border-radius: 999px;
                        background: rgba(23,20,16,0.9);
                        box-shadow: 0 10px 24px rgba(18,24,30,0.22);
                        color: #fff8ea;
                        font: 900 0.56rem/1 'Inter', sans-serif;
                        letter-spacing: 0.02em;
                        opacity: 0;
                        padding: 6px 8px;
                        pointer-events: none;
                        text-align: center;
                        transform: translate(-50%, 6px);
                        transition: opacity 0.18s ease, transform 0.18s ease;
                        white-space: nowrap;
                        z-index: 1;
                    }
                    .map-shell--control-hints .map-mobile-action-dock button span,
                    .map-mobile-action-dock button:hover span,
                    .map-mobile-action-dock button:focus-visible span,
                    .map-mobile-action-dock button.active span {
                        opacity: 1;
                        transform: translate(-50%, 0);
                    }
                    .map-mobile-action-dock button.active {
                        background: linear-gradient(135deg, #dfc18e, #b8945f);
                        color: #101010;
                        box-shadow: 0 14px 28px rgba(184,148,95,0.28);
                    }
                    .map-mobile-action-dock button.loading svg {
                        animation: mapLocateSpin 1s linear infinite;
                    }
                    .map-options-scrim {
                        display: block;
                        position: absolute;
                        z-index: 2200;
                        background: rgba(15,18,22,0.42);
                    }
                    .map-options-sheet {
                        left: 0;
                        right: 0;
                        top: auto;
                        bottom: 0;
                        width: auto;
                        gap: 18px;
                        padding: 24px 18px calc(22px + env(safe-area-inset-bottom));
                        border-radius: 28px 28px 0 0;
                        border: 0;
                        box-shadow: 0 -22px 54px rgba(15,18,22,0.28);
                    }
                    .map-context-layer-strip {
                        position: absolute;
                        left: 12px;
                        right: 12px;
                        top: clamp(54px, calc(var(--sv-sheet-top, 72%) - 124px), calc(100% - 118px));
                        bottom: auto;
                        z-index: 1290;
                        display: flex;
                        gap: 8px;
                        overflow-x: auto;
                        padding: 2px 0;
                        scrollbar-width: none;
                    }
                    .map-amenity-layer-strip {
                        position: absolute;
                        left: 12px;
                        right: 12px;
                        top: clamp(96px, calc(var(--sv-sheet-top, 72%) - 82px), calc(100% - 74px));
                        bottom: auto;
                        z-index: 1290;
                        display: flex;
                        gap: 8px;
                        overflow-x: auto;
                        padding: 2px 0;
                        scrollbar-width: none;
                    }
                    .map-context-layer-strip::-webkit-scrollbar,
                    .map-amenity-layer-strip::-webkit-scrollbar {
                        display: none;
                    }
                    .map-context-layer-strip span,
                    .map-amenity-layer-strip span {
                        flex: 0 0 auto;
                        display: inline-flex;
                        align-items: center;
                        gap: 7px;
                        min-height: 36px;
                        padding: 0 11px;
                        border: 1px solid rgba(20,120,212,0.18);
                        border-radius: 999px;
                        background: rgba(255,255,255,0.94);
                        color: #202326;
                        font: 900 0.76rem/1 'Inter', sans-serif;
                        box-shadow: 0 10px 22px rgba(18,24,30,0.14);
                    }
                    .map-amenity-layer-strip span {
                        border-color: rgba(184,148,95,0.28);
                        color: #28221a;
                    }
                    .map-options-sheet {
                        max-height: min(72vh, 620px);
                        overflow-y: auto;
                    }
                    .map-shell--drawing .map-mobile-action-dock button:not(.active),
                    .map-shell--drawing .map-context-layer-strip,
                    .map-shell--drawing .map-amenity-layer-strip {
                        opacity: 0.34;
                        pointer-events: none;
                    }
                    .map-user-location-circle {
                        filter: drop-shadow(0 0 12px rgba(20,120,212,0.24));
                    }
                    .map-region-chip {
                        top: 92px;
                        left: 12px;
                        max-width: min(176px, calc(100% - 24px));
                        min-height: 28px;
                        padding: 0 9px;
                        font-size: 0.58rem;
                    }
                    .property-popup .leaflet-popup-content-wrapper,
                    .property-popup .leaflet-popup-content,
                    .agency-location-popup .leaflet-popup-content-wrapper,
                    .agency-location-popup .leaflet-popup-content {
                        width: 260px !important;
                    }
                    .popup-img-wrapper,
                    .agency-location-card-media {
                        height: 132px;
                    }
                }
            `}</style>

            <MapContainer
                center={initialMapCenter}
                zoom={initialMapZoom}
                zoomControl={false}
                dragging={interactionEnabled}
                touchZoom={interactionEnabled}
                scrollWheelZoom={interactionEnabled}
                doubleClickZoom={interactionEnabled}
                boxZoom={interactionEnabled}
                keyboard={interactionEnabled}
                style={{ position: 'absolute', inset: 0, background: '#111' }}
            >
                {mapStyle === 'luxury' && (
                    <TileLayer
                        attribution={LEAFLET_OSM_ATTRIBUTION}
                        url={LEAFLET_OSM_TILE_URL}
                        maxZoom={20}
                    />
                )}
                {mapStyle === 'classic' && (
                    <TileLayer
                        attribution={LEAFLET_OSM_ATTRIBUTION}
                        url={LEAFLET_OSM_TILE_URL}
                        maxZoom={20}
                    />
                )}
                {mapStyle === 'satellite' && (
                    <TileLayer
                        attribution='Tiles &copy; Esri'
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        maxZoom={19}
                    />
                )}

                <MapUpdater
                    points={mapPoints}
                    refitKey={refitKey}
                    hasFocusArea={hasDrawArea || hasRegionArea}
                    overviewMode={overviewMode}
                    fixedOverviewView={fixedOverviewView}
                />
                <SelectedPropertyFocusController
                    items={validProperties}
                    selectedPropertyId={selectedPropertyId}
                    enabled={!drawModeEnabled}
                />
                <MapInteractionController enabled={interactionEnabled && !drawModeEnabled} />
                <BoundsEmitter onBoundsChange={onBoundsChange} onUserBoundsChange={onUserBoundsChange} />
                <UserLocationController
                    requestId={locateRequestId}
                    onLocated={handleUserLocated}
                    onStatusChange={setLocateState}
                />
                <FocusAreaLayer drawArea={drawArea} regionArea={regionArea} />
                <DrawAreaLayer
                    key={drawModeEnabled ? 'draw-enabled' : 'draw-disabled'}
                    enabled={drawModeEnabled}
                    area={drawArea}
                    onCommit={handleDrawAreaCommit}
                />
                <NearbyAmenitiesLayer activeLayers={activeAmenityLayers} />
                {userMapLocation && (
                    <Circle
                        center={userMapLocation.latLng}
                        radius={Math.max(90, Math.min(900, Number(userMapLocation.accuracy || 120)))}
                        pathOptions={{
                            color: '#1478d4',
                            weight: 2,
                            opacity: 0.78,
                            fillColor: '#1478d4',
                            fillOpacity: 0.14,
                            className: 'map-user-location-circle',
                        }}
                    />
                )}
                {officeMarker && officeIcon && (
                    <Marker position={officeMarker.latLng} icon={officeIcon} zIndexOffset={1200}>
                        <Popup className="agency-location-popup" minWidth={260} maxWidth={292}>
                            <AgencyLocationPopup officeMarker={officeMarker} />
                        </Popup>
                    </Marker>
                )}
                <ClusterLayer
                    items={filteredProperties}
                    hoveredPropertyId={hoveredPropertyId}
                    selectedPropertyId={selectedPropertyId}
                    createIcon={createIcon}
                    onMarkerHover={onMarkerHover}
                    onPropertySelect={onPropertySelect}
                    overviewMode={overviewMode}
                />
            </MapContainer>
        </div>
    )
}
