'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, User, Trash2, Edit2, Shield, Search, Upload, X, Check, Loader2, Globe, FileText, MessageSquare, Phone, Smartphone, Brain, Mic } from 'lucide-react'
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
    assignment_type: string
    assigned_page_slugs: string[]
    phone?: string
    summary_to_phone?: string
    connectyhub_chat_message?: string
    system_prompt?: string
    voice_id?: string
    handoff_prompt?: string
    empreendimento_ids?: string[]
    empreendimento_names?: string[]

    whatsapp_instance_id?: string

}

interface WhatsAppInstance {
    id: string
    instance_name: string
    phone_number: string | null
    live_data?: { phone?: string | null } | null
    status: 'disconnected' | 'connecting' | 'connected'
    connected_at: string | null
    broker_id?: string | null
    virtual_brokers?: { name?: string | null } | null
    config?: any
}

interface Empreendimento {
    id: string
    nome: string
    slug: string
    ativo?: boolean
}

interface CustomLinkButtonTag {
    id?: string
    name?: string
    url?: string
    type?: 'URL' | 'BUTTON' | 'LIST' | 'POLL' | 'LOCATION' | 'PIX' | 'CAROUSEL'
    tag: string
}

function getInstancePhone(instance?: WhatsAppInstance | null): string {
    const raw = instance?.live_data?.phone || instance?.phone_number || ''
    return String(raw).replace(/\D/g, '')
}

function formatBrPhone(phone?: string | null): string {
    const digits = String(phone || '').replace(/\D/g, '')
    if (!digits) return ''
    if (digits.length === 13 && digits.startsWith('55')) {
        return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
    }
    if (digits.length === 12 && digits.startsWith('55')) {
        return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`
    }
    return `+${digits}`
}

function instanceIsConnected(instance?: WhatsAppInstance | null): boolean {
    return instance?.status === 'connected'
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
    const [availableInstances, setAvailableInstances] = useState<WhatsAppInstance[]>([])
    const [selectedInstanceId, setSelectedInstanceId] = useState('')
    // Voice State
    const [elevenLabsVoices, setElevenLabsVoices] = useState<{ voice_id: string; name: string; category: string; preview_url?: string | null }[]>([])
    const [loadingVoices, setLoadingVoices] = useState(false)
    const [ttsConfigs, setTtsConfigs] = useState<Record<string, string>>({})
    const [previewText, setPreviewText] = useState('Olá! Esta é uma prévia da minha voz para atendimento no WhatsApp.')
    const [previewLoading, setPreviewLoading] = useState(false)
    const [previewError, setPreviewError] = useState('')
    const [previewAudioUrl, setPreviewAudioUrl] = useState('')
    const [handoffPreviewLeadName, setHandoffPreviewLeadName] = useState('Carlos')
    const [handoffPreviewInterest, setHandoffPreviewInterest] = useState('Apartamento de luxo')
    const [handoffPreviewBudget, setHandoffPreviewBudget] = useState('R$ 2.000.000')
    const [handoffPreviewRegion, setHandoffPreviewRegion] = useState('Balneário Camboriú')
    const [handoffPreviewEmpreendimento, setHandoffPreviewEmpreendimento] = useState('Empreendimento X')
    const [handoffPreviewOutput, setHandoffPreviewOutput] = useState('')
    const [customLinkTags, setCustomLinkTags] = useState<CustomLinkButtonTag[]>([])
    const [empreendimentos, setEmpreendimentos] = useState<Empreendimento[]>([])
    const [selectedEmpreendimentoToAdd, setSelectedEmpreendimentoToAdd] = useState('')

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        creci: '',
        photo_url: '',
        is_active: true,
        assignment_type: 'all',
        assigned_page_slugs: [] as string[],
        phone: '',
        summary_to_phone: '',
        system_prompt: '',
        voice_id: '',
        handoff_prompt: '',
        empreendimento_ids: [] as string[],


    })

    const defaultFormData = {
        name: '',
        creci: '',
        photo_url: '',
        is_active: true,
        assignment_type: 'all',
        assigned_page_slugs: [] as string[],
        phone: '',
        summary_to_phone: '',
        system_prompt: '',
        voice_id: '',
        handoff_prompt: '',
        empreendimento_ids: [] as string[],


    }

    // WhatsApp Instance Functions
    async function loadAvailableInstances() {
        try {
            const res = await fetch('/api/admin/whatsapp/instances')
            const data = await res.json()
            setAvailableInstances((data?.instances || []) as WhatsAppInstance[])
        } catch {
            setAvailableInstances([])
        }
    }

    async function assignInstanceToBroker(brokerId: string, instanceId?: string) {
        const res = await fetch('/api/admin/whatsapp/instances', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                brokerId,
                instanceId: instanceId || null,
            })
        })

        const data = await res.json()
        if (!res.ok || !data?.success) {
            throw new Error(data?.message || 'Erro ao vincular instancia ao corretor')
        }
    }

    useEffect(() => {
        fetchBrokers()
        fetchLandingPages()
        loadEmpreendimentos()
        loadAvailableInstances()
        loadCustomLinkTags()
        // Run migration for new columns
        fetch('/api/admin/migrate-broker-assignment', { method: 'POST' }).catch(() => { })
        // Load TTS configs and voices
        fetch('/api/admin/configs').then(r => r.json()).then(json => {
            if (json.success) {
                setTtsConfigs(json.configs)
                // Auto-load ElevenLabs voices
                const apiKey = json.configs['elevenlabs_api_key']
                if (apiKey) {
                    setLoadingVoices(true)
                    fetch('/api/admin/elevenlabs-voices', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ apiKey })
                    }).then(r => r.json()).then(data => {
                        if (data.success) setElevenLabsVoices(data.voices)
                    }).catch(() => { }).finally(() => setLoadingVoices(false))
                }
            }
        }).catch(() => { })
    }, [])

    useEffect(() => {
        return () => {
            if (previewAudioUrl && previewAudioUrl.startsWith('blob:')) URL.revokeObjectURL(previewAudioUrl)
        }
    }, [previewAudioUrl])

    async function loadCustomLinkTags() {
        try {
            const res = await fetch('/api/admin/whatsapp/agent-config')
            const data = await res.json()
            const raw = data?.config?.agent_link_buttons
            if (!raw) {
                setCustomLinkTags([])
                return
            }
            const parsed = JSON.parse(raw)
            if (!Array.isArray(parsed)) {
                setCustomLinkTags([])
                return
            }
            const valid = parsed.filter((item: unknown) => {
                if (!item || typeof item !== 'object') return false
                const maybe = item as { tag?: unknown }
                return typeof maybe.tag === 'string' && maybe.tag.trim().length > 0
            }) as CustomLinkButtonTag[]
            setCustomLinkTags(valid)
        } catch {
            setCustomLinkTags([])
        }
    }

    useEffect(() => {
        const selected = availableInstances.find(i => i.id === selectedInstanceId) || null
        setWhatsappInstance(selected)
        const clean = getInstancePhone(selected)
        setFormData(prev => ({ ...prev, phone: clean }))
    }, [selectedInstanceId, availableInstances])

    useEffect(() => {
        if (!selectedInstanceId) return
        const selected = availableInstances.find(i => i.id === selectedInstanceId)
        if (!selected) return
        if (getInstancePhone(selected)) return

        ; (async () => {
            try {
                const res = await fetch(`/api/admin/whatsapp/status?instanceId=${selectedInstanceId}`)
                const data = await res.json()
                if (res.ok && data?.phone) {
                    const clean = String(data.phone).replace(/\D/g, '')
                    setFormData(prev => ({ ...prev, phone: clean }))
                }
                await loadAvailableInstances()
            } catch {
                // noop
            }
        })()
    }, [selectedInstanceId])

    useEffect(() => {
        if (!editingBroker) return
        if (selectedInstanceId) return
        const brokerPhoneDigits = String(editingBroker.phone || '').replace(/\D/g, '')
        let linked = availableInstances.find(i =>
            i.broker_id === editingBroker.id ||
            i.id === editingBroker.whatsapp_instance_id ||
            (!!brokerPhoneDigits && getInstancePhone(i) === brokerPhoneDigits)
        )

        // Fallback: if there is exactly one connected instance, use it for convenience
        if (!linked) {
            const connected = availableInstances.filter(instanceIsConnected)
            if (connected.length === 1) linked = connected[0]
        }

        if (linked?.id) {
            setSelectedInstanceId(linked.id)
            setWhatsappInstance(linked)
        }
    }, [editingBroker, availableInstances, selectedInstanceId])

    async function fetchLandingPages() {
        const { data } = await supabase
            .from('landing_pages')
            .select('id, slug, title')
            .order('title')
        if (data) setLandingPages(data)
    }

    async function loadEmpreendimentos() {
        try {
            const res = await fetch('/api/admin/empreendimentos')
            const json = await res.json()
            setEmpreendimentos((json?.data || []) as Empreendimento[])
        } catch {
            setEmpreendimentos([])
        }
    }

    async function fetchBrokers() {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/brokers')
            const json = await res.json()
            if (Array.isArray(json?.data)) setBrokers(json.data as Broker[])
            else setBrokers([])
        } catch {
            setBrokers([])
        }
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
        const selectedInstance = availableInstances.find(i => i.id === selectedInstanceId) || null
        const syncedWhatsAppPhone = getInstancePhone(selectedInstance) || formData.phone || ''

        const payload = {
            ...formData,
            phone: syncedWhatsAppPhone,
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
                    await assignInstanceToBroker(editingBroker.id, selectedInstanceId || undefined)
                    setEditingBroker(null)
                    await loadAvailableInstances()
                    fetchBrokers()
                    setFormData({ ...defaultFormData })
                    setSelectedInstanceId('')
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
                    if (result?.data?.id) {
                        await assignInstanceToBroker(result.data.id, selectedInstanceId || undefined)
                    }
                    setIsAdding(false)
                    await loadAvailableInstances()
                    fetchBrokers()
                    setFormData({ ...defaultFormData })
                    setSelectedInstanceId('')
                }
            }
        } catch (err) {
            console.error('Submit Failed:', err)
        }
    }

    async function handleVoicePreview() {
        setPreviewError('')
        setPreviewLoading(true)
        try {
            const selectedEleven = !formData.voice_id.startsWith('openai:')
                ? elevenLabsVoices.find(v => v.voice_id === formData.voice_id)
                : null

            // Prefer built-in ElevenLabs demo preview to avoid credit usage.
            if (selectedEleven?.preview_url) {
                if (previewAudioUrl && previewAudioUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(previewAudioUrl)
                }
                setPreviewAudioUrl(selectedEleven.preview_url)
                setPreviewLoading(false)
                return
            }

            const res = await fetch('/api/admin/voice-preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    voiceId: formData.voice_id,
                    text: previewText,
                })
            })

            if (!res.ok) {
                let msg = 'Falha ao gerar prévia'
                try {
                    const err = await res.json()
                    msg = err?.error || msg
                } catch {
                    // ignore parse error
                }
                throw new Error(msg)
            }

            const blob = await res.blob()
            if (previewAudioUrl && previewAudioUrl.startsWith('blob:')) URL.revokeObjectURL(previewAudioUrl)
            const url = URL.createObjectURL(blob)
            setPreviewAudioUrl(url)
        } catch (err: any) {
            setPreviewError(err?.message || 'Falha ao gerar prévia de voz')
        } finally {
            setPreviewLoading(false)
        }
    }

    function buildHandoffPreview() {
        const base = (formData.handoff_prompt || '').trim()
        if (!base) {
            setHandoffPreviewOutput('Defina primeiro o Prompt Pós-Transferência para testar.')
            return
        }
        const compiled = base
            .replace(/\{nome_lead\}/g, handoffPreviewLeadName || 'cliente')
            .replace(/\{nome_corretor\}/g, formData.name || 'corretor')
            .replace(/\{telefone\}/g, formData.phone || '+55...')
            .replace(/\{interesse\}/g, handoffPreviewInterest || 'não identificado')
            .replace(/\{orcamento\}/g, handoffPreviewBudget || 'não informado')
            .replace(/\{regiao\}/g, handoffPreviewRegion || 'não informada')
            .replace(/\{empreendimento\}/g, handoffPreviewEmpreendimento || 'seu interesse')
        setHandoffPreviewOutput(compiled)
    }

    async function deleteBroker(id: string) {
        if (!confirm('Tem certeza que deseja excluir este corretor?')) return
        await supabase.from('virtual_brokers').delete().eq('id', id)
        fetchBrokers()
    }

    const isTextOnlyMode = (() => {
        const currentInstance = availableInstances.find(inst => inst.id === selectedInstanceId) || whatsappInstance;
        return currentInstance?.config?.response_mode === 'text';
    })();

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
                            setSelectedInstanceId('')
                            setWhatsappInstance(null)
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
                            {!!formatBrPhone(getInstancePhone(whatsappInstance) || formData.phone) && (
                                <div style={{
                                    marginTop: '2px',
                                    padding: '6px 10px',
                                    borderRadius: '999px',
                                    border: '1px solid rgba(34,197,94,0.25)',
                                    background: 'rgba(34,197,94,0.08)',
                                    color: '#16a34a',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                }}>
                                    WhatsApp {formatBrPhone(getInstancePhone(whatsappInstance) || formData.phone)}
                                </div>
                            )}
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
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Conectados deste Corretor</label>
                                <select
                                    className="form-input"
                                    value={selectedInstanceId}
                                    onChange={(e) => setSelectedInstanceId(e.target.value)}
                                >
                                    <option value="">Selecione uma instância já escaneada...</option>
                                    {availableInstances.map((inst) => {
                                        const occupiedByOther = !!inst.broker_id && inst.broker_id !== editingBroker?.id
                                        const brokerName = inst.virtual_brokers?.name || 'agente'
                                        const phoneText = formatBrPhone(getInstancePhone(inst))
                                        return (
                                            <option key={inst.id} value={inst.id} disabled={occupiedByOther}>
                                                {inst.instance_name} • {inst.status}{phoneText ? ` • ${phoneText}` : ''}{occupiedByOther ? ` • em uso por ${brokerName}` : ''}
                                            </option>
                                        )
                                    })}
                                </select>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                                    O QR Code é gerado apenas em WhatsApp Web &gt; Instâncias. Aqui você só vincula uma instância já conectada.
                                </div>
                            </div>

                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-6px' }}>
                                O número WhatsApp sincronizado aparece ao lado da foto do corretor.
                            </div>
                            <div style={{ padding: '20px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.2)', marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '1rem', color: '#f59e0b', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    📲 Transferência para Humano
                                </h3>
                                <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '12px' }}>
                                    Defina para onde os resumos de plantão devem ser enviados.
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '4px' }}>WhatsApp para Resumo de Plantão</label>
                                        <input
                                            value={formData.summary_to_phone || ''}
                                            onChange={(e) => setFormData({ ...formData, summary_to_phone: e.target.value.replace(/\D/g, '') })}
                                            placeholder="Opcional: 5547999999999"
                                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e0ddd8', fontSize: '0.88rem', fontFamily: 'inherit', background: '#fafafa' }}
                                        />
                                        <p style={{ fontSize: '0.72rem', color: '#aaa', marginTop: '4px' }}>
                                            Se vazio, o sistema tenta enviar o resumo para o próprio número da instância (mensagem para si mesmo).
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* —— SEÇÃO 3: AGENTE IA (PROMPT) —— */}
                            <div style={{ padding: '20px', background: 'rgba(201, 169, 110, 0.05)', borderRadius: '12px', border: '1px solid rgba(201, 169, 110, 0.2)' }}>
                                <h3 style={{ fontSize: '1rem', color: 'var(--gold)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Brain size={18} /> 🤖 Agente IA (Prompt do WhatsApp)
                                </h3>
                                <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '16px' }}>
                                    Escreva como o agente deve conversar. Use as <strong>tags</strong> abaixo para dar poderes ao agente — ele usará cada uma no momento certo, de forma natural.
                                </p>


                                {/* Tags Reference Panel */}
                                <div style={{ marginBottom: '14px', padding: '14px', borderRadius: '10px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
                                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#818cf8', fontWeight: 700, marginBottom: '10px' }}>
                                        📌 Tags Disponíveis — clique para inserir no prompt
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {[
                                            { tag: '{nome_lead}', desc: 'Nome do lead (coletado na conversa)', color: '#22c55e' },
                                            { tag: '{nome_corretor}', desc: 'Nome deste corretor IA', color: '#22c55e' },
                                            { tag: '{agendamento}', desc: 'Botão para agendar visita/reunião', color: '#818cf8' },
                                            { tag: '{regioes}', desc: 'Lista interativa de regiões', color: '#818cf8' },
                                            { tag: '{transferir}', desc: 'Transferir ao corretor humano', color: '#f59e0b' },
                                            { tag: '{documentos}', desc: 'Botão para solicitar documentos', color: '#818cf8' },
                                            { tag: '{horario}', desc: 'Horários de atendimento', color: '#06b6d4' },
                                            { tag: '{empresa}', desc: 'Info da Pilger Imóveis', color: '#06b6d4' },
                                            { tag: '{imoveis}', desc: 'O agente já tem acesso aos imóveis ativos automaticamente', color: '#f59e0b' },
                                            ...customLinkTags.map(btn => ({
                                                tag: btn.tag,
                                                desc: `Ação dinâmica ${btn.type || 'URL'}: ${btn.name || btn.tag}`,
                                                color: '#0ea5e9'
                                            }))
                                        ].map(t => (
                                            <button key={t.tag} type="button" title={t.desc}
                                                onClick={() => {
                                                    const ta = document.getElementById('broker-prompt-textarea') as HTMLTextAreaElement
                                                    if (ta) {
                                                        const start = ta.selectionStart; const end = ta.selectionEnd
                                                        const text = formData.system_prompt || ''
                                                        const newText = text.substring(0, start) + t.tag + text.substring(end)
                                                        setFormData({ ...formData, system_prompt: newText })
                                                        setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + t.tag.length }, 50)
                                                    } else { setFormData({ ...formData, system_prompt: (formData.system_prompt || '') + t.tag }) }
                                                }}
                                                style={{ padding: '4px 10px', borderRadius: '6px', border: `1px solid ${t.color}33`, background: `${t.color}15`, color: t.color, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'monospace' }}>
                                                {t.tag}
                                            </button>
                                        ))}
                                    </div>
                                    <div style={{ marginTop: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        💡 O agente usará estas ações no momento certo da conversa — não seguirá roteiro, será natural como uma pessoa real.
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Prompt do Agente IA</label>
                                    <textarea
                                        id="broker-prompt-textarea"
                                        className="form-textarea"
                                        style={{ minHeight: '280px', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.6' }}
                                        value={formData.system_prompt}
                                        onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                                        placeholder={`Você é {nome_corretor}, corretor de imóveis da Pilger Imóveis em Balneário Camboriú.\n\nCOMO SE COMPORTAR:\n- Converse naturalmente, como uma pessoa real no WhatsApp\n- Seja simpático, use linguagem informal mas profissional\n- Use frases curtas (é WhatsApp, não email)\n- NUNCA pareça um robô ou siga um roteiro engessado\n- Adapte-se ao estilo do cliente\n\nO QUE COLETAR (naturalmente, durante a conversa):\n- Nome do cliente\n- Se quer comprar pra morar ou investir\n- Região de interesse\n- Faixa de orçamento\n\nQUANDO USAR AS FERRAMENTAS:\n- Quando o lead demonstrar interesse real, ofereça agendar visita com {agendamento}\n- Se perguntar sobre regiões, use {regioes}\n- Quando tiver todas as informações, use {transferir}\n- Sempre chame pelo nome quando souber: {nome_lead}\n\nIMPORTANTE:\n- Nunca invente dados de imóveis\n- Nunca fale preço exato\n- Nunca revele que é IA`}
                                    />
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                                        Escreva como o agente deve conversar. Use as tags acima para dar ações ao agente. Quanto mais contexto, mais natural o atendimento.
                                    </div>
                                </div>

                                {/* Voice Selection */}
                                <div className="form-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        <Mic size={16} /> Voz do Agente
                                    </label>
                                    <select
                                        className="form-input"
                                        value={formData.voice_id}
                                        onChange={(e) => setFormData({ ...formData, voice_id: e.target.value })}
                                        disabled={isTextOnlyMode}
                                        style={{ backgroundColor: isTextOnlyMode ? 'rgba(255,255,255,0.05)' : undefined }}
                                    >
                                        {isTextOnlyMode && (
                                            <optgroup label="⚠️ Desabilitado: Modo 'Sempre Texto'"></optgroup>
                                        )}
                                        <option value="">🔄 Usar voz padrão da Sala de Manutenção</option>
                                        {/* ElevenLabs voices */}
                                        {elevenLabsVoices.length > 0 && (
                                            <optgroup label="🎤 ElevenLabs">
                                                {elevenLabsVoices.filter(v => v.category === 'cloned').map(v => (
                                                    <option key={v.voice_id} value={v.voice_id}>
                                                        🎤 {v.name} (Clonada)
                                                    </option>
                                                ))}
                                                {elevenLabsVoices.filter(v => v.category !== 'cloned').map(v => (
                                                    <option key={v.voice_id} value={v.voice_id}>
                                                        🔊 {v.name} ({v.category})
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                        {/* OpenAI TTS voices */}
                                        <optgroup label="🤖 OpenAI TTS">
                                            <option value="openai:alloy">Alloy (Neutra)</option>
                                            <option value="openai:echo">Echo (Masculina)</option>
                                            <option value="openai:fable">Fable (Narrativa)</option>
                                            <option value="openai:onyx">Onyx (Masculina Grave)</option>
                                            <option value="openai:nova">Nova (Feminina)</option>
                                            <option value="openai:shimmer">Shimmer (Feminina Suave)</option>
                                        </optgroup>
                                        {/* Fallback for saved voice not in list */}
                                        {formData.voice_id && !elevenLabsVoices.find(v => v.voice_id === formData.voice_id) && !formData.voice_id.startsWith('openai:') && (
                                            <option value={formData.voice_id}>
                                                🎤 ID salvo: {formData.voice_id.substring(0, 20)}...
                                            </option>
                                        )}
                                    </select>
                                    {isTextOnlyMode && (
                                        <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '6px', fontWeight: 600 }}>
                                            ⚠️ O Modo de Resposta desta instância de WhatsApp está configurado para &apos;Sempre Texto&apos;. Modifique na aba Instâncias WhatsApp se quiser usar Voz.
                                        </div>
                                    )}
                                    {loadingVoices && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>⏳ Carregando vozes do ElevenLabs...</div>}
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                                        Escolha a voz que este corretor usará para responder áudios. Deixe em branco para usar a voz padrão configurada na Sala de Manutenção.
                                    </div>
                                    {!formData.voice_id.startsWith('openai:') && (
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                                            Prévia tenta usar demo pronta do ElevenLabs (quando disponível) para não consumir créditos.
                                        </div>
                                    )}
                                    <div style={{ marginTop: '10px', display: 'grid', gap: '8px' }}>
                                        <input
                                            className="form-input"
                                            value={previewText}
                                            onChange={(e) => setPreviewText(e.target.value)}
                                            placeholder="Texto para testar a voz"
                                        />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <button
                                                type="button"
                                                className="btn btn-secondary"
                                                onClick={handleVoicePreview}
                                                disabled={previewLoading}
                                                style={{ padding: '8px 12px' }}
                                            >
                                                {previewLoading ? 'Gerando prévia...' : 'Ouvir prévia'}
                                            </button>
                                            {previewAudioUrl && (
                                                <audio controls src={previewAudioUrl} style={{ height: '34px' }} />
                                            )}
                                        </div>
                                        {previewError && (
                                            <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>{previewError}</div>
                                        )}
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginTop: '14px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        Prompt Pós-Transferência (Especialista)
                                    </label>
                                    <textarea
                                        className="form-textarea"
                                        style={{ minHeight: '110px', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.82rem', lineHeight: '1.5' }}
                                        value={formData.handoff_prompt}
                                        onChange={(e) => setFormData({ ...formData, handoff_prompt: e.target.value })}
                                        placeholder={`Oi {nome_lead}, tudo bem?\nSou {nome_corretor}. O time me passou seu atendimento sobre {empreendimento}.\nVi que seu interesse é {interesse} e faixa {orcamento}. Posso te ajudar a avançar agora.`}
                                    />
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                                        Variáveis: {'{nome_lead}'} {'{nome_corretor}'} {'{telefone}'} {'{interesse}'} {'{orcamento}'} {'{regiao}'} {'{empreendimento}'}
                                    </div>
                                    <div style={{ marginTop: '10px', padding: '10px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-secondary)' }}>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                                            Testar handoff prompt
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            <input className="form-input" value={handoffPreviewLeadName} onChange={(e) => setHandoffPreviewLeadName(e.target.value)} placeholder="Nome do lead" />
                                            <input className="form-input" value={handoffPreviewEmpreendimento} onChange={(e) => setHandoffPreviewEmpreendimento(e.target.value)} placeholder="Empreendimento" />
                                            <input className="form-input" value={handoffPreviewInterest} onChange={(e) => setHandoffPreviewInterest(e.target.value)} placeholder="Interesse" />
                                            <input className="form-input" value={handoffPreviewBudget} onChange={(e) => setHandoffPreviewBudget(e.target.value)} placeholder="Orçamento" />
                                            <input className="form-input" value={handoffPreviewRegion} onChange={(e) => setHandoffPreviewRegion(e.target.value)} placeholder="Região" />
                                        </div>
                                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <button type="button" className="btn btn-secondary" onClick={buildHandoffPreview} style={{ padding: '8px 12px' }}>
                                                Testar handoff prompt
                                            </button>
                                        </div>
                                        {handoffPreviewOutput && (
                                            <div style={{ marginTop: '8px', padding: '10px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px dashed var(--border)', whiteSpace: 'pre-wrap', fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                                                {handoffPreviewOutput}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>


                            <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '8px' }}>
                                    Empreendimentos Atendidos
                                </h3>
                                <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '12px' }}>
                                    Selecione os empreendimentos que este corretor especialista atende. Cadastro global em WhatsApp Web &gt; Config do Agente.
                                </p>
                                {empreendimentos.length === 0 ? (
                                    <span style={{ color: '#aaa', fontSize: '0.82rem' }}>Nenhum empreendimento cadastrado no Agente Global.</span>
                                ) : (
                                    <>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', marginBottom: '10px' }}>
                                            <select
                                                className="form-input"
                                                value={selectedEmpreendimentoToAdd}
                                                onChange={(e) => setSelectedEmpreendimentoToAdd(e.target.value)}
                                            >
                                                <option value="">Selecione um empreendimento...</option>
                                                {empreendimentos.map((emp) => (
                                                    <option key={emp.id} value={emp.id} disabled={formData.empreendimento_ids.includes(emp.id)}>
                                                        {emp.nome} ({emp.slug})
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                className="btn btn-secondary"
                                                onClick={() => {
                                                    if (!selectedEmpreendimentoToAdd) return
                                                    if (formData.empreendimento_ids.includes(selectedEmpreendimentoToAdd)) return
                                                    setFormData({
                                                        ...formData,
                                                        empreendimento_ids: [...formData.empreendimento_ids, selectedEmpreendimentoToAdd],
                                                    })
                                                    setSelectedEmpreendimentoToAdd('')
                                                }}
                                            >
                                                Adicionar
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {formData.empreendimento_ids.length === 0 && (
                                                <span style={{ color: '#aaa', fontSize: '0.82rem' }}>Nenhum empreendimento selecionado.</span>
                                            )}
                                            {formData.empreendimento_ids.map((empId) => {
                                                const emp = empreendimentos.find((e) => e.id === empId)
                                                const label = emp?.nome || empId
                                                return (
                                                    <span key={empId} style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        background: 'rgba(201, 169, 110, 0.12)',
                                                        border: '1px solid rgba(201, 169, 110, 0.35)',
                                                        color: 'var(--text-primary)',
                                                        borderRadius: '999px',
                                                        padding: '6px 10px',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 600,
                                                    }}>
                                                        {label}
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData({
                                                                ...formData,
                                                                empreendimento_ids: formData.empreendimento_ids.filter((id) => id !== empId),
                                                            })}
                                                            style={{
                                                                border: 'none',
                                                                background: 'transparent',
                                                                cursor: 'pointer',
                                                                color: '#b45309',
                                                                fontWeight: 700,
                                                                padding: 0,
                                                                lineHeight: 1,
                                                            }}
                                                            title="Remover"
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                )
                                            })}
                                        </div>
                                    </>
                                )}
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
                            {!!broker.empreendimento_names?.length && (
                                <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {broker.empreendimento_names.slice(0, 4).map((n) => (
                                        <span key={n} style={{ padding: '2px 8px', background: 'rgba(14, 165, 233, 0.1)', border: '1px solid rgba(14, 165, 233, 0.3)', borderRadius: '12px', fontSize: '0.65rem', color: '#0ea5e9', fontWeight: 600 }}>
                                            {n}
                                        </span>
                                    ))}
                                    {broker.empreendimento_names.length > 4 && (
                                        <span style={{ padding: '2px 8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                                            +{broker.empreendimento_names.length - 4}
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
                                        assignment_type: broker.assignment_type || 'all',
                                        assigned_page_slugs: broker.assigned_page_slugs || [],
                                        phone: broker.phone || '',
                                        summary_to_phone: (broker as any).summary_to_phone || '',

                                        system_prompt: broker.system_prompt || '',
                                        voice_id: (broker as any).voice_id || '',
                                        handoff_prompt: (broker as any).handoff_prompt || '',
                                        empreendimento_ids: (broker as any).empreendimento_ids || [],


                                    })
                                    // Load linked instance for this broker
                                    const brokerPhoneDigits = String(broker.phone || '').replace(/\D/g, '')
                                    const linked = availableInstances.find(i =>
                                        i.broker_id === broker.id ||
                                        i.id === broker.whatsapp_instance_id ||
                                        (!!brokerPhoneDigits && getInstancePhone(i) === brokerPhoneDigits)
                                    )
                                    setSelectedInstanceId(linked?.id || '')
                                    setWhatsappInstance(linked || null)
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
