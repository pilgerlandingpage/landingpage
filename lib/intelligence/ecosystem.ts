import { createAdminClient } from '@/lib/supabase/server'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

export type EcosystemAgent =
  | 'global'
  | 'blog'
  | 'news'
  | 'whatsapp'
  | 'radar'
  | 'traffic'
  | 'ceo'
  | 'recruiting'

type SafeQueryResult<T = unknown> = {
  label: string
  ok: boolean
  data: T | null
  error: string | null
}

export type EcosystemContextOptions = {
  supabase?: SupabaseAdmin
  agent?: EcosystemAgent
  leadId?: string | null
  phone?: string | null
  days?: number
  limit?: number
}

function safeArray<T = any>(value: unknown, limit = 50): T[] {
  return Array.isArray(value) ? (value as T[]).slice(0, limit) : []
}

function safeText(value: unknown) {
  return String(value || '').trim()
}

function normalize(value: unknown) {
  return safeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function numberValue(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseMetadata(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {}
}

async function safeQuery<T>(label: string, promise: PromiseLike<{ data: T | null; error: any }>): Promise<SafeQueryResult<T>> {
  try {
    const { data, error } = await promise
    if (error) return { label, ok: false, data: null, error: error.message || String(error) }
    return { label, ok: true, data, error: null }
  } catch (error: any) {
    return { label, ok: false, data: null, error: error?.message || String(error) }
  }
}

function countBy<T>(items: T[], getKey: (item: T) => string | null | undefined, limit = 12) {
  const counts = new Map<string, number>()
  for (const item of items) {
    const key = safeText(getKey(item))
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }))
}

function topVisitorsByCity(visitors: any[], leads: any[]) {
  const rows = [
    ...visitors.map(item => ({ city: item?.city, state: item?.region || item?.state, source: item?.detected_source })),
    ...leads.map(item => ({ city: item?.city, state: item?.state, source: item?.source || item?.acquired_via })),
  ]
  return countBy(rows, item => [item.city, item.state].filter(Boolean).join(', ') || null, 12)
}

function extractPagePath(event: any) {
  const metadata = parseMetadata(event?.metadata)
  return safeText(metadata.page_path)
    || safeText(metadata.page_url)
    || safeText(metadata.pathname)
    || safeText(event?.landing_page_slug)
    || safeText(metadata.landing_page_slug)
}

function extractSearchTerm(event: any) {
  const metadata = parseMetadata(event?.metadata)
  return safeText(metadata.query)
    || safeText(metadata.search)
    || safeText(metadata.term)
    || safeText(metadata.value_label)
    || safeText(metadata.filter_label)
}

function propertyEventScore(eventType: string) {
  if (eventType === 'property_feed_whatsapp_clicked' || eventType === 'property_feed_message_clicked') return 14
  if (eventType === 'whatsapp_property_click') return 14
  if (eventType === 'property_favorited') return 10
  if (eventType === 'property_shared') return 8
  if (eventType === 'property_details_clicked') return 7
  if (eventType === 'property_gallery_opened') return 5
  if (eventType === 'property_feed_slide_viewed') return 3
  if (eventType === 'property_disliked') return -6
  return 1
}

function extractPropertyId(event: any) {
  const metadata = parseMetadata(event?.metadata)
  return safeText(metadata.property_id)
    || safeText(metadata.target_property_id)
    || safeText(metadata.lead_property_id)
    || safeText(metadata.from_property_id)
}

function buildHotProperties(events: any[], properties: any[]) {
  const scores = new Map<string, { property_id: string; score: number; events: number; last_event_at: string | null }>()
  for (const event of events) {
    const propertyId = extractPropertyId(event)
    if (!propertyId) continue
    const current = scores.get(propertyId) || { property_id: propertyId, score: 0, events: 0, last_event_at: null }
    current.score += propertyEventScore(String(event?.event_type || ''))
    current.events += 1
    current.last_event_at = event?.created_at || current.last_event_at
    scores.set(propertyId, current)
  }

  const byId = new Map(properties.map(property => [String(property?.id || ''), property]))
  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score || b.events - a.events)
    .slice(0, 12)
    .map(item => {
      const property = byId.get(item.property_id)
      return {
        ...item,
        title: property?.title || 'Imovel',
        city: property?.city || null,
        neighborhood: property?.neighborhood || property?.location || null,
        price: property?.price || null,
        property_type: property?.property_type || null,
      }
    })
}

function buildLeadQuestions(conversations: any[]) {
  return conversations
    .map(conversation => {
      const messages = safeArray<any>(conversation?.messages, 80)
      const userMessages = messages
        .filter(message => ['user', 'lead', 'customer'].includes(String(message?.role || '').toLowerCase()))
        .map(message => safeText(message?.content || message?.text || message?.message))
        .filter(Boolean)
        .slice(-4)

      return {
        lead_name: conversation?.lead_name || null,
        lead_phone: conversation?.lead_phone || null,
        funnel_stage: conversation?.funnel_stage || null,
        purpose: conversation?.lead_purpose || null,
        summary: (safeText(conversation?.summary) || userMessages.join(' | ')).slice(0, 420),
        updated_at: conversation?.updated_at || null,
      }
    })
    .filter(item => item.summary)
    .slice(0, 20)
}

function buildSourceCounts(results: SafeQueryResult[]) {
  return Object.fromEntries(
    results.map(result => [
      result.label,
      Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0,
    ]),
  )
}

function summarizeSignals(params: {
  leads: any[]
  visitors: any[]
  events: any[]
  ecosystemEvents: any[]
  properties: any[]
  radarInsights: any[]
  researchReports: any[]
  adCampaigns: any[]
  blogPosts: any[]
  conversations: any[]
  organicMedia: any[]
  brokerCandidates: any[]
}) {
  const {
    leads,
    visitors,
    events,
    ecosystemEvents,
    properties,
    radarInsights,
    researchReports,
    adCampaigns,
    blogPosts,
    conversations,
    organicMedia,
    brokerCandidates,
  } = params

  const searchEvents = events.filter(event =>
    String(event?.event_type || '').includes('search')
    || String(event?.event_type || '').includes('filter')
    || String(event?.event_type || '').includes('quiz')
  )
  const pageViews = events.filter(event => String(event?.event_type || '') === 'page_view')
  const whatsappEvents = events.filter(event => String(event?.event_type || '').includes('whatsapp'))
  const propertyEvents = events.filter(event => extractPropertyId(event))

  const topSearchTerms = countBy(searchEvents, extractSearchTerm, 14)
  const topPages = countBy(pageViews, extractPagePath, 12)
  const topLeadCities = topVisitorsByCity(visitors, leads)
  const hotProperties = buildHotProperties(propertyEvents, properties)
  const leadQuestions = buildLeadQuestions(conversations)
  const latestResearch = researchReports
    .filter(report => report?.status === 'completed')
    .slice(0, 10)
    .map(report => ({
      id: report.id,
      topic: report.topic,
      summary: report.executive_summary,
      sources: Array.isArray(report.sources) ? report.sources.length : 0,
      created_at: report.created_at,
    }))

  const radarOpportunities = radarInsights
    .slice(0, 10)
    .map(item => ({
      keyword: item?.keyword,
      location: item?.location,
      score: item?.opportunity_score,
      summary: item?.summary,
      content_opportunities: item?.content_opportunities || [],
    }))

  const trafficSources = countBy(visitors, item => item?.detected_source || 'Direto', 10)
  const brokerCandidateCities = countBy(brokerCandidates, item => [item?.city, item?.state].filter(Boolean).join(', ') || null, 10)
  const brokerCandidateSources = countBy(brokerCandidates, item => item?.source || item?.utm_source || 'Direto', 10)
  const highPotentialBrokerCandidates = brokerCandidates.filter(candidate => String(candidate?.potential_level || '') === 'hot' || Number(candidate?.potential_score || 0) >= 80)
  const activeCampaigns = adCampaigns.filter(campaign => String(campaign?.status || '').toLowerCase() === 'active')
  const publishedPosts = blogPosts.filter(post => String(post?.status || '').toLowerCase() === 'published')
  const recentEcosystemEvents = ecosystemEvents
    .slice(0, 16)
    .map(event => ({
      id: event?.id,
      event_type: event?.event_type,
      actor_type: event?.actor_type,
      entity_type: event?.entity_type,
      entity_id: event?.entity_id,
      source: event?.source,
      label: event?.label,
      importance_score: event?.importance_score,
      occurred_at: event?.occurred_at,
    }))
  const newsContentSignals = recentEcosystemEvents
    .filter(event => String(event.event_type || '').includes('news') || String(event.source || '').includes('news'))
    .slice(0, 8)
  const organicTopContent = organicMedia
    .slice(0, 10)
    .map(item => ({
      platform: item?.platform,
      title: safeText(item?.caption).slice(0, 160) || item?.media_product_type || item?.media_type,
      reach: item?.reach,
      views: item?.views,
      interactions: item?.total_interactions,
      permalink: item?.permalink,
    }))

  return {
    overview: {
      leads: leads.length,
      visitors: visitors.length,
      events: events.length,
      page_views: pageViews.length,
      whatsapp_events: whatsappEvents.length,
      properties: properties.length,
      active_campaigns: activeCampaigns.length,
      completed_research: latestResearch.length,
      radar_opportunities: radarOpportunities.length,
      published_blog_posts: publishedPosts.length,
      broker_candidates: brokerCandidates.length,
      high_potential_broker_candidates: highPotentialBrokerCandidates.length,
      ecosystem_events: ecosystemEvents.length,
    },
    top_lead_cities: topLeadCities,
    traffic_sources: trafficSources,
    top_pages: topPages,
    top_search_terms: topSearchTerms,
    hot_properties: hotProperties,
    lead_questions: leadQuestions,
    radar_opportunities: radarOpportunities,
    latest_research: latestResearch,
    organic_top_content: organicTopContent,
    broker_candidate_cities: brokerCandidateCities,
    broker_candidate_sources: brokerCandidateSources,
    recent_ecosystem_events: recentEcosystemEvents,
    news_content_signals: newsContentSignals,
    high_potential_broker_candidates: highPotentialBrokerCandidates.slice(0, 12).map(candidate => ({
      id: candidate.id,
      name: candidate.full_name,
      city: candidate.city,
      state: candidate.state,
      score: candidate.potential_score,
      level: candidate.potential_level,
      status: candidate.status,
      source: candidate.source || candidate.utm_source,
    })),
  }
}

function buildExecutiveSummary(signals: any, agent: EcosystemAgent) {
  const overview = signals.overview || {}
  const topCity = signals.top_lead_cities?.[0]?.label
  const topSearch = signals.top_search_terms?.[0]?.label
  const hotProperty = signals.hot_properties?.[0]?.title
  const radar = signals.radar_opportunities?.[0]?.keyword
  const research = signals.latest_research?.[0]?.topic
  const brokerCandidateCity = signals.broker_candidate_cities?.[0]?.label

  const parts = [
    `Contexto ${agent}: ${overview.leads || 0} leads, ${overview.visitors || 0} visitantes, ${overview.events || 0} eventos e ${overview.broker_candidates || 0} candidatos corretores recentes analisados.`,
    topCity ? `Cidade com mais sinal: ${topCity}.` : '',
    topSearch ? `Busca/filtro mais forte: ${topSearch}.` : '',
    hotProperty ? `Imovel com maior interesse comportamental: ${hotProperty}.` : '',
    radar ? `Radar em destaque: ${radar}.` : '',
    research ? `Pesquisa profunda recente: ${research}.` : '',
    brokerCandidateCity ? `Cidade com mais candidatos corretores: ${brokerCandidateCity}.` : '',
  ].filter(Boolean)

  return parts.join(' ')
}

export async function getAgentEcosystemContext(options: EcosystemContextOptions = {}) {
  const supabase = options.supabase || createAdminClient()
  const agent = options.agent || 'global'
  const days = Math.max(1, Math.min(180, options.days || 30))
  const limit = Math.max(10, Math.min(500, options.limit || 120))
  const periodEnd = new Date()
  const periodStart = new Date(periodEnd)
  periodStart.setDate(periodStart.getDate() - days)
  const since = periodStart.toISOString()

  const results = await Promise.all([
    safeQuery('leads', supabase.from('leads').select('id, name, phone, phone_e164, lead_purpose, funnel_stage, acquired_via, landing_page_id, city, state, country, visitor_id, metadata, created_at, updated_at').gte('created_at', since).order('created_at', { ascending: false }).limit(limit)),
    safeQuery('visitors', supabase.from('visitors').select('id, city, region, country, detected_source, device_type, browser, os, page_views, ip_address, utm_source, utm_medium, utm_campaign, referrer, last_visit_at').order('last_visit_at', { ascending: false }).limit(limit)),
    safeQuery('funnel_events', supabase.from('funnel_events').select('id, visitor_id, lead_id, landing_page_id, event_type, metadata, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(limit * 2)),
    safeQuery('properties', supabase.from('properties').select('id, title, city, state, neighborhood, address, price, property_type, bedrooms, bathrooms, suites, parking_spaces, area_m2, status, source_status, amenities, created_at').order('created_at', { ascending: false }).limit(220)),
    safeQuery('landing_pages', supabase.from('landing_pages').select('id, title, slug, property_id, created_at').order('created_at', { ascending: false }).limit(80)),
    safeQuery('market_radar_insights', supabase.from('market_radar_insights').select('keyword, location, opportunity_score, summary, content_opportunities, campaign_recommendation, created_at').order('created_at', { ascending: false }).limit(80)),
    safeQuery('ai_research_reports', supabase.from('ai_research_reports').select('id, topic, requester, depth, status, executive_summary, sources, queries, created_at, valid_until').order('created_at', { ascending: false }).limit(60)),
    safeQuery('ad_campaigns', supabase.from('ad_campaigns').select('id, name, platform, status, total_budget, daily_budget, created_at').order('created_at', { ascending: false }).limit(80)),
    safeQuery('ad_metrics_snapshots', supabase.from('ad_metrics_snapshots').select('campaign_id, snapshot_at, impressions, clicks, spend, leads_count, conversions, cost_per_lead').gte('snapshot_at', since).order('snapshot_at', { ascending: false }).limit(180)),
    safeQuery('blog_posts', supabase.from('blog_posts').select('id, title, slug, primary_keyword, status, category, published_at, created_at').order('created_at', { ascending: false }).limit(80)),
    safeQuery('whatsapp_ai_conversations', supabase.from('whatsapp_ai_conversations').select('id, lead_phone, messages, status, updated_at').order('updated_at', { ascending: false }).limit(100)),
    safeQuery('organic_social_media', supabase.from('organic_social_media').select('id, platform, caption, media_type, media_product_type, permalink, published_at, reach, views, total_interactions, like_count, comments_count, shares, saved').gte('published_at', since).order('published_at', { ascending: false }).limit(80)),
    safeQuery('marketing_creatives', supabase.from('marketing_creatives').select('id, title, campaign_type, content_type, status, platform_targets, ai_context, created_at').order('created_at', { ascending: false }).limit(60)),
    safeQuery('broker_candidates', supabase.from('broker_candidates').select('id, full_name, email, phone, city, state, creci, creci_state, broker_type, current_company, experience_years, market_focus, regions, specialties, social_links, source, utm_source, utm_medium, utm_campaign, status, potential_score, potential_level, ai_summary, ai_recommendation, visitor_id, metadata, created_at, updated_at, last_activity_at').gte('created_at', since).order('created_at', { ascending: false }).limit(limit)),
    safeQuery('ecosystem_events', supabase.from('ecosystem_events').select('id, event_type, actor_type, entity_type, entity_id, source, label, metadata, importance_score, occurred_at').gte('occurred_at', since).order('occurred_at', { ascending: false }).limit(120)),
  ])

  const byLabel = Object.fromEntries(results.map(result => [result.label, result]))
  const leads = safeArray(byLabel.leads?.data, limit)
  const visitors = safeArray(byLabel.visitors?.data, limit)
  const funnelEvents = safeArray(byLabel.funnel_events?.data, limit * 2)
  const properties = safeArray(byLabel.properties?.data, 220)
  const landingPages = safeArray(byLabel.landing_pages?.data, 80)
  const radarInsights = safeArray(byLabel.market_radar_insights?.data, 80)
  const researchReports = safeArray(byLabel.ai_research_reports?.data, 60)
  const adCampaigns = safeArray(byLabel.ad_campaigns?.data, 80)
  const adMetrics = safeArray(byLabel.ad_metrics_snapshots?.data, 180)
  const blogPosts = safeArray(byLabel.blog_posts?.data, 80)
  const conversations = safeArray(byLabel.whatsapp_ai_conversations?.data, 100)
  const organicMedia = safeArray(byLabel.organic_social_media?.data, 80)
  const marketingCreatives = safeArray(byLabel.marketing_creatives?.data, 60)
  const brokerCandidates = safeArray(byLabel.broker_candidates?.data, limit)
  const ecosystemEvents = safeArray(byLabel.ecosystem_events?.data, 120)

  const normalizedPhone = normalize(options.phone).replace(/\D/g, '')
  const leadProfile = options.leadId || normalizedPhone
    ? leads.find((lead: any) => {
      const leadPhones = [lead?.phone, lead?.phone_e164].map(value => normalize(value).replace(/\D/g, ''))
      return (options.leadId && lead?.id === options.leadId) || (normalizedPhone && leadPhones.some(phone => phone.endsWith(normalizedPhone) || normalizedPhone.endsWith(phone)))
    }) || null
    : null

  const leadVisitorId = leadProfile?.visitor_id || null
  const leadEvents = leadProfile
    ? funnelEvents.filter((event: any) => event?.lead_id === leadProfile.id || (leadVisitorId && event?.visitor_id === leadVisitorId))
    : []

  const signals = summarizeSignals({
    leads,
    visitors,
    events: funnelEvents,
    ecosystemEvents,
    properties,
    radarInsights,
    researchReports,
    adCampaigns,
    blogPosts,
    conversations,
    organicMedia,
    brokerCandidates,
  })

  const context = {
    version: '2026-05-16',
    agent,
    period: {
      label: `ultimos ${days} dias`,
      days,
      start: periodStart.toISOString(),
      end: periodEnd.toISOString(),
    },
    generated_at: new Date().toISOString(),
    collected_sources: results.filter(result => result.ok).map(result => result.label),
    unavailable_sources: results.filter(result => !result.ok).map(result => ({ source: result.label, error: result.error })),
    source_counts: buildSourceCounts(results),
    executive_summary: buildExecutiveSummary(signals, agent),
    signals,
    lead_profile: leadProfile,
    lead_events: leadEvents.slice(-120),
    leads,
    visitors,
    funnel_events: funnelEvents,
    properties,
    landing_pages: landingPages,
    market_radar_insights: radarInsights,
    research_reports: researchReports,
    ai_research_reports: researchReports,
    ad_campaigns: adCampaigns,
    ad_metrics_snapshots: adMetrics,
    existing_blog_posts: blogPosts,
    blog_posts: blogPosts,
    whatsapp_conversations: conversations,
    organic_social_media: organicMedia,
    marketing_creatives: marketingCreatives,
    broker_candidates: brokerCandidates,
    ecosystem_events: ecosystemEvents,
  }

  return context
}

export function buildAgentContextBrief(context: any) {
  const signals = context?.signals || {}
  const lines = [
    context?.executive_summary,
    '',
    'Sinais prioritarios:',
    ...(signals.top_lead_cities || []).slice(0, 5).map((item: any) => `- Cidade: ${item.label} (${item.count})`),
    ...(signals.top_search_terms || []).slice(0, 5).map((item: any) => `- Busca/filtro: ${item.label} (${item.count})`),
    ...(signals.hot_properties || []).slice(0, 5).map((item: any) => `- Imovel quente: ${item.title} | score ${item.score}`),
    ...(signals.radar_opportunities || []).slice(0, 5).map((item: any) => `- Radar: ${item.keyword} | score ${item.score || 'n/a'}`),
    ...(signals.latest_research || []).slice(0, 4).map((item: any) => `- Pesquisa: ${item.topic} | ${safeText(item.summary).slice(0, 160)}`),
    ...(signals.high_potential_broker_candidates || []).slice(0, 5).map((item: any) => `- Candidato corretor: ${item.name} | ${item.city || '-'} | score ${item.score}`),
  ].filter(Boolean)
  return lines.join('\n')
}

export async function saveEcosystemSnapshot(args: {
  supabase?: SupabaseAdmin
  context: any
  agent?: EcosystemAgent
  scope?: string
  subjectId?: string | null
  createdBy?: string
}) {
  const supabase = args.supabase || createAdminClient()
  const context = args.context || {}
  const period = context.period || {}
  const payload = {
    scope: args.scope || (args.subjectId ? 'lead' : 'global'),
    agent: args.agent || context.agent || 'global',
    subject_id: args.subjectId || null,
    period_start: period.start || null,
    period_end: period.end || null,
    status: 'completed',
    summary: context.executive_summary || '',
    signals: context.signals || {},
    source_counts: context.source_counts || {},
    source_summary: {
      collected_sources: context.collected_sources || [],
      unavailable_sources: context.unavailable_sources || [],
      period,
    },
    created_by: args.createdBy || 'ecosystem-intelligence',
    generated_at: context.generated_at || new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('ecosystem_context_snapshots')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    if (String(error.message || '').includes('ecosystem_context_snapshots')) {
      return { skipped: true, reason: 'missing_table', error: error.message, snapshot: null }
    }
    throw error
  }

  return { skipped: false, snapshot: data }
}

export async function recordEcosystemEvent(args: {
  supabase?: SupabaseAdmin
  eventType: string
  actorType?: string
  leadId?: string | null
  visitorId?: string | null
  entityType?: string | null
  entityId?: string | null
  source?: string | null
  label?: string | null
  metadata?: Record<string, any>
  importanceScore?: number
  occurredAt?: string
}) {
  const supabase = args.supabase || createAdminClient()
  const payload = {
    event_type: args.eventType,
    actor_type: args.actorType || 'agent',
    lead_id: args.leadId || null,
    visitor_id: args.visitorId || null,
    entity_type: args.entityType || null,
    entity_id: args.entityId || null,
    source: args.source || null,
    label: args.label || null,
    metadata: args.metadata || {},
    importance_score: args.importanceScore || 0,
    occurred_at: args.occurredAt || new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('ecosystem_events')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    if (String(error.message || '').includes('ecosystem_events')) {
      return { skipped: true, reason: 'missing_table', error: error.message, event: null }
    }
    throw error
  }

  return { skipped: false, event: data }
}

export async function getLatestEcosystemSnapshots(options: { supabase?: SupabaseAdmin; limit?: number; agent?: EcosystemAgent } = {}) {
  const supabase = options.supabase || createAdminClient()
  let query = supabase
    .from('ecosystem_context_snapshots')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(Math.max(1, Math.min(50, options.limit || 12)))

  if (options.agent) query = query.eq('agent', options.agent)

  const { data, error } = await query
  if (error) {
    if (String(error.message || '').includes('ecosystem_context_snapshots')) return []
    throw error
  }
  return data || []
}

export async function runEcosystemSnapshotCycle(options: { supabase?: SupabaseAdmin; days?: number; agents?: EcosystemAgent[]; createdBy?: string } = {}) {
  const supabase = options.supabase || createAdminClient()
  const agents = options.agents || ['global', 'blog', 'news', 'whatsapp', 'radar', 'traffic', 'ceo', 'recruiting']
  const results: Array<{ agent: EcosystemAgent; skipped?: boolean; snapshotId?: string | null; error?: string }> = []

  for (const agent of agents) {
    try {
      const context = await getAgentEcosystemContext({ supabase, agent, days: options.days || 30 })
      const saved = await saveEcosystemSnapshot({
        supabase,
        context,
        agent,
        scope: 'global',
        createdBy: options.createdBy || 'ecosystem-snapshot-cycle',
      })
      results.push({
        agent,
        skipped: Boolean(saved.skipped),
        snapshotId: saved.snapshot?.id || null,
        error: saved.skipped ? saved.error || saved.reason : undefined,
      })
    } catch (error: any) {
      results.push({ agent, error: error?.message || String(error) })
    }
  }

  return {
    generated_at: new Date().toISOString(),
    agents: results.length,
    completed: results.filter(result => result.snapshotId).length,
    skipped: results.filter(result => result.skipped).length,
    failed: results.filter(result => result.error && !result.skipped).length,
    results,
  }
}
