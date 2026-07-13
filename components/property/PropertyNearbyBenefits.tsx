'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Anchor, Building2, GraduationCap, Landmark, Stethoscope, Utensils, Waves } from 'lucide-react'
import type { NearbyBenefitResult, LatLngTuple } from '@/components/property/usePropertyNearbyBenefits'
import {
    formatNearbyBenefitDistance,
    usePropertyNearbyBenefits,
} from '@/components/property/usePropertyNearbyBenefits'
import { NEARBY_BENEFIT_LAYERS, type NearbyBenefitLayer, type NearbyBenefitConfig } from '@/lib/locations/nearby-benefits'

type Props = {
    propertyId: string
    title: string
    latLng: LatLngTuple | null
    locationLabel?: string | null
    variant?: 'mobile' | 'desktop'
    className?: string
    kicker?: string
    heading?: string
    summaryLabel?: string
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

function BenefitLayerIcon({ layer }: { layer: NearbyBenefitLayer }) {
    if (layer === 'beach') return <Waves size={15} />
    if (layer === 'school') return <GraduationCap size={15} />
    if (layer === 'dining') return <Utensils size={15} />
    if (layer === 'bank') return <Landmark size={15} />
    if (layer === 'health') return <Stethoscope size={15} />
    if (layer === 'marina') return <Anchor size={15} />
    return <Building2 size={15} />
}

function NearbyBenefitSummaryItem({ item }: { item: NearbyBenefitResult }) {
    return (
        <article className="plp-nearby-summary-item" style={{ '--benefit-color': item.color } as CSSProperties}>
            <span>
                <BenefitLayerIcon layer={item.layer} />
            </span>
            <div>
                <strong>{item.label}</strong>
                <small>{formatNearbyBenefitDistance(item.distanceMeters)}</small>
            </div>
        </article>
    )
}

function NearbyBenefitSummaryFallback({ item, loading }: { item: NearbyBenefitConfig; loading: boolean }) {
    return (
        <article className="plp-nearby-summary-item" style={{ '--benefit-color': item.color } as CSSProperties}>
            <span>
                <BenefitLayerIcon layer={item.value} />
            </span>
            <div>
                <strong>{item.label}</strong>
                <small>{loading ? 'Buscando...' : 'No entorno'}</small>
            </div>
        </article>
    )
}

export default function PropertyNearbyBenefits({
    propertyId,
    title,
    latLng,
    locationLabel,
    variant = 'desktop',
    className = '',
    kicker = 'Entorno premium',
    heading = 'Benefícios ao redor do imóvel.',
    summaryLabel = 'Benefícios próximos ao imóvel',
}: Props) {
    const rootRef = useRef<HTMLDivElement>(null)
    const [shouldLoad, setShouldLoad] = useState(false)
    const { loading, safeLatLng, visibleResults } = usePropertyNearbyBenefits({
        propertyId,
        title,
        latLng,
        locationLabel,
        shouldLoad,
    })

    useEffect(() => {
        const element = rootRef.current
        if (!element) return

        if (typeof window.IntersectionObserver === 'undefined') {
            const fallbackTimer = globalThis.setTimeout(() => setShouldLoad(true), 0)
            return () => globalThis.clearTimeout(fallbackTimer)
        }

        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) {
                setShouldLoad(true)
                observer.disconnect()
            }
        }, { rootMargin: '260px 0px' })

        observer.observe(element)
        return () => observer.disconnect()
    }, [])

    if (!safeLatLng) return null

    const fallbackSummaryItems = NEARBY_BENEFIT_LAYERS
        .filter(item => ['beach', 'school', 'dining', 'bank', 'health', 'marina'].includes(item.value))
        .slice(0, 6)

    return (
        <div
            ref={rootRef}
            className={`plp-nearby-benefits plp-nearby-benefits--${variant} ${className}`.trim()}
            aria-live="polite"
        >
            <div className="plp-nearby-benefits-head">
                <span className="plp-kicker">{kicker}</span>
                <h3>{heading}</h3>
            </div>

            <div className="plp-nearby-map-layout">
                <div className="plp-nearby-summary-row" aria-label={summaryLabel}>
                    {visibleResults.length > 0
                        ? visibleResults.map(item => (
                            <NearbyBenefitSummaryItem item={item} key={`summary-${item.layer}-${item.name}`} />
                        ))
                        : fallbackSummaryItems.map(item => (
                            <NearbyBenefitSummaryFallback item={item} loading={loading} key={`summary-fallback-${item.value}`} />
                        ))}
                </div>
                <PropertyNearbyRealMap origin={safeLatLng} results={visibleResults} loading={loading} />
            </div>
        </div>
    )
}
