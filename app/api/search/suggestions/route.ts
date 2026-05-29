import { createServerSupabase } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const MINIMUM_FIRST_CONTACT_PRICE = 4000000

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
        const neighborhoodSet = new Set<string>()

        properties?.forEach((p: any) => {
            if (p.city) {
                const c = p.city.trim()
                cityCount.set(c, (cityCount.get(c) || 0) + 1)
            }
            if (p.neighborhood) neighborhoodSet.add(p.neighborhood.trim())
        })

        const cities = [...cityCount.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([name, count]) => ({ type: 'city' as const, label: name, count }))

        return NextResponse.json({ suggestions: cities })
    }

    // Search with query
    const term = q.replace(/[(),]/g, ' ').trim()

    const { data: properties } = await supabase
        .from('properties')
        .select('id, title, city, neighborhood, property_type, price')
        .eq('status', 'active')
        .gte('price', MINIMUM_FIRST_CONTACT_PRICE)
        .or(`title.ilike.%${term}%,city.ilike.%${term}%,neighborhood.ilike.%${term}%,property_type.ilike.%${term}%`)
        .order('price', { ascending: false })
        .limit(200)

    if (!properties || properties.length === 0) {
        return NextResponse.json({ suggestions: [] })
    }

    // Build grouped suggestions: cities, neighborhoods, and direct properties
    const cityCount = new Map<string, number>()
    const neighborhoodCount = new Map<string, number>()
    const directMatches: any[] = []

    properties.forEach((p: any) => {
        if (p.city) {
            const c = p.city.trim()
            cityCount.set(c, (cityCount.get(c) || 0) + 1)
        }
        if (p.neighborhood) {
            const n = `${p.neighborhood.trim()}, ${p.city?.trim()}`
            neighborhoodCount.set(n, (neighborhoodCount.get(n) || 0) + 1)
        }
        if (p.title?.toLowerCase().includes(term.toLowerCase())) {
            directMatches.push(p)
        }
    })

    const suggestions: any[] = []

    // Cities matching
    ;[...cityCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .forEach(([name, count]) => {
            suggestions.push({ type: 'city', label: name, count })
        })

    // Neighborhoods matching
    ;[...neighborhoodCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .forEach(([name, count]) => {
            suggestions.push({ type: 'neighborhood', label: name, count })
        })

    // Direct property matches
    directMatches.slice(0, 3).forEach((p) => {
        suggestions.push({
            type: 'property',
            label: p.title,
            id: p.id,
            price: p.price,
            city: p.city,
        })
    })

    return NextResponse.json({ suggestions: suggestions.slice(0, 8) })
}
