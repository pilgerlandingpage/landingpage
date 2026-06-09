'use client'

import { useEffect } from 'react'

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const

function hasAnyUtm(params: URLSearchParams) {
    return UTM_KEYS.some(key => Boolean(params.get(key)))
}

export default function PropertyLandingUrlTracker({ propertyId }: { propertyId: string }) {
    useEffect(() => {
        const url = new URL(window.location.href)
        const isLegacyDetailPath = /^\/imovel\/[0-9a-f-]{36}\/detalhes\/?$/i.test(url.pathname)
        if (!isLegacyDetailPath) return
        if (!UUID_PATTERN.test(propertyId)) return
        if (hasAnyUtm(url.searchParams)) return

        url.searchParams.set('utm_source', 'site')
        url.searchParams.set('utm_medium', 'property_page')
        url.searchParams.set('utm_campaign', 'property_manual_share')
        url.searchParams.set('utm_content', `property_${propertyId}`)

        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    }, [propertyId])

    return null
}
