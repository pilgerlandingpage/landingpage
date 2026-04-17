import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// GET — List all leads with collected data
export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        const search = searchParams.get('search')
        const limit = parseInt(searchParams.get('limit') || '50')

        let query = supabase
            .from('lead_collected_data')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(limit)

        if (status && status !== 'all') {
            query = query.eq('status', status)
        }

        if (search) {
            query = query.or(`lead_name.ilike.%${search}%,lead_phone.ilike.%${search}%,region.ilike.%${search}%`)
        }

        const { data, error } = await query

        if (error) throw error

        return NextResponse.json({ success: true, leads: data || [] })
    } catch (error) {
        console.error('[Lead CRM] GET error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

// PUT — Update lead status or notes
export async function PUT(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const body = await request.json()
        const { id, ...updates } = body

        if (!id) {
            return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 })
        }

        updates.updated_at = new Date().toISOString()

        const { error } = await supabase
            .from('lead_collected_data')
            .update(updates)
            .eq('id', id)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Lead CRM] PUT error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
