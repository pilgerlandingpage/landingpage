import { NextRequest, NextResponse } from 'next/server'
import { markAgentCompleted, markAgentFailed, markAgentStarted, saveAppConfig } from '@/lib/admin/app-config'
import {
    processPropertySearchAlerts,
    SEARCH_ALERT_PROPERTY_MATCH_FIELDS,
    type ProcessSearchAlertMatchesResult,
} from '@/lib/properties/search-alert-matcher'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 800

const AGENT_PREFIX = 'property_search_alerts'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

function numberParam(value: unknown, fallback: number, max: number) {
    const number = Number(value)
    if (!Number.isFinite(number) || number <= 0) return fallback
    return Math.min(Math.round(number), max)
}

async function saveCronState(supabase: SupabaseAdmin, values: Record<string, string>) {
    await Promise.all(
        Object.entries(values).map(([key, value]) => saveAppConfig(supabase, key, value).catch(() => {}))
    )
}

async function readConfigValue(supabase: SupabaseAdmin, key: string) {
    const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', key)
        .maybeSingle()

    return typeof data?.value === 'string' ? data.value : ''
}

function validIsoDate(value: string) {
    if (!value) return ''
    const timestamp = new Date(value).getTime()
    return Number.isFinite(timestamp) ? value : ''
}

function summarizeResults(results: ProcessSearchAlertMatchesResult[]) {
    return results.reduce(
        (summary, result) => {
            summary.alerts_checked += Number(result.alert_count || 0)
            summary.matches_created += Number(result.match_count || 0)
            summary.notifications_sent += Number(result.notification_sent || 0)
            summary.notifications_failed += Number(result.notification_failed || 0)
            if (result.error) summary.property_errors += 1
            return summary
        },
        {
            alerts_checked: 0,
            matches_created: 0,
            notifications_sent: 0,
            notifications_failed: 0,
            property_errors: 0,
        }
    )
}

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()
    const checkedAt = new Date().toISOString()
    const force = request.nextUrl.searchParams.get('force') === 'true'
    const limit = numberParam(request.nextUrl.searchParams.get('limit'), 60, 200)

    await saveCronState(supabase, {
        property_search_alerts_cron_last_checked_at: checkedAt,
        property_search_alerts_cron_last_reason: 'processing',
    })

    try {
        await markAgentStarted(supabase, AGENT_PREFIX)

        const lastRunAt = force ? '' : validIsoDate(await readConfigValue(supabase, `${AGENT_PREFIX}_last_run_at`))
        let query = supabase
            .from('properties')
            .select(SEARCH_ALERT_PROPERTY_MATCH_FIELDS)
            .eq('status', 'active')
            .order('updated_at', { ascending: false })
            .limit(limit)

        if (lastRunAt) query = query.gte('updated_at', lastRunAt)

        const { data: properties, error } = await query
        if (error) throw error

        const results: ProcessSearchAlertMatchesResult[] = []
        for (const property of properties || []) {
            try {
                results.push(await processPropertySearchAlerts(supabase, property, {
                    source: 'vercel_cron_property_search_alerts',
                }))
            } catch (propertyError) {
                results.push({
                    processed: false,
                    property_id: String((property as any)?.id || ''),
                    alert_count: 0,
                    match_count: 0,
                    notification_sent: 0,
                    notification_failed: 0,
                    matches: [],
                    skipped_reason: 'property_processing_failed',
                    error: propertyError instanceof Error ? propertyError.message : String(propertyError),
                })
            }
        }

        const processedAt = new Date().toISOString()
        await supabase
            .from('property_search_alerts')
            .update({ last_processed_at: processedAt })
            .eq('status', 'active')

        const totals = summarizeResults(results)
        const summary = {
            source: 'vercel_cron',
            force,
            limit,
            updated_since: lastRunAt || null,
            processed_at: processedAt,
            processed_properties: results.length,
            ...totals,
        }

        await Promise.all([
            markAgentCompleted(supabase, AGENT_PREFIX, summary),
            saveCronState(supabase, {
                property_search_alerts_cron_last_reason: 'ran',
                property_search_alerts_cron_last_run_at: processedAt,
                property_search_alerts_cron_last_result: JSON.stringify(summary).slice(0, 2000),
            }),
        ])

        return NextResponse.json({
            success: true,
            result: summary,
            properties: results,
        })
    } catch (error) {
        await Promise.all([
            markAgentFailed(supabase, AGENT_PREFIX, error).catch(() => {}),
            saveCronState(supabase, {
                property_search_alerts_cron_last_reason: 'error',
                property_search_alerts_cron_last_error: String(error instanceof Error ? error.message : error).slice(0, 500),
                property_search_alerts_cron_last_error_at: new Date().toISOString(),
            }),
        ])

        console.error('[Property Search Alerts Cron] GET error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
