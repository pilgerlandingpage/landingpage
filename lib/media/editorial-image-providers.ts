import { createAdminClient } from '@/lib/supabase/server'
import { uploadFile } from '@/lib/r2'

export type EditorialImageProvider = 'wikimedia_commons' | 'google_licensed' | 'pexels' | 'pixabay'
export type EditorialImageOrientation = 'horizontal' | 'vertical' | 'all'
export type EditorialImageOrder = 'popular' | 'latest'

export type EditorialImageSearchOptions = {
  query: string
  orientation?: EditorialImageOrientation
  perPage?: number
  provider?: EditorialImageProvider
  page?: number
  order?: EditorialImageOrder
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
  licenseUrl?: string
  licenseStatus?: 'wikimedia_commons_metadata' | 'metadata_confirmed' | 'trusted_commons_source' | 'google_rights_filter'
  attributionRequired?: boolean
  metadata?: Record<string, unknown>
  score: number
}

export type PersistedEditorialImage = EditorialImageResult & {
  r2Url: string
  r2Key?: string
}

export type EditorialImageProviderConfig = {
  wikimediaCommonsEnabled: boolean
  wikimediaCommonsPriority: number
  wikimediaCommonsPerPage: number
  googleImageSearchApiKey: string
  googleImageSearchCx: string
  googleImageSearchEnabled: boolean
  googleImageSearchPriority: number
  googleImageSearchPerPage: number
  googleImageSearchRights: string
  googleImageSearchRequireLicenseMetadata: boolean
  googleImageSearchCommercialOnly: boolean
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
  'wikimedia_commons_enabled',
  'wikimedia_commons_priority',
  'wikimedia_commons_per_page',
  'google_image_search_api_key',
  'google_image_search_cx',
  'google_image_search_enabled',
  'google_image_search_priority',
  'google_image_search_per_page',
  'google_image_search_rights',
  'google_image_search_require_license_metadata',
  'google_image_search_commercial_only',
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

function normalizeGoogleRights(value: unknown) {
  const selected = String(value || '').trim()
  return selected || 'cc_publicdomain|cc_attribute'
}

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map(tag => tag.trim()).filter(Boolean)
  return String(value || '')
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
}

function stripHtml(value: unknown) {
  return decodeHtmlEntities(String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim())
}

function commonsMetadataValue(metadata: Record<string, any>, key: string) {
  return stripHtml(metadata?.[key]?.value)
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (Array.isArray(value)) {
      const nested: string = firstText(...value)
      if (nested) return nested
      continue
    }
    const text = String(value || '').trim()
    if (text) return text
  }
  return ''
}

function sourceDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
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

function matchesOrientation(width: number, height: number, orientation: EditorialImageOrientation) {
  if (!width || !height || orientation === 'all') return true
  const ratio = width / height
  if (orientation === 'horizontal') return ratio >= 1.12
  return ratio <= 0.95
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
    wikimediaCommonsEnabled: toBool(appConfig.wikimedia_commons_enabled, true),
    wikimediaCommonsPriority: toInt(appConfig.wikimedia_commons_priority, 1, 1, 4),
    wikimediaCommonsPerPage: toInt(appConfig.wikimedia_commons_per_page, 12, 3, 30),
    googleImageSearchApiKey: (appConfig.google_image_search_api_key || process.env.GOOGLE_IMAGE_SEARCH_API_KEY || process.env.GOOGLE_CSE_API_KEY || '').trim(),
    googleImageSearchCx: (appConfig.google_image_search_cx || process.env.GOOGLE_IMAGE_SEARCH_CX || process.env.GOOGLE_CSE_CX || '').trim(),
    googleImageSearchEnabled: toBool(appConfig.google_image_search_enabled, false),
    googleImageSearchPriority: toInt(appConfig.google_image_search_priority, 3, 1, 4),
    googleImageSearchPerPage: toInt(appConfig.google_image_search_per_page, 10, 3, 10),
    googleImageSearchRights: normalizeGoogleRights(appConfig.google_image_search_rights),
    googleImageSearchRequireLicenseMetadata: toBool(appConfig.google_image_search_require_license_metadata, true),
    googleImageSearchCommercialOnly: toBool(appConfig.google_image_search_commercial_only, true),
    pexelsApiKey: (appConfig.pexels_api_key || process.env.PEXELS_API_KEY || '').trim(),
    pexelsEnabled: toBool(appConfig.pexels_enabled, true),
    pexelsPriority: toInt(appConfig.pexels_priority, 2, 1, 4),
    pexelsPerPage: toInt(appConfig.pexels_per_page, 12, 3, 40),
    pixabayApiKey: (appConfig.pixabay_api_key || process.env.PIXABAY_API_KEY || '').trim(),
    pixabayEnabled: toBool(appConfig.pixabay_enabled, true),
    pixabayPriority: toInt(appConfig.pixabay_priority, 4, 1, 4),
    pixabayPerPage: toInt(appConfig.pixabay_per_page, 12, 3, 40),
    defaultOrientation: normalizeOrientation(appConfig.editorial_image_default_orientation),
    safeSearch: toBool(appConfig.editorial_image_safe_search, true),
    lang: String(appConfig.editorial_image_lang || 'pt').trim().toLowerCase() || 'pt',
  }
}

function getGoogleLicenseMetadata(item: any) {
  const metatags = Array.isArray(item?.pagemap?.metatags) ? item.pagemap.metatags : []
  const creativework = Array.isArray(item?.pagemap?.creativework) ? item.pagemap.creativework : []
  const imageobject = Array.isArray(item?.pagemap?.imageobject) ? item.pagemap.imageobject : []
  const all = [...metatags, ...creativework, ...imageobject].filter(entry => entry && typeof entry === 'object')
  const licenseUrl = firstText(
    ...all.map(entry => entry.license),
    ...all.map(entry => entry['og:license']),
    ...all.map(entry => entry['cc:license']),
    ...all.map(entry => entry['dc.rights']),
    ...all.map(entry => entry['citation_license']),
  )
  const author = firstText(
    ...all.map(entry => entry.creator),
    ...all.map(entry => entry.author),
    ...all.map(entry => entry['article:author']),
    ...all.map(entry => entry['dc.creator']),
  )
  const creditText = firstText(
    ...all.map(entry => entry.credittext),
    ...all.map(entry => entry.creditText),
    ...all.map(entry => entry.copyrightnotice),
    ...all.map(entry => entry.copyrightNotice),
  )

  return { licenseUrl, author, creditText }
}

function isTrustedCommonsSource(url: string) {
  const domain = sourceDomain(url)
  return domain === 'commons.wikimedia.org'
    || domain.endsWith('.wikimedia.org')
    || domain === 'creativecommons.org'
    || domain.endsWith('.creativecommons.org')
}

function googleRightsAllowCommercialUse(rights: string) {
  return !String(rights || '').toLowerCase().includes('cc_noncommercial')
}

function isAllowedCommonsLicense(license: string) {
  const normalized = license.toLowerCase()
  if (!normalized) return false
  return ![
    'noncommercial',
    'non-commercial',
    'fair use',
    'copyrighted',
    'all rights reserved',
    'unknown',
    'unlicensed',
  ].some(term => normalized.includes(term))
}

export async function searchGoogleLicensedImages(
  config: EditorialImageProviderConfig,
  options: EditorialImageSearchOptions,
): Promise<EditorialImageResult[]> {
  if (!config.googleImageSearchApiKey || !config.googleImageSearchCx) {
    throw new Error('Google Image Search API Key/CX nao configurados.')
  }
  if (config.googleImageSearchCommercialOnly && !googleRightsAllowCommercialUse(config.googleImageSearchRights)) {
    throw new Error('Filtro Google contem licenca nao comercial; ajuste google_image_search_rights.')
  }

  const orientation = options.orientation || config.defaultOrientation
  const perPage = Math.min(10, Math.max(3, options.perPage || config.googleImageSearchPerPage))
  const page = Math.max(1, options.page || 1)
  const start = Math.min(91, ((page - 1) * perPage) + 1)
  const lang = config.lang.split('-')[0] || 'pt'
  const params = new URLSearchParams({
    key: config.googleImageSearchApiKey,
    cx: config.googleImageSearchCx,
    q: options.query,
    searchType: 'image',
    num: String(perPage),
    start: String(start),
    safe: config.safeSearch ? 'active' : 'off',
    rights: config.googleImageSearchRights,
    imgSize: 'large',
    imgType: 'photo',
    hl: config.lang,
    lr: `lang_${lang}`,
  })

  const response = await fetch(`https://customsearch.googleapis.com/customsearch/v1?${params.toString()}`, {
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`Google Image Search retornou ${response.status}: ${payload?.error?.message || response.statusText}`)
  }

  return (Array.isArray(payload?.items) ? payload.items : []).map((item: any) => {
    const image = item?.image || {}
    const sourceUrl = String(image.contextLink || item?.link || '').trim()
    const imageUrl = String(item?.link || '').trim()
    const previewUrl = String(image.thumbnailLink || item?.pagemap?.cse_thumbnail?.[0]?.src || imageUrl)
    const width = Number(image.width || 0)
    const height = Number(image.height || 0)
    const licenseMetadata = getGoogleLicenseMetadata(item)
    const trustedCommons = isTrustedCommonsSource(sourceUrl)
    const licenseStatus = licenseMetadata.licenseUrl
      ? 'metadata_confirmed'
      : trustedCommons ? 'trusted_commons_source' : 'google_rights_filter'
    const domain = sourceDomain(sourceUrl) || String(item?.displayLink || 'Google')
    const title = String(item?.title || options.query)
    const description = String(item?.snippet || title || options.query)
    const tags = normalizeTags(`${title}, ${description}, ${domain}`)
    const author = licenseMetadata.author || licenseMetadata.creditText || domain

    const result: Omit<EditorialImageResult, 'score'> = {
      provider: 'google_licensed',
      id: String(item?.cacheId || item?.image?.byteSize || imageUrl || sourceUrl),
      title,
      description,
      imageUrl,
      previewUrl,
      downloadUrl: imageUrl,
      sourceUrl,
      author,
      authorUrl: sourceUrl,
      width,
      height,
      tags,
      alt: title || options.query,
      license: licenseMetadata.licenseUrl
        ? 'Creative Commons / licenca declarada na origem'
        : `Google rights filter: ${config.googleImageSearchRights}`,
      licenseUrl: licenseMetadata.licenseUrl || undefined,
      licenseStatus,
      attributionRequired: config.googleImageSearchRights.includes('cc_attribute') || Boolean(licenseMetadata.creditText),
      metadata: {
        display_link: item?.displayLink || null,
        mime: item?.mime || null,
        byte_size: image.byteSize || null,
        rights_filter: config.googleImageSearchRights,
        credit_text: licenseMetadata.creditText || null,
        license_validation: licenseStatus,
      },
    }

    const trustedEnough = !config.googleImageSearchRequireLicenseMetadata
      || Boolean(result.licenseUrl)
      || trustedCommons

    if (!trustedEnough) return null
    if (!matchesOrientation(result.width, result.height, orientation)) return null

    return {
      ...result,
      score: rankImage(result, options.query, config.googleImageSearchPriority)
        + 6
        + (trustedCommons ? 10 : 0)
        + (result.licenseUrl ? 8 : 0),
    }
  }).filter((item: EditorialImageResult | null): item is EditorialImageResult => Boolean(item?.imageUrl && item?.sourceUrl))
}

export async function searchWikimediaCommonsImages(
  config: EditorialImageProviderConfig,
  options: EditorialImageSearchOptions,
): Promise<EditorialImageResult[]> {
  const orientation = options.orientation || config.defaultOrientation
  const perPage = Math.min(30, Math.max(3, options.perPage || config.wikimediaCommonsPerPage))
  const offset = 0
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    origin: '*',
    generator: 'search',
    gsrsearch: options.query,
    gsrnamespace: '6',
    gsrlimit: String(perPage),
    gsroffset: String(offset),
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '1600',
  })

  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
    cache: 'no-store',
    headers: {
      'User-Agent': 'PilgerLandingPage/1.0 (https://guilhermepilger.ai)',
    },
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok || payload?.error) {
    throw new Error(`Wikimedia Commons retornou ${response.status}: ${payload?.error?.info || response.statusText}`)
  }

  const pages = Array.isArray(payload?.query?.pages) ? payload.query.pages : []
  return pages.map((page: any) => {
    const info = Array.isArray(page?.imageinfo) ? page.imageinfo[0] : null
    const metadata = info?.extmetadata && typeof info.extmetadata === 'object' ? info.extmetadata : {}
    const imageUrl = String(info?.url || '').trim()
    const sourceUrl = String(info?.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(String(page?.title || ''))}`).trim()
    const title = stripHtml(commonsMetadataValue(metadata, 'ObjectName') || String(page?.title || options.query).replace(/^File:/, ''))
    const description = stripHtml(commonsMetadataValue(metadata, 'ImageDescription') || commonsMetadataValue(metadata, 'Credit') || title)
    const author = stripHtml(commonsMetadataValue(metadata, 'Artist') || commonsMetadataValue(metadata, 'Credit') || 'Wikimedia Commons')
    const license = stripHtml(commonsMetadataValue(metadata, 'LicenseShortName') || commonsMetadataValue(metadata, 'UsageTerms'))
    const licenseUrl = String(metadata?.LicenseUrl?.value || '').trim() || undefined
    const mime = String(info?.mime || '').toLowerCase()
    const width = Number(info?.width || 0)
    const height = Number(info?.height || 0)
    const tags = normalizeTags(`${title}, ${description}, ${license}, Wikimedia Commons`)

    if (!imageUrl || !sourceUrl) return null
    if (mime && !mime.startsWith('image/')) return null
    if (mime.includes('svg') || mime.includes('gif')) return null
    if (!license || !isAllowedCommonsLicense(license)) return null
    if (!matchesOrientation(width, height, orientation)) return null

    const result: Omit<EditorialImageResult, 'score'> = {
      provider: 'wikimedia_commons',
      id: String(page?.pageid || page?.title || imageUrl),
      title,
      description,
      imageUrl,
      previewUrl: String(info?.thumburl || imageUrl),
      downloadUrl: imageUrl,
      sourceUrl,
      author,
      authorUrl: sourceUrl,
      width,
      height,
      tags,
      alt: title || options.query,
      license,
      licenseUrl,
      licenseStatus: 'wikimedia_commons_metadata',
      attributionRequired: /(^|\s)cc\s+by/i.test(license) || Boolean(author && author !== 'Wikimedia Commons'),
      metadata: {
        page_title: page?.title || null,
        mime: info?.mime || null,
        credit_text: commonsMetadataValue(metadata, 'Credit') || null,
        usage_terms: commonsMetadataValue(metadata, 'UsageTerms') || null,
        license_validation: 'wikimedia_commons_metadata',
      },
    }

    return {
      ...result,
      score: rankImage(result, options.query, config.wikimediaCommonsPriority) + 12 + (licenseUrl ? 5 : 0),
    }
  }).filter((item: EditorialImageResult | null): item is EditorialImageResult => Boolean(item?.imageUrl && item?.sourceUrl))
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
  if (options.page && options.page > 1) params.set('page', String(options.page))
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
  if (options.page && options.page > 1) params.set('page', String(options.page))
  if (options.order) params.set('order', options.order)

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
  const providerOrder: Record<EditorialImageProvider, number> = {
    wikimedia_commons: 0,
    google_licensed: 1,
    pexels: 2,
    pixabay: 3,
  }
  const providers: Array<{ id: EditorialImageProvider; priority: number; enabled: boolean }> = [
    {
      id: 'wikimedia_commons' as const,
      priority: config.wikimediaCommonsPriority,
      enabled: config.wikimediaCommonsEnabled,
    },
    {
      id: 'google_licensed' as const,
      priority: config.googleImageSearchPriority,
      enabled: config.googleImageSearchEnabled && Boolean(config.googleImageSearchApiKey && config.googleImageSearchCx),
    },
    { id: 'pexels' as const, priority: config.pexelsPriority, enabled: config.pexelsEnabled && Boolean(config.pexelsApiKey) },
    { id: 'pixabay' as const, priority: config.pixabayPriority, enabled: config.pixabayEnabled && Boolean(config.pixabayApiKey) },
  ]
    .filter(provider => provider.enabled && (!options.provider || provider.id === options.provider))
    .sort((a, b) => a.priority - b.priority || providerOrder[a.id] - providerOrder[b.id])

  const results = await Promise.allSettled(providers.map(provider => {
    const perPage = options.perPage
      || (provider.id === 'wikimedia_commons'
        ? config.wikimediaCommonsPerPage
        : provider.id === 'google_licensed'
          ? config.googleImageSearchPerPage
          : provider.id === 'pexels'
            ? config.pexelsPerPage
            : config.pixabayPerPage)
    if (provider.id === 'wikimedia_commons') return searchWikimediaCommonsImages(config, { ...options, perPage })
    if (provider.id === 'google_licensed') return searchGoogleLicensedImages(config, { ...options, perPage })
    if (provider.id === 'pexels') return searchPexelsImages(config, { ...options, perPage })
    return searchPixabayImages(config, { ...options, perPage })
  }))

  return results
    .flatMap(result => result.status === 'fulfilled' ? result.value : [])
    .sort((a, b) => b.score - a.score)
}

export async function testEditorialImageProvider(provider: EditorialImageProvider, source?: Record<string, string>) {
  const config = await getEditorialImageProviderConfig(source)
  const query = 'Balneario Camboriu skyline arquitetura'
  const options: EditorialImageSearchOptions = { query, orientation: 'horizontal', perPage: 3, provider }
  const results = provider === 'wikimedia_commons'
    ? await searchWikimediaCommonsImages(config, options)
    : provider === 'google_licensed'
    ? await searchGoogleLicensedImages(config, options)
    : provider === 'pexels'
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
