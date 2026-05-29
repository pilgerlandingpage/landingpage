import { NextRequest, NextResponse } from 'next/server'
import { requireAdminContext } from '@/lib/events/admin-auth'
import { cleanString, sanitizeCandidateAutomationMetadata } from '@/lib/broker-candidates/utils'

export const dynamic = 'force-dynamic'

const triggerTypes = new Set(['immediate', 'after_signup', 'status_changed', 'high_potential', 'return_visit', 'fixed_datetime', 'manual'])
const segments = new Set(['all', 'high_potential', 'medium_potential', 'low_potential', 'creci_informed', 'creci_missing', 'returning_visitors', 'new', 'in_review', 'potential', 'approved', 'rejected', 'contacted'])

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
    if ('trigger_type' in body && triggerTypes.has(String(body.trigger_type))) updates.trigger_type = String(body.trigger_type)
    if ('segment' in body && segments.has(String(body.segment))) updates.segment = String(body.segment)
    if ('offset_minutes' in body) updates.offset_minutes = Math.max(0, Math.floor(Number(body.offset_minutes || 0)))
    if ('fixed_datetime' in body) {
        updates.fixed_datetime = body.fixed_datetime && !Number.isNaN(new Date(body.fixed_datetime).getTime())
            ? new Date(body.fixed_datetime).toISOString()
            : null
    }
    if ('is_active' in body) updates.is_active = body.is_active === true
    if ('metadata' in body) updates.metadata = sanitizeCandidateAutomationMetadata(body.metadata)

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
            .from('broker_candidate_automation_rules')
            .update(updates)
            .eq('id', ruleId)
            .select('*')
            .single()

        if (error) throw error

        await ctx.admin.from('broker_candidate_agent_logs').insert({
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
            .from('broker_candidate_automation_rules')
            .select('name')
            .eq('id', ruleId)
            .maybeSingle()

        const { error } = await ctx.admin
            .from('broker_candidate_automation_rules')
            .delete()
            .eq('id', ruleId)

        if (error) throw error

        await ctx.admin.from('broker_candidate_agent_logs').insert({
            action: 'automation_rule_deleted',
            message: `Automacao "${rule?.name || ruleId}" removida.`,
        })

        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erro ao remover automacao.' }, { status: 500 })
    }
}
