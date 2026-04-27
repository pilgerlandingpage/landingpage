'use client'

import { useEffect, useState } from 'react'
import {
    User, Mail, Phone, Lock, CheckCircle, AlertCircle, Loader2,
    Smartphone, Wifi, WifiOff, QrCode, Brain, RefreshCw, Save, MessageSquare, Bot
} from 'lucide-react'

interface WhatsAppInstance {
    id: string
    instance_name: string
    phone_number: string | null
    status: 'disconnected' | 'connecting' | 'connected'
}

interface AgentBroker {
    id: string
    name: string | null
    phone: string | null
    photo_url: string | null
    is_active: boolean
}

interface AgentConversation {
    id: string
    lead_phone: string | null
    lead_name: string | null
    lead_email: string | null
    status: string
    summary: string | null
    lead_classification: string | null
    lead_purpose: string | null
    lead_budget: string | null
    lead_timeframe: string | null
    messages: Array<{ role?: string; content?: string; timestamp?: string }>
    message_count: number
    updated_at: string
}

interface AgentReport {
    brokers: AgentBroker[]
    conversations: AgentConversation[]
    stats: {
        brokers: number
        conversations: number
        active_conversations: number
        messages: number
    }
}

type AccountFieldProps = {
    id: string
    label: string
    hint?: string
    icon: React.ComponentType<{ size?: number; className?: string }>
    children: React.ReactNode
}

function AccountField({ id, label, hint, icon: Icon, children }: AccountFieldProps) {
    return (
        <div className="account-field">
            <label htmlFor={id}>{label}</label>
            <div className="account-input-shell">
                <Icon size={17} className="account-input-icon" />
                {children}
            </div>
            {hint ? <span className="account-field-hint">{hint}</span> : null}
        </div>
    )
}

export default function MinhaContaPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

    const [form, setForm] = useState({
        id: '',
        name: '', email: '', phone: '', password: '',
    })

    const [whatsapp, setWhatsapp] = useState<WhatsAppInstance | null>(null)
    const [agentReport, setAgentReport] = useState<AgentReport | null>(null)
    const [qrCode, setQrCode] = useState<string | null>(null)
    const [qrLoading, setQrLoading] = useState(false)

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3500)
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
                }))
                if (data.whatsapp_instances && data.whatsapp_instances.length > 0) {
                    setWhatsapp(data.whatsapp_instances[0])
                } else {
                    setWhatsapp(null)
                }
                setAgentReport(data.agent_report || null)
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
            }
            if (form.password) body.password = form.password

            const res = await fetch('/api/admin/me', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })
            const data = await res.json()
            if (!res.ok || data?.success === false) {
                throw new Error(data?.error || data?.message || 'Erro ao salvar as alterações.')
            }

            showToast('Perfil atualizado com sucesso!', 'success')
            setForm(p => ({
                ...p,
                name: data?.user?.name ?? p.name,
                email: data?.user?.email ?? p.email,
                phone: data?.user?.phone ?? p.phone,
                password: '',
            }))
            await fetchData()
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
            if (data?.brokerSyncWarning) {
                showToast(data.brokerSyncWarning, 'error')
            } else if (data?.brokerCreated) {
                showToast('Corretor IA criado e vinculado automaticamente ao seu usuário.', 'success')
            } else if (data?.brokerId) {
                showToast('Corretor IA vinculado automaticamente ao seu usuário.', 'success')
            }
            await fetchData()
        } catch (err) {
            showToast('Falha ao gerar QR Code', 'error')
        } finally {
            setQrLoading(false)
        }
    }

    const checkWhatsAppStatus = async () => {
        if (!whatsapp) return
        try {
            const res = await fetch(`/api/admin/whatsapp/status?instanceId=${whatsapp.id}`)
            const data = await res.json()
            if (!res.ok || data?.success === false) {
                if (data?.blocked_phone_mismatch) {
                    showToast(data?.message || 'WhatsApp bloqueado por divergência com o telefone cadastrado.', 'error')
                } else if (data?.message) {
                    showToast(data.message, 'error')
                }
            }
            if (data.status) {
                setWhatsapp(prev => prev ? { ...prev, status: data.status, phone_number: data.phone_number || prev.phone_number } : null)
                if (data.status === 'connected') setQrCode(null)
            }
            await fetchData()
        } catch {
            showToast('Falha ao verificar status do WhatsApp.', 'error')
        }
    }

    if (loading) return <div className="account-loading">Carregando meu perfil...</div>

    return (
        <div className="account-page">
            {toast && (
                <div className={`admin-toast ${toast.type}`}>
                    {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    {toast.msg}
                </div>
            )}

            <div className="admin-header account-header">
                <div>
                    <h1>
                        <User size={26} /> Minha Conta
                    </h1>
                    <p>
                        Gerencie seus dados pessoais, WhatsApp e acompanhe os atendimentos do seu agente.
                    </p>
                </div>
                <button className="btn btn-gold account-save" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 size={18} className="spin" /> : <Save size={18} />}
                    {saving ? 'Salvando...' : 'Salvar alterações'}
                </button>
            </div>

            <div className="account-sections">
                <section className="chart-card account-section account-section-gold">
                    <div className="account-section-title">
                        <User size={20} />
                        <div>
                            <h2>Dados pessoais</h2>
                            <p>Informações usadas para identificação no painel e no atendimento.</p>
                        </div>
                    </div>

                    <div className="account-form-grid">
                        <AccountField id="name" label="Nome completo" icon={User}>
                            <input
                                id="name"
                                type="text"
                                value={form.name}
                                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                placeholder="Seu nome"
                            />
                        </AccountField>

                        <AccountField id="email" label="Email" hint="O email não pode ser alterado nesta tela." icon={Mail}>
                            <input id="email" type="email" value={form.email} disabled />
                        </AccountField>

                        <AccountField id="phone" label="Telefone / WhatsApp" icon={Phone}>
                            <input
                                id="phone"
                                type="tel"
                                value={form.phone}
                                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                                placeholder="5547999999999"
                            />
                        </AccountField>

                        <AccountField id="password" label="Nova senha" hint="Deixe em branco para manter a senha atual." icon={Lock}>
                            <input
                                id="password"
                                type="password"
                                value={form.password}
                                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                placeholder="Mínimo 6 caracteres"
                            />
                        </AccountField>
                    </div>
                </section>

                <section className="chart-card account-section account-section-green">
                    <div className="account-section-title">
                        <Smartphone size={20} />
                        <div>
                            <h2>Conexão WhatsApp Web</h2>
                            <p>Conecte seu WhatsApp para que o agente vinculado possa atender seus clientes.</p>
                        </div>
                    </div>

                    <div className="account-whatsapp-panel">
                        {whatsapp?.status === 'connected' ? (
                            <div className="account-status-row">
                                <div className="account-status-icon connected">
                                    <Wifi size={24} />
                                </div>
                                <div className="account-status-copy">
                                    <strong>WhatsApp conectado</strong>
                                    <span>
                                        O agente vinculado já pode enviar e receber mensagens.
                                        {whatsapp.phone_number ? ` Número: ${whatsapp.phone_number}` : ''}
                                    </span>
                                </div>
                                <button type="button" className="btn btn-outline btn-sm" onClick={checkWhatsAppStatus}>
                                    <RefreshCw size={14} /> Verificar
                                </button>
                            </div>
                        ) : qrCode ? (
                            <div className="account-qr-state">
                                <strong>Escaneie o QR Code com seu WhatsApp</strong>
                                <div className="account-qr-frame">
                                    <img src={qrCode} alt="WhatsApp QR Code" />
                                </div>
                                <button type="button" className="account-success-button" onClick={checkWhatsAppStatus}>
                                    <RefreshCw size={16} /> Já escaneei, verificar agora
                                </button>
                            </div>
                        ) : (
                            <div className="account-empty-state">
                                <div className="account-status-icon disconnected">
                                    <WifiOff size={24} />
                                </div>
                                <strong>WhatsApp não conectado</strong>
                                <span>Gere um QR Code para vincular seu número ao painel.</span>
                                <button type="button" onClick={connectWhatsApp} disabled={qrLoading} className="account-connect-button">
                                    {qrLoading ? <Loader2 size={16} className="spin" /> : <QrCode size={16} />}
                                    {qrLoading ? 'Gerando QR Code...' : 'Gerar QR Code'}
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                <section className="chart-card account-section account-section-indigo">
                    <div className="account-section-title">
                        <Brain size={20} />
                        <div>
                            <h2>Relatório do agente</h2>
                            <p>Visão do corretor IA vinculado ao seu WhatsApp e das conversas feitas com leads.</p>
                        </div>
                    </div>

                    {agentReport?.brokers?.length ? (
                        <div className="account-agent-summary">
                            {agentReport.brokers.slice(0, 1).map((broker) => (
                                <div className="account-agent-profile" key={broker.id}>
                                    <div className="account-agent-avatar">
                                        {broker.photo_url ? (
                                            <img src={broker.photo_url} alt={broker.name || 'Agente IA'} />
                                        ) : (
                                            <Bot size={24} />
                                        )}
                                    </div>
                                    <div>
                                        <strong>{broker.name || 'Agente IA'}</strong>
                                        <span>{broker.phone || whatsapp?.phone_number || 'Telefone não informado'}</span>
                                    </div>
                                    <span className={`account-agent-badge ${broker.is_active ? 'active' : ''}`}>
                                        {broker.is_active ? 'Ativo' : 'Inativo'}
                                    </span>
                                </div>
                            ))}

                            <div className="account-agent-stats">
                                <div>
                                    <strong>{agentReport.stats.conversations}</strong>
                                    <span>Conversas</span>
                                </div>
                                <div>
                                    <strong>{agentReport.stats.active_conversations}</strong>
                                    <span>Ativas</span>
                                </div>
                                <div>
                                    <strong>{agentReport.stats.messages}</strong>
                                    <span>Mensagens</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="account-agent-empty">
                            <Bot size={24} />
                            <strong>Nenhum agente vinculado ao seu WhatsApp</strong>
                            <span>Quando a diretoria ou um admin master configurar seu corretor IA, o relatório aparecerá aqui.</span>
                        </div>
                    )}

                    <div className="account-conversations">
                        <div className="account-conversations-header">
                            <div>
                                <h3>Conversas com leads</h3>
                                <p>Histórico das interações registradas pelo agente no WhatsApp.</p>
                            </div>
                            <span>{agentReport?.conversations?.length || 0} conversas</span>
                        </div>

                        {agentReport?.conversations?.length ? (
                            <div className="account-conversation-list">
                                {agentReport.conversations.map((conversation) => (
                                    <details className="account-conversation-card" key={conversation.id}>
                                        <summary>
                                            <div className="account-conversation-main">
                                                <strong>{conversation.lead_name || conversation.lead_phone || 'Lead sem nome'}</strong>
                                                <span>{conversation.summary || 'Sem resumo gerado para esta conversa.'}</span>
                                            </div>
                                            <div className="account-conversation-meta">
                                                <span className={`account-conversation-status ${conversation.status}`}>
                                                    {conversation.status}
                                                </span>
                                                <small>{conversation.message_count} mensagens</small>
                                            </div>
                                        </summary>

                                        <div className="account-lead-tags">
                                            {conversation.lead_purpose ? <span>{conversation.lead_purpose}</span> : null}
                                            {conversation.lead_budget ? <span>{conversation.lead_budget}</span> : null}
                                            {conversation.lead_timeframe ? <span>{conversation.lead_timeframe}</span> : null}
                                            {conversation.lead_classification ? <span>{conversation.lead_classification}</span> : null}
                                        </div>

                                        <div className="account-message-list">
                                            {conversation.messages.length ? (
                                                conversation.messages.map((message, index) => (
                                                    <div
                                                        className={`account-message ${message.role === 'assistant' ? 'assistant' : 'lead'}`}
                                                        key={`${conversation.id}-${index}`}
                                                    >
                                                        <span>{message.content || ''}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="account-no-messages">
                                                    <MessageSquare size={18} />
                                                    Nenhuma mensagem registrada nesta conversa.
                                                </div>
                                            )}
                                        </div>
                                    </details>
                                ))}
                            </div>
                        ) : (
                            <div className="account-agent-empty compact">
                                <MessageSquare size={22} />
                                <strong>Nenhuma conversa registrada</strong>
                                <span>As conversas aparecerão aqui assim que o agente interagir com leads pelo WhatsApp.</span>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <style jsx global>{`
                .account-loading {
                    padding: 40px;
                    color: var(--text-muted);
                }

                .account-page {
                    max-width: 1040px;
                }

                .account-header h1 {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin: 0;
                }

                .account-header p {
                    color: var(--text-muted);
                    font-size: 0.88rem;
                    margin-top: 6px;
                }

                .account-save {
                    white-space: nowrap;
                }

                .account-sections {
                    display: grid;
                    gap: 24px;
                }

                .account-section {
                    margin-bottom: 0;
                    border-top-width: 4px;
                    border-top-style: solid;
                }

                .account-section-gold {
                    border-top-color: var(--gold);
                }

                .account-section-green {
                    border-top-color: #22c55e;
                }

                .account-section-indigo {
                    border-top-color: #6366f1;
                }

                .account-section-title {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    margin-bottom: 22px;
                }

                .account-section-title h2 {
                    font-size: 1.05rem;
                    line-height: 1.2;
                    margin: 0 0 4px;
                }

                .account-section-title p {
                    margin: 0;
                    color: var(--text-muted);
                    font-size: 0.84rem;
                    line-height: 1.45;
                }

                .account-form-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 18px;
                }

                .account-form-grid.compact {
                    gap: 14px;
                }

                .account-field {
                    min-width: 0;
                }

                .account-field label,
                .account-textarea-field label {
                    display: block;
                    color: var(--text-secondary);
                    font-size: 0.82rem;
                    font-weight: 600;
                    margin-bottom: 7px;
                }

                .account-input-shell {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .account-input-icon {
                    position: absolute;
                    left: 14px;
                    color: var(--text-muted);
                    pointer-events: none;
                    z-index: 1;
                }

                .account-input-shell input,
                .account-textarea-field textarea {
                    width: 100%;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    color: var(--text-primary);
                    font-family: 'Inter', sans-serif;
                    font-size: 0.92rem;
                    outline: none;
                    transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
                }

                .account-input-shell input {
                    height: 44px;
                    padding: 0 14px 0 42px;
                }

                .account-input-shell input:focus,
                .account-textarea-field textarea:focus {
                    border-color: var(--gold);
                    box-shadow: 0 0 0 3px rgba(201, 169, 110, 0.12);
                }

                .account-input-shell input:disabled {
                    cursor: not-allowed;
                    opacity: 0.72;
                    background: rgba(255, 255, 255, 0.035);
                }

                .account-field-hint {
                    display: block;
                    color: var(--text-muted);
                    font-size: 0.76rem;
                    line-height: 1.35;
                    margin-top: 6px;
                }

                .account-whatsapp-panel {
                    background: rgba(34, 197, 94, 0.05);
                    border: 1px solid rgba(34, 197, 94, 0.22);
                    border-radius: 8px;
                    padding: 20px;
                }

                .account-status-row {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                }

                .account-status-icon {
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    flex: 0 0 auto;
                }

                .account-status-icon.connected {
                    background: rgba(34, 197, 94, 0.12);
                    color: #22c55e;
                }

                .account-status-icon.disconnected {
                    background: rgba(148, 163, 184, 0.12);
                    color: var(--text-muted);
                    margin-bottom: 10px;
                }

                .account-status-copy {
                    min-width: 0;
                    flex: 1;
                    display: grid;
                    gap: 3px;
                }

                .account-status-copy strong {
                    color: #22c55e;
                    font-size: 1rem;
                }

                .account-status-copy span,
                .account-empty-state span {
                    color: var(--text-muted);
                    font-size: 0.85rem;
                    line-height: 1.4;
                }

                .account-qr-state,
                .account-empty-state {
                    text-align: center;
                    display: grid;
                    justify-items: center;
                    gap: 12px;
                }

                .account-qr-state strong,
                .account-empty-state strong {
                    color: var(--text-primary);
                }

                .account-qr-frame {
                    background: #fff;
                    border-radius: 8px;
                    padding: 14px;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
                }

                .account-qr-frame img {
                    display: block;
                    width: min(250px, 70vw);
                    aspect-ratio: 1;
                    object-fit: contain;
                }

                .account-connect-button,
                .account-success-button {
                    border: 0;
                    border-radius: 8px;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    font-size: 0.9rem;
                    font-weight: 700;
                    min-height: 42px;
                    padding: 0 18px;
                }

                .account-connect-button {
                    background: linear-gradient(135deg, #22c55e, #16a34a);
                    color: #fff;
                }

                .account-connect-button:disabled {
                    cursor: wait;
                    opacity: 0.72;
                }

                .account-success-button {
                    background: rgba(34, 197, 94, 0.1);
                    border: 1px solid rgba(34, 197, 94, 0.3);
                    color: #22c55e;
                }

                .account-agent-summary {
                    display: grid;
                    grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.8fr);
                    gap: 16px;
                    margin-bottom: 22px;
                }

                .account-agent-profile {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    padding: 16px;
                    min-width: 0;
                }

                .account-agent-avatar {
                    width: 56px;
                    height: 56px;
                    border-radius: 50%;
                    overflow: hidden;
                    background: rgba(99, 102, 241, 0.12);
                    color: #818cf8;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    flex: 0 0 auto;
                }

                .account-agent-avatar img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .account-agent-profile div:nth-child(2) {
                    display: grid;
                    gap: 4px;
                    min-width: 0;
                    flex: 1;
                }

                .account-agent-profile strong {
                    color: var(--text-primary);
                    font-size: 1rem;
                }

                .account-agent-profile span {
                    color: var(--text-muted);
                    font-size: 0.84rem;
                }

                .account-agent-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 999px;
                    border: 1px solid rgba(148, 163, 184, 0.24);
                    color: var(--text-muted);
                    font-size: 0.72rem;
                    font-weight: 700;
                    padding: 5px 10px;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }

                .account-agent-badge.active {
                    border-color: rgba(34, 197, 94, 0.32);
                    background: rgba(34, 197, 94, 0.1);
                    color: #22c55e;
                }

                .account-agent-stats {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 10px;
                }

                .account-agent-stats div {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    padding: 14px;
                    display: grid;
                    gap: 4px;
                }

                .account-agent-stats strong {
                    color: var(--text-primary);
                    font-size: 1.25rem;
                }

                .account-agent-stats span {
                    color: var(--text-muted);
                    font-size: 0.76rem;
                }

                .account-agent-empty {
                    background: var(--bg-secondary);
                    border: 1px dashed var(--border);
                    border-radius: 8px;
                    padding: 22px;
                    display: grid;
                    justify-items: center;
                    gap: 8px;
                    text-align: center;
                    color: var(--text-muted);
                    margin-bottom: 22px;
                }

                .account-agent-empty strong {
                    color: var(--text-primary);
                    font-size: 0.96rem;
                }

                .account-agent-empty span {
                    max-width: 560px;
                    font-size: 0.84rem;
                    line-height: 1.45;
                }

                .account-agent-empty.compact {
                    margin: 0;
                    padding: 18px;
                }

                .account-conversations {
                    display: grid;
                    gap: 14px;
                }

                .account-conversations-header {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    gap: 14px;
                }

                .account-conversations-header h3 {
                    margin: 0 0 4px;
                    font-size: 0.96rem;
                }

                .account-conversations-header p {
                    margin: 0;
                    color: var(--text-muted);
                    font-size: 0.8rem;
                }

                .account-conversations-header > span {
                    color: var(--text-muted);
                    border: 1px solid var(--border);
                    border-radius: 999px;
                    padding: 5px 10px;
                    font-size: 0.76rem;
                    white-space: nowrap;
                }

                .account-conversation-list {
                    display: grid;
                    gap: 10px;
                }

                .account-conversation-card {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    overflow: hidden;
                }

                .account-conversation-card summary {
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    padding: 14px 16px;
                    list-style: none;
                }

                .account-conversation-card summary::-webkit-details-marker {
                    display: none;
                }

                .account-conversation-main {
                    display: grid;
                    gap: 5px;
                    min-width: 0;
                    flex: 1;
                }

                .account-conversation-main strong {
                    color: var(--text-primary);
                    font-size: 0.92rem;
                }

                .account-conversation-main span {
                    color: var(--text-muted);
                    font-size: 0.8rem;
                    line-height: 1.4;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .account-conversation-meta {
                    display: grid;
                    justify-items: end;
                    gap: 6px;
                    flex: 0 0 auto;
                }

                .account-conversation-meta small {
                    color: var(--text-muted);
                    font-size: 0.72rem;
                }

                .account-conversation-status {
                    border-radius: 999px;
                    border: 1px solid rgba(148, 163, 184, 0.22);
                    color: var(--text-muted);
                    font-size: 0.68rem;
                    font-weight: 700;
                    padding: 4px 8px;
                    text-transform: uppercase;
                }

                .account-conversation-status.active {
                    color: #22c55e;
                    border-color: rgba(34, 197, 94, 0.32);
                    background: rgba(34, 197, 94, 0.08);
                }

                .account-lead-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    padding: 0 16px 12px;
                }

                .account-lead-tags span {
                    border-radius: 999px;
                    background: rgba(201, 169, 110, 0.1);
                    color: var(--gold);
                    font-size: 0.72rem;
                    padding: 4px 8px;
                }

                .account-message-list {
                    border-top: 1px solid var(--border);
                    background: rgba(0, 0, 0, 0.18);
                    padding: 14px 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    max-height: 360px;
                    overflow: auto;
                }

                .account-message {
                    max-width: 78%;
                    border-radius: 12px;
                    padding: 10px 12px;
                    font-size: 0.82rem;
                    line-height: 1.45;
                }

                .account-message.assistant {
                    align-self: flex-start;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    color: var(--text-secondary);
                }

                .account-message.lead {
                    align-self: flex-end;
                    background: #25d366;
                    color: #fff;
                }

                .account-no-messages {
                    color: var(--text-muted);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.82rem;
                }

                @media (max-width: 760px) {
                    .account-page {
                        max-width: none;
                    }

                    .account-header {
                        align-items: stretch;
                        flex-direction: column;
                        gap: 16px;
                    }

                    .account-save {
                        width: 100%;
                        justify-content: center;
                    }

                    .account-form-grid {
                        grid-template-columns: 1fr;
                    }

                    .account-status-row {
                        align-items: flex-start;
                        flex-direction: column;
                    }

                    .account-status-row .btn {
                        width: 100%;
                        justify-content: center;
                    }

                    .account-agent-summary {
                        grid-template-columns: 1fr;
                    }

                    .account-conversations-header,
                    .account-conversation-card summary {
                        align-items: flex-start;
                        flex-direction: column;
                    }

                    .account-conversation-meta {
                        justify-items: start;
                    }

                    .account-conversation-main span {
                        white-space: normal;
                    }

                    .account-message {
                        max-width: 92%;
                    }
                }
            `}</style>
        </div>
    )
}
