import { NextRequest, NextResponse } from 'next/server'
import { requireAdminContext } from '@/lib/events/admin-auth'
import { cleanString, sanitizeCandidateAutomationMetadata } from '@/lib/broker-candidates/utils'

export const dynamic = 'force-dynamic'

const triggerTypes = new Set(['immediate', 'after_signup', 'status_changed', 'high_potential', 'return_visit', 'fixed_datetime', 'manual'])
const segments = new Set(['all', 'high_potential', 'medium_potential', 'low_potential', 'creci_informed', 'creci_missing', 'returning_visitors', 'new', 'in_review', 'potential', 'approved', 'rejected', 'contacted'])

export async function POST(request: NextRequest) {
    const ctx = await requireAdminContext()
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    try {
        const body = await request.json()
        const name = cleanString(body.name, 140)
        const messageTemplate = cleanString(body.message_template, 3000)
        const triggerType = triggerTypes.has(String(body.trigger_type)) ? String(body.trigger_type) : 'immediate'
        const segment = segments.has(String(body.segment)) ? String(body.segment) : 'all'
        const fixedDatetime = body.fixed_datetime && !Number.isNaN(new Date(body.fixed_datetime).getTime())
            ? new Date(body.fixed_datetime).toISOString()
            : null

        if (!name) return NextResponse.json({ error: 'Informe o nome da automacao.' }, { status: 400 })
        if (!messageTemplate) return NextResponse.json({ error: 'Informe a mensagem da automacao.' }, { status: 400 })

        const { data, error } = await ctx.admin
            .from('broker_candidate_automation_rules')
            .insert({
                name,
                trigger_type: triggerType,
                offset_minutes: Math.max(0, Math.floor(Number(body.offset_minutes || 0))),
                fixed_datetime: fixedDatetime,
                segment,
                message_template: messageTemplate,
                is_active: body.is_active !== false,
                metadata: sanitizeCandidateAutomationMetadata(body.metadata),
            })
            .select('*')
            .single()

        if (error) throw error

        await ctx.admin.from('broker_candidate_agent_logs').insert({
            rule_id: data.id,
            action: 'automation_rule_created',
            message: `Automacao "${data.name}" criada.`,
            metadata: { interaction_type: data.metadata?.interaction_type || 'none' },
        })

        return NextResponse.json({ success: true, rule: data }, { status: 201 })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erro ao criar automacao.' }, { status: 500 })
    }
}
