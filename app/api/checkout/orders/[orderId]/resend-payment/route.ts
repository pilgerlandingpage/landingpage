import { NextRequest, NextResponse } from 'next/server'
import {
  normalizeBrazilPhone,
  normalizeDocument,
  normalizeEmail,
} from '@/lib/commerce/checkout'
import {
  emitPaymentStatusEvent,
  normalizePaymentLifecycleStatus,
  paymentLifecycleFromOrder,
} from '@/lib/commerce/payment-status'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

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

function matchesCustomer(body: Record<string, any>, customer: Record<string, any>) {
  const email = normalizeEmail(body.email)
  const phone = normalizeBrazilPhone(body.phone)
  const document = normalizeDocument(body.document)
  if (!email && !phone && !document) return false

  return Boolean(
    (email && email === normalizeEmail(customer.email)) ||
    (phone && phone === normalizeBrazilPhone(customer.phone_e164 || customer.phone)) ||
    (document && document === normalizeDocument(customer.document))
  )
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { orderId } = await context.params
    if (!isUuid(orderId)) {
      return NextResponse.json({ success: false, message: 'Pedido invalido.' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const supabase = createSupabaseAdminClient()
    const { data: order, error: orderError } = await supabase
      .from('commerce_orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle()

    if (orderError) throw orderError
    if (!order) return NextResponse.json({ success: false, message: 'Pedido nao encontrado.' }, { status: 404 })
    if (!order.customer_id) return NextResponse.json({ success: false, message: 'Cliente nao encontrado.' }, { status: 404 })

    const [{ data: customer, error: customerError }, { data: payment, error: paymentError }] = await Promise.all([
      supabase.from('commerce_customers').select('*').eq('id', order.customer_id).maybeSingle(),
      supabase
        .from('commerce_payments')
        .select('*')
        .eq('order_id', order.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (customerError || paymentError) throw customerError || paymentError
    if (!customer || !matchesCustomer(body, customer)) {
      return NextResponse.json({ success: false, message: 'Confirme e-mail, WhatsApp ou CPF/CNPJ do pedido.' }, { status: 403 })
    }

    const currentStatus = paymentLifecycleFromOrder(order, payment)
    if (currentStatus === 'payment_approved' || currentStatus === 'access_granted') {
      return NextResponse.json({ success: false, message: 'Pedido ja aprovado. Use a area de membros para acessar.' }, { status: 409 })
    }

    const requestedStatus = text(body.status)
    const status = requestedStatus
      ? normalizePaymentLifecycleStatus(requestedStatus)
      : currentStatus === 'checkout_started'
        ? 'waiting_payment'
        : currentStatus

    const allowed = new Set(['pix_generated', 'waiting_payment', 'payment_pending', 'payment_expiring', 'payment_processing', 'payment_expired', 'payment_rejected', 'payment_cancelled'])
    if (!allowed.has(status)) {
      return NextResponse.json({ success: false, message: 'Status nao pode ser reenviado por esta rota.' }, { status: 400 })
    }

    const event = await emitPaymentStatusEvent({
      supabase,
      orderId: order.id,
      paymentId: payment?.id || null,
      status,
      source: 'checkout_resend_payment',
      channels: ['whatsapp'],
      dedupe: false,
      metadata: {
        public_resend: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Mensagem reenviada pelo WhatsApp, quando o canal estiver disponivel.',
      event,
    })
  } catch (error) {
    console.error('[Checkout Resend Payment] failed:', error)
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao reenviar status.',
    }, { status: 500 })
  }
}
