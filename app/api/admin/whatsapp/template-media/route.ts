import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  getMetaWhatsAppErrorInfo,
  loadMetaWhatsAppConfigMap,
  uploadMetaWhatsAppTemplateHeaderMedia,
} from '@/lib/meta/whatsapp-cloud'

type HeaderFormat = 'IMAGE' | 'VIDEO' | 'DOCUMENT'

const HEADER_MEDIA_TYPES_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
}

const HEADER_MEDIA_FALLBACK_TYPE: Record<HeaderFormat, string> = {
  IMAGE: 'image/jpeg',
  VIDEO: 'video/mp4',
  DOCUMENT: 'application/pdf',
}

const HEADER_MEDIA_EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
}

const HEADER_MEDIA_FALLBACK_EXTENSION: Record<HeaderFormat, string> = {
  IMAGE: 'jpg',
  VIDEO: 'mp4',
  DOCUMENT: 'pdf',
}

function cleanText(value: unknown, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength)
}

function normalizeHeaderFormat(value: unknown): HeaderFormat {
  const selected = cleanText(value, 30).toUpperCase()
  return selected === 'VIDEO' || selected === 'DOCUMENT' ? selected : 'IMAGE'
}

function normalizeContentType(value: unknown) {
  return cleanText(value, 120).toLowerCase().split(';')[0]?.trim() || ''
}

function getUrlPath(value: string) {
  try {
    return new URL(value).pathname
  } catch {
    return value.split('?')[0] || ''
  }
}

function getUrlExtension(value: string) {
  const fileName = getUrlPath(value).split('/').pop() || ''
  const extension = fileName.includes('.') ? fileName.split('.').pop() : ''
  return String(extension || '').toLowerCase()
}

function inferContentType(params: {
  bodyFileType: unknown
  responseFileType: unknown
  url: string
  headerFormat: HeaderFormat
}) {
  const explicitType = normalizeContentType(params.bodyFileType)
  if (explicitType && explicitType !== 'application/octet-stream') return explicitType

  const responseType = normalizeContentType(params.responseFileType)
  if (responseType && responseType !== 'application/octet-stream') return responseType

  const extensionType = HEADER_MEDIA_TYPES_BY_EXTENSION[getUrlExtension(params.url)]
  return extensionType || HEADER_MEDIA_FALLBACK_TYPE[params.headerFormat]
}

function inferFileName(params: {
  inputName: unknown
  url: string
  contentType: string
  headerFormat: HeaderFormat
}) {
  const explicitName = cleanText(params.inputName, 180)
  let urlName = getUrlPath(params.url).split('/').pop() || ''
  try {
    urlName = decodeURIComponent(urlName)
  } catch {
    // Mantem o nome original se a URL vier com escape invalido.
  }
  urlName = urlName
    .replace(/[^\w.\-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const baseName = explicitName || urlName || 'template-media'
  if (baseName.includes('.')) return baseName.slice(0, 180)

  const extension = HEADER_MEDIA_EXTENSION_BY_TYPE[params.contentType]
    || HEADER_MEDIA_FALLBACK_EXTENSION[params.headerFormat]
  return `${baseName}.${extension}`.slice(0, 180)
}

function validateHeaderContentType(headerFormat: HeaderFormat, contentType: string) {
  if (headerFormat === 'IMAGE' && !contentType.startsWith('image/')) {
    return 'O header esta como imagem, mas a midia nao parece ser uma imagem publica valida.'
  }
  if (headerFormat === 'VIDEO' && !contentType.startsWith('video/')) {
    return 'O header esta como video, mas a midia nao parece ser um video publico valido.'
  }
  if (headerFormat === 'DOCUMENT' && contentType !== 'application/pdf') {
    return 'Templates com documento precisam usar PDF publico para aprovacao.'
  }
  return ''
}

function isMetaApplicationLimit(error: unknown) {
  const metaError = getMetaWhatsAppErrorInfo(error)
  const message = metaError.message || ''
  return String(metaError.code || '') === '4'
    || message.includes('Application request limit reached')
    || message.includes('(#4)')
}

function formatMetaErrorDetails(error: unknown) {
  const metaError = getMetaWhatsAppErrorInfo(error)
  return [
    metaError.details ? `detalhes ${metaError.details}` : '',
    metaError.status ? `status ${metaError.status}` : '',
    metaError.code ? `codigo ${metaError.code}` : '',
    metaError.subcode ? `subcodigo ${metaError.subcode}` : '',
    metaError.type ? `tipo ${metaError.type}` : '',
    metaError.fbtraceId ? `fbtrace ${metaError.fbtraceId}` : '',
  ].filter(Boolean).join(' | ')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const url = cleanText(body.url, 2000)
    const headerFormat = normalizeHeaderFormat(body.headerFormat)

    if (!url) {
      return NextResponse.json({ success: false, message: 'URL da midia obrigatoria.' }, { status: 400 })
    }

    const mediaResponse = await fetch(url, { cache: 'no-store' })
    if (!mediaResponse.ok) {
      return NextResponse.json({
        success: false,
        message: `Nao foi possivel baixar a midia (${mediaResponse.status}). Confirme se a URL publica abre sem login.`,
      }, { status: 400 })
    }

    const fileBuffer = Buffer.from(await mediaResponse.arrayBuffer())
    const contentType = inferContentType({
      bodyFileType: body.fileType,
      responseFileType: mediaResponse.headers.get('content-type'),
      url,
      headerFormat,
    })
    const invalidContentType = validateHeaderContentType(headerFormat, contentType)
    if (invalidContentType) {
      return NextResponse.json({
        success: false,
        message: invalidContentType,
      }, { status: 400 })
    }

    const fileName = inferFileName({
      inputName: body.fileName,
      url,
      contentType,
      headerFormat,
    })

    const supabase = createAdminClient()
    const configMap = await loadMetaWhatsAppConfigMap(supabase)
    const result = await uploadMetaWhatsAppTemplateHeaderMedia({
      fileName,
      fileType: contentType,
      fileBuffer,
      config: configMap,
    })

    return NextResponse.json({
      success: true,
      message: 'Handle de midia gerado para aprovacao do template.',
      sourceUrl: url,
      fileName,
      fileType: contentType,
      headerFormat,
      ...result,
    })
  } catch (error) {
    console.error('[Meta Template Media POST]', error)
    const limited = isMetaApplicationLimit(error)
    const metaError = getMetaWhatsAppErrorInfo(error)
    const details = formatMetaErrorDetails(error)
    const message = limited
      ? 'A Meta bloqueou temporariamente o upload de midia por limite de requisicoes do App ID. Aguarde o limite reduzir ou configure um Meta WhatsApp App ID dedicado na sala de manutencao.'
      : [
          metaError.message || 'Erro ao gerar handle de midia Meta',
          details ? `Detalhes: ${details}` : '',
        ].filter(Boolean).join(' ')

    return NextResponse.json({
      success: false,
      retryable: limited,
      message,
      details,
      metaError,
    }, { status: limited ? 429 : 500 })
  }
}
