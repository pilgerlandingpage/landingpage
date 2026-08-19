'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
    MouseEvent as ReactMouseEvent,
    PointerEvent as ReactPointerEvent,
    UIEvent as ReactUIEvent,
} from 'react'
import { ArrowRight, BedDouble, Camera, Car, ChevronLeft, ChevronRight, MapPin, Ruler, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { displayLocationName, replaceItajaiWithPraiaBrava } from '@/lib/locations/display'
import { isPlainLeftClick, openPropertyDestinationOnDesktopClick, propertyDetailsPath } from '@/lib/properties/responsive-destination'
import { getPropertyPrimaryQualityLabel } from '@/lib/properties/intelligence'
import { trackEvent } from '@/lib/tracking/client'

type PreviewProperty = {
    id: string
    source_slug?: string | null
    slug?: string | null
    title: string
    city?: string | null
    state?: string | null
    neighborhood?: string | null
    price?: number | null
    featured_image?: string | null
    images?: string[] | null
    bedrooms?: number | null
    bathrooms?: number | null
    suites?: number | null
    parking_spaces?: number | null
    area_m2?: number | null
    area_private_m2?: number | null
    property_type?: string | null
    description?: string | null
    source_status?: string | null
    exclusive?: boolean | null
    video_url?: string | null
    amenities?: string[] | null
}

type MapPropertyPreviewCardProps = {
    property: PreviewProperty
    properties?: PreviewProperty[]
    selectedPropertyId?: string | null
    onPropertySelect?: (property: PreviewProperty, source: string) => void
    onClose: () => void
}

const FALLBACK_IMAGE = '/images/brava-concetto/20_CL_BC_LIVING_FINAL_01_ANG_02_EF_web.jpg'
const SWIPE_THRESHOLD = 36
const DESKTOP_DRAG_THRESHOLD = 5
const DESKTOP_DRAG_SNAP_THRESHOLD = 24

function formatPrice(price?: number | null) {
    if (!price) return 'Sob consulta'

    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
    }).format(price)
}

function compactNumber(value?: number | null) {
    if (!value) return ''
    return value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

function galleryFor(property: PreviewProperty) {
    const images = [property.featured_image, ...(property.images || [])]
        .filter((item): item is string => Boolean(item))

    return Array.from(new Set(images.length ? images : [FALLBACK_IMAGE])).slice(0, 12)
}

function getBadges(property: PreviewProperty) {
    return [getPropertyPrimaryQualityLabel(property).label]
}

function uniqueProperties(properties: PreviewProperty[] | undefined, fallback: PreviewProperty) {
    const source = properties?.length ? properties : [fallback]
    const seen = new Set<string>()
    const unique: PreviewProperty[] = []

    for (const item of source) {
        if (!item?.id || seen.has(item.id)) continue
        seen.add(item.id)
        unique.push(item)
    }

    if (!seen.has(fallback.id)) unique.unshift(fallback)

    return unique
}

function previewMetaFor(property: PreviewProperty) {
    const displayTitle = replaceItajaiWithPraiaBrava(property.title || 'Imóvel selecionado')
    const displayCity = displayLocationName(property.city)
    const displayNeighborhood = replaceItajaiWithPraiaBrava(property.neighborhood)
    const location = [displayNeighborhood, displayCity, property.state].filter(Boolean).join(' - ')
    const area = property.area_private_m2 || property.area_m2 || null
    const roomStat = property.suites
        ? { key: 'suites', icon: BedDouble, label: `${property.suites} suítes` }
        : property.bedrooms
            ? { key: 'beds', icon: BedDouble, label: `${property.bedrooms} dorm.` }
            : null
    const stats = [
        roomStat,
        property.parking_spaces ? { key: 'parking', icon: Car, label: `${property.parking_spaces} vagas` } : null,
        area ? { key: 'area', icon: Ruler, label: `${compactNumber(area)} m²` } : null,
    ].filter(Boolean) as Array<{ key: string; icon: typeof BedDouble; label: string }>

    return {
        detailsHref: propertyDetailsPath(property),
        displayCity,
        displayNeighborhood,
        displayTitle,
        location,
        stats,
    }
}

export default function MapPropertyPreviewCard({
    property,
    properties,
    selectedPropertyId,
    onPropertySelect,
    onClose,
}: MapPropertyPreviewCardProps) {
    const router = useRouter()
    const [imageState, setImageState] = useState<{ propertyId: string; index: number }>({ propertyId: property.id, index: 0 })
    const touchStartX = useRef<number | null>(null)
    const trackRef = useRef<HTMLDivElement | null>(null)
    const itemRefs = useRef<Record<string, HTMLElement | null>>({})
    const scrollFrame = useRef<number | null>(null)
    const suppressScrollSelection = useRef(false)
    const suppressScrollTimer = useRef<number | null>(null)
    const settleScrollTimer = useRef<number | null>(null)
    const suppressDetailsClick = useRef(false)
    const suppressCardClick = useRef(false)
    const desktopDragRef = useRef<{
        pointerId: number
        startX: number
        startScrollLeft: number
        startSelectedId: string
        moved: boolean
    } | null>(null)
    const internalSelectionRef = useRef<string | null>(null)
    const lastAnnouncedPropertyId = useRef<string | null>(null)

    const carouselProperties = useMemo(() => uniqueProperties(properties, property), [properties, property])
    const selectedId = selectedPropertyId || property.id
    const carouselMode = carouselProperties.length > 1
    const selectedProperty = carouselProperties.find(item => item.id === selectedId) || property
    const selectedPropertyIndex = carouselProperties.findIndex(item => item.id === selectedId)
    const canGoPrevious = carouselMode && selectedPropertyIndex > 0
    const canGoNext = carouselMode && selectedPropertyIndex >= 0 && selectedPropertyIndex < carouselProperties.length - 1
    const selectedGallery = useMemo(() => galleryFor(selectedProperty), [selectedProperty])
    const selectedBadges = useMemo(() => getBadges(selectedProperty), [selectedProperty])
    const selectedBadgesKey = selectedBadges.join(', ')
    const selectedMeta = useMemo(() => previewMetaFor(selectedProperty), [selectedProperty])

    useEffect(() => {
        void trackEvent('property_map_preview_opened', {
            property_id: selectedProperty.id,
            title: selectedMeta.displayTitle,
            price: selectedProperty.price || null,
            city: selectedMeta.displayCity || null,
            neighborhood: selectedMeta.displayNeighborhood || null,
            property_type: selectedProperty.property_type || null,
            gallery_count: selectedGallery.length,
            badges: selectedBadges,
        })
    }, [
        selectedBadges,
        selectedBadgesKey,
        selectedGallery.length,
        selectedMeta.displayCity,
        selectedMeta.displayNeighborhood,
        selectedMeta.displayTitle,
        selectedProperty.id,
        selectedProperty.price,
        selectedProperty.property_type,
    ])

    useEffect(() => () => {
        if (scrollFrame.current !== null) {
            window.cancelAnimationFrame(scrollFrame.current)
            scrollFrame.current = null
        }
        if (suppressScrollTimer.current !== null) {
            window.clearTimeout(suppressScrollTimer.current)
            suppressScrollTimer.current = null
        }
        if (settleScrollTimer.current !== null) {
            window.clearTimeout(settleScrollTimer.current)
            settleScrollTimer.current = null
        }
        desktopDragRef.current = null
    }, [])

    const scrollPropertyIntoCenter = useCallback((propertyId: string, behavior: ScrollBehavior = 'smooth') => {
        const selectedNode = itemRefs.current[propertyId]
        const trackNode = trackRef.current
        if (!selectedNode || !trackNode) return

        const nextScrollLeft = selectedNode.offsetLeft - ((trackNode.clientWidth - selectedNode.offsetWidth) / 2)
        const maxScrollLeft = Math.max(0, trackNode.scrollWidth - trackNode.clientWidth)
        trackNode.scrollTo({
            left: Math.min(maxScrollLeft, Math.max(0, nextScrollLeft)),
            behavior,
        })
    }, [])

    const settlePropertyIntoCenter = useCallback((propertyId: string, behavior: ScrollBehavior = 'auto') => {
        if (settleScrollTimer.current !== null) {
            window.clearTimeout(settleScrollTimer.current)
            settleScrollTimer.current = null
        }

        window.requestAnimationFrame(() => {
            scrollPropertyIntoCenter(propertyId, behavior)
            settleScrollTimer.current = window.setTimeout(() => {
                scrollPropertyIntoCenter(propertyId, behavior)
                settleScrollTimer.current = null
            }, 80)
        })
    }, [scrollPropertyIntoCenter])

    useEffect(() => {
        const track = trackRef.current
        if (!track || !carouselMode) return

        const handleWheel = (event: WheelEvent) => {
            if (track.scrollWidth <= track.clientWidth) return

            const horizontalDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
                ? event.deltaX
                : event.deltaY

            if (!horizontalDelta) return

            event.preventDefault()
            track.scrollLeft += horizontalDelta
        }

        track.addEventListener('wheel', handleWheel, { passive: false })

        return () => {
            track.removeEventListener('wheel', handleWheel)
        }
    }, [carouselMode])

    useEffect(() => {
        if (!carouselMode) return

        lastAnnouncedPropertyId.current = selectedId

        if (internalSelectionRef.current === selectedId) {
            internalSelectionRef.current = null
            return
        }

        suppressScrollSelection.current = true

        scrollPropertyIntoCenter(selectedId, 'auto')

        if (suppressScrollTimer.current !== null) window.clearTimeout(suppressScrollTimer.current)
        suppressScrollTimer.current = window.setTimeout(() => {
            suppressScrollSelection.current = false
            suppressScrollTimer.current = null
        }, 120)
    }, [carouselMode, scrollPropertyIntoCenter, selectedId])

    const selectProperty = useCallback((nextProperty: PreviewProperty, source: string) => {
        if (!nextProperty?.id || nextProperty.id === lastAnnouncedPropertyId.current) return

        lastAnnouncedPropertyId.current = nextProperty.id
        internalSelectionRef.current = nextProperty.id
        onPropertySelect?.(nextProperty, source)
    }, [onPropertySelect])

    const goToAdjacentProperty = useCallback((direction: 1 | -1) => {
        if (!carouselMode || selectedPropertyIndex < 0) return

        const nextIndex = Math.min(carouselProperties.length - 1, Math.max(0, selectedPropertyIndex + direction))
        const nextProperty = carouselProperties[nextIndex]
        if (!nextProperty || nextProperty.id === selectedId) return

        selectProperty(nextProperty, direction > 0 ? 'carousel_next_button' : 'carousel_previous_button')
        settlePropertyIntoCenter(nextProperty.id, 'smooth')
    }, [carouselMode, carouselProperties, selectProperty, selectedId, selectedPropertyIndex, settlePropertyIntoCenter])

    const handleTrackScroll = useCallback((event: ReactUIEvent<HTMLDivElement>) => {
        if (!carouselMode || !onPropertySelect) return
        if (suppressScrollSelection.current) return

        const track = event.currentTarget
        if (scrollFrame.current !== null) window.cancelAnimationFrame(scrollFrame.current)

        scrollFrame.current = window.requestAnimationFrame(() => {
            scrollFrame.current = null

            const center = track.scrollLeft + (track.clientWidth / 2)
            let closestProperty: PreviewProperty | null = null
            let closestDistance = Number.POSITIVE_INFINITY

            for (const item of carouselProperties) {
                const node = itemRefs.current[item.id]
                if (!node) continue

                const itemCenter = node.offsetLeft + (node.offsetWidth / 2)
                const distance = Math.abs(itemCenter - center)
                if (distance < closestDistance) {
                    closestDistance = distance
                    closestProperty = item
                }
            }

            if (closestProperty) selectProperty(closestProperty, 'carousel_scroll')
        })
    }, [carouselMode, carouselProperties, onPropertySelect, selectProperty])

    const handleCarouselPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        if (!carouselMode) return
        if (event.pointerType === 'touch') return
        if (event.button !== 0) return

        const target = event.target as HTMLElement
        if (target.closest('.map-preview-card')) return
        if (target.closest('a, button, input, textarea, select')) return

        const track = trackRef.current
        if (!track || track.scrollWidth <= track.clientWidth) return

        desktopDragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startScrollLeft: track.scrollLeft,
            startSelectedId: selectedId,
            moved: false,
        }
        event.currentTarget.setPointerCapture(event.pointerId)
        track.classList.add('is-dragging')
    }, [carouselMode, selectedId])

    const handleCarouselPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        const dragState = desktopDragRef.current
        if (!dragState || dragState.pointerId !== event.pointerId) return

        const track = trackRef.current
        if (!track) return

        const delta = event.clientX - dragState.startX
        if (Math.abs(delta) > DESKTOP_DRAG_THRESHOLD) {
            dragState.moved = true
            suppressCardClick.current = true
            suppressDetailsClick.current = true
        }

        if (dragState.moved) {
            event.preventDefault()
            track.scrollLeft = dragState.startScrollLeft - delta
        }
    }, [])

    const handleCarouselPointerEnd = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        const dragState = desktopDragRef.current
        if (!dragState || dragState.pointerId !== event.pointerId) return

        const totalDelta = event.clientX - dragState.startX
        const track = trackRef.current

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
        }
        track?.classList.remove('is-dragging')
        desktopDragRef.current = null

        if (dragState.moved) {
            if (Math.abs(totalDelta) >= DESKTOP_DRAG_SNAP_THRESHOLD) {
                const startIndex = carouselProperties.findIndex(item => item.id === dragState.startSelectedId)
                const direction = totalDelta < 0 ? 1 : -1
                const nextIndex = startIndex >= 0
                    ? Math.min(carouselProperties.length - 1, Math.max(0, startIndex + direction))
                    : -1
                const nextProperty = nextIndex >= 0 ? carouselProperties[nextIndex] : null

                if (nextProperty) {
                    selectProperty(nextProperty, 'carousel_drag')
                    settlePropertyIntoCenter(nextProperty.id)
                }
            } else {
                settlePropertyIntoCenter(dragState.startSelectedId)
            }

            window.setTimeout(() => {
                suppressCardClick.current = false
                suppressDetailsClick.current = false
            }, 120)
        }
    }, [carouselProperties, selectProperty, settlePropertyIntoCenter])

    const navigateToPropertyDetails = useCallback((targetProperty: PreviewProperty, source: string) => {
        const meta = previewMetaFor(targetProperty)

        void trackEvent('property_map_preview_details_clicked', {
            property_id: targetProperty.id,
            title: meta.displayTitle,
            price: targetProperty.price || null,
            destination: meta.detailsHref,
            source,
        })
        router.push(meta.detailsHref)

        window.setTimeout(() => {
            const targetUrl = new URL(meta.detailsHref, window.location.origin)
            const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
            const targetPath = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`

            if (currentPath !== targetPath) {
                window.location.assign(targetPath)
            }
        }, 250)
    }, [router])

    const handlePreviewCardClick = useCallback((event: ReactMouseEvent<HTMLElement>, nextProperty: PreviewProperty) => {
        if (suppressCardClick.current) {
            event.preventDefault()
            event.stopPropagation()
            suppressCardClick.current = false
            return
        }

        const target = event.target as HTMLElement
        if (target.closest('button, input, textarea, select')) return

        const link = target.closest('a')
        if (link && !link.closest('.map-preview-media-hit, .map-preview-body-link')) return

        const isPrimaryUnmodifiedClick = (
            (event.button ?? 0) === 0 &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.shiftKey &&
            !event.altKey
        )
        if (!isPrimaryUnmodifiedClick) return

        const meta = previewMetaFor(nextProperty)
        if (openPropertyDestinationOnDesktopClick(event, meta.detailsHref, () => {
            void trackEvent('property_map_preview_details_clicked', {
                property_id: nextProperty.id,
                title: meta.displayTitle,
                price: nextProperty.price || null,
                destination: meta.detailsHref,
                source: 'card_click',
            })
        })) return

        event.preventDefault()
        navigateToPropertyDetails(nextProperty, 'card_click')
    }, [navigateToPropertyDetails])

    const goToImage = useCallback((targetProperty: PreviewProperty, gallery: string[], direction: 1 | -1) => {
        if (gallery.length < 2) return

        const activeIndex = imageState.propertyId === targetProperty.id
            ? Math.min(imageState.index, Math.max(0, gallery.length - 1))
            : 0
        const nextIndex = (activeIndex + direction + gallery.length) % gallery.length
        const meta = previewMetaFor(targetProperty)

        setImageState({
            propertyId: targetProperty.id,
            index: nextIndex,
        })
        void trackEvent('property_map_preview_photo_changed', {
            property_id: targetProperty.id,
            title: meta.displayTitle,
            direction,
            image_index: nextIndex,
            gallery_count: gallery.length,
        })
    }, [imageState.index, imageState.propertyId])

    const handlePhotoTouchEnd = useCallback((targetProperty: PreviewProperty, gallery: string[], clientX: number) => {
        if (touchStartX.current === null) return

        const delta = clientX - touchStartX.current
        touchStartX.current = null

        if (Math.abs(delta) < SWIPE_THRESHOLD) return
        suppressDetailsClick.current = true
        suppressCardClick.current = true
        window.setTimeout(() => {
            suppressDetailsClick.current = false
            suppressCardClick.current = false
        }, 140)
        goToImage(targetProperty, gallery, delta < 0 ? 1 : -1)
    }, [goToImage])

    const handleDetailsNavigation = useCallback((
        event: ReactMouseEvent<HTMLAnchorElement>,
        targetProperty: PreviewProperty,
        meta: ReturnType<typeof previewMetaFor>,
    ) => {
        if (suppressDetailsClick.current) {
            event.preventDefault()
            event.stopPropagation()
            suppressDetailsClick.current = false
            suppressCardClick.current = true
            window.setTimeout(() => {
                suppressCardClick.current = false
            }, 140)
            return
        }

        if (!isPlainLeftClick(event)) {
            void trackEvent('property_map_preview_details_clicked', {
                property_id: targetProperty.id,
                title: meta.displayTitle,
                price: targetProperty.price || null,
                destination: meta.detailsHref,
                source: 'details_link',
            })
            return
        }

        if (openPropertyDestinationOnDesktopClick(event, meta.detailsHref, () => {
            void trackEvent('property_map_preview_details_clicked', {
                property_id: targetProperty.id,
                title: meta.displayTitle,
                price: targetProperty.price || null,
                destination: meta.detailsHref,
                source: 'details_link',
            })
        })) return

        event.preventDefault()
        navigateToPropertyDetails(targetProperty, 'details_link')
    }, [navigateToPropertyDetails])

    return (
        <article className="map-property-preview" aria-live="polite">
            <style>{`
                .map-property-preview {
                    position: absolute;
                    left: 0;
                    right: 0;
                    bottom: 112px;
                    z-index: 1;
                    isolation: isolate;
                    max-width: 100%;
                    contain: layout paint;
                    pointer-events: none;
                }
                .map-property-preview::before {
                    content: '';
                    position: absolute;
                    left: 0;
                    right: 0;
                    top: -22px;
                    bottom: -180px;
                    z-index: 0;
                    display: none;
                    pointer-events: none;
                }
                .map-preview-track {
                    position: relative;
                    z-index: 2;
                    display: flex;
                    gap: 10px;
                    overflow-x: auto;
                    overflow-y: visible;
                    padding: 0 16px 7px;
                    max-width: 100%;
                    scroll-padding-inline: 16px;
                    scroll-snap-type: x mandatory;
                    scrollbar-width: none;
                    touch-action: pan-x;
                    overscroll-behavior-x: contain;
                    pointer-events: auto;
                    -webkit-overflow-scrolling: touch;
                    cursor: grab;
                    user-select: none;
                }
                .map-preview-track.is-dragging {
                    cursor: grabbing;
                    user-select: none;
                }
                .map-preview-track.is-dragging .map-preview-media-hit,
                .map-preview-track.is-dragging .map-preview-body-link {
                    pointer-events: none;
                }
                .map-preview-track::-webkit-scrollbar {
                    display: none;
                }
                .map-preview-card {
                    position: relative;
                    display: grid;
                    grid-template-columns: 150px minmax(0, 1fr);
                    flex: 0 0 min(390px, 100%);
                    max-width: 100%;
                    min-height: 158px;
                    overflow: hidden;
                    border: 1px solid rgba(184,148,95,0.28);
                    border-radius: 17px;
                    background: rgba(255,253,248,0.98);
                    color: #211d18;
                    box-shadow: 0 18px 42px rgba(50,42,30,0.22);
                    scroll-snap-align: center;
                    scroll-snap-stop: always;
                    transform: translateZ(0);
                    backdrop-filter: blur(14px);
                    -webkit-backdrop-filter: blur(14px);
                    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
                }
                .map-preview-card:hover {
                    border-color: rgba(184,148,95,0.48);
                }
                .map-preview-card.is-active {
                    border-color: rgba(223,193,142,0.98);
                    filter: drop-shadow(0 0 24px rgba(244,221,170,0.38));
                    transform: translateZ(0) scale(1);
                    box-shadow:
                        0 18px 42px rgba(50,42,30,0.24),
                        0 0 0 2px rgba(223,193,142,0.98),
                        0 0 0 8px rgba(223,193,142,0.2),
                        0 0 70px rgba(244,221,170,0.4);
                }
                .map-preview-card.is-active::before {
                    content: 'Selecionado';
                    position: absolute;
                    top: 9px;
                    right: 43px;
                    z-index: 6;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    height: 23px;
                    padding: 0 9px;
                    border: 1px solid rgba(255,247,221,0.8);
                    border-radius: 999px;
                    background: linear-gradient(135deg, #f4ddaa, #dfc18e 45%, #b8945f);
                    color: #1a130a;
                    font: 850 0.56rem/1 'Inter', sans-serif;
                    letter-spacing: 0.04em;
                    box-shadow:
                        0 10px 22px rgba(82,58,25,0.24),
                        0 0 24px rgba(244,221,170,0.32);
                    pointer-events: none;
                    text-transform: uppercase;
                }
                .map-preview-card.is-active .map-preview-open-indicator {
                    color: #8b642d;
                }
                .map-preview-media {
                    position: relative;
                    min-height: 158px;
                    overflow: hidden;
                    background: #e9dfcf;
                    touch-action: pan-y;
                }
                .map-preview-media img {
                    display: block;
                    width: 100%;
                    height: 100%;
                    min-height: 158px;
                    object-fit: cover;
                }
                .map-preview-media-hit {
                    position: absolute;
                    inset: 0;
                    z-index: 1;
                    display: block;
                    border-radius: inherit;
                    color: inherit;
                    text-decoration: none;
                    touch-action: pan-y;
                }
                .map-preview-media-hit:focus-visible,
                .map-preview-body-link:focus-visible {
                    outline: 2px solid rgba(223,193,142,0.86);
                    outline-offset: -4px;
                }
                .map-preview-media::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    z-index: 2;
                    background: linear-gradient(180deg, rgba(0,0,0,0.18), transparent 42%, rgba(0,0,0,0.48));
                    pointer-events: none;
                }
                .map-preview-badges {
                    position: absolute;
                    top: 8px;
                    left: 8px;
                    right: 36px;
                    z-index: 3;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px;
                    pointer-events: none;
                }
                .map-preview-badge {
                    padding: 4px 6px;
                    border: 1px solid rgba(184,148,95,0.34);
                    border-radius: 999px;
                    background: rgba(255,253,248,0.92);
                    color: #8b642d;
                    font: 850 0.48rem/1 'Inter', sans-serif;
                    letter-spacing: 0.08em;
                    box-shadow: 0 6px 16px rgba(38,31,22,0.16);
                    text-transform: uppercase;
                }
                .map-preview-photo-count {
                    position: absolute;
                    left: 8px;
                    bottom: 8px;
                    z-index: 3;
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    height: 22px;
                    padding: 0 7px;
                    border-radius: 999px;
                    background: rgba(10,10,10,0.72);
                    color: #fff;
                    font: 800 0.58rem/1 'Inter', sans-serif;
                    pointer-events: none;
                }
                .map-preview-photo-dots {
                    position: absolute;
                    left: 50%;
                    bottom: 14px;
                    z-index: 3;
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 5px 8px;
                    border-radius: 999px;
                    background: rgba(255,253,248,0.78);
                    transform: translateX(-50%);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    pointer-events: none;
                }
                .map-preview-photo-dot {
                    width: 5px;
                    height: 5px;
                    border-radius: 50%;
                    background: rgba(43,36,27,0.34);
                    box-shadow: 0 1px 3px rgba(0,0,0,0.28);
                }
                .map-preview-photo-dot.is-active {
                    width: 7px;
                    height: 7px;
                    background: #b8945f;
                }
                .map-preview-nav {
                    position: absolute;
                    top: 50%;
                    z-index: 4;
                    display: grid;
                    place-items: center;
                    width: 28px;
                    height: 28px;
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 50%;
                    background: rgba(12,12,12,0.7);
                    color: #fff;
                    cursor: pointer;
                    transform: translateY(-50%);
                }
                .map-preview-nav.prev { left: 7px; }
                .map-preview-nav.next { right: 7px; }
                .map-preview-carousel-button {
                    position: absolute;
                    top: 50%;
                    z-index: 6;
                    display: grid;
                    place-items: center;
                    width: 42px;
                    height: 42px;
                    border: 1px solid rgba(255,255,255,0.74);
                    border-radius: 999px;
                    background: rgba(255,253,248,0.94);
                    color: #5f4930;
                    cursor: pointer;
                    pointer-events: auto;
                    box-shadow: 0 14px 34px rgba(31,24,16,0.26);
                    transform: translateY(-50%);
                    transition: transform 0.2s ease, opacity 0.2s ease, background 0.2s ease;
                }
                .map-preview-carousel-button:hover:not(:disabled) {
                    background: #dfc18e;
                    color: #111;
                    transform: translateY(-50%) scale(1.04);
                }
                .map-preview-carousel-button:disabled {
                    cursor: default;
                    opacity: 0.28;
                    box-shadow: 0 8px 18px rgba(31,24,16,0.12);
                }
                .map-preview-carousel-button.prev {
                    left: 8px;
                }
                .map-preview-carousel-button.next {
                    right: 8px;
                }
                .map-preview-close {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    z-index: 5;
                    display: grid;
                    place-items: center;
                    width: 28px;
                    height: 28px;
                    border: 1px solid rgba(255,255,255,0.22);
                    border-radius: 50%;
                    background: rgba(12,12,12,0.72);
                    color: #fff;
                    cursor: pointer;
                }
                .map-preview-body {
                    display: grid;
                    align-content: stretch;
                    min-width: 0;
                    padding: 11px 12px 10px;
                    background: linear-gradient(180deg, rgba(255,253,248,0.99), rgba(248,242,231,0.99));
                }
                .map-preview-body-link {
                    display: grid;
                    gap: 6px;
                    min-width: 0;
                    color: inherit;
                    text-decoration: none;
                }
                .map-preview-location {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    min-width: 0;
                    color: #81766a;
                    font: 750 0.55rem/1.25 'Inter', sans-serif;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }
                .map-preview-location span {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .map-preview-title {
                    display: -webkit-box;
                    margin: 0;
                    overflow: hidden;
                    color: #211d18;
                    font-family: 'Noto Serif', Georgia, serif;
                    font-size: 0.92rem;
                    font-weight: 750;
                    line-height: 1.08;
                    -webkit-box-orient: vertical;
                    -webkit-line-clamp: 2;
                }
                .map-preview-price {
                    color: #a9792f;
                    font: 900 0.88rem/1 'Inter', sans-serif;
                }
                .map-preview-meta-row {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    gap: 8px;
                    align-items: end;
                }
                .map-preview-stats {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                }
                .map-preview-stat {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    min-height: 23px;
                    padding: 0 7px;
                    border: 1px solid rgba(184,148,95,0.22);
                    border-radius: 999px;
                    background: rgba(247,239,224,0.92);
                    color: #5d5348;
                    font: 750 0.58rem/1 'Inter', sans-serif;
                    white-space: nowrap;
                }
                .map-preview-index {
                    color: #8b8175;
                    font: 800 0.56rem/1.2 'Inter', sans-serif;
                    text-align: right;
                    white-space: nowrap;
                }
                .map-preview-open-indicator {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    width: max-content;
                    color: #8b642d;
                    font: 850 0.56rem/1 'Inter', sans-serif;
                    letter-spacing: 0.07em;
                    text-transform: uppercase;
                }
                .map-preview-open-indicator svg {
                    stroke-width: 2.4;
                    transition: transform 0.2s ease;
                }
                .map-preview-card:hover .map-preview-open-indicator svg {
                    transform: translateX(2px);
                }
                .map-preview-swipe-hint {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    max-width: max-content;
                    margin: -1px auto 0;
                    padding: 5px 10px;
                    border: 1px solid rgba(184,148,95,0.3);
                    border-radius: 999px;
                    background: rgba(255,253,248,0.94);
                    color: #62584d;
                    cursor: grab;
                    font: 750 0.56rem/1 'Inter', sans-serif;
                    letter-spacing: 0.04em;
                    pointer-events: auto;
                    user-select: none;
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                }
                .map-preview-swipe-hint:active {
                    cursor: grabbing;
                }
                @media (min-width: 1024px) {
                    .map-property-preview {
                        left: auto;
                        right: clamp(18px, 2.2vw, 36px);
                        bottom: clamp(18px, 2.2vw, 36px);
                        width: min(760px, calc(100% - 48px));
                        max-width: calc(100% - 48px);
                    }
                    .map-property-preview::before {
                        top: auto;
                        bottom: -26px;
                        height: 218px;
                        border-radius: 28px;
                    }
                    .map-preview-track {
                        gap: 12px;
                        padding-inline: clamp(32px, 4vw, 64px);
                        scroll-padding-inline: clamp(32px, 4vw, 64px);
                        width: 100%;
                    }
                    .map-preview-card {
                        grid-template-columns: 190px minmax(0, 1fr);
                        flex-basis: clamp(420px, 30vw, 520px);
                        max-width: calc(100% - clamp(92px, 10vw, 136px));
                        min-height: 178px;
                    }
                    .map-preview-media,
                    .map-preview-media img {
                        min-height: 178px;
                    }
                }
                @media (max-width: 649px) {
                    .map-property-preview {
                        bottom: 96px;
                    }
                    .map-property-preview::before {
                        top: -4px;
                        bottom: -208px;
                    }
                    .map-preview-track {
                        gap: 9px;
                        padding: 0 13px 5px;
                        scroll-padding-inline: 13px;
                    }
                    .map-preview-card {
                        grid-template-columns: 1fr;
                        flex-basis: min(335px, 100%);
                        min-height: 0;
                        border-radius: 15px;
                    }
                    .map-preview-media,
                    .map-preview-media img {
                        height: 154px;
                        min-height: 154px;
                    }
                    .map-preview-body {
                        padding: 6px 9px 7px;
                    }
                    .map-preview-body-link {
                        gap: 3px;
                    }
                    .map-preview-location {
                        font-size: 0.43rem;
                    }
                    .map-preview-title {
                        font-size: 0.68rem;
                        line-height: 1.05;
                        -webkit-line-clamp: 1;
                    }
                    .map-preview-price {
                        font-size: 0.74rem;
                    }
                    .map-preview-meta-row {
                        gap: 5px;
                        align-items: center;
                    }
                    .map-preview-stats {
                        gap: 3px;
                    }
                    .map-preview-stats .map-preview-stat:nth-child(n+3) {
                        display: none;
                    }
                    .map-preview-stat {
                        min-height: 18px;
                        padding: 0 5px;
                        font-size: 0.48rem;
                    }
                    .map-preview-index,
                    .map-preview-swipe-hint {
                        font-size: 0.47rem;
                    }
                    .map-preview-open-indicator {
                        display: none;
                    }
                    .map-preview-carousel-button {
                        display: none;
                    }
                    .map-preview-photo-count {
                        bottom: 6px;
                        height: 19px;
                        padding: 0 6px;
                        font-size: 0.5rem;
                    }
                    .map-preview-photo-dots {
                        bottom: 10px;
                        gap: 4px;
                        padding: 4px 7px;
                    }
                    .map-preview-badges {
                        right: 34px;
                    }
                    .map-preview-badge {
                        padding: 3px 6px;
                        font-size: 0.46rem;
                    }
                }
                @media (max-width: 380px) {
                    .map-preview-card {
                        flex-basis: min(312px, 100%);
                    }
                    .map-preview-stats .map-preview-stat:nth-child(n+3) {
                        display: none;
                    }
                }
            `}</style>

            {carouselMode && (
                <>
                    <button
                        type="button"
                        className="map-preview-carousel-button prev"
                        aria-label="Ver imóvel anterior"
                        onClick={event => {
                            event.stopPropagation()
                            goToAdjacentProperty(-1)
                        }}
                        disabled={!canGoPrevious}
                    >
                        <ChevronLeft size={19} />
                    </button>
                    <button
                        type="button"
                        className="map-preview-carousel-button next"
                        aria-label="Ver próximo imóvel"
                        onClick={event => {
                            event.stopPropagation()
                            goToAdjacentProperty(1)
                        }}
                        disabled={!canGoNext}
                    >
                        <ChevronRight size={19} />
                    </button>
                </>
            )}

            <div
                className="map-preview-track"
                ref={trackRef}
                onScroll={handleTrackScroll}
                onPointerDownCapture={handleCarouselPointerDown}
                onPointerMove={handleCarouselPointerMove}
                onPointerUp={handleCarouselPointerEnd}
                onPointerCancel={handleCarouselPointerEnd}
            >
                {carouselProperties.map((item) => {
                    const meta = previewMetaFor(item)
                    const gallery = galleryFor(item)
                    const badges = getBadges(item)
                    const activeIndex = imageState.propertyId === item.id
                        ? Math.min(imageState.index, Math.max(0, gallery.length - 1))
                        : 0
                    const isSelected = String(item.id) === String(selectedId)

                    return (
                        <section
                            className={`map-preview-card${isSelected ? ' is-active' : ''}`}
                            key={item.id}
                            ref={node => {
                                itemRefs.current[item.id] = node
                            }}
                            onClick={event => handlePreviewCardClick(event, item)}
                            aria-label={meta.displayTitle}
                            aria-current={isSelected ? 'true' : undefined}
                        >
                            <div className="map-preview-media">
                                <img src={gallery[activeIndex] || FALLBACK_IMAGE} alt={meta.displayTitle} loading="lazy" draggable={false} />
                                <Link
                                    href={meta.detailsHref}
                                    className="map-preview-media-hit"
                                    aria-label={`Abrir detalhes de ${meta.displayTitle}`}
                                    draggable={false}
                                    prefetch={false}
                                    onClick={event => handleDetailsNavigation(event, item, meta)}
                                    onTouchStart={event => {
                                        event.stopPropagation()
                                        touchStartX.current = event.touches[0]?.clientX ?? null
                                    }}
                                    onTouchMove={event => {
                                        event.stopPropagation()
                                    }}
                                    onTouchEnd={event => {
                                        event.stopPropagation()
                                        handlePhotoTouchEnd(item, gallery, event.changedTouches[0]?.clientX ?? 0)
                                    }}
                                />
                                {badges.length > 0 && (
                                    <div className="map-preview-badges" aria-label="Destaques do imóvel">
                                        {badges.map(badge => <span className="map-preview-badge" key={badge}>{badge}</span>)}
                                    </div>
                                )}
                                <span className="map-preview-photo-count">
                                    <Camera size={12} />
                                    {gallery.length}
                                </span>
                                {gallery.length > 1 && (
                                    <div className="map-preview-photo-dots" aria-hidden="true">
                                        {Array.from({ length: Math.min(gallery.length, 6) }).map((_, dotIndex) => {
                                            const isActive = dotIndex === Math.min(activeIndex, 5)
                                            return (
                                                <span
                                                    className={`map-preview-photo-dot${isActive ? ' is-active' : ''}`}
                                                    key={`${item.id}-photo-dot-${dotIndex}`}
                                                />
                                            )
                                        })}
                                    </div>
                                )}
                                {gallery.length > 1 && (
                                    <>
                                        <button
                                            type="button"
                                            className="map-preview-nav prev"
                                            aria-label="Foto anterior"
                                            onClick={event => {
                                                event.stopPropagation()
                                                goToImage(item, gallery, -1)
                                            }}
                                        >
                                            <ChevronLeft size={15} />
                                        </button>
                                        <button
                                            type="button"
                                            className="map-preview-nav next"
                                            aria-label="Proxima foto"
                                            onClick={event => {
                                                event.stopPropagation()
                                                goToImage(item, gallery, 1)
                                            }}
                                        >
                                            <ChevronRight size={15} />
                                        </button>
                                    </>
                                )}
                            </div>

                            <button
                                type="button"
                                className="map-preview-close"
                                aria-label="Fechar preview do imóvel"
                                onClick={event => {
                                    event.stopPropagation()
                                    onClose()
                                }}
                            >
                                <X size={15} />
                            </button>

                            <div className="map-preview-body">
                                <Link
                                    href={meta.detailsHref}
                                    className="map-preview-body-link"
                                    aria-label={`Abrir detalhes de ${meta.displayTitle}`}
                                    draggable={false}
                                    prefetch={false}
                                    onClick={event => handleDetailsNavigation(event, item, meta)}
                                >
                                    <div className="map-preview-location">
                                        <MapPin size={12} />
                                        <span>{meta.location || 'Litoral catarinense'}</span>
                                    </div>
                                    <h2 className="map-preview-title">{meta.displayTitle}</h2>
                                    <div className="map-preview-price">{formatPrice(item.price)}</div>
                                    <div className="map-preview-meta-row">
                                        {meta.stats.length > 0 && (
                                            <div className="map-preview-stats" aria-label="Dados principais">
                                                {meta.stats.slice(0, 3).map(stat => {
                                                    const Icon = stat.icon
                                                    return (
                                                        <span className="map-preview-stat" key={stat.key}>
                                                            <Icon size={12} />
                                                            {stat.label}
                                                        </span>
                                                    )
                                                })}
                                            </div>
                                        )}
                                        <span className="map-preview-index">
                                            {activeIndex + 1}/{gallery.length} fotos
                                        </span>
                                    </div>
                                    <span className="map-preview-open-indicator">
                                        Ver mais
                                        <ArrowRight size={12} />
                                    </span>
                                </Link>
                            </div>
                        </section>
                    )
                })}
            </div>

            {carouselMode && (
                <div
                    className="map-preview-swipe-hint"
                    aria-hidden="true"
                    onPointerDown={handleCarouselPointerDown}
                    onPointerMove={handleCarouselPointerMove}
                    onPointerUp={handleCarouselPointerEnd}
                    onPointerCancel={handleCarouselPointerEnd}
                >
                    <ChevronLeft size={12} />
                    <span>Arraste para ver mais imóveis</span>
                    <ChevronRight size={12} />
                </div>
            )}
        </article>
    )
}
