'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { BedDouble, Camera, Car, Heart, MapPin, Ruler } from 'lucide-react'
import { displayLocationName, normalizeLocationName, replaceItajaiWithPraiaBrava } from '@/lib/locations/display'
import { propertyDetailsPath } from '@/lib/properties/responsive-destination'
import { getPropertyIntelligenceLabels } from '@/lib/properties/intelligence'
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
    }
    landingPageSlug?: string
    imagePriority?: boolean
    variant?: 'default' | 'homeCompact'
}

const FAVORITES_KEY = 'pilger_property_favorites'

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

export default function PropertyCard({ property, landingPageSlug, imagePriority = false, variant = 'default' }: PropertyCardProps) {
    const isHomeCompact = variant === 'homeCompact'
    const showFavoriteToggle = !isHomeCompact
    const [isFavorite, setIsFavorite] = useState(false)
    const formattedPrice = property.price ? formatPrice(property.price) : isHomeCompact ? 'Consulte-nos' : formatPrice(property.price)
    const detailsHref = propertyDetailsPath(property)
    const href = isHomeCompact ? detailsHref : landingPageSlug ? `/${landingPageSlug}` : detailsHref
    const imageSrc = property.featured_image || '/images/brava-concetto/20_CL_BC_LIVING_FINAL_01_ANG_02_EF_web.jpg'
    const displayTitle = replaceItajaiWithPraiaBrava(property.title)
    const displayCity = displayLocationName(property.city)
    const displayNeighborhood = replaceItajaiWithPraiaBrava(property.neighborhood)
    const locationParts = normalizeLocationName(displayNeighborhood) === normalizeLocationName(displayCity)
        ? [displayCity]
        : [displayNeighborhood, displayCity]
    const location = locationParts.filter(Boolean).join(' - ')
    const locationLabel = `${location || 'Balneário Camboriú'}${property.state ? ` / ${property.state}` : ''}`
    const imageCount = Array.isArray(property.images) ? property.images.filter(Boolean).length : 0
    const amenities = Array.isArray(property.amenities) ? property.amenities.filter(Boolean) : []
    const visibleAmenities = amenities.slice(0, 3)
    const intelligenceLabels = isHomeCompact
        ? []
        : getPropertyIntelligenceLabels(property, {
            includeFrontSea: false,
            max: 3,
        })
    const cardTitle = displayTitle
    const isFrenteMar = /frente.?mar|frente ao mar/i.test(displayTitle) || amenities.some(a => /frente.?mar/i.test(a))
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
    const compactFeatureItems = [
        property.bedrooms ? { key: 'bedrooms', icon: <BedDouble size={14} aria-hidden="true" />, label: `${property.bedrooms}` } : null,
        property.parking_spaces ? { key: 'parking', icon: <Car size={14} aria-hidden="true" />, label: `${property.parking_spaces}` } : null,
        compactArea ? { key: 'area', icon: <Ruler size={14} aria-hidden="true" />, label: `${formatCompactNumber(compactArea)} m²` } : null,
    ].filter(Boolean) as { key: string; icon: ReactNode; label: string }[]
    const handlePropertyClick = () => {
        if (!isHomeCompact) return

        void trackEvent('home_property_details_clicked', {
            property_id: property.id,
            title: displayTitle,
            destination: detailsHref,
            source: 'home_property_card',
        })
    }

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
            source: isHomeCompact ? 'search_card' : 'property_card',
            favorite_count: next.length,
        })
    }

    return (
        <div className={`property-card ${isHomeCompact ? 'property-card-compact' : ''}`}>
            <div className="card-image-container">
                <Link
                    href={href}
                    className="image-link"
                    tabIndex={-1}
                    onClick={handlePropertyClick}
                    style={{ display: 'block', height: '100%', overflow: 'hidden', position: 'relative', width: '100%' }}
                >
                    {isHomeCompact ? (
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
                            {imageCount > 0 && (
                                <span className="compact-photo-count">
                                    <Camera size={13} />
                                    {imageCount}
                                </span>
                            )}
                            {isFrenteMar && <span className="frente-mar-badge">🌊 Frente Mar</span>}
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
                            {isFrenteMar && <span className="frente-mar-badge">🌊 Frente Mar</span>}
                        </>
                    )}
                </Link>
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

            <Link href={href} className="card-content-link" onClick={handlePropertyClick}>
                <div className="property-head">
                    <div className="property-heading-copy">
                        <div className="property-title">{boldifyTitle(isHomeCompact ? displayTitle : cardTitle)}</div>
                        <div className={`property-location ${isHomeCompact ? 'compact-location-row' : ''}`}>
                            {isHomeCompact && <MapPin size={13} aria-hidden="true" />}
                            <span>{isHomeCompact ? compactLocation || locationLabel : locationLabel}</span>
                        </div>
                    </div>
                </div>

                <div className="property-price">{formattedPrice}</div>

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
                    {isHomeCompact ? (
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

                {!isHomeCompact && visibleAmenities.length > 0 && (
                    <div className="property-tags">
                        {visibleAmenities.map((amenity, index) => <span key={`${amenity}-${index}`}>{amenity}</span>)}
                        {amenities.length > 3 && <span>+{amenities.length - 3}</span>}
                    </div>
                )}
            </Link>

            <style jsx>{`
                .property-card {
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
                .property-card:hover {
                    transform: translateY(-5px);
                    border-color: rgba(201,169,110,0.3);
                    box-shadow: 0 10px 26px rgba(31,27,21,0.09);
                }
                .card-image-container {
                    position: relative;
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
                    aspect-ratio: 1.08 / 1;
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
                    padding-bottom: 8px;
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
                .compact-photo-count {
                    position: absolute;
                    right: 9px;
                    bottom: 9px;
                    z-index: 2;
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
                        aspect-ratio: 1.05 / 1;
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
                .frente-mar-badge {
                    position: absolute;
                    bottom: 9px;
                    left: 9px;
                    z-index: 2;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 5px 10px;
                    border-radius: 999px;
                    background: linear-gradient(135deg, #1a6fa8cc, #0d4f7ecc);
                    color: #fff;
                    font: 700 0.66rem/1 'Inter', sans-serif;
                    letter-spacing: 0.04em;
                    backdrop-filter: blur(8px);
                    text-transform: uppercase;
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
