'use client'

import { Fragment, type ReactNode, useEffect, useMemo, useState } from 'react'
import { Images, MapPinned, Navigation, PlayCircle, X } from 'lucide-react'
import PropertyLocationMap from '@/components/property/PropertyLocationMap'
import PropertyVideoEmbed, { getPropertyVideoSource } from '@/components/property/PropertyVideoEmbed'
import { trackEvent } from '@/lib/tracking/client'

const GOOGLE_STATIC_PREVIEW_SIZE = '320x190'

type PropertyMediaMapProperty = {
    id: string
    title: string
    description?: string | null
    seo_title?: string | null
    seo_description?: string | null
    city?: string | null
    state?: string | null
    neighborhood?: string | null
    price?: number | null
    bedrooms?: number | null
    suites?: number | null
    area_m2?: number | null
    area_private_m2?: number | null
    property_type?: string | null
    exclusive?: boolean | null
}

type MediaItem =
    | {
        type: 'photo'
        src: string
        label: string
        photoIndex: number
    }
    | {
        type: 'video'
        label: string
        videoUrl: string
        thumbnailUrl?: string
    }
    | {
        type: 'street'
        label: string
    }
    | {
        type: 'map'
        label: string
    }

type PropertyDesktopMediaShowcaseProps = {
    images: string[]
    videoUrl?: string | null
    title: string
    property: PropertyMediaMapProperty
    latLng?: [number, number] | null
    metadata?: Record<string, unknown>
    shareSlot?: ReactNode
}

function buildStaticPreviewUrl(type: 'street' | 'map', latLng?: [number, number] | null) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey || !latLng) return null

    const [lat, lng] = latLng
    const coordinate = `${lat},${lng}`

    if (type === 'street') {
        const params = new URLSearchParams({
            size: GOOGLE_STATIC_PREVIEW_SIZE,
            location: coordinate,
            fov: '80',
            heading: '0',
            pitch: '0',
            source: 'outdoor',
            key: apiKey,
        })

        return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`
    }

    const params = new URLSearchParams({
        center: coordinate,
        zoom: '16',
        size: GOOGLE_STATIC_PREVIEW_SIZE,
        scale: '2',
        maptype: 'roadmap',
        markers: `color:0xBD9551|${coordinate}`,
        key: apiKey,
    })
    params.append('style', 'feature:poi|visibility:off')
    params.append('style', 'feature:transit|visibility:off')
    params.append('style', 'feature:road|element:labels|visibility:simplified')

    return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
}

function StaticMediaThumbnail({
    type,
    latLng,
    title,
}: {
    type: 'street' | 'map'
    latLng?: [number, number] | null
    title: string
}) {
    const [failed, setFailed] = useState(false)
    const previewUrl = useMemo(() => buildStaticPreviewUrl(type, latLng), [latLng, type])
    const label = type === 'street' ? 'Street View' : 'Mapa'
    const Icon = type === 'street' ? Navigation : MapPinned

    return (
        <span className={`plp-desktop-media-thumb-preview ${failed || !previewUrl ? 'is-fallback' : ''}`}>
            {previewUrl && !failed ? (
                <img
                    src={previewUrl}
                    alt={`${label} de ${title}`}
                    loading="lazy"
                    onError={() => setFailed(true)}
                />
            ) : (
                <span className="plp-desktop-media-thumb-preview-fallback" aria-hidden="true">
                    <Icon size={22} />
                </span>
            )}
            <span className="plp-desktop-media-thumb-preview-label">
                <Icon size={13} />
                {label}
            </span>
        </span>
    )
}

function VideoMediaThumbnail({
    thumbnailUrl,
    title,
}: {
    thumbnailUrl?: string
    title: string
}) {
    return (
        <span className={`plp-desktop-media-thumb-preview plp-desktop-media-thumb-preview--video ${thumbnailUrl ? '' : 'is-fallback'}`.trim()}>
            {thumbnailUrl && (
                <img src={thumbnailUrl} alt={`${title} - vídeo`} loading="lazy" />
            )}
            <span className="plp-desktop-media-thumb-preview-fallback" aria-hidden="true">
                <PlayCircle size={24} />
            </span>
            <span className="plp-desktop-media-thumb-preview-label">
                <PlayCircle size={13} />
                Vídeo
            </span>
        </span>
    )
}

export default function PropertyDesktopMediaShowcase({
    images,
    videoUrl,
    title,
    property,
    latLng,
    metadata,
    shareSlot,
}: PropertyDesktopMediaShowcaseProps) {
    const gallery = useMemo(() => Array.from(new Set((images || []).filter(Boolean))), [images])
    const videoSource = useMemo(() => getPropertyVideoSource(videoUrl), [videoUrl])
    const mediaItems = useMemo<MediaItem[]>(() => {
        const photoItems: MediaItem[] = gallery.map((src, index) => ({
            type: 'photo',
            src,
            label: index === 0 ? 'Foto principal' : `Foto ${index + 1}`,
            photoIndex: index,
        }))
        const videoItem: MediaItem | null = videoSource ? {
            type: 'video',
            label: 'Vídeo do imóvel',
            videoUrl: videoSource.url,
            thumbnailUrl: videoSource.thumbnailUrl,
        } : null
        const items: MediaItem[] = []

        if (photoItems[0]) items.push(photoItems[0])

        if (latLng) {
            items.push({
                type: 'street',
                label: 'Street View',
            })
            items.push({
                type: 'map',
                label: 'Mapa',
            })
        }

        if (videoItem) items.push(videoItem)
        items.push(...photoItems.slice(1))

        return items
    }, [gallery, latLng, videoSource])
    const modalMediaItems = useMemo(() => mediaItems.filter(item => item.type !== 'map'), [mediaItems])

    const [activeMediaIndex, setActiveMediaIndex] = useState(0)
    const [activePhotoIndex, setActivePhotoIndex] = useState(0)
    const [isOpen, setIsOpen] = useState(false)

    const activeMedia = mediaItems[Math.min(activeMediaIndex, Math.max(mediaItems.length - 1, 0))]

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
                .querySelector(`[data-plp-gallery-image="${activePhotoIndex}"]`)
                ?.scrollIntoView({ block: 'start' })
        })

        return () => {
            document.body.style.overflow = originalOverflow
            window.removeEventListener('keydown', onKeyDown)
        }
    }, [activePhotoIndex, isOpen])

    if (!mediaItems.length || !gallery.length) return null

    const openGallery = (index = 0) => {
        setActivePhotoIndex(index)
        setIsOpen(true)
        void trackEvent('property_details_landing_gallery_opened', {
            ...metadata,
            image_index: index,
            gallery_count: gallery.length,
            source: 'property_desktop_media_showcase',
        })
    }

    const selectMedia = (item: MediaItem, index: number) => {
        setActiveMediaIndex(index)
        if (item.type === 'photo') setActivePhotoIndex(item.photoIndex)

        void trackEvent('property_desktop_media_selected', {
            ...metadata,
            media_type: item.type,
            media_index: index,
            photo_index: item.type === 'photo' ? item.photoIndex : null,
        })
    }

    const renderMedia = () => {
        if (activeMedia.type === 'photo') {
            return (
                <button
                    type="button"
                    className="plp-desktop-media-photo"
                    onClick={() => openGallery(activeMedia.photoIndex)}
                    aria-label="Abrir galeria de fotos"
                >
                    <img src={activeMedia.src} alt={`${title} - ${activeMedia.label}`} />
                </button>
            )
        }

        if (activeMedia.type === 'video') {
            return (
                <div className="plp-desktop-media-video">
                    <span className="plp-desktop-media-chip">
                        <PlayCircle size={15} />
                        Vídeo do imóvel
                    </span>
                    <PropertyVideoEmbed
                        videoUrl={activeMedia.videoUrl}
                        title={title}
                        poster={gallery[0]}
                    />
                </div>
            )
        }

        if (!latLng) return null

        if (activeMedia.type === 'street') {
            return (
                <div className="plp-desktop-media-map plp-desktop-media-map--street">
                    <span className="plp-desktop-media-chip">
                        <Navigation size={15} />
                        Street View do entorno
                    </span>
                    <PropertyLocationMap
                        property={property}
                        latLng={latLng}
                        initialView="street"
                        allowedViews={['street']}
                        showViewControl={false}
                    />
                </div>
            )
        }

        return (
            <div className="plp-desktop-media-map">
                <span className="plp-desktop-media-chip">
                    <MapPinned size={15} />
                    Mapa do entorno
                </span>
                <PropertyLocationMap
                    property={property}
                    latLng={latLng}
                    initialView="luxury"
                    allowedViews={['luxury']}
                    showViewControl={false}
                />
            </div>
        )
    }

    return (
        <>
            <div className="plp-desktop-media-showcase">
                <div className="plp-gallery-top-bar plp-desktop-media-top-bar">
                    <button type="button" className="plp-gallery-view-btn-top" onClick={() => openGallery()}>
                        <Images size={13} /> Fotos
                        {gallery.length > 1 && <span className="plp-gallery-count">{gallery.length}</span>}
                    </button>
                    {shareSlot && <Fragment key="share-slot">{shareSlot}</Fragment>}
                </div>

                <div className="plp-desktop-media-stage">
                    <div className="plp-desktop-media-main">
                        {renderMedia()}
                    </div>

                    <div className="plp-desktop-media-rail" aria-label="Navegar por fotos, Street View e mapa">
                        {mediaItems.map((item, index) => (
                            <button
                                type="button"
                                key={`${item.type}-${item.type === 'photo' ? item.src : item.label}-${index}`}
                                className={`plp-desktop-media-thumb ${index === activeMediaIndex ? 'active' : ''}`}
                                onClick={() => selectMedia(item, index)}
                                aria-pressed={index === activeMediaIndex}
                                aria-label={`Ver ${item.label}`}
                            >
                                {item.type === 'photo' ? (
                                    <img src={item.src} alt={`${title} - ${item.label}`} loading={index < 4 ? 'eager' : 'lazy'} />
                                ) : item.type === 'video' ? (
                                    <VideoMediaThumbnail thumbnailUrl={item.thumbnailUrl} title={title} />
                                ) : (
                                    <StaticMediaThumbnail type={item.type} latLng={latLng} title={title} />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {isOpen && (
                <div className="plp-gallery-modal-backdrop" role="presentation" onClick={() => setIsOpen(false)}>
                    <section
                        className="plp-gallery-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Galeria de fotos do imóvel"
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
                            {modalMediaItems.map((item, index) => {
                                if (item.type === 'photo') {
                                    return (
                                        <figure
                                            key={`modal-photo-${item.src}-${item.photoIndex}`}
                                            className="plp-gallery-modal-item"
                                            data-plp-gallery-image={item.photoIndex}
                                        >
                                            <img
                                                src={item.src}
                                                alt={`${title} - foto ${item.photoIndex + 1}`}
                                                loading={index < 2 ? 'eager' : 'lazy'}
                                            />
                                        </figure>
                                    )
                                }

                                if (item.type === 'video') {
                                    return (
                                        <figure
                                            key={`modal-video-${item.videoUrl}`}
                                            className="plp-gallery-modal-item plp-gallery-modal-item--video"
                                        >
                                            <span className="plp-gallery-modal-video-chip">
                                                <PlayCircle size={15} />
                                                Vídeo do imóvel
                                            </span>
                                            <PropertyVideoEmbed
                                                videoUrl={item.videoUrl}
                                                title={title}
                                                poster={gallery[0]}
                                            />
                                        </figure>
                                    )
                                }

                                if (!latLng) return null

                                return (
                                    <figure
                                        key="modal-street-view"
                                        className="plp-gallery-modal-item plp-gallery-modal-item--map plp-gallery-modal-map"
                                    >
                                        <span className="plp-gallery-modal-map-chip">
                                            <Navigation size={15} />
                                            Street View do entorno
                                        </span>
                                        <PropertyLocationMap
                                            property={property}
                                            latLng={latLng}
                                            initialView="street"
                                            allowedViews={['street']}
                                            showViewControl={false}
                                        />
                                    </figure>
                                )
                            })}
                        </div>
                    </section>
                </div>
            )}
        </>
    )
}
