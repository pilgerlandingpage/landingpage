'use client'

import { useState, useEffect } from 'react'
import {
    Tag, Loader2, Plus, Trash2, Edit3, RefreshCw,
    CheckCircle2, Smartphone, Save
} from 'lucide-react'
import AdminLoadingState from '@/components/admin/AdminLoadingState'

interface Instance {
    id: string; instance_name: string; instance_token: string; status: string
    virtual_brokers?: { name: string } | null
}

interface Label {
    id: string; name: string; color: number
    predefinedId?: string
}

const LABEL_COLORS: Record<number, string> = {
    0: '#00a884', 1: '#53bdeb', 2: '#f7c948', 3: '#ff6b6b',
    4: '#a78bfa', 5: '#fb923c', 6: '#f472b6', 7: '#22d3ee',
    8: '#4ade80', 9: '#e879f9', 10: '#fbbf24', 11: '#60a5fa',
    12: '#34d399', 13: '#f87171', 14: '#818cf8', 15: '#fb7185',
    16: '#38bdf8', 17: '#a3e635', 18: '#c084fc', 19: '#fdba74',
}

export default function LabelsPage() {
    const [instances, setInstances] = useState<Instance[]>([])
    const [selectedInstance, setSelectedInstance] = useState('')
    const [labels, setLabels] = useState<Label[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingLabels, setLoadingLabels] = useState(false)
    const [newLabelName, setNewLabelName] = useState('')
    const [newLabelColor, setNewLabelColor] = useState(0)
    const [editingLabel, setEditingLabel] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    const [editColor, setEditColor] = useState(0)
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

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

    useEffect(() => { if (selectedInstance) loadLabels() }, [selectedInstance])

    const loadLabels = async () => {
        if (!selectedInstance) return
        setLoadingLabels(true)
        try {
            const res = await fetch(`/api/admin/whatsapp/labels?instance_id=${selectedInstance}`)
            const data = await res.json()
            if (data.success) {
                setLabels(Array.isArray(data.labels) ? data.labels : (data.labels?.labels || []))
            }
        } catch { /* ignore */ }
        finally { setLoadingLabels(false) }
    }

    const createLabel = async () => {
        if (!newLabelName.trim()) return
        setActionLoading('create')
        try {
            const res = await fetch('/api/admin/whatsapp/labels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create', instanceId: selectedInstance, name: newLabelName.trim(), color: newLabelColor })
            })
            const data = await res.json()
            if (data.success) {
                setFeedback({ type: 'success', text: `✅ Etiqueta "${newLabelName}" criada!` })
                setNewLabelName('')
                loadLabels()
            } else {
                setFeedback({ type: 'error', text: `❌ ${data.message}` })
            }
        } catch { setFeedback({ type: 'error', text: '❌ Erro de conexão' }) }
        finally { setActionLoading(null) }
    }

    const updateLabel = async (labelId: string) => {
        setActionLoading(labelId)
        try {
            const res = await fetch('/api/admin/whatsapp/labels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'edit', instanceId: selectedInstance, labelId, name: editName, color: editColor })
            })
            const data = await res.json()
            if (data.success) {
                setFeedback({ type: 'success', text: '✅ Etiqueta atualizada!' })
                setEditingLabel(null)
                loadLabels()
            }
        } catch { /* ignore */ }
        finally { setActionLoading(null) }
    }

    const deleteLabel = async (labelId: string) => {
        setActionLoading(labelId)
        try {
            const res = await fetch('/api/admin/whatsapp/labels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', instanceId: selectedInstance, labelId })
            })
            const data = await res.json()
            if (data.success) {
                setFeedback({ type: 'success', text: '✅ Etiqueta removida!' })
                loadLabels()
            }
        } catch { /* ignore */ }
        finally { setActionLoading(null) }
    }

    const refreshAllLabels = async () => {
        setActionLoading('refresh')
        try {
            await fetch('/api/admin/whatsapp/labels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'refresh', instanceId: selectedInstance, forceRefresh: true })
            })
            await loadLabels()
            setFeedback({ type: 'success', text: '✅ Etiquetas sincronizadas com WhatsApp!' })
        } catch { /* ignore */ }
        finally { setActionLoading(null) }
    }

    if (loading) return <AdminLoadingState minHeight="400px" />

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.5rem', margin: 0 }}>
                        <Tag size={26} style={{ color: 'var(--gold)' }} /> Etiquetas WhatsApp
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
                        Gerencie etiquetas para organizar seus leads e conversas
                    </p>
                </div>
                <button onClick={refreshAllLabels} disabled={actionLoading === 'refresh'}
                    style={{
                        padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--border)',
                        background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500,
                    }}>
                    <RefreshCw size={16} className={actionLoading === 'refresh' ? 'spin' : ''} />
                    Sincronizar
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

            {/* Create New Label */}
            <div style={{
                padding: '20px', borderRadius: '12px', marginBottom: '24px',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            }}>
                <h3 style={{ fontSize: '0.9rem', margin: '0 0 12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Plus size={16} style={{ color: 'var(--gold)' }} /> Nova Etiqueta
                </h3>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <input value={newLabelName} onChange={e => setNewLabelName(e.target.value)}
                            placeholder="Nome da etiqueta..."
                            onKeyDown={e => e.key === 'Enter' && createLabel()}
                            style={{
                                width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem',
                                background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                            }} />
                    </div>
                    {/* Color picker */}
                    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', maxWidth: '200px' }}>
                        {Object.entries(LABEL_COLORS).slice(0, 10).map(([idx, color]) => (
                            <div key={idx} onClick={() => setNewLabelColor(Number(idx))}
                                style={{
                                    width: '22px', height: '22px', borderRadius: '4px', cursor: 'pointer',
                                    background: color, border: newLabelColor === Number(idx) ? '2px solid white' : '2px solid transparent',
                                    transition: 'border 0.1s',
                                }} />
                        ))}
                    </div>
                    <button onClick={createLabel} disabled={actionLoading === 'create' || !newLabelName.trim()}
                        style={{
                            padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                            background: 'linear-gradient(135deg, var(--gold), #b8860b)',
                            color: '#000', fontWeight: 600, fontSize: '0.85rem',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            opacity: !newLabelName.trim() ? 0.5 : 1,
                        }}>
                        {actionLoading === 'create' ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
                        Criar
                    </button>
                </div>
            </div>

            {/* Labels List */}
            {loadingLabels ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <Loader2 size={20} className="spin" /> Carregando etiquetas...
                </div>
            ) : labels.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '40px', borderRadius: '12px',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-muted)',
                }}>
                    <Tag size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                    <p>Nenhuma etiqueta encontrada — crie uma acima ou sincronize com o WhatsApp</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '8px' }}>
                    {labels.map(label => (
                        <div key={label.id} style={{
                            padding: '12px 16px', borderRadius: '10px',
                            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                            display: 'flex', alignItems: 'center', gap: '12px',
                        }}>
                            {/* Color dot */}
                            <div style={{
                                width: '14px', height: '14px', borderRadius: '4px', flexShrink: 0,
                                background: LABEL_COLORS[label.color] || LABEL_COLORS[0],
                            }} />

                            {editingLabel === label.id ? (
                                <>
                                    <input value={editName} onChange={e => setEditName(e.target.value)}
                                        autoFocus
                                        style={{
                                            flex: 1, padding: '6px 10px', borderRadius: '6px', fontSize: '0.85rem',
                                            background: 'rgba(255,255,255,0.08)', border: '1px solid var(--gold)',
                                            color: 'var(--text-primary)', outline: 'none',
                                        }} />
                                    <div style={{ display: 'flex', gap: '2px' }}>
                                        {Object.entries(LABEL_COLORS).slice(0, 8).map(([idx, color]) => (
                                            <div key={idx} onClick={() => setEditColor(Number(idx))}
                                                style={{
                                                    width: '18px', height: '18px', borderRadius: '3px', cursor: 'pointer',
                                                    background: color, border: editColor === Number(idx) ? '2px solid white' : '2px solid transparent',
                                                }} />
                                        ))}
                                    </div>
                                    <button onClick={() => updateLabel(label.id)} disabled={actionLoading === label.id}
                                        style={{ padding: '6px', borderRadius: '6px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', cursor: 'pointer' }}>
                                        {actionLoading === label.id ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                                    </button>
                                    <button onClick={() => setEditingLabel(null)}
                                        style={{ padding: '6px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}>
                                        ✕
                                    </button>
                                </>
                            ) : (
                                <>
                                    <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                                        {label.name}
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                        {label.id}
                                    </span>
                                    <button onClick={() => { setEditingLabel(label.id); setEditName(label.name); setEditColor(label.color) }}
                                        title="Editar"
                                        style={{ padding: '6px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                        <Edit3 size={14} />
                                    </button>
                                    <button onClick={() => deleteLabel(label.id)} disabled={actionLoading === label.id}
                                        title="Deletar"
                                        style={{ padding: '6px', borderRadius: '6px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', cursor: 'pointer' }}>
                                        {actionLoading === label.id ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                                    </button>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
                .spin { animation: spin 1.2s linear infinite; }
            `}</style>
        </div>
    )
}
