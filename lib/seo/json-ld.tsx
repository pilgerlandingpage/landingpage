import React from 'react'
import { pickPublicBlogSummary } from '@/lib/blog/types'

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://guilhermepilger.ai'
export const BRAND_NAME = 'Guilherme Pilger'
export const BRAND_LEGAL_NAME = 'Imobiliária Guilherme Pilger'
export const BUSINESS_DESCRIPTION = 'Curadoria de imóveis de luxo e alto padrão no litoral catarinense, com foco em Balneário Camboriú, Praia Brava, Itapema, Porto Belo e regiões premium de Santa Catarina.'
export const BUSINESS_PHONE = '+55 47 99252-8080'
export const BUSINESS_EMAIL = 'contato@guilhermepilger.ai'
export const DEFAULT_OG_IMAGE = `${SITE_URL}/opengraph-image`
export const BUSINESS_LOGO = `${SITE_URL}/icon`
export const BUSINESS_CRECI = 'CRECI/SC 6772-J'

type JsonLdValue = Record<string, unknown> | Array<Record<string, unknown>>

function cleanJsonLdValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map(item => cleanJsonLdValue(item))
      .filter(item => item !== undefined && item !== null && item !== '')
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => [key, cleanJsonLdValue(item)])
        .filter(([, item]) => item !== undefined && item !== null && item !== '')
    )
  }

  return value
}

export function absoluteUrl(path = '/') {
  if (!path) return SITE_URL
  if (/^https?:\/\//i.test(path)) return path
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export function JsonLd({ data }: { data: JsonLdValue }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(cleanJsonLdValue(data)).replace(/</g, '\\u003c'),
      }}
    />
  )
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'RealEstateAgent'],
    '@id': `${SITE_URL}/#organization`,
    name: BRAND_NAME,
    legalName: BRAND_LEGAL_NAME,
    alternateName: ['Pilger Luxury Search', BRAND_LEGAL_NAME, BUSINESS_CRECI],
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: BUSINESS_LOGO,
      width: 64,
      height: 64,
    },
    image: DEFAULT_OG_IMAGE,
    description: BUSINESS_DESCRIPTION,
    telephone: BUSINESS_PHONE,
    email: BUSINESS_EMAIL,
    priceRange: 'R$ 1.000.000+',
    areaServed: [
      'Balneário Camboriú',
      'Praia Brava',
      'Itapema',
      'Porto Belo',
      'Litoral de Santa Catarina',
    ],
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Balneário Camboriú',
      addressRegion: 'SC',
      addressCountry: 'BR',
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: BUSINESS_PHONE,
        email: BUSINESS_EMAIL,
        contactType: 'sales',
        areaServed: 'BR',
        availableLanguage: ['pt-BR'],
      },
    ],
    knowsAbout: [
      'imóveis de luxo',
      'alto padrão',
      'mercado imobiliário',
      'Balneário Camboriú',
      'Praia Brava',
      'Itapema',
      'Porto Belo',
      'investimento imobiliário',
    ],
    sameAs: [
      'https://www.instagram.com/guilhermepilger',
      'https://www.facebook.com/guilherme.pilger/',
      'https://www.youtube.com/@guilhermepilger',
      'https://www.tiktok.com/@guilhermepilgeroficial',
    ],
  }
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: BRAND_NAME,
    alternateName: 'Pilger Luxury Search',
    url: SITE_URL,
    inLanguage: 'pt-BR',
    publisher: {
      '@id': `${SITE_URL}/#organization`,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/busca?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}

export function webPageJsonLd(params: {
  path: string
  name: string
  description?: string
  type?: string
  image?: string
}) {
  const url = absoluteUrl(params.path)
  return {
    '@context': 'https://schema.org',
    '@type': params.type || 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: params.name,
    description: params.description,
    image: params.image || DEFAULT_OG_IMAGE,
    isPartOf: {
      '@id': `${SITE_URL}/#website`,
    },
    publisher: {
      '@id': `${SITE_URL}/#organization`,
    },
    inLanguage: 'pt-BR',
  }
}

export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${absoluteUrl(items[items.length - 1]?.url || '/') }#breadcrumb`,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.url),
    })),
  }
}

export function itemListJsonLd(params: {
  name: string
  description?: string
  path: string
  items: Array<{ name: string; url: string; description?: string; image?: string; type?: string }>
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${absoluteUrl(params.path)}#itemlist`,
    name: params.name,
    description: params.description,
    url: absoluteUrl(params.path),
    itemListElement: params.items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': item.type || 'Thing',
        name: item.name,
        url: absoluteUrl(item.url),
        description: item.description,
        image: item.image,
      },
    })),
  }
}

export function faqPageJsonLd(items: Array<{ question?: string | null; answer?: string | null }>) {
  const mainEntity = items
    .filter(item => item.question && item.answer)
    .map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    }))

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity,
  }
}

function normalizeText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function isNewsLikeContent(value: { category?: string | null; tags?: string[] | null; generated_by?: string | null }) {
  const category = normalizeText(value.category)
  const generatedBy = normalizeText(value.generated_by)
  const tags = Array.isArray(value.tags) ? value.tags.map(normalizeText) : []
  return generatedBy.includes('news') || category.includes('noticia') || tags.some(tag => tag.includes('noticia'))
}

function toValidDate(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

function resolveEventEndDate(event: Record<string, any>) {
  const start = toValidDate(event.event_date || event.start_date || event.startDate)
  const explicitEnd = toValidDate(event.end_date || event.endDate)

  if (explicitEnd && (!start || explicitEnd.getTime() > start.getTime())) {
    return explicitEnd.toISOString()
  }

  if (!start) return explicitEnd?.toISOString()

  return new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString()
}

function extractCitationUrls(value: unknown, urls = new Set<string>()) {
  if (!value) return urls

  if (typeof value === 'string') {
    const matches = value.match(/https?:\/\/[^\s)"'<>]+/g) || []
    matches.forEach(url => urls.add(url.replace(/[.,;]+$/, '')))
    return urls
  }

  if (Array.isArray(value)) {
    value.forEach(item => extractCitationUrls(item, urls))
    return urls
  }

  if (typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach(item => extractCitationUrls(item, urls))
  }

  return urls
}

export function articleJsonLd(params: {
  post: {
    title: string
    slug: string
    excerpt?: string | null
    meta_description?: string | null
    cover_image_url?: string | null
    author_name?: string | null
    category?: string | null
    tags?: string[] | null
    primary_keyword?: string | null
    secondary_keywords?: string[] | null
    local_entities?: string[] | null
    internal_links?: Array<{ label: string; target: string }> | null
    source_summary?: unknown
    generated_by?: string | null
    created_at?: string | null
    updated_at?: string | null
    published_at?: string | null
  }
  authorName: string
  authorImage?: string
  forceNews?: boolean
  fallbackImage?: string
}) {
  const { post } = params
  const isNews = params.forceNews ?? isNewsLikeContent(post)
  const url = absoluteUrl(isNews ? `/noticias/${post.slug}` : `/blog/${post.slug}`)
  const keywords = [
    post.primary_keyword,
    ...(post.secondary_keywords || []),
    ...(post.tags || []),
    ...(post.local_entities || []),
  ].filter(Boolean)
  const citations = Array.from(extractCitationUrls(post.source_summary)).slice(0, 10)

  return {
    '@context': 'https://schema.org',
    '@type': isNews ? 'NewsArticle' : 'BlogPosting',
    '@id': `${url}#article`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
    },
    headline: post.title,
    description: pickPublicBlogSummary(post) || undefined,
    image: [post.cover_image_url || params.fallbackImage || DEFAULT_OG_IMAGE],
    datePublished: post.published_at || post.created_at,
    dateModified: post.updated_at || post.published_at || post.created_at,
    author: {
      '@type': 'Person',
      name: post.author_name || params.authorName,
      image: params.authorImage,
      url: SITE_URL,
    },
    publisher: {
      '@id': `${SITE_URL}/#organization`,
    },
    articleSection: post.category || (isNews ? 'Notícias' : 'Blog'),
    keywords,
    about: (post.local_entities || []).map(entity => ({
      '@type': 'Thing',
      name: entity,
    })),
    mentions: (post.internal_links || []).slice(0, 8).map(link => ({
      '@type': 'WebPage',
      name: link.label,
      url: absoluteUrl(link.target || '/'),
    })),
    citation: citations,
    isAccessibleForFree: true,
    inLanguage: 'pt-BR',
  }
}

export function eventJsonLd(event: Record<string, any>, path: string) {
  const url = absoluteUrl(path)
  const image = event.hero_image_url || DEFAULT_OG_IMAGE
  const format = normalizeText(event.format || event.event_format)
  const isOnline = format.includes('online')
  const isHybrid = format.includes('hibrido') || format.includes('hybrid')
  const endDate = resolveEventEndDate(event)
  const attendanceMode = isHybrid
    ? 'https://schema.org/MixedEventAttendanceMode'
    : isOnline
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode'

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    '@id': `${url}#event`,
    name: event.title,
    description: event.description || event.subtitle,
    image: [image],
    url,
    startDate: event.event_date,
    endDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: attendanceMode,
    location: isOnline && !isHybrid
      ? {
          '@type': 'VirtualLocation',
          url,
        }
      : {
          '@type': 'Place',
          name: event.location_name || 'Local do evento',
          address: {
            '@type': 'PostalAddress',
            streetAddress: event.location_address,
            addressLocality: event.location_city || 'Balneário Camboriú',
            addressRegion: event.location_state || 'SC',
            addressCountry: 'BR',
          },
        },
    organizer: {
      '@id': `${SITE_URL}/#organization`,
    },
    performer: {
      '@type': 'Person',
      name: BRAND_NAME,
      url: SITE_URL,
    },
    offers: {
      '@type': 'Offer',
      url,
      price: 0,
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
      validFrom: event.created_at || event.updated_at,
    },
    maximumAttendeeCapacity: event.capacity || undefined,
    inLanguage: 'pt-BR',
  }
}
