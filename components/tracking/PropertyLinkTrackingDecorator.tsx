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

    if (pathname.startsWith('/imoveis/')) {
        return pathname.match(UUID_PATTERN)?.[0] || null
    }

    return null
}

function hasAnyUtm(params: URLSearchParams) {
    return UTM_KEYS.some(key => Boolean(params.get(key)))
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

    if (/^\/imovel\/[0-9a-f-]{36}\/?$/i.test(url.pathname)) {
        url.pathname = `/imovel/${propertyId}/detalhes`
    }

    const currentParams = new URLSearchParams(window.location.search)
    if (!hasAnyUtm(url.searchParams)) {
        if (hasAnyUtm(currentParams)) {
            UTM_KEYS.forEach(key => copyParam(currentParams, url.searchParams, key))
        } else {
            url.searchParams.set('utm_source', 'site')
            url.searchParams.set('utm_medium', 'property_link')
            url.searchParams.set('utm_campaign', 'property_navigation')
        }
    }

    if (!url.searchParams.get('utm_content')) {
        url.searchParams.set('utm_content', linkContent(anchor, propertyId))
    }

    LEAD_KEYS.forEach(key => copyParam(currentParams, url.searchParams, key))
    anchor.href = `${url.pathname}${url.search}${url.hash}`
}

export default function PropertyLinkTrackingDecorator() {
    useEffect(() => {
        if (!isPublicSitePath(window.location.pathname)) return

        const decorateAll = () => {
            document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(decoratePropertyHref)
        }

        const handleClick = (event: MouseEvent) => {
            const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
            if (target) decoratePropertyHref(target)
        }

        decorateAll()

        const observer = new MutationObserver(() => decorateAll())
        observer.observe(document.body, { childList: true, subtree: true })
        document.addEventListener('click', handleClick, true)

        return () => {
            observer.disconnect()
            document.removeEventListener('click', handleClick, true)
        }
    }, [])

    return null
}
