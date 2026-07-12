#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { readMappedProperties } from './property-import-dry-run.mjs'

const DEFAULT_FILE = 'c:\\Users\\conne\\Downloads\\imoveis guilherme pilger.txt'
const SOURCE_SYSTEM = 'legacy_xml'
const MEDIA_FIELDS = new Set(['images', 'featured_image', 'video_url'])
const COPY_FIELDS = new Set(['description', 'seo_title', 'seo_description'])
const DATE_FIELDS = new Set(['source_created_at', 'source_updated_at'])
const DEFAULT_MAX_INACTIVATIONS = 100

function parseArgs(argv) {
    const args = {
        file: DEFAULT_FILE,
        encoding: 'utf8',
        apply: false,
        json: false,
        report: '',
        limit: 0,
        offset: 0,
        refs: [],
        includePrivate: false,
        includeCopy: false,
        maxInactivations: DEFAULT_MAX_INACTIVATIONS,
    }

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i]
        if (arg === '--file') args.file = argv[++i]
        else if (arg === '--encoding') args.encoding = argv[++i] || 'utf8'
        else if (arg === '--report') args.report = argv[++i] || ''
        else if (arg === '--limit') args.limit = Number(argv[++i] || 0)
        else if (arg === '--offset') args.offset = Number(argv[++i] || 0)
        else if (arg === '--refs') args.refs = String(argv[++i] || '').split(',').map(item => item.trim()).filter(Boolean)
        else if (arg === '--max-inactivations') args.maxInactivations = Number(argv[++i] || DEFAULT_MAX_INACTIVATIONS)
        else if (arg === '--apply') args.apply = true
        else if (arg === '--json') args.json = true
        else if (arg === '--include-private') args.includePrivate = true
        else if (arg === '--include-copy') args.includeCopy = true
    }

    args.limit = Math.max(0, Number.isFinite(args.limit) ? args.limit : 0)
    args.offset = Math.max(0, Number.isFinite(args.offset) ? args.offset : 0)
    args.maxInactivations = Math.max(0, Number.isFinite(args.maxInactivations) ? args.maxInactivations : DEFAULT_MAX_INACTIVATIONS)
    return args
}

function loadEnv(file = '.env.local') {
    if (!fs.existsSync(file)) return
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^([^#=]+)=(.*)$/)
        if (!match) continue
        const key = match[1].trim()
        const value = match[2].trim().replace(/^['"]|['"]$/g, '')
        if (!process.env[key]) process.env[key] = value
    }
}

function foldText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
}

function normalizeBedroomText(value) {
    return String(value || '')
        .replace(/\bQUARTOS\b/g, 'DORMITORIOS')
        .replace(/\bQuartos\b/g, 'Dormitorios')
        .replace(/\bquartos\b/g, 'dormitorios')
        .replace(/\bQUARTO\b/g, 'DORMITORIO')
        .replace(/\bQuarto\b/g, 'Dormitorio')
        .replace(/\bquarto\b/g, 'dormitorio')
}

function normalizeStatus(mapped) {
    const original = foldText(mapped.public.original_status)
    if (original === 'disponivel' && mapped.public.visible) return 'active'
    if (original === 'reservado') return 'reserved'
    if (original === 'vendido') return 'sold'
    if (original === 'alugado') return 'rented'
    return 'inactive'
}

function toIsoOrNull(value) {
    if (!value) return null
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function numberOrNull(value) {
    if (value === null || value === undefined || value === '') return null
    const parsed = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

function compareValue(value) {
    if (value === undefined || value === null || value === '') return null
    if (typeof value === 'number') return Number.isFinite(value) ? Number(value.toFixed(2)) : null
    if (typeof value === 'boolean') return value
    if (Array.isArray(value)) return JSON.stringify(value.map(item => String(item || '').trim()).filter(Boolean))
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value).trim() || null
}

function compareDateValue(value) {
    if (!value) return null
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date.getTime() : compareValue(value)
}

function financialSnapshot(property) {
    return {
        id: property.id,
        title: property.title,
        city: property.city,
        neighborhood: property.neighborhood,
        status: property.status,
        source_reference: property.source_reference,
        price: property.price,
        condo_fee: property.condo_fee,
        iptu: property.iptu,
        area_m2: property.area_m2,
        area_private_m2: property.area_private_m2,
    }
}

function areaFor(property) {
    return numberOrNull(property.area_private_m2) || numberOrNull(property.area_m2)
}

function pricePerSquareMeter(property) {
    const price = numberOrNull(property.price)
    const area = areaFor(property)
    if (!price || !area) return null
    return price / area
}

function sameNumericValue(first, second) {
    return numberOrNull(first) === numberOrNull(second)
}

function inferPriceEventType(previous, next) {
    const previousPrice = numberOrNull(previous.price)
    const nextPrice = numberOrNull(next.price)
    const priceChanged = !sameNumericValue(previous.price, next.price)
    const costsChanged = !sameNumericValue(previous.condo_fee, next.condo_fee) || !sameNumericValue(previous.iptu, next.iptu)

    if (priceChanged && previousPrice !== null && nextPrice !== null) {
        if (nextPrice < previousPrice) return 'price_reduced'
        if (nextPrice > previousPrice) return 'price_increased'
        return 'price_updated'
    }
    if (priceChanged) return 'price_updated'
    if (costsChanged) return 'costs_updated'
    return 'financial_update'
}

function buildPriceHistoryInsert(previous, next) {
    if (!next.id) return null
    const hasChange = !sameNumericValue(previous.price, next.price)
        || !sameNumericValue(previous.condo_fee, next.condo_fee)
        || !sameNumericValue(previous.iptu, next.iptu)

    if (!hasChange) return null

    return {
        property_id: next.id,
        event_type: inferPriceEventType(previous, next),
        previous_price: numberOrNull(previous.price),
        new_price: numberOrNull(next.price),
        previous_condo_fee: numberOrNull(previous.condo_fee),
        new_condo_fee: numberOrNull(next.condo_fee),
        previous_iptu: numberOrNull(previous.iptu),
        new_iptu: numberOrNull(next.iptu),
        previous_price_per_m2: pricePerSquareMeter(previous),
        new_price_per_m2: pricePerSquareMeter(next),
        area_m2: areaFor(next),
        source: 'legacy_xml_safe_update',
        changed_by: null,
        metadata: {
            property_title: next.title || null,
            city: next.city || null,
            neighborhood: next.neighborhood || null,
            source_reference: next.source_reference || null,
            previous_status: previous.status || null,
            new_status: next.status || null,
        },
    }
}

function buildPublicPayload(mapped, options = {}) {
    const p = mapped.public
    const payload = {
        title: normalizeBedroomText(p.title || `Imovel ${mapped.source_reference}`),
        address: [p.street, p.number, p.neighborhood].filter(Boolean).join(', ') || null,
        city: p.city || null,
        state: p.state || null,
        price: p.price,
        property_type: p.property_type || null,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        area_m2: p.area_private_m2 || p.area_total_m2,
        amenities: (p.amenities || []).map(normalizeBedroomText),
        status: normalizeStatus(mapped),
        latitude: p.latitude,
        longitude: p.longitude,
        source_system: SOURCE_SYSTEM,
        source_reference: mapped.source_reference,
        source_slug: p.slug || null,
        source_status: p.original_status || null,
        source_visible: p.visible,
        purpose: p.purpose || null,
        suites: p.suites,
        parking_spaces: p.parking_spaces,
        rent: p.rent,
        condo_fee: p.condo_fee,
        iptu: p.iptu,
        neighborhood: p.neighborhood || null,
        street: p.street || null,
        number: p.number || null,
        zip_code: p.zip_code || null,
        area_private_m2: p.area_private_m2,
        area_total_m2: p.area_total_m2,
        exclusive: p.exclusive,
        solar_position: p.solar_position || null,
        source_created_at: toIsoOrNull(mapped.private.created_at_source),
        source_updated_at: toIsoOrNull(mapped.private.updated_at_source),
        source_payload: p,
        updated_at: new Date().toISOString(),
    }

    if (options.includeCopy) {
        payload.description = p.description ? normalizeBedroomText(p.description) : null
        payload.seo_title = p.seo_title ? normalizeBedroomText(p.seo_title) : null
        payload.seo_description = p.seo_description ? normalizeBedroomText(p.seo_description) : null
    }

    for (const field of MEDIA_FIELDS) {
        delete payload[field]
    }
    if (!options.includeCopy) {
        for (const field of COPY_FIELDS) {
            delete payload[field]
        }
    }
    return payload
}

function buildPrivatePayload(mapped, propertyId) {
    const p = mapped.private
    return {
        property_id: propertyId,
        source_system: SOURCE_SYSTEM,
        source_reference: mapped.source_reference,
        owner_name: p.owner_name || null,
        owner_email: p.owner_email || null,
        owner_phones: p.owner_phones || null,
        sale_authorization_signed: p.sale_authorization_signed,
        registry: p.registry || null,
        liens: p.liens || null,
        keys_location: p.keys || null,
        internal_notes: p.internal_notes || null,
        client_reference: p.client_reference || null,
        sign_info: p.sign || null,
        broker_name: p.broker_name || null,
        broker_login: p.broker_login || null,
        created_by_name: p.created_by_name || null,
        condominium_name: p.condominium_name || null,
        construction_company: p.construction_company || null,
        raw_payload: p,
        updated_at: new Date().toISOString(),
    }
}

function diffPayload(existing, payload) {
    const changed = []
    for (const [field, nextValue] of Object.entries(payload)) {
        if (field === 'updated_at') continue
        if (field === 'source_payload') continue
        if (MEDIA_FIELDS.has(field)) continue
        if (COPY_FIELDS.has(field)) continue
        const previousValue = existing[field]
        if (DATE_FIELDS.has(field)) {
            if (compareDateValue(previousValue) !== compareDateValue(nextValue)) {
                changed.push({
                    field,
                    before: previousValue ?? null,
                    after: nextValue ?? null,
                })
            }
            continue
        }
        if (compareValue(previousValue) !== compareValue(nextValue)) {
            changed.push({
                field,
                before: previousValue ?? null,
                after: nextValue ?? null,
            })
        }
    }
    return changed
}

function summarizeChanges(changes) {
    return changes.reduce((acc, change) => {
        for (const diff of change.diffs) {
            acc[diff.field] = (acc[diff.field] || 0) + 1
        }
        return acc
    }, {})
}

async function fetchExistingProperties(supabase) {
    const rows = []
    const pageSize = 250
    const select = [
        'id',
        'source_system',
        'title',
        'description',
        'address',
        'city',
        'state',
        'price',
        'property_type',
        'bedrooms',
        'bathrooms',
        'area_m2',
        'amenities',
        'status',
        'latitude',
        'longitude',
        'source_reference',
        'source_slug',
        'source_status',
        'source_visible',
        'purpose',
        'suites',
        'parking_spaces',
        'rent',
        'condo_fee',
        'iptu',
        'neighborhood',
        'street',
        'number',
        'zip_code',
        'area_private_m2',
        'area_total_m2',
        'exclusive',
        'solar_position',
        'seo_title',
        'seo_description',
        'source_created_at',
        'source_updated_at',
        'updated_at',
    ].join(',')

    for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
            .from('properties')
            .select(select)
            .eq('source_system', SOURCE_SYSTEM)
            .range(from, from + pageSize - 1)

        if (error) throw error
        rows.push(...(data || []))
        if (!data || data.length < pageSize) break
    }

    return rows
}

async function applyChange(supabase, change, includePrivate) {
    const { error } = await supabase
        .from('properties')
        .update(change.payload)
        .eq('id', change.id)

    if (error) throw error

    if (includePrivate) {
        const { error: privateError } = await supabase
            .from('property_private_details')
            .upsert(change.privatePayload, { onConflict: 'property_id' })
        if (privateError) throw privateError
    }

    if (change.priceHistory) {
        const { error: historyError } = await supabase
            .from('property_price_history')
            .insert(change.priceHistory)
        if (historyError) throw historyError
    }
}

async function writeReport(reportPath, report) {
    if (!reportPath) return
    const absolutePath = path.resolve(reportPath)
    await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.promises.writeFile(absolutePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}

function printSummary(report) {
    console.log(`Arquivo: ${report.file}`)
    console.log(`Modo: ${report.apply ? 'APLICAR' : 'DRY-RUN'}`)
    console.log(`XML: ${report.totals.xml} | Banco legado: ${report.totals.db}`)
    console.log(`Existentes com mudanca: ${report.totals.changed}`)
    console.log(`Novos no XML: ${report.totals.missing_in_db}`)
    console.log(`Ausentes no XML: ${report.totals.stale_in_db}`)
    console.log(`Ativos que seriam ativados: ${report.totals.would_activate}`)
    console.log(`Ativos que seriam inativados/retirados da vitrine: ${report.totals.would_deactivate}`)
    console.log(`Mudancas de preco/custos com historico: ${report.totals.price_history_events}`)
    console.log(`Imagens preservadas: sim (images/featured_image nao entram no payload)`)
    if (report.report_path) console.log(`Relatorio: ${report.report_path}`)
}

async function main() {
    const args = parseArgs(process.argv.slice(2))
    loadEnv()

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase nao configurado em .env.local.')
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const { file, properties } = await readMappedProperties(args.file, { encoding: args.encoding })
    const sourcePool = args.refs.length
        ? properties.filter(mapped => args.refs.includes(String(mapped.source_reference)))
        : properties.slice(args.offset, args.limit ? args.offset + args.limit : undefined)
    const existingRows = await fetchExistingProperties(supabase)
    const existingByRef = new Map(existingRows.map(row => [String(row.source_reference), row]))
    const sourceRefs = new Set(properties.map(mapped => String(mapped.source_reference)))
    const changes = []
    const missingInDb = []

    for (const mapped of sourcePool) {
        const ref = String(mapped.source_reference)
        const existing = existingByRef.get(ref)
        const payload = buildPublicPayload(mapped, { includeCopy: args.includeCopy })

        if (!existing) {
            missingInDb.push({
                source_reference: ref,
                title: payload.title,
                status: payload.status,
                source_status: payload.source_status,
                source_visible: payload.source_visible,
                price: payload.price,
                city: payload.city,
                neighborhood: payload.neighborhood,
                images_in_xml: mapped.media.images.length,
            })
            continue
        }

        const diffs = diffPayload(existing, payload)
        if (!diffs.length) continue

        const nextFinancial = financialSnapshot({ ...existing, ...payload, id: existing.id })
        const priceHistory = buildPriceHistoryInsert(financialSnapshot(existing), nextFinancial)
        changes.push({
            id: existing.id,
            source_reference: ref,
            title: payload.title,
            previous_status: existing.status,
            next_status: payload.status,
            source_status: payload.source_status,
            source_visible: payload.source_visible,
            previous_price: existing.price,
            next_price: payload.price,
            source_updated_at: payload.source_updated_at,
            previous_source_updated_at: existing.source_updated_at,
            diffs,
            payload,
            privatePayload: buildPrivatePayload(mapped, existing.id),
            priceHistory,
        })
    }

    const staleInDb = existingRows
        .filter(row => !sourceRefs.has(String(row.source_reference)))
        .map(row => ({
            id: row.id,
            source_reference: row.source_reference,
            title: row.title,
            status: row.status,
            source_status: row.source_status,
            source_visible: row.source_visible,
            price: row.price,
            city: row.city,
            neighborhood: row.neighborhood,
        }))

    const wouldDeactivate = changes.filter(change => change.previous_status === 'active' && change.next_status !== 'active')
    const wouldActivate = changes.filter(change => change.previous_status !== 'active' && change.next_status === 'active')
    const applied = []
    const errors = []

    if (args.apply && wouldDeactivate.length > args.maxInactivations) {
        throw new Error(`Guardrail acionado: ${wouldDeactivate.length} imoveis sairiam de ativo. Use --max-inactivations ${wouldDeactivate.length} ou maior apos aprovacao.`)
    }

    if (args.apply) {
        for (const change of changes) {
            try {
                await applyChange(supabase, change, args.includePrivate)
                applied.push(change.source_reference)
            } catch (error) {
                errors.push({
                    source_reference: change.source_reference,
                    message: error?.message || String(error),
                })
            }
        }
    }

    const reportPath = args.report ? path.resolve(args.report) : ''
    const publicChanges = changes.map(change => ({
        source_reference: change.source_reference,
        title: change.title,
        previous_status: change.previous_status,
        next_status: change.next_status,
        source_status: change.source_status,
        source_visible: change.source_visible,
        previous_price: change.previous_price,
        next_price: change.next_price,
        source_updated_at: change.source_updated_at,
        previous_source_updated_at: change.previous_source_updated_at,
        fields: change.diffs.map(diff => diff.field),
        diffs: change.diffs,
        will_record_price_history: Boolean(change.priceHistory),
    }))
    const report = {
        generated_at: new Date().toISOString(),
        file,
        apply: args.apply,
        include_private: args.includePrivate,
        include_copy: args.includeCopy,
        media_preserved: true,
        new_records_are_report_only: true,
        report_path: reportPath || null,
        guardrails: {
            max_inactivations: args.maxInactivations,
        },
        totals: {
            xml: properties.length,
            scanned_xml: sourcePool.length,
            db: existingRows.length,
            changed: changes.length,
            missing_in_db: missingInDb.length,
            stale_in_db: staleInDb.length,
            would_activate: wouldActivate.length,
            would_deactivate: wouldDeactivate.length,
            price_history_events: changes.filter(change => change.priceHistory).length,
            applied: applied.length,
            errors: errors.length,
        },
        field_counts: Object.entries(summarizeChanges(changes))
            .sort((a, b) => b[1] - a[1])
            .map(([field, count]) => ({ field, count })),
        samples: {
            would_activate: wouldActivate.slice(0, 25).map(change => ({
                source_reference: change.source_reference,
                title: change.title,
                previous_status: change.previous_status,
                next_status: change.next_status,
                previous_price: change.previous_price,
                next_price: change.next_price,
            })),
            would_deactivate: wouldDeactivate.slice(0, 25).map(change => ({
                source_reference: change.source_reference,
                title: change.title,
                previous_status: change.previous_status,
                next_status: change.next_status,
                source_status: change.source_status,
                source_visible: change.source_visible,
            })),
            price_changes: changes.filter(change => change.priceHistory).slice(0, 25).map(change => ({
                source_reference: change.source_reference,
                title: change.title,
                previous_price: change.previous_price,
                next_price: change.next_price,
                event_type: change.priceHistory?.event_type || null,
            })),
            missing_in_db: missingInDb.slice(0, 25),
            stale_in_db: staleInDb.slice(0, 25),
        },
        changes: publicChanges,
        missing_in_db: missingInDb,
        stale_in_db: staleInDb,
        applied,
        errors,
    }

    await writeReport(reportPath, report)

    if (args.json) {
        console.log(JSON.stringify(report, null, 2))
    } else {
        printSummary(report)
    }

    if (errors.length) process.exit(1)
}

main().catch(error => {
    console.error(error?.stack || error?.message || error)
    process.exit(1)
})
