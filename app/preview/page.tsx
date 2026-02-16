'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import ClassicTemplate from '@/components/templates/ClassicTemplate'
import ModernLuxuryTemplate from '@/components/templates/ModernLuxuryTemplate'
import LeadCaptureTemplate from '@/components/templates/LeadCaptureTemplate'
import UrgencyTemplate from '@/components/templates/UrgencyTemplate'
import SocialProofTemplate from '@/components/templates/SocialProofTemplate'
import VipExclusiveTemplate from '@/components/templates/VipExclusiveTemplate'
import { LandingPageData } from '@/components/templates/types'

function PreviewContent() {
    const searchParams = useSearchParams()
    const templateId = searchParams.get('template') || 'classic'

    // Mock Data for Preview
    const mockData: LandingPageData = {
        title: 'Mansão Crystal Lake - O Ápice do Luxo',
        description: 'Uma obra-prima da arquitetura moderna, situada nas margens cristalinas do lago. Com 5 suítes, acabamentos em mármore importado e uma vista de tirar o fôlego, esta propriedade define o novo padrão de viver bem.',
        heroImage: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?q=80&w=1920&auto=format&fit=crop',
        price: 'R$ 12.500.000,00',
        cta: 'Agendar Visita Exclusiva',
        stats: {
            bedrooms: 5,
            bathrooms: 7,
            area: 850,
            location: 'Lago Negro, Gramado'
        },
        amenities: [
            'Piscina Infinita Aquecida',
            'Adega Subterrânea',
            'Automação Residencial Total',
            'Cinema Privativo',
            'Spa com Sauna',
            'Heliponto Privado',
            'Segurança 24h',
            'Acabamentos em Mármore Carrara'
        ],
        gallery: [
            'https://images.unsplash.com/photo-1613490493576-7fde63acd811?q=80&w=1920&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1600596542815-2495db98dada?q=80&w=1920&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=1920&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=80&w=1920&auto=format&fit=crop'
        ],
        primaryColor: '#c9a96e'
    }

    const commonProps = {
        data: mockData,
        slug: 'preview-demo',
        landingPageId: 'preview',
        agentName: 'Corretor Pilger',
        greetingMessage: 'Olá! Estou à disposição para apresentar os detalhes desta propriedade exclusiva.'
    }

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

export default function TemplatePreviewPage() {
    return (
        <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888' }}>Carregando preview...</div>}>
            <PreviewContent />
        </Suspense>
    )
}
