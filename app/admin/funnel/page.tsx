'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface FunnelStep {
    label: string
    count: number
    percentage: number
}

export default function FunnelPage() {
    const [funnelData, setFunnelData] = useState<FunnelStep[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchFunnel = async () => {
            const supabase = createClient()

            // Count each funnel event type
            const { count: pageViews } = await supabase
                .from('funnel_events')
                .select('*', { count: 'exact', head: true })
                .eq('event_type', 'page_view')

            const { count: chatOpened } = await supabase
                .from('funnel_events')
                .select('*', { count: 'exact', head: true })
                .eq('event_type', 'chat_opened')

            const { count: messageSent } = await supabase
                .from('funnel_events')
                .select('*', { count: 'exact', head: true })
                .eq('event_type', 'message_sent')

            const { count: leadCaptured } = await supabase
                .from('funnel_events')
                .select('*', { count: 'exact', head: true })
                .eq('event_type', 'lead_captured')

            const { count: qualified } = await supabase
                .from('leads')
                .select('*', { count: 'exact', head: true })
                .eq('funnel_stage', 'qualified')

            const { count: converted } = await supabase
                .from('leads')
                .select('*', { count: 'exact', head: true })
                .eq('funnel_stage', 'converted')

            const total = pageViews || 1

            const steps: FunnelStep[] = [
                { label: '👁️ Visitaram a Página', count: pageViews || 0, percentage: 100 },
                { label: '💬 Abriram o Chat', count: chatOpened || 0, percentage: ((chatOpened || 0) / total) * 100 },
                { label: '📝 Enviaram Mensagem', count: messageSent || 0, percentage: ((messageSent || 0) / total) * 100 },
                { label: '📞 Lead Capturado', count: leadCaptured || 0, percentage: ((leadCaptured || 0) / total) * 100 },
                { label: '⭐ Qualificado', count: qualified || 0, percentage: ((qualified || 0) / total) * 100 },
                { label: '✅ Convertido', count: converted || 0, percentage: ((converted || 0) / total) * 100 },
            ]

            setFunnelData(steps)
            setLoading(false)
        }

        fetchFunnel()
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
                <div className="funnel-container">
                    {funnelData.map((step, index) => (
                        <div key={index} className="funnel-step">
                            <div className="funnel-label">{step.label}</div>
                            <div style={{ flex: 1 }}>
                                <div
                                    className="funnel-bar"
                                    style={{ width: `${Math.max(step.percentage, 3)}%` }}
                                />
                            </div>
                            <div className="funnel-count">{step.count}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: '50px', textAlign: 'right' }}>
                                {step.percentage.toFixed(1)}%
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Conversion tips */}
            <div className="chart-card" style={{ marginTop: '24px' }}>
                <div className="chart-title">💡 Dicas de Otimização</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                    <div style={{ padding: '16px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--gold)' }}>Chat → Lead</div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Otimize o prompt do agente IA para coletar dados de forma mais natural. Peça um dado por vez.
                        </p>
                    </div>
                    <div style={{ padding: '16px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--gold)' }}>Visitante → Chat</div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Considere abrir o chat automaticamente após 10 segundos. Melhora a taxa de engajamento.
                        </p>
                    </div>
                    <div style={{ padding: '16px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--gold)' }}>Exit Intent</div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Ative o popup de saída para capturar visitantes que estão saindo sem converter.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
