'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Archive, Bot, CalendarDays, CheckCircle2, Edit3, Eye, FileText, Loader2, MessageCircle, Plus, RotateCcw, Save, Send, Sparkles, Trash2 } from 'lucide-react'
import { BLOG_AUTHOR_IMAGE_URL, BLOG_AUTHOR_NAME } from '@/lib/blog/author'
import { markdownToHtml } from '@/lib/blog/markdown'

type BlogPost = {
    id: string
    title: string
    slug: string
    excerpt?: string | null
    content_markdown: string
    status: string
    cover_image_url?: string | null
    author_name?: string | null
    category?: string | null
    tags?: string[]
    seo_title?: string | null
    meta_description?: string | null
    primary_keyword?: string | null
    secondary_keywords?: string[]
    local_entities?: string[]
    approval_notes?: string[]
    created_at?: string | null
    updated_at?: string | null
    published_at?: string | null
    generated_by?: string | null
}

type BlogStatusFilter = 'all' | 'under_review' | 'published' | 'draft' | 'archived'
type AdminContentMode = 'blog' | 'news'
type EditorialViewMode = 'preview' | 'edit'

const DEFAULT_AUTHOR_NAME = 'Guilherme Pilger'

const BASE_EMPTY_POST: Partial<BlogPost> = {
    title: '',
    slug: '',
    excerpt: '',
    content_markdown: '',
    status: 'draft',
    cover_image_url: '',
    author_name: DEFAULT_AUTHOR_NAME,
    category: 'Mercado Imobiliario',
    tags: [],
    seo_title: '',
    meta_description: '',
    primary_keyword: '',
    secondary_keywords: [],
    local_entities: [],
    approval_notes: [],
}

const CONTENT_CONFIG: Record<AdminContentMode, {
    title: string
    description: string
    agentName: string
    agentDescription: string
    newLabel: string
    generateLabel: string
    generatingMessage: string
    generatedMessage: string
    itemSingular: string
    itemPlural: string
    listTitle: string
    emptyText: string
    defaultCategory: string
    defaultTags: string[]
    topicPlaceholder: string
    generateAction: 'generate' | 'generate_news'
    thumbLetter: string
}> = {
    blog: {
        title: 'Blog',
        description: 'Central de artigos gerados pelo Agente de Blog e aprovados pelo Marketing.',
        agentName: 'Isadora Edicao Blog',
        agentDescription: 'Cruza WhatsApp, leads, radar, trafego pago, estoque e comportamento de acesso para criar artigos com SEO, AEO e GEO.',
        newLabel: 'Novo artigo',
        generateLabel: 'Gerar com IA',
        generatingMessage: 'Isadora esta cruzando dados do ecossistema...',
        generatedMessage: 'Artigo gerado',
        itemSingular: 'Artigo',
        itemPlural: 'Artigos',
        listTitle: 'Artigos',
        emptyText: 'Nenhum artigo',
        defaultCategory: 'Mercado Imobiliario',
        defaultTags: [],
        topicPlaceholder: 'Tema opcional: ex. comprar cobertura na Barra Sul',
        generateAction: 'generate',
        thumbLetter: 'B',
    },
    news: {
        title: 'Noticias',
        description: 'Central de noticias criadas pela Clara Edicao Noticias e aprovadas pelo Marketing antes de ir ao ar.',
        agentName: 'Clara Edicao Noticias',
        agentDescription: 'Usa Research Pilger, fontes publicas, prefeitura, economia, turismo e radar para criar noticias verificaveis sobre mercado e cidades.',
        newLabel: 'Nova noticia',
        generateLabel: 'Gerar noticia',
        generatingMessage: 'Clara esta pesquisando sinais publicos para criar uma noticia...',
        generatedMessage: 'Noticia gerada',
        itemSingular: 'Noticia',
        itemPlural: 'Noticias',
        listTitle: 'Noticias',
        emptyText: 'Nenhuma noticia',
        defaultCategory: 'Noticias',
        defaultTags: ['Noticias'],
        topicPlaceholder: 'Tema opcional: ex. obras e mobilidade em Balneario Camboriu',
        generateAction: 'generate_news',
        thumbLetter: 'N',
    },
}

function csv(value?: string[] | null) {
    return (value || []).join(', ')
}

function splitCsv(value: string) {
    return value.split(',').map(item => item.trim()).filter(Boolean)
}

async function readBlogApiResponse(response: Response, fallbackMessage: string) {
    const text = await response.text()
    let data: any = {}

    if (text) {
        try {
            data = JSON.parse(text)
        } catch {
            const cleanText = text.replace(/\s+/g, ' ').trim()
            if (response.status === 413 || /^request entity too large/i.test(cleanText)) {
                throw new Error('A requisicao ficou grande demais para o servidor. Recarregue a pagina e tente novamente.')
            }
            throw new Error(cleanText || fallbackMessage)
        }
    }

    if (!response.ok) throw new Error(data?.error || fallbackMessage)
    return data
}

const statusLabels: Record<string, string> = {
    draft: 'Rascunho',
    under_review: 'Em analise',
    published: 'Publicado',
    archived: 'Arquivado',
}

const statusFilters: Array<{ key: BlogStatusFilter; label: string }> = [
    { key: 'all', label: 'Todos' },
    { key: 'under_review', label: 'Em analise' },
    { key: 'published', label: 'Publicados' },
    { key: 'draft', label: 'Rascunhos' },
    { key: 'archived', label: 'Arquivados' },
]

function isNewsPost(post: Partial<BlogPost>) {
    const category = String(post.category || '').toLowerCase()
    const tags = (post.tags || []).map(tag => String(tag).toLowerCase())
    return category.includes('noticia') || tags.some(tag => tag.includes('noticia')) || post.generated_by === 'news-intelligence'
}

function postMatchesMode(post: BlogPost, mode: AdminContentMode) {
    return mode === 'news' ? isNewsPost(post) : !isNewsPost(post)
}

function buildEmptyPost(mode: AdminContentMode): Partial<BlogPost> {
    const config = CONTENT_CONFIG[mode]
    return {
        ...BASE_EMPTY_POST,
        category: config.defaultCategory,
        tags: config.defaultTags,
        generated_by: mode === 'news' ? 'manual-news' : null,
    }
}

function buildEditablePostPayload(form: Partial<BlogPost>, statusOverride: string | undefined, mode: AdminContentMode) {
    const config = CONTENT_CONFIG[mode]
    const normalizedTags = splitCsv(csv(form.tags))
    const nextTags = mode === 'news'
        ? [...new Set([...config.defaultTags, ...normalizedTags])]
        : normalizedTags

    return {
        title: form.title || '',
        slug: form.slug || '',
        excerpt: form.excerpt || '',
        content_markdown: form.content_markdown || '',
        status: statusOverride || form.status || 'draft',
        cover_image_url: form.cover_image_url || '',
        author_name: form.author_name || DEFAULT_AUTHOR_NAME,
        category: form.category || config.defaultCategory,
        tags: nextTags,
        seo_title: form.seo_title || '',
        meta_description: form.meta_description || '',
        primary_keyword: form.primary_keyword || '',
        secondary_keywords: splitCsv(csv(form.secondary_keywords)),
        local_entities: splitCsv(csv(form.local_entities)),
        approval_notes: splitCsv(csv(form.approval_notes)),
        generated_by: form.generated_by || (mode === 'news' ? 'manual-news' : null),
    }
}

function saveMessage(statusOverride: string | undefined, mode: AdminContentMode) {
    const label = CONTENT_CONFIG[mode].itemSingular
    const location = mode === 'news' ? 'nas noticias' : 'no blog'
    if (mode === 'news') {
        if (statusOverride === 'published') return `${label} publicada e visivel ${location}.`
        if (statusOverride === 'under_review') return `${label} enviada para analise.`
        if (statusOverride === 'draft') return `${label} movida para rascunho.`
        if (statusOverride === 'archived') return `${label} arquivada.`
        return `${label} salva.`
    }
    if (statusOverride === 'published') return `${label} publicado e visivel ${location}.`
    if (statusOverride === 'under_review') return `${label} enviado para analise.`
    if (statusOverride === 'draft') return `${label} movido para rascunho.`
    if (statusOverride === 'archived') return `${label} arquivado.`
    return `${label} salvo.`
}

function shouldOpenPreview(post?: Partial<BlogPost> | null) {
    return post?.status === 'under_review' || post?.status === 'published'
}

function formatPreviewDate(value?: string | null) {
    if (!value) return 'Ainda nao publicado'
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value))
}

export function AdminEditorialPage({ mode = 'blog' }: { mode?: AdminContentMode }) {
    const config = CONTENT_CONFIG[mode]
    const [posts, setPosts] = useState<BlogPost[]>([])
    const [selectedId, setSelectedId] = useState<string>('new')
    const [form, setForm] = useState<Partial<BlogPost>>(() => buildEmptyPost(mode))
    const [topic, setTopic] = useState('')
    const [statusFilter, setStatusFilter] = useState<BlogStatusFilter>('all')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [generating, setGenerating] = useState<'blog' | 'news' | null>(null)
    const [message, setMessage] = useState('')
    const [viewMode, setViewMode] = useState<EditorialViewMode>('edit')

    const selectedPost = useMemo(() => posts.find(post => post.id === selectedId), [posts, selectedId])

    async function fetchPosts() {
        setLoading(true)
        try {
            const response = await fetch('/api/admin/blog?status=all', { cache: 'no-store' })
            const data = await readBlogApiResponse(response, `Erro ao carregar ${config.title.toLowerCase()}.`)
            const nextPosts = (data.posts || []).filter((post: BlogPost) => postMatchesMode(post, mode))
            setPosts(nextPosts)
            if (selectedId !== 'new') {
                const next = nextPosts.find((post: BlogPost) => post.id === selectedId)
                if (next) setForm(next)
            }
        } catch (error: any) {
            setMessage(error?.message || `Erro ao carregar ${config.title.toLowerCase()}.`)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        setSelectedId('new')
        setForm(buildEmptyPost(mode))
        setViewMode('edit')
        void fetchPosts()
    }, [mode])

    function selectPost(post: BlogPost) {
        setSelectedId(post.id)
        setForm(post)
        setViewMode(shouldOpenPreview(post) ? 'preview' : 'edit')
        setMessage('')
    }

    function newPost() {
        setSelectedId('new')
        setForm(buildEmptyPost(mode))
        setViewMode('edit')
        setMessage('')
    }

    async function generateWithAgent() {
        setGenerating(mode)
        setMessage(config.generatingMessage)
        try {
            const response = await fetch('/api/admin/blog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: config.generateAction, topic }),
            })
            const data = await readBlogApiResponse(response, `Erro ao gerar ${config.itemSingular.toLowerCase()}.`)
            setMessage(data.notification?.sent
                ? `${config.generatedMessage} e Marketing avisado no WhatsApp.`
                : `${config.generatedMessage}. Aviso WhatsApp: ${data.notification?.reason || 'nao enviado'}.`)
            await fetchPosts()
            setSelectedId(data.post.id)
            setForm(data.post)
            setViewMode(shouldOpenPreview(data.post) ? 'preview' : 'edit')
        } catch (error: any) {
            setMessage(error?.message || `Erro ao gerar ${config.itemSingular.toLowerCase()}.`)
        } finally {
            setGenerating(null)
        }
    }

    async function savePost(statusOverride?: string) {
        setSaving(true)
        setMessage(`Salvando ${config.itemSingular.toLowerCase()}...`)
        try {
            const payload = buildEditablePostPayload(form, statusOverride, mode)
            const response = await fetch('/api/admin/blog', {
                method: selectedId === 'new' ? 'POST' : 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(selectedId === 'new' ? payload : { ...payload, id: selectedId }),
            })
            const data = await readBlogApiResponse(response, `Erro ao salvar ${config.itemSingular.toLowerCase()}.`)
            setMessage(saveMessage(statusOverride, mode))
            await fetchPosts()
            setSelectedId(data.post.id)
            setForm(data.post)
            setViewMode(shouldOpenPreview(data.post) ? 'preview' : 'edit')
        } catch (error: any) {
            setMessage(error?.message || `Erro ao salvar ${config.itemSingular.toLowerCase()}.`)
        } finally {
            setSaving(false)
        }
    }

    async function deletePost() {
        if (!selectedPost || !confirm(`Remover este ${config.itemSingular.toLowerCase()}?`)) return
        setSaving(true)
        try {
            const response = await fetch(`/api/admin/blog?id=${selectedPost.id}`, { method: 'DELETE' })
            await readBlogApiResponse(response, `Erro ao remover ${config.itemSingular.toLowerCase()}.`)
            setMessage(`${config.itemSingular} removido.`)
            newPost()
            await fetchPosts()
        } catch (error: any) {
            setMessage(error?.message || `Erro ao remover ${config.itemSingular.toLowerCase()}.`)
        } finally {
            setSaving(false)
        }
    }

    const statusCounts = posts.reduce((acc, post) => {
        acc[post.status] = (acc[post.status] || 0) + 1
        return acc
    }, {} as Record<string, number>)
    const visiblePosts = useMemo(() => {
        if (statusFilter === 'all') return posts
        return posts.filter(post => post.status === statusFilter)
    }, [posts, statusFilter])
    const activeFilterLabel = statusFilters.find(filter => filter.key === statusFilter)?.label || 'Todos'
    const filteredSelectedPost = visiblePosts.find(post => post.id === selectedId)
    const currentStatus = form.status || 'draft'
    const isPublished = currentStatus === 'published'
    const isDraft = currentStatus === 'draft'
    const isUnderReview = currentStatus === 'under_review'
    const isArchived = currentStatus === 'archived'
    const previewHtml = useMemo(() => markdownToHtml(form.content_markdown || ''), [form.content_markdown])
    const previewCover = form.cover_image_url || 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/fundo%20imobiliaria.jpeg'
    const previewAuthor = form.author_name || BLOG_AUTHOR_NAME
    const previewDate = formatPreviewDate(form.published_at || form.created_at || form.updated_at)
    const publicPath = mode === 'news' ? `/noticias/${form.slug || ''}` : `/blog/${form.slug || ''}`
    const actionButtons = (
        <div className="admin-blog-actions">
            <button className="btn btn-gold" disabled={saving} onClick={() => savePost()}>
                {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                Salvar edicoes
            </button>
            {!isUnderReview && !isPublished && (
                <button className="btn btn-outline" disabled={saving} onClick={() => savePost('under_review')}>
                    <Send size={15} /> Enviar para analise
                </button>
            )}
            {isPublished ? (
                <>
                    <button className="btn btn-outline" disabled>
                        <CheckCircle2 size={15} /> Publicado
                    </button>
                    <button className="btn btn-outline" disabled={saving} onClick={() => savePost('draft')}>
                        <RotateCcw size={15} /> Despublicar
                    </button>
                </>
            ) : (
                <button className="btn btn-outline" disabled={saving} onClick={() => savePost('published')}>
                    <CheckCircle2 size={15} /> Publicar
                </button>
            )}
            {!isDraft && !isPublished && (
                <button className="btn btn-outline" disabled={saving} onClick={() => savePost('draft')}>
                    <FileText size={15} /> Rascunho
                </button>
            )}
            {!isArchived && (
                <button className="btn btn-outline" disabled={saving} onClick={() => savePost('archived')}>
                    <Archive size={15} /> Arquivar
                </button>
            )}
            {isPublished && form.slug && <Link className="btn btn-outline" href={publicPath} target="_blank"><Eye size={15} /> Ver no site</Link>}
            {selectedPost && <button className="btn btn-outline danger" disabled={saving} onClick={deletePost}><Trash2 size={15} /> Remover</button>}
        </div>
    )

    return (
        <div className="admin-blog-page">
            <div className="admin-header">
                <div>
                    <h1>{config.title}</h1>
                    <p>{config.description}</p>
                </div>
                <button className="btn btn-gold" onClick={newPost}><Plus size={16} /> {config.newLabel}</button>
            </div>

            <section className="admin-blog-agent chart-card">
                <div>
                    <span>Agente responsavel</span>
                    <h2><Bot size={19} /> {config.agentName}</h2>
                    <p>{config.agentDescription}</p>
                </div>
                <div className="admin-blog-generate">
                    <input value={topic} onChange={event => setTopic(event.target.value)} placeholder={config.topicPlaceholder} />
                    <button className="btn btn-gold" disabled={Boolean(generating)} onClick={generateWithAgent}>
                        {generating === mode ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                        {config.generateLabel}
                    </button>
                </div>
            </section>

            {message && <div className="admin-blog-message">{message}</div>}

            <section className="admin-blog-kpis">
                {statusFilters.map(filter => {
                    const count = filter.key === 'all' ? posts.length : statusCounts[filter.key] || 0
                    return (
                        <button
                            type="button"
                            key={filter.key}
                            className={statusFilter === filter.key ? 'active' : ''}
                            onClick={() => setStatusFilter(filter.key)}
                        >
                            <span>{filter.label}</span>
                            <strong>{count}</strong>
                        </button>
                    )
                })}
            </section>

            <section className="admin-blog-status-tabs" aria-label="Filtro de artigos por status">
                {statusFilters.map(filter => (
                    <button
                        type="button"
                        key={filter.key}
                        className={statusFilter === filter.key ? 'active' : ''}
                        onClick={() => setStatusFilter(filter.key)}
                    >
                        {filter.label}
                        <span>{filter.key === 'all' ? posts.length : statusCounts[filter.key] || 0}</span>
                    </button>
                ))}
            </section>

            <section className="admin-blog-shell">
                <aside className="admin-blog-list">
                    <div className="admin-blog-list-head">
                        <div>
                            <span>{config.listTitle}</span>
                            <strong>{activeFilterLabel}</strong>
                        </div>
                        <small>{visiblePosts.length}</small>
                    </div>
                    {loading ? (
                        <div className="admin-blog-empty"><Loader2 className="spin" /> Carregando...</div>
                    ) : visiblePosts.length === 0 ? (
                        <div className="admin-blog-empty">{config.emptyText} em {activeFilterLabel.toLowerCase()}.</div>
                    ) : visiblePosts.map(post => (
                        <button key={post.id} className={selectedId === post.id ? 'active' : ''} onClick={() => selectPost(post)}>
                            <span
                                className="admin-blog-thumb"
                                style={post.cover_image_url ? { backgroundImage: `url(${post.cover_image_url})` } : undefined}
                            >
                                {!post.cover_image_url ? config.thumbLetter : ''}
                            </span>
                            <span className="admin-blog-list-copy">
                                <strong>{post.title}</strong>
                                <small>{statusLabels[post.status] || post.status}</small>
                                <em>/{mode === 'news' ? 'noticias' : 'blog'}/{post.slug}</em>
                            </span>
                        </button>
                    ))}
                </aside>

                <main className="admin-blog-editor">
                    {!filteredSelectedPost && selectedId !== 'new' && (
                        <div className="admin-blog-filter-note">
                            O {config.itemSingular.toLowerCase()} selecionado esta fora do filtro <strong>{activeFilterLabel}</strong>. Limpe o filtro ou selecione outro item da lista.
                        </div>
                    )}
                    <div className="admin-blog-editor-head">
                        <div>
                            <span>{viewMode === 'preview' ? 'Previa para aprovacao' : 'Editor do conteudo'}</span>
                            <strong>{form.title || `Novo ${config.itemSingular.toLowerCase()}`}</strong>
                        </div>
                        <div className="admin-blog-view-toggle" role="group" aria-label="Modo de visualizacao">
                            <button type="button" className={viewMode === 'preview' ? 'active' : ''} onClick={() => setViewMode('preview')}>
                                <Eye size={15} /> Previa
                            </button>
                            <button type="button" className={viewMode === 'edit' ? 'active' : ''} onClick={() => setViewMode('edit')}>
                                <Edit3 size={15} /> Editar
                            </button>
                        </div>
                    </div>

                    {viewMode === 'preview' ? <div className="admin-blog-approval-bar">{actionButtons}</div> : null}

                    {viewMode === 'preview' ? (
                        <section className="admin-blog-preview">
                            <main className="blog-post-page">
                                <section className="blog-post-hero">
                                    <div>
                                        <span>{form.category || config.defaultCategory}</span>
                                        <h1>{form.title || `Titulo do ${config.itemSingular.toLowerCase()}`}</h1>
                                        {form.excerpt ? <p>{form.excerpt}</p> : null}
                                        <div className="blog-post-meta">
                                            <CalendarDays size={15} />
                                            {previewDate}
                                            {previewAuthor ? ` - ${previewAuthor}` : ''}
                                        </div>
                                    </div>
                                    <div className="blog-post-cover" style={{ backgroundImage: `url(${previewCover})` }} />
                                </section>

                                <section className="blog-post-shell">
                                    <article className="blog-post-content" dangerouslySetInnerHTML={{ __html: previewHtml || '<p>Sem conteudo para visualizar.</p>' }} />

                                    <aside className="blog-post-aside">
                                        <div className="blog-author-card">
                                            <img src={BLOG_AUTHOR_IMAGE_URL} alt={BLOG_AUTHOR_NAME} />
                                            <span>Autor do blog</span>
                                            <h2>{BLOG_AUTHOR_NAME}</h2>
                                            <p>Curadoria imobiliaria, leitura de mercado e oportunidades premium no litoral catarinense.</p>
                                        </div>

                                        <div>
                                            <h2>Fale com um especialista</h2>
                                            <p>Transforme leitura de mercado em uma curadoria real de oportunidades.</p>
                                            <span className="blog-post-cta">
                                                <MessageCircle size={17} />
                                                Falar agora
                                            </span>
                                        </div>
                                    </aside>
                                </section>
                            </main>
                            {form.approval_notes?.length ? (
                                <div className="admin-blog-preview-notes">
                                    <strong>Notas para aprovacao</strong>
                                    <ul>
                                        {form.approval_notes.map(note => <li key={note}>{note}</li>)}
                                    </ul>
                                </div>
                            ) : null}
                        </section>
                    ) : (
                        <>
                            <label>Titulo
                                <input value={form.title || ''} onChange={event => setForm({ ...form, title: event.target.value })} />
                            </label>
                            <div className="admin-blog-two">
                                <label>Slug
                                    <input value={form.slug || ''} onChange={event => setForm({ ...form, slug: event.target.value })} />
                                </label>
                                <label>Status
                                    <select value={form.status || 'draft'} onChange={event => setForm({ ...form, status: event.target.value })}>
                                        <option value="draft">Rascunho</option>
                                        <option value="under_review">Em analise</option>
                                        <option value="published">Publicado</option>
                                        <option value="archived">Arquivado</option>
                                    </select>
                                </label>
                            </div>
                            <label>Resumo
                                <textarea rows={3} value={form.excerpt || ''} onChange={event => setForm({ ...form, excerpt: event.target.value })} />
                            </label>
                            <div className="admin-blog-two">
                                <label>SEO title
                                    <input value={form.seo_title || ''} onChange={event => setForm({ ...form, seo_title: event.target.value })} />
                                </label>
                                <label>Palavra-chave principal
                                    <input value={form.primary_keyword || ''} onChange={event => setForm({ ...form, primary_keyword: event.target.value })} />
                                </label>
                            </div>
                            <label>Meta description
                                <textarea rows={2} value={form.meta_description || ''} onChange={event => setForm({ ...form, meta_description: event.target.value })} />
                            </label>
                            <div className="admin-blog-two">
                                <label>Tags
                                    <input value={csv(form.tags)} onChange={event => setForm({ ...form, tags: splitCsv(event.target.value) })} />
                                </label>
                                <label>Entidades locais
                                    <input value={csv(form.local_entities)} onChange={event => setForm({ ...form, local_entities: splitCsv(event.target.value) })} />
                                </label>
                            </div>
                            <label>Imagem de capa URL
                                <input value={form.cover_image_url || ''} onChange={event => setForm({ ...form, cover_image_url: event.target.value })} />
                            </label>
                            <label>Conteudo Markdown
                                <textarea className="admin-blog-content" value={form.content_markdown || ''} onChange={event => setForm({ ...form, content_markdown: event.target.value })} />
                            </label>
                            <label>Notas de aprovacao
                                <textarea rows={3} value={csv(form.approval_notes)} onChange={event => setForm({ ...form, approval_notes: splitCsv(event.target.value) })} />
                            </label>
                        </>
                    )}

                    {viewMode === 'edit' ? actionButtons : null}
                </main>
            </section>

            <style jsx>{`
                .admin-blog-page { display: grid; gap: 18px; }
                .admin-header { align-items: flex-start; display: flex; justify-content: space-between; gap: 18px; }
                .admin-header p { color: var(--text-muted); margin: 6px 0 0; }
                .admin-blog-agent { align-items: center; display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr) minmax(320px, 0.65fr); padding: 18px; }
                .admin-blog-agent span { color: var(--gold-dark); font-size: .7rem; font-weight: 900; letter-spacing: .13em; text-transform: uppercase; }
                .admin-blog-agent h2 { align-items: center; display: flex; gap: 8px; margin: 4px 0 6px; }
                .admin-blog-agent p { color: var(--text-muted); margin: 0; }
                .admin-blog-generate { display: grid; gap: 10px; }
                input, select, textarea { border: 1px solid var(--border); border-radius: 10px; font: inherit; padding: 10px 12px; width: 100%; }
                label { color: var(--text-secondary); display: grid; font-size: .82rem; font-weight: 800; gap: 7px; }
                .admin-blog-message { background: rgba(201,169,110,.1); border: 1px solid rgba(201,169,110,.24); border-radius: 12px; color: var(--gold-dark); font-weight: 800; padding: 12px 14px; }
                .admin-blog-kpis { display: grid; gap: 12px; grid-template-columns: repeat(5, minmax(0, 1fr)); }
                .admin-blog-kpis button { background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; cursor: pointer; display: grid; gap: 4px; padding: 14px; text-align: left; transition: border-color .2s, box-shadow .2s, transform .2s; }
                .admin-blog-kpis button.active { border-color: rgba(201,169,110,.8); box-shadow: 0 14px 34px rgba(201,169,110,.12); transform: translateY(-1px); }
                .admin-blog-kpis span { color: var(--text-muted); font-size: .7rem; font-weight: 900; text-transform: uppercase; }
                .admin-blog-kpis strong { font-family: var(--font-serif); font-size: 1.6rem; }
                .admin-blog-status-tabs { align-items: center; display: flex; flex-wrap: wrap; gap: 8px; }
                .admin-blog-status-tabs button { align-items: center; background: #fff; border: 1px solid var(--border); border-radius: 999px; color: var(--text-secondary); cursor: pointer; display: inline-flex; font-weight: 900; gap: 8px; padding: 9px 13px; }
                .admin-blog-status-tabs button.active { background: #171512; border-color: #171512; color: #fff; }
                .admin-blog-status-tabs span { background: rgba(201,169,110,.16); border-radius: 999px; color: inherit; font-size: .72rem; padding: 2px 7px; }
                .admin-blog-shell { align-items: start; display: grid; gap: 16px; grid-template-columns: 360px minmax(0, 1fr); }
                .admin-blog-list { background: #fff; border: 1px solid var(--border); border-radius: 14px; display: grid; gap: 8px; max-height: 640px; overflow: auto; padding: 10px; }
                .admin-blog-list-head { align-items: center; background: linear-gradient(135deg, #171512, #33291d); border-radius: 12px; color: #fff; display: flex; justify-content: space-between; margin-bottom: 4px; padding: 12px; }
                .admin-blog-list-head div { display: grid; gap: 2px; }
                .admin-blog-list-head span { color: #d4b476; font-size: .68rem; font-weight: 950; letter-spacing: .14em; text-transform: uppercase; }
                .admin-blog-list-head strong { font-size: .95rem; }
                .admin-blog-list-head small { align-items: center; background: rgba(255,255,255,.12); border-radius: 999px; display: inline-flex; font-weight: 900; height: 32px; justify-content: center; min-width: 32px; padding: 0 10px; }
                .admin-blog-list button { align-items: center; background: #faf8f3; border: 1px solid rgba(201,169,110,.16); border-radius: 12px; color: var(--text-primary); cursor: pointer; display: grid; gap: 10px; grid-template-columns: 58px minmax(0, 1fr); padding: 9px; text-align: left; transition: border-color .2s, background .2s, transform .2s; }
                .admin-blog-list button:hover { background: #fff; border-color: rgba(201,169,110,.45); transform: translateY(-1px); }
                .admin-blog-list button.active { background: rgba(201,169,110,.13); border-color: rgba(201,169,110,.72); }
                .admin-blog-thumb { align-items: center; aspect-ratio: 1 / 1; background: linear-gradient(135deg, #201a13, #4c3a25); background-position: center; background-size: cover; border-radius: 10px; color: #d6b775; display: flex; font-family: var(--font-serif); font-size: 1.4rem; font-weight: 900; justify-content: center; }
                .admin-blog-list-copy { display: grid; gap: 4px; min-width: 0; }
                .admin-blog-list-copy strong { color: var(--text-primary); display: -webkit-box; font-size: .86rem; line-height: 1.18; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
                .admin-blog-list-copy small { color: var(--gold-dark); font-size: .68rem; font-weight: 950; letter-spacing: .08em; text-transform: uppercase; }
                .admin-blog-list-copy em { color: var(--text-muted); font-size: .7rem; font-style: normal; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .admin-blog-empty { align-items: center; background: #faf8f3; border: 1px dashed rgba(201,169,110,.35); border-radius: 12px; color: var(--text-muted); display: flex; gap: 8px; justify-content: center; min-height: 120px; padding: 14px; text-align: center; }
                .admin-blog-editor { background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; display: grid; gap: 14px; padding: 16px; }
                .admin-blog-editor-head { align-items: center; border-bottom: 1px solid rgba(201,169,110,.16); display: flex; gap: 12px; justify-content: space-between; padding-bottom: 12px; }
                .admin-blog-editor-head > div:first-child { display: grid; gap: 4px; min-width: 0; }
                .admin-blog-editor-head span { color: var(--gold-dark); font-size: .68rem; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
                .admin-blog-editor-head strong { color: var(--text-primary); font-family: var(--font-serif); font-size: 1.15rem; line-height: 1.1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .admin-blog-view-toggle { align-items: center; background: #f8f4ec; border: 1px solid rgba(201,169,110,.18); border-radius: 999px; display: inline-flex; flex: 0 0 auto; gap: 4px; padding: 4px; }
                .admin-blog-view-toggle button { align-items: center; background: transparent; border: 0; border-radius: 999px; color: var(--text-secondary); cursor: pointer; display: inline-flex; font: inherit; font-size: .78rem; font-weight: 900; gap: 7px; min-height: 32px; padding: 7px 11px; white-space: nowrap; }
                .admin-blog-view-toggle button.active { background: #171512; color: #fff; }
                .admin-blog-filter-note { background: rgba(201,169,110,.1); border: 1px solid rgba(201,169,110,.22); border-radius: 12px; color: var(--text-secondary); font-size: .86rem; padding: 12px 14px; }
                .admin-blog-two { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
                .admin-blog-content { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; min-height: 430px; }
                .admin-blog-actions { display: flex; flex-wrap: wrap; gap: 10px; }
                .admin-blog-approval-bar { background: #fffaf2; border: 1px solid rgba(201,169,110,.2); border-radius: 12px; padding: 10px; position: sticky; top: 10px; z-index: 3; }
                .admin-blog-approval-bar .admin-blog-actions { gap: 8px; }
                .admin-blog-approval-bar :global(.btn) { min-height: 34px; padding: 8px 10px; }
                .admin-blog-preview { background: #f7f3eb; border: 1px solid rgba(201,169,110,.18); border-radius: 14px; overflow: hidden; }
                .blog-post-page { background: #f7f3eb; color: #171512; }
                .blog-post-hero { align-items: end; background: linear-gradient(135deg, #17120d, #2b241c); color: #fff; display: grid; gap: 34px; grid-template-columns: minmax(0, 1fr) minmax(320px, .72fr); padding: 84px 42px 42px; }
                .blog-post-hero span { color: #c9a96e; display: block; font-size: .72rem; font-weight: 900; letter-spacing: .15em; margin-bottom: 14px; text-transform: uppercase; }
                .blog-post-hero h1 { color: #fff; font-family: var(--font-serif); font-size: clamp(2rem, 4.3vw, 3.9rem); line-height: 1; margin: 0; }
                .blog-post-hero p { color: rgba(255,255,255,.72); font-size: 1.04rem; line-height: 1.6; max-width: 790px; }
                .blog-post-meta { align-items: center; color: rgba(255,255,255,.7); display: flex; gap: 8px; font-weight: 800; }
                .blog-post-cover { background-position: center; background-size: cover; border-radius: 20px; min-height: 430px; }
                .blog-post-shell { align-items: start; display: grid; gap: 38px; grid-template-columns: minmax(0, 1fr) 340px; padding: 58px 42px; }
                .blog-post-content { background: #fff; border: 1px solid rgba(201,169,110,.18); border-radius: 18px; padding: clamp(24px, 5vw, 56px); }
                .blog-post-content :global(h1),
                .blog-post-content :global(h2),
                .blog-post-content :global(h3) { color: #171512; font-family: var(--font-serif); line-height: 1.05; }
                .blog-post-content :global(h1) { font-size: 2rem; }
                .blog-post-content :global(h2) { font-size: 1.55rem; margin-top: 34px; }
                .blog-post-content :global(h3) { font-size: 1.18rem; margin-top: 26px; }
                .blog-post-content :global(p),
                .blog-post-content :global(li) { color: #50483e; font-size: 1rem; line-height: 1.82; }
                .blog-post-content :global(a) { color: #9b7635; font-weight: 800; }
                .blog-post-content :global(.blog-inline-image) { margin: 34px 0 12px; }
                .blog-post-content :global(.blog-inline-image img) { aspect-ratio: 16 / 9; border-radius: 18px; display: block; object-fit: cover; width: 100%; }
                .blog-post-aside { display: grid; gap: 16px; position: sticky; top: 96px; }
                .blog-post-aside > div { background: #fff; border: 1px solid rgba(201,169,110,.2); border-radius: 16px; display: grid; gap: 12px; padding: 20px; }
                .blog-post-aside h2 { font-size: 1.05rem; margin: 0; }
                .blog-post-aside p { color: #756a5f; line-height: 1.5; margin: 0; }
                .blog-post-aside a { color: #9b7635; font-weight: 900; text-decoration: none; }
                .blog-author-card { justify-items: center; text-align: center; }
                .blog-author-card img { aspect-ratio: 1 / 1; border: 3px solid rgba(201,169,110,.35); border-radius: 999px; height: 116px; object-fit: cover; width: 116px; }
                .blog-author-card span { color: #9b7635; font-size: .68rem; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
                .blog-author-card h2 { font-family: var(--font-serif); font-size: 1.45rem; }
                .blog-post-cta { align-items: center; background: #25d366; border-radius: 999px; color: #fff !important; display: inline-flex; font-weight: 900; gap: 8px; justify-content: center; padding: 12px 14px; }
                .admin-blog-preview-notes ul { color: var(--text-secondary); display: grid; gap: 7px; font-size: .82rem; line-height: 1.48; margin: 0; padding-left: 18px; }
                .danger { color: #dc2626 !important; }
                @media (max-width: 900px) {
                    .admin-header, .admin-blog-agent, .admin-blog-editor-head { grid-template-columns: 1fr; flex-direction: column; }
                    .admin-blog-editor-head { align-items: stretch; }
                    .admin-blog-view-toggle { justify-content: center; width: 100%; }
                    .admin-blog-view-toggle button { justify-content: center; width: 100%; }
                    .admin-blog-kpis, .admin-blog-shell, .admin-blog-two, .blog-post-hero, .blog-post-shell { grid-template-columns: 1fr; }
                    .blog-post-hero { padding: 52px 20px 28px; }
                    .blog-post-hero h1 { font-size: 2rem; }
                    .blog-post-content :global(h1) { font-size: 1.65rem; }
                    .blog-post-content :global(h2) { font-size: 1.35rem; }
                    .blog-post-cover { min-height: 280px; }
                    .blog-post-shell { padding: 28px 16px; }
                    .blog-post-aside { position: static; }
                }
            `}</style>
        </div>
    )
}

export default function AdminBlogPage() {
    return <AdminEditorialPage mode="blog" />
}
