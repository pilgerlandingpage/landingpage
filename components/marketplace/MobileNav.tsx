'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Heart, Search, Share2 } from 'lucide-react'
import { sharePropertyLanding } from '@/components/property/PropertyLandingShareButton'
import { openWhatsAppWithLeadCapture } from '@/lib/tracking/whatsapp-capture'
import { trackEvent } from '@/lib/tracking/client'

type MobileNavProps = {
    phone?: string
    message?: string
    slug?: string
    template?: string
    metadata?: Record<string, unknown>
    sharePropertyId?: string
    shareTitle?: string
    whatsappLabel?: string
    exploreHref?: string
}

export default function MobileNav({
    phone: explicitPhone,
    message: explicitMessage,
    slug = 'home',
    template = 'marketplace-home',
    metadata,
    sharePropertyId,
    shareTitle,
    whatsappLabel = 'Falar com Especialista',
    exploreHref = '/#mapa',
}: MobileNavProps = {}) {
    const router = useRouter()
    const pathname = usePathname()
    const [broker, setBroker] = useState<{ phone?: string; greeting_message?: string } | null>(null)

    useEffect(() => {
        if (explicitPhone) {
            return
        }

        fetch(`/api/broker-for-page?slug=${encodeURIComponent(slug)}`)
            .then(r => r.json())
            .then(d => { if (d?.broker) setBroker(d.broker) })
            .catch(() => {})
    }, [explicitPhone, slug])

    const openChat = useCallback(() => {
        const fallbackPhone = '5547992528080'
        const phone = explicitPhone || broker?.phone || fallbackPhone
        const message = explicitMessage || broker?.greeting_message || 'Ola! Quero falar com um especialista.'

        openWhatsAppWithLeadCapture({
            phone,
            message,
            slug,
            template,
            metadata,
        })
    }, [broker, explicitPhone, explicitMessage, slug, template, metadata])

    const shareProperty = useCallback(() => {
        if (!sharePropertyId || !shareTitle) return

        void sharePropertyLanding({
            propertyId: sharePropertyId,
            title: shareTitle,
            source: 'property_details_mobile_nav',
        }).catch(() => {})
    }, [sharePropertyId, shareTitle])

    const openFavorites = useCallback(() => {
        void trackEvent('mobile_nav_favorites_clicked', {
            source: slug,
            pathname,
        })

        router.push('/favoritos')
    }, [pathname, router, slug])

    const explore = useCallback(() => {
        const supportsCustomEvent = typeof window.CustomEvent === 'function'
        const openMapSearchEvent = supportsCustomEvent
            ? new CustomEvent('pilger:open-map-search', {
                cancelable: true,
                detail: { source: slug },
            })
            : document.createEvent('Event')

        if (!supportsCustomEvent) {
            openMapSearchEvent.initEvent('pilger:open-map-search', true, true)
        }

        const shouldFallbackToNavigation = window.dispatchEvent(openMapSearchEvent)
        if (!shouldFallbackToNavigation || openMapSearchEvent.defaultPrevented) {
            return
        }

        const [targetPath = '/', targetHash] = exploreHref.split('#')
        const normalizedTargetPath = targetPath || '/'

        if (targetHash && pathname === normalizedTargetPath) {
            const target = document.getElementById(targetHash)
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' })
                window.history.replaceState(null, '', `${normalizedTargetPath}#${targetHash}`)
                return
            }
        }

        router.push(exploreHref)
    }, [exploreHref, pathname, router, slug])

    const hasShareAction = Boolean(sharePropertyId && shareTitle)

    return (
        <div className="mobile-nav" style={{ gap: '0', justifyContent: 'space-evenly', padding: '0 8px' }}>
            <button type="button" className="nav-item active" onClick={explore}>
                <div className="nav-icon"><Search size={22} /></div>
                <span>Explorar</span>
            </button>
            <button type="button" className="nav-item" onClick={openFavorites}>
                <div className="nav-icon"><Heart size={22} /></div>
                <span>Favoritos</span>
            </button>
            {hasShareAction && (
                <button type="button" className="nav-item" onClick={shareProperty}>
                    <div className="nav-icon"><Share2 size={21} /></div>
                    <span>Compartilhar</span>
                </button>
            )}
            <div onClick={openChat} style={{
                cursor: 'pointer',
                backgroundColor: '#25D366',
                color: '#FFFFFF',
                padding: '10px 16px',
                borderRadius: '50px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 700,
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 14px rgba(37, 211, 102, 0.4)',
                transform: 'translateY(-2px)'
            }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                {whatsappLabel}
            </div>
        </div>
    )
}
