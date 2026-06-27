import { createHmac, timingSafeEqual } from 'crypto'
import { after, NextRequest, NextResponse } from 'next/server'
import { getConnectyHubConfig } from '@/lib/connectyhub/config'
import { POST as processWhatsAppWebhook } from '../whatsapp/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_WEBHOOK_BODY_SIZE = 1024 * 1024

function parseSignature(value: string | null) {
    const signature = String(value || '').trim()
    if (!signature.toLowerCase().startsWith('sha256=')) return ''
    const digest = signature.slice('sha256='.length)
    return /^[a-f0-9]{64}$/i.test(digest) ? digest.toLowerCase() : ''
}

function isValidSignature(rawBody: string, signatureHeader: string | null, secret: string) {
    const provided = parseSignature(signatureHeader)
    if (!provided || !secret) return false

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
    const providedBuffer = Buffer.from(provided, 'hex')
    const expectedBuffer = Buffer.from(expected, 'hex')

    return providedBuffer.length === expectedBuffer.length
        && timingSafeEqual(providedBuffer, expectedBuffer)
}

function normalizePayload(rawBody: string, headers: Headers) {
    const body = JSON.parse(rawBody)
    const event = headers.get('x-connectyhub-event') || body?.event || body?.type || ''
    const instanceId = headers.get('x-connectyhub-instance-id') || body?.instanceId || ''
    const webhookEventId = headers.get('x-connectyhub-webhook-event-id') || body?.webhookEventId || ''

    return {
        ...body,
        provider: body?.provider || 'connectyhub',
        event,
        instanceId,
        webhookEventId,
        data: body?.data ?? body?.payload ?? body,
    }
}

function buildForwardedRequest(request: NextRequest, normalizedPayload: any) {
    const headers = new Headers(request.headers)
    headers.set('content-type', 'application/json')
    headers.set('x-connectyhub-event', String(normalizedPayload.event || ''))
    headers.set('x-connectyhub-instance-id', String(normalizedPayload.instanceId || ''))
    headers.set('x-connectyhub-webhook-event-id', String(normalizedPayload.webhookEventId || ''))

    const targetUrl = request.url.replace('/api/webhooks/connectyhub', '/api/webhooks/whatsapp')
    return new NextRequest(new Request(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(normalizedPayload),
    }))
}

export async function POST(request: NextRequest) {
    const contentLength = Number(request.headers.get('content-length') || 0)
    if (contentLength > MAX_WEBHOOK_BODY_SIZE) {
        return NextResponse.json({ success: false, message: 'Payload muito grande' }, { status: 413 })
    }

    const rawBody = await request.text()
    const config = await getConnectyHubConfig()

    if (!config.webhookSecret) {
        console.error('[ConnectyHub Webhook] CONNECTYHUB_WEBHOOK_SECRET ausente.')
        return NextResponse.json({ success: false, message: 'Webhook secret nao configurado' }, { status: 503 })
    }

    if (!isValidSignature(rawBody, request.headers.get('x-connectyhub-signature'), config.webhookSecret)) {
        console.warn('[ConnectyHub Webhook] Assinatura invalida.')
        return NextResponse.json({ success: false, message: 'Assinatura invalida' }, { status: 401 })
    }

    let normalizedPayload: any
    try {
        normalizedPayload = normalizePayload(rawBody, request.headers)
    } catch {
        return NextResponse.json({ success: false, message: 'JSON invalido' }, { status: 400 })
    }

    after(async () => {
        try {
            await processWhatsAppWebhook(buildForwardedRequest(request, normalizedPayload))
        } catch (error) {
            console.error('[ConnectyHub Webhook] Falha no processamento assinado:', error)
        }
    })

    return NextResponse.json({
        success: true,
        received: true,
        event: normalizedPayload.event || null,
        instanceId: normalizedPayload.instanceId || null,
        webhookEventId: normalizedPayload.webhookEventId || null,
    })
}
