import { NextResponse } from 'next/server'
import { getCachedHomepageGoogleReviews, GOOGLE_REVIEWS_REVALIDATE_SECONDS } from '@/lib/google-reviews'
import { createAdminClient, createSupabaseAbortSignal, summarizeSupabaseError } from '@/lib/supabase/server'

export const revalidate = GOOGLE_REVIEWS_REVALIDATE_SECONDS

export async function GET() {
    const configMap: Record<string, string> = {}
    let supabase: ReturnType<typeof createAdminClient> | undefined

    try {
        supabase = createAdminClient()
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

    const reviews = await getCachedHomepageGoogleReviews(configMap, supabase)
    return NextResponse.json(
        { data: reviews },
        {
            headers: {
                'Cache-Control': `public, max-age=600, s-maxage=${GOOGLE_REVIEWS_REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
            },
        }
    )
}
