'use client'

import { useEffect, useState } from 'react'

import { Users, Eye, MessageCircle, TrendingUp, UserCheck, Star, Brain, DollarSign, Target, Thermometer, Megaphone, Search, CheckCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import {
    SimpleBarChart,
    SimpleDonutChart,
    SimpleLineChart,
} from '@/components/admin/SimpleCharts'
import AdminLoadingState from '@/components/admin/AdminLoadingState'

interface DashboardStats {
    totalVisitors: number
    completeLeads: number
    partialLeads: number
    totalLeads: number
    conversionRate: number
    vipLeads: number
    whatsappConversations: number
    formSubmissions: number
    whatsappSent: number
    pushSubscribers: number
    cookieConsent: number
    investors: number
    housingLeads: number
}

interface SourceData {
    name: string
    value: number
}

interface DailyData {
    date: string
    visitors: number
    leads: number
}

interface RecentVisitor {
    id: string
    detected_source: string
    city: string
    region: string
    country: string
    last_visit_at: string
    is_lead: boolean
    is_complete_lead?: boolean
    funnel_stage: string
    push_subscribed?: boolean
}

const PIE_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6']

function renderMarkdown(md: string): string {
    // Escape HTML first (sanitization)
    let html = md
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    // Headers
    html = html.replace(/^### (.+)$/gm, '<h4 style="margin:16px 0 8px;color:var(--gold);font-size:1.1rem">$1</h4>')
    html = html.replace(/^## (.+)$/gm, '<h3 style="margin:20px 0 8px;color:var(--text-primary);font-size:1.25rem">$1</h3>')
    html = html.replace(/^# (.+)$/gm, '<h2 style="margin:24px 0 12px;color:var(--text-primary);font-size:1.5rem">$1</h2>')
    // Bold & Italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text-primary)">$1</strong>')
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Unordered lists
    html = html.replace(/^[\-\*] (.+)$/gm, '<li style="margin:4px 0;padding-left:4px">$1</li>')
    html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, (match) => `<ul style="margin:8px 0 8px 24px;padding:0;list-style:disc">${match}</ul>`)
    // Numbered lists
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li style="margin:4px 0;padding-left:4px">$1</li>')
    // Line breaks
    html = html.replace(/\n\n/g, '</p><p style="margin:8px 0">')
    html = html.replace(/\n/g, '<br/>')
    html = `<p style="margin:8px 0">${html}</p>`
    return html
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<DashboardStats>({
        totalVisitors: 0,
        completeLeads: 0,
        partialLeads: 0,
        totalLeads: 0,
        conversionRate: 0,
        vipLeads: 0,
        whatsappConversations: 0,
        formSubmissions: 0,
        whatsappSent: 0,
        pushSubscribers: 0,
        cookieConsent: 0,
        investors: 0,
        housingLeads: 0,
    })
    const [sourceData, setSourceData] = useState<SourceData[]>([])
    const [topPages, setTopPages] = useState<any[]>([])
    const [dailyData, setDailyData] = useState<DailyData[]>([])
    const [recentVisitors, setRecentVisitors] = useState<RecentVisitor[]>([])
    const [latestReport, setLatestReport] = useState<any>(null)
    const [metaReport, setMetaReport] = useState<any>(null)
    const [googleReport, setGoogleReport] = useState<any>(null)
    const [adMetrics, setAdMetrics] = useState<{ totalSpend: number; totalLeads: number; avgCpa: number; activeCampaigns: number }>({ totalSpend: 0, totalLeads: 0, avgCpa: 0, activeCampaigns: 0 })
    const [adDatePreset, setAdDatePreset] = useState('this_month')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [metaReports, setMetaReports] = useState<any[]>([])
    const [googleReports, setGoogleReports] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const safeDecode = (str?: string) => {
        if (!str) return ''
        try {
            return decodeURIComponent(str)
        } catch (e) {
            return str
        }
    }

    const fetchData = async () => {
        try {
            const res = await fetch('/api/admin/analytics')
            const data = await res.json()
            if (data.error) throw new Error(data.error)
            setStats(data.stats)
            setSourceData(data.sourceData)
            setTopPages(data.topPages || [])
            setRecentVisitors(data.recentVisitors || [])
            setDailyData(data.dailyData)
        } catch (error) {
            console.error('Error loading dashboard:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchReports = async () => {
        try {
            const [metaRes, googleRes] = await Promise.all([
                fetch('/api/admin/reports?platform=meta&limit=50'),
                fetch('/api/admin/reports?platform=google&limit=50'),
            ])
            if (metaRes.ok) {
                const d = await metaRes.json()
                setMetaReports(d.reports || [])
            }
            if (googleRes.ok) {
                const d = await googleRes.json()
                setGoogleReports(d.reports || [])
            }
        } catch (err) {
            console.error('Error fetching reports', err)
        }
    }

    const fetchAdMetrics = async (preset?: string, start?: string, end?: string) => {
        const dp = preset || adDatePreset
        const s = start || startDate
        const e = end || endDate

        try {
            let metaUrl = `/api/admin/ads?date_preset=${dp}`
            let googleUrl = `/api/admin/ads/google?date_preset=${dp}`

            if (dp === 'custom' && s && e) {
                metaUrl += `&start_date=${s}&end_date=${e}`
                googleUrl += `&start_date=${s}&end_date=${e}`
            }

            const [metaRes, googleRes] = await Promise.all([
                fetch(metaUrl),
                fetch(googleUrl),
            ])
            let allCampaigns: any[] = []
            if (metaRes.ok) {
                const data = await metaRes.json()
                allCampaigns = allCampaigns.concat(Array.isArray(data) ? data : (Array.isArray(data?.campaigns) ? data.campaigns : []))
            }
            if (googleRes.ok) {
                const data = await googleRes.json()
                allCampaigns = allCampaigns.concat(Array.isArray(data) ? data : (Array.isArray(data?.campaigns) ? data.campaigns : []))
            }
            const active = allCampaigns.filter(c => c.status === 'active')
            const spend = allCampaigns.reduce((s: number, c: any) => s + (c.latest_metrics?.spend || 0), 0)
            const leads = allCampaigns.reduce((s: number, c: any) => s + (c.latest_metrics?.leads_count || 0), 0)
            const cpa = leads > 0 ? spend / leads : 0
            setAdMetrics({ totalSpend: spend, totalLeads: leads, avgCpa: cpa, activeCampaigns: active.length })
        } catch (err) {
            console.error('Error fetching ad metrics', err)
        }
    }

    useEffect(() => {
        fetchData()
        fetchReports()
        fetchAdMetrics()
    }, [])

    const handleAdDateChange = (newPreset: string) => {
        setAdDatePreset(newPreset)
        if (newPreset !== 'custom') {
            fetchAdMetrics(newPreset)
        }
    }

    const handleCustomDateSearch = () => {
        if (!startDate || !endDate) return
        fetchAdMetrics('custom', startDate, endDate)
    }

    if (loading) {
        return <AdminLoadingState message="Carregando métricas..." />
    }

    const getScoreColor = (score: number) => {
        if (score >= 80) return '#22c55e'
        if (score >= 60) return '#3b82f6'
        if (score >= 40) return '#f59e0b'
        if (score >= 20) return '#f97316'
        return '#ef4444'
    }
    const getScoreLabel = (score: number) => {
        if (score >= 80) return 'Excelente'
        if (score >= 60) return 'Bom'
        if (score >= 40) return 'Médio'
        if (score >= 20) return 'Ruim'
        return 'Crítico'
    }
    const getScoreEmoji = (score: number) => {
        if (score >= 80) return '🟢'
        if (score >= 60) return '🔵'
        if (score >= 40) return '🟡'
        if (score >= 20) return '🟠'
        return '🔴'
    }
    const formatCurrency = (val: number) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

    // General score calculation based on datePreset
    const getRelevantReport = (reports: any[]) => {
        if (!reports || reports.length === 0) return null

        const spNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }))
        let since: string
        let until: string = spNow.toISOString().split('T')[0]

        if (adDatePreset === 'today') {
            since = until
        } else if (adDatePreset === 'yesterday') {
            since = new Date(spNow.getTime() - 86400000).toISOString().split('T')[0]
            until = since
        } else if (adDatePreset === 'last_7d') {
            since = new Date(spNow.getTime() - 7 * 86400000).toISOString().split('T')[0]
        } else if (adDatePreset === 'last_30d') {
            since = new Date(spNow.getTime() - 30 * 86400000).toISOString().split('T')[0]
        } else if (adDatePreset === 'custom' && startDate && endDate) {
            since = startDate
            until = endDate
        } else {
            return reports.find(r => r.type === 'weekly') || reports[0]
        }

        const rangeReports = reports.filter(r => r.date >= since && r.date <= until)
        if (since === until) {
            return rangeReports.find(r => r.type === 'daily') || rangeReports[0] || null
        }
        return rangeReports.find(r => r.type === 'weekly') || rangeReports.find(r => r.type === 'daily') || rangeReports[0] || null
    }

    const metaRelevant = getRelevantReport(metaReports)
    const googleRelevant = getRelevantReport(googleReports)

    const metaScore = metaRelevant?.performance_score ?? null
    const googleScore = googleRelevant?.performance_score ?? null
    const generalScore = metaScore != null && googleScore != null
        ? Math.round((metaScore + googleScore) / 2)
        : metaScore ?? googleScore ?? null

    const adDateLabels: Record<string, string> = {
        today: 'Hoje',
        yesterday: 'Ontem',
        last_7d: '7 dias',
        last_14d: '14 dias',
        last_30d: '30 dias',
        this_month: 'Este mês',
        last_month: 'Mês passado',
        maximum: 'Vitalício',
        custom: 'Personalizado',
    }

    return (
        <div>
            <div className="admin-header">
                <h1>Painel do CEO</h1>
                <p className="marketing-subtitle" style={{ color: 'var(--text-muted)' }}>Monitoramento proativo</p>
            </div>

            {/* ═══ Combined Traffic KPIs + General Thermometer ═══ */}
            <div style={{ marginBottom: 32 }}>
                <div>
                    <div className="marketing-traffic-header" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, justifyContent: 'space-between' }}>
                        <div className="marketing-traffic-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Megaphone size={22} color="var(--gold)" />
                            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Tráfego Pago — Visão Geral</span>
                        </div>
                        <div className="marketing-period-filter" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <select
                                value={adDatePreset}
                                onChange={e => handleAdDateChange(e.target.value)}
                                className="form-input"
                                style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: 8, minWidth: 120, cursor: 'pointer' }}
                            >
                                <option value="today">Hoje</option>
                                <option value="yesterday">Ontem</option>
                                <option value="last_7d">Últimos 7 dias</option>
                                <option value="last_14d">Últimos 14 dias</option>
                                <option value="last_30d">Últimos 30 dias</option>
                                <option value="this_month">Este mês</option>
                                <option value="last_month">Mês passado</option>
                                <option value="maximum">Vitalício</option>
                                <option value="custom">Personalizado</option>
                            </select>
                        </div>
                        {adDatePreset === 'custom' && (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                                <input 
                                    type="date" 
                                    value={startDate} 
                                    onChange={e => setStartDate(e.target.value)}
                                    className="ads-date-input"
                                />
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>até</span>
                                <input 
                                    type="date" 
                                    value={endDate} 
                                    onChange={e => setEndDate(e.target.value)}
                                    className="ads-date-input"
                                />
                                <button onClick={handleCustomDateSearch} className="btn-gold" style={{ padding: '4px 8px' }}>
                                    <Search size={14} />
                                </button>
                            </div>
                        )}

                    </div>
                    <div className="kpi-grid marketing-kpi-grid" style={{ gridTemplateColumns: `repeat(${generalScore != null ? 5 : 4}, 1fr)`, marginBottom: 0 }}>
                        <div className="kpi-card">
                            <DollarSign size={20} color="#22c55e" style={{ marginBottom: 8 }} />
                            <div className="kpi-label">Gasto Total {adDateLabels[adDatePreset] && `(${adDateLabels[adDatePreset]})`}</div>
                            <div className="kpi-value" style={{ color: '#22c55e' }}>{formatCurrency(adMetrics.totalSpend)}</div>
                        </div>
                        <div className="kpi-card">
                            <Users size={20} color="#8b5cf6" style={{ marginBottom: 8 }} />
                            <div className="kpi-label">Leads de Tráfego</div>
                            <div className="kpi-value" style={{ color: '#8b5cf6' }}>{adMetrics.totalLeads}</div>
                        </div>
                        <div className="kpi-card">
                            <Target size={20} color="#ec4899" style={{ marginBottom: 8 }} />
                            <div className="kpi-label">CPA Geral</div>
                            <div className="kpi-value" style={{ color: '#ec4899' }}>{adMetrics.avgCpa > 0 ? formatCurrency(adMetrics.avgCpa) : '—'}</div>
                        </div>
                        <div className="kpi-card">
                            <TrendingUp size={20} color="#c9a96e" style={{ marginBottom: 8 }} />
                            <div className="kpi-label">Campanhas Ativas</div>
                            <div className="kpi-value">{adMetrics.activeCampaigns}</div>
                        </div>
                        {/* General Thermometer — compact, same size as Meta/Google */}
                        {generalScore != null && (
                            <div className="kpi-card" style={{ position: 'relative', textAlign: 'center' }}>
                                <div style={{ position: 'relative', width: 56, height: 56, margin: '0 auto 6px' }}>
                                    <svg viewBox="0 0 56 56" width="56" height="56">
                                        <circle cx="28" cy="28" r="24" fill="none" stroke="var(--border-color)" strokeWidth="5" />
                                        <circle cx="28" cy="28" r="24" fill="none" stroke={getScoreColor(generalScore)} strokeWidth="5"
                                            strokeDasharray={`${(generalScore / 100) * 150.8} 150.8`}
                                            strokeLinecap="round" transform="rotate(-90 28 28)"
                                            style={{ transition: 'stroke-dasharray 1s ease-out' }} />
                                    </svg>
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: getScoreColor(generalScore), fontFamily: 'Playfair Display, serif', lineHeight: 1 }}>{generalScore}</span>
                                    </div>
                                </div>
                                <div className="kpi-label">Termômetro Geral</div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: getScoreColor(generalScore), marginTop: 2 }}>
                                    {getScoreEmoji(generalScore)} {getScoreLabel(generalScore)}
                                </div>
                                {metaScore != null && googleScore != null && (
                                    <div style={{ marginTop: 4, fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                                        Meta: {metaScore} | Google: {googleScore}
                                    </div>
                                )}
                                <div style={{ marginTop: 4, fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                                    Analise: {metaRelevant?.type || googleRelevant?.type || 'N/A'}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>





            {/* KPI Cards */}
            <div className="kpi-grid marketing-kpi-grid">
                <div className="kpi-card">
                    <Eye size={20} color="#c9a96e" style={{ marginBottom: 8 }} />
                    <div className="kpi-label">Visitantes</div>
                    <div className="kpi-value">{stats.totalVisitors.toLocaleString()}</div>
                </div>
                <div className="kpi-card" style={{ background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                    <Users size={20} color="#22c55e" style={{ marginBottom: 8 }} />
                    <div className="kpi-label" style={{ color: '#22c55e' }}>Leads Completos</div>
                    <div className="kpi-value" style={{ color: '#22c55e' }}>{stats.completeLeads.toLocaleString()}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4 }}>Nome + Telefone</div>
                </div>
                <div className="kpi-card" style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                    <Users size={20} color="#f59e0b" style={{ marginBottom: 8 }} />
                    <div className="kpi-label" style={{ color: '#f59e0b' }}>Leads Parciais</div>
                    <div className="kpi-value" style={{ color: '#f59e0b' }}>{stats.partialLeads.toLocaleString()}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4 }}>Abandonou no meio</div>
                </div>
                <div className="kpi-card">
                    <TrendingUp size={20} color="#c9a96e" style={{ marginBottom: 8 }} />
                    <div className="kpi-label">Taxa de Conversão</div>
                    <div className="kpi-value">{stats.conversionRate}%</div>
                </div>
                <div className="kpi-card">
                    <MessageCircle size={20} color="#25D366" style={{ marginBottom: 8 }} />
                    <div className="kpi-label">Conversas WhatsApp</div>
                    <div className="kpi-value">{stats.whatsappConversations.toLocaleString()}</div>
                </div>
                <div className="kpi-card">
                    <div style={{ marginBottom: 8 }}>🧾</div>
                    <div className="kpi-label">Formulários Enviados</div>
                    <div className="kpi-value">{stats.formSubmissions || 0}</div>
                </div>
                <div className="kpi-card">
                    <Star size={20} color="#c9a96e" style={{ marginBottom: 8 }} />
                    <div className="kpi-label">Leads VIP</div>
                    <div className="kpi-value">{stats.vipLeads}</div>
                </div>
                <div className="kpi-card">
                    <UserCheck size={20} color="#c9a96e" style={{ marginBottom: 8 }} />
                    <div className="kpi-label">WhatsApp Enviados</div>
                    <div className="kpi-value">{stats.whatsappSent}</div>
                </div>
                <div className="kpi-card">
                    <div style={{ marginBottom: 8 }}>🔔</div>
                    <div className="kpi-label">Inscritos Push</div>
                    <div className="kpi-value">{stats.pushSubscribers || 0}</div>
                </div>
                <div className="kpi-card">
                    <div style={{ marginBottom: 8 }}>🍪</div>
                    <div className="kpi-label">Aceite de Cookies</div>
                    <div className="kpi-value">{stats.cookieConsent || 0}</div>
                </div>
                <div className="kpi-card">
                    <div style={{ marginBottom: 8 }}>📊</div>
                    <div className="kpi-label">% Investidores</div>
                    <div className="kpi-value">{stats.totalLeads > 0 ? Math.round((stats.investors / stats.totalLeads) * 100) : 0}%</div>
                </div>
                <div className="kpi-card">
                    <div style={{ marginBottom: 8 }}>🏠</div>
                    <div className="kpi-label">% Moradia</div>
                    <div className="kpi-value">{stats.totalLeads > 0 ? Math.round((stats.housingLeads / stats.totalLeads) * 100) : 0}%</div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="marketing-charts-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                {/* Daily Chart */}
                <div className="chart-card">
                    <div className="chart-title">Visitantes & Leads — Últimos 7 dias</div>
                    <SimpleLineChart
                        data={dailyData.map(item => ({ ...item, label: item.date }))}
                        valueFormatter={formatMetric}
                        series={[
                            { key: 'visitors', name: 'Visitantes', color: '#c9a96e' },
                            { key: 'leads', name: 'Leads', color: '#4ade80' },
                        ]}
                    />
                </div>

                {/* Source Pie Chart */}
                <div className="chart-card">
                    <div className="chart-title">Origens de Tráfego</div>
                    {sourceData.length > 0 ? (
                        <SimpleDonutChart data={sourceData} colors={PIE_COLORS} valueFormatter={formatMetric} />
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280, color: 'var(--text-muted)' }}>
                            Nenhum dado disponível
                        </div>
                    )}
                </div>
            </div>

            {/* Source Bar Chart & Top Pages Row */}
            <div className="marketing-charts-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <div className="chart-card">
                    <div className="chart-title">Visitantes por Fonte</div>
                    <SimpleBarChart data={sourceData} color="#c9a96e" name="Visitantes" valueFormatter={formatMetric} />
                </div>

                <div className="chart-card">
                    <div className="chart-title">Páginas Mais Visitadas (Top 10)</div>
                    <SimpleBarChart data={topPages} color="#4ade80" name="Acessos" layout="horizontal" valueFormatter={formatMetric} />
                </div>
            </div>

            {/* Recent Traffic */}
            <div className="chart-card" style={{ marginBottom: '24px' }}>
                <div className="chart-title flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <span>Tráfego em Tempo Real (Últimos Acessos)</span>
                    <Link href="/admin/leads" style={{ fontSize: '0.8rem', color: '#c9a96e', textDecoration: 'none' }}>Ver Todos</Link>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                <th style={{ padding: '8px', fontWeight: 500 }}>Status</th>
                                <th style={{ padding: '8px', fontWeight: 500 }}>Tempo</th>
                                <th style={{ padding: '8px', fontWeight: 500 }}>Localização</th>
                                <th style={{ padding: '8px', fontWeight: 500 }}>Origem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentVisitors.map((v, i) => (
                                <tr key={v.id || i} style={{ borderBottom: '1px solid #e5e7eb', fontSize: '0.85rem' }}>
                                    <td style={{ padding: '12px 8px' }}>
                                        {v.is_lead ? (
                                            <span style={{ fontSize: '0.7rem', background: v.is_complete_lead ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: v.is_complete_lead ? '#22c55e' : '#f59e0b', padding: '2px 6px', borderRadius: '4px', border: `1px solid ${v.is_complete_lead ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)'}` }}>
                                                {v.is_complete_lead ? 'Lead Completo' : 'Lead Parcial'} ({v.funnel_stage})
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
                                    <td style={{ padding: '12px 8px', color: 'var(--text-primary)' }}>
                                        {new Date(v.last_visit_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td style={{ padding: '12px 8px', color: '#888' }}>
                                        {[safeDecode(v.city), safeDecode(v.region), v.country].filter(Boolean).join(', ') || '—'}
                                    </td>
                                    <td style={{ padding: '12px 8px', fontWeight: 500, color: 'var(--text-primary)' }}>
                                        {v.detected_source}
                                    </td>
                                </tr>
                            ))}
                            {recentVisitors.length === 0 && (
                                <tr>
                                    <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#666' }}>Nenhum acesso recente</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <style jsx global>{`
                .ads-date-input {
                    background: transparent;
                    border: none;
                    color: var(--text-primary);
                    font-size: 0.85rem;
                    outline: none;
                }
                .ads-date-input::-webkit-calendar-picker-indicator {
                    filter: none;
                    cursor: pointer;
                }
                @media (max-width: 768px) {
                    .admin-content .marketing-subtitle {
                        font-size: 0.78rem !important;
                        line-height: 1.2;
                        margin-top: 3px !important;
                    }
                    .admin-content .marketing-traffic-header {
                        align-items: flex-start !important;
                        gap: 6px !important;
                        margin-bottom: 10px !important;
                    }
                    .admin-content .marketing-traffic-title {
                        gap: 6px !important;
                        min-width: 0;
                    }
                    .admin-content .marketing-traffic-title svg {
                        width: 16px;
                        height: 16px;
                        flex: 0 0 auto;
                    }
                    .admin-content .marketing-traffic-title span {
                        font-size: 0.96rem !important;
                        line-height: 1.1;
                    }
                    .admin-content .marketing-period-filter {
                        flex: 0 0 108px;
                    }
                    .admin-content .marketing-period-filter .form-input {
                        min-width: 0 !important;
                        width: 108px;
                        height: 30px;
                        padding: 4px 8px !important;
                        font-size: 0.72rem !important;
                    }
                    .admin-content .marketing-kpi-grid {
                        display: grid !important;
                        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                        gap: 5px !important;
                        margin-bottom: 10px !important;
                    }
                    .admin-content .marketing-kpi-grid .kpi-card {
                        min-height: 48px;
                        padding: 5px 6px !important;
                        border-radius: 10px;
                        display: flex;
                        flex-direction: column;
                        justify-content: flex-start;
                        gap: 2px;
                    }
                    .admin-content .marketing-kpi-grid .kpi-card > svg,
                    .admin-content .marketing-kpi-grid .kpi-card > div:first-child:not(.kpi-label):not(.kpi-value) {
                        width: 12px !important;
                        height: 12px !important;
                        margin-bottom: 1px !important;
                        font-size: 0.72rem !important;
                    }
                    .admin-content .marketing-kpi-grid .kpi-label {
                        font-size: 0.48rem;
                        line-height: 1.05;
                        margin-bottom: 0;
                        letter-spacing: 0.2px;
                        overflow-wrap: anywhere;
                    }
                    .admin-content .marketing-kpi-grid .kpi-value {
                        font-size: clamp(0.72rem, 3vw, 0.94rem);
                        line-height: 1.05;
                        overflow-wrap: anywhere;
                    }
                    .admin-content .marketing-kpi-grid .kpi-card > div:not(.kpi-label):not(.kpi-value) {
                        font-size: 0.5rem !important;
                        margin-top: 0 !important;
                        line-height: 1.1;
                    }
                    .marketing-charts-grid {
                        grid-template-columns: minmax(0, 1fr) !important;
                        gap: 12px !important;
                        margin-bottom: 12px !important;
                    }
                }
            `}</style>
        </div>
    )
}

function formatMetric(value: number) {
    return value.toLocaleString('pt-BR')
}
