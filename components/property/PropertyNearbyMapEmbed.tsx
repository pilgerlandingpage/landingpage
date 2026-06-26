'use client'

import dynamic from 'next/dynamic'
import type { LatLngTuple } from '@/components/property/usePropertyNearbyBenefits'
import { usePropertyNearbyBenefits } from '@/components/property/usePropertyNearbyBenefits'

type Props = {
    propertyId: string
    title: string
    latLng: LatLngTuple | null
    locationLabel?: string | null
}

const PropertyNearbyRealMap = dynamic(() => import('@/components/property/PropertyNearbyRealMap'), {
    ssr: false,
    loading: () => (
        <div
            className="plp-nearby-map-shell is-loading"
            aria-label="Carregando mapa do entorno"
        />
    ),
})

export default function PropertyNearbyMapEmbed({
    propertyId,
    title,
    latLng,
    locationLabel,
}: Props) {
    const { loading, safeLatLng, visibleResults } = usePropertyNearbyBenefits({
        propertyId,
        title,
        latLng,
        locationLabel,
        shouldLoad: true,
        trackLoad: false,
    })

    if (!safeLatLng) return null

    return (
        <PropertyNearbyRealMap
            origin={safeLatLng}
            results={visibleResults}
            loading={loading}
        />
    )
}
