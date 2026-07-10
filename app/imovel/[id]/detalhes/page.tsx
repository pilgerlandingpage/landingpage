import type { Metadata } from 'next'
import type { CSSProperties, ReactNode } from 'react'
import { createAdminClient, createSupabaseAbortSignal, summarizeSupabaseError } from '@/lib/supabase/server'
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
    Clock3,
    Eye,
    Heart,
    Home,
    MapPin,
    MessageCircle,
    Ruler,
    ShieldCheck,
    Star,
    SunMedium,
    TrendingUp,
    Umbrella,
    Waves,
} from 'lucide-react'
import PropertyLandingTracker from '@/components/property/PropertyLandingTracker'
import PropertyLandingUrlTracker from '@/components/property/PropertyLandingUrlTracker'
import PropertyDesktopMediaShowcase from '@/components/property/PropertyDesktopMediaShowcase'
import PropertyLandingFavoriteButton from '@/components/property/PropertyLandingFavoriteButton'
import PropertyLandingShareButton from '@/components/property/PropertyLandingShareButton'
import PropertyLandingMobileMenu from '@/components/property/PropertyLandingMobileMenu'
import PropertyContinuationRail from '@/components/property/PropertyContinuationRail'
import PropertyMobileMapPreview from '@/components/property/PropertyMobileMapPreview'
import PropertyMobileDetailSheet from '@/components/property/PropertyMobileDetailSheet'
import PropertyBrokerAvatar from '@/components/property/PropertyBrokerAvatar'
import PropertyNearbyBenefits from '@/components/property/PropertyNearbyBenefits'
import PropertyVideoEmbed, { hasPropertyVideo } from '@/components/property/PropertyVideoEmbed'
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
import { getPropertyPrimaryQualityLabel } from '@/lib/properties/intelligence'
import { GLOBAL_PROPERTY_BROKER_NAME, GLOBAL_PROPERTY_WHATSAPP_PHONE, getResponsibleBrokerForProperty } from '@/lib/properties/responsible-broker'
import { fetchPropertyPriceHistory, type PropertyPriceHistoryRow } from '@/lib/properties/price-history'
import {
    buildMarketRadarAnalysis,
    fetchInternalMarketComparables,
    formatMarketPercent,
    type MarketComparable,
} from '@/lib/market-analysis/radar'

export const revalidate = 300

export function generateStaticParams() {
    return []
}

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

type MobileSummaryHighlight = {
    label: string
    icon: ReactNode
}

type PropertyDevelopmentGalleryItem = {
    title: string
    image: string
    category: string
}

type PropertyDevelopmentUnitContext = {
    id?: string
    propertyId?: string
    sourceReference?: string
    title: string
    type: string
    area: string
    suites: string
    price: string
    sourceSlug: string
}

type PropertyDevelopmentContext = {
    slug: string
    name: string
    locationName: string
    priceRange: string
    availableUnitsCount: number | null
    areaRange: string
    suitesRange: string
    heroImage: string
    description: string
    gallery: PropertyDevelopmentGalleryItem[]
    unit: PropertyDevelopmentUnitContext
}

const PROPERTY_BRAVA_CONCETTO_FALLBACK_DEVELOPMENT = {
    name: 'Brava Concetto',
    pageSlug: 'bravaconceto',
    locationName: 'Praia Brava, Itajai - SC',
    priceRange: 'R$ 8.600.000 a R$ 21.000.000',
    availableUnitsCount: 3,
    areaRange: '280m2 a 592m2',
    suitesRange: '4 suites',
    heroImage: '/images/brava-concetto/1_CL_BC_FACHADA_DIURNA_R01.jpg',
    description: 'Um empreendimento de poucas unidades na Praia Brava, pensado para quem busca privacidade, arquitetura autoral e leitura clara de patrimonio.',
    units: [
        {
            type: 'Apartamento Tipo',
            title: 'Apartamento no Ed. Brava Concetto',
            area: '280m2',
            suites: '4 suites',
            price: 'R$ 8.600.000',
            sourceSlug: 'apartamento-garden-no-ed-brava-concetto-na-praia-brava-em-itajaisc',
        },
        {
            type: 'Apartamento Garden',
            title: 'Apartamento Garden no Ed. Brava Concetto',
            area: '368m2',
            suites: '4 suites',
            price: 'R$ 10.000.000',
            sourceSlug: 'apartamento-garden-no-ed-brava-concetto-na-praia-brava-em-itajaisc',
        },
        {
            type: 'Cobertura Duplex',
            title: 'Cobertura Duplex no Ed. Brava Concetto',
            area: '592m2',
            suites: '4 suites',
            price: 'R$ 21.000.000',
            sourceSlug: 'apartamento-garden-no-ed-brava-concetto-na-praia-brava-em-itajaisc',
        },
    ],
    gallery: [
        { title: 'Fachada diurna', image: '/images/brava-concetto/1_CL_BC_FACHADA_DIURNA_R01.jpg', category: 'Fachada' },
        { title: 'Fachada noturna', image: '/images/brava-concetto/2_CL_BC_FACHADA_NOTURNA_R01.jpg', category: 'Fachada' },
        { title: 'Vista aerea', image: '/images/brava-concetto/5_CL_BC_VOO_PASSARO_R01.jpg', category: 'Implantacao' },
        { title: 'Hall de entrada', image: '/images/brava-concetto/8_CL_BC_HALL_DE_ENTRADA_EF_web.jpg', category: 'Hall' },
        { title: 'Piscina', image: '/images/brava-concetto/15_CL_BC_PISCINA_EF_web.jpg', category: 'Lazer' },
        { title: 'Living', image: '/images/brava-concetto/22_CL_BC_LIVING_FINAL_02_EF_web.jpg', category: 'Interior' },
    ],
}

function isUuid(value: string) {
    return UUID_PATTERN.test(value)
}

function asSafeRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function asSafeText(value: unknown, fallback = '') {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function asSafeNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value.replace(',', '.'))
        if (Number.isFinite(parsed)) return parsed
    }
    return null
}

function normalizeSourceSlugKey(value: unknown) {
    return asSafeText(value).trim().toLowerCase()
}

function normalizeComparableText(value: unknown) {
    return asSafeText(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
}

function parseComparableNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    const text = asSafeText(value).replace(/m\s*(2|²)/gi, '')
    if (!text) return null
    const normalized = text
        .replace(/[^\d,.-]/g, '')
        .replace(/\.(?=\d{3}(\D|$))/g, '')
        .replace(',', '.')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
}

function priceMatches(unitPrice: unknown, propertyPrice: unknown) {
    const unitValue = parseComparableNumber(unitPrice)
    const propertyValue = parseComparableNumber(propertyPrice)
    if (unitValue === null || propertyValue === null) return false
    return Math.abs(unitValue - propertyValue) < 1
}

function areaMatches(unitArea: unknown, property: any) {
    const unitValue = parseComparableNumber(unitArea)
    const propertyValue = parseComparableNumber(property?.area_private_m2 ?? property?.area_m2)
    if (unitValue === null || propertyValue === null) return false
    return Math.abs(unitValue - propertyValue) <= 1
}

function uniqueDevelopmentGallery(items: PropertyDevelopmentGalleryItem[]) {
    const seen = new Set<string>()
    return items.filter((item) => {
        const image = asSafeText(item.image)
        if (!image || seen.has(image)) return false
        seen.add(image)
        return true
    })
}

function normalizeDevelopmentGalleryItem(value: unknown, fallbackTitle: string): PropertyDevelopmentGalleryItem | null {
    if (typeof value === 'string') {
        const image = asSafeText(value)
        return image ? { image, title: fallbackTitle, category: 'Empreendimento' } : null
    }

    const record = asSafeRecord(value)
    const image = asSafeText(record.image ?? record.url ?? record.src)
    if (!image) return null

    return {
        image,
        title: asSafeText(record.title, fallbackTitle),
        category: asSafeText(record.category, 'Empreendimento'),
    }
}

function normalizeDevelopmentUnitContext(value: unknown): PropertyDevelopmentUnitContext | null {
    const record = asSafeRecord(value)
    const id = asSafeText(record.id)
    const propertyId = asSafeText(record.propertyId ?? record.property_id)
    const sourceReference = asSafeText(record.sourceReference ?? record.source_reference)
    const sourceSlug = asSafeText(record.sourceSlug ?? record.source_slug ?? record.slug) || propertyId || id || sourceReference
    const type = asSafeText(record.type, 'Unidade')
    const title = asSafeText(record.title, type)
    if (!title || (!sourceSlug && !propertyId && !sourceReference && !id)) return null

    return {
        id,
        propertyId,
        sourceReference,
        title,
        type,
        area: asSafeText(record.area, 'Area sob consulta'),
        suites: asSafeText(record.suites, 'Configuracao sob consulta'),
        price: asSafeText(record.price, 'Consulte'),
        sourceSlug,
    }
}

function propertyDevelopmentKeys(property: any) {
    return new Set(
        [
            property?.source_slug,
            property?.id,
            property?.source_reference,
        ]
            .map(normalizeSourceSlugKey)
            .filter(Boolean)
    )
}

function developmentFallbackForPage(page: any, content: Record<string, any>) {
    const slug = asSafeText(page?.slug)
    const template = asSafeText(content.template)
    if (slug === 'bravaconceto' || template === 'brava-concetto') {
        return PROPERTY_BRAVA_CONCETTO_FALLBACK_DEVELOPMENT
    }
    return null
}

function pickDevelopmentUnit(units: PropertyDevelopmentUnitContext[], property: any) {
    const propertyKeys = propertyDevelopmentKeys(property)
    const candidates = units.filter((unit) => {
        const unitKeys = [
            unit.sourceSlug,
            unit.propertyId,
            unit.sourceReference,
            unit.id,
        ].map(normalizeSourceSlugKey).filter(Boolean)
        return unitKeys.some(key => propertyKeys.has(key))
    })
    if (candidates.length <= 1) return candidates[0] || null

    const propertyTitle = normalizeComparableText(property?.title)
    const byTitle = candidates.find((unit) => {
        const unitTitle = normalizeComparableText(unit.title)
        const unitType = normalizeComparableText(unit.type)
        return Boolean(
            (unitTitle && propertyTitle && (propertyTitle.includes(unitTitle) || unitTitle.includes(propertyTitle))) ||
            (unitType && propertyTitle && propertyTitle.includes(unitType))
        )
    })
    if (byTitle) return byTitle

    const byPrice = candidates.find((unit) => priceMatches(unit.price, property?.price))
    if (byPrice) return byPrice

    const byArea = candidates.find((unit) => areaMatches(unit.area, property))
    return byArea || candidates[0]
}

function locationLabelFromProperty(property: any) {
    return [...buildDisplayLocationParts(property?.neighborhood, property?.city), property?.state]
        .filter(Boolean)
        .join(' - ')
}

const PROPERTY_LOOKUP_TIMEOUT_MS = 10000
const PROPERTY_SECONDARY_QUERY_TIMEOUT_MS = 7000
const PROPERTY_LOOKUP_RETRY_DELAYS_MS = [300, 900, 1600]

function fallbackResponsibleBroker() {
    return {
        broker_id: null,
        admin_user_id: null,
        whatsapp_instance_id: null,
        legacy_name: null,
        legacy_login: null,
        name: GLOBAL_PROPERTY_BROKER_NAME,
        phone: GLOBAL_PROPERTY_WHATSAPP_PHONE,
        photo_url: null,
        email: null,
        creci: null,
        is_connected: false,
        source: 'global' as const,
    }
}

function propertySecondaryTimeout<T>(label: string): Promise<T> {
    return new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`${label} timed out`)), PROPERTY_SECONDARY_QUERY_TIMEOUT_MS)
    })
}

async function withPropertySecondaryFallback<T>(promise: Promise<T>, label: string, fallback: T): Promise<T> {
    try {
        return await Promise.race([promise, propertySecondaryTimeout<T>(label)])
    } catch (error) {
        console.warn(`[Property Detail] ${label} unavailable:`, summarizeSupabaseError(error))
        return fallback
    }
}

function isRetriablePropertyLookupError(error: unknown) {
    const summary = summarizeSupabaseError(error).toLowerCase()
    return (
        summary.includes('fetch failed') ||
        summary.includes('timeout') ||
        summary.includes('aborted') ||
        summary.includes('connection terminated') ||
        summary.includes('522') ||
        summary.includes('503') ||
        summary.includes('504')
    )
}

function waitForPropertyLookupRetry(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runPropertyLookup<T>(
    createLookup: () => Promise<{ data: T | null; error: unknown }>,
    logLabel: string
) {
    for (let attempt = 0; attempt <= PROPERTY_LOOKUP_RETRY_DELAYS_MS.length; attempt += 1) {
        const { data, error } = await createLookup()
        if (!error) return (data || null) as T | null

        const canRetry = attempt < PROPERTY_LOOKUP_RETRY_DELAYS_MS.length && isRetriablePropertyLookupError(error)
        if (!canRetry) {
            console.error(`[Property Detail] ${logLabel} failed:`, summarizeSupabaseError(error))
            throw new Error('Nao foi possivel carregar este imovel agora.')
        }

        await waitForPropertyLookupRetry(PROPERTY_LOOKUP_RETRY_DELAYS_MS[attempt])
    }

    return null
}

async function getPropertyByIdentifier<T = any>(identifier: string, select = '*'): Promise<T | null> {
    const decodedIdentifier = decodeURIComponent(identifier || '').trim()
    const idFromSeoSlug = extractPropertyIdFromSeoSlug(decodedIdentifier)

    if (idFromSeoSlug || isUuid(decodedIdentifier)) {
        const propertyId = idFromSeoSlug || decodedIdentifier
        return runPropertyLookup<T>(
            () => createAdminClient()
                .from('properties')
                .select(select)
                .eq('id', propertyId)
                .abortSignal(createSupabaseAbortSignal(PROPERTY_LOOKUP_TIMEOUT_MS))
                .maybeSingle(),
            'property lookup by id'
        )
    }

    return runPropertyLookup<T>(
        () => createAdminClient()
            .from('properties')
            .select(select)
            .eq('source_slug', decodedIdentifier)
            .limit(1)
            .abortSignal(createSupabaseAbortSignal(PROPERTY_LOOKUP_TIMEOUT_MS))
            .maybeSingle(),
        'property lookup by slug'
    )
}

async function getPropertyDevelopmentContext(supabase: any, property: any): Promise<PropertyDevelopmentContext | null> {
    if (!propertyDevelopmentKeys(property).size) return null

    const { data, error } = await supabase
        .from('landing_pages')
        .select('id, slug, title, content, created_at')
        .eq('status', 'published')
        .order('created_at', { ascending: true })
        .abortSignal(createSupabaseAbortSignal(PROPERTY_SECONDARY_QUERY_TIMEOUT_MS))

    if (error) {
        console.warn('[Property Detail] development context unavailable:', error.message)
        return null
    }

    for (const page of data || []) {
        const content = asSafeRecord(page.content)
        const contentDevelopment = asSafeRecord(content.development)
        const fallbackDevelopment = developmentFallbackForPage(page, content)
        const development = fallbackDevelopment
            ? { ...fallbackDevelopment, ...contentDevelopment }
            : contentDevelopment
        const rawUnits = Array.isArray(contentDevelopment.units) && contentDevelopment.units.length
            ? contentDevelopment.units
            : (fallbackDevelopment?.units || [])
        const units = Array.isArray(rawUnits)
            ? rawUnits.map(normalizeDevelopmentUnitContext).filter((unit): unit is PropertyDevelopmentUnitContext => Boolean(unit))
            : []
        const matchedUnit = pickDevelopmentUnit(units, property)

        if (!matchedUnit) continue

        const name = asSafeText(development.name, asSafeText(content.custom_title, asSafeText(page.title, 'Empreendimento')))
        const heroImage = asSafeText(development.heroImage ?? development.hero_image ?? content.custom_hero_image, property.featured_image || property.images?.[0] || DEFAULT_OG_IMAGE)
        const rawDevelopmentGallery = Array.isArray(contentDevelopment.gallery) && contentDevelopment.gallery.length
            ? contentDevelopment.gallery
            : (fallbackDevelopment?.gallery || [])
        const developmentGallery = Array.isArray(rawDevelopmentGallery)
            ? rawDevelopmentGallery.map((item: unknown) => normalizeDevelopmentGalleryItem(item, name)).filter((item): item is PropertyDevelopmentGalleryItem => Boolean(item))
            : []
        const customGallery = Array.isArray(content.custom_gallery)
            ? content.custom_gallery.map((item: unknown) => normalizeDevelopmentGalleryItem(item, name)).filter((item): item is PropertyDevelopmentGalleryItem => Boolean(item))
            : []
        const gallery = uniqueDevelopmentGallery([
            { image: heroImage, title: name, category: 'Condomínio' },
            ...developmentGallery,
            ...customGallery,
        ]).slice(0, 6)
        const availableUnitsCount = asSafeNumber(development.availableUnitsCount ?? development.available_units_count ?? content.available_units_count)
            ?? (units.length || null)

        return {
            slug: asSafeText(development.pageSlug ?? development.page_slug ?? page.slug),
            name,
            locationName: asSafeText(development.locationName ?? development.location_name, locationLabelFromProperty(property)),
            priceRange: asSafeText(development.priceRange ?? development.price_range, matchedUnit.price),
            availableUnitsCount,
            areaRange: asSafeText(development.areaRange ?? development.area_range, matchedUnit.area),
            suitesRange: asSafeText(development.suitesRange ?? development.suites_range, matchedUnit.suites),
            heroImage,
            description: asSafeText(development.description, `Conheça o condomínio ${name} e compare as unidades disponíveis antes da visita.`),
            gallery,
            unit: matchedUnit,
        }
    }

    return null
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

function joinPortugueseList(items: string[]) {
    const values = items.map(item => String(item || '').trim()).filter(Boolean)
    if (values.length <= 1) return values[0] || ''
    if (values.length === 2) return `${values[0]} e ${values[1]}`
    return `${values.slice(0, -1).join(', ')} e ${values[values.length - 1]}`
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params
    const property = await getPropertyForSeo(id).catch((error) => {
        console.warn('[Property Detail] metadata lookup unavailable:', summarizeSupabaseError(error))
        return null
    })
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

function normalizeContentKey(value: unknown) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
}

function splitDescriptionSentences(value: string) {
    const protectedText = String(value || '').replace(/\b(Av|Dr|Dra|Ed|Ref|R|Sr|Sra)\./g, '$1<DOT>')

    return protectedText
        .replace(/\s+/g, ' ')
        .split(/(?<=[.!?])\s+/)
        .map(sentence => sentence.replace(/<DOT>/g, '.').trim().replace(/^[,;:\s]+/, ''))
        .filter(sentence => sentence.length >= 28)
}

function normalizeSentence(value: string) {
    const clean = cleanRepeatedPraiaBravaText(value)
        .replace(/\s+/g, ' ')
        .trim()

    if (!clean) return ''
    return /[.!?]$/.test(clean) ? clean : `${clean}.`
}

function isMobileDescriptionDuplicate(sentence: string, property: any, displayTitle: string, locationLabel: string) {
    const normalized = normalizeContentKey(sentence)
    if (!normalized) return true

    const titleKey = normalizeContentKey(displayTitle)
    const locationKey = normalizeContentKey(locationLabel)
    const typeKey = normalizeContentKey(property.property_type)
    const statMatches = sentence.match(/\b\d+[\d.,]*(?:\s*mil)?\s*(?:dormitórios?|dormitorios?|quartos?|suítes?|suites?|banheiros?|vagas?|m²|m2|metros?\s+quadrados?)\b/gi) || []
    const hasCatalogPhrase = /\b(a venda|à venda|vende|o imovel reune|o imóvel reúne|area privativa|área privativa|area total|área total|garagem|condominio|condomínio|iptu)\b/i.test(sentence)
    const repeatsLocation = Boolean(locationKey && normalized.includes(locationKey))
    const repeatsTitle = Boolean(titleKey && normalized.includes(titleKey))
    const startsAsCatalogLine = Boolean(typeKey && normalized.startsWith(`${typeKey} a venda`))

    if (startsAsCatalogLine) return true
    if (/(area total|área total|area privativa|área privativa)/i.test(sentence) && /\d/.test(sentence)) return true
    if (statMatches.length >= 2) return true
    if (hasCatalogPhrase && (statMatches.length > 0 || repeatsLocation || repeatsTitle)) return true
    if (repeatsLocation && repeatsTitle) return true

    return false
}

function buildMobileSummaryHighlights(params: {
    property: any
    amenities: string[]
    paragraphs: string[]
    mainBenefitTag: string
}): MobileSummaryHighlight[] {
    const haystack = normalizeContentKey([
        params.property?.title,
        params.property?.seo_title,
        params.property?.description,
        params.property?.seo_description,
        params.property?.property_type,
        params.property?.source_status,
        params.mainBenefitTag,
        ...params.amenities,
        ...params.paragraphs,
    ].filter(Boolean).join(' '))
    const highlights: MobileSummaryHighlight[] = []
    const seen = new Set<string>()
    const hasAny = (...terms: string[]) => terms.some(term => haystack.includes(normalizeContentKey(term)))
    const add = (label: string, icon: ReactNode) => {
        const key = normalizeContentKey(label)
        if (!key || seen.has(key) || highlights.length >= 4) return
        seen.add(key)
        highlights.push({ label, icon })
    }

    if (hasAny('vista permanente')) {
        add('Vista permanente', <Waves size={21} />)
    } else if (hasAny('frente mar', 'frente para o mar', 'vista mar', 'vista para o mar', 'beira mar')) {
        add('Vista mar', <Waves size={21} />)
    }

    if (hasAny('sol da manha', 'face leste', 'nascente')) {
        add('Sol da manhã', <SunMedium size={21} />)
    }

    if (hasAny('pe na areia', 'acesso direto', 'frente mar', 'beira mar', 'praia')) {
        add(hasAny('acesso direto', 'pe na areia') ? 'Acesso direto à praia' : 'Perto da praia', <Umbrella size={21} />)
    }

    if (hasAny('portaria 24', 'seguranca 24', 'segurança 24', 'monitoramento 24')) {
        add('Segurança 24h', <ShieldCheck size={21} />)
    } else if (hasAny('portaria', 'seguranca', 'segurança', 'monitoramento', 'condominio fechado', 'condomínio fechado')) {
        add('Segurança', <ShieldCheck size={21} />)
    }

    if (hasAny('piscina', 'spa', 'academia', 'fitness', 'playground', 'brinquedoteca', 'salao de festas', 'salão de festas')) {
        add('Lazer completo', <Star size={21} />)
    }

    if (hasAny('mobiliado', 'mobiliada', 'decorado', 'decorada')) {
        add('Pronto para morar', <CheckCircle2 size={21} />)
    }

    if (params.mainBenefitTag) {
        add(params.mainBenefitTag, <Star size={21} />)
    }

    if (highlights.length < 4 && hasAny('condominio', 'condomínio')) {
        add('Condomínio premium', <ShieldCheck size={21} />)
    }

    if (highlights.length < 4) {
        add('Curadoria Pilger', <CheckCircle2 size={21} />)
    }

    return highlights.slice(0, 4)
}

function buildPropertyDescriptionParagraphs(
    sourceParagraphs: string[],
    property: any,
    displayTitle: string,
    locationLabel: string,
    fallback: string,
    details: {
        area: number
        suiteCount: number
        bedroomCount: number
        bathroomsCount: number
        parkingCount: number
    }
) {
    const seen = new Set<string>()
    const description: string[] = []
    const title = normalizeSentence(displayTitle).replace(/[.!?]$/, '')
    const type = String(property.property_type || 'imóvel').trim()
    const typeLabel = normalizeContentKey(type) === 'imovel' ? 'imóvel' : `imóvel do tipo ${type}`
    const location = locationLabel || displayLocationName(property.city) || 'litoral catarinense'
    const opening = normalizeSentence(`${title} é um ${typeLabel} em ${location}, selecionado para quem busca alto padrão com leitura clara de localização, produto e potencial de uso`)
    const statItems = [
        details.area > 0 ? `${details.area.toLocaleString('pt-BR')} m² privativos` : null,
        details.suiteCount > 0 ? `${details.suiteCount} ${statLabel(details.suiteCount, 'suíte', 'suítes')}` : null,
        details.bedroomCount > 0 && details.bedroomCount !== details.suiteCount ? `${details.bedroomCount} ${statLabel(details.bedroomCount, 'dormitório', 'dormitórios')}` : null,
        details.bathroomsCount > 0 ? `${details.bathroomsCount} ${statLabel(details.bathroomsCount, 'banheiro', 'banheiros')}` : null,
        details.parkingCount > 0 ? `${details.parkingCount} ${statLabel(details.parkingCount, 'vaga de garagem', 'vagas de garagem')}` : null,
    ].filter(Boolean) as string[]

    const addParagraph = (value: string) => {
        const sentence = normalizeSentence(value)
        const key = normalizeContentKey(sentence)
        if (!sentence || !key || seen.has(key)) return
        seen.add(key)
        description.push(sentence)
    }

    addParagraph(opening)

    if (statItems.length > 0) {
        addParagraph(`A configuração reúne ${joinPortugueseList(statItems)}, ajudando a avaliar conforto, privacidade e funcionalidade antes da visita`)
    }

    if (location) {
        addParagraph(`A localização em ${location} fortalece a análise de conveniência, liquidez e desejo, pontos decisivos para moradia, investimento ou proteção patrimonial`)
    }

    for (const paragraph of sourceParagraphs) {
        for (const sentence of splitDescriptionSentences(paragraph)) {
            const key = normalizeContentKey(sentence)
            if (!key || seen.has(key)) continue
            seen.add(key)
            if (isMobileDescriptionDuplicate(sentence, property, displayTitle, locationLabel)) continue
            description.push(normalizeSentence(sentence))
            if (description.length >= 5) return description
        }
    }

    if (description.length < 3 && fallback) addParagraph(fallback)

    return description.slice(0, 5)
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

function marketScalePosition(minValue: number, maxValue: number, targetValue: number, fallback = 50) {
    if (!minValue || !maxValue || !targetValue || maxValue <= minValue) return fallback
    return Math.max(0, Math.min(100, ((targetValue - minValue) / (maxValue - minValue)) * 100))
}

function marketScalePriceLabel(value: number, fallback: string) {
    return value ? `${formatCompactMoney(Math.round(value))}/m²` : fallback
}

function getGallery(property: any) {
    return Array.from(new Set([property.featured_image, ...(property.images || [])].filter(Boolean) as string[]))
}

type MobilePropertyMediaItem =
    | {
        type: 'photo'
        src: string
        photoIndex: number
    }
    | {
        type: 'video'
        videoUrl: string
    }

function buildMobilePhotoItems(images: string[]): MobilePropertyMediaItem[] {
    return images.map((src, photoIndex) => ({
        type: 'photo',
        src,
        photoIndex,
    }))
}

function buildMobileVideoItem(videoUrl?: string | null): MobilePropertyMediaItem | null {
    return hasPropertyVideo(videoUrl)
        ? { type: 'video', videoUrl: String(videoUrl).trim() }
        : null
}

function chunkList<T>(items: T[], columns = 2) {
    const size = Math.ceil(items.length / columns)
    return Array.from({ length: columns }, (_, index) => items.slice(index * size, (index + 1) * size)).filter(group => group.length)
}

function statLabel(value: number, singular: string, plural: string) {
    return value === 1 ? singular : plural
}

function uniqueFeatureItems(items: Array<string | null | undefined>) {
    const seen = new Set<string>()
    const values: string[] = []

    for (const item of items) {
        const label = String(item || '').replace(/\s+/g, ' ').trim()
        const key = normalizeContentKey(label)
        if (!label || !key || seen.has(key)) continue
        seen.add(key)
        values.push(label)
    }

    return values
}

function isDevelopmentAmenity(value: string) {
    const item = normalizeContentKey(value)
    if (!item) return false

    if (/(privativ|exclusiv|sacada|varanda|suite|dormitorio|dormitorios|quarto|quartos|lavabo|closet|living|cozinha|sala de estar|sala de jantar|estar intimo|dependencia|area de servico|lavanderia|terraco|garden|vista|frente mar|frente para o mar|mobili|decorad|churrasqueira na unidade)/.test(item)) {
        return false
    }

    return /(academia|fitness|piscina|sauna|salao de festas|sala de festas|sala de jogos|brinquedoteca|playground|quadra|cancha|spa|portaria|portao eletronico|seguranca|monitoramento|elevador|hall|lounge|coworking|rooftop|quiosque|espaco gourmet|cinema|pet place|beach tennis|bicicletario|guarita|recepcao|praca|pub|wine bar)/.test(item)
}

function isPropertyAmenity(value: string) {
    const item = normalizeContentKey(value)
    if (!item || isDevelopmentAmenity(value)) return false

    return /(frente mar|frente para o mar|vista|mobili|decorad|sacada|varanda|churrasqueira|lavabo|closet|living|sala(?!o de festas| de jogos)|cozinha|area de servico|lavanderia|dependencia|estar intimo|terraco|garden|duplex|triplex|suite standard|suite master|master|hidro|banheira|piscina privativa|spa privativo|jacuzzi privativa|automacao|climatizacao|ar condicionado|pe direito|andar alto|sol da manha|face norte|face leste)/.test(item)
}

function splitAmenityFeatureItems(amenities: string[]) {
    const propertyItems: string[] = []
    const developmentItems: string[] = []

    amenities.forEach((amenity) => {
        const label = String(amenity || '').trim()
        if (!label) return

        if (isPropertyAmenity(label)) {
            propertyItems.push(label)
            return
        }

        if (isDevelopmentAmenity(label)) {
            developmentItems.push(label)
        }
    })

    return {
        propertyItems: uniqueFeatureItems(propertyItems),
        developmentItems: uniqueFeatureItems(developmentItems),
    }
}

function buildPropertyFeatureItems(params: {
    property: any
    area: number
    suiteCount: number
    bedroomCount: number
    bathroomsCount: number
    parkingCount: number
    propertyAmenityItems: string[]
}) {
    const { property, area, suiteCount, bedroomCount, bathroomsCount, parkingCount, propertyAmenityItems } = params
    const haystack = normalizeContentKey([
        property?.title,
        property?.seo_title,
        property?.description,
        property?.seo_description,
        property?.property_type,
        property?.source_status,
        ...propertyAmenityItems,
    ].filter(Boolean).join(' '))
    const hasAny = (...terms: string[]) => terms.some(term => haystack.includes(normalizeContentKey(term)))
    const baseItems: Array<string | null> = [
        property.property_type ? String(property.property_type).trim() : null,
        area > 0 ? `${area.toLocaleString('pt-BR')} m² privativos` : null,
        suiteCount > 0 ? `${suiteCount} ${statLabel(suiteCount, 'suíte', 'suítes')}` : null,
        bedroomCount > 0 && bedroomCount !== suiteCount ? `${bedroomCount} ${statLabel(bedroomCount, 'dormitório', 'dormitórios')}` : null,
        bathroomsCount > 0 ? `${bathroomsCount} ${statLabel(bathroomsCount, 'banheiro', 'banheiros')}` : null,
        parkingCount > 0 ? `${parkingCount} ${statLabel(parkingCount, 'vaga de garagem', 'vagas de garagem')}` : null,
        hasAny('frente para o mar', 'frente mar', 'beira mar') ? 'Frente para o mar' : null,
        hasAny('vista mar', 'vista para o mar') ? 'Vista para o mar' : null,
        hasAny('semi mobilia', 'semi mobiliado', 'semi mobiliada') ? 'Semi mobiliado' : null,
        !hasAny('semi mobilia', 'semi mobiliado', 'semi mobiliada') && hasAny('mobiliado', 'mobiliada') ? 'Mobiliado' : null,
        hasAny('decorado', 'decorada') ? 'Decorado' : null,
        hasAny('sacada com churrasqueira', 'varanda gourmet') ? 'Sacada com churrasqueira' : null,
        hasAny('lavabo') ? 'Lavabo' : null,
        hasAny('area de servico', 'área de serviço') ? 'Área de serviço' : null,
        hasAny('terraço', 'terraco') ? 'Terraço privativo' : null,
        hasAny('garden') ? 'Garden' : null,
        hasAny('andar alto') ? 'Andar alto' : null,
        hasAny('sol da manha', 'face leste') ? 'Sol da manhã' : null,
    ]

    return uniqueFeatureItems([...baseItems, ...propertyAmenityItems]).slice(0, 24)
}

function referenceLabel(property: any) {
    return String(property.source_reference || property.source_slug || property.id || '').slice(0, 8).toUpperCase()
}

function listingAgeParts(days: number) {
    if (days <= 0) {
        return { value: 'Hoje', label: 'No site' }
    }

    return {
        value: days.toLocaleString('pt-BR'),
        label: days === 1 ? 'Dia no site' : 'Dias no site',
    }
}

function statTextParts(value: number, singular: string, plural: string) {
    return {
        value: value.toLocaleString('pt-BR'),
        label: value === 1 ? singular : plural,
    }
}

function daysBetweenNow(dateValue?: string | null) {
    if (!dateValue) return 0
    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) return 0
    return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000))
}

function propertyPublishedAt(property: any) {
    return property.source_created_at
        || property.imported_at
        || property.created_at
        || property.source_updated_at
        || property.updated_at
        || null
}

function countCurrentPropertySaves(events?: any[] | null) {
    const latestByVisitor = new Map<string, any>()

    for (const event of events || []) {
        const visitorKey = String(event.visitor_id || event.id || '').trim()
        if (!visitorKey || latestByVisitor.has(visitorKey)) continue
        latestByVisitor.set(visitorKey, event)
    }

    return Array.from(latestByVisitor.values())
        .filter(event => event.event_type === 'property_favorited')
        .length
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
        title: cleanRepeatedPraiaBravaText(titleOverride || property.seo_title || property.title || 'Imóvel'),
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

function formatPercent(value: number | null) {
    return formatMarketPercent(value)
}

function buildMarketHistory(property: any, candidates: RelatedPropertyCandidate[], area: number, locationLabel: string, priceHistoryEvents: PropertyPriceHistoryRow[] = []) {
    return buildMarketRadarAnalysis({
        property: {
            ...property,
            area_private_m2: property.area_private_m2 || area,
        },
        candidates: candidates as MarketComparable[],
        locationLabel,
        priceHistoryEvents,
    })
}
async function getRelatedPropertyCandidates(supabase: any, property: any) {
    return fetchInternalMarketComparables(supabase, property) as Promise<RelatedPropertyCandidate[]>
}

type PropertyDetailPageProps = {
    params: Promise<{ id: string }>
    canonicalize?: boolean
}

export default async function PropertyDetailPage({
    params,
    canonicalize = true,
}: PropertyDetailPageProps) {
    const supabase = createAdminClient()
    const { id } = await params

    const property = await getPropertyByIdentifier(id)

    if (!property) return notFound()

    const canonicalSegment = propertyDetailsSegment(property)
    const currentSegment = decodeURIComponent(id || '').trim()
    if (canonicalize && canonicalSegment && currentSegment !== canonicalSegment) {
        redirect(propertyDetailsPath(property))
    }

    const adminSupabase = createAdminClient()
    const responsibleBroker = await withPropertySecondaryFallback(
        getResponsibleBrokerForProperty(adminSupabase, property.id),
        'responsible broker',
        fallbackResponsibleBroker()
    )
    const { count: propertyViewCountRaw, error: propertyViewCountError } = await adminSupabase
        .from('funnel_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', 'property_details_landing_viewed')
        .contains('metadata', { property_id: property.id })
        .abortSignal(createSupabaseAbortSignal(PROPERTY_SECONDARY_QUERY_TIMEOUT_MS))

    const { data: propertySaveEvents, error: propertySaveEventsError } = await adminSupabase
        .from('funnel_events')
        .select('id, visitor_id, event_type, created_at')
        .in('event_type', ['property_favorited', 'property_unfavorited'])
        .contains('metadata', { property_id: property.id })
        .order('created_at', { ascending: false })
        .limit(5000)
        .abortSignal(createSupabaseAbortSignal(PROPERTY_SECONDARY_QUERY_TIMEOUT_MS))

    const { data: propertyMapModalRows, error: propertyMapModalError } = await supabase
        .from('properties')
        .select(PROPERTY_MAP_MODAL_SELECT)
        .eq('status', 'active')
        .gte('price', PROPERTY_MAP_MODAL_MIN_PRICE)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(260)
        .abortSignal(createSupabaseAbortSignal(PROPERTY_SECONDARY_QUERY_TIMEOUT_MS))

    if (propertyViewCountError) {
        console.warn('[Property Detail] view count unavailable:', propertyViewCountError.message)
    }

    if (propertySaveEventsError) {
        console.warn('[Property Detail] save count unavailable:', propertySaveEventsError.message)
    }

    if (propertyMapModalError) {
        console.warn('[Property Detail] map modal portfolio unavailable:', propertyMapModalError.message)
    }

    const propertyViewCount = propertyViewCountRaw || 0
    const propertySaveCount = countCurrentPropertySaves(propertySaveEvents)
    const listingAge = listingAgeParts(daysBetweenNow(propertyPublishedAt(property)))
    const viewStat = statTextParts(propertyViewCount, 'view', 'views')
    const saveStat = statTextParts(propertySaveCount, 'salvo', 'salvos')
    const contactPhone = responsibleBroker.phone || GLOBAL_PROPERTY_WHATSAPP_PHONE
    const isGlobalBrokerCard = responsibleBroker.source === 'global'
    const brokerCardName = responsibleBroker.name || GLOBAL_PROPERTY_BROKER_NAME
    const brokerCardImage = responsibleBroker.photo_url || null
    const brokerCardPhotoLookupSlug = isGlobalBrokerCard ? 'home' : null
    const brokerCreci = formatBrokerCreci(responsibleBroker.creci)
    const brokerCredentialLine = isGlobalBrokerCard
        ? 'Atendimento oficial Pilger'
        : brokerCreci
        ? `Corretor de imóveis | ${brokerCreci}`
        : 'Corretor de imóveis'
    const gallery = getGallery(property)
    const amenities: string[] = property.amenities || []
    const primaryQualityLabel = getPropertyPrimaryQualityLabel(property)
    const mainBenefitTag = primaryQualityLabel.label
    const displayTitle = cleanRepeatedPraiaBravaText(property.title)
    const displayCity = displayLocationName(property.city)
    const displayNeighborhood = replaceItajaiWithPraiaBrava(property.neighborhood)
    const mapLocation = [property.neighborhood, property.city, property.state].filter(Boolean).join(', ')
    const locationParts = buildDisplayLocationParts(property.neighborhood, property.city)
    const locationPrimary = locationParts[0] || 'Litoral catarinense'
    const locationSecondary = locationParts.length > 1
        ? [...locationParts.slice(1), property.state].filter(Boolean).join(' - ')
        : property.state || ''
    const brokerPropertiesParams = new URLSearchParams()
    const brokerFilterName = isGlobalBrokerCard ? '' : (responsibleBroker.legacy_name || brokerCardName)
    if (brokerFilterName) brokerPropertiesParams.set('broker', brokerFilterName)
    if (!isGlobalBrokerCard && responsibleBroker.legacy_login) brokerPropertiesParams.set('brokerLogin', responsibleBroker.legacy_login)
    const brokerPropertiesQuery = brokerPropertiesParams.toString()
    const brokerPropertiesHref = brokerPropertiesQuery ? `/busca?${brokerPropertiesQuery}` : '/busca'
    const brokerPropertiesLabel = isGlobalBrokerCard ? 'Ver imóveis selecionados' : 'Ver imóveis do especialista'
    const relatedSearchParams = new URLSearchParams()
    if (displayCity) relatedSearchParams.set('city', displayCity)
    if (displayNeighborhood) relatedSearchParams.set('neighborhood', displayNeighborhood)
    const relatedSearchQuery = relatedSearchParams.toString()
    const relatedSearchHref = relatedSearchQuery ? `/busca?${relatedSearchQuery}` : '/busca'
    const brokerInsight = buildBrokerInsight(property)
    const primaryImage = gallery[0] || DEFAULT_OG_IMAGE
    const area = Number(property.area_private_m2 || property.area_m2 || 0)
    const suiteCount = Number(property.suites || property.bedrooms || 0)
    const parkingCount = Number(property.parking_spaces || 0)
    const bathroomsCount = Number(property.bathrooms || 0)
    const bedroomCount = Number(property.bedrooms || 0)
    const locationLabel = [...locationParts, property.state].filter(Boolean).join(' - ')
    const sourceDescriptionParagraphs = property.description ? formatDescription(property.description) : []
    const narrativeParagraphs = buildPropertyDescriptionParagraphs(
        sourceDescriptionParagraphs,
        property,
        displayTitle,
        locationLabel,
        brokerInsight.text,
        {
            area,
            suiteCount,
            bedroomCount,
            bathroomsCount,
            parkingCount,
        }
    )
    const mobileSummaryDescription = narrativeParagraphs[0] || brokerInsight.text
    const mobileDescriptionParagraphs = mobileSummaryDescription
        ? (narrativeParagraphs.length > 0 ? narrativeParagraphs : [mobileSummaryDescription])
        : []
    const mobileSummaryHighlights = buildMobileSummaryHighlights({
        property,
        amenities,
        paragraphs: narrativeParagraphs,
        mainBenefitTag,
    })
    const amenityFeatureGroups = splitAmenityFeatureItems(amenities)
    const featureItems = buildPropertyFeatureItems({
        property,
        area,
        suiteCount: Number(property.suites || 0),
        bedroomCount,
        bathroomsCount,
        parkingCount,
        propertyAmenityItems: amenityFeatureGroups.propertyItems,
    })
    const projectItems = amenityFeatureGroups.developmentItems.slice(0, 36)
    const hasTechnicalLists = featureItems.length > 0
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

    const [relatedCandidates, priceHistoryEvents, developmentContext] = await Promise.all([
        getRelatedPropertyCandidates(supabase, property),
        fetchPropertyPriceHistory(adminSupabase, property.id),
        getPropertyDevelopmentContext(adminSupabase, property),
    ])
    const showTechnicalLocationSection = Boolean(propertyMapLatLng)
    const marketHistory = buildMarketHistory(property, relatedCandidates, area, locationLabel, priceHistoryEvents)
    const related = selectRelatedProperties(property, relatedCandidates)
    const marketMedianPosition = marketScalePosition(marketHistory.minM2, marketHistory.maxM2, marketHistory.medianM2)
    const marketScaleStyle = {
        '--market-position': `${marketHistory.position}%`,
        '--market-median-position': `${marketMedianPosition}%`,
    } as CSSProperties
    const marketScaleMinLabel = marketScalePriceLabel(marketHistory.minM2, 'Entrada')
    const marketScaleMedianLabel = marketScalePriceLabel(marketHistory.medianM2, 'Mediana')
    const marketScaleMaxLabel = marketScalePriceLabel(marketHistory.maxM2, 'Topo')
    const marketScaleCurrentLabel = marketScalePriceLabel(marketHistory.currentPriceM2, 'Sob consulta')
    const marketScaleDeltaLabel = marketHistory.deltaToMedian === null ? 'Sem amostra suficiente' : `${formatPercent(marketHistory.deltaToMedian)} vs. mediana`
    const marketScaleSummary = marketHistory.deltaToMedian === null
        ? 'Amostra em formação'
        : marketHistory.positioning.label
    const renderMarketScale = (className: string) => (
        <div
            className={className}
            style={marketScaleStyle}
            aria-label={`Radar de valor por metro quadrado: este imóvel em ${marketScaleCurrentLabel}, mediana em ${marketScaleMedianLabel}, ${marketScaleDeltaLabel}.`}
        >
            <div className="plp-market-scale-head">
                <span>Preço por m² na amostra</span>
                <strong>{marketScaleDeltaLabel}</strong>
            </div>
            <div className="plp-market-scale">
                <div className="plp-market-scale-track" aria-hidden="true">
                    <span className="plp-market-scale-zone plp-market-scale-zone-entry">Entrada</span>
                    <span className="plp-market-scale-zone plp-market-scale-zone-mid">Mediana</span>
                    <span className="plp-market-scale-zone plp-market-scale-zone-top">Topo</span>
                </div>
                <span className="plp-market-scale-marker plp-market-scale-marker-current">
                    <span>Este imóvel</span>
                    <strong>{marketScaleCurrentLabel}</strong>
                </span>
                <span className="plp-market-scale-marker plp-market-scale-marker-median">
                    <span>Mediana</span>
                    <strong>{marketScaleMedianLabel}</strong>
                </span>
            </div>
            <div className="plp-market-axis">
                <span>
                    <b>Entrada</b>
                    <small>{marketScaleMinLabel}</small>
                </span>
                <span>
                    <b>{marketScaleSummary}</b>
                    <small>{marketHistory.comparableCount ? `${marketHistory.comparableCount} comparáveis` : 'Base em formação'}</small>
                </span>
                <span>
                    <b>Topo</b>
                    <small>{marketScaleMaxLabel}</small>
                </span>
            </div>
        </div>
    )
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
    const mobilePhotoItems = buildMobilePhotoItems(mobileMediaImages)
    const mobileVideoItem = buildMobileVideoItem(property.video_url)
    const mobileMediaBeforeMap = mobilePhotoItems.slice(0, 2)
    const mobileMediaAfterMap = [
        ...(mobileVideoItem ? [mobileVideoItem] : []),
        ...mobilePhotoItems.slice(2),
    ]
    const developmentHref = developmentContext?.slug ? `/${developmentContext.slug}` : ''
    const developmentGalleryPreview = developmentContext?.gallery?.length
        ? developmentContext.gallery
        : developmentContext
            ? [{ image: developmentContext.heroImage, title: developmentContext.name, category: 'Condomínio' }]
            : []

    const renderMobileMediaItem = (item: MobilePropertyMediaItem, index: number, keyPrefix: string) => {
        if (item.type === 'video') {
            return (
                <figure className="plp-mobile-media-item plp-mobile-media-item--video" key={`${keyPrefix}-video-${index}`}>
                    <span className="plp-mobile-video-badge">Vídeo do imóvel</span>
                    <PropertyVideoEmbed
                        videoUrl={item.videoUrl}
                        title={displayTitle}
                        poster={primaryImage}
                    />
                </figure>
            )
        }

        return (
            <figure className="plp-mobile-media-item" key={`${keyPrefix}-photo-${item.src}-${item.photoIndex}`}>
                <img src={item.src} alt={`${displayTitle} - foto ${item.photoIndex + 1}`} loading={item.photoIndex === 0 ? 'eager' : 'lazy'} />
                {item.photoIndex === 0 && (
                    <figcaption className="plp-mobile-status-pill">
                        <span />
                        {property.property_type || 'Imóvel à venda'}
                    </figcaption>
                )}
            </figure>
        )
    }

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
                            <span className={`plp-kicker plp-property-quality-kicker plp-property-quality-kicker-${primaryQualityLabel.tone}`}>
                                {mainBenefitTag}
                            </span>
                            <h1>{displayTitle}</h1>
                            <div className="plp-rating-row" aria-label="Avaliação editorial">
                                <span><Star size={15} fill="currentColor" /><Star size={15} fill="currentColor" /><Star size={15} fill="currentColor" /><Star size={15} fill="currentColor" /><Star size={15} fill="currentColor" /></span>
                                <strong>4,8</strong>
                            </div>
                        </div>
                        <div className="plp-listing-stats" aria-label="Indicadores de interesse do imóvel">
                            <span>
                                <Clock3 size={15} />
                                <strong>{listingAge.value}</strong>
                                <small>{listingAge.label}</small>
                            </span>
                            <span>
                                <Eye size={15} />
                                <strong>{viewStat.value}</strong>
                                <small>{viewStat.label}</small>
                            </span>
                            <span>
                                <Heart size={15} />
                                <strong>{saveStat.value}</strong>
                                <small>{saveStat.label}</small>
                            </span>
                        </div>
                    </div>
                </section>

                <section className="plp-mobile-sheet-experience">
                    <PropertyMobileDetailSheet
                        media={(
                            <div className="plp-mobile-media-feed" aria-label="Fotos e localização do imóvel">
                                <div className="plp-mobile-media-controls">
                                    <Link href="/busca" className="plp-mobile-back-pill" aria-label="Voltar para busca">
                                        <ArrowLeft size={23} />
                                    </Link>
                                    <div className="plp-mobile-action-group" aria-label="Menu do imóvel">
                                        <PropertyLandingMobileMenu title={displayTitle} metadata={propertyTrackingMetadata} />
                                    </div>
                                </div>

                                {mobileMediaBeforeMap.map((item, index) => renderMobileMediaItem(item, index, 'sheet'))}

                                {propertyMapLatLng && (
                                    <PropertyMobileMapPreview property={propertyMapPreview} latLng={propertyMapLatLng} />
                                )}

                                {mobileMediaAfterMap.map((item, index) => renderMobileMediaItem(item, index, 'sheet-extra'))}

                            </div>
                        )}
                    >
                        <section className="plp-mobile-sheet-summary plp-mobile-card plp-mobile-card--summary">
                            <div className="plp-mobile-summary-head">
                                <div className="plp-mobile-summary-copy">
                                    <h2 className="plp-mobile-sheet-title">{displayTitle}</h2>
                                    <span className="plp-mobile-summary-location">
                                        <MapPin size={15} />
                                        {locationLabel || displayTitle}
                                    </span>
                                </div>
                                <div className="plp-mobile-summary-price-block">
                                    <small>Valor</small>
                                    <span className="plp-mobile-sheet-price">{formatMoney(property.price)}</span>
                                </div>
                            </div>
                            <div className="plp-mobile-sheet-facts">
                                {bedroomCount > 0 && (
                                    <span className="plp-mobile-sheet-fact plp-mobile-sheet-fact--beds">
                                        <BedDouble size={21} />
                                        <span className="plp-mobile-sheet-fact-text">
                                            <strong>{bedroomCount}</strong>
                                            <small>{statLabel(bedroomCount, 'dormitório', 'dormitórios')}</small>
                                        </span>
                                    </span>
                                )}
                                {bathroomsCount > 0 && (
                                    <span className="plp-mobile-sheet-fact plp-mobile-sheet-fact--baths">
                                        <Bath size={21} />
                                        <span className="plp-mobile-sheet-fact-text">
                                            <strong>{bathroomsCount}</strong>
                                            <small>{statLabel(bathroomsCount, 'banheiro', 'banheiros')}</small>
                                        </span>
                                    </span>
                                )}
                                {area > 0 && (
                                    <span className="plp-mobile-sheet-fact plp-mobile-sheet-fact--area">
                                        <Ruler size={21} />
                                        <span className="plp-mobile-sheet-fact-text">{area.toLocaleString('pt-BR')} m²</span>
                                    </span>
                                )}
                                {parkingCount > 0 && (
                                    <span className="plp-mobile-sheet-fact plp-mobile-sheet-fact--parking">
                                        <Car size={21} />
                                        <span className="plp-mobile-sheet-fact-text">
                                            <strong>{parkingCount}</strong>
                                            <small>{statLabel(parkingCount, 'vaga', 'vagas')}</small>
                                        </span>
                                    </span>
                                )}
                            </div>
                            <div className="plp-mobile-listing-stats" aria-label="Indicadores de interesse do imóvel">
                                <span>
                                    <Clock3 size={15} />
                                    <strong>{listingAge.value}</strong>
                                    <small>{listingAge.label}</small>
                                </span>
                                <span>
                                    <Eye size={15} />
                                    <strong>{viewStat.value}</strong>
                                    <small>{viewStat.label}</small>
                                </span>
                                <span>
                                    <Heart size={15} />
                                    <strong>{saveStat.value}</strong>
                                    <small>{saveStat.label}</small>
                                </span>
                            </div>
                            {mobileSummaryHighlights.length > 0 && (
                                <div className="plp-mobile-summary-highlights" aria-label="Diferenciais do imóvel">
                                    {mobileSummaryHighlights.map(item => (
                                        <span key={item.label}>
                                            {item.icon}
                                            <strong>{item.label}</strong>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </section>

                        {mobileDescriptionParagraphs.length > 0 && (
                            <section className="plp-mobile-card plp-mobile-card--description" aria-labelledby="mobile-descricao-title">
                                <div className="plp-mobile-card-head plp-mobile-card-head--single-title">
                                    <h2 id="mobile-descricao-title">Descrição</h2>
                                </div>
                                <div className="plp-mobile-description-body">
                                    {mobileDescriptionParagraphs.map((paragraph, index) => (
                                        <p key={`mobile-description-card-${index}`}>{paragraph}</p>
                                    ))}
                                </div>
                            </section>
                        )}

                        <section className="plp-mobile-card plp-mobile-card--quick-facts" aria-labelledby="mobile-ficha-rapida-title">
                            <div className="plp-mobile-card-head plp-mobile-card-head--single-title">
                                <h2 id="mobile-ficha-rapida-title">Ficha rápida</h2>
                            </div>
                            <div className="plp-spec-grid">
                                {area > 0 && <SpecCard icon={<Ruler size={21} />} label="Área" value={`${area.toLocaleString('pt-BR')} m²`} />}
                                {suiteCount > 0 && <SpecCard icon={<BedDouble size={21} />} label="Configuração" value={`${suiteCount} ${statLabel(suiteCount, 'suíte', 'suítes')}`} />}
                                {bathroomsCount > 0 && <SpecCard icon={<Bath size={21} />} label="Banheiros" value={String(bathroomsCount)} />}
                                {parkingCount > 0 && <SpecCard icon={<Car size={21} />} label="Garagem" value={`${parkingCount} ${statLabel(parkingCount, 'vaga', 'vagas')}`} />}
                                <SpecCard icon={<MapPin size={21} />} label="Localização" value={locationLabel || displayCity || 'Litoral SC'} />
                            </div>
                        </section>

                        {hasTechnicalLists && (
                            <section id="mobile-ficha" className="plp-mobile-card plp-mobile-card--technical">
                                <div className="plp-mobile-card-head plp-mobile-card-head--single-title">
                                    <h2>Ficha técnica</h2>
                                </div>
                                <div className="plp-mobile-classic-lists">
                                    {featureItems.length > 0 && <InfoList title="Características do imóvel" items={featureItems} />}
                                </div>
                            </section>
                        )}

                        <section className="plp-mobile-card plp-mobile-card--nearby">
                            <PropertyNearbyBenefits
                                propertyId={property.id}
                                title={displayTitle}
                                latLng={propertyMapLatLng}
                                locationLabel={locationLabel || mapLocation || displayCity}
                                variant="mobile"
                            />
                        </section>

                        {developmentContext && (
                            <section className="plp-mobile-card plp-mobile-development-section" aria-labelledby="mobile-empreendimento-title">
                                <div className="plp-mobile-card-head">
                                    <span className="plp-kicker">Condomínio</span>
                                    <h2 id="mobile-empreendimento-title">Conheça o condomínio {developmentContext.name}.</h2>
                                </div>
                                <div className="plp-mobile-development-gallery">
                                    {developmentGalleryPreview.slice(0, 4).map((item, index) => (
                                        <figure key={`${item.image}-${index}`}>
                                            <img src={item.image} alt={`${developmentContext.name} - ${item.title}`} loading={index === 0 ? 'eager' : 'lazy'} />
                                            <figcaption>{index === 0 ? 'Condomínio' : item.category}</figcaption>
                                        </figure>
                                    ))}
                                </div>
                                <p className="plp-mobile-development-copy">
                                    Veja imagens, contexto do condomínio e unidades disponíveis antes de conversar com o especialista.
                                </p>
                                <div className="plp-mobile-development-facts">
                                    <span><MapPin size={14} /> {developmentContext.locationName}</span>
                                    <span><Home size={14} /> {developmentContext.availableUnitsCount ? `${developmentContext.availableUnitsCount} unidades` : 'Unidades sob consulta'}</span>
                                    <span><BarChart3 size={14} /> {developmentContext.priceRange}</span>
                                    <span><Ruler size={14} /> {developmentContext.areaRange}</span>
                                </div>
                                {projectItems.length > 0 && (
                                    <div className="plp-mobile-development-features">
                                        <InfoList title="Características do condomínio" items={projectItems} />
                                    </div>
                                )}
                                <div className="plp-mobile-development-actions">
                                    <Link href={developmentHref || '/busca'}>
                                        Conhecer condomínio
                                        <ArrowRight size={15} />
                                    </Link>
                                </div>
                            </section>
                        )}

                        <section className="plp-mobile-card plp-mobile-market-section">
                            <div className="plp-mobile-card-head">
                                <span className="plp-kicker">Mercado</span>
                                <h2>Valor e histórico.</h2>
                            </div>
                            <div className="plp-mobile-market-grid">
                                <div>
                                    <small>Preço atual</small>
                                    <strong>{formatMoney(property.price)}</strong>
                                </div>
                                <div>
                                    <small>Valor por m²</small>
                                    <strong>{marketHistory.currentPriceM2 ? `${formatCompactMoney(Math.round(marketHistory.currentPriceM2))}/m²` : 'Sob consulta'}</strong>
                                </div>
                                <div>
                                    <small>Comparáveis ativos</small>
                                    <strong>{marketHistory.comparableCount ? String(marketHistory.comparableCount) : 'Em curadoria'}</strong>
                                </div>
                                <div>
                                    <small>Leitura vs. mediana</small>
                                    <strong>{marketHistory.deltaToMedian === null ? 'Sem amostra' : formatPercent(marketHistory.deltaToMedian)}</strong>
                                </div>
                            </div>
                            {renderMarketScale('plp-mobile-market-chart')}
                            <div className="plp-mobile-market-positioning">
                                <strong>{marketHistory.positioning.label}</strong>
                                <span>{marketHistory.positioning.description}</span>
                                {marketHistory.percentile !== null && (
                                    <small>Percentil {Math.round(marketHistory.percentile)} da amostra qualificada.</small>
                                )}
                            </div>
                            <p className="plp-mobile-market-reading">
                                <TrendingUp size={15} />
                                <span>{marketHistory.reading}</span>
                            </p>
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

                        {related.length > 0 && (
                            <section className="plp-mobile-card plp-mobile-related-section">
                                <div className="plp-mobile-card-head plp-mobile-card-head--split">
                                    <div>
                                        <span className="plp-kicker">Comparação</span>
                                        <h2>Imóveis semelhantes.</h2>
                                    </div>
                                    <Link href={relatedSearchHref}>
                                        Ver mais
                                        <ArrowRight size={15} />
                                    </Link>
                                </div>
                                <div className="plp-mobile-related-rail">
                                    {related.map((item: any) => {
                                        const image = item.featured_image || item.images?.[0] || DEFAULT_OG_IMAGE
                                        const itemArea = Number(item.area_private_m2 || item.area_m2 || 0)
                                        const itemSuites = Number(item.suites || item.bedrooms || 0)
                                        const relatedLocation = buildDisplayLocationParts(item.neighborhood, item.city).join(' - ')
                                        const relatedTitle = cleanRepeatedPraiaBravaText(item.title)
                                        const itemQualityLabel = getPropertyPrimaryQualityLabel(item)
                                        return (
                                            <Link key={item.id} href={propertyDetailsPath(item)} className="plp-mobile-related-card">
                                                <img src={image} alt={relatedTitle} loading="lazy" />
                                                <span className={`plp-mobile-related-badge plp-mobile-related-badge-${itemQualityLabel.tone}`}>
                                                    {itemQualityLabel.label}
                                                </span>
                                                <div>
                                                    <strong>{formatMoney(item.price)}</strong>
                                                    <small>{itemArea ? `${itemArea.toLocaleString('pt-BR')} m²` : 'Área sob consulta'} | {itemSuites ? `${itemSuites} suítes` : item.property_type || 'Imóvel'}</small>
                                                    <p>{relatedLocation || relatedTitle}</p>
                                                </div>
                                            </Link>
                                        )
                                    })}
                                </div>
                            </section>
                        )}

                        <section className="plp-mobile-card plp-mobile-broker-card">
                            <div className="plp-mobile-broker-head">
                                <PropertyBrokerAvatar
                                    image={brokerCardImage}
                                    name={brokerCardName}
                                    lookupSlug={brokerCardPhotoLookupSlug}
                                />
                                <div>
                                    <span className="plp-kicker">Especialista</span>
                                    <h2>{brokerCardName}</h2>
                                    <p>{brokerCredentialLine}</p>
                                </div>
                            </div>
                            <WhatsAppCaptureLink
                                phone={contactPhone}
                                message={`Olá, quero falar com o especialista sobre este imóvel ${propertyUrl}`}
                                slug="imovel"
                                template="property-mobile-broker-card"
                                metadata={{
                                    ...propertyTrackingMetadata,
                                    tracking_event_type: 'property_specialist_contact_requested',
                                    premium_intent: 'specialist_contact',
                                    requested_action: 'Falar com especialista pelo card mobile',
                                    cta_context: 'mobile_broker_card',
                                    cta_label: 'Falar com especialista',
                                }}
                                className="plp-mobile-broker-cta"
                            >
                                <MessageCircle size={16} />
                                Falar com especialista
                            </WhatsAppCaptureLink>
                            <Link href={brokerPropertiesHref} className="plp-mobile-broker-properties-link">
                                <Home size={15} />
                                {brokerPropertiesLabel}
                            </Link>
                        </section>

                        <section className="plp-mobile-card plp-mobile-transparency-card">
                            <div className="plp-mobile-card-head">
                                <span className="plp-kicker">Transparência</span>
                                <h2>Dados sujeitos a confirmação.</h2>
                            </div>
                            <p>Preço, disponibilidade, metragem, custos recorrentes e condições comerciais devem ser confirmados pelo especialista antes de qualquer decisão.</p>
                        </section>
                    </PropertyMobileDetailSheet>
                </section>

                <section id="visao" className="plp-detail-layout">
                    <div className="plp-gallery-column">
                        <div className="plp-desktop-photo-showcase">
                            <PropertyDesktopMediaShowcase
                                images={gallery.length ? gallery : [primaryImage]}
                                videoUrl={property.video_url}
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
                        <div className="plp-mobile-media-feed" aria-label="Fotos e localização do imóvel">
                            <div className="plp-mobile-media-controls">
                                <Link href="/busca" className="plp-mobile-back-pill" aria-label="Voltar para busca">
                                    <ArrowLeft size={23} />
                                </Link>
                                <div className="plp-mobile-action-group" aria-label="Menu do imóvel">
                                    <PropertyLandingMobileMenu title={displayTitle} metadata={propertyTrackingMetadata} />
                                </div>
                            </div>

                            {mobileMediaBeforeMap.map((item, index) => renderMobileMediaItem(item, index, 'mobile'))}

                            {propertyMapLatLng && (
                                <PropertyMobileMapPreview property={propertyMapPreview} latLng={propertyMapLatLng} />
                            )}

                            {mobileMediaAfterMap.map((item, index) => renderMobileMediaItem(item, index, 'mobile-extra'))}

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
                        <div className="plp-overview-facts-grid">
                            <section id="experiencia" className="plp-section plp-copy-section plp-summary-card">
                                <span className="plp-kicker">Visão geral</span>
                                <h2>{displayTitle}</h2>
                                <div className="plp-narrative">
                                    {narrativeParagraphs.map((paragraph, index) => (
                                        <p key={index}>{paragraph}</p>
                                    ))}
                                </div>
                            </section>

                            <section id="ficha" className="plp-section plp-summary-card plp-quick-facts-card">
                                <div className="plp-section-head compact">
                                    <span className="plp-kicker">Ficha rápida</span>
                                </div>
                                <div className="plp-spec-grid">
                                    {area > 0 && <SpecCard icon={<Ruler size={21} />} label="Área" value={`${area.toLocaleString('pt-BR')} m²`} />}
                                    {suiteCount > 0 && <SpecCard icon={<BedDouble size={21} />} label="Configuração" value={`${suiteCount} ${statLabel(suiteCount, 'suíte', 'suítes')}`} />}
                                    {bathroomsCount > 0 && <SpecCard icon={<Bath size={21} />} label="Banheiros" value={String(bathroomsCount)} />}
                                    {parkingCount > 0 && <SpecCard icon={<Car size={21} />} label="Garagem" value={`${parkingCount} ${statLabel(parkingCount, 'vaga', 'vagas')}`} />}
                                    <SpecCard icon={<MapPin size={21} />} label="Localização" value={locationLabel || displayCity || 'Litoral SC'} />
                                </div>
                                {featureItems.length > 0 && (
                                    <div className="plp-quick-facts-features">
                                        <InfoList title="Características do imóvel" items={featureItems} />
                                    </div>
                                )}
                            </section>
                        </div>

                        {developmentContext && (
                            <section id="empreendimento-do-imovel" className="plp-section plp-development-context-band">
                                <div className="plp-development-context-copy">
                                    <h2>Conheça o condomínio {developmentContext.name}.</h2>
                                    {projectItems.length > 0 && (
                                        <div className="plp-development-context-features plp-development-context-features--condo">
                                            <InfoList title="Características do condomínio" items={projectItems} />
                                        </div>
                                    )}
                                </div>
                                <div className="plp-development-context-media">
                                    <div className="plp-development-context-gallery" aria-label={`Imagens do condomínio ${developmentContext.name}`}>
                                        {developmentGalleryPreview.slice(0, 5).map((item, index) => (
                                            <figure key={`${item.image}-${index}`}>
                                                <img src={item.image} alt={`${developmentContext.name} - ${item.title}`} loading={index === 0 ? 'eager' : 'lazy'} />
                                                <figcaption>
                                                    <span>{index === 0 ? 'Condomínio' : item.category}</span>
                                                    <strong>{item.title}</strong>
                                                </figcaption>
                                            </figure>
                                        ))}
                                    </div>
                                    <div className="plp-development-context-details">
                                        <p>
                                            Veja imagens do projeto, contexto do condomínio e compare as unidades disponíveis antes de decidir a visita.
                                        </p>
                                        <div className="plp-development-context-facts">
                                            <span><MapPin size={15} /> {developmentContext.locationName}</span>
                                            <span><Home size={15} /> {developmentContext.availableUnitsCount ? `${developmentContext.availableUnitsCount} unidades ativas` : 'Unidades sob consulta'}</span>
                                            <span><BarChart3 size={15} /> {developmentContext.priceRange}</span>
                                            <span><Ruler size={15} /> {developmentContext.areaRange}</span>
                                            <span><BedDouble size={15} /> {developmentContext.suitesRange}</span>
                                        </div>
                                        <div className="plp-development-context-unit">
                                            <div className="plp-development-context-unit-copy">
                                                <small>Unidade relacionada</small>
                                                <strong>{developmentContext.unit.title}</strong>
                                                <span>{developmentContext.unit.area} | {developmentContext.unit.suites} | {developmentContext.unit.price}</span>
                                            </div>
                                            <div className="plp-development-context-actions">
                                                <Link href={developmentHref || '/busca'} className="plp-development-primary-link">
                                                    Conhecer condomínio
                                                    <ArrowRight size={16} />
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {showTechnicalLocationSection && (
                            <div className="plp-technical-location-grid single">
                                {propertyMapLatLng && (
                                    <PropertyNearbyBenefits
                                        propertyId={property.id}
                                        title={displayTitle}
                                        latLng={propertyMapLatLng}
                                        locationLabel={locationLabel || mapLocation || displayCity}
                                        className="plp-nearby-benefits--compact"
                                    />
                                )}
                            </div>
                        )}

                        <section id="historico-precos" className="plp-section plp-market-history">
                            <div className="plp-section-head">
                                <span className="plp-kicker">Histórico e valor</span>
                                <h2>Preço, custos e leitura de mercado.</h2>
                            </div>
                            <div className="plp-market-grid">
                                <article className="plp-market-card plp-market-main">
                                    <div className="plp-market-card-head">
                                        <span><BarChart3 size={16} /> Radar de valor</span>
                                        <strong>{marketHistory.comparableCount ? `${marketHistory.comparableCount} comparáveis | confiança ${marketHistory.confidenceLabel}` : 'Amostra em formação'}</strong>
                                    </div>
                                    <div className="plp-market-dashboard">
                                        <div className="plp-market-metrics">
                                            <div>
                                                <small>Valor anunciado</small>
                                                <strong>{formatCompactMoney(property.price)}</strong>
                                            </div>
                                            <div>
                                                <small>Área usada</small>
                                                <strong>{marketHistory.currentArea ? `${Math.round(marketHistory.currentArea).toLocaleString('pt-BR')} m²` : 'Sob consulta'}</strong>
                                            </div>
                                            <div>
                                                <small>Preço por m²</small>
                                                <strong>{marketHistory.currentPriceM2 ? `${formatCompactMoney(Math.round(marketHistory.currentPriceM2))}/m²` : 'Sob consulta'}</strong>
                                            </div>
                                            <div>
                                                <small>Mediana regional</small>
                                                <strong>{marketHistory.medianM2 ? `${formatCompactMoney(Math.round(marketHistory.medianM2))}/m²` : 'Sem amostra'}</strong>
                                            </div>
                                            <div>
                                                <small>Dif. vs mediana</small>
                                                <strong>{formatPercent(marketHistory.deltaToMedian)}</strong>
                                            </div>
                                            <div>
                                                <small>Amostra bruta</small>
                                                <strong>{marketHistory.rawComparableCount ? `${marketHistory.rawComparableCount} ativos` : 'Em curadoria'}</strong>
                                            </div>
                                        </div>
                                        {renderMarketScale('plp-market-chart')}
                                        <aside className="plp-market-history-panel" aria-label="Histórico de preço e base local">
                                            <div className="plp-market-card-head">
                                                <span>Histórico de preço</span>
                                                <strong>Mercado local</strong>
                                            </div>
                                            <div className="plp-market-history-summary">
                                                <span>
                                                    <small>Recorte</small>
                                                    <strong>{locationLabel || displayCity || 'Litoral SC'}</strong>
                                                </span>
                                                <span>
                                                    <small>Base</small>
                                                    <strong>{marketHistory.comparableCount ? `${marketHistory.comparableCount} comparáveis` : 'Em formação'}</strong>
                                                </span>
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
                                        </aside>
                                    </div>
                                    <div className="plp-market-insight-grid">
                                        <div className="plp-market-positioning">
                                            <strong>{marketHistory.positioning.label}</strong>
                                            <span>{marketHistory.positioning.description}</span>
                                            {marketHistory.percentile !== null && (
                                                <small>Percentil {Math.round(marketHistory.percentile)} da amostra qualificada.</small>
                                            )}
                                        </div>
                                        <p className="plp-market-note">
                                            <TrendingUp size={15} />
                                            {marketHistory.reading}
                                        </p>
                                    </div>
                                    <details className="plp-market-method">
                                        <summary>Como o sistema calcula</summary>
                                        <ul>
                                            {marketHistory.criteriaSummary.map(item => (
                                                <li key={item}>{item}</li>
                                            ))}
                                            <li>{marketHistory.calculationSummary}</li>
                                        </ul>
                                    </details>
                                </article>
                            </div>
                        </section>

                    </div>

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
                                    <span className={`plp-side-benefit-tag plp-side-benefit-tag-${primaryQualityLabel.tone}`}>
                                        {mainBenefitTag}
                                    </span>
                                    <span className="plp-side-price-note">valor anunciado</span>
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
                                <span className="plp-form-message">Olá, tenho interesse no imóvel {propertyUrl}</span>
                                <span>Nome completo *</span>
                                <span>Telefone *</span>
                                <span>Email *</span>
                            </div>
                            <WhatsAppCaptureLink
                                phone={contactPhone}
                                message={`Olá, tenho interesse no imóvel ${propertyUrl}`}
                                slug="imovel"
                                template="property-classic-form"
                                metadata={{
                                    ...propertyTrackingMetadata,
                                    tracking_event_type: 'property_availability_requested',
                                    premium_intent: 'availability',
                                    requested_action: 'Receber disponibilidade e condições',
                                    cta_context: 'sidebar_lead_card',
                                    cta_label: 'Enviar interesse',
                                }}
                                className="plp-dark-button"
                            >
                                Enviar interesse
                            </WhatsAppCaptureLink>
                        </div>

                        <div className="plp-side-card plp-broker-card">
                            <PropertyBrokerAvatar
                                image={brokerCardImage}
                                name={brokerCardName}
                                lookupSlug={brokerCardPhotoLookupSlug}
                            />
                            <div>
                                <h3>{brokerCardName}</h3>
                                <p>{brokerCredentialLine}</p>
                            </div>
                        </div>
                    </aside>

                </section>

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
                                const itemQualityLabel = getPropertyPrimaryQualityLabel(item)
                                return (
                                    <Link key={item.id} href={propertyDetailsPath(item)} className="plp-related-card">
                                        <img src={image} alt={relatedTitle} loading="lazy" />
                                        <span className={`plp-card-ribbon plp-card-ribbon-${itemQualityLabel.tone}`}>
                                            {itemQualityLabel.label}
                                        </span>
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
                    message={`Olá, tenho interesse no imóvel ${propertyUrl}`}
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
                    <span className="plp-mobile-cta-label">Receba detalhes, disponibilidade e visita privada deste imóvel em seu WhatsApp após o cadastro</span>
                </WhatsAppCaptureLink>
            </div>

            <MobileNav
                phone={contactPhone}
                message={`Olá, tenho interesse no imóvel ${propertyUrl}`}
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
