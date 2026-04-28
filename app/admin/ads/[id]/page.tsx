'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowLeft, Pause, Play, DollarSign, TrendingUp, Brain,
    AlertTriangle, Clock, CheckCircle, AlertCircle, Eye, Target, BarChart3
} from 'lucide-react'
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, AreaChart, Area
} from 'recharts'
import AdminLoadingState from '@/components/admin/AdminLoadingState'

// ─── Types ────────────────────────────────────────────────────
interface Campaign {
    id: string
    name: string
    platform: 'meta' | 'google'
    status: string
    total_budget: number
    daily_budget?: number
    duration_days: number
    start_date?: string
    end_date?: string
    ai_auto_manage: boolean
    external_campaign_id?: string
    target_audience: Record<string, unknown>
    properties?: { title: string } | null
    latest_metrics?: any
}

interface MetricSnapshot {
    id: string
    snapshot_at: string
    impressions: number
    clicks: number
    ctr: number
    cpm: number
    cpc: number
    spend: number
    leads_count: number
    cost_per_lead?: number
    frequency?: number
    thumbstop_ratio?: number
    reach?: number
    landing_page_views?: number
    link_clicks?: number
    quality_ranking?: string
    engagement_rate_ranking?: string
    conversion_rate_ranking?: string
    video_p50?: number
    video_p75?: number
    video_p100?: number
    conversions?: number
}

interface Alert {
    id: string
    type: string
    urgency: string
    action_taken?: string
    message: string
    ai_reasoning?: string
    created_at: string
}

interface ActionLog {
    id: string
    action: string
    old_value?: string
    new_value?: string
    reason?: string
    executed_at: string
}

// ─── Helpers ──────────────────────────────────────────────────
function formatCurrency(val: number) {
    return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
    draft: { label: 'Rascunho', color: '#94a3b8' },
    pending: { label: 'Publicando...', color: '#f59e0b' },
    active: { label: 'Ativa', color: '#22c55e' },
    paused: { label: 'Pausada', color: '#f59e0b' },
    completed: { label: 'Encerrada', color: '#6366f1' },
    error: { label: 'Erro', color: '#ef4444' },
}

const URGENCY_COLOR: Record<string, string> = {
    low: '#94a3b8', medium: '#f59e0b', high: '#f97316', critical: '#ef4444',
}

// ─── Main Page ────────────────────────────────────────────────
export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const [campaign, setCampaign] = useState<Campaign | null>(null)
    const [metrics, setMetrics] = useState<MetricSnapshot[]>([])
    const [alerts, setAlerts] = useState<Alert[]>([])
    const [actionLogs, setActionLogs] = useState<ActionLog[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)
    const [chartTab, setChartTab] = useState<'spend' | 'leads' | 'ctr' | 'cpa'>('spend')
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 4000)
    }

    const fetchData = async () => {
        try {
            const [campRes, metricsRes, actionsRes] = await Promise.all([
                fetch('/api/admin/ads'),
                fetch(`/api/admin/ads/${id}/metrics`),
                fetch(`/api/admin/ads/${id}/actions`),
            ])

            if (campRes.ok) {
                const campaigns = await campRes.json()
                const found = campaigns.find((c: Campaign) => c.id === id)
                setCampaign(found || null)
            }
            if (metricsRes.ok) setMetrics(await metricsRes.json())
            if (actionsRes.ok) {
                const data = await actionsRes.json()
                setAlerts(data.alerts || [])
                setActionLogs(data.action_log || [])
            }
        } catch {
            showToast('Erro ao carregar dados', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchData() }, [id])

    const executeAction = async (action: string, extraData?: Record<string, unknown>) => {
        setActionLoading(true)
        try {
            const res = await fetch(`/api/admin/ads/${id}/actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...extraData }),
            })
            const data = await res.json()
            if (res.ok) {
                showToast(data.message, 'success')
                fetchData()
            } else {
                showToast(data.error, 'error')
            }
        } catch {
            showToast('Erro na ação', 'error')
        } finally {
            setActionLoading(false)
        }
    }

    const handlePublish = async () => {
        setActionLoading(true)
        try {
            const res = await fetch('/api/admin/ads/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaign_id: id }),
            })
            const data = await res.json()
            if (res.ok) {
                showToast(data.message, 'success')
                fetchData()
            } else {
                showToast(data.error, 'error')
            }
        } catch {
            showToast('Erro ao publicar', 'error')
        } finally {
            setActionLoading(false)
        }
    }

    if (loading) return <AdminLoadingState message="Carregando campanha..." />
    if (!campaign) return <div style={{ padding: '40px', color: 'var(--danger)' }}>Campanha não encontrada</div>

    const st = STATUS_MAP[campaign.status] || STATUS_MAP.draft
    const latestMetric = metrics.length > 0 ? metrics[metrics.length - 1] : (campaign.latest_metrics || null)
    const totalSpend = campaign.latest_metrics?.spend || metrics.reduce((s, m) => s + m.spend, 0)

    // Budget pacing
    const daysElapsed = campaign.start_date
        ? Math.max(1, Math.ceil((Date.now() - new Date(campaign.start_date).getTime()) / 86400000))
        : 1
    const dailyTarget = campaign.daily_budget || campaign.total_budget / campaign.duration_days
    const expectedSpend = dailyTarget * daysElapsed
    const pacingPct = expectedSpend > 0 ? (totalSpend / expectedSpend) * 100 : 0

    // Chart data
    const chartData = metrics.map(m => ({
        date: new Date(m.snapshot_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        spend: Number(m.spend.toFixed(2)),
        impressions: m.impressions,
        clicks: m.clicks,
        ctr: Number((m.ctr * 100).toFixed(2)),
        leads: m.leads_count,
        cpa: m.cost_per_lead ? Number(m.cost_per_lead.toFixed(2)) : 0,
    }))

    return (
        <div>
            {toast && (
                <div className={`admin-toast ${toast.type}`}>
                    {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="admin-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => router.push('/admin/ads')}>
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <h1 style={{ margin: 0 }}>{campaign.name}</h1>
                            <span style={{
                                fontSize: '0.7rem', padding: '3px 10px', borderRadius: '50px',
                                background: `${st.color}22`, color: st.color,
                                fontWeight: 600, textTransform: 'uppercase',
                            }}>{st.label}</span>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>
                            {campaign.platform === 'meta' ? '📘 Meta Ads' : '🔍 Google Ads'}
                            {campaign.properties?.title && ` — 🏠 ${campaign.properties.title}`}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {campaign.status === 'draft' && (
                        <button className="btn btn-gold" onClick={handlePublish} disabled={actionLoading}>
                            🚀 Publicar
                        </button>
                    )}
                    {campaign.status === 'active' && (
                        <button className="btn btn-outline" onClick={() => executeAction('pause')} disabled={actionLoading}>
                            <Pause size={16} /> Pausar
                        </button>
                    )}
                    {campaign.status === 'paused' && (
                        <button className="btn btn-gold" onClick={() => executeAction('activate')} disabled={actionLoading}>
                            <Play size={16} /> Reativar
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                {[
                    { icon: <DollarSign size={16} />, label: 'Orçamento Total', value: formatCurrency(campaign.total_budget), color: 'var(--gold)' },
                    { icon: <DollarSign size={16} />, label: 'Gasto Acumulado', value: formatCurrency(totalSpend), color: '#22c55e' },
                    { icon: <Eye size={16} />, label: 'Impressões', value: latestMetric?.impressions.toLocaleString('pt-BR') || '0', color: '#6366f1' },
                    { icon: <Target size={16} />, label: 'Conversões', value: (latestMetric?.conversions || latestMetric?.leads_count || 0).toString(), color: '#f59e0b' },
                    { icon: <TrendingUp size={16} />, label: 'CTR', value: latestMetric ? `${(latestMetric.ctr * 100).toFixed(2)}%` : '—', color: '#06b6d4' },
                    { icon: <BarChart3 size={16} />, label: 'CPA', value: latestMetric?.cost_per_lead ? formatCurrency(latestMetric.cost_per_lead) : '—', color: '#f97316' },
                    { icon: <Eye size={16} />, label: 'Alcance', value: latestMetric?.reach?.toLocaleString('pt-BR') || '—', color: '#8b5cf6' },
                ].map((card, i) => (
                    <div key={i} className="chart-card" style={{ textAlign: 'center', padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '6px', color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            <span style={{ color: card.color }}>{card.icon}</span> {card.label}
                        </div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 700, color: card.color }}>{card.value}</div>
                    </div>
                ))}
            </div>

            {/* Budget Pacing */}
            <div className="chart-card" style={{ marginBottom: '24px' }}>
                <div className="chart-title" style={{ marginBottom: '12px' }}>💰 Ritmo de Orçamento</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ height: '10px', borderRadius: '10px', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', borderRadius: '10px', transition: 'width 0.5s',
                                width: `${Math.min(pacingPct, 100)}%`,
                                background: pacingPct > 130 ? '#ef4444' : pacingPct > 110 ? '#f59e0b' : '#22c55e',
                            }} />
                        </div>
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: pacingPct > 130 ? '#ef4444' : pacingPct > 110 ? '#f59e0b' : '#22c55e' }}>
                        {pacingPct.toFixed(0)}%
                    </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>Alvo diário: {formatCurrency(dailyTarget)}</span>
                    <span>Gasto: {formatCurrency(totalSpend)} / {formatCurrency(campaign.total_budget)}</span>
                    <span>Dia {daysElapsed} de {campaign.duration_days}</span>
                </div>
            </div>

            {/* Advanced Metrics (Funnel, Quality, Video) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '24px' }}>
                {/* Visual Funnel */}
                <div className="chart-card">
                    <div className="chart-title" style={{ marginBottom: '16px' }}>📊 Funil Visual</div>
                    {(() => {
                        const imp = latestMetric?.impressions || 0
                        const clk = latestMetric?.link_clicks || latestMetric?.clicks || 0
                        const lpv = latestMetric?.landing_page_views || 0
                        const lds = latestMetric?.conversions || latestMetric?.leads_count || 0

                        const maxW = 100
                        const clkPct = imp > 0 ? (clk / imp) * maxW : 0
                        const lpvPct = imp > 0 ? (lpv / imp) * maxW : 0
                        const ldsPct = imp > 0 ? (lds / imp) * maxW : 0

                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        <span>Impressões</span><span>{imp.toLocaleString('pt-BR')}</span>
                                    </div>
                                    <div style={{ height: '24px', background: '#3b82f6', width: '100%', borderRadius: '4px', marginTop: '4px' }} />
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        <span>Cliques (Link) {imp > 0 ? `(${(clk / imp * 100).toFixed(1)}%)` : ''}</span><span>{clk.toLocaleString('pt-BR')}</span>
                                    </div>
                                    <div style={{ height: '24px', background: '#0ea5e9', width: `${Math.max(clkPct, 2)}%`, borderRadius: '4px', marginTop: '4px' }} />
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        <span>Visitas na LPV {clk > 0 ? `(${(lpv / clk * 100).toFixed(1)}%)` : ''}</span><span>{lpv.toLocaleString('pt-BR')}</span>
                                    </div>
                                    <div style={{ height: '24px', background: '#f59e0b', width: `${Math.max(lpvPct, 2)}%`, borderRadius: '4px', marginTop: '4px' }} />
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        <span>Leads {lpv > 0 ? `(${(lds / lpv * 100).toFixed(1)}%)` : ''}</span><span>{lds.toLocaleString('pt-BR')}</span>
                                    </div>
                                    <div style={{ height: '24px', background: '#22c55e', width: `${Math.max(ldsPct, 2)}%`, borderRadius: '4px', marginTop: '4px' }} />
                                </div>
                            </div>
                        )
                    })()}
                </div>

                {/* Quality & Video */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Quality Rankings */}
                    <div className="chart-card">
                        <div className="chart-title" style={{ marginBottom: '16px' }}>🏆 Meta Quality Rankings</div>
                        <div style={{ display: 'grid', gap: '12px', fontSize: '0.85rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Quality Ranking</span>
                                <strong style={{ color: latestMetric?.quality_ranking?.includes('ABOVE') ? '#22c55e' : latestMetric?.quality_ranking?.includes('BELOW') ? '#ef4444' : 'var(--text-primary)' }}>
                                    {latestMetric?.quality_ranking || 'N/A'}
                                </strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Engagement Rate Ranking</span>
                                <strong style={{ color: latestMetric?.engagement_rate_ranking?.includes('ABOVE') ? '#22c55e' : latestMetric?.engagement_rate_ranking?.includes('BELOW') ? '#ef4444' : 'var(--text-primary)' }}>
                                    {latestMetric?.engagement_rate_ranking || 'N/A'}
                                </strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Conversion Rate Ranking</span>
                                <strong style={{ color: latestMetric?.conversion_rate_ranking?.includes('ABOVE') ? '#22c55e' : latestMetric?.conversion_rate_ranking?.includes('BELOW') ? '#ef4444' : 'var(--text-primary)' }}>
                                    {latestMetric?.conversion_rate_ranking || 'N/A'}
                                </strong>
                            </div>
                        </div>
                    </div>

                    {/* Video Retention */}
                    <div className="chart-card">
                        <div className="chart-title" style={{ marginBottom: '16px' }}>🎬 Retenção de Vídeo</div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', height: '80px', gap: '4px' }}>
                            {[
                                { label: 'Thumbstop (3s)', val: latestMetric?.thumbstop_ratio ? latestMetric.thumbstop_ratio * 100 : 0 },
                                { label: '50%', val: latestMetric?.video_p50 && latestMetric?.impressions ? (latestMetric.video_p50 / latestMetric.impressions) * 100 : 0 },
                                { label: '75%', val: latestMetric?.video_p75 && latestMetric?.impressions ? (latestMetric.video_p75 / latestMetric.impressions) * 100 : 0 },
                                { label: '100%', val: latestMetric?.video_p100 && latestMetric?.impressions ? (latestMetric.video_p100 / latestMetric.impressions) * 100 : 0 },
                            ].map((bar, i) => (
                                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-primary)', fontWeight: 600 }}>{bar.val.toFixed(1)}%</div>
                                    <div style={{ width: '100%', background: 'rgba(59,130,246,0.1)', height: '100%', position: 'relative', borderRadius: '4px' }}>
                                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${Math.min(bar.val, 100)}%`, background: '#3b82f6', borderRadius: '4px' }} />
                                    </div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{bar.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts + Alerts */}
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px', marginBottom: '24px' }}>
                {/* Performance Charts */}
                <div className="chart-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div className="chart-title" style={{ marginBottom: 0 }}>📈 Evolução Diária</div>
                        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px' }}>
                            {['spend', 'leads', 'ctr', 'cpa'].map(tb => (
                                <button
                                    key={tb}
                                    onClick={() => setChartTab(tb as any)}
                                    style={{
                                        padding: '4px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                                        background: chartTab === tb ? 'var(--bg-primary)' : 'transparent',
                                        color: chartTab === tb ? 'var(--text-primary)' : 'var(--text-muted)',
                                        boxShadow: chartTab === tb ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                    }}
                                >
                                    {tb.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                    {chartData.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                            Nenhuma métrica coletada ainda. Os dados aparecem após o primeiro polling (a cada 1h).
                        </div>
                    ) : (
                        <div className="admin-chart-frame ads-chart-frame ads-chart-frame-detail">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                    <Tooltip
                                        contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.8rem' }}
                                        labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                                    />
                                    {chartTab === 'spend' && <Area type="monotone" dataKey="spend" name="Gasto (R$)" stroke="#22c55e" fill="rgba(34,197,94,0.1)" strokeWidth={2} isAnimationActive animationDuration={950} />}
                                    {chartTab === 'leads' && <Area type="monotone" dataKey="leads" name="Leads" stroke="#6366f1" fill="rgba(99,102,241,0.1)" strokeWidth={2} isAnimationActive animationDuration={950} />}
                                    {chartTab === 'ctr' && <Area type="monotone" dataKey="ctr" name="CTR (%)" stroke="#0ea5e9" fill="rgba(14,165,233,0.1)" strokeWidth={2} isAnimationActive animationDuration={950} />}
                                    {chartTab === 'cpa' && <Area type="monotone" dataKey="cpa" name="CPA (R$)" stroke="#f59e0b" fill="rgba(245,158,11,0.1)" strokeWidth={2} isAnimationActive animationDuration={950} />}
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* AI Alerts */}
                <div className="chart-card" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <div className="chart-title" style={{ marginBottom: '12px' }}>🤖 Ações e Alertas da IA</div>
                    {alerts.length === 0 && actionLogs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                            <Brain size={28} style={{ marginBottom: '8px' }} />
                            <p>Nenhuma ação ainda</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '8px' }}>
                            {alerts.map(alert => (
                                <div key={alert.id} style={{
                                    padding: '12px', borderRadius: '8px',
                                    background: 'var(--bg-secondary)',
                                    borderLeft: `3px solid ${URGENCY_COLOR[alert.urgency] || '#94a3b8'}`,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                        {alert.type === 'action' ? <Brain size={12} style={{ color: 'var(--gold)' }} /> :
                                            <AlertTriangle size={12} style={{ color: '#f59e0b' }} />}
                                        <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: URGENCY_COLOR[alert.urgency], fontWeight: 600 }}>
                                            {alert.urgency}
                                        </span>
                                        {alert.action_taken && alert.action_taken !== 'NONE' && (
                                            <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(201,169,110,0.15)', color: 'var(--gold)' }}>
                                                {alert.action_taken}
                                            </span>
                                        )}
                                        <span style={{ marginLeft: 'auto', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                                            {new Date(alert.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                        {alert.message}
                                    </div>
                                    {alert.ai_reasoning && (
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px', fontStyle: 'italic' }}>
                                            {alert.ai_reasoning}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {actionLogs.map(log => (
                                <div key={log.id} style={{
                                    padding: '10px 12px', borderRadius: '6px',
                                    background: 'var(--bg-secondary)',
                                    borderLeft: '3px solid var(--border-color)',
                                    fontSize: '0.75rem',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Clock size={11} style={{ color: 'var(--text-muted)' }} />
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{log.action}</span>
                                        <span style={{ marginLeft: 'auto', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                                            {new Date(log.executed_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    {log.reason && <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>{log.reason}</div>}
                                    {log.new_value && <div style={{ color: 'var(--gold)', marginTop: '2px' }}>→ {log.new_value}</div>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Campaign Info */}
            <div className="chart-card">
                <div className="chart-title" style={{ marginBottom: '12px' }}>ℹ️ Informações da Campanha</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', fontSize: '0.85rem' }}>
                    <div>
                        <span style={{ color: 'var(--text-muted)' }}>Plataforma:</span>
                        <br /><strong>{campaign.platform === 'meta' ? 'Meta Ads' : 'Google Ads'}</strong>
                    </div>
                    <div>
                        <span style={{ color: 'var(--text-muted)' }}>Orçamento Total:</span>
                        <br /><strong style={{ color: 'var(--gold)' }}>{formatCurrency(campaign.total_budget)}</strong>
                    </div>
                    <div>
                        <span style={{ color: 'var(--text-muted)' }}>Orçamento Diário:</span>
                        <br /><strong>{formatCurrency(dailyTarget)}</strong>
                    </div>
                    <div>
                        <span style={{ color: 'var(--text-muted)' }}>Duração:</span>
                        <br /><strong>{campaign.duration_days} dias</strong>
                    </div>
                    <div>
                        <span style={{ color: 'var(--text-muted)' }}>Início:</span>
                        <br /><strong>{campaign.start_date ? new Date(campaign.start_date).toLocaleDateString('pt-BR') : 'Não iniciada'}</strong>
                    </div>
                    <div>
                        <span style={{ color: 'var(--text-muted)' }}>IA Autônoma:</span>
                        <br /><strong style={{ color: campaign.ai_auto_manage ? '#22c55e' : '#ef4444' }}>
                            {campaign.ai_auto_manage ? '✅ Ativa' : '❌ Desativada'}
                        </strong>
                    </div>
                    {campaign.external_campaign_id && (
                        <div style={{ gridColumn: '1 / -1' }}>
                            <span style={{ color: 'var(--text-muted)' }}>ID Externo:</span>
                            <br /><code style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{campaign.external_campaign_id}</code>
                        </div>
                    )}
                </div>
            </div>

            {/* Toast Styles */}
            <style>{`
                .admin-toast {
                    position: fixed; top: 24px; right: 24px;
                    padding: 14px 24px; border-radius: 12px;
                    font-size: 0.9rem; font-weight: 500;
                    display: flex; align-items: center; gap: 10px;
                    z-index: 10000; animation: toastIn 0.35s ease-out;
                    box-shadow: 0 8px 30px rgba(0,0,0,0.4);
                }
                .admin-toast.success { background: rgba(74,222,128,0.15); border: 1px solid rgba(74,222,128,0.3); color: var(--success); }
                .admin-toast.error { background: rgba(248,113,113,0.15); border: 1px solid rgba(248,113,113,0.3); color: var(--danger); }
                @keyframes toastIn { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }
            `}</style>
        </div>
    )
}
