'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent, type TouchEvent } from 'react'
import {
    ArrowLeft,
    BedDouble,
    ChevronDown,
    ChevronsUp,
    Eye,
    FileText,
    Gem,
    Grid3X3,
    Heart,
    MapPinned,
    MapPin,
    MessageCircle,
    MoreHorizontal,
    PlaySquare,
    Share2,
    Sparkles,
    ThumbsDown,
    Waves,
} from 'lucide-react'
import WhatsAppCaptureLink from '@/components/common/WhatsAppCaptureLink'
import { propertyDetailsPath, shouldOpenPropertyDetailsOnDesktop } from '@/lib/properties/responsive-destination'
import { trackEvent } from '@/lib/tracking/client'
import { buildPropertyFeedCopy } from '@/lib/properties/feed-copy'

export type PropertyFeedItem = {
    id: string
    source_slug?: string | null
    slug?: string | null
    title: string
    description?: string | null
    seo_title?: string | null
    seo_description?: string | null
    city?: string | null
    state?: string | null
    neighborhood?: string | null
    latitude?: number | string | null
    longitude?: number | string | null
    price?: number | null
    bedrooms?: number | null
    bathrooms?: number | null
    suites?: number | null
    parking_spaces?: number | null
    area_m2?: number | null
    area_private_m2?: number | null
    featured_image?: string | null
    images?: string[] | null
    property_type?: string | null
    amenities?: string[] | null
    video_url?: string | null
    documents?: string[] | null
    exclusive?: boolean | null
    status?: string | null
    created_at?: string | null
    updated_at?: string | null
    responsible_broker?: {
        name: string
        phone: string
        photo_url?: string | null
        email?: string | null
        is_connected: boolean
        legacy_name?: string | null
        source?: string | null
    }
}

type Props = {
    property: PropertyFeedItem
    related: PropertyFeedItem[]
}

type FeedTab = 'photos' | 'videos' | 'docs' | 'map'
type GalleryState = {
    property: PropertyFeedItem
    index: number
} | null

const FAVORITES_KEY = 'pilger_property_favorites'
const DISLIKES_KEY = 'pilger_property_dislikes'
const HISTORY_KEY = 'pilger_property_history'
const WHATSAPP_PHONE = '5547992528080'
const MAX_FEED_ITEMS = 72
const STORIES_PER_PAGE = 5
const DEFAULT_BROKER_PHOTO = '/images/eventos/guilherme-pilger.png'
const GALLERY_SWIPE_THRESHOLD = 44
const FEED_SWIPE_THRESHOLD = 56
const FEED_VERTICAL_DOMINANCE = 1.1
const SERVICE_AREA_BOUNDS = {
    north: -25.0,
    south: -30.5,
    east: -47.0,
    west: -54.5,
}
const PropertyFeedMap = dynamic(() => import('@/components/property/PropertyFeedMap'), {
    ssr: false,
    loading: () => <div className="property-feed-map-shell" aria-label="Carregando mapa" />,
})

const PropertyGalleryModal = dynamic(() => import('@/components/property/PropertyGalleryModal'), {
    ssr: false,
})

function formatPrice(price?: number | null) {
    if (!price) return 'Sob consulta'
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
    }).format(price)
}

function compactPrice(price?: number | null) {
    if (!price) return 'Sob consulta'
    return formatPrice(price)
}

function toCoordinate(value: number | string | null | undefined) {
    if (typeof value === 'string') return Number(value.replace(',', '.'))
    return Number(value)
}

function isValidLatLng(lat: number, lng: number) {
    return (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
    )
}

function isInsideServiceArea(lat: number, lng: number) {
    return (
        lat >= SERVICE_AREA_BOUNDS.south &&
        lat <= SERVICE_AREA_BOUNDS.north &&
        lng >= SERVICE_AREA_BOUNDS.west &&
        lng <= SERVICE_AREA_BOUNDS.east
    )
}

function getPropertyLatLng(property: PropertyFeedItem): [number, number] | null {
    const lat = toCoordinate(property.latitude)
    const lng = toCoordinate(property.longitude)

    if (isValidLatLng(lat, lng) && isInsideServiceArea(lat, lng)) return [lat, lng]
    if (isValidLatLng(lng, lat) && isInsideServiceArea(lng, lat)) return [lng, lat]

    return null
}

function locationLabel(property: PropertyFeedItem) {
    return [property.neighborhood, property.city, property.state].filter(Boolean).join(' - ') || 'Litoral catarinense'
}

function readStorageList(key: string): string[] {
    if (typeof window === 'undefined') return []
    try {
        const parsed = JSON.parse(window.localStorage.getItem(key) || '[]')
        return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
        return []
    }
}

function writeStorageList(key: string, list: string[]) {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(key, JSON.stringify(list))
}

function primaryImage(property: PropertyFeedItem) {
    return property.featured_image || property.images?.find(Boolean) || 'https://via.placeholder.com/900x900?text=Guilherme+Pilger'
}

function fallbackImage(event: SyntheticEvent<HTMLImageElement>, property: PropertyFeedItem) {
    const fallback = primaryImage(property)
    if (event.currentTarget.src !== fallback) {
        event.currentTarget.src = fallback
    }
}

function galleryFor(property: PropertyFeedItem) {
    const images = [property.featured_image, ...(property.images || [])].filter(Boolean) as string[]
    return Array.from(new Set(images.length ? images : [primaryImage(property)]))
}

function mediaPagesFor(property: PropertyFeedItem) {
    const gallery = galleryFor(property)
    const baseGallery = gallery.length ? gallery : [primaryImage(property)]
    const pageCount = Math.min(3, Math.max(1, Math.ceil(baseGallery.length / 9)))

    return Array.from({ length: pageCount }, (_, pageIndex) =>
        Array.from({ length: 9 }, (_, imageIndex) => baseGallery[(pageIndex * 9 + imageIndex) % baseGallery.length])
    )
}

function statArea(property: PropertyFeedItem) {
    return property.area_private_m2 || property.area_m2 || null
}

function statRooms(property: PropertyFeedItem) {
    return property.suites || property.bedrooms || null
}

function readAmenity(property: PropertyFeedItem, pattern: RegExp) {
    return property.amenities?.find(item => pattern.test(item))
}

function featureBullets(property: PropertyFeedItem) {
    const location = locationLabel(property)
    const type = property.property_type || 'Imóvel'
    const roomCount = statRooms(property)
    const area = statArea(property)
    const description = buildPropertyFeedCopy(property).summary

    return [
        readAmenity(property, /frente|mar|vista/i) || `${type} com vista, desejo e liquidez no litoral.`,
        roomCount
            ? `${roomCount} ${property.suites ? 'suítes' : 'dormitórios'} com planta pensada para conforto e privacidade.`
            : 'Living integrado, acabamentos de alto padrão e atmosfera contemporânea.',
        readAmenity(property, /lazer|condom|seguran/i) || 'Condomínio exclusivo com lazer completo e segurança.',
        area ? `${area} m² de área privativa em ${location}.` : `Localização estratégica em ${location}.`,
        description || 'Curadoria Pilger para comprar com contexto, clareza e segurança.',
    ].slice(0, 5)
}

function FeatureIcon({ index }: { index: number }) {
    const icons = [Waves, BedDouble, Gem, MapPin, Sparkles]
    const Icon = icons[index] || Sparkles
    return <Icon className={`property-feature-icon feature-icon-${index}`} size={18} />
}

function contactPhoneFor(property: PropertyFeedItem) {
    return property.responsible_broker?.phone || WHATSAPP_PHONE
}

function connectedBrokerFor(property: PropertyFeedItem) {
    return property.responsible_broker?.is_connected ? property.responsible_broker : null
}

function brokerPhotoFor(property: PropertyFeedItem) {
    return connectedBrokerFor(property)?.photo_url || DEFAULT_BROKER_PHOTO
}

function brokerPhotoAltFor(property: PropertyFeedItem) {
    const broker = connectedBrokerFor(property)
    return broker?.photo_url ? `Foto de ${broker.name}` : 'Foto do corretor responsavel'
}

function storyPagesFor(storyItems: PropertyFeedItem[]) {
    const pages: PropertyFeedItem[][] = []
    for (let index = 0; index < storyItems.length; index += STORIES_PER_PAGE) {
        pages.push(storyItems.slice(index, index + STORIES_PER_PAGE))
    }
    return pages
}

function scrollToProperty(propertyId: string) {
    document
        .querySelector<HTMLElement>(`[data-property-id="${propertyId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function PropertyFeedExperience({ property, related }: Props) {
    const router = useRouter()
    const feedItems = useMemo(() => {
        const seen = new Set([property.id])
        return [
            property,
            ...related.filter(item => {
                if (seen.has(item.id)) return false
                seen.add(item.id)
                return true
            }),
        ].slice(0, MAX_FEED_ITEMS)
    }, [property, related])

    const [favoriteIds, setFavoriteIds] = useState<string[]>([])
    const [dislikedIds, setDislikedIds] = useState<string[]>([])
    const [historyIds, setHistoryIds] = useState<string[]>([])
    const [activeTabs, setActiveTabs] = useState<Record<string, FeedTab>>({})
    const [galleryState, setGalleryState] = useState<GalleryState>(null)
    const [openMenuFor, setOpenMenuFor] = useState<string | null>(null)
    const galleryTouchStart = useRef<{ x: number; y: number } | null>(null)
    const feedTouchStart = useRef<{ x: number; y: number; propertyId: string } | null>(null)

    useEffect(() => {
        if (!shouldOpenPropertyDetailsOnDesktop()) return

        const destination = propertyDetailsPath(property)
        void trackEvent('property_feed_desktop_redirected_to_details', {
            property_id: property.id,
            title: buildPropertyFeedCopy(property).title,
            destination,
        })
        router.replace(destination)
    }, [property, router])

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            setFavoriteIds(readStorageList(FAVORITES_KEY))
            setDislikedIds(readStorageList(DISLIKES_KEY))
            setHistoryIds(readStorageList(HISTORY_KEY))
        })

        return () => window.cancelAnimationFrame(frame)
    }, [])

    useEffect(() => {
        if (!openMenuFor) return

        const closeOnPointerDown = (event: PointerEvent) => {
            if (event.target instanceof Element && event.target.closest('.property-more-menu-wrap')) return
            setOpenMenuFor(null)
        }

        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpenMenuFor(null)
        }

        window.addEventListener('pointerdown', closeOnPointerDown)
        window.addEventListener('keydown', closeOnEscape)

        return () => {
            window.removeEventListener('pointerdown', closeOnPointerDown)
            window.removeEventListener('keydown', closeOnEscape)
        }
    }, [openMenuFor])

    useEffect(() => {
        const seenInSession = new Set<string>()
        const slides = Array.from(document.querySelectorAll<HTMLElement>('[data-property-slide]'))
        const observer = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting || entry.intersectionRatio < 0.72) return
                    const propertyId = (entry.target as HTMLElement).dataset.propertyId
                    const title = (entry.target as HTMLElement).dataset.propertyTitle
                    if (!propertyId) return

                    const currentHistory = readStorageList(HISTORY_KEY)
                    const nextHistory = [propertyId, ...currentHistory.filter(id => id !== propertyId)].slice(0, 40)
                    writeStorageList(HISTORY_KEY, nextHistory)
                    setHistoryIds(nextHistory)

                    if (!seenInSession.has(propertyId)) {
                        seenInSession.add(propertyId)
                        trackEvent('property_feed_slide_viewed', { property_id: propertyId, title })
                    }
                })
            },
            { threshold: [0.72] }
        )

        slides.forEach(slide => observer.observe(slide))
        return () => observer.disconnect()
    }, [feedItems])

    const toggleFavorite = useCallback((item: PropertyFeedItem) => {
        const isFavorite = favoriteIds.includes(item.id)
        const next = isFavorite
            ? favoriteIds.filter(id => id !== item.id)
            : [item.id, ...favoriteIds.filter(id => id !== item.id)].slice(0, 80)
        const nextDislikes = dislikedIds.filter(id => id !== item.id)
        setFavoriteIds(next)
        if (nextDislikes.length !== dislikedIds.length) {
            setDislikedIds(nextDislikes)
            writeStorageList(DISLIKES_KEY, nextDislikes)
        }
        writeStorageList(FAVORITES_KEY, next)
        trackEvent(isFavorite ? 'property_unfavorited' : 'property_favorited', {
            property_id: item.id,
            title: buildPropertyFeedCopy(item).title,
        })
    }, [dislikedIds, favoriteIds])

    const toggleDislike = useCallback((item: PropertyFeedItem) => {
        const isDisliked = dislikedIds.includes(item.id)
        const next = isDisliked
            ? dislikedIds.filter(id => id !== item.id)
            : [item.id, ...dislikedIds.filter(id => id !== item.id)].slice(0, 80)
        const nextFavorites = favoriteIds.filter(id => id !== item.id)

        setDislikedIds(next)
        if (nextFavorites.length !== favoriteIds.length) {
            setFavoriteIds(nextFavorites)
            writeStorageList(FAVORITES_KEY, nextFavorites)
        }
        writeStorageList(DISLIKES_KEY, next)
        trackEvent(isDisliked ? 'property_undisliked' : 'property_disliked', {
            property_id: item.id,
            title: buildPropertyFeedCopy(item).title,
        })
    }, [dislikedIds, favoriteIds])

    const openStoredProperty = useCallback((ids: string[], source: 'favorites' | 'history') => {
        const targetId = ids.find(id => feedItems.some(item => item.id === id)) || ids[0]
        if (!targetId) return

        setOpenMenuFor(null)
        const targetItem = feedItems.find(item => item.id === targetId)
        trackEvent('property_feed_saved_history_clicked', {
            source,
            count: ids.length,
            property_id: targetId,
            ...(targetItem ? { title: buildPropertyFeedCopy(targetItem).title } : {}),
        })

        if (targetItem) {
            scrollToProperty(targetId)
            return
        }

        window.location.assign(propertyDetailsPath(targetId))
    }, [feedItems])

    const shareProperty = useCallback(async (item: PropertyFeedItem) => {
        const url = new URL(propertyDetailsPath(item), window.location.origin).toString()
        const copy = buildPropertyFeedCopy(item)
        const title = copy.title
        const text = copy.summary || title
        if (navigator.share) {
            await navigator.share({ title, text, url }).catch(() => {})
        } else {
            await navigator.clipboard?.writeText(url).catch(() => {})
        }
        trackEvent('property_shared', { property_id: item.id, title })
    }, [])

    const openGallery = (item: PropertyFeedItem, index: number) => {
        setGalleryState({ property: item, index })
        trackEvent('property_gallery_opened', {
            property_id: item.id,
            title: buildPropertyFeedCopy(item).title,
            image_index: index,
        })
    }

    const setTab = (item: PropertyFeedItem, tab: FeedTab) => {
        setActiveTabs(current => ({ ...current, [item.id]: tab }))
        trackEvent('property_feed_tab_clicked', {
            property_id: item.id,
            title: buildPropertyFeedCopy(item).title,
            tab,
        })
    }

    const nextImage = useCallback(() => {
        if (!galleryState) return
        const gallery = galleryFor(galleryState.property)
        setGalleryState({ property: galleryState.property, index: (galleryState.index + 1) % gallery.length })
    }, [galleryState])

    const prevImage = useCallback(() => {
        if (!galleryState) return
        const gallery = galleryFor(galleryState.property)
        setGalleryState({ property: galleryState.property, index: (galleryState.index - 1 + gallery.length) % gallery.length })
    }, [galleryState])

    const handleGalleryTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
        const touch = event.changedTouches[0]
        galleryTouchStart.current = { x: touch.clientX, y: touch.clientY }
    }, [])

    const handleGalleryTouchEnd = useCallback((event: TouchEvent<HTMLDivElement>) => {
        const start = galleryTouchStart.current
        if (!start || !galleryState) return

        const touch = event.changedTouches[0]
        const deltaX = touch.clientX - start.x
        const deltaY = touch.clientY - start.y
        galleryTouchStart.current = null

        if (Math.abs(deltaX) < GALLERY_SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY) * 1.15) return

        if (deltaX < 0) {
            nextImage()
        } else {
            prevImage()
        }

        trackEvent('property_gallery_swiped', {
            property_id: galleryState.property.id,
            title: buildPropertyFeedCopy(galleryState.property).title,
            direction: deltaX < 0 ? 'next' : 'previous',
        })
    }, [galleryState, nextImage, prevImage])

    const handleFeedTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
        if (galleryState) return

        const touch = event.changedTouches[0]
        if (event.target instanceof Element && event.target.closest('.property-feed-map-shell')) return

        const slide = event.target instanceof Element
            ? event.target.closest<HTMLElement>('[data-property-slide]')
            : null
        const propertyId = slide?.dataset.propertyId
        if (!touch || !propertyId) return

        feedTouchStart.current = { x: touch.clientX, y: touch.clientY, propertyId }
    }, [galleryState])

    const handleFeedTouchEnd = useCallback((event: TouchEvent<HTMLElement>) => {
        const start = feedTouchStart.current
        feedTouchStart.current = null
        if (!start || galleryState) return

        const touch = event.changedTouches[0]
        if (!touch) return

        const deltaX = touch.clientX - start.x
        const deltaY = touch.clientY - start.y
        const absX = Math.abs(deltaX)
        const absY = Math.abs(deltaY)

        if (absY < FEED_SWIPE_THRESHOLD || absY < absX * FEED_VERTICAL_DOMINANCE) return

        const currentIndex = feedItems.findIndex(item => item.id === start.propertyId)
        if (currentIndex < 0) return

        const nextIndex = deltaY < 0 ? currentIndex + 1 : currentIndex - 1
        const nextItem = feedItems[nextIndex]
        if (!nextItem) return

        scrollToProperty(nextItem.id)
        trackEvent('property_feed_swiped', {
            from_property_id: start.propertyId,
            to_property_id: nextItem.id,
            title: buildPropertyFeedCopy(nextItem).title,
            direction: deltaY < 0 ? 'next' : 'previous',
        })
    }, [feedItems, galleryState])

    useEffect(() => {
        if (!galleryState) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setGalleryState(null)
            if (event.key === 'ArrowRight') nextImage()
            if (event.key === 'ArrowLeft') prevImage()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [galleryState, nextImage, prevImage])

    return (
        <main
            className="property-feed-page"
            aria-label="Feed de imóveis"
            onTouchStart={handleFeedTouchStart}
            onTouchEnd={handleFeedTouchEnd}
        >
            {feedItems.map((item, itemIndex) => {
                const gallery = galleryFor(item)
                const mediaPages = mediaPagesFor(item)
                const mapLatLng = getPropertyLatLng(item)
                const selectedTab = activeTabs[item.id] || 'photos'
                const activeTab = selectedTab === 'map' && !mapLatLng ? 'photos' : selectedTab
                const isFavorite = favoriteIds.includes(item.id)
                const isDisliked = dislikedIds.includes(item.id)
                const favoriteCount = favoriteIds.length || (isFavorite ? 1 : 0)
                const rooms = statRooms(item)
                const area = statArea(item)
                const bullets = featureBullets(item)
                const detailsHref = propertyDetailsPath(item)
                const copy = buildPropertyFeedCopy(item)
                const contactPhone = contactPhoneFor(item)
                const connectedBroker = connectedBrokerFor(item)
                const whatsappMetadata = {
                    property_id: item.id,
                    title: copy.title,
                    price: item.price || null,
                    city: item.city || null,
                    neighborhood: item.neighborhood || null,
                    property_type: item.property_type || null,
                    responsible_broker: item.responsible_broker?.name || null,
                    responsible_broker_connected: item.responsible_broker?.is_connected || false,
                    source: 'property_feed',
                }
                const storyItems = feedItems
                    .filter(story => story.id !== item.id && !dislikedIds.includes(story.id))
                    .slice(0, 12)
                const storyPages = storyPagesFor(storyItems)
                const similarTarget = storyItems[0]

                return (
                    <article
                        key={item.id}
                        className="property-feed-slide"
                        data-property-slide
                        data-property-id={item.id}
                        data-property-title={copy.title}
                    >
                        <div className="property-feed-card">
                            <header className="property-feed-header">
                                <Link href="/busca" className="property-icon-button" aria-label="Voltar para busca">
                                    <ArrowLeft size={22} />
                                </Link>
                                <strong>{copy.title}</strong>
                                <div className="property-top-actions">
                                    <button
                                        className={`property-icon-button property-heart-count ${isFavorite ? 'is-saved' : ''}`}
                                        type="button"
                                        aria-label={isFavorite ? 'Remover dos favoritos' : 'Salvar imóvel'}
                                        onClick={() => toggleFavorite(item)}
                                    >
                                        <Heart size={21} fill={isFavorite ? 'currentColor' : 'none'} />
                                        {favoriteCount > 0 && <span>{favoriteCount}</span>}
                                    </button>
                                    <button
                                        className={`property-icon-button property-dislike-button ${isDisliked ? 'is-disliked' : ''}`}
                                        type="button"
                                        aria-label={isDisliked ? 'Remover nÃ£o gostei' : 'NÃ£o gostei deste imÃ³vel'}
                                        onClick={() => toggleDislike(item)}
                                    >
                                        <ThumbsDown size={19} fill={isDisliked ? 'currentColor' : 'none'} />
                                    </button>
                                    <WhatsAppCaptureLink
                                        phone={contactPhone}
                                        message={`Olá! Quero saber mais sobre ${copy.title}.`}
                                        slug={`imovel-${item.id}`}
                                        template="property-feed-message"
                                        metadata={whatsappMetadata}
                                        className="property-icon-button"
                                        onClick={() => trackEvent('property_feed_message_clicked', { property_id: item.id, title: copy.title })}
                                    >
                                        <MessageCircle size={21} />
                                    </WhatsAppCaptureLink>
                                    <button className="property-icon-button" type="button" aria-label="Compartilhar imóvel" onClick={() => shareProperty(item)}>
                                        <Share2 size={21} />
                                    </button>
                                    <div className="property-more-menu-wrap">
                                        <button
                                            className={`property-icon-button ${openMenuFor === item.id ? 'is-active' : ''}`}
                                            type="button"
                                            aria-label="Mais opções"
                                            aria-expanded={openMenuFor === item.id}
                                            aria-haspopup="menu"
                                            onClick={() => setOpenMenuFor(current => current === item.id ? null : item.id)}
                                        >
                                            <MoreHorizontal size={22} />
                                        </button>
                                        {openMenuFor === item.id && (
                                            <div className="property-more-menu" role="menu">
                                                <button
                                                    type="button"
                                                    role="menuitem"
                                                    disabled={favoriteIds.length === 0}
                                                    onClick={() => openStoredProperty(favoriteIds, 'favorites')}
                                                >
                                                    <Heart size={16} />
                                                    <span>
                                                        <b>Imóveis curtidos</b>
                                                        <small>{favoriteIds.length ? `${favoriteIds.length} salvos` : 'Nenhum ainda'}</small>
                                                    </span>
                                                </button>
                                                <button
                                                    type="button"
                                                    role="menuitem"
                                                    disabled={historyIds.length === 0}
                                                    onClick={() => openStoredProperty(historyIds, 'history')}
                                                >
                                                    <Eye size={16} />
                                                    <span>
                                                        <b>Visualizados</b>
                                                        <small>{historyIds.length ? `${historyIds.length} recentes` : 'Nenhum ainda'}</small>
                                                    </span>
                                                </button>
                                                <button
                                                    type="button"
                                                    role="menuitem"
                                                    disabled={!similarTarget}
                                                    onClick={() => {
                                                        if (!similarTarget) return
                                                        setOpenMenuFor(null)
                                                        scrollToProperty(similarTarget.id)
                                                        trackEvent('property_feed_similar_clicked', {
                                                            property_id: item.id,
                                                            title: copy.title,
                                                            target_property_id: similarTarget.id,
                                                        })
                                                    }}
                                                >
                                                    <Sparkles size={16} />
                                                    <span>
                                                        <b>Ver parecidos</b>
                                                        <small>{similarTarget ? 'Próxima opção' : 'Sem opções agora'}</small>
                                                    </span>
                                                </button>
                                                <WhatsAppCaptureLink
                                                    phone={contactPhone}
                                                    message={`Olá! Quero falar com um especialista sobre ${copy.title}.`}
                                                    slug={`imovel-${item.id}`}
                                                    template="property-feed-menu-specialist"
                                                    metadata={whatsappMetadata}
                                                    className="property-more-menu-link"
                                                    onClick={() => {
                                                        setOpenMenuFor(null)
                                                        trackEvent('property_feed_menu_specialist_clicked', { property_id: item.id, title: copy.title })
                                                    }}
                                                >
                                                    <MessageCircle size={16} />
                                                    <span>
                                                        <b>Falar com especialista</b>
                                                        <small>Atendimento no WhatsApp</small>
                                                    </span>
                                                </WhatsAppCaptureLink>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        className={`property-save-button ${isFavorite ? 'is-saved' : ''}`}
                                        type="button"
                                        onClick={() => toggleFavorite(item)}
                                    >
                                        {isFavorite ? 'Salvo' : 'Salvar'}
                                    </button>
                                </div>
                            </header>

                            <section className="property-feed-profile">
                                <div className="property-profile-photo" aria-label="Corretor responsavel">
                                    <img
                                        src={brokerPhotoFor(item)}
                                        alt={brokerPhotoAltFor(item)}
                                        onError={event => {
                                            event.currentTarget.src = DEFAULT_BROKER_PHOTO
                                        }}
                                    />
                                </div>

                                <div className="property-profile-copy">
                                    <h1>{copy.title}</h1>
                                    <p>{copy.subtitle}</p>
                                    {connectedBroker && (
                                        <div className="property-broker-chip">
                                            {connectedBroker.photo_url && <img src={connectedBroker.photo_url} alt={connectedBroker.name} />}
                                            <span>Atendimento com {connectedBroker.name}</span>
                                        </div>
                                    )}
                                    <div className="property-profile-stats">
                                        <span><b>{gallery.length}</b>Fotos</span>
                                        <span><b>{compactPrice(item.price)}</b>Valor</span>
                                        <span><b>{area || '--'}{area ? ' m²' : ''}</b>Área</span>
                                    </div>
                                </div>
                            </section>

                            <section className="property-feed-bio" aria-label="Descrição do imóvel">
                                <p className="property-bio-kicker">
                                    {rooms ? `${rooms} ${item.suites ? 'suítes' : 'dormitórios'} • ${locationLabel(item)}` : locationLabel(item)}
                                </p>
                                <p className="property-bio-summary">{copy.summary}</p>
                                <div className="property-bio-lines">
                                    {bullets.slice(0, 3).map((bullet, index) => (
                                        <p key={`${item.id}-bullet-${index}`}>
                                            <FeatureIcon index={index} />
                                            <span>{bullet}</span>
                                        </p>
                                    ))}
                                </div>
                            </section>

                            <section className="property-feed-actions" aria-label="Ações de contato">
                                <WhatsAppCaptureLink
                                    phone={contactPhone}
                                    message={`Olá! Quero saber mais sobre ${copy.title}.`}
                                    slug={`imovel-${item.id}`}
                                    template="property-feed-whatsapp"
                                    metadata={whatsappMetadata}
                                    className="property-action primary"
                                    onClick={() => trackEvent('property_feed_whatsapp_clicked', { property_id: item.id, title: copy.title })}
                                >
                                    <MessageCircle size={20} /> WhatsApp
                                </WhatsAppCaptureLink>
                                <Link className="property-action details" href={detailsHref} onClick={() => trackEvent('property_details_clicked', { property_id: item.id, title: copy.title })}>
                                    <FileText size={19} /> Descrição completa
                                </Link>
                                <button className="property-action square" type="button" onClick={() => shareProperty(item)} aria-label="Mais opções">
                                    <MoreHorizontal size={22} />
                                </button>
                            </section>

                            {storyPages.length > 0 && (
                                <section className="property-feed-stories" aria-label="Imóveis semelhantes">
                                    <strong className="property-feed-stories-label">Semelhantes</strong>
                                    <div className="property-feed-stories-pages">
                                        {storyPages.map((page, pageIndex) => (
                                            <div className="property-feed-story-page" key={`${item.id}-story-page-${pageIndex}`}>
                                                {page.map((story, storyIndex) => {
                                                    const storyGallery = galleryFor(story)
                                                    const absoluteIndex = pageIndex * STORIES_PER_PAGE + storyIndex
                                                    return (
                                                        <button
                                                            key={`${item.id}-story-${story.id}`}
                                                            type="button"
                                                            aria-label={`Ver imovel semelhante ${absoluteIndex + 1}`}
                                                            onClick={() => scrollToProperty(story.id)}
                                                        >
                                                            <span>
                                                                <img
                                                                    src={storyGallery[absoluteIndex % storyGallery.length]}
                                                                    alt=""
                                                                    onError={event => fallbackImage(event, story)}
                                                                />
                                                            </span>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            <section className={`property-feed-tabs ${mapLatLng ? 'has-map' : ''}`} aria-label="Conteúdos do imóvel">
                                <button className={activeTab === 'photos' ? 'active' : ''} type="button" onClick={() => setTab(item, 'photos')}>
                                    <Grid3X3 size={19} /> Fotos
                                </button>
                                <button className={activeTab === 'videos' ? 'active' : ''} type="button" onClick={() => setTab(item, 'videos')}>
                                    <PlaySquare size={19} /> Vídeos
                                </button>
                                {mapLatLng && (
                                    <button className={activeTab === 'map' ? 'active' : ''} type="button" onClick={() => setTab(item, 'map')}>
                                        <MapPinned size={19} /> Mapa
                                    </button>
                                )}
                                <button className={activeTab === 'docs' ? 'active' : ''} type="button" onClick={() => setTab(item, 'docs')}>
                                    <FileText size={19} /> Documentos
                                </button>
                            </section>

                            <section className="property-feed-media">
                                {activeTab === 'photos' && (
                                    <div className="property-photo-carousel" aria-label={`Fotos de ${copy.title}`}>
                                        {mediaPages.map((page, pageIndex) => (
                                            <div className="property-photo-mosaic" key={`${item.id}-page-${pageIndex}`}>
                                                {page.map((image, index) => {
                                                    const galleryIndex = (pageIndex * 9 + index) % gallery.length

                                                    return (
                                                        <button key={`${item.id}-${image}-${pageIndex}-${index}`} type="button" onClick={() => openGallery(item, galleryIndex)}>
                                                            <img
                                                                src={image}
                                                                alt={`${copy.title} - foto ${pageIndex * 9 + index + 1}`}
                                                                loading={itemIndex === 0 && pageIndex === 0 ? 'eager' : 'lazy'}
                                                                onError={event => fallbackImage(event, item)}
                                                            />
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {activeTab === 'videos' && (
                                    <div className="property-feed-panel">
                                        <PlaySquare size={34} />
                                        <h2>{item.video_url ? 'Vídeo disponível' : 'Vídeos em curadoria'}</h2>
                                        <p>{item.video_url ? 'Abra o vídeo cadastrado para conhecer o imóvel com mais contexto.' : 'Quando houver vídeos ou tours deste imóvel, eles aparecerão aqui.'}</p>
                                        {item.video_url && <a href={item.video_url} target="_blank" rel="noreferrer">Ver vídeo</a>}
                                    </div>
                                )}

                                {activeTab === 'map' && mapLatLng && (
                                    <PropertyFeedMap property={item} latLng={mapLatLng} />
                                )}

                                {activeTab === 'docs' && (
                                    <div className="property-feed-panel">
                                        <FileText size={34} />
                                        <h2>Documentos e plantas</h2>
                                        <p>Plantas, memoriais e detalhes técnicos ficam disponíveis na página completa ou mediante solicitação.</p>
                                        <Link href={detailsHref}>Ver descrição detalhada</Link>
                                    </div>
                                )}
                            </section>

                            <div className={`property-feed-hint ${itemIndex < feedItems.length - 1 ? 'can-swipe' : 'is-end'}`} aria-hidden="true">
                                {itemIndex < feedItems.length - 1 ? <ChevronsUp size={16} /> : <ChevronDown size={16} />}
                                <span>{itemIndex < feedItems.length - 1 ? 'Arraste para cima' : 'Fim da seleção'}</span>
                            </div>
                        </div>
                    </article>
                )
            })}

            {galleryState && (
                <PropertyGalleryModal
                    images={galleryFor(galleryState.property)}
                    currentImage={galleryFor(galleryState.property)[galleryState.index] || primaryImage(galleryState.property)}
                    index={galleryState.index}
                    title={buildPropertyFeedCopy(galleryState.property).title || 'Imóvel'}
                    onClose={() => setGalleryState(null)}
                    onNext={nextImage}
                    onPrev={prevImage}
                    onTouchStart={handleGalleryTouchStart}
                    onTouchEnd={handleGalleryTouchEnd}
                    onImageError={event => fallbackImage(event, galleryState.property)}
                />
            )}
        </main>
    )
}
