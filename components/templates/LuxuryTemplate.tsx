'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
    Menu, X, ArrowRight, ChevronDown,
    Shield, Waves, Crown, MapPin, Maximize, Sparkles,
    Award, CheckCircle, Instagram, Linkedin, Facebook, MessageCircle
} from 'lucide-react'
import { TemplateProps } from './types'
import LandingPageLogic from '@/components/landing/LandingPageLogic'

export default function LuxuryTemplate({ data, slug, landingPageId, agentName, greetingMessage }: TemplateProps) {
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

    // State for Navbar scroll effect
    const [isScrolled, setIsScrolled] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    // Scroll Animation Logic
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50)
        }
        window.addEventListener('scroll', handleScroll)

        // Intersection Observer for fade-in animations
        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1,
        }

        const handleIntersect = (entries: IntersectionObserverEntry[]) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-fade-in')
                    entry.target.classList.remove('opacity-0')
                }
            })
        }

        const observer = new IntersectionObserver(handleIntersect, observerOptions)
        const sections = document.querySelectorAll('section')
        sections.forEach((section) => {
            section.classList.add('opacity-0', 'transition-opacity', 'duration-1000')
            observer.observe(section)
        })

        return () => {
            window.removeEventListener('scroll', handleScroll)
            observer.disconnect()
        }
    }, [])

    // Open chat programmatically
    const openChat = useCallback(() => {
        window.dispatchEvent(new CustomEvent('open-concierge-chat'))
    }, [])

    // Helper to map icons to amenities (simple round-robin or random for now, since we don't have icon keys in data)
    const getIconForAmenity = (index: number) => {
        const icons = [Waves, Crown, Shield, MapPin, Maximize, Sparkles]
        const IconComponent = icons[index % icons.length]
        return <IconComponent className="w-8 h-8 text-yellow-500/80" />
    }

    return (
        <div className="relative overflow-x-hidden selection:bg-yellow-500/30 selection:text-white font-sans bg-black text-white">
            <LandingPageLogic slug={slug} landingPageId={landingPageId} agentName={agentName} greetingMessage={greetingMessage} />

            {/* === NAVBAR === */}
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 px-6 py-4 ${isScrolled ? 'bg-black/95 backdrop-blur-md border-b border-white/10' : 'bg-transparent'}`}>
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex flex-col">
                        <span className="text-2xl font-serif tracking-[0.2em] font-bold text-white">L'HÉRITAGE</span>
                        <span className="text-[10px] tracking-[0.4em] text-white/50 uppercase">The Pinnacle of Living</span>
                    </div>

                    <div className="hidden md:flex space-x-8 text-xs tracking-widest uppercase font-medium text-white">
                        <a href="#experiencia" className="hover:text-yellow-500 transition-colors">Experiência</a>
                        <a href="#galeria" className="hover:text-yellow-500 transition-colors">Galeria</a>
                        <a href="#diferenciais" className="hover:text-yellow-500 transition-colors">Diferenciais</a>
                    </div>

                    <button
                        onClick={openChat}
                        className="hidden md:block bg-white text-black px-6 py-2.5 text-xs font-bold tracking-widest uppercase hover:bg-yellow-500 transition-all duration-300 transform active:scale-95 border-none cursor-pointer"
                    >
                        {cta || 'Falar com Consultor'}
                    </button>

                    <button className="md:hidden text-white bg-transparent border-none" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                        <Menu size={24} />
                    </button>
                </div>
            </nav>

            {/* === HERO === */}
            <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <img
                        src={heroImage}
                        alt={title}
                        className="w-full h-full object-cover scale-105 animate-[pulse_8s_infinite] opacity-60"
                        style={{ animationDuration: '20s' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/20" />
                </div>

                <div className="relative z-10 text-center max-w-4xl px-6">
                    <div className="overflow-hidden mb-6">
                        <p className="text-xs md:text-sm tracking-[0.5em] uppercase text-yellow-500/80 animate-fade-in-down">
                            Exclusividade sem Precedentes
                        </p>
                    </div>

                    <h1 className="text-5xl md:text-8xl font-serif mb-8 leading-tight tracking-tight text-white shadow-lg">
                        {title}
                    </h1>

                    <p className="text-lg md:text-xl text-white/70 mb-12 max-w-2xl mx-auto font-light leading-relaxed">
                        {price} • {stats.location}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <button
                            onClick={openChat}
                            className="group relative px-8 py-4 bg-white text-black font-bold tracking-widest uppercase text-sm w-full sm:w-auto transition-all duration-300 hover:bg-yellow-500 border-none cursor-pointer flex items-center justify-center"
                        >
                            Solicitar Apresentação
                            <ArrowRight className="inline-block ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                        <a
                            href="#experiencia"
                            className="px-8 py-4 border border-white/20 hover:border-white text-white font-bold tracking-widest uppercase text-sm w-full sm:w-auto transition-all backdrop-blur-sm decoration-transparent flex items-center justify-center"
                        >
                            Explorar Legado
                        </a>
                    </div>
                </div>

                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce opacity-40 text-white">
                    <ChevronDown size={32} />
                </div>
            </section>

            {/* === CONTENT === */}
            <div className="bg-black text-white">

                {/* === POSITIONING === */}
                <section id="posicionamento" className="py-24 md:py-40 px-6 relative">
                    <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
                        <div className="space-y-8">
                            <span className="text-xs tracking-[0.3em] uppercase text-yellow-500/80">A Essência do Sucesso</span>
                            <h2 className="text-4xl md:text-6xl font-serif leading-tight">
                                Prepare-se para viver o <br />
                                <span className="italic text-white/60 font-light">extraordinário.</span>
                            </h2>
                            <p className="text-lg text-white/60 leading-relaxed font-light">
                                {description}
                            </p>
                            <div className="pt-6">
                                <div className="flex items-center space-x-4 border-l-2 border-yellow-500/50 pl-6 py-2">
                                    <span className="text-4xl font-serif">{stats.area}</span>
                                    <span className="text-xs uppercase tracking-widest text-white/50">m² de <br /> Área Privativa</span>
                                </div>
                            </div>
                        </div>

                        <div className="relative group overflow-hidden">
                            {gallery[1] && (
                                <img
                                    src={gallery[1]}
                                    alt="Luxury Lifestyle"
                                    className="w-full grayscale hover:grayscale-0 transition-all duration-1000 transform group-hover:scale-110"
                                />
                            )}
                            <div className="absolute inset-0 border border-white/10 m-4 pointer-events-none" />
                        </div>
                    </div>
                </section>

                <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                {/* === FEATURES === */}
                <section id="diferenciais" className="py-32 px-6">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid md:grid-cols-2 gap-16 mb-24 items-end">
                            <div>
                                <span className="text-xs tracking-[0.3em] uppercase text-yellow-500/80 block mb-4">Engenharia de Luxo</span>
                                <h2 className="text-5xl md:text-7xl font-serif">Onde a Perfeição se torna Padrão.</h2>
                            </div>
                            <p className="text-white/50 text-lg font-light leading-relaxed max-w-md">
                                {stats.bedrooms} Suítes • {stats.bathrooms} Banheiros • Acabamento Premium
                            </p>
                        </div>

                        <div className="grid md:grid-cols-3 gap-y-16 gap-x-12">
                            {amenities.map((feature, i) => (
                                <div key={i} className="group p-8 border border-white/5 hover:border-yellow-500/30 transition-all duration-500 glass">
                                    <div className="mb-6 transform group-hover:-translate-y-2 transition-transform duration-300">
                                        {getIconForAmenity(i)}
                                    </div>
                                    <h3 className="text-xl font-serif mb-4 group-hover:text-yellow-500 transition-colors">{feature}</h3>
                                    <p className="text-sm text-white/50 leading-relaxed font-light">
                                        Exclusividade garantida para seu conforto e bem-estar.
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* === GALLERY === */}
                <section id="galeria" className="py-24 bg-[#0a0a0a]">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="text-center mb-20">
                            <h2 className="text-4xl md:text-6xl font-serif mb-6">Perspectiva Estética</h2>
                            <div className="w-24 h-px bg-yellow-500 mx-auto opacity-50" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {gallery.slice(0, 6).map((img, i) => (
                                <div
                                    key={i}
                                    className="relative aspect-square overflow-hidden group cursor-pointer"
                                    onClick={() => {
                                        // Optional: Open modal logic here
                                    }}
                                >
                                    <img
                                        src={img}
                                        alt={`Galeria ${i}`}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center p-8">
                                        <div className="text-center transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                                            <p className="text-xs tracking-widest uppercase mb-2 text-yellow-500">Visualizar</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* === EXPERIENCE === */}
                <section id="experiencia" className="relative py-40 overflow-hidden">
                    <div className="absolute inset-0 z-0">
                        {gallery[2] && (
                            <img
                                src={gallery[2]}
                                alt="Atmosphere"
                                className="w-full h-full object-cover opacity-30"
                            />
                        )}
                        <div className="absolute inset-0 bg-black/80" />
                    </div>

                    <div className="relative z-10 max-w-4xl mx-auto text-center px-6">
                        <h2 className="text-4xl md:text-7xl font-serif mb-12 leading-tight text-white">
                            Sinta a Liberdade do <br />
                            <span className="italic text-yellow-500/90">Silêncio Absoluto.</span>
                        </h2>
                        <p className="text-xl md:text-2xl text-white/70 font-light leading-relaxed mb-16 italic">
                            "Viver aqui é uma experiência transcendente. Cada detalhe foi pensado para elevar sua qualidade de vida a um novo patamar."
                        </p>
                        <div className="w-16 h-px bg-white/30 mx-auto mb-16" />
                        <button
                            onClick={openChat}
                            className="inline-block px-12 py-5 bg-transparent border-2 border-white/50 text-white font-bold tracking-[0.3em] uppercase text-xs hover:bg-white hover:text-black transition-all duration-500 cursor-pointer"
                        >
                            Solicitar Experiência Presencial
                        </button>
                    </div>
                </section>

                {/* === CONSULTANT === */}
                <section className="py-24 px-6 bg-white text-black">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-16 items-center">
                        <div className="w-full md:w-1/3">
                            <div className="relative aspect-[4/5] overflow-hidden rounded-sm grayscale shadow-2xl">
                                <img
                                    src="https://picsum.photos/seed/consultant/600/800"
                                    alt={agentName || "Consultor"}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        </div>

                        <div className="flex-1 space-y-8">
                            <div className="inline-flex items-center space-x-2 bg-black text-white px-4 py-1.5 text-[10px] tracking-[0.2em] uppercase font-bold">
                                <Award size={14} className="text-yellow-500" />
                                <span>Consultoria de Alto Patrimônio</span>
                            </div>

                            <h2 className="text-4xl md:text-5xl font-serif leading-tight">
                                Atendimento Exclusivo com <br /> {agentName || 'Especialista Pilger'}.
                            </h2>

                            <p className="text-lg text-black/70 font-light leading-relaxed">
                                {greetingMessage || "Estou à disposição para apresentar todos os detalhes desta obra-prima."}
                            </p>

                            <div className="grid grid-cols-2 gap-8 pt-4">
                                <div className="flex items-start space-x-3">
                                    <CheckCircle className="text-black shrink-0" size={20} />
                                    <div>
                                        <h4 className="font-bold text-xs uppercase tracking-widest mb-1">Aprovação Imediata</h4>
                                        <p className="text-xs text-black/60">Processos simplificados.</p>
                                    </div>
                                </div>
                                <div className="flex items-start space-x-3">
                                    <CheckCircle className="text-black shrink-0" size={20} />
                                    <div>
                                        <h4 className="font-bold text-xs uppercase tracking-widest mb-1">Privacidade Total</h4>
                                        <p className="text-xs text-black/60">Sigilo absoluto.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {/* === FOOTER === */}
            <footer className="bg-black py-24 px-6 border-t border-white/5 text-white">
                <div className="max-w-7xl mx-auto text-center">
                    <div className="mb-20">
                        <h2 className="text-5xl md:text-7xl font-serif mb-10 leading-tight">
                            Este é o seu momento. <br />
                            <span className="italic text-yellow-500">Garanta seu Legado.</span>
                        </h2>
                        <button
                            onClick={openChat}
                            className="inline-flex items-center space-x-4 bg-yellow-500 text-black px-12 py-5 font-bold tracking-[0.2em] uppercase text-sm hover:bg-white transition-all transform hover:scale-105 active:scale-95 shadow-2xl border-none cursor-pointer"
                        >
                            <MessageCircle size={20} />
                            <span>Falar com Consultor Agora</span>
                        </button>
                    </div>

                    <div className="mt-20 pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-[10px] tracking-[0.5em] text-white/20 uppercase">
                        <span>&copy; {new Date().getFullYear()} Pilger Imóveis.</span>
                        <span className="mt-4 md:mt-0">Todos os direitos reservados.</span>
                    </div>
                </div>
            </footer>

            {/* Floating Contact Widget */}
            <button
                onClick={openChat}
                className="fixed bottom-8 right-8 z-[100] bg-[#25D366] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center justify-center animate-bounce border-none cursor-pointer"
            >
                <MessageCircle size={24} />
            </button>
        </div>
    )
}
