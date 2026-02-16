'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Eye, Edit, Trash2, Globe, Wand2, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface LandingPage {
    id: string
    slug: string
    title: string
    status: string
    page_views: number
    created_at: string
}

import TemplatesGrid from '@/components/admin/TemplatesGrid'

export default function PagesList() {
    const [pages, setPages] = useState<LandingPage[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    const fetchPages = async () => {
        const { data } = await supabase
            .from('landing_pages')
            .select('*')
            .order('created_at', { ascending: false })
        setPages((data as LandingPage[]) || [])
        setLoading(false)
    }

    useEffect(() => {
        fetchPages()

        const subscription = supabase
            .channel('landing-pages-list')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'landing_pages' }, fetchPages)
            .subscribe()

        return () => { subscription.unsubscribe() }
    }, [])

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir esta página?')) {
            await supabase.from('landing_pages').delete().eq('id', id)
            fetchPages()
        }
    }

    return (
        <div className="max-w-7xl mx-auto p-8">
            <div className="admin-header">
                <div>
                    <h1 className="flex items-center gap-3">
                        <Globe className="text-gold" size={28} /> Minhas Landing Pages
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                        Gerencie suas páginas de alta conversão.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Link href="/admin/pages/new" style={{ textDecoration: 'none' }}>
                        <button className="btn btn-outline" style={{ padding: '12px 24px' }}>
                            <Plus size={20} /> Nova Página
                        </button>
                    </Link>
                    <Link href="/admin/cloner" style={{ textDecoration: 'none' }}>
                        <button className="btn btn-primary" style={{ padding: '12px 24px' }}>
                            <Wand2 size={20} /> Clonar com IA
                        </button>
                    </Link>
                </div>
            </div>

            <div style={{ display: 'grid', gap: '16px', marginBottom: '64px' }}>
                {loading ? (
                    <div className="chart-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <div className="animate-spin" style={{ fontSize: '2rem', marginBottom: '16px', display: 'inline-block' }}>⏳</div>
                        <p>Carregando suas páginas...</p>
                    </div>
                ) : pages.length === 0 ? (
                    <div className="chart-card" style={{ padding: '40px', textAlign: 'center' }}>
                        <div style={{
                            width: '60px', height: '60px',
                            background: 'rgba(201, 169, 110, 0.1)',
                            borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 16px auto',
                            color: 'var(--gold)'
                        }}>
                            <Globe size={32} />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Comece sua primeira campanha</h3>
                        <p className="text-zinc-400 mb-8 max-w-md mx-auto">Escolha um dos modelos abaixo para criar uma Landing Page de alta conversão em segundos.</p>

                        <TemplatesGrid />
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
                        {pages.map(page => (
                            <div key={page.id} className="chart-card group" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                    <div style={{
                                        width: '48px', height: '48px',
                                        borderRadius: '12px',
                                        background: 'linear-gradient(135deg, rgba(201, 169, 110, 0.2), rgba(201, 169, 110, 0.05))',
                                        border: '1px solid rgba(201, 169, 110, 0.2)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'var(--gold)'
                                    }}>
                                        <Globe size={24} />
                                    </div>
                                    <span className={`badge ${page.status === 'published' ? 'badge-success' : 'badge-gold'}`}>
                                        {page.status === 'published' ? 'Publicada' : 'Rascunho'}
                                    </span>
                                </div>

                                <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '8px', fontWeight: '600' }}>
                                    {page.title || 'Página sem título'}
                                </h3>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px', flex: 1 }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                        <Globe size={14} /> /{page.slug}
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                        <Eye size={14} /> {page.page_views || 0} visitas
                                    </span>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                                    <Link href={`/${page.slug}`} target="_blank" style={{ flex: 1, textDecoration: 'none' }}>
                                        <button className="btn btn-outline btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
                                            <ExternalLink size={16} /> Ver
                                        </button>
                                    </Link>
                                    <button
                                        className="btn btn-outline btn-sm"
                                        onClick={() => handleDelete(page.id)}
                                        style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)' }}
                                        title="Excluir"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Always show templates suggestion at bottom if not empty */}
            {pages.length > 0 && !loading && (
                <div className="mt-12 pt-12 border-t border-zinc-800">
                    <h2 className="text-2xl font-playfair font-bold mb-6 flex items-center gap-2">
                        <Wand2 size={24} className="text-gold" />
                        Criar Nova Página a partir de um Modelo
                    </h2>
                    <TemplatesGrid />
                </div>
            )}

            <style jsx>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}
