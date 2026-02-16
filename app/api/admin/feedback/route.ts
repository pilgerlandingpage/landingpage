import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET — List all feedback (ordered by newest first)
export async function GET() {
    try {
        const supabase = createAdminClient()
        const { data, error } = await supabase
            .from('user_feedback')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) throw error

        return NextResponse.json({ success: true, data: data || [] })
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    }
}

// PATCH — Update feedback status
export async function PATCH(req: NextRequest) {
    try {
        const { id, status } = await req.json()

        if (!id || !status) {
            return NextResponse.json({ success: false, message: 'id and status are required' }, { status: 400 })
        }

        if (!['novo', 'lido', 'resolvido'].includes(status)) {
            return NextResponse.json({ success: false, message: 'Invalid status' }, { status: 400 })
        }

        const supabase = createAdminClient()
        const { error } = await supabase
            .from('user_feedback')
            .update({ status })
            .eq('id', id)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    }
}
