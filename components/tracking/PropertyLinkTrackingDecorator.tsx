'use client'

import { useEffect } from 'react'

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const
const LEAD_KEYS = ['lead_id', 'lead_phone', 'wa_phone', 'wpp_phone'] as const

function isPublicSitePath(pathname: string) {
    return !(
        pathname.startsWith('/admin')
        || pathname.startsWith('/api')
        || pathname.startsWith('/_next')
        || pathname.startsWith('/login')
        || pathname.startsWith('/signup')
    )
}

function extractPropertyId(pathname: string) {
    const legacyMatch = pathname.match(/^\/imovel\/([0-9a-f-]{36})(?:\/detalhes)?\/?$/i)
    if (legacyMatch?.[1] && UUID_PATTERN.test(legacyMatch[1])) return legacyMatch[1]

    const propertyMatch = pathname.match(/^\/imovel\/([^/]+)(?:\/detalhes)?\/?$/i)
    if (propertyMatch?.[1]) return decodeURIComponent(propertyMatch[1])

    if (pathname.startsWith('/imoveis/')) {
        return pathname.match(UUID_PATTERN)?.[0] || null
    }

    return null
}

function hasAnyUtm(params: URLSearchParams) {
    return UTM_KEYS.some(key => Boolean(params.get(key)))
}

function hasAnyLeadParam(params: URLSearchParams) {
    return LEAD_KEYS.some(key => Boolean(params.get(key)))
}

function copyParam(source: URLSearchParams, target: URLSearchParams, key: string) {
    const value = source.get(key)
    if (value && !target.get(key)) target.set(key, value)
}

function linkContent(anchor: HTMLAnchorElement, propertyId: string) {
    const text = String(anchor.textContent || '').replace(/\s+/g, ' ').trim()
    if (text) {
        return text
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 48) || `property_${propertyId}`
    }

    return `property_${propertyId}`
}

function decoratePropertyHref(anchor: HTMLAnchorElement) {
    const rawHref = anchor.getAttribute('href')
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) return
    if (anchor.hasAttribute('download') || anchor.dataset.pilgerSkipUtm === 'true') return

    let url: URL
    try {
        url = new URL(rawHref, window.location.origin)
    } catch {
        return
    }

    if (url.origin !== window.location.origin || !isPublicSitePath(url.pathname)) return
    if (url.pathname.startsWith('/api/track')) return

    const propertyId = extractPropertyId(url.pathname)
    if (!propertyId) return

    const originalHref = `${url.pathname}${url.search}${url.hash}`
    if (/^\/imovel\/[0-9a-f-]{36}\/?$/i.test(url.pathname)) {
        url.pathname = `/imovel/${propertyId}/detalhes`
    }

    const currentParams = new URLSearchParams(window.location.search)
    const shouldCarryAttribution = hasAnyUtm(currentParams) || hasAnyLeadParam(currentParams) || hasAnyUtm(url.searchParams) || hasAnyLeadParam(url.searchParams)

    if (!shouldCarryAttribution) {
        const nextHref = `${url.pathname}${url.search}${url.hash}`
        if (nextHref !== originalHref) anchor.href = nextHref
        return
    }

    if (!hasAnyUtm(url.searchParams) && hasAnyUtm(currentParams)) {
        UTM_KEYS.forEach(key => copyParam(currentParams, url.searchParams, key))
    }

    if (!url.searchParams.get('utm_content') && hasAnyUtm(url.searchParams)) {
        url.searchParams.set('utm_content', linkContent(anchor, propertyId))
    }

    LEAD_KEYS.forEach(key => copyParam(currentParams, url.searchParams, key))
    const nextHref = `${url.pathname}${url.search}${url.hash}`
    if (nextHref !== originalHref) anchor.href = nextHref
}

export default function PropertyLinkTrackingDecorator() {
    useEffect(() => {
        if (!isPublicSitePath(window.location.pathname)) return

        let disposed = false
        let pending = false

        const decorateAll = () => {
            document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(decoratePropertyHref)
        }

        const scheduleDecorateAll = () => {
            if (pending || disposed) return
            pending = true

            const run = () => {
                pending = false
                if (!disposed) decorateAll()
            }

            if ('requestIdleCallback' in window) {
                window.requestIdleCallback(run, { timeout: 1000 })
            } else {
                globalThis.setTimeout(run, 80)
            }
        }

        const handleClick = (event: MouseEvent) => {
            const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
            if (target) decoratePropertyHref(target)
        }

        scheduleDecorateAll()

        const observer = new MutationObserver(() => scheduleDecorateAll())
        observer.observe(document.body, { childList: true, subtree: true })
        document.addEventListener('click', handleClick, true)

        return () => {
            disposed = true
            observer.disconnect()
            document.removeEventListener('click', handleClick, true)
        }
    }, [])

    return null
}
