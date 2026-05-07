import { createServerSupabase } from '@/lib/supabase/server'
import SearchResults from '@/components/marketplace/SearchResults'
import GlobalHeader from '@/components/layout/GlobalHeader'

function hasCoordinates(p: any) {
    return p.latitude && p.longitude
}

function firstParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value
}

function safeSearch(value: string) {
    return value.replace(/[(),]/g, ' ').trim()
}

function applyTextFilter(query: any, tag: string | undefined) {
    if (!tag) return query

    const filters: Record<string, string> = {
        'frente-mar': 'frente',
        'quadra-mar': 'quadra',
        lancamento: 'lançamento',
        'em-construcao': 'construção',
        pronto: 'pronto',
        mobiliado: 'mobiliado',
    }
    const term = filters[tag] || tag
    return query.or(`title.ilike.%${term}%,description.ilike.%${term}%,property_type.ilike.%${term}%`)
}

export default async function SearchPage({
    searchParams
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const supabase = await createServerSupabase()
    const resolvedParams = await searchParams

    const q = firstParam(resolvedParams.q)
    const type = firstParam(resolvedParams.type)
    const subtype = firstParam(resolvedParams.subtype)
    const city = firstParam(resolvedParams.city)
    const tag = firstParam(resolvedParams.tag)
    const offer = firstParam(resolvedParams.offer)
    const price = firstParam(resolvedParams.price)
    const bedrooms = Number(firstParam(resolvedParams.bedrooms) || 0)
    const bedroomsMin = Number(firstParam(resolvedParams.bedroomsMin) || 0)
    const suites = Number(firstParam(resolvedParams.suites) || 0)
    const suitesMin = Number(firstParam(resolvedParams.suitesMin) || 0)

    let query = supabase.from('properties').select('*').eq('status', 'active')

    if (q) {
        const term = safeSearch(q)
        query = query.or(`title.ilike.%${term}%,city.ilike.%${term}%,state.ilike.%${term}%,description.ilike.%${term}%,property_type.ilike.%${term}%,source_reference.ilike.%${term}%`)
    }

    if (city) query = query.ilike('city', city)

    if (type && type !== 'Todos os Imóveis') {
        if (type.toLowerCase() === 'comercial') {
            query = query.or('property_type.ilike.%Comercial%,property_type.ilike.%Galpão%,property_type.ilike.%Prédio%,title.ilike.%Comercial%,title.ilike.%Galpão%')
        } else if (type === 'Duplex / Triplex') {
            query = query.or('property_type.ilike.%Duplex%,property_type.ilike.%Triplex%,title.ilike.%Duplex%,title.ilike.%Triplex%')
        } else {
            query = query.ilike('property_type', `%${type}%`)
        }
    }

    if (subtype === 'garden') query = query.ilike('property_type', '%Garden%')
    if (subtype === 'cobertura') query = query.ilike('property_type', '%Cobertura%')
    if (subtype === 'duplex') query = query.or('property_type.ilike.%Duplex%,property_type.ilike.%Triplex%,title.ilike.%Duplex%,title.ilike.%Triplex%')
    if (subtype === 'loft') query = query.ilike('property_type', '%Loft%')
    if (subtype === 'sobrado') query = query.ilike('property_type', '%Sobrado%')
    if (subtype === 'condominio') query = query.ilike('property_type', '%Condomínio%')
    if (subtype === 'terreno-condominio') query = query.ilike('property_type', '%Terreno em Condomínio%')
    if (subtype === 'terreno-comercial') query = query.ilike('property_type', '%Terreno Comercial%')

    if (price && price !== 'Todos os Valores') {
        const [minStr, maxStr] = price.split('-')
        const min = parseInt(minStr, 10)
        
        if (!isNaN(min) && min > 0) {
            query = query.gte('price', min)
        }
        if (maxStr) {
            const max = parseInt(maxStr, 10)
            if (!isNaN(max)) {
                query = query.lte('price', max)
            }
        }
    }

    if (Number.isFinite(bedrooms) && bedrooms > 0) query = query.eq('bedrooms', bedrooms)
    if (Number.isFinite(bedroomsMin) && bedroomsMin > 0) query = query.gte('bedrooms', bedroomsMin)
    if (Number.isFinite(suites) && suites > 0) query = query.eq('suites', suites)
    if (Number.isFinite(suitesMin) && suitesMin > 0) query = query.gte('suites', suitesMin)
    if (offer === 'rent') query = query.not('rent', 'is', null)

    query = applyTextFilter(query, tag)

    const { data: properties } = await query.order('created_at', { ascending: false })

    const { data: landingPages } = await supabase
        .from('landing_pages')
        .select('slug, property_id')
        .eq('status', 'published')

    const lpMap: Record<string, string> = {}
    landingPages?.forEach((lp: any) => {
        lpMap[lp.property_id] = lp.slug
    })

    const propertiesWithCoords = properties?.filter(hasCoordinates) || []

    return (
        <div className="flex flex-col overflow-hidden bg-[#f7f7f5]" style={{ height: '100dvh' }}>
            <GlobalHeader />
            <SearchResults
                properties={properties || []}
                propertiesWithCoords={propertiesWithCoords}
                lpMap={lpMap}
            />
        </div>
    )
}
