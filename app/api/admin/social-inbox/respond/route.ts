import { NextRequest, NextResponse } from 'next/server'
import { approveSocialSuggestion, respondToSocialSuggestion } from '@/lib/social/meta-responder'

export const dynamic = 'force-dynamic'

function cleanString(value: unknown, max = 2000) {
  const text = String(value || '').trim()
  return text.length > max ? text.slice(0, max) : text
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const suggestionId = cleanString(body.suggestion_id, 80)
    const action = cleanString(body.action, 40) || 'approve'

    if (!suggestionId) {
      return NextResponse.json({ success: false, error: 'Informe a sugestao.' }, { status: 400 })
    }

    if (action === 'approve') {
      const suggestion = await approveSocialSuggestion(suggestionId)
      return NextResponse.json({ success: true, action: 'approve', suggestion })
    }

    if (action === 'send') {
      const result = await respondToSocialSuggestion({
        suggestionId,
        reply: cleanString(body.reply, 1800),
        requireAutopilot: body.require_autopilot === true,
      })
      return NextResponse.json({ success: true, action: 'send', ...result })
    }

    return NextResponse.json({ success: false, error: 'Acao invalida.' }, { status: 400 })
  } catch (error) {
    console.error('Error responding to Meta inbox:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao responder Meta.' },
      { status: 500 },
    )
  }
}
