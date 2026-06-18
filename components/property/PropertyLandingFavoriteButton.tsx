'use client'

import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { trackEvent } from '@/lib/tracking/client'

type Props = {
    propertyId: string
    title: string
    className?: string
    source?: string
}

const FAVORITES_KEY = 'pilger_property_favorites'

function readFavoriteIds() {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || '[]')
        return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : []
    } catch {
        return []
    }
}

function writeFavoriteIds(ids: string[]) {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids.slice(0, 80)))
    window.dispatchEvent(new CustomEvent('pilger:favorites-changed', { detail: { ids } }))
}

export default function PropertyLandingFavoriteButton({
    propertyId,
    title,
    className,
    source = 'property_details_landing',
}: Props) {
    const [isFavorite, setIsFavorite] = useState(false)

    useEffect(() => {
        const syncFavoriteState = () => {
            setIsFavorite(readFavoriteIds().includes(propertyId))
        }

        syncFavoriteState()
        window.addEventListener('storage', syncFavoriteState)
        window.addEventListener('pilger:favorites-changed', syncFavoriteState)

        return () => {
            window.removeEventListener('storage', syncFavoriteState)
            window.removeEventListener('pilger:favorites-changed', syncFavoriteState)
        }
    }, [propertyId])

    const handleClick = () => {
        const current = readFavoriteIds()
        const next = current.includes(propertyId)
            ? current.filter(id => id !== propertyId)
            : [propertyId, ...current.filter(id => id !== propertyId)]

        writeFavoriteIds(next)
        setIsFavorite(next.includes(propertyId))

        void trackEvent(current.includes(propertyId) ? 'property_unfavorited' : 'property_favorited', {
            property_id: propertyId,
            title,
            source,
            favorite_count: next.length,
        })
    }

    return (
        <button
            type="button"
            className={[className, isFavorite ? 'is-saved' : ''].filter(Boolean).join(' ')}
            aria-pressed={isFavorite}
            onClick={handleClick}
        >
            <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
            {isFavorite ? 'Salvo' : 'Salvar'}
        </button>
    )
}
