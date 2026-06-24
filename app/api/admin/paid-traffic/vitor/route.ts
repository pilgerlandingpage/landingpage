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
        .select('id, raw_plan')
        .eq('review_id', reviewId)
        .maybeSingle()

      if (planReadError) throw planReadError

      const { data: planData, error: planError } = await supabase
        .from('paid_traffic_campaign_plans')
        .update({
          status: decision.planStatus,
          updated_at: now,
          raw_plan: {
            ...(currentPlan?.raw_plan || {}),
            human_decision: {
              action,
              notes: notes || null,
              decided_at: now,
            },
          },
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
