import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { createAdminClient, createServerSupabase } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft,
    ArrowRight,
    BarChart3,
    Bath,
    BedDouble,
    Camera,
    Car,
    CheckCircle2,
    Eye,
    Home,
    MapPin,
    MessageCircle,
    Ruler,
    Star,
    TrendingUp,
} from 'lucide-react'
import PropertyLandingTracker from '@/components/property/PropertyLandingTracker'
import PropertyLandingUrlTracker from '@/components/property/PropertyLandingUrlTracker'
import PropertyDesktopMediaShowcase from '@/components/property/PropertyDesktopMediaShowcase'
import PropertyLandingFavoriteButton from '@/components/property/PropertyLandingFavoriteButton'
import PropertyLandingShareButton from '@/components/property/PropertyLandingShareButton'
import PropertyLandingMobileMenu from '@/components/property/PropertyLandingMobileMenu'
import PropertyContinuationRail from '@/components/property/PropertyContinuationRail'
import PropertyLocationMap from '@/components/property/PropertyLocationMap'
import PropertyMobileDetailSheet from '@/components/property/PropertyMobileDetailSheet'
import PropertyNearbyBenefits from '@/components/property/PropertyNearbyBenefits'
import MobileNav from '@/components/marketplace/MobileNav'
import MobileMapSearchModal from '@/components/marketplace/MobileMapSearchModal'
import WhatsAppCaptureLink from '@/components/common/WhatsAppCaptureLink'
import GlobalHeader from '@/components/layout/GlobalHeader'
import Footer from '@/components/layout/Footer'
import PropertyLandingStyles from '../PropertyLandingStyles'
import { displayLocationName, normalizeLocationName, replaceItajaiWithPraiaBrava } from '@/lib/locations/display'
import { JsonLd, absoluteUrl, breadcrumbJsonLd, organizationJsonLd, DEFAULT_OG_IMAGE, webPageJsonLd } from '@/lib/seo/json-ld'
import { cleanPublicPropertyText, compactPublicPropertyText } from '@/lib/properties/text'
import { extractPropertyIdFromSeoSlug } from '@/lib/properties/seo-url'
import { propertyDetailsPath, propertyDetailsSegment } from '@/lib/properties/responsive-destination'
import { GLOBAL_PROPERTY_WHATSAPP_PHONE, getResponsibleBrokerForProperty } from '@/lib/properties/responsible-broker'
import { fetchPropertyPriceHistory, type PropertyPriceHistoryRow } from '@/lib/properties/price-history'

export const dynamic = 'force-dynamic'

const BROKER_IMAGE = '/images/eventos/guilherme-pilger.png'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PROPERTY_MAP_MODAL_MIN_PRICE = 4000000
const PROPERTY_MAP_MODAL_SELECT = [
    'id',
    'source_slug',
    'title',
    'seo_title',
    'city',
    'state',
    'neighborhood',
    'price',
    'rent',
    'purpose',
    'bedrooms',
    'bathrooms',
    'suites',
    'parking_spaces',
    'area_m2',
    'area_private_m2',
    'featured_image',
    'images',
    'property_type',
    'exclusive',
    'source_status',
    'description',
    'latitude',
    'longitude',
    'updated_at',
].join(', ')
const RELATED_PROPERTY_SELECT = [
    'id',
    'source_slug',
    'title',
    'seo_title',
    'city',
    'state',
    'neighborhood',
    'price',
    'bedrooms',
    'bathrooms',
    'suites',
    'parking_spaces',
    'area_m2',
    'area_private_m2',
    'featured_image',
    'images',
    'property_type',
    'exclusive',
    'source_status',
    'description',
    'latitude',
    'longitude',
    'created_at',
    'updated_at',
].join(', ')

type RelatedPropertyCandidate = {
    id: string
    source_slug?: string | null
    title?: string | null
    seo_title?: string | null
    city?: string | null
    state?: string | null
    neighborhood?: string | null
    price?: number | string | null
    bedrooms?: number | string | null
    bathrooms?: number | string | null
    suites?: number | string | null
    parking_spaces?: number | string | null
    area_m2?: number | string | null
    area_private_m2?: number | string | null
    featured_image?: string | null
    images?: string[] | null
    property_type?: string | null
    exclusive?: boolean | null
    source_status?: string | null
    description?: string | null
    latitude?: number | string | null
    longitude?: number | string | null
    created_at?: string | null
    updated_at?: string | null
}

type RelatedPropertyScore = {
    property: RelatedPropertyCandidate
    score: number
    locationScore: number
    typeScore: number
    priceScore: number
    qualityScore: number
    premiumAlternative: boolean
}

type PageSearchParams = Record<string, string | string[] | undefined>

function isUuid(value: string) {
    return UUID_PATTERN.test(value)
}

function serializeSearchParams(searchParams: PageSearchParams | undefined) {
    const params = new URLSearchParams()

    for (const [key, value] of Object.entries(searchParams || {})) {
        if (Array.isArray(value)) {
            value.forEach(item => {
                if (item !== undefined) params.append(key, item)
            })
            continue
        }

        if (value !== undefined) params.set(key, value)
    }

    const query = params.toString()
    return query ? `?${query}` : ''
}

async function getPropertyByIdentifier<T = any>(identifier: string, select = '*'): Promise<T | null> {
    const supabase = await createServerSupabase()
    const decodedIdentifier = decodeURIComponent(identifier || '').trim()
    const idFromSeoSlug = extractPropertyIdFromSeoSlug(decodedIdentifier)

    if (idFromSeoSlug || isUuid(decodedIdentifier)) {
        const propertyId = idFromSeoSlug || decodedIdentifier
        const { data } = await supabase
            .from('properties')
            .select(select)
            .eq('id', propertyId)
            .maybeSingle()

        return (data || null) as T | null
    }

    const { data } = await supabase
        .from('properties')
        .select(select)
        .eq('source_slug', decodedIdentifier)
        .limit(1)
        .maybeSingle()

    return (data || null) as T | null
}

async function getPropertyForSeo(identifier: string) {
    return getPropertyByIdentifier<any>(
        identifier,
        'id, source_slug, title, description, seo_title, seo_description, city, state, neighborhood, price, featured_image, images, property_type, bedrooms, bathrooms, suites, parking_spaces, area_m2, area_private_m2, latitude, longitude, amenities, status, created_at, updated_at'
    )
}

function shortText(value?: string | null, fallback = '') {
    return compactPublicPropertyText(value, fallback, 160)
}

function buildDisplayLocationParts(neighborhood: unknown, city: unknown) {
    const displayNeighborhood = replaceItajaiWithPraiaBrava(neighborhood)
    const displayCity = displayLocationName(city)

    if (normalizeLocationName(displayNeighborhood) === normalizeLocationName(displayCity)) {
        return [displayNeighborhood || displayCity].filter(Boolean)
    }

    return [displayNeighborhood, displayCity].filter(Boolean)
}

function cleanRepeatedPraiaBravaText(value: unknown) {
    return replaceItajaiWithPraiaBrava(value)
        .replace(/\b(na|no|em)\s+Praia Brava\s+em\s+Praia Brava\b/gi, '$1 Praia Brava')
        .replace(/\bPraia Brava\s+em\s+Praia Brava\b/gi, 'Praia Brava')
}

function formatBrokerCreci(value?: string | null) {
    const raw = String(value || '').trim()
    if (!raw || /^n\/?a$/i.test(raw) || /^nao informado$/i.test(raw)) return ''

    const withoutPrefix = raw
        .replace(/^creci\s*\/?\s*/i, '')
        .replace(/^sc\s*\/?\s*/i, '')
        .trim()

    if (!withoutPrefix) return ''

    return `CRECI/SC ${withoutPrefix}`
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params
    const property = await getPropertyForSeo(id)
    if (!property) return { title: 'Imóvel não encontrado' }

    const title = cleanRepeatedPraiaBravaText(property.seo_title || property.title || 'Imóvel de luxo')
    const city = displayLocationName(property.city)
    const description = shortText(
        property.seo_description || property.description,
        `${property.property_type || 'Imóvel'} de alto padrão em ${city}. Fale com Guilherme Pilger para receber uma curadoria completa.`
    )
    const image = property.featured_image || property.images?.[0] || DEFAULT_OG_IMAGE
    const canonicalPath = propertyDetailsPath(property)

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

function formatDescription(raw: string): string[] {
    const text = cleanPublicPropertyText(raw)
    if (!text) return []

    const existingParagraphs = text
        .split('\n')
        .map(paragraph => paragraph.trim())
        .filter(paragraph => paragraph.length >= 40)

    if (existingParagraphs.length >= 2) return existingParagraphs.slice(0, 5)

    const protectedText = text.replace(/\b(Av|Dr|Dra|Ed|Ref|R|Sr|Sra)\./g, '$1<DOT>')

    const sentences = protectedText
        .replace(/\s+/g, ' ')
        .split(/(?<=[.!?])\s+/)
        .map(s => s.replace(/<DOT>/g, '.').trim().replace(/^[,;:\s]+/, ''))
        .filter(s => {
            if (s.length < 40) return false
            if (/^\d/.test(s)) return false
            return /[aeiouáéíóúãõ]{2,}/i.test(s)
        })

    if (sentences.length === 0) return []

    const paragraphs: string[] = []
    for (let i = 0; i < sentences.length; i += 2) {
        const chunk = sentences.slice(i, i + 2).join(' ').trim()
        if (chunk.length > 40) paragraphs.push(chunk)
    }
    return paragraphs.slice(0, 5)
}

function formatMoney(value?: number | null, fallback = 'Sob consulta') {
    return value
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)
        : fallback
}

function formatCompactMoney(value?: number | string | null, fallback = 'Sob consulta') {
    const amount = numericValue(value)
    if (!amount) return fallback

    if (amount >= 1000000) {
        return `R$ ${(amount / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
    }

    if (amount >= 1000) {
        return `R$ ${(amount / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
    }

    return formatMoney(amount)
}

function getGallery(property: any) {
    return Array.from(new Set([property.featured_image, ...(property.images || [])].filter(Boolean) as string[]))
}

function extractYouTubeId(url?: string | null) {
    const raw = String(url || '')
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ]
    for (const pattern of patterns) {
        const match = raw.match(pattern)
        if (match) return match[1]
    }
    return null
}

function chunkList<T>(items: T[], columns = 2) {
    const size = Math.ceil(items.length / columns)
    return Array.from({ length: columns }, (_, index) => items.slice(index * size, (index + 1) * size)).filter(group => group.length)
}

function statLabel(value: number, singular: string, plural: string) {
    return value === 1 ? singular : plural
}

function referenceLabel(property: any) {
    return String(property.source_reference || property.source_slug || property.id || '').slice(0, 8).toUpperCase()
}

function formatViewCount(value: number) {
    return `${value.toLocaleString('pt-BR')} ${value === 1 ? 'visualização' : 'visualizações'}`
}

function hasUsableCoordinate(value: unknown) {
    const coordinate = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value)
    return Number.isFinite(coordinate)
}

function hasMapCoordinates(property: any) {
    return hasUsableCoordinate(property.latitude) && hasUsableCoordinate(property.longitude)
}

function getMapLatLng(property: any): [number, number] | null {
    const latitude = typeof property.latitude === 'string' ? Number(property.latitude.replace(',', '.')) : Number(property.latitude)
    const longitude = typeof property.longitude === 'string' ? Number(property.longitude.replace(',', '.')) : Number(property.longitude)

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
    return [latitude, longitude]
}

function toMobileExploreMapProperty(property: any, titleOverride?: string, imageOverride?: string) {
    const area = Number(property.area_private_m2 || property.area_m2 || 0)

    return {
        id: property.id,
        source_slug: property.source_slug || null,
        title: cleanRepeatedPraiaBravaText(titleOverride || property.seo_title || property.title || 'Imovel'),
        city: displayLocationName(property.city) || property.city || null,
        state: property.state || null,
        neighborhood: replaceItajaiWithPraiaBrava(property.neighborhood) || property.neighborhood || null,
        price: property.price || null,
        rent: property.rent || null,
        purpose: property.purpose || null,
        latitude: property.latitude,
        longitude: property.longitude,
        featured_image: property.featured_image || property.images?.[0] || imageOverride || null,
        bedrooms: property.bedrooms || null,
        bathrooms: property.bathrooms || null,
        suites: property.suites || null,
        parking_spaces: property.parking_spaces || null,
        area_m2: area || property.area_m2 || null,
        property_type: property.property_type || null,
        description: shortText(property.seo_description || property.description, ''),
        source_status: property.source_status || null,
        exclusive: property.exclusive || null,
    }
}

function numericValue(value: unknown) {
    const parsed = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

function normalizedRecommendationText(value: unknown) {
    return normalizeLocationName(replaceItajaiWithPraiaBrava(value))
}

function propertyTypeGroup(value: unknown) {
    const type = normalizedRecommendationText(value)
    if (!type) return ''
    if (/(apartamento|apto|cobertura|duplex|triplex|flat|studio|loft)/.test(type)) return 'vertical'
    if (/(casa|sobrado|mansao|residencia)/.test(type)) return 'house'
    if (/(terreno|lote|area)/.test(type)) return 'land'
    if (/(sala|loja|comercial|galpao|ponto)/.test(type)) return 'commercial'
    return type
}

function scoreLocationMatch(current: any, candidate: RelatedPropertyCandidate) {
    const currentNeighborhood = normalizedRecommendationText(current.neighborhood)
    const candidateNeighborhood = normalizedRecommendationText(candidate.neighborhood)
    const currentCity = normalizedRecommendationText(current.city)
    const candidateCity = normalizedRecommendationText(candidate.city)
    const currentState = normalizedRecommendationText(current.state)
    const candidateState = normalizedRecommendationText(candidate.state)

    if (currentNeighborhood && candidateNeighborhood && currentNeighborhood === candidateNeighborhood) return 35
    if (currentCity && candidateCity && currentCity === candidateCity) return 24
    if (currentState && candidateState && currentState === candidateState) return 10
    return 0
}

function scorePropertyTypeMatch(current: any, candidate: RelatedPropertyCandidate) {
    const currentType = normalizedRecommendationText(current.property_type)
    const candidateType = normalizedRecommendationText(candidate.property_type)
    if (!currentType || !candidateType) return 0
    if (currentType === candidateType) return 20
    return propertyTypeGroup(currentType) === propertyTypeGroup(candidateType) ? 12 : 0
}

function scoreNumericSimilarity(currentValue: unknown, candidateValue: unknown, maxScore: number, tolerance: number) {
    const currentNumber = numericValue(currentValue)
    const candidateNumber = numericValue(candidateValue)
    if (!currentNumber || !candidateNumber) return 0

    const difference = Math.abs(candidateNumber - currentNumber)
    if (difference === 0) return maxScore
    if (difference <= tolerance) return Math.round(maxScore * 0.75)
    if (difference <= tolerance * 2) return Math.round(maxScore * 0.45)
    return 0
}

function scoreAreaSimilarity(current: any, candidate: RelatedPropertyCandidate) {
    const currentArea = numericValue(current.area_private_m2 || current.area_m2)
    const candidateArea = numericValue(candidate.area_private_m2 || candidate.area_m2)
    if (!currentArea || !candidateArea) return 0

    const ratio = Math.abs(candidateArea - currentArea) / currentArea
    if (ratio <= 0.12) return 10
    if (ratio <= 0.25) return 7
    if (ratio <= 0.4) return 4
    return 0
}

function scorePriceCompatibility(currentPriceValue: unknown, candidatePriceValue: unknown) {
    const currentPrice = numericValue(currentPriceValue)
    const candidatePrice = numericValue(candidatePriceValue)
    if (!currentPrice || !candidatePrice) return 0

    const ratio = candidatePrice / currentPrice
    if (ratio >= 0.8 && ratio <= 1.3) return 10
    if (ratio >= 0.65 && ratio <= 1.5) return 6
    if (ratio >= 0.5 && ratio <= 1.75) return 3
    return 0
}

function scoreCommercialQuality(candidate: RelatedPropertyCandidate) {
    let score = 0
    const hasGallery = Boolean(candidate.featured_image || candidate.images?.some(Boolean))
    if (hasGallery) score += 4
    if (candidate.exclusive) score += 3
    if (String(candidate.description || '').trim().length >= 80) score += 2
    if (hasMapCoordinates(candidate)) score += 1
    return Math.min(score, 10)
}

function scoreRelatedProperty(current: any, candidate: RelatedPropertyCandidate): RelatedPropertyScore {
    const locationScore = scoreLocationMatch(current, candidate)
    const typeScore = scorePropertyTypeMatch(current, candidate)
    const layoutScore = Math.min(
        15,
        scoreNumericSimilarity(current.suites || current.bedrooms, candidate.suites || candidate.bedrooms, 6, 1)
        + scoreNumericSimilarity(current.bedrooms, candidate.bedrooms, 4, 1)
        + scoreNumericSimilarity(current.parking_spaces, candidate.parking_spaces, 5, 1)
    )
    const areaScore = scoreAreaSimilarity(current, candidate)
    const priceScore = scorePriceCompatibility(current.price, candidate.price)
    const qualityScore = scoreCommercialQuality(candidate)
    const score = locationScore + typeScore + layoutScore + areaScore + priceScore + qualityScore
    const premiumAlternative = numericValue(candidate.price) > numericValue(current.price)
        && (candidate.exclusive || qualityScore >= 6 || priceScore >= 6)

    return {
        property: candidate,
        score,
        locationScore,
        typeScore,
        priceScore,
        qualityScore,
        premiumAlternative,
    }
}

function pickBestUnselected(
    ranked: RelatedPropertyScore[],
    selectedIds: Set<string>,
    matcher: (item: RelatedPropertyScore) => boolean
) {
    return ranked.find(item => !selectedIds.has(item.property.id) && matcher(item))
}

function selectRelatedProperties(current: any, candidates: RelatedPropertyCandidate[]) {
    const ranked = candidates
        .filter(candidate => candidate.id && candidate.id !== current.id)
        .map(candidate => scoreRelatedProperty(current, candidate))
        .filter(item => item.score >= 20)
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score
            if (b.locationScore !== a.locationScore) return b.locationScore - a.locationScore
            if (b.typeScore !== a.typeScore) return b.typeScore - a.typeScore
            if (b.qualityScore !== a.qualityScore) return b.qualityScore - a.qualityScore
            return numericValue(b.property.price) - numericValue(a.property.price)
        })

    const selected: RelatedPropertyScore[] = []
    const selectedIds = new Set<string>()
    const slots: Array<(item: RelatedPropertyScore) => boolean> = [
        item => item.locationScore >= 35 && item.typeScore >= 12,
        item => item.locationScore >= 24 && item.typeScore >= 12,
        item => item.locationScore >= 24 && item.priceScore >= 3,
        item => item.premiumAlternative || item.property.exclusive === true,
    ]

    for (const matcher of slots) {
        const match = pickBestUnselected(ranked, selectedIds, matcher)
        if (!match) continue
        selected.push(match)
        selectedIds.add(match.property.id)
    }

    for (const item of ranked) {
        if (selected.length >= 4) break
        if (selectedIds.has(item.property.id)) continue
        selected.push(item)
        selectedIds.add(item.property.id)
    }

    return selected.slice(0, 4).map(item => item.property)
}

function formatDateLabel(value?: string | null) {
    if (!value) return 'Data sob curadoria'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Data sob curadoria'

    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(date)
}

function sameCalendarDay(first?: string | null, second?: string | null) {
    if (!first || !second) return false
    const firstDate = new Date(first)
    const secondDate = new Date(second)
    if (Number.isNaN(firstDate.getTime()) || Number.isNaN(secondDate.getTime())) return false

    return firstDate.toISOString().slice(0, 10) === secondDate.toISOString().slice(0, 10)
}

function pricePerSquareMeter(item: { price?: number | string | null; area_private_m2?: number | string | null; area_m2?: number | string | null }) {
    const price = numericValue(item.price)
    const area = numericValue(item.area_private_m2 || item.area_m2)

    if (!price || !area) return 0
    return price / area
}

function medianValue(values: number[]) {
    if (!values.length) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)

    if (sorted.length % 2) return sorted[middle]
    return (sorted[middle - 1] + sorted[middle]) / 2
}

function quantileValue(sortedValues: number[], ratio: number) {
    if (!sortedValues.length) return 0
    const position = (sortedValues.length - 1) * ratio
    const base = Math.floor(position)
    const rest = position - base

    if (sortedValues[base + 1] === undefined) return sortedValues[base]
    return sortedValues[base] + rest * (sortedValues[base + 1] - sortedValues[base])
}

function clampPercent(value: number) {
    return Math.max(0, Math.min(100, value))
}

function formatPercent(value: number | null) {
    if (value === null || !Number.isFinite(value)) return 'Sem amostra'
    const prefix = value > 0 ? '+' : ''
    return `${prefix}${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function priceHistoryTitle(eventType: string) {
    if (eventType === 'listed') return 'Entrada no catálogo'
    if (eventType === 'price_reduced') return 'Redução de preço'
    if (eventType === 'price_increased') return 'Reajuste de preço'
    if (eventType === 'price_updated') return 'Preço atualizado'
    if (eventType === 'costs_updated') return 'Custos atualizados'
    return 'Revisão comercial'
}

function priceHistoryValue(event: PropertyPriceHistoryRow) {
    const price = numericValue(event.new_price)
    const condoFee = numericValue(event.new_condo_fee)
    const iptu = numericValue(event.new_iptu)

    if (price) return formatMoney(price)
    if (condoFee) return `Cond. ${formatMoney(condoFee)}`
    if (iptu) return `IPTU ${formatMoney(iptu)}`
    return 'Registro atualizado'
}

function priceHistoryNote(event: PropertyPriceHistoryRow, locationLabel: string) {
    const previousPrice = numericValue(event.previous_price)
    const currentPrice = numericValue(event.new_price)
    const priceM2 = numericValue(event.new_price_per_m2)
    const condoFee = numericValue(event.new_condo_fee)
    const iptu = numericValue(event.new_iptu)
    const notes = [
        previousPrice && currentPrice && previousPrice !== currentPrice ? `antes ${formatMoney(previousPrice)}` : null,
        priceM2 ? `${formatMoney(Math.round(priceM2))}/m²` : null,
        condoFee ? `condomínio ${formatMoney(condoFee)}` : null,
        iptu ? `IPTU ${formatMoney(iptu)}` : null,
    ].filter(Boolean)

    return notes.join(' • ') || locationLabel || 'Registro de valor do anúncio.'
}

function buildRecordedPriceTimeline(events: PropertyPriceHistoryRow[], locationLabel: string) {
    return events
        .filter(event => event?.created_at)
        .map(event => ({
            date: formatDateLabel(event.created_at),
            title: priceHistoryTitle(event.event_type),
            value: priceHistoryValue(event),
            note: priceHistoryNote(event, locationLabel),
        }))
}

function buildMarketHistory(property: any, candidates: RelatedPropertyCandidate[], area: number, locationLabel: string, priceHistoryEvents: PropertyPriceHistoryRow[] = []) {
    const currentPrice = numericValue(property.price)
    const currentArea = area || numericValue(property.area_private_m2 || property.area_m2)
    const currentPriceM2 = currentPrice && currentArea ? currentPrice / currentArea : 0
    const comparableValues = candidates
        .map(pricePerSquareMeter)
        .filter(value => Number.isFinite(value) && value > 0)
        .sort((a, b) => a - b)
    const minM2 = comparableValues[0] || 0
    const maxM2 = comparableValues[comparableValues.length - 1] || 0
    const medianM2 = medianValue(comparableValues)
    const deltaToMedian = currentPriceM2 && medianM2 ? ((currentPriceM2 - medianM2) / medianM2) * 100 : null
    const position = currentPriceM2 && minM2 && maxM2 && maxM2 > minM2
        ? clampPercent(((currentPriceM2 - minM2) / (maxM2 - minM2)) * 100)
        : 50
    const chartValuesRaw = comparableValues.length >= 3
        ? [
            quantileValue(comparableValues, 0),
            quantileValue(comparableValues, 0.25),
            quantileValue(comparableValues, 0.5),
            quantileValue(comparableValues, 0.75),
            quantileValue(comparableValues, 1),
        ]
        : [minM2 || currentPriceM2, medianM2 || currentPriceM2, maxM2 || currentPriceM2].filter(Boolean)
    const chartValues = chartValuesRaw.length ? chartValuesRaw : [1]
    const chartMin = Math.min(...chartValues, currentPriceM2 || Infinity)
    const chartMax = Math.max(...chartValues, currentPriceM2 || 0)
    const chartRange = chartMax > chartMin ? chartMax - chartMin : 1
    const chartPoints = chartValues.map((value, index) => {
        const x = chartValues.length === 1 ? 50 : (index / (chartValues.length - 1)) * 100
        const y = 35 - ((value - chartMin) / chartRange) * 23
        return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
    const createdAt = property.source_created_at || property.created_at
    const updatedAt = property.source_updated_at || property.updated_at
    const timeline = [
        {
            date: formatDateLabel(createdAt),
            title: 'Entrada no catálogo',
            value: formatMoney(currentPrice),
            note: locationLabel || 'Localização sob curadoria',
        },
        ...(!sameCalendarDay(createdAt, updatedAt) ? [{
            date: formatDateLabel(updatedAt),
            title: 'Última revisão comercial',
            value: formatMoney(currentPrice),
            note: currentPriceM2 ? `${formatMoney(Math.round(currentPriceM2))}/m²` : 'Preço por m² sob consulta',
        }] : []),
        ...(property.condo_fee ? [{
            date: 'Custo recorrente',
            title: 'Condomínio informado',
            value: formatMoney(Number(property.condo_fee)),
            note: 'Valor sujeito a conferência documental.',
        }] : []),
        ...(property.iptu ? [{
            date: 'Custo anual',
            title: 'IPTU informado',
            value: formatMoney(Number(property.iptu)),
            note: 'Base pública do anúncio ou importação.',
        }] : []),
    ]

    const recordedTimeline = buildRecordedPriceTimeline(priceHistoryEvents, locationLabel)

    return {
        currentPriceM2,
        medianM2,
        deltaToMedian,
        comparableCount: comparableValues.length,
        position,
        chartPoints,
        timeline: recordedTimeline.length ? recordedTimeline : timeline,
    }
}

async function getRelatedPropertyCandidates(supabase: any, property: any) {
    const candidates = new Map<string, RelatedPropertyCandidate>()
    const currentPrice = numericValue(property.price)
    const addCandidates = (items?: RelatedPropertyCandidate[] | null) => {
        for (const item of items || []) {
            if (!item?.id || item.id === property.id) continue
            candidates.set(item.id, item)
        }
    }
    const baseQuery = (limit: number) => supabase
        .from('properties')
        .select(RELATED_PROPERTY_SELECT)
        .eq('status', 'active')
        .neq('id', property.id)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(limit)

    const queries = []
    if (property.city && property.neighborhood) {
        queries.push(baseQuery(80).eq('city', property.city).eq('neighborhood', property.neighborhood))
    }
    if (property.city && property.property_type) {
        queries.push(baseQuery(100).eq('city', property.city).eq('property_type', property.property_type))
    }
    if (property.city) {
        queries.push(baseQuery(120).eq('city', property.city))
    }
    if (property.property_type) {
        queries.push(baseQuery(100).eq('property_type', property.property_type))
    }
    if (currentPrice) {
        queries.push(baseQuery(120).gte('price', Math.round(currentPrice * 0.5)).lte('price', Math.round(currentPrice * 1.75)))
    }

    if (queries.length === 0) {
        queries.push(baseQuery(160))
    }

    const results = await Promise.all(queries)
    for (const result of results) {
        if (result?.error) {
            console.warn('[Property Detail] related property query unavailable:', result.error.message)
            continue
        }
        addCandidates(result?.data)
    }

    return Array.from(candidates.values())
}

function buildDetailItems(property: any, locationLabel: string, area: number) {
    return [
        property.property_type ? `Tipo: ${property.property_type}` : null,
        locationLabel ? `Localização: ${locationLabel}` : null,
        area > 0 ? `Área privativa: ${area.toLocaleString('pt-BR')} m²` : null,
        property.area_total_m2 ? `Área total: ${Number(property.area_total_m2).toLocaleString('pt-BR')} m²` : null,
        property.bedrooms ? `${property.bedrooms} dormitórios` : null,
        property.suites ? `${property.suites} suítes` : null,
        property.bathrooms ? `${property.bathrooms} banheiros` : null,
        property.parking_spaces ? `${property.parking_spaces} vagas de garagem` : null,
        property.condo_fee ? `Condomínio: ${formatMoney(Number(property.condo_fee))}` : null,
        property.iptu ? `IPTU: ${formatMoney(Number(property.iptu))}` : null,
        property.exclusive ? 'Exclusivo Guilherme Pilger' : null,
        property.source_status ? `Condição: ${property.source_status}` : null,
    ].filter(Boolean) as string[]
}

type PropertyDetailPageProps = {
    params: Promise<{ id: string }>
    searchParams?: Promise<PageSearchParams>
    canonicalize?: boolean
}

export default async function PropertyDetailPage({
    params,
    searchParams,
    canonicalize = true,
}: PropertyDetailPageProps) {
    const supabase = await createServerSupabase()
    const { id } = await params

    const property = await getPropertyByIdentifier(id)

    if (!property) return notFound()

    const canonicalSegment = propertyDetailsSegment(property)
    const currentSegment = decodeURIComponent(id || '').trim()
    if (canonicalize && canonicalSegment && currentSegment !== canonicalSegment) {
        const query = serializeSearchParams(searchParams ? await searchParams : undefined)
        redirect(`${propertyDetailsPath(property)}${query}`)
    }

    const adminSupabase = createAdminClient()
    const responsibleBroker = await getResponsibleBrokerForProperty(adminSupabase, property.id)
    const { count: propertyViewCountRaw, error: propertyViewCountError } = await adminSupabase
        .from('funnel_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', 'property_details_landing_viewed')
        .contains('metadata', { property_id: property.id })

    const { data: propertyMapModalRows, error: propertyMapModalError } = await supabase
        .from('properties')
        .select(PROPERTY_MAP_MODAL_SELECT)
        .eq('status', 'active')
        .gte('price', PROPERTY_MAP_MODAL_MIN_PRICE)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(260)

    if (propertyViewCountError) {
        console.warn('[Property Detail] view count unavailable:', propertyViewCountError.message)
    }

    if (propertyMapModalError) {
        console.warn('[Property Detail] map modal portfolio unavailable:', propertyMapModalError.message)
    }

    const propertyViewCount = propertyViewCountRaw || 0
    const contactPhone = responsibleBroker.phone || GLOBAL_PROPERTY_WHATSAPP_PHONE
    const brokerCardName = responsibleBroker.is_connected
        ? responsibleBroker.name
        : responsibleBroker.legacy_name || 'Comercial Guilherme Pilger'
    const brokerCardImage = responsibleBroker.is_connected && responsibleBroker.photo_url
        ? responsibleBroker.photo_url
        : BROKER_IMAGE
    const brokerCreci = formatBrokerCreci(responsibleBroker.creci)
    const brokerCredentialLine = brokerCreci
        ? `Corretor de imóveis | ${brokerCreci}`
        : 'Corretor de imóveis'
    const gallery = getGallery(property)
    const amenities: string[] = property.amenities || []
    const displayTitle = cleanRepeatedPraiaBravaText(property.title)
    const displayCity = displayLocationName(property.city)
    const displayNeighborhood = replaceItajaiWithPraiaBrava(property.neighborhood)
    const mapLocation = [property.neighborhood, property.city, property.state].filter(Boolean).join(', ')
    const locationParts = buildDisplayLocationParts(property.neighborhood, property.city)
    const locationHeadline = locationParts.join(' — ')
    const locationPrimary = locationParts[0] || 'Litoral catarinense'
    const locationSecondary = locationParts.length > 1
        ? [...locationParts.slice(1), property.state].filter(Boolean).join(' - ')
        : property.state || ''
    const brokerInsight = buildBrokerInsight(property)
    const primaryImage = gallery[0] || DEFAULT_OG_IMAGE
    const area = Number(property.area_private_m2 || property.area_m2 || 0)
    const suiteCount = Number(property.suites || property.bedrooms || 0)
    const parkingCount = Number(property.parking_spaces || 0)
    const bathroomsCount = Number(property.bathrooms || 0)
    const bedroomCount = Number(property.bedrooms || 0)
    const narrativeParagraphs = property.description ? formatDescription(property.description) : []
    const locationLabel = [...locationParts, property.state].filter(Boolean).join(' - ')
    const youtubeId = extractYouTubeId(property.video_url)
    const detailItems = buildDetailItems(property, locationLabel, area)
    const featureItems = amenities.slice(0, 24)
    const projectItems = amenities.slice(24, 48)
    const propertyPath = propertyDetailsPath(property)
    const propertyUrl = absoluteUrl(propertyPath)
    const propertyTrackingMetadata = {
        property_id: property.id,
        property_slug: canonicalSegment,
        property_path: propertyPath,
        canonical_url: propertyUrl,
        property_url: propertyUrl,
        property_title: displayTitle,
        title: displayTitle,
        price: property.price || null,
        city: displayCity || null,
        neighborhood: displayNeighborhood || null,
        property_type: property.property_type || null,
        responsible_broker: responsibleBroker.name,
        responsible_broker_connected: responsibleBroker.is_connected,
        source: 'property_details_classic_premium',
    }
    const propertyMapLatLng = getMapLatLng(property)
    const propertyMapPreview = {
        id: property.id,
        source_slug: property.source_slug || null,
        title: displayTitle,
        seo_title: property.seo_title || null,
        seo_description: shortText(property.seo_description || property.description, ''),
        city: displayCity || property.city || null,
        state: property.state || null,
        neighborhood: displayNeighborhood || property.neighborhood || null,
        price: property.price ? Number(property.price) : null,
        bedrooms: property.bedrooms || null,
        suites: property.suites || null,
        area_m2: area || property.area_m2 || null,
        area_private_m2: property.area_private_m2 || null,
        property_type: property.property_type || null,
        exclusive: property.exclusive || null,
    }

    const [relatedCandidates, priceHistoryEvents] = await Promise.all([
        getRelatedPropertyCandidates(supabase, property),
        fetchPropertyPriceHistory(adminSupabase, property.id),
    ])
    const marketHistory = buildMarketHistory(property, relatedCandidates, area, locationLabel, priceHistoryEvents)
    const related = selectRelatedProperties(property, relatedCandidates)
    const marketTrackingMetadata = {
        ...propertyTrackingMetadata,
        section_id: 'historico-precos',
        section_label: 'Historico e valor',
        location_label: locationLabel || null,
        current_price_m2: marketHistory.currentPriceM2 || null,
        median_m2: marketHistory.medianM2 || null,
        delta_to_median: marketHistory.deltaToMedian,
        comparable_count: marketHistory.comparableCount,
    }
    const contextualLeadCtas = [
        {
            label: 'Analise de valor',
            icon: <BarChart3 size={15} />,
            template: 'property-context-value-analysis',
            message: `Ola, quero receber a analise de valor deste imovel ${propertyUrl}`,
            metadata: {
                ...marketTrackingMetadata,
                tracking_event_type: 'property_value_reading_requested',
                premium_intent: 'value_reading',
                requested_action: 'Receber leitura de valor',
                cta_context: 'value_analysis',
                cta_label: 'Analise de valor',
            },
        },
        {
            label: 'Visita na regiao',
            icon: <MapPin size={15} />,
            template: 'property-context-location-visit',
            message: `Ola, quero entender a localizacao e agendar uma visita deste imovel ${propertyUrl}`,
            metadata: {
                ...propertyTrackingMetadata,
                tracking_event_type: 'property_private_visit_requested',
                premium_intent: 'private_visit',
                requested_action: 'Agendar visita privada',
                section_id: 'localizacao',
                section_label: 'Localizacao',
                location_label: locationLabel || null,
                has_coordinates: Boolean(propertyMapLatLng),
                cta_context: 'location_visit',
                cta_label: 'Visita na regiao',
            },
        },
        {
            label: 'Negociacao reservada',
            icon: <CheckCircle2 size={15} />,
            template: 'property-context-reserved-negotiation',
            message: `Ola, quero tratar disponibilidade e negociacao reservada deste imovel ${propertyUrl}`,
            metadata: {
                ...propertyTrackingMetadata,
                tracking_event_type: 'property_reserved_negotiation_requested',
                premium_intent: 'reserved_negotiation',
                requested_action: 'Iniciar negociacao reservada',
                cta_context: 'reserved_negotiation',
                cta_label: 'Negociacao reservada',
            },
        },
        {
            label: 'Comparar similares',
            icon: <Home size={15} />,
            template: 'property-context-similar-options',
            message: `Ola, quero comparar este imovel com opcoes semelhantes ${propertyUrl}`,
            metadata: {
                ...propertyTrackingMetadata,
                tracking_event_type: 'property_availability_requested',
                premium_intent: 'availability',
                requested_action: 'Comparar opcoes e disponibilidade',
                section_id: 'imoveis-semelhantes',
                section_label: 'Imoveis semelhantes',
                comparable_count: relatedCandidates.length,
                related_visible_count: related.length,
                cta_context: 'similar_options',
                cta_label: 'Comparar similares',
            },
        },
    ]
    const mobileExploreMapPropertiesById = new Map<string, ReturnType<typeof toMobileExploreMapProperty>>()
    for (const item of propertyMapModalRows || []) {
        const mapped = toMobileExploreMapProperty(item)
        if (mapped.id && hasMapCoordinates(mapped)) mobileExploreMapPropertiesById.set(mapped.id, mapped)
    }
    const currentExploreMapProperty = toMobileExploreMapProperty(property, displayTitle, primaryImage)
    if (currentExploreMapProperty.id && hasMapCoordinates(currentExploreMapProperty)) {
        mobileExploreMapPropertiesById.set(currentExploreMapProperty.id, currentExploreMapProperty)
    }
    const mobileExploreMapProperties = Array.from(mobileExploreMapPropertiesById.values())
    const mobileNarrativePreview = narrativeParagraphs[0] || brokerInsight.text
    const mobileFactCards = [
        area > 0 ? { icon: <Ruler size={22} />, label: 'Area privativa', value: `${area.toLocaleString('pt-BR')} m2` } : null,
        suiteCount > 0 ? { icon: <BedDouble size={22} />, label: 'Configuracao', value: `${suiteCount} ${statLabel(suiteCount, 'suite', 'suites')}` } : null,
        bathroomsCount > 0 ? { icon: <Bath size={22} />, label: 'Banheiros', value: String(bathroomsCount) } : null,
        parkingCount > 0 ? { icon: <Car size={22} />, label: 'Garagem', value: `${parkingCount} ${statLabel(parkingCount, 'vaga', 'vagas')}` } : null,
        { icon: <MapPin size={22} />, label: 'Localizacao', value: locationLabel || displayCity || 'Litoral SC' },
        marketHistory.currentPriceM2 ? { icon: <BarChart3 size={22} />, label: 'Valor por m2', value: `${formatCompactMoney(Math.round(marketHistory.currentPriceM2))}/m2` } : null,
    ].filter(Boolean) as Array<{ icon: ReactNode; label: string; value: string }>
    const mobileDetailPreviewItems = Array.from(new Set([
        ...detailItems,
        ...featureItems.slice(0, 8),
        ...projectItems.slice(0, 6),
    ].filter(Boolean))).slice(0, 12)
    const propertyJsonLd = [
        organizationJsonLd(),
        webPageJsonLd({
            path: propertyPath,
            name: displayTitle,
            description: shortText(property.seo_description || property.description, `${property.property_type || 'Imóvel'} de alto padrão em ${displayCity}.`),
            type: 'WebPage',
            image: primaryImage,
        }),
        breadcrumbJsonLd([
            { name: 'Home', url: '/' },
            { name: 'Busca', url: '/busca' },
            { name: displayTitle, url: propertyPath },
        ]),
        {
            '@context': 'https://schema.org',
            '@type': 'RealEstateListing',
            '@id': `${propertyUrl}#listing`,
            name: displayTitle,
            url: propertyUrl,
            image: gallery,
            description: shortText(property.seo_description || property.description, `${property.property_type || 'Imóvel'} de alto padrão em ${displayCity}.`),
            mainEntityOfPage: {
                '@id': `${propertyUrl}#webpage`,
            },
            dateModified: property.updated_at || property.created_at,
            address: {
                '@type': 'PostalAddress',
                addressLocality: displayCity,
                addressRegion: property.state || 'SC',
                addressCountry: 'BR',
                streetAddress: [displayNeighborhood, property.street].filter(Boolean).join(', ') || undefined,
            },
            mainEntity: {
                '@type': 'Apartment',
                '@id': `${propertyUrl}#property`,
                name: displayTitle,
                image: gallery,
                accommodationCategory: property.property_type,
                numberOfBedrooms: property.bedrooms || property.suites || undefined,
                numberOfBathroomsTotal: property.bathrooms || undefined,
                numberOfParkingSpaces: property.parking_spaces || undefined,
                address: {
                    '@type': 'PostalAddress',
                    addressLocality: displayCity,
                    addressRegion: property.state || 'SC',
                    addressCountry: 'BR',
                    streetAddress: [displayNeighborhood, property.street].filter(Boolean).join(', ') || undefined,
                },
                geo: property.latitude && property.longitude ? {
                    '@type': 'GeoCoordinates',
                    latitude: property.latitude,
                    longitude: property.longitude,
                } : undefined,
                amenityFeature: amenities.slice(0, 20).map((name) => ({
                    '@type': 'LocationFeatureSpecification',
                    name,
                    value: true,
                })),
            },
            floorSize: area ? {
                '@type': 'QuantitativeValue',
                value: area,
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
    const mobileMediaImages = gallery.length ? gallery : [primaryImage]

    return (
        <>
            <PropertyLandingStyles />
            <JsonLd data={propertyJsonLd} />
            <PropertyLandingUrlTracker propertyId={property.id} />
            <PropertyLandingTracker
                propertyId={property.id}
                title={displayTitle}
                price={property.price}
                city={displayCity}
                neighborhood={displayNeighborhood}
                propertyType={property.property_type}
                propertyPath={propertyPath}
                propertySlug={canonicalSegment}
            />
            <GlobalHeader />

            <main className="plp-page" data-property-landing-root="true">
            <div className="plp-shell">
                <section className="plp-title-band">
                    <div className="plp-breadcrumbs">
                        <Link href="/">Início</Link>
                        <span>/</span>
                        <Link href="/busca">Imóveis à venda</Link>
                        <span>/</span>
                        <span>{displayCity || 'Litoral catarinense'}</span>
                        <span>/</span>
                        <strong>Ref. {referenceLabel(property)}</strong>
                    </div>

                    <div className="plp-title-row">
                        <div>
                            <span className="plp-kicker">{property.exclusive ? 'Exclusivo Guilherme Pilger' : property.property_type || 'Imóvel à venda'}</span>
                            <h1>{displayTitle}</h1>
                            <div className="plp-rating-row" aria-label="Avaliação editorial">
                                <span><Star size={15} fill="currentColor" /><Star size={15} fill="currentColor" /><Star size={15} fill="currentColor" /><Star size={15} fill="currentColor" /><Star size={15} fill="currentColor" /></span>
                                <strong>4,8</strong>
                                <small className="plp-view-count"><Eye size={14} /> {formatViewCount(propertyViewCount)}</small>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="plp-mobile-sheet-experience">
                    <PropertyMobileDetailSheet
                        media={(
                            <div className="plp-mobile-media-feed" aria-label="Fotos e localizacao do imovel">
                                <div className="plp-mobile-media-controls">
                                    <Link href="/busca" className="plp-mobile-back-pill" aria-label="Voltar para busca">
                                        <ArrowLeft size={23} />
                                    </Link>
                                    <div className="plp-mobile-action-group" aria-label="Acoes do imovel">
                                        <PropertyLandingFavoriteButton
                                            propertyId={property.id}
                                            title={displayTitle}
                                            className="plp-mobile-action-pill"
                                            source="property_details_mobile_sheet"
                                        />
                                        <PropertyLandingMobileMenu title={displayTitle} metadata={propertyTrackingMetadata} />
                                    </div>
                                </div>

                                {mobileMediaImages.slice(0, 1).map((image, index) => (
                                    <figure className="plp-mobile-media-item" key={`sheet-photo-${image}-${index}`}>
                                        <img src={image} alt={`${displayTitle} - foto ${index + 1}`} loading={index === 0 ? 'eager' : 'lazy'} />
                                        {index === 0 && (
                                            <figcaption className="plp-mobile-status-pill">
                                                <span />
                                                {property.property_type || 'Imovel a venda'}
                                            </figcaption>
                                        )}
                                    </figure>
                                ))}

                                {propertyMapLatLng && (
                                    <figure className="plp-mobile-media-item plp-mobile-media-item--map">
                                        <figcaption className="plp-mobile-map-label">
                                            <MapPin size={14} />
                                            Street View do entorno
                                        </figcaption>
                                        <PropertyLocationMap
                                            property={propertyMapPreview}
                                            latLng={propertyMapLatLng}
                                            initialView="street"
                                            allowedViews={['street']}
                                            showViewControl={false}
                                            showActions={false}
                                        />
                                    </figure>
                                )}

                                {mobileMediaImages.slice(1).map((image, index) => (
                                    <figure className="plp-mobile-media-item" key={`sheet-photo-extra-${image}-${index}`}>
                                        <img src={image} alt={`${displayTitle} - foto ${index + 2}`} loading="lazy" />
                                    </figure>
                                ))}

                                {propertyMapLatLng && (
                                    <figure className="plp-mobile-media-item plp-mobile-media-item--map plp-mobile-media-item--location-map">
                                        <figcaption className="plp-mobile-map-label">
                                            <MapPin size={14} />
                                            Mapa do entorno
                                        </figcaption>
                                        <PropertyLocationMap
                                            property={propertyMapPreview}
                                            latLng={propertyMapLatLng}
                                            initialView="luxury"
                                            allowedViews={['luxury']}
                                            showViewControl={false}
                                            showActions={false}
                                        />
                                    </figure>
                                )}
                            </div>
                        )}
                    >
                        <section className="plp-mobile-sheet-summary plp-mobile-card plp-mobile-card--summary">
                            {property.exclusive && <span className="plp-mobile-price-badge">Exclusivo Pilger</span>}
                            <strong className="plp-mobile-sheet-price">{formatMoney(property.price)}</strong>
                            <div className="plp-mobile-sheet-facts">
                                {bedroomCount > 0 && <span><BedDouble size={19} /> {bedroomCount} {statLabel(bedroomCount, 'dorm.', 'dorms.')}</span>}
                                {bathroomsCount > 0 && <span><Bath size={19} /> {bathroomsCount} {statLabel(bathroomsCount, 'banho', 'banhos')}</span>}
                                {area > 0 && <span><Ruler size={19} /> {area.toLocaleString('pt-BR')} m2</span>}
                                {parkingCount > 0 && <span><Car size={19} /> {parkingCount} {statLabel(parkingCount, 'vaga', 'vagas')}</span>}
                            </div>
                            <p>{locationLabel || displayTitle}</p>
                            <div className="plp-mobile-sheet-actions plp-mobile-sheet-actions--single">
                                <WhatsAppCaptureLink
                                    phone={contactPhone}
                                    message={`Ola, quero agendar uma visita privada neste imovel ${propertyUrl}`}
                                    slug="imovel"
                                    template="property-mobile-sheet-visit"
                                    metadata={{
                                        ...propertyTrackingMetadata,
                                        tracking_event_type: 'property_private_visit_requested',
                                        premium_intent: 'private_visit',
                                        requested_action: 'Agendar visita privada',
                                        cta_context: 'mobile_property_sheet',
                                        cta_label: 'Visita privada',
                                    }}
                                    className="plp-mobile-sheet-outline"
                                >
                                    Visita privada
                                </WhatsAppCaptureLink>
                            </div>
                        </section>

                        <section id="mobile-detalhes" className="plp-mobile-card plp-mobile-card--special">
                            <div className="plp-mobile-card-head">
                                <span className="plp-kicker">Destaques</span>
                                <h2>O que torna este imovel especial.</h2>
                            </div>
                            <p>{mobileNarrativePreview}</p>
                            {narrativeParagraphs.length > 1 && (
                                <details className="plp-mobile-description-details">
                                    <summary>Ver descricao completa</summary>
                                    <div className="plp-mobile-description-full">
                                        {narrativeParagraphs.slice(1).map((paragraph, index) => (
                                            <p key={`mobile-description-${index}`}>{paragraph}</p>
                                        ))}
                                    </div>
                                </details>
                            )}
                        </section>

                        <section className="plp-mobile-card plp-mobile-card--facts">
                            <div className="plp-mobile-card-head">
                                <span className="plp-kicker">Ficha</span>
                                <h2>Fatos e caracteristicas.</h2>
                            </div>
                            <div className="plp-mobile-facts-grid">
                                {mobileFactCards.map((item) => (
                                    <div className="plp-mobile-fact-tile" key={item.label}>
                                        <span>{item.icon}</span>
                                        <div>
                                            <small>{item.label}</small>
                                            <strong>{item.value}</strong>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {mobileDetailPreviewItems.length > 0 && (
                                <div className="plp-mobile-detail-list">
                                    {mobileDetailPreviewItems.map((item, index) => (
                                        <span key={`mobile-detail-${item}-${index}`}><CheckCircle2 size={15} /> {item}</span>
                                    ))}
                                </div>
                            )}
                            <PropertyNearbyBenefits
                                propertyId={property.id}
                                title={displayTitle}
                                latLng={propertyMapLatLng}
                                locationLabel={locationLabel || mapLocation || displayCity}
                                variant="mobile"
                            />
                        </section>

                        <section className="plp-mobile-card plp-mobile-broker-card">
                            <div className="plp-mobile-broker-head">
                                <img src={brokerCardImage} alt={brokerCardName} />
                                <div>
                                    <span className="plp-kicker">Especialista</span>
                                    <h2>{brokerCardName}</h2>
                                    <p>{brokerCredentialLine}</p>
                                </div>
                            </div>
                            <p>Converse para confirmar disponibilidade, condicoes de visita e leitura de oportunidade antes de avancar.</p>
                            <div className="plp-mobile-sheet-actions">
                                <WhatsAppCaptureLink
                                    phone={contactPhone}
                                    message={`Ola, quero falar com o especialista responsavel por este imovel ${propertyUrl}`}
                                    slug="imovel"
                                    template="property-mobile-sheet-specialist"
                                    metadata={{
                                        ...propertyTrackingMetadata,
                                        tracking_event_type: 'property_specialist_contact_requested',
                                        premium_intent: 'specialist_contact',
                                        requested_action: 'Falar com especialista',
                                        cta_context: 'mobile_property_specialist_card',
                                        cta_label: 'Especialista',
                                    }}
                                    className="plp-mobile-sheet-primary"
                                >
                                    <MessageCircle size={18} />
                                    Falar agora
                                </WhatsAppCaptureLink>
                            </div>
                        </section>

                        <section className="plp-mobile-card plp-mobile-market-section">
                            <div className="plp-mobile-card-head">
                                <span className="plp-kicker">Mercado</span>
                                <h2>Valor e historico.</h2>
                            </div>
                            <div className="plp-mobile-market-grid">
                                <div>
                                    <small>Preco atual</small>
                                    <strong>{formatMoney(property.price)}</strong>
                                </div>
                                <div>
                                    <small>Valor por m2</small>
                                    <strong>{marketHistory.currentPriceM2 ? `${formatCompactMoney(Math.round(marketHistory.currentPriceM2))}/m2` : 'Sob consulta'}</strong>
                                </div>
                                <div>
                                    <small>Comparaveis ativos</small>
                                    <strong>{marketHistory.comparableCount ? String(marketHistory.comparableCount) : 'Em curadoria'}</strong>
                                </div>
                                <div>
                                    <small>Leitura vs. mediana</small>
                                    <strong>{marketHistory.deltaToMedian === null ? 'Sem amostra' : formatPercent(marketHistory.deltaToMedian)}</strong>
                                </div>
                            </div>
                            <div className="plp-mobile-timeline">
                                {marketHistory.timeline.map((event, index) => (
                                    <div className="plp-mobile-timeline-item" key={`mobile-${event.title}-${index}`}>
                                        <span>{event.date}</span>
                                        <div>
                                            <strong>{event.title}</strong>
                                            <small>{event.note}</small>
                                        </div>
                                        <b>{event.value}</b>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="plp-mobile-card plp-mobile-location-card">
                            <div className="plp-mobile-card-head">
                                <span className="plp-kicker">Entorno</span>
                                <h2>Localizacao e contexto.</h2>
                            </div>
                            <p>{locationLabel || mapLocation || 'Endereco sob curadoria para visitas qualificadas.'}</p>
                            {propertyMapLatLng ? (
                                <div className="plp-map-frame plp-mobile-location-map">
                                    <PropertyLocationMap
                                        property={propertyMapPreview}
                                        latLng={propertyMapLatLng}
                                        initialView="luxury"
                                        allowedViews={['luxury']}
                                        showViewControl={false}
                                        showActions={false}
                                    />
                                </div>
                            ) : (
                                <div className="plp-mobile-location-grid">
                                    <span><MapPin size={17} /> Endereco confirmado pelo especialista antes da visita.</span>
                                    <span><Eye size={17} /> Contexto visual em curadoria.</span>
                                </div>
                            )}
                        </section>

                        {related.length > 0 && (
                            <section className="plp-mobile-card plp-mobile-related-section">
                                <div className="plp-mobile-card-head">
                                    <span className="plp-kicker">Comparacao</span>
                                    <h2>Imoveis semelhantes.</h2>
                                </div>
                                <div className="plp-mobile-related-rail">
                                    {related.map((item: any) => {
                                        const image = item.featured_image || item.images?.[0] || DEFAULT_OG_IMAGE
                                        const itemArea = Number(item.area_private_m2 || item.area_m2 || 0)
                                        const itemSuites = Number(item.suites || item.bedrooms || 0)
                                        const relatedLocation = buildDisplayLocationParts(item.neighborhood, item.city).join(' - ')
                                        const relatedTitle = cleanRepeatedPraiaBravaText(item.title)
                                        return (
                                            <Link key={item.id} href={propertyDetailsPath(item)} className="plp-mobile-related-card">
                                                <img src={image} alt={relatedTitle} loading="lazy" />
                                                {item.exclusive && <span>Exclusivo</span>}
                                                <div>
                                                    <strong>{formatMoney(item.price)}</strong>
                                                    <small>{itemArea ? `${itemArea.toLocaleString('pt-BR')} m2` : 'Area sob consulta'} | {itemSuites ? `${itemSuites} suites` : item.property_type || 'Imovel'}</small>
                                                    <p>{relatedLocation || relatedTitle}</p>
                                                </div>
                                            </Link>
                                        )
                                    })}
                                </div>
                            </section>
                        )}

                        <section className="plp-mobile-card plp-mobile-transparency-card">
                            <div className="plp-mobile-card-head">
                                <span className="plp-kicker">Transparencia</span>
                                <h2>Dados sujeitos a confirmacao.</h2>
                            </div>
                            <p>Preco, disponibilidade, metragem, custos recorrentes e condicoes comerciais devem ser confirmados pelo especialista antes de qualquer decisao.</p>
                        </section>
                    </PropertyMobileDetailSheet>
                </section>

                <section id="visao" className="plp-detail-layout">
                    <div className="plp-gallery-column">
                        <div className="plp-desktop-photo-showcase">
                            <PropertyDesktopMediaShowcase
                                images={gallery.length ? gallery : [primaryImage]}
                                title={displayTitle}
                                property={propertyMapPreview}
                                latLng={propertyMapLatLng}
                                metadata={propertyTrackingMetadata}
                                shareSlot={(
                                    <>
                                        <PropertyLandingFavoriteButton propertyId={property.id} title={displayTitle} />
                                        <PropertyLandingShareButton propertyId={property.id} title={displayTitle} propertyPath={propertyPath} />
                                    </>
                                )}
                            />
                        </div>
                        <div className="plp-mobile-media-feed" aria-label="Fotos e localizacao do imovel">
                            <div className="plp-mobile-media-controls">
                                <Link href="/busca" className="plp-mobile-back-pill" aria-label="Voltar para busca">
                                    <ArrowLeft size={23} />
                                </Link>
                                <div className="plp-mobile-action-group" aria-label="Acoes do imovel">
                                    <PropertyLandingFavoriteButton
                                        propertyId={property.id}
                                        title={displayTitle}
                                        className="plp-mobile-action-pill"
                                        source="property_details_mobile_media"
                                    />
                                    <PropertyLandingMobileMenu title={displayTitle} metadata={propertyTrackingMetadata} />
                                </div>
                            </div>

                            {mobileMediaImages.slice(0, 1).map((image, index) => (
                                <figure className="plp-mobile-media-item" key={`mobile-photo-${image}-${index}`}>
                                    <img src={image} alt={`${displayTitle} - foto ${index + 1}`} loading={index === 0 ? 'eager' : 'lazy'} />
                                    {index === 0 && (
                                        <figcaption className="plp-mobile-status-pill">
                                            <span />
                                            {property.property_type || 'Imovel a venda'}
                                        </figcaption>
                                    )}
                                </figure>
                            ))}

                            {propertyMapLatLng && (
                                <figure className="plp-mobile-media-item plp-mobile-media-item--map">
                                    <figcaption className="plp-mobile-map-label">
                                        <MapPin size={14} />
                                        Street View do entorno
                                    </figcaption>
                                    <PropertyLocationMap
                                        property={propertyMapPreview}
                                        latLng={propertyMapLatLng}
                                        initialView="street"
                                        allowedViews={['street']}
                                        showViewControl={false}
                                        showActions={false}
                                    />
                                </figure>
                            )}

                            {mobileMediaImages.slice(1).map((image, index) => (
                                <figure className="plp-mobile-media-item" key={`mobile-extra-photo-${image}-${index}`}>
                                    <img src={image} alt={`${displayTitle} - foto ${index + 2}`} loading="lazy" />
                                </figure>
                            ))}

                            {propertyMapLatLng && (
                                <figure className="plp-mobile-media-item plp-mobile-media-item--map plp-mobile-media-item--location-map">
                                    <figcaption className="plp-mobile-map-label">
                                        <MapPin size={14} />
                                        Mapa do entorno
                                    </figcaption>
                                    <PropertyLocationMap
                                        property={propertyMapPreview}
                                        latLng={propertyMapLatLng}
                                        initialView="luxury"
                                        allowedViews={['luxury']}
                                        showViewControl={false}
                                        showActions={false}
                                    />
                                </figure>
                            )}
                        </div>
                        {false && <div className={`plp-gallery-composer ${gallery.length <= 1 ? 'single' : ''}`}>
                            <a href="#galeria" className="plp-main-photo" aria-label="Abrir galeria completa">
                                <img src={primaryImage} alt={displayTitle} />
                                <span className="plp-photo-badge"><Camera size={16} /> {gallery.length || 1} fotos</span>
                            </a>
                            <div className="plp-thumb-rail" aria-label="Prévia de fotos">
                                {gallery.slice(1, 6).map((image, index) => (
                                    <a href="#galeria" key={`${image}-${index}`} className="plp-thumb-item">
                                        <img src={image} alt={`${displayTitle} - prévia ${index + 2}`} loading="lazy" />
                                    </a>
                                ))}
                            </div>
                        </div>}

                    </div>

                    <div className="plp-main-column plp-content-column">
                        <section id="experiencia" className="plp-section plp-copy-section">
                            <span className="plp-kicker">Visão geral</span>
                            <h2>{displayTitle}</h2>
                            <p className="plp-intro-line">Viva no topo do luxo e sofisticação com uma leitura clara de localização, produto e momento de mercado.</p>
                            <div className="plp-narrative">
                                {(narrativeParagraphs.length ? narrativeParagraphs : [brokerInsight.text]).map((paragraph, index) => (
                                    <p key={index}>{paragraph}</p>
                                ))}
                            </div>
                        </section>

                        <section id="ficha" className="plp-section">
                            <div className="plp-section-head">
                                <span className="plp-kicker">Ficha rápida</span>
                                <h2>Dados principais do imóvel.</h2>
                            </div>
                            <div className="plp-spec-grid">
                                {area > 0 && <SpecCard icon={<Ruler size={21} />} label="Área" value={`${area.toLocaleString('pt-BR')} m²`} />}
                                {suiteCount > 0 && <SpecCard icon={<BedDouble size={21} />} label="Configuração" value={`${suiteCount} ${statLabel(suiteCount, 'suíte', 'suítes')}`} />}
                                {bathroomsCount > 0 && <SpecCard icon={<Bath size={21} />} label="Banheiros" value={String(bathroomsCount)} />}
                                {parkingCount > 0 && <SpecCard icon={<Car size={21} />} label="Garagem" value={`${parkingCount} ${statLabel(parkingCount, 'vaga', 'vagas')}`} />}
                                <SpecCard icon={<MapPin size={21} />} label="Localização" value={locationLabel || displayCity || 'Litoral SC'} />
                            </div>
                            <PropertyNearbyBenefits
                                propertyId={property.id}
                                title={displayTitle}
                                latLng={propertyMapLatLng}
                                locationLabel={locationLabel || mapLocation || displayCity}
                            />
                        </section>

                        <section className="plp-section plp-classic-lists">
                            <InfoList title="Detalhes do imóvel" items={detailItems} />
                            {featureItems.length > 0 && <InfoList title="Características do imóvel" items={featureItems} />}
                            {projectItems.length > 0 && <InfoList title="Características do empreendimento" items={projectItems} />}
                        </section>

                        <section id="historico-precos" className="plp-section plp-market-history">
                            <div className="plp-section-head">
                                <span className="plp-kicker">Histórico e valor</span>
                                <h2>Preço, custos e leitura de mercado.</h2>
                            </div>
                            <div className="plp-market-grid">
                                <article className="plp-market-card plp-market-main">
                                    <div className="plp-market-card-head">
                                        <span><BarChart3 size={16} /> Posicionamento por m²</span>
                                        <strong>{marketHistory.comparableCount ? `${marketHistory.comparableCount} comparáveis` : 'Amostra em formação'}</strong>
                                    </div>
                                    <div className="plp-market-metrics">
                                        <div>
                                            <small>Valor anunciado</small>
                                            <strong>{formatCompactMoney(property.price)}</strong>
                                        </div>
                                        <div>
                                            <small>Preço por m²</small>
                                            <strong>{marketHistory.currentPriceM2 ? `${formatCompactMoney(Math.round(marketHistory.currentPriceM2))}/m²` : 'Sob consulta'}</strong>
                                        </div>
                                        <div>
                                            <small>Mediana regional</small>
                                            <strong>{marketHistory.medianM2 ? `${formatCompactMoney(Math.round(marketHistory.medianM2))}/m²` : 'Sem amostra'}</strong>
                                        </div>
                                    </div>
                                    <div className="plp-market-chart" aria-label="Gráfico de posicionamento do preço por metro quadrado">
                                        <svg viewBox="0 0 100 44" preserveAspectRatio="none">
                                            <path d="M0 36 H100" />
                                            {marketHistory.chartPoints && <polyline points={marketHistory.chartPoints} />}
                                            <line x1={marketHistory.position} x2={marketHistory.position} y1="6" y2="39" />
                                            <circle cx={marketHistory.position} cy="12" r="2.6" />
                                        </svg>
                                        <div className="plp-market-axis">
                                            <span>Entrada</span>
                                            <span>Mediana</span>
                                            <span>Topo</span>
                                        </div>
                                    </div>
                                    <p className="plp-market-note">
                                        <TrendingUp size={15} />
                                        {marketHistory.deltaToMedian === null
                                            ? 'A leitura de valor será enriquecida conforme houver mais comparáveis ativos na região.'
                                            : `${formatPercent(marketHistory.deltaToMedian)} em relação à mediana dos comparáveis ativos. Não é promessa de valorização.`}
                                    </p>
                                    <WhatsAppCaptureLink
                                        phone={contactPhone}
                                        message={`Ola, quero receber a leitura de valor deste imovel ${propertyUrl}`}
                                        slug="imovel"
                                        template="property-market-value-cta"
                                        metadata={{
                                            ...marketTrackingMetadata,
                                            tracking_event_type: 'property_value_reading_requested',
                                            premium_intent: 'value_reading',
                                            requested_action: 'Receber leitura de valor',
                                            cta_context: 'market_value_card',
                                            cta_label: 'Receber leitura de valor',
                                        }}
                                        className="plp-market-cta"
                                    >
                                        <BarChart3 size={15} />
                                        Receber leitura de valor
                                    </WhatsAppCaptureLink>
                                </article>

                                <article className="plp-market-card plp-price-history-card">
                                    <div className="plp-market-card-head">
                                        <span>Historico de preco</span>
                                        <strong>Mercado local</strong>
                                    </div>
                                    <div className="plp-price-history-list">
                                        {marketHistory.timeline.map((event, index) => (
                                            <div className="plp-price-history-item" key={`${event.title}-${index}`}>
                                                <span>{event.date}</span>
                                                <div>
                                                    <strong>{event.title}</strong>
                                                    <small>{event.note}</small>
                                                </div>
                                                <b>{event.value}</b>
                                            </div>
                                        ))}
                                    </div>
                                </article>
                            </div>
                        </section>

                    </div>

                    <section id="localizacao" className="plp-location-band">
                        <div className="plp-location-head">
                            <span>Localização</span>
                            <strong>{locationHeadline || 'Localização estratégica'}</strong>
                        </div>
                        <div className="plp-map-frame">
                            {propertyMapLatLng ? (
                                <PropertyLocationMap
                                    property={propertyMapPreview}
                                    latLng={propertyMapLatLng}
                                    initialView="luxury"
                                    allowedViews={['luxury', 'satellite']}
                                />
                            ) : (
                                <div className="plp-map-empty">
                                    <MapPin size={22} />
                                    <strong>{locationLabel || mapLocation || 'Localizacao sob curadoria'}</strong>
                                    <span>Endereco exato apresentado pelo agente durante o atendimento.</span>
                                </div>
                            )}
                        </div>
                    </section>

                    <aside className="plp-sidebar" aria-label="Atendimento e resumo comercial">
                        <div className="plp-side-card plp-price-card">
                            <div className="plp-side-location">
                                <MapPin size={13} />
                                <div className="plp-side-loc-text">
                                    <span className="plp-loc-name">{locationPrimary}</span>
                                    {locationSecondary && <span className="plp-loc-sub">{locationSecondary}</span>}
                                </div>
                                <div className="plp-loc-price">
                                    <strong>{formatMoney(property.price)}</strong>
                                    <span>valor anunciado</span>
                                </div>
                            </div>

                            <div className="plp-side-facts">
                                {bedroomCount > 0 && <SideFact icon={<BedDouble size={17} />} value={String(bedroomCount)} label={statLabel(bedroomCount, 'dormitório', 'dormitórios')} />}
                                {bathroomsCount > 0 && <SideFact icon={<Bath size={17} />} value={String(bathroomsCount)} label={statLabel(bathroomsCount, 'banheiro', 'banheiros')} />}
                                {parkingCount > 0 && <SideFact icon={<Car size={17} />} value={String(parkingCount)} label={statLabel(parkingCount, 'vaga', 'vagas')} />}
                                {area > 0 && <SideFact icon={<Ruler size={17} />} value={`${area.toLocaleString('pt-BR')} m²`} label="área privativa" />}
                            </div>

                            {(property.condo_fee || property.iptu) && (
                                <div className="plp-price-extras">
                                    {property.condo_fee && <small>Condomínio: {formatMoney(Number(property.condo_fee))}</small>}
                                    {property.iptu && <small>IPTU: {formatMoney(Number(property.iptu))}</small>}
                                </div>
                            )}

                            <p className="plp-commercial-note">Preço, disponibilidade e condições podem ser alterados sem aviso prévio.</p>

                        </div>

                        <div className="plp-side-card plp-lead-card">
                            <h3><MessageCircle size={18} /> Mais informações sobre este imóvel</h3>
                            <p>Envie seus dados para receber disponibilidade, condições e atendimento direto pelo WhatsApp.</p>
                            <div className="plp-form-preview" aria-hidden="true">
                                <span className="plp-form-message">Ola, tenho interesse no imovel {propertyUrl}</span>
                                <span>Nome completo *</span>
                                <span>Telefone *</span>
                                <span>Email *</span>
                            </div>
                            <WhatsAppCaptureLink
                                phone={contactPhone}
                                message={`Ola, tenho interesse no imovel ${propertyUrl}`}
                                slug="imovel"
                                template="property-classic-form"
                                metadata={{
                                    ...propertyTrackingMetadata,
                                    tracking_event_type: 'property_availability_requested',
                                    premium_intent: 'availability',
                                    requested_action: 'Receber disponibilidade e condicoes',
                                    cta_context: 'sidebar_lead_card',
                                    cta_label: 'Enviar interesse',
                                }}
                                className="plp-dark-button"
                            >
                                Enviar interesse
                            </WhatsAppCaptureLink>
                            <div className="plp-context-cta-list" aria-label="Intencoes rapidas">
                                {contextualLeadCtas.map((cta) => (
                                    <WhatsAppCaptureLink
                                        key={cta.template}
                                        phone={contactPhone}
                                        message={cta.message}
                                        slug="imovel"
                                        template={cta.template}
                                        metadata={cta.metadata}
                                        className="plp-context-cta"
                                    >
                                        {cta.icon}
                                        <span>{cta.label}</span>
                                    </WhatsAppCaptureLink>
                                ))}
                            </div>
                        </div>

                        <div className="plp-side-card plp-broker-card">
                            <img src={brokerCardImage} alt={brokerCardName} />
                            <div>
                                <h3>{brokerCardName}</h3>
                                <p>{brokerCredentialLine}</p>
                            </div>
                        </div>
                    </aside>
                </section>

                {youtubeId && (
                    <section className="plp-video-card">
                        <div className="plp-section-head compact">
                            <span className="plp-kicker">Vídeo do imóvel</span>
                            <h2>Assista antes de avançar para a visita.</h2>
                        </div>
                        <iframe
                            src={`https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1`}
                            title={`${displayTitle} - vídeo`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    </section>
                )}

                {related.length > 0 && (
                    <section className="plp-related-band">
                        <div className="plp-related-head">
                            <div>
                                <span>Imóveis semelhantes</span>
                                <h2>Compare com outras oportunidades.</h2>
                            </div>
                            <Link href="/busca">Ver busca completa <ArrowRight size={16} /></Link>
                        </div>
                        <div className="plp-related-grid">
                            {related.map((item: any) => {
                                const image = item.featured_image || item.images?.[0] || DEFAULT_OG_IMAGE
                                const itemArea = Number(item.area_private_m2 || item.area_m2 || 0)
                                const itemSuites = Number(item.suites || item.bedrooms || 0)
                                const relatedLocation = buildDisplayLocationParts(item.neighborhood, item.city).join(' - ')
                                const relatedTitle = cleanRepeatedPraiaBravaText(item.title)
                                return (
                                    <Link key={item.id} href={propertyDetailsPath(item)} className="plp-related-card">
                                        <img src={image} alt={relatedTitle} loading="lazy" />
                                        {item.exclusive && <span className="plp-card-ribbon">Exclusivo</span>}
                                        <div>
                                            <small><MapPin size={13} /> {relatedLocation || 'Litoral catarinense'}</small>
                                            <h3>{relatedTitle}</h3>
                                            <div className="plp-related-meta">
                                                <span>{itemArea ? `${itemArea.toLocaleString('pt-BR')} m²` : 'Área sob consulta'}</span>
                                                <span>{itemSuites ? `${itemSuites} suítes` : item.property_type || 'Imóvel'}</span>
                                                <strong>{formatMoney(item.price)}</strong>
                                            </div>
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    </section>
                )}

                <PropertyContinuationRail currentPropertyId={property.id} title={displayTitle} />

            </div>

            <Footer />

            <div className="plp-mobile-sticky-cta">
                <WhatsAppCaptureLink
                    phone={contactPhone}
                    message={`Ola, tenho interesse no imovel ${propertyUrl}`}
                    slug="imovel"
                    template="property-classic-sticky"
                    metadata={{
                        ...propertyTrackingMetadata,
                        tracking_event_type: 'property_private_visit_requested',
                        premium_intent: 'private_visit',
                        requested_action: 'Receber detalhes, disponibilidade e visita privada',
                        cta_context: 'mobile_sticky_cta',
                        cta_label: 'CTA fixo mobile',
                    }}
                    className="plp-mobile-cta-button"
                >
                    <span className="plp-mobile-cta-prompt" aria-hidden="true">
                        Receba os <strong>detalhes privados</strong> deste imóvel em seu WhatsApp.
                        <CheckCircle2 size={16} />
                    </span>
                    <span className="plp-mobile-cta-icon">
                        <WhatsAppIcon />
                    </span>
                    <span className="plp-mobile-cta-label">Receba detalhes, disponibilidade e visita privada deste imóvel em seu WhatsApp apos o cadastro</span>
                </WhatsAppCaptureLink>
            </div>

            <MobileNav
                phone={contactPhone}
                message={`Ola, tenho interesse no imovel ${propertyUrl}`}
                slug="imovel"
                template="property-classic-mobile-nav"
                metadata={{
                    ...propertyTrackingMetadata,
                    tracking_event_type: 'property_availability_requested',
                    premium_intent: 'availability',
                    requested_action: 'Falar com especialista sobre disponibilidade',
                    cta_context: 'mobile_nav',
                    cta_label: 'Especialista',
                }}
                sharePropertyId={property.id}
                shareTitle={displayTitle}
                sharePropertyPath={propertyPath}
                whatsappLabel="Especialista"
                whatsappTone="brand"
            />
            <MobileMapSearchModal
                properties={mobileExploreMapProperties}
                defaultSource="property_details_mobile_nav"
                statFallback="Curadoria no mapa"
            />
        </main>
        </>
    )
}

function WhatsAppIcon({ size = 28 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
            <path
                fill="currentColor"
                d="M16 3.2c-6.86 0-12.43 5.48-12.43 12.23 0 2.3.66 4.55 1.91 6.49l-1.31 4.82 4.98-1.28A12.59 12.59 0 0 0 16 27.66c6.86 0 12.43-5.49 12.43-12.23S22.86 3.2 16 3.2Zm0 22.39c-2.1 0-4.05-.62-5.68-1.69l-.4-.26-2.95.76.78-2.85-.27-.43a10.03 10.03 0 0 1-1.84-5.69c0-5.6 4.64-10.16 10.36-10.16s10.36 4.56 10.36 10.16S21.72 25.59 16 25.59Zm5.79-7.6c-.31-.15-1.85-.9-2.14-1-.29-.11-.5-.15-.71.15-.21.31-.81 1-.99 1.2-.18.21-.36.23-.67.08-.31-.15-1.31-.47-2.5-1.51-.92-.81-1.55-1.81-1.73-2.12-.18-.31-.02-.47.14-.62.14-.14.31-.36.47-.54.16-.18.21-.31.31-.52.1-.21.05-.39-.03-.54-.08-.15-.71-1.68-.97-2.3-.26-.6-.51-.52-.71-.53h-.6c-.21 0-.55.08-.84.39-.29.31-1.1 1.06-1.1 2.59s1.13 3 1.28 3.21c.16.21 2.23 3.35 5.4 4.69.75.32 1.34.51 1.8.65.76.24 1.45.2 1.99.12.61-.09 1.85-.75 2.11-1.47.26-.72.26-1.34.18-1.47-.08-.13-.29-.21-.6-.36Z"
            />
        </svg>
    )
}

function SpecCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
    return (
        <div className="plp-spec-card">
            <span>{icon}</span>
            <div>
                <small>{label}</small>
                <strong>{value}</strong>
            </div>
        </div>
    )
}

function SideFact({ icon, value, label, variant }: { icon: ReactNode; value: string; label: string; variant?: 'price' }) {
    return (
        <div className={variant === 'price' ? 'plp-side-fact-price' : undefined}>
            {icon}
            <strong>{value}</strong>
            <span>{label}</span>
        </div>
    )
}

function InfoList({ title, items }: { title: string; items: string[] }) {
    if (!items.length) return null

    return (
        <article className="plp-info-list">
            <h3>{title}</h3>
            <div>
                {chunkList(items, 2).map((group, groupIndex) => (
                    <ul key={groupIndex}>
                        {group.map((item, index) => (
                            <li key={`${item}-${index}`}>{item}</li>
                        ))}
                    </ul>
                ))}
            </div>
        </article>
    )
}

function buildBrokerInsight(property: any) {
    const city = displayLocationName(property.city) || 'região'
    const type = property.property_type || 'imóvel'
    const price = Number(property.price || 0)

    if (price >= 10000000) {
        return {
            title: 'Este é um imóvel para comprar com estratégia, não por impulso.',
            text: `Quando o ativo passa desse patamar em ${city}, a decisão precisa considerar liquidez, escassez e negociação. Meu papel é mostrar onde existe valor real e onde existe apenas aparência.`,
        }
    }

    return {
        title: `O ponto forte deste ${type} está na combinação entre localização e timing.`,
        text: `Antes de visitar, vale entender o contexto de ${city}, comparar opções parecidas e enxergar se este imóvel faz sentido para moradia, investimento ou proteção patrimonial.`,
    }
}
