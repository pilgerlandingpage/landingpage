'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
    Bot,
    CheckCircle2,
    Clipboard,
    ExternalLink,
    FileText,
    Layers,
    Loader2,
    Megaphone,
    Newspaper,
    RadioTower,
    Search,
    Sparkles,
    Trash2,
} from 'lucide-react'
import { markdownToHtml } from '@/lib/blog/markdown'

type ResearchReport = {
    id: string
    topic: string
    requester: string
    status: string
    depth: string
    executive_summary?: string | null
    report_markdown?: string | null
    sources?: Array<{ title: string; uri: string }>
    queries?: string[]
    error_message?: string | null
    created_at: string
}

type ResearchHealth = {
    tableExists: boolean
    enabled: boolean
    provider: string
    depth: string
    geminiKeyConfigured: boolean
    openaiKeyConfigured: boolean
    systemPromptConfigured: boolean
    liveWebSearch: boolean
    activeTopics: number
    scheduledTopics: number
    warnings: string[]
}

type ResearchTab = 'curadoria' | 'fontes' | 'relatorio'
type ActionState = { status: 'idle' | 'running' | 'success' | 'error'; message: string }

function formatDate(value?: string) {
    if (!value) return ''
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value))
}

function getDomain(uri: string) {
    try {
        return new URL(uri).hostname.replace(/^www\./, '')
    } catch {
        return uri
    }
}

function cleanMarkdownLine(value: string) {
    return value
        .replace(/^#{1,6}\s*/, '')
        .replace(/^[-*]\s*/, '')
        .replace(/^\d+\.\s*/, '')
        .replace(/\*\*/g, '')
        .trim()
}

function extractBullets(markdown?: string | null, limit = 8) {
    const lines = String(markdown || '')
        .split(/\r?\n/)
        .map(line => cleanMarkdownLine(line))
        .filter(line => line.length > 38 && line.length < 260)

    return [...new Set(lines)].slice(0, limit)
}

function extractOpportunityLines(markdown?: string | null, queries: string[] = []) {
    const keywords = ['blog', 'noticia', 'noticias', 'trafego', 'campanha', 'oportunidade', 'prefeitura', 'turismo', 'evento', 'imovel', 'mercado', 'investimento']
    const lines = extractBullets(markdown, 80)
        .filter(line => keywords.some(keyword => line.toLowerCase().includes(keyword)))
        .slice(0, 6)

    if (lines.length) return lines
    return queries.slice(0, 6).map(query => `Transformar a busca "${query}" em pauta monitorada para conteudo, trafego ou atendimento.`)
}

function buildResearchDraft(report: ResearchReport, type: 'blog' | 'news') {
    const rankingTitle = type === 'news'
        ? `${report.topic}: contexto e impacto no mercado imobiliario`
        : `${report.topic}: guia para comprar melhor no litoral`
    const opportunities = extractOpportunityLines(report.report_markdown, report.queries || [])
    const sources = report.sources || []
    const sourceLinks = sources
        .slice(0, 12)
        .map(source => `- [${source.title || getDomain(source.uri)}](${source.uri})`)
        .join('\n')

    return {
        title: rankingTitle,
        excerpt: report.executive_summary || '',
        content_markdown: [
            `# ${rankingTitle}`,
            '',
            '## Resumo executivo',
            report.executive_summary || 'Resumo ainda nao disponivel.',
            '',
            '## Oportunidades identificadas',
            ...opportunities.map(item => `- ${item}`),
            '',
            '## Base da pesquisa',
            report.report_markdown || report.error_message || '',
            '',
            sources.length ? '## Fontes consultadas' : '',
            sourceLinks,
        ].filter(Boolean).join('\n'),
        status: 'under_review',
        author_name: 'Research Pilger',
        category: type === 'news' ? 'Noticias' : 'Mercado Imobiliario',
        tags: [...new Set([report.topic, report.depth, 'Pesquisa Profunda IA', type === 'news' ? 'Noticias' : 'Blog', ...(report.queries || []).slice(0, 4)])],
        seo_title: rankingTitle,
        meta_description: String(report.executive_summary || '').slice(0, 280),
        primary_keyword: report.topic,
        secondary_keywords: report.queries || [],
        local_entities: [],
        aeo_questions: [],
        internal_links: [{ label: 'Ver imoveis no mapa', target: '/busca', reason: 'Conectar pesquisa ao estoque ativo.' }],
        source_summary: {
            research_report_id: report.id,
            research_topic: report.topic,
            research_requester: report.requester,
            research_sources_count: sources.length,
            research_queries: report.queries || [],
        },
        approval_notes: [
            'Revisar dados, confirmar atualidade das fontes e adaptar o texto ao tom editorial Pilger antes de publicar.',
        ],
        generated_by: 'research-pilger',
    }
}

export default function AdminResearchPage() {
    const [reports, setReports] = useState<ResearchReport[]>([])
    const [selectedId, setSelectedId] = useState('')
    const [topic, setTopic] = useState('')
    const [depth, setDepth] = useState('media')
    const [health, setHealth] = useState<ResearchHealth | null>(null)
    const [activeTab, setActiveTab] = useState<ResearchTab>('curadoria')
    const [actionState, setActionState] = useState<ActionState>({ status: 'idle', message: '' })
    const [loading, setLoading] = useState(true)
    const [running, setRunning] = useState(false)
    const [message, setMessage] = useState('')

    const selected = useMemo(() => reports.find(report => report.id === selectedId) || reports[0], [reports, selectedId])
    const selectedInsights = useMemo(() => extractBullets(selected?.report_markdown, 6), [selected])
    const selectedOpportunities = useMemo(() => extractOpportunityLines(selected?.report_markdown, selected?.queries || []), [selected])
    const selectedReportHtml = useMemo(() => markdownToHtml(selected?.report_markdown || selected?.error_message || ''), [selected])

    async function fetchReports() {
        setLoading(true)
        try {
            const response = await fetch('/api/admin/research', { cache: 'no-store' })
            const data = await response.json()
            if (!response.ok) throw new Error(data?.error || 'Erro ao carregar pesquisas.')
            setReports(data.reports || [])
            if (!selectedId && data.reports?.[0]) setSelectedId(data.reports[0].id)
        } catch (error: any) {
            setMessage(error?.message || 'Erro ao carregar pesquisas.')
        } finally {
            setLoading(false)
        }
    }

    async function fetchHealth() {
        try {
            const response = await fetch('/api/admin/research/health', { cache: 'no-store' })
            const data = await response.json()
            if (!response.ok) throw new Error(data?.message || 'Erro ao carregar diagnostico.')
            setHealth(data.health || null)
        } catch (error: any) {
            setHealth({
                tableExists: false,
                enabled: false,
                provider: 'indisponivel',
                depth: 'media',
                geminiKeyConfigured: false,
                openaiKeyConfigured: false,
                systemPromptConfigured: false,
                liveWebSearch: false,
                activeTopics: 0,
                scheduledTopics: 0,
                warnings: [error?.message || 'Diagnostico indisponivel.'],
            })
        }
    }

    useEffect(() => {
        void fetchReports()
        void fetchHealth()
    }, [])

    async function runResearch() {
        if (!topic.trim()) {
            setMessage('Informe um tema para pesquisar.')
            return
        }

        setRunning(true)
        setMessage('Research Pilger pesquisando fontes externas...')
        try {
            const response = await fetch('/api/admin/research', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, depth, requester: 'manual' }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data?.error || 'Erro ao pesquisar.')
            setTopic('')
            setMessage('Pesquisa concluida.')
            await fetchReports()
            await fetchHealth()
            setSelectedId(data.report.id)
        } catch (error: any) {
            setMessage(error?.message || 'Erro ao pesquisar.')
        } finally {
            setRunning(false)
        }
    }

    async function deleteReport(id: string) {
        if (!confirm('Remover esta pesquisa?')) return
        try {
            const response = await fetch(`/api/admin/research?id=${id}`, { method: 'DELETE' })
            const data = await response.json()
            if (!response.ok) throw new Error(data?.error || 'Erro ao remover.')
            setReports(current => current.filter(report => report.id !== id))
            setSelectedId('')
            setMessage('Pesquisa removida.')
        } catch (error: any) {
            setMessage(error?.message || 'Erro ao remover.')
        }
    }

    async function createContentDraft(type: 'blog' | 'news') {
        if (!selected) return
        setActionState({ status: 'running', message: type === 'news' ? 'Criando noticia a partir da pesquisa...' : 'Criando pauta de blog a partir da pesquisa...' })
        try {
            const response = await fetch('/api/admin/blog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildResearchDraft(selected, type)),
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(data?.error || 'Nao foi possivel criar o conteudo.')
            setActionState({
                status: 'success',
                message: type === 'news' ? 'Noticia criada em revisao no Blog/Noticias.' : 'Pauta criada em revisao no Blog.',
            })
        } catch (error: any) {
            setActionState({ status: 'error', message: error?.message || 'Erro ao criar conteudo.' })
        }
    }

    async function addToRadar() {
        if (!selected) return
        setActionState({ status: 'running', message: 'Adicionando termo ao Radar de Mercado...' })
        try {
            const response = await fetch('/api/admin/radar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyword: selected.topic, location: 'Santa Catarina' }),
            })
            const data = await response.json().catch(() => ({}))
            if (!response.ok) throw new Error(data?.error || 'Nao foi possivel adicionar ao radar.')
            setActionState({ status: 'success', message: 'Termo adicionado ao Radar de Mercado.' })
        } catch (error: any) {
            setActionState({ status: 'error', message: error?.message || 'Erro ao adicionar ao radar.' })
        }
    }

    async function copySummary() {
        if (!selected) return
        const text = [
            `Pesquisa: ${selected.topic}`,
            selected.executive_summary || '',
            '',
            'Oportunidades:',
            ...selectedOpportunities.map(item => `- ${item}`),
        ].join('\n')
        await navigator.clipboard.writeText(text)
        setActionState({ status: 'success', message: 'Resumo copiado.' })
    }

    return (
        <div className="research-page">
            <div className="admin-header">
                <div>
                    <h1>Pesquisa Profunda IA</h1>
                    <p>Research Pilger investiga fontes externas e entrega contexto para Blog, Radar, CEO e Trafego.</p>
                </div>
            </div>

            <section className="research-command chart-card">
                <div>
                    <span>Agente responsavel</span>
                    <h2><Bot size={19} /> Mateus Pesquisa Externa</h2>
                    <p>Pesquisa web com Gemini Google Search quando o ecossistema esta usando Gemini. O relatorio fica salvo para os outros agentes.</p>
                </div>
                <div className="research-form">
                    <input value={topic} onChange={event => setTopic(event.target.value)} placeholder="Tema: mercado de coberturas frente mar em Balneario Camboriu" />
                    <select value={depth} onChange={event => setDepth(event.target.value)}>
                        <option value="leve">Leve</option>
                        <option value="media">Media</option>
                        <option value="profunda">Profunda</option>
                    </select>
                    <button className="btn btn-gold" onClick={runResearch} disabled={running}>
                        {running ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
                        Pesquisar
                    </button>
                </div>
            </section>

            {health && (
                <section className={`research-health ${health.warnings.length ? 'warning' : 'ok'}`}>
                    <div>
                        <span>Diagnostico</span>
                        <strong>{health.liveWebSearch ? 'Busca web ativa com Gemini' : 'Atencao na Pesquisa Profunda'}</strong>
                    </div>
                    <div className="research-health-grid">
                        <span className={health.tableExists ? 'ok' : 'bad'}>Tabela {health.tableExists ? 'ok' : 'ausente'}</span>
                        <span className={health.enabled ? 'ok' : 'bad'}>{health.enabled ? 'Ativa' : 'Desativada'}</span>
                        <span>Provider {health.provider}</span>
                        <span className={health.geminiKeyConfigured ? 'ok' : 'bad'}>Gemini {health.geminiKeyConfigured ? 'ok' : 'sem chave'}</span>
                        <span>Profundidade {health.depth}</span>
                        <span>{health.activeTopics} temas ativos</span>
                        <span>{health.scheduledTopics} recorrentes</span>
                    </div>
                    {!!health.warnings.length && (
                        <p>{health.warnings.join(' ')}</p>
                    )}
                </section>
            )}

            {message && <div className="research-message">{message}</div>}

            <section className="research-shell">
                <aside className="research-list">
                    <div className="research-list-head">
                        <div>
                            <span>Pesquisas</span>
                            <strong>Todos os temas</strong>
                        </div>
                        <small>{reports.length}</small>
                    </div>
                    <div className="research-list-items">
                        {loading ? (
                            <div className="research-list-empty"><Loader2 className="spin" /> Carregando...</div>
                        ) : reports.length === 0 ? (
                            <div className="research-list-empty">Nenhuma pesquisa ainda.</div>
                        ) : reports.map(report => (
                            <button
                                key={report.id}
                                className={selected?.id === report.id ? 'active' : ''}
                                onClick={() => {
                                    setSelectedId(report.id)
                                    setActiveTab('curadoria')
                                    setActionState({ status: 'idle', message: '' })
                                }}
                            >
                                <div className="research-list-icon">
                                    {report.topic.slice(0, 1).toUpperCase()}
                                </div>
                                <div className="research-list-copy">
                                    <strong>{report.topic}</strong>
                                    <span>{report.status} - {report.depth}</span>
                                    <small>{formatDate(report.created_at)} - {report.sources?.length || 0} fontes</small>
                                </div>
                            </button>
                        ))}
                    </div>
                </aside>

                <main className="research-detail">
                    {selected ? (
                        <>
                            <div className="research-detail-head">
                                <div>
                                    <span>{selected.status} - {selected.requester}</span>
                                    <h2>{selected.topic}</h2>
                                    <p>{selected.executive_summary || selected.error_message || 'Sem resumo ainda.'}</p>
                                </div>
                                <div className="research-detail-actions">
                                    <button className="btn btn-outline" onClick={copySummary}>
                                        <Clipboard size={15} /> Copiar resumo
                                    </button>
                                    <button className="btn btn-outline danger" onClick={() => deleteReport(selected.id)}>
                                        <Trash2 size={15} /> Remover
                                    </button>
                                </div>
                            </div>

                            <div className="research-kpis">
                                <div><span>Fontes</span><strong>{selected.sources?.length || 0}</strong></div>
                                <div><span>Consultas</span><strong>{selected.queries?.length || 0}</strong></div>
                                <div><span>Profundidade</span><strong>{selected.depth}</strong></div>
                                <div><span>Criada em</span><strong>{formatDate(selected.created_at)}</strong></div>
                            </div>

                            <div className="research-action-panel">
                                <button type="button" onClick={() => createContentDraft('blog')} disabled={actionState.status === 'running'}>
                                    <FileText size={16} /> Criar pauta de blog
                                </button>
                                <button type="button" onClick={() => createContentDraft('news')} disabled={actionState.status === 'running'}>
                                    <Newspaper size={16} /> Criar noticia
                                </button>
                                <button type="button" onClick={addToRadar} disabled={actionState.status === 'running'}>
                                    <RadioTower size={16} /> Enviar ao Radar
                                </button>
                                <Link href="/admin/blog">
                                    <Megaphone size={16} /> Ver central de conteudo
                                </Link>
                            </div>

                            {actionState.message && (
                                <div className={`research-action-message ${actionState.status}`}>
                                    {actionState.status === 'running' ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />}
                                    {actionState.message}
                                </div>
                            )}

                            <div className="research-tabs">
                                <button className={activeTab === 'curadoria' ? 'active' : ''} onClick={() => setActiveTab('curadoria')}>
                                    <Sparkles size={15} /> Curadoria
                                </button>
                                <button className={activeTab === 'fontes' ? 'active' : ''} onClick={() => setActiveTab('fontes')}>
                                    <ExternalLink size={15} /> Fontes
                                </button>
                                <button className={activeTab === 'relatorio' ? 'active' : ''} onClick={() => setActiveTab('relatorio')}>
                                    <Layers size={15} /> Relatorio completo
                                </button>
                            </div>

                            {activeTab === 'curadoria' && (
                                <div className="research-curation">
                                    <div className="research-box">
                                        <h3>Resumo executivo</h3>
                                        <p>{selected.executive_summary || selected.error_message || 'Sem resumo ainda.'}</p>
                                    </div>

                                    <div className="research-two">
                                        <div className="research-box">
                                            <h3>Principais achados</h3>
                                            <ul>
                                                {selectedInsights.map(item => <li key={item}>{item}</li>)}
                                                {selectedInsights.length === 0 && <li>Nenhum achado extraido automaticamente.</li>}
                                            </ul>
                                        </div>
                                        <div className="research-box highlight">
                                            <h3>Oportunidades para agentes</h3>
                                            <ul>
                                                {selectedOpportunities.map(item => <li key={item}>{item}</li>)}
                                            </ul>
                                        </div>
                                    </div>

                                    {!!selected.queries?.length && (
                                        <div className="research-box">
                                            <h3>Consultas feitas</h3>
                                            <div className="research-chips">
                                                {selected.queries.map(query => <span key={query}>{query}</span>)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'fontes' && (
                                <div className="research-source-grid">
                                    {(selected.sources || []).map((source, index) => (
                                        <a key={source.uri} href={source.uri} target="_blank" rel="noreferrer" className="research-source-card">
                                            <span>Fonte {index + 1}</span>
                                            <strong>{source.title || getDomain(source.uri)}</strong>
                                            <small>{getDomain(source.uri)}</small>
                                            <ExternalLink size={14} />
                                        </a>
                                    ))}
                                    {!selected.sources?.length && (
                                        <div className="research-empty light">Nenhuma fonte registrada para esta pesquisa.</div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'relatorio' && (
                                <div className="research-report">
                                    <h3>Relatorio completo</h3>
                                    <div
                                        className="research-markdown"
                                        dangerouslySetInnerHTML={{
                                            __html: selectedReportHtml || '<p>Ainda sem relatorio.</p>',
                                        }}
                                    />
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="research-empty light">Selecione ou crie uma pesquisa.</div>
                    )}
                </main>
            </section>

            <style jsx>{`
                .research-page { display: grid; gap: 18px; }
                .admin-header p { color: var(--text-muted); margin: 6px 0 0; }
                .research-command { align-items: center; display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr) minmax(360px, .8fr); padding: 18px; }
                .research-command span, .research-detail-head span { color: var(--gold-dark); display: block; font-size: .7rem; font-weight: 900; letter-spacing: .13em; text-transform: uppercase; }
                .research-command h2, .research-detail-head h2 { align-items: center; display: flex; gap: 8px; margin: 4px 0 6px; }
                .research-command p, .research-detail-head p { color: var(--text-muted); line-height: 1.45; margin: 0; }
                .research-form { display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr) 130px auto; }
                input, select { border: 1px solid var(--border); border-radius: 10px; font: inherit; padding: 10px 12px; width: 100%; }
                .research-health { align-items: center; border-radius: 12px; display: grid; gap: 12px; grid-template-columns: 260px 1fr; padding: 12px 14px; }
                .research-health.ok { background: rgba(34,197,94,.08); border: 1px solid rgba(34,197,94,.22); }
                .research-health.warning { background: rgba(201,169,110,.1); border: 1px solid rgba(201,169,110,.24); }
                .research-health > div:first-child > span { color: var(--gold-dark); display: block; font-size: .68rem; font-weight: 900; letter-spacing: .13em; text-transform: uppercase; }
                .research-health strong { display: block; margin-top: 3px; }
                .research-health-grid { display: flex; flex-wrap: wrap; gap: 8px; }
                .research-health-grid span { background: #fff; border: 1px solid var(--border); border-radius: 999px; color: var(--text-muted); font-size: .76rem; font-weight: 900; padding: 7px 10px; }
                .research-health-grid span.ok { color: #047857; }
                .research-health-grid span.bad { color: #b45309; }
                .research-health p { color: var(--gold-dark); font-size: .82rem; font-weight: 800; grid-column: 1 / -1; margin: 0; }
                .research-message { background: rgba(201,169,110,.1); border: 1px solid rgba(201,169,110,.24); border-radius: 12px; color: var(--gold-dark); font-weight: 800; padding: 12px 14px; }
                .research-shell { align-items: start; display: grid; gap: 16px; grid-template-columns: 360px minmax(0, 1fr); }
                .research-list { background: #fff; border: 1px solid var(--border); border-radius: 14px; display: grid; gap: 10px; max-height: 720px; overflow: auto; padding: 10px; }
                .research-list-head { align-items: center; background: linear-gradient(135deg, #171512, #33291d); border-radius: 12px; color: #fff; display: flex; justify-content: space-between; padding: 12px; }
                .research-list-head div { display: grid; gap: 2px; }
                .research-list-head span { color: #d4b476; font-size: .68rem; font-weight: 950; letter-spacing: .14em; text-transform: uppercase; }
                .research-list-head strong { font-size: .95rem; }
                .research-list-head small { align-items: center; background: rgba(255,255,255,.12); border-radius: 999px; display: inline-flex; font-weight: 900; height: 32px; justify-content: center; min-width: 32px; padding: 0 10px; }
                .research-list-items { display: grid; gap: 8px; }
                .research-list button { align-items: center; background: #faf8f3; border: 1px solid rgba(201,169,110,.16); border-radius: 12px; color: var(--text-primary); cursor: pointer; display: grid; gap: 10px; grid-template-columns: 58px minmax(0, 1fr); padding: 9px; text-align: left; transition: border-color .2s, background .2s, transform .2s; }
                .research-list button:hover { background: #fff; border-color: rgba(201,169,110,.45); transform: translateY(-1px); }
                .research-list button.active { background: rgba(201,169,110,.13); border-color: rgba(201,169,110,.72); }
                .research-list-icon { align-items: center; aspect-ratio: 1 / 1; background: linear-gradient(135deg, #201a13, #4c3a25); border-radius: 10px; color: #d6b775; display: flex; font-family: var(--font-serif); font-size: 1.4rem; font-weight: 900; justify-content: center; text-transform: uppercase; }
                .research-list-copy { display: grid; gap: 4px; min-width: 0; }
                .research-list-copy strong { color: var(--text-primary); display: -webkit-box; font-size: .86rem; line-height: 1.18; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
                .research-list-copy span { color: var(--gold-dark); font-size: .68rem; font-weight: 950; letter-spacing: .08em; text-transform: uppercase; }
                .research-list-copy small { color: var(--text-muted); font-size: .7rem; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .research-list-empty { align-items: center; background: #faf8f3; border: 1px dashed rgba(201,169,110,.35); border-radius: 12px; color: var(--text-muted); display: flex; gap: 8px; justify-content: center; min-height: 120px; padding: 14px; text-align: center; }
                .research-detail { background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; display: grid; gap: 14px; padding: 16px; }
                .research-detail-head { align-items: flex-start; display: flex; gap: 14px; justify-content: space-between; }
                .research-detail-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
                .research-kpis { display: grid; gap: 10px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
                .research-kpis div { background: #faf8f3; border: 1px solid rgba(201,169,110,.18); border-radius: 12px; display: grid; gap: 4px; padding: 12px; }
                .research-kpis span { color: var(--text-muted); font-size: .68rem; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
                .research-kpis strong { color: var(--text-primary); font-family: var(--font-serif); font-size: 1.22rem; line-height: 1; text-transform: capitalize; }
                .research-action-panel { display: flex; flex-wrap: wrap; gap: 8px; }
                .research-action-panel button, .research-action-panel a { align-items: center; background: #171512; border: 1px solid #171512; border-radius: 999px; color: #fff; cursor: pointer; display: inline-flex; font-weight: 900; gap: 7px; padding: 10px 13px; text-decoration: none; }
                .research-action-panel button:disabled { cursor: wait; opacity: .66; }
                .research-action-panel button:nth-child(2), .research-action-panel button:nth-child(3), .research-action-panel a { background: #fff; border-color: var(--border); color: var(--text-primary); }
                .research-action-message { align-items: center; border-radius: 12px; display: flex; gap: 8px; font-weight: 900; padding: 10px 12px; }
                .research-action-message.success { background: rgba(34,197,94,.08); color: #047857; }
                .research-action-message.error { background: rgba(239,68,68,.08); color: #b91c1c; }
                .research-action-message.running, .research-action-message.idle { background: rgba(201,169,110,.1); color: var(--gold-dark); }
                .research-tabs { align-items: center; border-bottom: 1px solid rgba(201,169,110,.18); display: flex; flex-wrap: wrap; gap: 8px; padding-bottom: 8px; }
                .research-tabs button { align-items: center; background: #fff; border: 1px solid var(--border); border-radius: 999px; color: var(--text-secondary); cursor: pointer; display: inline-flex; font-weight: 900; gap: 7px; padding: 9px 12px; }
                .research-tabs button.active { background: #c9a96e; border-color: #c9a96e; color: #111; }
                .research-curation { display: grid; gap: 14px; }
                .research-two { display: grid; gap: 14px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
                .research-box { border: 1px solid rgba(201,169,110,.18); border-radius: 12px; padding: 14px; }
                .research-box h3, .research-report h3 { margin: 0 0 10px; }
                .research-box p { color: var(--text-secondary); line-height: 1.62; margin: 0; }
                .research-box ul { display: grid; gap: 9px; margin: 0; padding-left: 18px; }
                .research-box li { color: var(--text-secondary); line-height: 1.48; }
                .research-box.highlight { background: rgba(201,169,110,.08); }
                .research-chips { display: flex; flex-wrap: wrap; gap: 8px; }
                .research-chips span { background: rgba(201,169,110,.12); border-radius: 999px; color: var(--gold-dark); font-size: .76rem; font-weight: 800; padding: 7px 10px; }
                .research-source-grid { display: grid; gap: 10px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
                .research-source-card { background: #fff; border: 1px solid rgba(201,169,110,.18); border-radius: 12px; color: inherit; display: grid; gap: 6px; min-height: 132px; padding: 13px; position: relative; text-decoration: none; }
                .research-source-card span { color: var(--gold-dark); font-size: .67rem; font-weight: 950; letter-spacing: .1em; text-transform: uppercase; }
                .research-source-card strong { color: var(--text-primary); display: -webkit-box; font-size: .9rem; line-height: 1.22; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
                .research-source-card small { color: var(--text-muted); font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .research-source-card svg { color: var(--gold-dark); position: absolute; right: 12px; top: 12px; }
                .research-report { display: grid; gap: 10px; }
                .research-markdown { background: #fff; border: 1px solid rgba(201,169,110,.18); border-radius: 12px; color: var(--text-secondary); line-height: 1.72; max-height: 760px; overflow: auto; padding: 18px; }
                .research-markdown :global(h1), .research-markdown :global(h2), .research-markdown :global(h3) { color: var(--text-primary); font-family: var(--font-serif); line-height: 1.08; margin: 20px 0 8px; }
                .research-markdown :global(p) { margin: 0 0 12px; }
                .research-markdown :global(ul) { margin: 0 0 14px; padding-left: 20px; }
                .research-markdown :global(a) { color: var(--gold-dark); font-weight: 900; }
                .research-empty { align-items: center; color: rgba(255,255,255,.62); display: flex; gap: 8px; justify-content: center; min-height: 120px; text-align: center; }
                .research-empty.light { color: var(--text-muted); }
                .danger { color: #dc2626 !important; }
                @media (max-width: 980px) {
                    .research-command, .research-shell, .research-form, .research-health { grid-template-columns: 1fr; }
                    .research-detail-head { flex-direction: column; }
                    .research-detail-actions { justify-content: flex-start; }
                    .research-kpis, .research-two, .research-source-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    )
}
