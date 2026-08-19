import { NextRequest, NextResponse } from 'next/server'
import {
  getMetaWhatsAppConversationDetail,
  listMetaWhatsAppConversations,
  sendMetaWhatsAppChatReply,
  updateMetaWhatsAppConversation,
} from '@/lib/meta/whatsapp-chat'
import {
  manuallyClassifyMetaWhatsAppConversationReply,
  type ReplyIntent,
} from '@/lib/meta/whatsapp-triage'

export const dynamic = 'force-dynamic'

function cleanText(value: unknown, maxLength = 2000) {
  return String(value || '').trim().slice(0, maxLength)
}

function normalizeReplyIntent(value: unknown): ReplyIntent | null {
  const intent = cleanText(value, 40)
  if (intent === 'interested' || intent === 'opt_out' || intent === 'question' || intent === 'unknown') {
    return intent
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const conversationId = cleanText(request.nextUrl.searchParams.get('conversation_id'), 80)

    if (conversationId) {
      const detail = await getMetaWhatsAppConversationDetail(conversationId)
      return NextResponse.json({ success: true, ...detail })
    }

    const result = await listMetaWhatsAppConversations({
      status: request.nextUrl.searchParams.get('status'),
      search: request.nextUrl.searchParams.get('search'),
      senderId: request.nextUrl.searchParams.get('sender_id'),
      wabaId: request.nextUrl.searchParams.get('waba_id'),
      limit: Number(request.nextUrl.searchParams.get('limit') || 80),
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[Meta WhatsApp Chat GET]', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao carregar chat Meta WhatsApp.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const action = cleanText(body.action, 40)
    const conversationId = cleanText(body.conversation_id || body.conversationId, 80)

    if (!conversationId) {
      return NextResponse.json({ success: false, error: 'Informe a conversa.' }, { status: 400 })
    }

    if (action === 'reply') {
      const result = await sendMetaWhatsAppChatReply({
        conversationId,
        text: cleanText(body.text, 4096),
        previewUrl: Boolean(body.preview_url || body.previewUrl),
      })
      return NextResponse.json({ success: true, action, ...result })
    }

    if (action === 'mark_read') {
      const conversation = await updateMetaWhatsAppConversation(conversationId, { markRead: true })
      return NextResponse.json({ success: true, action, conversation })
    }

    if (action === 'status') {
      const conversation = await updateMetaWhatsAppConversation(conversationId, {
        status: cleanText(body.status, 20),
      })
      return NextResponse.json({ success: true, action, conversation })
    }

    if (action === 'triage') {
      const intent = normalizeReplyIntent(body.intent)
      if (!intent) {
        return NextResponse.json({ success: false, error: 'Informe uma classificacao valida.' }, { status: 400 })
      }

      const result = await manuallyClassifyMetaWhatsAppConversationReply({
        conversationId,
        intent,
        messageId: cleanText(body.message_id || body.messageId, 80) || null,
        note: cleanText(body.note, 500) || null,
      })

      return NextResponse.json({ success: true, action, result })
    }

    return NextResponse.json({ success: false, error: 'Acao invalida.' }, { status: 400 })
  } catch (error) {
    console.error('[Meta WhatsApp Chat POST]', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro ao atualizar chat Meta WhatsApp.' },
      { status: 500 },
    )
  }
}
