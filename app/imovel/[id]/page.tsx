import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
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

export default async function PropertyPage({ params }: PageProps) {
    const { id } = await params
    const identifier = decodeURIComponent(id || '').trim()
    const idFromSeoSlug = extractPropertyIdFromSeoSlug(identifier)
    const supabase = createAdminClient()
    const query = supabase
        .from('properties')
        .select('id, source_slug, title, seo_title, city, neighborhood, property_type')

    const { data: property } = idFromSeoSlug || UUID_PATTERN.test(identifier)
        ? await query.eq('id', idFromSeoSlug || identifier).maybeSingle()
        : await query.eq('source_slug', identifier).limit(1).maybeSingle()

    if (!property) return notFound()

    redirect(propertyDetailsPath(property))
}
