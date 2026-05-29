import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getOAuthBaseUrl } from '@/lib/social/meta-oauth'

export const dynamic = 'force-dynamic'

const STATE_COOKIE = 'pilger_google_analytics_oauth_state'
const SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
]

function createGoogleAnalyticsOAuthState() {
  return `google_analytics_${crypto.randomUUID().replace(/-/g, '')}`
}

async function readConfigs() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('app_config')
    .select('key,value')
    .in('key', [
      'public_site_url',
      'google_analytics_oauth_client_id',
      'google_analytics_oauth_client_secret',
    ])

  return Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))
}

export async function GET(request: NextRequest) {
  try {
    const configs = await readConfigs()
    const clientId = configs.google_analytics_oauth_client_id || process.env.GOOGLE_ANALYTICS_OAUTH_CLIENT_ID || process.env.GOOGLE_ADS_CLIENT_ID

    if (!clientId) {
      return NextResponse.redirect(new URL('/admin/maintenance?google_analytics_oauth=missing_client_id', request.url))
    }

    const state = createGoogleAnalyticsOAuthState()
    const redirectUri = `${getOAuthBaseUrl(request, configs)}/api/auth/google-analytics/callback`
    const authorizeUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authorizeUrl.searchParams.set('client_id', clientId)
    authorizeUrl.searchParams.set('redirect_uri', redirectUri)
    authorizeUrl.searchParams.set('response_type', 'code')
    authorizeUrl.searchParams.set('scope', SCOPES.join(' '))
    authorizeUrl.searchParams.set('access_type', 'offline')
    authorizeUrl.searchParams.set('prompt', 'consent')
    authorizeUrl.searchParams.set('include_granted_scopes', 'true')
    authorizeUrl.searchParams.set('state', state)

    const response = NextResponse.redirect(authorizeUrl)
    response.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https',
      path: '/',
      maxAge: 10 * 60,
    })
    return response
  } catch (error) {
    console.error('Error starting Google Analytics OAuth:', error)
    return NextResponse.redirect(new URL('/admin/maintenance?google_analytics_oauth=start_error', request.url))
  }
}
