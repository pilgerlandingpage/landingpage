'use client'

import Link from 'next/link'
import { useRef, useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import PropertyCard from '@/components/marketplace/PropertyCard'

interface HomepageSectionProps {
    title: string
    subtitle?: string
    properties: any[]
    lpMap: Map<string, string>
    viewAllHref?: string
    viewAllLabel?: string
}

export default function HomepageSection({
    title,
    subtitle,
    properties,
    lpMap,
    viewAllHref,
    viewAllLabel = 'Ver todos',
}: HomepageSectionProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const [canScrollLeft, setCanScrollLeft] = useState(false)
    const [canScrollRight, setCanScrollRight] = useState(false)

    const checkScroll = () => {
        const el = scrollRef.current
        if (!el) return
        setCanScrollLeft(el.scrollLeft > 10)
        setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10)
    }

    useEffect(() => {
        checkScroll()
        const el = scrollRef.current
        if (el) {
            el.addEventListener('scroll', checkScroll, { passive: true })
            window.addEventListener('resize', checkScroll)
        }
        return () => {
            el?.removeEventListener('scroll', checkScroll)
            window.removeEventListener('resize', checkScroll)
        }
    }, [])

    const scroll = (direction: 'left' | 'right') => {
        const el = scrollRef.current
        if (!el) return
        const cardWidth = el.querySelector('.card-slide')?.clientWidth ?? 280
        const gap = 16
        const scrollAmount = (cardWidth + gap) * 2
        el.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth',
        })
    }

    if (!properties || properties.length === 0) return null

    return (
        <section className="homepage-section">
            <div className="section-header">
                <div>
                    <h2 className="section-title">{title}</h2>
                    {subtitle && <p className="section-subtitle">{subtitle}</p>}
                </div>
                <div className="section-header-right">
                    <div className="carousel-arrows">
                        <button
                            className={`arrow-btn ${!canScrollLeft ? 'disabled' : ''}`}
                            onClick={() => scroll('left')}
                            aria-label="Anterior"
                            disabled={!canScrollLeft}
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            className={`arrow-btn ${!canScrollRight ? 'disabled' : ''}`}
                            onClick={() => scroll('right')}
                            aria-label="Próximo"
                            disabled={!canScrollRight}
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                    {viewAllHref && (
                        <Link href={viewAllHref} className="section-view-all">
                            {viewAllLabel} →
                        </Link>
                    )}
                </div>
            </div>
            <div className="carousel-track" ref={scrollRef}>
                {properties.map((property: any) => (
                    <div className="card-slide" key={property.id}>
                        <PropertyCard
                            property={property}
                            landingPageSlug={lpMap.get(property.id)}
                        />
                    </div>
                ))}
            </div>

            <style jsx>{`
                .homepage-section {
                    margin-bottom: 24px;
                }
                .section-header {
                    display: flex;
                    align-items: baseline;
                    justify-content: space-between;
                    margin-bottom: 12px;
                    gap: 16px;
                }
                .section-header-right {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    flex-shrink: 0;
                }
                .section-title {
                    font-family: 'Inter', sans-serif;
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: #0a0a0a;
                    background: linear-gradient(135deg, #c9a96e 0%, #dfc18e 50%, #a88b4a 100%);
                    display: inline-block;
                    padding: 6px 16px;
                    margin: 0;
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                    border-radius: 4px;
                    box-shadow: 0 2px 8px rgba(201, 169, 110, 0.3);
                    border: none;
                }
                .section-subtitle {
                    font-size: 0.8rem;
                    color: var(--text-muted, #777);
                    margin: 6px 0 0 2px;
                    font-weight: 500;
                }
                .section-view-all {
                    font-size: 0.82rem;
                    font-weight: 600;
                    color: var(--gold, #b8945f) !important;
                    white-space: nowrap;
                    transition: opacity 0.2s;
                }
                .section-view-all:hover {
                    opacity: 0.7;
                }
                .carousel-arrows {
                    display: flex;
                    gap: 6px;
                }
                .arrow-btn {
                    width: 34px;
                    height: 34px;
                    border-radius: 50%;
                    border: 1px solid #ddd;
                    background: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: #333;
                    transition: all 0.2s;
                }
                .arrow-btn:hover:not(.disabled) {
                    border-color: var(--gold, #b8945f);
                    color: var(--gold, #b8945f);
                }
                .arrow-btn.disabled {
                    opacity: 0.3;
                    cursor: default;
                }
                .carousel-track {
                    display: flex;
                    align-items: stretch;
                    gap: 16px;
                    overflow-x: auto;
                    scroll-snap-type: x mandatory;
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: none;
                    padding-bottom: 4px;
                }
                .carousel-track::-webkit-scrollbar {
                    display: none;
                }
                .card-slide {
                    flex: 0 0 calc(50% - 8px);
                    scroll-snap-align: start;
                    min-width: 0;
                    display: flex;
                }

                @media (min-width: 600px) {
                    .card-slide {
                        flex: 0 0 calc(33.333% - 11px);
                    }
                }
                @media (min-width: 768px) {
                    .section-title { font-size: 0.82rem; padding: 7px 20px; }
                    .card-slide {
                        flex: 0 0 calc(25% - 12px);
                    }
                }
                @media (min-width: 1200px) {
                    .card-slide {
                        flex: 0 0 calc(20% - 13px);
                    }
                }
                @media (min-width: 1600px) {
                    .card-slide {
                        flex: 0 0 calc(16.666% - 14px);
                    }
                }
            `}</style>
        </section>
    )
}
