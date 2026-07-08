import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import {
    buildProfileAssessmentPath,
    buildProfileAssessmentPresentationPath,
    PROFILE_ASSESSMENT_PARENT_SLUG,
    PROFILE_ASSESSMENT_EVENT_SLUG,
    resolveProfileAssessmentEventSlug,
} from '@/lib/events/profile-assessment'
import ProfilePresentationClient from './ProfilePresentationClient'

type PageProps = {
    params: Promise<{ slug: string }>
}

const PRESENTATION_EVENT = {
    title: 'Perfil do Corretor Ideal',
    slug: PROFILE_ASSESSMENT_EVENT_SLUG,
    dateLabel: '09 de julho de 2026 às 14:00',
    location: 'Guilherme Pilger - Praia Brava',
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params
    const resolvedSlug = resolveProfileAssessmentEventSlug(slug)

    if (resolvedSlug !== PROFILE_ASSESSMENT_EVENT_SLUG) {
        return {
            title: 'Apresentação Perfil do Corretor Ideal',
            robots: { index: false, follow: false },
        }
    }

    return {
        title: `Apresentação - Perfil do Corretor Ideal`,
        description: 'Apresentação ao vivo da dinâmica Perfil do Corretor Ideal com Guilherme Pilger.',
        robots: { index: false, follow: false },
        alternates: { canonical: buildProfileAssessmentPresentationPath(PRESENTATION_EVENT.slug) },
    }
}

export default async function PerfilCorretorIdealPresentationPage({ params }: PageProps) {
    const { slug } = await params

    if (slug === PROFILE_ASSESSMENT_PARENT_SLUG) {
        redirect(buildProfileAssessmentPresentationPath())
    }

    const resolvedSlug = resolveProfileAssessmentEventSlug(slug)

    if (resolvedSlug !== PROFILE_ASSESSMENT_EVENT_SLUG) notFound()

    return (
        <ProfilePresentationClient
            eventTitle={PRESENTATION_EVENT.title}
            eventSlug={PRESENTATION_EVENT.slug}
            eventDateLabel={PRESENTATION_EVENT.dateLabel}
            eventLocation={PRESENTATION_EVENT.location}
            assessmentPath={buildProfileAssessmentPath(PRESENTATION_EVENT.slug)}
        />
    )
}
