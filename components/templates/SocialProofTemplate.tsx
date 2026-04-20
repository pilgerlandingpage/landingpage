'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Star, Eye, MapPin, ChevronRight, Quote } from 'lucide-react'
import { TemplateProps } from './types'
import LandingPageLogic from '@/components/landing/LandingPageLogic'
import { openWhatsAppWithLeadCapture } from '@/lib/tracking/whatsapp-capture'

const testimonials = [
    { name: 'Carlos M.', text: 'Atendimento impecável. Encontraram exatamente o que eu procurava em menos de uma semana.', stars: 5 },
    { name: 'Fernanda S.', text: 'Profissionalismo de outro nível. Recomendo a todos que buscam um imóvel de alto padrão.', stars: 5 },
    { name: 'Roberto L.', text: 'Melhor experiência imobiliária que já tive. Equipe atenciosa e muito preparada.', stars: 5 },
]

export default function SocialProofTemplate({ data, slug, landingPageId, agentName, greetingMessage }: TemplateProps) {
    const { title, heroImage, price, cta, stats, primaryColor } = data

    const [broker, setBroker] = useState<{ phone?: string; greeting_message?: string } | null>(null)

    useEffect(() => {
        fetch(`/api/broker-for-page?slug=${slug}`)
            .then(r => r.json())
            .then(d => { if (d.broker) setBroker(d.broker) })
            .catch(() => {})
    }, [slug])

    const openChat = useCallback(() => {
        if (broker?.phone) {
            openWhatsAppWithLeadCapture({
                phone: broker.phone,
                message: broker.greeting_message || '',
                slug,
                template: 'social-proof',
            })
        }
    }, [broker, slug])

    return (
        <div className="sp" style={{ '--pc': primaryColor } as React.CSSProperties}>
            <LandingPageLogic slug={slug} landingPageId={landingPageId} agentName={agentName} greetingMessage={greetingMessage} />

            {/* === SECTION 1: Hero Compacto === */}
            <section className="sp-hero">
                <img src={heroImage} className="sp-bg" alt={title} />
                <div className="sp-overlay" />
                <div className="sp-hero-content">
                    {/* Social Proof Badge */}
                    <div className="sp-views">
                        <Eye size={14} />
                        <span>127 pessoas viram esta semana</span>
                    </div>

                    <h1 className="sp-title">{title}</h1>

                    <div className="sp-location">
                        <MapPin size={14} />
                        <span>{stats.location}</span>
                    </div>

                    <div className="sp-price">{price}</div>

                    <button className="sp-cta" onClick={openChat}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                        Falar com Especialista
                    </button>
                </div>
            </section>

            {/* === SECTION 2: Depoimentos === */}
            <section className="sp-testimonials">
                <h2 className="sp-section-title">O que nossos clientes dizem</h2>
                <div className="sp-reviews">
                    {testimonials.map((t, i) => (
                        <div key={i} className="sp-review-card">
                            <div className="sp-stars">
                                {Array(t.stars).fill(0).map((_, j) => (
                                    <Star key={j} size={14} fill="#f59e0b" color="#f59e0b" />
                                ))}
                            </div>
                            <p className="sp-review-text">"{t.text}"</p>
                            <div className="sp-reviewer">
                                <div className="sp-avatar">{t.name.charAt(0)}</div>
                                <span className="sp-reviewer-name">{t.name}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* === SECTION 3: CTA Final === */}
            <section className="sp-cta-section">
                <Quote size={32} className="sp-quote-icon" />
                <h2 className="sp-cta-title">Não perca esta oportunidade</h2>
                <p className="sp-cta-sub">Fale agora com um especialista e descubra condições exclusivas.</p>
                <button className="sp-cta sp-cta-final" onClick={openChat}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                    Falar com Especialista
                </button>
            </section>

            {/* === STICKY BAR (mobile) === */}
            <div className="sp-sticky">
                <div className="sp-sticky-info">
                    <div className="sp-sticky-views"><Eye size={12} /> 127 viram</div>
                    <div className="sp-sticky-price">{price}</div>
                </div>
                <button className="sp-sticky-btn" onClick={openChat}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white" style={{ flexShrink: 0 }}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                    WhatsApp
                </button>
            </div>

            <style jsx>{`
                .sp { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a1a; }

                /* === HERO === */
                .sp-hero {
                    position: relative;
                    min-height: 70vh;
                    display: flex;
                    align-items: flex-end;
                    color: white;
                    overflow: hidden;
                }
                .sp-bg {
                    position: absolute; inset: 0;
                    width: 100%; height: 100%;
                    object-fit: cover;
                }
                .sp-overlay {
                    position: absolute; inset: 0;
                    background: linear-gradient(
                        to bottom,
                        rgba(0,0,0,0.2) 0%,
                        rgba(0,0,0,0.75) 70%,
                        rgba(0,0,0,0.95) 100%
                    );
                }
                .sp-hero-content {
                    position: relative; z-index: 2;
                    padding: 24px 20px 32px;
                    width: 100%;
                    max-width: 500px;
                }

                /* === SOCIAL PROOF BADGE === */
                .sp-views {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: rgba(255,255,255,0.15);
                    backdrop-filter: blur(8px);
                    border: 1px solid rgba(255,255,255,0.2);
                    padding: 5px 12px;
                    border-radius: 50px;
                    font-size: 0.72rem;
                    font-weight: 600;
                    margin-bottom: 12px;
                }

                .sp-title {
                    font-family: 'Playfair Display', serif;
                    font-size: clamp(1.6rem, 6vw, 2.4rem);
                    font-weight: 700;
                    line-height: 1.1;
                    margin: 0 0 6px;
                }
                .sp-location {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.8rem;
                    opacity: 0.7;
                    margin-bottom: 10px;
                }
                .sp-price {
                    font-size: clamp(1.3rem, 5vw, 1.8rem);
                    font-weight: 800;
                    color: var(--pc);
                    margin-bottom: 16px;
                }

                /* === CTA === */
                .sp-cta {
                    width: 100%;
                    max-width: 320px;
                    padding: 14px 24px;
                    background: #25D366;
                    color: #FFFFFF;
                    border: none;
                    border-radius: 50px;
                    font-size: 1rem;
                    font-weight: 700;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: transform 0.2s, box-shadow 0.2s;
                    box-shadow: 0 4px 20px rgba(37, 211, 102, 0.3);
                }
                .sp-cta:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 30px rgba(37, 211, 102, 0.5);
                }

                /* === TESTIMONIALS === */
                .sp-testimonials {
                    padding: 40px 20px;
                    background: #f9f9f7;
                }
                .sp-section-title {
                    font-family: 'Playfair Display', serif;
                    font-size: 1.3rem;
                    text-align: center;
                    margin-bottom: 20px;
                    color: #1a1a1a;
                }
                .sp-reviews {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    max-width: 500px;
                    margin: 0 auto;
                }
                .sp-review-card {
                    background: white;
                    border: 1px solid #e8e5e0;
                    border-radius: 14px;
                    padding: 16px;
                }
                .sp-stars {
                    display: flex;
                    gap: 2px;
                    margin-bottom: 8px;
                }
                .sp-review-text {
                    font-size: 0.88rem;
                    line-height: 1.5;
                    color: #555;
                    margin: 0 0 10px;
                    font-style: italic;
                }
                .sp-reviewer {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .sp-avatar {
                    width: 28px; height: 28px;
                    background: var(--pc);
                    color: #0a0a0a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.75rem;
                    font-weight: 700;
                }
                .sp-reviewer-name {
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #333;
                }

                /* === CTA SECTION === */
                .sp-cta-section {
                    padding: 40px 20px 100px;
                    text-align: center;
                    background: #1a1a1a;
                    color: white;
                }
                .sp-quote-icon {
                    color: var(--pc);
                    opacity: 0.4;
                    margin-bottom: 12px;
                }
                .sp-cta-title {
                    font-family: 'Playfair Display', serif;
                    font-size: 1.4rem;
                    margin-bottom: 8px;
                }
                .sp-cta-sub {
                    font-size: 0.85rem;
                    opacity: 0.7;
                    margin-bottom: 20px;
                    max-width: 320px;
                    margin-left: auto;
                    margin-right: auto;
                }
                .sp-cta-final {
                    background: #25D366;
                    color: #FFFFFF;
                    box-shadow: 0 4px 20px rgba(37,211,102,0.35);
                }

                /* === STICKY BAR === */
                .sp-sticky {
                    position: fixed;
                    bottom: 0; left: 0; right: 0;
                    z-index: 50;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 16px;
                    background: rgba(255, 255, 255, 0.97);
                    backdrop-filter: blur(12px);
                    border-top: 1px solid #e8e5e0;
                    box-shadow: 0 -4px 20px rgba(0,0,0,0.08);
                }
                .sp-sticky-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .sp-sticky-views {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.65rem;
                    color: #888;
                    text-transform: uppercase;
                }
                .sp-sticky-price {
                    font-size: 1rem;
                    font-weight: 800;
                    color: #1a1a1a;
                }
                .sp-sticky-btn {
                    padding: 10px 20px;
                    background: #25D366;
                    color: #FFFFFF;
                    border: none;
                    border-radius: 50px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: transform 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .sp-sticky-btn:hover { transform: scale(1.05); }

                /* === DESKTOP === */
                @media (min-width: 768px) {
                    .sp-sticky { display: none; }
                    .sp-hero { min-height: 75vh; align-items: center; justify-content: center; text-align: center; }
                    .sp-hero-content { padding: 40px; margin: 0 auto; }
                    .sp-reviews { flex-direction: row; max-width: 900px; }
                    .sp-cta-section { padding-bottom: 60px; }
                }
            `}</style>
        </div>
    )
}
