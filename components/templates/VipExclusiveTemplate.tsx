'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Crown, Lock, MapPin, ChevronRight, Users } from 'lucide-react'
import { TemplateProps } from './types'
import LandingPageLogic from '@/components/landing/LandingPageLogic'

export default function VipExclusiveTemplate({ data, slug, landingPageId, agentName, greetingMessage }: TemplateProps) {
    const { title, heroImage, price, cta, stats, primaryColor } = data
    const [spotsLeft, setSpotsLeft] = useState(5) // fixed initial to avoid hydration mismatch

    useEffect(() => {
        setSpotsLeft(Math.floor(Math.random() * 8) + 3)
    }, [])

    const openChat = useCallback(() => {
        const btn = document.querySelector('.chat-toggle') as HTMLElement
        if (btn) btn.click()
    }, [])

    const filledSpots = 20 - spotsLeft
    const percentage = (filledSpots / 20) * 100

    return (
        <div className="vip" style={{ '--pc': primaryColor } as React.CSSProperties}>
            <LandingPageLogic slug={slug} landingPageId={landingPageId} agentName={agentName} greetingMessage={greetingMessage} />

            {/* === HERO: Tela cheia, premium === */}
            <section className="vip-hero">
                <img src={heroImage} className="vip-bg" alt={title} />
                <div className="vip-overlay" />

                <div className="vip-content">
                    {/* Crown Badge */}
                    <div className="vip-badge">
                        <Crown size={14} />
                        <span>Acesso Exclusivo</span>
                    </div>

                    {/* Invitation */}
                    <p className="vip-invite">Você foi convidado para uma apresentação exclusiva</p>

                    <h1 className="vip-title">{title}</h1>

                    <div className="vip-location">
                        <MapPin size={14} />
                        <span>{stats.location}</span>
                    </div>

                    <div className="vip-price">{price}</div>

                    {/* Spots Counter */}
                    <div className="vip-spots">
                        <div className="vip-spots-header">
                            <Users size={14} />
                            <span>{filledSpots} de 20 vagas preenchidas</span>
                        </div>
                        <div className="vip-progress-bar">
                            <div className="vip-progress-fill" style={{ width: `${percentage}%` }} />
                        </div>
                        <p className="vip-spots-left">Restam apenas {spotsLeft} vagas</p>
                    </div>

                    {/* CTA */}
                    <button className="vip-cta" onClick={openChat}>
                        <Lock size={16} />
                        {cta || 'Entrar na Lista VIP'}
                        <ChevronRight size={18} />
                    </button>

                    <p className="vip-disclaimer">Acesso restrito • Condições especiais para convidados</p>
                </div>
            </section>

            {/* === STICKY BAR (mobile) === */}
            <div className="vip-sticky">
                <div className="vip-sticky-spots">
                    <Crown size={14} />
                    <span>{spotsLeft} vagas restantes</span>
                </div>
                <button className="vip-sticky-btn" onClick={openChat}>
                    Lista VIP
                    <ChevronRight size={16} />
                </button>
            </div>

            <style jsx>{`
                .vip {
                    font-family: 'Inter', -apple-system, sans-serif;
                    background: #0a0a0a;
                    color: white;
                }

                /* === HERO === */
                .vip-hero {
                    position: relative;
                    min-height: 100vh;
                    min-height: 100dvh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    overflow: hidden;
                }
                .vip-bg {
                    position: absolute; inset: 0;
                    width: 100%; height: 100%;
                    object-fit: cover;
                    opacity: 0.3;
                    filter: grayscale(30%);
                }
                .vip-overlay {
                    position: absolute; inset: 0;
                    background: radial-gradient(
                        ellipse at center,
                        rgba(10,10,10,0.5) 0%,
                        rgba(10,10,10,0.85) 60%,
                        rgba(10,10,10,0.98) 100%
                    );
                }
                .vip-content {
                    position: relative; z-index: 2;
                    padding: 24px 20px 100px;
                    max-width: 420px;
                    width: 100%;
                }

                /* === BADGE === */
                .vip-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: linear-gradient(135deg, var(--pc), #8a6d3b);
                    color: #0a0a0a;
                    padding: 6px 16px;
                    border-radius: 50px;
                    font-size: 0.7rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                }

                /* === TEXT === */
                .vip-invite {
                    font-size: 0.8rem;
                    opacity: 0.6;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    margin: 20px 0 8px;
                }
                .vip-title {
                    font-family: 'Playfair Display', serif;
                    font-size: clamp(1.8rem, 7vw, 2.6rem);
                    font-weight: 700;
                    line-height: 1.1;
                    margin: 0 0 8px;
                    background: linear-gradient(135deg, #fff 20%, var(--pc) 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .vip-location {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.8rem;
                    opacity: 0.5;
                    margin-bottom: 8px;
                }
                .vip-price {
                    font-size: clamp(1.4rem, 5vw, 2rem);
                    font-weight: 800;
                    color: var(--pc);
                    margin-bottom: 24px;
                }

                /* === SPOTS COUNTER === */
                .vip-spots {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 14px;
                    padding: 14px 16px;
                    margin-bottom: 20px;
                }
                .vip-spots-header {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    font-size: 0.78rem;
                    font-weight: 600;
                    color: var(--pc);
                    margin-bottom: 8px;
                }
                .vip-progress-bar {
                    height: 6px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 10px;
                    overflow: hidden;
                    margin-bottom: 6px;
                }
                .vip-progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, var(--pc), #8a6d3b);
                    border-radius: 10px;
                    transition: width 1s ease-out;
                }
                .vip-spots-left {
                    font-size: 0.68rem;
                    opacity: 0.5;
                    margin: 0;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                /* === CTA === */
                .vip-cta {
                    width: 100%;
                    max-width: 320px;
                    padding: 16px 24px;
                    background: linear-gradient(135deg, var(--pc), #8a6d3b);
                    color: #0a0a0a;
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
                    box-shadow: 0 4px 30px rgba(201, 169, 110, 0.3);
                }
                .vip-cta:hover {
                    transform: translateY(-2px) scale(1.02);
                    box-shadow: 0 8px 40px rgba(201, 169, 110, 0.5);
                }
                .vip-disclaimer {
                    font-size: 0.65rem;
                    opacity: 0.35;
                    margin-top: 14px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                /* === STICKY BAR === */
                .vip-sticky {
                    position: fixed;
                    bottom: 0; left: 0; right: 0;
                    z-index: 50;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 16px;
                    background: rgba(10, 10, 10, 0.97);
                    backdrop-filter: blur(12px);
                    border-top: 1px solid rgba(201, 169, 110, 0.2);
                }
                .vip-sticky-spots {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    color: var(--pc);
                    font-size: 0.8rem;
                    font-weight: 600;
                }
                .vip-sticky-btn {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 10px 20px;
                    background: linear-gradient(135deg, var(--pc), #8a6d3b);
                    color: #0a0a0a;
                    border: none;
                    border-radius: 50px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                .vip-sticky-btn:hover { transform: scale(1.05); }

                /* === DESKTOP === */
                @media (min-width: 768px) {
                    .vip-sticky { display: none; }
                    .vip-content { padding-bottom: 60px; }
                }
            `}</style>
        </div>
    )
}
