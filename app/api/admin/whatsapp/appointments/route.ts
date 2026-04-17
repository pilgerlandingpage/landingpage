import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
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

        if (updates.status === 'confirmed') updates.confirmed_at = new Date().toISOString()
        if (updates.status === 'cancelled') updates.cancelled_at = new Date().toISOString()

        const { error } = await supabase
            .from('appointments')
            .update(updates)
            .eq('id', id)

        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Appointments] PUT error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
