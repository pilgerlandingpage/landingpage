import { NextRequest, NextResponse } from 'next/server'
import { syncMetaSocialInbox } from '@/lib/social/meta-inbox'

export const dynamic = 'force-dynamic'

function parseNumber(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value || fallback)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), min), max)
}

export async function POST(request: NextRequest) {
  try {
    const platform = request.nextUrl.searchParams.get('platform') || 'all'
    const scope = request.nextUrl.searchParams.get('scope') || 'all'

    if (!['all', 'instagram', 'facebook'].includes(platform)) {
      return NextResponse.json({ success: false, error: 'Plataforma invalida.' }, { status: 400 })
    }

    if (!['all', 'comments', 'messages'].includes(scope)) {
      return NextResponse.json({ success: false, error: 'Escopo invalido.' }, { status: 400 })
    }

    const result = await syncMetaSocialInbox({
      platform: platform as 'all' | 'instagram' | 'facebook',
      scope: scope as 'all' | 'comments' | 'messages',
      mediaLimit: parseNumber(request.nextUrl.searchParams.get('mediaLimit'), 12, 1, 50),
      commentsPerMedia: parseNumber(request.nextUrl.searchParams.get('commentsPerMedia'), 25, 1, 100),
      conversationLimit: parseNumber(request.nextUrl.searchParams.get('conversationLimit'), 20, 1, 100),
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error syncing Meta social inbox:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao sincronizar inbox Meta.',
      },
      { status: 500 },
    )
  }
}
