'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Clock3, Heart } from 'lucide-react'
import { displayLocationName, normalizeLocationName, replaceItajaiWithPraiaBrava } from '@/lib/locations/display'
import { getPropertyPrimaryQualityLabel } from '@/lib/properties/intelligence'
import { propertyDetailsPath } from '@/lib/properties/responsive-destination'
import { trackEvent } from '@/lib/tracking/client'

const FAVORITES_KEY = 'pilger_property_favorites'
const HISTORY_KEY = 'pilger_property_history'
const MAX_MEMORY_ITEMS = 8
const FALLBACK_IMAGE = '/opengraph-image'

type MemoryProperty = {
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
    created_at?: string | null
    updated_at?: string | null
}

type PropertyContinuationRailProps = {
    currentPropertyId: string
    title?: string
}

function readStoredIds(key: string) {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(key) || '[]')
        return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : []
    } catch {
        return []
    }
}

function mergeMemoryIds(currentPropertyId: string) {
    const favorites = readStoredIds(FAVORITES_KEY)
    const history = readStoredIds(HISTORY_KEY)
    const seen = new Set<string>()
    const ids: string[] = []

    for (const id of [...favorites, ...history]) {
        if (!id || id === currentPropertyId || seen.has(id)) continue
        seen.add(id)
        ids.push(id)
    }

    return {
        favorites,
        history,
        ids: ids.slice(0, MAX_MEMORY_ITEMS),
    }
}

function toNumber(value: unknown) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0
    const normalized = String(value || '')
        .replace(/[^\d,.-]/g, '')
        .replace(/\./g, '')
        .replace(',', '.')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value?: number | null, fallback = 'Sob consulta') {
    const numericValue = toNumber(value)
    if (!numericValue) return fallback

    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
    }).format(numericValue)
}

function statLabel(value: number, singular: string, plural: string) {
    return value === 1 ? singular : plural
}

function buildDisplayLocationParts(neighborhood: unknown, city: unknown) {
    const displayNeighborhood = replaceItajaiWithPraiaBrava(neighborhood)
    const displayCity = displayLocationName(city)

    if (normalizeLocationName(displayNeighborhood) === normalizeLocationName(displayCity)) {
        return [displayNeighborhood || displayCity].filter(Boolean)
    }

    return [displayNeighborhood, displayCity].filter(Boolean)
}

function cleanRepeatedPraiaBravaText(value: unknown) {
    return replaceItajaiWithPraiaBrava(value)
        .replace(/\b(na|no|em)\s+Praia Brava\s+em\s+Praia Brava\b/gi, '$1 Praia Brava')
        .replace(/\bPraia Brava\s+em\s+Praia Brava\b/gi, 'Praia Brava')
}

export default function PropertyContinuationRail({ currentPropertyId, title }: PropertyContinuationRailProps) {
    const [favoriteIds, setFavoriteIds] = useState<string[]>([])
    const [historyIds, setHistoryIds] = useState<string[]>([])
    const [memoryIds, setMemoryIds] = useState<string[]>([])
    const [properties, setProperties] = useState<MemoryProperty[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const viewedRef = useRef(false)

    const syncMemory = useCallback(() => {
        const memory = mergeMemoryIds(currentPropertyId)
        setFavoriteIds(memory.favorites)
        setHistoryIds(memory.history)
        setMemoryIds(memory.ids)
    }, [currentPropertyId])

    useEffect(() => {
        syncMemory()
        window.addEventListener('storage', syncMemory)
        window.addEventListener('pilger:favorites-changed', syncMemory)
        window.addEventListener('pilger:history-changed', syncMemory)

        return () => {
            window.removeEventListener('storage', syncMemory)
            window.removeEventListener('pilger:favorites-changed', syncMemory)
            window.removeEventListener('pilger:history-changed', syncMemory)
        }
    }, [syncMemory])

    const idsKey = memoryIds.join(',')

    useEffect(() => {
        let cancelled = false

        async function loadMemoryProperties() {
            if (!memoryIds.length) {
                setProperties([])
                setIsLoading(false)
                return
            }

            setIsLoading(true)

            try {
                const response = await fetch(`/api/public/properties?ids=${encodeURIComponent(idsKey)}`)
                const data = await response.json().catch(() => ({}))
                const list = Array.isArray(data.properties) ? data.properties : []
                const order = new Map(memoryIds.map((id, index) => [id, index]))
                const sorted = list
                    .filter((property: MemoryProperty) => property?.id && property.id !== currentPropertyId)
                    .sort((a: MemoryProperty, b: MemoryProperty) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999))

                if (!cancelled) setProperties(sorted)
            } catch {
                if (!cancelled) setProperties([])
            } finally {
                if (!cancelled) setIsLoading(false)
            }
        }

        void loadMemoryProperties()

        return () => {
            cancelled = true
        }
    }, [currentPropertyId, idsKey, memoryIds])

    const visibleProperties = useMemo(() => properties.slice(0, 4), [properties])

    useEffect(() => {
        if (viewedRef.current || visibleProperties.length === 0) return
        viewedRef.current = true

        void trackEvent('property_details_continuation_viewed', {
            property_id: currentPropertyId,
            title: title || null,
            shown_property_ids: visibleProperties.map(property => property.id),
            favorite_count: favoriteIds.length,
            history_count: historyIds.length,
        })
    }, [currentPropertyId, favoriteIds.length, historyIds.length, title, visibleProperties])

    const handlePropertyClick = (property: MemoryProperty, index: number) => {
        void trackEvent('property_details_continuation_property_clicked', {
            property_id: property.id,
            source_property_id: currentPropertyId,
            title: property.seo_title || property.title || null,
            source_title: title || null,
            card_index: index,
            favorite_count: favoriteIds.length,
            history_count: historyIds.length,
        })
    }

    if (!isLoading && visibleProperties.length === 0) return null

    return (
        <section className="plp-related-band plp-continuation-rail" aria-label="Imóveis salvos e vistos recentemente">
            <div className="plp-related-head plp-continuation-head">
                <div>
                    <span className="plp-continuation-kicker">
                        <Clock3 size={14} />
                        Continue de onde parou
                    </span>
                    <h2>Retome salvos e visitas recentes.</h2>
                </div>
                {favoriteIds.length > 0 && (
                    <Link
                        href="/favoritos"
                        onClick={() => {
                            void trackEvent('property_details_continuation_favorites_clicked', {
                                property_id: currentPropertyId,
                                favorite_count: favoriteIds.length,
                                history_count: historyIds.length,
                            })
                        }}
                    >
                        <Heart size={15} />
                        Comparar salvos
                        <ArrowRight size={14} />
                    </Link>
                )}
            </div>

            {isLoading && visibleProperties.length === 0 ? (
                <div className="plp-continuation-loading">Carregando sua selecao...</div>
            ) : (
                <div className="plp-related-grid plp-continuation-grid">
                    {visibleProperties.map((property, index) => {
                        const image = property.featured_image || property.images?.[0] || FALLBACK_IMAGE
                        const itemArea = toNumber(property.area_private_m2 || property.area_m2)
                        const itemSuites = toNumber(property.suites || property.bedrooms)
                        const itemParking = toNumber(property.parking_spaces)
                        const relatedLocation = buildDisplayLocationParts(property.neighborhood, property.city).join(' - ')
                        const relatedTitle = cleanRepeatedPraiaBravaText(property.seo_title || property.title || 'Imovel selecionado')
                        const itemQualityLabel = getPropertyPrimaryQualityLabel(property)

                        return (
                            <Link
                                key={property.id}
                                href={propertyDetailsPath(property)}
                                className="plp-related-card plp-continuation-card"
                                onClick={() => handlePropertyClick(property, index)}
                            >
                                <div className="plp-related-media">
                                    <img src={image} alt={relatedTitle} loading={index === 0 ? 'eager' : 'lazy'} />
                                    <span className={`plp-card-ribbon plp-card-ribbon-${itemQualityLabel.tone}`}>
                                        {itemQualityLabel.label}
                                    </span>
                                </div>
                                <div className="plp-related-body">
                                    <h3>{relatedTitle}</h3>
                                    <p>{relatedLocation || 'Litoral catarinense'}</p>
                                    <strong>{formatMoney(property.price)}</strong>
                                    <div className="plp-related-meta">
                                        {itemArea > 0 && <span>{itemArea.toLocaleString('pt-BR')} m²</span>}
                                        {itemSuites > 0 && <span>{itemSuites} {statLabel(itemSuites, 'suíte', 'suítes')}</span>}
                                        {itemParking > 0 && <span>{itemParking} {statLabel(itemParking, 'vaga', 'vagas')}</span>}
                                    </div>
                                </div>
                            </Link>
                        )
                    })}
                </div>
            )}

            <style jsx>{`
                .plp-continuation-rail {
                    margin-top: 28px;
                }

                .plp-continuation-head {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    gap: 18px;
                    margin-bottom: 12px;
                }

                .plp-continuation-kicker,
                .plp-continuation-head a {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                }

                .plp-continuation-kicker {
                    margin-bottom: 0;
                    color: var(--plp-gold-dark);
                    font-size: 12px;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .plp-continuation-head h2 {
                    display: none;
                    margin: 0;
                    color: var(--plp-ink);
                    font-family: 'Noto Serif', Georgia, serif;
                    font-size: clamp(1.3rem, 2.5vw, 2rem);
                    line-height: 1.05;
                    letter-spacing: 0;
                }

                .plp-continuation-head a {
                    flex: 0 0 auto;
                    min-height: 38px;
                    padding: 0 13px;
                    border: 1px solid rgba(184, 148, 95, 0.26);
                    border-radius: 999px;
                    background: #fff;
                    color: var(--plp-gold-dark);
                    font: 850 12px/1 'Inter', sans-serif;
                    text-decoration: none;
                    box-shadow: 0 12px 28px rgba(36, 29, 20, 0.07);
                }

                .plp-continuation-card {
                    min-width: 0;
                }

                .plp-continuation-loading {
                    display: grid;
                    min-height: 150px;
                    place-items: center;
                    border: 1px dashed rgba(184, 148, 95, 0.22);
                    border-radius: var(--plp-radius);
                    color: var(--plp-muted);
                    font: 750 13px/1 'Inter', sans-serif;
                }

                @media (max-width: 760px) {
                    .plp-continuation-head {
                        align-items: flex-start;
                        display: grid;
                    }
                }
            `}</style>
        </section>
    )
}
