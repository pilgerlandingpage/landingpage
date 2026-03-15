'use client'

import { useState, useEffect } from 'react'
import {
    Smartphone,
    RefreshCw,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Wifi,
    WifiOff,
    Phone,
    User,
    Clock,
    Globe,
    Battery,
    BatteryCharging,
    Bot,
    Shield,
    Link2,
    Monitor,
    MessageSquare,
    Mic
} from 'lucide-react'

interface LiveData {
    phone?: string
    pushName?: string
    platform?: string
    battery?: number
    plugged?: boolean
    isOnline?: boolean
    profilePicUrl?: string
    webhookUrl?: string
}

interface BrokerData {
    id: string
    name: string
    creci: string
    photo_url: string
    is_active: boolean
    system_prompt?: string
    voice_id?: string
}

interface AdminUserData {
    id: string
    name: string
    email: string
}

interface Instance {
    id: string
    admin_user_id: string
    broker_id?: string
    instance_name: string
    instance_token?: string
    phone_number: string | null
    status: 'disconnected' | 'connecting' | 'connected'
    connected_at: string | null
    created_at: string
    virtual_brokers?: BrokerData
    admin_users?: AdminUserData
    live_data?: LiveData | null
}

export default function WhatsAppInstancesPage() {
    const [instances, setInstances] = useState<Instance[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [refreshing, setRefreshing] = useState(false)

    useEffect(() => {
        loadInstances()
    }, [])

    const loadInstances = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/admin/whatsapp/instances')
            if (!res.ok) throw new Error('Falha ao carregar instâncias')
            const data = await res.json()
            if (!data.success) throw new Error(data.message)
            setInstances(data.instances || [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro desconhecido')
        } finally {
            setLoading(false)
        }
    }

    const refreshAll = async () => {
        setRefreshing(true)
        await loadInstances()
        setRefreshing(false)
    }

    const connectedCount = instances.filter(i => i.status === 'connected').length
    const disconnectedCount = instances.filter(i => i.status !== 'connected').length

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'connected':
                return {
                    color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)',
                    border: 'rgba(34, 197, 94, 0.3)',
                    Icon: CheckCircle2, text: 'Conectado'
                }
            case 'connecting':
                return {
                    color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)',
                    border: 'rgba(245, 158, 11, 0.3)',
                    Icon: RefreshCw, text: 'Aguardando QR'
                }
            default:
                return {
                    color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)',
                    border: 'rgba(239, 68, 68, 0.3)',
                    Icon: WifiOff, text: 'Desconectado'
                }
        }
    }

    const formatPhone = (phone: string) => {
        const clean = phone.replace(/\D/g, '')
        if (clean.length === 13 && clean.startsWith('55')) {
            return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`
        }
        if (clean.length === 12 && clean.startsWith('55')) {
            return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`
        }
        return phone
    }

    return (
        <div>
            {/* Header */}
            <div className="admin-header" style={{ marginBottom: '32px' }}>
                <div className="flex justify-between items-center w-full">
                    <div>
                        <h1 className="flex items-center gap-3">
                            <Smartphone className="text-gold" size={28} />
                            WhatsApps Conectados
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                            Monitore todas as instâncias WhatsApp conectadas aos Corretores IA e Usuários.
                        </p>
                    </div>
                    <button
                        onClick={refreshAll}
                        className="btn btn-primary"
                        disabled={refreshing}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
                    >
                        <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                        Atualizar Status
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div className="chart-card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--gold)' }}>{instances.length}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>Total de Instâncias</div>
                </div>
                <div className="chart-card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#22c55e' }}>{connectedCount}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <Wifi size={14} /> Conectados
                    </div>
                </div>
                <div className="chart-card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ef4444' }}>{disconnectedCount}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <WifiOff size={14} /> Desconectados
                    </div>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="chart-card" style={{
                    marginBottom: '24px', padding: '16px 20px',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    display: 'flex', alignItems: 'center', gap: '12px'
                }}>
                    <AlertCircle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
                    <span style={{ color: '#ef4444', fontSize: '0.9rem' }}>{error}</span>
                </div>
            )}

            {/* Info Banner */}
            <div className="chart-card" style={{
                marginBottom: '24px', padding: '16px 20px',
                background: 'rgba(99, 102, 241, 0.06)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                display: 'flex', alignItems: 'flex-start', gap: '12px'
            }}>
                <Smartphone size={18} style={{ color: '#6366f1', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Painel de Monitoramento</strong> —
                    As instâncias WhatsApp são gerenciadas diretamente na tela de cada <strong>Corretor IA</strong> ou na tela de <strong>Gestão de Usuários</strong>.
                    Aqui você pode monitorar o status de todas as conexões ativas.
                </div>
            </div>

            {/* Instances Grid */}
            {loading ? (
                <div className="chart-card" style={{ textAlign: 'center', padding: '80px 0' }}>
                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto', color: 'var(--gold)' }} />
                    <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Carregando instâncias e perfis...</p>
                </div>
            ) : instances.length === 0 ? (
                <div className="chart-card" style={{ textAlign: 'center', padding: '80px 0' }}>
                    <Smartphone size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Nenhuma instância WhatsApp encontrada</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '8px' }}>
                        Conecte um WhatsApp pelo menu <strong>Corretores IA</strong> para começar.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '20px' }}>
                    {instances.map(inst => {
                        const badge = getStatusBadge(inst.status)
                        const broker = inst.virtual_brokers
                        const adminUser = inst.admin_users
                        const live = inst.live_data
                        const displayPhone = live?.phone || inst.phone_number
                        const displayName = live?.pushName || broker?.name || adminUser?.name || inst.instance_name
                        const profilePic = live?.profilePicUrl || broker?.photo_url || null
                        const hasWebhook = !!live?.webhookUrl
                        const agentType = broker ? 'Corretor IA' : adminUser ? 'Agente Sombra' : 'Instância'

                        return (
                            <div key={inst.id} className="chart-card" style={{
                                padding: '0',
                                overflow: 'hidden',
                                borderLeft: `4px solid ${badge.color}`,
                                transition: 'all 0.2s',
                            }}>
                                {/* Top Section: Profile + Status */}
                                <div style={{
                                    padding: '20px 24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '16px',
                                    background: inst.status === 'connected' ? 'rgba(34, 197, 94, 0.03)' : 'transparent'
                                }}>
                                    {/* Profile Photo */}
                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                        <div style={{
                                            width: '64px', height: '64px', borderRadius: '50%',
                                            background: profilePic ? 'transparent' : 'linear-gradient(135deg, var(--gold), #b8860b)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            overflow: 'hidden',
                                            border: `3px solid ${badge.color}`,
                                            boxShadow: `0 0 0 3px ${badge.bg}`,
                                        }}>
                                            {profilePic ? (
                                                <img
                                                    src={profilePic}
                                                    alt={displayName}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                        (e.target as HTMLImageElement).parentElement!.innerHTML = `<span style="color:white;font-size:1.4rem;font-weight:700">${displayName.charAt(0).toUpperCase()}</span>`
                                                    }}
                                                />
                                            ) : (
                                                <span style={{ color: 'white', fontSize: '1.4rem', fontWeight: 700 }}>
                                                    {displayName.charAt(0).toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        {/* Online indicator */}
                                        {inst.status === 'connected' && (
                                            <div style={{
                                                position: 'absolute', bottom: '2px', right: '2px',
                                                width: '14px', height: '14px', borderRadius: '50%',
                                                background: live?.isOnline ? '#22c55e' : '#94a3b8',
                                                border: '2px solid var(--bg-primary)',
                                            }} title={live?.isOnline ? 'Online' : 'Offline'} />
                                        )}
                                    </div>

                                    {/* Name & Type */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                {displayName}
                                            </span>
                                            <div style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                padding: '2px 10px', borderRadius: '12px',
                                                background: badge.bg, border: `1px solid ${badge.border}`,
                                                fontSize: '0.7rem', fontWeight: 600, color: badge.color,
                                            }}>
                                                <badge.Icon size={10} />
                                                {badge.text}
                                            </div>
                                        </div>

                                        {/* Agent Type */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                            {broker ? (
                                                <Bot size={13} style={{ color: 'var(--gold)' }} />
                                            ) : adminUser ? (
                                                <Shield size={13} style={{ color: '#8b5cf6' }} />
                                            ) : (
                                                <Smartphone size={13} style={{ color: 'var(--text-muted)' }} />
                                            )}
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                {agentType}
                                                {broker?.creci && <span style={{ color: 'var(--text-muted)' }}> · CRECI {broker.creci}</span>}
                                            </span>
                                        </div>

                                        {/* Phone */}
                                        {displayPhone && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                                <Phone size={12} style={{ color: 'var(--text-muted)' }} />
                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                                    {formatPhone(displayPhone)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Details Section */}
                                {inst.status === 'connected' && (
                                    <div style={{
                                        padding: '14px 24px',
                                        borderTop: '1px solid var(--border)',
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr',
                                        gap: '10px',
                                        background: 'rgba(0,0,0,0.01)',
                                    }}>
                                        {/* Push Name */}
                                        {live?.pushName && (
                                            <DetailItem
                                                icon={<User size={13} />}
                                                label="Nome WhatsApp"
                                                value={live.pushName}
                                            />
                                        )}

                                        {/* Platform */}
                                        {live?.platform && (
                                            <DetailItem
                                                icon={<Monitor size={13} />}
                                                label="Dispositivo"
                                                value={live.platform}
                                            />
                                        )}

                                        {/* Battery */}
                                        {live?.battery !== null && live?.battery !== undefined && (
                                            <DetailItem
                                                icon={live.plugged ? <BatteryCharging size={13} style={{ color: '#22c55e' }} /> : <Battery size={13} />}
                                                label="Bateria"
                                                value={`${live.battery}%${live.plugged ? ' ⚡' : ''}`}
                                                valueColor={live.battery < 20 ? '#ef4444' : live.battery < 50 ? '#f59e0b' : '#22c55e'}
                                            />
                                        )}

                                        {/* Webhook */}
                                        <DetailItem
                                            icon={<Link2 size={13} />}
                                            label="Webhook"
                                            value={hasWebhook ? '✅ Configurado' : '❌ Não configurado'}
                                            valueColor={hasWebhook ? '#22c55e' : '#ef4444'}
                                        />

                                        {/* Voice */}
                                        {broker?.voice_id && (
                                            <DetailItem
                                                icon={<Mic size={13} />}
                                                label="Voz"
                                                value="ElevenLabs configurada"
                                            />
                                        )}

                                        {/* System Prompt */}
                                        {broker?.system_prompt && (
                                            <DetailItem
                                                icon={<MessageSquare size={13} />}
                                                label="Prompt"
                                                value={`${broker.system_prompt.length} caracteres`}
                                            />
                                        )}
                                    </div>
                                )}

                                {/* Footer */}
                                <div style={{
                                    padding: '10px 24px',
                                    borderTop: '1px solid var(--border)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: 'rgba(0,0,0,0.02)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {inst.connected_at
                                                ? `Conectado ${new Date(inst.connected_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                                                : `Criado ${new Date(inst.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`
                                            }
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                        {inst.instance_name.length > 30 ? inst.instance_name.slice(0, 30) + '...' : inst.instance_name}
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}

// Detail item sub-component
function DetailItem({ icon, label, value, valueColor }: {
    icon: React.ReactNode
    label: string
    value: string
    valueColor?: string
}) {
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
