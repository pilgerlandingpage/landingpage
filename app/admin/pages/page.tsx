'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit, Trash2, ExternalLink, Globe } from 'lucide-react'

interface LandingPage {
    id: string
    slug: string
    title: string
    subtitle: string | null
    meta_pixel_id: string | null
    google_ads_id: string | null
    google_analytics_id: string | null
    tiktok_pixel_id: string | null
    linkedin_pixel_id: string | null
    status: string
    created_at: string
    property?: { title: string } | null
    agent?: { name: string } | null
}

export default function PagesPage() {
    const [pages, setPages] = useState<LandingPage[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingPage, setEditingPage] = useState<LandingPage | null>(null)
    const [form, setForm] = useState({
        slug: '', title: '', subtitle: '', meta_pixel_id: '', google_ads_id: '',
        google_analytics_id: '', tiktok_pixel_id: '', linkedin_pixel_id: '', status: 'draft',
        property_id: '', ai_agent_id: '',
    })
    const [properties, setProperties] = useState<{ id: string; title: string }[]>([])
    const [agents, setAgents] = useState<{ id: string; name: string }[]>([])

    const supabase = createClient()

    const fetchPages = async () => {
        const { data } = await supabase
            .from('landing_pages')
            .select('*, property:properties(title), agent:ai_agents(name)')
            .order('created_at', { ascending: false })
        setPages((data as LandingPage[]) || [])
        setLoading(false)
    }

    const fetchRelated = async () => {
        const { data: props } = await supabase.from('properties').select('id, title')
        const { data: ags } = await supabase.from('ai_agents').select('id, name')
        setProperties(props || [])
        setAgents(ags || [])
    }

    useEffect(() => { fetchPages(); fetchRelated() }, [])

    const handleSave = async () => {
        const data: Record<string, unknown> = {
            slug: form.slug,
            title: form.title,
            subtitle: form.subtitle || null,
            meta_pixel_id: form.meta_pixel_id || null,
            google_ads_id: form.google_ads_id || null,
            google_analytics_id: form.google_analytics_id || null,
            tiktok_pixel_id: form.tiktok_pixel_id || null,
            linkedin_pixel_id: form.linkedin_pixel_id || null,
            status: form.status,
            property_id: form.property_id || null,
            ai_agent_id: form.ai_agent_id || null,
        }

        if (editingPage) {
            await supabase.from('landing_pages').update(data).eq('id', editingPage.id)
        } else {
            await supabase.from('landing_pages').insert(data)
        }
        setShowForm(false)
        setEditingPage(null)
        setForm({ slug: '', title: '', subtitle: '', meta_pixel_id: '', google_ads_id: '', google_analytics_id: '', tiktok_pixel_id: '', linkedin_pixel_id: '', status: 'draft', property_id: '', ai_agent_id: '' })
        fetchPages()
    }

    const handleEdit = (page: LandingPage) => {
        setEditingPage(page)
        setForm({
            slug: page.slug,
            title: page.title,
            subtitle: page.subtitle || '',
            meta_pixel_id: page.meta_pixel_id || '',
            google_ads_id: page.google_ads_id || '',
            google_analytics_id: page.google_analytics_id || '',
            tiktok_pixel_id: page.tiktok_pixel_id || '',
            linkedin_pixel_id: page.linkedin_pixel_id || '',
            status: page.status,
            property_id: '',
            ai_agent_id: '',
        })
        setShowForm(true)
    }

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir esta página?')) {
            await supabase.from('landing_pages').delete().eq('id', id)
            fetchPages()
        }
    }

    return (
        <div>
            <div className="admin-header">
                <h1>Landing Pages</h1>
                <button className="btn btn-gold" onClick={() => { setShowForm(!showForm); setEditingPage(null) }}>
                    <Plus size={18} /> Nova Página
                </button>
            </div>

            {/* Form */}
            {showForm && (
                <div className="chart-card" style={{ marginBottom: '24px' }}>
                    <div className="chart-title">{editingPage ? 'Editar Página' : 'Nova Landing Page'}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="form-group">
                            <label className="form-label">Slug (URL)</label>
                            <input className="form-input" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="minha-pagina" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Título</label>
                            <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Título da Página" />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                            <label className="form-label">Subtítulo</label>
                            <input className="form-input" value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} placeholder="Subtítulo opcional" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Meta Pixel ID</label>
                            <input className="form-input" value={form.meta_pixel_id} onChange={e => setForm({ ...form, meta_pixel_id: e.target.value })} placeholder="123456789" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Google Ads ID</label>
                            <input className="form-input" value={form.google_ads_id} onChange={e => setForm({ ...form, google_ads_id: e.target.value })} placeholder="AW-123456789" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Google Analytics ID</label>
                            <input className="form-input" value={form.google_analytics_id} onChange={e => setForm({ ...form, google_analytics_id: e.target.value })} placeholder="G-XXXXXXXXXX" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">TikTok Pixel ID</label>
                            <input className="form-input" value={form.tiktok_pixel_id} onChange={e => setForm({ ...form, tiktok_pixel_id: e.target.value })} placeholder="CXXXXXXXXX" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">LinkedIn Pixel ID</label>
                            <input className="form-input" value={form.linkedin_pixel_id} onChange={e => setForm({ ...form, linkedin_pixel_id: e.target.value })} placeholder="123456" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Imóvel</label>
                            <select className="form-select" value={form.property_id} onChange={e => setForm({ ...form, property_id: e.target.value })}>
                                <option value="">Selecione...</option>
                                {properties.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Agente IA</label>
                            <select className="form-select" value={form.ai_agent_id} onChange={e => setForm({ ...form, ai_agent_id: e.target.value })}>
                                <option value="">Selecione...</option>
                                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                                <option value="draft">Rascunho</option>
                                <option value="published">Publicado</option>
                                <option value="archived">Arquivado</option>
                            </select>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                        <button className="btn btn-gold" onClick={handleSave}>Salvar</button>
                        <button className="btn btn-outline" onClick={() => { setShowForm(false); setEditingPage(null) }}>Cancelar</button>
                    </div>
                </div>
            )}

            {/* Pages List */}
            <div className="chart-card" style={{ padding: 0, overflow: 'auto' }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Título</th>
                            <th>Slug</th>
                            <th>Status</th>
                            <th>Imóvel</th>
                            <th>Agente IA</th>
                            <th>Pixels</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Carregando...</td></tr>
                        ) : pages.length === 0 ? (
                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Nenhuma página criada</td></tr>
                        ) : (
                            pages.map(page => (
                                <tr key={page.id}>
                                    <td style={{ fontWeight: 500 }}>{page.title}</td>
                                    <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>/{page.slug}</td>
                                    <td>
                                        <span className={`badge ${page.status === 'published' ? 'badge-success' : page.status === 'archived' ? 'badge-danger' : 'badge-warning'}`}>
                                            {page.status === 'published' ? 'Publicado' : page.status === 'archived' ? 'Arquivado' : 'Rascunho'}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '0.85rem' }}>{page.property?.title || '—'}</td>
                                    <td style={{ fontSize: '0.85rem' }}>{page.agent?.name || '—'}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                            {page.meta_pixel_id && <span className="badge badge-gold" style={{ fontSize: '0.65rem' }}>Meta</span>}
                                            {page.google_ads_id && <span className="badge badge-gold" style={{ fontSize: '0.65rem' }}>Google</span>}
                                            {page.tiktok_pixel_id && <span className="badge badge-gold" style={{ fontSize: '0.65rem' }}>TikTok</span>}
                                            {page.linkedin_pixel_id && <span className="badge badge-gold" style={{ fontSize: '0.65rem' }}>LinkedIn</span>}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button className="btn btn-outline btn-sm" onClick={() => handleEdit(page)}><Edit size={14} /></button>
                                            <button className="btn btn-outline btn-sm" onClick={() => handleDelete(page.id)} style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
