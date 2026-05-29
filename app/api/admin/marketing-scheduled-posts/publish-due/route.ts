import { NextRequest, NextResponse } from 'next/server'
import { publishDueScheduledPosts } from '@/lib/social/meta-publisher'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const result = await publishDueScheduledPosts({
      limit: Number(body.limit || 10),
      dryRun: body.dry_run === true,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Error publishing due marketing posts:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao processar publicacoes.' },
      { status: 500 },
    )
  }
}
