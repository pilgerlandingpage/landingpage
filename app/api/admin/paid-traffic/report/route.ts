import { NextRequest, NextResponse } from 'next/server'
import { markAgentCompleted, markAgentFailed, markAgentStarted } from '@/lib/admin/app-config'
import { generatePaidMarketingReport, listPaidMarketingReports } from '@/lib/ads/paid-report-agent'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function parseNumber(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value || fallback)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), min), max)
}

export async function GET(request: NextRequest) {
  try {
    const reports = await listPaidMarketingReports(parseNumber(request.nextUrl.searchParams.get('limit'), 5, 1, 30))
    return NextResponse.json({ success: true, reports })
  } catch (error) {
    console.error('Error listing paid AI reports:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao listar relatorios pagos.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  try {
    await markAgentStarted(supabase, 'paid_report_agent')
    const result = await generatePaidMarketingReport({
      days: parseNumber(request.nextUrl.searchParams.get('days'), 30, 7, 120),
    })

    await markAgentCompleted(supabase, 'paid_report_agent', {
      report_id: result.report?.id,
      title: result.report?.title,
      source: 'manual_api',
    })

    return NextResponse.json(result)
  } catch (error) {
    await markAgentFailed(supabase, 'paid_report_agent', error).catch(() => {})
    console.error('Error generating paid AI report:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao gerar relatorio pago.' },
      { status: 500 },
    )
  }
}
