'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Anchor, Coffee, Cross, GraduationCap, Landmark, MapPin, Navigation, ShoppingBag, Sparkles, TreePalm, Utensils } from 'lucide-react'
import { NEARBY_BENEFIT_LAYERS, getNearbyBenefitConfig, type NearbyBenefitLayer } from '@/lib/locations/nearby-benefits'
import { trackEvent } from '@/lib/tracking/client'

type LatLngTuple = [number, number]

type NearbyBenefitResult = {
    layer: NearbyBenefitLayer
    label: string
    searchLabel: string
    name: string
    vicinity?: string
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

const PROPERTY_BENEFIT_LAYERS: NearbyBenefitLayer[] = [
    'beach',
    'school',
    'dining',
    'bank',
    'health',
    'marina',
]

const PROPERTY_BENEFIT_ICONS: Record<NearbyBenefitLayer, typeof MapPin> = {
    beach: TreePalm,
    school: GraduationCap,
    bank: Landmark,
    dining: Utensils,
    coffee: Coffee,
    health: Cross,
    shopping: ShoppingBag,
    marina: Anchor,
    park: TreePalm,
}

const BENEFIT_COPY: Partial<Record<NearbyBenefitLayer, string>> = {
    beach: 'Acesso a orla e rotina de praia.',
    school: 'Referencia para familias e permanencia.',
    dining: 'Restaurantes e conveniencias de alto giro.',
    bank: 'Servicos financeiros por perto.',
    health: 'Apoio medico e farmacia na regiao.',
    marina: 'Lifestyle nautico e acesso ao litoral.',
}

function getGooglePlacesWindow() {
    if (typeof window === 'undefined') return null
    return window as GooglePlacesWindow
}

function hasModernPlacesLibrary(googleWindow: GooglePlacesWindow | null) {
    return Boolean(googleWindow?.google?.maps?.places?.Place)
}

function loadGooglePlacesLibrary(apiKey: string) {
    const googleWindow = getGooglePlacesWindow()
    if (!googleWindow) return Promise.reject(new Error('Google Places indisponivel fora do navegador.'))
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

                reject(new Error('Biblioteca Places nao esta disponivel.'))
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
        distanceMeters: distanceMetersBetween(origin, target),
        color: option.color,
    }
}

function getSearchRadius(layer: NearbyBenefitLayer) {
    if (layer === 'beach' || layer === 'marina') return 6200
    if (layer === 'health' || layer === 'shopping') return 4300
    return 3500
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
                console.warn('[PropertyNearbyBenefits] Nao foi possivel carregar beneficios:', error)
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
    const fallbackBenefits = NEARBY_BENEFIT_LAYERS
        .filter(option => PROPERTY_BENEFIT_LAYERS.includes(option.value))
        .slice(0, 6)

    return (
        <div
            ref={rootRef}
            className={`plp-nearby-benefits plp-nearby-benefits--${variant} ${className}`.trim()}
            aria-live="polite"
        >
            <div className="plp-nearby-benefits-head">
                <span className="plp-kicker">Entorno premium</span>
                <h3>Beneficios ao redor do imovel.</h3>
                <p>{locationLabel ? `${locationLabel} com pontos de interesse proximos para qualificar rotina, liquidez e desejo.` : 'Pontos de interesse proximos para qualificar rotina, liquidez e desejo.'}</p>
            </div>

            <div className="plp-nearby-benefits-grid">
                {loading && fallbackBenefits.map(option => {
                    const Icon = PROPERTY_BENEFIT_ICONS[option.value] || MapPin
                    return (
                        <article className="plp-nearby-benefit-card is-loading" key={option.value}>
                            <span style={{ '--benefit-color': option.color } as CSSProperties}>
                                <Icon size={18} />
                            </span>
                            <div>
                                <small>{option.label}</small>
                                <strong>Buscando no entorno</strong>
                                <em>Google Places</em>
                            </div>
                        </article>
                    )
                })}

                {!loading && results.map(item => {
                    const Icon = PROPERTY_BENEFIT_ICONS[item.layer] || MapPin
                    return (
                        <article className="plp-nearby-benefit-card" key={`${item.layer}-${item.name}`}>
                            <span style={{ '--benefit-color': item.color } as CSSProperties}>
                                <Icon size={18} />
                            </span>
                            <div>
                                <small>{item.label}</small>
                                <strong>{item.name}</strong>
                                <em>{BENEFIT_COPY[item.layer] || 'Ponto relevante no entorno.'}</em>
                                <b><Navigation size={13} /> {formatDistance(item.distanceMeters)}</b>
                            </div>
                        </article>
                    )
                })}

                {!loading && (status === 'empty' || status === 'error') && (
                    <article className="plp-nearby-benefit-card plp-nearby-benefit-card--wide">
                        <span>
                            <Sparkles size={18} />
                        </span>
                        <div>
                            <small>Curadoria</small>
                            <strong>Entorno em validacao</strong>
                            <em>O especialista confirma pontos de interesse, acesso e conveniencias antes da visita privada.</em>
                        </div>
                    </article>
                )}
            </div>
        </div>
    )
}
