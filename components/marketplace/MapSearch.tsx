'use client'

import dynamic from 'next/dynamic'


const PropertyMap = dynamic(
    () => import('./PropertyMap'),
    {
        ssr: false,
        loading: () => <MapSkeleton />
    }
)

function MapSkeleton() {
    return (
        <div style={{
            width: '100%',
            height: '100%',
            background: '#f0ede8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '0.85rem',
            letterSpacing: '0.1em'
        }}>
            <span>Carregando mapa...</span>
        </div>
    )
}

interface MapBounds {
    north: number
    south: number
    east: number
    west: number
}

interface MapSearchProps {
    properties: any[]
    hoveredPropertyId?: string | null
    onMarkerHover?: (id: string | null) => void
    onBoundsChange?: (bounds: MapBounds) => void
}

export default function MapSearch({ properties, hoveredPropertyId, onMarkerHover, onBoundsChange }: MapSearchProps) {
    return (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <PropertyMap
                properties={properties}
                hoveredPropertyId={hoveredPropertyId}
                onMarkerHover={onMarkerHover}
                onBoundsChange={onBoundsChange}
            />
        </div>
    )
}
