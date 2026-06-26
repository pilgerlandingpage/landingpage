import { ExternalLink, PlayCircle } from 'lucide-react'

type PropertyVideoProvider = 'youtube' | 'vimeo' | 'direct' | 'external'

export type PropertyVideoSource = {
    provider: PropertyVideoProvider
    url: string
    embedUrl?: string
    thumbnailUrl?: string
}

type PropertyVideoEmbedProps = {
    videoUrl?: string | null
    title: string
    className?: string
    poster?: string | null
}

function normalizedVideoUrl(url?: string | null) {
    const raw = String(url || '').trim()
    if (!raw) return ''
    if (/^https?:\/\//i.test(raw)) return raw
    return `https://${raw}`
}

function extractYouTubeId(rawUrl: string) {
    const directMatch = rawUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)
    if (directMatch) return directMatch[1]

    try {
        const url = new URL(rawUrl)
        const id = url.searchParams.get('v')
        return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
    } catch {
        return null
    }
}

function extractVimeoId(rawUrl: string) {
    const match = rawUrl.match(/vimeo\.com\/(?:video\/)?([0-9]+)/)
    return match?.[1] || null
}

function isDirectVideoUrl(rawUrl: string) {
    try {
        const url = new URL(rawUrl)
        return /\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(url.pathname)
    } catch {
        return /\.(mp4|webm|ogg|ogv|mov|m4v)(?:\?.*)?$/i.test(rawUrl)
    }
}

export function getPropertyVideoSource(videoUrl?: string | null): PropertyVideoSource | null {
    const url = normalizedVideoUrl(videoUrl)
    if (!url) return null

    const youtubeId = extractYouTubeId(url)
    if (youtubeId) {
        return {
            provider: 'youtube',
            url,
            embedUrl: `https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1&playsinline=1`,
            thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
        }
    }

    const vimeoId = extractVimeoId(url)
    if (vimeoId) {
        return {
            provider: 'vimeo',
            url,
            embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
        }
    }

    if (isDirectVideoUrl(url)) {
        return {
            provider: 'direct',
            url,
        }
    }

    return {
        provider: 'external',
        url,
    }
}

export function hasPropertyVideo(videoUrl?: string | null) {
    return Boolean(getPropertyVideoSource(videoUrl))
}

export default function PropertyVideoEmbed({
    videoUrl,
    title,
    className = '',
    poster,
}: PropertyVideoEmbedProps) {
    const source = getPropertyVideoSource(videoUrl)
    if (!source) return null

    const label = `${title} - vídeo do imóvel`

    if (source.provider === 'youtube' || source.provider === 'vimeo') {
        return (
            <div className={`plp-property-video-embed ${className}`.trim()}>
                <iframe
                    src={source.embedUrl}
                    title={label}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                />
            </div>
        )
    }

    if (source.provider === 'direct') {
        return (
            <div className={`plp-property-video-embed ${className}`.trim()}>
                <video controls playsInline preload="metadata" poster={poster || undefined}>
                    <source src={source.url} />
                    Seu navegador não conseguiu reproduzir este vídeo.
                </video>
            </div>
        )
    }

    return (
        <a
            className={`plp-property-video-embed plp-property-video-embed--external ${className}`.trim()}
            href={source.url}
            target="_blank"
            rel="noreferrer"
        >
            <PlayCircle size={42} />
            <span>
                <strong>Vídeo do imóvel</strong>
                <em>Abrir em nova aba</em>
            </span>
            <ExternalLink size={18} />
        </a>
    )
}
