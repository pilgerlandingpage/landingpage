'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Anchor, Building2, GraduationCap, Landmark, Stethoscope, Utensils, Waves } from 'lucide-react'
import { getNearbyBenefitConfig, type NearbyBenefitLayer } from '@/lib/locations/nearby-benefits'
import { trackEvent } from '@/lib/tracking/client'

type LatLngTuple = [number, number]

type NearbyBenefitResult = {
    layer: NearbyBenefitLayer
    label: string
    searchLabel: string
    name: string
    vicinity?: string
    latLng: LatLngTuple
    distanceMeters: number
    color: string
}

type LoadStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error'

type GooglePlacesWindow = Window & {
    google?: any
    __pilgerGooglePlacesPromise?: Promise<void>
}

type Props = {
    propertyId: string
    title: string
    latLng: LatLngTuple | null
    locationLabel?: string | null
    variant?: 'mobile' | 'desktop'
    className?: string
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

const PROPERTY_BENEFIT_LAYERS: NearbyBenefitLayer[] = [
    'beach',
    'school',
    'dining',
    'bank',
    'health',
    'marina',
]

function getGooglePlacesWindow() {
    if (typeof window === 'undefined') return null
    return window as GooglePlacesWindow
}

function hasModernPlacesLibrary(googleWindow: GooglePlacesWindow | null) {
    return Boolean(googleWindow?.google?.maps?.places?.Place)
}

function loadGooglePlacesLibrary(apiKey: string) {
    const googleWindow = getGooglePlacesWindow()
    if (!googleWindow) return Promise.reject(new Error('Google Places indisponível fora do navegador.'))
    if (hasModernPlacesLibrary(googleWindow)) return Promise.resolve()
    if (googleWindow.__pilgerGooglePlacesPromise) return googleWindow.__pilgerGooglePlacesPromise

    googleWindow.__pilgerGooglePlacesPromise = new Promise<void>((resolve, reject) => {
        const finishWithImportLibrary = (startedAt = Date.now()) => {
            if (hasModernPlacesLibrary(googleWindow)) {
                resolve()
                return
            }

            const importLibrary = googleWindow.google?.maps?.importLibrary
            if (!importLibrary) {
                if (Date.now() - startedAt < 9000) {
                    window.setTimeout(() => finishWithImportLibrary(startedAt), 90)
                    return
                }

                reject(new Error('Biblioteca Places não está disponível.'))
                return
            }

            Promise.resolve(importLibrary('places'))
                .then(() => resolve())
                .catch(() => reject(new Error('Falha ao carregar Google Places.')))
        }

        if (googleWindow.google?.maps) {
            finishWithImportLibrary()
            return
        }

        const existingScript = document.getElementById('pilger-google-maps-js') as HTMLScriptElement | null
        if (existingScript) {
            existingScript.addEventListener('load', () => finishWithImportLibrary(), { once: true })
            existingScript.addEventListener('error', () => reject(new Error('Falha ao carregar Google Maps.')), { once: true })
            return
        }

        const script = document.createElement('script')
        script.id = 'pilger-google-maps-js'
        script.async = true
        script.defer = true
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&libraries=places&language=pt-BR&region=BR&loading=async`
        script.addEventListener('load', () => finishWithImportLibrary(), { once: true })
        script.addEventListener('error', () => reject(new Error('Falha ao carregar Google Maps.')), { once: true })
        document.head.appendChild(script)
    })

    return googleWindow.__pilgerGooglePlacesPromise
}

function isValidLatLng(value: LatLngTuple | null): value is LatLngTuple {
    if (!value) return false
    const [lat, lng] = value
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

function distanceMetersBetween(origin: LatLngTuple, target: LatLngTuple) {
    const earthRadius = 6371000
    const toRad = (value: number) => (value * Math.PI) / 180
    const dLat = toRad(target[0] - origin[0])
    const dLng = toRad(target[1] - origin[1])
    const lat1 = toRad(origin[0])
    const lat2 = toRad(target[0])
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
    return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(meters: number) {
    if (!Number.isFinite(meters)) return 'Sob consulta'
    if (meters < 1000) return `${Math.max(40, Math.round(meters / 10) * 10).toLocaleString('pt-BR')} m`
    return `${(meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
}

function getPlaceDisplayName(result: any, fallback: string) {
    const displayName = result?.displayName
    if (typeof displayName === 'string') return displayName
    if (displayName?.text) return String(displayName.text)
    if (result?.name) return String(result.name)
    if (result?.formattedAddress) return String(result.formattedAddress)
    return fallback
}

function getPlaceVicinity(result: any) {
    if (result?.vicinity) return String(result.vicinity)
    if (result?.shortFormattedAddress) return String(result.shortFormattedAddress)
    if (result?.formattedAddress) return String(result.formattedAddress)
    return undefined
}

function getPlaceLatLng(result: any): LatLngTuple | null {
    const location = result?.location || result?.geometry?.location
    const lat = typeof location?.lat === 'function' ? location.lat() : Number(location?.lat)
    const lng = typeof location?.lng === 'function' ? location.lng() : Number(location?.lng)
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null
}

async function searchPlacesForLayer(googleMaps: any, layer: NearbyBenefitLayer, origin: LatLngTuple): Promise<any[]> {
    const option = getNearbyBenefitConfig(layer)
    const placesApi = googleMaps?.places
    const Place = placesApi?.Place
    if (!option || !Place) return []

    const center = { lat: origin[0], lng: origin[1] }
    const radius = Math.min(getSearchRadius(layer), 50000)
    const fields = ['id', 'displayName', 'formattedAddress', 'location', 'types', 'primaryType']

    if (option.type && typeof Place.searchNearby === 'function') {
        try {
            const request: Record<string, unknown> = {
                fields,
                locationRestriction: { center, radius },
                includedPrimaryTypes: [option.type],
                maxResultCount: 5,
            }
            const rankPreference = placesApi.SearchNearbyRankPreference?.DISTANCE
            if (rankPreference) request.rankPreference = rankPreference

            const response = await Place.searchNearby(request)
            const places = Array.isArray(response?.places) ? response.places : []
            if (places.length > 0) return places
        } catch (error) {
            console.warn(`[PropertyNearbyBenefits] searchNearby falhou para ${layer}:`, error)
        }
    }

    if (typeof Place.searchByText !== 'function') return []

    try {
        const request: Record<string, unknown> = {
            textQuery: option.keyword || option.searchLabel,
            fields,
            locationBias: center,
            language: 'pt-BR',
            region: 'br',
            maxResultCount: 5,
        }

        if (option.type) {
            request.includedType = option.type
            request.useStrictTypeFiltering = true
        }

        const response = await Place.searchByText(request)
        return Array.isArray(response?.places) ? response.places : []
    } catch (error) {
        console.warn(`[PropertyNearbyBenefits] searchByText falhou para ${layer}:`, error)
        return []
    }
}

function buildResultFromPlace(layer: NearbyBenefitLayer, result: any, origin: LatLngTuple): NearbyBenefitResult | null {
    const option = getNearbyBenefitConfig(layer)
    const target = getPlaceLatLng(result)

    if (!option || !target) return null

    return {
        layer,
        label: option.label,
        searchLabel: option.searchLabel,
        name: getPlaceDisplayName(result, option.searchLabel),
        vicinity: getPlaceVicinity(result),
        latLng: target,
        distanceMeters: distanceMetersBetween(origin, target),
        color: option.color,
    }
}

function getSearchRadius(layer: NearbyBenefitLayer) {
    if (layer === 'beach' || layer === 'marina') return 6200
    if (layer === 'health' || layer === 'shopping') return 4300
    return 3500
}

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
                <small>{formatDistance(item.distanceMeters)}</small>
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
}: Props) {
    const rootRef = useRef<HTMLDivElement>(null)
    const trackedRef = useRef(false)
    const [shouldLoad, setShouldLoad] = useState(false)
    const [status, setStatus] = useState<LoadStatus>('idle')
    const [results, setResults] = useState<NearbyBenefitResult[]>([])
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    const safeLatLng = useMemo(() => (isValidLatLng(latLng) ? latLng : null), [latLng])

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

    useEffect(() => {
        if (!shouldLoad || !safeLatLng || !apiKey) return

        let cancelled = false
        const googleMapsApiKey = apiKey
        const originLatLng = safeLatLng

        async function loadBenefits() {
            setStatus('loading')

            try {
                await loadGooglePlacesLibrary(googleMapsApiKey)
                if (cancelled) return

                const googleWindow = getGooglePlacesWindow()
                const googleMaps = googleWindow?.google?.maps
                if (!googleMaps?.places?.Place) {
                    setStatus('error')
                    return
                }

                const loadedResults = await Promise.all(PROPERTY_BENEFIT_LAYERS.map(async layer => {
                    const option = getNearbyBenefitConfig(layer)
                    if (!option) return null

                    const places = await searchPlacesForLayer(googleMaps, layer, originLatLng)
                    return places
                        .map(result => buildResultFromPlace(layer, result, originLatLng))
                        .filter((item): item is NearbyBenefitResult => Boolean(item))
                        .filter(item => item.distanceMeters <= getSearchRadius(layer) * 1.75)
                        .sort((a, b) => a.distanceMeters - b.distanceMeters)[0] || null
                }))

                if (cancelled) return

                const compactResults = loadedResults.filter((item): item is NearbyBenefitResult => Boolean(item))
                setResults(compactResults)
                setStatus(compactResults.length > 0 ? 'ready' : 'empty')

                if (compactResults.length > 0 && !trackedRef.current) {
                    trackedRef.current = true
                    trackEvent('property_nearby_benefits_loaded', {
                        property_id: propertyId,
                        title,
                        location: locationLabel,
                        benefit_layers: compactResults.map(item => item.layer),
                        benefit_count: compactResults.length,
                    })
                }
            } catch (error) {
                if (cancelled) return
                console.warn('[PropertyNearbyBenefits] Não foi possível carregar benefícios:', error)
                setStatus('error')
            }
        }

        loadBenefits()

        return () => {
            cancelled = true
        }
    }, [apiKey, locationLabel, propertyId, safeLatLng, shouldLoad, title])

    if (!safeLatLng) return null

    const loading = status === 'idle' || status === 'loading'
    const visibleResults = results.slice(0, 6)

    return (
        <div
            ref={rootRef}
            className={`plp-nearby-benefits plp-nearby-benefits--${variant} ${className}`.trim()}
            aria-live="polite"
        >
            <div className="plp-nearby-benefits-head">
                <span className="plp-kicker">Entorno premium</span>
                <h3>Benefícios ao redor do imóvel.</h3>
            </div>

            <div className="plp-nearby-map-layout">
                {visibleResults.length > 0 && (
                    <div className="plp-nearby-summary-row" aria-label="Benefícios próximos ao imóvel">
                        {visibleResults.map(item => (
                            <NearbyBenefitSummaryItem item={item} key={`summary-${item.layer}-${item.name}`} />
                        ))}
                    </div>
                )}
                <PropertyNearbyRealMap origin={safeLatLng} results={visibleResults} loading={loading} />
            </div>
        </div>
    )
}
