import type { Metadata } from 'next'
import GlobalHeader from '@/components/layout/GlobalHeader'
import Footer from '@/components/layout/Footer'
import TrabalheConoscoClient from './TrabalheConoscoClient'
import { JsonLd, absoluteUrl, DEFAULT_OG_IMAGE } from '@/lib/seo/json-ld'

export const metadata: Metadata = {
    title: 'Trabalhe conosco | Corretores Pilger',
    description: 'Cadastro para corretores que querem trabalhar com a Pilger e atuar em um ecossistema imobiliario orientado por dados, atendimento e alto padrao.',
    alternates: {
        canonical: '/trabalhe-conosco',
    },
    openGraph: {
        title: 'Trabalhe conosco | Corretores Pilger',
        description: 'Cadastre seu perfil profissional para trabalhar com a Pilger.',
        url: '/trabalhe-conosco',
        type: 'website',
        images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
    },
}

export default function TrabalheConoscoPage() {
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title: 'Corretor parceiro Pilger',
        description: 'Cadastro para corretores interessados em trabalhar com a Pilger no mercado imobiliario de alto padrao.',
        hiringOrganization: {
            '@type': 'Organization',
            name: 'Guilherme Pilger',
            sameAs: absoluteUrl('/'),
        },
        employmentType: 'CONTRACTOR',
        applicantLocationRequirements: {
            '@type': 'Country',
            name: 'Brasil',
        },
        jobLocationType: 'HYBRID',
    }

    return (
        <>
            <GlobalHeader />
            <JsonLd data={jsonLd} />
            <TrabalheConoscoClient />
            <Footer />
        </>
    )
}
