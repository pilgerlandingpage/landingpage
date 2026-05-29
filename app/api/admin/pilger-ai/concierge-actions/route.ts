import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type AssistantAction = {
    id: string
    conversation_id?: string | null
    broker_id: string
    authorized_phone_id?: string | null
    action_type: string
    status: string
    payload?: Record<string, any> | null
    result?: Record<string, any> | null
    requested_at?: string | null
    confirmed_at?: string | null
    executed_at?: string | null
    created_at?: string | null
    updated_at?: string | null
}

const CONCIERGE_ACTION_TYPES = ['create_finance_entry', 'create_appointment']

function safeNumber(value: unknown) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

function getFinanceEntryId(result?: Record<string, any> | null) {
    return result?.finance_entry_id || result?.entry_id || result?.id || null
}

function getAppointmentId(result?: Record<string, any> | null) {
    return result?.appointment_id || result?.appointmentId || null
}

function buildSummary(actions: AssistantAction[]) {
    return actions.reduce<Record<string, number>>((summary, action) => {
        const key = action.status || 'unknown'
        summary[key] = (summary[key] || 0) + 1
        return summary
    }, {})
}

function serializeAction(action: AssistantAction, phonesById: Map<string, any>, conversationsById: Map<string, any>) {
    const payload = action.payload || {}
    const result = action.result || {}
    const phone = action.authorized_phone_id ? phonesById.get(action.authorized_phone_id) : null
    const conversation = action.conversation_id ? conversationsById.get(action.conversation_id) : null
    const receiptAnalysis = payload.receipt_analysis || {}

    return {
        id: action.id,
        conversation_id: action.conversation_id || null,
        broker_id: action.broker_id,
        action_type: action.action_type,
        status: action.status,
        requested_at: action.requested_at || action.created_at || null,
        confirmed_at: action.confirmed_at || null,
        executed_at: action.executed_at || null,
        created_at: action.created_at || null,
        updated_at: action.updated_at || null,
        owner_name: phone?.name || null,
        owner_role: phone?.role || null,
        owner_phone: phone?.phone || conversation?.phone || null,
        conversation_phone: conversation?.phone || null,
        description: payload.description || 'Lancamento financeiro',
        amount: safeNumber(payload.amount),
        entry_date: payload.entry_date || payload.due_date || null,
        category: payload.category || null,
        subcategory: payload.subcategory || null,
        payment_method: payload.payment_method || null,
        payment_status: payload.payment_status || null,
        counterparty_name: payload.counterparty_name || null,
        counterparty_type: payload.counterparty_type || null,
        appointment_id: getAppointmentId(result),
        appointment_title: payload.title || payload.leadName || payload.lead_name || null,
        appointment_date: payload.date || payload.appointment_date || null,
        appointment_time: payload.time || payload.appointment_time || null,
        appointment_type: payload.type || payload.appointment_type || null,
        attachment_url: payload.attachment_url || null,
        media_filename: payload.media_filename || null,
        source_text: payload.source_text || null,
        receipt_confidence: safeNumber(receiptAnalysis.confidence),
        receipt_summary: receiptAnalysis.raw_summary || null,
        receipt_document_number: receiptAnalysis.document_number || null,
        finance_entry_id: getFinanceEntryId(result),
        result,
    }
}

export async function GET(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        const searchParams = request.nextUrl.searchParams
        const brokerId = searchParams.get('broker_id') || ''
        const rawActionType = searchParams.get('action_type') || 'all'
        const limit = Math.min(Math.max(Number(searchParams.get('limit') || 20), 1), 60)

        if (!brokerId) {
            return NextResponse.json({ success: false, error: 'broker_id obrigatorio.' }, { status: 400 })
        }

        const actionTypes = rawActionType === 'all'
            ? CONCIERGE_ACTION_TYPES
            : rawActionType
                .split(',')
                .map(item => item.trim())
                .filter(item => CONCIERGE_ACTION_TYPES.includes(item))

        let query = supabase
            .from('broker_assistant_actions')
            .select('id, conversation_id, broker_id, authorized_phone_id, action_type, status, payload, result, requested_at, confirmed_at, executed_at, created_at, updated_at')
            .eq('broker_id', brokerId)

        if (actionTypes.length === 1) {
            query = query.eq('action_type', actionTypes[0])
        } else {
            query = query.in('action_type', actionTypes.length ? actionTypes : CONCIERGE_ACTION_TYPES)
        }

        const { data: actionsData, error } = await query
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }

        const actions = (actionsData || []) as AssistantAction[]
        const authorizedPhoneIds = Array.from(new Set(actions.map(action => action.authorized_phone_id).filter(Boolean))) as string[]
        const conversationIds = Array.from(new Set(actions.map(action => action.conversation_id).filter(Boolean))) as string[]

        const [phonesResponse, conversationsResponse] = await Promise.all([
            authorizedPhoneIds.length
                ? supabase
                    .from('broker_assistant_authorized_phones')
                    .select('id, phone, name, role')
                    .in('id', authorizedPhoneIds)
                : Promise.resolve({ data: [], error: null }),
            conversationIds.length
                ? supabase
                    .from('broker_assistant_conversations')
                    .select('id, phone, state, last_message_at')
                    .in('id', conversationIds)
                : Promise.resolve({ data: [], error: null }),
        ])

        if (phonesResponse.error) {
            return NextResponse.json({ success: false, error: phonesResponse.error.message }, { status: 500 })
        }
        if (conversationsResponse.error) {
            return NextResponse.json({ success: false, error: conversationsResponse.error.message }, { status: 500 })
        }

        const phonesById = new Map<string, any>((phonesResponse.data || []).map((phone: any) => [String(phone.id), phone]))
        const conversationsById = new Map<string, any>((conversationsResponse.data || []).map((conversation: any) => [String(conversation.id), conversation]))

        return NextResponse.json({
            success: true,
            summary: buildSummary(actions),
            actions: actions.map(action => serializeAction(action, phonesById, conversationsById)),
        })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 })
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        const body = await request.json().catch(() => ({}))
        const actionId = String(body?.id || '')
        const nextStatus = String(body?.status || '')

        if (!actionId) {
            return NextResponse.json({ success: false, error: 'ID da acao obrigatorio.' }, { status: 400 })
        }
        if (nextStatus !== 'cancelled') {
            return NextResponse.json({ success: false, error: 'Status permitido nesta etapa: cancelled.' }, { status: 400 })
        }

        const { data: action, error: actionError } = await supabase
            .from('broker_assistant_actions')
            .select('id, conversation_id, status')
            .eq('id', actionId)
            .single()

        if (actionError || !action) {
            return NextResponse.json({ success: false, error: actionError?.message || 'Acao nao encontrada.' }, { status: 404 })
        }
        if (action.status !== 'pending') {
            return NextResponse.json({ success: false, error: 'Somente acoes pendentes podem ser canceladas.' }, { status: 409 })
        }

        const now = new Date().toISOString()
        const { error: updateError } = await supabase
            .from('broker_assistant_actions')
            .update({
                status: 'cancelled',
                result: {
                    reason: 'cancelled_by_admin',
                    cancelled_at: now,
                },
                updated_at: now,
            })
            .eq('id', actionId)
            .eq('status', 'pending')

        if (updateError) {
            return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
        }

        if (action.conversation_id) {
            const { data: conversation } = await supabase
                .from('broker_assistant_conversations')
                .select('id, state')
                .eq('id', action.conversation_id)
                .single()

            const state = (conversation?.state && typeof conversation.state === 'object') ? conversation.state : {}
            if (state?.pending_action?.action_id === actionId) {
                await supabase
                    .from('broker_assistant_conversations')
                    .update({
                        state: {
                            ...state,
                            pending_action: null,
                        },
                        updated_at: now,
                    })
                    .eq('id', action.conversation_id)
            }
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 })
    }
}
