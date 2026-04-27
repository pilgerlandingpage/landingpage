import { NextResponse } from 'next/server'
import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'
import { syncPaidAdsSpendToFinance } from '@/lib/finance/ads-spend-sync'

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

export async function POST(request: Request) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const body = await request.json().catch(() => ({}))
        const date = typeof body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
            ? body.date
            : undefined

        const admin = createAdminClient()
        const result = await syncPaidAdsSpendToFinance(admin, { date })

        return NextResponse.json({ success: true, ...result })
    } catch (err: any) {
        console.error('[finance/sync-ads-spend]', err)
        return NextResponse.json(
            { success: false, error: err?.message || 'Erro ao sincronizar gastos de trafego pago' },
            { status: 500 }
        )
    }
}
