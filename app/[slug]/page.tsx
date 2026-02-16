import { createClient } from '@/lib/supabase/client'
import { notFound } from 'next/navigation'
import LandingPageLogic from '@/components/landing/LandingPageLogic'
import ClassicTemplate from '@/components/templates/ClassicTemplate'
import ModernLuxuryTemplate from '@/components/templates/ModernLuxuryTemplate'
import LeadCaptureTemplate from '@/components/templates/LeadCaptureTemplate'
import UrgencyTemplate from '@/components/templates/UrgencyTemplate'
import SocialProofTemplate from '@/components/templates/SocialProofTemplate'
import VipExclusiveTemplate from '@/components/templates/VipExclusiveTemplate'
import { LandingPageData } from '@/components/templates/types'
import { Metadata } from 'next'

// Force dynamic rendering since we rely on DB data
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const supabase = createClient()
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
    const supabase = createClient()
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
        // If custom hero provided, it's the first image. 
        // We don't have a full custom gallery editor yet, so we mix or fallback.
        const propImages = property.images || []

        // If there are no property images, we try to use custom hero as a single gallery item
        if (propImages.length === 0 && content.custom_hero_image) {
            return [content.custom_hero_image]
        }

        return propImages
    }

    const displayData: LandingPageData = {
        title: content.custom_title || property.title || lp.title,
        description: content.custom_description || property.description || 'Descrição não disponível.',
        heroImage: content.custom_hero_image || (property.images && property.images[0]) || '/placeholder-house.jpg',
        price: property.price ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.price) : 'Consulte',
        cta: content.custom_cta || 'Agendar Visita',
        stats: {
            bedrooms: property.bedrooms || 0,
            bathrooms: property.bathrooms || 0,
            area: property.area || 0,
            location: property.location || 'Localização Privilegiada'
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

    // 5. Render Selected Template
    switch (templateId) {
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
}
