import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { phoneCandidates } from '@/lib/whatsapp/lead-sync'
import { sendWorkflowWhatsAppAction, workflowStepHasSendableContent, type WorkflowActionType } from '@/lib/workflows/whatsapp-actions'

export const dynamic = 'force-dynamic'

function normalizePhone(raw: unknown): string {
    const digits = String(raw || '').replace(/\D/g, '')
    if (!digits) return ''
    if (digits.startsWith('55')) return digits
    if (digits.length === 10 || digits.length === 11) return `55${digits}`
    return digits
}

function workflowSteps(workflow: any) {
    const metadataSteps = Array.isArray(workflow?.metadata?.steps) ? workflow.metadata.steps : []
    const steps = metadataSteps
        .map((step: any, index: number) => ({
            id: String(step?.id || `step_${index + 1}`),
            action_type: (step?.action_type || 'text') as WorkflowActionType,
            action_payload: step?.action_payload && typeof step.action_payload === 'object' ? step.action_payload : {},
            message_template: String(step?.message_template || '').trim(),
            stop_if_replied: step?.stop_if_replied !== false,
        }))
        .filter((step: any) => workflowStepHasSendableContent(step))

    if (steps.length > 0) return steps

    const fallback = String(workflow?.metadata?.message_template || '').trim()
    return fallback
        ? [{ id: 'step_1', action_type: 'text' as WorkflowActionType, action_payload: {}, message_template: fallback, stop_if_replied: true }]
        : []
}

async function logWorkflowEvent(params: {
    supabase: any
    runId?: string | null
    workflowId?: string | null
    leadId?: string | null
    brokerId?: string | null
    instanceId?: string | null
    leadPhone?: string | null
    eventType: string
    nodeId?: string | null
    status?: string | null
    message?: string | null
    metadata?: Record<string, unknown>
}) {
    await params.supabase.from('agent_workflow_events').insert([{
        run_id: params.runId || null,
        workflow_id: params.workflowId || null,
        lead_id: params.leadId || null,
        broker_id: params.brokerId || null,
        instance_id: params.instanceId || null,
        lead_phone: params.leadPhone || null,
        event_type: params.eventType,
        node_id: params.nodeId || null,
        status: params.status || null,
        message: params.message || null,
        metadata: params.metadata || {},
    }])
}

async function appendWorkflowMessageToConversation(params: {
    supabase: any
    brokerId: string | null
    instanceId: string | null
    leadId: string | null
    phone: string
    message: string
    workflowId: string
}) {
    const { supabase, brokerId, instanceId, leadId, phone, message, workflowId } = params
    if (!brokerId || !phone) return

    const now = new Date().toISOString()
    const assistantMsg = {
        role: 'assistant',
        content: message,
        type: 'text',
        source: 'agent_workflow_manual_test',
        workflow_id: workflowId,
        timestamp: now,
    }

    const { data: existingConv } = await supabase
        .from('whatsapp_ai_conversations')
        .select('id, messages')
        .eq('broker_id', brokerId)
        .eq('lead_phone', phone)
        .in('status', ['active', 'human_takeover', 'transferred'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (existingConv?.id) {
        const current = Array.isArray(existingConv.messages) ? existingConv.messages : []
        await supabase
            .from('whatsapp_ai_conversations')
            .update({ messages: [...current, assistantMsg], updated_at: now })
            .eq('id', existingConv.id)
        return
    }

    await supabase
        .from('whatsapp_ai_conversations')
        .insert({
            lead_id: leadId,
            broker_id: brokerId,
            instance_id: instanceId,
            lead_phone: phone,
            messages: [assistantMsg],
            bot_message_ids: [],
            status: 'active',
        })
}

export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        const body = await request.json()
        const workflowId = String(body?.workflow_id || '').trim()
        const leadId = body?.lead_id ? String(body.lead_id).trim() : ''
        const rawPhone = normalizePhone(body?.phone)
        let name = body?.name ? String(body.name).trim() : ''
        let phone = rawPhone

        if (!workflowId) {
            return NextResponse.json({ success: false, message: 'workflow_id obrigatorio.' }, { status: 400 })
        }

        const { data: workflow, error: workflowError } = await supabase
            .from('agent_workflows')
            .select('*')
            .eq('id', workflowId)
            .maybeSingle()

        if (workflowError || !workflow) {
            return NextResponse.json({ success: false, message: 'Workflow nao encontrado.' }, { status: 404 })
        }

        let lead: any = null
        if (leadId) {
            const { data: foundLead } = await supabase
                .from('leads')
                .select('id, name, phone, phone_e164, lead_purpose, lead_budget, lead_timeframe')
                .eq('id', leadId)
                .maybeSingle()
            if (foundLead) {
                lead = foundLead
                name = name || foundLead.name || ''
                phone = normalizePhone(foundLead.phone_e164 || foundLead.phone || phone)
            }
        } else if (phone) {
            const candidates = phoneCandidates(phone)
            const { data: foundLead } = await supabase
                .from('leads')
                .select('id, name, phone, phone_e164, lead_purpose, lead_budget, lead_timeframe')
                .or(`phone.in.(${candidates.join(',')}),phone_e164.in.(${candidates.join(',')})`)
                .limit(1)
                .maybeSingle()
            if (foundLead) {
                lead = foundLead
                name = name || foundLead.name || ''
            }
        }

        if (!phone) {
            return NextResponse.json({ success: false, message: 'Informe um telefone ou lead_id.' }, { status: 400 })
        }

        const steps = workflowSteps(workflow)
        if (steps.length === 0) {
            return NextResponse.json({ success: false, message: 'Este workflow nao tem bloco de mensagem para testar.' }, { status: 400 })
        }

        const brokerId = workflow.broker_id || null
        if (!brokerId) {
            return NextResponse.json({ success: false, message: 'Escolha um agente IA conectado antes de testar o workflow.' }, { status: 400 })
        }

        let instanceId = workflow.instance_id || null
        let instanceToken: string | null = null

        if (instanceId) {
            const { data: instance } = await supabase
                .from('whatsapp_instances')
                .select('id, instance_token')
                .eq('id', instanceId)
                .eq('status', 'connected')
                .maybeSingle()
            instanceToken = instance?.instance_token || null
        }

        if (!instanceToken) {
            const { data: instance } = await supabase
                .from('whatsapp_instances')
                .select('id, instance_token')
                .eq('broker_id', brokerId)
                .eq('status', 'connected')
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle()
            instanceId = instance?.id || instanceId
            instanceToken = instance?.instance_token || null
        }

        if (!instanceToken) {
            return NextResponse.json({ success: false, message: 'O agente escolhido nao tem WhatsApp conectado.' }, { status: 400 })
        }

        const firstStep = steps[0]
        const variables = {
            workflow_id: workflowId,
            workflowId,
            name: name || 'lead',
            nome_lead: name || 'lead',
            phone,
            telefone: phone,
            budget: lead?.lead_budget || '',
            prazo: lead?.lead_timeframe || '',
            finalidade: lead?.lead_purpose || '',
        }

        const startedAt = new Date().toISOString()
        const { data: run, error: runError } = await supabase
            .from('agent_workflow_runs')
            .insert([{
                workflow_id: workflowId,
                lead_id: lead?.id || leadId || null,
                broker_id: brokerId,
                instance_id: instanceId,
                lead_phone: phone,
                lead_name: name || null,
                status: 'running',
                trigger_type: 'manual',
                context: {
                    manual_run: true,
                    manual_test: true,
                    requested_from: 'admin_automation_page',
                    bypassed_waits: true,
                },
                started_at: startedAt,
            }])
            .select('id')
            .single()

        if (runError) throw runError

        await logWorkflowEvent({
            supabase,
            runId: run?.id,
            workflowId,
            leadId: lead?.id || leadId || null,
            brokerId,
            instanceId,
            leadPhone: phone,
            eventType: 'manual_test_started',
            status: 'running',
            metadata: { workflow_name: workflow.name, bypassed_waits: true },
        })

        try {
            if (firstStep.action_type === 'wait_only') {
                const completedAt = new Date().toISOString()
                await supabase
                    .from('agent_workflow_runs')
                    .update({
                        status: 'completed',
                        current_node_id: 'wait_1',
                        completed_at: completedAt,
                        attempt_count: 0,
                        updated_at: completedAt,
                        context: {
                            manual_run: true,
                            manual_test: true,
                            requested_from: 'admin_automation_page',
                            bypassed_waits: true,
                            messages_sent: 0,
                            wait_only: true,
                        },
                    })
                    .eq('id', run?.id)

                await logWorkflowEvent({
                    supabase,
                    runId: run?.id,
                    workflowId,
                    leadId: lead?.id || leadId || null,
                    brokerId,
                    instanceId,
                    leadPhone: phone,
                    eventType: 'workflow_waited',
                    nodeId: 'wait_1',
                    status: 'completed',
                    message: 'Teste manual concluiu uma espera sem envio.',
                    metadata: { action_type: firstStep.action_type, step: 1, manual_test: true },
                })

                return NextResponse.json({ success: true, run_id: run?.id, sent: 0, skipped_send: true })
            }

            const sentAction = await sendWorkflowWhatsAppAction({
                phone,
                instanceToken,
                step: firstStep,
                variables,
            })

            const completedAt = new Date().toISOString()
            await supabase
                .from('agent_workflow_runs')
                .update({
                    status: 'sent',
                    current_node_id: 'message_1',
                    completed_at: completedAt,
                    attempt_count: 1,
                    last_message_at: completedAt,
                    node_results: [{
                        node_id: 'message_1',
                        step_id: firstStep.id,
                        type: sentAction.type,
                        status: 'sent',
                        sent_at: completedAt,
                        manual_test: true,
                    }],
                    updated_at: completedAt,
                    context: {
                        manual_run: true,
                        manual_test: true,
                        requested_from: 'admin_automation_page',
                        bypassed_waits: true,
                        messages_sent: 1,
                    },
                })
                .eq('id', run?.id)

            await logWorkflowEvent({
                supabase,
                runId: run?.id,
                workflowId,
                leadId: lead?.id || leadId || null,
                brokerId,
                instanceId,
                leadPhone: phone,
                eventType: 'message_sent',
                nodeId: 'message_1',
                status: 'sent',
                message: sentAction.message.slice(0, 500),
                metadata: { preview: sentAction.preview.slice(0, 120), action_type: sentAction.type, step: 1, manual_test: true },
            })

            await appendWorkflowMessageToConversation({
                supabase,
                brokerId,
                instanceId,
                leadId: lead?.id || leadId || null,
                phone,
                message: sentAction.message,
                workflowId,
            })
        } catch (sendError: any) {
            const failedAt = new Date().toISOString()
            const errorMessage = sendError?.message || String(sendError)
            await supabase
                .from('agent_workflow_runs')
                .update({
                    status: 'failed',
                    error_message: errorMessage,
                    completed_at: failedAt,
                    updated_at: failedAt,
                })
                .eq('id', run?.id)
            await logWorkflowEvent({
                supabase,
                runId: run?.id,
                workflowId,
                leadId: lead?.id || leadId || null,
                brokerId,
                instanceId,
                leadPhone: phone,
                eventType: 'workflow_failed',
                nodeId: 'message_1',
                status: 'failed',
                message: errorMessage,
                metadata: { manual_test: true },
            })
            throw sendError
        }

        return NextResponse.json({
            success: true,
            message: `Teste enviado pelo agente. A primeira mensagem do workflow "${workflow.name}" foi disparada agora.`,
        })
    } catch (err: any) {
        console.error('[Agent Workflow Manual Run]', err)
        return NextResponse.json({ success: false, message: err.message }, { status: 500 })
    }
}
