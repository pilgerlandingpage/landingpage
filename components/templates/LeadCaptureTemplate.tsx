'use client'

import React from 'react'
import { Bed, Bath, Move, MapPin, MessageCircle, ArrowRight, Check } from 'lucide-react'
import { TemplateProps } from './types'
import LandingPageLogic from '@/components/landing/LandingPageLogic'

export default function LeadCaptureTemplate({ data, slug, landingPageId, agentName, greetingMessage }: TemplateProps) {
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
        <div style={{ '--primary-color': primaryColor } as React.CSSProperties} className="lead-template">
            {/* Tracking & Chat Logic */}
            <LandingPageLogic
                slug={slug}
                landingPageId={landingPageId}
                agentName={agentName}
                greetingMessage={greetingMessage}
            />

            {/* Hero Section - Split Layout with Form */}
            <section className="lead-hero">
                <img src={heroImage} className="lead-hero-bg" alt={title} />
                <div className="lead-hero-overlay" />

                <div className="lead-container lead-hero-grid">
                    <div className="lead-hero-content">
                        <span className="lead-tag">Oportunidade Única</span>
                        <h1 className="lead-title">{title}</h1>
                        <p className="lead-subtitle">{description.slice(0, 150)}...</p>

                        <div className="lead-features">
                            <div className="lead-feature">
                                <Bed size={20} /> {stats.bedrooms} Quartos
                            </div>
                            <div className="lead-feature">
                                <Move size={20} /> {stats.area}m²
                            </div>
                            <div className="lead-feature">
                                <MapPin size={20} /> {stats.location}
                            </div>
                        </div>
                    </div>

                    <div className="lead-form-wrapper">
                        <div className="lead-form-card">
                            <div className="lead-form-header">
                                <h3>Interesse no Imóvel?</h3>
                                <p>Fale com nossa IA agora e agende sua visita.</p>
                            </div>

                            <div className="lead-price-display">
                                <small>Valor de Investimento</small>
                                <strong>{price}</strong>
                            </div>

                            <button className="lead-cta-button full-width">
                                <MessageCircle size={20} />
                                Iniciar Conversa via WhatsApp
                            </button>

                            <p className="lead-disclaimer">
                                Atendimento imediato 24/7
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Details Section */}
            <section className="lead-section">
                <div className="lead-container">
                    <div className="lead-details-grid">
                        <div className="lead-text-content">
                            <h2 className="lead-section-title">Sobre o Empreendimento</h2>
                            <p className="lead-text">{description}</p>

                            <h3 className="lead-subsection-title">Diferenciais Exclusivos</h3>
                            <ul className="lead-amenities">
                                {amenities.map((item, i) => (
                                    <li key={i}>
                                        <Check size={18} className="lead-check" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="lead-gallery-grid">
                            {gallery.slice(0, 4).map((img, i) => (
                                <img key={i} src={img} alt={`Preview ${i}`} />
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="lead-footer">
                <p>© Pilger Imóveis</p>
            </footer>

            <style jsx>{`
                .lead-template {
                    font-family: 'Inter', sans-serif;
                    color: #333;
                }
                .lead-hero {
                    min-height: 90vh;
                    position: relative;
                    display: flex;
                    align-items: center;
                    color: white;
                    padding: 80px 0;
                }
                .lead-hero-bg {
                    position: absolute;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    object-fit: cover;
                    z-index: -2;
                }
                .lead-hero-overlay {
                    position: absolute;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    background: rgba(0,0,0,0.6);
                    z-index: -1;
                }
                .lead-container {
                    max-width: 1100px;
                    margin: 0 auto;
                    padding: 0 20px;
                    width: 100%;
                }
                .lead-hero-grid {
                    display: grid;
                    grid-template-columns: 1.2fr 0.8fr;
                    gap: 60px;
                    align-items: center;
                }
                .lead-tag {
                    background: var(--primary-color);
                    color: black;
                    padding: 4px 12px;
                    border-radius: 4px;
                    font-size: 0.8rem;
                    font-weight: 700;
                    text-transform: uppercase;
                }
                .lead-title {
                    font-size: 3rem;
                    font-weight: 800;
                    margin: 20px 0;
                    line-height: 1.1;
                }
                .lead-subtitle {
                    font-size: 1.2rem;
                    opacity: 0.9;
                    margin-bottom: 30px;
                    line-height: 1.6;
                }
                .lead-features {
                    display: flex;
                    gap: 20px;
                    margin-top: 30px;
                }
                .lead-feature {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: rgba(255,255,255,0.1);
                    padding: 8px 16px;
                    border-radius: 50px;
                    font-size: 0.9rem;
                }
                .lead-form-card {
                    background: white;
                    color: #333;
                    padding: 30px;
                    border-radius: 12px;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.3);
                }
                .lead-form-header h3 {
                    font-size: 1.5rem;
                    margin-bottom: 8px;
                    color: var(--primary-color);
                }
                .lead-price-display {
                    background: #f5f5f5;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                    text-align: center;
                }
                .lead-price-display small {
                    display: block;
                    font-size: 0.8rem;
                    color: #666;
                    text-transform: uppercase;
                }
                .lead-price-display strong {
                    font-size: 1.8rem;
                    color: #333;
                }
                .lead-cta-button {
                    background: #25D366; /* WhatsApp Green */
                    color: white;
                    border: none;
                    padding: 16px;
                    border-radius: 8px;
                    font-size: 1.1rem;
                    font-weight: 600;
                    width: 100%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    transition: filter 0.2s;
                    box-shadow: 0 4px 15px rgba(37, 211, 102, 0.4);
                }
                .lead-cta-button:hover {
                    filter: brightness(1.1);
                }
                .lead-disclaimer {
                    font-size: 0.75rem;
                    color: #999;
                    text-align: center;
                    margin-top: 15px;
                }
                .lead-section {
                    padding: 80px 0;
                    background: #fff;
                }
                .lead-details-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 60px;
                }
                .lead-section-title {
                    font-size: 2rem;
                    margin-bottom: 20px;
                    color: #111;
                }
                .lead-text {
                    font-size: 1.1rem;
                    line-height: 1.7;
                    color: #555;
                    margin-bottom: 30px;
                }
                .lead-amenities {
                    list-style: none;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                }
                .lead-amenities li {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 1rem;
                }
                .lead-check {
                    color: var(--primary-color);
                    background: rgba(200, 169, 110, 0.2);
                    padding: 2px;
                    border-radius: 50%;
                }
                .lead-gallery-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                .lead-gallery-grid img {
                    width: 100%;
                    height: 200px;
                    object-fit: cover;
                    border-radius: 8px;
                }
                .lead-footer {
                    background: #f5f5f5;
                    color: #999;
                    padding: 30px;
                    text-align: center;
                    font-size: 0.8rem;
                }
                @media (max-width: 768px) {
                    .lead-hero-grid { grid-template-columns: 1fr; }
                    .lead-details-grid { grid-template-columns: 1fr; }
                    .lead-title { font-size: 2.2rem; }
                }
            `}</style>
        </div>
    )
}
