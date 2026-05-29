import { NextRequest, NextResponse } from 'next/server'
import { saveAppConfig } from '@/lib/admin/app-config'
import { enqueueBehavioralPropertyRecommendations, processDueEditorialDistribution } from '@/lib/editorial-distribution'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

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

    try {
        await saveCronState(supabase, {
            editorial_distribution_cron_last_checked_at: checkedAt,
            editorial_distribution_cron_last_reason: 'processing',
        })

        let recommendationResult: any = null
        try {
            recommendationResult = await enqueueBehavioralPropertyRecommendations(supabase, request.nextUrl.origin)
        } catch (recommendationError: any) {
            recommendationResult = {
                queued: false,
                skipped: true,
                reason: 'recommendation_error',
                error: String(recommendationError?.message || recommendationError).slice(0, 500),
            }
            console.warn('[editorial-distribution-cron] recommendation enqueue failed:', recommendationError)
        }

        const result = await processDueEditorialDistribution(supabase, 20)
        const combinedResult = {
            ...result,
            recommendations: recommendationResult,
        }

        await saveCronState(supabase, {
            editorial_distribution_cron_last_reason: result.skipped ? (result.reason || 'skipped') : 'ran',
            editorial_distribution_cron_last_run_at: new Date().toISOString(),
            editorial_distribution_cron_last_result: JSON.stringify(combinedResult).slice(0, 2000),
        })

        return NextResponse.json({ success: true, ...combinedResult })
    } catch (error: any) {
        await saveCronState(supabase, {
            editorial_distribution_cron_last_reason: 'error',
            editorial_distribution_cron_last_error: String(error?.message || error).slice(0, 500),
            editorial_distribution_cron_last_error_at: new Date().toISOString(),
        })

        return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 })
    }
}
