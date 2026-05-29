import { NextRequest, NextResponse } from 'next/server'
import { appendMetaConnectionLog, upsertAppConfigs, type MetaOAuthProvider } from '@/lib/social/meta-oauth'

export const dynamic = 'force-dynamic'

function isProvider(value: string): value is MetaOAuthProvider {
  return value === 'instagram' || value === 'facebook'
}

function confirmationCode(provider: string) {
  return `pilger-${provider}-${Date.now()}`
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: rawProvider } = await params
  if (!isProvider(rawProvider)) {
    return NextResponse.json({ success: false, message: 'Invalid provider.' }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    status: 'received',
    provider: rawProvider,
    confirmation_code: confirmationCode(rawProvider),
    url: `${request.nextUrl.origin}/api/auth/meta/${rawProvider}/data-deletion`,
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const { provider: rawProvider } = await params
    if (!isProvider(rawProvider)) {
      return NextResponse.json({ success: false, message: 'Invalid provider.' }, { status: 400 })
    }

    const formData = await request.formData().catch(() => null)
    const signedRequest = String(formData?.get('signed_request') || '')
    const code = confirmationCode(rawProvider)

    await upsertAppConfigs({
      [`${rawProvider}_data_deletion_requested_at`]: new Date().toISOString(),
      [`${rawProvider}_data_deletion_confirmation_code`]: code,
      [`${rawProvider}_last_data_deletion_signed_request`]: signedRequest.slice(0, 500),
    })
    await appendMetaConnectionLog({
      provider: rawProvider,
      action: 'data_deletion',
      status: 'warning',
      message: `Solicitacao de exclusao de dados recebida. Codigo: ${code}.`,
    })

    return NextResponse.json({
      url: `${request.nextUrl.origin}/api/auth/meta/${rawProvider}/data-deletion?code=${encodeURIComponent(code)}`,
      confirmation_code: code,
    })
  } catch (error) {
    console.error('Meta data deletion callback error:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
