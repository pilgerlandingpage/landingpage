'use client'

import { useState, useEffect } from 'react'
import {
    Smartphone, RefreshCw, Loader2, AlertCircle, CheckCircle2,
    Wifi, WifiOff, Phone, User, Clock, Globe, Battery, BatteryCharging,
    Bot, Shield, Link2, Monitor, MessageSquare, Mic, Settings,
    ChevronDown, ChevronUp, Save, Power, Eye,
    SplitSquareVertical, Users, Timer
} from 'lucide-react'

interface LiveData {
    phone?: string; pushName?: string; platform?: string
    battery?: number; plugged?: boolean; isOnline?: boolean
    profilePicUrl?: string; webhookUrl?: string
}
interface BrokerData { id: string; name: string; creci: string; photo_url: string; is_active: boolean; system_prompt?: string; voice_id?: string }
interface AdminUserData { id: string; name: string; email: string }
interface Instance {
    id: string; admin_user_id: string; broker_id?: string
    instance_name: string; instance_token?: string
    phone_number: string | null; status: 'disconnected' | 'connecting' | 'connected'
    connected_at: string | null; created_at: string; config?: Record<string, any>
    virtual_brokers?: BrokerData; admin_users?: AdminUserData; live_data?: LiveData | null
}

interface InstanceConfig {
    agent_enabled: boolean; always_online: boolean; mark_as_read: boolean
    response_mode: 'text' | 'audio' | 'mirror'
    media_image_enabled: boolean; media_document_enabled: boolean; media_video_enabled: boolean
    split_messages: boolean; mirror_mode: boolean; audio_response: boolean
    audio_transcription: boolean; human_intervention: boolean
    debounce_seconds: number; human_intervention_minutes: number
}

const AGENT_DEPENDENT_BOOLEAN_KEYS: Array<keyof InstanceConfig> = [
    'always_online',
    'mark_as_read',
    'split_messages',
    'mirror_mode',
    'audio_response',
    'audio_transcription',
    'human_intervention',
    'media_image_enabled',
    'media_document_enabled',
    'media_video_enabled',
]

const DEFAULT_CONFIG: InstanceConfig = {
    agent_enabled: true, always_online: true, mark_as_read: true,
    response_mode: 'mirror',
    media_image_enabled: true, media_document_enabled: true, media_video_enabled: true,
    split_messages: true, mirror_mode: false, audio_response: true,
    audio_transcription: true, human_intervention: true,
    debounce_seconds: 15, human_intervention_minutes: 60,
}

export default function WhatsAppInstancesPage() {
    const [instances, setInstances] = useState<Instance[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [refreshing, setRefreshing] = useState(false)
    const [expandedCard, setExpandedCard] = useState<string | null>(null)
    const [expandedSettings, setExpandedSettings] = useState<string | null>(null)
    const [configs, setConfigs] = useState<Record<string, InstanceConfig>>({})
    const [savingSettings, setSavingSettings] = useState<string | null>(null)

    useEffect(() => { loadInstances() }, [])

    const loadInstances = async () => {
        setLoading(true); setError(null)
        try {
            const res = await fetch('/api/admin/whatsapp/instances')
            if (!res.ok) throw new Error('Falha ao carregar instâncias')
            const data = await res.json()
            if (!data.success) throw new Error(data.message)
            const insts = data.instances || []
            setInstances(insts)
            // Load configs from instance.config field
            const cfgMap: Record<string, InstanceConfig> = {}
            insts.forEach((inst: Instance) => {
                const raw = { ...DEFAULT_CONFIG, ...(inst.config || {}) } as InstanceConfig
                if (!raw.response_mode) {
                    raw.response_mode = raw.mirror_mode ? 'mirror' : (raw.audio_response ? 'audio' : 'text')
                }
                cfgMap[inst.id] = raw
            })
            setConfigs(cfgMap)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro desconhecido')
        } finally { setLoading(false) }
    }

    const refreshAll = async () => {
        setRefreshing(true); await loadInstances(); setRefreshing(false)
    }

    const saveSettings = async (instanceId: string) => {
        setSavingSettings(instanceId)
        try {
            const res = await fetch('/api/admin/whatsapp/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instance_id: instanceId, settings: configs[instanceId] })
            })
            if (!res.ok) throw new Error('Erro ao salvar')
        } catch (err) { console.error(err) }
        finally { setSavingSettings(null) }
    }

    const updateConfig = (instanceId: string, key: string, value: any) => {
        setConfigs(prev => {
            const current = prev[instanceId] || DEFAULT_CONFIG
            const next: InstanceConfig = { ...current, [key]: value }

            if (key === 'agent_enabled') {
                if (!value) {
                    for (const depKey of AGENT_DEPENDENT_BOOLEAN_KEYS) next[depKey] = false
                    next.response_mode = 'text'
                }
                return { ...prev, [instanceId]: next }
            }

            if (!current.agent_enabled) return prev
            return { ...prev, [instanceId]: next }
        })
    }

    const connectedCount = instances.filter(i => i.status === 'connected').length
    const agentInstances = instances.filter(i => i.broker_id)
    const userInstances = instances.filter(i => !i.broker_id)

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '12px', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="spin" /> Carregando instâncias...
        </div>
    )

    if (error) return (
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <AlertCircle size={48} style={{ color: '#ef4444', marginBottom: 16 }} />
            <p style={{ color: '#ef4444', fontSize: '1.1rem' }}>Falha ao carregar instâncias</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 8 }}>{error}</p>
            <button onClick={loadInstances} style={{ marginTop: 16, padding: '10px 24px', borderRadius: '10px', background: 'var(--gold)', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                Tentar Novamente
            </button>
        </div>
    )

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.5rem', margin: 0 }}>
                        <Smartphone size={26} style={{ color: 'var(--gold)' }} /> WhatsApp - Instâncias
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
                        {instances.length} instância{instances.length !== 1 ? 's' : ''} • {connectedCount} conectada{connectedCount !== 1 ? 's' : ''}
                    </p>
                </div>
                <button onClick={refreshAll} disabled={refreshing}
                    style={{ padding: '10px 20px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
                    <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
                    {refreshing ? 'Atualizando...' : 'Atualizar'}
                </button>
            </div>

            {/* Agent Instances Section */}
            {agentInstances.length > 0 && (
                <div style={{ marginBottom: '32px' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: 'var(--gold)', marginBottom: '12px' }}>
                        <Bot size={20} /> Agentes IA ({agentInstances.length})
                    </h2>
                    <div style={{ display: 'grid', gap: '12px' }}>
                        {agentInstances.map(inst => (
                            <InstanceCard key={inst.id} inst={inst} type="agent"
                                expanded={expandedCard === inst.id}
                                onToggleExpand={() => setExpandedCard(expandedCard === inst.id ? null : inst.id)}
                                settingsExpanded={expandedSettings === inst.id}
                                onToggleSettings={() => setExpandedSettings(expandedSettings === inst.id ? null : inst.id)}
                                config={configs[inst.id] || DEFAULT_CONFIG}
                                onUpdateConfig={(key, val) => updateConfig(inst.id, key, val)}
                                onSaveSettings={() => saveSettings(inst.id)}
                                savingSettings={savingSettings === inst.id}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* User Instances Section */}
            {userInstances.length > 0 && (
                <div style={{ marginBottom: '32px' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: '#6366f1', marginBottom: '12px' }}>
                        <Users size={20} /> Corretores / Usuários ({userInstances.length})
                    </h2>
                    <div style={{ display: 'grid', gap: '12px' }}>
                        {userInstances.map(inst => (
                            <InstanceCard key={inst.id} inst={inst} type="user"
                                expanded={expandedCard === inst.id}
                                onToggleExpand={() => setExpandedCard(expandedCard === inst.id ? null : inst.id)}
                                settingsExpanded={expandedSettings === inst.id}
                                onToggleSettings={() => setExpandedSettings(expandedSettings === inst.id ? null : inst.id)}
                                config={configs[inst.id] || DEFAULT_CONFIG}
                                onUpdateConfig={(key, val) => updateConfig(inst.id, key, val)}
                                onSaveSettings={() => saveSettings(inst.id)}
                                savingSettings={savingSettings === inst.id}
                            />
                        ))}
                    </div>
                </div>
            )}

            {instances.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 24px', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border)' }}>
                    <Smartphone size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Nenhuma instância WhatsApp</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 8 }}>
                        Crie agentes IA em <strong>Corretores IA</strong> ou conecte WhatsApp em <strong>Gestão de Usuários</strong>.
                    </p>
                </div>
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
                .spin { animation: spin 1.2s linear infinite; }
            `}</style>
        </div>
    )
}

// Instance Card Component

function InstanceCard({ inst, type, expanded, onToggleExpand, settingsExpanded, onToggleSettings, config, onUpdateConfig, onSaveSettings, savingSettings }: {
    inst: Instance; type: 'agent' | 'user'
    expanded: boolean; onToggleExpand: () => void
    settingsExpanded: boolean; onToggleSettings: () => void
    config: InstanceConfig
    onUpdateConfig: (key: string, value: any) => void
    onSaveSettings: () => void; savingSettings: boolean
}) {
    const [webhookLoading, setWebhookLoading] = useState(false)
    const [webhookMessage, setWebhookMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [setupLoading, setSetupLoading] = useState(false)
    const [setupMessage, setSetupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [privacyLoading, setPrivacyLoading] = useState(false)
    const [privacyMessage, setPrivacyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const isConnected = inst.status === 'connected'
    const accentColor = type === 'agent' ? 'var(--gold)' : '#6366f1'
    const name = type === 'agent' ? inst.virtual_brokers?.name : inst.admin_users?.name
    const subtitle = type === 'agent' ? `CRECI: ${inst.virtual_brokers?.creci || '—'}` : inst.admin_users?.email
    const photoUrl = type === 'agent' ? inst.virtual_brokers?.photo_url : inst.live_data?.profilePicUrl
    const prompt = type === 'agent' ? inst.virtual_brokers?.system_prompt : null
    const agentDisabled = !config.agent_enabled

    return (
        <div style={{
            background: 'var(--bg-secondary)', borderRadius: '14px',
            border: `1px solid ${isConnected ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
            overflow: 'hidden', transition: 'all 0.2s',
        }}>
            {/* Card Header */}
            <div onClick={onToggleExpand} style={{
                padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px',
                cursor: 'pointer', transition: 'background 0.2s',
            }}>
                {/* Avatar */}
                <div style={{
                    width: '48px', height: '48px', borderRadius: '50%',
                    background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}44)`,
                    border: `2px solid ${isConnected ? '#22c55e' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', flexShrink: 0,
                }}>
                    {photoUrl ? (
                        <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : type === 'agent' ? (
                        <Bot size={22} style={{ color: accentColor }} />
                    ) : (
                        <User size={22} style={{ color: accentColor }} />
                    )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                            {name || inst.instance_name}
                        </span>
                        <span style={{
                            fontSize: '0.65rem', padding: '2px 8px', borderRadius: '20px',
                            background: type === 'agent' ? 'rgba(201,169,110,0.15)' : 'rgba(99,102,241,0.15)',
                            color: accentColor, fontWeight: 700,
                        }}>
                            {type === 'agent' ? 'AGENTE IA' : 'CORRETOR'}
                        </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {subtitle}
                    </div>
                </div>

                {/* Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {isConnected ? (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(34,197,94,0.1)', borderRadius: '20px' }}>
                                <Wifi size={14} style={{ color: '#22c55e' }} />
                                <span style={{ color: '#22c55e', fontWeight: 600, fontSize: '0.8rem' }}>Online</span>
                            </div>
                            {inst.live_data?.phone && (
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    {inst.live_data.phone}
                                </span>
                            )}
                        </>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: '20px' }}>
                            <WifiOff size={14} style={{ color: '#ef4444' }} />
                            <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.8rem' }}>Desconectado</span>
                        </div>
                    )}
                    {expanded ? <ChevronUp size={18} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={18} style={{ color: 'var(--text-muted)' }} />}
                </div>
            </div>

            {/* Expanded Details */}
            {expanded && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                    {/* Instance Details */}
                    <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                        <DetailItem icon={<Globe size={13} />} label="Instância" value={inst.instance_name} />
                        {inst.live_data?.platform && <DetailItem icon={<Monitor size={13} />} label="Plataforma" value={inst.live_data.platform} />}
                        {inst.live_data?.battery != null && (
                            <DetailItem icon={inst.live_data.plugged ? <BatteryCharging size={13} /> : <Battery size={13} />}
                                label="Bateria" value={`${inst.live_data.battery}%${inst.live_data.plugged ? ' ⚡' : ''}`} />
                        )}
                        {inst.live_data?.webhookUrl && <DetailItem icon={<Link2 size={13} />} label="Webhook" value="✅ Configurado" valueColor="#22c55e" />}
                        {prompt && <DetailItem icon={<MessageSquare size={13} />} label="Prompt" value={`${prompt.length} caracteres`} />}
                        <DetailItem icon={<Clock size={13} />} label="Criada" value={new Date(inst.created_at).toLocaleDateString('pt-BR')} />
                    </div>

                    {/* Webhook Auto-Setup */}
                    {isConnected && (
                        <div style={{ padding: '0 20px 12px' }}>
                            <div style={{
                                padding: '12px 16px', borderRadius: '10px',
                                background: inst.live_data?.webhookUrl ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.06)',
                                border: `1px solid ${inst.live_data?.webhookUrl ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                    <Link2 size={16} style={{ color: inst.live_data?.webhookUrl ? '#22c55e' : '#f59e0b', flexShrink: 0 }} />
                                    <div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            Webhook {inst.live_data?.webhookUrl ? 'Ativo' : 'Não Configurado'}
                                        </div>
                                        {inst.live_data?.webhookUrl && (
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                                                {inst.live_data.webhookUrl}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation()
                                        setWebhookLoading(true)
                                        setWebhookMessage(null)
                                        try {
                                            const res = await fetch('/api/admin/whatsapp/webhook-setup', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ instanceId: inst.id })
                                            })
                                            const data = await res.json()
                                            if (data.success) {
                                                setWebhookMessage({ type: 'success', text: `✅ Webhook configurado: ${data.webhookUrl}` })
                                            } else {
                                                setWebhookMessage({ type: 'error', text: `❌ ${data.message}` })
                                            }
                                        } catch (err) {
                                            setWebhookMessage({ type: 'error', text: `❌ Erro de conexão` })
                                        } finally {
                                            setWebhookLoading(false)
                                        }
                                    }}
                                    disabled={webhookLoading}
                                    style={{
                                        padding: '8px 16px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600,
                                        border: 'none', cursor: 'pointer', flexShrink: 0,
                                        background: inst.live_data?.webhookUrl ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, var(--gold), #b8860b)',
                                        color: inst.live_data?.webhookUrl ? 'var(--text-secondary)' : '#000',
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        opacity: webhookLoading ? 0.6 : 1,
                                    }}
                                >
                                    {webhookLoading ? <Loader2 size={14} className="spin" /> : <Link2 size={14} />}
                                    {inst.live_data?.webhookUrl ? 'Reconfigurar' : 'Configurar Webhook'}
                                </button>
                            </div>
                            {webhookMessage && (
                                <div style={{
                                    marginTop: '8px', padding: '8px 12px', borderRadius: '8px', fontSize: '0.78rem',
                                    background: webhookMessage.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                                    color: webhookMessage.type === 'success' ? '#22c55e' : '#ef4444',
                                    border: `1px solid ${webhookMessage.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                                }}>
                                    {webhookMessage.text}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Setup Completo Button */}
                    {isConnected && (
                        <div style={{ padding: '0 20px 12px' }}>
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation()
                                    setSetupLoading(true)
                                    setSetupMessage(null)
                                    try {
                                        const res = await fetch('/api/admin/whatsapp/setup-full', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ instanceId: inst.id })
                                        })
                                        const data = await res.json()
                                        if (data.success) {
                                            setSetupMessage({ type: 'success', text: `✅ ${data.message}` })
                                        } else {
                                            setSetupMessage({ type: 'error', text: `❌ ${data.message}` })
                                        }
                                    } catch {
                                        setSetupMessage({ type: 'error', text: '❌ Erro de conexão' })
                                    } finally {
                                        setSetupLoading(false)
                                    }
                                }}
                                disabled={setupLoading}
                                style={{
                                    width: '100%', padding: '12px 16px', borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    border: 'none', color: '#fff', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    fontWeight: 600, fontSize: '0.85rem',
                                    opacity: setupLoading ? 0.6 : 1,
                                }}
                            >
                                {setupLoading ? <Loader2 size={16} className="spin" /> : '🚀'}
                                Setup Completo (Webhook + Privacidade + Etiquetas + Respostas Rápidas)
                            </button>
                            {setupMessage && (
                                <div style={{
                                    marginTop: '8px', padding: '8px 12px', borderRadius: '8px', fontSize: '0.78rem',
                                    background: setupMessage.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                                    color: setupMessage.type === 'success' ? '#22c55e' : '#ef4444',
                                    border: `1px solid ${setupMessage.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                                }}>
                                    {setupMessage.text}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Privacy Diagnostic Button */}
                    {isConnected && (
                        <div style={{ padding: '0 20px 12px' }}>
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation()
                                    setPrivacyLoading(true)
                                    setPrivacyMessage(null)
                                    try {
                                        const res = await fetch(`/api/admin/whatsapp/privacy-diagnostic?instance_id=${encodeURIComponent(inst.id)}`)
                                        const data = await res.json()

                                        if (!res.ok || !data.success) {
                                            setPrivacyMessage({ type: 'error', text: `❌ ${data.message || 'Falha no diagnóstico'}` })
                                            return
                                        }

                                        const onlineOk = data?.matches?.online ? '✅' : '⚠️'
                                        const readOk = data?.matches?.readreceipts ? '✅' : '⚠️'
                                        setPrivacyMessage({
                                            type: data?.matches?.online && data?.matches?.readreceipts ? 'success' : 'error',
                                            text: `${onlineOk} online: atual=${data?.actual?.online ?? 'n/a'} esperado=${data?.expected?.online} | ${readOk} readreceipts: atual=${data?.actual?.readreceipts ?? 'n/a'} esperado=${data?.expected?.readreceipts}`,
                                        })
                                    } catch {
                                        setPrivacyMessage({ type: 'error', text: '❌ Erro de conexão no diagnóstico de privacidade' })
                                    } finally {
                                        setPrivacyLoading(false)
                                    }
                                }}
                                disabled={privacyLoading}
                                style={{
                                    width: '100%', padding: '12px 16px', borderRadius: '10px',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    fontWeight: 600, fontSize: '0.84rem', opacity: privacyLoading ? 0.6 : 1,
                                }}
                            >
                                {privacyLoading ? <Loader2 size={16} className="spin" /> : <Shield size={16} />}
                                Diagnosticar Privacidade (online + visualizado)
                            </button>
                            {privacyMessage && (
                                <div style={{
                                    marginTop: '8px', padding: '8px 12px', borderRadius: '8px', fontSize: '0.78rem',
                                    background: privacyMessage.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                                    color: privacyMessage.type === 'success' ? '#22c55e' : '#ef4444',
                                    border: `1px solid ${privacyMessage.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                                    wordBreak: 'break-word',
                                }}>
                                    {privacyMessage.text}
                                </div>
                            )}
                        </div>
                    )}

                    <div style={{ padding: '0 20px 16px' }}>
                        <button onClick={(e) => { e.stopPropagation(); onToggleSettings() }}
                            style={{
                                width: '100%', padding: '12px 16px', borderRadius: '10px',
                                background: settingsExpanded ? `${accentColor}15` : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${settingsExpanded ? accentColor : 'var(--border)'}`,
                                color: 'var(--text-primary)', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s',
                            }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Settings size={16} style={{ color: accentColor }} />
                                ⚙️ Configurações de Comportamento
                            </span>
                            {settingsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                    </div>

                    {/* Per-Instance Settings Panel */}
                    {settingsExpanded && (
                        <div style={{ padding: '0 20px 20px' }}>
                            {agentDisabled && (
                                <div style={{
                                    marginBottom: '10px',
                                    padding: '10px 12px',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(239,68,68,0.25)',
                                    background: 'rgba(239,68,68,0.08)',
                                    color: '#fca5a5',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                }}>
                                    Agente desativado: todos os recursos automáticos estão desligados.
                                </div>
                            )}
                            <div style={{ display: 'grid', gap: '8px' }}>
                                {/* Behavior Toggles */}
                                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 700, padding: '8px 0 4px' }}>
                                    Comportamento
                                </div>
                                <ToggleSwitch label="Agente Ativado" icon={<Power size={15} />}
                                    checked={config.agent_enabled} onChange={() => onUpdateConfig('agent_enabled', !config.agent_enabled)} />
                                <ToggleSwitch label="Sempre Online" icon={<Wifi size={15} />}
                                    checked={config.always_online} onChange={() => onUpdateConfig('always_online', !config.always_online)} disabled={agentDisabled} />
                                <ToggleSwitch label="Marcar como Lido (✓✓)" icon={<Eye size={15} />}
                                    checked={config.mark_as_read} onChange={() => onUpdateConfig('mark_as_read', !config.mark_as_read)} disabled={agentDisabled} />
                                <ToggleSwitch label="Dividir Respostas em Partes" icon={<SplitSquareVertical size={15} />}
                                    checked={config.split_messages} onChange={() => onUpdateConfig('split_messages', !config.split_messages)} disabled={agentDisabled} />
                                <ResponseModeSelector
                                    value={config.response_mode}
                                    onChange={(mode) => onUpdateConfig('response_mode', mode)}
                                    disabled={agentDisabled}
                                />
                                <ToggleSwitch label="Intervenção Humana (parar quando humano intervém)" icon={<Shield size={15} />}
                                    checked={config.human_intervention} onChange={() => onUpdateConfig('human_intervention', !config.human_intervention)} disabled={agentDisabled} />

                                {/* Audio Toggles */}
                                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 700, padding: '12px 0 4px' }}>
                                    Áudio
                                </div>
                                <ToggleSwitch label="Transcrição de Áudio Recebido" icon={<Mic size={15} />}
                                    checked={config.audio_transcription} onChange={() => onUpdateConfig('audio_transcription', !config.audio_transcription)} disabled={agentDisabled} />
                                {/* Media AI Toggles */}
                                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 700, padding: '12px 0 4px' }}>
                                    Mídia com IA
                                </div>
                                <ToggleSwitch label="Analisar Imagens" icon={<Eye size={15} />}
                                    checked={config.media_image_enabled} onChange={() => onUpdateConfig('media_image_enabled', !config.media_image_enabled)} disabled={agentDisabled} />
                                <ToggleSwitch label="Analisar Documentos" icon={<Eye size={15} />}
                                    checked={config.media_document_enabled} onChange={() => onUpdateConfig('media_document_enabled', !config.media_document_enabled)} disabled={agentDisabled} />
                                <ToggleSwitch label="Analisar Vídeos" icon={<Eye size={15} />}
                                    checked={config.media_video_enabled} onChange={() => onUpdateConfig('media_video_enabled', !config.media_video_enabled)} disabled={agentDisabled} />
                                {/* Timing */}
                                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 700, padding: '12px 0 4px' }}>
                                    Temporizadores
                                </div>
                                <NumericInput label="Debounce (segundos)" value={String(config.debounce_seconds)}
                                    onChange={(v) => onUpdateConfig('debounce_seconds', parseInt(v) || 15)} min={5} max={120} disabled={agentDisabled} />
                                <NumericInput label="Reativar agente após (minutos)" value={String(config.human_intervention_minutes)}
                                    onChange={(v) => onUpdateConfig('human_intervention_minutes', parseInt(v) || 60)} min={5} max={1440} disabled={agentDisabled} />

                                {/* Save Button */}
                                <button onClick={onSaveSettings} disabled={savingSettings}
                                    style={{
                                        marginTop: '8px', padding: '12px 20px', borderRadius: '10px',
                                        background: 'linear-gradient(135deg, var(--gold), #b8860b)',
                                        border: 'none', color: '#000', fontWeight: 700, fontSize: '0.9rem',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        gap: '8px', opacity: savingSettings ? 0.6 : 1,
                                    }}>
                                    {savingSettings ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                                    {savingSettings ? 'Salvando...' : 'Salvar Configurações'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// Sub-Components

function DetailItem({ icon, label, value, valueColor }: { icon: React.ReactNode; label: string; value: string; valueColor?: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <div style={{ color: 'var(--text-muted)', marginTop: '1px', flexShrink: 0 }}>{icon}</div>
            <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                <div style={{ fontSize: '0.82rem', color: valueColor || 'var(--text-secondary)', fontWeight: 500 }}>{value}</div>
            </div>
        </div>
    )
}

function ToggleSwitch({ label, icon, checked, onChange, disabled = false }: { label: string; icon: React.ReactNode; checked: boolean; onChange: () => void; disabled?: boolean }) {
    return (
        <div onClick={() => !disabled && onChange()} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderRadius: '10px', cursor: disabled ? 'not-allowed' : 'pointer',
            background: disabled ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)', transition: 'all 0.2s', opacity: disabled ? 0.55 : 1,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: checked ? 'var(--gold)' : 'var(--text-muted)' }}>{icon}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>{label}</span>
            </div>
            <div style={{
                width: '40px', height: '22px', borderRadius: '11px',
                background: checked ? '#22c55e' : 'rgba(255,255,255,0.12)',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}>
                <div style={{
                    width: '16px', height: '16px', borderRadius: '50%', background: 'white',
                    position: 'absolute', top: '3px', left: checked ? '21px' : '3px',
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
            </div>
        </div>
    )
}

function ResponseModeSelector({ value, onChange, disabled = false }: { value: 'text' | 'audio' | 'mirror'; onChange: (v: 'text' | 'audio' | 'mirror') => void; disabled?: boolean }) {
    const options: Array<{ value: 'text' | 'audio' | 'mirror'; label: string; desc: string }> = [
        { value: 'text', label: 'Sempre texto', desc: 'Responde sempre por texto.' },
        { value: 'audio', label: 'Sempre áudio', desc: 'Responde por áudio quando possível.' },
        { value: 'mirror', label: 'Espelho', desc: 'Se receber áudio, responde em áudio.' },
    ]

    return (
        <div style={{ display: 'grid', gap: '6px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Modo de resposta</div>
            {options.map((opt) => {
                const active = value === opt.value
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => !disabled && onChange(opt.value)}
                        disabled={disabled}
                        style={{
                            textAlign: 'left',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            border: `1px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
                            background: active ? 'rgba(201,169,110,0.12)' : 'rgba(255,255,255,0.03)',
                            color: 'var(--text-primary)',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            opacity: disabled ? 0.55 : 1,
                        }}
                    >
                        <div style={{ fontSize: '0.84rem', fontWeight: 700 }}>{opt.label}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{opt.desc}</div>
                    </button>
                )
            })}
        </div>
    )
}

function NumericInput({ label, value, onChange, min, max, disabled = false }: { label: string; value: string; onChange: (v: string) => void; min?: number; max?: number; disabled?: boolean }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', opacity: disabled ? 0.55 : 1,
        }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>{label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button onClick={() => !disabled && onChange(String(Math.max(min || 0, parseInt(value) - 1)))} disabled={disabled}
                    style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    −
                </button>
                <input type="number" value={value} onChange={e => onChange(e.target.value)} min={min} max={max} disabled={disabled}
                    style={{ width: '50px', textAlign: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 6px', color: 'var(--gold)', fontSize: '0.9rem', fontWeight: 600, outline: 'none' }}
                />
                <button onClick={() => !disabled && onChange(String(Math.min(max || 9999, parseInt(value) + 1)))} disabled={disabled}
                    style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    +
                </button>
            </div>
        </div>
    )
}




