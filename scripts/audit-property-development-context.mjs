#!/usr/bin/env node

import dotenv from 'dotenv'
import { mkdir, writeFile } from 'fs/promises'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })
dotenv.config()

const PAGE_SIZE = 1000
const NOW = new Date()
const STAMP = NOW.toISOString().slice(0, 10).replace(/-/g, '')
const OUTPUT_PREFIX = `output/property-development-link-audit-${STAMP}`

const PROPERTY_SELECT = [
  'id',
  'source_reference',
  'source_slug',
  'title',
  'city',
  'neighborhood',
  'property_type',
  'status',
  'price',
  'updated_at',
].join(', ')

const PRIVATE_SELECT = [
  'property_id',
  'source_reference',
  'condominium_name',
  'construction_company',
].join(', ')

const LANDING_SELECT = [
  'id',
  'slug',
  'title',
  'status',
  'content',
  'metadata',
  'property_id',
  'updated_at',
].join(', ')

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

function text(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function number(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function normalizeKey(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeLooseKey(value) {
  return normalizeKey(value)
    .replace(/\b(edificio|ed|condominio|cond|residencial|res)\b/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function compactKey(value) {
  return normalizeLooseKey(value).replace(/\s+/g, '')
}

function isTitleInferredLocationCandidate(value) {
  const normalized = normalizeKey(value)
  if (!normalized) return true
  if (['praia brava', 'balneario camboriu', 'itapema', 'porto belo'].includes(normalized)) return true

  return /^(praia|bairro|br|rodovia|avenida|av|quadra|centro|barra|canto da praia|trevo|areia)\b/.test(normalized)
}

function addLookupVariants(keys, value) {
  const normalized = normalizeKey(value)
  if (!normalized || normalized.length < 3) return

  const variants = new Set([normalized, normalizeLooseKey(normalized)])

  if (normalized.startsWith('ed ')) variants.add(normalized.replace(/^ed\s+/, 'edificio '))
  if (normalized.startsWith('edificio ')) variants.add(normalized.replace(/^edificio\s+/, 'ed '))
  if (normalized.startsWith('cond ')) variants.add(normalized.replace(/^cond\s+/, 'condominio '))
  if (normalized.startsWith('condominio ')) variants.add(normalized.replace(/^condominio\s+/, 'cond '))

  for (const variant of variants) {
    const clean = normalizeKey(variant)
    const loose = normalizeLooseKey(variant)
    if (clean.length >= 3) keys.add(clean)
    if (loose.length >= 3) keys.add(loose)
    const compact = compactKey(variant)
    if (compact.length >= 5) keys.add(compact)
  }
}

function trimDevelopmentCandidate(value) {
  return text(value)
    .replace(/\s+(?:em|na|nas|nos|com|para|frente|mobiliado|decorado|a venda|a partir|no bairro)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferDevelopmentName(property) {
  const title = normalizeKey(property.title)
  if (!title) return ''

  const patterns = [
    /\b((?:ed|edificio|cond|condominio|residencial)\s+[a-z0-9][a-z0-9\s]{1,90})/g,
    /\b(?:no|na|nos|nas)\s+([a-z0-9][a-z0-9\s]{2,90})/g,
  ]

  for (const [patternIndex, pattern] of patterns.entries()) {
    for (const match of title.matchAll(pattern)) {
      const candidate = trimDevelopmentCandidate(match[1] || match[0])
      const loose = normalizeLooseKey(candidate)
      if (patternIndex === 1 && isTitleInferredLocationCandidate(candidate)) continue
      if (loose && loose.length >= 4 && !['praia brava', 'balneario camboriu', 'itapema', 'porto belo'].includes(loose)) {
        return candidate
      }
    }
  }

  return ''
}

async function fetchAll(table, select, apply = query => query) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1
    const query = apply(supabase.from(table).select(select).range(from, to))
    const { data, error } = await query
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) break
  }
  return rows
}

function pageDevelopmentKeys(page) {
  const content = asRecord(page.content)
  const development = asRecord(content.development)
  const metadata = asRecord(page.metadata)
  const keys = new Set()
  const aliases = [
    ...asArray(development.sourceCondominiumAliases),
    ...asArray(development.source_condominium_aliases),
    ...asArray(metadata.source_condominium_aliases),
  ]

  for (const value of [
    development.sourceCondominiumKey,
    development.source_condominium_key,
    development.sourceCondominiumName,
    development.source_condominium_name,
    development.name,
    development.pageSlug,
    development.page_slug,
    content.custom_title,
    page.title,
    page.slug,
    ...aliases,
  ]) {
    addLookupVariants(keys, value)
  }

  return keys
}

function canonicalDevelopmentSlug(page) {
  const content = asRecord(page.content)
  const metadata = asRecord(page.metadata)
  return text(metadata.canonical_development_slug ?? content.canonical_development_slug)
}

function pageUnits(page) {
  return asArray(asRecord(asRecord(page.content).development).units)
}

function unitIdentifiers(unit) {
  const record = asRecord(unit)
  const strong = [
    text(record.propertyId ?? record.property_id),
    text(record.sourceReference ?? record.source_reference ?? record.id),
  ].filter(Boolean).map(normalizeText)

  if (strong.length) return strong

  return [
    text(record.sourceSlug ?? record.source_slug ?? record.slug),
  ].filter(Boolean).map(normalizeText)
}

function buildLandingIndexes(landingPages) {
  const developmentPages = landingPages
    .filter(page => page.status === 'published')
    .filter(page => {
      const canonicalSlug = canonicalDevelopmentSlug(page)
      return !canonicalSlug || canonicalSlug === page.slug
    })
    .filter(page => Object.keys(asRecord(asRecord(page.content).development)).length > 0)
    .map(page => {
      const content = asRecord(page.content)
      const development = asRecord(content.development)
      const units = pageUnits(page)
      const availableUnitsCount = number(development.availableUnitsCount ?? development.available_units_count ?? content.available_units_count)

      return {
        id: page.id,
        slug: page.slug,
        title: page.title,
        property_id: page.property_id,
        keys: pageDevelopmentKeys(page),
        units,
        unitCount: units.length,
        availableUnitsCount,
        hasDeclaredZeroStock: availableUnitsCount === 0,
      }
    })

  const byUnitIdentifier = new Map()
  for (const page of developmentPages) {
    for (const unit of page.units) {
      for (const identifier of unitIdentifiers(unit)) {
        if (!byUnitIdentifier.has(identifier)) byUnitIdentifier.set(identifier, [])
        byUnitIdentifier.get(identifier).push(page)
      }
    }
    if (page.property_id) {
      const identifier = normalizeText(page.property_id)
      if (!byUnitIdentifier.has(identifier)) byUnitIdentifier.set(identifier, [])
      byUnitIdentifier.get(identifier).push(page)
    }
  }

  return { developmentPages, byUnitIdentifier }
}

function propertyIdentifiers(property) {
  const strong = [
    property.id,
    property.source_reference,
  ].map(normalizeText).filter(Boolean)

  if (strong.length) return strong

  return [
    property.source_slug,
  ].map(normalizeText).filter(Boolean)
}

function propertyNameKeys(property) {
  const keys = new Set()
  for (const value of [
    property.condominium_name,
    property.inferred_development_name,
  ]) {
    addLookupVariants(keys, value)
  }
  return keys
}

function matchingPagesForKeys(keys, developmentPages) {
  if (!keys.size) return []
  return developmentPages.filter(page => [...keys].some(key => page.keys.has(key)))
}

function summarizeProperty(property, mode, pages, extra = {}) {
  return {
    mode,
    property_id: property.id,
    source_reference: property.source_reference,
    source_slug: property.source_slug,
    title: property.title,
    city: property.city,
    neighborhood: property.neighborhood,
    property_type: property.property_type,
    condominium_name: property.condominium_name || null,
    inferred_development_name: property.inferred_development_name || null,
    matched_pages: pages.map(page => page.slug),
    ...extra,
  }
}

function auditProperties(activeProperties, developmentPages, byUnitIdentifier) {
  const buckets = {
    direct: [],
    name_match: [],
    title_inference: [],
    ambiguous: [],
    missing_landing_page: [],
    missing_development_name: [],
  }

  for (const property of activeProperties) {
    const directPages = Array.from(new Set(
      propertyIdentifiers(property)
        .flatMap(identifier => byUnitIdentifier.get(identifier) || [])
    ))

    if (directPages.length === 1) {
      buckets.direct.push(summarizeProperty(property, 'direct', directPages))
      continue
    }

    if (directPages.length > 1) {
      buckets.ambiguous.push(summarizeProperty(property, 'ambiguous', directPages, { reason: 'unit_identifier_matches_multiple_pages' }))
      continue
    }

    const keyMatches = matchingPagesForKeys(propertyNameKeys(property), developmentPages)
    if (keyMatches.length === 1) {
      buckets[property.condominium_name ? 'name_match' : 'title_inference'].push(
        summarizeProperty(property, property.condominium_name ? 'name_match' : 'title_inference', keyMatches)
      )
      continue
    }

    if (keyMatches.length > 1) {
      buckets.ambiguous.push(summarizeProperty(property, 'ambiguous', keyMatches, { reason: 'name_matches_multiple_pages' }))
      continue
    }

    if (!property.condominium_name && !property.inferred_development_name) {
      buckets.missing_development_name.push(summarizeProperty(property, 'missing_development_name', []))
      continue
    }

    buckets.missing_landing_page.push(summarizeProperty(property, 'missing_landing_page', []))
  }

  return buckets
}

function topSamples(items, limit = 40) {
  return items.slice(0, limit)
}

function buildMarkdown(report) {
  const lines = [
    `# Auditoria de vinculo imovel-empreendimento`,
    ``,
    `Gerado em: ${report.generated_at}`,
    ``,
    `## Totais`,
    ``,
    `- Imoveis ativos: ${report.totals.active_properties}`,
    `- Landing pages publicadas de empreendimento: ${report.totals.published_development_pages}`,
    `- Imoveis com vinculo direto por unidade: ${report.totals.direct}`,
    `- Imoveis com vinculo por nome do condominio: ${report.totals.name_match}`,
    `- Imoveis com vinculo inferido pelo titulo: ${report.totals.title_inference}`,
    `- Imoveis sem condominium_name privado: ${report.totals.missing_private_condominium_name}`,
    `- Imoveis sem nome de empreendimento detectavel: ${report.totals.missing_development_name}`,
    `- Imoveis com nome mas sem landing correspondente: ${report.totals.missing_landing_page}`,
    `- Imoveis ambiguos: ${report.totals.ambiguous}`,
    `- Landings de empreendimento sem unidades declaradas: ${report.totals.development_pages_without_units}`,
    ``,
    `## Amostras criticas`,
    ``,
  ]

  for (const [label, items] of [
    ['Sem nome detectavel', report.samples.missing_development_name],
    ['Sem landing correspondente', report.samples.missing_landing_page],
    ['Ambiguos', report.samples.ambiguous],
  ]) {
    lines.push(`### ${label}`, ``)
    if (!items.length) {
      lines.push(`- Nenhum caso.`, ``)
      continue
    }
    for (const item of items.slice(0, 15)) {
      lines.push(`- ${item.source_reference || item.property_id}: ${item.title} | condominio=${item.condominium_name || '-'} | inferido=${item.inferred_development_name || '-'} | paginas=${item.matched_pages.join(',') || '-'}`)
    }
    lines.push(``)
  }

  return `${lines.join('\n')}\n`
}

async function main() {
  const [properties, privateRows, landingPages] = await Promise.all([
    fetchAll('properties', PROPERTY_SELECT, query => query.eq('status', 'active').order('updated_at', { ascending: false })),
    fetchAll('property_private_details', PRIVATE_SELECT),
    fetchAll('landing_pages', LANDING_SELECT, query => query.eq('status', 'published').order('created_at', { ascending: true })),
  ])

  const privateByProperty = new Map(privateRows.map(row => [row.property_id, row]))
  const activeProperties = properties.map(property => {
    const privateDetails = privateByProperty.get(property.id) || {}
    const condominiumName = text(privateDetails.condominium_name)
    return {
      ...property,
      condominium_name: condominiumName,
      inferred_development_name: condominiumName ? '' : inferDevelopmentName(property),
    }
  })

  const { developmentPages, byUnitIdentifier } = buildLandingIndexes(landingPages)
  const buckets = auditProperties(activeProperties, developmentPages, byUnitIdentifier)
  const pagesWithoutUnits = developmentPages
    .filter(page => page.unitCount === 0 && !page.hasDeclaredZeroStock)
    .map(page => ({
      slug: page.slug,
      title: page.title,
      unit_count: page.unitCount,
      available_units_count: page.availableUnitsCount,
    }))

  const report = {
    generated_at: NOW.toISOString(),
    totals: {
      active_properties: activeProperties.length,
      published_development_pages: developmentPages.length,
      direct: buckets.direct.length,
      name_match: buckets.name_match.length,
      title_inference: buckets.title_inference.length,
      missing_private_condominium_name: activeProperties.filter(property => !property.condominium_name).length,
      missing_development_name: buckets.missing_development_name.length,
      missing_landing_page: buckets.missing_landing_page.length,
      ambiguous: buckets.ambiguous.length,
      development_pages_without_units: pagesWithoutUnits.length,
    },
    samples: {
      missing_development_name: topSamples(buckets.missing_development_name),
      missing_landing_page: topSamples(buckets.missing_landing_page),
      ambiguous: topSamples(buckets.ambiguous),
      title_inference: topSamples(buckets.title_inference),
      development_pages_without_units: topSamples(pagesWithoutUnits),
    },
    buckets,
  }

  await mkdir('output', { recursive: true })
  await writeFile(`${OUTPUT_PREFIX}.json`, JSON.stringify(report, null, 2), 'utf8')
  await writeFile(`${OUTPUT_PREFIX}.md`, buildMarkdown(report), 'utf8')

  console.log('Property-development link audit')
  for (const [key, value] of Object.entries(report.totals)) {
    console.log(`- ${key}: ${value}`)
  }
  console.log(`- json: ${OUTPUT_PREFIX}.json`)
  console.log(`- markdown: ${OUTPUT_PREFIX}.md`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
