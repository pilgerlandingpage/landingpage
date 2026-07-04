import crypto from 'node:crypto'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

dotenv.config({ path: '.env.local', quiet: true })
dotenv.config({ quiet: true })

const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const auditOnly = args.has('--audit-only')
const skipBackfill = args.has('--skip-backfill')
const statusArg = process.argv.find(arg => arg.startsWith('--status='))
const idsArg = process.argv.find(arg => arg.startsWith('--ids='))
const rolesArg = process.argv.find(arg => arg.startsWith('--roles='))
const providersArg = process.argv.find(arg => arg.startsWith('--providers='))
const maxArg = process.argv.find(arg => arg.startsWith('--max-replacements='))
const statusFilter = statusArg?.split('=')[1]?.trim()
const idFilter = idsArg?.split('=')[1]?.split(',').map(id => id.trim()).filter(Boolean) || []
const roleFilter = new Set((rolesArg?.split('=')[1] || 'cover,inline').split(',').map(role => role.trim()).filter(Boolean))
const providerFilter = new Set((providersArg?.split('=')[1] || 'pexels').split(',').map(provider => provider.trim()).filter(Boolean))
const maxReplacements = Math.max(0, Number.parseInt(maxArg?.split('=')[1] || '0', 10) || 0)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Supabase nao configurado. Verifique NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
}

const SUPABASE_TIMEOUT_MS = 45000

async function timedSupabaseFetch(input, init = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new Error(`Supabase timeout after ${SUPABASE_TIMEOUT_MS}ms`)), SUPABASE_TIMEOUT_MS)
  const upstreamSignal = init.signal
  if (upstreamSignal) {
    if (upstreamSignal.aborted) controller.abort(upstreamSignal.reason)
    else upstreamSignal.addEventListener('abort', () => controller.abort(upstreamSignal.reason), { once: true })
  }
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
  global: { fetch: timedSupabaseFetch },
})

const CONFIG_KEYS = [
  'pexels_api_key',
  'pexels_enabled',
  'pexels_priority',
  'pexels_per_page',
  'pixabay_api_key',
  'pixabay_enabled',
  'pixabay_priority',
  'pixabay_per_page',
  'editorial_image_safe_search',
  'editorial_image_lang',
  'r2_account_id',
  'r2_access_key_id',
  'r2_secret_access_key',
  'r2_bucket_name',
  'r2_public_url',
]

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isRetryableSupabaseError(error) {
  const message = String(error?.message || error || '').toLowerCase()
  return [
    'fetch failed',
    'headers timeout',
    'connection timed out',
    'canceling statement',
    'error code 520',
    'error code 522',
    'error code 523',
    'error code 524',
    '503',
    '504',
    'abort',
    'timeout',
  ].some(pattern => message.includes(pattern))
}

async function runSupabase(label, queryFactory, attempts = 3) {
  let lastResult = null
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    lastResult = await queryFactory()
    if (!lastResult?.error) return lastResult
    if (!isRetryableSupabaseError(lastResult.error) || attempt === attempts) return lastResult
    console.warn(`[repair-editorial-media] ${label} falhou, tentativa ${attempt}/${attempts}: ${lastResult.error?.message || lastResult.error}`)
    await sleep(1200 * attempt)
  }
  return lastResult
}

function toBool(value, fallback = true) {
  const selected = String(value ?? '').trim().toLowerCase()
  if (selected === 'true') return true
  if (selected === 'false') return false
  return fallback
}

function toInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function normalizeUrl(value) {
  return String(value || '').trim()
}

function slugify(value) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || `editorial-image-${Date.now()}`
}

function unique(values) {
  return Array.from(new Set(values.map(value => String(value || '').replace(/\s+/g, ' ').trim()).filter(Boolean)))
}

function tagsFrom(value) {
  if (Array.isArray(value)) return value.map(String)
  if (!value) return []
  return String(value).split(',').map(item => item.trim()).filter(Boolean)
}

function metadataRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function visualPlanFromPost(post) {
  return metadataRecord(post.editorial_visual_plan)
}

function isNewsPost(post) {
  const tags = Array.isArray(post.tags) ? post.tags.map(normalize) : []
  return normalize(post.generated_by).includes('news')
    || normalize(post.category).includes('noticia')
    || tags.some(tag => tag.includes('noticia'))
}

function contentTypeForPost(post) {
  return isNewsPost(post) ? 'news' : 'blog'
}

function sourceKeyFromAsset(asset) {
  return normalizeUrl(asset.source_url || asset.original_url || asset.image_url)
}

function assetProvider(asset) {
  const explicit = normalize(asset.source || asset.provider)
  if (explicit) return explicit
  const sourceUrl = String(asset.source_url || asset.original_url || asset.image_url || '')
  if (sourceUrl.includes('pexels.com')) return 'pexels'
  if (sourceUrl.includes('pixabay.com')) return 'pixabay'
  if (sourceUrl.includes('unsplash.com')) return 'unsplash'
  if (sourceUrl.includes('/properties/')) return 'property'
  return 'url'
}

function inferProviderAssetId(asset) {
  const current = String(asset.provider_asset_id || asset.id || '').trim()
  if (current) return current
  const provider = assetProvider(asset)
  const sourceUrl = String(asset.source_url || asset.original_url || asset.image_url || '')
  if (provider === 'pexels') {
    return sourceUrl.match(/(?:photo-|foto\/|foto\/[^/]*-)(\d+)(?:[/?#]|$)/i)?.[1]
      || sourceUrl.match(/\/(\d+)(?:[/?#]|$)/)?.[1]
      || ''
  }
  if (provider === 'pixabay') {
    return sourceUrl.match(/-(\d+)\/?$/)?.[1] || sourceUrl.match(/\/(\d+)\/?$/)?.[1] || ''
  }
  return sourceUrl ? crypto.createHash('sha1').update(sourceUrl).digest('hex') : ''
}

function assetMemoryKey(asset) {
  const provider = assetProvider(asset)
  const providerAssetId = inferProviderAssetId(asset)
  return provider && providerAssetId ? `${provider}:${providerAssetId}` : ''
}

function addUrl(target, value) {
  const url = normalizeUrl(value)
  if (url) target.add(url)
}

function addAssetToMemory(memory, asset) {
  const key = assetMemoryKey(asset)
  if (key) {
    memory.providerAssetKeys.add(key)
    memory.recentProviderAssetKeys.add(key)
  }
  addUrl(memory.urls, asset.image_url)
  addUrl(memory.urls, asset.original_url)
  addUrl(memory.urls, asset.source_url)
  addUrl(memory.urls, asset.preview_url)
  addUrl(memory.recentUrls, asset.image_url)
  addUrl(memory.recentUrls, asset.original_url)
  addUrl(memory.recentUrls, asset.source_url)
  addUrl(memory.recentUrls, asset.preview_url)
}

function imageUrls(image) {
  return [
    image?.imageUrl,
    image?.downloadUrl,
    image?.sourceUrl,
    image?.previewUrl,
  ].map(normalizeUrl).filter(Boolean)
}

function providerAssetKey(provider, providerAssetId) {
  const providerName = String(provider || '').trim()
  const id = String(providerAssetId || '').trim()
  return providerName && id ? `${providerName}:${id}` : ''
}

function getProviderConfig(configMap) {
  return {
    pexelsApiKey: (configMap.pexels_api_key || process.env.PEXELS_API_KEY || '').trim(),
    pexelsEnabled: toBool(configMap.pexels_enabled, true),
    pexelsPriority: toInt(configMap.pexels_priority, 1, 1, 3),
    pexelsPerPage: toInt(configMap.pexels_per_page, 12, 3, 40),
    pixabayApiKey: (configMap.pixabay_api_key || process.env.PIXABAY_API_KEY || '').trim(),
    pixabayEnabled: toBool(configMap.pixabay_enabled, true),
    pixabayPriority: toInt(configMap.pixabay_priority, 2, 1, 3),
    pixabayPerPage: toInt(configMap.pixabay_per_page, 12, 3, 40),
    safeSearch: toBool(configMap.editorial_image_safe_search, true),
    lang: String(configMap.editorial_image_lang || 'pt').trim().toLowerCase() || 'pt',
    r2: {
      accountId: configMap.r2_account_id || process.env.R2_ACCOUNT_ID || '',
      accessKeyId: configMap.r2_access_key_id || process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: configMap.r2_secret_access_key || process.env.R2_SECRET_ACCESS_KEY || '',
      bucketName: configMap.r2_bucket_name || process.env.R2_BUCKET_NAME || '',
      publicUrl: (configMap.r2_public_url || process.env.R2_PUBLIC_URL || '').replace(/\/$/, ''),
    },
  }
}

function compactSearchTerm(value) {
  const ignored = new Set([
    'blog',
    'brasil',
    'caro',
    'guia',
    'imobiliario',
    'imoveis',
    'imovel',
    'mercado',
    'metro',
    'noticia',
    'noticias',
    'premium',
    'quadrado',
    'sobre',
  ])
  return String(value || '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => !ignored.has(normalize(word)))
    .slice(0, 7)
    .join(' ')
    .slice(0, 90)
    .trim()
}

function buildImageQueries(post, asset = {}) {
  const keywords = [
    asset.source_query,
    post.primary_keyword,
    ...(Array.isArray(post.secondary_keywords) ? post.secondary_keywords : []),
    ...(Array.isArray(post.local_entities) ? post.local_entities : []),
    ...(Array.isArray(post.tags) ? post.tags : []),
    post.category,
    post.title,
  ]
  const cleaned = unique(keywords.map(compactSearchTerm))
    .filter(term => !/^noticias$/i.test(term))
    .filter(term => !/^mercado imobiliario$/i.test(normalize(term)))
    .slice(0, 5)
  const local = cleaned.find(term => /balneario|camboriu|itajai|itapema|porto belo|praia brava|santa catarina|florianopolis/i.test(normalize(term)))
  const titleWords = compactSearchTerm(post.title)
  const suffixes = isNewsPost(post)
    ? [
      'editorial city skyline real estate',
      'urban development buildings Brazil',
      'residential buildings city beach',
      'real estate market architecture',
    ]
    : [
      'luxury real estate architecture',
      'modern apartment building facade',
      'premium residential building beach',
      'real estate investment city skyline',
    ]

  return unique([
    unique([local, cleaned.slice(0, 3).join(' '), suffixes[0]]).join(' '),
    unique([cleaned.slice(0, 3).join(' '), suffixes[1]]).join(' '),
    unique([local, suffixes[2]]).join(' '),
    unique([titleWords, suffixes[3]]).join(' '),
    unique([local, 'urban skyline apartments']).join(' '),
    unique([local, 'modern apartment building facade']).join(' '),
    unique([local, 'coastal apartment building skyline']).join(' '),
    unique([local, 'urban waterfront apartment buildings']).join(' '),
    'modern apartment building facade',
    'luxury condominium exterior',
    'modern residential tower facade',
    'urban waterfront apartment buildings',
    'modern residential architecture beach city',
    'real estate investment city buildings',
    'luxury apartment facade city',
  ])
    .map(query => query.replace(/\s+/g, ' ').trim())
    .filter(query => query.length > 8)
    .slice(0, 14)
}

function makeQueryScore(query, text) {
  const haystack = normalize(text)
  const terms = normalize(query)
    .split(/\s+/)
    .map(term => term.replace(/[^a-z0-9]+/g, ''))
    .filter(term => term.length > 2)
    .filter(term => term !== 'real')
  const aliases = {
    apartment: ['apartamento', 'apartamentos'],
    apartments: ['apartamento', 'apartamentos'],
    architecture: ['arquitetura', 'arquitetonico', 'arquitetonica'],
    beach: ['praia', 'orla', 'costeira', 'litoral'],
    building: ['predio', 'predios', 'edificio', 'edificios'],
    buildings: ['predio', 'predios', 'edificio', 'edificios'],
    city: ['cidade', 'urbano', 'urbana'],
    development: ['desenvolvimento', 'obra', 'obras'],
    estate: ['imobiliario', 'imobiliaria', 'imoveis', 'imovel'],
    facade: ['fachada'],
    investment: ['investimento'],
    luxury: ['luxo'],
    market: ['mercado'],
    modern: ['moderno', 'moderna', 'modernos', 'modernas'],
    premium: ['luxo'],
    real: ['imobiliario', 'imobiliaria', 'imoveis', 'imovel'],
    residential: ['residencial', 'residenciais'],
    skyline: ['horizonte', 'arranha', 'ceu', 'cidade'],
    urban: ['urbano', 'urbana', 'cidade'],
  }
  return terms.reduce((score, term) => {
    const variants = [term, ...(aliases[term] || [])]
    return score + (variants.some(variant => haystack.includes(variant)) ? 4 : 0)
  }, 0)
}

function isBadVisualCandidate(image) {
  const text = normalize(`${image.title} ${image.description} ${image.alt} ${image.tags.join(' ')}`)
  return [
    'animal',
    'ave',
    'aves',
    'bird',
    'cachorro',
    'chapim',
    'comida',
    'cama',
    'calcado',
    'estacao de metro',
    'estacao de trem',
    'garca',
    'gato',
    'hotel',
    'inseto',
    'interior',
    'metro station',
    'moveis',
    'passaro',
    'pescaria',
    'pescaria',
    'quarto',
    'salto',
    'sapato',
    'trem',
    'train',
  ].some(term => text.includes(term))
}

function hasDomainVisualSignal(image) {
  const text = normalize(`${image.title} ${image.description} ${image.alt} ${image.tags.join(' ')}`)
  return [
    'apartamento',
    'apartamentos',
    'arquitetura',
    'beira mar',
    'cidade',
    'condominio',
    'construcao',
    'costa',
    'edificio',
    'edificios',
    'fachada',
    'litoral',
    'mar',
    'orla',
    'praia',
    'predio',
    'predios',
    'residencial',
    'residenciais',
    'skyline',
    'urbano',
    'urbana',
  ].some(term => text.includes(term))
}

function rankImage(result, query, providerPriority) {
  const resolutionScore = result.width >= 1600 ? 12 : result.width >= 1000 ? 8 : 3
  const textScore = makeQueryScore(query, `${result.title} ${result.description} ${result.alt} ${result.tags.join(' ')}`)
  const providerScore = Math.max(0, 15 - providerPriority * 4)
  return providerScore + resolutionScore + textScore
}

async function searchPexels(config, query, options = {}) {
  if (!config.pexelsApiKey || !config.pexelsEnabled) return []
  const params = new URLSearchParams({
    query,
    per_page: String(Math.max(24, config.pexelsPerPage)),
    locale: 'pt-BR',
    orientation: 'landscape',
  })
  if (options.page && options.page > 1) params.set('page', String(options.page))
  const response = await fetch(`https://api.pexels.com/v1/search?${params.toString()}`, {
    headers: { Authorization: config.pexelsApiKey },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`Pexels ${response.status}: ${payload?.error || response.statusText}`)

  return (Array.isArray(payload?.photos) ? payload.photos : [])
    .map(photo => {
      const result = {
        provider: 'pexels',
        id: String(photo.id),
        title: String(photo.alt || query),
        description: String(photo.alt || query),
        imageUrl: String(photo.src?.large2x || photo.src?.large || photo.src?.original || ''),
        previewUrl: String(photo.src?.medium || photo.src?.small || photo.src?.large || ''),
        downloadUrl: String(photo.src?.large2x || photo.src?.large || photo.src?.original || ''),
        sourceUrl: String(photo.url || ''),
        author: String(photo.photographer || 'Pexels'),
        authorUrl: String(photo.photographer_url || 'https://www.pexels.com'),
        width: Number(photo.width || 0),
        height: Number(photo.height || 0),
        tags: tagsFrom(photo.alt || query),
        alt: String(photo.alt || query),
        license: 'Pexels License',
      }
      return { ...result, score: rankImage(result, query, config.pexelsPriority) }
    })
    .filter(item => item.imageUrl && item.sourceUrl)
}

async function searchPixabay(config, query, options = {}) {
  if (!config.pixabayApiKey || !config.pixabayEnabled) return []
  const params = new URLSearchParams({
    key: config.pixabayApiKey,
    q: query,
    lang: config.lang,
    image_type: 'photo',
    orientation: 'horizontal',
    safesearch: config.safeSearch ? 'true' : 'false',
    per_page: String(config.pixabayPerPage),
  })
  if (options.page && options.page > 1) params.set('page', String(options.page))
  if (options.order) params.set('order', options.order)
  const response = await fetch(`https://pixabay.com/api/?${params.toString()}`)
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`Pixabay ${response.status}: ${payload?.message || response.statusText}`)

  return (Array.isArray(payload?.hits) ? payload.hits : [])
    .map(hit => {
      const tags = tagsFrom(hit.tags || query)
      const result = {
        provider: 'pixabay',
        id: String(hit.id),
        title: tags[0] || query,
        description: tags.join(', ') || query,
        imageUrl: String(hit.largeImageURL || hit.webformatURL || ''),
        previewUrl: String(hit.webformatURL || hit.previewURL || ''),
        downloadUrl: String(hit.largeImageURL || hit.webformatURL || ''),
        sourceUrl: String(hit.pageURL || ''),
        author: String(hit.user || 'Pixabay'),
        authorUrl: hit.user && hit.user_id ? `https://pixabay.com/users/${hit.user}-${hit.user_id}/` : 'https://pixabay.com',
        width: Number(hit.imageWidth || hit.webformatWidth || 0),
        height: Number(hit.imageHeight || hit.webformatHeight || 0),
        tags,
        alt: tags.join(', ') || query,
        license: 'Pixabay Content License',
      }
      return { ...result, score: rankImage(result, query, config.pixabayPriority) }
    })
    .filter(item => item.imageUrl && item.sourceUrl)
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function seededDiversityValue(value) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash % 1000) / 1000
}

function diversityScore(image, query, memory) {
  const key = providerAssetKey(image.provider, image.id)
  const priorUsePenalty = key && memory.providerAssetKeys.has(key) ? 80 : 0
  const urlPenalty = imageUrls(image).some(url => memory.urls.has(url)) ? 100 : 0
  const recentPenalty = imageUrls(image).some(url => memory.recentUrls.has(url)) || (key && memory.recentProviderAssetKeys.has(key)) ? 100 : 0
  const diversityBoost = seededDiversityValue(`${image.provider}:${image.id}:${query}`) * 8
  return Math.max(0, Number(image.score || 0) + diversityBoost - priorUsePenalty - urlPenalty - recentPenalty)
}

function isAlreadyUsed(image, memory) {
  const key = providerAssetKey(image.provider, image.id)
  if (key && (memory.providerAssetKeys.has(key) || memory.recentProviderAssetKeys.has(key))) return true
  return imageUrls(image).some(url => memory.urls.has(url) || memory.recentUrls.has(url))
}

async function findReplacementImage(config, post, asset, memory) {
  const queries = buildImageQueries(post, asset)
  const seen = new Set()
  const candidates = []
  const fallbackCandidates = []

  for (const query of queries) {
    const pages = unique([randomInt(1, 10), randomInt(11, 24), randomInt(25, 40)])
    for (const page of pages) {
      const order = Math.random() > 0.45 ? 'popular' : 'latest'
      const searches = []
      if (providerFilter.has('pexels')) searches.push(searchPexels(config, query, { page }))
      if (providerFilter.has('pixabay')) searches.push(searchPixabay(config, query, { page, order }))
      const results = await Promise.allSettled(searches)

      for (const image of results.flatMap(result => result.status === 'fulfilled' ? result.value : [])) {
        const key = providerAssetKey(image.provider, image.id) || image.sourceUrl || image.imageUrl
        if (!key || seen.has(key)) continue
        seen.add(key)
        if (isAlreadyUsed(image, memory)) continue
        if (isBadVisualCandidate(image)) continue
        if (image.provider === 'pixabay' && !hasDomainVisualSignal(image)) continue
        const textScore = makeQueryScore(query, `${image.title} ${image.description} ${image.alt} ${image.tags.join(' ')}`)
        const score = diversityScore(image, query, memory)
        if (score <= 0) continue
        const candidate = { ...image, sourceQuery: query, diversityScore: score + textScore }
        if (textScore >= (image.provider === 'pixabay' ? 8 : 1)) {
          candidates.push(candidate)
        } else if (image.provider === 'pexels' && image.width >= 1400) {
          fallbackCandidates.push({ ...candidate, diversityScore: score * 0.72 })
        }
      }

      if (candidates.length >= 12) break
    }

    if (candidates.length >= 12) break
  }

  return candidates.sort((a, b) => b.diversityScore - a.diversityScore)[0]
    || fallbackCandidates.sort((a, b) => b.diversityScore - a.diversityScore)[0]
    || null
}

function extensionFromContentType(contentType) {
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('gif')) return 'gif'
  return 'jpg'
}

async function persistToR2(config, image, post, role) {
  const r2 = config.r2
  if (!r2.accountId || !r2.accessKeyId || !r2.secretAccessKey || !r2.bucketName || !r2.publicUrl) {
    return { url: image.imageUrl, key: null, mirrored: false }
  }

  const response = await fetch(image.downloadUrl || image.imageUrl)
  if (!response.ok) return { url: image.imageUrl, key: null, mirrored: false }

  const contentType = response.headers.get('content-type') || 'image/jpeg'
  const buffer = Buffer.from(await response.arrayBuffer())
  const ext = extensionFromContentType(contentType)
  const folder = isNewsPost(post) ? 'editorial-images/news' : 'editorial-images/blog'
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2.accessKeyId,
      secretAccessKey: r2.secretAccessKey,
    },
  })
  const key = `${folder}/${Date.now()}-${slugify(`${post.slug || post.title}-${role}-${image.provider}-${image.id}`)}.${ext}`

  await client.send(new PutObjectCommand({
    Bucket: r2.bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }))

  return { url: `${r2.publicUrl}/${key}`, key, mirrored: true }
}

function assetFromImage(post, oldAsset, image, persisted) {
  const providerLabel = image.provider === 'pexels' ? 'Pexels' : 'Pixabay'
  const role = oldAsset.role === 'inline' ? 'inline' : 'cover'
  return {
    ...oldAsset,
    role,
    source: image.provider,
    image_url: persisted.url,
    original_url: image.imageUrl,
    source_url: image.sourceUrl,
    provider_asset_id: image.id,
    preview_url: image.previewUrl,
    author: image.author,
    author_url: image.authorUrl,
    license: image.license,
    width: image.width,
    height: image.height,
    tags: image.tags,
    r2_key: persisted.key,
    source_query: image.sourceQuery,
    alt: image.alt || post.title,
    caption: role === 'cover'
      ? `Imagem editorial selecionada para ilustrar ${post.title}.`
      : image.description || `Imagem editorial relacionada a ${post.title}.`,
    credit: `${providerLabel}: ${image.author}`,
    relevance_reason: `Selecionada automaticamente por aderencia visual ao tema "${post.title}".`,
    score: image.score,
  }
}

function replaceMarkdownImage(markdown, oldUrl, newAsset) {
  if (!oldUrl || !markdown.includes(oldUrl)) return markdown
  const lines = markdown.split(/\r?\n/)
  const escaped = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const imagePattern = new RegExp(`^!\\[[^\\]]*\\]\\(${escaped}\\)\\s*$`)

  for (let index = 0; index < lines.length; index += 1) {
    if (!imagePattern.test(lines[index].trim())) continue
    lines[index] = `![${newAsset.alt || 'Imagem editorial'}](${newAsset.image_url})`
    for (let lookahead = index + 1; lookahead < Math.min(lines.length, index + 5); lookahead += 1) {
      if (/^Fonte da imagem:/i.test(lines[lookahead].trim())) {
        lines[lookahead] = `Fonte da imagem: ${newAsset.credit || newAsset.source}.`
        break
      }
    }
    break
  }

  return lines.join('\n')
}

function mergeRepairHistory(sourceSummary, replacements) {
  const current = metadataRecord(sourceSummary)
  const history = Array.isArray(current.editorial_media_repair_history)
    ? current.editorial_media_repair_history
    : []
  const event = {
    repaired_at: new Date().toISOString(),
    reason: 'duplicate_source_image',
    replacements: replacements.map(item => ({
      role: item.role,
      previous_image_url: item.oldAsset.image_url || null,
      previous_source_url: item.oldSourceKey || null,
      new_image_url: item.newAsset.image_url || null,
      new_source_url: item.newAsset.source_url || null,
      provider: item.newAsset.source || null,
      provider_asset_id: item.newAsset.provider_asset_id || null,
    })),
  }
  return {
    ...current,
    editorial_media_repair: event,
    editorial_media_repair_history: [event, ...history].slice(0, 12),
  }
}

async function loadConfig() {
  const { data, error } = await runSupabase('loadConfig', () => supabase
    .from('app_config')
    .select('key, value')
    .in('key', CONFIG_KEYS))
  if (error) throw error
  return Object.fromEntries((data || []).map(row => [row.key, String(row.value || '')]))
}

async function loadPosts() {
  const { data, error } = await runSupabase('loadPosts', () => {
    let query = supabase
      .from('blog_posts')
      .select('id,title,slug,status,category,tags,primary_keyword,secondary_keywords,local_entities,generated_by,cover_image_url,published_at,created_at,source_summary->editorial_visual_plan')
      .neq('status', 'archived')
      .order('created_at', { ascending: true })
      .limit(1000)

    if (idFilter.length > 0) query = query.in('id', idFilter)
    if (statusFilter) query = query.eq('status', statusFilter)

    return query
  })
  if (error) throw error
  return data || []
}

async function loadPostForUpdate(postId) {
  const { data, error } = await runSupabase('loadPostForUpdate', () => supabase
    .from('blog_posts')
    .select('id,title,content_markdown,source_summary,cover_image_url')
    .eq('id', postId)
    .maybeSingle())
  if (error) throw error
  return data
}

function collectAssetRefs(posts) {
  const refs = []
  const memory = {
    providerAssetKeys: new Set(),
    recentProviderAssetKeys: new Set(),
    urls: new Set(),
    recentUrls: new Set(),
  }

  for (const post of posts) {
    const plan = visualPlanFromPost(post)
    const assets = Array.isArray(plan.assets) ? plan.assets : []
    for (let index = 0; index < assets.length; index += 1) {
      const asset = assets[index]
      const sourceKey = sourceKeyFromAsset(asset)
      const role = asset.role === 'inline' ? 'inline' : 'cover'
      addAssetToMemory(memory, asset)
      if (!sourceKey || !roleFilter.has(role)) continue
      refs.push({
        post,
        asset,
        assetIndex: index,
        role,
        sourceKey,
      })
    }
  }

  return { refs, memory }
}

function groupDuplicateRefs(refs) {
  const groups = new Map()
  for (const ref of refs) {
    if (!groups.has(ref.sourceKey)) groups.set(ref.sourceKey, [])
    groups.get(ref.sourceKey).push(ref)
  }

  return Array.from(groups.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([sourceKey, rows]) => ({ sourceKey, rows }))
}

function chooseKeeper(rows) {
  return rows
    .slice()
    .sort((a, b) => {
      const aPublished = a.post.status === 'published' ? 0 : 1
      const bPublished = b.post.status === 'published' ? 0 : 1
      if (aPublished !== bPublished) return aPublished - bPublished
      const aCover = a.role === 'cover' ? 0 : 1
      const bCover = b.role === 'cover' ? 0 : 1
      if (aCover !== bCover) return aCover - bCover
      return new Date(a.post.created_at || 0).getTime() - new Date(b.post.created_at || 0).getTime()
    })[0]
}

function buildReplacementTargets(groups) {
  const targets = []
  for (const group of groups) {
    const keeper = chooseKeeper(group.rows)
    for (const ref of group.rows) {
      if (ref === keeper) continue
      targets.push({ ...ref, keptPostId: keeper.post.id })
    }
  }
  return maxReplacements ? targets.slice(0, maxReplacements) : targets
}

async function loadExistingUsageSet() {
  const { data, error } = await runSupabase('loadExistingUsage', () => supabase
    .from('editorial_post_media_usage')
    .select('post_id, role, image_url')
    .limit(10000))
  if (error) return new Set()
  return new Set((data || []).map(row => `${row.post_id}|${row.role}|${normalizeUrl(row.image_url)}`))
}

async function registerAssetUsage(post, asset, usageSet) {
  const provider = assetProvider(asset)
  const providerAssetId = inferProviderAssetId(asset)
  const imageUrl = normalizeUrl(asset.image_url)
  if (!provider || !providerAssetId || !imageUrl) return { skipped: true, reason: 'missing_asset_identity' }

  const role = asset.role === 'inline' ? 'inline' : 'cover'
  const usageKey = `${post.id}|${role}|${imageUrl}`
  if (usageSet.has(usageKey)) return { skipped: true, reason: 'usage_exists' }

  const now = new Date().toISOString()
  const { data: existing } = await runSupabase('loadMediaAsset', () => supabase
    .from('editorial_media_assets')
    .select('id, used_count')
    .eq('provider', provider)
    .eq('provider_asset_id', providerAssetId)
    .maybeSingle())

  const payload = {
    provider,
    provider_asset_id: providerAssetId,
    source_url: asset.source_url || null,
    image_url: asset.original_url || asset.image_url,
    preview_url: asset.preview_url || null,
    r2_url: asset.image_url || null,
    r2_key: asset.r2_key || null,
    author_name: asset.author || null,
    author_url: asset.author_url || null,
    license: asset.license || null,
    width: asset.width || null,
    height: asset.height || null,
    tags: Array.isArray(asset.tags) ? asset.tags : [],
    alt: asset.alt || null,
    metadata: {
      source_query: asset.source_query || null,
      score: asset.score ?? null,
      backfilled_from_post_id: post.id,
    },
    last_used_at: post.published_at || post.created_at || now,
    updated_at: now,
  }

  const { data: savedAsset, error } = await runSupabase('upsertMediaAsset', () => supabase
    .from('editorial_media_assets')
    .upsert(payload, { onConflict: 'provider,provider_asset_id' })
    .select('id, used_count')
    .maybeSingle())
  if (error || !savedAsset?.id) throw error || new Error('asset_not_saved')

  const usedCount = Number(existing?.used_count ?? savedAsset.used_count ?? 0)
  const { error: countError } = await runSupabase('updateMediaAssetCount', () => supabase
    .from('editorial_media_assets')
    .update({
      used_count: usedCount + 1,
      last_used_at: post.published_at || post.created_at || now,
      updated_at: now,
    })
    .eq('id', savedAsset.id))
  if (countError) throw countError

  const { error: usageError } = await runSupabase('insertMediaUsage', () => supabase
    .from('editorial_post_media_usage')
    .insert({
      post_id: post.id,
      asset_id: savedAsset.id,
      role,
      content_type: contentTypeForPost(post),
      source_query: asset.source_query || null,
      image_url: imageUrl,
      used_at: post.published_at || post.created_at || now,
      metadata: {
        source_url: asset.source_url || null,
        author: asset.author || null,
        license: asset.license || null,
        backfilled: true,
      },
    }))
  if (usageError) throw usageError
  usageSet.add(usageKey)
  return { skipped: false, assetId: savedAsset.id }
}

async function backfillMediaUsage(posts) {
  const usageSet = await loadExistingUsageSet()
  const results = []
  for (const post of posts) {
    const plan = visualPlanFromPost(post)
    const assets = Array.isArray(plan.assets) ? plan.assets : []
    for (const asset of assets) {
      try {
        if (!apply) {
          const provider = assetProvider(asset)
          const providerAssetId = inferProviderAssetId(asset)
          const imageUrl = normalizeUrl(asset.image_url)
          const usageKey = `${post.id}|${asset.role === 'inline' ? 'inline' : 'cover'}|${imageUrl}`
          results.push({
            id: post.id,
            title: post.title,
            role: asset.role === 'inline' ? 'inline' : 'cover',
            provider,
            providerAssetId,
            ready: Boolean(provider && providerAssetId && imageUrl && !usageSet.has(usageKey)),
          })
          continue
        }
        const result = await registerAssetUsage(post, asset, usageSet)
        results.push({
          id: post.id,
          title: post.title,
          role: asset.role === 'inline' ? 'inline' : 'cover',
          ...result,
        })
      } catch (error) {
        results.push({
          id: post.id,
          title: post.title,
          role: asset.role === 'inline' ? 'inline' : 'cover',
          error: error?.message || String(error),
        })
      }
    }
  }
  return results
}

async function applyPostReplacements(post, replacements) {
  const current = await loadPostForUpdate(post.id)
  if (!current) throw new Error(`Post ${post.id} nao encontrado.`)
  const sourceSummary = metadataRecord(current.source_summary)
  const plan = metadataRecord(sourceSummary.editorial_visual_plan)
  const assets = Array.isArray(plan.assets) ? plan.assets.slice() : []
  let contentMarkdown = String(current.content_markdown || '')
  let coverImageUrl = current.cover_image_url || post.cover_image_url || null

  for (const replacement of replacements) {
    assets[replacement.assetIndex] = replacement.newAsset
    if (replacement.role === 'cover') {
      coverImageUrl = replacement.newAsset.image_url
    } else {
      contentMarkdown = replaceMarkdownImage(contentMarkdown, replacement.oldAsset.image_url, replacement.newAsset)
    }
  }

  const nextSourceSummary = mergeRepairHistory({
    ...sourceSummary,
    editorial_visual_plan: {
      ...plan,
      assets,
    },
  }, replacements)

  const { error } = await runSupabase('updatePostMedia', () => supabase
    .from('blog_posts')
    .update({
      cover_image_url: coverImageUrl,
      content_markdown: contentMarkdown,
      source_summary: nextSourceSummary,
      updated_at: new Date().toISOString(),
    })
    .eq('id', post.id))

  if (error) throw error
}

async function repairDuplicates(config, targets, memory, usageSet) {
  const replacementsByPost = new Map()
  const results = []

  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index]
    const post = target.post
    try {
      const image = await findReplacementImage(config, post, target.asset, memory)
      if (!image) {
        results.push({
          id: post.id,
          title: post.title,
          role: target.role,
          ok: false,
          reason: 'no_replacement_found',
          oldSourceKey: target.sourceKey,
        })
        continue
      }

      if (!apply) {
        addAssetToMemory(memory, {
          source: image.provider,
          provider_asset_id: image.id,
          image_url: image.imageUrl,
          original_url: image.imageUrl,
          source_url: image.sourceUrl,
          preview_url: image.previewUrl,
        })
        results.push({
          id: post.id,
          title: post.title,
          status: post.status,
          type: contentTypeForPost(post),
          role: target.role,
          ok: true,
          dryRun: true,
          oldSourceKey: target.sourceKey,
          provider: image.provider,
          providerAssetId: image.id,
          newSourceUrl: image.sourceUrl,
          sourceQuery: image.sourceQuery,
        })
        continue
      }

      const persisted = await persistToR2(config, image, post, target.role)
      const newAsset = assetFromImage(post, target.asset, image, persisted)
      addAssetToMemory(memory, newAsset)
      const replacement = {
        role: target.role,
        assetIndex: target.assetIndex,
        oldAsset: target.asset,
        newAsset,
        oldSourceKey: target.sourceKey,
      }
      if (!replacementsByPost.has(post.id)) {
        replacementsByPost.set(post.id, { post, replacements: [] })
      }
      replacementsByPost.get(post.id).replacements.push(replacement)
      await registerAssetUsage(post, newAsset, usageSet)

      results.push({
        id: post.id,
        title: post.title,
        status: post.status,
        type: contentTypeForPost(post),
        role: target.role,
        ok: true,
        oldSourceKey: target.sourceKey,
        provider: image.provider,
        providerAssetId: image.id,
        newImageUrl: persisted.url,
        newSourceUrl: image.sourceUrl,
        mirrored: persisted.mirrored,
      })
    } catch (error) {
      results.push({
        id: post.id,
        title: post.title,
        role: target.role,
        ok: false,
        oldSourceKey: target.sourceKey,
        error: error?.message || String(error),
      })
    }

    if (apply && (index + 1) % 10 === 0) {
      console.warn(`[repair-editorial-media] ${index + 1}/${targets.length} imagens processadas...`)
    }
  }

  if (apply) {
    for (const { post, replacements } of replacementsByPost.values()) {
      try {
        await applyPostReplacements(post, replacements)
      } catch (error) {
        results.push({
          id: post.id,
          title: post.title,
          ok: false,
          stage: 'post_update',
          roles: replacements.map(replacement => replacement.role),
          error: error?.message || String(error),
        })
      }
    }
  }

  return results
}

function summarizeDuplicateGroups(groups) {
  return groups
    .slice()
    .sort((a, b) => b.rows.length - a.rows.length)
    .slice(0, 20)
    .map(group => ({
      sourceKey: group.sourceKey,
      count: group.rows.length,
      roles: Array.from(new Set(group.rows.map(row => row.role))),
      posts: group.rows.slice(0, 8).map(row => ({
        id: row.post.id,
        title: row.post.title,
        slug: row.post.slug,
        status: row.post.status,
        type: contentTypeForPost(row.post),
        role: row.role,
      })),
    }))
}

async function main() {
  const [configMap, posts] = await Promise.all([
    loadConfig(),
    loadPosts(),
  ])
  const config = getProviderConfig(configMap)
  const { refs, memory } = collectAssetRefs(posts)
  const duplicateGroups = groupDuplicateRefs(refs)
  const targets = buildReplacementTargets(duplicateGroups)

  const backfillResults = skipBackfill
    ? []
    : await backfillMediaUsage(posts)

  const usageSet = apply ? await loadExistingUsageSet() : new Set()
  const repairResults = auditOnly
    ? []
    : await repairDuplicates(config, targets, memory, usageSet)

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    auditOnly,
    checkedPosts: posts.length,
    visualAssetRefs: refs.length,
    duplicateGroups: duplicateGroups.length,
    replacementTargets: targets.length,
    backfill: {
      skipped: skipBackfill,
      checked: backfillResults.length,
      ready: backfillResults.filter(result => result.ready).length,
      applied: backfillResults.filter(result => result.skipped === false).length,
      existing: backfillResults.filter(result => result.reason === 'usage_exists').length,
      failed: backfillResults.filter(result => result.error).length,
    },
    repair: {
      providers: Array.from(providerFilter),
      checked: repairResults.length,
      ready: repairResults.filter(result => result.ok && result.dryRun).length,
      applied: repairResults.filter(result => result.ok && !result.dryRun).length,
      failed: repairResults.filter(result => !result.ok).length,
    },
    topDuplicateGroups: summarizeDuplicateGroups(duplicateGroups),
    repairResults,
    backfillSample: backfillResults.slice(0, 40),
  }

  console.log(JSON.stringify(summary, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
