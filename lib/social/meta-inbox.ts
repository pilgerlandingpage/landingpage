import { createAdminClient } from '@/lib/supabase/server'
import { syncFacebookOrganic } from '@/lib/social/facebook'
import { syncInstagramOrganic } from '@/lib/social/instagram'

const META_API_VERSION = 'v21.0'

type PlatformKey = 'instagram' | 'facebook'
type SupabaseAdmin = ReturnType<typeof createAdminClient>

type MetaConfig = {
  accessToken: string
  adAccountId?: string
  businessId?: string
  instagramAccountId?: string
  instagramAccessToken?: string
  instagramLoginAccountId?: string
  instagramLoginAccessToken?: string
  facebookPageId?: string
  facebookPageAccessToken?: string
}

type GraphList<T> = {
  data?: T[]
  paging?: { next?: string }
  error?: { message?: string; code?: number; type?: string }
}

type MetaProfile = {
  id: string
  username?: string
  name?: string
  access_token?: string
  instagram_business_account?: MetaProfile
}

type CachedProfile = {
  id: string
  platform: PlatformKey
  external_id: string
}

type CachedMedia = {
  id: string
  profile_id: string
  platform: PlatformKey
  external_id: string
}

type MetaComment = {
  id: string
  text?: string
  message?: string
  timestamp?: string
  created_time?: string
  username?: string
  from?: { id?: string; name?: string }
  like_count?: number
  comment_count?: number
  permalink_url?: string
  replies?: { data?: MetaComment[] }
  comments?: { data?: MetaComment[] }
}

type MetaConversation = {
  id: string
  updated_time?: string
  unread_count?: number
  participants?: { data?: Array<{ id?: string; name?: string; username?: string; email?: string }> }
  messages?: { data?: MetaMessage[] }
}

type MetaMessage = {
  id: string
  created_time?: string
  from?: { id?: string; name?: string; username?: string; email?: string }
  to?: { data?: Array<{ id?: string; name?: string; username?: string; email?: string }> }
  message?: string
  attachments?: {
    data?: Array<{
      mime_type?: string
      name?: string
      image_data?: { url?: string }
      video_data?: { url?: string }
      file_url?: string
    }>
  }
  shares?: { data?: Array<{ link?: string; name?: string }> }
  sticker?: string
}

export type MetaInboxSyncResult = {
  success: true
  comments: number
  threads: number
  messages: number
  warnings: string[]
}

function getBaseUrl() {
  return `https://graph.facebook.com/${META_API_VERSION}`
}

function numeric(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function truncate(value: string | undefined | null, max = 3000) {
  if (!value) return null
  return value.length > max ? `${value.slice(0, max - 3)}...` : value
}

function messageText(message: MetaMessage) {
  return truncate(
    message.message
      || message.shares?.data?.[0]?.name
      || message.shares?.data?.[0]?.link
      || message.sticker
      || null,
  )
}

function firstAttachment(message: MetaMessage) {
  const attachment = message.attachments?.data?.[0]
  if (!attachment) return { type: null as string | null, url: null as string | null }

  return {
    type: attachment.mime_type || attachment.name || 'attachment',
    url: attachment.image_data?.url || attachment.video_data?.url || attachment.file_url || null,
  }
}

function metaErrorMessage(platform: PlatformKey, error: unknown) {
  const message = error instanceof Error ? error.message : 'Erro ao sincronizar com a Meta.'

  if (
    platform === 'instagram'
    && message.toLowerCase().includes('application does not have the capability')
  ) {
    return 'Direct do Instagram nao sincronizado: o app Meta ainda nao tem a permissao/capability Instagram Messaging. Comentarios do Instagram continuam funcionando.'
  }

  if (message.toLowerCase().includes('cannot parse access token')) {
    return 'Token Meta invalido para Facebook Graph. Verifique meta_access_token ou facebook_page_access_token.'
  }

  return message
}

async function diagnoseInstagramDirectAccess(config: MetaConfig, fallback: string) {
  if (!config.instagramLoginAccountId || !config.instagramLoginAccessToken) return fallback

  try {
    const url = new URL(`https://graph.instagram.com/${META_API_VERSION}/${config.instagramLoginAccountId}`)
    url.searchParams.set('fields', 'id,username')
    url.searchParams.set('access_token', config.instagramLoginAccessToken)
    const response = await fetch(url.toString(), { cache: 'no-store' })
    const payload = await response.json()
    if (response.ok && !payload?.error) return fallback

    const message = String(payload?.error?.message || payload?.error_message || 'Token Instagram Login invalido.')
    if (message.toLowerCase().includes('expired') || message.toLowerCase().includes('validating access token')) {
      return 'Direct do Instagram nao sincronizado: o token do Instagram Login expirou. Reconecte o Instagram na Sala de Manutencao para gerar um token valido.'
    }

    return `Direct do Instagram nao sincronizado: Instagram Login nao esta valido (${message}).`
  } catch {
    return fallback
  }
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
      'instagram_business_account_id',
      'instagram_business_access_token',
      'meta_facebook_page_id',
      'facebook_page_access_token',
    ])

  const rows = (data || []) as Array<{ key: string; value: string }>
  const config = rows.reduce<Record<string, string>>((acc, row) => {
    acc[row.key] = row.value
    return acc
  }, {})

  // This module talks to graph.facebook.com. Instagram Login tokens (IGAA/IGQ...)
  // belong to graph.instagram.com and make Facebook Graph return "Cannot parse access token".
  const accessToken = config.meta_access_token
    || process.env.META_ACCESS_TOKEN
    || config.facebook_page_access_token
    || process.env.FACEBOOK_PAGE_ACCESS_TOKEN
  if (!accessToken) throw new Error('Token da Meta nao configurado.')

  const adAccount = config.meta_ad_account_id || process.env.META_AD_ACCOUNT_ID
  const facebookPageAccessToken = config.facebook_page_access_token || process.env.FACEBOOK_PAGE_ACCESS_TOKEN

  return {
    accessToken,
    adAccountId: adAccount ? (adAccount.startsWith('act_') ? adAccount : `act_${adAccount}`) : undefined,
    businessId: config.meta_business_id || process.env.META_BUSINESS_ID,
    instagramAccountId: config.meta_instagram_account_id
      || process.env.META_INSTAGRAM_ACCOUNT_ID
      || config.instagram_business_account_id
      || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
    instagramAccessToken: accessToken,
    instagramLoginAccountId: config.instagram_business_account_id || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
    instagramLoginAccessToken: config.instagram_business_access_token || process.env.INSTAGRAM_BUSINESS_ACCESS_TOKEN,
    facebookPageId: config.meta_facebook_page_id || process.env.META_FACEBOOK_PAGE_ID,
    facebookPageAccessToken,
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

async function listAll<T>(path: string, params: Record<string, string | number | undefined>, accessToken: string, maxPages = 3) {
  const items: T[] = []
  let nextUrl: string | undefined
  let pages = 0

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
    pages += 1
  } while (nextUrl && pages < maxPages)

  return items
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

async function resolveFacebookPage(config: MetaConfig) {
  const fields = 'id,name,username,access_token,instagram_business_account{id,username,name}'

  if (config.facebookPageId) {
    const page = await graphGet<MetaProfile>(`/${config.facebookPageId}`, { fields }, config.facebookPageAccessToken || config.accessToken)
    return {
      ...page,
      access_token: config.facebookPageAccessToken || page.access_token,
    }
  }

  const businessId = await getBusinessId(config)
  const pages = await listAll<MetaProfile>(`/${businessId}/owned_pages`, { fields, limit: 100 }, config.accessToken)
  const selected = pages.find(page => String(page.username || '').toLowerCase() === 'guilherme.pilger')
    || pages.find(page => String(page.name || '').toLowerCase().includes('guilherme pilger'))
    || pages[0]

  if (!selected) throw new Error('Nenhuma pagina do Facebook encontrada no Business Manager.')
  return selected
}

async function resolveInstagramProfile(config: MetaConfig) {
  if (config.instagramAccountId) {
    return graphGet<MetaProfile>(
      `/${config.instagramAccountId}`,
      { fields: 'id,username,name' },
      config.instagramAccessToken || config.accessToken,
    )
  }

  const page = await resolveFacebookPage(config)
  if (page.instagram_business_account?.id) return page.instagram_business_account

  const businessId = await getBusinessId(config)
  const accounts = await listAll<MetaProfile>(
    `/${businessId}/owned_instagram_accounts`,
    { fields: 'id,username,name', limit: 100 },
    config.accessToken,
  )
  const selected = accounts.find(account => String(account.username || '').toLowerCase().includes('guilherme')) || accounts[0]
  if (!selected) throw new Error('Nenhuma conta Instagram Business encontrada no Business Manager.')
  return selected
}

async function ensureCachedSocialProfiles(supabase: SupabaseAdmin) {
  const { data } = await supabase
    .from('organic_social_profiles')
    .select('id, platform, external_id')
    .in('platform', ['instagram', 'facebook'])

  const profiles = (data || []) as CachedProfile[]
  const hasInstagram = profiles.some(profile => profile.platform === 'instagram')
  const hasFacebook = profiles.some(profile => profile.platform === 'facebook')

  if (!hasInstagram) await syncInstagramOrganic(12)
  if (!hasFacebook) await syncFacebookOrganic(12)

  const { data: fresh } = await supabase
    .from('organic_social_profiles')
    .select('id, platform, external_id')
    .in('platform', ['instagram', 'facebook'])

  return (fresh || []) as CachedProfile[]
}

async function getRecentMedia(supabase: SupabaseAdmin, platform: PlatformKey, limit: number) {
  const { data } = await supabase
    .from('organic_social_media')
    .select('id, profile_id, platform, external_id')
    .eq('platform', platform)
    .order('published_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50))

  return (data || []) as CachedMedia[]
}

function mapCommentRows(platform: PlatformKey, media: CachedMedia, comments: MetaComment[], parentExternalId?: string) {
  return comments.map(comment => ({
    platform,
    external_id: comment.id,
    profile_id: media.profile_id,
    media_id: media.id,
    media_external_id: media.external_id,
    parent_external_id: parentExternalId || null,
    author_id: comment.from?.id || null,
    author_name: comment.username || comment.from?.name || null,
    message: truncate(comment.text || comment.message),
    like_count: numeric(comment.like_count),
    reply_count: numeric(comment.comment_count || comment.replies?.data?.length || comment.comments?.data?.length),
    permalink: comment.permalink_url || null,
    commented_at: comment.timestamp || comment.created_time || null,
    raw: comment,
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))
}

async function upsertComments(supabase: SupabaseAdmin, platform: PlatformKey, media: CachedMedia, comments: MetaComment[]) {
  const rows = comments.flatMap(comment => [
    ...mapCommentRows(platform, media, [comment]),
    ...mapCommentRows(platform, media, comment.replies?.data || comment.comments?.data || [], comment.id),
  ])

  if (rows.length === 0) return 0

  const { error } = await supabase
    .from('meta_social_comments')
    .upsert(rows, { onConflict: 'platform,external_id' })

  if (error) throw new Error(error.message)
  return rows.length
}

async function syncCommentsForPlatform(
  supabase: SupabaseAdmin,
  config: MetaConfig,
  platform: PlatformKey,
  mediaLimit: number,
  commentsPerMedia: number,
) {
  const mediaRows = await getRecentMedia(supabase, platform, mediaLimit)
  const accessToken = platform === 'facebook'
    ? (await resolveFacebookPage(config)).access_token || config.accessToken
    : config.instagramAccessToken || config.accessToken
  let total = 0
  const warnings: string[] = []

  for (const media of mediaRows) {
    try {
      const fields = platform === 'instagram'
        ? 'id,text,timestamp,username,like_count,replies.limit(25){id,text,timestamp,username,like_count}'
        : 'id,message,created_time,from,like_count,comment_count,permalink_url,comments.limit(25){id,message,created_time,from,like_count,comment_count,permalink_url}'
      const comments = await listAll<MetaComment>(
        `/${media.external_id}/comments`,
        { fields, limit: Math.min(Math.max(commentsPerMedia, 1), 100), order: 'reverse_chronological' },
        accessToken,
        2,
      )
      total += await upsertComments(supabase, platform, media, comments)
    } catch (error) {
      warnings.push(`${platform}:${media.external_id}: ${metaErrorMessage(platform, error)}`)
    }
  }

  return { total, warnings }
}

function participantName(person?: { name?: string; username?: string; email?: string }) {
  return person?.name || person?.username || person?.email || null
}

function buildThreadParticipant(conversation: MetaConversation, ownedIds: Set<string>) {
  const participants = conversation.participants?.data || []
  return participants.find(person => person.id && !ownedIds.has(person.id)) || participants[0] || null
}

async function upsertConversation(
  supabase: SupabaseAdmin,
  platform: PlatformKey,
  profile: CachedProfile | undefined,
  conversation: MetaConversation,
  ownedIds: Set<string>,
) {
  const participant = buildThreadParticipant(conversation, ownedIds)
  const { data, error } = await supabase
    .from('meta_social_threads')
    .upsert({
      platform,
      external_id: conversation.id,
      thread_type: 'direct',
      profile_id: profile?.id || null,
      participant_id: participant?.id || null,
      participant_name: participantName(participant || undefined),
      unread_count: numeric(conversation.unread_count),
      last_message_at: conversation.updated_time || null,
      raw: conversation,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'platform,external_id' })
    .select('id')
    .single()

  if (error || !data) throw new Error(error?.message || 'Nao foi possivel salvar conversa Meta.')
  return data.id as string
}

async function upsertConversationMessages(
  supabase: SupabaseAdmin,
  platform: PlatformKey,
  threadId: string,
  messages: MetaMessage[],
  ownedIds: Set<string>,
) {
  const rows = messages.map(message => {
    const to = message.to?.data?.[0]
    const attachment = firstAttachment(message)
    const fromOwned = Boolean(message.from?.id && ownedIds.has(message.from.id))

    return {
      thread_id: threadId,
      platform,
      external_id: message.id,
      sender_id: message.from?.id || null,
      sender_name: participantName(message.from),
      recipient_id: to?.id || null,
      recipient_name: participantName(to),
      direction: fromOwned ? 'outbound' : 'inbound',
      message: messageText(message),
      attachment_type: attachment.type,
      attachment_url: attachment.url,
      sent_at: message.created_time || null,
      raw: message,
      updated_at: new Date().toISOString(),
    }
  })

  if (rows.length === 0) return 0

  const { error } = await supabase
    .from('meta_social_messages')
    .upsert(rows, { onConflict: 'platform,external_id' })

  if (error) throw new Error(error.message)
  return rows.length
}

async function syncConversationsForPlatform(
  supabase: SupabaseAdmin,
  config: MetaConfig,
  platform: PlatformKey,
  profiles: CachedProfile[],
  conversationLimit: number,
) {
  const warnings: string[] = []
  let threadCount = 0
  let messageCount = 0

  try {
    const facebookPage = await resolveFacebookPage(config)
    const pageToken = facebookPage.access_token || config.accessToken
    const instagramProfile = platform === 'instagram' ? await resolveInstagramProfile(config) : null
    const profile = profiles.find(item => item.platform === platform)
    const ownedIds = new Set([facebookPage.id, instagramProfile?.id, profile?.external_id].filter(Boolean) as string[])
    const messageLimit = platform === 'instagram' ? 8 : 25
    const fields = `id,updated_time,unread_count,participants,messages.limit(${messageLimit}){id,created_time,from,to,message,attachments,shares,sticker}`
    const attempts = platform === 'instagram'
      ? [
          { path: `/${facebookPage.id}/conversations`, params: { fields, limit: conversationLimit, platform: 'instagram' } },
          { path: `/${instagramProfile?.id}/conversations`, params: { fields, limit: conversationLimit, platform: 'instagram' } },
        ]
      : [
          { path: `/${facebookPage.id}/conversations`, params: { fields, limit: conversationLimit } },
        ]

    let conversations: MetaConversation[] = []
    let lastError: unknown

    for (const attempt of attempts) {
      try {
        conversations = await listAll<MetaConversation>(
          attempt.path,
          attempt.params,
          pageToken,
          2,
        )
        lastError = null
        break
      } catch (error) {
        lastError = error
      }
    }

    if (lastError) throw lastError

    for (const conversation of conversations) {
      const threadId = await upsertConversation(supabase, platform, profile, conversation, ownedIds)
      threadCount += 1
      messageCount += await upsertConversationMessages(supabase, platform, threadId, conversation.messages?.data || [], ownedIds)
    }
  } catch (error) {
    const message = platform === 'instagram'
      ? await diagnoseInstagramDirectAccess(config, metaErrorMessage(platform, error))
      : metaErrorMessage(platform, error)
    warnings.push(`${platform}: ${message}`)
  }

  return { threadCount, messageCount, warnings }
}

export async function syncMetaSocialInbox({
  platform = 'all',
  scope = 'all',
  mediaLimit = 12,
  commentsPerMedia = 25,
  conversationLimit = 20,
}: {
  platform?: PlatformKey | 'all'
  scope?: 'all' | 'comments' | 'messages'
  mediaLimit?: number
  commentsPerMedia?: number
  conversationLimit?: number
} = {}): Promise<MetaInboxSyncResult> {
  const supabase = createAdminClient() as SupabaseAdmin
  const config = await readMetaConfig()
  const profiles = await ensureCachedSocialProfiles(supabase)
  const platforms: PlatformKey[] = platform === 'all' ? ['instagram', 'facebook'] : [platform]
  const warnings: string[] = []
  let comments = 0
  let threads = 0
  let messages = 0

  for (const target of platforms) {
    if (scope === 'all' || scope === 'comments') {
      const result = await syncCommentsForPlatform(supabase, config, target, mediaLimit, commentsPerMedia)
      comments += result.total
      warnings.push(...result.warnings)
    }

    if (scope === 'all' || scope === 'messages') {
      const result = await syncConversationsForPlatform(supabase, config, target, profiles, conversationLimit)
      threads += result.threadCount
      messages += result.messageCount
      warnings.push(...result.warnings)
    }
  }

  return {
    success: true,
    comments,
    threads,
    messages,
    warnings,
  }
}

export async function listMetaSocialInbox({
  platform,
  limit = 50,
}: {
  platform?: PlatformKey
  limit?: number
} = {}) {
  const supabase = createAdminClient()
  const safeLimit = Math.min(Math.max(limit, 1), 100)

  let threadQuery = supabase
    .from('meta_social_threads')
    .select('id, platform, external_id, participant_id, participant_name, status, unread_count, last_message_at, updated_at')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(safeLimit)

  let commentQuery = supabase
    .from('meta_social_comments')
    .select('id, platform, external_id, media_external_id, parent_external_id, author_name, message, like_count, reply_count, permalink, commented_at')
    .order('commented_at', { ascending: false, nullsFirst: false })
    .limit(safeLimit)

  if (platform) {
    threadQuery = threadQuery.eq('platform', platform)
    commentQuery = commentQuery.eq('platform', platform)
  }

  const [{ data: threads, error: threadError }, { data: comments, error: commentError }] = await Promise.all([
    threadQuery,
    commentQuery,
  ])

  if (threadError) throw new Error(threadError.message)
  if (commentError) throw new Error(commentError.message)

  const threadIds = ((threads || []) as Array<{ id: string }>).map(thread => thread.id)
  const { data: messages, error: messageError } = threadIds.length > 0
    ? await supabase
        .from('meta_social_messages')
        .select('id, thread_id, platform, external_id, sender_name, direction, message, attachment_type, attachment_url, sent_at')
        .in('thread_id', threadIds)
        .order('sent_at', { ascending: false, nullsFirst: false })
        .limit(safeLimit * 5)
    : { data: [], error: null }

  if (messageError) throw new Error(messageError.message)

  return {
    threads: threads || [],
    messages: messages || [],
    comments: comments || [],
  }
}

export async function saveMetaWebhookEvent(payload: unknown, platform?: string, eventType?: string, externalId?: string) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('meta_social_webhook_events')
    .insert({
      platform: platform || null,
      event_type: eventType || null,
      external_id: externalId || null,
      payload,
      processed_at: new Date().toISOString(),
    })

  if (error) throw new Error(error.message)
}
