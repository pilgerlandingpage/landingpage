import { createServerSupabase } from '@/lib/supabase/server'
import MapSearch from '@/components/marketplace/MapSearch'
import SearchViews from '@/components/marketplace/SearchViews'
import PropertyCard from '@/components/marketplace/PropertyCard'
import { Search } from 'lucide-react'
import GlobalHeader from '@/components/layout/GlobalHeader'

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
        <div className="flex flex-col overflow-hidden bg-[#f7f7f5]" style={{ height: '100dvh' }}>
            {/* Header / Search Bar */}
            <GlobalHeader />


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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
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
