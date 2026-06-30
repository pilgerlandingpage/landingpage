'use client'

import { useEffect, useMemo, useState } from 'react'
import {
    Bot,
    BrainCircuit,
    CheckCircle2,
    FileSearch,
    Loader2,
    MapPin,
    Megaphone,
    MessageCircle,
    Newspaper,
    RefreshCw,
    Search,
    Sparkles,
    TrendingUp,
    UsersRound,
} from 'lucide-react'

type AgentKey = 'global' | 'blog' | 'news' | 'whatsapp' | 'radar' | 'traffic' | 'ceo' | 'recruiting'

type EcosystemResponse = {
    context?: any
    snapshots?: any[]
    error?: string
}

const agents: Array<{ key: AgentKey; label: string; icon: any; description: string }> = [
    { key: 'global', label: 'Global', icon: BrainCircuit, description: 'Visao geral do ecossistema.' },
    { key: 'blog', label: 'Blog', icon: Newspaper, description: 'SEO, pautas e duvidas dos leads.' },
    { key: 'news', label: 'Noticias', icon: FileSearch, description: 'Cidades, prefeitura, economia e eventos.' },
    { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, description: 'Atendimento, historico e intencao do lead.' },
    { key: 'radar', label: 'Radar', icon: TrendingUp, description: 'Termos quentes e oportunidades de mercado.' },
    { key: 'traffic', label: 'Trafego', icon: Megaphone, description: 'Pago, organico, criativos e conversao.' },
    { key: 'ceo', label: 'CEO', icon: Bot, description: 'Resumo executivo para decisao.' },
    { key: 'recruiting', label: 'Corretores', icon: UsersRound, description: 'Candidatos do Trabalhe Conosco e potencial de parceria.' },
]

function formatDate(value?: string) {
    if (!value) return ''
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value))
}

function kpiValue(value: unknown) {
    const n = Number(value || 0)
    if (!Number.isFinite(n)) return '0'
    return n.toLocaleString('pt-BR')
}

function sourceLabel(key: string) {
    const map: Record<string, string> = {
        leads: 'Leads',
        visitors: 'Visitantes',
        funnel_events: 'Eventos',
        properties: 'Imoveis',
        landing_pages: 'Landing pages',
        market_radar_insights: 'Radar',
        ai_research_reports: 'Pesquisa profunda',
        ad_campaigns: 'Campanhas',
        ad_metrics_snapshots: 'Metricas pagas',
        blog_posts: 'Blog',
        whatsapp_ai_conversations: 'Conversas',
        organic_social_media: 'Organico',
        marketing_creatives: 'Criativos',
        broker_candidates: 'Candidatos corretores',
        broker_attendance_daily_history: 'Historico dos corretores',
        ecosystem_events: 'Eventos da Central',
    }
    return map[key] || key
}

export default function AdminIntelligencePage() {
    const [agent, setAgent] = useState<AgentKey>('global')
    const [data, setData] = useState<EcosystemResponse>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')

    const context = data.context || {}
    const signals = context.signals || {}
    const overview = signals.overview || {}
    const sourceCounts = context.source_counts || {}
    const snapshots = data.snapshots || []
    const activeAgent = agents.find(item => item.key === agent) || agents[0]
    const ActiveAgentIcon = activeAgent.icon

    async function fetchContext(nextAgent = agent) {
        setLoading(true)
        setMessage('')
        try {
            const response = await fetch(`/api/admin/intelligence?agent=${nextAgent}&days=30&limit=100`, { cache: 'no-store' })
            const json = await response.json()
            if (!response.ok) throw new Error(json?.error || 'Erro ao carregar a inteligencia.')
            setData(json)
        } catch (error: any) {
            setMessage(error?.message || 'Erro ao carregar a inteligencia.')
        } finally {
            setLoading(false)
        }
    }

    async function saveSnapshot(runCycle = false) {
        setSaving(true)
        setMessage(runCycle ? 'Gerando snapshots para todos os agentes...' : 'Salvando snapshot do agente...')
        try {
            const response = await fetch('/api/admin/intelligence', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(runCycle ? { action: 'run_cycle', days: 30 } : { agent, days: 30, limit: 100 }),
            })
            const json = await response.json()
            if (!response.ok) throw new Error(json?.error || 'Erro ao salvar snapshot.')
            setMessage(runCycle ? 'Ciclo de inteligencia gerado.' : 'Snapshot salvo.')
            await fetchContext(agent)
        } catch (error: any) {
            setMessage(error?.message || 'Erro ao salvar snapshot.')
        } finally {
            setSaving(false)
        }
    }

    useEffect(() => {
        void fetchContext(agent)
    }, [agent])

    const kpis = useMemo(() => [
        { label: 'Leads', value: overview.leads },
        { label: 'Visitantes', value: overview.visitors },
        { label: 'Eventos', value: overview.events },
        { label: 'Imoveis', value: overview.properties },
        { label: 'WhatsApp', value: overview.whatsapp_events },
        { label: 'Pesquisas', value: overview.completed_research },
        { label: 'Corretores', value: overview.broker_candidates },
        { label: 'Relatorios corretor', value: overview.broker_attendance_reports },
        { label: 'Eventos IA', value: overview.ecosystem_events },
    ], [overview])

    const topLists = [
        { title: 'Cidades com sinal', icon: MapPin, items: signals.top_lead_cities || [] },
        { title: 'Buscas e filtros', icon: Search, items: signals.top_search_terms || [] },
        { title: 'Paginas visitadas', icon: FileSearch, items: signals.top_pages || [] },
        { title: 'Fontes de trafego', icon: Megaphone, items: signals.traffic_sources || [] },
        { title: 'Cidades dos corretores', icon: UsersRound, items: signals.broker_candidate_cities || [] },
        { title: 'Origem dos corretores', icon: UsersRound, items: signals.broker_candidate_sources || [] },
    ]

    return (
        <div className="intelligence-page">
            <div className="admin-header intelligence-header">
                <div>
                    <h1>Central de Inteligencia Pilger</h1>
                    <p>Uma memoria sincronizada para Blog, Noticias, WhatsApp, Radar, Trafego e CEO trabalharem com os mesmos sinais.</p>
                </div>
                <div className="intelligence-actions">
                    <button className="btn" onClick={() => fetchContext(agent)} disabled={loading || saving}>
                        {loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
                        Atualizar
                    </button>
                    <button className="btn btn-gold" onClick={() => saveSnapshot(true)} disabled={loading || saving}>
                        {saving ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
                        Sincronizar agentes
                    </button>
                </div>
            </div>

            <section className="intelligence-phases chart-card">
                {[
                    'Eventos padronizados',
                    'Identidade do lead',
                    'Contexto compartilhado',
                    'Snapshots automaticos',
                    'Painel de decisao',
                ].map((label, index) => (
                    <div key={label}>
                        <CheckCircle2 size={16} />
                        <span>Fase {index + 1}</span>
                        <strong>{label}</strong>
                    </div>
                ))}
            </section>

            {message && <div className="intelligence-message">{message}</div>}

            <section className="intelligence-agent-tabs">
                {agents.map(item => {
                    const Icon = item.icon
                    return (
                        <button
                            key={item.key}
                            type="button"
                            className={agent === item.key ? 'active' : ''}
                            onClick={() => setAgent(item.key)}
                        >
                            <Icon size={16} />
                            {item.label}
                        </button>
                    )
                })}
            </section>

            <section className="intelligence-agent-card chart-card">
                <div>
                    <span>Agente em foco</span>
                    <h2><ActiveAgentIcon size={20} /> {activeAgent.label}</h2>
                    <p>{activeAgent.description}</p>
                </div>
                <div className="intelligence-summary">
                    {loading ? 'Carregando memoria do ecossistema...' : (context.executive_summary || 'Sem resumo ainda.')}
                </div>
            </section>

            <section className="intelligence-kpis">
                {kpis.map(item => (
                    <article key={item.label}>
                        <span>{item.label}</span>
                        <strong>{kpiValue(item.value)}</strong>
                    </article>
                ))}
            </section>

            <section className="intelligence-grid">
                <aside className="intelligence-list chart-card">
                    <div className="intelligence-list-head">
                        <div>
                            <span>Snapshots</span>
                            <strong>Memoria recente</strong>
                        </div>
                        <small>{snapshots.length}</small>
                    </div>
                    {snapshots.length === 0 ? (
                        <div className="intelligence-empty">Nenhum snapshot salvo ainda.</div>
                    ) : snapshots.map(snapshot => (
                        <div className="intelligence-snapshot" key={snapshot.id}>
                            <strong>{snapshot.agent}</strong>
                            <span>{snapshot.summary || 'Snapshot sem resumo.'}</span>
                            <small>{formatDate(snapshot.generated_at)}</small>
                        </div>
                    ))}
                </aside>

                <main className="intelligence-detail">
                    <section className="intelligence-source-grid">
                        {Object.entries(sourceCounts).map(([key, value]) => (
                            <article key={key}>
                                <span>{sourceLabel(key)}</span>
                                <strong>{kpiValue(value)}</strong>
                            </article>
                        ))}
                    </section>

                    <section className="intelligence-signal-grid">
                        {topLists.map(list => {
                            const Icon = list.icon
                            return (
                                <article className="chart-card" key={list.title}>
                                    <h3><Icon size={17} /> {list.title}</h3>
                                    {list.items.length === 0 ? (
                                        <p className="muted">Sem sinal suficiente.</p>
                                    ) : (
                                        <ul>
                                            {list.items.slice(0, 7).map((item: any, index: number) => (
                                                <li key={`${list.title}-${index}`}>
                                                    <span>{item.label}</span>
                                                    <strong>{item.count}</strong>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </article>
                            )
                        })}
                    </section>

                    <section className="intelligence-signal-grid">
                        <article className="chart-card">
                            <h3><Sparkles size={17} /> Imoveis quentes</h3>
                            {(signals.hot_properties || []).length === 0 ? (
                                <p className="muted">Sem interacoes suficientes.</p>
                            ) : (
                                <ul>
                                    {signals.hot_properties.slice(0, 7).map((item: any) => (
                                        <li key={item.property_id}>
                                            <span>{item.title}</span>
                                            <strong>{item.score}</strong>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </article>
                        <article className="chart-card">
                            <h3><FileSearch size={17} /> Pesquisa e radar</h3>
                            {(signals.latest_research || []).slice(0, 4).map((item: any) => (
                                <div className="intelligence-research-item" key={item.id}>
                                    <strong>{item.topic}</strong>
                                    <span>{item.summary || 'Pesquisa concluida.'}</span>
                                </div>
                            ))}
                            {(signals.radar_opportunities || []).slice(0, 4).map((item: any, index: number) => (
                                <div className="intelligence-research-item" key={`${item.keyword}-${index}`}>
                                    <strong>{item.keyword}</strong>
                                    <span>{item.summary || 'Oportunidade monitorada pelo radar.'}</span>
                                </div>
                            ))}
                        </article>
                        <article className="chart-card">
                            <h3><BrainCircuit size={17} /> Eventos dos agentes</h3>
                            {(signals.recent_ecosystem_events || []).length === 0 ? (
                                <p className="muted">Nenhum evento recente dos agentes.</p>
                            ) : (
                                <ul>
                                    {(signals.recent_ecosystem_events || []).slice(0, 7).map((item: any, index: number) => (
                                        <li key={`${item.event_type}-${item.entity_id || index}`}>
                                            <span>{item.label || item.event_type}</span>
                                            <strong>{item.source || item.actor_type || 'IA'}</strong>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </article>
                    </section>
                </main>
            </section>

            <style jsx>{`
                .intelligence-page { display: grid; gap: 18px; }
                .intelligence-header { align-items: flex-start; display: flex; gap: 18px; justify-content: space-between; }
                .intelligence-header p { color: var(--text-muted); margin: 6px 0 0; max-width: 760px; }
                .intelligence-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; }
                .intelligence-phases { display: grid; gap: 10px; grid-template-columns: repeat(5, minmax(0, 1fr)); padding: 14px; }
                .intelligence-phases div { align-items: center; background: #fff; border: 1px solid rgba(201,169,110,.18); border-radius: 12px; display: grid; gap: 4px; padding: 12px; }
                .intelligence-phases svg { color: #16a34a; }
                .intelligence-phases span { color: var(--gold-dark); font-size: .68rem; font-weight: 950; letter-spacing: .1em; text-transform: uppercase; }
                .intelligence-phases strong { font-size: .84rem; }
                .intelligence-message { background: rgba(201,169,110,.1); border: 1px solid rgba(201,169,110,.24); border-radius: 12px; color: var(--gold-dark); font-weight: 900; padding: 12px 14px; }
                .intelligence-agent-tabs { display: flex; flex-wrap: wrap; gap: 8px; }
                .intelligence-agent-tabs button { align-items: center; background: #fff; border: 1px solid var(--border); border-radius: 999px; cursor: pointer; display: inline-flex; font-weight: 900; gap: 7px; padding: 9px 13px; }
                .intelligence-agent-tabs button.active { background: #171512; border-color: #171512; color: #fff; }
                .intelligence-agent-card { align-items: center; display: grid; gap: 16px; grid-template-columns: 330px minmax(0, 1fr); padding: 18px; }
                .intelligence-agent-card span { color: var(--gold-dark); font-size: .7rem; font-weight: 950; letter-spacing: .13em; text-transform: uppercase; }
                .intelligence-agent-card h2 { align-items: center; display: flex; gap: 8px; margin: 4px 0 6px; }
                .intelligence-agent-card p { color: var(--text-muted); margin: 0; }
                .intelligence-summary { background: #faf8f3; border: 1px solid rgba(201,169,110,.2); border-radius: 12px; color: var(--text-secondary); line-height: 1.55; padding: 14px; }
                .intelligence-kpis { display: grid; gap: 12px; grid-template-columns: repeat(6, minmax(0, 1fr)); }
                .intelligence-kpis article, .intelligence-source-grid article { background: #fff; border: 1px solid var(--border); border-radius: 14px; display: grid; gap: 4px; padding: 14px; }
                .intelligence-kpis span, .intelligence-source-grid span { color: var(--text-muted); font-size: .7rem; font-weight: 950; letter-spacing: .08em; text-transform: uppercase; }
                .intelligence-kpis strong, .intelligence-source-grid strong { font-family: var(--font-serif); font-size: 1.45rem; }
                .intelligence-grid { align-items: start; display: grid; gap: 16px; grid-template-columns: 360px minmax(0, 1fr); }
                .intelligence-list { display: grid; gap: 8px; max-height: 740px; overflow: auto; padding: 10px; }
                .intelligence-list-head { align-items: center; background: linear-gradient(135deg, #171512, #33291d); border-radius: 12px; color: #fff; display: flex; justify-content: space-between; padding: 12px; }
                .intelligence-list-head div { display: grid; gap: 2px; }
                .intelligence-list-head span { color: #d4b476; font-size: .68rem; font-weight: 950; letter-spacing: .14em; text-transform: uppercase; }
                .intelligence-list-head small { align-items: center; background: rgba(255,255,255,.12); border-radius: 999px; display: inline-flex; font-weight: 900; height: 32px; justify-content: center; min-width: 32px; padding: 0 10px; }
                .intelligence-snapshot { background: #faf8f3; border: 1px solid rgba(201,169,110,.16); border-radius: 12px; display: grid; gap: 5px; padding: 11px; }
                .intelligence-snapshot strong { text-transform: capitalize; }
                .intelligence-snapshot span { color: var(--text-secondary); display: -webkit-box; font-size: .82rem; line-height: 1.35; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
                .intelligence-snapshot small { color: var(--text-muted); font-weight: 800; }
                .intelligence-empty { align-items: center; background: #faf8f3; border: 1px dashed rgba(201,169,110,.35); border-radius: 12px; color: var(--text-muted); display: flex; justify-content: center; min-height: 120px; padding: 14px; text-align: center; }
                .intelligence-detail { display: grid; gap: 14px; }
                .intelligence-source-grid { display: grid; gap: 10px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
                .intelligence-signal-grid { display: grid; gap: 14px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
                .intelligence-signal-grid .chart-card { padding: 15px; }
                .intelligence-signal-grid h3 { align-items: center; display: flex; gap: 8px; margin: 0 0 12px; }
                .intelligence-signal-grid ul { display: grid; gap: 8px; list-style: none; margin: 0; padding: 0; }
                .intelligence-signal-grid li { align-items: center; border-bottom: 1px solid rgba(201,169,110,.16); display: flex; gap: 10px; justify-content: space-between; padding-bottom: 8px; }
                .intelligence-signal-grid li span { color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .intelligence-signal-grid li strong { color: var(--gold-dark); }
                .intelligence-research-item { border-bottom: 1px solid rgba(201,169,110,.16); display: grid; gap: 5px; padding: 0 0 10px; margin-bottom: 10px; }
                .intelligence-research-item span { color: var(--text-secondary); display: -webkit-box; font-size: .86rem; line-height: 1.45; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
                .muted { color: var(--text-muted); margin: 0; }
                @media (max-width: 1100px) {
                    .intelligence-header, .intelligence-agent-card { grid-template-columns: 1fr; flex-direction: column; }
                    .intelligence-phases, .intelligence-kpis, .intelligence-grid, .intelligence-source-grid, .intelligence-signal-grid { grid-template-columns: 1fr; }
                    .intelligence-actions { justify-content: flex-start; }
                }
            `}</style>
        </div>
    )
}
