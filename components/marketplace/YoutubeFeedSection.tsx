'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Instagram, MessageCircle, Play, PlayCircle, Youtube } from 'lucide-react'
import { openWhatsAppWithLeadCapture } from '@/lib/tracking/whatsapp-capture'

interface Video {
  id: string
  title: string
}

const TiktokIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19.589 6.686a4.793 4.793 0 0 1-3.97-1.53 4.747 4.747 0 0 1-1.359-3.644H10.15v13.13a2.868 2.868 0 0 1-3.418 2.82 2.872 2.872 0 0 1-2.316-2.318 2.868 2.868 0 0 1 2.82-3.42c.162 0 .322.015.48.046V7.614a6.974 6.974 0 0 0-7.702 7.7 6.978 6.978 0 0 0 6.96 6.944c3.844 0 6.96-3.116 6.96-6.96V9.456a8.887 8.887 0 0 0 5.655 2.01v-4.78z" />
  </svg>
)

function formatNumber(value: number) {
  return value.toLocaleString('pt-BR')
}

export default function YoutubeFeedSection() {
  const [videos, setVideos] = useState<Video[]>([])
  const [socialStats, setSocialStats] = useState({ instagram: 187000, tiktok: 210000, youtube: 119000 })
  const [loading, setLoading] = useState(true)
  const [playingVideo, setPlayingVideo] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 10)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10)
  }

  useEffect(() => {
    async function fetchMedia() {
      try {
        const [videoResponse, statsResponse] = await Promise.all([
          fetch('/api/youtube'),
          fetch('/api/social-stats'),
        ])

        const videoData = await videoResponse.json()
        if (videoData.videos?.length) setVideos(videoData.videos)

        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          setSocialStats({
            instagram: Number(statsData.instagram || 0),
            tiktok: Number(statsData.tiktok || 0),
            youtube: Number(statsData.youtube || 0),
          })
        }
      } catch (error) {
        console.error('Failed to load media block', error)
      } finally {
        setLoading(false)
        setTimeout(checkScroll, 100)
      }
    }

    fetchMedia()
  }, [])

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (!el) return

    el.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [videos])

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const cardWidth = el.querySelector('.media-video-card')?.clientWidth ?? 220
    el.scrollBy({
      left: direction === 'left' ? -(cardWidth + 12) : cardWidth + 12,
      behavior: 'smooth',
    })
  }

  const openWhatsAppCapture = () => {
    openWhatsAppWithLeadCapture({
      phone: '5547992528080',
      message: 'Olá! Vim pelo site e quero falar com o Guilherme.',
      slug: 'home',
      template: 'media-proof-whatsapp',
    })
  }

  const featuredVideo = videos[0]
  const sideVideos = videos.slice(1, 7)
  const socialCards = [
    {
      href: 'https://www.instagram.com/guilhermepilger/',
      name: 'Instagram',
      value: formatNumber(socialStats.instagram),
      label: 'seguidores',
      icon: <Instagram size={18} />,
      className: 'instagram',
    },
    {
      href: 'https://www.tiktok.com/@guilhermepilgeroficial',
      name: 'TikTok',
      value: formatNumber(socialStats.tiktok),
      label: 'seguidores',
      icon: <TiktokIcon />,
      className: 'tiktok',
    },
    {
      href: 'https://www.youtube.com/@guilhermepilger',
      name: 'YouTube',
      value: formatNumber(socialStats.youtube),
      label: 'inscritos',
      icon: <Youtube size={18} />,
      className: 'youtube',
    },
  ]

  return (
    <section className="media-proof-section">
      <div className="media-proof-container">
        <div className="media-proof-header">
          <div>
            <span className="media-kicker">Conteúdo + presença digital</span>
            <p>Tours, bastidores e audiência ativa para dar contexto antes da visita.</p>
          </div>
          <div className="media-actions">
            <a href="https://www.youtube.com/@guilhermepilger" target="_blank" rel="noopener noreferrer" className="media-main-link">
              <Youtube size={16} />
              Ver canal
            </a>
            <button type="button" className="media-main-link media-main-link-gold" onClick={openWhatsAppCapture}>
              <MessageCircle size={16} />
              WhatsApp
            </button>
          </div>
        </div>

        <div className="media-proof-grid">
          <article className="media-featured">
            {loading ? (
              <div className="media-loading">Carregando vídeos...</div>
            ) : featuredVideo && playingVideo === featuredVideo.id ? (
              <div className="media-video-wrapper media-video-wrapper-featured">
                <iframe
                  src={`https://www.youtube.com/embed/${featuredVideo.id}?autoplay=1`}
                  title={featuredVideo.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : featuredVideo ? (
              <button type="button" className="media-thumb media-thumb-featured" onClick={() => setPlayingVideo(featuredVideo.id)}>
                <Image
                  src={`https://img.youtube.com/vi/${featuredVideo.id}/maxresdefault.jpg`}
                  alt={featuredVideo.title}
                  fill
                  sizes="(max-width: 980px) calc(100vw - 28px), 58vw"
                  quality={68}
                />
                <span className="media-play"><Play /></span>
                <span className="media-badge">Vídeo em destaque</span>
              </button>
            ) : (
              <div className="media-loading">Vídeos indisponíveis no momento.</div>
            )}
            {featuredVideo && <h3>{featuredVideo.title}</h3>}
          </article>

          <aside className="media-side">
            <div className="media-social-row">
              {socialCards.map(card => (
                <a href={card.href} target="_blank" rel="noopener noreferrer" className={`media-social-card ${card.className}`} key={card.name}>
                  <span className="media-social-icon">{card.icon}</span>
                  <span className="media-social-name">{card.name}</span>
                  <strong>{card.value}</strong>
                  <small>{card.label}</small>
                </a>
              ))}
              <button type="button" className="media-social-card whatsapp" onClick={openWhatsAppCapture}>
                <span className="media-social-icon"><MessageCircle size={18} /></span>
                <span className="media-social-name">WhatsApp</span>
                <strong>1:1</strong>
                <small>consultoria</small>
              </button>
            </div>

            <div className="media-video-head">
              <span><PlayCircle size={14} /> Mais vídeos</span>
              <div className="media-arrows">
                <button type="button" onClick={() => scroll('left')} disabled={!canScrollLeft} aria-label="Vídeo anterior">
                  <ChevronLeft size={17} />
                </button>
                <button type="button" onClick={() => scroll('right')} disabled={!canScrollRight} aria-label="Próximo vídeo">
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>

            <div className="media-video-strip" ref={scrollRef}>
              {sideVideos.map(video => (
                <article className="media-video-card" key={video.id}>
                  {playingVideo === video.id ? (
                    <div className="media-video-wrapper">
                      <iframe
                        src={`https://www.youtube.com/embed/${video.id}?autoplay=1`}
                        title={video.title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <button type="button" className="media-thumb" onClick={() => setPlayingVideo(video.id)}>
                      <Image
                        src={`https://img.youtube.com/vi/${video.id}/mqdefault.jpg`}
                        alt={video.title}
                        fill
                        sizes="(max-width: 980px) 72vw, 230px"
                        quality={64}
                      />
                      <span className="media-play media-play-small"><Play /></span>
                    </button>
                  )}
                  <h4>{video.title}</h4>
                </article>
              ))}
            </div>
          </aside>
        </div>
      </div>

      <style jsx>{sectionStyles}</style>
    </section>
  )
}

const sectionStyles = `
  .media-proof-section {
    position: relative;
    overflow: hidden;
    padding: clamp(34px, 4.5vw, 58px) 20px;
    background:
      radial-gradient(circle at 12% 10%, rgba(216,185,121,0.18), transparent 34%),
      linear-gradient(180deg, #ffffff 0%, #f8f5ee 100%);
    color: #17130f;
  }
  .media-proof-container {
    max-width: 1320px;
    margin: 0 auto;
  }
  .media-proof-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 18px;
  }
  .media-kicker {
    display: inline-flex;
    color: #d8b979;
    font: 950 0.68rem/1 'Inter', sans-serif;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }
  .media-proof-header p {
    max-width: 560px;
    margin: 8px 0 0;
    color: #6d6255;
    font-size: 0.92rem;
    font-weight: 600;
    line-height: 1.45;
  }
  .media-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }
  .media-main-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 38px;
    padding: 0 13px;
    border: 1px solid rgba(23,19,15,0.1);
    border-radius: 999px;
    background: #17130f;
    color: #fff8ea !important;
    font: 950 0.68rem/1 'Inter', sans-serif;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .media-main-link-gold {
    border: 0;
    background: linear-gradient(135deg, #dfc18e, #b8945f);
    color: #11100e !important;
    cursor: pointer;
  }
  .media-proof-grid {
    display: grid;
    grid-template-columns: minmax(0, 0.98fr) minmax(420px, 0.72fr);
    gap: 18px;
    align-items: stretch;
  }
  .media-featured,
  .media-side {
    min-width: 0;
  }
  .media-featured h3 {
    display: -webkit-box;
    margin: 11px 0 0;
    overflow: hidden;
    color: #17130f;
    font-family: 'Playfair Display', Georgia, serif;
    font-size: clamp(1.1rem, 2vw, 1.45rem);
    line-height: 1.14;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
  .media-thumb,
  .media-video-wrapper,
  .media-loading {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border: 0;
    border-radius: 14px;
    background: #0b0a09;
    box-shadow: 0 18px 44px rgba(43,34,21,0.16);
  }
  .media-loading {
    display: grid;
    place-items: center;
    color: #6d6255;
    font-weight: 800;
  }
  .media-thumb {
    display: block;
    cursor: pointer;
  }
  .media-thumb::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.58), rgba(0,0,0,0.06) 62%);
  }
  .media-thumb img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.5s ease;
  }
  .media-thumb:hover img {
    transform: scale(1.04);
  }
  .media-video-wrapper iframe {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .media-play {
    position: absolute;
    left: 50%;
    top: 50%;
    z-index: 2;
    display: grid;
    place-items: center;
    width: 58px;
    height: 58px;
    border-radius: 50%;
    background: linear-gradient(135deg, #dfc18e, #b8945f);
    color: #11100e;
    transform: translate(-50%, -50%);
    box-shadow: 0 14px 30px rgba(0,0,0,0.26);
  }
  .media-play svg {
    width: 21px;
    height: 21px;
    margin-left: 3px;
  }
  .media-play-small {
    width: 38px;
    height: 38px;
  }
  .media-play-small svg {
    width: 15px;
    height: 15px;
  }
  .media-badge {
    position: absolute;
    left: 14px;
    bottom: 14px;
    z-index: 2;
    padding: 6px 9px;
    border-radius: 999px;
    background: rgba(17,13,10,0.72);
    color: #f4d999;
    font: 950 0.58rem/1 'Inter', sans-serif;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .media-side {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: 12px;
  }
  .media-social-row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }
  .media-social-card {
    display: grid;
    min-width: 0;
    min-height: 92px;
    padding: 11px 10px;
    border: 1px solid rgba(31,27,21,0.1);
    border-radius: 12px;
    background: rgba(255,255,255,0.86);
    color: #17130f !important;
    text-decoration: none;
    text-align: left;
    cursor: pointer;
  }
  .media-social-icon {
    display: inline-flex;
    color: #d8b979;
  }
  .media-social-card.instagram .media-social-icon { color: #e1306c; }
  .media-social-card.tiktok .media-social-icon { color: #8be8ef; }
  .media-social-card.youtube .media-social-icon { color: #ff6b6b; }
  .media-social-card.whatsapp .media-social-icon { color: #25d366; }
  .media-social-name {
    margin-top: 7px;
    color: #766a5a;
    font: 900 0.56rem/1 'Inter', sans-serif;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .media-social-card strong {
    margin-top: 4px;
    color: #17130f;
    font-family: 'Playfair Display', Georgia, serif;
    font-size: clamp(1.05rem, 1.7vw, 1.45rem);
    line-height: 1;
  }
  .media-social-card small {
    margin-top: 3px;
    color: #d8b979;
    font: 950 0.48rem/1 'Inter', sans-serif;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .media-video-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #766a5a;
    font: 900 0.68rem/1 'Inter', sans-serif;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .media-video-head span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .media-arrows {
    display: flex;
    gap: 6px;
  }
  .media-arrows button {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 1px solid rgba(31,27,21,0.1);
    border-radius: 50%;
    background: rgba(255,255,255,0.88);
    color: #17130f;
    cursor: pointer;
  }
  .media-arrows button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .media-video-strip {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    padding-bottom: 2px;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
  }
  .media-video-strip::-webkit-scrollbar {
    display: none;
  }
  .media-video-card {
    flex: 0 0 min(230px, 46%);
    min-width: 0;
    scroll-snap-align: start;
  }
  .media-video-card h4 {
    display: -webkit-box;
    margin: 7px 0 0;
    overflow: hidden;
    color: #17130f;
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 0.82rem;
    line-height: 1.2;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
  @media (max-width: 980px) {
    .media-proof-section {
      padding: 32px 14px;
    }
    .media-proof-header {
      display: block;
    }
    .media-actions {
      margin-top: 14px;
      overflow-x: auto;
      padding-bottom: 2px;
    }
    .media-proof-grid {
      grid-template-columns: 1fr;
    }
    .media-social-row {
      grid-template-columns: repeat(4, minmax(78px, 1fr));
      overflow-x: auto;
      padding-bottom: 2px;
      scrollbar-width: none;
    }
    .media-social-row::-webkit-scrollbar {
      display: none;
    }
    .media-social-card {
      min-height: 84px;
      padding: 10px 8px;
    }
    .media-video-card {
      flex-basis: 72vw;
    }
  }
`
