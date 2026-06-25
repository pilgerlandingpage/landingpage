'use client'

import dynamic from 'next/dynamic'
import type { MapDrawArea, MapStyle } from './PropertyMap'
import type { MapRegionArea } from '@/lib/locations/map-regions'

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

type OfficeMarker = {
    latLng: [number, number]
    title: string
    subtitle?: string
    address: string
}

interface MapSearchProps {
    properties: any[]
    hoveredPropertyId?: string | null
    selectedPropertyId?: string | null
    drawArea?: MapDrawArea | null
    regionArea?: MapRegionArea | null
    onMarkerHover?: (id: string | null) => void
    onPropertySelect?: (property: any) => void
    onDrawAreaChange?: (area: MapDrawArea | null) => void
    onBoundsChange?: (bounds: MapBounds) => void
    onUserBoundsChange?: (bounds: MapBounds) => void
    refitKey?: string
    interactionEnabled?: boolean
    officeMarker?: OfficeMarker | null
    initialMapStyle?: MapStyle
}

export default function MapSearch({
    properties,
    hoveredPropertyId,
    selectedPropertyId,
    drawArea,
    regionArea,
    onMarkerHover,
    onPropertySelect,
    onDrawAreaChange,
    onBoundsChange,
    onUserBoundsChange,
    refitKey,
    interactionEnabled = true,
    officeMarker = null,
    initialMapStyle = 'luxury',
}: MapSearchProps) {
    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 'inherit', overflow: 'hidden' }}>
            <PropertyMap
                properties={properties}
                hoveredPropertyId={hoveredPropertyId}
                selectedPropertyId={selectedPropertyId}
                drawArea={drawArea}
                regionArea={regionArea}
                onMarkerHover={onMarkerHover}
                onPropertySelect={onPropertySelect}
                onDrawAreaChange={onDrawAreaChange}
                onBoundsChange={onBoundsChange}
                onUserBoundsChange={onUserBoundsChange}
                refitKey={refitKey}
                interactionEnabled={interactionEnabled}
                officeMarker={officeMarker}
                initialMapStyle={initialMapStyle}
            />
        </div>
    )
}
