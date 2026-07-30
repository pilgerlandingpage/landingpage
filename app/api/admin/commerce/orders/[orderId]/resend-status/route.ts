import { NextRequest, NextResponse } from 'next/server'
import { requireAdminModules } from '@/lib/admin/require-admin'
import {
  emitPaymentStatusEvent,
  normalizePaymentLifecycleStatus,
  paymentLifecycleFromOrder,
} from '@/lib/commerce/payment-status'

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

type MessageChannel = 'whatsapp' | 'email'

function channelsFrom(value: unknown): MessageChannel[] {
  const allowed = new Set(['whatsapp', 'email'])
  const channels = Array.isArray(value)
    ? value.map(String).filter((item) => allowed.has(item))
    : ['whatsapp']
  return channels.length ? channels as MessageChannel[] : ['whatsapp']
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const auth = await requireAdminModules(['commerce', 'products', 'maintenance'])
    if (!auth.ok) return auth.response

    const { orderId } = await context.params
    if (!isUuid(orderId)) {
      return NextResponse.json({ success: false, error: 'Pedido invalido.' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const [{ data: order, error: orderError }, { data: payment, error: paymentError }] = await Promise.all([
      auth.admin.from('commerce_orders').select('*').eq('id', orderId).maybeSingle(),
      auth.admin
        .from('commerce_payments')
        .select('*')
        .eq('order_id', orderId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (orderError || paymentError) throw orderError || paymentError
    if (!order) return NextResponse.json({ success: false, error: 'Pedido nao encontrado.' }, { status: 404 })

    const status = text(body.status)
      ? normalizePaymentLifecycleStatus(body.status)
      : paymentLifecycleFromOrder(order, payment)

    const event = await emitPaymentStatusEvent({
      supabase: auth.admin,
      orderId,
      paymentId: payment?.id || null,
      status,
      source: 'admin_resend_payment_status',
      channels: channelsFrom(body.channels),
      dedupe: body.dedupe !== true ? false : true,
      metadata: {
        admin_user_id: auth.adminUser.id,
        manual_resend: true,
        note: text(body.note),
      },
    })

    return NextResponse.json({
      success: true,
      event,
    })
  } catch (error) {
    console.error('[Admin Commerce Resend Status] failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao reenviar status.',
    }, { status: 500 })
  }
}
