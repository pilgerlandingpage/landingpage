import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { inngest } from '@/lib/inngest/client'

// POST — Publish a draft campaign to the ads platform
export async function POST(request: NextRequest) {
    try {
        const { campaign_id } = await request.json()
        if (!campaign_id) {
            return NextResponse.json({ error: 'campaign_id obrigatório' }, { status: 400 })
        }

        const supabase = createAdminClient()

        // Verify campaign exists and is in draft/error status
        const { data: campaign, error } = await supabase
            .from('ad_campaigns')
            .select('id, status, name')
            .eq('id', campaign_id)
            .single()

        if (error || !campaign) {
            return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
        }

        if (!['draft', 'error'].includes(campaign.status)) {
            return NextResponse.json(
                { error: `Campanha já está com status "${campaign.status}". Apenas rascunhos podem ser publicados.` },
                { status: 400 }
            )
        }

        // Send Inngest event to trigger the publish worker
        await inngest.send({
            name: 'ads/campaign-created',
            data: { campaign_id },
        })

        return NextResponse.json({
            success: true,
            message: `Campanha "${campaign.name}" enviada para publicação. Acompanhe o status no painel.`,
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
