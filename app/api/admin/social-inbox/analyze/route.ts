import { NextRequest, NextResponse } from 'next/server'
import { analyzeMetaSocialInbox, listMetaSocialSuggestions } from '@/lib/social/meta-social-agent'

export const dynamic = 'force-dynamic'

function parseLimit(value: string | null, fallback = 30) {
  const parsed = Number(value || fallback)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), 1), 100)
}

export async function GET(request: NextRequest) {
  try {
    const suggestions = await listMetaSocialSuggestions(parseLimit(request.nextUrl.searchParams.get('limit'), 40))
    return NextResponse.json({ success: true, suggestions })
  } catch (error) {
    console.error('Error listing social inbox AI suggestions:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao listar sugestoes da IA.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await analyzeMetaSocialInbox({
      limit: parseLimit(request.nextUrl.searchParams.get('limit'), 20),
      force: request.nextUrl.searchParams.get('force') === '1',
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error analyzing social inbox:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao analisar inbox social.' },
      { status: 500 },
    )
  }
}
