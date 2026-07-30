#!/usr/bin/env node

import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })
dotenv.config()

const APPLY = process.argv.includes('--apply')
const AUDIT_FILE_ARG = process.argv.find(arg => arg.startsWith('--audit-file='))
const AUDIT_FILE = AUDIT_FILE_ARG
  ? AUDIT_FILE_ARG.split('=').slice(1).join('=').trim()
  : 'output/property-development-link-audit-20260729.json'
const NOW = new Date().toISOString()

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

function canonicalNameFromPage(page, fallback) {
  const content = asRecord(page?.content)
  const development = asRecord(content.development)
  return text(
    development.sourceCondominiumName ||
    development.source_condominium_name ||
    development.name ||
    page?.title,
    fallback
  )
}

function loadAuditCandidates() {
  const report = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'))
  return [...(report.buckets.direct || []), ...(report.buckets.title_inference || [])]
    .filter(item => !text(item.condominium_name) && item.matched_pages?.length)
}

async function fetchLandingPages(slugs) {
  if (!slugs.length) return new Map()

  const { data, error } = await supabase
    .from('landing_pages')
    .select('slug,title,content,metadata,status')
    .in('slug', slugs)

  if (error) throw error
  return new Map((data || []).map(page => [page.slug, page]))
}

async function fetchPrivateRows(propertyIds) {
  if (!propertyIds.length) return new Map()

  const { data, error } = await supabase
    .from('property_private_details')
    .select('id,property_id,source_reference,condominium_name,updated_at')
    .in('property_id', propertyIds)

  if (error) throw error
  return new Map((data || []).map(row => [row.property_id, row]))
}

async function buildUpdates() {
  const candidates = loadAuditCandidates()
  const landingBySlug = await fetchLandingPages([...new Set(candidates.map(item => item.matched_pages[0]).filter(Boolean))])
  const privateByPropertyId = await fetchPrivateRows(candidates.map(item => item.property_id).filter(Boolean))

  return candidates.map(item => {
    const pageSlug = item.matched_pages[0]
    const page = landingBySlug.get(pageSlug)
    const privateRow = privateByPropertyId.get(item.property_id)
    const condominiumName = canonicalNameFromPage(page, item.inferred_development_name)

    return {
      property_id: item.property_id,
      source_reference: item.source_reference,
      source_slug: item.source_slug,
      title: item.title,
      property_type: item.property_type,
      current_condominium_name: privateRow?.condominium_name || null,
      condominium_name: condominiumName,
      evidence: {
        mode: item.mode,
        matched_page_slug: pageSlug,
        matched_page_title: page?.title || null,
        source: 'existing_development_landing_page',
      },
      can_update: Boolean(privateRow?.id && !text(privateRow.condominium_name) && condominiumName),
    }
  }).filter(item => item.can_update)
}

async function applyUpdates(updates) {
  for (const item of updates) {
    const { error } = await supabase
      .from('property_private_details')
      .update({
        condominium_name: item.condominium_name,
        updated_at: NOW,
      })
      .eq('property_id', item.property_id)

    if (error) throw error
  }
}

async function main() {
  const updates = await buildUpdates()
  const backupPath = path.join(
    'output',
    `missing-condominium-name-fill-${APPLY ? 'apply' : 'dry-run'}-${NOW.replace(/[:.]/g, '-')}.json`
  )
  fs.writeFileSync(backupPath, JSON.stringify({ generated_at: NOW, apply: APPLY, updates }, null, 2), 'utf8')

  if (APPLY) await applyUpdates(updates)

  console.log(`Missing condominium name fill ${APPLY ? 'apply' : 'dry-run'}`)
  console.log(`- candidates_to_update: ${updates.length}`)
  console.log(`- backup: ${backupPath}`)
  if (!APPLY) console.log('- dry_run_only: run with --apply to update Supabase')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
