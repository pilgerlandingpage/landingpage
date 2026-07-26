'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
    Plus, Megaphone, DollarSign, Users, Target,
    TrendingUp, AlertTriangle, Brain, CheckCircle, AlertCircle, RefreshCw, Calendar,
    Eye, MousePointerClick, ArrowRight, Thermometer, History, ChevronDown, ChevronUp, X, Search, Sparkles
} from 'lucide-react'
import AdsCountdown from '@/components/admin/AdsCountdown'
import LeadClock from '@/components/admin/LeadClock'
import AdsChartFrame from '@/components/admin/AdsChartFrame'
import AdminLoadingState from '@/components/admin/AdminLoadingState'
import AdsTrackingSettingsCard from '@/components/admin/AdsTrackingSettingsCard'
import MetaAdsManagerView from '@/components/admin/MetaAdsManagerView'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts'
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
    created_at: string
    properties?: { title: string } | null
    latest_metrics?: {
        impressions: number
        clicks: number
        ctr: number
        spend: number
        leads_count: number
        cost_per_lead?: number
        cpm: number
        cpc: number
        reach?: number
        conversions?: number
        quality_ranking?: string
        engagement_rate_ranking?: string
        conversion_rate_ranking?: string
        snapshot_at?: string
        source?: 'live' | 'stored' | 'stored_historical'
    } | null
}

interface Alert {
    id: string
    campaign_id: string
    type: string
    urgency: string
    action_taken?: string
    message: string
    ai_reasoning?: string
    created_at: string
    campaign_name?: string
}

interface Report {
    id: string
    type: string
    date: string
    platform: string
    content_markdown: string
    performance_score: number | null
    created_at: string
}

interface PaidAiReport {
    id: string
    title: string
    summary: string | null
    period_start: string | null
    period_end: string | null
    insights: Array<{ title?: string; detail?: string; impact?: string }>
    recommendations: Array<{ title?: string; action?: string; priority?: string }>
    metrics: Record<string, unknown>
    created_at: string
}

interface LiveAccountStats {
    spend: number
    current_insights_spend: number
    lifetime_insights_spend: number
    account_amount_spent: number
    currency?: string
    timezone_name?: string
    source: 'insights' | 'account_amount_spent_delta'
}

interface MetaAccountHealth {
    account_id?: string
    name?: string
    status: number
    status_label: string
    disable_reason?: number
    currency?: string
    timezone_name?: string
    amount_spent?: number
    balance?: number
    is_active: boolean
    is_payment_issue: boolean
    severity: 'ok' | 'warning' | 'error'
    message: string
}

interface MetricsFallback {
    active: boolean
    campaignCount: number
    latestSnapshotAt: string | null
    mode: 'selected_period' | 'latest_historical'
}
type AdsManagerTab = 'campaigns' | 'adsets' | 'ads'
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

const PIE_COLORS = ['#c9a96e', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#ef4444', '#0ea5e9', '#14b8a6']

function formatCurrency(val: number) {
    return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function shortName(name: string, max = 18) {
    return name.length > max ? name.slice(0, max) + '...' : name
}

function formatDateOnly(value: string | null | undefined) {
    if (!value) return '-'
    return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    })
}

function formatDateTime(value: string | null | undefined) {
    if (!value) return '-'
    return new Date(value).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function metricNumber(metrics: Record<string, unknown> | null | undefined, key: string) {
    const raw = metrics?.[key]
    const parsed = typeof raw === 'number' ? raw : Number(raw || 0)
    return Number.isFinite(parsed) ? parsed : 0
}

function metricText(metrics: Record<string, unknown> | null | undefined, key: string) {
    const raw = metrics?.[key]
    return raw == null || raw === '' ? '-' : String(raw)
}

function cleanJsonBlock(value: string) {
    const cleaned = String(value || '')
        .replace(/```json\n?/gi, '')
        .replace(/```\n?/g, '')
        .trim()
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    return firstBrace >= 0 && lastBrace > firstBrace ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned
}

function decodeJsonString(value: string) {
    try {
        return JSON.parse(`"${value}"`)
    } catch {
        return value
            .replace(/\\"/g, '"')
            .replace(/\\n/g, '\n')
            .replace(/\\u00e1/g, 'á')
            .replace(/\\u00e9/g, 'é')
            .replace(/\\u00ed/g, 'í')
            .replace(/\\u00f3/g, 'ó')
            .replace(/\\u00fa/g, 'ú')
            .replace(/\\u00e3/g, 'ã')
            .replace(/\\u00f5/g, 'õ')
            .replace(/\\u00e7/g, 'ç')
    }
}

function extractJsonField(value: string, field: string) {
    const match = String(value || '').match(new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`))
    return match?.[1] ? decodeJsonString(match[1]).trim() : ''
}

function normalizePaidReport(report: PaidAiReport): PaidAiReport {
    const rawSummary = String(report.summary || '')
    let parsed: Partial<PaidAiReport> | null = null

    try {
        parsed = JSON.parse(cleanJsonBlock(rawSummary))
    } catch {
        parsed = null
    }

    const extractedTitle = parsed?.title || extractJsonField(rawSummary, 'title')
    const extractedSummary = parsed?.summary || extractJsonField(rawSummary, 'summary')

    return {
        ...report,
        title: extractedTitle || report.title,
        summary: extractedSummary || report.summary,
        insights: (report.insights || []).length > 0
            ? report.insights
            : Array.isArray(parsed?.insights) ? parsed.insights : [],
        recommendations: (report.recommendations || []).length > 0
            ? report.recommendations
            : Array.isArray((parsed as any)?.recommendations) ? (parsed as any).recommendations : [],
    }
}

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null
    return (
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 14px', fontSize: '0.8rem' }}>
            <p style={{ color: '#f5f5f5', fontWeight: 600, marginBottom: 4 }}>{label}</p>
            {payload.map((p: any, i: number) => (
                <p key={i} style={{ color: p.color, margin: 0 }}>
                    {p.name}: {typeof p.value === 'number' && p.name?.includes('R$') ? formatCurrency(p.value) : p.value?.toLocaleString('pt-BR')}
                </p>
            ))}
        </div>
    )
}
export default function AdsPage() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([])
    const [alerts, setAlerts] = useState<Alert[]>([])
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const [analyzing, setAnalyzing] = useState(false)
    const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all')
    const [datePreset, setDatePreset] = useState('today')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
    const [expandedAlert, setExpandedAlert] = useState<string | null>(null)
    const [reports, setReports] = useState<Report[]>([])
    const [latestScore, setLatestScore] = useState<number | null>(null)
    const [expandedReport, setExpandedReport] = useState<string | null>(null)
    const [showHistory, setShowHistory] = useState(false)
    const [internalStats, setInternalStats] = useState<{ totalLeads: number; recentLeads: any[] }>({ totalLeads: 0, recentLeads: [] })
    const [liveAccountStats, setLiveAccountStats] = useState<LiveAccountStats | null>(null)
    const [metaAccountHealth, setMetaAccountHealth] = useState<MetaAccountHealth | null>(null)
    const [metaConnectionIssue, setMetaConnectionIssue] = useState('')
    const [metricsFallback, setMetricsFallback] = useState<MetricsFallback | null>(null)
    const [paidReports, setPaidReports] = useState<PaidAiReport[]>([])
    const [paidReportLoading, setPaidReportLoading] = useState(false)
    const [paidReportError, setPaidReportError] = useState('')
    const [adsManagerTab, setAdsManagerTab] = useState<AdsManagerTab>('campaigns')
    const [campaignSearch, setCampaignSearch] = useState('')
    const [selectedCampaignId, setSelectedCampaignId] = useState('')
    const latestPaidReport = paidReports[0] || null
    const latestPaidMetrics = latestPaidReport?.metrics || null

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 4000)
    }

    const fetchData = async (preset?: string, start?: string, end?: string) => {
        const dp = preset || datePreset
        const s = start || startDate
        const e = end || endDate

        try {
            let url = `/api/admin/ads?date_preset=${dp}`
            if (dp === 'custom' && s && e) {
                url += `&start_date=${s}&end_date=${e}`
            }

            const [campRes, alertRes] = await Promise.all([
                fetch(url),
                fetch('/api/admin/ads?alerts=true'),
            ])
            if (campRes.ok) {
                const data = await campRes.json()
                setCampaigns(data.campaigns || [])
                setInternalStats(data.internalStats || { totalLeads: 0, recentLeads: [] })
                setLiveAccountStats(data.liveAccountStats || null)
                setMetaAccountHealth(data.accountHealth || null)
                setMetaConnectionIssue(data.metaConnectionIssue || '')
                setMetricsFallback(data.metricsFallback || null)
            }
            if (alertRes.ok) {
                const data = await alertRes.json()
                setAlerts(Array.isArray(data) ? data : [])
            }
        } catch { showToast('Erro ao carregar dados', 'error') }
        finally { setLoading(false) }
    }

    const handleDateChange = (newPreset: string) => {
        setDatePreset(newPreset)
        if (newPreset !== 'custom') {
            setLoading(true)
            fetchData(newPreset)
        }
    }

    const handleCustomDateSearch = () => {
        if (!startDate || !endDate) {
            showToast('Selecione ambas as datas', 'error')
            return
        }
        setLoading(true)
        fetchData('custom', startDate, endDate)
    }

    const handleSync = async () => {
        setSyncing(true)
        showToast('Sincronizando com a Meta...', 'success')
        try {
            const res = await fetch('/api/admin/ads/sync', { method: 'POST' })
            const data = await res.json()
            if (data.success) {
                showToast(data.message, 'success')
                await fetchData()
            } else {
                showToast(`Erro: ${data.error || 'Falha'}`, 'error')
            }
        } catch { showToast('Erro ao sincronizar', 'error') }
        finally { setSyncing(false) }
    }

    const handleAnalyze = async () => {
        setAnalyzing(true)
        showToast('Analisando campanhas com IA...', 'success')
        try {
            const res = await fetch('/api/admin/ads/analyze-ai', { method: 'POST' })
            const data = await res.json()
            if (data.success) {
                showToast(`Sucesso: ${data.message}`, 'success')
                await fetchData()
            } else {
                showToast(`Erro: ${data.error || 'Falha na análise'}`, 'error')
            }
        } catch { showToast('Erro ao analisar campanhas', 'error') }
        finally { setAnalyzing(false) }
    }

    const loadPaidReports = async () => {
        try {
            setPaidReportError('')
            const res = await fetch('/api/admin/paid-traffic/report?limit=5')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erro ao carregar relatorios pagos.')
            setPaidReports((data.reports || []).map(normalizePaidReport))
        } catch (err) {
            setPaidReportError(err instanceof Error ? err.message : 'Erro ao carregar relatorios pagos.')
        }
    }

    const handlePaidReport = async () => {
        setPaidReportLoading(true)
        setPaidReportError('')
        showToast('Gerando relatorio pago com IA...', 'success')

        try {
            const res = await fetch('/api/admin/paid-traffic/report?days=30', { method: 'POST' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erro ao gerar relatorio pago.')
            await loadPaidReports()
            showToast('Relatorio pago gerado com sucesso.', 'success')
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao gerar relatorio pago.'
            setPaidReportError(message)
            showToast(message, 'error')
        } finally {
            setPaidReportLoading(false)
        }
    }

    useEffect(() => { fetchData() }, [])

    useEffect(() => { loadPaidReports() }, [])

    // Fetch reports for Meta
    useEffect(() => {
        const fetchReports = async () => {
            try {
                const res = await fetch('/api/admin/reports?platform=meta&limit=50')
                if (res.ok) {
                    const data = await res.json()
                    setReports(data.reports || [])
                }
            } catch (err) { console.error('Error fetching meta reports:', err) }
        }
        fetchReports()
    }, [])

    // Dynamic Thermometer Score
    useEffect(() => {
        if (reports.length === 0) return

        const getReportForRange = () => {
            const spNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }))
            let since: string
            let until: string = spNow.toISOString().split('T')[0]

            if (datePreset === 'today') {
                since = until
            } else if (datePreset === 'yesterday') {
                since = new Date(spNow.getTime() - 86400000).toISOString().split('T')[0]
                until = since
            } else if (datePreset === 'last_7d') {
                since = new Date(spNow.getTime() - 7 * 86400000).toISOString().split('T')[0]
            } else if (datePreset === 'last_30d') {
                since = new Date(spNow.getTime() - 30 * 86400000).toISOString().split('T')[0]
            } else if (datePreset === 'custom' && startDate && endDate) {
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

        const relevantReport = getReportForRange()
        if (relevantReport?.performance_score != null) {
            setLatestScore(relevantReport.performance_score)
        }
    }, [datePreset, reports, startDate, endDate])

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

    function renderMarkdown(md: string): string {
        let html = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        html = html.replace(/^### (.+)$/gm, '<h4 style="margin:16px 0 8px;color:var(--gold);font-size:1.05rem">$1</h4>')
        html = html.replace(/^## (.+)$/gm, '<h3 style="margin:20px 0 8px;color:var(--text-primary);font-size:1.2rem">$1</h3>')
        html = html.replace(/^# (.+)$/gm, '<h2 style="margin:24px 0 12px;color:var(--text-primary);font-size:1.4rem">$1</h2>')
        html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text-primary)">$1</strong>')
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
        html = html.replace(/^[\-\*] (.+)$/gm, '<li style="margin:4px 0;padding-left:4px">$1</li>')
        html = html.replace(/((<li[^>]*>.*<\/li>\n?)+)/g, (m) => `<ul style="margin:8px 0 8px 24px;padding:0;list-style:disc">${m}</ul>`)
        html = html.replace(/^\d+\.\s+(.+)$/gm, '<li style="margin:4px 0;padding-left:4px">$1</li>')
        html = html.replace(/\n\n/g, '</p><p style="margin:8px 0">')
        html = html.replace(/\n/g, '<br/>')
        return `<p style="margin:8px 0">${html}</p>`
    }

    const filteredCampaigns = campaigns.filter(c =>
        filter === 'all' ||
        (filter === 'active' && c.status === 'active') ||
        (filter === 'paused' && c.status === 'paused')
    )
    const campaignSearchTerm = campaignSearch.trim().toLowerCase()
    const managerCampaigns = filteredCampaigns.filter(campaign => {
        if (!campaignSearchTerm) return true
        const haystack = [
            campaign.name,
            campaign.status,
            campaign.properties?.title || '',
            campaign.latest_metrics?.quality_ranking || '',
            campaign.latest_metrics?.source || '',
        ].join(' ').toLowerCase()
        return haystack.includes(campaignSearchTerm)
    })
    const selectedCampaign = managerCampaigns.find(campaign => campaign.id === selectedCampaignId) || managerCampaigns[0] || null
    const selectedMetrics = selectedCampaign?.latest_metrics || null
    const selectedStatus = selectedCampaign ? STATUS_MAP[selectedCampaign.status] || STATUS_MAP.draft : STATUS_MAP.draft
    const activeCampaigns = campaigns.filter(campaign => campaign.status === 'active').length
    const pausedCampaigns = campaigns.filter(campaign => campaign.status === 'paused').length
    const draftCampaigns = campaigns.filter(campaign => campaign.status === 'draft').length
    const selectedCampaignAlerts = selectedCampaign
        ? alerts.filter(alert => alert.campaign_id === selectedCampaign.id || alert.campaign_name === selectedCampaign.name)
        : []
    const adsManagerTabs: Array<{ key: AdsManagerTab; label: string; count: number }> = [
        { key: 'campaigns', label: 'Campanhas', count: managerCampaigns.length },
        { key: 'adsets', label: 'Conjuntos de anuncios', count: 0 },
        { key: 'ads', label: 'Anuncios', count: 0 },
    ]
    const campaignSpend = filteredCampaigns.reduce((s, c) => s + (c.latest_metrics?.spend || 0), 0)
    const liveTodaySpend = datePreset === 'today' ? liveAccountStats?.spend || 0 : 0
    const usesLiveSpendFallback = datePreset === 'today' && liveTodaySpend > campaignSpend
    const totalSpend = usesLiveSpendFallback ? liveTodaySpend : campaignSpend
    const metaAccountNeedsAttention = Boolean(metaAccountHealth && metaAccountHealth.severity !== 'ok')
    const totalImpressions = filteredCampaigns.reduce((s, c) => s + (c.latest_metrics?.impressions || 0), 0)
    const totalClicks = filteredCampaigns.reduce((s, c) => s + (c.latest_metrics?.clicks || 0), 0)
    const totalReach = filteredCampaigns.reduce((s, c) => s + (c.latest_metrics?.reach || 0), 0)
    const totalConversions = filteredCampaigns.reduce((s, c) => s + (c.latest_metrics?.conversions || c.latest_metrics?.leads_count || 0), 0)
    const totalLeads = filteredCampaigns.reduce((s, c) => s + (c.latest_metrics?.leads_count || 0), 0)
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const avgCpa = totalConversions > 0 ? totalSpend / totalConversions : (totalLeads > 0 ? totalSpend / totalLeads : 0)
    const avgCpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0

    const spendBarData = filteredCampaigns
        .filter(c => c.latest_metrics?.spend)
        .sort((a, b) => (b.latest_metrics?.spend || 0) - (a.latest_metrics?.spend || 0))
        .slice(0, 8)
        .map(c => ({
            name: shortName(c.name),
            'R$ Gasto': c.latest_metrics?.spend || 0,
            'Conversões': c.latest_metrics?.conversions || c.latest_metrics?.leads_count || 0,
        }))

    const performanceData = filteredCampaigns
        .filter(c => c.latest_metrics)
        .sort((a, b) => (b.latest_metrics?.reach || 0) - (a.latest_metrics?.reach || 0))
        .slice(0, 8)
        .map(c => ({
            name: shortName(c.name),
            'Impressões': c.latest_metrics?.impressions || 0,
            Alcance: c.latest_metrics?.reach || 0,
            Cliques: c.latest_metrics?.clicks || 0,
        }))
    const spendPieData = filteredCampaigns
        .filter(c => c.latest_metrics?.spend && c.latest_metrics.spend > 0)
        .sort((a, b) => (b.latest_metrics?.spend || 0) - (a.latest_metrics?.spend || 0))
        .map(c => ({
            name: shortName(c.name, 22),
            value: c.latest_metrics?.spend || 0,
        }))
    const cpaData = filteredCampaigns
        .filter(c => c.latest_metrics?.cost_per_lead && c.latest_metrics.cost_per_lead > 0)
        .sort((a, b) => (a.latest_metrics?.cost_per_lead || 0) - (b.latest_metrics?.cost_per_lead || 0))
        .slice(0, 8)
        .map(c => ({
            name: shortName(c.name),
            CPA: Number((c.latest_metrics?.cost_per_lead || 0).toFixed(2)),
        }))

    if (loading) {
        return <AdminLoadingState message="Carregando métricas de tráfego..." />
    }

    const useAdsManagerLayout = process.env.NEXT_PUBLIC_ADS_MANAGER_LAYOUT !== 'legacy'

    if (useAdsManagerLayout) {
        return (
            <MetaAdsManagerView
                campaigns={campaigns}
                alerts={alerts}
                reports={reports}
                paidReports={paidReports}
                paidReportError={paidReportError}
                paidReportLoading={paidReportLoading}
                toast={toast}
                datePreset={datePreset}
                startDate={startDate}
                endDate={endDate}
                filter={filter}
                adsManagerTab={adsManagerTab}
                campaignSearch={campaignSearch}
                selectedCampaignId={selectedCampaignId}
                showHistory={showHistory}
                expandedReport={expandedReport}
                syncing={syncing}
                analyzing={analyzing}
                liveAccountStats={liveAccountStats}
                metaAccountHealth={metaAccountHealth}
                metaConnectionIssue={metaConnectionIssue}
                metricsFallback={metricsFallback}
                latestScore={latestScore}
                onDatePresetChange={handleDateChange}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onCustomDateSearch={handleCustomDateSearch}
                onSync={handleSync}
                onAnalyze={handleAnalyze}
                onPaidReport={handlePaidReport}
                onFilterChange={setFilter}
                onTabChange={setAdsManagerTab}
                onCampaignSearchChange={setCampaignSearch}
                onSelectedCampaignChange={setSelectedCampaignId}
                onShowHistoryChange={setShowHistory}
                onExpandedReportChange={setExpandedReport}
                onNotify={showToast}
                renderMarkdown={renderMarkdown}
            />
        )
    }

    return (
        <div>
            {/* Toast */}
            {toast && (
                <div className={`ads-toast ${toast.type}`}>
                    {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="admin-header">
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Megaphone size={26} /> Meta Ads
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
                        {filteredCampaigns.length} campanha(s) • Atualizado em {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
                <div className="ads-header-actions" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Calendar size={16} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <select value={datePreset} onChange={e => handleDateChange(e.target.value)}
                            className="ads-date-select">
                            <option value="today">Hoje</option>
                            <option value="yesterday">Ontem</option>
                            <option value="last_7d">Últimos 7 Dias</option>
                            <option value="last_30d">Últimos 30 Dias</option>
                            <option value="this_month">Este Mês</option>
                            <option value="last_month">Mês Passado</option>
                            <option value="maximum">Vitalício</option>
                            <option value="custom">Personalizado</option>
                        </select>
                    </div>
                    
                    {datePreset === 'custom' && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={e => setStartDate(e.target.value)}
                                className="ads-date-input"
                            />
                            <span style={{ color: 'var(--text-muted)' }}>até</span>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={e => setEndDate(e.target.value)}
                                className="ads-date-input"
                            />
                            <button onClick={handleCustomDateSearch} className="btn-gold" style={{ padding: '4px 12px', fontSize: '0.8rem' }}>
                                <Search size={14} />
                            </button>
                        </div>
                    )}

                    <button onClick={handleSync} disabled={syncing}
                        className="btn" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <RefreshCw size={18} className={syncing ? 'spin' : ''} />
                        {syncing ? 'Sincronizando...' : 'Sincronizar'}
                    </button>
                    <button onClick={handleAnalyze} disabled={analyzing || campaigns.length === 0}
                        className="btn" style={{
                            background: analyzing ? 'rgba(139, 92, 246, 0.15)' : 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(201, 169, 110, 0.15))',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                            color: '#a78bfa',
                            display: 'flex', alignItems: 'center', gap: 8,
                            transition: 'all 0.3s'
                        }}>
                        <Brain size={18} className={analyzing ? 'spin' : ''} />
                        {analyzing ? 'Analisando...' : 'Analisar com IA'}
                    </button>
                    <Link href="/admin/ads/relatorio"
                        className="btn" style={{
                            background: '#17120c',
                            border: '1px solid rgba(201, 169, 110, 0.45)',
                            color: '#fffaf0',
                            display: 'flex', alignItems: 'center', gap: 8,
                            textDecoration: 'none',
                        }}>
                        <Sparkles size={18} />
                        Gestor IA
                    </Link>
                    <Link href="/admin/ads/vitor"
                        className="btn" style={{
                            background: 'rgba(201, 169, 110, 0.12)',
                            border: '1px solid rgba(201, 169, 110, 0.35)',
                            color: 'var(--gold)',
                            display: 'flex', alignItems: 'center', gap: 8,
                            textDecoration: 'none',
                        }}>
                        <Brain size={18} />
                        Vitor
                    </Link>
                    <Link href="/admin/ads/new" className="btn btn-gold" style={{ textDecoration: 'none' }}>
                        <Plus size={18} /> Nova Campanha
                    </Link>
                </div>
            </div>

            {metaAccountNeedsAttention && metaAccountHealth && (
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '14px 16px',
                    borderRadius: 14,
                    marginBottom: 18,
                    background: metaAccountHealth.severity === 'error' ? 'rgba(239,68,68,.08)' : 'rgba(245,158,11,.09)',
                    border: `1px solid ${metaAccountHealth.severity === 'error' ? 'rgba(239,68,68,.28)' : 'rgba(245,158,11,.28)'}`,
                    color: 'var(--text-primary)',
                }}>
                    <AlertTriangle size={21} color={metaAccountHealth.severity === 'error' ? '#ef4444' : '#f59e0b'} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                        <strong style={{ display: 'block', marginBottom: 4 }}>
                            {metaAccountHealth.is_payment_issue ? 'Conta Meta com pendencia de pagamento' : 'Conta Meta precisa de atencao'}
                        </strong>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '.86rem', lineHeight: 1.45 }}>
                            {metaAccountHealth.message} Status: {metaAccountHealth.status_label} ({metaAccountHealth.status}).
                            {' '}Enquanto isso, a Meta pode pausar entregas, zerar campanhas do dia ou atrasar insights.
                        </p>
                    </div>
                </div>
            )}

            {metaConnectionIssue && (
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '14px 16px',
                    borderRadius: 14,
                    marginBottom: 18,
                    background: 'rgba(245,158,11,.08)',
                    border: '1px solid rgba(245,158,11,.26)',
                    color: 'var(--text-primary)',
                }}>
                    <AlertTriangle size={21} color="#f59e0b" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                        <strong style={{ display: 'block', marginBottom: 4 }}>
                            Meta Ads sem leitura ao vivo
                        </strong>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '.86rem', lineHeight: 1.45 }}>
                            {metaConnectionIssue}
                            {metricsFallback?.active && (
                                <>
                                    {' '}Enquanto isso, o painel esta exibindo {metricsFallback.campaignCount} campanha(s) com o ultimo historico salvo
                                    {metricsFallback.latestSnapshotAt ? ` em ${formatDateTime(metricsFallback.latestSnapshotAt)}` : ''}.
                                    {metricsFallback.mode === 'latest_historical' ? ' Esses numeros podem nao representar o periodo selecionado.' : ''}
                                </>
                            )}
                        </p>
                    </div>
                </div>
            )}

            <AdsTrackingSettingsCard platform="meta" onNotify={showToast} />

            <div className="ads-top-cards-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <AdsCountdown noMargin />
                <LeadClock recentLeads={internalStats.recentLeads} />
            </div>

            {/* KPI Cards */}
            <div className="kpi-grid ads-kpi-grid" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', 
                gap: '12px', 
                marginBottom: 24 
            }}>
                <div className="kpi-card">
                    <DollarSign size={20} color="#22c55e" style={{ marginBottom: 8 }} />
                    <div className="kpi-label">Gasto Total</div>
                    <div className="kpi-value" style={{ color: '#22c55e', fontSize: '1.4rem' }}>{formatCurrency(totalSpend)}</div>
                    {usesLiveSpendFallback && (
                        <div style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: '.68rem', lineHeight: 1.25 }}>
                            Estimativa ao vivo Meta
                        </div>
                    )}
                </div>
                <div className="kpi-card">
                    <Eye size={20} color="#6366f1" style={{ marginBottom: 8 }} />
                    <div className="kpi-label">Impressões</div>
                    <div className="kpi-value" style={{ fontSize: '1.4rem' }}>{totalImpressions.toLocaleString('pt-BR')}</div>
                </div>
                <div className="kpi-card">
                    <Users size={20} color="#3b82f6" style={{ marginBottom: 8 }} />
                    <div className="kpi-label">Alcance</div>
                    <div className="kpi-value" style={{ color: '#3b82f6', fontSize: '1.4rem' }}>{totalReach.toLocaleString('pt-BR')}</div>
                </div>
                <div className="kpi-card">
                    <MousePointerClick size={20} color="#c9a96e" style={{ marginBottom: 8 }} />
                    <div className="kpi-label">Cliques</div>
                    <div className="kpi-value" style={{ fontSize: '1.4rem' }}>{totalClicks.toLocaleString('pt-BR')}</div>
                </div>
                <div className="kpi-card">
                    <TrendingUp size={20} color="#f59e0b" style={{ marginBottom: 8 }} />
                    <div className="kpi-label">CTR Médio</div>
                    <div className="kpi-value" style={{ color: '#f59e0b', fontSize: '1.4rem' }}>{avgCtr.toFixed(2)}%</div>
                </div>
                <div className="kpi-card" style={{ background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), transparent)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                    <Plus size={20} color="#22c55e" style={{ marginBottom: 8 }} />
                    <div className="kpi-label" style={{ color: '#22c55e', fontWeight: 600 }}>Leads Reais (DB)</div>
                    <div className="kpi-value" style={{ color: '#22c55e', fontSize: '1.6rem' }}>{internalStats.totalLeads}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4 }}>Capturados internamente</div>
                </div>
                <div className="kpi-card">
                    <CheckCircle size={20} color="#8b5cf6" style={{ marginBottom: 8 }} />
                    <div className="kpi-label">Leads (Meta)</div>
                    <div className="kpi-value" style={{ color: '#8b5cf6', fontSize: '1.4rem' }}>{totalConversions.toLocaleString('pt-BR')}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4 }}>Reportado pela plataforma</div>
                </div>
                <div className="kpi-card">
                    <Target size={20} color="#ec4899" style={{ marginBottom: 8 }} />
                    <div className="kpi-label">CPA (Meta)</div>
                    <div className="kpi-value" style={{ color: '#ec4899', fontSize: '1.4rem' }}>{avgCpa > 0 ? formatCurrency(avgCpa) : '-'}</div>
                </div>
                <div className="kpi-card">
                    <DollarSign size={20} color="#0ea5e9" style={{ marginBottom: 8 }} />
                    <div className="kpi-label">CPM Médio</div>
                    <div className="kpi-value" style={{ color: '#0ea5e9', fontSize: '1.4rem' }}>{formatCurrency(avgCpm)}</div>
                </div>
                {/* Thermometer as compact KPI card */}
                {latestScore != null && (
                    <div className="kpi-card" style={{ position: 'relative', textAlign: 'center' }}>
                        <div style={{ position: 'relative', width: 56, height: 56, margin: '0 auto 6px' }}>
                            <svg viewBox="0 0 56 56" width="56" height="56">
                                <circle cx="28" cy="28" r="24" fill="none" stroke="var(--border-color)" strokeWidth="5" />
                                <circle cx="28" cy="28" r="24" fill="none" stroke={getScoreColor(latestScore)} strokeWidth="5"
                                    strokeDasharray={`${(latestScore / 100) * 150.8} 150.8`}
                                    strokeLinecap="round" transform="rotate(-90 28 28)"
                                    style={{ transition: 'stroke-dasharray 1s ease-out' }} />
                            </svg>
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: getScoreColor(latestScore), fontFamily: 'Playfair Display, serif', lineHeight: 1 }}>{latestScore}</span>
                            </div>
                        </div>
                        <div className="kpi-label">Termômetro IA</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: getScoreColor(latestScore), marginTop: 2 }}>
                            {getScoreEmoji(latestScore)} {getScoreLabel(latestScore)}
                        </div>
                    </div>
                )}
            </div>

            <div className="chart-card paid-agent-brief" style={{
                marginBottom: 18,
                border: '1px solid rgba(201,169,110,.18)',
                background: 'linear-gradient(135deg, #fff, #fbfaf7)',
                padding: 16,
            }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(280px,.9fr)', gap: 16, alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ color: 'var(--gold)', fontSize: '.68rem', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 5 }}>
                            Gestor de trafego pago IA
                        </div>
                        <div className="chart-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <Sparkles size={18} /> Relatorio executivo
                        </div>
                        {latestPaidReport ? (
                            <>
                                <div style={{ fontSize: '.95rem', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {latestPaidReport.title}
                                </div>
                                <p style={{ margin: '5px 0 0', color: 'var(--text-muted)', fontSize: '.82rem', lineHeight: 1.4, maxWidth: 980 }}>
                                    {latestPaidReport.summary}
                                </p>
                                <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: '.72rem', fontWeight: 700 }}>
                                    Periodo: {formatDateOnly(latestPaidReport.period_start)} a {formatDateOnly(latestPaidReport.period_end)}
                                </div>
                            </>
                        ) : (
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '.84rem' }}>
                                O agente ainda nao gerou um relatorio executivo de trafego pago.
                            </p>
                        )}
                    </div>
                    <div style={{ display: 'grid', gap: 10 }}>
                        <div className="paid-agent-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
                            <div>
                                <span>Score</span>
                                <strong>{metricText(latestPaidMetrics, 'health_score')}</strong>
                            </div>
                            <div>
                                <span>Campanhas</span>
                                <strong>{metricNumber(latestPaidMetrics, 'campaigns_with_metrics') || filteredCampaigns.filter(c => c.latest_metrics).length}</strong>
                            </div>
                            <div>
                                <span>Risco</span>
                                <strong>{metricText(latestPaidMetrics, 'main_risk')}</strong>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <button onClick={handlePaidReport} disabled={paidReportLoading} className="btn btn-gold" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                                <Sparkles size={16} className={paidReportLoading ? 'spin' : ''} />
                                {paidReportLoading ? 'Gerando...' : 'Gerar analise'}
                            </button>
                            <Link href="/admin/ads/relatorio" className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                                Ver relatorio completo <ArrowRight size={16} />
                            </Link>
                        </div>
                    </div>
                </div>

                {paidReportError && (
                    <div style={{
                        marginTop: 12,
                        padding: '10px 12px',
                        borderRadius: 10,
                        color: '#b91c1c',
                        background: 'rgba(239,68,68,.08)',
                        border: '1px solid rgba(239,68,68,.18)',
                        fontSize: '.82rem',
                        fontWeight: 700,
                    }}>
                        {paidReportError}
                    </div>
                )}
            </div>

            {/* History Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24, marginTop: 8 }}>
                <button onClick={() => setShowHistory(true)}
                    className="btn btn-outline"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', padding: '8px 16px', borderRadius: 10 }}>
                    <History size={16} color="var(--gold)" />
                    📜 Histórico de Análises IA
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>({reports.length})</span>
                </button>
            </div>

            {/* Charts Row 1: Spend Bar + Spend Pie */}
            {spendBarData.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24, marginBottom: 24 }}>
                    <div className="chart-card">
                        <div className="chart-title">📊 Gasto e conversões por campanha</div>
                        <AdsChartFrame>
                            {({ width, height, isCompact }) => (
                            <BarChart width={width} height={height} data={spendBarData} margin={{ top: 8, right: isCompact ? 6 : 16, left: isCompact ? -22 : 0, bottom: isCompact ? 4 : 8 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                                <XAxis dataKey="name" stroke="#666" fontSize={isCompact ? 9 : 11} angle={isCompact ? 0 : -20} textAnchor={isCompact ? 'middle' : 'end'} height={isCompact ? 36 : 60} interval={0} />
                                <YAxis yAxisId="left" stroke="#666" fontSize={isCompact ? 9 : 11} width={isCompact ? 42 : 60} />
                                <YAxis yAxisId="right" orientation="right" stroke="#666" fontSize={isCompact ? 9 : 11} width={isCompact ? 32 : 60} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: isCompact ? 10 : 12 }} />
                                <Bar yAxisId="left" dataKey="R$ Gasto" fill="#f59e0b" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={900} />
                                <Bar yAxisId="right" dataKey="Conversões" fill="#22c55e" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={900} animationBegin={120} />
                            </BarChart>
                            )}
                        </AdsChartFrame>
                    </div>

                    <div className="chart-card">
                        <div className="chart-title">🧩 Distribuição de gasto</div>
                        {spendPieData.length > 0 ? (
                            <AdsChartFrame>
                                {({ width, height, isCompact }) => (
                                <PieChart width={width} height={height}>
                                    <Pie
                                        key={`spend-pie-${width}-${spendPieData.map(item => item.value).join('-')}`}
                                        data={spendPieData}
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={isCompact ? Math.min(64, width * 0.22) : 95}
                                        innerRadius={isCompact ? Math.min(28, width * 0.1) : 45}
                                        dataKey="value"
                                        paddingAngle={2}
                                        label={({ name, percent }: any) => {
                                            if (isCompact && percent < 0.035) return ''
                                            return `${shortName(name, isCompact ? 10 : 22)} ${(percent * 100).toFixed(0)}%`
                                        }}
                                        labelLine={{ stroke: '#555' }}
                                        isAnimationActive
                                        animationBegin={120}
                                        animationDuration={1300}
                                        animationEasing="ease-out"
                                    >
                                        {spendPieData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(v: any) => formatCurrency(v)}
                                        contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8 }}
                                        itemStyle={{ color: '#f5f5f5' }}
                                    />
                                </PieChart>
                                )}
                            </AdsChartFrame>
                        ) : (
                            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                Sem dados de gasto
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Charts Row 2: Performance + CPA */}
            {performanceData.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                    <div className="chart-card">
                        <div className="chart-title">📈 Performance por Campanha</div>
                        <AdsChartFrame>
                            {({ width, height, isCompact }) => (
                            <AreaChart width={width} height={height} data={performanceData} margin={{ top: 8, right: isCompact ? 8 : 16, left: isCompact ? -18 : 0, bottom: isCompact ? 4 : 8 }}>
                                <defs>
                                    <linearGradient id="gradImpr" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gradReach" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                                <XAxis dataKey="name" stroke="#666" fontSize={isCompact ? 9 : 11} angle={isCompact ? 0 : -20} textAnchor={isCompact ? 'middle' : 'end'} height={isCompact ? 36 : 60} interval={0} />
                                <YAxis stroke="#666" fontSize={isCompact ? 9 : 11} width={isCompact ? 42 : 60} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: isCompact ? 10 : 12 }} />
                                <Area type="monotone" dataKey="Impressões" stroke="#6366f1" fill="url(#gradImpr)" strokeWidth={2} isAnimationActive animationDuration={950} />
                                <Area type="monotone" dataKey="Alcance" stroke="#3b82f6" fill="url(#gradReach)" strokeWidth={2} isAnimationActive animationDuration={950} animationBegin={100} />
                                <Area type="monotone" dataKey="Cliques" stroke="#22c55e" fill="rgba(34,197,94,0.1)" strokeWidth={2} isAnimationActive animationDuration={950} animationBegin={200} />
                            </AreaChart>
                            )}
                        </AdsChartFrame>
                    </div>

                    {cpaData.length > 0 && (
                        <div className="chart-card">
                            <div className="chart-title">🎯 CPA por Campanha (menor = melhor)</div>
                            <AdsChartFrame>
                                {({ width, height, isCompact }) => (
                                <BarChart width={width} height={height} data={cpaData} layout="vertical" margin={{ top: 8, right: isCompact ? 8 : 16, left: isCompact ? 0 : 8, bottom: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                                    <XAxis type="number" stroke="#666" fontSize={isCompact ? 9 : 11} />
                                    <YAxis dataKey="name" type="category" stroke="#666" fontSize={isCompact ? 9 : 11} width={isCompact ? 82 : 130} />
                                    <Tooltip formatter={(v: any) => formatCurrency(v)}
                                        contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8 }}
                                        itemStyle={{ color: '#f5f5f5' }} />
                                    <Bar dataKey="CPA" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={900}>
                                        {cpaData.map((entry, index) => (
                                            <Cell key={index} fill={entry.CPA < avgCpa ? '#22c55e' : entry.CPA > avgCpa * 1.5 ? '#ef4444' : '#f59e0b'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                                )}
                            </AdsChartFrame>
                        </div>
                    )}
                </div>
            )}

            {/* Campaign List + Alerts */}
            <div style={{ display: 'grid', gridTemplateColumns: campaigns.length > 0 ? '2fr 1fr' : '1fr', gap: 24 }}>
                {/* Campaigns */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div className="chart-title" style={{ marginBottom: 0 }}>📋 Campanhas</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {(['all', 'active', 'paused'] as const).map(f => (
                                <button key={f} onClick={() => setFilter(f)}
                                    style={{
                                        padding: '4px 12px', borderRadius: 50, fontSize: '0.8rem', fontWeight: 600,
                                        border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                                        background: filter === f ? (f === 'active' ? '#22c55e' : f === 'paused' ? '#f59e0b' : 'var(--gold)') : 'var(--bg-secondary)',
                                        color: filter === f ? '#fff' : 'var(--text-muted)'
                                    }}>
                                    {f === 'all' ? 'Todas' : f === 'active' ? 'Ativas' : 'Pausadas'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {filteredCampaigns.length === 0 ? (
                        <div className="chart-card" style={{ textAlign: 'center', padding: '60px 24px' }}>
                            <Megaphone size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
                            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: 8 }}>Nenhuma campanha encontrada</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                {campaigns.length === 0 ? 'Clique em "Nova Campanha" para começar.' : 'Altere o filtro para ver outras campanhas.'}
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: 10 }}>
                            {filteredCampaigns.map(camp => {
                                const st = STATUS_MAP[camp.status] || STATUS_MAP.draft
                                const m = camp.latest_metrics
                                const periodSpend = m?.spend || 0
                                return (
                                    <Link key={camp.id} href={`/admin/ads/${camp.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                        <div className="ads-campaign-card">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                                                        <span className="ads-badge" style={{ background: `${st.color}22`, color: st.color }}>{st.label}</span>
                                                        <span className="ads-badge" style={{
                                                            background: 'rgba(59,130,246,0.1)',
                                                            color: '#3b82f6'
                                                        }}>Meta</span>
                                                        {camp.ai_auto_manage && (
                                                            <span className="ads-badge" style={{ background: 'rgba(201,169,110,0.1)', color: 'var(--gold)' }}>
                                                                <Brain size={10} /> IA
                                                            </span>
                                                        )}
                                                        {m?.quality_ranking && (
                                                            <span className="ads-badge" style={{
                                                                background: m.quality_ranking.includes('ABOVE') ? 'rgba(34,197,94,0.1)' : m.quality_ranking.includes('BELOW') ? 'rgba(239,68,68,0.1)' : 'rgba(148,163,184,0.1)',
                                                                color: m.quality_ranking.includes('ABOVE') ? '#22c55e' : m.quality_ranking.includes('BELOW') ? '#ef4444' : '#94a3b8',
                                                            }}>
                                                                {m.quality_ranking.includes('ABOVE') ? '★ Alto' : m.quality_ranking.includes('BELOW') ? '▼ Baixo' : '■ Médio'}
                                                            </span>
                                                        )}
                                                        {m?.source && m.source !== 'live' && (
                                                            <span className="ads-badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309' }}>
                                                                Historico salvo
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontWeight: 600, fontSize: '1.05rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {camp.name}
                                                    </div>
                                                    {m?.snapshot_at && (
                                                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                                            Snapshot: {formatDateTime(m.snapshot_at)}
                                                        </div>
                                                    )}
                                                    {!m && (
                                                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                                            Sem metricas salvas para esta campanha.
                                                        </div>
                                                    )}
                                                    {camp.properties?.title && (
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>🏷️ {camp.properties.title}</div>
                                                    )}
                                                </div>
                                                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                        Gasto
                                                    </div>
                                                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: periodSpend > 0 ? 'var(--gold)' : 'var(--text-muted)', fontFamily: 'Playfair Display, serif' }}>
                                                        {formatCurrency(periodSpend)}
                                                    </div>
                                                    <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                                                </div>
                                            </div>

                                            {/* Metrics bar */}
                                            {m && (
                                                <div className="ads-metrics-bar">
                                                    <div><span>Gasto:</span> <strong>{formatCurrency(m.spend)}</strong></div>
                                                    <div><span>Alcance:</span> <strong>{m.reach?.toLocaleString('pt-BR') || '-'}</strong></div>
                                                    <div><span>Cliques:</span> <strong>{m.clicks?.toLocaleString('pt-BR') || '0'}</strong></div>
                                                    <div><span>Conv:</span> <strong>{m.conversions || m.leads_count || 0}</strong></div>
                                                    <div><span>CTR:</span> <strong>{(m.ctr * 100).toFixed(2)}%</strong></div>
                                                    <div><span>CPA:</span> <strong>{m.cost_per_lead ? formatCurrency(m.cost_per_lead) : '-'}</strong></div>
                                                </div>
                                            )}
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* AI Alerts Feed */}
                {campaigns.length > 0 && (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <div className="chart-title" style={{ marginBottom: 0 }}>🤖 Diagnóstico da IA</div>
                            {alerts.length > 0 && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '3px 10px', borderRadius: 20 }}>
                                    {alerts.length} alerta(s)
                                </span>
                            )}
                        </div>
                        {alerts.length === 0 ? (
                            <div className="chart-card" style={{ textAlign: 'center', padding: '40px 16px' }}>
                                <Brain size={32} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhum diagnóstico ainda</p>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Clique em &quot;🧠 Analisar com IA&quot; para gerar diagnósticos</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: 8, maxHeight: 600, overflowY: 'auto', paddingRight: 4 }}>
                                {alerts.slice(0, 15).map(alert => {
                                    const isExpanded = expandedAlert === alert.id
                                    const actionIcon = alert.action_taken === 'PAUSE_AD' ? '⏸️' :
                                        alert.action_taken === 'SCALE_BUDGET' ? '📈' :
                                        alert.action_taken === 'REDUCE_BUDGET' ? '📉' :
                                        alert.action_taken === 'SWAP_CREATIVE' ? '🎨' : null
                                    const typeIcon = alert.type === 'action' ? '⚡' :
                                        alert.type === 'warning' ? '⚠️' :
                                        alert.type === 'budget_alert' ? '💰' : '💡'
                                    const urgencyLabel: Record<string, string> = {
                                        low: '🟢 Baixa', medium: '🟡 Média', high: '🟠 Alta', critical: '🔴 Crítica'
                                    }

                                    return (
                                        <div key={alert.id}
                                            className="chart-card ai-alert-card"
                                            style={{ padding: 14, borderLeft: `3px solid ${URGENCY_COLOR[alert.urgency] || '#94a3b8'}`, cursor: alert.ai_reasoning ? 'pointer' : 'default' }}
                                            onClick={() => alert.ai_reasoning && setExpandedAlert(isExpanded ? null : alert.id)}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                                <span style={{ fontSize: '0.85rem' }}>{typeIcon}</span>
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{alert.type}</span>
                                                {actionIcon && (
                                                    <span style={{
                                                        fontSize: '0.65rem', padding: '1px 6px', borderRadius: 4,
                                                        background: alert.action_taken === 'SCALE_BUDGET' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                                                        color: alert.action_taken === 'SCALE_BUDGET' ? '#22c55e' : '#ef4444'
                                                    }}>
                                                        {actionIcon} {alert.action_taken?.replace('_', ' ')}
                                                    </span>
                                                )}
                                                <span style={{ fontSize: '0.65rem', marginLeft: 'auto', fontWeight: 600, color: URGENCY_COLOR[alert.urgency] }}>
                                                    {urgencyLabel[alert.urgency] || alert.urgency}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                                {alert.message}
                                            </div>
                                            {alert.ai_reasoning && isExpanded && (
                                                <div style={{
                                                    marginTop: 10, padding: '10px 12px',
                                                    background: 'rgba(139, 92, 246, 0.06)',
                                                    border: '1px solid rgba(139, 92, 246, 0.15)',
                                                    borderRadius: 8, fontSize: '0.78rem',
                                                    color: 'var(--text-muted)', lineHeight: 1.5
                                                }}>
                                                    <div style={{ fontWeight: 600, color: '#a78bfa', marginBottom: 4, fontSize: '0.7rem' }}>RACIOCÍNIO DA IA</div>
                                                    {alert.ai_reasoning}
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                                    {new Date(alert.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {alert.ai_reasoning && (
                                                    <span style={{ fontSize: '0.65rem', color: '#a78bfa' }}>
                                                        {isExpanded ? 'Recolher' : 'Ver raciocínio'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal de Histórico de Relatórios */}
            {showHistory && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 99999, padding: 24
                }}>
                    <div className="chart-card" style={{
                        width: '100%', maxWidth: '800px', maxHeight: '90vh',
                        display: 'flex', flexDirection: 'column',
                        background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.5)', padding: 0, overflow: 'hidden',
                        animation: 'adsToastIn 0.3s ease-out'
                    }}>
                        <div style={{
                            padding: '20px 24px', borderBottom: '1px solid var(--border-color)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            background: 'var(--bg-secondary)', position: 'sticky', top: 0, zIndex: 10
                        }}>
                            <h2 style={{ fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                                <History size={22} color="var(--gold)" />
                                Histórico de Análises IA - Meta Ads
                            </h2>
                            <button onClick={() => setShowHistory(false)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                                <X size={24} />
                            </button>
                        </div>
                        
                        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, scrollbarWidth: 'thin' }}>
                            {reports.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 16px' }}>
                                    <Brain size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
                                    <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: 8 }}>Nenhum relatório gerado ainda</p>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Os relatórios são gerados automaticamente pelo Pilger AI.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gap: 16 }}>
                                    {reports.map(report => {
                                        const isExpanded = expandedReport === report.id
                                        return (
                                            <div key={report.id} className="report-history-card"
                                                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: 20, cursor: 'pointer', borderLeft: `4px solid ${report.performance_score != null ? getScoreColor(report.performance_score) : 'var(--border-color)'}` }}
                                                onClick={() => setExpandedReport(isExpanded ? null : report.id)}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isExpanded ? 16 : 0 }}>
                                                    <span style={{ fontSize: '1.2rem' }}>{report.type === 'daily' ? 'Fechamento Diário' : 'Diretriz Semanal'}</span>
                                                    <span style={{ fontSize: '1rem', fontWeight: 600 }}>
                                                        {report.type === 'daily' ? 'Fechamento Diário' : 'Diretriz Semanal'}
                                                    </span>
                                                    {report.performance_score != null && (
                                                        <span style={{ fontSize: '0.8rem', padding: '4px 10px', borderRadius: 20, fontWeight: 700, background: `${getScoreColor(report.performance_score)}15`, color: getScoreColor(report.performance_score) }}>
                                                            {getScoreEmoji(report.performance_score)} {report.performance_score}/100
                                                        </span>
                                                    )}
                                                    <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                        {new Date(report.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--gold)', marginLeft: 8 }}>
                                                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                    </span>
                                                </div>
                                                {isExpanded && (
                                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.8, padding: '16px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}
                                                        dangerouslySetInnerHTML={{ __html: renderMarkdown(report.content_markdown || '') }} />
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .ads-toast { position: fixed; top: 24px; right: 24px; padding: 14px 24px; border-radius: 12px; font-size: 0.9rem; font-weight: 500; display: flex; align-items: center; gap: 10px; z-index: 10000; animation: adsToastIn 0.35s ease-out; box-shadow: 0 8px 30px rgba(0,0,0,0.4); }
                .ads-toast.success { background: rgba(74,222,128,0.15); border: 1px solid rgba(74,222,128,0.3); color: var(--success); }
                .ads-toast.error { background: rgba(248,113,113,0.15); border: 1px solid rgba(248,113,113,0.3); color: var(--danger); }
                @keyframes adsToastIn { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }

                .ads-date-select {
                    appearance: none; -webkit-appearance: none;
                    background: var(--bg-secondary); border: 1px solid var(--border-color);
                    color: var(--text-primary); padding: 8px 32px 8px 32px;
                    border-radius: 8px; font-size: 0.85rem; font-weight: 500;
                    cursor: pointer; outline: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
                    background-repeat: no-repeat; background-position: right 10px center;
                }
                .ads-badge { font-size: 0.7rem; padding: 2px 8px; border-radius: 50px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; display: inline-flex; align-items: center; gap: 3px; }
                .ads-campaign-card {
                    background: var(--bg-secondary); border: 1px solid var(--border-color);
                    border-radius: 12px; padding: 20px; cursor: pointer;
                    transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s;
                }
                .ads-campaign-card:hover {
                    border-color: var(--gold); transform: translateY(-2px);
                    box-shadow: 0 4px 20px rgba(201,169,110,0.1);
                }
                .ads-metrics-bar {
                    display: flex; gap: 16px; margin-top: 14px; padding-top: 14px;
                    border-top: 1px solid var(--border-color); font-size: 0.8rem; flex-wrap: wrap;
                }
                .ads-metrics-bar span { color: var(--text-muted); }
                .ads-metrics-bar strong { color: var(--text-primary); }
                .paid-agent-metrics > div {
                    border: 1px solid rgba(17,24,39,.08);
                    border-radius: 10px;
                    padding: 10px;
                    background: rgba(255,255,255,.82);
                    min-width: 0;
                }
                .paid-agent-metrics span {
                    display: block;
                    color: var(--text-muted);
                    font-size: .62rem;
                    font-weight: 900;
                    letter-spacing: .05em;
                    text-transform: uppercase;
                    margin-bottom: 5px;
                }
                .paid-agent-metrics strong {
                    display: block;
                    color: var(--text-primary);
                    font-size: .9rem;
                    line-height: 1.2;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .ai-alert-card { transition: border-color 0.2s, transform 0.15s; }
                .ai-alert-card:hover { border-color: rgba(139, 92, 246, 0.4); transform: translateX(2px); }
                .report-history-card { transition: border-color 0.2s, transform 0.15s; }
                .report-history-card:hover { border-color: var(--gold); transform: translateX(2px); }
                .ads-date-select {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    color: var(--text-primary);
                    padding: 8px 12px 8px 32px;
                    border-radius: 8px;
                    font-size: 0.9rem;
                    cursor: pointer;
                    outline: none;
                    appearance: none;
                }
                .ads-date-input {
                    background: transparent;
                    border: none;
                    color: var(--text-primary);
                    font-size: 0.85rem;
                    outline: none;
                }
                .ads-date-input::-webkit-calendar-picker-indicator {
                    filter: invert(1);
                    cursor: pointer;
                }
                @media (max-width: 760px) {
                    .paid-agent-brief > div {
                        grid-template-columns: 1fr !important;
                    }
                    .paid-report-content,
                    .paid-report-lists {
                        grid-template-columns: 1fr !important;
                    }
                    .ads-header-actions {
                        flex-wrap: wrap;
                        width: 100%;
                    }
                    .ads-header-actions .btn,
                    .ads-header-actions a.btn {
                        flex: 1 1 160px;
                        justify-content: center;
                    }
                }
            `}</style>
        </div>
    )
}
