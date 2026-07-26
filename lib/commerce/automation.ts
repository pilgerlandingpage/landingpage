import { centsToMoney, loadCommerceConfig } from './checkout'
import { commerceMessageVariables, dispatchCommerceMessage } from './transactional-messages'

type SupabaseAdminLike = {
  from: (table: string) => any
}

type AutomationAction =
  | 'checkout_abandoned'
  | 'checkout_payment_pending'
  | 'checkout_pix_expiring'
  | 'checkout_pix_expired'

type AutomationOptions = {
  limit?: number
  dryRun?: boolean
  force?: boolean
  source?: string
}

type AutomationDispatchResult = {
  channel: 'whatsapp' | 'email'
  templateKey: string
  result?: unknown
  error?: string
}

type AutomationEvent = {
  action: AutomationAction
  order_id: string
  order_number: string
  customer: string
  total: string
  status: 'processed' | 'dry_run' | 'failed'
  dispatches: AutomationDispatchResult[]
  error?: string
}

type OrderBundle = {
  order: Record<string, any>
  customer: Record<string, any>
  items: Record<string, any>[]
  payment: Record<string, any> | null
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function objectRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {}
}

function subMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() - minutes * 60 * 1000)
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function subHours(date: Date, hours: number) {
  return new Date(date.getTime() - hours * 60 * 60 * 1000)
}

function validDate(value: unknown) {
  const date = value ? new Date(String(value)) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

function candidateLimit(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(100, Math.max(1, Math.round(parsed))) : 30
}

function baseSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'https://guilhermepilger.ai'
  return configured.startsWith('http') ? configured.replace(/\/$/, '') : `https://${configured.replace(/\/$/, '')}`
}

function checkoutUrlFor(order: Record<string, any>) {
  const metadata = objectRecord(order.metadata)
  const savedUrl = text(metadata.checkout_url)
  if (savedUrl) return savedUrl

  const offerSlug = text(metadata.offer_slug)
  return offerSlug ? `${baseSiteUrl()}/checkout/${offerSlug}` : `${baseSiteUrl()}/checkout`
}

function productNameFor(items: Record<string, any>[]) {
  return items
    .map((item) => text(item.title_snapshot))
    .filter(Boolean)
    .join(' + ') || 'Produto digital Guilherme Pilger'
}

function templatesFor(action: AutomationAction) {
  const templates: Record<AutomationAction, Array<{ channel: 'whatsapp' | 'email'; templateKey: string }>> = {
    checkout_abandoned: [
      { channel: 'whatsapp', templateKey: 'checkout_abandoned' },
      { channel: 'email', templateKey: 'checkout_abandoned_email' },
    ],
    checkout_payment_pending: [
      { channel: 'whatsapp', templateKey: 'checkout_payment_pending' },
      { channel: 'email', templateKey: 'checkout_payment_pending_email' },
    ],
    checkout_pix_expiring: [
      { channel: 'whatsapp', templateKey: 'checkout_pix_expiring' },
      { channel: 'email', templateKey: 'checkout_pix_expiring_email' },
    ],
    checkout_pix_expired: [
      { channel: 'whatsapp', templateKey: 'checkout_pix_expired' },
      { channel: 'email', templateKey: 'checkout_pix_expired_email' },
    ],
  }

  return templates[action]
}

async function getCandidateOrders(
  supabase: SupabaseAdminLike,
  action: AutomationAction,
  config: Awaited<ReturnType<typeof loadCommerceConfig>>,
  now: Date,
  limit: number
) {
  const nowIso = now.toISOString()
  const expiringUntil = addMinutes(now, config.pixExpiringBeforeMinutes)
  const activeCandidates = (rows: Record<string, any>[]) => rows.filter((order) => objectRecord(order.metadata).diagnostic_test !== true)

  if (action === 'checkout_pix_expired') {
    const { data, error } = await supabase
      .from('commerce_orders')
      .select('*')
      .eq('status', 'pending_payment')
      .not('pix_expires_at', 'is', null)
      .lt('pix_expires_at', nowIso)
      .order('pix_expires_at', { ascending: true })
      .limit(limit)
    if (error) throw error
    return activeCandidates(data || [])
  }

  if (action === 'checkout_pix_expiring') {
    const { data, error } = await supabase
      .from('commerce_orders')
      .select('*')
      .eq('status', 'pending_payment')
      .not('pix_expires_at', 'is', null)
      .gte('pix_expires_at', nowIso)
      .lte('pix_expires_at', expiringUntil.toISOString())
      .order('pix_expires_at', { ascending: true })
      .limit(limit)
    if (error) throw error
    return activeCandidates(data || [])
  }

  if (action === 'checkout_payment_pending') {
    const threshold = subMinutes(now, config.pixPendingAfterMinutes)
    const { data, error } = await supabase
      .from('commerce_orders')
      .select('*')
      .eq('status', 'pending_payment')
      .lte('created_at', threshold.toISOString())
      .order('created_at', { ascending: true })
      .limit(limit * 3)
    if (error) throw error

    return activeCandidates(data || [])
      .filter((order: Record<string, any>) => {
        const expiresAt = validDate(order.pix_expires_at)
        return !expiresAt || expiresAt.getTime() > expiringUntil.getTime()
      })
      .slice(0, limit)
  }

  const abandonedThreshold = subMinutes(now, config.checkoutAbandonedAfterMinutes)
  const lostThreshold = subHours(now, config.checkoutLostAfterHours)
  const { data, error } = await supabase
    .from('commerce_orders')
    .select('*')
    .eq('status', 'checkout_started')
    .in('recovery_status', ['not_started', 'scheduled'])
    .lte('created_at', abandonedThreshold.toISOString())
    .gte('created_at', lostThreshold.toISOString())
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  return activeCandidates(data || [])
}

async function bundleOrders(supabase: SupabaseAdminLike, orders: Record<string, any>[]): Promise<OrderBundle[]> {
  if (!orders.length) return []

  const orderIds = orders.map((order) => text(order.id)).filter(Boolean)
  const customerIds = Array.from(new Set(orders.map((order) => text(order.customer_id)).filter(Boolean)))

  const [customersRes, itemsRes, paymentsRes] = await Promise.all([
    customerIds.length
      ? supabase.from('commerce_customers').select('*').in('id', customerIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('commerce_order_items').select('*').in('order_id', orderIds).order('created_at', { ascending: true }),
    supabase.from('commerce_payments').select('*').in('order_id', orderIds).order('updated_at', { ascending: false }),
  ])

  const error = customersRes.error || itemsRes.error || paymentsRes.error
  if (error) throw error

  const customersById = new Map<string, Record<string, any>>(
    (customersRes.data || []).map((customer: Record<string, any>) => [text(customer.id), customer])
  )
  const itemsByOrder = new Map<string, Record<string, any>[]>()
  for (const item of itemsRes.data || []) {
    const orderId = text(item.order_id)
    itemsByOrder.set(orderId, [...(itemsByOrder.get(orderId) || []), item])
  }

  const paymentsByOrder = new Map<string, Record<string, any>>()
  for (const payment of paymentsRes.data || []) {
    const orderId = text(payment.order_id)
    if (!paymentsByOrder.has(orderId)) paymentsByOrder.set(orderId, payment)
  }

  return orders
    .map((order) => ({
      order,
      customer: customersById.get(text(order.customer_id)) || {},
      items: itemsByOrder.get(text(order.id)) || [],
      payment: paymentsByOrder.get(text(order.id)) || null,
    }))
    .filter((bundle) => text(bundle.order.id) && text(bundle.customer.id))
}

async function dispatchTemplates(params: {
  supabase: SupabaseAdminLike
  action: AutomationAction
  bundle: OrderBundle
  config: Awaited<ReturnType<typeof loadCommerceConfig>>
}) {
  const { supabase, action, bundle, config } = params
  const variables = commerceMessageVariables({
    customer: bundle.customer,
    productName: productNameFor(bundle.items),
    order: bundle.order,
    payment: bundle.payment,
    checkoutUrl: checkoutUrlFor(bundle.order),
    memberAreaUrl: config.memberAreaUrl,
  })

  const dispatches: AutomationDispatchResult[] = []
  for (const template of templatesFor(action)) {
    try {
      const result = await dispatchCommerceMessage({
        supabase,
        templateKey: template.templateKey,
        channel: template.channel,
        customer: bundle.customer,
        order: bundle.order,
        payment: bundle.payment,
        educationLeadId: bundle.order.education_lead_id,
        variables,
      })
      dispatches.push({ ...template, result })
    } catch (error) {
      dispatches.push({
        ...template,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return dispatches
}

async function insertAuditLog(supabase: SupabaseAdminLike, bundle: OrderBundle, action: AutomationAction, dispatches: AutomationDispatchResult[]) {
  await supabase
    .from('commerce_audit_logs')
    .insert([{
      entity_type: 'commerce_orders',
      entity_id: bundle.order.id,
      action,
      actor_type: 'system',
      actor_id: 'commerce-automation',
      message: `Automacao ${action} processada para ${bundle.order.order_number || bundle.order.id}.`,
      metadata: {
        customer_id: bundle.customer.id,
        total: centsToMoney(Number(bundle.order.total_cents || 0)),
        dispatches,
      },
    }])
}

async function updateOrderState(supabase: SupabaseAdminLike, bundle: OrderBundle, action: AutomationAction, source: string) {
  const now = new Date().toISOString()
  const metadata = objectRecord(bundle.order.metadata)
  const automation = objectRecord(metadata.automation)
  const orderUpdate: Record<string, any> = {
    recovery_status: action === 'checkout_pix_expired' ? 'lost' : 'active',
    metadata: {
      ...metadata,
      automation: {
        ...automation,
        [action]: now,
        last_source: source,
      },
      last_automation_at: now,
    },
    updated_at: now,
  }

  if (action === 'checkout_abandoned') {
    orderUpdate.status = 'abandoned'
    orderUpdate.abandoned_at = now
  }

  if (action === 'checkout_pix_expired') {
    orderUpdate.status = 'expired'
  }

  const leadStage = action === 'checkout_abandoned'
    ? 'abandoned'
    : action === 'checkout_pix_expired'
      ? 'lost'
      : 'payment_pending'

  await Promise.all([
    supabase
      .from('commerce_orders')
      .update(orderUpdate)
      .eq('id', bundle.order.id),
    bundle.order.education_lead_id
      ? supabase
          .from('education_leads')
          .update({
            lead_stage: leadStage,
            last_activity_at: now,
            updated_at: now,
          })
          .eq('id', bundle.order.education_lead_id)
      : Promise.resolve(),
    action === 'checkout_pix_expired' && bundle.payment?.id
      ? supabase
          .from('commerce_payments')
          .update({
            status: 'cancelled',
            status_detail: 'expired_by_automation',
            updated_at: now,
          })
          .eq('id', bundle.payment.id)
          .neq('status', 'approved')
      : Promise.resolve(),
  ])
}

async function processAction(params: {
  supabase: SupabaseAdminLike
  action: AutomationAction
  config: Awaited<ReturnType<typeof loadCommerceConfig>>
  now: Date
  limit: number
  dryRun: boolean
  source: string
}) {
  const { supabase, action, config, now, limit, dryRun, source } = params
  const candidates = await getCandidateOrders(supabase, action, config, now, limit)
  const bundles = await bundleOrders(supabase, candidates)
  const events: AutomationEvent[] = []

  for (const bundle of bundles) {
    try {
      if (dryRun) {
        events.push({
          action,
          order_id: bundle.order.id,
          order_number: text(bundle.order.order_number),
          customer: text(bundle.customer.name, text(bundle.customer.email, text(bundle.customer.phone_e164))),
          total: centsToMoney(Number(bundle.order.total_cents || 0)),
          status: 'dry_run',
          dispatches: [],
        })
        continue
      }

      const dispatches = await dispatchTemplates({ supabase, action, bundle, config })
      await updateOrderState(supabase, bundle, action, source)
      await insertAuditLog(supabase, bundle, action, dispatches).catch(() => {})

      events.push({
        action,
        order_id: bundle.order.id,
        order_number: text(bundle.order.order_number),
        customer: text(bundle.customer.name, text(bundle.customer.email, text(bundle.customer.phone_e164))),
        total: centsToMoney(Number(bundle.order.total_cents || 0)),
        status: 'processed',
        dispatches,
      })
    } catch (error) {
      events.push({
        action,
        order_id: bundle.order.id,
        order_number: text(bundle.order.order_number),
        customer: text(bundle.customer.name, text(bundle.customer.email, text(bundle.customer.phone_e164))),
        total: centsToMoney(Number(bundle.order.total_cents || 0)),
        status: 'failed',
        dispatches: [],
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return events
}

export async function processCommerceAutomations(supabase: SupabaseAdminLike, options: AutomationOptions = {}) {
  const config = await loadCommerceConfig()
  const now = new Date()
  const limit = candidateLimit(options.limit)
  const dryRun = options.dryRun === true
  const source = options.source || 'commerce_automation'

  if (!config.automationEnabled && !options.force) {
    return {
      success: true,
      skipped: true,
      reason: 'commerce_automation_disabled',
      processed: 0,
      events: [] as AutomationEvent[],
    }
  }

  const actions: AutomationAction[] = [
    'checkout_pix_expired',
    'checkout_pix_expiring',
    'checkout_payment_pending',
    'checkout_abandoned',
  ]

  const events: AutomationEvent[] = []
  for (const action of actions) {
    const remaining = Math.max(0, limit - events.length)
    if (remaining <= 0) break

    const actionEvents = await processAction({
      supabase,
      action,
      config,
      now,
      limit: remaining,
      dryRun,
      source,
    })
    events.push(...actionEvents)
  }

  return {
    success: true,
    skipped: false,
    dry_run: dryRun,
    processed: events.filter((event) => event.status === 'processed').length,
    failed: events.filter((event) => event.status === 'failed').length,
    checked_at: now.toISOString(),
    config: {
      checkout_abandoned_after_minutes: config.checkoutAbandonedAfterMinutes,
      pix_pending_after_minutes: config.pixPendingAfterMinutes,
      pix_expiring_before_minutes: config.pixExpiringBeforeMinutes,
      checkout_lost_after_hours: config.checkoutLostAfterHours,
    },
    events,
  }
}
