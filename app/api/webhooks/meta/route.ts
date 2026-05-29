import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { saveMetaWebhookEvent } from '@/lib/social/meta-inbox'

export const dynamic = 'force-dynamic'

async function getVerifyToken() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'meta_webhook_verify_token')
    .maybeSingle()

  return data?.value || process.env.META_WEBHOOK_VERIFY_TOKEN || 'pilger-meta-webhook'
}

function inferPlatformAndType(payload: any) {
  const object = String(payload?.object || '').toLowerCase()
  const firstEntry = payload?.entry?.[0]
  const firstChange = firstEntry?.changes?.[0]
  const firstMessaging = firstEntry?.messaging?.[0]

  const platform = object.includes('instagram')
    ? 'instagram'
    : object.includes('page')
      ? 'facebook'
      : firstMessaging?.message?.is_echo
        ? 'facebook'
        : null

  const eventType = firstMessaging
    ? 'message'
    : firstChange?.field || object || 'unknown'

  const externalId = firstMessaging?.message?.mid
    || firstChange?.value?.comment_id
    || firstChange?.value?.post_id
    || firstEntry?.id
    || null

  return { platform, eventType, externalId }
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode')
  const token = request.nextUrl.searchParams.get('hub.verify_token')
  const challenge = request.nextUrl.searchParams.get('hub.challenge')
  const expectedToken = await getVerifyToken()

  if (mode === 'subscribe' && token === expectedToken && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    })
  }

  return NextResponse.json({ success: false, error: 'Webhook Meta nao autorizado.' }, { status: 403 })
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    const { platform, eventType, externalId } = inferPlatformAndType(payload)

    await saveMetaWebhookEvent(payload, platform || undefined, eventType || undefined, externalId || undefined)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing Meta webhook:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro no webhook Meta.',
      },
      { status: 500 },
    )
  }
}
