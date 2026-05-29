'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Building2, ChevronLeft, Home, MapPin, RotateCcw, Search, Sparkles } from 'lucide-react'
import { displayLocationName, searchLocationName } from '@/lib/locations/display'
import { trackEvent } from '@/lib/tracking/client'

type StepOption = {
    value: string
    label: string
    shortLabel?: string
}

type FilterKey = 'location' | 'type' | 'price' | 'purpose'

type FilterConfig = {
    id: FilterKey
    label: string
    question: string
    icon: ReactNode
    options: StepOption[]
    value: string
    onChange: (value: string) => void
}

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

const PRICE_PRESETS: StepOption[] = [
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

function selectedOptionLabel(options: StepOption[], value: string) {
    const option = options.find(item => item.value === value) || options[0]
    return option?.shortLabel || option?.label || 'Todos'
}

function selectedOptionFullLabel(options: StepOption[], value: string) {
    const option = options.find(item => item.value === value) || options[0]
    return option?.label || option?.shortLabel || 'Todos'
}

function optionValue(options: StepOption[], value: string | null, fallback: string) {
    if (!value) return fallback
    return options.find(option => option.value.toLowerCase() === value.toLowerCase())?.value || fallback
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
        <div className="srq-step-filter">
            <div className="srq-step-filter-head">
                <span>{icon}{label}</span>
                <strong>{selected?.label}</strong>
            </div>
            <div className="srq-step-filter-track" style={sliderStyle}>
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
            <div className="srq-step-filter-options" aria-hidden="true">
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

interface SearchQuizPanelProps {
    resultsCount: number
    mappedCount: number
    onSearchComplete?: () => void
}

export default function SearchQuizPanel({ resultsCount, mappedCount, onSearchComplete }: SearchQuizPanelProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [query, setQuery] = useState('')
    const [type, setType] = useState('all')
    const [price, setPrice] = useState('')
    const [purpose, setPurpose] = useState<'sale' | 'rent'>('sale')
    const [quizStep, setQuizStep] = useState(0)
    const [answeredSteps, setAnsweredSteps] = useState<FilterKey[]>([])

    useEffect(() => {
        setQuery(displayLocationName(searchParams.get('q') || searchParams.get('city') || ''))
        setType(optionValue(TYPE_STEPS, searchParams.get('type'), 'all'))
        setPrice(optionValue(PRICE_PRESETS, searchParams.get('price'), ''))
        setPurpose(searchParams.get('offer') === 'rent' ? 'rent' : 'sale')
    }, [searchParams])

    const markAnswered = useCallback((step: FilterKey) => {
        setAnsweredSteps(current => current.includes(step) ? current : [...current, step])
    }, [])

    const getSnapshot = useCallback(() => ({
        query: searchLocationName(query),
        type_value: type,
        type_label: selectedOptionFullLabel(TYPE_STEPS, type),
        price_value: price || 'all',
        price_label: selectedOptionFullLabel(PRICE_PRESETS, price),
        purpose_value: purpose,
        purpose_label: selectedOptionFullLabel(PURPOSE_STEPS, purpose),
        results_count: resultsCount,
        mapped_count: mappedCount,
        source: 'search_results_panel',
    }), [mappedCount, price, purpose, query, resultsCount, type])

    const trackFilterChanged = useCallback((filterId: FilterKey, filterLabel: string, value: string, options: StepOption[]) => {
        void trackEvent('home_map_filter_changed', {
            ...getSnapshot(),
            filter_id: filterId,
            filter_label: filterLabel,
            value: value || 'all',
            value_label: selectedOptionFullLabel(options, value),
            source: 'search_results_panel',
            quiz_step: quizStep + 1,
        })
    }, [getSnapshot, quizStep])

    const filters = useMemo<FilterConfig[]>(() => [
        {
            id: 'location',
            label: 'Localizacao',
            question: 'Onde voce quer morar?',
            icon: <MapPin size={13} />,
            options: LOCATION_STEPS,
            value: query,
            onChange: (value: string) => {
                if (value !== query) trackFilterChanged('location', 'Localizacao', value, LOCATION_STEPS)
                setQuery(value)
                markAnswered('location')
            },
        },
        {
            id: 'type',
            label: 'Tipo',
            question: 'Que tipo de imovel procura?',
            icon: <Home size={13} />,
            options: TYPE_STEPS,
            value: type,
            onChange: (value: string) => {
                if (value !== type) trackFilterChanged('type', 'Tipo', value, TYPE_STEPS)
                setType(value)
                markAnswered('type')
            },
        },
        {
            id: 'price',
            label: 'Valor',
            question: 'Qual faixa de valor?',
            icon: <Sparkles size={13} />,
            options: PRICE_PRESETS,
            value: price,
            onChange: (value: string) => {
                if (value !== price) trackFilterChanged('price', 'Valor', value, PRICE_PRESETS)
                setPrice(value)
                markAnswered('price')
            },
        },
        {
            id: 'purpose',
            label: 'Oferta',
            question: 'Compra ou aluguel?',
            icon: <Building2 size={13} />,
            options: PURPOSE_STEPS,
            value: purpose,
            onChange: (value: string) => {
                const nextPurpose = value === 'rent' ? 'rent' : 'sale'
                if (nextPurpose !== purpose) trackFilterChanged('purpose', 'Oferta', nextPurpose, PURPOSE_STEPS)
                setPurpose(nextPurpose)
                markAnswered('purpose')
            },
        },
    ], [markAnswered, price, purpose, query, trackFilterChanged, type])

    const activeFilter = filters[quizStep] || filters[0]
    const progressStyle = { '--quiz-progress': `${((quizStep + 1) / filters.length) * 100}%` } as CSSProperties
    const shouldPulseNextButton = quizStep < filters.length - 1 && answeredSteps.includes(activeFilter.id)

    const buildSearchParams = useCallback(() => {
        const params = new URLSearchParams()
        const term = searchLocationName(query.trim())

        if (term) params.set('q', term)
        if (type !== 'all') params.set('type', type)
        if (price) params.set('price', price)
        if (purpose) params.set('offer', purpose)

        return params
    }, [price, purpose, query, type])

    const applySearch = (event?: React.FormEvent) => {
        event?.preventDefault()

        if (quizStep < filters.length - 1) {
            void trackEvent('home_map_quiz_next_clicked', {
                ...getSnapshot(),
                filter_id: activeFilter.id,
                filter_label: activeFilter.label,
                value: activeFilter.value || 'all',
                value_label: selectedOptionFullLabel(activeFilter.options, activeFilter.value),
                step_number: quizStep + 1,
                step_total: filters.length,
            })
            setQuizStep(current => Math.min(current + 1, filters.length - 1))
            return
        }

        const params = buildSearchParams()
        const queryString = params.toString()
        const destination = queryString ? `/busca?${queryString}` : '/busca'

        void trackEvent('home_map_search_submitted', {
            ...getSnapshot(),
            destination,
        })
        onSearchComplete?.()
        router.push(destination)
    }

    const clearSearch = () => {
        void trackEvent('home_map_search_cleared', getSnapshot())
        setQuery('')
        setType('all')
        setPrice('')
        setPurpose('sale')
        setQuizStep(0)
        setAnsweredSteps([])
    }

    const goPreviousQuizStep = () => {
        void trackEvent('home_map_quiz_back_clicked', {
            ...getSnapshot(),
            step_number: quizStep + 1,
            step_total: filters.length,
            filter_id: activeFilter.id,
            filter_label: activeFilter.label,
        })
        setQuizStep(current => Math.max(0, current - 1))
    }

    return (
        <form className="srq-panel" onSubmit={applySearch}>
            <div className="srq-heading">Nova pesquisa</div>

            <div className="srq-quiz-panel">
                <div className="srq-quiz-progress" style={progressStyle}>
                    <span>{quizStep + 1} de {filters.length}</span>
                    <i aria-hidden="true" />
                </div>

                <div className="srq-quiz-question">
                    <button
                        type="button"
                        onClick={goPreviousQuizStep}
                        disabled={quizStep === 0}
                        aria-label="Voltar pergunta"
                    >
                        <ChevronLeft size={17} />
                    </button>
                    <h3>{activeFilter.question}</h3>
                    <strong>{selectedOptionLabel(activeFilter.options, activeFilter.value)}</strong>
                </div>

                <FilterStepControl
                    label={activeFilter.label}
                    icon={activeFilter.icon}
                    options={activeFilter.options}
                    value={activeFilter.value}
                    onChange={activeFilter.onChange}
                />
            </div>

            <button type="submit" className={`srq-submit ${shouldPulseNextButton ? 'is-ready' : ''}`} aria-label="Buscar">
                <Search size={17} strokeWidth={2.4} />
                <span>{quizStep < filters.length - 1 ? 'Proximo' : 'Ver imoveis'}</span>
            </button>

            <button type="button" className="srq-clear" onClick={clearSearch}>
                <RotateCcw size={15} />
                <span>Limpar</span>
            </button>

            <style jsx global>{`
                .srq-panel {
                    display: grid;
                    gap: 9px;
                }
                .srq-heading {
                    color: #a78042;
                    font: 950 0.6rem/1 'Inter', sans-serif;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                }
                .srq-quiz-panel {
                    background: #fff;
                    border: 1px solid rgba(116,104,88,0.14);
                    border-radius: 12px;
                    box-shadow: 0 9px 22px rgba(31,27,21,0.07);
                    display: grid;
                    gap: 7px;
                    padding: 9px;
                }
                .srq-quiz-progress {
                    align-items: center;
                    color: #8b806f;
                    display: grid;
                    gap: 8px;
                    grid-template-columns: auto minmax(0, 1fr);
                }
                .srq-quiz-progress span {
                    font: 900 0.58rem/1 'Inter', sans-serif;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                }
                .srq-quiz-progress i {
                    background: rgba(116,104,88,0.15);
                    border-radius: 999px;
                    display: block;
                    height: 5px;
                    overflow: hidden;
                    position: relative;
                }
                .srq-quiz-progress i::after {
                    background: #171410;
                    border-radius: inherit;
                    content: '';
                    inset: 0 auto 0 0;
                    position: absolute;
                    width: var(--quiz-progress);
                }
                .srq-quiz-question {
                    align-items: center;
                    display: grid;
                    gap: 7px;
                    grid-template-columns: 28px minmax(0, 1fr) auto;
                }
                .srq-quiz-question button {
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
                .srq-quiz-question button:disabled {
                    cursor: default;
                    opacity: 0.3;
                }
                .srq-quiz-question h3 {
                    color: #211c16;
                    font-family: 'Playfair Display', Georgia, serif;
                    font-size: 1.03rem;
                    font-weight: 780;
                    letter-spacing: 0;
                    line-height: 1.08;
                    margin: 0;
                    overflow-wrap: anywhere;
                }
                .srq-quiz-question strong {
                    background: rgba(200,168,98,0.17);
                    border-radius: 999px;
                    color: #171410;
                    font: 950 0.63rem/1 'Inter', sans-serif;
                    max-width: 88px;
                    overflow: hidden;
                    padding: 6px 8px;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .srq-step-filter {
                    display: grid;
                    gap: 5px;
                    min-width: 0;
                }
                .srq-step-filter-head {
                    display: none;
                }
                .srq-step-filter-track {
                    display: flex;
                    height: 24px;
                    position: relative;
                }
                .srq-step-filter-track input {
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
                .srq-step-filter-track input:active {
                    cursor: grabbing;
                }
                .srq-step-filter-track input::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    background: #171410;
                    border: 4px solid #dfc18e;
                    border-radius: 999px;
                    box-shadow: 0 8px 16px rgba(31,27,21,0.22);
                    height: 22px;
                    width: 22px;
                }
                .srq-step-filter-track input::-moz-range-thumb {
                    background: #171410;
                    border: 4px solid #dfc18e;
                    border-radius: 999px;
                    box-shadow: 0 8px 16px rgba(31,27,21,0.22);
                    height: 15px;
                    width: 15px;
                }
                .srq-step-filter-options {
                    display: flex;
                    gap: 4px;
                    justify-content: space-between;
                    min-width: 0;
                }
                .srq-step-filter-options button {
                    background: transparent;
                    border: 0;
                    border-radius: 999px;
                    color: #8b806f;
                    cursor: pointer;
                    flex: 1 1 0;
                    font: 850 0.56rem/1 'Inter', sans-serif;
                    min-width: 0;
                    overflow: hidden;
                    padding: 4px 2px;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .srq-step-filter-options button.active {
                    background: rgba(200,168,98,0.18);
                    color: #171410;
                }
                .srq-submit,
                .srq-clear {
                    align-items: center;
                    border-radius: 10px;
                    cursor: pointer;
                    display: inline-flex;
                    font: 950 0.72rem/1 'Inter', sans-serif;
                    gap: 8px;
                    justify-content: center;
                    min-height: 38px;
                    width: 100%;
                }
                .srq-submit {
                    background: #c8a862;
                    border: 0;
                    color: #10100e;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                }
                .srq-submit.is-ready {
                    animation: nextButtonCue 1.45s ease-in-out infinite;
                    box-shadow: 0 0 0 0 rgba(200,168,98,0.42), 0 10px 22px rgba(31,27,21,0.14);
                }
                .srq-clear {
                    background: #fff;
                    border: 1px solid rgba(116,104,88,0.16);
                    color: #746858;
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
            `}</style>
        </form>
    )
}
