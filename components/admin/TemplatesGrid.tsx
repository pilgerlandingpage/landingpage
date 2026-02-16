'use client'

import React from 'react'
import Link from 'next/link'
import { Monitor, Star, MousePointerClick, CheckCircle, ArrowRight, Flame, Award, Crown } from 'lucide-react'

export default function TemplatesGrid() {
    const templates = [
        {
            id: 'urgency',
            name: '🔥 Urgência',
            description: 'Gatilho de escassez e urgência. Countdown timer, "últimas unidades", CTA agressivo. Tudo em 1 tela no celular.',
            features: ['Countdown Timer', 'Badge Escassez', 'CTA Fixo no Rodapé', '100% Mobile-First'],
            icon: <Flame size={48} className="text-gold" />,
            color: '#ef4444',
            recommended: true
        },
        {
            id: 'social-proof',
            name: '⭐ Prova Social',
            description: 'Depoimentos, estrelas e "127 pessoas viram". Cria confiança instantânea. 2 scrolls no celular.',
            features: ['Depoimentos com Estrelas', 'Contador de Visualizações', 'CTA Fixo no Rodapé', 'Seção Final Escura'],
            icon: <Award size={48} className="text-gold" />,
            color: '#f59e0b',
            recommended: true
        },
        {
            id: 'vip',
            name: '👑 VIP Exclusivo',
            description: 'Fundo preto + dourado. "Você foi convidado". Barra de vagas. Puro desejo e exclusividade. 1 tela.',
            features: ['Design Preto + Dourado', 'Barra de Vagas', '"Acesso Exclusivo"', '100% Mobile-First'],
            icon: <Crown size={48} className="text-gold" />,
            color: '#c9a96e',
            recommended: true
        },
        {
            id: 'classic',
            name: 'Clássico',
            description: 'Layout equilibrado com detalhes técnicos, galeria e sidebar de contato.',
            features: ['Hero com Imagem', 'Sidebar de Contato', 'Lista de Diferenciais', 'Galeria em Grid'],
            icon: <Monitor size={48} className="text-gold" />,
            color: 'var(--gold)'
        },
        {
            id: 'modern',
            name: 'Modern Luxury',
            description: 'Design expansivo com foco em imagens de alta resolução e tipografia elegante.',
            features: ['Hero Fullscreen', 'Design Minimalista', 'Tipografia Elegante', 'Foco Visual'],
            icon: <Star size={48} className="text-gold" />,
            color: '#000'
        },
        {
            id: 'lead-capture',
            name: 'Captura de Leads',
            description: 'Formulário de contato em destaque. Ideal para campanhas de tráfego pago.',
            features: ['Formulário no Topo', 'Call-to-Action Forte', 'Layout 2 Colunas', 'WhatsApp'],
            icon: <MousePointerClick size={48} className="text-gold" />,
            color: '#25D366'
        }
    ]

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {templates.map(template => (
                <div key={template.id} className="chart-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', transition: 'transform 0.2s', border: template.recommended ? '1px solid var(--gold)' : undefined }}>
                    {template.recommended && (
                        <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'var(--gold)', color: '#0a0a0a', padding: '2px 10px', borderRadius: '50px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', zIndex: 2 }}>
                            Alta Conversão
                        </div>
                    )}
                    <div style={{ height: '120px', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #222' }}>
                        {template.icon}
                    </div>

                    <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', marginBottom: '6px' }}>{template.name}</h3>
                        <p style={{ fontSize: '0.82rem', color: '#888', lineHeight: 1.5, marginBottom: '16px', flex: 1 }}>{template.description}</p>

                        <ul style={{ listStyle: 'none', padding: 0, marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {template.features.map((feature, i) => (
                                <li key={i} style={{ fontSize: '0.78rem', color: '#aaa', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <CheckCircle size={12} className="text-gold" />
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <Link href={`/preview?template=${template.id}`} target="_blank" style={{ flex: 1 }}>
                                <button className="btn btn-outline" style={{ width: '100%', fontSize: '0.75rem', padding: '8px' }}>
                                    <Monitor size={14} /> Ver ao Vivo
                                </button>
                            </Link>
                            <Link href={`/admin/pages/new?template=${template.id}`} style={{ flex: 1 }}>
                                <button className="btn btn-gold" style={{ width: '100%', fontSize: '0.75rem', padding: '8px' }}>
                                    Usar <ArrowRight size={14} />
                                </button>
                            </Link>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}
