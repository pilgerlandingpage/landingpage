import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { recordAgentCentralSignal } from '@/lib/intelligence/agent-runtime'
import { processVitorPanelCreative, type MediaItem } from '@/lib/ads/vitor-traffic-manager'

export const dynamic = 'force-dynamic'

function parseLimit(value: string | null) {
  const parsed = Number(value || 40)
  if (!Number.isFinite(parsed)) return 40
  return Math.min(Math.max(Math.trunc(parsed), 1), 120)
}

function isMissingRelation(error: any) {
  const message = String(error?.message || error || '').toLowerCase()
  return message.includes('does not exist') || message.includes('schema cache') || message.includes('relation')
}

function safeArray(value: any) {
  return Array.isArray(value) ? value : []
}

function byId(rows: any[] = []) {
  return new Map(rows.map(row => [String(row.id), row]))
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)))
}

function cleanString(value: unknown, max = 3000) {
  const text = String(value || '').trim()
  return text.length > max ? text.slice(0, max) : text
}

function safeRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function numberOrNull(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function stringRows(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback
  const rows = value
    .map(item => cleanString(item, 280))
    .filter(Boolean)
  return rows.length ? rows : fallback
}

function normalizeCampaignName(value: unknown, fallback: string) {
  const text = cleanString(value, 120) || fallback
  return text
    .replace(/[^\w-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120) || fallback
}

function normalizeCopyVariations(value: unknown) {
  return safeArray(value).slice(0, 6).map((copy: any, index: number) => {
    const row = safeRecord(copy)
    return {
      label: cleanString(row.label || row.headline || `Copy ${index + 1}`, 120),
      headline: cleanString(row.headline || row.label || `Copy ${index + 1}`, 180),
      primary_text: cleanString(row.primary_text || row.text || row.caption, 900),
      description: cleanString(row.description, 500),
      cta: cleanString(row.cta, 80) || 'Falar no WhatsApp',
    }
  })
}

function buildExecutionPackagePlainText(pkg: Record<string, any>) {
  const setup = safeRecord(pkg.setup)
  const tracking = safeRecord(pkg.tracking)
  const creative = safeRecord(pkg.creative)
  const review = safeRecord(pkg.review)
  const guardrails = safeRecord(pkg.guardrails)
  const copyRows = safeArray(pkg.copy_variations)
  const checklist = stringRows(guardrails.pre_launch_checklist)
  const pauseRules = stringRows(guardrails.pause_rules)
  const scaleRules = stringRows(guardrails.scale_rules)
  const steps = stringRows(pkg.human_execution_steps)

  return [
    'PACOTE DE EXECUCAO HUMANA - VITOR TRAFEGO PAGO',
    `Campanha: ${pkg.campaign_name || '-'}`,
    `Plataforma sugerida: ${pkg.platform || 'meta_ads'}`,
    `Modo: ${pkg.publication_mode || 'human_execution_required'}`,
    `Seguranca: ${pkg.publication_guardrail || 'Nada foi publicado automaticamente.'}`,
    '',
    'SCORE E LEITURA',
    `Score: ${review.score ?? '-'} (${review.score_label || '-'})`,
    `Recomendacao: ${review.recommendation || '-'}`,
    '',
    'CRIATIVO',
    `Titulo: ${creative.title || '-'}`,
    `Tipo: ${creative.asset_type || creative.content_type || '-'}`,
    `URL: ${creative.asset_url || creative.thumbnail_url || '-'}`,
    '',
    'SETUP DE CAMPANHA',
    `Objetivo: ${setup.objective || '-'}`,
    `Otimizacao: ${setup.optimization_goal || '-'}`,
    `Destino: ${setup.destination || '-'}`,
    `Verba diaria: ${setup.daily_budget_brl ? `R$ ${setup.daily_budget_brl}` : '-'}`,
    `Verba total teste: ${setup.total_test_budget_brl ? `R$ ${setup.total_test_budget_brl}` : '-'}`,
    `Duracao: ${setup.duration_days || '-'} dias`,
    '',
    'TRACKING',
    `utm_source=${tracking.utm_source || '-'}`,
    `utm_medium=${tracking.utm_medium || '-'}`,
    `utm_campaign=${tracking.utm_campaign || '-'}`,
    `utm_content=${tracking.utm_content || '-'}`,
    '',
    'COPYS',
    ...(copyRows.length
      ? copyRows.flatMap((copy: any, index: number) => {
        const row = safeRecord(copy)
        return [
          `${index + 1}. ${row.headline || row.label || 'Copy'}`,
          `Texto: ${row.primary_text || '-'}`,
          `CTA: ${row.cta || 'Falar no WhatsApp'}`,
        ]
      })
      : ['- Sem variacoes de copy registradas.']),
    '',
    'CHECKLIST PRE-LANCAMENTO',
    ...(checklist.length ? checklist.map(row => `- ${row}`) : ['- Revisar criativo, publico, verba, UTM e destino antes de ativar.']),
    '',
    'REGRAS DE PAUSA',
    ...(pauseRules.length ? pauseRules.map(row => `- ${row}`) : ['- Pausar se CPL, CTR ou qualidade comercial ficarem fora do esperado.']),
    '',
    'REGRAS DE ESCALA',
    ...(scaleRules.length ? scaleRules.map(row => `- ${row}`) : ['- Escalar apenas com lead qualificado e custo sustentavel.']),
    '',
    'PASSOS HUMANOS',
    ...(steps.length ? steps.map((row, index) => `${index + 1}. ${row}`) : ['1. Criar rascunho no gerenciador de anuncios com os dados acima.']),
  ].join('\n')
}

function buildHumanExecutionPackage(params: {
  review: any
  plan: any
  creative: any
  generatedAt: string
  notes?: string | null
}) {
  const { review, plan, creative, generatedAt, notes } = params
  const budget = safeRecord(plan?.budget_suggestion)
  const utm = safeRecord(plan?.utm)
  const pauseScale = safeRecord(plan?.pause_scale_rules)
  const fallbackCampaign = `vitor_${String(review?.id || 'campanha').slice(0, 8)}`
  const campaignName = normalizeCampaignName(utm.campaign, fallbackCampaign)

  const dailyBudget = numberOrNull(budget.daily_budget_brl || budget.daily || budget.daily_budget)
  const totalBudget = numberOrNull(
    budget.total_test_budget_brl
    || budget.total_budget_brl
    || (dailyBudget && Number(plan?.duration_days) ? dailyBudget * Number(plan.duration_days) : null),
  )

  const pkg: Record<string, any> = {
    version: 1,
    generated_at: generatedAt,
    status: 'ready_for_human_execution',
    publication_mode: 'human_execution_required',
    publication_guardrail: 'O Vitor preparou o pacote, mas nao publicou campanha automaticamente.',
    campaign_name: campaignName,
    platform: 'meta_ads',
    review: {
      id: review?.id || null,
      score: review?.score ?? null,
      score_label: review?.score_label || null,
      recommendation: review?.recommendation || null,
      risks: safeArray(review?.risks).slice(0, 6),
      improvements: safeArray(review?.improvements).slice(0, 6),
    },
    creative: {
      id: creative?.id || review?.creative_id || null,
      title: creative?.title || null,
      asset_type: creative?.asset_type || null,
      content_type: creative?.content_type || null,
      asset_url: creative?.asset_url || null,
      thumbnail_url: creative?.thumbnail_url || null,
      property_sku: creative?.property_sku || null,
    },
    setup: {
      objective: plan?.objective || 'Gerar conversas qualificadas no WhatsApp',
      optimization_goal: 'Conversas ou leads qualificados',
      destination: 'WhatsApp ou formulario de lead conforme disponibilidade da conta',
      daily_budget_brl: dailyBudget,
      total_test_budget_brl: totalBudget,
      duration_days: numberOrNull(plan?.duration_days),
      audience: safeRecord(plan?.audience),
      locations: safeArray(plan?.locations),
    },
    copy_variations: normalizeCopyVariations(plan?.copy_variations),
    tracking: {
      utm_source: cleanString(utm.source || utm.utm_source, 80) || 'meta_ads',
      utm_medium: cleanString(utm.medium || utm.utm_medium, 80) || 'paid_social',
      utm_campaign: cleanString(utm.campaign || utm.utm_campaign, 120) || campaignName,
      utm_content: cleanString(utm.content || utm.utm_content, 120) || 'vitor_creative_review',
    },
    guardrails: {
      pre_launch_checklist: [
        'Conferir se o criativo abre corretamente no painel.',
        'Validar se a copy nao promete retorno financeiro ou valorizacao garantida.',
        'Confirmar localizacao, publico e verba antes de ativar.',
        'Aplicar UTM em todos os links ou formularios.',
        'Registrar no CRM a origem Vitor/Meta Ads para medir qualidade do lead.',
      ],
      pause_rules: stringRows(pauseScale.pause_if || pauseScale.pause_rules, [
        'Pausar se o CPL passar 35% acima da meta apos volume minimo de conversas.',
        'Pausar se os leads forem majoritariamente fora da regiao ou sem perfil financeiro.',
        'Pausar se CTR cair abaixo do esperado e houver frequencia elevada.',
      ]),
      scale_rules: stringRows(pauseScale.scale_if || pauseScale.scale_rules, [
        'Escalar 20% a 30% quando CPL estiver saudavel por 48 horas.',
        'Escalar apenas se o CRM confirmar lead qualificado ou oportunidade real.',
        'Duplicar variacao vencedora antes de ampliar demais o conjunto original.',
      ]),
    },
    human_execution_steps: [
      'Abrir o gerenciador de anuncios e criar campanha em rascunho.',
      'Usar o nome de campanha, objetivo, verba, duracao e publico deste pacote.',
      'Adicionar criativo e copy vencedora ou variacoes sugeridas.',
      'Aplicar UTM e conferir destino WhatsApp/formulario.',
      'Publicar somente apos conferencia humana final.',
      'Monitorar primeiras 24 a 48 horas e registrar qualidade no CRM.',
    ],
    notes: notes || null,
  }

  pkg.plain_text = buildExecutionPackagePlainText(pkg)
  return pkg
}

function normalizeMediaItems(value: unknown): MediaItem[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item): MediaItem | null => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const url = cleanString(row.url, 1200)
      if (!url) return null
      return {
        url,
        mime: cleanString(row.mime || row.mimetype || row.type, 160),
        kind: cleanString(row.kind || row.asset_type, 60) || 'media',
        filename: cleanString(row.filename || row.name, 180) || null,
      }
    })
    .filter((item): item is MediaItem => Boolean(item))
    .slice(0, 10)
}

function averageScore(reviews: any[]) {
  const scores = reviews
    .map(review => Number(review.score))
    .filter(score => Number.isFinite(score))
  if (!scores.length) return 0
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
}

function buildMetrics(reviews: any[], plans: any[]) {
  const reviewStatuses = reviews.reduce((acc: Record<string, number>, review) => {
    const status = String(review.status || 'unknown')
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {})
  const planStatuses = plans.reduce((acc: Record<string, number>, plan) => {
    const status = String(plan.status || 'unknown')
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {})

  return {
    total_reviews: reviews.length,
    avg_score: averageScore(reviews),
    inbox: reviews.filter(review => ['queued', 'processing', 'reviewed', 'needs_improvement'].includes(String(review.status || ''))).length,
    needs_improvement: reviewStatuses.needs_improvement || 0,
    approved_reviews: reviewStatuses.approved || 0,
    draft_plans: planStatuses.draft || 0,
    approved_plans: planStatuses.approved || 0,
    pending_human_decision: reviews.filter(review => ['reviewed', 'needs_improvement'].includes(String(review.status || ''))).length,
    high_risk: reviews.filter(review => Number(review.score || 0) < 60).length,
    review_statuses: reviewStatuses,
    plan_statuses: planStatuses,
  }
}

async function fetchRowsByIds(supabase: any, table: string, ids: string[], select = '*') {
  if (!ids.length) return []
  const { data, error } = await supabase
    .from(table)
    .select(select)
    .in('id', ids)
  if (error) throw error
  return data || []
}

export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  try {
    const limit = parseLimit(request.nextUrl.searchParams.get('limit'))
    const status = String(request.nextUrl.searchParams.get('status') || '').trim()

    let reviewsQuery = supabase
      .from('paid_traffic_creative_reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status && status !== 'all') reviewsQuery = reviewsQuery.eq('status', status)

    const { data: reviews, error: reviewsError } = await reviewsQuery
    if (reviewsError) {
      if (isMissingRelation(reviewsError)) {
        return NextResponse.json({
          success: true,
          ready: false,
          metrics: buildMetrics([], []),
          reviews: [],
          latest_report: null,
          error: reviewsError.message,
        })
      }
      throw reviewsError
    }

    const reviewRows = reviews || []
    const reviewIds = unique(reviewRows.map((review: any) => review.id))
    const creativeIds = unique(reviewRows.map((review: any) => review.creative_id))
    const commandIds = unique(reviewRows.map((review: any) => review.command_id))

    const [plans, creatives, commands, latestReports] = await Promise.all([
      reviewIds.length
        ? supabase
          .from('paid_traffic_campaign_plans')
          .select('*')
          .in('review_id', reviewIds)
          .order('created_at', { ascending: false })
          .then((res: any) => {
            if (res.error) throw res.error
            return res.data || []
          })
        : Promise.resolve([]),
      fetchRowsByIds(
        supabase,
        'marketing_creatives',
        creativeIds,
        'id, title, description, asset_url, thumbnail_url, asset_type, content_type, campaign_type, platform_targets, property_sku, ai_context, status, raw, created_at, updated_at',
      ),
      fetchRowsByIds(
        supabase,
        'whatsapp_global_commands',
        commandIds,
        'id, phone, identity_type, identity_label, command_type, target_agent, status, command_text, created_at, updated_at',
      ),
      supabase
        .from('marketing_ai_reports')
        .select('id, title, summary, metrics, created_at')
        .eq('report_type', 'paid')
        .order('created_at', { ascending: false })
        .limit(1)
        .then((res: any) => res.data || []),
    ])

    const creativeMap = byId(creatives)
    const commandMap = byId(commands)
    const plansByReview = new Map<string, any>()
    for (const plan of safeArray(plans)) {
      const key = String(plan.review_id || '')
      if (!key || plansByReview.has(key)) continue
      plansByReview.set(key, plan)
    }

    return NextResponse.json({
      success: true,
      ready: true,
      metrics: buildMetrics(reviewRows, plans),
      reviews: reviewRows.map((review: any) => ({
        ...review,
        creative: review.creative_id ? creativeMap.get(String(review.creative_id)) || null : null,
        command: review.command_id ? commandMap.get(String(review.command_id)) || null : null,
        campaign_plan: plansByReview.get(String(review.id)) || null,
      })),
      latest_report: latestReports?.[0] || null,
    })
  } catch (error) {
    console.error('[Vitor Traffic Manager] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao carregar area do Vitor.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  try {
    const body = await request.json()
    const title = cleanString(body?.title, 160)
    const briefing = cleanString(body?.briefing || body?.description, 3000)
    const mediaItems = normalizeMediaItems(body?.media)

    if (!title && !briefing && mediaItems.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Envie um titulo, briefing ou pelo menos um arquivo de criativo.' },
        { status: 400 },
      )
    }

    const result = await processVitorPanelCreative({
      supabase,
      title,
      briefing,
      mediaItems,
      assetType: cleanString(body?.asset_type, 40),
      contentType: cleanString(body?.content_type, 40),
      requestedByLabel: cleanString(body?.requested_by_label, 160) || 'Painel do Vitor',
      propertySku: cleanString(body?.property_sku, 80),
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('[Vitor Traffic Manager] Intake error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao analisar criativo no painel do Vitor.' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = createAdminClient()
  try {
    const body = await request.json()
    const reviewId = String(body?.review_id || '').trim()
    const action = String(body?.action || '').trim()
    const notes = String(body?.notes || '').trim().slice(0, 800)

    if (!reviewId) {
      return NextResponse.json({ success: false, error: 'review_id obrigatorio.' }, { status: 400 })
    }

    const actions: Record<string, { reviewStatus: string; planStatus?: string; creativeStatus?: string; label: string }> = {
      approve: {
        reviewStatus: 'approved',
        planStatus: 'approved',
        creativeStatus: 'approved',
        label: 'aprovou o plano do Vitor',
      },
      improve: {
        reviewStatus: 'needs_improvement',
        planStatus: 'draft',
        creativeStatus: 'review',
        label: 'pediu melhoria no criativo do Vitor',
      },
      cancel: {
        reviewStatus: 'cancelled',
        planStatus: 'cancelled',
        creativeStatus: 'archived',
        label: 'cancelou o plano do Vitor',
      },
      export: {
        reviewStatus: 'approved',
        planStatus: 'exported',
        creativeStatus: 'approved',
        label: 'marcou o plano do Vitor como exportado para execucao',
      },
    }

    const decision = actions[action]
    if (!decision) {
      return NextResponse.json({ success: false, error: 'Acao invalida.' }, { status: 400 })
    }

    const { data: review, error: reviewReadError } = await supabase
      .from('paid_traffic_creative_reviews')
      .select('*')
      .eq('id', reviewId)
      .maybeSingle()

    if (reviewReadError) throw reviewReadError
    if (!review?.id) return NextResponse.json({ success: false, error: 'Analise nao encontrada.' }, { status: 404 })

    const now = new Date().toISOString()
    const rawAnalysis = {
      ...(review.raw_analysis || {}),
      human_decision: {
        action,
        notes: notes || null,
        decided_at: now,
      },
    }

    const { data: updatedReview, error: reviewUpdateError } = await supabase
      .from('paid_traffic_creative_reviews')
      .update({
        status: decision.reviewStatus,
        raw_analysis: rawAnalysis,
        updated_at: now,
      })
      .eq('id', reviewId)
      .select('*')
      .single()

    if (reviewUpdateError) throw reviewUpdateError

    let updatedPlan: any = null
    if (decision.planStatus) {
      const { data: currentPlan, error: planReadError } = await supabase
        .from('paid_traffic_campaign_plans')
        .select('*')
        .eq('review_id', reviewId)
        .maybeSingle()

      if (planReadError) throw planReadError

      let creative: any = null
      if (action === 'export' && review.creative_id) {
        const { data: creativeData, error: creativeReadError } = await supabase
          .from('marketing_creatives')
          .select('id, title, description, asset_url, thumbnail_url, asset_type, content_type, property_sku, status, raw')
          .eq('id', review.creative_id)
          .maybeSingle()
        if (creativeReadError) throw creativeReadError
        creative = creativeData || null
      }

      const nextRawPlan: Record<string, any> = {
        ...safeRecord(currentPlan?.raw_plan),
        human_decision: {
          action,
          notes: notes || null,
          decided_at: now,
        },
      }

      if (action === 'export' && currentPlan?.id) {
        nextRawPlan.execution_package = buildHumanExecutionPackage({
          review,
          plan: currentPlan,
          creative,
          generatedAt: now,
          notes: notes || null,
        })
      }

      const { data: planData, error: planError } = await supabase
        .from('paid_traffic_campaign_plans')
        .update({
          status: decision.planStatus,
          updated_at: now,
          raw_plan: nextRawPlan,
        })
        .eq('id', currentPlan?.id || '00000000-0000-0000-0000-000000000000')
        .select('*')
        .maybeSingle()
      if (planError) throw planError
      updatedPlan = planData || null
    }

    if (decision.creativeStatus && review.creative_id) {
      await supabase
        .from('marketing_creatives')
        .update({
          status: decision.creativeStatus,
          updated_at: now,
        })
        .eq('id', review.creative_id)
    }

    await recordAgentCentralSignal({
      supabase,
      agentId: 'ads-analyst',
      eventType: 'paid_traffic_vitor_human_decision',
      entityType: 'paid_traffic_creative_review',
      entityId: reviewId,
      source: 'vitor-panel',
      label: `Humano ${decision.label}`,
      importanceScore: action === 'approve' ? 78 : action === 'cancel' ? 70 : 64,
      metadata: {
        action,
        notes: notes || null,
        review_id: reviewId,
        creative_id: review.creative_id || null,
        campaign_plan_id: updatedPlan?.id || null,
        execution_package_ready: Boolean(safeRecord(updatedPlan?.raw_plan).execution_package),
        previous_status: review.status,
        next_status: decision.reviewStatus,
      },
      handoffTargets: ['whatsapp-global-agent', 'creative-strategy-agent', 'ceo-agent'],
    }).catch((error: any) => {
      console.warn('[Vitor Traffic Manager] central signal failed:', error?.message || error)
    })

    return NextResponse.json({
      success: true,
      review: updatedReview,
      campaign_plan: updatedPlan,
    })
  } catch (error) {
    console.error('[Vitor Traffic Manager] Decision error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao atualizar decisao do Vitor.' },
      { status: 500 },
    )
  }
}
