import { createServerSupabase } from '@/lib/supabase/server'
import MapSearch from '@/components/marketplace/MapSearch'
import SearchViews from '@/components/marketplace/SearchViews'
import PropertyCard from '@/components/marketplace/PropertyCard'
import { Search } from 'lucide-react'

// Check if we found coordinates
// We'll create a simple helper to check validity
function hasCoordinates(p: any) {
    return p.latitude && p.longitude
}

export default async function SearchPage({
    searchParams
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const supabase = await createServerSupabase()
    const resolvedParams = await searchParams

    const q = typeof resolvedParams.q === 'string' ? resolvedParams.q : undefined

    // Build query based on params (simplified for now)
    let query = supabase.from('properties').select('*').eq('status', 'active')

    if (q) {
        // Search in title, city, state, or description
        // ilike is case-insensitive pattern matching
        query = query.or(`title.ilike.%${q}%,city.ilike.%${q}%,state.ilike.%${q}%`)
    }

    // Execute query
    const { data: properties } = await query.order('created_at', { ascending: false })

    // Also fetch landing pages for links
    const { data: landingPages } = await supabase
        .from('landing_pages')
        .select('slug, property_id')
        .eq('status', 'published')

    const lpMap = new Map()
    landingPages?.forEach((lp: any) => {
        lpMap.set(lp.property_id, lp.slug)
    })

    const propertiesWithCoords = properties?.filter(hasCoordinates) || []

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-[#f7f7f5]">
            {/* Header / Search Bar */}
            <header className="flex-none border-b border-[#e8e5e0] bg-white shadow-sm z-50">
                <style>{`
                    .bh-container {
                        max-width: 1920px;
                        margin: 0 auto;
                        padding: 0 24px;
                    }
                    @media (min-width: 1024px) {
                        .bh-container { padding: 0 32px; }
                    }
                    @media (min-width: 1280px) {
                        .bh-container { padding: 0 40px; }
                    }
                    .bh-desktop {
                        display: none;
                        align-items: center;
                        height: 64px;
                        gap: 24px;
                    }
                    @media (min-width: 768px) {
                        .bh-desktop { display: flex; }
                    }
                    .bh-mobile {
                        display: flex;
                        align-items: center;
                        height: 56px;
                        gap: 12px;
                    }
                    @media (min-width: 768px) {
                        .bh-mobile { display: none; }
                    }
                    .bh-logo {
                        font-family: 'Playfair Display', Georgia, serif;
                        font-size: 1.1rem;
                        font-weight: 700;
                        color: #1a1a1a;
                        white-space: nowrap;
                        flex-shrink: 0;
                        text-decoration: none;
                    }
                    .bh-search-pill {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        border-radius: 100px;
                        border: 1px solid #e8e5e0;
                        background: #f7f7f5;
                        padding: 8px 8px 8px 18px;
                        box-shadow: 0 1px 4px rgba(0,0,0,0.06);
                        transition: box-shadow 0.3s, border-color 0.3s;
                        min-width: 280px;
                        max-width: 480px;
                        width: 100%;
                    }
                    .bh-search-pill:focus-within {
                        box-shadow: 0 4px 14px rgba(0,0,0,0.08);
                        border-color: #b8945f;
                    }
                    .bh-search-input {
                        flex: 1;
                        border: none;
                        background: transparent;
                        font-size: 0.88rem;
                        font-weight: 500;
                        color: #1a1a1a;
                        outline: none;
                        padding: 0;
                        font-family: inherit;
                        min-width: 0;
                    }
                    .bh-search-input::placeholder {
                        color: #999;
                    }
                    .bh-search-btn {
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        background: linear-gradient(135deg, #b8945f, #d4b87a);
                        border: none;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #fff;
                        flex-shrink: 0;
                        transition: transform 0.2s;
                    }
                    .bh-search-btn:hover { transform: scale(1.08); }
                    .bh-cta {
                        border-radius: 100px;
                        padding: 8px 16px;
                        font-size: 0.88rem;
                        font-weight: 500;
                        white-space: nowrap;
                        cursor: pointer;
                        transition: background 0.2s;
                        color: #1a1a1a;
                        text-decoration: none;
                        flex-shrink: 0;
                    }
                    .bh-cta:hover { background: #f7f7f5; }
                    /* Mobile search pill */
                    .bh-mobile-pill {
                        flex: 1;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        border-radius: 100px;
                        border: 1px solid #e8e5e0;
                        background: #f7f7f5;
                        padding: 8px 8px 8px 16px;
                        box-shadow: 0 1px 4px rgba(0,0,0,0.06);
                    }
                    .bh-mobile-pill:focus-within {
                        box-shadow: 0 4px 14px rgba(0,0,0,0.08);
                        border-color: #b8945f;
                    }
                    .bh-mobile-input {
                        flex: 1;
                        border: none;
                        background: transparent;
                        font-size: 0.82rem;
                        font-weight: 600;
                        color: #1a1a1a;
                        outline: none;
                        padding: 0;
                        font-family: inherit;
                        min-width: 0;
                    }
                    .bh-mobile-input::placeholder { color: #999; }
                `}</style>

                <div className="bh-container">
                    {/* Desktop Header */}
                    <div className="bh-desktop">
                        {/* Left: Logo */}
                        <a href="/" className="bh-logo">Guilherme Pilger</a>

                        {/* Center: Search Pill */}
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                            <form className="bh-search-pill" action="/busca" method="get">
                                <Search size={16} strokeWidth={2.5} style={{ color: '#b8945f', flexShrink: 0 }} />
                                <input
                                    type="text"
                                    name="q"
                                    defaultValue={q || ''}
                                    placeholder="Buscar por cidade, bairro ou tipo..."
                                    className="bh-search-input"
                                />
                                <button type="submit" className="bh-search-btn">
                                    <Search size={14} strokeWidth={3} />
                                </button>
                            </form>
                        </div>

                        {/* Right: CTA */}
                        <a href="/" className="bh-cta">Anuncie seu imóvel</a>
                    </div>

                    {/* Mobile Header */}
                    <div className="bh-mobile">
                        <form className="bh-mobile-pill" action="/busca" method="get">
                            <Search size={16} strokeWidth={2.5} style={{ color: '#b8945f', flexShrink: 0 }} />
                            <input
                                type="text"
                                name="q"
                                defaultValue={q || ''}
                                placeholder="Buscar imóveis..."
                                className="bh-mobile-input"
                            />
                            <button type="submit" className="bh-search-btn">
                                <Search size={14} strokeWidth={3} />
                            </button>
                        </form>
                    </div>
                </div>
            </header>

            {/* Main Content: Split View via Client Component */}
            <SearchViews
                map={<MapSearch properties={propertiesWithCoords} />}
            >
                <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-medium text-[#5a5a5a]">
                        {properties?.length || 0} imóveis encontrados
                    </p>
                </div>

                {!properties || properties.length === 0 ? (
                    <div className="py-20 text-center text-[#999]">
                        Nenhum imóvel encontrado com estes critérios.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-2">
                        {properties.map((property: any) => (
                            <PropertyCard
                                key={property.id}
                                property={property}
                                landingPageSlug={lpMap.get(property.id)}
                            />
                        ))}
                    </div>
                )}

                <footer className="mt-12 border-t border-[#e8e5e0] py-8 text-center text-xs text-[#999]">
                    © {new Date().getFullYear()} Pilger Imóveis. Reais como você.
                </footer>
            </SearchViews>
        </div>
    )
}
