'use client'

import { useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, LayersControl } from 'react-leaflet'
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
    hoveredPropertyId?: string | null
    onMarkerHover?: (id: string | null) => void
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


export default function PropertyMap({ properties, hoveredPropertyId, onMarkerHover }: PropertyMapProps) {
    // Filter properties with valid coordinates
    const validProperties = properties.filter(p => p.latitude && p.longitude)

    // Default center (Florianópolis / Santa Catarina region approx)
    const defaultCenter: [number, number] = [-27.594870, -48.548220]

    // Create marker icon with custom pin image + price label
    const createIcon = useCallback((property: Property, isHovered: boolean) => {
        const priceText = property.price
            ? new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short', style: 'currency', currency: 'BRL' }).format(property.price)
            : 'Consulte'

        return L.divIcon({
            className: 'custom-price-marker',
            html: `<div class="marker-wrap ${isHovered ? 'marker-wrap--active' : ''}">
                <img src="https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/icon.png" class="marker-icon" alt="" />
                <span class="marker-price">${priceText}</span>
            </div>`,
            iconSize: [56, 72],
            iconAnchor: [28, 72]
        })
    }, [])

    return (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossOrigin="" />

            <style>{`
                /* ===== LAYER CONTROL — Premium Dark ===== */
                .leaflet-control-layers {
                    border: none !important;
                    border-radius: 12px !important;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.4) !important;
                    background: rgba(22,22,24,0.92) !important;
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    padding: 0 !important;
                    overflow: hidden;
                }
                .leaflet-control-layers-toggle {
                    width: 38px !important;
                    height: 38px !important;
                    background-size: 20px 20px !important;
                    background-position: center !important;
                    border-radius: 10px !important;
                    filter: invert(1) brightness(0.85);
                }
                .leaflet-control-layers-expanded {
                    padding: 10px 16px 10px 12px !important;
                }
                .leaflet-control-layers-base label {
                    display: flex !important;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 4px;
                    margin: 0 !important;
                    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
                    font-size: 0.8rem;
                    font-weight: 500;
                    color: #c4c7c7;
                    cursor: pointer;
                    border-radius: 6px;
                    transition: all 0.2s;
                }
                .leaflet-control-layers-base label:hover {
                    background: rgba(233,193,118,0.12);
                    color: #e9c176;
                }
                .leaflet-control-layers-base label span {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .leaflet-control-layers-base input[type="radio"] {
                    accent-color: #e9c176;
                    width: 14px;
                    height: 14px;
                    margin: 0;
                }
                .leaflet-control-layers-separator {
                    display: none;
                }

                /* ===== ZOOM CONTROL — Dark ===== */
                .leaflet-control-zoom {
                    border: none !important;
                    border-radius: 12px !important;
                    overflow: hidden;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.4) !important;
                }
                .leaflet-control-zoom a {
                    background: rgba(22,22,24,0.92) !important;
                    color: #c4c7c7 !important;
                    border: none !important;
                    border-bottom: 1px solid rgba(68,71,72,0.3) !important;
                    font-size: 18px !important;
                    width: 38px !important;
                    height: 38px !important;
                    line-height: 38px !important;
                    transition: all 0.2s;
                    backdrop-filter: blur(16px);
                }
                .leaflet-control-zoom a:hover {
                    background: rgba(233,193,118,0.15) !important;
                    color: #e9c176 !important;
                }
                .leaflet-control-zoom a:last-child {
                    border-bottom: none !important;
                }

                /* ===== CUSTOM ICON MARKERS ===== */
                .custom-price-marker { background: none !important; border: none !important; }
                .marker-wrap {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 2px;
                    cursor: pointer;
                    transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
                    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));
                }
                .marker-icon {
                    width: 36px;
                    height: 36px;
                    object-fit: contain;
                    transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), filter 0.3s;
                }
                .marker-price {
                    background: rgba(14,14,14,0.92);
                    border: 1px solid rgba(233,193,118,0.4);
                    color: #e9c176;
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 0.65rem;
                    font-weight: 700;
                    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
                    white-space: nowrap;
                    text-align: center;
                    letter-spacing: 0.02em;
                    line-height: 1.4;
                }
                .marker-wrap:hover,
                .marker-wrap--active {
                    transform: scale(1.25);
                    filter: drop-shadow(0 6px 20px rgba(233,193,118,0.5));
                    z-index: 1000 !important;
                }
                .marker-wrap:hover .marker-price,
                .marker-wrap--active .marker-price {
                    background: #e9c176;
                    color: #0a0a0a;
                    border-color: #e9c176;
                }

                /* ===== POPUP — Premium Dark ===== */
                .property-popup .leaflet-popup-content-wrapper {
                    border-radius: 16px;
                    padding: 0;
                    overflow: hidden;
                    box-shadow: 0 8px 40px rgba(0,0,0,0.5);
                    background: #161618;
                    border: 1px solid rgba(68,71,72,0.3);
                }
                .property-popup .leaflet-popup-content {
                    margin: 0;
                    min-width: 240px;
                }
                .property-popup .leaflet-popup-tip {
                    background: #161618;
                    border: 1px solid rgba(68,71,72,0.3);
                    border-top: none;
                    border-left: none;
                }
                .popup-content { font-family: 'Plus Jakarta Sans', 'Inter', sans-serif; }
                .popup-img-wrapper {
                    width: 100%;
                    height: 140px;
                    overflow: hidden;
                    position: relative;
                }
                .popup-img-wrapper::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 0; right: 0;
                    height: 40px;
                    background: linear-gradient(to top, #161618, transparent);
                }
                .popup-img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .popup-info { padding: 14px 16px; }
                .popup-title {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #e4e2e2;
                    margin-bottom: 6px;
                    font-family: 'Noto Serif', 'Georgia', serif;
                    line-height: 1.3;
                }
                .popup-price {
                    font-size: 1rem;
                    font-weight: 700;
                    color: #e9c176;
                    margin-bottom: 10px;
                    font-family: 'Plus Jakarta Sans', sans-serif;
                }
                .popup-specs {
                    display: flex;
                    gap: 12px;
                    font-size: 0.75rem;
                    color: #78797a;
                    margin-bottom: 14px;
                }
                .popup-specs span {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .popup-specs svg { stroke: #78797a; }
                .popup-link {
                    display: block;
                    text-align: center;
                    padding: 10px;
                    background: #e9c176;
                    color: #0a0a0a;
                    font-size: 0.72rem;
                    font-weight: 700;
                    letter-spacing: 0.15em;
                    text-transform: uppercase;
                    border-radius: 8px;
                    text-decoration: none;
                    transition: opacity 0.2s;
                }
                .popup-link:hover { opacity: 0.85; }

                /* Close button */
                .property-popup .leaflet-popup-close-button {
                    color: #78797a !important;
                    font-size: 20px !important;
                    width: 28px !important;
                    height: 28px !important;
                    top: 6px !important;
                    right: 6px !important;
                    background: rgba(14,14,14,0.6);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10;
                }
                .property-popup .leaflet-popup-close-button:hover {
                    color: #e4e2e2 !important;
                }

                /* Attribution dark */
                .leaflet-control-attribution {
                    background: rgba(14,14,14,0.7) !important;
                    color: #555 !important;
                    font-size: 9px !important;
                }
                .leaflet-control-attribution a { color: #78797a !important; }
            `}</style>

            <MapContainer
                center={defaultCenter}
                zoom={10}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#161618' }}
            >
                <LayersControl position="topright">
                    {/* Dark Mode — Default */}
                    <LayersControl.BaseLayer checked name="🌙 Noturno">
                        <TileLayer
                            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        />
                    </LayersControl.BaseLayer>

                    {/* Google Maps - Satellite Hybrid */}
                    <LayersControl.BaseLayer name="🛰️ Satélite">
                        <TileLayer
                            attribution='&copy; Google Maps'
                            url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                            maxZoom={21}
                            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                        />
                    </LayersControl.BaseLayer>

                    {/* Google Maps - Standard */}
                    <LayersControl.BaseLayer name="🗺️ Padrão">
                        <TileLayer
                            attribution='&copy; Google Maps'
                            url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                            maxZoom={21}
                            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                        />
                    </LayersControl.BaseLayer>

                    {/* Google Maps - Terrain */}
                    <LayersControl.BaseLayer name="⛰️ Relevo">
                        <TileLayer
                            attribution='&copy; Google Maps'
                            url="https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}"
                            maxZoom={21}
                            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                        />
                    </LayersControl.BaseLayer>
                </LayersControl>

                <MapUpdater properties={validProperties} />

                {validProperties.map(property => {
                    const isHovered = hoveredPropertyId === property.id
                    return (
                        <Marker
                            key={property.id}
                            position={[property.latitude!, property.longitude!]}
                            icon={createIcon(property, isHovered)}
                            zIndexOffset={isHovered ? 1000 : 0}
                            eventHandlers={{
                                mouseover: (e) => {
                                    e.target.openPopup();
                                    onMarkerHover?.(property.id);
                                },
                                mouseout: (e) => {
                                    e.target.closePopup();
                                    onMarkerHover?.(null);
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
                                                ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(property.price)
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
                    )
                })}
            </MapContainer>
        </div>
    )
}
