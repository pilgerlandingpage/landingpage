import type { Metadata } from 'next'
import Image from 'next/image'
import { unstable_cache } from 'next/cache'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseAbortSignal, summarizeSupabaseError } from '@/lib/supabase/server'
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
import HeroVideoBackground from '@/components/marketplace/HeroVideoBackground'
import { normalizeLocationName } from '@/lib/locations/display'
import { isPropertyFrontSea, isPropertyLaunch } from '@/lib/properties/intelligence'
import { extractPropertyIdFromSeoSlug } from '@/lib/properties/seo-url'
import { attachBlogPostViewCounts, getBlogPostViewCounts } from '@/lib/blog/views'
import { getHomepageGoogleReviews } from '@/lib/google-reviews'
import { JsonLd, organizationJsonLd, websiteJsonLd, webPageJsonLd, DEFAULT_OG_IMAGE, isNewsLikeContent } from '@/lib/seo/json-ld'

export const metadata: Metadata = {
  title: 'Imóveis de luxo em Balneário Camboriú e litoral catarinense',
  description: 'Imóveis de luxo, apartamentos frente mar e coberturas com curadoria Guilherme Pilger em Balneário Camboriú e litoral catarinense.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Guilherme Pilger | Imóveis de luxo em Santa Catarina',
    description: 'Curadoria premium de imóveis frente mar, coberturas e casas de alto padrão em Balneário Camboriú, Praia Brava e Itapema.',
    url: '/',
    type: 'website',
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Guilherme Pilger | Imóveis de luxo em Santa Catarina',
    description: 'Curadoria premium de imóveis frente mar, coberturas e casas de alto padrão em Balneário Camboriú, Praia Brava e Itapema.',
    images: [DEFAULT_OG_IMAGE],
  },
}

export const revalidate = 300

const HOME_EXCLUDED_CITIES = new Set(['camboriu', 'navegantes', 'blumenau'])
const HOME_PROPERTY_DESCRIPTION_LIMIT = 240
const HOME_PROPERTY_IMAGE_LIMIT = 2
const HOME_MAP_MIN_PRICE = 4000000
const HOME_BASE_DATA_TIMEOUT_MS = 12000
const HOME_SECONDARY_DATA_TIMEOUT_MS = 8000
const HOME_BASE_REVALIDATE_SECONDS = 300
const HOME_PROPERTY_FEED_LIMIT = 480
const HOME_PROPERTY_FALLBACK_LIMIT = 120
const HOME_PROPERTY_VIEW_EVENT_LIMIT = 2000
const HOME_LANDING_PAGE_VIEW_EVENT_LIMIT = 1000
const HOME_SECTION_PROPERTY_LIMIT = 4
const DEFAULT_HOME_SECTIONS = ['newest', 'cta']
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

function shouldAbortHomeCache(message: string) {
  return /timeout|aborted|fetch failed|statement timeout|supabase\.co|error code 52[12]|web server is down|connection timed out/i.test(message)
}

async function fetchHomeProperties(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const runQuery = (limit: number, timeoutMs: number) => supabase
    .from('properties')
    .select(HOME_PROPERTY_FIELDS)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit)
    .abortSignal(createSupabaseAbortSignal(timeoutMs))

  try {
    const primaryResult = await runQuery(HOME_PROPERTY_FEED_LIMIT, HOME_BASE_DATA_TIMEOUT_MS)
    if (!primaryResult.error) {
      return {
        data: primaryResult.data || [],
        warning: undefined,
      }
    }

    const primaryWarning = summarizeSupabaseError(primaryResult.error)
    const fallbackResult = await runQuery(HOME_PROPERTY_FALLBACK_LIMIT, HOME_BASE_DATA_TIMEOUT_MS)
    if (!fallbackResult.error) {
      console.warn('[Home] property feed primary query unavailable, fallback used:', primaryWarning)
      return {
        data: fallbackResult.data || [],
        warning: undefined,
      }
    }

    return {
      data: [],
      warning: summarizeSupabaseError(fallbackResult.error) || primaryWarning,
    }
  } catch (error) {
    const primaryWarning = summarizeSupabaseError(error)

    try {
      const fallbackResult = await runQuery(HOME_PROPERTY_FALLBACK_LIMIT, HOME_SECONDARY_DATA_TIMEOUT_MS)
      if (!fallbackResult.error) {
        console.warn('[Home] property feed primary query failed, fallback used:', primaryWarning)
        return {
          data: fallbackResult.data || [],
          warning: undefined,
        }
      }

      return {
        data: [],
        warning: summarizeSupabaseError(fallbackResult.error) || primaryWarning,
      }
    } catch (fallbackError) {
      return {
        data: [],
        warning: summarizeSupabaseError(fallbackError) || primaryWarning,
      }
    }
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
      fetchHomeProperties(supabase),
      supabase
        .from('landing_pages')
        .select('id, slug, property_id')
        .eq('status', 'published')
        .or('content->>home_featured.is.null,content->>home_featured.neq.false')
        .order('created_at', { ascending: true })
        .abortSignal(createSupabaseAbortSignal(HOME_BASE_DATA_TIMEOUT_MS)),
      supabase
        .from('blog_posts')
        .select(HOME_BLOG_POST_FIELDS)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(16)
        .abortSignal(createSupabaseAbortSignal(HOME_BASE_DATA_TIMEOUT_MS)),
    ])

    if (propertiesResult.warning && (!propertiesResult.data || propertiesResult.data.length === 0)) {
      throw new Error(`[Home] critical property feed unavailable: ${propertiesResult.warning}`)
    }

    return {
      configRows: configResult.data || [],
      properties: (propertiesResult.data || []).map(compactHomeProperty),
      landingPages: landingPagesResult.data || [],
      blogPosts: (blogPostsResult.data || []) as unknown as HomeBlogPost[],
      warnings: {
        config: configResult.error ? summarizeSupabaseError(configResult.error) : undefined,
        properties: propertiesResult.warning,
        landingPages: landingPagesResult.error ? summarizeSupabaseError(landingPagesResult.error) : undefined,
        blogPosts: blogPostsResult.error ? summarizeSupabaseError(blogPostsResult.error) : undefined,
      },
    }
  },
  ['marketplace-home-base-data-v4'],
  {
    revalidate: HOME_BASE_REVALIDATE_SECONDS,
    tags: ['marketplace-home'],
  }
)

async function getHomeBaseData() {
  try {
    return await getCachedHomeBaseData()
  } catch (error) {
    const warning = summarizeSupabaseError(error)
    if (shouldAbortHomeCache(warning)) {
      console.warn('[Home] critical base data unavailable, rendering fallback:', warning)
      return emptyHomeBaseData(warning)
    }
    return emptyHomeBaseData(warning)
  }
}

function emptyBlogViewCounts(posts: HomeBlogPost[]) {
  const counts = new Map<string, number>()
  posts.forEach(post => {
    if (post?.id) counts.set(post.id, 0)
  })
  return counts
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

function parseHomeSectionsEnabled(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return [...DEFAULT_HOME_SECTIONS]

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [...DEFAULT_HOME_SECTIONS]
  } catch {
    return [...DEFAULT_HOME_SECTIONS]
  }
}

function compactHomeProperty(property: any) {
  const description = String(property.description || '')
  const isLaunch = isPropertyLaunch(property)

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
    is_launch: isLaunch,
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

  const itemsPerSection = Math.min(
    HOME_SECTION_PROPERTY_LIMIT,
    Math.max(2, parseInt(configMap.homepage_items_per_section) || HOME_SECTION_PROPERTY_LIMIT)
  )

  const sectionsEnabled = parseHomeSectionsEnabled(configMap.homepage_sections_enabled)

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
  const homeMapProperties = homeProperties.filter(property => Number(property.price || property.rent || 0) >= HOME_MAP_MIN_PRICE)
  const homeJsonLd = [
    organizationJsonLd(),
    websiteJsonLd(),
    webPageJsonLd({
      path: '/',
      name: 'Imóveis de luxo em Balneário Camboriú e litoral catarinense',
      description: 'Busque apartamentos, coberturas, casas de alto padrão e imóveis frente mar com a curadoria de Guilherme Pilger.',
      type: 'WebPage',
    }),
  ]

  // Also fetch any landing pages linked to properties
  const landingPages = homeBaseData.landingPages
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
        .select('landing_page_id, metadata')
        .eq('event_type', 'property_details_landing_viewed')
        .order('created_at', { ascending: false })
        .limit(HOME_PROPERTY_VIEW_EVENT_LIMIT)
        .abortSignal(createSupabaseAbortSignal()),
      landingPageIds.length > 0
        ? supabase
          .from('funnel_events')
          .select('landing_page_id, metadata')
          .not('landing_page_id', 'is', null)
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

  // 2. Newest
  const newest = homeProperties.slice(0, itemsPerSection)

  // 2.1 Most viewed / demand ranking
  const mostViewed = buildMostViewedProperties(
    homeProperties,
    landingPages || [],
    funnelEvents,
    itemsPerSection,
    new Set<string>()
  )

  // 3. Premium tag sections
  const exclusiveProperties = homeProperties
    .filter(p => Boolean(p.exclusive))
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

      {/* === HOMEPAGE SECTIONS (admin controlled) === */}
      <div className="listings-section">

        <HomepageSection
          title="Frente mar"
          subtitle="Imóveis com leitura direta de mar e localização premium"
          properties={frontSeaProperties}
          lpMap={lpMap}
          viewAllHref="/busca?tag=frente-mar"
          viewAllLabel="Ver todos"
        />

        <HomepageSection
          title="Mais Vistos"
          titleIcon="eye"
          subtitle="As oportunidades que mais chamam atenção de quem busca alto padrão"
          properties={mostViewed}
          lpMap={lpMap}
          viewAllHref="/busca"
          viewAllLabel="Ver todos"
        />

        <HomepageSection
          title="Exclusivos"
          subtitle="Gestão exclusiva confirmada no cadastro"
          properties={exclusiveProperties}
          lpMap={lpMap}
          viewAllHref="/busca?exclusive=1"
          viewAllLabel="Ver todos"
        />

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

      </div>
      
      <AboutGuilhermeSection />
      <GoogleReviewsSection data={googleReviews} />
      <YoutubeFeedSection />
      <HomeBlogSection posts={homeBlogPosts} />

        <Footer showGoogleReviews={false} />
      </main>
      <WhatsAppFloatingButton />
      <MobileNav />
    </>
  )
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
  if (text.includes('lançamento') || text.includes('lancamento') || text.includes('na planta') || text.includes('construção') || text.includes('construcao') || text.includes('obra')) score += 10
  if (property.city && ['balneário camboriú', 'balneario camboriu', 'itajai', 'itajaí', 'itapema', 'porto belo'].includes(property.city.toLowerCase())) score += 8

  return score
}
