'use client'

import { type SyntheticEvent, type TouchEvent } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

type Props = {
    images: string[]
    currentImage: string
    index: number
    title: string
    onClose: () => void
    onNext: () => void
    onPrev: () => void
    onTouchStart: (e: TouchEvent<HTMLDivElement>) => void
    onTouchEnd: (e: TouchEvent<HTMLDivElement>) => void
    onImageError: (e: SyntheticEvent<HTMLImageElement>) => void
}

export default function PropertyGalleryModal({
    images,
    currentImage,
    index,
    title,
    onClose,
    onNext,
    onPrev,
    onTouchStart,
    onTouchEnd,
    onImageError,
}: Props) {
    return (
        <div
            className="property-gallery-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Galeria do imóvel"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
        >
            <button className="property-gallery-close" type="button" onClick={onClose} aria-label="Fechar galeria">
                <X size={26} />
            </button>
            <button className="property-gallery-nav prev" type="button" onClick={onPrev} aria-label="Foto anterior">
                <ChevronLeft size={30} />
            </button>
            <img
                src={currentImage}
                alt={`${title} - foto ampliada`}
                onError={onImageError}
            />
            <button className="property-gallery-nav next" type="button" onClick={onNext} aria-label="Próxima foto">
                <ChevronRight size={30} />
            </button>
            <div className="property-gallery-counter">
                {index + 1} / {images.length}
            </div>
        </div>
    )
}
