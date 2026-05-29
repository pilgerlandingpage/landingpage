import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import * as googleAds from '@/lib/ads/google'
import type { GoogleDatePreset } from '@/lib/ads/google'
import { sendGooglePaymentIssueAlert } from '@/lib/ads/whatsapp-alerts'

function startOfDay(d: Date) { const res = new Date(d); res.setHours(0,0,0,0); return res; }
function endOfDay(d: Date) { const res = new Date(d); res.setHours(23,59,59,999); return res; }
function subDays(d: Date, days: number) { const res = new Date(d); res.setDate(res.getDate() - days); return res; }

export async function GET(request: Request) {
    try {
        const supabase = createAdminClient()
        const { searchParams } = new URL(request.url)
        const alerts = searchParams.get('alerts') === 'true'

        // Alerts query
        if (alerts) {
            const { data } = await supabase
                .from('ai_campaign_alerts')
                .select('*, ad_campaigns!inner(name, platform)')
                .eq('ad_campaigns.platform', 'google')
                .order('created_at', { ascending: false })
                .limit(20)
                
            const formatted = (data || []).map((a: any) => ({
                ...a,
                campaign_name: a.ad_campaigns?.name || 'N/A',
                ad_campaigns: undefined
            }))
            return NextResponse.json(formatted)
        }

        // Campaigns query — fetch from DB then enrich with LIVE Google Ads metrics
        const datePreset = (searchParams.get('date_preset') || 'maximum') as GoogleDatePreset
        const startDate = searchParams.get('start_date')
        const endDate = searchParams.get('end_date')

        const { data: campaigns, error } = await supabase
            .from('ad_campaigns')
            .select('*, properties(title)')
            .eq('platform', 'google')
            .order('created_at', { ascending: false })

        if (error) throw error
        let campaignRows = campaigns || []

        // Try to fetch live metrics from Google Ads API
        let liveMetricsMap: Record<string, { campaign: any; metrics: any }> = {}
        let accountHealth: Awaited<ReturnType<typeof googleAds.getGoogleAccountHealth>> | null = null
        try {
            const [metricsRes, accountHealthRes] = await Promise.allSettled([
                googleAds.getAllCampaignsWithMetrics(
                    datePreset,
                    (datePreset as string) === 'custom' && startDate && endDate
                        ? { startDate, endDate }
                        : undefined
                ),
                googleAds.getGoogleAccountHealth(),
            ])
            if (metricsRes.status === 'fulfilled') liveMetricsMap = metricsRes.value
            if (accountHealthRes.status === 'fulfilled') accountHealth = accountHealthRes.value
        } catch (err) {
            console.error('Erro ao buscar métricas ao vivo do Google Ads:', err)
        }

        const existingExternalIds = new Set(campaignRows.map((camp: any) => String(camp.external_campaign_id || '')).filter(Boolean))
        const missingLiveCampaigns = Object.values(liveMetricsMap)
            .filter((row: any) => row?.campaign?.id && Number(row?.metrics?.spend || 0) > 0)
            .filter((row: any) => !existingExternalIds.has(String(row.campaign.id)))

        if (missingLiveCampaigns.length > 0) {
            const statusMap: Record<string, string> = { ENABLED: 'active', PAUSED: 'paused' }
            const inserts = missingLiveCampaigns.map((row: any) => ({
                name: row.campaign.name || `Google Ads ${row.campaign.id}`,
                platform: 'google',
                status: statusMap[row.campaign.status] || 'active',
                total_budget: 0,
                duration_days: 30,
                external_campaign_id: String(row.campaign.id),
                ai_auto_manage: false,
                start_date: new Date().toISOString().split('T')[0],
            }))

            const { data: insertedCampaigns, error: insertMissingError } = await supabase
                .from('ad_campaigns')
                .insert(inserts)
                .select('*')

            if (insertMissingError) {
                console.error('Erro ao importar campanhas Google com gasto ao vivo:', insertMissingError)
            } else {
                campaignRows = [...(insertedCampaigns || []), ...campaignRows]
            }
        }

        // Enrich campaigns with live metrics
        const enriched = campaignRows.map((camp: any) => {
            // Match by external_campaign_id
            const liveData = camp.external_campaign_id
                ? liveMetricsMap[camp.external_campaign_id]
                : null

            if (liveData) {
                return { ...camp, latest_metrics: liveData.metrics }
            }

            // No live data for this period
            return { ...camp, latest_metrics: null }
        })

        if (accountHealth?.is_payment_issue) {
            try {
                await sendGooglePaymentIssueAlert(supabase, accountHealth, new URL(request.url).origin)
            } catch (alertError) {
                console.error('Erro ao avisar envolvidos sobre problema de pagamento Google Ads:', alertError)
            }
        }

        // Fetch internal lead counts and recent leads
        const spNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }))
        let sinceInternal: string
        let untilInternal: string = spNow.toISOString()

        if (datePreset === 'today') {
            sinceInternal = startOfDay(spNow).toISOString()
        } else if (datePreset === 'yesterday') {
            const yesterday = subDays(spNow, 1)
            sinceInternal = startOfDay(yesterday).toISOString()
            untilInternal = endOfDay(yesterday).toISOString()
        } else if (datePreset === 'last_7d') {
            sinceInternal = startOfDay(subDays(spNow, 7)).toISOString()
        } else if (datePreset === 'last_30d') {
            sinceInternal = startOfDay(subDays(spNow, 30)).toISOString()
        } else if ((datePreset as string) === 'custom' && startDate && endDate) {
            sinceInternal = new Date(startDate).toISOString()
            untilInternal = new Date(endDate).toISOString()
        } else {
            sinceInternal = startOfDay(subDays(spNow, 90)).toISOString()
        }

        const [internalLeadsRes, recentLeadsRes] = await Promise.all([
            supabase.from('leads').select('id, visitors!inner(detected_source)', { count: 'exact', head: true })
                .eq('visitors.detected_source', 'Google Ads')
                .gte('created_at', sinceInternal)
                .lte('created_at', untilInternal),
            supabase.from('leads').select('name, phone, created_at, funnel_stage, visitors!inner(detected_source)')
                .eq('visitors.detected_source', 'Google Ads')
                .order('created_at', { ascending: false })
                .limit(10)
        ])

        return NextResponse.json({
            campaigns: enriched,
            accountHealth,
            internalStats: {
                totalLeads: internalLeadsRes.count || 0,
                recentLeads: recentLeadsRes.data || []
            }
        })
    } catch (error: any) {
        console.error('Error fetching Google ads data:', error)
        return NextResponse.json(
            { error: error?.message || 'Failed to fetch ads data' },
            { status: 500 }
        )
    }
}
