'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { Map as MapIcon, Navigation, Satellite, Sparkles, X } from 'lucide-react'
import { buildPropertyFeedCopy } from '@/lib/properties/feed-copy'
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
    allowedViews?: PropertyFeedMapView[]
    showViewControl?: boolean
}

const PROPERTY_FEED_MAP_VIEWS: Array<{ value: PropertyFeedMapView; label: string; icon: 'sparkles' | 'map' | 'satellite' | 'street' }> = [
    { value: 'luxury', label: 'Luxo', icon: 'sparkles' },
    { value: 'map', label: 'Claro', icon: 'map' },
    { value: 'satellite', label: 'Satélite', icon: 'satellite' },
    { value: 'street', label: 'Street View', icon: 'street' },
]

type GoogleStreetViewPanoramaInstance = {
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

function loadGoogleMapsScript(apiKey: string) {
    const googleWindow = getGoogleMapsWindow()
    if (!googleWindow) return Promise.reject(new Error('Google Maps indisponivel fora do navegador.'))
    if (googleWindow.google?.maps?.StreetViewPanorama) return Promise.resolve()
    if (googleWindow.__pilgerGoogleMapsPromise) return googleWindow.__pilgerGoogleMapsPromise

    googleWindow.__pilgerGoogleMapsPromise = new Promise<void>((resolve, reject) => {
        const existingScript = document.getElementById('pilger-google-maps-js') as HTMLScriptElement | null
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(), { once: true })
            existingScript.addEventListener('error', () => reject(new Error('Falha ao carregar Google Maps.')), { once: true })
            return
        }

        const script = document.createElement('script')
        script.id = 'pilger-google-maps-js'
        script.async = true
        script.defer = true
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&language=pt-BR&region=BR`
        script.addEventListener('load', () => resolve(), { once: true })
        script.addEventListener('error', () => reject(new Error('Falha ao carregar Google Maps.')), { once: true })
        document.head.appendChild(script)
    })

    return googleWindow.__pilgerGoogleMapsPromise
}

function formatPrice(price?: number | null) {
    if (!price) return 'Sob consulta'
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
    }).format(price)
}

function compactPrice(price?: number | null) {
    if (!price) return 'Sob consulta'
    return formatPrice(price)
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

function GoogleStreetViewPanorama({
    apiKey,
    latLng,
    title,
    interactive,
}: {
    apiKey: string
    latLng: [number, number]
    title: string
    interactive: boolean
}) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

    useEffect(() => {
        let panorama: GoogleStreetViewPanoramaInstance | null = null
        let cancelled = false

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
                service.getPanorama({
                    location: { lat: latLng[0], lng: latLng[1] },
                    preference: googleMaps?.StreetViewPreference?.NEAREST,
                    radius: 900,
                    source: googleMaps?.StreetViewSource?.OUTDOOR,
                }, (data, status) => {
                    if (cancelled || !containerRef.current) return

                    const isOk = status === (googleMaps?.StreetViewStatus?.OK || 'OK')
                    const pano = data?.location?.pano
                    const position = data?.location?.latLng || { lat: latLng[0], lng: latLng[1] }

                    if (!isOk || (!pano && !position)) {
                        setStatus('error')
                        return
                    }

                    panorama = new StreetViewPanorama(containerRef.current, {
                        addressControl: false,
                        clickToGo: true,
                        disableDefaultUI: false,
                        fullscreenControl: true,
                        gestureHandling: 'greedy',
                        linksControl: true,
                        motionTracking: false,
                        motionTrackingControl: false,
                        panControl: true,
                        pano,
                        position,
                        pov: { heading: 0, pitch: 0 },
                        scrollwheel: true,
                        showRoadLabels: true,
                        visible: true,
                        zoomControl: true,
                    })

                    setStatus('ready')
                })
            })
            .catch(() => {
                if (!cancelled) setStatus('error')
            })

        return () => {
            cancelled = true
            if (panorama) {
                const googleWindow = getGoogleMapsWindow()
                googleWindow?.google?.maps?.event?.clearInstanceListeners?.(panorama)
            }
        }
    }, [apiKey, latLng])

    return (
        <div
            ref={containerRef}
            className={`property-feed-map-street-native${interactive ? ' is-interactive' : ''}`}
            aria-label={`Street View de ${title}`}
        >
            {status !== 'ready' && (
                <div className="property-feed-map-street-native-state">
                    <Navigation size={18} />
                    <strong>{status === 'error' ? 'Street View indisponivel' : 'Carregando Street View'}</strong>
                </div>
            )}
        </div>
    )
}

export default function PropertyFeedMap({
    property,
    latLng,
    initialView = 'satellite',
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
    const [isStreetInteractive, setIsStreetInteractive] = useState(false)
    const streetFrameRef = useRef<HTMLIFrameElement>(null)
    const mapView = viewOptions.some(view => view.value === selectedMapView) ? selectedMapView : fallbackView
    const safeLatLng = useMemo(() => normalizeLatLng(latLng), [latLng])
    const coordinateQuery = safeLatLng ? `${safeLatLng[0]},${safeLatLng[1]}` : ''
    const googleMapsJsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    const googleMapsEmbedKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY || googleMapsJsKey
    const fallbackStreetViewEmbedUrl = safeLatLng
        ? `https://maps.google.com/maps?layer=c&cbll=${safeLatLng[0]},${safeLatLng[1]}&cbp=12,0,0,0,0&output=svembed&hl=pt-BR`
        : ''
    const streetViewUrl = googleMapsEmbedKey
        ? `https://www.google.com/maps/embed/v1/streetview?key=${encodeURIComponent(googleMapsEmbedKey)}&location=${encodeURIComponent(coordinateQuery)}&heading=0&pitch=0&fov=80`
        : fallbackStreetViewEmbedUrl
    const markerIcon = useMemo(() => L.divIcon({
        className: 'property-feed-map-marker',
        html: `<div class="property-feed-map-marker-wrap${property.exclusive ? ' is-exclusive' : ''}">
            <span class="property-feed-map-pin"><span></span></span>
            <strong>${compactPrice(property.price)}</strong>
        </div>`,
        iconSize: [132, 76],
        iconAnchor: [66, 70],
        popupAnchor: [0, -62],
    }), [property.exclusive, property.price])
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
    const handleEnableStreetInteraction = useCallback(() => {
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
    }, [copy.title, googleMapsJsKey, property.city, property.id, property.neighborhood, safeLatLng])
    const handleDisableStreetInteraction = useCallback(() => {
        setIsStreetInteractive(false)
    }, [])

    useEffect(() => {
        if (mapView !== 'street' || !isStreetInteractive) return

        document.body.classList.add('property-street-view-active')
        return () => {
            document.body.classList.remove('property-street-view-active')
        }
    }, [isStreetInteractive, mapView])

    if (!safeLatLng) {
        return (
            <div className="property-feed-map-shell property-feed-map-shell--empty" aria-label="Localizacao indisponivel">
                <div className="property-feed-map-street-fallback">
                    <Navigation size={19} />
                    <strong>Localizacao sob curadoria</strong>
                    <span>Endereco e entorno sao confirmados pelo especialista antes da visita.</span>
                </div>
            </div>
        )
    }

    return (
        <div
            className={`property-feed-map-shell map-view-${mapView}${mapView === 'street' && isStreetInteractive ? ' is-street-interactive' : ''}`}
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
                <div className={`property-feed-map-street-view${isStreetInteractive ? ' is-interactive' : ''}`}>
                    {googleMapsJsKey ? (
                        <GoogleStreetViewPanorama
                            apiKey={googleMapsJsKey}
                            latLng={safeLatLng}
                            title={copy.title}
                            interactive={isStreetInteractive}
                        />
                    ) : (
                        <iframe
                            ref={streetFrameRef}
                            className="property-feed-map-street-frame"
                            src={streetViewUrl}
                            title={`Street View de ${copy.title}`}
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            allow="fullscreen; geolocation"
                            allowFullScreen
                            tabIndex={0}
                        />
                    )}
                    {!isStreetInteractive && (
                        <button
                            type="button"
                            className="property-feed-map-street-activate"
                            onClick={handleEnableStreetInteraction}
                            aria-label="Explorar Street View"
                        >
                            <Navigation size={16} />
                            <span>Explorar rua</span>
                        </button>
                    )}
                    {isStreetInteractive && (
                        <button
                            type="button"
                            className="property-feed-map-street-release"
                            onClick={handleDisableStreetInteraction}
                            aria-label="Sair da navegacao do Street View"
                        >
                            <X size={18} />
                        </button>
                    )}
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
                            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap'
                            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                            maxZoom={20}
                        />
                    )}
                    {mapView === 'map' && (
                        <TileLayer
                            attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap'
                            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
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
