export type PropertyFinancialSnapshot = {
    id?: string | null
    title?: string | null
    city?: string | null
    neighborhood?: string | null
    status?: string | null
    source_reference?: string | null
    price?: number | string | null
    condo_fee?: number | string | null
    iptu?: number | string | null
    area_m2?: number | string | null
    area_private_m2?: number | string | null
}

export type PropertyPriceHistoryRow = {
    id?: string
    property_id: string
    event_type: string
    previous_price?: number | string | null
    new_price?: number | string | null
    previous_condo_fee?: number | string | null
    new_condo_fee?: number | string | null
    previous_iptu?: number | string | null
    new_iptu?: number | string | null
    previous_price_per_m2?: number | string | null
    new_price_per_m2?: number | string | null
    area_m2?: number | string | null
    source?: string | null
    changed_by?: string | null
    metadata?: Record<string, unknown> | null
    created_at?: string | null
}

type PriceHistoryInsert = Omit<PropertyPriceHistoryRow, 'id' | 'created_at'>

type RecordPriceHistoryOptions = {
    property: PropertyFinancialSnapshot
    previousProperty?: PropertyFinancialSnapshot | null
    eventType?: string
    source?: string
    changedBy?: string | null
    metadata?: Record<string, unknown>
}

const TRACKED_FINANCIAL_FIELDS = ['price', 'condo_fee', 'iptu'] as const
const PRICE_HISTORY_FETCH_TIMEOUT_MS = 7000

function createPriceHistoryAbortSignal(timeoutMs = PRICE_HISTORY_FETCH_TIMEOUT_MS) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        return AbortSignal.timeout(timeoutMs)
    }

    const controller = new AbortController()
    setTimeout(() => controller.abort(), timeoutMs)
    return controller.signal
}

function numericOrNull(value: unknown) {
    if (value === null || value === undefined || value === '') return null
    const parsed = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

function sameNumericValue(first: unknown, second: unknown) {
    const left = numericOrNull(first)
    const right = numericOrNull(second)
    return left === right
}

function areaFor(property: PropertyFinancialSnapshot) {
    return numericOrNull(property.area_private_m2) || numericOrNull(property.area_m2)
}

function pricePerSquareMeter(property: PropertyFinancialSnapshot) {
    const price = numericOrNull(property.price)
    const area = areaFor(property)

    if (!price || !area) return null
    return price / area
}

function hasAnyFinancialValue(property: PropertyFinancialSnapshot) {
    return TRACKED_FINANCIAL_FIELDS.some(field => numericOrNull(property[field]) !== null)
}

function hasFinancialChange(previous: PropertyFinancialSnapshot, next: PropertyFinancialSnapshot) {
    return TRACKED_FINANCIAL_FIELDS.some(field => !sameNumericValue(previous[field], next[field]))
}

function inferEventType(previous: PropertyFinancialSnapshot | null | undefined, next: PropertyFinancialSnapshot, fallback = 'financial_update') {
    if (!previous) return fallback

    const previousPrice = numericOrNull(previous.price)
    const nextPrice = numericOrNull(next.price)
    const priceChanged = !sameNumericValue(previous.price, next.price)
    const costsChanged = !sameNumericValue(previous.condo_fee, next.condo_fee) || !sameNumericValue(previous.iptu, next.iptu)

    if (priceChanged && previousPrice !== null && nextPrice !== null) {
        if (nextPrice < previousPrice) return 'price_reduced'
        if (nextPrice > previousPrice) return 'price_increased'
        return 'price_updated'
    }

    if (priceChanged) return 'price_updated'
    if (costsChanged) return 'costs_updated'
    return fallback
}

export function buildPropertyPriceHistoryInsert(options: RecordPriceHistoryOptions): PriceHistoryInsert | null {
    const previous = options.previousProperty || null
    const next = options.property
    const propertyId = next.id

    if (!propertyId) return null
    if (previous && !hasFinancialChange(previous, next)) return null
    if (!previous && !hasAnyFinancialValue(next)) return null

    const area = areaFor(next)
    const metadata = {
        property_title: next.title || null,
        city: next.city || null,
        neighborhood: next.neighborhood || null,
        source_reference: next.source_reference || null,
        previous_status: previous?.status || null,
        new_status: next.status || null,
        ...(options.metadata || {}),
    }

    return {
        property_id: propertyId,
        event_type: options.eventType || inferEventType(previous, next),
        previous_price: previous ? numericOrNull(previous.price) : null,
        new_price: numericOrNull(next.price),
        previous_condo_fee: previous ? numericOrNull(previous.condo_fee) : null,
        new_condo_fee: numericOrNull(next.condo_fee),
        previous_iptu: previous ? numericOrNull(previous.iptu) : null,
        new_iptu: numericOrNull(next.iptu),
        previous_price_per_m2: previous ? pricePerSquareMeter(previous) : null,
        new_price_per_m2: pricePerSquareMeter(next),
        area_m2: area,
        source: options.source || 'admin',
        changed_by: options.changedBy || null,
        metadata,
    }
}

export async function recordPropertyPriceHistory(supabase: any, options: RecordPriceHistoryOptions) {
    const insertPayload = buildPropertyPriceHistoryInsert(options)

    if (!insertPayload) {
        return { recorded: false, skipped: true }
    }

    const { error } = await supabase
        .from('property_price_history')
        .insert(insertPayload)

    if (error) {
        console.warn('[Property Price History] Unable to record financial event:', error.message)
        return { recorded: false, skipped: false, error: error.message }
    }

    return { recorded: true, skipped: false }
}

export async function fetchPropertyPriceHistory(supabase: any, propertyId: string, limit = 12): Promise<PropertyPriceHistoryRow[]> {
    const { data, error } = await supabase
        .from('property_price_history')
        .select([
            'id',
            'property_id',
            'event_type',
            'previous_price',
            'new_price',
            'previous_condo_fee',
            'new_condo_fee',
            'previous_iptu',
            'new_iptu',
            'previous_price_per_m2',
            'new_price_per_m2',
            'area_m2',
            'source',
            'metadata',
            'created_at',
        ].join(', '))
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false })
        .limit(limit)
        .abortSignal(createPriceHistoryAbortSignal())

    if (error) {
        console.warn('[Property Price History] Unable to fetch financial events:', error.message)
        return []
    }

    return Array.isArray(data) ? data : []
}
