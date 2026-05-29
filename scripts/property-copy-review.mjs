import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local', quiet: true })

const args = new Set(process.argv.slice(2))
const shouldApply = args.has('--apply')
const overwrite = args.has('--overwrite')
const activeOnly = !args.has('--all-statuses')
const limitArg = process.argv.find(arg => arg.startsWith('--limit='))
const limit = limitArg ? Number(limitArg.split('=')[1]) : 5000
const PAGE_SIZE = 1000

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

const TITLE_LIMIT = 44
const SUMMARY_LIMIT = 124

function stripHtml(value) {
    return String(value || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function compactText(value, max) {
    const text = stripHtml(value)
    if (text.length <= max) return text
    const sliced = text.slice(0, max + 1)
    const lastSpace = sliced.lastIndexOf(' ')
    const cut = lastSpace > max * 0.62 ? sliced.slice(0, lastSpace) : sliced.slice(0, max - 1)
    return `${cut.replace(/[,.:\-–—;]+$/g, '').trim()}...`
}

function normalizeTitle(value) {
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

function normalizeLocation(property) {
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

function inferType(property) {
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

function featureLabel(property) {
    const joined = `${property.title || ''} ${property.description || ''} ${(property.amenities || []).join(' ')}`.toLowerCase()
    if (/frente\s*mar|beira\s*mar|pé\s*na\s*areia|pe\s*na\s*areia/.test(joined)) return 'frente mar'
    if (/vista\s*mar|vista\s*para\s*o\s*mar/.test(joined)) return 'com vista mar'
    if (/porto belo golf|golf resort/.test(joined)) return 'no Porto Belo Golf'
    if (/lançamento|lancamento|pré-lançamento|pre-lancamento/.test(joined)) return 'lançamento'
    if (property.exclusive) return 'exclusivo'
    return ''
}

function roomsLabel(property) {
    const suites = Number(property.suites || 0)
    const bedrooms = Number(property.bedrooms || 0)
    if (suites > 1 && suites >= bedrooms) return `${suites} suítes`
    if (suites === 1 && bedrooms <= 1) return '1 suíte'
    if (bedrooms > 0) return `${bedrooms} ${bedrooms === 1 ? 'dormitório' : 'dormitórios'}`
    return ''
}

function areaLabel(property) {
    const area = property.area_private_m2 || property.area_m2
    if (!area) return ''
    return `${Math.round(Number(area)).toLocaleString('pt-BR')} m²`
}

function buildGeneratedTitle(property) {
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

function buildGeneratedSummary(property) {
    const explicitSummary = stripHtml(property.seo_description)
    if (explicitSummary) return compactText(explicitSummary, SUMMARY_LIMIT)

    const location = normalizeLocation(property)
    const facts = [roomsLabel(property), areaLabel(property), featureLabel(property)].filter(Boolean)
    const type = inferType(property)
    const generated = facts.length
        ? `${type} em ${location}, com ${facts.join(', ')}. Curadoria Pilger para comprar com contexto.`
        : `${type} em ${location}, selecionado pela curadoria Pilger para compra com contexto.`

    return compactText(generated, SUMMARY_LIMIT)
}

async function fetchProperties() {
    const rows = []

    while (rows.length < limit) {
        const pageLimit = Math.min(PAGE_SIZE, limit - rows.length)
        const from = rows.length
        const to = from + pageLimit - 1
        let query = supabase
            .from('properties')
            .select('id,title,description,seo_title,seo_description,city,state,neighborhood,property_type,price,bedrooms,suites,area_m2,area_private_m2,amenities,exclusive,status')
            .order('created_at', { ascending: false })
            .range(from, to)

        if (activeOnly) query = query.eq('status', 'active')

        const { data, error } = await query
        if (error) throw error
        if (!data?.length) break

        rows.push(...data)
        if (data.length < pageLimit) break
    }

    return rows
}

async function applyUpdates(updates) {
    let updated = 0
    for (const update of updates) {
        const { error } = await supabase
            .from('properties')
            .update({
                seo_title: update.seo_title,
                seo_description: update.seo_description,
            })
            .eq('id', update.id)
        if (error) throw error
        updated += 1
        if (updated % 100 === 0) console.log(`Atualizados ${updated}/${updates.length}`)
    }
    return updated
}

const properties = await fetchProperties()
const updates = properties
    .map(property => ({
        id: property.id,
        original_title: stripHtml(property.title),
        seo_title: buildGeneratedTitle(property),
        seo_description: buildGeneratedSummary(property),
        current_seo_title: stripHtml(property.seo_title),
        current_seo_description: stripHtml(property.seo_description),
    }))
    .filter(item => overwrite || !item.current_seo_title || !item.current_seo_description)

const preview = updates.slice(0, 8).map(item => ({
    id: item.id,
    original_title: item.original_title,
    seo_title: item.seo_title,
    seo_description: item.seo_description,
}))

console.log(JSON.stringify({
    mode: shouldApply ? 'apply' : 'dry-run',
    activeOnly,
    overwrite,
    fetched: properties.length,
    pendingUpdates: updates.length,
    preview,
}, null, 2))

if (shouldApply) {
    const updated = await applyUpdates(updates)
    console.log(`Concluído: ${updated} imóveis revisados.`)
} else {
    console.log('Dry-run apenas. Use --apply para gravar em seo_title e seo_description.')
}
