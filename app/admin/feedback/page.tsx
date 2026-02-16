'use client'

import { useEffect, useState, useCallback } from 'react'
import { MessageSquareHeart, CheckCircle2, Eye, Filter, ChevronDown, ChevronUp, Clock, User, Tag } from 'lucide-react'

interface Feedback {
    id: string
    type: string
    content: string
    conversation_log: string | null
    user_name: string | null
    status: string
    created_at: string
}

const TYPE_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
    duvida: { label: 'Dúvida', color: '#3b82f6', emoji: '❓' },
    sugestao: { label: 'Sugestão', color: '#8b5cf6', emoji: '💡' },
    bug: { label: 'Bug', color: '#ef4444', emoji: '🐛' },
    elogio: { label: 'Elogio', color: '#22c55e', emoji: '⭐' },
    outro: { label: 'Outro', color: '#6b7280', emoji: '📝' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    novo: { label: 'Novo', color: '#f59e0b' },
    lido: { label: 'Lido', color: '#3b82f6' },
    resolvido: { label: 'Resolvido', color: '#22c55e' },
}

export default function FeedbackPage() {
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
    const [loading, setLoading] = useState(true)
    const [filterType, setFilterType] = useState<string>('all')
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [updating, setUpdating] = useState<string | null>(null)

    const fetchFeedbacks = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/feedback')
            const json = await res.json()
            if (json.success) {
                setFeedbacks(json.data)
            }
        } catch (err) {
            console.error('Error loading feedback:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchFeedbacks()
    }, [fetchFeedbacks])

    const updateStatus = async (id: string, newStatus: string) => {
        setUpdating(id)
        try {
            const res = await fetch('/api/admin/feedback', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: newStatus }),
            })
            const json = await res.json()
            if (json.success) {
                setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, status: newStatus } : f))
            }
        } catch (err) {
            console.error('Error updating feedback:', err)
        } finally {
            setUpdating(null)
        }
    }

    const filtered = feedbacks.filter(f => {
        if (filterType !== 'all' && f.type !== filterType) return false
        if (filterStatus !== 'all' && f.status !== filterStatus) return false
        return true
    })

    const counts = {
        total: feedbacks.length,
        novo: feedbacks.filter(f => f.status === 'novo').length,
        lido: feedbacks.filter(f => f.status === 'lido').length,
        resolvido: feedbacks.filter(f => f.status === 'resolvido').length,
    }

    if (loading) {
        return <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Carregando...</div>
    }

    return (
        <div>
            <div className="admin-header">
                <div>
                    <h1>💬 Feedback dos Usuários</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
                        Feedbacks coletados pelo Pilger AI durante conversas no painel admin.
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                {[
                    { label: 'Total', value: counts.total, color: 'var(--gold)' },
                    { label: 'Novos', value: counts.novo, color: '#f59e0b' },
                    { label: 'Lidos', value: counts.lido, color: '#3b82f6' },
                    { label: 'Resolvidos', value: counts.resolvido, color: '#22c55e' },
                ].map(stat => (
                    <div key={stat.label} className="chart-card" style={{ textAlign: 'center', padding: '20px' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: stat.color }}>{stat.value}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="chart-card" style={{ marginBottom: '20px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <Filter size={16} style={{ color: 'var(--text-muted)' }} />
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tipo:</span>
                    <select
                        className="form-input"
                        value={filterType}
                        onChange={e => setFilterType(e.target.value)}
                        style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
                    >
                        <option value="all">Todos</option>
                        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                            <option key={key} value={key}>{cfg.emoji} {cfg.label}</option>
                        ))}
                    </select>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status:</span>
                    <select
                        className="form-input"
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        style={{ width: 'auto', padding: '6px 12px', fontSize: '0.85rem' }}
                    >
                        <option value="all">Todos</option>
                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                            <option key={key} value={key}>{cfg.label}</option>
                        ))}
                    </select>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {filtered.length} resultado(s)
                </span>
            </div>

            {/* Feedback List */}
            {filtered.length === 0 ? (
                <div className="chart-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <MessageSquareHeart size={48} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: '16px' }} />
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                        {feedbacks.length === 0
                            ? 'Nenhum feedback coletado ainda. Converse com o Pilger AI para gerar feedbacks!'
                            : 'Nenhum feedback corresponde aos filtros selecionados.'}
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                    {filtered.map(fb => {
                        const typeConf = TYPE_CONFIG[fb.type] || TYPE_CONFIG.outro
                        const statusConf = STATUS_CONFIG[fb.status] || STATUS_CONFIG.novo
                        const isExpanded = expandedId === fb.id
                        const date = new Date(fb.created_at)

                        return (
                            <div key={fb.id} className="chart-card" style={{ padding: '20px', transition: 'border-color 0.2s', borderLeft: `3px solid ${typeConf.color}` }}>
                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                padding: '3px 10px',
                                                borderRadius: '20px',
                                                background: `${typeConf.color}20`,
                                                color: typeConf.color,
                                            }}>
                                                {typeConf.emoji} {typeConf.label}
                                            </span>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                padding: '3px 10px',
                                                borderRadius: '20px',
                                                background: `${statusConf.color}20`,
                                                color: statusConf.color,
                                            }}>
                                                {statusConf.label}
                                            </span>
                                            {fb.user_name && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    <User size={12} /> {fb.user_name}
                                                </span>
                                            )}
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                <Clock size={12} /> {date.toLocaleDateString('pt-BR')} {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                            {fb.content}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                        {fb.status === 'novo' && (
                                            <button
                                                onClick={() => updateStatus(fb.id, 'lido')}
                                                disabled={updating === fb.id}
                                                title="Marcar como lido"
                                                style={{
                                                    width: '34px', height: '34px',
                                                    borderRadius: '8px',
                                                    background: 'var(--bg-primary)',
                                                    border: '1px solid var(--border-color)',
                                                    color: '#3b82f6',
                                                    cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    opacity: updating === fb.id ? 0.5 : 1,
                                                }}
                                            >
                                                <Eye size={15} />
                                            </button>
                                        )}
                                        {fb.status !== 'resolvido' && (
                                            <button
                                                onClick={() => updateStatus(fb.id, 'resolvido')}
                                                disabled={updating === fb.id}
                                                title="Marcar como resolvido"
                                                style={{
                                                    width: '34px', height: '34px',
                                                    borderRadius: '8px',
                                                    background: 'var(--bg-primary)',
                                                    border: '1px solid var(--border-color)',
                                                    color: '#22c55e',
                                                    cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    opacity: updating === fb.id ? 0.5 : 1,
                                                }}
                                            >
                                                <CheckCircle2 size={15} />
                                            </button>
                                        )}
                                        {fb.conversation_log && (
                                            <button
                                                onClick={() => setExpandedId(isExpanded ? null : fb.id)}
                                                title={isExpanded ? 'Recolher conversa' : 'Ver conversa completa'}
                                                style={{
                                                    width: '34px', height: '34px',
                                                    borderRadius: '8px',
                                                    background: 'var(--bg-primary)',
                                                    border: '1px solid var(--border-color)',
                                                    color: 'var(--text-muted)',
                                                    cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}
                                            >
                                                {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Expanded Conversation Log */}
                                {isExpanded && fb.conversation_log && (
                                    <div style={{
                                        marginTop: '16px',
                                        padding: '16px',
                                        background: 'var(--bg-primary)',
                                        borderRadius: '10px',
                                        border: '1px solid var(--border-color)',
                                        maxHeight: '400px',
                                        overflowY: 'auto',
                                    }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            💬 Conversa Completa
                                        </div>
                                        {fb.conversation_log.split('\n').map((line, i) => {
                                            const isUser = line.startsWith('Usuário:')
                                            const isAI = line.startsWith('Pilger AI:')
                                            return (
                                                <div key={i} style={{
                                                    padding: '8px 12px',
                                                    marginBottom: '6px',
                                                    borderRadius: '8px',
                                                    fontSize: '0.85rem',
                                                    lineHeight: 1.5,
                                                    background: isUser ? 'rgba(184, 148, 95, 0.1)' : isAI ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                                                    borderLeft: isUser ? '2px solid var(--gold)' : isAI ? '2px solid #6366f1' : 'none',
                                                    color: 'var(--text-secondary)',
                                                }}>
                                                    {line}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
