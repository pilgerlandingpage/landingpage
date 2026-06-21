'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/tracking/client'
import { extractPropertyIdFromSeoSlug } from '@/lib/properties/seo-url'
import { markSearchAlertMatchOpenIfNeeded } from '@/lib/tracking/search-alert-session'

const HISTORY_KEY = 'pilger_property_history'

type PropertyLandingTrackerProps = {
    propertyId: string
    title: string
    price?: number | null
    city?: string | null
    neighborhood?: string | null
    propertyType?: string | null
    propertyPath?: string | null
    propertySlug?: string | null
}

function cleanText(value: string | null | undefined) {
    return String(value || '').replace(/\s+/g, ' ').trim()
}

function relatedPropertyIdFromHref(href: string) {
    const match = href.match(/\/imovel\/([^/?#]+)\/detalhes/)
    return match?.[1] || extractPropertyIdFromSeoSlug(href)
}

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function propertySlugFromPath(pathname: string) {
    const match = pathname.match(/\/imovel\/([^/?#]+)(?:\/detalhes)?/)
    const segment = match?.[1] ? decodeURIComponent(match[1]) : ''
    if (!segment || isUuid(segment)) return null
    return segment
}

function relatedPropertyFromHref(href: string) {
    const match = href.match(/\/imovel\/([^/?#]+)\/detalhes/)
    const segment = match?.[1] ? decodeURIComponent(match[1]) : ''
    const embeddedId = extractPropertyIdFromSeoSlug(segment || href)
    const propertyId = embeddedId || (segment && isUuid(segment) ? segment : null)
    const propertySlug = segment && !isUuid(segment) ? segment : null
    const propertyPath = segment ? `/imovel/${encodeURIComponent(segment)}/detalhes` : null

    return { propertyId, propertySlug, propertyPath }
}

function isWhatsAppCta(anchor: HTMLAnchorElement, href: string) {
    return (
        href === '#whatsapp-form' ||
        anchor.classList.contains('plp-whatsapp-button') ||
        anchor.classList.contains('plp-dark-button') ||
        anchor.classList.contains('plp-context-cta') ||
        anchor.classList.contains('plp-market-cta') ||
        anchor.classList.contains('plp-mobile-cta-button')
    )
}

function readStoredIds(key: string): string[] {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(key) || '[]')
        return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : []
    } catch {
        return []
    }
}

function rememberPropertyView(propertyId: string) {
    try {
        const current = readStoredIds(HISTORY_KEY)
        const next = [propertyId, ...current.filter(id => id !== propertyId)].slice(0, 40)
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
        window.dispatchEvent(new CustomEvent('pilger:history-changed', { detail: { ids: next } }))
    } catch {
        // localStorage can be unavailable in private or restricted contexts.
    }
}

const TRACKED_SECTIONS = [
    { id: 'ficha', label: 'Ficha rapida' },
    { id: 'historico-precos', label: 'Histórico e valor' },
    { id: 'localizacao', label: 'Localização' },
]

export default function PropertyLandingTracker({
    propertyId,
    title,
    price,
    city,
    neighborhood,
    propertyType,
    propertyPath,
    propertySlug,
}: PropertyLandingTrackerProps) {
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const alertId = params.get('alert_id') || null
        const alertTitle = params.get('alert_title') || null
        const pagePath = window.location.pathname
        const propertyUrl = window.location.href
        const resolvedPropertyPath = propertyPath || pagePath
        const resolvedPropertySlug = propertySlug || propertySlugFromPath(pagePath)
        const canonicalUrl = resolvedPropertyPath
            ? `${window.location.origin}${resolvedPropertyPath}`
            : propertyUrl
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
            alert_id: alertId,
            alert_title: alertTitle,
            page_path: pagePath,
            page_url: propertyUrl,
            property_path: resolvedPropertyPath,
            property_slug: resolvedPropertySlug,
            canonical_url: canonicalUrl,
        }
        const baseMetadata = {
            property_id: propertyId,
            property_slug: resolvedPropertySlug,
            property_path: resolvedPropertyPath,
            canonical_url: canonicalUrl,
            property_title: title,
            title,
            price: price || null,
            city: city || null,
            neighborhood: neighborhood || null,
            property_type: propertyType || null,
            alert_id: alertId,
            alert_title: alertTitle,
            property_url: propertyUrl,
            source: 'property_details_landing',
            tracking: urlTracking,
        }

        rememberPropertyView(propertyId)
        void trackEvent('property_details_landing_viewed', baseMetadata)

        if (alertId && markSearchAlertMatchOpenIfNeeded(alertId, propertyId)) {
            void trackEvent('property_search_alert_match_opened', {
                ...baseMetadata,
                source: 'property_details_landing_direct',
            })
        }

        const root = document.querySelector<HTMLElement>('[data-property-landing-root="true"]')
        if (!root) return
        const viewedSections = new Set<string>()
        const sectionObserver = typeof IntersectionObserver === 'undefined'
            ? null
            : new IntersectionObserver((entries, observer) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue
                    const section = entry.target instanceof HTMLElement
                        ? TRACKED_SECTIONS.find(item => item.id === entry.target.id)
                        : null
                    if (!section || viewedSections.has(section.id)) continue

                    viewedSections.add(section.id)
                    void trackEvent('property_details_landing_section_viewed', {
                        ...baseMetadata,
                        section_id: section.id,
                        section_label: section.label,
                        target_section: `#${section.id}`,
                    })
                    observer.unobserve(entry.target)
                }
            }, {
                root: null,
                rootMargin: '-18% 0px -18% 0px',
                threshold: 0.42,
            })

        if (sectionObserver) {
            for (const section of TRACKED_SECTIONS) {
                const element = root.querySelector<HTMLElement>(`#${section.id}`)
                if (element) sectionObserver.observe(element)
            }
        }

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
            const relatedProperty = relatedPropertyFromHref(href)
            if (targetPropertyId || relatedProperty.propertySlug) {
                void trackEvent('property_details_landing_related_clicked', {
                    ...baseMetadata,
                    target_property_id: relatedProperty.propertyId || null,
                    target_property_slug: relatedProperty.propertySlug || null,
                    target_property_path: relatedProperty.propertyPath || null,
                    link_label: linkLabel,
                    target_url: href,
                })
            }
        }

        root.addEventListener('click', handleClick)
        return () => {
            root.removeEventListener('click', handleClick)
            sectionObserver?.disconnect()
        }
    }, [city, neighborhood, price, propertyId, propertyPath, propertySlug, propertyType, title])

    return null
}
