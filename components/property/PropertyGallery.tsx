'use client'
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import HeroCarousel from './HeroCarousel'

interface PropertyGalleryProps {
    images: string[]
    title: string
}

export default function PropertyGallery({ images, title }: PropertyGalleryProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [currentIndex, setCurrentIndex] = useState(0)

    const openLightbox = (index: number) => {
        setCurrentIndex(index)
        setIsOpen(true)
        document.body.style.overflow = 'hidden' // Prevent background scrolling
    }

    const closeLightbox = () => {
        setIsOpen(false)
        document.body.style.overflow = 'auto'
    }

    // Handle ESC key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeLightbox()
        }
        if (isOpen) window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen])

    return (
        <>
            <div className="pd-gallery-grid">
                {images.map((img, idx) => (
                    <div
                        key={idx}
                        className="pd-gallery-item"
                        onClick={() => openLightbox(idx)}
                        role="button"
                        tabIndex={0}
                        aria-label={`Ver foto ${idx + 1} em tela cheia`}
                    >
                        <img src={img} alt={`${title} - Foto ${idx + 1}`} loading="lazy" />
                        <div className="pd-gallery-overlay">
                            <span>Ampliar</span>
                        </div>
                    </div>
                ))}
            </div>

            {isOpen && (
                <div className="lightbox-overlay">
                    <button className="lightbox-close-btn" onClick={closeLightbox} aria-label="Fechar galeria">
                        <X size={32} />
                    </button>
                    <div className="lightbox-content">
                        <HeroCarousel
                            images={images}
                            title={title}
                            initialIndex={currentIndex}
                        // No videoUrl passed here to keep it simple, or pass it if desired
                        // No gallerySectionId passed here to hide the "Ver fotos" button
                        />
                    </div>
                </div>
            )}

            <style jsx>{`
                .pd-gallery-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 12px;
                }
                
                .pd-gallery-item {
                    aspect-ratio: 16/11;
                    border-radius: 14px;
                    overflow: hidden;
                    cursor: pointer;
                    position: relative;
                }

                .pd-gallery-item img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 0.5s ease;
                }

                .pd-gallery-item:hover img {
                    transform: scale(1.06);
                }

                .pd-gallery-overlay {
                    position: absolute;
                    inset: 0;
                    background: rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    transition: opacity 0.3s;
                }

                .pd-gallery-overlay span {
                    color: #fff;
                    font-weight: 600;
                    padding: 8px 16px;
                    border: 1px solid rgba(255,255,255,0.5);
                    border-radius: 20px;
                    backdrop-filter: blur(4px);
                }

                .pd-gallery-item:hover .pd-gallery-overlay {
                    opacity: 1;
                }

                /* === LIGHTBOX === */
                .lightbox-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 9999;
                    background: #000;
                    display: flex;
                    flex-direction: column;
                    animation: fadeIn 0.3s ease;
                }

                .lightbox-content {
                    flex: 1;
                    position: relative;
                    width: 100%;
                    height: 100%;
                }

                .lightbox-close-btn {
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    background: rgba(0,0,0,0.5);
                    border: none;
                    color: #fff;
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .lightbox-close-btn:hover {
                    background: rgba(255,255,255,0.2);
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @media (min-width: 1024px) {
                    .pd-gallery-grid { grid-template-columns: repeat(3, 1fr); gap: 16px; }
                }

                @media (min-width: 1440px) {
                    .pd-gallery-grid { grid-template-columns: repeat(4, 1fr); }
                }
            `}</style>
        </>
    )
}
