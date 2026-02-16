'use client'

import React from 'react'
import { TemplateProps } from './types'
import { Shield, Award, Users, Check, Star } from 'lucide-react'

// "Authority" Template
// Focus: Trust, Expertise, Status, "48 Laws of Power" (Reputation is everything)
export default function AuthorityTemplate({ data, slug, landingPageId, agentName = 'Corretor', greetingMessage }: TemplateProps) {

    return (
        <div className="font-sans text-slate-900 bg-white">

            {/* --- Top Bar (Credibility) --- */}
            <div className="bg-slate-900 text-white/80 text-xs py-2 px-4 flex justify-between items-center">
                <div className="flex gap-4">
                    <span className="flex items-center gap-1"><Shield size={12} /> Imóvel Verificado</span>
                    <span className="flex items-center gap-1"><Award size={12} /> Exclusividade Pilger</span>
                </div>
                <div className="uppercase tracking-widest font-semibold">Ref: {slug.toUpperCase().substring(0, 6)}</div>
            </div>

            {/* --- Hero Section (Split) --- */}
            <header className="grid grid-cols-1 lg:grid-cols-2 min-h-[85vh]">
                {/* Text Side */}
                <div className="flex flex-col justify-center p-12 lg:p-24 bg-white">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="h-[1px] w-12 bg-slate-400"></div>
                        <span className="uppercase tracking-[0.2em] text-sm text-slate-500 font-semibold">Oportunidade Única</span>
                    </div>

                    <h1 className="text-5xl lg:text-6xl font-bold text-slate-900 mb-6 leading-[1.1] tracking-tight">
                        {data.title}
                    </h1>

                    <div className="flex gap-4 mb-8 text-slate-600 font-medium">
                        <span>{data.stats.location}</span>
                        <span>•</span>
                        <span>{data.stats.area}m² Privativos</span>
                    </div>

                    <p className="text-lg text-slate-600 mb-10 leading-relaxed max-w-lg">
                        {data.description.substring(0, 200)}...
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <button className="bg-slate-900 text-white px-8 py-4 font-semibold hover:bg-slate-800 transition-colors shadow-lg">
                            {data.cta}
                        </button>
                        <button className="border-2 border-slate-200 text-slate-700 px-8 py-4 font-semibold hover:border-slate-900 hover:text-slate-900 transition-all">
                            Baixar Apresentação PDF
                        </button>
                    </div>

                    <div className="mt-12 flex items-center gap-4 text-sm text-slate-500">
                        <div className="flex -space-x-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold">
                                    {String.fromCharCode(64 + i)}
                                </div>
                            ))}
                        </div>
                        <p>+12 interessados nesta semana.</p>
                    </div>
                </div>

                {/* Image Side */}
                <div className="relative h-64 lg:h-auto bg-slate-100">
                    <img
                        src={data.heroImage}
                        alt="Property Hero"
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 bg-white p-6 shadow-none lg:shadow-none border-t border-r border-slate-100 max-w-xs">
                        <p className="text-3xl font-bold text-slate-900">{data.price}</p>
                        <p className="text-sm text-slate-500 mt-1 uppercase tracking-wide">Valor de Investimento</p>
                    </div>
                </div>
            </header>

            {/* --- Authority / Realtor Section --- */}
            <section className="bg-slate-50 py-20 px-6 border-y border-slate-200">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-12">
                    <div className="relative w-48 h-48 md:w-64 md:h-64 flex-shrink-0">
                        <div className="absolute inset-0 bg-slate-200 rotate-6 rounded-lg"></div>
                        <img
                            src="https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/Untitled%20design(9).png" // Using the same img from home page for now
                            alt="Guilherme Pilger"
                            className="absolute inset-0 w-full h-full object-cover rounded-lg shadow-md bg-white border-4 border-white"
                        />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h3 className="text-2xl font-bold text-slate-900 mb-2">Com a palavra, Guilherme Pilger:</h3>
                        <p className="text-slate-600 text-lg italic mb-6">
                            "Este imóvel representa o que há de mais sólido no mercado atual. A localização estratégica combinada com o padrão construtivo faz desta uma escolha segura não apenas para moradia, mas para compor patrimônio."
                        </p>
                        <div className="flex flex-wrap gap-6 justify-center md:justify-start">
                            <div className="text-center">
                                <span className="block text-2xl font-bold text-slate-900">15+</span>
                                <span className="text-xs text-slate-500 uppercase">Anos de Mercado</span>
                            </div>
                            <div className="w-px bg-slate-300 h-10"></div>
                            <div className="text-center">
                                <span className="block text-2xl font-bold text-slate-900">Top 1%</span>
                                <span className="text-xs text-slate-500 uppercase">Broker Brasil</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- Technical Details (Factual) --- */}
            <section className="py-24 px-6 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    <div className="md:col-span-1">
                        <h3 className="text-3xl font-bold mb-6">Ficha Técnica</h3>
                        <p className="text-slate-600 mb-8">Todos os detalhes foram rigorosamente conferidos para garantir a total transparência da negociação.</p>

                        <div className="space-y-4">
                            <div className="flex justify-between py-3 border-b border-slate-100">
                                <span className="text-slate-500">Área Privativa</span>
                                <span className="font-semibold">{data.stats.area}m²</span>
                            </div>
                            <div className="flex justify-between py-3 border-b border-slate-100">
                                <span className="text-slate-500">Dormitórios</span>
                                <span className="font-semibold">{data.stats.bedrooms} Suítes</span>
                            </div>
                            <div className="flex justify-between py-3 border-b border-slate-100">
                                <span className="text-slate-500">Vagas</span>
                                <span className="font-semibold">4</span>
                            </div>
                            <div className="flex justify-between py-3 border-b border-slate-100">
                                <span className="text-slate-500">Condomínio</span>
                                <span className="font-semibold">R$ 1.200/mês</span>
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {data.gallery.slice(1, 5).map((img, idx) => (
                            <img
                                key={idx}
                                src={img}
                                alt={`Detail ${idx}`}
                                className="w-full h-64 object-cover grayscale hover:grayscale-0 transition-all duration-500"
                            />
                        ))}
                    </div>
                </div>
            </section>

            {/* --- Why Choose Us (Social Proof) --- */}
            <section className="bg-slate-900 text-white py-24 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl font-bold mb-12">Por que investir com a Pilger?</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="p-6 border border-slate-700 bg-slate-800/50">
                            <Users className="mx-auto mb-4 text-slate-400" size={32} />
                            <h4 className="font-bold mb-2">Network Exclusivo</h4>
                            <p className="text-sm text-slate-400">Acesso a oportunidades off-market e compradores qualificados.</p>
                        </div>
                        <div className="p-6 border border-slate-700 bg-slate-800/50">
                            <Shield className="mx-auto mb-4 text-slate-400" size={32} />
                            <h4 className="font-bold mb-2">Segurança Jurídica</h4>
                            <p className="text-sm text-slate-400">Assessoria completa em toda a documentação e trâmites legais.</p>
                        </div>
                        <div className="p-6 border border-slate-700 bg-slate-800/50">
                            <Star className="mx-auto mb-4 text-slate-400" size={32} />
                            <h4 className="font-bold mb-2">Curadoria Premium</h4>
                            <p className="text-sm text-slate-400">Selecionamos apenas imóveis com real potencial de valorização.</p>
                        </div>
                    </div>
                </div>
            </section>

        </div>
    )
}
