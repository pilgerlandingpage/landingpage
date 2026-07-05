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

    if (ids.length === 0 && slugs.length === 0) {
        return NextResponse.json({ properties: [] })
    }

    const supabase = await createServerSupabase()
    let query = supabase
        .from('properties')
        .select(PUBLIC_PROPERTY_SELECT)
        .eq('status', 'active')

    query = ids.length > 0 ? query.in('id', ids) : query.in('source_slug', slugs)

    const { data, error } = await query

    if (error) {
        return NextResponse.json({ properties: [], error: 'Nao foi possivel carregar os imoveis.' }, { status: 500 })
    }

    return NextResponse.json({ properties: data || [] })
}
