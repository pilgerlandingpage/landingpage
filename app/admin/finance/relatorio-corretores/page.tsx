'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, Users } from 'lucide-react'

interface BrokerCommission {
    id: string
    sale_amount: number
    commission_amount: number
    status: string
    due_date: string | null
    paid_at: string | null
    source_ref_type: string | null
    source_ref_id: string | null
    created_at: string
}

interface BrokerRow {
    broker_id: string | null
    broker_name: string
    total_commissions: number
    paid_commissions: number
    pending_commissions: number
    total_commission_amount: number
    paid_commission_amount: number
    pending_commission_amount: number
    total_sale_amount: number
    commissions: BrokerCommission[]
}

interface ReportTotals {
    total_commissions: number
    paid_commissions: number
    pending_commissions: number
    total_commission_amount: number
    paid_commission_amount: number
    pending_commission_amount: number
    total_sale_amount: number
}

interface ToastState {
    msg: string
    type: 'success' | 'error'
}

function firstDayOfMonthISO() {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function todayISO() {
    return new Date().toISOString().slice(0, 10)
}

function formatCurrency(value: number) {
    return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string | null) {
    if (!iso) return '-'
    return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR')
}

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pendente',
    approved: 'Aprovada',
    paid: 'Paga',
    reversed: 'Estornada',
    contested: 'Contestada',
}

function statusColor(status: string) {
    if (status === 'paid') return '#22c55e'
    if (status === 'pending' || status === 'approved') return '#f59e0b'
    if (status === 'reversed' || status === 'contested') return '#ef4444'
    return 'var(--text-muted)'
}

export default function FinanceBrokerReportPage() {
    const [loading, setLoading] = useState(true)
    const [startDate, setStartDate] = useState(firstDayOfMonthISO())
    const [endDate, setEndDate] = useState(todayISO())
    const [totals, setTotals] = useState<ReportTotals | null>(null)
    const [brokers, setBrokers] = useState<BrokerRow[]>([])
    const [expandedBroker, setExpandedBroker] = useState<string | null>(null)
    const [toast, setToast] = useState<ToastState | null>(null)

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    const fetchReport = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (startDate) params.set('start_date', startDate)
            if (endDate) params.set('end_date', endDate)
            const res = await fetch(`/api/admin/finance/broker-report?${params.toString()}`)
            const payload = await res.json()
            if (!res.ok || !payload.success) {
                throw new Error(payload.error || 'Erro ao carregar relatorio de corretores')
            }
            setTotals(payload.totals || null)
            setBrokers(payload.brokers || [])
        } catch (err: any) {
            showToast(err.message || 'Erro ao carregar relatorio', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchReport()
    }, [])

    const toggleBroker = (key: string) => {
        setExpandedBroker(prev => prev === key ? null : key)
    }

    return (
        <div style={{ padding: '24px 18px 36px' }}>
            {toast ? <div className={`admin-toast ${toast.type}`}>{toast.msg}</div> : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Users size={26} /> Relatorio por Corretor
                    </h1>
                    <p style={{ marginTop: 6, color: 'var(--text-muted)' }}>
                        Comissoes calculadas, pagas e pendentes por corretor no periodo.
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
                    <div>
                        <button className="btn btn-gold" onClick={fetchReport} disabled={loading}>
                            Gerar relatorio
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="chart-card" style={{ color: 'var(--text-muted)' }}>Carregando relatorio...</div>
            ) : brokers.length === 0 ? (
                <div className="chart-card" style={{ color: 'var(--text-muted)' }}>Nenhuma comissao encontrada para o periodo selecionado.</div>
            ) : (
                <>
                    {totals && (
                        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 14 }}>
                            <div className="kpi-card">
                                <div className="kpi-label">Total comissoes</div>
                                <div className="kpi-value">{totals.total_commissions}</div>
                                <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>{totals.paid_commissions} pagas · {totals.pending_commissions} pendentes</div>
                            </div>
                            <div className="kpi-card">
                                <div className="kpi-label">Total comissoes (R$)</div>
                                <div className="kpi-value">{formatCurrency(totals.total_commission_amount)}</div>
                                <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>Sobre todas as vendas</div>
                            </div>
                            <div className="kpi-card">
                                <div className="kpi-label">Comissoes pagas</div>
                                <div className="kpi-value" style={{ color: '#22c55e' }}>{formatCurrency(totals.paid_commission_amount)}</div>
                            </div>
                            <div className="kpi-card">
                                <div className="kpi-label">Comissoes pendentes</div>
                                <div className="kpi-value" style={{ color: '#f59e0b' }}>{formatCurrency(totals.pending_commission_amount)}</div>
                            </div>
                            <div className="kpi-card">
                                <div className="kpi-label">Volume de vendas</div>
                                <div className="kpi-value">{formatCurrency(totals.total_sale_amount)}</div>
                                <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>Total gerado pelo time</div>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {brokers.map(broker => {
                            const key = broker.broker_id || `name:${broker.broker_name}`
                            const isExpanded = expandedBroker === key
                            const commissionRate = broker.total_sale_amount > 0
                                ? ((broker.total_commission_amount / broker.total_sale_amount) * 100).toFixed(1)
                                : '0.0'
                            return (
                                <div key={key} className="chart-card" style={{ padding: '16px 20px' }}>
                                    <div
                                        style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flexWrap: 'wrap' }}
                                        onClick={() => toggleBroker(key)}
                                    >
                                        <div style={{ flex: 1, minWidth: 120 }}>
                                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{broker.broker_name}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                                {broker.total_commissions} comiss{broker.total_commissions === 1 ? 'ao' : 'oes'} · taxa media {commissionRate}%
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'center', minWidth: 100 }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total comissao</div>
                                            <div style={{ fontWeight: 700, color: '#c4a84b' }}>{formatCurrency(broker.total_commission_amount)}</div>
                                        </div>
                                        <div style={{ textAlign: 'center', minWidth: 100 }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pago</div>
                                            <div style={{ fontWeight: 700, color: '#22c55e' }}>{formatCurrency(broker.paid_commission_amount)}</div>
                                        </div>
                                        <div style={{ textAlign: 'center', minWidth: 100 }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pendente</div>
                                            <div style={{ fontWeight: 700, color: broker.pending_commission_amount > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
                                                {formatCurrency(broker.pending_commission_amount)}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'center', minWidth: 100 }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Volume vendas</div>
                                            <div style={{ fontWeight: 700 }}>{formatCurrency(broker.total_sale_amount)}</div>
                                        </div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            {isExpanded ? '▲' : '▼'}
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div style={{ marginTop: 14, borderTop: '1px solid rgba(148,163,184,0.2)', paddingTop: 12 }}>
                                            {broker.commissions.length === 0 ? (
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sem detalhes.</div>
                                            ) : (
                                                <div style={{ overflowX: 'auto' }}>
                                                    <table className="data-table">
                                                        <thead>
                                                            <tr>
                                                                <th>Data</th>
                                                                <th>Venda (R$)</th>
                                                                <th>Comissao (R$)</th>
                                                                <th>Status</th>
                                                                <th>Vencimento</th>
                                                                <th>Pago em</th>
                                                                <th>Referencia</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {broker.commissions.map(c => (
                                                                <tr key={c.id}>
                                                                    <td>{formatDate(c.created_at)}</td>
                                                                    <td style={{ fontWeight: 700 }}>{formatCurrency(c.sale_amount)}</td>
                                                                    <td style={{ fontWeight: 700, color: '#c4a84b' }}>{formatCurrency(c.commission_amount)}</td>
                                                                    <td>
                                                                        <span style={{ color: statusColor(c.status), fontWeight: 600, fontSize: '0.82rem' }}>
                                                                            {STATUS_LABELS[c.status] || c.status}
                                                                        </span>
                                                                    </td>
                                                                    <td>{formatDate(c.due_date)}</td>
                                                                    <td>{formatDate(c.paid_at)}</td>
                                                                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                                        {c.source_ref_type ? `${c.source_ref_type}${c.source_ref_id ? ` #${c.source_ref_id.slice(0, 8)}` : ''}` : '-'}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
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
            `}</style>
        </div>
    )
}
