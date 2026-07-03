'use client'

import { useEffect, useState, useCallback } from 'react'

type Property = {
    id: string
    title: string
    city: string
    price: number
    main_image_url: string
}

const FEATURED_SECTION_DEFAULT_TITLE = 'Destaques'
const FEATURED_SECTION_LEGACY_TITLES = new Set(['selecao exclusiva', 'selecao em destaque'])

function normalizeFeaturedSectionTitle(value: unknown) {
    const title = String(value || '').trim()
    const normalized = title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()

    if (!title || FEATURED_SECTION_LEGACY_TITLES.has(normalized)) {
        return FEATURED_SECTION_DEFAULT_TITLE
    }

    return title
}

const SECTION_OPTIONS = [
    { key: 'featured', label: 'Destaques', desc: 'Imóveis premium selecionados pelo admin' },
    { key: 'newest', label: 'Recém Adicionados', desc: 'Os últimos imóveis cadastrados' },
    { key: 'cta', label: 'CTA WhatsApp', desc: 'Banner "Não encontrou?" com botão WhatsApp' },
    { key: 'by_city', label: 'Por Cidade', desc: 'Imóveis agrupados por cidade' },
    { key: 'launches', label: 'Lançamentos', desc: 'Imóveis na planta ou em construção' },
]

const SORT_OPTIONS = [
    { value: 'price-desc', label: 'Maior preço primeiro' },
    { value: 'price-asc', label: 'Menor preço primeiro' },
    { value: 'newest', label: 'Mais recentes' },
    { value: 'manual', label: 'Seleção manual' },
]

const CITY_OPTIONS = [
    'Balneário Camboriú', 'Itajaí', 'Itapema', 'Porto Belo',
    'Camboriú', 'Navegantes', 'Blumenau', 'Florianópolis',
]

export default function HomepageConfigPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [properties, setProperties] = useState<Property[]>([])
    const [searchQuery, setSearchQuery] = useState('')

    // Config state
    const [featuredIds, setFeaturedIds] = useState<string[]>([])
    const [featuredTitle, setFeaturedTitle] = useState(FEATURED_SECTION_DEFAULT_TITLE)
    const [sectionsEnabled, setSectionsEnabled] = useState<string[]>(['featured', 'newest', 'cta', 'by_city'])
    const [featuredCities, setFeaturedCities] = useState<string[]>(['Balneário Camboriú', 'Itajaí', 'Itapema', 'Porto Belo'])
    const [itemsPerSection, setItemsPerSection] = useState(8)
    const [featuredMinPrice, setFeaturedMinPrice] = useState(0)
    const [featuredMaxPrice, setFeaturedMaxPrice] = useState(0)
    const [featuredSort, setFeaturedSort] = useState('price-desc')
    const [googleReviewsEnabled, setGoogleReviewsEnabled] = useState(true)
    const [googleReviewsPlaceId, setGoogleReviewsPlaceId] = useState('')
    const [googleReviewsUrl, setGoogleReviewsUrl] = useState('')
    const [googleMapsUrl, setGoogleMapsUrl] = useState('')

    useEffect(() => {
        fetch('/api/admin/homepage-config')
            .then(r => r.json())
            .then(d => {
                if (d.success) {
                    const c = d.config
                    try { setFeaturedIds(JSON.parse(c.homepage_featured_ids || '[]')) } catch { }
                    setFeaturedTitle(normalizeFeaturedSectionTitle(c.homepage_featured_title))
                    try { setSectionsEnabled(JSON.parse(c.homepage_sections_enabled || '[]')) } catch { }
                    try { setFeaturedCities(JSON.parse(c.homepage_featured_cities || '[]')) } catch { }
                    setItemsPerSection(parseInt(c.homepage_items_per_section) || 8)
                    setFeaturedMinPrice(parseInt(c.homepage_featured_min_price) || 0)
                    setFeaturedMaxPrice(parseInt(c.homepage_featured_max_price) || 0)
                    setFeaturedSort(c.homepage_featured_sort || 'price-desc')
                    setGoogleReviewsEnabled((c.homepage_google_reviews_enabled || 'true') !== 'false')
                    setGoogleReviewsPlaceId(c.homepage_google_reviews_place_id || '')
                    setGoogleReviewsUrl(c.homepage_google_reviews_url || '')
                    setGoogleMapsUrl(c.homepage_google_maps_url || '')
                    setProperties(d.properties || [])
                }
            })
            .catch(e => console.error(e))
            .finally(() => setLoading(false))
    }, [])

    const save = useCallback(async () => {
        setSaving(true)
        setMessage('')
        try {
            const res = await fetch('/api/admin/homepage-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    config: {
                        homepage_featured_ids: JSON.stringify(featuredIds),
                        homepage_featured_title: featuredTitle,
                        homepage_sections_enabled: JSON.stringify(sectionsEnabled),
                        homepage_featured_cities: JSON.stringify(featuredCities),
                        homepage_items_per_section: String(itemsPerSection),
                        homepage_featured_min_price: String(featuredMinPrice),
                        homepage_featured_max_price: String(featuredMaxPrice),
                        homepage_featured_sort: featuredSort,
                        homepage_google_reviews_enabled: googleReviewsEnabled ? 'true' : 'false',
                        homepage_google_reviews_place_id: googleReviewsPlaceId.trim(),
                        homepage_google_reviews_url: googleReviewsUrl.trim(),
                        homepage_google_maps_url: googleMapsUrl.trim(),
                    }
                })
            })
            const data = await res.json()
            setMessage(data.success ? '✅ Configurações salvas!' : `❌ ${data.message}`)
        } catch {
            setMessage('❌ Erro ao salvar')
        } finally {
            setSaving(false)
        }
    }, [
        featuredIds,
        featuredTitle,
        sectionsEnabled,
        featuredCities,
        itemsPerSection,
        featuredMinPrice,
        featuredMaxPrice,
        featuredSort,
        googleReviewsEnabled,
        googleReviewsPlaceId,
        googleReviewsUrl,
        googleMapsUrl,
    ])

    const toggleSection = (key: string) => {
        setSectionsEnabled(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        )
    }

    const toggleCity = (city: string) => {
        setFeaturedCities(prev =>
            prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
        )
    }

    const addFeatured = (id: string) => {
        if (!featuredIds.includes(id)) setFeaturedIds(prev => [...prev, id])
    }

    const removeFeatured = (id: string) => {
        setFeaturedIds(prev => prev.filter(fid => fid !== id))
    }

    const formatPrice = (price: number) => {
        if (!price) return 'Sob Consulta'
        return `R$ ${price.toLocaleString('pt-BR')}`
    }

    const filteredProperties = properties.filter(p => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return (p.title || '').toLowerCase().includes(q) ||
            (p.city || '').toLowerCase().includes(q)
    })

    const selectedProperties = properties.filter(p => featuredIds.includes(p.id))

    if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Carregando...</div>

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
            <style jsx>{`
                .hp-card { background: #fff; border-radius: 12px; padding: 24px; margin-bottom: 20px; border: 1px solid #e8e5e0; }
                .hp-card h3 { font-size: 1rem; font-weight: 700; color: #1a1a1a; margin: 0 0 4px 0; font-family: Inter, sans-serif; }
                .hp-card .desc { font-size: 0.78rem; color: #999; margin: 0 0 16px 0; }
                .hp-label { font-size: 0.78rem; font-weight: 600; color: #555; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 0.05em; }
                .hp-input { width: 100%; padding: 10px 14px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 0.88rem; outline: none; transition: border-color 0.2s; }
                .hp-input:focus { border-color: #b8945f; }
                .hp-row { display: flex; gap: 12px; flex-wrap: wrap; }
                .hp-chip { display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 50px; font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: all 0.2s; border: 2px solid transparent; user-select: none; }
                .hp-chip.on { background: #f0ede8; color: #b8945f; border-color: #b8945f; }
                .hp-chip.off { background: #f5f5f5; color: #999; border-color: #eee; }
                .hp-chip.off:hover { border-color: #ccc; }
                .hp-select { padding: 10px 14px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 0.88rem; outline: none; background: white; width: 100%; }
                .hp-number { width: 120px; }
                .hp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
                .hp-prop-item { display: flex; align-items: center; gap: 8px; padding: 8px; border: 1px solid #eee; border-radius: 8px; cursor: pointer; transition: all 0.2s; font-size: 0.78rem; }
                .hp-prop-item:hover { border-color: #b8945f; background: #faf8f5; }
                .hp-prop-item.selected { border-color: #b8945f; background: #f0ede8; }
                .hp-prop-img { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; background: #eee; flex-shrink: 0; }
                .hp-prop-info { flex: 1; overflow: hidden; }
                .hp-prop-title { font-weight: 600; color: #1a1a1a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .hp-prop-meta { color: #999; font-size: 0.72rem; }
                .hp-remove-btn { background: none; border: none; color: #d94040; cursor: pointer; font-size: 1.1rem; padding: 0 4px; }
                .hp-save-bar { position: sticky; bottom: 0; background: white; padding: 16px; border-top: 1px solid #e8e5e0; display: flex; align-items: center; justify-content: space-between; gap: 12px; z-index: 10; border-radius: 12px 12px 0 0; box-shadow: 0 -4px 20px rgba(0,0,0,0.05); }
                .hp-save-btn { background: linear-gradient(135deg, #b8945f, #d4b87a); color: white; border: none; padding: 12px 32px; border-radius: 50px; font-weight: 700; font-size: 0.88rem; cursor: pointer; transition: all 0.3s; }
                .hp-save-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(184,148,95,0.3); }
                .hp-save-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
                .hp-msg { font-size: 0.82rem; font-weight: 600; }
                .hp-price-row { display: flex; gap: 12px; align-items: center; }
                .hp-price-input { width: 180px; }
                .hp-toggle { display: inline-flex; align-items: center; gap: 9px; color: #333; font-size: 0.84rem; font-weight: 700; cursor: pointer; user-select: none; }
                .hp-toggle input { width: 18px; height: 18px; accent-color: #b8945f; }
                .hp-help { color: #8a7c6b; font-size: 0.73rem; line-height: 1.45; margin: 6px 0 0; }
            `}</style>

            <h2 style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>
                Configurar Homepage
            </h2>
            <p style={{ color: '#999', fontSize: '0.82rem', marginBottom: 24 }}>
                Controle quais seções e imóveis aparecem na página inicial
            </p>

            {/* SECTIONS TOGGLE */}
            <div className="hp-card">
                <h3>📐 Seções Ativas</h3>
                <p className="desc">Escolha quais seções aparecem na homepage</p>
                <div className="hp-row">
                    {SECTION_OPTIONS.map(s => (
                        <div
                            key={s.key}
                            className={`hp-chip ${sectionsEnabled.includes(s.key) ? 'on' : 'off'}`}
                            onClick={() => toggleSection(s.key)}
                            title={s.desc}
                        >
                            {sectionsEnabled.includes(s.key) ? '✓' : '○'} {s.label}
                        </div>
                    ))}
                </div>
            </div>

            {/* GOOGLE REVIEWS */}
            <div className="hp-card">
                <h3>Avaliacoes do Google</h3>
                <p className="desc">Exibe reviews reais do Google na home e envia o cliente para avaliar no Google.</p>

                <label className="hp-toggle">
                    <input
                        type="checkbox"
                        checked={googleReviewsEnabled}
                        onChange={event => setGoogleReviewsEnabled(event.target.checked)}
                    />
                    Exibir secao de avaliacoes na home
                </label>

                <div style={{ marginTop: 16 }}>
                    <p className="hp-label">Google Place ID</p>
                    <input
                        className="hp-input"
                        value={googleReviewsPlaceId}
                        onChange={event => setGoogleReviewsPlaceId(event.target.value)}
                        placeholder="Ex: ChIJ..."
                    />
                    <p className="hp-help">
                        Necessario para buscar as avaliacoes pela Places API. A chave deve estar no ambiente como GOOGLE_PLACES_API_KEY, GOOGLE_MAPS_API_KEY ou NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
                    </p>
                </div>

                <div style={{ marginTop: 16 }}>
                    <p className="hp-label">Link para avaliar no Google</p>
                    <input
                        className="hp-input"
                        value={googleReviewsUrl}
                        onChange={event => setGoogleReviewsUrl(event.target.value)}
                        placeholder="Cole aqui o link oficial de avaliacao do Perfil da Empresa"
                    />
                    <p className="hp-help">
                        Se ficar vazio, o site tenta gerar um link de avaliacao usando o Place ID.
                    </p>
                </div>

                <div style={{ marginTop: 16 }}>
                    <p className="hp-label">Link do perfil no Google Maps</p>
                    <input
                        className="hp-input"
                        value={googleMapsUrl}
                        onChange={event => setGoogleMapsUrl(event.target.value)}
                        placeholder="Opcional: URL publica do perfil no Google Maps"
                    />
                </div>
            </div>

            {/* FEATURED SECTION CONFIG */}
            <div className="hp-card">
                <h3>⭐ Destaques</h3>
                <p className="desc">Configure o título, ordenação e filtro de preço da primeira seção</p>

                <p className="hp-label">Título da seção</p>
                <input
                    className="hp-input"
                    value={featuredTitle}
                    onChange={e => setFeaturedTitle(e.target.value)}
                    placeholder="Ex: Destaques do portfólio"
                />

                <div style={{ marginTop: 16 }}>
                    <p className="hp-label">Ordenação</p>
                    <select
                        className="hp-select"
                        value={featuredSort}
                        onChange={e => setFeaturedSort(e.target.value)}
                    >
                        {SORT_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </div>

                <div style={{ marginTop: 16 }}>
                    <p className="hp-label">Filtro de Preço</p>
                    <div className="hp-price-row">
                        <div>
                            <label style={{ fontSize: '0.72rem', color: '#999' }}>Mínimo (R$)</label>
                            <input
                                type="number"
                                className="hp-input hp-price-input"
                                value={featuredMinPrice || ''}
                                onChange={e => setFeaturedMinPrice(parseInt(e.target.value) || 0)}
                                placeholder="0"
                            />
                        </div>
                        <span style={{ color: '#999', paddingTop: 16 }}>até</span>
                        <div>
                            <label style={{ fontSize: '0.72rem', color: '#999' }}>Máximo (R$) — 0 = sem limite</label>
                            <input
                                type="number"
                                className="hp-input hp-price-input"
                                value={featuredMaxPrice || ''}
                                onChange={e => setFeaturedMaxPrice(parseInt(e.target.value) || 0)}
                                placeholder="0 = sem limite"
                            />
                        </div>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: '#b8945f', marginTop: 4 }}>
                        💡 Ex: Mínimo 5.000.000 mostra apenas imóveis acima de R$ 5 milhões
                    </p>
                </div>

                <div style={{ marginTop: 16 }}>
                    <p className="hp-label">Quantidade por seção</p>
                    <input
                        type="number"
                        className="hp-input hp-number"
                        value={itemsPerSection}
                        onChange={e => setItemsPerSection(Math.max(2, Math.min(20, parseInt(e.target.value) || 8)))}
                        min={2}
                        max={20}
                    />
                </div>
            </div>

            {/* MANUAL SELECTION */}
            {featuredSort === 'manual' && (
                <div className="hp-card">
                    <h3>🎯 Imóveis Selecionados Manualmente</h3>
                    <p className="desc">Escolha quais imóveis aparecem em Destaques</p>

                    {/* Selected items */}
                    {selectedProperties.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            <p className="hp-label">Selecionados ({selectedProperties.length})</p>
                            <div className="hp-grid">
                                {selectedProperties.map(p => (
                                    <div key={p.id} className="hp-prop-item selected">
                                        <img src={p.main_image_url || '/placeholder.jpg'} className="hp-prop-img" alt="" />
                                        <div className="hp-prop-info">
                                            <div className="hp-prop-title">{p.city}</div>
                                            <div className="hp-prop-meta">{formatPrice(p.price)}</div>
                                        </div>
                                        <button className="hp-remove-btn" onClick={() => removeFeatured(p.id)}>×</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Search and add */}
                    <p className="hp-label">Buscar imóvel para adicionar</p>
                    <input
                        className="hp-input"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Buscar por título ou cidade..."
                        style={{ marginBottom: 12 }}
                    />
                    <div className="hp-grid" style={{ maxHeight: 300, overflowY: 'auto' }}>
                        {filteredProperties.slice(0, 50).map(p => (
                            <div
                                key={p.id}
                                className={`hp-prop-item ${featuredIds.includes(p.id) ? 'selected' : ''}`}
                                onClick={() => featuredIds.includes(p.id) ? removeFeatured(p.id) : addFeatured(p.id)}
                            >
                                <img src={p.main_image_url || '/placeholder.jpg'} className="hp-prop-img" alt="" />
                                <div className="hp-prop-info">
                                    <div className="hp-prop-title">{p.city}</div>
                                    <div className="hp-prop-meta">{formatPrice(p.price)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* CITIES */}
            <div className="hp-card">
                <h3>🏙️ Cidades em Destaque</h3>
                <p className="desc">Selecione as cidades que terão seção própria na homepage</p>
                <div className="hp-row">
                    {CITY_OPTIONS.map(city => (
                        <div
                            key={city}
                            className={`hp-chip ${featuredCities.includes(city) ? 'on' : 'off'}`}
                            onClick={() => toggleCity(city)}
                        >
                            {featuredCities.includes(city) ? '✓' : '○'} {city}
                        </div>
                    ))}
                </div>
            </div>

            {/* SAVE BAR */}
            <div className="hp-save-bar">
                <span className="hp-msg">{message}</span>
                <button className="hp-save-btn" onClick={save} disabled={saving}>
                    {saving ? 'Salvando...' : '💾 Salvar Configurações'}
                </button>
            </div>
        </div>
    )
}
