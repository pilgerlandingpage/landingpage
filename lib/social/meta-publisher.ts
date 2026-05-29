import { createAdminClient } from '@/lib/supabase/server'

const META_API_VERSION = 'v21.0'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

type ScheduledPostRow = {
  id: string
  platform: string
  status: string
  caption: string | null
  ai_context: string | null
  scheduled_for: string | null
  marketing_creatives?: {
    id: string
    title: string
    asset_url: string | null
    thumbnail_url: string | null
    asset_type: string
    content_type: string
  } | Array<{
    id: string
    title: string
    asset_url: string | null
    thumbnail_url: string | null
    asset_type: string
    content_type: string
  }> | null
}

type PublishResult = {
  published: boolean
  platform: string
  external_id?: string
  permalink?: string
  dry_run?: boolean
  reason?: string
}

function getBaseUrl() {
  return `https://graph.facebook.com/${META_API_VERSION}`
}

function normalizeCreative(value: ScheduledPostRow['marketing_creatives']) {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function firstText(...values: Array<string | null | undefined>) {
  return values.map(value => String(value || '').trim()).find(Boolean) || ''
}

async function readConfigs(supabase: SupabaseAdmin) {
  const { data } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', [
      'meta_facebook_page_id',
      'facebook_page_access_token',
      'instagram_business_account_id',
      'instagram_business_access_token',
      'marketing_publisher_agent_enabled',
      'marketing_publisher_autopilot',
    ])

  const configs = Object.fromEntries((data || []).map((row: { key: string; value: string | null }) => [row.key, String(row.value || '')]))
  return {
    facebookPageId: configs.meta_facebook_page_id || process.env.META_FACEBOOK_PAGE_ID || '',
    facebookPageToken: configs.facebook_page_access_token || process.env.FACEBOOK_PAGE_ACCESS_TOKEN || '',
    instagramAccountId: configs.instagram_business_account_id || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '',
    instagramToken: configs.instagram_business_access_token || process.env.INSTAGRAM_BUSINESS_ACCESS_TOKEN || '',
    publisherEnabled: configs.marketing_publisher_agent_enabled !== 'false',
    autopilot: configs.marketing_publisher_autopilot === 'true',
  }
}

async function graphPost<T>(path: string, params: Record<string, string>) {
  const url = new URL(`${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`)
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
    cache: 'no-store',
  })
  const payload = await response.json()
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || `Erro Meta Graph ${response.status}`)
  }
  return payload as T
}

async function publishFacebook(post: ScheduledPostRow, accessToken: string, pageId: string) {
  const creative = normalizeCreative(post.marketing_creatives)
  const message = firstText(post.caption, post.ai_context, creative?.title)
  const assetUrl = firstText(creative?.asset_url, creative?.thumbnail_url)

  if (!pageId || !accessToken) throw new Error('Facebook Page ID ou Page Access Token nao configurado.')
  if (!message && !assetUrl) throw new Error('Informe legenda ou URL de midia para publicar no Facebook.')

  const result = await graphPost<{ id?: string; post_id?: string }>(`/${pageId}/feed`, {
    message,
    ...(assetUrl ? { link: assetUrl } : {}),
    access_token: accessToken,
  })

  return {
    external_id: result.post_id || result.id || '',
    permalink: result.id ? `https://www.facebook.com/${result.id}` : '',
  }
}

async function publishInstagram(post: ScheduledPostRow, accessToken: string, accountId: string) {
  const creative = normalizeCreative(post.marketing_creatives)
  const caption = firstText(post.caption, post.ai_context, creative?.title)
  const assetUrl = firstText(creative?.asset_url, creative?.thumbnail_url)
  const isVideo = creative?.asset_type === 'video'

  if (!accountId || !accessToken) throw new Error('Instagram Business ID ou Access Token nao configurado.')
  if (!assetUrl) throw new Error('Instagram exige uma URL publica de imagem ou video.')

  const createResult = await graphPost<{ id?: string }>(`/${accountId}/media`, {
    ...(isVideo ? { media_type: 'REELS', video_url: assetUrl } : { image_url: assetUrl }),
    caption,
    access_token: accessToken,
  })

  if (!createResult.id) throw new Error('Instagram nao retornou o container de publicacao.')

  const publishResult = await graphPost<{ id?: string }>(`/${accountId}/media_publish`, {
    creation_id: createResult.id,
    access_token: accessToken,
  })

  return {
    external_id: publishResult.id || createResult.id,
    permalink: publishResult.id ? `https://www.instagram.com/p/${publishResult.id}` : '',
  }
}

export async function publishScheduledPost(postId: string, options: { dryRun?: boolean } = {}): Promise<PublishResult> {
  const supabase = createAdminClient()
  const { data: post, error } = await supabase
    .from('marketing_scheduled_posts')
    .select(`
      id,
      platform,
      status,
      caption,
      ai_context,
      scheduled_for,
      marketing_creatives (
        id,
        title,
        asset_url,
        thumbnail_url,
        asset_type,
        content_type
      )
    `)
    .eq('id', postId)
    .single()

  if (error || !post) throw new Error(error?.message || 'Agendamento nao encontrado.')

  const row = post as ScheduledPostRow
  if (!['approved', 'scheduled'].includes(row.status)) {
    return { published: false, platform: row.platform, reason: `status_${row.status}` }
  }

  if (options.dryRun) {
    return { published: false, platform: row.platform, dry_run: true, reason: 'dry_run' }
  }

  const configs = await readConfigs(supabase)
  if (!configs.publisherEnabled) {
    return { published: false, platform: row.platform, reason: 'publisher_disabled' }
  }
  if (!configs.autopilot) {
    return { published: false, platform: row.platform, reason: 'autopilot_disabled' }
  }

  await supabase
    .from('marketing_scheduled_posts')
    .update({ status: 'publishing', updated_at: new Date().toISOString(), error_message: null })
    .eq('id', row.id)

  try {
    const result = row.platform === 'facebook'
      ? await publishFacebook(row, configs.facebookPageToken, configs.facebookPageId)
      : row.platform === 'instagram'
        ? await publishInstagram(row, configs.instagramToken, configs.instagramAccountId)
        : (() => {
            throw new Error(`Publicacao automatica para ${row.platform} ainda nao conectada.`)
          })()

    const now = new Date().toISOString()
    await supabase
      .from('marketing_scheduled_posts')
      .update({
        status: 'published',
        published_at: now,
        updated_at: now,
        external_id: result.external_id || null,
        permalink: result.permalink || null,
        error_message: null,
      })
      .eq('id', row.id)

    return { published: true, platform: row.platform, ...result }
  } catch (publishError) {
    await supabase
      .from('marketing_scheduled_posts')
      .update({
        status: 'failed',
        error_message: publishError instanceof Error ? publishError.message : 'Falha ao publicar.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    throw publishError
  }
}

export async function publishDueScheduledPosts(options: { limit?: number; dryRun?: boolean } = {}) {
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const limit = Math.min(Math.max(Math.trunc(options.limit || 10), 1), 30)
  const { data, error } = await supabase
    .from('marketing_scheduled_posts')
    .select('id, platform, status, scheduled_for')
    .in('status', ['approved', 'scheduled'])
    .not('scheduled_for', 'is', null)
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message)

  const results: PublishResult[] = []
  for (const item of data || []) {
    try {
      results.push(await publishScheduledPost(item.id, { dryRun: options.dryRun }))
    } catch (error) {
      results.push({
        published: false,
        platform: item.platform,
        reason: error instanceof Error ? error.message : 'publish_failed',
      })
    }
  }

  return { checked: data?.length || 0, results }
}
