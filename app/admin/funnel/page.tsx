'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AdminLoadingState from '@/components/admin/AdminLoadingState'


interface FunnelStep {
    label: string
    count: number
    percentage: number
}

interface Visitor {
    id: string
    ip_address: string
    detected_source: string
    city: string
    region: string
    country: string
    browser: string
    os: string
    device_type: string
    first_visit_at: string
    last_visit_at: string
    page_views: number
    is_lead: boolean
    funnel_stage: string
    push_subscribed?: boolean
    max_scroll?: number
}

export default function FunnelPage() {
    const [funnelData, setFunnelData] = useState<FunnelStep[]>([])
    const [visitors, setVisitors] = useState<Visitor[]>([])
    const [loading, setLoading] = useState(true)

    const safeDecode = (str?: string) => {
        if (!str) return ''
        try {
            return decodeURIComponent(str)
        } catch (e) {
            return str
        }
    }

    useEffect(() => {
        const fetchFunnel = async () => {
            try {
                const res = await fetch('/api/admin/funnel')
                const data = await res.json()

                if (data.error) throw new Error(data.error)

                const total = data.pageViews || 1

                const steps: FunnelStep[] = [
                    { label: '👁️ Visitaram a Página', count: data.pageViews || 0, percentage: 100 },
                    { label: '🍪 Aceite de Cookies', count: data.cookieConsent || 0, percentage: ((data.cookieConsent || 0) / total) * 100 },
                    { label: '🧾 Formulário Enviado', count: data.formSubmitted || 0, percentage: ((data.formSubmitted || 0) / total) * 100 },
                    { label: '💬 Abriram o Chat', count: data.chatOpened || 0, percentage: ((data.chatOpened || 0) / total) * 100 },
                    { label: '📝 Enviaram Mensagem', count: data.messageSent || 0, percentage: ((data.messageSent || 0) / total) * 100 },
                    { label: '📲 Conversa WhatsApp Iniciada', count: data.whatsappConversationStarted || 0, percentage: ((data.whatsappConversationStarted || 0) / total) * 100 },
                    { label: '🔁 Follow-up Enviado', count: data.whatsappFollowupSent || 0, percentage: ((data.whatsappFollowupSent || 0) / total) * 100 },
                    { label: '✅ Responderam ao Follow-up', count: data.whatsappFollowupReplied || 0, percentage: ((data.whatsappFollowupReplied || 0) / total) * 100 },
                    { label: '🔔 Aceitaram Push', count: data.pushSubscribed || 0, percentage: ((data.pushSubscribed || 0) / total) * 100 },
                    { label: '📞 Lead Capturado', count: data.leadCaptured || 0, percentage: ((data.leadCaptured || 0) / total) * 100 },
                    { label: '⭐ Qualificado', count: data.qualified || 0, percentage: ((data.qualified || 0) / total) * 100 },
                    { label: '✅ Convertido', count: data.converted || 0, percentage: ((data.converted || 0) / total) * 100 },
                ]

                setFunnelData(steps)
            } catch (error) {
                console.error('Error loading funnel:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchFunnel()

        const fetchVisitors = async () => {
            try {
                const res = await fetch('/api/admin/visitors')
                const data = await res.json()
                if (Array.isArray(data)) {
                    setVisitors(data.slice(0, 50)) // Show top 50 recent
                }
            } catch (error) {
                console.error('Error fetching visitors:', error)
            }
        }
        fetchVisitors()
    }, [])

    if (loading) {
        return <AdminLoadingState message="Carregando funil..." />
    }

    return (
        <div>
            <div className="admin-header">
                <h1>Funil de Conversão</h1>
            </div>

            <div className="chart-card funnel-card">
                <div className="funnel-visual">
                    {funnelData.map((step, index) => {
                        const stepDrop = funnelData.length > 1 ? (70 / (funnelData.length - 1)) : 0
                        const topWidthPercent = Math.max(30, 100 - (index * stepDrop))
                        const palette = ['#0066FF', '#4ade80', '#9933FF', '#FF0099', '#FFAA00', '#FF6600', '#FFD700', '#00CC44']
                        const color = palette[index % palette.length]
                        
                        return (
                            <div key={index} style={{
                                width: '100%',
                                maxWidth: '1000px', // Wider container
                                display: 'grid',
                                gridTemplateColumns: '1fr 500px 1fr', // Grid layout: Label | Funnel | Stats
                                alignItems: 'center',
                                gap: '20px',
                                position: 'relative',
                                height: '50px'
                            }}>
                                {/* Label Left */}
                                <div style={{
                                    textAlign: 'right',
                                    fontSize: '0.9rem',
                                    color: '#ccc',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    whiteSpace: 'nowrap' // Prevent wrapping
                                }}>
                                    <span style={{ color: color, marginRight: '8px', fontSize: '1.2em' }}>●</span>
                                    {step.label.replace(/^[^\s]+\s/, '')}
                                    <div style={{ width: '60px', height: '1px', background: `linear-gradient(to right, transparent, ${color})`, marginLeft: '10px', opacity: 0.5 }}></div>
                                </div>

                                {/* Funnel Trapezoid Shape (Centered) */}
                                <div style={{
                                    width: '100%', // Fills the 500px column
                                    height: '100%',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    position: 'relative',
                                    zIndex: 10 - index
                                }}>
                                    <div style={{
                                        width: `${topWidthPercent}%`,
                                        height: '100%',
                                        background: `linear-gradient(to bottom, ${color}ee, ${color}99)`,
                                        clipPath: `polygon(0 0, 100% 0, ${100 - (7.5)}% 100%, ${7.5}% 100%)`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                                        backdropFilter: 'blur(4px)',
                                        borderTop: '1px solid rgba(255,255,255,0.2)',
                                        transition: 'transform 0.3s ease',
                                    }}
                                        className="funnel-segment hover:scale-105 hover:brightness-110"
                                    >
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            lineHeight: 1,
                                            transform: 'translateY(-1px)'
                                        }}>
                                            <span style={{
                                                color: '#fff',
                                                fontWeight: '800',
                                                fontSize: '1.2rem',
                                                textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                                            }}>
                                                {step.count}
                                            </span>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                color: 'rgba(255,255,255,0.9)',
                                                marginTop: '2px'
                                            }}>
                                                {step.percentage.toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Conversion Rate Right */}
                                <div style={{
                                    fontSize: '0.8rem',
                                    color: '#888',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-start'
                                }}>
                                    {index > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '40px', height: '1px', background: 'rgba(255,255,255,0.1)', marginRight: '10px' }}></div>
                                            {/* Optional dropoff info */}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
            {/* Visitor Table (Top of Funnel Detail) */}
            <div className="chart-card" style={{ marginTop: '24px' }}>
                <div className="chart-title flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <span>Detalhamento de Tráfego (Topo de Funil)</span>
                    <Link href="/admin/leads" style={{ fontSize: '0.8rem', color: '#c9a96e', textDecoration: 'none' }}>Ver Todos</Link>
                </div>
                <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        {/* Assuming a Visitor interface exists somewhere above this component or in a separate file */}
                        {/* interface Visitor {
                            id: string
                            last_visit_at: string
                            city: string
                            region: string
                            country: string
                            detected_source: string
                            page_views: number
                            is_lead: boolean
                            funnel_stage: string
                            push_subscribed?: boolean
                            max_scroll?: number
                        } */}
                        <thead style={{ position: 'sticky', top: 0, background: '#1a1a1a', zIndex: 10 }}>
                            <tr style={{ borderBottom: '1px solid #2a2a2a', color: '#666', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                <th style={{ padding: '8px', fontWeight: 500 }}>Status</th>
                                <th style={{ padding: '8px', fontWeight: 500 }}>Última Visita</th>
                                <th style={{ padding: '8px', fontWeight: 500 }}>Localização</th>
                                <th style={{ padding: '8px', fontWeight: 500 }}>Origem</th>
                                <th style={{ padding: '8px', fontWeight: 500 }}>Páginas</th>
                                <th style={{ padding: '8px', fontWeight: 500 }}>Leitura</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visitors.map((v, i) => (
                                <tr key={v.id || i} style={{ borderBottom: '1px solid #2a2a2a', fontSize: '0.85rem' }}>
                                    <td style={{ padding: '12px 8px' }}>
                                        {v.is_lead ? (
                                            <span style={{ fontSize: '0.7rem', background: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(74, 222, 128, 0.2)' }}>
                                                Lead ({v.funnel_stage})
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '0.7rem', background: 'rgba(201, 169, 110, 0.1)', color: '#c9a96e', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(201, 169, 110, 0.2)' }}>
                                                Visitante
                                            </span>
                                        )}
                                        {v.push_subscribed && (
                                            <span style={{ marginLeft: '8px', fontSize: '0.9rem' }} title="Assinante Push">🔔</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px 8px', color: '#f5f5f5' }}>
                                        {new Date(v.last_visit_at).toLocaleString('pt-BR')}
                                    </td>
                                    <td style={{ padding: '12px 8px', color: '#888' }}>
                                        {[safeDecode(v.city), safeDecode(v.region), v.country].filter(Boolean).join(', ') || '—'}
                                    </td>
                                    <td style={{ padding: '12px 8px', fontWeight: 500, color: '#f5f5f5' }}>
                                        {v.detected_source}
                                    </td>
                                    <td style={{ padding: '12px 8px', textAlign: 'center', color: '#f5f5f5' }}>
                                        <span style={{ background: '#2a2a2a', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>
                                            {v.page_views}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ flex: 1, height: '4px', background: '#2a2a2a', borderRadius: '2px', overflow: 'hidden', minWidth: '40px' }}>
                                                <div style={{ width: `${v.max_scroll || 0}%`, height: '100%', background: (v.max_scroll || 0) > 70 ? '#4ade80' : '#c9a96e' }}></div>
                                            </div>
                                            <span style={{ fontSize: '0.75rem', color: (v.max_scroll || 0) > 0 ? '#f5f5f5' : '#444' }}>
                                                {v.max_scroll || 0}%
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {visitors.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#666' }}>Nenhum acesso recente</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>


        </div>
    )
}

