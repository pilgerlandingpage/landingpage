import { createAdminClient } from '@/lib/supabase/server'
import { uploadFile } from '@/lib/r2'

export type EditorialImageProvider = 'pexels' | 'pixabay'
export type EditorialImageOrientation = 'horizontal' | 'vertical' | 'all'

export type EditorialImageSearchOptions = {
  query: string
  orientation?: EditorialImageOrientation
  perPage?: number
  provider?: EditorialImageProvider
}

export type EditorialImageResult = {
  provider: EditorialImageProvider
  id: string
  title: string
  description: string
  imageUrl: string
  previewUrl: string
  downloadUrl: string
  sourceUrl: string
  author: string
  authorUrl: string
  width: number
  height: number
  tags: string[]
  alt: string
  license: string
  score: number
}

export type PersistedEditorialImage = EditorialImageResult & {
  r2Url: string
  r2Key?: string
}

export type EditorialImageProviderConfig = {
  pexelsApiKey: string
  pexelsEnabled: boolean
  pexelsPriority: number
  pexelsPerPage: number
  pixabayApiKey: string
  pixabayEnabled: boolean
  pixabayPriority: number
  pixabayPerPage: number
  defaultOrientation: EditorialImageOrientation
  safeSearch: boolean
  lang: string
}

const IMAGE_CONFIG_KEYS = [
  'pexels_api_key',
  'pexels_enabled',
  'pexels_priority',
  'pexels_per_page',
  'pixabay_api_key',
  'pixabay_enabled',
  'pixabay_priority',
  'pixabay_per_page',
  'editorial_image_default_orientation',
  'editorial_image_safe_search',
  'editorial_image_lang',
]

function toInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function toBool(value: unknown, fallback = true) {
  const selected = String(value ?? '').trim().toLowerCase()
  if (selected === 'true') return true
  if (selected === 'false') return false
  return fallback
}

function normalizeOrientation(value: unknown): EditorialImageOrientation {
  const selected = String(value || 'horizontal').trim().toLowerCase()
  if (selected === 'vertical' || selected === 'all') return selected
  return 'horizontal'
}

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map(tag => tag.trim()).filter(Boolean)
  return String(value || '')
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)
}

function getPexelsOrientation(orientation: EditorialImageOrientation) {
  if (orientation === 'horizontal') return 'landscape'
  if (orientation === 'vertical') return 'portrait'
  return undefined
}

function getPixabayOrientation(orientation: EditorialImageOrientation) {
  if (orientation === 'horizontal' || orientation === 'vertical') return orientation
  return 'all'
}

function makeQueryScore(query: string, text: string) {
  const haystack = text.toLowerCase()
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map(term => term.replace(/[^a-z0-9]+/g, ''))
    .filter(term => term.length > 2)

  return terms.reduce((score, term) => score + (haystack.includes(term) ? 4 : 0), 0)
}

function rankImage(result: Omit<EditorialImageResult, 'score'>, query: string, providerPriority: number) {
  const resolutionScore = result.width >= 1600 ? 12 : result.width >= 1000 ? 8 : 3
  const textScore = makeQueryScore(query, `${result.title} ${result.description} ${result.alt} ${result.tags.join(' ')}`)
  const providerScore = Math.max(0, 15 - providerPriority * 4)
  return providerScore + resolutionScore + textScore
}

async function readImageConfigRows() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', IMAGE_CONFIG_KEYS)

  if (error) throw new Error(`Erro ao carregar banco de imagens: ${error.message}`)
  return Object.fromEntries((data || []).map((row: { key: string; value: string }) => [row.key, String(row.value || '')]))
}

export async function getEditorialImageProviderConfig(source?: Record<string, string>): Promise<EditorialImageProviderConfig> {
  const appConfig = source || await readImageConfigRows()

  return {
    pexelsApiKey: (appConfig.pexels_api_key || process.env.PEXELS_API_KEY || '').trim(),
    pexelsEnabled: toBool(appConfig.pexels_enabled, true),
    pexelsPriority: toInt(appConfig.pexels_priority, 1, 1, 3),
    pexelsPerPage: toInt(appConfig.pexels_per_page, 12, 3, 40),
    pixabayApiKey: (appConfig.pixabay_api_key || process.env.PIXABAY_API_KEY || '').trim(),
    pixabayEnabled: toBool(appConfig.pixabay_enabled, true),
    pixabayPriority: toInt(appConfig.pixabay_priority, 2, 1, 3),
    pixabayPerPage: toInt(appConfig.pixabay_per_page, 12, 3, 40),
    defaultOrientation: normalizeOrientation(appConfig.editorial_image_default_orientation),
    safeSearch: toBool(appConfig.editorial_image_safe_search, true),
    lang: String(appConfig.editorial_image_lang || 'pt').trim().toLowerCase() || 'pt',
  }
}

export async function searchPexelsImages(
  config: EditorialImageProviderConfig,
  options: EditorialImageSearchOptions,
): Promise<EditorialImageResult[]> {
  if (!config.pexelsApiKey) throw new Error('Pexels API Key nao configurada.')

  const orientation = getPexelsOrientation(options.orientation || config.defaultOrientation)
  const params = new URLSearchParams({
    query: options.query,
    per_page: String(options.perPage || config.pexelsPerPage),
    locale: 'pt-BR',
  })
  if (orientation) params.set('orientation', orientation)

  const response = await fetch(`https://api.pexels.com/v1/search?${params.toString()}`, {
    headers: { Authorization: config.pexelsApiKey },
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`Pexels retornou ${response.status}: ${payload?.error || response.statusText}`)
  }

  return (Array.isArray(payload?.photos) ? payload.photos : []).map((photo: any) => {
    const result: Omit<EditorialImageResult, 'score'> = {
      provider: 'pexels',
      id: String(photo.id),
      title: String(photo.alt || options.query),
      description: String(photo.alt || options.query),
      imageUrl: String(photo.src?.large2x || photo.src?.large || photo.src?.original || ''),
      previewUrl: String(photo.src?.medium || photo.src?.small || photo.src?.large || ''),
      downloadUrl: String(photo.src?.large2x || photo.src?.large || photo.src?.original || ''),
      sourceUrl: String(photo.url || ''),
      author: String(photo.photographer || 'Pexels'),
      authorUrl: String(photo.photographer_url || 'https://www.pexels.com'),
      width: Number(photo.width || 0),
      height: Number(photo.height || 0),
      tags: normalizeTags(photo.alt || options.query),
      alt: String(photo.alt || options.query),
      license: 'Pexels License',
    }
    return { ...result, score: rankImage(result, options.query, config.pexelsPriority) }
  }).filter((item: EditorialImageResult) => item.imageUrl && item.sourceUrl)
}

export async function searchPixabayImages(
  config: EditorialImageProviderConfig,
  options: EditorialImageSearchOptions,
): Promise<EditorialImageResult[]> {
  if (!config.pixabayApiKey) throw new Error('Pixabay API Key nao configurada.')

  const params = new URLSearchParams({
    key: config.pixabayApiKey,
    q: options.query,
    lang: config.lang,
    image_type: 'photo',
    orientation: getPixabayOrientation(options.orientation || config.defaultOrientation),
    safesearch: config.safeSearch ? 'true' : 'false',
    per_page: String(options.perPage || config.pixabayPerPage),
  })

  const response = await fetch(`https://pixabay.com/api/?${params.toString()}`, {
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`Pixabay retornou ${response.status}: ${payload?.message || response.statusText}`)
  }

  return (Array.isArray(payload?.hits) ? payload.hits : []).map((hit: any) => {
    const tags = normalizeTags(hit.tags || options.query)
    const result: Omit<EditorialImageResult, 'score'> = {
      provider: 'pixabay',
      id: String(hit.id),
      title: tags[0] || options.query,
      description: tags.join(', ') || options.query,
      imageUrl: String(hit.largeImageURL || hit.webformatURL || ''),
      previewUrl: String(hit.webformatURL || hit.previewURL || ''),
      downloadUrl: String(hit.largeImageURL || hit.webformatURL || ''),
      sourceUrl: String(hit.pageURL || ''),
      author: String(hit.user || 'Pixabay'),
      authorUrl: hit.user && hit.user_id ? `https://pixabay.com/users/${hit.user}-${hit.user_id}/` : 'https://pixabay.com',
      width: Number(hit.imageWidth || hit.webformatWidth || 0),
      height: Number(hit.imageHeight || hit.webformatHeight || 0),
      tags,
      alt: tags.join(', ') || options.query,
      license: 'Pixabay Content License',
    }
    return { ...result, score: rankImage(result, options.query, config.pixabayPriority) }
  }).filter((item: EditorialImageResult) => item.imageUrl && item.sourceUrl)
}

export async function searchEditorialImages(options: EditorialImageSearchOptions) {
  const config = await getEditorialImageProviderConfig()
  const providers: Array<{ id: EditorialImageProvider; priority: number; enabled: boolean }> = [
    { id: 'pexels' as const, priority: config.pexelsPriority, enabled: config.pexelsEnabled && Boolean(config.pexelsApiKey) },
    { id: 'pixabay' as const, priority: config.pixabayPriority, enabled: config.pixabayEnabled && Boolean(config.pixabayApiKey) },
  ]
    .filter(provider => provider.enabled && (!options.provider || provider.id === options.provider))
    .sort((a, b) => a.priority - b.priority)

  const results = await Promise.allSettled(providers.map(provider => {
    const perPage = options.perPage || (provider.id === 'pexels' ? config.pexelsPerPage : config.pixabayPerPage)
    if (provider.id === 'pexels') return searchPexelsImages(config, { ...options, perPage })
    return searchPixabayImages(config, { ...options, perPage })
  }))

  return results
    .flatMap(result => result.status === 'fulfilled' ? result.value : [])
    .sort((a, b) => b.score - a.score)
}

export async function testEditorialImageProvider(provider: EditorialImageProvider, source?: Record<string, string>) {
  const config = await getEditorialImageProviderConfig(source)
  const query = 'luxury real estate beach'
  const options: EditorialImageSearchOptions = { query, orientation: 'horizontal', perPage: 3, provider }
  const results = provider === 'pexels'
    ? await searchPexelsImages(config, options)
    : await searchPixabayImages(config, options)

  return {
    provider,
    count: results.length,
    sample: results[0] || null,
  }
}

function extensionFromContentType(contentType: string) {
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('gif')) return 'gif'
  return 'jpg'
}

export async function persistEditorialImageToR2(
  image: EditorialImageResult,
  options: { folder?: string; slug?: string } = {},
): Promise<PersistedEditorialImage> {
  try {
    const response = await fetch(image.downloadUrl || image.imageUrl, { cache: 'no-store' })
    if (!response.ok) throw new Error(`Download da imagem falhou (${response.status}).`)

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const ext = extensionFromContentType(contentType)
    const safeSlug = String(options.slug || image.id || 'editorial-image')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'editorial-image'
    const result = await uploadFile(
      buffer,
      `${safeSlug}.${ext}`,
      options.folder || 'editorial-images',
      contentType,
    )

    return {
      ...image,
      r2Url: result.url,
      r2Key: result.key,
    }
  } catch (error) {
    console.warn('[Editorial Images] R2 mirror failed:', error instanceof Error ? error.message : String(error))
    return {
      ...image,
      r2Url: image.imageUrl,
    }
  }
}
