'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Eye, Edit, Trash2, Globe } from 'lucide-react'
import Link from 'next/link'

interface LandingPage {
    id: string
    slug: string
    title: string
    status: string
    page_views: number
    created_at: string
}

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

    useEffect(() => { fetchPages() }, [])

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir esta página?')) {
            await supabase.from('landing_pages').delete().eq('id', id)
            fetchPages()
        }
    }

    return (
        <div>
            <div className="admin-header">
                <div>
                    <h1>Market Pages</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                        Crie páginas de alta conversão para seus imóveis.
                    </p>
                </div>
                <Link href="/admin/pages/new">
                    <button className="btn btn-gold">
                        <Plus size={18} /> Nova Página
                    </button>
                </Link>
            </div>

            {loading ? (
                <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Carregando páginas...</div>
            ) : pages.length === 0 ? (
                <div className="chart-card" style={{ padding: '60px', textAlign: 'center' }}>
                    <Globe size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px', opacity: 0.5 }} />
                    <h3 style={{ marginBottom: '8px' }}>Nenhuma página criada</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
                        Crie sua primeira Landing Page para começar a rodar tráfego.
                    </p>
                    <Link href="/admin/pages/new">
                        <button className="btn btn-gold">Criar Página</button>
                    </Link>
                </div>
            ) : (
                <div className="chart-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', background: 'rgba(255,255,255,0.02)' }}>
                                <th style={{ padding: '16px', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>TÍTULO / SLUG</th>
                                <th style={{ padding: '16px', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>STATUS</th>
                                <th style={{ padding: '16px', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>VISITAS</th>
                                <th style={{ padding: '16px', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'right' }}>AÇÕES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pages.map(page => (
                                <tr key={page.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ fontWeight: 600 }}>{page.title}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ color: 'var(--gold)' }}>/</span>{page.slug}
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: '20px',
                                            fontSize: '0.75rem',
                                            background: page.status === 'published' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                            color: page.status === 'published' ? '#22c55e' : '#ef4444',
                                            border: `1px solid ${page.status === 'published' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                                        }}>
                                            {page.status === 'published' ? 'Publicado' : 'Rascunho'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Eye size={14} style={{ color: 'var(--text-muted)' }} />
                                            {page.page_views}
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                            <Link href={`/${page.slug}`} target="_blank">
                                                <button className="btn btn-outline btn-sm" title="Ver Página">
                                                    <Globe size={14} />
                                                </button>
                                            </Link>
                                            {/* Edit not implemented yet, just link to new for consistency */}
                                            {/* <Link href={`/admin/pages/${page.id}`}> */}
                                            <button className="btn btn-outline btn-sm" title="Editar">
                                                <Edit size={14} />
                                            </button>
                                            {/* </Link> */}
                                            <button
                                                className="btn btn-outline btn-sm"
                                                onClick={() => handleDelete(page.id)}
                                                style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                                                title="Excluir"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
