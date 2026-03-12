import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET — fetch all metric snapshots for a campaign
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const supabase = createAdminClient()

        const { data, error } = await supabase
            .from('ad_metrics_snapshots')
            .select('*')
            .eq('campaign_id', id)
            .order('snapshot_at', { ascending: true })

        if (error) throw error
        return NextResponse.json(data || [])
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
