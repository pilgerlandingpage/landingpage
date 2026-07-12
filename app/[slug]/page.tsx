import { createAdminClient, createSupabaseAbortSignal, summarizeSupabaseError } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ClassicTemplate from '@/components/templates/ClassicTemplate'
import ModernLuxuryTemplate from '@/components/templates/ModernLuxuryTemplate'
import LeadCaptureTemplate from '@/components/templates/LeadCaptureTemplate'
import UrgencyTemplate from '@/components/templates/UrgencyTemplate'
import SocialProofTemplate from '@/components/templates/SocialProofTemplate'
import VipExclusiveTemplate from '@/components/templates/VipExclusiveTemplate'
import BravaConcettoTemplate from '@/components/templates/BravaConcettoTemplate'
import GlobalHeader from '@/components/layout/GlobalHeader'
import { LandingPageData } from '@/components/templates/types'
import { Metadata } from 'next'
import { JsonLd, absoluteUrl, breadcrumbJsonLd, organizationJsonLd, webPageJsonLd, DEFAULT_OG_IMAGE, faqPageJsonLd, itemListJsonLd } from '@/lib/seo/json-ld'
import { propertyDetailsPath } from '@/lib/properties/responsive-destination'

export const revalidate = 300

export function generateStaticParams() {
    return []
}

const LANDING_LOOKUP_TIMEOUT_MS = 12000
const LANDING_LOOKUP_RETRY_DELAYS_MS = [300, 900]
const LANDING_PAGE_SELECT = `
    id,
    title,
    slug,
    description,
    content,
    primary_color,
    property:properties (
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
    ),
    agent:ai_agents (
        name,
        greeting_message
    )
`

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

async function fetchLandingPageBySlug(slug: string, select: string) {
    for (let attempt = 0; attempt <= LANDING_LOOKUP_RETRY_DELAYS_MS.length; attempt += 1) {
        const supabase = createAdminClient()
        const { data, error } = await supabase
            .from('landing_pages')
            .select(select)
            .eq('slug', slug)
            .abortSignal(createSupabaseAbortSignal(LANDING_LOOKUP_TIMEOUT_MS))
            .maybeSingle()

        if (!error) return data || null

        const canRetry = attempt < LANDING_LOOKUP_RETRY_DELAYS_MS.length && isRetriableLandingLookupError(error)
        if (!canRetry) {
            console.error('[Landing Page] lookup failed:', summarizeSupabaseError(error))
            throw new Error('Nao foi possivel carregar esta landing page agora.')
        }

        await waitForLandingLookupRetry(LANDING_LOOKUP_RETRY_DELAYS_MS[attempt])
    }

    throw new Error('Nao foi possivel carregar esta landing page agora.')
}

function landingRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function landingText(value: unknown, fallback = '') {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function landingNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
        if (Number.isFinite(parsed)) return parsed
    }
    return null
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

function landingFaqItems(content: Record<string, any>) {
    const development = landingRecord(content.development)
    const seo = landingSeo(content)
    const sources = [
        development.faq,
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
                question: landingText(record.question ?? record.q),
                answer: landingText(record.answer ?? record.a),
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
            const name = landingText(unit.title, landingText(unit.type, 'Unidade disponivel'))
            if (!url || !name) return null
            return {
                name,
                url,
                description: [
                    landingText(unit.area),
                    landingText(unit.suites),
                    landingText(unit.vagas),
                    landingText(unit.price),
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

    return [
        {
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
            containsPlace: unitItems.slice(0, 40).map(unit => ({
                '@type': 'Accommodation',
                name: unit.name,
                url: absoluteUrl(unit.url),
                image: unit.image || undefined,
            })),
        },
        unitItems.length ? itemListJsonLd({
            name: `Unidades disponiveis no ${name}`,
            description: `Lista de imoveis ativos vinculados ao empreendimento ${name}.`,
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
            .select('title, content')
            .eq('slug', slug)
            .abortSignal(createSupabaseAbortSignal(3000))
            .maybeSingle()

        if (error) throw error
        lp = data || null
    } catch (error) {
        console.warn('[Landing Page] metadata lookup unavailable:', summarizeSupabaseError(error))
        return { title: 'Guilherme Pilger' }
    }

    if (!lp) return { title: 'Pagina nao encontrada' }

    const content = landingRecord(lp.content)
    const development = landingRecord(content.development)
    const seo = landingSeo(content)
    const title = landingText(seo.title ?? content.seo_title ?? content.custom_title, lp.title)
    const description = landingText(
        seo.description ?? content.meta_description ?? content.custom_description ?? development.description,
        'Confira este imovel exclusivo.'
    )
    const image = landingText(
        seo.og_image ?? seo.image ?? content.custom_hero_image ?? development.heroImage ?? development.hero_image,
        firstGalleryImage(content, development) || DEFAULT_OG_IMAGE
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

    const lp = await fetchLandingPageBySlug(slug, LANDING_PAGE_SELECT)

    if (!lp) {
        notFound()
    }

    const content = landingRecord(lp.content)
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
        title: content.custom_title || property.title || lp.title,
        description: content.custom_description || property.description || 'Descricao nao disponivel.',
        heroImage: content.custom_hero_image || (property.images && property.images[0]) || '/placeholder-house.jpg',
        price: content.custom_price || (property.price ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.price) : 'Consulte'),
        cta: content.custom_cta || 'Agendar Visita',
        stats: {
            bedrooms: (content.custom_stats?.bedrooms) ?? (property.bedrooms || 0),
            bathrooms: (content.custom_stats?.bathrooms) ?? (property.bathrooms || 0),
            area: (content.custom_stats?.area) ?? (property.area || property.area_m2 || property.area_private_m2 || 0),
            location: (content.custom_stats?.location) ?? (property.location || 'Localizacao privilegiada')
        },
        amenities: (content.custom_features && content.custom_features.length > 0)
            ? content.custom_features
            : (property.features || []),
        gallery: getGallery(),
        primaryColor: lp.primary_color || '#c9a96e'
    }

    const templateId = content.template || 'classic'

    const commonProps = {
        data: displayData,
        content,
        slug: slug,
        landingPageId: lp.id,
        agentName: agent.name,
        greetingMessage: agent.greeting_message
    }
    const gallery = getGallery()
    const pageUrl = absoluteUrl(`/${slug}`)
    const faqItems = landingFaqItems(content)
    const jsonLd = [
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
        ...developmentJsonLd(content, `/${slug}`, displayData.title, displayData.description, displayData.heroImage),
        ...(faqItems.length ? [faqPageJsonLd(faqItems)] : []),
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
                price: property.price || undefined,
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
