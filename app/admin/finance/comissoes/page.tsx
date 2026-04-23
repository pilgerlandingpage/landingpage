'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CircleDollarSign, Percent, Plus, RefreshCw, Trash2, X } from 'lucide-react'

type RuleCalcType = 'percentage' | 'fixed'
type RuleBasisType = 'sale_value' | 'net_revenue'
type CommissionStatus = 'calculated' | 'approved' | 'released' | 'paid' | 'contested' | 'reversed'
type BrokerSource = 'admin_user' | 'virtual_broker'

interface CommissionRule {
    id: string
    name: string
    is_active: boolean
    applies_to: string | null
    basis_type: RuleBasisType
    calc_type: RuleCalcType
    percentage: number | null
    fixed_amount: number | null
    min_sale_amount: number | null
    max_sale_amount: number | null
    split_payload: unknown
    notes: string | null
}

interface CommissionRow {
    id: string
    rule_id: string | null
    broker_user_id: string | null
    broker_name: string | null
    sale_amount: number | null
    commission_base: number | null
    commission_amount: number
    status: CommissionStatus
    due_date: string | null
    paid_at: string | null
    payment_entry_id: string | null
    cost_center_id: string | null
    source_ref_type: string | null
    source_ref_id: string | null
    notes: string | null
    rule?: { id: string; name: string } | null
    broker?: { id: string; name: string } | null
    cost_center?: { id: string; name: string; code: string | null } | null
}

interface BrokerOption {
    id: string
    name: string
    source: BrokerSource
}

interface CostCenterOption {
    id: string
    name: string
    code: string | null
}

interface PreviewResult {
    rule: { id: string; name: string }
    sale_amount: number
    commission_base: number
    commission_amount: number
    effective_percentage: number | null
    split_breakdown?: Array<{
        index: number
        broker_user_id: string | null
        broker_name: string | null
        participant_type: string | null
        mode: 'percentage' | 'amount' | null
        amount: number
        percentage: number | null
    }>
}

interface ToastState {
    msg: string
    type: 'success' | 'error'
}

function formatCurrency(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(date: string | null | undefined) {
    if (!date) return '-'
    const safeDate = date.length > 10 ? date.slice(0, 10) : date
    return new Date(`${safeDate}T00:00:00`).toLocaleDateString('pt-BR')
}

function todayISO() {
    return new Date().toISOString().slice(0, 10)
}

function splitParticipantsCount(raw: unknown): number {
    if (Array.isArray(raw)) return raw.length
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw)
            return Array.isArray(parsed) ? parsed.length : 0
        } catch {
            return 0
        }
    }
    return 0
}

function translateStatus(status: CommissionStatus) {
    if (status === 'approved') return 'Aprovada'
    if (status === 'released') return 'Liberada'
    if (status === 'paid') return 'Paga'
    if (status === 'contested') return 'Contestada'
    if (status === 'reversed') return 'Revertida'
    return 'Calculada'
}

function statusBadgeStyle(status: CommissionStatus) {
    if (status === 'paid') return { color: '#22c55e', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }
    if (status === 'approved' || status === 'released') return { color: '#3b82f6', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)' }
    if (status === 'contested' || status === 'reversed') return { color: '#ef4444', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }
    return { color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }
}

function FinanceCommissionsPageContent() {
    const searchParams = useSearchParams()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [rules, setRules] = useState<CommissionRule[]>([])
    const [commissions, setCommissions] = useState<CommissionRow[]>([])
    const [brokers, setBrokers] = useState<BrokerOption[]>([])
    const [costCenters, setCostCenters] = useState<CostCenterOption[]>([])
    const [statusFilter, setStatusFilter] = useState<'all' | CommissionStatus>('all')
    const [toast, setToast] = useState<ToastState | null>(null)
    const [preview, setPreview] = useState<PreviewResult | null>(null)
    const [updatingCommissionId, setUpdatingCommissionId] = useState<string | null>(null)
    const highlightedCommissionId = useMemo(() => {
        const commissionId = String(searchParams?.get('commission_id') || '').trim()
        return commissionId || null
    }, [searchParams])

    const [ruleForm, setRuleForm] = useState({
        name: '',
        basis_type: 'sale_value' as RuleBasisType,
        calc_type: 'percentage' as RuleCalcType,
        percentage: '5',
        fixed_amount: '',
        min_sale_amount: '',
        max_sale_amount: '',
        applies_to: '',
        notes: '',
    })

    const [calcForm, setCalcForm] = useState({
        rule_id: '',
        sale_amount: '',
        commission_base: '',
        broker_source: 'admin_user' as BrokerSource,
        broker_user_id: '',
        broker_name: '',
        due_date: todayISO(),
        source_ref_type: 'sale',
        source_ref_id: '',
        cost_center_id: '',
        notes: '',
    })

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3500)
    }

    const fetchData = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (statusFilter !== 'all') params.set('status', statusFilter)
            params.set('limit', '2000')
            const [commRes, lookupsRes] = await Promise.all([
                fetch(`/api/admin/finance/commissions?${params.toString()}`),
                fetch('/api/admin/finance/lookups'),
            ])

            const commData = await commRes.json()
            if (!commRes.ok || !commData.success) {
                throw new Error(commData.error || 'Erro ao carregar comissoes')
            }

            const lookupsData = await lookupsRes.json()
            if (!lookupsRes.ok || !lookupsData.success) {
                throw new Error(lookupsData.error || 'Erro ao carregar centros de custo')
            }

            setRules(commData.rules || [])
            setCommissions(commData.commissions || [])
            setBrokers(commData.brokers || [])
            setCostCenters(lookupsData.cost_centers || [])
            if (!calcForm.rule_id && Array.isArray(commData.rules) && commData.rules.length > 0) {
                setCalcForm(prev => ({ ...prev, rule_id: commData.rules[0].id }))
            }
        } catch (err: any) {
            showToast(err.message || 'Erro ao carregar dados de comissoes', 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [statusFilter])

    const selectedRule = useMemo(
        () => rules.find(rule => rule.id === calcForm.rule_id) || null,
        [rules, calcForm.rule_id],
    )

    const brokerOptionsBySource = useMemo(
        () => brokers.filter(broker => broker.source === calcForm.broker_source),
        [brokers, calcForm.broker_source],
    )

    const brokerNameFallback = useMemo(
        () => brokers.find(broker => broker.id === calcForm.broker_user_id)?.name || '',
        [brokers, calcForm.broker_user_id],
    )

    const summary = useMemo(() => {
        let calculated = 0
        let approved = 0
        let released = 0
        let paid = 0
        for (const row of commissions) {
            if (row.status === 'calculated') calculated += Number(row.commission_amount || 0)
            else if (row.status === 'approved') approved += Number(row.commission_amount || 0)
            else if (row.status === 'released') released += Number(row.commission_amount || 0)
            else if (row.status === 'paid') paid += Number(row.commission_amount || 0)
        }

        return {
            count: commissions.length,
            calculated,
            approved,
            released,
            paid,
        }
    }, [commissions])

    const hasHighlightedCommissionInList = useMemo(() => {
        if (!highlightedCommissionId) return false
        return commissions.some(row => row.id === highlightedCommissionId)
    }, [commissions, highlightedCommissionId])

    useEffect(() => {
        if (!highlightedCommissionId || loading || !hasHighlightedCommissionInList) return

        const timeout = window.setTimeout(() => {
            const row = document.getElementById(`commission-row-${highlightedCommissionId}`)
            if (!row) return
            row.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 120)

        return () => window.clearTimeout(timeout)
    }, [highlightedCommissionId, loading, hasHighlightedCommissionInList])

    const onCreateRule = async () => {
        if (!ruleForm.name.trim()) {
            showToast('Informe o nome da regra', 'error')
            return
        }

        setSaving(true)
        try {
            const payload = {
                entity: 'rule',
                name: ruleForm.name.trim(),
                basis_type: ruleForm.basis_type,
                calc_type: ruleForm.calc_type,
                percentage: ruleForm.calc_type === 'percentage' ? Number(ruleForm.percentage || 0) : null,
                fixed_amount: ruleForm.calc_type === 'fixed' ? Number(ruleForm.fixed_amount || 0) : null,
                min_sale_amount: ruleForm.min_sale_amount ? Number(ruleForm.min_sale_amount) : null,
                max_sale_amount: ruleForm.max_sale_amount ? Number(ruleForm.max_sale_amount) : null,
                split_payload: null,
                applies_to: ruleForm.applies_to || null,
                notes: ruleForm.notes || null,
            }

            const res = await fetch('/api/admin/finance/commissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Erro ao criar regra')
            }

            showToast('Regra de comissão cadastrada', 'success')
            setRuleForm({
                name: '',
                basis_type: 'sale_value',
                calc_type: 'percentage',
                percentage: '5',
                fixed_amount: '',
                min_sale_amount: '',
                max_sale_amount: '',
                applies_to: '',
                notes: '',
            })
            await fetchData()
        } catch (err: any) {
            showToast(err.message || 'Erro ao criar regra', 'error')
        } finally {
            setSaving(false)
        }
    }

    const onDeleteRule = async (id: string) => {
        if (!window.confirm('Deseja remover esta regra de comissão?')) return
        try {
            const res = await fetch(`/api/admin/finance/commissions?entity=rule&id=${id}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Erro ao remover regra')
            }
            showToast('Regra removida', 'success')
            await fetchData()
        } catch (err: any) {
            showToast(err.message || 'Erro ao remover regra', 'error')
        }
    }

    const onToggleRuleActive = async (rule: CommissionRule) => {
        try {
            const res = await fetch('/api/admin/finance/commissions', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entity: 'rule',
                    id: rule.id,
                    name: rule.name,
                    basis_type: rule.basis_type,
                    calc_type: rule.calc_type,
                    percentage: rule.percentage,
                    fixed_amount: rule.fixed_amount,
                    min_sale_amount: rule.min_sale_amount,
                    max_sale_amount: rule.max_sale_amount,
                    split_payload: rule.split_payload,
                    applies_to: rule.applies_to,
                    notes: rule.notes,
                    is_active: !rule.is_active,
                }),
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao atualizar regra')
            showToast('Status da regra atualizado', 'success')
            await fetchData()
        } catch (err: any) {
            showToast(err.message || 'Erro ao atualizar regra', 'error')
        }
    }

    const buildCalculatePayload = (createRecord: boolean) => ({
        entity: 'calculate',
        create_record: createRecord,
        rule_id: calcForm.rule_id,
        sale_amount: Number(calcForm.sale_amount || 0),
        commission_base: calcForm.commission_base ? Number(calcForm.commission_base) : null,
        broker_user_id: calcForm.broker_source === 'admin_user' ? (calcForm.broker_user_id || null) : null,
        broker_name: calcForm.broker_name.trim() || brokerNameFallback || null,
        due_date: calcForm.due_date || null,
        source_ref_type: calcForm.source_ref_type || null,
        source_ref_id: calcForm.source_ref_id || null,
        cost_center_id: calcForm.cost_center_id || null,
        notes: calcForm.notes || null,
    })

    const onCalculatePreview = async () => {
        if (!calcForm.rule_id) {
            showToast('Selecione uma regra', 'error')
            return
        }
        if (!calcForm.sale_amount || Number(calcForm.sale_amount) <= 0) {
            showToast('Informe o valor da venda', 'error')
            return
        }
        if (calcForm.broker_source === 'admin_user' && !calcForm.broker_user_id && !calcForm.broker_name.trim()) {
            showToast('Selecione o corretor ou informe o nome', 'error')
            return
        }

        setSaving(true)
        try {
            const res = await fetch('/api/admin/finance/commissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildCalculatePayload(false)),
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao calcular comissão')
            setPreview(data.preview || null)
            showToast('Prévia calculada com sucesso', 'success')
        } catch (err: any) {
            showToast(err.message || 'Erro ao calcular comissão', 'error')
        } finally {
            setSaving(false)
        }
    }

    const onCreateCommissionFromPreview = async () => {
        if (!calcForm.rule_id) {
            showToast('Selecione uma regra', 'error')
            return
        }
        if (!calcForm.sale_amount || Number(calcForm.sale_amount) <= 0) {
            showToast('Informe o valor da venda', 'error')
            return
        }
        if (calcForm.broker_source === 'admin_user' && !calcForm.broker_user_id && !calcForm.broker_name.trim()) {
            showToast('Selecione o corretor ou informe o nome', 'error')
            return
        }

        setSaving(true)
        try {
            const res = await fetch('/api/admin/finance/commissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildCalculatePayload(true)),
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao apurar comissão')

            showToast('Comissão apurada e salva', 'success')
            setPreview(data.preview || null)
            setCalcForm(prev => ({
                ...prev,
                sale_amount: '',
                commission_base: '',
                source_ref_id: '',
                notes: '',
            }))
            await fetchData()
        } catch (err: any) {
            showToast(err.message || 'Erro ao apurar comissão', 'error')
        } finally {
            setSaving(false)
        }
    }

    const onSetCommissionStatus = async (row: CommissionRow, status: CommissionStatus) => {
        setUpdatingCommissionId(row.id)
        try {
            const payload = {
                entity: 'commission',
                id: row.id,
                rule_id: row.rule_id,
                broker_user_id: row.broker_user_id,
                broker_name: row.broker_name || row.broker?.name || null,
                sale_amount: row.sale_amount,
                commission_base: row.commission_base,
                commission_amount: row.commission_amount,
                status,
                due_date: row.due_date,
                cost_center_id: row.cost_center_id,
                source_ref_type: row.source_ref_type,
                source_ref_id: row.source_ref_id,
                payment_entry_id: row.payment_entry_id,
                paid_at: row.paid_at,
                notes: row.notes,
            }

            const res = await fetch('/api/admin/finance/commissions', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao atualizar status')

            showToast('Status da comissão atualizado', 'success')
            await fetchData()
        } catch (err: any) {
            showToast(err.message || 'Erro ao atualizar status', 'error')
        } finally {
            setUpdatingCommissionId(null)
        }
    }

    const onDeleteCommission = async (id: string) => {
        if (!window.confirm('Deseja remover esta comissão?')) return
        try {
            const res = await fetch(`/api/admin/finance/commissions?entity=commission&id=${id}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao remover comissão')
            showToast('Comissão removida', 'success')
            await fetchData()
        } catch (err: any) {
            showToast(err.message || 'Erro ao remover comissão', 'error')
        }
    }

    return (
        <div>
            {toast && <div className={`admin-toast ${toast.type}`}>{toast.msg}</div>}

            <div className="admin-header">
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <CircleDollarSign size={28} /> Comissões de Corretores
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
                        Cadastre regras, calcule e apure comissões de venda com rastreio financeiro.
                    </p>
                </div>
                <div className="admin-header-actions">
                    <button className="btn btn-outline" onClick={fetchData} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spin' : ''} /> Atualizar
                    </button>
                </div>
            </div>

            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 18 }}>
                <div className="kpi-card">
                    <div className="kpi-label">Comissões</div>
                    <div className="kpi-value">{summary.count}</div>
                    <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>total de lançamentos</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Calculadas</div>
                    <div className="kpi-value" style={{ color: '#f59e0b' }}>{formatCurrency(summary.calculated)}</div>
                    <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>aguardando aprovação</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Aprovadas/Liberadas</div>
                    <div className="kpi-value" style={{ color: '#3b82f6' }}>{formatCurrency(summary.approved + summary.released)}</div>
                    <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>prontas para pagamento</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Pagas</div>
                    <div className="kpi-value" style={{ color: '#22c55e' }}>{formatCurrency(summary.paid)}</div>
                    <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>quitadas</div>
                </div>
            </div>

            <div className="chart-card" style={{ marginBottom: 18 }}>
                <div className="chart-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Percent size={16} /> Nova regra de comissão
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    <div>
                        <label className="form-label">Nome da regra</label>
                        <input className="form-input" value={ruleForm.name} onChange={e => setRuleForm(prev => ({ ...prev, name: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Base</label>
                        <select className="form-input" value={ruleForm.basis_type} onChange={e => setRuleForm(prev => ({ ...prev, basis_type: e.target.value as RuleBasisType }))}>
                            <option value="sale_value">Valor de venda</option>
                            <option value="net_revenue">Receita líquida</option>
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Tipo de cálculo</label>
                        <select className="form-input" value={ruleForm.calc_type} onChange={e => setRuleForm(prev => ({ ...prev, calc_type: e.target.value as RuleCalcType }))}>
                            <option value="percentage">Percentual</option>
                            <option value="fixed">Valor fixo</option>
                        </select>
                    </div>
                    {ruleForm.calc_type === 'percentage' ? (
                        <div>
                            <label className="form-label">% comissão</label>
                            <input className="form-input" type="number" step="0.01" min="0" value={ruleForm.percentage} onChange={e => setRuleForm(prev => ({ ...prev, percentage: e.target.value }))} />
                        </div>
                    ) : (
                        <div>
                            <label className="form-label">Valor fixo (R$)</label>
                            <input className="form-input" type="number" step="0.01" min="0" value={ruleForm.fixed_amount} onChange={e => setRuleForm(prev => ({ ...prev, fixed_amount: e.target.value }))} />
                        </div>
                    )}
                    <div>
                        <label className="form-label">Mínimo venda</label>
                        <input className="form-input" type="number" step="0.01" min="0" value={ruleForm.min_sale_amount} onChange={e => setRuleForm(prev => ({ ...prev, min_sale_amount: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Máximo venda</label>
                        <input className="form-input" type="number" step="0.01" min="0" value={ruleForm.max_sale_amount} onChange={e => setRuleForm(prev => ({ ...prev, max_sale_amount: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Aplica-se a</label>
                        <input className="form-input" value={ruleForm.applies_to} onChange={e => setRuleForm(prev => ({ ...prev, applies_to: e.target.value }))} placeholder="Ex: venda, locacao, empreendimento X" />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Observações</label>
                        <textarea className="form-textarea" rows={2} value={ruleForm.notes} onChange={e => setRuleForm(prev => ({ ...prev, notes: e.target.value }))} />
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                    <button className="btn btn-gold" onClick={onCreateRule} disabled={saving}>
                        <Plus size={16} /> {saving ? 'Salvando...' : 'Salvar regra'}
                    </button>
                </div>
            </div>

            <div className="chart-card" style={{ marginBottom: 18 }}>
                <div className="chart-title" style={{ marginBottom: 12 }}>Regras ativas/inativas</div>
                {rules.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)' }}>Nenhuma regra cadastrada.</div>
                ) : (
                    <div className="chip-wrap">
                        {rules.map(rule => (
                            <span key={rule.id} className="lookup-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                <strong>{rule.name}</strong>
                                <span>{rule.calc_type === 'percentage' ? `${Number(rule.percentage || 0)}%` : formatCurrency(Number(rule.fixed_amount || 0))}</span>
                                {splitParticipantsCount(rule.split_payload) > 0 && (
                                    <span style={{ color: '#22c55e', fontWeight: 700 }}>
                                        split {splitParticipantsCount(rule.split_payload)}
                                    </span>
                                )}
                                <span style={{ opacity: 0.8 }}>{rule.is_active ? 'ativa' : 'inativa'}</span>
                                <button onClick={() => onToggleRuleActive(rule)} title={rule.is_active ? 'Desativar' : 'Ativar'}>
                                    <RefreshCw size={12} />
                                </button>
                                <button onClick={() => onDeleteRule(rule.id)} title="Remover regra">
                                    <X size={12} />
                                </button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="chart-card" style={{ marginBottom: 18 }}>
                <div className="chart-title" style={{ marginBottom: 12 }}>Apuração de comissão (manual assistida)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    <div>
                        <label className="form-label">Regra</label>
                        <select className="form-input" value={calcForm.rule_id} onChange={e => setCalcForm(prev => ({ ...prev, rule_id: e.target.value }))}>
                            <option value="">Selecione</option>
                            {rules.map(rule => (
                                <option key={rule.id} value={rule.id}>{rule.name} {rule.is_active ? '' : '(inativa)'}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Valor da venda (R$)</label>
                        <input className="form-input" type="number" step="0.01" min="0" value={calcForm.sale_amount} onChange={e => setCalcForm(prev => ({ ...prev, sale_amount: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Base comissão (opcional)</label>
                        <input className="form-input" type="number" step="0.01" min="0" value={calcForm.commission_base} onChange={e => setCalcForm(prev => ({ ...prev, commission_base: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Fonte corretor</label>
                        <select className="form-input" value={calcForm.broker_source} onChange={e => setCalcForm(prev => ({ ...prev, broker_source: e.target.value as BrokerSource, broker_user_id: '' }))}>
                            <option value="admin_user">Usuário admin</option>
                            <option value="virtual_broker">Corretor IA</option>
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Corretor</label>
                        <select className="form-input" value={calcForm.broker_user_id} onChange={e => setCalcForm(prev => ({ ...prev, broker_user_id: e.target.value }))}>
                            <option value="">Selecione</option>
                            {brokerOptionsBySource.map(broker => (
                                <option key={broker.id} value={broker.id}>{broker.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Nome corretor (fallback)</label>
                        <input className="form-input" value={calcForm.broker_name} onChange={e => setCalcForm(prev => ({ ...prev, broker_name: e.target.value }))} placeholder="Usado se não houver vínculo admin" />
                    </div>
                    <div>
                        <label className="form-label">Vencimento</label>
                        <input className="form-input" type="date" value={calcForm.due_date} onChange={e => setCalcForm(prev => ({ ...prev, due_date: e.target.value }))} />
                    </div>
                    <div>
                        <label className="form-label">Centro de custo</label>
                        <select className="form-input" value={calcForm.cost_center_id} onChange={e => setCalcForm(prev => ({ ...prev, cost_center_id: e.target.value }))}>
                            <option value="">Não informado</option>
                            {costCenters.map(center => (
                                <option key={center.id} value={center.id}>{center.name}{center.code ? ` (${center.code})` : ''}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Tipo referência</label>
                        <input className="form-input" value={calcForm.source_ref_type} onChange={e => setCalcForm(prev => ({ ...prev, source_ref_type: e.target.value }))} placeholder="sale / venda / deal / contrato" />
                    </div>
                    <div>
                        <label className="form-label">ID referência</label>
                        <input className="form-input" value={calcForm.source_ref_id} onChange={e => setCalcForm(prev => ({ ...prev, source_ref_id: e.target.value }))} placeholder="UUID do lead fechado/convertido" />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Observações</label>
                        <textarea className="form-textarea" rows={2} value={calcForm.notes} onChange={e => setCalcForm(prev => ({ ...prev, notes: e.target.value }))} />
                    </div>
                </div>

                {preview && (
                    <div style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 10,
                        border: '1px solid rgba(59,130,246,0.25)',
                        background: 'rgba(59,130,246,0.08)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: 8,
                    }}>
                        <div><strong>Regra:</strong> {preview.rule.name}</div>
                        <div><strong>Venda:</strong> {formatCurrency(preview.sale_amount)}</div>
                        <div><strong>Base:</strong> {formatCurrency(preview.commission_base)}</div>
                        <div><strong>Comissão:</strong> {formatCurrency(preview.commission_amount)}</div>
                        <div><strong>Percentual efetivo:</strong> {preview.effective_percentage !== null ? `${preview.effective_percentage.toFixed(2)}%` : '-'}</div>
                        {Array.isArray(preview.split_breakdown) && preview.split_breakdown.length > 0 && (
                            <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                                <strong>Split:</strong>{' '}
                                {preview.split_breakdown.map(item => {
                                    const name = item.broker_name || item.broker_user_id || `Participante ${item.index}`
                                    return `${name}: ${formatCurrency(Number(item.amount || 0))}`
                                }).join(' | ')}
                            </div>
                        )}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, gap: 8 }}>
                    <button className="btn btn-outline" onClick={onCalculatePreview} disabled={saving}>
                        {saving ? 'Calculando...' : 'Calcular prévia'}
                    </button>
                    <button className="btn btn-gold" onClick={onCreateCommissionFromPreview} disabled={saving}>
                        {saving ? 'Apurando...' : 'Apurar e salvar'}
                    </button>
                </div>
                {selectedRule && (
                    <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Regra selecionada: {selectedRule.name} ({selectedRule.calc_type === 'percentage' ? `${Number(selectedRule.percentage || 0)}%` : formatCurrency(Number(selectedRule.fixed_amount || 0))})
                    </div>
                )}
            </div>

            <div className="chart-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
                    <div className="chart-title">Comissões apuradas</div>
                    <div style={{ width: 220 }}>
                        <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | CommissionStatus)}>
                            <option value="all">Todos os status</option>
                            <option value="calculated">Calculada</option>
                            <option value="approved">Aprovada</option>
                            <option value="released">Liberada</option>
                            <option value="paid">Paga</option>
                            <option value="contested">Contestada</option>
                            <option value="reversed">Revertida</option>
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: 24, color: 'var(--text-muted)' }}>Carregando comissões...</div>
                ) : commissions.length === 0 ? (
                    <div style={{ padding: 24, color: 'var(--text-muted)' }}>Nenhuma comissão encontrada.</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        {highlightedCommissionId && (
                            <div style={{
                                marginBottom: 10,
                                padding: '8px 10px',
                                borderRadius: 8,
                                border: hasHighlightedCommissionInList
                                    ? '1px solid rgba(34,197,94,0.28)'
                                    : '1px solid rgba(245,158,11,0.28)',
                                background: hasHighlightedCommissionInList
                                    ? 'rgba(34,197,94,0.08)'
                                    : 'rgba(245,158,11,0.08)',
                                color: hasHighlightedCommissionInList ? '#16a34a' : '#b45309',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                            }}>
                                {hasHighlightedCommissionInList
                                    ? 'Comissao de origem destacada abaixo.'
                                    : 'Comissao informada nao encontrada na listagem atual.'}
                            </div>
                        )}
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Regra</th>
                                    <th>Corretor</th>
                                    <th>Venda</th>
                                    <th>Base</th>
                                    <th>Comissão</th>
                                    <th>Status</th>
                                    <th>Vencimento</th>
                                    <th>Centro custo</th>
                                    <th>Referência</th>
                                    <th>Lanç. financeiro</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {commissions.map(row => {
                                    const isUpdating = updatingCommissionId === row.id
                                    const isHighlighted = highlightedCommissionId === row.id
                                    return (
                                        <tr
                                            key={row.id}
                                            id={`commission-row-${row.id}`}
                                            style={isHighlighted ? {
                                                background: 'rgba(34,197,94,0.12)',
                                                boxShadow: 'inset 0 0 0 1px rgba(34,197,94,0.35)',
                                            } : undefined}
                                        >
                                            <td>{row.rule?.name || '-'}</td>
                                            <td>{row.broker_name || row.broker?.name || '-'}</td>
                                            <td>{row.sale_amount ? formatCurrency(Number(row.sale_amount)) : '-'}</td>
                                            <td>{row.commission_base ? formatCurrency(Number(row.commission_base)) : '-'}</td>
                                            <td style={{ color: '#22c55e', fontWeight: 700 }}>{formatCurrency(Number(row.commission_amount || 0))}</td>
                                            <td>
                                                <span style={{ borderRadius: 999, padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, ...statusBadgeStyle(row.status) }}>
                                                    {translateStatus(row.status)}
                                                </span>
                                            </td>
                                            <td>{formatDate(row.due_date)}</td>
                                            <td>{row.cost_center?.name || '-'}</td>
                                            <td>{row.source_ref_type || '-'} {row.source_ref_id ? `#${row.source_ref_id}` : ''}</td>
                                            <td>
                                                {row.payment_entry_id ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                        <span style={{ color: '#22c55e', fontWeight: 700 }}>
                                                            {row.payment_entry_id.slice(0, 8)}...
                                                        </span>
                                                        <Link
                                                            href={`/admin/finance/lancamentos?entry_id=${encodeURIComponent(row.payment_entry_id)}`}
                                                            className="btn btn-outline"
                                                            style={{ padding: '4px 8px', fontSize: '0.72rem', textDecoration: 'none' }}
                                                        >
                                                            Abrir
                                                        </Link>
                                                    </div>
                                                ) : (
                                                    '-'
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                    {row.status !== 'approved' && (
                                                        <button type="button" className="btn btn-outline" style={{ padding: '6px 10px', fontSize: '0.74rem' }} onClick={() => onSetCommissionStatus(row, 'approved')} disabled={isUpdating}>
                                                            Aprovar
                                                        </button>
                                                    )}
                                                    {row.status !== 'released' && (
                                                        <button type="button" className="btn btn-outline" style={{ padding: '6px 10px', fontSize: '0.74rem' }} onClick={() => onSetCommissionStatus(row, 'released')} disabled={isUpdating}>
                                                            Liberar
                                                        </button>
                                                    )}
                                                    {row.status !== 'paid' && (
                                                        <button type="button" className="btn btn-gold" style={{ padding: '6px 10px', fontSize: '0.74rem' }} onClick={() => onSetCommissionStatus(row, 'paid')} disabled={isUpdating}>
                                                            Pagar
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => onDeleteCommission(row.id)}
                                                        style={{
                                                            border: '1px solid rgba(239,68,68,0.25)',
                                                            background: 'rgba(239,68,68,0.1)',
                                                            color: '#ef4444',
                                                            borderRadius: 8,
                                                            padding: '6px 8px',
                                                            cursor: 'pointer',
                                                        }}
                                                        title="Excluir comissão"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
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
                .lookup-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 5px 8px;
                    border-radius: 999px;
                    font-size: 0.75rem;
                    border: 1px solid rgba(148, 163, 184, 0.35);
                    background: rgba(148, 163, 184, 0.08);
                }
                .lookup-chip button {
                    border: 0;
                    background: transparent;
                    color: inherit;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    padding: 0;
                }
                .chip-wrap {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    max-height: 150px;
                    overflow: auto;
                    padding-right: 2px;
                }
                .spin {
                    animation: financeSpin 1s linear infinite;
                }
                @keyframes financeSpin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}

function FinanceCommissionsPageFallback() {
    return (
        <div style={{ padding: '24px 18px 36px' }}>
            <div className="chart-card" style={{ color: 'var(--text-muted)' }}>
                Carregando comissoes...
            </div>
        </div>
    )
}

export default function FinanceCommissionsPage() {
    return (
        <Suspense fallback={<FinanceCommissionsPageFallback />}>
            <FinanceCommissionsPageContent />
        </Suspense>
    )
}



