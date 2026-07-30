'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type TouchEvent, type WheelEvent } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { Map as MapIcon, Navigation, Satellite, Sparkles } from 'lucide-react'
import { LEAFLET_OSM_ATTRIBUTION, LEAFLET_OSM_TILE_URL } from '@/lib/maps/leaflet-style'
import { buildPropertyFeedCopy } from '@/lib/properties/feed-copy'
import { formatPublicPropertyPrice } from '@/lib/properties/public-policy'
import { trackEvent } from '@/lib/tracking/client'

export type PropertyFeedMapView = 'luxury' | 'map' | 'satellite' | 'street'

type PropertyFeedMapProperty = {
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
    property: PropertyFeedMapProperty
    latLng: [number, number]
    initialView?: PropertyFeedMapView
    initialStreetInteractive?: boolean
    allowedViews?: PropertyFeedMapView[]
    showViewControl?: boolean
}

const PROPERTY_FEED_MAP_VIEWS: Array<{ value: PropertyFeedMapView; label: string; icon: 'sparkles' | 'map' | 'satellite' | 'street' }> = [
    { value: 'luxury', label: 'Leaflet', icon: 'sparkles' },
    { value: 'map', label: 'Ruas', icon: 'map' },
    { value: 'satellite', label: 'Satélite', icon: 'satellite' },
    { value: 'street', label: 'Street View', icon: 'street' },
]

type GoogleStreetViewPanoramaInstance = {
    addListener?: (eventName: string, handler: () => void) => { remove?: () => void }
    getPosition?: () => unknown
    getPov?: () => { heading?: number; pitch?: number; zoom?: number } | undefined
    setPosition?: (position: { lat: number; lng: number }) => void
    setPov?: (pov: { heading: number; pitch: number }) => void
    setPano?: (pano: string) => void
    setVisible?: (visible: boolean) => void
}

type GoogleMapsWindow = Window & {
    google?: {
        maps?: {
            StreetViewPanorama?: new (container: HTMLElement, options: Record<string, unknown>) => GoogleStreetViewPanoramaInstance
            StreetViewService?: new () => {
                getPanorama: (
                    request: Record<string, unknown>,
                    callback: (data: { location?: { pano?: string; latLng?: unknown } } | null, status: string) => void
                ) => void
            }
            StreetViewPreference?: {
                NEAREST?: unknown
            }
            StreetViewSource?: {
                OUTDOOR?: unknown
            }
            StreetViewStatus?: {
                OK?: string
            }
            event?: {
                clearInstanceListeners?: (instance: unknown) => void
                trigger?: (instance: unknown, eventName: string) => void
            }
        }
    }
    __pilgerGoogleMapsPromise?: Promise<void>
}

declare global {
    interface Window {
        __pilgerGoogleMapsPromise?: Promise<void>
    }
}

function getGoogleMapsWindow() {
    if (typeof window === 'undefined') return null
    return window as GoogleMapsWindow
}

const streetMiniMapStyles: Record<
    | 'container'
    | 'fallback'
    | 'road'
    | 'sideRoad'
    | 'marker'
    | 'markerArrow'
    | 'markerDot'
    | 'label',
    CSSProperties
> = {
    container: {
        background: 'rgba(255, 252, 246, .92)',
        border: '1px solid rgba(255,255,255,.72)',
        borderRadius: 14,
        boxShadow: '0 16px 38px rgba(0,0,0,.28)',
        display: 'block',
        height: 74,
        isolation: 'isolate',
        overflow: 'hidden',
        pointerEvents: 'none',
        position: 'absolute',
        right: 12,
        top: 70,
        width: 102,
        zIndex: 2147483600,
    },
    fallback: {
        background:
            'radial-gradient(circle at 50% 50%, rgba(255,255,255,.95), rgba(255,255,255,.25) 35%, transparent 36%), linear-gradient(135deg, transparent 45%, rgba(47, 108, 156, .12) 46%, rgba(47, 108, 156, .12) 53%, transparent 54%), linear-gradient(135deg, #e7eee9, #f8f4ea)',
        inset: 0,
        position: 'absolute',
        zIndex: 1,
    },
    road: {
        background: 'rgba(255,255,255,.78)',
        border: '1px solid rgba(184,148,95,.3)',
        borderRadius: 999,
        boxShadow: '0 1px 0 rgba(255,255,255,.82)',
        display: 'block',
        height: 8,
        left: -16,
        position: 'absolute',
        top: 40,
        transform: 'rotate(-22deg)',
        width: 136,
        zIndex: 2,
    },
    sideRoad: {
        background: 'rgba(255,255,255,.62)',
        left: 28,
        top: 18,
        transform: 'rotate(58deg)',
        width: 84,
    },
    marker: {
        alignItems: 'center',
        background: 'linear-gradient(135deg, #dfc18e, #a87938)',
        border: '2px solid #fff',
        borderRadius: 999,
        boxShadow: '0 8px 18px rgba(0,0,0,.28)',
        display: 'grid',
        height: 24,
        justifyItems: 'center',
        left: '50%',
        position: 'absolute',
        top: '50%',
        transformOrigin: '50% 50%',
        transition: 'transform .14s ease-out',
        width: 24,
        willChange: 'transform',
        zIndex: 5,
    },
    markerArrow: {
        borderBottom: '7px solid #fff',
        borderLeft: '4px solid transparent',
        borderRight: '4px solid transparent',
        display: 'block',
        left: '50%',
        position: 'absolute',
        top: 4,
        transform: 'translateX(-50%)',
    },
    markerDot: {
        background: '#111',
        borderRadius: 999,
        display: 'block',
        height: 5,
        width: 5,
    },
    label: {
        background: 'rgba(17,17,17,.76)',
        borderRadius: 999,
        bottom: 5,
        color: '#fff',
        fontSize: '.5rem',
        fontWeight: 820,
        left: 6,
        letterSpacing: '.04em',
        lineHeight: 1,
        padding: '4px 6px',
        position: 'absolute',
        textTransform: 'uppercase',
        zIndex: 6,
    },
}

function loadGoogleMapsScript(apiKey: string) {
    const googleWindow = getGoogleMapsWindow()
    if (!googleWindow) return Promise.reject(new Error('Google Maps indisponível fora do navegador.'))
    if (googleWindow.google?.maps?.StreetViewPanorama) return Promise.resolve()
    if (googleWindow.__pilgerGoogleMapsPromise) return googleWindow.__pilgerGoogleMapsPromise

    googleWindow.__pilgerGoogleMapsPromise = new Promise<void>((resolve, reject) => {
        const finishWhenReady = (startedAt = Date.now()) => {
            if (googleWindow.google?.maps?.StreetViewPanorama && googleWindow.google?.maps?.StreetViewService) {
                resolve()
                return
            }

            if (Date.now() - startedAt < 9000) {
                window.setTimeout(() => finishWhenReady(startedAt), 90)
                return
            }

            reject(new Error('Google Maps não ficou pronto para Street View.'))
        }

        const existingScript = document.getElementById('pilger-google-maps-js') as HTMLScriptElement | null
        if (existingScript) {
            existingScript.addEventListener('load', () => finishWhenReady(), { once: true })
            existingScript.addEventListener('error', () => reject(new Error('Falha ao carregar Google Maps.')), { once: true })
            return
        }

        const script = document.createElement('script')
        script.id = 'pilger-google-maps-js'
        script.async = true
        script.defer = true
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&language=pt-BR&region=BR&loading=async`
        script.addEventListener('load', () => finishWhenReady(), { once: true })
        script.addEventListener('error', () => reject(new Error('Falha ao carregar Google Maps.')), { once: true })
        document.head.appendChild(script)
    })

    return googleWindow.__pilgerGoogleMapsPromise
}

function formatPrice(price?: number | null) {
    return formatPublicPropertyPrice(price)
}

function locationLabel(property: PropertyFeedMapProperty) {
    return [property.neighborhood, property.city, property.state].filter(Boolean).join(' - ') || 'Litoral catarinense'
}

function normalizeLatLng(value: [number, number] | null | undefined): [number, number] | null {
    if (!value || value.length < 2) return null

    const lat = Number(value[0])
    const lng = Number(value[1])

    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
    ) {
        return null
    }

    return [lat, lng]
}

function extractLatLng(value: unknown, fallback: [number, number]): [number, number] {
    const maybeLatLng = value as { lat?: unknown; lng?: unknown } | null | undefined
    const rawLat = typeof maybeLatLng?.lat === 'function'
        ? (maybeLatLng.lat as () => unknown)()
        : maybeLatLng?.lat
    const rawLng = typeof maybeLatLng?.lng === 'function'
        ? (maybeLatLng.lng as () => unknown)()
        : maybeLatLng?.lng
    const normalized = normalizeLatLng([Number(rawLat), Number(rawLng)])
    return normalized || fallback
}

function normalizeHeading(value: unknown) {
    const heading = Number(value)
    if (!Number.isFinite(heading)) return 0
    return ((heading % 360) + 360) % 360
}

function MapStyleIcon({ icon }: { icon: 'sparkles' | 'map' | 'satellite' | 'street' }) {
    if (icon === 'sparkles') return <Sparkles size={14} />
    if (icon === 'satellite') return <Satellite size={14} />
    if (icon === 'street') return <Navigation size={14} />
    return <MapIcon size={14} />
}

function PropertyFeedMapUpdater({ center }: { center: [number, number] }) {
    const map = useMap()

    useEffect(() => {
        const safeCenter = normalizeLatLng(center)
        if (!safeCenter) return

        const canAnimateMap = () => {
            const container = map.getContainer()
            return container.clientWidth > 0 && container.clientHeight > 0
        }

        const timers = [60, 220, 520].map(delay =>
            window.setTimeout(() => {
                map.invalidateSize({ animate: false })
                if (canAnimateMap()) {
                    map.flyTo(safeCenter, 16, { duration: 0.55 })
                }
            }, delay)
        )

        if (canAnimateMap()) {
            map.flyTo(safeCenter, 16, { duration: 0.55 })
        }

        return () => {
            timers.forEach(window.clearTimeout)
        }
    }, [center, map])

    return null
}

function StreetViewMiniMap({
    heading,
    origin,
    position,
}: {
    heading: number
    origin: [number, number]
    position: [number, number]
}) {
    const markerOffset = useMemo(() => {
        const metersPerDegreeLat = 111_320
        const metersPerDegreeLng = metersPerDegreeLat * Math.cos((origin[0] * Math.PI) / 180)
        const deltaX = (position[1] - origin[1]) * metersPerDegreeLng
        const deltaY = (position[0] - origin[0]) * metersPerDegreeLat
        const pixelsPerMeter = 0.22
        const left = Math.max(18, Math.min(84, 51 + deltaX * pixelsPerMeter))
        const top = Math.max(16, Math.min(58, 37 - deltaY * pixelsPerMeter))

        return { left, top }
    }, [origin, position])

    return (
        <div
            className="property-feed-map-street-minimap"
            style={streetMiniMapStyles.container}
            aria-hidden="true"
        >
            <div className="property-feed-map-street-minimap-fallback" style={streetMiniMapStyles.fallback} />
            <span className="property-feed-map-street-minimap-road" style={streetMiniMapStyles.road} />
            <span
                className="property-feed-map-street-minimap-road property-feed-map-street-minimap-road--side"
                style={{ ...streetMiniMapStyles.road, ...streetMiniMapStyles.sideRoad }}
            />
            <span
                className="property-feed-map-street-minimap-marker"
                style={{
                    ...streetMiniMapStyles.marker,
                    left: markerOffset.left,
                    top: markerOffset.top,
                    transform: `translate(-50%, -50%) rotate(${heading}deg)`,
                }}
            >
                <span style={streetMiniMapStyles.markerArrow} />
                <i style={streetMiniMapStyles.markerDot} />
            </span>
            <small style={streetMiniMapStyles.label}>Mapa</small>
        </div>
    )
}

function GoogleStreetViewPanorama({
    apiKey,
    fallbackUrl,
    latLng,
    title,
    interactive,
    onMiniMapChange,
}: {
    apiKey: string
    fallbackUrl?: string
    latLng: [number, number]
    title: string
    interactive: boolean
    onMiniMapChange?: (state: { position: [number, number]; heading: number }) => void
}) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

    useEffect(() => {
        let panorama: GoogleStreetViewPanoramaInstance | null = null
        let cancelled = false
        let miniMapSyncInterval: number | null = null
        let lastMiniMapState: { position: [number, number]; heading: number } | null = null
        const resizeTimers: number[] = []
        const listenerRemovers: Array<() => void> = []

        loadGoogleMapsScript(apiKey)
            .then(() => {
                if (cancelled || !containerRef.current) return

                const googleWindow = getGoogleMapsWindow()
                const googleMaps = googleWindow?.google?.maps
                const StreetViewPanorama = googleMaps?.StreetViewPanorama
                const StreetViewService = googleMaps?.StreetViewService
                if (!StreetViewPanorama || !StreetViewService) {
                    setStatus('error')
                    return
                }

                const service = new StreetViewService()
                const location = { lat: latLng[0], lng: latLng[1] }
                const panoramaRequests = [
                    {
                        location,
                        preference: googleMaps?.StreetViewPreference?.NEAREST,
                        radius: 1200,
                        source: googleMaps?.StreetViewSource?.OUTDOOR,
                    },
                    {
                        location,
                        preference: googleMaps?.StreetViewPreference?.NEAREST,
                        radius: 3200,
                    },
                ]

                const loadNearestPanorama = (requestIndex = 0) => {
                    const request = panoramaRequests[requestIndex]
                    if (!request) {
                        setStatus('error')
                        return
                    }

                    service.getPanorama(request, (data, status) => {
                        if (cancelled || !containerRef.current) return

                        const isOk = status === (googleMaps?.StreetViewStatus?.OK || 'OK')
                        const pano = data?.location?.pano
                        const position = data?.location?.latLng || location
                        const miniMapPosition = extractLatLng(position, latLng)

                        if (!isOk || (!pano && !position)) {
                            loadNearestPanorama(requestIndex + 1)
                            return
                        }

                        panorama = new StreetViewPanorama(containerRef.current, {
                            addressControl: false,
                            clickToGo: true,
                            disableDefaultUI: true,
                            fullscreenControl: false,
                            gestureHandling: 'greedy',
                            linksControl: true,
                            motionTracking: false,
                            motionTrackingControl: false,
                            panControl: false,
                            pano,
                            position,
                            pov: { heading: 0, pitch: 0 },
                            scrollwheel: true,
                            showRoadLabels: true,
                            visible: true,
                            zoomControl: false,
                        })

                        const syncMiniMap = () => {
                            if (!panorama || cancelled) return

                            const nextState = {
                                position: extractLatLng(panorama.getPosition?.(), miniMapPosition),
                                heading: normalizeHeading(panorama.getPov?.()?.heading),
                            }
                            const last = lastMiniMapState
                            const positionChanged = !last
                                || Math.abs(last.position[0] - nextState.position[0]) > 0.000001
                                || Math.abs(last.position[1] - nextState.position[1]) > 0.000001
                            const headingChanged = !last || Math.abs(last.heading - nextState.heading) > 0.2

                            if (!positionChanged && !headingChanged) return

                            lastMiniMapState = nextState
                            onMiniMapChange?.(nextState)
                        }
                        ;['position_changed', 'pov_changed', 'pano_changed'].forEach((eventName) => {
                            const listener = panorama?.addListener?.(eventName, syncMiniMap)
                            if (listener?.remove) listenerRemovers.push(() => listener.remove?.())
                        })

                        const refreshPanorama = () => {
                            if (!panorama) return
                            panorama.setVisible?.(true)
                            googleMaps?.event?.trigger?.(panorama, 'resize')
                            syncMiniMap()
                        }

                        lastMiniMapState = { position: miniMapPosition, heading: 0 }
                        onMiniMapChange?.(lastMiniMapState)
                        miniMapSyncInterval = window.setInterval(syncMiniMap, 180)
                        setStatus('ready')
                        ;[60, 220, 700, 1400].forEach((delay) => {
                            resizeTimers.push(window.setTimeout(refreshPanorama, delay))
                        })
                    })
                }

                loadNearestPanorama()
            })
            .catch(() => {
                if (!cancelled) setStatus('error')
            })

        return () => {
            cancelled = true
            resizeTimers.forEach((timer) => window.clearTimeout(timer))
            if (miniMapSyncInterval !== null) window.clearInterval(miniMapSyncInterval)
            listenerRemovers.forEach((remove) => remove())
            if (panorama) {
                const googleWindow = getGoogleMapsWindow()
                googleWindow?.google?.maps?.event?.clearInstanceListeners?.(panorama)
            }
        }
    }, [apiKey, latLng, onMiniMapChange])

    return (
        <div
            className={`property-feed-map-street-native${interactive ? ' is-interactive' : ''}`}
            aria-label={`Street View de ${title}`}
        >
            {status === 'error' && fallbackUrl ? (
                <iframe
                    className="property-feed-map-street-frame property-feed-map-street-frame--fallback"
                    src={fallbackUrl}
                    title={`Street View de ${title}`}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allow="geolocation"
                    allowFullScreen
                    tabIndex={0}
                />
            ) : (
                <div ref={containerRef} className="property-feed-map-street-native-canvas" />
            )}
            {status === 'loading' && (
                <div className="property-feed-map-street-native-state">
                    <Navigation size={18} />
                    <strong>Carregando Street View</strong>
                </div>
            )}
            {status === 'error' && !fallbackUrl && (
                <div className="property-feed-map-street-native-state">
                    <Navigation size={18} />
                    <strong>Street View indisponível</strong>
                </div>
            )}
        </div>
    )
}

export default function PropertyFeedMap({
    property,
    latLng,
    initialView = 'luxury',
    initialStreetInteractive = false,
    allowedViews,
    showViewControl = true,
}: Props) {
    const copy = buildPropertyFeedCopy(property)
    const viewOptions = useMemo(() => {
        const allowed = allowedViews?.length ? new Set(allowedViews) : null
        return PROPERTY_FEED_MAP_VIEWS.filter(view => !allowed || allowed.has(view.value))
    }, [allowedViews])
    const fallbackView = useMemo(() => {
        return viewOptions.some(view => view.value === initialView)
            ? initialView
            : viewOptions[0]?.value || 'luxury'
    }, [initialView, viewOptions])
    const [selectedMapView, setSelectedMapView] = useState<PropertyFeedMapView>(fallbackView)
    const [isStreetInteractive, setIsStreetInteractive] = useState(() => Boolean(initialStreetInteractive && fallbackView === 'street'))
    const [streetMiniMapState, setStreetMiniMapState] = useState<{ position: [number, number]; heading: number } | null>(null)
    const streetFrameRef = useRef<HTMLIFrameElement>(null)
    const streetScrollTouchYRef = useRef<number | null>(null)
    const mapView = viewOptions.some(view => view.value === selectedMapView) ? selectedMapView : fallbackView
    const safeLatLng = useMemo(() => normalizeLatLng(latLng), [latLng])
    const coordinateQuery = safeLatLng ? `${safeLatLng[0]},${safeLatLng[1]}` : ''
    const googleMapsJsEnabled = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_MAPS_JS === 'true'
    const googleMapsEmbedEnabled = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_MAPS_EMBED === 'true'
    const googleMapsJsKey = googleMapsJsEnabled ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY : ''
    const googleMapsEmbedKey = googleMapsEmbedEnabled
        ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        : ''
    const fallbackStreetViewEmbedUrl = safeLatLng
        ? `https://maps.google.com/maps?layer=c&cbll=${safeLatLng[0]},${safeLatLng[1]}&cbp=12,0,0,0,0&output=svembed&hl=pt-BR`
        : ''
    const streetViewUrl = googleMapsEmbedKey
        ? `https://www.google.com/maps/embed/v1/streetview?key=${encodeURIComponent(googleMapsEmbedKey)}&location=${encodeURIComponent(coordinateQuery)}&heading=0&pitch=0&fov=80`
        : fallbackStreetViewEmbedUrl
    const streetInteractionEnabled = isStreetInteractive
    const markerIcon = useMemo(() => L.divIcon({
        className: 'property-feed-map-marker',
        html: `<div class="property-feed-map-marker-wrap${property.exclusive ? ' is-exclusive' : ''}">
            <span class="property-feed-map-pin"><span></span></span>
        </div>`,
        iconSize: [42, 50],
        iconAnchor: [21, 44],
        popupAnchor: [0, -42],
    }), [property.exclusive])
    const handleMapViewChange = useCallback((view: PropertyFeedMapView) => {
        if (view === mapView) return

        setSelectedMapView(view)
        if (view !== 'street') {
            setIsStreetInteractive(false)
        }
        const payload = {
            property_id: property.id,
            title: copy.title,
            view,
            source: 'property_details_location',
            city: property.city || null,
            neighborhood: property.neighborhood || null,
            latitude: safeLatLng?.[0] || null,
            longitude: safeLatLng?.[1] || null,
            google_embed_available: Boolean(googleMapsEmbedKey),
        }

        void trackEvent('property_location_view_changed', payload)
        if (view === 'street') {
            void trackEvent('property_location_street_view_opened', payload)
        }
    }, [copy.title, googleMapsEmbedKey, mapView, property.city, property.id, property.neighborhood, safeLatLng])
    const handleToggleStreetInteraction = useCallback((event?: { preventDefault?: () => void; stopPropagation?: () => void }) => {
        event?.preventDefault?.()
        event?.stopPropagation?.()
        if (isStreetInteractive) {
            setIsStreetInteractive(false)
            return
        }

        setIsStreetInteractive(true)
        window.requestAnimationFrame(() => {
            streetFrameRef.current?.focus()
        })
        void trackEvent('property_location_street_view_interaction_enabled', {
            property_id: property.id,
            title: copy.title,
            source: 'property_details_location',
            city: property.city || null,
            neighborhood: property.neighborhood || null,
            latitude: safeLatLng?.[0] || null,
            longitude: safeLatLng?.[1] || null,
            google_maps_js_available: Boolean(googleMapsJsKey),
        })
    }, [copy.title, googleMapsJsKey, isStreetInteractive, property.city, property.id, property.neighborhood, safeLatLng])
    const getStreetScrollParent = useCallback((target: EventTarget | null) => {
        const element = target instanceof Element ? target : null
        const sheetScroller = element?.closest<HTMLElement>('.pmds-media')
        if (sheetScroller) return sheetScroller

        let parent = element?.parentElement || null
        while (parent && parent !== document.body) {
            const style = window.getComputedStyle(parent)
            const canScroll = /(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight
            if (canScroll) return parent
            parent = parent.parentElement
        }

        return document.scrollingElement as HTMLElement | null
    }, [])
    const scrollStreetParent = useCallback((target: EventTarget | null, deltaY: number) => {
        const scrollParent = getStreetScrollParent(target)
        if (scrollParent) {
            scrollParent.scrollTop += deltaY
            return
        }

        window.scrollBy({ top: deltaY, behavior: 'auto' })
    }, [getStreetScrollParent])
    const handleStreetShieldTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
        if (streetInteractionEnabled) return
        streetScrollTouchYRef.current = event.touches[0]?.clientY ?? null
    }, [streetInteractionEnabled])
    const handleStreetShieldTouchMove = useCallback((event: TouchEvent<HTMLDivElement>) => {
        if (streetInteractionEnabled) return

        const nextY = event.touches[0]?.clientY
        const lastY = streetScrollTouchYRef.current
        if (nextY == null || lastY == null) {
            streetScrollTouchYRef.current = nextY ?? null
            return
        }

        const deltaY = lastY - nextY
        streetScrollTouchYRef.current = nextY
        if (Math.abs(deltaY) < 1) return

        event.stopPropagation()
        scrollStreetParent(event.currentTarget, deltaY)
    }, [scrollStreetParent, streetInteractionEnabled])
    const handleStreetShieldTouchEnd = useCallback(() => {
        streetScrollTouchYRef.current = null
    }, [])
    const handleStreetShieldWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
        if (streetInteractionEnabled || Math.abs(event.deltaY) < 1) return

        event.stopPropagation()
        scrollStreetParent(event.currentTarget, event.deltaY)
    }, [scrollStreetParent, streetInteractionEnabled])

    useEffect(() => {
        if (mapView !== 'street' || !isStreetInteractive) return

        document.body.classList.add('property-street-view-active')
        return () => {
            document.body.classList.remove('property-street-view-active')
        }
    }, [isStreetInteractive, mapView])

    useEffect(() => {
        if (mapView === 'street') return

        const clearMiniMap = window.setTimeout(() => {
            setStreetMiniMapState(null)
        }, 0)

        return () => window.clearTimeout(clearMiniMap)
    }, [mapView])

    if (!safeLatLng) {
        return (
            <div className="property-feed-map-shell property-feed-map-shell--empty" aria-label="Localização indisponível">
                <div className="property-feed-map-street-fallback">
                    <Navigation size={19} />
                    <strong>Localização sob curadoria</strong>
                    <span>Endereco e entorno sao confirmados pelo especialista antes da visita.</span>
                </div>
            </div>
        )
    }

    return (
        <div
            className={`property-feed-map-shell map-view-${mapView}${mapView === 'street' && streetInteractionEnabled ? ' is-street-interactive' : ''}`}
            aria-label={`Mapa de ${copy.title}`}
        >
            {showViewControl && viewOptions.length > 1 && (
                <div className="property-feed-map-style-control" aria-label="Visualização de localização">
                    {viewOptions.map(style => (
                    <button
                        key={style.value}
                        type="button"
                        className={mapView === style.value ? 'active' : ''}
                        onClick={() => handleMapViewChange(style.value)}
                        aria-pressed={mapView === style.value}
                    >
                        <MapStyleIcon icon={style.icon} />
                        <span>{style.label}</span>
                    </button>
                    ))}
                </div>
            )}

            {mapView === 'street' ? (
                <div className={`property-feed-map-street-view${streetInteractionEnabled ? ' is-interactive' : ''}`}>
                    {googleMapsJsKey ? (
                        <GoogleStreetViewPanorama
                            apiKey={googleMapsJsKey}
                            fallbackUrl={streetViewUrl}
                            latLng={safeLatLng}
                            title={copy.title}
                            interactive={streetInteractionEnabled}
                            onMiniMapChange={setStreetMiniMapState}
                        />
                    ) : (
                        <iframe
                            ref={streetFrameRef}
                            className="property-feed-map-street-frame"
                            src={streetViewUrl}
                            title={`Street View de ${copy.title}`}
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            allow="geolocation"
                            allowFullScreen
                            tabIndex={0}
                        />
                    )}
                    {!streetInteractionEnabled && (
                        <div
                            className="property-feed-map-street-scroll-shield"
                            aria-hidden="true"
                            onTouchStart={handleStreetShieldTouchStart}
                            onTouchMove={handleStreetShieldTouchMove}
                            onTouchEnd={handleStreetShieldTouchEnd}
                            onTouchCancel={handleStreetShieldTouchEnd}
                            onWheel={handleStreetShieldWheel}
                        />
                    )}
                    <button
                        type="button"
                        className={`property-feed-map-street-toggle${streetInteractionEnabled ? ' is-active' : ''}`}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={handleToggleStreetInteraction}
                        aria-label={streetInteractionEnabled ? 'Parar de explorar Street View' : 'Explorar Street View'}
                        aria-pressed={streetInteractionEnabled}
                    >
                        <Navigation size={16} />
                        <span>{streetInteractionEnabled ? 'Parar de explorar' : 'Explorar rua'}</span>
                    </button>
                    <div
                        className={`property-feed-map-street-guide${streetInteractionEnabled ? ' is-active' : ''}`}
                        aria-live="polite"
                    >
                        <span className="property-feed-map-street-guide-motion" aria-hidden="true" />
                        <span>
                            {streetInteractionEnabled
                                ? 'Arraste a rua. Use as setas para avancar. Depois toque em Parar.'
                                : 'Toque em Explorar rua para mover a visao do entorno.'}
                        </span>
                    </div>
                    <StreetViewMiniMap
                        heading={(streetMiniMapState || { position: safeLatLng, heading: 0 }).heading}
                        origin={safeLatLng}
                        position={(streetMiniMapState || { position: safeLatLng, heading: 0 }).position}
                    />
                    <div className="property-feed-map-caption">
                        <span>Explore a rua e a vizinhança sem sair da pagina.</span>
                    </div>
                </div>
            ) : (
                <MapContainer
                    center={safeLatLng}
                    zoom={16}
                    zoomControl={false}
                    className="property-feed-map-canvas"
                    style={{ height: '100%', minHeight: 'inherit', width: '100%' }}
                >
                    {mapView === 'luxury' && (
                        <TileLayer
                            attribution={LEAFLET_OSM_ATTRIBUTION}
                            url={LEAFLET_OSM_TILE_URL}
                            maxZoom={20}
                        />
                    )}
                    {mapView === 'map' && (
                        <TileLayer
                            attribution={LEAFLET_OSM_ATTRIBUTION}
                            url={LEAFLET_OSM_TILE_URL}
                            maxZoom={20}
                        />
                    )}
                    {mapView === 'satellite' && (
                        <TileLayer
                            attribution='Tiles &copy; Esri'
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                            maxZoom={19}
                        />
                    )}
                    <PropertyFeedMapUpdater center={safeLatLng} />
                    <Marker position={safeLatLng} icon={markerIcon}>
                        <Popup className="property-feed-map-popup">
                            <div className="property-feed-map-popup-content">
                                <strong>{copy.title}</strong>
                                <span>{locationLabel(property)}</span>
                                <b>{formatPrice(property.price)}</b>
                            </div>
                        </Popup>
                    </Marker>
                </MapContainer>
            )}
        </div>
    )
}
