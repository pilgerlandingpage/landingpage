'use client'

import { useEffect, useMemo, useState } from 'react'
import {
    Briefcase,
    Plus,
    Edit3,
    Trash2,
    CheckCircle,
    AlertCircle,
    Save,
    X,
    Shield,
    Users,
    Loader2,
} from 'lucide-react'

const ICON_MAP: Record<string, any> = {
    Briefcase,
    Shield,
    Users,
}

const COLOR_OPTIONS = [
    '#6366f1',
    '#3b82f6',
    '#0ea5e9',
    '#22c55e',
    '#f59e0b',
    '#f97316',
    '#ef4444',
    '#ec4899',
    '#8b5cf6',
    '#c9a96e',
]

interface Permission {
    id: string
    module_key: string
    label: string
    category: string
    description?: string
}

interface Sector {
    id: string
    name: string
    description: string
    color: string
    icon: string
    permissions: Permission[]
    user_count: number
}

const EMPTY_SECTOR_FORM = {
    name: '',
    description: '',
    color: '#6366f1',
    icon: 'Briefcase',
    permission_ids: [] as string[],
}

const EMPTY_TAG_FORM = {
    module_key: '',
    label: '',
    category: 'principal',
    description: '',
}

function toModuleKey(input: string) {
    return input
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
}

export default function SectorsPage() {
    const [sectors, setSectors] = useState<Sector[]>([])
    const [allPermissions, setAllPermissions] = useState<Permission[]>([])
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState<string | null>(null)
    const [creating, setCreating] = useState(false)
    const [saving, setSaving] = useState(false)
    const [savingTag, setSavingTag] = useState(false)
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

    const [form, setForm] = useState(EMPTY_SECTOR_FORM)
    const [tagForm, setTagForm] = useState(EMPTY_TAG_FORM)

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3500)
    }

    const fetchData = async () => {
        try {
            const res = await fetch('/api/admin/sectors')
            const data = await res.json()
            setSectors(data.sectors || [])
            setAllPermissions(data.all_permissions || [])
        } catch {
            showToast('Erro ao carregar setores', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const startEdit = (s: Sector) => {
        setEditing(s.id)
        setCreating(false)
        setForm({
            name: s.name,
            description: s.description || '',
            color: s.color,
            icon: s.icon,
            permission_ids: s.permissions
                .map(p => p.id || allPermissions.find(ap => ap.module_key === p.module_key)?.id || '')
                .filter(Boolean),
        })
    }

    const startCreate = () => {
        setCreating(true)
        setEditing(null)
        setForm(EMPTY_SECTOR_FORM)
    }

    const cancel = () => {
        setCreating(false)
        setEditing(null)
        setForm(EMPTY_SECTOR_FORM)
    }

    const togglePerm = (permId: string) => {
        setForm(prev => ({
            ...prev,
            permission_ids: prev.permission_ids.includes(permId)
                ? prev.permission_ids.filter(id => id !== permId)
                : [...prev.permission_ids, permId],
        }))
    }

    const handleSave = async () => {
        if (!form.name.trim()) {
            showToast('Nome e obrigatorio', 'error')
            return
        }

        setSaving(true)
        try {
            const method = creating ? 'POST' : 'PUT'
            const body = creating ? form : { id: editing, ...form }
            const res = await fetch('/api/admin/sectors', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            if (!res.ok) {
                const d = await res.json()
                throw new Error(d.error)
            }
            showToast(creating ? 'Setor criado' : 'Setor atualizado', 'success')
            cancel()
            fetchData()
        } catch (err: any) {
            showToast(err.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Excluir o setor "${name}"? Usuarios serao desvinculados.`)) return
        try {
            const res = await fetch(`/api/admin/sectors?id=${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Erro ao excluir')
            showToast('Setor excluido', 'success')
            fetchData()
        } catch (err: any) {
            showToast(err.message, 'error')
        }
    }

    const handleCreateTag = async () => {
        const label = tagForm.label.trim()
        if (!label) {
            showToast('Nome da tag e obrigatorio', 'error')
            return
        }

        const moduleKey = toModuleKey(tagForm.module_key || label)
        if (!moduleKey) {
            showToast('Chave da tag invalida', 'error')
            return
        }

        setSavingTag(true)
        try {
            const res = await fetch('/api/admin/permissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    module_key: moduleKey,
                    label,
                    category: tagForm.category,
                    description: tagForm.description,
                }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erro ao salvar tag')

            showToast(`Tag "${label}" salva`, 'success')
            setTagForm(prev => ({ ...EMPTY_TAG_FORM, category: prev.category }))
            fetchData()
        } catch (err: any) {
            showToast(err.message || 'Erro ao salvar tag', 'error')
        } finally {
            setSavingTag(false)
        }
    }

    const groupedPerms = useMemo(() => {
        return allPermissions.reduce((acc, p) => {
            if (!acc[p.category]) acc[p.category] = []
            acc[p.category].push(p)
            return acc
        }, {} as Record<string, Permission[]>)
    }, [allPermissions])

    const categoryLabels: Record<string, string> = {
        principal: 'Principal',
        financeiro: 'Financeiro',
        conteudo: 'Conteudo',
        automacao: 'Automacao',
        sistema: 'Sistema',
    }

    const categoryOrder = ['principal', 'financeiro', 'conteudo', 'automacao', 'sistema']
    const groupedPermEntries = Object.entries(groupedPerms).sort(([a], [b]) => {
        const ai = categoryOrder.indexOf(a)
        const bi = categoryOrder.indexOf(b)
        if (ai === -1 && bi === -1) return a.localeCompare(b)
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
    })

    if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Carregando...</div>

    return (
        <div>
            {toast && (
                <div className={`admin-toast ${toast.type}`}>
                    {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    {toast.msg}
                </div>
            )}

            <div className="admin-header">
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Shield size={26} /> Gestao de Setores
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
                        Crie setores e defina quais modulos cada um pode acessar.
                    </p>
                </div>
                <button className="btn btn-gold" onClick={startCreate} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Plus size={18} /> Novo Setor
                </button>
            </div>

            <div className="chart-card" style={{ marginBottom: 16 }}>
                <div className="chart-title" style={{ marginBottom: 10 }}>Tags de acesso</div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 12 }}>
                    Crie novas tags para aparecerem na selecao de permissoes dos setores.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    <div>
                        <label className="form-label">Chave da tag (module_key)</label>
                        <input
                            type="text"
                            value={tagForm.module_key}
                            onChange={e => setTagForm(p => ({ ...p, module_key: e.target.value }))}
                            placeholder="ex: financeiro_comissoes"
                            className="form-input"
                        />
                    </div>
                    <div>
                        <label className="form-label">Nome da tag</label>
                        <input
                            type="text"
                            value={tagForm.label}
                            onChange={e => setTagForm(p => ({ ...p, label: e.target.value }))}
                            placeholder="ex: Comissoes"
                            className="form-input"
                        />
                    </div>
                    <div>
                        <label className="form-label">Categoria</label>
                        <select
                            value={tagForm.category}
                            onChange={e => setTagForm(p => ({ ...p, category: e.target.value }))}
                            className="form-input"
                        >
                            <option value="principal">Principal</option>
                            <option value="financeiro">Financeiro</option>
                            <option value="conteudo">Conteudo</option>
                            <option value="automacao">Automacao</option>
                            <option value="sistema">Sistema</option>
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Descricao (opcional)</label>
                        <input
                            type="text"
                            value={tagForm.description}
                            onChange={e => setTagForm(p => ({ ...p, description: e.target.value }))}
                            placeholder="Breve descricao da permissao"
                            className="form-input"
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button
                            onClick={handleCreateTag}
                            disabled={savingTag}
                            className="btn btn-gold"
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                        >
                            {savingTag ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
                            {savingTag ? 'Salvando...' : 'Salvar Tag'}
                        </button>
                    </div>
                </div>

                <div style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Exemplo rapido: para criar uma tag de comissoes, use nome <strong>Comissoes</strong> e chave
                    {' '}<code>financeiro_comissoes</code>. Se a chave ficar vazia, ela sera gerada automaticamente pelo nome.
                </div>
            </div>

            {(creating || editing) && (
                <div className="chart-card" style={{ marginBottom: 24, border: '2px solid var(--gold)' }}>
                    <div className="chart-title" style={{ marginBottom: 16 }}>
                        {creating ? 'Novo Setor' : 'Editar Setor'}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Nome *</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                placeholder="Ex: Trafego, Vendas..."
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    borderRadius: 8,
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.9rem',
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Descricao</label>
                            <input
                                type="text"
                                value={form.description}
                                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                placeholder="Descricao breve do setor"
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    borderRadius: 8,
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.9rem',
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Cor do Setor</label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {COLOR_OPTIONS.map(c => (
                                <button
                                    key={c}
                                    onClick={() => setForm(p => ({ ...p, color: c }))}
                                    style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '50%',
                                        border: form.color === c ? '3px solid var(--text-primary)' : '2px solid transparent',
                                        background: c,
                                        cursor: 'pointer',
                                        transition: 'transform 0.15s',
                                        transform: form.color === c ? 'scale(1.2)' : 'scale(1)',
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                            Permissoes ({form.permission_ids.length} selecionadas)
                        </label>
                        {groupedPermEntries.map(([cat, perms]) => (
                            <div key={cat} style={{ marginBottom: 12 }}>
                                <div
                                    style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        color: 'var(--text-muted)',
                                        marginBottom: 6,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.04em',
                                    }}
                                >
                                    {categoryLabels[cat] || cat}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {perms.map(p => {
                                        const selected = form.permission_ids.includes(p.id)
                                        return (
                                            <button
                                                key={p.id}
                                                onClick={() => togglePerm(p.id)}
                                                style={{
                                                    padding: '6px 14px',
                                                    borderRadius: 20,
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600,
                                                    border: selected ? `2px solid ${form.color}` : '1px solid var(--border-color)',
                                                    background: selected ? `${form.color}22` : 'var(--bg-secondary)',
                                                    color: selected ? form.color : 'var(--text-muted)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                }}
                                            >
                                                {p.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button
                            onClick={cancel}
                            className="btn"
                            style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                            }}
                        >
                            <X size={16} /> Cancelar
                        </button>
                        <button onClick={handleSave} disabled={saving} className="btn btn-gold" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                            {saving ? 'Salvando...' : 'Salvar Setor'}
                        </button>
                    </div>
                </div>
            )}

            {sectors.length === 0 && !creating ? (
                <div className="chart-card" style={{ textAlign: 'center', padding: '60px 24px' }}>
                    <Shield size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: 8 }}>Nenhum setor criado ainda</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Clique em &quot;Novo Setor&quot; para criar o primeiro departamento.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                    {sectors.map(s => {
                        const Icon = ICON_MAP[s.icon] || Briefcase
                        return (
                            <div key={s.id} className="chart-card" style={{ padding: 20, borderLeft: `4px solid ${s.color}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                            <div
                                                style={{
                                                    width: 36,
                                                    height: 36,
                                                    borderRadius: 8,
                                                    background: `${s.color}22`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                <Icon size={18} style={{ color: s.color }} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{s.name}</div>
                                                {s.description && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.description}</div>}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                                            {s.permissions.map((p, i) => (
                                                <span
                                                    key={i}
                                                    style={{
                                                        fontSize: '0.7rem',
                                                        padding: '3px 10px',
                                                        borderRadius: 20,
                                                        background: `${s.color}15`,
                                                        color: s.color,
                                                        fontWeight: 600,
                                                        border: `1px solid ${s.color}33`,
                                                    }}
                                                >
                                                    {p.label}
                                                </span>
                                            ))}
                                            {s.permissions.length === 0 && (
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sem permissoes</span>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            <Users size={14} /> {s.user_count} {s.user_count === 1 ? 'usuario' : 'usuarios'}
                                        </div>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button
                                                onClick={() => startEdit(s)}
                                                title="Editar"
                                                style={{
                                                    padding: 6,
                                                    borderRadius: 6,
                                                    border: '1px solid var(--border-color)',
                                                    background: 'var(--bg-secondary)',
                                                    color: 'var(--text-primary)',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <Edit3 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(s.id, s.name)}
                                                title="Excluir"
                                                style={{
                                                    padding: 6,
                                                    borderRadius: 6,
                                                    border: '1px solid rgba(239,68,68,0.3)',
                                                    background: 'rgba(239,68,68,0.1)',
                                                    color: '#ef4444',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <style>{`
                .admin-toast {
                    position: fixed;
                    top: 24px;
                    right: 24px;
                    padding: 14px 24px;
                    border-radius: 12px;
                    font-size: 0.9rem;
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    z-index: 10000;
                    animation: toastIn 0.35s ease-out;
                    box-shadow: 0 8px 30px rgba(0,0,0,0.4);
                }
                .admin-toast.success {
                    background: rgba(74,222,128,0.15);
                    border: 1px solid rgba(74,222,128,0.3);
                    color: var(--success);
                }
                .admin-toast.error {
                    background: rgba(248,113,113,0.15);
                    border: 1px solid rgba(248,113,113,0.3);
                    color: var(--danger);
                }
                @keyframes toastIn {
                    from { opacity: 0; transform: translateY(-12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    )
}
