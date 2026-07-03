'use client'

import { useEffect, useRef } from 'react'
import { trackEvent } from '@/lib/tracking/client'

type BlogPostViewTrackerProps = {
    postId: string
    slug: string
    title: string
    contentType: 'blog' | 'news'
    category?: string | null
}

export default function BlogPostViewTracker({
    postId,
    slug,
    title,
    contentType,
    category,
}: BlogPostViewTrackerProps) {
    const trackedRef = useRef(false)

    useEffect(() => {
        if (trackedRef.current) return
        trackedRef.current = true

        const pagePath = window.location.pathname
        const pageUrl = window.location.href
        void trackEvent(contentType === 'news' ? 'news_post_viewed' : 'blog_post_viewed', {
            post_id: postId,
            post_slug: slug,
            content_id: postId,
            content_slug: slug,
            content_type: contentType,
            category: category || null,
            title,
            page_path: pagePath,
            page_url: pageUrl,
            canonical_url: `${window.location.origin}${pagePath}`,
            source: `${contentType}_detail`,
        })
    }, [category, contentType, postId, slug, title])

    return null
}
