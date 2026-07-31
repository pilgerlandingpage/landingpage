import { NextRequest, NextResponse } from 'next/server'
import { syncMetaSocialInbox } from '@/lib/social/meta-inbox'
import {
  processDueCommentDmFlowFollowups,
  processRecentInstagramDirectFlowMessages,
  processRecentInstagramCommentsForDm,
  recordCommentDmCronResult,
} from '@/lib/social/meta-comment-dm-automation'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const syncWarnings: string[] = []
    let syncResult: unknown = null

    if (request.nextUrl.searchParams.get('skip_sync') !== 'true') {
      const syncParts: Record<string, unknown> = {}
      try {
        syncParts.comments = await syncMetaSocialInbox({
          platform: 'all',
          scope: 'comments',
          mediaLimit: 8,
          commentsPerMedia: 50,
          conversationLimit: 1,
        })
      } catch (syncError) {
        syncWarnings.push(syncError instanceof Error ? syncError.message : 'Falha ao sincronizar comentarios Instagram.')
      }
      try {
        syncParts.messages = await syncMetaSocialInbox({
          platform: 'instagram',
          scope: 'messages',
          mediaLimit: 1,
          commentsPerMedia: 1,
          conversationLimit: 20,
        })
      } catch (syncError) {
        syncWarnings.push(syncError instanceof Error ? syncError.message : 'Falha ao sincronizar Directs Instagram.')
      }
      syncResult = syncParts
    }

    const dryRun = request.nextUrl.searchParams.get('dry_run') === 'true'
    const automation = await processRecentInstagramCommentsForDm({
      limit: 40,
      force: request.nextUrl.searchParams.get('force') === 'true',
      dryRun,
      source: 'vercel_cron',
      requireCronEnabled: true,
    })
    const directMessages = dryRun
      ? { success: true, skipped: true, reason: 'dry_run' }
      : await processRecentInstagramDirectFlowMessages({ limit: 40, sinceMinutes: 10 })
    const followups = dryRun
      ? { success: true, skipped: true, reason: 'dry_run' }
      : await processDueCommentDmFlowFollowups(30)
    const result = { ...automation, direct_messages: directMessages, followups, sync: syncResult, sync_warning: syncWarnings.join(' | ') || null }
    await recordCommentDmCronResult(result)
    return NextResponse.json(result)
  } catch (error) {
    await recordCommentDmCronResult(null, error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro no cron de Direct por comentario.' },
      { status: 500 },
    )
  }
}
