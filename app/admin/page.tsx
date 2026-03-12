'use client'

import { useEffect, useState } from 'react'

import { Users, Eye, MessageCircle, TrendingUp, UserCheck, Star, Brain, DollarSign, Target, Thermometer, Megaphone } from 'lucide-react'
import Link from 'next/link'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
    Legend,
} from 'recharts'

interface DashboardStats {
    totalVisitors: number
    completeLeads: number
    partialLeads: number
    totalLeads: number
    conversionRate: number
    vipLeads: number
    chatSessions: number
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

const PIE_COLORS = ['#c9a96e', '#dfc18e', '#a88b4a', '#8B7355', '#D4AF37', '#FFD700', '#B8860B', '#CD853F']

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
        chatSessions: 0,
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

        const fetchReport = async () => {
            try {
                // Fetch per-platform reports
                const [metaRes, googleRes] = await Promise.all([
                    fetch('/api/admin/reports/latest?platform=meta'),
                    fetch('/api/admin/reports/latest?platform=google'),
                ])
                if (metaRes.ok) {
                    const d = await metaRes.json()
                    if (d.report) setMetaReport(d.report)
                }
                if (googleRes.ok) {
                    const d = await googleRes.json()
                    if (d.report) setGoogleReport(d.report)
                }
            } catch (err) {
                console.error('Error fetching report', err)
            }
        }

        const fetchAdMetrics = async () => {
            try {
                const [metaRes, googleRes] = await Promise.all([
                    fetch('/api/admin/ads?date_preset=today'),
                    fetch('/api/admin/ads/google?date_preset=today'),
                ])
                let allCampaigns: any[] = []
                if (metaRes.ok) {
                    const data = await metaRes.json()
                    allCampaigns = allCampaigns.concat(Array.isArray(data) ? data : [])
                }
                if (googleRes.ok) {
                    const data = await googleRes.json()
                    allCampaigns = allCampaigns.concat(Array.isArray(data) ? data : [])
                }
                const active = allCampaigns.filter(c => c.status === 'active')
                const spend = active.reduce((s: number, c: any) => s + (c.latest_metrics?.spend || 0), 0)
                const leads = active.reduce((s: number, c: any) => s + (c.latest_metrics?.leads_count || 0), 0)
                const cpa = leads > 0 ? spend / leads : 0
                setAdMetrics({ totalSpend: spend, totalLeads: leads, avgCpa: cpa, activeCampaigns: active.length })
            } catch (err) {
                console.error('Error fetching ad metrics', err)
            }
        }

        fetchData()
        fetchReport()
        fetchAdMetrics()
    }, [])

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📊</div>
                    <p>Carregando métricas...</p>
                </div>
            </div>
        )
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

    // General score = average of meta + google scores
    const metaScore = metaReport?.performance_score ?? null
    const googleScore = googleReport?.performance_score ?? null
    const generalScore = metaScore != null && googleScore != null
        ? Math.round((metaScore + googleScore) / 2)
        : metaScore ?? googleScore ?? null

    return (
        <div>
            <div className="admin-header">
                <h1>Painel do CEO</h1>
                <p style={{ color: 'var(--text-muted)' }}>"Olho de Deus" - Monitoramento Proativo</p>
            </div>

            {/* ═══ Combined Traffic KPIs + General Thermometer ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: generalScore != null ? '1fr 200px' : '1fr', gap: 24, marginBottom: 32 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <Megaphone size={22} color="var(--gold)" />
                        <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Tráfego Pago — Visão Geral</span>
                    </div>
                    <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 0 }}>
                        <div className="kpi-card">
                            <DollarSign size={20} color="#22c55e" style={{ marginBottom: 8 }} />
                            <div className="kpi-label">Gasto Total Hoje</div>
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
                    </div>
                </div>

                {/* General Thermometer */}
                {generalScore != null && (
                    <div className="chart-card" style={{ textAlign: 'center', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <Thermometer size={22} color={getScoreColor(generalScore)} style={{ marginBottom: 8 }} />
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, marginBottom: 6 }}>Termômetro Geral</div>
                        <div style={{ position: 'relative', width: 90, height: 90, marginBottom: 8 }}>
                            <svg viewBox="0 0 90 90" width="90" height="90">
                                <circle cx="45" cy="45" r="38" fill="none" stroke="var(--border-color)" strokeWidth="8" />
                                <circle cx="45" cy="45" r="38" fill="none" stroke={getScoreColor(generalScore)} strokeWidth="8"
                                    strokeDasharray={`${(generalScore / 100) * 238.8} 238.8`}
                                    strokeLinecap="round" transform="rotate(-90 45 45)"
                                    style={{ transition: 'stroke-dasharray 1s ease-out' }} />
                            </svg>
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: getScoreColor(generalScore), fontFamily: 'Playfair Display, serif' }}>{generalScore}</span>
                            </div>
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: getScoreColor(generalScore) }}>
                            {getScoreEmoji(generalScore)} {getScoreLabel(generalScore)}
                        </span>
                        {metaScore != null && googleScore != null && (
                            <div style={{ marginTop: 8, fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                Meta: {metaScore} | Google: {googleScore}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ═══ Side-by-Side Platform Reports ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: metaReport || googleReport ? '1fr 1fr' : '1fr', gap: 24, marginBottom: 32 }}>
                {/* Meta Report */}
                {metaReport ? (
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, boxShadow: 'var(--shadow-gold)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                            <Brain color="var(--gold)" size={24} />
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'Playfair Display, serif' }}>
                                {metaReport.type === 'daily' ? '📋 Meta Ads' : '🔭 Meta Ads'}
                            </h3>
                            {metaReport.performance_score != null && (
                                <span style={{ fontSize: '0.7rem', padding: '3px 10px', borderRadius: 20, fontWeight: 700, background: `${getScoreColor(metaReport.performance_score)}15`, color: getScoreColor(metaReport.performance_score) }}>
                                    {getScoreEmoji(metaReport.performance_score)} {metaReport.performance_score}/100
                                </span>
                            )}
                            <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {new Date(metaReport.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.9rem', maxHeight: 400, overflowY: 'auto' }}
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(metaReport.content_markdown || '') }} />
                    </div>
                ) : !googleReport && (
                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, gridColumn: '1 / -1' }}>
                        <Brain color="var(--gold)" size={18} style={{ opacity: 0.6 }} />
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Pilger AI — Relatórios automáticos: <strong style={{ color: 'var(--gold)' }}>Diário</strong> às 23h | <strong style={{ color: '#2563eb' }}>Semanal</strong> às Seg 06h
                        </span>
                    </div>
                )}

                {/* Google Report */}
                {googleReport && (
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                            <Brain color="#4285F4" size={24} />
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'Playfair Display, serif' }}>
                                {googleReport.type === 'daily' ? '📋 Google Ads' : '🔭 Google Ads'}
                            </h3>
                            {googleReport.performance_score != null && (
                                <span style={{ fontSize: '0.7rem', padding: '3px 10px', borderRadius: 20, fontWeight: 700, background: `${getScoreColor(googleReport.performance_score)}15`, color: getScoreColor(googleReport.performance_score) }}>
                                    {getScoreEmoji(googleReport.performance_score)} {googleReport.performance_score}/100
                                </span>
                            )}
                            <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {new Date(googleReport.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.9rem', maxHeight: 400, overflowY: 'auto' }}
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(googleReport.content_markdown || '') }} />
                    </div>
                )}
            </div>



            {/* KPI Cards */}
            <div className="kpi-grid">
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
                    <MessageCircle size={20} color="#c9a96e" style={{ marginBottom: 8 }} />
                    <div className="kpi-label">Sessões de Chat</div>
                    <div className="kpi-value">{stats.chatSessions.toLocaleString()}</div>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                {/* Daily Chart */}
                <div className="chart-card">
                    <div className="chart-title">Visitantes & Leads — Últimos 7 dias</div>
                    <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={dailyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                            <XAxis dataKey="date" stroke="#666" fontSize={12} />
                            <YAxis stroke="#666" fontSize={12} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                                labelStyle={{ color: '#f5f5f5' }}
                                itemStyle={{ color: '#f5f5f5' }}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="visitors" stroke="#c9a96e" strokeWidth={2} name="Visitantes" dot={{ r: 4 }} />
                            <Line type="monotone" dataKey="leads" stroke="#4ade80" strokeWidth={2} name="Leads" dot={{ r: 4 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Source Pie Chart */}
                <div className="chart-card">
                    <div className="chart-title">Origens de Tráfego</div>
                    {sourceData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie
                                    data={sourceData}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    dataKey="value"
                                    label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                                    labelLine={{ stroke: '#666' }}
                                >
                                    {sourceData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                                    itemStyle={{ color: '#f5f5f5' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280, color: 'var(--text-muted)' }}>
                            Nenhum dado disponível
                        </div>
                    )}
                </div>
            </div>

            {/* Source Bar Chart & Top Pages Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <div className="chart-card">
                    <div className="chart-title">Visitantes por Fonte</div>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={sourceData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                            <XAxis dataKey="name" stroke="#666" fontSize={12} />
                            <YAxis stroke="#666" fontSize={12} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                                labelStyle={{ color: '#f5f5f5' }}
                                itemStyle={{ color: '#f5f5f5' }}
                            />
                            <Bar dataKey="value" fill="#c9a96e" radius={[4, 4, 0, 0]} name="Visitantes" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-card">
                    <div className="chart-title">Páginas Mais Visitadas (Top 10)</div>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={topPages} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                            <XAxis type="number" stroke="#666" fontSize={12} />
                            <YAxis dataKey="name" type="category" stroke="#666" fontSize={10} width={120} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px' }}
                                labelStyle={{ color: '#f5f5f5' }}
                                itemStyle={{ color: '#f5f5f5' }}
                            />
                            <Bar dataKey="value" fill="#4ade80" radius={[0, 4, 4, 0]} name="Acessos" />
                        </BarChart>
                    </ResponsiveContainer>
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
                            <tr style={{ borderBottom: '1px solid #2a2a2a', color: '#666', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                                <th style={{ padding: '8px', fontWeight: 500 }}>Status</th>
                                <th style={{ padding: '8px', fontWeight: 500 }}>Tempo</th>
                                <th style={{ padding: '8px', fontWeight: 500 }}>Localização</th>
                                <th style={{ padding: '8px', fontWeight: 500 }}>Origem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentVisitors.map((v, i) => (
                                <tr key={v.id || i} style={{ borderBottom: '1px solid #2a2a2a', fontSize: '0.85rem' }}>
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
                                    <td style={{ padding: '12px 8px', color: '#f5f5f5' }}>
                                        {new Date(v.last_visit_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td style={{ padding: '12px 8px', color: '#888' }}>
                                        {[safeDecode(v.city), safeDecode(v.region), v.country].filter(Boolean).join(', ') || '—'}
                                    </td>
                                    <td style={{ padding: '12px 8px', fontWeight: 500, color: '#f5f5f5' }}>
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
        </div>
    )
}
