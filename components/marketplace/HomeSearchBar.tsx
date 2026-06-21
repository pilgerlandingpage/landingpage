'use client'

import { Building2, ChevronDown, MapPin, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { replaceItajaiWithPraiaBrava } from '@/lib/locations/display'
import { propertyDetailsPath } from '@/lib/properties/responsive-destination'
import { appendNaturalSearchParams } from '@/lib/properties/natural-search'
import { trackEvent } from '@/lib/tracking/client'

type Suggestion = {
    type: 'city' | 'neighborhood' | 'property' | 'office'
    label: string
    count?: number
    id?: string
    source_slug?: string | null
    slug?: string | null
    price?: number
    city?: string
}

export type HomeSearchValues = {
    locationLabel: string
    locationType?: 'city' | 'neighborhood' | 'office'
    locationValue?: string
    typeValue: string
    priceValue: string
}

type HomeSearchBarProps = {
    initialSearchParams?: string
    onValuesChange?: (values: HomeSearchValues) => void
    variant?: 'home' | 'map' | 'results'
}

const PROPERTY_TYPE_GROUPS = [
    {
        label: 'APARTAMENTOS',
        options: [
            { value: 'type:Apartamento', label: 'Apartamento' },
            { value: 'subtype:duplex', label: 'Duplex / Triplex' },
            { value: 'subtype:garden', label: 'Apartamento Garden' },
            { value: 'subtype:cobertura', label: 'Cobertura' },
            { value: 'subtype:predio-residencial', label: 'Predio Residencial' },
        ],
    },
    {
        label: 'CASAS',
        options: [
            { value: 'type:Casa', label: 'Casa' },
            { value: 'subtype:condominio', label: 'Casa em Condominio' },
        ],
    },
    {
        label: 'TERRENOS',
        options: [
            { value: 'type:Terreno', label: 'Terreno' },
            { value: 'subtype:terreno-comercial', label: 'Terreno Comercial' },
            { value: 'subtype:terreno-condominio', label: 'Terreno em Condominio' },
        ],
    },
    {
        label: 'IMOVEIS COMERCIAIS',
        options: [
            { value: 'subtype:galpao', label: 'Galpao / Deposito' },
            { value: 'subtype:sala-comercial', label: 'Sala Comercial' },
        ],
    },
]

const PROPERTY_TYPE_OPTIONS = [
    { value: 'all', label: 'Todos os Imoveis' },
    ...PROPERTY_TYPE_GROUPS.flatMap(group => group.options),
]

const PRICE_OPTIONS = [
    { value: 'all', label: 'Acima de R$4 mi' },
    { value: '4000000-6000000', label: 'R$4.000.000 a R$6.000.000' },
    { value: '6000000-8000000', label: 'R$6.000.000 a R$8.000.000' },
    { value: '8000000-10000000', label: 'R$8.000.000 a R$10.000.000' },
    { value: '10000000-', label: 'a partir de R$10.000.000' },
]

const FALLBACK_CITIES = [
    { label: 'Balneario Camboriu / SC', value: 'Balneario Camboriu' },
    { label: 'Praia Brava / SC', value: 'Praia Brava' },
    { label: 'Itapema / SC', value: 'Itapema' },
    { label: 'Porto Belo / SC', value: 'Porto Belo' },
    { label: 'Camboriu / SC', value: 'Camboriu' },
    { label: 'Bombinhas / SC', value: 'Bombinhas' },
    { label: 'Navegantes / SC', value: 'Navegantes' },
    { label: 'Penha / SC', value: 'Penha' },
]

const OFFICE_SUGGESTION: Suggestion = {
    type: 'office',
    label: 'Imobiliária Guilherme Pilger',
    city: 'Praia Brava',
}
const OFFICE_SEARCH_PARAM_VALUE = '1'
const OFFICE_AREA_SEARCH_TERMS = normalize('Balneario Camboriu BC Praia dos Amores Ponta Brava endereco localizacao Carlos Drummond')
const OFFICE_SEARCH_TERMS = normalize('Imobiliária Guilherme Pilger Praia Brava loja endereço localização Carlos Drummond')

function normalize(value: unknown) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
}

function priceLabel(value: string) {
    return PRICE_OPTIONS.find(option => option.value === value)?.label || 'Acima de R$4 mi'
}

function typeLabel(value: string) {
    return PROPERTY_TYPE_OPTIONS.find(option => option.value === value)?.label || 'Todos os Imoveis'
}

function stripStateSuffix(value: string) {
    return value
        .replace(/\s*\/\s*SC$/i, '')
        .replace(/\s*,\s*SC$/i, '')
        .trim()
}

function canonicalCityValue(value: string) {
    const clean = stripStateSuffix(value)
    const normalized = normalize(clean)

    if (normalized === 'balneario camboriu' || normalized === 'bc') return 'Balneario Camboriu'
    if (normalized === 'itajai' || normalized === 'praia brava') return 'Praia Brava'
    if (normalized === 'itapema') return 'Itapema'
    if (normalized === 'porto belo') return 'Porto Belo'
    if (normalized === 'camboriu') return 'Camboriu'
    if (normalized === 'bombinhas') return 'Bombinhas'
    if (normalized === 'navegantes') return 'Navegantes'
    if (normalized === 'penha') return 'Penha'

    return ''
}

function valuesFromParams(initialSearchParams?: string): HomeSearchValues {
    const params = new URLSearchParams(initialSearchParams || '')
    const subtype = params.get('subtype')
    const type = params.get('type')
    const city = params.get('city')
    const query = params.get('q')
    const office = params.get('office') === OFFICE_SEARCH_PARAM_VALUE
    const price = params.get('price') || 'all'
    const priceValue = PRICE_OPTIONS.some(option => option.value === price) ? price : 'all'

    return {
        locationLabel: office ? OFFICE_SUGGESTION.label : replaceItajaiWithPraiaBrava(city || query || ''),
        locationType: office ? 'office' : city ? 'city' : undefined,
        locationValue: office ? 'office-location' : city || query || '',
        typeValue: subtype ? `subtype:${subtype}` : type ? `type:${type}` : 'all',
        priceValue,
    }
}

function displaySuggestion(suggestion: Suggestion): Suggestion {
    return {
        ...suggestion,
        label: replaceItajaiWithPraiaBrava(suggestion.label),
        city: suggestion.city ? replaceItajaiWithPraiaBrava(suggestion.city) : suggestion.city,
    }
}

function formatPrice(price: number) {
    return new Intl.NumberFormat('pt-BR', {
        currency: 'BRL',
        maximumFractionDigits: 0,
        style: 'currency',
    }).format(price)
}

export default function HomeSearchBar({ initialSearchParams, onValuesChange, variant = 'home' }: HomeSearchBarProps) {
    const router = useRouter()
    const initialValues = useMemo(() => valuesFromParams(initialSearchParams), [initialSearchParams])
    const suggestionsNeedTyping = variant === 'map'
    const [locationLabel, setLocationLabel] = useState(initialValues.locationLabel)
    const [locationType, setLocationType] = useState<HomeSearchValues['locationType']>(initialValues.locationType)
    const [locationValue, setLocationValue] = useState(initialValues.locationValue || '')
    const [typeValue, setTypeValue] = useState(initialValues.typeValue)
    const [priceValue, setPriceValue] = useState(initialValues.priceValue)
    const [suggestions, setSuggestions] = useState<Suggestion[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [hasTypedLocationQuery, setHasTypedLocationQuery] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [activeSuggestion, setActiveSuggestion] = useState(-1)
    const wrapperRef = useRef<HTMLDivElement>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const hasReportedInitialValuesRef = useRef(false)

    useEffect(() => {
        setLocationLabel(initialValues.locationLabel)
        setLocationType(initialValues.locationType)
        setLocationValue(initialValues.locationValue || '')
        setTypeValue(initialValues.typeValue)
        setPriceValue(initialValues.priceValue)
        setHasTypedLocationQuery(false)
        setShowSuggestions(false)
    }, [initialValues])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => () => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
    }, [])

    useEffect(() => {
        if (!onValuesChange) return

        if (!hasReportedInitialValuesRef.current) {
            hasReportedInitialValuesRef.current = true
            return
        }

        onValuesChange({
            locationLabel,
            locationType,
            locationValue,
            priceValue,
            typeValue,
        })
    }, [locationLabel, locationType, locationValue, onValuesChange, priceValue, typeValue])

    const fetchSuggestions = useCallback(async (term: string) => {
        setIsLoading(true)
        try {
            const url = term
                ? `/api/search/suggestions?q=${encodeURIComponent(term)}`
                : '/api/search/suggestions'
            const response = await fetch(url)
            if (!response.ok) return
            const data = await response.json()
            setSuggestions(Array.isArray(data.suggestions) ? data.suggestions.map(displaySuggestion) : [])
        } catch {
            setSuggestions([])
        } finally {
            setIsLoading(false)
        }
    }, [])

    const displayedSuggestions = useMemo(() => {
        const term = normalize(locationLabel)
        const shouldShowOfficeSuggestion = !term || OFFICE_SEARCH_TERMS.includes(term) || OFFICE_AREA_SEARCH_TERMS.includes(term) || variant === 'results'
        const officeSuggestions = shouldShowOfficeSuggestion ? [OFFICE_SUGGESTION] : []

        if (suggestions.length > 0) return [...officeSuggestions, ...suggestions]
        if (locationLabel.trim()) return officeSuggestions

        return [
            ...officeSuggestions,
            ...FALLBACK_CITIES.map<Suggestion>(city => ({
                type: 'city' as const,
                label: city.label,
                city: city.value,
            })),
        ]
    }, [locationLabel, suggestions, variant])

    const groupedSuggestions = useMemo(() => {
        const offices = displayedSuggestions.filter(suggestion => suggestion.type === 'office')
        const cities = displayedSuggestions.filter(suggestion => suggestion.type === 'city')
        const neighborhoods = displayedSuggestions.filter(suggestion => suggestion.type === 'neighborhood')
        const properties = displayedSuggestions.filter(suggestion => suggestion.type === 'property')

        return [
            { key: 'office', label: 'Imobiliária', meta: 'Localização', items: offices },
            { key: 'cities', label: 'Cidades', meta: 'Regiao da Busca', items: cities },
            { key: 'neighborhoods', label: 'Bairros', meta: 'Regiao da Busca', items: neighborhoods },
            { key: 'properties', label: 'Imoveis', meta: 'Match direto', items: properties },
        ].filter(group => group.items.length > 0)
    }, [displayedSuggestions])

    function updateLocation(value: string) {
        const hasSearchTerm = value.trim().length > 0
        setLocationLabel(value)
        setLocationType(undefined)
        setLocationValue('')
        setActiveSuggestion(-1)
        setHasTypedLocationQuery(true)
        setShowSuggestions(!suggestionsNeedTyping || hasSearchTerm)

        if (debounceRef.current) clearTimeout(debounceRef.current)
        if (suggestionsNeedTyping && !hasSearchTerm) {
            setSuggestions([])
            setIsLoading(false)
            return
        }
        debounceRef.current = setTimeout(() => {
            void fetchSuggestions(value)
        }, 240)
    }

    function focusLocation() {
        if (suggestionsNeedTyping && (!hasTypedLocationQuery || !locationLabel.trim())) {
            setShowSuggestions(false)
            return
        }
        setShowSuggestions(true)
        if (displayedSuggestions.length === 0 || (locationLabel.trim() && suggestions.length === 0)) {
            void fetchSuggestions(locationLabel)
        }
    }

    function buildSearchHref() {
        const params = new URLSearchParams()
        const cleanLocation = locationLabel.trim()

        if (locationType === 'office') {
            if (variant !== 'results') return '/#mapa'
            params.set('office', OFFICE_SEARCH_PARAM_VALUE)
        } else {
            const cityValue = locationType === 'city'
                ? canonicalCityValue(locationValue || cleanLocation)
                : locationType === 'neighborhood'
                    ? ''
                    : canonicalCityValue(cleanLocation)

            if (cityValue) params.set('city', cityValue)
            else if (cleanLocation) appendNaturalSearchParams(params, cleanLocation)
        }

        if (typeValue !== 'all') {
            const [key, value] = typeValue.split(':')
            if (key && value) params.set(key, value)
        }

        if (priceValue !== 'all') params.set('price', priceValue)

        const queryString = params.toString()
        return queryString ? `/busca?${queryString}` : '/busca'
    }

    function submitSearch(event?: FormEvent) {
        event?.preventDefault()
        const destination = buildSearchHref()
        setShowSuggestions(false)

        void trackEvent('property_search_submitted', {
            destination,
            location_label: locationLabel.trim(),
            location_type: locationType || 'free_text',
            property_type: typeValue,
            property_type_label: typeLabel(typeValue),
            price: priceValue,
            price_label: priceLabel(priceValue),
            source: variant,
        })

        router.push(destination)
    }

    function chooseSuggestion(suggestion: Suggestion) {
        setShowSuggestions(false)
        setHasTypedLocationQuery(false)
        setActiveSuggestion(-1)

        if (suggestion.type === 'property' && suggestion.id) {
            const destination = propertyDetailsPath({
                id: suggestion.id,
                source_slug: suggestion.source_slug,
                slug: suggestion.slug,
                title: suggestion.label,
            })
            void trackEvent('property_search_suggestion_clicked', {
                destination,
                property_id: suggestion.id,
                suggestion_type: suggestion.type,
                source: variant,
            })
            router.push(destination)
            return
        }

        if (suggestion.type === 'office') {
            setLocationLabel(suggestion.label)
            setLocationType('office')
            setLocationValue('office-location')
            const destination = variant === 'results' ? `/busca?office=${OFFICE_SEARCH_PARAM_VALUE}` : '/#mapa'
            void trackEvent('property_search_suggestion_clicked', {
                destination,
                suggestion_type: suggestion.type,
                source: variant,
            })
            return
        }

        const cityFallback = FALLBACK_CITIES.find(city => city.label === suggestion.label)
        const nextLocationValue = cityFallback?.value || suggestion.city || stripStateSuffix(suggestion.label)
        setLocationLabel(suggestion.label)
        setLocationType(suggestion.type === 'city' ? 'city' : 'neighborhood')
        setLocationValue(suggestion.type === 'city' ? canonicalCityValue(nextLocationValue) || nextLocationValue : nextLocationValue)
    }

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        const flatSuggestions = groupedSuggestions.flatMap(group => group.items)

        if (!showSuggestions || flatSuggestions.length === 0) {
            if (event.key === 'Enter') submitSearch(event)
            return
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActiveSuggestion(current => Math.min(current + 1, flatSuggestions.length - 1))
        } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveSuggestion(current => Math.max(current - 1, -1))
        } else if (event.key === 'Enter') {
            event.preventDefault()
            if (activeSuggestion >= 0) chooseSuggestion(flatSuggestions[activeSuggestion])
            else submitSearch()
        } else if (event.key === 'Escape') {
            setShowSuggestions(false)
        }
    }

    let suggestionIndex = -1

    return (
        <section className={`home-search-box home-search-box-${variant}`} id={variant === 'home' ? 'search' : undefined} ref={wrapperRef}>
            <form className="home-search-panel" onSubmit={submitSearch}>
                {variant === 'home' && (
                    <div className="home-search-title">
                        <span>Busca inteligente</span>
                        <h2>Encontre seu Imovel!</h2>
                    </div>
                )}

                <div className="home-search-select-row">
                    <label>
                        <span>Tipo de imovel</span>
                        <select value={typeValue} onChange={event => setTypeValue(event.target.value)}>
                            <option value="all">Todos os Imoveis</option>
                            {PROPERTY_TYPE_GROUPS.map(group => (
                                <optgroup label={group.label} key={group.label}>
                                    {group.options.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                        <ChevronDown className="home-search-chevron" size={16} />
                    </label>

                    <label>
                        <span>Faixa de valor</span>
                        <select value={priceValue} onChange={event => setPriceValue(event.target.value)}>
                            {PRICE_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <ChevronDown className="home-search-chevron" size={16} />
                    </label>
                </div>

                <div className="home-search-location-row">
                    <label>
                        <span>Descreva o imovel ou local</span>
                        <MapPin className="home-search-pin" size={18} />
                        <input
                            autoComplete="off"
                            onChange={event => updateLocation(event.target.value)}
                            onFocus={focusLocation}
                            onKeyDown={handleKeyDown}
                            placeholder="ex: cobertura 4 suites Praia Brava frente mar"
                            type="text"
                            value={locationLabel}
                        />
                    </label>
                    <button type="submit" aria-label="Buscar imoveis">
                        <Search size={20} />
                    </button>

                    {showSuggestions && (groupedSuggestions.length > 0 || isLoading) && (
                        <div className="home-search-suggestions">
                            {isLoading && groupedSuggestions.length === 0 ? (
                                <div className="home-search-loading">Buscando regioes...</div>
                            ) : (
                                groupedSuggestions.map(group => (
                                    <div className="suggestion-group" key={group.key}>
                                        <div className="suggestion-group-head">
                                            <strong>{group.label}</strong>
                                            <span>{group.meta}</span>
                                        </div>
                                        {group.items.map(suggestion => {
                                            suggestionIndex += 1
                                            const active = suggestionIndex === activeSuggestion
                                            return (
                                                <button
                                                    className={active ? 'active' : ''}
                                                    key={`${suggestion.type}-${suggestion.label}-${suggestionIndex}`}
                                                    onMouseDown={() => chooseSuggestion(suggestion)}
                                                    onMouseEnter={() => setActiveSuggestion(suggestionIndex)}
                                                    type="button"
                                                >
                                                    {suggestion.type === 'property' || suggestion.type === 'office' ? <Building2 size={15} /> : <MapPin size={15} />}
                                                    <span>
                                                        <strong>{suggestion.label}</strong>
                                                        {suggestion.type === 'office' ? (
                                                            <small>Localização da imobiliária</small>
                                                        ) : suggestion.type === 'property' && suggestion.price ? (
                                                            <small>{formatPrice(suggestion.price)} {suggestion.city ? `| ${replaceItajaiWithPraiaBrava(suggestion.city)}` : ''}</small>
                                                        ) : suggestion.count ? (
                                                            <small>{suggestion.count} imoveis</small>
                                                        ) : null}
                                                    </span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </form>

            <style jsx>{`
                .home-search-box {
                    margin: clamp(18px, 3vw, 34px) auto;
                    padding: 0 clamp(16px, 3vw, 34px);
                    width: 100%;
                }
                .home-search-box-results {
                    margin: 0;
                    padding: 0;
                }
                .home-search-box-map {
                    margin: 0;
                    padding: 0;
                }
                .home-search-panel {
                    background:
                        linear-gradient(135deg, rgba(18,17,16,0.92), rgba(47,43,36,0.9)),
                        linear-gradient(180deg, rgba(255,255,255,0.06), transparent);
                    border: 1px solid rgba(223,193,142,0.28);
                    border-radius: 14px;
                    box-sizing: border-box;
                    box-shadow: 0 24px 70px rgba(24,20,15,0.2);
                    margin: 0 auto;
                    max-width: 820px;
                    padding: clamp(18px, 2.5vw, 26px);
                    position: relative;
                }
                .home-search-box-results .home-search-panel {
                    max-width: none;
                    background: transparent;
                    border: 0;
                    border-radius: 0;
                    box-shadow: none;
                    padding: 0;
                }
                .home-search-box-map .home-search-panel {
                    align-content: center;
                    backdrop-filter: none;
                    -webkit-backdrop-filter: none;
                    background: transparent;
                    border: 0;
                    box-shadow: none;
                    height: 100%;
                    max-width: none;
                    min-height: 0;
                    padding: 12px;
                }
                .home-search-title {
                    margin-bottom: 14px;
                    text-align: center;
                }
                .home-search-title span {
                    color: #dfc18e;
                    display: block;
                    font: 900 0.66rem/1 'Inter', sans-serif;
                    letter-spacing: 0.18em;
                    margin-bottom: 7px;
                    text-transform: uppercase;
                }
                .home-search-title h2 {
                    color: #fff;
                    font-family: 'Noto Serif', Georgia, serif;
                    font-size: clamp(1.45rem, 3vw, 2.15rem);
                    font-weight: 800;
                    letter-spacing: 0;
                    line-height: 1;
                    margin: 0;
                    text-shadow: 0 2px 10px rgba(0,0,0,0.3);
                }
                .home-search-select-row {
                    display: grid;
                    gap: 8px;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
                label {
                    display: block;
                    min-width: 0;
                    position: relative;
                }
                label > span {
                    color: rgba(255,255,255,0.66);
                    display: block;
                    font: 850 0.62rem/1 'Inter', sans-serif;
                    letter-spacing: 0.1em;
                    margin-bottom: 6px;
                    text-transform: uppercase;
                }
                select,
                input {
                    background: rgba(255,255,255,0.96);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 6px;
                    box-sizing: border-box;
                    color: #191817;
                    font: 750 0.88rem/1 'Inter', sans-serif;
                    height: 44px;
                    outline: 0;
                    transition: border-color 0.16s ease, box-shadow 0.16s ease;
                    width: 100%;
                }
                select {
                    appearance: none;
                    cursor: pointer;
                    padding: 0 38px 0 12px;
                }
                input {
                    padding: 0 12px 0 42px;
                }
                select:focus,
                input:focus {
                    border-color: #dfc18e;
                    box-shadow: 0 0 0 3px rgba(223,193,142,0.18);
                }
                :global(.home-search-chevron),
                :global(.home-search-pin) {
                    color: #a88b4a;
                    pointer-events: none;
                    position: absolute;
                }
                :global(.home-search-chevron) {
                    bottom: 14px;
                    right: 12px;
                }
                :global(.home-search-pin) {
                    bottom: 13px;
                    left: 13px;
                }
                option,
                optgroup {
                    background: #fff;
                    color: #191817;
                    font-family: 'Inter', sans-serif;
                }
                .home-search-location-row {
                    display: grid;
                    gap: 8px;
                    grid-template-columns: minmax(0, 1fr) 78px;
                    margin-top: 9px;
                    position: relative;
                }
                .home-search-location-row > button {
                    align-self: end;
                    background: linear-gradient(135deg, #dfc18e, #b8945f);
                    border: 0;
                    border-radius: 6px;
                    color: #111;
                    cursor: pointer;
                    display: grid;
                    height: 44px;
                    place-items: center;
                    transition: transform 0.16s ease, box-shadow 0.16s ease;
                }
                .home-search-location-row > button:hover {
                    box-shadow: 0 14px 26px rgba(223,193,142,0.26);
                    transform: translateY(-1px);
                }
                .home-search-suggestions {
                    background: #fff;
                    border: 1px solid rgba(25,24,23,0.12);
                    border-radius: 8px;
                    box-shadow: 0 22px 46px rgba(0,0,0,0.22);
                    left: 0;
                    max-height: 360px;
                    overflow: auto;
                    position: absolute;
                    right: 86px;
                    top: calc(100% + 8px);
                    z-index: 1200;
                }
                .suggestion-group {
                    padding: 6px 0;
                }
                .suggestion-group + .suggestion-group {
                    border-top: 1px solid #eee8dd;
                }
                .suggestion-group-head {
                    align-items: center;
                    display: flex;
                    gap: 8px;
                    padding: 5px 12px 4px;
                }
                .suggestion-group-head strong {
                    color: #1f1d1a;
                    font: 900 0.78rem/1 'Inter', sans-serif;
                }
                .suggestion-group-head span {
                    background: #3b3834;
                    border-radius: 4px;
                    color: #fff;
                    font: 800 0.58rem/1 'Inter', sans-serif;
                    padding: 4px 6px;
                }
                .suggestion-group button {
                    align-items: center;
                    background: transparent;
                    border: 0;
                    color: #23201c;
                    cursor: pointer;
                    display: flex;
                    gap: 9px;
                    padding: 8px 12px;
                    text-align: left;
                    width: 100%;
                }
                .suggestion-group button:hover,
                .suggestion-group button.active {
                    background: #f5efe5;
                }
                .suggestion-group button svg {
                    color: #b8945f;
                    flex: 0 0 auto;
                }
                .suggestion-group button span {
                    display: grid;
                    gap: 2px;
                    min-width: 0;
                }
                .suggestion-group button strong {
                    color: #211f1b;
                    font: 800 0.82rem/1.1 'Inter', sans-serif;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .suggestion-group button small,
                .home-search-loading {
                    color: #81786c;
                    font: 700 0.68rem/1.2 'Inter', sans-serif;
                }
                .home-search-loading {
                    padding: 13px;
                    text-align: center;
                }
                .home-search-box-results .home-search-select-row {
                    gap: 6px;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
                .home-search-box-results label > span {
                    clip: rect(0 0 0 0);
                    clip-path: inset(50%);
                    height: 1px;
                    margin: -1px;
                    overflow: hidden;
                    position: absolute;
                    white-space: nowrap;
                    width: 1px;
                }
                .home-search-box-results select,
                .home-search-box-results input {
                    background: rgba(255,255,255,0.98);
                    border: 1px solid rgba(200,168,98,0.72);
                    border-radius: 6px;
                    box-shadow: 0 8px 18px rgba(34,27,18,0.08);
                    font-size: 0.78rem;
                    height: 38px;
                }
                .home-search-box-results select {
                    padding-left: 10px;
                    padding-right: 30px;
                }
                .home-search-box-results input {
                    padding-left: 34px;
                }
                .home-search-box-results :global(.home-search-chevron) {
                    bottom: auto;
                    left: auto;
                    right: 9px;
                    top: 50%;
                    transform: translateY(-50%);
                }
                .home-search-box-results :global(.home-search-pin) {
                    bottom: auto;
                    left: 10px;
                    right: auto;
                    top: 50%;
                    transform: translateY(-50%);
                }
                .home-search-box-results .home-search-location-row {
                    display: grid;
                    gap: 6px;
                    grid-template-columns: minmax(0, 1fr) 46px;
                    margin-top: 7px;
                }
                .home-search-box-results .home-search-location-row > button {
                    border-radius: 6px;
                    height: 38px;
                    width: 46px;
                }
                .home-search-box-results .home-search-suggestions {
                    right: 52px;
                    top: calc(100% + 7px);
                    z-index: 1500;
                }
                @media (max-width: 700px) {
                    .home-search-box {
                        margin: 14px auto 22px;
                        padding: 0 12px;
                    }
                    .home-search-panel {
                        padding: 16px;
                    }
                    .home-search-select-row,
                    .home-search-location-row {
                        grid-template-columns: 1fr;
                    }
                    .home-search-location-row > button {
                        width: 100%;
                    }
                    .home-search-suggestions {
                        right: 0;
                    }
                    .home-search-box-map {
                        margin: 0;
                        padding: 0;
                    }
                    .home-search-box-map .home-search-panel {
                        padding: 10px;
                    }
                    .home-search-box-map .home-search-select-row {
                        gap: 4px;
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }
                    .home-search-box-map .home-search-location-row {
                        gap: 4px;
                        grid-template-columns: minmax(0, 1fr) 50px;
                        margin-top: 4px;
                    }
                    .home-search-box-map .home-search-location-row > button {
                        width: auto;
                    }
                    .home-search-box-map .home-search-suggestions {
                        right: 54px;
                    }
                    .home-search-box-results {
                        margin: 0;
                        padding: 0;
                    }
                    .home-search-box-results .home-search-panel {
                        padding: 0;
                    }
                    .home-search-box-results .home-search-select-row {
                        gap: 6px;
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }
                    .home-search-box-results .home-search-location-row {
                        gap: 6px;
                        grid-template-columns: minmax(0, 1fr) 46px;
                        margin-top: 7px;
                    }
                    .home-search-box-results .home-search-location-row > button {
                        width: 46px;
                    }
                    .home-search-box-results .home-search-suggestions {
                        max-height: min(260px, 36svh);
                        right: 52px;
                    }
                }
                .home-search-box-map {
                    margin: 0;
                    padding: 0;
                }
                .home-search-box-map .home-search-panel {
                    border-radius: 10px;
                    padding: 12px;
                    width: 100%;
                }
                .home-search-box-map .home-search-title {
                    margin-bottom: 6px;
                }
                .home-search-box-map .home-search-title span {
                    display: none;
                }
                .home-search-box-map .home-search-title h2 {
                    background: rgba(255,255,255,0.9);
                    border: 1px solid rgba(200,168,98,0.72);
                    border-radius: 999px;
                    box-shadow: 0 12px 24px rgba(20,16,10,0.12);
                    color: #211c16;
                    display: inline-flex;
                    font-family: 'Noto Serif', Georgia, serif;
                    font-size: clamp(0.88rem, 1.05vw, 1.05rem);
                    line-height: 1;
                    padding: 6px 14px;
                    text-shadow: none;
                }
                .home-search-box-map label > span {
                    clip: rect(0 0 0 0);
                    clip-path: inset(50%);
                    height: 1px;
                    margin: -1px;
                    overflow: hidden;
                    position: absolute;
                    white-space: nowrap;
                    width: 1px;
                }
                .home-search-box-map .home-search-select-row {
                    gap: 4px;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
                .home-search-box-map select,
                .home-search-box-map input {
                    background: rgba(255,255,255,0.96);
                    border: 1px solid rgba(200,168,98,0.86);
                    border-radius: 3px;
                    box-shadow: 0 10px 22px rgba(18,16,12,0.14);
                    font-size: 0.78rem;
                    height: 34px;
                }
                .home-search-box-map select:focus,
                .home-search-box-map input:focus {
                    border-color: #c8a862;
                    box-shadow: 0 0 0 3px rgba(200,168,98,0.24), 0 10px 22px rgba(18,16,12,0.14);
                }
                .home-search-box-map select {
                    padding-left: 10px;
                    padding-right: 30px;
                }
                .home-search-box-map input {
                    padding-left: 34px;
                }
                .home-search-box-map :global(.home-search-chevron) {
                    bottom: auto;
                    left: auto;
                    right: 9px;
                    top: 50%;
                    transform: translateY(-50%);
                }
                .home-search-box-map :global(.home-search-pin) {
                    bottom: auto;
                    left: 10px;
                    right: auto;
                    top: 50%;
                    transform: translateY(-50%);
                }
                .home-search-box-map .home-search-location-row {
                    box-sizing: border-box;
                    display: block;
                    gap: 4px;
                    margin-top: 4px;
                    padding-right: 54px;
                }
                .home-search-box-map .home-search-location-row > button {
                    border-radius: 3px;
                    box-shadow: 0 10px 22px rgba(18,16,12,0.16);
                    height: 34px;
                    position: absolute;
                    right: 0;
                    top: 0;
                    width: 50px;
                }
                .home-search-box-map .home-search-location-row label {
                    display: block;
                    width: 100%;
                }
                .home-search-box-map .home-search-location-row input {
                    width: 100%;
                }
                .home-search-box-map .home-search-suggestions {
                    bottom: calc(100% + 6px);
                    max-height: 300px;
                    right: 56px;
                    top: auto;
                    z-index: 1500;
                }
                @media (min-width: 701px) {
                    .home-search-box-map {
                        width: 100%;
                    }
                    .home-search-box-map .home-search-panel {
                        display: grid;
                        gap: 6px 6px;
                        grid-template-areas:
                            "selects location";
                        grid-template-columns: minmax(320px, 0.82fr) minmax(420px, 1.18fr);
                        max-width: 980px;
                        padding: 0;
                    }
                    .home-search-box-map .home-search-title {
                        grid-area: title;
                        margin-bottom: 0;
                    }
                    .home-search-box-map .home-search-title h2 {
                        font-size: clamp(0.9rem, 1vw, 1.05rem);
                    }
                    .home-search-box-map .home-search-select-row {
                        grid-area: selects;
                    }
                    .home-search-box-map .home-search-location-row {
                        grid-area: location;
                        margin-top: 0;
                    }
                }
                @media (max-width: 700px) {
                    .home-search-box-map .home-search-panel {
                        max-width: calc(100vw - 20px);
                        border-radius: 12px;
                        box-shadow: none;
                        padding: 0;
                        width: 100%;
                    }
                    .home-search-box-map .home-search-location-row {
                        margin-top: 4px;
                        padding-right: 52px;
                    }
                    .home-search-box-map .home-search-suggestions {
                        bottom: calc(100% + 6px);
                        max-height: min(240px, 34svh);
                        right: 54px;
                        top: auto;
                        width: calc(100vw - 48px);
                    }
                }
            `}</style>
        </section>
    )
}
