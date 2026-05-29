import { NextRequest, NextResponse } from 'next/server'
import { appendMetaConnectionLog, upsertAppConfigs, type MetaOAuthProvider } from '@/lib/social/meta-oauth'

export const dynamic = 'force-dynamic'

function isProvider(value: string): value is MetaOAuthProvider {
  return value === 'instagram' || value === 'facebook'
}

export async function GET() {
  return NextResponse.json({ success: true, message: 'Meta deauthorize endpoint ready.' })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const { provider: rawProvider } = await params
    if (!isProvider(rawProvider)) {
      return NextResponse.json({ success: false, message: 'Invalid provider.' }, { status: 400 })
    }

    const formData = await request.formData().catch(() => null)
    const signedRequest = String(formData?.get('signed_request') || '')
    const now = new Date().toISOString()

    await upsertAppConfigs({
      [`${rawProvider}_deauthorized_at`]: now,
      [`${rawProvider}_last_deauthorize_signed_request`]: signedRequest.slice(0, 500),
    })
    await appendMetaConnectionLog({
      provider: rawProvider,
      action: 'deauthorize',
      status: 'warning',
      message: 'Meta enviou callback de desautorizacao.',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Meta deauthorize callback error:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
