import { markAgentCompleted, markAgentFailed, markAgentStarted } from '@/lib/admin/app-config'
import { generatePaidMarketingReport } from '@/lib/ads/paid-report-agent'
import { runEcosystemSnapshotCycle } from '@/lib/intelligence/ecosystem'
import { publishDueScheduledPosts } from '@/lib/social/meta-publisher'
import { syncFacebookOrganic } from '@/lib/social/facebook'
import { syncInstagramOrganic } from '@/lib/social/instagram'
import { generateOrganicMarketingReport } from '@/lib/social/organic-report-agent'

type SupabaseAdminLike = {
  from: (table: string) => any
}

type ScheduleUnit = 'minutes' | 'hours'

export type WatchdogAgentId =
  | 'organic_social_sync'
  | 'organic_report_agent'
  | 'paid_report_agent'
  | 'marketing_publisher'
  | 'ecosystem_intelligence'

type WatchdogDefinition = {
  id: WatchdogAgentId
  label: string
  enabledKey: string
  intervalKey: string
  unit: ScheduleUnit
  defaultInterval: number
  minInterval: number
  maxInterval: number
  lockMinutes: number
  extraKeys?: string[]
  run: (schedule: WatchdogSchedule, supabase: SupabaseAdminLike) => Promise<unknown>
}

export type WatchdogSchedule = {
  id: WatchdogAgentId
  label: string
  enabled: boolean
  shouldRun: boolean
  reason: string
  interval: number
  unit: ScheduleUnit
  elapsed: number | null
  lastRunAt: string | null
  lastStartedAt: string | null
  extra: Record<string, string>
}

function parseConfigDate(value?: string | null) {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

function parseNumber(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function intervalToMs(interval: number, unit: ScheduleUnit) {
  return interval * (unit === 'hours' ? 3600000 : 60000)
}

async function readConfig(supabase: SupabaseAdminLike, keys: string[]) {
  const { data, error } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', keys)

  if (error) throw new Error(`Erro ao ler configuracao dos agentes: ${error.message}`)

  return Object.fromEntries(
    (data || []).map((row: { key: string; value: string | null }) => [row.key, String(row.value || '')]),
  ) as Record<string, string>
}

function summarizeOrganicSync(instagram: any, facebook: any) {
  return {
    instagram: {
      profile: instagram?.profile?.username || instagram?.profile?.display_name || null,
      media_synced: instagram?.media?.length || 0,
      reels_synced: instagram?.reels?.length || 0,
    },
    facebook: {
      profile: facebook?.profile?.display_name || facebook?.profile?.username || null,
      media_synced: facebook?.media?.length || 0,
      warning: facebook?.warning || null,
    },
  }
}

const definitions: WatchdogDefinition[] = [
  {
    id: 'organic_social_sync',
    label: 'Organic Social Sync',
    enabledKey: 'organic_social_sync_enabled',
    intervalKey: 'organic_social_sync_interval_minutes',
    unit: 'minutes',
    defaultInterval: 120,
    minInterval: 30,
    maxInterval: 1440,
    lockMinutes: 45,
    extraKeys: ['organic_social_sync_limit'],
    run: async schedule => {
      const limit = parseNumber(schedule.extra.organic_social_sync_limit, 12, 3, 50)
      const [instagram, facebook] = await Promise.all([
        syncInstagramOrganic(limit),
        syncFacebookOrganic(limit),
      ])

      return {
        ...summarizeOrganicSync(instagram, facebook),
        limit,
      }
    },
  },
  {
    id: 'organic_report_agent',
    label: 'Organic Report Agent',
    enabledKey: 'organic_report_agent_enabled',
    intervalKey: 'organic_report_agent_interval_hours',
    unit: 'hours',
    defaultInterval: 24,
    minInterval: 6,
    maxInterval: 168,
    lockMinutes: 90,
    run: async () => {
      const result = await generateOrganicMarketingReport({ days: 30 })
      return {
        report_id: result.report?.id,
        title: result.report?.title,
      }
    },
  },
  {
    id: 'paid_report_agent',
    label: 'Paid Report Agent',
    enabledKey: 'paid_report_agent_enabled',
    intervalKey: 'paid_report_agent_interval_hours',
    unit: 'hours',
    defaultInterval: 24,
    minInterval: 6,
    maxInterval: 168,
    lockMinutes: 90,
    run: async () => {
      const result = await generatePaidMarketingReport({ days: 30 })
      return {
        report_id: result.report?.id,
        title: result.report?.title,
      }
    },
  },
  {
    id: 'marketing_publisher',
    label: 'Marketing Publisher',
    enabledKey: 'marketing_publisher_agent_enabled',
    intervalKey: 'marketing_publisher_interval_minutes',
    unit: 'minutes',
    defaultInterval: 10,
    minInterval: 5,
    maxInterval: 1440,
    lockMinutes: 20,
    extraKeys: ['marketing_publisher_autopilot'],
    run: async schedule => {
      const autopilot = schedule.extra.marketing_publisher_autopilot === 'true'
      return publishDueScheduledPosts({ limit: 10, dryRun: !autopilot })
    },
  },
  {
    id: 'ecosystem_intelligence',
    label: 'Ecosystem Intelligence',
    enabledKey: 'ecosystem_intelligence_enabled',
    intervalKey: 'ecosystem_intelligence_interval_hours',
    unit: 'hours',
    defaultInterval: 6,
    minInterval: 1,
    maxInterval: 168,
    lockMinutes: 90,
    extraKeys: ['ecosystem_intelligence_snapshot_days'],
    run: async (schedule, supabase) => {
      const days = parseNumber(schedule.extra.ecosystem_intelligence_snapshot_days, 30, 7, 180)
      return runEcosystemSnapshotCycle({
        supabase: supabase as any,
        days,
        createdBy: 'vercel-cron-ecosystem-intelligence',
      })
    },
  },
]

export function isWatchdogAgentId(value: string): value is WatchdogAgentId {
  return definitions.some(definition => definition.id === value)
}

async function getWatchdogSchedule(supabase: SupabaseAdminLike, definition: WatchdogDefinition): Promise<WatchdogSchedule> {
  const keys = [
    definition.enabledKey,
    definition.intervalKey,
    `${definition.id}_last_run_at`,
    `${definition.id}_last_started_at`,
    ...(definition.extraKeys || []),
  ]
  const config = await readConfig(supabase, keys)
  const enabled = config[definition.enabledKey] !== 'false'
  const interval = parseNumber(config[definition.intervalKey], definition.defaultInterval, definition.minInterval, definition.maxInterval)
  const lastRunAt = config[`${definition.id}_last_run_at`] || null
  const lastStartedAt = config[`${definition.id}_last_started_at`] || null
  const lastRunMs = parseConfigDate(lastRunAt)
  const lastStartedMs = parseConfigDate(lastStartedAt)
  const nowMs = Date.now()
  const hasRecentStart = Boolean(
    lastStartedMs
    && (!lastRunMs || lastStartedMs > lastRunMs)
    && nowMs - lastStartedMs < definition.lockMinutes * 60000,
  )
  const elapsed = lastRunMs
    ? Math.floor((nowMs - lastRunMs) / (definition.unit === 'hours' ? 3600000 : 60000))
    : null

  let reason = 'ready'
  if (!enabled) reason = `${definition.id}_disabled`
  else if (hasRecentStart) reason = 'already_running'
  else if (lastRunMs && nowMs - lastRunMs < intervalToMs(interval, definition.unit)) reason = 'interval_not_reached'

  const extra = Object.fromEntries(
    (definition.extraKeys || []).map(key => [key, config[key] || '']),
  )

  return {
    id: definition.id,
    label: definition.label,
    enabled,
    shouldRun: enabled && reason === 'ready',
    reason,
    interval,
    unit: definition.unit,
    elapsed,
    lastRunAt,
    lastStartedAt,
    extra,
  }
}

export async function getAgentWatchdogSchedules(supabase: SupabaseAdminLike) {
  return Promise.all(definitions.map(definition => getWatchdogSchedule(supabase, definition)))
}

export async function runDueWatchdogAgent(
  supabase: SupabaseAdminLike,
  options: { agentId?: WatchdogAgentId | null; force?: boolean } = {},
) {
  const schedules = await getAgentWatchdogSchedules(supabase)
  const targetSchedule = options.agentId
    ? schedules.find(schedule => schedule.id === options.agentId) || null
    : schedules.find(schedule => schedule.shouldRun) || null

  if (!targetSchedule) {
    return {
      skipped: true,
      reason: options.agentId ? 'unknown_agent' : 'no_agent_due',
      schedules,
    }
  }

  if (!targetSchedule.enabled) {
    return {
      skipped: true,
      reason: targetSchedule.reason,
      selected: targetSchedule,
      schedules,
    }
  }

  if (!options.force && !targetSchedule.shouldRun) {
    return {
      skipped: true,
      reason: targetSchedule.reason,
      selected: targetSchedule,
      schedules,
    }
  }

  const definition = definitions.find(item => item.id === targetSchedule.id)
  if (!definition) {
    return {
      skipped: true,
      reason: 'missing_definition',
      selected: targetSchedule,
      schedules,
    }
  }

  await markAgentStarted(supabase, targetSchedule.id)

  try {
    const result = await definition.run(targetSchedule, supabase)
    await markAgentCompleted(supabase, targetSchedule.id, {
      source: 'vercel_cron_agent_watchdog',
      interval: targetSchedule.interval,
      unit: targetSchedule.unit,
      result,
    })

    return {
      skipped: false,
      selected: targetSchedule,
      result,
      schedules,
    }
  } catch (error) {
    await markAgentFailed(supabase, targetSchedule.id, error).catch(() => {})
    const message = error instanceof Error ? error.message : String(error || 'Erro desconhecido')
    return {
      skipped: false,
      failed: true,
      selected: targetSchedule,
      error: message,
      schedules,
    }
  }
}
