import { getPublicAppUrl } from '@/lib/app-url'
import { recordAgentCentralSignal, saveAgentCentralSnapshot } from '@/lib/intelligence/agent-runtime'
import { formatPublicPropertyPrice } from '@/lib/properties/public-policy'
import { propertyDetailsPath } from '@/lib/properties/responsive-destination'
import { sendWhatsAppMessage } from '@/lib/connectyhub/whatsapp'

type SupabaseLike = {
  from: (table: string) => any
}

type ProcessPilgerPropertyCommandParams = {
  supabase: SupabaseLike
  command: any
  instance?: any
  instanceToken?: string | null
  origin?: string | null
  sendResponse?: boolean
}

export type ProcessPilgerPropertyCommandResult = {
  handled: boolean
  whatsappSent: boolean
  matchedCount?: number
  selectedCount?: number
  error?: string
}

const PROPERTY_SELECT = [
  'id',
  'title',
  'city',
  'state',
  'neighborhood',
  'price',
  'property_type',
  'bedrooms',
  'bathrooms',
  'suites',
  'parking_spaces',
  'area_m2',
  'area_private_m2',
  'status',
  'source_status',
  'amenities',
  'description',
  'created_at',
  'source_slug',
  'seo_title',
].join(',')

const FALLBACK_PROPERTY_SELECT = 'id,title,city,state,price,property_type,bedrooms,bathrooms,area_m2,status,amenities,description,created_at'

function cleanString(value: unknown, max = 1200) {
  const text = String(value || '').trim().replace(/\s+/g, ' ')
  return text.length > max ? text.slice(0, max) : text
}

function normalizeText(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseBudget(text: string) {
  const normalized = normalizeText(text)
  const match = normalized.match(/(?:r\$|\b)(\d{1,3}(?:[\.\s]\d{3})+|\d+(?:[,.]\d+)?)(?:\s*(milhoes|milhao|mi|m|mil|k))?/)
  if (!match) return null
  const raw = String(match[1] || '').replace(/\s/g, '')
  let value = Number(raw.replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(value) || value <= 0) return null
  const unit = String(match[2] || '')
  if (/milhoes|milhao|mi|\bm\b/.test(unit) && value < 1000) value *= 1000000
  else if (/mil|k/.test(unit) && value < 10000) value *= 1000
  return Math.round(value)
}

function requestedTags(text: string) {
  const normalized = normalizeText(text)
  const tags: string[] = []
  if (/\bfrente mar|frente ao mar|beira mar|pe na areia\b/.test(normalized)) tags.push('frente mar')
  if (/\bvista mar|vista para o mar\b/.test(normalized)) tags.push('vista mar')
  if (/\bcobertura|duplex|triplex\b/.test(normalized)) tags.push('cobertura')
  if (/\blancamento|na planta|obra|construcao\b/.test(normalized)) tags.push('lancamento')
  if (/\bmobiliad/.test(normalized)) tags.push('mobiliado')
  return tags
}

function requestedType(text: string) {
  const normalized = normalizeText(text)
  if (/\bcobertura|duplex|triplex\b/.test(normalized)) return 'cobertura'
  if (/\bcasa|sobrado\b/.test(normalized)) return 'casa'
  if (/\bterreno\b/.test(normalized)) return 'terreno'
  if (/\bapartamento|apto\b/.test(normalized)) return 'apartamento'
  return ''
}

function requestedRegion(text: string) {
  const normalized = normalizeText(text)
  const regions = [
    'balneario camboriu',
    'praia brava',
    'itajai',
    'itapema',
    'porto belo',
    'bombinhas',
    'florianopolis',
    'meia praia',
  ]
  return regions.find(region => normalized.includes(region)) || ''
}

function propertySearchBlob(property: any) {
  return normalizeText([
    property.title,
    property.seo_title,
    property.city,
    property.state,
    property.neighborhood,
    property.property_type,
    property.description,
    ...(Array.isArray(property.amenities) ? property.amenities : []),
  ].filter(Boolean).join(' '))
}

function scoreProperty(property: any, params: {
  text: string
  budget: number | null
  type: string
  region: string
  tags: string[]
}) {
  const blob = propertySearchBlob(property)
  let score = 0
  if (params.region && blob.includes(params.region)) score += 26
  if (params.type && blob.includes(params.type)) score += 18
  for (const tag of params.tags) {
    if (blob.includes(tag)) score += 16
  }
  if (property.status === 'active') score += 8
  if (property.source_status && /ativo|active|disponivel/i.test(String(property.source_status))) score += 4
  if (params.budget && Number(property.price || 0) > 0) {
    const distance = Math.abs(Number(property.price) - params.budget) / Math.max(params.budget, 1)
    score += Math.max(0, 18 - Math.round(distance * 18))
  }
  score += Math.min(8, Math.max(0, new Date(property.created_at || 0).getTime() / Date.now() * 8))
  return score
}

async function updateCommandStatus(
  supabase: SupabaseLike,
  commandId: string | null,
  status: string,
  result: Record<string, unknown>,
) {
  if (!commandId) return
  await supabase
    .from('whatsapp_global_commands')
    .update({
      status,
      result,
      updated_at: new Date().toISOString(),
    })
    .eq('id', commandId)
}

async function loadActiveProperties(supabase: SupabaseLike) {
  let query = supabase
    .from('properties')
    .select(PROPERTY_SELECT)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(180)

  let { data, error } = await query
  if (!error) return Array.isArray(data) ? data : []

  query = supabase
    .from('properties')
    .select(FALLBACK_PROPERTY_SELECT)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(180)
  const fallback = await query
  if (fallback.error) throw fallback.error
  return Array.isArray(fallback.data) ? fallback.data : []
}

function formatCurrency(value: unknown) {
  return formatPublicPropertyPrice(value)
}

function formatPropertyLine(property: any, index: number, origin?: string | null) {
  const location = [property.neighborhood, property.city, property.state].filter(Boolean).join(' - ')
  const specs = [
    property.property_type,
    property.suites ? `${property.suites} suites` : property.bedrooms ? `${property.bedrooms} dorm.` : '',
    property.parking_spaces ? `${property.parking_spaces} vagas` : '',
    property.area_private_m2 || property.area_m2 ? `${property.area_private_m2 || property.area_m2} m2` : '',
  ].filter(Boolean).join(' | ')
  const price = formatCurrency(property.price)
  const url = `${getPublicAppUrl(origin)}${propertyDetailsPath(property)}`

  return [
    `${index + 1}. ${property.title || 'Imovel selecionado'}`,
    location ? `Local: ${location}` : '',
    price ? `Valor: ${price}` : '',
    specs ? `Ficha: ${specs}` : '',
    `Link: ${url}`,
  ].filter(Boolean).join('\n')
}

function buildPropertyResponse(params: {
  command: any
  selected: any[]
  total: number
  origin?: string | null
}) {
  const requester = cleanString(params.command?.identity_label, 80) || 'pessoal'
  if (!params.selected.length) {
    return [
      `${requester}, falei com a Bianca Cadastro Imoveis.`,
      'Nao encontrei imoveis ativos aderentes nesse primeiro filtro.',
      'O pedido ficou registrado no Pilger para a equipe conferir o estoque com mais detalhe.',
    ].join('\n')
  }

  return [
    `${requester}, consultei a Bianca Cadastro Imoveis.`,
    `Encontrei ${params.total} imovel(is) ativo(s) como base e separei ${params.selected.length} opcao(oes) para olhar primeiro:`,
    '',
    params.selected.map((property, index) => formatPropertyLine(property, index, params.origin)).join('\n\n'),
  ].join('\n')
}

async function sendPropertyResponse(params: {
  phone: string
  message: string
  instanceToken?: string | null
}) {
  const phone = cleanString(params.phone, 40)
  if (!phone || !params.instanceToken) return false
  try {
    await sendWhatsAppMessage({
      phone,
      message: params.message,
      instanceToken: params.instanceToken,
    })
    return true
  } catch (error: any) {
    console.warn('[Pilger Property] WhatsApp response failed:', error?.message || error)
    return false
  }
}

async function recordPropertySignal(params: {
  supabase: SupabaseLike
  command: any
  selected: any[]
  total: number
}) {
  await recordAgentCentralSignal({
    supabase: params.supabase as any,
    agentId: 'property-register',
    eventType: 'pilger_property_stock_checked',
    entityType: 'whatsapp_global_command',
    entityId: params.command?.id || null,
    source: 'pilger-property-agent',
    label: `Bianca retornou ${params.selected.length} imovel(is) ao Pilger`,
    importanceScore: params.selected.length ? 62 : 54,
    metadata: {
      command_id: params.command?.id || null,
      requested_by_phone: params.command?.phone || null,
      requested_by_label: params.command?.identity_label || null,
      matched_count: params.total,
      selected_count: params.selected.length,
      selected_properties: params.selected.map(property => ({
        id: property.id || null,
        title: property.title || null,
        city: property.city || null,
        neighborhood: property.neighborhood || null,
        price: property.price || null,
      })),
      text_preview: cleanString(params.command?.command_text, 360) || null,
    },
    handoffTargets: ['whatsapp-global-agent', 'ceo-agent', 'social-attendance-agent'],
  }).catch((error: any) => {
    console.warn('[Pilger Property] central signal failed:', error?.message || error)
  })

  await saveAgentCentralSnapshot({
    supabase: params.supabase as any,
    agentId: 'property-register',
    scope: 'stock_query',
    subjectId: params.command?.id || null,
    createdBy: 'pilger-property-agent',
    summary: `Bianca consultou estoque para o Pilger: ${params.total} ativo(s), ${params.selected.length} selecionado(s).`,
    context: {
      command_id: params.command?.id || null,
      selected_properties: params.selected,
    },
    signals: {
      matched_count: params.total,
      selected_count: params.selected.length,
      pilger_returned_to_user: true,
    },
  }).catch((error: any) => {
    console.warn('[Pilger Property] central snapshot failed:', error?.message || error)
  })
}

export async function processPilgerPropertyCommand(
  params: ProcessPilgerPropertyCommandParams,
): Promise<ProcessPilgerPropertyCommandResult> {
  const { supabase, command } = params
  if (!command?.id) return { handled: false, whatsappSent: false, error: 'missing_command' }
  if (command.status === 'blocked') return { handled: false, whatsappSent: false, error: 'blocked_command' }
  if (command.command_type !== 'property_request') return { handled: false, whatsappSent: false }

  const instanceToken = params.instanceToken || params.instance?.instance_token || null
  const shouldSendResponse = params.sendResponse !== false

  try {
    await updateCommandStatus(supabase, command.id, 'processing', {
      stage: 'pilger_property_processing_started',
      started_at: new Date().toISOString(),
    })

    const text = cleanString(command.command_text, 800)
    const scoringParams = {
      text,
      budget: parseBudget(text),
      type: requestedType(text),
      region: requestedRegion(text),
      tags: requestedTags(text),
    }
    const properties = await loadActiveProperties(supabase)
    const ranked = properties
      .map((property: any) => ({ property, score: scoreProperty(property, scoringParams) }))
      .sort((a: { property: any; score: number }, b: { property: any; score: number }) => {
        if (b.score !== a.score) return b.score - a.score
        return new Date(b.property?.created_at || 0).getTime() - new Date(a.property?.created_at || 0).getTime()
      })
    const selected = ranked.slice(0, 3).map((item: { property: any }) => item.property)
    const result = {
      stage: 'pilger_property_stock_completed',
      matched_count: properties.length,
      selected_count: selected.length,
      filters: scoringParams,
      selected_property_ids: selected.map((property: any) => property.id).filter(Boolean),
      completed_at: new Date().toISOString(),
    }

    await updateCommandStatus(supabase, command.id, 'completed', result)
    await recordPropertySignal({ supabase, command, selected, total: properties.length })

    const whatsappSent = shouldSendResponse
      ? await sendPropertyResponse({
        phone: command.phone,
        message: buildPropertyResponse({ command, selected, total: properties.length, origin: params.origin }),
        instanceToken,
      })
      : false

    return {
      handled: true,
      whatsappSent,
      matchedCount: properties.length,
      selectedCount: selected.length,
    }
  } catch (error: any) {
    const message = error?.message || String(error)
    console.error('[Pilger Property] command failed:', message)
    await updateCommandStatus(supabase, command.id, 'failed', {
      stage: 'pilger_property_failed',
      error: message,
      failed_at: new Date().toISOString(),
    }).catch(() => null)

    const whatsappSent = shouldSendResponse
      ? await sendPropertyResponse({
        phone: command.phone,
        message: [
          'A Bianca recebeu seu pedido de imoveis, mas nao conseguiu concluir a consulta agora.',
          'O comando ficou registrado no Pilger para revisao interna.',
        ].join('\n'),
        instanceToken,
      })
      : false

    return {
      handled: true,
      whatsappSent,
      error: message,
    }
  }
}
