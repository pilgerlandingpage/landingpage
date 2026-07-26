import { NextRequest, NextResponse } from 'next/server'
import { requireAdminModules } from '@/lib/admin/require-admin'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { centsToMoney, loadCommerceConfig } from '@/lib/commerce/checkout'
import { processCommerceAutomations } from '@/lib/commerce/automation'

export const dynamic = 'force-dynamic'

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function countFrom(result: { count?: number | null }) {
  return Number(result.count || 0)
}

async function orderCount(supabase: ReturnType<typeof createSupabaseAdminClient>, status?: string) {
  let query = supabase.from('commerce_orders').select('id', { count: 'exact', head: true })
  if (status) query = query.eq('status', status)
  const { count, error } = await query
  if (error) throw error
  return count || 0
}

function sumCents(rows: Array<{ total_cents?: number | null }>) {
  return rows.reduce((total, row) => total + Math.max(0, Number(row.total_cents || 0)), 0)
}

function startOfTodayIso() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

export async function GET() {
  try {
    const auth = await requireAdminModules(['commerce', 'products', 'maintenance'])
    if (!auth.ok) return auth.response

    const supabase = createSupabaseAdminClient()
    const [
      ordersRes,
      paidOrdersRes,
      todayPaidOrdersRes,
      totalOrders,
      checkoutStarted,
      pendingPayment,
      abandoned,
      paid,
      expired,
      customersCountRes,
      educationLeadsCountRes,
      messagesCountRes,
      recentMessagesRes,
    ] = await Promise.all([
      supabase
        .from('commerce_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('commerce_orders')
        .select('total_cents')
        .eq('status', 'paid')
        .limit(5000),
      supabase
        .from('commerce_orders')
        .select('total_cents')
        .eq('status', 'paid')
        .gte('paid_at', startOfTodayIso())
        .limit(1000),
      orderCount(supabase),
      orderCount(supabase, 'checkout_started'),
      orderCount(supabase, 'pending_payment'),
      orderCount(supabase, 'abandoned'),
      orderCount(supabase, 'paid'),
      orderCount(supabase, 'expired'),
      supabase.from('commerce_customers').select('id', { count: 'exact', head: true }),
      supabase.from('education_leads').select('id', { count: 'exact', head: true }),
      supabase
        .from('message_dispatches')
        .select('id', { count: 'exact', head: true })
        .eq('business_unit', 'education'),
      supabase
        .from('message_dispatches')
        .select('*')
        .eq('business_unit', 'education')
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    const firstError =
      ordersRes.error ||
      paidOrdersRes.error ||
      todayPaidOrdersRes.error ||
      customersCountRes.error ||
      educationLeadsCountRes.error ||
      messagesCountRes.error ||
      recentMessagesRes.error
    if (firstError) throw firstError

    const orders = ordersRes.data || []
    const orderIds = orders.map((order: any) => text(order.id)).filter(Boolean)
    const customerIds = Array.from(new Set(orders.map((order: any) => text(order.customer_id)).filter(Boolean)))

    const [customersRes, itemsRes, paymentsRes, templatesRes, config] = await Promise.all([
      customerIds.length
        ? supabase.from('commerce_customers').select('*').in('id', customerIds)
        : Promise.resolve({ data: [], error: null }),
      orderIds.length
        ? supabase.from('commerce_order_items').select('*').in('order_id', orderIds).order('created_at', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      orderIds.length
        ? supabase.from('commerce_payments').select('*').in('order_id', orderIds).order('updated_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      (recentMessagesRes.data || []).length
        ? supabase
            .from('message_templates')
            .select('id, template_key, event_type, name, channel')
            .in('id', Array.from(new Set((recentMessagesRes.data || []).map((message: any) => text(message.template_id)).filter(Boolean))))
        : Promise.resolve({ data: [], error: null }),
      loadCommerceConfig(),
    ])

    const relatedError = customersRes.error || itemsRes.error || paymentsRes.error || templatesRes.error
    if (relatedError) throw relatedError

    const customersById = new Map<string, any>((customersRes.data || []).map((customer: any) => [text(customer.id), customer]))
    const itemsByOrder = new Map<string, any[]>()
    for (const item of itemsRes.data || []) {
      const orderId = text(item.order_id)
      itemsByOrder.set(orderId, [...(itemsByOrder.get(orderId) || []), item])
    }

    const paymentsByOrder = new Map<string, any>()
    for (const payment of paymentsRes.data || []) {
      const orderId = text(payment.order_id)
      if (!paymentsByOrder.has(orderId)) paymentsByOrder.set(orderId, payment)
    }

    const templatesById = new Map<string, any>((templatesRes.data || []).map((template: any) => [text(template.id), template]))
    const paidRevenueCents = sumCents((paidOrdersRes.data || []) as Array<{ total_cents?: number | null }>)
    const todayRevenueCents = sumCents((todayPaidOrdersRes.data || []) as Array<{ total_cents?: number | null }>)
    const totalOrderCount = Number(totalOrders || 0)

    return NextResponse.json({
      success: true,
      stats: {
        total_orders: totalOrderCount,
        paid_orders: paid,
        pending_payment: pendingPayment,
        abandoned,
        expired,
        customers: countFrom(customersCountRes),
        education_leads: countFrom(educationLeadsCountRes),
        messages: countFrom(messagesCountRes),
        revenue_cents: paidRevenueCents,
        revenue_display: centsToMoney(paidRevenueCents),
        today_revenue_cents: todayRevenueCents,
        today_revenue_display: centsToMoney(todayRevenueCents),
        conversion_rate: totalOrderCount > 0 ? Math.round((paid / totalOrderCount) * 1000) / 10 : 0,
      },
      funnel: [
        { key: 'checkout_started', label: 'Checkout iniciado', count: checkoutStarted },
        { key: 'pending_payment', label: 'Pix pendente', count: pendingPayment },
        { key: 'abandoned', label: 'Carrinho abandonado', count: abandoned },
        { key: 'paid', label: 'Compra aprovada', count: paid },
        { key: 'expired', label: 'Pix vencido', count: expired },
      ],
      orders: orders.map((order: any) => {
        const customer = customersById.get(text(order.customer_id)) || {}
        const items = itemsByOrder.get(text(order.id)) || []
        const payment = paymentsByOrder.get(text(order.id)) || null
        return {
          ...order,
          total_display: centsToMoney(Number(order.total_cents || 0)),
          customer: {
            id: customer.id || null,
            name: customer.name || '',
            email: customer.email || '',
            phone: customer.phone_e164 || customer.phone || '',
          },
          items: items.map((item) => ({
            id: item.id,
            title: item.title_snapshot,
            item_type: item.item_type,
            total_display: centsToMoney(Number(item.total_amount_cents || 0)),
          })),
          payment: payment ? {
            id: payment.id,
            status: payment.status,
            payment_method: payment.payment_method,
            pix_ticket_url: payment.pix_ticket_url,
            expires_at: payment.expires_at,
          } : null,
        }
      }),
      messages: (recentMessagesRes.data || []).map((message: any) => {
        const template = templatesById.get(text(message.template_id)) || {}
        return {
          ...message,
          template_key: template.template_key || message.metadata?.template_key || '',
          template_name: template.name || template.template_key || message.metadata?.template_key || '',
          event_type: template.event_type || '',
        }
      }),
      automation: {
        enabled: config.automationEnabled,
        checkout_abandoned_after_minutes: config.checkoutAbandonedAfterMinutes,
        pix_pending_after_minutes: config.pixPendingAfterMinutes,
        pix_expiring_before_minutes: config.pixExpiringBeforeMinutes,
        checkout_lost_after_hours: config.checkoutLostAfterHours,
        whatsapp_enabled: config.whatsappNotificationsEnabled,
        email_enabled: config.emailNotificationsEnabled,
      },
    })
  } catch (error) {
    console.error('[Admin Commerce] GET failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminModules(['commerce', 'products', 'maintenance'])
    if (!auth.ok) return auth.response

    const body = await request.json().catch(() => ({}))
    const action = text(body?.action)
    if (action !== 'run_automations') {
      return NextResponse.json({ success: false, error: 'Ação inválida.' }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    const result = await processCommerceAutomations(supabase, {
      limit: body?.limit,
      dryRun: body?.dry_run === true,
      force: body?.force === true,
      source: 'admin_manual_run',
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Admin Commerce] POST failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
