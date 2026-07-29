import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  loadMetaWhatsAppConfigMap,
  uploadMetaWhatsAppTemplateHeaderMedia,
} from '@/lib/meta/whatsapp-cloud'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_VIDEO_SIZE = 16 * 1024 * 1024
const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024

const allowedTypes: Record<string, string[]> = {
  IMAGE: ['image/jpeg', 'image/png'],
  VIDEO: ['video/mp4'],
  DOCUMENT: ['application/pdf'],
}

const maxSizes: Record<string, number> = {
  IMAGE: MAX_IMAGE_SIZE,
  VIDEO: MAX_VIDEO_SIZE,
  DOCUMENT: MAX_DOCUMENT_SIZE,
}

function cleanText(value: unknown, maxLength = 300) {
  return String(value || '').trim().slice(0, maxLength)
}

function formatMegabytes(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const headerFormat = cleanText(formData.get('headerFormat'), 20).toUpperCase()

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: 'Selecione um arquivo de midia.' }, { status: 400 })
    }

    if (!allowedTypes[headerFormat]) {
      return NextResponse.json({ success: false, message: 'Tipo de header de midia invalido.' }, { status: 400 })
    }

    if (!allowedTypes[headerFormat].includes(file.type)) {
      return NextResponse.json({
        success: false,
        message: headerFormat === 'IMAGE'
          ? 'Envie uma imagem JPG ou PNG.'
          : headerFormat === 'VIDEO'
            ? 'Envie um video MP4.'
            : 'Envie um documento PDF.',
      }, { status: 400 })
    }

    const maxSize = maxSizes[headerFormat]
    if (file.size > maxSize) {
      return NextResponse.json({
        success: false,
        message: `Arquivo maior que o limite de ${formatMegabytes(maxSize)} para ${headerFormat.toLowerCase()}.`,
      }, { status: 400 })
    }

    const supabase = createAdminClient()
    const configMap = await loadMetaWhatsAppConfigMap(supabase)
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const upload = await uploadMetaWhatsAppTemplateHeaderMedia({
      fileName: file.name,
      fileType: file.type,
      fileBuffer,
      config: configMap,
    })

    return NextResponse.json({
      success: true,
      message: 'Midia carregada na Meta.',
      handle: upload.handle,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
      },
    })
  } catch (error) {
    console.error('[Meta Template Media POST]', error)
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao carregar midia na Meta',
    }, { status: 500 })
  }
}
