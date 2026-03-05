'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, ExternalLink, Copy, Trash2, Loader2, Check, MessageSquare, X, Save } from 'lucide-react'
import Link from 'next/link'

interface LandingPage {
    id: string
    slug: string
    title: string
    status: string
    page_views: number
    content: any
    primary_color: string
    created_at: string
    ai_context?: string | null
    property?: { title: string } | null
}

const TEMPLATES = [
    { id: 'brava-concetto', name: 'Brava Concetto', description: 'Estilo Clarus Construtora — tons terrosos, quiet luxury', color: '#948369' },
    { id: 'modern', name: 'Modern Luxury', description: 'Design moderno escuro com acentos dourados', color: '#c9a96e' },
    { id: 'classic', name: 'Classic', description: 'Layout clássico elegante', color: '#b8945f' },
    { id: 'lead-capture', name: 'Lead Capture', description: 'Focado em conversão e captura de leads', color: '#4ade80' },
    { id: 'urgency', name: 'Urgência', description: 'Gatilhos de escassez e urgência', color: '#ef4444' },
    { id: 'social-proof', name: 'Prova Social', description: 'Depoimentos e credibilidade', color: '#3b82f6' },
    { id: 'vip', name: 'VIP Exclusivo', description: 'Experiência premium e exclusiva', color: '#a855f7' },
]

export default function LandingPagesAdmin() {
    const [pages, setPages] = useState<LandingPage[]>([])
    const [loading, setLoading] = useState(true)
    const [copiedSlug, setCopiedSlug] = useState<string | null>(null)

    // AI Context Modal State
    const [editingContextId, setEditingContextId] = useState<string | null>(null)
    const [contextText, setContextText] = useState('')
    const [savingContext, setSavingContext] = useState(false)

    const supabase = createClient()

    const fetchPages = async () => {
        const { data } = await supabase
            .from('landing_pages')
            .select('*, property:properties(title)')
            .order('created_at', { ascending: false })

        if (data) setPages(data as LandingPage[])
        setLoading(false)
    }

    useEffect(() => {
        fetchPages()

        const subscription = supabase
            .channel('landing-pages-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'landing_pages' }, fetchPages)
            .subscribe()

        return () => { subscription.unsubscribe() }
    }, [])

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir esta landing page?')) {
            await supabase.from('landing_pages').delete().eq('id', id)
            fetchPages()
        }
    }

    const copyLink = (slug: string) => {
        const url = `${window.location.origin}/${slug}`
        navigator.clipboard.writeText(url)
        setCopiedSlug(slug)
        setTimeout(() => setCopiedSlug(null), 2000)
    }

    const openContextModal = (page: LandingPage) => {
        setContextText(page.ai_context || '')
        setEditingContextId(page.id)
    }

    const saveContext = async () => {
        if (!editingContextId) return
        setSavingContext(true)
        try {
            await supabase
                .from('landing_pages')
                .update({ ai_context: contextText })
                .eq('id', editingContextId)

            setEditingContextId(null)
            fetchPages() // Refresh to get updated data
        } catch (error) {
            console.error('Error saving context:', error)
            alert('Erro ao salvar as instruções.')
        } finally {
            setSavingContext(false)
        }
    }

    const getTemplateInfo = (content: any) => {
        const templateId = content?.template || 'classic'
        return TEMPLATES.find(t => t.id === templateId) || TEMPLATES[2]
    }

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 8px' }}>
            <div className="admin-header">
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <FileText className="text-gold" size={28} /> Landing Pages
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
                        Gerencie suas landing pages personalizadas.
                    </p>
                </div>
            </div>

            {/* ═══════════ PAGES LIST ═══════════ */}
            <div>
                <h3 style={{
                    fontSize: '1rem', color: 'var(--text-secondary)',
                    marginBottom: 16, fontFamily: 'Inter, sans-serif', fontWeight: 500,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                    <span>Páginas Criadas ({pages.length})</span>
                </h3>

                {loading ? (
                    <div className="chart-card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 16px', display: 'block' }} />
                        <p>Carregando páginas...</p>
                    </div>
                ) : pages.length === 0 ? (
                    <div className="chart-card" style={{ padding: 48, textAlign: 'center' }}>
                        <FileText size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px', display: 'block' }} />
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 8, fontSize: '1.1rem' }}>Nenhuma landing page encontrada.</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>
                            As landing pages criadas aparecerão aqui.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                        {pages.map((page) => {
                            const template = getTemplateInfo(page.content)
                            return (
                                <div
                                    key={page.id}
                                    className="chart-card"
                                    style={{
                                        padding: '20px 24px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 20,
                                        borderLeft: `3px solid ${template.color}`,
                                    }}
                                >
                                    {/* Template indicator */}
                                    <div style={{
                                        width: 48, height: 48, borderRadius: 8,
                                        background: `${template.color}15`,
                                        border: `1px solid ${template.color}30`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <FileText size={20} style={{ color: template.color }} />
                                    </div>

                                    {/* Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                            <h4 style={{
                                                fontSize: '1.05rem', color: 'var(--text-primary)',
                                                margin: 0, fontFamily: 'Inter, sans-serif', fontWeight: 600,
                                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                            }}>
                                                {page.title || 'Sem título'}
                                            </h4>
                                            <span style={{
                                                fontSize: '0.65rem', padding: '2px 8px',
                                                borderRadius: 4,
                                                background: `${template.color}15`,
                                                color: template.color,
                                                border: `1px solid ${template.color}30`,
                                                fontWeight: 600, textTransform: 'uppercase',
                                                letterSpacing: '0.05em', flexShrink: 0,
                                            }}>
                                                {template.name}
                                            </span>
                                        </div>
                                        <div style={{
                                            display: 'flex', gap: 16, fontSize: '0.8rem',
                                            color: 'var(--text-muted)', flexWrap: 'wrap',
                                        }}>
                                            <span>/{page.slug}</span>
                                            <span>•</span>
                                            <span>{page.page_views || 0} views</span>
                                            <span>•</span>
                                            <span>{new Date(page.created_at).toLocaleDateString('pt-BR')}</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                        <button
                                            className="btn btn-outline btn-sm"
                                            title="Instruções e Treinamento da IA"
                                            onClick={() => openContextModal(page)}
                                            style={{ display: 'flex', alignItems: 'center', gap: 6, borderColor: page.ai_context ? 'var(--gold)' : 'var(--border)', color: page.ai_context ? 'var(--gold)' : 'inherit' }}
                                        >
                                            <MessageSquare size={15} /> IA
                                        </button>

                                        <Link href={`/${page.slug}`} target="_blank">
                                            <button className="btn btn-outline btn-sm" title="Ver ao Vivo" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <ExternalLink size={15} /> Ver
                                            </button>
                                        </Link>

                                        <button
                                            className="btn btn-outline btn-sm"
                                            title="Copiar Link"
                                            onClick={() => copyLink(page.slug)}
                                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                        >
                                            {copiedSlug === page.slug ? (
                                                <><Check size={15} style={{ color: 'var(--success)' }} /> Copiado!</>
                                            ) : (
                                                <><Copy size={15} /> Link</>
                                            )}
                                        </button>

                                        <button
                                            className="btn btn-outline btn-sm"
                                            onClick={() => handleDelete(page.id)}
                                            title="Excluir"
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 6,
                                                borderColor: 'var(--border)',
                                            }}
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Modal de Instruções da IA */}
            {editingContextId && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 99999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 20
                }}>
                    <div style={{
                        backgroundColor: '#111', width: '100%', maxWidth: 600,
                        borderRadius: 16, border: '1px solid var(--border)',
                        overflow: 'hidden', display: 'flex', flexDirection: 'column',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                    }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1a1a' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.1rem', color: '#fff' }}>
                                <MessageSquare style={{ color: '#c9a96e' }} size={20} />
                                Instruções para a Inteligência Artificial
                            </h3>
                            <button onClick={() => setEditingContextId(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ padding: 24, flex: 1, backgroundColor: '#111' }}>
                            <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: '#ddd', lineHeight: '1.6' }}>
                                Cole aqui o texto com gatilhos mentais, diferenciais, FAQ e regras de ouro deste empreendimento exclusivo.
                                Quando o cliente conversar com o chat desta Landing Page, a IA lerá essas instruções para atender melhor.
                            </p>

                            <textarea
                                value={contextText}
                                onChange={(e) => setContextText(e.target.value)}
                                placeholder="Ex: O valor de entrada é 20%. Foque na vista para o mar e no design neoclássico. Se perguntarem sobre permuta, diga que analisamos caso a caso..."
                                style={{
                                    width: '100%', height: 250, resize: 'none',
                                    backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 12, padding: 20, color: '#fff',
                                    fontFamily: 'inherit', fontSize: '1rem', lineHeight: '1.6',
                                    outline: 'none',
                                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)'
                                }}
                            />
                        </div>

                        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end', gap: 12, backgroundColor: '#1a1a1a' }}>
                            <button
                                className="btn btn-outline"
                                onClick={() => setEditingContextId(null)}
                                disabled={savingContext}
                                style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={saveContext}
                                disabled={savingContext}
                                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                            >
                                {savingContext ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Salvar Instruções
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}
