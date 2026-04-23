'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart3, RefreshCw } from 'lucide-react'

interface DreSummary {
    total_income: number
    total_expense: number
    net_result: number
    margin_pct: number
}

interface DreCategoryRow {
    category: string
    total: number
}

interface DreMonthlyRow {
    month: string
    income: number
    expense: number
    net: number
}

interface DreTopExpenseRow {
    id: string
    date: string
    description: string
    category: string
    amount: number
}

interface DreResponseData {
    summary: DreSummary
    income_by_category: DreCategoryRow[]
    expense_by_category: DreCategoryRow[]
    monthly: DreMonthlyRow[]
    top_expense_entries: DreTopExpenseRow[]
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

function formatMonth(month: string) {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) return month
    const [year, m] = month.split('-')
    return `${m}/${year}`
}

function widthPct(value: number, max: number) {
    if (max <= 0) return '0%'
    return `${Math.max(4, (value / max) * 100).toFixed(1)}%`
}

export default function FinanceDreGerencialPage() {
    const [loading, setLoading] = useState(true)
    const [startDate, setStartDate] = useState(firstDayOfMonthISO())
    const [endDate, setEndDate] = useState(todayISO())
    const [data, setData] = useState<DreResponseData | null>(null)
    const [toast, setToast] = useState<ToastState | null>(null)

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    const fetchReport = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                report: 'dre',
                start_date: startDate,
                end_date: endDate,
            })
            const res = await fetch(`/api/admin/finance/reports?${params.toString()}`)
            const payload = await res.json()
            if (!res.ok || !payload.success) {
                throw new Error(payload.error || 'Erro ao carregar DRE gerencial')
            }
            setData(payload.data || null)
        } catch (err: any) {
            showToast(err.message || 'Erro ao carregar DRE gerencial', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchReport()
    }, [])

    const maxExpenseCategory = useMemo(() => {
        const values = data?.expense_by_category || []
        return values.reduce((max, item) => Math.max(max, Number(item.total || 0)), 0)
    }, [data?.expense_by_category])

    const maxIncomeCategory = useMemo(() => {
        const values = data?.income_by_category || []
        return values.reduce((max, item) => Math.max(max, Number(item.total || 0)), 0)
    }, [data?.income_by_category])

    return (
        <div style={{ padding: '24px 18px 36px' }}>
            {toast ? <div className={`admin-toast ${toast.type}`}>{toast.msg}</div> : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BarChart3 size={26} /> DRE Gerencial
                    </h1>
                    <p style={{ marginTop: 6, color: 'var(--text-muted)' }}>
                        Demonstrativo consolidado de receitas, despesas e resultado por periodo.
                    </p>
                </div>
                <button className="btn btn-outline" onClick={fetchReport} disabled={loading}>
                    <RefreshCw size={16} style={{ marginRight: 6 }} /> Atualizar
                </button>
            </div>

            <div className="chart-card" style={{ marginBottom: 14 }}>
                <div className="chart-title">Filtro de periodo</div>
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
                        <button className="btn btn-gold" onClick={fetchReport} disabled={loading}>
                            Recalcular DRE
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
                            <div className="kpi-label">Receitas</div>
                            <div className="kpi-value" style={{ color: '#22c55e' }}>{formatCurrency(data.summary.total_income)}</div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-label">Despesas</div>
                            <div className="kpi-value" style={{ color: '#ef4444' }}>{formatCurrency(data.summary.total_expense)}</div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-label">Resultado</div>
                            <div className="kpi-value" style={{ color: data.summary.net_result >= 0 ? '#22c55e' : '#ef4444' }}>
                                {formatCurrency(data.summary.net_result)}
                            </div>
                        </div>
                        <div className="kpi-card">
                            <div className="kpi-label">Margem</div>
                            <div className="kpi-value">{Number(data.summary.margin_pct || 0).toFixed(2)}%</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                        <div className="chart-card">
                            <div className="chart-title" style={{ marginBottom: 10 }}>Receitas por categoria</div>
                            {data.income_by_category.length === 0 ? (
                                <div style={{ color: 'var(--text-muted)' }}>Sem receitas no periodo.</div>
                            ) : (
                                <div style={{ display: 'grid', gap: 8 }}>
                                    {data.income_by_category.map(item => (
                                        <div key={`inc-${item.category}`}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: 4 }}>
                                                <span>{item.category}</span>
                                                <strong>{formatCurrency(item.total)}</strong>
                                            </div>
                                            <div style={{ height: 8, borderRadius: 999, background: 'rgba(148,163,184,0.2)', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: widthPct(item.total, maxIncomeCategory), background: 'rgba(34,197,94,0.65)' }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="chart-card">
                            <div className="chart-title" style={{ marginBottom: 10 }}>Despesas por categoria</div>
                            {data.expense_by_category.length === 0 ? (
                                <div style={{ color: 'var(--text-muted)' }}>Sem despesas no periodo.</div>
                            ) : (
                                <div style={{ display: 'grid', gap: 8 }}>
                                    {data.expense_by_category.map(item => (
                                        <div key={`exp-${item.category}`}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: 4 }}>
                                                <span>{item.category}</span>
                                                <strong>{formatCurrency(item.total)}</strong>
                                            </div>
                                            <div style={{ height: 8, borderRadius: 999, background: 'rgba(148,163,184,0.2)', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: widthPct(item.total, maxExpenseCategory), background: 'rgba(239,68,68,0.65)' }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="chart-card" style={{ marginBottom: 14 }}>
                        <div className="chart-title" style={{ marginBottom: 10 }}>Evolucao mensal</div>
                        {data.monthly.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)' }}>Sem movimentacao mensal.</div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Mes</th>
                                            <th>Receitas</th>
                                            <th>Despesas</th>
                                            <th>Resultado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.monthly.map(row => (
                                            <tr key={row.month}>
                                                <td>{formatMonth(row.month)}</td>
                                                <td style={{ color: '#22c55e', fontWeight: 700 }}>{formatCurrency(row.income)}</td>
                                                <td style={{ color: '#ef4444', fontWeight: 700 }}>{formatCurrency(row.expense)}</td>
                                                <td style={{ color: row.net >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{formatCurrency(row.net)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="chart-card">
                        <div className="chart-title" style={{ marginBottom: 10 }}>Top despesas do periodo</div>
                        {data.top_expense_entries.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)' }}>Sem despesas para destacar.</div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Data</th>
                                            <th>Descricao</th>
                                            <th>Categoria</th>
                                            <th>Valor</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.top_expense_entries.map(row => (
                                            <tr key={row.id}>
                                                <td>{formatDate(row.date)}</td>
                                                <td>{row.description}</td>
                                                <td>{row.category}</td>
                                                <td style={{ color: '#ef4444', fontWeight: 700 }}>{formatCurrency(row.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
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
                @media (max-width: 860px) {
                    .chart-card > div[style*="grid-template-columns: 1fr 1fr"] {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </div>
    )
}

