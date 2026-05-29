'use client'

import { useEffect, useMemo, useState } from 'react'
import {
    Activity,
    AlertTriangle,
    Bot,
    CheckCircle2,
    Clock3,
    Loader2,
    Play,
    RefreshCw,
} from 'lucide-react'

type AgentStatus = 'healthy' | 'warning' | 'danger' | 'standby'

type HealthAgent = {
    id: string
    title: string
    area: string
    description: string
    status: AgentStatus
    statusLabel: string
    lastActivity?: string | null
    lastError?: string | null
    metrics?: Array<{ label: string; value: string }>
    action?: { key: string; label: string; danger?: boolean }
}

type HealthResponse = {
    success?: boolean
    checked_at?: string
    summary?: Record<AgentStatus, number>
    agents?: HealthAgent[]
    error?: string
}

const statusInfo: Record<AgentStatus, { label: string; icon: any; tone: string }> = {
    healthy: { label: 'Operando', icon: CheckCircle2, tone: '#16a34a' },
    warning: { label: 'Atenção', icon: AlertTriangle, tone: '#c99737' },
    danger: { label: 'Parado', icon: AlertTriangle, tone: '#dc2626' },
    standby: { label: 'Em espera', icon: Clock3, tone: '#64748b' },
}

function formatDate(value?: string | null) {
    if (!value) return 'Sem registro'
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value))
}

export default function PilgerAiHealthPage() {
    const [data, setData] = useState<HealthResponse>({})
    const [loading, setLoading] = useState(true)
    const [running, setRunning] = useState<string | null>(null)
    const [message, setMessage] = useState('')
    const [filter, setFilter] = useState<AgentStatus | 'all'>('all')

    async function fetchHealth() {
        setLoading(true)
        setMessage('')
        try {
            const response = await fetch('/api/admin/agents-health', { cache: 'no-store' })
            const json = await response.json()
            if (!response.ok) throw new Error(json?.error || 'Erro ao carregar saude dos agentes.')
            setData(json)
        } catch (error: any) {
            setMessage(error?.message || 'Erro ao carregar saude dos agentes.')
        } finally {
            setLoading(false)
        }
    }

    async function runAction(agent: HealthAgent) {
        if (!agent.action) return
        setRunning(agent.id)
        setMessage(`Executando ${agent.title}...`)
        try {
            const response = await fetch('/api/admin/agents-health', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: agent.action.key }),
            })
            const json = await response.json()
            if (!response.ok) throw new Error(json?.error || 'Falha ao executar agente.')
            setMessage(`${agent.title}: teste concluido.`)
            await fetchHealth()
        } catch (error: any) {
            setMessage(`${agent.title}: ${error?.message || 'erro ao executar.'}`)
            await fetchHealth()
        } finally {
            setRunning(null)
        }
    }

    useEffect(() => {
        void fetchHealth()
    }, [])

    const agents = data.agents || []
    const filteredAgents = useMemo(() => (
        filter === 'all' ? agents : agents.filter(agent => agent.status === filter)
    ), [agents, filter])

    const summary = data.summary || { healthy: 0, warning: 0, danger: 0, standby: 0 }

    return (
        <div className="agent-health-page">
            <div className="admin-header agent-health-header">
                <div>
                    <h1>Saude dos Agentes</h1>
                    <p>Veja quem esta trabalhando, quem esta em espera e quem precisa de acao.</p>
                </div>
                <button className="btn" onClick={fetchHealth} disabled={loading || !!running}>
                    {loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
                    Atualizar
                </button>
            </div>

            {message && <div className="agent-health-message">{message}</div>}

            <section className="agent-health-summary">
                {(['healthy', 'warning', 'danger', 'standby'] as AgentStatus[]).map(status => {
                    const Icon = statusInfo[status].icon
                    return (
                        <button
                            key={status}
                            type="button"
                            className={filter === status ? 'active' : ''}
                            onClick={() => setFilter(filter === status ? 'all' : status)}
                        >
                            <Icon size={18} style={{ color: statusInfo[status].tone }} />
                            <span>{statusInfo[status].label}</span>
                            <strong>{summary[status] || 0}</strong>
                        </button>
                    )
                })}
            </section>

            <section className="agent-health-grid">
                {loading ? (
                    <div className="agent-health-empty">
                        <Loader2 className="spin" size={22} />
                        Carregando agentes...
                    </div>
                ) : filteredAgents.length === 0 ? (
                    <div className="agent-health-empty">Nenhum agente neste filtro.</div>
                ) : filteredAgents.map(agent => {
                    const info = statusInfo[agent.status]
                    const Icon = info.icon
                    return (
                        <article className={`agent-health-card status-${agent.status}`} key={agent.id}>
                            <div className="agent-health-card-head">
                                <div>
                                    <span>{agent.area}</span>
                                    <h2><Bot size={18} /> {agent.title}</h2>
                                </div>
                                <div className="agent-health-status" style={{ color: info.tone }}>
                                    <Icon size={16} />
                                    {agent.statusLabel}
                                </div>
                            </div>

                            <p>{agent.description}</p>

                            <div className="agent-health-time">
                                <Activity size={15} />
                                Ultima atividade: <strong>{formatDate(agent.lastActivity)}</strong>
                            </div>

                            {agent.lastError && (
                                <div className="agent-health-error">
                                    {agent.lastError}
                                </div>
                            )}

                            <div className="agent-health-metrics">
                                {(agent.metrics || []).map(item => (
                                    <div key={`${agent.id}-${item.label}`}>
                                        <span>{item.label}</span>
                                        <strong>{item.value}</strong>
                                    </div>
                                ))}
                            </div>

                            {agent.action && (
                                <button
                                    type="button"
                                    className="btn btn-gold agent-health-run"
                                    onClick={() => runAction(agent)}
                                    disabled={!!running || loading}
                                >
                                    {running === agent.id ? <Loader2 className="spin" size={16} /> : <Play size={16} />}
                                    {agent.action.label}
                                </button>
                            )}
                        </article>
                    )
                })}
            </section>

            <style jsx>{`
                .agent-health-page { display: grid; gap: 18px; }
                .agent-health-header { align-items: flex-start; display: flex; gap: 16px; justify-content: space-between; }
                .agent-health-header p { color: var(--text-muted); margin: 6px 0 0; }
                .agent-health-message { background: rgba(201,169,110,.1); border: 1px solid rgba(201,169,110,.24); border-radius: 12px; color: var(--gold-dark); font-weight: 900; padding: 12px 14px; }
                .agent-health-summary { display: grid; gap: 12px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
                .agent-health-summary button { align-items: center; background: #fff; border: 1px solid var(--border); border-radius: 14px; cursor: pointer; display: grid; gap: 4px; grid-template-columns: 22px minmax(0, 1fr) auto; padding: 14px; text-align: left; }
                .agent-health-summary button.active { border-color: rgba(201,169,110,.72); box-shadow: 0 14px 30px rgba(24,18,12,.08); }
                .agent-health-summary span { color: var(--text-muted); font-size: .76rem; font-weight: 950; letter-spacing: .08em; text-transform: uppercase; }
                .agent-health-summary strong { font-family: var(--font-serif); font-size: 1.8rem; }
                .agent-health-grid { display: grid; gap: 14px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
                .agent-health-card { background: #fff; border: 1px solid var(--border); border-radius: 16px; display: grid; gap: 13px; padding: 16px; }
                .agent-health-card.status-danger { border-color: rgba(220,38,38,.28); }
                .agent-health-card.status-warning { border-color: rgba(201,151,55,.36); }
                .agent-health-card.status-healthy { border-color: rgba(22,163,74,.24); }
                .agent-health-card-head { align-items: flex-start; display: flex; gap: 12px; justify-content: space-between; }
                .agent-health-card-head span { color: var(--gold-dark); font-size: .68rem; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
                .agent-health-card h2 { align-items: center; display: flex; font-size: 1.08rem; gap: 8px; margin: 4px 0 0; }
                .agent-health-card p { color: var(--text-secondary); line-height: 1.45; margin: 0; }
                .agent-health-status { align-items: center; background: #faf8f3; border: 1px solid rgba(201,169,110,.18); border-radius: 999px; display: inline-flex; flex: 0 0 auto; font-size: .78rem; font-weight: 950; gap: 6px; padding: 8px 10px; }
                .agent-health-time { align-items: center; color: var(--text-muted); display: flex; flex-wrap: wrap; font-size: .84rem; gap: 6px; }
                .agent-health-time strong { color: var(--text-primary); }
                .agent-health-error { background: rgba(220,38,38,.07); border: 1px solid rgba(220,38,38,.18); border-radius: 10px; color: #991b1b; font-size: .83rem; font-weight: 800; padding: 10px; }
                .agent-health-metrics { display: grid; gap: 8px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
                .agent-health-metrics div { background: #faf8f3; border: 1px solid rgba(201,169,110,.13); border-radius: 10px; display: grid; gap: 4px; min-width: 0; padding: 9px; }
                .agent-health-metrics span { color: var(--text-muted); font-size: .66rem; font-weight: 950; letter-spacing: .08em; overflow: hidden; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
                .agent-health-metrics strong { font-size: .82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .agent-health-run { justify-self: start; }
                .agent-health-empty { align-items: center; background: #fff; border: 1px dashed rgba(201,169,110,.35); border-radius: 14px; color: var(--text-muted); display: flex; gap: 10px; grid-column: 1 / -1; justify-content: center; min-height: 180px; padding: 20px; }
                @media (max-width: 1050px) {
                    .agent-health-header { flex-direction: column; }
                    .agent-health-summary, .agent-health-grid { grid-template-columns: 1fr; }
                    .agent-health-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                }
            `}</style>
        </div>
    )
}
