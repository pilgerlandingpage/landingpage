'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, ExternalLink, Copy, Trash2, Loader2, Check } from 'lucide-react'
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

            <style>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}
