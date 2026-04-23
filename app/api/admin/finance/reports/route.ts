import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'

type ReportType = 'dre' | 'cashflow'
type DateField = 'entry_date' | 'date' | 'occurred_at' | 'created_at'
type EntryType = 'income' | 'expense'

interface FinanceSchema {
    dateField: DateField
    hasPaymentStatus: boolean
    hasCategory: boolean
    hasSubcategory: boolean
}

interface NormalizedEntry {
    id: string
    entry_type: EntryType
    amount: number
    category: string
    subcategory: string
    description: string
    payment_status: string | null
    entry_date: string
}

interface OpenAparItem {
    id: string
    due_date: string
    description: string
    counterparty_name: string | null
    remaining_amount: number
    status: string
}

function normalizeDate(raw: any): string | null {
    const value = String(raw || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
    return value
}

function todayISO(): string {
    return new Date().toISOString().slice(0, 10)
}

function firstDayOfCurrentMonthISO(): string {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function monthKey(date: string): string {
    return String(date || '').slice(0, 7)
}

function toNumber(value: any): number {
    const n = Number(value || 0)
    return Number.isFinite(n) ? n : 0
}

function toEntryDate(rawValue: any, dateField: DateField): string {
    const raw = String(rawValue || '')
    if (!raw) return ''
    if (dateField === 'created_at' || dateField === 'occurred_at') return raw.slice(0, 10)
    return raw.slice(0, 10)
}

async function getCurrentAdminUser() {
    const supabase = await createServerSupabase()
    const { data: authData, error: authError } = await supabase.auth.getUser()

    if (authError || !authData?.user) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    }

    const admin = createAdminClient()
    const { data: adminUser, error: adminError } = await admin
        .from('admin_users')
        .select('id, is_master, is_active')
        .eq('auth_user_id', authData.user.id)
        .single()

    if (adminError || !adminUser) {
        return { error: NextResponse.json({ error: 'Usuario admin nao encontrado' }, { status: 403 }) }
    }

    if (!adminUser.is_active) {
        return { error: NextResponse.json({ error: 'Usuario desativado' }, { status: 403 }) }
    }

    if (adminUser.is_master) return { adminUser }

    const { data: userSectors } = await admin
        .from('admin_user_sectors')
        .select('sector_id')
        .eq('user_id', adminUser.id)

    const sectorIds = (userSectors || []).map((row: any) => row.sector_id)
    if (sectorIds.length === 0) {
        return { error: NextResponse.json({ error: 'Sem acesso ao modulo financeiro' }, { status: 403 }) }
    }

    const { data: sectorPerms } = await admin
        .from('admin_sector_permissions')
        .select('admin_permissions(module_key)')
        .in('sector_id', sectorIds)

    const hasFinance = (sectorPerms || []).some((row: any) => row.admin_permissions?.module_key === 'finance')
    if (!hasFinance) {
        return { error: NextResponse.json({ error: 'Sem acesso ao modulo financeiro' }, { status: 403 }) }
    }

    return { adminUser }
}

async function columnExists(admin: any, tableName: string, columnName: string): Promise<boolean> {
    const { error } = await admin.from(tableName).select(columnName).limit(1)
    return !error
}

async function resolveFinanceSchema(admin: any): Promise<FinanceSchema | null> {
    const [hasEntryDate, hasDate, hasOccurredAt, hasCreatedAt, hasPaymentStatus, hasCategory, hasSubcategory] = await Promise.all([
        columnExists(admin, 'finance_entries', 'entry_date'),
        columnExists(admin, 'finance_entries', 'date'),
        columnExists(admin, 'finance_entries', 'occurred_at'),
        columnExists(admin, 'finance_entries', 'created_at'),
        columnExists(admin, 'finance_entries', 'payment_status'),
        columnExists(admin, 'finance_entries', 'category'),
        columnExists(admin, 'finance_entries', 'subcategory'),
    ])

    if (!hasEntryDate && !hasDate && !hasOccurredAt && !hasCreatedAt) return null

    const dateField: DateField = hasEntryDate
        ? 'entry_date'
        : (hasDate ? 'date' : (hasOccurredAt ? 'occurred_at' : 'created_at'))

    return {
        dateField,
        hasPaymentStatus,
        hasCategory,
        hasSubcategory,
    }
}

function buildFinanceSelectColumns(schema: FinanceSchema) {
    const columns = ['id', 'entry_type', 'amount', 'description', schema.dateField]
    if (schema.hasPaymentStatus) columns.push('payment_status')
    if (schema.hasCategory) columns.push('category')
    if (schema.hasSubcategory) columns.push('subcategory')
    return columns.join(', ')
}

async function fetchEntriesByPeriod(
    admin: any,
    schema: FinanceSchema,
    startDate: string,
    endDate: string,
): Promise<NormalizedEntry[]> {
    let query = admin
        .from('finance_entries')
        .select(buildFinanceSelectColumns(schema))
        .order(schema.dateField, { ascending: true })
        .limit(100000)

    if (schema.dateField === 'created_at' || schema.dateField === 'occurred_at') {
        query = query
            .gte(schema.dateField, `${startDate}T00:00:00.000Z`)
            .lte(schema.dateField, `${endDate}T23:59:59.999Z`)
    } else {
        query = query
            .gte(schema.dateField, startDate)
            .lte(schema.dateField, endDate)
    }

    const { data, error } = await query
    if (error) throw error

    return (data || []).map((row: any) => ({
        id: row.id,
        entry_type: row.entry_type === 'income' ? 'income' : 'expense',
        amount: toNumber(row.amount),
        category: String(row.category || '').trim() || 'Sem categoria',
        subcategory: String(row.subcategory || '').trim() || 'Sem subcategoria',
        description: String(row.description || '').trim() || '-',
        payment_status: schema.hasPaymentStatus ? String(row.payment_status || '').trim().toLowerCase() || null : 'paid',
        entry_date: toEntryDate(row[schema.dateField], schema.dateField),
    }))
}

function buildDre(entries: NormalizedEntry[]) {
    let totalIncome = 0
    let totalExpense = 0
    const incomeByCategory = new Map<string, number>()
    const expenseByCategory = new Map<string, number>()
    const monthly = new Map<string, { month: string; income: number; expense: number; net: number }>()

    const topExpenseEntries = entries
        .filter(entry => entry.entry_type === 'expense')
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10)
        .map(entry => ({
            id: entry.id,
            date: entry.entry_date,
            description: entry.description,
            category: entry.category,
            amount: entry.amount,
        }))

    for (const entry of entries) {
        const key = monthKey(entry.entry_date)
        if (!monthly.has(key)) {
            monthly.set(key, { month: key, income: 0, expense: 0, net: 0 })
        }
        const bucket = monthly.get(key)!

        if (entry.entry_type === 'income') {
            totalIncome += entry.amount
            bucket.income += entry.amount
            incomeByCategory.set(entry.category, (incomeByCategory.get(entry.category) || 0) + entry.amount)
        } else {
            totalExpense += entry.amount
            bucket.expense += entry.amount
            expenseByCategory.set(entry.category, (expenseByCategory.get(entry.category) || 0) + entry.amount)
        }

        bucket.net = bucket.income - bucket.expense
    }

    const netResult = totalIncome - totalExpense
    const marginPct = totalIncome > 0 ? (netResult / totalIncome) * 100 : 0

    return {
        summary: {
            total_income: totalIncome,
            total_expense: totalExpense,
            net_result: netResult,
            margin_pct: marginPct,
        },
        income_by_category: Array.from(incomeByCategory.entries())
            .map(([category, total]) => ({ category, total }))
            .sort((a, b) => b.total - a.total),
        expense_by_category: Array.from(expenseByCategory.entries())
            .map(([category, total]) => ({ category, total }))
            .sort((a, b) => b.total - a.total),
        monthly: Array.from(monthly.values()).sort((a, b) => a.month.localeCompare(b.month)),
        top_expense_entries: topExpenseEntries,
    }
}

async function fetchOpenAparItems(
    admin: any,
    params: {
        tableName: 'finance_payables' | 'finance_receivables'
        settledAmountColumn: 'paid_amount' | 'received_amount'
        settledStatus: 'paid' | 'received'
        startDate: string
        endDate: string
    },
): Promise<OpenAparItem[]> {
    const hasAmount = await columnExists(admin, params.tableName, 'amount')
    const hasDueDate = await columnExists(admin, params.tableName, 'due_date')
    if (!hasAmount || !hasDueDate) return []

    const [hasStatus, hasSettledAmount, hasDescription, hasCounterpartyName] = await Promise.all([
        columnExists(admin, params.tableName, 'status'),
        columnExists(admin, params.tableName, params.settledAmountColumn),
        columnExists(admin, params.tableName, 'description'),
        columnExists(admin, params.tableName, 'counterparty_name'),
    ])

    const columns = ['id', 'amount', 'due_date']
    if (hasStatus) columns.push('status')
    if (hasSettledAmount) columns.push(params.settledAmountColumn)
    if (hasDescription) columns.push('description')
    if (hasCounterpartyName) columns.push('counterparty_name')

    const { data, error } = await admin
        .from(params.tableName)
        .select(columns.join(', '))
        .gte('due_date', params.startDate)
        .lte('due_date', params.endDate)
        .order('due_date', { ascending: true })
        .limit(100000)

    if (error) return []

    const out: OpenAparItem[] = []
    for (const row of (data || [])) {
        const amount = toNumber(row.amount)
        const settled = hasSettledAmount ? toNumber(row[params.settledAmountColumn]) : 0
        const remaining = Math.max(0, Number((amount - settled).toFixed(2)))
        const status = String(row.status || '').trim().toLowerCase()
        const isCancelled = status === 'cancelled'
        const isSettled = status === params.settledStatus || remaining <= 0

        if (isCancelled || isSettled) continue

        out.push({
            id: String(row.id),
            due_date: String(row.due_date || '').slice(0, 10),
            description: String(row.description || '').trim() || '-',
            counterparty_name: String(row.counterparty_name || '').trim() || null,
            remaining_amount: remaining,
            status: status || 'open',
        })
    }

    return out
}

function buildCashflow(
    entries: NormalizedEntry[],
    openPayables: OpenAparItem[],
    openReceivables: OpenAparItem[],
) {
    const timeline = new Map<string, {
        date: string
        realized_inflow: number
        realized_outflow: number
        projected_inflow: number
        projected_outflow: number
        net: number
        cumulative_net: number
    }>()

    let realizedInflow = 0
    let realizedOutflow = 0
    let projectedInflow = 0
    let projectedOutflow = 0

    const ensureBucket = (date: string) => {
        if (!timeline.has(date)) {
            timeline.set(date, {
                date,
                realized_inflow: 0,
                realized_outflow: 0,
                projected_inflow: 0,
                projected_outflow: 0,
                net: 0,
                cumulative_net: 0,
            })
        }
        return timeline.get(date)!
    }

    for (const entry of entries) {
        const isPaid = !entry.payment_status || entry.payment_status === 'paid'
        if (!isPaid) continue

        const bucket = ensureBucket(entry.entry_date)
        if (entry.entry_type === 'income') {
            realizedInflow += entry.amount
            bucket.realized_inflow += entry.amount
        } else {
            realizedOutflow += entry.amount
            bucket.realized_outflow += entry.amount
        }
    }

    for (const row of openReceivables) {
        const bucket = ensureBucket(row.due_date)
        projectedInflow += row.remaining_amount
        bucket.projected_inflow += row.remaining_amount
    }

    for (const row of openPayables) {
        const bucket = ensureBucket(row.due_date)
        projectedOutflow += row.remaining_amount
        bucket.projected_outflow += row.remaining_amount
    }

    const rows = Array.from(timeline.values()).sort((a, b) => a.date.localeCompare(b.date))
    let cumulative = 0
    for (const row of rows) {
        row.net = (row.realized_inflow + row.projected_inflow) - (row.realized_outflow + row.projected_outflow)
        cumulative += row.net
        row.cumulative_net = cumulative
    }

    return {
        summary: {
            realized_inflow: realizedInflow,
            realized_outflow: realizedOutflow,
            realized_net: realizedInflow - realizedOutflow,
            projected_inflow: projectedInflow,
            projected_outflow: projectedOutflow,
            projected_net: projectedInflow - projectedOutflow,
            combined_net: (realizedInflow - realizedOutflow) + (projectedInflow - projectedOutflow),
        },
        timeline: rows,
        open_receivables: openReceivables
            .slice()
            .sort((a, b) => a.due_date.localeCompare(b.due_date) || b.remaining_amount - a.remaining_amount)
            .slice(0, 20),
        open_payables: openPayables
            .slice()
            .sort((a, b) => a.due_date.localeCompare(b.due_date) || b.remaining_amount - a.remaining_amount)
            .slice(0, 20),
    }
}

export async function GET(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const { searchParams } = new URL(request.url)
        const reportRaw = String(searchParams.get('report') || '').trim().toLowerCase()
        const report: ReportType = reportRaw === 'cashflow' ? 'cashflow' : 'dre'

        const startDate = normalizeDate(searchParams.get('start_date')) || firstDayOfCurrentMonthISO()
        const endDate = normalizeDate(searchParams.get('end_date')) || todayISO()
        if (endDate < startDate) {
            return NextResponse.json({ success: false, error: 'Data final menor que data inicial.' }, { status: 400 })
        }

        const admin = createAdminClient()
        const schema = await resolveFinanceSchema(admin)
        if (!schema) {
            return NextResponse.json({
                success: false,
                error: 'Tabela financeira incompativel para relatorios.',
            }, { status: 400 })
        }

        const entries = await fetchEntriesByPeriod(admin, schema, startDate, endDate)

        if (report === 'dre') {
            const dre = buildDre(entries)
            return NextResponse.json({
                success: true,
                report,
                period: { start_date: startDate, end_date: endDate },
                data: dre,
            })
        }

        const [openPayables, openReceivables] = await Promise.all([
            fetchOpenAparItems(admin, {
                tableName: 'finance_payables',
                settledAmountColumn: 'paid_amount',
                settledStatus: 'paid',
                startDate,
                endDate,
            }),
            fetchOpenAparItems(admin, {
                tableName: 'finance_receivables',
                settledAmountColumn: 'received_amount',
                settledStatus: 'received',
                startDate,
                endDate,
            }),
        ])

        const cashflow = buildCashflow(entries, openPayables, openReceivables)
        return NextResponse.json({
            success: true,
            report,
            period: { start_date: startDate, end_date: endDate },
            data: cashflow,
        })
    } catch (err: any) {
        console.error('[admin/finance/reports GET]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao gerar relatorio financeiro' }, { status: 500 })
    }
}
