import { NextRequest, NextResponse } from 'next/server'
import { requireAdminContext } from '@/lib/events/admin-auth'
import { enqueueCandidateMessages, logCandidateAgent, sendQueuedCandidateMessage } from '@/lib/broker-candidates/messages'
import { cleanString } from '@/lib/broker-candidates/utils'
import { getPublicAppUrl } from '@/lib/app-url'

export const dynamic = 'force-dynamic'

const statuses = new Set(['new', 'in_review', 'potential', 'approved', 'rejected', 'contacted', 'archived'])

function metadataRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await requireAdminContext()
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    try {
        const { id } = await params
        const body = await request.json()
        const updates: Record<string, any> = { updated_at: new Date().toISOString() }

        if ('status' in body && statuses.has(String(body.status))) updates.status = String(body.status)
        if ('ai_summary' in body) updates.ai_summary = cleanString(body.ai_summary, 2000) || null
        if ('ai_recommendation' in body) updates.ai_recommendation = cleanString(body.ai_recommendation, 2000) || null
        if ('metadata' in body) updates.metadata = metadataRecord(body.metadata)

        const { data, error } = await ctx.admin
            .from('broker_candidates')
            .update(updates)
            .eq('id', id)
            .select('*')
            .single()

        if (error) throw error

        await logCandidateAgent(ctx.admin, {
            candidate_id: id,
            action: 'candidate_updated_admin',
            message: 'Candidato atualizado no painel.',
            metadata: { fields: Object.keys(updates) },
        })

        if (updates.status) {
            const { data: rules, error: rulesError } = await ctx.admin
                .from('broker_candidate_automation_rules')
                .select('*')
                .eq('is_active', true)
                .eq('trigger_type', 'status_changed')

            if (!rulesError && rules?.length) {
                await enqueueCandidateMessages(ctx.admin, {
                    candidate: data,
                    rules,
                    publicUrl: `${getPublicAppUrl(request.headers.get('origin'))}/trabalhe-conosco`,
                    triggerType: 'status_changed',
                })
            }
        }

        return NextResponse.json({ success: true, candidate: data })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erro ao atualizar candidato.' }, { status: 500 })
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await requireAdminContext()
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    try {
        const { id } = await params
        const body = await request.json().catch(() => ({}))
        const action = String(body?.action || 'send_next_message')

        const { data: candidate, error: candidateError } = await ctx.admin
            .from('broker_candidates')
            .select('*')
            .eq('id', id)
            .maybeSingle()

        if (candidateError) throw candidateError
        if (!candidate) return NextResponse.json({ error: 'Candidato nao encontrado.' }, { status: 404 })

        if (action === 'enqueue_messages') {
            const { data: rules, error: rulesError } = await ctx.admin
                .from('broker_candidate_automation_rules')
                .select('*')
                .eq('is_active', true)
            if (rulesError) throw rulesError
            const queued = await enqueueCandidateMessages(ctx.admin, {
                candidate,
                rules: rules || [],
                publicUrl: `${getPublicAppUrl(request.headers.get('origin'))}/trabalhe-conosco`,
            })
            return NextResponse.json({ success: true, queued })
        }

        const { data: nextMessage, error } = await ctx.admin
            .from('broker_candidate_message_queue')
            .select('id')
            .eq('candidate_id', id)
            .eq('status', 'pending')
            .order('scheduled_for', { ascending: true })
            .limit(1)
            .maybeSingle()

        if (error) throw error
        if (!nextMessage?.id) return NextResponse.json({ error: 'Nao ha mensagem pendente para este candidato.' }, { status: 404 })

        const result = await sendQueuedCandidateMessage(ctx.admin, nextMessage.id)
        return NextResponse.json({ success: true, result })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erro ao processar candidato.' }, { status: 500 })
    }
}
