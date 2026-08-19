'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import PropertyCard from '@/components/marketplace/PropertyCard'

type HomepageSectionTitleIcon = 'eye'

interface HomepageSectionProps {
    title: string
    titleIcon?: HomepageSectionTitleIcon
    subtitle?: string
    properties: any[]
    lpMap: Map<string, string>
    viewAllHref?: string
    viewAllLabel?: string
}

export default function HomepageSection({
    title,
    titleIcon,
    subtitle,
    properties,
    lpMap,
    viewAllHref,
    viewAllLabel = 'Ver todos',
}: HomepageSectionProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const scrollFrame = useRef<number | null>(null)
    const [canScrollLeft, setCanScrollLeft] = useState(false)
    const [canScrollRight, setCanScrollRight] = useState(false)

    const checkScroll = useCallback(() => {
        if (scrollFrame.current !== null) return

        scrollFrame.current = window.requestAnimationFrame(() => {
            scrollFrame.current = null

            const el = scrollRef.current
            if (!el) return

            setCanScrollLeft(el.scrollLeft > 10)
            setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10)
        })
    }, [])

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
            if (scrollFrame.current !== null) {
                window.cancelAnimationFrame(scrollFrame.current)
            }
        }
    }, [checkScroll])

    const scroll = (direction: 'left' | 'right') => {
        const el = scrollRef.current
        if (!el) return
        const cardWidth = el.querySelector('.card-slide')?.clientWidth ?? 280
        const gap = 18
        const scrollAmount = (cardWidth + gap) * 3
        el.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth',
        })
    }

    if (!properties || properties.length === 0) return null
    const TitleIcon = titleIcon === 'eye' ? Eye : null

    return (
        <section className="homepage-section">
            <div className="section-header">
                <div className="section-copy">
                    <h2 className="section-title">
                        {TitleIcon && <TitleIcon size={18} aria-hidden="true" />}
                        <span>{title}</span>
                    </h2>
                    {viewAllHref && (
                        <Link href={viewAllHref} className="section-view-all-mobile">
                            <span>{viewAllLabel}</span>
                            <ArrowRight size={13} />
                        </Link>
                    )}
                </div>

                <div className="section-header-right">
                    <div className="carousel-arrows">
                        <button
                            className={`arrow-btn ${!canScrollLeft ? 'disabled' : ''}`}
                            onClick={() => scroll('left')}
                            aria-label="Anterior"
                            disabled={!canScrollLeft}
                            type="button"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            className={`arrow-btn ${!canScrollRight ? 'disabled' : ''}`}
                            onClick={() => scroll('right')}
                            aria-label="Próximo"
                            disabled={!canScrollRight}
                            type="button"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="carousel-shell">
                <span className={`rail-fade rail-fade-left ${canScrollLeft ? 'visible' : ''}`} />
                <div className="carousel-track" ref={scrollRef}>
                    {properties.map((property: any, index: number) => (
                        <div className="card-slide" key={property.id}>
                            <PropertyCard
                                property={property}
                                landingPageSlug={lpMap.get(property.id)}
                                imagePriority={index < 6}
                                variant="homeCompact"
                            />
                        </div>
                    ))}

                    {viewAllHref && (
                        <div className="card-slide">
                            <Link href={viewAllHref} className="section-end-card">
                                <span className="end-card-kicker">Mais oportunidades</span>
                            <strong>Ver a seleção completa</strong>
                            <small>Continue explorando a seleção separada pelo Guilherme.</small>
                                <span className="end-card-action">
                                    Abrir vitrine
                                    <ArrowRight size={15} />
                                </span>
                            </Link>
                        </div>
                    )}
                </div>
                <span className={`rail-fade rail-fade-right ${canScrollRight ? 'visible' : ''}`} />
            </div>

            <style jsx>{`
                .homepage-section {
                    position: relative;
                    margin-bottom: clamp(22px, 3vw, 38px);
                    padding-top: clamp(18px, 2.4vw, 26px);
                    border-top: 1px solid rgba(184, 148, 95, 0.18);
                }
                .section-header {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    margin-bottom: 10px;
                    gap: 18px;
                }
                .section-copy {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    min-width: 0;
                    max-width: 760px;
                    text-align: left;
                }
                .section-header-right {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex-shrink: 0;
                }
                .section-title {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    color: #1f1b16;
                    font-family: 'Montserrat', 'Inter', sans-serif;
                    font-size: clamp(1.2rem, 1.72vw, 1.88rem);
                    font-weight: 700;
                    line-height: 1;
                    letter-spacing: 0;
                    margin: 0;
                }
                .section-title :global(svg) {
                    color: var(--gold);
                    flex: 0 0 auto;
                    stroke-width: 2.25;
                }
                .homepage-section :global(.section-view-all) {
                    display: none;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    min-height: 38px;
                    padding: 0 14px;
                    border: 1px solid rgba(31, 27, 21, 0.12);
                    border-radius: 999px;
                    background: #171410;
                    color: var(--gold) !important;
                    font: 900 0.72rem/1 'Inter', sans-serif;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    white-space: nowrap;
                    transition: transform 0.22s ease, background 0.22s ease;
                    text-decoration: none !important;
                }
                .homepage-section :global(.section-view-all:hover) {
                    background: #2b251d;
                    transform: translateY(-1px);
                }
                .homepage-section :global(.section-view-all-mobile) {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    color: var(--gold) !important;
                    font: 900 clamp(0.58rem, 0.8vw, 0.68rem)/1 'Inter', sans-serif;
                    letter-spacing: 0.07em;
                    text-decoration: none !important;
                    text-transform: uppercase;
                    white-space: nowrap;
                    transform: translateY(1px);
                    transition: color 0.2s ease, transform 0.2s ease;
                }
                .homepage-section :global(.section-view-all-mobile:hover) {
                    color: var(--gold-dark) !important;
                    transform: translate(2px, 1px);
                }
                .carousel-arrows {
                    display: flex;
                    gap: 7px;
                }
                .arrow-btn {
                    width: 38px;
                    height: 38px;
                    border-radius: 50%;
                    border: 1px solid rgba(31, 27, 21, 0.1);
                    background: rgba(255, 255, 255, 0.78);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: #211c16;
                    box-shadow: 0 10px 24px rgba(31, 27, 21, 0.08);
                    transition: all 0.22s ease;
                }
                .arrow-btn:hover:not(.disabled) {
                    border-color: rgba(184, 148, 95, 0.4);
                    background: #dfc18e;
                    color: #111;
                    transform: translateY(-1px);
                }
                .arrow-btn.disabled {
                    opacity: 0.3;
                    cursor: default;
                    box-shadow: none;
                }
                .carousel-shell {
                    position: relative;
                    margin: 0 -2px;
                }
                .carousel-track {
                    display: flex;
                    align-items: stretch;
                    gap: 18px;
                    overflow-x: auto;
                    scroll-snap-type: x mandatory;
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: none;
                    padding: 3px 2px 12px;
                }
                .carousel-track::-webkit-scrollbar {
                    display: none;
                }
                .card-slide {
                    flex: 0 0 min(78vw, 260px);
                    scroll-snap-align: start;
                    min-width: 0;
                    display: flex;
                }
                .rail-fade {
                    position: absolute;
                    top: 0;
                    bottom: 12px;
                    z-index: 2;
                    width: 70px;
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.22s ease;
                }
                .rail-fade.visible {
                    opacity: 1;
                }
                .rail-fade-left {
                    left: 0;
                    background: linear-gradient(90deg, #f7f5f0 0%, rgba(247,245,240,0) 100%);
                }
                .rail-fade-right {
                    right: 0;
                    background: linear-gradient(270deg, #f7f5f0 0%, rgba(247,245,240,0) 100%);
                }
                .homepage-section :global(.section-end-card) {
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-end;
                    width: 100%;
                    min-height: 100%;
                    padding: 18px;
                    overflow: hidden;
                    border: 1px solid rgba(184, 148, 95, 0.24);
                    border-radius: 14px;
                    background:
                        linear-gradient(145deg, rgba(31,27,21,0.96), rgba(64,52,36,0.92)),
                        #1f1b16;
                    color: #fff8ea !important;
                    text-decoration: none !important;
                    box-shadow: 0 16px 34px rgba(31, 27, 21, 0.16);
                    isolation: isolate;
                }
                .homepage-section :global(.section-end-card::before) {
                    content: '';
                    position: absolute;
                    inset: 10px;
                    border: 1px solid rgba(223, 193, 142, 0.18);
                    border-radius: 10px;
                    pointer-events: none;
                }
                .homepage-section :global(.end-card-kicker) {
                    color: #dfc18e;
                    font: 950 0.64rem/1 'Inter', sans-serif;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                }
                .homepage-section :global(.section-end-card strong) {
                    display: block;
                    margin-top: 12px;
                    color: #fff8ea;
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: clamp(1.1rem, 1.7vw, 1.55rem);
                    line-height: 1.05;
                    letter-spacing: 0;
                }
                .homepage-section :global(.section-end-card small) {
                    display: block;
                    margin-top: 9px;
                    color: rgba(255, 248, 234, 0.68);
                    font: 650 0.78rem/1.45 'Inter', sans-serif;
                }
                .homepage-section :global(.end-card-action) {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    margin-top: 18px;
                    color: #dfc18e;
                    font: 900 0.72rem/1 'Inter', sans-serif;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }
                .homepage-section :global(.property-card) {
                    box-shadow:
                        none;
                }

                @media (min-width: 600px) {
                    .card-slide {
                        flex-basis: min(32vw, 260px);
                    }
                }
                @media (min-width: 768px) {
                    .card-slide {
                        flex-basis: 250px;
                    }
                }
                @media (min-width: 1024px) {
                    .card-slide {
                        flex-basis: calc((100% - 54px) / 4);
                    }
                }
                @media (min-width: 1440px) {
                    .card-slide {
                        flex-basis: calc((100% - 90px) / 6);
                    }
                }
                @media (max-width: 760px) {
                    .homepage-section {
                        margin-bottom: 24px;
                        padding-top: 18px;
                    }
                    .section-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        margin-bottom: 10px;
                        gap: 10px;
                    }
                    .section-copy {
                        flex: 1;
                        min-width: 0;
                        gap: 8px;
                    }
                    .section-title {
                        font-size: clamp(0.96rem, 4.8vw, 1.23rem);
                        line-height: 1.02;
                    }
                    .section-header-right {
                        display: flex;
                        align-items: center;
                        justify-content: flex-end;
                        flex: 0 0 auto;
                        margin-top: 0;
                    }
                    .carousel-arrows {
                        gap: 5px;
                    }
                    .arrow-btn {
                        width: 30px;
                        height: 30px;
                        background: rgba(255, 255, 255, 0.86);
                        box-shadow: 0 8px 18px rgba(31, 27, 21, 0.08);
                    }
                    .arrow-btn :global(svg) {
                        width: 16px;
                        height: 16px;
                    }
                    .homepage-section :global(.section-view-all-mobile) {
                        display: inline-flex;
                        font-size: 0.62rem;
                    }
                    .carousel-track {
                        gap: 12px 10px;
                        padding-bottom: 6px;
                    }
                    .card-slide {
                        flex: 0 0 calc(50% - 5px);
                    }
                    .rail-fade {
                        display: none;
                    }
                    .homepage-section :global(.section-end-card) {
                        padding: 12px;
                        border-radius: 12px;
                    }
                    .homepage-section :global(.section-end-card strong) {
                        font-size: 1rem;
                    }
                    .homepage-section :global(.section-end-card small) {
                        display: none;
                    }
                    .homepage-section :global(.end-card-action) {
                        margin-top: 12px;
                        font-size: 0.58rem;
                    }
                }
            `}</style>
        </section>
    )
}
