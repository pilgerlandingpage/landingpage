import { NextRequest, NextResponse } from 'next/server'
import { markAgentCompleted, markAgentFailed, markAgentStarted } from '@/lib/admin/app-config'
import { createAdminClient } from '@/lib/supabase/server'
import {
    processPropertySearchAlerts,
    SEARCH_ALERT_PROPERTY_MATCH_FIELDS,
    type ProcessSearchAlertMatchesResult,
} from '@/lib/properties/search-alert-matcher'

const AGENT_PREFIX = 'property_search_alerts'

function numberParam(value: unknown, fallback: number, max: number) {
    const number = Number(value)
    if (!Number.isFinite(number) || number <= 0) return fallback
    return Math.min(Math.round(number), max)
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

async function updateProcessedAt(supabase: ReturnType<typeof createAdminClient>, processedAt: string) {
    await supabase
        .from('property_search_alerts')
        .update({ last_processed_at: processedAt })
        .eq('status', 'active')
}

export async function GET() {
    try {
        const supabase = createAdminClient()
        const [{ count: activeAlerts }, { count: matchCount }] = await Promise.all([
            supabase
                .from('property_search_alerts')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'active'),
            supabase
                .from('property_search_alert_matches')
                .select('id', { count: 'exact', head: true }),
        ])

        return NextResponse.json({
            success: true,
            active_alerts: activeAlerts || 0,
            total_matches: matchCount || 0,
            usage: {
                method: 'POST',
                body: {
                    property_id: 'opcional: uuid do imóvel ativo',
                    limit: 'opcional: quantidade de imóveis recentes quando property_id não for enviado',
                },
            },
        })
    } catch (error) {
        console.error('[Admin Search Alerts Process] GET error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const supabase = createAdminClient()

    try {
        const body = await request.json().catch(() => ({}))
        const propertyId = typeof body?.property_id === 'string' ? body.property_id.trim() : ''
        const limit = numberParam(body?.limit, 25, 100)

        await markAgentStarted(supabase, AGENT_PREFIX)

        if (propertyId) {
            const { data: property, error } = await supabase
                .from('properties')
                .select(SEARCH_ALERT_PROPERTY_MATCH_FIELDS)
                .eq('id', propertyId)
                .maybeSingle()

            if (error) throw error
            if (!property?.id) {
                await markAgentFailed(supabase, AGENT_PREFIX, 'property_not_found').catch(() => {})
                return NextResponse.json({ success: false, error: 'Imóvel não encontrado.' }, { status: 404 })
            }

            const result = await processPropertySearchAlerts(supabase, property, {
                source: 'admin_manual_property',
            })
            const processedAt = new Date().toISOString()
            const totals = summarizeResults([result])
            const summary = {
                source: 'admin_manual_property',
                force: true,
                limit: 1,
                updated_since: null,
                processed_at: processedAt,
                processed_properties: result.processed ? 1 : 0,
                ...totals,
            }

            await Promise.all([
                updateProcessedAt(supabase, processedAt),
                markAgentCompleted(supabase, AGENT_PREFIX, summary),
            ])

            return NextResponse.json({ success: true, result, summary })
        }

        const { data: properties, error } = await supabase
            .from('properties')
            .select(SEARCH_ALERT_PROPERTY_MATCH_FIELDS)
            .eq('status', 'active')
            .order('updated_at', { ascending: false })
            .limit(limit)

        if (error) throw error

        const results: ProcessSearchAlertMatchesResult[] = []
        for (const property of properties || []) {
            try {
                results.push(await processPropertySearchAlerts(supabase, property, {
                    source: 'admin_manual_batch',
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
        const totals = summarizeResults(results)
        const summary = {
            source: 'admin_manual_batch',
            force: true,
            limit,
            updated_since: null,
            processed_at: processedAt,
            processed_properties: results.length,
            ...totals,
        }

        await Promise.all([
            updateProcessedAt(supabase, processedAt),
            markAgentCompleted(supabase, AGENT_PREFIX, summary),
        ])

        return NextResponse.json({
            success: true,
            processed_properties: results.length,
            summary,
            results,
        })
    } catch (error) {
        await markAgentFailed(supabase, AGENT_PREFIX, error).catch(() => {})
        console.error('[Admin Search Alerts Process] POST error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
