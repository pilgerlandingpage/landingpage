import { generateChatResponse } from '@/lib/ai/generation'
import { AI_TOKEN_AUTOMATION_PAUSE_KEY } from '@/lib/ai/automation-control'
import { buildAgentContextBrief, getAgentEcosystemContext, recordEcosystemEvent } from '@/lib/intelligence/ecosystem'

type SupabaseClient = any

type RadarRecord = {
  id: string
  keyword: string
  location?: string | null
}

type TrendInput = {
  currentScore: number
  averageScore: number
  trend: 'hot' | 'warm' | 'cold'
}

type PropertyIndexItem = {
  id: string
  title: string
  city: string
  neighborhood: string
  property_type: string
  price: number | null
  bedrooms: number | null
  suites: number | null
  parking_spaces: number | null
  text: string
}

export type RadarInsightRuntimeConfig = {
  aiEnabled: boolean
  minOpportunityScoreForAi: number
  maxAiInsightsPerRun: number
  opportunityAlertThreshold: number
  systemPrompt: string
}

export type RadarInsightResult = {
  opportunity_score: number
  market_temperature: string
  summary: string
  recommended_actions: string[]
  related_properties_count: number
  related_properties: Array<Record<string, unknown>>
  related_leads_count: number
  content_opportunities: string[]
  campaign_recommendation: string
  risk_notes: string
  ai_analysis: string | null
  ai_used: boolean
}

const DEFAULT_RADAR_ANALYST_PROMPT = `Você é o Analista de Radar de Mercado da Imobiliária Guilherme Pilger, uma imobiliária de luxo em Santa Catarina.
Sua função é interpretar sinais de busca, estoque imobiliário e oportunidade comercial.
Responda sempre em português do Brasil, com linguagem executiva, objetiva e orientada à ação.
Nunca invente números além dos dados fornecidos.
Retorne somente JSON válido, sem markdown.`

const STOPWORDS = new Set([
  'a', 'o', 'os', 'as', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas',
  'para', 'por', 'com', 'e', 'ou', 'um', 'uma', 'ao', 'aos', 'venda', 'imovel', 'imoveis',
  'apartamento', 'casa', 'cobertura', 'terreno', 'condominio',
])

const CITY_ALIASES: Record<string, string[]> = {
  'Balneário Camboriú': ['balneario camboriu', 'bc'],
  'Itajaí': ['itajai', 'praia brava'],
  'Itapema': ['itapema', 'meia praia'],
  'Porto Belo': ['porto belo', 'pereque', 'vivapark', 'viva park'],
  'Camboriú': ['camboriu'],
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)))
}

function normalize(value: string | null | undefined) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getConfigNumber(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

async function getConfigMap(supabase: SupabaseClient, keys: string[]) {
  const { data } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', keys)

  return Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))
}

export async function getRadarInsightRuntimeConfig(supabase: SupabaseClient): Promise<RadarInsightRuntimeConfig> {
  const configs = await getConfigMap(supabase, [
    AI_TOKEN_AUTOMATION_PAUSE_KEY,
    'radar_ai_enabled',
    'radar_ai_min_opportunity_score',
    'radar_ai_max_insights_per_run',
    'radar_opportunity_alert_threshold',
    'radar_analyst_system_prompt',
  ])

  return {
    aiEnabled: configs[AI_TOKEN_AUTOMATION_PAUSE_KEY] !== 'true' && configs.radar_ai_enabled !== 'false',
    minOpportunityScoreForAi: getConfigNumber(configs.radar_ai_min_opportunity_score, 70, 0, 100),
    maxAiInsightsPerRun: getConfigNumber(configs.radar_ai_max_insights_per_run, 6, 0, 50),
    opportunityAlertThreshold: getConfigNumber(configs.radar_opportunity_alert_threshold, 75, 0, 100),
    systemPrompt: configs.radar_analyst_system_prompt || DEFAULT_RADAR_ANALYST_PROMPT,
  }
}

export async function loadRadarPropertyIndex(supabase: SupabaseClient): Promise<PropertyIndexItem[]> {
  const { data, error } = await supabase
    .from('properties')
    .select('id,title,description,city,neighborhood,property_type,price,bedrooms,suites,parking_spaces,amenities,status,source_status')
    .or('status.eq.active,source_status.eq.Disponivel,source_status.eq.Disponível')
    .limit(2500)

  if (error) {
    console.warn('[Radar Insights] Failed to load property index:', error.message)
    return []
  }

  return (data || []).map((property: any) => {
    const amenities = Array.isArray(property.amenities) ? property.amenities.join(' ') : ''
    const text = normalize([
      property.title,
      property.description,
      property.city,
      property.neighborhood,
      property.property_type,
      amenities,
    ].join(' '))

    return {
      id: property.id,
      title: String(property.title || ''),
      city: String(property.city || ''),
      neighborhood: String(property.neighborhood || ''),
      property_type: String(property.property_type || ''),
      price: property.price == null ? null : Number(property.price),
      bedrooms: property.bedrooms == null ? null : Number(property.bedrooms),
      suites: property.suites == null ? null : Number(property.suites),
      parking_spaces: property.parking_spaces == null ? null : Number(property.parking_spaces),
      text,
    }
  })
}

function extractKeywordSignals(keyword: string) {
  const normalized = normalize(keyword)
  const city = Object.entries(CITY_ALIASES).find(([, aliases]) =>
    aliases.some(alias => normalized.includes(alias))
  )?.[0] || null
  const tokens = normalized
    .split(' ')
    .filter(token => token.length > 2 && !STOPWORDS.has(token))

  return {
    normalized,
    city,
    tokens,
    wantsLuxury: /luxo|alto padrao|premium|frente mar|vista mar|barra sul|praia brava|yachthouse|ibiza|one tower/.test(normalized),
    wantsContent: /bairro|valorizacao|investimento|luxo|frente mar|praia brava|vivapark|meia praia/.test(normalized),
    wantsCampaign: /venda|apartamento|cobertura|casa|terreno|condominio|frente mar|alto padrao/.test(normalized),
  }
}

function findRelatedProperties(keyword: string, properties: PropertyIndexItem[]) {
  const signals = extractKeywordSignals(keyword)
  const minMatches = Math.max(1, Math.ceil(Math.min(signals.tokens.length || 1, 6) * 0.35))

  const scored = properties.map(property => {
    const cityMatches = !signals.city || normalize(property.city) === normalize(signals.city) || property.text.includes(normalize(signals.city))
    if (!cityMatches) return null

    let score = 0
    for (const token of signals.tokens) {
      if (property.text.includes(token)) score += 1
    }
    if (signals.normalized.includes('frente mar') && property.text.includes('frente mar')) score += 3
    if (signals.normalized.includes('vista mar') && property.text.includes('vista mar')) score += 2
    if (signals.normalized.includes('alto padrao') && property.text.includes('alto padrao')) score += 2
    if (signals.normalized.includes('4 suites') && property.suites === 4) score += 2
    if (signals.normalized.includes('3 suites') && property.suites === 3) score += 2
    if (signals.normalized.includes('mobiliado') && property.text.includes('mobiliado')) score += 2
    if (score < minMatches) return null

    return { property, score }
  }).filter(Boolean) as Array<{ property: PropertyIndexItem; score: number }>

  return scored
    .sort((a, b) => b.score - a.score || Number(b.property.price || 0) - Number(a.property.price || 0))
    .map(item => item.property)
}

function getPriceStats(properties: PropertyIndexItem[]) {
  const prices = properties
    .map(property => Number(property.price || 0))
    .filter(price => price > 0)
    .sort((a, b) => a - b)
  if (prices.length === 0) return { min: null, max: null, median: null }
  return {
    min: prices[0],
    max: prices[prices.length - 1],
    median: prices[Math.floor(prices.length / 2)],
  }
}

function getPreviousScoreDelta(currentScore: number, previousScore: number | null) {
  if (previousScore == null) return 0
  return currentScore - previousScore
}

function classifyTemperature(score: number) {
  if (score >= 85) return 'prioridade_comercial'
  if (score >= 70) return 'quente'
  if (score >= 45) return 'monitorar'
  return 'frio'
}

function buildFallbackInsight(args: {
  radar: RadarRecord
  trend: TrendInput
  previousScore: number | null
  relatedProperties: PropertyIndexItem[]
}) {
  const { radar, trend, previousScore, relatedProperties } = args
  const trendDelta = getPreviousScoreDelta(trend.currentScore, previousScore)
  const priceStats = getPriceStats(relatedProperties)
  const stockScore = relatedProperties.length >= 20 ? 25 : relatedProperties.length >= 10 ? 20 : relatedProperties.length >= 5 ? 14 : relatedProperties.length >= 1 ? 8 : 0
  const ticketScore = (priceStats.median || 0) >= 5000000 ? 15 : (priceStats.median || 0) >= 3000000 ? 11 : (priceStats.median || 0) >= 1500000 ? 7 : 3
  const momentumScore = trendDelta >= 10 ? 10 : trendDelta >= 5 ? 7 : trendDelta >= 0 ? 4 : 0
  const opportunityScore = clamp((trend.currentScore * 0.35) + stockScore + ticketScore + momentumScore + 5)
  const temperature = classifyTemperature(opportunityScore)
  const signals = extractKeywordSignals(radar.keyword)
  const recommendedActions = [
    opportunityScore >= 70 ? 'Criar ou atualizar conteúdo editorial com leitura de mercado.' : 'Continuar monitorando antes de acionar campanhas.',
    relatedProperties.length > 0 ? 'Selecionar imóveis relacionados para vitrine, blog e campanhas.' : 'Mapear captação ou estoque para atender essa demanda.',
    signals.wantsCampaign && opportunityScore >= 70 ? 'Avaliar campanha de tráfego pago para capturar demanda ativa.' : '',
  ].filter(Boolean)

  const contentOpportunities = signals.wantsContent || opportunityScore >= 70
    ? [`Análise de mercado sobre ${radar.keyword}`, `Guia de investimento: ${radar.keyword}`]
    : []

  return {
    trendDelta,
    priceStats,
    opportunityScore,
    temperature,
    summary: `${radar.keyword} está com score ${trend.currentScore}/100 e ${relatedProperties.length} imóveis relacionados no estoque. O score Pilger indica ${temperature.replace(/_/g, ' ')}.`,
    recommendedActions,
    contentOpportunities,
    campaignRecommendation: signals.wantsCampaign && opportunityScore >= 70
      ? 'Revisar palavras-chave, criativos e landing pages relacionados ao termo.'
      : 'Sem ação de mídia imediata; manter observação.',
    riskNotes: relatedProperties.length === 0
      ? 'Tendência sem estoque relacionado pode gerar demanda que a Pilger não consegue atender agora.'
      : 'Validar qualidade dos cadastros antes de ampliar exposição.',
  }
}

function safeJsonFromText(text: string) {
  const trimmed = text.trim()
  const jsonText = trimmed.startsWith('{')
    ? trimmed
    : trimmed.match(/\{[\s\S]*\}/)?.[0]
  if (!jsonText) return null
  try {
    return JSON.parse(jsonText)
  } catch {
    return null
  }
}

async function runAiAnalysis(args: {
  config: RadarInsightRuntimeConfig
  radar: RadarRecord
  trend: TrendInput
  fallback: ReturnType<typeof buildFallbackInsight>
  relatedProperties: PropertyIndexItem[]
  ecosystemContext?: Record<string, unknown> | null
}) {
  const relatedPreview = args.relatedProperties.slice(0, 8).map(property => ({
    title: property.title,
    city: property.city,
    neighborhood: property.neighborhood,
    type: property.property_type,
    price: property.price,
    bedrooms: property.bedrooms,
    suites: property.suites,
  }))

  const message = `Analise esta oportunidade do radar e retorne JSON válido.

Dados:
${JSON.stringify({
    keyword: args.radar.keyword,
    location: args.radar.location,
    trend_score: args.trend.currentScore,
    trend_type: args.trend.trend,
    average_score: args.trend.averageScore,
    trend_delta: args.fallback.trendDelta,
    opportunity_score: args.fallback.opportunityScore,
    market_temperature: args.fallback.temperature,
    related_properties_count: args.relatedProperties.length,
    price_stats: args.fallback.priceStats,
    related_properties_sample: relatedPreview,
    ecosystem_context: args.ecosystemContext || null,
  }, null, 2)}

Formato obrigatorio:
{
  "summary": "resumo executivo em 1 ou 2 frases",
  "recommended_actions": ["ação 1", "ação 2", "ação 3"],
  "content_opportunities": ["pauta 1", "pauta 2"],
  "campaign_recommendation": "recomendação de tráfego pago",
  "risk_notes": "risco ou cuidado principal",
  "ai_analysis": "análise estratégica curta"
}`

  const response = await generateChatResponse([], message, args.config.systemPrompt)
  const parsed = safeJsonFromText(response)
  if (!parsed) {
    return {
      summary: args.fallback.summary,
      recommended_actions: args.fallback.recommendedActions,
      content_opportunities: args.fallback.contentOpportunities,
      campaign_recommendation: args.fallback.campaignRecommendation,
      risk_notes: args.fallback.riskNotes,
      ai_analysis: response,
    }
  }

  return {
    summary: String(parsed.summary || args.fallback.summary),
    recommended_actions: Array.isArray(parsed.recommended_actions) ? parsed.recommended_actions.map(String).slice(0, 6) : args.fallback.recommendedActions,
    content_opportunities: Array.isArray(parsed.content_opportunities) ? parsed.content_opportunities.map(String).slice(0, 6) : args.fallback.contentOpportunities,
    campaign_recommendation: String(parsed.campaign_recommendation || args.fallback.campaignRecommendation),
    risk_notes: String(parsed.risk_notes || args.fallback.riskNotes),
    ai_analysis: String(parsed.ai_analysis || ''),
  }
}

export async function generateMarketRadarInsight(args: {
  supabase: SupabaseClient
  radar: RadarRecord
  trend: TrendInput
  date: string
  timeSlot: string
  propertyIndex: PropertyIndexItem[]
  config: RadarInsightRuntimeConfig
  allowAi: boolean
}): Promise<RadarInsightResult> {
  const { data: previousRows } = await args.supabase
    .from('market_radar_data')
    .select('trend_score,date,time_slot')
    .eq('radar_id', args.radar.id)
    .order('date', { ascending: false })
    .order('time_slot', { ascending: false })
    .limit(6)

  const previousRow = (previousRows || []).find((row: any) => !(row.date === args.date && row.time_slot === args.timeSlot))
  const previousScore = previousRow?.trend_score == null ? null : Number(previousRow.trend_score)
  const relatedProperties = findRelatedProperties(args.radar.keyword, args.propertyIndex)
  const fallback = buildFallbackInsight({
    radar: args.radar,
    trend: args.trend,
    previousScore,
    relatedProperties,
  })
  const shouldUseAi = args.allowAi
    && args.config.aiEnabled
    && fallback.opportunityScore >= args.config.minOpportunityScoreForAi

  let aiPayload = {
    summary: fallback.summary,
    recommended_actions: fallback.recommendedActions,
    content_opportunities: fallback.contentOpportunities,
    campaign_recommendation: fallback.campaignRecommendation,
    risk_notes: fallback.riskNotes,
    ai_analysis: null as string | null,
  }
  let aiUsed = false

  if (shouldUseAi) {
    try {
      const ecosystemContext = await getAgentEcosystemContext({ supabase: args.supabase, agent: 'radar', days: 30 })
      aiPayload = await runAiAnalysis({
        config: args.config,
        radar: args.radar,
        trend: args.trend,
        fallback,
        relatedProperties,
        ecosystemContext: {
          brief: buildAgentContextBrief(ecosystemContext),
          signals: ecosystemContext.signals,
          source_counts: ecosystemContext.source_counts,
        },
      })
      aiUsed = true
    } catch (error: any) {
      console.warn(`[Radar Insights] AI analysis failed for "${args.radar.keyword}":`, error?.message || error)
    }
  }

  const relatedPreview = relatedProperties.slice(0, 8).map(property => ({
    id: property.id,
    title: property.title,
    city: property.city,
    neighborhood: property.neighborhood,
    type: property.property_type,
    price: property.price,
    suites: property.suites,
  }))

  const row = {
    radar_id: args.radar.id,
    keyword: args.radar.keyword,
    location: args.radar.location || 'BR',
    date: args.date,
    time_slot: args.timeSlot,
    trend_score: args.trend.currentScore,
    previous_score: previousScore,
    trend_delta: fallback.trendDelta,
    opportunity_score: fallback.opportunityScore,
    market_temperature: fallback.temperature,
    summary: aiPayload.summary,
    recommended_actions: aiPayload.recommended_actions,
    related_properties_count: relatedProperties.length,
    related_properties: relatedPreview,
    related_leads_count: 0,
    content_opportunities: aiPayload.content_opportunities,
    campaign_recommendation: aiPayload.campaign_recommendation,
    risk_notes: aiPayload.risk_notes,
    ai_analysis: aiPayload.ai_analysis,
    source_metrics: {
      average_score: args.trend.averageScore,
      trend_type: args.trend.trend,
      price_stats: fallback.priceStats,
      ai_used: aiUsed,
    },
    generated_by: aiUsed ? 'radar_ai' : 'radar_rules',
    updated_at: new Date().toISOString(),
  }

  const { error } = await args.supabase
    .from('market_radar_insights')
    .upsert(row, { onConflict: 'radar_id,date,time_slot' })

  if (error) {
    console.warn(`[Radar Insights] Failed to save insight for "${args.radar.keyword}":`, error.message)
  } else {
    await recordEcosystemEvent({
      supabase: args.supabase,
      eventType: 'market_radar_insight_created',
      actorType: 'agent',
      entityType: 'market_radar_insight',
      entityId: `${args.radar.id}:${args.date}:${args.timeSlot}`,
      source: 'market-radar-agent',
      label: `${args.radar.keyword} - ${args.radar.location || 'BR'}`,
      importanceScore: fallback.opportunityScore,
      metadata: {
        keyword: args.radar.keyword,
        location: args.radar.location || 'BR',
        date: args.date,
        time_slot: args.timeSlot,
        opportunity_score: fallback.opportunityScore,
        market_temperature: fallback.temperature,
        summary: aiPayload.summary,
        recommended_actions: aiPayload.recommended_actions,
        content_opportunities: aiPayload.content_opportunities,
        campaign_recommendation: aiPayload.campaign_recommendation,
        ai_used: aiUsed,
      },
    }).catch((eventError: any) => {
      console.warn(`[Radar Insights] Ecosystem event failed for "${args.radar.keyword}":`, eventError?.message || eventError)
    })
  }

  return {
    opportunity_score: fallback.opportunityScore,
    market_temperature: fallback.temperature,
    summary: aiPayload.summary,
    recommended_actions: aiPayload.recommended_actions,
    related_properties_count: relatedProperties.length,
    related_properties: relatedPreview,
    related_leads_count: 0,
    content_opportunities: aiPayload.content_opportunities,
    campaign_recommendation: aiPayload.campaign_recommendation,
    risk_notes: aiPayload.risk_notes,
    ai_analysis: aiPayload.ai_analysis,
    ai_used: aiUsed,
  }
}
