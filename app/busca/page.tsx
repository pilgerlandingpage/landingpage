import { createServerSupabase } from '@/lib/supabase/server'
import MapSearch from '@/components/marketplace/MapSearch'
import SearchViews from '@/components/marketplace/SearchViews'
import PropertyCard from '@/components/marketplace/PropertyCard'
import { Search, Filter, Warehouse, Building2, Palmtree, Mountain, Gem } from 'lucide-react'

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
                <div className="mx-auto max-w-[1920px] px-4 md:px-6">
                    {/* Desktop Header */}
                    <div className="hidden md:flex items-center h-[64px] gap-6">
                        {/* Left: Logo */}
                        <div className="flex items-center gap-2 font-serif text-lg font-bold text-[#1a1a1a] whitespace-nowrap flex-shrink-0">
                            Guilherme Pilger
                        </div>

                        {/* Center: Search Pill */}
                        <div className="flex-1 flex justify-center">
                            <div className="flex items-center gap-3 rounded-full border border-[#e8e5e0] bg-[#f7f7f5] px-5 py-2 shadow-sm transition hover:shadow-md cursor-pointer min-w-[320px] max-w-[460px] w-full">
                                <div className="text-[#b8945f] flex-shrink-0"><Search size={16} strokeWidth={2.5} /></div>
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="font-semibold text-[#1a1a1a]">Qualquer lugar</span>
                                    <span className="text-[#ccc]">|</span>
                                    <span className="text-[#777] font-normal">Adicionar datas</span>
                                    <span className="text-[#ccc]">|</span>
                                    <span className="text-[#777] font-normal">Hóspedes</span>
                                </div>
                                <div className="ml-auto pl-2 flex-shrink-0">
                                    <div className="rounded-full bg-[#b8945f] p-1.5 text-white">
                                        <Search size={12} strokeWidth={3} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: CTA */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="rounded-full px-4 py-2 hover:bg-[#f7f7f5] text-sm font-medium whitespace-nowrap cursor-pointer transition">
                                Anuncie seu imóvel
                            </div>
                        </div>
                    </div>

                    {/* Mobile Header */}
                    <div className="flex md:hidden items-center h-[56px] gap-3">
                        <div className="flex-1 flex items-center gap-3 rounded-full border border-[#e8e5e0] bg-[#f7f7f5] px-4 py-2 shadow-sm cursor-pointer">
                            <div className="text-[#b8945f] flex-shrink-0"><Search size={16} strokeWidth={2.5} /></div>
                            <div className="flex flex-col leading-tight">
                                <span className="text-[13px] font-semibold text-[#1a1a1a]">Qualquer lugar</span>
                                <span className="text-[11px] text-[#999]">Adicionar datas • Hóspedes</span>
                            </div>
                            <div className="ml-auto rounded-full border border-[#e8e5e0] p-1.5 text-[#5a5a5a] flex-shrink-0">
                                <Filter size={14} />
                            </div>
                        </div>
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
