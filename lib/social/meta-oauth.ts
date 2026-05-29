import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const META_API_VERSION = 'v21.0'
const DEFAULT_SITE_URL = 'https://guilhermepilger.ai'

export type MetaOAuthProvider = 'instagram' | 'facebook'

type ConfigMap = Record<string, string>

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

  const longUrl = new URL('https://graph.instagram.com/access_token')
  longUrl.searchParams.set('grant_type', 'ig_exchange_token')
  longUrl.searchParams.set('client_secret', params.appSecret)
  longUrl.searchParams.set('access_token', shortPayload.access_token)

  const longResponse = await fetch(longUrl.toString(), { cache: 'no-store' })
  const longPayload = await longResponse.json()
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
