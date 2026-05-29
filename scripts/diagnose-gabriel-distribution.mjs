import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local', quiet: true })
dotenv.config({ quiet: true })

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
  'email_agent_enabled',
  'email_agent_autopilot',
  'email_agent_require_approval',
  'email_agent_send_interval_minutes',
  'email_agent_daily_limit',
  'email_agent_min_hours_between_lead_messages',
  'email_agent_allowed_start_time',
  'email_agent_allowed_end_time',
  'email_agent_default_audience',
  'editorial_distribution_email_enabled',
  'editorial_distribution_whatsapp_enabled',
  'editorial_distribution_push_enabled',
  'editorial_distribution_whatsapp_interval_minutes',
  'editorial_distribution_whatsapp_daily_limit',
  'editorial_distribution_push_interval_minutes',
  'editorial_distribution_push_daily_limit',
  'editorial_distribution_cron_last_checked_at',
  'editorial_distribution_cron_last_reason',
  'editorial_distribution_cron_last_run_at',
  'editorial_distribution_cron_last_result',
  'editorial_distribution_cron_last_error',
  'editorial_distribution_cron_last_error_at',
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

function groupBy(rows, keyFn) {
  const map = new Map()
  for (const row of rows) {
    const key = keyFn(row)
    map.set(key, [...(map.get(key) || []), row])
  }
  return map
}

function summarizeRows(rows) {
  const byStatus = {}
  const byChannel = {}
  for (const row of rows) {
    byStatus[row.status] = (byStatus[row.status] || 0) + 1
    const channel = channelFromContext(metadataRecord(row.context))
    byChannel[channel] = byChannel[channel] || {}
    byChannel[channel][row.status] = (byChannel[channel][row.status] || 0) + 1
  }
  return { total: rows.length, byStatus, byChannel }
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

function isWithinConfiguredWindow(value, config) {
  if (!value) return false
  const start = timeToMinutes(config.email_agent_allowed_start_time || '09:00', '09:00')
  const end = timeToMinutes(config.email_agent_allowed_end_time || '18:00', '18:00')
  const minute = saoPauloMinuteOfDay(value)
  return start <= end ? minute >= start && minute <= end : minute >= start || minute <= end
}

function isoOrNull(value) {
  return value ? new Date(value).toISOString() : null
}

function isNewsPost(post) {
  const category = String(post.category || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const generatedBy = String(post.generated_by || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const tags = Array.isArray(post.tags) ? post.tags.map(tag => String(tag || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()) : []
  return generatedBy.includes('news') || category.includes('noticia') || tags.some(tag => tag.includes('noticia'))
}

const [{ data: configRows, error: configError }, { data: runs, error: runsError }, { data: posts, error: postsError }, { data: leads, error: leadsError }] = await Promise.all([
  supabase.from('app_config').select('key,value').in('key', configKeys),
  supabase
    .from('agent_workflow_runs')
    .select('id,status,trigger_type,scheduled_for,created_at,updated_at,completed_at,error_message,lead_id,lead_phone,lead_name,context')
    .in('trigger_type', triggers)
    .order('created_at', { ascending: false })
    .limit(5000),
  supabase
    .from('blog_posts')
    .select('id,title,slug,status,category,tags,generated_by,published_at,created_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(30),
  supabase
    .from('leads')
    .select('id,name,email,phone,phone_e164,visitor_id,push_subscribed,push_subscribed_lead,funnel_stage,acquired_via,metadata,updated_at')
    .order('updated_at', { ascending: false })
    .limit(5000),
])

if (configError) throw configError
if (runsError) throw runsError
if (postsError) throw postsError
if (leadsError) throw leadsError

const config = Object.fromEntries((configRows || []).map(row => [row.key, row.value]))
const editorialRuns = (runs || []).filter(row => metadataRecord(row.context).type === 'editorial_distribution')
const now = new Date()
const dueQueued = editorialRuns.filter(row => row.status === 'queued' && row.scheduled_for && new Date(row.scheduled_for) <= now)
const futureQueued = editorialRuns.filter(row => row.status === 'queued' && row.scheduled_for && new Date(row.scheduled_for) > now)
const failed = editorialRuns.filter(row => row.status === 'failed')
const waiting = editorialRuns.filter(row => row.status === 'waiting')
const sent = editorialRuns.filter(row => row.status === 'sent')

const campaigns = []
for (const [campaignId, rows] of groupBy(editorialRuns, row => metadataRecord(row.context).campaign_id || 'missing').entries()) {
  const firstContext = metadataRecord(rows[0]?.context)
  campaigns.push({
    campaign_id: campaignId,
    post_title: firstContext.post_title || 'Conteudo editorial',
    content_type: firstContext.content_type || null,
    trigger: firstContext.trigger || rows[0]?.trigger_type || null,
    created_at: rows.map(row => row.created_at).sort()[0] || null,
    next_scheduled_for: rows.filter(row => row.status === 'queued').map(row => row.scheduled_for).filter(Boolean).sort()[0] || null,
    last_completed_at: rows.map(row => row.completed_at).filter(Boolean).sort().at(-1) || null,
    ...summarizeRows(rows),
  })
}

campaigns.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))

const recentPosts = (posts || []).map(post => {
  const trigger = isNewsPost(post) ? 'news_published' : 'blog_published'
  const campaignId = `editorial:${trigger}:${post.id}`
  const rows = editorialRuns.filter(row => metadataRecord(row.context).campaign_id === campaignId)
  return {
    id: post.id,
    title: post.title,
    type: isNewsPost(post) ? 'news' : 'blog',
    published_at: post.published_at || post.created_at,
    campaign_id: campaignId,
    distribution: summarizeRows(rows),
  }
})

const activeLeadRows = (leads || []).filter(lead => {
  const metadata = metadataRecord(lead.metadata)
  const stage = String(lead.funnel_stage || '').toLowerCase()
  if (metadata.unsubscribed === true || metadata.email_unsubscribed === true || metadata.content_unsubscribed === true) return false
  if (String(metadata.status || '').toLowerCase() === 'lost') return false
  if (stage === 'lost') return false
  return stage !== 'visitor'
})

const audience = {
  loaded_leads: leads?.length || 0,
  active_leads_estimate: activeLeadRows.length,
  active_with_email: activeLeadRows.filter(lead => Boolean(lead.email)).length,
  active_with_phone: activeLeadRows.filter(lead => Boolean(lead.phone_e164 || lead.phone)).length,
  active_with_push_flags: activeLeadRows.filter(lead => {
    const metadata = metadataRecord(lead.metadata)
    return Boolean((lead.visitor_id || metadata.visitor_id) && (lead.push_subscribed === true || lead.push_subscribed_lead === true || metadata.push_subscribed_at))
  }).length,
}

const byDay = {}
for (const row of sent) {
  const day = row.completed_at ? row.completed_at.slice(0, 10) : 'unknown'
  const channel = channelFromContext(metadataRecord(row.context))
  byDay[day] = byDay[day] || { email: 0, whatsapp: 0, push: 0, total: 0 }
  byDay[day][channel] = (byDay[day][channel] || 0) + 1
  byDay[day].total += 1
}

const failedSamples = failed.slice(0, 15).map(row => ({
  id: row.id,
  channel: channelFromContext(metadataRecord(row.context)),
  campaign_id: metadataRecord(row.context).campaign_id,
  post_title: metadataRecord(row.context).post_title,
  lead: row.lead_name || row.lead_phone || metadataRecord(row.context).target_email,
  error_message: row.error_message,
  scheduled_for: isoOrNull(row.scheduled_for),
  completed_at: isoOrNull(row.completed_at),
}))

const dueSamples = dueQueued.slice(0, 20).map(row => ({
  id: row.id,
  channel: channelFromContext(metadataRecord(row.context)),
  campaign_id: metadataRecord(row.context).campaign_id,
  post_title: metadataRecord(row.context).post_title,
  lead: row.lead_name || row.lead_phone || metadataRecord(row.context).target_email,
  scheduled_for: isoOrNull(row.scheduled_for),
  cooldown_reason: metadataRecord(row.context).cooldown_reason || null,
  next_allowed_for_lead: metadataRecord(row.context).next_allowed_for_lead || null,
}))

const queuedWindowSummary = {
  inside_window: editorialRuns.filter(row => row.status === 'queued' && isWithinConfiguredWindow(row.scheduled_for, config)).length,
  outside_window: editorialRuns.filter(row => row.status === 'queued' && row.scheduled_for && !isWithinConfiguredWindow(row.scheduled_for, config)).length,
  missing_schedule: editorialRuns.filter(row => row.status === 'queued' && !row.scheduled_for).length,
  cooldown_rescheduled: editorialRuns.filter(row => row.status === 'queued' && metadataRecord(row.context).cooldown_reason).length,
}

console.log(JSON.stringify({
  generated_at: new Date().toISOString(),
  config,
  audience,
  global_summary: summarizeRows(editorialRuns),
  queued: {
    due_now: dueQueued.length,
    future: futureQueued.length,
    waiting: waiting.length,
    window: queuedWindowSummary,
  },
  sent_by_utc_day: byDay,
  campaigns: campaigns.slice(0, 20),
  recent_posts: recentPosts.slice(0, 12),
  due_samples: dueSamples,
  failed_samples: failedSamples,
}, null, 2))
