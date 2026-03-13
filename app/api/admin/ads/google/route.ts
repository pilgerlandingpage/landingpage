import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import * as googleAds from '@/lib/ads/google'
import type { GoogleDatePreset } from '@/lib/ads/google'
import { startOfDay, endOfDay, subDays } from 'date-fns'

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

        // Try to fetch live metrics from Google Ads API
        let liveMetricsMap: Record<string, { campaign: any; metrics: any }> = {}
        try {
            liveMetricsMap = await googleAds.getAllCampaignsWithMetrics(datePreset)
        } catch (err) {
            console.error('Erro ao buscar métricas ao vivo do Google Ads:', err)
        }

        // Enrich campaigns with live metrics
        const enriched = (campaigns || []).map((camp: any) => {
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
            supabase.from('leads').select('*', { count: 'exact', head: true })
                .eq('detected_source', 'Google')
                .gte('created_at', sinceInternal)
                .lte('created_at', untilInternal),
            supabase.from('leads').select('name, phone, created_at, funnel_stage')
                .eq('detected_source', 'Google')
                .order('created_at', { ascending: false })
                .limit(10)
        ])

        return NextResponse.json({
            campaigns: enriched,
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
