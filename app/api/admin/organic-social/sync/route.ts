import { NextRequest, NextResponse } from 'next/server'
import { markAgentCompleted, markAgentFailed, markAgentStarted } from '@/lib/admin/app-config'
import { createAdminClient } from '@/lib/supabase/server'
import { syncFacebookOrganic } from '@/lib/social/facebook'
import { syncInstagramOrganic } from '@/lib/social/instagram'

export const dynamic = 'force-dynamic'

function parseLimit(request: NextRequest) {
  const raw = Number(request.nextUrl.searchParams.get('limit') || 24)
  if (!Number.isFinite(raw)) return 24
  return Math.min(Math.max(Math.trunc(raw), 1), 50)
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  try {
    await markAgentStarted(supabase, 'organic_social_sync')
    const limit = parseLimit(request)
    const platform = request.nextUrl.searchParams.get('platform') || 'all'
    const payload: Record<string, unknown> = {}

    if (platform === 'instagram' || platform === 'all') {
      payload.instagram = await syncInstagramOrganic(limit)
    }

    if (platform === 'facebook' || platform === 'all') {
      payload.facebook = await syncFacebookOrganic(limit)
    }

    const result = {
      success: true,
      message: 'Trafego organico sincronizado.',
      ...payload,
    }

    await markAgentCompleted(supabase, 'organic_social_sync', {
      platform,
      limit,
      source: 'manual_api',
    })

    return NextResponse.json(result)
  } catch (error) {
    await markAgentFailed(supabase, 'organic_social_sync', error).catch(() => {})
    console.error('Error syncing organic social data:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao sincronizar trafego organico.',
      },
      { status: 500 },
    )
  }
}
