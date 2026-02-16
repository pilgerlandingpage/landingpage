'use client'

import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Save, ArrowLeft, Settings, Layout, Wand2, Monitor, Star, MousePointerClick, Edit3, Image as ImageIcon, Type, ChevronDown, ChevronUp, Flame, Award, Crown } from 'lucide-react'
import Link from 'next/link'

interface Property {
    id: string
    title: string
}

interface Agent {
    id: string
    name: string
}

function NewLandingPageContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()

    const [loading, setLoading] = useState(false)
    const [properties, setProperties] = useState<Property[]>([])
    const [agents, setAgents] = useState<Agent[]>([])
    const [showCustom, setShowCustom] = useState(false)

    const [form, setForm] = useState({
        title: '',
        slug: '',
        property_id: '',
        ai_agent_id: '',
        meta_pixel_id: '',
        google_ads_id: '',
        status: 'draft',
        primary_color: '#c9a96e',
        template: searchParams.get('template') || 'classic',
        // Manual Content Fields
        custom_title: '',
        custom_description: '',
        custom_cta: 'Agendar Visita',
        custom_hero_image: '',
        custom_features: '' // comma separated
    })

    const templates = [
        {
            id: 'urgency',
            name: '🔥 Urgência',
            description: 'Countdown timer, escassez, 1 tela mobile.',
            icon: <Flame size={24} />
        },
        {
            id: 'social-proof',
            name: '⭐ Prova Social',
            description: 'Depoimentos, estrelas, contador de views.',
            icon: <Award size={24} />
        },
        {
            id: 'vip',
            name: '👑 VIP Exclusivo',
            description: 'Preto+dourado, lista VIP, exclusividade.',
            icon: <Crown size={24} />
        },
        {
            id: 'classic',
            name: 'Clássico',
            description: 'Layout tradicional com foco e detalhes e sidebar.',
            icon: <Monitor size={24} />
        },
        {
            id: 'modern',
            name: 'Modern Luxury',
            description: 'Visual expansivo, fontes grandes e design premium.',
            icon: <Star size={24} />
        },
        {
            id: 'lead-capture',
            name: 'Captura de Leads',
            description: 'Foco total em conversão com formulário no topo.',
            icon: <MousePointerClick size={24} />
        }
    ]

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
        if (!form.title || !form.slug) {
            alert('Preencha os campos obrigatórios: Título da Campanha e Slug')
            return
        }

        setLoading(true)
        try {
            const { error } = await supabase.from('landing_pages').insert({
                title: form.title,
                slug: form.slug,
                property_id: form.property_id || null, // Optional now
                ai_agent_id: form.ai_agent_id || null,
                meta_pixel_id: form.meta_pixel_id || null,
                google_ads_id: form.google_ads_id || null,
                status: form.status,
                primary_color: form.primary_color,
                content: {
                    template: form.template,
                    // Store manual content overrides
                    custom_title: form.custom_title,
                    custom_description: form.custom_description,
                    custom_cta: form.custom_cta,
                    custom_hero_image: form.custom_hero_image,
                    custom_features: form.custom_features ? form.custom_features.split(',').map(f => f.trim()) : []
                }
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
        <div className="max-w-5xl mx-auto p-8">
            <div className="admin-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <Link href="/admin/pages">
                        <button className="btn btn-outline" style={{ padding: '8px' }}>
                            <ArrowLeft size={20} />
                        </button>
                    </Link>
                    <div>
                        <h1>Nova Landing Page</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
                            Configure a campanha de vendas para seu imóvel.
                        </p>
                    </div>
                </div>
                <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
                    <Save size={18} /> {loading ? 'Salvando...' : 'Publicar Página'}
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>

                {/* Main Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* Basic Config */}
                    <div className="chart-card">
                        <div className="chart-title flex items-center gap-2">
                            <Layout size={18} className="text-gold" />
                            Configurações Principais
                        </div>

                        <div style={{ display: 'grid', gap: '20px' }}>
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
                                        background: 'var(--bg-secondary)',
                                        padding: '12px 16px',
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
                                <label className="form-label">Modelo Visual (Template)</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                                    {templates.map(t => (
                                        <div
                                            key={t.id}
                                            onClick={() => setForm({ ...form, template: t.id })}
                                            style={{
                                                border: `2px solid ${form.template === t.id ? 'var(--gold)' : 'var(--border)'}`,
                                                background: form.template === t.id ? 'rgba(201, 169, 110, 0.1)' : 'transparent',
                                                borderRadius: '8px',
                                                padding: '12px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                textAlign: 'center',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: '8px'
                                            }}
                                        >
                                            <div style={{ color: form.template === t.id ? 'var(--gold)' : 'var(--text-secondary)' }}>
                                                {t.icon}
                                            </div>
                                            <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{t.name}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content Source Selection */}
                    <div className="chart-card">
                        <div className="chart-title flex items-center justify-between pointer" onClick={() => setShowCustom(!showCustom)}>
                            <div className="flex items-center gap-2">
                                <Edit3 size={18} className="text-gold" />
                                Conteúdo da Página
                            </div>
                            {/* Toggle could go here */}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Imóvel Vinculado (Opcional)</label>
                            <select
                                className="form-select"
                                value={form.property_id}
                                onChange={e => setForm({ ...form, property_id: e.target.value })}
                            >
                                <option value="">Não vincular imóvel (Usar conteúdo manual)</option>
                                {properties.map(p => (
                                    <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                            </select>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                                Se selecionado, preenchemos automaticamente fotos e textos. Você pode sobrescrever abaixo.
                            </p>
                        </div>

                        {/* Manual Overrides */}
                        <div className="mt-6 border-t border-zinc-800 pt-6">
                            <button
                                className="flex items-center gap-2 text-sm font-medium text-gold hover:text-white transition-colors mb-4"
                                onClick={() => setShowCustom(!showCustom)}
                            >
                                {showCustom ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                {showCustom ? 'Ocultar Edição Manual' : 'Personalizar Texto e Imagens Manualmente'}
                            </button>

                            {showCustom && (
                                <div className="grid gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                    <div className="form-group">
                                        <label className="form-label flex items-center gap-2"><Type size={14} /> Título Principal (H1)</label>
                                        <input
                                            className="form-input"
                                            placeholder="Ex: Viva o Extraordinário"
                                            value={form.custom_title}
                                            onChange={e => setForm({ ...form, custom_title: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label flex items-center gap-2"><ImageIcon size={14} /> URL da Imagem de Capa</label>
                                        <input
                                            className="form-input"
                                            placeholder="https://..."
                                            value={form.custom_hero_image}
                                            onChange={e => setForm({ ...form, custom_hero_image: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Texto de Apresentação</label>
                                        <textarea
                                            className="form-input"
                                            rows={4}
                                            placeholder="Detalhes sobre a oportunidade..."
                                            value={form.custom_description}
                                            onChange={e => setForm({ ...form, custom_description: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Texto do Botão (CTA)</label>
                                        <input
                                            className="form-input"
                                            placeholder="Ex: Quero saber mais"
                                            value={form.custom_cta}
                                            onChange={e => setForm({ ...form, custom_cta: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Diferenciais (separados por vírgula)</label>
                                        <input
                                            className="form-input"
                                            placeholder="Vista Mar, Acabamento Premium, 4 Suítes"
                                            value={form.custom_features}
                                            onChange={e => setForm({ ...form, custom_features: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* Status Card */}
                    <div className="chart-card">
                        <div className="chart-title flex items-center gap-2">
                            <Settings size={18} className="text-gold" />
                            Publicação
                        </div>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', background: form.status === 'draft' ? 'rgba(255,255,255,0.05)' : 'transparent' }}>
                                    <input
                                        type="radio"
                                        name="status"
                                        value="draft"
                                        checked={form.status === 'draft'}
                                        onChange={e => setForm({ ...form, status: e.target.value })}
                                    />
                                    <div>
                                        <div style={{ fontWeight: '500' }}>Rascunho</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Visível apenas para admins</div>
                                    </div>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', background: form.status === 'published' ? 'rgba(255,255,255,0.05)' : 'transparent' }}>
                                    <input
                                        type="radio"
                                        name="status"
                                        value="published"
                                        checked={form.status === 'published'}
                                        onChange={e => setForm({ ...form, status: e.target.value })}
                                    />
                                    <div>
                                        <div style={{ fontWeight: '500' }}>Publicado</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Visível para todos</div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Intelligence Card */}
                    <div className="chart-card">
                        <div className="chart-title flex items-center gap-2">
                            <Wand2 size={18} className="text-gold" />
                            Inteligência & Marketing
                        </div>

                        <div className="form-group">
                            <label className="form-label">Agente de IA (Funil)</label>
                            <select
                                className="form-select"
                                value={form.ai_agent_id}
                                onChange={e => setForm({ ...form, ai_agent_id: e.target.value })}
                            >
                                <option value="">Sem agente (Padrão)</option>
                                {agents.map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Meta Pixel ID</label>
                            <input
                                className="form-input"
                                value={form.meta_pixel_id}
                                onChange={e => setForm({ ...form, meta_pixel_id: e.target.value })}
                                placeholder="1234567890"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Google Ads ID</label>
                            <input
                                className="form-input"
                                value={form.google_ads_id}
                                onChange={e => setForm({ ...form, google_ads_id: e.target.value })}
                                placeholder="AW-123456789"
                            />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}

export default function NewLandingPage() {
    return (
        <Suspense fallback={<div>Carregando...</div>}>
            <NewLandingPageContent />
        </Suspense>
    )
}
