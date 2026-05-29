import { NextRequest, NextResponse } from 'next/server'
import { saveAppConfig } from '@/lib/admin/app-config'
import { getBlogAgentSchedule } from '@/lib/blog/schedule'
import { runBlogAgentDraft } from '@/lib/blog/runner'
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
    const schedule = await getBlogAgentSchedule(supabase)
    await saveCronState(supabase, {
      blog_agent_cron_last_checked_at: checkedAt,
      blog_agent_cron_last_reason: schedule.reason,
      blog_agent_cron_last_schedule: JSON.stringify({
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

    const result = await runBlogAgentDraft({
      origin: request.nextUrl.origin,
      source: 'vercel-cron-blog-agent',
    })

    await saveCronState(supabase, {
      blog_agent_cron_last_reason: 'ran',
      blog_agent_cron_last_run_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      skipped: false,
      schedule,
      result,
    })
  } catch (error: any) {
    await saveCronState(supabase, {
      blog_agent_cron_last_reason: 'error',
      blog_agent_cron_last_error: String(error?.message || error).slice(0, 500),
      blog_agent_cron_last_error_at: new Date().toISOString(),
    })

    return NextResponse.json(
      { success: false, error: error?.message || String(error) },
      { status: 500 }
    )
  }
}
