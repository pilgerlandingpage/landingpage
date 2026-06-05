import { NextRequest, NextResponse } from 'next/server'
import { saveAppConfig } from '@/lib/admin/app-config'
import { getPublicAppUrl } from '@/lib/app-url'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 800

function getCurrentTimeSP() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())

  const weekdayLabel = String(parts.find(part => part.type === 'weekday')?.value || '').toLowerCase()
  const hour = String(parts.find(part => part.type === 'hour')?.value || '00').padStart(2, '0')
  const weekdayMap: Record<string, string> = {
    sun: 'sun',
    mon: 'mon',
    tue: 'tue',
    wed: 'wed',
    thu: 'thu',
    fri: 'fri',
    sat: 'sat',
    dom: 'sun',
    seg: 'mon',
    ter: 'tue',
    qua: 'wed',
    qui: 'thu',
    sex: 'fri',
    sab: 'sat',
    'sÃ¡b': 'sat',
  }

  return {
    dayKey: weekdayMap[weekdayLabel.slice(0, 3)] || 'sun',
    hour,
  }
}

function getDateSP(value: string | Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

function parseRuns(value: string) {
  try {
    const parsed = JSON.parse(String(value || '[]'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function saveCronState(supabase: ReturnType<typeof createAdminClient>, values: Record<string, string>) {
  await Promise.all(
    Object.entries(values).map(([key, value]) => saveAppConfig(supabase, key, value).catch(() => {})),
  )
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const checkedAt = new Date().toISOString()
  const force = request.nextUrl.searchParams.get('force') === 'true'

  try {
    const { data } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', [
        'benchmark_editorial_enabled',
        'benchmark_editorial_schedule_enabled',
        'benchmark_editorial_run_times',
        'benchmark_editorial_weekdays',
        'benchmark_editorial_depth',
        'benchmark_editorial_daily_limit',
        'benchmark_editorial_runs',
      ])

    const config = Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))
    const targetHours = (config.benchmark_editorial_run_times || '09,15')
      .split(',')
      .map((hour: string) => hour.trim().padStart(2, '0'))
      .filter(Boolean)
    const targetDays = (config.benchmark_editorial_weekdays || 'mon,tue,wed,thu,fri')
      .split(',')
      .map((day: string) => day.trim())
      .filter(Boolean)
    const now = getCurrentTimeSP()
    const enabled = config.benchmark_editorial_enabled !== 'false'
    const scheduleEnabled = config.benchmark_editorial_schedule_enabled !== 'false'
    const parsedDailyLimit = Number.parseInt(config.benchmark_editorial_daily_limit || '6', 10)
    const dailyLimit = Number.isFinite(parsedDailyLimit) ? Math.max(0, parsedDailyLimit) : 6
    const todayRuns = parseRuns(config.benchmark_editorial_runs)
      .filter((run: any) => run?.status === 'completed' && run?.created_at && getDateSP(run.created_at) === getDateSP())
      .length
    const limitReached = dailyLimit > 0 && todayRuns >= dailyLimit
    const scheduleMatched = enabled && scheduleEnabled && targetHours.includes(now.hour) && targetDays.includes(now.dayKey)
    const shouldRun = force || (scheduleMatched && !limitReached)
    const reason = force
      ? 'forced'
      : !enabled
        ? 'benchmark_disabled'
        : !scheduleEnabled
          ? 'schedule_disabled'
          : limitReached
            ? 'daily_limit_reached'
            : shouldRun
              ? 'ready'
              : 'schedule_not_matched'

    await saveCronState(supabase, {
      benchmark_editorial_cron_last_checked_at: checkedAt,
      benchmark_editorial_cron_last_reason: reason,
      benchmark_editorial_cron_last_schedule: JSON.stringify({
        day: now.dayKey,
        hour: now.hour,
        target_days: targetDays,
        target_hours: targetHours,
        daily_limit: dailyLimit,
        today_runs: todayRuns,
      }),
    })

    if (!shouldRun) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason,
        schedule: { enabled, scheduleEnabled, now, targetDays, targetHours, dailyLimit, todayRuns },
      })
    }

    const response = await fetch(`${getPublicAppUrl(request.nextUrl.origin)}/api/admin/benchmark-editorial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'run_benchmark',
        depth: config.benchmark_editorial_depth || 'media',
      }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result?.error || `Benchmark Editorial falhou (${response.status}).`)

    await saveCronState(supabase, {
      benchmark_editorial_cron_last_reason: 'ran',
      benchmark_editorial_cron_last_run_at: new Date().toISOString(),
      benchmark_editorial_last_opportunity_id: result?.opportunity?.id || '',
    })

    return NextResponse.json({
      success: true,
      skipped: false,
      schedule: { enabled, scheduleEnabled, now, targetDays, targetHours, dailyLimit, todayRuns },
      result,
    })
  } catch (error: any) {
    await saveCronState(supabase, {
      benchmark_editorial_cron_last_reason: 'error',
      benchmark_editorial_cron_last_error: String(error?.message || error).slice(0, 500),
      benchmark_editorial_cron_last_error_at: new Date().toISOString(),
    })

    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 })
  }
}
