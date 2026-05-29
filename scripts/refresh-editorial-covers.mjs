import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

dotenv.config({ path: '.env.local' })
dotenv.config()

const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const limitArg = process.argv.find(arg => arg.startsWith('--limit='))
const statusArg = process.argv.find(arg => arg.startsWith('--status='))
const limit = Math.max(1, Math.min(200, Number.parseInt(limitArg?.split('=')[1] || '80', 10) || 80))
const statusFilter = statusArg?.split('=')[1]?.trim()

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

function tagsFrom(value) {
  if (Array.isArray(value)) return value.map(String)
  if (!value) return []
  return String(value).split(',').map(item => item.trim()).filter(Boolean)
}

function buildCoverQuery(post) {
  const tags = [
    post.primary_keyword,
    ...(Array.isArray(post.secondary_keywords) ? post.secondary_keywords : []),
    ...(Array.isArray(post.local_entities) ? post.local_entities : []),
    ...(Array.isArray(post.tags) ? post.tags : []),
    post.category,
  ]
  const cleaned = unique(tags)
    .filter(term => !/^noticias$/i.test(term))
    .filter(term => !/^mercado imobiliario$/i.test(normalize(term)))
    .slice(0, 5)
  const titleWords = String(post.title || '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3)
    .slice(0, 7)
    .join(' ')

  const local = cleaned.find(term => /balneario|camboriu|itajai|itapema|porto belo|praia brava|santa catarina/i.test(normalize(term)))
  const suffix = isNewsPost(post)
    ? 'editorial real estate city beach architecture'
    : 'luxury real estate editorial beach architecture'

  return unique([local, cleaned.slice(0, 3).join(' '), titleWords, suffix]).join(' ').trim()
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

async function searchPexels(config, query) {
  if (!config.pexelsApiKey || !config.pexelsEnabled) return []
  const params = new URLSearchParams({
    query,
    per_page: String(config.pexelsPerPage),
    locale: 'pt-BR',
    orientation: 'landscape',
  })
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
        downloadUrl: String(photo.src?.large2x || photo.src?.large || photo.src?.original || ''),
        sourceUrl: String(photo.url || ''),
        author: String(photo.photographer || 'Pexels'),
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

async function searchPixabay(config, query) {
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
        downloadUrl: String(hit.largeImageURL || hit.webformatURL || ''),
        sourceUrl: String(hit.pageURL || ''),
        author: String(hit.user || 'Pixabay'),
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

async function searchEditorialCover(config, query) {
  const results = await Promise.allSettled([
    searchPexels(config, query),
    searchPixabay(config, query),
  ])
  return results
    .flatMap(result => result.status === 'fulfilled' ? result.value : [])
    .sort((a, b) => b.score - a.score)[0] || null
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
  const { data, error } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', CONFIG_KEYS)
  if (error) throw error
  return Object.fromEntries((data || []).map(row => [row.key, String(row.value || '')]))
}

async function loadPosts() {
  let query = supabase
    .from('blog_posts')
    .select('id,title,slug,status,category,tags,primary_keyword,secondary_keywords,local_entities,cover_image_url,source_summary,generated_by,created_at,published_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  } else {
    query = query.neq('status', 'archived')
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

async function main() {
  const config = getProviderConfig(await loadConfig())
  const posts = await loadPosts()
  const results = []

  for (const post of posts) {
    const query = buildCoverQuery(post)
    try {
      const image = await searchEditorialCover(config, query)
      if (!image) {
        results.push({ id: post.id, title: post.title, ok: false, skipped: true, reason: 'no_image', query })
        continue
      }

      if (!apply) {
        results.push({
          id: post.id,
          title: post.title,
          status: post.status,
          ok: true,
          dryRun: true,
          query,
          provider: image.provider,
          sourceUrl: image.sourceUrl,
          imageUrl: image.imageUrl,
        })
        continue
      }

      const persisted = await persistToR2(config, image, post)
      const sourceSummary = mergeSourceSummary(post, image, persisted, query)
      const { error } = await supabase
        .from('blog_posts')
        .update({
          cover_image_url: persisted.url,
          source_summary: sourceSummary,
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id)

      if (error) throw error

      results.push({
        id: post.id,
        title: post.title,
        status: post.status,
        ok: true,
        query,
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
