import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local', quiet: true })
dotenv.config({ quiet: true })

const apply = process.argv.includes('--apply')
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE

if (!supabaseUrl || !serviceKey) {
  throw new Error('Supabase env ausente. Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
})

const triggers = ['blog_published', 'news_published', 'property_recommendation']
const configKeys = [
  'email_agent_allowed_start_time',
  'email_agent_allowed_end_time',
  'email_agent_send_interval_minutes',
  'editorial_distribution_whatsapp_interval_minutes',
  'editorial_distribution_push_interval_minutes',
]

function metadataRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function channelFromContext(context) {
  if (context.channel === 'email') return 'email'
  if (context.channel === 'whatsapp') return 'whatsapp'
  if (context.channel === 'push') return 'push'
  return 'unknown'
}

function normalizePositiveInt(value, fallback, min = 1, max = 1440) {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

function timeToMinutes(value = '', fallback = '09:00') {
  const raw = /^\d{2}:\d{2}$/.test(value) ? value : fallback
  const [hour, minute] = raw.split(':').map(part => Number(part))
  return Math.max(0, Math.min(1439, hour * 60 + minute))
}

function saoPauloMinuteOfDay(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(value))
  const hour = Number(parts.find(part => part.type === 'hour')?.value || 0)
  const minute = Number(parts.find(part => part.type === 'minute')?.value || 0)
  return hour * 60 + minute
}

function isWithinWindow(config, date = new Date()) {
  const start = timeToMinutes(config.allowedStartTime, '09:00')
  const end = timeToMinutes(config.allowedEndTime, '18:00')
  const minute = saoPauloMinuteOfDay(date)
  return start <= end ? minute >= start && minute <= end : minute >= start || minute <= end
}

function nextWindowStart(config, date = new Date()) {
  if (isWithinWindow(config, date)) return date
  const start = timeToMinutes(config.allowedStartTime, '09:00')
  const minuteOfDay = saoPauloMinuteOfDay(date)
  const deltaMinutes = minuteOfDay < start ? start - minuteOfDay : (24 * 60 - minuteOfDay) + start
  return new Date(date.getTime() + deltaMinutes * 60_000)
}

function nextScheduleForChannel(config, base, index, intervalMinutes) {
  let cursor = nextWindowStart(config, base)
  for (let step = 0; step < index; step += 1) {
    const candidate = new Date(cursor.getTime() + intervalMinutes * 60_000)
    cursor = isWithinWindow(config, candidate) ? candidate : nextWindowStart(config, candidate)
  }
  return cursor.toISOString()
}

function groupBy(rows, keyFn) {
  const groups = new Map()
  for (const row of rows) {
    const key = keyFn(row)
    groups.set(key, [...(groups.get(key) || []), row])
  }
  return groups
}

const [{ data: configRows, error: configError }, { data: queuedRows, error: rowsError }] = await Promise.all([
  supabase.from('app_config').select('key,value').in('key', configKeys),
  supabase
    .from('agent_workflow_runs')
    .select('id,status,trigger_type,scheduled_for,created_at,context')
    .in('trigger_type', triggers)
    .eq('status', 'queued')
    .order('scheduled_for', { ascending: true })
    .limit(5000),
])

if (configError) throw configError
if (rowsError) throw rowsError

const configMap = Object.fromEntries((configRows || []).map(row => [row.key, row.value]))
const config = {
  allowedStartTime: configMap.email_agent_allowed_start_time || '09:00',
  allowedEndTime: configMap.email_agent_allowed_end_time || '18:00',
}
const intervals = {
  email: normalizePositiveInt(configMap.email_agent_send_interval_minutes, 5),
  whatsapp: normalizePositiveInt(configMap.editorial_distribution_whatsapp_interval_minutes || configMap.email_agent_send_interval_minutes, 5),
  push: normalizePositiveInt(configMap.editorial_distribution_push_interval_minutes || configMap.email_agent_send_interval_minutes, 5),
  unknown: 5,
}

const candidates = (queuedRows || [])
  .filter(row => metadataRecord(row.context).type === 'editorial_distribution')
  .filter(row => row.scheduled_for && !isWithinWindow(config, row.scheduled_for))

const updates = []

for (const [, rows] of groupBy(candidates, row => {
  const context = metadataRecord(row.context)
  return `${context.campaign_id || 'missing'}|${channelFromContext(context)}`
}).entries()) {
  const ordered = [...rows].sort((a, b) => {
    const bySchedule = new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime()
    if (bySchedule) return bySchedule
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
  const first = ordered[0]
  const channel = channelFromContext(metadataRecord(first.context))
  const base = nextWindowStart(config, new Date(first.scheduled_for))

  ordered.forEach((row, index) => {
    const scheduledFor = nextScheduleForChannel(config, base, index, intervals[channel] || 5)
    if (scheduledFor !== new Date(row.scheduled_for).toISOString()) {
      updates.push({
        id: row.id,
        channel,
        campaign_id: metadataRecord(row.context).campaign_id,
        old_scheduled_for: new Date(row.scheduled_for).toISOString(),
        new_scheduled_for: scheduledFor,
        context: {
          ...metadataRecord(row.context),
          schedule_repaired_at: new Date().toISOString(),
          schedule_repair_reason: 'outside_allowed_window',
          previous_scheduled_for: new Date(row.scheduled_for).toISOString(),
        },
      })
    }
  })
}

console.log(JSON.stringify({
  mode: apply ? 'apply' : 'dry-run',
  checked: queuedRows?.length || 0,
  outside_window: candidates.length,
  updates: updates.map(({ context, ...item }) => item),
}, null, 2))

if (apply) {
  for (const update of updates) {
    const { error } = await supabase
      .from('agent_workflow_runs')
      .update({
        scheduled_for: update.new_scheduled_for,
        context: update.context,
      })
      .eq('id', update.id)

    if (error) throw error
  }
  console.log(`Applied ${updates.length} queue schedule repair(s).`)
}
