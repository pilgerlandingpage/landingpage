'use client'

import { useState, useEffect, useRef } from 'react'
import { Play, ChevronLeft, ChevronRight } from 'lucide-react'

interface Video {
  id: string
  title: string
}

export default function YoutubeFeedSection() {
  const [videos, setVideos] = useState<Video[]>([])
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
    async function fetchVideos() {
      try {
        const res = await fetch('/api/youtube')
        const data = await res.json()
        if (data.videos && data.videos.length > 0) {
          setVideos(data.videos)
        }
      } catch (error) {
        console.error('Failed to load videos', error)
      } finally {
        setLoading(false)
        setTimeout(checkScroll, 100) // Verifica scroll logo após carregar os vídeos
      }
    }
    fetchVideos()
  }, [])

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (el) {
      el.addEventListener('scroll', checkScroll, { passive: true })
      window.addEventListener('resize', checkScroll)
    }
    return () => {
      el?.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [videos])

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const cardWidth = el.querySelector('.yt-card')?.clientWidth ?? 300
    const gap = 24
    const scrollAmount = cardWidth + gap
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  if (loading) {
    return (
      <section className="youtube-section">
        <div className="yt-container">
          <div className="yt-header">
            <div className="yt-header-left">
              <h2 className="yt-title">Acompanhe no YouTube</h2>
              <p className="yt-subtitle">Carregando os últimos vídeos...</p>
            </div>
          </div>
        </div>
      </section>
    )
  }

  // Se falhar silenciosamente ou não tiver vídeos, esconde a seção
  if (!videos || videos.length === 0) return null

  return (
    <section className="youtube-section">
      <div className="yt-container">
        <div className="yt-header">
          <div className="yt-header-left">
            <h2 className="yt-title">Acompanhe no YouTube</h2>
            <p className="yt-subtitle">
              Tours exclusivos, dicas de investimento e o melhor do mercado imobiliário.
            </p>
          </div>
          <div className="yt-header-right">
            <div className="carousel-arrows">
              <button
                className={`arrow-btn ${!canScrollLeft ? 'disabled' : ''}`}
                onClick={() => scroll('left')}
                aria-label="Anterior"
                disabled={!canScrollLeft}
              >
                <ChevronLeft size={24} />
              </button>
              <button
                className={`arrow-btn ${!canScrollRight ? 'disabled' : ''}`}
                onClick={() => scroll('right')}
                aria-label="Próximo"
                disabled={!canScrollRight}
              >
                <ChevronRight size={24} />
              </button>
            </div>
          </div>
        </div>

        <div className="yt-grid" ref={scrollRef}>
          {videos.map((video, index) => (
            <div key={`${video.id}-${index}`} className="yt-card">
              {playingVideo === video.id ? (
                <div className="yt-video-wrapper">
                  <iframe
                    src={`https://www.youtube.com/embed/${video.id}?autoplay=1`}
                    title={video.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
              ) : (
                <div 
                  className="yt-thumbnail-wrapper"
                  onClick={() => setPlayingVideo(video.id)}
                >
                  <img
                    src={`https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`}
                    alt={video.title}
                    className="yt-thumbnail"
                  />
                  <div className="yt-play-overlay">
                    <div className="yt-play-button">
                      <Play className="yt-play-icon" />
                    </div>
                  </div>
                </div>
              )}
              <h3 className="yt-video-title">{video.title}</h3>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .youtube-section {
          background-color: #f8f9fa; /* Light background for contrast */
          padding: 80px 20px;
          color: #111;
        }
        .yt-container {
          max-width: 1200px;
          margin: 0 auto;
        }
        .yt-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 40px;
          gap: 20px;
        }
        .yt-header-left {
          flex: 1;
        }
        .yt-title {
          font-family: 'Inter', sans-serif;
          font-size: clamp(1.6rem, 6vw, 2.2rem);
          font-weight: 800;
          margin: 0 0 8px 0;
          color: #111;
          white-space: nowrap;
          letter-spacing: -0.02em;
        }
        .yt-subtitle {
          color: #666;
          font-size: 1rem;
          margin: 0;
        }
        
        .yt-header-right {
          display: flex;
          align-items: center;
        }
        
        .carousel-arrows {
          display: flex;
          gap: 10px;
        }
        
        .arrow-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 1px solid #ddd;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #333;
          transition: all 0.2s ease;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        
        .arrow-btn:hover:not(.disabled) {
          border-color: red;
          color: red;
          background: #fff;
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(255,0,0,0.1);
        }
        
        .arrow-btn.disabled {
          opacity: 0.3;
          cursor: default;
          box-shadow: none;
        }
        
        @media (max-width: 768px) {
          .yt-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .carousel-arrows {
            display: none; /* Esconder setas no celular, usar apenas o touch */
          }
        }
        
        .yt-grid {
          display: flex;
          overflow-x: auto;
          gap: 24px;
          padding-bottom: 30px;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          /* Ocultar barra de rolagem mas manter funcional */
          scrollbar-width: none;
        }
        
        .yt-grid::-webkit-scrollbar {
          display: none;
        }

        .yt-card {
          flex: 0 0 85vw; /* Ocupa 85% da tela no celular */
          scroll-snap-align: start;
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        
        @media (min-width: 768px) {
          .yt-card {
            flex: 0 0 calc(50% - 12px);
          }
        }
        
        @media (min-width: 1024px) {
          .yt-card {
            flex: 0 0 calc(33.333% - 16px);
          }
        }
        
        @media (min-width: 1200px) {
          .yt-card {
            flex: 0 0 380px; /* Tamanho fixo em telas muito grandes */
          }
        }

        .yt-thumbnail-wrapper {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          background-color: #ddd;
          box-shadow: 0 10px 30px rgba(0,0,0,0.08);
        }
        
        .yt-thumbnail {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }
        
        .yt-thumbnail-wrapper:hover .yt-thumbnail {
          transform: scale(1.05);
        }

        .yt-play-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.3s ease;
        }
        
        .yt-thumbnail-wrapper:hover .yt-play-overlay {
          background: rgba(0,0,0,0.4);
        }

        .yt-play-button {
          width: 60px;
          height: 60px;
          background-color: red;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 15px rgba(255,0,0,0.4);
          transition: transform 0.2s ease;
        }
        
        .yt-thumbnail-wrapper:hover .yt-play-button {
          transform: scale(1.1);
        }
        
        .yt-play-icon {
          color: white;
          width: 24px;
          height: 24px;
          margin-left: 4px; /* visually center the play triangle */
        }

        .yt-video-wrapper {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: 12px;
          overflow: hidden;
          background: #000;
          box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        }
        
        .yt-video-wrapper iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }

        .yt-video-title {
          font-family: 'Inter', sans-serif;
          font-size: 1.1rem;
          font-weight: 700;
          line-height: 1.4;
          margin: 0;
          color: #222;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </section>
  )
}
