import { createAdminClient } from '@/lib/supabase/server'
import { corretorNota8Content, corretorNota8Offer } from '@/lib/products/corretor-nota-8-content'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type LandingPageType = 'development' | 'product'

function text(value: unknown, fallback = '') {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function numberValue(value: unknown, fallback = 0) {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
        if (Number.isFinite(parsed)) return parsed
    }
    return fallback
}

function stringList(value: unknown) {
    if (Array.isArray(value)) {
        return value.map(item => text(item)).filter(Boolean)
    }

    if (typeof value === 'string') {
        return value
            .split(/\r?\n|,/)
            .map(item => item.trim())
            .filter(Boolean)
    }

    return []
}

function objectList(value: unknown) {
    if (!Array.isArray(value)) return []
    return value.filter(item => item && typeof item === 'object' && !Array.isArray(item))
}

function landingPageType(value: unknown): LandingPageType {
    return value === 'product' ? 'product' : 'development'
}

export async function GET() {
    try {
        const supabase = createAdminClient()
        const { data, error } = await supabase
            .from('landing_pages')
            .select('id, slug, title, status, page_type')
            .order('title')

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json({ data: data || [] })
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabase = createAdminClient()
        const body = await req.json()

        const page_type = landingPageType(body?.page_type)
        const title = text(body?.title)
        const slug = text(body?.slug)
        const template = text(
            body?.template,
            page_type === 'product' ? 'corretor-nota-8' : 'classic',
        )
        const description = text(body?.description)
        const heroImage = text(body?.heroImage ?? body?.hero_image)
        const price = text(body?.price, page_type === 'product' ? corretorNota8Offer.priceDisplay : '')
        const location = text(body?.location)
        const bedrooms = numberValue(body?.bedrooms)
        const bathrooms = numberValue(body?.bathrooms)
        const area = numberValue(body?.area)
        const amenities = stringList(body?.amenities)
        const gallery = Array.isArray(body?.gallery) ? body.gallery : stringList(body?.gallery)
        const ai_context = text(body?.ai_context)

        if (!title || !slug || !template) {
            return NextResponse.json({ error: 'Titulo, slug e template sao obrigatorios.' }, { status: 400 })
        }

        const { data: existing, error: existingError } = await supabase
            .from('landing_pages')
            .select('id')
            .eq('slug', slug)
            .maybeSingle()

        if (existingError) {
            return NextResponse.json({ error: existingError.message }, { status: 400 })
        }

        if (existing) {
            return NextResponse.json({ error: 'Este slug ja esta em uso.' }, { status: 409 })
        }

        const content = page_type === 'product'
            ? {
                template,
                custom_title: title,
                custom_description: description || corretorNota8Content.description,
                custom_hero_image: heroImage || corretorNota8Content.coverImage,
                custom_price: price || corretorNota8Offer.priceDisplay,
                custom_cta: text(body?.cta, corretorNota8Offer.primaryCtaLabel),
                product: {
                    name: text(body?.productName ?? body?.product_name, title || corretorNota8Offer.productName),
                    subtitle: text(body?.subtitle, corretorNota8Content.subtitle),
                    badge: text(body?.badge, corretorNota8Content.badge),
                    author: text(body?.author, corretorNota8Offer.author),
                    author_bio: text(body?.authorBio ?? body?.author_bio, corretorNota8Content.authorBio),
                    author_quote: text(body?.authorQuote ?? body?.author_quote, corretorNota8Content.authorQuote),
                    checkout_url: text(body?.checkoutUrl ?? body?.checkout_url, corretorNota8Offer.checkoutUrl),
                    preview_url: text(body?.previewUrl ?? body?.preview_url),
                    cover_image: heroImage || corretorNota8Content.coverImage,
                    price: price || corretorNota8Offer.priceDisplay,
                    cta: text(body?.cta, corretorNota8Offer.primaryCtaLabel),
                    trust_items: corretorNota8Content.trustItems,
                    problems: objectList(body?.problems).length ? objectList(body?.problems) : corretorNota8Content.problems,
                    benefits: objectList(body?.benefits).length
                        ? objectList(body?.benefits)
                        : (amenities.length ? amenities : corretorNota8Content.benefits),
                    dimensions: objectList(body?.dimensions).length ? objectList(body?.dimensions) : corretorNota8Content.dimensions,
                    included: objectList(body?.included ?? body?.book_contents).length
                        ? objectList(body?.included ?? body?.book_contents)
                        : corretorNota8Content.included,
                    modules: objectList(body?.modules),
                    testimonials: objectList(body?.testimonials),
                    faq: objectList(body?.faq).length ? objectList(body?.faq) : corretorNota8Content.faq,
                    stats: objectList(body?.stats),
                },
                seo: {
                    title,
                    description: description || 'Conheca o Corretor Nota 8, o livro digital de Guilherme Pilger para corretores que querem metodo, posicionamento e disciplina.',
                    image: heroImage || corretorNota8Content.coverImage,
                },
            }
            : {
                template,
                custom_title: title,
                custom_description: description || '',
                custom_hero_image: heroImage || '',
                custom_price: price || 'Consulte',
                custom_cta: 'Fale com um Consultor',
                custom_stats: {
                    bedrooms,
                    bathrooms,
                    area,
                    location: location || 'Localizacao Privilegiada',
                },
                custom_features: amenities,
                custom_gallery: gallery,
            }

        const { data, error } = await supabase
            .from('landing_pages')
            .insert({
                title,
                slug,
                page_type,
                content,
                ai_context: ai_context || null,
                status: 'published',
                primary_color: page_type === 'product' ? '#c8a25a' : '#948369',
            })
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
