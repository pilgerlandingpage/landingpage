'use client'

import { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import Link from 'next/link'
import { Bath, Bed, Building2, Layers, Maximize, Satellite, SlidersHorizontal, Sparkles } from 'lucide-react'
import { replaceItajaiWithPraiaBrava } from '@/lib/locations/display'
import { propertyDetailsPath } from '@/lib/properties/responsive-destination'
import { trackEvent } from '@/lib/tracking/client'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

interface Property {
    id: string
    title: string
    price: number | null
    latitude: number | string | null
    longitude: number | string | null
    featured_image: string | null
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
    onMarkerHover?: (id: string | null) => void
    onBoundsChange?: (bounds: MapBounds) => void
    refitKey?: string
    interactionEnabled?: boolean
    officeMarker?: OfficeMarker | null
    initialMapStyle?: MapStyle
}

type MappedProperty = {
    property: Property
    latLng: [number, number]
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

const QUICK_FILTERS: Array<{ value: QuickFilter; label: string }> = [
    { value: 'all', label: 'Todos' },
    { value: 'exclusive', label: 'Exclusivos' },
    { value: 'waterfront', label: 'Frente mar' },
    { value: 'launch', label: 'Lançamentos' },
    { value: 'premium', label: 'Alto padrão' },
]

const MAP_STYLES: Array<{ value: MapStyle; label: string; icon: 'sparkles' | 'satellite' | 'layers' }> = [
    { value: 'luxury', label: 'Luxo', icon: 'sparkles' },
    { value: 'satellite', label: 'Satélite', icon: 'satellite' },
    { value: 'classic', label: 'Claro', icon: 'layers' },
]
const AGENCY_MARKER_ICON_URL = 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/icon.png'
const AGENCY_CARD_IMAGE_URL = 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/unnamed.webp'

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

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[char] || char))
}

function MapUpdater({ points, refitKey = '' }: { points: [number, number][], refitKey?: string }) {
    const map = useMap()
    const lastPointsKey = useRef('')

    const pointsKey = useMemo(
        () => `${refitKey}::${points.map(([lat, lng]) => `${lat.toFixed(6)},${lng.toFixed(6)}`).join('|')}`,
        [points, refitKey]
    )

    useEffect(() => {
        if (lastPointsKey.current === pointsKey) {
            return
        }

        lastPointsKey.current = pointsKey

        if (points.length > 0) {
            map.invalidateSize({ animate: false })

            if (points.length === 1) {
                map.flyTo(points[0], 15, { duration: 0.65 })
                return
            }

            const bounds = L.latLngBounds(points.map(([lat, lng]) => L.latLng(lat, lng)))
            map.flyToBounds(bounds, { padding: [64, 64], maxZoom: 15, duration: 0.75 })
        }
    }, [map, points, pointsKey])

    useEffect(() => {
        const resizeObserver = new ResizeObserver(() => {
            map.invalidateSize({ animate: false })
        })
        const container = map.getContainer()
        resizeObserver.observe(container)

        const timers = [100, 300, 600, 1200].map(delay =>
            setTimeout(() => {
                map.invalidateSize({ animate: false })
            }, delay)
        )

        return () => {
            resizeObserver.disconnect()
            timers.forEach(clearTimeout)
        }
    }, [map, points])

    return null
}

function BoundsEmitter({ onBoundsChange }: { onBoundsChange?: (bounds: MapBounds) => void }) {
    const map = useMap()

    useEffect(() => {
        if (!onBoundsChange) return

        const emitBounds = () => {
            const b = map.getBounds()
            onBoundsChange({
                north: b.getNorth(),
                south: b.getSouth(),
                east: b.getEast(),
                west: b.getWest(),
            })
        }

        map.on('moveend', emitBounds)
        map.on('zoomend', emitBounds)

        return () => {
            map.off('moveend', emitBounds)
            map.off('zoomend', emitBounds)
        }
    }, [map, onBoundsChange])

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

function buildClusters(items: MappedProperty[], map: L.Map, zoom: number): ClusterItem[] {
    if (zoom >= 15) return items.map(item => ({ kind: 'single', item }))

    const gridSize = zoom < 11 ? 92 : zoom < 13 ? 78 : 64
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

function createClusterIcon(count: number, minPrice: number | null) {
    const priceText = formatFullPrice(minPrice)

    return L.divIcon({
        className: 'premium-cluster-marker',
        html: `<div class="cluster-orbit">
            <span class="cluster-count">${count}</span>
            <span class="cluster-label">${priceText}</span>
        </div>`,
        iconSize: [136, 58],
        iconAnchor: [68, 29],
    })
}

function ClusterLayer({
    items,
    hoveredPropertyId,
    createIcon,
    onMarkerHover,
}: {
    items: MappedProperty[]
    hoveredPropertyId?: string | null
    createIcon: (property: Property, isHovered: boolean) => L.DivIcon
    onMarkerHover?: (id: string | null) => void
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

    const clusters = useMemo(() => buildClusters(items, map, zoom), [items, map, zoom])

    return (
        <>
            {clusters.map(cluster => {
                if (cluster.kind === 'cluster') {
                    return (
                        <Marker
                            key={`cluster-${cluster.id}`}
                            position={cluster.latLng}
                            icon={createClusterIcon(cluster.items.length, cluster.minPrice)}
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
                const isHovered = hoveredPropertyId === property.id

                return (
                    <Marker
                        key={property.id}
                        position={latLng}
                        icon={createIcon(property, isHovered)}
                        zIndexOffset={isHovered ? 1000 : 0}
                        eventHandlers={{
                            mouseover: (e: any) => {
                                e.target.openPopup()
                                onMarkerHover?.(property.id)
                            },
                            mouseout: (e: any) => {
                                e.target.closePopup()
                                onMarkerHover?.(null)
                            },
                            click: (e: any) => {
                                e.target.openPopup()
                                map.flyTo(latLng, Math.max(map.getZoom(), 15), { duration: 0.5 })
                            },
                        }}
                    >
                        <Popup className="property-popup">
                            <PropertyPopup property={property} />
                        </Popup>
                    </Marker>
                )
            })}
        </>
    )
}

function PropertyPopup({ property }: { property: Property }) {
    const displayTitle = replaceItajaiWithPraiaBrava(property.title)
    const detailsHref = propertyDetailsPath(property.id)
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
    onMarkerHover,
    onBoundsChange,
    refitKey,
    interactionEnabled = true,
    officeMarker = null,
    initialMapStyle = 'satellite',
}: PropertyMapProps) {
    const [mapStyle, setMapStyle] = useState<MapStyle>(initialMapStyle)
    const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
    const [mobileControlsOpen, setMobileControlsOpen] = useState(false)

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
    const mapPoints = useMemo(() => {
        const points = filteredProperties.map(item => item.latLng)
        return officeMarker ? [officeMarker.latLng, ...points] : points
    }, [filteredProperties, officeMarker])
    const defaultCenter: [number, number] = [-26.9446, -48.6292]
    const mapWatermarkLabel = filteredProperties.length > 0
        ? `${filteredProperties.length} no mapa`
        : officeMarker
            ? officeMarker.title
            : '0 no mapa'

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

    const handleMapStyleChange = (style: MapStyle) => {
        const option = MAP_STYLES.find(item => item.value === style)
        setMapStyle(style)
        void trackEvent('property_map_style_changed', {
            style,
            style_label: option?.label || style,
        })
    }

    const createIcon = useCallback((property: Property, isHovered: boolean) => {
        const priceText = formatFullPrice(property.price)
        const badgeClass = property.exclusive ? ' marker-wrap--exclusive' : ''

        return L.divIcon({
            className: 'custom-price-marker',
            html: `<div class="marker-wrap ${isHovered ? 'marker-wrap--active' : ''}${badgeClass}">
                <span class="marker-pin"><span class="marker-glyph"></span></span>
                <span class="marker-price">${priceText}</span>
            </div>`,
            iconSize: [136, 78],
            iconAnchor: [68, 74],
        })
    }, [])

    const officeIcon = useMemo(() => {
        if (!officeMarker) return null

        const subtitle = officeMarker.subtitle || 'Imobiliaria'

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

    return (
        <div className={`map-shell map-style-${mapStyle}${mobileControlsOpen ? ' map-mobile-filters-open' : ''}`}>
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossOrigin="" />

            <div className="map-topbar" role="group" aria-label="Filtros rápidos do mapa">
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

            <div className="map-style-control" role="group" aria-label="Estilo do mapa">
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
                    aria-label="Mais filtro"
                    aria-expanded={mobileControlsOpen}
                    onClick={() => setMobileControlsOpen(isOpen => !isOpen)}
                >
                    <SlidersHorizontal size={14} />
                    <span>Mais filtro</span>
                </button>
            </div>

            <div className={`map-mobile-filter-panel${mobileControlsOpen ? ' is-open' : ''}`} role="group" aria-label="Mais filtros do mapa">
                <div className="map-mobile-filter-grid">
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

            <div className="map-watermark">
                <Building2 size={14} />
                <span>{mapWatermarkLabel}</span>
            </div>

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
                    filter: saturate(0.86) contrast(1.06) sepia(0.08) hue-rotate(352deg);
                }
                .map-style-classic .leaflet-tile-pane {
                    filter: saturate(0.9) contrast(1.02);
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
                    right: 74px;
                    z-index: 600;
                    display: flex;
                    gap: 8px;
                    overflow-x: auto;
                    padding-bottom: 4px;
                    scrollbar-width: none;
                }
                .map-topbar::-webkit-scrollbar { display: none; }
                .map-topbar button,
                .map-style-control button {
                    border: 1px solid rgba(232,220,199,0.14);
                    background: rgba(18, 18, 18, 0.76);
                    color: #e8dcc7;
                    border-radius: 999px;
                    cursor: pointer;
                    font: 800 0.72rem/1 'Inter', sans-serif;
                    white-space: nowrap;
                    backdrop-filter: blur(16px);
                    box-shadow: 0 10px 24px rgba(0,0,0,0.18);
                    transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
                }
                .map-topbar button {
                    height: 34px;
                    padding: 0 13px;
                }
                .map-topbar button:hover,
                .map-style-control button:hover {
                    transform: translateY(-1px);
                }
                .map-topbar button.active,
                .map-style-control button.active {
                    background: linear-gradient(135deg, #dfc18e, #b8945f);
                    color: #101010;
                    border-color: rgba(255,255,255,0.28);
                }
                .map-style-control {
                    position: absolute;
                    right: 14px;
                    top: 58px;
                    z-index: 610;
                    display: flex;
                    flex-direction: column;
                    gap: 7px;
                }
                .map-style-control button {
                    display: inline-flex;
                    align-items: center;
                    justify-content: flex-start;
                    gap: 7px;
                    height: 36px;
                    min-width: 102px;
                    padding: 0 12px;
                    border-radius: 10px;
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
                .map-shell .leaflet-popup-pane {
                    z-index: 1200;
                }

                .custom-price-marker,
                .premium-cluster-marker,
                .agency-location-marker {
                    background: none !important;
                    border: none !important;
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
                @media (max-width: 720px) {
                    .map-topbar {
                        display: none;
                    }
                    .map-style-control {
                        display: none;
                    }
                    .map-mobile-style-stack {
                        display: flex;
                    }
                    .map-mobile-filter-panel.is-open {
                        display: grid;
                    }
                    .map-mobile-filters-open .leaflet-control-zoom {
                        display: none !important;
                    }
                    .map-watermark {
                        display: none;
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
                center={defaultCenter}
                zoom={14}
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
                        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap'
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        maxZoom={20}
                    />
                )}
                {mapStyle === 'classic' && (
                    <TileLayer
                        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap'
                        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
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

                <MapUpdater points={mapPoints} refitKey={refitKey} />
                <MapInteractionController enabled={interactionEnabled} />
                <BoundsEmitter onBoundsChange={onBoundsChange} />
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
                    createIcon={createIcon}
                    onMarkerHover={onMarkerHover}
                />
            </MapContainer>
        </div>
    )
}
