'use client'

import dynamic from 'next/dynamic'

const PropertyMap = dynamic(
    () => import('./PropertyMap'),
    {
        ssr: false,
        loading: () => <MapSkeleton message="Carregando mapa..." />,
    }
)

function MapSkeleton({ message }: { message: string }) {
    return (
        <div style={{
            width: '100%',
            height: '100%',
            minHeight: 'inherit',
            background: '#161618',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#78797a',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '0.85rem',
            letterSpacing: '0.1em',
            flexDirection: 'column',
            gap: '12px',
        }}>
            <div style={{
                width: '32px',
                height: '32px',
                border: '3px solid rgba(233,193,118,0.2)',
                borderTopColor: '#e9c176',
                borderRadius: '50%',
                animation: 'map-spin 0.8s linear infinite',
            }} />
            <span>{message}</span>
            <style>{`
                @keyframes map-spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
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
    refitKey?: string
}

export default function MapSearch({ properties, hoveredPropertyId, onMarkerHover, onBoundsChange, refitKey }: MapSearchProps) {
    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 'inherit', overflow: 'hidden' }}>
            <PropertyMap
                properties={properties}
                hoveredPropertyId={hoveredPropertyId}
                onMarkerHover={onMarkerHover}
                onBoundsChange={onBoundsChange}
                refitKey={refitKey}
            />
        </div>
    )
}
