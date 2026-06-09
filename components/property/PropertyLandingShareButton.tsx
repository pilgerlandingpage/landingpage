'use client'

import { Share2 } from 'lucide-react'
import { trackEvent } from '@/lib/tracking/client'

type Props = {
    propertyId: string
    title: string
}

function copyParam(source: URLSearchParams, target: URLSearchParams, key: string) {
    const value = source.get(key)
    if (value && !target.get(key)) target.set(key, value)
}

function buildTrackedShareUrl(propertyId: string, title: string) {
    const current = new URL(window.location.href)
    const tracked = new URL('/api/track', window.location.origin)

    tracked.searchParams.set('ct', 'property')
    tracked.searchParams.set('pid', propertyId)
    tracked.searchParams.set('e', 'site_property_share_click')
    tracked.searchParams.set('t', 'property')
    tracked.searchParams.set('s', current.searchParams.get('utm_source') || 'site')
    tracked.searchParams.set('m', 'share')
    tracked.searchParams.set('c', 'property_manual_share')
    tracked.searchParams.set('i', current.searchParams.get('utm_content') || `property_${propertyId}`)
    tracked.searchParams.set('lb', 'Compartilhar')
    tracked.searchParams.set('lt', title.slice(0, 64))

    copyParam(current.searchParams, tracked.searchParams, 'lead_id')
    copyParam(current.searchParams, tracked.searchParams, 'lead_phone')
    copyParam(current.searchParams, tracked.searchParams, 'wa_phone')
    copyParam(current.searchParams, tracked.searchParams, 'wpp_phone')

    return tracked.toString()
}

export default function PropertyLandingShareButton({ propertyId, title }: Props) {
    const handleShare = async () => {
        const url = buildTrackedShareUrl(propertyId, title)
        const text = `${title} - Guilherme Pilger`

        try {
            if (navigator.share) {
                await navigator.share({ title, text, url })
            } else {
                await navigator.clipboard?.writeText(url)
            }
        } catch {
            return
        }

        void trackEvent('property_shared', {
            property_id: propertyId,
            title,
            target_url: url,
            source: 'property_details_landing',
        })
    }

    return (
        <button type="button" onClick={handleShare}>
            <Share2 size={16} /> Compartilhar
        </button>
    )
}
