'use client'

import { Search, Filter } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function HomeSearchBar() {
    const router = useRouter()
    const [query, setQuery] = useState('')

    const handleSearch = (e?: React.FormEvent) => {
        e?.preventDefault()
        if (query.trim()) {
            router.push(`/busca?q=${encodeURIComponent(query)}`)
        } else {
            router.push('/busca')
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch()
        }
    }

    return (
        <div className="search-container">
            <div className="search-pill">
                <div className="search-icon-wrapper" onClick={() => handleSearch()}>
                    <Search size={18} strokeWidth={3} />
                </div>

                <div className="search-input-wrapper">
                    <input
                        type="text"
                        placeholder="Encontre seu imóvel (ex: Jurerê, Frente Mar)"
                        className="search-input-field"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus={false}
                    />
                    <span className="search-subtitle-static">Localização • Tipo • Faixa de preço</span>
                </div>

                <div className="filter-button" onClick={() => router.push('/busca')}>
                    <Filter size={16} />
                </div>
            </div>

            <style jsx>{`
                .search-container {
                    max-width: 700px;
                    margin: 0 auto;
                    padding: 10px 20px 0 20px;
                }
                .search-pill {
                    background: var(--bg-secondary, #f7f7f5);
                    border: 1px solid var(--border, #e8e5e0);
                    border-radius: 100px;
                    padding: 8px 14px 8px 18px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
                    transition: box-shadow 0.3s, border-color 0.3s;
                }
                .search-pill:focus-within {
                    box-shadow: 0 4px 14px rgba(0,0,0,0.08);
                    border-color: var(--gold, #b8945f);
                }
                .search-icon-wrapper {
                    display: flex;
                    align-items: center;
                    color: var(--gold, #b8945f);
                    cursor: pointer;
                }
                .search-input-wrapper {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }
                .search-input-field {
                    width: 100%;
                    border: none;
                    background: transparent;
                    font-size: 0.88rem;
                    font-weight: 600;
                    color: #1a1a1a;
                    outline: none;
                    padding: 0;
                    margin-bottom: 2px;
                    font-family: inherit;
                }
                .search-input-field::placeholder {
                    color: #1a1a1a;
                    opacity: 0.6;
                }
                .search-subtitle-static {
                    font-size: 0.68rem;
                    color: var(--text-muted, #666);
                    line-height: 1;
                }
                .filter-button {
                    border: 1px solid var(--border, #e8e5e0);
                    border-radius: 50%;
                    width: 34px;
                    height: 34px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: transparent;
                    color: var(--text-secondary, #5a5a5a);
                    cursor: pointer;
                    transition: border-color 0.2s, color 0.2s;
                }
                .filter-button:hover {
                    border-color: var(--gold, #b8945f);
                    color: var(--gold, #b8945f);
                }
            `}</style>
        </div>
    )
}
