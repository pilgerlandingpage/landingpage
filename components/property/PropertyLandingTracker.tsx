'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/tracking/client'
import { extractPropertyIdFromSeoSlug } from '@/lib/properties/seo-url'

type PropertyLandingTrackerProps = {
    propertyId: string
    title: string
    price?: number | null
    city?: string | null
    neighborhood?: string | null
    propertyType?: string | null
}

function cleanText(value: string | null | undefined) {
    return String(value || '').replace(/\s+/g, ' ').trim()
}

function relatedPropertyIdFromHref(href: string) {
    const match = href.match(/\/imovel\/([^/?#]+)\/detalhes/)
    return match?.[1] || extractPropertyIdFromSeoSlug(href)
}

function isWhatsAppCta(anchor: HTMLAnchorElement, href: string) {
    return (
        href === '#whatsapp-form' ||
        anchor.classList.contains('plp-whatsapp-button') ||
        anchor.classList.contains('plp-dark-button') ||
        anchor.classList.contains('plp-mobile-cta-button')
    )
}

export default function PropertyLandingTracker({
    propertyId,
    title,
    price,
    city,
    neighborhood,
    propertyType,
}: PropertyLandingTrackerProps) {
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const urlTracking = {
            utm_source: params.get('utm_source') || null,
            utm_medium: params.get('utm_medium') || null,
            utm_campaign: params.get('utm_campaign') || null,
            utm_term: params.get('utm_term') || null,
            utm_content: params.get('utm_content') || null,
            lead_id: params.get('lead_id') || null,
            lead_phone: params.get('lead_phone') || params.get('wa_phone') || params.get('wpp_phone') || null,
            event_type: params.get('event_type') || null,
            link_type: params.get('link_type') || null,
        }
        const baseMetadata = {
            property_id: propertyId,
            title,
            price: price || null,
            city: city || null,
            neighborhood: neighborhood || null,
            property_type: propertyType || null,
            source: 'property_details_landing',
            tracking: urlTracking,
        }

        void trackEvent('property_details_landing_viewed', baseMetadata)

        const root = document.querySelector<HTMLElement>('[data-property-landing-root="true"]')
        if (!root) return

        const handleClick = (event: MouseEvent) => {
            const target = event.target instanceof Element ? event.target : null
            if (!target) return

            const galleryItem = target.closest<HTMLElement>('.pd-gallery-item')
            if (galleryItem && root.contains(galleryItem)) {
                const index = Array.from(root.querySelectorAll('.pd-gallery-item')).indexOf(galleryItem)
                void trackEvent('property_details_landing_gallery_opened', {
                    ...baseMetadata,
                    image_index: index >= 0 ? index : null,
                })
                return
            }

            const anchor = target.closest<HTMLAnchorElement>('a')
            if (!anchor || !root.contains(anchor)) return

            const href = anchor.getAttribute('href') || ''
            const linkLabel = cleanText(anchor.textContent).slice(0, 90)

            if (isWhatsAppCta(anchor, href)) {
                void trackEvent('whatsapp_property_click', {
                    ...baseMetadata,
                    link_label: linkLabel || 'WhatsApp',
                })
                return
            }

            if (href.startsWith('#')) {
                void trackEvent('property_details_landing_anchor_clicked', {
                    ...baseMetadata,
                    target_section: href,
                    link_label: linkLabel,
                })
                return
            }

            if (href.includes('google.com/maps')) {
                void trackEvent('property_details_landing_map_clicked', {
                    ...baseMetadata,
                    link_label: linkLabel || 'Abrir no Google Maps',
                    target_url: href,
                })
                return
            }

            const targetPropertyId = relatedPropertyIdFromHref(href)
            if (targetPropertyId) {
                void trackEvent('property_details_landing_related_clicked', {
                    ...baseMetadata,
                    target_property_id: targetPropertyId,
                    link_label: linkLabel,
                    target_url: href,
                })
            }
        }

        root.addEventListener('click', handleClick)
        return () => root.removeEventListener('click', handleClick)
    }, [city, neighborhood, price, propertyId, propertyType, title])

    return null
}
