import type { Metadata } from 'next'
import { PROFILE_ASSESSMENT_VOTE_URL } from '@/lib/whatsapp/profile-assessment-gate'
import VotarGuilhermeClient from './VotarGuilhermeClient'

export const metadata: Metadata = {
  title: 'Vote no Guilherme Pilger | Real Estate Awards',
  description: 'Passo a passo para votar em Guilherme Pilger no Real Estate Awards.',
  robots: {
    index: false,
    follow: true,
  },
}

export default function VotarGuilhermePage() {
  return <VotarGuilhermeClient voteUrl={PROFILE_ASSESSMENT_VOTE_URL} />
}
