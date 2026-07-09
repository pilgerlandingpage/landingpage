import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// Keys used for homepage configuration
const HOMEPAGE_CONFIG_KEYS = [
    'homepage_featured_ids',        // JSON array of property IDs for "Oportunidades"
    'homepage_featured_title',      // Custom title for featured section
    'homepage_sections_enabled',    // JSON array of enabled section keys
    'homepage_featured_cities',     // JSON array of city names
    'homepage_items_per_section',   // Number of items per section
    'homepage_featured_min_price',  // Minimum price filter for featured
    'homepage_featured_max_price',  // Maximum price filter for featured
    'homepage_featured_sort',       // Sort order: price-desc, price-asc, newest, manual
    'homepage_google_reviews_enabled',
    'homepage_google_reviews_place_id',
    'homepage_google_reviews_url',
    'homepage_google_maps_url',
]

const DEFAULTS: Record<string, string> = {
    homepage_featured_ids: '[]',
    homepage_featured_title: 'Oportunidades',
    homepage_sections_enabled: '["featured","newest","cta"]',
    homepage_featured_cities: '["Balneário Camboriú","Itajaí","Itapema","Porto Belo"]',
    homepage_items_per_section: '8',
    homepage_featured_min_price: '0',
    homepage_featured_max_price: '0',
    homepage_featured_sort: 'price-desc',
    homepage_google_reviews_enabled: 'true',
    homepage_google_reviews_place_id: 'ChIJ7Y5_0DW32JQRatagLzFhcJc',
    homepage_google_reviews_url: '',
    homepage_google_maps_url: '',
}

export async function GET() {
    try {
        const supabase = getSupabase()
        const { data, error } = await supabase
            .from('app_config')
            .select('key, value')
            .in('key', HOMEPAGE_CONFIG_KEYS)

        if (error) {
            return NextResponse.json({ success: false, message: error.message }, { status: 500 })
        }

        // Merge defaults with stored values
        const config: Record<string, string> = { ...DEFAULTS }
        data?.forEach((item: { key: string; value: string }) => {
            if (item.value !== null && item.value !== undefined) {
                config[item.key] = item.value
            }
        })

        // Also fetch properties list for the selector (only id, title, city, price)
        const { data: properties } = await supabase
            .from('properties')
            .select('id, title, city, price, main_image_url')
            .eq('status', 'active')
            .order('price', { ascending: false })
            .limit(500)

        return NextResponse.json({
            success: true,
            config,
            properties: properties || [],
        })
    } catch (error) {
        console.error('Homepage config load error:', error)
        return NextResponse.json({ success: false, message: 'Erro ao carregar' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const { config } = await request.json() as { config: Record<string, string> }
        const supabase = getSupabase()

        const entries = Object.entries(config)
            .filter(([key]) => HOMEPAGE_CONFIG_KEYS.includes(key))
            .map(([key, value]) => ({
                key,
                value: String(value),
                updated_at: new Date().toISOString(),
            }))

        if (entries.length === 0) {
            return NextResponse.json({ success: false, message: 'Nenhuma configuração válida' }, { status: 400 })
        }

        const { error } = await supabase
            .from('app_config')
            .upsert(entries, { onConflict: 'key' })

        if (error) {
            return NextResponse.json({ success: false, message: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Configurações da homepage salvas!' })
    } catch (error) {
        console.error('Homepage config save error:', error)
        return NextResponse.json({ success: false, message: 'Erro ao salvar' }, { status: 500 })
    }
}
