import { NextRequest, NextResponse } from 'next/server'
import { applyCrmActionRecommendation } from '@/lib/leads/crm-action-recommendations'
import { createAdminClient } from '@/lib/supabase/server'
import { getOptionalAdminActorContext } from '@/lib/events/admin-auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        const body = await request.json().catch(() => ({}))
        const actor = await getOptionalAdminActorContext()

        const result = await applyCrmActionRecommendation(supabase, {
            lead_id: body?.lead_id,
            recommendation_id: body?.recommendation_id,
            followup_key: body?.followup_key,
            target_broker_id: body?.target_broker_id,
            source: 'crm_manual_apply',
            actor,
        })

        return NextResponse.json({
            success: true,
            result,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const status = /required|not assignable/i.test(message)
            ? 400
            : /not found/i.test(message)
                ? 404
                : 500

        console.error('[CRM Action Recommendations Apply] POST error:', error)
        return NextResponse.json({ success: false, error: message }, { status })
    }
}
