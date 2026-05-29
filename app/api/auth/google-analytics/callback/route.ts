import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getOAuthBaseUrl, upsertAppConfigs } from '@/lib/social/meta-oauth'

export const dynamic = 'force-dynamic'

const STATE_COOKIE = 'pilger_google_analytics_oauth_state'

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

function redirectToMaintenance(request: NextRequest, status: string) {
  return NextResponse.redirect(new URL(`/admin/maintenance?google_analytics_oauth=${encodeURIComponent(status)}`, request.url))
}

export async function GET(request: NextRequest) {
  try {
    const error = request.nextUrl.searchParams.get('error')
    if (error) return redirectToMaintenance(request, `denied_${error}`)

    const code = request.nextUrl.searchParams.get('code')
    const state = request.nextUrl.searchParams.get('state')
    const expectedState = request.cookies.get(STATE_COOKIE)?.value
    if (!code) return redirectToMaintenance(request, 'missing_code')
    if (!state || !expectedState || state !== expectedState) return redirectToMaintenance(request, 'invalid_state')

    const configs = await readConfigs()
    const clientId = configs.google_analytics_oauth_client_id || process.env.GOOGLE_ANALYTICS_OAUTH_CLIENT_ID || process.env.GOOGLE_ADS_CLIENT_ID
    const clientSecret = configs.google_analytics_oauth_client_secret || process.env.GOOGLE_ANALYTICS_OAUTH_CLIENT_SECRET || process.env.GOOGLE_ADS_CLIENT_SECRET
    if (!clientId || !clientSecret) return redirectToMaintenance(request, 'missing_client_credentials')

    const redirectUri = `${getOAuthBaseUrl(request, configs)}/api/auth/google-analytics/callback`
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })

    const tokenData = await tokenRes.json().catch(() => ({}))
    if (!tokenRes.ok || tokenData.error) {
      return redirectToMaintenance(request, `token_error_${String(tokenData.error || tokenRes.status).slice(0, 40)}`)
    }

    const refreshToken = String(tokenData.refresh_token || '')
    if (!refreshToken) {
      return redirectToMaintenance(request, 'missing_refresh_token_reconnect_with_prompt')
    }

    await upsertAppConfigs({
      google_analytics_refresh_token: refreshToken,
      google_analytics_oauth_connected_at: new Date().toISOString(),
    })

    const response = redirectToMaintenance(request, 'connected')
    response.cookies.delete(STATE_COOKIE)
    return response
  } catch (error) {
    console.error('Error finishing Google Analytics OAuth:', error)
    return redirectToMaintenance(request, 'callback_error')
  }
}
