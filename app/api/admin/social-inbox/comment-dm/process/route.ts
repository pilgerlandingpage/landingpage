import { NextRequest, NextResponse } from 'next/server'
import {
  processDueCommentDmFlowFollowups,
  processInstagramCommentForDmAutomation,
  processRecentInstagramCommentsForDm,
} from '@/lib/social/meta-comment-dm-automation'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function parseLimit(value: unknown, fallback = 30) {
  const parsed = Number(value || fallback)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), 1), 100)
}

function cleanString(value: unknown, max = 120) {
  const text = String(value || '').trim()
  return text.length > max ? text.slice(0, max) : text
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const commentId = cleanString(body.comment_id || request.nextUrl.searchParams.get('comment_id'))
    const externalId = cleanString(body.external_id || request.nextUrl.searchParams.get('external_id'))
    const force = body.force === true || request.nextUrl.searchParams.get('force') === '1'
    const dryRun = body.dry_run === true || request.nextUrl.searchParams.get('dry_run') === '1'

    if (commentId || externalId) {
      const result = await processInstagramCommentForDmAutomation({
        commentId: commentId || undefined,
        externalId: externalId || undefined,
        force,
        dryRun,
        source: 'admin_process',
      })
      return NextResponse.json(result)
    }

    const result = await processRecentInstagramCommentsForDm({
      limit: parseLimit(body.limit || request.nextUrl.searchParams.get('limit')),
      force,
      dryRun,
      source: 'admin_process_recent',
    })
    const followups = dryRun ? { success: true, skipped: true, reason: 'dry_run' } : await processDueCommentDmFlowFollowups(30)
    return NextResponse.json({ ...result, followups })
  } catch (error) {
    console.error('Error processing comment DM automation:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao processar automacao de Direct.' },
      { status: 500 },
    )
  }
}
