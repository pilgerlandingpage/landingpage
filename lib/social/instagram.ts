import { createAdminClient } from '@/lib/supabase/server'
import { saveAppConfig } from '@/lib/admin/app-config'

const META_API_VERSION = 'v21.0'
const PLATFORM = 'instagram'
const CACHE_TTL_MS = 30 * 60 * 1000

type SupabaseAdmin = ReturnType<typeof createAdminClient>

type MetaConfig = {
  accessToken: string
  adAccountId?: string
  businessId?: string
  instagramAccountId?: string
}

type GraphList<T> = {
  data?: T[]
  paging?: { next?: string }
  error?: { message?: string; code?: number; type?: string }
}

type InstagramProfile = {
  id: string
  username?: string
  name?: string
  profile_picture_url?: string
  followers_count?: number
  media_count?: number
}

type InstagramMedia = {
  id: string
  caption?: string
  media_type?: string
  media_product_type?: string
  media_url?: string
  thumbnail_url?: string
  permalink?: string
  timestamp?: string
  like_count?: number
  comments_count?: number
}

type InsightValue = {
  name: string
  values?: Array<{ value?: number | string }>
}

type CachedProfile = {
  id: string
  platform: string
  external_id: string
  username: string | null
  display_name: string | null
  profile_picture_url: string | null
  followers_count: number
  media_count: number
  last_synced_at: string | null
}

type CachedMedia = {
  id: string
  platform: string
  external_id: string
  media_type: string | null
  media_product_type: string | null
  caption: string | null
  permalink: string | null
  thumbnail_url: string | null
  media_url: string | null
  published_at: string | null
  like_count: number
  comments_count: number
  reach: number
  views: number
  total_interactions: number
  saved: number
  shares: number
}

export type InstagramOrganicPayload = {
  profile: CachedProfile | null
  media: CachedMedia[]
  reels: CachedMedia[]
  totals: {
    followers: number
    media: number
    reach: number
    views: number
    totalInteractions: number
    likes: number
    comments: number
    saved: number
    shares: number
  }
  cached: boolean
  stale: boolean
  syncedAt: string | null
}

function getBaseUrl() {
  return `https://graph.facebook.com/${META_API_VERSION}`
}

function numeric(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function cleanCaption(value?: string) {
  if (!value) return null
  return value.length > 2000 ? `${value.slice(0, 1997)}...` : value
}

function isReel(media: CachedMedia) {
  return String(media.media_product_type || '').toUpperCase() === 'REELS'
}

function buildTotals(profile: CachedProfile | null, media: CachedMedia[]) {
  return media.reduce(
    (acc, item) => {
      acc.reach += item.reach || 0
      acc.views += item.views || 0
      acc.totalInteractions += item.total_interactions || 0
      acc.likes += item.like_count || 0
      acc.comments += item.comments_count || 0
      acc.saved += item.saved || 0
      acc.shares += item.shares || 0
      return acc
    },
    {
      followers: profile?.followers_count || 0,
      media: profile?.media_count || 0,
      reach: 0,
      views: 0,
      totalInteractions: 0,
      likes: 0,
      comments: 0,
      saved: 0,
      shares: 0,
    },
  )
}

async function readMetaConfig(): Promise<MetaConfig> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', [
      'meta_access_token',
      'meta_ad_account_id',
      'meta_business_id',
      'meta_instagram_account_id',
      'facebook_page_access_token',
      'instagram_business_account_id',
      'instagram_business_access_token',
    ])

  const rows = (data || []) as Array<{ key: string; value: string }>
  const config = rows.reduce<Record<string, string>>((acc, row) => {
    acc[row.key] = row.value
    return acc
  }, {})

  // This reader uses Facebook Graph. Tokens from Instagram Login (IGAA/IGQ...) belong to graph.instagram.com.
  const accessToken = config.meta_access_token
    || process.env.META_ACCESS_TOKEN
    || config.facebook_page_access_token
    || process.env.FACEBOOK_PAGE_ACCESS_TOKEN
  if (!accessToken) throw new Error('Token da Meta nao configurado.')

  const adAccount = config.meta_ad_account_id || process.env.META_AD_ACCOUNT_ID
  const businessId = config.meta_business_id || process.env.META_BUSINESS_ID
  const instagramAccountId = config.meta_instagram_account_id
    || process.env.META_INSTAGRAM_ACCOUNT_ID
    || config.instagram_business_account_id
    || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID

  return {
    accessToken,
    adAccountId: adAccount ? (adAccount.startsWith('act_') ? adAccount : `act_${adAccount}`) : undefined,
    businessId,
    instagramAccountId,
  }
}

async function graphGet<T>(path: string, params: Record<string, string | number | undefined>, accessToken: string): Promise<T> {
  const url = new URL(`${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
  })
  url.searchParams.set('access_token', accessToken)

  const response = await fetch(url.toString(), { cache: 'no-store' })
  const payload = await response.json()

  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || `Erro Meta Graph ${response.status}`)
  }

  return payload as T
}

async function getBusinessId(config: MetaConfig) {
  if (config.businessId) return config.businessId
  if (!config.adAccountId) throw new Error('Business ID ou conta de anuncios da Meta nao configurados.')

  const account = await graphGet<{ business?: { id?: string } }>(
    `/${config.adAccountId}`,
    { fields: 'business{id,name}' },
    config.accessToken,
  )

  if (!account.business?.id) {
    throw new Error('Nao foi possivel encontrar o Business ID pela conta de anuncios.')
  }

  return account.business.id
}

async function listAll<T>(path: string, params: Record<string, string | number | undefined>, accessToken: string) {
  const items: T[] = []
  let nextUrl: string | undefined

  do {
    const payload: GraphList<T> = nextUrl
      ? await fetch(nextUrl, { cache: 'no-store' }).then(async response => {
          const data = await response.json()
          if (!response.ok || data?.error) throw new Error(data?.error?.message || `Erro Meta Graph ${response.status}`)
          return data
        })
      : await graphGet<GraphList<T>>(path, params, accessToken)

    items.push(...(payload.data || []))
    nextUrl = payload.paging?.next
  } while (nextUrl)

  return items
}

async function resolveInstagramProfile(config: MetaConfig): Promise<InstagramProfile> {
  if (config.instagramAccountId) {
    return graphGet<InstagramProfile>(
      `/${config.instagramAccountId}`,
      { fields: 'id,username,name,profile_picture_url,followers_count,media_count' },
      config.accessToken,
    )
  }

  const businessId = await getBusinessId(config)
  const fields = 'id,username,name,profile_picture_url,followers_count,media_count'
  const accounts = await listAll<InstagramProfile>(
    `/${businessId}/owned_instagram_accounts`,
    { fields, limit: 100 },
    config.accessToken,
  )

  const directMatch = accounts.find(account => String(account.username || '').toLowerCase().includes('guilherme'))
  if (directMatch || accounts[0]) return directMatch || accounts[0]

  const pages = await listAll<{
    instagram_business_account?: InstagramProfile
  }>(
    `/${businessId}/owned_pages`,
    { fields: `instagram_business_account{${fields}}`, limit: 100 },
    config.accessToken,
  )

  const pageAccounts = pages
    .map(page => page.instagram_business_account)
    .filter((account): account is InstagramProfile => Boolean(account?.id))

  const pageMatch = pageAccounts.find(account => String(account.username || '').toLowerCase().includes('guilherme'))
  if (pageMatch || pageAccounts[0]) return pageMatch || pageAccounts[0]

  throw new Error('Nenhuma conta Instagram Business encontrada no Business Manager.')
}

async function fetchRecentMedia(config: MetaConfig, instagramId: string, limit: number) {
  const fields = [
    'id',
    'caption',
    'media_type',
    'media_product_type',
    'media_url',
    'thumbnail_url',
    'permalink',
    'timestamp',
    'like_count',
    'comments_count',
  ].join(',')

  const payload = await graphGet<GraphList<InstagramMedia>>(
    `/${instagramId}/media`,
    { fields, limit: Math.min(Math.max(limit, 1), 50) },
    config.accessToken,
  )

  return payload.data || []
}

async function fetchMediaInsights(config: MetaConfig, mediaId: string) {
  const metricSets = [
    'reach,total_interactions,likes,comments,saved,shares,views',
    'reach,total_interactions,saved,shares,views',
    'reach,total_interactions',
  ]

  for (const metrics of metricSets) {
    try {
      const data = await graphGet<GraphList<InsightValue>>(
        `/${mediaId}/insights`,
        { metric: metrics },
        config.accessToken,
      )

      return (data.data || []).reduce<Record<string, number>>((acc, item) => {
        acc[item.name] = numeric(item.values?.[0]?.value)
        return acc
      }, {})
    } catch {
      continue
    }
  }

  return {}
}

async function fetchInsightsForMedia(config: MetaConfig, media: InstagramMedia[]) {
  const pairs = await Promise.all(
    media.slice(0, 24).map(async item => [item.id, await fetchMediaInsights(config, item.id)] as const),
  )

  return pairs.reduce<Record<string, Record<string, number>>>((acc, [id, insights]) => {
    acc[id] = insights
    return acc
  }, {})
}

export async function getCachedInstagramOrganic(limit = 12): Promise<InstagramOrganicPayload | null> {
  const supabase = createAdminClient()

  const { data: profile } = await supabase
    .from('organic_social_profiles')
    .select('id, platform, external_id, username, display_name, profile_picture_url, followers_count, media_count, last_synced_at')
    .eq('platform', PLATFORM)
    .order('last_synced_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!profile) return null

  const { data: media } = await supabase
    .from('organic_social_media')
    .select('id, platform, external_id, media_type, media_product_type, caption, permalink, thumbnail_url, media_url, published_at, like_count, comments_count, reach, views, total_interactions, saved, shares')
    .eq('profile_id', profile.id)
    .order('published_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50))

  const rows = (media || []) as CachedMedia[]

  return {
    profile: profile as CachedProfile,
    media: rows,
    reels: rows.filter(isReel),
    totals: buildTotals(profile as CachedProfile, rows),
    cached: true,
    stale: profile.last_synced_at ? Date.now() - new Date(profile.last_synced_at).getTime() > CACHE_TTL_MS : true,
    syncedAt: profile.last_synced_at,
  }
}

export async function isInstagramCacheFresh() {
  const cached = await getCachedInstagramOrganic(1)
  return Boolean(cached?.profile?.last_synced_at && !cached.stale)
}

export async function syncInstagramOrganic(limit = 12): Promise<InstagramOrganicPayload> {
  const supabase = createAdminClient() as SupabaseAdmin
  const config = await readMetaConfig()
  const profile = await resolveInstagramProfile(config)
  const now = new Date().toISOString()
  const media = (await fetchRecentMedia(config, profile.id, limit)).slice(0, Math.min(Math.max(limit, 1), 50))
  const insightsByMedia = await fetchInsightsForMedia(config, media)

  const { data: storedProfile, error: profileError } = await supabase
    .from('organic_social_profiles')
    .upsert({
      platform: PLATFORM,
      external_id: profile.id,
      username: profile.username || null,
      display_name: profile.name || profile.username || null,
      profile_picture_url: profile.profile_picture_url || null,
      followers_count: numeric(profile.followers_count),
      media_count: numeric(profile.media_count),
      raw: profile,
      last_synced_at: now,
      updated_at: now,
    }, { onConflict: 'platform,external_id' })
    .select('id, platform, external_id, username, display_name, profile_picture_url, followers_count, media_count, last_synced_at')
    .single()

  if (profileError || !storedProfile) {
    throw new Error(profileError?.message || 'Nao foi possivel salvar o perfil do Instagram.')
  }

  const mediaRows = media.map(item => {
    const insights = insightsByMedia[item.id] || {}

    return {
      profile_id: storedProfile.id,
      platform: PLATFORM,
      external_id: item.id,
      media_type: item.media_type || null,
      media_product_type: item.media_product_type || null,
      caption: cleanCaption(item.caption),
      permalink: item.permalink || null,
      thumbnail_url: item.thumbnail_url || null,
      media_url: item.media_url || null,
      published_at: item.timestamp || null,
      like_count: numeric(item.like_count || insights.likes),
      comments_count: numeric(item.comments_count || insights.comments),
      reach: numeric(insights.reach),
      views: numeric(insights.views),
      total_interactions: numeric(insights.total_interactions),
      saved: numeric(insights.saved),
      shares: numeric(insights.shares),
      raw: { ...item, insights },
      last_synced_at: now,
      updated_at: now,
    }
  })

  if (mediaRows.length > 0) {
    const { error: mediaError } = await supabase
      .from('organic_social_media')
      .upsert(mediaRows, { onConflict: 'platform,external_id' })

    if (mediaError) throw new Error(mediaError.message)
  }

  const cached = await getCachedInstagramOrganic(limit)
  const totals = cached?.totals || buildTotals(storedProfile as CachedProfile, [])
  const today = new Date().toISOString().slice(0, 10)

  await supabase
    .from('organic_social_daily_snapshots')
    .upsert({
      profile_id: storedProfile.id,
      platform: PLATFORM,
      snapshot_date: today,
      followers_count: totals.followers,
      media_count: totals.media,
      reach: totals.reach,
      views: totals.views,
      total_interactions: totals.totalInteractions,
      likes: totals.likes,
      comments: totals.comments,
      saved: totals.saved,
      shares: totals.shares,
      raw: { source: 'recent_media_cache', media_limit: limit },
      updated_at: now,
    }, { onConflict: 'profile_id,snapshot_date' })

  await Promise.all([
    saveAppConfig(supabase, 'organic_social_sync_last_run_at', now),
    saveAppConfig(supabase, 'organic_social_sync_last_started_at', now),
    saveAppConfig(supabase, 'organic_social_sync_last_error', ''),
    saveAppConfig(supabase, 'organic_social_sync_last_error_at', ''),
  ]).catch(error => {
    console.warn('[organic-social-sync] Nao foi possivel atualizar status do Instagram:', error)
  })

  return {
    profile: storedProfile as CachedProfile,
    media: cached?.media || [],
    reels: cached?.reels || [],
    totals,
    cached: false,
    stale: false,
    syncedAt: now,
  }
}
