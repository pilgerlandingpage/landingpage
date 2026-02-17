'use client'

import React from 'react'
import { Bed, Bath, Move, MapPin, MessageCircle, ArrowRight } from 'lucide-react'
import { TemplateProps } from './types'
import LandingPageLogic from '@/components/landing/LandingPageLogic'
import { trackEvent } from '@/lib/tracking/client'

export default function ModernLuxuryTemplate({ data, slug, landingPageId, agentName, greetingMessage }: TemplateProps) {
    const {
        title,
        description,
        heroImage,
        price,
        cta,
        stats,
        amenities,
        gallery,
        primaryColor
    } = data

    return (
        <div style={{ '--primary-color': primaryColor } as React.CSSProperties} className="modern-template">
            {/* Tracking & Chat Logic */}
            <LandingPageLogic
                slug={slug}
                landingPageId={landingPageId}
                agentName={agentName}
                greetingMessage={greetingMessage}
            />

            {/* Hero Section - Fullscreen & Minimalist */}
            <section className="modern-hero">
                <img src={heroImage} className="modern-hero-bg" alt={title} />
                <div className="modern-hero-overlay" />

                <div className="modern-hero-content">
                    <span className="modern-tag">Coleção Exclusiva</span>
                    <h1 className="modern-title">{title}</h1>
                    <div className="modern-price">{price}</div>

                    <button className="modern-cta">
                        {cta}
                        <ArrowRight size={20} />
                    </button>

                    <div className="modern-hero-stats">
                        <div className="modern-stat">
                            <span>{stats.bedrooms}</span> <small>Quartos</small>
                        </div>
                        <div className="modern-stat-divider" />
                        <div className="modern-stat">
                            <span>{stats.bathrooms}</span> <small>Banheiros</small>
                        </div>
                        <div className="modern-stat-divider" />
                        <div className="modern-stat">
                            <span>{stats.area}m²</span> <small>Privativos</small>
                        </div>
                    </div>
                </div>
            </section>

            {/* Description Section */}
            <section className="modern-section" style={{ background: '#fff' }}>
                <div className="modern-container" style={{ maxWidth: '800px', textAlign: 'center' }}>
                    <h2 className="modern-section-title">A Essência do Bem Viver</h2>
                    <p className="modern-text">{description}</p>
                </div>
            </section>

            {/* Gallery Section - Full Width Grid */}
            <section className="modern-gallery-section">
                <div className="modern-gallery-grid">
                    {gallery.slice(0, 6).map((img, i) => (
                        <div key={i} className="modern-gallery-item" onClick={() => trackEvent('gallery_image_clicked', { image_index: i, image_url: img })}>
                            <img src={img} alt={`Galeria ${i}`} />
                        </div>
                    ))}
                </div>
            </section>

            {/* Amenities & Location */}
            <section className="modern-section" style={{ background: '#f9f9f9' }}>
                <div className="modern-container">
                    <div className="modern-split">
                        <div className="modern-split-content">
                            <h2 className="modern-section-title">Detalhes & Localização</h2>
                            <div className="modern-location">
                                <MapPin size={24} color={primaryColor} />
                                {stats.location}
                            </div>

                            <ul className="modern-amenities">
                                {amenities.map((item, i) => (
                                    <li key={i}>
                                        <span className="modern-check">•</span> {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="modern-split-form">
                            <div className="modern-form-box">
                                <h3>Fale com nosso Agente IA</h3>
                                <p>Tire suas dúvidas agora mesmo.</p>
                                <button className="modern-cta-secondary full-width" onClick={() => {
                                    trackEvent('chat_cta_clicked', { location: 'amenities_section' })
                                    // Trigger chat open event global logic if possible, or just let user click the widget
                                    // ideally dispatch event
                                    const widget = document.getElementById('pilger-chat-widget')
                                    if (widget) {
                                        // This is a hack, better to use a Global Context or Event
                                        // But for now, just tracking the intent
                                        alert('Clique no ícone de chat no canto inferior direito para iniciar.')
                                    }
                                }}>
                                    <MessageCircle size={20} />
                                    Iniciar Chat
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="modern-footer">
                <p>Pilger Imóveis • {new Date().getFullYear()}</p>
            </footer>

            <style jsx>{`
                .modern-template {
                    font-family: 'Outfit', sans-serif;
                    color: #1a1a1a;
                }
                .modern-hero {
                    height: 100vh;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    color: white;
                }
                .modern-hero-bg {
                    position: absolute;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    object-fit: cover;
                }
                .modern-hero-overlay {
                    position: absolute;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.7));
                }
                .modern-hero-content {
                    position: relative;
                    z-index: 10;
                    max-width: 900px;
                    padding: 0 20px;
                }
                .modern-tag {
                    text-transform: uppercase;
                    letter-spacing: 4px;
                    font-size: 0.8rem;
                    opacity: 0.9;
                    display: block;
                    margin-bottom: 20px;
                }
                .modern-title {
                    font-family: 'Playfair Display', serif;
                    font-size: 4rem;
                    line-height: 1;
                    margin-bottom: 20px;
                }
                .modern-price {
                    font-size: 1.5rem;
                    font-weight: 300;
                    margin-bottom: 40px;
                    color: var(--primary-color);
                }
                .modern-cta {
                    background: var(--primary-color);
                    color: black;
                    border: none;
                    padding: 18px 40px;
                    font-size: 1rem;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    font-weight: 600;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    transition: all 0.3s ease;
                }
                .modern-cta:hover {
                    background: white;
                    transform: translateY(-2px);
                }
                .modern-hero-stats {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 20px;
                    margin-top: 60px;
                    padding-top: 30px;
                    border-top: 1px solid rgba(255,255,255,0.2);
                }
                .modern-stat {
                    display: flex;
                    flex-direction: column;
                }
                .modern-stat span {
                    font-size: 1.5rem;
                    font-weight: 600;
                }
                .modern-stat small {
                    opacity: 0.7;
                    text-transform: uppercase;
                    font-size: 0.7rem;
                    letter-spacing: 1px;
                }
                .modern-stat-divider {
                    width: 1px;
                    height: 30px;
                    background: rgba(255,255,255,0.2);
                }
                .modern-section {
                    padding: 100px 20px;
                }
                .modern-container {
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .modern-section-title {
                    font-family: 'Playfair Display', serif;
                    font-size: 2.5rem;
                    margin-bottom: 30px;
                    color: #000;
                }
                .modern-text {
                    font-size: 1.2rem;
                    line-height: 1.8;
                    color: #555;
                }
                .modern-gallery-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
                }
                .modern-gallery-item {
                    height: 400px;
                    overflow: hidden;
                }
                .modern-gallery-item img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 0.5s ease;
                }
                .modern-gallery-item:hover img {
                    transform: scale(1.05);
                }
                .modern-split {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 60px;
                    align-items: center;
                }
                .modern-location {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 1.2rem;
                    margin-bottom: 30px;
                    color: #555;
                }
                .modern-amenities {
                    list-style: none;
                    columns: 2;
                }
                .modern-amenities li {
                    margin-bottom: 10px;
                    font-size: 1.1rem;
                }
                .modern-check {
                    color: var(--primary-color);
                    margin-right: 10px;
                }
                .modern-form-box {
                    background: black;
                    color: white;
                    padding: 40px;
                    text-align: center;
                }
                .modern-form-box h3 {
                    font-family: 'Playfair Display', serif;
                    font-size: 2rem;
                    margin-bottom: 10px;
                }
                .modern-cta-secondary {
                    background: transparent;
                    border: 1px solid var(--primary-color);
                    color: var(--primary-color);
                    padding: 15px 30px;
                    font-size: 1rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    cursor: pointer;
                    margin-top: 20px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    width: 100%;
                    transition: all 0.3s;
                }
                .modern-cta-secondary:hover {
                    background: var(--primary-color);
                    color: black;
                }
                .modern-footer {
                    background: #111;
                    color: #555;
                    padding: 40px;
                    text-align: center;
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                }
                @media (max-width: 768px) {
                    .modern-title { font-size: 2.5rem; }
                    .modern-hero-stats { display: none; }
                    .modern-split { grid-template-columns: 1fr; }
                    .modern-gallery-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    )
}
