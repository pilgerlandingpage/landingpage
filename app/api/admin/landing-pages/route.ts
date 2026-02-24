import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    try {
        const supabase = createAdminClient()
        const body = await req.json()

        const { title, slug, template, description, heroImage, price, location, bedrooms, bathrooms, area, amenities, gallery } = body

        if (!title || !slug || !template) {
            return NextResponse.json({ error: 'Título, slug e template são obrigatórios.' }, { status: 400 })
        }

        // Check if slug is available
        const { data: existing } = await supabase
            .from('landing_pages')
            .select('id')
            .eq('slug', slug)
            .single()

        if (existing) {
            return NextResponse.json({ error: 'Este slug já está em uso.' }, { status: 409 })
        }

        const content = {
            template,
            custom_title: title,
            custom_description: description || '',
            custom_hero_image: heroImage || '',
            custom_price: price || 'Consulte',
            custom_cta: 'Fale com um Consultor',
            custom_stats: {
                bedrooms: bedrooms || 0,
                bathrooms: bathrooms || 0,
                area: area || 0,
                location: location || 'Localização Privilegiada',
            },
            custom_features: amenities || [],
            custom_gallery: gallery || [],
        }

        const { data, error } = await supabase
            .from('landing_pages')
            .insert({ title, slug, content, status: 'published', primary_color: '#948369' })
            .select()
            .single()

        if (error) {
            console.error('Error creating landing page:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, data })
    } catch (err: any) {
        console.error('Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
