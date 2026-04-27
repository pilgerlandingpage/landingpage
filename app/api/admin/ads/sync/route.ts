import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import * as metaAds from '@/lib/ads/meta'
import { syncPaidAdsSpendToFinance } from '@/lib/finance/ads-spend-sync'

export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient()

        let syncedCount = 0
        const errors: string[] = []

        // 1. Fetch all campaigns (active and paused) from Meta
        const externalCampaigns = await metaAds.getAllCampaigns()

        for (const extCamp of externalCampaigns) {
            // 2. Check if this campaign already exists in our database
            const { data: existingCamp, error: searchError } = await supabase
                .from('ad_campaigns')
                .select('id, external_campaign_id')
                .eq('platform', 'meta')
                .eq('external_campaign_id', extCamp.id)
                .maybeSingle()

            let internalCampaignId = existingCamp?.id

            // 3. If it doesn't exist, import it into the Pilger database
            if (!existingCamp && !searchError) {
                const totalBudget = extCamp.lifetime_budget
                    ? Number(extCamp.lifetime_budget) / 100
                    : (extCamp.daily_budget ? Number(extCamp.daily_budget) * 30 / 100 : 0)

                const { data: newCamp, error: insertError } = await supabase
                    .from('ad_campaigns')
                    .insert({
                        name: extCamp.name,
                        platform: 'meta',
                        status: extCamp.status === 'ACTIVE' ? 'active' : 'paused',
                        total_budget: totalBudget,
                        duration_days: 30, // Default duration since lifetime might not be set
                        external_campaign_id: extCamp.id,
                        ai_auto_manage: false, // Imported campaigns shouldn't be auto-managed by default
                        start_date: extCamp.start_time?.split('T')[0] || new Date().toISOString().split('T')[0],
                    })
                    .select('id')
                    .single()

                if (insertError) {
                    console.error(`Erro ao importar campanha ${extCamp.id}:`, insertError)
                    errors.push(`Campanha Meta ${extCamp.name}: Erro ao importar para o banco`)
                    continue
                }

                internalCampaignId = newCamp.id
            }

            try {
                // Ao importar ou sincronizar, tentamos pegar o total vitalício (maximum)
                // para que as campanhas pausadas ou antigas mostrem os resultados totais
                const insights = await metaAds.getInsights(extCamp.id, 'maximum')

                if (insights && internalCampaignId) {
                    const snapshotData = metaAds.parseInsightsToSnapshot(internalCampaignId, insights)

                    const { error: snapInsertError } = await supabase
                        .from('ad_metrics_snapshots')
                        .insert(snapshotData)

                    if (snapInsertError) {
                        console.error(`Erro ao salvar snapshot para campanha ${internalCampaignId}:`, snapInsertError)
                        errors.push(`Campanha ${extCamp.name}: Erro ao salvar histórico`)
                    } else {
                        syncedCount++
                    }
                } else {
                    errors.push(`Campanha ${extCamp.name}: Nenhum fluxo de dados recente recebido da Meta`)
                }
            } catch (err: any) {
                console.error(`Erro ao sincronizar campanha ${extCamp.id}:`, err)
                errors.push(`Campanha ${extCamp.name}: ${err.message}`)
            }
        }

        // Also fetch any existing internal campaigns that we might have missed (e.g., drafted or paused but still collecting data)
        const { data: internalOnlyCampaigns, error: intError } = await supabase
            .from('ad_campaigns')
            .select('*')
            .eq('platform', 'meta')
            .not('external_campaign_id', 'is', null)

        if (!intError && internalOnlyCampaigns) {
            for (const campaign of internalOnlyCampaigns) {
                // Check if this campaign was already processed in the external loop
                if (externalCampaigns.some(ext => ext.id === campaign.external_campaign_id)) continue;

                try {
                    const insights = await metaAds.getInsights(campaign.external_campaign_id, 'maximum')
                    if (insights) {
                        const snapshotData = metaAds.parseInsightsToSnapshot(campaign.id, insights)
                        const { error: snapInsertError } = await supabase.from('ad_metrics_snapshots').insert(snapshotData)
                        if (!snapInsertError) syncedCount++
                    }
                } catch (err) {
                    console.error(`Erro ao sincronizar campanha interna ${campaign.id}:`, err)
                }
            }
        }

        if (externalCampaigns.length === 0 && (!internalOnlyCampaigns || internalOnlyCampaigns.length === 0)) {
            return NextResponse.json({ success: true, message: 'Nenhuma campanha encontrada na Meta para sincronizar.', syncedCount: 0 })
        }

        const financeSync = await syncPaidAdsSpendToFinance(supabase)

        return NextResponse.json({
            success: true,
            message: `Sincronização concluída. ${syncedCount} campanhas atualizadas.`,
            syncedCount,
            financeSync,
            errors: errors.length > 0 ? errors : undefined
        })

    } catch (err: any) {
        console.error('Error syncing ads:', err)
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}
