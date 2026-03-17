'use client'

import { useEffect, useState } from 'react'
import {
    User, Mail, Phone, Lock, CheckCircle, AlertCircle, Loader2,
    Smartphone, Wifi, WifiOff, QrCode, Brain, Clock, RefreshCw, Save
} from 'lucide-react'

interface WhatsAppInstance {
    id: string
    instance_name: string
    phone_number: string | null
    status: 'disconnected' | 'connecting' | 'connected'
}

export default function MinhaContaPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

    const [form, setForm] = useState({
        id: '',
        name: '', email: '', phone: '', password: '',
        shadow_agent_prompt: '',
        shadow_agent_enabled: false,
        available_from: '08:00',
        available_until: '20:00',
        transfer_message: ''
    })

    const [whatsapp, setWhatsapp] = useState<WhatsAppInstance | null>(null)
    const [qrCode, setQrCode] = useState<string | null>(null)
    const [qrLoading, setQrLoading] = useState(false)

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type }); setTimeout(() => setToast(null), 3500)
    }

    const fetchData = async () => {
        try {
            const res = await fetch('/api/admin/me')
            const data = await res.json()
            if (data.success) {
                setForm(prev => ({
                    ...prev,
                    id: data.user.id,
                    name: data.user.name,
                    email: data.user.email,
                    phone: data.user.phone || '',
                    shadow_agent_prompt: data.user.shadow_agent_prompt || '',
                    shadow_agent_enabled: data.user.shadow_agent_enabled || false,
                    available_from: data.user.available_from || '08:00',
                    available_until: data.user.available_until || '20:00',
                    transfer_message: data.user.transfer_message || ''
                }))
                if (data.whatsapp_instances && data.whatsapp_instances.length > 0) {
                    setWhatsapp(data.whatsapp_instances[0])
                }
            }
        } catch (err) {
            showToast('Erro ao carregar dados', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchData() }, [])

    const handleSave = async () => {
        if (form.password && form.password.length > 0 && form.password.length < 6) {
            showToast('A senha deve ter pelo menos 6 caracteres', 'error')
            return
        }

        setSaving(true)
        try {
            const body: any = {
                name: form.name,
                phone: form.phone,
                shadow_agent_prompt: form.shadow_agent_prompt,
                shadow_agent_enabled: form.shadow_agent_enabled,
                available_from: form.available_from,
                available_until: form.available_until,
                transfer_message: form.transfer_message
            }
            if (form.password) body.password = form.password

            const res = await fetch('/api/admin/me', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })
            if (!res.ok) throw new Error('Erro ao salvar as alterações.')
            
            showToast('Perfil atualizado com sucesso!', 'success')
            setForm(p => ({ ...p, password: '' })) // Clear password field
        } catch (err: any) {
            showToast(err.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    const connectWhatsApp = async () => {
        if (!form.id) return
        setQrLoading(true)
        try {
            const res = await fetch('/api/admin/whatsapp/qrcode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instance_name: `user_${form.id}_${Date.now()}`, admin_user_id: form.id })
            })
            const data = await res.json()
            if (data.qrcode) setQrCode(data.qrcode)
        } catch (err) {
            showToast('Falha ao gerar QR Code', 'error')
        } finally {
            setQrLoading(false)
        }
    }

    const checkWhatsAppStatus = async () => {
        if (!whatsapp) return
        try {
            const res = await fetch(`/api/admin/whatsapp/status?instance_name=${whatsapp.instance_name}`)
            const data = await res.json()
            if (data.status) {
                setWhatsapp(prev => prev ? { ...prev, status: data.status, phone_number: data.phone_number || prev.phone_number } : null)
                if (data.status === 'connected') setQrCode(null)
            }
        } catch {}
    }

    if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Carregando Meu Perfil...</div>

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
                        <User size={26} /> Minha Conta
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
                        Gerencie seus dados pessoais, WhatsApp e configurações do Agente Sombra
                    </p>
                </div>
                <button 
                    className="btn btn-gold" 
                    onClick={handleSave} 
                    disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                    {saving ? <Loader2 size={18} className="spin" /> : <Save size={18} />}
                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24, maxWidth: '900px' }}>
                
                {/* DADOS PESSOAIS */}
                <div className="chart-card" style={{ borderTop: '4px solid var(--gold)' }}>
                    <div className="chart-title" style={{ marginBottom: 16 }}>✏️ Dados Pessoais</div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16, marginBottom: 16 }}>
                        <div>
                            <label className="rbac-label">Nome Completo</label>
                            <div className="rbac-input-wrap">
                                <User size={16} className="rbac-input-icon" />
                                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="rbac-input" />
                            </div>
                        </div>
                        <div>
                            <label className="rbac-label">Email (Não editável)</label>
                            <div className="rbac-input-wrap">
                                <Mail size={16} className="rbac-input-icon" />
                                <input type="email" value={form.email} disabled className="rbac-input" style={{ opacity: 0.7 }} />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16 }}>
                        <div>
                            <label className="rbac-label">Telefone / WhatsApp</label>
                            <div className="rbac-input-wrap">
                                <Phone size={16} className="rbac-input-icon" />
                                <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="rbac-input" />
                            </div>
                        </div>
                        <div>
                            <label className="rbac-label">Nova Senha (deixe em branco para manter)</label>
                            <div className="rbac-input-wrap">
                                <Lock size={16} className="rbac-input-icon" />
                                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Mínimo 6 caracteres" className="rbac-input" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* CONEXÃO WHATSAPP */}
                <div className="chart-card" style={{ borderTop: '4px solid #22c55e' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Smartphone size={20} style={{ color: '#22c55e' }} />
                        <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>Conexão WhatsApp Web</span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
                        Conecte seu WhatsApp para que o Agente Sombra possa atender seus clientes.
                    </p>

                    <div style={{ padding: '20px', background: 'rgba(34, 197, 94, 0.05)', borderRadius: '12px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                        {whatsapp?.status === 'connected' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '12px', borderRadius: '50%' }}>
                                    <Wifi size={24} style={{ color: '#22c55e' }} />
                                </div>
                                <div>
                                    <div style={{ color: '#22c55e', fontWeight: 700, fontSize: '1.1rem' }}>WhatsApp Conectado!</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>O Agente Sombra já pode enviar e receber mensagens.{whatsapp.phone_number && ` Número: ${whatsapp.phone_number}`}</div>
                                </div>
                                <button type="button" onClick={checkWhatsAppStatus} style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <RefreshCw size={14} /> Verificar Atualização
                                </button>
                            </div>
                        ) : qrCode ? (
                            <div style={{ textAlign: 'center' }}>
                                <b style={{ display: 'block', marginBottom: 12, color: 'var(--text-primary)' }}>Escaneie o QR Code abaixo com seu WhatsApp:</b>
                                <div style={{ display: 'inline-block', padding: '16px', background: 'white', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                    <img src={qrCode} alt="WhatsApp QR Code" style={{ width: '250px', height: '250px' }} />
                                </div>
                                <div style={{ marginTop: 20 }}>
                                    <button type="button" onClick={checkWhatsAppStatus} style={{ padding: '10px 24px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#22c55e', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                        <RefreshCw size={16} /> Já escaneei, verificar agora
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '10px 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px', color: 'var(--text-muted)' }}>
                                    <WifiOff size={20} /> Seu WhatsApp não está conectado a este painel.
                                </div>
                                <button type="button" onClick={connectWhatsApp} disabled={qrLoading}
                                    style={{ padding: '12px 24px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', color: 'white', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', opacity: qrLoading ? 0.7 : 1 }}>
                                    {qrLoading ? <Loader2 size={16} className="spin" /> : <QrCode size={16} />}
                                    {qrLoading ? 'Gerando QR Code...' : 'Gerar QR Code para Conectar'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* AGENTE SOMBRA */}
                <div className="chart-card" style={{ borderTop: '4px solid #6366f1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <Brain size={20} style={{ color: '#6366f1' }} />
                        <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>Seu Agente Sombra VIP</span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 24 }}>
                        A Inteligência Artificial que responde leads no seu WhatsApp automaticamente quando você estiver fora do seu horário de atendimento.
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <label className="rbac-toggle">
                            <input type="checkbox" checked={form.shadow_agent_enabled} onChange={e => setForm(p => ({ ...p, shadow_agent_enabled: e.target.checked }))} />
                            <span className="rbac-toggle-slider" style={{ background: form.shadow_agent_enabled ? '#6366f1' : undefined }} />
                        </label>
                        <div>
                            <span style={{ fontSize: '1rem', fontWeight: 600, color: form.shadow_agent_enabled ? '#6366f1' : 'var(--text-muted)' }}>
                                {form.shadow_agent_enabled ? 'Agente Sombra ATIVADO' : 'Agente Sombra DESATIVADO'}
                            </span>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ative para que a IA assuma as conversas pendentes.</div>
                        </div>
                    </div>

                    {form.shadow_agent_enabled && (
                        <>
                            <div style={{ marginBottom: 24 }}>
                                <h4 style={{ fontSize: '0.9rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><Clock size={16} /> Seu Horário de Trabalho</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16 }}>
                                    <div>
                                        <label className="rbac-label">Eu inicio o trabalho às:</label>
                                        <input type="time" value={form.available_from} onChange={e => setForm(p => ({ ...p, available_from: e.target.value }))} className="rbac-input" style={{ paddingLeft: '16px' }} />
                                    </div>
                                    <div>
                                        <label className="rbac-label">Eu termino as conversas às:</label>
                                        <input type="time" value={form.available_until} onChange={e => setForm(p => ({ ...p, available_until: e.target.value }))} className="rbac-input" style={{ paddingLeft: '16px' }} />
                                    </div>
                                </div>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8 }}>
                                    Atenção: A IA só vai responder os leads <strong>fora deste horário</strong>. Durante este horário, você é quem responde.
                                </p>
                            </div>

                            <div style={{ marginBottom: 20 }}>
                                <label className="rbac-label" style={{ fontWeight: 600 }}>Prompt de Personalidade do Agente</label>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>Deixe em branco para usar o comportamento padrão da Pilger Imóveis, ou ensine a IA como você gosta de falar com os clientes.</p>
                                <textarea 
                                    value={form.shadow_agent_prompt} 
                                    onChange={e => setForm(p => ({ ...p, shadow_agent_prompt: e.target.value }))}
                                    className="rbac-input" 
                                    style={{ height: '150px', resize: 'vertical', fontFamily: 'monospace', lineHeight: 1.5 }}
                                    placeholder="Ex: Você é a assistente da corretora Ana. Fale de forma super empolgada, use muitos emojis de brilho ✨..."
                                />
                            </div>

                            <div>
                                <label className="rbac-label" style={{ fontWeight: 600 }}>Mensagem de Transferência Mágica</label>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>O que um Agente de IA Comercial (atendimento inicial) diz ao cliente quando transfere ele para O SEU WhatsApp pela primeira vez.</p>
                                <textarea 
                                    value={form.transfer_message} 
                                    onChange={e => setForm(p => ({ ...p, transfer_message: e.target.value }))}
                                    className="rbac-input" 
                                    style={{ height: '100px', resize: 'vertical' }}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
