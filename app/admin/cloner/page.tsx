'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Loader2, ExternalLink, RefreshCw, Wand2, Trash2, Eye, Globe, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface CloneJob {
    id: string
    slug: string
    original_url: string
    title: string | null
    status: 'draft' | 'queued' | 'processing' | 'completed' | 'failed'
    page_views: number
    created_at: string
}

export default function ClonerPage() {
    const [jobs, setJobs] = useState<CloneJob[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(true) // Always show form on cloner page
    const [url, setUrl] = useState('')
    const [customPrompt, setCustomPrompt] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const supabase = createClient()

    const fetchJobs = async () => {
        const { data } = await supabase
            .from('landing_pages')
            .select('*')
            .order('created_at', { ascending: false })

        if (data) setJobs(data as CloneJob[])
        setLoading(false)
    }

    useEffect(() => {
        fetchJobs()

        const subscription = supabase
            .channel('cloner-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'landing_pages' }, fetchJobs)
            .subscribe()

        return () => { subscription.unsubscribe() }
    }, [])

    const handleClone = async () => {
        if (!url) return alert('Por favor, insira uma URL.')

        setSubmitting(true)
        try {
            const res = await fetch('/api/admin/clone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, customPrompt })
            })

            const data = await res.json()

            if (!res.ok) throw new Error(data.error || 'Erro ao iniciar clonagem')

            setUrl('')
            setCustomPrompt('')
            fetchJobs()
        } catch (error: any) {
            alert(error.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir esta página?')) {
            await supabase.from('landing_pages').delete().eq('id', id)
            fetchJobs()
        }
    }

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            draft: 'badge',
            queued: 'badge badge-warning',
            processing: 'badge badge-gold',
            completed: 'badge badge-success',
            failed: 'badge badge-danger',
        }

        const labels: Record<string, string> = {
            draft: 'Rascunho',
            queued: 'Na Fila',
            processing: 'Processando AI...',
            completed: 'Concluído',
            failed: 'Falha',
        }

        return (
            <span className={styles[status] || 'badge'}>
                {labels[status] || status}
            </span>
        )
    }

    return (
        <div className="max-w-5xl mx-auto p-8">
            <div className="admin-header">
                <div>
                    <h1 className="flex items-center gap-3">
                        <Wand2 className="text-gold" size={28} /> Clonador de Páginas AI
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                        Transforme qualquer referência em uma landing page exclusiva.
                    </p>
                </div>
            </div>

            <div style={{ display: 'grid', gap: '32px' }}>

                {/* Clone Input Card */}
                <div className="chart-card relative overflow-hidden">
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'var(--gradient-gold)' }} />

                    <div className="flex flex-col md:flex-row gap-8">
                        <div style={{ flex: 1 }}>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '8px', color: 'var(--text-primary)' }}>Clonar Nova Página</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.95rem' }}>
                                Cole a URL de qualquer site que você goste. Nossa IA analisará a estrutura, conteúdo e estilo para criar uma versão exclusiva para você vender seus imóveis.
                            </p>

                            <div style={{ display: 'grid', gap: '16px' }}>
                                <div>
                                    <label className="form-label">URL da Página de Referência</label>
                                    <div className="flex">
                                        <div style={{
                                            background: 'var(--bg-secondary)',
                                            padding: '12px 16px',
                                            border: '1px solid var(--border)',
                                            borderRight: 'none',
                                            borderRadius: '8px 0 0 8px',
                                            display: 'flex', alignItems: 'center'
                                        }}>
                                            <Globe size={18} className="text-muted" />
                                        </div>
                                        <input
                                            className="form-input"
                                            value={url}
                                            onChange={e => setUrl(e.target.value)}
                                            placeholder="https://exemplo.com.br/paginas/lancamento-incrivel"
                                            style={{ borderRadius: '0 8px 8px 0', borderLeft: 'none' }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="form-label">Instruções para a IA (Opcional)</label>
                                    <textarea
                                        className="form-textarea"
                                        style={{ minHeight: '80px' }}
                                        value={customPrompt}
                                        onChange={e => setCustomPrompt(e.target.value)}
                                        placeholder="Ex: Quero que o tom seja mais sofisticado, foque nos benefícios do condomínio e use cores mais escuras."
                                    />
                                </div>

                                <div className="mt-2">
                                    <button
                                        className="btn btn-primary w-full md:w-auto"
                                        onClick={handleClone}
                                        disabled={submitting}
                                        style={{ minWidth: '200px', justifyContent: 'center' }}
                                    >
                                        {submitting ? (
                                            <><Loader2 size={18} className="animate-spin" /> Analisando e Clonando...</>
                                        ) : (
                                            <><Wand2 size={18} /> Iniciar Clonagem Mágica</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Animated Illustration Side (Simple placeholder for now) */}
                        <div className="hidden md:flex items-center justify-center" style={{ width: '300px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                            <div style={{ textAlign: 'center', opacity: 0.5 }}>
                                <Wand2 size={64} style={{ color: 'var(--gold)', margin: '0 auto 16px' }} />
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>A mágica acontece aqui</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* History Section */}
                <div>
                    <h3 className="chart-title">Histórico de Clonagens</h3>

                    {loading ? (
                        <div className="chart-card p-12 text-center text-muted">
                            <Loader2 size={32} className="animate-spin mx-auto mb-4" />
                            <p>Sincronizando tarefas...</p>
                        </div>
                    ) : jobs.length === 0 ? (
                        <div className="chart-card p-12 text-center">
                            <p className="text-secondary">Nenhuma clonagem realizada ainda.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {jobs.map(job => (
                                <div key={job.id} className="chart-card group p-6 flex flex-col md:flex-row items-center gap-6">
                                    <div style={{
                                        width: '50px', height: '50px',
                                        borderRadius: '50%',
                                        background: 'var(--bg-secondary)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        border: '1px solid var(--border)'
                                    }}>
                                        {job.status === 'processing' || job.status === 'queued' ? (
                                            <RefreshCw size={20} className="animate-spin text-gold" />
                                        ) : (
                                            <Globe size={20} className="text-muted" />
                                        )}
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h4 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                                                {job.title || 'Processando Título...'}
                                            </h4>
                                            {getStatusBadge(job.status)}
                                        </div>
                                        <div className="flex flex-wrap gap-4 text-sm text-secondary">
                                            <span>Origem: {job.original_url ? new URL(job.original_url).hostname : 'N/A'}</span>
                                            <span>•</span>
                                            <span>{new Date(job.created_at).toLocaleDateString()} às {new Date(job.created_at).toLocaleTimeString()}</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        {job.status === 'completed' && (
                                            <Link href={`/${job.slug}`} target="_blank">
                                                <button className="btn btn-outline btn-sm">
                                                    <ExternalLink size={16} /> Ver Resultado
                                                </button>
                                            </Link>
                                        )}
                                        <button
                                            className="btn btn-outline btn-sm hover:text-danger hover:border-danger"
                                            onClick={() => handleDelete(job.id)}
                                            style={{ borderColor: 'var(--border)' }}
                                            title="Remover"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}
