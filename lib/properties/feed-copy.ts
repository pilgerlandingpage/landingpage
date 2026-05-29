import { cleanPropertyText } from '@/lib/properties/text'

export type PropertyFeedCopySource = {
    title?: string | null
    description?: string | null
    seo_title?: string | null
    seo_description?: string | null
    city?: string | null
    state?: string | null
    neighborhood?: string | null
    property_type?: string | null
    price?: number | null
    bedrooms?: number | null
    suites?: number | null
    area_m2?: number | null
    area_private_m2?: number | null
    amenities?: string[] | null
    exclusive?: boolean | null
}

export type PropertyFeedCopy = {
    title: string
    subtitle: string
    summary: string
}

const TITLE_LIMIT = 44
const SUMMARY_LIMIT = 124

function stripHtml(value?: string | null) {
    return cleanPropertyText(value)
        .replace(/\s+/g, ' ')
        .trim()
}

function compactText(value: string, max: number) {
    const text = stripHtml(value)
    if (text.length <= max) return text
    const sliced = text.slice(0, max + 1)
    const lastSpace = sliced.lastIndexOf(' ')
    const cut = lastSpace > max * 0.62 ? sliced.slice(0, lastSpace) : sliced.slice(0, max - 1)
    return `${cut.replace(/[,.:\-–—;]+$/g, '').trim()}...`
}

function normalizeTitle(value?: string | null) {
    return stripHtml(value)
        .replace(/\bquartos?\b/gi, 'dormitórios')
        .replace(/\bapto\b\.?/gi, 'Apartamento')
        .replace(/\bap\.?\b/gi, 'Apartamento')
        .replace(/\bpré[-\s]?lançamento\b/gi, 'Lançamento')
        .replace(/\bpre[-\s]?lançamento\b/gi, 'Lançamento')
        .replace(/\s*[-–—]\s*(Balne[aá]rio Cambori[uú]|Itapema|Porto Belo|Praia Brava|Itaja[ií]|SC).*$/i, '')
        .replace(/\b(c[oó]digo|ref\.?|refer[eê]ncia|sku)\s*[:#-]?\s*\w+/gi, '')
        .replace(/\bR\$\s*[\d.,]+(?:\s*(mi|milh[õo]es?))?/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
}

function normalizeLocation(property: PropertyFeedCopySource) {
    const neighborhood = stripHtml(property.neighborhood)
    const city = stripHtml(property.city)
    const state = stripHtml(property.state)
    const location = neighborhood || city || state
    if (/itajai|itajaí/i.test(location) && /praia brava/i.test(`${neighborhood} ${property.title || ''}`)) {
        return 'Praia Brava'
    }
    if (/^centro$/i.test(neighborhood) && city) return `Centro de ${city}`
    return location || 'Litoral catarinense'
}

function inferType(property: PropertyFeedCopySource) {
    const propertyType = `${property.property_type || ''}`.toLowerCase()
    const title = `${property.title || ''}`.toLowerCase()
    const raw = `${propertyType} ${title}`
    if (raw.includes('terreno')) return 'Terreno'
    if (raw.includes('cobertura')) return 'Cobertura'
    if (raw.includes('casa') || raw.includes('mansão') || raw.includes('mansao')) return 'Casa'
    if (raw.includes('sala comercial')) return 'Sala comercial'
    if (propertyType.includes('garden') || /\bapartamento\s+garden\b/.test(title)) return 'Garden'
    if (raw.includes('apartamento') || raw.includes('apto')) return 'Apartamento'
    return stripHtml(property.property_type) || 'Imóvel'
}

function featureLabel(property: PropertyFeedCopySource) {
    const joined = `${property.title || ''} ${property.description || ''} ${(property.amenities || []).join(' ')}`.toLowerCase()
    if (/frente\s*mar|beira\s*mar|pé\s*na\s*areia|pe\s*na\s*areia/.test(joined)) return 'frente mar'
    if (/vista\s*mar|vista\s*para\s*o\s*mar/.test(joined)) return 'com vista mar'
    if (/porto belo golf|golf resort/.test(joined)) return 'no Porto Belo Golf'
    if (/lançamento|lancamento|pré-lançamento|pre-lancamento/.test(joined)) return 'lançamento'
    if (property.exclusive) return 'exclusivo'
    return ''
}

function roomsLabel(property: PropertyFeedCopySource) {
    const suites = Number(property.suites || 0)
    const bedrooms = Number(property.bedrooms || 0)
    if (suites > 1 && suites >= bedrooms) return `${suites} suítes`
    if (suites === 1 && bedrooms <= 1) return '1 suíte'
    if (bedrooms > 0) return `${bedrooms} ${bedrooms === 1 ? 'dormitório' : 'dormitórios'}`
    return ''
}

function areaLabel(property: PropertyFeedCopySource) {
    const area = property.area_private_m2 || property.area_m2
    if (!area) return ''
    return `${Math.round(Number(area)).toLocaleString('pt-BR')} m²`
}

function buildGeneratedTitle(property: PropertyFeedCopySource) {
    const original = normalizeTitle(property.seo_title || property.title)
    if (original && original.length <= TITLE_LIMIT) return original

    const type = inferType(property)
    const feature = featureLabel(property)
    const location = normalizeLocation(property)
    const rooms = roomsLabel(property)

    const candidates = [
        [type, feature, location ? `em ${location}` : ''].filter(Boolean).join(' '),
        [type, rooms ? `com ${rooms}` : '', location ? `em ${location}` : ''].filter(Boolean).join(' '),
        [type, location ? `em ${location}` : ''].filter(Boolean).join(' '),
        original,
    ].filter(Boolean)

    return compactText(candidates.find(candidate => candidate.length <= TITLE_LIMIT) || candidates[0] || 'Imóvel de alto padrão', TITLE_LIMIT)
}

function buildGeneratedSubtitle(property: PropertyFeedCopySource) {
    const parts = [
        featureLabel(property) || inferType(property),
        roomsLabel(property),
        normalizeLocation(property),
    ].filter(Boolean)
    return compactText(parts.join(' • '), 72)
}

function buildGeneratedSummary(property: PropertyFeedCopySource) {
    const explicitSummary = stripHtml(property.seo_description)
    if (explicitSummary) return compactText(explicitSummary, SUMMARY_LIMIT)

    const location = normalizeLocation(property)
    const facts = [roomsLabel(property), areaLabel(property), featureLabel(property)].filter(Boolean)
    const type = inferType(property).toLowerCase()
    const generated = facts.length
        ? `${inferType(property)} em ${location}, com ${facts.join(', ')}. Curadoria Pilger para comprar com contexto.`
        : `${type.charAt(0).toUpperCase()}${type.slice(1)} em ${location}, selecionado pela curadoria Pilger para compra com contexto.`

    return compactText(generated, SUMMARY_LIMIT)
}

export function buildPropertyFeedCopy(property: PropertyFeedCopySource): PropertyFeedCopy {
    return {
        title: buildGeneratedTitle(property),
        subtitle: buildGeneratedSubtitle(property),
        summary: buildGeneratedSummary(property),
    }
}
