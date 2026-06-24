import { NextRequest, NextResponse } from 'next/server'
import { buildVitorMonitoringSnapshot, persistVitorMonitoringSnapshot } from '@/lib/ads/vitor-monitoring'
import { createAdminClient } from '@/lib/supabase/server'
import type { DatePreset } from '@/lib/ads/meta'

export const dynamic = 'force-dynamic'

function parseDatePreset(value: string | null): DatePreset {
  const allowed = new Set(['today', 'yesterday', 'last_7d', 'last_30d', 'this_month', 'last_month', 'maximum'])
  return allowed.has(String(value || '')) ? value as DatePreset : 'last_7d'
}

export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  try {
    const monitoring = await buildVitorMonitoringSnapshot({
      supabase,
      datePreset: parseDatePreset(request.nextUrl.searchParams.get('date_preset')),
    })

    return NextResponse.json({
      success: true,
      monitoring,
    })
  } catch (error) {
    console.error('[Vitor Monitoring] GET error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao carregar monitoramento do Vitor.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  try {
    const body = await request.json().catch(() => ({}))
    const monitoring = await buildVitorMonitoringSnapshot({
      supabase,
      datePreset: parseDatePreset(body?.date_preset || request.nextUrl.searchParams.get('date_preset')),
    })
    const report = await persistVitorMonitoringSnapshot({ supabase, snapshot: monitoring })

    return NextResponse.json({
      success: true,
      monitoring,
      report,
    })
  } catch (error) {
    console.error('[Vitor Monitoring] POST error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao registrar monitoramento do Vitor.' },
      { status: 500 },
    )
  }
}
