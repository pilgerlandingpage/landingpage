'use client'

import React, { useEffect, useState } from 'react'
import { TemplateProps } from './types'
import { Send, CheckCircle, Star, Quote } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// "Seduction" Template
// Focus: Visuality, Desire, Lifestyle, "How to Win Friends" (Make them feel important)
export default function SeductionTemplate({ data, slug, landingPageId, agentName = 'Corretor', greetingMessage }: TemplateProps) {
    const supabase = createClient()
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50)
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        // Simple integration placeholder - real chat widget handles this usually
        alert('Obrigado pelo interesse! Entraremos em contato em breve.')
    }

    return (
        <div className="font-sans text-zinc-900 bg-white overflow-x-hidden">
            {/* --- Hero Section (Immersive) --- */}
            <header className="relative h-screen min-h-[600px] w-full flex items-center justify-center overflow-hidden">
                {/* Background Image with Slow Zoom Effect */}
                <div className="absolute inset-0 z-0">
                    <img
                        src={data.heroImage}
                        alt={data.title}
                        className="w-full h-full object-cover animate-slow-zoom"
                        style={{ filter: 'brightness(0.85)' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                </div>

                {/* Hero Content */}
                <div className="relative z-10 text-center px-4 max-w-4xl mx-auto text-white animate-fade-in-up">
                    <div className="inline-block px-3 py-1 mb-4 border border-white/30 rounded-full backdrop-blur-md bg-white/10 text-xs font-medium tracking-widest uppercase">
                        Exclusivo
                    </div>
                    <h1 className="font-playfair text-5xl md:text-7xl font-bold mb-6 leading-tight drop-shadow-lg">
                        {data.title}
                    </h1>
                    <p className="text-lg md:text-xl font-light text-white/90 mb-10 max-w-2xl mx-auto leading-relaxed">
                        {data.description.substring(0, 150)}...
                    </p>
                    <button className="bg-white text-black hover:bg-[var(--gold)] hover:text-white transition-all duration-300 px-8 py-4 rounded-full font-medium tracking-wide shadow-xl hover:shadow-2xl hover:-translate-y-1">
                        {data.cta}
                    </button>
                </div>

                {/* Scroll Indicator */}
                <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 animate-bounce text-white/70">
                    <span className="text-xs tracking-widest uppercase mb-2 block text-center">Descubra</span>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
                    </svg>
                </div>
            </header>

            {/* --- "The Dream" Section (Visual Storytelling) --- */}
            <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                    <div className="order-2 md:order-1 space-y-8">
                        <div className="w-16 h-1 bg-[var(--gold)]" />
                        <h2 className="font-playfair text-4xl md:text-5xl font-bold leading-tight">
                            Você merece viver o <span className="text-[var(--gold)]">extraordinário</span>.
                        </h2>
                        <p className="text-lg text-zinc-600 leading-relaxed">
                            {data.description}
                        </p>
                        <div className="grid grid-cols-2 gap-6 pt-4">
                            {data.amenities.slice(0, 4).map((item, idx) => (
                                <div key={idx} className="flex items-center gap-3">
                                    <CheckCircle size={20} className="text-[var(--gold)] min-w-[20px]" />
                                    <span className="text-zinc-700 font-medium">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="order-1 md:order-2 relative group cursor-pointer">
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors z-10" />
                        <img
                            src={data.gallery[0] || data.heroImage}
                            alt="Interior"
                            className="w-full h-[600px] object-cover rounded-sm shadow-2xl transform group-hover:scale-[1.02] transition-transform duration-700"
                        />
                        {/* Status Badge */}
                        <div className="absolute top-6 right-6 z-20 bg-white/90 backdrop-blur text-xs font-bold px-4 py-2 rounded uppercase tracking-wider shadow-lg">
                            {data.stats.location}
                        </div>
                    </div>
                </div>
            </section>

            {/* --- Gallery Grid (Mosaic) --- */}
            <section className="bg-zinc-50 py-24">
                <div className="max-w-[1920px] mx-auto px-4">
                    <div className="text-center mb-16">
                        <span className="text-[var(--gold)] font-medium tracking-widest uppercase text-sm">Galeria</span>
                        <h3 className="font-playfair text-3xl md:text-4xl font-bold mt-2">Cada detalhe importa</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[300px]">
                        {data.gallery.slice(0, 5).map((img, idx) => (
                            <div
                                key={idx}
                                className={`relative group overflow-hidden ${idx === 0 ? 'md:col-span-2 md:row-span-2' : 'md:col-span-1'}`}
                            >
                                <img
                                    src={img}
                                    alt={`Gallery ${idx}`}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="text-white border border-white px-6 py-2 uppercase tracking-widest text-sm hover:bg-white hover:text-black transition-colors cursor-pointer">
                                        Expandir
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- Call to Action (Lifestyle) --- */}
            <section className="py-24 px-6 relative bg-black text-white text-center">
                <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                <div className="relative z-10 max-w-3xl mx-auto">
                    <Quote className="mx-auto text-[var(--gold)] mb-8 opacity-50" size={48} />
                    <h2 className="font-playfair text-4xl md:text-5xl font-bold mb-8">
                        "O imóvel perfeito não é apenas um lugar,<br />é um sentimento."
                    </h2>
                    <p className="text-xl text-zinc-400 mb-12 font-light">
                        Agende uma visita privada e sinta a experiência pessoalmente.
                    </p>

                    <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
                        <button className="bg-[var(--gold)] text-white hover:bg-white hover:text-black transition-all px-8 py-4 rounded-full font-medium text-lg min-w-[200px]">
                            {data.cta}
                        </button>
                        <span className="text-sm text-zinc-500 uppercase tracking-widest">ou</span>
                        <button className="border border-white/30 hover:border-white text-white px-8 py-4 rounded-full font-medium text-lg min-w-[200px] transition-colors">
                            Falar no WhatsApp
                        </button>
                    </div>
                </div>
            </section>

            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');
                
                .font-playfair {
                    font-family: 'Playfair Display', serif;
                }
                
                @keyframes slow-zoom {
                    0% { transform: scale(1); }
                    100% { transform: scale(1.1); }
                }
                .animate-slow-zoom {
                    animation: slow-zoom 20s infinite alternate linear;
                }
                
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up {
                    animation: fade-in-up 1s ease-out forwards;
                }
            `}</style>
        </div>
    )
}
