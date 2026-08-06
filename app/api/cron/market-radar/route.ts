import { NextRequest, NextResponse } from 'next/server'
import { saveAppConfig } from '@/lib/admin/app-config'
import { getAiAutomationGate } from '@/lib/ai/automation-control'
import { collectMarketRadarData } from '@/lib/ai/pilger-ceo'
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
    sun: '0',
    mon: '1',
    tue: '2',
    wed: '3',
    thu: '4',
    fri: '5',
    sat: '6',
    dom: '0',
    seg: '1',
    ter: '2',
    qua: '3',
    qui: '4',
    sex: '5',
    sab: '6',
    'sáb': '6',
  }

  return {
    dayOfWeek: weekdayMap[weekdayLabel.slice(0, 3)] || '0',
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
      .in('key', ['radar_ai_enabled', 'radar_collection_times', 'radar_collection_days'])

    const config = Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))
    const aiGate = await getAiAutomationGate({
      supabase,
      agentId: 'market-radar',
      enabledKey: 'radar_ai_enabled',
    })
    const targetHours = (config.radar_collection_times || '06,12,18')
      .split(',')
      .map((hour: string) => hour.trim().padStart(2, '0'))
      .filter(Boolean)
    const targetDays = (config.radar_collection_days || '0,1,2,3,4,5,6')
      .split(',')
      .map((day: string) => day.trim())
      .filter(Boolean)
    const now = getCurrentTimeSP()
    const scheduleMatched = targetHours.includes(now.hour) && targetDays.includes(now.dayOfWeek)
    const shouldRun = aiGate.allowed && (force || scheduleMatched)
    const reason = !aiGate.allowed ? aiGate.reason : shouldRun ? 'ready' : 'schedule_not_matched'

    await saveCronState(supabase, {
      market_radar_cron_last_checked_at: checkedAt,
      market_radar_cron_last_reason: reason,
      market_radar_cron_last_schedule: JSON.stringify({
        day: now.dayOfWeek,
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
        schedule: { now, targetDays, targetHours },
      })
    }

    const result = await collectMarketRadarData(now.hour)
    await saveCronState(supabase, {
      market_radar_cron_last_reason: 'ran',
      market_radar_cron_last_run_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      skipped: false,
      ai_gate: aiGate,
      schedule: { now, targetDays, targetHours },
      collected: result.length,
    })
  } catch (error: any) {
    await saveCronState(supabase, {
      market_radar_cron_last_reason: 'error',
      market_radar_cron_last_error: String(error?.message || error).slice(0, 500),
      market_radar_cron_last_error_at: new Date().toISOString(),
    })

    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 })
  }
}
