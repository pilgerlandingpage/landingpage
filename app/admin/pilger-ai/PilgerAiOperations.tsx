import Link from 'next/link'
import { Activity, AlertTriangle, CheckCircle2, Clock3, Database, ExternalLink, RadioTower, UserRoundCog } from 'lucide-react'
import type { PilgerAiAgentItem, PilgerAiEventItem, PilgerAiMetric, PilgerAiWorkItem } from '@/lib/pilger-ai/operations'

function toneClass(tone: string) {
    return `pilger-ai-tone-${tone || 'muted'}`
}

export function PilgerAiLiveMetrics({ metrics }: { metrics: PilgerAiMetric[] }) {
    if (metrics.length === 0) return null
    return (
        <div className="pilger-ai-live-metrics">
            {metrics.map(metric => (
                <div className="pilger-ai-live-metric" key={metric.label}>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                    <small>{metric.note}</small>
                </div>
            ))}
        </div>
    )
}

export function PilgerAiWorkQueue({
    title,
    description,
    items,
    emptyText = 'Nenhum item aberto agora.',
}: {
    title: string
    description: string
    items: PilgerAiWorkItem[]
    emptyText?: string
}) {
    return (
        <section className="pilger-ai-ops-panel">
            <div className="pilger-ai-ops-head">
                <div>
                    <span>Fila operacional</span>
                    <h2><Clock3 size={18} /> {title}</h2>
                    <p>{description}</p>
                </div>
                <strong>{items.length}</strong>
            </div>

            <div className="pilger-ai-work-list">
                {items.length === 0 ? (
                    <div className="pilger-ai-empty">{emptyText}</div>
                ) : items.map(item => (
                    <article className="pilger-ai-work-row" key={`${item.source}-${item.id}`}>
                        <div className={`pilger-ai-work-dot ${toneClass(item.tone)}`} />
                        <div className="pilger-ai-work-main">
                            <div className="pilger-ai-work-title">
                                <strong>{item.title}</strong>
                                <span className={`pilger-ai-status-pill ${toneClass(item.tone)}`}>{item.status}</span>
                            </div>
                            <p>{item.description}</p>
                            <div className="pilger-ai-work-meta">
                                <span>{item.sector}</span>
                                <span>{item.owner}</span>
                                <span>Prioridade {item.priority}</span>
                                {item.createdAt && <span>{item.createdAt}</span>}
                            </div>
                        </div>
                        {item.href && (
                            <Link href={item.href} className="pilger-ai-row-link" aria-label={`Abrir ${item.title}`}>
                                <ExternalLink size={15} />
                            </Link>
                        )}
                    </article>
                ))}
            </div>
        </section>
    )
}

export function PilgerAiEventStream({
    title,
    description,
    items,
    mode = 'events',
}: {
    title: string
    description: string
    items: PilgerAiEventItem[]
    mode?: 'events' | 'audit' | 'memory'
}) {
    const Icon = mode === 'audit' ? Database : mode === 'memory' ? CheckCircle2 : RadioTower
    return (
        <section className="pilger-ai-ops-panel">
            <div className="pilger-ai-ops-head">
                <div>
                    <span>{mode === 'audit' ? 'Rastro tecnico' : mode === 'memory' ? 'Aprendizados' : 'Motor de eventos'}</span>
                    <h2><Icon size={18} /> {title}</h2>
                    <p>{description}</p>
                </div>
                <strong>{items.length}</strong>
            </div>

            <div className="pilger-ai-event-list">
                {items.length === 0 ? (
                    <div className="pilger-ai-empty">Ainda nao ha registros para esta visao.</div>
                ) : items.map(item => (
                    <article className="pilger-ai-event-row" key={`${item.eventType}-${item.id}`}>
                        <div className={`pilger-ai-event-icon ${toneClass(item.tone)}`}>
                            {mode === 'audit' ? <Database size={15} /> : mode === 'memory' ? <CheckCircle2 size={15} /> : <Activity size={15} />}
                        </div>
                        <div>
                            <div className="pilger-ai-event-title">
                                <strong>{item.title}</strong>
                                <span>{item.eventType}</span>
                            </div>
                            <p>{item.description}</p>
                            <div className="pilger-ai-work-meta">
                                <span>{item.sector}</span>
                                <span className={toneClass(item.tone)}>{item.status}</span>
                                {item.createdAt && <span>{item.createdAt}</span>}
                            </div>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    )
}

export function PilgerAiAgentRoster({ agents }: { agents: PilgerAiAgentItem[] }) {
    return (
        <section className="pilger-ai-ops-panel">
            <div className="pilger-ai-ops-head">
                <div>
                    <span>Colaboradores digitais</span>
                    <h2><UserRoundCog size={18} /> Agentes cadastrados</h2>
                    <p>Primeira leitura dos agentes atuais conectados ao atendimento e automacoes.</p>
                </div>
                <strong>{agents.length}</strong>
            </div>
            <div className="pilger-ai-agent-grid">
                {agents.length === 0 ? (
                    <div className="pilger-ai-empty">Nenhum agente cadastrado ainda.</div>
                ) : agents.map(agent => (
                    <article className="pilger-ai-agent-card" key={agent.id}>
                        <div className={`pilger-ai-event-icon ${toneClass(agent.tone)}`}><UserRoundCog size={16} /></div>
                        <strong>{agent.name}</strong>
                        <span>{agent.role}</span>
                        <p>{agent.detail}</p>
                        <small className={toneClass(agent.tone)}>{agent.status}</small>
                    </article>
                ))}
            </div>
        </section>
    )
}

export function PilgerAiGovernanceStrip() {
    return (
        <div className="pilger-ai-governance-strip">
            <AlertTriangle size={18} />
            <div>
                <strong>Regra operacional</strong>
                <span>Eventos importantes devem gerar tarefa, aprovacao ou registro de log. A IA pode sugerir caminhos, mas acoes sensiveis continuam com controle humano.</span>
            </div>
        </div>
    )
}
