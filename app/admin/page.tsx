'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
    Bell,
    Building2,
    CircleDollarSign,
    ClipboardCheck,
    MapPin,
    Megaphone,
    ShieldCheck,
    Smartphone,
    Target,
    TrendingUp,
    UserCheck,
    Users,
    Workflow,
} from 'lucide-react'
import {
    SimpleDonutChart,
    SimpleBarChart,
    SimpleLineChart,
} from '@/components/admin/SimpleCharts'
import AdminLoadingState from '@/components/admin/AdminLoadingState'

const DashboardLeadMap = dynamic(() => import('@/components/admin/DashboardLeadMap'), {
    ssr: false,
    loading: () => <div className="dashboard-real-map dashboard-real-map-loading">Carregando mapa...</div>,
})

type EntryType = 'income' | 'expense'

interface MarketingStats {
    totalVisitors: number
    totalLeads: number
    conversionRate: number
    vipLeads: number
    whatsappConversations: number
    gpsLocationGranted: number
    gpsLocationDenied: number
    gpsLocationUnavailable: number
    gpsLocationDismissed: number
    gpsLocationRequested: number
    gpsLocationAcceptanceRate: number
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

interface PropertyStats {
    total: number
    active: number
    underReview: number
    incomplete: number
}

interface FunnelStep {
    key: string
    label: string
    count: number
    percentage: number
    color: string
}

interface Visitor {
    id?: string
    city?: string | null
    region?: string | null
    country?: string | null
    detected_source?: string | null
    funnel_stage?: string | null
    is_lead?: boolean
    is_complete_lead?: boolean
    page_views?: number | null
    max_scroll?: number | null
    ip_address?: string | null
    user_agent?: string | null
    device_type?: string | null
    browser?: string | null
    os?: string | null
    utm_source?: string | null
    utm_medium?: string | null
    utm_campaign?: string | null
    referrer?: string | null
    last_visit_at?: string | null
}

interface LeadLocation {
    id?: string
    name: string
    subtitle: string
    total: number
    leads: number
    qualified: number
    source: string
    ip_address?: string | null
    user_agent?: string | null
    device_type?: string | null
    browser?: string | null
    os?: string | null
    utm_source?: string | null
    utm_medium?: string | null
    utm_campaign?: string | null
    referrer?: string | null
    funnel_stage?: string | null
    max_scroll?: number | null
    page_views?: number | null
    last_visit_at?: string | null
    is_lead?: boolean
}

const CHART_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6']
const FUNNEL_COLORS = ['#c9a96e', '#3b82f6', '#14b8a6', '#22c55e', '#8b5cf6', '#f97316', '#ef4444']

function formatCurrency(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatMonthLabel(month: string) {
    if (!month || month.length < 7) return month
    return `${month.slice(5, 7)}/${month.slice(2, 4)}`
}

function formatDateLabel(date: string) {
    if (!date || date.length < 10) return date
    return `${date.slice(8, 10)}/${date.slice(5, 7)}`
}

function safeLocationLabel(value: unknown, fallback: string) {
    const text = String(value || '').trim()
    if (!text || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') return fallback
    try {
        return decodeURIComponent(text)
    } catch {
        return text
    }
}

function buildFunnelSteps(raw: any): FunnelStep[] {
    const total = Math.max(Number(raw?.pageViews || 0), 1)
    const rows = [
        { key: 'pageViews', label: 'Visitantes', count: Number(raw?.pageViews || 0) },
        { key: 'cookieConsent', label: 'Consentimento', count: Number(raw?.cookieConsent || 0) },
        { key: 'formSubmitted', label: 'Formulario', count: Number(raw?.formSubmitted || 0) },
        { key: 'chatOpened', label: 'Chat aberto', count: Number(raw?.chatOpened || 0) },
        { key: 'messageSent', label: 'Mensagem enviada', count: Number(raw?.messageSent || 0) },
        { key: 'whatsappConversationStarted', label: 'WhatsApp iniciado', count: Number(raw?.whatsappConversationStarted || 0) },
        { key: 'gpsLocationGranted', label: 'GPS autorizado', count: Number(raw?.gpsLocationGranted || 0) },
        { key: 'leadCaptured', label: 'Lead capturado', count: Number(raw?.leadCaptured || 0) },
        { key: 'qualified', label: 'Qualificado', count: Number(raw?.qualified || 0) },
        { key: 'converted', label: 'Convertido', count: Number(raw?.converted || 0) },
    ]

    return rows.map((row, index) => ({
        ...row,
        percentage: Math.min(100, Math.round((row.count / total) * 100)),
        color: FUNNEL_COLORS[index % FUNNEL_COLORS.length],
    }))
}

function summarizeProperties(properties: any[]): PropertyStats {
    return properties.reduce<PropertyStats>((summary, property) => {
        const status = String(property?.status || '').toLowerCase()
        const hasCoreData = Boolean(property?.title && property?.city && property?.price && (property?.image || property?.featured_image || property?.photos?.length))

        summary.total += 1
        if (status === 'active') summary.active += 1
        if (status === 'under_review') summary.underReview += 1
        if (!hasCoreData) summary.incomplete += 1
        return summary
    }, { total: 0, active: 0, underReview: 0, incomplete: 0 })
}

function buildLeadLocations(visitors: Visitor[]): LeadLocation[] {
    return visitors
        .filter(visitor => visitor.city || visitor.region || visitor.country || visitor.ip_address)
        .slice(0, 80)
        .map((visitor, index) => {
        const city = safeLocationLabel(visitor.city, 'Local nao informado')
        const region = safeLocationLabel(visitor.region, '')
        const country = safeLocationLabel(visitor.country, 'Brasil')
        const isLead = Boolean(visitor.is_lead || visitor.is_complete_lead)
        return {
            id: visitor.id || `visitor-${index}`,
            name: city,
            subtitle: [region, country].filter(Boolean).join(', ') || 'Origem sem regiao',
            total: 1,
            leads: isLead ? 1 : 0,
            qualified: String(visitor.funnel_stage || '').toLowerCase().includes('qualified') ? 1 : 0,
            source: safeLocationLabel(visitor.detected_source, 'Direto'),
            ip_address: visitor.ip_address,
            user_agent: visitor.user_agent,
            device_type: visitor.device_type,
            browser: visitor.browser,
            os: visitor.os,
            utm_source: visitor.utm_source,
            utm_medium: visitor.utm_medium,
            utm_campaign: visitor.utm_campaign,
            referrer: visitor.referrer,
            funnel_stage: visitor.funnel_stage,
            max_scroll: visitor.max_scroll,
            page_views: visitor.page_views,
            last_visit_at: visitor.last_visit_at,
            is_lead: isLead,
        }
        })
}

export default function AdminOverviewPage() {
    const [loading, setLoading] = useState(true)
    const [marketingStats, setMarketingStats] = useState<MarketingStats>({
        totalVisitors: 0,
        totalLeads: 0,
        conversionRate: 0,
        vipLeads: 0,
        whatsappConversations: 0,
        gpsLocationGranted: 0,
        gpsLocationDenied: 0,
        gpsLocationUnavailable: 0,
        gpsLocationDismissed: 0,
        gpsLocationRequested: 0,
        gpsLocationAcceptanceRate: 0,
    })
    const [financeEntries, setFinanceEntries] = useState<FinanceEntry[]>([])
    const [propertyStats, setPropertyStats] = useState<PropertyStats>({
        total: 0,
        active: 0,
        underReview: 0,
        incomplete: 0,
    })
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
    const [funnelSteps, setFunnelSteps] = useState<FunnelStep[]>([])
    const [sourceData, setSourceData] = useState<Array<{ name: string; value: number }>>([])
    const [dailyData, setDailyData] = useState<Array<Record<string, string | number>>>([])
    const [visitors, setVisitors] = useState<Visitor[]>([])

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [
                    analyticsRes,
                    financeRes,
                    propertiesRes,
                    brokersRes,
                    whatsappRes,
                    pushRes,
                    metaAdsRes,
                    googleAdsRes,
                    funnelRes,
                    visitorsRes,
                ] = await Promise.all([
                    fetch('/api/admin/analytics'),
                    fetch('/api/admin/finance?limit=2000'),
                    fetch('/api/admin/properties'),
                    fetch('/api/admin/brokers'),
                    fetch('/api/admin/whatsapp/instances'),
                    fetch('/api/admin/push/stats'),
                    fetch('/api/admin/ads?date_preset=this_month'),
                    fetch('/api/admin/ads/google?date_preset=this_month'),
                    fetch('/api/admin/funnel'),
                    fetch('/api/admin/visitors'),
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
                        gpsLocationGranted: Number(stats.gpsLocationGranted || stats.gpsLocation?.granted || 0),
                        gpsLocationDenied: Number(stats.gpsLocationDenied || stats.gpsLocation?.denied || 0),
                        gpsLocationUnavailable: Number(stats.gpsLocationUnavailable || stats.gpsLocation?.unavailable || 0),
                        gpsLocationDismissed: Number(stats.gpsLocationDismissed || stats.gpsLocation?.dismissed || 0),
                        gpsLocationRequested: Number(stats.gpsLocationRequested || stats.gpsLocation?.requested || 0),
                        gpsLocationAcceptanceRate: Number(stats.gpsLocationAcceptanceRate || stats.gpsLocation?.acceptanceRate || 0),
                    })

                    const analyticsSources = Array.isArray(analyticsData?.sourceData) ? analyticsData.sourceData : []
                    setSourceData(analyticsSources.map((item: any) => ({
                        name: safeLocationLabel(item?.name, 'Direto'),
                        value: Number(item?.value || 0),
                    })))

                    const analyticsDaily = Array.isArray(analyticsData?.dailyData) ? analyticsData.dailyData : []
                    setDailyData(analyticsDaily.map((item: any) => ({
                        ...item,
                        visitors: Number(item?.visitors || 0),
                        leads: Number(item?.leads || 0),
                        label: formatDateLabel(String(item?.date || '')),
                    })))
                }

                if (financeRes.ok) {
                    const financeData = await financeRes.json()
                    const entries = Array.isArray(financeData?.entries) ? financeData.entries : []
                    setFinanceEntries(entries)
                }

                if (propertiesRes.ok) {
                    const propertiesData = await propertiesRes.json()
                    const properties = Array.isArray(propertiesData) ? propertiesData : []
                    setPropertyStats(summarizeProperties(properties))
                }

                if (funnelRes.ok) {
                    const funnelData = await funnelRes.json()
                    setFunnelSteps(buildFunnelSteps(funnelData))
                }

                if (visitorsRes.ok) {
                    const visitorsData = await visitorsRes.json()
                    setVisitors(Array.isArray(visitorsData) ? visitorsData : [])
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
    const leadLocations = useMemo(() => buildLeadLocations(visitors), [visitors])
    const mainFunnelTotal = funnelSteps[0]?.count || marketingStats.totalVisitors || 0
    const qualifiedStep = funnelSteps.find(step => step.key === 'qualified')?.count || 0
    const convertedStep = funnelSteps.find(step => step.key === 'converted')?.count || 0

    const sectorCards = useMemo(() => ([
        {
            title: 'Marketing',
            icon: Megaphone,
            color: '#c9a96e',
            primary: marketingStats.totalLeads.toLocaleString('pt-BR'),
            label: 'leads totais',
            detail: `${marketingStats.conversionRate.toFixed(1)}% de conversao`,
        },
        {
            title: 'Comercial',
            icon: Users,
            color: '#22c55e',
            primary: qualifiedStep.toLocaleString('pt-BR'),
            label: 'leads qualificados',
            detail: `${convertedStep.toLocaleString('pt-BR')} convertidos no funil`,
        },
        {
            title: 'Operacoes',
            icon: Building2,
            color: '#3b82f6',
            primary: propertyStats.active.toLocaleString('pt-BR'),
            label: 'imoveis ativos',
            detail: `${propertyStats.underReview} em analise`,
        },
        {
            title: 'Financeiro',
            icon: CircleDollarSign,
            color: financeSummary.balance >= 0 ? '#22c55e' : '#ef4444',
            primary: formatCurrency(financeSummary.balance),
            label: 'saldo consolidado',
            detail: `${financeSummary.totalEntries} lancamentos`,
        },
        {
            title: 'IA e Governanca',
            icon: ShieldCheck,
            color: '#8b5cf6',
            primary: ecosystemStats.brokersActive.toLocaleString('pt-BR'),
            label: 'agentes ativos',
            detail: `${propertyStats.underReview + propertyStats.incomplete} itens para revisar`,
        },
    ]), [convertedStep, ecosystemStats.brokersActive, financeSummary.balance, financeSummary.totalEntries, marketingStats.conversionRate, marketingStats.totalLeads, propertyStats.active, propertyStats.incomplete, propertyStats.underReview, qualifiedStep])

    if (loading) {
        return <AdminLoadingState message="Carregando dashboard geral..." minHeight="50vh" />
    }

    return (
        <div className="admin-overview-page">
            <div className="admin-header overview-hero-header">
                <div>
                    <span className="overview-eyebrow">Pilger AI Command Center</span>
                    <h1>Dashboard Geral</h1>
                    <p>Visao executiva com funil, origem dos leads, operacao, financeiro e governanca dos agentes.</p>
                </div>
                <div className="overview-hero-score">
                    <span>Saude do funil</span>
                    <strong>{mainFunnelTotal > 0 ? Math.round((marketingStats.totalLeads / Math.max(mainFunnelTotal, 1)) * 100) : 0}%</strong>
                    <small>{marketingStats.totalLeads.toLocaleString('pt-BR')} leads gerados</small>
                </div>
            </div>

            <div className="overview-sector-grid">
                {sectorCards.map(card => {
                    const Icon = card.icon
                    return (
                        <div key={card.title} className="overview-sector-card" style={{ borderTopColor: card.color }}>
                            <div className="overview-sector-head">
                                <span style={{ background: `${card.color}22`, color: card.color }}><Icon size={17} /></span>
                                <strong>{card.title}</strong>
                            </div>
                            <div className="overview-sector-value">{card.primary}</div>
                            <div className="overview-sector-label">{card.label}</div>
                            <p>{card.detail}</p>
                        </div>
                    )
                })}
            </div>

            <div className="kpi-grid overview-kpi-grid overview-kpi-grid-compact">
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
                    <div className="kpi-value">{propertyStats.total.toLocaleString('pt-BR')}</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Em analise</div>
                    <div className="kpi-value" style={{ color: '#c9a96e' }}>{propertyStats.underReview.toLocaleString('pt-BR')}</div>
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
                        <Smartphone size={14} /> WhatsApp
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
                        <MapPin size={14} /> GPS autorizado
                    </div>
                    <div className="kpi-value">{marketingStats.gpsLocationGranted.toLocaleString('pt-BR')}</div>
                    <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>
                        {marketingStats.gpsLocationAcceptanceRate.toFixed(1)}% de aceite
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">GPS recusado/ignorado</div>
                    <div className="kpi-value" style={{ color: '#f59e0b' }}>
                        {(marketingStats.gpsLocationDenied + marketingStats.gpsLocationDismissed + marketingStats.gpsLocationUnavailable).toLocaleString('pt-BR')}
                    </div>
                    <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>
                        {marketingStats.gpsLocationRequested.toLocaleString('pt-BR')} solicitações registradas
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Megaphone size={14} /> Trafego
                    </div>
                    <div className="kpi-value">{ecosystemStats.adsCampaignsActive}/{ecosystemStats.adsCampaignsTotal}</div>
                    <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>ativas / total no mes</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Gasto Trafego</div>
                    <div className="kpi-value" style={{ color: '#ef4444' }}>
                        {formatCurrency(ecosystemStats.adsSpend30d)}
                    </div>
                </div>
            </div>

            <div className="overview-command-grid">
                <div className="chart-card overview-funnel-card">
                    <div className="overview-panel-title">
                        <div>
                            <span>Conversao integrada</span>
                            <h2><Workflow size={18} /> Funil geral</h2>
                        </div>
                        <strong>{mainFunnelTotal.toLocaleString('pt-BR')} visitas</strong>
                    </div>
                    <div className="overview-funnel-list overview-funnel-pyramid">
                        {funnelSteps.map((step, index) => {
                            const previous = funnelSteps[index - 1]?.count || step.count
                            const stepRate = previous > 0 ? Math.round((step.count / previous) * 100) : 0
                            return (
                                <div key={step.key} className="overview-funnel-row">
                                    <div className="overview-funnel-meta">
                                        <strong>{step.label}</strong>
                                        <span>{step.count.toLocaleString('pt-BR')} registros</span>
                                    </div>
                                    <div className="overview-funnel-track">
                                        <i style={{ width: `${Math.max(step.percentage, step.count > 0 ? 6 : 0)}%`, background: step.color }} />
                                    </div>
                                    <div className="overview-funnel-rate">
                                        <strong>{step.percentage}%</strong>
                                        <small>{index === 0 ? 'base' : `${stepRate}% etapa`}</small>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="chart-card overview-map-card">
                    <div className="overview-panel-title">
                        <div>
                            <span>Localizacao dos leads</span>
                            <h2><MapPin size={18} /> Mapa de demanda</h2>
                        </div>
                        <strong>{leadLocations.length} regioes</strong>
                    </div>
                    <DashboardLeadMap locations={leadLocations} title="Mapa real de visitantes e leads" />
                    <div className="overview-location-list">
                        {leadLocations.map((location, index) => (
                            <div key={location.id || `${location.name}-${location.subtitle}-${index}`} className="overview-location-item">
                                <div>
                                    <strong>{location.name}</strong>
                                    <span>{location.subtitle}</span>
                                </div>
                                <div>
                                    <strong>{location.total}</strong>
                                    <span>{location.source}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="overview-charts-grid">
                <div className="chart-card">
                    <div className="chart-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Target size={18} /> Visitantes e leads
                    </div>
                    <SimpleLineChart
                        data={dailyData}
                        series={[
                            { key: 'visitors', name: 'Visitantes', color: '#3b82f6' },
                            { key: 'leads', name: 'Leads', color: '#c9a96e' },
                        ]}
                    />
                </div>

                <div className="chart-card">
                    <div className="chart-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Megaphone size={18} /> Origem dos acessos
                    </div>
                    <SimpleDonutChart data={sourceData} colors={CHART_COLORS} />
                </div>

                <div className="chart-card">
                    <div className="chart-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Users size={18} /> Canais de aquisicao
                    </div>
                    <SimpleBarChart data={sourceData.slice(0, 7)} color="#3b82f6" name="Visitantes" layout="horizontal" />
                </div>

                <div className="chart-card">
                    <div className="chart-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <TrendingUp size={18} /> Evolucao financeira mensal
                    </div>
                    <SimpleLineChart
                        data={monthlyFinanceChart}
                        valueFormatter={formatCurrency}
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

            <div className="overview-action-grid">
                <div className="chart-card overview-action-card">
                    <div className="overview-action-icon"><ClipboardCheck size={18} /></div>
                    <div>
                        <strong>{propertyStats.underReview}</strong>
                        <span>imoveis aguardando aprovacao</span>
                    </div>
                    <Link href="/admin/properties">Revisar</Link>
                </div>
                <div className="chart-card overview-action-card">
                    <div className="overview-action-icon"><Building2 size={18} /></div>
                    <div>
                        <strong>{propertyStats.incomplete}</strong>
                        <span>cadastros com dados incompletos</span>
                    </div>
                    <Link href="/admin/properties">Completar</Link>
                </div>
                <div className="chart-card overview-action-card">
                    <div className="overview-action-icon"><Megaphone size={18} /></div>
                    <div>
                        <strong>{formatCurrency(ecosystemStats.adsSpend30d)}</strong>
                        <span>investimento de trafego no mes</span>
                    </div>
                    <Link href="/admin/ads">Ver midia</Link>
                </div>
            </div>
        </div>
    )
}
