import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'

type ExportStatus = 'generated' | 'sent' | 'confirmed' | 'failed'

function toNullableText(value: any): string | null {
    const text = String(value || '').trim()
    return text || null
}

function normalizeDate(raw: any): string | null {
    const value = String(raw || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
    return value
}

function toStatus(raw: any): ExportStatus {
    const value = String(raw || '').trim().toLowerCase()
    if (value === 'sent') return 'sent'
    if (value === 'confirmed') return 'confirmed'
    if (value === 'failed') return 'failed'
    return 'generated'
}

function csvEscape(value: any) {
    const text = String(value ?? '')
    if (text.includes(';') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`
    }
    return text
}

function buildCsv(rows: any[]) {
    const headers = [
        'entry_id',
        'accounting_date',
        'entry_type',
        'amount',
        'signed_amount',
        'description',
        'category',
        'subcategory',
        'payment_method',
        'payment_status',
        'counterparty_name',
        'counterparty_type',
        'reference_company',
        'cost_center_id',
        'bank_account_id',
        'source_module',
        'external_reference',
        'notes',
    ]

    const lines = [headers.join(';')]
    rows.forEach(row => {
        lines.push([
            row.entry_id,
            row.accounting_date,
            row.entry_type,
            row.amount,
            row.signed_amount,
            row.description,
            row.category,
            row.subcategory,
            row.payment_method,
            row.payment_status,
            row.counterparty_name,
            row.counterparty_type,
            row.reference_company,
            row.cost_center_id,
            row.bank_account_id,
            row.source_module,
            row.external_reference,
            row.notes,
        ].map(csvEscape).join(';'))
    })

    return lines.join('\n')
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

export async function GET(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const { searchParams } = new URL(request.url)
        const limitRaw = Number(searchParams.get('limit') || 50)
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 500)) : 50

        const admin = createAdminClient()
        const { data, error } = await admin
            .from('finance_accounting_exports')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) throw error
        return NextResponse.json({ success: true, exports: data || [] })
    } catch (err: any) {
        console.error('[admin/finance/accounting-exports GET]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao carregar exportacoes' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const body = await request.json()
        const periodStart = normalizeDate(body?.period_start)
        const periodEnd = normalizeDate(body?.period_end)
        if (!periodStart || !periodEnd) {
            return NextResponse.json({ success: false, error: 'Periodo invalido. Use YYYY-MM-DD.' }, { status: 400 })
        }
        if (periodEnd < periodStart) {
            return NextResponse.json({ success: false, error: 'Data final menor que data inicial.' }, { status: 400 })
        }

        const admin = createAdminClient()

        let lines: any[] = []
        const { data: viewData, error: viewError } = await admin
            .from('finance_accounting_export_lines')
            .select('*')
            .gte('accounting_date', periodStart)
            .lte('accounting_date', periodEnd)
            .order('accounting_date', { ascending: true })
            .order('created_at', { ascending: true })
            .limit(100000)

        if (!viewError) {
            lines = viewData || []
        } else {
            const { data: entries, error: entriesError } = await admin
                .from('finance_entries')
                .select('*')
                .gte('entry_date', periodStart)
                .lte('entry_date', periodEnd)
                .order('entry_date', { ascending: true })
                .limit(100000)
            if (entriesError) throw entriesError
            lines = (entries || []).map((row: any) => ({
                entry_id: row.id,
                accounting_date: row.competence_date || row.due_date || row.entry_date,
                entry_type: row.entry_type,
                amount: row.amount,
                signed_amount: row.entry_type === 'income' ? row.amount : (Number(row.amount || 0) * -1),
                description: row.description,
                category: row.category,
                subcategory: row.subcategory,
                payment_method: row.payment_method,
                payment_status: row.payment_status,
                counterparty_name: row.counterparty_name,
                counterparty_type: row.counterparty_type,
                reference_company: row.reference_company,
                cost_center_id: row.cost_center_id,
                bank_account_id: row.bank_account_id,
                source_module: row.source_module,
                external_reference: row.external_reference,
                notes: row.notes,
            }))
        }

        const csv = buildCsv(lines)
        const payload = {
            rows_count: lines.length,
            generated_at: new Date().toISOString(),
            period_start: periodStart,
            period_end: periodEnd,
        }

        const { data: exportRow, error: insertError } = await admin
            .from('finance_accounting_exports')
            .insert({
                period_start: periodStart,
                period_end: periodEnd,
                status: 'generated',
                payload,
                generated_by: access.adminUser?.id || null,
                updated_at: new Date().toISOString(),
            })
            .select('*')
            .single()

        if (insertError) throw insertError

        return NextResponse.json({
            success: true,
            export: exportRow,
            rows_count: lines.length,
            csv,
        })
    } catch (err: any) {
        console.error('[admin/finance/accounting-exports POST]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao gerar exportacao' }, { status: 500 })
    }
}

export async function PUT(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const body = await request.json()
        const id = String(body?.id || '').trim()
        if (!id) return NextResponse.json({ success: false, error: 'ID obrigatorio' }, { status: 400 })

        const status = toStatus(body?.status)
        const admin = createAdminClient()

        const { data, error } = await admin
            .from('finance_accounting_exports')
            .update({
                status,
                file_url: toNullableText(body?.file_url),
                payload: body?.payload ?? undefined,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select('*')
            .single()

        if (error) throw error
        return NextResponse.json({ success: true, export: data })
    } catch (err: any) {
        console.error('[admin/finance/accounting-exports PUT]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao atualizar exportacao' }, { status: 500 })
    }
}
