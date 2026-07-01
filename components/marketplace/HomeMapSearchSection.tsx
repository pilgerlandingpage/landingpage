'use client'

import {
    Bed,
    Building2,
    Car,
    ChevronLeft,
    Crown,
    Filter,
    Home,
    MapPin,
    Maximize,
    RotateCcw,
    Search,
    Sparkles,
    Waves,
    X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import HomeSearchBar, { type HomeSearchValues } from './HomeSearchBar'
import MapSearch from './MapSearch'
import MapPropertyPreviewCard from './MapPropertyPreviewCard'
import { orderPropertiesBySmoothGeoPath } from './mapRecommendationOrder'
import type { MapDrawArea, MapFixedView } from './PropertyMap'
import { searchLocationName } from '@/lib/locations/display'
import { findMapRegionByText } from '@/lib/locations/map-regions'
import { appendNaturalSearchParams } from '@/lib/properties/natural-search'
import { trackEvent } from '@/lib/tracking/client'

type MapPreviewProperty = Parameters<NonNullable<ComponentProps<typeof MapPropertyPreviewCard>['onPropertySelect']>>[0]

type Property = {
    id: string
    source_slug?: string | null
    title: string
    city: string | null
    state: string | null
    neighborhood?: string | null
    price: number | null
    rent?: number | null
    purpose?: string | null
    property_type?: string | null
    latitude?: number | string | null
    longitude?: number | string | null
    featured_image?: string | null
    bedrooms?: number | null
    bathrooms?: number | null
    suites?: number | null
    parking_spaces?: number | null
    area_m2?: number | null
    area_private_m2?: number | null
    description?: string | null
    source_status?: string | null
    exclusive?: boolean | null
    images?: string[] | null
    video_url?: string | null
}

type AppliedFilters = {
    query: string
    type: string
    price: string
    purpose: 'sale' | 'rent'
    chips: string[]
}

type StepOption = {
    value: string
    label: string
    shortLabel?: string
}

type MobileFilterKey = 'location' | 'type' | 'price' | 'purpose'

type MobileFilterConfig = {
    id: MobileFilterKey
    label: string
    question: string
    icon: ReactNode
    options: StepOption[]
    value: string
    onChange: (value: string) => void
}

type FeatureFilter = {
    id: string
    label: string
    param: string
    value: string
    icon: typeof Bed
    matches: (property: Property) => boolean
}

const MINIMUM_FIRST_CONTACT_PRICE = 4000000
const HOME_MAP_PREVIEW_LIMIT = 8
const GUIDED_SEARCH_STORAGE_KEY = 'pilger_guided_search_seen_v1'
const OFFICE_SEARCH_PARAM_VALUE = '1'

const GUIDED_SEARCH_MESSAGES: Record<MobileFilterKey, { title: string; choose: string; next: string }> = {
    location: {
        title: 'Comece pela região',
        choose: 'Escolha uma cidade para começar sua curadoria.',
        next: 'Boa escolha. Agora toque em Próximo para passar ao tipo de imóvel.',
    },
    type: {
        title: 'Agora o tipo de imóvel',
        choose: 'Apartamento, casa, cobertura ou comercial: escolha o perfil que faz sentido para você.',
        next: 'Perfeito. Toque em Próximo para ajustar a faixa de valor.',
    },
    price: {
        title: 'Defina o orçamento',
        choose: 'Arraste ou toque na faixa de valor para deixar a busca mais certeira.',
        next: 'Valor definido. Toque em Próximo para a última escolha.',
    },
    purpose: {
        title: 'Última escolha',
        choose: 'Confirme se a busca é para compra ou aluguel. Depois eu abro a seleção certa.',
        next: 'Tudo pronto. Toque no botão de imóveis para ver os resultados.',
    },
}

const LOCATION_STEPS: StepOption[] = [
    { value: 'Balneário Camboriú', label: 'B. Camboriú', shortLabel: 'B. Camboriú' },
    { value: 'Praia Brava', label: 'Praia Brava', shortLabel: 'Praia Brava' },
    { value: 'Itapema', label: 'Itapema', shortLabel: 'Itapema' },
    { value: 'Porto Belo', label: 'Porto Belo', shortLabel: 'Porto Belo' },
]
const DEFAULT_LOCATION = LOCATION_STEPS[0]?.value || ''
const OFFICE_LOCATION_MARKER = {
    latLng: [-26.95665680834595, -48.62979654548911] as [number, number],
    title: 'Imobiliária Guilherme Pilger',
    subtitle: 'Praia Brava',
    address: 'Av. Carlos Drummond de Andrade, 33 - Loja 01 - Praia Brava, Itajaí - SC, 88306-800',
}
const HOME_LOCKED_MAP_VIEW: MapFixedView = {
    center: [-26.945, -48.585],
    zoom: 12,
    mobileCenter: [-26.9567, -48.655],
    mobileZoom: 12,
}
const TYPE_STEPS: StepOption[] = [
    { value: 'all', label: 'Todos', shortLabel: 'Todos' },
    { value: 'Apartamento', label: 'Apartamento', shortLabel: 'Apto' },
    { value: 'Casa', label: 'Casa', shortLabel: 'Casa' },
    { value: 'Cobertura', label: 'Cobertura', shortLabel: 'Cob.' },
    { value: 'Comercial', label: 'Comercial', shortLabel: 'Com.' },
]

const PRICE_PRESETS = [
    { value: '', label: 'Todos', shortLabel: 'Todos' },
    { value: '4000000-6000000', label: 'R$ 4 mi a R$ 6 mi', shortLabel: '4-6 mi' },
    { value: '6000000-8000000', label: 'R$ 6 mi a R$ 8 mi', shortLabel: '6-8 mi' },
    { value: '8000000-10000000', label: 'R$ 8 mi a R$ 10 mi', shortLabel: '8-10 mi' },
    { value: '10000000-', label: 'Acima de R$ 10 mi', shortLabel: '10 mi+' },
]

const PURPOSE_STEPS: StepOption[] = [
    { value: 'sale', label: 'Venda', shortLabel: 'Venda' },
    { value: 'rent', label: 'Aluguel', shortLabel: 'Aluguel' },
]

const FEATURE_FILTERS: FeatureFilter[] = [
    {
        id: '3-dormitorios',
        label: '3 dormitórios',
        param: 'bedroomsMin',
        value: '3',
        icon: Bed,
        matches: property => Number(property.bedrooms || 0) >= 3,
    },
    {
        id: '2-suites',
        label: '2 suítes',
        param: 'suitesMin',
        value: '2',
        icon: Waves,
        matches: property => Number(property.suites || 0) >= 2,
    },
    {
        id: '2-vagas',
        label: '2 vagas',
        param: 'parkingMin',
        value: '2',
        icon: Car,
        matches: property => Number(property.parking_spaces || 0) >= 2,
    },
    {
        id: '150m2',
        label: '150 m²+',
        param: 'areaMin',
        value: '150',
        icon: Maximize,
        matches: property => Number(property.area_m2 || 0) >= 150,
    },
    {
        id: 'frente-mar',
        label: 'Frente mar',
        param: 'tag',
        value: 'frente-mar',
        icon: Sparkles,
        matches: property => {
            const text = normalize(`${property.title || ''} ${property.description || ''} ${property.property_type || ''}`)
            return text.includes('frente') && text.includes('mar')
        },
    },
    {
        id: 'alto-padrao',
        label: 'Alto padrão',
        param: 'priceMin',
        value: '5000000',
        icon: Crown,
        matches: property => Number(property.price || 0) >= 5000000,
    },
    {
        id: 'lancamentos',
        label: 'Lançamentos',
        param: 'tag',
        value: 'lancamento',
        icon: Sparkles,
        matches: property => {
            const text = normalize(`${property.title || ''} ${property.description || ''} ${property.source_status || ''}`)
            return text.includes('lancamento') || text.includes('construcao') || text.includes('na planta')
        },
    },
    {
        id: 'coberturas',
        label: 'Coberturas',
        param: 'subtype',
        value: 'cobertura',
        icon: Building2,
        matches: property => normalize(`${property.property_type || ''} ${property.title || ''}`).includes('cobertura'),
    },
    {
        id: 'condominio',
        label: 'Condomínio',
        param: 'subtype',
        value: 'condominio',
        icon: Home,
        matches: property => normalize(`${property.property_type || ''} ${property.title || ''}`).includes('condom'),
    },
    {
        id: 'mobiliado',
        label: 'Mobiliado',
        param: 'tag',
        value: 'mobiliado',
        icon: Sparkles,
        matches: property => normalize(`${property.title || ''} ${property.description || ''}`).includes('mobiliad'),
    },
]

function normalize(value: unknown) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
}

function toCoordinate(value: number | string | null | undefined) {
    if (typeof value === 'string') return Number(value.replace(',', '.'))
    return Number(value)
}

function isInsideServiceArea(nextLat: number, nextLng: number) {
    return (
        Number.isFinite(nextLat) &&
        Number.isFinite(nextLng) &&
        nextLat >= -30.5 &&
        nextLat <= -25.0 &&
        nextLng >= -54.5 &&
        nextLng <= -47.0
    )
}

function getHomeMapLatLng(property: Property): [number, number] | null {
    const lat = toCoordinate(property.latitude)
    const lng = toCoordinate(property.longitude)

    if (isInsideServiceArea(lat, lng)) return [lat, lng]
    if (isInsideServiceArea(lng, lat)) return [lng, lat]
    return null
}

function hasHomeMapCoordinate(property: Property) {
    return Boolean(getHomeMapLatLng(property))
}

function hasCoordinates(property: Property) {
    return hasHomeMapCoordinate(property)
}

function isPointInsideDrawArea(point: [number, number], drawArea: MapDrawArea) {
    if (!drawArea || drawArea.length < 3) return true

    const [lat, lng] = point
    let inside = false

    for (let index = 0, previous = drawArea.length - 1; index < drawArea.length; previous = index++) {
        const [currentLat, currentLng] = drawArea[index]
        const [previousLat, previousLng] = drawArea[previous]
        const crossesLatitude = currentLat > lat !== previousLat > lat
        const projectedLng = ((previousLng - currentLng) * (lat - currentLat)) / ((previousLat - currentLat) || Number.EPSILON) + currentLng

        if (crossesLatitude && lng < projectedLng) inside = !inside
    }

    return inside
}

function filterHomePropertiesByDrawArea(properties: Property[], drawArea: MapDrawArea | null) {
    if (!drawArea || drawArea.length < 3) return properties

    return properties.filter(property => {
        const latLng = getHomeMapLatLng(property)
        return latLng ? isPointInsideDrawArea(latLng, drawArea) : false
    })
}

function filterHomePropertiesByRegionArea(properties: Property[], regionArea: ReturnType<typeof findMapRegionByText>) {
    if (!regionArea?.area || regionArea.area.length < 3) return properties

    return properties.filter(property => {
        const latLng = getHomeMapLatLng(property)
        return latLng ? isPointInsideDrawArea(latLng, regionArea.area) : false
    })
}

function matchesMinimumFirstContactPrice(property: Property) {
    return Number(property.price || property.rent || 0) >= MINIMUM_FIRST_CONTACT_PRICE
}

function normalizeTypeMatchText(value: unknown) {
    return normalize(value)
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function hasTypeToken(text: string, token: string) {
    return text.split(' ').includes(token)
}

function hasTypeTokenPrefix(text: string, prefix: string) {
    return text.split(' ').some(token => token.startsWith(prefix))
}

function matchesType(property: Property, type: string) {
    if (type === 'all') return true
    const propertyTypeText = normalizeTypeMatchText(property.property_type)
    const titleText = normalizeTypeMatchText(property.title)
    const text = `${propertyTypeText} ${titleText}`.trim()

    if (type === 'Apartamento') return hasTypeToken(propertyTypeText, 'apartamento')
    if (type === 'Casa') return hasTypeToken(propertyTypeText, 'casa')
    if (type === 'Terreno') return hasTypeToken(propertyTypeText, 'terreno')
    if (type === 'Comercial') return ['comercial', 'galpao', 'sala', 'predio'].some(term => hasTypeTokenPrefix(text, term))
    if (type === 'Casa em Condomínio') return (
        hasTypeToken(propertyTypeText, 'casa') && hasTypeTokenPrefix(propertyTypeText, 'cond')
    ) || (
        hasTypeToken(titleText, 'casa') && hasTypeTokenPrefix(titleText, 'cond')
    )
    if (type === 'Duplex / Triplex') return hasTypeToken(text, 'duplex') || hasTypeToken(text, 'triplex')
    if (type === 'Galpão / Depósito') return hasTypeTokenPrefix(text, 'galpao') || hasTypeTokenPrefix(text, 'deposito')
    if (type === 'Terreno em Condomínio') return (
        hasTypeToken(propertyTypeText, 'terreno') && hasTypeTokenPrefix(propertyTypeText, 'cond')
    ) || (
        hasTypeToken(titleText, 'terreno') && hasTypeTokenPrefix(titleText, 'cond')
    )
    if (type === 'Terreno Comercial') return (
        hasTypeToken(propertyTypeText, 'terreno') && hasTypeToken(propertyTypeText, 'comercial')
    ) || (
        hasTypeToken(titleText, 'terreno') && hasTypeToken(titleText, 'comercial')
    )
    if (type === 'Sala Comercial') return (
        hasTypeToken(propertyTypeText, 'sala') && hasTypeToken(propertyTypeText, 'comercial')
    ) || (
        hasTypeToken(titleText, 'sala') && hasTypeToken(titleText, 'comercial')
    )

    return text.includes(normalizeTypeMatchText(type))
}

function mapOverlayTypeToMapFilter(value: string) {
    if (!value || value === 'all') return 'all'

    const [kind, rawValue] = value.split(':')
    if (!rawValue) return value
    if (kind === 'type') return rawValue

    const subtypeLabels: Record<string, string> = {
        cobertura: 'Cobertura',
        condominio: 'Casa em Condomínio',
        duplex: 'Duplex / Triplex',
        galpao: 'Galpão / Depósito',
        garden: 'Garden',
        'predio-residencial': 'Prédio',
        'sala-comercial': 'Sala Comercial',
        'terreno-comercial': 'Terreno Comercial',
        'terreno-condominio': 'Terreno em Condomínio',
    }

    return subtypeLabels[rawValue] || rawValue
}

function getOverlaySearchLocation(values: HomeSearchValues) {
    return (values.locationType === 'office'
        ? values.locationLabel
        : values.locationValue || values.locationLabel
    ).trim()
}

function buildOverlaySearchDestination(values: HomeSearchValues, offer: AppliedFilters['purpose'], chips: string[]) {
    const params = new URLSearchParams()
    const nextLocation = getOverlaySearchLocation(values)

    if (values.locationType === 'office') {
        params.set('office', OFFICE_SEARCH_PARAM_VALUE)
    } else if (nextLocation) {
        appendNaturalSearchParams(params, nextLocation)
    }

    if (values.typeValue && values.typeValue !== 'all') {
        const [kind, rawValue] = values.typeValue.split(':')
        if (kind && rawValue) params.set(kind, rawValue)
        else params.set('type', mapOverlayTypeToMapFilter(values.typeValue))
    }

    if (values.priceValue && values.priceValue !== 'all') params.set('price', values.priceValue)
    if (offer) params.set('offer', offer)

    chips.forEach(chipId => {
        const option = FEATURE_FILTERS.find(item => item.id === chipId)
        if (!option) return
        if (option.param === 'priceMin') {
            const current = Number(params.get('priceMin') || 0)
            if (Number(option.value) > current) params.set(option.param, option.value)
            return
        }
        if (!params.has(option.param)) params.set(option.param, option.value)
    })

    const queryString = params.toString()
    return queryString ? `/busca?${queryString}` : '/busca'
}

function matchesPrice(property: Property, range: string) {
    const price = Number(property.price || property.rent || 0)
    if (!price || price < MINIMUM_FIRST_CONTACT_PRICE) return false
    if (!range) return true
    if (range === 'all') return true
    const [minRaw, maxRaw] = range.split('-')
    const min = Number(minRaw || 0)
    const max = Number(maxRaw || 0)
    if (min && price < min) return false
    if (max && price > max) return false
    return true
}

function matchesPurpose(property: Property, purpose: 'sale' | 'rent') {
    const text = normalize(`${property.purpose || ''} ${property.source_status || ''} ${property.description || ''}`)
    if (purpose === 'sale') return !text.includes('aluguel') && !text.includes('locacao')
    return Boolean(property.rent) || text.includes('aluguel') || text.includes('locacao')
}

function matchesFeature(property: Property, chipId: string) {
    const filter = FEATURE_FILTERS.find(option => option.id === chipId)
    return filter ? filter.matches(property) : true
}

function selectedOptionLabel(options: StepOption[], value: string) {
    const option = options.find(item => item.value === value) || options[0]
    return option?.shortLabel || option?.label || 'Todos'
}

function selectedOptionFullLabel(options: StepOption[], value: string) {
    const option = options.find(item => item.value === value) || options[0]
    return option?.label || option?.shortLabel || 'Todos'
}

function FilterStepControl({
    label,
    icon,
    options,
    value,
    onChange,
}: {
    label: string
    icon: ReactNode
    options: StepOption[]
    value: string
    onChange: (value: string) => void
}) {
    const selectedIndex = Math.max(0, options.findIndex(option => option.value === value))
    const selected = options[selectedIndex] || options[0]
    const progress = options.length > 1 ? (selectedIndex / (options.length - 1)) * 100 : 0
    const sliderStyle = { '--filter-progress': `${progress}%` } as CSSProperties

    return (
        <div className="step-filter">
            <div className="step-filter-head">
                <span>{icon}{label}</span>
                <strong>{selected?.label}</strong>
            </div>
            <div className="step-filter-track" style={sliderStyle}>
                <input
                    type="range"
                    min={0}
                    max={Math.max(0, options.length - 1)}
                    step={1}
                    value={selectedIndex}
                    aria-label={label}
                    onChange={(event) => {
                        const next = options[Number(event.target.value)]
                        if (next) onChange(next.value)
                    }}
                />
            </div>
            <div className="step-filter-options" aria-hidden="true">
                {options.map((option, index) => (
                    <button
                        key={option.value || `${label}-all`}
                        type="button"
                        className={index === selectedIndex ? 'active' : ''}
                        onClick={() => onChange(option.value)}
                        tabIndex={-1}
                    >
                        {option.shortLabel || option.label}
                    </button>
                ))}
            </div>
        </div>
    )
}

export default function HomeMapSearchSection({ properties }: { properties: Property[] }) {
    const router = useRouter()
    const [query, setQuery] = useState(DEFAULT_LOCATION)
    const [type, setType] = useState('all')
    const [price, setPrice] = useState('')
    const [purpose, setPurpose] = useState<'sale' | 'rent'>('sale')
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [isDesktopFilters, setIsDesktopFilters] = useState(false)
    const [mobileQuizStep, setMobileQuizStep] = useState(0)
    const [answeredQuizSteps, setAnsweredQuizSteps] = useState<MobileFilterKey[]>([])
    const [activeChips, setActiveChips] = useState<string[]>([])
    const [isGuidedSearchActive, setIsGuidedSearchActive] = useState(false)
    const [isHomeMapInteractionUnlocked, setIsHomeMapInteractionUnlocked] = useState(false)
    const [isOfficeLocationSelected, setIsOfficeLocationSelected] = useState(false)
    const [showMapLockedHint, setShowMapLockedHint] = useState(false)
    const [isMapModalOpen, setIsMapModalOpen] = useState(false)
    const [selectedDrawArea, setSelectedDrawArea] = useState<MapDrawArea | null>(null)
    const [selectedHomeMapPropertyId, setSelectedHomeMapPropertyId] = useState<string | null>(null)
    const [homeMapPreviewAnchorId, setHomeMapPreviewAnchorId] = useState<string | null>(null)
    const wrapperRef = useRef<HTMLDivElement>(null)
    const guidedSearchStartedRef = useRef(false)
    const trackedGuideStepRef = useRef<number | null>(null)
    const mapLockedHintTimerRef = useRef<number | null>(null)
    const applied = useMemo<AppliedFilters>(() => ({
        query: searchLocationName(query),
        type,
        price,
        purpose,
        chips: activeChips,
    }), [activeChips, price, purpose, query, type])

    const eligibleProperties = useMemo(() => {
        return properties.filter(matchesMinimumFirstContactPrice)
    }, [properties])

    const mappedTotal = useMemo(() => eligibleProperties.filter(hasCoordinates).length, [eligibleProperties])

    const availableFeatureFilters = useMemo(() => {
        return FEATURE_FILTERS
            .map(option => ({
                ...option,
                count: eligibleProperties.filter(option.matches).length,
            }))
            .filter(option => option.count > 0)
    }, [eligibleProperties])

    const filteredProperties = useMemo(() => {
        const term = normalize(searchLocationName(applied.query))
        return eligibleProperties.filter(property => {
            const text = normalize([
                property.title,
                property.city,
                property.state,
                property.neighborhood,
                property.property_type,
                property.description,
            ].filter(Boolean).join(' '))

            if (term && !text.includes(term)) return false
            if (!matchesType(property, applied.type)) return false
            if (!matchesPrice(property, applied.price)) return false
            if (!matchesPurpose(property, applied.purpose)) return false
            if (applied.chips.some(chipId => !matchesFeature(property, chipId))) return false
            return true
        })
    }, [applied, eligibleProperties])

    const filteredMappedTotal = useMemo(() => filteredProperties.filter(hasCoordinates).length, [filteredProperties])
    const selectedFilterCount = activeChips.length
    const showAdvancedPanel = isDesktopFilters || showAdvanced
    const mapRefitKey = useMemo(
        () => JSON.stringify({
            query: applied.query,
            type: applied.type,
            price: applied.price,
            purpose: applied.purpose,
            chips: applied.chips,
        }),
        [applied]
    )

    const applyOverlaySearchToMap = useCallback((values: HomeSearchValues, unlockMap = false) => {
        const nextLocation = getOverlaySearchLocation(values)
        setQuery(nextLocation)
        setType(mapOverlayTypeToMapFilter(values.typeValue))
        setPrice(values.priceValue === 'all' ? '' : values.priceValue)
        setSelectedDrawArea(null)
        setSelectedHomeMapPropertyId(null)
        setHomeMapPreviewAnchorId(null)

        if (values.locationType === 'office') {
            setShowMapLockedHint(false)
            setIsOfficeLocationSelected(true)
            setIsHomeMapInteractionUnlocked(true)
            return
        }

        setIsOfficeLocationSelected(false)

        if (unlockMap || (nextLocation && (values.locationType === 'city' || values.locationType === 'neighborhood'))) {
            setShowMapLockedHint(false)
            setIsHomeMapInteractionUnlocked(true)
        }
    }, [])

    const syncOverlaySearchWithMap = useCallback((values: HomeSearchValues) => {
        applyOverlaySearchToMap(values)
    }, [applyOverlaySearchToMap])

    const submitOverlaySearchInMap = useCallback((values: HomeSearchValues) => {
        const nextLocation = getOverlaySearchLocation(values)
        const nextType = mapOverlayTypeToMapFilter(values.typeValue)
        const nextPrice = values.priceValue === 'all' ? '' : values.priceValue
        const destination = buildOverlaySearchDestination(values, purpose, activeChips)

        applyOverlaySearchToMap(values, true)

        void trackEvent('home_map_inline_search_submitted', {
            source: isMapModalOpen ? 'home_map_modal' : 'home_map',
            destination,
            query: searchLocationName(nextLocation),
            location_type: values.locationType || 'free_text',
            type_value: nextType,
            price_value: nextPrice || 'all',
        })
        router.push(destination)
    }, [activeChips, applyOverlaySearchToMap, isMapModalOpen, purpose, router])

    const markQuizStepAnswered = useCallback((step: MobileFilterKey) => {
        setAnsweredQuizSteps(current => current.includes(step) ? current : [...current, step])
    }, [])

    const trackFilterChanged = useCallback((
        filterId: MobileFilterKey,
        filterLabel: string,
        value: string,
        options: StepOption[],
        source: 'quiz' | 'desktop'
    ) => {
        void trackEvent('home_map_filter_changed', {
            filter_id: filterId,
            filter_label: filterLabel,
            value: value || 'all',
            value_label: selectedOptionFullLabel(options, value),
            source,
            quiz_step: mobileQuizStep + 1,
        })
    }, [mobileQuizStep])

    const getSearchSnapshot = useCallback((chips = activeChips) => ({
        query: searchLocationName(query),
        type_value: type,
        type_label: selectedOptionFullLabel(TYPE_STEPS, type),
        price_value: price || 'all',
        price_label: selectedOptionFullLabel(PRICE_PRESETS, price),
        purpose_value: purpose,
        purpose_label: selectedOptionFullLabel(PURPOSE_STEPS, purpose),
        chips,
        chip_labels: chips
            .map(chipId => FEATURE_FILTERS.find(option => option.id === chipId)?.label)
            .filter(Boolean),
        results_count: filteredProperties.length,
        mapped_count: filteredMappedTotal,
    }), [activeChips, filteredMappedTotal, filteredProperties.length, price, purpose, query, type])

    const mobileFilters = useMemo<MobileFilterConfig[]>(() => [
        {
            id: 'location' as const,
            label: 'Localização',
            question: 'Onde você quer morar?',
            icon: <MapPin size={13} />,
            options: LOCATION_STEPS,
            value: query,
            onChange: (value: string) => {
                if (value !== query) trackFilterChanged('location', 'Localização', value, LOCATION_STEPS, 'quiz')
                setQuery(value)
                markQuizStepAnswered('location')
            },
        },
        {
            id: 'type' as const,
            label: 'Tipo',
            question: 'Que tipo de imóvel procura?',
            icon: <Home size={13} />,
            options: TYPE_STEPS,
            value: type,
            onChange: (value: string) => {
                if (value !== type) trackFilterChanged('type', 'Tipo', value, TYPE_STEPS, 'quiz')
                setType(value)
                markQuizStepAnswered('type')
            },
        },
        {
            id: 'price' as const,
            label: 'Valor',
            question: 'Qual faixa de valor?',
            icon: <Sparkles size={13} />,
            options: PRICE_PRESETS,
            value: price,
            onChange: (value: string) => {
                if (value !== price) trackFilterChanged('price', 'Valor', value, PRICE_PRESETS, 'quiz')
                setPrice(value)
                markQuizStepAnswered('price')
            },
        },
        {
            id: 'purpose' as const,
            label: 'Oferta',
            question: 'Compra ou aluguel?',
            icon: <Building2 size={13} />,
            options: PURPOSE_STEPS,
            value: purpose,
            onChange: (value: string) => {
                const nextPurpose = value === 'rent' ? 'rent' : 'sale'
                if (nextPurpose !== purpose) trackFilterChanged('purpose', 'Oferta', nextPurpose, PURPOSE_STEPS, 'quiz')
                setPurpose(nextPurpose)
                markQuizStepAnswered('purpose')
            },
        },
    ], [markQuizStepAnswered, price, purpose, query, trackFilterChanged, type])

    const activeMobileQuizConfig = mobileFilters[mobileQuizStep] || mobileFilters[0]
    const isMapInteractionLocked = !isHomeMapInteractionUnlocked
    const selectedRegionArea = useMemo(
        () => {
            if (isMapInteractionLocked || isOfficeLocationSelected || selectedDrawArea) return null
            return findMapRegionByText(query || applied.query)
        },
        [applied.query, isMapInteractionLocked, isOfficeLocationSelected, query, selectedDrawArea]
    )
    const homeMapProperties = useMemo(
        () => isOfficeLocationSelected || isMapInteractionLocked
            ? []
            : filterHomePropertiesByRegionArea(filteredProperties, selectedRegionArea),
        [filteredProperties, isMapInteractionLocked, isOfficeLocationSelected, selectedRegionArea]
    )
    const drawFilteredHomeMapProperties = useMemo(
        () => filterHomePropertiesByDrawArea(homeMapProperties, selectedDrawArea),
        [homeMapProperties, selectedDrawArea]
    )
    const areaFilteredHomeMapProperties = drawFilteredHomeMapProperties
    const visibleHomeMapProperties = useMemo(
        () => areaFilteredHomeMapProperties.filter(hasCoordinates),
        [areaFilteredHomeMapProperties]
    )
    const homePreviewMapProperties = useMemo(
        () => selectedRegionArea ? visibleHomeMapProperties : visibleHomeMapProperties.slice(0, HOME_MAP_PREVIEW_LIMIT),
        [selectedRegionArea, visibleHomeMapProperties]
    )
    const overviewHomeMapProperties = useMemo(
        () => eligibleProperties
            .filter(property => {
                if (!matchesType(property, type)) return false
                if (!matchesPrice(property, price)) return false
                if (!matchesPurpose(property, purpose)) return false
                if (activeChips.some(chipId => !matchesFeature(property, chipId))) return false
                return hasCoordinates(property)
            }),
        [activeChips, eligibleProperties, price, purpose, type]
    )
    const homeMapDisplayProperties = isMapInteractionLocked || isOfficeLocationSelected
        ? overviewHomeMapProperties
        : homePreviewMapProperties
    const selectedHomeMapProperty = useMemo(() => {
        if (!selectedHomeMapPropertyId || isMapInteractionLocked || isOfficeLocationSelected) return null
        return visibleHomeMapProperties.find(property => property.id === selectedHomeMapPropertyId) || null
    }, [isMapInteractionLocked, isOfficeLocationSelected, selectedHomeMapPropertyId, visibleHomeMapProperties])
    const homeMapPreviewAnchorProperty = useMemo(() => {
        if (!homeMapPreviewAnchorId) return selectedHomeMapProperty
        return visibleHomeMapProperties.find(property => property.id === homeMapPreviewAnchorId) || selectedHomeMapProperty
    }, [homeMapPreviewAnchorId, selectedHomeMapProperty, visibleHomeMapProperties])
    const smoothHomePreviewMapProperties = useMemo(
        () => orderPropertiesBySmoothGeoPath(homePreviewMapProperties, homeMapPreviewAnchorProperty),
        [homeMapPreviewAnchorProperty, homePreviewMapProperties]
    )
    const smoothVisibleHomeMapProperties = useMemo(
        () => orderPropertiesBySmoothGeoPath(visibleHomeMapProperties, homeMapPreviewAnchorProperty),
        [homeMapPreviewAnchorProperty, visibleHomeMapProperties]
    )
    const isHomeMapPreviewOpen = !isMapModalOpen && Boolean(selectedHomeMapProperty)
    const isMapModalPreviewOpen = isMapModalOpen && Boolean(selectedHomeMapProperty)
    const areaFilteredMappedTotal = visibleHomeMapProperties.length
    const homeOfficeMarker = isMapInteractionLocked || isOfficeLocationSelected ? OFFICE_LOCATION_MARKER : null
    const homeMapRefitKey = isOfficeLocationSelected
        ? `home-office-location-selected-${overviewHomeMapProperties.length}`
        : isMapInteractionLocked
            ? `home-office-location-overview-${overviewHomeMapProperties.length}-${mapRefitKey}`
            : `${mapRefitKey}::home-region-${selectedRegionArea?.id || 'none'}::${selectedRegionArea?.area?.length || 0}`
    const mapPreviewStatLabel = isMapInteractionLocked || isOfficeLocationSelected
        ? 'Imobiliária Guilherme Pilger'
        : `${filteredMappedTotal} de ${mappedTotal} no mapa`
    const shouldRenderMap = true
    const activeMapPreviewStatLabel = isMapInteractionLocked || isOfficeLocationSelected
        ? mapPreviewStatLabel
        : selectedDrawArea
            ? `${areaFilteredMappedTotal} na área desenhada`
            : selectedRegionArea
            ? selectedRegionArea.label
            : mapPreviewStatLabel
    const shouldPulseNextButton = mobileQuizStep < mobileFilters.length - 1 && answeredQuizSteps.includes(activeMobileQuizConfig.id)
    const mobileQuizProgressStyle = {
        '--quiz-progress': `${((mobileQuizStep + 1) / mobileFilters.length) * 100}%`,
    } as CSSProperties
    const searchSubmitLabel = mobileQuizStep < mobileFilters.length - 1
        ? 'Próximo'
        : filteredProperties.length ? `Ver ${filteredProperties.length} imóveis` : 'Buscar imóveis'

    const currentGuideStepAnswered = answeredQuizSteps.includes(activeMobileQuizConfig.id)
    const guidedSearchMessage = GUIDED_SEARCH_MESSAGES[activeMobileQuizConfig.id]
    const guidedSearchBody = currentGuideStepAnswered
        ? mobileQuizStep < mobileFilters.length - 1
            ? guidedSearchMessage.next
            : `Tudo pronto. Toque em "${searchSubmitLabel}" para ver os resultados.`
        : guidedSearchMessage.choose
    const shouldGuideSubmit = isGuidedSearchActive && currentGuideStepAnswered

    const showLockedMapHint = useCallback(() => {
        if (!isMapInteractionLocked) return

        setShowMapLockedHint(true)

        if (mapLockedHintTimerRef.current) {
            window.clearTimeout(mapLockedHintTimerRef.current)
        }

        mapLockedHintTimerRef.current = window.setTimeout(() => {
            setShowMapLockedHint(false)
            mapLockedHintTimerRef.current = null
        }, 2600)
    }, [isMapInteractionLocked])

    const handleDrawAreaChange = useCallback((area: MapDrawArea | null) => {
        setSelectedDrawArea(area)
        setSelectedHomeMapPropertyId(null)
        setHomeMapPreviewAnchorId(null)

        if (area) {
            setIsHomeMapInteractionUnlocked(true)
            setIsOfficeLocationSelected(false)
        }

        void trackEvent('home_map_draw_area_changed', {
            ...getSearchSnapshot(),
            source: isMapModalOpen ? 'explore_modal' : 'home_map',
            enabled: Boolean(area && area.length >= 3),
            points_count: area?.length || 0,
            results_count: area ? filterHomePropertiesByDrawArea(homeMapProperties, area).length : homeMapProperties.length,
        })
    }, [getSearchSnapshot, homeMapProperties, isMapModalOpen])

    const handleHomeMapPropertySelect = useCallback((property: Property) => {
        if (!property?.id) return

        setSelectedHomeMapPropertyId(property.id)
        setHomeMapPreviewAnchorId(property.id)
        setIsHomeMapInteractionUnlocked(true)
        setIsOfficeLocationSelected(false)
        setShowMapLockedHint(false)

        void trackEvent('home_map_property_selected', {
            property_id: property.id,
            title: property.title,
            price: property.price || null,
            source: isMapModalOpen ? 'explore_modal' : 'home_map',
            results_count: areaFilteredHomeMapProperties.length,
            mapped_count: areaFilteredMappedTotal,
        })
    }, [areaFilteredHomeMapProperties.length, areaFilteredMappedTotal, isMapModalOpen])

    const handleHomeMapPreviewPropertySelect = useCallback((property: MapPreviewProperty, source: string) => {
        if (!property?.id) return
        if (property.id === selectedHomeMapPropertyId) return

        setSelectedHomeMapPropertyId(property.id)

        void trackEvent('home_map_preview_similar_selected', {
            property_id: property.id,
            title: property.title || null,
            price: property.price || null,
            source,
            modal_open: isMapModalOpen,
            mapped_count: visibleHomeMapProperties.length,
        })
    }, [isMapModalOpen, selectedHomeMapPropertyId, visibleHomeMapProperties.length])

    const closeHomeMapPropertyPreview = useCallback(() => {
        const property = selectedHomeMapProperty
        setSelectedHomeMapPropertyId(null)
        setHomeMapPreviewAnchorId(null)

        if (property) {
            void trackEvent('home_map_preview_closed', {
                property_id: property.id,
                title: property.title,
                source: isMapModalOpen ? 'explore_modal' : 'home_map',
            })
        }
    }, [isMapModalOpen, selectedHomeMapProperty])

    const openMapModal = useCallback((source = 'mobile_nav') => {
        setShowMapLockedHint(false)
        setSelectedDrawArea(null)
        setSelectedHomeMapPropertyId(null)
        setHomeMapPreviewAnchorId(null)
        setIsOfficeLocationSelected(false)
        setIsHomeMapInteractionUnlocked(true)
        setIsMapModalOpen(true)
        void trackEvent('home_map_modal_opened', {
            source,
            results_count: filteredProperties.length,
            mapped_count: filteredMappedTotal,
        })
    }, [filteredMappedTotal, filteredProperties.length])

    const closeMapModal = useCallback(() => {
        setSelectedHomeMapPropertyId(null)
        setHomeMapPreviewAnchorId(null)
        setIsMapModalOpen(false)
    }, [])

    const openMapFiltersFromSearch = useCallback((event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault()

        const mapPanel =
            event.currentTarget.closest('.map-preview-panel, .mobile-map-preview-panel') as HTMLElement | null ||
            wrapperRef.current?.querySelector<HTMLElement>('.home-preview-map-panel') ||
            null
        const mapOptionsButton = mapPanel?.querySelector<HTMLButtonElement>('.map-mobile-action-dock button[aria-label="Abrir opções do mapa"]')
        const quickFilterButton = mapPanel?.querySelector<HTMLButtonElement>('.map-quick-filter-trigger')
        const filterControl = mapOptionsButton || quickFilterButton

        mapPanel?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        filterControl?.click()

        void trackEvent('home_map_more_filters_clicked', {
            mode: filterControl === mapOptionsButton ? 'map_options' : 'quick_filters',
            source: isMapModalOpen ? 'mobile_map_modal' : 'home_map',
        })
    }, [isMapModalOpen])

    const markGuidedSearchSeen = useCallback(() => {
        try {
            window.localStorage.setItem(GUIDED_SEARCH_STORAGE_KEY, 'true')
        } catch {
            // localStorage can be unavailable in restricted browser contexts.
        }
    }, [])

    const startGuidedSearch = useCallback(() => {
        if (guidedSearchStartedRef.current) return

        guidedSearchStartedRef.current = true
        markGuidedSearchSeen()
        setIsGuidedSearchActive(true)
        void trackEvent('home_guided_search_started', {
            source: 'home_map_search',
            step_total: mobileFilters.length,
        })
    }, [markGuidedSearchSeen, mobileFilters.length])

    const finishGuidedSearch = useCallback(() => {
        markGuidedSearchSeen()

        if (!isGuidedSearchActive) return

        setIsGuidedSearchActive(false)
        void trackEvent('home_guided_search_completed', {
            ...getSearchSnapshot(),
            source: 'home_map_search',
            step_number: mobileQuizStep + 1,
            step_total: mobileFilters.length,
            filter_id: activeMobileQuizConfig.id,
            filter_label: activeMobileQuizConfig.label,
        })
    }, [
        activeMobileQuizConfig.id,
        activeMobileQuizConfig.label,
        getSearchSnapshot,
        isGuidedSearchActive,
        markGuidedSearchSeen,
        mobileFilters.length,
        mobileQuizStep,
    ])

    const buildSearchParams = useCallback((chips = activeChips) => {
        const params = new URLSearchParams()
        const term = searchLocationName(query.trim())

        if (term) params.set('q', term)
        if (type !== 'all') params.set('type', type)
        if (price) params.set('price', price)
        if (purpose) params.set('offer', purpose)

        chips.forEach(chipId => {
            const option = FEATURE_FILTERS.find(item => item.id === chipId)
            if (!option) return
            if (option.param === 'priceMin') {
                const current = Number(params.get('priceMin') || 0)
                if (Number(option.value) > current) params.set(option.param, option.value)
                return
            }
            if (!params.has(option.param)) params.set(option.param, option.value)
        })

        return params
    }, [activeChips, price, purpose, query, type])

    const navigateToSearchResults = useCallback((source = 'home_map_search') => {
        const params = buildSearchParams()
        const queryString = params.toString()
        const destination = queryString ? `/busca?${queryString}` : '/busca'

        void trackEvent('home_map_search_submitted', {
            ...getSearchSnapshot(),
            source,
            destination,
        })
        if (isGuidedSearchActive) finishGuidedSearch()
        router.push(destination)
    }, [buildSearchParams, finishGuidedSearch, getSearchSnapshot, isGuidedSearchActive, router])

    const applySearch = (event?: React.FormEvent) => {
        event?.preventDefault()

        if (mobileQuizStep < mobileFilters.length - 1) {
            void trackEvent('home_map_quiz_next_clicked', {
                ...getSearchSnapshot(),
                filter_id: activeMobileQuizConfig.id,
                filter_label: activeMobileQuizConfig.label,
                value: activeMobileQuizConfig.value || 'all',
                value_label: selectedOptionFullLabel(activeMobileQuizConfig.options, activeMobileQuizConfig.value),
                step_number: mobileQuizStep + 1,
                step_total: mobileFilters.length,
            })
            setMobileQuizStep(current => Math.min(current + 1, mobileFilters.length - 1))
            return
        }

        navigateToSearchResults('home_map_form')
    }

    const clearSearch = () => {
        void trackEvent('home_map_search_cleared', getSearchSnapshot())
        setQuery(DEFAULT_LOCATION)
        setType('all')
        setPrice('')
        setPurpose('sale')
        setActiveChips([])
        setMobileQuizStep(0)
        setAnsweredQuizSteps([])
        setIsOfficeLocationSelected(false)
        setShowMapLockedHint(false)
        setIsHomeMapInteractionUnlocked(false)
        setSelectedDrawArea(null)
        setSelectedHomeMapPropertyId(null)
    }

    const toggleAdvancedFilters = () => {
        const nextOpen = !showAdvanced
        setShowAdvanced(nextOpen)
        void trackEvent('home_map_advanced_filters_toggled', {
            open: nextOpen,
            selected_count: selectedFilterCount,
            results_count: filteredProperties.length,
            mapped_count: filteredMappedTotal,
        })
    }

    const goPreviousQuizStep = () => {
        void trackEvent('home_map_quiz_back_clicked', {
            step_number: mobileQuizStep + 1,
            step_total: mobileFilters.length,
            filter_id: activeMobileQuizConfig.id,
            filter_label: activeMobileQuizConfig.label,
        })
        setMobileQuizStep(current => Math.max(0, current - 1))
    }

    const toggleChip = (chipId: string) => {
        const option = FEATURE_FILTERS.find(item => item.id === chipId)
        const isActive = activeChips.includes(chipId)
        const nextChips = activeChips.includes(chipId)
            ? activeChips.filter(item => item !== chipId)
            : [...activeChips, chipId]

        void trackEvent('home_map_feature_filter_toggled', {
            ...getSearchSnapshot(nextChips),
            chip_id: chipId,
            chip_label: option?.label || chipId,
            active: !isActive,
        })
        setActiveChips(nextChips)
    }

    useEffect(() => {
        const node = wrapperRef.current
        if (!node) return

        let alreadySeen = false
        try {
            alreadySeen = window.localStorage.getItem(GUIDED_SEARCH_STORAGE_KEY) === 'true'
        } catch {
            alreadySeen = false
        }

        if (alreadySeen) return

        if (typeof window.IntersectionObserver === 'undefined') {
            const frame = window.requestAnimationFrame(startGuidedSearch)
            return () => window.cancelAnimationFrame(frame)
        }

        const observer = new window.IntersectionObserver((entries) => {
            if (!entries.some(entry => entry.isIntersecting)) return
            startGuidedSearch()
            observer.disconnect()
        }, { threshold: 0.36, rootMargin: '0px 0px -18% 0px' })

        observer.observe(node)

        return () => observer.disconnect()
    }, [startGuidedSearch])

    useEffect(() => {
        if (!isGuidedSearchActive) return
        if (trackedGuideStepRef.current === mobileQuizStep) return

        trackedGuideStepRef.current = mobileQuizStep
        void trackEvent('home_guided_search_step_viewed', {
            ...getSearchSnapshot(),
            source: 'home_map_search',
            step_number: mobileQuizStep + 1,
            step_total: mobileFilters.length,
            filter_id: activeMobileQuizConfig.id,
            filter_label: activeMobileQuizConfig.label,
        })
    }, [
        activeMobileQuizConfig.id,
        activeMobileQuizConfig.label,
        getSearchSnapshot,
        isGuidedSearchActive,
        mobileFilters.length,
        mobileQuizStep,
    ])

    useEffect(() => {
        const mediaQuery = window.matchMedia('(min-width: 900px)')
        const syncDesktopFilters = () => setIsDesktopFilters(mediaQuery.matches)

        syncDesktopFilters()
        mediaQuery.addEventListener('change', syncDesktopFilters)

        return () => mediaQuery.removeEventListener('change', syncDesktopFilters)
    }, [])

    useEffect(() => {
        return () => {
            if (mapLockedHintTimerRef.current) {
                window.clearTimeout(mapLockedHintTimerRef.current)
            }
        }
    }, [])

    useEffect(() => {
        const handleOpenMapSearch = (event: Event) => {
            event.preventDefault()
            const source = typeof window.CustomEvent === 'function' && event instanceof window.CustomEvent
                ? String(event.detail?.source || 'mobile_nav')
                : 'mobile_nav'
            openMapModal(source)
        }

        window.addEventListener('pilger:open-map-search', handleOpenMapSearch)
        return () => window.removeEventListener('pilger:open-map-search', handleOpenMapSearch)
    }, [openMapModal])

    useEffect(() => {
        if (!isMapModalOpen) return

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        const focusTimer = window.setTimeout(() => {
            document.querySelector<HTMLInputElement>('.mobile-map-modal .home-search-location-row input')?.focus({ preventScroll: true })
        }, 180)

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeMapModal()
        }

        window.addEventListener('keydown', handleKeyDown)

        return () => {
            document.body.style.overflow = previousOverflow
            window.clearTimeout(focusTimer)
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [closeMapModal, isMapModalOpen])

    return (
        <section className="home-map-search" id="mapa">
            <div className="map-search-shell" ref={wrapperRef}>
                <div className={`map-preview-panel home-preview-map-panel ${isMapInteractionLocked ? 'is-map-locked' : ''}${isHomeMapPreviewOpen ? ' is-preview-open' : ''}`}>
                    {shouldRenderMap ? (
                        <MapSearch
                            properties={homeMapDisplayProperties}
                            selectedPropertyId={selectedHomeMapPropertyId}
                            drawArea={selectedDrawArea}
                            regionArea={selectedRegionArea}
                            refitKey={homeMapRefitKey}
                            interactionEnabled={!isMapInteractionLocked}
                            officeMarker={homeOfficeMarker}
                            initialMapStyle="luxury"
                            overviewMode={isMapInteractionLocked || isOfficeLocationSelected}
                            fixedOverviewView={isMapInteractionLocked ? HOME_LOCKED_MAP_VIEW : null}
                            onPropertySelect={handleHomeMapPropertySelect}
                            onDrawAreaChange={handleDrawAreaChange}
                        />
                    ) : (
                        <div className="map-preview-placeholder" aria-hidden="true">
                            <div className="map-placeholder-grid" />
                            <span className="map-placeholder-pin"><MapPin size={18} /></span>
                        </div>
                    )}
                    {isMapInteractionLocked && (
                        <>
                            <div
                                className={`map-lock-hint ${showMapLockedHint ? 'is-visible' : ''}`}
                                role="status"
                                aria-live="polite"
                            >
                                Pesquise uma cidade ou bairro para mover o mapa.
                            </div>
                            <button
                                type="button"
                                className="map-interaction-lock"
                                aria-label="Pesquise uma cidade ou bairro para mover o mapa"
                                onClick={showLockedMapHint}
                                onPointerDown={showLockedMapHint}
                            />
                        </>
                    )}
                    <div className="map-search-panel map-search-panel-new home-map-search-panel home-map-search-panel--overlay">
                        <HomeSearchBar
                            onMoreFiltersClick={openMapFiltersFromSearch}
                            onSubmitValues={submitOverlaySearchInMap}
                            onValuesChange={syncOverlaySearchWithMap}
                            suggestionsPlacement="down"
                            variant="map"
                        />
                    </div>
                    {selectedHomeMapProperty && !isMapModalOpen && (
                        <div className="home-map-property-preview home-map-property-preview--compact">
                            <MapPropertyPreviewCard
                                property={selectedHomeMapProperty}
                                properties={smoothHomePreviewMapProperties}
                                selectedPropertyId={selectedHomeMapPropertyId}
                                onClose={closeHomeMapPropertyPreview}
                                onPropertySelect={smoothHomePreviewMapProperties.length > 1 ? handleHomeMapPreviewPropertySelect : undefined}
                            />
                        </div>
                    )}
                </div>

                {isDesktopFilters && (
                    <div className="map-search-panel home-map-search-panel home-map-search-panel--desktop">
                        <HomeSearchBar
                            onMoreFiltersClick={openMapFiltersFromSearch}
                            onSubmitValues={submitOverlaySearchInMap}
                            onValuesChange={syncOverlaySearchWithMap}
                            suggestionsPlacement="down"
                            variant="map"
                        />
                    </div>
                )}

                <form
                    aria-hidden="true"
                    className={`map-search-panel legacy-map-search-panel ${isGuidedSearchActive ? 'is-guide-active' : ''} ${shouldGuideSubmit ? 'is-guide-submit-ready' : ''}`}
                    hidden
                    onSubmit={applySearch}
                >
                    <div className="search-heading">
                        <span>Encontre sua seleção</span>
                    </div>

                    <div className="mobile-filter-dock">
                        <div className="mobile-quiz-panel">
                            <div className="mobile-quiz-progress" style={mobileQuizProgressStyle}>
                                <span>{mobileQuizStep + 1} de {mobileFilters.length}</span>
                                <i aria-hidden="true" />
                            </div>

                            <div className="mobile-quiz-question">
                                <button
                                    type="button"
                                    onClick={goPreviousQuizStep}
                                    disabled={mobileQuizStep === 0}
                                    aria-label="Voltar pergunta"
                                >
                                    <ChevronLeft size={17} />
                                </button>
                                <h3>{activeMobileQuizConfig.question}</h3>
                                <strong>{selectedOptionLabel(activeMobileQuizConfig.options, activeMobileQuizConfig.value)}</strong>
                            </div>

                            <FilterStepControl
                                label={activeMobileQuizConfig.label}
                                icon={activeMobileQuizConfig.icon}
                                options={activeMobileQuizConfig.options}
                                value={activeMobileQuizConfig.value}
                                onChange={activeMobileQuizConfig.onChange}
                            />

                        </div>
                    </div>

                    {isGuidedSearchActive && (
                        <div className="guided-search-coach" aria-live="polite" aria-label="Guia da pesquisa">
                            <div>
                                <span>Guia rápido · {mobileQuizStep + 1} de {mobileFilters.length}</span>
                                <strong>{guidedSearchMessage.title}</strong>
                                <p>{guidedSearchBody}</p>
                            </div>
                        </div>
                    )}

                    <div className="step-filter-grid">
                        <FilterStepControl
                            label="Localização"
                            icon={<MapPin size={14} />}
                            options={LOCATION_STEPS}
                            value={query}
                            onChange={(value) => {
                                if (value !== query) trackFilterChanged('location', 'Localização', value, LOCATION_STEPS, 'desktop')
                                setQuery(value)
                            }}
                        />
                        <FilterStepControl
                            label="Tipo"
                            icon={<Home size={14} />}
                            options={TYPE_STEPS}
                            value={type}
                            onChange={(value) => {
                                if (value !== type) trackFilterChanged('type', 'Tipo', value, TYPE_STEPS, 'desktop')
                                setType(value)
                            }}
                        />
                        <FilterStepControl
                            label="Valor"
                            icon={<Sparkles size={14} />}
                            options={PRICE_PRESETS}
                            value={price}
                            onChange={(value) => {
                                if (value !== price) trackFilterChanged('price', 'Valor', value, PRICE_PRESETS, 'desktop')
                                setPrice(value)
                            }}
                        />
                        <FilterStepControl
                            label="Oferta"
                            icon={<Building2 size={14} />}
                            options={PURPOSE_STEPS}
                            value={purpose}
                            onChange={(value) => {
                                const nextPurpose = value === 'rent' ? 'rent' : 'sale'
                                if (nextPurpose !== purpose) trackFilterChanged('purpose', 'Oferta', nextPurpose, PURPOSE_STEPS, 'desktop')
                                setPurpose(nextPurpose)
                            }}
                        />
                    </div>

                    <button type="submit" className={`search-submit ${shouldPulseNextButton ? 'is-ready' : ''}`} aria-label={searchSubmitLabel}>
                        <Search size={17} strokeWidth={2.4} />
                        <span>{searchSubmitLabel}</span>
                    </button>

                    <div className="search-actions">
                        <button type="button" className="utility-button advanced-toggle" onClick={toggleAdvancedFilters} aria-expanded={showAdvancedPanel} aria-label="Abrir filtros">
                            <Filter size={15} />
                            {selectedFilterCount > 0 && <strong>{selectedFilterCount}</strong>}
                        </button>
                        <button type="button" className="utility-button muted" onClick={clearSearch}>
                            <RotateCcw size={15} />
                            <span>Limpar</span>
                        </button>
                    </div>

                    {showAdvancedPanel && (
                        <div className="advanced-filter-panel">
                            <div className="advanced-filter-head">
                                <strong>{filteredProperties.length} oportunidades encontradas</strong>
                                <span>{filteredMappedTotal} com localização no mapa</span>
                            </div>
                            <div className="filter-chip-grid">
                                {availableFeatureFilters.map(option => {
                                    const Icon = option.icon
                                    const selected = activeChips.includes(option.id)
                                    return (
                                        <button
                                            key={option.id}
                                            type="button"
                                            className={`filter-chip ${selected ? 'active' : ''}`}
                                            onClick={() => toggleChip(option.id)}
                                            aria-pressed={selected}
                                        >
                                            <Icon size={14} />
                                            <span>{option.label}</span>
                                            <small>{option.count}</small>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </form>
            </div>

            {isMapModalOpen && (
                <div className="mobile-map-modal-backdrop" onClick={closeMapModal} role="presentation">
                    <div
                        aria-label="Buscar imóveis no mapa"
                        aria-modal="true"
                        className="mobile-map-modal"
                        onClick={event => event.stopPropagation()}
                        role="dialog"
                    >
                        <div className="mobile-map-modal-head">
                            <div>
                                <span>Explorar no mapa</span>
                                <strong>Busque por cidade, bairro ou perfil</strong>
                            </div>
                            <button type="button" onClick={closeMapModal} aria-label="Fechar busca no mapa">
                                <X size={20} strokeWidth={2.4} />
                            </button>
                        </div>
                        <div className="mobile-map-modal-body">
                            <div className={`map-preview-panel mobile-map-preview-panel ${isMapInteractionLocked ? 'is-map-locked' : ''}${isMapModalPreviewOpen ? ' is-preview-open' : ''}`}>
                                {shouldRenderMap ? (
                                    <MapSearch
                                        properties={visibleHomeMapProperties}
                                        selectedPropertyId={selectedHomeMapPropertyId}
                                        drawArea={selectedDrawArea}
                                        regionArea={selectedRegionArea}
                                        refitKey={`${homeMapRefitKey}-modal`}
                                        interactionEnabled={!isMapInteractionLocked}
                                        officeMarker={homeOfficeMarker}
                                        initialMapStyle="luxury"
                                        onPropertySelect={handleHomeMapPropertySelect}
                                        onDrawAreaChange={handleDrawAreaChange}
                                    />
                                ) : (
                                    <div className="map-preview-placeholder" aria-hidden="true">
                                        <div className="map-placeholder-grid" />
                                        <span className="map-placeholder-pin"><MapPin size={18} /></span>
                                    </div>
                                )}
                                <div className="map-preview-stat mobile-map-preview-stat">
                                    <Building2 size={14} />
                                    <span>{activeMapPreviewStatLabel}</span>
                                </div>
                                {isMapInteractionLocked && (
                                    <>
                                        <div
                                            className={`map-lock-hint ${showMapLockedHint ? 'is-visible' : ''}`}
                                            role="status"
                                            aria-live="polite"
                                        >
                                            Pesquise uma cidade ou bairro para mover o mapa.
                                        </div>
                                        <button
                                            type="button"
                                            className="map-interaction-lock"
                                            aria-label="Pesquise uma cidade ou bairro para mover o mapa"
                                            onClick={showLockedMapHint}
                                            onPointerDown={showLockedMapHint}
                                        />
                                    </>
                                )}
                                <div className="map-search-panel map-search-panel-new mobile-map-search-panel">
                                    <HomeSearchBar
                                        onMoreFiltersClick={openMapFiltersFromSearch}
                                        onSubmitValues={submitOverlaySearchInMap}
                                        onValuesChange={syncOverlaySearchWithMap}
                                        variant="map"
                                    />
                                </div>
                                {selectedHomeMapProperty && (
                                    <div className="home-map-property-preview">
                                        <MapPropertyPreviewCard
                                            property={selectedHomeMapProperty}
                                            properties={smoothVisibleHomeMapProperties}
                                            selectedPropertyId={selectedHomeMapPropertyId}
                                            onClose={closeHomeMapPropertyPreview}
                                            onPropertySelect={smoothVisibleHomeMapProperties.length > 1 ? handleHomeMapPreviewPropertySelect : undefined}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .home-map-search {
                    margin: clamp(24px, 4vw, 48px) auto;
                    padding: 0 clamp(18px, 3vw, 36px);
                    width: 100%;
                }
                .map-search-copy {
                    margin: 0 auto 18px;
                    max-width: 820px;
                    text-align: center;
                }
                .map-search-copy h2 {
                    color: #211c16;
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: clamp(1.45rem, 2.7vw, 2.8rem);
                    font-weight: 760;
                    letter-spacing: 0;
                    line-height: 1.04;
                    margin: 8px 0 0;
                }
                .map-search-copy p {
                    color: #746858;
                    font-size: clamp(0.78rem, 1.05vw, 0.92rem);
                    font-weight: 600;
                    line-height: 1.5;
                    margin: 10px auto 0;
                    max-width: 620px;
                }
                .map-search-shell {
                    background: #fff;
                    border: 1px solid rgba(184,148,95,0.18);
                    border-radius: 18px;
                    box-shadow: 0 24px 70px rgba(31,27,21,0.11);
                    isolation: isolate;
                    margin: 0 auto;
                    max-width: 1680px;
                    overflow: hidden;
                    position: relative;
                    z-index: 0;
                }
                .map-search-shell:focus-within {
                    z-index: 20;
                }
                .map-preview-panel {
                    --sv-sheet-top: 78%;
                    background: #1f1b16;
                    border-radius: 18px;
                    height: clamp(320px, 42vw, 520px);
                    overflow: hidden;
                    position: relative;
                }
                .map-preview-placeholder {
                    position: absolute;
                    inset: 0;
                    overflow: hidden;
                    background:
                        radial-gradient(circle at 66% 42%, rgba(223,193,142,0.22), transparent 18%),
                        linear-gradient(135deg, #191612, #2a241d);
                }
                .map-placeholder-grid {
                    position: absolute;
                    inset: -40px;
                    opacity: 0.42;
                    background-image:
                        linear-gradient(rgba(255,248,234,0.08) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,248,234,0.08) 1px, transparent 1px);
                    background-size: 46px 46px;
                    transform: rotate(-8deg) scale(1.08);
                }
                .map-placeholder-pin {
                    position: absolute;
                    left: 50%;
                    top: 46%;
                    display: grid;
                    place-items: center;
                    width: 42px;
                    height: 42px;
                    border-radius: 999px;
                    background: #dfc18e;
                    color: #171410;
                    transform: translate(-50%, -50%);
                    box-shadow: 0 16px 34px rgba(0,0,0,0.28);
                }
                .map-preview-stat {
                    align-items: center;
                    background: rgba(23,20,16,0.58);
                    border: 1px solid rgba(223,193,142,0.16);
                    border-radius: 999px;
                    bottom: 12px;
                    color: #fff8ea;
                    display: inline-flex;
                    font: 800 0.52rem/1 'Inter', sans-serif;
                    gap: 5px;
                    left: 12px;
                    letter-spacing: 0.05em;
                    opacity: 0.74;
                    padding: 5px 7px;
                    position: absolute;
                    text-transform: uppercase;
                    z-index: 545;
                }
                .map-preview-stat svg {
                    height: 10px;
                    width: 10px;
                }
                .map-lock-hint {
                    align-items: center;
                    background: rgba(18,18,18,0.9);
                    border: 1px solid rgba(223,193,142,0.36);
                    border-radius: 999px;
                    box-shadow: 0 16px 34px rgba(0,0,0,0.26);
                    color: #fff8ea;
                    display: inline-flex;
                    font: 850 0.72rem/1.18 'Inter', sans-serif;
                    justify-content: center;
                    left: 50%;
                    max-width: calc(100% - 36px);
                    opacity: 0;
                    padding: 10px 14px;
                    pointer-events: none;
                    position: absolute;
                    text-align: center;
                    top: 64px;
                    transform: translate(-50%, -8px);
                    transition: opacity 0.2s ease, transform 0.2s ease;
                    width: max-content;
                    z-index: 755;
                }
                .map-lock-hint.is-visible {
                    opacity: 1;
                    transform: translate(-50%, 0);
                }
                .map-interaction-lock {
                    background: transparent;
                    border: 0;
                    cursor: default;
                    inset: 0;
                    margin: 0;
                    padding: 0;
                    position: absolute;
                    touch-action: pan-y;
                    z-index: 700;
                }
                .home-preview-map-panel {
                    height: clamp(320px, 54svh, 500px);
                }
                .home-preview-map-panel :global(.map-mobile-action-dock),
                .home-preview-map-panel :global(.map-context-layer-strip),
                .home-preview-map-panel :global(.map-amenity-layer-strip),
                .home-preview-map-panel :global(.leaflet-control-zoom) {
                    display: none !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                }
                .home-map-invite {
                    align-items: center;
                    background: rgba(255,253,248,0.94);
                    border: 1px solid rgba(184,148,95,0.22);
                    border-radius: 16px;
                    bottom: 12px;
                    box-shadow: 0 18px 44px rgba(20,16,10,0.18);
                    display: grid;
                    gap: 8px 12px;
                    grid-template-columns: minmax(170px, 0.7fr) minmax(0, 1.3fr);
                    left: 50%;
                    max-width: 820px;
                    padding: 10px;
                    position: absolute;
                    right: auto;
                    transform: translateX(-50%);
                    width: min(820px, calc(100% - 32px));
                    z-index: 760;
                }
                .home-map-invite-copy {
                    align-self: stretch;
                    display: grid;
                    gap: 2px;
                    grid-row: 1 / 3;
                    justify-content: start;
                    justify-items: start;
                    min-width: 0;
                }
                .home-map-invite-copy span {
                    color: #a78042;
                    font: 900 0.56rem/1 'Inter', sans-serif;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                }
                .home-map-invite-copy strong {
                    color: #211c16;
                    font: 850 0.9rem/1.12 'Inter', sans-serif;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .home-map-region-chips {
                    display: flex;
                    grid-column: 2;
                    overflow-x: auto;
                    padding-bottom: 1px;
                    scrollbar-width: none;
                }
                .home-map-region-chips {
                    gap: 6px;
                }
                .home-map-price-row {
                    align-items: center;
                    display: grid;
                    gap: 7px;
                    grid-column: 2;
                    grid-template-columns: minmax(0, 1fr) auto;
                    min-width: 0;
                }
                .home-map-price-chips {
                    display: flex;
                    gap: 5px;
                    min-width: 0;
                    overflow-x: auto;
                    padding-bottom: 1px;
                    scrollbar-width: none;
                }
                .home-map-region-chips::-webkit-scrollbar,
                .home-map-price-chips::-webkit-scrollbar {
                    display: none;
                }
                .home-map-region-chips button,
                .home-map-price-chips button,
                .home-map-open-button {
                    align-items: center;
                    border-radius: 999px;
                    cursor: pointer;
                    display: inline-flex;
                    flex: 0 0 auto;
                    font: 850 0.68rem/1 'Inter', sans-serif;
                    justify-content: center;
                    min-height: 32px;
                    padding: 0 12px;
                    transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
                    white-space: nowrap;
                }
                .home-map-region-chips button {
                    background: rgba(255,255,255,0.74);
                    border: 1px solid rgba(184,148,95,0.24);
                    color: #3b3329;
                }
                .home-map-price-chips button {
                    background: rgba(245,241,234,0.74);
                    border: 1px solid rgba(184,148,95,0.2);
                    color: rgba(55,47,37,0.74);
                    font-size: 0.6rem;
                    min-height: 26px;
                    padding: 0 10px;
                }
                .home-map-region-chips button.active,
                .home-map-region-chips button:hover,
                .home-map-price-chips button.active,
                .home-map-price-chips button:hover {
                    background: #171410;
                    border-color: #171410;
                    color: #dfc18e;
                }
                .home-map-open-button {
                    background: linear-gradient(135deg, #d8b372, #b9904c);
                    border: 1px solid rgba(120,82,30,0.28);
                    box-shadow: 0 12px 26px rgba(120,82,30,0.22);
                    color: #171410;
                    font-size: 0.58rem;
                    min-height: 28px;
                    padding: 0 10px;
                }
                .home-map-open-button:hover {
                    transform: translateY(-1px);
                }
                .map-search-panel {
                    background: #fbfaf7;
                    display: grid;
                    gap: 10px;
                    padding: 16px;
                }
                .map-search-panel-new {
                    align-content: center;
                    background: transparent;
                    bottom: 22px;
                    left: 50%;
                    max-width: 980px;
                    padding: 0;
                    pointer-events: none;
                    position: absolute;
                    transform: translateX(-50%);
                    width: min(980px, calc(100% - 440px));
                    z-index: 760;
                }
                .map-search-panel-new :global(.home-search-box-map) {
                    pointer-events: auto;
                    width: 100%;
                }
                .home-map-search-panel {
                    max-width: 960px;
                    width: min(960px, calc(100% - 40px));
                }
                .home-map-search-panel--overlay {
                    bottom: auto;
                    top: clamp(18px, 3vw, 34px);
                }
                .home-map-search-panel--desktop {
                    background: transparent;
                    display: none !important;
                    margin: clamp(16px, 2.2vw, 24px) auto 0;
                    padding: 0;
                    pointer-events: auto;
                }
                .home-map-search-panel :global(.home-search-box-map .home-search-panel) {
                    backdrop-filter: none;
                    -webkit-backdrop-filter: none;
                    background: transparent;
                    border: 0;
                    border-radius: 0;
                    box-shadow: none;
                    display: grid;
                    gap: 6px;
                    grid-template-areas:
                        "selects location";
                    grid-template-columns: minmax(220px, 0.84fr) minmax(0, 1.16fr);
                    max-width: none;
                    padding: 0;
                }
                .home-map-search-panel :global(.home-search-box-map .home-search-select-row) {
                    grid-area: selects;
                }
                .home-map-search-panel :global(.home-search-box-map .home-search-location-row) {
                    grid-area: location;
                    margin-top: 0;
                }
                .home-map-search-panel :global(.home-search-box-map select),
                .home-map-search-panel :global(.home-search-box-map input) {
                    background: rgba(255, 255, 255, 0.96);
                    border-color: rgba(184, 148, 95, 0.38);
                    border-radius: 5px;
                    box-shadow: 0 12px 24px rgba(17, 13, 8, 0.18);
                    height: 38px;
                }
                .home-map-search-panel :global(.home-search-box-map .home-search-location-row > button) {
                    border-radius: 5px;
                    height: 38px;
                }
                .home-preview-map-panel .map-lock-hint {
                    top: clamp(72px, 9vw, 94px);
                }
                .map-preview-panel.is-preview-open .map-search-panel-new,
                .map-preview-panel.is-preview-open .home-map-invite,
                .map-preview-panel.is-preview-open .map-preview-stat,
                .map-preview-panel.is-preview-open .map-lock-hint,
                .map-preview-panel.is-preview-open :global(.map-mobile-action-dock),
                .map-preview-panel.is-preview-open :global(.map-context-layer-strip),
                .map-preview-panel.is-preview-open :global(.map-amenity-layer-strip),
                .map-preview-panel.is-preview-open :global(.leaflet-control-zoom) {
                    opacity: 0;
                    pointer-events: none;
                    transform: translateY(8px);
                    visibility: hidden;
                }
                .map-preview-panel.is-preview-open .map-search-panel-new {
                    transform: translate(-50%, 8px);
                }
                .map-preview-panel.is-preview-open .mobile-map-search-panel {
                    transform: translateY(8px);
                }
                .home-map-property-preview {
                    inset: 0;
                    overflow: hidden;
                    pointer-events: none;
                    position: absolute;
                    z-index: 820;
                }
                .home-map-property-preview :global(.map-property-preview) {
                    z-index: 2;
                }
                .home-map-property-preview--compact :global(.map-property-preview) {
                    bottom: 16px;
                }
                .home-map-property-preview--compact :global(.map-preview-track) {
                    padding-inline: 12px;
                    scroll-padding-inline: 12px;
                }
                .home-map-property-preview--compact :global(.map-preview-card) {
                    cursor: pointer;
                    flex-basis: min(360px, 100%);
                }
                .legacy-map-search-panel[hidden] {
                    display: none !important;
                }
                .mobile-map-modal-backdrop {
                    align-items: center;
                    background: rgba(15,13,10,0.58);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    display: grid;
                    inset: 0;
                    justify-items: center;
                    padding: max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom));
                    position: fixed;
                    z-index: 5000;
                }
                .mobile-map-modal {
                    background: #fffdf8;
                    border: 1px solid rgba(223,193,142,0.3);
                    border-radius: 18px;
                    box-shadow: 0 28px 80px rgba(0,0,0,0.34);
                    display: grid;
                    grid-template-rows: auto minmax(0, 1fr);
                    height: min(780px, calc(100svh - 24px));
                    max-width: 520px;
                    overflow: hidden;
                    width: min(100%, 520px);
                }
                .mobile-map-modal-head {
                    align-items: center;
                    background: rgba(255,253,248,0.96);
                    border-bottom: 1px solid rgba(184,148,95,0.16);
                    display: flex;
                    gap: 12px;
                    justify-content: space-between;
                    padding: 12px 12px 11px 16px;
                    position: relative;
                    z-index: 3;
                }
                .mobile-map-modal-head div {
                    display: grid;
                    gap: 3px;
                    min-width: 0;
                }
                .mobile-map-modal-head span {
                    color: #a78042;
                    font: 950 0.62rem/1 'Inter', sans-serif;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                }
                .mobile-map-modal-head strong {
                    color: #211c16;
                    font: 850 0.86rem/1.12 'Inter', sans-serif;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .mobile-map-modal-head button {
                    align-items: center;
                    background: #171410;
                    border: 0;
                    border-radius: 999px;
                    color: #dfc18e;
                    cursor: pointer;
                    display: inline-flex;
                    flex: 0 0 auto;
                    height: 38px;
                    justify-content: center;
                    width: 38px;
                }
                .mobile-map-modal-body {
                    min-height: 0;
                    position: relative;
                }
                .mobile-map-preview-panel {
                    --sv-sheet-top: 78%;
                    border-radius: 0;
                    height: 100%;
                    min-height: 0;
                }
                .mobile-map-search-panel {
                    bottom: calc(14px + env(safe-area-inset-bottom));
                    left: 10px;
                    max-width: none;
                    right: 10px;
                    transform: none;
                    width: auto;
                }
                .mobile-map-preview-stat {
                    bottom: calc(124px + env(safe-area-inset-bottom));
                    left: 12px;
                }
                .search-heading {
                    color: #5b3d12;
                    font: 950 0.72rem/1 'Inter', sans-serif;
                    letter-spacing: 0.16em;
                    text-align: center;
                    text-transform: uppercase;
                }
                .compact-search-grid {
                    display: grid;
                    gap: 10px;
                    grid-template-columns: minmax(0, 1.18fr) minmax(0, 0.82fr);
                }
                .step-filter-grid {
                    display: none;
                    gap: 10px;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
                .mobile-filter-dock {
                    display: block;
                }
                .mobile-quiz-panel {
                    background: #fff;
                    border: 1px solid rgba(116,104,88,0.14);
                    border-radius: 12px;
                    box-shadow: 0 9px 22px rgba(31,27,21,0.07);
                    display: grid;
                    gap: 7px;
                    padding: 9px;
                }
                .is-guide-active .mobile-quiz-panel {
                    border-color: rgba(200,168,98,0.7);
                    box-shadow: 0 0 0 3px rgba(200,168,98,0.18), 0 14px 30px rgba(31,27,21,0.12);
                    position: relative;
                    z-index: 2;
                }
                .guided-search-coach {
                    background: #171410;
                    border: 1px solid rgba(223,193,142,0.28);
                    border-radius: 10px;
                    box-shadow: 0 16px 34px rgba(31,27,21,0.22);
                    color: #fff8ea;
                    padding: 10px 11px;
                }
                .guided-search-coach span {
                    color: #dfc18e;
                    display: block;
                    font: 900 0.58rem/1 'Inter', sans-serif;
                    letter-spacing: 0.12em;
                    margin-bottom: 5px;
                    text-transform: uppercase;
                }
                .guided-search-coach strong {
                    color: #fff8ea;
                    display: block;
                    font: 900 0.86rem/1.08 'Inter', sans-serif;
                    letter-spacing: 0;
                }
                .guided-search-coach p {
                    color: rgba(255,248,234,0.78);
                    font: 700 0.72rem/1.35 'Inter', sans-serif;
                    margin: 4px 0 0;
                }
                .is-guide-submit-ready .search-submit {
                    outline: 3px solid rgba(200,168,98,0.32);
                    outline-offset: 2px;
                }
                .mobile-quiz-progress {
                    align-items: center;
                    color: #4f4435;
                    display: grid;
                    gap: 8px;
                    grid-template-columns: auto minmax(0, 1fr);
                }
                .mobile-quiz-progress span {
                    font: 900 0.58rem/1 'Inter', sans-serif;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                }
                .mobile-quiz-progress i {
                    background: rgba(116,104,88,0.15);
                    border-radius: 999px;
                    display: block;
                    height: 5px;
                    overflow: hidden;
                    position: relative;
                }
                .mobile-quiz-progress i::after {
                    background: #171410;
                    border-radius: inherit;
                    content: '';
                    inset: 0 auto 0 0;
                    position: absolute;
                    width: var(--quiz-progress);
                }
                .mobile-quiz-question {
                    align-items: center;
                    display: grid;
                    gap: 7px;
                    grid-template-columns: 28px minmax(0, 1fr) auto;
                }
                .mobile-quiz-question button {
                    align-items: center;
                    background: #f4efe6;
                    border: 1px solid rgba(116,104,88,0.12);
                    border-radius: 999px;
                    color: #171410;
                    cursor: pointer;
                    display: inline-flex;
                    height: 28px;
                    justify-content: center;
                    padding: 0;
                    width: 28px;
                }
                .mobile-quiz-question button:disabled {
                    cursor: default;
                    opacity: 0.3;
                }
                .mobile-quiz-question h3 {
                    color: #211c16;
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: 1.03rem;
                    font-weight: 780;
                    letter-spacing: 0;
                    line-height: 1.08;
                    margin: 0;
                    overflow-wrap: anywhere;
                }
                .mobile-quiz-question strong {
                    background: rgba(200,168,98,0.17);
                    border-radius: 999px;
                    color: #171410;
                    font: 950 0.63rem/1 'Inter', sans-serif;
                    max-width: 86px;
                    overflow: hidden;
                    padding: 6px 8px;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .mobile-quiz-panel :global(.step-filter) {
                    border: 0;
                    box-shadow: none;
                    gap: 5px;
                    padding: 0;
                }
                .mobile-quiz-panel :global(.step-filter-head) {
                    display: none;
                }
                .home-map-search :global(.step-filter) {
                    background: #fff;
                    border: 1px solid rgba(116,104,88,0.14);
                    border-radius: 10px;
                    box-shadow: 0 8px 22px rgba(31,27,21,0.05);
                    display: grid;
                    gap: 6px;
                    min-width: 0;
                    padding: 9px 10px 8px;
                }
                .home-map-search :global(.step-filter-head) {
                    align-items: center;
                    display: grid;
                    gap: 8px;
                    grid-template-columns: minmax(0, 1fr) auto;
                }
                .home-map-search :global(.step-filter-head span) {
                    align-items: center;
                    color: #4f4435;
                    display: inline-flex;
                    font: 900 0.62rem/1 'Inter', sans-serif;
                    gap: 5px;
                    letter-spacing: 0.12em;
                    min-width: 0;
                    text-transform: uppercase;
                }
                .home-map-search :global(.step-filter-head svg) {
                    color: #a78042;
                    flex: 0 0 auto;
                }
                .home-map-search :global(.step-filter-head strong) {
                    color: #211c16;
                    font: 950 0.72rem/1 'Inter', sans-serif;
                    max-width: 112px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .home-map-search :global(.step-filter-track) {
                    display: flex;
                    height: 24px;
                    position: relative;
                }
                .home-map-search :global(.step-filter-track input) {
                    appearance: none;
                    background:
                        linear-gradient(90deg, #171410 0%, #171410 var(--filter-progress), rgba(116,104,88,0.18) var(--filter-progress), rgba(116,104,88,0.18) 100%);
                    border-radius: 999px;
                    cursor: grab;
                    height: 6px;
                    margin: auto 0;
                    outline: 0;
                    width: 100%;
                }
                .home-map-search :global(.step-filter-track input:active) {
                    cursor: grabbing;
                }
                .home-map-search :global(.step-filter-track input::-webkit-slider-thumb) {
                    -webkit-appearance: none;
                    background: #171410;
                    border: 4px solid #dfc18e;
                    border-radius: 999px;
                    box-shadow: 0 8px 16px rgba(31,27,21,0.22);
                    height: 22px;
                    width: 22px;
                }
                .home-map-search :global(.step-filter-track input::-moz-range-thumb) {
                    background: #171410;
                    border: 4px solid #dfc18e;
                    border-radius: 999px;
                    box-shadow: 0 8px 16px rgba(31,27,21,0.22);
                    height: 15px;
                    width: 15px;
                }
                .home-map-search :global(.step-filter-options) {
                    display: flex;
                    gap: 4px;
                    justify-content: space-between;
                    min-width: 0;
                }
                .home-map-search :global(.step-filter-options button) {
                    background: transparent;
                    border: 0;
                    border-radius: 999px;
                    color: #4f4435;
                    cursor: pointer;
                    flex: 1 1 0;
                    font: 900 0.56rem/1 'Inter', sans-serif;
                    min-width: 0;
                    overflow: hidden;
                    padding: 4px 2px;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .home-map-search :global(.step-filter-options button.active) {
                    background: rgba(143,95,26,0.16);
                    color: #171410;
                }
                .field {
                    min-width: 0;
                    position: relative;
                }
                .field label {
                    color: #746858;
                    display: block;
                    font: 900 0.64rem/1 'Inter', sans-serif;
                    letter-spacing: 0.12em;
                    margin: 0 0 6px;
                    text-transform: uppercase;
                }
                .input-wrap,
                .select-wrap {
                    align-items: center;
                    background: #fff;
                    border: 1px solid rgba(116,104,88,0.22);
                    border-radius: 8px;
                    display: grid;
                    gap: 8px;
                    grid-template-columns: 17px minmax(0, 1fr) auto;
                    min-height: 40px;
                    padding: 0 12px;
                }
                .input-wrap svg,
                .select-wrap svg {
                    color: #c9a96e;
                }
                .input-wrap input,
                .select-wrap select {
                    background: transparent;
                    border: 0;
                    color: #211c16;
                    font: 750 0.82rem/1 'Inter', sans-serif;
                    min-width: 0;
                    outline: 0;
                    width: 100%;
                }
                .select-wrap select {
                    appearance: none;
                }
                .chevron {
                    color: #a78042 !important;
                    pointer-events: none;
                }
                .purpose-switch {
                    background: #f2eee6;
                    border: 1px solid rgba(116,104,88,0.14);
                    border-radius: 8px;
                    display: grid;
                    gap: 4px;
                    grid-template-columns: 1fr 1fr;
                    padding: 4px;
                }
                .purpose-switch button {
                    background: transparent;
                    border: 0;
                    border-radius: 6px;
                    color: #746858;
                    cursor: pointer;
                    font: 900 0.76rem/1 'Inter', sans-serif;
                    min-height: 32px;
                }
                .purpose-switch button.active {
                    background: #171410;
                    color: #dfc18e;
                    box-shadow: 0 7px 16px rgba(31,27,21,0.14);
                }
                .search-submit {
                    align-items: center;
                    background: #c8a862;
                    border: 0;
                    border-radius: 8px;
                    color: #10100e;
                    cursor: pointer;
                    display: inline-flex;
                    font: 950 0.8rem/1 'Inter', sans-serif;
                    gap: 9px;
                    justify-content: center;
                    letter-spacing: 0.1em;
                    min-height: 40px;
                    text-transform: uppercase;
                }
                .search-submit.is-ready {
                    animation: nextButtonCue 1.45s ease-in-out infinite;
                    box-shadow: 0 0 0 0 rgba(200,168,98,0.42), 0 10px 22px rgba(31,27,21,0.14);
                }
                @keyframes nextButtonCue {
                    0%, 100% {
                        transform: translateX(0);
                        box-shadow: 0 0 0 0 rgba(200,168,98,0.42), 0 10px 22px rgba(31,27,21,0.14);
                    }
                    18% {
                        transform: translateX(3px);
                    }
                    36% {
                        transform: translateX(-2px);
                    }
                    58% {
                        transform: translateX(0);
                        box-shadow: 0 0 0 8px rgba(200,168,98,0), 0 12px 26px rgba(31,27,21,0.18);
                    }
                }
                .search-actions {
                    display: grid;
                    gap: 8px;
                    grid-template-columns: 1fr 1fr;
                }
                .utility-button {
                    align-items: center;
                    background: #fff;
                    border: 1px solid rgba(116,104,88,0.16);
                    border-radius: 8px;
                    color: #211c16;
                    cursor: pointer;
                    display: inline-flex;
                    font: 850 0.78rem/1 'Inter', sans-serif;
                    gap: 8px;
                    justify-content: center;
                    min-height: 36px;
                }
                .utility-button strong {
                    align-items: center;
                    background: #171410;
                    border-radius: 999px;
                    color: #dfc18e;
                    display: inline-flex;
                    font-size: 0.66rem;
                    height: 18px;
                    justify-content: center;
                    min-width: 18px;
                    padding: 0 5px;
                }
                .utility-button.muted {
                    color: #746858;
                }
                .utility-button.advanced-toggle {
                    justify-self: start;
                    min-width: 36px;
                    width: 36px;
                    padding: 0;
                }
                .suggestions-dropdown {
                    background: #fff;
                    border: 1px solid rgba(116,104,88,0.18);
                    border-radius: 10px;
                    box-shadow: 0 18px 38px rgba(31,27,21,0.16);
                    display: grid;
                    left: 0;
                    margin-top: 6px;
                    max-height: 246px;
                    overflow: auto;
                    padding: 6px;
                    position: absolute;
                    right: 0;
                    top: 100%;
                    z-index: 800;
                }
                .suggestion-item {
                    align-items: center;
                    background: transparent;
                    border: 0;
                    border-radius: 8px;
                    color: #211c16;
                    cursor: pointer;
                    display: grid;
                    gap: 9px;
                    grid-template-columns: 28px minmax(0, 1fr);
                    min-height: 42px;
                    padding: 7px;
                    text-align: left;
                }
                .suggestion-item:hover {
                    background: rgba(184,148,95,0.09);
                }
                .suggestion-icon {
                    align-items: center;
                    background: #f4efe6;
                    border-radius: 8px;
                    color: #a78042;
                    display: inline-flex;
                    height: 28px;
                    justify-content: center;
                    width: 28px;
                }
                .suggestion-text {
                    display: grid;
                    gap: 3px;
                    min-width: 0;
                }
                .suggestion-text strong {
                    color: #211c16;
                    font: 850 0.78rem/1.15 'Inter', sans-serif;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .suggestion-text small,
                .suggestion-loading {
                    color: #746858;
                    font: 750 0.68rem/1.2 'Inter', sans-serif;
                }
                .suggestion-loading {
                    padding: 12px;
                    text-align: center;
                }
                .advanced-filter-panel {
                    background: rgba(184,148,95,0.07);
                    border: 1px solid rgba(184,148,95,0.16);
                    border-radius: 10px;
                    color: #746858;
                    display: grid;
                    gap: 10px;
                    padding: 10px;
                }
                .advanced-filter-head {
                    align-items: center;
                    display: flex;
                    gap: 8px;
                    justify-content: space-between;
                }
                .advanced-filter-head strong {
                    color: #211c16;
                    font-size: 0.82rem;
                }
                .advanced-filter-head span {
                    font-size: 0.78rem;
                    font-weight: 700;
                }
                .filter-chip-grid {
                    display: grid;
                    gap: 6px;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
                .filter-chip {
                    align-items: center;
                    background: #fff;
                    border: 1px solid rgba(116,104,88,0.12);
                    border-radius: 999px;
                    color: #211c16;
                    cursor: pointer;
                    display: inline-grid;
                    gap: 6px;
                    grid-template-columns: 15px minmax(0, 1fr) auto;
                    min-height: 34px;
                    padding: 0 9px;
                }
                .filter-chip svg {
                    color: #a78042;
                }
                .filter-chip span {
                    color: #211c16;
                    font: 850 0.72rem/1 'Inter', sans-serif;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .filter-chip small {
                    color: #746858;
                    font: 850 0.66rem/1 'Inter', sans-serif;
                }
                .filter-chip.active {
                    background: #171410;
                    border-color: #171410;
                }
                .filter-chip.active span,
                .filter-chip.active small,
                .filter-chip.active svg {
                    color: #dfc18e;
                }
                @media (min-width: 900px) {
                    .map-preview-panel {
                        height: clamp(520px, 38vw, 660px);
                        min-height: 520px;
                    }
                    .home-map-search-panel--overlay {
                        display: none;
                    }
                    .home-map-search-panel--desktop {
                        display: grid !important;
                    }
                    .home-map-property-preview--compact :global(.map-property-preview) {
                        bottom: 24px;
                        left: 50%;
                        right: auto;
                        width: min(980px, calc(100% - 48px));
                        transform: translateX(-50%);
                    }
                    .home-map-property-preview--compact :global(.map-preview-track) {
                        gap: 12px;
                        padding-inline: 12px;
                        scroll-padding-inline: 12px;
                    }
                    .home-map-property-preview--compact :global(.map-preview-card) {
                        flex-basis: clamp(260px, 28vw, 306px);
                        max-width: 100%;
                        grid-template-columns: 1fr;
                        min-height: 0;
                    }
                    .home-map-property-preview--compact :global(.map-preview-media),
                    .home-map-property-preview--compact :global(.map-preview-media img) {
                        height: 150px;
                        min-height: 150px;
                    }
                    .home-map-property-preview--compact :global(.map-preview-body) {
                        padding: 8px 12px 10px;
                    }
                    .home-map-property-preview--compact :global(.map-preview-body-link) {
                        gap: 5px;
                    }
                    .home-map-property-preview--compact :global(.map-preview-title) {
                        font-size: 0.78rem;
                        line-height: 1.08;
                        -webkit-line-clamp: 2;
                    }
                    .home-map-property-preview--compact :global(.map-preview-price) {
                        font-size: 0.8rem;
                    }
                    .home-map-property-preview--compact :global(.map-preview-location) {
                        font-size: 0.48rem;
                    }
                    .home-map-property-preview--compact :global(.map-preview-stats .map-preview-stat:nth-child(n+3)) {
                        display: none;
                    }
                    .home-map-property-preview--compact :global(.map-preview-swipe-hint) {
                        margin-top: 1px;
                    }
                    .mobile-map-modal-backdrop {
                        padding: clamp(20px, 4vw, 44px);
                    }
                    .mobile-map-modal {
                        border-radius: 22px;
                        height: min(780px, calc(100vh - 72px));
                        max-width: 1180px;
                        width: min(1180px, calc(100vw - 72px));
                    }
                    .mobile-map-modal-head {
                        padding: 14px 18px 13px 20px;
                    }
                    .mobile-map-modal-body {
                        overflow: hidden;
                    }
                    .mobile-map-preview-panel {
                        height: 100%;
                        min-height: 0;
                    }
                    .mobile-map-search-panel {
                        bottom: 22px;
                        left: 24px;
                        max-width: none;
                        right: 24px;
                        width: auto;
                    }
                    .mobile-map-modal .home-map-property-preview :global(.map-property-preview) {
                        bottom: 28px;
                        right: 28px;
                        width: min(520px, calc(100% - 56px));
                    }
                    .map-search-panel {
                        align-content: center;
                        gap: 14px;
                        padding: 20px clamp(22px, 4vw, 54px) 24px;
                    }
                    .map-search-panel-new {
                        justify-items: stretch;
                    }
                    .mobile-quiz-panel {
                        gap: 14px;
                        padding: 18px;
                    }
                    .mobile-quiz-progress span {
                        font-size: 0.66rem;
                    }
                    .mobile-quiz-question {
                        gap: 10px;
                        grid-template-columns: 34px minmax(0, 1fr) auto;
                    }
                    .mobile-quiz-question button {
                        height: 34px;
                        width: 34px;
                    }
                    .mobile-quiz-question h3 {
                        font-size: 1.42rem;
                    }
                    .mobile-quiz-question strong {
                        font-size: 0.72rem;
                        max-width: 120px;
                        padding: 8px 11px;
                    }
                    .mobile-quiz-panel :global(.step-filter-track) {
                        height: 30px;
                    }
                    .mobile-quiz-panel :global(.step-filter-track input::-webkit-slider-thumb) {
                        height: 26px;
                        width: 26px;
                    }
                    .mobile-quiz-panel :global(.step-filter-options button) {
                        font-size: 0.64rem;
                        padding: 6px 4px;
                    }
                    .search-actions {
                        grid-template-columns: 1fr;
                    }
                    .advanced-toggle {
                        display: none;
                    }
                }
                @media (min-width: 1180px) {
                    .compact-search-grid {
                        grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
                    }
                }
                @media (max-width: 640px) {
                    .home-map-search {
                        margin: 8px auto 24px;
                        padding: 0 6px;
                    }
                    .map-search-copy {
                        margin-bottom: 10px;
                        padding: 0 6px;
                    }
                    .map-search-copy h2 {
                        font-size: 0.99rem;
                        line-height: 1.03;
                        white-space: nowrap;
                    }
                    .map-search-copy p {
                        font-size: 0.76rem;
                        line-height: 1.35;
                        margin-top: 6px;
                    }
                    .map-search-shell {
                        border-radius: 14px;
                        max-width: 100%;
                        overflow: visible;
                        width: 100%;
                    }
                    .map-preview-panel {
                        border-radius: 14px;
                        height: clamp(390px, 68svh, 460px);
                    }
                    .home-preview-map-panel {
                        height: clamp(430px, 70svh, 540px);
                    }
                    .home-map-invite {
                        border-radius: 14px;
                        bottom: 8px;
                        gap: 7px;
                        grid-template-columns: minmax(0, 1fr) auto;
                        left: 8px;
                        max-width: none;
                        padding: 8px;
                        right: 8px;
                        transform: none;
                        width: auto;
                    }
                    .home-map-invite-copy {
                        grid-row: auto;
                    }
                    .home-map-region-chips,
                    .home-map-price-row {
                        grid-column: 1 / -1;
                    }
                    .home-map-invite-copy span {
                        font-size: 0.5rem;
                    }
                    .home-map-invite-copy strong {
                        font-size: 0.76rem;
                    }
                    .home-map-region-chips {
                        gap: 5px;
                    }
                    .home-map-price-chips {
                        gap: 4px;
                    }
                    .home-map-price-row {
                        gap: 5px;
                    }
                    .home-map-region-chips button,
                    .home-map-price-chips button,
                    .home-map-open-button {
                        font-size: 0.58rem;
                        min-height: 28px;
                        padding: 0 9px;
                    }
                    .home-map-price-chips button {
                        font-size: 0.52rem;
                        min-height: 24px;
                        padding: 0 8px;
                    }
                    .home-map-open-button {
                        max-width: 128px;
                        min-width: 112px;
                    }
                    .mobile-map-modal {
                        border-radius: 16px;
                        height: calc(100svh - 24px);
                    }
                    .mobile-map-preview-panel {
                        border-radius: 0;
                        height: 100%;
                    }
                    .map-preview-stat {
                        bottom: 104px;
                        left: 10px;
                        padding: 4px 6px;
                        z-index: 545;
                    }
                    .mobile-map-preview-stat {
                        bottom: calc(122px + env(safe-area-inset-bottom));
                        left: 10px;
                        z-index: 545;
                    }
                    .map-search-panel {
                        gap: 7px;
                        padding: 8px;
                    }
                    .map-search-panel-new {
                        min-width: 0;
                        overflow: visible;
                        inset: auto 8px 10px;
                        transform: none;
                        width: auto;
                        z-index: 760;
                    }
                    .home-map-search-panel {
                        inset: 12px 12px auto;
                        max-width: none;
                        transform: none;
                        width: auto;
                    }
                    .home-map-search-panel :global(.home-search-box-map .home-search-panel) {
                        gap: 7px;
                        grid-template-areas:
                            "selects selects"
                            "location location";
                        grid-template-columns: minmax(0, 1fr);
                        padding: 0;
                    }
                    .home-map-search-panel :global(.home-search-box-map select),
                    .home-map-search-panel :global(.home-search-box-map input),
                    .home-map-search-panel :global(.home-search-box-map .home-search-location-row > button) {
                        height: 36px;
                    }
                    .home-preview-map-panel .map-lock-hint {
                        top: 112px;
                    }
                    .mobile-map-search-panel {
                        bottom: calc(12px + env(safe-area-inset-bottom));
                        left: 10px;
                        right: 10px;
                    }
                    .search-heading {
                        display: none;
                    }
                    .compact-search-grid {
                        gap: 8px;
                        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                    }
                    .step-filter-grid {
                        display: none;
                    }
                    .mobile-filter-dock {
                        display: block;
                    }
                    .mobile-quiz-panel {
                        gap: 6px;
                        padding: 8px;
                    }
                    .guided-search-coach {
                        padding: 10px;
                    }
                    .guided-search-coach strong {
                        font-size: 0.8rem;
                    }
                    .guided-search-coach p {
                        font-size: 0.68rem;
                    }
                    .mobile-quiz-question {
                        grid-template-columns: 26px minmax(0, 1fr) auto;
                    }
                    .mobile-quiz-question button {
                        height: 26px;
                        width: 26px;
                    }
                    .mobile-quiz-question h3 {
                        font-size: 0.96rem;
                    }
                    .mobile-quiz-question strong {
                        max-width: 78px;
                        padding: 5px 7px;
                    }
                    .mobile-quiz-panel :global(.step-filter) {
                        border: 0;
                        box-shadow: none;
                        gap: 4px;
                        padding: 0;
                    }
                    .mobile-quiz-panel :global(.step-filter-head) {
                        display: none;
                    }
                    .home-map-search :global(.step-filter) {
                        border-radius: 9px;
                        gap: 5px;
                        padding: 8px 8px 7px;
                    }
                    .home-map-search :global(.step-filter-head) {
                        gap: 4px;
                    }
                    .home-map-search :global(.step-filter-head span) {
                        font-size: 0.54rem;
                        gap: 4px;
                        letter-spacing: 0.09em;
                    }
                    .home-map-search :global(.step-filter-head strong) {
                        font-size: 0.66rem;
                        max-width: 78px;
                    }
                    .home-map-search :global(.step-filter-track) {
                        height: 20px;
                    }
                    .home-map-search :global(.step-filter-track input::-webkit-slider-thumb) {
                        height: 20px;
                        width: 20px;
                    }
                    .home-map-search :global(.step-filter-options) {
                        gap: 2px;
                    }
                    .home-map-search :global(.step-filter-options button) {
                        font-size: 0.48rem;
                        padding: 3px 1px;
                    }
                    .field-location {
                        grid-column: 1 / 2;
                    }
                    .input-wrap,
                    .select-wrap {
                        gap: 7px;
                        grid-template-columns: 16px minmax(0, 1fr) auto;
                        min-height: 38px;
                        padding: 0 10px;
                    }
                    .input-wrap input,
                    .select-wrap select {
                        font-size: 0.76rem;
                    }
                    .purpose-switch button {
                        min-height: 30px;
                    }
                    .search-submit {
                        font-size: 0.74rem;
                        min-height: 36px;
                    }
                    .search-actions {
                        gap: 7px;
                    }
                    .utility-button {
                        font-size: 0.72rem;
                        min-height: 34px;
                    }
                    .advanced-filter-head {
                        align-items: flex-start;
                        display: grid;
                    }
                    .filter-chip-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }
                    .filter-chip {
                        min-height: 32px;
                        padding: 0 8px;
                    }
                    .filter-chip span {
                        font-size: 0.68rem;
                    }
                    .suggestions-dropdown {
                        left: -1px;
                        right: -1px;
                    }
                }
            `}</style>
        </section>
    )
}
