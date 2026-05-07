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
            background: '#161618',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#78797a',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '0.85rem',
            letterSpacing: '0.1em'
        }}>
            <span>Carregando mapa...</span>
        </div>
    )
}

interface MapSearchProps {
    properties: any[]
    hoveredPropertyId?: string | null
    onMarkerHover?: (id: string | null) => void
}

export default function MapSearch({ properties, hoveredPropertyId, onMarkerHover }: MapSearchProps) {
    return (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <PropertyMap
                properties={properties}
                hoveredPropertyId={hoveredPropertyId}
                onMarkerHover={onMarkerHover}
            />
        </div>
    )
}
