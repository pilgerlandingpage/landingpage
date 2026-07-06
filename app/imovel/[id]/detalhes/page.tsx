import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { createAdminClient } from '@/lib/supabase/server'
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
import { GLOBAL_PROPERTY_WHATSAPP_PHONE, getResponsibleBrokerForProperty } from '@/lib/properties/responsible-broker'
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
    const sourceSlug = asSafeText(record.sourceSlug ?? record.source_slug)
    const type = asSafeText(record.type, 'Unidade')
    const title = asSafeText(record.title, type)
    if (!sourceSlug || !title) return null

    return {
        title,
        type,
        area: asSafeText(record.area, 'Area sob consulta'),
        suites: asSafeText(record.suites, 'Configuracao sob consulta'),
        price: asSafeText(record.price, 'Consulte'),
        sourceSlug,
    }
}

function locationLabelFromProperty(property: any) {
    return [...buildDisplayLocationParts(property?.neighborhood, property?.city), property?.state]
        .filter(Boolean)
        .join(' - ')
}

async function getPropertyByIdentifier<T = any>(identifier: string, select = '*'): Promise<T | null> {
    const supabase = createAdminClient()
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

async function getPropertyDevelopmentContext(supabase: any, property: any): Promise<PropertyDevelopmentContext | null> {
    const propertySourceSlug = normalizeSourceSlugKey(property?.source_slug)
    if (!propertySourceSlug) return null

    const { data, error } = await supabase
        .from('landing_pages')
        .select('id, slug, title, content, created_at')
        .eq('status', 'published')
        .order('created_at', { ascending: true })

    if (error) {
        console.warn('[Property Detail] development context unavailable:', error.message)
        return null
    }

    for (const page of data || []) {
        const content = asSafeRecord(page.content)
        const development = asSafeRecord(content.development)
        const units = Array.isArray(development.units)
            ? development.units.map(normalizeDevelopmentUnitContext).filter((unit): unit is PropertyDevelopmentUnitContext => Boolean(unit))
            : []
        const matchedUnit = units.find((unit) => normalizeSourceSlugKey(unit.sourceSlug) === propertySourceSlug)

        if (!matchedUnit) continue

        const name = asSafeText(development.name, asSafeText(content.custom_title, asSafeText(page.title, 'Empreendimento')))
        const heroImage = asSafeText(development.heroImage ?? development.hero_image ?? content.custom_hero_image, property.featured_image || property.images?.[0] || DEFAULT_OG_IMAGE)
        const developmentGallery = Array.isArray(development.gallery)
            ? development.gallery.map((item: unknown) => normalizeDevelopmentGalleryItem(item, name)).filter((item): item is PropertyDevelopmentGalleryItem => Boolean(item))
            : []
        const customGallery = Array.isArray(content.custom_gallery)
            ? content.custom_gallery.map((item: unknown) => normalizeDevelopmentGalleryItem(item, name)).filter((item): item is PropertyDevelopmentGalleryItem => Boolean(item))
            : []
        const gallery = uniqueDevelopmentGallery([
            { image: heroImage, title: name, category: 'Empreendimento' },
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
            description: asSafeText(development.description, `Conheca o empreendimento ${name} e compare as unidades disponiveis antes da visita.`),
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
    const responsibleBroker = await getResponsibleBrokerForProperty(adminSupabase, property.id)
    const { count: propertyViewCountRaw, error: propertyViewCountError } = await adminSupabase
        .from('funnel_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', 'property_details_landing_viewed')
        .contains('metadata', { property_id: property.id })

    const { data: propertySaveEvents, error: propertySaveEventsError } = await adminSupabase
        .from('funnel_events')
        .select('id, visitor_id, event_type, created_at')
        .in('event_type', ['property_favorited', 'property_unfavorited'])
        .contains('metadata', { property_id: property.id })
        .order('created_at', { ascending: false })
        .limit(5000)

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
    const brokerFilterName = responsibleBroker.legacy_name || brokerCardName
    if (brokerFilterName) brokerPropertiesParams.set('broker', brokerFilterName)
    if (responsibleBroker.legacy_login) brokerPropertiesParams.set('brokerLogin', responsibleBroker.legacy_login)
    const brokerPropertiesQuery = brokerPropertiesParams.toString()
    const brokerPropertiesHref = brokerPropertiesQuery ? `/busca?${brokerPropertiesQuery}` : '/busca'
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

    const [relatedCandidates, priceHistoryEvents, developmentContext] = await Promise.all([
        getRelatedPropertyCandidates(supabase, property),
        fetchPropertyPriceHistory(adminSupabase, property.id),
        getPropertyDevelopmentContext(adminSupabase, property),
    ])
    const marketHistory = buildMarketHistory(property, relatedCandidates, area, locationLabel, priceHistoryEvents)
    const related = selectRelatedProperties(property, relatedCandidates)
    const marketTrackingMetadata = {
        ...propertyTrackingMetadata,
        section_id: 'historico-precos',
        section_label: 'Histórico e valor',
        location_label: locationLabel || null,
        current_price_m2: marketHistory.currentPriceM2 || null,
        median_m2: marketHistory.medianM2 || null,
        delta_to_median: marketHistory.deltaToMedian,
        comparable_count: marketHistory.comparableCount,
    }
    const contextualLeadCtas = [
        {
            label: 'Análise de valor',
            icon: <BarChart3 size={15} />,
            template: 'property-context-value-analysis',
            message: `Olá, quero receber a análise de valor deste imóvel ${propertyUrl}`,
            metadata: {
                ...marketTrackingMetadata,
                tracking_event_type: 'property_value_reading_requested',
                premium_intent: 'value_reading',
                requested_action: 'Receber leitura de valor',
                cta_context: 'value_analysis',
                cta_label: 'Análise de valor',
            },
        },
        {
            label: 'Visita na região',
            icon: <MapPin size={15} />,
            template: 'property-context-location-visit',
            message: `Olá, quero entender a localização e agendar uma visita deste imóvel ${propertyUrl}`,
            metadata: {
                ...propertyTrackingMetadata,
                tracking_event_type: 'property_private_visit_requested',
                premium_intent: 'private_visit',
                requested_action: 'Agendar visita privada',
                section_id: 'localizacao',
                section_label: 'Localização',
                location_label: locationLabel || null,
                has_coordinates: Boolean(propertyMapLatLng),
                cta_context: 'location_visit',
                cta_label: 'Visita na região',
            },
        },
        {
            label: 'Negociação reservada',
            icon: <CheckCircle2 size={15} />,
            template: 'property-context-reserved-negotiation',
            message: `Olá, quero tratar disponibilidade e negociação reservada deste imóvel ${propertyUrl}`,
            metadata: {
                ...propertyTrackingMetadata,
                tracking_event_type: 'property_reserved_negotiation_requested',
                premium_intent: 'reserved_negotiation',
                requested_action: 'Iniciar negociação reservada',
                cta_context: 'reserved_negotiation',
                cta_label: 'Negociação reservada',
            },
        },
        {
            label: 'Comparar similares',
            icon: <Home size={15} />,
            template: 'property-context-similar-options',
            message: `Olá, quero comparar este imóvel com opções semelhantes ${propertyUrl}`,
            metadata: {
                ...propertyTrackingMetadata,
                tracking_event_type: 'property_availability_requested',
                premium_intent: 'availability',
                requested_action: 'Comparar opções e disponibilidade',
                section_id: 'imoveis-semelhantes',
                section_label: 'Imóveis semelhantes',
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
    const developmentCtaMessage = developmentContext
        ? `Ola, vi este imovel e quero conhecer o empreendimento ${developmentContext.name}: ${absoluteUrl(developmentHref || propertyPath)}`
        : ''
    const developmentGalleryPreview = developmentContext?.gallery?.length
        ? developmentContext.gallery
        : developmentContext
            ? [{ image: developmentContext.heroImage, title: developmentContext.name, category: 'Empreendimento' }]
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

                        <section id="mobile-ficha" className="plp-mobile-card plp-mobile-card--technical">
                            <div className="plp-mobile-card-head plp-mobile-card-head--single-title">
                                <h2>Ficha técnica</h2>
                            </div>
                            <div className="plp-mobile-classic-lists">
                                <InfoList title="Detalhes do imóvel" items={detailItems} />
                                {featureItems.length > 0 && <InfoList title="Características do imóvel" items={featureItems} />}
                                {projectItems.length > 0 && <InfoList title="Características do empreendimento" items={projectItems} />}
                            </div>
                        </section>

                        <section className="plp-mobile-card plp-mobile-card--nearby">
                            <PropertyNearbyBenefits
                                propertyId={property.id}
                                title={displayTitle}
                                latLng={propertyMapLatLng}
                                locationLabel={locationLabel || mapLocation || displayCity}
                                variant="mobile"
                            />
                        </section>

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
                            <div className="plp-mobile-market-chart" aria-label="Gráfico de posicionamento do preço por metro quadrado">
                                <svg viewBox="0 0 100 44" preserveAspectRatio="none">
                                    <path d="M0 36 H100" />
                                    {marketHistory.chartPoints && <polyline points={marketHistory.chartPoints} />}
                                    <line x1={marketHistory.position} x2={marketHistory.position} y1="6" y2="39" />
                                    <circle cx={marketHistory.position} cy="12" r="2.6" />
                                </svg>
                                <div className="plp-mobile-market-axis">
                                    <span>Entrada</span>
                                    <span>Mediana</span>
                                    <span>Topo</span>
                                </div>
                            </div>
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

                        {developmentContext && (
                            <section className="plp-mobile-card plp-mobile-development-section" aria-labelledby="mobile-empreendimento-title">
                                <div className="plp-mobile-card-head">
                                    <span className="plp-kicker">Empreendimento</span>
                                    <h2 id="mobile-empreendimento-title">Conheca o {developmentContext.name}.</h2>
                                </div>
                                <div className="plp-mobile-development-gallery">
                                    {developmentGalleryPreview.slice(0, 4).map((item, index) => (
                                        <figure key={`${item.image}-${index}`}>
                                            <img src={item.image} alt={`${developmentContext.name} - ${item.title}`} loading={index === 0 ? 'eager' : 'lazy'} />
                                            <figcaption>{index === 0 ? 'Empreendimento' : item.category}</figcaption>
                                        </figure>
                                    ))}
                                </div>
                                <p className="plp-mobile-development-copy">
                                    Este imovel faz parte do {developmentContext.name}. Veja imagens, contexto do empreendimento e unidades disponiveis antes de conversar com o especialista.
                                </p>
                                <div className="plp-mobile-development-facts">
                                    <span><MapPin size={14} /> {developmentContext.locationName}</span>
                                    <span><Home size={14} /> {developmentContext.availableUnitsCount ? `${developmentContext.availableUnitsCount} unidades` : 'Unidades sob consulta'}</span>
                                    <span><BarChart3 size={14} /> {developmentContext.priceRange}</span>
                                    <span><Ruler size={14} /> {developmentContext.areaRange}</span>
                                </div>
                                <div className="plp-mobile-development-actions">
                                    <Link href={developmentHref || '/busca'}>
                                        Conhecer empreendimento
                                        <ArrowRight size={15} />
                                    </Link>
                                    <WhatsAppCaptureLink
                                        phone={contactPhone}
                                        message={developmentCtaMessage}
                                        slug="imovel"
                                        template="property-development-context-mobile"
                                        metadata={{
                                            ...propertyTrackingMetadata,
                                            tracking_event_type: 'property_development_context_requested',
                                            section_id: 'empreendimento-do-imovel',
                                            section_label: 'Empreendimento do imovel',
                                            development_slug: developmentContext.slug,
                                            development_name: developmentContext.name,
                                            cta_context: 'property_development_mobile',
                                            cta_label: 'Falar sobre empreendimento',
                                        }}
                                    >
                                        Falar com especialista
                                    </WhatsAppCaptureLink>
                                </div>
                            </section>
                        )}

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
                                <img src={brokerCardImage} alt={brokerCardName} />
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
                                Ver imóveis do especialista
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
                        <section id="experiencia" className="plp-section plp-copy-section">
                            <span className="plp-kicker">Visão geral</span>
                            <h2>{displayTitle}</h2>
                            <div className="plp-narrative">
                                {narrativeParagraphs.map((paragraph, index) => (
                                    <p key={index}>{paragraph}</p>
                                ))}
                            </div>
                        </section>

                        <section id="ficha" className="plp-section">
                            <div className="plp-section-head">
                                <span className="plp-kicker">Ficha rápida</span>
                            </div>
                            <div className="plp-spec-grid">
                                {area > 0 && <SpecCard icon={<Ruler size={21} />} label="Área" value={`${area.toLocaleString('pt-BR')} m²`} />}
                                {suiteCount > 0 && <SpecCard icon={<BedDouble size={21} />} label="Configuração" value={`${suiteCount} ${statLabel(suiteCount, 'suíte', 'suítes')}`} />}
                                {bathroomsCount > 0 && <SpecCard icon={<Bath size={21} />} label="Banheiros" value={String(bathroomsCount)} />}
                                {parkingCount > 0 && <SpecCard icon={<Car size={21} />} label="Garagem" value={`${parkingCount} ${statLabel(parkingCount, 'vaga', 'vagas')}`} />}
                                <SpecCard icon={<MapPin size={21} />} label="Localização" value={locationLabel || displayCity || 'Litoral SC'} />
                            </div>
                            <div className="plp-classic-lists plp-classic-lists--before-nearby">
                                <InfoList title="Detalhes do imóvel" items={detailItems} />
                                {featureItems.length > 0 && <InfoList title="Características do imóvel" items={featureItems} />}
                                {projectItems.length > 0 && <InfoList title="Características do empreendimento" items={projectItems} />}
                            </div>
                            <PropertyNearbyBenefits
                                propertyId={property.id}
                                title={displayTitle}
                                latLng={propertyMapLatLng}
                                locationLabel={locationLabel || mapLocation || displayCity}
                            />
                        </section>

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

                                <article className="plp-market-card plp-price-history-card">
                                    <div className="plp-market-card-head">
                                        <span>Histórico de preço</span>
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

                        {developmentContext && (
                            <section id="empreendimento-do-imovel" className="plp-section plp-development-context-band">
                                <div className="plp-development-context-copy">
                                    <span className="plp-kicker">Empreendimento vinculado</span>
                                    <h2>Este imovel faz parte do {developmentContext.name}.</h2>
                                    <p>
                                        Conheca o empreendimento completo, veja imagens do projeto e compare as unidades disponiveis antes de decidir a visita.
                                    </p>
                                    <div className="plp-development-context-facts">
                                        <span><MapPin size={15} /> {developmentContext.locationName}</span>
                                        <span><Home size={15} /> {developmentContext.availableUnitsCount ? `${developmentContext.availableUnitsCount} unidades ativas` : 'Unidades sob consulta'}</span>
                                        <span><BarChart3 size={15} /> {developmentContext.priceRange}</span>
                                        <span><Ruler size={15} /> {developmentContext.areaRange}</span>
                                        <span><BedDouble size={15} /> {developmentContext.suitesRange}</span>
                                    </div>
                                    <div className="plp-development-context-unit">
                                        <small>Unidade relacionada</small>
                                        <strong>{developmentContext.unit.title}</strong>
                                        <span>{developmentContext.unit.area} | {developmentContext.unit.suites} | {developmentContext.unit.price}</span>
                                    </div>
                                    <div className="plp-development-context-actions">
                                        <Link href={developmentHref || '/busca'} className="plp-development-primary-link">
                                            Conhecer empreendimento
                                            <ArrowRight size={16} />
                                        </Link>
                                        <WhatsAppCaptureLink
                                            phone={contactPhone}
                                            message={developmentCtaMessage}
                                            slug="imovel"
                                            template="property-development-context"
                                            metadata={{
                                                ...propertyTrackingMetadata,
                                                tracking_event_type: 'property_development_context_requested',
                                                section_id: 'empreendimento-do-imovel',
                                                section_label: 'Empreendimento do imovel',
                                                development_slug: developmentContext.slug,
                                                development_name: developmentContext.name,
                                                cta_context: 'property_development_desktop',
                                                cta_label: 'Falar sobre empreendimento',
                                            }}
                                            className="plp-development-secondary-link"
                                        >
                                            Falar sobre o empreendimento
                                        </WhatsAppCaptureLink>
                                    </div>
                                </div>
                                <div className="plp-development-context-gallery" aria-label={`Imagens do empreendimento ${developmentContext.name}`}>
                                    {developmentGalleryPreview.slice(0, 5).map((item, index) => (
                                        <figure key={`${item.image}-${index}`}>
                                            <img src={item.image} alt={`${developmentContext.name} - ${item.title}`} loading={index === 0 ? 'eager' : 'lazy'} />
                                            <figcaption>
                                                <span>{index === 0 ? 'Empreendimento' : item.category}</span>
                                                <strong>{item.title}</strong>
                                            </figcaption>
                                        </figure>
                                    ))}
                                </div>
                            </section>
                        )}

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
