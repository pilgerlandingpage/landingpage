'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Heart, MessageCircle, Scale, Search, Trash2 } from 'lucide-react'
import PropertyCard from './PropertyCard'
import { getPropertyIntelligenceLabels, getPropertyPricePerM2, toPropertyNumber } from '@/lib/properties/intelligence'
import { displayLocationName, normalizeLocationName, replaceItajaiWithPraiaBrava } from '@/lib/locations/display'
import { openWhatsAppWithLeadCapture } from '@/lib/tracking/whatsapp-capture'
import { trackEvent } from '@/lib/tracking/client'

const FAVORITES_KEY = 'pilger_property_favorites'

type FavoriteProperty = {
    id: string
    title?: string | null
    seo_title?: string | null
    city?: string | null
    state?: string | null
    neighborhood?: string | null
    price?: number | null
    bedrooms?: number | null
    bathrooms?: number | null
    suites?: number | null
    parking_spaces?: number | null
    area_m2?: number | null
    area_private_m2?: number | null
    featured_image?: string | null
    images?: string[] | null
    property_type?: string | null
    exclusive?: boolean | null
    source_status?: string | null
    description?: string | null
    amenities?: string[] | null
    latitude?: number | string | null
    longitude?: number | string | null
    created_at?: string | null
    updated_at?: string | null
}

function readFavoriteIds() {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || '[]')
        return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : []
    } catch {
        return []
    }
}

function writeFavoriteIds(ids: string[]) {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids.slice(0, 80)))
    window.dispatchEvent(new CustomEvent('pilger:favorites-changed', { detail: { ids } }))
}

function formatMoney(value?: number | string | null) {
    const number = toPropertyNumber(value)
    if (!number) return 'Sob consulta'

    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
    }).format(number)
}

function formatNumber(value?: number | string | null, suffix = '') {
    const number = toPropertyNumber(value)
    if (!number) return '-'
    return `${number.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${suffix}`
}

function propertyTitle(property: FavoriteProperty) {
    return replaceItajaiWithPraiaBrava(property.seo_title || property.title || 'Imóvel selecionado')
}

function propertyLocation(property: FavoriteProperty) {
    const neighborhood = replaceItajaiWithPraiaBrava(property.neighborhood)
    const city = displayLocationName(property.city)
    const parts = normalizeLocationName(neighborhood) === normalizeLocationName(city)
        ? [city]
        : [neighborhood, city]

    return parts.filter(Boolean).join(' - ') || 'Litoral catarinense'
}

function toPropertyCardInput(property: FavoriteProperty) {
    return {
        ...property,
        id: property.id,
        title: propertyTitle(property),
        city: property.city || null,
        state: property.state || null,
        price: property.price || null,
        bedrooms: property.bedrooms || null,
        bathrooms: property.bathrooms || null,
        area_m2: property.area_m2 || null,
        featured_image: property.featured_image || null,
    }
}

export default function FavoritePropertiesClient() {
    const [favoriteIds, setFavoriteIds] = useState<string[]>([])
    const [properties, setProperties] = useState<FavoriteProperty[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const syncFavorites = useCallback(() => {
        setFavoriteIds(readFavoriteIds())
    }, [])

    useEffect(() => {
        syncFavorites()
        window.addEventListener('storage', syncFavorites)
        window.addEventListener('pilger:favorites-changed', syncFavorites)

        return () => {
            window.removeEventListener('storage', syncFavorites)
            window.removeEventListener('pilger:favorites-changed', syncFavorites)
        }
    }, [syncFavorites])

    useEffect(() => {
        let cancelled = false

        async function loadFavorites() {
            if (favoriteIds.length === 0) {
                setProperties([])
                setIsLoading(false)
                return
            }

            setIsLoading(true)

            try {
                const response = await fetch(`/api/public/properties?ids=${encodeURIComponent(favoriteIds.join(','))}`)
                const data = await response.json()
                const list = Array.isArray(data.properties) ? data.properties : []
                const order = new Map(favoriteIds.map((id, index) => [id, index]))
                const sorted = list.sort((a: FavoriteProperty, b: FavoriteProperty) => (
                    (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999)
                ))

                if (!cancelled) setProperties(sorted)
            } catch {
                if (!cancelled) setProperties([])
            } finally {
                if (!cancelled) setIsLoading(false)
            }
        }

        void loadFavorites()

        return () => {
            cancelled = true
        }
    }, [favoriteIds])

    const comparedProperties = useMemo(() => properties.slice(0, 4), [properties])

    const removeFavorite = (id: string) => {
        const next = favoriteIds.filter(item => item !== id)
        writeFavoriteIds(next)

        void trackEvent('favorites_page_property_removed', {
            property_id: id,
            favorite_count: next.length,
        })
    }

    const openCuradoria = () => {
        const summary = properties
            .slice(0, 5)
            .map((property, index) => `${index + 1}. ${propertyTitle(property)} - ${propertyLocation(property)} - ${formatMoney(property.price)}`)
            .join('\n')

        openWhatsAppWithLeadCapture({
            phone: '5547992528080',
            message: `Olá! Salvei alguns imóveis no site e quero receber uma curadoria comparativa.\n\n${summary}`,
            slug: 'favoritos',
            template: 'favorites-comparison',
            metadata: {
                favorite_ids: favoriteIds,
                favorites_count: favoriteIds.length,
                tracking_event_type: 'property_value_reading_requested',
                premium_intent: 'value_reading',
                requested_action: 'Receber curadoria comparativa dos favoritos',
                cta_context: 'Pagina de favoritos',
            },
        })

        void trackEvent('property_value_reading_requested', {
            favorite_ids: favoriteIds,
            favorites_count: favoriteIds.length,
            premium_intent: 'value_reading',
            requested_action: 'Receber curadoria comparativa dos favoritos',
            cta_context: 'Pagina de favoritos',
            source: 'favorites_page_curadoria',
        })
    }

    return (
        <main className="favorites-page">
            <section className="favorites-hero">
                <div>
                    <span className="favorites-kicker">Curadoria pessoal</span>
                    <h1>Favoritos e comparacao</h1>
                    <p>
                        Salve os imóveis que chamaram sua atenção e compare perfil, localização, área e sinais de curadoria antes de chamar o especialista.
                    </p>
                </div>
                <div className="favorites-hero-actions">
                    <Link href="/busca" className="favorites-action">
                        <Search size={17} />
                        Buscar imóveis
                    </Link>
                    {properties.length > 0 && (
                        <button type="button" className="favorites-action favorites-action-primary" onClick={openCuradoria}>
                            <MessageCircle size={17} />
                            Pedir curadoria
                        </button>
                    )}
                </div>
            </section>

            {isLoading ? (
                <section className="favorites-state">
                    <Heart size={24} />
                    <strong>Carregando seus favoritos...</strong>
                </section>
            ) : properties.length === 0 ? (
                <section className="favorites-state">
                    <Heart size={26} />
                    <strong>Nenhum favorito salvo ainda</strong>
                    <p>Toque no coração dos imóveis para montar sua seleção e comparar depois.</p>
                    <Link href="/busca" className="favorites-action favorites-action-primary">
                        <Search size={17} />
                        Explorar imóveis
                    </Link>
                </section>
            ) : (
                <>
                    <section className="favorites-grid" aria-label="Imóveis favoritos">
                        {properties.map((property, index) => (
                            <article className="favorite-card-shell" key={property.id}>
                                <PropertyCard property={toPropertyCardInput(property)} imagePriority={index < 2} variant="homeCompact" />
                                <button type="button" className="favorite-remove" onClick={() => removeFavorite(property.id)}>
                                    <Trash2 size={14} />
                                    Remover
                                </button>
                            </article>
                        ))}
                    </section>

                    <section className="favorites-compare" aria-label="Comparacao dos favoritos">
                        <div className="favorites-section-title">
                            <Scale size={19} />
                            <div>
                                <span>Comparador</span>
                                <h2>Primeiros {comparedProperties.length} favoritos</h2>
                            </div>
                        </div>
                        <div className="favorites-compare-table-wrap">
                            <table className="favorites-compare-table">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        {comparedProperties.map(property => (
                                            <th key={property.id}>{propertyTitle(property)}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Valor</td>
                                        {comparedProperties.map(property => <td key={property.id}>{formatMoney(property.price)}</td>)}
                                    </tr>
                                    <tr>
                                        <td>Localização</td>
                                        {comparedProperties.map(property => <td key={property.id}>{propertyLocation(property)}</td>)}
                                    </tr>
                                    <tr>
                                        <td>Tipo</td>
                                        {comparedProperties.map(property => <td key={property.id}>{property.property_type || '-'}</td>)}
                                    </tr>
                                    <tr>
                                        <td>Suítes</td>
                                        {comparedProperties.map(property => <td key={property.id}>{formatNumber(property.suites)}</td>)}
                                    </tr>
                                    <tr>
                                        <td>Vagas</td>
                                        {comparedProperties.map(property => <td key={property.id}>{formatNumber(property.parking_spaces)}</td>)}
                                    </tr>
                                    <tr>
                                        <td>Área</td>
                                        {comparedProperties.map(property => <td key={property.id}>{formatNumber(property.area_private_m2 || property.area_m2, ' m²')}</td>)}
                                    </tr>
                                    <tr>
                                        <td>R$/m²</td>
                                        {comparedProperties.map(property => <td key={property.id}>{formatMoney(getPropertyPricePerM2(property))}</td>)}
                                    </tr>
                                    <tr>
                                        <td>Sinais</td>
                                        {comparedProperties.map(property => (
                                            <td key={property.id}>
                                                <div className="compare-signal-list">
                                                    {getPropertyIntelligenceLabels(property, { max: 3 }).map(label => (
                                                        <span key={label.key}>{label.label}</span>
                                                    ))}
                                                </div>
                                            </td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>
                </>
            )}

            <style jsx>{`
                .favorites-page {
                    min-height: calc(100vh - 72px);
                    padding: clamp(22px, 4vw, 46px) clamp(16px, 4vw, 56px) 70px;
                    background:
                        linear-gradient(180deg, #f8f6f1 0%, #eee9df 100%);
                    color: #211d18;
                }
                .favorites-hero {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    gap: 22px;
                    max-width: 1180px;
                    margin: 0 auto 26px;
                }
                .favorites-kicker {
                    display: inline-flex;
                    margin-bottom: 8px;
                    color: #9d7436;
                    font: 900 0.68rem/1 'Inter', sans-serif;
                    letter-spacing: 0.18em;
                    text-transform: uppercase;
                }
                .favorites-hero h1 {
                    margin: 0;
                    color: #1f1b16;
                    font-family: 'Noto Serif', Georgia, serif;
                    font-size: clamp(1.65rem, 3.8vw, 3.1rem);
                    line-height: 0.98;
                    letter-spacing: 0;
                }
                .favorites-hero p {
                    max-width: 650px;
                    margin: 12px 0 0;
                    color: #746b60;
                    font: 650 0.95rem/1.55 'Inter', sans-serif;
                }
                .favorites-hero-actions,
                .favorites-section-title,
                .favorites-action,
                .favorite-remove {
                    display: inline-flex;
                    align-items: center;
                }
                .favorites-hero-actions {
                    gap: 10px;
                    flex-wrap: wrap;
                    justify-content: flex-end;
                }
                .favorites-action,
                .favorite-remove {
                    justify-content: center;
                    gap: 8px;
                    min-height: 40px;
                    padding: 0 15px;
                    border: 1px solid rgba(34,29,22,0.12);
                    border-radius: 999px;
                    background: rgba(255,255,255,0.82);
                    color: #231f18;
                    cursor: pointer;
                    font: 850 0.78rem/1 'Inter', sans-serif;
                    text-decoration: none;
                    box-shadow: 0 12px 28px rgba(30,24,17,0.08);
                }
                .favorites-action-primary {
                    border-color: rgba(255,255,255,0.28);
                    background: linear-gradient(135deg, #dfc18e, #b8945f);
                    color: #111;
                }
                .favorites-state {
                    display: grid;
                    justify-items: center;
                    gap: 12px;
                    max-width: 560px;
                    margin: 70px auto;
                    padding: 40px 22px;
                    border: 1px solid rgba(184,148,95,0.16);
                    border-radius: 18px;
                    background: rgba(255,255,255,0.76);
                    color: #756d62;
                    text-align: center;
                    box-shadow: 0 18px 44px rgba(31,26,18,0.08);
                }
                .favorites-state svg {
                    color: #b8945f;
                }
                .favorites-state strong {
                    color: #211d18;
                    font: 850 1rem/1.2 'Inter', sans-serif;
                }
                .favorites-state p {
                    margin: 0;
                    max-width: 340px;
                    font: 650 0.86rem/1.45 'Inter', sans-serif;
                }
                .favorites-grid,
                .favorites-compare {
                    max-width: 1180px;
                    margin: 0 auto;
                }
                .favorites-grid {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 22px 18px;
                }
                .favorite-card-shell {
                    min-width: 0;
                }
                .favorite-remove {
                    width: 100%;
                    min-height: 34px;
                    margin-top: 10px;
                    background: rgba(255,255,255,0.62);
                    color: #665d52;
                    box-shadow: none;
                }
                .favorites-compare {
                    margin-top: 42px;
                    padding-top: 28px;
                    border-top: 1px solid rgba(184,148,95,0.18);
                }
                .favorites-section-title {
                    gap: 10px;
                    margin-bottom: 16px;
                }
                .favorites-section-title svg {
                    color: #a78042;
                }
                .favorites-section-title span {
                    color: #a78042;
                    font: 900 0.66rem/1 'Inter', sans-serif;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                }
                .favorites-section-title h2 {
                    margin: 2px 0 0;
                    font-family: 'Noto Serif', Georgia, serif;
                    font-size: 1.35rem;
                    line-height: 1;
                }
                .favorites-compare-table-wrap {
                    overflow-x: auto;
                    border: 1px solid rgba(31,27,21,0.1);
                    border-radius: 16px;
                    background: rgba(255,255,255,0.86);
                    box-shadow: 0 18px 44px rgba(31,26,18,0.08);
                }
                .favorites-compare-table {
                    width: 100%;
                    min-width: 760px;
                    border-collapse: collapse;
                    font-family: 'Inter', sans-serif;
                }
                .favorites-compare-table th,
                .favorites-compare-table td {
                    width: 20%;
                    padding: 14px 15px;
                    border-bottom: 1px solid rgba(31,27,21,0.08);
                    color: #40382f;
                    font-size: 0.82rem;
                    line-height: 1.35;
                    text-align: left;
                    vertical-align: top;
                }
                .favorites-compare-table th:first-child,
                .favorites-compare-table td:first-child {
                    width: 130px;
                    color: #8b6a39;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .favorites-compare-table th {
                    background: rgba(184,148,95,0.1);
                    color: #201d18;
                    font-weight: 900;
                }
                .favorites-compare-table tr:last-child td {
                    border-bottom: 0;
                }
                .compare-signal-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                }
                .compare-signal-list span {
                    display: inline-flex;
                    min-height: 22px;
                    align-items: center;
                    padding: 0 7px;
                    border-radius: 999px;
                    background: rgba(184,148,95,0.12);
                    color: #8f6726;
                    font: 850 0.62rem/1 'Inter', sans-serif;
                    white-space: nowrap;
                }
                @media (max-width: 900px) {
                    .favorites-hero {
                        display: grid;
                        align-items: start;
                    }
                    .favorites-hero-actions {
                        justify-content: start;
                    }
                    .favorites-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 22px 12px;
                    }
                }
                @media (max-width: 560px) {
                    .favorites-page {
                        padding: 18px 14px 82px;
                    }
                    .favorites-hero {
                        margin-bottom: 22px;
                    }
                    .favorites-hero p {
                        font-size: 0.86rem;
                    }
                    .favorites-action {
                        min-height: 38px;
                        padding: 0 13px;
                        font-size: 0.72rem;
                    }
                    .favorites-grid {
                        gap: 20px 10px;
                    }
                    .favorites-compare {
                        margin-top: 34px;
                    }
                }
            `}</style>
        </main>
    )
}
