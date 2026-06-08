import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'
import { sendBrevoEmail } from '@/lib/email/brevo'

async function getCurrentAdminUser() {
    const supabase = await createServerSupabase()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    }

    const admin = createAdminClient()
    const { data: adminUser, error: adminError } = await admin
        .from('admin_users')
        .select('id, name, email, is_master, is_active')
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

function todayISO(): string {
    return new Date().toISOString().slice(0, 10)
}

function addDays(date: string, days: number): string {
    const d = new Date(`${date}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
}

function formatBRL(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(iso: string): string {
    const [year, month, day] = (iso || '').split('-')
    return `${day}/${month}/${year}`
}

function urgencyLabel(daysUntilDue: number): 'overdue' | 'critical' | 'warning' {
    if (daysUntilDue < 0) return 'overdue'
    if (daysUntilDue <= 1) return 'critical'
    return 'warning'
}

async function fetchDuePayables(admin: any, today: string, daysAhead: number, entityId?: string | null) {
    const upperDate = addDays(today, daysAhead)

    const [hasStatus, hasSettledAmount, hasDescription, hasCounterpartyName, hasEntityIdCol, hasCategoryCol] = await Promise.all([
        admin.from('finance_payables').select('status').limit(1).then((r: any) => !r.error),
        admin.from('finance_payables').select('paid_amount').limit(1).then((r: any) => !r.error),
        admin.from('finance_payables').select('description').limit(1).then((r: any) => !r.error),
        admin.from('finance_payables').select('counterparty_name').limit(1).then((r: any) => !r.error),
        admin.from('finance_payables').select('entity_id').limit(1).then((r: any) => !r.error),
        admin.from('finance_payables').select('category').limit(1).then((r: any) => !r.error),
    ])

    const columns = ['id', 'amount', 'due_date']
    if (hasDescription) columns.push('description')
    if (hasCounterpartyName) columns.push('counterparty_name')
    if (hasStatus) columns.push('status')
    if (hasSettledAmount) columns.push('paid_amount')
    if (hasEntityIdCol) columns.push('entity_id')
    if (hasCategoryCol) columns.push('category')

    let query = admin
        .from('finance_payables')
        .select(columns.join(', '))
        .lte('due_date', upperDate)
        .order('due_date', { ascending: true })
        .limit(200)

    if (entityId && hasEntityIdCol) {
        query = query.eq('entity_id', entityId)
    }

    const { data, error } = await query
    if (error || !data) return []

    const todayDate = new Date(`${today}T12:00:00Z`)

    return (data as any[])
        .filter((row) => {
            const status = String(row.status || '').toLowerCase()
            if (status === 'paid' || status === 'cancelled') return false
            const settled = Number(row.paid_amount || 0)
            const amount = Number(row.amount || 0)
            if (settled >= amount) return false
            return true
        })
        .map((row) => {
            const dueDate = new Date(`${row.due_date}T12:00:00Z`)
            const daysUntilDue = Math.round((dueDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))
            const amount = Number(row.amount || 0)
            const settled = Number(row.paid_amount || 0)
            return {
                id: row.id,
                description: row.description || 'Sem descrição',
                counterparty_name: row.counterparty_name || null,
                category: row.category || null,
                entity_id: row.entity_id || null,
                amount,
                remaining_amount: Math.max(0, amount - settled),
                due_date: row.due_date,
                days_until_due: daysUntilDue,
                urgency: urgencyLabel(daysUntilDue),
            }
        })
}

export async function GET(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const { searchParams } = new URL(request.url)
        const daysRaw = Number(searchParams.get('days') || 3)
        const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(daysRaw, 30)) : 3
        const entityId = searchParams.get('entity_id') || null

        const admin = createAdminClient()
        const today = todayISO()
        const items = await fetchDuePayables(admin, today, days, entityId)

        const overdue = items.filter(i => i.urgency === 'overdue')
        const critical = items.filter(i => i.urgency === 'critical')
        const warning = items.filter(i => i.urgency === 'warning')

        return NextResponse.json({
            success: true,
            today,
            days_ahead: days,
            entity_id: entityId,
            summary: {
                total: items.length,
                overdue: overdue.length,
                critical: critical.length,
                warning: warning.length,
                total_amount: items.reduce((s, i) => s + i.remaining_amount, 0),
            },
            items,
        })
    } catch (err: any) {
        console.error('[admin/finance/alerts GET]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao buscar alertas' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const access = await getCurrentAdminUser()
        if (access.error) return access.error

        const body = await request.json()
        const daysRaw = Number(body?.days || 3)
        const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(daysRaw, 30)) : 3
        const entityId = body?.entity_id || null

        const admin = createAdminClient()
        const today = todayISO()
        const items = await fetchDuePayables(admin, today, days, entityId)

        if (items.length === 0) {
            return NextResponse.json({ success: true, message: 'Nenhum titulo vencendo no periodo', sent: false })
        }

        const { data: masterAdmins } = await admin
            .from('admin_users')
            .select('id, name, email')
            .eq('is_master', true)
            .eq('is_active', true)

        const recipients = (masterAdmins || [])
            .filter((u: any) => u.email)
            .map((u: any) => ({ email: u.email, name: u.name }))

        if (recipients.length === 0) {
            return NextResponse.json({ success: false, error: 'Nenhum admin master com email cadastrado' }, { status: 400 })
        }

        const overdue = items.filter(i => i.days_until_due < 0)
        const upcoming = items.filter(i => i.days_until_due >= 0)

        const tableRows = (section: typeof items, label: string, color: string) => section.length === 0 ? '' : `
            <h3 style="color:${color};margin:16px 0 8px">${label} (${section.length})</h3>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead>
                <tr style="background:#f5f5f5">
                  <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #e0e0e0">Descrição</th>
                  <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #e0e0e0">Favorecido</th>
                  <th style="padding:6px 10px;text-align:right;border-bottom:1px solid #e0e0e0">Valor</th>
                  <th style="padding:6px 10px;text-align:center;border-bottom:1px solid #e0e0e0">Vencimento</th>
                </tr>
              </thead>
              <tbody>
                ${section.map(i => `
                  <tr>
                    <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0">${i.description}</td>
                    <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0">${i.counterparty_name || '-'}</td>
                    <td style="padding:6px 10px;text-align:right;border-bottom:1px solid #f0f0f0">${formatBRL(i.remaining_amount)}</td>
                    <td style="padding:6px 10px;text-align:center;border-bottom:1px solid #f0f0f0">${formatDate(i.due_date)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>`

        const htmlContent = `
            <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px">
              <div style="background:#1a1a2e;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
                <h2 style="margin:0;font-size:18px">Alerta Financeiro — Contas a Pagar</h2>
                <p style="margin:4px 0 0;opacity:.7;font-size:13px">${formatDate(today)} · ${items.length} título(s) requer(em) atenção</p>
              </div>
              <div style="background:#fff;padding:20px 24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px">
                <div style="display:flex;gap:16px;margin-bottom:16px">
                  <div style="flex:1;background:#fff3f3;border-radius:6px;padding:12px;text-align:center">
                    <div style="font-size:22px;font-weight:bold;color:#d32f2f">${overdue.length}</div>
                    <div style="font-size:12px;color:#666">Vencidos</div>
                  </div>
                  <div style="flex:1;background:#fff8e1;border-radius:6px;padding:12px;text-align:center">
                    <div style="font-size:22px;font-weight:bold;color:#f57c00">${upcoming.length}</div>
                    <div style="font-size:12px;color:#666">Vencendo em ${days} dias</div>
                  </div>
                  <div style="flex:1;background:#f3f3ff;border-radius:6px;padding:12px;text-align:center">
                    <div style="font-size:22px;font-weight:bold;color:#3f51b5">${formatBRL(items.reduce((s, i) => s + i.remaining_amount, 0))}</div>
                    <div style="font-size:12px;color:#666">Total em aberto</div>
                  </div>
                </div>
                ${tableRows(overdue, 'Vencidos', '#d32f2f')}
                ${tableRows(upcoming, `Vencendo nos próximos ${days} dias`, '#f57c00')}
                <p style="margin-top:24px;font-size:12px;color:#999">Este alerta foi gerado automaticamente pelo sistema Pilger.</p>
              </div>
            </div>`

        await sendBrevoEmail({
            to: recipients,
            subject: `[Pilger Finance] ${items.length} conta(s) vencendo — ${formatDate(today)}`,
            htmlContent,
        })

        await admin.from('finance_alert_logs').insert({
            alert_type: 'due_date',
            entity_id: entityId,
            payable_ids: items.map(i => i.id),
            recipient_email: recipients.map((r: any) => r.email).join(', '),
            items_count: items.length,
            notes: `Alerta manual disparado por ${access.adminUser.id}`,
        }).then(() => {})

        return NextResponse.json({
            success: true,
            sent: true,
            recipients: recipients.length,
            items_count: items.length,
            message: `Email enviado para ${recipients.length} destinatário(s) com ${items.length} título(s)`,
        })
    } catch (err: any) {
        console.error('[admin/finance/alerts POST]', err)
        return NextResponse.json({ success: false, error: err?.message || 'Erro ao enviar alertas' }, { status: 500 })
    }
}
