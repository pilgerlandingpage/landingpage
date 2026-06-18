import { NextRequest, NextResponse } from 'next/server'
import { markAgentCompleted, markAgentFailed, markAgentStarted } from '@/lib/admin/app-config'
import { processCrmActionRecommendations } from '@/lib/leads/crm-action-recommendations'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function numberParam(value: unknown, fallback: number, max: number) {
    const number = Number(value)
    if (!Number.isFinite(number) || number <= 0) return fallback
    return Math.min(Math.round(number), max)
}

export async function GET() {
    return NextResponse.json({
        success: true,
        usage: {
            method: 'POST',
            body: {
                limit: 'opcional: quantidade de leads recentes para analisar',
                source: 'opcional: origem do processamento',
            },
        },
    })
}

export async function POST(request: NextRequest) {
    const supabase = createAdminClient()

    try {
        const body = await request.json().catch(() => ({}))
        const limit = numberParam(body?.limit, 300, 1000)
        const source = typeof body?.source === 'string' && body.source.trim()
            ? body.source.trim()
            : 'admin_manual'

        await markAgentStarted(supabase, 'crm_action_recommendations')

        const result = await processCrmActionRecommendations(supabase, {
            limit,
            source,
        })

        await markAgentCompleted(supabase, 'crm_action_recommendations', result)

        return NextResponse.json({
            success: true,
            result,
        })
    } catch (error) {
        await markAgentFailed(supabase, 'crm_action_recommendations', error).catch(() => {})
        console.error('[CRM Action Recommendations] POST error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
