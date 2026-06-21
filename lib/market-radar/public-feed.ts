import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseAbortSignal, summarizeSupabaseError } from '@/lib/supabase/server'

export type MarketTickerItem = {
  label: string
  value: string
  tone: 'up' | 'down' | 'neutral'
}

export type MarketHighlight = {
  keyword: string
  score: number
  temperature: string
  summary: string
  relatedPropertiesCount: number
}

export type MarketRegionSignal = {
  label: string
  score: number
  description: string
}

export type PublicMarketRadarFeed = {
  updatedAt: string
  source: 'live' | 'fallback'
  ticker: MarketTickerItem[]
  highlights: MarketHighlight[]
  regions: MarketRegionSignal[]
}

const FALLBACK_FEED: PublicMarketRadarFeed = {
  updatedAt: new Date().toISOString(),
  source: 'fallback',
  ticker: [
    { label: 'Praia Brava Premium', value: '+18.4% anual', tone: 'up' },
    { label: 'Balneário Camboriú Luxo', value: 'R$ 62.300 m²', tone: 'up' },
    { label: 'Frente Mar SC', value: 'demanda aquecida', tone: 'up' },
    { label: 'VivaPark Porto Belo', value: 'oportunidade alta', tone: 'up' },
    { label: 'INCC Mensal', value: '+0.42%', tone: 'neutral' },
    { label: 'Selic', value: '10.75%', tone: 'neutral' },
  ],
  highlights: [
    {
      keyword: 'Apartamento frente mar Balneário Camboriú',
      score: 91,
      temperature: 'prioridade comercial',
      summary: 'Demanda aquecida para ativos premium frente mar, com leitura positiva para conteúdo, vitrine e tráfego qualificado.',
      relatedPropertiesCount: 0,
    },
    {
      keyword: 'Praia Brava alto padrão',
      score: 86,
      temperature: 'quente',
      summary: 'A região segue como tese forte de valorização, combinando escassez, liquidez e interesse de investidores.',
      relatedPropertiesCount: 0,
    },
    {
      keyword: 'VivaPark Porto Belo',
      score: 82,
      temperature: 'quente',
      summary: 'Bairros planejados continuam ganhando força no radar de investimento imobiliário de Santa Catarina.',
      relatedPropertiesCount: 0,
    },
  ],
  regions: [
    { label: 'Balneário Camboriú', score: 92, description: 'Luxo vertical e frente mar' },
    { label: 'Praia Brava', score: 88, description: 'Alto padrão e lifestyle' },
    { label: 'Itapema', score: 79, description: 'Liquidez e segunda moradia' },
  ],
}

function normalizeTemperature(value: string) {
  return String(value || 'monitorar').replace(/_/g, ' ')
}

function getTickerValue(row: any) {
  const delta = Number(row.trend_delta || 0)
  const score = Number(row.opportunity_score || 0)
  if (delta > 0) return `+${delta} pts`
  if (delta < 0) return `${delta} pts`
  if (score >= 85) return 'prioridade'
  if (score >= 70) return 'quente'
  return `${score}/100`
}

function getTone(row: any): MarketTickerItem['tone'] {
  const delta = Number(row.trend_delta || 0)
  const score = Number(row.opportunity_score || 0)
  if (delta < -5) return 'down'
  if (delta > 0 || score >= 70) return 'up'
  return 'neutral'
}

function inferRegion(keyword: string) {
  const text = keyword.toLowerCase()
  if (text.includes('praia brava')) return 'Praia Brava'
  if (text.includes('balneario') || text.includes('camboriu')) return 'Balneário Camboriú'
  if (text.includes('itapema') || text.includes('meia praia')) return 'Itapema'
  if (text.includes('porto belo') || text.includes('vivapark') || text.includes('pereque')) return 'Porto Belo'
  return 'Santa Catarina'
}

function buildRegionSignals(rows: any[]) {
  const grouped = new Map<string, { total: number; count: number; related: number }>()
  for (const row of rows) {
    const region = inferRegion(String(row.keyword || ''))
    const current = grouped.get(region) || { total: 0, count: 0, related: 0 }
    current.total += Number(row.opportunity_score || 0)
    current.count += 1
    current.related += Number(row.related_properties_count || 0)
    grouped.set(region, current)
  }

  return Array.from(grouped.entries())
    .map(([label, values]) => ({
      label,
      score: Math.round(values.total / Math.max(1, values.count)),
      description: values.related > 0 ? `${values.related} imóveis conectados ao radar` : 'Sinal de mercado em observação',
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
}

export async function getPublicMarketRadarFeed(): Promise<PublicMarketRadarFeed> {
  try {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from('market_radar_insights')
      .select('keyword,opportunity_score,market_temperature,summary,related_properties_count,trend_delta,created_at')
      .order('created_at', { ascending: false })
      .limit(24)
      .abortSignal(createSupabaseAbortSignal())

    if (error) {
      console.warn('[Public Market Feed] Falling back:', summarizeSupabaseError(error))
      return { ...FALLBACK_FEED, updatedAt: new Date().toISOString() }
    }

    const rows = (data || [])
      .filter((row: any) => Number(row.opportunity_score || 0) >= 45)
      .sort((a: any, b: any) => Number(b.opportunity_score || 0) - Number(a.opportunity_score || 0))

    if (rows.length === 0) {
      return { ...FALLBACK_FEED, updatedAt: new Date().toISOString() }
    }

    const ticker = rows.slice(0, 10).map((row: any) => ({
      label: String(row.keyword || 'Radar de Mercado'),
      value: getTickerValue(row),
      tone: getTone(row),
    }))

    const highlights = rows.slice(0, 3).map((row: any) => ({
      keyword: String(row.keyword || 'Radar de Mercado'),
      score: Number(row.opportunity_score || 0),
      temperature: normalizeTemperature(row.market_temperature),
      summary: String(row.summary || 'Sinal de mercado monitorado pela inteligência Pilger.'),
      relatedPropertiesCount: Number(row.related_properties_count || 0),
    }))

    return {
      updatedAt: String(rows[0]?.created_at || new Date().toISOString()),
      source: 'live',
      ticker,
      highlights,
      regions: buildRegionSignals(rows),
    }
  } catch (error) {
    console.warn('[Public Market Feed] Unexpected fallback:', summarizeSupabaseError(error))
    return { ...FALLBACK_FEED, updatedAt: new Date().toISOString() }
  }
}
