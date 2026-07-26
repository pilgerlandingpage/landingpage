const META_API_VERSION = 'v21.0'

export type InstagramGraphConnectionSource = 'meta_graph' | 'facebook_page' | 'instagram_login'

export type InstagramGraphConnection = {
  accountId: string
  accessToken: string
  baseUrl: string
  source: InstagramGraphConnectionSource
}

type ConfigMap = Record<string, string | undefined>

function firstText(...values: Array<string | undefined | null>) {
  return values.map(value => String(value || '').trim()).find(Boolean) || ''
}

function isPastDate(value: string) {
  const time = new Date(value).getTime()
  return Number.isFinite(time) && time <= Date.now()
}

export function getFacebookGraphBaseUrl() {
  return `https://graph.facebook.com/${META_API_VERSION}`
}

export function getInstagramGraphBaseUrl() {
  return `https://graph.instagram.com/${META_API_VERSION}`
}

export function isInstagramLoginTokenProbablyExpired(config: ConfigMap, env: NodeJS.ProcessEnv = process.env) {
  const token = firstText(config.instagram_business_access_token, env.INSTAGRAM_BUSINESS_ACCESS_TOKEN)
  if (!token) return false

  const expiresAt = firstText(config.instagram_token_expires_at, env.INSTAGRAM_TOKEN_EXPIRES_AT)
  if (expiresAt) return isPastDate(expiresAt)

  const tokenKind = firstText(config.instagram_token_kind, env.INSTAGRAM_TOKEN_KIND)
  if (tokenKind === 'short_lived') {
    const connectedAt = firstText(config.instagram_connected_at, env.INSTAGRAM_CONNECTED_AT)
    const connectedTime = connectedAt ? new Date(connectedAt).getTime() : NaN
    if (!Number.isFinite(connectedTime)) return true
    return Date.now() - connectedTime > 50 * 60 * 1000
  }

  return false
}

export function getInstagramGraphConnection(
  config: ConfigMap,
  env: NodeJS.ProcessEnv = process.env,
): InstagramGraphConnection | null {
  const metaInstagramId = firstText(config.meta_instagram_account_id, env.META_INSTAGRAM_ACCOUNT_ID)
  const metaAccessToken = firstText(config.meta_access_token, env.META_ACCESS_TOKEN)
  if (metaInstagramId && metaAccessToken) {
    return {
      accountId: metaInstagramId,
      accessToken: metaAccessToken,
      baseUrl: getFacebookGraphBaseUrl(),
      source: 'meta_graph',
    }
  }

  const facebookPageToken = firstText(config.facebook_page_access_token, env.FACEBOOK_PAGE_ACCESS_TOKEN)
  if (metaInstagramId && facebookPageToken) {
    return {
      accountId: metaInstagramId,
      accessToken: facebookPageToken,
      baseUrl: getFacebookGraphBaseUrl(),
      source: 'facebook_page',
    }
  }

  const instagramLoginId = firstText(config.instagram_business_account_id, env.INSTAGRAM_BUSINESS_ACCOUNT_ID)
  const instagramLoginToken = firstText(config.instagram_business_access_token, env.INSTAGRAM_BUSINESS_ACCESS_TOKEN)
  if (instagramLoginId && instagramLoginToken && !isInstagramLoginTokenProbablyExpired(config, env)) {
    return {
      accountId: instagramLoginId,
      accessToken: instagramLoginToken,
      baseUrl: getInstagramGraphBaseUrl(),
      source: 'instagram_login',
    }
  }

  return null
}

export function getInstagramGraphConnectionIssue(config: ConfigMap, env: NodeJS.ProcessEnv = process.env) {
  const hasAnyInstagramId = Boolean(
    firstText(config.meta_instagram_account_id, env.META_INSTAGRAM_ACCOUNT_ID)
    || firstText(config.instagram_business_account_id, env.INSTAGRAM_BUSINESS_ACCOUNT_ID),
  )
  if (!hasAnyInstagramId) return 'Instagram Business ID nao configurado.'

  const hasAnyToken = Boolean(
    firstText(config.meta_access_token, env.META_ACCESS_TOKEN)
    || firstText(config.facebook_page_access_token, env.FACEBOOK_PAGE_ACCESS_TOKEN)
    || firstText(config.instagram_business_access_token, env.INSTAGRAM_BUSINESS_ACCESS_TOKEN),
  )
  if (!hasAnyToken) return 'Token Meta/Instagram nao configurado.'

  if (isInstagramLoginTokenProbablyExpired(config, env)) {
    return 'Token do Instagram Login expirado. Reconecte o Instagram ou use a conexao Meta Graph com Business/System User Token.'
  }

  return 'Conexao Instagram incompleta. Revise Meta Access Token, Instagram Business ID e permissoes do app.'
}
