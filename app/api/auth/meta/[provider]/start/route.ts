import { NextRequest, NextResponse } from 'next/server'
import {
  createOAuthState,
  getRedirectUri,
  getStateCookieName,
  appendMetaConnectionLog,
  readMetaOAuthConfigs,
  type MetaOAuthProvider,
} from '@/lib/social/meta-oauth'

export const dynamic = 'force-dynamic'

const META_API_VERSION = 'v21.0'
const FACEBOOK_LOGIN_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'pages_manage_engagement',
  'pages_manage_posts',
  'pages_messaging',
  'instagram_basic',
  'instagram_manage_comments',
  'instagram_manage_messages',
  'instagram_content_publish',
  'business_management',
]

function isProvider(value: string): value is MetaOAuthProvider {
  return value === 'instagram' || value === 'facebook'
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const { provider: rawProvider } = await params
    if (!isProvider(rawProvider)) {
      await appendMetaConnectionLog({
        provider: 'meta',
        action: 'oauth_start',
        status: 'error',
        message: `Provider invalido: ${rawProvider}`,
      })
      return NextResponse.redirect(new URL('/admin/maintenance?meta_oauth=invalid_provider', request.url))
    }

    const configs = await readMetaOAuthConfigs()
    const provider = rawProvider
    const state = createOAuthState(provider)
    const redirectUri = getRedirectUri(request, provider, configs)

    let authorizeUrl: URL
    if (provider === 'instagram') {
      const appId = configs.instagram_app_id || process.env.INSTAGRAM_APP_ID
      if (!appId) {
        await appendMetaConnectionLog({
          provider,
          action: 'oauth_start',
          status: 'error',
          message: 'Instagram App ID ausente.',
        })
        return NextResponse.redirect(new URL('/admin/maintenance?meta_oauth=missing_instagram_app_id', request.url))
      }
      authorizeUrl = new URL('https://www.instagram.com/oauth/authorize')
      authorizeUrl.searchParams.set('client_id', appId)
      authorizeUrl.searchParams.set('redirect_uri', redirectUri)
      authorizeUrl.searchParams.set('response_type', 'code')
      authorizeUrl.searchParams.set('scope', [
        'instagram_business_basic',
        'instagram_business_manage_messages',
        'instagram_business_manage_comments',
        'instagram_business_content_publish',
      ].join(','))
      authorizeUrl.searchParams.set('state', state)
      authorizeUrl.searchParams.set('force_authentication', '1')
    } else {
      const appId = configs.meta_app_id || process.env.META_APP_ID
      if (!appId) {
        await appendMetaConnectionLog({
          provider,
          action: 'oauth_start',
          status: 'error',
          message: 'Meta App ID ausente.',
        })
        return NextResponse.redirect(new URL('/admin/maintenance?meta_oauth=missing_meta_app_id', request.url))
      }
      authorizeUrl = new URL(`https://www.facebook.com/${META_API_VERSION}/dialog/oauth`)
      authorizeUrl.searchParams.set('client_id', appId)
      authorizeUrl.searchParams.set('redirect_uri', redirectUri)
      authorizeUrl.searchParams.set('response_type', 'code')
      authorizeUrl.searchParams.set('state', state)
      authorizeUrl.searchParams.set('auth_type', 'rerequest')
      authorizeUrl.searchParams.set('override_default_response_type', 'true')
      authorizeUrl.searchParams.set('scope', FACEBOOK_LOGIN_SCOPES.join(','))
      if (configs.facebook_login_configuration_id) {
        authorizeUrl.searchParams.set('config_id', configs.facebook_login_configuration_id)
      }
    }

    const response = NextResponse.redirect(authorizeUrl)
    await appendMetaConnectionLog({
      provider,
      action: 'oauth_start',
      status: 'info',
      message: provider === 'facebook'
        ? `Login Facebook iniciado${configs.facebook_login_configuration_id ? ' com Configuration ID.' : ' com scopes manuais.'}`
        : 'Login Instagram iniciado.',
    })
    response.cookies.set(getStateCookieName(provider), state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https',
      path: '/',
      maxAge: 10 * 60,
    })
    return response
  } catch (error) {
    console.error('Error starting Meta OAuth:', error)
    await appendMetaConnectionLog({
      provider: 'meta',
      action: 'oauth_start',
      status: 'error',
      message: error instanceof Error ? error.message : 'Erro ao iniciar OAuth.',
    })
    return NextResponse.redirect(new URL('/admin/maintenance?meta_oauth=start_error', request.url))
  }
}
