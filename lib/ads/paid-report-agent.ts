import { chatWithGemini } from '@/lib/gemini'
import { buildAgentContextBrief, getAgentEcosystemContext } from '@/lib/intelligence/ecosystem'
import { createAdminClient } from '@/lib/supabase/server'

type PlatformKey = 'meta' | 'google'
type SupabaseAdmin = ReturnType<typeof createAdminClient>

type CampaignRow = {
  id: string
  name: string
  platform: PlatformKey
  status: string
  total_budget: number | null
  daily_budget: number | null
  duration_days: number | null
  start_date: string | null
  end_date: string | null
  ai_auto_manage: boolean | null
  created_at: string | null
}

type SnapshotRow = {
  campaign_id: string
  snapshot_at: string | null
  impressions: number | null
  clicks: number | null
  ctr: number | null
  cpm: number | null
  cpc: number | null
  spend: number | null
  leads_count: number | null
  cost_per_lead: number | null
  reach: number | null
  landing_page_views: number | null
  link_clicks: number | null
  conversions: number | null
  cost_per_result: number | null
  messaging_conversations: number | null
  post_engagements: number | null
  quality_ranking: string | null
  engagement_rate_ranking: string | null
  conversion_rate_ranking: string | null
  frequency: number | null
  thumbstop_ratio: number | null
  video_p50: number | null
  video_p75: number | null
  video_p100: number | null
  ad_campaigns?: CampaignRow | CampaignRow[] | null
}

type AlertRow = {
  type: string | null
  urgency: string | null
  action_taken: string | null
  message: string | null
  ai_reasoning: string | null
  created_at: string | null
  ad_campaigns?: { name: string | null; platform: PlatformKey | null } | { name: string | null; platform: PlatformKey | null }[] | null
}

type CreativeRow = {
  title: string
  campaign_type: string
  content_type: string
  status: string
  platform_targets: string[] | null
  ai_context: string | null
  created_at: string | null
}

type PaidReportPayload = {
  title: string
  summary: string
  insights: Array<{
    title: string
    detail: string
    impact?: string
  }>
  recommendations: Array<{
    title: string
    action: string
    priority?: string
  }>
  metrics?: Record<string, unknown>
}

const SYSTEM_PROMPT = [
  'Voce e o agente de relatorio de trafego pago da Pilger Luxury Search.',
  'Analise Meta Ads e Google Ads com foco em investimento, eficiencia, leads e risco de desperdicio.',
  'Cruze campanhas, snapshots, alertas da IA, leads internos e criativos pagos em preparo.',
  'Fale como um gestor senior explicando o que fazer agora, sem jargao desnecessario.',
  'Nao misture dados organicos. Este relatorio e apenas de trafego pago.',
  'Use exatamente as chaves: title, summary, insights, recommendations e metrics.',
  'Seja compacto: no maximo 4 insights e 5 recomendacoes.',
  'Retorne somente JSON valido no schema solicitado.',
].join('\n')

function cleanJson(text: string) {
  const cleaned = text
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim()
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1)
  }
  return cleaned
}

function truncate(value: string | null | undefined, max = 900) {
  const text = String(value || '').trim()
  return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function metricDelta(current: number, previous: number) {
  if (previous <= 0 && current > 0) return 100
  if (previous <= 0) return 0
  return ((current - previous) / previous) * 100
}

function parseReport(raw: string, fallbackMetrics: Record<string, unknown>): PaidReportPayload {
  try {
    const parsed = JSON.parse(cleanJson(raw)) as Partial<PaidReportPayload> & {
      titulo?: string
      titulo_curto?: string
      'titulo curto do relatorio'?: string
      recomendacoes?: PaidReportPayload['recommendations']
      acoes?: PaidReportPayload['recommendations']
    }
    const insights = Array.isArray(parsed.insights) ? parsed.insights : []
    const recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations
      : Array.isArray(parsed.recomendacoes)
        ? parsed.recomendacoes
        : Array.isArray(parsed.acoes)
          ? parsed.acoes
          : []
    const title = parsed.title || parsed.titulo || parsed.titulo_curto || parsed['titulo curto do relatorio']

    return {
      title: truncate(title, 180) || 'Relatorio de trafego pago',
      summary: truncate(parsed.summary, 1600) || 'Relatorio gerado com base nas campanhas pagas sincronizadas.',
      insights: insights.slice(0, 6).map(item => ({
        title: truncate(item?.title, 120) || 'Insight',
        detail: truncate(item?.detail, 700),
        impact: truncate(item?.impact, 120) || undefined,
      })),
      recommendations: recommendations.slice(0, 8).map(item => ({
        title: truncate(item?.title, 120) || 'Acao recomendada',
        action: truncate(item?.action, 700),
        priority: truncate(item?.priority, 40) || undefined,
      })),
      metrics: {
        ...fallbackMetrics,
        ...(typeof parsed.metrics === 'object' && parsed.metrics ? parsed.metrics : {}),
      },
    }
  } catch {
    return {
      title: 'Relatorio de trafego pago',
      summary: truncate(raw, 1600) || 'A IA retornou uma leitura sem estrutura JSON.',
      insights: [],
      recommendations: [],
      metrics: fallbackMetrics,
    }
  }
}

function summarizeCampaignSnapshots(rows: SnapshotRow[]) {
  const byCampaign = new Map<string, SnapshotRow[]>()

  for (const row of rows) {
    if (!row.campaign_id) continue
    const current = byCampaign.get(row.campaign_id) || []
    current.push(row)
    byCampaign.set(row.campaign_id, current)
  }

  return Array.from(byCampaign.entries()).map(([campaignId, snapshots]) => {
    const sorted = [...snapshots].sort((a, b) => new Date(b.snapshot_at || 0).getTime() - new Date(a.snapshot_at || 0).getTime())
    const latest = sorted[0]
    const oldest = sorted[sorted.length - 1] || latest
    const campaign = firstRelation(latest.ad_campaigns)
    const spend = numberValue(latest.spend)
    const leads = numberValue(latest.leads_count || latest.conversions)
    const clicks = numberValue(latest.clicks)
    const impressions = numberValue(latest.impressions)
    const reach = numberValue(latest.reach)
    const costPerLead = leads > 0 ? spend / leads : numberValue(latest.cost_per_lead || latest.cost_per_result)

    return {
      campaign_id: campaignId,
      name: campaign?.name || 'Campanha',
      platform: campaign?.platform || 'meta',
      status: campaign?.status || 'unknown',
      ai_auto_manage: Boolean(campaign?.ai_auto_manage),
      budget: numberValue(campaign?.total_budget),
      daily_budget: numberValue(campaign?.daily_budget),
      start_date: campaign?.start_date || null,
      latest_snapshot_at: latest.snapshot_at,
      snapshots: snapshots.length,
      spend,
      impressions,
      reach,
      clicks,
      ctr: numberValue(latest.ctr) * 100,
      cpm: numberValue(latest.cpm),
      cpc: numberValue(latest.cpc),
      leads,
      cost_per_lead: costPerLead,
      landing_page_views: numberValue(latest.landing_page_views),
      link_clicks: numberValue(latest.link_clicks),
      messaging_conversations: numberValue(latest.messaging_conversations),
      post_engagements: numberValue(latest.post_engagements),
      frequency: numberValue(latest.frequency),
      thumbstop_ratio: numberValue(latest.thumbstop_ratio),
      quality_ranking: latest.quality_ranking,
      engagement_rate_ranking: latest.engagement_rate_ranking,
      conversion_rate_ranking: latest.conversion_rate_ranking,
      trend: {
        spend_percent: metricDelta(spend, numberValue(oldest.spend)),
        leads_percent: metricDelta(leads, numberValue(oldest.leads_count || oldest.conversions)),
        clicks_percent: metricDelta(clicks, numberValue(oldest.clicks)),
      },
    }
  })
}

async function loadPaidContext(supabase: SupabaseAdmin, days: number) {
  const periodEnd = new Date()
  const periodStart = new Date(periodEnd)
  periodStart.setDate(periodStart.getDate() - days)
  const since = periodStart.toISOString()

  const [{ data: snapshots }, { data: campaigns }, { data: alerts }, { data: creatives }, internalLeads] = await Promise.all([
    supabase
      .from('ad_metrics_snapshots')
      .select('campaign_id, snapshot_at, impressions, clicks, ctr, cpm, cpc, spend, leads_count, cost_per_lead, reach, landing_page_views, link_clicks, conversions, cost_per_result, messaging_conversations, post_engagements, quality_ranking, engagement_rate_ranking, conversion_rate_ranking, frequency, thumbstop_ratio, video_p50, video_p75, video_p100, ad_campaigns(id, name, platform, status, total_budget, daily_budget, duration_days, start_date, end_date, ai_auto_manage, created_at)')
      .gte('snapshot_at', since)
      .order('snapshot_at', { ascending: false })
      .limit(600),
    supabase
      .from('ad_campaigns')
      .select('id, name, platform, status, total_budget, daily_budget, duration_days, start_date, end_date, ai_auto_manage, created_at')
      .order('created_at', { ascending: false })
      .limit(120),
    supabase
      .from('ai_campaign_alerts')
      .select('type, urgency, action_taken, message, ai_reasoning, created_at, ad_campaigns(name, platform)')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('marketing_creatives')
      .select('title, campaign_type, content_type, status, platform_targets, ai_context, created_at')
      .in('campaign_type', ['paid', 'both'])
      .order('created_at', { ascending: false })
      .limit(25),
    supabase
      .from('leads')
      .select('id, created_at, funnel_stage, lead_score, acquired_via, visitors(detected_source)')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const campaignSummaries = summarizeCampaignSnapshots((snapshots || []) as SnapshotRow[])
  const campaignRows = (campaigns || []) as CampaignRow[]
  const alertRows = (alerts || []) as AlertRow[]
  const creativeRows = (creatives || []) as CreativeRow[]
  const leadRows = ((internalLeads.data || []) as any[]).filter(row => {
    const source = String(firstRelation(row.visitors)?.detected_source || row.acquired_via || '').toLowerCase()
    return source.includes('ads') || source.includes('google') || source.includes('facebook') || source.includes('instagram')
  })

  const totals = campaignSummaries.reduce(
    (acc, item) => {
      acc.spend += item.spend
      acc.impressions += item.impressions
      acc.reach += item.reach
      acc.clicks += item.clicks
      acc.leads += item.leads
      acc.landing_page_views += item.landing_page_views
      acc.messaging_conversations += item.messaging_conversations
      return acc
    },
    { spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0, landing_page_views: 0, messaging_conversations: 0 },
  )

  const metrics = {
    period_days: days,
    campaigns_total: campaignRows.length,
    campaigns_with_metrics: campaignSummaries.length,
    campaigns_active: campaignRows.filter(item => item.status === 'active').length,
    campaigns_paused: campaignRows.filter(item => item.status === 'paused').length,
    internal_paid_leads: leadRows.length,
    alerts_high_or_critical: alertRows.filter(item => ['high', 'critical'].includes(String(item.urgency || ''))).length,
    avg_ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
    avg_cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    avg_cpl: totals.leads > 0 ? totals.spend / totals.leads : 0,
    ...totals,
  }

  const promptPayload = {
    output_schema: {
      title: 'titulo curto, maximo 80 caracteres',
      summary: 'resumo executivo de ate 500 caracteres',
      insights: [{ title: 'insight', detail: 'evidencia e leitura em ate 350 caracteres', impact: 'alto|medio|baixo' }],
      recommendations: [{ title: 'acao', action: 'o que fazer agora em ate 350 caracteres', priority: 'alta|media|baixa' }],
      metrics: { health_score: '0 a 100', budget_efficiency: 'boa|media|ruim', main_risk: 'texto curto' },
    },
    period: {
      start: toDateOnly(periodStart),
      end: toDateOnly(periodEnd),
      days,
    },
    metrics,
    campaigns: campaignSummaries
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 30),
    alerts: alertRows.slice(0, 12).map(item => {
      const campaign = firstRelation(item.ad_campaigns)
      return {
        campaign: campaign?.name,
        platform: campaign?.platform,
        type: item.type,
        urgency: item.urgency,
        action_taken: item.action_taken,
        message: item.message,
        reasoning: item.ai_reasoning,
      }
    }),
    internal_leads: leadRows.slice(0, 20).map(item => ({
      created_at: item.created_at,
      source: firstRelation(item.visitors)?.detected_source || item.acquired_via,
      stage: item.funnel_stage,
      lead_score: item.lead_score,
    })),
    creative_pipeline: creativeRows.slice(0, 10).map(item => ({
      title: item.title,
      campaign_type: item.campaign_type,
      content_type: item.content_type,
      status: item.status,
      platforms: item.platform_targets,
      context: truncate(item.ai_context, 300),
    })),
  }

  return {
    periodStart,
    periodEnd,
    metrics,
    promptPayload,
  }
}

export async function generatePaidMarketingReport({
  days = 30,
}: {
  days?: number
} = {}) {
  const safeDays = Math.min(Math.max(Math.trunc(days), 7), 120)
  const supabase = createAdminClient()
  const context = await loadPaidContext(supabase, safeDays)
  const ecosystemContext = await getAgentEcosystemContext({ supabase, agent: 'traffic', days: safeDays })
  ;(context.promptPayload as any).ecosystem_context = {
    brief: buildAgentContextBrief(ecosystemContext),
    signals: ecosystemContext.signals,
    source_counts: ecosystemContext.source_counts,
  }

  const raw = await chatWithGemini({
    systemPrompt: SYSTEM_PROMPT,
    history: [],
    userMessage: JSON.stringify(context.promptPayload),
    temperature: 0.25,
    maxTokens: 8192,
  })

  const report = parseReport(raw, context.metrics)

  const { data, error } = await supabase
    .from('marketing_ai_reports')
    .insert({
      report_type: 'paid',
      period_start: toDateOnly(context.periodStart),
      period_end: toDateOnly(context.periodEnd),
      title: report.title,
      summary: report.summary,
      insights: report.insights,
      recommendations: report.recommendations,
      metrics: {
        ...(report.metrics || {}),
        model_response_preview: truncate(raw, 1200),
      },
      generated_by: 'paid_report_agent',
      updated_at: new Date().toISOString(),
    })
    .select('id, report_type, period_start, period_end, title, summary, insights, recommendations, metrics, status, generated_by, created_at')
    .single()

  if (error || !data) throw new Error(error?.message || 'Nao foi possivel salvar o relatorio pago.')

  return {
    success: true,
    report: data,
  }
}

export async function listPaidMarketingReports(limit = 5) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 30)
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('marketing_ai_reports')
    .select('id, report_type, period_start, period_end, title, summary, insights, recommendations, metrics, status, generated_by, created_at')
    .eq('report_type', 'paid')
    .order('created_at', { ascending: false })
    .limit(safeLimit)

  if (error) throw new Error(error.message)

  return data || []
}
