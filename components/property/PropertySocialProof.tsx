'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Instagram, Play, Youtube } from 'lucide-react'

type InstagramPost = {
    id: string
    caption?: string | null
    media_url?: string | null
    thumbnail_url?: string | null
    permalink?: string | null
    media_type?: string | null
}

type YoutubeVideo = {
    id: string
    title: string
}

function cleanCaption(value?: string | null) {
    return (value || 'Publicação Pilger').split('\n')[0].slice(0, 92)
}

export function PropertyInstagramStrip() {
    const [posts, setPosts] = useState<InstagramPost[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let active = true

        fetch('/api/instagram?limit=4')
            .then(response => response.ok ? response.json() : null)
            .then(data => {
                if (!active) return
                const media = Array.isArray(data?.media) ? data.media : []
                setPosts(media.slice(0, 4))
            })
            .catch(() => null)
            .finally(() => {
                if (active) setLoading(false)
            })

        return () => {
            active = false
        }
    }, [])

    if (!loading && posts.length === 0) return null

    return (
        <section className="plp-instagram-strip" aria-label="Ultimas publicacoes do Instagram">
            <div className="plp-social-mini-head">
                <span><Instagram size={15} /> Instagram</span>
                <a href="https://www.instagram.com/guilhermepilger" target="_blank" rel="noopener noreferrer">
                    Ver perfil <ExternalLink size={13} />
                </a>
            </div>
            <div className="plp-instagram-grid">
                {(loading ? Array.from({ length: 4 }) : posts).map((item, index) => {
                    const post = item as InstagramPost
                    const image = post?.thumbnail_url || post?.media_url
                    const href = post?.permalink || 'https://www.instagram.com/guilhermepilger'
                    const caption = cleanCaption(post?.caption)

                    return (
                        <a
                            className={`plp-instagram-card ${loading ? 'loading' : ''}`}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            key={post?.id || `loading-${index}`}
                            aria-label={caption}
                        >
                            {image ? <img src={image} alt={caption} loading="lazy" /> : <span />}
                            {!loading && <strong>{caption}</strong>}
                        </a>
                    )
                })}
            </div>
        </section>
    )
}

export function PropertyLatestYoutubeVideo() {
    const [video, setVideo] = useState<YoutubeVideo | null>(null)
    const [loading, setLoading] = useState(true)
    const [playing, setPlaying] = useState(false)

    useEffect(() => {
        let active = true

        fetch('/api/youtube')
            .then(response => response.ok ? response.json() : null)
            .then(data => {
                if (!active) return
                const latest = Array.isArray(data?.videos) ? data.videos[0] : null
                if (latest?.id && latest?.title) setVideo(latest)
            })
            .catch(() => null)
            .finally(() => {
                if (active) setLoading(false)
            })

        return () => {
            active = false
        }
    }, [])

    if (!loading && !video) return null

    return (
        <section className="plp-youtube-latest" aria-label="Ultimo video publicado no YouTube">
            <div className="plp-section-head compact">
                <span className="plp-kicker">Canal Pilger</span>
                <h2>Último vídeo publicado no canal.</h2>
            </div>

            {loading ? (
                <div className="plp-youtube-loading">Carregando vídeo mais recente...</div>
            ) : video && playing ? (
                <div className="plp-youtube-frame">
                    <iframe
                        src={`https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1`}
                        title={video.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                </div>
            ) : video ? (
                <button type="button" className="plp-youtube-thumb" onClick={() => setPlaying(true)}>
                    <img src={`https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`} alt={video.title} loading="lazy" />
                    <span className="plp-youtube-play"><Play size={22} fill="currentColor" /></span>
                    <strong>{video.title}</strong>
                </button>
            ) : null}

            {video && (
                <a className="plp-youtube-channel-link" href="https://www.youtube.com/@guilhermepilger" target="_blank" rel="noopener noreferrer">
                    <Youtube size={15} /> Ver canal no YouTube
                </a>
            )}
        </section>
    )
}
