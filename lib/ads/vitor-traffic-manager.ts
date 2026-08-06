import { chatWithGemini } from '@/lib/gemini'
import { getAiAutomationGate } from '@/lib/ai/automation-control'
import { VITOR_CREATIVE_REVIEW_RUNTIME_GUARDRAILS, VITOR_CREATIVE_REVIEW_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import {
  buildCentralContextPrompt,
  getAgentCentralContext,
  recordAgentCentralSignal,
  saveAgentCentralSnapshot,
} from '@/lib/intelligence/agent-runtime'
import type { DatePreset } from '@/lib/ads/meta'
import { buildVitorMonitoringSnapshot, persistVitorMonitoringSnapshot, type VitorMonitoringSnapshot } from '@/lib/ads/vitor-monitoring'
import { sendWhatsAppMessage } from '@/lib/connectyhub/whatsapp'

type SupabaseLike = {
  from: (table: string) => any
}

export type MediaItem = {
  url: string
  mime: string
  kind: string
  filename?: string | null
}

type VitorCampaignPlan = {
  objective: string
  audience: Record<string, unknown>
  locations: Array<Record<string, unknown>>
  budget_suggestion: Record<string, unknown>
  duration_days: number
  copy_variations: Array<Record<string, unknown>>
  utm: Record<string, unknown>
  pause_scale_rules: Record<string, unknown>
}

type VitorCreativeAnalysis = {
  score: number
  score_label: string
  recommendation: string
  decision: string
  strengths: string[]
  risks: string[]
  improvements: string[]
  persona: Record<string, unknown>
  locations: Array<Record<string, unknown>>
  campaign_angle: Record<string, unknown>
  expected_lead_quality: Record<string, unknown>
  approval_question: string
  campaign_plan: VitorCampaignPlan
  raw?: Record<string, unknown>
  fallback?: boolean
}

export type ProcessVitorPaidTrafficCommandResult = {
  handled: boolean
  whatsappSent: boolean
  creativeId?: string
  reviewId?: string
  campaignPlanId?: string
  decisionAction?: string
  score?: number
  monitoringHealth?: number
  monitoringAlerts?: number
  responseText?: string
  error?: string
  fallback?: boolean
}

type ProcessVitorPaidTrafficCommandParams = {
  supabase: SupabaseLike
  command: any
  instance?: any
  instanceToken?: string | null
  sendResponse?: boolean
}

type ProcessVitorPanelCreativeParams = {
  supabase: SupabaseLike
  title?: string | null
  briefing?: string | null
  mediaItems?: MediaItem[]
  assetType?: string | null
  contentType?: string | null
  requestedByLabel?: string | null
  createdBy?: string | null
  propertySku?: string | null
}

export type ProcessVitorPanelCreativeResult = {
  creativeId: string
  reviewId: string
  campaignPlanId: string
  score: number
  fallback?: boolean
}

const DEFAULT_COPY_VARIATIONS = [
  {
    label: 'Direto',
    primary_text: 'Conheca uma oportunidade imobiliaria selecionada pela Pilger. Fale com nossa equipe e receba os detalhes.',
    headline: 'Oportunidade Pilger',
    cta: 'Falar no WhatsApp',
  },
]

function cleanString(value: unknown, max = 3000) {
  const text = String(value || '').trim().replace(/\s+/g, ' ')
  return text.length > max ? text.slice(0, max) : text
}

function safeJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function safeArray(value: unknown, max = 8): string[] {
  if (Array.isArray(value)) {
    return value
      .map(item => cleanString(item, 220))
      .filter(Boolean)
      .slice(0, max)
  }
  return cleanString(value)
    .split(/\n|;/)
    .map(item => cleanString(item, 220))
    .filter(Boolean)
    .slice(0, max)
}

function clampScore(value: unknown) {
  const score = Number(value)
  if (!Number.isFinite(score)) return 50
  return Math.min(100, Math.max(0, Math.round(score)))
}

function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
}

function pickMediaUrl(value: Record<string, unknown>) {
  return cleanString(
    value.stored_url
    || value.r2_url
    || value.url
    || value.mediaUrl
    || value.file_url
    || value.original_url
    || value.originalUrl,
    1200,
  )
}

function extractCommandMedia(command: any): MediaItem[] {
  const payload = safeJsonObject(command?.payload)
  const mediaRows = Array.isArray(payload.media) ? payload.media : []
  return mediaRows
    .map((item): MediaItem | null => {
      const media = safeJsonObject(item)
      const url = pickMediaUrl(media)
      if (!url) return null
      return {
        url,
        mime: cleanString(media.mime || media.mimetype || media.media_mimetype, 160),
        kind: cleanString(media.media_kind || media.kind || media.type || payload.message_type || 'media', 60),
        filename: cleanString(media.filename, 180) || null,
      }
    })
    .filter((item): item is MediaItem => Boolean(item))
    .slice(0, 10)
}

function inferAssetType(mediaItems: MediaItem[], command: any) {
  const media = mediaItems[0]
  const signature = `${media?.kind || ''} ${media?.mime || ''} ${command?.payload?.message_type || ''}`.toLowerCase()
  if (mediaItems.length > 1) return 'carousel'
  if (signature.includes('video') || signature.includes('mp4')) return 'video'
  if (signature.includes('image') || signature.includes('jpeg') || signature.includes('png') || signature.includes('webp')) return 'image'
  if (signature.includes('document') || signature.includes('pdf')) return 'document'
  return 'other'
}

function inferContentType(assetType: string, text: string) {
  const normalized = text.toLowerCase()
  if (normalized.includes('story')) return 'story'
  if (normalized.includes('reel') || assetType === 'video') return 'reel'
  if (normalized.includes('email')) return 'email'
  return 'ad'
}

function buildCreativeTitle(command: any) {
  const text = cleanString(command?.command_text, 90)
  if (text) return `Vitor - ${text}`.slice(0, 160)
  const label = cleanString(command?.identity_label, 80) || cleanString(command?.phone, 40) || 'WhatsApp Global'
  return `Vitor - criativo recebido de ${label}`.slice(0, 160)
}

function summarizeMedia(mediaItems: MediaItem[]) {
  if (!mediaItems.length) return 'Sem arquivo de midia anexado; analise baseada no briefing escrito.'
  return mediaItems
    .map((item, index) => {
      const parts = [
        `#${index + 1}`,
        item.kind || 'media',
        item.mime || 'mime desconhecido',
        item.filename ? `arquivo ${item.filename}` : '',
      ].filter(Boolean)
      return parts.join(' - ')
    })
    .join('\n')
}

async function ensureCreativeFromCommand(supabase: SupabaseLike, command: any) {
  const payload = safeJsonObject(command?.payload)
  const existingCreativeId = cleanString(payload.creative_id, 80)
  if (existingCreativeId) {
    const existing = await supabase
      .from('marketing_creatives')
      .select('*')
      .eq('id', existingCreativeId)
      .maybeSingle()
    if (existing.data?.id) return existing.data
  }

  const mediaItems = extractCommandMedia(command)
  const assetType = inferAssetType(mediaItems, command)
  const text = cleanString(command?.command_text, 2400)
  const now = new Date().toISOString()
  const row = {
    title: buildCreativeTitle(command),
    description: text || null,
    asset_url: mediaItems[0]?.url || null,
    thumbnail_url: mediaItems.find(item => item.kind === 'image')?.url || null,
    asset_type: assetType,
    content_type: inferContentType(assetType, text),
    campaign_type: 'paid',
    platform_targets: ['meta_ads'],
    property_sku: null,
    ai_context: [
      'Criativo recebido pelo WhatsApp Global para analise do Vitor Trafego Pago.',
      text ? `Briefing: ${text}` : '',
      mediaItems.length ? `Midias: ${summarizeMedia(mediaItems)}` : '',
    ].filter(Boolean).join('\n').slice(0, 3000),
    status: 'review',
    created_by: command?.identity_type === 'admin_user' && isUuid(command?.identity_id) ? command.identity_id : null,
    raw: {
      source: 'whatsapp_global',
      whatsapp_global_command_id: command?.id || null,
      whatsapp_global_session_id: command?.session_id || null,
      requested_by_phone: command?.phone || null,
      requested_by_label: command?.identity_label || null,
      media: mediaItems,
      payload,
    },
    updated_at: now,
  }

  const { data, error } = await supabase
    .from('marketing_creatives')
    .insert(row)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Nao foi possivel criar o criativo do Vitor.')
  }

  return data
}

async function ensureCreativeFromPanel(params: {
  supabase: SupabaseLike
  title?: string | null
  briefing?: string | null
  mediaItems: MediaItem[]
  assetType?: string | null
  contentType?: string | null
  requestedByLabel?: string | null
  createdBy?: string | null
  propertySku?: string | null
}) {
  const { supabase, mediaItems } = params
  const briefing = cleanString(params.briefing, 3000)
  const requestedAssetType = cleanString(params.assetType, 40)
  const inferredAssetType = inferAssetType(mediaItems, { payload: { message_type: mediaItems[0]?.kind || '' } })
  const assetType = ['image', 'video', 'carousel', 'document', 'other'].includes(requestedAssetType)
    ? requestedAssetType
    : inferredAssetType
  const requestedContentType = cleanString(params.contentType, 40)
  const contentType = ['post', 'reel', 'story', 'ad', 'short', 'email', 'other'].includes(requestedContentType)
    ? requestedContentType
    : inferContentType(assetType, briefing)
  const now = new Date().toISOString()
  const title = cleanString(params.title, 160)
    || (briefing ? `Vitor - ${briefing.slice(0, 70)}` : `Vitor - upload painel ${new Date().toLocaleDateString('pt-BR')}`)

  const { data, error } = await supabase
    .from('marketing_creatives')
    .insert({
      title,
      description: briefing || null,
      asset_url: mediaItems[0]?.url || null,
      thumbnail_url: mediaItems.find(item => item.kind === 'image' || item.mime.startsWith('image/'))?.url || null,
      asset_type: assetType,
      content_type: contentType,
      campaign_type: 'paid',
      platform_targets: ['meta_ads'],
      property_sku: cleanString(params.propertySku, 80) || null,
      ai_context: [
        'Criativo enviado pelo painel para analise do Vitor Trafego Pago.',
        briefing ? `Briefing: ${briefing}` : '',
        mediaItems.length ? `Midias: ${summarizeMedia(mediaItems)}` : '',
      ].filter(Boolean).join('\n').slice(0, 3000),
      status: 'review',
      created_by: isUuid(params.createdBy) ? params.createdBy : null,
      raw: {
        source: 'vitor_panel',
        media: mediaItems,
        requested_by_label: cleanString(params.requestedByLabel, 120) || null,
      },
      updated_at: now,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Nao foi possivel criar o criativo do painel do Vitor.')
  }

  return data
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = String(text || '')
    .replace(/```json/gi, '```')
    .replace(/```/g, '')
    .trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

function normalizePlan(value: unknown, analysis: Record<string, unknown>, score: number): VitorCampaignPlan {
  const plan = safeJsonObject(value)
  const campaignAngle = safeJsonObject(analysis.campaign_angle)
  const dailyBudget = score >= 70 ? 80 : score >= 50 ? 50 : 30
  const durationDays = score >= 70 ? 7 : 3
  const locations = Array.isArray(analysis.locations) ? analysis.locations as Array<Record<string, unknown>> : []

  return {
    objective: cleanString(plan.objective, 500) || 'Gerar conversas qualificadas no WhatsApp sem publicar automaticamente antes de aprovacao humana.',
    audience: safeJsonObject(plan.audience),
    locations: Array.isArray(plan.locations) ? plan.locations as Array<Record<string, unknown>> : locations,
    budget_suggestion: {
      daily_budget_brl: dailyBudget,
      total_test_budget_brl: dailyBudget * durationDays,
      rationale: score >= 70
        ? 'Score bom para teste inicial com leitura rapida de CPL e qualidade.'
        : 'Score pede teste controlado para evitar desperdicio enquanto o criativo melhora.',
      ...safeJsonObject(plan.budget_suggestion),
    },
    duration_days: Number(plan.duration_days) > 0 ? Math.min(30, Math.round(Number(plan.duration_days))) : durationDays,
    copy_variations: Array.isArray(plan.copy_variations) && plan.copy_variations.length
      ? plan.copy_variations as Array<Record<string, unknown>>
      : [{
        label: 'Vitor inicial',
        primary_text: cleanString(campaignAngle.primary_text, 500) || DEFAULT_COPY_VARIATIONS[0].primary_text,
        headline: cleanString(campaignAngle.headline, 120) || DEFAULT_COPY_VARIATIONS[0].headline,
        cta: cleanString(campaignAngle.cta, 80) || DEFAULT_COPY_VARIATIONS[0].cta,
      }],
    utm: {
      source: 'meta_ads',
      medium: 'paid_social',
      campaign: 'vitor_whatsapp_global',
      content: 'creative_review',
      ...safeJsonObject(plan.utm),
    },
    pause_scale_rules: {
      pause_if: ['CPL acima do esperado depois de volume minimo', 'leads sem perfil comercial', 'CTR muito baixo no teste'],
      scale_if: ['CPL saudavel', 'conversas reais no CRM', 'corretor valida qualidade dos leads'],
      ...safeJsonObject(plan.pause_scale_rules),
    },
  }
}

function normalizeAnalysis(parsed: Record<string, unknown> | null, command: any, mediaItems: MediaItem[]): VitorCreativeAnalysis {
  const source = parsed || {}
  const score = clampScore(source.score)
  const hasMedia = mediaItems.length > 0
  const fallback = !parsed
  const fallbackRisks = [
    'Ainda nao ha leitura visual profunda confirmada deste criativo.',
    'A atribuicao atual de trafego pago precisa ser tratada com cautela antes de escalar verba.',
    hasMedia ? 'Validar se o arquivo abre corretamente no painel antes de subir campanha.' : 'Criativo sem midia anexada depende muito do briefing.',
  ]

  const analysisShape: Record<string, unknown> = {
    score,
    score_label: cleanString(source.score_label, 80) || (score >= 75 ? 'bom' : score >= 55 ? 'medio' : 'baixo'),
    recommendation: cleanString(source.recommendation, 1000) || 'Rodar apenas como teste controlado, com aprovacao humana e leitura de qualidade dos leads antes de aumentar verba.',
    decision: cleanString(source.decision, 400) || 'nao_publicar_sem_aprovacao_humana',
    strengths: safeArray(source.strengths).length ? safeArray(source.strengths) : [
      'Comando chegou por canal autorizado do WhatsApp Global.',
      hasMedia ? 'Ha midia vinculada ao pedido.' : 'Ha briefing textual para orientar a primeira analise.',
    ],
    risks: safeArray(source.risks).length ? safeArray(source.risks) : fallbackRisks,
    improvements: safeArray(source.improvements).length ? safeArray(source.improvements) : [
      'Conferir se o hook aparece nos primeiros segundos ou na primeira dobra.',
      'Deixar oferta, localizacao e proximo passo muito claros.',
      'Usar UTM e acompanhar qualidade no CRM, nao apenas volume de conversas.',
    ],
    persona: {
      label: 'lead imobiliario de media/alta intencao',
      intent: 'avaliar oportunidade imobiliaria',
      objections: ['preco', 'localizacao', 'confianca no anuncio'],
      ...safeJsonObject(source.persona),
    },
    locations: Array.isArray(source.locations) && source.locations.length ? source.locations : [
      { name: 'Regioes comerciais ja validadas pela Pilger', priority: 'media', reason: 'Sem local especifico no briefing.' },
    ],
    campaign_angle: {
      hook: 'Oportunidade imobiliaria selecionada',
      offer: 'Atendimento consultivo via WhatsApp',
      cta: 'Falar no WhatsApp',
      ...safeJsonObject(source.campaign_angle),
    },
    expected_lead_quality: {
      quality: score >= 70 ? 'boa' : score >= 50 ? 'media' : 'instavel',
      reason: 'Qualidade depende do encaixe entre criativo, oferta, regiao e follow-up comercial.',
      ...safeJsonObject(source.expected_lead_quality),
    },
    approval_question: cleanString(source.approval_question, 500) || 'Quer que eu melhore o criativo primeiro ou prefere rodar um teste controlado mesmo assim?',
  }

  return {
    score: analysisShape.score as number,
    score_label: analysisShape.score_label as string,
    recommendation: analysisShape.recommendation as string,
    decision: analysisShape.decision as string,
    strengths: analysisShape.strengths as string[],
    risks: analysisShape.risks as string[],
    improvements: analysisShape.improvements as string[],
    persona: analysisShape.persona as Record<string, unknown>,
    locations: analysisShape.locations as Array<Record<string, unknown>>,
    campaign_angle: analysisShape.campaign_angle as Record<string, unknown>,
    expected_lead_quality: analysisShape.expected_lead_quality as Record<string, unknown>,
    approval_question: analysisShape.approval_question as string,
    campaign_plan: normalizePlan(source.campaign_plan, analysisShape, score),
    raw: source,
    fallback,
  }
}

async function getLatestPaidReport(supabase: SupabaseLike) {
  try {
    const { data } = await supabase
      .from('marketing_ai_reports')
      .select('id, title, summary, recommendations, metrics, created_at')
      .eq('report_type', 'paid')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data || null
  } catch {
    return null
  }
}

async function getConfiguredVitorPrompt(supabase: SupabaseLike) {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'vitor_creative_review_system_prompt')
      .maybeSingle()

    if (error) throw error

    const value = cleanString(data?.value, 12000)
    if (value) return `${value}\n\n${VITOR_CREATIVE_REVIEW_RUNTIME_GUARDRAILS}`
  } catch (error: any) {
    console.warn('[Vitor] prompt config unavailable:', error?.message || error)
  }

  return `${VITOR_CREATIVE_REVIEW_SYSTEM_PROMPT}\n\n${VITOR_CREATIVE_REVIEW_RUNTIME_GUARDRAILS}`
}

async function runVitorAnalysis(params: {
  supabase: SupabaseLike
  command: any
  creative: any
  mediaItems: MediaItem[]
}) {
  const { supabase, command, creative, mediaItems } = params
  const aiGate = await getAiAutomationGate({
    supabase,
    agentId: 'ads-analyst',
    enabledKey: 'vitor_ai_enabled',
  })
  if (!aiGate.allowed) {
    return normalizeAnalysis(null, command, mediaItems)
  }

  const commandSource = cleanString(command?.payload?.source, 80)
  const [centralContext, latestPaidReport, systemPrompt] = await Promise.all([
    getAgentCentralContext({
      supabase,
      agentId: 'ads-analyst',
      days: 30,
      limit: 90,
      recordRead: true,
    })
      .then(context => buildCentralContextPrompt(context))
      .catch((error: any) => {
        console.warn('[Vitor] central context unavailable:', error?.message || error)
        return ''
      }),
    getLatestPaidReport(supabase),
    getConfiguredVitorPrompt(supabase),
  ])

  const userMessage = [
    centralContext,
    latestPaidReport ? [
      'ULTIMO RELATORIO DE TRAFEGO PAGO',
      `Titulo: ${cleanString(latestPaidReport.title, 240)}`,
      `Resumo: ${cleanString(latestPaidReport.summary, 700)}`,
      `Metricas: ${JSON.stringify(latestPaidReport.metrics || {}).slice(0, 1200)}`,
      `Recomendacoes: ${JSON.stringify(latestPaidReport.recommendations || []).slice(0, 1200)}`,
    ].join('\n') : '',
    commandSource === 'vitor_panel'
      ? 'CRIATIVO ENVIADO PELO PAINEL DO VITOR'
      : 'COMANDO RECEBIDO PELO WHATSAPP GLOBAL',
    `Solicitante: ${cleanString(command?.identity_label, 160)} (${cleanString(command?.identity_type, 80)})`,
    `Texto: ${cleanString(command?.command_text, 2400) || '[sem texto]'}`,
    '',
    'CRIATIVO REGISTRADO',
    `Titulo: ${cleanString(creative?.title, 180)}`,
    `Tipo: ${cleanString(creative?.asset_type, 80)} / ${cleanString(creative?.content_type, 80)}`,
    `Midias: ${summarizeMedia(mediaItems)}`,
  ].filter(Boolean).join('\n\n')

  try {
    const response = await Promise.race([
      chatWithGemini({
        systemPrompt,
        history: [],
        userMessage,
        temperature: 0.25,
        maxTokens: 1800,
      }),
      new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('Tempo limite na analise do Vitor.')), 18000)
      }),
    ])
    return normalizeAnalysis(extractJsonObject(response), command, mediaItems)
  } catch (error: any) {
    console.warn('[Vitor] Gemini analysis failed, using fallback:', error?.message || error)
    return normalizeAnalysis(null, command, mediaItems)
  }
}

async function insertReview(params: {
  supabase: SupabaseLike
  command: any
  creative: any
  mediaItems: MediaItem[]
  analysis: VitorCreativeAnalysis
  source?: string
}) {
  const { supabase, command, creative, mediaItems, analysis } = params
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('paid_traffic_creative_reviews')
    .insert({
      command_id: command?.id || null,
      creative_id: creative?.id || null,
      requested_by_phone: command?.phone || null,
      requested_by_label: command?.identity_label || null,
      source: params.source || 'whatsapp_global',
      asset_summary: summarizeMedia(mediaItems),
      briefing: cleanString(command?.command_text, 3000) || null,
      score: analysis.score,
      score_label: analysis.score_label,
      status: analysis.score >= 60 ? 'reviewed' : 'needs_improvement',
      recommendation: analysis.recommendation,
      decision: analysis.decision,
      strengths: analysis.strengths,
      risks: analysis.risks,
      improvements: analysis.improvements,
      persona: analysis.persona,
      locations: analysis.locations,
      campaign_angle: analysis.campaign_angle,
      expected_lead_quality: analysis.expected_lead_quality,
      approval_question: analysis.approval_question,
      raw_analysis: {
        ...(analysis.raw || {}),
        fallback: Boolean(analysis.fallback),
        creative_id: creative?.id || null,
      },
      updated_at: now,
    })
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message || 'Nao foi possivel salvar a analise do Vitor.')
  return data
}

async function insertCampaignPlan(params: {
  supabase: SupabaseLike
  command: any
  creative: any
  review: any
  analysis: VitorCreativeAnalysis
}) {
  const { supabase, command, creative, review, analysis } = params
  const plan = analysis.campaign_plan
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('paid_traffic_campaign_plans')
    .insert({
      review_id: review?.id || null,
      command_id: command?.id || null,
      creative_id: creative?.id || null,
      status: 'draft',
      objective: plan.objective,
      audience: plan.audience,
      locations: plan.locations,
      budget_suggestion: plan.budget_suggestion,
      duration_days: plan.duration_days,
      copy_variations: plan.copy_variations,
      utm: plan.utm,
      pause_scale_rules: plan.pause_scale_rules,
      raw_plan: plan,
      updated_at: now,
    })
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message || 'Nao foi possivel salvar o rascunho de campanha do Vitor.')
  return data
}

function buildWhatsAppReviewMessage(analysis: VitorCreativeAnalysis) {
  const strengths = analysis.strengths.slice(0, 3).map(item => `- ${item}`)
  const risks = analysis.risks.slice(0, 3).map(item => `- ${item}`)
  const improvements = analysis.improvements.slice(0, 3).map(item => `- ${item}`)
  const budget = safeJsonObject(analysis.campaign_plan.budget_suggestion)
  const dailyBudget = budget.daily_budget_brl ? `R$ ${budget.daily_budget_brl}/dia` : 'verba teste controlada'

  return [
    'Vitor Trafego Pago recebeu seu pedido.',
    '',
    `Score do criativo: ${analysis.score}/100 (${analysis.score_label})`,
    `Leitura: ${analysis.recommendation}`,
    '',
    'Pontos fortes:',
    strengths.length ? strengths.join('\n') : '- Briefing recebido.',
    '',
    'Riscos:',
    risks.length ? risks.join('\n') : '- Sem riscos criticos identificados agora.',
    '',
    'Melhorias sugeridas:',
    improvements.length ? improvements.join('\n') : '- Manter teste pequeno e medir qualidade no CRM.',
    '',
    'Rascunho de campanha:',
    `- Objetivo: ${analysis.campaign_plan.objective}`,
    `- Verba teste: ${dailyBudget} por ${analysis.campaign_plan.duration_days} dias`,
    '- Status: aguardando aprovacao humana, nada foi publicado ainda.',
    '- Registro: salvo no painel e na Central de Inteligencia.',
    '',
    analysis.approval_question,
  ].filter(Boolean).join('\n')
}

function moneyLabel(value: unknown) {
  const number = Number(value || 0)
  if (!Number.isFinite(number) || number <= 0) return 'R$ 0'
  return `R$ ${number.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

function percentLabel(value: unknown) {
  const number = Number(value || 0)
  if (!Number.isFinite(number)) return '0%'
  return `${number.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function compactMonitoringLabel(value: unknown, fallback: string, max = 90) {
  return cleanString(value, max) || fallback
}

function wholeNumberLabel(value: unknown) {
  const number = Number(value || 0)
  if (!Number.isFinite(number) || number <= 0) return '0'
  return Math.round(number).toLocaleString('pt-BR')
}

function monitoringDatePresetLabel(value: unknown) {
  const preset = String(value || '')
  if (preset === 'today') return 'hoje'
  if (preset === 'yesterday') return 'ontem'
  if (preset === 'this_month') return 'este mes'
  if (preset === 'last_month') return 'mes passado'
  if (preset === 'last_30d') return 'ultimos 30 dias'
  if (preset === 'maximum') return 'periodo maximo'
  return 'ultimos 7 dias'
}

function resolveMonitoringDatePreset(commandText: unknown): DatePreset {
  const normalized = cleanString(commandText, 500)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (/\b(hoje|agora)\b/.test(normalized)) return 'today'
  if (/\bontem\b/.test(normalized)) return 'yesterday'
  if (/\b(ultimos\s*30|30\s*dias|mensal)\b/.test(normalized)) return 'last_30d'
  if (/\b(este\s*mes|mes\s*atual)\b/.test(normalized)) return 'this_month'
  return 'last_7d'
}

function buildCampaignMonitoringLine(campaign: any, index: number) {
  const name = compactMonitoringLabel(campaign?.name || campaign?.campaign_name || campaign?.id, 'Campanha sem nome')
  const spend = Number(campaign?.spend || 0)
  const leads = Number(campaign?.leads || 0)
  const clicks = Number(campaign?.clicks || 0)
  const cpl = Number(campaign?.cpl || campaign?.cost_per_lead || 0)
  const parts = [
    spend > 0 ? `gasto ${moneyLabel(spend)}` : '',
    leads > 0 ? `${wholeNumberLabel(leads)} lead(s)` : '',
    clicks > 0 ? `${wholeNumberLabel(clicks)} clique(s)` : '',
    Number(campaign?.ctr || 0) > 0 ? `CTR ${percentLabel(campaign?.ctr)}` : '',
    cpl > 0 ? `CPL ${moneyLabel(cpl)}` : '',
  ].filter(Boolean)

  return `- ${index + 1}. ${name}: ${parts.length ? parts.join(', ') : 'sem volume relevante na janela lida.'}`
}

function buildPendingPlanMonitoringLine(plan: Record<string, unknown>, index: number) {
  const name = compactMonitoringLabel(plan.campaign_name || plan.id, 'Plano sem nome')
  const status = compactMonitoringLabel(plan.status, 'status pendente', 40)
  const objective = compactMonitoringLabel(plan.objective, 'objetivo nao informado', 120)
  return `- ${index + 1}. ${name}: ${status}; ${objective}.`
}

function buildWhatsAppMonitoringMessage(snapshot: VitorMonitoringSnapshot) {
  const metrics = snapshot.metrics || {}
  const alerts = snapshot.alerts.slice(0, 4)
  const recommendations = snapshot.recommendations.slice(0, 4)
  const campaigns = snapshot.top_campaigns.slice(0, 5)
  const pendingPlans = snapshot.pending_execution_plans.slice(0, 4)

  return [
    'Monitoramento de trafego pago',
    `Janela lida: ${monitoringDatePresetLabel(snapshot.date_preset)}.`,
    '',
    `Saude do trafego: ${snapshot.health.score}/100 (${snapshot.health.label})`,
    `Gasto lido: ${moneyLabel(metrics.spend)}`,
    `Leads Meta: ${metrics.leads || 0}`,
    `Leads pagos no CRM: ${metrics.crm_paid_leads || 0}`,
    `CPL medio: ${moneyLabel(metrics.avg_cpl)}`,
    `Qualidade CRM: ${percentLabel(metrics.crm_quality_rate)}`,
    '',
    'Campanhas lidas na Meta:',
    campaigns.length
      ? campaigns.map(buildCampaignMonitoringLine).join('\n')
      : '- Nao encontrei campanha com leitura da Meta nessa janela.',
    '',
    'Planos do Vitor ainda para reconciliar:',
    pendingPlans.length
      ? pendingPlans.map(buildPendingPlanMonitoringLine).join('\n')
      : '- Nenhum plano preparado ficou pendente de reconciliar com campanha real.',
    '',
    'Alertas:',
    alerts.length
      ? alerts.map(alert => `- ${alert.title}: ${alert.recommendation}`).join('\n')
      : '- Nenhum alerta relevante nos dados atuais.',
    '',
    'Recomendacoes:',
    recommendations.length
      ? recommendations.map(item => `- ${item.action}`).join('\n')
      : '- Manter observacao e nao escalar verba sem validar qualidade no CRM.',
    '',
    'Nada foi pausado, publicado ou escalado automaticamente.',
    'A leitura foi registrada na Central de Inteligencia para o CEO, WhatsApp Global e Criativos.',
  ].filter(Boolean).join('\n')
}

async function updateCommandStatus(supabase: SupabaseLike, commandId: string | null, status: string, result: Record<string, unknown>) {
  if (!commandId) return
  await supabase
    .from('whatsapp_global_commands')
    .update({
      status,
      result,
      updated_at: new Date().toISOString(),
    })
    .eq('id', commandId)
}

async function sendVitorResponse(params: {
  phone: string
  message: string
  instanceToken?: string | null
}) {
  const phone = cleanString(params.phone, 40)
  if (!phone) return false
  try {
    await sendWhatsAppMessage({
      phone,
      message: params.message,
      instanceToken: params.instanceToken || undefined,
    })
    return true
  } catch (error: any) {
    console.warn('[Vitor] WhatsApp response failed:', error?.message || error)
    return false
  }
}

type VitorDecisionAction = 'approve' | 'improve' | 'cancel' | 'export' | 'publish' | 'pause'

function detectVitorDecisionAction(text: unknown): VitorDecisionAction | null {
  const normalized = cleanString(text, 1000)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (/\b(cancelar|cancela|cancelado|nao rodar|nao publicar|descartar)\b/.test(normalized)) return 'cancel'
  if (/\b(pausar|pause|pausado|pausar campanha)\b/.test(normalized)) return 'pause'
  if (/\b(melhorar|ajustar|refazer|corrigir|revisar criativo|melhoria)\b/.test(normalized)) return 'improve'
  if (/\b(publicar|publicado|publicada|marcar publicada|marcar publicado|ativar|ativado|ativada|registrar campanha)\b/.test(normalized)) return 'publish'
  if (/\b(preparar|exportar|executar|execucao|pacote|subir mesmo assim|rodar mesmo assim)\b/.test(normalized)) return 'export'
  if (/\b(aprovar|aprovado|autorizar|pode rodar|pode subir|liberar)\b/.test(normalized)) return 'approve'
  return null
}

function vitorDecisionLabel(action: VitorDecisionAction) {
  if (action === 'approve') return 'aprovou o plano do Vitor'
  if (action === 'improve') return 'pediu melhoria no criativo do Vitor'
  if (action === 'cancel') return 'cancelou o plano do Vitor'
  if (action === 'publish') return 'marcou a campanha do Vitor como publicada'
  if (action === 'pause') return 'marcou a campanha do Vitor como pausada'
  return 'marcou o plano do Vitor como pronto para execucao humana'
}

function vitorDecisionStatuses(action: VitorDecisionAction) {
  if (action === 'approve') return { reviewStatus: 'approved', planStatus: 'approved', creativeStatus: 'approved' }
  if (action === 'improve') return { reviewStatus: 'needs_improvement', planStatus: 'draft', creativeStatus: 'review' }
  if (action === 'cancel') return { reviewStatus: 'cancelled', planStatus: 'cancelled', creativeStatus: 'archived' }
  if (action === 'publish') return { reviewStatus: 'approved', planStatus: 'published', creativeStatus: 'approved' }
  if (action === 'pause') return { reviewStatus: 'approved', planStatus: 'paused', creativeStatus: 'approved' }
  return { reviewStatus: 'approved', planStatus: 'exported', creativeStatus: 'approved' }
}

async function findLatestDecisionReview(supabase: SupabaseLike, command: any) {
  const phone = cleanString(command?.phone, 40)
  let query = supabase
    .from('paid_traffic_creative_reviews')
    .select('*')
    .in('status', ['reviewed', 'needs_improvement', 'approved'])
    .order('updated_at', { ascending: false })
    .limit(1)

  if (phone) query = query.eq('requested_by_phone', phone)

  const { data, error } = await query
  if (error) throw error
  return Array.isArray(data) ? data[0] || null : null
}

function buildVitorDecisionMessage(params: {
  action: VitorDecisionAction
  review: any
  plan: any
}) {
  const { action, review, plan } = params
  const planStatus = cleanString(plan?.status, 80) || 'sem plano localizado'
  const score = Number.isFinite(Number(review?.score)) ? `${review.score}/100` : 'sem score'
  const actionText = action === 'approve'
    ? 'Plano aprovado para execucao humana.'
    : action === 'improve'
      ? 'Criativo marcado para melhoria antes de rodar.'
      : action === 'cancel'
        ? 'Plano cancelado. Nada sera publicado.'
        : action === 'publish'
          ? 'Campanha marcada como publicada por decisao humana.'
          : action === 'pause'
            ? 'Campanha marcada como pausada por decisao humana.'
            : 'Plano marcado como pronto/exportado para execucao humana.'

  return [
    'Vitor Trafego Pago registrou sua decisao.',
    '',
    actionText,
    `Score: ${score}${review?.score_label ? ` (${review.score_label})` : ''}`,
    `Status do plano: ${planStatus}.`,
    '',
    action === 'export'
      ? 'Use o painel do Vitor para copiar o pacote completo de execucao, UTMs, copy e regras de pausa/escala.'
      : 'A decisao foi salva no painel e enviada para a Central de Inteligencia.',
    'Nada foi publicado automaticamente.',
  ].filter(Boolean).join('\n')
}

async function processVitorDecisionCommand(params: {
  supabase: SupabaseLike
  command: any
}) {
  const { supabase, command } = params
  const action = detectVitorDecisionAction(command?.command_text)
  if (!action) throw new Error('Nao entendi a decisao para o Vitor. Use aprovar, melhorar, cancelar ou preparar execucao.')

  const review = await findLatestDecisionReview(supabase, command)
  if (!review?.id) {
    throw new Error('Nao encontrei analise pendente do Vitor para este numero. Envie o criativo primeiro ou aprove pelo painel.')
  }

  const statuses = vitorDecisionStatuses(action)
  const now = new Date().toISOString()
  const rawAnalysis = {
    ...safeJsonObject(review.raw_analysis),
    human_decision: {
      action,
      source: 'whatsapp_global',
      command_id: command.id || null,
      text: cleanString(command.command_text, 800) || null,
      decided_at: now,
    },
  }

  const { data: updatedReview, error: reviewError } = await supabase
    .from('paid_traffic_creative_reviews')
    .update({
      status: statuses.reviewStatus,
      raw_analysis: rawAnalysis,
      updated_at: now,
    })
    .eq('id', review.id)
    .select('*')
    .single()

  if (reviewError) throw reviewError

  const { data: currentPlan, error: planReadError } = await supabase
    .from('paid_traffic_campaign_plans')
    .select('*')
    .eq('review_id', review.id)
    .maybeSingle()
  if (planReadError) throw planReadError

  let updatedPlan = currentPlan || null
  if (currentPlan?.id) {
    const { data: planData, error: planError } = await supabase
      .from('paid_traffic_campaign_plans')
      .update({
        status: statuses.planStatus,
        raw_plan: {
          ...safeJsonObject(currentPlan.raw_plan),
          human_decision: {
            action,
            source: 'whatsapp_global',
            command_id: command.id || null,
            decided_at: now,
          },
        },
        updated_at: now,
      })
      .eq('id', currentPlan.id)
      .select('*')
      .maybeSingle()
    if (planError) throw planError
    updatedPlan = planData || currentPlan
  }

  if (statuses.creativeStatus && review.creative_id) {
    await supabase
      .from('marketing_creatives')
      .update({
        status: statuses.creativeStatus,
        updated_at: now,
      })
      .eq('id', review.creative_id)
  }

  await recordAgentCentralSignal({
    supabase,
    agentId: 'ads-analyst',
    eventType: 'paid_traffic_vitor_human_decision',
    entityType: 'paid_traffic_creative_review',
    entityId: review.id,
    source: 'vitor-whatsapp-global',
    label: `${command.identity_label || 'Humano'} ${vitorDecisionLabel(action)}`,
    importanceScore: action === 'publish' ? 86 : action === 'approve' || action === 'export' ? 78 : action === 'pause' ? 76 : action === 'cancel' ? 70 : 64,
    metadata: {
      action,
      source: 'whatsapp_global',
      command_id: command.id || null,
      phone: command.phone || null,
      review_id: review.id,
      creative_id: review.creative_id || null,
      campaign_plan_id: updatedPlan?.id || null,
      previous_status: review.status,
      next_status: statuses.reviewStatus,
      plan_status: updatedPlan?.status || null,
    },
    handoffTargets: ['whatsapp-global-agent', 'creative-strategy-agent', 'ceo-agent'],
  }).catch((error: any) => {
    console.warn('[Vitor] decision central signal failed:', error?.message || error)
  })

  return {
    action,
    review: updatedReview || review,
    plan: updatedPlan,
    message: buildVitorDecisionMessage({ action, review: updatedReview || review, plan: updatedPlan }),
  }
}

export async function processVitorPanelCreative(
  params: ProcessVitorPanelCreativeParams,
): Promise<ProcessVitorPanelCreativeResult> {
  const { supabase } = params
  const mediaItems = (params.mediaItems || [])
    .map((item): MediaItem | null => {
      const url = cleanString(item?.url, 1200)
      if (!url) return null
      return {
        url,
        mime: cleanString(item?.mime, 160),
        kind: cleanString(item?.kind, 60) || 'media',
        filename: cleanString(item?.filename, 180) || null,
      }
    })
    .filter((item): item is MediaItem => Boolean(item))
    .slice(0, 10)
  const requestedByLabel = cleanString(params.requestedByLabel, 160) || 'Painel do Vitor'
  const syntheticCommand = {
    id: null,
    phone: null,
    identity_type: 'admin_user',
    identity_label: requestedByLabel,
    command_text: cleanString(params.briefing, 3000),
    payload: {
      source: 'vitor_panel',
      media: mediaItems,
    },
  }

  const creative = await ensureCreativeFromPanel({
    supabase,
    title: params.title,
    briefing: params.briefing,
    mediaItems,
    assetType: params.assetType,
    contentType: params.contentType,
    requestedByLabel,
    createdBy: params.createdBy,
    propertySku: params.propertySku,
  })
  const analysis = await runVitorAnalysis({ supabase, command: syntheticCommand, creative, mediaItems })
  const review = await insertReview({
    supabase,
    command: syntheticCommand,
    creative,
    mediaItems,
    analysis,
    source: 'panel_upload',
  })
  const campaignPlan = await insertCampaignPlan({ supabase, command: syntheticCommand, creative, review, analysis })

  await recordAgentCentralSignal({
    supabase,
    agentId: 'ads-analyst',
    eventType: 'paid_traffic_panel_creative_review_created',
    entityType: 'paid_traffic_creative_review',
    entityId: review.id,
    source: 'vitor-panel',
    label: `Vitor analisou criativo enviado pelo painel com score ${analysis.score}`,
    importanceScore: analysis.score >= 70 ? 72 : analysis.score >= 50 ? 62 : 80,
    metadata: {
      creative_id: creative.id,
      review_id: review.id,
      campaign_plan_id: campaignPlan.id,
      score: analysis.score,
      score_label: analysis.score_label,
      risks: analysis.risks,
      improvements: analysis.improvements,
      requested_by_label: requestedByLabel,
      fallback: Boolean(analysis.fallback),
    },
    handoffTargets: ['whatsapp-global-agent', 'creative-strategy-agent', 'ceo-agent'],
  }).catch((error: any) => {
    console.warn('[Vitor] panel central signal failed:', error?.message || error)
  })

  await saveAgentCentralSnapshot({
    supabase,
    agentId: 'ads-analyst',
    scope: 'panel_creative_review',
    subjectId: review.id,
    createdBy: 'vitor-panel',
    summary: `Review de criativo enviado pelo painel: score ${analysis.score}/100; aguardando aprovacao humana.`,
    context: {
      creative,
      review,
      campaign_plan: campaignPlan,
    },
    signals: {
      score: analysis.score,
      status: review.status,
      publication_guardrail: 'human_approval_required',
    },
  }).catch((error: any) => {
    console.warn('[Vitor] panel central snapshot failed:', error?.message || error)
  })

  return {
    creativeId: creative.id,
    reviewId: review.id,
    campaignPlanId: campaignPlan.id,
    score: analysis.score,
    fallback: Boolean(analysis.fallback),
  }
}

export async function processVitorPaidTrafficCommand(
  params: ProcessVitorPaidTrafficCommandParams,
): Promise<ProcessVitorPaidTrafficCommandResult> {
  const { supabase, command } = params
  if (!command?.id) return { handled: false, whatsappSent: false, error: 'missing_command' }
  const isVitorMonitoringCommand = command.command_type === 'paid_traffic_monitoring'
  const isVitorDecisionCommand = command.command_type === 'paid_traffic_decision'
  if (!['paid_traffic', 'paid_traffic_monitoring', 'paid_traffic_decision'].includes(String(command.command_type || '')) || command.target_agent !== 'ads-analyst') {
    return { handled: false, whatsappSent: false }
  }
  if (command.status === 'blocked') return { handled: false, whatsappSent: false, error: 'blocked_command' }

  const instanceToken = params.instanceToken || params.instance?.instance_token || null
  const shouldSendResponse = params.sendResponse !== false

  try {
    await updateCommandStatus(supabase, command.id, 'processing', {
      stage: 'vitor_processing_started',
      started_at: new Date().toISOString(),
    })

    if (isVitorMonitoringCommand) {
      const datePreset = resolveMonitoringDatePreset(command.command_text || command.payload?.text || command.payload?.message || '')
      const snapshot = await buildVitorMonitoringSnapshot({ supabase, datePreset })
      const report = await persistVitorMonitoringSnapshot({ supabase, snapshot })
      const result = {
        stage: 'vitor_monitoring_completed',
        date_preset: datePreset,
        report_id: report?.id || null,
        health_score: snapshot.health.score,
        health_label: snapshot.health.label,
        alerts: snapshot.alerts.length,
        recommendations: snapshot.recommendations.length,
        completed_at: new Date().toISOString(),
      }

      await updateCommandStatus(supabase, command.id, 'completed', result)

      const responseText = buildWhatsAppMonitoringMessage(snapshot)
      const whatsappSent = shouldSendResponse
        ? await sendVitorResponse({
          phone: command.phone,
          message: responseText,
          instanceToken,
        })
        : false

      return {
        handled: true,
        whatsappSent,
        monitoringHealth: snapshot.health.score,
        monitoringAlerts: snapshot.alerts.length,
        responseText,
      }
    }

    if (isVitorDecisionCommand) {
      const decision = await processVitorDecisionCommand({ supabase, command })
      const result = {
        stage: 'vitor_decision_completed',
        action: decision.action,
        review_id: decision.review?.id || null,
        campaign_plan_id: decision.plan?.id || null,
        completed_at: new Date().toISOString(),
      }

      await updateCommandStatus(supabase, command.id, 'completed', result)

      const responseText = decision.message
      const whatsappSent = shouldSendResponse
        ? await sendVitorResponse({
          phone: command.phone,
          message: responseText,
          instanceToken,
        })
        : false

      return {
        handled: true,
        whatsappSent,
        reviewId: decision.review?.id || undefined,
        campaignPlanId: decision.plan?.id || undefined,
        decisionAction: decision.action,
        responseText,
      }
    }

    const mediaItems = extractCommandMedia(command)
    const creative = await ensureCreativeFromCommand(supabase, command)
    const analysis = await runVitorAnalysis({ supabase, command, creative, mediaItems })
    const review = await insertReview({ supabase, command, creative, mediaItems, analysis })
    const campaignPlan = await insertCampaignPlan({ supabase, command, creative, review, analysis })

    const result = {
      stage: 'vitor_review_completed',
      creative_id: creative.id,
      review_id: review.id,
      campaign_plan_id: campaignPlan.id,
      score: analysis.score,
      score_label: analysis.score_label,
      fallback: Boolean(analysis.fallback),
      completed_at: new Date().toISOString(),
    }

    await updateCommandStatus(supabase, command.id, 'completed', result)

    await recordAgentCentralSignal({
      supabase,
      agentId: 'ads-analyst',
      eventType: 'paid_traffic_creative_review_created',
      entityType: 'paid_traffic_creative_review',
      entityId: review.id,
      source: 'vitor-traffic-manager',
      label: `Vitor analisou criativo recebido pelo WhatsApp Global com score ${analysis.score}`,
      importanceScore: analysis.score >= 70 ? 74 : analysis.score >= 50 ? 62 : 82,
      metadata: {
        creative_id: creative.id,
        command_id: command.id,
        campaign_plan_id: campaignPlan.id,
        score: analysis.score,
        score_label: analysis.score_label,
        risks: analysis.risks,
        improvements: analysis.improvements,
        requested_by_phone: command.phone || null,
        requested_by_label: command.identity_label || null,
        fallback: Boolean(analysis.fallback),
      },
      handoffTargets: ['whatsapp-global-agent', 'creative-strategy-agent', 'ceo-agent'],
    }).catch((error: any) => {
      console.warn('[Vitor] central signal failed:', error?.message || error)
    })

    await saveAgentCentralSnapshot({
      supabase,
      agentId: 'ads-analyst',
      scope: 'creative_review',
      subjectId: review.id,
      createdBy: 'vitor-traffic-manager',
      summary: `Review de criativo: score ${analysis.score}/100; aguardando aprovacao humana.`,
      context: {
        creative,
        review,
        campaign_plan: campaignPlan,
        command_id: command.id,
      },
      signals: {
        score: analysis.score,
        status: review.status,
        publication_guardrail: 'human_approval_required',
      },
    }).catch((error: any) => {
      console.warn('[Vitor] central snapshot failed:', error?.message || error)
    })

    const responseText = buildWhatsAppReviewMessage(analysis)
    const whatsappSent = shouldSendResponse
      ? await sendVitorResponse({
        phone: command.phone,
        message: responseText,
        instanceToken,
      })
      : false

    return {
      handled: true,
      whatsappSent,
      creativeId: creative.id,
      reviewId: review.id,
      campaignPlanId: campaignPlan.id,
      score: analysis.score,
      responseText,
      fallback: Boolean(analysis.fallback),
    }
  } catch (error: any) {
    const message = error?.message || String(error)
    console.error('[Vitor] paid traffic command failed:', message)
    await updateCommandStatus(supabase, command.id, 'failed', {
      stage: isVitorDecisionCommand ? 'vitor_decision_failed' : isVitorMonitoringCommand ? 'vitor_monitoring_failed' : 'vitor_review_failed',
      error: message,
      failed_at: new Date().toISOString(),
    }).catch(() => null)

    const failureMessage = isVitorDecisionCommand
      ? [
        'Vitor recebeu sua decisao, mas nao conseguiu aplicar agora.',
        message,
        'Nada foi publicado automaticamente.',
      ]
      : isVitorMonitoringCommand
        ? [
          'Vitor recebeu seu pedido de monitoramento, mas nao conseguiu concluir a leitura agora.',
          'O comando ficou registrado no WhatsApp Global para revisao interna.',
          'Nada foi publicado automaticamente.',
        ]
        : [
          'Vitor recebeu seu pedido de trafego, mas nao conseguiu finalizar a analise automatica agora.',
          'O comando ficou registrado no WhatsApp Global para revisao interna.',
          'Nada foi publicado automaticamente.',
        ]

    const responseText = failureMessage.join('\n')
    const whatsappSent = shouldSendResponse
      ? await sendVitorResponse({
        phone: command.phone,
        message: responseText,
        instanceToken,
      })
      : false

    return {
      handled: true,
      whatsappSent,
      responseText,
      error: message,
    }
  }
}
