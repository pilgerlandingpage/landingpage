'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { Layers, Satellite, Sparkles } from 'lucide-react'
import { buildPropertyFeedCopy } from '@/lib/properties/feed-copy'

type PropertyFeedMapStyle = 'luxury' | 'satellite' | 'classic'

type PropertyFeedMapProperty = {
    id: string
    title: string
    description?: string | null
    seo_title?: string | null
    seo_description?: string | null
    city?: string | null
    state?: string | null
    neighborhood?: string | null
    price?: number | null
    bedrooms?: number | null
    suites?: number | null
    area_m2?: number | null
    area_private_m2?: number | null
    property_type?: string | null
    exclusive?: boolean | null
}

type Props = {
    property: PropertyFeedMapProperty
    latLng: [number, number]
}

const PROPERTY_FEED_MAP_STYLES: Array<{ value: PropertyFeedMapStyle; label: string; icon: 'sparkles' | 'satellite' | 'layers' }> = [
    { value: 'luxury', label: 'Luxo', icon: 'sparkles' },
    { value: 'satellite', label: 'Satélite', icon: 'satellite' },
    { value: 'classic', label: 'Claro', icon: 'layers' },
]

function formatPrice(price?: number | null) {
    if (!price) return 'Sob consulta'
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
    }).format(price)
}

function compactPrice(price?: number | null) {
    if (!price) return 'Sob consulta'
    return formatPrice(price)
}

function locationLabel(property: PropertyFeedMapProperty) {
    return [property.neighborhood, property.city, property.state].filter(Boolean).join(' - ') || 'Litoral catarinense'
}

function MapStyleIcon({ icon }: { icon: 'sparkles' | 'satellite' | 'layers' }) {
    if (icon === 'satellite') return <Satellite size={14} />
    if (icon === 'layers') return <Layers size={14} />
    return <Sparkles size={14} />
}

function PropertyFeedMapUpdater({ center }: { center: [number, number] }) {
    const map = useMap()

    useEffect(() => {
        const timers = [60, 220, 520].map(delay =>
            window.setTimeout(() => {
                map.invalidateSize({ animate: false })
            }, delay)
        )

        map.flyTo(center, 16, { duration: 0.55 })

        return () => {
            timers.forEach(window.clearTimeout)
        }
    }, [center, map])

    return null
}

export default function PropertyFeedMap({ property, latLng }: Props) {
    const copy = buildPropertyFeedCopy(property)
    const [mapStyle, setMapStyle] = useState<PropertyFeedMapStyle>('luxury')
    const markerIcon = useMemo(() => L.divIcon({
        className: 'property-feed-map-marker',
        html: `<div class="property-feed-map-marker-wrap${property.exclusive ? ' is-exclusive' : ''}">
            <span class="property-feed-map-pin"><span></span></span>
            <strong>${compactPrice(property.price)}</strong>
        </div>`,
        iconSize: [132, 76],
        iconAnchor: [66, 70],
        popupAnchor: [0, -62],
    }), [property.exclusive, property.price])

    return (
        <div className={`property-feed-map-shell map-style-${mapStyle}`} aria-label={`Mapa de ${copy.title}`}>
            <div className="property-feed-map-style-control" aria-label="Estilo do mapa">
                {PROPERTY_FEED_MAP_STYLES.map(style => (
                    <button
                        key={style.value}
                        type="button"
                        className={mapStyle === style.value ? 'active' : ''}
                        onClick={() => setMapStyle(style.value)}
                    >
                        <MapStyleIcon icon={style.icon} />
                        <span>{style.label}</span>
                    </button>
                ))}
            </div>

            <MapContainer
                center={latLng}
                zoom={16}
                zoomControl={false}
                className="property-feed-map-canvas"
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
                <PropertyFeedMapUpdater center={latLng} />
                <Marker position={latLng} icon={markerIcon}>
                    <Popup className="property-feed-map-popup">
                        <div className="property-feed-map-popup-content">
                            <strong>{copy.title}</strong>
                            <span>{locationLabel(property)}</span>
                            <b>{formatPrice(property.price)}</b>
                        </div>
                    </Popup>
                </Marker>
            </MapContainer>
        </div>
    )
}
