'use client'

import { useEffect, useMemo, useState } from 'react'
import {
    Activity,
    Clock,
    Eye,
    Globe2,
    LogIn,
    LogOut,
    MonitorSmartphone,
    RefreshCw,
    Search,
    ShieldAlert,
    Users,
    XCircle,
} from 'lucide-react'

type AccessLog = {
    id: string
    admin_user_id: string | null
    event_type: string
    path: string | null
    attempted_email: string | null
    ip_address: string | null
    device_type: string | null
    browser: string | null
    os: string | null
    country: string | null
    city: string | null
    region: string | null
    created_at: string
    admin_user?: {
        id: string
        name: string
        email: string
        is_master: boolean
    } | null
}

type AccessStats = {
    total_events: number
    unique_users: number
    unique_ips: number
    login_success: number
    login_failed: number
    page_views: number
    logout: number
    top_users: {
        id: string | null
        name: string
        email: string | null
        events: number
        last_access_at: string
    }[]
}

const EVENT_OPTIONS = [
    { value: '', label: 'Todos' },
    { value: 'login_success', label: 'Login' },
    { value: 'login_failed', label: 'Falha' },
    { value: 'page_view', label: 'Pagina' },
    { value: 'logout', label: 'Saida' },
]

const EVENT_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    login_success: { label: 'Login', color: '#22c55e', icon: LogIn },
    login_failed: { label: 'Falha', color: '#ef4444', icon: XCircle },
    page_view: { label: 'Pagina', color: '#60a5fa', icon: Eye },
    logout: { label: 'Saida', color: '#f59e0b', icon: LogOut },
    session_ping: { label: 'Sessao', color: '#a78bfa', icon: Activity },
}

function formatDate(value?: string | null) {
    if (!value) return '-'
    return new Date(value).toLocaleString('pt-BR')
}

function safeDecode(value?: string | null) {
    if (!value) return ''
    try {
        return decodeURIComponent(value)
    } catch {
        return value
    }
}

function getLocation(log: AccessLog) {
    return [safeDecode(log.city), safeDecode(log.region), log.country].filter(Boolean).join(', ') || '-'
}

export default function UserAccessPage() {
    const [logs, setLogs] = useState<AccessLog[]>([])
    const [stats, setStats] = useState<AccessStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [days, setDays] = useState('7')
    const [eventType, setEventType] = useState('')
    const [search, setSearch] = useState('')

    const fetchAccess = async () => {
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams({
                days,
                limit: '300',
            })
            if (eventType) params.set('event_type', eventType)
            if (search.trim()) params.set('q', search.trim())

            const res = await fetch(`/api/admin/user-access?${params.toString()}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || 'Erro ao carregar acessos')

            setLogs(data.logs || [])
            setStats(data.stats || null)
        } catch (err: any) {
            setError(err.message || 'Erro ao carregar acessos')
            setLogs([])
            setStats(null)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAccess()
    }, [days, eventType])

    const statCards = useMemo(() => ([
        { label: 'Eventos', value: stats?.total_events || 0, icon: Activity, color: '#60a5fa' },
        { label: 'Usuarios', value: stats?.unique_users || 0, icon: Users, color: '#22c55e' },
        { label: 'IPs', value: stats?.unique_ips || 0, icon: Globe2, color: '#f59e0b' },
        { label: 'Falhas', value: stats?.login_failed || 0, icon: ShieldAlert, color: '#ef4444' },
    ]), [stats])

    return (
        <div>
            <div className="admin-header">
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <ShieldAlert size={26} /> Auditoria de Acessos
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
                        Monitoramento de logins, navegacao interna, IP, localizacao e dispositivos.
                    </p>
                </div>
                <button
                    className="btn btn-gold"
                    onClick={fetchAccess}
                    disabled={loading}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                    <RefreshCw size={16} className={loading ? 'spin' : ''} />
                    Atualizar
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
                {statCards.map(card => (
                    <div key={card.label} className="chart-card" style={{ padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>
                                {card.label}
                            </span>
                            <card.icon size={18} style={{ color: card.color }} />
                        </div>
                        <div style={{ color: 'var(--text-primary)', fontSize: '1.7rem', fontWeight: 800 }}>
                            {card.value}
                        </div>
                    </div>
                ))}
            </div>

            <div className="chart-card" style={{ marginBottom: 16, padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 180px auto', gap: 10, alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') fetchAccess()
                            }}
                            placeholder="Buscar por usuario, email, IP, cidade, navegador ou pagina"
                            style={{
                                width: '100%',
                                padding: '10px 12px 10px 38px',
                                borderRadius: 8,
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                            }}
                        />
                    </div>

                    <select
                        value={eventType}
                        onChange={e => setEventType(e.target.value)}
                        style={{
                            padding: '10px 12px',
                            borderRadius: 8,
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                        }}
                    >
                        {EVENT_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>

                    <select
                        value={days}
                        onChange={e => setDays(e.target.value)}
                        style={{
                            padding: '10px 12px',
                            borderRadius: 8,
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                        }}
                    >
                        <option value="1">Ultimas 24h</option>
                        <option value="7">Ultimos 7 dias</option>
                        <option value="30">Ultimos 30 dias</option>
                        <option value="90">Ultimos 90 dias</option>
                    </select>

                    <button className="btn" onClick={fetchAccess} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                        Filtrar
                    </button>
                </div>
            </div>

            {error && (
                <div className="chart-card" style={{ padding: 20, color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', marginBottom: 16 }}>
                    {error}
                </div>
            )}

            {stats?.top_users && stats.top_users.length > 0 && (
                <div className="chart-card" style={{ marginBottom: 16, padding: 16 }}>
                    <div className="chart-title" style={{ marginBottom: 12 }}>Usuarios mais ativos</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                        {stats.top_users.slice(0, 4).map(user => (
                            <div key={user.id || user.email || user.name} style={{ padding: 12, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {user.name}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 4 }}>
                                    {user.email || '-'}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, fontSize: '0.8rem' }}>
                                    <span style={{ color: 'var(--gold)', fontWeight: 800 }}>{user.events} eventos</span>
                                    <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="chart-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 1080 }}>
                        <thead style={{ background: '#1a1a1a' }}>
                            <tr style={{ borderBottom: '1px solid #2a2a2a', color: '#777', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                                <th style={{ padding: 12, fontWeight: 700 }}>Quando</th>
                                <th style={{ padding: 12, fontWeight: 700 }}>Evento</th>
                                <th style={{ padding: 12, fontWeight: 700 }}>Usuario</th>
                                <th style={{ padding: 12, fontWeight: 700 }}>IP</th>
                                <th style={{ padding: 12, fontWeight: 700 }}>Localizacao</th>
                                <th style={{ padding: 12, fontWeight: 700 }}>Dispositivo</th>
                                <th style={{ padding: 12, fontWeight: 700 }}>Pagina</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando acessos...</td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum acesso encontrado</td>
                                </tr>
                            ) : logs.map(log => {
                                const event = EVENT_CONFIG[log.event_type] || EVENT_CONFIG.page_view
                                const EventIcon = event.icon
                                const userName = log.admin_user?.name || log.attempted_email || 'Nao identificado'
                                const userEmail = log.admin_user?.email || log.attempted_email || ''

                                return (
                                    <tr key={log.id} style={{ borderBottom: '1px solid #2a2a2a', fontSize: '0.84rem' }}>
                                        <td style={{ padding: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                            {formatDate(log.created_at)}
                                        </td>
                                        <td style={{ padding: 12 }}>
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                color: event.color,
                                                background: `${event.color}18`,
                                                border: `1px solid ${event.color}44`,
                                                borderRadius: 8,
                                                padding: '4px 8px',
                                                fontWeight: 700,
                                                fontSize: '0.75rem',
                                            }}>
                                                <EventIcon size={13} />
                                                {event.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: 12 }}>
                                            <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{userName}</div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginTop: 2 }}>{userEmail}</div>
                                        </td>
                                        <td style={{ padding: 12, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                                            {log.ip_address || '-'}
                                        </td>
                                        <td style={{ padding: 12, color: 'var(--text-muted)' }}>
                                            {getLocation(log)}
                                        </td>
                                        <td style={{ padding: 12 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                                                <MonitorSmartphone size={15} style={{ color: 'var(--gold)' }} />
                                                <span>{[log.device_type, log.browser, log.os].filter(Boolean).join(' / ') || '-'}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: 12, color: 'var(--text-muted)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {log.path || '-'}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
