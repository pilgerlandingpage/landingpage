'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    ClipboardList,
    Copy,
    Database,
    ExternalLink,
    Loader2,
    MessageSquareText,
    RefreshCw,
    Route,
    ShieldCheck,
    Sparkles,
    Wrench,
    XCircle,
} from 'lucide-react'
import AdminLoadingState from '@/components/admin/AdminLoadingState'

type CheckStatus = 'ok' | 'warn' | 'missing'

type CheckItem = {
    key: string
    label: string
    status: CheckStatus
    detail: string
    meta?: Record<string, unknown>
}

type CheckSection = {
    key: string
    label: string
    status: CheckStatus
    score: number
    items: CheckItem[]
}

type PreTestGoLivePacket = {
    ready: boolean
    status: string
    launch_state: string
    score: number
    blockers: number
    warnings: number
    checklist: Array<{
        key: string
        label: string
        status: string
        action: string
    }>
    final_test_runbook: Array<{
        step: number
        label: string
        detail: string
        evidence: string
    }>
    required_evidence: string[]
    rollback_plan: Array<{
        label: string
        action: string
    }>
    handoff?: {
        owner: string
        mode: string
        next_gate: string
    }
}

type PreTestPostLaunchReport = {
    ready: boolean
    status: string
    score: number
    blockers: number
    watchpoints: number
    signals: Array<{
        key: string
        label: string
        status: string
        detail: string
        next_action: string
        critical?: boolean
    }>
    metrics: Record<string, number>
    stabilization_checklist: string[]
    executive_summary: string
    next_operating_window?: {
        label: string
        duration: string
        cadence: string
    }
}

type PreTestFinalPhase = {
    code_complete: boolean
    status: string
    label: string
    detail: string
    score?: number
    remaining_actions: string[]
    core_checks: Record<string, boolean>
    checks?: Array<{
        key: string
        label: string
        status: string
        detail: string
        action: string
    }>
    metrics?: Record<string, number>
}

type PreTestPayload = {
    success: boolean
    generated_at: string
    status: CheckStatus
    score: number
    blockers: number
    warnings: number
    phase_1?: {
        code_complete: boolean
        status: string
        label: string
        detail: string
        remaining_actions: string[]
        core_checks: Record<string, boolean>
    }
    phase_2?: {
        code_complete: boolean
        status: string
        label: string
        detail: string
        remaining_actions: string[]
        core_checks: Record<string, boolean>
        totals?: Record<string, unknown>
    }
    phase_3?: {
        code_complete: boolean
        status: string
        label: string
        detail: string
        remaining_actions: string[]
        core_checks: Record<string, boolean>
        automation?: Record<string, unknown>
    }
    phase_4?: {
        code_complete: boolean
        status: string
        label: string
        detail: string
        remaining_actions: string[]
        core_checks: Record<string, boolean>
        governance?: Record<string, unknown>
    }
    phase_5?: {
        code_complete: boolean
        status: string
        label: string
        detail: string
        remaining_actions: string[]
        core_checks: Record<string, boolean>
        go_live?: PreTestGoLivePacket
    }
    phase_6?: {
        code_complete: boolean
        status: string
        label: string
        detail: string
        remaining_actions: string[]
        core_checks: Record<string, boolean>
        post_launch?: PreTestPostLaunchReport
    }
    phase_7?: PreTestFinalPhase
    phase_8?: PreTestFinalPhase
    phase_9?: PreTestFinalPhase & {
        automated_results?: {
            total_scenarios?: number
            route_scenarios?: number
            failed_routes?: number
            blocked_permission_scenarios?: number
            covered_agents?: string[]
        }
        practical_messages?: Array<{
            key: string
            label: string
            text: string
            expected: string
        }>
        evidence_required?: string[]
    }
    summary: {
        public_url: string
        required_webhook_url: string
        connected_instances: number
        global_instance: {
            id: string
            instance_name: string | null
            instance_type: string | null
            status: string | null
            phone_masked: string
            has_token: boolean
            has_broker_link?: boolean
            broker_id?: string | null
            connected_at: string | null
            updated_at: string | null
        } | null
        counts: Record<string, number>
    }
    identity_matrix?: Array<{
        key: string
        label: string
        detected: number
        ready: boolean
        permissions: string[]
        expected_behavior: string
    }>
    pilger_route_matrix?: Array<{
        key: string
        label: string
        message: string
        identity_label: string
        permissions: string[]
        command_type: string
        required_permission: string | null
        target_agent: string
        target_agent_name: string
        execution_mode: string
        allowed: boolean
        status: CheckStatus
        detail: string
    }>
    sections: CheckSection[]
    test_plan?: Array<{
        key: string
        label: string
        message: string
        expected: string
    }>
    test_messages: Array<{
        key: string
        label: string
        text: string
        expected?: string
    }>
    links: Array<{
        label: string
        href: string
    }>
}

type ToastState = {
    type: 'success' | 'error'
    text: string
} | null

const statusCopy: Record<CheckStatus, { label: string; tone: string; icon: typeof CheckCircle2 }> = {
    ok: { label: 'Pronto', tone: 'ok', icon: CheckCircle2 },
    warn: { label: 'Atencao', tone: 'warn', icon: AlertTriangle },
    missing: { label: 'Bloqueado', tone: 'risk', icon: XCircle },
}

function formatDateTime(value?: string | null) {
    if (!value) return '-'
    return new Date(value).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function statusMeta(status: CheckStatus) {
    return statusCopy[status] || statusCopy.warn
}

function SectionIcon({ keyName }: { keyName: string }) {
    if (keyName === 'webhook') return <Route size={18} />
    if (keyName === 'identity') return <ShieldCheck size={18} />
    if (keyName === 'pilger') return <MessageSquareText size={18} />
    if (keyName === 'vitor') return <Sparkles size={18} />
    if (keyName === 'central') return <Database size={18} />
    if (keyName === 'automation') return <RefreshCw size={18} />
    return <MessageSquareText size={18} />
}

function StatusBadge({ status }: { status: CheckStatus }) {
    const meta = statusMeta(status)
    const Icon = meta.icon
    return (
        <span className={`pretest-badge ${meta.tone}`}>
            <Icon size={14} />
            {meta.label}
        </span>
    )
}

function ScoreRing({ score, status }: { score: number; status: CheckStatus }) {
    const meta = statusMeta(status)
    return (
        <div className={`pretest-score-ring ${meta.tone}`} style={{ ['--score' as string]: `${score}%` }}>
            <strong>{score}</strong>
            <span>%</span>
        </div>
    )
}

function ItemRow({ item }: { item: CheckItem }) {
    const meta = statusMeta(item.status)
    const Icon = meta.icon
    return (
        <li className={`pretest-item ${meta.tone}`}>
            <span className="pretest-item-icon"><Icon size={17} /></span>
            <div>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
            </div>
        </li>
    )
}

function SummaryMetric({ label, value, hint }: { label: string; value: string | number; hint: string }) {
    return (
        <article className="pretest-metric">
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
        </article>
    )
}

export default function WhatsAppGlobalPreTestPage() {
    const [data, setData] = useState<PreTestPayload | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [repairingWebhook, setRepairingWebhook] = useState(false)
    const [error, setError] = useState('')
    const [toast, setToast] = useState<ToastState>(null)

    const loadData = async (silent = false) => {
        if (silent) setRefreshing(true)
        else setLoading(true)
        setError('')
        try {
            const response = await fetch('/api/admin/whatsapp/global/pre-test', { cache: 'no-store' })
            const payload = await response.json()
            if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Nao foi possivel carregar o pre-teste.')
            setData(payload)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro desconhecido.')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => {
        loadData(false)
    }, [])

    const orderedSections = useMemo(() => data?.sections || [], [data?.sections])
    const counts = data?.summary?.counts || {}
    const status = data?.status || 'warn'
    const meta = statusMeta(status)
    const HeaderIcon = meta.icon
    const phase5GoLive = data?.phase_5?.go_live
    const phase6PostLaunch = data?.phase_6?.post_launch
    const finalPhases = [
        {
            key: 'phase_7',
            phase: data?.phase_7,
            completeTitle: 'Pilger esta fechado para a Fase 7 de identidade.',
            pendingTitle: 'Ainda ha ajustes na separacao de identidades da Fase 7.',
        },
        {
            key: 'phase_8',
            phase: data?.phase_8,
            completeTitle: 'Pilger esta fechado para a Fase 8 de painel.',
            pendingTitle: 'Ainda ha ajustes no painel de acompanhamento da Fase 8.',
        },
        {
            key: 'phase_9',
            phase: data?.phase_9,
            completeTitle: 'Pilger esta fechado para a Fase 9 de testes praticos.',
            pendingTitle: 'Ainda ha ajustes na bateria pratica da Fase 9.',
        },
    ].filter(item => item.phase)

    const copyText = async (text: string) => {
        if (typeof navigator === 'undefined') return
        await navigator.clipboard.writeText(text)
        setToast({ type: 'success', text: 'Mensagem copiada.' })
        window.setTimeout(() => setToast(null), 2200)
    }

    const repairWebhook = async () => {
        setRepairingWebhook(true)
        try {
            const response = await fetch('/api/admin/whatsapp/global/pre-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok || !payload?.success) {
                throw new Error(payload?.error || 'Nao foi possivel reparar o webhook.')
            }
            setToast({ type: 'success', text: payload?.message || 'Webhook global configurado.' })
            window.setTimeout(() => setToast(null), 2600)
            await loadData(true)
        } catch (err) {
            setToast({ type: 'error', text: err instanceof Error ? err.message : 'Erro desconhecido.' })
            window.setTimeout(() => setToast(null), 3200)
        } finally {
            setRepairingWebhook(false)
        }
    }

    if (loading) {
        return <AdminLoadingState message="Validando WhatsApp Global, Pilger e Central..." />
    }

    if (error) {
        return (
            <div className="admin-page pretest-page">
                <div className="pretest-error">
                    <XCircle size={28} />
                    <h2>Falha ao carregar pre-teste</h2>
                    <p>{error}</p>
                    <button type="button" className="btn btn-gold" onClick={() => loadData(false)}>
                        <RefreshCw size={16} /> Tentar novamente
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="admin-page pretest-page">
            {toast && (
                <div className={`pretest-toast ${toast.type}`}>
                    {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    {toast.text}
                </div>
            )}

            <div className="admin-header pretest-header">
                <div>
                    <Link href="/admin/whatsapp/global" className="back-link">
                        <ArrowLeft size={18} /> WhatsApp Global
                    </Link>
                    <h1>Pre-teste Global + Pilger</h1>
                    <p>Checklist operacional do concierge, roteador de agentes e testes ponta a ponta pelo WhatsApp.</p>
                </div>
                <div className="pretest-header-actions">
                    <Link href="/admin/ads/vitor" className="btn btn-outline">
                        <Sparkles size={16} /> Vitor
                    </Link>
                    <button type="button" className="btn btn-outline" disabled={repairingWebhook || refreshing} onClick={repairWebhook}>
                        {repairingWebhook ? <Loader2 size={16} className="spin" /> : <Wrench size={16} />}
                        Reparar webhook
                    </button>
                    <button type="button" className="btn btn-gold" disabled={refreshing} onClick={() => loadData(true)}>
                        {refreshing ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
                        Atualizar
                    </button>
                </div>
            </div>

            {data && (
                <>
                    <section className={`pretest-hero ${meta.tone}`}>
                        <div className="pretest-hero-main">
                            <ScoreRing score={data.score} status={data.status} />
                            <div>
                                <span className={`pretest-status-line ${meta.tone}`}>
                                    <HeaderIcon size={18} /> {meta.label}
                                </span>
                                <h2>{data.status === 'ok' ? 'Fluxo pronto para bateria de testes.' : data.status === 'warn' ? 'Fluxo utilizavel com pontos de atencao.' : 'Ha bloqueios antes do teste completo.'}</h2>
                                <p>Gerado em {formatDateTime(data.generated_at)}. Instancias conectadas: {data.summary.connected_instances}.</p>
                            </div>
                        </div>
                        <div className="pretest-hero-side">
                            <span>{data.blockers} bloqueio(s)</span>
                            <span>{data.warnings} alerta(s)</span>
                            <small>{data.summary.required_webhook_url}</small>
                        </div>
                    </section>

                    {data.phase_1 && (
                        <section className={`pretest-phase-card ${data.phase_1.code_complete ? 'ok' : 'warn'}`}>
                            <div className="pretest-phase-copy">
                                <span>
                                    {data.phase_1.code_complete ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                                    {data.phase_1.label}
                                </span>
                                <h2>{data.phase_1.code_complete ? 'Pilger esta fechado para a Fase 1 de sistema.' : 'Ainda ha ajustes estruturais na Fase 1.'}</h2>
                                <p>{data.phase_1.detail}</p>
                            </div>
                            <div className="pretest-phase-checks">
                                {Object.entries(data.phase_1.core_checks || {}).map(([key, ready]) => (
                                    <span key={key} className={ready ? 'ready' : 'blocked'}>
                                        {ready ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                                        {key.replace(/_/g, ' ')}
                                    </span>
                                ))}
                            </div>
                            {data.phase_1.remaining_actions?.length > 0 && (
                                <div className="pretest-phase-actions">
                                    <strong>Restante operacional</strong>
                                    {data.phase_1.remaining_actions.map(action => (
                                        <p key={action}>{action}</p>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    {data.phase_2 && (
                        <section className={`pretest-phase-card ${data.phase_2.code_complete ? 'ok' : 'warn'}`}>
                            <div className="pretest-phase-copy">
                                <span>
                                    {data.phase_2.code_complete ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                                    {data.phase_2.label}
                                </span>
                                <h2>{data.phase_2.code_complete ? 'Pilger esta fechado para a Fase 2 operacional.' : 'Ainda ha ajustes estruturais na Fase 2.'}</h2>
                                <p>{data.phase_2.detail}</p>
                            </div>
                            <div className="pretest-phase-checks">
                                {Object.entries(data.phase_2.core_checks || {}).map(([key, ready]) => (
                                    <span key={key} className={ready ? 'ready' : 'blocked'}>
                                        {ready ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                                        {key.replace(/_/g, ' ')}
                                    </span>
                                ))}
                            </div>
                            {data.phase_2.remaining_actions?.length > 0 && (
                                <div className="pretest-phase-actions">
                                    <strong>Restante operacional</strong>
                                    {data.phase_2.remaining_actions.map(action => (
                                        <p key={action}>{action}</p>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    {data.phase_3 && (
                        <section className={`pretest-phase-card ${data.phase_3.code_complete ? 'ok' : 'warn'}`}>
                            <div className="pretest-phase-copy">
                                <span>
                                    {data.phase_3.code_complete ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                                    {data.phase_3.label}
                                </span>
                                <h2>{data.phase_3.code_complete ? 'Pilger esta fechado para a Fase 3 de producao.' : 'Ainda ha ajustes estruturais na Fase 3.'}</h2>
                                <p>{data.phase_3.detail}</p>
                            </div>
                            <div className="pretest-phase-checks">
                                {Object.entries(data.phase_3.core_checks || {}).map(([key, ready]) => (
                                    <span key={key} className={ready ? 'ready' : 'blocked'}>
                                        {ready ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                                        {key.replace(/_/g, ' ')}
                                    </span>
                                ))}
                            </div>
                            {data.phase_3.remaining_actions?.length > 0 && (
                                <div className="pretest-phase-actions">
                                    <strong>Restante operacional</strong>
                                    {data.phase_3.remaining_actions.map(action => (
                                        <p key={action}>{action}</p>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    {data.phase_4 && (
                        <section className={`pretest-phase-card ${data.phase_4.code_complete ? 'ok' : 'warn'}`}>
                            <div className="pretest-phase-copy">
                                <span>
                                    {data.phase_4.code_complete ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                                    {data.phase_4.label}
                                </span>
                                <h2>{data.phase_4.code_complete ? 'Pilger esta fechado para a Fase 4 de governanca.' : 'Ainda ha ajustes estruturais na Fase 4.'}</h2>
                                <p>{data.phase_4.detail}</p>
                            </div>
                            <div className="pretest-phase-checks">
                                {Object.entries(data.phase_4.core_checks || {}).map(([key, ready]) => (
                                    <span key={key} className={ready ? 'ready' : 'blocked'}>
                                        {ready ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                                        {key.replace(/_/g, ' ')}
                                    </span>
                                ))}
                            </div>
                            {data.phase_4.remaining_actions?.length > 0 && (
                                <div className="pretest-phase-actions">
                                    <strong>Restante operacional</strong>
                                    {data.phase_4.remaining_actions.map(action => (
                                        <p key={action}>{action}</p>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    {data.phase_5 && (
                        <section className={`pretest-phase-card ${data.phase_5.code_complete ? 'ok' : 'warn'}`}>
                            <div className="pretest-phase-copy">
                                <span>
                                    {data.phase_5.code_complete ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                                    {data.phase_5.label}
                                </span>
                                <h2>{data.phase_5.code_complete ? 'Pilger esta fechado para a Fase 5 de go-live.' : 'Ainda ha ajustes no go-live da Fase 5.'}</h2>
                                <p>{data.phase_5.detail}</p>
                            </div>
                            <div className="pretest-phase-checks">
                                {Object.entries(data.phase_5.core_checks || {}).map(([key, ready]) => (
                                    <span key={key} className={ready ? 'ready' : 'blocked'}>
                                        {ready ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                                        {key.replace(/_/g, ' ')}
                                    </span>
                                ))}
                            </div>
                            {data.phase_5.remaining_actions?.length > 0 && (
                                <div className="pretest-phase-actions">
                                    <strong>Restante operacional</strong>
                                    {data.phase_5.remaining_actions.slice(0, 6).map(action => (
                                        <p key={action}>{action}</p>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    {data.phase_6 && (
                        <section className={`pretest-phase-card ${data.phase_6.code_complete ? 'ok' : 'warn'}`}>
                            <div className="pretest-phase-copy">
                                <span>
                                    {data.phase_6.code_complete ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                                    {data.phase_6.label}
                                </span>
                                <h2>{data.phase_6.code_complete ? 'Pilger esta fechado para a Fase 6 pos-go-live.' : 'Ainda ha ajustes no pos-go-live da Fase 6.'}</h2>
                                <p>{data.phase_6.detail}</p>
                            </div>
                            <div className="pretest-phase-checks">
                                {Object.entries(data.phase_6.core_checks || {}).map(([key, ready]) => (
                                    <span key={key} className={ready ? 'ready' : 'blocked'}>
                                        {ready ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                                        {key.replace(/_/g, ' ')}
                                    </span>
                                ))}
                            </div>
                            {data.phase_6.remaining_actions?.length > 0 && (
                                <div className="pretest-phase-actions">
                                    <strong>Restante operacional</strong>
                                    {data.phase_6.remaining_actions.slice(0, 6).map(action => (
                                        <p key={action}>{action}</p>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    {finalPhases.map(({ key, phase, completeTitle, pendingTitle }) => phase && (
                        <section key={key} className={`pretest-phase-card ${phase.code_complete ? 'ok' : 'warn'}`}>
                            <div className="pretest-phase-copy">
                                <span>
                                    {phase.code_complete ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                                    {phase.label}
                                </span>
                                <h2>{phase.code_complete ? completeTitle : pendingTitle}</h2>
                                <p>{phase.detail}</p>
                                {typeof phase.score === 'number' && <small>Score: {phase.score}%</small>}
                            </div>
                            <div className="pretest-phase-checks">
                                {Object.entries(phase.core_checks || {}).map(([checkKey, ready]) => (
                                    <span key={checkKey} className={ready ? 'ready' : 'blocked'}>
                                        {ready ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                                        {checkKey.replace(/_/g, ' ')}
                                    </span>
                                ))}
                            </div>
                            {phase.remaining_actions?.length > 0 && (
                                <div className="pretest-phase-actions">
                                    <strong>Restante operacional</strong>
                                    {phase.remaining_actions.slice(0, 6).map(action => (
                                        <p key={action}>{action}</p>
                                    ))}
                                </div>
                            )}
                        </section>
                    ))}

                    <section className="pretest-metrics">
                        <SummaryMetric label="Global" value={counts.whatsapp_global_commands || 0} hint="comandos registrados" />
                        <SummaryMetric label="Acessos" value={counts.pilger_access_sources || 0} hint="fontes de colegas" />
                        <SummaryMetric label="Editorial" value={(counts.blog_commands || 0) + (counts.news_commands || 0)} hint="Isadora e Clara" />
                        <SummaryMetric label="Financeiro" value={counts.finance_commands || 0} hint="triagens do Pilger" />
                        <SummaryMetric label="Imoveis" value={counts.property_commands || 0} hint="Bianca" />
                        <SummaryMetric label="Relatorios" value={counts.report_commands || 0} hint="Arthur" />
                        <SummaryMetric label="Retornos" value={counts.pilger_return_pending || 0} hint="pendentes no Pilger" />
                        <SummaryMetric label="SLA" value={counts.pilger_phase3_escalations || 0} hint="escalonamentos Fase 3" />
                        <SummaryMetric label="Governanca" value={counts.pilger_phase4_reviews || 0} hint={`${counts.pilger_phase4_closed || 0} fechamento(s)`} />
                        <SummaryMetric label="Go-live" value={counts.pilger_phase5_score || 0} hint={`${counts.pilger_phase5_blockers || 0} bloqueio(s)`} />
                        <SummaryMetric label="Pos-live" value={counts.pilger_phase6_score || 0} hint={`${counts.pilger_phase6_watchpoints || 0} watchpoint(s)`} />
                        <SummaryMetric label="Identidade" value={counts.pilger_phase7_score || 0} hint="Fase 7" />
                        <SummaryMetric label="Painel" value={counts.pilger_phase8_score || 0} hint="Fase 8" />
                        <SummaryMetric label="Bateria" value={counts.pilger_phase9_score || 0} hint={`${counts.pilger_phase9_failed_routes || 0} falha(s)`} />
                        <SummaryMetric label="Vitor" value={counts.vitor_reviews || 0} hint="reviews de criativo" />
                        <SummaryMetric label="Central" value={counts.ecosystem_events || 0} hint="eventos consolidados" />
                    </section>

                    <section className="pretest-identity-matrix">
                        <div className="pretest-section-title">
                            <ShieldCheck size={18} />
                            <div>
                                <h2>Matriz de reconhecimento</h2>
                                <p>Perfis que o WhatsApp Global deve separar antes de qualquer atendimento como lead.</p>
                            </div>
                        </div>
                        <div className="pretest-identity-grid">
                            {(data.identity_matrix || []).map(row => (
                                <article key={row.key} className={row.ready ? 'ready' : 'attention'}>
                                    <span>{row.ready ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {row.label}</span>
                                    <strong>{row.detected}</strong>
                                    <p>{row.expected_behavior}</p>
                                    <small>{row.permissions.join(', ')}</small>
                                </article>
                            ))}
                        </div>
                    </section>

                    <section className="pretest-route-matrix">
                        <div className="pretest-section-title">
                            <MessageSquareText size={18} />
                            <div>
                                <h2>Simulacao do Pilger</h2>
                                <p>Textos internos classificados antes de enviar para Vitor, Isadora, Clara, Financeiro ou outro agente.</p>
                            </div>
                        </div>
                        <div className="pretest-route-grid">
                            {(data.pilger_route_matrix || []).map(route => {
                                const routeMeta = statusMeta(route.status)
                                const RouteIcon = routeMeta.icon
                                return (
                                    <article key={route.key} className={routeMeta.tone}>
                                        <span><RouteIcon size={15} /> {route.label}</span>
                                        <strong>{route.target_agent_name}</strong>
                                        <p>{route.message}</p>
                                        <small>
                                            {route.identity_label} | {route.allowed ? 'permitido' : 'bloqueado'} | {route.execution_mode}
                                        </small>
                                        <em>{route.detail}</em>
                                    </article>
                                )
                            })}
                        </div>
                    </section>

                    {data.phase_9?.practical_messages?.length ? (
                        <section className="pretest-route-matrix">
                            <div className="pretest-section-title">
                                <ClipboardList size={18} />
                                <div>
                                    <h2>Fase 9: bateria pratica</h2>
                                    <p>Frases reais do plano original, com expectativa de resposta e evidencia para aprovacao.</p>
                                </div>
                            </div>
                            <div className="pretest-route-grid">
                                {data.phase_9.practical_messages.map(item => (
                                    <article key={item.key} className="ok">
                                        <span><CheckCircle2 size={15} /> {item.label}</span>
                                        <strong>{item.text}</strong>
                                        <p>{item.expected}</p>
                                    </article>
                                ))}
                            </div>
                            {data.phase_9.evidence_required?.length ? (
                                <div className="pretest-post-launch-checklist">
                                    {data.phase_9.evidence_required.map(item => (
                                        <p key={item}>{item}</p>
                                    ))}
                                </div>
                            ) : null}
                        </section>
                    ) : null}

                    {phase5GoLive && (
                        <section className="pretest-go-live-panel">
                            <div className="pretest-section-title">
                                <ClipboardList size={18} />
                                <div>
                                    <h2>Pacote de go-live</h2>
                                    <p>Portao final para operar o Pilger em producao assistida antes dos testes reais.</p>
                                </div>
                            </div>
                            <div className="pretest-go-live-grid">
                                <article>
                                    <span>Score</span>
                                    <strong>{phase5GoLive.score}%</strong>
                                    <small>{phase5GoLive.handoff?.mode || phase5GoLive.launch_state}</small>
                                </article>
                                <article>
                                    <span>Bloqueios</span>
                                    <strong>{phase5GoLive.blockers}</strong>
                                    <small>{phase5GoLive.warnings} watchpoint(s)</small>
                                </article>
                                <article>
                                    <span>Evidencias</span>
                                    <strong>{phase5GoLive.required_evidence.length}</strong>
                                    <small>{phase5GoLive.rollback_plan.length} rollback(s)</small>
                                </article>
                            </div>
                            <div className="pretest-go-live-checks">
                                {phase5GoLive.checklist.map(item => (
                                    <span key={item.key} className={item.status === 'ok' ? 'ready' : item.status === 'missing' ? 'blocked' : 'attention'}>
                                        {item.status === 'ok' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                                        {item.label}
                                    </span>
                                ))}
                            </div>
                            <div className="pretest-go-live-runbook">
                                {phase5GoLive.final_test_runbook.map(step => (
                                    <article key={step.step}>
                                        <span>Passo {step.step}</span>
                                        <strong>{step.label}</strong>
                                        <p>{step.evidence}</p>
                                    </article>
                                ))}
                            </div>
                        </section>
                    )}

                    {phase6PostLaunch && (
                        <section className="pretest-post-launch-panel">
                            <div className="pretest-section-title">
                                <Database size={18} />
                                <div>
                                    <h2>Relatorio pos-go-live</h2>
                                    <p>{phase6PostLaunch.executive_summary}</p>
                                </div>
                            </div>
                            <div className="pretest-post-launch-grid">
                                <article>
                                    <span>Score</span>
                                    <strong>{phase6PostLaunch.score}%</strong>
                                    <small>{phase6PostLaunch.status}</small>
                                </article>
                                <article>
                                    <span>Comandos</span>
                                    <strong>{phase6PostLaunch.metrics.total_commands || 0}</strong>
                                    <small>{phase6PostLaunch.metrics.command_resolution_rate || 0}% com resolucao.</small>
                                </article>
                                <article>
                                    <span>Janela</span>
                                    <strong>{phase6PostLaunch.next_operating_window?.label || 'assistida'}</strong>
                                    <small>{phase6PostLaunch.next_operating_window?.duration || 'primeiras 24 horas'}</small>
                                </article>
                            </div>
                            <div className="pretest-post-launch-signals">
                                {phase6PostLaunch.signals.map(signal => (
                                    <span key={signal.key} className={signal.status === 'ok' ? 'ready' : signal.status === 'missing' ? 'blocked' : 'attention'}>
                                        {signal.status === 'ok' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                                        {signal.label}
                                    </span>
                                ))}
                            </div>
                            <div className="pretest-post-launch-checklist">
                                {phase6PostLaunch.stabilization_checklist.map(item => (
                                    <p key={item}>{item}</p>
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="pretest-links">
                        {(data.links || []).map(link => (
                            <Link key={link.href} href={link.href}>
                                <ExternalLink size={15} />
                                {link.label}
                            </Link>
                        ))}
                    </section>

                    <section className="pretest-grid">
                        {orderedSections.map(section => (
                            <article key={section.key} className="pretest-section">
                                <div className="pretest-section-head">
                                    <div>
                                        <span><SectionIcon keyName={section.key} /> {section.label}</span>
                                        <strong>{section.score}%</strong>
                                    </div>
                                    <StatusBadge status={section.status} />
                                </div>
                                <ul>
                                    {section.items.map(row => <ItemRow key={row.key} item={row} />)}
                                </ul>
                            </article>
                        ))}
                    </section>

                    <section className="pretest-test-messages">
                        <div className="pretest-section-title">
                            <ClipboardList size={18} />
                            <div>
                                <h2>Bateria final de testes</h2>
                                <p>Execute em ordem quando o checklist estiver verde ou para isolar um ponto especifico.</p>
                            </div>
                        </div>
                        <div className="pretest-message-grid">
                            {data.test_messages.map(message => (
                                <article key={message.key} className="pretest-message">
                                    <span>{message.label}</span>
                                    <p>{message.text}</p>
                                    {message.expected && <small>{message.expected}</small>}
                                    <button type="button" className="btn btn-outline btn-sm" onClick={() => copyText(message.text)}>
                                        <Copy size={14} /> Copiar
                                    </button>
                                </article>
                            ))}
                        </div>
                    </section>
                </>
            )}

            <style jsx global>{`
                .pretest-page {
                    color: #17231f;
                }

                .pretest-header,
                .pretest-header-actions,
                .pretest-hero,
                .pretest-hero-main,
                .pretest-hero-side,
                .pretest-links,
                .pretest-section-head,
                .pretest-section-head > div,
                .pretest-item,
                .pretest-badge,
                .pretest-status-line,
                .pretest-section-title,
                .pretest-toast {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .pretest-header {
                    justify-content: space-between;
                    gap: 16px;
                }

                .pretest-header h1 {
                    margin: 6px 0 4px;
                    font-size: 1.9rem;
                    letter-spacing: 0;
                }

                .pretest-header p {
                    margin: 0;
                    color: #64746d;
                }

                .pretest-header-actions {
                    flex-wrap: wrap;
                    justify-content: flex-end;
                }

                .pretest-hero {
                    justify-content: space-between;
                    align-items: stretch;
                    margin: 24px 0;
                    padding: 22px;
                    border: 1px solid #dfe8e2;
                    border-radius: 8px;
                    background: linear-gradient(135deg, #f6faf7 0%, #eef6f2 100%);
                }

                .pretest-hero.warn {
                    background: linear-gradient(135deg, #fffaf0 0%, #f6f8f4 100%);
                    border-color: #f1d69b;
                }

                .pretest-hero.risk {
                    background: linear-gradient(135deg, #fff6f4 0%, #f7f1ef 100%);
                    border-color: #efb5a8;
                }

                .pretest-hero-main {
                    align-items: center;
                    min-width: 0;
                }

                .pretest-hero-main h2 {
                    margin: 8px 0 6px;
                    font-size: 1.35rem;
                    letter-spacing: 0;
                }

                .pretest-hero-main p,
                .pretest-hero-side small,
                .pretest-section-title p {
                    margin: 0;
                    color: #66766f;
                }

                .pretest-hero-side {
                    flex-direction: column;
                    align-items: flex-end;
                    justify-content: center;
                    min-width: 260px;
                    text-align: right;
                }

                .pretest-hero-side span {
                    font-weight: 700;
                }

                .pretest-hero-side small {
                    max-width: 420px;
                    word-break: break-word;
                }

                .pretest-phase-card {
                    display: grid;
                    grid-template-columns: minmax(0, 1.25fr) minmax(260px, .9fr);
                    gap: 16px;
                    margin: 0 0 18px;
                    padding: 18px;
                    border: 1px solid #dfe8e2;
                    border-radius: 8px;
                    background: #fff;
                }

                .pretest-phase-card.ok {
                    border-color: #b8dec7;
                    background: #f5fbf7;
                }

                .pretest-phase-card.warn {
                    border-color: #f1d69b;
                    background: #fffaf0;
                }

                .pretest-phase-copy {
                    display: grid;
                    align-content: start;
                    gap: 7px;
                    min-width: 0;
                }

                .pretest-phase-copy span {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    width: fit-content;
                    color: #1f7f58;
                    font-size: .78rem;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .pretest-phase-card.warn .pretest-phase-copy span {
                    color: #a86509;
                }

                .pretest-phase-copy h2,
                .pretest-phase-copy p,
                .pretest-phase-actions p {
                    margin: 0;
                }

                .pretest-phase-copy h2 {
                    font-size: 1.15rem;
                    letter-spacing: 0;
                }

                .pretest-phase-copy p,
                .pretest-phase-actions p {
                    color: #66766f;
                    font-size: .88rem;
                    line-height: 1.45;
                }

                .pretest-phase-checks {
                    display: flex;
                    flex-wrap: wrap;
                    align-content: flex-start;
                    gap: 8px;
                }

                .pretest-phase-checks span {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    border-radius: 999px;
                    padding: 6px 9px;
                    font-size: .72rem;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .pretest-phase-checks span.ready {
                    background: #e7f5ed;
                    color: #1f7f58;
                }

                .pretest-phase-checks span.blocked {
                    background: #ffe2dc;
                    color: #a83224;
                }

                .pretest-phase-actions {
                    grid-column: 1 / -1;
                    display: grid;
                    gap: 7px;
                    padding-top: 12px;
                    border-top: 1px solid rgba(31, 47, 41, .08);
                }

                .pretest-phase-actions strong {
                    color: #244238;
                    font-size: .8rem;
                    text-transform: uppercase;
                }

                .pretest-score-ring {
                    width: 96px;
                    height: 96px;
                    flex: 0 0 96px;
                    border-radius: 50%;
                    display: grid;
                    place-items: center;
                    background:
                        radial-gradient(circle at center, #fff 58%, transparent 60%),
                        conic-gradient(#1f8f5f var(--score), #dfe8e2 0);
                    color: #1f8f5f;
                }

                .pretest-score-ring.warn {
                    background:
                        radial-gradient(circle at center, #fff 58%, transparent 60%),
                        conic-gradient(#b7791f var(--score), #eadfcb 0);
                    color: #9b5d0b;
                }

                .pretest-score-ring.risk {
                    background:
                        radial-gradient(circle at center, #fff 58%, transparent 60%),
                        conic-gradient(#c2412f var(--score), #efd1ca 0);
                    color: #a83224;
                }

                .pretest-score-ring strong {
                    font-size: 1.65rem;
                    line-height: 1;
                }

                .pretest-score-ring span {
                    margin-top: -24px;
                    font-size: .75rem;
                    font-weight: 700;
                }

                .pretest-status-line {
                    width: fit-content;
                    font-weight: 800;
                    font-size: .82rem;
                    text-transform: uppercase;
                    color: #1f8f5f;
                }

                .pretest-status-line.warn {
                    color: #a86509;
                }

                .pretest-status-line.risk {
                    color: #b53627;
                }

                .pretest-metrics,
                .pretest-identity-grid,
                .pretest-route-grid,
                .pretest-go-live-grid,
                .pretest-go-live-runbook,
                .pretest-post-launch-grid,
                .pretest-grid,
                .pretest-message-grid {
                    display: grid;
                    gap: 14px;
                }

                .pretest-metrics {
                    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                    margin-bottom: 16px;
                }

                .pretest-identity-matrix,
                .pretest-route-matrix,
                .pretest-go-live-panel,
                .pretest-post-launch-panel {
                    margin-bottom: 18px;
                }

                .pretest-identity-grid {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    margin-top: 12px;
                }

                .pretest-route-grid {
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                }

                .pretest-go-live-grid {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    margin-top: 12px;
                }

                .pretest-go-live-runbook {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                }

                .pretest-post-launch-grid {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    margin-top: 12px;
                }

                .pretest-metric,
                .pretest-identity-grid article,
                .pretest-route-grid article,
                .pretest-go-live-grid article,
                .pretest-go-live-runbook article,
                .pretest-post-launch-grid article,
                .pretest-section,
                .pretest-message {
                    border: 1px solid #dfe8e2;
                    border-radius: 8px;
                    background: #fff;
                }

                .pretest-metric {
                    padding: 16px;
                }

                .pretest-identity-grid article {
                    display: grid;
                    gap: 8px;
                    padding: 14px;
                    border-left: 4px solid #1f8f5f;
                }

                .pretest-identity-grid article.attention {
                    border-left-color: #b7791f;
                }

                .pretest-identity-grid article span {
                    display: flex;
                    align-items: center;
                    gap: 7px;
                    color: #244238;
                    font-size: .8rem;
                    font-weight: 800;
                }

                .pretest-identity-grid article strong {
                    font-size: 1.55rem;
                    line-height: 1;
                }

                .pretest-identity-grid article p,
                .pretest-identity-grid article small,
                .pretest-message small {
                    margin: 0;
                    color: #66766f;
                    font-size: .78rem;
                    line-height: 1.35;
                }

                .pretest-route-grid article {
                    display: grid;
                    gap: 8px;
                    padding: 14px;
                    border-top: 4px solid #1f8f5f;
                }

                .pretest-route-grid article.warn {
                    border-top-color: #b7791f;
                }

                .pretest-route-grid article.risk {
                    border-top-color: #c2412f;
                }

                .pretest-route-grid article span {
                    display: flex;
                    align-items: center;
                    gap: 7px;
                    color: #244238;
                    font-size: .78rem;
                    font-weight: 800;
                    text-transform: uppercase;
                }

                .pretest-route-grid article strong {
                    font-size: 1rem;
                    line-height: 1.25;
                }

                .pretest-route-grid article p,
                .pretest-route-grid article small,
                .pretest-route-grid article em {
                    margin: 0;
                    color: #66766f;
                    font-size: .8rem;
                    line-height: 1.35;
                    font-style: normal;
                }

                .pretest-route-grid article em {
                    color: #40554c;
                    font-weight: 700;
                }

                .pretest-go-live-grid article,
                .pretest-go-live-runbook article {
                    display: grid;
                    gap: 7px;
                    padding: 14px;
                }

                .pretest-go-live-grid article {
                    border-left: 4px solid #1f8f5f;
                }

                .pretest-go-live-grid article span,
                .pretest-go-live-runbook article span {
                    color: #66766f;
                    font-size: .7rem;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .pretest-go-live-grid article strong,
                .pretest-go-live-runbook article strong {
                    color: #17231f;
                    font-size: 1rem;
                    line-height: 1.2;
                }

                .pretest-go-live-grid article small,
                .pretest-go-live-runbook article p {
                    color: #66766f;
                    font-size: .78rem;
                    line-height: 1.35;
                    margin: 0;
                }

                .pretest-go-live-checks {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin: 12px 0;
                }

                .pretest-go-live-checks span {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    border-radius: 999px;
                    padding: 6px 9px;
                    font-size: .7rem;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .pretest-go-live-checks span.ready {
                    background: #e7f5ed;
                    color: #1f7f58;
                }

                .pretest-go-live-checks span.attention {
                    background: #fff2d6;
                    color: #9b5d0b;
                }

                .pretest-go-live-checks span.blocked {
                    background: #ffe2dc;
                    color: #a83224;
                }

                .pretest-post-launch-grid article {
                    display: grid;
                    gap: 7px;
                    padding: 14px;
                    border-left: 4px solid #1f8f5f;
                }

                .pretest-post-launch-grid article span {
                    color: #66766f;
                    font-size: .7rem;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .pretest-post-launch-grid article strong {
                    color: #17231f;
                    font-size: 1rem;
                    line-height: 1.2;
                }

                .pretest-post-launch-grid article small {
                    color: #66766f;
                    font-size: .78rem;
                    line-height: 1.35;
                }

                .pretest-post-launch-signals {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin: 12px 0;
                }

                .pretest-post-launch-signals span {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    border-radius: 999px;
                    padding: 6px 9px;
                    font-size: .7rem;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .pretest-post-launch-signals span.ready {
                    background: #e7f5ed;
                    color: #1f7f58;
                }

                .pretest-post-launch-signals span.attention {
                    background: #fff2d6;
                    color: #9b5d0b;
                }

                .pretest-post-launch-signals span.blocked {
                    background: #ffe2dc;
                    color: #a83224;
                }

                .pretest-post-launch-checklist {
                    display: grid;
                    gap: 7px;
                }

                .pretest-post-launch-checklist p {
                    border: 1px solid #dfe8e2;
                    border-radius: 8px;
                    background: #fff;
                    color: #5d6d66;
                    font-size: .82rem;
                    line-height: 1.4;
                    margin: 0;
                    padding: 10px 12px;
                }

                .pretest-metric span,
                .pretest-message span {
                    display: block;
                    color: #66766f;
                    font-size: .82rem;
                    font-weight: 700;
                    text-transform: uppercase;
                }

                .pretest-metric strong {
                    display: block;
                    margin-top: 8px;
                    font-size: 1.65rem;
                }

                .pretest-metric small {
                    color: #66766f;
                }

                .pretest-links {
                    flex-wrap: wrap;
                    margin-bottom: 18px;
                }

                .pretest-links a {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 9px 12px;
                    border: 1px solid #dfe8e2;
                    border-radius: 8px;
                    color: #244238;
                    text-decoration: none;
                    background: #fff;
                    font-weight: 700;
                }

                .pretest-grid {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    align-items: start;
                }

                .pretest-section {
                    overflow: hidden;
                }

                .pretest-section-head {
                    justify-content: space-between;
                    padding: 15px 16px;
                    border-bottom: 1px solid #edf2ee;
                    background: #f8fbf9;
                }

                .pretest-section-head span {
                    font-weight: 800;
                }

                .pretest-section-head strong {
                    color: #60736b;
                }

                .pretest-section ul {
                    list-style: none;
                    margin: 0;
                    padding: 8px 0;
                }

                .pretest-item {
                    align-items: flex-start;
                    padding: 11px 16px;
                }

                .pretest-item + .pretest-item {
                    border-top: 1px solid #f0f4f1;
                }

                .pretest-item-icon {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    display: inline-grid;
                    place-items: center;
                    background: #e7f5ed;
                    color: #1f8f5f;
                    flex: 0 0 28px;
                }

                .pretest-item.warn .pretest-item-icon {
                    background: #fff0d2;
                    color: #a86509;
                }

                .pretest-item.risk .pretest-item-icon {
                    background: #ffe2dc;
                    color: #b53627;
                }

                .pretest-item strong {
                    display: block;
                    margin-bottom: 3px;
                }

                .pretest-item p,
                .pretest-message p {
                    margin: 0;
                    color: #5d6d66;
                    line-height: 1.45;
                }

                .pretest-badge {
                    gap: 6px;
                    padding: 6px 9px;
                    border-radius: 999px;
                    font-size: .78rem;
                    font-weight: 800;
                    background: #e7f5ed;
                    color: #1f7f58;
                    white-space: nowrap;
                }

                .pretest-badge.warn {
                    background: #fff0d2;
                    color: #915705;
                }

                .pretest-badge.risk {
                    background: #ffe2dc;
                    color: #a83224;
                }

                .pretest-test-messages {
                    margin-top: 18px;
                    padding-bottom: 28px;
                }

                .pretest-section-title {
                    align-items: flex-start;
                    margin-bottom: 12px;
                }

                .pretest-section-title h2 {
                    margin: 0 0 3px;
                    font-size: 1.2rem;
                    letter-spacing: 0;
                }

                .pretest-message-grid {
                    grid-template-columns: repeat(5, minmax(0, 1fr));
                }

                .pretest-message {
                    padding: 14px;
                    min-height: 190px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .pretest-message p {
                    flex: 1;
                    font-size: .92rem;
                }

                .pretest-message small {
                    display: block;
                    min-height: 40px;
                }

                .pretest-message button {
                    width: fit-content;
                }

                .pretest-toast {
                    position: fixed;
                    right: 24px;
                    bottom: 24px;
                    z-index: 50;
                    padding: 11px 14px;
                    border-radius: 8px;
                    background: #18362d;
                    color: #fff;
                    font-weight: 700;
                    box-shadow: 0 10px 28px rgba(0, 0, 0, .18);
                }

                .pretest-toast.error {
                    background: #7f1d1d;
                }

                .pretest-error {
                    max-width: 620px;
                    margin: 90px auto;
                    padding: 24px;
                    border: 1px solid #efc4bb;
                    border-radius: 8px;
                    background: #fff7f5;
                    text-align: center;
                }

                .pretest-error svg {
                    color: #b53627;
                }

                .pretest-error h2 {
                    margin: 10px 0 8px;
                }

                .spin {
                    animation: pretest-spin 1s linear infinite;
                }

                @keyframes pretest-spin {
                    to { transform: rotate(360deg); }
                }

                @media (max-width: 1180px) {
                    .pretest-identity-grid,
                    .pretest-route-grid,
                    .pretest-go-live-grid,
                    .pretest-go-live-runbook,
                    .pretest-post-launch-grid,
                    .pretest-message-grid {
                        grid-template-columns: repeat(3, minmax(0, 1fr));
                    }
                }

                @media (max-width: 980px) {
                    .pretest-header,
                    .pretest-hero {
                        align-items: flex-start;
                        flex-direction: column;
                    }

                    .pretest-hero-side {
                        align-items: flex-start;
                        min-width: 0;
                        text-align: left;
                    }

                    .pretest-metrics,
                    .pretest-identity-grid,
                    .pretest-route-grid,
                    .pretest-go-live-grid,
                    .pretest-go-live-runbook,
                    .pretest-post-launch-grid,
                    .pretest-phase-card,
                    .pretest-grid {
                        grid-template-columns: 1fr;
                    }
                }

                @media (max-width: 720px) {
                    .pretest-hero-main {
                        align-items: flex-start;
                        flex-direction: column;
                    }

                    .pretest-header-actions {
                        justify-content: flex-start;
                    }

                    .pretest-message-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    )
}
