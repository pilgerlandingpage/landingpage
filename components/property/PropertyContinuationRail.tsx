'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import Link from 'next/link'
import { ArrowRight, Clock3, Heart } from 'lucide-react'
import PropertyCard from '@/components/marketplace/PropertyCard'
import { replaceItajaiWithPraiaBrava } from '@/lib/locations/display'
import { trackEvent } from '@/lib/tracking/client'

const FAVORITES_KEY = 'pilger_property_favorites'
const HISTORY_KEY = 'pilger_property_history'
const MAX_MEMORY_ITEMS = 8

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

function toCardProperty(property: MemoryProperty) {
    return {
        ...property,
        id: property.id,
        title: replaceItajaiWithPraiaBrava(property.seo_title || property.title || 'Imovel selecionado'),
        city: property.city || null,
        state: property.state || null,
        price: property.price || null,
        bedrooms: property.bedrooms || null,
        bathrooms: property.bathrooms || null,
        area_m2: property.area_m2 || null,
        featured_image: property.featured_image || null,
    }
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

    const handlePropertyClick = (event: MouseEvent<HTMLDivElement>, property: MemoryProperty, index: number) => {
        const target = event.target instanceof Element ? event.target : null
        if (target?.closest('button')) return

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
        <section className="plp-continuation-rail" aria-label="Imoveis salvos e vistos recentemente">
            <div className="plp-continuation-head">
                <div>
                    <span>
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
                <div className="plp-continuation-grid">
                    {visibleProperties.map((property, index) => (
                        <div
                            className="plp-continuation-card"
                            key={property.id}
                            onClick={(event) => handlePropertyClick(event, property, index)}
                        >
                            <PropertyCard
                                property={toCardProperty(property)}
                                imagePriority={index === 0}
                                variant="homeCompact"
                            />
                        </div>
                    ))}
                </div>
            )}

            <style jsx>{`
                .plp-continuation-rail {
                    margin: 36px 44px 0;
                    padding: 30px;
                    border: 1px solid rgba(184, 148, 95, 0.18);
                    border-radius: var(--plp-radius);
                    background:
                        linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,246,241,0.98) 100%);
                    color: var(--plp-ink);
                }

                .plp-continuation-head {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    gap: 18px;
                    margin-bottom: 18px;
                }

                .plp-continuation-head span,
                .plp-continuation-head a {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                }

                .plp-continuation-head span {
                    margin-bottom: 6px;
                    color: var(--plp-gold-dark);
                    font-size: 12px;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .plp-continuation-head h2 {
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

                .plp-continuation-grid {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 14px;
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

                @media (max-width: 1020px) {
                    .plp-continuation-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }
                }

                @media (max-width: 760px) {
                    .plp-continuation-rail {
                        margin: 24px 14px 0;
                        padding: 18px 14px;
                    }

                    .plp-continuation-head {
                        align-items: flex-start;
                        display: grid;
                    }

                    .plp-continuation-grid {
                        gap: 12px 10px;
                    }
                }
            `}</style>
        </section>
    )
}
