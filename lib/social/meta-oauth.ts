import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const META_API_VERSION = 'v21.0'
const DEFAULT_SITE_URL = 'https://guilhermepilger.ai'
const INSTAGRAM_REFRESH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
const INSTAGRAM_MIN_REFRESH_AGE_MS = 24 * 60 * 60 * 1000

export type MetaOAuthProvider = 'instagram' | 'facebook'

type ConfigMap = Record<string, string>

export type InstagramTokenRefreshResult = {
  success: boolean
  skipped?: boolean
  refreshed?: boolean
  reason: string
  message: string
  expiresAt?: string
  previousExpiresAt?: string
}

export type MetaConnectionLogEntry = {
  at: string
  provider?: MetaOAuthProvider | 'meta'
  action: string
  status: 'info' | 'success' | 'warning' | 'error'
  message: string
}

function cleanUrl(value?: string | null) {
  const text = String(value || '').trim().replace(/\/$/, '')
  if (!text) return ''
  try {
    return new URL(text).origin
  } catch {
    return ''
  }
}

export async function readMetaOAuthConfigs() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', [
      'public_site_url',
      'meta_app_id',
      'meta_app_secret',
      'facebook_login_configuration_id',
      'instagram_app_id',
      'instagram_app_secret',
      'meta_facebook_page_id',
      'meta_connection_logs',
    ])

  return Object.fromEntries((data || []).map((row: { key: string; value: string | null }) => [row.key, String(row.value || '')])) as ConfigMap
}

export function getOAuthBaseUrl(request: NextRequest, configs: ConfigMap) {
  const configured = cleanUrl(configs.public_site_url || process.env.NEXT_PUBLIC_SITE_URL)
  if (configured) return configured

  const origin = cleanUrl(request.nextUrl.origin)
  if (origin && !origin.includes('localhost') && !origin.includes('127.0.0.1')) return origin

  return DEFAULT_SITE_URL
}

export function getRedirectUri(request: NextRequest, provider: MetaOAuthProvider, configs: ConfigMap) {
  return `${getOAuthBaseUrl(request, configs)}/api/auth/meta/${provider}/callback`
}

export function getStateCookieName(provider: MetaOAuthProvider) {
  return `pilger_meta_oauth_state_${provider}`
}

export function createOAuthState(provider: MetaOAuthProvider) {
  const random = crypto.randomUUID().replace(/-/g, '')
  return `${provider}_${random}`
}

export async function upsertAppConfigs(configs: Record<string, string>) {
  const supabase = createAdminClient()
  const rows = Object.entries(configs).map(([key, value]) => ({
    key,
    value,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await supabase.from('app_config').upsert(rows, { onConflict: 'key' })
  if (error) throw new Error(error.message)
}

async function readInstagramTokenRefreshConfigs() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', [
      'instagram_business_access_token',
      'instagram_business_account_id',
      'instagram_connected_at',
      'instagram_token_expires_at',
      'instagram_token_kind',
      'instagram_token_refreshed_at',
    ])

  return Object.fromEntries((data || []).map((row: { key: string; value: string | null }) => [row.key, String(row.value || '')])) as ConfigMap
}

function parseTimestamp(value?: string) {
  const time = new Date(String(value || '')).getTime()
  return Number.isFinite(time) ? time : 0
}

function formatDateTimeForLog(value: string) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function buildRefreshSkipResult(reason: string, message: string, expiresAt?: string): InstagramTokenRefreshResult {
  return {
    success: true,
    skipped: true,
    reason,
    message,
    ...(expiresAt ? { expiresAt } : {}),
  }
}

async function saveInstagramRefreshState(result: InstagramTokenRefreshResult, extra: Record<string, string> = {}) {
  const now = new Date().toISOString()
  await upsertAppConfigs({
    instagram_token_refresh_last_checked_at: now,
    instagram_token_refresh_last_reason: result.reason,
    instagram_token_refresh_last_result: JSON.stringify(result).slice(0, 1800),
    ...(result.success
      ? {
          instagram_token_refresh_last_error: '',
          instagram_token_refresh_last_error_at: '',
        }
      : {
          instagram_token_refresh_last_error: result.message.slice(0, 500),
          instagram_token_refresh_last_error_at: now,
        }),
    ...extra,
  })
}

function safeLogMessage(value: unknown) {
  return String(value || '')
    .replace(/EA[A-Za-z0-9_-]{20,}/g, '[token oculto]')
    .replace(/access_token=([^&\s]+)/g, 'access_token=[oculto]')
    .slice(0, 500)
}

export async function appendMetaConnectionLog(entry: Omit<MetaConnectionLogEntry, 'at'>) {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'meta_connection_logs')
      .maybeSingle()

    let current: MetaConnectionLogEntry[] = []
    try {
      const parsed = JSON.parse(String(data?.value || '[]'))
      current = Array.isArray(parsed) ? parsed : []
    } catch {
      current = []
    }

    const next = [
      {
        at: new Date().toISOString(),
        provider: entry.provider,
        action: safeLogMessage(entry.action),
        status: entry.status,
        message: safeLogMessage(entry.message),
      },
      ...current,
    ].slice(0, 40)

    await supabase.from('app_config').upsert({
      key: 'meta_connection_logs',
      value: JSON.stringify(next),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })
  } catch (error) {
    console.error('Unable to write Meta connection log:', error)
  }
}

export async function refreshInstagramLongLivedToken(options: {
  force?: boolean
  logSkipped?: boolean
} = {}): Promise<InstagramTokenRefreshResult> {
  const configs = await readInstagramTokenRefreshConfigs()
  const accessToken = String(configs.instagram_business_access_token || process.env.INSTAGRAM_BUSINESS_ACCESS_TOKEN || '').trim()
  const accountId = String(configs.instagram_business_account_id || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '').trim()
  const tokenKind = String(configs.instagram_token_kind || '').trim()
  const previousExpiresAt = String(configs.instagram_token_expires_at || '').trim()
  const now = Date.now()

  if (!accessToken || !accountId) {
    const result = buildRefreshSkipResult('missing_instagram_login_token', 'Token do Instagram Login ainda nao configurado.')
    await saveInstagramRefreshState(result)
    if (options.logSkipped) {
      await appendMetaConnectionLog({
        provider: 'instagram',
        action: 'token_refresh',
        status: 'warning',
        message: result.message,
      })
    }
    return result
  }

  if (tokenKind && tokenKind !== 'long_lived') {
    const result = buildRefreshSkipResult('not_long_lived', 'Token atual nao e longo; reconecte o Instagram para gerar um token renovavel.', previousExpiresAt)
    await saveInstagramRefreshState(result)
    if (options.logSkipped) {
      await appendMetaConnectionLog({
        provider: 'instagram',
        action: 'token_refresh',
        status: 'warning',
        message: result.message,
      })
    }
    return result
  }

  const expiresAtMs = parseTimestamp(previousExpiresAt)
  if (expiresAtMs && expiresAtMs <= now) {
    const result = buildRefreshSkipResult('expired_needs_reconnect', 'Token do Instagram ja expirou; a Meta exige reconexao manual pelo login guiado.', previousExpiresAt)
    await saveInstagramRefreshState(result)
    if (options.logSkipped) {
      await appendMetaConnectionLog({
        provider: 'instagram',
        action: 'token_refresh',
        status: 'error',
        message: result.message,
      })
    }
    return result
  }

  const lastCredentialAt = Math.max(
    parseTimestamp(configs.instagram_token_refreshed_at),
    parseTimestamp(configs.instagram_connected_at),
  )
  if (lastCredentialAt && now - lastCredentialAt < INSTAGRAM_MIN_REFRESH_AGE_MS) {
    const result = buildRefreshSkipResult('too_young', 'Token novo demais para renovacao automatica; a Meta so permite refresh depois de 24 horas.', previousExpiresAt)
    await saveInstagramRefreshState(result)
    return result
  }

  if (!options.force && expiresAtMs && expiresAtMs - now > INSTAGRAM_REFRESH_WINDOW_MS) {
    const result = buildRefreshSkipResult('not_due', `Token ainda nao precisa renovar. Expira em ${formatDateTimeForLog(previousExpiresAt)}.`, previousExpiresAt)
    await saveInstagramRefreshState(result)
    return result
  }

  try {
    const refreshUrl = new URL('https://graph.instagram.com/refresh_access_token')
    refreshUrl.searchParams.set('grant_type', 'ig_refresh_token')
    refreshUrl.searchParams.set('access_token', accessToken)

    const response = await fetch(refreshUrl.toString(), { cache: 'no-store' })
    const payload = await response.json()

    if (!response.ok || payload?.error || !payload?.access_token) {
      throw new Error(payload?.error?.message || payload?.error_message || `Falha ao renovar token Instagram (${response.status}).`)
    }

    const expiresInSeconds = Number(payload.expires_in || 0)
    const expiresAt = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
      ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
      : ''
    const refreshedAt = new Date().toISOString()
    const result: InstagramTokenRefreshResult = {
      success: true,
      refreshed: true,
      reason: 'refreshed',
      message: expiresAt
        ? `Token Instagram renovado automaticamente ate ${formatDateTimeForLog(expiresAt)}.`
        : 'Token Instagram renovado automaticamente.',
      expiresAt,
      previousExpiresAt,
    }

    await saveInstagramRefreshState(result, {
      instagram_business_access_token: String(payload.access_token),
      instagram_token_expires_in: expiresInSeconds ? String(expiresInSeconds) : '',
      instagram_token_expires_at: expiresAt,
      instagram_token_kind: 'long_lived',
      instagram_token_refreshed_at: refreshedAt,
      instagram_token_exchange_warning: '',
      instagram_token_refresh_last_run_at: refreshedAt,
    })
    await appendMetaConnectionLog({
      provider: 'instagram',
      action: 'token_refresh',
      status: 'success',
      message: result.message,
    })

    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao renovar token Instagram.'
    const result: InstagramTokenRefreshResult = {
      success: false,
      reason: 'refresh_error',
      message,
      previousExpiresAt,
    }
    await saveInstagramRefreshState(result)
    await appendMetaConnectionLog({
      provider: 'instagram',
      action: 'token_refresh',
      status: 'error',
      message: `Renovacao automatica falhou: ${message}`,
    })
    throw error
  }
}

export async function exchangeFacebookCode(params: {
  code: string
  redirectUri: string
  appId: string
  appSecret: string
}) {
  const shortTokenUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`)
  shortTokenUrl.searchParams.set('client_id', params.appId)
  shortTokenUrl.searchParams.set('client_secret', params.appSecret)
  shortTokenUrl.searchParams.set('redirect_uri', params.redirectUri)
  shortTokenUrl.searchParams.set('code', params.code)

  const shortResponse = await fetch(shortTokenUrl.toString(), { cache: 'no-store' })
  const shortPayload = await shortResponse.json()
  if (!shortResponse.ok || shortPayload?.error) {
    throw new Error(shortPayload?.error?.message || 'Falha ao trocar codigo do Facebook.')
  }

  const longTokenUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`)
  longTokenUrl.searchParams.set('grant_type', 'fb_exchange_token')
  longTokenUrl.searchParams.set('client_id', params.appId)
  longTokenUrl.searchParams.set('client_secret', params.appSecret)
  longTokenUrl.searchParams.set('fb_exchange_token', shortPayload.access_token)

  const longResponse = await fetch(longTokenUrl.toString(), { cache: 'no-store' })
  const longPayload = await longResponse.json()
  const accessToken = longResponse.ok && longPayload?.access_token ? longPayload.access_token : shortPayload.access_token

  const pagesUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/me/accounts`)
  pagesUrl.searchParams.set('fields', 'id,name,access_token,instagram_business_account{id,username}')
  pagesUrl.searchParams.set('access_token', accessToken)

  const pagesResponse = await fetch(pagesUrl.toString(), { cache: 'no-store' })
  const pagesPayload = await pagesResponse.json()
  if (!pagesResponse.ok || pagesPayload?.error) {
    throw new Error(pagesPayload?.error?.message || 'Falha ao listar paginas do Facebook.')
  }

  return {
    userAccessToken: accessToken,
    pages: Array.isArray(pagesPayload.data) ? pagesPayload.data : [],
  }
}

export async function exchangeInstagramCode(params: {
  code: string
  redirectUri: string
  appId: string
  appSecret: string
}) {
  const body = new URLSearchParams()
  body.set('client_id', params.appId)
  body.set('client_secret', params.appSecret)
  body.set('grant_type', 'authorization_code')
  body.set('redirect_uri', params.redirectUri)
  body.set('code', params.code)

  const shortResponse = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    body,
    cache: 'no-store',
  })
  const shortPayload = await shortResponse.json()
  if (!shortResponse.ok || shortPayload?.error) {
    throw new Error(shortPayload?.error_message || shortPayload?.error?.message || 'Falha ao trocar codigo do Instagram.')
  }

  const longParams = new URLSearchParams()
  longParams.set('grant_type', 'ig_exchange_token')
  longParams.set('client_secret', params.appSecret)
  longParams.set('access_token', shortPayload.access_token)

  const longUrl = new URL('https://graph.instagram.com/access_token')
  longParams.forEach((value, key) => longUrl.searchParams.set(key, value))

  let longResponse = await fetch(longUrl.toString(), { cache: 'no-store' })
  let longPayload = await longResponse.json()
  const longWarning = String(longPayload?.error?.message || longPayload?.error_message || '')
  if (
    (!longResponse.ok || !longPayload?.access_token)
    && longWarning.toLowerCase().includes('method type: get')
  ) {
    longResponse = await fetch('https://graph.instagram.com/access_token', {
      method: 'POST',
      body: longParams,
      cache: 'no-store',
    })
    longPayload = await longResponse.json()
  }

  const accessToken = longResponse.ok && longPayload?.access_token ? longPayload.access_token : shortPayload.access_token
  const tokenKind = longResponse.ok && longPayload?.access_token ? 'long_lived' : 'short_lived'
  const exchangeWarning = tokenKind === 'short_lived'
    ? String(longPayload?.error?.message || longPayload?.error_message || 'Nao foi possivel gerar token longo do Instagram.')
    : ''

  return {
    accessToken,
    userId: String(shortPayload.user_id || ''),
    expiresIn: String(longPayload?.expires_in || shortPayload?.expires_in || ''),
    tokenKind,
    exchangeWarning,
  }
}
