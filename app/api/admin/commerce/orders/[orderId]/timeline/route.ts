import { NextResponse } from 'next/server'
import { requireAdminModules } from '@/lib/admin/require-admin'
import { loadPaymentTimeline } from '@/lib/commerce/payment-status'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ orderId: string }>
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requireAdminModules(['commerce', 'products', 'maintenance'])
    if (!auth.ok) return auth.response

    const { orderId } = await context.params
    if (!isUuid(orderId)) {
      return NextResponse.json({ success: false, error: 'Pedido invalido.' }, { status: 400 })
    }

    const timeline = await loadPaymentTimeline(auth.admin, orderId)
    return NextResponse.json(timeline)
  } catch (error) {
    console.error('[Admin Commerce Timeline] failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao carregar timeline.',
    }, { status: 500 })
  }
}
