import { NextRequest, NextResponse } from 'next/server'
import { markAgentCompleted, markAgentFailed, markAgentStarted, saveAppConfig } from '@/lib/admin/app-config'
import { processLeadExecutiveBriefs } from '@/lib/leads/lead-executive-briefs'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function saveCronState(supabase: ReturnType<typeof createAdminClient>, values: Record<string, string>) {
    await Promise.all(
        Object.entries(values).map(([key, value]) => saveAppConfig(supabase, key, value).catch(() => {}))
    )
}

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const checkedAt = new Date().toISOString()

    await saveCronState(supabase, {
        lead_executive_briefs_cron_last_checked_at: checkedAt,
        lead_executive_briefs_cron_last_reason: 'processing',
    })

    try {
        await markAgentStarted(supabase, 'lead_executive_briefs')

        const result = await processLeadExecutiveBriefs(supabase, {
            limit: 500,
            source: 'vercel_cron',
            aiNarrative: true,
            aiLimit: 80,
        })

        await Promise.all([
            markAgentCompleted(supabase, 'lead_executive_briefs', result),
            saveCronState(supabase, {
                lead_executive_briefs_cron_last_reason: 'ran',
                lead_executive_briefs_cron_last_run_at: new Date().toISOString(),
                lead_executive_briefs_cron_last_result: JSON.stringify(result).slice(0, 2000),
            }),
        ])

        return NextResponse.json({
            success: true,
            result,
        })
    } catch (error) {
        await Promise.all([
            markAgentFailed(supabase, 'lead_executive_briefs', error).catch(() => {}),
            saveCronState(supabase, {
                lead_executive_briefs_cron_last_reason: 'error',
                lead_executive_briefs_cron_last_error: String(error instanceof Error ? error.message : error).slice(0, 500),
                lead_executive_briefs_cron_last_error_at: new Date().toISOString(),
            }),
        ])

        console.error('[Lead Executive Briefs Cron] GET error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
