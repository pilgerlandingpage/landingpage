export type PropertyIntelligenceInput = {
    id?: string | null
    title?: string | null
    description?: string | null
    city?: string | null
    neighborhood?: string | null
    price?: number | string | null
    bedrooms?: number | string | null
    bathrooms?: number | string | null
    suites?: number | string | null
    parking_spaces?: number | string | null
    area_m2?: number | string | null
    area_private_m2?: number | string | null
    property_type?: string | null
    source_status?: string | null
    exclusive?: boolean | null
    amenities?: string[] | null
    created_at?: string | null
    updated_at?: string | null
}

export type PropertyIntelligenceLabel = {
    key: string
    label: string
    tone: 'gold' | 'dark' | 'green' | 'blue'
}

function normalizeText(value: unknown) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
}

export function toPropertyNumber(value: unknown) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0
    const normalized = String(value || '')
        .replace(/[^\d,.-]/g, '')
        .replace(/\./g, '')
        .replace(',', '.')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
}

export function getPropertyArea(property: PropertyIntelligenceInput) {
    return toPropertyNumber(property.area_private_m2 || property.area_m2)
}

export function getPropertyPricePerM2(property: PropertyIntelligenceInput) {
    const price = toPropertyNumber(property.price)
    const area = getPropertyArea(property)
    if (!price || !area) return 0
    return price / area
}

function wasUpdatedRecently(property: PropertyIntelligenceInput) {
    const rawDate = property.updated_at || property.created_at
    if (!rawDate) return false
    const time = new Date(rawDate).getTime()
    if (!Number.isFinite(time)) return false
    const days = (Date.now() - time) / 86400000
    return days >= 0 && days <= 45
}

function hasText(property: PropertyIntelligenceInput, pattern: RegExp) {
    const amenities = Array.isArray(property.amenities) ? property.amenities.join(' ') : ''
    const haystack = [
        property.title,
        property.description,
        property.property_type,
        property.source_status,
        property.neighborhood,
        property.city,
        amenities,
    ].map(normalizeText).join(' ')

    return pattern.test(haystack)
}

export function getPropertyIntelligenceLabels(
    property: PropertyIntelligenceInput,
    options: { max?: number; includeFrontSea?: boolean } = {}
) {
    const max = options.max ?? 3
    const labels: PropertyIntelligenceLabel[] = []
    const area = getPropertyArea(property)
    const price = toPropertyNumber(property.price)
    const suites = toPropertyNumber(property.suites)
    const parking = toPropertyNumber(property.parking_spaces)
    const typeText = normalizeText(property.property_type)
    const titleText = normalizeText(property.title)

    const push = (label: PropertyIntelligenceLabel) => {
        if (!labels.some(item => item.key === label.key)) labels.push(label)
    }

    if (property.exclusive) push({ key: 'exclusive', label: 'Exclusivo', tone: 'dark' })
    if (options.includeFrontSea !== false && hasText(property, /frente\s*(ao\s*)?mar|vista\s*(para\s*o\s*)?mar/)) {
        push({ key: 'sea', label: 'Vista mar', tone: 'blue' })
    }
    if (wasUpdatedRecently(property)) push({ key: 'fresh', label: 'Novo no radar', tone: 'green' })
    if (/lancamento|na planta|em construcao/.test(normalizeText(property.source_status)) || hasText(property, /lancamento|na planta|em construcao/)) {
        push({ key: 'launch', label: 'Lancamento', tone: 'gold' })
    }
    if (/cobertura|garden|duplex|triplex|penthouse/.test(`${typeText} ${titleText}`)) {
        push({ key: 'rare-profile', label: 'Perfil raro', tone: 'gold' })
    }
    if (suites >= 4) push({ key: 'family-premium', label: '4+ suites', tone: 'dark' })
    if (parking >= 4) push({ key: 'parking', label: 'Garagem ampla', tone: 'dark' })
    if (area >= 350) push({ key: 'large-plan', label: 'Planta ampla', tone: 'green' })
    if (price >= 10000000) push({ key: 'high-ticket', label: 'Ultra luxo', tone: 'gold' })

    return labels.slice(0, max)
}
