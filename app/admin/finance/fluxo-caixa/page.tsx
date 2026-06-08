'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, Wallet } from 'lucide-react'

interface CashflowSummary {
    realized_inflow: number
    realized_outflow: number
    realized_net: number
    projected_inflow: number
    projected_outflow: number
    projected_net: number
    combined_net: number
}

interface CashflowTimelineRow {
    date: string
    realized_inflow: number
    realized_outflow: number
    projected_inflow: number
    projected_outflow: number
    net: number
    cumulative_net: number
}

interface OpenAparRow {
    id: string
    due_date: string
    description: string
    counterparty_name: string | null
    remaining_amount: number
    status: string
}

interface CashflowResponseData {
    summary: CashflowSummary
    timeline: CashflowTimelineRow[]
    open_receivables: OpenAparRow[]
    open_payables: OpenAparRow[]
}

interface ToastState {
    msg: string
    type: 'success' | 'error'
}

function todayISO() {
    return new Date().toISOString().slice(0, 10)
}

function firstDayOfMonthISO() {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function formatCurrency(value: number) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(date: string) {
    if (!date) return '-'
    return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR')
}

interface FinanceEntity { id: string; name: string; entity_type: string }

export default function FinanceCashflowPage() {
    const [loading, setLoading] = useState(true)
    const [startDate, setStartDate] = useState(firstDayOfMonthISO())
    const [endDate, setEndDate] = useState(todayISO())
    const [entityFilter, setEntityFilter] = useState('all')
    const [entities, setEntities] = useState<FinanceEntity[]>([])
    const [data, setData] = useState<CashflowResponseData | null>(null)
    const [toast, setToast] = useState<ToastState | null>(null)

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    useEffect(() => {
        fetch('/api/admin/finance/lookups')
            .then(r => r.json())
            .then(d => { if (d.entities) setEntities(d.entities) })
            .catch(() => {})
    }, [])

    const fetchReport = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                report: 'cashflow',
                start_date: startDate,
                end_date: endDate,
            })
            if (entityFilter !== 'all') params.set('entity_id', entityFilter)
            const res = await fetch(`/api/admin/finance/reports?${params.toString()}`)
            const payload = await res.json()
            if (!res.ok || !payload.success) {
                throw new Error(payload.error || 'Erro ao carregar fluxo de caixa')
            }
            setData(payload.data || null)
        } catch (err: any) {
            showToast(err.message || 'Erro ao carregar fluxo de caixa', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchReport()
    }, [])

    return (
        <div style={{ padding: '24px 18px 36px' }}>
            {toast ? <div className={`admin-toast ${toast.type}`}>{toast.msg}</div> : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Wallet size={26} /> Fluxo de Caixa
                    </h1>
                    <p style={{ marginTop: 6, color: 'var(--text-muted)' }}>
                        Visao de realizado (lancamentos pagos) e projetado (AP/AR em aberto).
                    </p>
                </div>
                <button className="btn btn-outline" onClick={fetchReport} disabled={loading}>
                    <RefreshCw size={16} style={{ marginRight: 6 }} /> Atualizar
                </button>
            </div>

            <div className="chart-card" style={{ marginBottom: 14 }}>
                <div className="chart-title">Filtro de periodo</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
                    <div>
                        <label className="label">Data inicial</label>
                        <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div>
                        <label className="label">Data final</label>
                        <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    {entities.length > 0 && (
                        <div>
                            <label className="label">Entidade (PF/PJ)</label>
                            <select className="input" value={entityFilter} onChange={e => setEntityFilter(e.target.value)} style={{ minWidth: 160 }}>
                                <option value="all">Consolidado (todas)</option>
                                {entities.map(e => (
                                    <option key={e.id} value={e.id}>{e.name} ({e.entity_type.toUpperCase()})</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div>
                        <button className="btn btn-gold" onClick={fetchReport} disabled={loading}>
                            Recalcular fluxo
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="chart-card" style={{ color: 'var(--text-muted)' }}>Carregando relatorio...</div>
            ) : !data ? (
                <div className="chart-card" style={{ color: 'var(--text-muted)' }}>Sem dados para o periodo selecionado.</div>
            ) : (
                <>
                    <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 14 }}>
                        <div className="kpi-card">
                            <div className="kpi-label">Entradas realizadas</div>
                            <div className="kpi-value" style={{ color: '#22c55e' }}>{formatCurrency(data.summary.realized_inflow)}</div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-label">Saidas realizadas</div>
                            <div className="kpi-value" style={{ color: '#ef4444' }}>{formatCurrency(data.summary.realized_outflow)}</div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-label">Saldo realizado</div>
                            <div className="kpi-value" style={{ color: data.summary.realized_net >= 0 ? '#22c55e' : '#ef4444' }}>{formatCurrency(data.summary.realized_net)}</div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-label">Saldo projetado</div>
                            <div className="kpi-value" style={{ color: data.summary.projected_net >= 0 ? '#22c55e' : '#ef4444' }}>{formatCurrency(data.summary.projected_net)}</div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-label">Saldo combinado</div>
                            <div className="kpi-value" style={{ color: data.summary.combined_net >= 0 ? '#22c55e' : '#ef4444' }}>{formatCurrency(data.summary.combined_net)}</div>
                        </div>
                    </div>

                    <div className="chart-card" style={{ marginBottom: 14 }}>
                        <div className="chart-title" style={{ marginBottom: 10 }}>Linha do tempo (realizado + projetado)</div>
                        {data.timeline.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)' }}>Sem movimentacao no periodo.</div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Data</th>
                                            <th>Ent. realizada</th>
                                            <th>Sai. realizada</th>
                                            <th>Ent. projetada</th>
                                            <th>Sai. projetada</th>
                                            <th>Saldo diario</th>
                                            <th>Saldo acumulado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.timeline.map(row => (
                                            <tr key={row.date}>
                                                <td>{formatDate(row.date)}</td>
                                                <td style={{ color: '#22c55e', fontWeight: 700 }}>{formatCurrency(row.realized_inflow)}</td>
                                                <td style={{ color: '#ef4444', fontWeight: 700 }}>{formatCurrency(row.realized_outflow)}</td>
                                                <td style={{ color: '#22c55e', fontWeight: 700 }}>{formatCurrency(row.projected_inflow)}</td>
                                                <td style={{ color: '#ef4444', fontWeight: 700 }}>{formatCurrency(row.projected_outflow)}</td>
                                                <td style={{ color: row.net >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{formatCurrency(row.net)}</td>
                                                <td style={{ color: row.cumulative_net >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{formatCurrency(row.cumulative_net)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="chart-card">
                            <div className="chart-title" style={{ marginBottom: 10 }}>Contas a receber em aberto</div>
                            {data.open_receivables.length === 0 ? (
                                <div style={{ color: 'var(--text-muted)' }}>Sem contas a receber em aberto no periodo.</div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Vencimento</th>
                                                <th>Descricao</th>
                                                <th>Favorecido</th>
                                                <th>Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.open_receivables.map(row => (
                                                <tr key={row.id}>
                                                    <td>{formatDate(row.due_date)}</td>
                                                    <td>{row.description}</td>
                                                    <td>{row.counterparty_name || '-'}</td>
                                                    <td style={{ color: '#22c55e', fontWeight: 700 }}>{formatCurrency(row.remaining_amount)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div className="chart-card">
                            <div className="chart-title" style={{ marginBottom: 10 }}>Contas a pagar em aberto</div>
                            {data.open_payables.length === 0 ? (
                                <div style={{ color: 'var(--text-muted)' }}>Sem contas a pagar em aberto no periodo.</div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Vencimento</th>
                                                <th>Descricao</th>
                                                <th>Favorecido</th>
                                                <th>Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.open_payables.map(row => (
                                                <tr key={row.id}>
                                                    <td>{formatDate(row.due_date)}</td>
                                                    <td>{row.description}</td>
                                                    <td>{row.counterparty_name || '-'}</td>
                                                    <td style={{ color: '#ef4444', fontWeight: 700 }}>{formatCurrency(row.remaining_amount)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

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
                @media (max-width: 980px) {
                    .kpi-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
                @media (max-width: 1080px) {
                    .chart-card + .chart-card {
                        margin-top: 12px;
                    }
                }
            `}</style>
        </div>
    )
}

