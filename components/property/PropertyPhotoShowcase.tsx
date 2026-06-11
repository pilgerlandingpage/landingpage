'use client'

import { Fragment, type ReactNode, useEffect, useMemo, useState } from 'react'
import { Heart, Images, X } from 'lucide-react'
import { trackEvent } from '@/lib/tracking/client'

type PropertyPhotoShowcaseProps = {
    images: string[]
    title: string
    metadata?: Record<string, unknown>
    shareSlot?: ReactNode
}

export default function PropertyPhotoShowcase({ images, title, metadata, shareSlot }: PropertyPhotoShowcaseProps) {
    const gallery = useMemo(() => Array.from(new Set((images || []).filter(Boolean))), [images])
    const [activeIndex, setActiveIndex] = useState(0)
    const [isOpen, setIsOpen] = useState(false)
    const [isFavorited, setIsFavorited] = useState(false)

    const activeImage = gallery[0]

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

    const openGallery = (index = 0) => {
        setActiveIndex(index)
        setIsOpen(true)
        void trackEvent('property_details_landing_gallery_opened', {
            ...metadata,
            image_index: index,
            gallery_count: gallery.length,
        })
    }

    return (
        <>
            <div className="plp-gallery-top-bar">
                <button type="button" className="plp-gallery-view-btn-top" onClick={() => openGallery()}>
                    <Images size={13} /> Fotos
                    {gallery.length > 1 && <span className="plp-gallery-count">{gallery.length}</span>}
                </button>
                {shareSlot && <Fragment key="share-slot">{shareSlot}</Fragment>}
            </div>

            <div className="plp-gallery-composer single">
                <button type="button" className="plp-main-photo" onClick={() => openGallery()} aria-label="Ver galeria de fotos">
                    <img src={activeImage} alt={title} />
                </button>
                <button
                    type="button"
                    className={`plp-favorite-btn${isFavorited ? ' active' : ''}`}
                    onClick={() => setIsFavorited(prev => !prev)}
                    aria-label={isFavorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                >
                    <Heart size={16} fill={isFavorited ? 'currentColor' : 'none'} />
                </button>
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
                                <strong>{title}</strong>
                            </div>
                            <button type="button" onClick={() => setIsOpen(false)} aria-label="Fechar galeria">
                                <X size={21} />
                            </button>
                        </header>

                        <div className="plp-gallery-modal-scroll">
                            {gallery.map((image, index) => (
                                <figure key={`${image}-${index}`} className="plp-gallery-modal-item" data-plp-gallery-image={index}>
                                    <img src={image} alt={`${title} - foto ${index + 1}`} loading={index < 2 ? 'eager' : 'lazy'} />
                                </figure>
                            ))}
                        </div>
                    </section>
                </div>
            )}
        </>
    )
}
