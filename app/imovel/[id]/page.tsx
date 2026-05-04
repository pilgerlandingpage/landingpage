import { createServerSupabase } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Bed, Bath, MapPin, Phone, ArrowLeft, Gem, Ruler, Navigation } from 'lucide-react'
import Link from 'next/link'
import HeroCarousel from '@/components/property/HeroCarousel'
import PropertyGallery from '@/components/property/PropertyGallery'
import MobileNav from '@/components/marketplace/MobileNav'
import WhatsAppCaptureLink from '@/components/common/WhatsAppCaptureLink'
import PropertyRadarPanel from '@/components/property/PropertyRadarPanel'

export const dynamic = 'force-dynamic'

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const supabase = await createServerSupabase()
    const { id } = await params

    const { data: property } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .single()

    if (!property) return notFound()

    const gallery = property.images && property.images.length > 0
        ? property.images
        : property.featured_image
            ? [property.featured_image]
            : []

    const amenities: string[] = property.amenities || []

    const formattedPrice = property.price
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(property.price)
        : 'Sob Consulta'

    return (
        <div className="lp-page">
            {/* Top Back Navigation (Glassmorphic) */}
            <Link href="/" className="lp-back-btn">
                <ArrowLeft size={18} />
                <span>Voltar ao portfólio</span>
            </Link>

            {/* ========== CINEMATIC HERO (Full Viewport) ========== */}
            <section className="lp-hero">
                <HeroCarousel
                    images={gallery}
                    title={property.title}
                    videoUrl={property.video_url}
                    gallerySectionId="story-gallery"
                />
                <div className="lp-hero-overlay" />
                <div className="lp-hero-content">
                    <div className="lp-badge">
                        <Gem size={14} /> Exclusividade Pilger
                    </div>
                    <h1 className="lp-hero-title">{property.title}</h1>
                    <div className="lp-hero-location">
                        <MapPin size={18} />
                        {property.city}{property.state ? `, ${property.state}` : ''}
                    </div>
                </div>
            </section>

            {/* ========== STICKY CTA BAR ========== */}
            <div className="lp-sticky-bar">
                <div className="lp-sticky-content">
                    <div className="lp-sticky-info">
                        <div className="lp-sticky-price">{formattedPrice}</div>
                        <div className="lp-sticky-type">{property.property_type || 'Imóvel de Luxo'}</div>
                    </div>
                    <WhatsAppCaptureLink
                        phone="5548999999999"
                        message={`Olá! Quero agendar uma visita ou saber mais sobre o imóvel: ${property.title} (${property.city})`}
                        slug="imovel"
                        template="property-detail-cta"
                        className="lp-sticky-btn"
                    >
                        <Phone size={18} />
                        Falar com Especialista
                    </WhatsAppCaptureLink>
                </div>
            </div>

            <div className="lp-container">
                {/* ========== STORYTELLING: A ESSÊNCIA ========== */}
                <section className="lp-section">
                    <div className="lp-section-header">
                        <span className="lp-kicker">O Estilo de Vida</span>
                        <h2 className="lp-title">A Essência do Imóvel</h2>
                    </div>
                    <p className="lp-description">
                        {property.description || 'Uma obra-prima da arquitetura projetada para elevar o seu padrão de vida. Cada detalhe deste imóvel foi rigorosamente pensado para proporcionar uma experiência única de conforto, exclusividade e bem-estar. Descubra o verdadeiro significado de morar com excelência.'}
                    </p>
                </section>

                {/* ========== HIGH-END INFOGRAPHICS ========== */}
                <section className="lp-section">
                    <div className="lp-stats-grid">
                        {property.area_m2 && (
                            <div className="lp-stat-box">
                                <Ruler size={32} className="lp-stat-icon" />
                                <div className="lp-stat-data">
                                    <strong>{property.area_m2}m²</strong>
                                    <span>Área Privativa</span>
                                </div>
                            </div>
                        )}
                        {property.bedrooms && (
                            <div className="lp-stat-box">
                                <Bed size={32} className="lp-stat-icon" />
                                <div className="lp-stat-data">
                                    <strong>{property.bedrooms}</strong>
                                    <span>Suítes Master</span>
                                </div>
                            </div>
                        )}
                        {property.bathrooms && (
                            <div className="lp-stat-box">
                                <Bath size={32} className="lp-stat-icon" />
                                <div className="lp-stat-data">
                                    <strong>{property.bathrooms}</strong>
                                    <span>Banheiros</span>
                                </div>
                            </div>
                        )}
                        <div className="lp-stat-box">
                            <Navigation size={32} className="lp-stat-icon" />
                            <div className="lp-stat-data">
                                <strong>{property.city}</strong>
                                <span>Localização Prime</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ========== RADAR: POTENCIAL DE INVESTIMENTO ========== */}
                <section className="lp-section">
                    <div className="lp-section-header">
                        <span className="lp-kicker">Visão Bloomberg</span>
                        <h2 className="lp-title">Potencial de Investimento</h2>
                    </div>
                    <PropertyRadarPanel
                        propertyName={property.title}
                        city={property.city || 'Região'}
                        price={property.price}
                    />
                </section>

                {/* ========== DIFERENCIAIS ========== */}
                {amenities.length > 0 && (
                    <section className="lp-section">
                        <div className="lp-section-header">
                            <span className="lp-kicker">Exclusividade</span>
                            <h2 className="lp-title">Diferenciais Notáveis</h2>
                        </div>
                        <ul className="lp-amenities">
                            {amenities.map((item: string, i: number) => (
                                <li key={i} className="lp-amenity-item">
                                    <div className="lp-amenity-dot" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* ========== EDITORIAL GALLERY ========== */}
                <section id="story-gallery" className="lp-section">
                    <div className="lp-section-header">
                        <span className="lp-kicker">A Arquitetura</span>
                        <h2 className="lp-title">Galeria Editorial</h2>
                    </div>
                    <PropertyGallery images={gallery} title={property.title} />
                </section>
            </div>

            {/* ========== FOOTER ========== */}
            <footer className="lp-footer">
                <p>© {new Date().getFullYear()} Pilger Imóveis. O Maior Portal Imobiliário do Brasil.</p>
            </footer>

            <MobileNav />

            <style>{`
                /* ============================================
                   CINEMATIC LANDING PAGE — PROPERTY DETAIL
                   ============================================ */
                .lp-page {
                    min-height: 100vh;
                    background: #fdfdfc;
                    color: #1a1a1a;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                    overflow-x: hidden;
                }

                /* === BACK BUTTON (Glass on dark hero) === */
                .lp-back-btn {
                    position: fixed;
                    top: 24px;
                    left: 24px;
                    z-index: 100;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 20px;
                    background: rgba(0, 0, 0, 0.25);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    border-radius: 50px;
                    color: #fff;
                    text-decoration: none;
                    font-size: 0.8rem;
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    transition: all 0.3s ease;
                }
                .lp-back-btn:hover {
                    background: rgba(0, 0, 0, 0.45);
                    transform: translateX(-4px);
                }

                /* === CINEMATIC HERO === */
                .lp-hero {
                    position: relative;
                    height: 100vh;
                    min-height: 600px;
                    width: 100%;
                    display: flex;
                    align-items: flex-end;
                    animation: lp-fade-up 1s ease-out;
                }
                @keyframes lp-fade-up {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .lp-hero-overlay {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(
                        to top,
                        rgba(0, 0, 0, 0.92) 0%,
                        rgba(0, 0, 0, 0.45) 40%,
                        rgba(0, 0, 0, 0.08) 100%
                    );
                    z-index: 1;
                    pointer-events: none;
                }
                .lp-hero-content {
                    position: relative;
                    z-index: 2;
                    padding: 80px 48px;
                    max-width: 1200px;
                    margin: 0 auto;
                    width: 100%;
                    animation: lp-slide-up 0.8s 0.3s ease-out both;
                }
                @keyframes lp-slide-up {
                    from { opacity: 0; transform: translateY(30px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .lp-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 18px;
                    background: rgba(255, 255, 255, 0.08);
                    backdrop-filter: blur(8px);
                    border: 1px solid rgba(255, 255, 255, 0.18);
                    color: #fff;
                    border-radius: 50px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 2.5px;
                    margin-bottom: 24px;
                }
                .lp-hero-title {
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: clamp(2.5rem, 6vw, 5rem);
                    font-weight: 600;
                    line-height: 1.05;
                    margin: 0 0 16px 0;
                    color: #fff;
                    text-shadow: 0 4px 20px rgba(0,0,0,0.4);
                }
                .lp-hero-location {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: rgba(255, 255, 255, 0.75);
                    font-size: 1.15rem;
                    font-weight: 300;
                    letter-spacing: 0.5px;
                }

                /* === STICKY CTA BAR === */
                .lp-sticky-bar {
                    position: sticky;
                    top: 0;
                    background: rgba(255, 255, 255, 0.92);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border-bottom: 1px solid rgba(0,0,0,0.04);
                    z-index: 90;
                    padding: 16px 0;
                    box-shadow: 0 4px 30px rgba(0,0,0,0.03);
                }
                .lp-sticky-content {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 0 48px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .lp-sticky-info {}
                .lp-sticky-price {
                    font-family: 'Playfair Display', serif;
                    font-size: 1.8rem;
                    font-weight: 700;
                    color: #1a1a1a;
                    line-height: 1;
                }
                .lp-sticky-type {
                    font-size: 0.78rem;
                    color: #737373;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-top: 4px;
                }
                .lp-sticky-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    background: #1a1a1a;
                    color: #fff;
                    padding: 14px 32px;
                    border-radius: 50px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    text-decoration: none;
                    transition: all 0.3s ease;
                }
                .lp-sticky-btn:hover {
                    background: #b8945f;
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px rgba(184, 148, 95, 0.3);
                }

                /* === MAIN CONTAINER === */
                .lp-container {
                    max-width: 1000px;
                    margin: 0 auto;
                    padding: 80px 48px;
                }

                /* === SECTIONS === */
                .lp-section {
                    margin-bottom: 100px;
                }
                .lp-section:last-child {
                    margin-bottom: 0;
                }
                .lp-section-header {
                    margin-bottom: 40px;
                    text-align: center;
                }
                .lp-kicker {
                    display: block;
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: #b8945f;
                    text-transform: uppercase;
                    letter-spacing: 2.5px;
                    margin-bottom: 12px;
                }
                .lp-title {
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: 2.5rem;
                    font-weight: 600;
                    color: #1a1a1a;
                    margin: 0;
                }
                .lp-description {
                    font-size: 1.2rem;
                    line-height: 1.85;
                    color: #525252;
                    text-align: center;
                    max-width: 800px;
                    margin: 0 auto;
                    font-weight: 300;
                    white-space: pre-line;
                }

                /* === HIGH-END INFOGRAPHIC STATS === */
                .lp-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 24px;
                    background: #fff;
                    padding: 48px;
                    border-radius: 24px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.04);
                    border: 1px solid rgba(0,0,0,0.04);
                }
                .lp-stat-box {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    gap: 16px;
                    padding: 16px 8px;
                    border-radius: 16px;
                    transition: all 0.3s ease;
                }
                .lp-stat-box:hover {
                    background: rgba(184, 148, 95, 0.04);
                    transform: translateY(-4px);
                }
                .lp-stat-icon {
                    color: #b8945f;
                    stroke-width: 1.5;
                }
                .lp-stat-data strong {
                    display: block;
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #1a1a1a;
                    margin-bottom: 4px;
                }
                .lp-stat-data span {
                    font-size: 0.72rem;
                    color: #737373;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                /* === AMENITIES === */
                .lp-amenities {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                    gap: 20px;
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }
                .lp-amenity-item {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    font-size: 1rem;
                    color: #404040;
                    font-weight: 400;
                    padding: 14px 0;
                    border-bottom: 1px solid rgba(0,0,0,0.04);
                    transition: color 0.2s;
                }
                .lp-amenity-item:hover {
                    color: #1a1a1a;
                }
                .lp-amenity-dot {
                    width: 6px;
                    height: 6px;
                    background: #b8945f;
                    border-radius: 50%;
                    flex-shrink: 0;
                }

                /* === FOOTER === */
                .lp-footer {
                    background: #0a0a0a;
                    color: #737373;
                    text-align: center;
                    padding: 64px 20px;
                    font-size: 0.8rem;
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                }

                /* ====== BOTTOM NAV ====== */
                .mobile-nav {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 58px;
                    background: rgba(255, 255, 255, 0.95);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border-top: 1px solid var(--border, #e8e5e0);
                    display: flex;
                    justify-content: center;
                    gap: 48px;
                    align-items: center;
                    z-index: 1000;
                    padding-bottom: env(safe-area-inset-bottom);
                }
                .nav-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 2px;
                    color: var(--text-muted, #999);
                    font-size: 0.65rem;
                    cursor: pointer;
                    width: 54px;
                    font-weight: 500;
                    transition: color 0.2s;
                }
                .nav-item:hover { color: var(--text-secondary, #5a5a5a); }
                .nav-item.active { color: var(--gold, #b8945f); }
                .nav-icon { margin-bottom: 1px; }

                /* === RESPONSIVE === */
                @media (max-width: 768px) {
                    .lp-back-btn {
                        top: 16px;
                        left: 16px;
                        padding: 8px 16px;
                        font-size: 0.72rem;
                    }
                    .lp-hero { height: 75vh; min-height: 450px; }
                    .lp-hero-content { padding: 40px 24px; }
                    .lp-hero-title { font-size: 2.2rem; }
                    .lp-hero-location { font-size: 1rem; }

                    .lp-sticky-content {
                        padding: 0 20px;
                        flex-direction: column;
                        gap: 12px;
                        align-items: stretch;
                    }
                    .lp-sticky-btn {
                        width: 100%;
                        justify-content: center;
                        padding: 12px 24px;
                    }

                    .lp-container { padding: 48px 20px; }
                    .lp-section { margin-bottom: 64px; }
                    .lp-title { font-size: 1.8rem; }
                    .lp-description { font-size: 1.05rem; text-align: left; }

                    .lp-stats-grid {
                        grid-template-columns: 1fr 1fr;
                        padding: 28px 20px;
                        gap: 16px;
                    }
                    .lp-stat-box {
                        flex-direction: column;
                        text-align: center;
                    }

                    .lp-amenities { grid-template-columns: 1fr; }

                    .lp-page { padding-bottom: 60px; }
                }

                @media (min-width: 768px) {
                    .mobile-nav { display: none; }
                }

                @media (min-width: 1024px) {
                    .lp-hero { height: 100vh; min-height: 650px; }
                    .lp-hero-content { padding: 80px 64px; }
                    .lp-container { padding: 100px 48px; }
                    .lp-section { margin-bottom: 120px; }
                    .lp-title { font-size: 2.8rem; }
                    .lp-stats-grid {
                        padding: 56px;
                        gap: 32px;
                    }
                    .lp-stat-data strong { font-size: 1.7rem; }
                }

                @media (min-width: 1440px) {
                    .lp-hero-content { padding: 100px 80px; max-width: 1400px; }
                    .lp-container { max-width: 1100px; padding: 120px 64px; }
                    .lp-title { font-size: 3rem; }
                    .lp-amenities { grid-template-columns: repeat(3, 1fr); }
                }
            `}</style>
        </div>
    )
}
