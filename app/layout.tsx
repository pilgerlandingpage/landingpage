import type { Metadata } from 'next'
import './globals.css'
import { SpeedInsights } from '@vercel/speed-insights/next'
import MainTracker from '@/components/tracking/MainTracker'
import PropertyLinkTrackingDecorator from '@/components/tracking/PropertyLinkTrackingDecorator'
import WhatsAppLeadCaptureModal from '@/components/landing/WhatsAppLeadCaptureModal'
import UserAccessTracker from '@/components/admin/UserAccessTracker'
import { DEFAULT_OG_IMAGE, SITE_URL } from '@/lib/seo/json-ld'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Guilherme Pilger | Imóveis de luxo no litoral catarinense',
    template: '%s | Guilherme Pilger',
  },
  description: 'Curadoria de imóveis de alto padrão em Balneário Camboriú, Praia Brava, Itapema e litoral de Santa Catarina. Apartamentos, coberturas e casas de luxo acima de R$ 4 milhões.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: SITE_URL,
    siteName: 'Guilherme Pilger',
    title: 'Guilherme Pilger | Imóveis de luxo no litoral catarinense',
    description: 'Curadoria de imóveis de alto padrão em Balneário Camboriú, Praia Brava, Itapema e litoral de Santa Catarina. Apartamentos, coberturas e casas de luxo acima de R$ 4 milhões.',
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: 'Guilherme Pilger - Imóveis de luxo no litoral catarinense' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Guilherme Pilger | Imóveis de luxo no litoral catarinense',
    description: 'Curadoria de imóveis de alto padrão em Balneário Camboriú, Praia Brava, Itapema e litoral catarinense. Apartamentos e coberturas de luxo.',
    images: [DEFAULT_OG_IMAGE],
  },
  icons: {
    icon: [
      { url: '/icon', type: 'image/png', sizes: '64x64' },
    ],
    apple: [
      { url: '/apple-icon', type: 'image/png', sizes: '180x180' },
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>
        <MainTracker />
        <PropertyLinkTrackingDecorator />
        <UserAccessTracker />
        <WhatsAppLeadCaptureModal />
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
