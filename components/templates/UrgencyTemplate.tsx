'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Clock, Flame, MapPin, ChevronRight } from 'lucide-react'
import { TemplateProps } from './types'
import LandingPageLogic from '@/components/landing/LandingPageLogic'

export default function UrgencyTemplate({ data, slug, landingPageId, agentName, greetingMessage }: TemplateProps) {
    const { title, heroImage, price, cta, stats, primaryColor } = data

    // Countdown timer — 48h from first visit
    const [timeLeft, setTimeLeft] = useState({ hours: 47, minutes: 59, seconds: 59 })

    useEffect(() => {
        const stored = localStorage.getItem(`lp_timer_${slug}`)
        const deadline = stored ? parseInt(stored) : Date.now() + 48 * 60 * 60 * 1000
        if (!stored) localStorage.setItem(`lp_timer_${slug}`, String(deadline))

        const tick = () => {
            const diff = Math.max(0, deadline - Date.now())
            setTimeLeft({
                hours: Math.floor(diff / 3600000),
                minutes: Math.floor((diff % 3600000) / 60000),
                seconds: Math.floor((diff % 60000) / 1000)
            })
        }
        tick()
        const id = setInterval(tick, 1000)
        return () => clearInterval(id)
    }, [slug])

    // Open chat programmatically
    const openChat = useCallback(() => {
        window.dispatchEvent(new CustomEvent('open-concierge-chat'))
    }, [])

    return (
        <div className="urg" style={{ '--pc': primaryColor } as React.CSSProperties}>
            <LandingPageLogic slug={slug} landingPageId={landingPageId} agentName={agentName} greetingMessage={greetingMessage} />

            {/* === HERO: 100vh mobile === */}
            <section className="urg-hero">
                <img src={heroImage} className="urg-bg" alt={title} />
                <div className="urg-overlay" />

                <div className="urg-content">
                    {/* Scarcity Badge */}
                    <div className="urg-badge">
                        <Flame size={14} />
                        <span>Últimas 3 unidades disponíveis</span>
                    </div>

                    {/* Title */}
                    <h1 className="urg-title">{title}</h1>

                    {/* Location */}
                    <div className="urg-location">
                        <MapPin size={14} />
                        <span>{stats.location}</span>
                    </div>

                    {/* Price */}
                    <div className="urg-price">{price}</div>

                    {/* Countdown Timer */}
                    <div className="urg-timer-label">Condição especial expira em:</div>
                    <div className="urg-timer">
                        <div className="urg-timer-block">
                            <span className="urg-timer-num">{String(timeLeft.hours).padStart(2, '0')}</span>
                            <span className="urg-timer-unit">horas</span>
                        </div>
                        <span className="urg-timer-sep">:</span>
                        <div className="urg-timer-block">
                            <span className="urg-timer-num">{String(timeLeft.minutes).padStart(2, '0')}</span>
                            <span className="urg-timer-unit">min</span>
                        </div>
                        <span className="urg-timer-sep">:</span>
                        <div className="urg-timer-block">
                            <span className="urg-timer-num">{String(timeLeft.seconds).padStart(2, '0')}</span>
                            <span className="urg-timer-unit">seg</span>
                        </div>
                    </div>

                    {/* CTA Button */}
                    <button className="urg-cta" onClick={openChat}>
                        {cta || 'Saiba Mais'}
                        <ChevronRight size={20} />
                    </button>

                    <p className="urg-micro">Atendimento imediato com corretor especialista</p>
                </div>
            </section>

            {/* === STICKY CTA BAR (mobile) === */}
            <div className="urg-sticky">
                <div className="urg-sticky-price">{price}</div>
                <button className="urg-sticky-btn" onClick={openChat}>
                    <Flame size={16} />
                    {cta || 'Saiba Mais'}
                </button>
            </div>

            <style jsx>{`
                .urg { font-family: 'Inter', -apple-system, sans-serif; }

                /* === HERO === */
                .urg-hero {
                    position: relative;
                    min-height: 100vh;
                    min-height: 100dvh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    color: white;
                    overflow: hidden;
                }
                .urg-bg {
                    position: absolute; inset: 0;
                    width: 100%; height: 100%;
                    object-fit: cover;
                    animation: urg-zoom 20s ease-in-out infinite alternate;
                }
                @keyframes urg-zoom {
                    from { transform: scale(1); }
                    to { transform: scale(1.08); }
                }
                .urg-overlay {
                    position: absolute; inset: 0;
                    background: linear-gradient(
                        to bottom,
                        rgba(0,0,0,0.4) 0%,
                        rgba(0,0,0,0.7) 60%,
                        rgba(0,0,0,0.9) 100%
                    );
                }
                .urg-content {
                    position: relative; z-index: 2;
                    padding: 24px 20px 100px;
                    max-width: 500px;
                    width: 100%;
                }

                /* === BADGE === */
                .urg-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: linear-gradient(135deg, #ef4444, #dc2626);
                    color: white;
                    padding: 6px 14px;
                    border-radius: 50px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    animation: urg-pulse 2s ease-in-out infinite;
                }
                @keyframes urg-pulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
                    50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
                }

                /* === TEXT === */
                .urg-title {
                    font-family: 'Playfair Display', serif;
                    font-size: clamp(1.8rem, 7vw, 2.8rem);
                    font-weight: 700;
                    line-height: 1.1;
                    margin: 16px 0 8px;
                }
                .urg-location {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.85rem;
                    opacity: 0.8;
                    margin-bottom: 12px;
                }
                .urg-price {
                    font-size: clamp(1.4rem, 5vw, 2rem);
                    font-weight: 800;
                    color: var(--pc);
                    margin-bottom: 20px;
                }

                /* === TIMER === */
                .urg-timer-label {
                    font-size: 0.7rem;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    opacity: 0.7;
                    margin-bottom: 8px;
                }
                .urg-timer {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    margin-bottom: 24px;
                }
                .urg-timer-block {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    background: rgba(255,255,255,0.1);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255,255,255,0.15);
                    border-radius: 10px;
                    padding: 8px 12px;
                    min-width: 56px;
                }
                .urg-timer-num {
                    font-size: 1.6rem;
                    font-weight: 800;
                    font-variant-numeric: tabular-nums;
                    line-height: 1;
                }
                .urg-timer-unit {
                    font-size: 0.6rem;
                    text-transform: uppercase;
                    opacity: 0.6;
                    letter-spacing: 1px;
                    margin-top: 2px;
                }
                .urg-timer-sep {
                    font-size: 1.4rem;
                    font-weight: 700;
                    opacity: 0.5;
                }

                /* === CTA === */
                .urg-cta {
                    width: 100%;
                    max-width: 320px;
                    padding: 16px 24px;
                    background: var(--pc);
                    color: #0a0a0a;
                    border: none;
                    border-radius: 50px;
                    font-size: 1.05rem;
                    font-weight: 700;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: transform 0.2s, box-shadow 0.2s;
                    box-shadow: 0 4px 20px rgba(201, 169, 110, 0.4);
                }
                .urg-cta:hover {
                    transform: translateY(-2px) scale(1.02);
                    box-shadow: 0 8px 30px rgba(201, 169, 110, 0.5);
                }
                .urg-micro {
                    font-size: 0.7rem;
                    opacity: 0.5;
                    margin-top: 12px;
                }

                /* === STICKY BAR === */
                .urg-sticky {
                    position: fixed;
                    bottom: 0; left: 0; right: 0;
                    z-index: 50;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 16px;
                    background: rgba(10, 10, 10, 0.95);
                    backdrop-filter: blur(12px);
                    border-top: 1px solid rgba(255,255,255,0.1);
                }
                .urg-sticky-price {
                    font-size: 1rem;
                    font-weight: 700;
                    color: var(--pc);
                }
                .urg-sticky-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 10px 20px;
                    background: var(--pc);
                    color: #0a0a0a;
                    border: none;
                    border-radius: 50px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                .urg-sticky-btn:hover { transform: scale(1.05); }

                /* === DESKTOP === */
                @media (min-width: 768px) {
                    .urg-sticky { display: none; }
                    .urg-content { padding-bottom: 60px; }
                }
            `}</style>
        </div>
    )
}
