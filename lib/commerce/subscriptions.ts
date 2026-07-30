import { centsToMoney } from './checkout'
import { fulfillApprovedOrder } from './fulfillment'
import { emitPaymentStatusEvent } from './payment-status'

type SupabaseAdminLike = {
  from: (table: string) => any
}

type SubscriptionStatus = 'pending' | 'authorized' | 'active' | 'paused' | 'cancelled' | 'expired' | 'rejected'

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function objectRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {}
}

export function normalizeSubscriptionStatus(value: unknown): SubscriptionStatus {
  const status = text(value, 'pending')
  if (status === 'authorized' || status === 'active' || status === 'paused' || status === 'cancelled' || status === 'expired' || status === 'rejected') {
    return status
  }
  return 'pending'
}

export function subscriptionPaymentMethod(value: unknown) {
  const method = text(value).toLowerCase()
  if (method === 'pix') return 'pix'
  if (method === 'debit_card') return 'debit_card'
  if (method === 'credit_card') return 'credit_card'
  if (method === 'account_money') return 'account_money'
  return 'unknown'
}

export function subscriptionInitPoint(remote: Record<string, any>, environment: 'sandbox' | 'production') {
  return environment === 'sandbox'
    ? text(remote.sandbox_init_point, text(remote.init_point))
    : text(remote.init_point, text(remote.sandbox_init_point))
}

export async function upsertSubscriptionFromRemote(params: {
  supabase: SupabaseAdminLike
  order: Record<string, any>
  customerId: string
  productId: string
  offerId: string
  remoteSubscription: Record<string, any>
  paymentMethod: string
  environment: 'sandbox' | 'production'
  metadata?: Record<string, unknown>
}) {
  const { supabase, order, remoteSubscription } = params
  const status = normalizeSubscriptionStatus(remoteSubscription.status)
  const autoRecurring = objectRecord(remoteSubscription.auto_recurring)
  const providerSubscriptionId = text(remoteSubscription.id)
  const amountCents = Math.round(Number(autoRecurring.transaction_amount || order.total_cents / 100 || 0) * 100)
  const payload = {
    customer_id: params.customerId || null,
    product_id: params.productId || null,
    offer_id: params.offerId || null,
    order_id: order.id,
    provider: 'mercado_pago',
    provider_subscription_id: providerSubscriptionId || null,
    status,
    payment_method: subscriptionPaymentMethod(params.paymentMethod),
    billing_frequency: Number(autoRecurring.frequency || 1),
    billing_frequency_type: text(autoRecurring.frequency_type, 'months'),
    amount_cents: amountCents || order.total_cents || 0,
    currency: text(autoRecurring.currency_id, order.currency || 'BRL').slice(0, 3).toUpperCase(),
    starts_at: text(autoRecurring.start_date) || null,
    next_payment_at: text(remoteSubscription.next_payment_date) || null,
    cancelled_at: status === 'cancelled' ? new Date().toISOString() : null,
    init_point: text(remoteSubscription.init_point) || null,
    sandbox_init_point: text(remoteSubscription.sandbox_init_point) || null,
    raw_payload: remoteSubscription,
    metadata: {
      ...(params.metadata || {}),
      init_point: subscriptionInitPoint(remoteSubscription, params.environment),
    },
    updated_at: new Date().toISOString(),
  }

  const { data: existing, error: existingError } = providerSubscriptionId
    ? await supabase
        .from('commerce_subscriptions')
        .select('*')
        .eq('provider', 'mercado_pago')
        .eq('provider_subscription_id', providerSubscriptionId)
        .maybeSingle()
    : { data: null, error: null }

  if (existingError) throw existingError

  if (existing) {
    const { data, error } = await supabase
      .from('commerce_subscriptions')
      .update({
        ...payload,
        metadata: {
          ...objectRecord(existing.metadata),
          ...payload.metadata,
        },
      })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('commerce_subscriptions')
    .insert([{ ...payload, created_at: new Date().toISOString() }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function syncSubscriptionAccess(params: {
  supabase: SupabaseAdminLike
  subscription: Record<string, any>
  order: Record<string, any>
  paymentId?: string | null
  source: string
  remoteSubscription?: Record<string, any> | null
}) {
  const { supabase, subscription, order } = params
  const status = normalizeSubscriptionStatus(subscription.status)
  const now = new Date().toISOString()

  await supabase
    .from('commerce_orders')
    .update({
      subscription_id: subscription.id,
      status: status === 'authorized' || status === 'active' ? 'paid' : status === 'cancelled' || status === 'rejected' ? 'cancelled' : 'pending_payment',
      paid_at: status === 'authorized' || status === 'active' ? (order.paid_at || now) : order.paid_at,
      cancelled_at: status === 'cancelled' || status === 'rejected' ? (order.cancelled_at || now) : order.cancelled_at,
      metadata: {
        ...objectRecord(order.metadata),
        subscription_id: subscription.id,
        provider_subscription_id: subscription.provider_subscription_id || null,
        subscription_status: status,
      },
      updated_at: now,
    })
    .eq('id', order.id)

  if (params.paymentId) {
    await supabase
      .from('commerce_payments')
      .update({ subscription_id: subscription.id, updated_at: now })
      .eq('id', params.paymentId)
  }

  if (status === 'authorized' || status === 'active') {
    const fulfillment = await fulfillApprovedOrder({
      supabase,
      orderId: order.id,
      paymentId: params.paymentId || null,
      source: params.source,
      remotePayment: params.remoteSubscription || null,
    }).catch((error: any) => ({ error: error?.message || String(error) }))

    const event = await emitPaymentStatusEvent({
      supabase,
      orderId: order.id,
      paymentId: params.paymentId || null,
      status: 'access_granted',
      source: params.source,
      sendNotifications: false,
      metadata: {
        subscription_id: subscription.id,
        provider_subscription_id: subscription.provider_subscription_id || null,
      },
      remotePayment: params.remoteSubscription || null,
    }).catch((error: any) => ({ error: error?.message || String(error) }))

    return { fulfillment, event }
  }

  if (status === 'cancelled' || status === 'paused' || status === 'expired' || status === 'rejected') {
    await supabase
      .from('member_entitlements')
      .update({
        status: status === 'paused' ? 'suspended' : 'revoked',
        revoked_at: status === 'paused' ? undefined : now,
        metadata: {
          subscription_id: subscription.id,
          subscription_status: status,
          revoked_source: params.source,
        },
        updated_at: now,
      })
      .eq('order_id', order.id)
      .neq('status', 'revoked')
  }

  await supabase
    .from('commerce_audit_logs')
    .insert([{
      entity_type: 'commerce_subscriptions',
      entity_id: subscription.id,
      action: `subscription_${status}`,
      actor_type: params.source.includes('webhook') ? 'webhook' : 'system',
      actor_id: params.source,
      message: `Assinatura ${status} para pedido ${order.order_number || order.id}.`,
      metadata: {
        order_id: order.id,
        total: centsToMoney(Number(order.total_cents || 0)),
      },
    }])
    .catch(() => {})

  return { fulfillment: null, event: null }
}
