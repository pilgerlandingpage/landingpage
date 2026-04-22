'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
    ArrowDownCircle,
    ArrowUpCircle,
    CalendarDays,
    CircleDollarSign,
    Landmark,
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
type LookupEntity = 'category' | 'subcategory' | 'payment_method' | 'counterparty'

interface FinanceEntry {
    id: string
    description: string
    entry_type: EntryType
    amount: number
    category: string | null
    subcategory: string | null
    entry_date: string
    payment_method: string | null
    payment_status: PaymentStatus | null
    counterparty_name: string | null
    counterparty_type: CounterpartyType | null
    reference_company: string | null
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

function translateCounterpartyType(value: string | null | undefined) {
    if (value === 'pessoa_fisica') return 'Pessoa fisica'
    if (value === 'pessoa_juridica') return 'Pessoa juridica'
    return '-'
}

export default function FinancePage({ initialSection }: { initialSection?: string }) {
    const pathname = usePathname()
    const [entries, setEntries] = useState<FinanceEntry[]>([])
    const [categories, setCategories] = useState<FinanceCategory[]>([])
    const [subcategories, setSubcategories] = useState<FinanceSubcategory[]>([])
    const [paymentMethods, setPaymentMethods] = useState<FinancePaymentMethod[]>([])
    const [counterparties, setCounterparties] = useState<FinanceCounterparty[]>([])

    const [loading, setLoading] = useState(true)
    const [lookupsLoading, setLookupsLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState<ToastState | null>(null)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [typeFilter, setTypeFilter] = useState<'all' | EntryType>('all')
    const [categoryFilter, setCategoryFilter] = useState('all')
    const [subcategoryFilter, setSubcategoryFilter] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')

    const [form, setForm] = useState({
        description: '',
        entry_type: 'expense' as EntryType,
        amount: '',
        category: '',
        subcategory: '',
        entry_date: todayISO(),
        payment_method: '',
        payment_status: 'paid' as PaymentStatus,
        counterparty_name: '',
        counterparty_type: 'pessoa_juridica' as CounterpartyType,
        reference_company: '',
        notes: '',
    })

    const [newCategoryName, setNewCategoryName] = useState('')
    const [newCategoryType, setNewCategoryType] = useState<EntryType | 'both'>('expense')
    const [newSubcategoryName, setNewSubcategoryName] = useState('')
    const [newSubcategoryCategoryId, setNewSubcategoryCategoryId] = useState('')
    const [newPaymentMethodName, setNewPaymentMethodName] = useState('')
    const [newCounterpartyName, setNewCounterpartyName] = useState('')
    const [newCounterpartyType, setNewCounterpartyType] = useState<CounterpartyType>('pessoa_juridica')

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
    const showSubcategorias = activeSection === 'cadastros' || activeSection === 'subcategorias'
    const showPagamentos = activeSection === 'cadastros' || activeSection === 'pagamentos'
    const showFavorecidos = activeSection === 'cadastros' || activeSection === 'favorecidos'
    const showNovoLancamento = activeSection === 'novo-lancamento'
    const showLancamentos = activeSection === 'lancamentos'
    const showFiltros = activeSection === 'dashboard' || activeSection === 'lancamentos'

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

            if (!newSubcategoryCategoryId && Array.isArray(data.categories) && data.categories.length > 0) {
                setNewSubcategoryCategoryId(data.categories[0].id)
            }
        } catch (err: any) {
            showToast(err.message || 'Erro ao carregar cadastros financeiros', 'error')
        } finally {
            setLookupsLoading(false)
        }
    }

    useEffect(() => {
        fetchEntries()
        fetchLookups()
    }, [])

    const categoryFilterOptions = useMemo(() => {
        const set = new Set<string>()
        categories.forEach(cat => set.add(cat.name))
        entries.forEach(entry => {
            const name = String(entry.category || '').trim()
            if (name) set.add(name)
        })
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    }, [categories, entries])

    const subcategoryFilterOptions = useMemo(() => {
        const set = new Set<string>()
        const selectedCategoryByName = categories.find(cat => cat.name === categoryFilter)

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

        return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    }, [categories, subcategories, entries, categoryFilter])

    const filteredEntries = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase()

        return entries.filter(entry => {
            if (typeFilter !== 'all' && entry.entry_type !== typeFilter) return false
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

    useEffect(() => {
        if (!selectedCounterparty) return
        setForm(prev => ({
            ...prev,
            counterparty_type: selectedCounterparty.party_type,
        }))
    }, [selectedCounterparty])

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

    const onClearSearchFilters = () => {
        setStartDate('')
        setEndDate('')
        setTypeFilter('all')
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
                    <button className="btn btn-outline" onClick={fetchEntries} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spin' : ''} /> Atualizar
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
                        <div>
                            <label className="form-label">Tipo</label>
                            <select className="form-input" value={typeFilter} onChange={e => setTypeFilter(e.target.value as 'all' | EntryType)}>
                                <option value="all">Todos</option>
                                <option value="income">Receitas</option>
                                <option value="expense">Despesas</option>
                            </select>
                        </div>
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
                            <button className="btn btn-gold" onClick={fetchEntries}>
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
                <div id="finance-cadastros" className="chart-card" style={{ marginBottom: 18, scrollMarginTop: 96 }}>
                    <div className="chart-title" style={{ marginBottom: 12 }}>
                        Cadastros financeiros
                    </div>

                    {lookupsLoading ? (
                        <div style={{ color: 'var(--text-muted)' }}>Carregando cadastros...</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
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
                            onChange={e => setForm(prev => ({ ...prev, entry_date: e.target.value }))}
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
                                <Tooltip formatter={(value: number) => formatCurrency(Number(value || 0))} />
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
                                <Tooltip formatter={(value: number) => formatCurrency(Number(value || 0))} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
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
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Descricao</th>
                                    <th>Categoria</th>
                                    <th>Subcategoria</th>
                                    <th>Tipo</th>
                                    <th>Valor</th>
                                    <th>Pagamento</th>
                                    <th>Status</th>
                                    <th>Favorecido</th>
                                    <th>Tipo pessoa</th>
                                    <th>Empresa/CC</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEntries.map(entry => (
                                    <tr key={entry.id}>
                                        <td>{formatDate(entry.entry_date)}</td>
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
                                        <td>{entry.reference_company || '-'}</td>
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
                                ))}
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
                    padding: 10px;
                    background: rgba(15, 23, 42, 0.02);
                }
                .lookup-title {
                    font-size: 0.88rem;
                    font-weight: 700;
                    margin-bottom: 8px;
                }
                .lookup-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr auto;
                    gap: 8px;
                    margin-bottom: 8px;
                }
                .chip-wrap {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    max-height: 120px;
                    overflow: auto;
                    padding-right: 2px;
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
                    .lookup-row {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    )
}
