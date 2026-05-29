import { NextRequest, NextResponse } from 'next/server'
import { requireAdminContext } from '@/lib/events/admin-auth'
import {
    approveEditorialCampaign,
    cancelEditorialCampaign,
    enqueueBehavioralPropertyRecommendations,
    enqueueLatestEditorialCampaigns,
    enqueuePublishedEditorialArchive,
    listEditorialCampaigns,
    pauseEditorialCampaign,
    processDueEditorialDistribution,
} from '@/lib/editorial-distribution'

export const dynamic = 'force-dynamic'

export async function GET() {
    const ctx = await requireAdminContext()
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    try {
        const result = await listEditorialCampaigns(ctx.admin)
        return NextResponse.json({ success: true, ...result })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || 'Erro ao carregar distribuicao editorial.' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const ctx = await requireAdminContext()
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    try {
        const body = await request.json().catch(() => ({}))
        const action = String(body?.action || '').trim()
        const campaignId = String(body?.campaign_id || body?.campaignId || '').trim()

        if (action === 'prepare_latest') {
            const results = await enqueueLatestEditorialCampaigns(ctx.admin, request.nextUrl.origin)
            const current = await listEditorialCampaigns(ctx.admin)
            return NextResponse.json({ success: true, results, ...current })
        }

        if (action === 'prepare_archive') {
            const result = await enqueuePublishedEditorialArchive(ctx.admin, request.nextUrl.origin)
            const current = await listEditorialCampaigns(ctx.admin)
            return NextResponse.json({ success: true, result, ...current })
        }

        if (action === 'prepare_recommendations') {
            const result = await enqueueBehavioralPropertyRecommendations(ctx.admin, request.nextUrl.origin, {
                force: body?.force === true,
                limit: Number(body?.limit || 25),
            })
            const current = await listEditorialCampaigns(ctx.admin)
            return NextResponse.json({ success: true, result, ...current })
        }

        if (action === 'process_due') {
            const result = await processDueEditorialDistribution(ctx.admin, Number(body?.limit || 20))
            const current = await listEditorialCampaigns(ctx.admin)
            return NextResponse.json({ success: true, result, ...current })
        }

        if (!campaignId) {
            return NextResponse.json({ success: false, error: 'Informe a campanha.' }, { status: 400 })
        }

        if (action === 'approve_campaign') {
            const result = await approveEditorialCampaign(ctx.admin, campaignId)
            const current = await listEditorialCampaigns(ctx.admin)
            return NextResponse.json({ success: true, result, ...current })
        }

        if (action === 'pause_campaign') {
            const result = await pauseEditorialCampaign(ctx.admin, campaignId)
            const current = await listEditorialCampaigns(ctx.admin)
            return NextResponse.json({ success: true, result, ...current })
        }

        if (action === 'cancel_campaign') {
            const result = await cancelEditorialCampaign(ctx.admin, campaignId)
            const current = await listEditorialCampaigns(ctx.admin)
            return NextResponse.json({ success: true, result, ...current })
        }

        return NextResponse.json({ success: false, error: 'Acao invalida.' }, { status: 400 })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || 'Erro ao executar acao da distribuicao editorial.' }, { status: 500 })
    }
}
