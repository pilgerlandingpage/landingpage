import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'

type ReconciliationStatus = 'pending' | 'matched' | 'ignored'

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

function normalizeStatus(raw: any): ReconciliationStatus {
    const value = String(raw || '').trim().toLowerCase()
    if (value === 'matched') return 'matched'
    if (value === 'ignored') return 'ignored'
    return 'pending'
}

async function updateEntryReconciliationState(
    admin: any,
    entryId: string,
    isReconciled: boolean,
) {
    const hasIsReconciled = await columnExists(admin, 'is_reconciled')
    const hasReconciledAt = await columnExists(admin, 'reconciled_at')
    if (!hasIsReconciled && !hasReconciledAt) return

    const payload: any = {}
    if (hasIsReconciled) payload.is_reconciled = isReconciled
    if (hasReconciledAt) payload.reconciled_at = isReconciled ? new Date().toISOString() : null

    const { error } = await admin
        .from('finance_entries')
        .update(payload)
        .eq('id', entryId)

    if (error) throw error
}

async function clearPreviousMatchIfNeeded(admin: any, reconciliationId: string, previousEntryId: string | null) {
    if (!previousEntryId) return

    const { data: stillMatched, error: checkError } = await admin
        .from('finance_reconciliations')
        .select('id')
        .eq('matched_entry_id', previousEntryId)
        .eq('status', 'matched')
        .neq('id', reconciliationId)
        .limit(1)

    if (checkError) throw checkError
    if (Array.isArray(stillMatched) && stillMatched.length > 0) return

    await updateEntryReconciliationState(admin, previousEntryId, false)
}

function mapReconciliationRow(row: any) {
    return {
        id: row.id,
        bank_account_id: row.bank_account_id,
        statement_date: row.statement_date,
        description: row.description,
        amount: row.amount,
        external_ref: row.external_ref,
        status: row.status,
        matched_entry_id: row.matched_entry_id,
        notes: row.notes,
        created_at: row.created_at,
        bank_account: row.bank_account || null,
        matched_entry: row.matched_entry || null,
    }
}

export async function GET(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const { searchParams } = new URL(request.url)
        const status = normalizeStatus(searchParams.get('status'))
        const hasStatusFilter = !!searchParams.get('status')
        const bankAccountId = String(searchParams.get('bank_account_id') || '').trim()
        const startDate = String(searchParams.get('start_date') || '').trim()
        const endDate = String(searchParams.get('end_date') || '').trim()
        const limitRaw = Number(searchParams.get('limit') || 500)
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 2000)) : 500

        const admin = createAdminClient()
        let query = admin
            .from('finance_reconciliations')
            .select(`
                id,
                bank_account_id,
                statement_date,
                description,
                amount,
                external_ref,
                status,
                matched_entry_id,
                notes,
                created_at,
                bank_account:finance_bank_accounts(id, name, bank_name),
                matched_entry:finance_entries(id, description, amount, entry_type, entry_date)
            `)
            .order('statement_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(limit)

        if (hasStatusFilter) query = query.eq('status', status)
        if (bankAccountId) query = query.eq('bank_account_id', bankAccountId)
        if (startDate) query = query.gte('statement_date', startDate)
        if (endDate) query = query.lte('statement_date', endDate)

        const { data, error } = await query
        if (error) throw error

        return NextResponse.json({
            success: true,
            reconciliations: (data || []).map((row: any) => mapReconciliationRow(row)),
        })
    } catch (err: any) {
        console.error('[admin/finance/reconciliations GET]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao carregar conciliacoes' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const body = await request.json()
        const statementDate = String(body?.statement_date || '').trim()
        const amount = Number(body?.amount || 0)

        if (!statementDate) return NextResponse.json({ success: false, error: 'Data do extrato obrigatoria' }, { status: 400 })
        if (!Number.isFinite(amount) || amount === 0) {
            return NextResponse.json({ success: false, error: 'Valor do extrato invalido' }, { status: 400 })
        }

        const admin = createAdminClient()
        const insertData = {
            bank_account_id: String(body?.bank_account_id || '').trim() || null,
            statement_date: statementDate,
            description: String(body?.description || '').trim() || null,
            amount,
            external_ref: String(body?.external_ref || '').trim() || null,
            status: normalizeStatus(body?.status),
            matched_entry_id: String(body?.matched_entry_id || '').trim() || null,
            notes: String(body?.notes || '').trim() || null,
            created_by: access.adminUser?.id || null,
            updated_at: new Date().toISOString(),
        }

        const { data, error } = await admin
            .from('finance_reconciliations')
            .insert(insertData)
            .select(`
                id,
                bank_account_id,
                statement_date,
                description,
                amount,
                external_ref,
                status,
                matched_entry_id,
                notes,
                created_at,
                bank_account:finance_bank_accounts(id, name, bank_name),
                matched_entry:finance_entries(id, description, amount, entry_type, entry_date)
            `)
            .single()

        if (error) throw error

        if (insertData.status === 'matched' && insertData.matched_entry_id) {
            await updateEntryReconciliationState(admin, insertData.matched_entry_id, true)
        }

        return NextResponse.json({ success: true, reconciliation: mapReconciliationRow(data) }, { status: 201 })
    } catch (err: any) {
        console.error('[admin/finance/reconciliations POST]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao criar conciliacao' }, { status: 500 })
    }
}

export async function PUT(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const body = await request.json()
        const id = String(body?.id || '').trim()
        if (!id) return NextResponse.json({ success: false, error: 'ID obrigatorio' }, { status: 400 })

        const admin = createAdminClient()
        const { data: current, error: currentError } = await admin
            .from('finance_reconciliations')
            .select('id, matched_entry_id, status')
            .eq('id', id)
            .single()

        if (currentError || !current) {
            return NextResponse.json({ success: false, error: 'Conciliacao nao encontrada' }, { status: 404 })
        }

        const nextStatus = normalizeStatus(body?.status)
        const nextMatchedEntryId = String(body?.matched_entry_id || '').trim() || null

        const updateData: any = {
            bank_account_id: String(body?.bank_account_id || '').trim() || null,
            statement_date: String(body?.statement_date || '').trim() || null,
            description: String(body?.description || '').trim() || null,
            amount: Number(body?.amount || 0),
            external_ref: String(body?.external_ref || '').trim() || null,
            status: nextStatus,
            matched_entry_id: nextStatus === 'matched' ? nextMatchedEntryId : null,
            notes: String(body?.notes || '').trim() || null,
            updated_at: new Date().toISOString(),
        }

        if (!updateData.statement_date) {
            return NextResponse.json({ success: false, error: 'Data do extrato obrigatoria' }, { status: 400 })
        }
        if (!Number.isFinite(updateData.amount) || updateData.amount === 0) {
            return NextResponse.json({ success: false, error: 'Valor do extrato invalido' }, { status: 400 })
        }
        if (nextStatus === 'matched' && !nextMatchedEntryId) {
            return NextResponse.json({ success: false, error: 'Selecione um lancamento para conciliar' }, { status: 400 })
        }

        const { data, error } = await admin
            .from('finance_reconciliations')
            .update(updateData)
            .eq('id', id)
            .select(`
                id,
                bank_account_id,
                statement_date,
                description,
                amount,
                external_ref,
                status,
                matched_entry_id,
                notes,
                created_at,
                bank_account:finance_bank_accounts(id, name, bank_name),
                matched_entry:finance_entries(id, description, amount, entry_type, entry_date)
            `)
            .single()

        if (error) throw error

        if (current.matched_entry_id && (nextStatus !== 'matched' || current.matched_entry_id !== nextMatchedEntryId)) {
            await clearPreviousMatchIfNeeded(admin, id, current.matched_entry_id)
        }
        if (nextStatus === 'matched' && nextMatchedEntryId) {
            await updateEntryReconciliationState(admin, nextMatchedEntryId, true)
        }

        return NextResponse.json({ success: true, reconciliation: mapReconciliationRow(data) })
    } catch (err: any) {
        console.error('[admin/finance/reconciliations PUT]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao atualizar conciliacao' }, { status: 500 })
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
        const { data: current, error: currentError } = await admin
            .from('finance_reconciliations')
            .select('id, matched_entry_id')
            .eq('id', id)
            .single()

        if (currentError || !current) {
            return NextResponse.json({ success: false, error: 'Conciliacao nao encontrada' }, { status: 404 })
        }

        const { error } = await admin
            .from('finance_reconciliations')
            .delete()
            .eq('id', id)

        if (error) throw error

        if (current.matched_entry_id) {
            await clearPreviousMatchIfNeeded(admin, id, current.matched_entry_id)
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('[admin/finance/reconciliations DELETE]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao remover conciliacao' }, { status: 500 })
    }
}
