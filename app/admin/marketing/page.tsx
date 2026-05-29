'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { Users, Eye, MessageCircle, TrendingUp, UserCheck, Star, Brain, DollarSign, Target, Thermometer, Megaphone, Search, CheckCircle, AlertCircle, MapPin, Workflow, ClipboardList, Copy, Sparkles, Share2, Play, PenTool } from 'lucide-react'
import Link from 'next/link'
import {
    SimpleBarChart,
    SimpleDonutChart,
    SimpleLineChart,
} from '@/components/admin/SimpleCharts'
import AdminLoadingState from '@/components/admin/AdminLoadingState'

const DashboardLeadMap = dynamic(() => import('@/components/admin/DashboardLeadMap'), {
    ssr: false,
    loading: () => <div className="dashboard-real-map dashboard-real-map-loading">Carregando mapa...</div>,
})

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
    ip_address?: string | null
    user_agent?: string | null
    device_type?: string | null
    browser?: string | null
    os?: string | null
    utm_source?: string | null
    utm_medium?: string | null
    utm_campaign?: string | null
    referrer?: string | null
    page_views?: number | null
    max_scroll?: number | null
}

interface FunnelStep {
    key: string
    label: string
    count: number
    percentage: number
    color: string
}

interface LeadLocation {
    id?: string
    name: string
    subtitle: string
    total: number
    leads: number
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

type MarketingTab = 'overview' | 'acquisition' | 'funnel' | 'location' | 'realtime'

interface AiMarketingReport {
    id: string
    report_type: 'paid' | 'organic'
    title: string
    summary: string | null
    period_start: string | null
    period_end: string | null
    insights: Array<{ title?: string; detail?: string; impact?: string }>
    recommendations: Array<{ title?: string; action?: string; priority?: string }>
    metrics: Record<string, any>
    created_at: string
}

interface CommandCenterPayload {
    reports: {
        paid: AiMarketingReport | null
        organic: AiMarketingReport | null
    }
    metrics: {
        blended_score: number
        paid_health_score: number
        organic_health_score: number
        paid: {
            spend: number
            impressions: number
            clicks: number
            reach: number
            leads: number
            cpl: number
            ctr: number
            campaigns_with_metrics: number
        }
        organic: {
            reach: number
            views: number
            interactions: number
            comments: number
            shares: number
            saved: number
            followers: number
            media: number
            engagement_rate: number
        }
        social_ai: {
            suggestions: number
            hot_leads: number
            pending: number
        }
        creatives: {
            total: number
            pending: number
            paid: number
            organic: number
        }
    }
    topOrganic: Array<{ platform: string; title: string; score: number; published_at: string | null }>
}

const PIE_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6']
const FUNNEL_COLORS = ['#c9a96e', '#3b82f6', '#14b8a6', '#22c55e', '#8b5cf6', '#f97316', '#ef4444']

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
        { key: 'formSubmitted', label: 'Formulario', count: Number(raw?.formSubmitted || 0) },
        { key: 'chatOpened', label: 'Chat aberto', count: Number(raw?.chatOpened || 0) },
        { key: 'messageSent', label: 'Mensagem enviada', count: Number(raw?.messageSent || 0) },
        { key: 'whatsappConversationStarted', label: 'WhatsApp iniciado', count: Number(raw?.whatsappConversationStarted || 0) },
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

function buildLeadLocations(visitors: RecentVisitor[]): LeadLocation[] {
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
    const [funnelSteps, setFunnelSteps] = useState<FunnelStep[]>([])
    const [activeTab, setActiveTab] = useState<MarketingTab>('overview')
    const [briefCopied, setBriefCopied] = useState(false)
    const [loading, setLoading] = useState(true)
    const [commandCenter, setCommandCenter] = useState<CommandCenterPayload | null>(null)
    const [commandError, setCommandError] = useState('')

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
            const [res, funnelRes] = await Promise.all([
                fetch('/api/admin/analytics'),
                fetch('/api/admin/funnel'),
            ])
            const data = await res.json()
            if (data.error) throw new Error(data.error)
            setStats(data.stats)
            setSourceData(data.sourceData)
            setTopPages(data.topPages || [])
            setRecentVisitors(data.recentVisitors || [])
            setDailyData(data.dailyData)
            if (funnelRes.ok) {
                const funnelData = await funnelRes.json()
                setFunnelSteps(buildFunnelSteps(funnelData))
            }
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

    const fetchCommandCenter = async () => {
        try {
            setCommandError('')
            const res = await fetch('/api/admin/marketing-command-center')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erro ao carregar comando 360.')
            setCommandCenter(data)
        } catch (err) {
            setCommandError(err instanceof Error ? err.message : 'Erro ao carregar comando 360.')
        }
    }

    useEffect(() => {
        fetchData()
        fetchReports()
        fetchAdMetrics()
        fetchCommandCenter()
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

    const leadLocations = useMemo(() => buildLeadLocations(recentVisitors), [recentVisitors])
    const mainFunnelTotal = funnelSteps[0]?.count || stats.totalVisitors || 0

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

    const investorsPercent = stats.totalLeads > 0 ? Math.round((stats.investors / stats.totalLeads) * 100) : 0
    const housingPercent = stats.totalLeads > 0 ? Math.round((stats.housingLeads / stats.totalLeads) * 100) : 0
    const scoreValue = generalScore ?? 0
    const executiveCards = [
        {
            key: 'spend',
            label: `Investimento ${adDateLabels[adDatePreset] ? `(${adDateLabels[adDatePreset]})` : ''}`,
            value: formatCurrency(adMetrics.totalSpend),
            helper: 'Midia paga ativa',
            icon: <DollarSign size={16} />,
            tone: 'green',
        },
        {
            key: 'traffic-leads',
            label: 'Leads de trafego',
            value: adMetrics.totalLeads.toLocaleString('pt-BR'),
            helper: `${stats.completeLeads} completos no CRM`,
            icon: <Users size={16} />,
            tone: 'purple',
        },
        {
            key: 'cpa',
            label: 'CPA geral',
            value: adMetrics.avgCpa > 0 ? formatCurrency(adMetrics.avgCpa) : '-',
            helper: 'Custo por lead',
            icon: <Target size={16} />,
            tone: 'pink',
        },
        {
            key: 'campaigns',
            label: 'Campanhas ativas',
            value: adMetrics.activeCampaigns.toLocaleString('pt-BR'),
            helper: `${stats.conversionRate}% conversao geral`,
            icon: <TrendingUp size={16} />,
            tone: 'gold',
        },
        {
            key: 'score',
            label: 'Score de performance',
            value: generalScore != null ? String(generalScore) : '-',
            helper: generalScore != null ? `${getScoreLabel(generalScore)} | Meta ${metaScore ?? '-'} Google ${googleScore ?? '-'}` : 'Sem leitura',
            icon: <Thermometer size={16} />,
            tone: 'score',
        },
    ]
    const metricGroups = [
        {
            title: 'Aquisicao',
            icon: <Eye size={16} />,
            items: [
                { label: 'Visitantes', value: stats.totalVisitors.toLocaleString('pt-BR') },
                { label: 'Origem principal', value: sourceData[0]?.name || 'Direto' },
                { label: 'Cookies aceitos', value: String(stats.cookieConsent || 0) },
            ],
        },
        {
            title: 'Conversao',
            icon: <CheckCircle size={16} />,
            items: [
                { label: 'Leads completos', value: stats.completeLeads.toLocaleString('pt-BR') },
                { label: 'Leads parciais', value: stats.partialLeads.toLocaleString('pt-BR') },
                { label: 'Taxa geral', value: `${stats.conversionRate}%` },
            ],
        },
        {
            title: 'WhatsApp',
            icon: <MessageCircle size={16} />,
            items: [
                { label: 'Conversas', value: stats.whatsappConversations.toLocaleString('pt-BR') },
                { label: 'Enviados', value: stats.whatsappSent.toLocaleString('pt-BR') },
                { label: 'VIP', value: stats.vipLeads.toLocaleString('pt-BR') },
            ],
        },
        {
            title: 'Perfil do lead',
            icon: <Brain size={16} />,
            items: [
                { label: 'Investidores', value: `${investorsPercent}%` },
                { label: 'Moradia', value: `${housingPercent}%` },
                { label: 'Push ativo', value: String(stats.pushSubscribers || 0) },
            ],
        },
    ]
    const recentRows = recentVisitors.slice(0, 6)
    const tabItems: Array<{ key: MarketingTab; label: string; description: string; icon: ReactNode }> = [
        { key: 'overview', label: 'Visao geral', description: 'Funil + mapa', icon: <Target size={15} /> },
        { key: 'acquisition', label: 'Aquisicao', description: 'Graficos e fontes', icon: <TrendingUp size={15} /> },
        { key: 'funnel', label: 'Funil', description: 'Etapas de conversao', icon: <Workflow size={15} /> },
        { key: 'location', label: 'Localizacao', description: 'Mapa dos leads', icon: <MapPin size={15} /> },
        { key: 'realtime', label: 'Tempo real', description: 'Ultimos acessos', icon: <Eye size={15} /> },
    ]
    const sourceTotal = sourceData.reduce((sum, item) => sum + Number(item.value || 0), 0)
    const topSource = sourceData[0]
    const topSourceShare = topSource && sourceTotal > 0 ? Math.round((Number(topSource.value || 0) / sourceTotal) * 100) : 0
    const conversionTone = stats.conversionRate >= 5 ? 'good' : stats.conversionRate >= 2 ? 'watch' : 'danger'
    const qualityTone = stats.completeLeads >= stats.partialLeads ? 'good' : 'watch'
    const insights: Array<{
        key: string
        title: string
        detail: string
        tone: 'good' | 'watch' | 'danger' | 'neutral'
        icon: ReactNode
        target: MarketingTab
    }> = [
        {
            key: 'conversion',
            title: conversionTone === 'good' ? 'Conversao saudavel' : 'Conversao pede atencao',
            detail: `${stats.conversionRate}% de conversao geral com ${stats.totalVisitors.toLocaleString('pt-BR')} visitantes.`,
            tone: conversionTone,
            icon: conversionTone === 'danger' ? <AlertCircle size={16} /> : <Target size={16} />,
            target: 'funnel',
        },
        {
            key: 'quality',
            title: qualityTone === 'good' ? 'Leads completos em vantagem' : 'Muitos leads parciais',
            detail: `${stats.completeLeads} completos contra ${stats.partialLeads} parciais.`,
            tone: qualityTone,
            icon: <CheckCircle size={16} />,
            target: 'funnel',
        },
        {
            key: 'source',
            title: topSourceShare >= 70 ? 'Origem concentrada' : 'Origem distribuida',
            detail: topSource ? `${topSource.name} concentra ${topSourceShare}% dos acessos rastreados.` : 'Sem fonte dominante no periodo.',
            tone: topSourceShare >= 70 ? 'watch' : 'neutral',
            icon: <TrendingUp size={16} />,
            target: 'acquisition',
        },
        {
            key: 'geo',
            title: `${leadLocations.length} regioes ativas`,
            detail: leadLocations.length > 0 ? 'Mapa pronto para leitura de demanda por localidade.' : 'Ainda sem geografia suficiente para decisao.',
            tone: leadLocations.length > 0 ? 'good' : 'neutral',
            icon: <MapPin size={16} />,
            target: 'location',
        },
    ]
    const actionQueue = [
        {
            key: 'funnel-audit',
            priority: conversionTone === 'danger' ? 'Alta' : 'Media',
            title: conversionTone === 'good' ? 'Manter leitura do funil' : 'Auditar queda no funil',
            owner: 'Marketing',
            detail: conversionTone === 'good'
                ? 'Acompanhar se a taxa se mantem nos proximos ciclos.'
                : 'Verificar onde visitante abandona antes de virar lead completo.',
            target: 'funnel' as MarketingTab,
            tone: conversionTone,
        },
        stats.partialLeads > stats.completeLeads ? {
            key: 'partial-recovery',
            priority: 'Alta',
            title: 'Recuperar leads parciais',
            owner: 'Comercial',
            detail: `${stats.partialLeads} leads parciais podem virar conversa se acionados rapido.`,
            target: 'realtime' as MarketingTab,
            tone: 'danger' as const,
        } : {
            key: 'complete-leads',
            priority: 'Baixa',
            title: 'Qualidade de lead estavel',
            owner: 'Comercial',
            detail: 'Leads completos estao no controle. Manter acompanhamento.',
            target: 'funnel' as MarketingTab,
            tone: 'good' as const,
        },
        topSourceShare >= 70 ? {
            key: 'source-risk',
            priority: 'Media',
            title: 'Reduzir dependencia de origem',
            owner: 'Trafego pago',
            detail: `${topSource?.name || 'Uma origem'} concentra ${topSourceShare}% dos acessos.`,
            target: 'acquisition' as MarketingTab,
            tone: 'watch' as const,
        } : {
            key: 'source-balance',
            priority: 'Baixa',
            title: 'Fontes equilibradas',
            owner: 'Trafego pago',
            detail: 'Manter distribuicao e observar novas oportunidades.',
            target: 'acquisition' as MarketingTab,
            tone: 'neutral' as const,
        },
        {
            key: 'geo-demand',
            priority: leadLocations.length >= 5 ? 'Media' : 'Baixa',
            title: 'Cruzar demanda com localizacao',
            owner: 'Diretoria',
            detail: leadLocations.length > 0
                ? `${leadLocations.length} regioes rastreadas para orientar campanha e estoque.`
                : 'Aguardar mais volume geografico antes de decisao territorial.',
            target: 'location' as MarketingTab,
            tone: leadLocations.length > 0 ? 'good' as const : 'neutral' as const,
        },
    ]
    const leadGoalByPreset: Record<string, number> = {
        today: 10,
        yesterday: 10,
        last_7d: 50,
        last_14d: 100,
        last_30d: 200,
        this_month: 200,
        last_month: 200,
        maximum: 1000,
        custom: 200,
    }
    const leadsGoal = leadGoalByPreset[adDatePreset] || 200
    const conversionGoal = 5
    const cpaGoal = 120
    const scoreGoal = 70
    const goalCards = [
        {
            key: 'leads-goal',
            label: 'Meta de leads',
            value: adMetrics.totalLeads,
            displayValue: adMetrics.totalLeads.toLocaleString('pt-BR'),
            goalLabel: `${leadsGoal.toLocaleString('pt-BR')} leads`,
            progress: Math.min(100, Math.round((adMetrics.totalLeads / Math.max(leadsGoal, 1)) * 100)),
            status: adMetrics.totalLeads >= leadsGoal ? 'Dentro da meta' : 'Abaixo da meta',
            tone: adMetrics.totalLeads >= leadsGoal ? 'good' as const : 'watch' as const,
            icon: <Users size={16} />,
        },
        {
            key: 'conversion-goal',
            label: 'Conversao minima',
            value: stats.conversionRate,
            displayValue: `${stats.conversionRate}%`,
            goalLabel: `${conversionGoal}%`,
            progress: Math.min(100, Math.round((stats.conversionRate / conversionGoal) * 100)),
            status: stats.conversionRate >= conversionGoal ? 'Saudavel' : 'Precisa melhorar',
            tone: stats.conversionRate >= conversionGoal ? 'good' as const : 'danger' as const,
            icon: <Target size={16} />,
        },
        {
            key: 'cpa-goal',
            label: 'CPA alvo',
            value: adMetrics.avgCpa,
            displayValue: adMetrics.avgCpa > 0 ? formatCurrency(adMetrics.avgCpa) : '-',
            goalLabel: `ate ${formatCurrency(cpaGoal)}`,
            progress: adMetrics.avgCpa > 0 ? Math.min(100, Math.round((cpaGoal / adMetrics.avgCpa) * 100)) : 0,
            status: adMetrics.avgCpa > 0 && adMetrics.avgCpa <= cpaGoal ? 'Eficiente' : 'Acima do alvo',
            tone: adMetrics.avgCpa > 0 && adMetrics.avgCpa <= cpaGoal ? 'good' as const : 'watch' as const,
            icon: <DollarSign size={16} />,
        },
        {
            key: 'score-goal',
            label: 'Score alvo',
            value: generalScore ?? 0,
            displayValue: generalScore != null ? String(generalScore) : '-',
            goalLabel: `${scoreGoal}+`,
            progress: Math.min(100, Math.round(((generalScore ?? 0) / scoreGoal) * 100)),
            status: generalScore != null && generalScore >= scoreGoal ? 'Forte' : 'Em evolucao',
            tone: generalScore != null && generalScore >= scoreGoal ? 'good' as const : 'neutral' as const,
            icon: <Thermometer size={16} />,
        },
    ]
    const executiveBriefLines = [
        `Periodo: ${adDateLabels[adDatePreset] || adDatePreset}.`,
        `Investimento em trafego: ${formatCurrency(adMetrics.totalSpend)} para ${adMetrics.totalLeads.toLocaleString('pt-BR')} leads de trafego.`,
        `CPA geral: ${adMetrics.avgCpa > 0 ? formatCurrency(adMetrics.avgCpa) : 'sem leitura'} com ${adMetrics.activeCampaigns.toLocaleString('pt-BR')} campanhas ativas.`,
        `Funil: ${stats.totalVisitors.toLocaleString('pt-BR')} visitantes, ${stats.completeLeads.toLocaleString('pt-BR')} leads completos e ${stats.partialLeads.toLocaleString('pt-BR')} leads parciais.`,
        `Conversao geral: ${stats.conversionRate}%. Score de performance: ${generalScore != null ? `${generalScore} (${getScoreLabel(generalScore)})` : 'sem leitura'}.`,
        topSource ? `Principal origem: ${topSource.name}, com ${topSourceShare}% dos acessos rastreados.` : 'Principal origem: sem dados suficientes.',
        `Mapa de demanda: ${leadLocations.length} regioes rastreadas.`,
        `Prioridade sugerida: ${actionQueue[0]?.title || 'acompanhar indicadores principais'}.`,
    ]
    const executiveBriefText = `Resumo executivo - Marketing Pilger\n${executiveBriefLines.map(line => `- ${line}`).join('\n')}`
    const handleCopyExecutiveBrief = async () => {
        try {
            await navigator.clipboard.writeText(executiveBriefText)
            setBriefCopied(true)
            window.setTimeout(() => setBriefCopied(false), 1800)
        } catch (error) {
            console.error('Erro ao copiar resumo executivo:', error)
        }
    }
    const commandMetrics = commandCenter?.metrics
    const latestPaidAi = commandCenter?.reports.paid || null
    const latestOrganicAi = commandCenter?.reports.organic || null
    const aiActionItems = [
        ...(latestPaidAi?.recommendations || []).slice(0, 2).map(item => ({
            source: 'Pago',
            title: item.title || 'Acao paga',
            detail: item.action || '-',
            priority: item.priority || 'media',
            tone: item.priority === 'alta' ? 'danger' : 'watch',
            href: '/admin/ads',
        })),
        ...(latestOrganicAi?.recommendations || []).slice(0, 2).map(item => ({
            source: 'Organico',
            title: item.title || 'Acao organica',
            detail: item.action || '-',
            priority: item.priority || 'media',
            tone: item.priority === 'alta' ? 'danger' : 'good',
            href: '/admin/ads/organic',
        })),
    ].slice(0, 4)
    const commandCards = [
        {
            key: 'paid',
            label: 'Pago 30 dias',
            value: commandMetrics ? formatCurrency(commandMetrics.paid.spend) : '-',
            helper: commandMetrics ? `${commandMetrics.paid.leads} leads | CPL ${commandMetrics.paid.cpl > 0 ? formatCurrency(commandMetrics.paid.cpl) : '-'}` : 'Sem leitura',
            icon: <DollarSign size={16} />,
            tone: 'green',
        },
        {
            key: 'organic',
            label: 'Organico 30 dias',
            value: commandMetrics ? commandMetrics.organic.reach.toLocaleString('pt-BR') : '-',
            helper: commandMetrics ? `${commandMetrics.organic.views.toLocaleString('pt-BR')} views | ${commandMetrics.organic.media} midias` : 'Sem leitura',
            icon: <Play size={16} />,
            tone: 'gold',
        },
        {
            key: 'social',
            label: 'Leads sociais IA',
            value: commandMetrics ? commandMetrics.social_ai.hot_leads.toLocaleString('pt-BR') : '-',
            helper: commandMetrics ? `${commandMetrics.social_ai.pending} sugestoes pendentes` : 'Sem leitura',
            icon: <MessageCircle size={16} />,
            tone: 'purple',
        },
        {
            key: 'creative',
            label: 'Criativos',
            value: commandMetrics ? commandMetrics.creatives.pending.toLocaleString('pt-BR') : '-',
            helper: commandMetrics ? `${commandMetrics.creatives.paid} pago | ${commandMetrics.creatives.organic} organico` : 'Sem leitura',
            icon: <PenTool size={16} />,
            tone: 'pink',
        },
        {
            key: 'ai-score',
            label: 'Score IA 360',
            value: commandMetrics?.blended_score ? String(commandMetrics.blended_score) : '-',
            helper: commandMetrics?.blended_score ? `Pago ${commandMetrics.paid_health_score || '-'} | Organico ${commandMetrics.organic_health_score || '-'}` : 'Sem leitura',
            icon: <Sparkles size={16} />,
            tone: 'score',
        },
    ]

    return (
        <div className="marketing-ceo-page">
            <div className="admin-header marketing-ceo-header">
                <div>
                    <span className="marketing-ceo-kicker">Marketing intelligence</span>
                    <h1>Painel do CEO</h1>
                    <p className="marketing-subtitle">Resumo executivo de trafego, funil e demanda comercial.</p>
                </div>
                <div className="marketing-period-filter marketing-period-filter-compact">
                    <select
                        value={adDatePreset}
                        onChange={e => handleAdDateChange(e.target.value)}
                        className="form-input"
                    >
                        <option value="today">Hoje</option>
                        <option value="yesterday">Ontem</option>
                        <option value="last_7d">Ultimos 7 dias</option>
                        <option value="last_14d">Ultimos 14 dias</option>
                        <option value="last_30d">Ultimos 30 dias</option>
                        <option value="this_month">Este mes</option>
                        <option value="last_month">Mes passado</option>
                        <option value="maximum">Vitalicio</option>
                        <option value="custom">Personalizado</option>
                    </select>
                    {adDatePreset === 'custom' && (
                        <div className="marketing-custom-range">
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="ads-date-input" />
                            <span>ate</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="ads-date-input" />
                            <button onClick={handleCustomDateSearch} className="btn-gold" type="button">
                                <Search size={14} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <section className="marketing-executive-section">
                <div className="marketing-section-title">
                    <Megaphone size={17} />
                    <div>
                        <span>Trafego pago</span>
                        <strong>Visao geral</strong>
                    </div>
                </div>
                <div className="marketing-executive-grid">
                    {executiveCards.map(card => (
                        <div key={card.key} className={`marketing-executive-card tone-${card.tone}`}>
                            <div className="marketing-executive-icon">{card.icon}</div>
                            {card.key === 'score' ? (
                                <div
                                    className="marketing-score-ring"
                                    style={{
                                        ['--score' as any]: scoreValue,
                                        ['--score-color' as any]: generalScore != null ? getScoreColor(generalScore) : '#94a3b8',
                                    }}
                                >
                                    <span>{card.value}</span>
                                </div>
                            ) : (
                                <strong>{card.value}</strong>
                            )}
                            <span>{card.label}</span>
                            <small>{card.helper}</small>
                        </div>
                    ))}
                </div>
            </section>

            <section className="marketing-command-360">
                <div className="marketing-section-title">
                    <Sparkles size={17} />
                    <div>
                        <span>Comando IA 360</span>
                        <strong>Pago + organico + atendimento + criativos</strong>
                    </div>
                    <button type="button" onClick={fetchCommandCenter} className="marketing-command-refresh">
                        Atualizar leitura
                    </button>
                </div>
                {commandError && <div className="marketing-command-error">{commandError}</div>}
                <div className="marketing-command-card-grid">
                    {commandCards.map(card => (
                        <article key={card.key} className={`marketing-command-360-card tone-${card.tone}`}>
                            <span>{card.icon}</span>
                            <strong>{card.value}</strong>
                            <p>{card.label}</p>
                            <small>{card.helper}</small>
                        </article>
                    ))}
                </div>
                <div className="marketing-ai-report-grid">
                    <article className="marketing-ai-report-card">
                        <div>
                            <span>Relatorio pago IA</span>
                            <strong>{latestPaidAi?.title || 'Sem relatorio pago'}</strong>
                            <p>{latestPaidAi?.summary || 'Gere um relatorio no painel Meta Ads para alimentar esta leitura.'}</p>
                        </div>
                        <Link href="/admin/ads">Abrir pago</Link>
                    </article>
                    <article className="marketing-ai-report-card">
                        <div>
                            <span>Relatorio organico IA</span>
                            <strong>{latestOrganicAi?.title || 'Sem relatorio organico'}</strong>
                            <p>{latestOrganicAi?.summary || 'Gere um relatorio no painel de trafego organico para alimentar esta leitura.'}</p>
                        </div>
                        <Link href="/admin/ads/organic">Abrir organico</Link>
                    </article>
                </div>
                <div className="marketing-ai-action-grid">
                    <div className="marketing-ai-action-list">
                        <div className="marketing-ai-action-head">
                            <CheckCircle size={16} />
                            <strong>Fila de decisoes IA</strong>
                        </div>
                        {aiActionItems.length > 0 ? aiActionItems.map((item, index) => (
                            <Link key={`${item.source}-${item.title}-${index}`} href={item.href} className={`marketing-ai-action-row tone-${item.tone}`}>
                                <span>{item.priority}</span>
                                <div>
                                    <strong>{item.source}: {item.title}</strong>
                                    <small>{item.detail}</small>
                                </div>
                            </Link>
                        )) : (
                            <div className="marketing-command-empty">Sem recomendacoes IA recentes.</div>
                        )}
                    </div>
                    <div className="marketing-ai-action-list">
                        <div className="marketing-ai-action-head">
                            <Share2 size={16} />
                            <strong>Top conteudos organicos</strong>
                        </div>
                        {(commandCenter?.topOrganic || []).slice(0, 4).map((item, index) => (
                            <Link key={`${item.platform}-${item.title}-${index}`} href="/admin/ads/organic" className="marketing-ai-action-row tone-good">
                                <span>{index + 1}</span>
                                <div>
                                    <strong>{item.title}</strong>
                                    <small>{item.platform} | score {item.score.toLocaleString('pt-BR')}</small>
                                </div>
                            </Link>
                        ))}
                        {(!commandCenter?.topOrganic || commandCenter.topOrganic.length === 0) && (
                            <div className="marketing-command-empty">Sem conteudos organicos sincronizados.</div>
                        )}
                    </div>
                </div>
            </section>

            <section className="marketing-goals-board" aria-label="Metas do periodo">
                <div className="marketing-section-title">
                    <Target size={17} />
                    <div>
                        <span>Metas do periodo</span>
                        <strong>Progresso contra objetivo</strong>
                    </div>
                </div>
                <div className="marketing-goals-grid">
                    {goalCards.map(goal => (
                        <article key={goal.key} className={`marketing-goal-card tone-${goal.tone}`}>
                            <div className="marketing-goal-head">
                                <span>{goal.icon}</span>
                                <small>{goal.status}</small>
                            </div>
                            <strong>{goal.displayValue}</strong>
                            <p>{goal.label}</p>
                            <div className="marketing-goal-track" aria-label={`${goal.progress}% da meta`}>
                                <i style={{ width: `${goal.progress}%` }} />
                            </div>
                            <small className="marketing-goal-target">Objetivo: {goal.goalLabel}</small>
                        </article>
                    ))}
                </div>
            </section>

            <section className="marketing-metric-groups">
                {metricGroups.map(group => (
                    <div key={group.title} className="marketing-metric-group">
                        <div className="marketing-metric-group-title">
                            {group.icon}
                            <strong>{group.title}</strong>
                        </div>
                        <div className="marketing-metric-group-items">
                            {group.items.map(item => (
                                <div key={`${group.title}-${item.label}`}>
                                    <span>{item.label}</span>
                                    <strong>{item.value}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </section>

            {/* ═══ Combined Traffic KPIs + General Thermometer ═══ */}
            <section className="marketing-insight-strip" aria-label="Insights executivos do marketing">
                <div className="marketing-section-title">
                    <Brain size={17} />
                    <div>
                        <span>Central de decisao</span>
                        <strong>O que olhar agora</strong>
                    </div>
                </div>
                <div className="marketing-insight-grid">
                    {insights.map(insight => (
                        <button
                            key={insight.key}
                            type="button"
                            className={`marketing-insight-card tone-${insight.tone}`}
                            onClick={() => setActiveTab(insight.target)}
                        >
                            <span className="marketing-insight-icon">{insight.icon}</span>
                            <strong>{insight.title}</strong>
                            <small>{insight.detail}</small>
                        </button>
                    ))}
                </div>
            </section>

            <section className="marketing-action-board" aria-label="Plano de acao do marketing">
                <div className="marketing-section-title">
                    <CheckCircle size={17} />
                    <div>
                        <span>Plano de acao</span>
                        <strong>Prioridades recomendadas</strong>
                    </div>
                </div>
                <div className="marketing-action-list">
                    {actionQueue.map(action => (
                        <button
                            key={action.key}
                            type="button"
                            className={`marketing-action-item tone-${action.tone}`}
                            onClick={() => setActiveTab(action.target)}
                        >
                            <span className="marketing-action-priority">{action.priority}</span>
                            <div>
                                <strong>{action.title}</strong>
                                <small>{action.detail}</small>
                            </div>
                            <span className="marketing-action-owner">{action.owner}</span>
                        </button>
                    ))}
                </div>
            </section>

            <section className="marketing-brief-card" aria-label="Resumo executivo para copiar">
                <div className="marketing-brief-head">
                    <div className="marketing-section-title">
                        <ClipboardList size={17} />
                        <div>
                            <span>Reporte executivo</span>
                            <strong>Resumo pronto para alinhamento</strong>
                        </div>
                    </div>
                    <button type="button" onClick={handleCopyExecutiveBrief}>
                        {briefCopied ? <CheckCircle size={15} /> : <Copy size={15} />}
                        <span>{briefCopied ? 'Copiado' : 'Copiar resumo'}</span>
                    </button>
                </div>
                <div className="marketing-brief-grid">
                    {executiveBriefLines.slice(0, 6).map((line, index) => (
                        <p key={`${line}-${index}`}>{line}</p>
                    ))}
                </div>
            </section>

            <nav className="marketing-dashboard-tabs" aria-label="Navegacao do dashboard de marketing">
                {tabItems.map(tab => (
                    <button
                        key={tab.key}
                        type="button"
                        className={activeTab === tab.key ? 'active' : ''}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.icon}
                        <span>{tab.label}</span>
                        <small>{tab.description}</small>
                    </button>
                ))}
            </nav>

            <div className="marketing-legacy-traffic" style={{ marginBottom: 32 }}>
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
                    <div className="kpi-grid marketing-kpi-grid marketing-kpi-grid-compact" style={{ gridTemplateColumns: `repeat(${generalScore != null ? 5 : 4}, 1fr)`, marginBottom: 0 }}>
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
            <div className="kpi-grid marketing-kpi-grid marketing-kpi-grid-compact">
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

            <div
                className={`overview-command-grid marketing-command-grid marketing-tab-command marketing-command-${activeTab}`}
                style={{ marginBottom: 24, display: ['overview', 'funnel', 'location'].includes(activeTab) ? undefined : 'none' }}
            >
                <div className="chart-card overview-funnel-card">
                    <div className="overview-panel-title">
                        <div>
                            <span>Jornada de conversao</span>
                            <h2><Workflow size={18} /> Funil de marketing</h2>
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
                            <span>Origem geografica</span>
                            <h2><MapPin size={18} /> Mapa dos leads</h2>
                        </div>
                        <strong>{leadLocations.length} regioes</strong>
                    </div>
                    <DashboardLeadMap locations={leadLocations} title="Mapa real dos leads" />
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

            {/* Charts Row */}
            <div
                className="marketing-charts-grid"
                style={{ display: activeTab === 'acquisition' ? 'grid' : 'none', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}
            >
                {/* Daily Chart */}
                <div className="chart-card marketing-chart-card">
                    <div className="chart-title">Visitantes & Leads — Últimos 7 dias</div>
                    <SimpleLineChart
                        data={dailyData.map(item => ({ ...item, label: item.date }))}
                        height={285}
                        valueFormatter={formatMetric}
                        series={[
                            { key: 'visitors', name: 'Visitantes', color: '#c9a96e' },
                            { key: 'leads', name: 'Leads', color: '#4ade80' },
                        ]}
                    />
                </div>

                {/* Source Pie Chart */}
                <div className="chart-card marketing-chart-card">
                    <div className="chart-title">Origens de Tráfego</div>
                    {sourceData.length > 0 ? (
                        <SimpleDonutChart data={sourceData} colors={PIE_COLORS} height={285} valueFormatter={formatMetric} />
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280, color: 'var(--text-muted)' }}>
                            Nenhum dado disponível
                        </div>
                    )}
                </div>
            </div>

            {/* Source Bar Chart & Top Pages Row */}
            <div
                className="marketing-charts-grid"
                style={{ display: activeTab === 'acquisition' ? 'grid' : 'none', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}
            >
                <div className="chart-card marketing-chart-card">
                    <div className="chart-title">Visitantes por Fonte</div>
                    <SimpleBarChart data={sourceData} color="#c9a96e" name="Visitantes" height={285} valueFormatter={formatMetric} />
                </div>

                <div className="chart-card marketing-chart-card">
                    <div className="chart-title">Páginas Mais Visitadas (Top 10)</div>
                    <SimpleBarChart data={topPages} color="#4ade80" name="Acessos" height={285} layout="horizontal" valueFormatter={formatMetric} />
                </div>
            </div>

            {/* Recent Traffic */}
            <div className="chart-card marketing-realtime-card" style={{ marginBottom: '24px', display: activeTab === 'realtime' ? undefined : 'none' }}>
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
                            {recentRows.map((v, i) => (
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
                            {recentRows.length === 0 && (
                                <tr>
                                    <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#666' }}>Nenhum acesso recente</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <style jsx global>{`
                .marketing-command-360 {
                    margin-bottom: 24px;
                    padding: 20px;
                    border: 1px solid rgba(201, 169, 110, .18);
                    border-radius: 18px;
                    background:
                        radial-gradient(circle at top left, rgba(201,169,110,.13), transparent 34%),
                        linear-gradient(135deg, rgba(255,255,255,.96), rgba(248,244,235,.86));
                    box-shadow: 0 18px 46px rgba(15, 23, 42, .05);
                }
                .marketing-command-360 .marketing-section-title {
                    position: relative;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 14px;
                }
                .marketing-command-refresh {
                    margin-left: auto;
                    border: 1px solid rgba(201,169,110,.35);
                    background: #17120c;
                    color: #fffaf0;
                    border-radius: 999px;
                    padding: 8px 13px;
                    font-size: .78rem;
                    font-weight: 800;
                    cursor: pointer;
                }
                .marketing-command-error {
                    margin-bottom: 12px;
                    padding: 10px 12px;
                    border-radius: 10px;
                    color: #b91c1c;
                    background: rgba(239,68,68,.08);
                    border: 1px solid rgba(239,68,68,.18);
                    font-size: .82rem;
                    font-weight: 700;
                }
                .marketing-command-card-grid {
                    display: grid;
                    grid-template-columns: repeat(5, minmax(0, 1fr));
                    gap: 12px;
                    margin-bottom: 14px;
                }
                .marketing-command-360-card {
                    padding: 14px;
                    border-radius: 14px;
                    border: 1px solid rgba(17,24,39,.07);
                    background: rgba(255,255,255,.88);
                    min-height: 132px;
                }
                .marketing-command-360-card > span {
                    width: 30px;
                    height: 30px;
                    display: grid;
                    place-items: center;
                    border-radius: 10px;
                    margin-bottom: 10px;
                    background: rgba(201,169,110,.12);
                    color: var(--gold);
                }
                .marketing-command-360-card strong {
                    display: block;
                    color: var(--text-primary);
                    font-family: Playfair Display, serif;
                    font-size: 1.3rem;
                    line-height: 1.06;
                    margin-bottom: 5px;
                }
                .marketing-command-360-card p {
                    margin: 0 0 5px;
                    color: var(--text-primary);
                    font-size: .78rem;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: .04em;
                }
                .marketing-command-360-card small {
                    color: var(--text-muted);
                    font-size: .72rem;
                    line-height: 1.35;
                }
                .marketing-command-360-card.tone-green > span { color: #22c55e; background: rgba(34,197,94,.1); }
                .marketing-command-360-card.tone-purple > span { color: #8b5cf6; background: rgba(139,92,246,.1); }
                .marketing-command-360-card.tone-pink > span { color: #ec4899; background: rgba(236,72,153,.1); }
                .marketing-command-360-card.tone-score {
                    background: #17120c;
                }
                .marketing-command-360-card.tone-score strong,
                .marketing-command-360-card.tone-score p {
                    color: #fffaf0;
                }
                .marketing-command-360-card.tone-score small {
                    color: rgba(255,250,240,.7);
                }
                .marketing-ai-report-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 12px;
                    margin-bottom: 14px;
                }
                .marketing-ai-report-card {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 14px;
                    padding: 14px;
                    border-radius: 14px;
                    border: 1px solid rgba(17,24,39,.07);
                    background: rgba(255,255,255,.82);
                }
                .marketing-ai-report-card span {
                    display: block;
                    color: var(--gold);
                    font-size: .66rem;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: .08em;
                    margin-bottom: 5px;
                }
                .marketing-ai-report-card strong {
                    display: block;
                    color: var(--text-primary);
                    font-size: .95rem;
                    line-height: 1.22;
                    margin-bottom: 6px;
                }
                .marketing-ai-report-card p {
                    margin: 0;
                    color: var(--text-muted);
                    font-size: .8rem;
                    line-height: 1.42;
                    display: -webkit-box;
                    -webkit-line-clamp: 3;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                .marketing-ai-report-card a {
                    flex: 0 0 auto;
                    color: #fffaf0;
                    background: #17120c;
                    border-radius: 999px;
                    padding: 8px 11px;
                    text-decoration: none;
                    font-size: .72rem;
                    font-weight: 900;
                }
                .marketing-ai-action-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 12px;
                }
                .marketing-ai-action-list {
                    border: 1px solid rgba(17,24,39,.07);
                    border-radius: 14px;
                    background: rgba(255,255,255,.78);
                    padding: 12px;
                }
                .marketing-ai-action-head {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 10px;
                    color: var(--text-primary);
                }
                .marketing-ai-action-head svg {
                    color: var(--gold);
                }
                .marketing-ai-action-row {
                    display: grid;
                    grid-template-columns: 58px minmax(0, 1fr);
                    gap: 10px;
                    align-items: start;
                    padding: 10px;
                    border-radius: 11px;
                    text-decoration: none;
                    color: var(--text-primary);
                    border: 1px solid transparent;
                    background: rgba(248,250,252,.72);
                    margin-bottom: 8px;
                }
                .marketing-ai-action-row:hover {
                    border-color: rgba(201,169,110,.35);
                }
                .marketing-ai-action-row > span {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 24px;
                    border-radius: 999px;
                    color: var(--gold);
                    background: rgba(201,169,110,.12);
                    font-size: .66rem;
                    font-weight: 900;
                    text-transform: uppercase;
                }
                .marketing-ai-action-row strong {
                    display: block;
                    font-size: .84rem;
                    line-height: 1.25;
                    margin-bottom: 4px;
                    color: var(--text-primary);
                }
                .marketing-ai-action-row small {
                    color: var(--text-muted);
                    font-size: .74rem;
                    line-height: 1.35;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                .marketing-command-empty {
                    padding: 14px;
                    border: 1px dashed var(--border-color);
                    border-radius: 11px;
                    color: var(--text-muted);
                    font-size: .82rem;
                    text-align: center;
                }
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
                    .marketing-command-360 {
                        padding: 14px;
                    }
                    .marketing-command-360 .marketing-section-title {
                        align-items: flex-start;
                        flex-wrap: wrap;
                    }
                    .marketing-command-refresh {
                        width: 100%;
                        margin-left: 0;
                    }
                    .marketing-command-card-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 8px;
                    }
                    .marketing-command-360-card {
                        min-height: 112px;
                        padding: 10px;
                    }
                    .marketing-command-360-card strong {
                        font-size: 1rem;
                    }
                    .marketing-command-360-card p {
                        font-size: .62rem;
                    }
                    .marketing-ai-report-grid,
                    .marketing-ai-action-grid {
                        grid-template-columns: 1fr;
                    }
                    .marketing-ai-report-card {
                        display: grid;
                    }
                }
            `}</style>
        </div>
    )
}

function formatMetric(value: number) {
    return value.toLocaleString('pt-BR')
}
