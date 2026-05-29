import { NextRequest, NextResponse } from 'next/server'
import { requireAdminContext } from '@/lib/events/admin-auth'
import { cleanString } from '@/lib/events/utils'
import { sanitizeEventAutomationMetadata } from '@/lib/events/automation-metadata'

export const dynamic = 'force-dynamic'

function buildRuleUpdates(body: any) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if ('name' in body) {
        const name = cleanString(body.name, 140)
        if (!name) throw new Error('Informe o nome da automacao.')
        updates.name = name
    }
    if ('message_template' in body) {
        const message = cleanString(body.message_template, 3000)
        if (!message) throw new Error('Informe a mensagem da automacao.')
        updates.message_template = message
    }
    if ('trigger_type' in body && ['immediate', 'before_event', 'at_event_time', 'after_event', 'fixed_datetime'].includes(body.trigger_type)) {
        updates.trigger_type = body.trigger_type
    }
    if ('segment' in body && ['all', 'autonomos', 'imobiliarias', 'creci_pending', 'creci_verified'].includes(body.segment)) {
        updates.segment = body.segment
    }
    if ('offset_minutes' in body) updates.offset_minutes = Math.max(0, Math.floor(Number(body.offset_minutes || 0)))
    if ('fixed_datetime' in body) {
        updates.fixed_datetime = body.fixed_datetime && !Number.isNaN(new Date(body.fixed_datetime).getTime())
            ? new Date(body.fixed_datetime).toISOString()
            : null
    }
    if ('is_active' in body) updates.is_active = body.is_active === true
    if ('metadata' in body) updates.metadata = sanitizeEventAutomationMetadata(body.metadata)

    return updates
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ ruleId: string }> }) {
    const ctx = await requireAdminContext()
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    try {
        const { ruleId } = await params
        const body = await request.json()
        const updates = buildRuleUpdates(body)

        const { data, error } = await ctx.admin
            .from('event_automation_rules')
            .update(updates)
            .eq('id', ruleId)
            .select('*')
            .single()

        if (error) throw error

        await ctx.admin.from('event_agent_logs').insert({
            event_id: data.event_id,
            rule_id: data.id,
            action: 'automation_rule_updated',
            message: `Automacao "${data.name}" atualizada.`,
            metadata: { fields: Object.keys(updates), interaction_type: data.metadata?.interaction_type || 'none' },
        })

        return NextResponse.json({ success: true, rule: data })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erro ao atualizar automacao.' }, { status: 500 })
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ ruleId: string }> }) {
    const ctx = await requireAdminContext()
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    try {
        const { ruleId } = await params
        const { data: rule } = await ctx.admin
            .from('event_automation_rules')
            .select('event_id, name')
            .eq('id', ruleId)
            .maybeSingle()

        const { error } = await ctx.admin
            .from('event_automation_rules')
            .delete()
            .eq('id', ruleId)

        if (error) throw error

        if (rule?.event_id) {
            await ctx.admin.from('event_agent_logs').insert({
                event_id: rule.event_id,
                action: 'automation_rule_deleted',
                message: `Automacao "${rule.name}" removida.`,
            })
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erro ao remover automacao.' }, { status: 500 })
    }
}
