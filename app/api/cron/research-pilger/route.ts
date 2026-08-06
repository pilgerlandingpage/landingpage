import { NextRequest, NextResponse } from 'next/server'
import { saveAppConfig } from '@/lib/admin/app-config'
import { getAiAutomationGate } from '@/lib/ai/automation-control'
import { runScheduledResearchTopics } from '@/lib/research/pilger'
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
    'sáb': 'sat',
  }

  return {
    dayKey: weekdayMap[weekdayLabel.slice(0, 3)] || 'sun',
    hour,
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
      .in('key', ['research_pilger_enabled', 'research_pilger_schedule_enabled', 'research_pilger_run_times', 'research_pilger_weekdays'])

    const config = Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))
    const aiGate = await getAiAutomationGate({
      supabase,
      agentId: 'research-pilger',
      enabledKey: 'research_pilger_enabled',
    })
    const targetHours = (config.research_pilger_run_times || '09,15')
      .split(',')
      .map((hour: string) => hour.trim().padStart(2, '0'))
      .filter(Boolean)
    const targetDays = (config.research_pilger_weekdays || 'mon,wed,fri')
      .split(',')
      .map((day: string) => day.trim())
      .filter(Boolean)
    const now = getCurrentTimeSP()
    const enabled = aiGate.enabled && config.research_pilger_schedule_enabled !== 'false'
    const shouldRun = aiGate.allowed && (force || (enabled && targetHours.includes(now.hour) && targetDays.includes(now.dayKey)))
    const reason = !aiGate.allowed ? aiGate.reason : !enabled ? 'schedule_disabled' : shouldRun ? 'ready' : 'schedule_not_matched'

    await saveCronState(supabase, {
      research_pilger_cron_last_checked_at: checkedAt,
      research_pilger_cron_last_reason: reason,
      research_pilger_cron_last_schedule: JSON.stringify({
        day: now.dayKey,
        hour: now.hour,
        target_days: targetDays,
        target_hours: targetHours,
      }),
    })

    if (!shouldRun) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason,
        ai_gate: aiGate,
        schedule: { enabled, now, targetDays, targetHours },
      })
    }

    const result = await runScheduledResearchTopics({ slot: now.hour })
    await saveCronState(supabase, {
      research_pilger_cron_last_reason: 'ran',
      research_pilger_cron_last_run_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      skipped: false,
      ai_gate: aiGate,
      schedule: { enabled, now, targetDays, targetHours },
      result,
    })
  } catch (error: any) {
    await saveCronState(supabase, {
      research_pilger_cron_last_reason: 'error',
      research_pilger_cron_last_error: String(error?.message || error).slice(0, 500),
      research_pilger_cron_last_error_at: new Date().toISOString(),
    })

    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 })
  }
}
