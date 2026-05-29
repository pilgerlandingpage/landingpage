import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local', quiet: true })
dotenv.config({ quiet: true })

const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE
const origin = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://guilhermepilger.ai'

if (!supabaseUrl || !serviceKey) {
  throw new Error('Supabase env ausente. Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
})

const TIME_ZONE = 'America/Sao_Paulo'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TRIGGERS = ['blog_published', 'news_published']
const CONFIG_KEYS = [
  'email_agent_enabled',
  'email_agent_autopilot',
  'email_agent_require_approval',
  'email_agent_allowed_start_time',
  'email_agent_allowed_end_time',
  'email_agent_default_audience',
  'editorial_distribution_push_enabled',
  'editorial_distribution_push_interval_minutes',
  'editorial_distribution_push_templates',
]

const DEFAULT_PUSH_TEMPLATES = [
  {
    id: 'push-blog-editorial',
    name: 'Blog publicado',
    trigger: 'blog_published',
    audience: 'active_leads',
    title: 'Novo artigo para voce',
    body: '{nome}, separei uma leitura sobre {titulo_blog}. Toque para abrir.',
    ctaLabel: 'Ler artigo',
    status: 'active',
  },
  {
    id: 'push-news-editorial',
    name: 'Noticia publicada',
    trigger: 'news_published',
    audience: 'active_leads',
    title: 'Nova noticia no radar',
    body: '{nome}, saiu uma noticia sobre {titulo_noticia}. Toque para acompanhar.',
    ctaLabel: 'Ler noticia',
    status: 'active',
  },
]

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function metadataRecord(value) {
  return isRecord(value) ? value : {}
}

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeEmail(value) {
  const email = normalizeText(value).toLowerCase()
  return EMAIL_RE.test(email) ? email : ''
}

function normalizePhone(value) {
  return normalizeText(value).replace(/\D+/g, '')
}

function normalizePostText(value, max = 220) {
  return normalizeText(value).replace(/\s+/g, ' ').slice(0, max)
}

function normalizePositiveInt(value, fallback, min = 1, max = 10000) {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

function timeToMinutes(value, fallback) {
  const raw = /^\d{2}:\d{2}$/.test(value) ? value : fallback
  const [hour, minute] = raw.split(':').map(part => Number(part))
  return Math.max(0, Math.min(1439, hour * 60 + minute))
}

function getSaoPauloTimeParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const hour = Number(parts.find(part => part.type === 'hour')?.value || 0)
  const minute = Number(parts.find(part => part.type === 'minute')?.value || 0)
  return { hour, minute, minuteOfDay: hour * 60 + minute }
}

function isWithinWindow(config, date = new Date()) {
  const start = timeToMinutes(config.allowedStartTime, '09:00')
  const end = timeToMinutes(config.allowedEndTime, '18:00')
  const now = getSaoPauloTimeParts(date).minuteOfDay
  return start <= end ? now >= start && now <= end : now >= start || now <= end
}

function nextWindowStart(config, date = new Date()) {
  if (isWithinWindow(config, date)) return date
  const start = timeToMinutes(config.allowedStartTime, '09:00')
  const { minuteOfDay } = getSaoPauloTimeParts(date)
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

function renderTemplate(value, variables) {
  return String(value || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => variables[key] ?? `{${key}}`)
}

function parsePushTemplates(value) {
  try {
    const parsed = JSON.parse(String(value || '[]'))
    if (!Array.isArray(parsed)) return DEFAULT_PUSH_TEMPLATES
    const templates = parsed
      .map((item, index) => ({
        id: normalizeText(item?.id) || `push-template-${index + 1}`,
        name: normalizeText(item?.name) || `Template ${index + 1}`,
        trigger: normalizeText(item?.trigger) || 'custom',
        audience: normalizeText(item?.audience) || 'active_leads',
        title: normalizePostText(item?.title || 'Guilherme Pilger', 90),
        body: normalizePostText(item?.body || '{conteudo}', 220),
        ctaLabel: normalizeText(item?.ctaLabel || item?.cta_label || 'Abrir'),
        status: normalizeText(item?.status) || 'draft',
      }))
      .filter(item => item.title && item.body)
    const ids = new Set(templates.map(template => template.id))
    return [...templates, ...DEFAULT_PUSH_TEMPLATES.filter(template => !ids.has(template.id))]
  } catch {
    return DEFAULT_PUSH_TEMPLATES
  }
}

function pushTemplateForTrigger(config, trigger) {
  return (
    config.pushTemplates.find(template => template.status === 'active' && template.trigger === trigger && template.audience === config.audience) ||
    config.pushTemplates.find(template => template.status === 'active' && template.trigger === trigger) ||
    config.pushTemplates.find(template => template.trigger === trigger) ||
    null
  )
}

function isNewsPost(post) {
  const category = normalizeText(post.category).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const generatedBy = normalizeText(post.generated_by).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const tags = Array.isArray(post.tags)
    ? post.tags.map(tag => normalizeText(tag).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())
    : []
  return generatedBy.includes('news') || category.includes('noticia') || tags.some(tag => tag.includes('noticia'))
}

function contentTypeForPost(post) {
  return isNewsPost(post) ? 'news' : 'blog'
}

function triggerForPost(post) {
  return contentTypeForPost(post) === 'news' ? 'news_published' : 'blog_published'
}

function campaignIdForPost(post) {
  return `editorial:${triggerForPost(post)}:${post.id}`
}

function buildContentUrl(post, contentType) {
  const slug = normalizeText(post.slug)
  const path = contentType === 'news' ? '/noticias' : '/blog'
  return `${origin.replace(/\/$/, '')}${path}${slug ? `/${encodeURIComponent(slug)}` : ''}`
}

function addUtm(rawUrl, params) {
  try {
    const url = new URL(rawUrl)
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value)
    }
    return url.toString()
  } catch {
    return rawUrl
  }
}

function leadMatchesAudience(lead, audience) {
  const stage = normalizeText(lead.funnel_stage).toLowerCase()
  const acquiredVia = normalizeText(lead.acquired_via).toLowerCase()
  const metadata = metadataRecord(lead.metadata)

  if (metadata.unsubscribed === true || metadata.email_unsubscribed === true || metadata.content_unsubscribed === true) return false
  if (String(metadata.status || '').toLowerCase() === 'lost') return false
  if (stage === 'lost') return false

  if (audience === 'all_leads') return true
  if (audience === 'event_leads') return acquiredVia.includes('event') || Boolean(metadata.event_id || metadata.event_registration_id)
  if (audience === 'property_leads') return Boolean(lead.lead_purpose || metadata.property_id || metadata.last_property_id)
  if (audience === 'broker_candidates') return false

  return stage !== 'visitor'
}

function leadVisitorId(lead) {
  const metadata = metadataRecord(lead.metadata)
  return normalizeText(lead.visitor_id || metadata.visitor_id)
}

function leadHasPush(lead) {
  const metadata = metadataRecord(lead.metadata)
  return Boolean(
    leadVisitorId(lead) &&
    (lead.push_subscribed === true || lead.push_subscribed_lead === true || metadata.push_subscribed_at)
  )
}

function channelTargetKey(channel, value, leadId) {
  const normalized = channel === 'push' ? normalizeText(value) : normalizeEmail(value)
  const target = normalized || (leadId ? `lead:${normalizeText(leadId)}` : '')
  return target ? `${channel}:${target.toLowerCase()}` : ''
}

function existingPushKeys(rows) {
  const keys = new Set()
  for (const row of rows || []) {
    const context = metadataRecord(row.context)
    if (context.channel !== 'push') continue
    const key = channelTargetKey('push', context.target_visitor_id, row.lead_id)
    if (key) keys.add(key)
  }
  return keys
}

function buildPushContext({ post, lead, config, template, contentType, trigger, campaignId }) {
  const ctaLabel = template?.ctaLabel || (contentType === 'news' ? 'Ler noticia' : 'Ler artigo')
  const contentUrl = buildContentUrl(post, contentType)
  const trackingContent = normalizeText(post.slug || post.id)
  const trackingTitle = normalizePostText(post.title, 120)
  const trackedContentUrl = addUtm(contentUrl, {
    utm_source: 'push',
    utm_medium: 'push',
    utm_campaign: trigger,
    utm_content: trackingContent,
    lead_id: normalizeText(lead.id),
    event_type: `push_${contentType}_click`,
    link_type: contentType,
    link_label: ctaLabel,
    link_title: trackingTitle,
  })
  const name = normalizeText(lead.name) || 'tudo bem'
  const title = normalizePostText(post.title, 180)
  const summary = normalizePostText(post.excerpt || post.meta_description || post.primary_keyword || 'Uma leitura selecionada pela equipe Guilherme Pilger.', 420)
  const variables = {
    nome: name,
    email: normalizeEmail(lead.email),
    titulo_blog: title,
    resumo_blog: summary,
    link_artigo: trackedContentUrl,
    titulo_noticia: title,
    resumo_noticia: summary,
    link_noticia: trackedContentUrl,
    link_cta: trackedContentUrl,
    conteudo: `${title}\n\n${summary}`,
  }
  const defaultPushTitle = contentType === 'news' ? 'Nova noticia no radar' : 'Novo artigo para voce'
  const defaultPushBody = `${name}, ${contentType === 'news' ? 'saiu uma noticia sobre' : 'separei uma leitura sobre'} ${normalizePostText(post.title, 90)}.`

  return {
    type: 'editorial_distribution',
    campaign_id: campaignId,
    content_type: contentType,
    trigger,
    post_id: post.id,
    post_title: normalizeText(post.title),
    post_slug: normalizeText(post.slug),
    post_excerpt: normalizeText(post.excerpt || post.meta_description),
    post_category: normalizeText(post.category),
    audience: config.audience,
    channel: 'push',
    target_email: normalizeEmail(lead.email),
    target_phone: normalizePhone(lead.phone_e164 || lead.phone),
    target_visitor_id: leadVisitorId(lead),
    target_name: normalizeText(lead.name),
    subject: '',
    html_content: '',
    text_content: '',
    whatsapp_message: '',
    whatsapp_template_id: null,
    whatsapp_template_name: null,
    push_title: normalizePostText(template?.title ? renderTemplate(template.title, variables) : defaultPushTitle, 90),
    push_body: normalizePostText(template?.body ? renderTemplate(template.body, variables) : defaultPushBody, 220),
    push_template_id: template?.id || null,
    push_template_name: template?.name || null,
    content_url: trackedContentUrl,
    link_cta: trackedContentUrl,
    link_whatsapp: '',
    cta_label: ctaLabel,
    approval_required: config.approvalRequired || !config.autopilot,
    approval_status: config.approvalRequired || !config.autopilot ? 'awaiting_approval' : 'approved',
    created_by_agent: 'gabriel_correio',
    created_at: new Date().toISOString(),
  }
}

async function loadConfig() {
  const { data, error } = await supabase.from('app_config').select('key,value').in('key', CONFIG_KEYS)
  if (error) throw error
  const map = Object.fromEntries((data || []).map(row => [row.key, String(row.value || '')]))
  return {
    agentEnabled: map.email_agent_enabled !== 'false',
    autopilot: map.email_agent_autopilot === 'true',
    approvalRequired: map.email_agent_require_approval !== 'false',
    pushEnabled: map.editorial_distribution_push_enabled === 'true',
    audience: map.email_agent_default_audience || 'active_leads',
    pushIntervalMinutes: normalizePositiveInt(map.editorial_distribution_push_interval_minutes, 5, 1, 1440),
    allowedStartTime: map.email_agent_allowed_start_time || '09:00',
    allowedEndTime: map.email_agent_allowed_end_time || '18:00',
    pushTemplates: parsePushTemplates(map.editorial_distribution_push_templates),
  }
}

async function logBackfillEvent(metadata) {
  const { error } = await supabase.from('agent_workflow_events').insert({
    run_id: null,
    lead_id: null,
    lead_phone: null,
    event_type: 'editorial_push_backfill_created',
    status: apply ? 'queued' : 'dry_run',
    message: apply ? 'Filas de push complementares criadas para Gabriel.' : 'Simulacao de filas de push complementares para Gabriel.',
    metadata,
  })
  if (error) console.warn('[gabriel-push-backfill] event log failed:', error.message)
}

const config = await loadConfig()
if (!config.agentEnabled) {
  console.log(JSON.stringify({ applied: false, skipped: true, reason: 'email_agent_disabled' }, null, 2))
  process.exit(0)
}
if (!config.pushEnabled) {
  console.log(JSON.stringify({ applied: false, skipped: true, reason: 'push_disabled' }, null, 2))
  process.exit(0)
}

const [{ data: posts, error: postsError }, { data: leads, error: leadsError }] = await Promise.all([
  supabase
    .from('blog_posts')
    .select('id,title,slug,status,category,tags,generated_by,published_at,created_at,excerpt,meta_description,primary_keyword')
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(40),
  supabase
    .from('leads')
    .select('id,visitor_id,name,email,phone,phone_e164,push_subscribed,push_subscribed_lead,funnel_stage,lead_score,lead_classification,lead_purpose,acquired_via,metadata,created_at,updated_at')
    .order('updated_at', { ascending: false })
    .limit(5000),
])

if (postsError) throw postsError
if (leadsError) throw leadsError

const latestBlog = (posts || []).find(post => !isNewsPost(post))
const latestNews = (posts || []).find(post => isNewsPost(post))
const targets = [latestBlog, latestNews].filter(Boolean)
const pushLeads = (leads || []).filter(lead => leadMatchesAudience(lead, config.audience) && leadHasPush(lead))
const queueStatus = config.approvalRequired || !config.autopilot ? 'waiting' : 'queued'
const baseSchedule = nextWindowStart(config)
const allRows = []
const results = []

for (const post of targets) {
  const contentType = contentTypeForPost(post)
  const trigger = triggerForPost(post)
  const campaignId = campaignIdForPost(post)
  const template = pushTemplateForTrigger(config, trigger)
  const { data: existingRows, error: existingError } = await supabase
    .from('agent_workflow_runs')
    .select('id,lead_id,lead_phone,context')
    .in('trigger_type', TRIGGERS)
    .contains('context', { type: 'editorial_distribution', campaign_id: campaignId })
    .limit(10000)

  if (existingError) throw existingError

  const keys = existingPushKeys(existingRows || [])
  let pushIndex = 0
  const rows = []

  for (const lead of pushLeads) {
    const key = channelTargetKey('push', leadVisitorId(lead), lead.id)
    if (!key || keys.has(key)) continue

    const context = buildPushContext({ post, lead, config, template, contentType, trigger, campaignId })
    rows.push({
      lead_id: lead.id,
      lead_phone: normalizePhone(lead.phone_e164 || lead.phone) || null,
      lead_name: normalizeText(lead.name) || 'Lead',
      status: queueStatus,
      trigger_type: trigger,
      current_node_id: 'push',
      scheduled_for: queueStatus === 'queued' ? nextScheduleForChannel(config, baseSchedule, pushIndex, config.pushIntervalMinutes) : null,
      context,
    })
    keys.add(key)
    pushIndex += 1
  }

  allRows.push(...rows)
  results.push({
    campaign_id: campaignId,
    post_title: post.title,
    content_type: contentType,
    existing_campaign_rows: existingRows?.length || 0,
    missing_push_rows: rows.length,
    first_scheduled_for: rows[0]?.scheduled_for || null,
    last_scheduled_for: rows[rows.length - 1]?.scheduled_for || null,
  })
}

let inserted = []
if (apply && allRows.length) {
  const { data, error } = await supabase
    .from('agent_workflow_runs')
    .insert(allRows)
    .select('id,status,scheduled_for,context')

  if (error) throw error
  inserted = data || []
  await logBackfillEvent({
    campaigns: results,
    inserted: inserted.length,
    audience: config.audience,
    push_leads: pushLeads.length,
  })
}

console.log(JSON.stringify({
  applied: apply,
  generated_at: new Date().toISOString(),
  audience: config.audience,
  push_enabled: config.pushEnabled,
  queue_status: queueStatus,
  push_leads: pushLeads.length,
  target_campaigns: results,
  rows_to_insert: allRows.length,
  inserted: inserted.length,
}, null, 2))
