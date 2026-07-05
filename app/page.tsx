import type { Metadata } from 'next'
import Image from 'next/image'
import { unstable_cache } from 'next/cache'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseAbortSignal, summarizeSupabaseError } from '@/lib/supabase/server'
import Link from 'next/link'
import { Building2, Home, Palmtree, Sparkles } from 'lucide-react'
import MobileNav from '@/components/marketplace/MobileNav'
import GlobalHeader from '@/components/layout/GlobalHeader'
import Footer from '@/components/layout/Footer'
import WhatsAppFloatingButton from '@/components/common/WhatsAppFloatingButton'
import AuthErrorRedirect from '@/components/auth/AuthErrorRedirect'
import MarketplaceHomeStyles from '@/components/marketplace/MarketplaceHomeStyles'
import HomepageSection from '@/components/marketplace/HomepageSection'
import HomeMapSearchSection from '@/components/marketplace/HomeMapSearchSection'
import AboutGuilhermeSection from '@/components/marketplace/AboutGuilhermeSection'
import GoogleReviewsSection from '@/components/marketplace/GoogleReviewsSection'
import YoutubeFeedSection from '@/components/marketplace/YoutubeFeedSection'
import HomeBlogSection, { type HomeBlogPost } from '@/components/marketplace/HomeBlogSection'
import PremiumCategoryAutoRail from '@/components/marketplace/PremiumCategoryAutoRail'
import HeroVideoBackground from '@/components/marketplace/HeroVideoBackground'
import { displayLocationName, normalizeLocationName } from '@/lib/locations/display'
import { isPropertyFrontSea, isPropertyLaunch } from '@/lib/properties/intelligence'
import { extractPropertyIdFromSeoSlug } from '@/lib/properties/seo-url'
import { attachBlogPostViewCounts, getBlogPostViewCounts } from '@/lib/blog/views'
import { getHomepageGoogleReviews } from '@/lib/google-reviews'
import { JsonLd, organizationJsonLd, websiteJsonLd, webPageJsonLd, absoluteUrl, DEFAULT_OG_IMAGE, isNewsLikeContent } from '@/lib/seo/json-ld'

export const metadata: Metadata = {
  title: 'Imóveis de luxo em Balneário Camboriú e litoral catarinense',
  description: 'Busque apartamentos, coberturas, casas de alto padrão e imóveis frente mar com a curadoria de Guilherme Pilger. Portfólio exclusivo acima de R$ 4 milhões em Santa Catarina.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Guilherme Pilger | Imóveis de luxo em Santa Catarina',
    description: 'Curadoria premium de imóveis acima de R$ 4 milhões no litoral catarinense. Apartamentos frente mar, coberturas e casas de alto padrão em Balneário Camboriú, Praia Brava e Itapema.',
    url: '/',
    type: 'website',
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Guilherme Pilger | Imóveis de luxo em Santa Catarina',
    description: 'Curadoria premium de imóveis acima de R$ 4 milhões no litoral catarinense. Apartamentos frente mar, coberturas e casas de alto padrão em Balneário Camboriú, Praia Brava e Itapema.',
    images: [DEFAULT_OG_IMAGE],
  },
}

export const revalidate = 300

const HOME_EXCLUDED_CITIES = new Set(['camboriu', 'navegantes', 'blumenau'])
const HOME_PROPERTY_DESCRIPTION_LIMIT = 320
const HOME_PROPERTY_IMAGE_LIMIT = 4
const HOME_MAP_MIN_PRICE = 4000000
const HOME_BASE_DATA_TIMEOUT_MS = 12000
const HOME_SECONDARY_DATA_TIMEOUT_MS = 8000
const HOME_BASE_REVALIDATE_SECONDS = 300
const HOME_PROPERTY_VIEW_EVENT_LIMIT = 12000
const HOME_LANDING_PAGE_VIEW_EVENT_LIMIT = 6000
const FEATURED_SECTION_DEFAULT_TITLE = 'Destaques'
const FEATURED_SECTION_LEGACY_TITLES = new Set(['selecao exclusiva', 'selecao em destaque'])
const HOME_BLOG_POST_LIMIT = 4
const HOME_PROPERTY_FIELDS = [
  'id',
  'source_slug',
  'title',
  'description',
  'city',
  'state',
  'price',
  'property_type',
  'bedrooms',
  'bathrooms',
  'area_m2',
  'area_private_m2',
  'featured_image',
  'images',
  'status',
  'created_at',
  'latitude',
  'longitude',
  'source_status',
  'purpose',
  'suites',
  'parking_spaces',
  'rent',
  'neighborhood',
  'exclusive',
  'amenities',
].join(',')

const HOME_BLOG_POST_FIELDS = [
  'id',
  'title',
  'slug',
  'excerpt',
  'cover_image_url',
  'category',
  'tags',
  'meta_description',
  'generated_by',
  'created_at',
  'published_at',
].join(',')

type HomeBaseData = {
  configRows: any[]
  properties: any[]
  landingPages: any[]
  blogPosts: HomeBlogPost[]
  warnings: {
    config?: string
    properties?: string
    landingPages?: string
    blogPosts?: string
  }
}

function emptyHomeBaseData(propertiesWarning?: string): HomeBaseData {
  return {
    configRows: [],
    properties: [],
    landingPages: [],
    blogPosts: [],
    warnings: propertiesWarning ? { properties: propertiesWarning } : {},
  }
}

const getCachedHomeBaseData = unstable_cache(
  async (): Promise<HomeBaseData> => {
    const supabase = createSupabaseAdminClient()
    const [
      configResult,
      propertiesResult,
      landingPagesResult,
      blogPostsResult,
    ] = await Promise.all([
      supabase
        .from('app_config')
        .select('key, value')
        .like('key', 'homepage_%')
        .abortSignal(createSupabaseAbortSignal(HOME_BASE_DATA_TIMEOUT_MS)),
      supabase
        .from('properties')
        .select(HOME_PROPERTY_FIELDS)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .abortSignal(createSupabaseAbortSignal(HOME_BASE_DATA_TIMEOUT_MS)),
      supabase
        .from('landing_pages')
        .select('id, slug, title, property_id, content')
        .eq('status', 'published')
        .abortSignal(createSupabaseAbortSignal(HOME_BASE_DATA_TIMEOUT_MS)),
      supabase
        .from('blog_posts')
        .select(HOME_BLOG_POST_FIELDS)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(16)
        .abortSignal(createSupabaseAbortSignal(HOME_BASE_DATA_TIMEOUT_MS)),
    ])

    if (propertiesResult.error) {
      throw new Error(`[Home] property feed unavailable: ${summarizeSupabaseError(propertiesResult.error)}`)
    }

    return {
      configRows: configResult.data || [],
      properties: (propertiesResult.data || []).map(compactHomeProperty),
      landingPages: landingPagesResult.data || [],
      blogPosts: (blogPostsResult.data || []) as unknown as HomeBlogPost[],
      warnings: {
        config: configResult.error ? summarizeSupabaseError(configResult.error) : undefined,
        landingPages: landingPagesResult.error ? summarizeSupabaseError(landingPagesResult.error) : undefined,
        blogPosts: blogPostsResult.error ? summarizeSupabaseError(blogPostsResult.error) : undefined,
      },
    }
  },
  ['marketplace-home-base-data-v2'],
  {
    revalidate: HOME_BASE_REVALIDATE_SECONDS,
    tags: ['marketplace-home'],
  }
)

async function getHomeBaseData() {
  try {
    return await getCachedHomeBaseData()
  } catch (error) {
    return emptyHomeBaseData(summarizeSupabaseError(error))
  }
}

function emptyBlogViewCounts(posts: HomeBlogPost[]) {
  const counts = new Map<string, number>()
  posts.forEach(post => {
    if (post?.id) counts.set(post.id, 0)
  })
  return counts
}

type HomeDevelopmentPage = {
  slug: string
  name: string
  locationName: string
  priceRange: string
  availableUnitsCount: number | null
  heroImage: string
}

function homeContentRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function homeText(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function homeNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function firstDevelopmentImage(content: Record<string, any>) {
  const development = homeContentRecord(content.development)
  const galleries = [
    ...(Array.isArray(content.custom_gallery) ? content.custom_gallery : []),
    ...(Array.isArray(development.gallery) ? development.gallery : []),
  ]

  for (const item of galleries) {
    const image = homeText(homeContentRecord(item).image)
    if (image) return image
  }

  return '/placeholder-house.jpg'
}

function buildHomeDevelopmentPages(landingPages: any[]): HomeDevelopmentPage[] {
  return landingPages
    .map((page) => {
      const content = homeContentRecord(page?.content)
      if (content.template && content.template !== 'brava-concetto') return null

      const development = homeContentRecord(content.development)
      const slug = homeText(page?.slug)
      if (!slug) return null
      const isBravaConcetto = slug === 'bravaconceto'

      return {
        slug,
        name: homeText(development.name, isBravaConcetto ? 'Brava Concetto' : homeText(content.custom_title, homeText(page?.title, 'Empreendimento'))),
        locationName: homeText(development.locationName ?? development.location_name, isBravaConcetto ? 'Praia Brava, Itajai - SC' : 'Litoral catarinense'),
        priceRange: homeText(development.priceRange ?? development.price_range, isBravaConcetto ? 'R$ 8.600.000 a R$ 21.000.000' : 'Consultar valores'),
        availableUnitsCount: homeNumber(development.availableUnitsCount ?? development.available_units_count ?? content.available_units_count) ?? (isBravaConcetto ? 3 : null),
        heroImage: isBravaConcetto
          ? homeText(development.heroImage ?? development.hero_image, '/images/brava-concetto/1_CL_BC_FACHADA_DIURNA_R01.jpg')
          : homeText(development.heroImage ?? development.hero_image ?? content.custom_hero_image, firstDevelopmentImage(content)),
      }
    })
    .filter((item): item is HomeDevelopmentPage => Boolean(item))
    .sort((a, b) => {
      if (a.slug === 'bravaconceto') return -1
      if (b.slug === 'bravaconceto') return 1
      return a.name.localeCompare(b.name, 'pt-BR')
    })
}

async function getHomeBlogViewCounts(supabase: ReturnType<typeof createSupabaseAdminClient>, posts: HomeBlogPost[]) {
  if (!posts.length) return emptyBlogViewCounts(posts)

  try {
    const timeout = new Promise<Map<string, number>>(resolve => {
      setTimeout(() => resolve(emptyBlogViewCounts(posts)), HOME_SECONDARY_DATA_TIMEOUT_MS)
    })
    return await Promise.race([getBlogPostViewCounts(supabase, posts), timeout])
  } catch (error) {
    console.warn('[Home] blog view counts unavailable:', summarizeSupabaseError(error))
    return emptyBlogViewCounts(posts)
  }
}

function mixHomeEditorialPosts(posts: HomeBlogPost[], limit: number) {
  const available = posts.filter(post => post?.id && post?.slug && post?.title)
  if (available.length <= limit) return available

  const news = available.filter(isNewsLikeContent)
  const blog = available.filter(post => !isNewsLikeContent(post))
  if (!news.length || !blog.length) return available.slice(0, limit)

  const first = available[0]
  const used = new Set<string>([first.id])
  const mixed = [first]
  let nextPool = isNewsLikeContent(first) ? blog : news
  let alternatePool = isNewsLikeContent(first) ? news : blog

  while (mixed.length < limit) {
    const candidate =
      nextPool.find(post => !used.has(post.id))
      || alternatePool.find(post => !used.has(post.id))
      || available.find(post => !used.has(post.id))

    if (!candidate) break
    mixed.push(candidate)
    used.add(candidate.id)
    const previousPool = nextPool
    nextPool = alternatePool
    alternatePool = previousPool
  }

  return mixed
}

function editorialDateMs(post: HomeBlogPost) {
  const value = post.published_at || post.created_at
  const time = value ? new Date(value).getTime() : 0
  return Number.isFinite(time) ? time : 0
}

function sortHomeEditorialPosts(posts: HomeBlogPost[]) {
  return [...posts].sort((a, b) => {
    const viewDiff = Number(b.view_count || 0) - Number(a.view_count || 0)
    if (viewDiff !== 0) return viewDiff
    return editorialDateMs(b) - editorialDateMs(a)
  })
}

function normalizeCityName(value: unknown) {
  return normalizeLocationName(value)
}

function isAllowedOnHome(property: any) {
  return !HOME_EXCLUDED_CITIES.has(normalizeCityName(property?.city))
}

function normalizeFeaturedSectionTitle(value: unknown) {
  const title = String(value || '').trim()
  if (!title || FEATURED_SECTION_LEGACY_TITLES.has(normalizeLocationName(title))) {
    return FEATURED_SECTION_DEFAULT_TITLE
  }
  return title
}

function compactHomeProperty(property: any) {
  const description = String(property.description || '')

  return {
    id: property.id,
    source_slug: property.source_slug,
    title: property.title,
    description: description.length > HOME_PROPERTY_DESCRIPTION_LIMIT
      ? `${description.slice(0, HOME_PROPERTY_DESCRIPTION_LIMIT)}...`
      : description,
    city: property.city,
    state: property.state,
    price: property.price,
    property_type: property.property_type,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    area_m2: property.area_m2,
    area_private_m2: property.area_private_m2,
    featured_image: property.featured_image,
    images: Array.isArray(property.images) ? property.images.filter(Boolean).slice(0, HOME_PROPERTY_IMAGE_LIMIT) : property.images,
    status: property.status,
    created_at: property.created_at,
    latitude: property.latitude,
    longitude: property.longitude,
    source_status: property.source_status,
    purpose: property.purpose,
    suites: property.suites,
    parking_spaces: property.parking_spaces,
    rent: property.rent,
    neighborhood: property.neighborhood,
    exclusive: property.exclusive,
    amenities: Array.isArray(property.amenities) ? property.amenities.slice(0, 6) : property.amenities,
  }
}

// This is a Server Component
export default async function MarketplaceHome() {
  const supabase = createSupabaseAdminClient()
  const homeBaseData = await getHomeBaseData()

  if (homeBaseData.warnings.config) {
    console.warn('[Home] homepage config unavailable:', homeBaseData.warnings.config)
  }

  if (homeBaseData.warnings.properties) {
    console.warn('[Home] property feed unavailable:', homeBaseData.warnings.properties)
  }

  if (homeBaseData.warnings.landingPages) {
    console.warn('[Home] landing page links unavailable:', homeBaseData.warnings.landingPages)
  }

  if (homeBaseData.warnings.blogPosts) {
    console.warn('[Home] blog posts unavailable:', homeBaseData.warnings.blogPosts)
  }

  const configMap: Record<string, string> = {}
  const configRows = homeBaseData.configRows
  configRows?.forEach((row: any) => { configMap[row.key] = row.value })

  const featuredTitle = normalizeFeaturedSectionTitle(configMap.homepage_featured_title)
  const featuredSort = configMap.homepage_featured_sort || 'price-desc'
  const featuredMinPrice = parseInt(configMap.homepage_featured_min_price) || 0
  const featuredMaxPrice = parseInt(configMap.homepage_featured_max_price) || 0
  const itemsPerSection = Math.min(20, Math.max(2, parseInt(configMap.homepage_items_per_section) || 8))

  let sectionsEnabled: string[] = ['featured', 'newest', 'cta', 'by_city']
  try { sectionsEnabled = JSON.parse(configMap.homepage_sections_enabled || '[]') } catch { }

  let featuredCities: string[] = ['Balneário Camboriú', 'Praia Brava', 'Itapema', 'Porto Belo']
  try { featuredCities = JSON.parse(configMap.homepage_featured_cities || '[]') } catch { }

  let manualFeaturedIds: string[] = []
  try { manualFeaturedIds = JSON.parse(configMap.homepage_featured_ids || '[]') } catch { }

  const allProperties = homeBaseData.properties
  const properties = (allProperties || []).map(compactHomeProperty)
  const rawHomeBlogPosts = homeBaseData.blogPosts
  const [homeBlogViewCounts, googleReviews] = await Promise.all([
    getHomeBlogViewCounts(supabase, rawHomeBlogPosts),
    getHomepageGoogleReviews(configMap),
  ])
  const homeBlogPostsWithViews = attachBlogPostViewCounts(rawHomeBlogPosts, homeBlogViewCounts)
  const homeBlogPosts = mixHomeEditorialPosts(
    sortHomeEditorialPosts(homeBlogPostsWithViews),
    HOME_BLOG_POST_LIMIT
  )
  const homeProperties = properties.filter(isAllowedOnHome)
  const isPropertyFeedUnavailable = Boolean(homeBaseData.warnings.properties)
  const homeMapProperties = homeProperties.filter(property => Number(property.price || property.rent || 0) >= HOME_MAP_MIN_PRICE)
  const luxuryCount = homeProperties.filter(p => Number(p.price || 0) >= 5000000).length
  const authorityCities = [
    {
      label: 'Balneário Camboriú',
      searchCity: 'Balneário Camboriú',
      aliases: ['balneario camboriu'],
      image: 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/homepage-cards/home-location-balneario-pixabay-5084547.jpg',
    },
    {
      label: 'Praia Brava',
      searchCity: 'Praia Brava',
      aliases: ['itajai', 'praia brava'],
      image: 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/homepage-cards/home-location-praia-brava-pexels-35912699.jpg',
    },
    {
      label: 'Itapema',
      searchCity: 'Itapema',
      aliases: ['itapema'],
      image: 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/homepage-cards/home-location-itapema-pixabay-4913509.jpg',
    },
    {
      label: 'Porto Belo',
      searchCity: 'Porto Belo',
      aliases: ['porto belo'],
      image: 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/homepage-cards/home-location-porto-belo-pexels-34054775.jpg',
    },
  ].map(city => ({
    ...city,
    href: `/busca?city=${encodeURIComponent(city.searchCity)}`,
    count: homeProperties.filter(property => {
      const cityName = normalizeCityName(property?.city)
      const displayName = normalizeCityName(displayLocationName(property?.city))
      return city.aliases.includes(cityName) || city.aliases.includes(displayName)
    }).length,
  }))
  const launchCount = homeProperties.filter(isPropertyLaunch).length
  const premiumCategories = [
    {
      title: 'Frente mar',
      subtitle: 'Vista, desejo e liquidez',
      href: '/busca?tag=frente-mar',
      icon: Palmtree,
      image: 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/homepage-cards/home-lifestyle-frente-mar-pexels-27349378.jpg',
    },
    {
      title: 'Coberturas',
      subtitle: 'Privacidade no alto',
      href: '/busca?subtype=cobertura',
      icon: Building2,
      image: 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/homepage-cards/home-lifestyle-coberturas-pexels-36362.jpg',
    },
    {
      title: 'Lançamentos',
      subtitle: `${launchCount || 'Novas'} oportunidades`,
      href: '/busca?tag=lancamento',
      icon: Sparkles,
      image: 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/homepage-cards/home-lifestyle-lancamentos-pexels-34775531.jpg',
    },
    {
      title: 'Casas de alto padrão',
      subtitle: `${luxuryCount || 'Curadoria'} acima de R$ 5 mi`,
      href: '/busca?type=casa&priceMin=5000000',
      icon: Home,
      image: 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/homepage-cards/home-lifestyle-casas-alto-padrao-pexels-36394726.jpg',
    },
  ]
  const homeJsonLd = [
    organizationJsonLd(),
    websiteJsonLd(),
    webPageJsonLd({
      path: '/',
      name: 'Imóveis de luxo em Balneário Camboriú e litoral catarinense',
      description: 'Busque apartamentos, coberturas, casas de alto padrão e imóveis frente mar com a curadoria de Guilherme Pilger.',
      type: 'WebPage',
    }),
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Buscas premium de imóveis no litoral catarinense',
      itemListElement: premiumCategories.map((category, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: category.title,
        description: category.subtitle,
        url: absoluteUrl(category.href),
      })),
    },
  ]

  // Also fetch any landing pages linked to properties
  const landingPages = homeBaseData.landingPages
  const developmentPages = buildHomeDevelopmentPages(landingPages || [])
  const lpMap = new Map()
  landingPages?.forEach((lp: any) => {
    lpMap.set(lp.property_id, lp.slug)
  })

  let funnelEvents: any[] = []
  const landingPageIds = (landingPages || []).map((lp: any) => lp.id).filter(Boolean)
  const shouldLoadDemandEvents = homeProperties.length > 0
  const [propertyViewEventsResult, landingPageViewEventsResult] = shouldLoadDemandEvents
    ? await Promise.all([
      supabase
        .from('funnel_events')
        .select('landing_page_id, event_type, metadata, created_at')
        .eq('event_type', 'property_details_landing_viewed')
        .order('created_at', { ascending: false })
        .limit(HOME_PROPERTY_VIEW_EVENT_LIMIT)
        .abortSignal(createSupabaseAbortSignal()),
      landingPageIds.length > 0
        ? supabase
          .from('funnel_events')
          .select('landing_page_id, event_type, metadata, created_at')
          .in('landing_page_id', landingPageIds)
          .eq('event_type', 'page_view')
          .order('created_at', { ascending: false })
          .limit(HOME_LANDING_PAGE_VIEW_EVENT_LIMIT)
          .abortSignal(createSupabaseAbortSignal())
        : Promise.resolve({ data: [], error: null }),
    ])
    : [{ data: [], error: null }, { data: [], error: null }]

  if (propertyViewEventsResult.error) {
    console.warn('[Home] property view events unavailable:', summarizeSupabaseError(propertyViewEventsResult.error))
  }

  if (landingPageViewEventsResult.error) {
    console.warn('[Home] landing page view events unavailable:', summarizeSupabaseError(landingPageViewEventsResult.error))
  }

  funnelEvents = [
    ...(propertyViewEventsResult.data || []),
    ...(landingPageViewEventsResult.data || []),
  ]

  // === BUILD SECTIONS ===

  // 1. Featured / Destaques
  let featured: any[] = []
  if (featuredSort === 'manual' && manualFeaturedIds.length > 0) {
    // Manual selection
    featured = manualFeaturedIds
      .map(id => homeProperties.find(p => p.id === id))
      .filter(Boolean)
      .slice(0, itemsPerSection)
  } else {
    // Auto: filter by price, then sort
    let pool = homeProperties.filter(p => p.price && p.price > 0)
    if (featuredMinPrice > 0) pool = pool.filter(p => p.price >= featuredMinPrice)
    if (featuredMaxPrice > 0) pool = pool.filter(p => p.price <= featuredMaxPrice)

    if (featuredSort === 'price-asc') {
      pool.sort((a, b) => (a.price || 0) - (b.price || 0))
    } else if (featuredSort === 'newest') {
      // already sorted by created_at desc
    } else {
      // price-desc (default)
      pool.sort((a, b) => (b.price || 0) - (a.price || 0))
    }
    featured = pool.slice(0, itemsPerSection)
  }

  // 2. Newest
  const newest = homeProperties.slice(0, itemsPerSection)

  // 2.1 Most viewed / demand ranking
  const mostViewed = buildMostViewedProperties(
    homeProperties,
    landingPages || [],
    funnelEvents,
    itemsPerSection,
    new Set(featured.map((p: any) => p.id))
  )

  // 3. By City
  const allowedFeaturedCities = featuredCities.filter(city => !HOME_EXCLUDED_CITIES.has(normalizeCityName(city)))
  const citySections = buildCitySections(homeProperties, allowedFeaturedCities, itemsPerSection)

  // 4. Premium tag sections
  const exclusiveProperties = homeProperties
    .filter(p => Boolean(p.exclusive))
    .slice(0, itemsPerSection)

  const launches = homeProperties
    .filter(isPropertyLaunch)
    .slice(0, itemsPerSection)

  const frontSeaProperties = homeProperties
    .filter(isPropertyFrontSea)
    .slice(0, itemsPerSection)

  // Categories are now managed directly by CategoriesCarousel

  return (
    <>
      <MarketplaceHomeStyles />
      <AuthErrorRedirect />
      <GlobalHeader />
      <JsonLd data={homeJsonLd} />

      <main className="marketplace-container">
      {/* === GUILHERME-FIRST HERO === */}
      <div className="hero-strip home-premium-hero" style={{ position: 'relative', width: '100%', height: '480px', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: '24px', background: 'linear-gradient(180deg, #f0ede8 0%, #f7f7f5 100%)' }}>
        <div className="hero-top-fade" />
        <div className="hero-image-bg" style={{ position: 'absolute', inset: '0', zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <HeroVideoBackground />
        </div>
        <div className="hero-photo-glow" />
        <div className="hero-overlay" />
        <div className="hero-content home-hero-content">
          <Image src="https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/LOGO%20PILGER.png" alt="Guilherme Pilger" width={420} height={60} style={{ objectFit: 'contain', objectPosition: 'center bottom', width: 'min(650px, 92vw)', height: '220px', display: 'block', margin: '0 auto -72px' }} />
          <h1 className="hero-subtitle-top hero-title-imoveis" style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 'clamp(2rem, 9vw, 3.2rem)', fontWeight: 300, fontStyle: 'italic', lineHeight: 1.1, marginBottom: '2px' }}>Imóveis de alto padrão</h1>
          <p className="hero-subtitle-region" style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 'clamp(0.78rem, 3.4vw, 1.1rem)', fontWeight: 500, color: '#16130f', margin: 0, lineHeight: 1.3 }}>em Balneário Camboriú e Região</p>
        </div>
      </div>

      <HomeMapSearchSection properties={homeMapProperties} />

      {developmentPages.length > 0 && (
        <section id="empreendimentos" className="home-developments-section" aria-labelledby="home-developments-title">
          <div className="home-developments-head">
            <span>Empreendimentos</span>
            <h2 id="home-developments-title">Landing pages exclusivas dos empreendimentos</h2>
            <p>Veja os predios e condominios em destaque, com unidades, localizacao e detalhes reunidos em uma pagina propria.</p>
          </div>
          <div className="home-developments-grid">
            {developmentPages.map(development => (
              <Link key={development.slug} href={`/${development.slug}`} className="home-development-card">
                <Image
                  src={development.heroImage}
                  alt={development.name}
                  fill
                  sizes="(max-width: 760px) 72vw, (max-width: 1200px) 33vw, 260px"
                  className="home-development-image"
                />
                <span className="home-development-shade" />
                <span className="home-development-copy">
                  <small>{development.locationName}</small>
                  <strong>{development.name}</strong>
                  <em>
                    {development.availableUnitsCount
                      ? `${development.availableUnitsCount} unidades`
                      : development.priceRange}
                  </em>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="gp-authority-strip">
        <div className="gp-authority-copy">
          <h2>Escolha pela localização</h2>
        </div>
        <div className="gp-authority-stats">
          {authorityCities.map(city => (
            <Link href={city.href} key={city.label} className="gp-location-card">
              <Image
                src={city.image}
                alt={`Imóveis em ${city.label}`}
                className="gp-location-image"
                fill
                sizes="(max-width: 649px) 44vw, 25vw"
              />
              <span className="gp-location-shade" />
              <span className="gp-location-copy">
                <strong>{city.label}</strong>
                <small>
                  {isPropertyFeedUnavailable ? 'Ver imóveis' : <><b>{city.count.toLocaleString('pt-BR')}</b> imóveis</>}
                </small>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="premium-categories-showcase">
        <div className="premium-section-head">
          <h2>Escolha pelo estilo de vida</h2>
        </div>
        <PremiumCategoryAutoRail>
          {premiumCategories.map((category) => {
            const Icon = category.icon
            return (
              <Link href={category.href} className="premium-category-card" key={category.title} style={{ position: 'relative', overflow: 'hidden' }}>
                <Image
                  src={category.image}
                  alt={category.title}
                  className="premium-category-image"
                  fill
                  sizes="(max-width: 649px) 44vw, 280px"
                />
                <span className="premium-category-shade" />
                <span className="premium-category-icon"><Icon size={17} /></span>
                <span className="premium-category-copy">
                  <strong>{category.title}</strong>
                  <small>{category.subtitle}</small>
                </span>
              </Link>
            )
          })}
        </PremiumCategoryAutoRail>
      </section>

      {/* === HOMEPAGE SECTIONS (admin controlled) === */}
      <div className="listings-section">

        <HomepageSection
          title="Exclusivos"
          subtitle="Gestão exclusiva confirmada no cadastro"
          properties={exclusiveProperties}
          lpMap={lpMap}
          viewAllHref="/busca?exclusive=1"
          viewAllLabel="Ver todos"
        />

        <HomepageSection
          title="Lançamentos"
          subtitle="Na planta, em construção e oportunidades de entrada"
          properties={launches}
          lpMap={lpMap}
          viewAllHref="/busca?tag=lancamento"
          viewAllLabel="Ver todos"
        />

        <HomepageSection
          title="Frente mar"
          subtitle="Imóveis com leitura direta de mar e localização premium"
          properties={frontSeaProperties}
          lpMap={lpMap}
          viewAllHref="/busca?tag=frente-mar"
          viewAllLabel="Ver todos"
        />

        {sectionsEnabled.includes('featured') && (
          <HomepageSection
            title={featuredTitle}
            subtitle="Seleção premium"
            properties={featured}
            lpMap={lpMap}
            viewAllHref="/busca?sort=price-desc"
            viewAllLabel="Ver todos"
          />
        )}

        {mostViewed.length > 0 && (
          <HomepageSection
            title="Mais Vistos"
            titleIcon="eye"
            subtitle="As oportunidades que mais chamam atenção de quem busca alto padrão"
            properties={mostViewed}
            lpMap={lpMap}
            viewAllHref="/busca"
            viewAllLabel="Ver todos"
          />
        )}

        {sectionsEnabled.includes('newest') && (
          <HomepageSection
            title="Recém Adicionados"
            subtitle="Os mais novos do portfólio"
            properties={newest}
            lpMap={lpMap}
            viewAllHref="/busca?sort=newest"
            viewAllLabel="Ver todos"
          />
        )}

        {sectionsEnabled.includes('by_city') && citySections.map(({ city, searchCity, items }) => (
          <HomepageSection
            key={city}
            title={city}
            properties={items}
            lpMap={lpMap}
            viewAllHref={`/busca?city=${encodeURIComponent(searchCity)}`}
          />
        ))}

      </div>
      
      <AboutGuilhermeSection />
      <GoogleReviewsSection data={googleReviews} />
      <YoutubeFeedSection />
      <HomeBlogSection posts={homeBlogPosts} />

        <Footer />
      </main>
      <WhatsAppFloatingButton />
      <MobileNav />
    </>
  )
}


// === Helper: Build city sections ===
function buildCitySections(properties: any[], cities: string[], limit: number) {
  const cityMap = new Map<string, { searchCity: string; items: any[] }>()

  for (const p of properties) {
    const propertyCity = p.city?.trim()
    if (!propertyCity) continue
    const normalizedCity = propertyCity.toLowerCase()
    const normalizedDisplayCity = displayLocationName(propertyCity).toLowerCase()
    const match = cities.find(c => {
      const normalizedTarget = c.toLowerCase()
      return normalizedCity === normalizedTarget || normalizedDisplayCity === normalizedTarget
    })
    if (!match) continue
    if (!cityMap.has(match)) cityMap.set(match, { searchCity: propertyCity, items: [] })
    cityMap.get(match)!.items.push(p)
  }

  return cities
    .filter(city => cityMap.has(city) && cityMap.get(city)!.items.length >= 2)
    .map(city => ({
      city: displayLocationName(city),
      searchCity: displayLocationName(cityMap.get(city)!.searchCity),
      items: cityMap.get(city)!.items.slice(0, limit),
    }))
}

function buildMostViewedProperties(
  properties: any[],
  landingPages: any[],
  events: any[],
  limit: number,
  excludeIds: Set<string>
) {
  const landingPageToProperty = new Map<string, string>()
  landingPages.forEach((lp: any) => {
    if (lp.id && lp.property_id) landingPageToProperty.set(lp.id, lp.property_id)
  })

  const viewCounts = new Map<string, number>()
  events.forEach((event: any) => {
    const propertyId = propertyIdFromViewEvent(event, landingPageToProperty)
    if (!propertyId) return
    viewCounts.set(propertyId, (viewCounts.get(propertyId) || 0) + 1)
  })

  const hasRealViews = Array.from(viewCounts.values()).some(count => count > 0)
  const scored = properties
    .filter(property => property?.id && property.status === 'active')
    .map(property => {
      const viewCount = viewCounts.get(property.id) || 0
      const fallback = demandScore(property)
      return {
        property: {
          ...property,
          view_count: viewCount,
        },
        viewCount,
        fallback,
      }
    })
    .sort((a, b) => {
      if (hasRealViews && b.viewCount !== a.viewCount) return b.viewCount - a.viewCount
      if (b.fallback !== a.fallback) return b.fallback - a.fallback
      return Number(b.property.price || 0) - Number(a.property.price || 0)
    })
    .map(item => item.property)

  if (hasRealViews) {
    return scored.slice(0, limit)
  }

  const withoutFeatured = scored.filter(property => !excludeIds.has(property.id))
  const pool = withoutFeatured.length >= Math.min(2, limit) ? withoutFeatured : scored

  return pool.slice(0, limit)
}

function metadataRecord(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }

  return {}
}

function propertyIdFromViewEvent(event: any, landingPageToProperty: Map<string, string>) {
  const metadata = metadataRecord(event?.metadata)
  const directId = metadata.property_id
    || metadata.target_property_id
    || metadata.lead_property_id

  if (directId) return String(directId)

  if (event?.landing_page_id) {
    const propertyId = landingPageToProperty.get(String(event.landing_page_id))
    if (propertyId) return propertyId
  }

  const path = String(
    metadata.property_slug
    || metadata.property_path
    || metadata.page_path
    || metadata.pathname
    || metadata.page_url
    || ''
  )

  return extractPropertyIdFromSeoSlug(path)
}

function demandScore(property: any) {
  const price = Number(property.price || 0)
  const text = `${property.title || ''} ${property.description || ''} ${property.property_type || ''} ${property.source_status || ''}`.toLowerCase()

  let score = Math.min(price / 100000, 120)
  if (property.featured_image || (Array.isArray(property.images) && property.images.length > 0)) score += 12
  if (property.exclusive) score += 18
  if (price >= 5000000) score += 22
  if (text.includes('frente') && text.includes('mar')) score += 18
  if (text.includes('cobertura')) score += 14
  if (text.includes('lançamento') || text.includes('lancamento') || text.includes('na planta')) score += 10
  if (property.city && ['balneário camboriú', 'balneario camboriu', 'itajai', 'itajaí', 'itapema', 'porto belo'].includes(property.city.toLowerCase())) score += 8

  return score
}
