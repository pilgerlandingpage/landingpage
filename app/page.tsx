'use client'

import { useState, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'
import Tracker from '../components/tracking/Tracker'
import PixelInjector from '../components/tracking/PixelInjector'
import ChatWidget from '../components/chat/ChatWidget'
import ExitIntentModal from '../components/landing/ExitIntentModal'
import { PropertyInfo, AmenitiesGrid } from '../components/landing/PropertyInfo'

// Demo data - this would come from the database in production
const DEMO_PROPERTY = {
  title: 'Residência de Luxo',
  subtitle: 'Vista panorâmica deslumbrante',
  description: 'Uma obra-prima da arquitetura contemporânea, com acabamentos de altíssimo padrão e vista permanente para o mar. Cada detalhe foi cuidadosamente projetado para oferecer uma experiência de vida incomparável.',
  bedrooms: 5,
  bathrooms: 6,
  area: 480,
  city: 'Balneário Camboriú',
  parking: 4,
  price: 8500000,
  amenities: ['Piscina Infinity', 'Heliponto', 'Spa Privativo', 'Adega Climatizada', 'Cinema', 'Academia'],
  heroImage: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1920&q=80',
  gallery: [
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80',
    'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
    'https://images.unsplash.com/photo-1571939228382-b2f2b585ce15?w=800&q=80',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
  ],
}

export default function LandingPage() {
  const [visitorId, setVisitorId] = useState<string>('')

  const handleVisitorReady = useCallback((id: string) => {
    setVisitorId(id)
  }, [])

  const handleScroll = () => {
    const detailsSection = document.getElementById('details')
    detailsSection?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      {/* Invisible tracking */}
      <Tracker landingPageSlug="home" onVisitorReady={handleVisitorReady} />

      {/* Dynamic pixel injection (would come from landing_pages table) */}
      <PixelInjector />

      {/* Hero Section */}
      <section className="landing-hero">
        <img
          src={DEMO_PROPERTY.heroImage}
          alt={DEMO_PROPERTY.title}
          className="hero-bg"
        />
        <div className="hero-content">
          <div className="hero-badge">Exclusividade</div>
          <h1 className="hero-title">
            {DEMO_PROPERTY.title}{' '}
            <span className="gold">{DEMO_PROPERTY.subtitle}</span>
          </h1>
          <p className="hero-subtitle">{DEMO_PROPERTY.description}</p>
          <button className="hero-cta" onClick={handleScroll}>
            Conhecer o Imóvel
            <ChevronDown size={20} />
          </button>
        </div>
        <div className="scroll-indicator">
          <div />
        </div>
      </section>

      {/* Property Details */}
      <section id="details" className="section">
        <div className="section-header">
          <h2 className="section-title">
            Detalhes do <span className="gold">Imóvel</span>
          </h2>
          <div className="gold-line" />
          <p className="section-subtitle">
            Cada metro quadrado pensado para o seu conforto
          </p>
        </div>
        <PropertyInfo
          bedrooms={DEMO_PROPERTY.bedrooms}
          bathrooms={DEMO_PROPERTY.bathrooms}
          area={DEMO_PROPERTY.area}
          city={DEMO_PROPERTY.city}
          parking={DEMO_PROPERTY.parking}
          price={DEMO_PROPERTY.price}
        />
      </section>

      {/* Gallery */}
      <section className="section">
        <div className="section-header">
          <h2 className="section-title">
            <span className="gold">Galeria</span> de Fotos
          </h2>
          <div className="gold-line" />
        </div>
        <div className="gallery-grid">
          {DEMO_PROPERTY.gallery.map((img, i) => (
            <div key={i} className="gallery-item">
              <img src={img} alt={`Vista ${i + 1}`} loading="lazy" />
            </div>
          ))}
        </div>
      </section>

      {/* Amenities */}
      <section className="section">
        <div className="section-header">
          <h2 className="section-title">
            Comodidades <span className="gold">Premium</span>
          </h2>
          <div className="gold-line" />
          <p className="section-subtitle">
            Tudo o que você precisa, a poucos passos de distância
          </p>
        </div>
        <AmenitiesGrid amenities={DEMO_PROPERTY.amenities} />
      </section>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '40px 24px',
        borderTop: '1px solid var(--border)',
        color: 'var(--text-muted)',
        fontSize: '0.85rem',
      }}>
        <p style={{ color: 'var(--gold)', fontFamily: 'Playfair Display, serif', fontSize: '1.2rem', marginBottom: '8px' }}>
          Pilger Imóveis
        </p>
        <p>© {new Date().getFullYear()} Todos os direitos reservados</p>
      </footer>

      {/* Chat Widget */}
      {visitorId && (
        <ChatWidget
          visitorId={visitorId}
          agentName="Concierge Pilger"
          greetingMessage="Olá! 👋 Seja bem-vindo à Pilger Imóveis. Sou seu concierge virtual e estou aqui para ajudá-lo a encontrar o imóvel perfeito. Como posso ajudá-lo hoje?"
        />
      )}

      {/* Exit Intent */}
      <ExitIntentModal />
    </>
  )
}
