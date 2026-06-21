import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'
import { ensureUnlockedDates, normalizeDateForLock } from './_lib/period-lock'

type FinanceType = 'income' | 'expense'

interface FinancePayload {
    description: string
    entry_type: FinanceType
    amount: number
    category?: string | null
    subcategory?: string | null
    entry_date: string
    payment_method?: string | null
    payment_status?: 'paid' | 'pending' | 'cancelled' | null
    counterparty_name?: string | null
    counterparty_type?: 'pessoa_fisica' | 'pessoa_juridica' | null
    reference_company?: string | null
    due_date?: string | null
    competence_date?: string | null
    cost_center_id?: string | null
    bank_account_id?: string | null
    entity_id?: string | null
    notes?: string | null
    attachment_url?: string | null
}

type DateField = 'entry_date' | 'date' | 'occurred_at' | 'created_at'

interface FinanceSchema {
    dateField: DateField
    hasOccurredAt: boolean
    hasCategory: boolean
    hasSubcategory: boolean
    hasPaymentMethod: boolean
    hasPaymentStatus: boolean
    hasCounterpartyName: boolean
    hasCounterpartyType: boolean
    hasReferenceCompany: boolean
    hasDueDate: boolean
    hasCompetenceDate: boolean
    hasCostCenterId: boolean
    hasBankAccountId: boolean
    hasEntityId: boolean
    hasSourceModule: boolean
    hasExternalReference: boolean
    hasNotes: boolean
    hasAttachmentUrl: boolean
    hasCreatedBy: boolean
    hasUpdatedAt: boolean
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

async function columnExists(admin: any, columnName: string): Promise<boolean> {
    const { error } = await admin.from('finance_entries').select(columnName).limit(1)
    return !error
}

async function getFinanceSchema(admin: any): Promise<FinanceSchema | null> {
    const [
        hasEntryDate,
        hasDate,
        hasOccurredAt,
        hasCreatedAt,
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
        hasEntityId,
        hasSourceModule,
        hasExternalReference,
        hasNotes,
        hasAttachmentUrl,
        hasCreatedBy,
        hasUpdatedAt,
    ] = await Promise.all([
        columnExists(admin, 'entry_date'),
        columnExists(admin, 'date'),
        columnExists(admin, 'occurred_at'),
        columnExists(admin, 'created_at'),
        columnExists(admin, 'category'),
        columnExists(admin, 'subcategory'),
        columnExists(admin, 'payment_method'),
        columnExists(admin, 'payment_status'),
        columnExists(admin, 'counterparty_name'),
        columnExists(admin, 'counterparty_type'),
        columnExists(admin, 'reference_company'),
        columnExists(admin, 'due_date'),
        columnExists(admin, 'competence_date'),
        columnExists(admin, 'cost_center_id'),
        columnExists(admin, 'bank_account_id'),
        columnExists(admin, 'entity_id'),
        columnExists(admin, 'source_module'),
        columnExists(admin, 'external_reference'),
        columnExists(admin, 'notes'),
        columnExists(admin, 'attachment_url'),
        columnExists(admin, 'created_by'),
        columnExists(admin, 'updated_at'),
    ])

    if (!hasCreatedAt && !hasOccurredAt) return null

    const dateField: DateField = hasEntryDate
        ? 'entry_date'
        : (hasDate ? 'date' : (hasOccurredAt ? 'occurred_at' : 'created_at'))

    return {
        dateField,
        hasOccurredAt,
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
        hasEntityId,
        hasSourceModule,
        hasExternalReference,
        hasNotes,
        hasAttachmentUrl,
        hasCreatedBy,
        hasUpdatedAt,
    }
}

function normalizePayload(raw: any): FinancePayload {
    const entry_type = raw?.entry_type === 'income' ? 'income' : 'expense'
    const amount = Number(raw?.amount || 0)
    const description = String(raw?.description || '').trim()
    const entry_date = String(raw?.entry_date || '').trim()

    return {
        description,
        entry_type,
        amount,
        category: String(raw?.category || '').trim() || null,
        subcategory: String(raw?.subcategory || '').trim() || null,
        entry_date,
        payment_method: String(raw?.payment_method || '').trim() || null,
        payment_status: ((): FinancePayload['payment_status'] => {
            const status = String(raw?.payment_status || '').trim().toLowerCase()
            if (status === 'pending' || status === 'cancelled') return status
            if (status === 'paid') return 'paid'
            return 'paid'
        })(),
        counterparty_name: String(raw?.counterparty_name || '').trim() || null,
        counterparty_type: ((): FinancePayload['counterparty_type'] => {
            const party = String(raw?.counterparty_type || '').trim().toLowerCase()
            if (party === 'pessoa_fisica') return 'pessoa_fisica'
            if (party === 'pessoa_juridica') return 'pessoa_juridica'
            return null
        })(),
        reference_company: String(raw?.reference_company || '').trim() || null,
        due_date: String(raw?.due_date || '').trim() || null,
        competence_date: String(raw?.competence_date || '').trim() || null,
        cost_center_id: String(raw?.cost_center_id || '').trim() || null,
        bank_account_id: String(raw?.bank_account_id || '').trim() || null,
        entity_id: String(raw?.entity_id || '').trim() || null,
        notes: String(raw?.notes || '').trim() || null,
        attachment_url: String(raw?.attachment_url || '').trim() || null,
    }
}

function validatePayload(payload: FinancePayload): string | null {
    if (!payload.description) return 'Descricao obrigatoria'
    if (!payload.entry_date) return 'Data obrigatoria'
    if (!Number.isFinite(payload.amount) || payload.amount <= 0) return 'Valor invalido'
    if (!['income', 'expense'].includes(payload.entry_type)) return 'Tipo invalido'
    return null
}

function toIsoFromDateOnly(dateValue: string): string {
    return `${dateValue}T12:00:00.000Z`
}

function mapEntryRow(row: any, schema: FinanceSchema) {
    const rawDate = (schema.dateField === 'created_at' || schema.dateField === 'occurred_at')
        ? String(row[schema.dateField] || row.created_at || '').slice(0, 10)
        : row[schema.dateField]

    return {
        id: row.id,
        description: row.description,
        entry_type: row.entry_type,
        amount: row.amount,
        category: schema.hasCategory ? row.category : null,
        subcategory: schema.hasSubcategory ? row.subcategory : null,
        entry_date: rawDate || null,
        payment_method: schema.hasPaymentMethod ? row.payment_method : null,
        payment_status: schema.hasPaymentStatus ? row.payment_status : 'paid',
        counterparty_name: schema.hasCounterpartyName ? row.counterparty_name : null,
        counterparty_type: schema.hasCounterpartyType ? row.counterparty_type : null,
        reference_company: schema.hasReferenceCompany ? row.reference_company : null,
        due_date: schema.hasDueDate ? (row.due_date || rawDate || null) : (rawDate || null),
        competence_date: schema.hasCompetenceDate ? (row.competence_date || rawDate || null) : (rawDate || null),
        cost_center_id: schema.hasCostCenterId ? row.cost_center_id : null,
        bank_account_id: schema.hasBankAccountId ? row.bank_account_id : null,
        entity_id: schema.hasEntityId ? row.entity_id : null,
        source_module: schema.hasSourceModule ? row.source_module : null,
        external_reference: schema.hasExternalReference ? row.external_reference : null,
        notes: schema.hasNotes ? row.notes : null,
        attachment_url: schema.hasAttachmentUrl ? row.attachment_url : null,
        created_at: row.created_at,
        updated_at: schema.hasUpdatedAt ? row.updated_at : row.created_at,
    }
}

function buildSelectColumns(schema: FinanceSchema) {
    const columns = ['id', 'description', 'entry_type', 'amount', schema.dateField, 'created_at']
    if (schema.hasOccurredAt) columns.push('occurred_at')
    if (schema.hasCategory) columns.push('category')
    if (schema.hasSubcategory) columns.push('subcategory')
    if (schema.hasPaymentMethod) columns.push('payment_method')
    if (schema.hasPaymentStatus) columns.push('payment_status')
    if (schema.hasCounterpartyName) columns.push('counterparty_name')
    if (schema.hasCounterpartyType) columns.push('counterparty_type')
    if (schema.hasReferenceCompany) columns.push('reference_company')
    if (schema.hasDueDate) columns.push('due_date')
    if (schema.hasCompetenceDate) columns.push('competence_date')
    if (schema.hasCostCenterId) columns.push('cost_center_id')
    if (schema.hasBankAccountId) columns.push('bank_account_id')
    if (schema.hasEntityId) columns.push('entity_id')
    if (schema.hasSourceModule) columns.push('source_module')
    if (schema.hasExternalReference) columns.push('external_reference')
    if (schema.hasNotes) columns.push('notes')
    if (schema.hasAttachmentUrl) columns.push('attachment_url')
    if (schema.hasCreatedBy) columns.push('created_by')
    if (schema.hasUpdatedAt) columns.push('updated_at')
    return columns.join(', ')
}

export async function GET(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const { searchParams } = new URL(request.url)
        const startDate = searchParams.get('start_date')
        const endDate = searchParams.get('end_date')
        const entityId = searchParams.get('entity_id')
        const limitRaw = Number(searchParams.get('limit') || 500)
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 2000)) : 500

        const admin = createAdminClient()
        const schema = await getFinanceSchema(admin)
        if (!schema) {
            return NextResponse.json({
                success: false,
                error: 'Tabela financeira incompatível. Execute o SQL de correção.',
            }, { status: 400 })
        }

        const selectColumns = buildSelectColumns(schema)
        let query = admin
            .from('finance_entries')
            .select(selectColumns)
            .order(schema.dateField, { ascending: false })
            .order('created_at', { ascending: false })
            .limit(limit)

        if (startDate) {
            if (schema.dateField === 'created_at' || schema.dateField === 'occurred_at') query = query.gte(schema.dateField, `${startDate}T00:00:00.000Z`)
            else query = query.gte(schema.dateField, startDate)
        }

        if (endDate) {
            if (schema.dateField === 'created_at' || schema.dateField === 'occurred_at') query = query.lte(schema.dateField, `${endDate}T23:59:59.999Z`)
            else query = query.lte(schema.dateField, endDate)
        }

        if (entityId && schema.hasEntityId) {
            query = query.eq('entity_id', entityId)
        }

        const { data, error } = await query
        if (error) throw error

        return NextResponse.json({
            success: true,
            entries: (data || []).map((row: any) => mapEntryRow(row, schema)),
            schema_info: { date_field: schema.dateField },
        })
    } catch (err: any) {
        console.error('[admin/finance GET]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao carregar financeiro' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const payload = normalizePayload(await request.json())
        const validationError = validatePayload(payload)
        if (validationError) return NextResponse.json({ success: false, error: validationError }, { status: 400 })

        const admin = createAdminClient()
        const schema = await getFinanceSchema(admin)
        if (!schema) {
            return NextResponse.json({
                success: false,
                error: 'Tabela financeira incompatível. Execute o SQL de correção.',
            }, { status: 400 })
        }

        const createLockError = await ensureUnlockedDates(admin, [payload.entry_date], 'Lancamento financeiro')
        if (createLockError) {
            return NextResponse.json({ success: false, error: createLockError }, { status: 409 })
        }

        const insertData: any = {
            description: payload.description,
            entry_type: payload.entry_type,
            amount: payload.amount,
        }

        if (schema.hasCategory) insertData.category = payload.category
        if (schema.hasSubcategory) insertData.subcategory = payload.subcategory
        if (schema.hasPaymentMethod) insertData.payment_method = payload.payment_method
        if (schema.hasPaymentStatus) insertData.payment_status = payload.payment_status || 'paid'
        if (schema.hasCounterpartyName) insertData.counterparty_name = payload.counterparty_name
        if (schema.hasCounterpartyType) insertData.counterparty_type = payload.counterparty_type || null
        if (schema.hasReferenceCompany) insertData.reference_company = payload.reference_company
        if (schema.hasDueDate) insertData.due_date = payload.due_date || payload.entry_date
        if (schema.hasCompetenceDate) insertData.competence_date = payload.competence_date || payload.entry_date
        if (schema.hasCostCenterId) insertData.cost_center_id = payload.cost_center_id || null
        if (schema.hasBankAccountId) insertData.bank_account_id = payload.bank_account_id || null
        if (schema.hasEntityId) insertData.entity_id = payload.entity_id || null
        if (schema.hasNotes) insertData.notes = payload.notes
        if (schema.hasAttachmentUrl) insertData.attachment_url = payload.attachment_url
        if (schema.hasCreatedBy) insertData.created_by = access.adminUser!.id
        if (schema.hasUpdatedAt) insertData.updated_at = new Date().toISOString()

        if (schema.dateField === 'created_at' || schema.dateField === 'occurred_at') insertData[schema.dateField] = toIsoFromDateOnly(payload.entry_date)
        else insertData[schema.dateField] = payload.entry_date
        if (schema.hasOccurredAt && !insertData.occurred_at) insertData.occurred_at = toIsoFromDateOnly(payload.entry_date)

        const { data, error } = await admin
            .from('finance_entries')
            .insert(insertData)
            .select(buildSelectColumns(schema))
            .single()

        if (error) throw error
        return NextResponse.json({ success: true, entry: mapEntryRow(data, schema) }, { status: 201 })
    } catch (err: any) {
        console.error('[admin/finance POST]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao salvar lancamento' }, { status: 500 })
    }
}

export async function PUT(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const body = await request.json()
        const id = String(body?.id || '').trim()
        if (!id) return NextResponse.json({ success: false, error: 'ID obrigatorio' }, { status: 400 })

        const payload = normalizePayload(body)
        const validationError = validatePayload(payload)
        if (validationError) return NextResponse.json({ success: false, error: validationError }, { status: 400 })

        const admin = createAdminClient()
        const schema = await getFinanceSchema(admin)
        if (!schema) {
            return NextResponse.json({
                success: false,
                error: 'Tabela financeira incompatível. Execute o SQL de correção.',
            }, { status: 400 })
        }

        const { data: currentEntry, error: currentEntryError } = await admin
            .from('finance_entries')
            .select(`id, ${schema.dateField}`)
            .eq('id', id)
            .single()

        if (currentEntryError || !currentEntry) {
            return NextResponse.json({ success: false, error: 'Lancamento nao encontrado' }, { status: 404 })
        }

        const currentEntryDate = normalizeDateForLock(currentEntry[schema.dateField])
        const nextEntryDate = normalizeDateForLock(payload.entry_date)
        const updateLockError = await ensureUnlockedDates(
            admin,
            [currentEntryDate, nextEntryDate],
            'Lancamento financeiro',
        )
        if (updateLockError) {
            return NextResponse.json({ success: false, error: updateLockError }, { status: 409 })
        }

        const updateData: any = {
            description: payload.description,
            entry_type: payload.entry_type,
            amount: payload.amount,
        }

        if (schema.hasCategory) updateData.category = payload.category
        if (schema.hasSubcategory) updateData.subcategory = payload.subcategory
        if (schema.hasPaymentMethod) updateData.payment_method = payload.payment_method
        if (schema.hasPaymentStatus) updateData.payment_status = payload.payment_status || 'paid'
        if (schema.hasCounterpartyName) updateData.counterparty_name = payload.counterparty_name
        if (schema.hasCounterpartyType) updateData.counterparty_type = payload.counterparty_type || null
        if (schema.hasReferenceCompany) updateData.reference_company = payload.reference_company
        if (schema.hasDueDate) updateData.due_date = payload.due_date || payload.entry_date
        if (schema.hasCompetenceDate) updateData.competence_date = payload.competence_date || payload.entry_date
        if (schema.hasCostCenterId) updateData.cost_center_id = payload.cost_center_id || null
        if (schema.hasBankAccountId) updateData.bank_account_id = payload.bank_account_id || null
        if (schema.hasEntityId) updateData.entity_id = payload.entity_id || null
        if (schema.hasNotes) updateData.notes = payload.notes
        if (schema.hasAttachmentUrl) updateData.attachment_url = payload.attachment_url
        if (schema.hasUpdatedAt) updateData.updated_at = new Date().toISOString()

        if (schema.dateField === 'created_at' || schema.dateField === 'occurred_at') updateData[schema.dateField] = toIsoFromDateOnly(payload.entry_date)
        else updateData[schema.dateField] = payload.entry_date
        if (schema.hasOccurredAt && !updateData.occurred_at) updateData.occurred_at = toIsoFromDateOnly(payload.entry_date)

        const { data, error } = await admin
            .from('finance_entries')
            .update(updateData)
            .eq('id', id)
            .select(buildSelectColumns(schema))
            .single()

        if (error) throw error
        return NextResponse.json({ success: true, entry: mapEntryRow(data, schema) })
    } catch (err: any) {
        console.error('[admin/finance PUT]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao atualizar lancamento' }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const { searchParams } = new URL(request.url)
        const id = String(searchParams.get('id') || '').trim()
        if (!id) return NextResponse.json({ success: false, error: 'ID obrigatorio' }, { status: 400 })

        const admin = createAdminClient()
        const schema = await getFinanceSchema(admin)
        if (!schema) {
            return NextResponse.json({
                success: false,
                error: 'Tabela financeira incompatível. Execute o SQL de correção.',
            }, { status: 400 })
        }

        const { data: currentEntry, error: currentEntryError } = await admin
            .from('finance_entries')
            .select(`id, ${schema.dateField}`)
            .eq('id', id)
            .single()

        if (currentEntryError || !currentEntry) {
            return NextResponse.json({ success: false, error: 'Lancamento nao encontrado' }, { status: 404 })
        }

        const deleteLockError = await ensureUnlockedDates(
            admin,
            [normalizeDateForLock(currentEntry[schema.dateField])],
            'Lancamento financeiro',
        )
        if (deleteLockError) {
            return NextResponse.json({ success: false, error: deleteLockError }, { status: 409 })
        }

        const { error } = await admin
            .from('finance_entries')
            .delete()
            .eq('id', id)

        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('[admin/finance DELETE]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao excluir lancamento' }, { status: 500 })
    }
}
