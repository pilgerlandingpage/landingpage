import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import LandingPageLogic from '@/components/landing/LandingPageLogic'
import ClassicTemplate from '@/components/templates/ClassicTemplate'
import ModernLuxuryTemplate from '@/components/templates/ModernLuxuryTemplate'
import LeadCaptureTemplate from '@/components/templates/LeadCaptureTemplate'
import UrgencyTemplate from '@/components/templates/UrgencyTemplate'
import SocialProofTemplate from '@/components/templates/SocialProofTemplate'
import VipExclusiveTemplate from '@/components/templates/VipExclusiveTemplate'
import BravaConcettoTemplate from '@/components/templates/BravaConcettoTemplate'
import { LandingPageData } from '@/components/templates/types'
import { Metadata } from 'next'
import { JsonLd, absoluteUrl, breadcrumbJsonLd, organizationJsonLd, webPageJsonLd } from '@/lib/seo/json-ld'

export const revalidate = 300

export function generateStaticParams() {
    return []
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const supabase = createAdminClient()
    const paramsAwaited = await params
    const { slug } = paramsAwaited

    const { data: lp } = await supabase
        .from('landing_pages')
        .select('title, content')
        .eq('slug', slug)
        .single()


    if (!lp) return { title: 'Página não encontrada' }

    return {
        title: (lp.content as any)?.custom_title || lp.title,
        description: (lp.content as any)?.custom_description || 'Confira este imóvel exclusivo.',
    }
}

export default async function DynamicLandingPage({ params }: { params: Promise<{ slug: string }> }) {
    const supabase = createAdminClient()
    const { slug } = await params

    // 1. Fetch Landing Page data with related Property and Agent
    const { data: lp, error } = await supabase
        .from('landing_pages')
        .select(`
            *,
            property:properties (*),
            agent:ai_agents (*)
        `)
        .eq('slug', slug)
        .single()

    if (error || !lp) {
        notFound()
    }

    // 2. Normalize Data for Templates
    // We prioritize "Custom Content" from JSONB, then fall back to "Property Data", then defaults.
    const content = lp.content || {}
    const property = lp.property || {}
    const agent = lp.agent || {}

    // Helper to get array of images
    const getGallery = () => {
        // 1. Custom Gallery from Cloner
        if (content.custom_gallery && Array.isArray(content.custom_gallery) && content.custom_gallery.length > 0) {
            return content.custom_gallery
        }

        // 2. Property Images
        const propImages = property.images || []

        // 3. Fallback: Custom Hero as single gallery item
        if (propImages.length === 0 && content.custom_hero_image) {
            return [content.custom_hero_image]
        }

        return propImages
    }

    const displayData: LandingPageData = {
        title: content.custom_title || property.title || lp.title,
        description: content.custom_description || property.description || 'Descrição não disponível.',
        heroImage: content.custom_hero_image || (property.images && property.images[0]) || '/placeholder-house.jpg',
        price: content.custom_price || (property.price ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.price) : 'Consulte'),
        cta: content.custom_cta || 'Agendar Visita',
        stats: {
            bedrooms: (content.custom_stats?.bedrooms) ?? (property.bedrooms || 0),
            bathrooms: (content.custom_stats?.bathrooms) ?? (property.bathrooms || 0),
            area: (content.custom_stats?.area) ?? (property.area || 0),
            location: (content.custom_stats?.location) ?? (property.location || 'Localização Privilegiada')
        },
        amenities: (content.custom_features && content.custom_features.length > 0)
            ? content.custom_features
            : (property.features || []),
        gallery: getGallery(),
        primaryColor: lp.primary_color || '#c9a96e'
    }

    // 3. Determine Template
    const templateId = content.template || 'classic'

    // 4. Common Props for all templates
    const commonProps = {
        data: displayData,
        slug: slug,
        landingPageId: lp.id,
        agentName: agent.name,
        greetingMessage: agent.greeting_message
    }
    const gallery = getGallery()
    const pageUrl = absoluteUrl(`/${slug}`)
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
                return <BravaConcettoTemplate {...commonProps} />
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

    // 5. Render Selected Template
    return (
        <>
            <JsonLd data={jsonLd} />
            {page}
        </>
    )
}
