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
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import MapSearch from './MapSearch'
import { searchLocationName } from '@/lib/locations/display'
import { trackEvent } from '@/lib/tracking/client'

type Property = {
    id: string
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
    description?: string | null
    source_status?: string | null
    exclusive?: boolean | null
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

const LOCATION_STEPS: StepOption[] = [
    { value: '', label: 'Todas', shortLabel: 'Todas' },
    { value: 'Balneário Camboriú', label: 'B. Camboriú', shortLabel: 'B. Camboriú' },
    { value: 'Praia Brava', label: 'Praia Brava', shortLabel: 'Praia Brava' },
    { value: 'Itapema', label: 'Itapema', shortLabel: 'Itapema' },
    { value: 'Porto Belo', label: 'Porto Belo', shortLabel: 'Porto Belo' },
]

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

function hasHomeMapCoordinate(property: Property) {
    const lat = toCoordinate(property.latitude)
    const lng = toCoordinate(property.longitude)

    const insideServiceArea = (nextLat: number, nextLng: number) => (
        Number.isFinite(nextLat) &&
        Number.isFinite(nextLng) &&
        nextLat >= -30.5 &&
        nextLat <= -25.0 &&
        nextLng >= -54.5 &&
        nextLng <= -47.0
    )

    return insideServiceArea(lat, lng) || insideServiceArea(lng, lat)
}

function hasCoordinates(property: Property) {
    return hasHomeMapCoordinate(property)
}

function matchesMinimumFirstContactPrice(property: Property) {
    return Number(property.price || property.rent || 0) >= MINIMUM_FIRST_CONTACT_PRICE
}

function matchesType(property: Property, type: string) {
    if (type === 'all') return true
    const text = normalize(`${property.property_type || ''} ${property.title || ''}`)
    if (type === 'Comercial') return ['comercial', 'galpao', 'sala', 'predio'].some(term => text.includes(term))
    if (type === 'Casa em Condominio') return text.includes('casa') && text.includes('condom')
    return text.includes(normalize(type))
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
    const [query, setQuery] = useState('')
    const [type, setType] = useState('all')
    const [price, setPrice] = useState('')
    const [purpose, setPurpose] = useState<'sale' | 'rent'>('sale')
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [isDesktopFilters, setIsDesktopFilters] = useState(false)
    const [mobileQuizStep, setMobileQuizStep] = useState(0)
    const [answeredQuizSteps, setAnsweredQuizSteps] = useState<MobileFilterKey[]>([])
    const [activeChips, setActiveChips] = useState<string[]>([])
    const wrapperRef = useRef<HTMLDivElement>(null)
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
                if (value !== query) trackFilterChanged('location', 'Localizacao', value, LOCATION_STEPS, 'quiz')
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
    const isMapInteractionLocked = mobileQuizStep < mobileFilters.length - 1
    const shouldRenderMap = true
    const shouldPulseNextButton = mobileQuizStep < mobileFilters.length - 1 && answeredQuizSteps.includes(activeMobileQuizConfig.id)
    const mobileQuizProgressStyle = {
        '--quiz-progress': `${((mobileQuizStep + 1) / mobileFilters.length) * 100}%`,
    } as CSSProperties
    const searchSubmitLabel = mobileQuizStep < mobileFilters.length - 1
        ? 'Próximo'
        : filteredProperties.length ? `Ver ${filteredProperties.length} imóveis` : 'Buscar imóveis'

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

        const params = buildSearchParams()
        const queryString = params.toString()
        void trackEvent('home_map_search_submitted', {
            ...getSearchSnapshot(),
            destination: queryString ? `/busca?${queryString}` : '/busca',
        })
        router.push(queryString ? `/busca?${queryString}` : '/busca')
    }

    const clearSearch = () => {
        void trackEvent('home_map_search_cleared', getSearchSnapshot())
        setQuery('')
        setType('all')
        setPrice('')
        setPurpose('sale')
        setActiveChips([])
        setMobileQuizStep(0)
        setAnsweredQuizSteps([])
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
        const mediaQuery = window.matchMedia('(min-width: 900px)')
        const syncDesktopFilters = () => setIsDesktopFilters(mediaQuery.matches)

        syncDesktopFilters()
        mediaQuery.addEventListener('change', syncDesktopFilters)

        return () => mediaQuery.removeEventListener('change', syncDesktopFilters)
    }, [])

    return (
        <section className="home-map-search" id="mapa">
            <div className="map-search-shell" ref={wrapperRef}>
                <div className={`map-preview-panel ${isMapInteractionLocked ? 'is-map-locked' : ''}`}>
                    {shouldRenderMap ? (
                        <MapSearch properties={filteredProperties} refitKey={mapRefitKey} />
                    ) : (
                        <div className="map-preview-placeholder" aria-hidden="true">
                            <div className="map-placeholder-grid" />
                            <span className="map-placeholder-pin"><MapPin size={18} /></span>
                        </div>
                    )}
                    <div className="map-preview-stat">
                        <Building2 size={14} />
                        <span>{filteredMappedTotal} de {mappedTotal} no mapa</span>
                    </div>
                    {isMapInteractionLocked && <div className="map-interaction-lock" aria-hidden="true" />}
                </div>

                <form className="map-search-panel" onSubmit={applySearch}>
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

                    <div className="step-filter-grid">
                        <FilterStepControl
                            label="Localização"
                            icon={<MapPin size={14} />}
                            options={LOCATION_STEPS}
                            value={query}
                            onChange={(value) => {
                                if (value !== query) trackFilterChanged('location', 'Localizacao', value, LOCATION_STEPS, 'desktop')
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
                        <button type="button" className="utility-button advanced-toggle" onClick={toggleAdvancedFilters} aria-expanded={showAdvancedPanel}>
                            <Filter size={15} />
                            <span>Mais filtros</span>
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
                    max-width: 1560px;
                    overflow: hidden;
                    position: relative;
                    z-index: 0;
                }
                .map-preview-panel {
                    background: #1f1b16;
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
                    background: rgba(23,20,16,0.82);
                    border: 1px solid rgba(223,193,142,0.24);
                    border-radius: 999px;
                    bottom: 16px;
                    color: #fff8ea;
                    display: inline-flex;
                    font: 850 0.72rem/1 'Inter', sans-serif;
                    gap: 8px;
                    left: 16px;
                    letter-spacing: 0.08em;
                    padding: 10px 13px;
                    position: absolute;
                    text-transform: uppercase;
                    z-index: 650;
                }
                .map-interaction-lock {
                    background: transparent;
                    cursor: default;
                    inset: 0;
                    position: absolute;
                    touch-action: pan-y;
                    z-index: 700;
                }
                .map-search-panel {
                    background: #fbfaf7;
                    display: grid;
                    gap: 10px;
                    padding: 16px;
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
                    .map-search-shell {
                        display: grid;
                        align-items: stretch;
                        grid-template-columns: minmax(0, 1.48fr) minmax(360px, 0.72fr);
                    }
                    .map-preview-panel {
                        align-self: stretch;
                        height: auto;
                        min-height: 535px;
                    }
                    .map-search-panel {
                        align-content: center;
                        gap: 14px;
                        padding: 22px;
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
                        padding: 0 14px;
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
                    }
                    .map-preview-panel {
                        height: clamp(390px, 68svh, 460px);
                    }
                    .map-search-panel {
                        gap: 7px;
                        padding: 8px;
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
