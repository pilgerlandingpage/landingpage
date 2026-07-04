import {
  persistEditorialImageToR2,
  searchEditorialImages,
  type EditorialImageResult,
  type PersistedEditorialImage,
} from '@/lib/media/editorial-image-providers'

type SupabaseLike = {
  from: (table: string) => any
}

export type EditorialImageRole = 'cover' | 'inline' | 'thumbnail'
export type EditorialContentType = 'blog' | 'news'

export type EditorialImageCandidate = EditorialImageResult & {
  sourceQuery: string
  diversityScore: number
}

type CurateEditorialImagesInput = {
  contentType: EditorialContentType
  title: string
  keywords: Array<string | null | undefined>
  count?: number
  maxQueries?: number
  perPage?: number
  avoidUrls?: string[]
}

type RegisterEditorialImageUsageInput = {
  postId?: string | null
  role: EditorialImageRole
  contentType: EditorialContentType
  sourceQuery?: string | null
}

type MediaMemory = {
  providerAssetKeys: Set<string>
  recentProviderAssetKeys: Set<string>
  urls: Set<string>
  recentUrls: Set<string>
  authorUseCounts: Map<string, number>
}

const RECENT_USAGE_DAYS = 180
const MAX_PROVIDER_PAGE = 8
const LOCAL_TERMS = /balneario|camboriu|itajai|itapema|porto belo|praia brava|santa catarina|florianopolis|brava/i
const GENERIC_TERMS = new Set([
  'blog',
  'noticia',
  'noticias',
  'mercado',
  'mercado imobiliario',
  'imobiliario',
  'imoveis',
  'imovel',
  'alto padrao',
  'luxo',
])

function normalize(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map(value => String(value || '').replace(/\s+/g, ' ').trim()).filter(Boolean)))
}

function cleanKeyword(value: string) {
  return value
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactKeyword(value: string) {
  return cleanKeyword(value)
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => !GENERIC_TERMS.has(normalize(word)))
    .slice(0, 7)
    .join(' ')
    .slice(0, 90)
    .trim()
}

function titleTerms(title: string) {
  return compactKeyword(title)
}

function providerAssetKey(provider?: string | null, providerAssetId?: string | null) {
  const providerName = String(provider || '').trim()
  const id = String(providerAssetId || '').trim()
  return providerName && id ? `${providerName}:${id}` : ''
}

function normalizeUrl(value?: string | null) {
  return String(value || '').trim()
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function seededDiversityValue(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash % 1000) / 1000
}

function buildEditorialImageQueries(input: CurateEditorialImagesInput) {
  const rawKeywords = unique(input.keywords.map(keyword => compactKeyword(String(keyword || ''))))
    .filter(keyword => keyword.length > 2)
    .filter(keyword => !GENERIC_TERMS.has(normalize(keyword)))
  const local = rawKeywords.find(keyword => LOCAL_TERMS.test(normalize(keyword)))
  const title = titleTerms(input.title)
  const base = rawKeywords.slice(0, 4).join(' ')
  const topic = unique([title, base]).join(' ')

  const contentSuffixes = input.contentType === 'news'
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

  const queries = [
    unique([local, topic, contentSuffixes[0]]).join(' '),
    unique([topic, contentSuffixes[1]]).join(' '),
    unique([local, contentSuffixes[2]]).join(' '),
    unique([base, contentSuffixes[3]]).join(' '),
    unique([title, 'apartment building exterior']).join(' '),
    unique([local, 'urban skyline apartments']).join(' '),
    'modern residential architecture beach city',
    'real estate investment city buildings',
    'luxury apartment facade city',
    'urban development residential buildings',
  ]

  return unique(queries)
    .map(query => query.replace(/\s+/g, ' ').trim())
    .filter(query => query.length > 8)
    .slice(0, input.maxQueries || 8)
}

function metadataRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {}
}

function addUrl(target: Set<string>, value?: string | null) {
  const url = normalizeUrl(value)
  if (url) target.add(url)
}

async function loadMediaMemory(supabase: SupabaseLike, avoidUrls: string[] = []): Promise<MediaMemory> {
  const memory: MediaMemory = {
    providerAssetKeys: new Set(),
    recentProviderAssetKeys: new Set(),
    urls: new Set(),
    recentUrls: new Set(),
    authorUseCounts: new Map(),
  }
  const recentSince = Date.now() - RECENT_USAGE_DAYS * 24 * 60 * 60 * 1000

  avoidUrls.forEach(url => {
    addUrl(memory.urls, url)
    addUrl(memory.recentUrls, url)
  })

  try {
    const { data, error } = await supabase
      .from('editorial_media_assets')
      .select('provider, provider_asset_id, source_url, image_url, preview_url, r2_url, author_name, last_used_at, used_count')
      .order('last_used_at', { ascending: false, nullsFirst: false })
      .limit(2000)

    if (error) throw error

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
  } catch (error: any) {
    if (!String(error?.message || '').includes('editorial_media_assets')) {
      console.warn('[Editorial Image Curator] media memory unavailable:', error?.message || error)
    }
  }

  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('cover_image_url')
      .not('cover_image_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(600)

    if (error) throw error

    for (const post of data || []) {
      addUrl(memory.urls, post.cover_image_url)
      addUrl(memory.recentUrls, post.cover_image_url)
    }
  } catch (error: any) {
    console.warn('[Editorial Image Curator] existing cover memory unavailable:', error?.message || error)
  }

  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('source_summary->editorial_visual_plan')
      .not('source_summary', 'is', null)
      .order('created_at', { ascending: false })
      .limit(800)

    if (error) throw error

    for (const post of data || []) {
      const plan = metadataRecord((post as any).editorial_visual_plan)
      const assets = Array.isArray(plan.assets) ? plan.assets : []
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
  } catch (error: any) {
    console.warn('[Editorial Image Curator] existing visual metadata memory unavailable:', error?.message || error)
  }

  return memory
}

function imageUrls(image: EditorialImageResult) {
  return [
    image.imageUrl,
    image.previewUrl,
    image.downloadUrl,
    image.sourceUrl,
  ].map(normalizeUrl).filter(Boolean)
}

function isRecentlyUsed(image: EditorialImageResult, memory: MediaMemory) {
  const key = providerAssetKey(image.provider, image.id)
  if (key && memory.recentProviderAssetKeys.has(key)) return true
  return imageUrls(image).some(url => memory.recentUrls.has(url))
}

function rankCandidate(image: EditorialImageResult, query: string, memory: MediaMemory) {
  const authorPenalty = Math.min(18, (memory.authorUseCounts.get(normalize(image.author)) || 0) * 3)
  const priorUsePenalty = memory.providerAssetKeys.has(providerAssetKey(image.provider, image.id)) ? 18 : 0
  const urlPenalty = imageUrls(image).some(url => memory.urls.has(url)) ? 24 : 0
  const diversityBoost = seededDiversityValue(`${image.provider}:${image.id}:${query}`) * 8
  const dimensionBoost = image.width >= 1800 && image.height >= 900 ? 6 : 0
  return Math.max(0, image.score + dimensionBoost + diversityBoost - authorPenalty - priorUsePenalty - urlPenalty)
}

function weightedPick(candidates: EditorialImageCandidate[], count: number) {
  const pool = candidates.slice(0, Math.max(10, count * 8))
  const selected: EditorialImageCandidate[] = []

  while (selected.length < count && pool.length) {
    const total = pool.reduce((sum, item) => sum + Math.max(1, item.diversityScore), 0)
    let cursor = Math.random() * total
    let pickedIndex = 0

    for (let index = 0; index < pool.length; index += 1) {
      cursor -= Math.max(1, pool[index].diversityScore)
      if (cursor <= 0) {
        pickedIndex = index
        break
      }
    }

    const [picked] = pool.splice(pickedIndex, 1)
    if (picked) selected.push(picked)
  }

  return selected
}

export function buildEditorialImageQuerySet(input: CurateEditorialImagesInput) {
  return buildEditorialImageQueries(input)
}

export async function curateEditorialImages(
  supabase: SupabaseLike,
  input: CurateEditorialImagesInput,
): Promise<EditorialImageCandidate[]> {
  const count = Math.max(1, input.count || 1)
  const queries = buildEditorialImageQueries(input)
  const memory = await loadMediaMemory(supabase, input.avoidUrls)
  const seen = new Set<string>()
  const candidates: EditorialImageCandidate[] = []

  for (const query of queries) {
    const page = randomInt(1, MAX_PROVIDER_PAGE)
    const order = Math.random() > 0.45 ? 'popular' : 'latest'
    const images = await searchEditorialImages({
      query,
      orientation: 'horizontal',
      perPage: input.perPage || 18,
      page,
      order,
    }).catch(error => {
      console.warn('[Editorial Image Curator] search failed:', error?.message || error)
      return []
    })

    for (const image of images) {
      const key = providerAssetKey(image.provider, image.id) || image.sourceUrl || image.imageUrl
      if (!key || seen.has(key)) continue
      seen.add(key)
      if (isRecentlyUsed(image, memory)) continue

      const diversityScore = rankCandidate(image, query, memory)
      if (diversityScore <= 0) continue
      candidates.push({
        ...image,
        sourceQuery: query,
        diversityScore,
      })
    }

    if (candidates.length >= Math.max(24, count * 8)) break
  }

  const ranked = candidates.sort((a, b) => b.diversityScore - a.diversityScore)
  return weightedPick(ranked, count)
}

export async function registerEditorialImageUsage(
  supabase: SupabaseLike,
  image: Partial<PersistedEditorialImage> & Partial<EditorialImageCandidate> & {
    provider: 'pexels' | 'pixabay'
    provider_asset_id?: string | null
  },
  usage: RegisterEditorialImageUsageInput,
) {
  const providerAssetId = String(image.id || image.provider_asset_id || '').trim()
  if (!providerAssetId) return null

  try {
    const now = new Date().toISOString()
    const { data: asset, error } = await supabase
      .from('editorial_media_assets')
      .upsert({
        provider: image.provider,
        provider_asset_id: providerAssetId,
        source_url: image.sourceUrl || null,
        image_url: image.imageUrl || image.r2Url || '',
        preview_url: image.previewUrl || null,
        r2_url: image.r2Url || null,
        r2_key: image.r2Key || null,
        author_name: image.author || null,
        author_url: image.authorUrl || null,
        license: image.license || null,
        width: image.width || null,
        height: image.height || null,
        tags: Array.isArray(image.tags) ? image.tags : [],
        alt: image.alt || image.title || null,
        metadata: {
          score: image.score ?? null,
          diversity_score: (image as any).diversityScore ?? null,
          source_query: usage.sourceQuery || (image as any).sourceQuery || null,
        },
        updated_at: now,
      }, { onConflict: 'provider,provider_asset_id' })
      .select('id, used_count')
      .maybeSingle()

    if (error || !asset?.id) throw error || new Error('asset_not_saved')

    await supabase
      .from('editorial_media_assets')
      .update({
        last_used_at: now,
        used_count: Number(asset.used_count || 0) + 1,
        r2_url: image.r2Url || null,
        r2_key: image.r2Key || null,
        updated_at: now,
      })
      .eq('id', asset.id)

    if (usage.postId) {
      await supabase
        .from('editorial_post_media_usage')
        .insert({
          post_id: usage.postId,
          asset_id: asset.id,
          role: usage.role,
          content_type: usage.contentType,
          source_query: usage.sourceQuery || (image as any).sourceQuery || null,
          image_url: image.r2Url || image.imageUrl || null,
          metadata: {
            source_url: image.sourceUrl || null,
            author: image.author || null,
            license: image.license || null,
          },
        })
    }

    return asset.id as string
  } catch (error: any) {
    if (!String(error?.message || '').includes('editorial_media_assets')) {
      console.warn('[Editorial Image Curator] usage registration failed:', error?.message || error)
    }
    return null
  }
}

export async function registerEditorialVisualPlanUsage(
  supabase: SupabaseLike,
  post: { id: string; generated_by?: string | null; category?: string | null; source_summary?: unknown },
) {
  const summary = metadataRecord(post.source_summary)
  const plan = metadataRecord(summary.editorial_visual_plan)
  const assets = Array.isArray(plan.assets) ? plan.assets : []
  const contentType: EditorialContentType = normalize(post.generated_by).includes('news') || normalize(post.category).includes('noticia')
    ? 'news'
    : 'blog'

  for (const asset of assets) {
    const source = String(asset.source || asset.provider || '')
    if (source !== 'pexels' && source !== 'pixabay') continue
    await registerEditorialImageUsage(supabase, {
      provider: source,
      provider_asset_id: asset.provider_asset_id || asset.id,
      id: asset.provider_asset_id || asset.id,
      title: asset.alt || '',
      description: asset.caption || '',
      imageUrl: asset.original_url || asset.image_url,
      previewUrl: asset.preview_url || asset.original_url || asset.image_url,
      downloadUrl: asset.original_url || asset.image_url,
      sourceUrl: asset.source_url || '',
      author: asset.author || '',
      authorUrl: asset.author_url || '',
      width: asset.width || 0,
      height: asset.height || 0,
      tags: Array.isArray(asset.tags) ? asset.tags : [],
      alt: asset.alt || '',
      license: asset.license || '',
      score: Number(asset.score || 0),
      r2Url: asset.image_url,
      r2Key: asset.r2_key || undefined,
    }, {
      postId: post.id,
      role: asset.role === 'inline' ? 'inline' : 'cover',
      contentType,
      sourceQuery: asset.source_query || plan.image_search_query || null,
    })
  }
}

export async function persistCuratedEditorialImage(
  image: EditorialImageCandidate,
  options: { folder?: string; slug?: string },
): Promise<EditorialImageCandidate & PersistedEditorialImage> {
  const persisted = await persistEditorialImageToR2(image, options)
  return {
    ...image,
    ...persisted,
  }
}
