import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { loadCommerceConfig } from '@/lib/commerce/checkout'
import { fulfillApprovedOrder, mapPaymentStatusToOrderStatus } from '@/lib/commerce/fulfillment'
import { commerceMessageVariables, dispatchCommerceMessage } from '@/lib/commerce/transactional-messages'
import {
  extractMercadoPagoPixData,
  getMercadoPagoPayment,
  getMercadoPagoPaymentMethod,
  mercadoPagoAmountToCents,
  normalizeMercadoPagoPaymentStatus,
} from '@/lib/commerce/mercado-pago'

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
    payment_method: getMercadoPagoPaymentMethod(remotePayment.payment_method_id),
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

async function dispatchPendingPaymentMessage(params: {
  supabase: ReturnType<typeof createSupabaseAdminClient>
  order: Record<string, any>
  payment: Record<string, any>
}) {
  const { supabase, order, payment } = params
  if (!order.customer_id) return null

  const [customerRes, itemsRes] = await Promise.all([
    supabase.from('commerce_customers').select('*').eq('id', order.customer_id).maybeSingle(),
    supabase.from('commerce_order_items').select('title_snapshot').eq('order_id', order.id),
  ])

  if (customerRes.error) throw customerRes.error
  if (itemsRes.error) throw itemsRes.error
  if (!customerRes.data) return null

  const productName = (itemsRes.data || [])
    .map((item: any) => text(item.title_snapshot))
    .filter(Boolean)
    .join(' + ') || 'Produto digital Guilherme Pilger'

  return dispatchCommerceMessage({
    supabase,
    templateKey: 'checkout_payment_pending',
    channel: 'whatsapp',
    customer: customerRes.data,
    order,
    payment,
    educationLeadId: order.education_lead_id,
    variables: commerceMessageVariables({
      customer: customerRes.data,
      productName,
      order,
      payment,
      checkoutUrl: text(order.metadata?.checkout_url),
    }),
  })
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
    if (paymentStatus === 'approved') {
      fulfillment = await fulfillApprovedOrder({
        supabase,
        orderId: order.id,
        paymentId: payment.id,
        source: 'mercado_pago_webhook',
        remotePayment,
      })
    } else if (['pending', 'authorized', 'in_process'].includes(paymentStatus)) {
      await dispatchPendingPaymentMessage({ supabase, order, payment }).catch((error) => {
        console.warn('[Mercado Pago Webhook] pending message failed:', error instanceof Error ? error.message : error)
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
      },
    })

    return NextResponse.json({
      success: true,
      order_id: order.id,
      payment_id: payment.id,
      payment_status: paymentStatus,
      order_status: orderStatus,
      fulfillment,
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
