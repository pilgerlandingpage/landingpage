'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, BarChart3, Flame, MessageSquare, RefreshCw } from 'lucide-react'
import AdminLoadingState from '@/components/admin/AdminLoadingState'

type AttendanceReport = {
    id: string
    instance_id: string
    report_date: string
    score: number
    summary?: string | null
    coverage?: Record<string, any>
    metrics?: Record<string, any>
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

type InstanceRow = {
    id: string
    instance_name?: string | null
    owner_name?: string | null
    owner_subtitle?: string | null
    owner_phone?: string | null
    phone_number?: string | null
    owner_photo_url?: string | null
}

type DetailPayload = {
    reports?: AttendanceReport[]
    conversation_scores?: ConversationScore[]
    instances?: InstanceRow[]
}

const filters = [
    { key: 'todos', label: 'Todas' },
    { key: 'critica', label: 'Amostra critica' },
    { key: 'sem-resposta', label: 'Sem resposta' },
    { key: 'quentes', label: 'Leads quentes' },
    { key: 'ruins', label: 'Ruins' },
    { key: 'mornos', label: 'Mornos' },
    { key: 'frios', label: 'Frios' },
    { key: 'bons', label: 'Boas' },
] as const

function formatDateLabel(value?: string | null) {
    if (!value) return ''
    const [year, month, day] = value.split('-')
    if (!year || !month || !day) return value
    return `${day}/${month}/${year}`
}

function formatDuration(seconds?: number | null) {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return 'sem resposta'
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes}min`
    return `${Math.round(minutes / 60)}h`
}

function formatPhone(phone?: string | null) {
    const digits = String(phone || '').replace(/\D/g, '')
    if (!digits) return 'sem telefone'
    if (digits.length >= 12 && digits.startsWith('55')) return `+55 ${digits.slice(2, 4)} ${digits.slice(4)}`
    return `+${digits}`
}

function potentialLabel(value?: ConversationScore['lead_potential']) {
    if (value === 'hot') return 'Quente'
    if (value === 'warm') return 'Morno'
    if (value === 'cold') return 'Frio'
    return 'Indefinido'
}

function scoreColor(score: number) {
    if (score >= 80) return '#16a34a'
    if (score >= 60) return '#b45309'
    return '#dc2626'
}

function getOwnerName(instance?: InstanceRow, fallback?: string) {
    return instance?.owner_name || instance?.instance_name || fallback || 'WhatsApp sem dono'
}

function getBreakdown(scores: ConversationScore[], report?: AttendanceReport | null) {
    const metrics = report?.metrics || {}
    const coverage = report?.coverage || {}
    return {
        total: scores.length || Number(coverage.conversations_analyzed || 0),
        hot: scores.filter((score) => score.lead_potential === 'hot').length || Number(metrics.hot_leads || 0),
        unanswered: scores.filter((score) => score.unanswered).length || Number(metrics.unanswered_conversations || 0),
        poor: scores.filter((score) => Number(score.score || 0) < 60).length || Number(metrics.poor_conversations || 0),
        strong: scores.filter((score) => Number(score.score || 0) >= 80).length || Number(metrics.strong_conversations || 0),
        messages: Number(coverage.messages_analyzed || 0),
    }
}

function detailHref(reportId: string, filter: string) {
    return `/admin/leads/relatorios-atendimento/detalhes?report_id=${encodeURIComponent(reportId)}&filtro=${encodeURIComponent(filter)}`
}

export default function AttendanceReportDetailsClient({ reportId, filter }: { reportId: string; filter: string }) {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [payload, setPayload] = useState<DetailPayload>({})

    useEffect(() => {
        if (!reportId) {
            setError('Relatorio nao informado.')
            setLoading(false)
            return
        }

        const controller = new AbortController()
        async function load() {
            setLoading(true)
            setError('')
            try {
                const params = new URLSearchParams({ report_id: reportId, filtro: filter || 'todos' })
                const res = await fetch(`/api/admin/leads/attendance-reports?${params.toString()}`, { signal: controller.signal })
                const data = await res.json()
                if (!res.ok || !data?.success) throw new Error(data?.error || 'Falha ao carregar detalhes.')
                setPayload(data)
            } catch (loadError) {
                if (controller.signal.aborted) return
                setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar detalhes.')
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        }

        void load()
        return () => controller.abort()
    }, [reportId, filter])

    const report = payload.reports?.[0] || null
    const scores = payload.conversation_scores || []
    const instance = useMemo(() => payload.instances?.find((item) => item.id === report?.instance_id), [payload.instances, report?.instance_id])
    const ownerName = getOwnerName(instance, report?.instance_id)
    const breakdown = getBreakdown(scores, report)
    const activeFilter = filters.find((item) => item.key === filter)?.label || 'Todas'

    if (loading) return <AdminLoadingState message="Carregando conversas do relatorio..." />

    return (
        <main style={pageStyle}>
            <header style={headerStyle}>
                <div>
                    <Link href="/admin/leads/relatorios-atendimento" style={backLinkStyle}>
                        <ArrowLeft size={16} /> Voltar aos relatorios
                    </Link>
                    <h1 style={titleStyle}>
                        <BarChart3 size={24} color="var(--gold)" /> Detalhes do atendimento
                    </h1>
                    <p style={subtitleStyle}>
                        {ownerName} {report?.report_date ? `| ${formatDateLabel(report.report_date)}` : ''} | Filtro: {activeFilter}
                    </p>
                </div>
                {report && (
                    <div style={{ textAlign: 'right' }}>
                        <strong style={{ color: scoreColor(Number(report.score || 0)), fontSize: '2rem', lineHeight: 1 }}>{Number(report.score || 0)}</strong>
                        <div style={{ color: 'var(--text-muted)', fontWeight: 850, fontSize: '0.78rem' }}>score geral</div>
                    </div>
                )}
            </header>

            {error && <div style={errorStyle}>{error}</div>}

            {report && (
                <>
                    <section style={summaryGridStyle}>
                        <Metric icon={<MessageSquare size={18} />} label="Conversas no filtro" value={String(breakdown.total)} />
                        <Metric icon={<Flame size={18} />} label="Leads quentes" value={String(breakdown.hot)} />
                        <Metric icon={<AlertTriangle size={18} />} label="Sem resposta" value={String(breakdown.unanswered)} />
                        <Metric icon={<AlertTriangle size={18} />} label="Conversas ruins" value={String(breakdown.poor)} />
                        <Metric icon={<BarChart3 size={18} />} label="Boas conversas" value={String(breakdown.strong)} />
                    </section>

                    <section style={reportSummaryStyle}>
                        <strong>Parecer do relatorio</strong>
                        <p>{report.summary || 'Sem parecer salvo para este relatorio.'}</p>
                        <span>{breakdown.messages} mensagem(ns) analisada(s) no periodo completo.</span>
                    </section>

                    <nav style={filterNavStyle} aria-label="Filtros do relatorio">
                        {filters.map((item) => (
                            <Link
                                key={item.key}
                                href={detailHref(report.id, item.key)}
                                style={item.key === filter ? activeFilterStyle : filterLinkStyle}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    <section style={{ display: 'grid', gap: 10 }}>
                        {scores.length === 0 ? (
                            <div style={emptyStyle}>Nenhuma conversa encontrada para este filtro.</div>
                        ) : scores.map((score) => {
                            const metrics = score.metrics || {}
                            const risks = Array.isArray(score.risks) ? score.risks : []
                            const recommendations = Array.isArray(score.recommendations) ? score.recommendations : []
                            return (
                                <article key={score.id || score.chat_id} style={conversationStyle}>
                                    <div style={conversationTopStyle}>
                                        <div>
                                            <strong style={{ color: scoreColor(score.score), fontSize: '1.05rem' }}>{score.score}/100</strong>
                                            <span style={phoneStyle}>{formatPhone(score.phone)}</span>
                                        </div>
                                        <div style={chipRowStyle}>
                                            <span style={badgeStyle}>{potentialLabel(score.lead_potential)}</span>
                                            {score.unanswered && <span style={dangerBadgeStyle}>Sem resposta</span>}
                                        </div>
                                    </div>

                                    <div style={metricsGridStyle}>
                                        <MiniStat label="Msgs lead" value={metrics.inbound_messages || 0} />
                                        <MiniStat label="Resp. corretor" value={metrics.outbound_messages || 0} />
                                        <MiniStat label="Tempo medio" value={formatDuration(score.response_time_seconds)} />
                                        <MiniStat label="Rapport" value={metrics.rapport_hits || 0} />
                                        <MiniStat label="Venda" value={metrics.sales_hits || 0} />
                                    </div>

                                    <p style={conversationSummaryStyle}>{score.summary || 'Conversa analisada.'}</p>

                                    {risks.length > 0 && (
                                        <div style={chipRowStyle}>
                                            {risks.map((risk) => <span key={risk} style={riskChipStyle}>{risk}</span>)}
                                        </div>
                                    )}
                                    {recommendations.length > 0 && (
                                        <div style={chipRowStyle}>
                                            {recommendations.map((item) => <span key={item} style={nextChipStyle}>{item}</span>)}
                                        </div>
                                    )}
                                </article>
                            )
                        })}
                    </section>
                </>
            )}
        </main>
    )
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
    return (
        <div style={metricStyle}>
            <div style={{ color: 'var(--gold)' }}>{icon}</div>
            <div>
                <strong>{value}</strong>
                <span>{label}</span>
            </div>
        </div>
    )
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
    return (
        <div style={miniStatStyle}>
            <strong>{value}</strong>
            <span>{label}</span>
        </div>
    )
}

const pageStyle: CSSProperties = {
    padding: 28,
    color: 'var(--text-primary)',
    display: 'grid',
    gap: 16,
}

const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 14,
    flexWrap: 'wrap',
}

const backLinkStyle: CSSProperties = {
    color: '#7c520f',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: '0.78rem',
    fontWeight: 900,
    marginBottom: 8,
}

const titleStyle: CSSProperties = {
    margin: 0,
    fontSize: '1.55rem',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
}

const subtitleStyle: CSSProperties = {
    margin: '6px 0 0',
    color: 'var(--text-muted)',
    fontSize: '0.88rem',
}

const summaryGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
    gap: 10,
}

const metricStyle: CSSProperties = {
    minHeight: 78,
    border: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    borderRadius: 8,
    padding: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
}

const reportSummaryStyle: CSSProperties = {
    border: '1px solid rgba(148,163,184,0.24)',
    background: 'rgba(248,250,252,0.92)',
    borderRadius: 8,
    padding: 14,
    display: 'grid',
    gap: 6,
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
}

const filterNavStyle: CSSProperties = {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
}

const filterLinkStyle: CSSProperties = {
    border: '1px solid var(--border)',
    background: '#fff',
    color: 'var(--text-secondary)',
    borderRadius: 8,
    padding: '8px 10px',
    textDecoration: 'none',
    fontSize: '0.78rem',
    fontWeight: 900,
}

const activeFilterStyle: CSSProperties = {
    ...filterLinkStyle,
    borderColor: 'rgba(201,169,110,0.42)',
    background: 'rgba(201,169,110,0.14)',
    color: '#7c520f',
}

const conversationStyle: CSSProperties = {
    border: '1px solid rgba(148,163,184,0.24)',
    background: '#fff',
    borderRadius: 8,
    padding: 14,
    display: 'grid',
    gap: 10,
    boxShadow: '0 8px 18px rgba(15,23,42,0.05)',
}

const conversationTopStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
}

const phoneStyle: CSSProperties = {
    color: 'var(--text-secondary)',
    marginLeft: 8,
    fontWeight: 850,
}

const metricsGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))',
    gap: 8,
}

const miniStatStyle: CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '8px 9px',
    background: 'rgba(248,250,252,0.9)',
    display: 'grid',
    gap: 2,
    fontSize: '0.76rem',
}

const conversationSummaryStyle: CSSProperties = {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: '0.84rem',
    lineHeight: 1.45,
}

const chipRowStyle: CSSProperties = {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
}

const badgeStyle: CSSProperties = {
    border: '1px solid rgba(100,116,139,0.2)',
    background: 'rgba(248,250,252,0.92)',
    color: '#334155',
    borderRadius: 999,
    padding: '4px 8px',
    fontSize: '0.7rem',
    fontWeight: 900,
}

const dangerBadgeStyle: CSSProperties = {
    ...badgeStyle,
    borderColor: 'rgba(239,68,68,0.22)',
    background: 'rgba(254,226,226,0.78)',
    color: '#991b1b',
}

const riskChipStyle: CSSProperties = {
    border: '1px solid rgba(239,68,68,0.18)',
    background: 'rgba(254,226,226,0.68)',
    color: '#991b1b',
    borderRadius: 8,
    padding: '5px 8px',
    fontSize: '0.76rem',
    fontWeight: 800,
}

const nextChipStyle: CSSProperties = {
    border: '1px solid rgba(14,165,233,0.2)',
    background: 'rgba(224,242,254,0.7)',
    color: '#075985',
    borderRadius: 8,
    padding: '5px 8px',
    fontSize: '0.76rem',
    fontWeight: 800,
}

const emptyStyle: CSSProperties = {
    border: '1px dashed var(--border)',
    borderRadius: 8,
    padding: 22,
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontWeight: 800,
}

const errorStyle: CSSProperties = {
    border: '1px solid rgba(239,68,68,0.26)',
    background: 'rgba(254,226,226,0.7)',
    color: '#991b1b',
    borderRadius: 8,
    padding: 12,
    fontWeight: 850,
}
