'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, Eye, MessageCircle, TrendingUp, UserCheck, Star } from 'lucide-react'
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
    })
    const [sourceData, setSourceData] = useState<SourceData[]>([])
    const [dailyData, setDailyData] = useState<DailyData[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            const supabase = createClient()

            // Fetch visitors count
            const { count: visitorsCount } = await supabase
                .from('visitors')
                .select('*', { count: 'exact', head: true })

            // Fetch leads count
            const { count: leadsCount } = await supabase
                .from('leads')
                .select('*', { count: 'exact', head: true })

            // Fetch VIP leads
            const { count: vipCount } = await supabase
                .from('leads')
                .select('*', { count: 'exact', head: true })
                .eq('is_vip', true)

            // Fetch WhatsApp sent count
            const { count: whatsappCount } = await supabase
                .from('leads')
                .select('*', { count: 'exact', head: true })
                .eq('whatsapp_sent', true)

            // Fetch chat sessions
            const { data: chatData } = await supabase
                .from('chat_history')
                .select('visitor_id')

            const uniqueChatSessions = new Set(chatData?.map(c => c.visitor_id)).size

            // Source distribution
            const { data: sourceRaw } = await supabase
                .from('visitors')
                .select('detected_source')

            const sourceCounts: Record<string, number> = {}
            sourceRaw?.forEach(v => {
                const source = v.detected_source || 'Direct'
                sourceCounts[source] = (sourceCounts[source] || 0) + 1
            })

            const sourceChartData = Object.entries(sourceCounts)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value)

            // Daily visitors/leads (last 7 days)
            const last7Days: DailyData[] = []
            for (let i = 6; i >= 0; i--) {
                const date = new Date()
                date.setDate(date.getDate() - i)
                const dateStr = date.toISOString().split('T')[0]

                const { count: dayVisitors } = await supabase
                    .from('visitors')
                    .select('*', { count: 'exact', head: true })
                    .gte('first_visit_at', `${dateStr}T00:00:00`)
                    .lt('first_visit_at', `${dateStr}T23:59:59`)

                const { count: dayLeads } = await supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .gte('created_at', `${dateStr}T00:00:00`)
                    .lt('created_at', `${dateStr}T23:59:59`)

                last7Days.push({
                    date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                    visitors: dayVisitors || 0,
                    leads: dayLeads || 0,
                })
            }

            const total = visitorsCount || 0
            const leads = leadsCount || 0

            setStats({
                totalVisitors: total,
                totalLeads: leads,
                conversionRate: total > 0 ? parseFloat(((leads / total) * 100).toFixed(1)) : 0,
                vipLeads: vipCount || 0,
                chatSessions: uniqueChatSessions,
                whatsappSent: whatsappCount || 0,
            })
            setSourceData(sourceChartData)
            setDailyData(last7Days)
            setLoading(false)
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
