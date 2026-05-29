import { NextRequest, NextResponse } from 'next/server'
import { requireAdminContext } from '@/lib/events/admin-auth'
import {
    DEFAULT_CONFIRMATION_TEMPLATE,
    DEFAULT_REMINDER_TEMPLATE,
    buildEventSlug,
    cleanString,
    normalizeEventSlug,
} from '@/lib/events/utils'

export const dynamic = 'force-dynamic'

function parseEventPayload(body: any) {
    const title = cleanString(body.title, 180)
    const eventDate = cleanString(body.event_date, 80)
    const slug = normalizeEventSlug(body.slug || buildEventSlug(title, eventDate))

    if (!title) throw new Error('Informe o titulo do evento.')
    if (!slug) throw new Error('Informe um slug valido para o evento.')
    if (!eventDate || Number.isNaN(new Date(eventDate).getTime())) throw new Error('Informe data e horario validos.')

    const capacity = Number(body.capacity || 0)

    return {
        title,
        slug,
        eyebrow: cleanString(body.eyebrow, 120) || 'Encontro exclusivo',
        subtitle: cleanString(body.subtitle, 260) || null,
        description: cleanString(body.description, 900) || null,
        content: cleanString(body.content, 5000) || null,
        event_date: new Date(eventDate).toISOString(),
        end_date: body.end_date && !Number.isNaN(new Date(body.end_date).getTime()) ? new Date(body.end_date).toISOString() : null,
        location_name: cleanString(body.location_name, 180) || null,
        location_address: cleanString(body.location_address, 260) || null,
        format: ['presencial', 'online', 'hibrido'].includes(body.format) ? body.format : 'presencial',
        hero_image_url: cleanString(body.hero_image_url, 1200) || null,
        status: ['draft', 'published', 'archived'].includes(body.status) ? body.status : 'draft',
        capacity: Number.isFinite(capacity) && capacity > 0 ? Math.floor(capacity) : null,
        target_audience: cleanString(body.target_audience, 500) || 'Corretores de imoveis, autonomos e equipes comerciais de imobiliarias.',
        confirmation_message_template: cleanString(body.confirmation_message_template, 3000) || DEFAULT_CONFIRMATION_TEMPLATE,
        reminder_message_template: cleanString(body.reminder_message_template, 3000) || DEFAULT_REMINDER_TEMPLATE,
        metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
    }
}

export async function GET() {
    const ctx = await requireAdminContext()
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    try {
        const { data: events, error } = await ctx.admin
            .from('event_events')
            .select('*')
            .order('event_date', { ascending: false })

        if (error) throw error

        const rows = await Promise.all((events || []).map(async (event: any) => {
            const [{ count: registrations }, { count: checkedIn }, { count: pendingMessages }] = await Promise.all([
                ctx.admin
                    .from('event_registrations')
                    .select('id', { head: true, count: 'exact' })
                    .eq('event_id', event.id)
                    .neq('status', 'cancelled'),
                ctx.admin
                    .from('event_registrations')
                    .select('id', { head: true, count: 'exact' })
                    .eq('event_id', event.id)
                    .eq('status', 'checked_in'),
                ctx.admin
                    .from('event_message_queue')
                    .select('id', { head: true, count: 'exact' })
                    .eq('event_id', event.id)
                    .eq('status', 'pending'),
            ])

            return {
                ...event,
                registrations_count: registrations || 0,
                checked_in_count: checkedIn || 0,
                pending_messages_count: pendingMessages || 0,
            }
        }))

        return NextResponse.json({ events: rows })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erro ao carregar eventos.' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const ctx = await requireAdminContext()
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

    try {
        const body = await request.json()
        const payload = parseEventPayload(body)

        const { data: existing } = await ctx.admin
            .from('event_events')
            .select('id')
            .eq('slug', payload.slug)
            .maybeSingle()

        if (existing) {
            return NextResponse.json({ error: 'Este slug ja esta em uso.' }, { status: 409 })
        }

        const { data: event, error } = await ctx.admin
            .from('event_events')
            .insert({
                ...payload,
                created_by: ctx.adminUser?.id || null,
            })
            .select('*')
            .single()

        if (error) throw error

        if (body.create_default_rules !== false) {
            await ctx.admin.from('event_automation_rules').insert([
                {
                    event_id: event.id,
                    name: 'Confirmacao imediata',
                    trigger_type: 'immediate',
                    segment: 'all',
                    message_template: event.confirmation_message_template || DEFAULT_CONFIRMATION_TEMPLATE,
                    is_active: true,
                },
                {
                    event_id: event.id,
                    name: 'Lembrete 5 horas antes',
                    trigger_type: 'before_event',
                    offset_minutes: 300,
                    segment: 'all',
                    message_template: event.reminder_message_template || DEFAULT_REMINDER_TEMPLATE,
                    is_active: true,
                },
                {
                    event_id: event.id,
                    name: 'Mensagem na hora do evento',
                    trigger_type: 'at_event_time',
                    segment: 'all',
                    message_template: 'Ola {nome}, o encontro "{evento}" comeca agora. Estamos te esperando no {local_evento}.',
                    is_active: false,
                },
            ])
        }

        await ctx.admin.from('event_agent_logs').insert({
            event_id: event.id,
            action: 'event_created',
            message: 'Evento criado no painel administrativo.',
            metadata: { created_by: ctx.adminUser?.id || ctx.user.id },
        })

        return NextResponse.json({ success: true, event })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Erro ao criar evento.' }, { status: 500 })
    }
}
