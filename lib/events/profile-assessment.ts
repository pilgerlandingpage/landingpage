export const PROFILE_ASSESSMENT_PARENT_SLUG = 'encontro-corretores-pilger'
export const PROFILE_ASSESSMENT_EVENT_SLUG = 'perfil-corretor-ideal-ao-vivo'
export const PROFILE_ASSESSMENT_PATH_SUFFIX = 'perfil-corretor-ideal'
export const PROFILE_ASSESSMENT_METADATA_KEY = 'profile_self_assessment'

export function buildProfileAssessmentPath(slug = PROFILE_ASSESSMENT_EVENT_SLUG) {
    return `/eventos/${slug}/${PROFILE_ASSESSMENT_PATH_SUFFIX}`
}

export function resolveProfileAssessmentEventSlug(slug: string) {
    return slug === PROFILE_ASSESSMENT_PARENT_SLUG ? PROFILE_ASSESSMENT_EVENT_SLUG : slug
}

export function isProfileAssessmentEvent(event: { slug?: string | null; metadata?: any }) {
    const metadata = event?.metadata && typeof event.metadata === 'object' ? event.metadata : {}
    return event?.slug === PROFILE_ASSESSMENT_EVENT_SLUG
        || metadata.event_experience === PROFILE_ASSESSMENT_METADATA_KEY
}
