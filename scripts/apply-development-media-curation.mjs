#!/usr/bin/env node

import dotenv from 'dotenv'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local', quiet: true })
dotenv.config({ quiet: true })

const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const fileArg = process.argv.find(arg => arg.startsWith('--file='))
const slugsArg = process.argv.find(arg => arg.startsWith('--slugs='))
const curationFile = fileArg ? fileArg.split('=').slice(1).join('=').trim() : 'output/development-media-curation-batch1-20260714.json'
const slugFilter = new Set(
  slugsArg
    ? slugsArg.split('=').slice(1).join('=').split(',').map(item => item.trim()).filter(Boolean)
    : []
)
const NOW = new Date()
const STAMP = NOW.toISOString().replace(/[-:]/g, '').replace(/\..+$/, '')
const OUTPUT_PREFIX = `output/development-media-curation-${STAMP}`

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

function unique(values) {
  return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)))
}

function compactSeo(value, max = 158) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= max) return normalized
  const cut = normalized.slice(0, max - 3)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > 80 ? lastSpace : cut.length).replace(/[,.:\-;]+$/g, '')}...`
}

async function readCuration(filePath) {
  const parsed = JSON.parse(await readFile(filePath, 'utf8'))
  const items = asArray(parsed.items)
  const bySlug = new Map(items.map(item => [item.slug, item]))
  return {
    ...parsed,
    items: items.map(item => {
      if (!item.copy_from_slug) return item
      const source = bySlug.get(item.copy_from_slug)
      if (!source) throw new Error(`copy_from_slug not found for ${item.slug}: ${item.copy_from_slug}`)
      return {
        ...source,
        slug: item.slug,
        copied_from_slug: item.copy_from_slug,
      }
    }).filter(item => !slugFilter.size || slugFilter.has(item.slug)),
  }
}

async function fetchLandingPages(slugs) {
  const { data, error } = await supabase
    .from('landing_pages')
    .select('id, slug, title, description, status, content, metadata, updated_at')
    .in('slug', slugs)
    .order('slug', { ascending: true })

  if (error) throw error
  return data || []
}

function normalizeGallery(item) {
  const record = asRecord(item)
  return {
    title: text(record.title, 'Empreendimento'),
    image: text(record.image || record.url || record.src),
    category: text(record.category, 'Empreendimento'),
    source_url: text(record.source_url),
    source_label: text(record.source_label),
  }
}

function buildNextRow(row, item, batchId) {
  const content = { ...asRecord(row.content) }
  const metadata = { ...asRecord(row.metadata) }
  const development = { ...asRecord(content.development) }
  const seo = { ...asRecord(content.seo) }
  const gallery = asArray(item.gallery).map(normalizeGallery).filter(entry => entry.image)
  const heroImage = text(item.hero_image || gallery[0]?.image || content.custom_hero_image || development.heroImage || development.hero_image)
  const description = text(item.description || development.description || content.custom_description || row.description)
  const seoDescription = compactSeo(item.seo_description || description)
  const sources = unique([
    ...asArray(item.sources),
    ...gallery.map(entry => entry.source_url),
  ])

  const nextDevelopment = {
    ...development,
    heroImage,
    hero_image: heroImage,
    description,
    gallery,
    benefits: asArray(item.benefits).length ? item.benefits : development.benefits,
    differentials: asArray(item.differentials).length ? item.differentials : development.differentials,
    faq: asArray(item.faq).length ? item.faq : development.faq,
    mediaCuration: {
      batch_id: batchId,
      curated_at: NOW.toISOString(),
      sources,
    },
    media_curation: {
      batch_id: batchId,
      curated_at: NOW.toISOString(),
      sources,
    },
  }

  const nextSeo = {
    ...seo,
    description: seoDescription,
    og_image: heroImage,
    image: heroImage,
    updated_at: NOW.toISOString(),
  }

  const nextContent = {
    ...content,
    custom_description: description,
    custom_hero_image: heroImage,
    custom_gallery: gallery,
    development: nextDevelopment,
    seo: nextSeo,
    aeo_questions: asArray(item.faq).length ? item.faq : content.aeo_questions,
    media_curation: {
      batch_id: batchId,
      curated_at: NOW.toISOString(),
      sources,
      copied_from_slug: item.copied_from_slug || null,
    },
  }

  const nextMetadata = {
    ...metadata,
    development_media_curation: {
      batch_id: batchId,
      curated_at: NOW.toISOString(),
      sources,
      copied_from_slug: item.copied_from_slug || null,
    },
  }

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    before: {
      description: row.description,
      custom_hero_image: content.custom_hero_image || null,
      development_hero_image: development.heroImage || development.hero_image || null,
      custom_gallery_count: asArray(content.custom_gallery).length,
      development_gallery_count: asArray(development.gallery).length,
    },
    after: {
      description: seoDescription,
      custom_hero_image: heroImage,
      gallery_count: gallery.length,
      sources,
    },
    update: {
      description: seoDescription,
      content: nextContent,
      metadata: nextMetadata,
      updated_at: NOW.toISOString(),
    },
  }
}

async function main() {
  const curation = await readCuration(curationFile)
  if (!curation.items.length) {
    throw new Error('No curation items to process.')
  }

  const slugs = curation.items.map(item => item.slug)
  const pages = await fetchLandingPages(slugs)
  const bySlug = new Map(pages.map(page => [page.slug, page]))
  const missing = slugs.filter(slug => !bySlug.has(slug))
  if (missing.length) throw new Error(`Landing pages not found: ${missing.join(', ')}`)

  const planned = curation.items.map(item => buildNextRow(bySlug.get(item.slug), item, curation.batch_id || 'development-media-curation'))
  const backup = pages.map(page => ({
    id: page.id,
    slug: page.slug,
    title: page.title,
    description: page.description,
    status: page.status,
    content: page.content,
    metadata: page.metadata,
    updated_at: page.updated_at,
  }))

  await mkdir('output', { recursive: true })
  await writeFile(`${OUTPUT_PREFIX}-backup.json`, JSON.stringify(backup, null, 2), 'utf8')
  await writeFile(`${OUTPUT_PREFIX}-plan.json`, JSON.stringify({
    generated_at: NOW.toISOString(),
    apply,
    curation_file: curationFile,
    items: planned.map(item => ({
      slug: item.slug,
      title: item.title,
      before: item.before,
      after: item.after,
    })),
  }, null, 2), 'utf8')

  const results = []
  if (apply) {
    for (const item of planned) {
      const { error } = await supabase
        .from('landing_pages')
        .update(item.update)
        .eq('id', item.id)
      if (error) throw error
      results.push({ slug: item.slug, status: 'updated' })
    }
  } else {
    results.push(...planned.map(item => ({ slug: item.slug, status: 'dry-run' })))
  }

  await writeFile(`${OUTPUT_PREFIX}-result.json`, JSON.stringify({
    generated_at: NOW.toISOString(),
    apply,
    results,
  }, null, 2), 'utf8')

  console.log('Development media curation')
  console.log(`- mode: ${apply ? 'apply' : 'dry-run'}`)
  console.log(`- file: ${curationFile}`)
  console.log(`- rows: ${planned.length}`)
  console.log(`- backup: ${OUTPUT_PREFIX}-backup.json`)
  console.log(`- plan: ${OUTPUT_PREFIX}-plan.json`)
  console.log(`- result: ${OUTPUT_PREFIX}-result.json`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
