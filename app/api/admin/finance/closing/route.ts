import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'

type ClosingAction = 'close' | 'lock'
type ReopenAction = 'reopen'
type ClosingStatus = 'open' | 'closed' | 'locked'

function toNullableText(value: any): string | null {
    const text = String(value || '').trim()
    return text || null
}

function normalizePeriodDate(raw: any): string | null {
    const value = String(raw || '').trim()
    if (!value) return null
    if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
    return null
}

function toClosingAction(raw: any): ClosingAction {
    return String(raw || '').trim().toLowerCase() === 'lock' ? 'lock' : 'close'
}

function toReopenAction(raw: any): ReopenAction {
    return String(raw || '').trim().toLowerCase() === 'reopen' ? 'reopen' : 'reopen'
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
        const limitRaw = Number(searchParams.get('limit') || 24)
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 120)) : 24

        const admin = createAdminClient()
        const { data, error } = await admin
            .from('finance_closing_periods')
            .select('*')
            .order('period_month', { ascending: false })
            .limit(limit)

        if (error) throw error
        return NextResponse.json({ success: true, periods: data || [] })
    } catch (err: any) {
        console.error('[admin/finance/closing GET]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao carregar fechamentos' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const body = await request.json()
        const action = toClosingAction(body?.action)
        const periodDate = normalizePeriodDate(body?.period_month)
        if (!periodDate) {
            return NextResponse.json({ success: false, error: 'Periodo invalido. Use YYYY-MM.' }, { status: 400 })
        }

        const admin = createAdminClient()
        const nowIso = new Date().toISOString()
        const nextStatus: ClosingStatus = action === 'lock' ? 'locked' : 'closed'
        const inputNotes = toNullableText(body?.notes)

        const { data: current, error: currentError } = await admin
            .from('finance_closing_periods')
            .select('id, status, closed_at, locked_at, closed_by, notes')
            .eq('period_month', periodDate)
            .maybeSingle()

        if (currentError) throw currentError
        if (current?.status === 'locked' && action !== 'lock') {
            return NextResponse.json({ success: false, error: 'Periodo bloqueado nao pode ser apenas fechado' }, { status: 400 })
        }

        if (current?.id) {
            const { data, error } = await admin
                .from('finance_closing_periods')
                .update({
                    status: nextStatus,
                    closed_at: current.closed_at || nowIso,
                    locked_at: action === 'lock' ? (current.locked_at || nowIso) : current.locked_at,
                    closed_by: access.adminUser?.id || current.closed_by || null,
                    notes: inputNotes ?? current.notes ?? null,
                    updated_at: nowIso,
                })
                .eq('id', current.id)
                .select('*')
                .single()

            if (error) throw error
            return NextResponse.json({ success: true, period: data })
        }

        const { data, error } = await admin
            .from('finance_closing_periods')
            .insert({
                period_month: periodDate,
                status: nextStatus,
                closed_at: nowIso,
                locked_at: action === 'lock' ? nowIso : null,
                closed_by: access.adminUser?.id || null,
                notes: inputNotes,
                updated_at: nowIso,
            })
            .select('*')
            .single()

        if (error) throw error
        return NextResponse.json({ success: true, period: data })
    } catch (err: any) {
        console.error('[admin/finance/closing POST]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao fechar periodo' }, { status: 500 })
    }
}

export async function PUT(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const body = await request.json()
        toReopenAction(body?.action)
        const periodDate = normalizePeriodDate(body?.period_month)
        if (!periodDate) {
            return NextResponse.json({ success: false, error: 'Periodo invalido. Use YYYY-MM.' }, { status: 400 })
        }

        const admin = createAdminClient()
        const { data: current, error: currentError } = await admin
            .from('finance_closing_periods')
            .select('id, status')
            .eq('period_month', periodDate)
            .single()

        if (currentError || !current) {
            return NextResponse.json({ success: false, error: 'Periodo nao encontrado' }, { status: 404 })
        }
        if (current.status === 'locked') {
            return NextResponse.json({ success: false, error: 'Periodo bloqueado nao pode ser reaberto' }, { status: 400 })
        }

        const { data, error } = await admin
            .from('finance_closing_periods')
            .update({
                status: 'open',
                closed_at: null,
                updated_at: new Date().toISOString(),
                notes: toNullableText(body?.notes),
                closed_by: access.adminUser?.id || null,
            })
            .eq('id', current.id)
            .select('*')
            .single()

        if (error) throw error
        return NextResponse.json({ success: true, period: data })
    } catch (err: any) {
        console.error('[admin/finance/closing PUT]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao reabrir periodo' }, { status: 500 })
    }
}
