import { createServerSupabase } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import HeroCarousel from '@/components/property/HeroCarousel'
import PropertyGallery from '@/components/property/PropertyGallery'
import MobileNav from '@/components/marketplace/MobileNav'
import WhatsAppCaptureLink from '@/components/common/WhatsAppCaptureLink'
import PropertyRadarPanel from '@/components/property/PropertyRadarPanel'
import PropertyCard from '@/components/marketplace/PropertyCard'
import PropertyLandingStyles from './PropertyLandingStyles'

export const dynamic = 'force-dynamic'

/** Clean raw marketing descriptions: strip emojis, remove spec noise, extract narrative only */
function formatDescription(raw: string): string[] {
    // Remove ALL emojis and special unicode symbols
    let text = raw.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\ufe0f]/gu, '')
    
    // Remove bullet-point sections entirely (• items are amenity lists)
    text = text.replace(/•[^•\n.]*/g, '')
    
    // Remove section headers (ALL CAPS words or known headers)
    text = text.replace(/\b(UNIDADE|EMPREENDIMENTO|LAZER|INFRAESTRUTURA|SEGURANÇA|ACABAMENTO|DIFERENCIAIS?)\b/gi, '')
    text = text.replace(/Características\s*(do|da)?\s*(Apartamento|Imóvel|Casa|Cobertura|Empreendimento)?/gi, '')
    text = text.replace(/\bLocalização\b/gi, '')
    text = text.replace(/Valor\s*de\s*Investimento/gi, '')
    text = text.replace(/Área\s*privativa\s*:?/gi, '')
    
    // Remove spec data
    text = text.replace(/\d+[\s.,]*\d*\s*m[²2]\s*(de\s*área\s*)?(privativa|total|útil|construída)?/gi, '')
    text = text.replace(/\d+\s*(suítes?|quartos?|banheiros?|vagas?\s*(de\s*garagem)?|salas?\s*de\s*estar|dormitórios?)/gi, '')
    text = text.replace(/R\$[\s\d.,]+/g, '')
    
    // Remove CTAs & contact prompts
    text = text.replace(/Entre\s*em\s*contato[^.]*\./gi, '')
    text = text.replace(/Agende\s*(sua|uma)\s*visita[^.]*\./gi, '')
    text = text.replace(/Fale\s*com[^.]*\./gi, '')
    
    // Remove title-like fragments with dashes
    text = text.replace(/[^.!?]*[–—][^.!?]*/g, '')
    
    // Remove short amenity-like fragments (things without verbs)
    text = text.replace(/\b(Vista\s*mar|Piso\s*aquecido|Fechadura\s*com\s*senha|Acabamento\s*em\s*gesso)\b[^.]*/gi, '')
    
    // Clean up
    text = text.replace(/[,;:]\s*[,;:]/g, '')
    text = text.replace(/\s+/g, ' ')
    text = text.replace(/^\s*[,;.:–—\-]\s*/gm, '')
    text = text.trim()
    
    // Split sentences and keep only meaningful narrative ones
    const sentences = text
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim().replace(/^[,;:\s]+/, ''))
        .filter(s => {
            if (s.length < 40) return false
            if (/^\d/.test(s)) return false
            // Must contain at least one common verb indicator to be a real sentence
            if (!/[aeiouáéíóúãõ]{2,}/i.test(s)) return false
            return true
        })
    
    if (sentences.length === 0) return []
    
    // Group into paragraphs
    const paragraphs: string[] = []
    for (let i = 0; i < sentences.length; i += 2) {
        const chunk = sentences.slice(i, i + 2).join(' ').trim()
        if (chunk.length > 40) paragraphs.push(chunk)
    }
    return paragraphs.slice(0, 3)
}

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

    // Fetch related properties (same city, excluding current)
    const { data: relatedProps } = await supabase
        .from('properties')
        .select('id, title, city, state, price, bedrooms, bathrooms, area_m2, featured_image, images, property_type, exclusive')
        .eq('status', 'active')
        .neq('id', id)
        .limit(3)

    const related = relatedProps || []

    // Build editorial gallery sections from images
    const editorialSections = [
        { num: '01', title: 'A Chegada', text: 'Um hall de entrada que revela, de imediato, a grandiosidade e a integração com o ambiente. Materiais nobres e design sofisticado ditam o tom da recepção.' },
        { num: '02', title: 'O Living', text: 'Espaços amplos e fluídos, projetados para a alta socialização. Ambientes que se integram harmoniosamente criando uma experiência única de contemplação e lazer.' },
        { num: '03', title: 'O Refúgio', text: 'Áreas íntimas que oferecem um santuário de paz e privacidade. Cada detalhe foi pensado para proporcionar o máximo conforto e sofisticação.' },
    ]

    return (
        <div className="plp-page">
            <PropertyLandingStyles />

            {/* ===== TOP NAV ===== */}
            <header className="plp-header">
                <div className="plp-header-inner">
                    <Link href="/" className="plp-logo">GUILHERME PILGER</Link>
                    <nav className="plp-nav">
                        <a href="#essencia" className="plp-nav-link">O Imóvel</a>
                        <a href="#galeria" className="plp-nav-link">Galeria</a>
                        <a href="#ficha" className="plp-nav-link">Ficha Técnica</a>
                        <a href="#corretor" className="plp-nav-link">Corretor</a>
                        <WhatsAppCaptureLink
                            phone="5548999999999"
                            message={`Olá! Quero saber mais sobre: ${property.title} (${property.city})`}
                            slug="imovel"
                            template="property-lp-nav"
                            className="plp-nav-cta"
                        >
                            Falar com Especialista
                        </WhatsAppCaptureLink>
                    </nav>
                </div>
            </header>

            {/* ===== FULLSCREEN HERO ===== */}
            <section className="plp-hero">
                <HeroCarousel
                    images={gallery}
                    title={property.title}
                    videoUrl={property.video_url}
                    gallerySectionId="galeria"
                />
                <div className="plp-hero-gradient" />
                <div className="plp-hero-content">
                    <div className="plp-hero-inner">
                        {property.exclusive && (
                            <span className="plp-hero-kicker">RESIDÊNCIA EXCLUSIVA</span>
                        )}
                        <h1 className="plp-hero-title">{property.title}</h1>
                        <p className="plp-hero-subtitle">
                            {property.city}{property.state ? `, ${property.state}` : ''} — {property.property_type || 'Imóvel de Luxo'}
                        </p>
                        <div className="plp-hero-actions">
                            <WhatsAppCaptureLink
                                phone="5548999999999"
                                message={`Olá! Quero agendar uma visita: ${property.title}`}
                                slug="imovel"
                                template="property-lp-hero"
                                className="plp-btn-gold"
                            >
                                Falar com Especialista
                            </WhatsAppCaptureLink>
                            <a href="#galeria" className="plp-btn-ghost">Explorar Galeria</a>
                        </div>
                        <div className="plp-hero-price-bar">
                            <div>
                                <p className="plp-price-label">VALOR DE INVESTIMENTO</p>
                                <p className="plp-price-value">{formattedPrice}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== NARRATIVA ===== */}
            <section id="essencia" className="plp-section plp-narrative">
                <div className="plp-narrow">
                    <span className="plp-sparkle">✦</span>
                    <h2 className="plp-headline-lg">Mais do que um endereço, um legado.</h2>
                    {(() => {
                        const paragraphs = property.description ? formatDescription(property.description) : []
                        if (paragraphs.length === 0) {
                            return (
                                <p className="plp-body-lg">
                                    Esta propriedade foi concebida para quem não aceita menos que a perfeição, unindo design contemporâneo e privacidade total. Cada detalhe foi meticulosamente planejado para oferecer uma experiência sensorial que transcende o simples morar.
                                </p>
                            )
                        }
                        return paragraphs.map((p, i) => (
                            <p key={i} className="plp-body-lg" style={{ marginBottom: i < paragraphs.length - 1 ? '24px' : 0 }}>{p}</p>
                        ))
                    })()}
                </div>
            </section>

            {/* ===== STATS CARDS ===== */}
            <section className="plp-section">
                <div className="plp-container">
                    <div className="plp-stats-grid">
                        {property.area_m2 && (
                            <div className="plp-glass-card">
                                <p className="plp-stat-number">{property.area_m2.toLocaleString('pt-BR')}m²</p>
                                <p className="plp-stat-label">PRIVATIVOS</p>
                            </div>
                        )}
                        {property.bedrooms && (
                            <div className="plp-glass-card">
                                <p className="plp-stat-number">{property.bedrooms}</p>
                                <p className="plp-stat-label">{property.bedrooms === 1 ? 'SUÍTE' : 'SUÍTES'}</p>
                            </div>
                        )}
                        {property.bathrooms && (
                            <div className="plp-glass-card">
                                <p className="plp-stat-number">{property.bathrooms}</p>
                                <p className="plp-stat-label">{property.bathrooms === 1 ? 'BANHEIRO' : 'BANHEIROS'}</p>
                            </div>
                        )}
                        {property.parking_spaces && (
                            <div className="plp-glass-card">
                                <p className="plp-stat-number">{property.parking_spaces}</p>
                                <p className="plp-stat-label">VAGAS</p>
                            </div>
                        )}
                        {!property.parking_spaces && (
                            <div className="plp-glass-card">
                                <p className="plp-stat-number">∞</p>
                                <p className="plp-stat-label">VISTA PRIVILEGIADA</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* ===== EDITORIAL GALLERY ===== */}
            <section id="galeria" className="plp-section plp-editorial">
                {editorialSections.map((sec, idx) => {
                    const img = gallery[idx] || gallery[0]
                    if (!img) return null
                    const isReversed = idx % 2 === 0
                    return (
                        <div key={idx} className={`plp-editorial-row ${isReversed ? 'reversed' : ''}`}>
                            <div className="plp-editorial-text">
                                <span className="plp-editorial-num">{sec.num}</span>
                                <h3 className="plp-headline-md">{sec.title}</h3>
                                <p className="plp-body-lg">{sec.text}</p>
                            </div>
                            <div className="plp-editorial-img">
                                <img src={img} alt={`${property.title} - ${sec.title}`} loading="lazy" />
                            </div>
                        </div>
                    )
                })}
            </section>

            {/* ===== FULL GALLERY ===== */}
            {gallery.length > 3 && (
                <section className="plp-section">
                    <div className="plp-container">
                        <div className="plp-section-head">
                            <span className="plp-kicker">A ARQUITETURA</span>
                            <h2 className="plp-headline-lg">Galeria Completa</h2>
                        </div>
                        <PropertyGallery images={gallery} title={property.title} />
                    </div>
                </section>
            )}

            {/* ===== DIFERENCIAIS ===== */}
            {amenities.length > 0 && (
                <section className="plp-section plp-highlights-bg">
                    <div className="plp-container">
                        <div className="plp-section-head">
                            <span className="plp-kicker">EXCLUSIVIDADE</span>
                            <h2 className="plp-headline-lg">Diferenciais Notáveis</h2>
                        </div>
                        <div className="plp-amenities-grid">
                            {amenities.map((item: string, i: number) => (
                                <div key={i} className="plp-amenity-item">
                                    <span className="plp-amenity-arrow">→</span>
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ===== FICHA TÉCNICA ===== */}
            <section id="ficha" className="plp-section">
                <div className="plp-container">
                    <h2 className="plp-headline-lg plp-ficha-title">Ficha Técnica</h2>
                    <div className="plp-ficha-grid">
                        {property.area_m2 && (
                            <div className="plp-ficha-item">
                                <p className="plp-ficha-label">ÁREA TOTAL</p>
                                <p className="plp-ficha-value">{property.area_m2.toLocaleString('pt-BR')}m²</p>
                            </div>
                        )}
                        {property.bedrooms && (
                            <div className="plp-ficha-item">
                                <p className="plp-ficha-label">CONFIGURAÇÃO</p>
                                <p className="plp-ficha-value">{property.bedrooms} {property.bedrooms === 1 ? 'Suíte' : 'Suítes'}</p>
                            </div>
                        )}
                        {property.bathrooms && (
                            <div className="plp-ficha-item">
                                <p className="plp-ficha-label">BANHEIROS</p>
                                <p className="plp-ficha-value">{property.bathrooms}</p>
                            </div>
                        )}
                        {property.parking_spaces && (
                            <div className="plp-ficha-item">
                                <p className="plp-ficha-label">ESTACIONAMENTO</p>
                                <p className="plp-ficha-value">{property.parking_spaces} Vagas</p>
                            </div>
                        )}
                        <div className="plp-ficha-item">
                            <p className="plp-ficha-label">BAIRRO</p>
                            <p className="plp-ficha-value">{property.neighborhood || property.city || '—'}{property.state ? `, ${property.state}` : ''}</p>
                        </div>
                        {property.iptu && (
                            <div className="plp-ficha-item">
                                <p className="plp-ficha-label">IPTU ANUAL</p>
                                <p className="plp-ficha-value">R$ {Number(property.iptu).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                        )}
                        {property.condo_fee && (
                            <div className="plp-ficha-item">
                                <p className="plp-ficha-label">CONDOMÍNIO</p>
                                <p className="plp-ficha-value">R$ {Number(property.condo_fee).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                        )}
                        <div className="plp-ficha-item">
                            <p className="plp-ficha-label">STATUS</p>
                            <p className="plp-ficha-value plp-gold">{property.status === 'active' ? 'Disponível' : property.status === 'sold' ? 'Vendido' : 'Reservado'}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== LOCALIZAÇÃO / MAPA ===== */}
            <section id="localizacao" className="plp-section">
                <div className="plp-container">
                    <div className="plp-map-layout">
                        <div className="plp-map-text">
                            <span className="plp-kicker">LOCALIZAÇÃO</span>
                            <h2 className="plp-headline-lg">No epicentro do luxo.</h2>
                            <p className="plp-body-lg">
                                {property.neighborhood ? `${property.neighborhood}, ` : ''}{property.city}{property.state ? ` — ${property.state}` : ''}. Uma localização estratégica que garante valorização constante e acesso ao que há de melhor na região.
                            </p>
                            <a
                                href={`https://www.google.com/maps/search/${encodeURIComponent([property.neighborhood, property.city, property.state].filter(Boolean).join(', '))}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="plp-map-link"
                            >
                                VER NO GOOGLE MAPS →
                            </a>
                        </div>
                        <div className="plp-map-embed">
                            <iframe
                                src={`https://maps.google.com/maps?q=${encodeURIComponent([property.neighborhood, property.city, property.state].filter(Boolean).join(', '))}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
                                width="100%"
                                height="100%"
                                style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg) brightness(0.95) contrast(1.1)' }}
                                allowFullScreen
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                title={`Mapa - ${property.title}`}
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== RADAR INVESTIMENTO ===== */}
            <section className="plp-section">
                <div className="plp-container">
                    <div className="plp-section-head">
                        <span className="plp-kicker">VISÃO BLOOMBERG</span>
                        <h2 className="plp-headline-lg">Potencial de Investimento</h2>
                    </div>
                    <PropertyRadarPanel
                        propertyName={property.title}
                        city={property.city || 'Região'}
                        price={property.price}
                    />
                </div>
            </section>

            {/* ===== CORRETOR ===== */}
            <section id="corretor" className="plp-section">
                <div className="plp-container">
                    <div className="plp-broker-card">
                        <div className="plp-broker-photo">
                            <img src="https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/IMG_2868.jpg" alt="Guilherme Pilger" />
                        </div>
                        <div className="plp-broker-info">
                            <span className="plp-kicker">APRESENTADO POR</span>
                            <h3 className="plp-headline-lg">Guilherme Pilger</h3>
                            <p className="plp-body-lg">
                                Especialista em investimentos de luxo e curador das propriedades mais exclusivas do Sul do Brasil. Com mais de uma década de experiência no mercado de alto padrão.
                            </p>
                            <WhatsAppCaptureLink
                                phone="5548999999999"
                                message={`Olá Guilherme! Gostaria de agendar uma visita ao imóvel: ${property.title}`}
                                slug="imovel"
                                template="property-lp-broker"
                                className="plp-btn-gold"
                            >
                                Agendar Visita Privada
                            </WhatsAppCaptureLink>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== COLEÇÕES ===== */}
            {related.length > 0 && (
                <section className="plp-section">
                    <div className="plp-container">
                        <div className="plp-collections-head">
                            <h2 className="plp-headline-lg">Coleções Exclusivas</h2>
                            <Link href="/" className="plp-see-all">VER TODA GALERIA</Link>
                        </div>
                        <div className="plp-collections-grid">
                            {related.map((prop: any) => (
                                <PropertyCard key={prop.id} property={prop} />
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ===== CTA FINAL ===== */}
            <section className="plp-final-cta">
                {gallery[0] && (
                    <img src={gallery[0]} alt="" className="plp-final-cta-bg" />
                )}
                <div className="plp-final-cta-overlay" />
                <div className="plp-final-cta-content">
                    <h2 className="plp-display">Pronto para dar o próximo passo rumo ao {property.title}?</h2>
                    <div className="plp-final-cta-actions">
                        <WhatsAppCaptureLink
                            phone="5548999999999"
                            message={`Olá! Quero receber a apresentação completa do ${property.title}`}
                            slug="imovel"
                            template="property-lp-final"
                            className="plp-btn-gold"
                        >
                            Receba a apresentação completa
                        </WhatsAppCaptureLink>
                        <WhatsAppCaptureLink
                            phone="5548999999999"
                            message={`Olá! Gostaria de solicitar um tour virtual do ${property.title}`}
                            slug="imovel"
                            template="property-lp-tour"
                            className="plp-btn-ghost-white"
                        >
                            Solicitar Tour Virtual
                        </WhatsAppCaptureLink>
                    </div>
                </div>
            </section>

            {/* ===== FOOTER ===== */}
            <footer className="plp-footer">
                <div className="plp-footer-inner">
                    <div>
                        <span className="plp-footer-logo">GUILHERME PILGER</span>
                        <p className="plp-footer-copy">© {new Date().getFullYear()} GUILHERME PILGER. CORRETOR DE IMÓVEIS.</p>
                    </div>
                </div>
            </footer>

            <MobileNav />
        </div>
    )
}
