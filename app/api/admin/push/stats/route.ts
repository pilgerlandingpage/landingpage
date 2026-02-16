import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
    try {
        const supabase = createAdminClient()

        const { count: activeCount } = await supabase
            .from('push_subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('active', true)

        const { count: totalCount } = await supabase
            .from('push_subscriptions')
            .select('*', { count: 'exact', head: true })

        return NextResponse.json({
            active: activeCount || 0,
            total: totalCount || 0
        })
    } catch (error) {
        console.error('[Push Stats] Error:', error)
        return NextResponse.json({ active: 0, total: 0 })
    }
}
