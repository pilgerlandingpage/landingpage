'use client'

import { useEffect, useMemo, useState } from 'react'
import { Camera, Images, X } from 'lucide-react'
import { trackEvent } from '@/lib/tracking/client'

type PropertyPhotoShowcaseProps = {
    images: string[]
    title: string
    metadata?: Record<string, unknown>
}

export default function PropertyPhotoShowcase({ images, title, metadata }: PropertyPhotoShowcaseProps) {
    const gallery = useMemo(() => Array.from(new Set((images || []).filter(Boolean))), [images])
    const [activeIndex, setActiveIndex] = useState(0)
    const [isOpen, setIsOpen] = useState(false)

    const activeImage = gallery[activeIndex] || gallery[0]
    const visibleThumbs = gallery.slice(1, 6)

    useEffect(() => {
        if (!isOpen) return

        const originalOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false)
        }

        window.addEventListener('keydown', onKeyDown)
        requestAnimationFrame(() => {
            document
                .querySelector(`[data-plp-gallery-image="${activeIndex}"]`)
                ?.scrollIntoView({ block: 'start' })
        })

        return () => {
            document.body.style.overflow = originalOverflow
            window.removeEventListener('keydown', onKeyDown)
        }
    }, [activeIndex, isOpen])

    if (!gallery.length) return null

    const openGallery = (index = activeIndex) => {
        setActiveIndex(index)
        setIsOpen(true)
        void trackEvent('property_details_landing_gallery_opened', {
            ...metadata,
            image_index: index,
            gallery_count: gallery.length,
        })
    }

    const previewImage = (index: number) => {
        setActiveIndex(index)
    }

    return (
        <>
            <div className={`plp-gallery-composer ${gallery.length <= 1 ? 'single' : ''}`}>
                <button type="button" className="plp-main-photo" onClick={() => openGallery(activeIndex)} aria-label="Ver galeria de fotos">
                    <img src={activeImage} alt={title} />
                    <span className="plp-photo-badge"><Camera size={16} /> {gallery.length} fotos</span>
                    <span className="plp-gallery-view-button"><Images size={17} /> Ver galeria</span>
                </button>

                {gallery.length > 1 && (
                    <div className="plp-thumb-rail" aria-label="Previa de fotos">
                        {visibleThumbs.map((image, index) => {
                            const imageIndex = index + 1
                            return (
                                <button
                                    type="button"
                                    key={`${image}-${imageIndex}`}
                                    className={`plp-thumb-item ${activeIndex === imageIndex ? 'active' : ''}`}
                                    onClick={() => previewImage(imageIndex)}
                                    aria-label={`Ver foto ${imageIndex + 1}`}
                                >
                                    <img src={image} alt={`${title} - previa ${imageIndex + 1}`} loading="lazy" />
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {isOpen && (
                <div className="plp-gallery-modal-backdrop" role="presentation" onClick={() => setIsOpen(false)}>
                    <section
                        className="plp-gallery-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Galeria de fotos do imovel"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <header className="plp-gallery-modal-header">
                            <div>
                                <span>Galeria do imovel</span>
                                <strong>{title}</strong>
                                <small>{gallery.length} fotos</small>
                            </div>
                            <button type="button" onClick={() => setIsOpen(false)} aria-label="Fechar galeria">
                                <X size={21} />
                            </button>
                        </header>

                        <div className="plp-gallery-modal-scroll">
                            {gallery.map((image, index) => (
                                <figure key={`${image}-${index}`} className="plp-gallery-modal-item" data-plp-gallery-image={index}>
                                    <img src={image} alt={`${title} - foto ${index + 1}`} loading={index < 2 ? 'eager' : 'lazy'} />
                                    <figcaption>Foto {index + 1} de {gallery.length}</figcaption>
                                </figure>
                            ))}
                        </div>
                    </section>
                </div>
            )}
        </>
    )
}
