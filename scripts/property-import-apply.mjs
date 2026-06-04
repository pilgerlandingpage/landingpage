#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'
import { buildImportReport, readMappedProperties } from './property-import-dry-run.mjs'

const DEFAULT_FILE = 'c:\\Users\\conne\\Downloads\\dados dos imoveis.txt'
const SOURCE_SYSTEM = 'legacy_xml'

function parseArgs(argv) {
    const args = {
        file: DEFAULT_FILE,
        limit: 5,
        offset: 0,
        apply: false,
        skipImages: false,
        onlyMissing: false,
        concurrency: 4,
        encoding: 'utf8',
    }

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i]
        if (arg === '--file') args.file = argv[++i]
        else if (arg === '--limit') args.limit = Number(argv[++i] || 5)
        else if (arg === '--offset') args.offset = Number(argv[++i] || 0)
        else if (arg === '--concurrency') args.concurrency = Number(argv[++i] || 4)
        else if (arg === '--encoding') args.encoding = argv[++i] || 'utf8'
        else if (arg === '--apply') args.apply = true
        else if (arg === '--skip-images') args.skipImages = true
        else if (arg === '--only-missing') args.onlyMissing = true
    }

    args.limit = Math.max(1, Math.min(args.limit, 500))
    args.offset = Math.max(0, args.offset)
    args.concurrency = Math.max(1, Math.min(args.concurrency, 12))
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

function normalizeStatus(mapped) {
    const original = mapped.public.original_status
    if (original === 'Disponível' && mapped.public.visible) return 'active'
    if (original === 'Reservado') return 'reserved'
    if (original === 'Vendido') return 'sold'
    return 'inactive'
}

function toIsoOrNull(value) {
    if (!value) return null
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function safeFileName(value) {
    return String(value || 'image')
        .split('/')
        .pop()
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .slice(0, 160)
}

function extensionFromContentType(contentType) {
    if (contentType.includes('png')) return 'png'
    if (contentType.includes('webp')) return 'webp'
    if (contentType.includes('gif')) return 'gif'
    return 'jpg'
}

async function getAppConfigs(supabase) {
    const { data } = await supabase.from('app_config').select('key, value')
    return (data || []).reduce((acc, row) => {
        acc[row.key] = row.value
        return acc
    }, {})
}

async function getExistingSourceReferences(supabase) {
    const refs = new Set()
    const pageSize = 1000

    for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
            .from('properties')
            .select('source_reference')
            .eq('source_system', SOURCE_SYSTEM)
            .range(from, from + pageSize - 1)

        if (error) throw error
        for (const row of data || []) {
            if (row?.source_reference) refs.add(String(row.source_reference))
        }
        if (!data || data.length < pageSize) break
    }

    return refs
}

function getR2Config(configs) {
    const accountId = configs.r2_account_id || process.env.R2_ACCOUNT_ID
    const accessKeyId = configs.r2_access_key_id || process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = configs.r2_secret_access_key || process.env.R2_SECRET_ACCESS_KEY
    const bucketName = configs.r2_bucket_name || process.env.R2_BUCKET_NAME
    const publicUrl = (configs.r2_public_url || process.env.R2_PUBLIC_URL || process.env.R2_PUBLIC_DOMAIN || '').replace(/\/$/, '')

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
        return null
    }

    return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl }
}

function createR2Client(config) {
    return new S3Client({
        region: 'auto',
        endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
    })
}

async function uploadImageToR2(r2, r2Config, mapped, image) {
    const response = await fetch(image.original_url)
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ao baixar imagem`)
    }
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) {
        throw new Error(`Conteudo nao parece imagem: ${contentType}`)
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    const ext = path.extname(image.original_path || '').replace('.', '') || extensionFromContentType(contentType)
    const originalName = safeFileName(image.original_path || `image.${ext}`)
    const key = `properties/imported/${mapped.source_reference}/${String(image.order).padStart(3, '0')}-${originalName}`

    await r2.send(new PutObjectCommand({
        Bucket: r2Config.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
    }))

    return {
        key,
        url: `${r2Config.publicUrl}/${key}`,
        contentType,
        byteSize: buffer.length,
    }
}

async function mapLimit(items, limit, worker) {
    const results = new Array(items.length)
    let index = 0
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (index < items.length) {
            const current = index
            index += 1
            results[current] = await worker(items[current], current)
        }
    })
    await Promise.all(workers)
    return results
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

function publicPayload(mapped, mediaUrls) {
    const p = mapped.public
    const firstImage = mediaUrls.find(item => item.is_featured)?.url || mediaUrls[0]?.url || p.featured_image_original_url || null
    const allImages = mediaUrls.filter(item => item.media_type === 'image').map(item => item.url).filter(Boolean)
    return {
        title: normalizeBedroomText(p.title || `Imovel ${mapped.source_reference}`),
        description: p.description ? normalizeBedroomText(p.description) : null,
        address: [p.street, p.number, p.neighborhood].filter(Boolean).join(', ') || null,
        city: p.city || null,
        state: p.state || null,
        price: p.price,
        property_type: p.property_type || null,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        area_m2: p.area_private_m2 || p.area_total_m2,
        amenities: (p.amenities || []).map(normalizeBedroomText),
        images: allImages,
        featured_image: firstImage,
        status: normalizeStatus(mapped),
        video_url: p.videos?.[0] || null,
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
        seo_title: p.seo_title ? normalizeBedroomText(p.seo_title) : null,
        seo_description: p.seo_description ? normalizeBedroomText(p.seo_description) : null,
        source_created_at: toIsoOrNull(mapped.private.created_at_source),
        source_updated_at: toIsoOrNull(mapped.private.updated_at_source),
        source_payload: mapped.public,
        imported_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }
}

function privatePayload(mapped, propertyId) {
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

async function logImport(supabase, sourceReference, severity, stage, message, details = {}) {
    await supabase.from('property_import_logs').insert({
        source_system: SOURCE_SYSTEM,
        source_reference: sourceReference,
        severity,
        stage,
        message,
        details,
    })
}

async function processProperty({ supabase, mapped, r2, r2Config, skipImages, concurrency }) {
    const imageRows = await mapLimit(mapped.media.images, concurrency, async image => {
        let uploaded = null
        let status = 'skipped'
        let errorMessage = null
        if (!skipImages && r2 && image.original_url) {
            try {
                uploaded = await uploadImageToR2(r2, r2Config, mapped, image)
                status = 'uploaded'
            } catch (error) {
                status = 'error'
                errorMessage = error?.message || String(error)
            }
        }

        const url = uploaded?.url || image.original_url
        return {
            media_type: 'image',
            position: image.order,
            original_path: image.original_path || null,
            original_url: image.original_url || null,
            r2_key: uploaded?.key || null,
            url,
            caption: image.caption || null,
            is_featured: image.is_featured,
            download_status: status,
            download_error: errorMessage,
            content_type: uploaded?.contentType || null,
            byte_size: uploaded?.byteSize || null,
        }
    })

    const mediaRows = [...imageRows]
    const mediaUrls = [...imageRows]

    for (const [index, videoUrl] of mapped.media.videos.entries()) {
        const media = {
            media_type: 'video',
            position: index + 1,
            original_url: videoUrl,
            url: videoUrl,
            is_featured: false,
            download_status: 'external',
        }
        mediaRows.push(media)
        mediaUrls.push(media)
    }

    const propertyPayload = publicPayload(mapped, mediaUrls)
    const { data: property, error: propertyError } = await supabase
        .from('properties')
        .upsert(propertyPayload, { onConflict: 'source_system,source_reference' })
        .select('id')
        .single()

    if (propertyError) throw propertyError

    const { error: privateError } = await supabase
        .from('property_private_details')
        .upsert(privatePayload(mapped, property.id), { onConflict: 'property_id' })

    if (privateError) throw privateError

    if (mediaRows.length > 0) {
        const rows = mediaRows.map(row => ({
            ...row,
            property_id: property.id,
            source_system: SOURCE_SYSTEM,
            source_reference: mapped.source_reference,
            updated_at: new Date().toISOString(),
        }))
        const { error: mediaError } = await supabase
            .from('property_media')
            .upsert(rows, { onConflict: 'source_system,source_reference,media_type,position' })
        if (mediaError) throw mediaError
    }

    const failedImages = mediaRows.filter(row => row.download_status === 'error').length
    await logImport(supabase, mapped.source_reference, failedImages > 0 ? 'warning' : 'success', 'property_import', 'Imovel importado', {
        title: mapped.public.title,
        images: mapped.media.images.length,
        failed_images: failedImages,
        status: propertyPayload.status,
    })

    return { source_reference: mapped.source_reference, property_id: property.id, failed_images: failedImages }
}

async function main() {
    const args = parseArgs(process.argv.slice(2))
    loadEnv()

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase nao configurado em .env.local.')
    }

    const { properties } = await readMappedProperties(args.file, { encoding: args.encoding })
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    let importPool = properties

    if (args.onlyMissing) {
        const existingRefs = await getExistingSourceReferences(supabase)
        importPool = properties.filter(mapped => !existingRefs.has(String(mapped.source_reference || '')))
        console.log(`Modo only-missing: ${importPool.length} imoveis ainda nao cadastrados de ${properties.length}.`)
    }

    const selected = importPool.slice(args.offset, args.offset + args.limit)
    const report = buildImportReport(selected)

    console.log(`Selecionados: ${selected.length} imoveis de ${importPool.length}`)
    console.log(`Offset: ${args.offset} | Limit: ${args.limit}`)
    console.log(`Imagens neste lote: ${report.counters.images}`)
    console.log(`Modo: ${args.apply ? 'APLICAR' : 'DRY-RUN'}${args.skipImages ? ' | sem upload de imagens' : ''}`)

    if (!args.apply) {
        console.log('Nada foi gravado. Use --apply para importar este lote.')
        console.log(JSON.stringify(selected.slice(0, 2), null, 2))
        return
    }

    const configs = await getAppConfigs(supabase)
    const r2Config = getR2Config(configs)
    const r2 = !args.skipImages && r2Config ? createR2Client(r2Config) : null
    if (!args.skipImages && !r2) {
        throw new Error('R2 nao configurado. Preencha Cloudflare R2 na Sala de Manutencao ou use --skip-images para testar dados sem imagens.')
    }

    const results = []
    for (const mapped of selected) {
        try {
            const result = await processProperty({ supabase, mapped, r2, r2Config, skipImages: args.skipImages, concurrency: args.concurrency })
            results.push({ ...result, success: true })
            console.log(`OK ${mapped.source_reference} - ${mapped.public.title}`)
        } catch (error) {
            const message = error?.message || String(error)
            results.push({ source_reference: mapped.source_reference, success: false, error: message })
            console.error(`ERRO ${mapped.source_reference}: ${message}`)
            await logImport(supabase, mapped.source_reference, 'error', 'property_import', message, { title: mapped.public.title }).catch(() => {})
        }
    }

    const ok = results.filter(row => row.success).length
    const failed = results.length - ok
    const failedImages = results.reduce((sum, row) => sum + Number(row.failed_images || 0), 0)
    console.log(`Finalizado. Imoveis OK: ${ok}. Falhas: ${failed}. Imagens com falha: ${failedImages}.`)
}

main().catch(error => {
    console.error(error?.stack || error?.message || error)
    process.exit(1)
})
