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
    Clock
} from 'lucide-react'

interface Instance {
    id: string
    admin_user_id: string
    instance_name: string
    phone_number: string | null
    status: 'disconnected' | 'connecting' | 'connected'
    connected_at: string | null
    created_at: string
    admin_users?: { name: string; email: string }
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
                    <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Carregando instâncias...</p>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
                    {instances.map(inst => {
                        const badge = getStatusBadge(inst.status)
                        return (
                            <div key={inst.id} className="chart-card" style={{
                                padding: '24px',
                                borderLeft: `4px solid ${badge.color}`,
                                transition: 'all 0.2s'
                            }}>
                                {/* Status Badge */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                        padding: '4px 12px', borderRadius: '20px',
                                        background: badge.bg, border: `1px solid ${badge.border}`,
                                        fontSize: '0.8rem', fontWeight: 600, color: badge.color
                                    }}>
                                        <badge.Icon size={14} />
                                        {badge.text}
                                    </div>
                                </div>

                                {/* Instance Info */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Smartphone size={16} style={{ color: 'var(--text-muted)' }} />
                                        <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {inst.instance_name}
                                        </span>
                                    </div>

                                    {inst.phone_number && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Phone size={14} style={{ color: 'var(--text-muted)' }} />
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                {inst.phone_number}
                                            </span>
                                        </div>
                                    )}

                                    {inst.admin_users && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <User size={14} style={{ color: 'var(--text-muted)' }} />
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                {inst.admin_users.name}
                                            </span>
                                        </div>
                                    )}

                                    {inst.connected_at && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                Conectado em {new Date(inst.connected_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    )}
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
