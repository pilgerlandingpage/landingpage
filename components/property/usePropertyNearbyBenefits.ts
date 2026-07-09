'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getNearbyBenefitConfig, type NearbyBenefitLayer } from '@/lib/locations/nearby-benefits'
import { trackEvent } from '@/lib/tracking/client'

export type LatLngTuple = [number, number]

export type NearbyBenefitResult = {
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

type UsePropertyNearbyBenefitsProps = {
    propertyId: string
    title: string
    latLng: LatLngTuple | null
    locationLabel?: string | null
    shouldLoad: boolean
    trackLoad?: boolean
}

const PROPERTY_BENEFIT_LAYERS: NearbyBenefitLayer[] = [
    'beach',
    'school',
    'dining',
    'bank',
    'health',
    'marina',
]

const NEARBY_BENEFITS_CACHE_TTL_MS = 1000 * 60 * 60 * 24
const NEARBY_BENEFITS_SESSION_PREFIX = 'pilger_nearby_benefits_v1:'
const nearbyBenefitsMemoryCache = new Map<string, { timestamp: number; results: NearbyBenefitResult[] }>()
const nearbyBenefitsPendingCache = new Map<string, Promise<NearbyBenefitResult[]>>()

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

function buildNearbyBenefitsCacheKey(propertyId: string, origin: LatLngTuple) {
    return `${propertyId}:${origin[0].toFixed(5)}:${origin[1].toFixed(5)}`
}

function readNearbyBenefitsCache(cacheKey: string): NearbyBenefitResult[] | null {
    const now = Date.now()
    const memoryEntry = nearbyBenefitsMemoryCache.get(cacheKey)
    if (memoryEntry && now - memoryEntry.timestamp < NEARBY_BENEFITS_CACHE_TTL_MS) {
        return memoryEntry.results
    }
    if (memoryEntry) nearbyBenefitsMemoryCache.delete(cacheKey)

    if (typeof window === 'undefined') return null

    try {
        const raw = window.sessionStorage.getItem(`${NEARBY_BENEFITS_SESSION_PREFIX}${cacheKey}`)
        if (!raw) return null

        const parsed = JSON.parse(raw) as { timestamp?: unknown; results?: unknown }
        const timestamp = Number(parsed.timestamp)
        if (!Number.isFinite(timestamp) || now - timestamp >= NEARBY_BENEFITS_CACHE_TTL_MS) {
            window.sessionStorage.removeItem(`${NEARBY_BENEFITS_SESSION_PREFIX}${cacheKey}`)
            return null
        }

        if (!Array.isArray(parsed.results)) return null
        const results = parsed.results as NearbyBenefitResult[]
        nearbyBenefitsMemoryCache.set(cacheKey, { timestamp, results })
        return results
    } catch {
        return null
    }
}

function writeNearbyBenefitsCache(cacheKey: string, results: NearbyBenefitResult[]) {
    const entry = { timestamp: Date.now(), results }
    nearbyBenefitsMemoryCache.set(cacheKey, entry)

    if (typeof window === 'undefined') return

    try {
        window.sessionStorage.setItem(`${NEARBY_BENEFITS_SESSION_PREFIX}${cacheKey}`, JSON.stringify(entry))
    } catch {
        // sessionStorage may be unavailable or full; memory cache still dedupes this page load.
    }
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

function getSearchRadius(layer: NearbyBenefitLayer) {
    if (layer === 'beach' || layer === 'marina') return 6200
    if (layer === 'health' || layer === 'shopping') return 4300
    return 3500
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

async function fetchNearbyBenefitResults(apiKey: string, originLatLng: LatLngTuple) {
    await loadGooglePlacesLibrary(apiKey)

    const googleWindow = getGooglePlacesWindow()
    const googleMaps = googleWindow?.google?.maps
    if (!googleMaps?.places?.Place) {
        throw new Error('Google Places indisponivel.')
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

    return loadedResults.filter((item): item is NearbyBenefitResult => Boolean(item))
}

async function getCachedNearbyBenefitResults(cacheKey: string, apiKey: string, originLatLng: LatLngTuple) {
    const cached = readNearbyBenefitsCache(cacheKey)
    if (cached) return cached

    const pending = nearbyBenefitsPendingCache.get(cacheKey)
    if (pending) return pending

    const request = fetchNearbyBenefitResults(apiKey, originLatLng)
        .then(results => {
            writeNearbyBenefitsCache(cacheKey, results)
            return results
        })
        .finally(() => {
            nearbyBenefitsPendingCache.delete(cacheKey)
        })

    nearbyBenefitsPendingCache.set(cacheKey, request)
    return request
}

export function formatNearbyBenefitDistance(meters: number) {
    if (!Number.isFinite(meters)) return 'Sob consulta'
    if (meters < 1000) return `${Math.max(40, Math.round(meters / 10) * 10).toLocaleString('pt-BR')} m`
    return `${(meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`
}

export function usePropertyNearbyBenefits({
    propertyId,
    title,
    latLng,
    locationLabel,
    shouldLoad,
    trackLoad = true,
}: UsePropertyNearbyBenefitsProps) {
    const trackedRef = useRef(false)
    const [status, setStatus] = useState<LoadStatus>('idle')
    const [results, setResults] = useState<NearbyBenefitResult[]>([])
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    const safeLatLng = useMemo(() => (isValidLatLng(latLng) ? latLng : null), [latLng])

    useEffect(() => {
        if (!shouldLoad || !safeLatLng || !apiKey) return

        let cancelled = false
        const googleMapsApiKey = apiKey
        const originLatLng = safeLatLng
        const cacheKey = buildNearbyBenefitsCacheKey(propertyId, originLatLng)

        async function loadBenefits() {
            setStatus('loading')

            try {
                const compactResults = await getCachedNearbyBenefitResults(cacheKey, googleMapsApiKey, originLatLng)
                if (cancelled) return

                setResults(compactResults)
                setStatus(compactResults.length > 0 ? 'ready' : 'empty')

                if (trackLoad && compactResults.length > 0 && !trackedRef.current) {
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
    }, [apiKey, locationLabel, propertyId, safeLatLng, shouldLoad, title, trackLoad])

    const visibleResults = results.slice(0, 6)
    const loading = status === 'idle' || status === 'loading'

    return {
        loading,
        results,
        safeLatLng,
        status,
        visibleResults,
    }
}
