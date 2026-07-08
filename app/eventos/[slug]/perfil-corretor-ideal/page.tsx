import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { DEFAULT_EVENT_HERO, formatEventDate } from '@/lib/events/utils'
import SelfAssessmentClient from './SelfAssessmentClient'

export const dynamic = 'force-dynamic'

const PROFILE_ASSESSMENT_EVENT_DATE = '2026-07-09T14:00:00-03:00'

type PageProps = {
    params: Promise<{ slug: string }>
}

async function getEvent(slug: string) {
    const supabase = createAdminClient()
    const { data } = await supabase
        .from('event_events')
        .select('id, title, slug, subtitle, description, event_date, location_name, hero_image_url, status')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle()

    return data
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params
    const event = await getEvent(slug)

    if (!event) {
        return {
            title: 'Perfil do Corretor Ideal',
            robots: { index: false, follow: false },
        }
    }

    return {
        title: `Perfil do Corretor Ideal - ${event.title}`,
        description: 'Autoavaliação ao vivo para corretores no evento Guilherme Pilger.',
        robots: { index: false, follow: false },
        alternates: { canonical: `/eventos/${event.slug}/perfil-corretor-ideal` },
    }
}

export default async function PerfilCorretorIdealPage({ params }: PageProps) {
    const { slug } = await params
    const event = await getEvent(slug)

    if (!event) notFound()

    return (
        <SelfAssessmentClient
            eventTitle={event.title}
            eventSlug={event.slug}
            eventDateLabel={formatEventDate(PROFILE_ASSESSMENT_EVENT_DATE)}
            eventLocation={event.location_name || 'Evento Guilherme Pilger'}
            heroImage={event.hero_image_url || DEFAULT_EVENT_HERO}
        />
    )
}
