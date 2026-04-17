'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, LayersControl, LayerGroup } from 'react-leaflet'
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
    slug?: string
}

interface PropertyMapProps {
    properties: Property[]
}

// Component to update map center when properties change
function MapUpdater({ properties }: { properties: Property[] }) {
    const map = useMap()

    useEffect(() => {
        if (properties.length > 0) {
            const validPoints = properties.filter(p => p.latitude && p.longitude).map(p => L.latLng(p.latitude!, p.longitude!))

            if (validPoints.length > 0) {
                const bounds = L.latLngBounds(validPoints)
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 })
            }
        }
    }, [properties, map])

    useEffect(() => {
        // Fix for grey tiles when Leaflet initializes before CSS layout settles
        const resizeObserver = new ResizeObserver(() => {
            map.invalidateSize({ animate: false })
        })
        const container = map.getContainer()
        resizeObserver.observe(container)

        // Staggered invalidateSize calls to catch all CSS layout phases
        const timers = [100, 300, 600, 1200].map(delay =>
            setTimeout(() => {
                map.invalidateSize({ animate: false })
                // Re-fit bounds if we have markers
                if (properties.length > 0) {
                    const validPoints = properties
                        .filter(p => p.latitude && p.longitude)
                        .map(p => L.latLng(p.latitude!, p.longitude!))
                    if (validPoints.length > 0) {
                        map.fitBounds(L.latLngBounds(validPoints), { padding: [50, 50], maxZoom: 16 })
                    }
                }
            }, delay)
        )

        return () => {
            resizeObserver.disconnect()
            timers.forEach(clearTimeout)
        }
    }, [map, properties])

    return null
}


export default function PropertyMap({ properties }: PropertyMapProps) {
    // Filter properties with valid coordinates
    const validProperties = properties.filter(p => p.latitude && p.longitude)

    // Default center (Florianópolis / Santa Catarina region approx)
    const defaultCenter: [number, number] = [-27.594870, -48.548220]

    return (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossOrigin="" />

            {/* Custom styles for layer control */}
            <style>{`
                .leaflet-control-layers {
                    border: none !important;
                    border-radius: 12px !important;
                    box-shadow: 0 2px 12px rgba(0,0,0,0.12) !important;
                    background: rgba(255,255,255,0.96) !important;
                    backdrop-filter: blur(8px);
                    padding: 0 !important;
                    overflow: hidden;
                }
                .leaflet-control-layers-toggle {
                    width: 36px !important;
                    height: 36px !important;
                    background-size: 20px 20px !important;
                    background-position: center !important;
                    border-radius: 10px !important;
                }
                .leaflet-control-layers-expanded {
                    padding: 8px 14px 8px 10px !important;
                }
                .leaflet-control-layers-base label {
                    display: flex !important;
                    align-items: center;
                    gap: 6px;
                    padding: 5px 4px;
                    margin: 0 !important;
                    font-family: 'Inter', sans-serif;
                    font-size: 0.82rem;
                    font-weight: 500;
                    color: #333;
                    cursor: pointer;
                    border-radius: 6px;
                    transition: background 0.15s;
                }
                .leaflet-control-layers-base label:hover {
                    background: rgba(184,148,95,0.08);
                }
                .leaflet-control-layers-base label span {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .leaflet-control-layers-base input[type="radio"] {
                    accent-color: #b8945f;
                    width: 14px;
                    height: 14px;
                    margin: 0;
                }
                .leaflet-control-layers-separator {
                    display: none;
                }

                /* Price markers */
                .custom-price-marker { background: none; border: none; }
                .price-bubble {
                    background: #fff;
                    border: 2px solid #b8945f;
                    color: #1a1a1a;
                    padding: 4px 8px;
                    border-radius: 8px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    font-family: 'Inter', sans-serif;
                    white-space: nowrap;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                    text-align: center;
                }

                /* Popup styles */
                .property-popup .leaflet-popup-content-wrapper {
                    border-radius: 12px;
                    padding: 0;
                    overflow: hidden;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                }
                .property-popup .leaflet-popup-content {
                    margin: 0;
                    min-width: 200px;
                }
                .popup-content { font-family: 'Inter', sans-serif; }
                .popup-img-wrapper {
                    width: 100%;
                    height: 120px;
                    overflow: hidden;
                }
                .popup-img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .popup-info { padding: 10px 12px; }
                .popup-title {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #1a1a1a;
                    margin-bottom: 4px;
                    font-family: 'Inter', sans-serif;
                }
                .popup-price {
                    font-size: 0.9rem;
                    font-weight: 700;
                    color: #b8945f;
                    margin-bottom: 6px;
                }
                .popup-specs {
                    display: flex;
                    gap: 10px;
                    font-size: 0.75rem;
                    color: #666;
                    margin-bottom: 8px;
                }
                .popup-specs span {
                    display: flex;
                    align-items: center;
                    gap: 3px;
                }
                .popup-link {
                    display: block;
                    text-align: center;
                    padding: 6px;
                    background: linear-gradient(135deg, #b8945f, #d4b87a);
                    color: #0a0a0a;
                    font-size: 0.78rem;
                    font-weight: 600;
                    border-radius: 6px;
                    text-decoration: none;
                    transition: opacity 0.2s;
                }
                .popup-link:hover { opacity: 0.85; }
            `}</style>

            <MapContainer
                center={defaultCenter}
                zoom={10}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#e5e3df' }}
            >
                <LayersControl position="topright">
                    {/* Google Maps - Standard (with all POIs, businesses, etc.) */}
                    <LayersControl.BaseLayer name="🗺️ Padrão">
                        <TileLayer
                            attribution='&copy; Google Maps'
                            url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                            maxZoom={21}
                            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                        />
                    </LayersControl.BaseLayer>

                    {/* Google Maps - Satellite Hybrid (imagery + labels + POIs) */}
                    <LayersControl.BaseLayer checked name="🛰️ Satélite">
                        <TileLayer
                            attribution='&copy; Google Maps'
                            url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                            maxZoom={21}
                            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                        />
                    </LayersControl.BaseLayer>

                    {/* Google Maps - Terrain (relief + roads + labels) */}
                    <LayersControl.BaseLayer name="⛰️ Relevo">
                        <TileLayer
                            attribution='&copy; Google Maps'
                            url="https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}"
                            maxZoom={21}
                            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                        />
                    </LayersControl.BaseLayer>

                    {/* Dark Mode */}
                    <LayersControl.BaseLayer name="🌙 Noturno">
                        <TileLayer
                            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        />
                    </LayersControl.BaseLayer>
                </LayersControl>

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
                        eventHandlers={{
                            mouseover: (e) => {
                                e.target.openPopup();
                            },
                            mouseout: (e) => {
                                e.target.closePopup();
                            },
                            click: () => {
                                window.location.href = `/imovel/${property.id}`;
                            }
                        }}
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
