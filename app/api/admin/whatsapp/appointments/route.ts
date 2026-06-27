import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsAppMessage } from '@/lib/connectyhub/whatsapp'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function formatAppointmentDatePt(dateKey?: string | null): string {
    if (!dateKey) return 'data combinada'
    const date = new Date(`${dateKey}T12:00:00-03:00`)
    return date.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    })
}

async function notifyLeadAboutAppointmentStatus(params: {
    supabase: ReturnType<typeof getSupabase>
    appointment: any
    status?: string
}) {
    const { supabase, appointment, status } = params
    if (!appointment?.lead_phone || !appointment?.broker_id) return
    if (status !== 'confirmed' && status !== 'cancelled') return

    const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('instance_token, instance_name')
        .eq('broker_id', appointment.broker_id)
        .eq('status', 'connected')
        .limit(1)
        .maybeSingle()

    if (!instance?.instance_token) return

    const dateLabel = formatAppointmentDatePt(appointment.appointment_date)
    const timeLabel = appointment.appointment_time || 'horario combinado'
    const propertyLabel = appointment.property_title ? ` para ${appointment.property_title}` : ''
    const message = status === 'confirmed'
        ? `Disponibilidade confirmada. Sua visita${propertyLabel} ficou marcada para ${dateLabel}, as ${timeLabel}. Qualquer ajuste, me chama por aqui.`
        : `Esse horario para ${dateLabel}, as ${timeLabel}, nao ficou disponivel. Me diga outro melhor para voce que eu ajusto por aqui.`

    await sendWhatsAppMessage({
        phone: appointment.lead_phone,
        message,
        instanceToken: instance.instance_token,
    })
}

// GET — List appointments
export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        const from = searchParams.get('from')
        const to = searchParams.get('to')

        let query = supabase
            .from('appointments')
            .select('*')
            .order('appointment_date', { ascending: true })
            .order('created_at', { ascending: false })

        if (status && status !== 'all') {
            query = query.eq('status', status)
        }
        if (from) query = query.gte('appointment_date', from)
        if (to) query = query.lte('appointment_date', to)

        const { data, error } = await query
        if (error) throw error

        return NextResponse.json({ success: true, appointments: data || [] })
    } catch (error) {
        console.error('[Appointments] GET error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

// POST — Create appointment
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const body = await request.json()

        const { data, error } = await supabase
            .from('appointments')
            .insert([body])
            .select()
            .single()

        if (error) throw error
        return NextResponse.json({ success: true, appointment: data })
    } catch (error) {
        console.error('[Appointments] POST error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

// PUT — Update appointment (confirm, cancel, etc.)
export async function PUT(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const body = await request.json()
        const { id, ...updates } = body

        if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 })

        const { data: currentAppointment } = await supabase
            .from('appointments')
            .select('*')
            .eq('id', id)
            .maybeSingle()

        if (updates.status === 'confirmed') updates.confirmed_at = new Date().toISOString()
        if (updates.status === 'cancelled') updates.cancelled_at = new Date().toISOString()

        const { error } = await supabase
            .from('appointments')
            .update(updates)
            .eq('id', id)

        if (error) throw error

        if (currentAppointment && updates.status && currentAppointment.status !== updates.status) {
            await notifyLeadAboutAppointmentStatus({
                supabase,
                appointment: { ...currentAppointment, ...updates },
                status: updates.status,
            }).catch(error => {
                console.warn('[Appointments] Lead notification failed:', error?.message || error)
            })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Appointments] PUT error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
