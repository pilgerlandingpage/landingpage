import { createAdminClient } from '@/lib/supabase/server'

export const META_WHATSAPP_DEFAULT_API_VERSION = 'v21.0'

const CONFIG_KEYS = [
  'meta_app_id',
  'meta_app_secret',
  'meta_access_token',
  'meta_whatsapp_enabled',
  'meta_whatsapp_business_account_id',
  'meta_whatsapp_default_phone_number_id',
  'meta_whatsapp_access_token',
  'meta_whatsapp_webhook_verify_token',
  'meta_whatsapp_app_secret',
  'meta_whatsapp_api_version',
  'meta_whatsapp_default_language',
  'meta_whatsapp_support_redirect_phone',
  'meta_whatsapp_send_rate_per_minute',
  'meta_whatsapp_daily_limit_per_number',
] as const

type ConfigMap = Record<string, string | undefined>

export interface MetaWhatsAppResolvedConfig {
  enabled: boolean
  wabaId: string
  defaultPhoneNumberId: string
  accessToken: string
  appId: string
  appSecret: string
  apiVersion: string
  defaultLanguage: string
  supportRedirectPhone: string
  sendRatePerMinute: number
  dailyLimitPerNumber: number
  usedGeneralMetaToken: boolean
  missing: string[]
}

export interface MetaWhatsAppSender {
  id: string
  display_phone_number?: string
  verified_name?: string
  status?: string
  quality_rating?: string
  messaging_limit_tier?: string
  account_mode?: string
}

export interface MetaWhatsAppTemplate {
  id?: string
  name: string
  language: string
  status?: string
  category?: string
  components?: unknown[]
  quality_score?: unknown
}

export interface MetaWhatsAppTemplateMutationInput {
  name?: string
  language?: string
  category?: string
  components?: unknown[]
  templateId?: string
  messageSendTtlSeconds?: number
}

export interface UploadMetaWhatsAppTemplateMediaInput {
  fileName: string
  fileType: string
  fileBuffer: Buffer
  config?: ConfigMap
}

export interface SendTemplateMessageInput {
  to: string
  templateName: string
  language?: string
  phoneNumberId?: string
  components?: unknown[]
  config?: ConfigMap
}

export interface SendTextMessageInput {
  to: string
  text: string
  phoneNumberId?: string
  config?: ConfigMap
  previewUrl?: boolean
}

export interface MetaWhatsAppConnectionTest {
  success: boolean
  message: string
  config: MetaWhatsAppResolvedConfig
  senders: MetaWhatsAppSender[]
  templates: MetaWhatsAppTemplate[]
  warnings: string[]
}

class MetaWhatsAppApiError extends Error {
  status: number
  code?: string | number
  type?: string

  constructor(message: string, status: number, payload?: any) {
    super(message)
    this.name = 'MetaWhatsAppApiError'
    this.status = status
    this.code = payload?.error?.code
    this.type = payload?.error?.type
  }
}

function cleanText(value: unknown, maxLength = 300) {
  return String(value || '').trim().slice(0, maxLength)
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const selected = cleanText(value, 5000)
    if (selected) return selected
  }
  return ''
}

function normalizeGraphVersion(value?: string) {
  const selected = cleanText(value || META_WHATSAPP_DEFAULT_API_VERSION, 20).toLowerCase()
  return /^v\d+\.\d+$/.test(selected) ? selected : META_WHATSAPP_DEFAULT_API_VERSION
}

function positiveInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function normalizeLanguage(value?: string) {
  const selected = cleanText(value || 'pt_BR', 12).replace('-', '_')
  return /^[a-z]{2}_[A-Z]{2}$/.test(selected) ? selected : 'pt_BR'
}

export function normalizeMetaWhatsAppPhone(value: unknown) {
  return String(value || '').replace(/\D/g, '').slice(0, 20)
}

export async function loadMetaWhatsAppConfigMap(supabase = createAdminClient()) {
  const { data, error } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', [...CONFIG_KEYS])

  if (error) throw error

  const map: Record<string, string> = {}
  for (const row of data || []) {
    if (row?.key) map[row.key] = String(row.value || '')
  }
  return map
}

export function resolveMetaWhatsAppConfig(config: ConfigMap = {}): MetaWhatsAppResolvedConfig {
  const accessToken = firstText(
    config.meta_whatsapp_access_token,
    process.env.META_WHATSAPP_ACCESS_TOKEN,
    config.meta_access_token,
    process.env.META_ACCESS_TOKEN
  )
  const appSecret = firstText(
    config.meta_whatsapp_app_secret,
    process.env.META_WHATSAPP_APP_SECRET,
    config.meta_app_secret,
    process.env.META_APP_SECRET
  )
  const wabaId = firstText(
    config.meta_whatsapp_business_account_id,
    process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID
  )
  const defaultPhoneNumberId = firstText(
    config.meta_whatsapp_default_phone_number_id,
    process.env.META_WHATSAPP_DEFAULT_PHONE_NUMBER_ID
  )
  const appId = firstText(config.meta_app_id, process.env.META_APP_ID)
  const defaultLanguage = normalizeLanguage(firstText(
    config.meta_whatsapp_default_language,
    process.env.META_WHATSAPP_DEFAULT_LANGUAGE,
    'pt_BR'
  ))

  const missing: string[] = []
  if (!wabaId) missing.push('WhatsApp Business Account ID')
  if (!accessToken) missing.push('System User Access Token')

  return {
    enabled: firstText(config.meta_whatsapp_enabled, process.env.META_WHATSAPP_ENABLED) === 'true',
    wabaId,
    defaultPhoneNumberId,
    accessToken,
    appId,
    appSecret,
    apiVersion: normalizeGraphVersion(firstText(config.meta_whatsapp_api_version, process.env.META_WHATSAPP_API_VERSION)),
    defaultLanguage,
    supportRedirectPhone: normalizeMetaWhatsAppPhone(firstText(
      config.meta_whatsapp_support_redirect_phone,
      process.env.META_WHATSAPP_SUPPORT_REDIRECT_PHONE
    )),
    sendRatePerMinute: positiveInt(
      firstText(config.meta_whatsapp_send_rate_per_minute, process.env.META_WHATSAPP_SEND_RATE_PER_MINUTE),
      40,
      1,
      1000
    ),
    dailyLimitPerNumber: positiveInt(
      firstText(config.meta_whatsapp_daily_limit_per_number, process.env.META_WHATSAPP_DAILY_LIMIT_PER_NUMBER),
      1000,
      1,
      1000000
    ),
    usedGeneralMetaToken: !firstText(config.meta_whatsapp_access_token, process.env.META_WHATSAPP_ACCESS_TOKEN)
      && Boolean(firstText(config.meta_access_token, process.env.META_ACCESS_TOKEN)),
    missing,
  }
}

async function graphRequest<T>(
  resolved: MetaWhatsAppResolvedConfig,
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE'
    params?: Record<string, string>
    body?: Record<string, unknown>
  } = {}
): Promise<T> {
  const url = new URL(`https://graph.facebook.com/${resolved.apiVersion}${path.startsWith('/') ? path : `/${path}`}`)
  for (const [key, value] of Object.entries(options.params || {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, value)
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${resolved.accessToken}`,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  })
  const text = await response.text()
  let payload: any = {}
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = { message: text }
  }

  if (!response.ok || payload?.error) {
    const message = cleanText(payload?.error?.message || payload?.message || response.statusText || 'Erro Meta WhatsApp', 500)
    throw new MetaWhatsAppApiError(message, response.status, payload)
  }

  return payload as T
}

export async function getMetaWhatsAppTokenDiagnostics(config: ConfigMap = {}) {
  const resolved = resolveMetaWhatsAppConfig(config)
  if (!resolved.accessToken || !resolved.appId || !resolved.appSecret) return null

  const appAccessToken = `${resolved.appId}|${resolved.appSecret}`
  const url = new URL(`https://graph.facebook.com/${resolved.apiVersion}/debug_token`)
  url.searchParams.set('input_token', resolved.accessToken)
  url.searchParams.set('access_token', appAccessToken)

  const response = await fetch(url, { cache: 'no-store' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload?.error) return null

  const scopes = Array.isArray(payload.data?.scopes) ? payload.data.scopes as string[] : []
  const hasMessaging = scopes.includes('whatsapp_business_messaging')
  const hasManagement = scopes.includes('whatsapp_business_management')

  return {
    isValid: Boolean(payload.data?.is_valid),
    scopes,
    hasMessaging,
    hasManagement,
    missingScopes: [
      ...(!hasMessaging ? ['whatsapp_business_messaging'] : []),
      ...(!hasManagement ? ['whatsapp_business_management'] : []),
    ],
  }
}

export async function listMetaWhatsAppSenders(config: ConfigMap = {}) {
  const resolved = resolveMetaWhatsAppConfig(config)
  if (resolved.missing.length) {
    throw new Error(`Configuracao incompleta: ${resolved.missing.join(', ')}`)
  }

  const payload = await graphRequest<{ data?: MetaWhatsAppSender[] }>(resolved, `/${resolved.wabaId}/phone_numbers`, {
    params: {
      fields: 'id,display_phone_number,verified_name,status,quality_rating,messaging_limit_tier,account_mode',
      limit: '100',
    },
  })

  return payload.data || []
}

export async function getMetaWhatsAppPhoneNumber(phoneNumberId: string, config: ConfigMap = {}) {
  const resolved = resolveMetaWhatsAppConfig(config)
  if (!resolved.accessToken) throw new Error('System User Access Token ausente.')

  return graphRequest<MetaWhatsAppSender>(resolved, `/${cleanText(phoneNumberId, 80)}`, {
    params: {
      fields: 'id,display_phone_number,verified_name,status,quality_rating,messaging_limit_tier,account_mode',
    },
  })
}

export async function listMetaWhatsAppTemplates(config: ConfigMap = {}) {
  const resolved = resolveMetaWhatsAppConfig(config)
  if (resolved.missing.length) {
    throw new Error(`Configuracao incompleta: ${resolved.missing.join(', ')}`)
  }

  const payload = await graphRequest<{ data?: MetaWhatsAppTemplate[] }>(resolved, `/${resolved.wabaId}/message_templates`, {
    params: {
      fields: 'id,name,language,status,category,components,quality_score',
      limit: '100',
    },
  })

  return payload.data || []
}

function normalizeTemplateCategory(value?: string) {
  const selected = cleanText(value || 'MARKETING', 40).toUpperCase()
  return ['MARKETING', 'UTILITY', 'AUTHENTICATION'].includes(selected) ? selected : 'MARKETING'
}

export function normalizeMetaWhatsAppTemplateName(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 512)
}

function cleanTemplateComponents(value: unknown): unknown[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(component => typeof component === 'object' && component !== null && !Array.isArray(component))
    .map(component => component as Record<string, unknown>)
    .filter(component => cleanText(component.type, 30))
}

export async function createMetaWhatsAppTemplate(input: MetaWhatsAppTemplateMutationInput, config: ConfigMap = {}) {
  const resolved = resolveMetaWhatsAppConfig(config)
  if (resolved.missing.length) throw new Error(`Configuracao incompleta: ${resolved.missing.join(', ')}`)

  const name = normalizeMetaWhatsAppTemplateName(input.name)
  const components = cleanTemplateComponents(input.components)
  if (!name) throw new Error('Nome do template obrigatorio.')
  if (!components.some(component => cleanText((component as Record<string, unknown>).type).toUpperCase() === 'BODY')) {
    throw new Error('Template precisa ter componente BODY.')
  }

  return graphRequest<{ id?: string; status?: string; category?: string }>(resolved, `/${resolved.wabaId}/message_templates`, {
    method: 'POST',
    body: {
      name,
      language: normalizeLanguage(input.language || resolved.defaultLanguage),
      category: normalizeTemplateCategory(input.category),
      components,
      ...(input.messageSendTtlSeconds ? { message_send_ttl_seconds: input.messageSendTtlSeconds } : {}),
    },
  })
}

export async function editMetaWhatsAppTemplate(input: MetaWhatsAppTemplateMutationInput, config: ConfigMap = {}) {
  const resolved = resolveMetaWhatsAppConfig(config)
  if (!resolved.accessToken) throw new Error('System User Access Token ausente.')

  const templateId = cleanText(input.templateId, 120)
  const components = cleanTemplateComponents(input.components)
  if (!templateId) throw new Error('ID Meta do template obrigatorio para editar.')

  const body: Record<string, unknown> = {
    ...(input.category ? { category: normalizeTemplateCategory(input.category) } : {}),
    ...(components.length ? { components } : {}),
    ...(input.messageSendTtlSeconds ? { message_send_ttl_seconds: input.messageSendTtlSeconds } : {}),
  }
  if (!Object.keys(body).length) throw new Error('Informe ao menos categoria, componentes ou TTL para editar.')

  return graphRequest<{ success?: boolean; id?: string; status?: string }>(resolved, `/${templateId}`, {
    method: 'POST',
    body,
  })
}

export async function deleteMetaWhatsAppTemplate(input: MetaWhatsAppTemplateMutationInput, config: ConfigMap = {}) {
  const resolved = resolveMetaWhatsAppConfig(config)
  if (resolved.missing.length) throw new Error(`Configuracao incompleta: ${resolved.missing.join(', ')}`)

  const templateId = cleanText(input.templateId, 120)
  const name = normalizeMetaWhatsAppTemplateName(input.name)
  if (templateId) {
    return graphRequest<{ success?: boolean }>(resolved, `/${templateId}`, { method: 'DELETE' })
  }
  if (!name) throw new Error('Informe o nome ou ID Meta do template para excluir.')

  return graphRequest<{ success?: boolean }>(resolved, `/${resolved.wabaId}/message_templates`, {
    method: 'DELETE',
    params: { name },
  })
}

export async function uploadMetaWhatsAppTemplateHeaderMedia(input: UploadMetaWhatsAppTemplateMediaInput) {
  const resolved = resolveMetaWhatsAppConfig(input.config || {})
  if (!resolved.accessToken) throw new Error('System User Access Token ausente.')
  if (!resolved.appId) throw new Error('Meta App ID ausente.')

  const fileName = cleanText(input.fileName, 255)
  const fileType = cleanText(input.fileType, 120)
  if (!fileName) throw new Error('Nome da midia obrigatorio.')
  if (!fileType) throw new Error('Tipo da midia obrigatorio.')
  if (!input.fileBuffer.byteLength) throw new Error('Arquivo de midia vazio.')

  const session = await graphRequest<{ id?: string }>(resolved, `/${resolved.appId}/uploads`, {
    method: 'POST',
    params: {
      file_name: fileName,
      file_length: String(input.fileBuffer.byteLength),
      file_type: fileType,
    },
  })

  const sessionId = cleanText(session.id, 5000)
  if (!sessionId) throw new Error('A Meta nao retornou a sessao de upload da midia.')

  const response = await fetch(`https://graph.facebook.com/${resolved.apiVersion}/${sessionId}`, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${resolved.accessToken}`,
      'Content-Type': fileType,
      file_offset: '0',
    },
    body: input.fileBuffer as unknown as BodyInit,
    cache: 'no-store',
  })

  const text = await response.text()
  let payload: any = {}
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = { message: text }
  }

  if (!response.ok || payload?.error) {
    const message = cleanText(payload?.error?.message || payload?.message || response.statusText || 'Erro ao carregar midia na Meta', 500)
    throw new MetaWhatsAppApiError(message, response.status, payload)
  }

  const handle = cleanText(payload?.h, 5000)
  if (!handle) throw new Error('A Meta nao retornou o handle da midia.')

  return {
    handle,
    uploadSessionId: sessionId,
    raw: payload,
  }
}

export async function sendMetaWhatsAppTemplateMessage(input: SendTemplateMessageInput) {
  const resolved = resolveMetaWhatsAppConfig(input.config || {})
  const phoneNumberId = cleanText(input.phoneNumberId || resolved.defaultPhoneNumberId, 80)
  const to = normalizeMetaWhatsAppPhone(input.to)

  if (!resolved.accessToken) throw new Error('System User Access Token ausente.')
  if (!phoneNumberId) throw new Error('Phone Number ID ausente.')
  if (!to) throw new Error('Destinatario WhatsApp ausente.')

  const payload = await graphRequest<{ messages?: Array<{ id?: string }> }>(resolved, `/${phoneNumberId}/messages`, {
    method: 'POST',
    body: {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: cleanText(input.templateName, 120),
        language: { code: normalizeLanguage(input.language || resolved.defaultLanguage) },
        ...(input.components?.length ? { components: input.components } : {}),
      },
    },
  })

  return {
    providerMessageId: payload.messages?.[0]?.id || '',
    raw: payload,
  }
}

export async function sendMetaWhatsAppTextMessage(input: SendTextMessageInput) {
  const resolved = resolveMetaWhatsAppConfig(input.config || {})
  const phoneNumberId = cleanText(input.phoneNumberId || resolved.defaultPhoneNumberId, 80)
  const to = normalizeMetaWhatsAppPhone(input.to)
  const text = cleanText(input.text, 4096)

  if (!resolved.accessToken) throw new Error('System User Access Token ausente.')
  if (!phoneNumberId) throw new Error('Phone Number ID ausente.')
  if (!to) throw new Error('Destinatario WhatsApp ausente.')
  if (!text) throw new Error('Mensagem vazia.')

  const payload = await graphRequest<{ messages?: Array<{ id?: string }> }>(resolved, `/${phoneNumberId}/messages`, {
    method: 'POST',
    body: {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        body: text,
        preview_url: Boolean(input.previewUrl),
      },
    },
  })

  return {
    providerMessageId: payload.messages?.[0]?.id || '',
    raw: payload,
  }
}

export async function syncMetaWhatsAppAssets(config: ConfigMap = {}, supabase = createAdminClient()) {
  const resolved = resolveMetaWhatsAppConfig(config)
  const [senders, templates] = await Promise.all([
    listMetaWhatsAppSenders(config),
    listMetaWhatsAppTemplates(config),
  ])

  if (senders.length) {
    const senderRows = senders.map(sender => ({
      display_name: sender.verified_name || sender.display_phone_number || sender.id,
      phone_number: normalizeMetaWhatsAppPhone(sender.display_phone_number),
      phone_number_id: sender.id,
      waba_id: resolved.wabaId,
      local_status: 'active',
      meta_status: sender.status || null,
      quality_rating: sender.quality_rating || null,
      messaging_limit_tier: sender.messaging_limit_tier || null,
      account_mode: sender.account_mode || null,
      send_rate_per_minute: resolved.sendRatePerMinute,
      daily_limit: resolved.dailyLimitPerNumber,
      last_health_check_at: new Date().toISOString(),
      last_error: null,
      metadata: sender as unknown as Record<string, unknown>,
    }))

    const { error } = await supabase
      .from('meta_whatsapp_senders')
      .upsert(senderRows, { onConflict: 'phone_number_id' })
    if (error) throw error
  }

  if (templates.length) {
    const templateRows = templates.map(template => ({
      waba_id: resolved.wabaId,
      template_external_id: template.id || null,
      name: template.name,
      language: template.language || resolved.defaultLanguage,
      category: template.category || 'UNKNOWN',
      status: template.status || 'unknown',
      quality_score: typeof template.quality_score === 'string' ? template.quality_score : null,
      components: Array.isArray(template.components) ? template.components : [],
      last_synced_at: new Date().toISOString(),
      metadata: template as unknown as Record<string, unknown>,
    }))

    const { error } = await supabase
      .from('meta_whatsapp_templates')
      .upsert(templateRows, { onConflict: 'waba_id,name,language' })
    if (error) throw error
  }

  return {
    senders,
    templates,
    senderCount: senders.length,
    templateCount: templates.length,
  }
}

export async function testMetaWhatsAppConnection(config: ConfigMap = {}) {
  const resolved = resolveMetaWhatsAppConfig(config)
  const warnings: string[] = []

  if (resolved.missing.length) {
    return {
      success: false,
      message: `Preencha ${resolved.missing.join(' e ')}.`,
      config: resolved,
      senders: [],
      templates: [],
      warnings,
    } satisfies MetaWhatsAppConnectionTest
  }

  if (resolved.usedGeneralMetaToken) {
    warnings.push('Usando fallback do token geral da Meta. Recomenda-se token proprio para WhatsApp oficial.')
  }
  if (!resolved.defaultPhoneNumberId) {
    warnings.push('Phone Number ID padrao ainda nao informado; campanhas usarao o pool sincronizado.')
  }

  const diagnostics = await getMetaWhatsAppTokenDiagnostics(config)
  if (diagnostics?.isValid && diagnostics.missingScopes.length) {
    return {
      success: false,
      message: `Token valido, mas sem permissao: ${diagnostics.missingScopes.join(', ')}.`,
      config: resolved,
      senders: [],
      templates: [],
      warnings,
    } satisfies MetaWhatsAppConnectionTest
  }

  const senders = await listMetaWhatsAppSenders(config)
  const templates = await listMetaWhatsAppTemplates(config)
  const approvedTemplates = templates.filter(template => String(template.status || '').toUpperCase() === 'APPROVED').length
  const defaultSenderFound = resolved.defaultPhoneNumberId
    ? senders.some(sender => sender.id === resolved.defaultPhoneNumberId)
    : true

  if (!senders.length) {
    return {
      success: false,
      message: 'Token aceito, mas nenhum numero oficial foi encontrado nesse WABA.',
      config: resolved,
      senders,
      templates,
      warnings,
    } satisfies MetaWhatsAppConnectionTest
  }

  if (!defaultSenderFound) {
    warnings.push('O Phone Number ID padrao nao aparece na lista de numeros desse WABA.')
  }

  const warningSuffix = warnings.length ? ` Avisos: ${warnings.join(' | ')}` : ''
  return {
    success: true,
    message: `WhatsApp Cloud API conectada. ${senders.length} numero(s) oficial(is), ${approvedTemplates} template(s) aprovado(s).${warningSuffix}`,
    config: resolved,
    senders,
    templates,
    warnings,
  } satisfies MetaWhatsAppConnectionTest
}
