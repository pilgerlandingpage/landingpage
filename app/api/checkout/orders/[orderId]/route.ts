import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { loadCommerceConfig, centsToMoney } from '@/lib/commerce/checkout'
import { fulfillApprovedOrder, mapPaymentStatusToOrderStatus } from '@/lib/commerce/fulfillment'
import {
  extractMercadoPagoPixData,
  getMercadoPagoPayment,
  getMercadoPagoPaymentMethod,
  mercadoPagoAmountToCents,
  normalizeMercadoPagoPaymentStatus,
} from '@/lib/commerce/mercado-pago'

type RouteContext = {
  params: Promise<{ orderId: string }>
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orderId } = await context.params
    if (!isUuid(orderId)) {
      return NextResponse.json({ success: false, message: 'Pedido inválido.' }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    const { data: order, error: orderError } = await supabase
      .from('commerce_orders')
      .select('id, order_number, status, total_cents, currency, pix_expires_at, paid_at, updated_at')
      .eq('id', orderId)
      .maybeSingle()

    if (orderError) throw orderError
    if (!order) {
      return NextResponse.json({ success: false, message: 'Pedido não encontrado.' }, { status: 404 })
    }

    const { data: payment, error: paymentError } = await supabase
      .from('commerce_payments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (paymentError) throw paymentError

    let currentOrder = order
    let currentPayment = payment

    if (payment?.provider === 'mercado_pago' && payment.provider_payment_id && payment.status !== 'approved') {
      try {
        const config = await loadCommerceConfig()
        if (config.mercadoPagoAccessToken) {
          const remotePayment = await getMercadoPagoPayment(config.mercadoPagoAccessToken, payment.provider_payment_id)
          const pix = extractMercadoPagoPixData(remotePayment)
          const remoteStatus = normalizeMercadoPagoPaymentStatus(remotePayment.status)
          const orderStatus = mapPaymentStatusToOrderStatus(remoteStatus, String(remotePayment.status_detail || ''))
          const paidAt = remoteStatus === 'approved' ? (remotePayment.date_approved || new Date().toISOString()) : null

          const { data: updatedPayment } = await supabase
            .from('commerce_payments')
            .update({
              status: remoteStatus,
              status_detail: text(remotePayment.status_detail),
              payment_method: getMercadoPagoPaymentMethod(remotePayment.payment_method_id),
              amount_cents: mercadoPagoAmountToCents(remotePayment.transaction_amount) || payment.amount_cents,
              pix_qr_code: pix.qrCode || payment.pix_qr_code,
              pix_qr_code_base64: pix.qrCodeBase64 || payment.pix_qr_code_base64,
              pix_ticket_url: pix.ticketUrl || payment.pix_ticket_url,
              paid_at: paidAt,
              raw_payload: remotePayment,
              updated_at: new Date().toISOString(),
            })
            .eq('id', payment.id)
            .select()
            .single()

          if (updatedPayment) currentPayment = updatedPayment

          const { data: updatedOrder } = await supabase
            .from('commerce_orders')
            .update({
              status: remoteStatus === 'approved' ? 'paid' : orderStatus,
              paid_at: paidAt || order.paid_at,
              updated_at: new Date().toISOString(),
            })
            .eq('id', order.id)
            .select('id, order_number, status, total_cents, currency, pix_expires_at, paid_at, updated_at')
            .single()

          if (updatedOrder) currentOrder = updatedOrder

          if (remoteStatus === 'approved') {
            await fulfillApprovedOrder({
              supabase,
              orderId: order.id,
              paymentId: updatedPayment?.id || payment.id,
              source: 'checkout_status_refresh',
              remotePayment,
            })

            const { data: refreshedOrder } = await supabase
              .from('commerce_orders')
              .select('id, order_number, status, total_cents, currency, pix_expires_at, paid_at, updated_at')
              .eq('id', order.id)
              .maybeSingle()
            if (refreshedOrder) currentOrder = refreshedOrder
          }
        }
      } catch (error) {
        console.warn('[Checkout Status] Mercado Pago refresh failed:', error instanceof Error ? error.message : error)
      }
    }

    return NextResponse.json({
      success: true,
      order: {
        id: currentOrder.id,
        order_number: currentOrder.order_number,
        status: currentOrder.status,
        total_cents: currentOrder.total_cents,
        total_display: centsToMoney(currentOrder.total_cents),
        pix_expires_at: currentOrder.pix_expires_at,
        paid_at: currentOrder.paid_at,
      },
      payment: currentPayment ? {
        id: currentPayment.id,
        provider_payment_id: currentPayment.provider_payment_id,
        status: currentPayment.status,
        status_detail: currentPayment.status_detail,
        pix_qr_code: currentPayment.pix_qr_code,
        pix_qr_code_base64: currentPayment.pix_qr_code_base64,
        pix_ticket_url: currentPayment.pix_ticket_url,
        expires_at: currentPayment.expires_at,
      } : null,
    })
  } catch (error) {
    console.error('[Checkout Status] failed:', error)
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao consultar pedido.',
    }, { status: 500 })
  }
}
