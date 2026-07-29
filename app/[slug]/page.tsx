import { createAdminClient, createSupabaseAbortSignal, summarizeSupabaseError } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import ClassicTemplate from '@/components/templates/ClassicTemplate'
import ModernLuxuryTemplate from '@/components/templates/ModernLuxuryTemplate'
import LeadCaptureTemplate from '@/components/templates/LeadCaptureTemplate'
import UrgencyTemplate from '@/components/templates/UrgencyTemplate'
import SocialProofTemplate from '@/components/templates/SocialProofTemplate'
import VipExclusiveTemplate from '@/components/templates/VipExclusiveTemplate'
import BravaConcettoTemplate from '@/components/templates/BravaConcettoTemplate'
import ProductSalesTemplate from '@/components/templates/ProductSalesTemplate'
import { corretorNota8Content, corretorNota8Offer } from '@/lib/products/corretor-nota-8-content'
import GlobalHeader from '@/components/layout/GlobalHeader'
import { LandingPageData } from '@/components/templates/types'
import { Metadata } from 'next'
import { JsonLd, absoluteUrl, breadcrumbJsonLd, organizationJsonLd, webPageJsonLd, DEFAULT_OG_IMAGE, faqPageJsonLd, itemListJsonLd } from '@/lib/seo/json-ld'
import { propertyDetailsPath } from '@/lib/properties/responsive-destination'
import { isPublicPriceVisible, maskPublicPriceText } from '@/lib/properties/public-policy'

export const revalidate = 300

export function generateStaticParams() {
    return []
}

const LANDING_LOOKUP_TIMEOUT_MS = 7000
const LANDING_LOOKUP_RETRY_DELAYS_MS = [400]
const LANDING_PAGE_SELECT = `
    id,
    title,
    slug,
    description,
    content,
    metadata,
    page_type,
    primary_color,
    property_id,
    ai_agent_id,
    created_at,
    updated_at
`
const LANDING_PROPERTY_SELECT = `
    id,
    title,
    description,
    images,
    price,
    bedrooms,
    bathrooms,
    area_m2,
    area_private_m2,
    city,
    state,
    neighborhood,
    street
`
const LANDING_AGENT_SELECT = `
    name,
    greeting_message
`

type LandingLookupResult = {
    data: Record<string, any> | null
    unavailable: boolean
    stale?: boolean
}

const landingLookupMemoryCache = new Map<string, Record<string, any>>()

function landingLookupCacheKey(slug: string, select: string) {
    return `${slug}:${select.replace(/\s+/g, ' ').trim()}`
}

function isRetriableLandingLookupError(error: unknown) {
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

function waitForLandingLookupRetry(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchLandingPageBySlug(slug: string, select: string): Promise<LandingLookupResult> {
    const cacheKey = landingLookupCacheKey(slug, select)

    for (let attempt = 0; attempt <= LANDING_LOOKUP_RETRY_DELAYS_MS.length; attempt += 1) {
        const supabase = createAdminClient()
        const { data, error } = await supabase
            .from('landing_pages')
            .select(select)
            .eq('slug', slug)
            .abortSignal(createSupabaseAbortSignal(LANDING_LOOKUP_TIMEOUT_MS))
            .maybeSingle()

        if (!error) {
            if (data) landingLookupMemoryCache.set(cacheKey, data as Record<string, any>)
            return { data: (data as Record<string, any> | null) || null, unavailable: false }
        }

        const isRetriable = isRetriableLandingLookupError(error)
        const canRetry = attempt < LANDING_LOOKUP_RETRY_DELAYS_MS.length && isRetriable
        if (!canRetry) {
            const summary = summarizeSupabaseError(error)
            const cached = landingLookupMemoryCache.get(cacheKey)

            if (isRetriable && cached) {
                console.warn('[Landing Page] lookup unavailable, serving cached page:', summary)
                return { data: cached, unavailable: false, stale: true }
            }

            if (isRetriable) {
                console.warn('[Landing Page] lookup temporarily unavailable:', summary)
                return { data: null, unavailable: true }
            }

            console.warn('[Landing Page] lookup failed:', summary)
            throw new Error('Não foi possível carregar esta landing page agora.')
        }

        await waitForLandingLookupRetry(LANDING_LOOKUP_RETRY_DELAYS_MS[attempt])
    }

    return { data: null, unavailable: true }
}

async function fetchOptionalLandingRelation(
    table: 'properties' | 'ai_agents',
    id: unknown,
    select: string,
    label: string,
) {
    const relationId = landingText(id)
    if (!relationId) return null

    try {
        const supabase = createAdminClient()
        const { data, error } = await supabase
            .from(table)
            .select(select)
            .eq('id', relationId)
            .abortSignal(createSupabaseAbortSignal(6000))
            .maybeSingle()

        if (error) throw error
        return data || null
    } catch (error) {
        console.warn(`[Landing Page] optional ${label} lookup unavailable:`, summarizeSupabaseError(error))
        return null
    }
}

function countCurrentLandingSaves(events?: any[] | null) {
    const latestByVisitor = new Map<string, any>()

    for (const event of events || []) {
        const visitorKey = String(event.visitor_id || event.id || '').trim()
        if (!visitorKey || latestByVisitor.has(visitorKey)) continue
        latestByVisitor.set(visitorKey, event)
    }

    return Array.from(latestByVisitor.values())
        .filter(event => ['property_favorited', 'development_favorited'].includes(String(event.event_type || '')))
        .length
}

async function fetchLandingMetrics(landingPageId: unknown) {
    const id = landingText(landingPageId)
    if (!id) return { view_count: 0, save_count: 0 }

    try {
        const supabase = createAdminClient()
        const [viewsResult, savesResult] = await Promise.all([
            supabase
                .from('funnel_events')
                .select('id', { count: 'exact', head: true })
                .eq('landing_page_id', id)
                .in('event_type', ['page_view', 'property_details_landing_viewed'])
                .abortSignal(createSupabaseAbortSignal(3000)),
            supabase
                .from('funnel_events')
                .select('id, visitor_id, event_type, created_at')
                .eq('landing_page_id', id)
                .in('event_type', ['property_favorited', 'property_unfavorited', 'development_favorited', 'development_unfavorited'])
                .order('created_at', { ascending: false })
                .limit(5000)
                .abortSignal(createSupabaseAbortSignal(3000)),
        ])

        if (viewsResult.error) {
            console.warn('[Landing Page] view count unavailable:', viewsResult.error.message)
        }

        if (savesResult.error) {
            console.warn('[Landing Page] save count unavailable:', savesResult.error.message)
        }

        return {
            view_count: viewsResult.count || 0,
            save_count: countCurrentLandingSaves(savesResult.data),
        }
    } catch (error) {
        console.warn('[Landing Page] metrics unavailable:', summarizeSupabaseError(error))
        return { view_count: 0, save_count: 0 }
    }
}

async function fetchHydratedLandingPageBySlug(slug: string): Promise<LandingLookupResult> {
    const lookup = await fetchLandingPageBySlug(slug, LANDING_PAGE_SELECT)
    const lp = lookup.data
    if (!lp) return lookup

    const [property, agent, metrics] = await Promise.all([
        fetchOptionalLandingRelation('properties', (lp as any).property_id, LANDING_PROPERTY_SELECT, 'property'),
        fetchOptionalLandingRelation('ai_agents', (lp as any).ai_agent_id, LANDING_AGENT_SELECT, 'agent'),
        fetchLandingMetrics((lp as any).id),
    ])

    return {
        ...lookup,
        data: {
            ...lp,
            property,
            agent,
            metrics,
        },
    }
}

function landingRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function landingText(value: unknown, fallback = '') {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function landingRedirectSlug(lp: Record<string, any>, content: Record<string, any>, currentSlug: string) {
    const metadata = landingRecord(lp.metadata)
    const target = landingText(
        metadata.redirect_to_slug ??
        metadata.redirectToSlug ??
        content.redirect_to_slug ??
        content.redirectToSlug
    )
    if (!target || target === currentSlug || target === lp.slug) return ''
    return target.replace(/^\/+/, '').split('/').filter(Boolean)[0] || ''
}

function landingNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
        if (Number.isFinite(parsed)) return parsed
    }
    return null
}

function isConsultPrice(value: unknown) {
    return /^consulte/i.test(landingText(value))
}

function isCorretorNota8Content(content: Record<string, any>) {
    const product = landingRecord(content.product)
    const name = landingText(product.name ?? content.custom_title).toLowerCase()
    return content.template === 'corretor-nota-8' || name === 'corretor nota 8'
}

function productPriceDisplay(content: Record<string, any>, product: Record<string, any>, fallback = '') {
    const raw = landingText(content.custom_price ?? product.price, fallback)
    if (isCorretorNota8Content(content) && (!raw || isConsultPrice(raw))) {
        return corretorNota8Offer.priceDisplay
    }
    return raw || fallback
}

function normalizeProductLandingContent(content: Record<string, any>) {
    if (!isCorretorNota8Content(content)) return content

    const product = landingRecord(content.product)
    const price = productPriceDisplay(content, product, corretorNota8Offer.priceDisplay)

    return {
        ...content,
        custom_price: price,
        custom_cta: landingText(content.custom_cta ?? product.cta, corretorNota8Offer.primaryCtaLabel),
        custom_description: landingText(content.custom_description ?? product.description, corretorNota8Content.description),
        custom_hero_image: landingText(content.custom_hero_image ?? product.cover_image, corretorNota8Content.coverImage),
        product: {
            ...product,
            name: landingText(product.name, corretorNota8Offer.productName),
            subtitle: landingText(product.subtitle, corretorNota8Content.subtitle),
            badge: landingText(product.badge, corretorNota8Content.badge),
            author: landingText(product.author, corretorNota8Offer.author),
            author_bio: landingText(product.author_bio, corretorNota8Content.authorBio),
            author_quote: landingText(product.author_quote, corretorNota8Content.authorQuote),
            checkout_url: landingText(product.checkout_url, corretorNota8Offer.checkoutUrl),
            cover_image: landingText(product.cover_image, corretorNota8Content.coverImage),
            price,
            cta: landingText(product.cta, corretorNota8Offer.primaryCtaLabel),
        },
    }
}

function LandingPageUnavailable({ slug }: { slug: string }) {
    return (
        <>
            <GlobalHeader />
            <main style={{
                minHeight: '70vh',
                display: 'grid',
                placeItems: 'center',
                padding: '48px 20px',
                background: '#f7f5ef',
            }}>
                <section style={{
                    width: 'min(100%, 640px)',
                    border: '1px solid rgba(35, 39, 42, 0.12)',
                    borderRadius: 8,
                    background: '#fffdf8',
                    padding: 32,
                    boxShadow: '0 18px 50px rgba(35, 39, 42, 0.08)',
                }}>
                    <span style={{
                        display: 'block',
                        marginBottom: 10,
                        color: '#9a6a22',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                    }}>Página indisponível</span>
                    <h1 style={{
                        margin: '0 0 12px',
                        color: '#23272a',
                        fontSize: 'clamp(1.7rem, 4vw, 2.5rem)',
                        lineHeight: 1.08,
                    }}>Não foi possível carregar esta página agora.</h1>
                    <p style={{
                        margin: 0,
                        color: '#5d6874',
                        lineHeight: 1.6,
                    }}>O banco de dados demorou para responder. Tente novamente em alguns instantes ou continue pela busca de imóveis.</p>
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 12,
                        marginTop: 24,
                    }}>
                        <Link href={`/${slug}`} style={{
                            minHeight: 44,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 6,
                            padding: '0 18px',
                            background: '#171b1f',
                            color: 'white',
                            fontWeight: 800,
                            textDecoration: 'none',
                        }}>Tentar novamente</Link>
                        <Link href="/busca" style={{
                            minHeight: 44,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 6,
                            padding: '0 18px',
                            background: '#c9a15c',
                            color: '#171b1f',
                            fontWeight: 800,
                            textDecoration: 'none',
                        }}>Ver imóveis</Link>
                    </div>
                </section>
            </main>
        </>
    )
}

function firstGalleryImage(content: Record<string, any>, development: Record<string, any>) {
    const galleries = [
        ...(Array.isArray(content.custom_gallery) ? content.custom_gallery : []),
        ...(Array.isArray(development.gallery) ? development.gallery : []),
    ]

    for (const item of galleries) {
        if (typeof item === 'string' && item.trim()) return item.trim()
        const record = landingRecord(item)
        const image = landingText(record.image ?? record.url ?? record.src)
        if (image) return image
    }

    return ''
}

function landingSeo(content: Record<string, any>) {
    return landingRecord(content.seo)
}

function landingPageType(lp: Record<string, any>, content: Record<string, any>): 'development' | 'product' {
    const explicit = landingText(lp.page_type)
    if (explicit === 'product') return 'product'
    if (landingRecord(content.product).name || content.template === 'corretor-nota-8') return 'product'
    return 'development'
}

function landingFaqItems(content: Record<string, any>) {
    const development = landingRecord(content.development)
    const product = landingRecord(content.product)
    const seo = landingSeo(content)
    const sources = [
        development.faq,
        product.faq,
        content.aeo_questions,
        content.aeoQuestions,
        seo.aeo_questions,
        seo.aeoQuestions,
    ]

    const items = sources
        .flatMap(source => Array.isArray(source) ? source : [])
        .map(item => {
            const record = landingRecord(item)
            return {
                question: landingText(record.question ?? record.q ?? record.title),
                answer: landingText(record.answer ?? record.a ?? record.description),
            }
        })
        .filter(item => item.question && item.answer)

    const seen = new Set<string>()
    return items.filter(item => {
        const key = item.question.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
    }).slice(0, 12)
}

function productJsonLd(content: Record<string, any>, path: string, title: string, description: string, heroImage: string) {
    const product = landingRecord(content.product)
    const url = absoluteUrl(path)
    const isCorretorNota8 = isCorretorNota8Content(content)
    const price = landingNumber(productPriceDisplay(content, product)) ?? (isCorretorNota8 ? corretorNota8Offer.priceInCents / 100 : null)
    const checkoutUrl = landingText(product.checkout_url, isCorretorNota8 ? corretorNota8Offer.checkoutUrl : '')
    const author = landingText(product.author, isCorretorNota8 ? corretorNota8Offer.author : 'Guilherme Pilger')

    return {
        '@context': 'https://schema.org',
        '@type': 'Book',
        '@id': `${url}#product`,
        name: landingText(product.name, isCorretorNota8 ? corretorNota8Offer.productName : title),
        url,
        image: landingText(product.cover_image ?? content.custom_hero_image, isCorretorNota8 ? corretorNota8Content.coverImage : heroImage || DEFAULT_OG_IMAGE),
        description: landingText(content.custom_description ?? product.description, isCorretorNota8 ? corretorNota8Content.description : description),
        author: {
            '@type': 'Person',
            name: author,
        },
        publisher: {
            '@id': `${absoluteUrl('/')}#organization`,
        },
        offers: {
            '@type': 'Offer',
            url: checkoutUrl ? absoluteUrl(checkoutUrl) : url,
            price: price ?? undefined,
            priceCurrency: 'BRL',
            availability: 'https://schema.org/InStock',
            seller: {
                '@id': `${absoluteUrl('/')}#organization`,
            },
        },
    }
}

function unitDetailPath(unit: Record<string, any>) {
    const propertyId = landingText(unit.propertyId ?? unit.property_id)
    if (propertyId) {
        return propertyDetailsPath({
            id: propertyId,
            source_slug: landingText(unit.sourceSlug ?? unit.source_slug ?? unit.slug),
            title: landingText(unit.title, landingText(unit.type)),
            seo_title: landingText(unit.seoTitle ?? unit.seo_title),
            city: landingText(unit.city),
            neighborhood: landingText(unit.neighborhood),
            property_type: landingText(unit.propertyType ?? unit.property_type ?? unit.type),
        })
    }

    const sourceSlug = landingText(unit.sourceSlug ?? unit.source_slug ?? unit.slug ?? unit.id)
    return sourceSlug ? `/imovel/${encodeURIComponent(sourceSlug)}` : ''
}

function developmentUnitItems(development: Record<string, any>) {
    const units = Array.isArray(development.units) ? development.units : []

    return units
        .map(item => landingRecord(item))
        .map(unit => {
            const url = unitDetailPath(unit)
            const name = landingText(unit.title, landingText(unit.type, 'Unidade disponível'))
            if (!url || !name) return null
            return {
                name,
                url,
                description: [
                    landingText(unit.area),
                    landingText(unit.suites),
                    landingText(unit.vagas),
                    maskPublicPriceText(landingText(unit.price)),
                ].filter(Boolean).join(' | '),
                image: landingText(unit.image) || (Array.isArray(unit.images) ? landingText(unit.images[0]) : ''),
                type: 'RealEstateListing',
            }
        })
        .filter((item): item is { name: string; url: string; description: string; image: string; type: string } => Boolean(item))
}

function developmentJsonLd(content: Record<string, any>, path: string, title: string, description: string, heroImage: string) {
    const development = landingRecord(content.development)
    const name = landingText(development.name, title)
    if (!name) return []

    const url = absoluteUrl(path)
    const image = landingText(development.heroImage ?? development.hero_image ?? content.custom_hero_image, heroImage || DEFAULT_OG_IMAGE)
    const city = landingText(development.city, landingText(development.locationName ?? development.location_name))
    const address = landingText(development.address, city || 'Santa Catarina')
    const geo = landingRecord(development.geo)
    const latitude = landingNumber(development.latitude ?? development.lat ?? geo.latitude)
    const longitude = landingNumber(development.longitude ?? development.lng ?? development.lon ?? geo.longitude)
    const unitItems = developmentUnitItems(development)
    const amenities = [
        ...(Array.isArray(development.benefits) ? development.benefits : []),
        ...(Array.isArray(development.differentials) ? development.differentials : []),
    ]
        .map(item => landingText(landingRecord(item).title ?? item))
        .filter(Boolean)
        .slice(0, 16)

    const developmentJsonLd: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': ['Place', 'Residence'],
        '@id': `${url}#development`,
        name,
        url,
        image,
        description: landingText(development.description, description),
        mainEntityOfPage: {
            '@id': `${url}#webpage`,
        },
        address: {
            '@type': 'PostalAddress',
            streetAddress: address,
            addressLocality: city || undefined,
            addressRegion: 'SC',
            addressCountry: 'BR',
        },
        geo: latitude !== null && longitude !== null ? {
            '@type': 'GeoCoordinates',
            latitude,
            longitude,
        } : undefined,
        amenityFeature: amenities.map(item => ({
            '@type': 'LocationFeatureSpecification',
            name: item,
            value: true,
        })),
    }

    if (unitItems.length) {
        developmentJsonLd.containsPlace = unitItems.slice(0, 40).map(unit => ({
            '@type': 'Accommodation',
            name: unit.name,
            url: absoluteUrl(unit.url),
            image: unit.image || undefined,
        }))
    }

    return [
        developmentJsonLd,
        unitItems.length ? itemListJsonLd({
            name: `Unidades disponíveis no ${name}`,
            description: `Lista de imóveis ativos vinculados ao empreendimento ${name}.`,
            path,
            items: unitItems.slice(0, 80),
        }) : undefined,
    ].filter(Boolean) as Record<string, unknown>[]
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const paramsAwaited = await params
    const { slug } = paramsAwaited

    let lp = null
    try {
        const supabase = createAdminClient()
        const { data, error } = await supabase
            .from('landing_pages')
            .select('title, content, page_type')
            .eq('slug', slug)
            .abortSignal(createSupabaseAbortSignal(3000))
            .maybeSingle()

        if (error) throw error
        lp = data || null
    } catch (error) {
        console.warn('[Landing Page] metadata lookup unavailable:', summarizeSupabaseError(error))
        return { title: 'Guilherme Pilger' }
    }

    if (!lp) return { title: 'Página não encontrada' }

    const rawContent = landingRecord(lp.content)
    const initialPageType = landingPageType(lp as Record<string, any>, rawContent)
    const content = initialPageType === 'product' ? normalizeProductLandingContent(rawContent) : rawContent
    const pageType = landingPageType(lp as Record<string, any>, content)
    const development = landingRecord(content.development)
    const product = landingRecord(content.product)
    const seo = landingSeo(content)
    const isCorretorNota8 = pageType === 'product' && isCorretorNota8Content(content)
    const title = landingText(
        seo.title ?? content.seo_title ?? content.custom_title ?? product.name,
        isCorretorNota8 ? corretorNota8Offer.productName : lp.title
    )
    const description = landingText(
        seo.description ?? content.meta_description ?? content.custom_description ?? product.description ?? development.description,
        isCorretorNota8
            ? 'Conheça o Corretor Nota 8, livro digital de Guilherme Pilger para corretores que querem posicionamento, método e disciplina.'
            : pageType === 'product'
            ? 'Conheça este produto de Guilherme Pilger.'
            : 'Confira este imóvel exclusivo.'
    )
    const image = landingText(
        seo.og_image ?? seo.image ?? product.cover_image ?? content.custom_hero_image ?? development.heroImage ?? development.hero_image,
        isCorretorNota8 ? corretorNota8Content.coverImage : firstGalleryImage(content, development) || DEFAULT_OG_IMAGE
    )
    const canonical = landingText(seo.canonical_path ?? content.canonical_path, `/${slug}`)

    return {
        title,
        description,
        alternates: {
            canonical,
        },
        openGraph: {
            title,
            description,
            url: canonical,
            type: 'website',
            images: [{ url: image, width: 1200, height: 630 }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [image],
        },
    }
}

export default async function DynamicLandingPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params

    const lookup = await fetchHydratedLandingPageBySlug(slug)
    const lp = lookup.data

    if (lookup.unavailable) {
        return <LandingPageUnavailable slug={slug} />
    }

    if (!lp) {
        notFound()
    }

    const rawContent = landingRecord(lp.content)
    const redirectSlug = landingRedirectSlug(lp, rawContent, slug)
    if (redirectSlug) redirect(`/${redirectSlug}`)

    const initialPageType = landingPageType(lp, rawContent)
    const content = initialPageType === 'product' ? normalizeProductLandingContent(rawContent) : rawContent
    const pageType = landingPageType(lp, content)
    const product = landingRecord(content.product)
    const property = landingRecord(lp.property)
    const agent = landingRecord(lp.agent)

    const getGallery = () => {
        if (content.custom_gallery && Array.isArray(content.custom_gallery) && content.custom_gallery.length > 0) {
            return content.custom_gallery
        }

        const propImages = property.images || []

        if (propImages.length === 0 && content.custom_hero_image) {
            return [content.custom_hero_image]
        }

        return propImages
    }

    const displayData: LandingPageData = {
        title: content.custom_title || product.name || (pageType === 'product' && isCorretorNota8Content(content) ? corretorNota8Offer.productName : property.title) || lp.title,
        description: content.custom_description || product.description || (pageType === 'product' && isCorretorNota8Content(content) ? corretorNota8Content.description : property.description) || 'Descrição não disponível.',
        heroImage: product.cover_image || content.custom_hero_image || (pageType === 'product' && isCorretorNota8Content(content) ? corretorNota8Content.coverImage : property.images && property.images[0]) || '/placeholder-house.jpg',
        price: pageType === 'product'
            ? productPriceDisplay(content, product, corretorNota8Offer.priceDisplay)
            : maskPublicPriceText(content.custom_price || product.price || property.price),
        cta: content.custom_cta || product.cta || (pageType === 'product' ? corretorNota8Offer.primaryCtaLabel : 'Agendar Visita'),
        stats: {
            bedrooms: (content.custom_stats?.bedrooms) ?? (property.bedrooms || 0),
            bathrooms: (content.custom_stats?.bathrooms) ?? (property.bathrooms || 0),
            area: (content.custom_stats?.area) ?? (property.area || property.area_m2 || property.area_private_m2 || 0),
            location: (content.custom_stats?.location) ?? (property.location || 'Localização privilegiada')
        },
        amenities: (content.custom_features && content.custom_features.length > 0)
            ? content.custom_features
            : (property.features || []),
        gallery: getGallery(),
        primaryColor: lp.primary_color || '#c9a96e'
    }

    const templateId = content.template || (pageType === 'product' ? 'corretor-nota-8' : 'classic')
    const templateContent = {
        ...content,
        landing_page_created_at: lp.created_at || null,
        landing_page_updated_at: lp.updated_at || null,
        landing_metrics: landingRecord(lp.metrics),
    }

    const commonProps = {
        data: displayData,
        content: templateContent,
        slug: slug,
        landingPageId: lp.id,
        agentName: agent.name,
        greetingMessage: agent.greeting_message,
    }
    const gallery = getGallery()
    const pageUrl = absoluteUrl(`/${slug}`)
    const faqItems = landingFaqItems(content)
    const baseJsonLd = [
        organizationJsonLd(),
        webPageJsonLd({
            path: `/${slug}`,
            name: displayData.title,
            description: displayData.description,
            type: 'WebPage',
            image: displayData.heroImage,
        }),
        breadcrumbJsonLd([
            { name: 'Home', url: '/' },
            { name: displayData.title, url: `/${slug}` },
        ]),
        ...(faqItems.length ? [faqPageJsonLd(faqItems)] : []),
    ]

    const jsonLd = pageType === 'product'
        ? [
            ...baseJsonLd,
            productJsonLd(content, `/${slug}`, displayData.title, displayData.description, displayData.heroImage),
        ].filter(Boolean) as Record<string, unknown>[]
        : [
            ...baseJsonLd,
            ...developmentJsonLd(content, `/${slug}`, displayData.title, displayData.description, displayData.heroImage),
            property.id ? {
                '@context': 'https://schema.org',
                '@type': 'RealEstateListing',
                '@id': `${pageUrl}#listing`,
                name: displayData.title,
                url: pageUrl,
                image: gallery.length ? gallery : [displayData.heroImage],
                description: displayData.description,
                mainEntityOfPage: {
                    '@id': `${pageUrl}#webpage`,
                },
                address: {
                    '@type': 'PostalAddress',
                    addressLocality: property.city || displayData.stats.location,
                    addressRegion: property.state || 'SC',
                    addressCountry: 'BR',
                    streetAddress: [property.neighborhood, property.street].filter(Boolean).join(', ') || undefined,
                },
                floorSize: property.area_m2 || property.area_private_m2 || displayData.stats.area ? {
                    '@type': 'QuantitativeValue',
                    value: Number(property.area_m2 || property.area_private_m2 || displayData.stats.area),
                    unitCode: 'MTK',
                } : undefined,
                numberOfRooms: property.bedrooms || property.suites || displayData.stats.bedrooms || undefined,
                offers: {
                    '@type': 'Offer',
                    price: isPublicPriceVisible(property.price) ? property.price : undefined,
                    priceCurrency: 'BRL',
                    availability: 'https://schema.org/InStock',
                    url: pageUrl,
                    seller: {
                        '@id': `${absoluteUrl('/')}#organization`,
                    },
                },
            } : undefined,
        ].filter(Boolean) as Record<string, unknown>[]

    const page = (() => {
        if (pageType === 'product') {
            return <ProductSalesTemplate {...commonProps} />
        }

        switch (templateId) {
            case 'brava-concetto':
                return (
                    <>
                        <GlobalHeader />
                        <BravaConcettoTemplate key={slug} {...commonProps} />
                    </>
                )
            case 'modern':
                return <ModernLuxuryTemplate {...commonProps} />
            case 'lead-capture':
                return <LeadCaptureTemplate {...commonProps} />
            case 'urgency':
                return <UrgencyTemplate {...commonProps} />
            case 'social-proof':
                return <SocialProofTemplate {...commonProps} />
            case 'vip':
                return <VipExclusiveTemplate {...commonProps} />
            case 'classic':
            default:
                return <ClassicTemplate {...commonProps} />
        }
    })()

    return (
        <>
            <JsonLd data={jsonLd} />
            {page}
        </>
    )
}
