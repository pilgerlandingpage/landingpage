import { NextRequest, NextResponse } from 'next/server'
import { markAgentCompleted, markAgentFailed, markAgentStarted } from '@/lib/admin/app-config'
import { getOptionalAdminActorContext } from '@/lib/events/admin-auth'
import { processLeadExecutiveBriefs } from '@/lib/leads/lead-executive-briefs'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function numberParam(value: unknown, fallback: number, max: number) {
    const number = Number(value)
    if (!Number.isFinite(number) || number <= 0) return fallback
    return Math.min(Math.round(number), max)
}

function booleanParam(value: unknown, fallback = false) {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') return ['1', 'true', 'yes', 'sim'].includes(value.trim().toLowerCase())
    if (typeof value === 'number') return value === 1
    return fallback
}

export async function GET() {
    return NextResponse.json({
        success: true,
        usage: {
            method: 'POST',
            body: {
                limit: 'opcional: quantidade de leads recentes para resumir',
                source: 'opcional: origem do processamento',
                ai_narrative: 'opcional: true para gerar narrativa com IA quando houver provedor configurado',
                ai_limit: 'opcional: limite de narrativas IA por execucao',
            },
        },
    })
}

export async function POST(request: NextRequest) {
    const supabase = createAdminClient()

    try {
        const body = await request.json().catch(() => ({}))
        const actor = await getOptionalAdminActorContext()
        const limit = numberParam(body?.limit, 300, 1000)
        const source = typeof body?.source === 'string' && body.source.trim()
            ? body.source.trim()
            : 'admin_manual'
        const aiNarrative = booleanParam(body?.ai_narrative, false)
        const aiLimit = numberParam(body?.ai_limit, 40, 250)

        await markAgentStarted(supabase, 'lead_executive_briefs')

        const result = await processLeadExecutiveBriefs(supabase, {
            limit,
            source,
            actor,
            aiNarrative,
            aiLimit,
        })

        await markAgentCompleted(supabase, 'lead_executive_briefs', result)

        return NextResponse.json({
            success: true,
            result,
        })
    } catch (error) {
        await markAgentFailed(supabase, 'lead_executive_briefs', error).catch(() => {})
        console.error('[Lead Executive Briefs Process] POST error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
