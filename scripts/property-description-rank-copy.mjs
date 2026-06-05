import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

dotenv.config({ path: '.env.local', quiet: true })

const args = new Set(process.argv.slice(2))
const shouldApply = args.has('--apply')
const overwriteSeo = !args.has('--preserve-seo')
const allStatuses = args.has('--all-statuses')
const limitArg = process.argv.find(arg => arg.startsWith('--limit='))
const statusArg = process.argv.find(arg => arg.startsWith('--status='))
const backupDirArg = process.argv.find(arg => arg.startsWith('--backup-dir='))
const limit = limitArg ? Number(limitArg.split('=')[1]) : 5000
const statusFilter = allStatuses ? null : (statusArg ? statusArg.split('=')[1] : 'active')
const PAGE_SIZE = 1000
const SEO_TITLE_LIMIT = 58
const SEO_DESCRIPTION_LIMIT = 155

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

function decodeHtml(value) {
    return String(value || '')
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
            const code = Number.parseInt(hex, 16)
            return Number.isFinite(code) ? String.fromCodePoint(code) : ' '
        })
        .replace(/&#(\d+);/g, (_, decimal) => {
            const code = Number.parseInt(decimal, 10)
            return Number.isFinite(code) ? String.fromCodePoint(code) : ' '
        })
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/gi, "'")
        .replace(/&ndash;/gi, '–')
        .replace(/&mdash;/gi, '—')
        .replace(/&bull;/gi, '•')
        .replace(/&rsquo;/gi, "'")
        .replace(/&lsquo;/gi, "'")
        .replace(/&rdquo;/gi, '"')
        .replace(/&ldquo;/gi, '"')
        .replace(/&ccedil;/gi, 'ç')
        .replace(/&aacute;/gi, 'á')
        .replace(/&agrave;/gi, 'à')
        .replace(/&atilde;/gi, 'ã')
        .replace(/&acirc;/gi, 'â')
        .replace(/&eacute;/gi, 'é')
        .replace(/&ecirc;/gi, 'ê')
        .replace(/&iacute;/gi, 'í')
        .replace(/&oacute;/gi, 'ó')
        .replace(/&otilde;/gi, 'õ')
        .replace(/&ocirc;/gi, 'ô')
        .replace(/&uacute;/gi, 'ú')
        .replace(/&[a-z0-9#]+;/gi, ' ')
}

function normalizeBedroomText(value) {
    return String(value || '')
        .replace(/\bQUARTOS\b/g, 'DORMITÓRIOS')
        .replace(/\bQuartos\b/g, 'Dormitórios')
        .replace(/\bquartos\b/g, 'dormitórios')
        .replace(/\bQUARTO\b/g, 'DORMITÓRIO')
        .replace(/\bQuarto\b/g, 'Dormitório')
        .replace(/\bquarto\b/g, 'dormitório')
}

function stripHtml(value) {
    return normalizeBedroomText(decodeHtml(value))
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<li>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D]/gu, ' ')
        .replace(/\r/g, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

function singleLine(value) {
    return stripHtml(value)
        .replace(/\s+/g, ' ')
        .trim()
}

function cleanTerminalPunctuation(value) {
    return String(value || '').replace(/[,.:\-–—;]+$/g, '').trim()
}

function compactText(value, max) {
    const text = singleLine(value)
    if (text.length <= max) return text
    const suffix = '...'
    const contentLimit = Math.max(1, max - suffix.length)
    const sliced = text.slice(0, contentLimit + 1)
    const lastSpace = sliced.lastIndexOf(' ')
    const cut = lastSpace > contentLimit * 0.62 ? sliced.slice(0, lastSpace) : sliced.slice(0, contentLimit)
    return `${cleanTerminalPunctuation(cut)}${suffix}`.slice(0, max)
}

function numberValue(value) {
    const parsed = Number(String(value || '').replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : 0
}

function integerLabel(value) {
    const number = numberValue(value)
    return number > 0 ? Math.round(number).toLocaleString('pt-BR') : ''
}

function areaLabel(property, includeKind = true) {
    const privateArea = numberValue(property.area_private_m2 || property.area_m2)
    const totalArea = numberValue(property.area_total_m2)
    if (privateArea > 0) {
        return `${integerLabel(privateArea)} m²${includeKind ? ' privativos' : ''}`
    }
    if (totalArea > 0) {
        return `${integerLabel(totalArea)} m²${includeKind ? ' totais' : ''}`
    }
    return ''
}

function normalizeTitle(value) {
    return singleLine(value)
        .replace(/\bapto\b\.?/gi, 'Apartamento')
        .replace(/\bap\.?\b/gi, 'Apartamento')
        .replace(/\bpré[-\s]?lançamento\b/gi, 'lançamento')
        .replace(/\bpre[-\s]?lancamento\b/gi, 'lançamento')
        .replace(/\s*[-–—]\s*(Balne[aá]rio Cambori[uú]|Itapema|Porto Belo|Praia Brava|Itaja[ií]|Bombinhas|SC).*$/i, '')
        .replace(/\b(código|codigo|ref\.?|referência|referencia|sku)\s*[:#-]?\s*\w+/gi, '')
        .replace(/\bR\$\s*[\d.,]+(?:\s*(mi|milhões?|milhao|milhoes))?/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
}

function normalizeLocationPart(value) {
    return singleLine(value)
        .replace(/^centro$/i, 'Centro')
        .replace(/balneario camboriu/gi, 'Balneário Camboriú')
        .replace(/itajai/gi, 'Itajaí')
        .trim()
}

function locationLabel(property) {
    const neighborhood = normalizeLocationPart(property.neighborhood)
    const city = normalizeLocationPart(property.city)
    const state = normalizeLocationPart(property.state)

    if (/praia brava/i.test(`${neighborhood} ${property.title || ''}`)) {
        return city && !/praia brava/i.test(city) ? `Praia Brava, ${city}` : 'Praia Brava'
    }

    if (/^centro$/i.test(neighborhood) && city) return `Centro de ${city}`
    if (neighborhood && city && neighborhood.toLowerCase() !== city.toLowerCase()) return `${neighborhood}, ${city}`
    return neighborhood || city || state || 'litoral catarinense'
}

function cityLabel(property) {
    const city = normalizeLocationPart(property.city)
    if (/praia brava/i.test(`${property.neighborhood || ''} ${property.title || ''}`)) return 'Praia Brava'
    return city || 'litoral catarinense'
}

function inferType(property) {
    const raw = `${property.property_type || ''} ${property.title || ''}`.toLowerCase()
    if (/galp[aã]o|dep[oó]sito|log[ií]stico|industrial/.test(raw)) return 'Galpão'
    if (/terreno|lote/.test(raw)) return 'Terreno'
    if (/cobertura|duplex|triplex/.test(raw)) return 'Cobertura'
    if (/casa|mans[aã]o|sobrado/.test(raw)) return 'Casa'
    if (/sala comercial|comercial|loja/.test(raw)) return 'Sala comercial'
    if (/garden/.test(raw)) return 'Garden'
    if (/apartamento|apto|flat/.test(raw)) return 'Apartamento'
    return singleLine(property.property_type) || 'Imóvel'
}

function typeIntent(type, location) {
    const local = String(location || '').toLowerCase()
    if (type === 'Terreno') return 'localização estratégica, potencial construtivo e valorização'
    if (type === 'Galpão') return 'operação, logística, área útil e acesso eficiente'
    if (type === 'Sala comercial') return 'visibilidade, endereço comercial e praticidade para operação'
    if (/praia brava/.test(local)) return 'lifestyle de praia, privacidade e alto padrão no litoral catarinense'
    if (/balne[aá]rio cambori[uú]/.test(local)) return 'liquidez, conveniência urbana e mercado imobiliário de alto padrão'
    if (/itapema|meia praia/.test(local)) return 'praia, conforto familiar e valorização no litoral'
    if (/porto belo|bombinhas/.test(local)) return 'natureza, exclusividade e qualidade de vida perto do mar'
    return 'conforto, localização e decisão de compra com contexto'
}

function purposeLabel(property) {
    const purpose = singleLine(property.purpose).toLowerCase()
    const hasRent = numberValue(property.rent) > 0
    const hasSale = numberValue(property.price) > 0
    if (/alug|loca/.test(purpose) || (hasRent && !hasSale)) return 'para locação'
    if (hasRent && hasSale) return 'à venda ou para locação'
    return 'à venda'
}

function roomFacts(property) {
    const bedrooms = numberValue(property.bedrooms)
    const suites = numberValue(property.suites)
    const bathrooms = numberValue(property.bathrooms)
    const parking = numberValue(property.parking_spaces)
    const facts = []

    if (bedrooms > 0 && suites > 0 && bedrooms > suites) {
        facts.push(`${integerLabel(bedrooms)} dormitórios, sendo ${integerLabel(suites)} ${suites === 1 ? 'suíte' : 'suítes'}`)
    } else if (suites > 0) {
        facts.push(`${integerLabel(suites)} ${suites === 1 ? 'suíte' : 'suítes'}`)
    } else if (bedrooms > 0) {
        facts.push(`${integerLabel(bedrooms)} ${bedrooms === 1 ? 'dormitório' : 'dormitórios'}`)
    }

    if (bathrooms > 0) facts.push(`${integerLabel(bathrooms)} ${bathrooms === 1 ? 'banheiro' : 'banheiros'}`)
    if (parking > 0) facts.push(`${integerLabel(parking)} ${parking === 1 ? 'vaga de garagem' : 'vagas de garagem'}`)

    const area = areaLabel(property)
    if (area) facts.push(area)

    return facts
}

const FEATURE_PATTERNS = [
    [/frente\s*mar|beira\s*mar|pé\s*na\s*areia|pe\s*na\s*areia/i, 'frente mar'],
    [/vista\s*(para\s*o\s*)?mar/i, 'vista para o mar'],
    [/quadra\s*(do|de)\s*mar/i, 'quadra do mar'],
    [/porto belo golf|golf resort|\bgolf\b/i, 'golf resort'],
    [/mobiliad/i, 'mobiliado'],
    [/decorad/i, 'decorado'],
    [/lançamento|lancamento|pré-lançamento|pre-lancamento|na planta/i, 'lançamento'],
    [/piscina/i, 'piscina'],
    [/sacada|varanda/i, 'sacada'],
    [/churrasqueira|espaço gourmet|espaco gourmet/i, 'espaço gourmet'],
    [/home club|lazer completo|área de lazer|area de lazer/i, 'lazer completo'],
    [/condomínio fechado|condominio fechado|segurança|seguranca/i, 'condomínio com segurança'],
    [/marina|trapiche|canal/i, 'perfil náutico'],
    [/alto padr[aã]o|luxo|premium/i, 'alto padrão'],
]

function featureLabels(property) {
    const amenities = Array.isArray(property.amenities) ? property.amenities.map(singleLine).filter(Boolean) : []
    const joined = singleLine(`${property.title || ''} ${property.description || ''} ${amenities.join(' ')}`)
    const labels = []

    for (const [pattern, label] of FEATURE_PATTERNS) {
        if (pattern.test(joined) && !labels.includes(label)) labels.push(label)
    }

    for (const item of amenities.slice(0, 8)) {
        const clean = compactText(item, 34)
        if (clean && !labels.some(label => label.toLowerCase() === clean.toLowerCase())) labels.push(clean)
    }

    if (property.exclusive && !labels.includes('curadoria exclusiva')) labels.push('curadoria exclusiva')
    return labels.slice(0, 6)
}

function joinHuman(items) {
    const unique = [...new Set(items.filter(Boolean))]
    if (unique.length <= 1) return unique[0] || ''
    if (unique.length === 2) return `${unique[0]} e ${unique[1]}`
    return `${unique.slice(0, -1).join(', ')} e ${unique[unique.length - 1]}`
}

function marketContext(property, type) {
    const city = cityLabel(property)
    const location = locationLabel(property)
    const local = `${city} ${location}`.toLowerCase()

    if (type === 'Galpão') {
        return `A região de ${location} favorece operações que precisam de leitura logística, acesso e área funcional.`
    }
    if (type === 'Terreno') {
        return `A localização em ${location} ajuda a posicionar o terreno para projeto, reserva patrimonial ou desenvolvimento imobiliário.`
    }
    if (/praia brava/.test(local)) {
        return 'A Praia Brava combina praia, gastronomia, mobilidade regional e um dos mercados mais desejados do litoral catarinense.'
    }
    if (/balne[aá]rio cambori[uú]/.test(local)) {
        return 'Balneário Camboriú concentra liquidez, verticalização de alto padrão e forte procura por imóveis bem localizados.'
    }
    if (/itapema|meia praia/.test(local)) {
        return 'Itapema une vida de praia, infraestrutura urbana e demanda consistente por imóveis de qualidade.'
    }
    if (/porto belo|bombinhas/.test(local)) {
        return `${city} valoriza imóveis conectados à natureza, ao mar e a uma experiência mais reservada no litoral.`
    }
    return `A localização em ${location} fortalece a comparação entre imóveis semelhantes no litoral catarinense.`
}

function buildSeoTitle(property) {
    const type = inferType(property)
    const purpose = purposeLabel(property)
    const location = locationLabel(property)
    const features = featureLabels(property)
    const room = roomFacts(property).find(fact => /suíte|dormitório/i.test(fact))
    const feature = features.find(item => /frente mar|vista|quadra|golf|lançamento|alto padrão/i.test(item))

    const candidates = [
        [type, purpose, feature ? `com ${feature}` : '', `em ${location}`].filter(Boolean).join(' '),
        [type, purpose, room ? `com ${room}` : '', `em ${location}`].filter(Boolean).join(' '),
        [type, purpose, `em ${location}`].filter(Boolean).join(' '),
        normalizeTitle(property.title),
    ].filter(Boolean)

    return compactText(candidates.find(candidate => singleLine(candidate).length <= SEO_TITLE_LIMIT) || candidates[0], SEO_TITLE_LIMIT)
}

function buildSeoDescription(property) {
    const type = inferType(property)
    const purpose = purposeLabel(property)
    const location = locationLabel(property)
    const facts = roomFacts(property).slice(0, 3)
    const features = featureLabels(property).slice(0, 2)
    const factText = facts.length ? ` com ${joinHuman(facts)}` : ''
    const featureText = features.length ? ` Destaques: ${joinHuman(features)}.` : ''
    const candidates = [
        `${type} ${purpose} em ${location}${factText}.${featureText} Curadoria Guilherme Pilger no litoral catarinense.`,
        `${type} ${purpose} em ${location}${factText}.${featureText} Curadoria Guilherme Pilger.`,
        `${type} ${purpose} em ${location}${factText}. Conheça fotos, dados e imóveis semelhantes.`,
        `${type} ${purpose} em ${location}. Curadoria Guilherme Pilger no litoral catarinense.`,
    ].map(singleLine).filter(Boolean)

    return candidates.find(candidate => candidate.length <= SEO_DESCRIPTION_LIMIT)
        || compactText(candidates[0], SEO_DESCRIPTION_LIMIT)
}

function hasNarrativeText(value) {
    const text = singleLine(value)
    return text.length >= 180 || /[.!?]/.test(text)
}

function shortOriginalFacts(value) {
    const text = cleanTerminalPunctuation(singleLine(value))
    return text ? `Itens cadastrados no imóvel: ${text}.` : ''
}

function buildDescription(property) {
    const type = inferType(property)
    const purpose = purposeLabel(property)
    const location = locationLabel(property)
    const title = normalizeTitle(property.title) || `${type} em ${location}`
    const facts = roomFacts(property)
    const features = featureLabels(property)
    const currentDescription = stripHtml(property.description)

    const factSentence = facts.length
        ? `O imóvel reúne ${joinHuman(facts.slice(0, 4))}.`
        : 'O imóvel reúne atributos cadastrados para uma análise objetiva de compra.'

    const opening = [
        `${type} ${purpose} em ${location}: ${title}.`,
        factSentence,
        `Uma opção para quem busca ${typeIntent(type, location)}.`,
    ].join(' ')

    const body = hasNarrativeText(currentDescription) ? currentDescription : shortOriginalFacts(currentDescription)
    const featureSentence = features.length
        ? `Entre os diferenciais cadastrados, destacam-se ${joinHuman(features)}.`
        : ''
    const context = marketContext(property, type)
    const cta = 'Fale com a Imobiliária Guilherme Pilger para confirmar disponibilidade, receber dados atualizados e comparar este imóvel com oportunidades semelhantes.'

    return [opening, body, featureSentence, context, cta]
        .filter(Boolean)
        .join('\n\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

function validateUpdate(property, update) {
    const errors = []
    const description = update.description

    if (!description || description.length < 260) errors.push('description_too_short')
    if (description.length > 9000) errors.push('description_too_long')
    if (/undefined|null|NaN/.test(description)) errors.push('invalid_token')
    if (/<[^>]+>/.test(description)) errors.push('html_leftover')
    if (singleLine(update.seo_title).length > SEO_TITLE_LIMIT) errors.push('seo_title_too_long')
    if (singleLine(update.seo_description).length > SEO_DESCRIPTION_LIMIT) errors.push('seo_description_too_long')

    const area = areaLabel(property, false)
    if (area && !description.includes(area)) errors.push('area_missing')
    if (numberValue(property.suites) > 0 && !new RegExp(`\\b${Math.round(numberValue(property.suites))}\\b`).test(description)) errors.push('suites_number_missing')

    return errors
}

async function fetchProperties() {
    const rows = []

    while (rows.length < limit) {
        const pageLimit = Math.min(PAGE_SIZE, limit - rows.length)
        const from = rows.length
        const to = from + pageLimit - 1
        let query = supabase
            .from('properties')
            .select('id,title,description,seo_title,seo_description,city,state,neighborhood,property_type,price,rent,purpose,bedrooms,bathrooms,suites,parking_spaces,area_m2,area_private_m2,area_total_m2,amenities,exclusive,status,source_reference,source_status,street,condo_fee,updated_at,created_at')
            .order('created_at', { ascending: false })
            .range(from, to)

        if (statusFilter) query = query.eq('status', statusFilter)

        const { data, error } = await query
        if (error) throw error
        if (!data?.length) break

        rows.push(...data)
        if (data.length < pageLimit) break
    }

    return rows
}

function buildUpdates(properties) {
    const updates = properties.map(property => {
        const description = buildDescription(property)
        const seoTitle = overwriteSeo || !singleLine(property.seo_title)
            ? buildSeoTitle(property)
            : singleLine(property.seo_title)
        const seoDescription = overwriteSeo || !singleLine(property.seo_description)
            ? buildSeoDescription(property)
            : singleLine(property.seo_description)

        return {
            id: property.id,
            title: property.title,
            status: property.status,
            source_reference: property.source_reference || null,
            old_description: property.description || null,
            old_seo_title: property.seo_title || null,
            old_seo_description: property.seo_description || null,
            description,
            seo_title: seoTitle,
            seo_description: seoDescription,
            validation_errors: [],
        }
    })

    const seenDescriptions = new Map()
    for (const update of updates) {
        const key = singleLine(update.description).toLowerCase()
        const previous = seenDescriptions.get(key)
        if (previous) {
            const reference = update.source_reference || update.id.slice(0, 8)
            update.description = `${update.description}\n\nReferência deste imóvel na curadoria: ${reference}.`
        }
        seenDescriptions.set(singleLine(update.description).toLowerCase(), update.id)
    }

    return updates.map(update => {
        const property = properties.find(item => item.id === update.id)
        return {
            ...update,
            validation_errors: validateUpdate(property, update),
        }
    })
}

async function writeArtifacts(properties, updates) {
    const runId = new Date().toISOString().replace(/[:.]/g, '-')
    const backupDir = backupDirArg
        ? path.resolve(backupDirArg.split('=').slice(1).join('='))
        : path.join(os.tmpdir(), 'pilger-property-description-copy')
    await mkdir(backupDir, { recursive: true })

    const backupPath = path.join(backupDir, `property-description-backup-${runId}.json`)
    const previewPath = path.join(backupDir, `property-description-preview-${runId}.json`)
    const backup = {
        created_at: new Date().toISOString(),
        mode: shouldApply ? 'apply' : 'dry-run',
        status_filter: statusFilter || 'all',
        total_properties: properties.length,
        rows: updates.map(update => ({
            id: update.id,
            title: update.title,
            status: update.status,
            source_reference: update.source_reference,
            old_description: update.old_description,
            old_seo_title: update.old_seo_title,
            old_seo_description: update.old_seo_description,
        })),
    }
    const preview = {
        created_at: new Date().toISOString(),
        mode: shouldApply ? 'apply' : 'dry-run',
        status_filter: statusFilter || 'all',
        total_updates: updates.length,
        validation_errors: updates.filter(update => update.validation_errors.length > 0).map(update => ({
            id: update.id,
            title: update.title,
            validation_errors: update.validation_errors,
        })),
        sample: updates.slice(0, 12).map(update => ({
            id: update.id,
            title: update.title,
            seo_title: update.seo_title,
            seo_description: update.seo_description,
            old_description_length: singleLine(update.old_description).length,
            new_description_length: singleLine(update.description).length,
            description_preview: compactText(update.description, 520),
        })),
    }

    await writeFile(backupPath, JSON.stringify(backup, null, 2), 'utf8')
    await writeFile(previewPath, JSON.stringify(preview, null, 2), 'utf8')
    return { backupPath, previewPath }
}

async function applyUpdates(updates) {
    let updated = 0
    for (const update of updates) {
        const { error } = await supabase
            .from('properties')
            .update({
                description: update.description,
                seo_title: update.seo_title,
                seo_description: update.seo_description,
            })
            .eq('id', update.id)

        if (error) throw error
        updated += 1
        if (updated % 100 === 0 || updated === updates.length) {
            console.log(`Atualizados ${updated}/${updates.length}`)
        }
    }
    return updated
}

const properties = await fetchProperties()
const updates = buildUpdates(properties)
const invalidUpdates = updates.filter(update => update.validation_errors.length > 0)
const { backupPath, previewPath } = await writeArtifacts(properties, updates)

const summary = {
    mode: shouldApply ? 'apply' : 'dry-run',
    statusFilter: statusFilter || 'all',
    fetched: properties.length,
    pendingUpdates: updates.length,
    invalidUpdates: invalidUpdates.length,
    backupPath,
    previewPath,
    sample: updates.slice(0, 5).map(update => ({
        id: update.id,
        title: update.title,
        seo_title: update.seo_title,
        seo_description: update.seo_description,
        old_description_length: singleLine(update.old_description).length,
        new_description_length: singleLine(update.description).length,
        validation_errors: update.validation_errors,
    })),
}

console.log(JSON.stringify(summary, null, 2))

if (invalidUpdates.length > 0) {
    console.error(`Abortado: ${invalidUpdates.length} atualizações não passaram na validação.`)
    process.exit(1)
}

if (shouldApply) {
    const updated = await applyUpdates(updates)
    console.log(`Concluído: ${updated} imóveis revisados em description, seo_title e seo_description.`)
} else {
    console.log('Dry-run apenas. Use --apply para gravar no banco.')
}
