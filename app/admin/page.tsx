'use client'

import { useEffect, useState } from 'react'

import { Users, Eye, MessageCircle, TrendingUp, UserCheck, Star, Wand2, ShieldCheck } from 'lucide-react'
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
    totalLeads: number
    conversionRate: number
    vipLeads: number
    chatSessions: number
    whatsappSent: number
    pushSubscribers: number
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

const PIE_COLORS = ['#c9a96e', '#dfc18e', '#a88b4a', '#8B7355', '#D4AF37', '#FFD700', '#B8860B', '#CD853F']

export default function AdminDashboard() {
    const [stats, setStats] = useState<DashboardStats>({
        totalVisitors: 0,
        totalLeads: 0,
        conversionRate: 0,
        vipLeads: 0,
        chatSessions: 0,
        whatsappSent: 0,
        pushSubscribers: 0,
    })
    const [sourceData, setSourceData] = useState<SourceData[]>([])
    const [dailyData, setDailyData] = useState<DailyData[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/admin/analytics')
                const data = await res.json()

                if (data.error) throw new Error(data.error)

                setStats(data.stats)
                setSourceData(data.sourceData)

                // Ensure dates are formatted correctly if needed, broadly simpler than client-side calc
                setDailyData(data.dailyData.map((d: any) => ({
                    ...d,
                    // Format date if API sends ISO string or ensure consistent format
                    date: d.date
                })).reverse()) // API returns last 7 days descending (loop 6 to 0), but chart commonly likes ascending. 
                // Wait, my API loop was: for (let i = 6; i >= 0; i--) -> 6 days ago, 5 days ago... today.
                // So the array order is [T-6, T-5, ..., Today]. This is Ascending order.
                // Recharts expects Ascending for X-Axis (Left to Right).
                // My API code:
                // for (let i = 6; i >= 0; i--) { push(...) }
                // i=6 (6 days ago) -> push
                // i=0 (today) -> push
                // So API returns Ascending. 
                // No need to reverse.
                setDailyData(data.dailyData)

            } catch (error) {
                console.error('Error loading dashboard:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
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

    return (
        <div>
            <div className="admin-header">
                <h1>Dashboard</h1>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <Link href="/admin/cloner" style={{ textDecoration: 'none' }}>
                    <div className="chart-card" style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '24px',
                        background: 'linear-gradient(135deg, rgba(201, 169, 110, 0.1) 0%, rgba(201, 169, 110, 0.05) 100%)',
                        border: '1px solid var(--gold)',
                        cursor: 'pointer',
                        transition: 'transform 0.2s',
                        height: '100%'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                background: 'var(--gold)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Wand2 size={24} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--gold)' }}>Clonador de Páginas AI</h3>
                                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Crie landing pages em segundos.</p>
                            </div>
                        </div>
                    </div>
                </Link>

                <Link href="/admin/brokers" style={{ textDecoration: 'none' }}>
                    <div className="chart-card" style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '24px',
                        background: 'linear-gradient(135deg, rgba(201, 169, 110, 0.1) 0%, rgba(201, 169, 110, 0.05) 100%)',
                        border: '1px solid var(--gold)',
                        cursor: 'pointer',
                        transition: 'transform 0.2s',
                        height: '100%'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                background: 'var(--gold)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <ShieldCheck size={24} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--gold)' }}>Corretores de Plantão</h3>
                                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Gerencie perfis e fotos do chat público.</p>
                            </div>
                        </div>
                    </div>
                </Link>
            </div>

            {/* KPI Cards */}
            <div className="kpi-grid">
                <div className="kpi-card">
                    <Eye size={20} color="#c9a96e" style={{ marginBottom: 8 }} />
                    <div className="kpi-label">Visitantes</div>
                    <div className="kpi-value">{stats.totalVisitors.toLocaleString()}</div>
                </div>
                <div className="kpi-card">
                    <Users size={20} color="#c9a96e" style={{ marginBottom: 8 }} />
                    <div className="kpi-label">Leads Capturados</div>
                    <div className="kpi-value">{stats.totalLeads.toLocaleString()}</div>
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

            {/* Source Bar Chart */}
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
                        />
                        <Bar dataKey="value" fill="#c9a96e" radius={[4, 4, 0, 0]} name="Visitantes" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
