'use client'

import { useEffect, useState, useRef } from 'react'
import { Instagram, MessageCircle, PlayCircle, Youtube } from 'lucide-react'
import { openWhatsAppWithLeadCapture } from '@/lib/tracking/whatsapp-capture'

function useCountUp(end: number, startAnim: boolean, duration: number = 2500) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!startAnim || end === 0) return

    let startTime: number | null = null
    let animationFrame: number

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      setCount(Math.floor(easeOut * end))

      if (progress < 1) {
        animationFrame = requestAnimationFrame(step)
      }
    }

    animationFrame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animationFrame)
  }, [end, duration, startAnim])

  return count
}

const TiktokIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19.589 6.686a4.793 4.793 0 0 1-3.97-1.53 4.747 4.747 0 0 1-1.359-3.644H10.15v13.13a2.868 2.868 0 0 1-3.418 2.82 2.872 2.872 0 0 1-2.316-2.318 2.868 2.868 0 0 1 2.82-3.42c.162 0 .322.015.48.046V7.614a6.974 6.974 0 0 0-7.702 7.7 6.978 6.978 0 0 0 6.96 6.944c3.844 0 6.96-3.116 6.96-6.96V9.456a8.887 8.887 0 0 0 5.655 2.01v-4.78z" />
  </svg>
)

export default function SocialProofSection() {
  const [stats, setStats] = useState({ instagram: 0, tiktok: 0, youtube: 0 })
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    fetch('/api/social-stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error('Falha ao buscar stats sociais', err))
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.25 }
    )

    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  const igCount = useCountUp(stats.instagram, isVisible)
  const tkCount = useCountUp(stats.tiktok, isVisible)
  const ytCount = useCountUp(stats.youtube, isVisible)
  const formatNumber = (num: number) => num.toLocaleString('pt-BR')

  const cards = [
    {
      href: 'https://www.instagram.com/guilhermepilger/',
      name: 'Instagram',
      label: 'Bastidores, tours e desejo',
      value: formatNumber(igCount),
      metric: 'seguidores',
      icon: <Instagram size={22} />,
      className: 'ig',
    },
    {
      href: 'https://www.tiktok.com/@guilhermepilgeroficial',
      name: 'TikTok',
      label: 'Cortes rápidos do mercado',
      value: formatNumber(tkCount),
      metric: 'seguidores',
      icon: <TiktokIcon />,
      className: 'tk',
    },
    {
      href: 'https://www.youtube.com/@guilhermepilger',
      name: 'YouTube',
      label: 'Tours completos e análises',
      value: formatNumber(ytCount),
      metric: 'inscritos',
      icon: <Youtube size={22} />,
      className: 'yt',
    },
    {
      href: '#whatsapp',
      name: 'WhatsApp',
      label: 'Atendimento direto',
      value: '1:1',
      metric: 'consultoria',
      icon: <MessageCircle size={22} />,
      className: 'wa',
      capture: true,
    },
  ]

  const openWhatsAppCapture = () => {
    openWhatsAppWithLeadCapture({
      phone: '5547992528080',
      message: 'Olá! Vim pelo site e quero falar com o Guilherme.',
      slug: 'home',
      template: 'social-proof-whatsapp',
    })
  }

  return (
    <section className="social-proof-section" ref={sectionRef}>
      <div className="social-container">
        <div className="social-copy">
          <span className="social-kicker">Ecossistema Pilger</span>
          <h2>Presença digital que transforma oportunidade em desejo.</h2>
          <p>
            A audiência do Guilherme acompanha tours, opinião de mercado e bastidores.
            Para quem compra ou vende, isso vira alcance, contexto e velocidade.
          </p>
          <a href="https://www.instagram.com/guilhermepilger/" target="_blank" rel="noopener noreferrer" className="social-main-link">
            <PlayCircle size={17} />
            Acompanhar conteúdos
          </a>
        </div>

        <div className="social-grid">
          {cards.map((card) => {
            const content = (
              <>
                <span className="social-card-icon">{card.icon}</span>
                <span className="social-card-name">{card.name}</span>
                <strong>{card.value}</strong>
                <small>{card.metric}</small>
                <em>{card.label}</em>
              </>
            )

            if (card.capture) {
              return (
                <button type="button" className={`social-card ${card.className}`} key={card.name} onClick={openWhatsAppCapture}>
                  {content}
                </button>
              )
            }

            return (
              <a href={card.href} target="_blank" rel="noopener noreferrer" className={`social-card ${card.className}`} key={card.name}>
                {content}
              </a>
            )
          })}
        </div>
      </div>

      <style jsx>{`
        .social-proof-section {
          position: relative;
          overflow: hidden;
          padding: clamp(56px, 7vw, 96px) 20px;
          background:
            radial-gradient(circle at 16% 14%, rgba(223,193,142,0.15), transparent 32%),
            linear-gradient(135deg, #0f0e0d 0%, #1e1a16 100%);
          color: #fff8ea;
        }
        .social-proof-section::before {
          content: 'REDES SOCIAIS';
          position: absolute;
          right: -4vw;
          top: 8%;
          color: rgba(255,255,255,0.035);
          font-size: clamp(4rem, 13vw, 13rem);
          font-weight: 950;
          letter-spacing: 0.08em;
          white-space: nowrap;
        }
        .social-container {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
          gap: clamp(28px, 5vw, 70px);
          align-items: center;
          max-width: 1320px;
          margin: 0 auto;
        }
        .social-kicker {
          display: inline-flex;
          margin-bottom: 12px;
          color: #d8b979;
          font: 950 0.72rem/1 'Inter', sans-serif;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }
        .social-copy h2 {
          margin: 0;
          color: #fff8ea;
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(2.1rem, 5vw, 4.6rem);
          line-height: 0.98;
          letter-spacing: 0;
        }
        .social-copy p {
          max-width: 570px;
          margin: 18px 0 0;
          color: rgba(255,255,255,0.72);
          font-size: 1rem;
          font-weight: 520;
          line-height: 1.75;
        }
        .social-main-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 42px;
          margin-top: 26px;
          padding: 0 16px;
          border-radius: 999px;
          background: linear-gradient(135deg, #dfc18e, #b8945f);
          color: #111 !important;
          font-size: 0.74rem;
          font-weight: 950;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .social-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .social-card {
          position: relative;
          display: grid;
          min-height: 210px;
          padding: 20px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 18px;
          background: rgba(255,255,255,0.045);
          color: #fff8ea !important;
          box-shadow: 0 18px 44px rgba(0,0,0,0.2);
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          transition: transform 0.24s ease, background 0.24s ease, border-color 0.24s ease;
        }
        .social-card:hover {
          transform: translateY(-4px);
          border-color: rgba(223,193,142,0.24);
          background: rgba(255,255,255,0.075);
        }
        .social-card-icon {
          display: grid;
          place-items: center;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(223,193,142,0.12);
          color: #e5c98f;
        }
        .social-card-name {
          align-self: end;
          color: rgba(255,255,255,0.66);
          font-size: 0.72rem;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .social-card strong {
          margin-top: 4px;
          color: #fff;
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(1.75rem, 3vw, 2.65rem);
          line-height: 1;
        }
        .social-card small {
          margin-top: 5px;
          color: #d8b979;
          font-size: 0.64rem;
          font-weight: 950;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .social-card em {
          margin-top: 14px;
          color: rgba(255,255,255,0.58);
          font-size: 0.82rem;
          font-style: normal;
          font-weight: 650;
          line-height: 1.45;
        }
        .ig .social-card-icon { color: #f1a0c6; }
        .tk .social-card-icon { color: #8be8ef; }
        .yt .social-card-icon { color: #ff7a7a; }
        .wa .social-card-icon { color: #6ee7a4; }
        @media (max-width: 860px) {
          .social-container {
            grid-template-columns: 1fr;
          }
          .social-grid {
            gap: 10px;
          }
          .social-card {
            min-height: 176px;
            padding: 16px;
          }
          .social-card strong {
            font-size: clamp(1.45rem, 7vw, 2.1rem);
          }
        }
      `}</style>
    </section>
  )
}
