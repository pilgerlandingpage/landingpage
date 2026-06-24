import { NextRequest, NextResponse } from 'next/server'
import { saveAppConfig } from '@/lib/admin/app-config'
import { sendVitorMonitoringAlert } from '@/lib/ads/whatsapp-alerts'
import { buildVitorMonitoringSnapshot, persistVitorMonitoringSnapshot } from '@/lib/ads/vitor-monitoring'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 800

async function saveCronState(supabase: ReturnType<typeof createAdminClient>, values: Record<string, string>) {
  await Promise.all(
    Object.entries(values).map(([key, value]) => saveAppConfig(supabase, key, value).catch(() => {})),
  )
}

function minutesSince(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY
  return (Date.now() - time) / 60000
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function hasImportantAlert(snapshot: Awaited<ReturnType<typeof buildVitorMonitoringSnapshot>>) {
  return snapshot.health.score < 65
    || snapshot.alerts.some(alert => ['critical', 'high'].includes(alert.severity))
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const checkedAt = new Date().toISOString()
  const force = request.nextUrl.searchParams.get('force') === 'true'
  const forceAlert = request.nextUrl.searchParams.get('alert') === 'true'

  await saveCronState(supabase, {
    vitor_monitoring_cron_last_checked_at: checkedAt,
    vitor_monitoring_cron_last_reason: 'processing',
  })

  try {
    const { data: configRows } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', [
        'vitor_monitoring_cron_enabled',
        'vitor_monitoring_cron_min_persist_minutes',
        'vitor_monitoring_cron_last_persisted_at',
      ])

    const config = Object.fromEntries((configRows || []).map((row: any) => [row.key, String(row.value || '')]))
    const enabled = config.vitor_monitoring_cron_enabled !== 'false'
    const minPersistMinutes = parsePositiveInt(config.vitor_monitoring_cron_min_persist_minutes, 360)

    if (!enabled && !force) {
      await saveCronState(supabase, {
        vitor_monitoring_cron_last_reason: 'disabled',
      })

      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'disabled',
      })
    }

    const snapshot = await buildVitorMonitoringSnapshot({ supabase, datePreset: 'last_7d' })
    const important = hasImportantAlert(snapshot)
    const elapsedMinutes = minutesSince(config.vitor_monitoring_cron_last_persisted_at)
    const shouldPersist = force || important || elapsedMinutes >= minPersistMinutes
    const reason = force
      ? 'forced'
      : important
        ? 'important_alert'
        : shouldPersist
          ? 'scheduled_persist'
          : 'checked_no_persist'

    let report: any = null
    if (shouldPersist) {
      report = await persistVitorMonitoringSnapshot({ supabase, snapshot })
    }

    const whatsappAlert = important || forceAlert
      ? await sendVitorMonitoringAlert(supabase, snapshot, {
        force: forceAlert,
        origin: request.headers.get('origin'),
      }).catch((error: any) => ({
        sent: 0,
        errors: 1,
        skipped: true,
        reason: error?.message || String(error),
      }))
      : { sent: 0, errors: 0, skipped: true, reason: 'no_important_alert' }

    await saveCronState(supabase, {
      vitor_monitoring_cron_last_reason: reason,
      vitor_monitoring_cron_last_health: String(snapshot.health.score),
      vitor_monitoring_cron_last_alerts: String(snapshot.alerts.length),
      vitor_monitoring_cron_last_learnings: String(snapshot.learnings.length),
      vitor_monitoring_cron_last_whatsapp_sent: String(whatsappAlert.sent || 0),
      vitor_monitoring_cron_last_whatsapp_errors: String(whatsappAlert.errors || 0),
      vitor_monitoring_cron_last_whatsapp_reason: String(whatsappAlert.reason || (whatsappAlert.skipped ? 'skipped' : 'sent')),
      vitor_monitoring_cron_last_result: JSON.stringify({
        generated_at: snapshot.generated_at,
        health: snapshot.health,
        metrics: snapshot.metrics,
        alerts: snapshot.alerts.slice(0, 6),
        learnings: snapshot.learnings.slice(0, 6),
        diagnostics: snapshot.diagnostics.slice(0, 6),
        persisted: Boolean(report?.id),
        report_id: report?.id || null,
        whatsapp_alert: whatsappAlert,
      }).slice(0, 3500),
      ...(report?.id ? {
        vitor_monitoring_cron_last_persisted_at: new Date().toISOString(),
        vitor_monitoring_cron_last_report_id: report.id,
      } : {}),
    })

    return NextResponse.json({
      success: true,
      skipped: false,
      persisted: Boolean(report?.id),
      reason,
      report,
      whatsapp_alert: whatsappAlert,
      monitoring: snapshot,
    })
  } catch (error: any) {
    await saveCronState(supabase, {
      vitor_monitoring_cron_last_reason: 'error',
      vitor_monitoring_cron_last_error: String(error?.message || error).slice(0, 500),
      vitor_monitoring_cron_last_error_at: new Date().toISOString(),
    })

    console.error('[Vitor Monitoring Cron] GET error:', error)
    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 })
  }
}
