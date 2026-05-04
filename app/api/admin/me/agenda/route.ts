import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

type AvailabilityInput = {
    weekday: number
    start_time: string
    end_time: string
    slot_minutes?: number
    is_active: boolean
}

const DEFAULT_WEEK = [
    { weekday: 0, label: 'Domingo', start_time: '09:00', end_time: '18:00', slot_minutes: 60, is_active: false },
    { weekday: 1, label: 'Segunda', start_time: '09:00', end_time: '18:00', slot_minutes: 60, is_active: true },
    { weekday: 2, label: 'Terca', start_time: '09:00', end_time: '18:00', slot_minutes: 60, is_active: true },
    { weekday: 3, label: 'Quarta', start_time: '09:00', end_time: '18:00', slot_minutes: 60, is_active: true },
    { weekday: 4, label: 'Quinta', start_time: '09:00', end_time: '18:00', slot_minutes: 60, is_active: true },
    { weekday: 5, label: 'Sexta', start_time: '09:00', end_time: '18:00', slot_minutes: 60, is_active: true },
    { weekday: 6, label: 'Sabado', start_time: '09:00', end_time: '13:00', slot_minutes: 60, is_active: false },
]

function cleanTime(value: unknown, fallback: string) {
    const text = String(value || '').trim()
    return /^\d{2}:\d{2}$/.test(text) ? text : fallback
}

function cleanSlotMinutes(value: unknown) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return 60
    return Math.min(240, Math.max(15, Math.round(parsed)))
}

async function getSessionAdminUser() {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { adminUser: null, error: 'Nao autorizado' }

    const admin = createAdminClient()
    const { data: adminUser, error } = await admin
        .from('admin_users')
        .select('id, name, email, phone, whatsapp_instance_id')
        .eq('auth_user_id', user.id)
        .single()

    if (error || !adminUser) return { adminUser: null, error: 'Usuario nao encontrado' }
    return { adminUser, error: null }
}

async function getBrokerIdsForUser(admin: any, adminUser: any) {
    const ids = new Set<string>()
    const { data: instances } = await admin
        .from('whatsapp_instances')
        .select('id, broker_id')
        .eq('admin_user_id', adminUser.id)

    for (const instance of instances || []) {
        if (instance?.broker_id) ids.add(instance.broker_id)
    }

    if (adminUser.whatsapp_instance_id) {
        const { data: selected } = await admin
            .from('whatsapp_instances')
            .select('broker_id')
            .eq('id', adminUser.whatsapp_instance_id)
            .maybeSingle()
        if (selected?.broker_id) ids.add(selected.broker_id)
    }

    return [...ids]
}

function mergeAvailability(rows: any[]) {
    const byWeekday = new Map<number, any>()
    for (const row of rows || []) {
        byWeekday.set(Number(row.weekday), row)
    }

    return DEFAULT_WEEK.map((day) => {
        const row = byWeekday.get(day.weekday)
        return {
            ...day,
            id: row?.id || null,
            start_time: String(row?.start_time || day.start_time).slice(0, 5),
            end_time: String(row?.end_time || day.end_time).slice(0, 5),
            slot_minutes: row?.slot_minutes || day.slot_minutes,
            is_active: typeof row?.is_active === 'boolean' ? row.is_active : day.is_active,
        }
    })
}

export async function GET() {
    try {
        const { adminUser, error } = await getSessionAdminUser()
        if (error === 'Nao autorizado') {
            return NextResponse.json({ success: false, message: error }, { status: 401 })
        }
        if (!adminUser) {
            return NextResponse.json({ success: false, message: error || 'Usuario nao encontrado' }, { status: 404 })
        }

        const admin = createAdminClient()
        const brokerIds = await getBrokerIdsForUser(admin, adminUser)
        const primaryBrokerId = brokerIds[0] || null

        let availabilityRows: any[] = []
        if (primaryBrokerId) {
            const { data } = await admin
                .from('broker_weekly_availability')
                .select('*')
                .eq('broker_id', primaryBrokerId)
                .order('weekday')
            availabilityRows = data || []
        }

        if (availabilityRows.length === 0) {
            const { data } = await admin
                .from('broker_weekly_availability')
                .select('*')
                .eq('admin_user_id', adminUser.id)
                .order('weekday')
            availabilityRows = data || []
        }

        const today = new Date()
        const to = new Date()
        to.setDate(today.getDate() + 45)
        const fromDate = today.toISOString().split('T')[0]
        const toDate = to.toISOString().split('T')[0]

        let appointmentsQuery = admin
            .from('appointments')
            .select('*')
            .gte('appointment_date', fromDate)
            .lte('appointment_date', toDate)
            .neq('status', 'cancelled')
            .order('appointment_date', { ascending: true })
            .order('appointment_time', { ascending: true })
            .limit(30)

        if (brokerIds.length > 0) {
            appointmentsQuery = appointmentsQuery.in('broker_id', brokerIds)
        } else {
            appointmentsQuery = appointmentsQuery.eq('admin_user_id', adminUser.id)
        }

        const [{ data: blocks }, { data: appointments }] = await Promise.all([
            primaryBrokerId
                ? admin
                    .from('broker_schedule_blocks')
                    .select('*')
                    .eq('broker_id', primaryBrokerId)
                    .gte('block_date', fromDate)
                    .lte('block_date', toDate)
                    .order('block_date', { ascending: true })
                : admin
                    .from('broker_schedule_blocks')
                    .select('*')
                    .eq('admin_user_id', adminUser.id)
                    .gte('block_date', fromDate)
                    .lte('block_date', toDate)
                    .order('block_date', { ascending: true }),
            appointmentsQuery,
        ])

        return NextResponse.json({
            success: true,
            agenda: {
                admin_user_id: adminUser.id,
                broker_id: primaryBrokerId,
                availability: mergeAvailability(availabilityRows),
                blocks: blocks || [],
                appointments: appointments || [],
            },
        })
    } catch (err: any) {
        console.error('[Admin Me Agenda GET]', err)
        return NextResponse.json({ success: false, message: err.message }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const { adminUser, error } = await getSessionAdminUser()
        if (error === 'Nao autorizado') {
            return NextResponse.json({ success: false, message: error }, { status: 401 })
        }
        if (!adminUser) {
            return NextResponse.json({ success: false, message: error || 'Usuario nao encontrado' }, { status: 404 })
        }

        const admin = createAdminClient()
        const brokerIds = await getBrokerIdsForUser(admin, adminUser)
        const primaryBrokerId = brokerIds[0] || null
        const body = await request.json()
        const availability = Array.isArray(body?.availability) ? body.availability : []
        const now = new Date().toISOString()

        for (const item of availability as AvailabilityInput[]) {
            const weekday = Number(item.weekday)
            if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) continue

            const payload = {
                admin_user_id: adminUser.id,
                broker_id: primaryBrokerId,
                weekday,
                start_time: cleanTime(item.start_time, '09:00'),
                end_time: cleanTime(item.end_time, '18:00'),
                slot_minutes: cleanSlotMinutes(item.slot_minutes),
                is_active: item.is_active === true,
                updated_at: now,
            }

            let query = admin
                .from('broker_weekly_availability')
                .select('id')
                .eq('admin_user_id', adminUser.id)
                .eq('weekday', weekday)
                .limit(1)

            query = primaryBrokerId ? query.eq('broker_id', primaryBrokerId) : query.is('broker_id', null)
            const { data: existing } = await query
            const existingId = existing?.[0]?.id

            if (existingId) {
                const { error: updateError } = await admin
                    .from('broker_weekly_availability')
                    .update(payload)
                    .eq('id', existingId)
                if (updateError) throw updateError
            } else {
                const { error: insertError } = await admin
                    .from('broker_weekly_availability')
                    .insert([{ ...payload, created_at: now }])
                if (insertError) throw insertError
            }
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('[Admin Me Agenda POST]', err)
        return NextResponse.json({ success: false, message: err.message }, { status: 500 })
    }
}
