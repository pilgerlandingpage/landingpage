'use client'

import { useEffect, useState } from 'react'

type PropertyBrokerAvatarProps = {
    image?: string | null
    name: string
    lookupSlug?: string | null
}

function initialsFor(name: string) {
    return name
        .split(/\s+/)
        .map(part => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'GP'
}

function fallbackImageFor(name: string) {
    return /guilherme\s+pilger/i.test(name)
        ? '/images/eventos/guilherme-pilger-avatar.png'
        : ''
}

export default function PropertyBrokerAvatar({
    image,
    name,
    lookupSlug,
}: PropertyBrokerAvatarProps) {
    const [fetchedImage, setFetchedImage] = useState('')
    const [failedSources, setFailedSources] = useState<string[]>([])
    const fallbackImage = fallbackImageFor(name)
    const resolvedImage = [fetchedImage, image || '', fallbackImage].find(src => src && !failedSources.includes(src)) || ''

    useEffect(() => {
        const slug = typeof lookupSlug === 'string' ? lookupSlug.trim() : ''
        if (!slug) return

        let cancelled = false

        async function loadBrokerPhoto() {
            try {
                const response = await fetch(`/api/broker-for-page?slug=${encodeURIComponent(slug)}`, {
                    cache: 'no-store',
                })
                if (!response.ok) return
                const payload = await response.json()
                const photoUrl = typeof payload?.broker?.photo_url === 'string'
                    ? payload.broker.photo_url.trim()
                    : ''
                if (!cancelled && photoUrl) {
                    setFetchedImage(photoUrl)
                }
            } catch {
                // Keep the server-rendered initials when the dynamic broker lookup is unavailable.
            }
        }

        loadBrokerPhoto()

        return () => {
            cancelled = true
        }
    }, [lookupSlug])

    if (resolvedImage) {
        return (
            <img
                src={resolvedImage}
                alt={name}
                onError={() => {
                    setFailedSources(previous => previous.includes(resolvedImage)
                        ? previous
                        : [...previous, resolvedImage])
                }}
            />
        )
    }

    return (
        <span className="plp-broker-avatar" aria-label={name} role="img">
            {initialsFor(name)}
        </span>
    )
}
