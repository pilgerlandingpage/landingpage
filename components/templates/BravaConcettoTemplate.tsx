'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
    Menu, X, ChevronDown, MapPin, Sparkles, Building2, Wind,
    Shield, Check, MessageCircle, ArrowRight, Download, Droplet, Maximize
} from 'lucide-react'
import { TemplateProps } from './types'
import LandingPageLogic from '@/components/landing/LandingPageLogic'

// ─── Design Tokens (Quiet Luxury) ────────────────────────────────────────────────
const COLORS = {
    bg: '#FCFBF9',         // Areia super claro
    bgDark: '#0A0A0A',     // Preto quase absoluto
    bgSoft: '#F2F0EA',     // Off-white acinzentado
    headings: '#111111',   // Grafite ultra escuro
    text: '#4A4A4A',       // Cinza médio
    textMuted: '#8A8A8A',  // Cinza claro
    primary: '#B69A6E',    // Dourado suave/Champagne
    primaryHover: '#CDB48B',
    white: '#FFFFFF',
    border: 'rgba(182, 154, 110, 0.15)', // Bordas douradas sutis
}

export default function BravaConcettoTemplate({ data, slug, landingPageId, agentName, greetingMessage }: TemplateProps) {
    const { title, description, price, cta, stats, amenities, primaryColor } = data
    const heroImage = '/images/01.png'

    // Array original das 25 imagens espelhadas do diretório "image/"
    const gallery = [
        '/images/brava-concetto/brava_concetto_pagina_3.png',
        '/images/brava-concetto/brava_concetto_pagina_7.png',
        '/images/brava-concetto/brava_concetto_pagina_9.png',
        '/images/brava-concetto/brava_concetto_pagina_10.png',
        '/images/brava-concetto/brava_concetto_pagina_11.png',
        '/images/brava-concetto/brava_concetto_pagina_12.png',
        '/images/brava-concetto/brava_concetto_pagina_13.png',
        '/images/brava-concetto/brava_concetto_pagina_14.png',
        '/images/brava-concetto/brava_concetto_pagina_15.png',
        '/images/brava-concetto/brava_concetto_pagina_16.png',
        '/images/brava-concetto/brava_concetto_pagina_17.png',
        '/images/brava-concetto/brava_concetto_pagina_18.png',
        '/images/brava-concetto/brava_concetto_pagina_19.png',
        '/images/brava-concetto/brava_concetto_pagina_20.png',
        '/images/brava-concetto/brava_concetto_pagina_21.png',
        '/images/brava-concetto/brava_concetto_pagina_22.png',
        '/images/brava-concetto/brava_concetto_pagina_23.png',
        '/images/brava-concetto/brava_concetto_pagina_24.png',
        '/images/brava-concetto/brava_concetto_pagina_25.png',
        '/images/brava-concetto/brava_concetto_pagina_26.png',
        '/images/brava-concetto/brava_concetto_pagina_27.png',
        '/images/brava-concetto/brava_concetto_pagina_28.png',
        '/images/brava-concetto/brava_concetto_pagina_29.png',
        '/images/brava-concetto/brava_concetto_pagina_30.png',
        '/images/brava-concetto/brava_concetto_pagina_31.png'
    ]

    const [isScrolled, setIsScrolled] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [activeGalleryIndex, setActiveGalleryIndex] = useState(0)

    // Scroll & Intersection Observer para Animações Reveal
    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 50)
        window.addEventListener('scroll', handleScroll)

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const target = entry.target as HTMLElement
                        target.classList.add('brava-visible')
                        target.style.opacity = '1'
                        target.style.transform = 'translateY(0)'
                    }
                })
            },
            { threshold: 0.15 }
        )

        document.querySelectorAll('.brava-animate').forEach((el) => {
            ; (el as HTMLElement).style.opacity = '0'
                ; (el as HTMLElement).style.transform = 'translateY(40px)'
                ; (el as HTMLElement).style.transition = 'all 1.2s cubic-bezier(0.25, 0.8, 0.25, 1)'
            observer.observe(el)
        })

        return () => {
            window.removeEventListener('scroll', handleScroll)
            observer.disconnect()
        }
    }, [])

    // Carrossel Automático Lifestyle
    useEffect(() => {
        if (gallery.length <= 1) return
        const timer = setInterval(() => {
            setActiveGalleryIndex((prev) => (prev + 1) % 6) // Rotacionar primeiras 6 imagens
        }, 5000)
        return () => clearInterval(timer)
    }, [gallery.length])

    const openChat = useCallback(() => {
        window.dispatchEvent(new CustomEvent('open-concierge-chat'))
    }, [])

    return (
        <div className="brava-concetto-template" style={{
            fontFamily: '"Inter", sans-serif',
            color: COLORS.text,
            background: COLORS.bg,
            overflowX: 'hidden',
            position: 'relative',
        }}>
            {/* Inject Google Fonts for Serif (Playfair Display) + Sans (Inter/Work Sans) */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Work+Sans:wght@300;400;500;600&display=swap');
                
                .font-serif { font-family: 'Cormorant Garamond', serif; }
                .font-sans { font-family: 'Work Sans', sans-serif; }
                .font-inter { font-family: 'Inter', sans-serif; }

                html { scroll-behavior: smooth; }
            `}} />

            <LandingPageLogic slug={slug} landingPageId={landingPageId} agentName={agentName} greetingMessage={greetingMessage} />

            {/* ═══════════════════ NAVBAR (MINIMALISTA) ═══════════════════ */}
            <nav style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
                transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                padding: isScrolled ? '12px 24px' : '20px 24px',
                background: isScrolled ? 'rgba(252,251,249,0.95)' : 'transparent',
                backdropFilter: isScrolled ? 'blur(20px)' : 'none',
                borderBottom: isScrolled ? `1px solid ${COLORS.border}` : '1px solid transparent',
            }}>
                <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

                    <div style={{
                        fontFamily: '"Work Sans", sans-serif', fontSize: '1.25rem', fontWeight: 300,
                        letterSpacing: '0.15em', textTransform: 'uppercase',
                        color: isScrolled ? COLORS.headings : COLORS.white,
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                        lineHeight: 1.1
                    }}>
                        <span style={{ fontSize: '0.6rem', letterSpacing: '0.4em' }}>BRAVA</span>
                        <span>CONCETTO</span>
                    </div>

                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: isScrolled ? COLORS.headings : COLORS.white,
                            padding: '8px',
                        }}
                    >
                        {mobileMenuOpen ? <X size={28} strokeWidth={1.5} /> : <Menu size={28} strokeWidth={1.5} />}
                    </button>
                </div>
            </nav>

            {/* OVERLAY DE MENU */}
            {mobileMenuOpen && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 49,
                    background: COLORS.bg,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 32, opacity: 0, animation: 'fadeIn 0.4s forwards'
                }}>
                    <style>{`@keyframes fadeIn { to { opacity: 1; } }`}</style>
                    {['Início', 'Conceito', 'Diferenciais', 'Lifestyle', 'Tipologias'].map((item) => (
                        <a
                            key={item}
                            href={`#${item.toLowerCase()}`}
                            onClick={() => setMobileMenuOpen(false)}
                            className="font-serif"
                            style={{
                                fontSize: '2rem', fontWeight: 300,
                                color: COLORS.headings, textDecoration: 'none',
                                transition: 'color 0.4s',
                            }}
                        >
                            {item}
                        </a>
                    ))}
                    <button onClick={openChat} style={{
                        background: 'transparent', border: `1px solid ${COLORS.primary}`, color: COLORS.primary,
                        padding: '12px 32px', fontSize: '0.8rem', letterSpacing: '0.2em', textTransform: 'uppercase',
                        marginTop: 24, cursor: 'pointer'
                    }}>
                        Falar com Especialista
                    </button>
                </div>
            )}

            {/* ═══════════════════ 1. HERO SECTION (IMPACTO IMEDIATO) ═══════════════════ */}
            <section id="início" style={{
                position: 'relative', height: '100vh', minHeight: 800, width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
            }}>
                <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
                    <img
                        src={heroImage}
                        alt="Brava Concetto"
                        style={{
                            width: '100%', height: '100%', objectFit: 'cover',
                            objectPosition: 'center 40%',
                            transition: 'transform 25s ease-out',
                        }}
                    />
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: `linear-gradient(to bottom, rgba(10,10,10,0.6) 0%, rgba(10,10,10,0.3) 40%, rgba(10,10,10,0.85) 100%)`,
                    }} />
                </div>

                <div style={{
                    position: 'relative', zIndex: 10,
                    textAlign: 'center', padding: '0 24px',
                    maxWidth: 1000, marginTop: 80,
                }}>
                    <h1 className="font-serif brava-animate" style={{
                        fontSize: 'clamp(3rem, 7vw, 5.5rem)',
                        fontWeight: 300, color: COLORS.white,
                        lineHeight: 1.1, marginBottom: 24,
                        letterSpacing: '-0.02em',
                        textShadow: '0 4px 24px rgba(0,0,0,0.5)',
                    }}>
                        O privilégio de viver entre o mar<br />
                        <span style={{ fontStyle: 'italic', color: COLORS.primary, textShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>e o extraordinário.</span>
                    </h1>

                    <p className="font-sans brava-animate" style={{
                        fontSize: 'clamp(1rem, 2vw, 1.25rem)',
                        color: 'rgba(255,255,255,0.95)',
                        fontWeight: 300, letterSpacing: '0.05em',
                        maxWidth: 600, margin: '0 auto 48px',
                        lineHeight: 1.6,
                        textShadow: '0 2px 12px rgba(0,0,0,0.8)',
                    }}>
                        Uma obra-prima atemporal na Praia Brava. Arquitetura em harmonia com a natureza e o design conceitual.
                    </p>

                    <div className="brava-animate" style={{
                        display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center'
                    }}>
                        <button
                            onClick={openChat}
                            className="font-sans"
                            style={{
                                background: COLORS.primary, border: `1px solid ${COLORS.primary}`,
                                color: COLORS.white, padding: '16px 40px',
                                fontSize: '0.75rem', letterSpacing: '0.15em',
                                textTransform: 'uppercase', cursor: 'pointer',
                                fontWeight: 500, transition: 'all 0.4s',
                            }}
                        >
                            Agendar Apresentação Privativa
                        </button>

                        <button
                            onClick={openChat}
                            className="font-sans"
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 10,
                                background: 'transparent', border: `1px solid rgba(255,255,255,0.4)`,
                                color: COLORS.white, padding: '16px 40px',
                                fontSize: '0.75rem', letterSpacing: '0.15em',
                                textTransform: 'uppercase', cursor: 'pointer',
                                fontWeight: 500, transition: 'all 0.4s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        >
                            <Download size={16} /> Receber Catálogo Exclusivo
                        </button>
                    </div>
                </div>

                <div className="font-sans" style={{
                    position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
                    color: 'rgba(255,255,255,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    fontSize: '0.65rem', letterSpacing: '0.3em', textTransform: 'uppercase'
                }}>
                    Role para descobrir
                    <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.3)' }} />
                </div>
            </section>

            {/* ═══════════════════ 2. CONCEITO (STORYTELLING) ═══════════════════ */}
            <section id="conceito" style={{
                padding: 'clamp(100px, 15vw, 180px) 24px', background: COLORS.bg,
                position: 'relative'
            }}>
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 450px), 1fr))',
                        gap: 'clamp(60px, 10vw, 120px)', alignItems: 'center',
                    }}>
                        <div className="brava-animate">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                                <div style={{ width: 40, height: 1, background: COLORS.primary }} />
                                <span className="font-sans" style={{
                                    fontSize: '0.7rem', letterSpacing: '0.3em',
                                    textTransform: 'uppercase', color: COLORS.primary,
                                }}>Identidade & Status</span>
                            </div>

                            <h2 className="font-serif" style={{
                                fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                                fontWeight: 300, color: COLORS.headings,
                                lineHeight: 1.1, marginBottom: 32,
                            }}>
                                O Luxo <span style={{ fontStyle: 'italic' }}>Silencioso</span><br /> encontra a Natureza.
                            </h2>

                            <p className="font-sans" style={{
                                fontSize: '1.05rem', lineHeight: 1.8, color: COLORS.text,
                                fontWeight: 300, marginBottom: 32,
                            }}>
                                O Brava Concetto nasce da união entre arquitetura atemporal e design biofílico.
                                Não construímos apenas espaços, moldamos refúgios onde a integração com a natureza e o mar
                                transformam definitivamente o seu estilo de vida.
                            </p>
                            <p className="font-sans" style={{
                                fontSize: '1.05rem', lineHeight: 1.8, color: COLORS.text,
                                fontWeight: 300,
                            }}>
                                Um projeto desenhado para quem não precisa provar nada.
                                Apenas viver a essência do luxo autêntico.
                            </p>

                            <div style={{ marginTop: 48, display: 'flex', gap: 40 }}>
                                <div>
                                    <div className="font-serif" style={{ fontSize: '3rem', lineHeight: 1, color: COLORS.primary }}>280m²</div>
                                    <div className="font-sans" style={{ fontSize: '0.7rem', letterSpacing: '0.15em', marginTop: 8, color: COLORS.textMuted, textTransform: 'uppercase' }}>A partir de (Área Priv.)</div>
                                </div>
                                <div>
                                    <div className="font-serif" style={{ fontSize: '3rem', lineHeight: 1, color: COLORS.primary }}>4</div>
                                    <div className="font-sans" style={{ fontSize: '0.7rem', letterSpacing: '0.15em', marginTop: 8, color: COLORS.textMuted, textTransform: 'uppercase' }}>Vagas Individuais</div>
                                </div>
                            </div>
                        </div>

                        <div className="brava-animate">
                            <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4' }}>
                                <img
                                    src={gallery[3] || heroImage}
                                    alt="Fachada ou Conceito"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                <div style={{
                                    position: 'absolute', bottom: -30, left: -30,
                                    width: '60%', aspectRatio: '1', zIndex: 1,
                                    border: `8px solid ${COLORS.bg}`
                                }}>
                                    <img
                                        src={gallery[2] || heroImage}
                                        alt="Detalhe Arquitetônico"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════ 3. DIFERENCIAIS DE ALTO PADRÃO ═══════════════════ */}
            <section id="diferenciais" style={{
                padding: 'clamp(80px, 12vw, 160px) 24px', background: COLORS.bgSoft,
                borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}`,
            }}>
                <div style={{ maxWidth: 1400, margin: '0 auto' }}>
                    <div className="brava-animate" style={{ textAlign: 'center', marginBottom: 80 }}>
                        <h2 className="font-serif" style={{
                            fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 300, color: COLORS.headings,
                        }}>Exclusividade em Detalhes</h2>
                    </div>

                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: 2, background: COLORS.border, border: `1px solid ${COLORS.border}`
                    }}>
                        {[
                            { icon: Building2, title: 'Elevador Privativo', desc: 'Acesso direto e exclusivo ao seu apartamento com biometria.' },
                            { icon: Check, title: '4 Vagas Individuais', desc: 'Espaço e comodidade para sua frota e visitantes.' },
                            { icon: Wind, title: 'Piso Aquecido', desc: 'Conforto térmico absoluto nos banheiros das suítes.' },
                            { icon: Sparkles, title: 'Automação Full', desc: 'Infraestrutura completa para smart home de altíssimo padrão.' },
                            { icon: Maximize, title: 'Esquadrias Panorâmicas', desc: 'Piso ao teto, maximizando a entrada de luz natural e a vista.' },
                            { icon: Droplet, title: 'Sustentabilidade', desc: 'Projeto projetado seguindo normas Green Building Council (GBC).' },
                        ].map((diff, i) => (
                            <div key={i} className="brava-animate" style={{
                                background: COLORS.bgSoft, padding: '60px 40px',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                                transition: 'background 0.3s',
                            }} onMouseEnter={(e) => e.currentTarget.style.background = COLORS.white}
                                onMouseLeave={(e) => e.currentTarget.style.background = COLORS.bgSoft}>
                                <diff.icon size={32} color={COLORS.primary} strokeWidth={1} style={{ marginBottom: 24 }} />
                                <h3 className="font-sans" style={{
                                    fontSize: '1.1rem', fontWeight: 500, color: COLORS.headings,
                                    letterSpacing: '0.05em', marginBottom: 12
                                }}>{diff.title}</h3>
                                <p className="font-sans" style={{
                                    fontSize: '0.9rem', color: COLORS.text, lineHeight: 1.6, fontWeight: 300
                                }}>{diff.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════ 4. LIFESTYLE (VENDA EMOCIONAL) ═══════════════════ */}
            <section id="lifestyle" style={{ padding: '120px 24px', background: COLORS.bgDark, color: COLORS.white }}>
                <div style={{ maxWidth: 1400, margin: '0 auto' }}>
                    <div className="brava-animate" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 60, flexWrap: 'wrap', gap: 32 }}>
                        <div>
                            <span className="font-sans" style={{ fontSize: '0.7rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: COLORS.primary, display: 'block', marginBottom: 16 }}>
                                A Experiência
                            </span>
                            <h2 className="font-serif" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 300, lineHeight: 1.1 }}>
                                Contemplação &<br /><span style={{ fontStyle: 'italic', color: COLORS.primary }}>Silêncio.</span>
                            </h2>
                        </div>
                        <p className="font-sans" style={{ maxWidth: 400, fontSize: '1rem', lineHeight: 1.8, color: 'rgba(255,255,255,0.7)', fontWeight: 300 }}>
                            Espaços desenhados para acolher a sua melhor versão.
                            Piscina com vista panorâmica, living perfeitamente integrado e um design feito para perdurar.
                        </p>
                    </div>

                    <div style={{ position: 'relative', width: '100%', aspectRatio: '21/9', overflow: 'hidden' }}>
                        {gallery.slice(4, 10).map((img, i) => (
                            <img
                                key={i} src={img} alt={`Lifestyle ${i}`}
                                style={{
                                    position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                                    opacity: i === activeGalleryIndex ? 1 : 0,
                                    transition: 'opacity 1.5s ease-in-out',
                                }}
                            />
                        ))}
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.2)' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 40, borderTop: `1px solid rgba(255,255,255,0.1)`, paddingTop: 40 }}>
                        {['Piscina Aquecida', 'Espaço Gourmet Climatizado', 'Living Integrado', 'Vista Panorâmica do Mar'].map((item, i) => (
                            <div key={i} className="font-sans" style={{
                                fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)'
                            }}>
                                0{i + 1}. <span style={{ color: COLORS.primary }}>{item}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════ 5. PLANTAS E TIPOLOGIAS ═══════════════════ */}
            <section id="tipologias" style={{ padding: 'clamp(80px, 12vw, 160px) 24px', background: COLORS.bg }}>
                <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
                    <h2 className="font-serif brava-animate" style={{ fontSize: 'clamp(2.5rem, 4vw, 3.5rem)', fontWeight: 300, color: COLORS.headings, marginBottom: 64 }}>
                        A Medida do seu Desejo.
                    </h2>

                    <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {[
                            { name: 'Apartamento Tipo', size: '280m²', desc: 'Espaços fluídos e perfeitamente dimensionados.' },
                            { name: 'Apartamento Garden', size: '340m²', desc: 'A amplitude de uma casa com a segurança de um apartamento.' },
                            { name: 'Cobertura Duplex', size: '590m²', desc: 'O ápice da exclusividade, com piscina privativa nos céus da Brava.' }
                        ].map((tipo, i) => (
                            <div key={i} className="brava-animate" style={{
                                flex: '1 1 300px', background: COLORS.white, border: `1px solid ${COLORS.border}`,
                                padding: '48px 32px', textAlign: 'center'
                            }}>
                                <h3 className="font-serif" style={{ fontSize: '1.8rem', color: COLORS.headings, marginBottom: 8 }}>{tipo.name}</h3>
                                <div className="font-sans" style={{ fontSize: '1.1rem', color: COLORS.primary, fontWeight: 500, marginBottom: 24 }}>{tipo.size}</div>
                                <p className="font-sans" style={{ fontSize: '0.95rem', color: COLORS.text, lineHeight: 1.6, fontWeight: 300, marginBottom: 32 }}>{tipo.desc}</p>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={openChat}
                        className="font-sans brava-animate"
                        style={{
                            marginTop: 64, background: 'transparent', border: `1px solid ${COLORS.headings}`,
                            color: COLORS.headings, padding: '16px 48px', fontSize: '0.75rem', letterSpacing: '0.2em',
                            textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.4s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = COLORS.headings; e.currentTarget.style.color = COLORS.white }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = COLORS.headings }}
                    >
                        Solicitar Plantas Humanizadas
                    </button>
                    <div className="font-sans brava-animate" style={{ fontSize: '0.7rem', color: COLORS.textMuted, marginTop: 16 }}>*Possibilidade de personalização total do layout.</div>
                </div>
            </section>

            {/* ═══════════════════ 6 & 7. AUTORIDADE E ESCASSEZ ═══════════════════ */}
            <section style={{ padding: '80px 24px', background: COLORS.bgSoft, borderTop: `1px solid ${COLORS.border}` }}>
                <div className="brava-animate" style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: '1 1 400px' }}>
                        <Shield color={COLORS.primary} size={32} style={{ marginBottom: 24 }} />
                        <h3 className="font-serif" style={{ fontSize: '2rem', color: COLORS.headings, marginBottom: 16 }}>Segurança & Excelência</h3>
                        <p className="font-sans" style={{ fontSize: '0.95rem', color: COLORS.text, lineHeight: 1.8, fontWeight: 300 }}>
                            Com anos de mercado e um portfólio de sucesso, garantimos não apenas uma construção de classe mundial, mas também a certificação internacional pelo Green Building Council. Patrimônio sólido garantido.
                        </p>
                    </div>
                    <div style={{ flex: '1 1 300px', textAlign: 'right' }}>
                        <div className="font-serif" style={{ fontSize: '3rem', color: COLORS.primary, lineHeight: 1 }}>Unidades<br />Limitadas.</div>
                        <p className="font-sans" style={{ fontSize: '1rem', color: COLORS.text, marginTop: 16, fontStyle: 'italic' }}>
                            Um projeto feito para poucos.
                        </p>
                    </div>
                </div>
            </section>

            {/* ═══════════════════ 8. CTA FINAL FORTE ═══════════════════ */}
            <section style={{ padding: '160px 24px', background: COLORS.bgDark, textAlign: 'center' }}>
                <div className="brava-animate" style={{ maxWidth: 800, margin: '0 auto' }}>
                    <h2 className="font-serif" style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', color: COLORS.white, fontWeight: 300, lineHeight: 1.1, marginBottom: 40 }}>
                        Você não está comprando um imóvel. <br />
                        <span style={{ fontStyle: 'italic', color: COLORS.primary }}>Está escolhendo um novo nível.</span>
                    </h2>

                    <button
                        onClick={openChat}
                        className="font-sans"
                        style={{
                            background: COLORS.primary, border: 'none', color: COLORS.white,
                            padding: '24px 60px', fontSize: '0.85rem', letterSpacing: '0.25em',
                            textTransform: 'uppercase', cursor: 'pointer', fontWeight: 500,
                            transition: 'all 0.4s', boxShadow: '0 20px 40px rgba(182, 154, 110, 0.2)'
                        }}
                    >
                        Falar com Especialista Agora
                    </button>
                </div>
            </section>



        </div>
    )
}
