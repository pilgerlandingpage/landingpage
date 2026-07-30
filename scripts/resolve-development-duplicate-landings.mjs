#!/usr/bin/env node

import dotenv from 'dotenv'
import { mkdirSync, writeFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })
dotenv.config()

const APPLY = process.argv.includes('--apply')
const NOW = new Date().toISOString()

const CANONICAL_PAIRS = [
  ['porto-riviera', 'condominio-porto-riviera'],
  ['horizontal', 'condominio-horizontal'],
  ['caledonia-private-village', 'condominio-caledonia-private-village'],
  ['era', 'edificio-era'],
  ['porto-di-napoli', 'edificio-porto-di-napoli'],
  ['caledonia', 'condominio-caledonia'],
  ['marina-camboriu', 'condominio-marina-camboriu'],
  ['haras-rio-do-ouro', 'condominio-haras-rio-do-ouro'],
  ['george-vi', 'george-vi-residencial'],
  ['sirena', 'ed-sirena'],
  ['riva', 'edificio-riva'],
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
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function text(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function uniq(values) {
  return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))]
}

function unitKey(unit) {
  const record = asRecord(unit)
  return normalizeKey(
    record.propertyId ||
    record.property_id ||
    record.sourceReference ||
    record.source_reference ||
    record.id ||
    record.sourceSlug ||
    record.source_slug ||
    record.slug
  )
}

function imageKey(item) {
  const record = typeof item === 'string' ? { image: item } : asRecord(item)
  return text(record.image || record.url || record.src)
}

function mergeByKey(left, right, keyFn) {
  const byKey = new Map()
  for (const item of [...asArray(left), ...asArray(right)]) {
    const key = keyFn(item)
    if (!key) continue
    byKey.set(key, byKey.has(key) ? { ...asRecord(byKey.get(key)), ...asRecord(item) } : item)
  }
  return [...byKey.values()]
}

function mergeLandingContent(canonicalPage, duplicatePage) {
  const canonicalContent = asRecord(canonicalPage.content)
  const duplicateContent = asRecord(duplicatePage.content)
  const canonicalDevelopment = asRecord(canonicalContent.development)
  const duplicateDevelopment = asRecord(duplicateContent.development)
  const mergedUnits = mergeByKey(canonicalDevelopment.units, duplicateDevelopment.units, unitKey)
  const mergedDevelopmentGallery = mergeByKey(canonicalDevelopment.gallery, duplicateDevelopment.gallery, imageKey)
  const mergedCustomGallery = mergeByKey(canonicalContent.custom_gallery, duplicateContent.custom_gallery, imageKey)
  const duplicateNames = uniq([
    duplicateDevelopment.sourceCondominiumName,
    duplicateDevelopment.source_condominium_name,
    duplicateDevelopment.name,
    duplicateContent.custom_title,
    duplicatePage.title,
    duplicatePage.slug,
    ...asArray(duplicateDevelopment.sourceCondominiumAliases),
    ...asArray(duplicateDevelopment.source_condominium_aliases),
    ...asArray(asRecord(duplicatePage.metadata).source_condominium_aliases),
  ])
  const mergedAliases = uniq([
    ...asArray(canonicalDevelopment.sourceCondominiumAliases),
    ...asArray(canonicalDevelopment.source_condominium_aliases),
    ...duplicateNames,
  ])

  return {
    ...canonicalContent,
    custom_gallery: mergedCustomGallery.length ? mergedCustomGallery : canonicalContent.custom_gallery,
    available_units_count: mergedUnits.length,
    development: {
      ...canonicalDevelopment,
      units: mergedUnits,
      gallery: mergedDevelopmentGallery.length ? mergedDevelopmentGallery : canonicalDevelopment.gallery,
      availableUnitsCount: mergedUnits.length,
      available_units_count: mergedUnits.length,
      sourceCondominiumAliases: mergedAliases,
      source_condominium_aliases: mergedAliases,
    },
    schema: {
      ...asRecord(canonicalContent.schema),
      has_item_list: mergedUnits.length > 0,
      unit_count: mergedUnits.length,
    },
  }
}

function mergeCanonicalMetadata(canonicalPage, duplicatePage, mergedContent) {
  const canonicalMetadata = asRecord(canonicalPage.metadata)
  const duplicateMetadata = asRecord(duplicatePage.metadata)
  const development = asRecord(mergedContent.development)
  return {
    ...canonicalMetadata,
    source_condominium_aliases: uniq([
      ...asArray(canonicalMetadata.source_condominium_aliases),
      ...asArray(duplicateMetadata.source_condominium_aliases),
      ...asArray(development.sourceCondominiumAliases),
      duplicatePage.slug,
    ]),
    property_count: asArray(development.units).length,
    merged_duplicate_slugs: uniq([
      ...asArray(canonicalMetadata.merged_duplicate_slugs),
      duplicatePage.slug,
    ]),
    dedupe_updated_at: NOW,
    dedupe_updated_by: 'resolve-development-duplicate-landings',
  }
}

function duplicateRedirectContent(duplicatePage, canonicalSlug) {
  const content = asRecord(duplicatePage.content)
  return {
    ...content,
    redirect_to_slug: canonicalSlug,
    seo: {
      ...asRecord(content.seo),
      canonical_path: `/${canonicalSlug}`,
    },
  }
}

function duplicateRedirectMetadata(duplicatePage, canonicalPage) {
  const metadata = asRecord(duplicatePage.metadata)
  return {
    ...metadata,
    redirect_to_slug: canonicalPage.slug,
    canonical_landing_page_id: canonicalPage.id,
    duplicate_of_slug: canonicalPage.slug,
    deduped_at: NOW,
    deduped_by: 'resolve-development-duplicate-landings',
  }
}

async function fetchPages(slugs) {
  const { data, error } = await supabase
    .from('landing_pages')
    .select('id, slug, title, status, content, metadata, updated_at')
    .in('slug', slugs)
  if (error) throw error
  return data || []
}

async function main() {
  const slugs = uniq(CANONICAL_PAIRS.flat())
  const pages = await fetchPages(slugs)
  const bySlug = new Map(pages.map(page => [page.slug, page]))
  const plan = []

  if (APPLY) {
    mkdirSync('output', { recursive: true })
    const backupPath = `output/development-duplicate-landings-backup-${NOW.replace(/[:.]/g, '-')}.json`
    writeFileSync(backupPath, JSON.stringify({ generated_at: NOW, pages }, null, 2), 'utf8')
    console.log(`Backup written: ${backupPath}`)
  }

  for (const [duplicateSlug, canonicalSlug] of CANONICAL_PAIRS) {
    const duplicatePage = bySlug.get(duplicateSlug)
    const canonicalPage = bySlug.get(canonicalSlug)
    if (!duplicatePage || !canonicalPage) {
      plan.push({ duplicateSlug, canonicalSlug, ok: false, reason: 'missing_page' })
      continue
    }

    const beforeCanonicalUnits = asArray(asRecord(asRecord(canonicalPage.content).development).units).length
    const beforeDuplicateUnits = asArray(asRecord(asRecord(duplicatePage.content).development).units).length
    const mergedContent = mergeLandingContent(canonicalPage, duplicatePage)
    const mergedMetadata = mergeCanonicalMetadata(canonicalPage, duplicatePage, mergedContent)
    const afterUnits = asArray(asRecord(mergedContent.development).units).length

    plan.push({
      duplicateSlug,
      canonicalSlug,
      ok: true,
      beforeCanonicalUnits,
      beforeDuplicateUnits,
      afterCanonicalUnits: afterUnits,
      canonicalId: canonicalPage.id,
      duplicateId: duplicatePage.id,
    })

    if (!APPLY) continue

    const canonicalUpdate = await supabase
      .from('landing_pages')
      .update({
        content: mergedContent,
        metadata: mergedMetadata,
        updated_at: NOW,
      })
      .eq('id', canonicalPage.id)
    if (canonicalUpdate.error) throw canonicalUpdate.error

    const duplicateUpdate = await supabase
      .from('landing_pages')
      .update({
        content: duplicateRedirectContent(duplicatePage, canonicalSlug),
        metadata: duplicateRedirectMetadata(duplicatePage, canonicalPage),
        updated_at: NOW,
      })
      .eq('id', duplicatePage.id)
    if (duplicateUpdate.error) throw duplicateUpdate.error
  }

  console.log(JSON.stringify({
    mode: APPLY ? 'apply' : 'dry-run',
    pairs: plan.length,
    ready: plan.filter(item => item.ok).length,
    blocked: plan.filter(item => !item.ok).length,
    plan,
  }, null, 2))

  if (!APPLY) {
    console.log('\nDry-run only. Run with --apply to update landing_pages.')
  }
}

main().catch(error => {
  console.error(error?.message || error)
  process.exitCode = 1
})
