'use client'

import { useEffect, useState } from 'react'


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
                    { label: '💬 Abriram o Chat', count: data.chatOpened || 0, percentage: ((data.chatOpened || 0) / total) * 100 },
                    { label: '📝 Enviaram Mensagem', count: data.messageSent || 0, percentage: ((data.messageSent || 0) / total) * 100 },
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
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <p style={{ color: 'var(--text-muted)' }}>Carregando funil...</p>
            </div>
        )
    }

    return (
        <div>
            <div className="admin-header">
                <h1>Funil de Conversão</h1>
            </div>

            <div className="chart-card">
                <div className="funnel-container" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px', // Tighter gap for connected feel
                    padding: '40px 0'
                }}>
                    {funnelData.map((step, index) => {
                        // Schematic width: reduces by step to preserve funnel shape
                        // e.g. 100%, 85%, 70%, 55%, 40%, 25%
                        const maxSteps = 8
                        const topWidthPercent = 100 - (index * 12)
                        const bottomWidthPercent = 100 - ((index + 1) * 12)

                        // Vivid colors for high impact on dark background
                        const colors = [
                            '#0066FF', // Electric Blue (Awareness)
                            '#4ade80', // Green (Cookie Consent) - Add a distinctive color
                            '#9933FF', // Electric Purple (Interest)
                            '#FF0099', // Hot Pink (Desire)
                            '#FFAA00', // Amber (Push Notification)
                            '#FF6600', // Vivid Orange (Action)
                            '#FFD700', // Gold (Qualification)
                            '#00CC44'  // Vivid Green (Conversion)
                        ]

                        // Overriding with custom hex for "Vivid" request
                        const vividColors = [
                            '#0ea5e9', // Sky 500 (Cyan-Blue)
                            '#d946ef', // Fuchsia 500 (Magenta)
                            '#f43f5e', // Rose 500 (Red-Pink)
                            '#f97316', // Orange 500
                            '#fbbf24', // Amber 400
                            '#10b981'  // Emerald 500
                        ]

                        // Let's use the vivid set
                        const activeColors = [
                            '#0088FE', // Strong Blue
                            '#4ade80', // Green (Consent)
                            '#8884d8', // Purple
                            '#FF8042', // Orange (Wait, let's stick to the spectrum requested: Blue -> Purple -> Pink -> Orange -> Yellow -> Green)

                            // Blue -> Purple -> Pink -> Orange -> Yellow -> Green
                            '#2563EB', // Blue 600 (Stronger) -> Let's try #3b82f6 again but maybe the issue is opacity?
                            // User said "more vivid".
                            '#0066FF', // Electric Blue
                            '#4ade80', // Cookie Green
                            '#9933FF', // Electric Purple
                            '#FF0099', // Hot Pink
                            '#FF6600', // Vivid Orange
                            '#FFD700', // Gold
                            '#00CC44'  // Vivid Green
                        ]

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
                                    <span style={{ color: colors[index], marginRight: '8px', fontSize: '1.2em' }}>●</span>
                                    {step.label.replace(/^[^\s]+\s/, '')}
                                    <div style={{ width: '60px', height: '1px', background: `linear-gradient(to right, transparent, ${colors[index]})`, marginLeft: '10px', opacity: 0.5 }}></div>
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
                                        background: `linear-gradient(to bottom, ${colors[index]}ee, ${colors[index]}99)`,
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
                    <a href="/admin/leads" style={{ fontSize: '0.8rem', color: '#c9a96e', textDecoration: 'none' }}>Ver Todos</a>
                </div>
                <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ position: 'sticky', top: 0, background: '#1a1a1a', zIndex: 10 }}>
                            <tr style={{ borderBottom: '1px solid #2a2a2a', color: '#666', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                <th style={{ padding: '8px', fontWeight: 500 }}>Status</th>
                                <th style={{ padding: '8px', fontWeight: 500 }}>Última Visita</th>
                                <th style={{ padding: '8px', fontWeight: 500 }}>Localização</th>
                                <th style={{ padding: '8px', fontWeight: 500 }}>Origem</th>
                                <th style={{ padding: '8px', fontWeight: 500 }}>Páginas</th>
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
                                </tr>
                            ))}
                            {visitors.length === 0 && (
                                <tr>
                                    <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#666' }}>Nenhum acesso recente</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>


        </div>
    )
}
