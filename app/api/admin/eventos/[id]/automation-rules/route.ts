import { NextRequest, NextResponse } from 'next/server'
import { requireAdminContext } from '@/lib/events/admin-auth'
import { cleanString } from '@/lib/events/utils'
import { sanitizeEventAutomationMetadata } from '@/lib/events/automation-metadata'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await requireAdminContext()
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    try {
        const { id } = await params
        const body = await request.json()
        const name = cleanString(body.name, 140)
        const messageTemplate = cleanString(body.message_template, 3000)
        const triggerType = ['immediate', 'before_event', 'at_event_time', 'after_event', 'fixed_datetime'].includes(body.trigger_type)
            ? body.trigger_type
            : 'immediate'
        const segment = ['all', 'autonomos', 'imobiliarias', 'creci_pending', 'creci_verified'].includes(body.segment)
            ? body.segment
            : 'all'
        const fixedDatetime = body.fixed_datetime && !Number.isNaN(new Date(body.fixed_datetime).getTime())
            ? new Date(body.fixed_datetime).toISOString()
            : null

        if (!name) return NextResponse.json({ error: 'Informe o nome da automacao.' }, { status: 400 })
        if (!messageTemplate) return NextResponse.json({ error: 'Informe a mensagem da automacao.' }, { status: 400 })

        const { data, error } = await ctx.admin
            .from('event_automation_rules')
            .insert({
                event_id: id,
                name,
                trigger_type: triggerType,
                offset_minutes: Math.max(0, Math.floor(Number(body.offset_minutes || 0))),
                fixed_datetime: fixedDatetime,
                segment,
                message_template: messageTemplate,
                is_active: body.is_active !== false,
                metadata: sanitizeEventAutomationMetadata(body.metadata),
            })
            .select('*')
            .single()

        if (error) throw error

        await ctx.admin.from('event_agent_logs').insert({
            event_id: id,
            rule_id: data.id,
            action: 'automation_rule_created',
            message: `Automacao "${data.name}" criada.`,
            metadata: { interaction_type: data.metadata?.interaction_type || 'none' },
        })

        return NextResponse.json({ success: true, rule: data })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erro ao criar automacao.' }, { status: 500 })
    }
}
