'use client'

import { useEffect, useState, useRef } from 'react'
import { Instagram, Youtube } from 'lucide-react'

// Hook customizado para animação dos números
function useCountUp(end: number, startAnim: boolean, duration: number = 2500) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!startAnim || end === 0) return

    let startTime: number | null = null
    let animationFrame: number

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      // easeOutExpo para ficar mais rápido no começo e devagar no fim
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

export default function SocialProofSection() {
  const [stats, setStats] = useState({ instagram: 0, tiktok: 0, youtube: 0 })
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    // Busca os dados da API
    fetch('/api/social-stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error("Falha ao buscar stats sociais", err))
  }, [])

  useEffect(() => {
    // Inicia a animação apenas quando o usuário chega na seção (scroll)
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const igCount = useCountUp(stats.instagram, isVisible)
  const tkCount = useCountUp(stats.tiktok, isVisible)
  const ytCount = useCountUp(stats.youtube, isVisible)

  // Formata número (ex: 187000 => 187.000)
  const formatNumber = (num: number) => num.toLocaleString('pt-BR')

  return (
    <section className="social-proof-section" ref={sectionRef}>
      <div className="watermark-bg">REDES SOCIAIS</div>
      
      <div className="social-container">
        
        {/* Lado Esquerdo - Cards */}
        <div className="social-cards-column">
          <div className="social-header">
            <h2>Maior presença digital do Sul do Brasil</h2>
            <p>Conectando milhares de pessoas todos os dias ao mercado de alto padrão de Balneário Camboriú.</p>
          </div>

          <div className="cards-grid">
            
            {/* Card Instagram */}
            <a href="https://www.instagram.com/guilhermepilger/" target="_blank" rel="noopener noreferrer" className="glass-card ig-card">
              <div className="card-icon ig-icon">
                <Instagram size={28} />
              </div>
              <div className="card-info">
                <h3>Instagram</h3>
                <div className="counter">
                  <span className="number">{formatNumber(igCount)}</span>
                  <span className="label">SEGUIDORES</span>
                </div>
              </div>
            </a>

            {/* Card TikTok */}
            <a href="https://www.tiktok.com/@guilhermepilger_" target="_blank" rel="noopener noreferrer" className="glass-card tk-card">
              <div className="card-icon tk-icon">
                {/* Ícone customizado do TikTok */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19.589 6.686a4.793 4.793 0 0 1-3.97-1.53 4.747 4.747 0 0 1-1.359-3.644H10.15v13.13a2.868 2.868 0 0 1-3.418 2.82 2.872 2.872 0 0 1-2.316-2.318 2.868 2.868 0 0 1 2.82-3.42c.162 0 .322.015.48.046V7.614a6.974 6.974 0 0 0-7.702 7.7 6.978 6.978 0 0 0 6.96 6.944c3.844 0 6.96-3.116 6.96-6.96V9.456a8.887 8.887 0 0 0 5.655 2.01v-4.14c-1.597.001-3.109-.623-4.24-1.75z"/>
                </svg>
              </div>
              <div className="card-info">
                <h3>TikTok</h3>
                <div className="counter">
                  <span className="number">{formatNumber(tkCount)}</span>
                  <span className="label">SEGUIDORES</span>
                </div>
              </div>
            </a>

            {/* Card YouTube */}
            <a href="https://www.youtube.com/@guilhermepilger" target="_blank" rel="noopener noreferrer" className="glass-card yt-card">
              <div className="card-icon yt-icon">
                <Youtube size={28} />
              </div>
              <div className="card-info">
                <h3>YouTube</h3>
                <div className="counter">
                  <span className="number">{formatNumber(ytCount)}</span>
                  <span className="label">INSCRITOS</span>
                </div>
              </div>
            </a>

          </div>
        </div>

        {/* Lado Direito - Imagem */}
        <div className="social-image-column">
          <div className="image-wrapper">
            <img 
              src="https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/mobile-transp-min.png" 
              alt="Guilherme Pilger Redes Sociais" 
              className="guilherme-phones-img"
            />
          </div>
        </div>

      </div>

      <style jsx>{`
        .social-proof-section {
          background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
          position: relative;
          overflow: hidden;
          padding: 80px 20px;
          border-top: 1px solid #222;
        }

        .watermark-bg {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-family: 'Inter', sans-serif;
          font-size: 20vw;
          font-weight: 900;
          color: rgba(255,255,255, 0.02);
          white-space: nowrap;
          z-index: 1;
          pointer-events: none;
          user-select: none;
        }

        .social-container {
          max-width: 1300px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
          z-index: 2;
          gap: 50px;
        }

        .social-cards-column {
          flex: 1;
          max-width: 600px;
        }

        .social-header {
          margin-bottom: 50px;
        }

        .social-header h2 {
          color: #fff;
          font-family: 'Inter', sans-serif;
          font-size: clamp(1.6rem, 5vw, 3rem);
          font-weight: 800;
          line-height: 1.2;
          margin: 0 0 15px 0;
          letter-spacing: -0.03em;
        }

        .social-header p {
          color: #aaa;
          font-size: clamp(0.95rem, 2vw, 1.1rem);
          line-height: 1.5;
          margin: 0;
        }

        .cards-grid {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .glass-card {
          display: flex;
          align-items: center;
          gap: 20px;
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 20px 30px;
          border-radius: 20px;
          text-decoration: none;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .glass-card:hover {
          transform: translateX(10px);
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.1);
        }

        /* Linha brilhante no topo do card ao passar o mouse */
        .glass-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 0%;
          height: 2px;
          transition: width 0.4s ease;
        }

        .ig-card:hover::before { background: linear-gradient(90deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888); width: 100%; }
        .tk-card:hover::before { background: linear-gradient(90deg, #69C9D0, #EE1D52); width: 100%; }
        .yt-card:hover::before { background: red; width: 100%; }

        .card-icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
        }

        .ig-icon { background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); }
        .tk-icon { background: #000; border: 1px solid #333; }
        .yt-icon { background: red; }

        .card-info h3 {
          color: #fff;
          font-family: 'Inter', sans-serif;
          font-size: 1.2rem;
          font-weight: 600;
          margin: 0 0 5px 0;
        }

        .counter {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }

        .number {
          color: #fff;
          font-family: 'Inter', sans-serif;
          font-size: 1.8rem;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .label {
          color: var(--gold, #b8945f);
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        .social-image-column {
          flex: 1;
          display: flex;
          justify-content: flex-end;
          align-items: flex-end;
          max-width: 650px;
        }

        .image-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .guilherme-phones-img {
          width: 100%;
          height: auto;
          object-fit: contain;
          filter: drop-shadow(0 20px 40px rgba(0,0,0,0.5));
        }

        @media (max-width: 1024px) {
          .social-container {
            flex-direction: column;
          }
          
          .social-header {
            text-align: center;
          }

          .social-cards-column {
            width: 100%;
            max-width: 100%;
            margin-bottom: 40px;
          }

          .glass-card:hover {
            transform: translateY(-5px);
          }

          .social-image-column {
            justify-content: center;
          }
        }
      `}</style>
    </section>
  )
}
