import { chatWithGemini } from '@/lib/gemini'
import { getAiAutomationGate } from '@/lib/ai/automation-control'
import { buildAgentContextBrief, getAgentEcosystemContext, recordEcosystemEvent } from '@/lib/intelligence/ecosystem'
import { saveAgentCentralSnapshot } from '@/lib/intelligence/agent-runtime'
import { createAdminClient } from '@/lib/supabase/server'

type PlatformKey = 'instagram' | 'facebook'
type SupabaseAdmin = ReturnType<typeof createAdminClient>

type OrganicProfileRow = {
  platform: PlatformKey
  username: string | null
  display_name: string | null
  followers_count: number | null
  media_count: number | null
  last_synced_at: string | null
}

type OrganicMediaRow = {
  id: string
  platform: PlatformKey
  caption: string | null
  media_type: string | null
  media_product_type: string | null
  permalink: string | null
  published_at: string | null
  like_count: number | null
  comments_count: number | null
  reach: number | null
  views: number | null
  total_interactions: number | null
  saved: number | null
  shares: number | null
}

type SocialSuggestionRow = {
  platform: PlatformKey
  intent: string | null
  sentiment: string | null
  priority: string | null
  lead_score: number | null
  summary: string | null
  recommended_action: string | null
  updated_at: string | null
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

type OrganicReportPayload = {
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
  'Voce e o agente de relatorios de trafego organico da Pilger Luxury Search.',
  'Analise Instagram e Facebook com foco em venda de imoveis de alto padrao.',
  'Cruze performance dos conteudos, sinais de audiencia, comentarios/mensagens analisados pela IA e criativos em preparo.',
  'Seu relatorio deve ser objetivo, executivo e acionavel para marketing, atendimento e diretoria.',
  'Evite promessas sem base nos dados. Quando faltar dado, diga que a leitura e limitada.',
  'Retorne somente JSON valido no schema solicitado.',
].join('\n')

function cleanJson(text: string) {
  return text
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim()
}

function truncate(value: string | null | undefined, max = 900) {
  const text = String(value || '').trim()
  return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

function numberValue(value: number | null | undefined) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function mediaScore(media: OrganicMediaRow) {
  return numberValue(media.views)
    + numberValue(media.reach)
    + (numberValue(media.total_interactions) * 2)
    + numberValue(media.like_count)
    + (numberValue(media.comments_count) * 4)
    + (numberValue(media.shares) * 5)
    + (numberValue(media.saved) * 3)
}

function mediaTitle(media: OrganicMediaRow) {
  const firstLine = media.caption?.split('\n').find(Boolean)?.trim()
  return truncate(firstLine || media.media_product_type || media.media_type || 'Publicacao', 140)
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function parseReport(raw: string, fallbackMetrics: Record<string, unknown>): OrganicReportPayload {
  try {
    const parsed = JSON.parse(cleanJson(raw)) as Partial<OrganicReportPayload> & {
      titulo?: string
      titulo_curto?: string
      'titulo curto do relatorio'?: string
      acoes?: OrganicReportPayload['recommendations']
      recomendacoes?: OrganicReportPayload['recommendations']
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
      title: truncate(title, 180) || 'Relatorio de trafego organico',
      summary: truncate(parsed.summary, 1600) || 'Relatorio gerado com base nos dados organicos sincronizados.',
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
      title: 'Relatorio de trafego organico',
      summary: truncate(raw, 1600) || 'A IA retornou uma leitura sem estrutura JSON. Revise a resposta bruta nos metadados.',
      insights: [],
      recommendations: [],
      metrics: fallbackMetrics,
    }
  }
}

async function loadOrganicContext(supabase: SupabaseAdmin, days: number) {
  const periodEnd = new Date()
  const periodStart = new Date(periodEnd)
  periodStart.setDate(periodStart.getDate() - days)

  const since = periodStart.toISOString()

  const [{ data: profiles }, { data: media }, { data: suggestions }, { data: creatives }] = await Promise.all([
    supabase
      .from('organic_social_profiles')
      .select('platform, username, display_name, followers_count, media_count, last_synced_at')
      .order('platform', { ascending: true }),
    supabase
      .from('organic_social_media')
      .select('id, platform, caption, media_type, media_product_type, permalink, published_at, like_count, comments_count, reach, views, total_interactions, saved, shares')
      .gte('published_at', since)
      .order('published_at', { ascending: false })
      .limit(80),
    supabase
      .from('meta_social_ai_suggestions')
      .select('platform, intent, sentiment, priority, lead_score, summary, recommended_action, updated_at')
      .gte('updated_at', since)
      .order('lead_score', { ascending: false })
      .limit(40),
    supabase
      .from('marketing_creatives')
      .select('title, campaign_type, content_type, status, platform_targets, ai_context, created_at')
      .in('campaign_type', ['organic', 'both'])
      .order('created_at', { ascending: false })
      .limit(25),
  ])

  const mediaRows = ((media || []) as OrganicMediaRow[]).sort((a, b) => mediaScore(b) - mediaScore(a))
  const profileRows = (profiles || []) as OrganicProfileRow[]
  const suggestionRows = (suggestions || []) as SocialSuggestionRow[]
  const creativeRows = (creatives || []) as CreativeRow[]

  const totals = mediaRows.reduce(
    (acc, item) => {
      acc.reach += numberValue(item.reach)
      acc.views += numberValue(item.views)
      acc.interactions += numberValue(item.total_interactions)
      acc.likes += numberValue(item.like_count)
      acc.comments += numberValue(item.comments_count)
      acc.saves += numberValue(item.saved)
      acc.shares += numberValue(item.shares)
      return acc
    },
    { reach: 0, views: 0, interactions: 0, likes: 0, comments: 0, saves: 0, shares: 0 },
  )

  const followers = profileRows.reduce((sum, item) => sum + numberValue(item.followers_count), 0)
  const averageScore = mediaRows.length
    ? Math.round(mediaRows.reduce((sum, item) => sum + mediaScore(item), 0) / mediaRows.length)
    : 0
  const hotLeads = suggestionRows.filter(item => numberValue(item.lead_score) >= 70).length

  const metrics = {
    period_days: days,
    profiles: profileRows.length,
    media_count: mediaRows.length,
    followers,
    average_score: averageScore,
    hot_leads: hotLeads,
    ...totals,
  }

  const promptPayload = {
    output_schema: {
      title: 'titulo curto do relatorio',
      summary: 'resumo executivo de 3 a 5 frases',
      insights: [{ title: 'insight', detail: 'evidencia e leitura', impact: 'alto|medio|baixo' }],
      recommendations: [{ title: 'acao', action: 'o que fazer agora', priority: 'alta|media|baixa' }],
      metrics: { health_score: '0 a 100', momentum: 'subindo|estavel|descendo' },
    },
    period: {
      start: toDateOnly(periodStart),
      end: toDateOnly(periodEnd),
      days,
    },
    metrics,
    profiles: profileRows,
    top_content: mediaRows.slice(0, 12).map(item => ({
      platform: item.platform,
      title: mediaTitle(item),
      type: item.media_product_type || item.media_type,
      published_at: item.published_at,
      score: mediaScore(item),
      reach: item.reach,
      views: item.views,
      interactions: item.total_interactions,
      comments: item.comments_count,
      shares: item.shares,
      saved: item.saved,
      permalink: item.permalink,
    })),
    lead_signals: suggestionRows.slice(0, 12).map(item => ({
      platform: item.platform,
      intent: item.intent,
      sentiment: item.sentiment,
      priority: item.priority,
      lead_score: item.lead_score,
      summary: item.summary,
      recommended_action: item.recommended_action,
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
    promptPayload,
    metrics,
  }
}

export async function generateOrganicMarketingReport({
  days = 30,
}: {
  days?: number
} = {}) {
  const safeDays = Math.min(Math.max(Math.trunc(days), 7), 120)
  const supabase = createAdminClient()
  const aiGate = await getAiAutomationGate({
    supabase,
    agentId: 'organic-report-agent',
    enabledKey: 'organic_report_agent_enabled',
  })
  if (!aiGate.allowed) {
    return { success: true, skipped: true, reason: aiGate.reason, ai_gate: aiGate, report: null }
  }

  const context = await loadOrganicContext(supabase, safeDays)
  const ecosystemContext = await getAgentEcosystemContext({ supabase, agent: 'social', days: safeDays })
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
    maxTokens: 4096,
  })

  const report = parseReport(raw, context.metrics)
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('marketing_ai_reports')
    .insert({
      report_type: 'organic',
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
      generated_by: 'organic_report_agent',
      updated_at: now,
    })
    .select('id, report_type, period_start, period_end, title, summary, insights, recommendations, metrics, status, generated_by, created_at')
    .single()

  if (error || !data) throw new Error(error?.message || 'Nao foi possivel salvar o relatorio organico.')

  await recordEcosystemEvent({
    supabase,
    eventType: 'organic_marketing_report_created',
    actorType: 'agent',
    entityType: 'marketing_ai_report',
    entityId: data.id,
    source: 'organic-report-agent',
    label: data.title,
    importanceScore: 70,
    metadata: {
      report_type: 'organic',
      period_start: context.periodStart.toISOString(),
      period_end: context.periodEnd.toISOString(),
      summary: report.summary,
      insights: report.insights.slice(0, 4),
      recommendations: report.recommendations.slice(0, 4),
      metrics: report.metrics || {},
    },
  }).catch((eventError) => {
    console.warn('[Organic Report Agent] ecosystem event failed:', eventError?.message || eventError)
  })

  await saveAgentCentralSnapshot({
    supabase,
    agentId: 'organic-report-agent',
    createdBy: 'organic-report-agent',
    context: ecosystemContext,
    summary: `Relatorio organico criado: "${data.title}". ${report.summary || ''}`.trim(),
    signals: {
      latest_organic_marketing_report: {
        id: data.id,
        title: data.title,
        report_type: data.report_type,
        period_start: data.period_start,
        period_end: data.period_end,
        summary: report.summary,
        insights: report.insights.slice(0, 6),
        recommendations: report.recommendations.slice(0, 6),
        metrics: report.metrics || {},
        created_at: data.created_at,
      },
    },
  }).catch((snapshotError) => {
    console.warn('[Organic Report Agent] central snapshot failed:', snapshotError?.message || snapshotError)
  })

  return {
    success: true,
    report: data,
  }
}

export async function listOrganicMarketingReports(limit = 5) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 30)
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('marketing_ai_reports')
    .select('id, report_type, period_start, period_end, title, summary, insights, recommendations, metrics, status, generated_by, created_at')
    .eq('report_type', 'organic')
    .order('created_at', { ascending: false })
    .limit(safeLimit)

  if (error) throw new Error(error.message)

  return data || []
}
