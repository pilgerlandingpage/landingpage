import { createServerSupabase } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Bed, Bath, Move, MapPin, MessageCircle } from 'lucide-react'
import LandingPageLogic from '@/components/landing/LandingPageLogic'

// Force dynamic rendering (no caching) to ensure fresh data
export const dynamic = 'force-dynamic'

export default async function DynamicLandingPage({ params }: { params: { slug: string } }) {
    const supabase = await createServerSupabase()
    const { slug } = params

    // 1. Fetch Landing Page Config
    const { data: lp } = await supabase
        .from('landing_pages')
        .select(`
            *,
            properties (*),
            ai_agents (*)
        `)
        .eq('slug', slug)
        .single()

    if (!lp) {
        return notFound()
    }

    const property = lp.properties
    const agent = lp.ai_agents || {}

    // Use property data as fallback if LP overrides are empty (future proofing)
    const heroImage = lp.hero_image_url || property.featured_image
    const pageTitle = lp.title || property.title
    const primaryColor = lp.primary_color || '#c9a96e'

    const amenities = property.amenities || []
    const gallery = property.images || []

    return (
        <div style={{ '--primary-color': primaryColor } as React.CSSProperties}>
            {/* Tracking & Chat Logic */}
            <LandingPageLogic
                slug={slug}
                landingPageId={lp.id}
                agentName={agent.name}
                greetingMessage={agent.greeting_message}
            />

            {/* Hero Section */}
            <section className="lp-hero">
                <div className="lp-hero-overlay" />
                <img src={heroImage} className="lp-hero-bg" alt={pageTitle} />
                <div className="lp-hero-content">
                    <span className="lp-tag">Exclusividade Pilger</span>
                    <h1 className="lp-hero-title">{pageTitle}</h1>
                    <p className="lp-hero-subtitle">{lp.description || property.description?.slice(0, 150) + '...'}</p>

                    <div className="lp-price-tag">
                        {property.price ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(property.price) : 'Consulte'}
                    </div>

                    <button className="lp-cta-button">
                        Agendar Visita Exclusiva
                    </button>
                </div>
            </section>

            {/* Main Content Area */}
            <section className="lp-section">
                <div className="lp-container">
                    <div className="lp-grid">

                        {/* Left Column: Details */}
                        <div className="lp-details">
                            <h2 className="lp-section-title">Sobre o Imóvel</h2>
                            <p className="lp-description">
                                {property.description || 'Descrição detalhada do imóvel indisponível no momento.'}
                            </p>

                            <div className="lp-stats-grid">
                                <div className="lp-stat-card">
                                    <Bed size={24} color={primaryColor} />
                                    <span className="lp-stat-value">{property.bedrooms}</span>
                                    <span className="lp-stat-label">Quartos</span>
                                </div>
                                <div className="lp-stat-card">
                                    <Bath size={24} color={primaryColor} />
                                    <span className="lp-stat-value">{property.bathrooms}</span>
                                    <span className="lp-stat-label">Banheiros</span>
                                </div>
                                <div className="lp-stat-card">
                                    <Move size={24} color={primaryColor} />
                                    <span className="lp-stat-value">{property.area_m2}m²</span>
                                    <span className="lp-stat-label">Área Privativa</span>
                                </div>
                                <div className="lp-stat-card">
                                    <MapPin size={24} color={primaryColor} />
                                    <span className="lp-stat-value" style={{ fontSize: '0.9rem' }}>{property.city}</span>
                                    <span className="lp-stat-label">Localização</span>
                                </div>
                            </div>

                            <h3 className="lp-subsection-title">Diferenciais</h3>
                            <ul className="lp-amenities-list">
                                {amenities.map((item: string, i: number) => (
                                    <li key={i} className="lp-amenity-item">
                                        <div className="lp-check-icon">✓</div>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Right Column: Gallery/Form */}
                        <div className="lp-sidebar">
                            <div className="lp-form-card">
                                <h3>Interessado?</h3>
                                <p>Fale com nossa IA especialista agora mesmo.</p>
                                {/* This connects to the Chat Widget implicitly via the button */}
                                <button className="lp-cta-button full-width">
                                    <MessageCircle size={20} />
                                    Iniciar Conversa
                                </button>
                            </div>

                            <div className="lp-gallery-preview">
                                {gallery.slice(0, 4).map((img: string, i: number) => (
                                    <img key={i} src={img} alt="Galeria" className="lp-gallery-thumb" />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="lp-footer">
                <p>© {new Date().getFullYear()} Pilger Imóveis. Todos os direitos reservados.</p>
            </footer>

            <style>{`
                .lp-hero {
                    height: 80vh;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    text-align: center;
                }
                .lp-hero-bg {
                    position: absolute;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    object-fit: cover;
                    z-index: -2;
                }
                .lp-hero-overlay {
                    position: absolute;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    background: rgba(0,0,0,0.5);
                    z-index: -1;
                }
                .lp-hero-content {
                    max-width: 800px;
                    padding: 24px;
                    z-index: 10;
                }
                .lp-tag {
                    background: var(--primary-color);
                    color: black;
                    padding: 6px 16px;
                    border-radius: 20px;
                    font-weight: 600;
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .lp-hero-title {
                    font-family: 'Playfair Display', serif;
                    font-size: 3.5rem;
                    margin: 24px 0;
                    line-height: 1.1;
                }
                .lp-hero-subtitle {
                    font-size: 1.2rem;
                    opacity: 0.9;
                    margin-bottom: 32px;
                    font-weight: 300;
                }
                .lp-price-tag {
                    font-size: 2rem;
                    font-weight: 700;
                    margin-bottom: 32px;
                    font-family: 'Playfair Display', serif;
                    color: var(--primary-color);
                }
                .lp-cta-button {
                    background: var(--primary-color);
                    color: black;
                    border: none;
                    padding: 16px 40px;
                    font-size: 1.1rem;
                    font-weight: 600;
                    border-radius: 50px;
                    cursor: pointer;
                    transition: transform 0.2s;
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                }
                .lp-cta-button:hover {
                    transform: scale(1.05);
                }
                .lp-section {
                    padding: 80px 24px;
                    background: #f8f8f8;
                    color: #333;
                }
                .lp-container {
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .lp-grid {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 60px;
                }
                .lp-section-title {
                    font-family: 'Playfair Display', serif;
                    font-size: 2.5rem;
                    margin-bottom: 24px;
                    color: #1a1a1a;
                }
                .lp-description {
                    font-size: 1.1rem;
                    line-height: 1.8;
                    color: #555;
                    margin-bottom: 40px;
                }
                .lp-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 24px;
                    margin-bottom: 60px;
                }
                .lp-stat-card {
                    background: white;
                    padding: 20px;
                    border-radius: 12px;
                    text-align: center;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.05);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                }
                .lp-stat-value {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #333;
                }
                .lp-stat-label {
                    font-size: 0.85rem;
                    color: #888;
                    text-transform: uppercase;
                }
                .lp-amenities-list {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                    list-style: none;
                }
                .lp-amenity-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-size: 1.1rem;
                }
                .lp-check-icon {
                    color: var(--primary-color);
                    font-weight: bold;
                }
                .lp-form-card {
                    background: white;
                    padding: 32px;
                    border-radius: 16px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                    text-align: center;
                    margin-bottom: 32px;
                }
                .full-width {
                    width: 100%;
                    justify-content: center;
                    margin-top: 20px;
                }
                .lp-gallery-thumb {
                    width: 100%;
                    height: 150px;
                    object-fit: cover;
                    border-radius: 8px;
                    margin-bottom: 16px;
                }
                .lp-footer {
                    background: #1a1a1a;
                    color: #888;
                    padding: 40px;
                    text-align: center;
                }
                @media (max-width: 768px) {
                    .lp-grid { grid-template-columns: 1fr; }
                    .lp-stats-grid { grid-template-columns: 1fr 1fr; }
                    .lp-hero-title { font-size: 2.5rem; }
                }
            `}</style>
        </div>
    )
}
