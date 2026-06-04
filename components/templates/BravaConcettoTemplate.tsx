'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
    X, ChevronLeft, ChevronRight, ChevronDown, MapPin, Building2,
    Leaf, Trees, AlertCircle, Check, MessageSquare, Phone, User,
    ArrowRight, Mail, Navigation, Minus, Plus, Star, Maximize, MoveRight
} from 'lucide-react'
import { TemplateProps } from './types'
import LandingPageLogic from '@/components/landing/LandingPageLogic'
import { openWhatsAppWithLeadCapture } from '@/lib/tracking/whatsapp-capture'

// ─── Design Tokens (Dark Green Luxury — inspired by AI Studio) ───────────
const C = {
    bgDark: '#FAFAFA',
    bgCard: '#FFFFFF',
    bgSoft: 'rgba(0,0,0,0.03)',
    bgInput: 'rgba(0,0,0,0.05)',
    primary: '#C5A059',
    primaryHover: '#b8934e',
    primaryGlow: 'rgba(197,160,89,0.35)',
    primaryMuted: 'rgba(197,160,89,0.12)',
    accentGold: '#C5A059',
    accentGoldMuted: 'rgba(197,160,89,0.1)',
    accentGoldBorder: 'rgba(197,160,89,0.2)',
    white: '#1A1A1A',
    textLight: '#334155',
    textMuted: '#475569',
    textDim: '#64748b',
    textFaint: '#94a3b8',
    border: 'rgba(0,0,0,0.08)',
    charcoal: '#F1F5F9',
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
    const [planLightboxIdx, setPlanLightboxIdx] = useState<number | null>(null)
    const [unitLightboxIdx, setUnitLightboxIdx] = useState<number | null>(null)
    const [faqOpen, setFaqOpen] = useState<number | null>(null)
    const [galleryIdx, setGalleryIdx] = useState(0)
    const [selectedPlan, setSelectedPlan] = useState(0)
    const [selectedSubPlan, setSelectedSubPlan] = useState(0)
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
                template: 'brava-concetto',
            })
        }
    }, [broker, slug])

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
        { icon: Building2, title: 'Design Assinado', desc: 'Arquitetura atemporal assinada por Débora Aguiar e Ana Holzer, com elevador privativo, esquadrias piso-teto e acabamento de altíssimo padrão.' },
        { icon: Leaf, title: 'Selo Internacional GBC', desc: 'Certificação de excelência do Green Building Council em sustentabilidade e eficiência energética.' },
        { icon: Trees, title: 'Integração com a Natureza', desc: 'Design biofílico que preserva e valoriza a essência da Praia Brava.' },
    ]

    const floorPlans = [
        {
            id: 'garden102',
            title: 'apto. garden 102',
            plans: [
                {
                    name: 'Planta Padrão',
                    area: '367,61 m²',
                    suites: '4 Suítes',
                    vagas: '3 Vagas',
                    image: "https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/Apt%20gardem%20102.webp"
                }
            ]
        },
        {
            id: 'apto-final-1',
            title: 'apto. final 1',
            plans: [
                {
                    name: 'Planta 1',
                    area: '307,64 m²',
                    suites: '4 Suítes',
                    vagas: '4 Vagas',
                    image: 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/apt%20final%201%20planta%2001.webp'
                },
                {
                    name: 'Planta 2',
                    area: '307,64 m²',
                    suites: '3 Suítes',
                    vagas: '4 Vagas',
                    image: 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/Apt%20gardem%20102.webp'
                }
            ]
        },
        {
            id: 'apto-final-2',
            title: 'apto. final 2',
            plans: [
                {
                    name: 'Planta 1',
                    area: '280,26 m²',
                    suites: '4 Suítes',
                    vagas: '3 Vagas',
                    image: 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/apt%20final%2002%20planta%2001.webp'
                },
                {
                    name: 'Planta 2',
                    area: '280,26 m²',
                    suites: '3 Suítes',
                    vagas: '3 Vagas',
                    image: 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/apt%20final%2002%20planta%2002.webp'
                }
            ]
        },
        {
            id: 'cobertura-1',
            title: 'cobert. duplex final 1',
            plans: [
                {
                    name: 'Planta Inferior',
                    area: '591,70 m²',
                    suites: '4 Suítes',
                    vagas: '5 Vagas',
                    image: 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/cobertura%20duplex%20final%2001%20planta%20inferior.webp'
                },
                {
                    name: 'Planta Superior',
                    area: '591,70 m²',
                    suites: '4 Suítes',
                    vagas: '5 Vagas',
                    image: 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/cobertura%20duplex%20final%2001%20planta%20superior.webp'
                }
            ]
        },
        {
            id: 'cobertura-2',
            title: 'cobert. duplex final 2',
            plans: [
                {
                    name: 'Planta Inferior',
                    area: '549,74 m²',
                    suites: '4 Suítes',
                    vagas: '5 Vagas',
                    image: 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/cobertura%20duplex%20final%2002%20%20planta%20inferior.webp'
                },
                {
                    name: 'Planta Superior',
                    area: '549,74 m²',
                    suites: '4 Suítes',
                    vagas: '5 Vagas',
                    image: 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/cobertura%20duplex%20final%2002%20%20planta%20superior.webp'
                }
            ]
        }
    ]


    const flatPlans = floorPlans.flatMap(g => g.plans.map(p => ({ ...p, groupTitle: g.title }))).filter(p => p.image);
    const nextPlanLB = () => setPlanLightboxIdx((p) => (p !== null ? (p + 1) % flatPlans.length : null));
    const prevPlanLB = () => setPlanLightboxIdx((p) => (p !== null ? (p - 1 + flatPlans.length) % flatPlans.length : null));

    const units = [
        { title: 'Apartamentos Garden', size: '367m²', area: '367,61m²', suites: '4 Suítes', vagas: '3 Vagas', desc: 'Ampla área privativa com jardim exclusivo e pé-direito duplo.', img: '/images/brava-concetto/19_CL_BC_LIVING_FINAL_01_EF_web.jpg' },
        { title: 'Apartamentos Tipo', size: '280m²', area: '280,26m²', suites: '4 Suítes', vagas: '3 Vagas', desc: 'Suítes amplas e living integrado com vista mar definitiva.', img: '/images/brava-concetto/22_CL_BC_LIVING_FINAL_02_EF_web.jpg' },
        { title: 'Coberturas Duplex', size: '591m²', area: '591,70m²', suites: '4 Suítes', vagas: '5 Vagas', desc: 'O ápice do luxo com piscina privativa e 360° de exclusividade.', img: '/images/brava-concetto/25_CL_BC_LIVING_TERRACO_COBERTURA_R01_web.jpg' },
    ]

    const nextUnitLB = () => setUnitLightboxIdx((p) => (p !== null ? (p + 1) % units.length : null));
    const prevUnitLB = () => setUnitLightboxIdx((p) => (p !== null ? (p - 1 + units.length) % units.length : null));

    const faqs = [
        { q: 'Qual a previsão de entrega?', a: 'Previsão para Março 2030. Consulte nossa equipe de vendas para obter o cronograma atualizado e as condições do empreendimento.' },
        { q: 'Quais as condições de pagamento?', a: 'Condição: 20% de entrada e saldo em 78x. Consulte um especialista e saiba mais sobre condições diferenciadas.' },
        { q: 'Quais as informações técnicas do projeto?', a: '• Unidades: 22 apartamentos, 1 garden e 2 coberturas duplex (Total 25 unidades)\n• Apartamentos por andar: 2\n• Pavimentos: 16\n• Tamanho do terreno: 1.600m²\n• Área da obra: 7.000m²\n• Altura: 52m' },
        { q: 'Onde fica exatamente?', a: 'Na Avenida Carlos Drummond de Andrade, 111, no coração da Praia Brava, a apenas 200m da orla.' },
        { q: 'É possível personalizar a planta?', a: 'Sim! Oferecemos a possibilidade de personalizar o layout interno.' },
        { q: 'O empreendimento possui certificação?', a: 'Sim, o Brava Concetto possui o Selo Internacional GBC (Green Building Council).' },
        { q: 'Quem assina a arquitetura do projeto?', a: 'O projeto arquitetônico é assinado por Antonio José Gonçalves e Frederico Cartens (realiza arquitetura), com interiores por Débora Aguiar e paisagismo por Ana Holzer.' },
    ]

    // Shared styles
    const inputStyle: React.CSSProperties = {
        width: '100%', background: C.bgCard, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: '14px 14px 14px 42px', color: C.white,
        fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' as const,
        transition: 'border-color 0.2s',
    }

    const btnPrimary: React.CSSProperties = {
        width: '100%', background: C.primary, color: '#1A1A1A', fontWeight: 800,
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
                @keyframes swipeHint { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(4px); } }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .gallery-card .gallery-overlay { opacity: 0; transition: opacity 0.3s ease; }
                .gallery-card:hover .gallery-overlay { opacity: 1; }
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
                @media (min-width: 1024px) {
                    .plan-container { flex-direction: row !important; align-items: center !important; }
                    .plan-image-area { flex: 1 1 65% !important; padding-right: 40px !important; }
                    .plan-info-card { flex: 0 0 400px !important; margin-left: -80px !important; z-index: 10 !important; }
                }
            `}} />

            <LandingPageLogic slug={slug} landingPageId={landingPageId} agentName={agentName} greetingMessage={greetingMessage} />

            {/* ═══════ HEADER ═══════ */}
            <header style={{
                position: 'sticky', top: 0, zIndex: 50,
                background: 'linear-gradient(to bottom, rgba(12,12,12,0.92) 0%, rgba(12,12,12,0.7) 50%, rgba(12,12,12,0) 100%)',
                paddingBottom: 20,
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '14px 20px', maxWidth: 640, margin: '0 auto',
                }}>
                    <img src="/images/brava-concetto/brava-concetto.svg" alt="Brava Concetto" style={{ height: 32, filter: 'brightness(0) invert(1)' }} />
                </div>
            </header>

            <main style={{ maxWidth: 640, margin: '0 auto', paddingBottom: 100 }}>

                {/* ═══════ 1. HERO + VIDEO BACKGROUND ═══════ */}
                <section style={{ position: 'relative', overflow: 'hidden', marginTop: -80 }}>
                    {/* Video Background */}
                    <div style={{
                        position: 'absolute', inset: 0, zIndex: 0,
                    }}>
                        <video
                            autoPlay
                            muted
                            loop
                            playsInline
                            poster="/images/brava-concetto/4.jpg"
                            style={{
                                width: '100%', height: '100%',
                                objectFit: 'cover', objectPosition: 'center bottom',
                            }}
                        >
                            <source src="https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/video%202.mp4" type="video/mp4" />
                        </video>
                    </div>

                    {/* Gradient Overlay — dark at the top for seamless header blend */}
                    <div style={{
                        position: 'absolute', inset: 0, zIndex: 1,
                        background: `linear-gradient(to bottom, rgba(12,12,12,0.9) 0%, rgba(12,12,12,0.5) 12%, rgba(12,12,12,0.15) 25%, transparent 40%)`,
                    }} />

                    {/* Watermark Concealer Shadow (Full Bottom Width) */}
                    <div style={{
                        position: 'absolute', bottom: -5, left: 0, right: 0, height: 120, zIndex: 1,
                        background: `linear-gradient(to bottom, transparent 0%, ${C.bgDark} 100%)`,
                    }} />

                    {/* Hero Content */}
                    <div style={{
                        position: 'relative', zIndex: 2, minHeight: 700, display: 'flex', flexDirection: 'column',
                        justifyContent: 'flex-start', padding: '160px 24px 32px',
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
                                color: '#FFFFFF', fontStyle: 'italic', marginBottom: 12,
                                textShadow: '0 2px 12px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.4)',
                            }}>
                                Onde o Mar Encontra o Design Extraordinário
                            </h2>

                            <p style={{
                                color: 'rgba(255,255,255,0.9)', fontSize: '1rem', lineHeight: 1.65,
                                textShadow: '0 2px 8px rgba(0,0,0,0.7), 0 1px 2px rgba(0,0,0,0.5)',
                            }}>
                                Experiência inigualável na Praia Brava. O equilíbrio perfeito entre o luxo silencioso e a natureza.
                            </p>
                        </div>
                    </div>
                </section>




                {/* ═══════ 3. UNITS CAROUSEL ═══════ */}
                <section style={{
                    padding: '56px 0', background: C.bgSoft,
                    borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
                }}>
                    <div style={{ padding: '0 24px', marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                            <h3 className="font-serif" style={{ fontSize: '1.8rem', color: C.white }}>Unidades</h3>
                            <p style={{ color: C.textLight, fontSize: '0.85rem', marginTop: 4 }}>Plantas inteligentes e exclusivas</p>
                        </div>
                    </div>

                    {/* ═══════ INFO STRIP (MOVED) ═══════ */}
                    <div style={{
                        background: C.accentGoldMuted, borderTop: `1px solid ${C.accentGoldBorder}`,
                        borderBottom: `1px solid ${C.accentGoldBorder}`, padding: '16px 24px',
                        marginBottom: 32,
                    }}>
                        <div style={{
                            maxWidth: 1200, margin: '0 auto', display: 'flex',
                            flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <AlertCircle size={18} color={C.accentGold} style={{ flexShrink: 0 }} />
                                <p style={{
                                    color: C.accentGold, fontWeight: 700, fontSize: '0.75rem',
                                    letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0,
                                }}>
                                    Apenas 25 Unidades Exclusivas — Alto Potencial de Valorização
                                </p>
                            </div>
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
                                    <div className="gallery-card" onClick={() => setUnitLightboxIdx(i)} style={{ cursor: 'pointer', position: 'relative' }}>
                                        <img src={u.img} alt={u.title} loading="lazy" style={{
                                            width: '100%', height: 200, objectFit: 'cover',
                                            transition: 'transform 0.7s',
                                        }}
                                            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'} />
                                        <div className="gallery-overlay" style={{
                                            position: 'absolute', inset: 0,
                                            background: 'rgba(0,0,0,0.4)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <div style={{ background: 'rgba(0,0,0,0.6)', padding: 12, borderRadius: '50%' }}>
                                                <Maximize size={24} color={C.white} />
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{
                                        position: 'absolute', top: 12, right: 12,
                                        background: C.primary, color: C.bgDark, fontWeight: 800,
                                        fontSize: '0.75rem', padding: '4px 10px', borderRadius: 6,
                                    }}>{u.size}</div>
                                </div>
                                <div style={{ padding: 20 }}>
                                    <h5 style={{ color: C.white, fontWeight: 700, fontSize: '1.05rem', marginBottom: 2 }}>{u.title}</h5>
                                    <p style={{ color: C.textMuted, fontSize: '0.7rem', display: 'flex', gap: 4, alignItems: 'center', marginTop: 4, marginBottom: 16 }}>
                                        <span>Projeto: Antonio J. Gonçalves e Frederico Cartens</span>
                                        <span style={{ fontStyle: 'italic' }}>(realiza arquitetura)</span>
                                    </p>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, paddingBottom: 6 }}>
                                            <span style={{ color: C.textDim, fontSize: '0.85rem' }}>Área Privativa</span>
                                            <span style={{ color: C.white, fontWeight: 600, fontSize: '0.9rem' }}>{u.area}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, paddingBottom: 6 }}>
                                            <span style={{ color: C.textDim, fontSize: '0.85rem' }}>Dormitórios</span>
                                            <span style={{ color: C.white, fontWeight: 600, fontSize: '0.9rem' }}>{u.suites}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, paddingBottom: 6 }}>
                                            <span style={{ color: C.textDim, fontSize: '0.85rem' }}>Garagem</span>
                                            <span style={{ color: C.white, fontWeight: 600, fontSize: '0.9rem' }}>{u.vagas}</span>
                                        </div>
                                    </div>

                                    <button onClick={openChat} style={{
                                        width: '100%', padding: '13px', border: 'none',
                                        color: '#FFFFFF', fontWeight: 700, borderRadius: 10,
                                        background: '#25D366', cursor: 'pointer', fontSize: '0.85rem',
                                        transition: 'all 0.2s',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        boxShadow: '0 4px 14px rgba(37,211,102,0.3)',
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)' }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                                        Falar com Especialista
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ═══════ 4. FLOOR PLANS (PLANTAS) ═══════ */}
                <section id="plantas" style={{ padding: '72px 24px' }}>
                    <div className="bc-reveal" style={{ marginBottom: 40 }}>
                        <h3 className="font-serif" style={{ fontSize: '1.8rem', color: C.white, marginBottom: 8 }}>Plantas</h3>
                        <div style={{ width: 48, height: 4, background: C.primary, borderRadius: 4, marginBottom: 12 }} />
                        <p style={{ color: C.textLight, fontSize: '0.85rem' }}>Conheça as opções de plantas do Brava Concetto.</p>
                    </div>

                    <div className="hide-scrollbar units-scroll" style={{
                        display: 'flex', overflowX: 'auto', gap: 20, padding: '0 0px 16px',
                    }}>
                        {floorPlans.flatMap(planGrp => planGrp.plans.map((subPlan, i) => (
                            <div key={`${planGrp.id}-${i}`} style={{
                                minWidth: 280, background: C.bgDark, borderRadius: 16,
                                border: `1px solid ${C.border}`, overflow: 'hidden',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                            }}>
                                <div style={{ position: 'relative' }}>
                                    {subPlan.image ? (
                                        <div className="gallery-card" onClick={() => {
                                            const fwIdx = flatPlans.findIndex(p => p.image === subPlan.image)
                                            if (fwIdx !== -1) setPlanLightboxIdx(fwIdx)
                                        }} style={{ cursor: 'pointer', position: 'relative' }}>
                                            <img src={subPlan.image} alt={`${planGrp.title} - ${subPlan.name}`} loading="lazy" style={{
                                                width: '100%', height: 200, objectFit: 'cover',
                                                transition: 'transform 0.7s',
                                            }}
                                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'} />
                                            <div className="gallery-overlay" style={{
                                                position: 'absolute', inset: 0,
                                                background: 'rgba(0,0,0,0.4)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <div style={{ background: 'rgba(0,0,0,0.6)', padding: 12, borderRadius: '50%' }}>
                                                    <Maximize size={24} color={C.white} />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bgSoft }}>
                                            <p style={{ color: C.textDim }}>[Imagem da Planta em Breve]</p>
                                        </div>
                                    )}
                                    <div style={{
                                        position: 'absolute', top: 12, right: 12,
                                        background: C.primary, color: C.bgDark, fontWeight: 800,
                                        fontSize: '0.75rem', padding: '4px 10px', borderRadius: 6,
                                    }}>{subPlan.area}</div>
                                </div>
                                <div style={{ padding: 20 }}>
                                    <h5 style={{ color: C.white, fontWeight: 700, fontSize: '1.05rem', marginBottom: 2, textTransform: 'capitalize' }}>
                                        {planGrp.title} {planGrp.plans.length > 1 ? `- ${subPlan.name}` : ''}
                                    </h5>
                                    <p style={{ color: C.textMuted, fontSize: '0.7rem', display: 'flex', gap: 4, alignItems: 'center', marginTop: 4, marginBottom: 16 }}>
                                        <span>Projeto: Antonio J. Gonçalves e Frederico Cartens</span>
                                        <span style={{ fontStyle: 'italic' }}>(realiza arquitetura)</span>
                                    </p>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, paddingBottom: 6 }}>
                                            <span style={{ color: C.textDim, fontSize: '0.85rem' }}>Área Privativa</span>
                                            <span style={{ color: C.white, fontWeight: 600, fontSize: '0.9rem' }}>{subPlan.area}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, paddingBottom: 6 }}>
                                            <span style={{ color: C.textDim, fontSize: '0.85rem' }}>Dormitórios</span>
                                            <span style={{ color: C.white, fontWeight: 600, fontSize: '0.9rem' }}>{subPlan.suites}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, paddingBottom: 6 }}>
                                            <span style={{ color: C.textDim, fontSize: '0.85rem' }}>Garagem</span>
                                            <span style={{ color: C.white, fontWeight: 600, fontSize: '0.9rem' }}>{subPlan.vagas}</span>
                                        </div>
                                    </div>

                                    <button onClick={openChat} style={{
                                        width: '100%', padding: '13px', border: 'none',
                                        color: '#FFFFFF', fontWeight: 700, borderRadius: 10,
                                        background: '#25D366', cursor: 'pointer', fontSize: '0.85rem',
                                        transition: 'all 0.2s',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        boxShadow: '0 4px 14px rgba(37,211,102,0.3)',
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)' }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                                        Falar com Especialista
                                    </button>
                                </div>
                            </div>
                        )))}
                    </div>
                </section>

                {/* ═══════ 5. GALLERY ═══════ */}
                <section style={{ padding: '72px 24px' }}>
                    <div className="bc-reveal" style={{ marginBottom: 32 }}>
                        <h3 className="font-serif" style={{ fontSize: '1.8rem', color: C.white, marginBottom: 4 }}>Galeria</h3>
                        <p style={{ color: C.textLight, fontSize: '0.85rem' }}>{gallery.length} imagens do empreendimento</p>
                    </div>

                    {/* Unified Horizontal Gallery */}
                    <div className="hide-scrollbar" style={{
                        display: 'flex', overflowX: 'auto', gap: 16, padding: '0 0px 16px',
                    }}>
                        {gallery.map((img, i) => (
                            <div key={i} className="gallery-card" onClick={() => openLightbox(i)} style={{
                                minWidth: 320, maxWidth: 400, flex: '0 0 auto',
                                borderRadius: 12, overflow: 'hidden',
                                border: `1px solid ${C.border}`,
                                cursor: 'pointer', position: 'relative'
                            }}>
                                <img src={img} alt={`Imagem ${i + 1}`} loading="lazy" style={{
                                    width: '100%', height: 280, objectFit: 'cover',
                                    transition: 'transform 0.5s',
                                }}
                                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'} />
                                <div className="gallery-overlay" style={{
                                    position: 'absolute', inset: 0,
                                    background: 'rgba(0,0,0,0.4)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <div style={{ background: 'rgba(0,0,0,0.6)', padding: 12, borderRadius: '50%' }}>
                                        <Maximize size={24} color={C.white} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                        gap: 8, color: C.textDim, fontSize: '0.85rem', marginTop: 12
                    }}>
                        Deslize para ver mais
                        <MoveRight size={16} style={{ animation: 'swipeHint 2s infinite ease-in-out' }} />
                    </div>
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

                {/* ═══════ PLAN LIGHTBOX ═══════ */}
                {planLightboxIdx !== null && flatPlans[planLightboxIdx] && (
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 200,
                        background: 'rgba(0,0,0,0.95)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }} onClick={() => setPlanLightboxIdx(null)}>
                        <button onClick={() => setPlanLightboxIdx(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', zIndex: 210 }}>
                            <X size={28} color={C.white} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); prevPlanLB() }} style={{
                            position: 'absolute', left: 12, background: 'rgba(255,255,255,0.1)',
                            border: 'none', borderRadius: '50%', padding: 10, cursor: 'pointer', zIndex: 210,
                        }}>
                            <ChevronLeft size={24} color={C.white} />
                        </button>
                        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                            <img src={flatPlans[planLightboxIdx].image} alt="Planta"
                                style={{ maxWidth: '92vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8 }} />
                            <div style={{ color: C.white, fontSize: '1.05rem', marginTop: 16, textTransform: 'capitalize', fontWeight: 600 }}>
                                {flatPlans[planLightboxIdx].groupTitle} - {flatPlans[planLightboxIdx].name}
                            </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); nextPlanLB() }} style={{
                            position: 'absolute', right: 12, background: 'rgba(255,255,255,0.1)',
                            border: 'none', borderRadius: '50%', padding: 10, cursor: 'pointer', zIndex: 210,
                        }}>
                            <ChevronRight size={24} color={C.white} />
                        </button>
                    </div>
                )}

                {/* ═══════ UNIT LIGHTBOX ═══════ */}
                {unitLightboxIdx !== null && units[unitLightboxIdx] && (
                    <div style={{
                        position: 'fixed', inset: 0, zIndex: 200,
                        background: 'rgba(0,0,0,0.95)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }} onClick={() => setUnitLightboxIdx(null)}>
                        <button onClick={() => setUnitLightboxIdx(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', zIndex: 210 }}>
                            <X size={28} color={C.white} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); prevUnitLB() }} style={{
                            position: 'absolute', left: 12, background: 'rgba(255,255,255,0.1)',
                            border: 'none', borderRadius: '50%', padding: 10, cursor: 'pointer', zIndex: 210,
                        }}>
                            <ChevronLeft size={24} color={C.white} />
                        </button>
                        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                            <img src={units[unitLightboxIdx].img} alt="Unidade"
                                style={{ maxWidth: '92vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8 }} />
                            <div style={{ color: C.white, fontSize: '1.05rem', marginTop: 16, textTransform: 'capitalize', fontWeight: 600 }}>
                                {units[unitLightboxIdx].title}
                            </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); nextUnitLB() }} style={{
                            position: 'absolute', right: 12, background: 'rgba(255,255,255,0.1)',
                            border: 'none', borderRadius: '50%', padding: 10, cursor: 'pointer', zIndex: 210,
                        }}>
                            <ChevronRight size={24} color={C.white} />
                        </button>
                    </div>
                )}

                {/* ═══════ 6. LOCATION ═══════ */}
                <section style={{ padding: '72px 24px' }}>
                    <div className="bc-reveal" style={{ marginBottom: 24 }}>
                        <h3 className="font-serif" style={{ fontSize: '1.8rem', color: C.white, fontStyle: 'italic' }}>A Localização</h3>
                        <p style={{ color: C.textLight, fontSize: '0.9rem', marginTop: 6 }}>Entre o agito e a calma, no coração da Praia Brava.</p>
                    </div>

                    {/* Map with custom pin overlay */}
                    <div className="bc-reveal" style={{
                        position: 'relative', borderRadius: 16, overflow: 'hidden',
                        border: `1px solid ${C.border}`, height: 320,
                    }}>
                        {/* Embedded map */}
                        <iframe
                            title="Localização Brava Concetto"
                            src="https://maps.google.com/maps?q=Av.+Carlos+Drummond+de+Andrade,+111,+Praia+Brava,+SC&z=15&output=embed&hl=pt-BR"
                            width="100%"
                            height="100%"
                            style={{ border: 0, pointerEvents: 'none' }}
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                        />
                        {/* Green pin with ping animation */}
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 20 }}>
                            <div style={{ position: 'relative' }}>
                                <div style={{
                                    position: 'absolute', inset: -6, background: C.primaryGlow,
                                    borderRadius: '50%', animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
                                }} />
                                <div style={{
                                    position: 'relative', width: 48, height: 48, background: C.primary,
                                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: `4px solid ${C.bgCard}`, boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
                                }}>
                                    <Building2 size={22} color={C.white} strokeWidth={2.5} />
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Address card below map */}
                    <div className="bc-reveal" style={{
                        marginTop: 16, background: C.bgCard,
                        padding: '16px 20px', borderRadius: 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        border: `1px solid ${C.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    }}>
                        <div>
                            <p style={{ color: C.white, fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>Av. Carlos Drummond de Andrade, 111</p>
                            <p style={{ color: C.textLight, fontSize: '0.8rem', margin: 0, marginTop: 4 }}>200m da orla da Praia Brava</p>
                        </div>
                        <a href="https://www.google.com/maps/search/Brava+Concetto+Praia+Brava+SC" target="_blank" rel="noopener noreferrer" style={{
                            flexShrink: 0, background: C.primaryMuted, padding: 12, borderRadius: '50%'
                        }}>
                            <Navigation size={20} color={C.primary} />
                        </a>
                    </div>
                </section>

                {/* ═══════ 7. DIFERENCIAIS (MOVED) ═══════ */}
                <section style={{ padding: '56px 24px', borderTop: `1px solid ${C.border}` }}>
                    <div className="bc-reveal" style={{ marginBottom: 32 }}>
                        <h3 className="font-serif" style={{ fontSize: '1.8rem', color: C.white }}>Diferenciais</h3>
                        <p style={{ color: C.textLight, fontSize: '0.85rem' }}>O que torna o Brava Concetto único</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                        {features.map((f, i) => (
                            <div key={i} data-feature="true" className="bc-reveal" style={{
                                background: C.bgCard, border: `1px solid ${C.border}`,
                                borderRadius: 16, padding: 24,
                                boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                            }}>
                                <div style={{
                                    width: 42, height: 42, borderRadius: 10,
                                    background: C.primaryMuted, display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    marginBottom: 16,
                                }}>
                                    <f.icon size={20} color={C.primary} />
                                </div>
                                <h4 style={{ color: C.white, fontWeight: 800, fontSize: '1rem', marginBottom: 8 }}>{f.title}</h4>
                                <p style={{ color: C.textMuted, fontSize: '0.85rem', lineHeight: 1.5 }}>{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ═══════ 8. FAQ ═══════ */}
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
                                    : <Plus size={18} color={C.textLight} style={{ flexShrink: 0 }} />}
                            </div>
                            {faqOpen === i && (
                                <p data-description="true" style={{
                                    marginTop: 12, marginBottom: 0, fontSize: '0.88rem',
                                    color: C.textMuted, lineHeight: 1.65,
                                    animation: 'slideDown 0.3s ease',
                                    whiteSpace: 'pre-line'
                                }}>{f.a}</p>
                            )}
                        </div>
                    ))}
                </section>


            </main>

            {/* ═══════ FOOTER ═══════ */}
            <footer style={{
                padding: '56px 24px 120px', background: '#0C0C0C', // Explicitly dark for logo contrast
            }}>
                <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <img src="/images/brava-concetto/brava-concetto.svg" alt="Brava Concetto" style={{ height: 40, filter: 'brightness(0) invert(1)', marginBottom: 24 }} />
                    <p style={{
                        fontSize: '0.6rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.8,
                        textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 24,
                    }}>
                        Imagens meramente ilustrativas. O projeto pode sofrer alterações sem aviso prévio.
                        Registro de incorporação conforme Lei 4.591/64.
                    </p>
                    <div style={{ paddingTop: 20, borderTop: `1px solid rgba(255,255,255,0.1)`, width: '100%' }}>
                        <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
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
                        flex: 1, background: '#25D366', color: '#FFFFFF',
                        fontWeight: 900, padding: '16px 20px', borderRadius: 14,
                        border: 'none', cursor: 'pointer', fontSize: '0.85rem',
                        boxShadow: '0 10px 30px rgba(37,211,102,0.35)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                        transition: 'transform 0.15s',
                        letterSpacing: '0.02em',
                    }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                        FALAR COM ESPECIALISTA
                    </button>
                </div>
            </div>
        </div>
    )
}
