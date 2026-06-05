import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { recordAgentCentralSignal } from '@/lib/intelligence/agent-runtime'

export const dynamic = 'force-dynamic'

const allowedAssetTypes = new Set(['image', 'video', 'carousel', 'document', 'other'])
const allowedContentTypes = new Set(['post', 'reel', 'story', 'ad', 'short', 'email', 'other'])
const allowedCampaignTypes = new Set(['organic', 'paid', 'both'])
const allowedStatuses = new Set(['draft', 'review', 'approved', 'scheduled', 'published', 'archived'])

function cleanString(value: unknown, max = 3000) {
  const text = String(value || '').trim()
  return text.length > max ? text.slice(0, max) : text
}

function cleanArray(value: unknown) {
  if (Array.isArray(value)) return value.map(item => cleanString(item, 40)).filter(Boolean).slice(0, 12)
  return String(value || '')
    .split(',')
    .map(item => cleanString(item, 40))
    .filter(Boolean)
    .slice(0, 12)
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const status = request.nextUrl.searchParams.get('status')
    const campaignType = request.nextUrl.searchParams.get('campaign_type')
    const rawLimit = Number(request.nextUrl.searchParams.get('limit') || 60)
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100) : 60

    let query = supabase
      .from('marketing_creatives')
      .select('id, title, description, asset_url, thumbnail_url, asset_type, content_type, campaign_type, platform_targets, property_sku, ai_context, status, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (status && allowedStatuses.has(status)) query = query.eq('status', status)
    if (campaignType && allowedCampaignTypes.has(campaignType)) query = query.eq('campaign_type', campaignType)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true, creatives: data || [] })
  } catch (error) {
    console.error('Error listing marketing creatives:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao listar criativos.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const title = cleanString(body.title, 160)
    if (!title) {
      return NextResponse.json({ success: false, error: 'Informe o titulo do criativo.' }, { status: 400 })
    }

    const assetType = allowedAssetTypes.has(body.asset_type) ? body.asset_type : 'image'
    const contentType = allowedContentTypes.has(body.content_type) ? body.content_type : 'post'
    const campaignType = allowedCampaignTypes.has(body.campaign_type) ? body.campaign_type : 'organic'
    const status = allowedStatuses.has(body.status) ? body.status : 'draft'
    const now = new Date().toISOString()

    const row = {
      title,
      description: cleanString(body.description, 1200) || null,
      asset_url: cleanString(body.asset_url, 1200) || null,
      thumbnail_url: cleanString(body.thumbnail_url, 1200) || null,
      asset_type: assetType,
      content_type: contentType,
      campaign_type: campaignType,
      platform_targets: cleanArray(body.platform_targets),
      property_sku: cleanString(body.property_sku, 80) || null,
      ai_context: cleanString(body.ai_context, 3000) || null,
      status,
      updated_at: now,
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('marketing_creatives')
      .insert(row)
      .select('id, title, description, asset_url, thumbnail_url, asset_type, content_type, campaign_type, platform_targets, property_sku, ai_context, status, created_at, updated_at')
      .single()

    if (error || !data) throw new Error(error?.message || 'Nao foi possivel salvar o criativo.')

    if (body.scheduled_for && Array.isArray(row.platform_targets) && row.platform_targets.length > 0) {
      const scheduledRows = row.platform_targets.map(platform => ({
        creative_id: data.id,
        platform,
        status: 'scheduled',
        caption: row.description,
        ai_context: row.ai_context,
        scheduled_for: body.scheduled_for,
        updated_at: now,
      }))

      const { error: scheduledError } = await supabase
        .from('marketing_scheduled_posts')
        .insert(scheduledRows)

      if (scheduledError) throw new Error(scheduledError.message)
    }

    await recordAgentCentralSignal({
      supabase,
      agentId: 'creative-strategy-agent',
      eventType: 'marketing_creative_created',
      entityType: 'marketing_creative',
      entityId: data.id,
      source: 'creative-strategy-agent',
      label: `Clara Criativos cadastrou ${data.title}`,
      importanceScore: status === 'approved' || status === 'scheduled' ? 68 : 56,
      metadata: {
        creative: data,
        scheduled_for: body.scheduled_for || null,
        scheduled_platforms: row.platform_targets,
      },
      handoffTargets: ['content-publisher-agent', 'ads-analyst', 'organic-report-agent'],
    }).catch((error: any) => {
      console.warn('[Marketing Creatives] central signal failed:', error?.message || error)
    })

    return NextResponse.json({ success: true, creative: data })
  } catch (error) {
    console.error('Error creating marketing creative:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao criar criativo.' },
      { status: 500 },
    )
  }
}
