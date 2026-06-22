'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
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
}

type ImportJob = {
    id: string
    instance_id?: string | null
    status: string
    summary?: Record<string, any>
    created_at?: string
}

function todayDate() {
    return new Date().toISOString().slice(0, 10)
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

function scoreColor(score: number) {
    if (score >= 80) return '#22c55e'
    if (score >= 60) return '#eab308'
    return '#ef4444'
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
    const [date, setDate] = useState(todayDate())
    const [instanceId, setInstanceId] = useState('')
    const [reports, setReports] = useState<AttendanceReport[]>([])
    const [scores, setScores] = useState<ConversationScore[]>([])
    const [instances, setInstances] = useState<InstanceRow[]>([])
    const [jobs, setJobs] = useState<ImportJob[]>([])
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const instanceById = useMemo(() => new Map(instances.map((item) => [item.id, item])), [instances])
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

    async function load() {
        setLoading(true)
        setMessage(null)
        try {
            const params = new URLSearchParams()
            if (date) params.set('date', date)
            if (instanceId) params.set('instance_id', instanceId)
            const res = await fetch(`/api/admin/leads/attendance-reports?${params.toString()}`)
            const data = await res.json()
            if (!res.ok || !data?.success) throw new Error(data?.error || 'Falha ao carregar relatórios')
            setReports(data.reports || [])
            setScores(data.conversation_scores || [])
            setInstances(data.instances || [])
            setJobs(data.jobs || [])
        } catch (error) {
            setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Erro ao carregar relatórios.' })
        } finally {
            setLoading(false)
        }
    }

    async function runNow() {
        setRunning(true)
        setMessage({ type: 'success', text: 'Sincronizando contatos, chats e mensagens. Isso pode levar alguns instantes.' })
        try {
            const res = await fetch('/api/admin/leads/attendance-reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'sync_and_report',
                    instance_id: instanceId || null,
                    date,
                    force: true,
                    include_history_sync: true,
                }),
            })
            const data = await res.json()
            if (!res.ok || !data?.success) throw new Error(data?.error || 'Falha ao gerar relatório')
            const totals = data?.sync?.totals || {}
            setMessage({
                type: 'success',
                text: `Sincronização concluída: ${Number(totals.contacts || 0)} contatos, ${Number(totals.chats || 0)} chats e ${Number(totals.messages || 0)} mensagens importadas.`,
            })
            await load()
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
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        style={controlStyle}
                    />
                    <select value={instanceId} onChange={(e) => setInstanceId(e.target.value)} style={controlStyle}>
                        <option value="">Todas as instâncias</option>
                        {instances.map((inst) => (
                            <option key={inst.id} value={inst.id}>{getInstanceOptionLabel(inst)}</option>
                        ))}
                    </select>
                    <button type="button" onClick={load} style={ghostButtonStyle}>
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

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: 12 }}>
                <Metric icon={<Users size={18} />} label="Instâncias monitoradas" value={`${monitoredInstances}/${instances.length}`} />
                <Metric icon={<MessageSquare size={18} />} label="Conversas analisadas" value={String(totals.conversations)} />
                <Metric icon={<Database size={18} />} label="Mensagens analisadas" value={String(totals.messages)} />
                <Metric icon={<Flame size={18} />} label="Leads quentes" value={String(totals.hot)} />
                <Metric icon={<AlertTriangle size={18} />} label="Sem última resposta" value={String(totals.unanswered)} />
            </section>

            <section style={{ display: 'grid', gap: 12 }}>
                {reports.length === 0 ? (
                    <div style={emptyStyle}>
                        Nenhum relatório encontrado para o filtro atual. Use “Gerar agora” para sincronizar as instâncias conectadas.
                    </div>
                ) : reports.map((report) => {
                    const inst = instanceById.get(report.instance_id)
                    const reportScores = (scoresByReport.get(report.id) || []).slice(0, 6)
                    const coverage = report.coverage || {}
                    const metrics = report.metrics || {}
                    const recommendations = Array.isArray(report.recommendations) ? report.recommendations : []
                    const ownerName = getOwnerName(inst, report.instance_id)
                    const ownerDetails = [
                        cleanLabel(inst?.owner_subtitle),
                        cleanLabel(inst?.owner_phone || inst?.phone_number) ? formatPhone(inst?.owner_phone || inst?.phone_number) : null,
                    ].filter(Boolean)
                    const ownerPhotoUrl = cleanLabel(inst?.owner_photo_url)
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
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ color: scoreColor(Number(report.score || 0)), fontSize: '2rem', fontWeight: 950, lineHeight: 1 }}>
                                        {Number(report.score || 0)}
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 800 }}>score geral</div>
                                </div>
                            </div>

                            <p style={{ margin: '12px 0 0', color: 'var(--text-secondary)', lineHeight: 1.5, fontSize: '0.9rem' }}>
                                {report.summary}
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 8, marginTop: 12 }}>
                                <MiniStat label="Contatos" value={coverage.contacts_synced || 0} />
                                <MiniStat label="Chats" value={coverage.chats_synced || 0} />
                                <MiniStat label="Conversas" value={coverage.conversations_analyzed || 0} />
                                <MiniStat label="Resp. média" value={formatDuration(metrics.avg_response_seconds)} />
                            </div>

                            {recommendations.length > 0 && (
                                <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
                                    {recommendations.slice(0, 4).map((item, index) => (
                                        <div key={`${report.id}-rec-${index}`} style={recommendationStyle}>
                                            {item}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {reportScores.length > 0 && (
                                <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 900 }}>Conversas que pedem atenção</div>
                                    {reportScores.map((score) => (
                                        <div key={score.id || score.chat_id} style={conversationStyle}>
                                            <div>
                                                <strong style={{ color: scoreColor(score.score) }}>{score.score}/100</strong>
                                                <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{formatPhone(score.phone)}</span>
                                            </div>
                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                                {score.summary || 'Conversa analisada.'}
                                            </div>
                                            {!!score.risks?.length && (
                                                <div style={{ color: '#fca5a5', fontSize: '0.78rem' }}>
                                                    {score.risks.slice(0, 2).join(' | ')}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
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

const recommendationStyle: CSSProperties = {
    border: '1px solid rgba(180,83,9,0.24)',
    background: 'rgba(251,191,36,0.14)',
    color: '#92400e',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: '0.8rem',
    fontWeight: 800,
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

const conversationStyle: CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '9px 10px',
    display: 'grid',
    gap: 4,
    background: 'rgba(0,0,0,0.12)',
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
