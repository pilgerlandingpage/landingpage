'use client'

import { useState, useCallback, useMemo } from 'react'
import MapSearch from './MapSearch'
import SearchViews from './SearchViews'
import PropertyCard from './PropertyCard'

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
    const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null)
    const [mapHoveredId, setMapHoveredId] = useState<string | null>(null)
    const [mapBounds, setMapBounds] = useState<MapBounds | null>(null)

    const handleCardHover = useCallback((id: string | null) => {
        setHoveredPropertyId(id)
    }, [])

    const handleMarkerHover = useCallback((id: string | null) => {
        setMapHoveredId(id)
    }, [])

    const handleBoundsChange = useCallback((bounds: MapBounds) => {
        setMapBounds(bounds)
    }, [])

    // Filter properties to those visible in current map viewport
    const visibleProperties = useMemo(() => {
        if (!mapBounds) return properties

        return properties.filter(p => {
            // If property has no coordinates, always show it
            if (!p.latitude || !p.longitude) return true
            // Check if within bounds
            return (
                p.latitude >= mapBounds.south &&
                p.latitude <= mapBounds.north &&
                p.longitude >= mapBounds.west &&
                p.longitude <= mapBounds.east
            )
        })
    }, [properties, mapBounds])

    const visibleCount = visibleProperties.length
    const totalCount = properties.length

    return (
        <SearchViews
            map={
                <MapSearch
                    properties={propertiesWithCoords}
                    hoveredPropertyId={hoveredPropertyId}
                    onMarkerHover={handleMarkerHover}
                    onBoundsChange={handleBoundsChange}
                />
            }
        >
            <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-medium text-[#5a5a5a]">
                    {mapBounds && visibleCount < totalCount
                        ? <><strong style={{ color: '#b8945f', fontSize: '1.1em' }}>{visibleCount}</strong> imóveis nesta área <span style={{ color: '#bbb', fontWeight: 400 }}>({totalCount} total)</span></>
                        : <><strong style={{ fontSize: '1.1em' }}>{totalCount}</strong> imóveis encontrados</>
                    }
                </p>
            </div>

            {visibleProperties.length === 0 ? (
                <div className="py-20 text-center text-[#999]">
                    Nenhum imóvel encontrado nesta área. Tente expandir o mapa.
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                    {visibleProperties.map((property: any) => (
                        <div
                            key={property.id}
                            onMouseEnter={() => handleCardHover(property.id)}
                            onMouseLeave={() => handleCardHover(null)}
                            style={{
                                transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
                                transform: mapHoveredId === property.id ? 'scale(1.02)' : 'scale(1)',
                                boxShadow: mapHoveredId === property.id ? '0 0 0 2px #e9c176, 0 8px 32px rgba(233,193,118,0.2)' : 'none',
                                borderRadius: '12px',
                                zIndex: mapHoveredId === property.id ? 10 : 'auto',
                                position: 'relative',
                            }}
                        >
                            <PropertyCard
                                property={property}
                                landingPageSlug={lpMap[property.id]}
                            />
                        </div>
                    ))}
                </div>
            )}

            <footer className="mt-12 border-t border-[#e8e5e0] py-8 text-center text-xs text-[#999]">
                © {new Date().getFullYear()} Guilherme Pilger. Corretor de Imóveis.
            </footer>
        </SearchViews>
    )
}
