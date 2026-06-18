import { NextRequest, NextResponse } from 'next/server'
import { markAgentCompleted, markAgentFailed, markAgentStarted, saveAppConfig } from '@/lib/admin/app-config'
import { processCrmActionRecommendations } from '@/lib/leads/crm-action-recommendations'
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
        crm_action_recommendations_cron_last_checked_at: checkedAt,
        crm_action_recommendations_cron_last_reason: 'processing',
    })

    try {
        await markAgentStarted(supabase, 'crm_action_recommendations')

        const result = await processCrmActionRecommendations(supabase, {
            limit: 500,
            source: 'vercel_cron',
        })

        await Promise.all([
            markAgentCompleted(supabase, 'crm_action_recommendations', result),
            saveCronState(supabase, {
                crm_action_recommendations_cron_last_reason: 'ran',
                crm_action_recommendations_cron_last_run_at: new Date().toISOString(),
                crm_action_recommendations_cron_last_result: JSON.stringify(result).slice(0, 2000),
            }),
        ])

        return NextResponse.json({
            success: true,
            result,
        })
    } catch (error) {
        await Promise.all([
            markAgentFailed(supabase, 'crm_action_recommendations', error).catch(() => {}),
            saveCronState(supabase, {
                crm_action_recommendations_cron_last_reason: 'error',
                crm_action_recommendations_cron_last_error: String(error instanceof Error ? error.message : error).slice(0, 500),
                crm_action_recommendations_cron_last_error_at: new Date().toISOString(),
            }),
        ])

        console.error('[CRM Action Recommendations Cron] GET error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
