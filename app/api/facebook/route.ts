import { NextRequest, NextResponse } from 'next/server'
import {
  getCachedFacebookOrganic,
  isFacebookCacheFresh,
  syncFacebookOrganic,
} from '@/lib/social/facebook'

export const dynamic = 'force-dynamic'

function parseLimit(request: NextRequest) {
  const raw = Number(request.nextUrl.searchParams.get('limit') || 12)
  if (!Number.isFinite(raw)) return 12
  return Math.min(Math.max(Math.trunc(raw), 1), 24)
}

export async function GET(request: NextRequest) {
  const limit = parseLimit(request)
  const force = request.nextUrl.searchParams.get('force') === '1'

  try {
    if (!force && await isFacebookCacheFresh()) {
      const cached = await getCachedFacebookOrganic(limit)
      return NextResponse.json(cached)
    }

    const synced = await syncFacebookOrganic(limit)
    return NextResponse.json(synced)
  } catch (error) {
    console.error('Error syncing Facebook organic data:', error)

    const cached = await getCachedFacebookOrganic(limit)
    if (cached) {
      return NextResponse.json({
        ...cached,
        stale: true,
        warning: 'Dados retornados do cache porque a sincronizacao com a Meta falhou.',
      })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao sincronizar Facebook.' },
      { status: 500 },
    )
  }
}
