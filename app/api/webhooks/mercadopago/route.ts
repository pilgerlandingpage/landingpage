import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { loadCommerceConfig } from '@/lib/commerce/checkout'
import { fulfillApprovedOrder, mapPaymentStatusToOrderStatus } from '@/lib/commerce/fulfillment'
import { emitPaymentStatusEvent, paymentLifecycleFromProviderStatus } from '@/lib/commerce/payment-status'
import {
  extractMercadoPagoPixData,
  getMercadoPagoChargeback,
  getMercadoPagoPayment,
  getMercadoPagoPaymentMethod,
  getMercadoPagoPreapproval,
  mercadoPagoAmountToCents,
  normalizeMercadoPagoPaymentStatus,
} from '@/lib/commerce/mercado-pago'
import {
  normalizeSubscriptionStatus,
  subscriptionPaymentMethod,
  syncSubscriptionAccess,
  upsertSubscriptionFromRemote,
} from '@/lib/commerce/subscriptions'

export const runtime = 'nodejs'

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function parseSignatureHeader(header: string) {
  const parts = new Map<string, string>()
  for (const item of header.split(',')) {
    const [key, ...rest] = item.split('=')
    if (key && rest.length) parts.set(key.trim(), rest.join('=').trim())
  }
  return {
    timestamp: parts.get('ts') || '',
    hash: parts.get('v1') || '',
  }
}

function validateMercadoPagoSignature(params: {
  signatureHeader: string
  requestId: string
  dataId: string
  secret: string
}) {
  const { timestamp, hash } = parseSignatureHeader(params.signatureHeader)
  if (!timestamp || !hash || !params.secret) return false

  const manifest = [
    params.dataId ? `id:${params.dataId};` : '',
    params.requestId ? `request-id:${params.requestId};` : '',
    timestamp ? `ts:${timestamp};` : '',
  ].join('')

  const expected = createHmac('sha256', params.secret).update(manifest).digest('hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  const receivedBuffer = Buffer.from(hash, 'hex')
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer)
}

function webhookDataId(request: NextRequest, payload: Record<string, any>) {
  return text(request.nextUrl.searchParams.get('data.id'))
    || text(request.nextUrl.searchParams.get('data_id'))
    || text(request.nextUrl.searchParams.get('id'))
    || text(payload?.data?.id)
    || text(payload?.id)
}

function webhookEventId(payload: Record<string, any>, dataId: string, requestId: string) {
  return text(payload.id)
    || [text(payload.type, 'unknown'), dataId, text(payload.action, 'event'), requestId]
      .filter(Boolean)
      .join(':')
}

function isSubscriptionEvent(payload: Record<string, any>) {
  const value = [
    text(payload.type),
    text(payload.topic),
    text(payload.action),
    text(payload.event_type),
  ].join(' ').toLowerCase()
  return value.includes('preapproval') || value.includes('subscription')
}

function isChargebackEvent(payload: Record<string, any>) {
  const value = [
    text(payload.type),
    text(payload.topic),
    text(payload.action),
    text(payload.event_type),
  ].join(' ').toLowerCase()
  return value.includes('chargeback')
}

function paymentIdFromChargeback(chargeback: Record<string, any>) {
  return text(chargeback.payment_id)
    || text(chargeback.payment?.id)
    || text(Array.isArray(chargeback.payments) ? chargeback.payments[0]?.id : '')
}

async function insertPaymentEvent(params: {
  payload: Record<string, any>
  dataId: string
  eventId: string
  requestId: string
  signatureValid: boolean | null
}) {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('commerce_payment_events')
    .insert([{
      provider: 'mercado_pago',
      event_id: params.eventId || null,
      event_type: text(params.payload.type, text(params.payload.topic, 'payment')),
      action: text(params.payload.action),
      resource_id: params.dataId || null,
      signature_valid: params.signatureValid,
      processing_status: 'received',
      payload: {
        ...params.payload,
        request_id: params.requestId || null,
      },
    }])
    .select()
    .single()

  if (!error) return { row: data, duplicate: false }
  if (error.code !== '23505') throw error

  const { data: existing, error: existingError } = await supabase
    .from('commerce_payment_events')
    .select('*')
    .eq('provider', 'mercado_pago')
    .eq('event_id', params.eventId)
    .maybeSingle()

  if (existingError) throw existingError
  return { row: existing, duplicate: true }
}

async function markEvent(eventId: string | null | undefined, patch: Record<string, unknown>) {
  if (!eventId) return
  const supabase = createSupabaseAdminClient()
  await supabase
    .from('commerce_payment_events')
    .update({
      ...patch,
      processed_at: patch.processing_status === 'processed' || patch.processing_status === 'ignored' || patch.processing_status === 'failed'
        ? new Date().toISOString()
        : undefined,
    })
    .eq('id', eventId)
}

async function findOrderForPayment(supabase: ReturnType<typeof createSupabaseAdminClient>, remotePayment: Record<string, any>) {
  const externalReference = text(remotePayment.external_reference)
  if (isUuid(externalReference)) {
    const { data, error } = await supabase
      .from('commerce_orders')
      .select('*')
      .eq('id', externalReference)
      .maybeSingle()
    if (error) throw error
    if (data) return data
  }

  const providerPaymentId = text(remotePayment.id)
  if (providerPaymentId) {
    const { data: payment, error } = await supabase
      .from('commerce_payments')
      .select('order_id')
      .eq('provider', 'mercado_pago')
      .eq('provider_payment_id', providerPaymentId)
      .maybeSingle()
    if (error) throw error
    if (payment?.order_id) {
      const { data: order, error: orderError } = await supabase
        .from('commerce_orders')
        .select('*')
        .eq('id', payment.order_id)
        .maybeSingle()
      if (orderError) throw orderError
      if (order) return order
    }
  }

  return null
}

async function findOrderForSubscription(supabase: ReturnType<typeof createSupabaseAdminClient>, remoteSubscription: Record<string, any>) {
  const externalReference = text(remoteSubscription.external_reference)
  if (isUuid(externalReference)) {
    const { data, error } = await supabase
      .from('commerce_orders')
      .select('*')
      .eq('id', externalReference)
      .maybeSingle()
    if (error) throw error
    if (data) return data
  }

  const providerSubscriptionId = text(remoteSubscription.id)
  if (providerSubscriptionId) {
    const { data: subscription, error } = await supabase
      .from('commerce_subscriptions')
      .select('order_id')
      .eq('provider', 'mercado_pago')
      .eq('provider_subscription_id', providerSubscriptionId)
      .maybeSingle()
    if (error) throw error
    if (subscription?.order_id) {
      const { data: order, error: orderError } = await supabase
        .from('commerce_orders')
        .select('*')
        .eq('id', subscription.order_id)
        .maybeSingle()
      if (orderError) throw orderError
      if (order) return order
    }
  }

  return null
}

async function productIdForOrder(supabase: ReturnType<typeof createSupabaseAdminClient>, order: Record<string, any>) {
  const { data, error } = await supabase
    .from('commerce_order_items')
    .select('product_id')
    .eq('order_id', order.id)
    .eq('item_type', 'primary')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return text(data?.product_id)
}

async function upsertPaymentFromRemote(params: {
  supabase: ReturnType<typeof createSupabaseAdminClient>
  order: Record<string, any>
  remotePayment: Record<string, any>
}) {
  const { supabase, order, remotePayment } = params
  const providerPaymentId = text(remotePayment.id)
  const pix = extractMercadoPagoPixData(remotePayment)
  const status = normalizeMercadoPagoPaymentStatus(remotePayment.status)
  const paidAt = status === 'approved' ? (remotePayment.date_approved || new Date().toISOString()) : null
  const payload = {
    order_id: order.id,
    customer_id: order.customer_id,
    provider: 'mercado_pago',
    provider_payment_id: providerPaymentId || null,
    provider_order_id: remotePayment.order?.id ? String(remotePayment.order.id) : null,
    status,
    status_detail: text(remotePayment.status_detail),
    payment_method: getMercadoPagoPaymentMethod(remotePayment.payment_method_id, remotePayment.payment_type_id),
    installments: Number.isFinite(Number(remotePayment.installments)) ? Number(remotePayment.installments) : null,
    amount_cents: mercadoPagoAmountToCents(remotePayment.transaction_amount) || order.total_cents,
    currency: order.currency || 'BRL',
    pix_qr_code: pix.qrCode || null,
    pix_qr_code_base64: pix.qrCodeBase64 || null,
    pix_ticket_url: pix.ticketUrl || null,
    paid_at: paidAt,
    expires_at: order.pix_expires_at || null,
    raw_payload: remotePayment,
    updated_at: new Date().toISOString(),
  }

  const { data: existing, error: existingError } = await supabase
    .from('commerce_payments')
    .select('id')
    .eq('provider', 'mercado_pago')
    .eq('provider_payment_id', providerPaymentId)
    .maybeSingle()

  if (existingError) throw existingError
  if (existing) {
    const { data, error } = await supabase
      .from('commerce_payments')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('commerce_payments')
    .insert([{ ...payload, created_at: new Date().toISOString() }])
    .select()
    .single()

  if (error) throw error
  return data
}

async function upsertSubscriptionPayment(params: {
  supabase: ReturnType<typeof createSupabaseAdminClient>
  order: Record<string, any>
  subscription: Record<string, any>
  remoteSubscription: Record<string, any>
}) {
  const { supabase, order, subscription, remoteSubscription } = params
  const status = normalizeSubscriptionStatus(remoteSubscription.status)
  const paymentStatus = status === 'authorized' || status === 'active' ? 'approved' : 'pending'
  const payload = {
    order_id: order.id,
    subscription_id: subscription.id,
    customer_id: order.customer_id,
    provider: 'mercado_pago',
    provider_order_id: text(remoteSubscription.id),
    status: paymentStatus,
    status_detail: `subscription_${status}`,
    payment_method: 'subscription',
    amount_cents: order.total_cents,
    currency: order.currency || 'BRL',
    paid_at: paymentStatus === 'approved' ? (order.paid_at || new Date().toISOString()) : null,
    raw_payload: remoteSubscription,
    updated_at: new Date().toISOString(),
  }

  const { data: existing, error: existingError } = await supabase
    .from('commerce_payments')
    .select('id')
    .eq('provider', 'mercado_pago')
    .eq('provider_order_id', text(remoteSubscription.id))
    .eq('payment_method', 'subscription')
    .maybeSingle()

  if (existingError) throw existingError
  if (existing) {
    const { data, error } = await supabase
      .from('commerce_payments')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('commerce_payments')
    .insert([{ ...payload, created_at: new Date().toISOString() }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseAdminClient()
  let eventRow: Record<string, any> | null = null

  try {
    const payload = await request.json().catch(() => ({})) as Record<string, any>
    const dataId = webhookDataId(request, payload)
    const requestId = text(request.headers.get('x-request-id'))
    const signatureHeader = text(request.headers.get('x-signature'))
    const config = await loadCommerceConfig()
    const signatureValid = config.mercadoPagoWebhookSecret
      ? validateMercadoPagoSignature({
          signatureHeader,
          requestId,
          dataId,
          secret: config.mercadoPagoWebhookSecret,
        })
      : null

    const eventId = webhookEventId(payload, dataId, requestId)
    const eventInsert = await insertPaymentEvent({
      payload,
      dataId,
      eventId,
      requestId,
      signatureValid,
    })
    eventRow = eventInsert.row

    if (config.mercadoPagoWebhookSecret && !signatureValid) {
      await markEvent(eventRow?.id, {
        processing_status: 'failed',
        error_message: 'Assinatura Mercado Pago inválida.',
      })
      return NextResponse.json({ success: false, message: 'Assinatura inválida.' }, { status: 401 })
    }

    if (eventInsert.duplicate && eventRow?.processing_status === 'processed') {
      return NextResponse.json({
        success: true,
        duplicate: true,
        ignored: true,
        reason: 'already_processed',
        event_id: eventRow.id,
        order_id: eventRow.order_id || null,
        payment_id: eventRow.payment_id || null,
      })
    }

    if (!dataId) {
      await markEvent(eventRow?.id, {
        processing_status: 'ignored',
        error_message: 'Evento sem data.id.',
      })
      return NextResponse.json({ success: true, ignored: true, reason: 'missing_data_id' })
    }

    if (!config.mercadoPagoAccessToken) {
      await markEvent(eventRow?.id, {
        processing_status: 'failed',
        error_message: 'Access Token Mercado Pago ausente.',
      })
      return NextResponse.json({ success: false, message: 'Mercado Pago não configurado.' }, { status: 500 })
    }

    if (isChargebackEvent(payload)) {
      const remoteChargeback = await getMercadoPagoChargeback(config.mercadoPagoAccessToken, dataId)
      const chargebackPaymentId = paymentIdFromChargeback(remoteChargeback)

      if (!chargebackPaymentId) {
        await markEvent(eventRow?.id, {
          processing_status: 'ignored',
          error_message: 'Contestacao sem payment_id.',
        })
        return NextResponse.json({ success: true, ignored: true, reason: 'missing_chargeback_payment_id' })
      }

      const remotePayment = await getMercadoPagoPayment(config.mercadoPagoAccessToken, chargebackPaymentId)
      const chargebackPayment = {
        ...remotePayment,
        status: 'charged_back',
        status_detail: text(remoteChargeback.status, text(remotePayment.status_detail, 'chargeback')),
        chargeback: remoteChargeback,
      }
      const order = await findOrderForPayment(supabase, chargebackPayment)

      if (!order) {
        await markEvent(eventRow?.id, {
          processing_status: 'ignored',
          error_message: 'Contestacao nao pertence a um pedido conhecido.',
        })
        return NextResponse.json({ success: true, ignored: true, reason: 'unknown_chargeback_order' })
      }

      const payment = await upsertPaymentFromRemote({ supabase, order, remotePayment: chargebackPayment })
      const statusEvent = await emitPaymentStatusEvent({
        supabase,
        orderId: order.id,
        paymentId: payment.id,
        status: 'chargeback',
        source: 'mercado_pago_chargeback_webhook',
        remotePayment: chargebackPayment,
        metadata: {
          chargeback_id: dataId,
          chargeback_status: text(remoteChargeback.status),
        },
      }).catch((error) => {
        console.warn('[Mercado Pago Webhook] chargeback status event failed:', error instanceof Error ? error.message : error)
        return null
      })

      await markEvent(eventRow?.id, {
        processing_status: 'processed',
        payment_id: payment.id,
        order_id: order.id,
        payload: {
          ...(eventRow?.payload || payload),
          remote_payment_status: 'charged_back',
          chargeback_status: text(remoteChargeback.status),
          status_event: statusEvent,
        },
      })

      return NextResponse.json({
        success: true,
        order_id: order.id,
        payment_id: payment.id,
        payment_status: 'charged_back',
        order_status: 'chargeback',
        status_event: statusEvent,
      })
    }

    if (isSubscriptionEvent(payload)) {
      const remoteSubscription = await getMercadoPagoPreapproval(config.mercadoPagoAccessToken, dataId)
      const order = await findOrderForSubscription(supabase, remoteSubscription)

      if (!order) {
        await markEvent(eventRow?.id, {
          processing_status: 'ignored',
          error_message: 'Assinatura nao pertence a um pedido conhecido.',
        })
        return NextResponse.json({ success: true, ignored: true, reason: 'unknown_subscription_order' })
      }

      const productId = await productIdForOrder(supabase, order)
      const remotePaymentMethod = subscriptionPaymentMethod(
        remoteSubscription.payment_method_id
          || remoteSubscription.payment_method
          || order.metadata?.subscription_payment_method
      )
      const subscription = await upsertSubscriptionFromRemote({
        supabase,
        order,
        customerId: order.customer_id,
        productId,
        offerId: order.offer_id,
        remoteSubscription,
        paymentMethod: remotePaymentMethod,
        environment: config.mercadoPagoEnvironment,
        metadata: {
          webhook_event_id: eventRow?.id || null,
        },
      })
      const payment = await upsertSubscriptionPayment({ supabase, order, subscription, remoteSubscription })
      const sync = await syncSubscriptionAccess({
        supabase,
        subscription,
        order,
        paymentId: payment.id,
        source: 'mercado_pago_subscription_webhook',
        remoteSubscription,
      })

      await markEvent(eventRow?.id, {
        processing_status: 'processed',
        payment_id: payment.id,
        order_id: order.id,
        payload: {
          ...(eventRow?.payload || payload),
          remote_subscription_status: normalizeSubscriptionStatus(remoteSubscription.status),
          subscription_id: subscription.id,
          sync,
        },
      })

      return NextResponse.json({
        success: true,
        order_id: order.id,
        payment_id: payment.id,
        subscription_id: subscription.id,
        subscription_status: subscription.status,
        sync,
      })
    }

    const remotePayment = await getMercadoPagoPayment(config.mercadoPagoAccessToken, dataId)
    const order = await findOrderForPayment(supabase, remotePayment)

    if (!order) {
      await markEvent(eventRow?.id, {
        processing_status: 'ignored',
        error_message: 'Pagamento não pertence a um pedido conhecido.',
      })
      return NextResponse.json({ success: true, ignored: true, reason: 'unknown_order' })
    }

    const payment = await upsertPaymentFromRemote({ supabase, order, remotePayment })
    const paymentStatus = normalizeMercadoPagoPaymentStatus(remotePayment.status)
    const orderStatus = mapPaymentStatusToOrderStatus(paymentStatus, text(remotePayment.status_detail))
    const paidAt = paymentStatus === 'approved'
      ? (remotePayment.date_approved || payment.paid_at || new Date().toISOString())
      : order.paid_at

    await supabase
      .from('commerce_orders')
      .update({
        status: orderStatus,
        paid_at: orderStatus === 'paid' ? paidAt : order.paid_at,
        cancelled_at: orderStatus === 'cancelled' ? new Date().toISOString() : order.cancelled_at,
        metadata: {
          ...(order.metadata || {}),
          last_mercado_pago_webhook_at: new Date().toISOString(),
          last_mercado_pago_status: paymentStatus,
          last_mercado_pago_status_detail: text(remotePayment.status_detail),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)

    let fulfillment = null
    let statusEvent = null
    if (paymentStatus === 'approved') {
      fulfillment = await fulfillApprovedOrder({
        supabase,
        orderId: order.id,
        paymentId: payment.id,
        source: 'mercado_pago_webhook',
        remotePayment,
      })
      statusEvent = await emitPaymentStatusEvent({
        supabase,
        orderId: order.id,
        paymentId: payment.id,
        status: 'access_granted',
        source: 'mercado_pago_webhook',
        remotePayment,
        sendNotifications: false,
      }).catch((error) => {
        console.warn('[Mercado Pago Webhook] access status event failed:', error instanceof Error ? error.message : error)
        return null
      })
    } else {
      statusEvent = await emitPaymentStatusEvent({
        supabase,
        orderId: order.id,
        paymentId: payment.id,
        status: paymentLifecycleFromProviderStatus(paymentStatus, remotePayment.status_detail),
        source: 'mercado_pago_webhook',
        remotePayment,
      }).catch((error) => {
        console.warn('[Mercado Pago Webhook] payment status event failed:', error instanceof Error ? error.message : error)
        return null
      })
    }

    await markEvent(eventRow?.id, {
      processing_status: 'processed',
      payment_id: payment.id,
      order_id: order.id,
      payload: {
        ...(eventRow?.payload || payload),
        remote_payment_status: paymentStatus,
        fulfillment,
        status_event: statusEvent,
      },
    })

    return NextResponse.json({
      success: true,
      order_id: order.id,
      payment_id: payment.id,
      payment_status: paymentStatus,
      order_status: orderStatus,
      fulfillment,
      status_event: statusEvent,
    })
  } catch (error) {
    console.error('[Mercado Pago Webhook] failed:', error)
    await markEvent(eventRow?.id, {
      processing_status: 'failed',
      error_message: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
    })
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao processar webhook.',
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    service: 'mercado_pago_webhook',
    message: 'Webhook Mercado Pago ativo.',
  })
}
