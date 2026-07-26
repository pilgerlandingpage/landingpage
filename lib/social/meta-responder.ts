import { createAdminClient } from '@/lib/supabase/server'
import {
  getFacebookGraphBaseUrl,
  getInstagramGraphConnection,
  getInstagramGraphConnectionIssue,
  type InstagramGraphConnection,
} from '@/lib/social/instagram-connection'

type SupabaseAdmin = ReturnType<typeof createAdminClient>
type Platform = 'instagram' | 'facebook'

async function readConfigs(supabase: SupabaseAdmin) {
  const { data } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', [
      'meta_facebook_page_id',
      'meta_access_token',
      'meta_instagram_account_id',
      'facebook_page_access_token',
      'instagram_business_account_id',
      'instagram_business_access_token',
      'instagram_connected_at',
      'instagram_token_expires_at',
      'instagram_token_kind',
      'meta_social_agent_autopilot',
    ])

  const configs = Object.fromEntries((data || []).map((row: { key: string; value: string | null }) => [row.key, String(row.value || '')]))
  const instagramConnection = getInstagramGraphConnection(configs)
  return {
    facebookPageId: configs.meta_facebook_page_id || process.env.META_FACEBOOK_PAGE_ID || '',
    facebookPageToken: configs.facebook_page_access_token || process.env.FACEBOOK_PAGE_ACCESS_TOKEN || '',
    instagramConnection,
    instagramConnectionIssue: instagramConnection ? '' : getInstagramGraphConnectionIssue(configs),
    autopilot: configs.meta_social_agent_autopilot === 'true',
  }
}

async function graphPost<T>(baseUrl: string, path: string, params: Record<string, string>) {
  const response = await fetch(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
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

function getInstagramConnectionOrThrow(connection: InstagramGraphConnection | null, issue: string) {
  if (!connection) throw new Error(issue || 'Instagram Business ID ou Access Token nao configurado.')
  return connection
}

function cleanReply(value: unknown) {
  return String(value || '').trim().slice(0, 1800)
}

export async function approveSocialSuggestion(suggestionId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('meta_social_ai_suggestions')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', suggestionId)
    .select('id, status')
    .single()

  if (error || !data) throw new Error(error?.message || 'Sugestao nao encontrada.')
  return data
}

async function sendCommentReply(supabase: SupabaseAdmin, platform: Platform, sourceId: string, reply: string) {
  const { data: comment, error } = await supabase
    .from('meta_social_comments')
    .select('id, external_id, platform')
    .eq('id', sourceId)
    .single()

  if (error || !comment) throw new Error(error?.message || 'Comentario nao encontrado.')

  const configs = await readConfigs(supabase)
  const instagramConnection = platform === 'instagram'
    ? getInstagramConnectionOrThrow(configs.instagramConnection, configs.instagramConnectionIssue)
    : undefined
  const accessToken = instagramConnection?.accessToken || configs.facebookPageToken
  if (!accessToken) throw new Error(`Token de ${platform} nao configurado para responder comentarios.`)

  const endpoint = platform === 'instagram'
    ? `/${comment.external_id}/replies`
    : `/${comment.external_id}/comments`
  const baseUrl = instagramConnection?.baseUrl || getFacebookGraphBaseUrl()

  const result = await graphPost<{ id?: string }>(baseUrl, endpoint, {
    message: reply,
    access_token: accessToken,
  })

  return { external_id: result.id || '' }
}

async function sendThreadReply(supabase: SupabaseAdmin, platform: Platform, sourceId: string, reply: string) {
  const { data: thread, error } = await supabase
    .from('meta_social_threads')
    .select('id, external_id, platform, participant_id, participant_name')
    .eq('id', sourceId)
    .single()

  if (error || !thread) throw new Error(error?.message || 'Conversa nao encontrada.')
  if (!thread.participant_id) throw new Error('Conversa sem participant_id para resposta automatica.')

  const configs = await readConfigs(supabase)
  const instagramConnection = platform === 'instagram'
    ? getInstagramConnectionOrThrow(configs.instagramConnection, configs.instagramConnectionIssue)
    : undefined
  const accessToken = instagramConnection?.accessToken || configs.facebookPageToken
  if (!accessToken) throw new Error(`Token de ${platform} nao configurado para responder mensagens.`)

  const endpoint = instagramConnection
    ? `/${instagramConnection.accountId}/messages`
    : '/me/messages'
  const baseUrl = instagramConnection?.baseUrl || getFacebookGraphBaseUrl()

  const result = await graphPost<{ message_id?: string; recipient_id?: string }>(baseUrl, endpoint, {
    recipient: JSON.stringify({ id: thread.participant_id }),
    message: JSON.stringify({ text: reply }),
    access_token: accessToken,
  })

  const now = new Date().toISOString()
  await supabase
    .from('meta_social_messages')
    .insert({
      thread_id: thread.id,
      platform,
      external_id: result.message_id || `outbound_${thread.id}_${Date.now()}`,
      sender_name: 'Pilger',
      recipient_id: thread.participant_id,
      recipient_name: thread.participant_name,
      direction: 'outbound',
      message: reply,
      sent_at: now,
      raw: result,
      updated_at: now,
    })

  await supabase
    .from('meta_social_threads')
    .update({ status: 'open', last_message_at: now, updated_at: now })
    .eq('id', thread.id)

  return { external_id: result.message_id || '' }
}

export async function respondToSocialSuggestion(params: {
  suggestionId: string
  reply?: string
  requireAutopilot?: boolean
}) {
  const supabase = createAdminClient()
  const { data: suggestion, error } = await supabase
    .from('meta_social_ai_suggestions')
    .select('id, source_type, source_id, platform, suggested_reply, status')
    .eq('id', params.suggestionId)
    .single()

  if (error || !suggestion) throw new Error(error?.message || 'Sugestao nao encontrada.')

  const reply = cleanReply(params.reply || suggestion.suggested_reply)
  if (!reply) throw new Error('A resposta esta vazia.')

  const configs = await readConfigs(supabase)
  if (params.requireAutopilot && !configs.autopilot) {
    return { sent: false, reason: 'autopilot_disabled' }
  }

  const platform = suggestion.platform as Platform
  const result = suggestion.source_type === 'comment'
    ? await sendCommentReply(supabase, platform, suggestion.source_id, reply)
    : await sendThreadReply(supabase, platform, suggestion.source_id, reply)

  await supabase
    .from('meta_social_ai_suggestions')
    .update({
      status: 'sent',
      updated_at: new Date().toISOString(),
      raw: {
        sent_reply: reply,
        external_id: result.external_id,
      },
    })
    .eq('id', suggestion.id)

  return { sent: true, platform, ...result }
}
