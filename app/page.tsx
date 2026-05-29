import type { Metadata } from 'next'
import Image from 'next/image'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Building2, Camera, Crown, Home, Palmtree, Sparkles } from 'lucide-react'
import MobileNav from '@/components/marketplace/MobileNav'
import GlobalHeader from '@/components/layout/GlobalHeader'
import Footer from '@/components/layout/Footer'
import WhatsAppFloatingButton from '@/components/common/WhatsAppFloatingButton'
import AuthErrorRedirect from '@/components/auth/AuthErrorRedirect'
import MarketplaceHomeStyles from '@/components/marketplace/MarketplaceHomeStyles'
import HomepageSection from '@/components/marketplace/HomepageSection'
import HomeMapSearchSection from '@/components/marketplace/HomeMapSearchSection'
import AboutGuilhermeSection from '@/components/marketplace/AboutGuilhermeSection'
import YoutubeFeedSection from '@/components/marketplace/YoutubeFeedSection'
import PremiumCategoryAutoRail from '@/components/marketplace/PremiumCategoryAutoRail'
import HeroVideoBackground from '@/components/marketplace/HeroVideoBackground'
import { getPublicMarketRadarFeed } from '@/lib/market-radar/public-feed'
import { displayLocationName, normalizeLocationName } from '@/lib/locations/display'
import { JsonLd, organizationJsonLd, websiteJsonLd, webPageJsonLd, absoluteUrl, DEFAULT_OG_IMAGE } from '@/lib/seo/json-ld'

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
const HOME_MAP_MIN_PRICE = 4000000
const HOME_PROPERTY_FIELDS = [
  'id',
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

function normalizeCityName(value: unknown) {
  return normalizeLocationName(value)
}

function isAllowedOnHome(property: any) {
  return !HOME_EXCLUDED_CITIES.has(normalizeCityName(property?.city))
}

function compactHomeProperty(property: any) {
  const description = String(property.description || '')

  return {
    id: property.id,
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
  const marketFeed = await getPublicMarketRadarFeed()

  // === LOAD CONFIG ===
  const { data: configRows } = await supabase
    .from('app_config')
    .select('key, value')
    .like('key', 'homepage_%')

  const configMap: Record<string, string> = {}
  configRows?.forEach((row: any) => { configMap[row.key] = row.value })

  const featuredTitle = configMap.homepage_featured_title || 'Seleção Exclusiva'
  const featuredSort = configMap.homepage_featured_sort || 'price-desc'
  const featuredMinPrice = parseInt(configMap.homepage_featured_min_price) || 0
  const featuredMaxPrice = parseInt(configMap.homepage_featured_max_price) || 0
  const itemsPerSection = Math.min(20, Math.max(2, parseInt(configMap.homepage_items_per_section) || 8))

  let sectionsEnabled: string[] = ['featured', 'newest', 'cta', 'by_city']
  try { sectionsEnabled = JSON.parse(configMap.homepage_sections_enabled || '[]') } catch { }

  let featuredCities: string[] = ['Balneário Camboriú', 'Itajaí', 'Itapema', 'Porto Belo']
  try { featuredCities = JSON.parse(configMap.homepage_featured_cities || '[]') } catch { }

  let manualFeaturedIds: string[] = []
  try { manualFeaturedIds = JSON.parse(configMap.homepage_featured_ids || '[]') } catch { }

  // Fetch all active properties
  const { data: allProperties } = await supabase
    .from('properties')
    .select(HOME_PROPERTY_FIELDS)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const properties = (allProperties || []).map(compactHomeProperty)
  const homeProperties = properties.filter(isAllowedOnHome)
  const homeMapProperties = homeProperties.filter(property => Number(property.price || property.rent || 0) >= HOME_MAP_MIN_PRICE)
  const luxuryCount = homeProperties.filter(p => Number(p.price || 0) >= 5000000).length
  const authorityCities = [
    { label: 'Balneário', searchCity: 'Balneário Camboriú', aliases: ['balneario camboriu'] },
    { label: 'Praia Brava', searchCity: 'Itajaí', aliases: ['itajai', 'praia brava'] },
    { label: 'Itapema', searchCity: 'Itapema', aliases: ['itapema'] },
    { label: 'Porto Belo', searchCity: 'Porto Belo', aliases: ['porto belo'] },
  ].map(city => ({
    ...city,
    href: `/busca?city=${encodeURIComponent(city.searchCity)}`,
    count: homeProperties.filter(property => {
      const cityName = normalizeCityName(property?.city)
      const displayName = normalizeCityName(displayLocationName(property?.city))
      return city.aliases.includes(cityName) || city.aliases.includes(displayName)
    }).length,
  }))
  const launchCount = homeProperties.filter(p => {
    const text = `${p.title || ''} ${p.description || ''} ${p.source_status || ''}`.toLowerCase()
    return text.includes('lancamento') || text.includes('lançamento') || text.includes('construcao') || text.includes('construção') || text.includes('na planta')
  }).length
  const premiumCategories = [
    {
      title: 'Frente mar',
      subtitle: 'Vista, desejo e liquidez',
      href: '/busca?tag=frente-mar',
      icon: Palmtree,
      image: '/images/brava-concetto/15_CL_BC_PISCINA_EF_web.jpg',
    },
    {
      title: 'Coberturas',
      subtitle: 'Privacidade no alto',
      href: '/busca?subtype=cobertura',
      icon: Building2,
      image: '/images/brava-concetto/25_CL_BC_LIVING_TERRACO_COBERTURA_R01_web.jpg',
    },
    {
      title: 'Lançamentos',
      subtitle: `${launchCount || 'Novas'} oportunidades`,
      href: '/busca?tag=lancamento',
      icon: Sparkles,
      image: '/images/brava-concetto/1_CL_BC_FACHADA_DIURNA_R01.jpg',
    },
    {
      title: 'Casas de alto padrão',
      subtitle: `${luxuryCount || 'Curadoria'} acima de R$ 5 mi`,
      href: '/busca?type=casa&priceMin=5000000',
      icon: Home,
      image: '/images/brava-concetto/25_CL_BC_LIVING_TERRACO_COBERTURA_R01_web.jpg',
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
  const { data: landingPages } = await supabase
    .from('landing_pages')
    .select('id, slug, property_id')
    .eq('status', 'published')

  const lpMap = new Map()
  landingPages?.forEach((lp: any) => {
    lpMap.set(lp.property_id, lp.slug)
  })

  let funnelEvents: any[] = []
  const landingPageIds = (landingPages || []).map((lp: any) => lp.id).filter(Boolean)
  if (landingPageIds.length > 0) {
    const { data: eventRows } = await supabase
      .from('funnel_events')
      .select('landing_page_id, event_type, created_at')
      .in('landing_page_id', landingPageIds)
      .in('event_type', ['page_view', 'cookie_consent', 'chat_opened', 'form_submitted', 'whatsapp_property_click', 'whatsapp_link_click'])
      .order('created_at', { ascending: false })
      .limit(2000)

    funnelEvents = eventRows || []
  }

  // === BUILD SECTIONS ===

  // 1. Featured / Seleção Exclusiva
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

  // 4. Launches
  const launches = homeProperties
    .filter(p => {
      const desc = (p.description || '').toLowerCase()
      const title = (p.title || '').toLowerCase()
      return desc.includes('lançamento') || desc.includes('lancamento') ||
             title.includes('lançamento') || title.includes('lancamento') ||
             desc.includes('em construção') || desc.includes('na planta')
    })
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
        <Image
          className="hero-bg-image"
          src="https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/Untitled%20design(9).png"
          alt="Guilherme Pilger"
          width={1920}
          height={1080}
          priority
          fetchPriority="high"
          quality={68}
          sizes="(max-width: 768px) 86vw, 820px"
          style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', height: '100%', width: 'auto', maxWidth: 'none', objectFit: 'contain' as const, zIndex: 1 }}
        />
        <div className="hero-overlay" />
        <div className="home-hero-social-proof">
          <span><Camera size={14} /> Presença digital</span>
          <span><Crown size={14} /> Curadoria de luxo</span>
        </div>
        <div className="hero-content home-hero-content">
          <span className="home-hero-eyebrow">Guilherme Pilger apresenta</span>
          <h1 className="hero-subtitle-top">Luxo em Balneário Camboriú</h1>
          <h2 className="hero-title-script">experiência única!</h2>
        </div>
      </div>

      <HomeMapSearchSection properties={homeMapProperties} />

      <section className="gp-authority-strip">
        <div className="gp-authority-copy">
          <h2>Escolha pela localização</h2>
        </div>
        <div className="gp-authority-stats">
          {authorityCities.map(city => (
            <Link href={city.href} key={city.label}>
              <strong>{city.count.toLocaleString('pt-BR')}</strong>
              <span>{city.label}</span>
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

        {sectionsEnabled.includes('featured') && (
          <HomepageSection
            title={featuredTitle}
            subtitle="Seleção premium"
            properties={featured}
            lpMap={lpMap}
            viewAllHref="/busca?sort=price-desc"
          />
        )}

        {mostViewed.length > 0 && (
          <HomepageSection
            title="Mais Vistos"
            subtitle="As oportunidades que mais chamam atenção de quem busca alto padrão"
            properties={mostViewed}
            lpMap={lpMap}
            viewAllHref="/busca"
            viewAllLabel="Ver ranking"
          />
        )}

        {sectionsEnabled.includes('newest') && (
          <HomepageSection
            title="Recém Adicionados"
            subtitle="Os mais novos do portfólio"
            properties={newest}
            lpMap={lpMap}
            viewAllHref="/busca?sort=newest"
            viewAllLabel="Ver mais"
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

        {sectionsEnabled.includes('launches') && launches.length > 0 && (
          <HomepageSection
            title="Lançamentos"
            subtitle="Em construção e na planta"
            properties={launches}
            lpMap={lpMap}
            viewAllHref="/busca?tag=lancamento"
          />
        )}

      </div>
      
      <AboutGuilhermeSection />
      <YoutubeFeedSection />

        <Footer />
      </main>
      <WhatsAppFloatingButton />
      <MobileNav />
    </>
  )
}


// === Helper: Build city sections ===
function buildCitySections(properties: any[], cities: string[], limit: number) {
  const cityMap = new Map<string, any[]>()

  for (const p of properties) {
    const city = p.city?.trim()
    if (!city) continue
    const match = cities.find(c => city.toLowerCase() === c.toLowerCase())
    if (!match) continue
    if (!cityMap.has(match)) cityMap.set(match, [])
    cityMap.get(match)!.push(p)
  }

  return cities
    .filter(city => cityMap.has(city) && cityMap.get(city)!.length >= 2)
    .map(city => ({
      city: displayLocationName(city),
      searchCity: city,
      items: cityMap.get(city)!.slice(0, limit),
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
    const propertyId = landingPageToProperty.get(event.landing_page_id)
    if (!propertyId) return
    const weight = event.event_type === 'form_submitted' || event.event_type === 'whatsapp_property_click'
      ? 4
      : event.event_type === 'chat_opened' || event.event_type === 'whatsapp_link_click'
        ? 2
        : 1
    viewCounts.set(propertyId, (viewCounts.get(propertyId) || 0) + weight)
  })

  const hasRealViews = Array.from(viewCounts.values()).some(count => count > 0)
  const scored = properties
    .filter(property => property?.id && property.status === 'active')
    .map(property => {
      const realViews = viewCounts.get(property.id) || 0
      const fallback = demandScore(property)
      return {
        property,
        score: hasRealViews ? (realViews * 1000000) + fallback : fallback,
      }
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return Number(b.property.price || 0) - Number(a.property.price || 0)
    })
    .map(item => item.property)

  const withoutFeatured = scored.filter(property => !excludeIds.has(property.id))
  const pool = withoutFeatured.length >= Math.min(2, limit) ? withoutFeatured : scored

  return pool.slice(0, limit)
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
