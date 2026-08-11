import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  loadMetaWhatsAppConfigMap,
  uploadMetaWhatsAppTemplateHeaderMedia,
} from '@/lib/meta/whatsapp-cloud'

function cleanText(value: unknown, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const url = cleanText(body.url, 2000)
    if (!url) {
      return NextResponse.json({ success: false, message: 'URL da midia obrigatoria.' }, { status: 400 })
    }

    const mediaResponse = await fetch(url, { cache: 'no-store' })
    if (!mediaResponse.ok) {
      return NextResponse.json({
        success: false,
        message: `Nao foi possivel baixar a midia (${mediaResponse.status}).`,
      }, { status: 400 })
    }

    const fileBuffer = Buffer.from(await mediaResponse.arrayBuffer())
    const contentType = cleanText(body.fileType || mediaResponse.headers.get('content-type'), 120) || 'application/octet-stream'
    const inferredName = url.split('/').pop()?.split('?')[0] || 'template-media'

    const supabase = createAdminClient()
    const configMap = await loadMetaWhatsAppConfigMap(supabase)
    const result = await uploadMetaWhatsAppTemplateHeaderMedia({
      fileName: cleanText(body.fileName, 180) || inferredName,
      fileType: contentType,
      fileBuffer,
      config: configMap,
    })

    return NextResponse.json({
      success: true,
      message: 'Handle de midia gerado para aprovacao do template.',
      ...result,
    })
  } catch (error) {
    console.error('[Meta Template Media POST]', error)
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao gerar handle de midia Meta',
    }, { status: 500 })
  }
}
