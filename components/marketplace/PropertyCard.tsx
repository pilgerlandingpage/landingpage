'use client'

import { Heart, ChevronLeft, ChevronRight, Bed, Bath, Maximize } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

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
        featured_image: string | null
        images: string[] | null
        property_type?: string
    }
    landingPageSlug?: string
}

export default function PropertyCard({ property, landingPageSlug }: PropertyCardProps) {
    const [currentImageIndex, setCurrentImageIndex] = useState(0)
    const [isHovered, setIsHovered] = useState(false)

    // Merge featured image with gallery for the carousel
    const gallery = property.images && property.images.length > 0
        ? property.images
        : [property.featured_image || 'https://via.placeholder.com/400x300?text=Sem+Imagem']

    const nextImage = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setCurrentImageIndex((prev) => (prev + 1) % gallery.length)
    }

    const prevImage = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setCurrentImageIndex((prev) => (prev - 1 + gallery.length) % gallery.length)
    }

    const formattedPrice = property.price
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(property.price)
        : 'Sob Consulta'

    const href = landingPageSlug ? `/${landingPageSlug}` : '#'

    return (
        <div
            className="property-card"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="card-image-container">
                <Link href={href} className="image-link" tabIndex={-1}>
                    <img
                        src={gallery[currentImageIndex]}
                        alt={property.title}
                        className="property-image"
                        loading="lazy"
                    />
                </Link>

                {/* Heart Icon - Top Right */}
                <button className="favorite-button" aria-label="Adicionar aos favoritos">
                    <Heart size={20} className="heart-icon" />
                </button>

                {/* Exclusive Badge - Top Left */}
                <div className="exclusive-badge">Exclusivo</div>

                {/* Carousel Controls */}
                {isHovered && gallery.length > 1 && (
                    <>
                        <button className="carousel-control prev" onClick={prevImage}>
                            <ChevronLeft size={16} />
                        </button>
                        <button className="carousel-control next" onClick={nextImage}>
                            <ChevronRight size={16} />
                        </button>
                    </>
                )}

                {/* Dots */}
                {gallery.length > 1 && (
                    <div className="carousel-dots">
                        {gallery.slice(0, 5).map((_, idx) => (
                            <div
                                key={idx}
                                className={`dot ${idx === currentImageIndex ? 'active' : ''}`}
                            />
                        ))}
                    </div>
                )}
            </div>

            <Link href={href} className="card-content-link">
                <div className="info-top-row">
                    <h3 className="location-text">{property.city}, {property.state}</h3>
                </div>

                <p className="info-text property-type">{property.property_type || 'Imóvel de Luxo'}</p>

                <div className="property-specs">
                    {property.bedrooms && (
                        <span className="spec-item">
                            <Bed size={12} />
                            {property.bedrooms}
                        </span>
                    )}
                    {property.bathrooms && (
                        <span className="spec-item">
                            <Bath size={12} />
                            {property.bathrooms}
                        </span>
                    )}
                    {property.area_m2 && (
                        <span className="spec-item">
                            <Maximize size={11} />
                            {property.area_m2}m²
                        </span>
                    )}
                </div>

                <div className="price-row">
                    <span className="price-bold">{formattedPrice}</span>
                </div>
            </Link>

            <style jsx>{`
                .property-card {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    width: 100%;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    cursor: pointer;
                }

                /* --- IMAGE AREA --- */
                .card-image-container {
                    position: relative;
                    width: 100%;
                    aspect-ratio: 20 / 19;
                    border-radius: 14px;
                    overflow: hidden;
                    background: #1a1a1a;
                    transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.35s ease;
                }

                .property-card:hover .card-image-container {
                    transform: scale(1.02);
                    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
                }

                .image-link {
                    display: block;
                    width: 100%;
                    height: 100%;
                    border: none;
                    outline: none;
                }

                .property-image {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                    transition: transform 0.6s ease;
                }

                .property-card:hover .property-image {
                    transform: scale(1.05);
                }

                .favorite-button {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: transparent;
                    border: none;
                    padding: 0;
                    cursor: pointer;
                    z-index: 5;
                    transition: transform 0.2s;
                }
                .favorite-button:active { transform: scale(0.85); }
                
                .heart-icon {
                    stroke: white;
                    stroke-width: 2px;
                    fill: rgba(0, 0, 0, 0.5);
                    filter: drop-shadow(0 1px 3px rgba(0,0,0,0.3));
                }

                .exclusive-badge {
                    position: absolute;
                    top: 10px;
                    left: 10px;
                    background: linear-gradient(135deg, #c9a96e 0%, #dfc18e 50%, #a88b4a 100%);
                    color: #0a0a0a;
                    padding: 3px 10px;
                    border-radius: 4px;
                    font-size: 0.65rem;
                    font-weight: 700;
                    z-index: 5;
                    box-shadow: 0 2px 8px rgba(201, 169, 110, 0.3);
                    letter-spacing: 1.5px;
                    text-transform: uppercase;
                }

                .carousel-control {
                    position: absolute;
                    top: 50%;
                    transform: translateY(-50%);
                    background: rgba(255, 255, 255, 0.92);
                    border: none;
                    border-radius: 50%;
                    width: 26px;
                    height: 26px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    z-index: 6;
                    color: #222;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                    transition: transform 0.15s, opacity 0.15s;
                    opacity: 0.85;
                }
                .carousel-control:hover {
                    transform: translateY(-50%) scale(1.08);
                    opacity: 1;
                }
                .prev { left: 8px; }
                .next { right: 8px; }

                .carousel-dots {
                    position: absolute;
                    bottom: 10px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    gap: 5px;
                    z-index: 5;
                }
                .dot {
                    width: 5px;
                    height: 5px;
                    background: rgba(255, 255, 255, 0.5);
                    border-radius: 50%;
                    transition: all 0.2s;
                }
                .dot.active {
                    background: #fff;
                    transform: scale(1.2);
                }

                /* --- INFO AREA --- */
                .card-content-link {
                    display: flex;
                    flex-direction: column;
                    gap: 1px;
                    text-decoration: none !important;
                    color: inherit !important;
                    cursor: pointer;
                    padding: 0 2px;
                }
                
                .card-content-link:hover, 
                .card-content-link:visited, 
                .card-content-link:active, 
                .card-content-link:focus {
                    text-decoration: none !important;
                    color: inherit !important;
                }

                .info-top-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    width: 100%;
                }

                .property-specs {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin: 2px 0;
                }

                .spec-item {
                    display: flex;
                    align-items: center;
                    gap: 3px;
                    font-size: 0.75rem;
                    color: var(--text-secondary, #a0a0a0);
                    font-weight: 400;
                }

                .location-text {
                    font-size: 0.88rem;
                    font-weight: 600;
                    color: var(--text-primary, #f5f5f5);
                    margin: 0;
                    line-height: 1.3;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 80%;
                    font-family: 'Inter', sans-serif;
                }



                .info-text {
                    font-size: 0.8rem;
                    color: var(--text-secondary, #a0a0a0);
                    margin: 0;
                    line-height: 1.35;
                    font-weight: 400;
                }



                .price-row {
                    display: flex;
                    align-items: baseline;
                    gap: 3px;
                    margin-top: 2px;
                }

                .price-bold {
                    font-size: 0.88rem;
                    font-weight: 700;
                    color: var(--gold, #c9a96e);
                }

                /* === RESPONSIVE ADJUSTMENTS === */
                @media (max-width: 649px) {
                    .location-text {
                        font-size: 0.78rem;
                    }
                    .info-text {
                        font-size: 0.72rem;
                    }
                    .price-bold {
                        font-size: 0.78rem;
                    }
                    .spec-item {
                        font-size: 0.68rem;
                    }
                    .exclusive-badge {
                        font-size: 0.58rem;
                        padding: 2px 7px;
                    }
                    .card-image-container {
                        border-radius: 10px;
                    }
                }
            `}</style>
        </div>
    )
}
