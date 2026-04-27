'use client'

import { useEffect, useMemo, useState } from 'react'
import {
    Bell,
    CircleDollarSign,
    Megaphone,
    Smartphone,
    TrendingUp,
    UserCheck,
} from 'lucide-react'
import {
    SimpleDonutChart,
    SimpleLineChart,
} from '@/components/admin/SimpleCharts'

type EntryType = 'income' | 'expense'

interface MarketingStats {
    totalVisitors: number
    totalLeads: number
    conversionRate: number
    vipLeads: number
    whatsappConversations: number
}

interface FinanceEntry {
    id: string
    entry_type: EntryType
    amount: number
    category: string | null
    entry_date: string
}

interface EcosystemStats {
    brokersTotal: number
    brokersActive: number
    whatsappInstancesTotal: number
    whatsappConnected: number
    pushTotal: number
    pushActive: number
    adsCampaignsTotal: number
    adsCampaignsActive: number
    adsSpend30d: number
}

const CHART_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6']

function formatCurrency(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatMonthLabel(month: string) {
    if (!month || month.length < 7) return month
    return `${month.slice(5, 7)}/${month.slice(2, 4)}`
}

export default function AdminOverviewPage() {
    const [loading, setLoading] = useState(true)
    const [marketingStats, setMarketingStats] = useState<MarketingStats>({
        totalVisitors: 0,
        totalLeads: 0,
        conversionRate: 0,
        vipLeads: 0,
        whatsappConversations: 0,
    })
    const [financeEntries, setFinanceEntries] = useState<FinanceEntry[]>([])
    const [propertiesCount, setPropertiesCount] = useState(0)
    const [ecosystemStats, setEcosystemStats] = useState<EcosystemStats>({
        brokersTotal: 0,
        brokersActive: 0,
        whatsappInstancesTotal: 0,
        whatsappConnected: 0,
        pushTotal: 0,
        pushActive: 0,
        adsCampaignsTotal: 0,
        adsCampaignsActive: 0,
        adsSpend30d: 0,
    })

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [analyticsRes, financeRes, propertiesRes, brokersRes, whatsappRes, pushRes, metaAdsRes, googleAdsRes] = await Promise.all([
                    fetch('/api/admin/analytics'),
                    fetch('/api/admin/finance?limit=2000'),
                    fetch('/api/admin/properties'),
                    fetch('/api/admin/brokers'),
                    fetch('/api/admin/whatsapp/instances'),
                    fetch('/api/admin/push/stats'),
                    fetch('/api/admin/ads?date_preset=this_month'),
                    fetch('/api/admin/ads/google?date_preset=this_month'),
                ])

                if (analyticsRes.ok) {
                    const analyticsData = await analyticsRes.json()
                    const stats = analyticsData?.stats || {}
                    setMarketingStats({
                        totalVisitors: Number(stats.totalVisitors || 0),
                        totalLeads: Number(stats.totalLeads || 0),
                        conversionRate: Number(stats.conversionRate || 0),
                        vipLeads: Number(stats.vipLeads || 0),
                        whatsappConversations: Number(stats.whatsappConversations || 0),
                    })
                }

                if (financeRes.ok) {
                    const financeData = await financeRes.json()
                    const entries = Array.isArray(financeData?.entries) ? financeData.entries : []
                    setFinanceEntries(entries)
                }

                if (propertiesRes.ok) {
                    const propertiesData = await propertiesRes.json()
                    setPropertiesCount(Array.isArray(propertiesData) ? propertiesData.length : 0)
                }

                const parseCampaigns = (raw: any): any[] => {
                    if (Array.isArray(raw)) return raw
                    if (Array.isArray(raw?.campaigns)) return raw.campaigns
                    return []
                }

                const brokersData = brokersRes.ok ? await brokersRes.json() : null
                const brokers = Array.isArray(brokersData?.data) ? brokersData.data : []

                const whatsappData = whatsappRes.ok ? await whatsappRes.json() : null
                const instances = Array.isArray(whatsappData?.instances) ? whatsappData.instances : []

                const pushData = pushRes.ok ? await pushRes.json() : null

                const metaAdsData = metaAdsRes.ok ? await metaAdsRes.json() : null
                const googleAdsData = googleAdsRes.ok ? await googleAdsRes.json() : null
                const allCampaigns = [...parseCampaigns(metaAdsData), ...parseCampaigns(googleAdsData)]

                setEcosystemStats({
                    brokersTotal: brokers.length,
                    brokersActive: brokers.filter((broker: any) => broker?.is_active === true).length,
                    whatsappInstancesTotal: instances.length,
                    whatsappConnected: instances.filter((instance: any) => instance?.status === 'connected').length,
                    pushTotal: Number(pushData?.total || 0),
                    pushActive: Number(pushData?.active || 0),
                    adsCampaignsTotal: allCampaigns.length,
                    adsCampaignsActive: allCampaigns.filter((campaign: any) => campaign?.status === 'active').length,
                    adsSpend30d: allCampaigns.reduce((sum: number, campaign: any) => sum + Number(campaign?.latest_metrics?.spend || 0), 0),
                })
            } catch (error) {
                console.error('[admin overview] error loading data', error)
            } finally {
                setLoading(false)
            }
        }

        fetchAll()
    }, [])

    const financeSummary = useMemo(() => {
        let income = 0
        let expense = 0

        for (const entry of financeEntries) {
            const amount = Number(entry.amount || 0)
            if (entry.entry_type === 'income') income += amount
            else expense += amount
        }

        return {
            income,
            expense,
            balance: income - expense,
            totalEntries: financeEntries.length,
        }
    }, [financeEntries])

    const expenseByCategory = useMemo(() => {
        const map = new Map<string, number>()
        for (const entry of financeEntries) {
            if (entry.entry_type !== 'expense') continue
            const key = String(entry.category || '').trim() || 'Sem categoria'
            map.set(key, (map.get(key) || 0) + Number(entry.amount || 0))
        }

        return Array.from(map.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 7)
    }, [financeEntries])

    const monthlyFinance = useMemo(() => {
        const map = new Map<string, { month: string; income: number; expense: number }>()

        for (const entry of financeEntries) {
            const month = String(entry.entry_date || '').slice(0, 7)
            if (!month) continue

            const row = map.get(month) || { month, income: 0, expense: 0 }
            const amount = Number(entry.amount || 0)

            if (entry.entry_type === 'income') row.income += amount
            else row.expense += amount

            map.set(month, row)
        }

        return Array.from(map.values())
            .sort((a, b) => a.month.localeCompare(b.month))
            .map(item => ({ ...item, label: formatMonthLabel(item.month) }))
    }, [financeEntries])

    const monthlyFinanceChart = useMemo(() => monthlyFinance.slice(-12), [monthlyFinance])

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', color: 'var(--text-muted)' }}>
                Carregando dashboard geral...
            </div>
        )
    }

    return (
        <div>
            <div className="admin-header">
                <h1>Dashboard Geral</h1>
                <p style={{ color: 'var(--text-muted)' }}>Visao consolidada do sistema (periodo completo)</p>
            </div>

            <div className="kpi-grid overview-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 24 }}>
                <div className="kpi-card">
                    <div className="kpi-label">Visitantes totais</div>
                    <div className="kpi-value">{marketingStats.totalVisitors.toLocaleString('pt-BR')}</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Leads totais</div>
                    <div className="kpi-value">{marketingStats.totalLeads.toLocaleString('pt-BR')}</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Taxa de conversao</div>
                    <div className="kpi-value">{marketingStats.conversionRate.toFixed(1)}%</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Imoveis cadastrados</div>
                    <div className="kpi-value">{propertiesCount.toLocaleString('pt-BR')}</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Lancamentos financeiros</div>
                    <div className="kpi-value">{financeSummary.totalEntries.toLocaleString('pt-BR')}</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Receitas</div>
                    <div className="kpi-value" style={{ color: '#22c55e' }}>{formatCurrency(financeSummary.income)}</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Despesas</div>
                    <div className="kpi-value" style={{ color: '#ef4444' }}>{formatCurrency(financeSummary.expense)}</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Saldo</div>
                    <div className="kpi-value" style={{ color: financeSummary.balance >= 0 ? '#22c55e' : '#ef4444' }}>
                        {formatCurrency(financeSummary.balance)}
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Leads VIP</div>
                    <div className="kpi-value">{marketingStats.vipLeads.toLocaleString('pt-BR')}</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Conversas WhatsApp</div>
                    <div className="kpi-value">{marketingStats.whatsappConversations.toLocaleString('pt-BR')}</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <UserCheck size={14} /> Corretores IA
                    </div>
                    <div className="kpi-value">{ecosystemStats.brokersActive}/{ecosystemStats.brokersTotal}</div>
                    <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>ativos / total</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Smartphone size={14} /> WhatsApp Instancias
                    </div>
                    <div className="kpi-value">{ecosystemStats.whatsappConnected}/{ecosystemStats.whatsappInstancesTotal}</div>
                    <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>conectadas / total</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Bell size={14} /> Push Web
                    </div>
                    <div className="kpi-value">{ecosystemStats.pushActive}/{ecosystemStats.pushTotal}</div>
                    <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>ativos / total</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Megaphone size={14} /> Campanhas Trafego
                    </div>
                    <div className="kpi-value">{ecosystemStats.adsCampaignsActive}/{ecosystemStats.adsCampaignsTotal}</div>
                    <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>ativas / total no mes</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Gasto Trafego (mes)</div>
                    <div className="kpi-value" style={{ color: '#ef4444' }}>
                        {formatCurrency(ecosystemStats.adsSpend30d)}
                    </div>
                </div>
            </div>

            <div className="overview-charts-grid">
                <div className="chart-card">
                    <div className="chart-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <TrendingUp size={18} /> Evolucao financeira mensal
                    </div>
                    <SimpleLineChart
                        data={monthlyFinanceChart}
                        series={[
                            { key: 'expense', name: 'Despesas', color: '#ef4444' },
                            { key: 'income', name: 'Receitas', color: '#22c55e' },
                        ]}
                    />
                </div>

                <div className="chart-card">
                    <div className="chart-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CircleDollarSign size={18} /> Despesas por categoria
                    </div>
                    <SimpleDonutChart data={expenseByCategory} colors={CHART_COLORS} />
                </div>
            </div>

            <style>{`
                @media (max-width: 768px) {
                    .overview-kpi-grid {
                        display: grid !important;
                        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                        gap: 5px !important;
                        margin-bottom: 10px !important;
                    }

                    .overview-kpi-grid .kpi-card {
                        min-height: 48px;
                        padding: 5px 6px !important;
                        border-radius: 10px;
                        display: flex;
                        flex-direction: column;
                        justify-content: flex-start;
                        gap: 2px;
                    }

                    .overview-kpi-grid .kpi-label {
                        font-size: 0.48rem;
                        line-height: 1.05;
                        margin-bottom: 0;
                        letter-spacing: 0.2px;
                        gap: 3px !important;
                        overflow-wrap: anywhere;
                    }

                    .overview-kpi-grid .kpi-label svg {
                        width: 10px;
                        height: 10px;
                        flex: 0 0 auto;
                    }

                    .overview-kpi-grid .kpi-value {
                        font-size: clamp(0.72rem, 3vw, 0.94rem);
                        line-height: 1.05;
                        text-align: left;
                        overflow-wrap: anywhere;
                    }

                    .overview-kpi-grid .kpi-change {
                        font-size: 0.5rem;
                        margin-top: 0;
                        line-height: 1.1;
                        overflow-wrap: anywhere;
                    }

                    .overview-charts-grid {
                        display: grid;
                        grid-template-columns: minmax(0, 1fr);
                        gap: 12px;
                        min-width: 0;
                    }

                    .overview-chart-box {
                        width: 100%;
                        min-width: 0;
                        height: 280px;
                    }

                    .overview-chart-box .recharts-legend-wrapper {
                        font-size: 0.72rem;
                    }
                }

                @media (min-width: 769px) {
                    .overview-charts-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
                        gap: 18px;
                    }

                    .overview-chart-box {
                        width: 100%;
                        height: 280px;
                    }
                }
            `}</style>
        </div>
    )
}
