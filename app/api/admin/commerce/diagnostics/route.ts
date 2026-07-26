import { NextRequest, NextResponse } from 'next/server'
import { requireAdminModules } from '@/lib/admin/require-admin'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  approveInternalDiagnosticOrder,
  createInternalDiagnosticOrder,
  createSandboxDiagnosticPix,
  runCommerceDiagnostics,
  syncSandboxDiagnosticPayment,
} from '@/lib/commerce/diagnostics'

export const dynamic = 'force-dynamic'

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

export async function GET() {
  try {
    const auth = await requireAdminModules(['commerce', 'products', 'maintenance'])
    if (!auth.ok) return auth.response

    const supabase = createSupabaseAdminClient()
    const result = await runCommerceDiagnostics(supabase)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Commerce Diagnostics] GET failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminModules(['commerce', 'products', 'maintenance'])
    if (!auth.ok) return auth.response

    const body = await request.json().catch(() => ({}))
    const action = text(body?.action)
    const supabase = createSupabaseAdminClient()

    if (action === 'check_connection') {
      const result = await runCommerceDiagnostics(supabase, { checkMercadoPagoConnection: true })
      return NextResponse.json(result)
    }

    if (action === 'create_sandbox_pix') {
      const result = await createSandboxDiagnosticPix(supabase, {
        checkoutSlug: text(body?.checkout_slug),
        selectedBumpIds: Array.isArray(body?.selected_bump_ids) ? body.selected_bump_ids.map(String) : [],
      })
      return NextResponse.json(result)
    }

    if (action === 'sync_sandbox_payment') {
      const result = await syncSandboxDiagnosticPayment(supabase, {
        orderId: text(body?.order_id),
        paymentId: text(body?.payment_id),
      })
      return NextResponse.json(result)
    }

    if (action === 'create_internal_diagnostic_order') {
      const result = await createInternalDiagnosticOrder(supabase, {
        checkoutSlug: text(body?.checkout_slug),
        selectedBumpIds: Array.isArray(body?.selected_bump_ids) ? body.selected_bump_ids.map(String) : [],
      })
      return NextResponse.json(result)
    }

    if (action === 'approve_internal_diagnostic_order') {
      const result = await approveInternalDiagnosticOrder(supabase, {
        orderId: text(body?.order_id),
      })
      return NextResponse.json(result)
    }

    return NextResponse.json({ success: false, error: 'Acao invalida.' }, { status: 400 })
  } catch (error) {
    console.error('[Commerce Diagnostics] POST failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
