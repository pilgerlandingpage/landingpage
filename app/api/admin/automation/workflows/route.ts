import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { workflowStepHasSendableContent, type WorkflowActionType } from '@/lib/workflows/whatsapp-actions'

export const dynamic = 'force-dynamic'

const TRIGGERS = new Set(['lead_created', 'lead_no_reply', 'lead_qualified', 'appointment_pending', 'manual'])
const SEND_TIMES = new Set(['same_time', 'business_hours', 'anytime'])
const ACTION_TYPES = new Set(['wait_only', 'text', 'url_buttons', 'reply_buttons', 'list', 'poll', 'audio_tts', 'image', 'video', 'document', 'location_request', 'contact', 'carousel'])

function normalizeSteps(body: any, delayMinutes = 15, message = '') {
    const rawSteps = Array.isArray(body?.steps) ? body.steps : []
    const steps = rawSteps
        .slice(0, 8)
        .map((step: any, index: number) => ({
            id: String(step?.id || `step_${index + 1}`),
            wait_mode: step?.wait_mode === 'datetime' ? 'datetime' : 'relative',
            delay_minutes: Math.max(0, Math.min(43200, Number(step?.delay_minutes ?? delayMinutes))),
            wait_until: step?.wait_until ? String(step.wait_until) : null,
            action_type: (ACTION_TYPES.has(String(step?.action_type)) ? String(step.action_type) : 'text') as WorkflowActionType,
            action_payload: step?.action_payload && typeof step.action_payload === 'object' ? step.action_payload : {},
            message_template: String(step?.message_template || '').trim(),
            stop_if_replied: step?.stop_if_replied !== false,
        }))
        .filter((step: any) => workflowStepHasSendableContent(step))

    if (steps.length > 0) return steps

    if (!message) return []

    return [{
        id: 'step_1',
        wait_mode: 'relative',
        delay_minutes: Math.max(0, Math.min(43200, Number(delayMinutes || 15))),
        wait_until: null,
        action_type: 'text',
        action_payload: {},
        message_template: message || 'Oi {nome_lead}, passando para saber se posso te ajudar com o imovel que voce viu.',
        stop_if_replied: true,
    }]
}

function nodesFromSteps(steps: Array<{ id: string; wait_mode?: string; delay_minutes: number; wait_until?: string | null; action_type?: string; action_payload?: Record<string, any>; message_template: string; stop_if_replied: boolean }>) {
    const nodes: any[] = [
        {
            id: 'trigger',
            type: 'trigger',
            label: 'Entrada do lead',
            position: { x: 80, y: 140 },
            data: {},
        },
    ]

    steps.forEach((step, index) => {
        const x = 330 + index * 420
        const isWaitOnly = step.action_type === 'wait_only'
        nodes.push({
            id: `wait_${index + 1}`,
            type: 'wait',
            label: `Aguardar ${index + 1}`,
            position: { x, y: 100 },
            data: {
                wait_mode: step.wait_mode || 'relative',
                delay_minutes: step.delay_minutes,
                wait_until: step.wait_until || null,
                step_id: step.id,
                action_type: step.action_type || 'text',
            },
        })
        if (isWaitOnly) return
        nodes.push({
            id: `message_${index + 1}`,
            type: 'agent_message',
            label: `Mensagem ${index + 1}`,
            position: { x: x + 190, y: 100 },
            data: {
                message_template: step.message_template,
                action_type: step.action_type || 'text',
                action_payload: step.action_payload || {},
                stop_if_replied: step.stop_if_replied,
                step_id: step.id,
            },
        })
    })

    return nodes
}

function edgesFromSteps(steps: Array<{ id: string; action_type?: string }>) {
    const edges: any[] = []
    let previous = 'trigger'
    steps.forEach((step, index) => {
        const waitId = `wait_${index + 1}`
        const messageId = `message_${index + 1}`
        edges.push({ id: `${previous}-${waitId}`, source: previous, target: waitId })
        if (step.action_type === 'wait_only') {
            previous = waitId
            return
        }
        edges.push({ id: `${waitId}-${messageId}`, source: waitId, target: messageId })
        previous = messageId
    })
    return edges
}

function normalizeWorkflowPayload(body: any) {
    const name = String(body?.name || '').trim()
    if (!name) throw new Error('Nome do workflow e obrigatorio.')

    const trigger_type = TRIGGERS.has(String(body?.trigger_type)) ? String(body.trigger_type) : 'lead_created'
    const preferred_send_time = SEND_TIMES.has(String(body?.preferred_send_time)) ? String(body.preferred_send_time) : 'same_time'
    const delayMinutes = Math.max(1, Math.min(43200, Number(body?.delay_minutes || 15)))
    const messageTemplate = String(body?.message_template || '').trim()
    const steps = normalizeSteps(body, delayMinutes, messageTemplate)
    const providedNodes = Array.isArray(body?.nodes) ? body.nodes : []
    const providedEdges = Array.isArray(body?.edges) ? body.edges : []

    return {
        name,
        description: body?.description ? String(body.description).trim() : null,
        trigger_type,
        broker_id: body?.broker_id || null,
        instance_id: body?.instance_id || null,
        is_active: body?.is_active !== false,
        wait_for_online: body?.wait_for_online === true,
        preferred_send_time,
        nodes: providedNodes.length ? providedNodes : nodesFromSteps(steps),
        edges: providedEdges.length ? providedEdges : edgesFromSteps(steps),
        metadata: {
            ...(body?.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
            delay_minutes: steps[0]?.delay_minutes ?? delayMinutes,
            message_template: steps[0]?.message_template ?? messageTemplate,
            steps,
        },
        updated_at: new Date().toISOString(),
    }
}

export async function GET() {
    try {
        const supabase = createAdminClient()
        const [workflowsRes, brokersRes, instancesRes, runsRes, eventsRes] = await Promise.all([
            supabase
                .from('agent_workflows')
                .select('*')
                .order('created_at', { ascending: false }),
            supabase
                .from('virtual_brokers')
                .select('id, name, phone, is_active')
                .order('name'),
            supabase
                .from('whatsapp_instances')
                .select('id, instance_name, phone_number, status, broker_id, instance_token')
                .order('created_at', { ascending: false }),
            supabase
                .from('agent_workflow_runs')
                .select('id, workflow_id, status, lead_phone, lead_name, created_at, completed_at, error_message, attempt_count, stopped_reason')
                .order('created_at', { ascending: false })
                .limit(30),
            supabase
                .from('agent_workflow_events')
                .select('id, run_id, workflow_id, lead_phone, event_type, node_id, status, message, metadata, created_at')
                .order('created_at', { ascending: false })
                .limit(40),
        ])

        if (workflowsRes.error) throw workflowsRes.error

        return NextResponse.json({
            success: true,
            workflows: workflowsRes.data || [],
            brokers: brokersRes.data || [],
            instances: instancesRes.data || [],
            recent_runs: runsRes.data || [],
            recent_events: eventsRes.data || [],
        })
    } catch (err: any) {
        console.error('[Agent Workflows GET]', err)
        return NextResponse.json({ success: false, message: err.message }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        const body = await request.json()
        const payload = normalizeWorkflowPayload(body)

        const { data, error } = await supabase
            .from('agent_workflows')
            .insert([{ ...payload, created_at: new Date().toISOString() }])
            .select()
            .single()

        if (error) throw error
        return NextResponse.json({ success: true, workflow: data })
    } catch (err: any) {
        console.error('[Agent Workflows POST]', err)
        return NextResponse.json({ success: false, message: err.message }, { status: 500 })
    }
}

export async function PUT(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        const body = await request.json()
        const id = String(body?.id || '')
        if (!id) return NextResponse.json({ success: false, message: 'ID obrigatorio.' }, { status: 400 })

        const payload = normalizeWorkflowPayload(body)
        const { data, error } = await supabase
            .from('agent_workflows')
            .update(payload)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return NextResponse.json({ success: true, workflow: data })
    } catch (err: any) {
        console.error('[Agent Workflows PUT]', err)
        return NextResponse.json({ success: false, message: err.message }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        const id = request.nextUrl.searchParams.get('id')
        if (!id) return NextResponse.json({ success: false, message: 'ID obrigatorio.' }, { status: 400 })

        const { error } = await supabase
            .from('agent_workflows')
            .delete()
            .eq('id', id)

        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('[Agent Workflows DELETE]', err)
        return NextResponse.json({ success: false, message: err.message }, { status: 500 })
    }
}
