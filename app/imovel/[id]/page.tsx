import { notFound, redirect } from 'next/navigation'
import { createAdminClient, createSupabaseAbortSignal, summarizeSupabaseError } from '@/lib/supabase/server'
import { extractPropertyIdFromSeoSlug } from '@/lib/properties/seo-url'
import { propertyDetailsPath } from '@/lib/properties/responsive-destination'

export { generateMetadata } from './detalhes/page'

export const revalidate = 300

export function generateStaticParams() {
    return []
}

type PageProps = {
    params: Promise<{ id: string }>
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PROPERTY_REDIRECT_LOOKUP_TIMEOUT_MS = 10000
const PROPERTY_REDIRECT_RETRY_DELAYS_MS = [300, 900, 1600]
const PROPERTY_REDIRECT_SELECT = 'id, source_slug, source_reference, title, seo_title, city, neighborhood, property_type'

function isRetriablePropertyRedirectError(error: unknown) {
    const summary = summarizeSupabaseError(error).toLowerCase()
    return (
        summary.includes('fetch failed') ||
        summary.includes('timeout') ||
        summary.includes('aborted') ||
        summary.includes('connection terminated') ||
        summary.includes('522') ||
        summary.includes('503') ||
        summary.includes('504')
    )
}

function waitForPropertyRedirectRetry(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export default async function PropertyPage({ params }: PageProps) {
    const { id } = await params
    const identifier = decodeURIComponent(id || '').trim()
    const idFromSeoSlug = extractPropertyIdFromSeoSlug(identifier)

    let property = null
    for (let attempt = 0; attempt <= PROPERTY_REDIRECT_RETRY_DELAYS_MS.length; attempt += 1) {
        const supabase = createAdminClient()
        const query = () => supabase
            .from('properties')
            .select(PROPERTY_REDIRECT_SELECT)

        let data = null
        let error = null

        if (idFromSeoSlug || UUID_PATTERN.test(identifier)) {
            const result = await query()
                .eq('id', idFromSeoSlug || identifier)
                .abortSignal(createSupabaseAbortSignal(PROPERTY_REDIRECT_LOOKUP_TIMEOUT_MS))
                .maybeSingle()

            data = result.data
            error = result.error
        } else {
            const sourceReferenceResult = await query()
                .eq('source_reference', identifier)
                .limit(1)
                .abortSignal(createSupabaseAbortSignal(PROPERTY_REDIRECT_LOOKUP_TIMEOUT_MS))
                .maybeSingle()

            if (sourceReferenceResult.error || sourceReferenceResult.data) {
                data = sourceReferenceResult.data
                error = sourceReferenceResult.error
            } else {
                const sourceSlugResult = await query()
                    .eq('source_slug', identifier)
                    .limit(1)
                    .abortSignal(createSupabaseAbortSignal(PROPERTY_REDIRECT_LOOKUP_TIMEOUT_MS))
                    .maybeSingle()

                data = sourceSlugResult.data
                error = sourceSlugResult.error
            }
        }

        if (!error) {
            property = data || null
            break
        }

        const canRetry = attempt < PROPERTY_REDIRECT_RETRY_DELAYS_MS.length && isRetriablePropertyRedirectError(error)
        if (!canRetry) {
            console.error('[Property Redirect] property lookup failed:', summarizeSupabaseError(error))
            throw new Error('Nao foi possivel carregar este imovel agora.')
        }

        await waitForPropertyRedirectRetry(PROPERTY_REDIRECT_RETRY_DELAYS_MS[attempt])
    }

    if (!property) return notFound()

    redirect(propertyDetailsPath(property))
}
