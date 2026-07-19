#!/usr/bin/env node

import dotenv from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local', quiet: true })
dotenv.config({ quiet: true })

const PAGE_SIZE = 1000
const NOW = new Date()
const STAMP = NOW.toISOString().slice(0, 10).replace(/-/g, '')
const args = new Set(process.argv.slice(2))
const allStatuses = args.has('--all-statuses')
const statusArg = process.argv.find(arg => arg.startsWith('--status='))
const slugsArg = process.argv.find(arg => arg.startsWith('--slugs='))
const statusFilter = allStatuses ? '' : (statusArg ? statusArg.split('=').slice(1).join('=').trim() : 'published')
const slugFilter = new Set(
  slugsArg
    ? slugsArg.split('=').slice(1).join('=').split(',').map(item => item.trim()).filter(Boolean)
    : []
)
const OUTPUT_SUFFIX = slugFilter.size
  ? `-${slugFilter.size}-slugs`
  : (statusFilter && statusFilter !== 'published' ? `-${statusFilter}` : '')
const OUTPUT_PREFIX = `output/development-media-copy-audit-${STAMP}${OUTPUT_SUFFIX}`

const LANDING_SELECT = [
  'id',
  'slug',
  'title',
  'description',
  'status',
  'content',
  'metadata',
  'property_id',
  'created_at',
  'updated_at',
].join(', ')

const UNIT_LABEL_PATTERN = /\b(apartamento|apto|cobertura|casa|duplex|triplex|garden|terreno|lote|galpao|sala|loja|comercial|imovel|unidade)\b/i

const GENERATED_DESCRIPTION_PATTERNS = [
  /\breune\s+\d+\s+imoveis?\s+ativos?\b/i,
  /\bfaixa\s+de\s+valor\b/i,
  /\bmetragens?\s+de\b/i,
  /\bconfiguracao\s+de\b/i,
  /\bcompare\s+unidades\b/i,
  /\bcuradoria\s+guilherme\s+pilger\b/i,
  /\bunidades?\s+publicadas?\s+esta(?:o)?\s+sob\s+consulta\b/i,
]

const GENERATED_BENEFIT_PATTERNS = [
  /\bunidades?\s+reunidas?\b/i,
  /\bas\s+opcoes\s+ativas\b/i,
  /\bleitura\s+de\s+localizacao\b/i,
  /\batendimento\s+consultivo\b/i,
  /\bdiferencial\s+citado\s+nos\s+cadastros\s+ativos\b/i,
  /\bcomparacao\s+direta\b/i,
  /\batendimento\s+com\s+contexto\b/i,
]

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

const supabase = createClient(
  requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
  requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false } }
)

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function text(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeUrl(value) {
  return String(value || '').trim()
}

function unique(values) {
  return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)))
}

function compact(value, limit = 180) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, limit - 3).replace(/\s+\S*$/, '')}...`
}

function csvValue(value) {
  const stringValue = Array.isArray(value) ? value.join(' | ') : String(value ?? '')
  return `"${stringValue.replace(/"/g, '""')}"`
}

function toCsv(rows, columns) {
  return [
    columns.map(column => csvValue(column.label)).join(','),
    ...rows.map(row => columns.map(column => csvValue(row[column.key])).join(',')),
  ].join('\n') + '\n'
}

async function fetchAllLandingPages() {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1
    let query = supabase
      .from('landing_pages')
      .select(LANDING_SELECT)
      .order('created_at', { ascending: true })
      .range(from, to)

    if (statusFilter) query = query.eq('status', statusFilter)
    if (slugFilter.size) query = query.in('slug', [...slugFilter])

    const { data, error } = await query
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) break
  }

  return rows
}

function galleryEntry(item) {
  if (typeof item === 'string') {
    return {
      image: normalizeUrl(item),
      title: '',
      category: '',
      raw: item,
    }
  }

  const record = asRecord(item)
  return {
    image: normalizeUrl(record.image || record.url || record.src),
    title: text(record.title),
    category: text(record.category),
    raw: record,
  }
}

function galleryEntries(value) {
  return asArray(value)
    .map(galleryEntry)
    .filter(item => item.image)
}

function unitImageRecords(units) {
  const records = []
  for (const unit of asArray(units)) {
    const record = asRecord(unit)
    const unitLabel = text(record.title || record.type || record.propertyType || record.property_type, 'Unidade')
    const identifiers = unique([
      record.propertyId,
      record.property_id,
      record.sourceReference,
      record.source_reference,
      record.sourceSlug,
      record.source_slug,
      record.id,
    ])

    for (const image of unique([record.image, ...asArray(record.images)])) {
      records.push({
        image: normalizeUrl(image),
        unit_label: unitLabel,
        unit_identifiers: identifiers,
      })
    }
  }

  return records.filter(item => item.image)
}

function textFromItems(items) {
  return asArray(items).map(item => {
    if (typeof item === 'string') return item
    const record = asRecord(item)
    return [
      record.title,
      record.description,
      record.name,
      record.label,
    ].map(value => String(value || '').trim()).filter(Boolean).join(' ')
  }).join(' ')
}

function matchesAnyPattern(value, patterns) {
  const normalized = normalizeText(value)
  return patterns.some(pattern => pattern.test(normalized))
}

function buildSearchQueries(development, page) {
  const name = text(development.name, page.title)
  const city = text(development.city)
  const location = text(development.locationName || development.location_name)
  const sourceName = text(development.sourceCondominiumName || development.source_condominium_name)
  const aliases = unique([
    name,
    sourceName,
    ...asArray(development.sourceCondominiumAliases),
    ...asArray(development.source_condominium_aliases),
  ]).filter(value => value && normalizeText(value) !== normalizeText(page.slug))

  const primary = aliases[0] || name
  return unique([
    primary && city ? `"${primary}" empreendimento ${city}` : '',
    primary && city ? `"${primary}" condominio ${city}` : '',
    primary ? `"${primary}" construtora incorporadora` : '',
    primary && location ? `"${primary}" "${location}"` : '',
  ]).slice(0, 4)
}

function classifyPriority(issue) {
  if (issue.hero_matches_unit_image) return 'P0'
  if (issue.active_gallery_unit_match_ratio >= 0.75 && issue.active_gallery_unit_matches >= 3) return 'P0'
  if (issue.active_gallery_unit_matches > 0) return 'P1'
  if (issue.unit_label_gallery) return 'P1'
  if (issue.generic_description || issue.generic_benefits || issue.missing_development_copy) return 'P2'
  return 'OK'
}

function recommendedAction(issue) {
  if (issue.priority === 'P0') {
    return 'Substituir hero e galeria por midia real do empreendimento antes de promover a pagina.'
  }
  if (issue.priority === 'P1') {
    return 'Revisar galeria e remover fotos internas/unidades que estejam no contexto do condominio.'
  }
  if (issue.priority === 'P2') {
    return 'Enriquecer descricao, beneficios, diferenciais, FAQ e SEO com informacoes reais verificadas.'
  }
  return 'Sem acao prioritaria detectada nesta auditoria automatica.'
}

function auditLandingPage(page) {
  const content = asRecord(page.content)
  const metadata = asRecord(page.metadata)
  const development = asRecord(content.development)
  const seo = asRecord(content.seo)
  const units = asArray(development.units)
  const unitImages = unitImageRecords(units)
  const unitImageByUrl = new Map(unitImages.map(item => [item.image, item]))
  const unitImageSet = new Set(unitImages.map(item => item.image))
  const customGallery = galleryEntries(content.custom_gallery)
  const developmentGallery = galleryEntries(development.gallery)
  const activeGallerySource = customGallery.length ? 'content.custom_gallery' : (developmentGallery.length ? 'content.development.gallery' : 'none')
  const activeGallery = customGallery.length ? customGallery : developmentGallery
  const activeGalleryMatches = activeGallery
    .filter(item => unitImageSet.has(item.image))
    .map(item => ({
      image: item.image,
      title: item.title,
      category: item.category,
      matched_unit: unitImageByUrl.get(item.image)?.unit_label || '',
      matched_unit_identifiers: unitImageByUrl.get(item.image)?.unit_identifiers || [],
    }))
  const heroImage = text(content.custom_hero_image || development.heroImage || development.hero_image || seo.og_image || seo.image)
  const heroMatch = heroImage ? unitImageByUrl.get(heroImage) : null
  const unitLabelGallery = activeGallery.some(item => UNIT_LABEL_PATTERN.test(normalizeText(`${item.title} ${item.category}`)))
  const descriptionText = [
    development.description,
    content.custom_description,
    seo.description,
    page.description,
  ].filter(Boolean).join(' ')
  const benefitsText = textFromItems([
    ...asArray(development.benefits),
    ...asArray(development.differentials),
  ])
  const faqText = textFromItems([
    ...asArray(development.faq),
    ...asArray(content.aeo_questions),
    ...asArray(content.aeoQuestions),
  ])
  const genericDescription = matchesAnyPattern(descriptionText, GENERATED_DESCRIPTION_PATTERNS)
  const genericBenefits = matchesAnyPattern(benefitsText, GENERATED_BENEFIT_PATTERNS)
  const hasThinDescription = normalizeText(development.description || content.custom_description || page.description).length < 180
  const missingBenefits = asArray(development.benefits).length < 3
  const missingDifferentials = asArray(development.differentials).length < 3
  const missingFaq = asArray(development.faq).length < 4 && asArray(content.aeo_questions).length < 4
  const missingDevelopmentCopy = hasThinDescription || missingBenefits || missingDifferentials || missingFaq
  const issue = {
    id: page.id,
    slug: page.slug,
    title: page.title,
    status: page.status,
    development_name: text(development.name, page.title),
    source_condominium_name: text(development.sourceCondominiumName || development.source_condominium_name),
    city: text(development.city),
    location_name: text(development.locationName || development.location_name),
    unit_count: units.length,
    active_gallery_source: activeGallerySource,
    active_gallery_count: activeGallery.length,
    active_gallery_unit_matches: activeGalleryMatches.length,
    active_gallery_unit_match_ratio: activeGallery.length ? Number((activeGalleryMatches.length / activeGallery.length).toFixed(3)) : 0,
    hero_image: heroImage,
    hero_matches_unit_image: Boolean(heroMatch),
    hero_matched_unit: heroMatch?.unit_label || '',
    unit_label_gallery: unitLabelGallery,
    custom_gallery_count: customGallery.length,
    development_gallery_count: developmentGallery.length,
    unit_image_count: unitImages.length,
    generic_description: genericDescription,
    generic_benefits: genericBenefits,
    missing_development_copy: missingDevelopmentCopy,
    thin_description: hasThinDescription,
    missing_benefits: missingBenefits,
    missing_differentials: missingDifferentials,
    missing_faq: missingFaq,
    description_excerpt: compact(development.description || content.custom_description || page.description),
    benefit_excerpt: compact(benefitsText),
    faq_excerpt: compact(faqText),
    search_queries: buildSearchQueries(development, page),
    image_matches: activeGalleryMatches.slice(0, 12),
    aliases: unique([
      ...asArray(development.sourceCondominiumAliases),
      ...asArray(development.source_condominium_aliases),
    ]),
    metadata: {
      version: metadata.version || '',
      generated_by: metadata.generated_by || '',
      source_column: metadata.source_column || '',
    },
    created_at: page.created_at,
    updated_at: page.updated_at,
  }

  issue.priority = classifyPriority(issue)
  issue.recommended_action = recommendedAction(issue)
  issue.needs_web_research = issue.priority !== 'OK'

  return issue
}

function sortIssues(a, b) {
  const priorityRank = { P0: 0, P1: 1, P2: 2, OK: 3 }
  const byPriority = priorityRank[a.priority] - priorityRank[b.priority]
  if (byPriority !== 0) return byPriority
  const byHero = Number(b.hero_matches_unit_image) - Number(a.hero_matches_unit_image)
  if (byHero !== 0) return byHero
  const byRatio = b.active_gallery_unit_match_ratio - a.active_gallery_unit_match_ratio
  if (byRatio !== 0) return byRatio
  const byMatches = b.active_gallery_unit_matches - a.active_gallery_unit_matches
  if (byMatches !== 0) return byMatches
  const byUnits = b.unit_count - a.unit_count
  if (byUnits !== 0) return byUnits
  return a.slug.localeCompare(b.slug)
}

function buildMarkdown(report) {
  const lines = [
    '# Auditoria de midia e copy dos empreendimentos',
    '',
    `Gerado em: ${report.generated_at}`,
    '',
    '## Totais',
    '',
    `- Landing pages analisadas: ${report.totals.landing_pages_analyzed}`,
    `- Paginas de empreendimento: ${report.totals.development_pages}`,
    `- P0 - imagem principal/galeria forte de unidade: ${report.totals.P0}`,
    `- P1 - galeria com sinais de unidade: ${report.totals.P1}`,
    `- P2 - copy incompleta ou generica: ${report.totals.P2}`,
    `- OK automatico: ${report.totals.OK}`,
    `- Hero igual a imagem de unidade: ${report.totals.hero_matches_unit_image}`,
    `- Galeria com imagem de unidade: ${report.totals.gallery_matches_unit_image}`,
    `- Descricao generica detectada: ${report.totals.generic_description}`,
    `- Beneficios/diferenciais genericos detectados: ${report.totals.generic_benefits}`,
    '',
    '## Proximos lotes',
    '',
  ]

  for (const [label, items] of [
    ['P0 - corrigir primeiro', report.samples.P0],
    ['P1 - revisar galeria', report.samples.P1],
    ['P2 - enriquecer conteudo', report.samples.P2],
  ]) {
    lines.push(`### ${label}`, '')
    if (!items.length) {
      lines.push('- Nenhum caso.', '')
      continue
    }
    for (const item of items) {
      lines.push(`- ${item.slug} | ${item.development_name} | unidades=${item.unit_count} | hero_unidade=${item.hero_matches_unit_image ? 'sim' : 'nao'} | galeria_unidade=${item.active_gallery_unit_matches}/${item.active_gallery_count} | copy_generica=${item.generic_description || item.generic_benefits ? 'sim' : 'nao'}`)
    }
    lines.push('')
  }

  lines.push('## Criterio automatico', '')
  lines.push('- P0: hero igual a imagem de unidade, ou 75%+ da galeria ativa vindo de imagens das unidades.')
  lines.push('- P1: alguma imagem de unidade na galeria, ou galeria rotulada como apartamento/casa/cobertura/etc.')
  lines.push('- P2: descricao, beneficios, diferenciais ou FAQ com sinais de texto gerado/generico ou incompleto.')
  lines.push('- A correcao final deve confirmar fonte externa antes de trocar fotos e textos.')
  lines.push('')

  return `${lines.join('\n')}\n`
}

function summarizeIssues(issues, totalsBase) {
  return issues.reduce((totals, issue) => {
    totals[issue.priority] += 1
    if (issue.hero_matches_unit_image) totals.hero_matches_unit_image += 1
    if (issue.active_gallery_unit_matches > 0) totals.gallery_matches_unit_image += 1
    if (issue.unit_label_gallery) totals.unit_label_gallery += 1
    if (issue.generic_description) totals.generic_description += 1
    if (issue.generic_benefits) totals.generic_benefits += 1
    if (issue.missing_development_copy) totals.missing_development_copy += 1
    return totals
  }, totalsBase)
}

async function main() {
  const landingPages = await fetchAllLandingPages()
  const developmentPages = landingPages.filter(page => Object.keys(asRecord(asRecord(page.content).development)).length > 0)
  const issues = developmentPages.map(auditLandingPage).sort(sortIssues)
  const buckets = {
    P0: issues.filter(issue => issue.priority === 'P0'),
    P1: issues.filter(issue => issue.priority === 'P1'),
    P2: issues.filter(issue => issue.priority === 'P2'),
    OK: issues.filter(issue => issue.priority === 'OK'),
  }
  const totals = summarizeIssues(issues, {
    landing_pages_analyzed: landingPages.length,
    development_pages: developmentPages.length,
    P0: 0,
    P1: 0,
    P2: 0,
    OK: 0,
    hero_matches_unit_image: 0,
    gallery_matches_unit_image: 0,
    unit_label_gallery: 0,
    generic_description: 0,
    generic_benefits: 0,
    missing_development_copy: 0,
  })

  const report = {
    generated_at: NOW.toISOString(),
    filters: {
      status: statusFilter || 'all',
      slugs: [...slugFilter],
    },
    totals,
    samples: {
      P0: buckets.P0.slice(0, 40),
      P1: buckets.P1.slice(0, 40),
      P2: buckets.P2.slice(0, 40),
    },
    issues,
  }

  const csvRows = issues.map(issue => ({
    priority: issue.priority,
    slug: issue.slug,
    title: issue.title,
    development_name: issue.development_name,
    city: issue.city,
    status: issue.status,
    unit_count: issue.unit_count,
    active_gallery_source: issue.active_gallery_source,
    active_gallery_count: issue.active_gallery_count,
    active_gallery_unit_matches: issue.active_gallery_unit_matches,
    active_gallery_unit_match_ratio: issue.active_gallery_unit_match_ratio,
    hero_matches_unit_image: issue.hero_matches_unit_image ? 'yes' : 'no',
    unit_label_gallery: issue.unit_label_gallery ? 'yes' : 'no',
    generic_description: issue.generic_description ? 'yes' : 'no',
    generic_benefits: issue.generic_benefits ? 'yes' : 'no',
    missing_development_copy: issue.missing_development_copy ? 'yes' : 'no',
    recommended_action: issue.recommended_action,
    search_queries: issue.search_queries.join(' | '),
    updated_at: issue.updated_at,
  }))

  await mkdir('output', { recursive: true })
  await writeFile(`${OUTPUT_PREFIX}.json`, JSON.stringify(report, null, 2), 'utf8')
  await writeFile(`${OUTPUT_PREFIX}.csv`, toCsv(csvRows, [
    { key: 'priority', label: 'priority' },
    { key: 'slug', label: 'slug' },
    { key: 'title', label: 'title' },
    { key: 'development_name', label: 'development_name' },
    { key: 'city', label: 'city' },
    { key: 'status', label: 'status' },
    { key: 'unit_count', label: 'unit_count' },
    { key: 'active_gallery_source', label: 'active_gallery_source' },
    { key: 'active_gallery_count', label: 'active_gallery_count' },
    { key: 'active_gallery_unit_matches', label: 'active_gallery_unit_matches' },
    { key: 'active_gallery_unit_match_ratio', label: 'active_gallery_unit_match_ratio' },
    { key: 'hero_matches_unit_image', label: 'hero_matches_unit_image' },
    { key: 'unit_label_gallery', label: 'unit_label_gallery' },
    { key: 'generic_description', label: 'generic_description' },
    { key: 'generic_benefits', label: 'generic_benefits' },
    { key: 'missing_development_copy', label: 'missing_development_copy' },
    { key: 'recommended_action', label: 'recommended_action' },
    { key: 'search_queries', label: 'search_queries' },
    { key: 'updated_at', label: 'updated_at' },
  ]), 'utf8')
  await writeFile(`${OUTPUT_PREFIX}.md`, buildMarkdown(report), 'utf8')

  console.log('Development media/copy audit')
  for (const [key, value] of Object.entries(totals)) {
    console.log(`- ${key}: ${value}`)
  }
  console.log(`- json: ${OUTPUT_PREFIX}.json`)
  console.log(`- csv: ${OUTPUT_PREFIX}.csv`)
  console.log(`- markdown: ${OUTPUT_PREFIX}.md`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
