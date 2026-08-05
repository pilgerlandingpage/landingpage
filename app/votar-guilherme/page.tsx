import type { Metadata } from 'next'
import { PROFILE_ASSESSMENT_VOTE_URL } from '@/lib/whatsapp/profile-assessment-gate'
import VotarGuilhermeClient from './VotarGuilhermeClient'

export const metadata: Metadata = {
  title: 'Acesso à votação | Guilherme Pilger',
  description: 'Abra a votação oficial, volte após concluir e continue para o agradecimento.',
  robots: {
    index: false,
    follow: true,
  },
}

export default function VotarGuilhermePage() {
  return <VotarGuilhermeClient voteUrl={PROFILE_ASSESSMENT_VOTE_URL} />
}
