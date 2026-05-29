import { NextRequest, NextResponse } from 'next/server'
import { requireAdminContext } from '@/lib/events/admin-auth'
import { syncLeadEmailFromEventRegistration } from '@/lib/events/lead-email-sync'
import { sendQueuedEventMessage } from '@/lib/events/messages'
import { cleanString } from '@/lib/events/utils'

export const dynamic = 'force-dynamic'

function buildRegistrationUpdates(body: any) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if ('status' in body && ['confirmed', 'cancelled', 'checked_in', 'waitlisted'].includes(body.status)) {
        updates.status = body.status
        if (body.status === 'checked_in') updates.checked_in_at = new Date().toISOString()
        if (body.status !== 'checked_in') updates.checked_in_at = null
    }
    if ('creci_status' in body && ['pending', 'manually_verified', 'rejected'].includes(body.creci_status)) {
        updates.creci_status = body.creci_status
    }
    if ('full_name' in body) updates.full_name = cleanString(body.full_name, 180)
    if ('email' in body) updates.email = cleanString(body.email, 180) || null
    if ('city' in body) updates.city = cleanString(body.city, 120) || null
    if ('market_focus' in body) updates.market_focus = cleanString(body.market_focus, 160) || null
    if ('monthly_leads' in body) updates.monthly_leads = cleanString(body.monthly_leads, 80) || null
    if ('real_estate_name' in body) updates.real_estate_name = cleanString(body.real_estate_name, 180) || null

    return updates
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ registrationId: string }> }) {
    const ctx = await requireAdminContext()
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    try {
        const { registrationId } = await params
        const body = await request.json()
        const updates = buildRegistrationUpdates(body)

        const { data, error } = await ctx.admin
            .from('event_registrations')
            .update(updates)
            .eq('id', registrationId)
            .select('*')
            .single()

        if (error) throw error

        await syncLeadEmailFromEventRegistration(ctx.admin, data).catch((err) => {
            console.warn('[Admin Event Registration] lead email sync failed:', err)
        })

        await ctx.admin.from('event_agent_logs').insert({
            event_id: data.event_id,
            registration_id: data.id,
            action: 'registration_updated',
            message: `Inscrito "${data.full_name}" atualizado.`,
            metadata: { fields: Object.keys(updates) },
        })

        return NextResponse.json({ success: true, registration: data })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erro ao atualizar inscrito.' }, { status: 500 })
    }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ registrationId: string }> }) {
    const ctx = await requireAdminContext()
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    try {
        const { registrationId } = await params
        const body = await request.json()

        if (body.action !== 'send_next_message') {
            return NextResponse.json({ error: 'Acao invalida.' }, { status: 400 })
        }

        let queueQuery = ctx.admin
            .from('event_message_queue')
            .select('id')
            .eq('registration_id', registrationId)
            .eq('status', 'pending')

        if (body.queueId) {
            queueQuery = queueQuery.eq('id', body.queueId)
        } else {
            queueQuery = queueQuery.lte('scheduled_for', new Date(Date.now() + 30_000).toISOString())
        }

        const { data: queue } = await queueQuery
            .order('scheduled_for', { ascending: true })
            .limit(1)
            .maybeSingle()

        if (!queue?.id) {
            return NextResponse.json({ error: 'Nenhuma mensagem vencida para este inscrito.' }, { status: 404 })
        }

        await ctx.admin
            .from('event_message_queue')
            .update({ scheduled_for: new Date().toISOString() })
            .eq('id', queue.id)

        const result = await sendQueuedEventMessage(ctx.admin, queue.id)
        return NextResponse.json({ success: true, result })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erro ao enviar mensagem.' }, { status: 500 })
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ registrationId: string }> }) {
    const ctx = await requireAdminContext()
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    try {
        const { registrationId } = await params

        const { data: registration, error: registrationError } = await ctx.admin
            .from('event_registrations')
            .select('id, event_id, full_name, email, phone')
            .eq('id', registrationId)
            .maybeSingle()

        if (registrationError) throw registrationError
        if (!registration) {
            return NextResponse.json({ error: 'Inscrito nao encontrado.' }, { status: 404 })
        }

        const [{ count: deletedQueue }, { count: deletedLogs }] = await Promise.all([
            ctx.admin
                .from('event_message_queue')
                .select('id', { count: 'exact', head: true })
                .eq('registration_id', registrationId),
            ctx.admin
                .from('event_agent_logs')
                .select('id', { count: 'exact', head: true })
                .eq('registration_id', registrationId),
        ])

        const { error: logsError } = await ctx.admin
            .from('event_agent_logs')
            .delete()
            .eq('registration_id', registrationId)

        if (logsError) throw logsError

        const { error: queueError } = await ctx.admin
            .from('event_message_queue')
            .delete()
            .eq('registration_id', registrationId)

        if (queueError) throw queueError

        const { error: deleteError } = await ctx.admin
            .from('event_registrations')
            .delete()
            .eq('id', registrationId)

        if (deleteError) throw deleteError

        await ctx.admin.from('event_agent_logs').insert({
            event_id: registration.event_id,
            action: 'registration_deleted',
            message: `Inscrito "${registration.full_name}" removido pelo admin.`,
            metadata: {
                deleted_registration_id: registration.id,
                email: registration.email,
                phone: registration.phone,
                deleted_queue: deletedQueue || 0,
                deleted_logs: deletedLogs || 0,
            },
        })

        return NextResponse.json({
            success: true,
            deleted: {
                registration_id: registration.id,
                full_name: registration.full_name,
                queue: deletedQueue || 0,
                logs: deletedLogs || 0,
            },
        })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erro ao apagar inscrito.' }, { status: 500 })
    }
}
