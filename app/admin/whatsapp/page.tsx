'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import {
    Smartphone, RefreshCw, Loader2, AlertCircle, CheckCircle2,
    Wifi, WifiOff, Phone, User, Clock, Globe, Battery, BatteryCharging,
    Bot, Shield, Link2, Monitor, MessageSquare, Mic, Settings,
    ChevronDown, ChevronUp, Save, Power, Eye, Plus,
    SplitSquareVertical, Users, Timer, BarChart3, Database, PlayCircle
} from 'lucide-react'
import AdminLoadingState from '@/components/admin/AdminLoadingState'
import { DEFAULT_WHATSAPP_INSTANCE_CONFIG, normalizeWhatsAppInstanceConfig } from '@/lib/whatsapp/instance-config'

interface LiveData {
    phone?: string; pushName?: string; platform?: string
    battery?: number; plugged?: boolean; isOnline?: boolean
    profilePicUrl?: string; webhookUrl?: string
}
interface BrokerData { id: string; name: string; creci: string; photo_url: string; is_active: boolean; phone?: string; system_prompt?: string; voice_id?: string }
interface AdminUserData { id: string; name: string; email: string }
interface Instance {
    id: string; admin_user_id: string; broker_id?: string
    instance_type?: 'global' | 'broker' | 'sector' | 'admin'
    instance_name: string; instance_token?: string
    phone_number: string | null; status: 'disconnected' | 'connecting' | 'connected'
    connected_at: string | null; created_at: string; config?: Record<string, any>
    virtual_brokers?: BrokerData; admin_users?: AdminUserData; live_data?: LiveData | null
}

function formatBrPhone(phone?: string | null): string {
    const digits = String(phone || '').replace(/\D/g, '')
    if (!digits) return ''
    if (digits.length === 13 && digits.startsWith('55')) return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
    if (digits.length === 12 && digits.startsWith('55')) return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`
    return `+${digits}`
}

interface InstanceConfig {
    agent_enabled: boolean; always_online: boolean; mark_as_read: boolean
    response_mode: 'text' | 'audio' | 'mirror'
    media_image_enabled: boolean; media_document_enabled: boolean; media_video_enabled: boolean
    media_batch_image_limit: number
    media_batch_video_limit: number
    media_batch_document_limit: number
    split_messages: boolean; mirror_mode: boolean; audio_response: boolean
    adaptive_rapport_enabled: boolean; adaptive_rapport_mode: 'off' | 'soft' | 'strong'
    audio_transcription: boolean; human_intervention: boolean
    bot_loop_protection_enabled: boolean
    allow_internal_instance_messages: boolean
    detect_human_request_enabled: boolean
    detect_reschedule_cancel_enabled: boolean
    detect_property_capture_enabled: boolean
    detect_location_enabled: boolean
    detect_opt_out_enabled: boolean
    analyze_links_enabled: boolean
    quoted_reply_context_enabled: boolean
    lead_file_storage_enabled: boolean
    ai_schedule_enabled: boolean
    ai_schedule_start: string
    ai_schedule_end: string
    ai_schedule_timezone: string
    debounce_seconds: number
    smart_timing_enabled: boolean
    timing_text_seconds: number
    timing_text_burst_seconds: number
    timing_media_caption_seconds: number
    timing_media_then_text_seconds: number
    timing_media_only_seconds: number
    timing_audio_seconds: number
    timing_audio_then_text_seconds: number
    timing_video_caption_seconds: number
    timing_video_only_seconds: number
    timing_document_caption_seconds: number
    timing_document_only_seconds: number
    timing_document_seconds: number
    timing_video_document_seconds: number
    timing_button_delay_seconds: number
    human_intervention_minutes: number
    attendance_monitor_enabled: boolean
    attendance_history_import_enabled: boolean
    attendance_daily_report_enabled: boolean
    attendance_report_hour: number
    attendance_report_timezone: string
}

type BooleanConfigKey = {
    [K in keyof InstanceConfig]: InstanceConfig[K] extends boolean ? K : never
}[keyof InstanceConfig]

const AGENT_DEPENDENT_BOOLEAN_KEYS: BooleanConfigKey[] = [
    'always_online',
    'mark_as_read',
    'split_messages',
    'adaptive_rapport_enabled',
    'mirror_mode',
    'audio_response',
    'audio_transcription',
    'human_intervention',
    'bot_loop_protection_enabled',
    'allow_internal_instance_messages',
    'detect_human_request_enabled',
    'detect_reschedule_cancel_enabled',
    'detect_property_capture_enabled',
    'detect_location_enabled',
    'detect_opt_out_enabled',
    'analyze_links_enabled',
    'quoted_reply_context_enabled',
    'lead_file_storage_enabled',
    'media_image_enabled',
    'media_document_enabled',
    'media_video_enabled',
    'ai_schedule_enabled',
    'smart_timing_enabled',
]

const AGENT_INDEPENDENT_CONFIG_KEYS = new Set<keyof InstanceConfig>([
    'attendance_monitor_enabled',
    'attendance_history_import_enabled',
    'attendance_daily_report_enabled',
    'attendance_report_hour',
    'attendance_report_timezone',
])

const DEFAULT_CONFIG: InstanceConfig = { ...DEFAULT_WHATSAPP_INSTANCE_CONFIG }

export default function WhatsAppInstancesPage() {
    const [instances, setInstances] = useState<Instance[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [refreshing, setRefreshing] = useState(false)
    const [expandedCard, setExpandedCard] = useState<string | null>(null)
    const [expandedSettings, setExpandedSettings] = useState<string | null>(null)
    const [configs, setConfigs] = useState<Record<string, InstanceConfig>>({})
    const [savingSettings, setSavingSettings] = useState<string | null>(null)
    const [runningAttendance, setRunningAttendance] = useState<string | null>(null)
    const [attendanceMessage, setAttendanceMessage] = useState<Record<string, { type: 'success' | 'error'; text: string }>>({})
    const [createBrokerName, setCreateBrokerName] = useState('')
    const [createInstanceName, setCreateInstanceName] = useState('')
    const [creatingInstance, setCreatingInstance] = useState(false)
    const [createQrCode, setCreateQrCode] = useState<string | null>(null)
    const [createMessage, setCreateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [createModalOpen, setCreateModalOpen] = useState(false)
    const [createFlowInstanceId, setCreateFlowInstanceId] = useState<string | null>(null)
    const [autoCheckingCreateStatus, setAutoCheckingCreateStatus] = useState(false)

    useEffect(() => { loadInstances() }, [])

    useEffect(() => {
        if (!createModalOpen || !createFlowInstanceId || !createQrCode) return

        const intervalId = setInterval(async () => {
            setAutoCheckingCreateStatus(true)
            try {
                const res = await fetch(`/api/admin/whatsapp/status?instanceId=${createFlowInstanceId}`)
                const data = await res.json()
                if (!res.ok || !data?.success) return

                if (data?.status === 'connected') {
                    setCreateMessage({ type: 'success', text: 'Instância conectada com sucesso. Você já pode configurar e ativar o agente.' })
                    setCreateQrCode(null)
                    setCreateFlowInstanceId(null)
                    await loadInstances(true)
                    setTimeout(() => setCreateModalOpen(false), 900)
                } else {
                    await loadInstances(true)
                }
            } catch {
                // noop: polling resiliente
            } finally {
                setAutoCheckingCreateStatus(false)
            }
        }, 4000)

        return () => clearInterval(intervalId)
    }, [createModalOpen, createFlowInstanceId, createQrCode])

    const loadInstances = async (silent = false) => {
        if (!silent) setLoading(true)
        setError(null)
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
                const raw = normalizeWhatsAppInstanceConfig(inst.config || {}) as InstanceConfig
                cfgMap[inst.id] = raw
            })
            setConfigs(cfgMap)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro desconhecido')
        } finally {
            if (!silent) setLoading(false)
        }
    }

    const refreshAll = async () => {
        setRefreshing(true); await loadInstances(true); setRefreshing(false)
    }

    const createInstanceAndGetQr = async () => {
        const brokerName = createBrokerName.trim()
        if (!brokerName) {
            setCreateMessage({ type: 'error', text: 'Informe o nome do corretor.' })
            return
        }
        setCreatingInstance(true)
        setCreateMessage(null)
        try {
            const brokerRes = await fetch('/api/admin/brokers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: brokerName, is_active: false, system_prompt: '', voice_id: '' }),
            })
            const brokerData = await brokerRes.json()
            const newBrokerId = brokerData?.data?.id
            if (!brokerRes.ok || !newBrokerId) {
                throw new Error(brokerData?.error || 'Falha ao criar corretor.')
            }

            const normalized = brokerName
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '')
                .slice(0, 24)

            const defaultInstanceName = `broker_${normalized || 'novo'}_${Date.now()}`
            const res = await fetch('/api/admin/whatsapp/qrcode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instance_name: createInstanceName.trim() || defaultInstanceName,
                    broker_id: newBrokerId,
                })
            })
            const data = await res.json()
            if (!res.ok || !data?.success) {
                throw new Error(data?.message || 'Falha ao criar/conectar instância.')
            }
            if (data?.qrcode) {
                setCreateQrCode(data.qrcode)
                setCreateFlowInstanceId(data.instanceId || null)
                setCreateMessage({ type: 'success', text: 'Instância criada. Escaneie o QR code.' })
            } else {
                setCreateMessage({ type: 'error', text: 'A instância foi criada, mas o QR code não retornou. Tente novamente.' })
            }
            await loadInstances(true)
        } catch (err) {
            setCreateMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao criar instância.' })
        } finally {
            setCreatingInstance(false)
        }
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

    const runAttendanceReport = async (instanceId: string) => {
        setRunningAttendance(instanceId)
        setAttendanceMessage(prev => ({ ...prev, [instanceId]: { type: 'success', text: 'Sincronizando contatos, conversas e mensagens...' } }))
        try {
            const res = await fetch('/api/admin/leads/attendance-reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'sync_and_report',
                    instance_id: instanceId,
                    force: true,
                    include_history_sync: true,
                }),
            })
            const data = await res.json()
            if (!res.ok || !data?.success) throw new Error(data?.error || 'Falha ao gerar relatório.')
            const totals = data?.sync?.totals || {}
            const reports = data?.reports?.reports?.length || 0
            setAttendanceMessage(prev => ({
                ...prev,
                [instanceId]: {
                    type: 'success',
                    text: `Relatório pronto: ${Number(totals.contacts || 0)} contatos, ${Number(totals.chats || 0)} chats, ${Number(totals.messages || 0)} mensagens e ${reports} relatório(s).`,
                },
            }))
        } catch (err) {
            setAttendanceMessage(prev => ({
                ...prev,
                [instanceId]: { type: 'error', text: err instanceof Error ? err.message : 'Erro ao executar monitor.' },
            }))
        } finally {
            setRunningAttendance(null)
        }
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

            if (!current.agent_enabled && !AGENT_INDEPENDENT_CONFIG_KEYS.has(key as keyof InstanceConfig)) return prev
            return { ...prev, [instanceId]: next }
        })
    }

    const connectedCount = instances.filter(i => i.status === 'connected').length
    const globalInstances = instances.filter(i => i.instance_type === 'global')
    const agentInstances = instances.filter(i => i.instance_type !== 'global' && i.broker_id)
    const userInstances = instances.filter(i => !i.broker_id && i.instance_type !== 'global')

    if (loading) return <AdminLoadingState message="Carregando instâncias..." minHeight="400px" />

    if (error) return (
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <AlertCircle size={48} style={{ color: '#ef4444', marginBottom: 16 }} />
            <p style={{ color: '#ef4444', fontSize: '1.1rem' }}>Falha ao carregar instâncias</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 8 }}>{error}</p>
            <button onClick={() => loadInstances()} style={{ marginTop: 16, padding: '10px 24px', borderRadius: '10px', background: 'var(--gold)', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
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
                        <Smartphone size={26} style={{ color: 'var(--gold)' }} /> WhatsApp - Conectados
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>
                        {instances.length} instância{instances.length !== 1 ? 's' : ''} operacional{instances.length !== 1 ? 'is' : ''} • {connectedCount} conectada{connectedCount !== 1 ? 's' : ''}
                    </p>
                </div>
                <button onClick={refreshAll} disabled={refreshing}
                    style={{ padding: '10px 20px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
                    <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
                    {refreshing ? 'Atualizando...' : 'Atualizar'}
                </button>
            </div>

            <div style={{ marginBottom: '16px', padding: '14px 16px', borderRadius: '12px', background: 'rgba(201,169,110,0.06)', border: '1px solid rgba(201,169,110,0.2)' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>
                    <Plus size={14} style={{ display: 'inline', marginRight: 6, color: 'var(--gold)' }} />
                    Criar Novo Conectado (com QR)
                </div>
                <button
                    onClick={() => {
                        setCreateModalOpen(true)
                        setCreateMessage(null)
                        setCreateQrCode(null)
                        setCreateFlowInstanceId(null)
                    }}
                    style={{ padding: '10px 14px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                    Criar Novo Conectado
                </button>
            </div>

            {createModalOpen && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '16px',
                }}>
                    <div style={{
                        width: '100%',
                        maxWidth: '560px',
                        borderRadius: '14px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        padding: '16px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Novo Conectado WhatsApp</div>
                            <button
                                onClick={() => setCreateModalOpen(false)}
                                style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}
                            >
                                Fechar
                            </button>
                        </div>

                        <div style={{ display: 'grid', gap: '8px' }}>
                            <input
                                value={createBrokerName}
                                onChange={(e) => setCreateBrokerName(e.target.value)}
                                placeholder="Nome do corretor"
                                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                            />
                            <input
                                value={createInstanceName}
                                onChange={(e) => setCreateInstanceName(e.target.value)}
                                placeholder="Nome da instância (opcional)"
                                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                            />
                            <button
                                onClick={createInstanceAndGetQr}
                                disabled={creatingInstance}
                                style={{ padding: '10px 14px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: creatingInstance ? 0.7 : 1 }}
                            >
                                {creatingInstance ? 'Gerando...' : 'Gerar QR Code'}
                            </button>
                        </div>

                        {!!createQrCode && (
                            <div style={{ marginTop: 12 }}>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                                    Escaneie o QR no WhatsApp. O status será atualizado automaticamente.
                                </div>
                                <div style={{ display: 'inline-block', background: '#fff', borderRadius: 8, padding: 8 }}>
                                    <img src={createQrCode} alt="QR code nova instância" style={{ width: 240, height: 240 }} />
                                </div>
                                <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {autoCheckingCreateStatus ? 'Verificando conexão...' : 'Aguardando conexão...'}
                                </div>
                            </div>
                        )}

                        {createMessage && (
                            <div style={{
                                marginTop: '10px', padding: '8px 10px', borderRadius: '8px', fontSize: '0.78rem',
                                background: createMessage.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                                color: createMessage.type === 'success' ? '#22c55e' : '#ef4444',
                                border: `1px solid ${createMessage.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                            }}>
                                {createMessage.text}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Global Instance Section */}
            {globalInstances.length > 0 && (
                <div style={{ marginBottom: '32px' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '12px',
                        marginBottom: '12px',
                    }}>
                        <div>
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: '#0284c7', margin: 0 }}>
                                <Globe size={20} /> WhatsApp Global ({globalInstances.length})
                            </h2>
                            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                Entrada oficial para leads, usuarios internos e comandos de roteamento.
                            </p>
                        </div>
                        <Link
                            href="/admin/pilger-ai/agentes?agent=whatsapp-global-agent&setor=Diretoria"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 12px',
                                borderRadius: '10px',
                                border: '1px solid rgba(14,165,233,0.24)',
                                background: 'rgba(14,165,233,0.08)',
                                color: '#0284c7',
                                fontSize: '0.78rem',
                                fontWeight: 800,
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            <Shield size={14} />
                            Configurar Global
                        </Link>
                    </div>
                    <div style={{ display: 'grid', gap: '12px' }}>
                        {globalInstances.map(inst => (
                            <InstanceCard key={inst.id} inst={inst} type="global"
                                expanded={expandedCard === inst.id}
                                onToggleExpand={() => setExpandedCard(expandedCard === inst.id ? null : inst.id)}
                                settingsExpanded={expandedSettings === inst.id}
                                onToggleSettings={() => setExpandedSettings(expandedSettings === inst.id ? null : inst.id)}
                                config={configs[inst.id] || DEFAULT_CONFIG}
                                onUpdateConfig={(key, val) => updateConfig(inst.id, key, val)}
                                onSaveSettings={() => saveSettings(inst.id)}
                                savingSettings={savingSettings === inst.id}
                                onRunAttendance={() => runAttendanceReport(inst.id)}
                                runningAttendance={runningAttendance === inst.id}
                                attendanceMessage={attendanceMessage[inst.id] || null}
                                onRefresh={() => loadInstances(true)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Agent Instances Section */}
            {agentInstances.length > 0 && (
                <div style={{ marginBottom: '32px' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: 'var(--gold)', marginBottom: '12px' }}>
                        <Bot size={20} /> Corretores IA ({agentInstances.length})
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
                                onRunAttendance={() => runAttendanceReport(inst.id)}
                                runningAttendance={runningAttendance === inst.id}
                                attendanceMessage={attendanceMessage[inst.id] || null}
                                onRefresh={() => loadInstances(true)}
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
                                onRunAttendance={() => runAttendanceReport(inst.id)}
                                runningAttendance={runningAttendance === inst.id}
                                attendanceMessage={attendanceMessage[inst.id] || null}
                                onRefresh={() => loadInstances(true)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {instances.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 24px', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border)' }}>
                    <Smartphone size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Nenhum conectado WhatsApp</p>
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

function InstanceCard({ inst, type, expanded, onToggleExpand, settingsExpanded, onToggleSettings, config, onUpdateConfig, onSaveSettings, savingSettings, onRunAttendance, runningAttendance, attendanceMessage, onRefresh }: {
    inst: Instance; type: 'agent' | 'user' | 'global'
    expanded: boolean; onToggleExpand: () => void
    settingsExpanded: boolean; onToggleSettings: () => void
    config: InstanceConfig
    onUpdateConfig: (key: string, value: any) => void
    onSaveSettings: () => void; savingSettings: boolean
    onRunAttendance: () => void; runningAttendance: boolean
    attendanceMessage: { type: 'success' | 'error'; text: string } | null
    onRefresh: () => Promise<void> | void
}) {
    const [webhookLoading, setWebhookLoading] = useState(false)
    const [webhookMessage, setWebhookMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [setupLoading, setSetupLoading] = useState(false)
    const [setupMessage, setSetupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [privacyLoading, setPrivacyLoading] = useState(false)
    const [privacyMessage, setPrivacyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [qrLoading, setQrLoading] = useState(false)
    const [checkingStatus, setCheckingStatus] = useState(false)
    const [autoCheckingConnection, setAutoCheckingConnection] = useState(false)
    const [deletingInstance, setDeletingInstance] = useState(false)
    const [clearingCache, setClearingCache] = useState(false)
    const [qrCode, setQrCode] = useState<string | null>(null)
    const [qrMessage, setQrMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const isConnected = inst.status === 'connected'
    const isGlobal = inst.instance_type === 'global' || type === 'global'
    const accentColor = isGlobal ? '#0284c7' : type === 'agent' ? 'var(--gold)' : '#6366f1'
    const name = isGlobal ? 'WhatsApp Global' : type === 'agent' ? inst.virtual_brokers?.name : inst.admin_users?.name
    const subtitle = isGlobal ? 'Porta central da empresa' : type === 'agent' ? `CRECI: ${inst.virtual_brokers?.creci || '—'}` : inst.admin_users?.email
    const photoUrl = type === 'agent'
        ? (inst.live_data?.profilePicUrl || inst.virtual_brokers?.photo_url)
        : inst.live_data?.profilePicUrl
    const prompt = type === 'agent' ? inst.virtual_brokers?.system_prompt : null
    const agentDisabled = !config.agent_enabled
    const onRefreshRef = useRef(onRefresh)

    useEffect(() => {
        onRefreshRef.current = onRefresh
    }, [onRefresh])

    useEffect(() => {
        if (!qrCode || isConnected) {
            setAutoCheckingConnection(false)
            return
        }

        let cancelled = false
        let inFlight = false
        let timeoutId: ReturnType<typeof setTimeout> | null = null

        const pollConnectionStatus = async () => {
            if (cancelled || inFlight) return

            inFlight = true
            setAutoCheckingConnection(true)

            try {
                const res = await fetch(`/api/admin/whatsapp/status?instanceId=${inst.id}`, { cache: 'no-store' })
                const data = await res.json().catch(() => null)

                if (!res.ok || !data?.success) return

                if (data.status === 'connected') {
                    cancelled = true
                    setQrCode(null)
                    setAutoCheckingConnection(false)
                    setQrMessage({ type: 'success', text: 'Instância conectada com sucesso. Atualizando o painel...' })
                    await onRefreshRef.current()
                    return
                }
            } catch {
                // polling silencioso: o botão manual continua disponível
            } finally {
                inFlight = false
                if (!cancelled) {
                    timeoutId = setTimeout(pollConnectionStatus, 3000)
                }
            }
        }

        pollConnectionStatus()

        return () => {
            cancelled = true
            if (timeoutId) clearTimeout(timeoutId)
        }
    }, [qrCode, isConnected, inst.id])

    const connectAndGetQr = async () => {
        setQrLoading(true)
        setQrMessage(null)
        try {
            const res = await fetch('/api/admin/whatsapp/qrcode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instanceId: inst.id,
                    ...(isGlobal ? { instance_type: 'global' } : {}),
                }),
            })
            const data = await res.json()
            if (!res.ok || !data?.success) {
                throw new Error(data?.message || 'Nao foi possivel gerar o QR code.')
            }
            if (data?.qrcode) {
                setQrCode(data.qrcode)
                setQrMessage({ type: 'success', text: 'QR code gerado. Escaneie no WhatsApp do celular. O painel vai atualizar automaticamente.' })
            } else {
                setQrMessage({ type: 'error', text: 'A API nao retornou QR code. Tente novamente em alguns segundos.' })
            }
            await onRefresh()
        } catch (err) {
            setQrMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao gerar QR code.' })
        } finally {
            setQrLoading(false)
        }
    }

    const checkConnectionStatus = async () => {
        setCheckingStatus(true)
        setQrMessage(null)
        try {
            const res = await fetch(`/api/admin/whatsapp/status?instanceId=${inst.id}`)
            const data = await res.json()
            if (!res.ok || !data?.success) {
                throw new Error(data?.message || 'Falha ao verificar status.')
            }
            if (data?.status === 'connected') {
                setQrCode(null)
                setQrMessage({ type: 'success', text: 'Instancia conectada com sucesso.' })
            } else {
                setQrMessage({ type: 'error', text: `Status atual: ${data?.status || 'desconhecido'}.` })
            }
            await onRefresh()
        } catch (err) {
            setQrMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao verificar status.' })
        } finally {
            setCheckingStatus(false)
        }
    }

    const disconnectInstance = async () => {
        setCheckingStatus(true)
        setQrMessage(null)
        try {
            const res = await fetch('/api/admin/whatsapp/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instanceId: inst.id }),
            })
            const data = await res.json()
            if (!res.ok || !data?.success) {
                throw new Error(data?.message || 'Falha ao desconectar instância.')
            }
            setQrCode(null)
            setQrMessage({ type: 'success', text: 'Instância desconectada com sucesso.' })
            await onRefresh()
        } catch (err) {
            setQrMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao desconectar instância.' })
        } finally {
            setCheckingStatus(false)
        }
    }

    const deleteInstance = async () => {
        const confirmed = window.confirm(`Tem certeza que deseja excluir a instância "${inst.instance_name}"?`)
        if (!confirmed) return

        setDeletingInstance(true)
        setQrMessage(null)
        try {
            let res = await fetch('/api/admin/whatsapp/instances', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instanceId: inst.id }),
            })
            let data = await res.json()

            if (!res.ok || !data?.success) {
                throw new Error(data?.message || 'Falha ao excluir a instância no servidor da UAZAPI.')
            }

            setQrMessage({ type: 'success', text: data?.message || 'Instância excluída com sucesso.' })
            await onRefresh()
        } catch (err) {
            setQrMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao excluir instância.' })
        } finally {
            setDeletingInstance(false)
        }
    }

    const clearConversationCache = async () => {
        const confirmed = window.confirm(
            `Limpar cache de conversas da instância "${inst.instance_name}"?\n\n` +
            'Isso apaga o histórico/contexto da IA usado nos testes.'
        )
        if (!confirmed) return

        setClearingCache(true)
        setQrMessage(null)
        try {
            const res = await fetch('/api/admin/whatsapp/ai-conversation', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instance_id: inst.id, hard_reset: true }),
            })
            const data = await res.json()
            if (!res.ok || !data?.success) {
                throw new Error(data?.message || 'Falha ao limpar cache das conversas.')
            }
            setQrMessage({ type: 'success', text: data?.message || 'Cache de conversas limpo com sucesso.' })
            await onRefresh()
        } catch (err) {
            setQrMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao limpar cache das conversas.' })
        } finally {
            setClearingCache(false)
        }
    }

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
                    ) : isGlobal ? (
                        <Globe size={22} style={{ color: accentColor }} />
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
                            background: isGlobal ? 'rgba(14,165,233,0.12)' : type === 'agent' ? 'rgba(201,169,110,0.15)' : 'rgba(99,102,241,0.15)',
                            color: accentColor, fontWeight: 700,
                        }}>
                            {isGlobal ? 'GLOBAL' : type === 'agent' ? 'AGENTE IA' : 'CORRETOR'}
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
                            {(inst.live_data?.phone || inst.phone_number || inst.virtual_brokers?.phone) && (
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    {formatBrPhone(inst.live_data?.phone || inst.phone_number || inst.virtual_brokers?.phone)}
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
                        <DetailItem icon={<Globe size={13} />} label="Conectados" value={inst.instance_name} />
                        {inst.live_data?.platform && <DetailItem icon={<Monitor size={13} />} label="Plataforma" value={inst.live_data.platform} />}
                        {inst.live_data?.battery != null && (
                            <DetailItem icon={inst.live_data.plugged ? <BatteryCharging size={13} /> : <Battery size={13} />}
                                label="Bateria" value={`${inst.live_data.battery}%${inst.live_data.plugged ? ' ⚡' : ''}`} />
                        )}
                        {inst.live_data?.webhookUrl && <DetailItem icon={<Link2 size={13} />} label="Webhook" value="Configurado" valueColor="#22c55e" />}
                        {prompt && <DetailItem icon={<MessageSquare size={13} />} label="Prompt" value={`${prompt.length} caracteres`} />}
                        {isGlobal && <DetailItem icon={<Shield size={13} />} label="Papel" value="Entrada global oficial" valueColor={accentColor} />}
                        <DetailItem icon={<Clock size={13} />} label="Criada" value={new Date(inst.created_at).toLocaleDateString('pt-BR')} />
                    </div>

                    {!isConnected && (
                        <div style={{ padding: '0 20px 12px' }}>
                            <div style={{
                                padding: '12px 16px',
                                borderRadius: '10px',
                                background: 'rgba(245,158,11,0.06)',
                                border: '1px solid rgba(245,158,11,0.2)'
                            }}>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button
                                        onClick={connectAndGetQr}
                                        disabled={qrLoading}
                                        style={{
                                            padding: '8px 14px',
                                            borderRadius: '8px',
                                            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                                            color: '#fff',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            fontSize: '0.82rem',
                                            opacity: qrLoading ? 0.7 : 1
                                        }}
                                    >
                                        {qrLoading ? 'Gerando QR...' : 'Conectar / Gerar QR'}
                                    </button>
                                    <button
                                        onClick={checkConnectionStatus}
                                        disabled={checkingStatus}
                                        style={{
                                            padding: '8px 14px',
                                            borderRadius: '8px',
                                            background: 'var(--bg-secondary)',
                                            color: 'var(--text-primary)',
                                            border: '1px solid var(--border)',
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            fontSize: '0.82rem',
                                            opacity: checkingStatus ? 0.7 : 1
                                        }}
                                    >
                                        {checkingStatus ? 'Verificando...' : 'Verificar Status'}
                                    </button>
                                </div>

                                {!!qrCode && (
                                    <div style={{ marginTop: 12 }}>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                                            Escaneie este QR no WhatsApp do celular.
                                        </div>
                                        <div style={{ background: '#fff', borderRadius: 8, display: 'inline-block', padding: 8 }}>
                                            <img src={qrCode} alt="QR Code WhatsApp" style={{ width: 220, height: 220 }} />
                                        </div>
                                        {autoCheckingConnection && (
                                            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                                <Loader2 size={13} className="animate-spin" />
                                                Aguardando confirmação da conexão...
                                            </div>
                                        )}
                                    </div>
                                )}

                                {qrMessage && (
                                    <div style={{
                                        marginTop: '10px',
                                        padding: '8px 10px',
                                        borderRadius: '8px',
                                        fontSize: '0.78rem',
                                        background: qrMessage.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                                        color: qrMessage.type === 'success' ? '#22c55e' : '#ef4444',
                                        border: `1px solid ${qrMessage.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                                    }}>
                                        {qrMessage.text}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Webhook Auto-Setup */}
                    {isConnected && (
                        <div style={{ padding: '0 20px 12px' }}>
                            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'flex-end' }}>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={clearConversationCache}
                                        disabled={clearingCache}
                                        style={{
                                            padding: '8px 14px',
                                            borderRadius: '8px',
                                            border: '1px solid rgba(245,158,11,0.3)',
                                            background: 'rgba(245,158,11,0.1)',
                                            color: '#f59e0b',
                                            fontWeight: 700,
                                            fontSize: '0.8rem',
                                            cursor: 'pointer',
                                            opacity: clearingCache ? 0.7 : 1,
                                        }}
                                    >
                                        {clearingCache ? 'Limpando cache...' : 'Limpar Cache de Conversas'}
                                    </button>
                                    <button
                                        onClick={disconnectInstance}
                                        disabled={checkingStatus}
                                        style={{
                                            padding: '8px 14px',
                                            borderRadius: '8px',
                                            border: '1px solid rgba(239,68,68,0.3)',
                                            background: 'rgba(239,68,68,0.1)',
                                            color: '#ef4444',
                                            fontWeight: 700,
                                            fontSize: '0.8rem',
                                            cursor: 'pointer',
                                            opacity: checkingStatus ? 0.7 : 1,
                                        }}
                                    >
                                        {checkingStatus ? 'Desconectando...' : 'Desconectar Instância'}
                                    </button>
                                </div>
                            </div>
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

                    {isGlobal ? (
                        <div style={{ padding: '0 20px 16px' }}>
                            <div style={{
                                padding: '10px 12px',
                                borderRadius: '10px',
                                border: '1px solid rgba(14,165,233,0.2)',
                                background: 'rgba(14,165,233,0.07)',
                                color: 'var(--text-secondary)',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                lineHeight: 1.35,
                            }}>
                                Instância protegida: o WhatsApp Global não é removido junto dos corretores IA. Para substituir o número, conecte outra instância como Global.
                            </div>
                        </div>
                    ) : (
                        <div style={{ padding: '0 20px 16px' }}>
                            <button
                                onClick={(e) => { e.stopPropagation(); deleteInstance() }}
                                disabled={deletingInstance}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(239,68,68,0.3)',
                                    background: 'rgba(239,68,68,0.1)',
                                    color: '#ef4444',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    opacity: deletingInstance ? 0.7 : 1,
                                }}
                            >
                                {deletingInstance ? 'Excluindo instância...' : 'Excluir Instância'}
                            </button>
                        </div>
                    )}

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
                                    Agente de resposta desativado: o WhatsApp não responde sozinho, mas o Monitor de atendimento pode continuar ativo.
                                </div>
                            )}
                            <div style={{ display: 'grid', gap: '12px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '12px' }}>
                                    <SettingsSection title="Base do agente" description="Controles essenciais que determinam se a instância responde e como se comporta no WhatsApp.">
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: '8px' }}>
                                            <ToggleSwitch label="Agente Ativado" icon={<Power size={15} />}
                                                checked={config.agent_enabled} onChange={() => onUpdateConfig('agent_enabled', !config.agent_enabled)} />
                                            <ToggleSwitch label="Sempre Online" icon={<Wifi size={15} />}
                                                checked={config.always_online} onChange={() => onUpdateConfig('always_online', !config.always_online)} disabled={agentDisabled} />
                                            <ToggleSwitch label="Marcar como Lido (✓✓)" icon={<Eye size={15} />}
                                                checked={config.mark_as_read} onChange={() => onUpdateConfig('mark_as_read', !config.mark_as_read)} disabled={agentDisabled} />
                                            <ToggleSwitch label="Dividir Respostas" icon={<SplitSquareVertical size={15} />}
                                                checked={config.split_messages} onChange={() => onUpdateConfig('split_messages', !config.split_messages)} disabled={agentDisabled} />
                                        </div>
                                    </SettingsSection>

                                    <SettingsSection title="Segurança e testes" description="Intervenção humana, proteção contra loops e permissões especiais para ambiente de teste.">
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: '8px' }}>
                                            <ToggleSwitch label="Intervenção Humana" icon={<Shield size={15} />}
                                                checked={config.human_intervention} onChange={() => onUpdateConfig('human_intervention', !config.human_intervention)} disabled={agentDisabled} />
                                            <ToggleSwitch label="Proteção bots/loops" icon={<Bot size={15} />}
                                                checked={config.bot_loop_protection_enabled} onChange={() => onUpdateConfig('bot_loop_protection_enabled', !config.bot_loop_protection_enabled)} disabled={agentDisabled} />
                                            <ToggleSwitch label="Teste entre instâncias" icon={<Users size={15} />}
                                                checked={config.allow_internal_instance_messages} onChange={() => onUpdateConfig('allow_internal_instance_messages', !config.allow_internal_instance_messages)} disabled={agentDisabled} />
                                            <ToggleSwitch label="Janela da IA ativa" icon={<Clock size={15} />}
                                                checked={config.ai_schedule_enabled} onChange={() => onUpdateConfig('ai_schedule_enabled', !config.ai_schedule_enabled)} disabled={agentDisabled} />
                                        </div>
                                    </SettingsSection>

                                    <SettingsSection title="Monitor de atendimento" description="Importa contatos, chats e mensagens para gerar relatório diário do corretor.">
                                        <div style={{ display: 'grid', gap: '10px' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: '8px' }}>
                                                <ToggleSwitch label="Monitorar atendimentos" icon={<BarChart3 size={15} />}
                                                    checked={config.attendance_monitor_enabled} onChange={() => onUpdateConfig('attendance_monitor_enabled', !config.attendance_monitor_enabled)} />
                                                <ToggleSwitch label="Importar histórico" icon={<Database size={15} />}
                                                    checked={config.attendance_history_import_enabled} onChange={() => onUpdateConfig('attendance_history_import_enabled', !config.attendance_history_import_enabled)} />
                                                <ToggleSwitch label="Relatório diário" icon={<Clock size={15} />}
                                                    checked={config.attendance_daily_report_enabled} onChange={() => onUpdateConfig('attendance_daily_report_enabled', !config.attendance_daily_report_enabled)} />
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 160px) minmax(0, 1fr)', gap: '8px', alignItems: 'end' }}>
                                                <NumericInput label="Hora relatório" value={String(config.attendance_report_hour)}
                                                    onChange={(v) => {
                                                        const hour = parseInt(v)
                                                        onUpdateConfig('attendance_report_hour', Number.isFinite(hour) ? hour : 8)
                                                    }} min={0} max={23} />
                                                <button
                                                    type="button"
                                                    onClick={onRunAttendance}
                                                    disabled={runningAttendance || inst.status !== 'connected'}
                                                    style={{
                                                        minHeight: '40px',
                                                        borderRadius: '10px',
                                                        border: '1px solid rgba(21,128,61,0.35)',
                                                        background: runningAttendance || inst.status !== 'connected'
                                                            ? 'rgba(148,163,184,0.18)'
                                                            : 'linear-gradient(135deg, #16a34a, #0ea5e9)',
                                                        color: '#ffffff',
                                                        fontSize: '0.82rem',
                                                        fontWeight: 800,
                                                        cursor: runningAttendance || inst.status !== 'connected' ? 'not-allowed' : 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '8px',
                                                        opacity: runningAttendance || inst.status !== 'connected' ? 0.62 : 1,
                                                    }}
                                                >
                                                    {runningAttendance ? <Loader2 size={15} className="spin" /> : <PlayCircle size={15} />}
                                                    {runningAttendance ? 'Gerando...' : 'Sincronizar e gerar agora'}
                                                </button>
                                            </div>
                                            {attendanceMessage && (
                                                <div style={{
                                                    padding: '8px 10px',
                                                    borderRadius: '9px',
                                                    fontSize: '0.76rem',
                                                    border: `1px solid ${attendanceMessage.type === 'success' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                                                    background: attendanceMessage.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                                                    color: attendanceMessage.type === 'success' ? '#86efac' : '#fca5a5',
                                                }}>
                                                    {attendanceMessage.text}
                                                </div>
                                            )}
                                        </div>
                                    </SettingsSection>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '12px' }}>
                                    <SettingsSection title="Modo de conversa" description="Define se o agente responde por texto, áudio ou espelha o formato recebido.">
                                        <ResponseModeSelector
                                            value={config.response_mode}
                                            onChange={(mode) => onUpdateConfig('response_mode', mode)}
                                            disabled={agentDisabled}
                                        />
                                    </SettingsSection>

                                    <SettingsSection title="Rapport adaptativo" description="Ajusta linguagem, formalidade e sinais regionais conforme o lead.">
                                        <RapportModeSelector
                                            value={config.adaptive_rapport_mode || (config.adaptive_rapport_enabled ? 'soft' : 'off')}
                                            onChange={(mode) => {
                                                onUpdateConfig('adaptive_rapport_mode', mode)
                                                onUpdateConfig('adaptive_rapport_enabled', mode !== 'off')
                                            }}
                                            disabled={agentDisabled}
                                        />
                                    </SettingsSection>
                                </div>

                                <SettingsSection title="Cenários especiais do lead" description="Situações em que um humano normalmente ajustaria a conversa: pedido de atendente, remarcação, captação, localização e opt-out." tone="info">
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: '8px', opacity: agentDisabled ? 0.55 : 1 }}>
                                        <ToggleSwitch label="Pedido de humano" icon={<User size={15} />}
                                            checked={config.detect_human_request_enabled} onChange={() => onUpdateConfig('detect_human_request_enabled', !config.detect_human_request_enabled)} disabled={agentDisabled} />
                                        <ToggleSwitch label="Cancelar/remarcar" icon={<Clock size={15} />}
                                            checked={config.detect_reschedule_cancel_enabled} onChange={() => onUpdateConfig('detect_reschedule_cancel_enabled', !config.detect_reschedule_cancel_enabled)} disabled={agentDisabled} />
                                        <ToggleSwitch label="Captação de imóvel" icon={<MessageSquare size={15} />}
                                            checked={config.detect_property_capture_enabled} onChange={() => onUpdateConfig('detect_property_capture_enabled', !config.detect_property_capture_enabled)} disabled={agentDisabled} />
                                        <ToggleSwitch label="Localização enviada" icon={<Globe size={15} />}
                                            checked={config.detect_location_enabled} onChange={() => onUpdateConfig('detect_location_enabled', !config.detect_location_enabled)} disabled={agentDisabled} />
                                        <ToggleSwitch label="Opt-out do lead" icon={<Shield size={15} />}
                                            checked={config.detect_opt_out_enabled} onChange={() => onUpdateConfig('detect_opt_out_enabled', !config.detect_opt_out_enabled)} disabled={agentDisabled} />
                                        <ToggleSwitch label="Links do lead" icon={<Link2 size={15} />}
                                            checked={config.analyze_links_enabled} onChange={() => onUpdateConfig('analyze_links_enabled', !config.analyze_links_enabled)} disabled={agentDisabled} />
                                        <ToggleSwitch label="Resposta citada" icon={<MessageSquare size={15} />}
                                            checked={config.quoted_reply_context_enabled} onChange={() => onUpdateConfig('quoted_reply_context_enabled', !config.quoted_reply_context_enabled)} disabled={agentDisabled} />
                                        <ToggleSwitch label="Salvar mídia no lead" icon={<Eye size={15} />}
                                            checked={config.lead_file_storage_enabled} onChange={() => onUpdateConfig('lead_file_storage_enabled', !config.lead_file_storage_enabled)} disabled={agentDisabled} />
                                    </div>
                                </SettingsSection>

                                <SettingsSection title="Áudio e mídia com IA" description="O que o agente consegue transcrever, analisar e guardar quando recebe mídia." tone="success">
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '12px' }}>
                                        <div style={{ display: 'grid', gap: '8px' }}>
                                            <ToggleSwitch label="Transcrever áudio" icon={<Mic size={15} />}
                                                checked={config.audio_transcription} onChange={() => onUpdateConfig('audio_transcription', !config.audio_transcription)} disabled={agentDisabled} />
                                            <ToggleSwitch label="Analisar imagens" icon={<Eye size={15} />}
                                                checked={config.media_image_enabled} onChange={() => onUpdateConfig('media_image_enabled', !config.media_image_enabled)} disabled={agentDisabled} />
                                            <ToggleSwitch label="Analisar documentos" icon={<Eye size={15} />}
                                                checked={config.media_document_enabled} onChange={() => onUpdateConfig('media_document_enabled', !config.media_document_enabled)} disabled={agentDisabled} />
                                            <ToggleSwitch label="Analisar vídeos" icon={<Eye size={15} />}
                                                checked={config.media_video_enabled} onChange={() => onUpdateConfig('media_video_enabled', !config.media_video_enabled)} disabled={agentDisabled} />
                                        </div>
                                        <div style={{ display: 'grid', gap: '8px', opacity: agentDisabled ? 0.55 : 1 }}>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>Lote de mídias</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: '8px' }}>
                                                <NumericInput label="Imagens" value={String(config.media_batch_image_limit)}
                                                    onChange={(v) => onUpdateConfig('media_batch_image_limit', parseInt(v) || 8)} min={1} max={20} disabled={agentDisabled} />
                                                <NumericInput label="Vídeos" value={String(config.media_batch_video_limit)}
                                                    onChange={(v) => onUpdateConfig('media_batch_video_limit', parseInt(v) || 2)} min={1} max={5} disabled={agentDisabled} />
                                                <NumericInput label="Documentos" value={String(config.media_batch_document_limit)}
                                                    onChange={(v) => onUpdateConfig('media_batch_document_limit', parseInt(v) || 3)} min={1} max={8} disabled={agentDisabled} />
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                O agente analisa somente o limite configurado quando o lead envia várias mídias juntas; o restante fica no histórico do lead.
                                            </div>
                                        </div>
                                    </div>
                                </SettingsSection>

                                <SettingsSection title="Temporizadores" description="Controla o tempo de espera por tipo de interação antes de responder o lead." tone="gold">
                                    <div style={{ display: 'grid', gap: '8px' }}>
                                        <ToggleSwitch label="Temporização inteligente por cenário" icon={<Timer size={15} />}
                                            checked={config.smart_timing_enabled} onChange={() => onUpdateConfig('smart_timing_enabled', !config.smart_timing_enabled)} disabled={agentDisabled} />
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: '8px', opacity: agentDisabled || !config.smart_timing_enabled ? 0.55 : 1 }}>
                                            <NumericInput label="Só texto" value={String(config.timing_text_seconds)}
                                                onChange={(v) => onUpdateConfig('timing_text_seconds', parseInt(v) || 6)} min={2} max={60} disabled={agentDisabled || !config.smart_timing_enabled} />
                                            <NumericInput label="Textos seguidos" value={String(config.timing_text_burst_seconds)}
                                                onChange={(v) => onUpdateConfig('timing_text_burst_seconds', parseInt(v) || 9)} min={3} max={90} disabled={agentDisabled || !config.smart_timing_enabled} />
                                            <NumericInput label="Foto legenda" value={String(config.timing_media_caption_seconds)}
                                                onChange={(v) => onUpdateConfig('timing_media_caption_seconds', parseInt(v) || 10)} min={5} max={120} disabled={agentDisabled || !config.smart_timing_enabled} />
                                            <NumericInput label="Foto + texto" value={String(config.timing_media_then_text_seconds)}
                                                onChange={(v) => onUpdateConfig('timing_media_then_text_seconds', parseInt(v) || 14)} min={5} max={120} disabled={agentDisabled || !config.smart_timing_enabled} />
                                            <NumericInput label="Foto só" value={String(config.timing_media_only_seconds)}
                                                onChange={(v) => onUpdateConfig('timing_media_only_seconds', parseInt(v) || 16)} min={5} max={120} disabled={agentDisabled || !config.smart_timing_enabled} />
                                            <NumericInput label="Áudio" value={String(config.timing_audio_seconds)}
                                                onChange={(v) => onUpdateConfig('timing_audio_seconds', parseInt(v) || 10)} min={5} max={120} disabled={agentDisabled || !config.smart_timing_enabled} />
                                            <NumericInput label="Áudio + texto" value={String(config.timing_audio_then_text_seconds)}
                                                onChange={(v) => onUpdateConfig('timing_audio_then_text_seconds', parseInt(v) || 14)} min={5} max={120} disabled={agentDisabled || !config.smart_timing_enabled} />
                                            <NumericInput label="Vídeo legenda" value={String(config.timing_video_caption_seconds)}
                                                onChange={(v) => onUpdateConfig('timing_video_caption_seconds', parseInt(v) || 14)} min={8} max={180} disabled={agentDisabled || !config.smart_timing_enabled} />
                                            <NumericInput label="Só vídeo" value={String(config.timing_video_only_seconds)}
                                                onChange={(v) => onUpdateConfig('timing_video_only_seconds', parseInt(v) || 18)} min={8} max={180} disabled={agentDisabled || !config.smart_timing_enabled} />
                                            <NumericInput label="Doc. + texto" value={String(config.timing_document_caption_seconds)}
                                                onChange={(v) => onUpdateConfig('timing_document_caption_seconds', parseInt(v) || 14)} min={8} max={180} disabled={agentDisabled || !config.smart_timing_enabled} />
                                            <NumericInput label="Só documento" value={String(config.timing_document_only_seconds)}
                                                onChange={(v) => onUpdateConfig('timing_document_only_seconds', parseInt(v) || 18)} min={8} max={180} disabled={agentDisabled || !config.smart_timing_enabled} />
                                            <NumericInput label="Antes botão" value={String(config.timing_button_delay_seconds)}
                                                onChange={(v) => onUpdateConfig('timing_button_delay_seconds', parseInt(v) || 2)} min={0} max={20} disabled={agentDisabled || !config.smart_timing_enabled} />
                                            <NumericInput label="Fallback" value={String(config.debounce_seconds)}
                                                onChange={(v) => onUpdateConfig('debounce_seconds', parseInt(v) || 15)} min={5} max={120} disabled={agentDisabled || config.smart_timing_enabled} />
                                            <NumericInput label="Reativar agente" value={String(config.human_intervention_minutes)}
                                                onChange={(v) => onUpdateConfig('human_intervention_minutes', parseInt(v) || 60)} min={5} max={1440} disabled={agentDisabled} />
                                        </div>
                                    </div>
                                </SettingsSection>

                                <SettingsSection title="Janela da IA" description="Use quando quiser que o agente responda somente dentro de uma faixa de horário configurada.">
                                    <TimeRangeInput
                                        start={config.ai_schedule_start}
                                        end={config.ai_schedule_end}
                                        timezone={config.ai_schedule_timezone}
                                        onChangeStart={(v) => onUpdateConfig('ai_schedule_start', v)}
                                        onChangeEnd={(v) => onUpdateConfig('ai_schedule_end', v)}
                                        onChangeTimezone={(v) => onUpdateConfig('ai_schedule_timezone', v)}
                                        disabled={agentDisabled || !config.ai_schedule_enabled}
                                    />
                                </SettingsSection>

                                <button onClick={onSaveSettings} disabled={savingSettings}
                                    style={{
                                        padding: '12px 20px', borderRadius: '10px',
                                        background: 'linear-gradient(135deg, var(--gold), #b8860b)',
                                        border: 'none', color: '#000', fontWeight: 800, fontSize: '0.9rem',
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

function SettingsSection({
    title,
    description,
    children,
    tone = 'neutral',
}: {
    title: string
    description?: string
    children: React.ReactNode
    tone?: 'neutral' | 'info' | 'success' | 'gold'
}) {
    const toneStyles = {
        neutral: { background: 'rgba(255,255,255,0.025)', border: 'var(--border)' },
        info: { background: 'rgba(14,165,233,0.045)', border: 'rgba(14,165,233,0.16)' },
        success: { background: 'rgba(34,197,94,0.045)', border: 'rgba(34,197,94,0.16)' },
        gold: { background: 'rgba(201,169,110,0.06)', border: 'rgba(201,169,110,0.18)' },
    }[tone]

    return (
        <section style={{
            display: 'grid',
            gap: '10px',
            padding: '12px',
            borderRadius: '12px',
            border: `1px solid ${toneStyles.border}`,
            background: toneStyles.background,
        }}>
            <div style={{ display: 'grid', gap: '2px' }}>
                <div style={{
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                }}>
                    {title}
                </div>
                {description && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                        {description}
                    </div>
                )}
            </div>
            {children}
        </section>
    )
}

function ToggleSwitch({ label, icon, checked, onChange, disabled = false }: { label: string; icon: React.ReactNode; checked: boolean; onChange: () => void; disabled?: boolean }) {
    return (
        <div onClick={() => !disabled && onChange()} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            minHeight: '42px',
            padding: '8px 10px', borderRadius: '9px', cursor: disabled ? 'not-allowed' : 'pointer',
            background: disabled ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)', transition: 'all 0.2s', opacity: disabled ? 0.55 : 1,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                <span style={{ color: checked ? 'var(--gold)' : 'var(--text-muted)' }}>{icon}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.2 }}>{label}</span>
            </div>
            <div style={{
                width: '36px', height: '20px', borderRadius: '10px',
                background: checked ? '#22c55e' : 'rgba(255,255,255,0.12)',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}>
                <div style={{
                    width: '14px', height: '14px', borderRadius: '50%', background: 'white',
                    position: 'absolute', top: '3px', left: checked ? '19px' : '3px',
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: '8px' }}>
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
                            minHeight: '64px',
                            padding: '9px 10px',
                            borderRadius: '9px',
                            border: `1px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
                            background: active ? 'rgba(201,169,110,0.12)' : 'rgba(255,255,255,0.03)',
                            color: 'var(--text-primary)',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            opacity: disabled ? 0.55 : 1,
                        }}
                    >
                        <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>{opt.label}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.25, marginTop: '2px' }}>{opt.desc}</div>
                    </button>
                )
            })}
        </div>
    )
}

function RapportModeSelector({ value, onChange, disabled = false }: { value: 'off' | 'soft' | 'strong'; onChange: (v: 'off' | 'soft' | 'strong') => void; disabled?: boolean }) {
    const options: Array<{ value: 'off' | 'soft' | 'strong'; label: string; desc: string }> = [
        { value: 'off', label: 'Desligado', desc: 'Mantém o tom definido no prompt do agente.' },
        { value: 'soft', label: 'Suave', desc: 'Espelha idioma, formalidade e expressões leves do lead.' },
        { value: 'strong', label: 'Forte', desc: 'Usa sinais regionais com mais presença quando combinar com o lead.' },
    ]

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: '8px' }}>
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
                            minHeight: '64px',
                            padding: '9px 10px',
                            borderRadius: '9px',
                            border: `1px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
                            background: active ? 'rgba(201,169,110,0.12)' : 'rgba(255,255,255,0.03)',
                            color: 'var(--text-primary)',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            opacity: disabled ? 0.55 : 1,
                        }}
                    >
                        <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>{opt.label}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.25, marginTop: '2px' }}>{opt.desc}</div>
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
            minHeight: '42px',
            padding: '8px 10px', borderRadius: '9px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', opacity: disabled ? 0.55 : 1,
        }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.2 }}>{label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                <button onClick={() => !disabled && onChange(String(Math.max(min || 0, parseInt(value) - 1)))} disabled={disabled}
                    style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    −
                </button>
                <input type="number" value={value} onChange={e => onChange(e.target.value)} min={min} max={max} disabled={disabled}
                    style={{ width: '44px', textAlign: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 5px', color: 'var(--gold)', fontSize: '0.84rem', fontWeight: 700, outline: 'none' }}
                />
                <button onClick={() => !disabled && onChange(String(Math.min(max || 9999, parseInt(value) + 1)))} disabled={disabled}
                    style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    +
                </button>
            </div>


        </div>
    )
}

function TimeRangeInput({
    start,
    end,
    timezone,
    onChangeStart,
    onChangeEnd,
    onChangeTimezone,
    disabled = false,
}: {
    start: string
    end: string
    timezone: string
    onChangeStart: (v: string) => void
    onChangeEnd: (v: string) => void
    onChangeTimezone: (v: string) => void
    disabled?: boolean
}) {
    return (
        <div style={{
            display: 'grid',
            gap: '10px',
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            opacity: disabled ? 0.55 : 1,
        }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label style={{ display: 'grid', gap: '4px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Início</span>
                    <input
                        type="time"
                        value={start || '18:00'}
                        disabled={disabled}
                        onChange={(e) => onChangeStart(e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)' }}
                    />
                </label>
                <label style={{ display: 'grid', gap: '4px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fim</span>
                    <input
                        type="time"
                        value={end || '08:00'}
                        disabled={disabled}
                        onChange={(e) => onChangeEnd(e.target.value)}
                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)' }}
                    />
                </label>
            </div>
            <label style={{ display: 'grid', gap: '4px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fuso horário</span>
                <select
                    value={timezone || 'America/Sao_Paulo'}
                    disabled={disabled}
                    onChange={(e) => onChangeTimezone(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)' }}
                >
                    <option value="America/Sao_Paulo">America/Sao_Paulo (Brasil)</option>
                    <option value="UTC">UTC</option>
                </select>
            </label>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Exemplo: 18:00 → 08:00 faz a IA atender durante a noite e madrugada.
            </div>
        </div>
    )
}




