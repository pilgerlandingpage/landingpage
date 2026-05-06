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
        <div className="search-container" ref={wrapperRef} style={{ width: '100%', maxWidth: '800px', margin: '0 auto', padding: '14px 20px' }}>
            <h2 className="search-title" style={{ background: 'linear-gradient(135deg, #c9a96e 0%, #dfc18e 50%, #a88b4a 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '0.78rem', fontWeight: 700, marginBottom: '10px', fontFamily: "'Inter', sans-serif", textAlign: 'center', textTransform: 'uppercase', letterSpacing: '2.5px' }}>Encontre seu Imóvel!</h2>
            <form className="search-bar" onSubmit={handleSearch} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#1a1a1a', borderRadius: '8px', border: '1px solid rgba(201, 169, 110, 0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', overflow: 'visible', width: '100%', position: 'relative' }}>
                {/* Select: Type */}
                <div className="search-select-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center', height: '44px', borderBottom: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                    <select 
                        className="search-select"
                        value={propertyType}
                        onChange={(e) => setPropertyType(e.target.value)}
                        style={{ width: '100%', height: '100%', appearance: 'none', border: 'none', background: 'transparent', padding: '0 28px 0 14px', fontSize: '0.82rem', color: '#d4d4d4', cursor: 'pointer', outline: 'none', fontWeight: 400, fontFamily: "'Inter', sans-serif" }}
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
                    <ChevronDown size={14} className="select-icon" style={{ position: 'absolute', right: '10px', color: '#c9a96e', pointerEvents: 'none' }} />
                </div>

                <div className="search-divider" style={{ display: 'none' }} />

                {/* Select: Price */}
                <div className="search-select-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center', height: '44px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <select 
                        className="search-select"
                        value={priceRange}
                        onChange={(e) => setPriceRange(e.target.value)}
                        style={{ width: '100%', height: '100%', appearance: 'none', border: 'none', background: 'transparent', padding: '0 28px 0 14px', fontSize: '0.82rem', color: '#d4d4d4', cursor: 'pointer', outline: 'none', fontWeight: 400, fontFamily: "'Inter', sans-serif" }}
                    >
                        <option value="Todos os Valores">Todos os Valores</option>
                        <option value="0-1000000">até R$1.000.000</option>
                        <option value="1000000-2000000">R$1.000.000 ↔ R$2.000.000</option>
                        <option value="2000000-3000000">R$2.000.000 ↔ R$3.000.000</option>
                        <option value="3000000-5000000">R$3.000.000 ↔ R$5.000.000</option>
                        <option value="5000000-10000000">R$5.000.000 ↔ R$10.000.000</option>
                        <option value="10000000-">a partir de R$10.000.000</option>
                    </select>
                    <ChevronDown size={14} className="select-icon" style={{ position: 'absolute', right: '10px', color: '#c9a96e', pointerEvents: 'none' }} />
                </div>

                <div className="search-divider" style={{ display: 'none' }} />

                {/* Input: Query with autocomplete */}
                <div className="search-input-wrapper" style={{ position: 'relative', gridColumn: '1 / -1', display: 'flex', alignItems: 'center', height: '44px' }}>
                    <input
                        type="text"
                        placeholder="digite a cidade ou bairro..."
                        className="search-input"
                        value={query}
                        onChange={(e) => handleInputChange(e.target.value)}
                        onFocus={handleFocus}
                        onKeyDown={handleKeyDown}
                        autoComplete="off"
                        style={{ width: '100%', height: '100%', border: 'none', padding: '0 36px 0 14px', fontSize: '0.82rem', outline: 'none', color: '#e0e0e0', background: 'transparent', fontFamily: "'Inter', sans-serif" }}
                    />
                    <MapPin size={16} className="input-icon" style={{ position: 'absolute', right: '56px', color: '#c9a96e', pointerEvents: 'none' }} />

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
                <button type="submit" className="search-submit" style={{ position: 'absolute', right: 0, bottom: 0, width: '46px', height: '44px', background: 'linear-gradient(135deg, #c9a96e 0%, #a88b4a 100%)', border: 'none', borderRadius: '0 0 8px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0a0a0a', zIndex: 2 }}>
                    <Search size={16} strokeWidth={2.5} />
                </button>
            </form>

            <style jsx>{`
                .search-container {
                    width: 100%;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 14px 20px;
                }
                .search-title {
                    background: linear-gradient(135deg, #c9a96e 0%, #dfc18e 50%, #a88b4a 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    font-size: 0.78rem;
                    font-weight: 700;
                    margin-bottom: 10px;
                    font-family: 'Inter', sans-serif;
                    text-align: center;
                    text-transform: uppercase;
                    letter-spacing: 2.5px;
                }
                .search-bar {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    background: #1a1a1a;
                    border-radius: 8px;
                    border: 1px solid rgba(201, 169, 110, 0.2);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.15);
                    overflow: visible;
                    width: 100%;
                    position: relative;
                }
                .search-select-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                    height: 44px;
                    border-bottom: 1px solid rgba(255,255,255,0.08);
                }
                .search-select-wrapper:first-of-type {
                    border-right: 1px solid rgba(255,255,255,0.08);
                }
                .search-select {
                    width: 100%;
                    height: 100%;
                    appearance: none;
                    border: none;
                    background: transparent;
                    padding: 0 28px 0 14px;
                    font-size: 0.82rem;
                    color: #d4d4d4;
                    cursor: pointer;
                    outline: none;
                    font-weight: 400;
                    font-family: 'Inter', sans-serif;
                }
                .search-select option,
                .search-select optgroup {
                    background: #1a1a1a;
                    color: #d4d4d4;
                }
                .select-icon {
                    position: absolute;
                    right: 10px;
                    color: #c9a96e;
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
                    height: 44px;
                }
                .search-input {
                    width: 100%;
                    height: 100%;
                    border: none;
                    padding: 0 36px 0 14px;
                    font-size: 0.82rem;
                    outline: none;
                    color: #e0e0e0;
                    background: transparent;
                    font-family: 'Inter', sans-serif;
                }
                .search-input::placeholder {
                    color: rgba(201, 169, 110, 0.4);
                    font-style: italic;
                }
                .input-icon {
                    position: absolute;
                    right: 56px;
                    color: #c9a96e;
                    pointer-events: none;
                }
                .search-submit {
                    position: absolute;
                    right: 0;
                    bottom: 0;
                    width: 46px;
                    height: 44px;
                    background: linear-gradient(135deg, #c9a96e 0%, #a88b4a 100%);
                    border: none;
                    border-radius: 0 0 8px 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: #0a0a0a;
                    transition: all 0.3s ease;
                    z-index: 2;
                }
                .search-submit:hover {
                    background: linear-gradient(135deg, #dfc18e 0%, #c9a96e 100%);
                    box-shadow: 0 0 16px rgba(201, 169, 110, 0.4);
                }

                /* === Suggestions Dropdown === */
                .suggestions-dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: #1a1a1a;
                    border: 1px solid rgba(201, 169, 110, 0.15);
                    border-top: 1px solid rgba(255,255,255,0.06);
                    border-radius: 0 0 8px 8px;
                    box-shadow: 0 12px 32px rgba(0,0,0,0.3);
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
                    color: #ccc;
                    transition: background 0.15s;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                }
                .suggestion-item:last-child {
                    border-bottom: none;
                }
                .suggestion-item:hover,
                .suggestion-item.active {
                    background: rgba(201, 169, 110, 0.08);
                    color: #e0e0e0;
                }
                .suggestion-icon {
                    flex-shrink: 0;
                    color: #c9a96e;
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
                    color: #888;
                }
                .suggestion-loading {
                    padding: 12px 14px;
                    font-size: 0.8rem;
                    color: #888;
                    text-align: center;
                }

                @media (min-width: 769px) {
                    .search-bar {
                        grid-template-columns: 1fr 1fr 2fr auto;
                        border-radius: 8px;
                    }
                    .search-select-wrapper {
                        border-bottom: none;
                    }
                    .search-select-wrapper:first-of-type {
                        border-right: 1px solid rgba(255,255,255,0.08);
                    }
                    .search-select-wrapper:nth-of-type(2) {
                        border-right: 1px solid rgba(255,255,255,0.08);
                    }
                    .search-input-wrapper {
                        grid-column: auto;
                    }
                    .search-submit {
                        position: relative;
                        width: 52px;
                        height: 44px;
                        border-radius: 0 8px 8px 0;
                    }
                    .input-icon {
                        right: 14px;
                    }
                }
            `}</style>
        </div>
    )
}
