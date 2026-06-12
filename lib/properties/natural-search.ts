export type ParsedNaturalSearch = {
    q?: string
    city?: string
    type?: string
    subtype?: string
    tag?: string
    bedroomsMin?: string
    suitesMin?: string
    bathroomsMin?: string
    parkingMin?: string
    areaMin?: string
    areaMax?: string
    priceMin?: string
    priceMax?: string
    hasStructuredFilters: boolean
}

function normalize(value: unknown) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
}

function readNumberNear(text: string, words: string[]) {
    for (const word of words) {
        const after = text.match(new RegExp(`(?:com|de|a partir de|mais de)?\\s*(\\d{1,2})\\s+${word}\\b`))
        if (after) return after[1]

        const before = text.match(new RegExp(`${word}\\s*(?:com|de)?\\s*(\\d{1,2})\\b`))
        if (before) return before[1]
    }

    return ''
}

function readArea(text: string, mode: 'min' | 'max') {
    const prefix = mode === 'min'
        ? '(?:acima de|a partir de|mais de|minimo|minima)'
        : '(?:ate|maximo|maxima)'
    const match = text.match(new RegExp(`${prefix}\\s*(\\d{2,5})\\s*(?:m2|m\\b|metros)`))
    return match?.[1] || ''
}

function parseMoneyValue(raw: string, unit?: string) {
    const compact = raw.replace(/\./g, '').replace(',', '.')
    const value = Number(compact)
    if (!Number.isFinite(value) || value <= 0) return 0
    const normalizedUnit = normalize(unit)

    if (normalizedUnit.startsWith('milhao') || normalizedUnit.startsWith('milhoes') || normalizedUnit === 'mi') {
        return Math.round(value * 1000000)
    }

    if (value < 1000) return Math.round(value * 1000000)
    return Math.round(value)
}

function readPrice(text: string, mode: 'min' | 'max') {
    if (/\b(mes|mensal|parcela|parcelas|aluguel)\b/.test(text)) return ''

    const prefix = mode === 'min'
        ? '(?:acima de|a partir de|mais de|minimo|minima)'
        : '(?:ate|maximo|maxima)'
    const match = text.match(new RegExp(`${prefix}\\s*(?:r\\$\\s*)?(\\d+(?:[\\.,]\\d+)?)\\s*(milhoes?|milhao|mi)?`))
    if (!match) return ''

    const parsed = parseMoneyValue(match[1], match[2])
    return parsed ? String(parsed) : ''
}

function detectCity(text: string) {
    if (/\bpraia brava\b|\bitajai\b/.test(text)) return 'Praia Brava'
    if (/\bbalneario camboriu\b|\bbc\b/.test(text)) return 'Balneario Camboriu'
    if (/\bitapema\b/.test(text)) return 'Itapema'
    if (/\bporto belo\b/.test(text)) return 'Porto Belo'
    if (/\bcamboriu\b/.test(text)) return 'Camboriu'
    if (/\bbombinhas\b/.test(text)) return 'Bombinhas'
    if (/\bnavegantes\b/.test(text)) return 'Navegantes'
    if (/\bpenha\b/.test(text)) return 'Penha'
    return ''
}

function detectPropertyType(text: string) {
    if (/\bcobertura\b/.test(text)) return { subtype: 'cobertura' }
    if (/\bgarden\b/.test(text)) return { subtype: 'garden' }
    if (/\bduplex\b|\btriplex\b/.test(text)) return { subtype: 'duplex' }
    if (/\bloft\b/.test(text)) return { subtype: 'loft' }
    if (/\bsobrado\b/.test(text)) return { subtype: 'sobrado' }
    if (/\bgalpao\b|\bdeposito\b/.test(text)) return { subtype: 'galpao' }
    if (/\bsala comercial\b/.test(text)) return { subtype: 'sala-comercial' }
    if (/\bterreno comercial\b/.test(text)) return { subtype: 'terreno-comercial' }
    if (/\bterreno\b.*\bcondominio\b|\bcondominio\b.*\bterreno\b/.test(text)) return { subtype: 'terreno-condominio' }
    if (/\bterreno\b/.test(text)) return { type: 'Terreno' }
    if (/\bcasa\b.*\bcondominio\b|\bcondominio\b.*\bcasa\b/.test(text)) return { subtype: 'condominio' }
    if (/\bcasa\b/.test(text)) return { type: 'Casa' }
    if (/\bapartamento\b|\bapt\b|\bapto\b/.test(text)) return { type: 'Apartamento' }
    if (/\bcomercial\b/.test(text)) return { type: 'Comercial' }
    return {}
}

function detectTag(text: string) {
    if (/\bfrente mar\b|\bfrente ao mar\b/.test(text)) return 'frente-mar'
    if (/\bvista mar\b|\bvista para o mar\b/.test(text)) return 'vista-mar'
    if (/\bquadra mar\b|\bquadra do mar\b/.test(text)) return 'quadra-mar'
    if (/\blancamento\b|\bna planta\b/.test(text)) return 'lancamento'
    if (/\bem construcao\b/.test(text)) return 'em-construcao'
    if (/\bpronto\b|\bpronto para morar\b/.test(text)) return 'pronto'
    if (/\bmobiliado\b|\bmobiliada\b/.test(text)) return 'mobiliado'
    return ''
}

export function parseNaturalSearch(input: string | null | undefined): ParsedNaturalSearch {
    const raw = String(input || '').trim()
    const text = normalize(raw)
    const parsed: ParsedNaturalSearch = { hasStructuredFilters: false }

    if (!text) return parsed

    const city = detectCity(text)
    const propertyType = detectPropertyType(text)
    const tag = detectTag(text)
    const bedroomsMin = readNumberNear(text, ['dormitorios?', 'quartos?'])
    const suitesMin = readNumberNear(text, ['suites?'])
    const bathroomsMin = readNumberNear(text, ['banheiros?'])
    const parkingMin = readNumberNear(text, ['vagas?'])
    const areaMin = readArea(text, 'min')
    const areaMax = readArea(text, 'max')
    const priceMin = readPrice(text, 'min')
    const priceMax = readPrice(text, 'max')

    if (city) parsed.city = city
    if (propertyType.type) parsed.type = propertyType.type
    if (propertyType.subtype) parsed.subtype = propertyType.subtype
    if (tag) parsed.tag = tag
    if (bedroomsMin) parsed.bedroomsMin = bedroomsMin
    if (suitesMin) parsed.suitesMin = suitesMin
    if (bathroomsMin) parsed.bathroomsMin = bathroomsMin
    if (parkingMin) parsed.parkingMin = parkingMin
    if (areaMin) parsed.areaMin = areaMin
    if (areaMax) parsed.areaMax = areaMax
    if (priceMin) parsed.priceMin = priceMin
    if (priceMax) parsed.priceMax = priceMax

    parsed.hasStructuredFilters = Object.keys(parsed).some(key => key !== 'q' && key !== 'hasStructuredFilters' && Boolean(parsed[key as keyof ParsedNaturalSearch]))
    if (!parsed.hasStructuredFilters) parsed.q = raw

    return parsed
}

export function appendNaturalSearchParams(params: URLSearchParams, input: string) {
    const parsed = parseNaturalSearch(input)

    if (parsed.q) params.set('q', parsed.q)
    if (parsed.city) params.set('city', parsed.city)
    if (parsed.type) params.set('type', parsed.type)
    if (parsed.subtype) params.set('subtype', parsed.subtype)
    if (parsed.tag) params.set('tag', parsed.tag)
    if (parsed.bedroomsMin) params.set('bedroomsMin', parsed.bedroomsMin)
    if (parsed.suitesMin) params.set('suitesMin', parsed.suitesMin)
    if (parsed.bathroomsMin) params.set('bathroomsMin', parsed.bathroomsMin)
    if (parsed.parkingMin) params.set('parkingMin', parsed.parkingMin)
    if (parsed.areaMin) params.set('areaMin', parsed.areaMin)
    if (parsed.areaMax) params.set('areaMax', parsed.areaMax)
    if (parsed.priceMin) params.set('priceMin', parsed.priceMin)
    if (parsed.priceMax) params.set('priceMax', parsed.priceMax)

    return parsed
}
