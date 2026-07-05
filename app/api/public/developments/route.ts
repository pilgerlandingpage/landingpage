import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type PublicDevelopment = {
    slug: string
    name: string
    locationName: string
    priceRange: string
    availableUnitsCount: number | null
    heroImage: string
}

function asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function asText(value: unknown, fallback = '') {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function asNumber(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }
    return null
}

function firstImageFromGallery(content: Record<string, any>) {
    const customGallery = Array.isArray(content.custom_gallery) ? content.custom_gallery : []
    const developmentGallery = Array.isArray(asRecord(content.development).gallery) ? asRecord(content.development).gallery : []
    const gallery = [...customGallery, ...developmentGallery]

    for (const item of gallery) {
        const image = asText(asRecord(item).image)
        if (image) return image
    }

    return '/placeholder-house.jpg'
}

function normalizeDevelopment(page: Record<string, any>): PublicDevelopment | null {
    const content = asRecord(page.content)
    if (content.template && content.template !== 'brava-concetto') return null

    const development = asRecord(content.development)
    const slug = asText(page.slug)
    if (!slug) return null
    const isBravaConcetto = slug === 'bravaconceto'

    const name = asText(
        development.name,
        isBravaConcetto ? 'Brava Concetto' : asText(content.custom_title, asText(page.title, 'Empreendimento'))
    )

    return {
        slug,
        name,
        locationName: asText(development.locationName ?? development.location_name, isBravaConcetto ? 'Praia Brava, Itajai - SC' : 'Litoral catarinense'),
        priceRange: asText(development.priceRange ?? development.price_range, isBravaConcetto ? 'R$ 8.600.000 a R$ 21.000.000' : 'Consultar valores'),
        availableUnitsCount: asNumber(development.availableUnitsCount ?? development.available_units_count ?? content.available_units_count) ?? (isBravaConcetto ? 3 : null),
        heroImage: isBravaConcetto
            ? asText(development.heroImage ?? development.hero_image, '/images/brava-concetto/1_CL_BC_FACHADA_DIURNA_R01.jpg')
            : asText(development.heroImage ?? development.hero_image ?? content.custom_hero_image, firstImageFromGallery(content)),
    }
}

export async function GET() {
    try {
        const supabase = createAdminClient()
        const { data, error } = await supabase
            .from('landing_pages')
            .select('id, slug, title, content, created_at')
            .eq('status', 'published')
            .order('created_at', { ascending: true })

        if (error) {
            return NextResponse.json({ developments: [], error: 'Nao foi possivel carregar os empreendimentos.' }, { status: 500 })
        }

        const pages = (data || []) as Array<Record<string, any>>
        const developments = pages
            .map(page => normalizeDevelopment(page))
            .filter((item: PublicDevelopment | null): item is PublicDevelopment => Boolean(item))
            .sort((a, b) => {
                if (a.slug === 'bravaconceto') return -1
                if (b.slug === 'bravaconceto') return 1
                return a.name.localeCompare(b.name, 'pt-BR')
            })

        return NextResponse.json({ developments })
    } catch {
        return NextResponse.json({ developments: [] })
    }
}
