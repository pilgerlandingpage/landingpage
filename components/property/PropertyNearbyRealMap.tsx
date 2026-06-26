'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { Sparkles } from 'lucide-react'
import { getNearbyBenefitConfig, type NearbyBenefitLayer } from '@/lib/locations/nearby-benefits'
import { LEAFLET_OSM_ATTRIBUTION, LEAFLET_OSM_TILE_URL } from '@/lib/maps/leaflet-style'

type LatLngTuple = [number, number]

type NearbyBenefitResult = {
    layer: NearbyBenefitLayer
    label: string
    searchLabel: string
    name: string
    vicinity?: string
    latLng: LatLngTuple
    distanceMeters: number
    color: string
}

type StreetRouteMap = Record<string, LatLngTuple[]>

type Props = {
    origin: LatLngTuple
    results: NearbyBenefitResult[]
    loading: boolean
}

const NEARBY_PROPERTY_FOCUS_ZOOM = 16

function formatDistance(meters: number) {
    if (!Number.isFinite(meters)) return 'Sob consulta'
    if (meters < 1000) return `${Math.max(40, Math.round(meters / 10) * 10).toLocaleString('pt-BR')} m`
    return `${(meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
}

function escapeMarkerText(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

function getBenefitShortLabel(item: NearbyBenefitResult) {
    const option = getNearbyBenefitConfig(item.layer)
    return option?.shortLabel || option?.label.slice(0, 2).toUpperCase() || 'PO'
}

function createPropertyMarkerIcon() {
    return L.divIcon({
        className: 'plp-nearby-property-marker',
        html: '<div class="plp-nearby-property-marker-wrap"><span class="plp-nearby-property-pin"><i></i></span><strong>Imóvel</strong></div>',
        iconSize: [92, 62],
        iconAnchor: [46, 42],
        popupAnchor: [0, -42],
    })
}

function createBenefitMarkerIcon(item: NearbyBenefitResult) {
    return L.divIcon({
        className: 'plp-nearby-benefit-marker',
        html: `<div class="plp-nearby-benefit-marker-wrap" style="--benefit-color:${item.color}"><span>${escapeMarkerText(getBenefitShortLabel(item))}</span></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -17],
    })
}

function streetRouteKey(origin: LatLngTuple, target: LatLngTuple) {
    return [
        origin[0].toFixed(6),
        origin[1].toFixed(6),
        target[0].toFixed(6),
        target[1].toFixed(6),
    ].join(':')
}

async function fetchStreetRoute(origin: LatLngTuple, target: LatLngTuple, signal: AbortSignal): Promise<LatLngTuple[] | null> {
    const coordinates = `${origin[1].toFixed(6)},${origin[0].toFixed(6)};${target[1].toFixed(6)},${target[0].toFixed(6)}`
    const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&alternatives=false&steps=false`

    try {
        const response = await fetch(url, { signal })
        if (!response.ok) return null

        const payload = await response.json()
        const geometry = payload?.routes?.[0]?.geometry
        const coordinatesList = Array.isArray(geometry?.coordinates) ? geometry.coordinates : []
        const route = coordinatesList
            .map((coordinate: unknown): LatLngTuple | null => {
                if (!Array.isArray(coordinate) || coordinate.length < 2) return null
                const lng = Number(coordinate[0])
                const lat = Number(coordinate[1])
                return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null
            })
            .filter((coordinate: LatLngTuple | null): coordinate is LatLngTuple => Boolean(coordinate))

        return route.length >= 2 ? route : null
    } catch {
        return null
    }
}

type BenefitTooltipDirection = 'top' | 'bottom' | 'left' | 'right'

function getBenefitTooltipDirection(origin: LatLngTuple, target: LatLngTuple, index: number): BenefitTooltipDirection {
    const latDelta = target[0] - origin[0]
    const lngDelta = target[1] - origin[1]

    if (Math.abs(lngDelta) > Math.abs(latDelta) * 1.15) {
        return lngDelta >= 0 ? 'right' : 'left'
    }

    if (Math.abs(latDelta) > 0.0002) {
        return latDelta >= 0 ? 'top' : 'bottom'
    }

    return index % 2 === 0 ? 'right' : 'left'
}

function getBenefitTooltipOffset(direction: BenefitTooltipDirection): [number, number] {
    if (direction === 'right') return [18, 0]
    if (direction === 'left') return [-18, 0]
    if (direction === 'bottom') return [0, 18]
    return [0, -18]
}

function NearbyMapController({
    origin,
    results,
}: {
    origin: LatLngTuple
    results: NearbyBenefitResult[]
}) {
    const map = useMap()
    const positionedOriginRef = useRef('')
    const originKey = `${origin[0].toFixed(6)}:${origin[1].toFixed(6)}`
    const resultKey = results.map(item => `${item.layer}:${item.latLng.join(',')}`).join('|')

    useEffect(() => {
        if (positionedOriginRef.current === originKey) return

        positionedOriginRef.current = originKey
        map.setView(origin, NEARBY_PROPERTY_FOCUS_ZOOM, { animate: false })
        const resizeTimer = window.setTimeout(() => map.invalidateSize(), 120)
        return () => window.clearTimeout(resizeTimer)
    }, [map, origin, originKey])

    useEffect(() => {
        const resizeTimer = window.setTimeout(() => map.invalidateSize(), 120)
        return () => window.clearTimeout(resizeTimer)
    }, [map, resultKey])

    return null
}

export default function PropertyNearbyRealMap({ origin, results, loading }: Props) {
    const propertyMarkerIcon = useMemo(() => createPropertyMarkerIcon(), [])
    const benefitIcons = useMemo(() => (
        new Map(results.map(item => [`${item.layer}-${item.name}`, createBenefitMarkerIcon(item)]))
    ), [results])
    const routeRequestKey = useMemo(() => (
        results.map(item => streetRouteKey(origin, item.latLng)).join('|')
    ), [origin, results])
    const [streetRoutes, setStreetRoutes] = useState<StreetRouteMap>({})

    useEffect(() => {
        if (results.length === 0) return

        let active = true
        const controller = new AbortController()

        async function loadStreetRoutes() {
            const routeEntries = await Promise.all(results.map(async item => {
                const key = streetRouteKey(origin, item.latLng)
                const route = await fetchStreetRoute(origin, item.latLng, controller.signal)
                return [key, route] as const
            }))

            if (!active) return

            const nextRoutes = routeEntries.reduce<StreetRouteMap>((acc, [key, route]) => {
                if (route) acc[key] = route
                return acc
            }, {})

            setStreetRoutes(nextRoutes)
        }

        loadStreetRoutes()

        return () => {
            active = false
            controller.abort()
        }
    }, [origin, results, routeRequestKey])

    return (
        <div className={`plp-nearby-map-shell${loading ? ' is-loading' : ''}`} aria-label="Mapa real com pontos de interesse ao redor do imóvel">
            <MapContainer
                center={origin}
                zoom={NEARBY_PROPERTY_FOCUS_ZOOM}
                minZoom={11}
                maxZoom={17}
                zoomControl
                scrollWheelZoom
                touchZoom
                doubleClickZoom
                boxZoom
                keyboard
                className="plp-nearby-real-map"
                attributionControl
            >
                <NearbyMapController origin={origin} results={results} />
                <TileLayer attribution={LEAFLET_OSM_ATTRIBUTION} url={LEAFLET_OSM_TILE_URL} />

                {results.map(item => {
                    const route = streetRoutes[streetRouteKey(origin, item.latLng)]
                    return route ? (
                        <Polyline
                            key={`route-halo-${item.layer}-${item.name}`}
                            positions={route}
                            pathOptions={{
                                color: 'rgba(255,255,255,0.96)',
                                weight: 7,
                                opacity: 0.92,
                                lineCap: 'round',
                                lineJoin: 'round',
                            }}
                        />
                    ) : null
                })}
                {results.map(item => {
                    const route = streetRoutes[streetRouteKey(origin, item.latLng)]
                    return route ? (
                        <Polyline
                            key={`route-${item.layer}-${item.name}`}
                            positions={route}
                            pathOptions={{
                                color: item.color,
                                weight: 3,
                                opacity: 0.94,
                                dashArray: '10 7',
                                lineCap: 'round',
                                lineJoin: 'round',
                            }}
                        />
                    ) : null
                })}

                <Marker position={origin} icon={propertyMarkerIcon} zIndexOffset={900}>
                    <Tooltip direction="top" offset={[0, -38]} className="plp-nearby-property-tooltip" permanent>
                        Imóvel
                    </Tooltip>
                </Marker>

                {results.map((item, index) => {
                    const tooltipDirection = getBenefitTooltipDirection(origin, item.latLng, index)
                    return (
                        <Marker
                            key={`marker-${item.layer}-${item.name}`}
                            position={item.latLng}
                            icon={benefitIcons.get(`${item.layer}-${item.name}`) || createBenefitMarkerIcon(item)}
                            zIndexOffset={650}
                        >
                            <Tooltip
                                direction={tooltipDirection}
                                offset={getBenefitTooltipOffset(tooltipDirection)}
                                className="plp-nearby-benefit-tooltip"
                                permanent
                            >
                                <span>{item.label}</span>
                                <strong>{formatDistance(item.distanceMeters)}</strong>
                            </Tooltip>
                            <Popup className="plp-nearby-benefit-popup">
                                <strong>{item.name}</strong>
                                <span>{item.label}</span>
                                <em>{formatDistance(item.distanceMeters)} do imóvel</em>
                            </Popup>
                        </Marker>
                    )
                })}
            </MapContainer>

            {loading && (
                <div className="plp-nearby-map-status">
                    <Sparkles size={14} />
                    Buscando pontos do entorno
                </div>
            )}
        </div>
    )
}
