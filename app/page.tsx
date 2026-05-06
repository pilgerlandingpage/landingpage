import { createServerSupabase } from '@/lib/supabase/server'
import Link from 'next/link'
import HomeSearchBar from '@/components/marketplace/HomeSearchBar'
import { Warehouse, Building2, Palmtree, Mountain, Gem, Sparkles } from 'lucide-react'
import MobileNav from '@/components/marketplace/MobileNav'
import GlobalHeader from '@/components/layout/GlobalHeader'
import Footer from '@/components/layout/Footer'
import WhatsAppFloatingButton from '@/components/common/WhatsAppFloatingButton'
import AuthErrorRedirect from '@/components/auth/AuthErrorRedirect'
import MarketplaceHomeStyles from '@/components/marketplace/MarketplaceHomeStyles'
import HomepageSection from '@/components/marketplace/HomepageSection'
import AboutGuilhermeSection from '@/components/marketplace/AboutGuilhermeSection'
import YoutubeFeedSection from '@/components/marketplace/YoutubeFeedSection'
import SocialProofSection from '@/components/marketplace/SocialProofSection'
import { getPublicMarketRadarFeed } from '@/lib/market-radar/public-feed'
// This is a Server Component
export default async function MarketplaceHome() {
  const supabase = await createServerSupabase()
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
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const properties = allProperties || []

  // Also fetch any landing pages linked to properties
  const { data: landingPages } = await supabase
    .from('landing_pages')
    .select('slug, property_id')
    .eq('status', 'published')

  const lpMap = new Map()
  landingPages?.forEach((lp: any) => {
    lpMap.set(lp.property_id, lp.slug)
  })

  // === BUILD SECTIONS ===

  // 1. Featured / Seleção Exclusiva
  let featured: any[] = []
  if (featuredSort === 'manual' && manualFeaturedIds.length > 0) {
    // Manual selection
    featured = manualFeaturedIds
      .map(id => properties.find(p => p.id === id))
      .filter(Boolean)
      .slice(0, itemsPerSection)
  } else {
    // Auto: filter by price, then sort
    let pool = properties.filter(p => p.price && p.price > 0)
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
  const newest = properties.slice(0, itemsPerSection)

  // 3. By City
  const citySections = buildCitySections(properties, featuredCities, itemsPerSection)

  // 4. Launches
  const launches = properties
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
    <div className="marketplace-container">
      <AuthErrorRedirect />
      <MarketplaceHomeStyles />
      <GlobalHeader />

      {/* === COMPACT HERO STRIP === */}
      <div className="hero-strip" style={{ position: 'relative', width: '100%', height: '480px', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: '24px', background: 'linear-gradient(180deg, #f0ede8 0%, #f7f7f5 100%)' }}>
        <div className="hero-top-fade" />
        <div className="hero-video-bg" style={{ position: 'absolute', inset: '0', zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <iframe
            src="https://www.youtube.com/embed/rKzkb0onX1Q?autoplay=1&mute=1&controls=0&loop=1&playlist=rKzkb0onX1Q&showinfo=0&rel=0&iv_load_policy=3&disablekb=1&modestbranding=1"
            allow="autoplay; encrypted-media"
            className="hero-video-frame"
            style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', minWidth: '100%', minHeight: '100%', width: '177.78vh', height: '56.25vw', pointerEvents: 'none', opacity: 0.8, border: 'none' }}
          />
        </div>
        <div className="hero-photo-glow" />
        <img
          className="hero-bg-image"
          src="https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/Untitled%20design(9).png"
          alt="Guilherme Pilger"
          style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', height: '100%', width: 'auto', maxWidth: 'none', objectFit: 'contain' as const, zIndex: 1 }}
        />
        <div className="hero-overlay" />
        <div className="hero-content">
          <h1 className="hero-subtitle-top">Bem-vindo à Imobiliária em Balneário Camboriú<br/>Guilherme Pilger Corretor de Imóveis</h1>
          <h2 className="hero-title-script">experiência única!</h2>
        </div>
      </div>

      {/* === STICKY SEARCH === */}
      <div className="sticky-bar" style={{ position: 'sticky', top: 0, zIndex: 100, background: '#ffffff', borderBottom: '1px solid #e8e5e0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', overflow: 'visible' }}>
        <HomeSearchBar />
      </div>

      {/* === HOMEPAGE SECTIONS (admin controlled) === */}
      <main className="listings-section">

        {sectionsEnabled.includes('featured') && (
          <HomepageSection
            title={featuredTitle}
            subtitle="Imóveis premium selecionados"
            properties={featured}
            lpMap={lpMap}
            viewAllHref="/busca?sort=price-desc"
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

        {sectionsEnabled.includes('by_city') && citySections.map(({ city, items }) => (
          <HomepageSection
            key={city}
            title={`Imóveis em ${city}`}
            properties={items}
            lpMap={lpMap}
            viewAllHref={`/busca?city=${encodeURIComponent(city)}`}
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

      </main>
      
      <AboutGuilhermeSection />
      <YoutubeFeedSection />
      <SocialProofSection />

      <Footer />
      <WhatsAppFloatingButton />
      <MobileNav />
    </div>
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
      city,
      items: cityMap.get(city)!.slice(0, limit),
    }))
}
