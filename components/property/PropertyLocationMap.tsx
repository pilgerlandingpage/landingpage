'use client'

import dynamic from 'next/dynamic'
import { Home, MapPin, Radar } from 'lucide-react'
import type { PropertyFeedMapView } from '@/components/property/PropertyFeedMap'

export type PropertyLocationMapProperty = {
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
    property: PropertyLocationMapProperty
    latLng: [number, number]
    initialView?: PropertyFeedMapView
    initialStreetInteractive?: boolean
    allowedViews?: PropertyFeedMapView[]
    showViewControl?: boolean
}

const PropertyFeedMap = dynamic(() => import('@/components/property/PropertyFeedMap'), {
    ssr: false,
    loading: () => <div className="property-feed-map-shell" aria-label="Carregando mapa" />,
})

function locationLabel(property: PropertyLocationMapProperty) {
    return [property.neighborhood, property.city, property.state].filter(Boolean).join(' - ') || 'Litoral catarinense'
}

function compactCoordinate([lat, lng]: [number, number]) {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

export default function PropertyLocationMap(props: Props) {
    const {
        property,
        latLng,
        initialView = 'luxury',
        initialStreetInteractive,
        allowedViews = ['luxury'],
        showViewControl = false,
    } = props

    return (
        <div className="plp-location-explorer">
            <div className="plp-location-context" aria-label="Contexto da localização">
                <div>
                    <MapPin size={15} />
                    <span>Região</span>
                    <strong>{locationLabel(property)}</strong>
                </div>
                <div>
                    <Radar size={15} />
                    <span>Coordenada</span>
                    <strong>{compactCoordinate(latLng)}</strong>
                </div>
                <div>
                    <Home size={15} />
                    <span>Imóvel</span>
                    <strong>{property.property_type || 'Alto padrão'}</strong>
                </div>
            </div>

            <PropertyFeedMap
                property={property}
                latLng={latLng}
                initialView={initialView}
                initialStreetInteractive={initialStreetInteractive}
                allowedViews={allowedViews}
                showViewControl={showViewControl}
            />
        </div>
    )
}
