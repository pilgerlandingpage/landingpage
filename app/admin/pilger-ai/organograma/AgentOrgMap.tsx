import {
    ArrowDownLeft,
    ArrowUpRight,
    BrainCircuit,
    Building2,
    DatabaseZap,
    GitBranch,
    RadioTower,
    Route,
    Users,
    Zap,
} from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import type { AgentOfficeItem, AgentOfficeTone } from '@/lib/pilger-ai/agent-office'
import type { PilgerAiEventItem, PilgerAiWorkItem } from '@/lib/pilger-ai/operations'
import AgentOrgLiveRefresh from './AgentOrgLiveRefresh'

type AgentFlow = {
    sector: string
    receives: string[]
    sends: string[]
    liveSignal: string
}

type AgentFlowRow = {
    agent: AgentOfficeItem
    flow: AgentFlow
    activity?: PilgerAiEventItem | PilgerAiWorkItem
}

type SectorGroup = {
    sector: string
    rows: AgentFlowRow[]
    receives: string[]
    sends: string[]
    activeCount: number
    tone: AgentOfficeTone
}

const SECTOR_ORDER = [
    'Diretoria',
    'Pilger AI',
    'Inteligencia',
    'Comercial',
    'WhatsApp',
    'Marketing',
    'Imoveis',
    'Operacoes',
    'Recrutamento',
    'Outros',
]

const SECTOR_DESCRIPTIONS: Record<string, string> = {
    Diretoria: 'Define prioridades e interpreta indicadores do ecossistema.',
    'Pilger AI': 'Orquestra regras, contexto e execucao dentro do painel.',
    Inteligencia: 'Pesquisa, cruza sinais e abastece a memoria compartilhada.',
    Comercial: 'Atende leads, consulta historico e devolve qualificacao ao CRM.',
    WhatsApp: 'Lida com conversas, janelas, resgates e extracao de dados.',
    Marketing: 'Usa sinais comerciais para criar conteudo, campanhas e distribuicao.',
    Imoveis: 'Transforma briefing, fotos e dados em cadastro imobiliario.',
    Operacoes: 'Cuida de usuarios, acessos, rotinas e comunicacoes internas.',
    Recrutamento: 'Analisa candidatos e alimenta a base operacional.',
    Outros: 'Agentes conectados fora dos setores principais.',
}

const CENTRAL_DATA_NODES = [
    'Leads',
    'Conversas',
    'Tracking',
    'Campanhas',
    'Mercado',
    'Imoveis',
]

function toneClass(tone?: string) {
    return `pilger-ai-tone-${tone || 'muted'}`
}

function normalizeText(value: unknown) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
}

function shortAgentName(agent: AgentOfficeItem) {
    return agent.personaName || agent.name
}

function agentInitials(agent: AgentOfficeItem) {
    return agent.avatarInitials || shortAgentName(agent).slice(0, 2).toUpperCase()
}

function unique(items: string[], limit = 5) {
    return Array.from(new Set(items.filter(Boolean))).slice(0, limit)
}

function normalizeSector(agent: AgentOfficeItem) {
    if (agent.source === 'virtual_brokers') return 'Comercial'
    return agent.sector || 'Outros'
}

function inferAgentFlow(agent: AgentOfficeItem): AgentFlow {
    const sector = normalizeSector(agent)
    const source = normalizeText([
        agent.id,
        agent.name,
        agent.personaName,
        agent.role,
        agent.sector,
        agent.detail,
        agent.tools?.join(' '),
    ].join(' '))

    const receives = ['Central de Inteligencia']
    const sends = ['Central de Inteligencia']

    if (sector === 'Diretoria' || source.includes('ceo') || source.includes('daily') || source.includes('weekly')) {
        receives.push('KPIs', 'eventos dos agentes', 'relatorios')
        sends.push('prioridades', 'alertas internos', 'direcionamento')
    } else if (sector === 'Pilger AI' || source.includes('pilger ai') || source.includes('regras')) {
        receives.push('contexto do painel', 'permissoes', 'regras globais')
        sends.push('governanca', 'respostas orientadas', 'acoes preparadas')
    } else if (sector === 'Inteligencia' || source.includes('radar') || source.includes('research') || source.includes('benchmark')) {
        receives.push('mercado', 'tracking', 'historico de leads')
        sends.push('briefings', 'oportunidades', 'insights')
    } else if (sector === 'Comercial' || source.includes('corretor') || source.includes('lead')) {
        receives.push('conversas WhatsApp', 'historico entre agentes', 'perfil do lead')
        sends.push('CRM', 'qualificacao', 'resumo para humano')
    } else if (sector === 'WhatsApp') {
        receives.push('mensagens', 'janelas de atendimento', 'etiquetas')
        sends.push('extracao de dados', 'follow-up', 'handoff')
    } else if (sector === 'Marketing') {
        receives.push('CRM', 'campanhas', 'sinais comerciais')
        sends.push('conteudo', 'criativos', 'performance')
    } else if (sector === 'Imoveis') {
        receives.push('briefings', 'fotos e videos', 'dados do proprietario')
        sends.push('cadastro', 'SEO', 'pendencias')
    } else if (sector === 'Operacoes') {
        receives.push('usuarios', 'eventos internos', 'rotinas')
        sends.push('avisos', 'tarefas', 'registros')
    } else if (sector === 'Recrutamento') {
        receives.push('candidatos', 'curriculos', 'formularios')
        sends.push('triagem', 'ranking', 'observacoes')
    }

    for (const tool of (agent.tools || []).slice(0, 2)) receives.push(tool)

    const liveSignal = agent.tone === 'success'
        ? 'sincronizando com a central'
        : agent.tone === 'warning'
            ? 'aguardando configuracao'
            : agent.tone === 'danger'
                ? 'precisa de revisao'
                : 'em espera'

    return {
        sector,
        receives: unique(receives, 5),
        sends: unique(sends, 5),
        liveSignal,
    }
}

function activityTitle(item: PilgerAiEventItem | PilgerAiWorkItem) {
    return item.title
}

function findAgentActivity(agent: AgentOfficeItem, events: PilgerAiEventItem[], tasks: PilgerAiWorkItem[]) {
    const agentTokens = [
        agent.name,
        agent.personaName,
        agent.sector,
        agent.role,
        agent.id,
    ].map(normalizeText).filter(Boolean)

    const items = [...events, ...tasks]
    return items.find(item => {
        const haystack = normalizeText([
            item.title,
            item.description,
            item.sector,
            'eventType' in item ? item.eventType : item.source,
        ].join(' '))
        return agentTokens.some(token => token && haystack.includes(token))
    })
}

function toneRank(tone?: string) {
    if (tone === 'success') return 0
    if (tone === 'warning') return 1
    if (tone === 'danger') return 2
    if (tone === 'info') return 3
    return 4
}

function groupBySector(agents: AgentOfficeItem[], events: PilgerAiEventItem[], tasks: PilgerAiWorkItem[]): SectorGroup[] {
    const rows = agents.map(agent => ({
        agent,
        flow: inferAgentFlow(agent),
        activity: findAgentActivity(agent, events, tasks),
    }))

    const grouped = new Map<string, AgentFlowRow[]>()
    for (const row of rows) {
        const existing = grouped.get(row.flow.sector) || []
        existing.push(row)
        grouped.set(row.flow.sector, existing)
    }

    return Array.from(grouped.entries())
        .map(([sector, sectorRows]) => {
            const sortedRows = sectorRows.sort((a, b) => (
                toneRank(a.agent.tone) - toneRank(b.agent.tone)
                || shortAgentName(a.agent).localeCompare(shortAgentName(b.agent))
            ))
            const activeCount = sortedRows.filter(row => row.agent.tone === 'success').length
            const dangerCount = sortedRows.filter(row => row.agent.tone === 'danger').length
            const warningCount = sortedRows.filter(row => row.agent.tone === 'warning').length
            const tone: AgentOfficeTone = dangerCount > 0
                ? 'danger'
                : warningCount > 0
                    ? 'warning'
                    : activeCount > 0
                        ? 'success'
                        : 'muted'

            return {
                sector,
                rows: sortedRows,
                receives: unique(sortedRows.flatMap(row => row.flow.receives), 6),
                sends: unique(sortedRows.flatMap(row => row.flow.sends), 6),
                activeCount,
                tone,
            }
        })
        .sort((a, b) => {
            const aIndex = SECTOR_ORDER.includes(a.sector) ? SECTOR_ORDER.indexOf(a.sector) : SECTOR_ORDER.length
            const bIndex = SECTOR_ORDER.includes(b.sector) ? SECTOR_ORDER.indexOf(b.sector) : SECTOR_ORDER.length
            return aIndex - bIndex || a.sector.localeCompare(b.sector)
        })
}

function AgentAvatar({ agent }: { agent: AgentOfficeItem }) {
    return (
        <div className="agent-workflow-avatar">
            {agent.avatarUrl ? (
                <img src={agent.avatarUrl} alt="" />
            ) : (
                <span>{agentInitials(agent)}</span>
            )}
            <i className={`agent-workflow-status-dot ${toneClass(agent.tone)}`} />
        </div>
    )
}

function AgentTooltip({ agent, flow }: { agent: AgentOfficeItem; flow: AgentFlow }) {
    return (
        <div className="agent-org-tooltip" role="tooltip">
            <strong>{shortAgentName(agent)}</strong>
            <small>{agent.jobTitle || agent.role}</small>
            <p>{agent.detail || agent.bio}</p>
            <div>
                <span>Setor: {flow.sector}</span>
                <span>Recebe: {flow.receives.join(', ')}</span>
                <span>Devolve: {flow.sends.join(', ')}</span>
                <span>Status: {agent.status}</span>
                <span>Autonomia: {agent.autonomy}</span>
            </div>
        </div>
    )
}

function WorkflowNode({
    className = '',
    icon,
    eyebrow,
    title,
    subtitle,
    children,
}: {
    className?: string
    icon: ReactNode
    eyebrow: string
    title: string
    subtitle: string
    children?: ReactNode
}) {
    return (
        <div className={`agent-workflow-node ${className}`}>
            <span className="agent-workflow-port agent-workflow-port-left" />
            <div className="agent-workflow-icon">{icon}</div>
            <div className="agent-workflow-copy">
                <small>{eyebrow}</small>
                <strong>{title}</strong>
                <span>{subtitle}</span>
            </div>
            {children}
            <span className="agent-workflow-port agent-workflow-port-right" />
        </div>
    )
}

function Connector({ className = '' }: { className?: string }) {
    return (
        <div className={`agent-workflow-connector ${className}`} aria-hidden="true">
            <span />
        </div>
    )
}

export default function AgentOrgMap({
    agents,
    events,
    tasks,
}: {
    agents: AgentOfficeItem[]
    events: PilgerAiEventItem[]
    tasks: PilgerAiWorkItem[]
}) {
    const groups = groupBySector(agents, events, tasks)
    const liveItems = [...events.slice(0, 5), ...tasks.slice(0, 3)].slice(0, 7)
    const workingAgents = agents.filter(agent => agent.tone === 'success').length

    return (
        <div className="agent-org-grid agent-org-grid-full">
            <section className="agent-org-panel agent-workflow-panel">
                <div className="agent-org-head">
                    <div>
                        <span>Workflow vivo</span>
                        <h2><GitBranch size={19} /> Organograma estilo automacao</h2>
                        <p>A Central de Inteligencia funciona como o cerebro: recebe dados dos agentes, cruza contexto e devolve inteligencia para cada setor agir.</p>
                    </div>
                    <div className="agent-org-head-actions">
                        <div className="agent-org-live-badge">
                            <RadioTower size={16} />
                            {workingAgents} trabalhando
                        </div>
                        <AgentOrgLiveRefresh />
                    </div>
                </div>

                <div className="agent-workflow-canvas">
                    <div className="agent-workflow-mainline">
                        <WorkflowNode
                            className="agent-workflow-trigger"
                            icon={<Zap size={22} />}
                            eyebrow="Trigger"
                            title="Novo sinal"
                            subtitle="lead, evento ou campanha"
                        />
                        <Connector />
                        <WorkflowNode
                            className="agent-workflow-central"
                            icon={<BrainCircuit size={32} />}
                            eyebrow="Cerebro do sistema"
                            title="Central de Inteligencia"
                            subtitle="recebe, cruza e devolve dados para todos os agentes"
                        >
                            <div className="agent-workflow-node-stats">
                                <span>{agents.length} agentes</span>
                                <span>{groups.length} setores</span>
                                <span>{liveItems.length} sinais recentes</span>
                            </div>
                            <div className="agent-workflow-brain-flow">
                                <span><ArrowDownLeft size={12} /> Recebe dos agentes</span>
                                <span><ArrowUpRight size={12} /> Envia inteligencia</span>
                            </div>
                        </WorkflowNode>
                        <Connector />
                        <WorkflowNode
                            className="agent-workflow-router"
                            icon={<Route size={22} />}
                            eyebrow="Router"
                            title="Setores"
                            subtitle="distribui dados para cada area"
                        />
                    </div>

                    <div className="agent-workflow-data-row">
                        {CENTRAL_DATA_NODES.map((node, index) => (
                            <div
                                className="agent-workflow-data-node"
                                key={node}
                                style={{ '--flow-delay': `${index * 0.18}s` } as CSSProperties}
                            >
                                <span className="agent-workflow-data-line" />
                                <div><DatabaseZap size={16} /></div>
                                <strong>{node}</strong>
                            </div>
                        ))}
                    </div>

                    <div className="agent-workflow-brain-bus" aria-hidden="true">
                        <span className="agent-workflow-brain-packet agent-workflow-brain-packet-out" />
                        <span className="agent-workflow-brain-packet agent-workflow-brain-packet-in" />
                    </div>

                    <div className="agent-workflow-branches">
                        <div className="agent-workflow-return-spine" aria-hidden="true">
                            <span className="agent-workflow-return-packet agent-workflow-return-packet-up" />
                            <span className="agent-workflow-return-packet agent-workflow-return-packet-down" />
                        </div>
                        {groups.map((group, groupIndex) => (
                            <section
                                className={`agent-workflow-branch ${toneClass(group.tone)}`}
                                key={group.sector}
                                style={{ '--flow-delay': `${groupIndex * 0.16}s` } as CSSProperties}
                            >
                                <div className="agent-workflow-sector-node">
                                    <span className="agent-workflow-port agent-workflow-port-left" />
                                    <div className="agent-workflow-sector-icon">
                                        <Building2 size={18} />
                                    </div>
                                    <div>
                                        <small>Setor</small>
                                        <strong>{group.sector}</strong>
                                        <p>{SECTOR_DESCRIPTIONS[group.sector] || SECTOR_DESCRIPTIONS.Outros}</p>
                                    </div>
                                    <span className="agent-workflow-sector-count">
                                        <Users size={13} />
                                        {group.activeCount}/{group.rows.length}
                                    </span>
                                    <span className="agent-workflow-port agent-workflow-port-right" />
                                </div>

                                <Connector className="agent-workflow-branch-connector" />

                                <div className="agent-workflow-agent-chain">
                                    {group.rows.map(({ agent, flow, activity }, agentIndex) => (
                                        <article
                                            className={`agent-workflow-agent-node ${toneClass(agent.tone)}`}
                                            key={agent.id}
                                            style={{ '--flow-delay': `${(groupIndex + agentIndex) * 0.14}s` } as CSSProperties}
                                            tabIndex={0}
                                        >
                                            <span className="agent-workflow-port agent-workflow-port-left" />
                                            <AgentAvatar agent={agent} />
                                            <div className="agent-workflow-agent-copy">
                                                <strong>{shortAgentName(agent)}</strong>
                                                <small>{agent.jobTitle || agent.role}</small>
                                                <p>{activity ? activityTitle(activity) : flow.liveSignal}</p>
                                            </div>
                                            <div className="agent-workflow-agent-tags">
                                                <span><ArrowDownLeft size={12} /> {flow.receives[1] || 'Central'}</span>
                                                <span><ArrowUpRight size={12} /> {flow.sends[1] || 'Central'}</span>
                                            </div>
                                            <AgentTooltip agent={agent} flow={flow} />
                                            <span className="agent-workflow-port agent-workflow-port-right" />
                                        </article>
                                    ))}
                                </div>

                                <div className="agent-workflow-return-connector" aria-hidden="true">
                                    <span />
                                </div>
                            </section>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    )
}
