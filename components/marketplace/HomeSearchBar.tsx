'use client'

import { Search, MapPin, ChevronDown, Building2, MapPinned } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect, useCallback } from 'react'

interface Suggestion {
    type: 'city' | 'neighborhood' | 'property'
    label: string
    count?: number
    id?: string
    price?: number
    city?: string
}

export default function HomeSearchBar() {
    const router = useRouter()
    const [propertyType, setPropertyType] = useState('Todos os Imóveis')
    const [priceRange, setPriceRange] = useState('Todos os Valores')
    const [query, setQuery] = useState('')
    const [suggestions, setSuggestions] = useState<Suggestion[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [activeSuggestion, setActiveSuggestion] = useState(-1)
    const [isLoading, setIsLoading] = useState(false)
    const wrapperRef = useRef<HTMLDivElement>(null)
    const debounceRef = useRef<NodeJS.Timeout | null>(null)

    const handleSearch = (e?: React.FormEvent) => {
        e?.preventDefault()
        setShowSuggestions(false)
        
        const params = new URLSearchParams()
        if (query.trim()) params.append('q', query)
        if (propertyType !== 'Todos os Imóveis') params.append('type', propertyType)
        if (priceRange !== 'Todos os Valores') params.append('price', priceRange)
        
        const queryString = params.toString()
        if (queryString) {
            router.push(`/busca?${queryString}`)
        } else {
            router.push('/busca')
        }
    }

    const fetchSuggestions = useCallback(async (term: string) => {
        setIsLoading(true)
        try {
            const url = term
                ? `/api/search/suggestions?q=${encodeURIComponent(term)}`
                : `/api/search/suggestions`
            const res = await fetch(url)
            if (res.ok) {
                const data = await res.json()
                setSuggestions(data.suggestions || [])
            }
        } catch {
            // silently fail
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
        if (suggestions.length === 0) {
            fetchSuggestions(query)
        }
    }

    const handleSuggestionClick = (suggestion: Suggestion) => {
        setShowSuggestions(false)
        if (suggestion.type === 'property' && suggestion.id) {
            router.push(`/imovel/${suggestion.id}`)
        } else if (suggestion.type === 'city') {
            setQuery(suggestion.label)
            router.push(`/busca?q=${encodeURIComponent(suggestion.label)}`)
        } else if (suggestion.type === 'neighborhood') {
            setQuery(suggestion.label)
            router.push(`/busca?q=${encodeURIComponent(suggestion.label)}`)
        }
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

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setShowSuggestions(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            maximumFractionDigits: 0,
        }).format(price)
    }

    return (
        <div className="search-container" ref={wrapperRef}>
            <h2 className="search-title">Encontre seu Imóvel!</h2>
            <form className="search-bar" onSubmit={handleSearch}>
                {/* Select: Type */}
                <div className="search-select-wrapper">
                    <select 
                        className="search-select"
                        value={propertyType}
                        onChange={(e) => setPropertyType(e.target.value)}
                    >
                        <option value="Todos os Imóveis">Todos os Imóveis</option>
                        <optgroup label="Apartamentos">
                            <option value="Apartamento">Apartamento</option>
                            <option value="Duplex / Triplex">Duplex / Triplex</option>
                            <option value="Apartamento Garden">Apartamento Garden</option>
                            <option value="Cobertura">Cobertura</option>
                            <option value="Flat">Flat</option>
                            <option value="Loft">Loft</option>
                            <option value="Studio">Studio</option>
                        </optgroup>
                        <optgroup label="Casas">
                            <option value="Casa">Casa</option>
                            <option value="Casa em Condomínio">Casa em Condomínio</option>
                            <option value="Sobrado">Sobrado</option>
                        </optgroup>
                        <optgroup label="Terrenos">
                            <option value="Terreno">Terreno</option>
                            <option value="Terreno em Condomínio">Terreno em Condomínio</option>
                        </optgroup>
                        <optgroup label="Comercial">
                            <option value="Sala Comercial">Sala Comercial</option>
                            <option value="Galpão / Depósito">Galpão / Depósito</option>
                        </optgroup>
                    </select>
                    <ChevronDown size={14} className="select-icon" />
                </div>

                <div className="search-divider" />

                {/* Select: Price */}
                <div className="search-select-wrapper">
                    <select 
                        className="search-select"
                        value={priceRange}
                        onChange={(e) => setPriceRange(e.target.value)}
                    >
                        <option value="Todos os Valores">Todos os Valores</option>
                        <option value="0-1000000">até R$1.000.000</option>
                        <option value="1000000-2000000">R$1.000.000 ↔ R$2.000.000</option>
                        <option value="2000000-3000000">R$2.000.000 ↔ R$3.000.000</option>
                        <option value="3000000-5000000">R$3.000.000 ↔ R$5.000.000</option>
                        <option value="5000000-10000000">R$5.000.000 ↔ R$10.000.000</option>
                        <option value="10000000-">a partir de R$10.000.000</option>
                    </select>
                    <ChevronDown size={14} className="select-icon" />
                </div>

                <div className="search-divider" />

                {/* Input: Query with autocomplete */}
                <div className="search-input-wrapper">
                    <input
                        type="text"
                        placeholder="digite a cidade ou bairro..."
                        className="search-input"
                        value={query}
                        onChange={(e) => handleInputChange(e.target.value)}
                        onFocus={handleFocus}
                        onKeyDown={handleKeyDown}
                        autoComplete="off"
                    />
                    <MapPin size={16} className="input-icon" />

                    {/* Suggestions Dropdown */}
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
                                        {s.type === 'city' && <MapPinned size={14} />}
                                        {s.type === 'neighborhood' && <MapPin size={14} />}
                                        {s.type === 'property' && <Building2 size={14} />}
                                    </span>
                                    <span className="suggestion-text">
                                        <span className="suggestion-label">{s.label}</span>
                                        {s.type === 'city' && s.count && (
                                            <span className="suggestion-meta">{s.count} imóveis</span>
                                        )}
                                        {s.type === 'neighborhood' && s.count && (
                                            <span className="suggestion-meta">{s.count} imóveis</span>
                                        )}
                                        {s.type === 'property' && s.price && (
                                            <span className="suggestion-meta">{formatPrice(s.price)} · {s.city}</span>
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

                {/* Submit Button */}
                <button type="submit" className="search-submit">
                    <Search size={16} strokeWidth={2.5} />
                </button>
            </form>

            <style jsx>{`
                .search-container {
                    width: 100%;
                    max-width: 750px;
                    margin: 0 auto;
                    padding: 10px 20px;
                }
                .search-title {
                    color: #1a1a1a;
                    font-size: 0.85rem;
                    font-weight: 700;
                    margin-bottom: 8px;
                    font-family: 'Inter', sans-serif;
                    text-align: center;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .search-bar {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    background: white;
                    border: 1px solid #ddd;
                    overflow: visible;
                    width: 100%;
                    position: relative;
                }
                .search-select-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                    height: 40px;
                    border-bottom: 1px solid #eee;
                }
                .search-select-wrapper:first-of-type {
                    border-right: 1px solid #eee;
                }
                .search-select {
                    width: 100%;
                    height: 100%;
                    appearance: none;
                    border: none;
                    background: transparent;
                    padding: 0 26px 0 12px;
                    font-size: 0.82rem;
                    color: #404040;
                    cursor: pointer;
                    outline: none;
                    font-weight: 500;
                }
                .select-icon {
                    position: absolute;
                    right: 10px;
                    color: #a3a3a3;
                    pointer-events: none;
                }
                .search-divider {
                    display: none;
                }
                .search-input-wrapper {
                    position: relative;
                    grid-column: 1 / -1;
                    display: flex;
                    align-items: center;
                    height: 40px;
                }
                .search-input {
                    width: 100%;
                    height: 100%;
                    border: none;
                    padding: 0 36px 0 12px;
                    font-size: 0.82rem;
                    outline: none;
                    color: #1a1a1a;
                }
                .search-input::placeholder {
                    color: #a3a3a3;
                }
                .input-icon {
                    position: absolute;
                    right: 50px;
                    color: #a3a3a3;
                    pointer-events: none;
                }
                .search-submit {
                    position: absolute;
                    right: 0;
                    bottom: 0;
                    width: 42px;
                    height: 40px;
                    background: #555;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: white;
                    transition: background 0.2s;
                    z-index: 2;
                }
                .search-submit:hover {
                    background: #b8945f;
                }

                /* === Suggestions Dropdown === */
                .suggestions-dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: white;
                    border: 1px solid #ddd;
                    border-top: none;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.12);
                    z-index: 1000;
                    max-height: 320px;
                    overflow-y: auto;
                }
                .suggestion-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    width: 100%;
                    padding: 10px 14px;
                    border: none;
                    background: transparent;
                    cursor: pointer;
                    text-align: left;
                    font-size: 0.82rem;
                    color: #333;
                    transition: background 0.15s;
                    border-bottom: 1px solid #f5f5f5;
                }
                .suggestion-item:last-child {
                    border-bottom: none;
                }
                .suggestion-item:hover,
                .suggestion-item.active {
                    background: #f9f7f4;
                }
                .suggestion-icon {
                    flex-shrink: 0;
                    color: #b8945f;
                    display: flex;
                    align-items: center;
                }
                .suggestion-text {
                    display: flex;
                    flex-direction: column;
                    gap: 1px;
                    min-width: 0;
                }
                .suggestion-label {
                    font-weight: 500;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .suggestion-meta {
                    font-size: 0.72rem;
                    color: #999;
                }
                .suggestion-loading {
                    padding: 12px 14px;
                    font-size: 0.8rem;
                    color: #999;
                    text-align: center;
                }

                @media (min-width: 769px) {
                    .search-bar {
                        grid-template-columns: 1fr 1fr 2fr auto;
                    }
                    .search-select-wrapper {
                        border-bottom: none;
                    }
                    .search-select-wrapper:first-of-type {
                        border-right: 1px solid #eee;
                    }
                    .search-select-wrapper:nth-of-type(2) {
                        border-right: 1px solid #eee;
                    }
                    .search-input-wrapper {
                        grid-column: auto;
                    }
                    .search-submit {
                        position: relative;
                        width: 50px;
                    }
                    .input-icon {
                        right: 14px;
                    }
                }
            `}</style>
        </div>
    )
}
