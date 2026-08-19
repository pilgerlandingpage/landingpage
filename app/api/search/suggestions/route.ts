import { createServerSupabase } from '@/lib/supabase/server'
import { displayLocationName, normalizeLocationName, replaceItajaiWithPraiaBrava } from '@/lib/locations/display'
import { NextRequest, NextResponse } from 'next/server'

const MINIMUM_FIRST_CONTACT_PRICE = 4000000

type NeighborhoodSuggestion = {
    type: 'neighborhood'
    label: string
    neighborhood: string
    count: number
}

function displayCityLabel(city: string | null | undefined) {
    const displayCity = displayLocationName(city).trim()

    if (!displayCity) return ''
    if (/\/\s*SC$/i.test(displayCity)) return displayCity
    if (/,\s*SC$/i.test(displayCity)) return displayCity.replace(/\s*,\s*SC$/i, ' / SC')

    return `${displayCity} / SC`
}

function displayNeighborhoodLabel(neighborhood: string, city?: string | null) {
    const displayNeighborhood = replaceItajaiWithPraiaBrava(neighborhood.trim())
    const displayCity = displayCityLabel(city)

    if (!displayCity || normalizeLocationName(displayNeighborhood) === normalizeLocationName(displayLocationName(city))) {
        return displayNeighborhood
    }

    return `${displayNeighborhood} - ${displayCity}`
}

function citySuggestionsFromCount(cityCount: Map<string, number>, limit: number) {
    const merged = new Map<string, { type: 'city'; label: string; city: string; count: number }>()

    cityCount.forEach((count, name) => {
        const city = displayLocationName(name).trim()
        const label = displayCityLabel(city)
        const current = merged.get(normalizeLocationName(city))

        if (current) {
            current.count += count
            return
        }

        if (city && label) merged.set(normalizeLocationName(city), { type: 'city', label, city, count })
    })

    return [...merged.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
}

function addNeighborhoodCount(
    neighborhoodCount: Map<string, NeighborhoodSuggestion>,
    neighborhood: string | null | undefined,
    city?: string | null
) {
    if (!neighborhood) return

    const cleanNeighborhood = replaceItajaiWithPraiaBrava(neighborhood.trim())
    if (!cleanNeighborhood) return

    const label = displayNeighborhoodLabel(neighborhood, city)
    const current = neighborhoodCount.get(label)

    if (current) {
        current.count += 1
        return
    }

    neighborhoodCount.set(label, {
        type: 'neighborhood',
        label,
        neighborhood: cleanNeighborhood,
        count: 1,
    })
}

function neighborhoodSuggestionsFromCount(neighborhoodCount: Map<string, NeighborhoodSuggestion>, limit: number) {
    return [...neighborhoodCount.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
}

export async function GET(req: NextRequest) {
    const q = req.nextUrl.searchParams.get('q')?.trim() || ''

    const supabase = await createServerSupabase()

    // If no query, return top cities and neighborhoods
    if (!q) {
        const { data: properties } = await supabase
            .from('properties')
            .select('city, neighborhood')
            .eq('status', 'active')
            .gte('price', MINIMUM_FIRST_CONTACT_PRICE)
            .limit(500)

        const cityCount = new Map<string, number>()
        const neighborhoodCount = new Map<string, NeighborhoodSuggestion>()

        properties?.forEach((p: any) => {
            if (p.city) {
                const c = p.city.trim()
                cityCount.set(c, (cityCount.get(c) || 0) + 1)
            }
            addNeighborhoodCount(neighborhoodCount, p.neighborhood, p.city)
        })

        const cities = citySuggestionsFromCount(cityCount, 8)
        const neighborhoods = neighborhoodSuggestionsFromCount(neighborhoodCount, 8)

        return NextResponse.json({ suggestions: [...cities, ...neighborhoods] })
    }

    // Search with query
    const term = q.replace(/[(),]/g, ' ').trim()
    const normalizedTerm = normalizeLocationName(term)
    const searchTerms = new Set([term])

    if (normalizedTerm === 'praia brava') searchTerms.add('Itaja')
    if (normalizedTerm === 'balneario camboriu' || normalizedTerm === 'bc' || normalizedTerm.includes('balneario')) searchTerms.add('Balne')
    const searchFilter = [...searchTerms]
        .filter(Boolean)
        .flatMap(searchTerm => [
            `title.ilike.%${searchTerm}%`,
            `city.ilike.%${searchTerm}%`,
            `neighborhood.ilike.%${searchTerm}%`,
            `property_type.ilike.%${searchTerm}%`,
        ])
        .join(',')

    const { data: properties } = await supabase
        .from('properties')
        .select('id, source_slug, title, seo_title, city, neighborhood, property_type, price')
        .eq('status', 'active')
        .gte('price', MINIMUM_FIRST_CONTACT_PRICE)
        .or(searchFilter)
        .order('price', { ascending: false })
        .limit(200)

    if (!properties || properties.length === 0) {
        return NextResponse.json({ suggestions: [] })
    }

    // Build grouped suggestions: cities, neighborhoods, and direct properties
    const cityCount = new Map<string, number>()
    const neighborhoodCount = new Map<string, NeighborhoodSuggestion>()
    const directMatches: any[] = []

    properties.forEach((p: any) => {
        if (p.city) {
            const c = p.city.trim()
            cityCount.set(c, (cityCount.get(c) || 0) + 1)
        }
        addNeighborhoodCount(neighborhoodCount, p.neighborhood, p.city)
        if (p.title && normalizeLocationName(p.title).includes(normalizedTerm)) {
            directMatches.push(p)
        }
    })

    const suggestions: any[] = []

    // Cities matching
    citySuggestionsFromCount(cityCount, 4).forEach(suggestion => {
        suggestions.push(suggestion)
    })

    // Neighborhoods matching
    neighborhoodSuggestionsFromCount(neighborhoodCount, 4).forEach(suggestion => {
        suggestions.push(suggestion)
    })

    // Direct property matches
    directMatches.slice(0, 3).forEach((p) => {
        suggestions.push({
            type: 'property',
            label: replaceItajaiWithPraiaBrava(p.title),
            id: p.id,
            source_slug: p.source_slug || null,
            price: p.price,
            city: displayLocationName(p.city),
        })
    })

    return NextResponse.json({ suggestions: suggestions.slice(0, 8) })
}
