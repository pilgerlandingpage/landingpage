'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, User, Phone, Home, Check, X, RefreshCw, ChevronLeft, ChevronRight, MapPin } from 'lucide-react'

interface Appointment {
    id: string
    lead_phone: string
    lead_name: string | null
    broker_id: string | null
    appointment_date: string
    appointment_time: string | null
    appointment_type: string
    property_title: string | null
    status: string
    notes: string | null
    created_at: string
    confirmed_at: string | null
    cancelled_at: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    pending: { label: 'Pendente', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', icon: '🟡' },
    confirmed: { label: 'Confirmado', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', icon: '✅' },
    cancelled: { label: 'Cancelado', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', icon: '❌' },
    completed: { label: 'Realizado', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', icon: '🏠' },
}

const TIME_LABELS: Record<string, string> = {
    'manhã': '🌅 Manhã (8h-12h)',
    'tarde': '🌇 Tarde (13h-17h)',
    'noite': '🌙 Noite (18h-20h)',
    'Manhã': '🌅 Manhã (8h-12h)',
    'Tarde': '🌇 Tarde (13h-17h)',
    'Noite': '🌙 Noite (18h-20h)',
}

export default function AgendaPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState('all')
    const [currentWeekStart, setCurrentWeekStart] = useState(() => {
        const d = new Date()
        d.setDate(d.getDate() - d.getDay() + 1) // Monday
        d.setHours(0, 0, 0, 0)
        return d
    })

    useEffect(() => {
        loadAppointments()
    }, [currentWeekStart, statusFilter])

    async function loadAppointments() {
        setLoading(true)
        try {
            const from = currentWeekStart.toISOString().split('T')[0]
            const toDate = new Date(currentWeekStart)
            toDate.setDate(toDate.getDate() + 6)
            const to = toDate.toISOString().split('T')[0]

            const params = new URLSearchParams({ from, to })
            if (statusFilter !== 'all') params.set('status', statusFilter)

            const res = await fetch(`/api/admin/whatsapp/appointments?${params}`)
            const data = await res.json()
            if (data.success) setAppointments(data.appointments)
        } catch (err) {
            console.error('Erro ao carregar agenda:', err)
        } finally {
            setLoading(false)
        }
    }

    async function updateStatus(id: string, newStatus: string) {
        try {
            await fetch('/api/admin/whatsapp/appointments', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: newStatus })
            })
            loadAppointments()
        } catch (err) {
            console.error('Erro ao atualizar:', err)
        }
    }

    function prevWeek() {
        const d = new Date(currentWeekStart)
        d.setDate(d.getDate() - 7)
        setCurrentWeekStart(d)
    }

    function nextWeek() {
        const d = new Date(currentWeekStart)
        d.setDate(d.getDate() + 7)
        setCurrentWeekStart(d)
    }

    function goToday() {
        const d = new Date()
        d.setDate(d.getDate() - d.getDay() + 1)
        d.setHours(0, 0, 0, 0)
        setCurrentWeekStart(d)
    }

    function formatPhone(phone: string): string {
        const clean = phone.replace(/\D/g, '')
        if (clean.length === 13) return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`
        return phone
    }

    function formatDate(dateStr: string): string {
        const d = new Date(dateStr + 'T12:00:00')
        return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
    }

    // Generate week days
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(currentWeekStart)
        d.setDate(d.getDate() + i)
        return d
    })

    const weekLabel = `${weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — ${weekDays[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`

    // Stats
    const stats = {
        pending: appointments.filter(a => a.status === 'pending').length,
        confirmed: appointments.filter(a => a.status === 'confirmed').length,
        total: appointments.length,
    }

    const isToday = (d: Date) => {
        const today = new Date()
        return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
    }

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
                        📅 Agenda de Visitas
                    </h1>
                    <p style={{ color: '#888', fontSize: '0.85rem', margin: '4px 0 0' }}>
                        Agendamentos feitos pelo agente IA via WhatsApp
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {stats.pending > 0 && (
                        <span style={{
                            padding: '6px 14px', borderRadius: 20,
                            background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)',
                            fontSize: '0.8rem', fontWeight: 600, color: '#f59e0b'
                        }}>
                            🟡 {stats.pending} pendente{stats.pending > 1 ? 's' : ''}
                        </span>
                    )}
                </div>
            </div>

            {/* Week Navigation */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#fff', padding: '12px 20px', borderRadius: 12,
                border: '1px solid #e8e5e0', marginBottom: 16
            }}>
                <button onClick={prevWeek} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <ChevronLeft size={20} color="#888" />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: '1rem', fontWeight: 600, color: '#333' }}>{weekLabel}</span>
                    <button
                        onClick={goToday}
                        style={{
                            padding: '4px 12px', borderRadius: 6,
                            background: '#f5f0ea', border: '1px solid #e0ddd8',
                            fontSize: '0.72rem', fontWeight: 600, color: '#b8945f',
                            cursor: 'pointer'
                        }}
                    >
                        Hoje
                    </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        style={{
                            padding: '6px 10px', borderRadius: 6, border: '1px solid #e0ddd8',
                            fontSize: '0.78rem', fontFamily: 'inherit', cursor: 'pointer'
                        }}
                    >
                        <option value="all">Todos</option>
                        {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <option key={k} value={k}>{v.icon} {v.label}</option>
                        ))}
                    </select>
                    <button onClick={nextWeek} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                        <ChevronRight size={20} color="#888" />
                    </button>
                </div>
            </div>

            {/* Week Grid */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
                    <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
                    <p style={{ marginTop: 8 }}>Carregando agenda...</p>
                    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                    {weekDays.map(day => {
                        const dateStr = day.toISOString().split('T')[0]
                        const dayApps = appointments.filter(a => a.appointment_date === dateStr)
                        const dayLabel = day.toLocaleDateString('pt-BR', { weekday: 'short' })
                        const dayNum = day.getDate()
                        const today = isToday(day)

                        return (
                            <div key={dateStr} style={{
                                background: '#fff', borderRadius: 10,
                                border: today ? '2px solid #b8945f' : '1px solid #e8e5e0',
                                minHeight: 160, overflow: 'hidden'
                            }}>
                                {/* Day Header */}
                                <div style={{
                                    padding: '8px 10px',
                                    background: today ? 'linear-gradient(135deg, #b8945f, #d4b87a)' : '#fafaf7',
                                    borderBottom: '1px solid #f0ede8',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '0.68rem', fontWeight: 600, color: today ? '#fff' : '#aaa', textTransform: 'uppercase' }}>
                                        {dayLabel}
                                    </div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: today ? '#fff' : '#333' }}>
                                        {dayNum}
                                    </div>
                                </div>

                                {/* Appointments */}
                                <div style={{ padding: 6 }}>
                                    {dayApps.length === 0 && (
                                        <div style={{ padding: 8, textAlign: 'center', color: '#ddd', fontSize: '0.7rem' }}>
                                            Sem agendamentos
                                        </div>
                                    )}
                                    {dayApps.map(app => {
                                        const sCfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending
                                        return (
                                            <div key={app.id} style={{
                                                background: sCfg.bg,
                                                borderRadius: 8,
                                                padding: '8px 10px',
                                                marginBottom: 4,
                                                borderLeft: `3px solid ${sCfg.color}`,
                                                fontSize: '0.72rem'
                                            }}>
                                                <div style={{ fontWeight: 700, color: '#333', marginBottom: 2 }}>
                                                    {app.lead_name || 'Sem nome'}
                                                </div>
                                                <div style={{ color: '#888', display: 'flex', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                                                    <Clock size={10} />
                                                    {TIME_LABELS[app.appointment_time || ''] || app.appointment_time || 'A definir'}
                                                </div>
                                                {app.property_title && (
                                                    <div style={{ color: '#888', display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
                                                        <Home size={10} /> {app.property_title}
                                                    </div>
                                                )}
                                                {app.status === 'pending' && (
                                                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                                                        <button
                                                            onClick={() => updateStatus(app.id, 'confirmed')}
                                                            style={{
                                                                flex: 1, padding: '3px 0', borderRadius: 4,
                                                                background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)',
                                                                color: '#22c55e', fontSize: '0.65rem', fontWeight: 600,
                                                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2
                                                            }}
                                                        >
                                                            <Check size={10} /> Confirmar
                                                        </button>
                                                        <button
                                                            onClick={() => updateStatus(app.id, 'cancelled')}
                                                            style={{
                                                                flex: 1, padding: '3px 0', borderRadius: 4,
                                                                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                                                                color: '#ef4444', fontSize: '0.65rem', fontWeight: 600,
                                                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2
                                                            }}
                                                        >
                                                            <X size={10} /> Cancelar
                                                        </button>
                                                    </div>
                                                )}
                                                {app.status === 'confirmed' && (
                                                    <button
                                                        onClick={() => updateStatus(app.id, 'completed')}
                                                        style={{
                                                            width: '100%', padding: '3px 0', borderRadius: 4, marginTop: 4,
                                                            background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)',
                                                            color: '#3b82f6', fontSize: '0.65rem', fontWeight: 600,
                                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2
                                                        }}
                                                    >
                                                        🏠 Visita Realizada
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* List View (below calendar) */}
            {!loading && appointments.length > 0 && (
                <div style={{
                    marginTop: 20, background: '#fff', borderRadius: 12,
                    border: '1px solid #e8e5e0', overflow: 'hidden'
                }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0ede8' }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#333', margin: 0 }}>
                            📋 Lista Detalhada — {appointments.length} agendamento{appointments.length > 1 ? 's' : ''}
                        </h3>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#fafaf7' }}>
                                {['Status', 'Data', 'Horário', 'Lead', 'Telefone', 'Imóvel', 'Ações'].map(h => (
                                    <th key={h} style={{
                                        padding: '8px 12px', textAlign: 'left',
                                        fontSize: '0.68rem', fontWeight: 600, color: '#aaa',
                                        borderBottom: '1px solid #f0ede8', textTransform: 'uppercase'
                                    }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {appointments.map(app => {
                                const sCfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending
                                return (
                                    <tr key={app.id} style={{ borderBottom: '1px solid #f5f2ed' }}>
                                        <td style={{ padding: '10px 12px' }}>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: 12,
                                                fontSize: '0.7rem', fontWeight: 600,
                                                color: sCfg.color, background: sCfg.bg
                                            }}>
                                                {sCfg.icon} {sCfg.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 12px', fontSize: '0.82rem', color: '#333' }}>
                                            {formatDate(app.appointment_date)}
                                        </td>
                                        <td style={{ padding: '10px 12px', fontSize: '0.82rem', color: '#555' }}>
                                            {app.appointment_time || '—'}
                                        </td>
                                        <td style={{ padding: '10px 12px', fontSize: '0.82rem', fontWeight: 600, color: '#333' }}>
                                            {app.lead_name || 'Sem nome'}
                                        </td>
                                        <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: '#888' }}>
                                            {formatPhone(app.lead_phone)}
                                        </td>
                                        <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: '#888' }}>
                                            {app.property_title || '—'}
                                        </td>
                                        <td style={{ padding: '10px 12px' }}>
                                            {app.status === 'pending' && (
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button onClick={() => updateStatus(app.id, 'confirmed')}
                                                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>
                                                        ✅ Confirmar
                                                    </button>
                                                    <button onClick={() => updateStatus(app.id, 'cancelled')}
                                                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', color: '#ef4444', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>
                                                        ❌
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
