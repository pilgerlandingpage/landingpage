'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { MouseEvent, ReactNode } from 'react'
import { Bath, BedDouble, Camera, Car, Heart, MapPin, Ruler } from 'lucide-react'
import { displayLocationName, normalizeLocationName, replaceItajaiWithPraiaBrava } from '@/lib/locations/display'
import { isPlainLeftClick, propertyDetailsPath, propertyFeedPath, shouldOpenPropertyDetailsOnDesktop } from '@/lib/properties/responsive-destination'
import { trackEvent } from '@/lib/tracking/client'

interface PropertyCardProps {
    property: {
        id: string
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
        parking_spaces?: number | null
        suites?: number | null
        amenities?: string[] | null
        status?: string | null
    }
    landingPageSlug?: string
    imagePriority?: boolean
    variant?: 'default' | 'homeCompact'
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

export default function PropertyCard({ property, landingPageSlug, imagePriority = false, variant = 'default' }: PropertyCardProps) {
    const isHomeCompact = variant === 'homeCompact'
    const formattedPrice = property.price ? formatPrice(property.price) : isHomeCompact ? 'Consulte-nos' : formatPrice(property.price)
    const feedHref = propertyFeedPath(property.id)
    const detailsHref = propertyDetailsPath(property.id)
    const href = isHomeCompact ? feedHref : landingPageSlug ? `/${landingPageSlug}` : feedHref
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
    const compactFeatureItems = [
        property.bedrooms ? { key: 'bedrooms', icon: <BedDouble size={14} aria-hidden="true" />, label: `${property.bedrooms}` } : null,
        property.suites ? { key: 'suites', icon: <Bath size={14} aria-hidden="true" />, label: `${property.suites}` } : null,
        property.parking_spaces ? { key: 'parking', icon: <Car size={14} aria-hidden="true" />, label: `${property.parking_spaces}` } : null,
        compactArea ? { key: 'area', icon: <Ruler size={14} aria-hidden="true" />, label: `${formatCompactNumber(compactArea)} m2` } : null,
    ].filter(Boolean) as { key: string; icon: ReactNode; label: string }[]
    const handlePropertyClick = (event: MouseEvent<HTMLAnchorElement>) => {
        if (!isHomeCompact || !isPlainLeftClick(event)) return

        const opensDetails = shouldOpenPropertyDetailsOnDesktop()
        const destination = opensDetails ? detailsHref : feedHref
        void trackEvent(opensDetails ? 'home_property_desktop_details_clicked' : 'home_property_mobile_feed_clicked', {
            property_id: property.id,
            title: displayTitle,
            destination,
            source: 'home_property_card',
        })

        if (!opensDetails) return

        event.preventDefault()
        window.location.assign(detailsHref)
    }

    return (
        <div className={`property-card ${isHomeCompact ? 'property-card-compact' : ''}`}>
            <div className="card-image-container">
                <Link href={href} className="image-link" tabIndex={-1} onClick={handlePropertyClick}>
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
                            <span className="compact-image-pill">
                                {property.exclusive ? 'Exclusivo' : 'Curadoria Pilger'}
                            </span>
                            <span className="compact-heart" aria-hidden="true">
                                <Heart size={22} />
                            </span>
                            {imageCount > 0 && (
                                <span className="compact-photo-count">
                                    <Camera size={13} />
                                    {imageCount}
                                </span>
                            )}
                        </>
                    ) : (
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
                    )}
                </Link>

            </div>

            <Link href={href} className="card-content-link" onClick={handlePropertyClick}>
                <div className="property-head">
                    <div className="property-heading-copy">
                        <div className="property-title">{isHomeCompact ? displayTitle : cardTitle}</div>
                        <div className={`property-location ${isHomeCompact ? 'compact-location-row' : ''}`}>
                            {isHomeCompact && <MapPin size={13} aria-hidden="true" />}
                            <span>{isHomeCompact ? compactLocation || locationLabel : locationLabel}</span>
                        </div>
                    </div>
                </div>

                <div className="property-price">{formattedPrice}</div>

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
                    margin-bottom: 6px;
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
                    margin-top: 6px;
                }
                .property-card-compact .property-meta {
                    border-bottom: 0;
                    color: #6a6157;
                    flex-wrap: wrap;
                    gap: 6px 9px;
                    font-size: 0.73rem;
                    line-height: 1;
                    margin-top: 8px;
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
                .compact-image-pill {
                    position: absolute;
                    top: 10px;
                    left: 10px;
                    z-index: 2;
                    max-width: calc(100% - 58px);
                    padding: 7px 11px;
                    border-radius: 999px;
                    background: rgba(255, 255, 255, 0.92);
                    color: #342d25;
                    font: 560 0.68rem/1 'Inter', sans-serif;
                    letter-spacing: -0.005em;
                    box-shadow: 0 5px 14px rgba(31, 27, 21, 0.11);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .compact-heart {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    z-index: 2;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    color: #fff;
                    filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.42));
                }
                .compact-heart svg {
                    fill: rgba(31, 27, 21, 0.18);
                    stroke-width: 2.15;
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
                    .property-card-compact .property-price {
                        font-size: 0.7rem;
                        font-weight: 620;
                        margin-top: 5px;
                    }
                    .property-card-compact .property-meta {
                        font-size: 0.58rem;
                        gap: 4px 6px;
                        margin-top: 5px;
                    }
                    .compact-image-pill {
                        top: 8px;
                        left: 8px;
                        max-width: calc(100% - 48px);
                        padding: 6px 9px;
                        font-size: 0.56rem;
                    }
                    .compact-heart {
                        top: 7px;
                        right: 7px;
                        width: 29px;
                        height: 29px;
                    }
                    .compact-heart svg {
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
