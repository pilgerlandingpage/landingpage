import { getMetaTrafficManagerSnapshot, type DatePreset } from '@/lib/ads/meta'
import { getAgentEcosystemContext } from '@/lib/intelligence/ecosystem'
import { recordAgentCentralSignal, saveAgentCentralSnapshot } from '@/lib/intelligence/agent-runtime'
import { createAdminClient } from '@/lib/supabase/server'

type SupabaseAdmin = ReturnType<typeof createAdminClient>
type VitorAlertSeverity = 'critical' | 'high' | 'medium' | 'low'
type VitorAlertType = 'pause' | 'scale' | 'creative' | 'tracking' | 'lead_quality' | 'execution' | 'integration'

type QueryResult<T> = {
  data: T[]
  error?: string | null
}

export type VitorMonitoringAlert = {
  type: VitorAlertType
  severity: VitorAlertSeverity
  title: string
  message: string
  recommendation: string
  entity?: Record<string, unknown> | null
}

export type VitorMonitoringSnapshot = {
  generated_at: string
  date_preset: DatePreset
  health: {
    score: number
    label: string
    tone: 'good' | 'medium' | 'risk'
  }
  metrics: Record<string, number>
  alerts: VitorMonitoringAlert[]
  recommendations: Array<{
    title: string
    action: string
    priority: VitorAlertSeverity
  }>
  top_campaigns: any[]
  top_ads: any[]
  pending_execution_plans: Array<Record<string, unknown>>
  crm_lead_quality: {
    paid_leads: number
    qualified_leads: number
    poor_leads: number
    quality_rate: number
    recent_leads: any[]
  }
  diagnostics: string[]
  latest_report: any | null
}

function safeRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function safeArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function numeric(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function compact(value: unknown, max = 240) {
  const text = String(value || '').trim()
  return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

function normalizeKey(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null
}

async function safeQuery<T>(label: string, query: PromiseLike<{ data: T[] | null; error: any }>): Promise<QueryResult<T>> {
  try {
    const { data, error } = await query
    if (error) return { data: [], error: `${label}: ${error.message || error}` }
    return { data: data || [] }
  } catch (error: any) {
    return { data: [], error: `${label}: ${error?.message || error}` }
  }
}

function isPaidLead(row: any) {
  const visitor = firstRelation(row?.visitors)
  const metadata = safeRecord(row?.metadata)
  const sourceText = [
    row?.acquired_via,
    row?.source,
    row?.detected_source,
    visitor?.detected_source,
    visitor?.utm_source,
    visitor?.utm_medium,
    visitor?.utm_campaign,
    metadata.utm_source,
    metadata.utm_medium,
    metadata.utm_campaign,
  ].filter(Boolean).join(' ').toLowerCase()

  return ['facebook', 'instagram', 'meta', 'google', 'ads', 'paid', 'cpc', 'fbclid', 'gclid']
    .some(token => sourceText.includes(token))
}

function isQualifiedLead(row: any) {
  const stage = String(row?.funnel_stage || row?.status || '').toLowerCase()
  const score = numeric(row?.lead_score)
  return score >= 70
    || stage.includes('qualificado')
    || stage.includes('oportunidade')
    || stage.includes('visita')
    || stage.includes('proposta')
    || stage.includes('negociacao')
}

function isPoorLead(row: any) {
  const stage = String(row?.funnel_stage || row?.status || '').toLowerCase()
  const score = numeric(row?.lead_score)
  return (score > 0 && score < 40)
    || stage.includes('frio')
    || stage.includes('perdido')
    || stage.includes('descartado')
    || stage.includes('desqualificado')
}

function campaignNameFromPlan(plan: any) {
  const rawPlan = safeRecord(plan?.raw_plan)
  const executionPackage = safeRecord(rawPlan.execution_package)
  const tracking = safeRecord(executionPackage.tracking)
  const utm = safeRecord(plan?.utm)
  return String(
    executionPackage.campaign_name
    || tracking.utm_campaign
    || utm.campaign
    || utm.utm_campaign
    || '',
  ).trim()
}

function alertPriorityScore(severity: VitorAlertSeverity) {
  if (severity === 'critical') return 4
  if (severity === 'high') return 3
  if (severity === 'medium') return 2
  return 1
}

function healthLabel(score: number) {
  if (score >= 75) return { label: 'Saudavel', tone: 'good' as const }
  if (score >= 55) return { label: 'Atencao', tone: 'medium' as const }
  return { label: 'Critico', tone: 'risk' as const }
}

function pushAlert(
  alerts: VitorMonitoringAlert[],
  type: VitorAlertType,
  severity: VitorAlertSeverity,
  title: string,
  message: string,
  recommendation: string,
  entity?: Record<string, unknown> | null,
) {
  alerts.push({ type, severity, title, message, recommendation, entity: entity || null })
}

function buildRecommendations(alerts: VitorMonitoringAlert[]) {
  return [...alerts]
    .sort((a, b) => alertPriorityScore(b.severity) - alertPriorityScore(a.severity))
    .slice(0, 8)
    .map(alert => ({
      title: alert.title,
      action: alert.recommendation,
      priority: alert.severity,
    }))
}

function summarizePendingPlans(plans: any[], metaCampaignNames: Set<string>) {
  return plans
    .filter(plan => ['approved', 'exported', 'pending_human_approval'].includes(String(plan.status || '')))
    .map(plan => {
      const campaignName = campaignNameFromPlan(plan)
      return {
        id: plan.id,
        status: plan.status,
        campaign_name: campaignName || null,
        objective: plan.objective || null,
        created_at: plan.created_at,
        matched_in_meta: campaignName ? metaCampaignNames.has(normalizeKey(campaignName)) : false,
      }
    })
    .filter(plan => !plan.matched_in_meta)
    .slice(0, 8)
}

export async function buildVitorMonitoringSnapshot({
  supabase = createAdminClient(),
  datePreset = 'last_7d',
}: {
  supabase?: SupabaseAdmin | any
  datePreset?: DatePreset
} = {}): Promise<VitorMonitoringSnapshot> {
  const generatedAt = new Date().toISOString()
  const diagnostics: string[] = []

  const [meta, plansResult, leadsResult, latestReportsResult] = await Promise.all([
    getMetaTrafficManagerSnapshot({ datePreset }).catch((error: any) => {
      diagnostics.push(`Meta Ads indisponivel: ${error?.message || error}`)
      return null
    }),
    safeQuery<any>(
      'planos do Vitor',
      supabase
        .from('paid_traffic_campaign_plans')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(120),
    ),
    safeQuery<any>(
      'leads pagos',
      supabase
        .from('leads')
        .select('id, name, phone, created_at, funnel_stage, lead_score, acquired_via, metadata, visitors(detected_source, utm_source, utm_medium, utm_campaign)')
        .order('created_at', { ascending: false })
        .limit(500),
    ),
    safeQuery<any>(
      'relatorios pagos',
      supabase
        .from('marketing_ai_reports')
        .select('id, title, summary, metrics, recommendations, created_at')
        .eq('report_type', 'paid')
        .order('created_at', { ascending: false })
        .limit(1),
    ),
  ])

  for (const error of [plansResult.error, leadsResult.error, latestReportsResult.error]) {
    if (error) diagnostics.push(error)
  }

  const plans = plansResult.data
  const paidLeads = leadsResult.data.filter(isPaidLead)
  const qualifiedLeads = paidLeads.filter(isQualifiedLead)
  const poorLeads = paidLeads.filter(isPoorLead)
  const topCampaigns = safeArray(meta?.top_campaigns).slice(0, 8)
  const topAds = safeArray(meta?.top_ads).slice(0, 10)
  const metaCampaignNames = new Set(topCampaigns.map(item => normalizeKey(item.name || item.campaign_name)))
  const pendingExecutionPlans = summarizePendingPlans(plans, metaCampaignNames)

  const totals = safeRecord(meta?.totals)
  const coverage = safeRecord(meta?.coverage)
  const spend = numeric(totals.spend)
  const leads = numeric(totals.leads)
  const conversations = numeric(totals.conversations)
  const avgCpl = numeric(totals.avg_cpl)
  const avgCtr = numeric(totals.avg_ctr)
  const frequency = numeric(totals.frequency)
  const missingAttribution = Math.max(0, leads - paidLeads.length)
  const crmQualityRate = paidLeads.length > 0 ? (qualifiedLeads.length / paidLeads.length) * 100 : 0
  const alerts: VitorMonitoringAlert[] = []

  if (!meta) {
    pushAlert(
      alerts,
      'integration',
      'critical',
      'Meta Ads sem leitura',
      'O Vitor nao conseguiu carregar metricas da Meta neste momento.',
      'Validar token, permissoes ads_read/ads_management e conta de anuncios antes de testar a gestao continua.',
    )
  }

  for (const item of safeArray(meta?.diagnostics)) diagnostics.push(String(item))

  if (meta && spend > 100 && leads === 0 && conversations === 0) {
    pushAlert(
      alerts,
      'pause',
      'high',
      'Gasto sem lead',
      `Foram consumidos R$ ${Math.round(spend)} no periodo sem leads ou conversas atribuibles.`,
      'Manter campanha em observacao curta ou pausar ate corrigir criativo, publico ou objetivo.',
    )
  }

  if (meta && avgCpl > 0 && avgCpl >= 350) {
    pushAlert(
      alerts,
      'pause',
      avgCpl >= 550 ? 'high' : 'medium',
      'CPL acima do limite',
      `CPL medio em R$ ${Math.round(avgCpl)}, acima da faixa saudavel para testes iniciais.`,
      'Separar anuncios por custo e pausar os piores antes de aumentar verba.',
    )
  }

  if (meta && spend > 100 && avgCtr > 0 && avgCtr < 0.8) {
    pushAlert(
      alerts,
      'creative',
      'medium',
      'CTR baixo',
      `CTR medio em ${avgCtr.toFixed(2)}%, sinal de gancho ou criativo fraco.`,
      'Pedir nova variacao de hook/imagem ao Vitor antes de insistir no mesmo criativo.',
    )
  }

  if (meta && frequency >= 3.5 && avgCtr < 1.2) {
    pushAlert(
      alerts,
      'creative',
      'medium',
      'Frequencia alta',
      `Frequencia media em ${frequency.toFixed(1)} com CTR pressionado.`,
      'Trocar criativo ou abrir nova audiencia para evitar desgaste.',
    )
  }

  if (meta && leads > 0 && missingAttribution >= Math.max(3, leads * 0.35)) {
    pushAlert(
      alerts,
      'tracking',
      'high',
      'Leads sem atribuicao no CRM',
      `Meta reporta ${leads} lead(s), mas o CRM reconhece ${paidLeads.length} origem(ns) paga(s).`,
      'Revisar UTM, formulario/WhatsApp de destino e gravação de origem no CRM antes de escalar.',
    )
  }

  if (paidLeads.length >= 5 && crmQualityRate < 25) {
    pushAlert(
      alerts,
      'lead_quality',
      'high',
      'Qualidade comercial baixa',
      `Apenas ${Math.round(crmQualityRate)}% dos leads pagos aparecem como qualificados.`,
      'Cruzar conversas no CRM e estreitar publico/regiao antes de subir verba.',
    )
  }

  for (const ad of topAds.slice(0, 6)) {
    const adSpend = numeric(ad.spend)
    const adLeads = numeric(ad.leads)
    const adCpl = numeric(ad.cpl)
    if (adSpend >= 80 && adLeads === 0) {
      pushAlert(
        alerts,
        'pause',
        'medium',
        'Anuncio gastando sem lead',
        `${compact(ad.name, 80)} consumiu R$ ${Math.round(adSpend)} sem lead atribuido.`,
        'Pausar este anuncio ou trocar criativo antes de manter verba nele.',
        { ad_id: ad.id, name: ad.name, spend: adSpend, leads: adLeads },
      )
    } else if (avgCpl > 0 && adCpl > avgCpl * 1.45 && adSpend >= 60) {
      pushAlert(
        alerts,
        'pause',
        'medium',
        'Anuncio pior que a media',
        `${compact(ad.name, 80)} esta com CPL R$ ${Math.round(adCpl)}, acima da media.`,
        'Reduzir ou pausar a variacao e manter verba nos criativos mais eficientes.',
        { ad_id: ad.id, name: ad.name, cpl: adCpl, avg_cpl: avgCpl },
      )
    } else if (adLeads >= 2 && (avgCpl <= 0 || adCpl <= avgCpl * 0.75)) {
      pushAlert(
        alerts,
        'scale',
        'low',
        'Criativo com sinal de escala',
        `${compact(ad.name, 80)} gerou ${adLeads} lead(s) com CPL competitivo.`,
        'Escalar de forma gradual, mantendo controle de qualidade no CRM.',
        { ad_id: ad.id, name: ad.name, leads: adLeads, cpl: adCpl },
      )
    }
  }

  if (pendingExecutionPlans.length > 0) {
    pushAlert(
      alerts,
      'execution',
      'low',
      'Planos preparados sem campanha localizada',
      `${pendingExecutionPlans.length} plano(s) aprovado(s)/exportado(s) ainda nao aparecem entre as campanhas lidas.`,
      'Conferir se o humano criou a campanha com o nome/UTM sugeridos ou atualizar status do plano.',
    )
  }

  let healthScore = meta ? 84 : 52
  for (const alert of alerts) {
    healthScore -= alert.severity === 'critical' ? 22 : alert.severity === 'high' ? 12 : alert.severity === 'medium' ? 7 : 2
  }
  if (coverage.ads === 0 && meta) healthScore -= 12
  if (spend > 0 && paidLeads.length === 0) healthScore -= 8
  healthScore = Math.round(clamp(healthScore, 0, 100))
  const labeledHealth = healthLabel(healthScore)

  return {
    generated_at: generatedAt,
    date_preset: datePreset,
    health: {
      score: healthScore,
      ...labeledHealth,
    },
    metrics: {
      spend,
      impressions: numeric(totals.impressions),
      clicks: numeric(totals.clicks),
      leads,
      conversations,
      avg_ctr: avgCtr,
      avg_cpl: avgCpl,
      frequency,
      crm_paid_leads: paidLeads.length,
      crm_qualified_leads: qualifiedLeads.length,
      crm_poor_leads: poorLeads.length,
      crm_quality_rate: crmQualityRate,
      missing_attribution: missingAttribution,
      prepared_plans: plans.filter(plan => ['approved', 'exported', 'pending_human_approval'].includes(String(plan.status || ''))).length,
      pending_execution_plans: pendingExecutionPlans.length,
      meta_campaigns: numeric(coverage.campaigns),
      meta_ads: numeric(coverage.ads),
    },
    alerts: alerts
      .sort((a, b) => alertPriorityScore(b.severity) - alertPriorityScore(a.severity))
      .slice(0, 12),
    recommendations: buildRecommendations(alerts),
    top_campaigns: topCampaigns,
    top_ads: topAds,
    pending_execution_plans: pendingExecutionPlans,
    crm_lead_quality: {
      paid_leads: paidLeads.length,
      qualified_leads: qualifiedLeads.length,
      poor_leads: poorLeads.length,
      quality_rate: crmQualityRate,
      recent_leads: paidLeads.slice(0, 10).map(lead => ({
        id: lead.id,
        name: lead.name,
        created_at: lead.created_at,
        funnel_stage: lead.funnel_stage,
        lead_score: lead.lead_score,
        acquired_via: lead.acquired_via,
      })),
    },
    diagnostics: diagnostics.filter(Boolean).slice(0, 12),
    latest_report: latestReportsResult.data[0] || null,
  }
}

export async function persistVitorMonitoringSnapshot({
  supabase = createAdminClient(),
  snapshot,
}: {
  supabase?: SupabaseAdmin | any
  snapshot: VitorMonitoringSnapshot
}) {
  const today = snapshot.generated_at.slice(0, 10)
  const summary = [
    `Monitoramento do Vitor: saude ${snapshot.health.score}/100 (${snapshot.health.label}).`,
    `${snapshot.alerts.length} alerta(s), R$ ${Math.round(snapshot.metrics.spend || 0)} investidos, ${snapshot.metrics.leads || 0} lead(s) Meta e ${snapshot.metrics.crm_paid_leads || 0} lead(s) pagos no CRM.`,
  ].join(' ')

  const { data: report, error: reportError } = await supabase
    .from('marketing_ai_reports')
    .insert({
      report_type: 'paid',
      period_start: today,
      period_end: today,
      title: `Vitor - monitoramento ${snapshot.health.label}`,
      summary,
      insights: snapshot.alerts.slice(0, 6),
      recommendations: snapshot.recommendations.slice(0, 8),
      metrics: {
        ...snapshot.metrics,
        health: snapshot.health,
        diagnostics: snapshot.diagnostics,
      },
      generated_by: 'vitor-monitoring-agent',
      updated_at: new Date().toISOString(),
    })
    .select('id, title, summary, metrics, created_at')
    .single()

  if (reportError) throw new Error(reportError.message)

  const ecosystemContext = await getAgentEcosystemContext({ supabase, agent: 'traffic', days: 14, limit: 80 })

  await recordAgentCentralSignal({
    supabase,
    agentId: 'ads-analyst',
    eventType: 'paid_traffic_vitor_monitoring_snapshot',
    entityType: 'marketing_ai_report',
    entityId: report?.id || snapshot.generated_at,
    source: 'vitor-monitoring-agent',
    label: `Vitor gerou monitoramento continuo: ${snapshot.health.score}/100`,
    importanceScore: snapshot.health.score < 55 ? 86 : snapshot.alerts.some(alert => alert.severity === 'high') ? 78 : 66,
    metadata: {
      report_id: report?.id || null,
      health: snapshot.health,
      metrics: snapshot.metrics,
      alerts: snapshot.alerts.slice(0, 8),
      recommendations: snapshot.recommendations.slice(0, 8),
      diagnostics: snapshot.diagnostics,
    },
    handoffTargets: ['ceo-agent', 'whatsapp-global-agent', 'creative-strategy-agent'],
  })

  await saveAgentCentralSnapshot({
    supabase,
    agentId: 'ads-analyst',
    createdBy: 'vitor-monitoring-agent',
    scope: 'paid_traffic_monitoring',
    context: ecosystemContext,
    summary,
    signals: {
      latest_vitor_monitoring: {
        report_id: report?.id || null,
        generated_at: snapshot.generated_at,
        health: snapshot.health,
        metrics: snapshot.metrics,
        alerts: snapshot.alerts.slice(0, 8),
        recommendations: snapshot.recommendations.slice(0, 8),
      },
    },
  })

  return report
}
