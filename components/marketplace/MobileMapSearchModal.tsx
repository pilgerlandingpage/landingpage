'use client'

import { Building2, MapPin, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import HomeSearchBar, { type HomeSearchValues } from './HomeSearchBar'
import MapSearch from './MapSearch'
import { searchLocationName } from '@/lib/locations/display'
import { findMapRegionByText } from '@/lib/locations/map-regions'
import { trackEvent } from '@/lib/tracking/client'

type Property = {
    id: string
    source_slug?: string | null
    title?: string | null
    city?: string | null
    state?: string | null
    neighborhood?: string | null
    price?: number | string | null
    rent?: number | string | null
    purpose?: string | null
    property_type?: string | null
    latitude?: number | string | null
    longitude?: number | string | null
    featured_image?: string | null
    bedrooms?: number | string | null
    bathrooms?: number | string | null
    suites?: number | string | null
    parking_spaces?: number | string | null
    area_m2?: number | string | null
    description?: string | null
    source_status?: string | null
    exclusive?: boolean | null
}

type MobileMapSearchModalProps = {
    properties: Property[]
    defaultSource?: string
    statFallback?: string
}

type MapBounds = {
    north: number
    south: number
    east: number
    west: number
}

const OFFICE_LOCATION_MARKER = {
    latLng: [-26.95665680834595, -48.62979654548911] as [number, number],
    title: 'Imobiliária Guilherme Pilger',
    subtitle: 'Praia Brava',
    address: 'Av. Carlos Drummond de Andrade, 33 - Loja 01 - Praia Brava, Itajai - SC, 88306-800',
}

function normalize(value: unknown) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
}

function toCoordinate(value: number | string | null | undefined) {
    if (typeof value === 'string') return Number(value.replace(',', '.'))
    return Number(value)
}

function isInsideServiceArea(nextLat: number, nextLng: number) {
    return (
        Number.isFinite(nextLat) &&
        Number.isFinite(nextLng) &&
        nextLat >= -30.5 &&
        nextLat <= -25.0 &&
        nextLng >= -54.5 &&
        nextLng <= -47.0
    )
}

function getPropertyLatLng(property: Property): [number, number] | null {
    const lat = toCoordinate(property.latitude)
    const lng = toCoordinate(property.longitude)

    if (isInsideServiceArea(lat, lng)) return [lat, lng]
    if (isInsideServiceArea(lng, lat)) return [lng, lat]
    return null
}

function hasCoordinates(property: Property) {
    return Boolean(getPropertyLatLng(property))
}

function filterPropertiesByBounds(properties: Property[], bounds: MapBounds | null) {
    if (!bounds) return properties

    return properties.filter(property => {
        const latLng = getPropertyLatLng(property)
        if (!latLng) return false

        const [lat, lng] = latLng
        return (
            lat >= bounds.south &&
            lat <= bounds.north &&
            lng >= bounds.west &&
            lng <= bounds.east
        )
    })
}

function mapOverlayTypeToMapFilter(value: string) {
    if (!value || value === 'all') return 'all'

    const [kind, rawValue] = value.split(':')
    if (!rawValue) return value
    if (kind === 'type') return rawValue

    const subtypeLabels: Record<string, string> = {
        cobertura: 'Cobertura',
        condominio: 'Casa em Condomínio',
        duplex: 'Duplex',
        galpao: 'Galpão',
        garden: 'Garden',
        'predio-residencial': 'Prédio',
        'sala-comercial': 'Sala Comercial',
        'terreno-comercial': 'Terreno Comercial',
        'terreno-condominio': 'Terreno',
    }

    return subtypeLabels[rawValue] || rawValue
}

function matchesType(property: Property, type: string) {
    if (!type || type === 'all') return true
    const text = normalize(`${property.property_type || ''} ${property.title || ''}`)
    if (type === 'Comercial') return ['comercial', 'galpao', 'sala', 'predio'].some(term => text.includes(term))
    if (type === 'Casa em Condomínio') return text.includes('casa') && text.includes('condom')
    return text.includes(normalize(type))
}

function matchesPrice(property: Property, range: string) {
    const price = Number(property.price || property.rent || 0)
    if (!range || range === 'all') return true

    const [minRaw, maxRaw] = range.split('-')
    const min = Number(minRaw || 0)
    const max = Number(maxRaw || 0)
    if (min && price < min) return false
    if (max && price > max) return false
    return true
}

function eventSource(event: Event, fallback: string) {
    const detail = 'detail' in event ? (event as CustomEvent<{ source?: string }>).detail : null
    return String(detail?.source || fallback)
}

export default function MobileMapSearchModal({
    properties,
    defaultSource = 'property_details_mobile_nav',
    statFallback = 'Curadoria no mapa',
}: MobileMapSearchModalProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [type, setType] = useState('all')
    const [price, setPrice] = useState('all')
    const [isMapUnlocked, setIsMapUnlocked] = useState(false)
    const [isOfficeLocationSelected, setIsOfficeLocationSelected] = useState(false)
    const [showMapLockedHint, setShowMapLockedHint] = useState(false)
    const [pendingAreaBounds, setPendingAreaBounds] = useState<MapBounds | null>(null)
    const [appliedAreaBounds, setAppliedAreaBounds] = useState<MapBounds | null>(null)
    const hintTimerRef = useRef<number | null>(null)

    const mapCandidates = useMemo(() => properties.filter(hasCoordinates), [properties])

    const filteredProperties = useMemo(() => {
        const term = normalize(searchLocationName(query))

        return mapCandidates.filter(property => {
            const text = normalize([
                property.title,
                property.city,
                property.state,
                property.neighborhood,
                property.property_type,
                property.description,
            ].filter(Boolean).join(' '))

            if (term && !text.includes(term)) return false
            if (!matchesType(property, type)) return false
            if (!matchesPrice(property, price)) return false
            return true
        })
    }, [mapCandidates, price, query, type])

    const boundedProperties = useMemo(
        () => filterPropertiesByBounds(filteredProperties, appliedAreaBounds),
        [appliedAreaBounds, filteredProperties]
    )
    const selectedRegionArea = useMemo(
        () => {
            if (isOfficeLocationSelected || appliedAreaBounds) return null
            return findMapRegionByText(searchLocationName(query))
        },
        [appliedAreaBounds, isOfficeLocationSelected, query]
    )
    const pendingAreaCount = useMemo(
        () => pendingAreaBounds ? filterPropertiesByBounds(filteredProperties, pendingAreaBounds).length : 0,
        [filteredProperties, pendingAreaBounds]
    )
    const isMapLocked = !isMapUnlocked
    const visibleProperties = isMapLocked || isOfficeLocationSelected ? [] : boundedProperties
    const officeMarker = isMapLocked || isOfficeLocationSelected ? OFFICE_LOCATION_MARKER : null
    const statLabel = isMapLocked || isOfficeLocationSelected
        ? 'Imobiliária Guilherme Pilger'
        : appliedAreaBounds
            ? `${visibleProperties.length} de ${filteredProperties.length} nesta área`
            : selectedRegionArea
                ? selectedRegionArea.label
            : filteredProperties.length
                ? `${filteredProperties.length} imóveis no mapa`
            : statFallback
    const refitKey = isOfficeLocationSelected
        ? 'property-modal-office-location'
        : isMapLocked
            ? 'property-modal-office'
            : `property-modal-${query}-${selectedRegionArea?.id || 'no-region'}-${type}-${price}-${visibleProperties.length}-${appliedAreaBounds ? 'area' : 'all'}`
    const shouldShowSearchThisArea = Boolean(pendingAreaBounds && !isMapLocked && !isOfficeLocationSelected)

    const syncSearchWithMap = useCallback((values: HomeSearchValues) => {
        const nextLocation = (values.locationType === 'office'
            ? values.locationLabel
            : values.locationValue || values.locationLabel
        ).trim()

        setQuery(nextLocation)
        setType(mapOverlayTypeToMapFilter(values.typeValue))
        setPrice(values.priceValue || 'all')
        setPendingAreaBounds(null)
        setAppliedAreaBounds(null)

        if (values.locationType === 'office') {
            setShowMapLockedHint(false)
            setIsOfficeLocationSelected(true)
            setIsMapUnlocked(true)
            return
        }

        setIsOfficeLocationSelected(false)

        if (nextLocation && (values.locationType === 'city' || values.locationType === 'neighborhood')) {
            setShowMapLockedHint(false)
            setIsMapUnlocked(true)
        }
    }, [])

    const openModal = useCallback((source = defaultSource) => {
        setIsOpen(true)
        setShowMapLockedHint(false)
        setPendingAreaBounds(null)
        setAppliedAreaBounds(null)
        setIsMapUnlocked(true)
        setIsOfficeLocationSelected(false)
        void trackEvent('property_map_modal_opened', {
            source,
            mapped_count: mapCandidates.length,
        })
    }, [defaultSource, mapCandidates.length])

    const closeModal = useCallback(() => {
        setIsOpen(false)
    }, [])

    const showLockedMapHint = useCallback(() => {
        if (!isMapLocked) return

        setShowMapLockedHint(true)

        if (hintTimerRef.current) {
            window.clearTimeout(hintTimerRef.current)
        }

        hintTimerRef.current = window.setTimeout(() => {
            setShowMapLockedHint(false)
            hintTimerRef.current = null
        }, 2600)
    }, [isMapLocked])

    const handleUserBoundsChange = useCallback((bounds: MapBounds) => {
        if (isMapLocked || isOfficeLocationSelected) return
        setPendingAreaBounds(bounds)
    }, [isMapLocked, isOfficeLocationSelected])

    const handleSearchThisArea = useCallback(() => {
        if (!pendingAreaBounds) return

        setAppliedAreaBounds(pendingAreaBounds)
        setPendingAreaBounds(null)

        void trackEvent('property_map_modal_search_this_area_clicked', {
            results_count: filterPropertiesByBounds(filteredProperties, pendingAreaBounds).length,
            total_count: filteredProperties.length,
            bounds: pendingAreaBounds,
        })
    }, [filteredProperties, pendingAreaBounds])

    useEffect(() => {
        const handleOpenMapSearch = (event: Event) => {
            event.preventDefault()
            openModal(eventSource(event, defaultSource))
        }

        window.addEventListener('pilger:open-map-search', handleOpenMapSearch)
        return () => window.removeEventListener('pilger:open-map-search', handleOpenMapSearch)
    }, [defaultSource, openModal])

    useEffect(() => {
        if (!isOpen) return

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        const focusTimer = window.setTimeout(() => {
            document.querySelector<HTMLInputElement>('.mobile-map-modal .home-search-location-row input')?.focus({ preventScroll: true })
        }, 180)

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeModal()
        }

        window.addEventListener('keydown', handleKeyDown)

        return () => {
            document.body.style.overflow = previousOverflow
            window.clearTimeout(focusTimer)
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [closeModal, isOpen])

    useEffect(() => {
        return () => {
            if (hintTimerRef.current) {
                window.clearTimeout(hintTimerRef.current)
            }
        }
    }, [])

    if (!isOpen) return null

    return (
        <div className="mobile-map-modal-backdrop" onClick={closeModal} role="presentation">
            <div
                aria-label="Buscar imóveis no mapa"
                aria-modal="true"
                className="mobile-map-modal"
                onClick={event => event.stopPropagation()}
                role="dialog"
            >
                <div className="mobile-map-modal-head">
                    <div>
                        <span>Explorar no mapa</span>
                        <strong>Busque por cidade, bairro ou perfil</strong>
                    </div>
                    <button type="button" onClick={closeModal} aria-label="Fechar busca no mapa">
                        <X size={20} strokeWidth={2.4} />
                    </button>
                </div>

                <div className="mobile-map-modal-body">
                    <div className={`mobile-map-preview-panel ${isMapLocked ? 'is-map-locked' : ''}`}>
                        <MapSearch
                            properties={visibleProperties}
                            regionArea={selectedRegionArea}
                            refitKey={refitKey}
                            interactionEnabled={!isMapLocked}
                            officeMarker={officeMarker}
                            initialMapStyle="luxury"
                            onUserBoundsChange={handleUserBoundsChange}
                        />

                        {shouldShowSearchThisArea && (
                            <button
                                type="button"
                                className="mobile-search-this-area-button"
                                onClick={handleSearchThisArea}
                                aria-label="Buscar imóveis nesta área do mapa"
                            >
                                <Search size={15} />
                                <span>Buscar nesta área</span>
                                {pendingAreaCount > 0 && <strong>{pendingAreaCount}</strong>}
                            </button>
                        )}

                        <div className="mobile-map-preview-stat">
                            <Building2 size={14} />
                            <span>{statLabel}</span>
                        </div>

                        {isMapLocked && (
                            <>
                                <div
                                    className={`mobile-map-lock-hint ${showMapLockedHint ? 'is-visible' : ''}`}
                                    role="status"
                                    aria-live="polite"
                                >
                                    Pesquise uma cidade ou bairro para mover o mapa.
                                </div>
                                <button
                                    type="button"
                                    className="mobile-map-interaction-lock"
                                    aria-label="Pesquise uma cidade ou bairro para mover o mapa"
                                    onClick={showLockedMapHint}
                                    onPointerDown={showLockedMapHint}
                                />
                            </>
                        )}

                        <div className="mobile-map-search-panel">
                            <HomeSearchBar onValuesChange={syncSearchWithMap} variant="map" />
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .mobile-map-modal-backdrop {
                    align-items: center;
                    background: rgba(15,13,10,0.58);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    display: grid;
                    inset: 0;
                    justify-items: center;
                    padding: max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom));
                    position: fixed;
                    z-index: 5000;
                }
                .mobile-map-modal {
                    background: #fffdf8;
                    border: 1px solid rgba(223,193,142,0.3);
                    border-radius: 18px;
                    box-shadow: 0 28px 80px rgba(0,0,0,0.34);
                    display: grid;
                    grid-template-rows: auto minmax(0, 1fr);
                    height: min(780px, calc(100svh - 24px));
                    max-width: 520px;
                    overflow: hidden;
                    width: min(100%, 520px);
                }
                .mobile-map-modal-head {
                    align-items: center;
                    background: rgba(255,253,248,0.96);
                    border-bottom: 1px solid rgba(184,148,95,0.16);
                    display: flex;
                    gap: 12px;
                    justify-content: space-between;
                    padding: 12px 12px 11px 16px;
                    position: relative;
                    z-index: 3;
                }
                .mobile-map-modal-head div {
                    display: grid;
                    gap: 3px;
                    min-width: 0;
                }
                .mobile-map-modal-head span {
                    color: #a78042;
                    font: 950 0.62rem/1 'Inter', sans-serif;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                }
                .mobile-map-modal-head strong {
                    color: #211c16;
                    font: 850 0.86rem/1.12 'Inter', sans-serif;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .mobile-map-modal-head button {
                    align-items: center;
                    background: #171410;
                    border: 0;
                    border-radius: 999px;
                    color: #dfc18e;
                    cursor: pointer;
                    display: inline-flex;
                    flex: 0 0 auto;
                    height: 38px;
                    justify-content: center;
                    width: 38px;
                }
                .mobile-map-modal-body {
                    min-height: 0;
                    position: relative;
                }
                .mobile-map-preview-panel {
                    background: #1f1b16;
                    height: 100%;
                    min-height: 0;
                    overflow: hidden;
                    position: relative;
                }
                .mobile-map-preview-stat {
                    align-items: center;
                    background: rgba(23,20,16,0.58);
                    border: 1px solid rgba(223,193,142,0.16);
                    border-radius: 999px;
                    bottom: calc(122px + env(safe-area-inset-bottom));
                    color: #fff8ea;
                    display: inline-flex;
                    font: 800 0.52rem/1 'Inter', sans-serif;
                    gap: 5px;
                    left: 10px;
                    letter-spacing: 0.05em;
                    opacity: 0.74;
                    padding: 5px 7px;
                    position: absolute;
                    text-transform: uppercase;
                    z-index: 545;
                }
                .mobile-map-preview-stat svg {
                    height: 10px;
                    width: 10px;
                }
                .mobile-map-search-panel {
                    bottom: calc(12px + env(safe-area-inset-bottom));
                    left: 10px;
                    pointer-events: none;
                    position: absolute;
                    right: 10px;
                    z-index: 1800;
                }
                .mobile-map-search-panel :global(.home-search-box-map) {
                    pointer-events: auto;
                    position: relative;
                    width: 100%;
                    z-index: 1;
                }
                .mobile-map-search-panel :global(.home-search-suggestions) {
                    z-index: 2;
                }
                .mobile-map-preview-panel :global(.map-mobile-action-dock) {
                    z-index: 720;
                }
                .mobile-search-this-area-button {
                    align-items: center;
                    background: rgba(255,253,248,0.96);
                    border: 1px solid rgba(255,255,255,0.42);
                    border-radius: 999px;
                    box-shadow:
                        0 16px 34px rgba(18,14,8,0.2),
                        0 0 0 1px rgba(184,148,95,0.1) inset;
                    color: #211c16;
                    cursor: pointer;
                    display: inline-flex;
                    font: 900 0.68rem/1 'Inter', sans-serif;
                    gap: 6px;
                    justify-content: center;
                    left: 50%;
                    min-height: 35px;
                    max-width: min(270px, calc(100% - 24px));
                    padding: 0 11px;
                    position: absolute;
                    top: 52px;
                    transform: translateX(-50%);
                    white-space: nowrap;
                    z-index: 980;
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                }
                .mobile-search-this-area-button svg {
                    color: #a78042;
                    flex: 0 0 auto;
                }
                .mobile-search-this-area-button strong {
                    align-items: center;
                    background: linear-gradient(135deg, #dfc18e, #b8945f);
                    border-radius: 999px;
                    color: #111;
                    display: inline-flex;
                    font-size: 0.62rem;
                    height: 21px;
                    justify-content: center;
                    min-width: 21px;
                    padding: 0 6px;
                }
                .mobile-map-lock-hint {
                    align-items: center;
                    background: rgba(18,18,18,0.9);
                    border: 1px solid rgba(223,193,142,0.36);
                    border-radius: 999px;
                    box-shadow: 0 16px 34px rgba(0,0,0,0.26);
                    color: #fff8ea;
                    display: inline-flex;
                    font: 850 0.72rem/1.18 'Inter', sans-serif;
                    justify-content: center;
                    left: 50%;
                    max-width: calc(100% - 36px);
                    opacity: 0;
                    padding: 10px 14px;
                    pointer-events: none;
                    position: absolute;
                    text-align: center;
                    top: 64px;
                    transform: translate(-50%, -8px);
                    transition: opacity 0.2s ease, transform 0.2s ease;
                    width: max-content;
                    z-index: 755;
                }
                .mobile-map-lock-hint.is-visible {
                    opacity: 1;
                    transform: translate(-50%, 0);
                }
                .mobile-map-interaction-lock {
                    background: transparent;
                    border: 0;
                    cursor: default;
                    inset: 0;
                    margin: 0;
                    padding: 0;
                    position: absolute;
                    touch-action: pan-y;
                    z-index: 700;
                }
                @media (max-width: 640px) {
                    .mobile-map-modal {
                        border-radius: 16px;
                        height: calc(100svh - 24px);
                    }
                }
            `}</style>
        </div>
    )
}
