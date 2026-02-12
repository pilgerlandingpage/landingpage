'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Save, ArrowLeft, Settings, Layout, Variable } from 'lucide-react'
import Link from 'next/link'

interface Property {
    id: string
    title: string
}

interface Agent {
    id: string
    name: string
}

export default function NewLandingPage() {
    const router = useRouter()
    const supabase = createClient()

    const [loading, setLoading] = useState(false)
    const [properties, setProperties] = useState<Property[]>([])
    const [agents, setAgents] = useState<Agent[]>([])

    const [form, setForm] = useState({
        title: '',
        slug: '',
        property_id: '',
        ai_agent_id: '',
        meta_pixel_id: '',
        google_ads_id: '',
        status: 'draft',
        primary_color: '#c9a96e',
    })

    useEffect(() => {
        const loadData = async () => {
            const [propsRes, agentsRes] = await Promise.all([
                supabase.from('properties').select('id, title').order('title'),
                supabase.from('ai_agents').select('id, name').order('name')
            ])

            if (propsRes.data) setProperties(propsRes.data)
            if (agentsRes.data) setAgents(agentsRes.data)
        }
        loadData()
    }, [])

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const title = e.target.value
        // Auto-generate slug from title if slug is empty or matches previous title slug
        const simpleSlug = title.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
            .replace(/[^a-z0-9]+/g, '-') // replace non-alphanum with dash
            .replace(/^-+|-+$/g, '') // remove leading/trailing dashes

        setForm(prev => ({
            ...prev,
            title,
            slug: prev.slug === '' || prev.slug === simpleSlug ? simpleSlug : prev.slug
        }))
    }

    const handleSave = async () => {
        if (!form.title || !form.slug || !form.property_id) {
            alert('Preencha os campos obrigatórios: Título, Slug e Imóvel')
            return
        }

        setLoading(true)
        try {
            const { error } = await supabase.from('landing_pages').insert({
                title: form.title,
                slug: form.slug,
                property_id: form.property_id,
                ai_agent_id: form.ai_agent_id || null,
                meta_pixel_id: form.meta_pixel_id || null,
                google_ads_id: form.google_ads_id || null,
                status: form.status,
                primary_color: form.primary_color,
            })

            if (error) throw error

            router.push('/admin/pages')
        } catch (error: any) {
            alert('Erro ao salvar página: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="admin-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Link href="/admin/pages">
                        <button className="btn btn-outline" style={{ padding: '8px' }}>
                            <ArrowLeft size={20} />
                        </button>
                    </Link>
                    <div>
                        <h1>Nova Landing Page</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                            Configure a campanha e vincule ao imóvel.
                        </p>
                    </div>
                </div>
                <button className="btn btn-gold" onClick={handleSave} disabled={loading}>
                    <Save size={18} /> {loading ? 'Salvando...' : 'Criar Página'}
                </button>
            </div>

            <div style={{ display: 'grid', gap: '24px' }}>

                {/* Basic Info Card */}
                <div className="chart-card">
                    <div className="chart-title">
                        <Layout size={18} style={{ display: 'inline', marginRight: '8px' }} />
                        Configurações Principais
                    </div>

                    <div style={{ display: 'grid', gap: '16px' }}>
                        <div className="form-group">
                            <label className="form-label">Título da Campanha (Interno)</label>
                            <input
                                className="form-input"
                                value={form.title}
                                onChange={handleTitleChange}
                                placeholder="Ex: Lançamento Praia Brava - Verão 2026"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">URL da Página (Slug)</label>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    padding: '10px 12px',
                                    border: '1px solid var(--border)',
                                    borderRight: 'none',
                                    borderRadius: '8px 0 0 8px',
                                    color: 'var(--text-muted)',
                                    fontSize: '0.9rem'
                                }}>
                                    pilger.com.br/
                                </span>
                                <input
                                    className="form-input"
                                    value={form.slug}
                                    onChange={e => setForm({ ...form, slug: e.target.value })}
                                    style={{ borderRadius: '0 8px 8px 0' }}
                                    placeholder="lancamento-praia-brava"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Imóvel Vinculado</label>
                            <select
                                className="form-select"
                                value={form.property_id}
                                onChange={e => setForm({ ...form, property_id: e.target.value })}
                            >
                                <option value="">Selecione um imóvel...</option>
                                {properties.map(p => (
                                    <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                            </select>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                O conteúdo da página (fotos, preço, descrição) será puxado deste imóvel.
                            </p>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name="status"
                                        value="draft"
                                        checked={form.status === 'draft'}
                                        onChange={e => setForm({ ...form, status: e.target.value })}
                                    />
                                    Rascunho
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name="status"
                                        value="published"
                                        checked={form.status === 'published'}
                                        onChange={e => setForm({ ...form, status: e.target.value })}
                                    />
                                    Publicado
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Intelligence & Tracking Card */}
                <div className="chart-card">
                    <div className="chart-title">
                        <Settings size={18} style={{ display: 'inline', marginRight: '8px' }} />
                        Inteligência e Rastreamento
                    </div>

                    <div style={{ display: 'grid', gap: '16px' }}>
                        <div className="form-group">
                            <label className="form-label">Agente de IA (Funil)</label>
                            <select
                                className="form-select"
                                value={form.ai_agent_id}
                                onChange={e => setForm({ ...form, ai_agent_id: e.target.value })}
                            >
                                <option value="">Selecione o agente...</option>
                                {agents.map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                            </select>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Define a personalidade da IA que atenderá no chat desta página.
                            </p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div className="form-group">
                                <label className="form-label">Meta Pixel ID</label>
                                <input
                                    className="form-input"
                                    value={form.meta_pixel_id}
                                    onChange={e => setForm({ ...form, meta_pixel_id: e.target.value })}
                                    placeholder="Ex: 1234567890"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Google Ads ID</label>
                                <input
                                    className="form-input"
                                    value={form.google_ads_id}
                                    onChange={e => setForm({ ...form, google_ads_id: e.target.value })}
                                    placeholder="Ex: AW-123456789"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Cor Principal (Botões e Destaques)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <input
                                    type="color"
                                    value={form.primary_color}
                                    onChange={e => setForm({ ...form, primary_color: e.target.value })}
                                    style={{ border: 'none', width: '40px', height: '40px', cursor: 'pointer', background: 'none' }}
                                />
                                <input
                                    className="form-input"
                                    value={form.primary_color}
                                    onChange={e => setForm({ ...form, primary_color: e.target.value })}
                                    style={{ width: '120px' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
