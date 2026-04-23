'use client'

import { useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'

type ExportStatus = 'generated' | 'sent' | 'confirmed' | 'failed'

interface AccountingExport {
    id: string
    period_start: string
    period_end: string
    status: ExportStatus
    file_url: string | null
    payload: any
    created_at: string
}

interface ToastState {
    msg: string
    type: 'success' | 'error'
}

function todayISO() {
    return new Date().toISOString().slice(0, 10)
}

function firstDayOfMonth() {
    const date = new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10)
}

export default function FinanceAccountingExportsPage() {
    const [items, setItems] = useState<AccountingExport[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [startDate, setStartDate] = useState(firstDayOfMonth())
    const [endDate, setEndDate] = useState(todayISO())
    const [toast, setToast] = useState<ToastState | null>(null)

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    const fetchExports = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/finance/accounting-exports?limit=60')
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Erro ao carregar exportacoes')
            }
            setItems(data.exports || [])
        } catch (err: any) {
            showToast(err.message || 'Erro ao carregar exportacoes', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchExports()
    }, [])

    const downloadCsv = (csvContent: string) => {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `finance_export_${startDate}_${endDate}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    const onGenerate = async () => {
        setSaving(true)
        try {
            const res = await fetch('/api/admin/finance/accounting-exports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    period_start: startDate,
                    period_end: endDate,
                }),
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Erro ao gerar exportacao')
            }

            const csvContent = String(data.csv || '')
            if (csvContent) {
                downloadCsv(csvContent)
            }

            showToast(`Exportacao gerada com ${Number(data.rows_count || 0)} linhas`, 'success')
            await fetchExports()
        } catch (err: any) {
            showToast(err.message || 'Erro ao gerar exportacao', 'error')
        } finally {
            setSaving(false)
        }
    }

    const exportCountLabel = useMemo(() => `${items.length} exportacoes`, [items.length])

    return (
        <div style={{ padding: '24px 18px 36px' }}>
            {toast ? <div className={`admin-toast ${toast.type}`}>{toast.msg}</div> : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                    <h1 style={{ margin: 0 }}>Exportacao Contabil</h1>
                    <p style={{ marginTop: 6, color: 'var(--text-muted)' }}>
                        Gere CSV padrao do financeiro para envio ao escritorio contabil.
                    </p>
                </div>
                <button className="btn btn-outline" onClick={fetchExports} disabled={loading}>
                    <RefreshCw size={16} style={{ marginRight: 6 }} /> Atualizar
                </button>
            </div>

            <div className="chart-card" style={{ marginBottom: 14 }}>
                <div className="chart-title">Gerar Arquivo</div>
                <div style={{ display: 'grid', gridTemplateColumns: '220px 220px auto', gap: 10 }}>
                    <div>
                        <label className="label">Data inicial</label>
                        <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div>
                        <label className="label">Data final</label>
                        <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'end' }}>
                        <button className="btn btn-gold" onClick={onGenerate} disabled={saving}>
                            Gerar CSV
                        </button>
                    </div>
                </div>
            </div>

            <div className="chart-card">
                <div className="chart-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Historico de Exportacoes</span>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{exportCountLabel}</span>
                </div>
                {loading ? (
                    <div style={{ padding: 18, color: 'var(--text-muted)' }}>Carregando...</div>
                ) : items.length === 0 ? (
                    <div style={{ padding: 18, color: 'var(--text-muted)' }}>Nenhuma exportacao registrada.</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Periodo</th>
                                    <th>Status</th>
                                    <th>Linhas</th>
                                    <th>Gerado em</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(item => (
                                    <tr key={item.id}>
                                        <td>{item.period_start} ate {item.period_end}</td>
                                        <td>{item.status}</td>
                                        <td>{Number(item.payload?.rows_count || 0)}</td>
                                        <td>{new Date(item.created_at).toLocaleString('pt-BR')}</td>
                                    </tr>
                                ))}
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
