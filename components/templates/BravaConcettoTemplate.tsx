'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
    X, ChevronLeft, ChevronRight, ChevronDown, MapPin, Building2,
    Leaf, Trees, AlertCircle, Check, MessageSquare, Phone, User,
    ArrowRight, Mail, Navigation, Minus, Plus, Star
} from 'lucide-react'
import { TemplateProps } from './types'
import LandingPageLogic from '@/components/landing/LandingPageLogic'

// ─── Design Tokens (Dark Green Luxury — inspired by AI Studio) ───────────
const C = {
    bgDark: '#0C0C0C',
    bgCard: '#111111',
    bgSoft: 'rgba(255,255,255,0.05)',
    bgInput: 'rgba(12,12,12,0.5)',
    primary: '#C5A059',
    primaryHover: '#b8934e',
    primaryGlow: 'rgba(197,160,89,0.35)',
    primaryMuted: 'rgba(197,160,89,0.12)',
    accentGold: '#C5A059',
    accentGoldMuted: 'rgba(197,160,89,0.1)',
    accentGoldBorder: 'rgba(197,160,89,0.2)',
    white: '#FFFFFF',
    textLight: '#e2e8f0',
    textMuted: '#94a3b8',
    textDim: '#64748b',
    textFaint: '#475569',
    border: 'rgba(255,255,255,0.1)',
    charcoal: '#1A1A1A',
}

export default function BravaConcettoTemplate({ data, slug, landingPageId, agentName, greetingMessage }: TemplateProps) {
    const gallery = [
        '/images/brava-concetto/1_CL_BC_FACHADA_DIURNA_R01.jpg',
        '/images/brava-concetto/2_CL_BC_FACHADA_NOTURNA_R01.jpg',
        '/images/brava-concetto/5_CL_BC_VOO_PASSARO_R01.jpg',
        '/images/brava-concetto/3_CL_BC_EMBASAMENTO_R01.jpg',
        '/images/brava-concetto/6_CL_BC_DETALHE_FACHADA_ANG_01_EF.jpg',
        '/images/brava-concetto/7_CL_BC_DETALHE_FACHADA_ANG_02_EF.jpg',
        '/images/brava-concetto/3_CL_BC_PRACA_ACESSO_R02_web.jpg',
        '/images/brava-concetto/4.jpg',
        '/images/brava-concetto/8_CL_BC_HALL_DE_ENTRADA_EF_web.jpg',
        '/images/brava-concetto/9_CL_BC_HALL_DE_ENTRADA_ANG_02_EF.jpg',
        '/images/brava-concetto/10_CL_BC_SALAO_DE_FESTAS_EF_web.jpg',
        '/images/brava-concetto/11_CL_BC_SALAO_DE_FESTAS_ANG_02_EF_web.jpg',
        '/images/brava-concetto/12_CL_BC_FITNESS_EF_web.jpg',
        '/images/brava-concetto/13_CL_BC_FITNESS_ANG_02_EF_web.jpg',
        '/images/brava-concetto/14_CL_BC_PISCINA_EF_web.jpg',
        '/images/brava-concetto/15_CL_BC_PISCINA_EF_web.jpg',
        '/images/brava-concetto/16_CL_BC_PISCINA_PRIVATIVA_EF_web.jpg',
        '/images/brava-concetto/17_CL_BC_QUIOSQUE_ANG_01_EF_web.jpg',
        '/images/brava-concetto/18_CL_BC_QUIOSQUE_ANG_02_EF_web.jpg',
        '/images/brava-concetto/19_CL_BC_LIVING_FINAL_01_EF_web.jpg',
        '/images/brava-concetto/20_CL_BC_LIVING_FINAL_01_ANG_02_EF_web.jpg',
        '/images/brava-concetto/21_CL_BC_LIVING_FINAL_01_DETALHE_EF_web.jpg',
        '/images/brava-concetto/22_CL_BC_LIVING_FINAL_02_EF_web.jpg',
        '/images/brava-concetto/23_CL_BC_SUITE_MASTER_FINAL_01_EF_web.jpg',
        '/images/brava-concetto/24_CL_BC_SUITE_MASTER_FINAL_02_EF_web.jpg',
        '/images/brava-concetto/25_CL_BC_LIVING_TERRACO_COBERTURA_R01_web.jpg',
    ]

    const [formData, setFormData] = useState({ name: '', phone: '', email: '' })
    const [formSent, setFormSent] = useState(false)
    const [lightboxOpen, setLightboxOpen] = useState(false)
    const [lightboxIdx, setLightboxIdx] = useState(0)
    const [faqOpen, setFaqOpen] = useState<number | null>(null)
    const [galleryIdx, setGalleryIdx] = useState(0)
    const touchStartX = useRef(0)

    useEffect(() => {
        // Intersection observer for reveal animations
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    const el = e.target as HTMLElement
                    el.style.opacity = '1'
                    el.style.transform = 'translateY(0)'
                }
            })
        }, { threshold: 0.1 })
        document.querySelectorAll('.bc-reveal').forEach(el => {
            const h = el as HTMLElement
            h.style.opacity = '0'
            h.style.transform = 'translateY(24px)'
            h.style.transition = 'opacity 0.7s ease, transform 0.7s ease'
            obs.observe(el)
        })
        return () => obs.disconnect()
    }, [])

    const openChat = useCallback(() => {
        window.dispatchEvent(new CustomEvent('open-concierge-chat'))
    }, [])

    const openLightbox = (idx: number) => { setLightboxIdx(idx); setLightboxOpen(true) }
    const closeLightbox = () => setLightboxOpen(false)
    const nextLB = () => setLightboxIdx((p) => (p + 1) % gallery.length)
    const prevLB = () => setLightboxIdx((p) => (p - 1 + gallery.length) % gallery.length)

    const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
    const handleTouchEnd = (e: React.TouchEvent) => {
        const diff = touchStartX.current - e.changedTouches[0].clientX
        if (Math.abs(diff) > 50) {
            setGalleryIdx(p => diff > 0 ? Math.min(p + 1, gallery.length - 1) : Math.max(p - 1, 0))
        }
    }

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setFormSent(true)
        setTimeout(() => openChat(), 600)
    }

    const features = [
        { icon: Building2, title: 'Design Assinado', desc: 'Arquitetura atemporal com elevador privativo, esquadrias piso-teto e acabamento de altíssimo padrão.' },
        { icon: Leaf, title: 'Certificação GBC', desc: 'Selo de excelência do Green Building Council em sustentabilidade e eficiência energética.' },
        { icon: Trees, title: 'Integração com a Natureza', desc: 'Design biofílico que preserva e valoriza a essência da Praia Brava.' },
    ]

    const units = [
        { title: 'Apartamentos Garden', size: '340m²', desc: 'Ampla área privativa com jardim exclusivo e pé-direito duplo.', img: '/images/brava-concetto/19_CL_BC_LIVING_FINAL_01_EF_web.jpg' },
        { title: 'Apartamentos Tipo', size: '280m²', desc: 'Suítes amplas e living integrado com vista mar definitiva.', img: '/images/brava-concetto/22_CL_BC_LIVING_FINAL_02_EF_web.jpg' },
        { title: 'Coberturas Duplex', size: '590m²', desc: 'O ápice do luxo com piscina privativa e 360° de exclusividade.', img: '/images/brava-concetto/25_CL_BC_LIVING_TERRACO_COBERTURA_R01_web.jpg' },
    ]

    const faqs = [
        { q: 'Qual a previsão de entrega?', a: 'Previsão para 2027. Consulte nosso especialista para datas atualizadas e condições de reserva antecipada.' },
        { q: 'É possível personalizar a planta?', a: 'Sim! Oferecemos personalização total do layout interno com equipe de arquitetura dedicada.' },
        { q: 'Quais as condições de pagamento?', a: 'Entrada facilitada, parcelas durante obra e financiamento bancário na entrega. Fale com nosso especialista para simulação.' },
        { q: 'Onde fica exatamente?', a: 'Na Praia Brava, Itajaí/SC — a 200m da orla, entre o agito de Balneário Camboriú e a natureza preservada.' },
        { q: 'Possui certificação sustentável?', a: 'Sim, certificação Green Building Council (GBC) garantindo eficiência energética e menor impacto ambiental.' },
        { q: 'Quantas unidades por andar?', a: 'Apenas 2 unidades por andar, garantindo máxima privacidade e exclusividade.' },
    ]

    // Shared styles
    const inputStyle: React.CSSProperties = {
        width: '100%', background: C.bgInput, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: '14px 14px 14px 42px', color: C.white,
        fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' as const,
        transition: 'border-color 0.2s',
    }

    const btnPrimary: React.CSSProperties = {
        width: '100%', background: C.primary, color: C.bgDark, fontWeight: 800,
        padding: '16px', borderRadius: 12, border: 'none', cursor: 'pointer',
        fontSize: '0.9rem', letterSpacing: '0.02em', transition: 'all 0.2s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    }

    return (
        <div style={{
            fontFamily: '"Manrope", "Inter", sans-serif',
            color: C.textLight, background: C.bgDark,
            overflowX: 'hidden', minHeight: '100vh',
            WebkitFontSmoothing: 'antialiased',
        }}>
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;700;800&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');
                html { scroll-behavior: smooth; }
                .font-serif { font-family: 'Playfair Display', serif; }
                .font-sans { font-family: 'Manrope', sans-serif; }
                ::selection { background: ${C.primary}; color: ${C.bgDark}; }
                @keyframes ping { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(2); opacity: 0; } }
                @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes slideDown { from { max-height: 0; opacity: 0; padding-top: 0; } to { max-height: 200px; opacity: 1; padding-top: 12px; } }
                @keyframes pulseGlow { 0%,100% { box-shadow: 0 0 0 0 ${C.primaryGlow}; } 50% { box-shadow: 0 0 0 12px rgba(22,223,102,0); } }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .gallery-track { display: flex; transition: transform 0.5s cubic-bezier(0.25,0.8,0.25,1); }
                input::placeholder { color: ${C.textDim}; }
                input:focus { border-color: ${C.primary} !important; box-shadow: 0 0 0 2px ${C.primaryMuted}; }
                
                @media (max-width: 640px) {
                    .desktop-gallery { display: none !important; }
                    .mobile-gallery { display: block !important; }
                    .units-scroll { padding-left: 20px !important; padding-right: 20px !important; }
                }
                @media (min-width: 641px) {
                    .mobile-gallery { display: none !important; }
                    .desktop-gallery { display: grid !important; }
                }
            `}} />

            <LandingPageLogic slug={slug} landingPageId={landingPageId} agentName={agentName} greetingMessage={greetingMessage} />

            {/* ═══════ HEADER ═══════ */}
            <header style={{
                position: 'sticky', top: 0, zIndex: 50,
                background: 'rgba(12,12,12,0.9)', backdropFilter: 'blur(12px)',
                borderBottom: `1px solid ${C.border}`,
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '14px 20px', maxWidth: 640, margin: '0 auto',
                }}>
                    <img src="/images/brava-concetto/brava-concetto.svg" alt="Brava Concetto" style={{ height: 32, filter: 'brightness(0) invert(1)' }} />
                </div>
            </header>

            <main style={{ maxWidth: 640, margin: '0 auto', paddingBottom: 100 }}>

                {/* ═══════ 1. HERO + LEAD FORM ═══════ */}
                <section style={{ position: 'relative' }}>
                    <div style={{
                        position: 'relative', minHeight: 620, display: 'flex', flexDirection: 'column',
                        justifyContent: 'flex-start', padding: '100px 24px 32px',
                        backgroundImage: `linear-gradient(to bottom, ${C.bgDark} 0%, rgba(12,12,12,0.75) 40%, rgba(12,12,12,0.2) 65%, rgba(12,12,12,0.0) 100%), url("/images/brava-concetto/4.jpg")`,
                        backgroundSize: 'cover', backgroundPosition: 'center bottom',
                    }}>
                        <div style={{ animation: 'fadeUp 0.8s ease' }}>
                            <span style={{
                                display: 'inline-block', padding: '5px 14px',
                                background: C.primaryMuted, color: C.primary,
                                fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.2em',
                                textTransform: 'uppercase', borderRadius: 50,
                                border: `1px solid rgba(197,160,89,0.3)`, marginBottom: 16,
                            }}>
                                Lançamento Exclusivo
                            </span>

                            <h2 className="font-serif" style={{
                                fontSize: 'clamp(1.8rem, 6vw, 2.4rem)', lineHeight: 1.15,
                                color: C.white, fontStyle: 'italic', marginBottom: 12,
                            }}>
                                Onde o Mar Encontra o Design Extraordinário
                            </h2>

                            <p style={{
                                color: C.textLight, fontSize: '1rem', lineHeight: 1.65,
                                textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                            }}>
                                Experiência inigualável na Praia Brava. O equilíbrio perfeito entre o luxo silencioso e a natureza.
                            </p>
                        </div>
                    </div>
                </section>

                {/* ═══════ 2. SCARCITY BANNER ═══════ */}
                <section style={{
                    background: C.accentGoldMuted, borderTop: `1px solid ${C.accentGoldBorder}`,
                    borderBottom: `1px solid ${C.accentGoldBorder}`, padding: '14px 24px',
                    display: 'flex', alignItems: 'center', gap: 12,
                }}>
                    <AlertCircle size={18} color={C.accentGold} style={{ flexShrink: 0 }} />
                    <p style={{
                        color: C.accentGold, fontWeight: 700, fontSize: '0.75rem',
                        letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0,
                    }}>
                        Apenas 25 Unidades Exclusivas — Alto Potencial de Valorização
                    </p>
                </section>

                {/* ═══════ 3. QUIET LUXURY CONCEPT ═══════ */}
                <section style={{ padding: '72px 24px' }}>
                    <div className="bc-reveal" style={{ marginBottom: 40 }}>
                        <h3 className="font-serif" style={{ fontSize: '1.8rem', color: C.white, marginBottom: 8 }}>Quiet Luxury</h3>
                        <div style={{ width: 48, height: 4, background: C.primary, borderRadius: 4 }} />
                    </div>

                    <p className="bc-reveal font-serif" style={{
                        color: C.textMuted, fontSize: '1.15rem', lineHeight: 1.7,
                        fontStyle: 'italic', marginBottom: 32,
                    }}>
                        "A sofisticação não precisa gritar. Ela se revela no detalhe, na escolha da textura e na harmonia com o horizonte."
                    </p>

                    <div className="bc-reveal" style={{
                        aspectRatio: '4/5', borderRadius: 16, overflow: 'hidden',
                        border: `1px solid ${C.border}`, marginBottom: 40,
                    }}>
                        <img src={gallery[2]} alt="Conceito Brava Concetto" style={{
                            width: '100%', height: '100%', objectFit: 'cover',
                        }} />
                    </div>

                    {/* Feature Cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {features.map((f, i) => (
                            <div key={i} className="bc-reveal" style={{
                                padding: 22, borderRadius: 16, background: C.bgSoft,
                                border: `1px solid ${C.border}`, display: 'flex', gap: 16, alignItems: 'flex-start',
                            }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: 12,
                                    background: C.primaryMuted, display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                }}>
                                    <f.icon size={22} color={C.primary} />
                                </div>
                                <div>
                                    <h4 style={{ color: C.white, fontWeight: 700, marginBottom: 4, fontSize: '0.95rem' }}>{f.title}</h4>
                                    <p style={{ color: C.textDim, fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>{f.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                </section>

                {/* ═══════ 4. UNITS CAROUSEL ═══════ */}
                <section style={{
                    padding: '56px 0', background: C.bgSoft,
                    borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
                }}>
                    <div style={{ padding: '0 24px', marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                            <h3 className="font-serif" style={{ fontSize: '1.8rem', color: C.white }}>Unidades</h3>
                            <p style={{ color: C.textDim, fontSize: '0.85rem', marginTop: 4 }}>Plantas inteligentes e exclusivas</p>
                        </div>
                    </div>

                    <div className="hide-scrollbar units-scroll" style={{
                        display: 'flex', overflowX: 'auto', gap: 20, padding: '0 24px 16px',
                    }}>
                        {units.map((u, i) => (
                            <div key={i} style={{
                                minWidth: 280, background: C.bgDark, borderRadius: 16,
                                border: `1px solid ${C.border}`, overflow: 'hidden',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                                transition: 'transform 0.3s',
                            }}>
                                <div style={{ position: 'relative' }}>
                                    <img src={u.img} alt={u.title} style={{
                                        width: '100%', height: 200, objectFit: 'cover',
                                        transition: 'transform 0.7s',
                                    }}
                                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'} />
                                    <div style={{
                                        position: 'absolute', top: 12, right: 12,
                                        background: C.primary, color: C.bgDark, fontWeight: 800,
                                        fontSize: '0.75rem', padding: '4px 10px', borderRadius: 6,
                                    }}>{u.size}</div>
                                </div>
                                <div style={{ padding: 20 }}>
                                    <h5 style={{ color: C.white, fontWeight: 700, fontSize: '1.05rem', marginBottom: 6 }}>{u.title}</h5>
                                    <p style={{ color: C.textDim, fontSize: '0.85rem', lineHeight: 1.5, marginBottom: 16 }}>{u.desc}</p>
                                    <button onClick={openChat} style={{
                                        width: '100%', padding: '13px', border: `1px solid rgba(197,160,89,0.4)`,
                                        color: C.primary, fontWeight: 700, borderRadius: 10,
                                        background: 'transparent', cursor: 'pointer', fontSize: '0.85rem',
                                        transition: 'all 0.2s',
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.background = C.primaryMuted }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                                        Ver Planta
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ═══════ 5. GALLERY ═══════ */}
                <section style={{ padding: '72px 24px' }}>
                    <div className="bc-reveal" style={{ marginBottom: 32 }}>
                        <h3 className="font-serif" style={{ fontSize: '1.8rem', color: C.white, marginBottom: 4 }}>Galeria</h3>
                        <p style={{ color: C.textDim, fontSize: '0.85rem' }}>{gallery.length} imagens do empreendimento</p>
                    </div>

                    {/* Mobile Gallery */}
                    <div className="mobile-gallery"
                        onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
                        style={{ position: 'relative', overflow: 'hidden', borderRadius: 16, border: `1px solid ${C.border}` }}>
                        <div className="gallery-track" style={{ transform: `translateX(-${galleryIdx * 100}%)` }}>
                            {gallery.map((img, i) => (
                                <div key={i} onClick={() => openLightbox(i)} style={{ minWidth: '100%', cursor: 'pointer' }}>
                                    <img src={img} alt={`Imagem ${i + 1}`} style={{ width: '100%', aspectRatio: '16/10', objectFit: 'cover' }} />
                                </div>
                            ))}
                        </div>
                        <div style={{ textAlign: 'center', padding: '12px 0 8px', fontSize: '0.8rem', color: C.textDim }}>
                            {galleryIdx + 1} / {gallery.length} — Deslize para navegar
                        </div>
                    </div>

                    {/* Desktop Gallery */}
                    <div className="desktop-gallery" style={{
                        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
                    }}>
                        {gallery.slice(0, 9).map((img, i) => (
                            <div key={i} onClick={() => openLightbox(i)} style={{
                                cursor: 'pointer', overflow: 'hidden', borderRadius: 12,
                                border: `1px solid ${C.border}`,
                                gridColumn: i === 0 ? 'span 2' : undefined,
                                gridRow: i === 0 ? 'span 2' : undefined,
                            }}>
                                <img src={img} alt={`Imagem ${i + 1}`} style={{
                                    width: '100%', height: '100%', objectFit: 'cover',
                                    aspectRatio: i === 0 ? '1' : '16/10',
                                    transition: 'transform 0.5s',
                                }}
                                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'} />
                            </div>
                        ))}
                    </div>
                    {gallery.length > 9 && (
                        <button onClick={() => openLightbox(0)} style={{
                            marginTop: 16, width: '100%', padding: 14,
                            border: `1px solid ${C.border}`, borderRadius: 12,
                            background: 'transparent', color: C.textMuted, cursor: 'pointer',
                            fontSize: '0.85rem', transition: 'all 0.2s',
                        }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMuted }}>
                            Ver todas as {gallery.length} imagens
                        </button>
                    )}
                </section>

                {/* ═══════ LIGHTBOX ═══════ */}
                {lightboxOpen && (
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 200,
                        background: 'rgba(0,0,0,0.95)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }} onClick={closeLightbox}>
                        <button onClick={closeLightbox} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', zIndex: 210 }}>
                            <X size={28} color={C.white} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); prevLB() }} style={{
                            position: 'absolute', left: 12, background: 'rgba(255,255,255,0.1)',
                            border: 'none', borderRadius: '50%', padding: 10, cursor: 'pointer', zIndex: 210,
                        }}>
                            <ChevronLeft size={24} color={C.white} />
                        </button>
                        <img src={gallery[lightboxIdx]} alt="" onClick={e => e.stopPropagation()}
                            style={{ maxWidth: '92vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8 }} />
                        <button onClick={(e) => { e.stopPropagation(); nextLB() }} style={{
                            position: 'absolute', right: 12, background: 'rgba(255,255,255,0.1)',
                            border: 'none', borderRadius: '50%', padding: 10, cursor: 'pointer', zIndex: 210,
                        }}>
                            <ChevronRight size={24} color={C.white} />
                        </button>
                        <div style={{ position: 'absolute', bottom: 20, color: C.textDim, fontSize: '0.85rem' }}>
                            {lightboxIdx + 1} / {gallery.length}
                        </div>
                    </div>
                )}

                {/* ═══════ 6. LOCATION ═══════ */}
                <section style={{ padding: '72px 24px' }}>
                    <div className="bc-reveal" style={{ marginBottom: 24 }}>
                        <h3 className="font-serif" style={{ fontSize: '1.8rem', color: C.white, fontStyle: 'italic' }}>A Localização</h3>
                        <p style={{ color: C.textDim, fontSize: '0.9rem', marginTop: 6 }}>Entre o agito e a calma, no coração da Praia Brava.</p>
                    </div>

                    {/* Stylized dark map with pin overlay — AI Studio style */}
                    <div className="bc-reveal" style={{
                        position: 'relative', borderRadius: 16, overflow: 'hidden',
                        border: `1px solid ${C.border}`, height: 320,
                    }}>
                        {/* Dark overlay for map interaction */}
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(17,33,23,0.2)', zIndex: 10, pointerEvents: 'none' }} />
                        {/* Embedded map with dark filters */}
                        <iframe
                            title="Localização Brava Concetto"
                            src="https://maps.google.com/maps?q=-26.9485,-48.6187&z=14&output=embed&hl=pt-BR"
                            width="100%"
                            height="100%"
                            style={{ border: 0, filter: 'grayscale(1) brightness(0.35) contrast(1.3) invert(1) hue-rotate(180deg)', pointerEvents: 'none' }}
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                        />
                        {/* Green pin with ping animation */}
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 20 }}>
                            <div style={{ position: 'relative' }}>
                                <div style={{
                                    position: 'absolute', inset: -6, background: 'rgba(22,223,102,0.3)',
                                    borderRadius: '50%', animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
                                }} />
                                <div style={{
                                    position: 'relative', width: 48, height: 48, background: C.primary,
                                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: `4px solid ${C.bgDark}`, boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
                                }}>
                                    <MapPin size={22} color={C.bgDark} />
                                </div>
                            </div>
                        </div>
                        {/* Address card overlay */}
                        <div style={{
                            position: 'absolute', bottom: 14, left: 14, right: 14, zIndex: 20,
                            background: 'rgba(17,33,23,0.85)', backdropFilter: 'blur(12px)',
                            padding: '14px 16px', borderRadius: 12,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <div>
                                <p style={{ color: C.white, fontWeight: 700, fontSize: '0.85rem', margin: 0 }}>Av. Carlos Drummond de Andrade, 111</p>
                                <p style={{ color: C.textDim, fontSize: '0.75rem', margin: 0, marginTop: 2 }}>200m da orla da Praia Brava</p>
                            </div>
                            <a href="https://www.google.com/maps/search/Brava+Concetto+Praia+Brava+Itajai" target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0 }}>
                                <Navigation size={18} color={C.primary} />
                            </a>
                        </div>
                    </div>
                </section>

                {/* ═══════ 7. FAQ ═══════ */}
                <section style={{ padding: '56px 24px', borderTop: `1px solid ${C.border}` }}>
                    <h3 className="font-serif bc-reveal" style={{ fontSize: '1.8rem', color: C.white, marginBottom: 32 }}>
                        Dúvidas Frequentes
                    </h3>
                    {faqs.map((f, i) => (
                        <div key={i} className="bc-reveal" style={{
                            borderBottom: `1px solid ${C.border}`, cursor: 'pointer',
                            padding: '18px 0', transition: 'background 0.2s',
                        }} onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h4 style={{ color: C.white, fontWeight: 600, fontSize: '0.95rem', margin: 0, paddingRight: 16 }}>{f.q}</h4>
                                {faqOpen === i
                                    ? <Minus size={18} color={C.primary} style={{ flexShrink: 0 }} />
                                    : <Plus size={18} color={C.textDim} style={{ flexShrink: 0 }} />}
                            </div>
                            {faqOpen === i && (
                                <p style={{
                                    marginTop: 12, marginBottom: 0, fontSize: '0.88rem',
                                    color: C.textMuted, lineHeight: 1.65,
                                    animation: 'slideDown 0.3s ease',
                                }}>{f.a}</p>
                            )}
                        </div>
                    ))}
                </section>


            </main>

            {/* ═══════ FOOTER ═══════ */}
            <footer style={{
                padding: '56px 24px 120px', background: C.charcoal,
                borderTop: `1px solid ${C.border}`,
            }}>
                <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
                    <h4 className="font-serif" style={{ fontSize: '1.3rem', color: C.white, marginBottom: 20 }}>BRAVA CONCETTO</h4>
                    <p style={{
                        fontSize: '0.6rem', color: C.textFaint, lineHeight: 1.8,
                        textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 24,
                    }}>
                        Imagens meramente ilustrativas. O projeto pode sofrer alterações sem aviso prévio.
                        Registro de incorporação conforme Lei 4.591/64.
                    </p>
                    <div style={{ paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
                        <p style={{ fontSize: '0.7rem', color: C.textFaint }}>
                            © {new Date().getFullYear()} Brava Concetto. Todos os direitos reservados.
                        </p>
                    </div>
                </div>
            </footer>

            {/* ═══════ STICKY CTA (Bottom Bar) ═══════ */}
            <div style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
                padding: 16,
                background: `linear-gradient(to top, ${C.bgDark} 60%, transparent)`,
            }}>
                <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', gap: 12 }}>
                    <button onClick={openChat} style={{
                        flex: 1, background: C.primary, color: C.bgDark,
                        fontWeight: 900, padding: '16px 20px', borderRadius: 14,
                        border: 'none', cursor: 'pointer', fontSize: '0.85rem',
                        boxShadow: `0 10px 30px ${C.primaryGlow}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                        transition: 'transform 0.15s',
                        letterSpacing: '0.02em',
                    }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                        <MessageSquare size={20} style={{ fill: 'currentColor' }} />
                        FALAR COM ESPECIALISTA
                    </button>
                </div>
            </div>
        </div>
    )
}
