'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import {
    ArrowDownCircle,
    ArrowUpCircle,
    CalendarDays,
    CircleDollarSign,
    Landmark,
    Link2,
    Plus,
    RefreshCw,
    Trash2,
    Wallet,
    X,
} from 'lucide-react'
import {
    Area,
    AreaChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'

type EntryType = 'income' | 'expense'
type PaymentStatus = 'paid' | 'pending' | 'cancelled'
type CounterpartyType = 'pessoa_fisica' | 'pessoa_juridica'
type SettlementStatus = 'paid' | 'pending' | 'overdue' | 'cancelled'
type ReconciliationStatus = 'pending' | 'matched' | 'ignored'
type LookupEntity = 'category' | 'subcategory' | 'payment_method' | 'counterparty' | 'cost_center' | 'bank_account'

interface FinanceEntry {
    id: string
    description: string
    entry_type: EntryType
    amount: number
    category: string | null
    subcategory: string | null
    entry_date: string
    due_date: string | null
    competence_date: string | null
    payment_method: string | null
    payment_status: PaymentStatus | null
    counterparty_name: string | null
    counterparty_type: CounterpartyType | null
    reference_company: string | null
    cost_center_id: string | null
    bank_account_id: string | null
    source_module: string | null
    external_reference: string | null
    notes: string | null
    attachment_url: string | null
    created_at: string
}

interface FinanceCategory {
    id: string
    name: string
    entry_type: EntryType | 'both'
    is_active: boolean
}

interface FinanceSubcategory {
    id: string
    category_id: string
    name: string
    is_active: boolean
}

interface FinancePaymentMethod {
    id: string
    name: string
    is_active: boolean
}

interface FinanceCounterparty {
    id: string
    name: string
    party_type: CounterpartyType
    is_active: boolean
}

interface FinanceCostCenter {
    id: string
    name: string
    code: string | null
    is_active: boolean
}

interface FinanceBankAccount {
    id: string
    name: string
    bank_name: string | null
    is_active: boolean
}

interface FinanceReconciliation {
    id: string
    bank_account_id: string | null
    statement_date: string
    description: string | null
    amount: number
    external_ref: string | null
    status: ReconciliationStatus
    matched_entry_id: string | null
    notes: string | null
    created_at: string
    bank_account?: {
        id: string
        name: string
        bank_name: string | null
    } | null
    matched_entry?: {
        id: string
        description: string
        amount: number
        entry_type: EntryType
        entry_date: string
    } | null
}

interface FinancePayable {
    id: string
    description: string
    amount: number
    settled_amount: number
    remaining_amount: number
    due_date: string | null
    competence_date: string | null
    status: string
    category: string | null
    subcategory: string | null
    counterparty_name: string | null
    counterparty_type: CounterpartyType | null
    payment_method: string | null
    cost_center_id: string | null
    bank_account_id: string | null
    notes: string | null
    settled_at: string | null
    created_at: string
}

interface FinanceReceivable {
    id: string
    description: string
    amount: number
    settled_amount: number
    remaining_amount: number
    due_date: string | null
    competence_date: string | null
    status: string
    category: string | null
    subcategory: string | null
    counterparty_name: string | null
    counterparty_type: CounterpartyType | null
    payment_method: string | null
    cost_center_id: string | null
    bank_account_id: string | null
    notes: string | null
    settled_at: string | null
    created_at: string
}

interface ToastState {
    msg: string
    type: 'success' | 'error'
}

type FinanceSectionView =
    | 'dashboard'
    | 'cadastros'
    | 'categorias'
    | 'subcategorias'
    | 'pagamentos'
    | 'favorecidos'
    | 'novo-lancamento'
    | 'contas-a-pagar'
    | 'contas-a-receber'
    | 'conciliacao-bancaria'
    | 'lancamentos'

const EXPENSE_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6']

function normalizeFinanceSection(value?: string): FinanceSectionView {
    const v = String(value || '').trim().toLowerCase()
    if (!v || v === 'dashboard' || v === 'resumo') return 'dashboard'
    if (
        v === 'cadastros' ||
        v === 'categorias' ||
        v === 'subcategorias' ||
        v === 'pagamentos' ||
        v === 'favorecidos' ||
        v === 'novo-lancamento' ||
        v === 'contas-a-pagar' ||
        v === 'contas-a-receber' ||
        v === 'conciliacao-bancaria' ||
        v === 'lancamentos'
    ) {
        return v
    }
    return 'dashboard'
}

function formatCurrency(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(date: string) {
    const d = new Date(`${date}T00:00:00`)
    return d.toLocaleDateString('pt-BR')
}

function todayISO() {
    return new Date().toISOString().slice(0, 10)
}

function translatePaymentStatus(status: string | null | undefined) {
    if (status === 'pending') return 'Pendente'
    if (status === 'cancelled') return 'Cancelado'
    return 'Pago'
}

function getPayableSettlementStatus(row: FinancePayable, todayDate: string): SettlementStatus {
    const status = String(row.status || '').trim().toLowerCase()
    if (status === 'cancelled') return 'cancelled'
    if (status === 'paid') return 'paid'
    const remaining = Math.max(0, Number(row.remaining_amount || 0))
    if (remaining <= 0) return 'paid'
    const dueDate = String(row.due_date || '').slice(0, 10)
    if (status === 'overdue' || (dueDate && dueDate < todayDate)) return 'overdue'
    return 'pending'
}

function getReceivableSettlementStatus(row: FinanceReceivable, todayDate: string): SettlementStatus {
    const status = String(row.status || '').trim().toLowerCase()
    if (status === 'cancelled') return 'cancelled'
    if (status === 'received') return 'paid'
    const remaining = Math.max(0, Number(row.remaining_amount || 0))
    if (remaining <= 0) return 'paid'
    const dueDate = String(row.due_date || '').slice(0, 10)
    if (status === 'overdue' || (dueDate && dueDate < todayDate)) return 'overdue'
    return 'pending'
}

function translateSettlementStatus(status: SettlementStatus) {
    if (status === 'paid') return 'Pago'
    if (status === 'overdue') return 'Vencido'
    if (status === 'cancelled') return 'Cancelado'
    return 'Pendente'
}

function translateCounterpartyType(value: string | null | undefined) {
    if (value === 'pessoa_fisica') return 'Pessoa fisica'
    if (value === 'pessoa_juridica') return 'Pessoa juridica'
    return '-'
}

function getSettlementBadgeStyle(status: SettlementStatus) {
    if (status === 'paid') {
        return { color: '#22c55e', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }
    }
    if (status === 'overdue') {
        return { color: '#ef4444', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }
    }
    if (status === 'cancelled') {
        return { color: '#9ca3af', background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.25)' }
    }
    return { color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }
}

function translateReconciliationStatus(status: ReconciliationStatus) {
    if (status === 'matched') return 'Conciliado'
    if (status === 'ignored') return 'Ignorado'
    return 'Pendente'
}

function getReconciliationBadgeStyle(status: ReconciliationStatus) {
    if (status === 'matched') {
        return { color: '#22c55e', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }
    }
    if (status === 'ignored') {
        return { color: '#9ca3af', background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.25)' }
    }
    return { color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }
}

function FinancePageContent({ initialSection }: { initialSection?: string }) {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [entries, setEntries] = useState<FinanceEntry[]>([])
    const [categories, setCategories] = useState<FinanceCategory[]>([])
    const [subcategories, setSubcategories] = useState<FinanceSubcategory[]>([])
    const [paymentMethods, setPaymentMethods] = useState<FinancePaymentMethod[]>([])
    const [counterparties, setCounterparties] = useState<FinanceCounterparty[]>([])
    const [costCenters, setCostCenters] = useState<FinanceCostCenter[]>([])
    const [bankAccounts, setBankAccounts] = useState<FinanceBankAccount[]>([])
    const [reconciliations, setReconciliations] = useState<FinanceReconciliation[]>([])
    const [payables, setPayables] = useState<FinancePayable[]>([])
    const [receivables, setReceivables] = useState<FinanceReceivable[]>([])

    const [loading, setLoading] = useState(true)
    const [lookupsLoading, setLookupsLoading] = useState(true)
    const [reconciliationsLoading, setReconciliationsLoading] = useState(false)
    const [aparLoading, setAparLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [syncingAdsSpend, setSyncingAdsSpend] = useState(false)
    const [settlingAparId, setSettlingAparId] = useState<string | null>(null)
    const [savingReconciliation, setSavingReconciliation] = useState(false)
    const [deletingReconciliationId, setDeletingReconciliationId] = useState<string | null>(null)
    const [editingReconciliationId, setEditingReconciliationId] = useState<string | null>(null)
    const [toast, setToast] = useState<ToastState | null>(null)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [typeFilter, setTypeFilter] = useState<'all' | EntryType>('all')
    const [settlementFilter, setSettlementFilter] = useState<'all' | SettlementStatus>('all')
    const [categoryFilter, setCategoryFilter] = useState('all')
    const [subcategoryFilter, setSubcategoryFilter] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [reconciliationStatusFilter, setReconciliationStatusFilter] = useState<'all' | ReconciliationStatus>('all')
    const [reconciliationBankAccountFilter, setReconciliationBankAccountFilter] = useState('all')
    const [reconciliationStartDate, setReconciliationStartDate] = useState('')
    const [reconciliationEndDate, setReconciliationEndDate] = useState('')

    const [form, setForm] = useState({
        description: '',
        entry_type: 'expense' as EntryType,
        amount: '',
        category: '',
        subcategory: '',
        entry_date: todayISO(),
        due_date: todayISO(),
        competence_date: todayISO(),
        payment_method: '',
        payment_status: 'paid' as PaymentStatus,
        counterparty_name: '',
        counterparty_type: 'pessoa_juridica' as CounterpartyType,
        reference_company: '',
        cost_center_id: '',
        bank_account_id: '',
        notes: '',
    })

    const [newCategoryName, setNewCategoryName] = useState('')
    const [newCategoryType, setNewCategoryType] = useState<EntryType | 'both'>('expense')
    const [newSubcategoryName, setNewSubcategoryName] = useState('')
    const [newSubcategoryCategoryId, setNewSubcategoryCategoryId] = useState('')
    const [newPaymentMethodName, setNewPaymentMethodName] = useState('')
    const [newCounterpartyName, setNewCounterpartyName] = useState('')
    const [newCounterpartyType, setNewCounterpartyType] = useState<CounterpartyType>('pessoa_juridica')
    const [newCostCenterName, setNewCostCenterName] = useState('')
    const [newCostCenterCode, setNewCostCenterCode] = useState('')
    const [newBankAccountName, setNewBankAccountName] = useState('')
    const [newBankAccountBank, setNewBankAccountBank] = useState('')
    const [reconciliationForm, setReconciliationForm] = useState({
        bank_account_id: '',
        statement_date: todayISO(),
        description: '',
        amount: '',
        external_ref: '',
        status: 'pending' as ReconciliationStatus,
        matched_entry_id: '',
        notes: '',
    })

    const activeSection = useMemo(() => {
        if (initialSection) return normalizeFinanceSection(initialSection)

        const parts = String(pathname || '').split('/').filter(Boolean)
        const financeIndex = parts.indexOf('finance')
        const sectionFromPath = financeIndex >= 0 ? parts[financeIndex + 1] : ''
        return normalizeFinanceSection(sectionFromPath)
    }, [initialSection, pathname])
    const showResumo = activeSection === 'dashboard'
    const showCadastros = activeSection === 'cadastros' || activeSection === 'categorias' || activeSection === 'subcategorias' || activeSection === 'pagamentos' || activeSection === 'favorecidos'
    const showCategorias = activeSection === 'cadastros' || activeSection === 'categorias'
    const showSubcategorias = activeSection === 'cadastros' || activeSection === 'categorias' || activeSection === 'subcategorias'
    const showPagamentos = activeSection === 'cadastros' || activeSection === 'pagamentos'
    const showFavorecidos = activeSection === 'cadastros' || activeSection === 'favorecidos'
    const showNovoLancamento = activeSection === 'novo-lancamento'
    const showContasPagar = activeSection === 'contas-a-pagar'
    const showContasReceber = activeSection === 'contas-a-receber'
    const showConciliacaoBancaria = activeSection === 'conciliacao-bancaria'
    const showLancamentos = activeSection === 'lancamentos'
    const showFiltros = activeSection === 'dashboard' || activeSection === 'lancamentos' || showContasPagar || showContasReceber
    const todayDate = todayISO()
    const highlightedEntryId = useMemo(() => {
        const entryId = String(searchParams?.get('entry_id') || '').trim()
        return entryId || null
    }, [searchParams])

    const showToast = (msg: string, type: 'success' | 'error') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3500)
    }

    const fetchEntries = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (startDate) params.set('start_date', startDate)
            if (endDate) params.set('end_date', endDate)
            params.set('limit', '2000')
            const res = await fetch(`/api/admin/finance?${params.toString()}`)
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Erro ao carregar financeiro')
            }
            setEntries(data.entries || [])
        } catch (err: any) {
            showToast(err.message || 'Erro ao carregar financeiro', 'error')
        } finally {
            setLoading(false)
        }
    }

    const syncAdsSpend = async () => {
        setSyncingAdsSpend(true)
        try {
            const res = await fetch('/api/admin/finance/sync-ads-spend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Erro ao sincronizar trafego pago')
            }

            await fetchEntries()
            const syncedAmount = (data.entries || [])
                .reduce((sum: number, item: any) => sum + Number(item?.amount || 0), 0)
            showToast(`Trafego pago sincronizado no financeiro: ${formatCurrency(syncedAmount)}`, 'success')
        } catch (err: any) {
            showToast(err.message || 'Erro ao sincronizar trafego pago', 'error')
        } finally {
            setSyncingAdsSpend(false)
        }
    }

    const fetchLookups = async () => {
        setLookupsLoading(true)
        try {
            const res = await fetch('/api/admin/finance/lookups')
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Erro ao carregar cadastros financeiros')
            }

            setCategories(data.categories || [])
            setSubcategories(data.subcategories || [])
            setPaymentMethods(data.payment_methods || [])
            setCounterparties(data.counterparties || [])
            setCostCenters(data.cost_centers || [])
            setBankAccounts(data.bank_accounts || [])

            if (!newSubcategoryCategoryId && Array.isArray(data.categories) && data.categories.length > 0) {
                setNewSubcategoryCategoryId(data.categories[0].id)
            }
        } catch (err: any) {
            showToast(err.message || 'Erro ao carregar cadastros financeiros', 'error')
        } finally {
            setLookupsLoading(false)
        }
    }

    const fetchReconciliations = async () => {
        setReconciliationsLoading(true)
        try {
            const params = new URLSearchParams()
            if (reconciliationStatusFilter !== 'all') params.set('status', reconciliationStatusFilter)
            if (reconciliationBankAccountFilter !== 'all') params.set('bank_account_id', reconciliationBankAccountFilter)
            if (reconciliationStartDate) params.set('start_date', reconciliationStartDate)
            if (reconciliationEndDate) params.set('end_date', reconciliationEndDate)
            params.set('limit', '2000')

            const res = await fetch(`/api/admin/finance/reconciliations?${params.toString()}`)
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Erro ao carregar conciliacao bancaria')
            }

            setReconciliations(data.reconciliations || [])
        } catch (err: any) {
            showToast(err.message || 'Erro ao carregar conciliacao bancaria', 'error')
        } finally {
            setReconciliationsLoading(false)
        }
    }

    const fetchAparData = async () => {
        setAparLoading(true)
        try {
            const payableParams = new URLSearchParams()
            const receivableParams = new URLSearchParams()
            payableParams.set('type', 'payable')
            receivableParams.set('type', 'receivable')
            payableParams.set('limit', '3000')
            receivableParams.set('limit', '3000')
            if (startDate) {
                payableParams.set('start_date', startDate)
                receivableParams.set('start_date', startDate)
            }
            if (endDate) {
                payableParams.set('end_date', endDate)
                receivableParams.set('end_date', endDate)
            }

            const [payablesRes, receivablesRes] = await Promise.all([
                fetch(`/api/admin/finance/apar?${payableParams.toString()}`),
                fetch(`/api/admin/finance/apar?${receivableParams.toString()}`),
            ])

            const payablesData = await payablesRes.json()
            const receivablesData = await receivablesRes.json()
            if (!payablesRes.ok || !payablesData.success) {
                throw new Error(payablesData.error || 'Erro ao carregar contas a pagar')
            }
            if (!receivablesRes.ok || !receivablesData.success) {
                throw new Error(receivablesData.error || 'Erro ao carregar contas a receber')
            }

            setPayables(payablesData.items || [])
            setReceivables(receivablesData.items || [])
        } catch (err: any) {
            showToast(err.message || 'Erro ao carregar AP/AR', 'error')
        } finally {
            setAparLoading(false)
        }
    }

    useEffect(() => {
        fetchEntries()
        fetchLookups()
        fetchAparData()
    }, [])

    useEffect(() => {
        if (!showConciliacaoBancaria) return
        fetchReconciliations()
    }, [
        showConciliacaoBancaria,
        reconciliationStatusFilter,
        reconciliationBankAccountFilter,
        reconciliationStartDate,
        reconciliationEndDate,
    ])

    const categoryFilterOptions = useMemo(() => {
        const set = new Set<string>()
        if (showContasPagar) {
            payables.forEach(item => {
                const name = String(item.category || '').trim()
                if (name) set.add(name)
            })
        } else if (showContasReceber) {
            receivables.forEach(item => {
                const name = String(item.category || '').trim()
                if (name) set.add(name)
            })
        } else {
            categories.forEach(cat => set.add(cat.name))
            entries.forEach(entry => {
                const name = String(entry.category || '').trim()
                if (name) set.add(name)
            })
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    }, [categories, entries, payables, receivables, showContasPagar, showContasReceber])

    const subcategoryFilterOptions = useMemo(() => {
        const set = new Set<string>()
        const selectedCategoryByName = categories.find(cat => cat.name === categoryFilter)

        if (showContasPagar || showContasReceber) {
            const sourceRows = showContasPagar ? payables : receivables
            sourceRows.forEach(item => {
                const categoryName = String(item.category || '').trim()
                const subName = String(item.subcategory || '').trim()
                if (!subName) return
                if (categoryFilter !== 'all' && categoryName !== categoryFilter) return
                set.add(subName)
            })
        } else {
            if (categoryFilter === 'all') {
                subcategories.forEach(sub => set.add(sub.name))
                entries.forEach(entry => {
                    const name = String(entry.subcategory || '').trim()
                    if (name) set.add(name)
                })
            } else {
                if (selectedCategoryByName) {
                    subcategories
                        .filter(sub => sub.category_id === selectedCategoryByName.id)
                        .forEach(sub => set.add(sub.name))
                }

                entries
                    .filter(entry => String(entry.category || '').trim() === categoryFilter)
                    .forEach(entry => {
                        const name = String(entry.subcategory || '').trim()
                        if (name) set.add(name)
                    })
            }
        }

        return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    }, [categories, subcategories, entries, payables, receivables, categoryFilter, showContasPagar, showContasReceber])

    const filteredEntries = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase()
        const effectiveTypeFilter: 'all' | EntryType = typeFilter

        return entries.filter(entry => {
            if (effectiveTypeFilter !== 'all' && entry.entry_type !== effectiveTypeFilter) return false
            if (categoryFilter !== 'all' && String(entry.category || '').trim() !== categoryFilter) return false
            if (subcategoryFilter !== 'all' && String(entry.subcategory || '').trim() !== subcategoryFilter) return false

            if (!normalizedSearch) return true
            const haystack = [
                entry.description,
                entry.category,
                entry.subcategory,
                entry.notes,
                entry.counterparty_name,
                entry.reference_company,
                entry.payment_method,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()

            return haystack.includes(normalizedSearch)
        })
    }, [entries, typeFilter, categoryFilter, subcategoryFilter, searchTerm])

    const filteredPayables = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase()
        return payables.filter(item => {
            if (categoryFilter !== 'all' && String(item.category || '').trim() !== categoryFilter) return false
            if (subcategoryFilter !== 'all' && String(item.subcategory || '').trim() !== subcategoryFilter) return false
            const settlement = getPayableSettlementStatus(item, todayDate)
            if (settlementFilter !== 'all' && settlement !== settlementFilter) return false
            if (!normalizedSearch) return true

            const haystack = [
                item.description,
                item.category,
                item.subcategory,
                item.notes,
                item.counterparty_name,
                item.payment_method,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
            return haystack.includes(normalizedSearch)
        })
    }, [payables, categoryFilter, subcategoryFilter, settlementFilter, searchTerm, todayDate])

    const filteredReceivables = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase()
        return receivables.filter(item => {
            if (categoryFilter !== 'all' && String(item.category || '').trim() !== categoryFilter) return false
            if (subcategoryFilter !== 'all' && String(item.subcategory || '').trim() !== subcategoryFilter) return false
            const settlement = getReceivableSettlementStatus(item, todayDate)
            if (settlementFilter !== 'all' && settlement !== settlementFilter) return false
            if (!normalizedSearch) return true

            const haystack = [
                item.description,
                item.category,
                item.subcategory,
                item.notes,
                item.counterparty_name,
                item.payment_method,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
            return haystack.includes(normalizedSearch)
        })
    }, [receivables, categoryFilter, subcategoryFilter, settlementFilter, searchTerm, todayDate])

    const hasHighlightedEntryInList = useMemo(() => {
        if (!highlightedEntryId) return false
        return filteredEntries.some(entry => entry.id === highlightedEntryId)
    }, [filteredEntries, highlightedEntryId])

    const summary = useMemo(() => {
        let income = 0
        let expense = 0

        for (const entry of filteredEntries) {
            if (entry.entry_type === 'income') income += Number(entry.amount || 0)
            else expense += Number(entry.amount || 0)
        }

        return {
            income,
            expense,
            balance: income - expense,
            total: income + expense,
        }
    }, [filteredEntries])

    const payablesSummary = useMemo(() => {
        let total = 0
        let paid = 0
        let pending = 0
        let overdue = 0
        let cancelled = 0
        let paidCount = 0
        let pendingCount = 0
        let overdueCount = 0
        let cancelledCount = 0

        for (const item of filteredPayables) {
            const amount = Number(item.amount || 0)
            const settledAmount = Number(item.settled_amount || 0)
            const remaining = Math.max(0, amount - settledAmount)
            const settlement = getPayableSettlementStatus(item, todayDate)
            total += amount
            paid += settledAmount
            if (settlement === 'paid') {
                paidCount += 1
            } else if (settlement === 'pending') {
                pending += remaining
                pendingCount += 1
            } else if (settlement === 'overdue') {
                overdue += remaining
                overdueCount += 1
            } else {
                cancelled += remaining
                cancelledCount += 1
            }
        }

        return { total, paid, pending, overdue, cancelled, count: filteredPayables.length, paidCount, pendingCount, overdueCount, cancelledCount }
    }, [filteredPayables, todayDate])

    const receivablesSummary = useMemo(() => {
        let total = 0
        let received = 0
        let pending = 0
        let overdue = 0
        let cancelled = 0
        let receivedCount = 0
        let pendingCount = 0
        let overdueCount = 0
        let cancelledCount = 0

        for (const item of filteredReceivables) {
            const amount = Number(item.amount || 0)
            const settledAmount = Number(item.settled_amount || 0)
            const remaining = Math.max(0, amount - settledAmount)
            const settlement = getReceivableSettlementStatus(item, todayDate)
            total += amount
            received += settledAmount
            if (settlement === 'paid') {
                receivedCount += 1
            } else if (settlement === 'pending') {
                pending += remaining
                pendingCount += 1
            } else if (settlement === 'overdue') {
                overdue += remaining
                overdueCount += 1
            } else {
                cancelled += remaining
                cancelledCount += 1
            }
        }

        return { total, received, pending, overdue, cancelled, count: filteredReceivables.length, receivedCount, pendingCount, overdueCount, cancelledCount }
    }, [filteredReceivables, todayDate])

    const monthlySeries = useMemo(() => {
        const map = new Map<string, { month: string; income: number; expense: number }>()
        for (const entry of filteredEntries) {
            const key = String(entry.entry_date || '').slice(0, 7)
            if (!key) continue
            const row = map.get(key) || { month: key, income: 0, expense: 0 }
            if (entry.entry_type === 'income') row.income += Number(entry.amount || 0)
            else row.expense += Number(entry.amount || 0)
            map.set(key, row)
        }

        return Array.from(map.values())
            .sort((a, b) => a.month.localeCompare(b.month))
            .map(row => ({
                ...row,
                balance: row.income - row.expense,
                label: `${row.month.slice(5, 7)}/${row.month.slice(2, 4)}`,
            }))
    }, [filteredEntries])

    const expenseByCategory = useMemo(() => {
        const map = new Map<string, number>()
        for (const entry of filteredEntries) {
            if (entry.entry_type !== 'expense') continue
            const key = entry.category?.trim() || 'Sem categoria'
            map.set(key, (map.get(key) || 0) + Number(entry.amount || 0))
        }
        return Array.from(map.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8)
    }, [filteredEntries])

    const categoryOptions = useMemo(() => {
        return categories.filter(cat => cat.entry_type === 'both' || cat.entry_type === form.entry_type)
    }, [categories, form.entry_type])

    const selectedCategory = useMemo(() => {
        return categories.find(cat => cat.name === form.category) || null
    }, [categories, form.category])

    const subcategoryOptions = useMemo(() => {
        if (!selectedCategory) return []
        return subcategories.filter(sub => sub.category_id === selectedCategory.id)
    }, [selectedCategory, subcategories])

    const selectedCounterparty = useMemo(() => {
        if (!form.counterparty_name) return null
        return counterparties.find(counterparty => counterparty.name === form.counterparty_name) || null
    }, [counterparties, form.counterparty_name])

    const costCenterById = useMemo(() => {
        const map = new Map<string, FinanceCostCenter>()
        costCenters.forEach(center => map.set(center.id, center))
        return map
    }, [costCenters])

    const bankAccountById = useMemo(() => {
        const map = new Map<string, FinanceBankAccount>()
        bankAccounts.forEach(account => map.set(account.id, account))
        return map
    }, [bankAccounts])

    const entryById = useMemo(() => {
        const map = new Map<string, FinanceEntry>()
        entries.forEach(entry => map.set(entry.id, entry))
        return map
    }, [entries])

    const reconciliationEntryOptions = useMemo(() => {
        return entries
            .slice()
            .sort((a, b) => String(b.entry_date).localeCompare(String(a.entry_date)))
            .map(entry => ({
                id: entry.id,
                label: `${formatDate(entry.entry_date)} | ${entry.entry_type === 'income' ? 'Receita' : 'Despesa'} | ${formatCurrency(Number(entry.amount || 0))} | ${entry.description}`,
            }))
    }, [entries])

    const reconciliationSummary = useMemo(() => {
        let total = 0
        let pending = 0
        let matched = 0
        let ignored = 0

        for (const row of reconciliations) {
            const amount = Number(row.amount || 0)
            total += amount
            if (row.status === 'matched') matched += amount
            else if (row.status === 'ignored') ignored += amount
            else pending += amount
        }

        return {
            total,
            pending,
            matched,
            ignored,
            count: reconciliations.length,
        }
    }, [reconciliations])

    useEffect(() => {
        if (!selectedCounterparty) return
        setForm(prev => ({
            ...prev,
            counterparty_type: selectedCounterparty.party_type,
        }))
    }, [selectedCounterparty])

    useEffect(() => {
        if (!highlightedEntryId || !showLancamentos || loading || !hasHighlightedEntryInList) return

        const timeout = window.setTimeout(() => {
            const row = document.getElementById(`finance-entry-row-${highlightedEntryId}`)
            if (!row) return
            row.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 120)

        return () => window.clearTimeout(timeout)
    }, [highlightedEntryId, showLancamentos, loading, hasHighlightedEntryInList])

    const onCreateEntry = async () => {
        const amount = Number(form.amount)
        if (!form.description.trim()) {
            showToast('Informe a descricao do lancamento', 'error')
            return
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            showToast('Informe um valor valido', 'error')
            return
        }
        if (!form.entry_date) {
            showToast('Informe a data do lancamento', 'error')
            return
        }

        setSaving(true)
        try {
            const res = await fetch('/api/admin/finance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    amount,
                }),
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Erro ao salvar')
            }

            setForm(prev => ({
                ...prev,
                description: '',
                amount: '',
                notes: '',
            }))

            showToast('Lancamento salvo com sucesso', 'success')
            await fetchEntries()
        } catch (err: any) {
            showToast(err.message || 'Erro ao salvar lancamento', 'error')
        } finally {
            setSaving(false)
        }
    }

    const onDeleteEntry = async (id: string) => {
        const confirmed = window.confirm('Deseja remover este lancamento?')
        if (!confirmed) return

        try {
            const res = await fetch(`/api/admin/finance?id=${id}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao excluir')
            showToast('Lancamento removido', 'success')
            await fetchEntries()
        } catch (err: any) {
            showToast(err.message || 'Erro ao excluir lancamento', 'error')
        }
    }

    const onSettleApar = async (type: 'payable' | 'receivable', row: FinancePayable | FinanceReceivable, mode: 'full' | 'partial' | 'reopen') => {
        setSettlingAparId(row.id)
        try {
            let action: 'settle' | 'reopen' = 'settle'
            let amount: number | null = null

            if (mode === 'reopen') {
                action = 'reopen'
            } else {
                const remaining = Math.max(0, Number(row.remaining_amount || 0))
                if (remaining <= 0) {
                    throw new Error('Nao ha saldo em aberto para baixa')
                }

                if (mode === 'full') {
                    amount = Number(remaining.toFixed(2))
                } else {
                    const defaultValue = String(remaining.toFixed(2)).replace('.', ',')
                    const rawValue = window.prompt(
                        type === 'payable' ? 'Valor da baixa parcial (conta a pagar)' : 'Valor do recebimento parcial (conta a receber)',
                        defaultValue,
                    )
                    if (rawValue === null) return
                    const parsedValue = Number(String(rawValue).replace(',', '.'))
                    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
                        throw new Error('Valor de baixa invalido')
                    }
                    if (parsedValue > remaining + 1e-9) {
                        throw new Error('Valor informado maior que saldo em aberto')
                    }
                    amount = Number(parsedValue.toFixed(2))
                }
            }

            const res = await fetch('/api/admin/finance/apar', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: row.id,
                    type,
                    action,
                    amount,
                }),
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Erro ao atualizar AP/AR')
            }

            if (mode === 'reopen') {
                showToast(type === 'payable' ? 'Conta a pagar reaberta' : 'Conta a receber reaberta', 'success')
            } else if (mode === 'partial') {
                showToast(type === 'payable' ? 'Baixa parcial registrada' : 'Recebimento parcial registrado', 'success')
            } else {
                showToast(type === 'payable' ? 'Conta marcada como paga' : 'Conta marcada como recebida', 'success')
            }

            await Promise.all([fetchAparData(), fetchEntries()])
        } catch (err: any) {
            showToast(err.message || 'Erro ao atualizar AP/AR', 'error')
        } finally {
            setSettlingAparId(null)
        }
    }

    const onClearSearchFilters = () => {
        setStartDate('')
        setEndDate('')
        setTypeFilter('all')
        setSettlementFilter('all')
        setCategoryFilter('all')
        setSubcategoryFilter('all')
        setSearchTerm('')
    }

    const createLookup = async (entity: LookupEntity, payload: Record<string, any>) => {
        try {
            const res = await fetch('/api/admin/finance/lookups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entity, ...payload }),
            })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao cadastrar')
            await fetchLookups()
            return true
        } catch (err: any) {
            showToast(err.message || 'Erro ao cadastrar item', 'error')
            return false
        }
    }

    const deleteLookup = async (entity: LookupEntity, id: string) => {
        const confirmed = window.confirm('Deseja remover este item?')
        if (!confirmed) return

        try {
            const res = await fetch(`/api/admin/finance/lookups?entity=${entity}&id=${id}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao remover')
            showToast('Item removido', 'success')
            await fetchLookups()
        } catch (err: any) {
            showToast(err.message || 'Erro ao remover item', 'error')
        }
    }

    const onCreateCategory = async () => {
        if (!newCategoryName.trim()) {
            showToast('Informe o nome da categoria', 'error')
            return
        }
        const ok = await createLookup('category', { name: newCategoryName.trim(), entry_type: newCategoryType })
        if (ok) {
            setNewCategoryName('')
            showToast('Categoria cadastrada', 'success')
        }
    }

    const onCreateSubcategory = async () => {
        if (!newSubcategoryCategoryId) {
            showToast('Selecione uma categoria para a subcategoria', 'error')
            return
        }
        if (!newSubcategoryName.trim()) {
            showToast('Informe o nome da subcategoria', 'error')
            return
        }
        const ok = await createLookup('subcategory', {
            name: newSubcategoryName.trim(),
            category_id: newSubcategoryCategoryId,
        })
        if (ok) {
            setNewSubcategoryName('')
            showToast('Subcategoria cadastrada', 'success')
        }
    }

    const onCreatePaymentMethod = async () => {
        if (!newPaymentMethodName.trim()) {
            showToast('Informe a forma de pagamento', 'error')
            return
        }
        const ok = await createLookup('payment_method', { name: newPaymentMethodName.trim() })
        if (ok) {
            setNewPaymentMethodName('')
            showToast('Forma de pagamento cadastrada', 'success')
        }
    }

    const onCreateCounterparty = async () => {
        if (!newCounterpartyName.trim()) {
            showToast('Informe o nome do favorecido', 'error')
            return
        }
        const ok = await createLookup('counterparty', {
            name: newCounterpartyName.trim(),
            party_type: newCounterpartyType,
        })
        if (ok) {
            setNewCounterpartyName('')
            showToast('Favorecido cadastrado', 'success')
        }
    }

    const onCreateCostCenter = async () => {
        if (!newCostCenterName.trim()) {
            showToast('Informe o nome do centro de custo', 'error')
            return
        }
        const ok = await createLookup('cost_center', {
            name: newCostCenterName.trim(),
            code: newCostCenterCode.trim(),
        })
        if (ok) {
            setNewCostCenterName('')
            setNewCostCenterCode('')
            showToast('Centro de custo cadastrado', 'success')
        }
    }

    const onCreateBankAccount = async () => {
        if (!newBankAccountName.trim()) {
            showToast('Informe o nome da conta bancaria', 'error')
            return
        }
        const ok = await createLookup('bank_account', {
            name: newBankAccountName.trim(),
            bank_name: newBankAccountBank.trim(),
        })
        if (ok) {
            setNewBankAccountName('')
            setNewBankAccountBank('')
            showToast('Conta bancaria cadastrada', 'success')
        }
    }

    const resetReconciliationForm = () => {
        setEditingReconciliationId(null)
        setReconciliationForm({
            bank_account_id: '',
            statement_date: todayISO(),
            description: '',
            amount: '',
            external_ref: '',
            status: 'pending',
            matched_entry_id: '',
            notes: '',
        })
    }

    const onEditReconciliation = (row: FinanceReconciliation) => {
        setEditingReconciliationId(row.id)
        setReconciliationForm({
            bank_account_id: row.bank_account_id || '',
            statement_date: row.statement_date || todayISO(),
            description: row.description || '',
            amount: String(Number(row.amount || 0)),
            external_ref: row.external_ref || '',
            status: row.status || 'pending',
            matched_entry_id: row.matched_entry_id || '',
            notes: row.notes || '',
        })
    }

    const onSaveReconciliation = async () => {
        const amount = Number(reconciliationForm.amount)
        if (!reconciliationForm.statement_date) {
            showToast('Informe a data do extrato', 'error')
            return
        }
        if (!Number.isFinite(amount) || amount === 0) {
            showToast('Informe um valor de extrato valido', 'error')
            return
        }
        if (reconciliationForm.status === 'matched' && !reconciliationForm.matched_entry_id) {
            showToast('Selecione um lancamento para status conciliado', 'error')
            return
        }

        setSavingReconciliation(true)
        try {
            const payload = {
                id: editingReconciliationId || undefined,
                bank_account_id: reconciliationForm.bank_account_id || null,
                statement_date: reconciliationForm.statement_date,
                description: reconciliationForm.description.trim() || null,
                amount,
                external_ref: reconciliationForm.external_ref.trim() || null,
                status: reconciliationForm.status,
                matched_entry_id: reconciliationForm.status === 'matched'
                    ? (reconciliationForm.matched_entry_id || null)
                    : null,
                notes: reconciliationForm.notes.trim() || null,
            }

            const res = await fetch('/api/admin/finance/reconciliations', {
                method: editingReconciliationId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Erro ao salvar conciliacao')
            }

            showToast(editingReconciliationId ? 'Conciliacao atualizada' : 'Conciliacao cadastrada', 'success')
            resetReconciliationForm()
            await Promise.all([fetchReconciliations(), fetchEntries()])
        } catch (err: any) {
            showToast(err.message || 'Erro ao salvar conciliacao', 'error')
        } finally {
            setSavingReconciliation(false)
        }
    }

    const onDeleteReconciliation = async (id: string) => {
        const confirmed = window.confirm('Deseja remover este item de conciliacao?')
        if (!confirmed) return

        setDeletingReconciliationId(id)
        try {
            const res = await fetch(`/api/admin/finance/reconciliations?id=${id}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Erro ao remover conciliacao')
            }

            showToast('Conciliacao removida', 'success')
            if (editingReconciliationId === id) resetReconciliationForm()
            await Promise.all([fetchReconciliations(), fetchEntries()])
        } catch (err: any) {
            showToast(err.message || 'Erro ao remover conciliacao', 'error')
        } finally {
            setDeletingReconciliationId(null)
        }
    }

    const onSetReconciliationStatus = async (row: FinanceReconciliation, status: ReconciliationStatus) => {
        if (status === 'matched' && !row.matched_entry_id) {
            showToast('Defina um lancamento vinculado para conciliar', 'error')
            return
        }

        try {
            const res = await fetch('/api/admin/finance/reconciliations', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: row.id,
                    bank_account_id: row.bank_account_id || null,
                    statement_date: row.statement_date,
                    description: row.description || null,
                    amount: Number(row.amount || 0),
                    external_ref: row.external_ref || null,
                    status,
                    matched_entry_id: status === 'matched' ? row.matched_entry_id : null,
                    notes: row.notes || null,
                }),
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Erro ao atualizar status de conciliacao')
            }

            showToast('Status da conciliacao atualizado', 'success')
            await Promise.all([fetchReconciliations(), fetchEntries()])
        } catch (err: any) {
            showToast(err.message || 'Erro ao atualizar status de conciliacao', 'error')
        }
    }

    return (
        <div>
            {toast && (
                <div className={`admin-toast ${toast.type}`}>
                    {toast.msg}
                </div>
            )}

            <div className="admin-header">
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Landmark size={28} /> Financeiro Empresarial
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
                        Cadastre receitas e despesas com categorias, subcategorias e rastreio financeiro detalhado.
                    </p>
                </div>
                <div className="admin-header-actions">
                    <button
                        className="btn btn-outline"
                        onClick={syncAdsSpend}
                        disabled={syncingAdsSpend}
                    >
                        <Link2 size={16} className={syncingAdsSpend ? 'spin' : ''} /> Sincronizar trafego pago
                    </button>
                    <button
                        className="btn btn-outline"
                        onClick={async () => {
                            await Promise.all([fetchEntries(), fetchAparData()])
                            if (showConciliacaoBancaria) await fetchReconciliations()
                        }}
                        disabled={loading || aparLoading || reconciliationsLoading}
                    >
                        <RefreshCw size={16} className={loading || aparLoading ? 'spin' : ''} /> Atualizar
                    </button>
                </div>
            </div>

            {showFiltros && (
                <div className="chart-card" style={{ marginBottom: 18 }}>
                    <div className="chart-title" style={{ marginBottom: 12 }}>Filtro de periodo e pesquisa</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                        <div>
                            <label className="form-label">Data inicial</label>
                            <input className="form-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="form-label">Data final</label>
                            <input className="form-input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                        {!showContasPagar && !showContasReceber && (
                            <div>
                                <label className="form-label">Tipo</label>
                                <select className="form-input" value={typeFilter} onChange={e => setTypeFilter(e.target.value as 'all' | EntryType)}>
                                    <option value="all">Todos</option>
                                    <option value="income">Receitas</option>
                                    <option value="expense">Despesas</option>
                                </select>
                            </div>
                        )}
                        {(showContasPagar || showContasReceber) && (
                            <div>
                                <label className="form-label">Status financeiro</label>
                                <select
                                    className="form-input"
                                    value={settlementFilter}
                                    onChange={e => setSettlementFilter(e.target.value as 'all' | SettlementStatus)}
                                >
                                    <option value="all">Todos</option>
                                    <option value="paid">{showContasReceber ? 'Recebido' : 'Pago'}</option>
                                    <option value="pending">Pendente</option>
                                    <option value="overdue">Vencido</option>
                                    <option value="cancelled">Cancelado</option>
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="form-label">Categoria</label>
                            <select className="form-input" value={categoryFilter} onChange={e => {
                                setCategoryFilter(e.target.value)
                                setSubcategoryFilter('all')
                            }}>
                                <option value="all">Todas categorias</option>
                                {categoryFilterOptions.map(catName => (
                                    <option key={catName} value={catName}>{catName}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">Subcategoria</label>
                            <select className="form-input" value={subcategoryFilter} onChange={e => setSubcategoryFilter(e.target.value)}>
                                <option value="all">Todas subcategorias</option>
                                {subcategoryFilterOptions.map(subName => (
                                    <option key={subName} value={subName}>{subName}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label className="form-label">Busca textual</label>
                            <input
                                className="form-input"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Pesquise por descricao, categoria, subcategoria, favorecido ou observacoes"
                            />
                        </div>
                        <div style={{ alignSelf: 'end', display: 'flex', gap: 8 }}>
                            <button className="btn btn-gold" onClick={async () => {
                                await Promise.all([fetchEntries(), fetchAparData()])
                            }}>
                                <CalendarDays size={16} /> Atualizar periodo
                            </button>
                            <button className="btn btn-outline" onClick={onClearSearchFilters}>
                                Limpar pesquisa
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCadastros && (
                <div
                    id="finance-cadastros"
                    className="chart-card"
                    style={{ marginBottom: 18, scrollMarginTop: 96, minHeight: 'calc(100vh - 220px)' }}
                >
                    <div className="chart-title" style={{ marginBottom: 12 }}>
                        Cadastros financeiros
                    </div>

                    {lookupsLoading ? (
                        <div style={{ color: 'var(--text-muted)' }}>Carregando cadastros...</div>
                    ) : (
                        <div className="lookup-grid">
                        {showCategorias && (
                            <div id="finance-categorias" className="lookup-box" style={{ scrollMarginTop: 96 }}>
                            <div className="lookup-title">Categorias</div>
                            <div className="lookup-row">
                                <input
                                    className="form-input"
                                    placeholder="Nova categoria"
                                    value={newCategoryName}
                                    onChange={e => setNewCategoryName(e.target.value)}
                                />
                                <select
                                    className="form-input"
                                    value={newCategoryType}
                                    onChange={e => setNewCategoryType(e.target.value as EntryType | 'both')}
                                >
                                    <option value="expense">Despesa</option>
                                    <option value="income">Receita</option>
                                    <option value="both">Ambas</option>
                                </select>
                                <button className="btn btn-outline" onClick={onCreateCategory}>
                                    <Plus size={14} />
                                </button>
                            </div>
                            <div className="chip-wrap">
                                {categories.map(cat => (
                                    <span key={cat.id} className="lookup-chip">
                                        {cat.name} ({cat.entry_type})
                                        <button onClick={() => deleteLookup('category', cat.id)} title="Remover categoria">
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            </div>
                        )}

                        {showSubcategorias && (
                            <div id="finance-subcategorias" className="lookup-box" style={{ scrollMarginTop: 96 }}>
                            <div className="lookup-title">Subcategorias</div>
                            <div className="lookup-row">
                                <select
                                    className="form-input"
                                    value={newSubcategoryCategoryId}
                                    onChange={e => setNewSubcategoryCategoryId(e.target.value)}
                                >
                                    <option value="">Categoria</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                                <input
                                    className="form-input"
                                    placeholder="Nova subcategoria"
                                    value={newSubcategoryName}
                                    onChange={e => setNewSubcategoryName(e.target.value)}
                                />
                                <button className="btn btn-outline" onClick={onCreateSubcategory}>
                                    <Plus size={14} />
                                </button>
                            </div>
                            <div className="chip-wrap">
                                {subcategories.map(sub => {
                                    const cat = categories.find(c => c.id === sub.category_id)
                                    return (
                                        <span key={sub.id} className="lookup-chip">
                                            {cat?.name || 'Categoria'}: {sub.name}
                                            <button onClick={() => deleteLookup('subcategory', sub.id)} title="Remover subcategoria">
                                                <X size={12} />
                                            </button>
                                        </span>
                                    )
                                })}
                            </div>
                            </div>
                        )}

                        {showPagamentos && (
                            <div id="finance-pagamentos" className="lookup-box" style={{ scrollMarginTop: 96 }}>
                            <div className="lookup-title">Formas de pagamento</div>
                            <div className="lookup-row">
                                <input
                                    className="form-input"
                                    placeholder="Ex: PIX, Boleto, Cartao"
                                    value={newPaymentMethodName}
                                    onChange={e => setNewPaymentMethodName(e.target.value)}
                                />
                                <button className="btn btn-outline" onClick={onCreatePaymentMethod}>
                                    <Plus size={14} />
                                </button>
                            </div>
                            <div className="chip-wrap">
                                {paymentMethods.map(pm => (
                                    <span key={pm.id} className="lookup-chip">
                                        {pm.name}
                                        <button onClick={() => deleteLookup('payment_method', pm.id)} title="Remover forma de pagamento">
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            </div>
                        )}

                        {showFavorecidos && (
                            <div id="finance-favorecidos" className="lookup-box" style={{ scrollMarginTop: 96 }}>
                            <div className="lookup-title">Favorecidos (empresa/pessoa)</div>
                            <div className="lookup-row">
                                <input
                                    className="form-input"
                                    placeholder="Nome do favorecido"
                                    value={newCounterpartyName}
                                    onChange={e => setNewCounterpartyName(e.target.value)}
                                />
                                <select
                                    className="form-input"
                                    value={newCounterpartyType}
                                    onChange={e => setNewCounterpartyType(e.target.value as CounterpartyType)}
                                >
                                    <option value="pessoa_juridica">Pessoa juridica</option>
                                    <option value="pessoa_fisica">Pessoa fisica</option>
                                </select>
                                <button className="btn btn-outline" onClick={onCreateCounterparty}>
                                    <Plus size={14} />
                                </button>
                            </div>
                            <div className="chip-wrap">
                                {counterparties.map(counterparty => (
                                    <span key={counterparty.id} className="lookup-chip">
                                        {counterparty.name} ({translateCounterpartyType(counterparty.party_type)})
                                        <button onClick={() => deleteLookup('counterparty', counterparty.id)} title="Remover favorecido">
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            </div>
                        )}

                        <div className="lookup-box">
                            <div className="lookup-title">Centros de custo</div>
                            <div className="lookup-row">
                                <input
                                    className="form-input"
                                    placeholder="Nome do centro de custo"
                                    value={newCostCenterName}
                                    onChange={e => setNewCostCenterName(e.target.value)}
                                />
                                <input
                                    className="form-input"
                                    placeholder="Codigo (opcional)"
                                    value={newCostCenterCode}
                                    onChange={e => setNewCostCenterCode(e.target.value)}
                                />
                                <button className="btn btn-outline" onClick={onCreateCostCenter}>
                                    <Plus size={14} />
                                </button>
                            </div>
                            <div className="chip-wrap">
                                {costCenters.map(center => (
                                    <span key={center.id} className="lookup-chip">
                                        {center.name}{center.code ? ` (${center.code})` : ''}
                                        <button onClick={() => deleteLookup('cost_center', center.id)} title="Remover centro de custo">
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="lookup-box">
                            <div className="lookup-title">Contas bancarias</div>
                            <div className="lookup-row">
                                <input
                                    className="form-input"
                                    placeholder="Nome da conta"
                                    value={newBankAccountName}
                                    onChange={e => setNewBankAccountName(e.target.value)}
                                />
                                <input
                                    className="form-input"
                                    placeholder="Banco (opcional)"
                                    value={newBankAccountBank}
                                    onChange={e => setNewBankAccountBank(e.target.value)}
                                />
                                <button className="btn btn-outline" onClick={onCreateBankAccount}>
                                    <Plus size={14} />
                                </button>
                            </div>
                            <div className="chip-wrap">
                                {bankAccounts.map(account => (
                                    <span key={account.id} className="lookup-chip">
                                        {account.name}{account.bank_name ? ` (${account.bank_name})` : ''}
                                        <button onClick={() => deleteLookup('bank_account', account.id)} title="Remover conta bancaria">
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                        </div>
                    )}
                </div>
            )}

            {showNovoLancamento && (
            <div id="finance-novo-lancamento" className="chart-card" style={{ marginBottom: 18, scrollMarginTop: 96 }}>
                <div className="chart-title" style={{ marginBottom: 12 }}>Novo lancamento</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    <div style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Descricao</label>
                        <input
                            className="form-input"
                            value={form.description}
                            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Ex: Abastecimento carro diretoria"
                        />
                    </div>
                    <div>
                        <label className="form-label">Tipo</label>
                        <select
                            className="form-input"
                            value={form.entry_type}
                            onChange={e => setForm(prev => ({
                                ...prev,
                                entry_type: e.target.value as EntryType,
                                category: '',
                                subcategory: '',
                            }))}
                        >
                            <option value="expense">Despesa</option>
                            <option value="income">Receita</option>
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Valor (R$)</label>
                        <input
                            className="form-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.amount}
                            onChange={e => setForm(prev => ({ ...prev, amount: e.target.value }))}
                            placeholder="0,00"
                        />
                    </div>
                    <div>
                        <label className="form-label">Categoria</label>
                        <select
                            className="form-input"
                            value={form.category}
                            onChange={e => setForm(prev => ({
                                ...prev,
                                category: e.target.value,
                                subcategory: '',
                            }))}
                        >
                            <option value="">Sem categoria</option>
                            {categoryOptions.map(cat => (
                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Subcategoria</label>
                        <select
                            className="form-input"
                            value={form.subcategory}
                            onChange={e => setForm(prev => ({ ...prev, subcategory: e.target.value }))}
                            disabled={!selectedCategory}
                        >
                            <option value="">Sem subcategoria</option>
                            {subcategoryOptions.map(sub => (
                                <option key={sub.id} value={sub.name}>{sub.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Data</label>
                        <input
                            className="form-input"
                            type="date"
                            value={form.entry_date}
                            onChange={e => {
                                const nextDate = e.target.value
                                setForm(prev => ({
                                    ...prev,
                                    entry_date: nextDate,
                                    due_date: prev.due_date || nextDate,
                                    competence_date: prev.competence_date || nextDate,
                                }))
                            }}
                        />
                    </div>
                    <div>
                        <label className="form-label">Vencimento</label>
                        <input
                            className="form-input"
                            type="date"
                            value={form.due_date}
                            onChange={e => setForm(prev => ({ ...prev, due_date: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="form-label">Competencia</label>
                        <input
                            className="form-input"
                            type="date"
                            value={form.competence_date}
                            onChange={e => setForm(prev => ({ ...prev, competence_date: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="form-label">Forma de pagamento</label>
                        <select
                            className="form-input"
                            value={form.payment_method}
                            onChange={e => setForm(prev => ({ ...prev, payment_method: e.target.value }))}
                        >
                            <option value="">Nao informado</option>
                            {paymentMethods.map(pm => (
                                <option key={pm.id} value={pm.name}>{pm.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Centro de custo</label>
                        <select
                            className="form-input"
                            value={form.cost_center_id}
                            onChange={e => setForm(prev => ({ ...prev, cost_center_id: e.target.value }))}
                        >
                            <option value="">Nao informado</option>
                            {costCenters.map(center => (
                                <option key={center.id} value={center.id}>
                                    {center.name}{center.code ? ` (${center.code})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Conta bancaria</label>
                        <select
                            className="form-input"
                            value={form.bank_account_id}
                            onChange={e => setForm(prev => ({ ...prev, bank_account_id: e.target.value }))}
                        >
                            <option value="">Nao informado</option>
                            {bankAccounts.map(account => (
                                <option key={account.id} value={account.id}>
                                    {account.name}{account.bank_name ? ` (${account.bank_name})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Status pagamento</label>
                        <select
                            className="form-input"
                            value={form.payment_status}
                            onChange={e => setForm(prev => ({ ...prev, payment_status: e.target.value as PaymentStatus }))}
                        >
                            <option value="paid">Pago</option>
                            <option value="pending">Pendente</option>
                            <option value="cancelled">Cancelado</option>
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Favorecido</label>
                        <select
                            className="form-input"
                            value={form.counterparty_name}
                            onChange={e => setForm(prev => ({ ...prev, counterparty_name: e.target.value }))}
                        >
                            <option value="">Nao informado</option>
                            {counterparties.map(counterparty => (
                                <option key={counterparty.id} value={counterparty.name}>
                                    {counterparty.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Tipo pessoa</label>
                        <select
                            className="form-input"
                            value={form.counterparty_type}
                            onChange={e => setForm(prev => ({ ...prev, counterparty_type: e.target.value as CounterpartyType }))}
                        >
                            <option value="pessoa_juridica">Pessoa juridica</option>
                            <option value="pessoa_fisica">Pessoa fisica</option>
                        </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Empresa / centro de custo</label>
                        <input
                            className="form-input"
                            value={form.reference_company}
                            onChange={e => setForm(prev => ({ ...prev, reference_company: e.target.value }))}
                            placeholder="Ex: Pilger Matriz, Filial BC, Diretoria, Operacao"
                        />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Observacoes</label>
                        <textarea
                            className="form-textarea"
                            rows={3}
                            value={form.notes}
                            onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Detalhes opcionais do lancamento"
                        />
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                    <button className="btn btn-gold" onClick={onCreateEntry} disabled={saving}>
                        <Plus size={16} /> {saving ? 'Salvando...' : 'Salvar lancamento'}
                    </button>
                </div>
            </div>
            )}

            {showResumo && (
            <div id="finance-resumo" className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))', marginBottom: 18, scrollMarginTop: 96 }}>
                <div className="kpi-card">
                    <div className="kpi-label">Receitas</div>
                    <div className="kpi-value" style={{ color: '#22c55e' }}>{formatCurrency(summary.income)}</div>
                    <div className="kpi-change up" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ArrowUpCircle size={14} /> Entradas no periodo
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Despesas</div>
                    <div className="kpi-value" style={{ color: '#ef4444' }}>{formatCurrency(summary.expense)}</div>
                    <div className="kpi-change down" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ArrowDownCircle size={14} /> Saidas no periodo
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Saldo</div>
                    <div className="kpi-value" style={{ color: summary.balance >= 0 ? '#22c55e' : '#ef4444' }}>
                        {formatCurrency(summary.balance)}
                    </div>
                    <div className={summary.balance >= 0 ? 'kpi-change up' : 'kpi-change down'}>
                        {summary.balance >= 0 ? 'Caixa positivo' : 'Caixa negativo'}
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Movimentacao</div>
                    <div className="kpi-value">{formatCurrency(summary.total)}</div>
                    <div className="kpi-change" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                        <Wallet size={14} /> {filteredEntries.length} lancamentos
                    </div>
                </div>
            </div>
            )}

            {showResumo && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 18 }}>
                <div className="chart-card">
                    <div className="chart-title" style={{ marginBottom: 12 }}>Evolucao mensal</div>
                    <div style={{ width: '100%', height: 320 }}>
                        <ResponsiveContainer>
                            <AreaChart data={monthlySeries}>
                                <defs>
                                    <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.45} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                                    </linearGradient>
                                    <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.45} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.2)" />
                                <XAxis dataKey="label" stroke="#9ca3af" />
                                <YAxis stroke="#9ca3af" />
                                <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                                <Legend />
                                <Area type="monotone" dataKey="income" name="Receitas" stroke="#22c55e" fill="url(#incomeGradient)" strokeWidth={2} />
                                <Area type="monotone" dataKey="expense" name="Despesas" stroke="#ef4444" fill="url(#expenseGradient)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="chart-card">
                    <div className="chart-title" style={{ marginBottom: 12 }}>Despesas por categoria</div>
                    <div style={{ width: '100%', height: 320 }}>
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie
                                    data={expenseByCategory}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={62}
                                    outerRadius={110}
                                    paddingAngle={2}
                                >
                                    {expenseByCategory.map((_, idx) => (
                                        <Cell key={`cell-${idx}`} fill={EXPENSE_COLORS[idx % EXPENSE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
            )}

            {showContasPagar && (
            <>
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 18 }}>
                <div className="kpi-card">
                    <div className="kpi-label">Total a pagar</div>
                    <div className="kpi-value" style={{ color: '#ef4444' }}>{formatCurrency(payablesSummary.total)}</div>
                    <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>{payablesSummary.count} contas</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Pago</div>
                    <div className="kpi-value" style={{ color: '#22c55e' }}>{formatCurrency(payablesSummary.paid)}</div>
                    <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>{payablesSummary.paidCount} contas</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Em aberto</div>
                    <div className="kpi-value" style={{ color: '#f59e0b' }}>{formatCurrency(payablesSummary.pending)}</div>
                    <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>{payablesSummary.pendingCount} contas</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Vencido</div>
                    <div className="kpi-value" style={{ color: '#ef4444' }}>{formatCurrency(payablesSummary.overdue)}</div>
                    <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>{payablesSummary.overdueCount} contas</div>
                </div>
            </div>

            <div id="finance-contas-pagar" className="chart-card" style={{ marginTop: 18, scrollMarginTop: 96 }}>
                <div className="chart-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CircleDollarSign size={18} /> Contas a Pagar
                </div>
                {aparLoading ? (
                    <div style={{ padding: 24, color: 'var(--text-muted)' }}>Carregando contas a pagar...</div>
                ) : filteredPayables.length === 0 ? (
                    <div style={{ padding: 24, color: 'var(--text-muted)' }}>
                        Nenhuma conta a pagar encontrada para o periodo selecionado.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Vencimento</th>
                                    <th>Competencia</th>
                                    <th>Descricao</th>
                                    <th>Favorecido</th>
                                    <th>Categoria</th>
                                    <th>Subcategoria</th>
                                    <th>Valor</th>
                                    <th>Pago</th>
                                    <th>Saldo</th>
                                    <th>Status</th>
                                    <th>Centro custo</th>
                                    <th>Conta bancaria</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPayables.map(entry => {
                                    const settlement = getPayableSettlementStatus(entry, todayDate)
                                    const badgeStyle = getSettlementBadgeStyle(settlement)
                                    const isSettling = settlingAparId === entry.id
                                    return (
                                        <tr key={entry.id}>
                                            <td>{entry.due_date ? formatDate(entry.due_date) : '-'}</td>
                                            <td>{entry.competence_date ? formatDate(entry.competence_date) : '-'}</td>
                                            <td>{entry.description}</td>
                                            <td>{entry.counterparty_name || '-'}</td>
                                            <td>{entry.category || 'Sem categoria'}</td>
                                            <td>{entry.subcategory || '-'}</td>
                                            <td style={{ fontWeight: 700, color: '#ef4444' }}>{formatCurrency(Number(entry.amount || 0))}</td>
                                            <td style={{ fontWeight: 700, color: '#22c55e' }}>{formatCurrency(Number(entry.settled_amount || 0))}</td>
                                            <td style={{ fontWeight: 700, color: '#f59e0b' }}>{formatCurrency(Number(entry.remaining_amount || 0))}</td>
                                            <td>
                                                <span style={{ borderRadius: 999, padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, ...badgeStyle }}>
                                                    {translateSettlementStatus(settlement)}
                                                </span>
                                            </td>
                                            <td>{entry.cost_center_id ? (costCenterById.get(entry.cost_center_id)?.name || entry.cost_center_id) : '-'}</td>
                                            <td>{entry.bank_account_id ? (bankAccountById.get(entry.bank_account_id)?.name || entry.bank_account_id) : '-'}</td>
                                            <td>
                                                {settlement === 'paid' ? (
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline"
                                                        onClick={() => onSettleApar('payable', entry, 'reopen')}
                                                        disabled={isSettling}
                                                        style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                                    >
                                                        {isSettling ? 'Salvando...' : 'Reabrir'}
                                                    </button>
                                                ) : (
                                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline"
                                                            onClick={() => onSettleApar('payable', entry, 'partial')}
                                                            disabled={isSettling}
                                                            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                                        >
                                                            {isSettling ? 'Salvando...' : 'Baixa parcial'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-gold"
                                                            onClick={() => onSettleApar('payable', entry, 'full')}
                                                            disabled={isSettling}
                                                            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                                        >
                                                            {isSettling ? 'Salvando...' : 'Quitar'}
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
            </>
            )}

            {showContasReceber && (
            <>
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 18 }}>
                <div className="kpi-card">
                    <div className="kpi-label">Total a receber</div>
                    <div className="kpi-value" style={{ color: '#22c55e' }}>{formatCurrency(receivablesSummary.total)}</div>
                    <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>{receivablesSummary.count} contas</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Recebido</div>
                    <div className="kpi-value" style={{ color: '#22c55e' }}>{formatCurrency(receivablesSummary.received)}</div>
                    <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>{receivablesSummary.receivedCount} contas</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Em aberto</div>
                    <div className="kpi-value" style={{ color: '#f59e0b' }}>{formatCurrency(receivablesSummary.pending)}</div>
                    <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>{receivablesSummary.pendingCount} contas</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Vencido</div>
                    <div className="kpi-value" style={{ color: '#ef4444' }}>{formatCurrency(receivablesSummary.overdue)}</div>
                    <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>{receivablesSummary.overdueCount} contas</div>
                </div>
            </div>

            <div id="finance-contas-receber" className="chart-card" style={{ marginTop: 18, scrollMarginTop: 96 }}>
                <div className="chart-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CircleDollarSign size={18} /> Contas a Receber
                </div>
                {aparLoading ? (
                    <div style={{ padding: 24, color: 'var(--text-muted)' }}>Carregando contas a receber...</div>
                ) : filteredReceivables.length === 0 ? (
                    <div style={{ padding: 24, color: 'var(--text-muted)' }}>
                        Nenhuma conta a receber encontrada para o periodo selecionado.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Vencimento</th>
                                    <th>Competencia</th>
                                    <th>Descricao</th>
                                    <th>Cliente/Fonte</th>
                                    <th>Categoria</th>
                                    <th>Subcategoria</th>
                                    <th>Valor</th>
                                    <th>Recebido</th>
                                    <th>Saldo</th>
                                    <th>Status</th>
                                    <th>Centro custo</th>
                                    <th>Conta bancaria</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredReceivables.map(entry => {
                                    const settlement = getReceivableSettlementStatus(entry, todayDate)
                                    const badgeStyle = getSettlementBadgeStyle(settlement)
                                    const isSettling = settlingAparId === entry.id
                                    return (
                                        <tr key={entry.id}>
                                            <td>{entry.due_date ? formatDate(entry.due_date) : '-'}</td>
                                            <td>{entry.competence_date ? formatDate(entry.competence_date) : '-'}</td>
                                            <td>{entry.description}</td>
                                            <td>{entry.counterparty_name || '-'}</td>
                                            <td>{entry.category || 'Sem categoria'}</td>
                                            <td>{entry.subcategory || '-'}</td>
                                            <td style={{ fontWeight: 700, color: '#22c55e' }}>{formatCurrency(Number(entry.amount || 0))}</td>
                                            <td style={{ fontWeight: 700, color: '#22c55e' }}>{formatCurrency(Number(entry.settled_amount || 0))}</td>
                                            <td style={{ fontWeight: 700, color: '#f59e0b' }}>{formatCurrency(Number(entry.remaining_amount || 0))}</td>
                                            <td>
                                                <span style={{ borderRadius: 999, padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, ...badgeStyle }}>
                                                    {translateSettlementStatus(settlement)}
                                                </span>
                                            </td>
                                            <td>{entry.cost_center_id ? (costCenterById.get(entry.cost_center_id)?.name || entry.cost_center_id) : '-'}</td>
                                            <td>{entry.bank_account_id ? (bankAccountById.get(entry.bank_account_id)?.name || entry.bank_account_id) : '-'}</td>
                                            <td>
                                                {settlement === 'paid' ? (
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline"
                                                        onClick={() => onSettleApar('receivable', entry, 'reopen')}
                                                        disabled={isSettling}
                                                        style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                                    >
                                                        {isSettling ? 'Salvando...' : 'Reabrir'}
                                                    </button>
                                                ) : (
                                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline"
                                                            onClick={() => onSettleApar('receivable', entry, 'partial')}
                                                            disabled={isSettling}
                                                            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                                        >
                                                            {isSettling ? 'Salvando...' : 'Receber parcial'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-gold"
                                                            onClick={() => onSettleApar('receivable', entry, 'full')}
                                                            disabled={isSettling}
                                                            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                                        >
                                                            {isSettling ? 'Salvando...' : 'Marcar como Recebido'}
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
            </>
            )}

            {showConciliacaoBancaria && (
            <>
            <div className="chart-card" style={{ marginBottom: 18, scrollMarginTop: 96 }}>
                <div className="chart-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Link2 size={18} /> Filtros de conciliacao
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    <div>
                        <label className="form-label">Data inicial extrato</label>
                        <input
                            className="form-input"
                            type="date"
                            value={reconciliationStartDate}
                            onChange={e => setReconciliationStartDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="form-label">Data final extrato</label>
                        <input
                            className="form-input"
                            type="date"
                            value={reconciliationEndDate}
                            onChange={e => setReconciliationEndDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="form-label">Conta bancaria</label>
                        <select
                            className="form-input"
                            value={reconciliationBankAccountFilter}
                            onChange={e => setReconciliationBankAccountFilter(e.target.value)}
                        >
                            <option value="all">Todas contas</option>
                            {bankAccounts.map(account => (
                                <option key={account.id} value={account.id}>
                                    {account.name}{account.bank_name ? ` (${account.bank_name})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Status</label>
                        <select
                            className="form-input"
                            value={reconciliationStatusFilter}
                            onChange={e => setReconciliationStatusFilter(e.target.value as 'all' | ReconciliationStatus)}
                        >
                            <option value="all">Todos</option>
                            <option value="pending">Pendente</option>
                            <option value="matched">Conciliado</option>
                            <option value="ignored">Ignorado</option>
                        </select>
                    </div>
                    <div style={{ alignSelf: 'end', display: 'flex', gap: 8 }}>
                        <button className="btn btn-gold" onClick={fetchReconciliations} disabled={reconciliationsLoading}>
                            <RefreshCw size={16} className={reconciliationsLoading ? 'spin' : ''} /> Atualizar conciliacao
                        </button>
                        <button
                            className="btn btn-outline"
                            onClick={() => {
                                setReconciliationStartDate('')
                                setReconciliationEndDate('')
                                setReconciliationBankAccountFilter('all')
                                setReconciliationStatusFilter('all')
                            }}
                        >
                            Limpar filtros
                        </button>
                    </div>
                </div>
            </div>

            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 18 }}>
                <div className="kpi-card">
                    <div className="kpi-label">Extratos no periodo</div>
                    <div className="kpi-value">{reconciliationSummary.count}</div>
                    <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>itens de extrato</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Valor total extrato</div>
                    <div className="kpi-value">{formatCurrency(reconciliationSummary.total)}</div>
                    <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>soma de entradas</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Pendente</div>
                    <div className="kpi-value" style={{ color: '#f59e0b' }}>{formatCurrency(reconciliationSummary.pending)}</div>
                    <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>aguardando conferencia</div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-label">Conciliado</div>
                    <div className="kpi-value" style={{ color: '#22c55e' }}>{formatCurrency(reconciliationSummary.matched)}</div>
                    <div className="kpi-change" style={{ color: 'var(--text-muted)' }}>ja casado com lancamento</div>
                </div>
            </div>

            <div id="finance-conciliacao" className="chart-card" style={{ marginBottom: 18, scrollMarginTop: 96 }}>
                <div className="chart-title" style={{ marginBottom: 12 }}>
                    {editingReconciliationId ? 'Editar conciliacao' : 'Novo item de conciliacao'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    <div>
                        <label className="form-label">Data do extrato</label>
                        <input
                            className="form-input"
                            type="date"
                            value={reconciliationForm.statement_date}
                            onChange={e => setReconciliationForm(prev => ({ ...prev, statement_date: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="form-label">Valor do extrato (R$)</label>
                        <input
                            className="form-input"
                            type="number"
                            step="0.01"
                            value={reconciliationForm.amount}
                            onChange={e => setReconciliationForm(prev => ({ ...prev, amount: e.target.value }))}
                            placeholder="Ex: 1500.00 ou -1500.00"
                        />
                    </div>
                    <div>
                        <label className="form-label">Conta bancaria</label>
                        <select
                            className="form-input"
                            value={reconciliationForm.bank_account_id}
                            onChange={e => setReconciliationForm(prev => ({ ...prev, bank_account_id: e.target.value }))}
                        >
                            <option value="">Nao informado</option>
                            {bankAccounts.map(account => (
                                <option key={account.id} value={account.id}>
                                    {account.name}{account.bank_name ? ` (${account.bank_name})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Status</label>
                        <select
                            className="form-input"
                            value={reconciliationForm.status}
                            onChange={e => setReconciliationForm(prev => ({ ...prev, status: e.target.value as ReconciliationStatus }))}
                        >
                            <option value="pending">Pendente</option>
                            <option value="matched">Conciliado</option>
                            <option value="ignored">Ignorado</option>
                        </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Lancamento vinculado</label>
                        <select
                            className="form-input"
                            value={reconciliationForm.matched_entry_id}
                            onChange={e => setReconciliationForm(prev => ({ ...prev, matched_entry_id: e.target.value }))}
                        >
                            <option value="">Sem vinculo</option>
                            {reconciliationEntryOptions.map(option => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                        <label className="form-label">Descricao do extrato</label>
                        <input
                            className="form-input"
                            value={reconciliationForm.description}
                            onChange={e => setReconciliationForm(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Ex: TED fornecedor XPTO"
                        />
                    </div>
                    <div>
                        <label className="form-label">Referencia externa</label>
                        <input
                            className="form-input"
                            value={reconciliationForm.external_ref}
                            onChange={e => setReconciliationForm(prev => ({ ...prev, external_ref: e.target.value }))}
                            placeholder="Ex: NSU, ID banco"
                        />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Observacoes</label>
                        <textarea
                            className="form-textarea"
                            rows={2}
                            value={reconciliationForm.notes}
                            onChange={e => setReconciliationForm(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Notas internas da conciliacao"
                        />
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                    {editingReconciliationId && (
                        <button type="button" className="btn btn-outline" onClick={resetReconciliationForm}>
                            Cancelar edicao
                        </button>
                    )}
                    <button type="button" className="btn btn-gold" onClick={onSaveReconciliation} disabled={savingReconciliation}>
                        {savingReconciliation ? 'Salvando...' : (editingReconciliationId ? 'Salvar alteracoes' : 'Adicionar conciliacao')}
                    </button>
                </div>
            </div>

            <div className="chart-card" style={{ marginTop: 18, scrollMarginTop: 96 }}>
                <div className="chart-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Link2 size={18} /> Itens de conciliacao
                </div>
                {reconciliationsLoading ? (
                    <div style={{ padding: 24, color: 'var(--text-muted)' }}>Carregando conciliacoes...</div>
                ) : reconciliations.length === 0 ? (
                    <div style={{ padding: 24, color: 'var(--text-muted)' }}>Nenhum item de conciliacao encontrado.</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Data extrato</th>
                                    <th>Conta bancaria</th>
                                    <th>Descricao</th>
                                    <th>Valor extrato</th>
                                    <th>Lancamento vinculado</th>
                                    <th>Status</th>
                                    <th>Ref externa</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {reconciliations.map(row => {
                                    const statusStyle = getReconciliationBadgeStyle(row.status)
                                    const entry = row.matched_entry_id ? (entryById.get(row.matched_entry_id) || null) : null
                                    const matchedEntryLabel = row.matched_entry
                                        ? `${formatDate(row.matched_entry.entry_date)} | ${formatCurrency(Number(row.matched_entry.amount || 0))} | ${row.matched_entry.description}`
                                        : (entry
                                            ? `${formatDate(entry.entry_date)} | ${formatCurrency(Number(entry.amount || 0))} | ${entry.description}`
                                            : '-')

                                    return (
                                        <tr key={row.id}>
                                            <td>{formatDate(row.statement_date)}</td>
                                            <td>{row.bank_account?.name || (row.bank_account_id ? (bankAccountById.get(row.bank_account_id)?.name || row.bank_account_id) : '-')}</td>
                                            <td>{row.description || '-'}</td>
                                            <td style={{ fontWeight: 700, color: Number(row.amount || 0) >= 0 ? '#22c55e' : '#ef4444' }}>
                                                {formatCurrency(Number(row.amount || 0))}
                                            </td>
                                            <td>{matchedEntryLabel}</td>
                                            <td>
                                                <span style={{ borderRadius: 999, padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, ...statusStyle }}>
                                                    {translateReconciliationStatus(row.status)}
                                                </span>
                                            </td>
                                            <td>{row.external_ref || '-'}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                    {row.status !== 'matched' && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-gold"
                                                            style={{ padding: '6px 10px', fontSize: '0.74rem' }}
                                                            onClick={() => onSetReconciliationStatus(row, 'matched')}
                                                            disabled={!row.matched_entry_id}
                                                            title={!row.matched_entry_id ? 'Defina um lancamento vinculado para conciliar' : 'Marcar como conciliado'}
                                                        >
                                                            Conciliar
                                                        </button>
                                                    )}
                                                    {row.status !== 'pending' && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline"
                                                            style={{ padding: '6px 10px', fontSize: '0.74rem' }}
                                                            onClick={() => onSetReconciliationStatus(row, 'pending')}
                                                        >
                                                            Pendente
                                                        </button>
                                                    )}
                                                    {row.status !== 'ignored' && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline"
                                                            style={{ padding: '6px 10px', fontSize: '0.74rem' }}
                                                            onClick={() => onSetReconciliationStatus(row, 'ignored')}
                                                        >
                                                            Ignorar
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline"
                                                        style={{ padding: '6px 10px', fontSize: '0.74rem' }}
                                                        onClick={() => onEditReconciliation(row)}
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onDeleteReconciliation(row.id)}
                                                        disabled={deletingReconciliationId === row.id}
                                                        style={{
                                                            border: '1px solid rgba(239,68,68,0.25)',
                                                            background: 'rgba(239,68,68,0.1)',
                                                            color: '#ef4444',
                                                            borderRadius: 8,
                                                            padding: '6px 8px',
                                                            cursor: 'pointer',
                                                        }}
                                                        title="Excluir item de conciliacao"
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
            </>
            )}

            {showLancamentos && (
            <div id="finance-lancamentos" className="chart-card" style={{ marginTop: 18, scrollMarginTop: 96 }}>
                <div className="chart-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CircleDollarSign size={18} /> Lancamentos
                </div>
                {loading ? (
                    <div style={{ padding: 24, color: 'var(--text-muted)' }}>Carregando lancamentos...</div>
                ) : filteredEntries.length === 0 ? (
                    <div style={{ padding: 24, color: 'var(--text-muted)' }}>
                        Nenhum lancamento encontrado para o periodo selecionado.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        {highlightedEntryId && (
                            <div style={{
                                marginBottom: 10,
                                padding: '8px 10px',
                                borderRadius: 8,
                                border: hasHighlightedEntryInList
                                    ? '1px solid rgba(34,197,94,0.28)'
                                    : '1px solid rgba(245,158,11,0.28)',
                                background: hasHighlightedEntryInList
                                    ? 'rgba(34,197,94,0.08)'
                                    : 'rgba(245,158,11,0.08)',
                                color: hasHighlightedEntryInList ? '#16a34a' : '#b45309',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                            }}>
                                {hasHighlightedEntryInList
                                    ? 'Lancamento relacionado a comissao destacado abaixo.'
                                    : 'Lancamento informado nao encontrado nos filtros atuais.'}
                            </div>
                        )}
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Vencimento</th>
                                    <th>Competencia</th>
                                    <th>Descricao</th>
                                    <th>Categoria</th>
                                    <th>Subcategoria</th>
                                    <th>Tipo</th>
                                    <th>Valor</th>
                                    <th>Pagamento</th>
                                    <th>Status</th>
                                    <th>Favorecido</th>
                                    <th>Tipo pessoa</th>
                                    <th>Centro custo</th>
                                    <th>Conta bancaria</th>
                                    <th>Empresa/CC</th>
                                    <th>Origem</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEntries.map(entry => {
                                    const isHighlighted = highlightedEntryId === entry.id
                                    const sourceModule = String(entry.source_module || '').trim().toLowerCase()
                                    const linkedCommissionId = sourceModule === 'finance_commissions'
                                        ? String(entry.external_reference || '').trim()
                                        : ''
                                    return (
                                    <tr
                                        key={entry.id}
                                        id={`finance-entry-row-${entry.id}`}
                                        style={isHighlighted ? {
                                            background: 'rgba(34,197,94,0.12)',
                                            boxShadow: 'inset 0 0 0 1px rgba(34,197,94,0.35)',
                                        } : undefined}
                                    >
                                        <td>{formatDate(entry.entry_date)}</td>
                                        <td>{entry.due_date ? formatDate(entry.due_date) : '-'}</td>
                                        <td>{entry.competence_date ? formatDate(entry.competence_date) : '-'}</td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{entry.description}</div>
                                            {entry.notes ? (
                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{entry.notes}</div>
                                            ) : null}
                                        </td>
                                        <td>{entry.category || 'Sem categoria'}</td>
                                        <td>{entry.subcategory || '-'}</td>
                                        <td>
                                            <span className={`badge ${entry.entry_type === 'income' ? 'badge-success' : 'badge-danger'}`}>
                                                {entry.entry_type === 'income' ? 'Receita' : 'Despesa'}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 700, color: entry.entry_type === 'income' ? '#22c55e' : '#ef4444' }}>
                                            {formatCurrency(Number(entry.amount || 0))}
                                        </td>
                                        <td>{entry.payment_method || '-'}</td>
                                        <td>{translatePaymentStatus(entry.payment_status)}</td>
                                        <td>{entry.counterparty_name || '-'}</td>
                                        <td>{translateCounterpartyType(entry.counterparty_type)}</td>
                                        <td>{entry.cost_center_id ? (costCenterById.get(entry.cost_center_id)?.name || entry.cost_center_id) : '-'}</td>
                                        <td>{entry.bank_account_id ? (bankAccountById.get(entry.bank_account_id)?.name || entry.bank_account_id) : '-'}</td>
                                        <td>{entry.reference_company || '-'}</td>
                                        <td>
                                            {linkedCommissionId ? (
                                                <Link
                                                    href={`/admin/finance/comissoes?commission_id=${encodeURIComponent(linkedCommissionId)}`}
                                                    className="btn btn-outline"
                                                    style={{ padding: '4px 8px', fontSize: '0.72rem', textDecoration: 'none' }}
                                                >
                                                    Comissao
                                                </Link>
                                            ) : '-'}
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                onClick={() => onDeleteEntry(entry.id)}
                                                style={{
                                                    border: '1px solid rgba(239,68,68,0.25)',
                                                    background: 'rgba(239,68,68,0.1)',
                                                    color: '#ef4444',
                                                    borderRadius: 8,
                                                    padding: '6px 8px',
                                                    cursor: 'pointer',
                                                }}
                                                title="Excluir lancamento"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
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
                .lookup-box {
                    border: 1px solid rgba(148, 163, 184, 0.2);
                    border-radius: 10px;
                    padding: 14px;
                    background: rgba(15, 23, 42, 0.02);
                    min-height: 420px;
                    display: flex;
                    flex-direction: column;
                }
                .lookup-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
                    gap: 14px;
                    align-items: stretch;
                }
                .lookup-title {
                    font-size: 0.94rem;
                    font-weight: 700;
                    margin-bottom: 10px;
                }
                .lookup-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr auto;
                    gap: 10px;
                    margin-bottom: 12px;
                }
                .chip-wrap {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    min-height: 300px;
                    max-height: 460px;
                    flex: 1;
                    overflow: auto;
                    padding-right: 2px;
                    align-content: flex-start;
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
                .spin {
                    animation: financeSpin 1s linear infinite;
                }
                @keyframes financeSpin {
                    to { transform: rotate(360deg); }
                }
                @media (max-width: 820px) {
                    .lookup-grid {
                        grid-template-columns: 1fr;
                    }
                    .lookup-row {
                        grid-template-columns: 1fr;
                    }
                    .lookup-box {
                        min-height: 0;
                    }
                    .chip-wrap {
                        min-height: 120px;
                        max-height: 280px;
                    }
                }
            `}</style>
        </div>
    )
}

function FinancePageFallback() {
    return (
        <div style={{ padding: '24px 18px 36px' }}>
            <div className="chart-card" style={{ color: 'var(--text-muted)' }}>
                Carregando financeiro...
            </div>
        </div>
    )
}

export default function FinancePage({ initialSection }: { initialSection?: string }) {
    return (
        <Suspense fallback={<FinancePageFallback />}>
            <FinancePageContent initialSection={initialSection} />
        </Suspense>
    )
}
