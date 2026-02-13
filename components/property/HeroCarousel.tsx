'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Play, Grid } from 'lucide-react'

interface HeroCarouselProps {
    images: string[]
    title: string
    videoUrl?: string | null
    gallerySectionId?: string
    initialIndex?: number
}

function extractYouTubeId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ]
    for (const p of patterns) {
        const m = url.match(p)
        if (m) return m[1]
    }
    return null
}

export default function HeroCarousel({ images, title, videoUrl, gallerySectionId, initialIndex = 0 }: HeroCarouselProps) {
    const [current, setCurrent] = useState(initialIndex)
    const [videoPlaying, setVideoPlaying] = useState(false)

    // Drag/Swipe state
    const [isDragging, setIsDragging] = useState(false)
    const [startX, setStartX] = useState(0)
    const [translateX, setTranslateX] = useState(0) // Pixel offset during drag
    const carouselRef = useRef<HTMLDivElement>(null)

    // Build slides: images + optional video as last slide
    const hasVideo = videoUrl && extractYouTubeId(videoUrl)
    const totalSlides = images.length + (hasVideo ? 1 : 0)

    if (images.length === 0 && !hasVideo) return null

    const goTo = useCallback((idx: number) => {
        setCurrent(idx)
        setVideoPlaying(false)
    }, [])

    const prev = useCallback(() => {
        setCurrent(i => (i === 0 ? totalSlides - 1 : i - 1))
        setVideoPlaying(false)
    }, [totalSlides])

    const next = useCallback(() => {
        setCurrent(i => (i === totalSlides - 1 ? 0 : i + 1))
        setVideoPlaying(false)
    }, [totalSlides])

    // --- DRAG HANDLERS ---
    const handleDragStart = (clientX: number) => {
        setIsDragging(true)
        setStartX(clientX)
        setVideoPlaying(false)
    }

    const handleDragMove = (clientX: number) => {
        if (!isDragging) return
        const diff = clientX - startX
        setTranslateX(diff)
    }

    const handleDragEnd = () => {
        if (!isDragging) return
        setIsDragging(false)
        const threshold = 100 // Minimum drag distance to swap slide

        if (translateX > threshold) {
            prev()
        } else if (translateX < -threshold) {
            next()
        }

        setTranslateX(0)
    }

    // Mouse events
    const onMouseDown = (e: React.MouseEvent) => {
        e.preventDefault() // Prevent image drag behavior
        handleDragStart(e.clientX)
    }
    const onMouseMove = (e: React.MouseEvent) => handleDragMove(e.clientX)
    const onMouseUp = () => handleDragEnd()
    const onMouseLeave = () => {
        if (isDragging) handleDragEnd()
    }

    // Touch events
    const onTouchStart = (e: React.TouchEvent) => handleDragStart(e.touches[0].clientX)
    const onTouchMove = (e: React.TouchEvent) => handleDragMove(e.touches[0].clientX)
    const onTouchEnd = () => handleDragEnd()

    const isVideoSlide = hasVideo && current === images.length
    const youtubeId = videoUrl ? extractYouTubeId(videoUrl) : null

    const handleViewGallery = () => {
        if (gallerySectionId) {
            document.getElementById(gallerySectionId)?.scrollIntoView({ behavior: 'smooth' })
        }
    }

    return (
        <div
            className="hero-carousel"
            ref={carouselRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
            {/* Sliding track */}
            <div
                className="hero-carousel-track"
                style={{
                    transform: `translateX(calc(-${current * 100}% + ${translateX}px))`,
                    transition: isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)'
                }}
            >
                {images.map((img, idx) => (
                    <div key={idx} className="hero-carousel-slide">
                        <img
                            src={img}
                            alt={`${title} - Foto ${idx + 1}`}
                            className="hero-carousel-img"
                            loading={idx === 0 ? 'eager' : 'lazy'}
                            draggable={false}
                        />
                    </div>
                ))}
                {hasVideo && youtubeId && (
                    <div className="hero-carousel-slide hero-video-slide">
                        {videoPlaying ? (
                            <iframe
                                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`}
                                className="hero-video-iframe"
                                allow="autoplay; encrypted-media"
                                allowFullScreen
                                title={`${title} - Vídeo`}
                            />
                        ) : (
                            <div
                                className="hero-video-thumbnail"
                                onClick={(e) => {
                                    e.stopPropagation() // Prevent drag start
                                    setVideoPlaying(true)
                                }}
                            >
                                <img
                                    src={`https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`}
                                    alt={`${title} - Vídeo`}
                                    className="hero-carousel-img"
                                    draggable={false}
                                />
                                <div className="hero-video-play-overlay">
                                    <div className="hero-video-play-btn">
                                        <Play size={32} fill="#fff" />
                                    </div>
                                    <span className="hero-video-label">Assistir Vídeo</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom gradient: image → page background */}
            {!isVideoSlide && <div className="hero-bottom-fade" />}

            {/* Navigation arrows (desktop) */}
            {totalSlides > 1 && (
                <>
                    <button
                        className="hero-carousel-arrow hero-arrow-left"
                        onClick={(e) => { e.stopPropagation(); prev(); }}
                        aria-label="Foto anterior"
                    >
                        <ChevronLeft size={22} />
                    </button>
                    <button
                        className="hero-carousel-arrow hero-arrow-right"
                        onClick={(e) => { e.stopPropagation(); next(); }}
                        aria-label="Próxima foto"
                    >
                        <ChevronRight size={22} />
                    </button>
                </>
            )}

            {/* View Photos Button */}
            {gallerySectionId && (
                <button
                    className="hero-view-photos-btn"
                    onClick={(e) => { e.stopPropagation(); handleViewGallery(); }}
                >
                    <Grid size={16} />
                    <span>Ver fotos</span>
                </button>
            )}

            {/* Dots */}
            {totalSlides > 1 && (
                <div className="hero-carousel-dots">
                    {Array.from({ length: totalSlides }).map((_, idx) => (
                        <button
                            key={idx}
                            className={`hero-dot ${idx === current ? 'active' : ''} ${idx === images.length && hasVideo ? 'video-dot' : ''}`}
                            onClick={(e) => { e.stopPropagation(); goTo(idx); }}
                            aria-label={idx === images.length && hasVideo ? 'Vídeo' : `Foto ${idx + 1}`}
                        />
                    ))}
                </div>
            )}

            {/* Counter */}
            {totalSlides > 1 && (
                <div className="hero-carousel-counter">
                    {isVideoSlide ? '🎬 Vídeo' : `${current + 1} / ${images.length}`}
                </div>
            )}

            <style jsx>{`
                .hero-carousel {
                    position: absolute;
                    inset: 0;
                    overflow: hidden;
                    touch-action: pan-y;
                    user-select: none;
                }

                .hero-carousel-track {
                    display: flex;
                    width: 100%;
                    height: 100%;
                    will-change: transform;
                }

                .hero-carousel-slide {
                    flex: 0 0 100%;
                    width: 100%;
                    height: 100%;
                    position: relative;
                }

                .hero-carousel-img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                    pointer-events: none; /* Prevent browser image drag */
                }

                /* Bottom fade: image → page background */
                .hero-bottom-fade {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 160px;
                    background: linear-gradient(
                        to bottom,
                        rgba(247, 247, 245, 0) 0%,
                        rgba(247, 247, 245, 0.15) 25%,
                        rgba(247, 247, 245, 0.45) 50%,
                        rgba(247, 247, 245, 0.8) 75%,
                        #f7f7f5 100%
                    );
                    z-index: 4;
                    pointer-events: none;
                }

                /* === VIDEO SLIDE === */
                .hero-video-slide {
                    background: #0a0a0a;
                }

                .hero-video-iframe {
                    width: 100%;
                    height: 100%;
                    border: none;
                }

                .hero-video-thumbnail {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    cursor: pointer;
                }

                .hero-video-play-overlay {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    background: rgba(0, 0, 0, 0.35);
                    transition: background 0.3s;
                }

                .hero-video-thumbnail:hover .hero-video-play-overlay {
                    background: rgba(0, 0, 0, 0.5);
                }

                .hero-video-play-btn {
                    width: 72px;
                    height: 72px;
                    border-radius: 50%;
                    background: rgba(184, 148, 95, 0.9);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
                    transition: transform 0.3s, background 0.3s;
                    padding-left: 4px;
                }

                .hero-video-thumbnail:hover .hero-video-play-btn {
                    transform: scale(1.1);
                    background: rgba(184, 148, 95, 1);
                }

                .hero-video-label {
                    color: #fff;
                    font-size: 0.85rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                    text-shadow: 0 1px 4px rgba(0,0,0,0.5);
                }

                /* Arrows */
                .hero-carousel-arrow {
                    position: absolute;
                    top: 50%;
                    transform: translateY(-50%);
                    z-index: 10;
                    background: rgba(255, 255, 255, 0.92);
                    border: none;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: #1a1a1a;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.15);
                    transition: transform 0.2s, box-shadow 0.2s, opacity 0.3s;
                    opacity: 0;
                }
                .hero-carousel:hover .hero-carousel-arrow {
                    opacity: 1;
                }
                .hero-carousel-arrow:hover {
                    transform: translateY(-50%) scale(1.1);
                    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
                }
                .hero-arrow-left { left: 16px; }
                .hero-arrow-right { right: 16px; }

                /* View Photos Button */
                .hero-view-photos-btn {
                    position: absolute;
                    bottom: 24px;
                    right: 24px;
                    z-index: 10;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: rgba(255, 255, 255, 0.9);
                    backdrop-filter: blur(8px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 10px 18px;
                    border-radius: 50px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #1a1a1a;
                    cursor: pointer;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    transition: all 0.2s ease;
                }
                .hero-view-photos-btn:hover {
                    background: #fff;
                    transform: scale(1.05);
                    box-shadow: 0 4px 15px rgba(0,0,0,0.15);
                }

                /* Dots */
                .hero-carousel-dots {
                    position: absolute;
                    bottom: 24px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    gap: 8px;
                    z-index: 10;
                }
                .hero-dot {
                    width: 8px;
                    height: 8px;
                    background: rgba(255, 255, 255, 0.45);
                    border: none;
                    border-radius: 50%;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    padding: 0;
                }
                .hero-dot.active {
                    background: #fff;
                    transform: scale(1.3);
                    box-shadow: 0 0 8px rgba(255,255,255,0.5);
                }
                .hero-dot.video-dot {
                    border-radius: 4px;
                    width: 18px;
                    height: 8px;
                }
                .hero-dot.video-dot.active {
                    background: #b8945f;
                }
                .hero-dot:hover:not(.active) {
                    background: rgba(255,255,255,0.75);
                }

                /* Counter */
                .hero-carousel-counter {
                    position: absolute;
                    bottom: 24px;
                    left: 24px;
                    z-index: 10;
                    background: rgba(0,0,0,0.5);
                    color: #fff;
                    padding: 6px 14px;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    backdrop-filter: blur(6px);
                    -webkit-backdrop-filter: blur(6px);
                }

                @media (max-width: 768px) {
                    .hero-carousel-arrow { display: none; } /* Hide arrows on mobile since specific drag is available */
                    .hero-arrow-left { left: 10px; }
                    .hero-arrow-right { right: 10px; }
                    .hero-carousel-dots { bottom: 16px; }
                    .hero-carousel-counter { bottom: 16px; left: 16px; }
                    .hero-view-photos-btn { bottom: 16px; right: 16px; padding: 8px 14px; font-size: 0.8rem; }
                    .hero-video-play-btn { width: 56px; height: 56px; }
                    .hero-bottom-fade { height: 120px; }
                }
            `}</style>
        </div>
    )
}
