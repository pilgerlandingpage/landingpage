'use client'

import {
    Bath,
    Bed,
    Building2,
    Car,
    ChevronDown,
    Filter,
    Home,
    MapPin,
    MapPinned,
    Maximize,
    RotateCcw,
    Search,
    Sparkles,
    Waves,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect, useCallback } from 'react'
import { propertyDestinationForViewport, propertyFeedPath } from '@/lib/properties/responsive-destination'
import { trackEvent } from '@/lib/tracking/client'

interface Suggestion {
    type: 'city' | 'neighborhood' | 'property'
    label: string
    count?: number
    id?: string
    price?: number
    city?: string
}

const PROPERTY_TYPES = [
    { value: 'Todos os Imoveis', label: 'Todos os imoveis' },
    { value: 'Apartamento', label: 'Apartamento' },
    { value: 'Cobertura', label: 'Cobertura' },
    { value: 'Duplex / Triplex', label: 'Duplex / Triplex' },
    { value: 'Apartamento Garden', label: 'Garden' },
    { value: 'Casa', label: 'Casa' },
    { value: 'Casa em Condominio', label: 'Casa em condominio' },
    { value: 'Sobrado', label: 'Sobrado' },
    { value: 'Terreno', label: 'Terreno' },
    { value: 'Comercial', label: 'Comercial' },
]

const PRICE_PRESETS = [
    { value: 'Todos os Valores', label: 'Selecione' },
    { value: '4000000-6000000', label: 'R$ 4 mi a R$ 6 mi' },
    { value: '6000000-8000000', label: 'R$ 6 mi a R$ 8 mi' },
    { value: '8000000-10000000', label: 'R$ 8 mi a R$ 10 mi' },
    { value: '10000000-', label: 'Acima de R$ 10 mi' },
]

const MINIMUM_FIRST_CONTACT_PRICE = 4000000

const ROOM_OPTIONS = [
    { value: '', label: 'Qualquer' },
    { value: '1', label: '1+' },
    { value: '2', label: '2+' },
    { value: '3', label: '3+' },
    { value: '4', label: '4+' },
    { value: '5', label: '5+' },
]

const AREA_OPTIONS = [
    { value: '', label: 'Qualquer' },
    { value: '80', label: '80 m2+' },
    { value: '120', label: '120 m2+' },
    { value: '180', label: '180 m2+' },
    { value: '250', label: '250 m2+' },
    { value: '400', label: '400 m2+' },
]

const TAG_OPTIONS = [
    { value: '', label: 'Todos' },
    { value: 'frente-mar', label: 'Frente mar' },
    { value: 'quadra-mar', label: 'Quadra mar' },
    { value: 'mobiliado', label: 'Mobiliado' },
    { value: 'lancamento', label: 'Lancamento' },
    { value: 'em-construcao', label: 'Em construcao' },
    { value: 'pronto', label: 'Pronto' },
]

function isDefaultPropertyType(value: string) {
    return value === 'Todos os Imoveis' || value === 'Todos os Imóveis'
}

function optionLabel(options: Array<{ value: string; label: string }>, value: string) {
    return options.find(option => option.value === value)?.label || value || 'Todos'
}

export default function HomeSearchBar() {
    const router = useRouter()
    const [propertyType, setPropertyType] = useState('Todos os Imoveis')
    const [priceRange, setPriceRange] = useState('Todos os Valores')
    const [purpose, setPurpose] = useState('sale')
    const [query, setQuery] = useState('')
    const [bedroomsMin, setBedroomsMin] = useState('')
    const [suitesMin, setSuitesMin] = useState('')
    const [bathroomsMin, setBathroomsMin] = useState('')
    const [parkingMin, setParkingMin] = useState('')
    const [areaMin, setAreaMin] = useState('')
    const [tag, setTag] = useState('')
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [suggestions, setSuggestions] = useState<Suggestion[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [activeSuggestion, setActiveSuggestion] = useState(-1)
    const [isLoading, setIsLoading] = useState(false)
    const wrapperRef = useRef<HTMLDivElement>(null)
    const debounceRef = useRef<NodeJS.Timeout | null>(null)

    const advancedCount = [bedroomsMin, suitesMin, bathroomsMin, parkingMin, areaMin, tag].filter(Boolean).length

    const buildSearchParams = () => {
        const params = new URLSearchParams()
        const term = query.trim()

        if (term) params.append('q', term)
        if (!isDefaultPropertyType(propertyType)) params.append('type', propertyType)
        if (priceRange !== 'Todos os Valores') {
            params.append('price', priceRange)
        } else {
            params.append('priceMin', String(MINIMUM_FIRST_CONTACT_PRICE))
        }
        if (purpose) params.append('offer', purpose)
        if (bedroomsMin) params.append('bedroomsMin', bedroomsMin)
        if (suitesMin) params.append('suitesMin', suitesMin)
        if (bathroomsMin) params.append('bathroomsMin', bathroomsMin)
        if (parkingMin) params.append('parkingMin', parkingMin)
        if (areaMin) params.append('areaMin', areaMin)
        if (tag) params.append('tag', tag)

        return params
    }

    const handleSearch = (e?: React.FormEvent) => {
        e?.preventDefault()
        setShowSuggestions(false)

        const params = buildSearchParams()
        const queryString = params.toString()
        void trackEvent('home_search_submitted', {
            query: query.trim(),
            property_type_value: propertyType,
            property_type_label: optionLabel(PROPERTY_TYPES, propertyType),
            price_range_value: priceRange,
            price_range_label: optionLabel(PRICE_PRESETS, priceRange),
            purpose,
            bedrooms_min: bedroomsMin,
            suites_min: suitesMin,
            bathrooms_min: bathroomsMin,
            parking_min: parkingMin,
            area_min: areaMin,
            tag,
            advanced_count: advancedCount,
            destination: queryString ? `/busca?${queryString}` : '/busca',
        })
        router.push(queryString ? `/busca?${queryString}` : '/busca')
    }

    const fetchSuggestions = useCallback(async (term: string) => {
        setIsLoading(true)
        try {
            const url = term
                ? `/api/search/suggestions?q=${encodeURIComponent(term)}`
                : '/api/search/suggestions'
            const res = await fetch(url)
            if (res.ok) {
                const data = await res.json()
                setSuggestions(data.suggestions || [])
            }
        } catch {
            // Suggestions are progressive enhancement.
        } finally {
            setIsLoading(false)
        }
    }, [])

    const handleInputChange = (value: string) => {
        setQuery(value)
        setActiveSuggestion(-1)

        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            fetchSuggestions(value)
        }, 250)
    }

    const handleFocus = () => {
        setShowSuggestions(true)
        if (suggestions.length === 0) fetchSuggestions(query)
    }

    const handleSuggestionClick = (suggestion: Suggestion) => {
        const propertyDestination = suggestion.type === 'property' && suggestion.id
            ? propertyDestinationForViewport(suggestion.id)
            : undefined
        setShowSuggestions(false)
        void trackEvent('home_search_suggestion_clicked', {
            suggestion_type: suggestion.type,
            label: suggestion.label,
            count: suggestion.count,
            property_id: suggestion.id,
            price: suggestion.price,
            city: suggestion.city,
            destination: propertyDestination,
            mobile_fallback_destination: suggestion.type === 'property' && suggestion.id ? propertyFeedPath(suggestion.id) : undefined,
        })
        if (propertyDestination) {
            router.push(propertyDestination)
            return
        }

        setQuery(suggestion.label)
        setActiveSuggestion(-1)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showSuggestions || suggestions.length === 0) {
            if (e.key === 'Enter') handleSearch()
            return
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveSuggestion(prev => Math.min(prev + 1, suggestions.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveSuggestion(prev => Math.max(prev - 1, -1))
        } else if (e.key === 'Enter') {
            e.preventDefault()
            if (activeSuggestion >= 0) {
                handleSuggestionClick(suggestions[activeSuggestion])
            } else {
                handleSearch()
            }
        } else if (e.key === 'Escape') {
            setShowSuggestions(false)
        }
    }

    const clearFilters = () => {
        void trackEvent('home_search_cleared', {
            query: query.trim(),
            property_type_value: propertyType,
            property_type_label: optionLabel(PROPERTY_TYPES, propertyType),
            price_range_value: priceRange,
            price_range_label: optionLabel(PRICE_PRESETS, priceRange),
            purpose,
            advanced_count: advancedCount,
        })
        setPropertyType('Todos os Imoveis')
        setPriceRange('Todos os Valores')
        setPurpose('sale')
        setQuery('')
        setBedroomsMin('')
        setSuitesMin('')
        setBathroomsMin('')
        setParkingMin('')
        setAreaMin('')
        setTag('')
        setSuggestions([])
        setShowSuggestions(false)
    }

    const toggleAdvancedFilters = () => {
        const nextOpen = !showAdvanced
        setShowAdvanced(nextOpen)
        void trackEvent('home_search_advanced_toggled', {
            open: nextOpen,
            advanced_count: advancedCount,
        })
    }

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setShowSuggestions(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [])

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            maximumFractionDigits: 0,
        }).format(price)
    }

    return (
        <section id="search" className="search-shell" ref={wrapperRef}>
            <div className="search-heading">
                <span>Encontre seu imovel</span>
            </div>

            <form className="search-panel" onSubmit={handleSearch}>
                <div className="search-primary">
                    <div className="field field-location">
                        <label htmlFor="home-search-query">Localizacao</label>
                        <div className="input-wrap">
                            <MapPin size={17} />
                            <input
                                id="home-search-query"
                                type="text"
                                placeholder="Cidade, bairro ou empreendimento"
                                value={query}
                                onChange={(e) => handleInputChange(e.target.value)}
                                onFocus={handleFocus}
                                onKeyDown={handleKeyDown}
                                autoComplete="off"
                            />
                        </div>

                        {showSuggestions && suggestions.length > 0 && (
                            <div className="suggestions-dropdown">
                                {suggestions.map((s, i) => (
                                    <button
                                        key={`${s.type}-${s.label}-${i}`}
                                        type="button"
                                        className={`suggestion-item ${i === activeSuggestion ? 'active' : ''}`}
                                        onMouseDown={() => handleSuggestionClick(s)}
                                        onMouseEnter={() => setActiveSuggestion(i)}
                                    >
                                        <span className="suggestion-icon">
                                            {s.type === 'city' && <MapPinned size={15} />}
                                            {s.type === 'neighborhood' && <MapPin size={15} />}
                                            {s.type === 'property' && <Building2 size={15} />}
                                        </span>
                                        <span className="suggestion-text">
                                            <span className="suggestion-label">{s.label}</span>
                                            {(s.type === 'city' || s.type === 'neighborhood') && s.count && (
                                                <span className="suggestion-meta">{s.count} imoveis</span>
                                            )}
                                            {s.type === 'property' && s.price && (
                                                <span className="suggestion-meta">{formatPrice(s.price)} | {s.city}</span>
                                            )}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {showSuggestions && isLoading && suggestions.length === 0 && (
                            <div className="suggestions-dropdown">
                                <div className="suggestion-loading">Buscando...</div>
                            </div>
                        )}
                    </div>

                    <div className="field">
                        <label htmlFor="home-search-type">Tipo</label>
                        <div className="select-wrap">
                            <Home size={16} />
                            <select
                                id="home-search-type"
                                value={propertyType}
                                onChange={(e) => setPropertyType(e.target.value)}
                            >
                                {PROPERTY_TYPES.map(option => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            <ChevronDown size={15} className="chevron" />
                        </div>
                    </div>

                    <div className="field">
                        <label htmlFor="home-search-price">Valor</label>
                        <div className="select-wrap">
                            <Sparkles size={16} />
                            <select
                                id="home-search-price"
                                value={priceRange}
                                onChange={(e) => setPriceRange(e.target.value)}
                            >
                                {PRICE_PRESETS.map(option => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            <ChevronDown size={15} className="chevron" />
                        </div>
                    </div>

                    <div className="purpose-switch" aria-label="Finalidade">
                        <button
                            type="button"
                            className={purpose === 'sale' ? 'active' : ''}
                            onClick={() => setPurpose('sale')}
                        >
                            Venda
                        </button>
                        <button
                            type="button"
                            className={purpose === 'rent' ? 'active' : ''}
                            onClick={() => setPurpose('rent')}
                        >
                            Aluguel
                        </button>
                    </div>

                    <button type="submit" className="search-submit" aria-label="Buscar imoveis">
                        <Search size={18} strokeWidth={2.4} />
                        <span>Buscar</span>
                    </button>
                </div>

                <div className="search-actions">
                    <button
                        type="button"
                        className="utility-button"
                        onClick={toggleAdvancedFilters}
                        aria-expanded={showAdvanced}
                    >
                        <Filter size={15} />
                        <span>Mais filtros</span>
                        {advancedCount > 0 && <strong>{advancedCount}</strong>}
                    </button>

                    <button type="button" className="utility-button muted" onClick={clearFilters}>
                        <RotateCcw size={15} />
                        <span>Limpar</span>
                    </button>
                </div>

                {showAdvanced && (
                    <div className="advanced-grid">
                        <div className="field compact">
                            <label htmlFor="home-search-bedrooms">Dormitórios</label>
                            <div className="select-wrap">
                                <Bed size={15} />
                                <select id="home-search-bedrooms" value={bedroomsMin} onChange={(e) => setBedroomsMin(e.target.value)}>
                                    {ROOM_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                                <ChevronDown size={14} className="chevron" />
                            </div>
                        </div>

                        <div className="field compact">
                            <label htmlFor="home-search-suites">Suites</label>
                            <div className="select-wrap">
                                <Waves size={15} />
                                <select id="home-search-suites" value={suitesMin} onChange={(e) => setSuitesMin(e.target.value)}>
                                    {ROOM_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                                <ChevronDown size={14} className="chevron" />
                            </div>
                        </div>

                        <div className="field compact">
                            <label htmlFor="home-search-bathrooms">Banheiros</label>
                            <div className="select-wrap">
                                <Bath size={15} />
                                <select id="home-search-bathrooms" value={bathroomsMin} onChange={(e) => setBathroomsMin(e.target.value)}>
                                    {ROOM_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                                <ChevronDown size={14} className="chevron" />
                            </div>
                        </div>

                        <div className="field compact">
                            <label htmlFor="home-search-parking">Vagas</label>
                            <div className="select-wrap">
                                <Car size={15} />
                                <select id="home-search-parking" value={parkingMin} onChange={(e) => setParkingMin(e.target.value)}>
                                    {ROOM_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                                <ChevronDown size={14} className="chevron" />
                            </div>
                        </div>

                        <div className="field compact">
                            <label htmlFor="home-search-area">Area minima</label>
                            <div className="select-wrap">
                                <Maximize size={15} />
                                <select id="home-search-area" value={areaMin} onChange={(e) => setAreaMin(e.target.value)}>
                                    {AREA_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                                <ChevronDown size={14} className="chevron" />
                            </div>
                        </div>

                        <div className="field compact">
                            <label htmlFor="home-search-tag">Diferenciais</label>
                            <div className="select-wrap">
                                <Sparkles size={15} />
                                <select id="home-search-tag" value={tag} onChange={(e) => setTag(e.target.value)}>
                                    {TAG_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                                <ChevronDown size={14} className="chevron" />
                            </div>
                        </div>
                    </div>
                )}
            </form>

            <style jsx>{`
                .search-shell {
                    width: min(1120px, calc(100% - 32px));
                    margin: 0 auto;
                    padding: 18px 0;
                }
                .search-heading {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 10px;
                    color: #b8945f;
                    font-family: 'Inter', sans-serif;
                    font-size: 0.72rem;
                    font-weight: 800;
                    letter-spacing: 0.34em;
                    text-transform: uppercase;
                }
                .search-panel {
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    width: 100%;
                    padding: 12px;
                    border: 1px solid rgba(184, 148, 95, 0.24);
                    border-radius: 8px;
                    background:
                        linear-gradient(180deg, rgba(255,255,255,0.96), rgba(250,249,246,0.96)),
                        #fbfaf7;
                    box-shadow: 0 18px 45px rgba(22, 22, 24, 0.1);
                }
                .search-primary {
                    display: grid;
                    grid-template-columns: minmax(260px, 1.45fr) minmax(170px, 0.85fr) minmax(180px, 0.9fr) auto auto;
                    align-items: end;
                    gap: 10px;
                }
                .field {
                    position: relative;
                    min-width: 0;
                }
                .field label {
                    display: block;
                    margin: 0 0 6px;
                    color: #77736b;
                    font-size: 0.68rem;
                    font-weight: 800;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                }
                .input-wrap,
                .select-wrap {
                    position: relative;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    min-width: 0;
                    height: 46px;
                    padding: 0 13px;
                    border: 1px solid #e4ded2;
                    border-radius: 7px;
                    background: #fff;
                    color: #b8945f;
                    transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
                }
                .input-wrap:focus-within,
                .select-wrap:focus-within {
                    border-color: rgba(184, 148, 95, 0.7);
                    box-shadow: 0 0 0 3px rgba(184, 148, 95, 0.12);
                }
                input,
                select {
                    width: 100%;
                    min-width: 0;
                    height: 100%;
                    border: 0;
                    outline: 0;
                    background: transparent;
                    color: #181817;
                    font: 600 0.88rem/1 'Inter', sans-serif;
                }
                input::placeholder {
                    color: #9a968d;
                    font-weight: 500;
                }
                select {
                    appearance: none;
                    padding-right: 18px;
                    cursor: pointer;
                }
                select option {
                    color: #181817;
                    background: #fff;
                }
                .chevron {
                    position: absolute;
                    right: 11px;
                    color: #b8945f;
                    pointer-events: none;
                }
                .purpose-switch {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    min-width: 128px;
                    height: 46px;
                    padding: 4px;
                    border: 1px solid #e4ded2;
                    border-radius: 7px;
                    background: #f3f0ea;
                }
                .purpose-switch button {
                    border: 0;
                    border-radius: 5px;
                    background: transparent;
                    color: #6f6a60;
                    cursor: pointer;
                    font: 800 0.76rem/1 'Inter', sans-serif;
                    transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
                }
                .purpose-switch button.active {
                    background: #191817;
                    color: #dfc18e;
                    box-shadow: 0 6px 18px rgba(24, 24, 23, 0.16);
                }
                .search-submit {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    height: 46px;
                    min-width: 118px;
                    padding: 0 18px;
                    border: 0;
                    border-radius: 7px;
                    background: linear-gradient(135deg, #c9a96e 0%, #a88b4a 100%);
                    color: #111;
                    cursor: pointer;
                    font: 900 0.82rem/1 'Inter', sans-serif;
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                    transition: transform 0.18s ease, box-shadow 0.18s ease;
                }
                .search-submit:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 12px 24px rgba(184, 148, 95, 0.24);
                }
                .search-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding-top: 2px;
                }
                .utility-button {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    height: 34px;
                    padding: 0 11px;
                    border: 1px solid rgba(184, 148, 95, 0.25);
                    border-radius: 7px;
                    background: #fff;
                    color: #2a2926;
                    cursor: pointer;
                    font: 800 0.74rem/1 'Inter', sans-serif;
                }
                .utility-button.muted {
                    color: #77736b;
                    border-color: #e4ded2;
                }
                .utility-button strong {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #191817;
                    color: #dfc18e;
                    font-size: 0.68rem;
                }
                .advanced-grid {
                    display: grid;
                    grid-template-columns: repeat(6, minmax(0, 1fr));
                    gap: 10px;
                    padding-top: 12px;
                    border-top: 1px solid #ebe6dc;
                    animation: filtersIn 0.18s ease-out;
                }
                .field.compact .select-wrap {
                    height: 42px;
                    padding-inline: 11px;
                    background: #fffdfa;
                }
                .field.compact select {
                    font-size: 0.82rem;
                }
                .suggestions-dropdown {
                    position: absolute;
                    top: calc(100% + 8px);
                    left: 0;
                    right: 0;
                    z-index: 1000;
                    max-height: 330px;
                    overflow-y: auto;
                    border: 1px solid rgba(184, 148, 95, 0.22);
                    border-radius: 8px;
                    background: #fff;
                    box-shadow: 0 18px 40px rgba(22, 22, 24, 0.14);
                }
                .suggestion-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    width: 100%;
                    padding: 11px 13px;
                    border: 0;
                    border-bottom: 1px solid #f1ede6;
                    background: transparent;
                    color: #24231f;
                    cursor: pointer;
                    text-align: left;
                    transition: background 0.15s ease;
                }
                .suggestion-item:last-child {
                    border-bottom: 0;
                }
                .suggestion-item:hover,
                .suggestion-item.active {
                    background: #f8f4ed;
                }
                .suggestion-icon {
                    display: flex;
                    color: #b8945f;
                    flex-shrink: 0;
                }
                .suggestion-text {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    min-width: 0;
                }
                .suggestion-label {
                    overflow: hidden;
                    color: #24231f;
                    font-size: 0.85rem;
                    font-weight: 800;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .suggestion-meta,
                .suggestion-loading {
                    color: #817b71;
                    font-size: 0.74rem;
                    font-weight: 600;
                }
                .suggestion-loading {
                    padding: 12px;
                    text-align: center;
                }
                @keyframes filtersIn {
                    from { opacity: 0; transform: translateY(-4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @media (max-width: 980px) {
                    .search-primary {
                        grid-template-columns: 1fr 1fr;
                    }
                    .field-location {
                        grid-column: 1 / -1;
                    }
                    .purpose-switch,
                    .search-submit {
                        width: 100%;
                    }
                    .advanced-grid {
                        grid-template-columns: repeat(3, minmax(0, 1fr));
                    }
                }
                @media (max-width: 640px) {
                    .search-shell {
                        width: min(100% - 22px, 520px);
                        padding: 12px 0;
                    }
                    .search-heading {
                        font-size: 0.66rem;
                        letter-spacing: 0.22em;
                        margin-bottom: 8px;
                    }
                    .search-panel {
                        padding: 10px;
                        gap: 10px;
                    }
                    .search-primary {
                        grid-template-columns: 1fr;
                        gap: 9px;
                    }
                    .input-wrap,
                    .select-wrap,
                    .purpose-switch,
                    .search-submit {
                        height: 44px;
                    }
                    .search-actions {
                        justify-content: space-between;
                    }
                    .utility-button {
                        flex: 1;
                        justify-content: center;
                    }
                    .advanced-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 9px;
                    }
                }
            `}</style>
        </section>
    )
}
