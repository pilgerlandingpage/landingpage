import { NextResponse } from 'next/server'
import { getHomepageGoogleReviews } from '@/lib/google-reviews'
import { createAdminClient, createSupabaseAbortSignal, summarizeSupabaseError } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
    const configMap: Record<string, string> = {}

    try {
        const supabase = createAdminClient()
        const { data, error } = await supabase
            .from('app_config')
            .select('key, value')
            .like('key', 'homepage_google_%')
            .abortSignal(createSupabaseAbortSignal(8000))

        if (error) {
            console.warn('[Public Google Reviews] config unavailable:', summarizeSupabaseError(error))
        }

        const rows = data || []
        rows.forEach((row: any) => {
            if (row?.key) configMap[row.key] = String(row.value || '')
        })
    } catch (error) {
        console.warn('[Public Google Reviews] config unavailable:', summarizeSupabaseError(error))
    }

    const reviews = await getHomepageGoogleReviews(configMap)
    return NextResponse.json({ data: reviews })
}
