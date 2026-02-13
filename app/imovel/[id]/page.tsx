import { createServerSupabase } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Bed, Bath, Move, MapPin, Phone, ArrowLeft, Gem, Ruler } from 'lucide-react'
import Link from 'next/link'
import HeroCarousel from '@/components/property/HeroCarousel'
import PropertyGallery from '@/components/property/PropertyGallery'

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
        <div className="pd-page">
            {/* Back Nav */}
            <Link href="/" className="pd-back-btn">
                <ArrowLeft size={20} />
                <span>Voltar</span>
            </Link>

            {/* Hero Carousel */}
            <section className="pd-hero">
                <HeroCarousel
                    images={gallery}
                    title={property.title}
                    videoUrl={property.video_url}
                    gallerySectionId="gallery-section"
                />
                <div className="pd-hero-overlay" />
                <div className="pd-hero-content">
                    <span className="pd-badge"><Gem size={14} /> Exclusivo</span>
                    <h1 className="pd-hero-title">{property.title}</h1>
                    <div className="pd-hero-location">
                        <MapPin size={16} />
                        {property.city}{property.state ? `, ${property.state}` : ''}
                    </div>
                </div>
            </section>

            {/* Price Strip */}
            <div className="pd-price-strip">
                <div className="pd-price">{formattedPrice}</div>
                <span className="pd-price-label">{property.property_type || 'Imóvel de Luxo'}</span>
            </div>

            {/* Stats */}
            <section className="pd-stats-section">
                <div className="pd-stats-grid">
                    {property.bedrooms && (
                        <div className="pd-stat-card">
                            <Bed size={28} className="pd-stat-icon" />
                            <span className="pd-stat-value">{property.bedrooms}</span>
                            <span className="pd-stat-label">Quartos</span>
                        </div>
                    )}
                    {property.bathrooms && (
                        <div className="pd-stat-card">
                            <Bath size={28} className="pd-stat-icon" />
                            <span className="pd-stat-value">{property.bathrooms}</span>
                            <span className="pd-stat-label">Banheiros</span>
                        </div>
                    )}
                    {property.area_m2 && (
                        <div className="pd-stat-card">
                            <Ruler size={28} className="pd-stat-icon" />
                            <span className="pd-stat-value">{property.area_m2}m²</span>
                            <span className="pd-stat-label">Área</span>
                        </div>
                    )}
                    <div className="pd-stat-card">
                        <MapPin size={28} className="pd-stat-icon" />
                        <span className="pd-stat-value" style={{ fontSize: '1rem' }}>{property.city}</span>
                        <span className="pd-stat-label">Localização</span>
                    </div>
                </div>
            </section>

            {/* Description */}
            <section className="pd-section">
                <h2 className="pd-section-title">Sobre o Imóvel</h2>
                <div className="pd-gold-line" />
                <p className="pd-description">
                    {property.description || 'Descrição detalhada do imóvel indisponível no momento. Entre em contato para mais informações.'}
                </p>
            </section>

            {/* Amenities */}
            {amenities.length > 0 && (
                <section className="pd-section">
                    <h2 className="pd-section-title">Diferenciais</h2>
                    <div className="pd-gold-line" />
                    <ul className="pd-amenities-grid">
                        {amenities.map((item: string, i: number) => (
                            <li key={i} className="pd-amenity-item">
                                <div className="pd-amenity-check">✓</div>
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Gallery Grid */}
            <section id="gallery-section" className="pd-section">
                <h2 className="pd-section-title">Galeria de Fotos</h2>
                <div className="pd-gold-line" />
                <PropertyGallery images={gallery} title={property.title} />
            </section>

            {/* CTA */}
            <section className="pd-cta-section">
                <div className="pd-cta-card">
                    <h3 className="pd-cta-title">Interessado neste imóvel?</h3>
                    <p className="pd-cta-text">Fale diretamente com Guilherme Pilger e agende sua visita exclusiva.</p>
                    <a
                        href={`https://wa.me/5548999999999?text=Olá! Tenho interesse no imóvel: ${property.title}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pd-cta-button"
                    >
                        <Phone size={20} />
                        Falar pelo WhatsApp
                    </a>
                </div>
            </section>

            {/* Footer */}
            <footer className="pd-footer">
                <p>© {new Date().getFullYear()} Pilger Imóveis. Todos os direitos reservados.</p>
            </footer>

            <style>{`
                .pd-page {
                    min-height: 100vh;
                    background: #f7f7f5;
                    color: #1a1a1a;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                }

                /* === BACK BUTTON === */
                .pd-back-btn {
                    position: fixed;
                    top: 20px;
                    left: 20px;
                    z-index: 100;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 18px;
                    background: rgba(255, 255, 255, 0.9);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border: 1px solid #e8e5e0;
                    border-radius: 50px;
                    color: #1a1a1a;
                    text-decoration: none;
                    font-size: 0.85rem;
                    font-weight: 500;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
                }
                .pd-back-btn:hover {
                    background: rgba(184, 148, 95, 0.1);
                    border-color: rgba(184, 148, 95, 0.4);
                    color: #8a6d3b;
                }

                /* === HERO === */
                .pd-hero {
                    position: relative;
                    height: 65vh;
                    min-height: 400px;
                    overflow: hidden;
                    display: flex;
                    align-items: flex-end;
                    margin-top: 0;
                    border-radius: 0;
                    animation: pd-hero-enter 0.8s ease-out;
                }
                .pd-hero-top-fade {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 220px;
                    background: linear-gradient(
                        to bottom,
                        #f7f7f5 0%,
                        rgba(247, 247, 245, 0.85) 20%,
                        rgba(247, 247, 245, 0.5) 45%,
                        rgba(247, 247, 245, 0.2) 70%,
                        rgba(247, 247, 245, 0) 100%
                    );
                    z-index: 3;
                    pointer-events: none;
                }
                .pd-hero-img {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 8s ease;
                }
                .pd-hero:hover .pd-hero-img {
                    transform: scale(1.03);
                }
                .pd-hero-overlay {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(
                        to top,
                        rgba(10, 10, 10, 0.9) 0%,
                        rgba(10, 10, 10, 0.35) 40%,
                        rgba(10, 10, 10, 0.05) 100%
                    );
                    z-index: 1;
                    pointer-events: none;
                }
                @keyframes pd-hero-enter {
                    from {
                        opacity: 0;
                        transform: translateY(12px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .pd-hero-content {
                    position: relative;
                    z-index: 2;
                    padding: 40px 32px;
                    max-width: 900px;
                }
                .pd-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 16px;
                    background: linear-gradient(135deg, #b8945f 0%, #d4b87a 50%, #8a6d3b 100%);
                    color: #fff;
                    border-radius: 4px;
                    font-size: 0.72rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                    margin-bottom: 16px;
                }
                .pd-hero-title {
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: clamp(2rem, 5vw, 3.5rem);
                    font-weight: 600;
                    line-height: 1.1;
                    margin: 0 0 12px 0;
                    background: linear-gradient(135deg, #fff 0%, #e8d5a8 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .pd-hero-location {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    color: rgba(255,255,255,0.7);
                    font-size: 1rem;
                    font-weight: 400;
                }

                /* === PRICE STRIP === */
                .pd-price-strip {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 32px;
                    background: #ffffff;
                    border-bottom: 1px solid #e8e5e0;
                }
                .pd-price {
                    font-family: 'Playfair Display', serif;
                    font-size: clamp(1.5rem, 3vw, 2.2rem);
                    font-weight: 700;
                    color: #8a6d3b;
                }
                .pd-price-label {
                    font-size: 0.9rem;
                    color: #5a5a5a;
                    text-transform: capitalize;
                    padding: 6px 16px;
                    border: 1px solid #e8e5e0;
                    border-radius: 50px;
                }

                /* === STATS === */
                .pd-stats-section {
                    padding: 32px;
                }
                .pd-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                    gap: 16px;
                    max-width: 800px;
                    margin: 0 auto;
                }
                .pd-stat-card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    padding: 24px 16px;
                    background: #ffffff;
                    border: 1px solid #e8e5e0;
                    border-radius: 16px;
                    transition: all 0.3s ease;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
                }
                .pd-stat-card:hover {
                    border-color: rgba(184, 148, 95, 0.3);
                    box-shadow: 0 4px 16px rgba(184, 148, 95, 0.1);
                    transform: translateY(-2px);
                }
                .pd-stat-icon {
                    color: #b8945f;
                }
                .pd-stat-value {
                    font-size: 1.4rem;
                    font-weight: 700;
                    color: #1a1a1a;
                }
                .pd-stat-label {
                    font-size: 0.75rem;
                    color: #999;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                /* === SECTIONS === */
                .pd-section {
                    max-width: 900px;
                    margin: 0 auto;
                    padding: 48px 32px;
                }
                .pd-section-title {
                    font-family: 'Playfair Display', serif;
                    font-size: 1.8rem;
                    margin-bottom: 8px;
                    color: #1a1a1a;
                }
                .pd-gold-line {
                    width: 50px;
                    height: 2px;
                    background: linear-gradient(90deg, #b8945f, transparent);
                    margin-bottom: 24px;
                }
                .pd-description {
                    font-size: 1.05rem;
                    line-height: 1.85;
                    color: #5a5a5a;
                    white-space: pre-line;
                }

                /* === AMENITIES === */
                .pd-amenities-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
                    gap: 12px;
                    list-style: none;
                    padding: 0;
                }
                .pd-amenity-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 14px 18px;
                    background: #ffffff;
                    border: 1px solid #e8e5e0;
                    border-radius: 12px;
                    font-size: 0.92rem;
                    color: #5a5a5a;
                    transition: all 0.25s ease;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
                }
                .pd-amenity-item:hover {
                    border-color: rgba(184, 148, 95, 0.3);
                    color: #1a1a1a;
                }
                .pd-amenity-check {
                    color: #b8945f;
                    font-weight: 700;
                    font-size: 1rem;
                    flex-shrink: 0;
                }

                /* === GALLERY === */
                .pd-gallery-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 12px;
                }
                .pd-gallery-item {
                    aspect-ratio: 16/11;
                    border-radius: 14px;
                    overflow: hidden;
                    cursor: pointer;
                    position: relative;
                }
                .pd-gallery-item img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 0.5s ease;
                }
                .pd-gallery-item:hover img {
                    transform: scale(1.06);
                }

                /* === CTA === */
                .pd-cta-section {
                    padding: 48px 32px 64px;
                }
                .pd-cta-card {
                    max-width: 600px;
                    margin: 0 auto;
                    text-align: center;
                    padding: 48px 32px;
                    background: #ffffff;
                    border: 1px solid #e8e5e0;
                    border-radius: 20px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
                }
                .pd-cta-title {
                    font-family: 'Playfair Display', serif;
                    font-size: 1.6rem;
                    margin-bottom: 12px;
                }
                .pd-cta-text {
                    color: #5a5a5a;
                    margin-bottom: 28px;
                    font-size: 0.95rem;
                }
                .pd-cta-button {
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    padding: 16px 40px;
                    background: linear-gradient(135deg, #25D366, #128C7E);
                    color: #fff;
                    border: none;
                    border-radius: 50px;
                    font-size: 1rem;
                    font-weight: 600;
                    text-decoration: none;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 20px rgba(37, 211, 102, 0.3);
                }
                .pd-cta-button:hover {
                    transform: translateY(-2px) scale(1.02);
                    box-shadow: 0 8px 30px rgba(37, 211, 102, 0.4);
                }

                /* === FOOTER === */
                .pd-footer {
                    text-align: center;
                    padding: 32px;
                    color: #999;
                    font-size: 0.85rem;
                    border-top: 1px solid #e8e5e0;
                }

                /* === RESPONSIVE === */
                @media (max-width: 768px) {
                    .pd-hero { height: 50vh; min-height: 320px; }
                    .pd-hero-content { padding: 24px 20px; }
                    .pd-price-strip { flex-direction: column; gap: 10px; align-items: flex-start; padding: 20px; }
                    .pd-stats-section { padding: 20px; }
                    .pd-stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
                    .pd-section { padding: 32px 20px; }
                    .pd-gallery-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
                    .pd-amenities-grid { grid-template-columns: 1fr; }
                    .pd-cta-section { padding: 32px 20px; }
                    .pd-cta-card { padding: 32px 20px; }
                    .pd-cta-button { padding: 14px 28px; font-size: 0.9rem; }
                    .pd-back-btn { top: 12px; left: 12px; padding: 8px 14px; font-size: 0.8rem; }
                }

                /* === DESKTOP ENHANCEMENTS === */
                @media (min-width: 1024px) {
                    .pd-hero { height: 75vh; min-height: 520px; }
                    .pd-hero-content { padding: 50px 48px; max-width: 1000px; }
                    .pd-hero-title { font-size: 3rem; }
                    .pd-hero-location { font-size: 1.1rem; }
                    .pd-price-strip {
                        max-width: 1100px;
                        margin: 0 auto;
                        padding: 28px 48px;
                    }
                    .pd-price { font-size: 2rem; }
                    .pd-stats-section { padding: 40px 48px; }
                    .pd-stats-grid {
                        grid-template-columns: repeat(4, 1fr);
                        max-width: 1000px;
                        margin: 0 auto;
                        gap: 20px;
                    }
                    .pd-stat-card { padding: 28px 20px; }
                    .pd-stat-value { font-size: 1.6rem; }
                    .pd-section {
                        max-width: 1000px;
                        padding: 56px 48px;
                    }
                    .pd-section-title { font-size: 2rem; }
                    .pd-description { font-size: 1.1rem; }
                    .pd-amenities-grid {
                        grid-template-columns: repeat(3, 1fr);
                        gap: 14px;
                    }
                    .pd-gallery-grid {
                        grid-template-columns: repeat(3, 1fr);
                        gap: 16px;
                    }
                    .pd-cta-section { padding: 64px 48px; }
                    .pd-cta-card {
                        max-width: 700px;
                        padding: 56px 40px;
                    }
                    .pd-cta-title { font-size: 1.8rem; }
                    .pd-footer {
                        max-width: 1100px;
                        margin: 0 auto;
                    }
                }

                @media (min-width: 1440px) {
                    .pd-hero { height: 80vh; min-height: 600px; }
                    .pd-hero-content { padding: 60px 64px; max-width: 1100px; }
                    .pd-hero-title { font-size: 3.5rem; }
                    .pd-price-strip {
                        max-width: 1200px;
                        padding: 32px 64px;
                    }
                    .pd-stats-section { padding: 48px 64px; }
                    .pd-stats-grid { max-width: 1100px; }
                    .pd-section {
                        max-width: 1100px;
                        padding: 64px 64px;
                    }
                    .pd-amenities-grid {
                        grid-template-columns: repeat(4, 1fr);
                    }
                    .pd-gallery-grid {
                        grid-template-columns: repeat(4, 1fr);
                    }
                    .pd-cta-card { max-width: 800px; padding: 64px 48px; }
                }
            `}</style>
        </div>
    )
}
