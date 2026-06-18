'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { BedDouble, Camera, Car, ChevronLeft, ChevronRight, MapPin, Maximize2, Ruler, X } from 'lucide-react'
import { displayLocationName, replaceItajaiWithPraiaBrava } from '@/lib/locations/display'
import { propertyDetailsPath } from '@/lib/properties/responsive-destination'
import { trackEvent } from '@/lib/tracking/client'

type PreviewProperty = {
    id: string
    title: string
    city?: string | null
    state?: string | null
    neighborhood?: string | null
    price?: number | null
    featured_image?: string | null
    images?: string[] | null
    bedrooms?: number | null
    bathrooms?: number | null
    suites?: number | null
    parking_spaces?: number | null
    area_m2?: number | null
    area_private_m2?: number | null
    property_type?: string | null
    description?: string | null
    source_status?: string | null
    exclusive?: boolean | null
    video_url?: string | null
}

type MapPropertyPreviewCardProps = {
    property: PreviewProperty
    onClose: () => void
    onPreviousProperty?: () => void
    onNextProperty?: () => void
    currentPosition?: number
    similarCount?: number
}

const FALLBACK_IMAGE = '/images/brava-concetto/20_CL_BC_LIVING_FINAL_01_ANG_02_EF_web.jpg'
const SWIPE_THRESHOLD = 36

function formatPrice(price?: number | null) {
    if (!price) return 'Sob consulta'

    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
    }).format(price)
}

function normalizeText(value: unknown) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
}

function galleryFor(property: PreviewProperty) {
    const images = [property.featured_image, ...(property.images || [])]
        .filter((item): item is string => Boolean(item))

    return Array.from(new Set(images.length ? images : [FALLBACK_IMAGE])).slice(0, 12)
}

function getBadges(property: PreviewProperty) {
    const text = normalizeText([
        property.title,
        property.description,
        property.property_type,
        property.neighborhood,
        property.source_status,
    ].filter(Boolean).join(' '))

    const badges: string[] = []
    if (property.exclusive) badges.push('Exclusivo')
    if (/frente.?mar|vista.?mar|beira.?mar|quadra.?mar/.test(text)) badges.push('Frente mar')
    if (/lancamento|construcao|na planta|pre lancamento/.test(text)) badges.push('Lancamento')
    if (/reducao|baixou|oportunidade|preco/.test(text) && /reducao|baixou|oportunidade/.test(text)) badges.push('Reducao')
    if (property.video_url) badges.push('Video')

    return badges.slice(0, 4)
}

function compactNumber(value?: number | null) {
    if (!value) return ''
    return value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

export default function MapPropertyPreviewCard({
    property,
    onClose,
    onPreviousProperty,
    onNextProperty,
    currentPosition,
    similarCount,
}: MapPropertyPreviewCardProps) {
    const [imageState, setImageState] = useState<{ propertyId: string; index: number }>({ propertyId: property.id, index: 0 })
    const touchStartX = useRef<number | null>(null)
    const longPressTimer = useRef<number | null>(null)
    const gallery = useMemo(() => galleryFor(property), [property])
    const badges = useMemo(() => getBadges(property), [property])
    const badgesKey = badges.join(', ')
    const detailsHref = propertyDetailsPath(property.id)
    const displayTitle = replaceItajaiWithPraiaBrava(property.title || 'Imovel selecionado')
    const displayCity = displayLocationName(property.city)
    const displayNeighborhood = replaceItajaiWithPraiaBrava(property.neighborhood)
    const location = [displayNeighborhood, displayCity, property.state].filter(Boolean).join(' - ')
    const area = property.area_private_m2 || property.area_m2 || null
    const roomStat = property.suites
        ? { key: 'suites', icon: BedDouble, label: `${property.suites} suites` }
        : property.bedrooms
            ? { key: 'beds', icon: BedDouble, label: `${property.bedrooms} dorm.` }
            : null
    const stats = [
        roomStat,
        property.parking_spaces ? { key: 'parking', icon: Car, label: `${property.parking_spaces} vagas` } : null,
        area ? { key: 'area', icon: Ruler, label: `${compactNumber(area)} m2` } : null,
    ].filter(Boolean) as Array<{ key: string; icon: typeof BedDouble; label: string }>
    const hasSimilarNavigation = Boolean(similarCount && similarCount > 1 && (onNextProperty || onPreviousProperty))
    const propertyPositionLabel = hasSimilarNavigation && currentPosition && similarCount
        ? `${currentPosition}/${similarCount}`
        : 'Semelhantes'

    const activeIndex = imageState.propertyId === property.id
        ? Math.min(imageState.index, Math.max(0, gallery.length - 1))
        : 0

    const clearLongPressTimer = useCallback(() => {
        if (longPressTimer.current === null) return
        window.clearTimeout(longPressTimer.current)
        longPressTimer.current = null
    }, [])

    const requestSimilarProperty = useCallback((source: string, direction: 1 | -1 = 1) => {
        const handler = direction === -1 ? onPreviousProperty : onNextProperty
        if (!handler) return

        clearLongPressTimer()
        handler()
        void trackEvent('property_map_preview_similar_requested', {
            property_id: property.id,
            title: displayTitle,
            source,
            direction,
            current_position: currentPosition || null,
            similar_count: similarCount || null,
        })
    }, [clearLongPressTimer, currentPosition, displayTitle, onNextProperty, onPreviousProperty, property.id, similarCount])

    useEffect(() => () => {
        clearLongPressTimer()
    }, [clearLongPressTimer])

    useEffect(() => {
        void trackEvent('property_map_preview_opened', {
            property_id: property.id,
            title: displayTitle,
            price: property.price || null,
            city: displayCity || null,
            neighborhood: displayNeighborhood || null,
            property_type: property.property_type || null,
            gallery_count: gallery.length,
            badges,
        })
    }, [badges, badgesKey, displayCity, displayNeighborhood, displayTitle, gallery.length, property.id, property.price, property.property_type])

    const goToImage = useCallback((direction: 1 | -1) => {
        if (direction === 1 && activeIndex >= gallery.length - 1 && onNextProperty) {
            requestSimilarProperty('gallery_end', 1)
            return
        }

        if (direction === -1 && activeIndex <= 0 && onPreviousProperty) {
            requestSimilarProperty('gallery_start', -1)
            return
        }

        const nextIndex = (activeIndex + direction + gallery.length) % gallery.length
        setImageState({
            propertyId: property.id,
            index: nextIndex,
        })
        void trackEvent('property_map_preview_photo_changed', {
            property_id: property.id,
            title: displayTitle,
            direction,
            image_index: nextIndex,
            gallery_count: gallery.length,
        })
    }, [activeIndex, displayTitle, gallery.length, onNextProperty, onPreviousProperty, property.id, requestSimilarProperty])

    const handleTouchEnd = useCallback((clientX: number) => {
        if (touchStartX.current === null) return

        const delta = clientX - touchStartX.current
        touchStartX.current = null

        if (Math.abs(delta) < SWIPE_THRESHOLD) return

        if (gallery.length < 2 && hasSimilarNavigation) {
            requestSimilarProperty(delta < 0 ? 'single_photo_swipe_next' : 'single_photo_swipe_previous', delta < 0 ? 1 : -1)
            return
        }

        goToImage(delta < 0 ? 1 : -1)
    }, [gallery.length, goToImage, hasSimilarNavigation, requestSimilarProperty])

    const handleBodyPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        if (!hasSimilarNavigation || !onNextProperty) return
        if ((event.target as HTMLElement).closest('a,button')) return

        clearLongPressTimer()
        longPressTimer.current = window.setTimeout(() => {
            requestSimilarProperty('body_long_press', 1)
        }, 560)
    }, [clearLongPressTimer, hasSimilarNavigation, onNextProperty, requestSimilarProperty])

    return (
        <article className="map-property-preview" aria-live="polite">
            <style>{`
                .map-property-preview {
                    position: absolute;
                    left: 50%;
                    bottom: 18px;
                    z-index: 1;
                    display: grid;
                    grid-template-columns: 158px minmax(0, 1fr);
                    width: min(520px, calc(100vw - 24px));
                    min-height: 172px;
                    overflow: hidden;
                    border: 1px solid rgba(255,255,255,0.28);
                    border-radius: 18px;
                    background: rgba(16,15,13,0.92);
                    color: #f7f1e7;
                    box-shadow: 0 24px 64px rgba(0,0,0,0.38);
                    transform: translateX(-50%);
                    backdrop-filter: blur(22px);
                    -webkit-backdrop-filter: blur(22px);
                }
                .map-preview-media {
                    position: relative;
                    min-height: 172px;
                    overflow: hidden;
                    background: #1f1b16;
                    touch-action: pan-y;
                }
                .map-preview-media img {
                    display: block;
                    width: 100%;
                    height: 100%;
                    min-height: 172px;
                    object-fit: cover;
                }
                .map-preview-media::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(180deg, rgba(0,0,0,0.18), transparent 38%, rgba(0,0,0,0.42));
                    pointer-events: none;
                }
                .map-preview-badges {
                    position: absolute;
                    top: 10px;
                    left: 10px;
                    right: 38px;
                    z-index: 2;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                }
                .map-preview-badge {
                    padding: 5px 7px;
                    border: 1px solid rgba(255,255,255,0.22);
                    border-radius: 999px;
                    background: rgba(12,12,12,0.72);
                    color: #f6dfaa;
                    font: 900 0.56rem/1 'Inter', sans-serif;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }
                .map-preview-photo-count {
                    position: absolute;
                    left: 10px;
                    bottom: 10px;
                    z-index: 2;
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    height: 24px;
                    padding: 0 8px;
                    border-radius: 999px;
                    background: rgba(10,10,10,0.72);
                    color: #fff;
                    font: 850 0.62rem/1 'Inter', sans-serif;
                }
                .map-preview-nav {
                    position: absolute;
                    top: 50%;
                    z-index: 3;
                    display: grid;
                    place-items: center;
                    width: 30px;
                    height: 30px;
                    border: 1px solid rgba(255,255,255,0.22);
                    border-radius: 50%;
                    background: rgba(12,12,12,0.72);
                    color: #fff;
                    cursor: pointer;
                    transform: translateY(-50%);
                }
                .map-preview-nav.prev { left: 8px; }
                .map-preview-nav.next { right: 8px; }
                .map-preview-close {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    z-index: 4;
                    display: grid;
                    place-items: center;
                    width: 30px;
                    height: 30px;
                    border: 1px solid rgba(255,255,255,0.22);
                    border-radius: 50%;
                    background: rgba(12,12,12,0.72);
                    color: #fff;
                    cursor: pointer;
                }
                .map-preview-body {
                    display: grid;
                    align-content: stretch;
                    gap: 10px;
                    padding: 14px 14px 13px;
                    min-width: 0;
                }
                .map-preview-location {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    min-width: 0;
                    color: rgba(247,241,231,0.7);
                    font: 800 0.62rem/1.3 'Inter', sans-serif;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }
                .map-preview-location span {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .map-preview-title {
                    display: -webkit-box;
                    margin: 0;
                    overflow: hidden;
                    color: #fff8ea;
                    font-family: 'Noto Serif', Georgia, serif;
                    font-size: 1.05rem;
                    font-weight: 800;
                    line-height: 1.08;
                    -webkit-box-orient: vertical;
                    -webkit-line-clamp: 2;
                }
                .map-preview-price {
                    color: #f0cf88;
                    font: 950 1.03rem/1 'Inter', sans-serif;
                }
                .map-preview-stats {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                }
                .map-preview-stat {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    min-height: 26px;
                    padding: 0 8px;
                    border: 1px solid rgba(255,255,255,0.09);
                    border-radius: 999px;
                    background: rgba(255,255,255,0.06);
                    color: rgba(247,241,231,0.82);
                    font: 800 0.66rem/1 'Inter', sans-serif;
                    white-space: nowrap;
                }
                .map-preview-actions {
                    display: grid;
                    grid-template-columns: 1fr auto;
                    gap: 8px;
                    align-items: center;
                    margin-top: auto;
                }
                .map-preview-details {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 7px;
                    min-height: 38px;
                    padding: 0 12px;
                    border-radius: 11px;
                    background: linear-gradient(135deg, #dfc18e, #b8945f);
                    color: #111;
                    font: 950 0.68rem/1 'Inter', sans-serif;
                    letter-spacing: 0.12em;
                    text-decoration: none;
                    text-transform: uppercase;
                }
                .map-preview-index {
                    color: rgba(247,241,231,0.58);
                    font: 850 0.66rem/1 'Inter', sans-serif;
                    white-space: nowrap;
                }
                .map-preview-progress {
                    display: grid;
                    justify-items: end;
                    gap: 5px;
                    min-width: 78px;
                }
                .map-preview-property-nav {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    min-height: 28px;
                    padding: 0 5px;
                    border: 1px solid rgba(255,255,255,0.12);
                    border-radius: 999px;
                    background: rgba(255,255,255,0.06);
                }
                .map-preview-property-nav button {
                    display: grid;
                    place-items: center;
                    width: 22px;
                    height: 22px;
                    border: 0;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.12);
                    color: #fff8ea;
                    cursor: pointer;
                }
                .map-preview-property-nav span {
                    color: rgba(255,248,234,0.78);
                    font: 900 0.58rem/1 'Inter', sans-serif;
                    white-space: nowrap;
                }
                @media (min-width: 1024px) {
                    .map-property-preview {
                        left: auto;
                        right: 46px;
                        bottom: 46px;
                        transform: none;
                        width: min(520px, calc(57vw - 92px));
                    }
                }
                @media (max-width: 649px) {
                    .map-property-preview {
                        bottom: 92px;
                        grid-template-columns: 1fr;
                        width: min(410px, calc(100vw - 18px));
                        min-height: 0;
                        max-height: calc(100vh - 188px);
                        border-radius: 16px;
                    }
                    .map-preview-media,
                    .map-preview-media img {
                        height: 190px;
                        min-height: 190px;
                    }
                    .map-preview-body {
                        gap: 8px;
                        padding: 13px 14px 14px;
                    }
                    .map-preview-title {
                        font-size: 0.86rem;
                    }
                    .map-preview-price {
                        font-size: 0.88rem;
                    }
                    .map-preview-stats {
                        gap: 4px;
                    }
                    .map-preview-stat {
                        min-height: 23px;
                        padding: 0 6px;
                        font-size: 0.58rem;
                    }
                    .map-preview-details {
                        min-height: 33px;
                        padding: 0 9px;
                        font-size: 0.58rem;
                        letter-spacing: 0.08em;
                    }
                    .map-preview-index,
                    .map-preview-location {
                        font-size: 0.55rem;
                    }
                    .map-preview-nav {
                        display: grid;
                    }
                    .map-preview-badges {
                        right: 34px;
                    }
                    .map-preview-badge {
                        padding: 4px 6px;
                        font-size: 0.5rem;
                    }
                }
                @media (max-width: 380px) {
                    .map-property-preview {
                        width: min(370px, calc(100vw - 14px));
                    }
                    .map-preview-stats .map-preview-stat:nth-child(n+3) {
                        display: none;
                    }
                }
            `}</style>

            <div
                className="map-preview-media"
                onTouchStart={event => {
                    touchStartX.current = event.touches[0]?.clientX ?? null
                }}
                onTouchEnd={event => {
                    handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)
                }}
            >
                <img src={gallery[activeIndex] || FALLBACK_IMAGE} alt={displayTitle} loading="lazy" />
                {badges.length > 0 && (
                    <div className="map-preview-badges" aria-label="Destaques do imovel">
                        {badges.map(badge => <span className="map-preview-badge" key={badge}>{badge}</span>)}
                    </div>
                )}
                <span className="map-preview-photo-count">
                    <Camera size={13} />
                    {gallery.length}
                </span>
                {gallery.length > 1 && (
                    <>
                        <button type="button" className="map-preview-nav prev" aria-label="Foto anterior" onClick={() => goToImage(-1)}>
                            <ChevronLeft size={16} />
                        </button>
                        <button type="button" className="map-preview-nav next" aria-label="Proxima foto" onClick={() => goToImage(1)}>
                            <ChevronRight size={16} />
                        </button>
                    </>
                )}
            </div>

            <button type="button" className="map-preview-close" aria-label="Fechar preview do imovel" onClick={onClose}>
                <X size={16} />
            </button>

            <div
                className="map-preview-body"
                onPointerDown={handleBodyPointerDown}
                onPointerUp={clearLongPressTimer}
                onPointerLeave={clearLongPressTimer}
                onPointerCancel={clearLongPressTimer}
            >
                <div className="map-preview-location">
                    <MapPin size={13} />
                    <span>{location || 'Litoral catarinense'}</span>
                </div>
                <h2 className="map-preview-title">{displayTitle}</h2>
                <div className="map-preview-price">{formatPrice(property.price)}</div>
                {stats.length > 0 && (
                    <div className="map-preview-stats" aria-label="Dados principais">
                        {stats.slice(0, 4).map(stat => {
                            const Icon = stat.icon
                            return (
                                <span className="map-preview-stat" key={stat.key}>
                                    <Icon size={13} />
                                    {stat.label}
                                </span>
                            )
                        })}
                    </div>
                )}
                <div className="map-preview-actions">
                    <Link
                        href={detailsHref}
                        className="map-preview-details"
                        onClick={() => {
                            void trackEvent('property_map_preview_details_clicked', {
                                property_id: property.id,
                                title: displayTitle,
                                price: property.price || null,
                                destination: detailsHref,
                            })
                        }}
                    >
                        Ver detalhes
                        <Maximize2 size={14} />
                    </Link>
                    <div className="map-preview-progress">
                        {hasSimilarNavigation && (
                            <div className="map-preview-property-nav" aria-label="Navegar por imoveis semelhantes">
                                <button type="button" aria-label="Imovel anterior" onClick={() => requestSimilarProperty('property_nav_previous', -1)}>
                                    <ChevronLeft size={13} />
                                </button>
                                <span>{propertyPositionLabel}</span>
                                <button type="button" aria-label="Proximo imovel" onClick={() => requestSimilarProperty('property_nav_next', 1)}>
                                    <ChevronRight size={13} />
                                </button>
                            </div>
                        )}
                        <span className="map-preview-index">
                            {activeIndex + 1}/{gallery.length} fotos
                        </span>
                    </div>
                </div>
            </div>
        </article>
    )
}
