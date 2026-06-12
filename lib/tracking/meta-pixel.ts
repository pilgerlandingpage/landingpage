export const DEFAULT_META_PIXEL_ID = '1660438131829465'

export function normalizeMetaPixelId(value: unknown) {
    const normalized = String(value || '').trim().replace(/\s+/g, '')
    return /^\d{5,30}$/.test(normalized) ? normalized : ''
}

export function resolveMetaPixelId(...values: unknown[]) {
    for (const value of values) {
        const normalized = normalizeMetaPixelId(value)
        if (normalized) return normalized
    }

    return DEFAULT_META_PIXEL_ID
}
