import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import GlobalHeader from '@/components/layout/GlobalHeader'
import Footer from '@/components/layout/Footer'
import AiGuidePageTemplate from '@/components/marketplace/AiGuidePageTemplate'
import { aiGuidePages, getAiGuidePage, guideLastModified, type AiGuidePage } from '@/lib/seo/ai-guide-pages'
import {
  BRAND_NAME,
  JsonLd,
  absoluteUrl,
  breadcrumbJsonLd,
  faqPageJsonLd,
  organizationJsonLd,
  webPageJsonLd,
} from '@/lib/seo/json-ld'

type PageParams = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return aiGuidePages.map(guide => ({ slug: guide.slug }))
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = await params
  const guide = getAiGuidePage(slug)
  if (!guide) return { title: 'Guia não encontrado' }

  return {
    title: guide.title,
    description: guide.description,
    alternates: {
      canonical: guide.path,
    },
    openGraph: {
      title: guide.title,
      description: guide.description,
      url: guide.path,
      type: 'article',
      images: [{ url: guide.image, width: 1200, height: 630, alt: guide.imageAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: guide.title,
      description: guide.description,
      images: [guide.image],
    },
  }
}

function guideJsonLd(guide: AiGuidePage) {
  const url = absoluteUrl(guide.path)
  const updatedAt = guideLastModified()

  return [
    organizationJsonLd(),
    webPageJsonLd({
      path: guide.path,
      name: guide.title,
      description: guide.description,
      type: 'Article',
      image: guide.image,
    }),
    breadcrumbJsonLd([
      { name: 'Home', url: '/' },
      { name: 'Guias', url: '/guias' },
      { name: guide.shortTitle, url: guide.path },
    ]),
    faqPageJsonLd(guide.faq),
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: guide.title,
      description: guide.description,
      image: [guide.image],
      datePublished: updatedAt,
      dateModified: updatedAt,
      author: {
        '@type': 'Person',
        name: BRAND_NAME,
        url: absoluteUrl('/sobre'),
      },
      publisher: {
        '@id': `${absoluteUrl('/')}#organization`,
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
      },
      articleSection: 'Guia imobiliário',
      isAccessibleForFree: true,
      inLanguage: 'pt-BR',
      about: guide.about.map(item => ({
        '@type': 'Thing',
        name: item,
      })),
      mentions: guide.related.map(item => ({
        '@type': 'WebPage',
        name: item.label,
        url: absoluteUrl(item.href),
      })),
    },
  ]
}

export default async function AiGuideRoutePage({ params }: PageParams) {
  const { slug } = await params
  const guide = getAiGuidePage(slug)
  if (!guide) notFound()

  return (
    <>
      <GlobalHeader />
      <JsonLd data={guideJsonLd(guide)} />
      <AiGuidePageTemplate guide={guide} />
      <Footer />
    </>
  )
}
