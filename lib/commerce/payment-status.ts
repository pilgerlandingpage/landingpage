import { centsToMoney, loadCommerceConfig } from './checkout'
import { commerceMessageVariables, dispatchCommerceMessage } from './transactional-messages'

export type PaymentLifecycleStatus =
  | 'checkout_started'
  | 'pix_generated'
  | 'waiting_payment'
  | 'payment_pending'
  | 'payment_expiring'
  | 'payment_processing'
  | 'payment_approved'
  | 'access_granted'
  | 'payment_rejected'
  | 'payment_cancelled'
  | 'payment_expired'
  | 'payment_refunded'
  | 'chargeback'

type SupabaseAdminLike = {
  from: (table: string) => any
}

type MessageChannel = 'whatsapp' | 'email'

type StatusDefinition = {
  label: string
  publicMessage: string
  orderStatus?: string
  paymentStatus?: string
  leadStage?: string
  nextAction: 'wait' | 'pay' | 'retry' | 'login' | 'support'
  terminal?: boolean
  templates: Array<{ channel: MessageChannel; templateKey: string }>
}

type PaymentStatusEventParams = {
  supabase: SupabaseAdminLike
  orderId: string
  paymentId?: string | null
  status: PaymentLifecycleStatus
  source?: string
  sendNotifications?: boolean
  channels?: MessageChannel[]
  dedupe?: boolean
  metadata?: Record<string, unknown>
  remotePayment?: Record<string, unknown> | null
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function objectRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {}
}

export const PAYMENT_STATUS_DEFINITIONS: Record<PaymentLifecycleStatus, StatusDefinition> = {
  checkout_started: {
    label: 'Checkout iniciado',
    publicMessage: 'Recebemos seus dados e estamos preparando o pagamento.',
    orderStatus: 'checkout_started',
    leadStage: 'checkout_started',
    nextAction: 'pay',
    templates: [],
  },
  pix_generated: {
    label: 'Pix gerado',
    publicMessage: 'Seu Pix foi gerado. Estamos aguardando o pagamento.',
    orderStatus: 'pending_payment',
    paymentStatus: 'pending',
    leadStage: 'pix_generated',
    nextAction: 'pay',
    templates: [
      { channel: 'whatsapp', templateKey: 'checkout_pix_generated' },
    ],
  },
  waiting_payment: {
    label: 'Aguardando pagamento',
    publicMessage: 'Pagamento aguardando confirmacao.',
    orderStatus: 'pending_payment',
    paymentStatus: 'pending',
    leadStage: 'payment_pending',
    nextAction: 'wait',
    templates: [
      { channel: 'whatsapp', templateKey: 'checkout_payment_pending' },
      { channel: 'email', templateKey: 'checkout_payment_pending_email' },
    ],
  },
  payment_pending: {
    label: 'Pagamento pendente',
    publicMessage: 'O pagamento ainda esta pendente.',
    orderStatus: 'pending_payment',
    paymentStatus: 'pending',
    leadStage: 'payment_pending',
    nextAction: 'wait',
    templates: [
      { channel: 'whatsapp', templateKey: 'checkout_payment_pending' },
      { channel: 'email', templateKey: 'checkout_payment_pending_email' },
    ],
  },
  payment_expiring: {
    label: 'Pix perto de vencer',
    publicMessage: 'Seu Pix vence em breve. Conclua o pagamento para garantir o acesso.',
    orderStatus: 'pending_payment',
    paymentStatus: 'pending',
    leadStage: 'payment_pending',
    nextAction: 'pay',
    templates: [
      { channel: 'whatsapp', templateKey: 'checkout_pix_expiring' },
      { channel: 'email', templateKey: 'checkout_pix_expiring_email' },
    ],
  },
  payment_processing: {
    label: 'Pagamento em analise',
    publicMessage: 'O pagamento esta em processamento. Avisaremos quando for concluido.',
    orderStatus: 'pending_payment',
    paymentStatus: 'in_process',
    leadStage: 'payment_pending',
    nextAction: 'wait',
    templates: [
      { channel: 'whatsapp', templateKey: 'checkout_payment_processing' },
      { channel: 'email', templateKey: 'checkout_payment_processing_email' },
    ],
  },
  payment_approved: {
    label: 'Pagamento aprovado',
    publicMessage: 'Pagamento aprovado. Estamos liberando seu acesso.',
    orderStatus: 'paid',
    paymentStatus: 'approved',
    leadStage: 'purchased',
    nextAction: 'login',
    terminal: true,
    templates: [
      { channel: 'whatsapp', templateKey: 'purchase_approved_access_released' },
      { channel: 'email', templateKey: 'purchase_approved_email' },
    ],
  },
  access_granted: {
    label: 'Acesso liberado',
    publicMessage: 'Seu acesso esta liberado na area de membros.',
    orderStatus: 'paid',
    paymentStatus: 'approved',
    leadStage: 'access_granted',
    nextAction: 'login',
    terminal: true,
    templates: [
      { channel: 'whatsapp', templateKey: 'purchase_approved_access_released' },
      { channel: 'email', templateKey: 'purchase_approved_email' },
    ],
  },
  payment_rejected: {
    label: 'Pagamento recusado',
    publicMessage: 'O pagamento foi recusado. Voce pode tentar novamente.',
    orderStatus: 'cancelled',
    paymentStatus: 'rejected',
    leadStage: 'payment_pending',
    nextAction: 'retry',
    terminal: true,
    templates: [
      { channel: 'whatsapp', templateKey: 'checkout_payment_rejected' },
      { channel: 'email', templateKey: 'checkout_payment_rejected_email' },
    ],
  },
  payment_cancelled: {
    label: 'Pagamento cancelado',
    publicMessage: 'Esse pagamento foi cancelado. Gere um novo pagamento para continuar.',
    orderStatus: 'cancelled',
    paymentStatus: 'cancelled',
    leadStage: 'lost',
    nextAction: 'retry',
    terminal: true,
    templates: [
      { channel: 'whatsapp', templateKey: 'checkout_payment_cancelled' },
      { channel: 'email', templateKey: 'checkout_payment_cancelled_email' },
    ],
  },
  payment_expired: {
    label: 'Pix vencido',
    publicMessage: 'O Pix venceu. Gere um novo pagamento para concluir a compra.',
    orderStatus: 'expired',
    paymentStatus: 'cancelled',
    leadStage: 'lost',
    nextAction: 'retry',
    terminal: true,
    templates: [
      { channel: 'whatsapp', templateKey: 'checkout_pix_expired' },
      { channel: 'email', templateKey: 'checkout_pix_expired_email' },
    ],
  },
  payment_refunded: {
    label: 'Pagamento reembolsado',
    publicMessage: 'O pagamento foi reembolsado. Fale com o suporte se precisar de ajuda.',
    orderStatus: 'refunded',
    paymentStatus: 'refunded',
    leadStage: 'lost',
    nextAction: 'support',
    terminal: true,
    templates: [
      { channel: 'whatsapp', templateKey: 'checkout_payment_refunded' },
      { channel: 'email', templateKey: 'checkout_payment_refunded_email' },
    ],
  },
  chargeback: {
    label: 'Pagamento contestado',
    publicMessage: 'O pagamento foi contestado. Nossa equipe vai revisar o acesso.',
    orderStatus: 'chargeback',
    paymentStatus: 'charged_back',
    leadStage: 'lost',
    nextAction: 'support',
    terminal: true,
    templates: [
      { channel: 'whatsapp', templateKey: 'checkout_payment_chargeback' },
      { channel: 'email', templateKey: 'checkout_payment_chargeback_email' },
    ],
  },
}

export function normalizePaymentLifecycleStatus(value: unknown): PaymentLifecycleStatus {
  const status = text(value) as PaymentLifecycleStatus
  return status in PAYMENT_STATUS_DEFINITIONS ? status : 'waiting_payment'
}

export function paymentLifecycleFromProviderStatus(status: unknown, statusDetail?: unknown): PaymentLifecycleStatus {
  const normalized = text(status, 'pending')
  const detail = text(statusDetail).toLowerCase()

  if (normalized === 'approved') return 'payment_approved'
  if (normalized === 'authorized' || normalized === 'in_process' || normalized === 'in_mediation') return 'payment_processing'
  if (normalized === 'rejected') return 'payment_rejected'
  if (normalized === 'refunded') return 'payment_refunded'
  if (normalized === 'charged_back') return 'chargeback'
  if (normalized === 'cancelled') return detail.includes('expired') ? 'payment_expired' : 'payment_cancelled'
  return 'waiting_payment'
}

export function paymentLifecycleFromOrder(order: Record<string, any> | null | undefined, payment?: Record<string, any> | null): PaymentLifecycleStatus {
  const metadata = objectRecord(order?.metadata)
  const savedLifecycle = text(metadata.last_payment_lifecycle_status)
  if (savedLifecycle) return normalizePaymentLifecycleStatus(savedLifecycle)

  if (order?.status === 'paid' && metadata.fulfillment_status === 'access_granted') return 'access_granted'
  if (order?.status === 'paid') return 'payment_approved'
  if (order?.status === 'expired') return 'payment_expired'
  if (order?.status === 'cancelled') return payment?.status === 'rejected' ? 'payment_rejected' : 'payment_cancelled'
  if (order?.status === 'refunded') return 'payment_refunded'
  if (order?.status === 'chargeback') return 'chargeback'
  if (payment?.status) return paymentLifecycleFromProviderStatus(payment.status, payment.status_detail)
  if (order?.status === 'checkout_started') return 'checkout_started'
  return 'waiting_payment'
}

export function publicPaymentStatusPayload(order: Record<string, any>, payment?: Record<string, any> | null) {
  const status = paymentLifecycleFromOrder(order, payment)
  const definition = PAYMENT_STATUS_DEFINITIONS[status]
  const checkoutUrl = text(objectRecord(order.metadata).checkout_url)

  return {
    lifecycle_status: status,
    label: definition.label,
    message: definition.publicMessage,
    order_status: order.status,
    payment_status: payment?.status || null,
    next_action: definition.nextAction,
    terminal: Boolean(definition.terminal),
    can_retry_payment: ['retry', 'pay'].includes(definition.nextAction),
    checkout_url: checkoutUrl,
    member_area_url: text(objectRecord(order.metadata).member_area_url) || '/membros',
  }
}

async function loadOrderBundle(supabase: SupabaseAdminLike, orderId: string, paymentId?: string | null) {
  const { data: order, error: orderError } = await supabase
    .from('commerce_orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError) throw orderError
  if (!order) throw new Error('Pedido nao encontrado.')

  const [customerRes, itemsRes, paymentRes] = await Promise.all([
    order.customer_id
      ? supabase.from('commerce_customers').select('*').eq('id', order.customer_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('commerce_order_items').select('*').eq('order_id', order.id).order('created_at', { ascending: true }),
    paymentId
      ? supabase.from('commerce_payments').select('*').eq('id', paymentId).maybeSingle()
      : supabase
          .from('commerce_payments')
          .select('*')
          .eq('order_id', order.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
  ])

  const error = customerRes.error || itemsRes.error || paymentRes.error
  if (error) throw error

  return {
    order,
    customer: customerRes.data || {},
    items: itemsRes.data || [],
    payment: paymentRes.data || null,
  }
}

function productNameFor(items: Record<string, any>[]) {
  return items
    .map((item) => text(item.title_snapshot))
    .filter(Boolean)
    .join(' + ') || 'Produto digital Guilherme Pilger'
}

function checkoutUrlFor(order: Record<string, any>) {
  const metadata = objectRecord(order.metadata)
  const saved = text(metadata.checkout_url)
  if (saved) return saved

  const offerSlug = text(metadata.offer_slug)
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://guilhermepilger.ai').replace(/\/$/, '')
  return offerSlug ? `${base}/checkout/${offerSlug}` : `${base}/checkout`
}

async function updateLifecycleState(params: {
  supabase: SupabaseAdminLike
  order: Record<string, any>
  payment: Record<string, any> | null
  status: PaymentLifecycleStatus
  source: string
  metadata: Record<string, unknown>
}) {
  const { supabase, order, payment, status, source, metadata } = params
  const definition = PAYMENT_STATUS_DEFINITIONS[status]
  const now = new Date().toISOString()
  const orderMetadata = objectRecord(order.metadata)
  const lifecycle = objectRecord(orderMetadata.payment_lifecycle)

  const orderPatch: Record<string, any> = {
    metadata: {
      ...orderMetadata,
      last_payment_lifecycle_status: status,
      last_payment_lifecycle_at: now,
      payment_lifecycle: {
        ...lifecycle,
        [status]: now,
        last_source: source,
      },
      ...metadata,
    },
    updated_at: now,
  }

  if (definition.orderStatus) orderPatch.status = definition.orderStatus
  if (status === 'payment_approved' || status === 'access_granted') orderPatch.paid_at = order.paid_at || payment?.paid_at || now
  if (status === 'payment_cancelled' || status === 'payment_rejected') orderPatch.cancelled_at = order.cancelled_at || now
  if (status === 'payment_expired') orderPatch.recovery_status = 'lost'
  if (status === 'payment_approved' || status === 'access_granted') orderPatch.recovery_status = 'cancelled'

  const updates: PromiseLike<any>[] = [
    supabase.from('commerce_orders').update(orderPatch).eq('id', order.id),
  ]

  if (payment?.id && definition.paymentStatus) {
    let paymentUpdate = supabase
      .from('commerce_payments')
      .update({
        status: definition.paymentStatus,
        paid_at: definition.paymentStatus === 'approved' ? (payment.paid_at || now) : payment.paid_at,
        updated_at: now,
      })
      .eq('id', payment.id)

    if (definition.paymentStatus !== 'refunded' && definition.paymentStatus !== 'charged_back') {
      paymentUpdate = paymentUpdate.neq('status', 'approved')
    }

    updates.push(paymentUpdate)
  }

  if (order.education_lead_id && definition.leadStage) {
    updates.push(
      supabase
        .from('education_leads')
        .update({
          lead_stage: definition.leadStage,
          last_activity_at: now,
          updated_at: now,
        })
        .eq('id', order.education_lead_id)
    )
  }

  if (status === 'payment_refunded' || status === 'chargeback') {
    updates.push(
      supabase
        .from('member_entitlements')
        .update({
          status: 'revoked',
          revoked_at: now,
          metadata: {
            revoked_by: source,
            revoked_reason: status,
            revoked_at: now,
          },
        })
        .eq('order_id', order.id)
        .in('status', ['active', 'suspended'])
    )
  }

  const results = await Promise.all(updates)
  const error = results.map((result: any) => result?.error).find(Boolean)
  if (error) throw error
}

async function insertStatusAudit(params: {
  supabase: SupabaseAdminLike
  order: Record<string, any>
  payment: Record<string, any> | null
  status: PaymentLifecycleStatus
  source: string
  dispatches: unknown[]
  metadata: Record<string, unknown>
}) {
  const definition = PAYMENT_STATUS_DEFINITIONS[params.status]
  await params.supabase
    .from('commerce_audit_logs')
    .insert([{
      entity_type: 'commerce_orders',
      entity_id: params.order.id,
      action: `payment_status_${params.status}`,
      actor_type: params.source.includes('webhook') ? 'webhook' : 'system',
      actor_id: params.source,
      message: `${definition.label} para ${params.order.order_number || params.order.id}.`,
      metadata: {
        status: params.status,
        payment_id: params.payment?.id || null,
        total: centsToMoney(Number(params.order.total_cents || 0)),
        dispatches: params.dispatches,
        ...params.metadata,
      },
    }])
}

export async function emitPaymentStatusEvent(params: PaymentStatusEventParams) {
  const status = normalizePaymentLifecycleStatus(params.status)
  const source = params.source || 'payment_status_event'
  const definition = PAYMENT_STATUS_DEFINITIONS[status]
  const bundle = await loadOrderBundle(params.supabase, params.orderId, params.paymentId)
  const metadata = {
    ...(params.metadata || {}),
    remote_payment_status: text(params.remotePayment?.status),
    remote_payment_id: text(params.remotePayment?.id),
  }

  await updateLifecycleState({
    supabase: params.supabase,
    order: bundle.order,
    payment: bundle.payment,
    status,
    source,
    metadata,
  })

  const dispatches: unknown[] = []
  if (params.sendNotifications !== false && definition.templates.length && text(bundle.customer.id)) {
    const config = await loadCommerceConfig()
    const channels = new Set(params.channels || ['whatsapp', 'email'])
    const variables = commerceMessageVariables({
      customer: bundle.customer,
      productName: productNameFor(bundle.items),
      order: bundle.order,
      payment: bundle.payment,
      checkoutUrl: checkoutUrlFor(bundle.order),
      memberAreaUrl: config.memberAreaUrl,
    })

    for (const template of definition.templates) {
      if (!channels.has(template.channel)) continue
      const result = await dispatchCommerceMessage({
        supabase: params.supabase,
        templateKey: template.templateKey,
        channel: template.channel,
        customer: bundle.customer,
        order: bundle.order,
        payment: bundle.payment,
        educationLeadId: bundle.order.education_lead_id,
        variables,
        dedupe: params.dedupe !== false,
      }).catch((error: any) => ({
        sent: false,
        error: error?.message || String(error),
      }))
      dispatches.push({ ...template, result })
    }
  }

  await insertStatusAudit({
    supabase: params.supabase,
    order: bundle.order,
    payment: bundle.payment,
    status,
    source,
    dispatches,
    metadata,
  }).catch(() => {})

  return {
    success: true,
    status,
    label: definition.label,
    order_id: bundle.order.id,
    payment_id: bundle.payment?.id || null,
    dispatches,
  }
}

export async function loadPaymentTimeline(supabase: SupabaseAdminLike, orderId: string) {
  const [orderRes, paymentsRes, eventsRes, auditsRes, messagesRes] = await Promise.all([
    supabase.from('commerce_orders').select('*').eq('id', orderId).maybeSingle(),
    supabase.from('commerce_payments').select('*').eq('order_id', orderId).order('created_at', { ascending: true }),
    supabase.from('commerce_payment_events').select('*').eq('order_id', orderId).order('received_at', { ascending: true }),
    supabase.from('commerce_audit_logs').select('*').eq('entity_type', 'commerce_orders').eq('entity_id', orderId).order('created_at', { ascending: true }),
    supabase.from('message_dispatches').select('*').eq('order_id', orderId).order('created_at', { ascending: true }),
  ])

  const error = orderRes.error || paymentsRes.error || eventsRes.error || auditsRes.error || messagesRes.error
  if (error) throw error
  if (!orderRes.data) throw new Error('Pedido nao encontrado.')

  const items = [
    {
      type: 'order',
      status: orderRes.data.status,
      label: 'Pedido criado',
      at: orderRes.data.created_at,
      data: orderRes.data,
    },
    ...(paymentsRes.data || []).map((payment: any) => ({
      type: 'payment',
      status: payment.status,
      label: `Pagamento ${payment.status}`,
      at: payment.updated_at || payment.created_at,
      data: payment,
    })),
    ...(eventsRes.data || []).map((event: any) => ({
      type: 'webhook',
      status: event.processing_status,
      label: event.event_type || 'Webhook',
      at: event.received_at,
      data: event,
    })),
    ...(auditsRes.data || []).map((audit: any) => ({
      type: 'audit',
      status: audit.action,
      label: audit.message || audit.action,
      at: audit.created_at,
      data: audit,
    })),
    ...(messagesRes.data || []).map((message: any) => ({
      type: 'message',
      status: message.status,
      label: `${message.channel} ${message.status}`,
      at: message.sent_at || message.created_at,
      data: message,
    })),
  ].filter((item) => item.at)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))

  return {
    success: true,
    order: orderRes.data,
    payments: paymentsRes.data || [],
    events: items,
  }
}
