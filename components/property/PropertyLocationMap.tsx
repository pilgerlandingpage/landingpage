'use client'

import dynamic from 'next/dynamic'
import { Home, MapPin, Navigation, Radar } from 'lucide-react'
import type { PropertyFeedMapView } from '@/components/property/PropertyFeedMap'
import { trackEvent } from '@/lib/tracking/client'

type PropertyLocationMapProperty = {
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
    allowedViews?: PropertyFeedMapView[]
    showViewControl?: boolean
    showActions?: boolean
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
        initialView,
        allowedViews,
        showViewControl = true,
        showActions = true,
    } = props
    const coordinateQuery = `${latLng[0]},${latLng[1]}`
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinateQuery)}`

    const handleExternalLocationClick = (label: string) => {
        const payload = {
            property_id: property.id,
            title: property.title,
            view: 'map',
            link_label: label,
            source: 'property_details_location_explorer',
            city: property.city || null,
            neighborhood: property.neighborhood || null,
            latitude: latLng[0],
            longitude: latLng[1],
        }

        void trackEvent('property_location_google_maps_opened', payload)
    }

    return (
        <div className="plp-location-explorer">
            <div className="plp-location-context" aria-label="Contexto da localizacao">
                <div>
                    <MapPin size={15} />
                    <span>Regiao</span>
                    <strong>{locationLabel(property)}</strong>
                </div>
                <div>
                    <Radar size={15} />
                    <span>Coordenada</span>
                    <strong>{compactCoordinate(latLng)}</strong>
                </div>
                <div>
                    <Home size={15} />
                    <span>Imovel</span>
                    <strong>{property.property_type || 'Alto padrao'}</strong>
                </div>
            </div>

            <PropertyFeedMap
                property={property}
                latLng={latLng}
                initialView={initialView}
                allowedViews={allowedViews}
                showViewControl={showViewControl}
            />

            {showActions && (
                <div className="plp-location-actions" aria-label="Acoes de localizacao">
                <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => handleExternalLocationClick('Abrir rota')}
                >
                    <Navigation size={14} />
                    Abrir rota
                </a>
                </div>
            )}
        </div>
    )
}
