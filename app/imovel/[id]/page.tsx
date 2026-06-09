import { notFound, redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase/server'

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

export default async function PropertyPage({ params, searchParams }: PageProps) {
    const { id } = await params
    const supabase = await createServerSupabase()
    const { data: property } = await supabase
        .from('properties')
        .select('id')
        .eq('id', id)
        .maybeSingle()

    if (!property) return notFound()

    const query = serializeSearchParams(searchParams ? await searchParams : undefined)
    redirect(`/imovel/${encodeURIComponent(id)}/detalhes${query}`)
}
