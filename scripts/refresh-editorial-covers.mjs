import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

dotenv.config({ path: '.env.local' })
dotenv.config()

const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const limitArg = process.argv.find(arg => arg.startsWith('--limit='))
const statusArg = process.argv.find(arg => arg.startsWith('--status='))
const idsArg = process.argv.find(arg => arg.startsWith('--ids='))
const limit = Math.max(1, Math.min(200, Number.parseInt(limitArg?.split('=')[1] || '80', 10) || 80))
const statusFilter = statusArg?.split('=')[1]?.trim()
const idFilter = idsArg?.split('=')[1]?.split(',').map(id => id.trim()).filter(Boolean) || []

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Supabase nao configurado. Verifique NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

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
    'timeout',
  ].some(pattern => message.includes(pattern))
}

async function runSupabase(label, queryFactory, attempts = 3) {
  let lastResult = null
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    lastResult = await queryFactory()
    if (!lastResult?.error) return lastResult
    if (!isRetryableSupabaseError(lastResult.error) || attempt === attempts) return lastResult
    console.warn(`[refresh-editorial-covers] ${label} falhou, tentativa ${attempt}/${attempts}: ${lastResult.error?.message || lastResult.error}`)
    await sleep(1200 * attempt)
  }
  return lastResult
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function slugify(value) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || `editorial-cover-${Date.now()}`
}

function unique(values) {
  return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)))
}

function compactSearchTerm(value) {
  const ignored = new Set(['blog', 'noticia', 'noticias', 'mercado', 'imobiliario', 'imoveis', 'imovel', 'guia', 'premium', 'sobre'])
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

function normalizeUrl(value) {
  return String(value || '').trim()
}

function addUrl(target, value) {
  const url = normalizeUrl(value)
  if (url) target.add(url)
}

function providerAssetKey(provider, providerAssetId) {
  const providerName = String(provider || '').trim()
  const id = String(providerAssetId || '').trim()
  return providerName && id ? `${providerName}:${id}` : ''
}

function imageUrls(image) {
  return [
    image?.imageUrl,
    image?.downloadUrl,
    image?.sourceUrl,
    image?.previewUrl,
  ].map(normalizeUrl).filter(Boolean)
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

function tagsFrom(value) {
  if (Array.isArray(value)) return value.map(String)
  if (!value) return []
  return String(value).split(',').map(item => item.trim()).filter(Boolean)
}

function buildCoverQueries(post) {
  const tags = [
    post.primary_keyword,
    ...(Array.isArray(post.secondary_keywords) ? post.secondary_keywords : []),
    ...(Array.isArray(post.local_entities) ? post.local_entities : []),
    ...(Array.isArray(post.tags) ? post.tags : []),
    post.category,
  ]
  const cleaned = unique(tags.map(compactSearchTerm))
    .filter(term => !/^noticias$/i.test(term))
    .filter(term => !/^mercado imobiliario$/i.test(normalize(term)))
    .slice(0, 5)
  const titleWords = compactSearchTerm(post.title)

  const local = cleaned.find(term => /balneario|camboriu|itajai|itapema|porto belo|praia brava|santa catarina/i.test(normalize(term)))
  const suffixes = isNewsPost(post)
    ? [
      'editorial real estate city beach architecture',
      'urban development buildings Brazil',
      'residential buildings city beach',
      'real estate market architecture',
    ]
    : [
      'luxury real estate editorial beach architecture',
      'modern apartment building facade',
      'premium residential building beach',
      'real estate investment city skyline',
    ]

  return unique([
    unique([local, cleaned.slice(0, 3).join(' '), titleWords, suffixes[0]]).join(' '),
    unique([cleaned.slice(0, 3).join(' '), suffixes[1]]).join(' '),
    unique([local, suffixes[2]]).join(' '),
    unique([titleWords, suffixes[3]]).join(' '),
    unique([local, 'urban skyline apartments']).join(' '),
    'modern residential architecture beach city',
    'real estate investment city buildings',
    'luxury apartment facade city',
  ])
    .map(query => query.replace(/\s+/g, ' ').trim())
    .filter(query => query.length > 8)
    .slice(0, 8)
}

function buildCoverQuery(post) {
  return buildCoverQueries(post)[0] || 'luxury real estate editorial beach architecture'
}

function isNewsPost(post) {
  const category = normalize(post.category)
  const generatedBy = normalize(post.generated_by)
  const tags = tagsFrom(post.tags).map(normalize)
  return generatedBy.includes('news') || category.includes('noticia') || tags.some(tag => tag.includes('noticia'))
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

function makeQueryScore(query, text) {
  const haystack = normalize(text)
  const terms = normalize(query)
    .split(/\s+/)
    .map(term => term.replace(/[^a-z0-9]+/g, ''))
    .filter(term => term.length > 2)
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 4 : 0), 0)
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
    per_page: String(config.pexelsPerPage),
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

function createMediaMemory() {
  return {
    providerAssetKeys: new Set(),
    recentProviderAssetKeys: new Set(),
    urls: new Set(),
    recentUrls: new Set(),
    authorUseCounts: new Map(),
  }
}

function rememberImage(memory, image, persistedUrl = null) {
  if (!memory || !image) return
  const key = providerAssetKey(image.provider, image.id)
  if (key) {
    memory.providerAssetKeys.add(key)
    memory.recentProviderAssetKeys.add(key)
  }
  for (const url of imageUrls(image)) {
    addUrl(memory.urls, url)
    addUrl(memory.recentUrls, url)
  }
  addUrl(memory.urls, persistedUrl)
  addUrl(memory.recentUrls, persistedUrl)
  const author = normalize(image.author)
  if (author) memory.authorUseCounts.set(author, (memory.authorUseCounts.get(author) || 0) + 1)
}

function isRecentlyUsed(image, memory) {
  if (!memory) return false
  const key = providerAssetKey(image.provider, image.id)
  if (key && memory.recentProviderAssetKeys.has(key)) return true
  return imageUrls(image).some(url => memory.recentUrls.has(url))
}

function diversityScore(image, query, memory) {
  const key = providerAssetKey(image.provider, image.id)
  const authorPenalty = Math.min(18, (memory?.authorUseCounts.get(normalize(image.author)) || 0) * 3)
  const priorUsePenalty = key && memory?.providerAssetKeys.has(key) ? 18 : 0
  const urlPenalty = imageUrls(image).some(url => memory?.urls.has(url)) ? 24 : 0
  const diversityBoost = seededDiversityValue(`${image.provider}:${image.id}:${query}`) * 8
  return Math.max(0, Number(image.score || 0) + diversityBoost - authorPenalty - priorUsePenalty - urlPenalty)
}

function weightedPick(candidates) {
  const pool = candidates.slice(0, 24)
  if (!pool.length) return null

  const total = pool.reduce((sum, item) => sum + Math.max(1, item.diversityScore || 0), 0)
  let cursor = Math.random() * total
  for (const candidate of pool) {
    cursor -= Math.max(1, candidate.diversityScore || 0)
    if (cursor <= 0) return candidate
  }
  return pool[0] || null
}

async function searchEditorialCover(config, queries, memory) {
  const seen = new Set()
  const candidates = []

  for (const query of queries) {
    const page = randomInt(1, 8)
    const order = Math.random() > 0.45 ? 'popular' : 'latest'
    const results = await Promise.allSettled([
      searchPexels(config, query, { page }),
      searchPixabay(config, query, { page, order }),
    ])

    for (const image of results.flatMap(result => result.status === 'fulfilled' ? result.value : [])) {
      const key = providerAssetKey(image.provider, image.id) || image.sourceUrl || image.imageUrl
      if (!key || seen.has(key)) continue
      seen.add(key)
      if (isRecentlyUsed(image, memory)) continue

      const score = diversityScore(image, query, memory)
      if (score <= 0) continue
      candidates.push({
        ...image,
        sourceQuery: query,
        diversityScore: score,
      })
    }

    if (candidates.length >= 24) break
  }

  return weightedPick(candidates.sort((a, b) => b.diversityScore - a.diversityScore))
}

function extensionFromContentType(contentType) {
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('gif')) return 'gif'
  return 'jpg'
}

async function persistToR2(config, image, post) {
  const r2 = config.r2
  if (!r2.accountId || !r2.accessKeyId || !r2.secretAccessKey || !r2.bucketName || !r2.publicUrl) {
    return { url: image.imageUrl, key: null, mirrored: false }
  }

  const response = await fetch(image.downloadUrl || image.imageUrl)
  if (!response.ok) return { url: image.imageUrl, key: null, mirrored: false }

  const contentType = response.headers.get('content-type') || 'image/jpeg'
  const buffer = Buffer.from(await response.arrayBuffer())
  const ext = extensionFromContentType(contentType)
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2.accessKeyId,
      secretAccessKey: r2.secretAccessKey,
    },
  })
  const key = `editorial-images/refresh/${Date.now()}-${slugify(`${post.slug || post.title}-${image.provider}-${image.id}`)}.${ext}`

  await client.send(new PutObjectCommand({
    Bucket: r2.bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }))

  return { url: `${r2.publicUrl}/${key}`, key, mirrored: true }
}

function mergeSourceSummary(post, image, persisted, query) {
  const current = post.source_summary && typeof post.source_summary === 'object' && !Array.isArray(post.source_summary)
    ? post.source_summary
    : {}
  const history = Array.isArray(current.cover_refresh_history) ? current.cover_refresh_history : []
  const event = {
    refreshed_at: new Date().toISOString(),
    previous_cover_image_url: post.cover_image_url || null,
    new_cover_image_url: persisted.url,
    image_search_query: query,
    provider: image.provider,
    source_url: image.sourceUrl,
    author: image.author,
    license: image.license,
    r2_key: persisted.key,
  }

  return {
    ...current,
    editorial_cover_refresh: event,
    cover_refresh_history: [event, ...history].slice(0, 12),
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
  let query = supabase
    .from('blog_posts')
    .select('id,title,slug,status,category,tags,primary_keyword,secondary_keywords,local_entities,cover_image_url,generated_by,created_at,published_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (idFilter.length > 0) {
    query = query.in('id', idFilter)
  } else if (statusFilter) {
    query = query.eq('status', statusFilter)
  } else {
    query = query.neq('status', 'archived')
  }

  const { data, error } = await runSupabase('loadPosts', () => query)
  if (error) throw error
  return data || []
}

async function loadPostSourceSummary(postId) {
  const { data, error } = await runSupabase('loadPostSourceSummary', () => supabase
    .from('blog_posts')
    .select('source_summary')
    .eq('id', postId)
    .maybeSingle())

  if (error) {
    console.warn('[refresh-editorial-covers] source summary unavailable:', error?.message || error)
    return null
  }
  return data?.source_summary || null
}

async function loadMediaMemory() {
  const memory = createMediaMemory()

  try {
    const { data, error } = await runSupabase('loadMediaAssets', () => supabase
      .from('editorial_media_assets')
      .select('provider, provider_asset_id, source_url, image_url, preview_url, r2_url, author_name, last_used_at, used_count')
      .order('last_used_at', { ascending: false, nullsFirst: false })
      .limit(2000))

    if (error) throw error

    const recentSince = Date.now() - 180 * 24 * 60 * 60 * 1000
    for (const asset of data || []) {
      const key = providerAssetKey(asset.provider, asset.provider_asset_id)
      if (key) memory.providerAssetKeys.add(key)
      addUrl(memory.urls, asset.source_url)
      addUrl(memory.urls, asset.image_url)
      addUrl(memory.urls, asset.preview_url)
      addUrl(memory.urls, asset.r2_url)

      const usedAt = asset.last_used_at ? new Date(asset.last_used_at).getTime() : 0
      if (usedAt && usedAt >= recentSince) {
        if (key) memory.recentProviderAssetKeys.add(key)
        addUrl(memory.recentUrls, asset.source_url)
        addUrl(memory.recentUrls, asset.image_url)
        addUrl(memory.recentUrls, asset.preview_url)
        addUrl(memory.recentUrls, asset.r2_url)
      }

      const author = normalize(asset.author_name)
      if (author) {
        memory.authorUseCounts.set(author, (memory.authorUseCounts.get(author) || 0) + Number(asset.used_count || 1))
      }
    }
  } catch (error) {
    if (!String(error?.message || '').includes('editorial_media_assets')) {
      console.warn('[refresh-editorial-covers] media memory unavailable:', error?.message || error)
    }
  }

  try {
    const { data, error } = await runSupabase('loadCoverMemory', () => supabase
      .from('blog_posts')
      .select('cover_image_url')
      .not('cover_image_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(800))

    if (error) throw error

    for (const post of data || []) {
      addUrl(memory.urls, post.cover_image_url)
      addUrl(memory.recentUrls, post.cover_image_url)
    }
  } catch (error) {
    console.warn('[refresh-editorial-covers] cover memory unavailable:', error?.message || error)
  }

  if (process.env.EDITORIAL_IMAGE_READ_SOURCE_SUMMARY === 'true') {
    try {
      const { data, error } = await runSupabase('loadVisualMetadataMemory', () => supabase
        .from('blog_posts')
        .select('source_summary')
        .not('source_summary', 'is', null)
        .order('created_at', { ascending: false })
        .limit(120))

      if (error) throw error

      for (const post of data || []) {
        const summary = post.source_summary && typeof post.source_summary === 'object' && !Array.isArray(post.source_summary)
          ? post.source_summary
          : {}
        const assets = Array.isArray(summary.editorial_visual_plan?.assets)
          ? summary.editorial_visual_plan.assets
          : []
        for (const asset of assets) {
          addUrl(memory.urls, asset.image_url)
          addUrl(memory.urls, asset.original_url)
          addUrl(memory.urls, asset.source_url)
          addUrl(memory.recentUrls, asset.image_url)
          addUrl(memory.recentUrls, asset.original_url)
          addUrl(memory.recentUrls, asset.source_url)
          const key = providerAssetKey(asset.source || asset.provider, asset.provider_asset_id || asset.id)
          if (key) {
            memory.providerAssetKeys.add(key)
            memory.recentProviderAssetKeys.add(key)
          }
        }
      }
    } catch (error) {
      console.warn('[refresh-editorial-covers] visual metadata memory unavailable:', error?.message || error)
    }
  }

  return memory
}

async function registerMediaUsage(post, image, persisted, query) {
  try {
    const now = new Date().toISOString()
    const { data: asset, error } = await runSupabase('registerMediaAsset', () => supabase
      .from('editorial_media_assets')
      .upsert({
        provider: image.provider,
        provider_asset_id: String(image.id),
        source_url: image.sourceUrl || null,
        image_url: image.imageUrl || persisted.url,
        preview_url: image.previewUrl || null,
        r2_url: persisted.url || null,
        r2_key: persisted.key || null,
        author_name: image.author || null,
        author_url: image.authorUrl || null,
        license: image.license || null,
        width: image.width || null,
        height: image.height || null,
        tags: Array.isArray(image.tags) ? image.tags : [],
        alt: image.alt || image.title || null,
        metadata: {
          source_query: query,
          score: image.score ?? null,
          diversity_score: image.diversityScore ?? null,
        },
        updated_at: now,
      }, { onConflict: 'provider,provider_asset_id' })
      .select('id, used_count')
      .maybeSingle())

    if (error || !asset?.id) throw error || new Error('asset_not_saved')

    const { error: updateError } = await runSupabase('updateMediaAssetUsage', () => supabase
      .from('editorial_media_assets')
      .update({
        last_used_at: now,
        used_count: Number(asset.used_count || 0) + 1,
        r2_url: persisted.url || null,
        r2_key: persisted.key || null,
        updated_at: now,
      })
      .eq('id', asset.id))
    if (updateError) throw updateError

    const { error: insertError } = await runSupabase('insertPostMediaUsage', () => supabase
      .from('editorial_post_media_usage')
      .insert({
        post_id: post.id,
        asset_id: asset.id,
        role: 'cover',
        content_type: isNewsPost(post) ? 'news' : 'blog',
        source_query: query,
        image_url: persisted.url,
        metadata: {
          source_url: image.sourceUrl || null,
          author: image.author || null,
          license: image.license || null,
        },
      }))
    if (insertError) throw insertError
  } catch (error) {
    if (!String(error?.message || '').includes('editorial_media_assets')) {
      console.warn('[refresh-editorial-covers] media usage register failed:', error?.message || error)
    }
  }
}

async function main() {
  const config = getProviderConfig(await loadConfig())
  const posts = await loadPosts()
  const mediaMemory = await loadMediaMemory()
  const results = []

  for (const post of posts) {
    const queries = buildCoverQueries(post)
    const query = buildCoverQuery(post)
    try {
      const image = await searchEditorialCover(config, queries, mediaMemory)
      if (!image) {
        results.push({ id: post.id, title: post.title, ok: false, skipped: true, reason: 'no_image', query, queries })
        continue
      }
      const selectedQuery = image.sourceQuery || query

      if (!apply) {
        rememberImage(mediaMemory, image)
        results.push({
          id: post.id,
          title: post.title,
          status: post.status,
          ok: true,
          dryRun: true,
          query: selectedQuery,
          queries,
          provider: image.provider,
          sourceUrl: image.sourceUrl,
          imageUrl: image.imageUrl,
        })
        continue
      }

      const persisted = await persistToR2(config, image, post)
      const currentSourceSummary = await loadPostSourceSummary(post.id)
      const sourceSummary = mergeSourceSummary({ ...post, source_summary: currentSourceSummary }, image, persisted, selectedQuery)
      const { error } = await runSupabase('updateBlogPostCover', () => supabase
        .from('blog_posts')
        .update({
          cover_image_url: persisted.url,
          source_summary: sourceSummary,
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id))

      if (error) throw error

      await registerMediaUsage(post, image, persisted, selectedQuery)
      rememberImage(mediaMemory, image, persisted.url)

      results.push({
        id: post.id,
        title: post.title,
        status: post.status,
        ok: true,
        query: selectedQuery,
        queries,
        provider: image.provider,
        previousCover: post.cover_image_url,
        newCover: persisted.url,
        mirrored: persisted.mirrored,
      })
    } catch (error) {
      results.push({ id: post.id, title: post.title, ok: false, query, error: error?.message || String(error) })
    }
  }

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    total: results.length,
    updated: results.filter(result => result.ok && !result.dryRun).length,
    ready: results.filter(result => result.ok && result.dryRun).length,
    failed: results.filter(result => !result.ok).length,
    results,
  }
  console.log(JSON.stringify(summary, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
