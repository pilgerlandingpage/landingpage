import { NextRequest, NextResponse } from 'next/server'
import { syncMetaSocialInbox } from '@/lib/social/meta-inbox'
import {
  processDueCommentDmFlowFollowups,
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
    let syncWarning: string | null = null
    let syncResult: unknown = null

    if (request.nextUrl.searchParams.get('skip_sync') !== 'true') {
      try {
        syncResult = await syncMetaSocialInbox({
          platform: 'all',
          scope: 'comments',
          mediaLimit: 8,
          commentsPerMedia: 50,
          conversationLimit: 1,
        })
      } catch (syncError) {
        syncWarning = syncError instanceof Error ? syncError.message : 'Falha ao sincronizar comentarios Instagram.'
      }
    }

    const automation = await processRecentInstagramCommentsForDm({
      limit: 40,
      force: request.nextUrl.searchParams.get('force') === 'true',
      dryRun: request.nextUrl.searchParams.get('dry_run') === 'true',
      source: 'vercel_cron',
      requireCronEnabled: true,
    })
    const followups = request.nextUrl.searchParams.get('dry_run') === 'true'
      ? { success: true, skipped: true, reason: 'dry_run' }
      : await processDueCommentDmFlowFollowups(30)
    const result = { ...automation, followups, sync: syncResult, sync_warning: syncWarning }
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
