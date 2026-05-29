'use client'

import { useEffect, useRef, useState } from 'react'
import {
    Users, UserPlus, Mail, Phone, CheckCircle, AlertCircle,
    Loader2, Save, X, Edit3, User, Power, Crown, Search, Trash2, KeyRound,
    Smartphone, Wifi, WifiOff, RefreshCw, Send
} from 'lucide-react'
import AdminLoadingState from '@/components/admin/AdminLoadingState'

interface Sector { id: string; name: string; color: string; icon: string }
interface AdminUser {
    id: string; auth_user_id: string; name: string; email: string; phone: string
    is_master: boolean; is_active: boolean; created_at: string
    sectors: Sector[]
}

interface WhatsAppUserInstance {
    id: string
    instance_name: string
    phone_number: string | null
    status: 'disconnected' | 'connecting' | 'connected'
}

export default function UsersPage() {
    const [users, setUsers] = useState<AdminUser[]>([])
    const [sectors, setSectors] = useState<Sector[]>([])
    const [canGrantMaster, setCanGrantMaster] = useState(false)
    const [canCreateUsers, setCanCreateUsers] = useState(false)
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [editing, setEditing] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [search, setSearch] = useState('')
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
    // WhatsApp status state
    const [userWhatsapp, setUserWhatsapp] = useState<WhatsAppUserInstance | null>(null)
    const [userWhatsappLoading, setUserWhatsappLoading] = useState(false)
    const [sendingResetUserId, setSendingResetUserId] = useState<string | null>(null)
    const [sendingFirstAccessUserId, setSendingFirstAccessUserId] = useState<string | null>(null)
    const formCardRef = useRef<HTMLDivElement | null>(null)

    const [form, setForm] = useState({
        name: '', email: '', phone: '',
        is_master: false, sector_ids: [] as string[],
    })

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type }); setTimeout(() => setToast(null), 3500)
    }

    const fetchData = async () => {
        try {
            const [usersRes, permissionsRes] = await Promise.all([
                fetch('/api/admin/users?include_sectors=1'),
                fetch('/api/admin/permissions')
            ])
            const usersData = await usersRes.json()
            const permissionsData = permissionsRes.ok ? await permissionsRes.json() : {}
            const isMaster = Boolean(permissionsData?.is_master)
            if (Array.isArray(usersData)) {
                setUsers(usersData)
                setSectors([])
                setCanCreateUsers(isMaster)
            } else {
                setUsers(Array.isArray(usersData?.users) ? usersData.users : [])
                setSectors(Array.isArray(usersData?.sectors) ? usersData.sectors : [])
                setCanCreateUsers(isMaster || Boolean(usersData?.access?.can_create_users))
            }
            setCanGrantMaster(isMaster)
        } catch { showToast('Erro ao carregar dados', 'error') }
        finally { setLoading(false) }
    }

    useEffect(() => { fetchData() }, [])

    useEffect(() => {
        if (!creating && !editing) return
        formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, [creating, editing])

    const startCreate = () => {
        if (!canCreateUsers) {
            showToast('Somente Master e Diretoria podem cadastrar novos usuarios.', 'error')
            return
        }
        setCreating(true); setEditing(null)
        setForm({ name: '', email: '', phone: '', is_master: false, sector_ids: [] as string[] })
        setUserWhatsapp(null)
    }

    const startEdit = (u: AdminUser) => {
        const userSectors = Array.isArray(u.sectors) ? u.sectors : []
        setEditing(u.id); setCreating(false)
        setForm({
            name: u.name, email: u.email, phone: u.phone || '',
            is_master: canGrantMaster ? u.is_master : false, sector_ids: userSectors.map(s => s.id),
        })
        setUserWhatsapp(null)
        loadUserWhatsApp(u.id)
    }

    async function loadUserWhatsApp(userId: string) {
        setUserWhatsappLoading(true)
        try {
            const res = await fetch(`/api/admin/whatsapp/instances?admin_user_id=${userId}`)
            const data = await res.json()
            if (data?.instances?.length > 0) setUserWhatsapp(data.instances[0])
            else setUserWhatsapp(null)
        } catch { setUserWhatsapp(null) }
        finally { setUserWhatsappLoading(false) }
    }

    async function checkUserWhatsAppStatus() {
        if (!userWhatsapp) return
        try {
            const res = await fetch(`/api/admin/whatsapp/status?instanceId=${userWhatsapp.id}`)
            const data = await res.json()
            if (!res.ok || data?.success === false) {
                if (data?.blocked_phone_mismatch) {
                    showToast(data?.message || 'WhatsApp bloqueado por divergencia com o telefone cadastrado.', 'error')
                } else if (data?.message) {
                    showToast(data.message, 'error')
                }
            }
            if (data.status) {
                setUserWhatsapp(prev => prev ? { ...prev, status: data.status, phone_number: data.phone_number || prev.phone_number } : null)
            }
            if (editing) await loadUserWhatsApp(editing)
        } catch (err: any) {
            showToast(err?.message || 'Falha ao verificar status do WhatsApp.', 'error')
        }
    }

    const cancel = () => { setCreating(false); setEditing(null) }

    const toggleSector = (sid: string) => {
        setForm(prev => ({
            ...prev,
            sector_ids: prev.sector_ids.includes(sid)
                ? prev.sector_ids.filter(id => id !== sid)
                : [...prev.sector_ids, sid]
        }))
    }

    const handleSave = async () => {
        if (creating && !canCreateUsers) {
            showToast('Somente Master e Diretoria podem cadastrar novos usuarios.', 'error')
            return
        }
        if (creating && (!form.email || !form.phone)) {
            showToast('Email e telefone sao obrigatorios', 'error'); return
        }
        setSaving(true)
        try {
            const method = creating ? 'POST' : 'PUT'
            const body: any = creating
                ? { name: form.name, email: form.email, phone: form.phone, is_master: canGrantMaster ? form.is_master : false, sector_ids: form.sector_ids }
                : {
                    id: editing,
                    name: form.name,
                    phone: form.phone,
                    ...(canGrantMaster ? { is_master: form.is_master } : {}),
                    sector_ids: form.sector_ids,
                }

            const res = await fetch('/api/admin/users', {
                method, headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            const successMessage = data?.message || (creating ? 'Usuario criado!' : 'Usuario atualizado!')
            if (creating && data?.invite_warning) {
                const warningMessage = data?.first_access_link
                    ? `${successMessage} Aviso: ${data.invite_warning} Link manual: ${data.first_access_link}`
                    : `${successMessage} Aviso: ${data.invite_warning}`
                showToast(warningMessage, 'error')
            } else {
                showToast(successMessage, 'success')
            }
            cancel(); fetchData()
        } catch (err: any) { showToast(err.message, 'error') }
        finally { setSaving(false) }
    }

    const toggleActive = async (u: AdminUser) => {
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: u.id, is_active: !u.is_active })
            })
            if (!res.ok) throw new Error('Erro')
            showToast(u.is_active ? 'Usuario desativado' : 'Usuario ativado', 'success')
            fetchData()
        } catch (err: any) { showToast(err.message, 'error') }
    }

    const deleteUser = async (u: AdminUser) => {
        if (!canGrantMaster) {
            showToast('Somente Master pode excluir usuarios.', 'error')
            return
        }

        const confirmed = window.confirm(
            `Excluir o usuario "${u.name}"?\n\nEssa acao remove o cadastro e nao pode ser desfeita.`
        )
        if (!confirmed) return

        try {
            const res = await fetch('/api/admin/users', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: u.id })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || 'Erro ao excluir usuario')

            if (data?.warning) {
                showToast(`${data.message} ${data.warning}`, 'error')
            } else {
                showToast(data?.message || 'Usuario excluido com sucesso.', 'success')
            }
            fetchData()
        } catch (err: any) {
            showToast(err.message, 'error')
        }
    }

    const sendPasswordResetLink = async (u: AdminUser) => {
        if (!canCreateUsers) {
            showToast('Somente Master e Diretoria podem enviar redefinicao de senha.', 'error')
            return
        }

        if (!u.phone) {
            showToast('Este usuario nao possui telefone para envio no WhatsApp.', 'error')
            return
        }

        const confirmed = window.confirm(
            `Enviar link de redefinicao de senha para "${u.name}" no WhatsApp?`
        )
        if (!confirmed) return

        setSendingResetUserId(u.id)
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'send_password_reset', id: u.id })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || 'Erro ao enviar redefinicao')

            if (data?.reset_warning) {
                const warningMessage = data?.reset_link
                    ? `${data.message} Aviso: ${data.reset_warning} Link manual: ${data.reset_link}`
                    : `${data.message} Aviso: ${data.reset_warning}`
                showToast(warningMessage, 'error')
            } else {
                showToast(data?.message || 'Link de redefinicao enviado com sucesso.', 'success')
            }
        } catch (err: any) {
            showToast(err.message, 'error')
        } finally {
            setSendingResetUserId(null)
        }
    }

    const resendFirstAccessLink = async (u: AdminUser) => {
        if (!canCreateUsers) {
            showToast('Somente Master e Diretoria podem reenviar primeiro acesso.', 'error')
            return
        }

        if (!u.phone) {
            showToast('Este usuario nao possui telefone para envio no WhatsApp.', 'error')
            return
        }

        const confirmed = window.confirm(
            `Reenviar link de primeiro acesso para "${u.name}" no WhatsApp?`
        )
        if (!confirmed) return

        setSendingFirstAccessUserId(u.id)
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'resend_first_access', id: u.id })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || 'Erro ao reenviar primeiro acesso')

            if (data?.invite_warning) {
                const warningMessage = data?.first_access_link
                    ? `${data.message} Aviso: ${data.invite_warning} Link manual: ${data.first_access_link}`
                    : `${data.message} Aviso: ${data.invite_warning}`
                showToast(warningMessage, 'error')
            } else {
                showToast(data?.message || 'Link de primeiro acesso reenviado com sucesso.', 'success')
            }
        } catch (err: any) {
            showToast(err.message, 'error')
        } finally {
            setSendingFirstAccessUserId(null)
        }
    }

    const filtered = users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    )

    if (loading) return <AdminLoadingState message="Carregando usuários..." />

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
                        <Users size={26} /> Gestao de Usuarios
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
                        Gerencie usuarios, setores e permissoes de acesso
                    </p>
                </div>
                {canCreateUsers ? (
                    <button className="btn btn-gold" onClick={startCreate} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <UserPlus size={18} /> Novo Usuario
                    </button>
                ) : (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right', maxWidth: 280 }}>
                        Somente Master e Diretoria podem cadastrar novos usuarios.
                    </div>
                )}
            </div>

            {/* Form */}
            {(creating || editing) && (
                <div ref={formCardRef} className="chart-card" style={{ marginBottom: 24, border: '2px solid var(--gold)', scrollMarginTop: 96 }}>
                    <div className="chart-title" style={{ marginBottom: 16 }}>
                        {creating ? 'Novo Usuario' : 'Editar Usuario'}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div>
                            <label className="rbac-label">Nome Completo *</label>
                            <div className="rbac-input-wrap">
                                <User size={16} className="rbac-input-icon" />
                                <input type="text" value={form.name}
                                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                    placeholder="Ex: Ana Silva" className="rbac-input" />
                            </div>
                        </div>
                        <div>
                            <label className="rbac-label">Email {creating && '*'}</label>
                            <div className="rbac-input-wrap">
                                <Mail size={16} className="rbac-input-icon" />
                                <input type="email" value={form.email}
                                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                    placeholder="usuario@email.com" className="rbac-input"
                                    disabled={!!editing} />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                        <div>
                            <label className="rbac-label">Telefone {creating && '*'}</label>
                            <div className="rbac-input-wrap">
                                <Phone size={16} className="rbac-input-icon" />
                                <input type="tel" value={form.phone}
                                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                                    placeholder="5547999999999" className="rbac-input" />
                            </div>
                        </div>
                    </div>
                    {creating && (
                        <div style={{ marginTop: -8, marginBottom: 16, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            A senha nao e definida neste cadastro. O novo usuario recebera no WhatsApp um link de primeiro acesso para criar a propria senha.
                        </div>
                    )}

                                        {/* Master toggle */}
                    {canGrantMaster ? (
                        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <label className="rbac-toggle">
                                <input type="checkbox" checked={form.is_master}
                                    onChange={e => setForm(p => ({ ...p, is_master: e.target.checked }))} />
                                <span className="rbac-toggle-slider" />
                            </label>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Crown size={16} style={{ color: '#f59e0b' }} /> Admin Master
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Acesso total a todos os modulos</div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ marginBottom: 16, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Seu perfil pode gerenciar usuarios, mas nao pode alterar permissao de Admin Master.
                        </div>
                    )}

                    {/* Sector Assignment */}
                    {!form.is_master && (
                        <div style={{ marginBottom: 16 }}>
                            <label className="rbac-label">Setores ({form.sector_ids.length} selecionados)</label>
                            {sectors.length === 0 ? (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    Nenhum setor criado. Crie setores primeiro em Configuracoes para Setores.
                                </p>
                            ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {sectors.map(s => {
                                        const selected = form.sector_ids.includes(s.id)
                                        return (
                                            <button key={s.id} onClick={() => toggleSector(s.id)}
                                                style={{
                                                    padding: '8px 16px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600,
                                                    border: selected ? `2px solid ${s.color}` : '1px solid var(--border-color)',
                                                    background: selected ? `${s.color}22` : 'var(--bg-secondary)',
                                                    color: selected ? s.color : 'var(--text-muted)',
                                                    cursor: 'pointer', transition: 'all 0.2s'
                                                }}>
                                                {s.name}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* WhatsApp status - canonical setup stays in WhatsApp Web > Conectados */}
                    {editing && (
                        <div style={{ padding: '16px', background: 'rgba(34, 197, 94, 0.05)', borderRadius: '10px', border: '1px solid rgba(34, 197, 94, 0.2)', marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <Smartphone size={16} style={{ color: '#22c55e' }} />
                                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Status do WhatsApp</span>
                            </div>
                            <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '12px' }}>
                                A conexão e as regras do agente são gerenciadas em WhatsApp Web &gt; Conectados e Config do Agente.
                            </p>

                            {userWhatsappLoading ? (
                                <div style={{ textAlign: 'center', padding: '12px' }}>
                                    <Loader2 size={20} className="spin" style={{ color: '#22c55e' }} />
                                </div>
                            ) : userWhatsapp?.status === 'connected' ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px' }}>
                                    <Wifi size={16} style={{ color: '#22c55e' }} />
                                    <span style={{ color: '#22c55e', fontWeight: 600, fontSize: '0.85rem' }}>Conectado</span>
                                    {userWhatsapp.phone_number && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}> - {userWhatsapp.phone_number}</span>}
                                    <button type="button" onClick={checkUserWhatsAppStatus} style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <RefreshCw size={10} /> Verificar
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'rgba(148, 163, 184, 0.08)', borderRadius: '8px' }}>
                                    <WifiOff size={16} style={{ color: '#888' }} />
                                    <span style={{ color: '#888', fontWeight: 600, fontSize: '0.85rem' }}>
                                        {userWhatsapp?.status === 'connecting' ? 'Conectando' : 'Sem WhatsApp vinculado'}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={cancel} className="btn" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <X size={16} /> Cancelar
                        </button>
                        <button onClick={handleSave} disabled={saving} className="btn btn-gold" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                            {saving ? 'Salvando...' : creating ? 'Criar Usuario' : 'Salvar Alteracoes'}
                        </button>
                    </div>
                </div>
            )}

            {/* Search */}
            <div style={{ marginBottom: 16, position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nome ou email..."
                    style={{
                        width: '100%', padding: '10px 14px 10px 40px', borderRadius: 10,
                        border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)', fontSize: '0.9rem'
                    }} />
            </div>

            {/* Users list */}
            {filtered.length === 0 ? (
                <div className="chart-card" style={{ textAlign: 'center', padding: '60px 24px' }}>
                    <Users size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Nenhum usuario encontrado</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                    {filtered.map(u => (
                        <div key={u.id} className="chart-card" style={{
                            padding: 16, opacity: u.is_active ? 1 : 0.5,
                            borderLeft: u.is_master ? '4px solid #f59e0b' : '4px solid var(--border-color)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span style={{ fontWeight: 700, fontSize: '1rem' }}>{u.name}</span>
                                        {u.is_master && (
                                            <span style={{
                                                fontSize: '0.65rem', padding: '2px 8px', borderRadius: 20,
                                                background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 700,
                                                display: 'flex', alignItems: 'center', gap: 4
                                            }}>
                                                <Crown size={10} /> MASTER
                                            </span>
                                        )}
                                        {!u.is_active && (
                                            <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 20, background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 700 }}>
                                                DESATIVADO
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={12} /> {u.email}</span>
                                        {u.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={12} /> {u.phone}</span>}
                                    </div>
                                    {u.sectors.length > 0 && (
                                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                            {u.sectors.map(s => (
                                                <span key={s.id} style={{
                                                    fontSize: '0.7rem', padding: '2px 10px', borderRadius: 20,
                                                    background: `${s.color}15`, color: s.color, fontWeight: 600,
                                                    border: `1px solid ${s.color}33`
                                                }}>
                                                    {s.name}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button onClick={() => startEdit(u)} title="Editar"
                                        style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                                        <Edit3 size={14} />
                                    </button>
                                    <button onClick={() => toggleActive(u)} title={u.is_active ? 'Desativar' : 'Ativar'}
                                        style={{
                                            padding: 8, borderRadius: 6, cursor: 'pointer',
                                            border: u.is_active ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(74,222,128,0.3)',
                                            background: u.is_active ? 'rgba(239,68,68,0.1)' : 'rgba(74,222,128,0.1)',
                                            color: u.is_active ? '#ef4444' : '#4ade80'
                                        }}>
                                        <Power size={14} />
                                    </button>
                                    {canCreateUsers && (canGrantMaster || !u.is_master) && (
                                        <button
                                            onClick={() => resendFirstAccessLink(u)}
                                            title="Reenviar primeiro acesso"
                                            disabled={sendingFirstAccessUserId === u.id}
                                            style={{
                                                padding: 8, borderRadius: 6, cursor: 'pointer',
                                                border: '1px solid rgba(34,197,94,0.35)',
                                                background: 'rgba(34,197,94,0.12)',
                                                color: '#22c55e',
                                                opacity: sendingFirstAccessUserId === u.id ? 0.7 : 1
                                            }}>
                                            {sendingFirstAccessUserId === u.id ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                                        </button>
                                    )}
                                    {canCreateUsers && (canGrantMaster || !u.is_master) && (
                                        <button
                                            onClick={() => sendPasswordResetLink(u)}
                                            title="Enviar redefinicao de senha"
                                            disabled={sendingResetUserId === u.id}
                                            style={{
                                                padding: 8, borderRadius: 6, cursor: 'pointer',
                                                border: '1px solid rgba(59,130,246,0.35)',
                                                background: 'rgba(59,130,246,0.12)',
                                                color: '#3b82f6',
                                                opacity: sendingResetUserId === u.id ? 0.7 : 1
                                            }}>
                                            {sendingResetUserId === u.id ? <Loader2 size={14} className="spin" /> : <KeyRound size={14} />}
                                        </button>
                                    )}
                                    {canGrantMaster && !u.is_master && (
                                        <button onClick={() => deleteUser(u)} title="Excluir usuario"
                                            style={{
                                                padding: 8, borderRadius: 6, cursor: 'pointer',
                                                border: '1px solid rgba(239,68,68,0.35)',
                                                background: 'rgba(239,68,68,0.12)',
                                                color: '#ef4444'
                                            }}>
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style>{`
                .rbac-label { display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 4px; font-weight: 500; }
                .rbac-input-wrap { position: relative; }
                .rbac-input-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
                .rbac-input { width: 100%; padding: 10px 14px 10px 36px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary); font-size: 0.9rem; }
                .rbac-input:disabled { opacity: 0.5; }
                .rbac-toggle { position: relative; display: inline-block; width: 44px; height: 24px; }
                .rbac-toggle input { opacity: 0; width: 0; height: 0; }
                .rbac-toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: var(--border-color); border-radius: 24px; transition: 0.3s; }
                .rbac-toggle-slider:before { content: ''; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s; }
                .rbac-toggle input:checked + .rbac-toggle-slider { background: #f59e0b; }
                .rbac-toggle input:checked + .rbac-toggle-slider:before { transform: translateX(20px); }
                .admin-toast { position: fixed; top: 24px; right: 24px; padding: 14px 24px; border-radius: 12px; font-size: 0.9rem; font-weight: 500; display: flex; align-items: center; gap: 10px; z-index: 10000; animation: toastIn 0.35s ease-out; box-shadow: 0 8px 30px rgba(0,0,0,0.4); }
                .admin-toast.success { background: rgba(74,222,128,0.15); border: 1px solid rgba(74,222,128,0.3); color: var(--success); }
                .admin-toast.error { background: rgba(248,113,113,0.15); border: 1px solid rgba(248,113,113,0.3); color: var(--danger); }
                @keyframes toastIn { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }
            `}</style>
        </div>
    )
}

