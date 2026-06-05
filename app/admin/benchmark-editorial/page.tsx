'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
    Archive,
    Bot,
    ExternalLink,
    FileText,
    Globe2,
    Loader2,
    Newspaper,
    Plus,
    Search,
    Sparkles,
    Target,
    Trash2,
} from 'lucide-react'
import {
    BenchmarkCompetitor,
    BenchmarkIntent,
    BenchmarkKeyword,
    BenchmarkOpportunity,
    BenchmarkRun,
} from '@/lib/benchmark-editorial/defaults'

type BenchmarkHealth = {
    competitors: number
    keywords: number
    opportunities: number
    lastRun?: string | null
}

type BenchmarkState = {
    competitors: BenchmarkCompetitor[]
    keywords: BenchmarkKeyword[]
    opportunities: BenchmarkOpportunity[]
    runs: BenchmarkRun[]
    health?: BenchmarkHealth
}

type ActionState = {
    status: 'idle' | 'running' | 'success' | 'error'
    message: string
}

const emptyCompetitor = {
    name: '',
    site_url: '',
    focus: '',
    status: 'active',
    priority: 50,
}

const emptyKeyword = {
    term: '',
    region: '',
    intent: 'both',
    priority: 'media',
    status: 'active',
}

function formatDate(value?: string | null) {
    if (!value) return 'Ainda nao executado'
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value))
}

function domainFromUrl(url?: string) {
    if (!url) return ''
    try {
        return new URL(url).hostname.replace(/^www\./, '')
    } catch {
        return url
    }
}

function statusLabel(status: string) {
    if (status === 'sent_to_blog') return 'Enviado para Blog'
    if (status === 'sent_to_news') return 'Enviado para Noticias'
    if (status === 'archived') return 'Arquivado'
    if (status === 'briefed') return 'Briefing pronto'
    return 'Novo'
}

export default function BenchmarkEditorialPage() {
    const [state, setState] = useState<BenchmarkState>({
        competitors: [],
        keywords: [],
        opportunities: [],
        runs: [],
    })
    const [topic, setTopic] = useState('')
    const [intent, setIntent] = useState<BenchmarkIntent>('both')
    const [depth, setDepth] = useState('media')
    const [competitorForm, setCompetitorForm] = useState(emptyCompetitor)
    const [keywordForm, setKeywordForm] = useState(emptyKeyword)
    const [loading, setLoading] = useState(true)
    const [action, setAction] = useState<ActionState>({ status: 'idle', message: '' })

    const activeCompetitors = useMemo(
        () => state.competitors.filter(item => item.status === 'active'),
        [state.competitors]
    )
    const activeKeywords = useMemo(
        () => state.keywords.filter(item => item.status === 'active'),
        [state.keywords]
    )
    const topOpportunities = useMemo(
        () => state.opportunities.filter(item => item.status !== 'archived'),
        [state.opportunities]
    )

    const load = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/benchmark-editorial', { cache: 'no-store' })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || 'Falha ao carregar Benchmark Editorial.')
            setState({
                competitors: data.competitors || [],
                keywords: data.keywords || [],
                opportunities: data.opportunities || [],
                runs: data.runs || [],
                health: data.health,
            })
        } catch (error: any) {
            setAction({ status: 'error', message: error?.message || String(error) })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    const postAction = async (body: Record<string, unknown>, successMessage: string) => {
        setAction({ status: 'running', message: 'Processando...' })
        const res = await fetch('/api/admin/benchmark-editorial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Operacao nao concluida.')
        await load()
        setAction({ status: 'success', message: successMessage })
        return data
    }

    const runBenchmark = async (event: FormEvent) => {
        event.preventDefault()
        try {
            await postAction({ action: 'run_benchmark', topic, intent, depth }, 'Varredura da Lara concluida. Inteligencia registrada para Clara e Isadora.')
            setTopic('')
        } catch (error: any) {
            setAction({ status: 'error', message: error?.message || String(error) })
        }
    }

    const saveCompetitor = async (event: FormEvent) => {
        event.preventDefault()
        try {
            await postAction({ action: 'save_competitor', competitor: competitorForm }, 'Fonte salva para monitoramento da Lara.')
            setCompetitorForm(emptyCompetitor)
        } catch (error: any) {
            setAction({ status: 'error', message: error?.message || String(error) })
        }
    }

    const saveKeyword = async (event: FormEvent) => {
        event.preventDefault()
        try {
            await postAction({ action: 'save_keyword', keyword: keywordForm }, 'Termo salvo para monitoramento.')
            setKeywordForm(emptyKeyword)
        } catch (error: any) {
            setAction({ status: 'error', message: error?.message || String(error) })
        }
    }

    const sendOpportunity = async (id: string, target: 'blog' | 'news') => {
        try {
            await postAction(
                { action: target === 'blog' ? 'send_to_blog' : 'send_to_news', id },
                target === 'blog' ? 'Isadora gerou um artigo em analise a partir da Lara.' : 'Clara gerou uma noticia em analise a partir da Lara.'
            )
        } catch (error: any) {
            setAction({ status: 'error', message: error?.message || String(error) })
        }
    }

    const removeItem = async (id: string, actionName: string, message: string) => {
        try {
            await postAction({ action: actionName, id }, message)
        } catch (error: any) {
            setAction({ status: 'error', message: error?.message || String(error) })
        }
    }

    return (
        <div className="benchmark-page">
            <header className="admin-header benchmark-header">
                <div>
                    <span><Bot size={15} /> Inteligencia competitiva</span>
                    <h1>Benchmark Editorial</h1>
                    <p>Lara monitora portais, concorrentes, rankings organicos e respostas de IA, registra a inteligencia e deixa material para Clara e Isadora trabalharem.</p>
                </div>
                <button type="button" className="btn btn-outline" onClick={load} disabled={loading}>
                    {loading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
                    Atualizar
                </button>
            </header>

            <section className="benchmark-command admin-card">
                <div>
                    <span>Rodar agora</span>
                    <h2><Sparkles size={20} /> Rodar varredura competitiva</h2>
                    <p>Use um tema especifico ou deixe vazio para a Lara escolher o termo monitorado mais importante e mapear fontes, lacunas e oportunidades.</p>
                </div>
                <form onSubmit={runBenchmark} className="benchmark-run-form">
                    <input
                        value={topic}
                        onChange={event => setTopic(event.target.value)}
                        placeholder="Tema opcional: ex. apartamentos frente mar em Itapema"
                    />
                    <select value={intent} onChange={event => setIntent(event.target.value as BenchmarkIntent)}>
                        <option value="both">Blog ou Noticias</option>
                        <option value="blog">Blog</option>
                        <option value="news">Noticias</option>
                    </select>
                    <select value={depth} onChange={event => setDepth(event.target.value)}>
                        <option value="leve">Leve</option>
                        <option value="media">Media</option>
                        <option value="profunda">Profunda</option>
                    </select>
                    <button type="submit" disabled={action.status === 'running'}>
                        {action.status === 'running' ? <Loader2 size={16} className="spin" /> : <Target size={16} />}
                        Rodar benchmark
                    </button>
                </form>
            </section>

            {action.message && (
                <div className={`benchmark-message ${action.status}`}>
                    {action.status === 'running' ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
                    {action.message}
                </div>
            )}

            <section className="benchmark-kpis">
                <div><span>Fontes ativas</span><strong>{activeCompetitors.length}</strong></div>
                <div><span>Consultas ativas</span><strong>{activeKeywords.length}</strong></div>
                <div><span>Oportunidades abertas</span><strong>{topOpportunities.length}</strong></div>
                <div><span>Ultima execucao</span><strong>{formatDate(state.runs[0]?.created_at)}</strong></div>
            </section>

            <section className="benchmark-grid">
                <div className="admin-card benchmark-panel">
                    <div className="panel-head">
                        <div>
                            <span><Globe2 size={14} /> Portais e fontes</span>
                            <h3>Sites monitorados</h3>
                        </div>
                    </div>
                    <form onSubmit={saveCompetitor} className="compact-form">
                        <input value={competitorForm.name} onChange={event => setCompetitorForm(prev => ({ ...prev, name: event.target.value }))} placeholder="Nome" />
                        <input value={competitorForm.site_url} onChange={event => setCompetitorForm(prev => ({ ...prev, site_url: event.target.value }))} placeholder="https://site.com.br" />
                        <input value={competitorForm.focus} onChange={event => setCompetitorForm(prev => ({ ...prev, focus: event.target.value }))} placeholder="Foco: luxo, SERP, IA, bairro..." />
                        <button type="submit"><Plus size={15} /> Adicionar</button>
                    </form>
                    <div className="mini-list">
                        {state.competitors.length === 0 && <p>Nenhum portal ou fonte cadastrado ainda.</p>}
                        {state.competitors.map(item => (
                            <article key={item.id}>
                                <div>
                                    <strong>{item.name}</strong>
                                    <a href={item.site_url} target="_blank" rel="noreferrer">{domainFromUrl(item.site_url)} <ExternalLink size={12} /></a>
                                    {item.focus && <small>{item.focus}</small>}
                                </div>
                                <button type="button" onClick={() => removeItem(item.id, 'delete_competitor', 'Fonte pausada ou removida.')}>
                                    <Trash2 size={14} />
                                </button>
                            </article>
                        ))}
                    </div>
                </div>

                <div className="admin-card benchmark-panel">
                    <div className="panel-head">
                        <div>
                            <span><Search size={14} /> Consultas</span>
                            <h3>Buscas monitoradas</h3>
                        </div>
                    </div>
                    <form onSubmit={saveKeyword} className="compact-form keyword-form">
                        <input value={keywordForm.term} onChange={event => setKeywordForm(prev => ({ ...prev, term: event.target.value }))} placeholder="Termo de pesquisa" />
                        <input value={keywordForm.region} onChange={event => setKeywordForm(prev => ({ ...prev, region: event.target.value }))} placeholder="Regiao" />
                        <select value={keywordForm.intent} onChange={event => setKeywordForm(prev => ({ ...prev, intent: event.target.value }))}>
                            <option value="both">Blog ou Noticias</option>
                            <option value="blog">Blog</option>
                            <option value="news">Noticias</option>
                        </select>
                        <select value={keywordForm.priority} onChange={event => setKeywordForm(prev => ({ ...prev, priority: event.target.value }))}>
                            <option value="alta">Alta</option>
                            <option value="media">Media</option>
                            <option value="baixa">Baixa</option>
                        </select>
                        <button type="submit"><Plus size={15} /> Adicionar</button>
                    </form>
                    <div className="mini-list keywords">
                        {state.keywords.length === 0 && <p>Nenhum termo cadastrado ainda.</p>}
                        {state.keywords.map(item => (
                            <article key={item.id}>
                                <div>
                                    <strong>{item.term}</strong>
                                    <span>{item.region || 'sem regiao'} - {item.intent} - prioridade {item.priority}</span>
                                </div>
                                <button type="button" onClick={() => removeItem(item.id, 'delete_keyword', 'Consulta pausada ou removida.')}>
                                    <Trash2 size={14} />
                                </button>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="admin-card opportunities-panel">
                <div className="panel-head">
                    <div>
                        <span><Target size={14} /> Oportunidades</span>
                        <h3>Material pronto para Clara e Isadora</h3>
                    </div>
                </div>
                <div className="opportunity-list">
                    {loading ? (
                        <div className="empty-state"><Loader2 className="spin" /> Carregando benchmark...</div>
                    ) : topOpportunities.length === 0 ? (
                        <div className="empty-state">Rode a primeira varredura para a Lara registrar inteligencia e entregar material.</div>
                    ) : topOpportunities.map(item => (
                        <article key={item.id} className="opportunity-card">
                            <div className="opportunity-score">
                                <strong>{item.opportunity_score}</strong>
                                <span>score</span>
                            </div>
                            <div className="opportunity-body">
                                <div className="opportunity-meta">
                                    <span>{statusLabel(item.status)}</span>
                                    <span>{item.format}</span>
                                    <span>{formatDate(item.created_at)}</span>
                                </div>
                                <h4>{item.title}</h4>
                                <p>{item.summary}</p>
                                <div className="source-row">
                                    {item.source_url ? (
                                        <a href={item.source_url} target="_blank" rel="noreferrer">
                                            {item.source_domain || domainFromUrl(item.source_url)}
                                            <ExternalLink size={13} />
                                        </a>
                                    ) : (
                                        <span>Sem fonte principal</span>
                                    )}
                                    {item.queries.slice(0, 4).map(query => <small key={query}>{query}</small>)}
                                </div>
                            </div>
                            <div className="opportunity-actions">
                                <button type="button" onClick={() => sendOpportunity(item.id, 'blog')} disabled={item.status === 'sent_to_blog'}>
                                    <FileText size={15} /> Isadora
                                </button>
                                <button type="button" onClick={() => sendOpportunity(item.id, 'news')} disabled={item.status === 'sent_to_news'}>
                                    <Newspaper size={15} /> Clara
                                </button>
                                <button type="button" className="ghost" onClick={() => removeItem(item.id, 'archive_opportunity', 'Oportunidade arquivada.')}>
                                    <Archive size={15} />
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            <style jsx>{`
                .benchmark-page { display: grid; gap: 16px; }
                .benchmark-header { align-items: flex-start; display: flex; gap: 16px; justify-content: space-between; }
                .benchmark-header span, .benchmark-command span, .panel-head span {
                    align-items: center; color: var(--gold-dark); display: inline-flex; font-size: .7rem; font-weight: 950; gap: 6px; letter-spacing: .13em; text-transform: uppercase;
                }
                .benchmark-header p, .benchmark-command p { color: var(--text-muted); margin: 6px 0 0; max-width: 760px; }
                .benchmark-command { align-items: center; display: grid; gap: 16px; grid-template-columns: minmax(0, .9fr) minmax(420px, 1.1fr); padding: 18px; }
                .benchmark-command h2, .panel-head h3 { align-items: center; display: flex; gap: 8px; margin: 5px 0 0; }
                .benchmark-run-form { display: grid; gap: 9px; grid-template-columns: minmax(0, 1fr) 145px 120px auto; }
                input, select {
                    background: #fff; border: 1px solid var(--border); border-radius: 10px; color: var(--text-primary); font: inherit; padding: 10px 12px; width: 100%;
                }
                button {
                    align-items: center; border: 0; border-radius: 10px; cursor: pointer; display: inline-flex; font: inherit; font-weight: 900; gap: 7px; justify-content: center; padding: 10px 13px;
                }
                button:disabled { cursor: wait; opacity: .58; }
                .benchmark-run-form button, .compact-form button { background: #c9a96e; color: #16120d; white-space: nowrap; }
                .btn.btn-outline { background: #fff; border: 1px solid var(--border); color: var(--text-primary); }
                .benchmark-message { align-items: center; border-radius: 12px; display: flex; font-weight: 900; gap: 8px; padding: 12px 14px; }
                .benchmark-message.success { background: rgba(34,197,94,.08); color: #047857; }
                .benchmark-message.error { background: rgba(239,68,68,.08); color: #b91c1c; }
                .benchmark-message.running, .benchmark-message.idle { background: rgba(201,169,110,.1); color: var(--gold-dark); }
                .benchmark-kpis { display: grid; gap: 10px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
                .benchmark-kpis div {
                    background: #fff; border: 1px solid rgba(201,169,110,.2); border-radius: 14px; display: grid; gap: 6px; padding: 14px;
                }
                .benchmark-kpis span { color: var(--text-muted); font-size: .68rem; font-weight: 950; letter-spacing: .1em; text-transform: uppercase; }
                .benchmark-kpis strong { color: var(--text-primary); font-family: var(--font-serif); font-size: 1.28rem; line-height: 1.05; }
                .benchmark-grid { display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
                .benchmark-panel, .opportunities-panel { padding: 16px; }
                .panel-head { align-items: center; display: flex; justify-content: space-between; margin-bottom: 12px; }
                .compact-form { display: grid; gap: 9px; grid-template-columns: minmax(0, .7fr) minmax(0, .9fr) minmax(0, 1fr) auto; margin-bottom: 12px; }
                .keyword-form { grid-template-columns: minmax(0, 1fr) minmax(0, .65fr) 130px 100px auto; }
                .mini-list { display: grid; gap: 8px; max-height: 280px; overflow: auto; }
                .mini-list p, .empty-state { background: #faf8f3; border: 1px dashed rgba(201,169,110,.34); border-radius: 12px; color: var(--text-muted); margin: 0; padding: 18px; text-align: center; }
                .mini-list article {
                    align-items: center; background: #faf8f3; border: 1px solid rgba(201,169,110,.18); border-radius: 12px; display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr) auto; padding: 12px;
                }
                .mini-list article div { display: grid; gap: 3px; min-width: 0; }
                .mini-list strong { font-size: .9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .mini-list a, .mini-list span, .mini-list small {
                    align-items: center; color: var(--text-muted); display: inline-flex; font-size: .78rem; gap: 4px; min-width: 0; overflow: hidden; text-decoration: none; text-overflow: ellipsis; white-space: nowrap;
                }
                .mini-list button, .opportunity-actions .ghost { background: #fff; border: 1px solid var(--border); color: #b91c1c; height: 36px; padding: 0; width: 36px; }
                .opportunity-list { display: grid; gap: 12px; }
                .opportunity-card {
                    align-items: start; background: #fff; border: 1px solid rgba(201,169,110,.18); border-radius: 14px; display: grid; gap: 14px; grid-template-columns: 78px minmax(0, 1fr) auto; padding: 14px;
                }
                .opportunity-score {
                    align-items: center; aspect-ratio: 1 / 1; background: linear-gradient(135deg, #171512, #3d3020); border-radius: 14px; color: #d8b56e; display: grid; justify-items: center; padding: 10px;
                }
                .opportunity-score strong { font-family: var(--font-serif); font-size: 1.55rem; line-height: 1; }
                .opportunity-score span { color: rgba(255,255,255,.65); font-size: .68rem; font-weight: 900; text-transform: uppercase; }
                .opportunity-body { display: grid; gap: 8px; min-width: 0; }
                .opportunity-meta { display: flex; flex-wrap: wrap; gap: 7px; }
                .opportunity-meta span, .source-row small {
                    background: rgba(201,169,110,.12); border-radius: 999px; color: var(--gold-dark); font-size: .68rem; font-weight: 900; padding: 6px 9px; text-transform: uppercase;
                }
                .opportunity-body h4 { font-family: var(--font-serif); font-size: 1.28rem; line-height: 1.12; margin: 0; }
                .opportunity-body p { color: var(--text-secondary); line-height: 1.48; margin: 0; }
                .source-row { align-items: center; display: flex; flex-wrap: wrap; gap: 7px; }
                .source-row a, .source-row > span {
                    align-items: center; background: #faf8f3; border: 1px solid rgba(201,169,110,.2); border-radius: 999px; color: var(--text-secondary); display: inline-flex; font-size: .78rem; font-weight: 900; gap: 5px; padding: 7px 10px; text-decoration: none;
                }
                .opportunity-actions { display: grid; gap: 8px; justify-items: stretch; min-width: 140px; }
                .opportunity-actions button { background: #171512; color: #fff; }
                .opportunity-actions button:nth-child(2) { background: #c9a96e; color: #16120d; }
                .empty-state { align-items: center; display: flex; gap: 8px; justify-content: center; min-height: 140px; }
                .spin { animation: spin .9s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
                @media (max-width: 1100px) {
                    .benchmark-command, .benchmark-grid, .benchmark-run-form, .compact-form, .keyword-form { grid-template-columns: 1fr; }
                    .benchmark-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                    .opportunity-card { grid-template-columns: 1fr; }
                    .opportunity-score { aspect-ratio: auto; display: flex; gap: 7px; justify-content: flex-start; }
                    .opportunity-actions { grid-template-columns: repeat(3, minmax(0, 1fr)); min-width: 0; }
                }
                @media (max-width: 640px) {
                    .benchmark-header { display: grid; }
                    .benchmark-kpis { grid-template-columns: 1fr; }
                    .opportunity-actions { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    )
}
