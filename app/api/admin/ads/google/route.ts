import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import * as googleAds from '@/lib/ads/google'
import type { GoogleDatePreset } from '@/lib/ads/google'

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

        return NextResponse.json(enriched)
    } catch (error: any) {
        console.error('Error fetching Google ads data:', error)
        return NextResponse.json(
            { error: error?.message || 'Failed to fetch ads data' },
            { status: 500 }
        )
    }
}
