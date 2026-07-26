import { NextRequest, NextResponse } from 'next/server'
import { listInstagramCampaignMedia } from '@/lib/social/meta-comment-dm-automation'
import { syncFacebookOrganic } from '@/lib/social/facebook'
import { syncInstagramOrganic } from '@/lib/social/instagram'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function parseLimit(value: string | null, fallback = 40) {
  const parsed = Number(value || fallback)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), 1), 80)
}

export async function GET(request: NextRequest) {
  try {
    const limit = parseLimit(request.nextUrl.searchParams.get('limit'))
    const platformParam = request.nextUrl.searchParams.get('platform') || 'instagram'
    const platform = platformParam === 'facebook' ? 'facebook' : platformParam === 'all' ? 'all' : 'instagram'
    let sync: unknown = null

    if (request.nextUrl.searchParams.get('sync') === '1') {
      sync = platform === 'facebook'
        ? await syncFacebookOrganic(Math.min(limit, 50))
        : platform === 'all'
          ? {
              instagram: await syncInstagramOrganic(Math.min(limit, 50)),
              facebook: await syncFacebookOrganic(Math.min(limit, 50)),
            }
          : await syncInstagramOrganic(Math.min(limit, 50))
    }

    const media = await listInstagramCampaignMedia(limit, platform)
    return NextResponse.json({ success: true, media, sync })
  } catch (error) {
    console.error('Error listing Instagram campaign media:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao listar posts/reels do Instagram.' },
      { status: 500 },
    )
  }
}
