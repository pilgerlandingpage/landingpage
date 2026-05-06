'use client'

import { Heart, ChevronLeft, ChevronRight, Bed, Bath, Maximize, MapPin } from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect } from 'react'

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

    useEffect(() => {
        if (gallery.length <= 1 || isHovered) return

        const intervalId = setInterval(() => {
            setCurrentImageIndex((prev) => (prev + 1) % gallery.length)
        }, 5000)

        return () => clearInterval(intervalId)
    }, [gallery.length, isHovered])

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

    const href = landingPageSlug ? `/${landingPageSlug}` : `/imovel/${property.id}`

    return (
        <div
            className="property-card"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="card-image-container">
                <Link href={href} className="image-link" tabIndex={-1}>
                    <div 
                        className="images-slider" 
                        style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
                    >
                        {gallery.map((src, idx) => (
                            <img
                                key={idx}
                                src={src}
                                alt={`${property.title} - Foto ${idx + 1}`}
                                className="property-image"
                                loading={idx === 0 ? "eager" : "lazy"}
                            />
                        ))}
                    </div>
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
                <p className="info-text property-type">{property.property_type || 'Imóvel de Luxo'}</p>

                <div className="location-row">
                    <MapPin size={13} className="location-pin" />
                    <h3 className="location-text">{property.city}{property.state ? ` / ${property.state}` : ''}</h3>
                </div>

                <div className="property-specs">
                    {property.bedrooms && (
                        <span className="spec-item">
                            <Bed size={14} />
                            {property.bedrooms} {property.bedrooms === 1 ? 'Quarto' : 'Quartos'}
                        </span>
                    )}
                    {property.bathrooms && (
                        <span className="spec-item">
                            <Bath size={14} />
                            {property.bathrooms} {property.bathrooms === 1 ? 'Banheiro' : 'Banheiros'}
                        </span>
                    )}
                    {property.area_m2 && (
                        <span className="spec-item">
                            <Maximize size={13} />
                            {property.area_m2.toLocaleString('pt-BR')} m²
                        </span>
                    )}
                </div>

                <div className="price-row">
                    <span className="price-label">Venda:</span>
                    <span className="price-bold">{formattedPrice}</span>
                </div>
            </Link>

            <style jsx>{`
                .property-card {
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                    height: 100%;
                    min-width: 0;
                    background: #ffffff;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 
                        0 3px 6px rgba(0, 0, 0, 0.08),
                        0 10px 24px rgba(0, 0, 0, 0.10),
                        0 24px 48px rgba(0, 0, 0, 0.06);
                    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    cursor: pointer;
                }
                .property-card:hover {
                    transform: translateY(-8px) scale(1.015);
                    box-shadow: 
                        0 4px 8px rgba(0, 0, 0, 0.06),
                        0 16px 32px rgba(0, 0, 0, 0.1),
                        0 32px 64px rgba(0, 0, 0, 0.08),
                        0 0 0 1px rgba(201, 169, 110, 0.08);
                }

                /* --- IMAGE AREA --- */
                .card-image-container {
                    position: relative;
                    width: 100%;
                    aspect-ratio: 4 / 3;
                    border-radius: 12px 12px 0 0;
                    overflow: hidden;
                    background: #e8e5e0;
                    transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .property-card:hover .card-image-container {
                    transform: scale(1.02);
                }

                .image-link {
                    display: block;
                    width: 100%;
                    height: 100%;
                    border: none;
                    outline: none;
                    overflow: hidden;
                }

                .images-slider {
                    display: flex;
                    width: 100%;
                    height: 100%;
                    transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                    will-change: transform;
                }

                .property-image {
                    flex: 0 0 100%;
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
                    align-items: center;
                    text-align: center;
                    gap: 4px;
                    text-decoration: none !important;
                    color: inherit !important;
                    cursor: pointer;
                    padding: 18px 16px 22px 16px;
                    border-top: 1px solid #eee;
                    flex: 1;
                }
                
                .card-content-link:hover, 
                .card-content-link:visited, 
                .card-content-link:active, 
                .card-content-link:focus {
                    text-decoration: none !important;
                    color: inherit !important;
                }

                .info-text.property-type {
                    font-size: 1rem;
                    color: #1a1a1a;
                    margin: 0 0 2px 0;
                    line-height: 1.4;
                    font-weight: 400;
                    text-transform: none;
                    letter-spacing: 0;
                }

                .location-row {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    width: 100%;
                    margin-bottom: 6px;
                }

                .location-pin {
                    flex-shrink: 0;
                    color: #1a1a1a;
                }

                .location-text {
                    font-size: 0.88rem;
                    font-weight: 700;
                    color: #1a1a1a;
                    margin: 0;
                    line-height: 1.3;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 100%;
                    font-family: 'Inter', sans-serif;
                }

                .property-specs {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-wrap: wrap;
                    gap: 6px 16px;
                    margin: 4px 0 8px 0;
                    width: 100%;
                }

                .spec-item {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 0.82rem;
                    color: #444;
                    font-weight: 400;
                }

                .price-row {
                    display: flex;
                    justify-content: center;
                    align-items: baseline;
                    gap: 6px;
                    margin-top: auto;
                    width: 100%;
                    padding-top: 8px;
                    border-top: 1px solid #f0ece6;
                }

                .price-label {
                    font-size: 0.92rem;
                    font-weight: 700;
                    color: #1a1a1a;
                }

                .price-bold {
                    font-size: 1.1rem;
                    font-weight: 800;
                    color: #1a1a1a;
                }

                /* === RESPONSIVE ADJUSTMENTS === */
                @media (max-width: 649px) {
                    .card-content-link {
                        padding: 14px 10px 18px 10px;
                    }
                    .info-text.property-type {
                        font-size: 0.85rem;
                    }
                    .location-text {
                        font-size: 0.78rem;
                    }
                    .spec-item {
                        font-size: 0.72rem;
                    }
                    .price-bold {
                        font-size: 0.92rem;
                    }
                    .price-label {
                        font-size: 0.8rem;
                    }
                    .exclusive-badge {
                        font-size: 0.58rem;
                        padding: 2px 7px;
                    }
                    .card-image-container {
                        border-radius: 10px 10px 0 0;
                        aspect-ratio: 4 / 3;
                    }
                }

                /* Desktop enhancements */
                @media (min-width: 1024px) {
                    .info-text.property-type { font-size: 1.05rem; }
                    .location-text { font-size: 0.92rem; }
                    .spec-item { font-size: 0.85rem; }
                    .price-bold { font-size: 1.15rem; }
                    .card-image-container { border-radius: 12px 12px 0 0; }
                }
            `}</style>
        </div>
    )
}

