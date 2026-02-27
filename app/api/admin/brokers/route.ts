import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST - Create broker
export async function POST(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        const body = await request.json()

        const { data, error } = await supabase
            .from('virtual_brokers')
            .insert([body])
            .select()
            .single()

        if (error) {
            console.error('Insert broker error:', error)
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json({ data })
    } catch (err) {
        console.error('API error:', err)
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}

// PUT - Update broker
export async function PUT(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        const body = await request.json()
        const { id, ...updates } = body

        if (!id) {
            return NextResponse.json({ error: 'Missing broker id' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('virtual_brokers')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            console.error('Update broker error:', error)
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json({ data })
    } catch (err) {
        console.error('API error:', err)
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}
