'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent, ReactNode, TouchEvent, WheelEvent } from 'react'
import { Bath, BedDouble, Camera, Car, ChevronLeft, ChevronRight, Eye, Heart, MapPin, Ruler } from 'lucide-react'
import { displayLocationName, normalizeLocationName, replaceItajaiWithPraiaBrava } from '@/lib/locations/display'
import { openPropertyDestinationOnDesktopClick, propertyDetailsPath } from '@/lib/properties/responsive-destination'
import { getPropertyIntelligenceLabels, getPropertyPrimaryQualityLabel } from '@/lib/properties/intelligence'
import { trackEvent } from '@/lib/tracking/client'

interface PropertyCardProps {
    property: {
        id: string
        source_slug?: string | null
        slug?: string | null
        title: string
        city: string | null
        state: string | null
        price: number | null
        bedrooms: number | null
        bathrooms: number | null
        area_m2: number | null
        area_private_m2?: number | null
        featured_image: string | null
        images?: string[] | null
        property_type?: string | null
        neighborhood?: string | null
        source_status?: string | null
        exclusive?: boolean | null
        description?: string | null
        parking_spaces?: number | null
        suites?: number | null
        amenities?: string[] | null
        status?: string | null
        created_at?: string | null
        updated_at?: string | null
        view_count?: number | null
    }
    landingPageSlug?: string
    imagePriority?: boolean
    variant?: 'default' | 'homeCompact' | 'searchCompact'
}

const FAVORITES_KEY = 'pilger_property_favorites'
const FALLBACK_IMAGE = '/images/brava-concetto/20_CL_BC_LIVING_FINAL_01_ANG_02_EF_web.jpg'
const PHOTO_SWIPE_INTENT_THRESHOLD = 8
const PHOTO_SWIPE_THRESHOLD = 34

function readFavoriteIds() {
    if (typeof window === 'undefined') return []

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

function formatPrice(price: number | null) {
    if (!price) return 'Sob Consulta'

    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
    }).format(price)
}

function formatCompactNumber(value: number) {
    return value.toLocaleString('pt-BR', {
        maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
    })
}

const BOLD_KEYWORDS = [
    'Casa em Condomínio', 'Casa em condominio', 'Apartamento Garden', 'Apartamento Duplex',
    'Cobertura Duplex', 'Cobertura', 'Apartamento', 'Terreno', 'Duplex',
    'Casa', 'Flat', 'Studio', 'Estúdio', 'Sala Comercial', 'Loja', 'Penthouse', 'Kitnet',
]

function boldifyTitle(title: string): ReactNode {
    for (const kw of BOLD_KEYWORDS) {
        const idx = title.toLowerCase().indexOf(kw.toLowerCase())
        if (idx !== -1) {
            return (
                <>
                    {title.slice(0, idx)}
                    <strong>{title.slice(idx, idx + kw.length)}</strong>
                    {title.slice(idx + kw.length)}
                </>
            )
        }
    }
    return title
}

type HomeFilterBadge = {
    key: string
    label: string
    tone: 'gold' | 'dark' | 'green' | 'blue'
    patterns: RegExp[]
}

const HOME_FILTER_BADGES: HomeFilterBadge[] = [
    {
        key: 'frente-mar',
        label: 'Frente mar',
        tone: 'blue',
        patterns: [/frente\s*(ao\s*)?(para\s*o\s*)?mar/, /beira\s*mar/, /pe\s*na\s*areia/],
    },
    {
        key: 'vista-mar',
        label: 'Vista mar',
        tone: 'blue',
        patterns: [/vista\s*(para\s*o\s*)?mar/, /vista\s*oceanica/, /vista\s*panoramica/],
    },
    {
        key: 'quadra-mar',
        label: 'Quadra mar',
        tone: 'blue',
        patterns: [/quadra\s*(do\s*)?mar/, /uma\s*quadra\s*do\s*mar/],
    },
    {
        key: 'lancamento',
        label: 'Lancamento',
        tone: 'gold',
        patterns: [/lancamento/, /pre\s*lancamento/],
    },
    {
        key: 'em-construcao',
        label: 'Em construcao',
        tone: 'gold',
        patterns: [/em\s*construcao/, /construcao/, /na\s*planta/, /entrega\s*prevista/],
    },
    {
        key: 'pronto',
        label: 'Pronto',
        tone: 'green',
        patterns: [/pronto/, /pronta/, /pronto\s*para\s*morar/],
    },
    {
        key: 'mobiliado',
        label: 'Mobiliado',
        tone: 'green',
        patterns: [/mobiliad/, /porteira\s*fechada/, /com\s*moveis/],
    },
]

function normalizeHomeFilterText(value: unknown) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
}

function getHomeFilterBadge(property: PropertyCardProps['property']) {
    const amenities = Array.isArray(property.amenities) ? property.amenities.join(' ') : ''
    const text = [
        property.title,
        property.description,
        property.property_type,
        property.source_status,
        property.neighborhood,
        property.city,
        amenities,
    ].map(normalizeHomeFilterText).join(' ')

    return HOME_FILTER_BADGES.find(badge => badge.patterns.some(pattern => pattern.test(text))) || null
}

export default function PropertyCard({ property, landingPageSlug, imagePriority = false, variant = 'default' }: PropertyCardProps) {
    const isHomeCompact = variant === 'homeCompact'
    const isSearchCompact = variant === 'searchCompact'
    const isCompact = isHomeCompact || isSearchCompact
    const showFavoriteToggle = !isCompact
    const [isFavorite, setIsFavorite] = useState(false)
    const [activeImageState, setActiveImageState] = useState({ propertyId: property.id, imageCount: 0, index: 0 })
    const touchStartXRef = useRef<number | null>(null)
    const touchStartYRef = useRef<number | null>(null)
    const touchLastXRef = useRef<number | null>(null)
    const touchLastYRef = useRef<number | null>(null)
    const imageSwipeIntentRef = useRef<'horizontal' | 'vertical' | null>(null)
    const imageLinkRef = useRef<HTMLAnchorElement | null>(null)
    const suppressImageClickRef = useRef(false)
    const formattedPrice = property.price ? formatPrice(property.price) : isCompact ? 'Consulte-nos' : formatPrice(property.price)
    const detailsHref = propertyDetailsPath(property)
    const href = isCompact ? detailsHref : landingPageSlug ? `/${landingPageSlug}` : detailsHref
    const galleryImages = useMemo(() => {
        const images = [property.featured_image, ...(property.images || [])]
            .map(item => typeof item === 'string' ? item.trim() : '')
            .filter(Boolean)

        return Array.from(new Set(images))
    }, [property.featured_image, property.images])
    const displayGalleryImages = galleryImages.length ? galleryImages : [FALLBACK_IMAGE]
    const imageCount = galleryImages.length
    const canBrowseImages = imageCount > 1
    const activeImageIndex = activeImageState.propertyId === property.id && activeImageState.imageCount === imageCount
        ? activeImageState.index
        : 0
    const safeActiveImageIndex = Math.min(activeImageIndex, Math.max(displayGalleryImages.length - 1, 0))
    const imageSrc = displayGalleryImages[safeActiveImageIndex] || FALLBACK_IMAGE
    const rawViewCount = Number(property.view_count)
    const compactViewCount = Number.isFinite(rawViewCount) ? Math.max(0, Math.trunc(rawViewCount)) : null
    const hasCompactViewCount = isCompact && compactViewCount !== null
    const compactViewLabel = compactViewCount !== null ? formatCompactNumber(compactViewCount) : ''
    const displayTitle = replaceItajaiWithPraiaBrava(property.title)
    const displayCity = displayLocationName(property.city)
    const displayNeighborhood = replaceItajaiWithPraiaBrava(property.neighborhood)
    const locationParts = normalizeLocationName(displayNeighborhood) === normalizeLocationName(displayCity)
        ? [displayCity]
        : [displayNeighborhood, displayCity]
    const location = locationParts.filter(Boolean).join(' - ')
    const locationLabel = `${location || 'Balneário Camboriú'}${property.state ? ` / ${property.state}` : ''}`
    const amenities = Array.isArray(property.amenities) ? property.amenities.filter(Boolean) : []
    const visibleAmenities = amenities.slice(0, 3)
    const primaryQualityLabel = getPropertyPrimaryQualityLabel(property)
    const homeFilterBadge = isCompact ? getHomeFilterBadge(property) : null
    const intelligenceLabels = isCompact
        ? []
        : getPropertyIntelligenceLabels(property, {
            includeFrontSea: false,
            max: 3,
        })
    const cardTitle = displayTitle
    /*
        ? [property.property_type || 'Imóvel', compactPlace].filter(Boolean).join(' · ')
        : displayTitle
    const compactMeta = [
        property.suites ? `${property.suites} suítes` : property.bedrooms ? `${property.bedrooms} dorm.` : '',
        property.area_m2 ? `${property.area_m2.toLocaleString('pt-BR')}m²` : '',
        property.parking_spaces ? `${property.parking_spaces} vagas` : '',
    ].filter(Boolean)
    */
    const compactLocationParts = normalizeLocationName(displayNeighborhood) === normalizeLocationName(displayCity)
        ? [displayCity]
        : [displayCity, displayNeighborhood]
    const compactLocation = compactLocationParts.filter(Boolean).join(' - ').toUpperCase()
    const compactArea = Number(property.area_private_m2 || property.area_m2 || 0)
    const compactPrivateArea = Number(property.area_private_m2 || 0)
    const compactTotalArea = Number(property.area_m2 || 0)
    const shouldShowTotalArea = compactPrivateArea > 0 && compactTotalArea > 0 && compactTotalArea !== compactPrivateArea
    const compactFeatureItems = [
        property.bedrooms ? { key: 'bedrooms', icon: <BedDouble size={14} aria-hidden="true" />, label: `${property.bedrooms}` } : null,
        property.bathrooms ? { key: 'bathrooms', icon: <Bath size={14} aria-hidden="true" />, label: `${property.bathrooms}` } : null,
        property.parking_spaces ? { key: 'parking', icon: <Car size={14} aria-hidden="true" />, label: `${property.parking_spaces}` } : null,
        compactArea ? { key: 'area', icon: <Ruler size={14} aria-hidden="true" />, label: `${formatCompactNumber(compactArea)} m²` } : null,
        shouldShowTotalArea ? { key: 'total-area', icon: <Ruler size={14} aria-hidden="true" />, label: `${formatCompactNumber(compactTotalArea)} m\u00b2` } : null,
    ].filter(Boolean) as { key: string; icon: ReactNode; label: string }[]
    const handlePropertyClick = (event: MouseEvent<HTMLAnchorElement>) => {
        if (isHomeCompact) {
            void trackEvent('home_property_details_clicked', {
                property_id: property.id,
                title: displayTitle,
                destination: detailsHref,
                source: 'home_property_card',
            })
        }

        openPropertyDestinationOnDesktopClick(event, href)
    }

    const changeGalleryImage = (direction: 1 | -1, interaction: 'button' | 'swipe' | 'wheel') => {
        if (!canBrowseImages) return

        const nextIndex = (safeActiveImageIndex + direction + imageCount) % imageCount
        setActiveImageState({ propertyId: property.id, imageCount, index: nextIndex })

        void trackEvent('property_thumbnail_photo_changed', {
            property_id: property.id,
            title: displayTitle,
            direction,
            image_index: nextIndex + 1,
            gallery_count: imageCount,
            interaction,
            source: isCompact ? 'compact_property_card' : 'property_card',
        })
    }

    const handleImageLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
        if (suppressImageClickRef.current) {
            event.preventDefault()
            event.stopPropagation()
            suppressImageClickRef.current = false
            return
        }

        handlePropertyClick(event)
    }

    const handleImageTouchStart = (event: TouchEvent<HTMLAnchorElement>) => {
        if (!canBrowseImages) return
        const touch = event.touches[0]
        touchStartXRef.current = touch?.clientX ?? null
        touchStartYRef.current = touch?.clientY ?? null
        touchLastXRef.current = touch?.clientX ?? null
        touchLastYRef.current = touch?.clientY ?? null
        imageSwipeIntentRef.current = null
    }

    const handleImageTouchMove = (event: TouchEvent<HTMLAnchorElement>) => {
        if (!canBrowseImages || touchStartXRef.current === null || touchStartYRef.current === null) return

        const touch = event.touches[0]
        const currentX = touch?.clientX ?? touchLastXRef.current ?? touchStartXRef.current
        const currentY = touch?.clientY ?? touchLastYRef.current ?? touchStartYRef.current
        touchLastXRef.current = currentX
        touchLastYRef.current = currentY

        const deltaX = currentX - touchStartXRef.current
        const deltaY = currentY - touchStartYRef.current
        const absX = Math.abs(deltaX)
        const absY = Math.abs(deltaY)

        if (!imageSwipeIntentRef.current && Math.max(absX, absY) >= PHOTO_SWIPE_INTENT_THRESHOLD) {
            imageSwipeIntentRef.current = absX > absY * 1.15 ? 'horizontal' : 'vertical'
        }

        if (imageSwipeIntentRef.current === 'horizontal') {
            event.preventDefault()
            event.stopPropagation()
        }
    }

    const handleImageTouchEnd = (event: TouchEvent<HTMLAnchorElement>) => {
        if (!canBrowseImages || touchStartXRef.current === null || touchStartYRef.current === null) return

        const endX = event.changedTouches[0]?.clientX ?? touchLastXRef.current ?? touchStartXRef.current
        const endY = event.changedTouches[0]?.clientY ?? touchLastYRef.current ?? touchStartYRef.current
        const deltaX = endX - touchStartXRef.current
        const deltaY = endY - touchStartYRef.current
        const isHorizontalSwipe = imageSwipeIntentRef.current === 'horizontal' || Math.abs(deltaX) > Math.abs(deltaY) * 1.15
        touchStartXRef.current = null
        touchStartYRef.current = null
        touchLastXRef.current = null
        touchLastYRef.current = null
        imageSwipeIntentRef.current = null

        if (!isHorizontalSwipe || Math.abs(deltaX) < PHOTO_SWIPE_THRESHOLD) return

        event.preventDefault()
        event.stopPropagation()
        suppressImageClickRef.current = true
        window.setTimeout(() => {
            suppressImageClickRef.current = false
        }, 160)

        changeGalleryImage(deltaX < 0 ? 1 : -1, 'swipe')
    }

    const handleImageTouchCancel = () => {
        touchStartXRef.current = null
        touchStartYRef.current = null
        touchLastXRef.current = null
        touchLastYRef.current = null
        imageSwipeIntentRef.current = null
    }

    const handleImageWheel = (event: WheelEvent<HTMLAnchorElement>) => {
        if (!canBrowseImages) return

        const isHorizontalGesture = Math.abs(event.deltaX) > Math.abs(event.deltaY)
        if (!isHorizontalGesture && !event.shiftKey) return

        const delta = isHorizontalGesture ? event.deltaX : event.deltaY
        if (Math.abs(delta) < 2) return

        event.preventDefault()
        changeGalleryImage(delta > 0 ? 1 : -1, 'wheel')
    }

    useEffect(() => {
        const node = imageLinkRef.current
        if (!node || !canBrowseImages) return

        const handleNativeTouchMove = (event: globalThis.TouchEvent) => {
            if (touchStartXRef.current === null || touchStartYRef.current === null) return

            const touch = event.touches[0]
            const currentX = touch?.clientX ?? touchLastXRef.current ?? touchStartXRef.current
            const currentY = touch?.clientY ?? touchLastYRef.current ?? touchStartYRef.current
            touchLastXRef.current = currentX
            touchLastYRef.current = currentY

            const deltaX = currentX - touchStartXRef.current
            const deltaY = currentY - touchStartYRef.current
            const absX = Math.abs(deltaX)
            const absY = Math.abs(deltaY)

            if (!imageSwipeIntentRef.current && Math.max(absX, absY) >= PHOTO_SWIPE_INTENT_THRESHOLD) {
                imageSwipeIntentRef.current = absX > absY * 1.15 ? 'horizontal' : 'vertical'
            }

            if (imageSwipeIntentRef.current === 'horizontal') {
                event.preventDefault()
                event.stopPropagation()
            }
        }

        node.addEventListener('touchmove', handleNativeTouchMove, { passive: false })

        return () => {
            node.removeEventListener('touchmove', handleNativeTouchMove)
        }
    }, [canBrowseImages])

    useEffect(() => {
        if (!showFavoriteToggle) return

        const syncFavoriteState = () => {
            setIsFavorite(readFavoriteIds().includes(property.id))
        }

        syncFavoriteState()
        window.addEventListener('storage', syncFavoriteState)
        window.addEventListener('pilger:favorites-changed', syncFavoriteState)

        return () => {
            window.removeEventListener('storage', syncFavoriteState)
            window.removeEventListener('pilger:favorites-changed', syncFavoriteState)
        }
    }, [property.id, showFavoriteToggle])

    useEffect(() => {
        touchStartXRef.current = null
        touchStartYRef.current = null
        touchLastXRef.current = null
        touchLastYRef.current = null
        imageSwipeIntentRef.current = null
        suppressImageClickRef.current = false
    }, [property.id, imageCount])

    const handleFavoriteToggle = (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault()
        event.stopPropagation()

        const current = readFavoriteIds()
        const next = current.includes(property.id)
            ? current.filter(id => id !== property.id)
            : [property.id, ...current.filter(id => id !== property.id)]

        writeFavoriteIds(next)
        setIsFavorite(next.includes(property.id))

        void trackEvent(current.includes(property.id) ? 'property_unfavorited' : 'property_favorited', {
            property_id: property.id,
            title: displayTitle,
            source: isCompact ? 'search_card' : 'property_card',
            favorite_count: next.length,
        })
    }

    return (
        <div className={`property-card ${isCompact ? 'property-card-compact' : ''} ${isSearchCompact ? 'property-card-search-compact' : ''}`}>
            <Link
                href={href}
                className="card-shell-hit"
                aria-label={`Abrir detalhes de ${displayTitle}`}
                tabIndex={-1}
                prefetch={false}
                onClick={handlePropertyClick}
            />
            <div className="card-image-container">
                <Link
                    ref={imageLinkRef}
                    href={href}
                    className={`image-link${canBrowseImages ? ' image-link-gallery' : ''}`}
                    tabIndex={-1}
                    prefetch={false}
                    onClick={handleImageLinkClick}
                    onTouchStart={handleImageTouchStart}
                    onTouchMove={handleImageTouchMove}
                    onTouchEnd={handleImageTouchEnd}
                    onTouchCancel={handleImageTouchCancel}
                    onWheel={handleImageWheel}
                    style={{ display: 'block', height: '100%', overflow: 'hidden', position: 'relative', width: '100%' }}
                >
                    {isCompact ? (
                        <>
                            <Image
                                src={imageSrc}
                                alt={displayTitle}
                                className="property-image"
                                fill
                                sizes="(max-width: 649px) 50vw, 280px"
                                priority={imagePriority}
                                loading={imagePriority ? undefined : 'lazy'}
                                decoding="async"
                            />
                            {(imageCount > 0 || hasCompactViewCount) && (
                                <span className="compact-media-badges">
                                    {imageCount > 0 && (
                                        <span className="compact-photo-count" aria-label={`${imageCount} fotos`}>
                                            <Camera size={13} aria-hidden="true" />
                                            {imageCount}
                                        </span>
                                    )}
                                    {hasCompactViewCount && (
                                        <span className="compact-view-count" aria-label={`${compactViewCount} views`}>
                                            <Eye size={13} aria-hidden="true" />
                                            {compactViewLabel}
                                        </span>
                                    )}
                                </span>
                            )}
                            {homeFilterBadge && (
                                <span className={`property-quality-badge property-quality-badge-${homeFilterBadge.tone}`}>
                                    {homeFilterBadge.label}
                                </span>
                            )}
                        </>
                    ) : (
                        <>
                            <Image
                                src={imageSrc}
                                alt={displayTitle}
                                className="property-image"
                                fill
                                sizes="(max-width: 649px) 50vw, 420px"
                                priority={imagePriority}
                                loading={imagePriority ? undefined : 'lazy'}
                                decoding="async"
                            />
                            <span className={`property-quality-badge property-quality-badge-${primaryQualityLabel.tone}`}>
                                {primaryQualityLabel.label}
                            </span>
                        </>
                    )}
                </Link>
                {canBrowseImages && (
                    <>
                        <button
                            type="button"
                            className="thumbnail-gallery-nav thumbnail-gallery-nav-prev"
                            aria-label="Foto anterior"
                            onClick={event => {
                                event.preventDefault()
                                event.stopPropagation()
                                changeGalleryImage(-1, 'button')
                            }}
                        >
                            <ChevronLeft size={16} aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            className="thumbnail-gallery-nav thumbnail-gallery-nav-next"
                            aria-label="Proxima foto"
                            onClick={event => {
                                event.preventDefault()
                                event.stopPropagation()
                                changeGalleryImage(1, 'button')
                            }}
                        >
                            <ChevronRight size={16} aria-hidden="true" />
                        </button>
                        <div className="thumbnail-gallery-dots" aria-hidden="true">
                            {Array.from({ length: Math.min(imageCount, 6) }).map((_, dotIndex) => (
                                <span
                                    className={`thumbnail-gallery-dot${dotIndex === Math.min(safeActiveImageIndex, 5) ? ' thumbnail-gallery-dot-active' : ''}`}
                                    key={`${property.id}-thumbnail-dot-${dotIndex}`}
                                />
                            ))}
                        </div>
                    </>
                )}
                {showFavoriteToggle && (
                    <button
                        type="button"
                        className={`favorite-toggle ${isFavorite ? 'favorite-toggle-active' : ''}`}
                        aria-label={isFavorite ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
                        aria-pressed={isFavorite}
                        onClick={handleFavoriteToggle}
                    >
                        <Heart size={19} />
                    </button>
                )}

            </div>

            <Link href={href} className="card-content-link" prefetch={false} onClick={handlePropertyClick}>
                <div className="property-head">
                    <div className="property-heading-copy">
                        <div className="property-title">{isCompact ? displayTitle : boldifyTitle(cardTitle)}</div>
                        <div className={`property-location ${isCompact ? 'compact-location-row' : ''}`}>
                            {isCompact && <MapPin size={13} aria-hidden="true" />}
                            <span>{isCompact ? compactLocation || locationLabel : locationLabel}</span>
                        </div>
                    </div>
                </div>

                {!isCompact && <div className="property-price">{formattedPrice}</div>}

                {intelligenceLabels.length > 0 && (
                    <div className="property-intelligence-row" aria-label="Sinais de curadoria">
                        {intelligenceLabels.map(label => (
                            <span className={`property-intelligence-chip property-intelligence-chip-${label.tone}`} key={label.key}>
                                {label.label}
                            </span>
                        ))}
                    </div>
                )}

                <div className="property-meta">
                    {isCompact ? (
                        compactFeatureItems.map(item => (
                            <span className="compact-feature-item" key={item.key}>
                                {item.icon}
                                <span>{item.label}</span>
                            </span>
                        ))
                    ) : (
                        <>
                            {property.property_type && <span>{property.property_type}</span>}
                    {property.bedrooms && <span>{property.bedrooms} dormitórios</span>}
                    {property.area_m2 && <span>{property.area_m2.toLocaleString('pt-BR')}m²</span>}
                            {imageCount > 0 && <span>{imageCount} fotos</span>}
                        </>
                    )}
                </div>

                {isCompact && <div className="property-price">{formattedPrice}</div>}

                {!isCompact && visibleAmenities.length > 0 && (
                    <div className="property-tags">
                        {visibleAmenities.map((amenity, index) => <span key={`${amenity}-${index}`}>{amenity}</span>)}
                        {amenities.length > 3 && <span>+{amenities.length - 3}</span>}
                    </div>
                )}
            </Link>

            <style jsx>{`
                .property-card {
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                    height: 100%;
                    min-width: 0;
                    overflow: hidden;
                    padding: 12px;
                    border: 1px solid rgba(31,27,21,0.11);
                    border-radius: 10px;
                    background: #fff;
                    box-shadow: none;
                    cursor: pointer;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    transition: transform 0.28s ease, box-shadow 0.28s ease, border-color 0.28s ease;
                }
                .property-card :global(.card-shell-hit) {
                    position: absolute;
                    inset: 0;
                    z-index: 0;
                    border-radius: inherit;
                    color: inherit;
                    text-decoration: none;
                }
                .property-card:hover {
                    transform: translateY(-5px);
                    border-color: rgba(201,169,110,0.3);
                    box-shadow: 0 10px 26px rgba(31,27,21,0.09);
                }
                .card-image-container {
                    position: relative;
                    z-index: 1;
                    width: 100%;
                    height: 190px;
                    overflow: hidden;
                    border-radius: 6px;
                    background: #ddd7ce;
                }
                .image-link {
                    display: block;
                    position: relative;
                    width: 100%;
                    height: 100%;
                    border: none;
                    outline: none;
                    overflow: hidden;
                }
                .image-link-gallery {
                    touch-action: pan-y;
                }
                .property-image {
                    display: block;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 0.65s ease;
                }
                .property-image-bg {
                    background-position: center;
                    background-repeat: no-repeat;
                    background-size: cover;
                }
                .property-card:hover .property-image {
                    transform: scale(1.045);
                }
                .card-content-link {
                    position: relative;
                    z-index: 1;
                    display: flex;
                    flex: 1;
                    flex-direction: column;
                    gap: 0;
                    padding: 13px 0 0;
                    color: inherit !important;
                    text-decoration: none !important;
                }
                .card-content-link:hover,
                .card-content-link:visited,
                .card-content-link:active,
                .card-content-link:focus {
                    color: inherit !important;
                    text-decoration: none !important;
                }
                .property-card :global(.card-content-link) {
                    position: relative;
                    z-index: 1;
                    display: flex;
                    flex: 1;
                    flex-direction: column;
                    gap: 0;
                    padding: 13px 0 0;
                    color: inherit !important;
                    text-decoration: none !important;
                }
                .property-card :global(.card-content-link:hover),
                .property-card :global(.card-content-link:visited),
                .property-card :global(.card-content-link:active),
                .property-card :global(.card-content-link:focus) {
                    color: inherit !important;
                    text-decoration: none !important;
                }
                .property-head {
                    align-items: flex-start;
                    display: flex;
                }
                .property-heading-copy {
                    min-width: 0;
                }
                .property-title {
                    color: #1f1b16;
                    font-family: inherit;
                    font-size: 1rem;
                    font-weight: 700;
                    line-height: 1.25;
                    margin-bottom: 4px;
                }
                .property-location {
                    color: #4c443a;
                    font-size: 0.84rem;
                    line-height: 1.3;
                }
                .property-price {
                    color: #b8945f;
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: 1.18rem;
                    font-weight: 700;
                    line-height: 1.1;
                    margin-top: 14px;
                }
                .property-meta {
                    color: #8a7f70;
                    display: flex;
                    flex-wrap: wrap;
                    font-size: 0.82rem;
                    gap: 8px 12px;
                    line-height: 1.35;
                    margin-top: 10px;
                }
                .property-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                    margin-top: 12px;
                }
                .property-tags span {
                    background: rgba(184,148,95,0.08);
                    border: 1px solid rgba(184,148,95,0.18);
                    border-radius: 999px;
                    color: #a78042;
                    font: 700 0.68rem/1 'Inter', sans-serif;
                    padding: 5px 8px;
                }
                .property-card-compact {
                    padding: 0;
                    border: 0;
                    border-radius: 0;
                    background: transparent;
                    box-shadow: none !important;
                }
                .property-card-compact:hover {
                    transform: none;
                    border-color: transparent;
                    box-shadow: none;
                }
                .property-card-compact .card-image-container {
                    height: auto;
                    aspect-ratio: 1.45 / 1;
                    border-radius: 18px;
                    background: #eee8df;
                }
                .property-card-compact .card-content-link {
                    padding: 9px 2px 0;
                }
                .property-card-compact .property-title {
                    display: -webkit-box;
                    overflow: hidden;
                    font-size: 0.86rem;
                    font-weight: 760;
                    line-height: 1.16;
                    margin-bottom: 3px;
                    -webkit-box-orient: vertical;
                    -webkit-line-clamp: 2;
                }
                .property-card-compact .property-location {
                    display: -webkit-box;
                    overflow: hidden;
                    color: #5f5548;
                    font-size: 0.74rem;
                    line-height: 1.24;
                    -webkit-box-orient: vertical;
                    -webkit-line-clamp: 1;
                }
                .property-card-compact .property-price {
                    color: #1f1b16;
                    font-family: inherit;
                    font-size: 0.82rem;
                    font-weight: 700;
                    line-height: 1.2;
                    margin-top: 4px;
                }
                .property-card-compact .property-meta {
                    display: flex;
                    flex-wrap: nowrap;
                    gap: 4px;
                    overflow: hidden;
                    color: #6f665c;
                    font-size: 0.72rem;
                    line-height: 1.24;
                    margin-top: 2px;
                    white-space: nowrap;
                }
                .property-card-compact .property-meta span:not(:last-child)::after {
                    content: '·';
                    margin-left: 4px;
                }
                .property-card-compact .property-heading-copy {
                    width: 100%;
                }
                .property-card-compact .compact-location-row {
                    align-items: center;
                    color: #5a5045;
                    display: flex;
                    gap: 4px;
                    font-size: 0.67rem;
                    font-weight: 560;
                    letter-spacing: 0.025em;
                    line-height: 1.12;
                    margin-bottom: 1px;
                    text-transform: uppercase;
                }
                .property-card-compact .compact-location-row svg {
                    color: #7c6a52;
                    flex: 0 0 auto;
                    stroke-width: 2.3;
                }
                .property-card-compact .property-title {
                    font-size: 0.89rem;
                    font-weight: 560;
                    line-height: 1.18;
                }
                .property-card-compact .property-price {
                    font-size: 0.86rem;
                    font-weight: 620;
                    margin-top: 2px;
                }
                .property-card-compact .property-meta {
                    border-bottom: 0;
                    color: #6a6157;
                    flex-wrap: wrap;
                    gap: 6px 9px;
                    font-size: 0.73rem;
                    line-height: 1;
                    margin-top: 6px;
                    padding-bottom: 0;
                }
                .property-card-compact .property-meta .compact-feature-item {
                    align-items: center;
                    display: inline-flex;
                    gap: 3px;
                }
                .property-card-compact .property-meta .compact-feature-item:not(:last-child)::after {
                    content: none;
                    margin-left: 0;
                }
                .property-card-compact .property-meta .compact-feature-item svg {
                    color: #7c6a52;
                    flex: 0 0 auto;
                    stroke-width: 2.25;
                }
                .property-card-compact .card-content-link {
                    min-height: 112px;
                    padding: 12px 2px 0;
                }
                .property-card-compact :global(.card-content-link) {
                    min-height: 112px;
                    padding: 12px 2px 0;
                }
                .property-card-compact .property-head {
                    order: 1;
                }
                .property-card-compact .property-heading-copy {
                    display: flex;
                    flex-direction: column;
                    min-width: 0;
                }
                .property-card-compact .compact-location-row {
                    order: 1;
                    color: #2e2a25;
                    font-size: 0.7rem;
                    font-weight: 820;
                    letter-spacing: 0;
                    line-height: 1.12;
                    margin-bottom: 4px;
                }
                .property-card-compact .compact-location-row span {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .property-card-compact .property-title {
                    order: 2;
                    color: #4f463b;
                    font-size: 0.76rem;
                    font-weight: 430;
                    line-height: 1.28;
                    margin-bottom: 0;
                    -webkit-line-clamp: 1;
                }
                .property-card-compact .property-meta {
                    order: 3;
                    align-items: center;
                    color: #574f45;
                    flex-wrap: nowrap;
                    gap: 6px;
                    line-height: 1;
                    margin-top: 7px;
                    overflow: hidden;
                    padding-bottom: 0;
                    white-space: nowrap;
                }
                .property-card-compact .property-meta .compact-feature-item {
                    flex: 0 1 auto;
                    min-width: 0;
                }
                .property-card-compact .property-meta .compact-feature-item span {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .property-card-compact .property-price {
                    order: 4;
                    border-top: 0;
                    border-bottom: 1px solid rgba(31, 27, 21, 0.08);
                    color: #1f1b16;
                    font-size: 0.86rem;
                    font-weight: 650;
                    margin-top: 5px;
                    padding-bottom: 8px;
                }
                @media (min-width: 1024px) {
                    .property-card-search-compact .card-image-container {
                        aspect-ratio: 2.06 / 1;
                        border-radius: 14px;
                    }
                    .property-card-search-compact .card-content-link,
                    .property-card-search-compact :global(.card-content-link) {
                        min-height: 78px;
                        padding: 8px 2px 0;
                    }
                    .property-card-search-compact .compact-location-row {
                        margin-bottom: 2px;
                        font-size: 0.64rem;
                    }
                    .property-card-search-compact .property-title {
                        font-size: 0.68rem;
                        line-height: 1.2;
                    }
                    .property-card-search-compact .property-meta {
                        gap: 5px;
                        margin-top: 4px;
                        font-size: 0.64rem;
                    }
                    .property-card-search-compact .property-meta .compact-feature-item svg {
                        width: 12px;
                        height: 12px;
                    }
                    .property-card-search-compact .property-price {
                        margin-top: 4px;
                        padding-bottom: 6px;
                        font-size: 0.78rem;
                    }
                    .property-card-search-compact .property-quality-badge {
                        top: 8px;
                        left: 8px;
                        min-height: 21px;
                        padding: 0 8px;
                        font-size: 0.56rem;
                    }
                    .property-card-search-compact .compact-photo-count,
                    .property-card-search-compact .compact-view-count {
                        min-height: 21px;
                        padding: 0 7px;
                        font-size: 0.56rem;
                    }
                    .property-card-search-compact .thumbnail-gallery-dots {
                        bottom: 8px;
                    }
                }
                @media (min-width: 1500px) {
                    .property-card-search-compact .card-image-container {
                        aspect-ratio: 2.18 / 1;
                    }
                    .property-card-search-compact .card-content-link,
                    .property-card-search-compact :global(.card-content-link) {
                        min-height: 74px;
                    }
                }
                .favorite-toggle {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    z-index: 2;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    border: 0;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.88);
                    color: #fff;
                    cursor: pointer;
                    filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.42));
                    transition: transform 0.18s ease, background 0.18s ease, color 0.18s ease;
                }
                .favorite-toggle:hover {
                    transform: translateY(-1px) scale(1.03);
                    background: #fff;
                }
                .favorite-toggle svg {
                    fill: rgba(31, 27, 21, 0.08);
                    color: #f5a5ac;
                    stroke-width: 2.15;
                }
                .favorite-toggle-active {
                    background: #fff;
                    color: #ef7182;
                }
                .favorite-toggle-active svg {
                    fill: #ef7182;
                }
                .compact-media-badges {
                    position: absolute;
                    right: 9px;
                    bottom: 9px;
                    z-index: 2;
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    max-width: calc(100% - 18px);
                    pointer-events: none;
                }
                .compact-photo-count,
                .compact-view-count {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 5px 8px;
                    border-radius: 999px;
                    background: rgba(31, 27, 21, 0.68);
                    color: #fff8ea;
                    font: 560 0.66rem/1 'Inter', sans-serif;
                    backdrop-filter: blur(8px);
                }
                .compact-view-count {
                    background: rgba(17, 14, 10, 0.72);
                }
                .compact-photo-count svg,
                .compact-view-count svg {
                    flex: 0 0 auto;
                }
                .property-intelligence-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                    margin-top: 8px;
                    min-width: 0;
                }
                .property-intelligence-chip {
                    display: inline-flex;
                    align-items: center;
                    max-width: 100%;
                    min-height: 22px;
                    padding: 0 7px;
                    border-radius: 999px;
                    font: 800 0.58rem/1 'Inter', sans-serif;
                    letter-spacing: 0.02em;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    text-transform: uppercase;
                    white-space: nowrap;
                }
                .property-intelligence-chip-gold {
                    background: rgba(184,148,95,0.14);
                    color: #8f6726;
                }
                .property-intelligence-chip-dark {
                    background: rgba(31,27,21,0.1);
                    color: #28231c;
                }
                .property-intelligence-chip-green {
                    background: rgba(31,125,83,0.1);
                    color: #1f7d53;
                }
                .property-intelligence-chip-blue {
                    background: rgba(26,111,168,0.1);
                    color: #1a6fa8;
                }
                @media (max-width: 649px) {
                    .property-card {
                        border-radius: 10px;
                        padding: 10px;
                    }
                    .card-image-container {
                        height: 88px;
                        border-radius: 2px;
                    }
                    .card-content-link {
                        padding: 10px 0 0;
                    }
                    .property-title {
                        font-family: inherit;
                        font-size: 0.72rem;
                        font-weight: 700;
                        line-height: 1.24;
                        margin-bottom: 3px;
                    }
                    .property-location {
                        font-size: 0.62rem;
                        line-height: 1.2;
                    }
                    .property-price {
                        font-size: 0.9rem;
                        margin-top: 10px;
                    }
                    .property-meta {
                        font-size: 0.6rem;
                        gap: 4px 7px;
                        line-height: 1.35;
                        margin-top: 8px;
                    }
                    .property-tags { gap: 4px; margin-top: 9px; }
                    .property-tags span {
                        font-size: 0.54rem;
                        padding: 4px 6px;
                    }
                    .property-card-compact {
                        padding: 0;
                        border-radius: 0;
                    }
                    .property-card-compact .card-image-container {
                        height: auto;
                        aspect-ratio: 1.25 / 1;
                        border-radius: 14px;
                    }
                    .property-card-compact .card-content-link {
                        padding: 7px 1px 0;
                    }
                    .property-card-compact .property-title {
                        font-size: 0.74rem;
                        font-weight: 560;
                        line-height: 1.18;
                    }
                    .property-card-compact .property-location {
                        font-size: 0.6rem;
                    }
                    .property-card-compact .compact-location-row {
                        margin-bottom: 1px;
                    }
                    .property-card-compact .property-price {
                        font-size: 0.7rem;
                        font-weight: 620;
                        margin-top: 2px;
                    }
                    .property-card-compact .property-meta {
                        font-size: 0.58rem;
                        gap: 4px 6px;
                        margin-top: 4px;
                    }
                    .favorite-toggle {
                        top: 7px;
                        right: 7px;
                        width: 29px;
                        height: 29px;
                    }
                    .favorite-toggle svg {
                        width: 20px;
                        height: 20px;
                    }
                    .compact-photo-count {
                        right: 7px;
                        bottom: 7px;
                        padding: 4px 7px;
                        font-size: 0.56rem;
                    }
                    .property-card-compact .property-meta span:not(:last-child)::after {
                        margin-left: 3px;
                    }
                    .property-card-compact .card-content-link {
                        min-height: 96px;
                        padding: 10px 1px 0;
                    }
                    .property-card-compact :global(.card-content-link) {
                        min-height: 96px;
                        padding: 10px 1px 0;
                    }
                    .property-card-compact .compact-location-row {
                        font-size: 0.58rem;
                        font-weight: 820;
                        line-height: 1.12;
                        margin-bottom: 3px;
                    }
                    .property-card-compact .property-title {
                        color: #4f463b;
                        font-size: 0.64rem;
                        font-weight: 430;
                        line-height: 1.22;
                        -webkit-line-clamp: 1;
                    }
                    .property-card-compact .property-meta {
                        flex-wrap: wrap;
                        gap: 4px 6px;
                        line-height: 1;
                        margin-top: 5px;
                        overflow: visible;
                        padding-bottom: 0;
                        white-space: normal;
                    }
                    .property-card-compact .property-meta .compact-feature-item {
                        gap: 2px;
                    }
                    .property-card-compact .property-meta .compact-feature-item svg {
                        width: 12px;
                        height: 12px;
                    }
                    .property-card-compact .property-price {
                        border-top: 0;
                        border-bottom: 1px solid rgba(31, 27, 21, 0.08);
                        font-size: 0.7rem;
                        font-weight: 650;
                        margin-top: 4px;
                        padding-bottom: 7px;
                    }
                    .property-intelligence-row {
                        gap: 4px;
                        margin-top: 6px;
                    }
                    .property-intelligence-chip {
                        min-height: 19px;
                        padding: 0 6px;
                        font-size: 0.49rem;
                    }
                }
                .thumbnail-gallery-nav {
                    position: absolute;
                    top: 50%;
                    z-index: 4;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 26px;
                    height: 46px;
                    border: 1px solid rgba(255,253,247,0.42);
                    background: linear-gradient(180deg, rgba(255,253,247,0.44), rgba(31,27,21,0.24));
                    color: #fffdf7;
                    cursor: pointer;
                    opacity: 0;
                    transform: translateY(-50%) scale(0.98);
                    box-shadow: 0 9px 18px rgba(24,21,17,0.18), inset 0 0 0 1px rgba(255,255,255,0.14);
                    transition: opacity 0.18s ease, transform 0.18s ease, background 0.18s ease;
                    backdrop-filter: blur(7px);
                }
                .thumbnail-gallery-nav:hover,
                .thumbnail-gallery-nav:focus-visible {
                    background: linear-gradient(180deg, rgba(255,253,247,0.6), rgba(31,27,21,0.32));
                    opacity: 1;
                    transform: translateY(-50%) scale(1);
                }
                .thumbnail-gallery-nav:active {
                    transform: translateY(-50%) scale(0.96);
                }
                .card-image-container:hover .thumbnail-gallery-nav,
                .card-image-container:focus-within .thumbnail-gallery-nav {
                    opacity: 0.92;
                    transform: translateY(-50%) scale(1);
                }
                .thumbnail-gallery-nav-prev {
                    left: 0;
                    border-left: 0;
                    border-radius: 0 999px 999px 0;
                }
                .thumbnail-gallery-nav-next {
                    right: 0;
                    border-right: 0;
                    border-radius: 999px 0 0 999px;
                }
                .thumbnail-gallery-nav svg {
                    width: 15px;
                    height: 15px;
                    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.45));
                    stroke-width: 2.75;
                }
                .thumbnail-gallery-dots {
                    position: absolute;
                    left: 50%;
                    bottom: 11px;
                    z-index: 3;
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    min-height: 18px;
                    padding: 5px 8px;
                    border-radius: 999px;
                    background: rgba(31,27,21,0.5);
                    transform: translateX(-50%);
                    pointer-events: none;
                    backdrop-filter: blur(8px);
                }
                .thumbnail-gallery-dot {
                    width: 5px;
                    height: 5px;
                    border-radius: 50%;
                    background: rgba(255,253,247,0.62);
                    box-shadow: 0 1px 3px rgba(0,0,0,0.28);
                }
                .thumbnail-gallery-dot-active {
                    width: 7px;
                    height: 7px;
                    background: #fffdf7;
                }
                @media (max-width: 649px) {
                    .thumbnail-gallery-nav {
                        display: none;
                    }
                    .thumbnail-gallery-dots {
                        bottom: 8px;
                        gap: 4px;
                        padding: 4px 6px;
                    }
                    .thumbnail-gallery-dot {
                        width: 4px;
                        height: 4px;
                    }
                    .thumbnail-gallery-dot-active {
                        width: 6px;
                        height: 6px;
                    }
                }
                .property-quality-badge {
                    position: absolute;
                    top: 9px;
                    left: 9px;
                    z-index: 2;
                    display: inline-flex;
                    align-items: center;
                    max-width: calc(100% - 58px);
                    min-height: 24px;
                    padding: 0 9px;
                    border-radius: 999px;
                    color: #fff8ea;
                    font: 700 0.66rem/1 'Inter', sans-serif;
                    letter-spacing: 0.05em;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    backdrop-filter: blur(8px);
                    text-transform: uppercase;
                    white-space: nowrap;
                }
                .property-quality-badge-blue {
                    background: linear-gradient(135deg, rgba(26,111,168,0.92), rgba(13,79,126,0.92));
                }
                .property-quality-badge-gold {
                    background: linear-gradient(135deg, rgba(184,148,95,0.95), rgba(143,103,38,0.95));
                    color: #fffdf7;
                }
                .property-quality-badge-dark {
                    background: rgba(31,27,21,0.86);
                }
                .property-quality-badge-green {
                    background: linear-gradient(135deg, rgba(31,125,83,0.92), rgba(22,92,67,0.92));
                }
                @media (max-width: 649px) {
                    .property-quality-badge {
                        top: 7px;
                        left: 7px;
                        max-width: calc(100% - 48px);
                        min-height: 20px;
                        padding: 0 7px;
                        font-size: 0.49rem;
                    }
                }
                @media (min-width: 1024px) {
                    .card-image-container {
                        height: 190px;
                    }
                    .property-title {
                        font-size: 1rem;
                    }
                    .property-card-compact .card-image-container {
                        height: auto;
                    }
                    .property-card-compact .property-title {
                        font-size: 0.86rem;
                    }
                }
            `}</style>
        </div>
    )
}
