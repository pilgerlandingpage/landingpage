import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getGoogleOrganicAnalytics } from '@/lib/analytics/google'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const days = Number(searchParams.get('days') || 28)
        const result = await getGoogleOrganicAnalytics({
            days,
            supabase: createAdminClient(),
        })

        return NextResponse.json({ success: true, ...result })
    } catch (error: any) {
        console.error('Error fetching Google Analytics data:', error)
        return NextResponse.json(
            { success: false, error: error?.message || 'Erro ao buscar dados do Google Analytics.' },
            { status: 500 }
        )
    }
}
