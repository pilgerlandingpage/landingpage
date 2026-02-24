import { createServerSupabase } from '@/lib/supabase/server'
import Link from 'next/link'
import PropertyCard from '@/components/marketplace/PropertyCard'
import HomeSearchBar from '@/components/marketplace/HomeSearchBar'
import { Search, Filter, Warehouse, Building2, Palmtree, Mountain, Gem } from 'lucide-react'

// This is a Server Component
export default async function MarketplaceHome() {
  const supabase = await createServerSupabase()

  // Fetch all active properties
  const { data: properties } = await supabase
    .from('properties')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  // Also fetch any landing pages linked to properties
  const { data: landingPages } = await supabase
    .from('landing_pages')
    .select('slug, property_id')
    .eq('status', 'published')

  const lpMap = new Map()
  landingPages?.forEach((lp: any) => {
    lpMap.set(lp.property_id, lp.slug)
  })

  // Mock Categories
  const categories = [
    { icon: <Palmtree size={24} />, label: 'Frente Mar' },
    { icon: <Building2 size={24} />, label: 'Coberturas' },
    { icon: <Gem size={24} />, label: 'Mansões' },
    { icon: <Warehouse size={24} />, label: 'Condomínios' },
    { icon: <Mountain size={24} />, label: 'Serra' },
    { icon: <Filter size={24} />, label: 'Filtros' },
  ]

  return (
    <div className="marketplace-container">

      {/* === COMPACT HERO STRIP (scrolls away) === */}
      <div className="hero-strip">
        <div className="hero-video-bg">
          <iframe
            src="https://www.youtube.com/embed/rKzkb0onX1Q?autoplay=1&mute=1&controls=0&loop=1&playlist=rKzkb0onX1Q&showinfo=0&rel=0&iv_load_policy=3&disablekb=1&modestbranding=1"
            allow="autoplay; encrypted-media"
            className="hero-video-frame"
          />
        </div>
        <div className="hero-photo-glow" />
        <img
          className="hero-bg-image"
          src="https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/Untitled%20design(9).png"
          alt="Guilherme Pilger"
        />
        <div className="hero-overlay" />
        <div className="hero-content">
          <p className="hero-welcome">Bem-vindo à</p>
          <h2 className="hero-title">Guilherme Pilger</h2>
          <p className="hero-subtitle">Corretor de Imóveis</p>
        </div>
      </div>

      {/* === STICKY SEARCH + CATEGORIES === */}
      <div className="sticky-bar">
        <HomeSearchBar />

        <div className="categories-bar">
          {categories.map((cat, idx) => (
            <div key={idx} className={`category-item ${idx === 0 ? 'active' : ''}`}>
              <div className="category-icon">{cat.icon}</div>
              <span className="category-label">{cat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid Section */}
      <main className="listings-section">
        {(!properties || properties.length === 0) ? (
          <div className="empty-state">
            <p>Nenhum imóvel encontrado no momento.</p>
          </div>
        ) : (
          <div className="properties-grid">
            {properties.map((property: any) => (
              <PropertyCard
                key={property.id}
                property={property}
                landingPageSlug={lpMap.get(property.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Mobile Bottom Nav */}
      <div className="mobile-nav">
        <div className="nav-item active">
          <div className="nav-icon"><Search size={24} /></div>
          <span>Explorar</span>
        </div>
        <div className="nav-item">
          <div className="nav-icon"><HeartIcon /></div>
          <span>Favoritos</span>
        </div>
        <div className="nav-item">
          <div className="nav-icon"><UserIcon /></div>
          <span>Contato</span>
        </div>
      </div>

      <style>{`
        /* ====== BASE ====== */
        .marketplace-container {
          min-height: 100vh;
          background-color: var(--bg-secondary, #f7f7f5);
          padding-bottom: 80px;
          color: var(--text-primary, #1a1a1a);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .hero-strip {
          position: relative;
          height: 260px;
          overflow: hidden;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding-bottom: 16px;
          background: linear-gradient(180deg, #f0ede8 0%, #f7f7f5 100%);
        }
        .hero-photo-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -48%);
          width: 220px;
          height: 220px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(184, 148, 95, 0.35) 0%, rgba(184, 148, 95, 0.15) 40%, rgba(184, 148, 95, 0) 70%);
          filter: blur(8px);
          z-index: 0;
          pointer-events: none;
        }
        .hero-bg-image {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          height: 100%;
          width: auto;
          max-width: none;
          object-fit: contain;
          filter: none;
          z-index: 1;
          drop-shadow: 0 0 40px rgba(184, 148, 95, 0.3);
        }
        .hero-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to top,
            rgba(247, 247, 245, 0.95) 0%,
            rgba(247, 247, 245, 0.3) 35%,
            rgba(247, 247, 245, 0) 60%
          );
          z-index: 2;
        }
        .hero-content {
          position: relative;
          z-index: 3;
          text-align: center;
        }
        .hero-welcome {
          font-family: 'Inter', sans-serif;
          font-size: 0.7rem;
          color: #b8945f;
          letter-spacing: 3px;
          text-transform: uppercase;
          margin: 0 0 2px 0;
          font-weight: 600;
        }
        .hero-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 1.8rem;
          font-weight: 600;
          margin: 0;
          line-height: 1.1;
          color: #1a1a1a;
          -webkit-text-fill-color: #1a1a1a;
        }
        .hero-subtitle {
          font-family: 'Inter', sans-serif;
          font-size: 0.78rem;
          color: #5a5a5a;
          margin: 4px 0 0 0;
          letter-spacing: 1px;
          font-weight: 400;
        }

        /* Video Background */
        .hero-video-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .hero-video-frame {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 100%;
          aspect-ratio: 16/9;
          pointer-events: none;
          opacity: 0.8;
          filter: grayscale(20%);
        }
        @media (max-width: 500px) {
          .hero-video-frame {
            width: auto;
            height: 100%;
            min-width: 178%;
          }
        }

        /* ====== STICKY SEARCH + CATEGORIES ====== */
        .sticky-bar {
          position: sticky;
          top: 0;
          z-index: 100;
          background: var(--bg-primary, #ffffff);
          border-bottom: 1px solid var(--border, #e8e5e0);
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }

        .search-container {
          max-width: 700px;
          margin: 0 auto;
          padding: 10px 20px 0 20px;
        }
        .search-pill {
          background: var(--bg-secondary, #f7f7f5);
          border: 1px solid var(--border, #e8e5e0);
          border-radius: 100px;
          padding: 8px 14px 8px 18px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
          cursor: pointer;
          transition: box-shadow 0.3s, border-color 0.3s;
        }
        .search-pill:hover {
          box-shadow: 0 4px 14px rgba(0,0,0,0.08);
          border-color: var(--gold, #b8945f);
        }
        .search-icon-wrapper {
          display: flex;
          align-items: center;
          color: var(--gold, #b8945f);
        }
        .search-text {
          flex: 1;
          display: flex;
          flex-direction: column;
          line-height: 1.2;
        }
        .search-title {
          font-weight: 600;
          font-size: 0.82rem;
        }
        .search-subtitle {
          font-size: 0.68rem;
          color: var(--text-muted, #666);
        }
        .filter-button {
          border: 1px solid var(--border, #e8e5e0);
          border-radius: 50%;
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          color: var(--text-secondary, #5a5a5a);
          cursor: pointer;
          transition: border-color 0.2s, color 0.2s;
        }
        .filter-button:hover {
          border-color: var(--gold, #b8945f);
          color: var(--gold, #b8945f);
        }

        /* Categories */
        .categories-bar {
          display: flex;
          gap: 20px;
          overflow-x: auto;
          padding: 10px 20px 0px 20px;
          scrollbar-width: none;
          max-width: 2000px;
          margin: 0 auto;
        }
        .categories-bar::-webkit-scrollbar {
          display: none;
        }
        .category-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          min-width: 52px;
          cursor: pointer;
          color: var(--text-muted, #999);
          padding-bottom: 10px;
          border-bottom: 2px solid transparent;
          transition: all 0.2s ease;
          opacity: 0.6;
        }
        .category-item:hover, .category-item.active {
          color: var(--text-primary, #1a1a1a);
          border-bottom-color: var(--gold, #b8945f);
          opacity: 1;
        }
        .category-item.active .category-icon {
          color: var(--gold, #b8945f);
        }
        .category-label {
          font-size: 0.68rem;
          font-weight: 600;
          white-space: nowrap;
        }

        /* ====== LISTING GRID ====== */
        .listings-section {
          max-width: 2000px;
          margin: 0 auto;
          padding: 16px 20px;
        }
        .properties-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
          row-gap: 24px;
        }

        /* Responsive Breakpoints */
        @media (min-width: 600px) {
          .listings-section { padding: 20px 28px; }
          .properties-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 18px;
            row-gap: 28px;
          }
        }
        @media (min-width: 768px) {
          .marketplace-container { padding-bottom: 0; }
          .hero-strip { height: 320px; }
          .hero-title { font-size: 2.4rem; }
          .hero-welcome { font-size: 0.75rem; }
          .hero-subtitle { font-size: 0.85rem; }
          .properties-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 22px;
            row-gap: 32px;
          }
          .mobile-nav { display: none; }
        }
        @media (min-width: 1024px) {
          .hero-strip { height: 400px; }
          .hero-title { font-size: 2.8rem; }
          .hero-subtitle { font-size: 0.9rem; }
          .hero-welcome { font-size: 0.8rem; }
          .listings-section { padding: 24px 40px; }
          .properties-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 24px;
            row-gap: 36px;
          }
        }
        @media (min-width: 1440px) {
          .hero-strip { height: 450px; }
          .listings-section { padding: 28px 48px; }
          .properties-grid {
            grid-template-columns: repeat(5, 1fr);
            gap: 28px;
            row-gap: 40px;
          }
        }
        @media (min-width: 1800px) {
          .properties-grid {
            grid-template-columns: repeat(6, 1fr);
            gap: 32px;
            row-gap: 44px;
          }
        }

        /* ====== BOTTOM NAV ====== */
        .mobile-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 58px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-top: 1px solid var(--border, #e8e5e0);
          display: flex;
          justify-content: center;
          gap: 48px;
          align-items: center;
          z-index: 1000;
          padding-bottom: env(safe-area-inset-bottom);
        }
        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          color: var(--text-muted, #999);
          font-size: 0.65rem;
          cursor: pointer;
          width: 54px;
          font-weight: 500;
          transition: color 0.2s;
        }
        .nav-item:hover { color: var(--text-secondary, #5a5a5a); }
        .nav-item.active { color: var(--gold, #b8945f); }
        .nav-icon { margin-bottom: 1px; }
        
        .empty-state { 
          text-align: center; 
          padding: 60px 24px; 
          color: var(--text-muted, #999);
          font-size: 0.95rem;
        }
      `}</style>
    </div>
  )
}

function HeartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>
  )
}
function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
  )
}
