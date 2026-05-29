import { NextRequest, NextResponse } from 'next/server'
import {
  getAgentWatchdogSchedules,
  isWatchdogAgentId,
  runDueWatchdogAgent,
} from '@/lib/admin/agent-watchdog'
import { saveAppConfig } from '@/lib/admin/app-config'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function saveCronState(supabase: ReturnType<typeof createAdminClient>, values: Record<string, string>) {
  await Promise.all(
    Object.entries(values).map(([key, value]) => saveAppConfig(supabase, key, value).catch(() => {})),
  )
}

function summarizeSchedule(schedule: Awaited<ReturnType<typeof getAgentWatchdogSchedules>>[number]) {
  return {
    id: schedule.id,
    enabled: schedule.enabled,
    should_run: schedule.shouldRun,
    reason: schedule.reason,
    interval: schedule.interval,
    unit: schedule.unit,
    elapsed: schedule.elapsed,
    last_run_at: schedule.lastRunAt,
    last_started_at: schedule.lastStartedAt,
    extra: schedule.extra,
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const checkedAt = new Date().toISOString()
  const agentParam = request.nextUrl.searchParams.get('agent') || ''
  const agentId = isWatchdogAgentId(agentParam) ? agentParam : null
  const force = request.nextUrl.searchParams.get('force') === 'true'

  try {
    const initialSchedules = await getAgentWatchdogSchedules(supabase)
    const cronState: Record<string, string> = {
      agent_watchdog_cron_last_checked_at: checkedAt,
      agent_watchdog_cron_last_reason: initialSchedules.some(schedule => schedule.shouldRun) ? 'agent_due' : 'no_agent_due',
      agent_watchdog_cron_last_schedule: JSON.stringify(initialSchedules.map(summarizeSchedule)),
    }

    for (const schedule of initialSchedules) {
      cronState[`${schedule.id}_cron_last_checked_at`] = checkedAt
      cronState[`${schedule.id}_cron_last_reason`] = schedule.reason
      cronState[`${schedule.id}_cron_last_schedule`] = JSON.stringify(summarizeSchedule(schedule))
    }

    await saveCronState(supabase, cronState)

    const result = await runDueWatchdogAgent(supabase, { agentId, force })
    const selectedId = result.selected?.id

    if (result.skipped) {
      if (selectedId) {
        await saveCronState(supabase, {
          [`${selectedId}_cron_last_reason`]: result.reason || 'skipped',
        })
      }

      return NextResponse.json({
        success: true,
        skipped: true,
        reason: result.reason,
        selected: result.selected || null,
        schedules: result.schedules,
      })
    }

    if (result.failed) {
      if (selectedId) {
        await saveCronState(supabase, {
          agent_watchdog_cron_last_reason: `failed_${selectedId}`,
          agent_watchdog_cron_last_error: result.error.slice(0, 500),
          agent_watchdog_cron_last_error_at: new Date().toISOString(),
          [`${selectedId}_cron_last_reason`]: 'failed',
          [`${selectedId}_cron_last_error`]: result.error.slice(0, 500),
          [`${selectedId}_cron_last_error_at`]: new Date().toISOString(),
        })
      }

      return NextResponse.json({
        success: true,
        skipped: false,
        failed: true,
        selected: result.selected,
        error: result.error,
        schedules: result.schedules,
      })
    }

    if (selectedId) {
      await saveCronState(supabase, {
        agent_watchdog_cron_last_reason: `ran_${selectedId}`,
        agent_watchdog_cron_last_run_at: new Date().toISOString(),
        [`${selectedId}_cron_last_reason`]: 'ran',
        [`${selectedId}_cron_last_run_at`]: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      success: true,
      skipped: false,
      selected: result.selected,
      result: result.result,
      schedules: result.schedules,
    })
  } catch (error: any) {
    await saveCronState(supabase, {
      agent_watchdog_cron_last_reason: 'error',
      agent_watchdog_cron_last_error: String(error?.message || error).slice(0, 500),
      agent_watchdog_cron_last_error_at: new Date().toISOString(),
    })

    return NextResponse.json(
      { success: false, error: error?.message || String(error) },
      { status: 500 },
    )
  }
}
