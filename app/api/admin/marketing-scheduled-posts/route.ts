import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const allowedPlatforms = new Set(['instagram', 'facebook', 'tiktok', 'youtube', 'meta_ads', 'google_ads', 'site'])
const allowedStatuses = new Set(['draft', 'review', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'cancelled'])

function cleanString(value: unknown, max = 3000) {
  const text = String(value || '').trim()
  return text.length > max ? text.slice(0, max) : text
}

function cleanDate(value: unknown) {
  const text = cleanString(value, 80)
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const status = request.nextUrl.searchParams.get('status')
    const platform = request.nextUrl.searchParams.get('platform')
    const rawLimit = Number(request.nextUrl.searchParams.get('limit') || 80)
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 120) : 80

    let query = supabase
      .from('marketing_scheduled_posts')
      .select(`
        id,
        creative_id,
        platform,
        status,
        caption,
        ai_context,
        scheduled_for,
        published_at,
        external_id,
        permalink,
        error_message,
        created_at,
        updated_at,
        marketing_creatives (
          id,
          title,
          asset_url,
          thumbnail_url,
          asset_type,
          content_type,
          campaign_type,
          property_sku,
          status
        )
      `)
      .order('scheduled_for', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status && allowedStatuses.has(status)) query = query.eq('status', status)
    if (platform && allowedPlatforms.has(platform)) query = query.eq('platform', platform)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true, posts: data || [] })
  } catch (error) {
    console.error('Error listing marketing scheduled posts:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao listar agenda editorial.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const creativeId = cleanString(body.creative_id, 80)
    const platform = allowedPlatforms.has(body.platform) ? body.platform : ''
    if (!creativeId) {
      return NextResponse.json({ success: false, error: 'Informe o criativo.' }, { status: 400 })
    }
    if (!platform) {
      return NextResponse.json({ success: false, error: 'Informe a plataforma.' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const row = {
      creative_id: creativeId,
      platform,
      status: allowedStatuses.has(body.status) ? body.status : 'draft',
      caption: cleanString(body.caption, 2200) || null,
      ai_context: cleanString(body.ai_context, 3000) || null,
      scheduled_for: cleanDate(body.scheduled_for),
      updated_at: now,
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('marketing_scheduled_posts')
      .insert(row)
      .select('id, creative_id, platform, status, caption, ai_context, scheduled_for, published_at, external_id, permalink, error_message, created_at, updated_at')
      .single()

    if (error || !data) throw new Error(error?.message || 'Nao foi possivel criar o agendamento.')

    return NextResponse.json({ success: true, post: data })
  } catch (error) {
    console.error('Error creating marketing scheduled post:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao criar agendamento.' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const id = cleanString(body.id, 80)
    if (!id) return NextResponse.json({ success: false, error: 'Informe o agendamento.' }, { status: 400 })

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.status && allowedStatuses.has(body.status)) updates.status = body.status
    if (body.platform && allowedPlatforms.has(body.platform)) updates.platform = body.platform
    if ('caption' in body) updates.caption = cleanString(body.caption, 2200) || null
    if ('ai_context' in body) updates.ai_context = cleanString(body.ai_context, 3000) || null
    if ('scheduled_for' in body) updates.scheduled_for = cleanDate(body.scheduled_for)
    if ('error_message' in body) updates.error_message = cleanString(body.error_message, 1200) || null
    if ('permalink' in body) updates.permalink = cleanString(body.permalink, 1200) || null
    if ('external_id' in body) updates.external_id = cleanString(body.external_id, 300) || null
    if (body.status === 'published') updates.published_at = new Date().toISOString()

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('marketing_scheduled_posts')
      .update(updates)
      .eq('id', id)
      .select('id, creative_id, platform, status, caption, ai_context, scheduled_for, published_at, external_id, permalink, error_message, created_at, updated_at')
      .single()

    if (error || !data) throw new Error(error?.message || 'Nao foi possivel atualizar o agendamento.')

    return NextResponse.json({ success: true, post: data })
  } catch (error) {
    console.error('Error updating marketing scheduled post:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao atualizar agendamento.' },
      { status: 500 },
    )
  }
}
