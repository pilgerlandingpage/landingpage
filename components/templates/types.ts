
export interface LandingPageData {
    title: string
    description: string
    heroImage: string
    price: string
    cta: string
    stats: {
        bedrooms: number
        bathrooms: number
        area: number
        location: string
    }
    amenities: string[]
    gallery: string[]
    primaryColor: string
}

export interface TemplateProps {
    data: LandingPageData
    // These props are needed for the AI Agent/Chat Widget integration
    slug: string
    landingPageId: string
    agentName?: string
    greetingMessage?: string
}
