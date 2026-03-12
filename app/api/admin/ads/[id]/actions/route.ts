import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import * as metaAds from '@/lib/ads/meta'
import * as googleAds from '@/lib/ads/google'

// GET — fetch all AI alerts and action logs for a campaign
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const supabase = createAdminClient()

        const [alertsRes, logsRes] = await Promise.all([
            supabase
                .from('ai_campaign_alerts')
                .select('*')
                .eq('campaign_id', id)
                .order('created_at', { ascending: false }),
            supabase
                .from('ai_action_log')
                .select('*')
                .eq('campaign_id', id)
                .order('executed_at', { ascending: false }),
        ])

        return NextResponse.json({
            alerts: alertsRes.data || [],
            action_log: logsRes.data || [],
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// POST — Execute a manual action (pause, activate, change budget)
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { action, new_budget } = await request.json()
        const supabase = createAdminClient()

        // Fetch campaign
        const { data: campaign, error: campErr } = await supabase
            .from('ad_campaigns')
            .select('*')
            .eq('id', id)
            .single()

        if (campErr || !campaign) {
            return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
        }

        let resultMessage = ''

        if (action === 'pause') {
            // Pause campaign on the platform
            if (campaign.external_campaign_id) {
                if (campaign.platform === 'meta') {
                    await metaAds.updateCampaignStatus(campaign.external_campaign_id, 'PAUSED')
                } else {
                    await googleAds.updateCampaignStatus(campaign.external_campaign_id, 'PAUSED')
                }
            }
            await supabase.from('ad_campaigns').update({ status: 'paused' }).eq('id', id)
            resultMessage = `Campanha "${campaign.name}" pausada com sucesso.`

        } else if (action === 'activate') {
            if (campaign.external_campaign_id) {
                if (campaign.platform === 'meta') {
                    await metaAds.updateCampaignStatus(campaign.external_campaign_id, 'ACTIVE')
                } else {
                    await googleAds.updateCampaignStatus(campaign.external_campaign_id, 'ENABLED')
                }
            }
            await supabase.from('ad_campaigns').update({ status: 'active' }).eq('id', id)
            resultMessage = `Campanha "${campaign.name}" reativada com sucesso.`

        } else if (action === 'update_budget' && new_budget) {
            if (campaign.platform === 'meta' && campaign.external_adset_id) {
                await metaAds.updateDailyBudget(campaign.external_adset_id, Math.round(new_budget * 100))
            }
            await supabase.from('ad_campaigns').update({
                daily_budget: new_budget,
                updated_at: new Date().toISOString(),
            }).eq('id', id)
            resultMessage = `Orçamento diário atualizado para R$ ${Number(new_budget).toFixed(2)}.`

        } else {
            return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
        }

        // Log the manual action
        await supabase.from('ai_action_log').insert({
            campaign_id: id,
            action: `MANUAL_${action.toUpperCase()}`,
            reason: `Ação manual executada pelo admin`,
            new_value: new_budget ? `R$ ${Number(new_budget).toFixed(2)}` : undefined,
        })

        return NextResponse.json({ success: true, message: resultMessage })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
