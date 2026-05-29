import { NextRequest, NextResponse } from 'next/server'
import {
  exchangeFacebookCode,
  exchangeInstagramCode,
  appendMetaConnectionLog,
  getRedirectUri,
  getStateCookieName,
  readMetaOAuthConfigs,
  upsertAppConfigs,
  type MetaOAuthProvider,
} from '@/lib/social/meta-oauth'

export const dynamic = 'force-dynamic'

function isProvider(value: string): value is MetaOAuthProvider {
  return value === 'instagram' || value === 'facebook'
}

function maintenanceRedirect(request: NextRequest, status: string) {
  return NextResponse.redirect(new URL(`/admin/maintenance?meta_oauth=${encodeURIComponent(status)}`, request.url))
}

async function redirectWithLog(request: NextRequest, provider: MetaOAuthProvider | 'meta', status: string, message: string, level: 'success' | 'warning' | 'error' = 'error') {
  await appendMetaConnectionLog({
    provider,
    action: 'oauth_callback',
    status: level,
    message,
  })
  return maintenanceRedirect(request, status)
}

function choosePage(pages: any[], preferredPageId?: string) {
  if (!pages.length) return null
  if (preferredPageId) {
    const match = pages.find(page => String(page.id) === String(preferredPageId))
    if (match) return match
  }
  return pages.find(page => String(page.name || '').toLowerCase().includes('guilherme')) || pages[0]
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const { provider: rawProvider } = await params
    if (!isProvider(rawProvider)) return redirectWithLog(request, 'meta', 'invalid_provider', `Provider invalido: ${rawProvider}`)

    const provider = rawProvider
    const error = request.nextUrl.searchParams.get('error_description') || request.nextUrl.searchParams.get('error_message') || request.nextUrl.searchParams.get('error')
    if (error) return redirectWithLog(request, provider, `${provider}_denied`, `Usuario negou ou a Meta retornou erro: ${error}`, 'warning')

    const code = request.nextUrl.searchParams.get('code')
    const state = request.nextUrl.searchParams.get('state')
    const expectedState = request.cookies.get(getStateCookieName(provider))?.value
    if (!code) return redirectWithLog(request, provider, `${provider}_missing_code`, 'Callback sem codigo de autorizacao.')
    if (!state || !expectedState || state !== expectedState) return redirectWithLog(request, provider, `${provider}_invalid_state`, 'State de seguranca invalido ou expirado. Tente conectar novamente.')

    const configs = await readMetaOAuthConfigs()
    const redirectUri = getRedirectUri(request, provider, configs)
    const response = maintenanceRedirect(request, `${provider}_connected`)

    if (provider === 'instagram') {
      const appId = configs.instagram_app_id || process.env.INSTAGRAM_APP_ID
      const appSecret = configs.instagram_app_secret || process.env.INSTAGRAM_APP_SECRET
      if (!appId || !appSecret) return redirectWithLog(request, provider, 'missing_instagram_app_credentials', 'Instagram App ID ou Secret ausente.')

      const result = await exchangeInstagramCode({ code, redirectUri, appId, appSecret })
      const expiresInSeconds = Number(result.expiresIn || 0)
      const expiresAt = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
        ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
        : ''
      await upsertAppConfigs({
        instagram_business_access_token: result.accessToken,
        instagram_business_account_id: result.userId,
        instagram_connected_at: new Date().toISOString(),
        instagram_token_expires_in: result.expiresIn,
        instagram_token_expires_at: expiresAt,
        instagram_token_kind: result.tokenKind,
        instagram_token_exchange_warning: result.exchangeWarning,
      })
      await appendMetaConnectionLog({
        provider,
        action: 'oauth_callback',
        status: result.tokenKind === 'long_lived' ? 'success' : 'warning',
        message: result.tokenKind === 'long_lived'
          ? `Instagram conectado com token longo. ID: ${result.userId || 'nao informado'}.`
          : `Instagram conectado, mas com token curto. Reconecte apos revisar o app. Motivo: ${result.exchangeWarning || 'troca para token longo nao confirmada.'}`,
      })
    } else {
      const appId = configs.meta_app_id || process.env.META_APP_ID
      const appSecret = configs.meta_app_secret || process.env.META_APP_SECRET
      if (!appId || !appSecret) return redirectWithLog(request, provider, 'missing_meta_app_credentials', 'Meta App ID ou Secret ausente.')

      const result = await exchangeFacebookCode({ code, redirectUri, appId, appSecret })
      const page = choosePage(result.pages, configs.meta_facebook_page_id)
      if (!page?.access_token || !page?.id) return redirectWithLog(request, provider, 'facebook_no_page', `Nenhuma pagina autorizada retornou Page Access Token. Paginas recebidas: ${result.pages.length}.`)

      await upsertAppConfigs({
        meta_access_token: result.userAccessToken,
        facebook_page_access_token: page.access_token,
        meta_facebook_page_id: String(page.id),
        meta_facebook_page_name: String(page.name || ''),
        facebook_connected_at: new Date().toISOString(),
        ...(page.instagram_business_account?.id ? {
          meta_instagram_account_id: String(page.instagram_business_account.id),
          meta_instagram_username: String(page.instagram_business_account.username || ''),
        } : {}),
      })
      await appendMetaConnectionLog({
        provider,
        action: 'oauth_callback',
        status: 'success',
        message: `Facebook conectado. Pagina: ${String(page.name || page.id)}${page.instagram_business_account?.id ? `; Instagram vinculado: ${page.instagram_business_account.id}` : '; Instagram nao retornado no callback'}.`,
      })
    }

    response.cookies.delete(getStateCookieName(provider))
    return response
  } catch (error) {
    console.error('Error finishing Meta OAuth:', error)
    const status = error instanceof Error ? `error_${error.message.slice(0, 60)}` : 'callback_error'
    await appendMetaConnectionLog({
      provider: 'meta',
      action: 'oauth_callback',
      status: 'error',
      message: error instanceof Error ? error.message : 'Erro ao finalizar OAuth.',
    })
    return maintenanceRedirect(request, status)
  }
}
