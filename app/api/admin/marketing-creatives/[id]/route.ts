import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if ('title' in body) {
      const title = cleanString(body.title, 160)
      if (!title) return NextResponse.json({ success: false, error: 'Informe o titulo.' }, { status: 400 })
      updates.title = title
    }
    if ('description' in body) updates.description = cleanString(body.description, 1200) || null
    if ('asset_url' in body) updates.asset_url = cleanString(body.asset_url, 1200) || null
    if ('thumbnail_url' in body) updates.thumbnail_url = cleanString(body.thumbnail_url, 1200) || null
    if ('asset_type' in body && allowedAssetTypes.has(body.asset_type)) updates.asset_type = body.asset_type
    if ('content_type' in body && allowedContentTypes.has(body.content_type)) updates.content_type = body.content_type
    if ('campaign_type' in body && allowedCampaignTypes.has(body.campaign_type)) updates.campaign_type = body.campaign_type
    if ('platform_targets' in body) updates.platform_targets = cleanArray(body.platform_targets)
    if ('property_sku' in body) updates.property_sku = cleanString(body.property_sku, 80) || null
    if ('ai_context' in body) updates.ai_context = cleanString(body.ai_context, 3000) || null
    if ('status' in body && allowedStatuses.has(body.status)) updates.status = body.status
    if ('raw' in body && body.raw && typeof body.raw === 'object' && !Array.isArray(body.raw)) updates.raw = body.raw

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('marketing_creatives')
      .update(updates)
      .eq('id', id)
      .select('id, title, description, asset_url, thumbnail_url, asset_type, content_type, campaign_type, platform_targets, property_sku, ai_context, status, raw, created_at, updated_at')
      .single()

    if (error || !data) throw new Error(error?.message || 'Nao foi possivel atualizar o criativo.')

    return NextResponse.json({ success: true, creative: data })
  } catch (error) {
    console.error('Error updating marketing creative:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao atualizar criativo.' },
      { status: 500 },
    )
  }
}
