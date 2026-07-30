import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { centsToMoney, loadCommerceConfig } from '@/lib/commerce/checkout'
import { fulfillApprovedOrder, mapPaymentStatusToOrderStatus } from '@/lib/commerce/fulfillment'
import {
  extractMercadoPagoPixData,
  getMercadoPagoPayment,
  getMercadoPagoPaymentMethod,
  getMercadoPagoPreapproval,
  mercadoPagoAmountToCents,
  normalizeMercadoPagoPaymentStatus,
} from '@/lib/commerce/mercado-pago'
import {
  emitPaymentStatusEvent,
  paymentLifecycleFromProviderStatus,
  publicPaymentStatusPayload,
} from '@/lib/commerce/payment-status'
import {
  normalizeSubscriptionStatus,
  subscriptionPaymentMethod,
  syncSubscriptionAccess,
  upsertSubscriptionFromRemote,
} from '@/lib/commerce/subscriptions'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ orderId: string }>
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

async function productIdForOrder(supabase: ReturnType<typeof createSupabaseAdminClient>, orderId: string) {
  const { data, error } = await supabase
    .from('commerce_order_items')
    .select('product_id')
    .eq('order_id', orderId)
    .eq('item_type', 'primary')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return text(data?.product_id)
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { orderId } = await context.params
    if (!isUuid(orderId)) {
      return NextResponse.json({ success: false, message: 'Pedido invalido.' }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    const { data: order, error: orderError } = await supabase
      .from('commerce_orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle()

    if (orderError) throw orderError
    if (!order) {
      return NextResponse.json({ success: false, message: 'Pedido nao encontrado.' }, { status: 404 })
    }

    const { data: payment, error: paymentError } = await supabase
      .from('commerce_payments')
      .select('*')
      .eq('order_id', order.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (paymentError) throw paymentError
    const refreshableSubscription = payment?.payment_method === 'subscription' && Boolean(payment.provider_order_id)
    if ((!payment?.provider_payment_id && !refreshableSubscription) || payment.provider !== 'mercado_pago') {
      return NextResponse.json({
        success: true,
        refreshed: false,
        reason: 'payment_not_refreshable',
        order: {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          total_display: centsToMoney(Number(order.total_cents || 0)),
        },
        payment,
        status: publicPaymentStatusPayload(order, payment),
      })
    }

    if (payment.status === 'approved' && !refreshableSubscription) {
      return NextResponse.json({
        success: true,
        refreshed: false,
        reason: 'already_approved',
        order: {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          total_display: centsToMoney(Number(order.total_cents || 0)),
        },
        payment,
        status: publicPaymentStatusPayload(order, payment),
      })
    }

    const config = await loadCommerceConfig()
    if (!config.mercadoPagoAccessToken) {
      return NextResponse.json({ success: false, message: 'Mercado Pago nao configurado.' }, { status: 503 })
    }

    if (payment.payment_method === 'subscription' && payment.provider_order_id) {
      const remoteSubscription = await getMercadoPagoPreapproval(config.mercadoPagoAccessToken, payment.provider_order_id)
      const productId = await productIdForOrder(supabase, order.id)
      const subscription = await upsertSubscriptionFromRemote({
        supabase,
        order,
        customerId: order.customer_id,
        productId,
        offerId: order.offer_id,
        remoteSubscription,
        paymentMethod: subscriptionPaymentMethod(remoteSubscription.payment_method_id || remoteSubscription.payment_method || order.metadata?.subscription_payment_method),
        environment: config.mercadoPagoEnvironment,
        metadata: {
          refreshed_by: 'checkout_refresh_status',
        },
      })
      const sync = await syncSubscriptionAccess({
        supabase,
        subscription,
        order,
        paymentId: payment.id,
        source: 'checkout_refresh_subscription_status',
        remoteSubscription,
      })
      const subscriptionStatus = normalizeSubscriptionStatus(remoteSubscription.status)
      const { data: updatedPayment, error: updatePaymentError } = await supabase
        .from('commerce_payments')
        .update({
          subscription_id: subscription.id,
          status: subscriptionStatus === 'authorized' || subscriptionStatus === 'active' ? 'approved' : 'pending',
          status_detail: `subscription_${subscriptionStatus}`,
          raw_payload: remoteSubscription,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id)
        .select()
        .single()
      if (updatePaymentError) throw updatePaymentError

      const { data: updatedOrder } = await supabase
        .from('commerce_orders')
        .select('*')
        .eq('id', order.id)
        .maybeSingle()

      return NextResponse.json({
        success: true,
        refreshed: true,
        order: {
          id: (updatedOrder || order).id,
          order_number: (updatedOrder || order).order_number,
          status: (updatedOrder || order).status,
          total_cents: (updatedOrder || order).total_cents,
          total_display: centsToMoney(Number((updatedOrder || order).total_cents || 0)),
          pix_expires_at: (updatedOrder || order).pix_expires_at,
          paid_at: (updatedOrder || order).paid_at,
        },
        payment: updatedPayment,
        subscription,
        status: publicPaymentStatusPayload(updatedOrder || order, updatedPayment),
        sync,
      })
    }

    const remotePayment = await getMercadoPagoPayment(config.mercadoPagoAccessToken, payment.provider_payment_id)
    const pix = extractMercadoPagoPixData(remotePayment)
    const remoteStatus = normalizeMercadoPagoPaymentStatus(remotePayment.status)
    const lifecycleStatus = paymentLifecycleFromProviderStatus(remoteStatus, remotePayment.status_detail)
    const orderStatus = mapPaymentStatusToOrderStatus(remoteStatus, text(remotePayment.status_detail))
    const paidAt = remoteStatus === 'approved'
      ? (remotePayment.date_approved || payment.paid_at || new Date().toISOString())
      : payment.paid_at

    const { data: updatedPayment, error: updatePaymentError } = await supabase
      .from('commerce_payments')
      .update({
        status: remoteStatus,
        status_detail: text(remotePayment.status_detail),
        payment_method: getMercadoPagoPaymentMethod(remotePayment.payment_method_id, remotePayment.payment_type_id),
        amount_cents: mercadoPagoAmountToCents(remotePayment.transaction_amount) || payment.amount_cents,
        pix_qr_code: pix.qrCode || payment.pix_qr_code,
        pix_qr_code_base64: pix.qrCodeBase64 || payment.pix_qr_code_base64,
        pix_ticket_url: pix.ticketUrl || payment.pix_ticket_url,
        paid_at: remoteStatus === 'approved' ? paidAt : payment.paid_at,
        raw_payload: remotePayment,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id)
      .select()
      .single()

    if (updatePaymentError) throw updatePaymentError

    const { data: updatedOrder, error: updateOrderError } = await supabase
      .from('commerce_orders')
      .update({
        status: remoteStatus === 'approved' ? 'paid' : orderStatus,
        paid_at: remoteStatus === 'approved' ? paidAt : order.paid_at,
        cancelled_at: orderStatus === 'cancelled' ? (order.cancelled_at || new Date().toISOString()) : order.cancelled_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .select('*')
      .single()

    if (updateOrderError) throw updateOrderError

    let fulfillment = null
    if (remoteStatus === 'approved') {
      fulfillment = await fulfillApprovedOrder({
        supabase,
        orderId: order.id,
        paymentId: updatedPayment.id,
        source: 'checkout_refresh_status',
        remotePayment,
      })
    }

    const event = await emitPaymentStatusEvent({
      supabase,
      orderId: order.id,
      paymentId: updatedPayment.id,
      status: remoteStatus === 'approved' ? 'access_granted' : lifecycleStatus,
      source: 'checkout_refresh_status',
      remotePayment,
      sendNotifications: remoteStatus !== 'approved',
    })

    return NextResponse.json({
      success: true,
      refreshed: true,
      order: {
        id: updatedOrder.id,
        order_number: updatedOrder.order_number,
        status: updatedOrder.status,
        total_cents: updatedOrder.total_cents,
        total_display: centsToMoney(Number(updatedOrder.total_cents || 0)),
        pix_expires_at: updatedOrder.pix_expires_at,
        paid_at: updatedOrder.paid_at,
      },
      payment: {
        id: updatedPayment.id,
        provider_payment_id: updatedPayment.provider_payment_id,
        status: updatedPayment.status,
        status_detail: updatedPayment.status_detail,
        pix_qr_code: updatedPayment.pix_qr_code,
        pix_qr_code_base64: updatedPayment.pix_qr_code_base64,
        pix_ticket_url: updatedPayment.pix_ticket_url,
        expires_at: updatedPayment.expires_at,
      },
      status: publicPaymentStatusPayload(updatedOrder, updatedPayment),
      event,
      fulfillment,
    })
  } catch (error) {
    console.error('[Checkout Refresh Status] failed:', error)
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao atualizar status.',
    }, { status: 500 })
  }
}
