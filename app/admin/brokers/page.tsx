'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, User, Trash2, Edit2, Shield, Search, Upload, X, Check, Loader2, Globe, FileText, RefreshCw, MessageSquare, Wifi, WifiOff, Phone, Smartphone, QrCode, Bot, Brain } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface LandingPage {
    id: string
    slug: string
    title: string
}

interface Broker {
    id: string
    name: string
    creci: string
    photo_url: string
    is_active: boolean
    duty_weekdays: number[]
    duty_dates: string[]
    assignment_type: string
    assigned_page_slugs: string[]
    phone?: string
    connectyhub_chat_message?: string
    system_prompt?: string
    greeting_message?: string
    whatsapp_instance_id?: string
    ai_provider?: string
    ai_model?: string
}

interface WhatsAppInstance {
    id: string
    instance_name: string
    phone_number: string | null
    status: 'disconnected' | 'connecting' | 'connected'
    connected_at: string | null
}

export default function BrokersAdmin() {
    const supabase = createClient()
    const [brokers, setBrokers] = useState<Broker[]>([])
    const [loading, setLoading] = useState(true)
    const [isAdding, setIsAdding] = useState(false)
    const [editingBroker, setEditingBroker] = useState<Broker | null>(null)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [landingPages, setLandingPages] = useState<LandingPage[]>([])
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
    const [testMessage, setTestMessage] = useState('')
    // WhatsApp Instance State
    const [whatsappInstance, setWhatsappInstance] = useState<WhatsAppInstance | null>(null)
    const [whatsappQR, setWhatsappQR] = useState<string | null>(null)
    const [whatsappLoading, setWhatsappLoading] = useState(false)
    const [whatsappConnecting, setWhatsappConnecting] = useState(false)

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        creci: '',
        photo_url: '',
        is_active: true,
        duty_weekdays: [] as number[],
        duty_dates: [] as string[],
        assignment_type: 'all',
        assigned_page_slugs: [] as string[],
        phone: '',
        connectyhub_chat_message: 'Oi {{lead_name}}! Sou o {{broker_name}}, recebi seus dados e quero te ajudar pessoalmente! 😊\n\n{{conversation_summary}}\n\nComo posso te ajudar?',
        system_prompt: '',
        greeting_message: '',
        ai_provider: '',
        ai_model: ''
    })

    const defaultFormData = {
        name: '',
        creci: '',
        photo_url: '',
        is_active: true,
        duty_weekdays: [] as number[],
        duty_dates: [] as string[],
        assignment_type: 'all',
        assigned_page_slugs: [] as string[],
        phone: '',
        connectyhub_chat_message: 'Oi {{lead_name}}! Sou o {{broker_name}}, recebi seus dados e quero te ajudar pessoalmente! 😊\n\n{{conversation_summary}}\n\nComo posso te ajudar?',
        system_prompt: '',
        greeting_message: '',
        ai_provider: '',
        ai_model: ''
    }

    // WhatsApp Instance Functions
    async function loadWhatsAppInstance(brokerId: string) {
        setWhatsappLoading(true)
        try {
            const res = await fetch(`/api/admin/whatsapp/instances?broker_id=${brokerId}`)
            const data = await res.json()
            if (data?.instances?.length > 0) {
                setWhatsappInstance(data.instances[0])
            } else {
                setWhatsappInstance(null)
            }
        } catch { setWhatsappInstance(null) }
        finally { setWhatsappLoading(false) }
    }

    async function connectWhatsApp() {
        if (!editingBroker && !formData.name) return
        setWhatsappConnecting(true)
        setWhatsappQR(null)
        try {
            const instanceName = `broker_${editingBroker?.id || 'new'}_${Date.now()}`
            const res = await fetch('/api/admin/whatsapp/qrcode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instance_name: instanceName, broker_id: editingBroker?.id })
            })
            const data = await res.json()
            if (data.qrcode) {
                setWhatsappQR(data.qrcode)
            }
        } catch (err) {
            console.error('WhatsApp QR Error:', err)
        }
        finally { setWhatsappConnecting(false) }
    }

    async function checkWhatsAppStatus() {
        if (!whatsappInstance) return
        try {
            const res = await fetch(`/api/admin/whatsapp/status?instance_name=${whatsappInstance.instance_name}`)
            const data = await res.json()
            if (data.status) {
                setWhatsappInstance(prev => prev ? { ...prev, status: data.status, phone_number: data.phone_number || prev.phone_number } : null)
                if (data.status === 'connected') setWhatsappQR(null)
            }
        } catch {}
    }

    useEffect(() => {
        fetchBrokers()
        fetchLandingPages()
        // Run migration for new columns
        fetch('/api/admin/migrate-broker-assignment', { method: 'POST' }).catch(() => { })
    }, [])

    async function fetchLandingPages() {
        const { data } = await supabase
            .from('landing_pages')
            .select('id, slug, title')
            .order('title')
        if (data) setLandingPages(data)
    }

    async function fetchBrokers() {
        setLoading(true)
        const { data } = await supabase
            .from('virtual_brokers')
            .select('*')
            .order('name')
        if (data) setBrokers(data)
        setLoading(false)
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        const uploadFormData = new FormData()
        uploadFormData.append('file', file)
        uploadFormData.append('folder', 'brokers')

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: uploadFormData
            })
            const data = await res.json()
            if (data.url) {
                setFormData(prev => ({ ...prev, photo_url: data.url }))
            }
        } catch (error) {
            console.error('Upload failed:', error)
            alert('Falha ao enviar imagem.')
        } finally {
            setUploading(false)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()

        const payload = {
            ...formData,
            duty_weekdays: formData.duty_weekdays,
            duty_dates: formData.duty_dates,
            assignment_type: formData.assignment_type,
            assigned_page_slugs: formData.assigned_page_slugs
        }

        try {
            if (editingBroker) {
                const res = await fetch('/api/admin/brokers', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editingBroker.id, ...payload })
                })
                const result = await res.json()
                if (!res.ok || result.error) {
                    console.error('Update Form Error:', result.error)
                    alert('Erro ao atualizar. Veja console.')
                } else {
                    setEditingBroker(null)
                    fetchBrokers()
                    setFormData({ ...defaultFormData })
                }
            } else {
                const res = await fetch('/api/admin/brokers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                const result = await res.json()
                if (!res.ok || result.error) {
                    console.error('Insert Form Error:', result.error)
                    alert('Erro ao inserir. Veja o console.')
                } else {
                    setIsAdding(false)
                    fetchBrokers()
                    setFormData({ ...defaultFormData })
                }
            }
        } catch (err) {
            console.error('Submit Failed:', err)
        }
    }

    async function deleteBroker(id: string) {
        if (!confirm('Tem certeza que deseja excluir este corretor?')) return
        await supabase.from('virtual_brokers').delete().eq('id', id)
        fetchBrokers()
    }

    return (
        <div className="admin-page-container">
            <div className="admin-header" style={{ marginBottom: '32px' }}>
                <div className="flex justify-between items-center w-full">
                    <div>
                        <h1 className="flex items-center gap-3">
                            <Shield className="text-gold" size={28} /> Gerenciar Corretores IA de Plantão
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                            Configure os agentes IA que atendem leads via WhatsApp.
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            setIsAdding(true)
                            setEditingBroker(null)
                            setFormData({ ...defaultFormData })
                            setTestStatus('idle')
                            setTestMessage('')
                        }}
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
                    >
                        <Plus size={20} /> Novo Corretor IA
                    </button>
                </div>
            </div>

            {(isAdding || editingBroker) && (
                <div className="chart-card" style={{ marginBottom: '32px', padding: '32px 32px 48px', border: '1px solid rgba(201, 169, 110, 0.2)' }}>
                    <div className="flex justify-between items-center mb-6">
                        <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--gold)' }}>
                            {editingBroker ? 'Editar Perfil' : 'Novo Perfil de Corretor'}
                        </h2>
                        <button onClick={() => { setIsAdding(false); setEditingBroker(null); setTestStatus('idle'); setTestMessage(''); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <X size={24} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        {/* Photo Upload Area */}
                        <div className="flex flex-col items-center gap-4">
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    width: '150px',
                                    height: '150px',
                                    borderRadius: '50%',
                                    border: '2px dashed var(--gold)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    overflow: 'hidden',
                                    backgroundColor: 'rgba(201, 169, 110, 0.05)',
                                    position: 'relative'
                                }}
                            >
                                {formData.photo_url ? (
                                    <img src={formData.photo_url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <Upload size={32} style={{ marginBottom: '8px' }} />
                                        <div style={{ fontSize: '0.8rem' }}>Upload Foto</div>
                                    </div>
                                )}
                                {uploading && (
                                    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Loader2 className="animate-spin" color="var(--gold)" />
                                    </div>
                                )}
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                style={{ display: 'none' }}
                                accept="image/*"
                            />
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                Use fotos quadradas (1:1) de alta qualidade.
                            </p>
                        </div>

                        {/* Fields Area */}
                        <div className="md:col-span-3 grid grid-cols-1 gap-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Nome do Corretor</label>
                                    <input
                                        placeholder="Ex: Guilherme Pilger"
                                        className="form-input"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Registro (CRECI)</label>
                                    <input
                                        placeholder="Ex: CRECI 1234-F"
                                        className="form-input"
                                        value={formData.creci}
                                        onChange={(e) => setFormData({ ...formData, creci: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Active toggle - right after name/CRECI */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '12px',
                                padding: '12px 16px',
                                background: formData.is_active ? 'rgba(34, 197, 94, 0.08)' : 'var(--bg-secondary)',
                                border: `1px solid ${formData.is_active ? 'rgba(34, 197, 94, 0.3)' : 'var(--border)'}`,
                                borderRadius: '10px',
                                transition: 'all 0.2s'
                            }}>
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={formData.is_active}
                                    style={{ width: '20px', height: '20px', accentColor: '#22c55e' }}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                />
                                <label htmlFor="is_active" style={{ cursor: 'pointer' }}>
                                    <div style={{ color: formData.is_active ? '#22c55e' : '#888', fontWeight: 600, fontSize: '0.95rem' }}>
                                        {formData.is_active ? '✅ Corretor IA Ativo' : '⏸️ Corretor IA Inativo'}
                                    </div>
                                    <div style={{ color: '#888', fontSize: '0.75rem', marginTop: '2px' }}>
                                        Quando ativo, este agente IA atenderá leads no WhatsApp e entrará no rodízio de atendimento.
                                    </div>
                                </label>
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Telefone WhatsApp (com DDD)</label>
                                <input
                                    placeholder="Ex: 5547999887766"
                                    className="form-input"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                                />
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>Número do WhatsApp deste agente IA.</div>
                            </div>

                            {/* ── SEÇÃO 2: WHATSAPP WEB ── */}
                            <div style={{ padding: '20px', background: 'rgba(34, 197, 94, 0.05)', borderRadius: '12px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                                <h3 style={{ fontSize: '1rem', color: '#22c55e', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Smartphone size={18} /> 📱 WhatsApp Web
                                </h3>
                                <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '16px' }}>
                                    Conecte o WhatsApp deste corretor IA para que ele possa enviar e receber mensagens.
                                </p>

                                {whatsappLoading ? (
                                    <div style={{ textAlign: 'center', padding: '20px' }}>
                                        <Loader2 size={24} className="animate-spin" style={{ color: '#22c55e' }} />
                                        <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '8px' }}>Carregando instância...</div>
                                    </div>
                                ) : whatsappInstance?.status === 'connected' ? (
                                    <div style={{ padding: '16px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '10px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                            <Wifi size={20} style={{ color: '#22c55e' }} />
                                            <span style={{ fontWeight: 600, color: '#22c55e', fontSize: '0.95rem' }}>✅ WhatsApp Conectado</span>
                                        </div>
                                        {whatsappInstance.phone_number && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                                <Phone size={14} /> {whatsappInstance.phone_number}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                            <button type="button" onClick={checkWhatsAppStatus} style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <RefreshCw size={12} /> Verificar Status
                                            </button>
                                        </div>
                                    </div>
                                ) : whatsappQR ? (
                                    <div style={{ textAlign: 'center', padding: '16px' }}>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '12px', fontWeight: 600 }}>
                                            📷 Escaneie o QR Code com o WhatsApp
                                        </div>
                                        <div style={{ display: 'inline-block', padding: '16px', background: 'white', borderRadius: '12px' }}>
                                            <img src={whatsappQR} alt="QR Code" style={{ width: '256px', height: '256px' }} />
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '12px' }}>
                                            Abra o WhatsApp no celular → Dispositivos conectados → Conectar dispositivo
                                        </div>
                                        <button type="button" onClick={checkWhatsAppStatus} style={{ marginTop: '12px', padding: '8px 20px', borderRadius: '8px', fontSize: '0.85rem', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#22c55e', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                            <RefreshCw size={14} /> Já escaniei, verificar conexão
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
                                            <WifiOff size={20} style={{ color: '#888' }} />
                                            <span style={{ color: '#888', fontSize: '0.9rem' }}>❌ WhatsApp não conectado</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={connectWhatsApp}
                                            disabled={whatsappConnecting || (!editingBroker && !formData.name)}
                                            style={{
                                                padding: '10px 24px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 600,
                                                background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none',
                                                color: 'white', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px',
                                                opacity: whatsappConnecting ? 0.6 : 1
                                            }}
                                        >
                                            {whatsappConnecting ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
                                            {whatsappConnecting ? 'Gerando QR Code...' : 'Conectar WhatsApp'}
                                        </button>
                                        {!editingBroker && !formData.name && (
                                            <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '8px' }}>Salve o corretor primeiro para conectar o WhatsApp.</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ── SEÇÃO 3: AGENTE IA (PROMPT) ── */}
                            <div style={{ padding: '20px', background: 'rgba(201, 169, 110, 0.05)', borderRadius: '12px', border: '1px solid rgba(201, 169, 110, 0.2)' }}>
                                <h3 style={{ fontSize: '1rem', color: 'var(--gold)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Brain size={18} /> 🤖 Agente IA (Prompt do WhatsApp)
                                </h3>
                                <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '16px' }}>
                                    Configure o prompt e personalidade do agente IA que atenderá leads via WhatsApp.
                                </p>

                                {/* Provider + Model per broker */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px', padding: '14px', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            <Bot size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Provedor IA
                                        </label>
                                        <select className="form-input" value={formData.ai_provider || ''} onChange={e => setFormData({ ...formData, ai_provider: e.target.value })}>
                                            <option value="">Usar Padrão Global (Manutenção)</option>
                                            <option value="gemini">Google Gemini</option>
                                            <option value="openai">OpenAI</option>
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Modelo IA</label>
                                        <input className="form-input" value={formData.ai_model || ''} onChange={e => setFormData({ ...formData, ai_model: e.target.value })} placeholder="Ex: gemini-2.0-flash ou gpt-4o-mini" />
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Saudação Inicial no WhatsApp</label>
                                    <input
                                        placeholder="Ex: Olá! Sou o Guilherme da Pilger Imóveis. Como posso te ajudar a encontrar seu imóvel de luxo hoje?"
                                        className="form-input"
                                        value={formData.greeting_message}
                                        onChange={(e) => setFormData({ ...formData, greeting_message: e.target.value })}
                                    />
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>A primeira mensagem que o agente IA envia ao lead no WhatsApp.</div>
                                </div>

                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Prompt do Agente IA (Instruções Completas)</label>
                                    <textarea
                                        className="form-textarea"
                                        style={{ minHeight: '200px', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.85rem' }}
                                        value={formData.system_prompt}
                                        onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                                        placeholder={`Você é o Guilherme Pilger, corretor especializado em imóveis de alto padrão na Pilger Imóveis.\n\nSua missão:\n- Atender leads no WhatsApp de forma profissional e amigável\n- Coletar: nome completo, telefone, tipo de imóvel desejado, faixa de preço, região de interesse\n- Quando tiver todos os dados, informar que vai transferir para atendimento personalizado\n\nRegras:\n- Seja direto e use termos como "oportunidade exclusiva"\n- Não invente dados sobre imóveis\n- Mantenha o tom profissional mas acolhedor`}
                                    />
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                                        Defina a personalidade, missão, dados a coletar e regras do agente IA. Quanto mais detalhado, melhor o atendimento.
                                    </div>
                                </div>
                            </div>

                            {/* ── SEÇÃO 4: TRANSFERÊNCIA PARA CORRETOR HUMANO ── */}
                            <div style={{ padding: '20px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                                <h3 style={{ fontSize: '1rem', color: '#6366f1', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <MessageSquare size={18} /> 🔄 Transferência para Corretor Humano
                                </h3>
                                <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '16px' }}>
                                    Mensagem enviada automaticamente pelo WhatsApp do corretor humano ao lead quando o agente IA transferir o atendimento.
                                </p>

                                <div className="form-group" style={{ marginTop: '16px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Mensagem de Transferência</label>
                                    <textarea
                                        className="form-textarea"
                                        style={{ minHeight: '100px', resize: 'vertical' }}
                                        value={formData.connectyhub_chat_message}
                                        onChange={(e) => setFormData({ ...formData, connectyhub_chat_message: e.target.value })}
                                        placeholder="Mensagem que o corretor humano enviará ao lead após transferência..."
                                    />
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                                        Variáveis disponíveis: {'{{lead_name}}'}, {'{{broker_name}}'} e {'{{conversation_summary}}'}
                                    </div>
                                </div>
                            </div>

                            {/* Tipo de Atendimento / Page Assignment */}
                            <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Globe size={18} className="text-gold" />
                                    Tipo de Atendimento
                                </h3>
                                <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '16px' }}>
                                    Defina em quais páginas este corretor irá atender os leads.
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <label style={{
                                        display: 'flex', alignItems: 'center', gap: '12px',
                                        padding: '14px 16px',
                                        background: formData.assignment_type === 'all' ? 'rgba(201, 169, 110, 0.1)' : 'var(--bg-primary)',
                                        border: `1px solid ${formData.assignment_type === 'all' ? 'var(--gold)' : 'var(--border)'}`,
                                        borderRadius: '10px', cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}>
                                        <input
                                            type="radio"
                                            name="assignment_type"
                                            value="all"
                                            checked={formData.assignment_type === 'all'}
                                            onChange={() => setFormData({ ...formData, assignment_type: 'all', assigned_page_slugs: [] })}
                                            style={{ accentColor: 'var(--gold)', width: '18px', height: '18px' }}
                                        />
                                        <div>
                                            <div style={{ color: formData.assignment_type === 'all' ? 'var(--gold)' : 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem' }}>
                                                Rodízio Geral
                                            </div>
                                            <div style={{ color: '#888', fontSize: '0.8rem', marginTop: '2px' }}>
                                                Atende todas as páginas — Home, Imóveis e Landing Pages
                                            </div>
                                        </div>
                                    </label>

                                    <label style={{
                                        display: 'flex', alignItems: 'center', gap: '12px',
                                        padding: '14px 16px',
                                        background: formData.assignment_type === 'landing_pages' ? 'rgba(201, 169, 110, 0.1)' : 'var(--bg-primary)',
                                        border: `1px solid ${formData.assignment_type === 'landing_pages' ? 'var(--gold)' : 'var(--border)'}`,
                                        borderRadius: '10px', cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}>
                                        <input
                                            type="radio"
                                            name="assignment_type"
                                            value="landing_pages"
                                            checked={formData.assignment_type === 'landing_pages'}
                                            onChange={() => setFormData({ ...formData, assignment_type: 'landing_pages' })}
                                            style={{ accentColor: 'var(--gold)', width: '18px', height: '18px' }}
                                        />
                                        <div>
                                            <div style={{ color: formData.assignment_type === 'landing_pages' ? 'var(--gold)' : 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem' }}>
                                                Landing Pages Específicas
                                            </div>
                                            <div style={{ color: '#888', fontSize: '0.8rem', marginTop: '2px' }}>
                                                Atende apenas as landing pages selecionadas abaixo
                                            </div>
                                        </div>
                                    </label>
                                </div>

                                {/* Landing Pages Selection */}
                                {formData.assignment_type === 'landing_pages' && (
                                    <div style={{ marginTop: '16px', padding: '16px', background: 'var(--bg-primary)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                                        <label style={{ display: 'block', marginBottom: '12px', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                            <FileText size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                                            Selecione as Landing Pages
                                        </label>
                                        {landingPages.length === 0 ? (
                                            <p style={{ color: '#666', fontSize: '0.85rem', fontStyle: 'italic' }}>
                                                Nenhuma landing page cadastrada. Crie uma primeiro.
                                            </p>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {landingPages.map(lp => {
                                                    const isSelected = formData.assigned_page_slugs.includes(lp.slug);
                                                    return (
                                                        <label key={lp.id} style={{
                                                            display: 'flex', alignItems: 'center', gap: '10px',
                                                            padding: '10px 14px',
                                                            background: isSelected ? 'rgba(201, 169, 110, 0.08)' : 'transparent',
                                                            border: `1px solid ${isSelected ? 'rgba(201, 169, 110, 0.3)' : 'var(--border)'}`,
                                                            borderRadius: '8px', cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={(e) => {
                                                                    const newSlugs = e.target.checked
                                                                        ? [...formData.assigned_page_slugs, lp.slug]
                                                                        : formData.assigned_page_slugs.filter(s => s !== lp.slug);
                                                                    setFormData({ ...formData, assigned_page_slugs: newSlugs })
                                                                }}
                                                                style={{ accentColor: 'var(--gold)', width: '16px', height: '16px' }}
                                                            />
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ color: isSelected ? 'var(--gold)' : 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 500 }}>
                                                                    {lp.title || 'Sem título'}
                                                                </div>
                                                                <div style={{ color: '#666', fontSize: '0.75rem' }}>/{lp.slug}</div>
                                                            </div>
                                                        </label>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Escala de Plantão */}
                            <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Shield size={18} className="text-gold" />
                                    Escala de Plantão / WhatsApp
                                </h3>

                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        Dias da Semana (Recorrente)
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { id: 0, label: 'Dom' },
                                            { id: 1, label: 'Seg' },
                                            { id: 2, label: 'Ter' },
                                            { id: 3, label: 'Qua' },
                                            { id: 4, label: 'Qui' },
                                            { id: 5, label: 'Sex' },
                                            { id: 6, label: 'Sáb' }
                                        ].map(day => (
                                            <label key={day.id} style={{
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                padding: '6px 12px', background: formData.duty_weekdays.includes(day.id) ? 'rgba(201, 169, 110, 0.2)' : 'var(--bg-primary)',
                                                border: `1px solid ${formData.duty_weekdays.includes(day.id) ? 'var(--gold)' : 'var(--border)'}`,
                                                borderRadius: '20px', cursor: 'pointer', fontSize: '0.85rem', color: formData.duty_weekdays.includes(day.id) ? 'var(--gold)' : 'var(--text-secondary)'
                                            }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.duty_weekdays.includes(day.id)}
                                                    onChange={(e) => {
                                                        const newDays = e.target.checked
                                                            ? [...formData.duty_weekdays, day.id]
                                                            : formData.duty_weekdays.filter(d => d !== day.id);
                                                        setFormData({ ...formData, duty_weekdays: newDays })
                                                    }}
                                                    style={{ width: '16px', height: '16px', accentColor: 'var(--gold)' }}
                                                />
                                                {day.label}
                                            </label>
                                        ))}
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '8px' }}>
                                        Este corretor assumirá os atendimentos via IA em todos os dias marcados acima.
                                    </p>
                                </div>

                                <div className="form-group" style={{ marginTop: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        Adicionar Datas Específicas / Feriados (Avulso)
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="date"
                                            className="form-input"
                                            style={{ flex: 1 }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const dateVal = (e.target as HTMLInputElement).value;
                                                    if (dateVal && !formData.duty_dates.includes(dateVal)) {
                                                        setFormData({ ...formData, duty_dates: [...formData.duty_dates, dateVal] });
                                                        (e.target as HTMLInputElement).value = '';
                                                    }
                                                }
                                            }}
                                            onBlur={(e) => {
                                                const dateVal = e.target.value;
                                                if (dateVal && !formData.duty_dates.includes(dateVal)) {
                                                    setFormData({ ...formData, duty_dates: [...formData.duty_dates, dateVal] });
                                                    e.target.value = '';
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {formData.duty_dates.map(date => (
                                            <span key={date} style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--text-primary)'
                                            }}>
                                                {new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                <button type="button" onClick={() => {
                                                    setFormData({ ...formData, duty_dates: formData.duty_dates.filter(d => d !== date) })
                                                }} style={{ color: '#ff6b6b', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                                                    &times;
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '8px' }}>
                                        Digite a data e aperte Enter ou clique fora para adicionar.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4 mt-4">
                                <button type="submit" className="btn btn-primary" style={{ padding: '12px 32px' }}>
                                    {editingBroker ? 'Atualizar Perfil' : 'Criar Corretor'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setIsAdding(false); setEditingBroker(null); }}
                                    className="btn btn-secondary"
                                    style={{ padding: '12px 24px' }}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' }}>
                {loading ? (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
                        <Loader2 className="animate-spin" style={{ margin: '0 auto 16px' }} />
                        Carregando corretores...
                    </div>
                ) : brokers.length === 0 ? (
                    <div className="chart-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px 0', marginBottom: 0 }}>
                        <User size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                        <p>Nenhum corretor cadastrado ainda.</p>
                    </div>
                ) : brokers.map(broker => (
                    <div key={broker.id} className="chart-card flex group" style={{ alignItems: 'flex-start', gap: '20px', padding: '24px', position: 'relative', marginBottom: 0, height: '100%' }}>
                        <div style={{ width: '72px', height: '72px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--gold)', flexShrink: 0, backgroundColor: 'var(--bg-lighter)' }}>
                            {broker.photo_url ? (
                                <img src={broker.photo_url} alt={broker.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <User style={{ width: '100%', height: '100%', padding: '16px', color: 'rgba(255,255,255,0.1)' }} />
                            )}
                        </div>
                        <div style={{ flex: 1, paddingRight: '48px', minWidth: 0 }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{broker.name}</h3>
                            <p style={{ margin: '4px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{broker.creci}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                                <div style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: broker.is_active ? '#22c55e' : '#666'
                                }} />
                                <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    color: broker.is_active ? '#22c55e' : 'var(--text-muted)'
                                }}>
                                    {broker.is_active ? 'Ativo' : 'Inativo'}
                                </span>
                            </div>

                            {/* Badge de Tipo de Atendimento */}
                            <div style={{ marginTop: '8px' }}>
                                {broker.assignment_type === 'landing_pages' ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        <span style={{ padding: '2px 8px', background: 'rgba(147, 130, 220, 0.1)', border: '1px solid rgba(147, 130, 220, 0.3)', borderRadius: '12px', fontSize: '0.7rem', color: '#9382dc', fontWeight: 600 }}>
                                            LPs Específicas
                                        </span>
                                        {broker.assigned_page_slugs?.map(slug => (
                                            <span key={slug} style={{ padding: '2px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                                                /{slug}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <span style={{ padding: '2px 8px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '12px', fontSize: '0.7rem', color: '#22c55e', fontWeight: 600 }}>
                                        Rodízio Geral
                                    </span>
                                )}
                            </div>

                            {/* Badge de Escala Fixa */}
                            {(broker.duty_weekdays?.length > 0 || broker.duty_dates?.length > 0) && (
                                <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {broker.duty_weekdays?.map(d => {
                                        const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                                        return (
                                            <span key={`wd-${d}`} style={{ padding: '2px 8px', background: 'rgba(201, 169, 110, 0.1)', border: '1px solid rgba(201, 169, 110, 0.3)', borderRadius: '12px', fontSize: '0.7rem', color: 'var(--gold)' }}>
                                                {labels[d]}
                                            </span>
                                        )
                                    })}
                                    {broker.duty_dates?.length > 0 && (
                                        <span style={{ padding: '2px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                            +{broker.duty_dates.length} data(s)
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Ações separadas e sempre visíveis dentro do card */}
                        <div style={{ display: 'flex', gap: '8px', position: 'absolute', top: '24px', right: '24px' }}>
                            <button
                                onClick={() => {
                                    setEditingBroker(broker)
                                    setTestStatus('idle')
                                    setTestMessage('')
                                    setFormData({
                                        name: broker.name,
                                        creci: broker.creci,
                                        photo_url: broker.photo_url,
                                        is_active: broker.is_active,
                                        duty_weekdays: broker.duty_weekdays || [],
                                        duty_dates: broker.duty_dates || [],
                                        assignment_type: broker.assignment_type || 'all',
                                        assigned_page_slugs: broker.assigned_page_slugs || [],
                                        phone: broker.phone || '',
                                        connectyhub_chat_message: broker.connectyhub_chat_message || '',
                                        system_prompt: broker.system_prompt || '',
                                        greeting_message: broker.greeting_message || '',
                                        ai_provider: (broker as any).ai_provider || '',
                                        ai_model: (broker as any).ai_model || ''
                                    })
                                    // Load WhatsApp instance for this broker
                                    setWhatsappInstance(null)
                                    setWhatsappQR(null)
                                    loadWhatsAppInstance(broker.id)
                                    window.scrollTo({ top: 0, behavior: 'smooth' })
                                }}
                                style={{
                                    background: 'rgba(96, 165, 250, 0.1)',
                                    border: '1px solid rgba(96, 165, 250, 0.2)',
                                    color: '#60a5fa',
                                    padding: '8px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                title="Editar"
                            >
                                <Edit2 size={16} />
                            </button>
                            <button
                                onClick={() => deleteBroker(broker.id)}
                                style={{
                                    background: 'rgba(248, 113, 113, 0.1)',
                                    border: '1px solid rgba(248, 113, 113, 0.2)',
                                    color: '#f87171',
                                    padding: '8px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                title="Excluir"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <style jsx>{`
                .admin-page-container {
                    padding: 32px;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .text-gold { color: var(--gold); }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}
