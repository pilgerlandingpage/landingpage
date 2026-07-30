import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { centsToMoney } from '@/lib/commerce/checkout'
import { publicPaymentStatusPayload } from '@/lib/commerce/payment-status'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ orderId: string }>
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orderId } = await context.params
    if (!isUuid(orderId)) {
      return NextResponse.json({ success: false, message: 'Pedido invalido.' }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    const { data: order, error: orderError } = await supabase
      .from('commerce_orders')
      .select('id, order_number, status, total_cents, currency, pix_expires_at, paid_at, updated_at, metadata')
      .eq('id', orderId)
      .maybeSingle()

    if (orderError) throw orderError
    if (!order) {
      return NextResponse.json({ success: false, message: 'Pedido nao encontrado.' }, { status: 404 })
    }

    const { data: payment, error: paymentError } = await supabase
      .from('commerce_payments')
      .select('id, status, status_detail, payment_method, amount_cents, paid_at, expires_at, updated_at')
      .eq('order_id', order.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (paymentError) throw paymentError

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        total_cents: order.total_cents,
        total_display: centsToMoney(Number(order.total_cents || 0)),
        currency: order.currency,
        pix_expires_at: order.pix_expires_at,
        paid_at: order.paid_at,
        updated_at: order.updated_at,
      },
      payment: payment ? {
        id: payment.id,
        status: payment.status,
        status_detail: payment.status_detail,
        payment_method: payment.payment_method,
        amount_cents: payment.amount_cents,
        paid_at: payment.paid_at,
        expires_at: payment.expires_at,
        updated_at: payment.updated_at,
      } : null,
      status: publicPaymentStatusPayload(order, payment),
    })
  } catch (error) {
    console.error('[Checkout Order Status] failed:', error)
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao consultar status.',
    }, { status: 500 })
  }
}
