import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'

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

function toNumber(v: any): number {
    const n = Number(v || 0)
    return Number.isFinite(n) ? n : 0
}

function normalizeDate(raw: any): string | null {
    const v = String(raw || '').trim()
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}

export async function GET(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const { searchParams } = new URL(request.url)
        const startDate = normalizeDate(searchParams.get('start_date'))
        const endDate = normalizeDate(searchParams.get('end_date'))

        const admin = createAdminClient()

        let query = admin
            .from('finance_commissions')
            .select('id, broker_user_id, broker_name, sale_amount, commission_amount, status, due_date, paid_at, source_ref_type, source_ref_id, created_at')
            .order('created_at', { ascending: false })
            .limit(10000)

        if (startDate) query = query.gte('created_at', `${startDate}T00:00:00.000Z`)
        if (endDate) query = query.lte('created_at', `${endDate}T23:59:59.999Z`)

        const { data: commissions, error: commError } = await query
        if (commError) throw commError

        const { data: adminUsers } = await admin
            .from('admin_users')
            .select('id, name, email')
            .eq('is_active', true)

        const userMap = new Map<string, { name: string; email: string }>()
        for (const u of (adminUsers || [])) {
            userMap.set(u.id, { name: u.name, email: u.email })
        }

        const brokerMap = new Map<string, {
            broker_id: string | null
            broker_name: string
            total_commissions: number
            paid_commissions: number
            pending_commissions: number
            total_commission_amount: number
            paid_commission_amount: number
            pending_commission_amount: number
            total_sale_amount: number
            commissions: any[]
        }>()

        for (const c of (commissions || [])) {
            const brokerId = c.broker_user_id || null
            const brokerNameRaw = brokerId
                ? (userMap.get(brokerId)?.name || c.broker_name || 'Corretor')
                : (c.broker_name || 'Sem corretor')
            const key = brokerId || `name:${brokerNameRaw}`

            if (!brokerMap.has(key)) {
                brokerMap.set(key, {
                    broker_id: brokerId,
                    broker_name: brokerNameRaw,
                    total_commissions: 0,
                    paid_commissions: 0,
                    pending_commissions: 0,
                    total_commission_amount: 0,
                    paid_commission_amount: 0,
                    pending_commission_amount: 0,
                    total_sale_amount: 0,
                    commissions: [],
                })
            }

            const bucket = brokerMap.get(key)!
            const amt = toNumber(c.commission_amount)
            const saleAmt = toNumber(c.sale_amount)
            const isPaid = c.status === 'paid'
            const isCancelled = c.status === 'reversed' || c.status === 'contested'

            if (!isCancelled) {
                bucket.total_commissions += 1
                bucket.total_commission_amount += amt
                bucket.total_sale_amount += saleAmt

                if (isPaid) {
                    bucket.paid_commissions += 1
                    bucket.paid_commission_amount += amt
                } else {
                    bucket.pending_commissions += 1
                    bucket.pending_commission_amount += amt
                }
            }

            bucket.commissions.push({
                id: c.id,
                sale_amount: saleAmt,
                commission_amount: amt,
                status: c.status,
                due_date: c.due_date || null,
                paid_at: c.paid_at || null,
                source_ref_type: c.source_ref_type || null,
                source_ref_id: c.source_ref_id || null,
                created_at: c.created_at,
            })
        }

        const brokers = Array.from(brokerMap.values()).sort(
            (a, b) => b.total_commission_amount - a.total_commission_amount,
        )

        const totals = brokers.reduce((acc, b) => ({
            total_commissions: acc.total_commissions + b.total_commissions,
            paid_commissions: acc.paid_commissions + b.paid_commissions,
            pending_commissions: acc.pending_commissions + b.pending_commissions,
            total_commission_amount: acc.total_commission_amount + b.total_commission_amount,
            paid_commission_amount: acc.paid_commission_amount + b.paid_commission_amount,
            pending_commission_amount: acc.pending_commission_amount + b.pending_commission_amount,
            total_sale_amount: acc.total_sale_amount + b.total_sale_amount,
        }), {
            total_commissions: 0,
            paid_commissions: 0,
            pending_commissions: 0,
            total_commission_amount: 0,
            paid_commission_amount: 0,
            pending_commission_amount: 0,
            total_sale_amount: 0,
        })

        return NextResponse.json({
            success: true,
            period: { start_date: startDate, end_date: endDate },
            totals,
            brokers,
        })
    } catch (err: any) {
        console.error('[admin/finance/broker-report GET]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao gerar relatorio de corretores' }, { status: 500 })
    }
}
