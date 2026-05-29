import { NextRequest, NextResponse } from 'next/server'
import { saveAppConfig } from '@/lib/admin/app-config'
import { getNewsAgentSchedule } from '@/lib/news/schedule'
import { runNewsAgentDraft } from '@/lib/news/runner'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 800

async function saveCronState(supabase: ReturnType<typeof createAdminClient>, values: Record<string, string>) {
  await Promise.all(
    Object.entries(values).map(([key, value]) => saveAppConfig(supabase, key, value).catch(() => {}))
  )
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const checkedAt = new Date().toISOString()

  try {
    const schedule = await getNewsAgentSchedule(supabase)
    await saveCronState(supabase, {
      news_agent_cron_last_checked_at: checkedAt,
      news_agent_cron_last_reason: schedule.reason,
      news_agent_cron_last_schedule: JSON.stringify({
        schedule_slot: schedule.scheduleSlot,
        schedule_day: schedule.scheduleDay,
        schedule_time: schedule.scheduleTime,
        today: schedule.today,
      }),
    })

    if (!schedule.enabled || !schedule.shouldRun) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: schedule.reason,
        schedule,
      })
    }

    const result = await runNewsAgentDraft({
      origin: request.nextUrl.origin,
      source: 'vercel-cron-news-agent',
    })

    await saveCronState(supabase, {
      news_agent_cron_last_reason: 'ran',
      news_agent_cron_last_run_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      skipped: false,
      schedule,
      result,
    })
  } catch (error: any) {
    await saveCronState(supabase, {
      news_agent_cron_last_reason: 'error',
      news_agent_cron_last_error: String(error?.message || error).slice(0, 500),
      news_agent_cron_last_error_at: new Date().toISOString(),
    })

    return NextResponse.json(
      { success: false, error: error?.message || String(error) },
      { status: 500 }
    )
  }
}
