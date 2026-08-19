import type { Metadata } from 'next'
import type { ReactNode } from 'react'
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
    Info,
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
import PropertySidebarLeadForm from '@/components/property/PropertySidebarLeadForm'
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
import { extractPropertyIdFromSeoSlug, slugifyPropertySegment } from '@/lib/properties/seo-url'
import { propertyDetailsPath, propertyDetailsSegment } from '@/lib/properties/responsive-destination'
import { getPropertyPrimaryQualityLabel } from '@/lib/properties/intelligence'
import { GLOBAL_PROPERTY_BROKER_NAME, GLOBAL_PROPERTY_WHATSAPP_PHONE, getResponsibleBrokerForProperty } from '@/lib/properties/responsible-broker'
import { fetchPropertyPriceHistory, type PropertyPriceHistoryRow } from '@/lib/properties/price-history'
import {
    buildMarketRadarAnalysis,
    fetchInternalMarketComparables,
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

const PROPERTY_DETAIL_SELECT = [
    'id',
    'source_slug',
    'source_reference',
    'title',
    'description',
    'seo_title',
    'seo_description',
    'city',
    'state',
    'neighborhood',
    'price',
    'rent',
    'purpose',
    'featured_image',
    'images',
    'video_url',
    'property_type',
    'bedrooms',
    'bathrooms',
    'suites',
    'parking_spaces',
    'area_m2',
    'area_private_m2',
    'area_total_m2',
    'latitude',
    'longitude',
    'amenities',
    'exclusive',
    'source_status',
    'status',
    'street',
    'condo_fee',
    'iptu',
    'created_at',
    'updated_at',
    'source_created_at',
    'source_updated_at',
    'imported_at',
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

type PropertyDevelopmentCandidate = {
    page: any
    content: Record<string, any>
    contentDevelopment: Record<string, any>
    development: Record<string, any>
    relatedUnit: PropertyDevelopmentUnitContext
    units: PropertyDevelopmentUnitContext[]
    score: number
    unitCount: number
}

type PropertyPrivateDevelopmentMetadata = {
    condominium_name?: string | null
    construction_company?: string | null
}

const PROPERTY_BRAVA_CONCETTO_FALLBACK_DEVELOPMENT = {
    name: 'Brava Concetto',
    pageSlug: 'bravaconceto',
    locationName: 'Praia Brava, Itajai - SC',
    priceRange: 'R$ 8.600.000 a R$ 21.000.000',
    availableUnitsCount: 3,
        areaRange: '280 m² a 592 m²',
    suitesRange: '4 suites',
    heroImage: '/images/brava-concetto/1_CL_BC_FACHADA_DIURNA_R01.jpg',
    description: 'Um empreendimento de poucas unidades na Praia Brava, pensado para quem busca privacidade, arquitetura autoral e leitura clara de patrimonio.',
    units: [
        {
            type: 'Apartamento Tipo',
            title: 'Apartamento no Ed. Brava Concetto',
            area: '280 m²',
            suites: '4 suites',
            price: 'R$ 8.600.000',
            sourceSlug: 'apartamento-garden-no-ed-brava-concetto-na-praia-brava-em-itajaisc',
        },
        {
            type: 'Apartamento Garden',
            title: 'Apartamento Garden no Ed. Brava Concetto',
            area: '368 m²',
            suites: '4 suites',
            price: 'R$ 10.000.000',
            sourceSlug: 'apartamento-garden-no-ed-brava-concetto-na-praia-brava-em-itajaisc',
        },
        {
            type: 'Cobertura Duplex',
            title: 'Cobertura Duplex no Ed. Brava Concetto',
            area: '592 m²',
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
        area: asSafeText(record.area, 'Área sob consulta'),
        suites: asSafeText(record.suites, 'Configuração sob consulta'),
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

const PROPERTY_DEVELOPMENT_LOCATION_NOISE_KEYS = new Set([
    'balneario camboriu',
    'barra norte',
    'barra sul',
    'centro',
    'camboriu',
    'itapema',
    'itajai',
    'meia praia',
    'navegantes',
    'porto belo',
    'praia brava',
    'santa catarina',
    'sc',
])

const PROPERTY_DEVELOPMENT_GENERIC_NOISE_KEYS = new Set([
    'apartamento',
    'casa',
    'cobertura',
    'cond',
    'condominio',
    'ed',
    'edificio',
    'galpao',
    'imovel',
    'loja',
    'residencial',
    'sala',
    'terreno',
    'unidade',
])

function isTitleInferredLocationCandidate(value: unknown) {
    const normalized = normalizeComparableText(value)
    if (!normalized) return true
    if (PROPERTY_DEVELOPMENT_LOCATION_NOISE_KEYS.has(normalized)) return true

    return /^(praia|bairro|br|rodovia|avenida|av|quadra|centro|barra|canto da praia|trevo|areia)\b/.test(normalized)
}

function addDevelopmentLookupVariant(keys: Set<string>, value: unknown) {
    const normalized = normalizeComparableText(value)
    if (!normalized) return

    const variants = new Set<string>([normalized])
    variants.add(normalized.replace(/^(?:ed|edificio|cond|condominio|residencial)\s+/, ''))

    if (normalized.startsWith('ed ')) variants.add(normalized.replace(/^ed\s+/, 'edificio '))
    if (normalized.startsWith('edificio ')) variants.add(normalized.replace(/^edificio\s+/, 'ed '))
    if (normalized.startsWith('cond ')) variants.add(normalized.replace(/^cond\s+/, 'condominio '))
    if (normalized.startsWith('condominio ')) variants.add(normalized.replace(/^condominio\s+/, 'cond '))

    for (const variant of variants) {
        const clean = variant.replace(/\s+/g, ' ').trim()
        if (
            clean.length < 3 ||
            PROPERTY_DEVELOPMENT_GENERIC_NOISE_KEYS.has(clean) ||
            PROPERTY_DEVELOPMENT_LOCATION_NOISE_KEYS.has(clean)
        ) {
            continue
        }

        keys.add(clean)

        const compact = clean.replace(/\s+/g, '')
        if (compact.length >= 5 && !PROPERTY_DEVELOPMENT_LOCATION_NOISE_KEYS.has(compact)) {
            keys.add(compact)
        }
    }
}

function trimDevelopmentTitleCandidate(value: string) {
    return value
        .replace(/\s+(?:em|na|nas|nos|com|para|frente|mobiliado|decorado|a venda|a partir|no bairro)\b.*$/i, '')
        .replace(/\s+/g, ' ')
        .trim()
}

function propertyDevelopmentNameCandidates(property: any) {
    const candidates = new Set<string>()

    for (const value of [
        property?.condominium_name,
        property?.condominio,
        property?.condominium,
        property?.development_name,
        property?.empreendimento,
        property?.building_name,
        property?.building,
    ]) {
        addDevelopmentLookupVariant(candidates, value)
    }

    const title = normalizeComparableText(property?.title)
    if (!title) return candidates

    const explicitPatterns = [
        /\b(?:ed|edificio|cond|condominio|residencial)\s+[a-z0-9][a-z0-9\s]{1,100}/g,
        /^((?:condominio|residencial)\s+[a-z0-9][a-z0-9\s]{1,100})/g,
    ]

    for (const pattern of explicitPatterns) {
        for (const match of title.matchAll(pattern)) {
            addDevelopmentLookupVariant(candidates, trimDevelopmentTitleCandidate(match[1] || match[0]))
        }
    }

    for (const match of title.matchAll(/\b(?:no|na|nos|nas)\s+([a-z0-9][a-z0-9\s]{2,100})/g)) {
        const candidate = trimDevelopmentTitleCandidate(match[1])
        if (!isTitleInferredLocationCandidate(candidate)) {
            addDevelopmentLookupVariant(candidates, candidate)
        }
    }

    return candidates
}

function developmentUnitMatchScore(unit: PropertyDevelopmentUnitContext, property: any) {
    const propertySourceReference = normalizeSourceSlugKey(property?.source_reference)
    const propertyId = normalizeSourceSlugKey(property?.id)
    const propertySourceSlug = normalizeSourceSlugKey(property?.source_slug)
    const unitReferenceKeys = [unit.sourceReference, unit.id].map(normalizeSourceSlugKey).filter(Boolean)
    const unitPropertyKeys = [unit.propertyId, unit.id].map(normalizeSourceSlugKey).filter(Boolean)
    const unitSourceSlug = normalizeSourceSlugKey(unit.sourceSlug)
    let score = 0

    if (propertyId && unitPropertyKeys.includes(propertyId)) score += 10000
    if (propertySourceReference && unitReferenceKeys.includes(propertySourceReference)) score += 9000
    if (propertySourceSlug && unitSourceSlug === propertySourceSlug) score += 8000

    if (score > 0 && priceMatches(unit.price, property?.price)) score += 120
    if (score > 0 && areaMatches(unit.area, property)) score += 80

    const propertyTitle = normalizeComparableText(property?.title)
    const unitTitle = normalizeComparableText(unit.title)
    const unitType = normalizeComparableText(unit.type)
    if (
        score > 0 &&
        propertyTitle &&
        ((unitTitle && (propertyTitle.includes(unitTitle) || unitTitle.includes(propertyTitle))) ||
            (unitType && propertyTitle.includes(unitType)))
    ) {
        score += 40
    }

    return score
}

function developmentPageNameKeys(page: any, content: Record<string, any>, development: Record<string, any>) {
    const metadata = asSafeRecord(page?.metadata)
    const keys = new Set<string>()
    const developmentAliases = [
        ...(Array.isArray(development.sourceCondominiumAliases) ? development.sourceCondominiumAliases : []),
        ...(Array.isArray(development.source_condominium_aliases) ? development.source_condominium_aliases : []),
        ...(Array.isArray(metadata.source_condominium_aliases) ? metadata.source_condominium_aliases : []),
    ]

    for (const value of [
        development.sourceCondominiumKey,
        development.source_condominium_key,
        development.sourceCondominiumName,
        development.source_condominium_name,
        metadata.source_condominium_key,
        metadata.source_condominium_name,
        development.name,
        development.pageSlug,
        development.page_slug,
        content.custom_title,
        page?.title,
        page?.slug,
        ...developmentAliases,
    ]) {
        addDevelopmentLookupVariant(keys, value)
    }

    return keys
}

function developmentPageMatchesProperty(page: any, content: Record<string, any>, development: Record<string, any>, propertyNameKeys: Set<string>) {
    if (!propertyNameKeys.size) return false
    const pageKeys = developmentPageNameKeys(page, content, development)
    return [...propertyNameKeys].some(key => pageKeys.has(key))
}

function propertyDevelopmentFallbackUnit(property: any): PropertyDevelopmentUnitContext {
    const sourceSlug = asSafeText(property?.source_slug)
    const propertyId = asSafeText(property?.id)
    const sourceReference = asSafeText(property?.source_reference)
    const privateArea = numericValue(property?.area_private_m2 ?? property?.area_m2)
    const suites = numericValue(property?.suites)
    const bedrooms = numericValue(property?.bedrooms)
    const price = numericValue(property?.price)

    return {
        id: propertyId || sourceReference || sourceSlug,
        propertyId,
        sourceReference,
        title: asSafeText(property?.seo_title ?? property?.title, 'Unidade relacionada'),
        type: asSafeText(property?.property_type, 'Unidade'),
        area: privateArea ? `${privateArea.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m²` : 'Área sob consulta',
        suites: suites
            ? `${Math.round(suites)} ${suites === 1 ? 'suite' : 'suites'}`
            : (bedrooms ? `${Math.round(bedrooms)} dormitórios` : 'Configuração sob consulta'),
        price: price ? formatMoney(price) : 'Consulte',
        sourceSlug: sourceSlug || propertyId || sourceReference,
    }
}

function titleCaseDevelopmentName(value: string) {
    const lowerWords = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])
    const normalized = value.toLocaleLowerCase('pt-BR')

    return normalized
        .split(/\s+/)
        .map((word, index) => {
            if (index > 0 && lowerWords.has(word)) return word
            return word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1)
        })
        .join(' ')
}

function cleanDevelopmentDisplayName(value: unknown) {
    const text = asSafeText(value)
        .replace(/\s+/g, ' ')
        .replace(/^(?:ed\.?|edificio|cond\.?|condominio|residencial)\s+/i, '')
        .replace(/\s+(?:em|na|no)\s+(?:itapema|balneario camboriu|balneário camboriú|itajai|itajaí|praia brava|porto belo|sc)\b.*$/i, '')
        .replace(/\s+[-|].*$/i, '')
        .trim()

    if (!text || isTitleInferredLocationCandidate(text)) return ''

    return text === text.toLocaleUpperCase('pt-BR') ? titleCaseDevelopmentName(text) : text
}

function propertyDevelopmentDisplayName(property: any) {
    for (const value of [
        property?.condominium_name,
        property?.condominio,
        property?.condominium,
        property?.development_name,
        property?.empreendimento,
        property?.building_name,
        property?.building,
    ]) {
        const name = cleanDevelopmentDisplayName(value)
        if (name) return name
    }

    const title = asSafeText(property?.title ?? property?.seo_title)
    const titleMatch = title.match(/\b(?:no|na|nos|nas)\s+((?:ed\.?|edificio|cond\.?|condominio|residencial)?\s*[A-Za-zÀ-ÿ0-9][^|,.]+?)(?=\s+(?:em|na|no|com|frente|mobiliado|decorado|a venda)\b|$)/i)
    const titleName = cleanDevelopmentDisplayName(titleMatch?.[1])
    if (titleName) return titleName

    const description = asSafeText(property?.description ?? property?.seo_description)
    const descriptionMatch = description.match(/^([^|\n-]{4,90})(?:\s+-|\s+\|)/)
    const descriptionName = cleanDevelopmentDisplayName(descriptionMatch?.[1])
    if (descriptionName) return descriptionName

    return ''
}

function propertyDevelopmentFallbackContext(property: any): PropertyDevelopmentContext | null {
    const name = propertyDevelopmentDisplayName(property)
    if (!name) return null

    const unit = propertyDevelopmentFallbackUnit(property)
    const gallery = uniqueDevelopmentGallery(
        getGallery(property).slice(0, 6).map((image, index) => ({
            image,
            title: index === 0 ? name : `${name} - foto ${index + 1}`,
            category: index === 0 ? 'Condomínio' : 'Imagem',
        }))
    )
    const heroImage = gallery[0]?.image || property?.featured_image || DEFAULT_OG_IMAGE

    return {
        slug: '',
        name,
        locationName: locationLabelFromProperty(property),
        priceRange: unit.price,
        availableUnitsCount: 1,
        areaRange: unit.area,
        suitesRange: unit.suites,
        heroImage,
        description: `Conheça o condomínio ${name} e compare as informações principais antes da visita.`,
        gallery: gallery.length ? gallery : [{ image: heroImage, title: name, category: 'Condomínio' }],
        unit,
    }
}

function developmentFallbackForPage(page: any, content: Record<string, any>) {
    const slug = asSafeText(page?.slug)
    const template = asSafeText(content.template)
    if (slug === 'bravaconceto' || template === 'brava-concetto') {
        return PROPERTY_BRAVA_CONCETTO_FALLBACK_DEVELOPMENT
    }
    return null
}

function pickBestDevelopmentUnit(candidates: PropertyDevelopmentUnitContext[], property: any) {
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

function pickDevelopmentUnit(units: PropertyDevelopmentUnitContext[], property: any) {
    const propertySourceReference = normalizeSourceSlugKey(property?.source_reference)
    const propertyId = normalizeSourceSlugKey(property?.id)
    const propertySourceSlug = normalizeSourceSlugKey(property?.source_slug)

    const bySourceReference = propertySourceReference
        ? units.filter((unit) => {
            const unitReferenceKeys = [
                unit.sourceReference,
                unit.id,
            ].map(normalizeSourceSlugKey).filter(Boolean)
            return unitReferenceKeys.includes(propertySourceReference)
        })
        : []
    if (bySourceReference.length) return pickBestDevelopmentUnit(bySourceReference, property)

    const byPropertyId = propertyId
        ? units.filter((unit) => {
            const unitPropertyKeys = [
                unit.propertyId,
                unit.id,
            ].map(normalizeSourceSlugKey).filter(Boolean)
            return unitPropertyKeys.includes(propertyId)
        })
        : []
    if (byPropertyId.length) return pickBestDevelopmentUnit(byPropertyId, property)

    const bySourceSlug = propertySourceSlug
        ? units.filter((unit) => {
            const unitSourceSlug = normalizeSourceSlugKey(unit.sourceSlug)
            if (!unitSourceSlug || unitSourceSlug !== propertySourceSlug) return false

            const unitSourceReference = normalizeSourceSlugKey(unit.sourceReference || unit.id)
            if (propertySourceReference && unitSourceReference && unitSourceReference !== propertySourceReference) return false

            const unitPropertyId = normalizeSourceSlugKey(unit.propertyId)
            if (propertyId && unitPropertyId && unitPropertyId !== propertyId) return false

            return true
        })
        : []

    return pickBestDevelopmentUnit(bySourceSlug, property)
}

function developmentSlugCandidates(propertyNameKeys: Set<string>) {
    const slugs = new Set<string>()

    for (const key of propertyNameKeys) {
        const baseSlug = slugifyPropertySegment(key, '')
        if (!baseSlug || baseSlug.length < 3) continue

        slugs.add(baseSlug)

        for (const prefix of ['ed-', 'edificio-', 'cond-', 'condominio-', 'residencial-']) {
            if (baseSlug.startsWith(prefix)) {
                const withoutPrefix = baseSlug.slice(prefix.length)
                if (withoutPrefix.length >= 3) slugs.add(withoutPrefix)
            }
        }
    }

    return [...slugs].slice(0, 24)
}

function findBestDevelopmentCandidate(
    pages: any[] | null | undefined,
    property: any,
    propertyNameKeys: Set<string>
) {
    const directCandidates: PropertyDevelopmentCandidate[] = []
    const inferredCandidates: PropertyDevelopmentCandidate[] = []

    for (const page of pages || []) {
        const content = asSafeRecord(page.content)
        const contentDevelopment = asSafeRecord(content.development)
        const fallbackDevelopment = developmentFallbackForPage(page, content)
        const hasDevelopmentContent = Boolean(fallbackDevelopment || Object.keys(contentDevelopment).length)
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
        const matchedUnitScore = matchedUnit ? developmentUnitMatchScore(matchedUnit, property) : 0
        const inferredUnit = !matchedUnit && hasDevelopmentContent && developmentPageMatchesProperty(page, content, development, propertyNameKeys)
            ? propertyDevelopmentFallbackUnit(property)
            : null
        const relatedUnit = matchedUnit || inferredUnit

        if (!relatedUnit) continue

        const candidate = {
            page,
            content,
            contentDevelopment,
            development,
            relatedUnit,
            units,
            score: matchedUnit ? matchedUnitScore : 100,
            unitCount: units.length,
        }

        if (matchedUnit) directCandidates.push(candidate)
        else inferredCandidates.push(candidate)
    }

    const candidates = directCandidates.length
        ? directCandidates
        : (inferredCandidates.length === 1 ? inferredCandidates : [])

    return candidates.sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score
        if (right.unitCount !== left.unitCount) return right.unitCount - left.unitCount
        return new Date(right.page?.created_at || 0).getTime() - new Date(left.page?.created_at || 0).getTime()
    })[0] || null
}

function buildDevelopmentContextFromCandidate(
    candidate: PropertyDevelopmentCandidate,
    property: any
): PropertyDevelopmentContext {
    const { page, content, contentDevelopment, development, relatedUnit, units } = candidate
    const fallbackDevelopment = developmentFallbackForPage(page, content)
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
        slug: resolveDevelopmentPageSlug(page, content, development),
        name,
        locationName: asSafeText(development.locationName ?? development.location_name, locationLabelFromProperty(property)),
        priceRange: asSafeText(development.priceRange ?? development.price_range, relatedUnit.price),
        availableUnitsCount,
        areaRange: asSafeText(development.areaRange ?? development.area_range, relatedUnit.area),
        suitesRange: asSafeText(development.suitesRange ?? development.suites_range, relatedUnit.suites),
        heroImage,
        description: asSafeText(development.description, `Conheça o condomínio ${name} e compare as unidades disponíveis antes da visita.`),
        gallery,
        unit: relatedUnit,
    }
}

function safeDevelopmentRouteSlug(value: unknown) {
    const text = asSafeText(value)
    if (!text) return ''
    if (/^[a-z0-9][a-z0-9-]{1,180}$/i.test(text)) return text
    return slugifyPropertySegment(text, '')
}

function resolveDevelopmentPageSlug(page: any, content: Record<string, any>, development: Record<string, any>) {
    const metadata = asSafeRecord(page?.metadata)
    const seo = asSafeRecord(content.seo)

    for (const value of [
        metadata.canonical_development_slug,
        metadata.redirect_to_slug,
        content.canonical_development_slug,
        seo.canonical_development_slug,
        page?.slug,
        development.page_slug,
        development.pageSlug,
    ]) {
        const slug = safeDevelopmentRouteSlug(value)
        if (slug) return slug
    }

    return ''
}

function locationLabelFromProperty(property: any) {
    return [...buildDisplayLocationParts(property?.neighborhood, property?.city), property?.state]
        .filter(Boolean)
        .join(' - ')
}

const PROPERTY_LOOKUP_TIMEOUT_MS = 7000
const PROPERTY_METADATA_LOOKUP_TIMEOUT_MS = 3500
const PROPERTY_SECONDARY_QUERY_TIMEOUT_MS = 7000
const PROPERTY_ENRICHMENT_QUERY_TIMEOUT_MS = 3500
const PROPERTY_NON_CRITICAL_QUERY_TIMEOUT_MS = 2500
const PROPERTY_LOOKUP_RETRY_DELAYS_MS = [700]

class PropertyLookupUnavailableError extends Error {
    constructor(message = 'Não foi possível consultar o imóvel agora.') {
        super(message)
        this.name = 'PropertyLookupUnavailableError'
    }
}

function isPropertyLookupUnavailableError(error: unknown) {
    return error instanceof PropertyLookupUnavailableError
}

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

function propertySecondaryTimeout<T>(label: string, timeoutMs = PROPERTY_SECONDARY_QUERY_TIMEOUT_MS): Promise<T> {
    return new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs)
    })
}

async function withPropertySecondaryFallback<T>(
    promise: Promise<T>,
    label: string,
    fallback: T,
    timeoutMs = PROPERTY_SECONDARY_QUERY_TIMEOUT_MS
): Promise<T> {
    try {
        return await Promise.race([promise, propertySecondaryTimeout<T>(label, timeoutMs)])
    } catch (error) {
        console.warn(`[Property Detail] ${label} unavailable:`, summarizeSupabaseError(error))
        return fallback
    }
}

async function getPropertyPrivateDevelopmentMetadata(
    supabase: any,
    propertyId: string
): Promise<PropertyPrivateDevelopmentMetadata | null> {
    if (!propertyId) return null

    const { data, error } = await supabase
        .from('property_private_details')
        .select('condominium_name, construction_company')
        .eq('property_id', propertyId)
        .maybeSingle()
        .abortSignal(createSupabaseAbortSignal(PROPERTY_SECONDARY_QUERY_TIMEOUT_MS))

    if (error) throw error
    return data || null
}

async function getPropertyViewCount(supabase: any, propertyId: string) {
    const { count, error } = await supabase
        .from('funnel_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', 'property_details_landing_viewed')
        .contains('metadata', { property_id: propertyId })
        .abortSignal(createSupabaseAbortSignal(PROPERTY_NON_CRITICAL_QUERY_TIMEOUT_MS))

    if (error) throw error
    return count || 0
}

async function getPropertySaveCount(supabase: any, propertyId: string) {
    const { data, error } = await supabase
        .from('funnel_events')
        .select('id, visitor_id, event_type, created_at')
        .in('event_type', ['property_favorited', 'property_unfavorited'])
        .contains('metadata', { property_id: propertyId })
        .order('created_at', { ascending: false })
        .limit(5000)
        .abortSignal(createSupabaseAbortSignal(PROPERTY_NON_CRITICAL_QUERY_TIMEOUT_MS))

    if (error) throw error
    return countCurrentPropertySaves(data)
}

async function getPropertyMapModalRows(supabase: any) {
    const { data, error } = await supabase
        .from('properties')
        .select(PROPERTY_MAP_MODAL_SELECT)
        .eq('status', 'active')
        .gte('price', PROPERTY_MAP_MODAL_MIN_PRICE)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(260)
        .abortSignal(createSupabaseAbortSignal(PROPERTY_NON_CRITICAL_QUERY_TIMEOUT_MS))

    if (error) throw error
    return data || []
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
    logLabel: string,
    retryDelaysMs = PROPERTY_LOOKUP_RETRY_DELAYS_MS
) {
    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
        const { data, error } = await createLookup()
        if (!error) return (data || null) as T | null

        const isRetriable = isRetriablePropertyLookupError(error)
        const canRetry = attempt < retryDelaysMs.length && isRetriable
        if (!canRetry) {
            const summary = summarizeSupabaseError(error)
            if (isRetriable) {
                console.warn(`[Property Detail] ${logLabel} unavailable:`, summary)
                throw new PropertyLookupUnavailableError()
            }

            console.error(`[Property Detail] ${logLabel} failed:`, summary)
            throw new Error('Não foi possível carregar este imóvel agora.')
        }

        await waitForPropertyLookupRetry(retryDelaysMs[attempt])
    }

    return null
}

type PropertyLookupOptions = {
    timeoutMs?: number
    retryDelaysMs?: number[]
}

async function getPropertyByIdentifier<T = any>(
    identifier: string,
    select = PROPERTY_DETAIL_SELECT,
    options: PropertyLookupOptions = {}
): Promise<T | null> {
    const decodedIdentifier = decodeURIComponent(identifier || '').trim()
    const idFromSeoSlug = extractPropertyIdFromSeoSlug(decodedIdentifier)
    const timeoutMs = options.timeoutMs ?? PROPERTY_LOOKUP_TIMEOUT_MS
    const retryDelaysMs = options.retryDelaysMs ?? PROPERTY_LOOKUP_RETRY_DELAYS_MS

    if (idFromSeoSlug || isUuid(decodedIdentifier)) {
        const propertyId = idFromSeoSlug || decodedIdentifier
        return runPropertyLookup<T>(
            () => createAdminClient()
                .from('properties')
                .select(select)
                .eq('id', propertyId)
                .abortSignal(createSupabaseAbortSignal(timeoutMs))
                .maybeSingle(),
            'property lookup by id',
            retryDelaysMs
        )
    }

    return runPropertyLookup<T>(
        () => createAdminClient()
            .from('properties')
            .select(select)
            .eq('source_slug', decodedIdentifier)
            .limit(1)
            .abortSignal(createSupabaseAbortSignal(timeoutMs))
            .maybeSingle(),
        'property lookup by slug',
        retryDelaysMs
    )
}

async function getPropertyDevelopmentContext(supabase: any, property: any): Promise<PropertyDevelopmentContext | null> {
    const fallbackContext = propertyDevelopmentFallbackContext(property)
    if (!propertyDevelopmentKeys(property).size) return fallbackContext
    const propertyNameKeys = propertyDevelopmentNameCandidates(property)
    const preferredSlugs = developmentSlugCandidates(propertyNameKeys)

    if (preferredSlugs.length) {
        const { data: targetedPages, error: targetedError } = await supabase
            .from('landing_pages')
            .select('id, slug, title, content, metadata, created_at')
            .eq('status', 'published')
            .in('slug', preferredSlugs)
            .order('created_at', { ascending: true })
            .abortSignal(createSupabaseAbortSignal(PROPERTY_SECONDARY_QUERY_TIMEOUT_MS))

        if (targetedError) {
            console.warn('[Property Detail] targeted development context unavailable:', targetedError.message)
        } else {
            const targetedCandidate = findBestDevelopmentCandidate(targetedPages, property, propertyNameKeys)
            if (targetedCandidate) return buildDevelopmentContextFromCandidate(targetedCandidate, property)
        }
    }

    const { data, error } = await supabase
        .from('landing_pages')
        .select('id, slug, title, content, metadata, created_at')
        .eq('status', 'published')
        .order('created_at', { ascending: true })
        .abortSignal(createSupabaseAbortSignal(PROPERTY_SECONDARY_QUERY_TIMEOUT_MS))

    if (error) {
        console.warn('[Property Detail] development context unavailable:', error.message)
        return fallbackContext
    }

    const bestCandidate = findBestDevelopmentCandidate(data, property, propertyNameKeys)

    if (!bestCandidate) return fallbackContext

    return buildDevelopmentContextFromCandidate(bestCandidate, property)
}

async function getPropertyForSeo(identifier: string) {
    return getPropertyByIdentifier<any>(
        identifier,
        'id, source_slug, title, description, seo_title, seo_description, city, state, neighborhood, price, featured_image, images, property_type, bedrooms, bathrooms, suites, parking_spaces, area_m2, area_private_m2, latitude, longitude, amenities, status, created_at, updated_at',
        { timeoutMs: PROPERTY_METADATA_LOOKUP_TIMEOUT_MS, retryDelaysMs: [] }
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
    const maxRelatedProperties = 6
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
        if (selected.length >= maxRelatedProperties) break
        if (selectedIds.has(item.property.id)) continue
        selected.push(item)
        selectedIds.add(item.property.id)
    }

    return selected.slice(0, maxRelatedProperties).map(item => item.property)
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

function formatMarketDate(value?: string | null, fallback = 'Sob consulta') {
    if (!value) return fallback
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return fallback

    return new Intl.DateTimeFormat('pt-BR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(date)
}

function formatNeutralPercent(value: number | null) {
    if (value === null || !Number.isFinite(value)) return '0%'
    const normalized = Math.abs(value) < 0.05 ? 0 : value
    const prefix = normalized > 0 ? '+' : ''
    return `${prefix}${normalized.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function formatSignedCompactMoney(value: number | null) {
    if (value === null || !Number.isFinite(value)) return 'Sob consulta'
    if (Math.abs(value) < 1) return 'R$ 0'
    const prefix = value > 0 ? '+' : '-'
    return `${prefix}${formatCompactMoney(Math.abs(value))}`
}

function buildSimplePriceHistory(property: any, events: PropertyPriceHistoryRow[]) {
    const currentPrice = numericValue(property.price)
    const publishedAt = propertyPublishedAt(property)
    const updatedAt = property.source_updated_at || property.updated_at || publishedAt
    const priceChanges = [...events]
        .filter(event => {
            const previousPrice = numericValue(event.previous_price)
            const nextPrice = numericValue(event.new_price)
            return Boolean(previousPrice && nextPrice && previousPrice !== nextPrice)
        })
        .sort((left, right) => {
            const leftTime = new Date(left.created_at || '').getTime()
            const rightTime = new Date(right.created_at || '').getTime()
            return leftTime - rightTime
        })

    const initialPrice = priceChanges[0]?.previous_price
        ? numericValue(priceChanges[0].previous_price)
        : currentPrice
    const variation = initialPrice ? ((currentPrice - initialPrice) / initialPrice) * 100 : 0

    return {
        publishedAt,
        updatedAt,
        currentPrice,
        initialPrice,
        variation,
        hasPriceChange: priceChanges.length > 0 && Math.abs(variation) >= 0.05,
        timeline: priceChanges.map(event => ({
            date: formatMarketDate(event.created_at),
            previousPrice: numericValue(event.previous_price),
            nextPrice: numericValue(event.new_price),
        })),
    }
}

function MarketTooltip({ label, children }: { label: string; children: string }) {
    return (
        <span className="plp-market-help" tabIndex={0} aria-label={`${label}: ${children}`}>
            <Info size={12} />
            <span role="tooltip">{children}</span>
        </span>
    )
}

async function getRelatedPropertyCandidates(supabase: any, property: any) {
    return fetchInternalMarketComparables(supabase, property) as Promise<RelatedPropertyCandidate[]>
}

type PropertyDetailPageProps = {
    params: Promise<{ id: string }>
    searchParams?: Promise<{ canonicalize?: string | string[] }>
}

function shouldCanonicalize(value?: string | string[]) {
    const normalized = Array.isArray(value) ? value[0] : value
    return normalized !== 'false'
}

function PropertyLookupUnavailablePage({ identifier }: { identifier: string }) {
    const decodedIdentifier = decodeURIComponent(identifier || '').trim()
    const requestedPath = decodedIdentifier ? `/imovel/${encodeURIComponent(decodedIdentifier)}/detalhes` : '/busca'
    const requestedUrl = absoluteUrl(requestedPath)

    return (
        <>
            <PropertyLandingStyles />
            <GlobalHeader />
            <main
                className="plp-page"
                style={{
                    minHeight: '70vh',
                    display: 'grid',
                    placeItems: 'center',
                    padding: '96px 20px',
                    background: '#f7f5f0',
                }}
            >
                <section
                    aria-labelledby="property-unavailable-title"
                    style={{
                        width: '100%',
                        maxWidth: 720,
                        border: '1px solid #eadfce',
                        borderRadius: 24,
                        background: '#fff',
                        padding: '42px 30px',
                        textAlign: 'center',
                        boxShadow: '0 20px 60px rgba(28, 23, 16, 0.08)',
                    }}
                >
                    <span
                        style={{
                            display: 'inline-flex',
                            marginBottom: 14,
                            color: '#9b6a22',
                            fontFamily: 'Montserrat, sans-serif',
                            fontSize: 12,
                            fontWeight: 800,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                        }}
                    >
                        Catalogo temporariamente indisponivel
                    </span>
                    <h1
                        id="property-unavailable-title"
                        style={{
                            margin: '0 auto 14px',
                            maxWidth: 560,
                            color: '#07172d',
                            fontSize: 'clamp(2rem, 4vw, 3rem)',
                            lineHeight: 1.05,
                        }}
                    >
                        Não foi possível carregar este imóvel agora.
                    </h1>
                    <p
                        style={{
                            margin: '0 auto 28px',
                            maxWidth: 560,
                            color: '#4b5b73',
                            fontFamily: 'Montserrat, sans-serif',
                            fontSize: 15,
                            lineHeight: 1.7,
                        }}
                    >
                        O catalogo demorou para responder. Voce pode voltar para a busca ou chamar um especialista para confirmar disponibilidade e alternativas.
                    </p>
                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            justifyContent: 'center',
                            gap: 12,
                        }}
                    >
                        <Link
                            href="/busca"
                            style={{
                                minWidth: 180,
                                borderRadius: 999,
                                border: '1px solid #9b6a22',
                                background: '#9b6a22',
                                color: '#fff',
                                padding: '13px 20px',
                                fontFamily: 'Montserrat, sans-serif',
                                fontSize: 13,
                                fontWeight: 800,
                                textDecoration: 'none',
                                textTransform: 'uppercase',
                            }}
                        >
                            Ver imoveis
                        </Link>
                        <WhatsAppCaptureLink
                            phone={GLOBAL_PROPERTY_WHATSAPP_PHONE}
                            message={`Olá, tentei abrir este imóvel e quero confirmar disponibilidade: ${requestedUrl}`}
                            slug="imovel"
                            template="property-unavailable"
                            metadata={{
                                requested_url: requestedUrl,
                                source: 'property_lookup_unavailable',
                            }}
                            style={{
                                minWidth: 180,
                                borderRadius: 999,
                                border: '1px solid #d7c6aa',
                                background: '#fff',
                                color: '#9b6a22',
                                padding: '13px 20px',
                                fontFamily: 'Montserrat, sans-serif',
                                fontSize: 13,
                                fontWeight: 800,
                                textDecoration: 'none',
                                textTransform: 'uppercase',
                            }}
                        >
                            Especialista
                        </WhatsAppCaptureLink>
                    </div>
                </section>
            </main>
            <Footer />
        </>
    )
}

export default async function PropertyDetailPage({
    params,
    searchParams,
}: PropertyDetailPageProps) {
    const supabase = createAdminClient()
    const { id } = await params
    const resolvedSearchParams = searchParams ? await searchParams : undefined
    const canonicalize = shouldCanonicalize(resolvedSearchParams?.canonicalize)

    let property = null
    try {
        property = await getPropertyByIdentifier(id)
    } catch (error) {
        if (isPropertyLookupUnavailableError(error)) {
            return <PropertyLookupUnavailablePage identifier={id} />
        }

        throw error
    }

    if (!property) return notFound()

    const canonicalSegment = propertyDetailsSegment(property)
    const currentSegment = decodeURIComponent(id || '').trim()
    if (canonicalize && canonicalSegment && currentSegment !== canonicalSegment) {
        redirect(propertyDetailsPath(property))
    }

    const adminSupabase = createAdminClient()
    const [
        privateDevelopmentMetadata,
        responsibleBroker,
        propertyViewCount,
        propertySaveCount,
        propertyMapModalRows,
    ] = await Promise.all([
        withPropertySecondaryFallback(
            getPropertyPrivateDevelopmentMetadata(adminSupabase, property.id),
            'property private development metadata',
            null,
            PROPERTY_ENRICHMENT_QUERY_TIMEOUT_MS
        ),
        withPropertySecondaryFallback(
            getResponsibleBrokerForProperty(adminSupabase, property.id),
            'responsible broker',
            fallbackResponsibleBroker(),
            PROPERTY_ENRICHMENT_QUERY_TIMEOUT_MS
        ),
        withPropertySecondaryFallback(
            getPropertyViewCount(adminSupabase, property.id),
            'view count',
            0,
            PROPERTY_NON_CRITICAL_QUERY_TIMEOUT_MS
        ),
        withPropertySecondaryFallback(
            getPropertySaveCount(adminSupabase, property.id),
            'save count',
            0,
            PROPERTY_NON_CRITICAL_QUERY_TIMEOUT_MS
        ),
        withPropertySecondaryFallback(
            getPropertyMapModalRows(supabase),
            'map modal portfolio',
            [],
            PROPERTY_NON_CRITICAL_QUERY_TIMEOUT_MS
        ),
    ])

    if (privateDevelopmentMetadata) {
        property = {
            ...property,
            condominium_name: privateDevelopmentMetadata.condominium_name || property.condominium_name,
            construction_company: privateDevelopmentMetadata.construction_company || property.construction_company,
        }
    }

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
        withPropertySecondaryFallback(
            getRelatedPropertyCandidates(supabase, property),
            'market comparables',
            [],
            PROPERTY_ENRICHMENT_QUERY_TIMEOUT_MS
        ),
        withPropertySecondaryFallback(
            fetchPropertyPriceHistory(adminSupabase, property.id),
            'price history',
            [],
            PROPERTY_NON_CRITICAL_QUERY_TIMEOUT_MS
        ),
        withPropertySecondaryFallback(
            getPropertyDevelopmentContext(adminSupabase, property),
            'development context',
            propertyDevelopmentFallbackContext(property),
            PROPERTY_ENRICHMENT_QUERY_TIMEOUT_MS
        ),
    ])
    const showTechnicalLocationSection = Boolean(propertyMapLatLng)
    const marketHistory = buildMarketHistory(property, relatedCandidates, area, locationLabel, priceHistoryEvents)
    const related = selectRelatedProperties(property, relatedCandidates)
    const relatedPreview = related.slice(0, 4)
    const marketFullPriceLabel = formatMoney(property.price)
    const marketFullPriceM2Label = marketHistory.currentPriceM2 ? `${formatMoney(Math.round(marketHistory.currentPriceM2))}/m²` : 'Sob consulta'
    const marketFullMedianM2Label = marketHistory.medianM2 ? `${formatMoney(Math.round(marketHistory.medianM2))}/m²` : 'Sem amostra'
    const marketPosition = marketHistory.comparableCount
        ? marketHistory.marketPosition
        : {
            ...marketHistory.marketPosition,
            title: 'Amostra em formação',
            summary: 'a leitura de mercado ainda está em formação.',
            interpretation: 'Ainda não há imóveis semelhantes suficientes para interpretar o preço anunciado com segurança. O sistema continuará monitorando os anúncios disponíveis.',
        }
    const simplePriceHistory = buildSimplePriceHistory(property, priceHistoryEvents)
    const marketMedianTotal = marketHistory.medianM2 && marketHistory.currentArea
        ? marketHistory.medianM2 * marketHistory.currentArea
        : null
    const marketDifferenceMoney = property.price && marketMedianTotal ? Number(property.price) - marketMedianTotal : null
    const marketDifferenceTone = marketHistory.deltaToMedian === null
        ? 'neutral'
        : marketHistory.deltaToMedian < -0.1
        ? 'good'
        : marketHistory.deltaToMedian > 15
        ? 'high'
        : 'neutral'
    const marketComparableText = marketHistory.comparableCount
        ? `${marketHistory.comparableCount.toLocaleString('pt-BR')} imóveis semelhantes`
        : 'Comparáveis em curadoria'
    const marketConfidenceText = marketHistory.comparableCount
        ? `Confiança ${marketHistory.confidenceLabel.toLowerCase()}`
        : 'Confiança em formação'
    const marketShortPositionText = marketHistory.deltaToMedian === null
        ? 'A base de comparáveis ainda está em formação para este imóvel.'
        : Math.abs(marketHistory.deltaToMedian) < 0.1
        ? 'Este imóvel está alinhado à média dos imóveis semelhantes na região.'
        : `Este imóvel está ${Math.abs(marketHistory.deltaToMedian).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% ${marketHistory.deltaToMedian > 0 ? 'acima' : 'abaixo'} da média dos imóveis semelhantes na região.`
    const marketComparableReadingText = marketHistory.comparableCount
        ? `Analisamos ${marketComparableText.toLowerCase()} para esta leitura.`
        : 'A leitura será refinada conforme novos comparáveis entrarem na base.'
    const marketPreferredAreaRange = marketHistory.currentArea
        ? `${Math.round(marketHistory.currentArea * 0.7).toLocaleString('pt-BR')} a ${Math.round(marketHistory.currentArea * 1.3).toLocaleString('pt-BR')} m² preferenciais`
        : 'Área sob consulta'
    const marketAnalysisDateLabel = formatMarketDate(new Date().toISOString())
    const marketAdvancedRows = [
        ['Cidade e bairro usados', locationLabel || displayCity || 'Litoral SC'],
        ['Raio geográfico', 'Sem raio fixo; prioriza bairro, cidade e proximidade geográfica.'],
        ['Tipologia considerada', property.property_type || 'Tipo equivalente'],
        ['Faixa de área', marketPreferredAreaRange],
        ['Anúncios brutos avaliados', marketHistory.rawComparableCount ? `${marketHistory.rawComparableCount.toLocaleString('pt-BR')} ativos` : 'Em curadoria'],
        ['Comparáveis válidos', marketHistory.comparableCount ? `${marketHistory.comparableCount.toLocaleString('pt-BR')} imóveis` : 'Sem base suficiente'],
        ['Extremos removidos', `${marketHistory.outlierCount.toLocaleString('pt-BR')} registros`],
        ['Data da análise', marketAnalysisDateLabel],
        ['Nível de confiança', marketHistory.confidenceLabel],
    ]
    const renderMarketComparison = (variant: 'desktop' | 'mobile') => (
        <div className={`plp-market-comparison plp-market-comparison--${variant}`}>
            <article className="plp-market-model-card">
                <div className="plp-market-model-head">
                    <div>
                        <h3>Análise de preço e posicionamento de mercado</h3>
                        <p>{marketComparableText} · {marketConfidenceText}</p>
                    </div>
                    <span className={`plp-market-position-badge plp-market-position-badge--${marketDifferenceTone}`}>
                        {marketPosition.title}
                    </span>
                </div>

                <div className="plp-market-model-grid">
                    <article className="plp-market-model-price">
                        <span>Valor anunciado</span>
                        <strong>{marketFullPriceLabel}</strong>
                        <small>{marketFullPriceM2Label}</small>
                    </article>

                    <article className="plp-market-model-reading">
                        <ul>
                            <li>{marketShortPositionText}</li>
                            <li>{marketComparableReadingText}</li>
                        </ul>
                        <a href="#market-analysis-details">Entenda a análise</a>
                    </article>

                    <article className="plp-market-model-median">
                        <span>
                            Média da região
                            <MarketTooltip label="Média da região">
                                Usamos a mediana dos imóveis comparáveis para reduzir distorções de anúncios muito altos ou muito baixos.
                            </MarketTooltip>
                        </span>
                        <strong>{marketFullMedianM2Label}</strong>
                        <small>{marketMedianTotal ? formatMoney(Math.round(marketMedianTotal)) : 'Sem valor total'}</small>
                    </article>

                    <article className={`plp-market-model-difference plp-market-model-difference--${marketDifferenceTone}`}>
                        <span>Diferença</span>
                        <strong>{marketHistory.deltaToMedian === null ? 'Em análise' : formatNeutralPercent(marketHistory.deltaToMedian)}</strong>
                        <small>{formatSignedCompactMoney(marketDifferenceMoney)}</small>
                    </article>

                </div>
            </article>

            <section className="plp-market-advisor-cta">
                <div className="plp-market-advisor-profile">
                    <div className="plp-market-advisor-avatar">
                        <PropertyBrokerAvatar
                            image={brokerCardImage}
                            name={brokerCardName}
                            lookupSlug={brokerCardPhotoLookupSlug}
                        />
                    </div>
                    <div>
                        <h3>Quer entender se este imóvel combina com o seu momento?</h3>
                        <p>Fale diretamente com {brokerCardName} e receba informações sobre disponibilidade, condições e visita exclusiva.</p>
                    </div>
                </div>
                <div className="plp-market-advisor-actions">
                    <WhatsAppCaptureLink
                        phone={contactPhone}
                        message={`Olá, quero entender a análise de preço deste imóvel: ${propertyUrl}`}
                        slug="imovel"
                        template="property-market-analysis-whatsapp"
                        metadata={{
                            ...propertyTrackingMetadata,
                            tracking_event_type: 'property_market_analysis_contact',
                            cta_context: 'market_analysis',
                            cta_label: 'Falar no WhatsApp',
                        }}
                        className="plp-market-advisor-button plp-market-advisor-button--primary"
                    >
                        <MessageCircle size={16} />
                        Falar no WhatsApp
                    </WhatsAppCaptureLink>
                    <WhatsAppCaptureLink
                        phone={contactPhone}
                        message={`Olá, quero agendar uma visita exclusiva para este imóvel: ${propertyUrl}`}
                        slug="imovel"
                        template="property-market-analysis-visit"
                        metadata={{
                            ...propertyTrackingMetadata,
                            tracking_event_type: 'property_visit_requested',
                            cta_context: 'market_analysis',
                            cta_label: 'Agendar visita',
                        }}
                        className="plp-market-advisor-button plp-market-advisor-button--secondary"
                    >
                        <Clock3 size={16} />
                        Agendar visita
                    </WhatsAppCaptureLink>
                </div>
            </section>

            <details id="market-analysis-details" className="plp-market-analysis-details">
                <summary>Ver detalhes da análise</summary>
                <div className="plp-market-analysis-details-body">
                    <article className="plp-market-meaning-card">
                        <h3>
                            <TrendingUp size={16} />
                            O que isso significa?
                        </h3>
                        <p>{marketPosition.interpretation}</p>
                        <small>O sistema compara preços anunciados e não substitui uma avaliação imobiliária profissional.</small>
                    </article>

                    <article className="plp-market-listing-history">
                        <h3>
                            <Clock3 size={16} />
                            Histórico do anúncio
                        </h3>
                        <dl>
                        <div>
                            <dt>Publicado em</dt>
                            <dd>{formatMarketDate(simplePriceHistory.publishedAt)}</dd>
                        </div>
                        <div>
                            <dt>Última atualização</dt>
                            <dd>{formatMarketDate(simplePriceHistory.updatedAt)}</dd>
                        </div>
                        <div>
                            <dt>Preço atual</dt>
                            <dd>{formatCompactMoney(simplePriceHistory.currentPrice)}</dd>
                        </div>
                        <div>
                            <dt>Variação desde a publicação</dt>
                            <dd>{formatNeutralPercent(simplePriceHistory.variation)}</dd>
                        </div>
                        </dl>
                        {simplePriceHistory.hasPriceChange ? (
                            <div className="plp-market-price-timeline" aria-label="Linha do tempo de preço">
                                <span>
                                    <small>Preço inicial</small>
                                    <strong>{formatCompactMoney(simplePriceHistory.initialPrice)}</strong>
                                </span>
                                {simplePriceHistory.timeline.map((event, index) => (
                                    <span key={`${event.date}-${index}`}>
                                        <small>{event.date}</small>
                                        <strong>{formatCompactMoney(event.nextPrice)}</strong>
                                    </span>
                                ))}
                                <span>
                                    <small>Preço atual</small>
                                    <strong>{formatCompactMoney(simplePriceHistory.currentPrice)}</strong>
                                </span>
                            </div>
                        ) : (
                            <p>O preço anunciado não foi alterado desde a publicação.</p>
                        )}
                    </article>

                    <div className="plp-market-analysis-facts">
                        {marketAdvancedRows.map(([label, value]) => (
                            <div key={label}>
                                <span>{label}</span>
                                <strong>{value}</strong>
                            </div>
                        ))}
                    </div>
                    <div className="plp-market-analysis-method">
                        <h3>Critérios de semelhança e metodologia</h3>
                        <ul>
                            {marketHistory.criteriaSummary.map(item => (
                                <li key={item}>{item}</li>
                            ))}
                            <li>{marketHistory.calculationSummary}</li>
                            {marketHistory.disclaimers.map(item => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            </details>
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
    const developmentActionMessage = developmentContext
        ? `Olá! Vi o imóvel ${displayTitle} e quero confirmar o condomínio ${developmentContext.name}, disponibilidade e alternativas relacionadas. ${propertyUrl}`
        : ''
    const developmentActionMetadata = developmentContext ? {
        ...propertyTrackingMetadata,
        development_name: developmentContext.name,
        development_slug: developmentContext.slug || null,
        cta_context: developmentHref ? 'property_development_context_link' : 'property_development_context_consult',
        tracking_event_type: developmentHref ? 'property_development_page_opened' : 'property_development_consult_requested',
    } : {}
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
                                    <div className="plp-mobile-development-features" aria-label="Características do condomínio">
                                        {projectItems.slice(0, 5).map((item) => (
                                            <span key={item}>
                                                <CheckCircle2 size={13} />
                                                {item}
                                            </span>
                                        ))}
                                        {projectItems.length > 5 && (
                                            <span>
                                                <CheckCircle2 size={13} />
                                                +{projectItems.length - 5} itens
                                            </span>
                                        )}
                                    </div>
                                )}
                                <div className="plp-mobile-development-actions">
                                    {developmentHref ? (
                                        <Link href={developmentHref}>
                                            Conhecer condomínio
                                            <ArrowRight size={15} />
                                        </Link>
                                    ) : (
                                        <WhatsAppCaptureLink
                                            phone={contactPhone}
                                            message={developmentActionMessage}
                                            slug={canonicalSegment}
                                            template="property-development-context"
                                            metadata={developmentActionMetadata}
                                        >
                                            Consultar condomínio
                                            <ArrowRight size={15} />
                                        </WhatsAppCaptureLink>
                                    )}
                                </div>
                            </section>
                        )}

                        <section className="plp-mobile-card plp-mobile-market-section">
                            <div className="plp-mobile-card-head">
                                <span className="plp-kicker">Mercado</span>
                                <h2>Preço e comparação de mercado.</h2>
                            </div>
                            {renderMarketComparison('mobile')}
                        </section>

                        {relatedPreview.length > 0 && (
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
                                    {relatedPreview.map((item: any) => {
                                        const image = item.featured_image || item.images?.[0] || DEFAULT_OG_IMAGE
                                        const itemArea = Number(item.area_private_m2 || item.area_m2 || 0)
                                        const itemSuites = Number(item.suites || item.bedrooms || 0)
                                        const itemParking = Number(item.parking_spaces || 0)
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
                                                    <h3>{relatedTitle}</h3>
                                                    <p>{relatedLocation || 'Litoral catarinense'}</p>
                                                    <strong>{formatMoney(item.price)}</strong>
                                                    <small>
                                                        {[
                                                            itemArea ? `${itemArea.toLocaleString('pt-BR')} m²` : null,
                                                            itemSuites ? `${itemSuites} ${statLabel(itemSuites, 'suíte', 'suítes')}` : null,
                                                            itemParking ? `${itemParking} ${statLabel(itemParking, 'vaga', 'vagas')}` : null,
                                                        ].filter(Boolean).join(' | ') || item.property_type || 'Imóvel'}
                                                    </small>
                                                </div>
                                            </Link>
                                        )
                                    })}
                                    <Link href={relatedSearchHref} className="plp-mobile-related-more-card">
                                        <ArrowRight size={20} />
                                        <span>Ver mais imóveis semelhantes</span>
                                    </Link>
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
                            <section className="plp-overview-combined-card" aria-label="Visão geral e ficha rápida do imóvel">
                                <div id="experiencia" className="plp-overview-copy-pane plp-copy-section">
                                    <span className="plp-kicker">Visão geral</span>
                                    <h2>{displayTitle}</h2>
                                    <div className="plp-narrative">
                                        {narrativeParagraphs.map((paragraph, index) => (
                                            <p key={index}>{paragraph}</p>
                                        ))}
                                    </div>
                                </div>

                                <div id="ficha" className="plp-overview-facts-pane plp-quick-facts-card">
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
                                </div>
                            </section>
                        </div>

                        {(developmentContext || showTechnicalLocationSection) && (
                            <div className={`plp-development-map-grid${!developmentContext || !showTechnicalLocationSection ? ' single' : ''}`}>
                                {developmentContext && (
                                    <section id="empreendimento-do-imovel" className="plp-section plp-development-context-band">
                                <div className="plp-development-context-copy">
                                    <h2>Conheça o condomínio {developmentContext.name}.</h2>
                                    {projectItems.length > 0 && (
                                        <div className="plp-development-context-feature-pills" aria-label="Características do condomínio">
                                            {projectItems.slice(0, 5).map((item) => (
                                                <span key={item} className="plp-development-context-feature-pill">
                                                    <CheckCircle2 size={14} />
                                                    {item}
                                                </span>
                                            ))}
                                            {projectItems.length > 5 && (
                                                <span className="plp-development-context-feature-pill">
                                                    <CheckCircle2 size={14} />
                                                    +{projectItems.length - 5} itens
                                                </span>
                                            )}
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
                                                {developmentHref ? (
                                                    <Link href={developmentHref} className="plp-development-primary-link">
                                                        Conhecer condomínio
                                                        <ArrowRight size={16} />
                                                    </Link>
                                                ) : (
                                                    <WhatsAppCaptureLink
                                                        phone={contactPhone}
                                                        message={developmentActionMessage}
                                                        slug={canonicalSegment}
                                                        template="property-development-context"
                                                        metadata={developmentActionMetadata}
                                                        className="plp-development-primary-link"
                                                    >
                                                        Consultar condomínio
                                                        <ArrowRight size={16} />
                                                    </WhatsAppCaptureLink>
                                                )}
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
                            </div>
                        )}

                            <section id="historico-precos" className="plp-section plp-market-history">
                                <div className="plp-market-grid">
                                    {renderMarketComparison('desktop')}
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

                        <div className="plp-side-card plp-google-rating-card" aria-label="Avaliação no Google">
                            <div className="plp-google-rating-avatar">
                                <PropertyBrokerAvatar
                                    image={brokerCardImage}
                                    name={brokerCardName}
                                    lookupSlug={brokerCardPhotoLookupSlug}
                                />
                            </div>
                            <div className="plp-google-rating-copy">
                                <span>Avaliação no Google</span>
                                <div>
                                    <strong>4,9</strong>
                                    <span className="plp-google-rating-stars" aria-label="5 estrelas">
                                        <Star size={15} fill="currentColor" />
                                        <Star size={15} fill="currentColor" />
                                        <Star size={15} fill="currentColor" />
                                        <Star size={15} fill="currentColor" />
                                        <Star size={15} fill="currentColor" />
                                    </span>
                                    <small>(128 avaliações)</small>
                                </div>
                            </div>
                            <svg className="plp-google-rating-logo" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
                                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
                                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.91-2.26 5.38-4.78 7.04l7.73 6c4.51-4.18 7.09-10.36 7.09-17.51Z" />
                                <path fill="#FBBC05" d="M10.53 28.59A14.47 14.47 0 0 1 9.75 24c0-1.59.28-3.14.78-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.86.92 7.5 2.56 10.78l7.97-6.19Z" />
                                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.94l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48Z" />
                                <path fill="none" d="M0 0h48v48H0z" />
                            </svg>
                        </div>

                        <div className="plp-side-card plp-lead-card">
                            <h3><MessageCircle size={18} /> Mais informações sobre este imóvel</h3>
                            <p>Envie seus dados para receber disponibilidade, condições e atendimento direto pelo WhatsApp.</p>
                            <PropertySidebarLeadForm
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
                            />
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

                {relatedPreview.length > 0 && (
                    <section className="plp-related-band">
                        <div className="plp-related-head">
                            <h2>Imóveis semelhantes</h2>
                        </div>
                        <div className="plp-related-grid">
                            {relatedPreview.map((item: any) => {
                                const image = item.featured_image || item.images?.[0] || DEFAULT_OG_IMAGE
                                const itemArea = Number(item.area_private_m2 || item.area_m2 || 0)
                                const itemSuites = Number(item.suites || item.bedrooms || 0)
                                const itemParking = Number(item.parking_spaces || 0)
                                const relatedLocation = buildDisplayLocationParts(item.neighborhood, item.city).join(' - ')
                                const relatedTitle = cleanRepeatedPraiaBravaText(item.title)
                                const itemQualityLabel = getPropertyPrimaryQualityLabel(item)
                                return (
                                    <Link key={item.id} href={propertyDetailsPath(item)} className="plp-related-card">
                                        <div className="plp-related-media">
                                            <img src={image} alt={relatedTitle} loading="lazy" />
                                            <span className={`plp-card-ribbon plp-card-ribbon-${itemQualityLabel.tone}`}>
                                                {itemQualityLabel.label}
                                            </span>
                                        </div>
                                        <div className="plp-related-body">
                                            <h3>{relatedTitle}</h3>
                                            <p>{relatedLocation || 'Litoral catarinense'}</p>
                                            <strong>{formatMoney(item.price)}</strong>
                                            <div className="plp-related-meta">
                                                {itemArea > 0 && <span>{itemArea.toLocaleString('pt-BR')} m²</span>}
                                                {itemSuites > 0 && <span>{itemSuites} {statLabel(itemSuites, 'suíte', 'suítes')}</span>}
                                                {itemParking > 0 && <span>{itemParking} {statLabel(itemParking, 'vaga', 'vagas')}</span>}
                                            </div>
                                        </div>
                                    </Link>
                                )
                            })}
                            <Link href={relatedSearchHref} className="plp-related-more-card">
                                <ArrowRight size={30} />
                                <span>Ver mais imóveis semelhantes</span>
                            </Link>
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
