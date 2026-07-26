import { NextRequest, NextResponse } from 'next/server'
import { refreshInstagramLongLivedToken } from '@/lib/social/meta-oauth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const force = request.nextUrl.searchParams.get('force') === 'true'
  const logSkipped = request.nextUrl.searchParams.get('log_skipped') === 'true'

  try {
    const result = await refreshInstagramLongLivedToken({ force, logSkipped })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao renovar token Instagram.'
    return NextResponse.json(
      {
        success: false,
        reason: 'refresh_error',
        message,
      },
      { status: 500 },
    )
  }
}
