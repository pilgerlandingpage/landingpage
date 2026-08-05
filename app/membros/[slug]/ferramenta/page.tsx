import { notFound, redirect } from 'next/navigation'
import { PROFILE_ASSESSMENT_EVENT_SLUG } from '@/lib/events/profile-assessment'
import { DEFAULT_EVENT_HERO } from '@/lib/events/utils'
import { loadMemberProduct } from '@/lib/members/access'
import SelfAssessmentClient from '../../../eventos/[slug]/perfil-corretor-ideal/SelfAssessmentClient'

export const dynamic = 'force-dynamic'

type PageContext = {
  params: Promise<{ slug: string }>
}

function encodedNext(slug: string) {
  return encodeURIComponent(`/membros/${slug}/ferramenta`)
}

export default async function MemberProductToolPage({ params }: PageContext) {
  const { slug } = await params

  if (slug !== 'perfil-corretor-ideal') {
    notFound()
  }

  const data = await loadMemberProduct(slug)

  if (!data.user) {
    redirect(`/membros/entrar?next=${encodedNext(slug)}`)
  }

  if (!data.product || !data.entitlement) {
    redirect(`/membros/${slug}`)
  }

  return (
    <SelfAssessmentClient
      eventTitle="Perfil do Corretor Ideal"
      eventSlug={PROFILE_ASSESSMENT_EVENT_SLUG}
      eventDateLabel="Ferramenta gratuita"
      eventLocation="Área de membros"
      heroImage={DEFAULT_EVENT_HERO}
    />
  )
}
