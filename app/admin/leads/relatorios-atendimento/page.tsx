'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle, BarChart3, ChevronLeft, ChevronRight, Clock, Database, Flame, MessageSquare, PlayCircle, RefreshCw, Users } from 'lucide-react'
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
    lead_name?: string | null
    lead_display_name?: string | null
    lead_avatar_url?: string | null
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
    historySyncRequestedWithoutAnchor: number
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
    lost: number
    recoverable: number
    llmAnalyzed: number
    communicationQuality: number | null
    closingQuality: number | null
    messages: number
    inbound: number
    outbound: number
    avgResponse: number | null
}

type AttendancePipelineStageKey =
    | 'entrada'
    | 'fup'
    | 'conectados'
    | 'oportunidades'
    | 'leads_quentes'
    | 'visitas'
    | 'proposta'
    | 'contrato'
    | 'recuperaveis'
    | 'perdidas'

type AttendancePipelineStage = {
    key: AttendancePipelineStageKey
    label: string
    color: string
    bg: string
    border: string
    filter: string
}

type AttendancePipelineLead = {
    id: string
    reportId: string
    stageKey: AttendancePipelineStageKey
    filter: string
    name: string
    avatarUrl: string | null
    phone: string | null
    score: number
    leadPotential: ConversationScore['lead_potential']
    summary: string
    reason: string
    ownerName: string
    ownerPhotoUrl: string | null
    reportDate: string
    whatsappUrl: string | null
    unanswered: boolean
}

type PipelineOwnerCard = {
    id: string
    name: string
    photoUrl: string | null
    total: number
    hot: number
    warm: number
    cold: number
    fup: number
    lost: number
    recoverable: number
    score: number
    isAll: boolean
}

const ATTENDANCE_PIPELINE_STAGES: AttendancePipelineStage[] = [
    { key: 'entrada', label: 'Entrada', color: '#2563eb', bg: '#eff6ff', border: 'rgba(37,99,235,0.24)', filter: 'todos' },
    { key: 'fup', label: 'FUP', color: '#b45309', bg: '#fffbeb', border: 'rgba(180,83,9,0.24)', filter: 'sem-resposta' },
    { key: 'conectados', label: 'Conectados', color: '#0891b2', bg: '#ecfeff', border: 'rgba(8,145,178,0.22)', filter: 'todos' },
    { key: 'oportunidades', label: 'Oportunidades', color: '#7c3aed', bg: '#f5f3ff', border: 'rgba(124,58,237,0.22)', filter: 'mornos' },
    { key: 'leads_quentes', label: 'Leads quentes', color: '#c2410c', bg: '#fff7ed', border: 'rgba(194,65,12,0.24)', filter: 'quentes' },
    { key: 'visitas', label: 'Visitas', color: '#047857', bg: '#ecfdf5', border: 'rgba(4,120,87,0.22)', filter: 'quentes' },
    { key: 'proposta', label: 'Proposta', color: '#7c3aed', bg: '#faf5ff', border: 'rgba(124,58,237,0.22)', filter: 'quentes' },
    { key: 'contrato', label: 'Contrato', color: '#15803d', bg: '#f0fdf4', border: 'rgba(21,128,61,0.22)', filter: 'bons' },
    { key: 'recuperaveis', label: 'Recuperaveis', color: '#059669', bg: '#ecfdf5', border: 'rgba(5,150,105,0.24)', filter: 'recuperaveis' },
    { key: 'perdidas', label: 'Perdidas', color: '#dc2626', bg: '#fef2f2', border: 'rgba(220,38,38,0.24)', filter: 'perdidas' },
]

function compactApiText(value: string, limit = 300) {
    return value.replace(/\s+/g, ' ').trim().slice(0, limit)
}

async function readApiJson(res: Response) {
    const text = await res.text()
    if (!text.trim()) return {}

    try {
        return JSON.parse(text)
    } catch {
        const preview = compactApiText(text)
        throw new Error(`A API de relatorios retornou resposta invalida (${res.status}). ${preview || 'Sem detalhes.'}`)
    }
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
    const communicationQuality = Number(metrics.communication_quality_avg)
    const closingQuality = Number(metrics.closing_quality_avg)
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
        lost: scores.filter((score) => score.metrics?.lost_opportunity === true || score.metrics?.commercial_status === 'oportunidade_perdida').length || Number(metrics.lost_opportunities || 0),
        recoverable: scores.filter((score) => score.metrics?.recoverable === true).length || Number(metrics.recoverable_opportunities || 0),
        llmAnalyzed: Number(metrics.attendance_coach_conversations_analyzed || coverage.llm_conversations_analyzed || 0),
        communicationQuality: Number.isFinite(communicationQuality) ? communicationQuality : null,
        closingQuality: Number.isFinite(closingQuality) ? closingQuality : null,
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
    if (breakdown.lost > 0) items.push(`Revisar ${breakdown.lost} oportunidade(s) perdida(s) para entender falha de abordagem.`)
    if (breakdown.recoverable > 0) items.push(`Enviar plano de recuperacao para ${breakdown.recoverable} lead(s) ainda recuperavel(is).`)
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

function getLeadDisplayName(score: ConversationScore) {
    return cleanLabel(score.lead_display_name) ||
        cleanLabel(score.lead_name) ||
        cleanLabel(score.metrics?.lead_name) ||
        cleanLabel(score.metrics?.lead_intent) ||
        'Lead sem nome'
}

function compactLabel(value?: string | null, limit = 46) {
    const text = String(value || '').replace(/\s+/g, ' ').trim()
    if (!text) return ''
    return text.length > limit ? `${text.slice(0, limit - 3)}...` : text
}

function buildWhatsAppLeadUrl(phone?: string | null) {
    const digits = String(phone || '').replace(/\D/g, '')
    if (!digits) return null
    return `https://wa.me/${digits}`
}

function textIncludesAny(value: unknown, words: string[]) {
    const text = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    return words.some((word) => text.includes(word))
}

function getAttendancePipelineStage(score: ConversationScore): AttendancePipelineStage {
    const metrics = score.metrics || {}
    const status = metrics.commercial_status || metrics.commercial_category || ''
    const funnel = metrics.funnel_stage || ''
    const outbound = Number(metrics.outbound_messages || 0)
    const lost = metrics.lost_opportunity === true || status === 'oportunidade_perdida'
    const recoverable = metrics.recoverable === true

    if (textIncludesAny(status, ['contrato']) || textIncludesAny(funnel, ['contrato'])) {
        return ATTENDANCE_PIPELINE_STAGES.find((stage) => stage.key === 'contrato')!
    }
    if (textIncludesAny(status, ['proposta', 'negociacao']) || textIncludesAny(funnel, ['proposta', 'negociacao'])) {
        return ATTENDANCE_PIPELINE_STAGES.find((stage) => stage.key === 'proposta')!
    }
    if (textIncludesAny(status, ['visita', 'agendamento']) || textIncludesAny(funnel, ['visita', 'agendamento'])) {
        return ATTENDANCE_PIPELINE_STAGES.find((stage) => stage.key === 'visitas')!
    }
    if (recoverable) return ATTENDANCE_PIPELINE_STAGES.find((stage) => stage.key === 'recuperaveis')!
    if (lost) return ATTENDANCE_PIPELINE_STAGES.find((stage) => stage.key === 'perdidas')!
    if (score.lead_potential === 'hot') return ATTENDANCE_PIPELINE_STAGES.find((stage) => stage.key === 'leads_quentes')!
    if (textIncludesAny(status, ['oportunidade', 'objecao', 'monitorar']) || score.lead_potential === 'warm') {
        return ATTENDANCE_PIPELINE_STAGES.find((stage) => stage.key === 'oportunidades')!
    }
    if (score.unanswered) return ATTENDANCE_PIPELINE_STAGES.find((stage) => stage.key === 'fup')!
    if (outbound > 0) return ATTENDANCE_PIPELINE_STAGES.find((stage) => stage.key === 'conectados')!
    return ATTENDANCE_PIPELINE_STAGES.find((stage) => stage.key === 'entrada')!
}

function getScoreHeatLevel(score: number) {
    if (score >= 88) return 5
    if (score >= 76) return 4
    if (score >= 62) return 3
    if (score >= 45) return 2
    return 1
}

function getPipelineReason(score: ConversationScore) {
    const metrics = score.metrics || {}
    return compactLabel(
        metrics.lead_intent ||
        metrics.main_issue ||
        metrics.commercial_reason ||
        metrics.funnel_stage ||
        score.summary,
        52
    ) || 'Conversa analisada'
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
    const pipelineScrollerRef = useRef<HTMLDivElement | null>(null)

    const instanceById = useMemo(() => new Map(instances.map((item) => [item.id, item])), [instances])
    const reportById = useMemo(() => new Map(reports.map((item) => [item.id, item])), [reports])
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
            lost: acc.lost + Number(metrics.lost_opportunities || 0),
            recoverable: acc.recoverable + Number(metrics.recoverable_opportunities || 0),
            llmAnalyzed: acc.llmAnalyzed + Number(metrics.attendance_coach_conversations_analyzed || coverage.llm_conversations_analyzed || 0),
        }
    }, { conversations: 0, messages: 0, hot: 0, unanswered: 0, lost: 0, recoverable: 0, llmAnalyzed: 0 }), [reports])

    const pipelineLeads = useMemo(() => {
        return scores
            .map((score): AttendancePipelineLead | null => {
                const report = reportById.get(score.report_id)
                if (!report) return null
                const inst = instanceById.get(report.instance_id)
                const stage = getAttendancePipelineStage(score)
                const ownerName = getOwnerName(inst, report.instance_id)
                const phone = score.phone || null
                return {
                    id: score.id || score.chat_id,
                    reportId: report.id,
                    stageKey: stage.key,
                    filter: stage.filter,
                    name: getLeadDisplayName(score),
                    avatarUrl: cleanLabel(score.lead_avatar_url),
                    phone,
                    score: Number(score.score || 0),
                    leadPotential: score.lead_potential,
                    summary: compactLabel(score.summary, 90),
                    reason: getPipelineReason(score),
                    ownerName,
                    ownerPhotoUrl: cleanLabel(inst?.owner_photo_url),
                    reportDate: report.report_date,
                    whatsappUrl: buildWhatsAppLeadUrl(phone),
                    unanswered: Boolean(score.unanswered),
                }
            })
            .filter((item): item is AttendancePipelineLead => Boolean(item))
    }, [scores, reportById, instanceById])

    const pipelineColumns = useMemo(() => {
        return ATTENDANCE_PIPELINE_STAGES.map((stage) => ({
            ...stage,
            leads: pipelineLeads
                .filter((lead) => lead.stageKey === stage.key)
                .sort((a, b) => {
                    const priorityStage = ['leads_quentes', 'visitas', 'proposta', 'contrato', 'recuperaveis']
                    if (priorityStage.includes(stage.key)) return b.score - a.score
                    return Date.parse(b.reportDate) - Date.parse(a.reportDate) || b.score - a.score
                }),
        }))
    }, [pipelineLeads])

    const pipelineStageTotals = useMemo(() => {
        return pipelineColumns.reduce((acc, column) => {
            acc[column.key] = column.leads.length
            return acc
        }, {} as Record<AttendancePipelineStageKey, number>)
    }, [pipelineColumns])

    const pipelineOwnerCards = useMemo<PipelineOwnerCard[]>(() => {
        const averageScore = reports.length
            ? Math.round(reports.reduce((sum, report) => sum + Number(report.score || 0), 0) / reports.length)
            : 0
        const allCard: PipelineOwnerCard = {
            id: '',
            name: 'Todos os corretores',
            photoUrl: null,
            total: scores.length,
            hot: scores.filter((score) => score.lead_potential === 'hot').length,
            warm: scores.filter((score) => score.lead_potential === 'warm').length,
            cold: scores.filter((score) => score.lead_potential === 'cold').length,
            fup: scores.filter((score) => score.unanswered).length,
            lost: scores.filter((score) => score.metrics?.lost_opportunity === true || score.metrics?.commercial_status === 'oportunidade_perdida').length,
            recoverable: scores.filter((score) => score.metrics?.recoverable === true).length,
            score: averageScore,
            isAll: true,
        }
        const ownerMap = new Map<string, PipelineOwnerCard & { scoreSum: number; reportCount: number }>()
        reports.forEach((report) => {
            const inst = instanceById.get(report.instance_id)
            const reportScores = scoresByReport.get(report.id) || []
            const breakdown = getReportBreakdown(report, reportScores)
            const existing = ownerMap.get(report.instance_id)
            if (existing) {
                existing.total += breakdown.total
                existing.hot += breakdown.hot
                existing.warm += breakdown.warm
                existing.cold += breakdown.cold
                existing.fup += breakdown.unanswered
                existing.lost += breakdown.lost
                existing.recoverable += breakdown.recoverable
                existing.scoreSum += Number(report.score || 0)
                existing.reportCount += 1
                existing.score = Math.round(existing.scoreSum / existing.reportCount)
                ownerMap.set(report.instance_id, existing)
            } else {
                ownerMap.set(report.instance_id, {
                    id: report.instance_id,
                    name: getOwnerName(inst, report.instance_id),
                    photoUrl: cleanLabel(inst?.owner_photo_url),
                    total: breakdown.total,
                    hot: breakdown.hot,
                    warm: breakdown.warm,
                    cold: breakdown.cold,
                    fup: breakdown.unanswered,
                    lost: breakdown.lost,
                    recoverable: breakdown.recoverable,
                    score: Number(report.score || 0),
                    isAll: false,
                    scoreSum: Number(report.score || 0),
                    reportCount: 1,
                })
            }
        })
        const cards = Array.from(ownerMap.values()).map((item) => ({
            id: item.id,
            name: item.name,
            photoUrl: item.photoUrl,
            total: item.total,
            hot: item.hot,
            warm: item.warm,
            cold: item.cold,
            fup: item.fup,
            lost: item.lost,
            recoverable: item.recoverable,
            score: item.score,
            isAll: item.isAll,
        }))
        return [allCard, ...cards].sort((a, b) => {
            if (a.isAll) return -1
            if (b.isAll) return 1
            return b.total - a.total || a.name.localeCompare(b.name)
        })
    }, [reports, scores, scoresByReport, instanceById])

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
            const data = await readApiJson(res)
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

    function selectPipelineInstance(nextInstanceId: string) {
        setInstanceId(nextInstanceId)
        void load({ instanceId: nextInstanceId })
    }

    function scrollAttendancePipeline(direction: -1 | 1) {
        pipelineScrollerRef.current?.scrollBy({
            left: direction * 460,
            behavior: 'smooth',
        })
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
            const data = await readApiJson(res)
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
                historySyncRequestedWithoutAnchor: Number(totals.history_sync_requested_without_anchor || 0),
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
                        <MiniStat label="Solicitados sem ancora" value={lastRunSummary.historySyncRequestedWithoutAnchor} />
                        <MiniStat label="Falhas sem ancora" value={lastRunSummary.historySyncSkippedNoAnchor} />
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
                <Metric icon={<AlertTriangle size={18} />} label="Oportunidades perdidas" value={String(totals.lost)} />
                <Metric icon={<RefreshCw size={18} />} label="Recuperaveis" value={String(totals.recoverable)} />
                <Metric icon={<BarChart3 size={18} />} label="Coach LLM" value={String(totals.llmAnalyzed)} />
            </section>

            {reports.length > 0 && (
                <section style={pipelineSectionStyle}>
                    <div style={pipelineHeaderStyle}>
                        <div>
                            <span style={pipelineEyebrowStyle}>Pipeline IA</span>
                            <strong style={pipelineTitleStyle}>
                                {instanceId
                                    ? pipelineOwnerCards.find((card) => card.id === instanceId)?.name || 'Corretor selecionado'
                                    : 'Todos os corretores'}
                            </strong>
                        </div>
                        <div style={pipelineHeaderActionsStyle}>
                            <span style={pipelineScrollControlsStyle}>
                                <button type="button" onClick={() => scrollAttendancePipeline(-1)} title="Etapas anteriores" style={pipelineRoundButtonStyle}>
                                    <ChevronLeft size={16} />
                                </button>
                                <button type="button" onClick={() => scrollAttendancePipeline(1)} title="Proximas etapas" style={pipelineRoundButtonStyle}>
                                    <ChevronRight size={16} />
                                </button>
                            </span>
                            {[
                                ATTENDANCE_PIPELINE_STAGES.find((stage) => stage.key === 'entrada')!,
                                ATTENDANCE_PIPELINE_STAGES.find((stage) => stage.key === 'fup')!,
                                ATTENDANCE_PIPELINE_STAGES.find((stage) => stage.key === 'leads_quentes')!,
                                ATTENDANCE_PIPELINE_STAGES.find((stage) => stage.key === 'visitas')!,
                                ATTENDANCE_PIPELINE_STAGES.find((stage) => stage.key === 'contrato')!,
                                ATTENDANCE_PIPELINE_STAGES.find((stage) => stage.key === 'recuperaveis')!,
                            ].map((stage) => (
                                <span key={`metric-${stage.key}`} style={{ ...pipelineMetricPillStyle, color: stage.color, background: stage.bg, borderColor: stage.border }}>
                                    {stage.label}: {pipelineStageTotals[stage.key] || 0}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div style={pipelineOwnerGridStyle}>
                        {pipelineOwnerCards.map((card) => {
                            const isSelected = card.id === instanceId || (!instanceId && card.isAll)
                            const heatTotal = Math.max(1, card.hot + card.warm + card.cold)
                            return (
                                <button
                                    key={card.isAll ? 'all-pipeline-owners' : card.id}
                                    type="button"
                                    onClick={() => selectPipelineInstance(card.id)}
                                    style={{
                                        ...pipelineOwnerCardStyle,
                                        ...(isSelected ? pipelineOwnerCardSelectedStyle : {}),
                                    }}
                                >
                                    <div style={pipelineOwnerTopStyle}>
                                        <div style={pipelineOwnerIdentityStyle}>
                                            {!card.isAll && <OwnerAvatar name={card.name} photoUrl={card.photoUrl} size={28} />}
                                            <strong style={pipelineOwnerNameStyle}>{card.isAll && instanceId ? 'Ver todos' : card.name}</strong>
                                        </div>
                                        <span style={pipelineOwnerTotalStyle}>{card.isAll && instanceId ? 'geral' : card.total}</span>
                                    </div>
                                    {!card.isAll && card.score > 0 && (
                                        <span style={pipelineScoreBadgeStyle}>Score {card.score}</span>
                                    )}
                                    <div
                                        style={{
                                            ...pipelineHeatBarStyle,
                                            gridTemplateColumns: `${Math.max(6, Math.round((card.hot / heatTotal) * 100))}% ${Math.max(6, Math.round((card.warm / heatTotal) * 100))}% 1fr`,
                                        }}
                                    >
                                        <span style={{ background: '#b45309' }} />
                                        <span style={{ background: '#c8a66a' }} />
                                        <span style={{ background: '#cbd5e1' }} />
                                    </div>
                                    <span style={pipelineOwnerMetaStyle}>
                                        {card.hot} quente | {card.warm} morno | {card.fup} FUP
                                    </span>
                                </button>
                            )
                        })}
                    </div>

                    <div ref={pipelineScrollerRef} style={pipelineScrollerStyle}>
                        {pipelineColumns.map((column) => (
                            <section key={column.key} style={{ ...pipelineColumnStyle, borderColor: column.border }}>
                                <div style={{ ...pipelineColumnHeaderStyle, borderColor: column.border }}>
                                    <strong style={pipelineColumnTitleStyle}>{column.label}</strong>
                                    <span style={{ ...pipelineColumnCountStyle, color: column.color, background: column.bg }}>
                                        {column.leads.length}
                                    </span>
                                </div>
                                <div style={pipelineColumnBodyStyle}>
                                    {column.leads.length === 0 ? (
                                        <div style={pipelineEmptyColumnStyle}>Sem leads</div>
                                    ) : column.leads.slice(0, 32).map((lead) => {
                                        const heatLevel = getScoreHeatLevel(lead.score)
                                        return (
                                            <article key={`${column.key}:${lead.reportId}:${lead.id}`} style={{ ...pipelineLeadCardStyle, borderColor: column.border }}>
                                                <div style={pipelineLeadButtonStyle}>
                                                    <div style={pipelineLeadHeaderStyle}>
                                                        <OwnerAvatar name={lead.name} photoUrl={lead.avatarUrl} size={34} />
                                                        <div style={{ minWidth: 0, flex: 1 }}>
                                                            <div style={pipelineLeadNameRowStyle}>
                                                                <strong style={pipelineLeadNameStyle}>{lead.name}</strong>
                                                                <span style={{ ...pipelineLeadScoreStyle, color: column.color, background: column.bg, borderColor: column.border }}>{lead.score}</span>
                                                            </div>
                                                            <span style={{ ...pipelineLeadReasonStyle, color: column.color }}>
                                                                {lead.leadPotential === 'hot' ? 'Quente' : lead.leadPotential === 'warm' ? 'Morno' : lead.leadPotential === 'cold' ? 'Frio' : 'Novo'} | {lead.reason}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div style={pipelineLeadHeatStyle}>
                                                        {Array.from({ length: 5 }).map((_, index) => (
                                                            <span
                                                                key={index}
                                                                style={{
                                                                    height: 5,
                                                                    borderRadius: 999,
                                                                    background: index < heatLevel ? column.color : '#edf0f2',
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                    <span style={pipelineLeadPhoneStyle}>{formatPhone(lead.phone)}</span>
                                                    <div style={pipelineLeadOwnerStyle}>
                                                        <OwnerAvatar name={lead.ownerName} photoUrl={lead.ownerPhotoUrl} size={16} />
                                                        <span>{lead.ownerName} | {formatDateLabel(lead.reportDate)}</span>
                                                    </div>
                                                </div>
                                                <div style={pipelineLeadActionsStyle}>
                                                    <Link href={reportDetailHref(lead.reportId, lead.filter)} style={pipelineLeadActionStyle}>
                                                        Abrir
                                                    </Link>
                                                    {lead.whatsappUrl && (
                                                        <a href={lead.whatsappUrl} target="_blank" rel="noreferrer" style={{ ...pipelineLeadActionStyle, ...pipelineLeadWhatsappActionStyle }}>
                                                            WhatsApp
                                                        </a>
                                                    )}
                                                </div>
                                            </article>
                                        )
                                    })}
                                    {column.leads.length > 32 && (
                                        <div style={pipelineColumnMoreStyle}>+{column.leads.length - 32} no filtro atual</div>
                                    )}
                                </div>
                            </section>
                        ))}
                    </div>
                </section>
            )}

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
                    const trainingFocus = metricTextList(report, 'training_focus')
                    const recoveryActions = metricTextList(report, 'recovery_actions')
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
                                        href={reportDetailHref(report.id, 'perdidas')}
                                        label="Perdidas"
                                        value={breakdown.lost}
                                        detail="Oportunidades que a Helena marcou como perdidas"
                                        tone="danger"
                                    />
                                    <InsightLinkCard
                                        href={reportDetailHref(report.id, 'recuperaveis')}
                                        label="Recuperaveis"
                                        value={breakdown.recoverable}
                                        detail="Leads que ainda podem receber retomada"
                                        tone="success"
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
                                {(trainingFocus.length > 0 || recoveryActions.length > 0 || breakdown.llmAnalyzed > 0) && (
                                    <div style={coachActionGridStyle}>
                                        <div style={coachActionColumnStyle}>
                                            <strong>Coach LLM</strong>
                                            <span>{breakdown.llmAnalyzed} conversa(s) passaram pela Helena Auditoria Comercial.</span>
                                            {breakdown.communicationQuality !== null && (
                                                <span>Qualidade de comunicacao: {breakdown.communicationQuality}/100.</span>
                                            )}
                                            {breakdown.closingQuality !== null && (
                                                <span>Fechamento e proximo passo: {breakdown.closingQuality}/100.</span>
                                            )}
                                        </div>
                                        <div style={coachActionColumnStyle}>
                                            <strong>Treino recomendado</strong>
                                            {(trainingFocus.length ? trainingFocus : improvementPoints).slice(0, 3).map((item, index) => (
                                                <span key={`${report.id}-training-${index}`}>{item}</span>
                                            ))}
                                        </div>
                                        <div style={coachActionColumnStyle}>
                                            <strong>Recuperacao</strong>
                                            {(recoveryActions.length ? recoveryActions : coachingItems).slice(0, 3).map((item, index) => (
                                                <span key={`${report.id}-recovery-${index}`}>{item}</span>
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
                                <MiniStat label="Coach LLM" value={breakdown.llmAnalyzed} />
                                <MiniStat label="Perdidas" value={breakdown.lost} />
                                <MiniStat label="Recuperaveis" value={breakdown.recoverable} />
                                <MiniStat label="Mensagens" value={breakdown.messages} />
                                <MiniStat label="Analisadas Uazapi" value={uazapiMessagesAnalyzed || 0} />
                                <MiniStat label="Analisadas CRM" value={crmMessagesAnalyzed || 0} />
                                <MiniStat label="Msgs lead" value={breakdown.inbound} />
                                <MiniStat label="Resp. corretor" value={breakdown.outbound} />
                                <MiniStat label="Resp. media" value={formatDuration(breakdown.avgResponse)} />
                                <MiniStat label="Comunicacao" value={breakdown.communicationQuality !== null ? `${breakdown.communicationQuality}/100` : 'sem LLM'} />
                                <MiniStat label="Fechamento" value={breakdown.closingQuality !== null ? `${breakdown.closingQuality}/100` : 'sem LLM'} />
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

function OwnerAvatar({ name, photoUrl, size = 54 }: { name: string; photoUrl?: string | null; size?: number }) {
    const imageUrl = cleanLabel(photoUrl)
    const sizedAvatarStyle: CSSProperties = {
        ...ownerAvatarStyle,
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        fontSize: size <= 18 ? '0.55rem' : size <= 34 ? '0.72rem' : '0.82rem',
        boxShadow: size <= 34 ? 'none' : ownerAvatarStyle.boxShadow,
    }
    return (
        <div
            aria-label={`Foto de ${name}`}
            style={{
                ...sizedAvatarStyle,
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

const pipelineSectionStyle: CSSProperties = {
    maxWidth: '100%',
    minWidth: 0,
    padding: 18,
    borderRadius: 12,
    border: '1px solid #e8e5e0',
    background: '#fff',
    boxShadow: '0 10px 28px rgba(15,23,42,0.06)',
    overflow: 'hidden',
}

const pipelineHeaderStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
    flexWrap: 'wrap',
}

const pipelineEyebrowStyle: CSSProperties = {
    display: 'block',
    color: '#8a6a1f',
    fontSize: '0.68rem',
    fontWeight: 950,
    letterSpacing: 0,
    textTransform: 'uppercase',
}

const pipelineTitleStyle: CSSProperties = {
    display: 'block',
    color: '#1a1a1a',
    fontSize: '1.05rem',
    lineHeight: 1.25,
    marginTop: 2,
}

const pipelineHeaderActionsStyle: CSSProperties = {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
}

const pipelineScrollControlsStyle: CSSProperties = {
    display: 'inline-flex',
    gap: 5,
    padding: 2,
    borderRadius: 999,
    background: '#fafafa',
    border: '1px solid #e8e5e0',
}

const pipelineRoundButtonStyle: CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: 'none',
    background: '#fff',
    color: '#6b4f1d',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
}

const pipelineMetricPillStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 8px',
    borderRadius: 999,
    border: '1px solid',
    fontSize: '0.68rem',
    fontWeight: 900,
}

const pipelineOwnerGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(178px, 1fr))',
    gap: 8,
    marginBottom: 14,
}

const pipelineOwnerCardStyle: CSSProperties = {
    minHeight: 82,
    borderRadius: 10,
    border: '1px solid #e8e5e0',
    background: '#fafafa',
    color: '#1a1a1a',
    padding: 10,
    textAlign: 'left',
    cursor: 'pointer',
}

const pipelineOwnerCardSelectedStyle: CSSProperties = {
    borderColor: '#c8a66a',
    background: '#f8f1df',
    boxShadow: '0 8px 20px rgba(200,166,106,0.16)',
}

const pipelineOwnerTopStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'center',
}

const pipelineOwnerIdentityStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    minWidth: 0,
}

const pipelineOwnerNameStyle: CSSProperties = {
    display: 'block',
    fontSize: '0.78rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
}

const pipelineOwnerTotalStyle: CSSProperties = {
    flexShrink: 0,
    color: '#64748b',
    fontSize: '0.68rem',
    fontWeight: 950,
}

const pipelineScoreBadgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    width: 'fit-content',
    marginTop: 6,
    padding: '2px 7px',
    borderRadius: 999,
    background: '#111827',
    color: '#fff7ed',
    border: '1px solid rgba(200,166,106,0.55)',
    fontSize: '0.58rem',
    fontWeight: 950,
    textTransform: 'uppercase',
    letterSpacing: 0,
}

const pipelineHeatBarStyle: CSSProperties = {
    display: 'grid',
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
    background: '#edf0f2',
    marginTop: 10,
}

const pipelineOwnerMetaStyle: CSSProperties = {
    display: 'block',
    marginTop: 7,
    color: '#64748b',
    fontSize: '0.64rem',
    fontWeight: 800,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
}

const pipelineScrollerStyle: CSSProperties = {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    display: 'grid',
    gridAutoFlow: 'column',
    gridAutoColumns: 'minmax(188px, 208px)',
    gap: 10,
    alignItems: 'start',
    overflowX: 'auto',
    overflowY: 'hidden',
    paddingBottom: 14,
    scrollbarGutter: 'stable',
    scrollbarWidth: 'thin',
    scrollbarColor: '#c8a66a #f5f0ea',
}

const pipelineColumnStyle: CSSProperties = {
    minHeight: 240,
    height: 560,
    overflowY: 'auto',
    borderRadius: 10,
    border: '1px solid',
    background: '#fafafa',
}

const pipelineColumnHeaderStyle: CSSProperties = {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    padding: '9px 10px',
    background: '#fff',
    borderBottom: '1px solid',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'center',
}

const pipelineColumnTitleStyle: CSSProperties = {
    color: '#1a1a1a',
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
}

const pipelineColumnCountStyle: CSSProperties = {
    display: 'inline-flex',
    minWidth: 24,
    justifyContent: 'center',
    padding: '2px 6px',
    borderRadius: 999,
    fontSize: '0.66rem',
    fontWeight: 950,
}

const pipelineColumnBodyStyle: CSSProperties = {
    display: 'grid',
    gap: 7,
    padding: 8,
}

const pipelineEmptyColumnStyle: CSSProperties = {
    minHeight: 70,
    borderRadius: 8,
    border: '1px dashed #d8d3ca',
    color: '#94a3b8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.68rem',
    fontWeight: 800,
}

const pipelineLeadCardStyle: CSSProperties = {
    borderRadius: 9,
    border: '1px solid',
    background: '#fff',
    boxShadow: '0 4px 14px rgba(15,23,42,0.06)',
    overflow: 'hidden',
}

const pipelineLeadButtonStyle: CSSProperties = {
    width: '100%',
    padding: 9,
    textAlign: 'left',
}

const pipelineLeadHeaderStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
}

const pipelineLeadNameRowStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 6,
    alignItems: 'flex-start',
}

const pipelineLeadNameStyle: CSSProperties = {
    display: 'block',
    color: '#1a1a1a',
    fontSize: '0.74rem',
    lineHeight: 1.2,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
}

const pipelineLeadScoreStyle: CSSProperties = {
    flexShrink: 0,
    border: '1px solid',
    borderRadius: 999,
    padding: '2px 6px',
    fontSize: '0.58rem',
    fontWeight: 950,
}

const pipelineLeadReasonStyle: CSSProperties = {
    display: 'block',
    fontSize: '0.62rem',
    fontWeight: 900,
    marginTop: 3,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
}

const pipelineLeadHeatStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 3,
    marginTop: 8,
}

const pipelineLeadPhoneStyle: CSSProperties = {
    display: 'block',
    color: '#475569',
    fontSize: '0.62rem',
    fontWeight: 750,
    marginTop: 7,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
}

const pipelineLeadOwnerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    color: '#94a3b8',
    fontSize: '0.6rem',
    fontWeight: 750,
    marginTop: 4,
    minWidth: 0,
}

const pipelineLeadActionsStyle: CSSProperties = {
    display: 'flex',
    borderTop: '1px solid #edf0f2',
}

const pipelineLeadActionStyle: CSSProperties = {
    flex: 1,
    textAlign: 'center',
    textDecoration: 'none',
    border: 'none',
    background: '#fafafa',
    color: '#334155',
    padding: '6px 8px',
    fontSize: '0.62rem',
    fontWeight: 950,
}

const pipelineLeadWhatsappActionStyle: CSSProperties = {
    background: '#ecfdf5',
    color: '#047857',
}

const pipelineColumnMoreStyle: CSSProperties = {
    color: '#64748b',
    textAlign: 'center',
    fontSize: '0.64rem',
    fontWeight: 850,
    padding: '6px 0',
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

const coachActionGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))',
    gap: 8,
}

const coachActionColumnStyle: CSSProperties = {
    border: '1px solid rgba(14,165,233,0.18)',
    background: 'rgba(240,249,255,0.72)',
    borderRadius: 8,
    padding: '10px 11px',
    display: 'grid',
    gap: 5,
    color: '#075985',
    fontSize: '0.79rem',
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
