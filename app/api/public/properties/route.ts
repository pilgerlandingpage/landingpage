import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

const MAX_PUBLIC_PROPERTIES = 80

const PUBLIC_PROPERTY_SELECT = [
    'id',
    'title',
    'seo_title',
    'city',
    'state',
    'neighborhood',
    'price',
    'bedrooms',
    'bathrooms',
    'suites',
    'parking_spaces',
    'area_m2',
    'area_private_m2',
    'featured_image',
    'images',
    'source_slug',
    'source_reference',
    'property_type',
    'exclusive',
    'source_status',
    'description',
    'amenities',
    'latitude',
    'longitude',
    'created_at',
    'updated_at',
].join(',')

type PublicPropertyRow = { id?: string } & Record<string, unknown>

export async function GET(req: NextRequest) {
    const ids = (req.nextUrl.searchParams.get('ids') || '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean)
        .slice(0, MAX_PUBLIC_PROPERTIES)
    const slugs = (req.nextUrl.searchParams.get('slugs') || '')
        .split(',')
        .map(slug => slug.trim())
        .filter(Boolean)
        .slice(0, MAX_PUBLIC_PROPERTIES)
    const sourceRefs = (req.nextUrl.searchParams.get('source_refs') || '')
        .split(',')
        .map(sourceRef => sourceRef.trim())
        .filter(Boolean)
        .slice(0, MAX_PUBLIC_PROPERTIES)

    if (ids.length === 0 && slugs.length === 0 && sourceRefs.length === 0) {
        return NextResponse.json({ properties: [] })
    }

    const supabase = await createServerSupabase()
    const propertiesById = new Map<string, unknown>()

    async function fetchPropertiesBy(field: 'id' | 'source_reference' | 'source_slug', values: string[]) {
        if (!values.length) return null

        return supabase
            .from('properties')
            .select(PUBLIC_PROPERTY_SELECT)
            .eq('status', 'active')
            .in(field, values)
    }

    for (const result of await Promise.all([
        fetchPropertiesBy('id', ids),
        fetchPropertiesBy('source_reference', sourceRefs),
        fetchPropertiesBy('source_slug', slugs),
    ])) {
        if (!result) continue

        const { data, error } = result
        if (error) {
            return NextResponse.json({ properties: [], error: 'Nao foi possivel carregar os imoveis.' }, { status: 500 })
        }

        const properties = (data || []) as unknown as PublicPropertyRow[]
        for (const property of properties) {
            if (property?.id) propertiesById.set(property.id, property)
        }
    }

    return NextResponse.json({ properties: Array.from(propertiesById.values()) })
}
