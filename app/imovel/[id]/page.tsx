import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'
import PropertyFeedExperience, { type PropertyFeedItem } from '@/components/property/PropertyFeedExperience'
import PropertyFeedStyles from './PropertyFeedStyles'
import { JsonLd, absoluteUrl, breadcrumbJsonLd, organizationJsonLd, DEFAULT_OG_IMAGE, webPageJsonLd } from '@/lib/seo/json-ld'
import { displayLocationName, replaceItajaiWithPraiaBrava } from '@/lib/locations/display'
import { buildPropertyFeedCopy } from '@/lib/properties/feed-copy'
import { compactPropertyText } from '@/lib/properties/text'
import { buildPropertySeoPath } from '@/lib/properties/seo-url'
import { enrichPropertiesWithResponsibleBrokers } from '@/lib/properties/responsible-broker'

export const dynamic = 'force-dynamic'

const PROPERTY_SELECT = [
    'id',
    'title',
    'description',
    'seo_title',
    'seo_description',
    'city',
    'state',
    'neighborhood',
    'latitude',
    'longitude',
    'price',
    'featured_image',
    'images',
    'property_type',
    'bedrooms',
    'bathrooms',
    'suites',
    'parking_spaces',
    'area_m2',
    'area_private_m2',
    'amenities',
    'video_url',
    'exclusive',
    'status',
    'created_at',
    'updated_at',
].join(', ')

const RELATED_LIMIT = 72
const RELATED_POOL_LIMIT = 160

function shortText(value?: string | null, fallback = '') {
    return compactPropertyText(value, fallback, 165)
}

function formatTitle(property: PropertyFeedItem) {
    return replaceItajaiWithPraiaBrava(buildPropertyFeedCopy(property).title || 'Imóvel de luxo')
}

function getGallery(property: PropertyFeedItem) {
    return Array.from(new Set([property.featured_image, ...(property.images || [])].filter(Boolean) as string[]))
}

function normalizeSearchText(value?: string | null) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
}

function joinedPropertyText(property: PropertyFeedItem) {
    return [
        property.title,
        property.description,
        property.seo_title,
        property.seo_description,
        property.property_type,
        property.neighborhood,
        property.city,
        ...(property.amenities || []),
    ].map(value => normalizeSearchText(value)).filter(Boolean).join(' ')
}

function hasAnyTerm(property: PropertyFeedItem, terms: string[]) {
    const text = joinedPropertyText(property)
    return terms.some(term => text.includes(normalizeSearchText(term)))
}

function priceSimilarityScore(reference?: number | null, candidate?: number | null) {
    const basePrice = Number(reference || 0)
    const candidatePrice = Number(candidate || 0)
    if (!basePrice || !candidatePrice) return 0

    const delta = Math.abs(candidatePrice - basePrice) / basePrice
    if (delta <= 0.12) return 22
    if (delta <= 0.25) return 17
    if (delta <= 0.45) return 11
    if (candidatePrice >= basePrice * 0.62 && candidatePrice <= basePrice * 1.65) return 7

    return candidatePrice >= 4000000 ? 3 : 0
}

function numericSimilarityScore(reference?: number | null, candidate?: number | null, exact = 8) {
    const base = Number(reference || 0)
    const value = Number(candidate || 0)
    if (!base || !value) return 0

    const delta = Math.abs(value - base)
    if (delta === 0) return exact
    if (delta === 1) return Math.round(exact * 0.62)
    if (delta === 2) return Math.round(exact * 0.36)

    return 0
}

function scoreRelatedProperty(reference: PropertyFeedItem, candidate: PropertyFeedItem) {
    const referenceCity = normalizeSearchText(reference.city)
    const candidateCity = normalizeSearchText(candidate.city)
    const referenceNeighborhood = normalizeSearchText(reference.neighborhood)
    const candidateNeighborhood = normalizeSearchText(candidate.neighborhood)
    const referenceType = normalizeSearchText(reference.property_type)
    const candidateType = normalizeSearchText(candidate.property_type)
    const referenceRooms = Number(reference.suites || reference.bedrooms || 0)
    const candidateRooms = Number(candidate.suites || candidate.bedrooms || 0)
    const referenceArea = Number(reference.area_private_m2 || reference.area_m2 || 0)
    const candidateArea = Number(candidate.area_private_m2 || candidate.area_m2 || 0)
    let score = 0

    if (referenceCity && referenceCity === candidateCity) score += 34
    if (referenceNeighborhood && referenceNeighborhood === candidateNeighborhood) score += 18
    if (referenceType && referenceType === candidateType) score += 12
    if (candidate.exclusive) score += 7
    if (candidate.featured_image || candidate.images?.length) score += 5

    score += priceSimilarityScore(reference.price, candidate.price)
    score += numericSimilarityScore(referenceRooms, candidateRooms, 9)

    if (referenceArea && candidateArea) {
        const areaDelta = Math.abs(candidateArea - referenceArea) / referenceArea
        if (areaDelta <= 0.16) score += 9
        else if (areaDelta <= 0.34) score += 5
        else if (areaDelta <= 0.55) score += 2
    }

    if (hasAnyTerm(reference, ['frente mar', 'vista mar', 'beira mar']) && hasAnyTerm(candidate, ['frente mar', 'vista mar', 'beira mar'])) {
        score += 11
    }

    if (hasAnyTerm(reference, ['lancamento', 'lançamento', 'na planta']) && hasAnyTerm(candidate, ['lancamento', 'lançamento', 'na planta'])) {
        score += 8
    }

    if (Number(candidate.price || 0) >= 4000000) score += 4

    return score
}

async function getProperty(id: string) {
    const supabase = await createServerSupabase()
    const { data } = await supabase
        .from('properties')
        .select(PROPERTY_SELECT)
        .eq('id', id)
        .maybeSingle()

    return data as PropertyFeedItem | null
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params
    const property = await getProperty(id)
    if (!property) return { title: 'Imóvel não encontrado' }

    const title = formatTitle(property)
    const city = displayLocationName(property.city)
    const description = shortText(buildPropertyFeedCopy(property).summary, `${property.property_type || 'Imóvel'} de alto padrão em ${city}. Explore fotos, dados rápidos e imóveis semelhantes.`)
    const image = property.featured_image || property.images?.[0] || DEFAULT_OG_IMAGE
    const canonicalPath = buildPropertySeoPath(property)

    return {
        title,
        description,
        alternates: {
            canonical: canonicalPath,
        },
        openGraph: {
            title,
            description,
            url: canonicalPath,
            type: 'website',
            images: [image],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [image],
        },
    }
}

async function getRelatedProperties(property: PropertyFeedItem) {
    const supabase = await createServerSupabase()
    const baseQuery = () => supabase
        .from('properties')
        .select(PROPERTY_SELECT)
        .eq('status', 'active')
        .neq('id', property.id)

    const price = Number(property.price || 0)
    const queries: Array<PromiseLike<PropertyFeedItem[]>> = []

    if (property.city) {
        queries.push(
            baseQuery()
                .eq('city', property.city)
                .order('exclusive', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(80)
                .then(({ data }) => (data || []) as unknown as PropertyFeedItem[])
        )
    }

    if (price > 0) {
        queries.push(
            baseQuery()
                .gte('price', Math.floor(price * 0.62))
                .lte('price', Math.ceil(price * 1.65))
                .order('exclusive', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(80)
                .then(({ data }) => (data || []) as unknown as PropertyFeedItem[])
        )
    }

    queries.push(
        baseQuery()
            .order('exclusive', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(RELATED_POOL_LIMIT)
            .then(({ data }) => (data || []) as unknown as PropertyFeedItem[])
    )

    const results = await Promise.all(queries)
    const seen = new Set<string>()
    const pool = results.flat()
        .filter(item => {
            if (seen.has(item.id)) return false
            seen.add(item.id)
            return true
        })

    return pool
        .map((item, index) => ({
            item,
            score: scoreRelatedProperty(property, item) - index * 0.001,
        }))
        .sort((a, b) => b.score - a.score)
        .map(({ item }) => item)
        .slice(0, RELATED_LIMIT)
}

export default async function PropertyFeedPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const baseProperty = await getProperty(id)
    if (!baseProperty) return notFound()

    const adminSupabase = createAdminClient()
    const [property] = await enrichPropertiesWithResponsibleBrokers(adminSupabase, [baseProperty])
    const related = await enrichPropertiesWithResponsibleBrokers(adminSupabase, await getRelatedProperties(property))
    const title = formatTitle(property)
    const city = displayLocationName(property.city)
    const neighborhood = replaceItajaiWithPraiaBrava(property.neighborhood)
    const gallery = getGallery(property)
    const propertyPath = buildPropertySeoPath(property)
    const propertyUrl = absoluteUrl(propertyPath)

    const propertyJsonLd = [
        organizationJsonLd(),
        webPageJsonLd({
            path: propertyPath,
            name: title,
            description: shortText(buildPropertyFeedCopy(property).summary, `${property.property_type || 'Imóvel'} de alto padrão em ${city}.`),
            type: 'WebPage',
            image: gallery[0] || DEFAULT_OG_IMAGE,
        }),
        breadcrumbJsonLd([
            { name: 'Home', url: '/' },
            { name: 'Busca', url: '/busca' },
            { name: title, url: propertyPath },
        ]),
        {
            '@context': 'https://schema.org',
            '@type': 'RealEstateListing',
            '@id': `${propertyUrl}#listing`,
            name: title,
            url: propertyUrl,
            image: gallery,
            description: shortText(buildPropertyFeedCopy(property).summary, `${property.property_type || 'Imóvel'} de alto padrão em ${city}.`),
            mainEntityOfPage: {
                '@id': `${propertyUrl}#webpage`,
            },
            dateModified: property.updated_at || property.created_at,
            address: {
                '@type': 'PostalAddress',
                addressLocality: city,
                addressRegion: property.state || 'SC',
                addressCountry: 'BR',
                streetAddress: [neighborhood].filter(Boolean).join(', ') || undefined,
            },
            mainEntity: {
                '@type': 'Apartment',
                '@id': `${propertyUrl}#property`,
                name: title,
                image: gallery,
                accommodationCategory: property.property_type,
                numberOfBedrooms: property.bedrooms || property.suites || undefined,
                numberOfBathroomsTotal: property.bathrooms || undefined,
                numberOfParkingSpaces: property.parking_spaces || undefined,
                address: {
                    '@type': 'PostalAddress',
                    addressLocality: city,
                    addressRegion: property.state || 'SC',
                    addressCountry: 'BR',
                    streetAddress: [neighborhood].filter(Boolean).join(', ') || undefined,
                },
                geo: property.latitude && property.longitude ? {
                    '@type': 'GeoCoordinates',
                    latitude: property.latitude,
                    longitude: property.longitude,
                } : undefined,
            },
            floorSize: property.area_m2 || property.area_private_m2 ? {
                '@type': 'QuantitativeValue',
                value: Number(property.area_m2 || property.area_private_m2),
                unitCode: 'MTK',
            } : undefined,
            numberOfRooms: property.bedrooms || property.suites || undefined,
            offers: {
                '@type': 'Offer',
                price: property.price || undefined,
                priceCurrency: 'BRL',
                availability: 'https://schema.org/InStock',
                url: propertyUrl,
                seller: {
                    '@id': `${absoluteUrl('/')}#organization`,
                },
            },
        },
    ]

    return (
        <>
            <PropertyFeedStyles />
            <JsonLd data={propertyJsonLd} />
            <PropertyFeedExperience property={{ ...property, title }} related={related} />
        </>
    )
}
