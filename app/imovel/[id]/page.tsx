import { notFound, redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'
import { extractPropertyIdFromSeoSlug } from '@/lib/properties/seo-url'
import { propertyDetailsPath } from '@/lib/properties/responsive-destination'

export { generateMetadata } from './detalhes/page'

export const dynamic = 'force-dynamic'

type PageProps = {
    params: Promise<{ id: string }>
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function serializeSearchParams(searchParams: Record<string, string | string[] | undefined> | undefined) {
    const params = new URLSearchParams()

    for (const [key, value] of Object.entries(searchParams || {})) {
        if (Array.isArray(value)) {
            value.forEach(item => {
                if (item !== undefined) params.append(key, item)
            })
            continue
        }

        if (value !== undefined) params.set(key, value)
    }

    const query = params.toString()
    return query ? `?${query}` : ''
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function PropertyPage({ params, searchParams }: PageProps) {
    const { id } = await params
    const identifier = decodeURIComponent(id || '').trim()
    const idFromSeoSlug = extractPropertyIdFromSeoSlug(identifier)
    const supabase = await createServerSupabase()
    const query = supabase
        .from('properties')
        .select('id, source_slug, title, seo_title, city, neighborhood, property_type')

    const { data: property } = idFromSeoSlug || UUID_PATTERN.test(identifier)
        ? await query.eq('id', idFromSeoSlug || identifier).maybeSingle()
        : await query.eq('source_slug', identifier).limit(1).maybeSingle()

    if (!property) return notFound()

    const search = serializeSearchParams(searchParams ? await searchParams : undefined)
    redirect(`${propertyDetailsPath(property)}${search}`)
}
