'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
    Activity,
    ArrowRight,
    BarChart3,
    Bell,
    Building2,
    CircleDollarSign,
    ClipboardCheck,
    Gauge,
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

    const funnelHealth = mainFunnelTotal > 0 ? Math.round((marketingStats.totalLeads / Math.max(mainFunnelTotal, 1)) * 100) : 0
    const activeCampaignRate = ecosystemStats.adsCampaignsTotal > 0 ? Math.round((ecosystemStats.adsCampaignsActive / ecosystemStats.adsCampaignsTotal) * 100) : 0
    const automationHealth = ecosystemStats.whatsappInstancesTotal > 0 ? Math.round((ecosystemStats.whatsappConnected / Math.max(ecosystemStats.whatsappInstancesTotal, 1)) * 100) : 0
    const reviewBacklog = propertyStats.underReview + propertyStats.incomplete
    const topLocations = leadLocations.slice(0, 6)

    const overviewTabs = [
        { label: 'Visao executiva', value: funnelHealth, active: true },
        { label: 'Marketing', value: marketingStats.totalLeads },
        { label: 'Comercial', value: qualifiedStep },
        { label: 'Operacao', value: propertyStats.active },
        { label: 'Financeiro', value: financeSummary.totalEntries },
        { label: 'IA', value: ecosystemStats.brokersActive },
    ]

    const overviewSignals = [
        {
            label: 'Saude do funil',
            value: `${funnelHealth}%`,
            detail: `${marketingStats.totalLeads.toLocaleString('pt-BR')} leads de ${mainFunnelTotal.toLocaleString('pt-BR')} visitas`,
            icon: Gauge,
            tone: funnelHealth >= 4 ? 'good' : funnelHealth >= 2 ? 'watch' : 'neutral',
        },
        {
            label: 'Midia ativa',
            value: `${ecosystemStats.adsCampaignsActive}/${ecosystemStats.adsCampaignsTotal}`,
            detail: `${activeCampaignRate}% das campanhas rodando neste periodo`,
            icon: Megaphone,
            tone: ecosystemStats.adsCampaignsActive > 0 ? 'good' : 'watch',
        },
        {
            label: 'Atendimento',
            value: `${ecosystemStats.whatsappConnected}/${ecosystemStats.whatsappInstancesTotal}`,
            detail: `${automationHealth}% das conexoes WhatsApp ativas`,
            icon: Smartphone,
            tone: automationHealth >= 70 ? 'good' : 'watch',
        },
        {
            label: 'Pendencias',
            value: reviewBacklog.toLocaleString('pt-BR'),
            detail: `${propertyStats.underReview} em analise e ${propertyStats.incomplete} incompletos`,
            icon: ClipboardCheck,
            tone: reviewBacklog > 0 ? 'watch' : 'good',
        },
    ]

    const overviewActions = [
        {
            title: 'Revisar imoveis pendentes',
            detail: `${propertyStats.underReview} aguardando aprovacao`,
            href: '/admin/properties',
            tone: propertyStats.underReview > 0 ? 'watch' : 'good',
        },
        {
            title: 'Abrir painel de marketing',
            detail: `${marketingStats.totalLeads.toLocaleString('pt-BR')} leads e ${marketingStats.conversionRate.toFixed(1)}% de conversao`,
            href: '/admin/marketing',
            tone: 'neutral',
        },
        {
            title: 'Conferir campanhas pagas',
            detail: `${formatCurrency(ecosystemStats.adsSpend30d)} investidos no periodo`,
            href: '/admin/ads',
            tone: ecosystemStats.adsSpend30d > 0 ? 'good' : 'neutral',
        },
    ]

    const compactMetricRows = [
        {
            label: 'Leads',
            primary: marketingStats.totalLeads.toLocaleString('pt-BR'),
            helper: `${marketingStats.conversionRate.toFixed(1)}% de conversao`,
            progress: Math.min(100, Math.max(4, funnelHealth)),
            color: '#b8945f',
        },
        {
            label: 'Qualificados',
            primary: qualifiedStep.toLocaleString('pt-BR'),
            helper: `${convertedStep.toLocaleString('pt-BR')} convertidos`,
            progress: mainFunnelTotal > 0 ? Math.min(100, Math.round((qualifiedStep / mainFunnelTotal) * 100)) : 0,
            color: '#22c55e',
        },
        {
            label: 'Imoveis ativos',
            primary: propertyStats.active.toLocaleString('pt-BR'),
            helper: `${propertyStats.total.toLocaleString('pt-BR')} cadastrados`,
            progress: propertyStats.total > 0 ? Math.min(100, Math.round((propertyStats.active / propertyStats.total) * 100)) : 0,
            color: '#8a6d3b',
        },
        {
            label: 'Saldo',
            primary: formatCurrency(financeSummary.balance),
            helper: `${financeSummary.totalEntries} lancamentos`,
            progress: financeSummary.income > 0 ? Math.min(100, Math.round(((financeSummary.balance > 0 ? financeSummary.balance : 0) / financeSummary.income) * 100)) : 0,
            color: financeSummary.balance >= 0 ? '#22c55e' : '#ef4444',
        },
    ]

    const conversionDonutData = [
        { name: 'Leads', value: marketingStats.totalLeads },
        { name: 'Visitantes sem lead', value: Math.max(marketingStats.totalVisitors - marketingStats.totalLeads, 0) },
    ]

    const financeBoardData = [
        { name: 'Receitas', value: Math.max(financeSummary.income, 0) },
        { name: 'Despesas', value: Math.max(financeSummary.expense, 0) },
        { name: 'Trafego', value: Math.max(ecosystemStats.adsSpend30d, 0) },
    ].filter(item => item.value > 0)

    const leaderboardRows = [
        {
            name: 'Marketing',
            status: `${marketingStats.totalVisitors.toLocaleString('pt-BR')} visitantes`,
            score: funnelHealth,
            metric: marketingStats.totalLeads.toLocaleString('pt-BR'),
            trend: marketingStats.conversionRate.toFixed(1) + '%',
            href: '/admin/marketing',
        },
        {
            name: 'Comercial',
            status: `${qualifiedStep.toLocaleString('pt-BR')} qualificados`,
            score: mainFunnelTotal > 0 ? Math.round((qualifiedStep / mainFunnelTotal) * 100) : 0,
            metric: convertedStep.toLocaleString('pt-BR'),
            trend: 'Funil',
            href: '/admin/leads/crm',
        },
        {
            name: 'Operacao',
            status: `${propertyStats.total.toLocaleString('pt-BR')} imoveis`,
            score: propertyStats.total > 0 ? Math.round((propertyStats.active / propertyStats.total) * 100) : 0,
            metric: propertyStats.active.toLocaleString('pt-BR'),
            trend: `${reviewBacklog} revisar`,
            href: '/admin/properties',
        },
        {
            name: 'Financeiro',
            status: `${financeSummary.totalEntries.toLocaleString('pt-BR')} lancamentos`,
            score: financeSummary.income > 0 ? Math.round((financeSummary.balance / financeSummary.income) * 100) : 0,
            metric: formatCurrency(financeSummary.balance),
            trend: formatCurrency(financeSummary.expense),
            href: '/admin/finance',
        },
        {
            name: 'IA e automacao',
            status: `${ecosystemStats.brokersActive}/${ecosystemStats.brokersTotal} agentes`,
            score: automationHealth,
            metric: `${ecosystemStats.whatsappConnected}/${ecosystemStats.whatsappInstancesTotal}`,
            trend: 'Conexoes',
            href: '/admin/pilger-ai/saude',
        },
    ]

    if (loading) {
        return <AdminLoadingState message="Carregando dashboard geral..." minHeight="50vh" />
    }

    return (
        <div className="admin-overview-page overview-manager-page overview-board-page">
            <section className="overview-board-frame" aria-label="Dashboard geral Pilger">
                <main className="overview-board-main">
                    <header className="overview-board-header">
                        <div>
                            <span>Pilger AI Command Center</span>
                            <h1>Dashboard Geral</h1>
                        </div>
                        <div className="overview-board-context">
                            <span>Regiao: Litoral SC</span>
                            <span>Intervalo: 30 dias</span>
                            <span>Atualizacao: automatica</span>
                        </div>
                    </header>

                    <div className="overview-board-filterbar">
                        <label>
                            <span>Selecionar visao</span>
                            <select className="form-input" defaultValue="geral">
                                <option value="geral">Operacao completa</option>
                                <option value="marketing">Marketing</option>
                                <option value="comercial">Comercial</option>
                                <option value="financeiro">Financeiro</option>
                            </select>
                        </label>
                        <div className="overview-board-range" aria-label="Periodo">
                            <button type="button">Hoje</button>
                            <button type="button">7 dias</button>
                            <button type="button" className="active">30 dias</button>
                            <button type="button">Este mes</button>
                        </div>
                    </div>

                    <section className="overview-board-kpis" aria-label="Indicadores principais">
                        {compactMetricRows.map(metric => (
                            <article key={metric.label} className="overview-board-kpi">
                                <div>
                                    <span>{metric.label}</span>
                                    <strong>{metric.primary}</strong>
                                    <small>{metric.helper}</small>
                                </div>
                                <div className="overview-board-kpi-bar">
                                    <i style={{ width: `${Math.max(0, Math.min(100, metric.progress))}%`, background: metric.color }} />
                                </div>
                            </article>
                        ))}
                    </section>

                    <section className="overview-board-grid overview-board-grid-top">
                        <article className="overview-board-panel overview-board-panel-wide">
                            <div className="overview-board-panel-title">
                                <span>Performance</span>
                                <strong>Volume comercial</strong>
                            </div>
                            <div className="overview-board-bars">
                                {[
                                    { label: 'Visitantes', value: marketingStats.totalVisitors, max: Math.max(marketingStats.totalVisitors, 1), color: '#1a1a1a' },
                                    { label: 'Leads', value: marketingStats.totalLeads, max: Math.max(marketingStats.totalVisitors, 1), color: '#b8945f' },
                                    { label: 'Qualificados', value: qualifiedStep, max: Math.max(marketingStats.totalLeads, 1), color: '#22c55e' },
                                ].map(row => (
                                    <div key={row.label} className="overview-board-bar-row">
                                        <span>{row.label}</span>
                                        <div><i style={{ width: `${Math.max(5, Math.min(100, Math.round((row.value / row.max) * 100)))}%`, background: row.color }} /></div>
                                        <strong>{row.value.toLocaleString('pt-BR')}</strong>
                                    </div>
                                ))}
                            </div>
                        </article>

                        <article className="overview-board-panel overview-board-mini">
                            <div className="overview-board-panel-title">
                                <span>% plano</span>
                                <strong>Funil</strong>
                            </div>
                            <div className="overview-board-number">
                                <strong>{funnelHealth}%</strong>
                                <span>leads sobre visitas</span>
                            </div>
                        </article>

                        <article className="overview-board-panel overview-board-mini">
                            <div className="overview-board-panel-title">
                                <span>Atendimento</span>
                                <strong>Conexoes</strong>
                            </div>
                            <div className="overview-board-number">
                                <strong>{automationHealth}%</strong>
                                <span>{ecosystemStats.whatsappConnected}/{ecosystemStats.whatsappInstancesTotal} WhatsApp</span>
                            </div>
                        </article>
                    </section>

                    <section className="overview-board-grid overview-board-grid-middle">
                        <article className="overview-board-panel">
                            <div className="overview-board-panel-title">
                                <span>ADS e AUR</span>
                                <strong>Investimento</strong>
                            </div>
                            {financeBoardData.length > 0 ? (
                                <SimpleBarChart data={financeBoardData} color="#b8945f" name="Valor" layout="horizontal" height={190} valueFormatter={formatCurrency} />
                            ) : (
                                <div className="overview-board-empty">Sem dados financeiros no periodo.</div>
                            )}
                        </article>

                        <article className="overview-board-panel">
                            <div className="overview-board-panel-title">
                                <span>Traffic & Conversion</span>
                                <strong>Visitantes para lead</strong>
                            </div>
                            <SimpleDonutChart data={conversionDonutData} colors={['#b8945f', '#eee8dd']} height={190} />
                        </article>

                        <article className="overview-board-panel">
                            <div className="overview-board-panel-title">
                                <span>Timeline</span>
                                <strong>Visitantes e leads</strong>
                            </div>
                            <SimpleLineChart
                                data={dailyData}
                                height={190}
                                series={[
                                    { key: 'visitors', name: 'Visitantes', color: '#1a1a1a' },
                                    { key: 'leads', name: 'Leads', color: '#b8945f' },
                                ]}
                            />
                        </article>

                        <article className="overview-board-panel overview-board-worked">
                            <div className="overview-board-panel-title">
                                <span>Operacao</span>
                                <strong>Fila</strong>
                            </div>
                            {overviewActions.map(action => (
                                <Link key={action.title} href={action.href} className={`overview-board-action tone-${action.tone}`}>
                                    <div>
                                        <strong>{action.title}</strong>
                                        <span>{action.detail}</span>
                                    </div>
                                    <ArrowRight size={15} />
                                </Link>
                            ))}
                        </article>
                    </section>

                    <section className="overview-board-grid overview-board-grid-bottom">
                        <article className="overview-board-panel overview-board-map-panel">
                            <div className="overview-board-panel-title">
                                <span>Demanda</span>
                                <strong>Mapa de leads</strong>
                            </div>
                            <DashboardLeadMap locations={leadLocations} title="Mapa real de visitantes e leads" />
                        </article>

                        <article className="overview-board-panel overview-board-table-panel">
                            <div className="overview-board-panel-title">
                                <span>Leaderboard</span>
                                <strong>Areas do negocio</strong>
                            </div>
                            <div className="overview-board-table-wrap">
                                <table className="overview-board-table">
                                    <thead>
                                        <tr>
                                            <th>Area</th>
                                            <th>Status</th>
                                            <th>Score</th>
                                            <th>Metrica</th>
                                            <th>Tendencia</th>
                                            <th />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaderboardRows.map(row => (
                                            <tr key={row.name}>
                                                <td><strong>{row.name}</strong></td>
                                                <td>{row.status}</td>
                                                <td>
                                                    <div className="overview-board-score-cell">
                                                        <i style={{ width: `${Math.max(0, Math.min(100, row.score))}%` }} />
                                                    </div>
                                                </td>
                                                <td>{row.metric}</td>
                                                <td>{row.trend}</td>
                                                <td><Link href={row.href}>Abrir</Link></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </article>
                    </section>
                </main>
            </section>

            {false && (
            <>
            <header className="admin-header overview-hero-header overview-manager-topbar">
                <div className="overview-manager-title">
                    <span className="overview-manager-logo"><Workflow size={22} /></span>
                    <div>
                        <span className="overview-eyebrow">Pilger AI Command Center</span>
                        <h1>Dashboard Geral</h1>
                        <p>Visao executiva com funil, origem dos leads, operacao, financeiro e governanca dos agentes.</p>
                    </div>
                </div>
                <div className="overview-manager-actions" aria-label="Atalhos do dashboard">
                    <Link href="/admin/marketing"><BarChart3 size={15} /> Marketing</Link>
                    <Link href="/admin/ads"><Megaphone size={15} /> Midia</Link>
                    <Link href="/admin/leads/crm"><Users size={15} /> CRM</Link>
                    <Link href="/admin/pilger-ai/saude"><ShieldCheck size={15} /> Sistema</Link>
                </div>
            </header>

            <nav className="overview-manager-tabs" aria-label="Areas do dashboard geral">
                {overviewTabs.map(tab => (
                    <button key={tab.label} type="button" className={tab.active ? 'active' : ''}>
                        <span>{tab.label}</span>
                        <strong>{typeof tab.value === 'number' ? tab.value.toLocaleString('pt-BR') : tab.value}</strong>
                    </button>
                ))}
            </nav>

            <section className="overview-manager-shell">

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

            <div className="overview-signal-grid" aria-label="Sinais principais do negocio">
                {overviewSignals.map(signal => {
                    const Icon = signal.icon
                    return (
                        <article key={signal.label} className={`overview-signal-card tone-${signal.tone}`}>
                            <span><Icon size={16} /></span>
                            <div>
                                <small>{signal.label}</small>
                                <strong>{signal.value}</strong>
                                <p>{signal.detail}</p>
                            </div>
                        </article>
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

            <div className="overview-manager-bottom-grid">
                <section className="overview-manager-queue">
                    <div className="overview-panel-title">
                        <div>
                            <span>Prioridades</span>
                            <h2><Activity size={18} /> O que olhar agora</h2>
                        </div>
                        <strong>{overviewActions.length} acoes</strong>
                    </div>
                    <div className="overview-manager-action-list">
                        {overviewActions.map(action => (
                            <Link key={action.title} href={action.href} className={`overview-manager-action-row tone-${action.tone}`}>
                                <div>
                                    <strong>{action.title}</strong>
                                    <span>{action.detail}</span>
                                </div>
                                <ArrowRight size={16} />
                            </Link>
                        ))}
                    </div>
                </section>

                <section className="overview-manager-queue">
                    <div className="overview-panel-title">
                        <div>
                            <span>Regioes</span>
                            <h2><MapPin size={18} /> Demanda recente</h2>
                        </div>
                        <strong>{topLocations.length} top</strong>
                    </div>
                    <div className="overview-manager-region-list">
                        {topLocations.map((location, index) => (
                            <div key={location.id || `${location.name}-${index}`} className="overview-manager-region-row">
                                <span>{index + 1}</span>
                                <div>
                                    <strong>{location.name}</strong>
                                    <small>{location.subtitle || location.source}</small>
                                </div>
                                <b>{location.source}</b>
                            </div>
                        ))}
                        {topLocations.length === 0 && (
                            <div className="overview-manager-empty">Sem regioes recentes para exibir.</div>
                        )}
                    </div>
                </section>
            </div>
            </section>
            </>
            )}
        </div>
    )
}
