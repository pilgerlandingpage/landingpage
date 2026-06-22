import { NextResponse } from 'next/server'
import { markAgentCompleted, markAgentFailed, markAgentStarted } from '@/lib/admin/app-config'
import { GOOGLE_ADS_API_VERSION } from '@/lib/ads/google'
import { createAdminClient } from '@/lib/supabase/server'
import { syncPaidAdsSpendToFinance } from '@/lib/finance/ads-spend-sync'

export async function POST() {
    const supabase = createAdminClient()

    try {
        await markAgentStarted(supabase, 'ads_sync')

        // 1. Get credentials from app_config
        const { data: configRows } = await supabase.from('app_config').select('key, value').in('key', [
            'google_ads_developer_token', 'google_ads_client_id', 'google_ads_client_secret',
            'google_ads_refresh_token', 'google_ads_manager_id', 'google_ads_customer_id'
        ])
        
        const cm: Record<string, string> = {}
        ;(configRows || []).forEach((r: any) => { cm[r.key] = r.value })

        const clientId = cm['google_ads_client_id']?.trim()
        const clientSecret = cm['google_ads_client_secret']?.trim()
        const refreshToken = cm['google_ads_refresh_token']?.trim()
        const developerToken = cm['google_ads_developer_token']?.trim()
        const managerId = (cm['google_ads_manager_id'] || '').replace(/-/g, '').trim()
        const customerId = (cm['google_ads_customer_id'] || '').replace(/-/g, '').trim()

        if (!clientId || !clientSecret || !refreshToken || !developerToken || !customerId) {
            throw new Error('Credenciais do Google Ads incompletas')
        }

        // 2. Get Access Token
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' })
        })
        const tokenData = await tokenRes.json()
        if (!tokenRes.ok || tokenData.error) throw new Error('Falha no OAuth Google Ads: ' + (tokenData.error_description || tokenData.error || tokenRes.status))
        const accessToken = tokenData.access_token

        // 3. Fetch Campaigns from Google Ads API
        // We fetch campaigns without restricting by date to ensure we get ALL campaigns
        // (even those with 0 impressions recently). We still get lifetime metrics or zeros.
        const query = `
            SELECT 
                campaign.id, 
                campaign.name, 
                campaign.status, 
                metrics.impressions, 
                metrics.clicks, 
                metrics.cost_micros, 
                metrics.conversions 
            FROM campaign 
            WHERE campaign.status != 'REMOVED'
        `

        const res = await fetch(`https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'developer-token': developerToken,
                'login-customer-id': managerId || customerId,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query })
        })

        if (!res.ok) {
            const errText = await res.text()
            console.error('Google Ads API falhou:', errText)
            throw new Error(`Falha ao buscar campanhas na API do Google Ads: ${errText.slice(0, 500)}`)
        }

        const text = await res.text()
        const data = JSON.parse(text)
        
        // Parse results
        const campaignsFromNetwork = []
        if (data && data.length > 0) {
            for (const chunk of data) {
                if (chunk.results) {
                    for (const row of chunk.results) {
                        if (row.campaign) {
                            campaignsFromNetwork.push({
                                id: row.campaign.id,
                                name: row.campaign.name,
                                status: row.campaign.status, // ENABLED, PAUSED, REMOVED
                                metrics: row.metrics || {}
                            })
                        }
                    }
                }
            }
        }

        let syncedCount = 0

        // 4. Upsert campaigns and metrics in Supabase
        for (const gc of campaignsFromNetwork) {
            const extId = String(gc.id)
            const statusMap: Record<string, string> = { 'ENABLED': 'active', 'PAUSED': 'paused' }
            const status = statusMap[gc.status] || 'draft'

            // Check if campaign already exists
            const { data: existingCamp } = await supabase
                .from('ad_campaigns')
                .select('id')
                .eq('platform', 'google')
                .eq('external_campaign_id', extId)
                .maybeSingle()

            let internalCampaignId = existingCamp?.id

            if (existingCamp) {
                // Update existing campaign
                const { error: updateErr } = await supabase
                    .from('ad_campaigns')
                    .update({
                        name: gc.name,
                        status: status,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingCamp.id)

                if (updateErr) {
                    console.error('Erro ao atualizar campanha:', updateErr)
                    continue
                }
            } else {
                // Insert new campaign with required fields
                const costUsd = parseFloat(gc.metrics.costMicros || '0') / 1_000_000
                const { data: newCamp, error: insertErr } = await supabase
                    .from('ad_campaigns')
                    .insert({
                        external_campaign_id: extId,
                        platform: 'google',
                        name: gc.name,
                        status: status,
                        total_budget: costUsd || 0,
                        duration_days: 30,
                        ai_auto_manage: false,
                        start_date: new Date().toISOString().split('T')[0],
                    })
                    .select('id')
                    .single()

                if (insertErr) {
                    console.error('Erro ao inserir campanha:', insertErr)
                    continue
                }
                internalCampaignId = newCamp.id
            }

            const dbCampId = internalCampaignId
            if (!dbCampId) continue

            // Prepare metrics
            const impressions = parseInt(gc.metrics.impressions || '0', 10)
            const clicks = parseInt(gc.metrics.clicks || '0', 10)
            const costUsd = parseFloat(gc.metrics.costMicros || '0') / 1_000_000 // Convert from micros
            const conversions = parseFloat(gc.metrics.conversions || '0')
            const ctr = impressions > 0 ? (clicks / impressions) : 0
            const cpa = conversions > 0 ? (costUsd / conversions) : null

            const { error: snapshotError } = await supabase
                .from('ad_metrics_snapshots')
                .insert({
                    campaign_id: dbCampId,
                    impressions,
                    clicks,
                    ctr,
                    cpm: impressions > 0 ? (costUsd / impressions) * 1000 : 0,
                    cpc: clicks > 0 ? costUsd / clicks : 0,
                    spend: costUsd,
                    leads_count: Math.round(conversions),
                    cost_per_lead: cpa,
                    conversions: Math.round(conversions),
                })

            if (snapshotError) {
                throw new Error(`Erro ao salvar snapshot Google Ads da campanha ${gc.name}: ${snapshotError.message}`)
            }

            syncedCount++
        }

        const financeSync = await syncPaidAdsSpendToFinance(supabase)

        await markAgentCompleted(supabase, 'ads_sync', {
            source: 'manual_google_sync',
            synced: syncedCount,
            campaigns_found: campaignsFromNetwork.length,
        })

        return NextResponse.json({ 
            success: true, 
            message: `${syncedCount} campanhas do Google Ads sincronizadas com sucesso.`,
            synced: syncedCount,
            financeSync,
        })

    } catch (error: any) {
        await markAgentFailed(supabase, 'ads_sync', error).catch(() => {})
        console.error('API Error (Sync Google Ads):', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Erro interno ao sincronizar Google Ads' },
            { status: 500 }
        )
    }
}
