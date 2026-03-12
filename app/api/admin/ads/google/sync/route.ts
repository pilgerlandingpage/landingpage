import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// We will fetch Google Ads directly here or using google.ts
export async function POST() {
    try {
        const supabase = await createClient()

        // 1. Get credentials from app_config
        const { data: configRows } = await supabase.from('app_config').select('key, value').in('key', [
            'google_ads_developer_token', 'google_ads_client_id', 'google_ads_client_secret',
            'google_ads_refresh_token', 'google_ads_manager_id', 'google_ads_customer_id'
        ])
        
        const cm: Record<string, string> = {}
        ;(configRows || []).forEach(r => { cm[r.key] = r.value })

        const clientId = cm['google_ads_client_id']?.trim()
        const clientSecret = cm['google_ads_client_secret']?.trim()
        const refreshToken = cm['google_ads_refresh_token']?.trim()
        const developerToken = cm['google_ads_developer_token']?.trim()
        const managerId = (cm['google_ads_manager_id'] || '').replace(/-/g, '').trim()
        const customerId = (cm['google_ads_customer_id'] || '').replace(/-/g, '').trim()

        if (!clientId || !clientSecret || !refreshToken || !developerToken || !customerId) {
            return NextResponse.json({ success: false, error: 'Credenciais do Google Ads incompletas' }, { status: 400 })
        }

        // 2. Get Access Token
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' })
        })
        const tokenData = await tokenRes.json()
        if (tokenData.error) throw new Error('Falha no OAuth Google Ads: ' + tokenData.error)
        const accessToken = tokenData.access_token

        // 3. Fetch Campaigns from Google Ads API (v20)
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

        const res = await fetch(`https://googleads.googleapis.com/v20/customers/${customerId}/googleAds:searchStream`, {
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
            throw new Error('Falha ao buscar campanhas na API do Google Ads')
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

            // Update latest_metrics directly on the campaign record to match the page expectations
            await supabase
                .from('ad_campaigns')
                .update({
                    latest_metrics: {
                        impressions,
                        clicks,
                        spend: costUsd,
                        conversions,
                        ctr,
                        cost_per_lead: cpa
                    }
                })
                .eq('id', dbCampId)

            syncedCount++
        }

        return NextResponse.json({ 
            success: true, 
            message: `${syncedCount} campanhas do Google Ads sincronizadas com sucesso.`,
            synced: syncedCount 
        })

    } catch (error: any) {
        console.error('API Error (Sync Google Ads):', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Erro interno ao sincronizar Google Ads' },
            { status: 500 }
        )
    }
}
