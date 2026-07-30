import { NextRequest, NextResponse } from 'next/server'
import { requireAdminModules } from '@/lib/admin/require-admin'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { centsToMoney, loadCommerceConfig } from '@/lib/commerce/checkout'
import { processCommerceAutomations } from '@/lib/commerce/automation'
import {
  OFFICIAL_COMMERCE_WHATSAPP_TEMPLATES,
  OFFICIAL_COMMERCE_WHATSAPP_TEMPLATE_KEYS,
  commerceOfficialWhatsAppMetaComponents,
  upsertCommerceOfficialWhatsAppTemplates,
} from '@/lib/commerce/official-whatsapp-templates'

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

function objectRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {}
}

function safeArray(value: unknown): any[] {
  return Array.isArray(value) ? value : []
}

function safeJsonArray(value: unknown): any[] {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function stringList(value: unknown, fallback: string[] = []) {
  const values = safeArray(value).map(item => text(item)).filter(Boolean)
  return values.length ? values : fallback
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
      officialTemplatesRes,
      metaDraftsRes,
      metaTemplatesRes,
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
      supabase
        .from('message_templates')
        .select('id, template_key, event_type, name, channel, body, variables, requires_opt_in, is_active, metadata, updated_at')
        .eq('business_unit', 'education')
        .eq('channel', 'whatsapp')
        .in('template_key', OFFICIAL_COMMERCE_WHATSAPP_TEMPLATE_KEYS),
      supabase
        .from('app_config')
        .select('value')
        .eq('key', 'meta_whatsapp_template_drafts')
        .maybeSingle(),
      supabase
        .from('meta_whatsapp_templates')
        .select('name, language, category, status, quality_score, updated_at, last_synced_at'),
    ])

    const firstError =
      ordersRes.error ||
      paidOrdersRes.error ||
      todayPaidOrdersRes.error ||
      customersCountRes.error ||
      educationLeadsCountRes.error ||
      messagesCountRes.error ||
      recentMessagesRes.error ||
      officialTemplatesRes.error ||
      metaDraftsRes.error ||
      metaTemplatesRes.error
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
    const officialTemplatesByKey = new Map<string, any>((officialTemplatesRes.data || []).map((template: any) => [text(template.template_key), template]))
    const metaDrafts = safeJsonArray(metaDraftsRes.data?.value)
    const metaDraftIds = new Set<string>()
    for (const draft of metaDrafts) {
      const record = objectRecord(draft)
      const id = text(record.id)
      const name = text(record.name)
      if (id) metaDraftIds.add(id)
      if (name) metaDraftIds.add(`name:${name}`)
    }
    const metaTemplateByName = new Map<string, any>((metaTemplatesRes.data || []).map((template: any) => [
      `${text(template.name)}:${text(template.language, 'pt_BR')}`,
      template,
    ]))
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
      official_whatsapp_templates: OFFICIAL_COMMERCE_WHATSAPP_TEMPLATES.map((definition) => {
        const template = officialTemplatesByKey.get(definition.templateKey) || {}
        const metadata = objectRecord(template.metadata)
        const meta = objectRecord(metadata.meta_whatsapp)
        const templateName = text(meta.template_name, definition.meta.templateName)
        const language = text(meta.template_language, definition.meta.language)
        const remote = metaTemplateByName.get(`${templateName}:${language}`)
        const hasDraft = metaDraftIds.has(`commerce_${definition.templateKey}`) || metaDraftIds.has(`name:${templateName}`)
        const status = remote ? text(remote.status, 'SYNCED') : hasDraft ? 'DRAFT' : 'READY'

        return {
          template_key: definition.templateKey,
          name: text(template.name, definition.name),
          event_type: text(template.event_type, definition.eventType),
          body: text(template.body, definition.internalBody),
          variables: stringList(template.variables, definition.variables),
          requires_opt_in: typeof template.requires_opt_in === 'boolean' ? template.requires_opt_in : definition.requiresOptIn,
          is_active: typeof template.is_active === 'boolean' ? template.is_active : false,
          updated_at: template.updated_at || null,
          meta: {
            template_name: templateName,
            language,
            category: text(meta.category, definition.meta.category),
            status,
            quality_score: remote?.quality_score || null,
            has_draft: hasDraft,
            components: safeArray(meta.draft_components).length ? safeArray(meta.draft_components) : commerceOfficialWhatsAppMetaComponents(definition),
            example_values: stringList(meta.example_values, definition.meta.bodyExamples),
            body_variables: stringList(meta.body_variables, definition.meta.bodyVariables),
            last_synced_at: remote?.last_synced_at || remote?.updated_at || null,
          },
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
    const supabase = createSupabaseAdminClient()

    if (action === 'prepare_meta_whatsapp_templates') {
      const result = await upsertCommerceOfficialWhatsAppTemplates(supabase)
      return NextResponse.json({
        ...result,
        message: `${result.templates_count} templates oficiais do WhatsApp preparados como rascunhos para revisao.`,
      })
    }
    if (action !== 'run_automations') {
      return NextResponse.json({ success: false, error: 'Ação inválida.' }, { status: 400 })
    }

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
