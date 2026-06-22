'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle, BarChart3, Clock, Database, Flame, MessageSquare, PlayCircle, RefreshCw, Users } from 'lucide-react'
import AdminLoadingState from '@/components/admin/AdminLoadingState'
import { normalizeWhatsAppInstanceConfig } from '@/lib/whatsapp/instance-config'

type InstanceRow = {
    id: string
    instance_name: string
    phone_number?: string | null
    broker_id?: string | null
    admin_user_id?: string | null
    owner_name?: string | null
    owner_type?: 'agent' | 'user' | 'instance'
    owner_subtitle?: string | null
    owner_phone?: string | null
    owner_photo_url?: string | null
    status?: string | null
    config?: Record<string, any> | null
    message_activity?: {
        total_messages?: number
        last_7_days_messages?: number
        latest_message_at?: string | null
        latest_message_direction?: string | null
        latest_message_source?: string | null
        crm_total_messages?: number
        crm_last_7_days_messages?: number
        latest_crm_message_at?: string | null
    } | null
}

type AttendanceReport = {
    id: string
    instance_id: string
    broker_id?: string | null
    report_date: string
    score: number
    summary?: string | null
    coverage?: Record<string, any>
    metrics?: Record<string, any>
    recommendations?: string[]
    generated_at?: string
}

type ConversationScore = {
    id: string
    report_id: string
    chat_id: string
    phone?: string | null
    score: number
    lead_potential: 'hot' | 'warm' | 'cold' | 'unknown'
    response_time_seconds?: number | null
    unanswered?: boolean
    summary?: string | null
    risks?: string[]
    recommendations?: string[]
    metrics?: Record<string, any>
}

type ImportJob = {
    id: string
    instance_id?: string | null
    status: string
    summary?: Record<string, any>
    created_at?: string
}

type RecentReport = {
    id: string
    instance_id: string
    report_date: string
    score: number
    coverage?: Record<string, any>
    generated_at?: string
}

type RunSummary = {
    contacts: number
    chats: number
    messages: number
    historySyncRequested: number
    historySyncSkippedNoAnchor: number
    reports: number
    dates: number
}

type ReportBreakdown = {
    total: number
    hot: number
    warm: number
    cold: number
    poor: number
    strong: number
    unanswered: number
    needsAttention: number
    messages: number
    inbound: number
    outbound: number
    avgResponse: number | null
}

function todayDate() {
    return new Date().toISOString().slice(0, 10)
}

function sevenDaysAgoDate() {
    const date = new Date()
    date.setDate(date.getDate() - 7)
    return date.toISOString().slice(0, 10)
}

function formatDuration(seconds?: number | null) {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return 'sem resposta'
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes}min`
    const hours = Math.round(minutes / 60)
    return `${hours}h`
}

function formatPhone(phone?: string | null) {
    const digits = String(phone || '').replace(/\D/g, '')
    if (!digits) return 'sem telefone'
    if (digits.length >= 12 && digits.startsWith('55')) return `+55 ${digits.slice(2, 4)} ${digits.slice(4)}`
    return `+${digits}`
}

function formatDateLabel(value?: string | null) {
    if (!value) return ''
    const [year, month, day] = value.split('-')
    if (!year || !month || !day) return value
    return `${day}/${month}/${year}`
}

function formatDateTimeLabel(value?: string | null) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)
}

function orderedDateRange(startDate: string, endDate: string) {
    if (!startDate && endDate) {
        return { startDate: endDate, endDate }
    }
    if (startDate && endDate && startDate > endDate) {
        return { startDate: endDate, endDate: startDate }
    }
    return { startDate, endDate: endDate || startDate }
}

function isDateInRange(value: string, startDate: string, endDate: string) {
    const range = orderedDateRange(startDate, endDate)
    return value >= range.startDate && value <= range.endDate
}

function scoreColor(score: number) {
    if (score >= 80) return '#22c55e'
    if (score >= 60) return '#eab308'
    return '#ef4444'
}

function getReportBreakdown(report: AttendanceReport, scores: ConversationScore[]): ReportBreakdown {
    const coverage = report.coverage || {}
    const metrics = report.metrics || {}
    const avgResponse = Number(metrics.avg_response_seconds)
    const total = scores.length || Number(coverage.conversations_analyzed || 0)
    return {
        total,
        hot: scores.filter((score) => score.lead_potential === 'hot').length || Number(metrics.hot_leads || 0),
        warm: scores.filter((score) => score.lead_potential === 'warm').length || Number(metrics.warm_leads || 0),
        cold: scores.filter((score) => score.lead_potential === 'cold').length || Number(metrics.cold_leads || 0),
        poor: scores.filter((score) => Number(score.score || 0) < 60).length || Number(metrics.poor_conversations || 0),
        strong: scores.filter((score) => Number(score.score || 0) >= 80).length || Number(metrics.strong_conversations || 0),
        unanswered: scores.filter((score) => score.unanswered).length || Number(metrics.unanswered_conversations || 0),
        needsAttention: scores.filter((score) => score.unanswered || Number(score.score || 0) < 60).length || Number(metrics.needs_attention || 0),
        messages: Number(coverage.messages_analyzed || 0),
        inbound: Number(metrics.inbound_messages || 0),
        outbound: Number(metrics.outbound_messages || 0),
        avgResponse: Number.isFinite(avgResponse) ? avgResponse : null,
    }
}

function professionalVerdict(score: number, breakdown: ReportBreakdown) {
    if (breakdown.total === 0) return 'sem base suficiente'
    if (score >= 78 && breakdown.unanswered === 0 && breakdown.poor <= Math.max(1, Math.floor(breakdown.total * 0.15))) {
        return 'profissional qualificado'
    }
    if (score >= 62 && breakdown.unanswered <= Math.max(2, Math.floor(breakdown.total * 0.25))) {
        return 'qualificado com pontos de melhoria'
    }
    return 'precisa de acompanhamento'
}

function buildExecutiveOpinion(ownerName: string, report: AttendanceReport, breakdown: ReportBreakdown) {
    const score = Number(report.score || 0)
    const savedOpinion = String(report.metrics?.coaching_report || report.summary || '').trim()
    if (savedOpinion) return savedOpinion

    if (breakdown.total === 0) {
        return `Ainda nao existe base suficiente para avaliar ${ownerName}. Sincronize mais historico para o agente comparar tempo de resposta, perda de leads e qualidade da abordagem.`
    }

    const verdict = professionalVerdict(score, breakdown)
    const ratio = breakdown.total > 0 ? Math.round((breakdown.poor / breakdown.total) * 100) : 0
    const hotPressure = breakdown.hot > 0 ? ` Existem ${breakdown.hot} lead(s) quente(s) que precisam de prioridade comercial.` : ''
    const unansweredPressure = breakdown.unanswered > 0 ? ` O principal risco e ${breakdown.unanswered} conversa(s) sem ultima resposta.` : ''
    const qualityPressure = breakdown.poor > 0 ? ` ${breakdown.poor} conversa(s) ficaram abaixo do padrao minimo, equivalente a ${ratio}% do volume analisado.` : ''

    if (verdict === 'profissional qualificado') {
        return `Parecer IA: ${ownerName} demonstra atendimento profissional no periodo. O score ficou em ${score}/100, com boa capacidade de resposta e baixa perda de conversas.${hotPressure}${qualityPressure}`
    }

    if (verdict === 'qualificado com pontos de melhoria') {
        return `Parecer IA: ${ownerName} tem condicao de atender, mas precisa melhorar consistencia. O score ficou em ${score}/100.${unansweredPressure}${hotPressure}${qualityPressure}`
    }

    return `Parecer IA: ${ownerName} precisa de acompanhamento antes de ser tratado como atendimento qualificado. O score ficou em ${score}/100.${unansweredPressure}${hotPressure}${qualityPressure}`
}

function metricTextList(report: AttendanceReport, key: string): string[] {
    const value = report.metrics?.[key]
    if (!Array.isArray(value)) return []
    return value.map((item) => String(item || '').trim()).filter(Boolean)
}

function metricText(report: AttendanceReport, key: string): string {
    return String(report.metrics?.[key] || '').trim()
}

function improvementItems(breakdown: ReportBreakdown) {
    const items: string[] = []
    if (breakdown.unanswered > 0) items.push(`Retomar ${breakdown.unanswered} conversa(s) sem ultima resposta.`)
    if (breakdown.hot > 0) items.push(`Priorizar ${breakdown.hot} lead(s) quente(s) com proximo passo claro.`)
    if (breakdown.poor > 0) items.push(`Revisar ${breakdown.poor} conversa(s) ruins para corrigir abordagem, rapport e fechamento.`)
    if (breakdown.avgResponse !== null && breakdown.avgResponse > 900) items.push('Reduzir tempo medio de resposta para abaixo de 15 minutos.')
    if (items.length === 0) items.push('Manter padrao atual e acompanhar novas conversas importadas.')
    return items
}

function reportDetailHref(reportId: string, filter: string) {
    return `/admin/leads/relatorios-atendimento/detalhes?report_id=${encodeURIComponent(reportId)}&filtro=${encodeURIComponent(filter)}`
}

function cleanLabel(value?: string | null) {
    const text = String(value || '').trim()
    return text || null
}

function ownerTypeLabel(type?: InstanceRow['owner_type']) {
    if (type === 'agent') return 'Corretor IA'
    if (type === 'user') return 'Usuario'
    return 'Instancia'
}

function getOwnerName(instance?: InstanceRow, fallback?: string) {
    return cleanLabel(instance?.owner_name) || cleanLabel(instance?.instance_name) || fallback || 'WhatsApp sem dono'
}

function getInstanceOptionLabel(instance: InstanceRow) {
    const ownerName = cleanLabel(instance.owner_name)
    const phone = cleanLabel(instance.owner_phone || instance.phone_number)
    const base = ownerName || cleanLabel(instance.instance_name) || 'WhatsApp sem nome'
    return phone ? `${base} - ${formatPhone(phone)}` : base
}

function getInitials(value?: string | null) {
    const parts = String(value || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)

    const initials = parts.map((part) => part[0]).join('').toUpperCase()
    return initials || 'WA'
}

export default function AttendanceReportsPage() {
    const [loading, setLoading] = useState(true)
    const [running, setRunning] = useState(false)
    const [startDate, setStartDate] = useState(todayDate())
    const [endDate, setEndDate] = useState(todayDate())
    const [instanceId, setInstanceId] = useState('')
    const [reports, setReports] = useState<AttendanceReport[]>([])
    const [scores, setScores] = useState<ConversationScore[]>([])
    const [instances, setInstances] = useState<InstanceRow[]>([])
    const [jobs, setJobs] = useState<ImportJob[]>([])
    const [recentReports, setRecentReports] = useState<RecentReport[]>([])
    const [lastRunSummary, setLastRunSummary] = useState<RunSummary | null>(null)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const instanceById = useMemo(() => new Map(instances.map((item) => [item.id, item])), [instances])
    const latestReportWithMessages = recentReports[0] || null
    const latestReportByInstance = useMemo(() => {
        const map = new Map<string, RecentReport>()
        recentReports.forEach((report) => {
            if (!map.has(report.instance_id)) map.set(report.instance_id, report)
        })
        return map
    }, [recentReports])
    const scoresByReport = useMemo(() => {
        const map = new Map<string, ConversationScore[]>()
        scores.forEach((score) => {
            const list = map.get(score.report_id) || []
            list.push(score)
            map.set(score.report_id, list)
        })
        return map
    }, [scores])

    const monitoredInstances = useMemo(() => instances.filter((inst) => {
        const config = normalizeWhatsAppInstanceConfig(inst.config || {})
        return config.attendance_monitor_enabled || config.attendance_daily_report_enabled || config.attendance_history_import_enabled
    }).length, [instances])

    const totals = useMemo(() => reports.reduce((acc, report) => {
        const coverage = report.coverage || {}
        const metrics = report.metrics || {}
        return {
            conversations: acc.conversations + Number(coverage.conversations_analyzed || 0),
            messages: acc.messages + Number(coverage.messages_analyzed || 0),
            hot: acc.hot + Number(metrics.hot_leads || 0),
            unanswered: acc.unanswered + Number(metrics.unanswered_conversations || 0),
        }
    }, { conversations: 0, messages: 0, hot: 0, unanswered: 0 }), [reports])

    async function load(overrides: { startDate?: string; endDate?: string; instanceId?: string; preserveMessage?: boolean } = {}) {
        setLoading(true)
        if (!overrides.preserveMessage) setMessage(null)
        try {
            const range = orderedDateRange(overrides.startDate ?? startDate, overrides.endDate ?? endDate)
            const selectedInstanceId = overrides.instanceId ?? instanceId
            const params = new URLSearchParams()
            if (range.startDate) params.set('start_date', range.startDate)
            if (range.endDate) params.set('end_date', range.endDate)
            if (selectedInstanceId) params.set('instance_id', selectedInstanceId)
            const res = await fetch(`/api/admin/leads/attendance-reports?${params.toString()}`)
            const data = await res.json()
            if (!res.ok || !data?.success) throw new Error(data?.error || 'Falha ao carregar relatórios')
            setReports(data.reports || [])
            setScores(data.conversation_scores || [])
            setInstances(data.instances || [])
            setJobs(data.jobs || [])
            setRecentReports(data.recent_reports_with_messages || [])
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Erro ao carregar relatórios.' })
        } finally {
            setLoading(false)
        }
    }

    async function runNow() {
        setRunning(true)
        setLastRunSummary(null)
        setMessage({ type: 'success', text: 'Sincronizando contatos, chats e mensagens. Isso pode levar alguns instantes.' })
        try {
            const range = orderedDateRange(startDate, endDate)
            const res = await fetch('/api/admin/leads/attendance-reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'sync_and_report',
                    instance_id: instanceId || null,
                    start_date: range.startDate,
                    end_date: range.endDate,
                    force: true,
                    include_history_sync: true,
                    max_chats: 300,
                    messages_per_chat: 120,
                }),
            })
            const data = await res.json()
            if (!res.ok || !data?.success) throw new Error(data?.error || 'Falha ao gerar relatório')
            const totals = data?.sync?.totals || {}
            const reportRuns = Array.isArray(data?.report_runs) ? data.report_runs : []
            const directReports = Array.isArray(data?.reports) ? data.reports : []
            const reportsCount = directReports.length || reportRuns.reduce((total: number, run: any) => {
                return total + (Array.isArray(run?.reports) ? run.reports.length : 0)
            }, 0)
            setLastRunSummary({
                contacts: Number(totals.contacts || 0),
                chats: Number(totals.chats || 0),
                messages: Number(totals.messages || 0),
                historySyncRequested: Number(totals.history_sync_requested || 0),
                historySyncSkippedNoAnchor: Number(totals.history_sync_skipped_no_anchor || 0),
                reports: reportsCount,
                dates: Array.isArray(data?.dates) ? data.dates.length : 1,
            })
            setMessage({
                type: 'success',
                text: `Sincronização concluída: ${Number(totals.contacts || 0)} contatos, ${Number(totals.chats || 0)} chats e ${Number(totals.messages || 0)} mensagens importadas.`,
            })
            await load({ preserveMessage: true })
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Erro ao executar monitor.' })
        } finally {
            setRunning(false)
        }
    }

    useEffect(() => { load() }, [])

    if (loading) return <AdminLoadingState message="Carregando relatórios de atendimento..." />

    return (
        <main style={{ padding: '28px', color: 'var(--text-primary)', display: 'grid', gap: '18px' }}>
            <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '14px', alignItems: 'center' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.55rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <BarChart3 size={24} color="var(--gold)" /> Relatórios de Atendimento
                    </h1>
                    <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                        Conversas importadas das instâncias conectadas, com leitura diária por corretor.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <label style={dateControlGroupStyle}>
                        <span>De</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            style={controlStyle}
                        />
                    </label>
                    <label style={dateControlGroupStyle}>
                        <span>Ate</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            style={controlStyle}
                        />
                    </label>
                    <select value={instanceId} onChange={(e) => setInstanceId(e.target.value)} style={controlStyle}>
                        <option value="">Todas as instâncias</option>
                        {instances.map((inst) => (
                            <option key={inst.id} value={inst.id}>{getInstanceOptionLabel(inst)}</option>
                        ))}
                    </select>
                    <button type="button" onClick={() => { void load() }} style={ghostButtonStyle}>
                        <RefreshCw size={15} /> Atualizar
                    </button>
                    <button type="button" onClick={runNow} disabled={running} style={primaryButtonStyle(running)}>
                        {running ? <RefreshCw size={15} className="spin" /> : <PlayCircle size={15} />}
                        {running ? 'Gerando...' : 'Gerar agora'}
                    </button>
                </div>
            </header>

            {message && (
                <div style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1px solid ${message.type === 'success' ? 'rgba(34,197,94,0.28)' : 'rgba(239,68,68,0.28)'}`,
                    background: message.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                    color: message.type === 'success' ? '#86efac' : '#fca5a5',
                    fontWeight: 700,
                    fontSize: '0.83rem',
                }}>
                    {message.text}
                </div>
            )}

            {lastRunSummary && (
                <div style={runSummaryStyle}>
                    <div style={runSummaryHeaderStyle}>
                        <strong>Ultima geracao</strong>
                        <span>{lastRunSummary.dates} dia(s) processado(s)</span>
                    </div>
                    <div style={runSummaryGridStyle}>
                        <MiniStat label="Contatos importados" value={lastRunSummary.contacts} />
                        <MiniStat label="Chats lidos" value={lastRunSummary.chats} />
                        <MiniStat label="Mensagens novas" value={lastRunSummary.messages} />
                        <MiniStat label="Relatorios atualizados" value={lastRunSummary.reports} />
                        <MiniStat label="Historicos solicitados" value={lastRunSummary.historySyncRequested} />
                        <MiniStat label="Sem ancora historica" value={lastRunSummary.historySyncSkippedNoAnchor} />
                    </div>
                    {lastRunSummary.historySyncRequested > 0 && (
                        <div style={runSummaryNoteStyle}>
                            A Uazapi pode entregar parte do historico alguns instantes depois da solicitacao. Se as mensagens crescerem depois, clique em Atualizar ou rode Gerar agora novamente para recalcular o relatorio com o que acabou de chegar.
                        </div>
                    )}
                </div>
            )}

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: 12 }}>
                <Metric icon={<Users size={18} />} label="Instâncias monitoradas" value={`${monitoredInstances}/${instances.length}`} />
                <Metric icon={<MessageSquare size={18} />} label="Conversas analisadas" value={String(totals.conversations)} />
                <Metric icon={<Database size={18} />} label="Mensagens analisadas" value={String(totals.messages)} />
                <Metric icon={<Flame size={18} />} label="Leads quentes" value={String(totals.hot)} />
                <Metric icon={<AlertTriangle size={18} />} label="Sem última resposta" value={String(totals.unanswered)} />
            </section>

            {reports.length > 0 && totals.messages === 0 && latestReportWithMessages && !isDateInRange(latestReportWithMessages.report_date, startDate, endDate) && (
                <div style={dateHintStyle}>
                    <div>
                        Este periodo nao tem mensagens analisadas. O ultimo dia com historico foi {formatDateLabel(latestReportWithMessages.report_date)}
                        {' '}com {Number(latestReportWithMessages.coverage?.messages_analyzed || 0)} mensagens.
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setStartDate(latestReportWithMessages.report_date)
                            setEndDate(latestReportWithMessages.report_date)
                            void load({ startDate: latestReportWithMessages.report_date, endDate: latestReportWithMessages.report_date })
                        }}
                        style={dateHintButtonStyle}
                    >
                        Ver {formatDateLabel(latestReportWithMessages.report_date)}
                    </button>
                </div>
            )}

            <section style={{ display: 'grid', gap: 12 }}>
                {reports.length === 0 ? (
                    <div style={emptyStyle}>
                        Nenhum relatório encontrado para o filtro atual. Use “Gerar agora” para sincronizar as instâncias conectadas.
                    </div>
                ) : reports.map((report) => {
                    const inst = instanceById.get(report.instance_id)
                    const reportScoresAll = scoresByReport.get(report.id) || []
                    const coverage = report.coverage || {}
                    const ownerName = getOwnerName(inst, report.instance_id)
                    const breakdown = getReportBreakdown(report, reportScoresAll)
                    const verdict = String(report.metrics?.professional_status_label || professionalVerdict(Number(report.score || 0), breakdown))
                    const executiveOpinion = buildExecutiveOpinion(ownerName, report, breakdown)
                    const coachingItems = improvementItems(breakdown)
                    const strengths = metricTextList(report, 'strengths')
                    const improvementPoints = metricTextList(report, 'improvement_points')
                    const leadQualityReport = metricText(report, 'lead_quality_report')
                    const messageActivity = inst?.message_activity || {}
                    const totalImportedMessages = Number(messageActivity.total_messages || 0)
                    const last7ImportedMessages = Number(messageActivity.last_7_days_messages || 0)
                    const crmImportedMessages = Number(messageActivity.crm_total_messages || 0)
                    const crmLast7Messages = Number(messageActivity.crm_last_7_days_messages || 0)
                    const crmMessagesAnalyzed = Number(coverage.crm_messages_analyzed || 0)
                    const uazapiMessagesAnalyzed = Number(coverage.uazapi_messages_analyzed || 0)
                    const ownerDetails = [
                        cleanLabel(inst?.owner_subtitle),
                        cleanLabel(inst?.owner_phone || inst?.phone_number) ? formatPhone(inst?.owner_phone || inst?.phone_number) : null,
                    ].filter(Boolean)
                    const ownerPhotoUrl = cleanLabel(inst?.owner_photo_url)
                    const latestInstanceReport = latestReportByInstance.get(report.instance_id)
                    const showLatestInstanceHint = Number(coverage.messages_analyzed || 0) === 0
                        && latestInstanceReport
                        && !isDateInRange(latestInstanceReport.report_date, startDate, endDate)
                    return (
                        <article key={report.id} style={reportCardStyle}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                <div style={ownerHeaderStyle}>
                                    <OwnerAvatar name={ownerName} photoUrl={ownerPhotoUrl} />
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 800 }}>DONO DO WHATSAPP</div>
                                            <span style={ownerBadgeStyle}>{ownerTypeLabel(inst?.owner_type)}</span>
                                        </div>
                                        <h2 style={{ margin: '5px 0 3px', fontSize: '1.12rem', lineHeight: 1.2, wordBreak: 'break-word' }}>{ownerName}</h2>
                                        {ownerDetails.length > 0 && (
                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 700 }}>
                                                {ownerDetails.join(' | ')}
                                            </div>
                                        )}
                                        <div style={technicalInstanceStyle}>
                                            Instancia: {inst?.instance_name || report.instance_id}
                                        </div>
                                        <div style={reportDateStyle}>
                                            Relatorio: {formatDateLabel(report.report_date)}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ color: scoreColor(Number(report.score || 0)), fontSize: '2rem', fontWeight: 950, lineHeight: 1 }}>
                                        {Number(report.score || 0)}
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 800 }}>score geral</div>
                                </div>
                            </div>

                            <section style={executivePanelStyle}>
                                <div style={executiveHeaderStyle}>
                                    <div>
                                        <div style={sectionEyebrowStyle}>Parecer do agente</div>
                                        <h3 style={executiveTitleStyle}>{verdict}</h3>
                                    </div>
                                    <Link href={reportDetailHref(report.id, 'todos')} style={subtleLinkStyle}>
                                        Ver relatorio completo
                                    </Link>
                                </div>
                                <p style={executiveTextStyle}>{executiveOpinion}</p>
                                {leadQualityReport && (
                                    <div style={leadQualityBoxStyle}>
                                        <strong>Qualidade dos leads</strong>
                                        <span>{leadQualityReport}</span>
                                    </div>
                                )}
                                <div style={insightGridStyle}>
                                    <InsightLinkCard
                                        href={reportDetailHref(report.id, 'sem-resposta')}
                                        label="Nao respondidos"
                                        value={breakdown.unanswered}
                                        detail="Leads que ficaram aguardando retorno"
                                        tone="danger"
                                    />
                                    <InsightLinkCard
                                        href={reportDetailHref(report.id, 'quentes')}
                                        label="Leads quentes"
                                        value={breakdown.hot}
                                        detail="Conversas com sinal de visita, compra ou proposta"
                                        tone="hot"
                                    />
                                    <InsightLinkCard
                                        href={reportDetailHref(report.id, 'ruins')}
                                        label="Conversas ruins"
                                        value={breakdown.poor}
                                        detail="Atendimentos abaixo de 60 pontos"
                                        tone="danger"
                                    />
                                    <InsightLinkCard
                                        href={reportDetailHref(report.id, 'critica')}
                                        label="Amostra critica"
                                        value={breakdown.needsAttention}
                                        detail="Conversas sem resposta ou abaixo do padrao"
                                        tone="danger"
                                    />
                                    <InsightLinkCard
                                        href={reportDetailHref(report.id, 'mornos')}
                                        label="Leads mornos"
                                        value={breakdown.warm}
                                        detail="Leads com interesse, mas sem urgencia clara"
                                        tone="neutral"
                                    />
                                    <InsightLinkCard
                                        href={reportDetailHref(report.id, 'frios')}
                                        label="Leads frios"
                                        value={breakdown.cold}
                                        detail="Conversas com pouco sinal comercial"
                                        tone="neutral"
                                    />
                                    <InsightLinkCard
                                        href={reportDetailHref(report.id, 'bons')}
                                        label="Boas conversas"
                                        value={breakdown.strong}
                                        detail="Atendimentos com 80 pontos ou mais"
                                        tone="success"
                                    />
                                </div>
                                {(strengths.length > 0 || improvementPoints.length > 0) && (
                                    <div style={narrativeGridStyle}>
                                        <div style={narrativeColumnStyle}>
                                            <strong>Pontos fortes</strong>
                                            {(strengths.length ? strengths : ['Ainda nao ha ponto forte consolidado para este periodo.']).slice(0, 4).map((item, index) => (
                                                <span key={`${report.id}-strength-${index}`}>{item}</span>
                                            ))}
                                        </div>
                                        <div style={narrativeColumnStyle}>
                                            <strong>Pontos de melhoria</strong>
                                            {(improvementPoints.length ? improvementPoints : coachingItems).slice(0, 4).map((item, index) => (
                                                <span key={`${report.id}-improvement-${index}`}>{item}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div style={coachingBoxStyle}>
                                    <strong>Plano de melhoria</strong>
                                    <div style={coachingListStyle}>
                                        {(improvementPoints.length ? improvementPoints : coachingItems).slice(0, 4).map((item, index) => (
                                            <span key={`${report.id}-coach-${index}`}>{item}</span>
                                        ))}
                                    </div>
                                </div>
                            </section>

                            {showLatestInstanceHint && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStartDate(latestInstanceReport.report_date)
                                        setEndDate(latestInstanceReport.report_date)
                                        void load({ startDate: latestInstanceReport.report_date, endDate: latestInstanceReport.report_date })
                                    }}
                                    style={instanceDateHintStyle}
                                >
                                    Ultimo dia com mensagens: {formatDateLabel(latestInstanceReport.report_date)}
                                    {' '}({Number(latestInstanceReport.coverage?.messages_analyzed || 0)} mensagens)
                                </button>
                            )}

                            {Number(coverage.messages_analyzed || 0) === 0 && (
                                <div style={periodDiagnosticStyle}>
                                    {(totalImportedMessages + crmImportedMessages) > 0 ? (
                                        <>
                                            <strong>Ha mensagens importadas fora deste periodo.</strong>
                                            <span>
                                                Esta instancia tem {totalImportedMessages} mensagem(ns) no banco
                                                {last7ImportedMessages > 0 ? `, ${last7ImportedMessages} nos ultimos 7 dias` : ''}
                                                {crmImportedMessages > 0 ? `, alem de ${crmImportedMessages} mensagem(ns) no CRM` : ''}
                                                {messageActivity.latest_message_at ? `, ultima Uazapi em ${formatDateTimeLabel(messageActivity.latest_message_at)}` : ''}
                                                {messageActivity.latest_crm_message_at ? `, ultima CRM em ${formatDateTimeLabel(messageActivity.latest_crm_message_at)}` : ''}.
                                                O periodo selecionado nao encontrou mensagens para analisar.
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const start = sevenDaysAgoDate()
                                                    const end = todayDate()
                                                    setStartDate(start)
                                                    setEndDate(end)
                                                    void load({ startDate: start, endDate: end })
                                                }}
                                                style={periodDiagnosticButtonStyle}
                                            >
                                                Ver ultimos 7 dias
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <strong>Contatos nao significam conversas importadas.</strong>
                                            <span>
                                                A agenda da instancia foi lida, mas ainda nao encontramos mensagens salvas para analisar. O historico da Uazapi depende de mensagens recentes, webhook de history e, em alguns casos, do WhatsApp aberto/ativo no celular.
                                            </span>
                                        </>
                                    )}
                                </div>
                            )}

                            <div style={syncDataGridStyle}>
                                <MiniStat label="Contatos da agenda" value={coverage.contacts_synced || 0} />
                                <MiniStat label="Chats" value={coverage.chats_synced || 0} />
                                <MiniStat label="Msgs no banco" value={totalImportedMessages || 0} />
                                <MiniStat label="Msgs CRM" value={crmImportedMessages || 0} />
                                <MiniStat label="CRM 7 dias" value={crmLast7Messages || 0} />
                                <MiniStat label="Ultima msg importada" value={messageActivity.latest_message_at ? formatDateTimeLabel(messageActivity.latest_message_at) : 'sem registro'} />
                                <MiniStat label="Ultima msg CRM" value={messageActivity.latest_crm_message_at ? formatDateTimeLabel(messageActivity.latest_crm_message_at) : 'sem registro'} />
                                <MiniStat label="Conversas analisadas" value={breakdown.total} />
                                <MiniStat label="Mensagens" value={breakdown.messages} />
                                <MiniStat label="Analisadas Uazapi" value={uazapiMessagesAnalyzed || 0} />
                                <MiniStat label="Analisadas CRM" value={crmMessagesAnalyzed || 0} />
                                <MiniStat label="Msgs lead" value={breakdown.inbound} />
                                <MiniStat label="Resp. corretor" value={breakdown.outbound} />
                                <MiniStat label="Resp. media" value={formatDuration(breakdown.avgResponse)} />
                            </div>

                        </article>
                    )
                })}
            </section>

            {jobs.length > 0 && (
                <section style={{ display: 'grid', gap: 8 }}>
                    <h2 style={{ margin: 0, fontSize: '0.96rem', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Clock size={17} /> Últimas sincronizações
                    </h2>
                    <div style={{ display: 'grid', gap: 6 }}>
                        {jobs.slice(0, 5).map((job) => (
                            <div key={job.id} style={jobStyle}>
                                <span>{job.status}</span>
                                <span>{job.summary?.contacts || 0} contatos</span>
                                <span>{job.summary?.chats || 0} chats</span>
                                <span>{job.summary?.messages || 0} mensagens</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
                .spin { animation: spin 1s linear infinite; }
            `}</style>
        </main>
    )
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
    return (
        <div style={metricStyle}>
            <div style={{ color: 'var(--gold)' }}>{icon}</div>
            <div>
                <div style={{ fontSize: '1.15rem', fontWeight: 950 }}>{value}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem', fontWeight: 800 }}>{label}</div>
            </div>
        </div>
    )
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
    return (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', background: 'rgba(255,255,255,0.025)' }}>
            <div style={{ fontWeight: 950, fontSize: '0.95rem' }}>{value}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 800 }}>{label}</div>
        </div>
    )
}

function InsightLinkCard({ href, label, value, detail, tone }: {
    href: string
    label: string
    value: number
    detail: string
    tone: 'danger' | 'hot' | 'neutral' | 'success'
}) {
    return (
        <Link href={href} style={{ ...insightCardStyle, ...insightToneStyles[tone] }}>
            <div style={insightCardTopStyle}>
                <span>{label}</span>
                <strong>{value}</strong>
            </div>
            <small>{detail}</small>
        </Link>
    )
}

function OwnerAvatar({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
    const imageUrl = cleanLabel(photoUrl)
    return (
        <div
            aria-label={`Foto de ${name}`}
            style={{
                ...ownerAvatarStyle,
                ...(imageUrl ? {
                    backgroundImage: `url("${imageUrl.replace(/"/g, '%22')}")`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                } : {}),
            }}
        >
            {!imageUrl && <span>{getInitials(name)}</span>}
        </div>
    )
}

const controlStyle: CSSProperties = {
    minHeight: 38,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    padding: '0 10px',
    fontWeight: 700,
}

const dateControlGroupStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: 'var(--text-muted)',
    fontSize: '0.74rem',
    fontWeight: 900,
}

const ghostButtonStyle: CSSProperties = {
    minHeight: 38,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-primary)',
    padding: '0 12px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    fontWeight: 800,
    cursor: 'pointer',
}

function primaryButtonStyle(disabled: boolean): CSSProperties {
    return {
        minHeight: 38,
        borderRadius: 8,
        border: 'none',
        background: 'linear-gradient(135deg, var(--gold), #b8860b)',
        color: '#111',
        padding: '0 13px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        fontWeight: 900,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.68 : 1,
    }
}

const metricStyle: CSSProperties = {
    minHeight: 82,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    padding: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
}

const reportCardStyle: CSSProperties = {
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    padding: 16,
    display: 'grid',
    gap: 2,
}

const emptyStyle: CSSProperties = {
    borderRadius: 8,
    border: '1px dashed var(--border)',
    background: 'rgba(255,255,255,0.025)',
    color: 'var(--text-muted)',
    padding: 22,
    textAlign: 'center',
    fontWeight: 700,
}

const dateHintStyle: CSSProperties = {
    borderRadius: 8,
    border: '1px solid rgba(14,165,233,0.22)',
    background: 'rgba(14,165,233,0.08)',
    color: '#075985',
    padding: '11px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    fontSize: '0.84rem',
    fontWeight: 800,
}

const dateHintButtonStyle: CSSProperties = {
    border: '1px solid rgba(14,165,233,0.26)',
    background: '#fff',
    color: '#075985',
    borderRadius: 8,
    padding: '7px 10px',
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: 900,
}

const instanceDateHintStyle: CSSProperties = {
    marginTop: 10,
    border: '1px solid rgba(14,165,233,0.2)',
    background: 'rgba(14,165,233,0.07)',
    color: '#075985',
    borderRadius: 8,
    padding: '8px 10px',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '0.8rem',
    fontWeight: 850,
}

const ownerBadgeStyle: CSSProperties = {
    border: '1px solid rgba(201,169,110,0.28)',
    background: 'rgba(201,169,110,0.12)',
    color: 'var(--gold)',
    borderRadius: 999,
    padding: '3px 8px',
    fontSize: '0.68rem',
    fontWeight: 900,
}

const ownerHeaderStyle: CSSProperties = {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
}

const ownerAvatarStyle: CSSProperties = {
    width: 54,
    height: 54,
    flex: '0 0 54px',
    borderRadius: '50%',
    border: '2px solid rgba(201,169,110,0.38)',
    background: 'linear-gradient(135deg, #c9a96e, #3a2d1b)',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    boxShadow: '0 8px 18px rgba(0,0,0,0.12)',
    overflow: 'hidden',
    fontSize: '0.82rem',
    fontWeight: 950,
}

const technicalInstanceStyle: CSSProperties = {
    marginTop: 6,
    color: 'var(--text-muted)',
    fontSize: '0.74rem',
    fontWeight: 700,
    overflowWrap: 'anywhere',
}

const reportDateStyle: CSSProperties = {
    marginTop: 3,
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    fontWeight: 850,
}

const executivePanelStyle: CSSProperties = {
    marginTop: 12,
    border: '1px solid rgba(148,163,184,0.24)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.88), rgba(248,250,252,0.92))',
    borderRadius: 8,
    padding: 14,
    display: 'grid',
    gap: 12,
    boxShadow: '0 10px 24px rgba(15,23,42,0.05)',
}

const executiveHeaderStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
}

const sectionEyebrowStyle: CSSProperties = {
    color: 'var(--text-muted)',
    fontSize: '0.72rem',
    fontWeight: 900,
    textTransform: 'uppercase',
}

const executiveTitleStyle: CSSProperties = {
    margin: '3px 0 0',
    color: 'var(--text-primary)',
    fontSize: '1rem',
    lineHeight: 1.25,
    textTransform: 'capitalize',
}

const executiveTextStyle: CSSProperties = {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: '0.9rem',
    lineHeight: 1.55,
}

const leadQualityBoxStyle: CSSProperties = {
    border: '1px solid rgba(14,165,233,0.2)',
    background: 'rgba(224,242,254,0.5)',
    color: '#075985',
    borderRadius: 8,
    padding: '10px 11px',
    display: 'grid',
    gap: 4,
    fontSize: '0.82rem',
    lineHeight: 1.45,
}

const subtleLinkStyle: CSSProperties = {
    border: '1px solid rgba(201,169,110,0.28)',
    background: '#fff',
    color: '#7c520f',
    borderRadius: 8,
    padding: '7px 10px',
    textDecoration: 'none',
    fontSize: '0.78rem',
    fontWeight: 900,
}

const insightGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
    gap: 8,
}

const insightCardStyle: CSSProperties = {
    border: '1px solid rgba(148,163,184,0.24)',
    borderRadius: 8,
    padding: '10px 11px',
    background: '#fff',
    textDecoration: 'none',
    color: 'var(--text-primary)',
    display: 'grid',
    gap: 6,
    minHeight: 82,
}

const insightCardTopStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    fontSize: '0.78rem',
    fontWeight: 900,
}

const insightToneStyles: Record<'danger' | 'hot' | 'neutral' | 'success', CSSProperties> = {
    danger: { borderColor: 'rgba(239,68,68,0.24)', background: 'rgba(254,242,242,0.82)' },
    hot: { borderColor: 'rgba(245,158,11,0.28)', background: 'rgba(255,251,235,0.9)' },
    neutral: { borderColor: 'rgba(100,116,139,0.22)', background: 'rgba(248,250,252,0.94)' },
    success: { borderColor: 'rgba(34,197,94,0.24)', background: 'rgba(240,253,244,0.86)' },
}

const coachingBoxStyle: CSSProperties = {
    border: '1px solid rgba(100,116,139,0.18)',
    background: 'rgba(248,250,252,0.82)',
    borderRadius: 8,
    padding: '10px 11px',
    display: 'grid',
    gap: 7,
    color: 'var(--text-primary)',
    fontSize: '0.8rem',
}

const narrativeGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
    gap: 8,
}

const narrativeColumnStyle: CSSProperties = {
    border: '1px solid rgba(100,116,139,0.18)',
    background: 'rgba(255,255,255,0.74)',
    borderRadius: 8,
    padding: '10px 11px',
    display: 'grid',
    gap: 6,
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    lineHeight: 1.45,
}

const coachingListStyle: CSSProperties = {
    display: 'grid',
    gap: 5,
    color: 'var(--text-secondary)',
    lineHeight: 1.45,
}

const syncDataGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
    gap: 8,
    marginTop: 12,
}

const periodDiagnosticStyle: CSSProperties = {
    marginTop: 10,
    border: '1px solid rgba(14,165,233,0.22)',
    background: 'rgba(224,242,254,0.58)',
    color: '#075985',
    borderRadius: 8,
    padding: '10px 11px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
    fontSize: '0.8rem',
    lineHeight: 1.45,
}

const periodDiagnosticButtonStyle: CSSProperties = {
    border: '1px solid rgba(14,165,233,0.28)',
    background: '#fff',
    color: '#075985',
    borderRadius: 8,
    padding: '7px 10px',
    cursor: 'pointer',
    fontSize: '0.76rem',
    fontWeight: 900,
}

const runSummaryStyle: CSSProperties = {
    borderRadius: 8,
    border: '1px solid rgba(34,197,94,0.24)',
    background: 'rgba(34,197,94,0.07)',
    padding: 12,
    display: 'grid',
    gap: 10,
}

const runSummaryHeaderStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
    color: 'var(--text-primary)',
    fontSize: '0.84rem',
}

const runSummaryGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
    gap: 8,
}

const runSummaryNoteStyle: CSSProperties = {
    border: '1px solid rgba(14,165,233,0.22)',
    background: 'rgba(14,165,233,0.07)',
    color: '#075985',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: '0.8rem',
    fontWeight: 800,
    lineHeight: 1.45,
}

const jobStyle: CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '9px 10px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    color: 'var(--text-secondary)',
    fontSize: '0.78rem',
    fontWeight: 800,
}
