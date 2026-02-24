'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import Link from 'next/link'
import { Bed, Bath, Maximize } from 'lucide-react'

// Fix for default Leaflet icons in Next.js
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
    latitude: number | null
    longitude: number | null
    featured_image: string | null
    bedrooms: number | null
    bathrooms: number | null
    area_m2: number | null
    slug?: string // Optional, if we map it
}

interface PropertyMapProps {
    properties: Property[]
}

// Component to update map center when properties change
function MapUpdater({ properties }: { properties: Property[] }) {
    const map = useMap()

    useEffect(() => {
        if (properties.length > 0) {
            const bounds = L.latLngBounds(properties.map(p => [p.latitude || 0, p.longitude || 0]))
            // Filter out invalid coords (0,0 or null)
            const validPoints = properties.filter(p => p.latitude && p.longitude).map(p => L.latLng(p.latitude!, p.longitude!))

            if (validPoints.length > 0) {
                const bounds = L.latLngBounds(validPoints)
                map.fitBounds(bounds, { padding: [50, 50] })
            }
        }
    }, [properties, map])

    return null
}


export default function PropertyMap({ properties }: PropertyMapProps) {
    // Filter properties with valid coordinates
    const validProperties = properties.filter(p => p.latitude && p.longitude)

    // Default center (Florianópolis / Santa Catarina region approx)
    const defaultCenter: [number, number] = [-27.594870, -48.548220]

    return (
        <div style={{ height: '100%', width: '100%', minHeight: '400px', zIndex: 1 }}>
            <MapContainer
                center={defaultCenter}
                zoom={10}
                className="h-full w-full"
                style={{ height: '100%', width: '100%', background: '#e5e3df' }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                />

                <MapUpdater properties={validProperties} />

                {validProperties.map(property => (
                    <Marker
                        key={property.id}
                        position={[property.latitude!, property.longitude!]}
                        icon={L.divIcon({
                            className: 'custom-price-marker',
                            html: `<div class="price-bubble">
                                ${property.price
                                    ? new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short', style: 'currency', currency: 'BRL' }).format(property.price)
                                    : 'Consulte'}
                            </div>`,
                            iconSize: [60, 30],
                            iconAnchor: [30, 30]
                        })}
                    >
                        <Popup className="property-popup">
                            <div className="popup-content">
                                <div className="popup-img-wrapper">
                                    <img
                                        src={property.featured_image || 'https://via.placeholder.com/300x200'}
                                        alt={property.title}
                                        className="popup-img"
                                    />
                                </div>
                                <div className="popup-info">
                                    <h3 className="popup-title">{property.title}</h3>
                                    <div className="popup-price">
                                        {property.price
                                            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.price)
                                            : 'Sob Consulta'}
                                    </div>
                                    <div className="popup-specs">
                                        {property.bedrooms && <span>{property.bedrooms} <Bed size={12} /></span>}
                                        {property.bathrooms && <span>{property.bathrooms} <Bath size={12} /></span>}
                                        {property.area_m2 && <span>{property.area_m2}m²</span>}
                                    </div>
                                    <Link href={`/imovel/${property.id}`} className="popup-link">
                                        Ver Detalhes
                                    </Link>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    )
}
