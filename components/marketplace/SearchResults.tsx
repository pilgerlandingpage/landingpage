'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MapPinned, Search, SearchX, Sparkles, X } from 'lucide-react'
import MapSearch from './MapSearch'
import SearchViews from './SearchViews'
import PropertyCard from './PropertyCard'
import HomeSearchBar, { type HomeSearchValues } from './HomeSearchBar'
import { replaceItajaiWithPraiaBrava } from '@/lib/locations/display'
import { trackEvent } from '@/lib/tracking/client'

const MAX_RENDERED_CARDS = 60
const OFFICE_SEARCH_PARAM_VALUE = '1'
const OFFICE_LOCATION_MARKER = {
    latLng: [-26.95665680834595, -48.62979654548911] as [number, number],
    title: 'Imobiliária Guilherme Pilger',
    subtitle: 'Praia Brava',
    address: 'Av. Carlos Drummond de Andrade, 33 - Loja 01 - Praia Brava, Itajaí - SC, 88306-800',
}

function toCoordinate(value: number | string | null | undefined) {
    if (typeof value === 'string') return Number(value.replace(',', '.'))
    return Number(value)
}

function getLatLng(property: any): [number, number] | null {
    const lat = toCoordinate(property.latitude)
    const lng = toCoordinate(property.longitude)

    if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
    ) {
        return [lat, lng]
    }

    if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lng >= -90 &&
        lng <= 90 &&
        lat >= -180 &&
        lat <= 180
    ) {
        return [lng, lat]
    }

    return null
}

function getFilterLabel(key: string, value: string) {
    const cityLabels: Record<string, string> = {
        'Balneário Camboriú': 'B. Camboriú',
        'Itajaí': 'Praia Brava',
        Itajai: 'Praia Brava',
        Itapema: 'Itapema',
        'Porto Belo': 'Porto Belo',
    }

    const priceLabels: Record<string, string> = {
        '3000000-5000000': 'R$ 4 mi a R$ 5 mi',
        '4000000-6000000': 'R$ 4 mi a R$ 6 mi',
        '6000000-8000000': 'R$ 6 mi a R$ 8 mi',
        '8000000-10000000': 'R$ 8 mi a R$ 10 mi',
        '10000000-': 'Acima de R$ 10 mi',
    }

    const labels: Record<string, string> = {
        q: `Busca: ${replaceItajaiWithPraiaBrava(value)}`,
        city: cityLabels[value] || replaceItajaiWithPraiaBrava(value),
        type: value,
        price: `Valor: ${priceLabels[value] || value.replace('-', ' ate ')}`,
        offer: value === 'rent' ? 'Aluguel' : 'Venda',
        bedroomsMin: `${value}+ dormitórios`,
        suitesMin: `${value}+ suites`,
        bathroomsMin: `${value}+ banheiros`,
        parkingMin: `${value}+ vagas`,
        areaMin: `A partir de ${value}m2`,
        areaMax: `Ate ${value}m2`,
        priceMin: `Min. R$ ${Number(value).toLocaleString('pt-BR')}`,
        priceMax: `Max. R$ ${Number(value).toLocaleString('pt-BR')}`,
        office: 'Imobiliária Guilherme Pilger',
        subtype: value.replace(/-/g, ' '),
        tag: value.replace(/-/g, ' '),
    }

    return labels[key] || `${key}: ${value}`
}

interface MapBounds {
    north: number
    south: number
    east: number
    west: number
}

interface SearchResultsProps {
    properties: any[]
    propertiesWithCoords: any[]
    lpMap: Record<string, string>
}

export default function SearchResults({ properties, propertiesWithCoords, lpMap }: SearchResultsProps) {
    const searchParams = useSearchParams()
    const searchKey = searchParams.toString()
    const isOfficeSearch = searchParams.get('office') === OFFICE_SEARCH_PARAM_VALUE
    const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null)
    const [mapHoveredId, setMapHoveredId] = useState<string | null>(null)
    const [mapBoundsState, setMapBoundsState] = useState<{ key: string; bounds: MapBounds | null }>({ key: '', bounds: null })
    const [showRefineSearch, setShowRefineSearch] = useState(false)
    const [refineOfficeSelection, setRefineOfficeSelection] = useState<{ key: string; selected: boolean }>({ key: '', selected: false })
    const refinePanelRef = useRef<HTMLDivElement>(null)
    const isOfficeSelectedInRefine = refineOfficeSelection.key === searchKey && refineOfficeSelection.selected
    const shouldShowOfficeOnMap = isOfficeSearch || isOfficeSelectedInRefine
    const mapViewKey = `${searchKey}:${shouldShowOfficeOnMap ? 'office' : 'properties'}`
    const mapBounds = mapBoundsState.key === mapViewKey ? mapBoundsState.bounds : null

    const activeFilters = useMemo(() => {
        const ignored = new Set(['page'])

        return Array.from(searchParams.entries())
            .filter(([key, value]) => value && !ignored.has(key))
            .map(([key, value]) => ({
                key,
                value,
                label: getFilterLabel(key, value),
            }))
    }, [searchKey, searchParams])

    const makeRemoveFilterHref = useCallback((key: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete(key)
        const query = params.toString()
        return query ? `/busca?${query}` : '/busca'
    }, [searchParams])

    const handleCardHover = useCallback((id: string | null) => {
        setHoveredPropertyId(id)
    }, [])

    const handleMarkerHover = useCallback((id: string | null) => {
        setMapHoveredId(id)
    }, [])

    const handleBoundsChange = useCallback((bounds: MapBounds) => {
        setMapBoundsState({ key: mapViewKey, bounds })
    }, [mapViewKey])

    const handleRefineSearchValuesChange = useCallback((values: HomeSearchValues) => {
        setRefineOfficeSelection({ key: searchKey, selected: values.locationType === 'office' })
    }, [searchKey])

    const visibleProperties = useMemo(() => {
        if (!mapBounds) return properties

        return properties.filter(p => {
            const latLng = getLatLng(p)
            if (!latLng) return true
            const [lat, lng] = latLng

            return (
                lat >= mapBounds.south &&
                lat <= mapBounds.north &&
                lng >= mapBounds.west &&
                lng <= mapBounds.east
            )
        })
    }, [properties, mapBounds])

    const visibleCount = visibleProperties.length
    const totalCount = properties.length
    const renderedProperties = visibleProperties.slice(0, MAX_RENDERED_CARDS)
    const hiddenVisibleCount = Math.max(0, visibleCount - renderedProperties.length)
    const countLabel = mapBounds && visibleCount < totalCount ? 'imoveis nesta area' : 'imoveis encontrados'

    const handleSearchButtonClick = useCallback(() => {
        const nextOpen = !showRefineSearch
        setShowRefineSearch(nextOpen)

        if (nextOpen) {
            window.setTimeout(() => {
                refinePanelRef.current?.querySelector('input')?.focus()
            }, 0)
        }

        void trackEvent('search_results_adjust_filters_clicked', {
            active_filters: activeFilters,
            total_count: totalCount,
            visible_count: visibleCount,
            opened: nextOpen,
        })
    }, [activeFilters, showRefineSearch, totalCount, visibleCount])

    return (
        <>
            <style>{`
                .search-card-wrap {
                    position: relative;
                    min-width: 0;
                    border-radius: 12px;
                    transition: box-shadow 0.28s ease, transform 0.28s ease;
                }
                .search-card-wrap--highlighted {
                    box-shadow:
                        0 0 0 2px rgba(201,169,110,0.92),
                        0 14px 34px rgba(184,148,95,0.22);
                    transform: translateY(-2px);
                    z-index: 10;
                }
                .search-results-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 22px 18px;
                    min-width: 0;
                }
                .result-lux-header {
                    position: sticky;
                    top: 0;
                    z-index: 20;
                    margin: 0 0 18px;
                    padding: 14px 0 16px;
                    background:
                        linear-gradient(180deg, rgba(247,245,240,0.98) 0%, rgba(247,245,240,0.9) 82%, rgba(247,245,240,0) 100%);
                    backdrop-filter: blur(16px);
                }
                .result-kicker {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    margin-bottom: 8px;
                    color: #a78042;
                    font: 900 0.68rem/1 'Inter', sans-serif;
                    letter-spacing: 0.18em;
                    text-transform: uppercase;
                }
                .result-main-row {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    gap: 14px;
                }
                .result-title {
                    margin: 0;
                    color: #201d19;
                    font-family: 'Noto Serif', Georgia, serif;
                    font-size: clamp(1.38rem, 2vw, 2rem);
                    font-weight: 700;
                    line-height: 1.05;
                    letter-spacing: 0;
                }
                .result-count {
                    margin-top: 6px;
                    color: #6d665c;
                    font: 650 0.84rem/1.3 'Inter', sans-serif;
                }
                .result-count strong {
                    color: #b8945f;
                    font-size: 1.12em;
                    font-weight: 900;
                }
                .result-count span {
                    color: #aaa194;
                    font-weight: 500;
                }
                .result-actions {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    flex-shrink: 0;
                }
                .result-action {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 7px;
                    height: 36px;
                    padding: 0 12px;
                    border: 1px solid rgba(36,31,24,0.12);
                    border-radius: 999px;
                    background: rgba(255,255,255,0.78);
                    color: #2a261f;
                    font: 850 0.72rem/1 'Inter', sans-serif;
                    text-decoration: none;
                    box-shadow: 0 10px 24px rgba(37,29,19,0.08);
                    white-space: nowrap;
                }
                .result-action--gold {
                    background: linear-gradient(135deg, #dfc18e, #b8945f);
                    border-color: rgba(255,255,255,0.34);
                    color: #111;
                }
                .result-action-button {
                    cursor: pointer;
                    font-family: inherit;
                }
                .result-refine-panel {
                    margin-top: 13px;
                    padding: 13px;
                    border: 1px solid rgba(184,148,95,0.2);
                    border-radius: 16px;
                    background: rgba(255,255,255,0.86);
                    box-shadow: 0 14px 32px rgba(31,24,16,0.08);
                }
                .active-filter-row {
                    display: flex;
                    gap: 8px;
                    margin-top: 14px;
                    overflow-x: auto;
                    padding-bottom: 2px;
                    scrollbar-width: none;
                }
                .active-filter-row::-webkit-scrollbar { display: none; }
                .active-filter-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    height: 30px;
                    padding: 0 9px 0 11px;
                    border: 1px solid rgba(184,148,95,0.2);
                    border-radius: 999px;
                    background: rgba(255,255,255,0.74);
                    color: #53483a;
                    font: 800 0.68rem/1 'Inter', sans-serif;
                    text-decoration: none;
                    white-space: nowrap;
                }
                .active-filter-chip svg {
                    color: #a78042;
                }
                .search-render-limit,
                .search-empty-state {
                    margin-top: 18px;
                    padding: 16px 18px;
                    border: 1px solid rgba(184,148,95,0.14);
                    border-radius: 14px;
                    background: rgba(255,255,255,0.76);
                    color: #71695d;
                    font: 700 0.82rem/1.45 'Inter', sans-serif;
                    text-align: center;
                    box-shadow: 0 10px 26px rgba(30,24,17,0.06);
                }
                .search-empty-state {
                    display: grid;
                    justify-items: center;
                    gap: 10px;
                    padding: 42px 20px;
                }
                .search-empty-icon {
                    display: grid;
                    place-items: center;
                    width: 46px;
                    height: 46px;
                    border-radius: 50%;
                    background: #1b1a18;
                    color: #dfc18e;
                    box-shadow: 0 16px 30px rgba(20,18,15,0.18);
                }
                .search-empty-title {
                    margin: 4px 0 0;
                    color: #211d18;
                    font-family: 'Noto Serif', Georgia, serif;
                    font-size: 1.12rem;
                    font-weight: 700;
                }
                .search-empty-copy {
                    margin: 0;
                    max-width: 330px;
                    color: #81786c;
                    font-size: 0.84rem;
                    font-weight: 650;
                }
                .search-footer {
                    margin-top: 28px;
                    padding: 22px 0 10px;
                    border-top: 1px solid rgba(184,148,95,0.16);
                    color: #9a9286;
                    font: 700 0.68rem/1 'Inter', sans-serif;
                    letter-spacing: 0.08em;
                    text-align: center;
                    text-transform: uppercase;
                }
                @media (max-width: 649px) {
                    .result-lux-header {
                        margin: 0 -2px 12px;
                        padding: 4px 2px 13px;
                        background:
                            linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(249,247,243,0.95) 82%, rgba(249,247,243,0) 100%);
                    }
                    .result-kicker {
                        display: none;
                    }
                    .result-main-row {
                        align-items: center;
                        gap: 10px;
                    }
                    .result-title {
                        font-size: 1rem;
                    }
                    .result-count {
                        margin-top: 2px;
                        font-size: 0.78rem;
                    }
                    .result-actions {
                        gap: 6px;
                    }
                    .result-action {
                        width: 34px;
                        height: 34px;
                        padding: 0;
                        border-radius: 50%;
                        border: 1px solid rgba(31,27,21,0.12);
                    }
                    .result-action span {
                        display: none;
                    }
                    .result-refine-panel {
                        margin-top: 10px;
                        padding: 10px;
                        border-radius: 14px;
                    }
                    .search-empty-state .result-action {
                        width: auto;
                        height: 36px;
                        padding: 0 13px;
                        border-radius: 999px;
                    }
                    .active-filter-row {
                        margin-top: 10px;
                    }
                    .active-filter-chip {
                        height: 28px;
                        font-size: 0.64rem;
                    }
                    .search-results-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 18px 10px;
                    }
                    .search-card-wrap--highlighted {
                        transform: none;
                    }
                    .search-footer {
                        margin-top: 20px;
                        padding-bottom: 4px;
                        font-size: 0.58rem;
                    }
                }
            `}</style>

            <SearchViews
                map={
                    <MapSearch
                        properties={shouldShowOfficeOnMap ? [] : propertiesWithCoords}
                        hoveredPropertyId={hoveredPropertyId}
                        onMarkerHover={handleMarkerHover}
                        onBoundsChange={handleBoundsChange}
                        refitKey={mapViewKey}
                        officeMarker={shouldShowOfficeOnMap ? OFFICE_LOCATION_MARKER : null}
                    />
                }
            >
                <header className="result-lux-header">
                    <div className="result-kicker">
                        <Sparkles size={13} />
                        Curadoria Pilger
                    </div>
                    <div className="result-main-row">
                        <div>
                            <h1 className="result-title">Imoveis selecionados</h1>
                            <p className="result-count">
                                <strong>{mapBounds && visibleCount < totalCount ? visibleCount : totalCount}</strong> {countLabel}
                                {mapBounds && visibleCount < totalCount && (
                                    <span> ({totalCount} total)</span>
                                )}
                            </p>
                        </div>
                        <div className="result-actions">
                            {activeFilters.length > 0 && (
                                <Link
                                    href="/busca"
                                    className="result-action"
                                    aria-label="Limpar filtros"
                                    onClick={() => {
                                        void trackEvent('search_results_clear_clicked', {
                                            active_filters: activeFilters,
                                            total_count: totalCount,
                                            visible_count: visibleCount,
                                        })
                                    }}
                                >
                                    <X size={15} />
                                    <span>Limpar</span>
                                </Link>
                            )}
                            <button
                                type="button"
                                className="result-action result-action--gold result-action-button"
                                aria-expanded={showRefineSearch}
                                aria-label="Buscar imóveis"
                                onClick={handleSearchButtonClick}
                            >
                                <Search size={15} />
                                <span>Buscar</span>
                            </button>
                        </div>
                    </div>
                    {showRefineSearch && (
                        <div className="result-refine-panel" ref={refinePanelRef}>
                            <HomeSearchBar
                                initialSearchParams={searchParams.toString()}
                                onValuesChange={handleRefineSearchValuesChange}
                                variant="results"
                            />
                        </div>
                    )}
                    {activeFilters.length > 0 && (
                        <div className="active-filter-row" aria-label="Filtros ativos">
                            {activeFilters.map(filter => (
                                <Link
                                    key={`${filter.key}-${filter.value}`}
                                    href={makeRemoveFilterHref(filter.key)}
                                    className="active-filter-chip"
                                    onClick={() => {
                                        void trackEvent('search_results_filter_removed', {
                                            filter_key: filter.key,
                                            filter_value: filter.value,
                                            filter_label: filter.label,
                                            active_filters: activeFilters,
                                            total_count: totalCount,
                                            visible_count: visibleCount,
                                        })
                                    }}
                                >
                                    {filter.label}
                                    <X size={12} />
                                </Link>
                            ))}
                        </div>
                    )}
                </header>

                {visibleProperties.length === 0 ? (
                    <div className="search-empty-state">
                        <div className="search-empty-icon">
                            <SearchX size={20} />
                        </div>
                        <h2 className="search-empty-title">Nenhum imovel nesta area</h2>
                        <p className="search-empty-copy">
                            Amplie o mapa ou remova um filtro para encontrar outras oportunidades.
                        </p>
                        <Link
                            href="/busca"
                            className="result-action result-action--gold"
                            onClick={() => {
                                void trackEvent('search_results_empty_view_all_clicked', {
                                    active_filters: activeFilters,
                                    total_count: totalCount,
                                    visible_count: visibleCount,
                                })
                            }}
                        >
                            <MapPinned size={15} />
                            Ver todos
                        </Link>
                    </div>
                ) : (
                    <>
                        <div className="search-results-grid">
                            {renderedProperties.map((property: any, index: number) => (
                                <div
                                    key={property.id}
                                    className={`search-card-wrap ${mapHoveredId === property.id ? 'search-card-wrap--highlighted' : ''}`}
                                    onMouseEnter={() => handleCardHover(property.id)}
                                    onMouseLeave={() => handleCardHover(null)}
                                >
                                    <PropertyCard
                                        property={property}
                                        landingPageSlug={lpMap[property.id]}
                                        imagePriority={index < 4}
                                        variant="homeCompact"
                                    />
                                </div>
                            ))}
                        </div>
                        {hiddenVisibleCount > 0 && (
                            <div className="search-render-limit">
                                Mostrando os primeiros {renderedProperties.length} imoveis desta area. Aproxime o mapa para refinar os resultados.
                            </div>
                        )}
                    </>
                )}

                <footer className="search-footer">
                    {new Date().getFullYear()} Guilherme Pilger Corretor de Imoveis
                </footer>
            </SearchViews>
        </>
    )
}
