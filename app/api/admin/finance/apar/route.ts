import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'

type AparType = 'payable' | 'receivable'
type SettlementAction = 'settle' | 'reopen'

type PayableStatus = 'open' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'
type ReceivableStatus = 'open' | 'partially_received' | 'received' | 'overdue' | 'cancelled'

type DateField = 'entry_date' | 'date' | 'occurred_at' | 'created_at'

interface AparSchema {
    type: AparType
    tableName: 'finance_payables' | 'finance_receivables'
    settledAmountColumn: 'paid_amount' | 'received_amount'
    settledAtColumn: 'paid_at' | 'received_at'
    fullStatus: PayableStatus | ReceivableStatus
    partialStatus: PayableStatus | ReceivableStatus
    hasDescription: boolean
    hasAmount: boolean
    hasDueDate: boolean
    hasCompetenceDate: boolean
    hasStatus: boolean
    hasCategory: boolean
    hasSubcategory: boolean
    hasCounterpartyName: boolean
    hasCounterpartyType: boolean
    hasPaymentMethod: boolean
    hasCostCenterId: boolean
    hasBankAccountId: boolean
    hasNotes: boolean
    hasCreatedBy: boolean
    hasUpdatedAt: boolean
    hasSettledAmount: boolean
    hasSettledAt: boolean
}

function toNullableText(value: any): string | null {
    const text = String(value || '').trim()
    return text || null
}

function toNullableNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') return null
    const numberValue = Number(value)
    return Number.isFinite(numberValue) ? numberValue : null
}

function toAparType(value: any): AparType {
    return String(value || '').trim().toLowerCase() === 'receivable' ? 'receivable' : 'payable'
}

function toSettlementAction(value: any): SettlementAction {
    return String(value || '').trim().toLowerCase() === 'reopen' ? 'reopen' : 'settle'
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

async function columnExistsOnTable(admin: any, tableName: string, columnName: string): Promise<boolean> {
    const { error } = await admin.from(tableName).select(columnName).limit(1)
    return !error
}

async function getAparSchema(admin: any, type: AparType): Promise<AparSchema> {
    const tableName = type === 'receivable' ? 'finance_receivables' : 'finance_payables'
    const settledAmountColumn = type === 'receivable' ? 'received_amount' : 'paid_amount'
    const settledAtColumn = type === 'receivable' ? 'received_at' : 'paid_at'
    const fullStatus = type === 'receivable' ? 'received' : 'paid'
    const partialStatus = type === 'receivable' ? 'partially_received' : 'partially_paid'

    const [
        hasDescription,
        hasAmount,
        hasDueDate,
        hasCompetenceDate,
        hasStatus,
        hasCategory,
        hasSubcategory,
        hasCounterpartyName,
        hasCounterpartyType,
        hasPaymentMethod,
        hasCostCenterId,
        hasBankAccountId,
        hasNotes,
        hasCreatedBy,
        hasUpdatedAt,
        hasSettledAmount,
        hasSettledAt,
    ] = await Promise.all([
        columnExistsOnTable(admin, tableName, 'description'),
        columnExistsOnTable(admin, tableName, 'amount'),
        columnExistsOnTable(admin, tableName, 'due_date'),
        columnExistsOnTable(admin, tableName, 'competence_date'),
        columnExistsOnTable(admin, tableName, 'status'),
        columnExistsOnTable(admin, tableName, 'category'),
        columnExistsOnTable(admin, tableName, 'subcategory'),
        columnExistsOnTable(admin, tableName, 'counterparty_name'),
        columnExistsOnTable(admin, tableName, 'counterparty_type'),
        columnExistsOnTable(admin, tableName, 'payment_method'),
        columnExistsOnTable(admin, tableName, 'cost_center_id'),
        columnExistsOnTable(admin, tableName, 'bank_account_id'),
        columnExistsOnTable(admin, tableName, 'notes'),
        columnExistsOnTable(admin, tableName, 'created_by'),
        columnExistsOnTable(admin, tableName, 'updated_at'),
        columnExistsOnTable(admin, tableName, settledAmountColumn),
        columnExistsOnTable(admin, tableName, settledAtColumn),
    ])

    return {
        type,
        tableName: tableName as AparSchema['tableName'],
        settledAmountColumn: settledAmountColumn as AparSchema['settledAmountColumn'],
        settledAtColumn: settledAtColumn as AparSchema['settledAtColumn'],
        fullStatus: fullStatus as AparSchema['fullStatus'],
        partialStatus: partialStatus as AparSchema['partialStatus'],
        hasDescription,
        hasAmount,
        hasDueDate,
        hasCompetenceDate,
        hasStatus,
        hasCategory,
        hasSubcategory,
        hasCounterpartyName,
        hasCounterpartyType,
        hasPaymentMethod,
        hasCostCenterId,
        hasBankAccountId,
        hasNotes,
        hasCreatedBy,
        hasUpdatedAt,
        hasSettledAmount,
        hasSettledAt,
    }
}

function buildAparSelectColumns(schema: AparSchema): string {
    const columns = ['id', 'created_at']
    if (schema.hasDescription) columns.push('description')
    if (schema.hasAmount) columns.push('amount')
    if (schema.hasDueDate) columns.push('due_date')
    if (schema.hasCompetenceDate) columns.push('competence_date')
    if (schema.hasStatus) columns.push('status')
    if (schema.hasCategory) columns.push('category')
    if (schema.hasSubcategory) columns.push('subcategory')
    if (schema.hasCounterpartyName) columns.push('counterparty_name')
    if (schema.hasCounterpartyType) columns.push('counterparty_type')
    if (schema.hasPaymentMethod) columns.push('payment_method')
    if (schema.hasCostCenterId) columns.push('cost_center_id')
    if (schema.hasBankAccountId) columns.push('bank_account_id')
    if (schema.hasNotes) columns.push('notes')
    if (schema.hasSettledAmount) columns.push(schema.settledAmountColumn)
    if (schema.hasSettledAt) columns.push(schema.settledAtColumn)
    return columns.join(', ')
}

function mapAparRow(row: any, schema: AparSchema) {
    const settledAmount = schema.hasSettledAmount ? Number(row[schema.settledAmountColumn] || 0) : 0
    const amount = Number(row.amount || 0)
    return {
        id: row.id,
        description: row.description || '',
        amount,
        settled_amount: settledAmount,
        remaining_amount: Math.max(0, amount - settledAmount),
        due_date: row.due_date || null,
        competence_date: row.competence_date || null,
        status: row.status || 'open',
        category: row.category || null,
        subcategory: row.subcategory || null,
        counterparty_name: row.counterparty_name || null,
        counterparty_type: row.counterparty_type || null,
        payment_method: row.payment_method || null,
        cost_center_id: row.cost_center_id || null,
        bank_account_id: row.bank_account_id || null,
        notes: row.notes || null,
        settled_at: schema.hasSettledAt ? (row[schema.settledAtColumn] || null) : null,
        created_at: row.created_at,
    }
}

async function resolveFinanceEntriesDateField(admin: any): Promise<DateField | null> {
    const [hasEntryDate, hasDate, hasOccurredAt, hasCreatedAt] = await Promise.all([
        columnExistsOnTable(admin, 'finance_entries', 'entry_date'),
        columnExistsOnTable(admin, 'finance_entries', 'date'),
        columnExistsOnTable(admin, 'finance_entries', 'occurred_at'),
        columnExistsOnTable(admin, 'finance_entries', 'created_at'),
    ])
    if (hasEntryDate) return 'entry_date'
    if (hasDate) return 'date'
    if (hasOccurredAt) return 'occurred_at'
    if (hasCreatedAt) return 'created_at'
    return null
}

async function createSettlementLedgerEntry(
    admin: any,
    params: {
        type: AparType
        aparId: string
        description: string
        counterpartyName: string | null
        amount: number
        dueDate: string | null
        competenceDate: string | null
        category: string | null
        subcategory: string | null
        paymentMethod: string | null
        costCenterId: string | null
        bankAccountId: string | null
        notes: string | null
        createdBy: string | null
    },
): Promise<string | null> {
    const dateField = await resolveFinanceEntriesDateField(admin)
    if (!dateField) return null

    const [
        hasCategory,
        hasSubcategory,
        hasPaymentMethod,
        hasPaymentStatus,
        hasCounterpartyName,
        hasCounterpartyType,
        hasReferenceCompany,
        hasDueDate,
        hasCompetenceDate,
        hasCostCenterId,
        hasBankAccountId,
        hasSourceModule,
        hasExternalReference,
        hasNotes,
        hasCreatedBy,
        hasUpdatedAt,
    ] = await Promise.all([
        columnExistsOnTable(admin, 'finance_entries', 'category'),
        columnExistsOnTable(admin, 'finance_entries', 'subcategory'),
        columnExistsOnTable(admin, 'finance_entries', 'payment_method'),
        columnExistsOnTable(admin, 'finance_entries', 'payment_status'),
        columnExistsOnTable(admin, 'finance_entries', 'counterparty_name'),
        columnExistsOnTable(admin, 'finance_entries', 'counterparty_type'),
        columnExistsOnTable(admin, 'finance_entries', 'reference_company'),
        columnExistsOnTable(admin, 'finance_entries', 'due_date'),
        columnExistsOnTable(admin, 'finance_entries', 'competence_date'),
        columnExistsOnTable(admin, 'finance_entries', 'cost_center_id'),
        columnExistsOnTable(admin, 'finance_entries', 'bank_account_id'),
        columnExistsOnTable(admin, 'finance_entries', 'source_module'),
        columnExistsOnTable(admin, 'finance_entries', 'external_reference'),
        columnExistsOnTable(admin, 'finance_entries', 'notes'),
        columnExistsOnTable(admin, 'finance_entries', 'created_by'),
        columnExistsOnTable(admin, 'finance_entries', 'updated_at'),
    ])

    const entryDate = toNullableText(params.dueDate) || new Date().toISOString().slice(0, 10)
    const nowIso = new Date().toISOString()
    const sourceModule = params.type === 'receivable' ? 'finance_receivables' : 'finance_payables'
    const entryDescription = `${params.type === 'receivable' ? 'Recebimento' : 'Pagamento'} - ${params.description || 'AP/AR'}`

    const insertData: any = {
        description: entryDescription,
        entry_type: params.type === 'receivable' ? 'income' : 'expense',
        amount: Number(params.amount),
    }

    if (dateField === 'entry_date' || dateField === 'date') {
        insertData[dateField] = entryDate
    } else {
        insertData[dateField] = `${entryDate}T12:00:00.000Z`
    }

    if (hasCategory) insertData.category = toNullableText(params.category)
    if (hasSubcategory) insertData.subcategory = toNullableText(params.subcategory)
    if (hasPaymentMethod) insertData.payment_method = toNullableText(params.paymentMethod) || 'Transferencia'
    if (hasPaymentStatus) insertData.payment_status = 'paid'
    if (hasCounterpartyName) insertData.counterparty_name = toNullableText(params.counterpartyName)
    if (hasCounterpartyType) insertData.counterparty_type = 'pessoa_juridica'
    if (hasReferenceCompany) insertData.reference_company = params.type === 'receivable' ? 'Contas a Receber' : 'Contas a Pagar'
    if (hasDueDate) insertData.due_date = toNullableText(params.dueDate) || entryDate
    if (hasCompetenceDate) insertData.competence_date = toNullableText(params.competenceDate) || entryDate
    if (hasCostCenterId) insertData.cost_center_id = toNullableText(params.costCenterId)
    if (hasBankAccountId) insertData.bank_account_id = toNullableText(params.bankAccountId)
    if (hasSourceModule) insertData.source_module = sourceModule
    if (hasExternalReference) insertData.external_reference = params.aparId
    if (hasNotes) insertData.notes = toNullableText(params.notes)
    if (hasCreatedBy) insertData.created_by = params.createdBy
    if (hasUpdatedAt) insertData.updated_at = nowIso

    const { data: createdEntry, error } = await admin
        .from('finance_entries')
        .insert(insertData)
        .select('id')
        .single()

    if (error || !createdEntry?.id) throw error || new Error('Nao foi possivel criar lancamento de baixa')
    return createdEntry.id
}

export async function GET(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const { searchParams } = new URL(request.url)
        const type = toAparType(searchParams.get('type'))
        const startDate = toNullableText(searchParams.get('start_date'))
        const endDate = toNullableText(searchParams.get('end_date'))
        const limitRaw = Number(searchParams.get('limit') || 2000)
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 3000)) : 2000

        const admin = createAdminClient()
        const schema = await getAparSchema(admin, type)

        if (!schema.hasDescription || !schema.hasAmount) {
            return NextResponse.json({ success: false, error: 'Tabela AP/AR incompleta. Execute a migration de fundacao.' }, { status: 400 })
        }

        let query = admin
            .from(schema.tableName)
            .select(buildAparSelectColumns(schema))
            .order(schema.hasDueDate ? 'due_date' : 'created_at', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(limit)

        if (startDate && schema.hasDueDate) query = query.gte('due_date', startDate)
        if (endDate && schema.hasDueDate) query = query.lte('due_date', endDate)

        const { data, error } = await query
        if (error) throw error

        return NextResponse.json({
            success: true,
            type,
            items: (data || []).map((row: any) => mapAparRow(row, schema)),
        })
    } catch (err: any) {
        console.error('[admin/finance/apar GET]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao carregar AP/AR' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const body = await request.json()
        const type = toAparType(body?.type)
        const admin = createAdminClient()
        const schema = await getAparSchema(admin, type)

        const description = String(body?.description || '').trim()
        const amount = Number(body?.amount || 0)
        const dueDate = String(body?.due_date || '').trim()
        if (!description) return NextResponse.json({ success: false, error: 'Descricao obrigatoria' }, { status: 400 })
        if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ success: false, error: 'Valor invalido' }, { status: 400 })
        if (schema.hasDueDate && !dueDate) return NextResponse.json({ success: false, error: 'Vencimento obrigatorio' }, { status: 400 })

        const settledAmountInput = Math.max(0, Number(toNullableNumber(body?.settled_amount) || 0))
        if (settledAmountInput > amount) {
            return NextResponse.json({ success: false, error: 'Valor liquidado nao pode superar o valor total' }, { status: 400 })
        }

        const insertData: any = {}
        if (schema.hasDescription) insertData.description = description
        if (schema.hasAmount) insertData.amount = amount
        if (schema.hasDueDate) insertData.due_date = dueDate
        if (schema.hasCompetenceDate) insertData.competence_date = toNullableText(body?.competence_date) || dueDate
        if (schema.hasCategory) insertData.category = toNullableText(body?.category)
        if (schema.hasSubcategory) insertData.subcategory = toNullableText(body?.subcategory)
        if (schema.hasCounterpartyName) insertData.counterparty_name = toNullableText(body?.counterparty_name)
        if (schema.hasCounterpartyType) insertData.counterparty_type = toNullableText(body?.counterparty_type) || 'pessoa_juridica'
        if (schema.hasPaymentMethod) insertData.payment_method = toNullableText(body?.payment_method)
        if (schema.hasCostCenterId) insertData.cost_center_id = toNullableText(body?.cost_center_id)
        if (schema.hasBankAccountId) insertData.bank_account_id = toNullableText(body?.bank_account_id)
        if (schema.hasNotes) insertData.notes = toNullableText(body?.notes)
        if (schema.hasCreatedBy) insertData.created_by = access.adminUser?.id || null
        if (schema.hasUpdatedAt) insertData.updated_at = new Date().toISOString()
        if (schema.hasSettledAmount) insertData[schema.settledAmountColumn] = settledAmountInput
        if (schema.hasStatus) {
            insertData.status = settledAmountInput >= amount
                ? schema.fullStatus
                : (settledAmountInput > 0 ? schema.partialStatus : 'open')
        }
        if (schema.hasSettledAt && settledAmountInput > 0) insertData[schema.settledAtColumn] = new Date().toISOString()

        const { data, error } = await admin
            .from(schema.tableName)
            .insert(insertData)
            .select(buildAparSelectColumns(schema))
            .single()

        if (error) throw error
        return NextResponse.json({ success: true, item: mapAparRow(data, schema) }, { status: 201 })
    } catch (err: any) {
        console.error('[admin/finance/apar POST]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao criar item AP/AR' }, { status: 500 })
    }
}

export async function PUT(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const body = await request.json()
        const id = String(body?.id || '').trim()
        if (!id) return NextResponse.json({ success: false, error: 'ID obrigatorio' }, { status: 400 })

        const type = toAparType(body?.type)
        const action = toSettlementAction(body?.action)
        const admin = createAdminClient()
        const schema = await getAparSchema(admin, type)

        const { data: currentRow, error: currentError } = await admin
            .from(schema.tableName)
            .select(buildAparSelectColumns(schema))
            .eq('id', id)
            .single()

        if (currentError || !currentRow) {
            return NextResponse.json({ success: false, error: 'Item AP/AR nao encontrado' }, { status: 404 })
        }

        const totalAmount = Number(currentRow.amount || 0)
        const currentSettledAmount = schema.hasSettledAmount ? Number(currentRow[schema.settledAmountColumn] || 0) : 0
        const outstandingAmount = Math.max(0, totalAmount - currentSettledAmount)
        const nowIso = new Date().toISOString()

        if (action === 'reopen') {
            const reopenData: any = {}
            if (schema.hasStatus) reopenData.status = 'open'
            if (schema.hasSettledAmount) reopenData[schema.settledAmountColumn] = 0
            if (schema.hasSettledAt) reopenData[schema.settledAtColumn] = null
            if (schema.hasUpdatedAt) reopenData.updated_at = nowIso

            const { data, error } = await admin
                .from(schema.tableName)
                .update(reopenData)
                .eq('id', id)
                .select(buildAparSelectColumns(schema))
                .single()

            if (error) throw error
            return NextResponse.json({ success: true, item: mapAparRow(data, schema) })
        }

        const settlementAmount = Number(body?.amount || 0)
        if (!Number.isFinite(settlementAmount) || settlementAmount <= 0) {
            return NextResponse.json({ success: false, error: 'Valor de baixa invalido' }, { status: 400 })
        }
        if (settlementAmount > outstandingAmount + 1e-9) {
            return NextResponse.json({ success: false, error: 'Valor de baixa maior que saldo em aberto' }, { status: 400 })
        }

        const nextSettledAmount = Number((currentSettledAmount + settlementAmount).toFixed(2))
        const isFullySettled = nextSettledAmount >= totalAmount - 0.009

        const updateData: any = {}
        if (schema.hasSettledAmount) updateData[schema.settledAmountColumn] = nextSettledAmount
        if (schema.hasSettledAt) updateData[schema.settledAtColumn] = nowIso
        if (schema.hasStatus) updateData.status = isFullySettled ? schema.fullStatus : schema.partialStatus
        if (schema.hasUpdatedAt) updateData.updated_at = nowIso

        const { data: updatedRow, error: updateError } = await admin
            .from(schema.tableName)
            .update(updateData)
            .eq('id', id)
            .select(buildAparSelectColumns(schema))
            .single()

        if (updateError || !updatedRow) throw updateError || new Error('Erro ao atualizar item AP/AR')

        await createSettlementLedgerEntry(admin, {
            type,
            aparId: id,
            description: String(updatedRow.description || ''),
            counterpartyName: toNullableText(updatedRow.counterparty_name),
            amount: settlementAmount,
            dueDate: toNullableText(updatedRow.due_date),
            competenceDate: toNullableText(updatedRow.competence_date),
            category: toNullableText(updatedRow.category),
            subcategory: toNullableText(updatedRow.subcategory),
            paymentMethod: toNullableText(updatedRow.payment_method),
            costCenterId: toNullableText(updatedRow.cost_center_id),
            bankAccountId: toNullableText(updatedRow.bank_account_id),
            notes: toNullableText(updatedRow.notes),
            createdBy: access.adminUser?.id || null,
        })

        return NextResponse.json({ success: true, item: mapAparRow(updatedRow, schema) })
    } catch (err: any) {
        console.error('[admin/finance/apar PUT]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao atualizar AP/AR' }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const { searchParams } = new URL(request.url)
        const id = String(searchParams.get('id') || '').trim()
        if (!id) return NextResponse.json({ success: false, error: 'ID obrigatorio' }, { status: 400 })

        const type = toAparType(searchParams.get('type'))
        const admin = createAdminClient()
        const schema = await getAparSchema(admin, type)

        const { error } = await admin
            .from(schema.tableName)
            .delete()
            .eq('id', id)

        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('[admin/finance/apar DELETE]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao remover item AP/AR' }, { status: 500 })
    }
}

