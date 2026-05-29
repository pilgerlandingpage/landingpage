import { NextRequest, NextResponse } from 'next/server'
import { requireAdminContext } from '@/lib/events/admin-auth'
import {
    DEFAULT_CONFIRMATION_TEMPLATE,
    DEFAULT_REMINDER_TEMPLATE,
    cleanString,
    normalizeEventSlug,
} from '@/lib/events/utils'

export const dynamic = 'force-dynamic'

function buildUpdatePayload(body: any) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if ('title' in body) {
        const title = cleanString(body.title, 180)
        if (!title) throw new Error('Informe o titulo do evento.')
        updates.title = title
    }
    if ('slug' in body) {
        const slug = normalizeEventSlug(body.slug)
        if (!slug) throw new Error('Informe um slug valido.')
        updates.slug = slug
    }
    if ('eyebrow' in body) updates.eyebrow = cleanString(body.eyebrow, 120) || null
    if ('subtitle' in body) updates.subtitle = cleanString(body.subtitle, 260) || null
    if ('description' in body) updates.description = cleanString(body.description, 900) || null
    if ('content' in body) updates.content = cleanString(body.content, 5000) || null
    if ('event_date' in body) {
        if (!body.event_date || Number.isNaN(new Date(body.event_date).getTime())) throw new Error('Data do evento invalida.')
        updates.event_date = new Date(body.event_date).toISOString()
    }
    if ('end_date' in body) {
        updates.end_date = body.end_date && !Number.isNaN(new Date(body.end_date).getTime()) ? new Date(body.end_date).toISOString() : null
    }
    if ('location_name' in body) updates.location_name = cleanString(body.location_name, 180) || null
    if ('location_address' in body) updates.location_address = cleanString(body.location_address, 260) || null
    if ('format' in body && ['presencial', 'online', 'hibrido'].includes(body.format)) updates.format = body.format
    if ('hero_image_url' in body) updates.hero_image_url = cleanString(body.hero_image_url, 1200) || null
    if ('status' in body && ['draft', 'published', 'archived'].includes(body.status)) updates.status = body.status
    if ('capacity' in body) {
        const capacity = Number(body.capacity || 0)
        updates.capacity = Number.isFinite(capacity) && capacity > 0 ? Math.floor(capacity) : null
    }
    if ('target_audience' in body) updates.target_audience = cleanString(body.target_audience, 500) || null
    if ('confirmation_message_template' in body) updates.confirmation_message_template = cleanString(body.confirmation_message_template, 3000) || DEFAULT_CONFIRMATION_TEMPLATE
    if ('reminder_message_template' in body) updates.reminder_message_template = cleanString(body.reminder_message_template, 3000) || DEFAULT_REMINDER_TEMPLATE
    if ('metadata' in body && body.metadata && typeof body.metadata === 'object') updates.metadata = body.metadata

    return updates
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await requireAdminContext()
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    try {
        const { id } = await params
        const [eventRes, rulesRes, registrationsRes, registrationsCountRes, queueRes, logsRes] = await Promise.all([
            ctx.admin.from('event_events').select('*').eq('id', id).maybeSingle(),
            ctx.admin.from('event_automation_rules').select('*').eq('event_id', id).order('created_at', { ascending: true }),
            ctx.admin.from('event_registrations').select('*').eq('event_id', id).order('created_at', { ascending: false }).range(0, 4999),
            ctx.admin.from('event_registrations').select('id', { count: 'exact', head: true }).eq('event_id', id),
            ctx.admin.from('event_message_queue').select('*').eq('event_id', id).order('scheduled_for', { ascending: false }).limit(500),
            ctx.admin.from('event_agent_logs').select('*').eq('event_id', id).order('created_at', { ascending: false }).limit(80),
        ])

        if (eventRes.error) throw eventRes.error
        if (!eventRes.data) return NextResponse.json({ error: 'Evento nao encontrado.' }, { status: 404 })

        return NextResponse.json({
            event: eventRes.data,
            rules: rulesRes.data || [],
            registrations: registrationsRes.data || [],
            registrationsCount: registrationsCountRes.count || registrationsRes.data?.length || 0,
            messages: queueRes.data || [],
            logs: logsRes.data || [],
        })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erro ao carregar evento.' }, { status: 500 })
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await requireAdminContext()
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    try {
        const { id } = await params
        const body = await request.json()
        const updates = buildUpdatePayload(body)

        if ('slug' in updates) {
            const { data: existing } = await ctx.admin
                .from('event_events')
                .select('id')
                .eq('slug', updates.slug)
                .neq('id', id)
                .maybeSingle()
            if (existing) return NextResponse.json({ error: 'Este slug ja esta em uso.' }, { status: 409 })
        }

        const { data, error } = await ctx.admin
            .from('event_events')
            .update(updates)
            .eq('id', id)
            .select('*')
            .single()

        if (error) throw error

        await ctx.admin.from('event_agent_logs').insert({
            event_id: id,
            action: 'event_updated',
            message: 'Evento atualizado no painel administrativo.',
            metadata: { fields: Object.keys(updates) },
        })

        return NextResponse.json({ success: true, event: data })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erro ao atualizar evento.' }, { status: 500 })
    }
}
