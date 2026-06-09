'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { Building2, Layers, MapPin, Satellite, SlidersHorizontal, Sparkles } from 'lucide-react'

export interface DashboardMapLocation {
    id?: string
    name: string
    subtitle: string
    total: number
    leads?: number
    qualified?: number
    source?: string
    lat?: number
    lng?: number
    ip_address?: string | null
    device_type?: string | null
    browser?: string | null
    os?: string | null
    user_agent?: string | null
    funnel_stage?: string | null
    max_scroll?: number | null
    page_views?: number | null
    referrer?: string | null
    utm_source?: string | null
    utm_medium?: string | null
    utm_campaign?: string | null
    last_visit_at?: string | null
    is_lead?: boolean
}

const CITY_COORDS: Record<string, [number, number]> = {
    'balneario camboriu': [-26.9926, -48.6352],
    'balneário camboriú': [-26.9926, -48.6352],
    camboriu: [-27.0247, -48.6503],
    'camboriú': [-27.0247, -48.6503],
    itajai: [-26.9101, -48.6705],
    'itajaí': [-26.9101, -48.6705],
    itapema: [-27.0903, -48.6114],
    'porto belo': [-27.1578, -48.5536],
    bombinhas: [-27.1382, -48.5134],
    florianopolis: [-27.5949, -48.5482],
    'florianópolis': [-27.5949, -48.5482],
    joinville: [-26.3044, -48.8487],
    curitiba: [-25.4284, -49.2733],
    'sao paulo': [-23.5558, -46.6396],
    'são paulo': [-23.5558, -46.6396],
    'rio de janeiro': [-22.9068, -43.1729],
    'porto alegre': [-30.0346, -51.2177],
}

type LeadMapStyle = 'luxury' | 'satellite' | 'classic'
type LeadQuickFilter = 'all' | 'leads' | 'visitors' | 'paid' | 'organic'

const QUICK_FILTERS: Array<{ value: LeadQuickFilter; label: string }> = [
    { value: 'all', label: 'Todos' },
    { value: 'leads', label: 'Leads' },
    { value: 'visitors', label: 'Visitantes' },
    { value: 'paid', label: 'Trafego pago' },
    { value: 'organic', label: 'Organico' },
]

const MAP_STYLES: Array<{ value: LeadMapStyle; label: string; icon: 'sparkles' | 'satellite' | 'layers' }> = [
    { value: 'luxury', label: 'Luxo', icon: 'sparkles' },
    { value: 'satellite', label: 'Satelite', icon: 'satellite' },
    { value: 'classic', label: 'Claro', icon: 'layers' },
]

function normalize(value: unknown) {
    return String(value || '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
}

function positionFor(location: DashboardMapLocation, index: number): [number, number] {
    if (Number.isFinite(location.lat) && Number.isFinite(location.lng)) {
        return [Number(location.lat), Number(location.lng)]
    }

    const normalizedName = normalize(location.name)
    const exact = CITY_COORDS[normalizedName]
    if (exact) return jitter(exact, index)

    const matched = Object.entries(CITY_COORDS).find(([key]) => normalizedName.includes(normalize(key)))
    if (matched) return jitter(matched[1], index)

    const fallback: [number, number] = [
        -26.9926 + ((index % 5) - 2) * 0.36,
        -48.6352 + (Math.floor(index / 5) - 1) * 0.42,
    ]
    return fallback
}

function jitter(base: [number, number], index: number): [number, number] {
    const ring = (index % 9) + 1
    const angle = (index * 137.5 * Math.PI) / 180
    const radius = 0.006 * ring
    return [
        base[0] + Math.sin(angle) * radius,
        base[1] + Math.cos(angle) * radius,
    ]
}

function createLeadIcon(location: DashboardMapLocation, active = false) {
    const isLead = Boolean(location.is_lead || Number(location.leads || 0) > 0)
    return L.divIcon({
        className: 'dashboard-lead-marker',
        html: `<div class="dashboard-lead-pin ${isLead ? 'dashboard-lead-pin--lead' : ''} ${active ? 'dashboard-lead-pin--active' : ''}">
            <span class="dashboard-lead-pin-head"><i></i></span>
            <span class="dashboard-lead-pin-label">${isLead ? 'Lead' : 'Visitante'}</span>
        </div>`,
        iconSize: [74, 84],
        iconAnchor: [37, 78],
    })
}

function getStyleIcon(icon: 'sparkles' | 'satellite' | 'layers') {
    if (icon === 'satellite') return <Satellite size={14} />
    if (icon === 'layers') return <Layers size={14} />
    return <Sparkles size={14} />
}

function locationSourceText(location: DashboardMapLocation) {
    return [
        location.source,
        location.utm_source,
        location.utm_medium,
        location.utm_campaign,
        location.referrer,
    ].filter(Boolean).join(' ').toLowerCase()
}

function matchesQuickFilter(location: DashboardMapLocation, filter: LeadQuickFilter) {
    const isLead = Boolean(location.is_lead || Number(location.leads || 0) > 0)
    const text = locationSourceText(location)

    if (filter === 'all') return true
    if (filter === 'leads') return isLead
    if (filter === 'visitors') return !isLead
    if (filter === 'paid') return ['paid', 'cpc', 'google', 'meta', 'facebook', 'instagram', 'ads', 'gclid', 'fbclid'].some(term => text.includes(term))
    if (filter === 'organic') return ['organic', 'organico', 'direct', 'direto', 'seo'].some(term => text.includes(term)) || !text

    return true
}

function formatDate(value?: string | null) {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '-'
    return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function Detail({ label, value }: { label: string; value?: string | number | null }) {
    if (value === undefined || value === null || value === '') return null
    return (
        <div className="dashboard-map-detail">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    )
}

function LeadDetailsCard({ location, compactMode = false }: { location: DashboardMapLocation; compactMode?: boolean }) {
    return (
        <div className={compactMode ? 'dashboard-map-popup-card compact' : 'dashboard-map-popup-card'}>
            <strong>{location.is_lead ? 'Lead rastreado' : 'Visitante rastreado'}</strong>
            <span>{location.name} {location.subtitle ? `- ${location.subtitle}` : ''}</span>
            <div className="dashboard-map-detail-grid">
                <Detail label="IP" value={location.ip_address || 'Nao informado'} />
                <Detail label="Origem" value={location.source || 'Direto'} />
                <Detail label="Regiao" value={location.subtitle || 'Nao informada'} />
                <Detail label="Funil" value={location.funnel_stage || (location.is_lead ? 'lead' : 'visitor')} />
                <Detail label="Dispositivo" value={location.device_type} />
                <Detail label="Navegador" value={location.browser} />
                <Detail label="Sistema" value={location.os} />
                <Detail label="Paginas" value={location.page_views} />
                <Detail label="Scroll max." value={typeof location.max_scroll === 'number' ? `${location.max_scroll}%` : null} />
                <Detail label="UTM source" value={location.utm_source} />
                <Detail label="UTM medium" value={location.utm_medium} />
                <Detail label="Campanha" value={location.utm_campaign} />
                <Detail label="Ultima visita" value={formatDate(location.last_visit_at)} />
            </div>
            {!compactMode && (
                <>
                    <small>Referrer: {location.referrer || 'Nao informado'}</small>
                    <small>User agent: {location.user_agent || 'Nao informado'}</small>
                </>
            )}
        </div>
    )
}

function MapAutoFit({ points }: { points: [number, number][] }) {
    const map = useMap()

    useEffect(() => {
        const timers = [120, 450, 900].map(delay => setTimeout(() => map.invalidateSize({ animate: false }), delay))
        if (points.length > 0) {
            const bounds = L.latLngBounds(points)
            setTimeout(() => map.fitBounds(bounds, { padding: [78, 78], maxZoom: 13 }), 180)
        }
        return () => timers.forEach(clearTimeout)
    }, [map, points])

    return null
}

export default function DashboardLeadMap({
    locations,
    title = 'Leads por localizacao',
}: {
    locations: DashboardMapLocation[]
    title?: string
}) {
    const [mapStyle, setMapStyle] = useState<LeadMapStyle>('satellite')
    const [quickFilter, setQuickFilter] = useState<LeadQuickFilter>('all')
    const [mobileControlsOpen, setMobileControlsOpen] = useState(false)
    const mapped = useMemo(() => locations.map((location, index) => ({
        ...location,
        position: positionFor(location, index),
    })), [locations])

    const filteredMapped = useMemo(
        () => mapped.filter(location => matchesQuickFilter(location, quickFilter)),
        [mapped, quickFilter]
    )
    const points = useMemo(() => filteredMapped.map(item => item.position), [filteredMapped])
    const center = points[0] || [-26.9926, -48.6352]
    const [activeId, setActiveId] = useState<string>('')
    const activeLocation = useMemo(() => {
        if (filteredMapped.length === 0) return null
        return filteredMapped.find(location => (location.id || `${location.name}-${location.subtitle}`) === activeId) || filteredMapped[0]
    }, [activeId, filteredMapped])

    return (
        <div className={`dashboard-lead-map-block lead-map-style-${mapStyle}${mobileControlsOpen ? ' dashboard-lead-map-mobile-filters-open' : ''}`}>
            <div className="dashboard-lead-map-topbar" aria-label="Filtros rapidos do mapa de leads">
                {QUICK_FILTERS.map(filter => (
                    <button
                        key={filter.value}
                        type="button"
                        className={quickFilter === filter.value ? 'active' : ''}
                        onClick={() => setQuickFilter(filter.value)}
                    >
                        {filter.label}
                    </button>
                ))}
            </div>

            <div className="dashboard-lead-map-style-control" aria-label="Estilo do mapa de leads">
                {MAP_STYLES.map(style => (
                    <button
                        key={style.value}
                        type="button"
                        className={mapStyle === style.value ? 'active' : ''}
                        onClick={() => setMapStyle(style.value)}
                    >
                        {getStyleIcon(style.icon)}
                        <span>{style.label}</span>
                    </button>
                ))}
            </div>

            <div className="dashboard-lead-map-mobile-style-stack" role="group" aria-label="Estilo do mapa de leads">
                <div className="dashboard-lead-map-mobile-style-grid">
                    {MAP_STYLES.map(style => (
                        <button
                            key={style.value}
                            type="button"
                            className={mapStyle === style.value ? 'active' : ''}
                            onClick={() => setMapStyle(style.value)}
                        >
                            {getStyleIcon(style.icon)}
                            <span>{style.label}</span>
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    className={`dashboard-lead-map-mobile-more-filter-button${mobileControlsOpen ? ' active' : ''}`}
                    aria-label="Mais filtro"
                    aria-expanded={mobileControlsOpen}
                    onClick={() => setMobileControlsOpen(isOpen => !isOpen)}
                >
                    <SlidersHorizontal size={14} />
                    <span>Mais filtro</span>
                </button>
            </div>

            <div className={`dashboard-lead-map-mobile-filter-panel${mobileControlsOpen ? ' is-open' : ''}`} role="group" aria-label="Mais filtros do mapa de leads">
                <div className="dashboard-lead-map-mobile-filter-grid">
                    {QUICK_FILTERS.map(filter => (
                        <button
                            key={filter.value}
                            type="button"
                            className={quickFilter === filter.value ? 'active' : ''}
                            onClick={() => setQuickFilter(filter.value)}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="dashboard-real-map-label">
                <Building2 size={14} />
                <span>{filteredMapped.length} pontos no mapa</span>
            </div>

            {activeLocation && (
                <div className="dashboard-lead-map-selected">
                    <MapPin size={14} />
                    <span>{activeLocation.name}</span>
                </div>
            )}

            <MapContainer
                center={center}
                zoom={points.length > 1 ? 8 : 12}
                zoomControl={false}
                scrollWheelZoom
                style={{ position: 'absolute', inset: 0, background: '#111' }}
            >
                {mapStyle === 'luxury' && (
                    <TileLayer
                        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap'
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        maxZoom={20}
                    />
                )}
                {mapStyle === 'classic' && (
                    <TileLayer
                        attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap'
                        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                        maxZoom={20}
                    />
                )}
                {mapStyle === 'satellite' && (
                    <TileLayer
                        attribution='Tiles &copy; Esri'
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        maxZoom={19}
                    />
                )}
                <MapAutoFit points={points} />
                {filteredMapped.map(location => (
                    <Marker
                        key={location.id || `${location.name}-${location.subtitle}-${location.position.join(',')}`}
                        position={location.position}
                        icon={createLeadIcon(location, activeLocation?.id === location.id)}
                        zIndexOffset={activeLocation?.id === location.id ? 1000 : 0}
                        eventHandlers={{
                            mouseover: () => setActiveId(location.id || `${location.name}-${location.subtitle}`),
                            click: (event: any) => {
                                setActiveId(location.id || `${location.name}-${location.subtitle}`)
                                event.target.openPopup()
                            },
                        }}
                    >
                        <Popup className="dashboard-lead-map-popup">
                            <LeadDetailsCard location={location} compactMode />
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    )
}
