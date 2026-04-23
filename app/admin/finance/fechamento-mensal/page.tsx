'use client'

import { useEffect, useMemo, useState } from 'react'
import { Lock, RefreshCw, RotateCcw } from 'lucide-react'

type ClosingStatus = 'open' | 'closed' | 'locked'

interface ClosingPeriod {
    id: string
    period_month: string
    status: ClosingStatus
    closed_at: string | null
    locked_at: string | null
    notes: string | null
    updated_at: string
}

interface ToastState {
    msg: string
    type: 'success' | 'error'
}

function toMonthInput(date: Date) {
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    return `${yyyy}-${mm}`
}

function formatDateTime(value: string | null) {
    if (!value) return '-'
    return new Date(value).toLocaleString('pt-BR')
}

export default function FinanceClosingPage() {
    const [periods, setPeriods] = useState<ClosingPeriod[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [periodMonth, setPeriodMonth] = useState(toMonthInput(new Date()))
    const [notes, setNotes] = useState('')
    const [toast, setToast] = useState<ToastState | null>(null)

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    const fetchPeriods = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/finance/closing?limit=36')
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Erro ao carregar fechamentos')
            }
            setPeriods(data.periods || [])
        } catch (err: any) {
            showToast(err.message || 'Erro ao carregar fechamentos', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchPeriods()
    }, [])

    const doClose = async (action: 'close' | 'lock') => {
        setSaving(true)
        try {
            const res = await fetch('/api/admin/finance/closing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    period_month: periodMonth,
                    notes: notes.trim() || null,
                }),
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao fechar periodo')

            showToast(action === 'lock' ? 'Periodo bloqueado com sucesso' : 'Periodo fechado com sucesso', 'success')
            await fetchPeriods()
        } catch (err: any) {
            showToast(err.message || 'Erro ao fechar periodo', 'error')
        } finally {
            setSaving(false)
        }
    }

    const doReopen = async (month: string) => {
        setSaving(true)
        try {
            const monthOnly = String(month || '').slice(0, 7)
            const res = await fetch('/api/admin/finance/closing', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'reopen',
                    period_month: monthOnly,
                }),
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao reabrir periodo')
            showToast('Periodo reaberto com sucesso', 'success')
            await fetchPeriods()
        } catch (err: any) {
            showToast(err.message || 'Erro ao reabrir periodo', 'error')
        } finally {
            setSaving(false)
        }
    }

    const statusStyle = (status: ClosingStatus) => {
        if (status === 'locked') return { color: '#ef4444', bg: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)' }
        if (status === 'closed') return { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)' }
        return { color: '#22c55e', bg: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)' }
    }

    const periodCountLabel = useMemo(() => `${periods.length} periodos`, [periods.length])

    return (
        <div style={{ padding: '24px 18px 36px' }}>
            {toast ? (
                <div className={`admin-toast ${toast.type}`}>{toast.msg}</div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                    <h1 style={{ margin: 0 }}>Fechamento Mensal</h1>
                    <p style={{ marginTop: 6, color: 'var(--text-muted)' }}>
                        Feche e bloqueie periodos para evitar alteracoes indevidas no historico financeiro.
                    </p>
                </div>
                <button className="btn btn-outline" onClick={fetchPeriods} disabled={loading}>
                    <RefreshCw size={16} style={{ marginRight: 6 }} /> Atualizar
                </button>
            </div>

            <div className="chart-card" style={{ marginBottom: 14 }}>
                <div className="chart-title">Novo Fechamento</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, alignItems: 'end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label className="form-label">Competencia</label>
                        <input type="month" className="form-input" value={periodMonth} onChange={e => setPeriodMonth(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label className="form-label">Observacao</label>
                        <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'flex-end' }}>
                        <button className="btn btn-gold" onClick={() => doClose('close')} disabled={saving}>
                            Fechar
                        </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" onClick={() => doClose('lock')} disabled={saving}>
                            <Lock size={14} style={{ marginRight: 6 }} /> Bloquear
                        </button>
                    </div>
                </div>
            </div>

            <div className="chart-card">
                <div className="chart-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Historico de Fechamentos</span>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{periodCountLabel}</span>
                </div>
                {loading ? (
                    <div style={{ padding: 18, color: 'var(--text-muted)' }}>Carregando...</div>
                ) : periods.length === 0 ? (
                    <div style={{ padding: 18, color: 'var(--text-muted)' }}>Nenhum periodo registrado.</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Competencia</th>
                                    <th>Status</th>
                                    <th>Fechado em</th>
                                    <th>Bloqueado em</th>
                                    <th>Obs</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {periods.map(period => {
                                    const s = statusStyle(period.status)
                                    return (
                                        <tr key={period.id}>
                                            <td>{String(period.period_month).slice(0, 7)}</td>
                                            <td>
                                                <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, color: s.color, background: s.bg, border: s.border }}>
                                                    {period.status}
                                                </span>
                                            </td>
                                            <td>{formatDateTime(period.closed_at)}</td>
                                            <td>{formatDateTime(period.locked_at)}</td>
                                            <td>{period.notes || '-'}</td>
                                            <td>
                                                {period.status !== 'locked' && period.status !== 'open' ? (
                                                    <button className="btn btn-outline" style={{ padding: '6px 10px' }} onClick={() => doReopen(period.period_month)} disabled={saving}>
                                                        <RotateCcw size={14} style={{ marginRight: 6 }} />
                                                        Reabrir
                                                    </button>
                                                ) : '-'}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <style>{`
                .admin-toast {
                    position: fixed;
                    top: 24px;
                    right: 24px;
                    padding: 12px 18px;
                    border-radius: 10px;
                    z-index: 9999;
                    font-size: 0.86rem;
                    font-weight: 600;
                    box-shadow: 0 8px 28px rgba(0,0,0,.35);
                }
                .admin-toast.success {
                    background: rgba(34, 197, 94, 0.15);
                    color: #22c55e;
                    border: 1px solid rgba(34, 197, 94, 0.35);
                }
                .admin-toast.error {
                    background: rgba(239, 68, 68, 0.15);
                    color: #ef4444;
                    border: 1px solid rgba(239, 68, 68, 0.35);
                }
            `}</style>
        </div>
    )
}
