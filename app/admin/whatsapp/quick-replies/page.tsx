'use client'

import { useState, useEffect } from 'react'
import {
    MessageSquare, Loader2, Plus, Trash2, Edit3, Save,
    Smartphone, Zap, Search
} from 'lucide-react'

interface Instance {
    id: string; instance_name: string; instance_token: string; status: string
    virtual_brokers?: { name: string } | null
}

interface QuickReply {
    shortCut: string
    type: string
    text: string
    file?: string
}

export default function QuickRepliesPage() {
    const [instances, setInstances] = useState<Instance[]>([])
    const [selectedInstance, setSelectedInstance] = useState('')
    const [replies, setReplies] = useState<QuickReply[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingReplies, setLoadingReplies] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [editingShortCut, setEditingShortCut] = useState<string | null>(null)
    const [formShortCut, setFormShortCut] = useState('')
    const [formText, setFormText] = useState('')
    const [formType, setFormType] = useState('text')
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => { loadInstances() }, [])

    const loadInstances = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/whatsapp/instances')
            const data = await res.json()
            const connected = (data.instances || []).filter((i: Instance) => i.status === 'connected' && i.instance_token)
            setInstances(connected)
            if (connected.length > 0 && !selectedInstance) setSelectedInstance(connected[0].id)
        } catch { /* ignore */ }
        finally { setLoading(false) }
    }

    useEffect(() => { if (selectedInstance) loadReplies() }, [selectedInstance])

    const loadReplies = async () => {
        if (!selectedInstance) return
        setLoadingReplies(true)
        try {
            const res = await fetch(`/api/admin/whatsapp/quick-replies?instance_id=${selectedInstance}`)
            const data = await res.json()
            if (data.success) {
                const list = Array.isArray(data.replies) ? data.replies : (data.replies?.quickReplies || [])
                setReplies(list)
            }
        } catch { /* ignore */ }
        finally { setLoadingReplies(false) }
    }

    const saveReply = async () => {
        if (!formShortCut.trim() || !formText.trim()) return
        setActionLoading('save')
        try {
            const res = await fetch('/api/admin/whatsapp/quick-replies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save',
                    instanceId: selectedInstance,
                    shortCut: formShortCut.trim(),
                    text: formText.trim(),
                    type: formType,
                })
            })
            const data = await res.json()
            if (data.success) {
                setFeedback({ type: 'success', text: `✅ ${data.message}` })
                setShowForm(false)
                setEditingShortCut(null)
                setFormShortCut('')
                setFormText('')
                loadReplies()
            } else {
                setFeedback({ type: 'error', text: `❌ ${data.message}` })
            }
        } catch { setFeedback({ type: 'error', text: '❌ Erro de conexão' }) }
        finally { setActionLoading(null) }
    }

    const deleteReply = async (shortCut: string) => {
        setActionLoading(shortCut)
        try {
            const res = await fetch('/api/admin/whatsapp/quick-replies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', instanceId: selectedInstance, deleteShortCut: shortCut })
            })
            const data = await res.json()
            if (data.success) {
                setFeedback({ type: 'success', text: '✅ Resposta rápida removida!' })
                loadReplies()
            }
        } catch { /* ignore */ }
        finally { setActionLoading(null) }
    }

    const startEdit = (reply: QuickReply) => {
        setEditingShortCut(reply.shortCut)
        setFormShortCut(reply.shortCut)
        setFormText(reply.text)
        setFormType(reply.type || 'text')
        setShowForm(true)
    }

    const filteredReplies = searchQuery
        ? replies.filter(r => r.shortCut.toLowerCase().includes(searchQuery.toLowerCase()) || r.text.toLowerCase().includes(searchQuery.toLowerCase()))
        : replies

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '12px', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="spin" /> Carregando...
        </div>
    )

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.5rem', margin: 0 }}>
                        <Zap size={26} style={{ color: 'var(--gold)' }} /> Respostas Rápidas
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
                        Atalhos de texto para respostas frequentes — digite o atalho no WhatsApp para enviar
                    </p>
                </div>
                <button onClick={() => { setShowForm(!showForm); setEditingShortCut(null); setFormShortCut(''); setFormText('') }}
                    style={{
                        padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                        background: showForm ? 'rgba(239,68,68,0.15)' : 'linear-gradient(135deg, var(--gold), #b8860b)',
                        color: showForm ? '#ef4444' : '#000', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                    {showForm ? 'Cancelar' : <><Plus size={16} /> Nova Resposta</>}
                </button>
            </div>

            {/* Instance Selector */}
            <div style={{
                padding: '16px 20px', borderRadius: '12px', marginBottom: '20px',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
            }}>
                <Smartphone size={18} style={{ color: 'var(--gold)' }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Instância:</span>
                <select value={selectedInstance} onChange={e => setSelectedInstance(e.target.value)}
                    style={{
                        padding: '8px 12px', borderRadius: '8px', fontSize: '0.9rem',
                        background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                        color: 'var(--text-primary)', cursor: 'pointer', flex: 1, minWidth: '200px',
                    }}>
                    {instances.map(inst => (
                        <option key={inst.id} value={inst.id}>
                            {inst.virtual_brokers?.name || inst.instance_name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Feedback */}
            {feedback && (
                <div style={{
                    padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', fontSize: '0.85rem',
                    background: feedback.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                    color: feedback.type === 'success' ? '#22c55e' : '#ef4444',
                    border: `1px solid ${feedback.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                }}>
                    {feedback.text}
                </div>
            )}

            {/* Create/Edit Form */}
            {showForm && (
                <div style={{
                    padding: '24px', borderRadius: '14px', marginBottom: '24px',
                    background: 'var(--bg-secondary)', border: '1px solid var(--gold-30, rgba(201,169,110,0.3))',
                }}>
                    <h2 style={{ fontSize: '1.05rem', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {editingShortCut ? <Edit3 size={18} style={{ color: 'var(--gold)' }} /> : <Plus size={18} style={{ color: 'var(--gold)' }} />}
                        {editingShortCut ? 'Editar Resposta Rápida' : 'Nova Resposta Rápida'}
                    </h2>
                    <div style={{ display: 'grid', gap: '14px' }}>
                        <div>
                            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                Atalho (começa com /)
                            </label>
                            <input value={formShortCut} onChange={e => setFormShortCut(e.target.value)}
                                placeholder="/oi, /horario, /docs..."
                                disabled={!!editingShortCut}
                                style={{
                                    width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                    color: 'var(--gold)', outline: 'none', fontFamily: 'monospace', fontWeight: 600,
                                    boxSizing: 'border-box', opacity: editingShortCut ? 0.6 : 1,
                                }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                Texto da Resposta
                            </label>
                            <textarea value={formText} onChange={e => setFormText(e.target.value)}
                                placeholder="Digite o texto da resposta rápida..."
                                rows={4}
                                style={{
                                    width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                    color: 'var(--text-primary)', outline: 'none', resize: 'vertical',
                                    fontFamily: 'inherit', boxSizing: 'border-box',
                                }} />
                        </div>
                        <button onClick={saveReply} disabled={actionLoading === 'save' || !formShortCut.trim() || !formText.trim()}
                            style={{
                                padding: '12px 24px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                                background: 'linear-gradient(135deg, var(--gold), #b8860b)',
                                color: '#000', fontWeight: 700, fontSize: '0.95rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                opacity: !formShortCut.trim() || !formText.trim() ? 0.5 : 1,
                            }}>
                            {actionLoading === 'save' ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                            {editingShortCut ? 'Atualizar' : 'Criar Resposta Rápida'}
                        </button>
                    </div>
                </div>
            )}

            {/* Search */}
            {replies.length > 5 && (
                <div style={{ marginBottom: '16px', position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Buscar atalho ou texto..."
                        style={{
                            width: '100%', padding: '10px 14px 10px 36px', borderRadius: '8px', fontSize: '0.9rem',
                            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                            color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                        }} />
                </div>
            )}

            {/* Replies List */}
            {loadingReplies ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <Loader2 size={20} className="spin" /> Carregando...
                </div>
            ) : filteredReplies.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '40px', borderRadius: '12px',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-muted)',
                }}>
                    <Zap size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                    <p>{searchQuery ? 'Nenhuma resposta encontrada' : 'Nenhuma resposta rápida — crie uma acima ou use o Setup Completo'}</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '8px' }}>
                    {filteredReplies.map(reply => (
                        <div key={reply.shortCut} style={{
                            padding: '14px 16px', borderRadius: '10px',
                            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                            display: 'flex', gap: '12px', alignItems: 'flex-start',
                        }}>
                            {/* Shortcut badge */}
                            <div style={{
                                padding: '4px 10px', borderRadius: '6px', flexShrink: 0,
                                background: 'rgba(201,169,110,0.12)', border: '1px solid rgba(201,169,110,0.25)',
                                color: 'var(--gold)', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem',
                            }}>
                                {reply.shortCut}
                            </div>

                            {/* Text */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{
                                    fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0,
                                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                    maxHeight: '80px', overflow: 'hidden',
                                }}>
                                    {reply.text}
                                </p>
                                {reply.type !== 'text' && (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                        📎 {reply.type}
                                    </span>
                                )}
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                <button onClick={() => startEdit(reply)} title="Editar"
                                    style={{ padding: '6px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                    <Edit3 size={14} />
                                </button>
                                <button onClick={() => deleteReply(reply.shortCut)} disabled={actionLoading === reply.shortCut}
                                    title="Deletar"
                                    style={{ padding: '6px', borderRadius: '6px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', cursor: 'pointer' }}>
                                    {actionLoading === reply.shortCut ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Info */}
            <div style={{
                marginTop: '24px', padding: '14px 16px', borderRadius: '10px',
                background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
                fontSize: '0.8rem', color: 'var(--text-muted)',
            }}>
                💡 <strong>Dica:</strong> Digite o atalho (ex: <code style={{ color: 'var(--gold)' }}>/oi</code>) diretamente no WhatsApp para enviar a mensagem pré-configurada instantaneamente.
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
                .spin { animation: spin 1.2s linear infinite; }
            `}</style>
        </div>
    )
}
