'use client'

import {
    BrainCircuit,
    Building2,
    DatabaseZap,
    Maximize2,
    Minus,
    Plus,
    RotateCcw,
    Sparkles,
    Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent, WheelEvent } from 'react'
import type { AgentOfficeItem, AgentOfficeTone } from '@/lib/pilger-ai/agent-office'
import type { PilgerAiEventItem, PilgerAiWorkItem } from '@/lib/pilger-ai/operations'

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
    activeCount: number
    tone: AgentOfficeTone
}

type GraphNodeType = 'central' | 'trigger' | 'data' | 'sector' | 'agent'

type GraphNode = {
    id: string
    type: GraphNodeType
    label: string
    subtitle: string
    accent?: string
    x: number
    y: number
    tone?: AgentOfficeTone
    agent?: AgentOfficeItem
    flow?: AgentFlow
    activity?: PilgerAiEventItem | PilgerAiWorkItem
    group?: SectorGroup
}

type GraphLink = {
    id: string
    source: string
    target: string
    type: 'input' | 'memory' | 'sector' | 'agent' | 'return' | 'sync'
    accent?: string
}

type GraphLayout = {
    width: number
    height: number
    nodes: GraphNode[]
    links: GraphLink[]
}

type GraphViewport = {
    x: number
    y: number
    scale: number
}

type GraphPosition = {
    x: number
    y: number
}

type SavedGraphLayout = {
    version: number
    nodeScale: number
    updatedAt: string
    positions: Record<string, GraphPosition>
}

type GraphPan = {
    startX: number
    startY: number
    originX: number
    originY: number
}

const GRAPH_WIDTH = 5000
const GRAPH_HEIGHT = 4200
const CENTER = { x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 }
const CENTRAL_NODE_ID = 'central:intelligence'
const MIN_ZOOM = 0.28
const MAX_ZOOM = 1.35
const MIN_NODE_SCALE = 0.75
const MAX_NODE_SCALE = 1.45
const NODE_SCALE_STEP = 0.1
const DEFAULT_NODE_SCALE = 1
const GRAPH_LAYOUT_CONFIG_KEY = 'pilger_ai_org_graph_layout'
const POSITION_STORAGE_KEY = 'pilger-ai-org-graph-positions-v3'

const SECTOR_ORDER = [
    'Diretoria',
    'Compliance e Governança',
    'Inteligencia',
    'Comercial',
    'WhatsApp',
    'Marketing',
    'Imoveis',
    'Operacoes',
    'Recrutamento',
    'Outros',
]

const CENTRAL_DATA_NODES = [
    'Leads',
    'Conversas',
    'Tracking',
    'Campanhas',
    'Mercado',
    'Imoveis',
]

const GRAPH_ACCENTS = ['#4A9EFF', '#00D4AA', '#A78BFA', '#F59E0B', '#38BDF8', '#F472B6']

function graphAccent(index: number) {
    return GRAPH_ACCENTS[index % GRAPH_ACCENTS.length]
}

function sectorAccent(sector: string) {
    const index = SECTOR_ORDER.includes(sector) ? SECTOR_ORDER.indexOf(sector) : SECTOR_ORDER.length
    return graphAccent(index)
}

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
    } else if (sector === 'Compliance e Governança' || source.includes('pilger ai') || source.includes('regras')) {
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

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value))
}

function graphBounds(nodes: GraphNode[], padding = 190) {
    const xs = nodes.map(node => node.x)
    const ys = nodes.map(node => node.y)
    const minX = clamp(Math.min(...xs) - padding, 0, GRAPH_WIDTH)
    const maxX = clamp(Math.max(...xs) + padding, 0, GRAPH_WIDTH)
    const minY = clamp(Math.min(...ys) - padding, 0, GRAPH_HEIGHT)
    const maxY = clamp(Math.max(...ys) + padding, 0, GRAPH_HEIGHT)

    return {
        minX,
        minY,
        width: Math.max(maxX - minX, 1),
        height: Math.max(maxY - minY, 1),
    }
}

function normalizeGraphPositions(
    positions: Record<string, { x?: number; y?: number }> | undefined,
    initialPositions: Record<string, GraphPosition>,
) {
    const merged = { ...initialPositions }
    if (!positions) return merged

    for (const [id, position] of Object.entries(positions)) {
        if (!merged[id]) continue
        if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) continue
        merged[id] = {
            x: clamp(Number(position.x), 60, GRAPH_WIDTH - 60),
            y: clamp(Number(position.y), 60, GRAPH_HEIGHT - 60),
        }
    }

    return merged
}

function parseSavedGraphLayout(value: string | null | undefined, initialPositions: Record<string, GraphPosition>) {
    if (!value) return null

    try {
        const parsed = JSON.parse(value) as Partial<SavedGraphLayout> | Record<string, { x?: number; y?: number }>
        const looksLikeLayout = 'positions' in parsed
        const positions = looksLikeLayout
            ? normalizeGraphPositions((parsed as Partial<SavedGraphLayout>).positions, initialPositions)
            : normalizeGraphPositions(parsed as Record<string, { x?: number; y?: number }>, initialPositions)
        const updatedAt = looksLikeLayout && typeof (parsed as Partial<SavedGraphLayout>).updatedAt === 'string'
            ? String((parsed as Partial<SavedGraphLayout>).updatedAt)
            : ''
        const nodeScale = looksLikeLayout && Number.isFinite((parsed as Partial<SavedGraphLayout>).nodeScale)
            ? clamp(Number((parsed as Partial<SavedGraphLayout>).nodeScale), MIN_NODE_SCALE, MAX_NODE_SCALE)
            : DEFAULT_NODE_SCALE

        return {
            nodeScale,
            positions,
            updatedAt,
        }
    } catch {
        return null
    }
}

function loadSavedGraphLayout(initialPositions: Record<string, GraphPosition>, serverLayout?: string | null) {
    const serverSaved = parseSavedGraphLayout(serverLayout, initialPositions)
    if (typeof window === 'undefined') return serverSaved

    const localSaved = parseSavedGraphLayout(window.localStorage.getItem(POSITION_STORAGE_KEY), initialPositions)
    if (!serverSaved) return localSaved
    if (!localSaved) return serverSaved

    const serverTime = Date.parse(serverSaved.updatedAt || '')
    const localTime = Date.parse(localSaved.updatedAt || '')
    if (Number.isFinite(localTime) && (!Number.isFinite(serverTime) || localTime > serverTime)) return localSaved

    return serverSaved
}

function buildSavedGraphLayout(positions: Record<string, GraphPosition>, nodeScale: number): SavedGraphLayout {
    return {
        version: 2,
        nodeScale: clamp(nodeScale, MIN_NODE_SCALE, MAX_NODE_SCALE),
        updatedAt: new Date().toISOString(),
        positions,
    }
}

function saveGraphLayoutLocally(layout: SavedGraphLayout) {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(layout))
}

async function saveGraphLayoutToServer(layout: SavedGraphLayout) {
    const response = await fetch('/api/admin/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            configs: {
                [GRAPH_LAYOUT_CONFIG_KEY]: JSON.stringify(layout),
            },
        }),
    })

    if (!response.ok) throw new Error(`Falha ao salvar layout do organograma (${response.status})`)
}

function graphLinkPath(source: GraphNode, target: GraphNode, link: GraphLink) {
    const dx = target.x - source.x
    const dy = target.y - source.y
    const distance = Math.max(Math.hypot(dx, dy), 1)
    const curve = Math.min(96, distance * 0.22)
    const direction = link.type === 'return' || link.type === 'sync' ? -1 : 1
    const controlX = (source.x + target.x) / 2 + (-dy / distance) * curve * direction
    const controlY = (source.y + target.y) / 2 + (dx / distance) * curve * direction

    return `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`
}

function graphLinkFlowClass(link: GraphLink) {
    if (link.type === 'input') return 'agent-graph-link-entry'
    if (link.type === 'return' || link.type === 'sync' || link.target === CENTRAL_NODE_ID) return 'agent-graph-link-inbound'
    if (link.source === CENTRAL_NODE_ID || link.type === 'sector' || link.type === 'agent' || link.type === 'memory') return 'agent-graph-link-outbound'
    return 'agent-graph-link-lateral'
}

function graphLinkMarker(flowClass: string) {
    if (flowClass === 'agent-graph-link-inbound') return 'url(#agentGraphArrowInbound)'
    if (flowClass === 'agent-graph-link-entry') return 'url(#agentGraphArrowEntry)'
    return 'url(#agentGraphArrowOutbound)'
}

function buildGraphLayout(groups: SectorGroup[], recentSignals: number): GraphLayout {
    const nodes: GraphNode[] = [
        {
            id: 'trigger:new-signal',
            type: 'trigger',
            label: 'Novo sinal',
            subtitle: 'lead, evento ou campanha',
            accent: '#F59E0B',
            x: CENTER.x - 410,
            y: CENTER.y - 250,
        },
        {
            id: CENTRAL_NODE_ID,
            type: 'central',
            label: 'Central de Inteligencia',
            subtitle: `${groups.reduce((sum, group) => sum + group.rows.length, 0)} agentes, ${groups.length} setores, ${recentSignals} sinais recentes`,
            accent: '#F0D060',
            x: CENTER.x,
            y: CENTER.y,
        },
    ]
    const links: GraphLink[] = [
        { id: 'trigger-central', source: 'trigger:new-signal', target: CENTRAL_NODE_ID, type: 'input', accent: '#F59E0B' },
    ]

    CENTRAL_DATA_NODES.forEach((label, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / CENTRAL_DATA_NODES.length
        const id = `data:${normalizeText(label)}`
        const accent = graphAccent(index + 2)
        nodes.push({
            id,
            type: 'data',
            label,
            subtitle: 'memoria viva',
            accent,
            x: CENTER.x + Math.cos(angle) * 210,
            y: CENTER.y + Math.sin(angle) * 168,
        })
        links.push({ id: `central-${id}`, source: CENTRAL_NODE_ID, target: id, type: 'memory', accent })
        links.push({ id: `${id}-central`, source: id, target: CENTRAL_NODE_ID, type: 'sync', accent })
    })

    groups.forEach((group, sectorIndex) => {
        const angle = -Math.PI / 2 + (sectorIndex * Math.PI * 2) / groups.length
        const sectorId = `sector:${normalizeText(group.sector)}`
        const sectorX = CENTER.x + Math.cos(angle) * 420
        const sectorY = CENTER.y + Math.sin(angle) * 330
        const accent = sectorAccent(group.sector)

        nodes.push({
            id: sectorId,
            type: 'sector',
            label: group.sector,
            subtitle: `${group.activeCount}/${group.rows.length} ativos`,
            accent,
            x: sectorX,
            y: sectorY,
            tone: group.tone,
            group,
        })
        links.push({ id: `central-${sectorId}`, source: CENTRAL_NODE_ID, target: sectorId, type: 'sector', accent })
        links.push({ id: `${sectorId}-central`, source: sectorId, target: CENTRAL_NODE_ID, type: 'return', accent })

        group.rows.forEach((row, agentIndex) => {
            const fanOffset = agentIndex - (group.rows.length - 1) / 2
            const perpendicular = angle + Math.PI / 2
            const radial = 150 + Math.floor(agentIndex / 4) * 54
            const spread = fanOffset * 78
            const agentX = clamp(
                sectorX + Math.cos(angle) * radial + Math.cos(perpendicular) * spread,
                90,
                GRAPH_WIDTH - 90,
            )
            const agentY = clamp(
                sectorY + Math.sin(angle) * radial + Math.sin(perpendicular) * spread,
                86,
                GRAPH_HEIGHT - 86,
            )
            const agentId = `agent:${row.agent.id}`

            nodes.push({
                id: agentId,
                type: 'agent',
                label: shortAgentName(row.agent),
                subtitle: row.agent.jobTitle || row.agent.role,
                accent,
                x: agentX,
                y: agentY,
                tone: row.agent.tone,
                agent: row.agent,
                flow: row.flow,
                activity: row.activity,
            })
            links.push({ id: `${sectorId}-${agentId}`, source: sectorId, target: agentId, type: 'agent', accent })
            links.push({ id: `${agentId}-central`, source: agentId, target: CENTRAL_NODE_ID, type: 'return', accent })
        })
    })

    return { width: GRAPH_WIDTH, height: GRAPH_HEIGHT, nodes, links }
}

function AgentGraphTooltip({ node }: { node: GraphNode }) {
    if (node.type === 'agent' && node.agent && node.flow) {
        const activity = node.activity ? activityTitle(node.activity) : node.flow.liveSignal
        return (
            <div className="agent-graph-tooltip" role="tooltip">
                <strong>{shortAgentName(node.agent)}</strong>
                <small>{node.agent.jobTitle || node.agent.role}</small>
                <p>{node.agent.detail || node.agent.bio}</p>
                <div>
                    <span>Atividade: {activity}</span>
                    <span>Recebe: {node.flow.receives.join(', ')}</span>
                    <span>Devolve: {node.flow.sends.join(', ')}</span>
                    <span>Status: {node.agent.status}</span>
                </div>
            </div>
        )
    }

    if (node.type === 'sector' && node.group) {
        return (
            <div className="agent-graph-tooltip" role="tooltip">
                <strong>{node.label}</strong>
                <small>Setor conectado</small>
                <p>{node.group.rows.length} agente{node.group.rows.length === 1 ? '' : 's'} conectado{node.group.rows.length === 1 ? '' : 's'} a central.</p>
                <div>
                    <span>Ativos: {node.group.activeCount}</span>
                    <span>Todos consultam e alimentam a Central de Inteligencia.</span>
                </div>
            </div>
        )
    }

    return null
}

function GraphNodeView({
    node,
    nodeDelay,
    focusClass,
    isDragging,
    isCollapsed,
    onHover,
    onNodeClick,
    onPointerDown,
}: {
    node: GraphNode
    nodeDelay: number
    focusClass: string
    isDragging: boolean
    isCollapsed: boolean
    onHover: (id: string | null) => void
    onNodeClick: (id: string) => void
    onPointerDown: (event: PointerEvent<HTMLDivElement>, id: string) => void
}) {
    const style = {
        '--node-accent': node.accent || '#4A9EFF',
        '--node-delay': `${nodeDelay * 50}ms`,
        left: `${node.x}px`,
        top: `${node.y}px`,
    } as CSSProperties

    if (node.type === 'central') {
        return (
            <div
                className={`agent-graph-node agent-graph-central ${focusClass} ${isDragging ? 'is-dragging' : ''}`}
                onMouseEnter={() => onHover(node.id)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onNodeClick(node.id)}
                onPointerDown={event => onPointerDown(event, node.id)}
                style={style}
                tabIndex={0}
            >
                <span className="agent-graph-orbit agent-graph-orbit-one" />
                <span className="agent-graph-orbit agent-graph-orbit-two" />
                <div className="agent-graph-brain">
                    <BrainCircuit size={38} />
                </div>
                <strong>{node.label}</strong>
                <small>{node.subtitle}</small>
                <div>
                    <span>Recebe dados</span>
                    <span>Envia inteligencia</span>
                </div>
            </div>
        )
    }

    if (node.type === 'trigger') {
        return (
            <div
                className={`agent-graph-node agent-graph-trigger ${focusClass} ${isDragging ? 'is-dragging' : ''}`}
                onMouseEnter={() => onHover(node.id)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onNodeClick(node.id)}
                onPointerDown={event => onPointerDown(event, node.id)}
                style={style}
                tabIndex={0}
            >
                <Zap size={18} />
                <div>
                    <strong>{node.label}</strong>
                    <small>{node.subtitle}</small>
                </div>
            </div>
        )
    }

    if (node.type === 'data') {
        return (
            <div
                className={`agent-graph-node agent-graph-data ${focusClass} ${isDragging ? 'is-dragging' : ''}`}
                onMouseEnter={() => onHover(node.id)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onNodeClick(node.id)}
                onPointerDown={event => onPointerDown(event, node.id)}
                style={style}
                tabIndex={0}
            >
                <DatabaseZap size={17} />
                <div>
                    <strong>{node.label}</strong>
                    <small>{node.subtitle}</small>
                </div>
            </div>
        )
    }

    if (node.type === 'sector') {
        return (
            <div
                className={`agent-graph-node agent-graph-sector ${toneClass(node.tone)} ${focusClass} ${isCollapsed ? 'is-collapsed' : ''} ${isDragging ? 'is-dragging' : ''}`}
                onMouseEnter={() => onHover(node.id)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onNodeClick(node.id)}
                onPointerDown={event => onPointerDown(event, node.id)}
                style={style}
                tabIndex={0}
            >
                <Building2 size={17} />
                <div>
                    <strong>{node.label}</strong>
                    <small>{isCollapsed ? 'filhos recolhidos' : node.subtitle}</small>
                </div>
                <AgentGraphTooltip node={node} />
            </div>
        )
    }

    const agent = node.agent
    return (
        <div
            className={`agent-graph-node agent-graph-agent ${toneClass(node.tone)} ${focusClass} ${isDragging ? 'is-dragging' : ''}`}
            onMouseEnter={() => onHover(node.id)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onNodeClick(node.id)}
            onPointerDown={event => onPointerDown(event, node.id)}
            style={style}
            tabIndex={0}
        >
            <div className="agent-graph-avatar-wrap">
                <div className="agent-graph-avatar">
                    {agent?.avatarUrl ? (
                        <img src={agent.avatarUrl} alt="" />
                    ) : (
                        <span>{agent ? agentInitials(agent) : node.label.slice(0, 2).toUpperCase()}</span>
                    )}
                    <i className={`agent-graph-status ${toneClass(node.tone)}`} />
                </div>
            </div>
            <div className="agent-graph-agent-copy">
                <strong>{node.label}</strong>
                <small>{node.subtitle}</small>
            </div>
            <AgentGraphTooltip node={node} />
        </div>
    )
}

export default function AgentOrgMap({
    agents,
    events,
    savedLayout,
    tasks,
}: {
    agents: AgentOfficeItem[]
    events: PilgerAiEventItem[]
    savedLayout?: string | null
    tasks: PilgerAiWorkItem[]
}) {
    const groups = useMemo(() => groupBySector(agents, events, tasks), [agents, events, tasks])
    const liveItems = useMemo(() => [...events.slice(0, 5), ...tasks.slice(0, 3)].slice(0, 7), [events, tasks])
    const initialLayout = useMemo(() => buildGraphLayout(groups, liveItems.length), [groups, liveItems.length])
    const initialPositions = useMemo(
        () => Object.fromEntries(initialLayout.nodes.map(node => [node.id, { x: node.x, y: node.y }])),
        [initialLayout.nodes],
    )
    const serverInitialLayout = useMemo(() => parseSavedGraphLayout(savedLayout, initialPositions), [initialPositions, savedLayout])
    const [positions, setPositions] = useState<Record<string, GraphPosition>>(serverInitialLayout?.positions || initialPositions)
    const [nodeScale, setNodeScale] = useState(serverInitialLayout?.nodeScale || DEFAULT_NODE_SCALE)
    const [dragging, setDragging] = useState<null | { id: string; dx: number; dy: number }>(null)
    const [panning, setPanning] = useState<GraphPan | null>(null)
    const [viewport, setViewport] = useState<GraphViewport>({ x: 0, y: 0, scale: 0.72 })
    const [loadedLayoutToken, setLoadedLayoutToken] = useState(0)
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
    const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(() => new Set())
    const canvasRef = useRef<HTMLDivElement | null>(null)
    const stageRef = useRef<HTMLDivElement | null>(null)
    const saveTimerRef = useRef<number | null>(null)
    const lastSavedLayoutRef = useRef<SavedGraphLayout | null>(null)
    const lastFittedLayoutTokenRef = useRef(-1)
    const viewportRef = useRef(viewport)

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            const storedLayout = loadSavedGraphLayout(initialPositions, savedLayout)
            setPositions(storedLayout?.positions || initialPositions)
            setNodeScale(storedLayout?.nodeScale || DEFAULT_NODE_SCALE)
            setLoadedLayoutToken(current => current + 1)
        })

        return () => window.cancelAnimationFrame(frame)
    }, [initialPositions, savedLayout])

    useEffect(() => {
        viewportRef.current = viewport
    }, [viewport])

    useEffect(() => () => {
        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
        if (lastSavedLayoutRef.current) {
            void saveGraphLayoutToServer(lastSavedLayoutRef.current).catch(() => undefined)
        }
    }, [])

    const nodes = useMemo(() => initialLayout.nodes.map(node => ({
        ...node,
        ...(positions[node.id] || { x: node.x, y: node.y }),
    })), [initialLayout.nodes, positions])
    const nodeMap = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes])
    const hiddenNodeIds = useMemo(() => {
        const hidden = new Set<string>()
        for (const link of initialLayout.links) {
            if (link.type === 'agent' && collapsedNodeIds.has(link.source)) hidden.add(link.target)
        }
        return hidden
    }, [collapsedNodeIds, initialLayout.links])
    const visibleNodes = useMemo(() => nodes.filter(node => !hiddenNodeIds.has(node.id)), [hiddenNodeIds, nodes])
    const visibleNodeIds = useMemo(() => new Set(visibleNodes.map(node => node.id)), [visibleNodes])
    const visibleLinks = useMemo(
        () => initialLayout.links.filter(link => visibleNodeIds.has(link.source) && visibleNodeIds.has(link.target)),
        [initialLayout.links, visibleNodeIds],
    )

    const queueGraphLayoutSave = useCallback((nextPositions: Record<string, GraphPosition>, nextNodeScale = nodeScale) => {
        const layout = buildSavedGraphLayout(nextPositions, nextNodeScale)
        lastSavedLayoutRef.current = layout
        saveGraphLayoutLocally(layout)

        if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = window.setTimeout(() => {
            void saveGraphLayoutToServer(layout).catch(error => {
                console.warn('[AgentOrgMap] Failed to save graph layout:', error)
            })
            saveTimerRef.current = null
        }, 800)
    }, [nodeScale])

    const fitViewport = useCallback((persist = false, targetNodes = nodes, targetPositions = positions) => {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return false
        const bounds = graphBounds(targetNodes)

        const nextScale = clamp(
            Math.min((rect.width - 48) / bounds.width, (rect.height - 48) / bounds.height),
            MIN_ZOOM,
            0.88,
        )

        const nextViewport = {
            x: (rect.width - bounds.width * nextScale) / 2 - bounds.minX * nextScale,
            y: (rect.height - bounds.height * nextScale) / 2 - bounds.minY * nextScale,
            scale: nextScale,
        }

        viewportRef.current = nextViewport
        setViewport(nextViewport)
        if (persist) queueGraphLayoutSave(targetPositions)
        return true
    }, [nodes, positions, queueGraphLayoutSave])

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            if (lastFittedLayoutTokenRef.current !== loadedLayoutToken && fitViewport()) {
                lastFittedLayoutTokenRef.current = loadedLayoutToken
            }
        })
        const canvas = canvasRef.current
        if (!canvas || typeof ResizeObserver === 'undefined') {
            return () => window.cancelAnimationFrame(frame)
        }
        const observer = new ResizeObserver(() => {
            if (lastFittedLayoutTokenRef.current !== loadedLayoutToken && fitViewport()) {
                lastFittedLayoutTokenRef.current = loadedLayoutToken
            }
        })
        observer.observe(canvas)
        return () => {
            window.cancelAnimationFrame(frame)
            observer.disconnect()
        }
    }, [fitViewport, loadedLayoutToken])
    const connectedNodeIds = useMemo(() => {
        if (!hoveredNodeId) return new Set<string>()
        const ids = new Set<string>([hoveredNodeId])

        for (const link of visibleLinks) {
            if (link.source === hoveredNodeId) ids.add(link.target)
            if (link.target === hoveredNodeId) ids.add(link.source)
        }

        return ids
    }, [hoveredNodeId, visibleLinks])

    function nodeFocusClass(id: string) {
        if (!hoveredNodeId) return ''
        if (id === hoveredNodeId) return 'is-focused'
        if (connectedNodeIds.has(id)) return 'is-related'
        return 'is-dimmed'
    }

    function handleNodeClick(id: string) {
        const node = nodeMap.get(id)
        if (node?.type !== 'sector') return
        setCollapsedNodeIds(current => {
            const next = new Set(current)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function changeNodeScale(direction: number) {
        setNodeScale(current => {
            const next = clamp(Number((current + direction * NODE_SCALE_STEP).toFixed(2)), MIN_NODE_SCALE, MAX_NODE_SCALE)
            queueGraphLayoutSave(positions, next)
            return next
        })
    }

    function canvasPoint(event: PointerEvent) {
        const rect = stageRef.current?.getBoundingClientRect()
        if (!rect) return { x: 0, y: 0 }

        const scaleX = initialLayout.width / rect.width
        const scaleY = initialLayout.height / rect.height

        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY,
        }
    }

    function startDrag(event: PointerEvent<HTMLDivElement>, id: string) {
        const node = nodeMap.get(id)
        if (!node) return
        const point = canvasPoint(event)
        event.currentTarget.setPointerCapture(event.pointerId)
        setDragging({ id, dx: node.x - point.x, dy: node.y - point.y })
    }

    function moveNode(event: PointerEvent<HTMLDivElement>) {
        if (!dragging) return
        const point = canvasPoint(event)
        setPositions(current => {
            const next = {
                ...current,
                [dragging.id]: {
                    x: clamp(point.x + dragging.dx, 60, initialLayout.width - 60),
                    y: clamp(point.y + dragging.dy, 60, initialLayout.height - 60),
                },
            }
            queueGraphLayoutSave(next)
            return next
        })
    }

    function startPan(event: PointerEvent<HTMLDivElement>) {
        const target = event.target instanceof Element ? event.target : null
        if (target?.closest('.agent-graph-node, .agent-graph-control, .agent-graph-size-control')) return
        event.currentTarget.setPointerCapture(event.pointerId)
        setPanning({
            startX: event.clientX,
            startY: event.clientY,
            originX: viewport.x,
            originY: viewport.y,
        })
    }

    function moveStage(event: PointerEvent<HTMLDivElement>) {
        moveNode(event)
        if (!panning) return
        const nextViewport = {
            ...viewportRef.current,
            x: panning.originX + event.clientX - panning.startX,
            y: panning.originY + event.clientY - panning.startY,
        }
        viewportRef.current = nextViewport
        setViewport(nextViewport)
    }

    function zoomGraph(factor: number, clientX?: number, clientY?: number) {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) {
            const nextViewport = { ...viewportRef.current, scale: clamp(viewportRef.current.scale * factor, MIN_ZOOM, MAX_ZOOM) }
            viewportRef.current = nextViewport
            setViewport(nextViewport)
            return
        }

        setViewport(current => {
            const nextScale = clamp(current.scale * factor, MIN_ZOOM, MAX_ZOOM)
            const focusX = clientX === undefined ? rect.width / 2 : clientX - rect.left
            const focusY = clientY === undefined ? rect.height / 2 : clientY - rect.top
            const graphX = (focusX - current.x) / current.scale
            const graphY = (focusY - current.y) / current.scale

            const nextViewport = {
                x: focusX - graphX * nextScale,
                y: focusY - graphY * nextScale,
                scale: nextScale,
            }
            viewportRef.current = nextViewport
            return nextViewport
        })
    }

    function handleWheel(event: WheelEvent<HTMLDivElement>) {
        event.preventDefault()
        zoomGraph(event.deltaY > 0 ? 0.9 : 1.1, event.clientX, event.clientY)
    }

    function stopDrag() {
        setDragging(null)
        setPanning(null)
    }

    function resetLayout() {
        setPositions(initialPositions)
        fitViewport(true, initialLayout.nodes, initialPositions)
    }

    return (
        <div className="agent-org-grid agent-org-grid-full">
            <section className="agent-org-panel agent-graph-panel">
                <div
                    className={`agent-graph-canvas ${panning ? 'is-panning' : ''}`}
                    onPointerDown={startPan}
                    onPointerLeave={stopDrag}
                    onPointerMove={moveStage}
                    onPointerUp={stopDrag}
                    onWheel={handleWheel}
                    ref={canvasRef}
                >
                    <div className="agent-graph-controls">
                        <button className="agent-graph-control" type="button" onClick={() => zoomGraph(1.12)} title="Aproximar">
                            <Plus size={15} />
                        </button>
                        <button className="agent-graph-control" type="button" onClick={() => zoomGraph(0.88)} title="Afastar">
                            <Minus size={15} />
                        </button>
                        <button className="agent-graph-control" type="button" onClick={() => fitViewport(true)} title="Centralizar">
                            <Maximize2 size={15} />
                        </button>
                        <button className="agent-graph-control" type="button" onClick={resetLayout} title="Reorganizar mapa">
                            <RotateCcw size={15} />
                        </button>
                        <div className="agent-graph-size-control" aria-label="Tamanho dos blocos">
                            <button
                                className="agent-graph-control"
                                disabled={nodeScale <= MIN_NODE_SCALE}
                                onClick={() => changeNodeScale(-1)}
                                title="Diminuir blocos"
                                type="button"
                            >
                                A-
                            </button>
                            <span>{Math.round(nodeScale * 100)}%</span>
                            <button
                                className="agent-graph-control"
                                disabled={nodeScale >= MAX_NODE_SCALE}
                                onClick={() => changeNodeScale(1)}
                                title="Aumentar blocos"
                                type="button"
                            >
                                A+
                            </button>
                        </div>
                    </div>
                    <div
                        className="agent-graph-stage"
                        ref={stageRef}
                        style={{
                            '--agent-node-scale': nodeScale,
                            height: `${initialLayout.height}px`,
                            transform: `matrix(${viewport.scale}, 0, 0, ${viewport.scale}, ${viewport.x}, ${viewport.y})`,
                            width: `${initialLayout.width}px`,
                        } as CSSProperties}
                    >
                        <svg className="agent-graph-links" viewBox={`0 0 ${initialLayout.width} ${initialLayout.height}`}>
                            <defs>
                                <radialGradient id="agentGraphGlow" cx="50%" cy="50%" r="50%">
                                    <stop offset="0%" stopColor="#d2ad62" stopOpacity="0.32" />
                                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
                                </radialGradient>
                                <marker id="agentGraphArrowOutbound" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
                                    <path d="M 0 0 L 8 4 L 0 8 z" fill="context-stroke" />
                                </marker>
                                <marker id="agentGraphArrowInbound" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
                                    <path d="M 0 0 L 8 4 L 0 8 z" fill="context-stroke" />
                                </marker>
                                <marker id="agentGraphArrowEntry" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
                                    <path d="M 0 0 L 8 4 L 0 8 z" fill="context-stroke" />
                                </marker>
                            </defs>
                            {visibleLinks.map((link, index) => {
                                const source = nodeMap.get(link.source)
                                const target = nodeMap.get(link.target)
                                if (!source || !target) return null
                                const highlighted = hoveredNodeId && (link.source === hoveredNodeId || link.target === hoveredNodeId)
                                const flowClass = graphLinkFlowClass(link)
                                return (
                                    <path
                                        className={`agent-graph-link agent-graph-link-${link.type} ${flowClass} ${highlighted ? 'is-highlighted' : ''} ${hoveredNodeId && !highlighted ? 'is-dimmed' : ''}`}
                                        d={graphLinkPath(source, target, link)}
                                        key={link.id}
                                        markerEnd={graphLinkMarker(flowClass)}
                                        style={{
                                            '--link-color': link.accent || source.accent || target.accent || '#4A9EFF',
                                            '--link-delay': `${index * 0.05}s`,
                                        } as CSSProperties}
                                    />
                                )
                            })}
                            {visibleLinks.map((link, index) => {
                                const source = nodeMap.get(link.source)
                                const target = nodeMap.get(link.target)
                                if (!source || !target) return null
                                const highlighted = hoveredNodeId && (link.source === hoveredNodeId || link.target === hoveredNodeId)
                                const isDimmed = Boolean(hoveredNodeId && !highlighted)
                                return (
                                    <circle
                                        className={`agent-graph-particle ${isDimmed ? 'is-dimmed' : ''}`}
                                        key={`particle-${link.id}`}
                                        r={index % 3 === 0 ? 3.8 : 3}
                                        style={{
                                            '--particle-color': link.accent || source.accent || target.accent || '#4A9EFF',
                                        } as CSSProperties}
                                    >
                                        <animateMotion
                                            begin={`${index * 0.09}s`}
                                            dur={`${5.4 + (index % 6) * 0.35}s`}
                                            path={graphLinkPath(source, target, link)}
                                            repeatCount="indefinite"
                                        />
                                    </circle>
                                )
                            })}
                            {visibleLinks
                                .filter(link => link.type === 'agent' || link.type === 'return' || link.type === 'sector')
                                .map((link, index) => {
                                    const source = nodeMap.get(link.source)
                                    const target = nodeMap.get(link.target)
                                    if (!source || !target) return null
                                    const highlighted = hoveredNodeId && (link.source === hoveredNodeId || link.target === hoveredNodeId)
                                    const isDimmed = Boolean(hoveredNodeId && !highlighted)
                                    return (
                                        <circle
                                            className={`agent-graph-gold-particle ${isDimmed ? 'is-dimmed' : ''}`}
                                            key={`gold-particle-${link.id}`}
                                            r={5.4}
                                        >
                                            <animateMotion
                                                begin={`${index * 0.22}s`}
                                                dur={`${7.2 + (index % 5) * 0.5}s`}
                                                path={graphLinkPath(source, target, link)}
                                                repeatCount="indefinite"
                                            />
                                        </circle>
                                    )
                                })}
                            <circle className="agent-graph-center-glow" cx={nodeMap.get(CENTRAL_NODE_ID)?.x || CENTER.x} cy={nodeMap.get(CENTRAL_NODE_ID)?.y || CENTER.y} r="245" />
                        </svg>

                        <div className="agent-graph-hud">
                            <span><Sparkles size={14} /> {nodes.length} nos vivos</span>
                            <span>{initialLayout.links.length} conexoes</span>
                        </div>

                        <div className="agent-graph-legend" aria-label="Legenda do mapa vivo">
                            <span><i style={{ '--legend-color': GRAPH_ACCENTS[0] } as CSSProperties} />Direcao</span>
                            <span><i style={{ '--legend-color': GRAPH_ACCENTS[1] } as CSSProperties} />Comercial</span>
                            <span><i style={{ '--legend-color': GRAPH_ACCENTS[2] } as CSSProperties} />Marketing</span>
                            <span><i style={{ '--legend-color': GRAPH_ACCENTS[3] } as CSSProperties} />Operacoes</span>
                        </div>

                        {visibleNodes.map((node, index) => (
                            <GraphNodeView
                                focusClass={nodeFocusClass(node.id)}
                                isCollapsed={collapsedNodeIds.has(node.id)}
                                isDragging={dragging?.id === node.id}
                                key={node.id}
                                node={node}
                                nodeDelay={index}
                                onHover={setHoveredNodeId}
                                onNodeClick={handleNodeClick}
                                onPointerDown={startDrag}
                            />
                        ))}
                    </div>
                </div>
            </section>
        </div>
    )
}
