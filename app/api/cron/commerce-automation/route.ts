import { NextRequest, NextResponse } from 'next/server'
import { saveAppConfig } from '@/lib/admin/app-config'
import { processCommerceAutomations } from '@/lib/commerce/automation'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function saveCronState(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  values: Record<string, string>
) {
  await Promise.all(
    Object.entries(values).map(([key, value]) => saveAppConfig(supabase, key, value).catch(() => {})),
  )
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseAdminClient()
  const checkedAt = new Date().toISOString()
  const force = request.nextUrl.searchParams.get('force') === 'true'
  const dryRun = request.nextUrl.searchParams.get('dry_run') === 'true'

  if (!dryRun) {
    await saveCronState(supabase, {
      commerce_automation_cron_last_checked_at: checkedAt,
      commerce_automation_cron_last_reason: 'processing',
    })
  }

  try {
    const result = await processCommerceAutomations(supabase, {
      force,
      dryRun,
      source: 'vercel_cron',
    })

    if (!dryRun) {
      await saveCronState(supabase, {
        commerce_automation_cron_last_run_at: new Date().toISOString(),
        commerce_automation_cron_last_reason: result.skipped ? String(result.reason || 'skipped') : 'completed',
        commerce_automation_cron_last_result: JSON.stringify(result).slice(0, 2000),
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await saveCronState(supabase, {
      commerce_automation_cron_last_reason: 'error',
      commerce_automation_cron_last_error: message.slice(0, 500),
      commerce_automation_cron_last_error_at: new Date().toISOString(),
    })

    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
