#!/usr/bin/env node

import dotenv from 'dotenv'
import { mkdir, writeFile } from 'fs/promises'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })
dotenv.config()

const APPLY = process.argv.includes('--apply')
const NOW = new Date()
const STAMP = NOW.toISOString().replace(/[-:.]/g, '').slice(0, 15)
const OUTPUT_PREFIX = `output/development-canonical-aliases-${STAMP}`

const CANONICAL_ALIASES = {
  'porto-riviera': 'condominio-porto-riviera',
  'porto-riviera-condominio': 'condominio-porto-riviera',
  horizontal: 'condominio-horizontal',
  'caledonia-private-village': 'condominio-caledonia-private-village',
  era: 'edificio-era',
  'porto-di-napoli': 'edificio-porto-di-napoli',
  caledonia: 'condominio-caledonia',
  'marina-camboriu': 'condominio-marina-camboriu',
  'haras-rio-do-ouro': 'condominio-haras-rio-do-ouro',
  'george-vi': 'george-vi-residencial',
  sirena: 'ed-sirena',
  riva: 'edificio-riva',
}

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

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function unitKey(unit) {
  const record = asRecord(unit)
  const strong = [
    record.propertyId,
    record.property_id,
    record.sourceReference,
    record.source_reference,
    record.id,
  ].map(normalizeText).filter(Boolean)

  if (strong.length) return strong.join('|')

  const fallback = [
    record.sourceSlug,
    record.source_slug,
    record.slug,
    record.title,
    record.price,
  ].map(normalizeText).filter(Boolean)

  return fallback.join('|')
}

function mergeUnits(...unitGroups) {
  const seen = new Set()
  const merged = []

  for (const unit of unitGroups.flatMap(group => asArray(group))) {
    const key = unitKey(unit)
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(unit)
  }

  return merged
}

function mergeAliases(existingMetadata, canonicalSlug) {
  return {
    ...existingMetadata,
    canonical_development_slug: canonicalSlug,
    canonicalized_at: NOW.toISOString(),
    canonicalized_by: 'repair-development-canonical-aliases',
  }
}

function markAliasContent(content, canonicalSlug) {
  const next = structuredClone(content)
  const seo = asRecord(next.seo)
  next.canonical_development_slug = canonicalSlug
  seo.canonical_path = `/${canonicalSlug}`
  next.seo = seo
  return next
}

function markCanonicalContent(content, aliasSlugs, canonicalSlug) {
  const next = structuredClone(content)
  const development = asRecord(next.development)
  const seo = asRecord(next.seo)

  development.canonicalSlug = canonicalSlug
  development.canonical_slug = canonicalSlug
  development.aliasSlugs = Array.from(new Set([
    ...asArray(development.aliasSlugs),
    ...asArray(development.alias_slugs),
    ...aliasSlugs,
  ]))
  development.alias_slugs = development.aliasSlugs
  development.availableUnitsCount = asArray(development.units).length
  development.available_units_count = asArray(development.units).length
  next.available_units_count = asArray(development.units).length
  seo.canonical_path = `/${canonicalSlug}`

  next.development = development
  next.seo = seo
  return next
}

async function fetchPages() {
  const { data, error } = await supabase
    .from('landing_pages')
    .select('id, slug, title, status, content, metadata, updated_at')
    .in('slug', Array.from(new Set([
      ...Object.keys(CANONICAL_ALIASES),
      ...Object.values(CANONICAL_ALIASES),
    ])))

  if (error) throw error
  return data || []
}

function buildMarkdown(report) {
  const lines = [
    '# Canonizacao de empreendimentos duplicados',
    '',
    `Gerado em: ${report.generated_at}`,
    `Modo: ${report.apply ? 'aplicado' : 'prévia'}`,
    '',
    '## Totais',
    '',
    `- Grupos canonicos: ${report.totals.canonical_groups}`,
    `- Paginas alias marcadas: ${report.totals.alias_pages}`,
    `- Unidades migradas para canonicos: ${report.totals.units_merged}`,
    '',
    '## Grupos',
    '',
  ]

  for (const group of report.groups) {
    lines.push(`- ${group.canonical_slug}: aliases ${group.alias_slugs.join(', ')} | unidades ${group.before_units} -> ${group.after_units}`)
  }

  return `${lines.join('\n')}\n`
}

async function main() {
  const pages = await fetchPages()
  const bySlug = new Map(pages.map(page => [page.slug, page]))
  const grouped = new Map()

  for (const [aliasSlug, canonicalSlug] of Object.entries(CANONICAL_ALIASES)) {
    if (!grouped.has(canonicalSlug)) grouped.set(canonicalSlug, [])
    grouped.get(canonicalSlug).push(aliasSlug)
  }

  const updates = []
  const backupRows = []
  const groups = []

  for (const [canonicalSlug, aliasSlugs] of grouped.entries()) {
    const canonical = bySlug.get(canonicalSlug)
    if (!canonical) {
      groups.push({ canonical_slug: canonicalSlug, alias_slugs: aliasSlugs, missing: true, before_units: 0, after_units: 0 })
      continue
    }

    const canonicalContent = asRecord(canonical.content)
    const canonicalDevelopment = asRecord(canonicalContent.development)
    const aliasPages = aliasSlugs.map(slug => bySlug.get(slug)).filter(Boolean)
    const mergedUnits = mergeUnits(
      canonicalDevelopment.units,
      ...aliasPages.map(page => asRecord(asRecord(page.content).development).units)
    )
    const beforeUnits = asArray(canonicalDevelopment.units).length
    canonicalDevelopment.units = mergedUnits
    canonicalContent.development = canonicalDevelopment
    const nextCanonicalContent = markCanonicalContent(canonicalContent, aliasSlugs, canonicalSlug)
    const nextCanonicalMetadata = {
      ...asRecord(canonical.metadata),
      canonical_development_slug: canonicalSlug,
      canonical_alias_slugs: Array.from(new Set([
        ...asArray(asRecord(canonical.metadata).canonical_alias_slugs),
        ...aliasSlugs,
      ])),
      canonicalized_at: NOW.toISOString(),
      canonicalized_by: 'repair-development-canonical-aliases',
    }

    updates.push({
      id: canonical.id,
      slug: canonical.slug,
      role: 'canonical',
      before: { content: canonical.content, metadata: canonical.metadata },
      after: { content: nextCanonicalContent, metadata: nextCanonicalMetadata },
    })
    backupRows.push(canonical)

    for (const aliasPage of aliasPages) {
      updates.push({
        id: aliasPage.id,
        slug: aliasPage.slug,
        role: 'alias',
        before: { content: aliasPage.content, metadata: aliasPage.metadata },
        after: {
          content: markAliasContent(asRecord(aliasPage.content), canonicalSlug),
          metadata: mergeAliases(asRecord(aliasPage.metadata), canonicalSlug),
        },
      })
      backupRows.push(aliasPage)
    }

    groups.push({
      canonical_slug: canonicalSlug,
      alias_slugs: aliasPages.map(page => text(page.slug)),
      before_units: beforeUnits,
      after_units: mergedUnits.length,
      units_added: Math.max(0, mergedUnits.length - beforeUnits),
    })
  }

  await mkdir('output', { recursive: true })
  await writeFile(`${OUTPUT_PREFIX}-backup.json`, JSON.stringify(backupRows, null, 2), 'utf8')
  await writeFile(`${OUTPUT_PREFIX}-updates.json`, JSON.stringify(updates.map(({ before, after, ...summary }) => summary), null, 2), 'utf8')

  if (APPLY) {
    for (const update of updates) {
      const { error } = await supabase
        .from('landing_pages')
        .update({
          content: update.after.content,
          metadata: update.after.metadata,
          updated_at: NOW.toISOString(),
        })
        .eq('id', update.id)

      if (error) throw error
    }
  }

  const report = {
    generated_at: NOW.toISOString(),
    apply: APPLY,
    outputs: {
      backup: `${OUTPUT_PREFIX}-backup.json`,
      updates: `${OUTPUT_PREFIX}-updates.json`,
    },
    totals: {
      canonical_groups: groups.filter(group => !group.missing).length,
      alias_pages: updates.filter(update => update.role === 'alias').length,
      units_merged: groups.reduce((sum, group) => sum + (group.units_added || 0), 0),
    },
    groups,
  }

  await writeFile(`${OUTPUT_PREFIX}.json`, JSON.stringify(report, null, 2), 'utf8')
  await writeFile(`${OUTPUT_PREFIX}.md`, buildMarkdown(report), 'utf8')

  console.log('Development canonical aliases repair')
  console.log(`- mode: ${APPLY ? 'apply' : 'dry-run'}`)
  for (const [key, value] of Object.entries(report.totals)) console.log(`- ${key}: ${value}`)
  console.log(`- report: ${OUTPUT_PREFIX}.md`)
  console.log(`- backup: ${OUTPUT_PREFIX}-backup.json`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
