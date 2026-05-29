import { NextRequest, NextResponse } from 'next/server'
import { listMetaSocialInbox } from '@/lib/social/meta-inbox'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const platform = request.nextUrl.searchParams.get('platform') || undefined
    const rawLimit = Number(request.nextUrl.searchParams.get('limit') || 50)
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100) : 50

    if (platform && !['instagram', 'facebook'].includes(platform)) {
      return NextResponse.json({ success: false, error: 'Plataforma invalida.' }, { status: 400 })
    }

    const inbox = await listMetaSocialInbox({
      platform: platform as 'instagram' | 'facebook' | undefined,
      limit,
    })

    return NextResponse.json({
      success: true,
      ...inbox,
    })
  } catch (error) {
    console.error('Error listing Meta social inbox:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao carregar inbox Meta.',
      },
      { status: 500 },
    )
  }
}
