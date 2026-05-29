import { createAdminClient } from '@/lib/supabase/server'
import { saveAppConfig } from '@/lib/admin/app-config'

const META_API_VERSION = 'v21.0'
const PLATFORM = 'facebook'
const CACHE_TTL_MS = 60 * 60 * 1000

type SupabaseAdmin = ReturnType<typeof createAdminClient>

type MetaConfig = {
  accessToken: string
  adAccountId?: string
  businessId?: string
  facebookPageId?: string
  facebookPageAccessToken?: string
}

type GraphList<T> = {
  data?: T[]
  paging?: { next?: string }
  error?: { message?: string; code?: number; type?: string }
}

type FacebookPage = {
  id: string
  name?: string
  username?: string
  fan_count?: number
  followers_count?: number
  picture?: { data?: { url?: string } }
  link?: string
  category?: string
  access_token?: string
}

type FacebookPost = {
  id: string
  message?: string
  created_time?: string
  permalink_url?: string
  full_picture?: string
  attachments?: {
    data?: Array<{
      media?: { image?: { src?: string } }
      type?: string
      url?: string
      title?: string
      description?: string
    }>
  }
  shares?: { count?: number }
  comments?: { summary?: { total_count?: number } }
  reactions?: { summary?: { total_count?: number } }
  insights?: {
    data?: Array<{
      name: string
      values?: Array<{ value?: number | string }>
    }>
  }
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

export type FacebookOrganicPayload = {
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
  warning?: string
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
      'meta_facebook_page_id',
      'facebook_page_access_token',
    ])

  const rows = (data || []) as Array<{ key: string; value: string }>
  const config = rows.reduce<Record<string, string>>((acc, row) => {
    acc[row.key] = row.value
    return acc
  }, {})

  const accessToken = config.meta_access_token || process.env.META_ACCESS_TOKEN
  if (!accessToken) throw new Error('Token da Meta nao configurado.')

  const adAccount = config.meta_ad_account_id || process.env.META_AD_ACCOUNT_ID

  return {
    accessToken,
    adAccountId: adAccount ? (adAccount.startsWith('act_') ? adAccount : `act_${adAccount}`) : undefined,
    businessId: config.meta_business_id || process.env.META_BUSINESS_ID,
    facebookPageId: config.meta_facebook_page_id || process.env.META_FACEBOOK_PAGE_ID,
    facebookPageAccessToken: config.facebook_page_access_token || process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
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

  if (!account.business?.id) throw new Error('Nao foi possivel encontrar o Business ID pela conta de anuncios.')
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

async function resolveFacebookPage(config: MetaConfig): Promise<FacebookPage> {
  const fields = 'id,name,username,fan_count,followers_count,picture{url},link,category,access_token'

  if (config.facebookPageId) {
    const page = await graphGet<FacebookPage>(`/${config.facebookPageId}`, { fields }, config.facebookPageAccessToken || config.accessToken)
    return {
      ...page,
      access_token: config.facebookPageAccessToken || page.access_token,
    }
  }

  const businessId = await getBusinessId(config)
  const pages = await listAll<FacebookPage>(
    `/${businessId}/owned_pages`,
    { fields, limit: 100 },
    config.accessToken,
  )

  const guilhermePage = pages.find(page => String(page.username || '').toLowerCase() === 'guilherme.pilger')
    || pages.find(page => String(page.name || '').toLowerCase().includes('guilherme pilger'))
  const biggestPage = [...pages].sort((a, b) => numeric(b.followers_count || b.fan_count) - numeric(a.followers_count || a.fan_count))[0]
  const selected = guilhermePage || biggestPage

  if (!selected) throw new Error('Nenhuma pagina do Facebook encontrada no Business Manager.')
  if (!selected.access_token) {
    const withToken = await graphGet<FacebookPage>(`/${selected.id}`, { fields }, config.accessToken)
    return withToken
  }

  return selected
}

function mapInsights(post: FacebookPost) {
  const values = (post.insights?.data || []).reduce<Record<string, number>>((acc, insight) => {
    acc[insight.name] = numeric(insight.values?.[0]?.value)
    return acc
  }, {})

  return {
    reach: values.post_impressions_unique || 0,
    views: values.post_video_views || 0,
    totalInteractions: values.post_clicks || 0,
  }
}

async function fetchPosts(page: FacebookPage, limit: number, userAccessToken: string) {
  const accessToken = page.access_token || userAccessToken
  const basicFields = 'id,message,created_time,permalink_url,full_picture,attachments{media,type,url,title,description}'
  const insightFields = `${basicFields},shares,comments.summary(true),reactions.summary(true),insights.metric(post_impressions_unique,post_clicks,post_video_views)`
  const safeLimit = Math.min(Math.max(limit, 1), 50)

  try {
    const payload = await graphGet<GraphList<FacebookPost>>(
      `/${page.id}/posts`,
      { fields: insightFields, limit: safeLimit },
      accessToken,
    )
    return { posts: payload.data || [], warning: null as string | null }
  } catch (error) {
    const payload = await graphGet<GraphList<FacebookPost>>(
      `/${page.id}/posts`,
      { fields: basicFields, limit: safeLimit },
      accessToken,
    )
    const message = error instanceof Error ? error.message : 'Insights do Facebook indisponiveis.'
    return { posts: payload.data || [], warning: message }
  }
}

function postImage(post: FacebookPost) {
  return post.full_picture
    || post.attachments?.data?.[0]?.media?.image?.src
    || null
}

export async function getCachedFacebookOrganic(limit = 12): Promise<FacebookOrganicPayload | null> {
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
    reels: rows.filter(row => String(row.permalink || '').includes('/reel/')),
    totals: buildTotals(profile as CachedProfile, rows),
    cached: true,
    stale: profile.last_synced_at ? Date.now() - new Date(profile.last_synced_at).getTime() > CACHE_TTL_MS : true,
    syncedAt: profile.last_synced_at,
  }
}

export async function isFacebookCacheFresh() {
  const cached = await getCachedFacebookOrganic(1)
  return Boolean(cached?.profile?.last_synced_at && !cached.stale)
}

export async function syncFacebookOrganic(limit = 12): Promise<FacebookOrganicPayload> {
  const supabase = createAdminClient() as SupabaseAdmin
  const config = await readMetaConfig()
  const page = await resolveFacebookPage(config)
  const now = new Date().toISOString()
  const { posts, warning } = await fetchPosts(page, limit, config.accessToken)

  const { data: storedProfile, error: profileError } = await supabase
    .from('organic_social_profiles')
    .upsert({
      platform: PLATFORM,
      external_id: page.id,
      username: page.username || null,
      display_name: page.name || page.username || null,
      profile_picture_url: page.picture?.data?.url || null,
      followers_count: numeric(page.followers_count || page.fan_count),
      media_count: posts.length,
      raw: {
        id: page.id,
        name: page.name,
        username: page.username,
        fan_count: page.fan_count,
        followers_count: page.followers_count,
        link: page.link,
        category: page.category,
      },
      last_synced_at: now,
      updated_at: now,
    }, { onConflict: 'platform,external_id' })
    .select('id, platform, external_id, username, display_name, profile_picture_url, followers_count, media_count, last_synced_at')
    .single()

  if (profileError || !storedProfile) {
    throw new Error(profileError?.message || 'Nao foi possivel salvar a pagina do Facebook.')
  }

  const mediaRows = posts.map(post => {
    const insights = mapInsights(post)
    const attachment = post.attachments?.data?.[0]

    return {
      profile_id: storedProfile.id,
      platform: PLATFORM,
      external_id: post.id,
      media_type: attachment?.type || 'post',
      media_product_type: String(post.permalink_url || '').includes('/reel/') ? 'REELS' : 'POST',
      caption: cleanCaption(post.message || attachment?.title || attachment?.description),
      permalink: post.permalink_url || attachment?.url || null,
      thumbnail_url: postImage(post),
      media_url: attachment?.url || post.permalink_url || null,
      published_at: post.created_time || null,
      like_count: numeric(post.reactions?.summary?.total_count),
      comments_count: numeric(post.comments?.summary?.total_count),
      reach: insights.reach,
      views: insights.views,
      total_interactions: insights.totalInteractions || numeric(post.reactions?.summary?.total_count) + numeric(post.comments?.summary?.total_count),
      saved: 0,
      shares: numeric(post.shares?.count),
      raw: post,
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

  const cached = await getCachedFacebookOrganic(limit)
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
      raw: { source: 'facebook_page_posts_cache', media_limit: limit, warning },
      updated_at: now,
    }, { onConflict: 'profile_id,snapshot_date' })

  await Promise.all([
    saveAppConfig(supabase, 'organic_social_sync_last_run_at', now),
    saveAppConfig(supabase, 'organic_social_sync_last_started_at', now),
    saveAppConfig(supabase, 'organic_social_sync_last_error', ''),
    saveAppConfig(supabase, 'organic_social_sync_last_error_at', ''),
  ]).catch(error => {
    console.warn('[organic-social-sync] Nao foi possivel atualizar status do Facebook:', error)
  })

  return {
    profile: storedProfile as CachedProfile,
    media: cached?.media || [],
    reels: cached?.reels || [],
    totals,
    cached: false,
    stale: false,
    syncedAt: now,
    warning: warning || undefined,
  }
}
