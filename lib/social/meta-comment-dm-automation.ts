import { chatWithGemini, getGeminiApiKey } from '@/lib/gemini'
import { getAIConfig, getOpenAIApiKey } from '@/lib/ai/config'
import { saveAppConfig } from '@/lib/admin/app-config'
import { getPublicAppUrl } from '@/lib/app-url'
import { analyzeVoteProofMedia, type VoteProofMediaKind } from '@/lib/events/vote-proof-validation'
import { createAdminClient } from '@/lib/supabase/server'
import {
  getFacebookGraphBaseUrl,
  getInstagramGraphConnection,
  getInstagramGraphConnectionIssue,
} from '@/lib/social/instagram-connection'

type SupabaseAdmin = ReturnType<typeof createAdminClient>
type Platform = 'instagram' | 'facebook'
type CampaignMode = 'manual' | 'auto'
type CampaignStatus = 'draft' | 'active' | 'paused' | 'archived'
type DeliveryDecision = 'matched' | 'not_matched' | 'needs_review' | 'skipped' | 'error'
type DeliverySendStatus = 'pending_approval' | 'sent' | 'skipped' | 'error'

type AppConfig = {
  enabled: boolean
  webhookAutoprocess: boolean
  cronEnabled: boolean
  facebookPageId: string
  facebookPageToken: string
  metaAccessToken: string
  instagramConnectionIssue: string
  instagramOwnedIds: Set<string>
  raw: Record<string, string>
}

type CampaignRow = {
  id: string
  name: string
  platform: Platform
  media_external_id: string | null
  post_permalink: string | null
  trigger_intent: string
  trigger_examples: string[] | null
  reply_message: string
  confidence_threshold: number
  mode: CampaignMode
  status: CampaignStatus
  max_replies_per_hour: number
  raw?: Record<string, unknown> | null
  created_at?: string
  updated_at?: string
}

type CommentRow = {
  id: string
  platform: Platform
  external_id: string
  media_external_id: string | null
  parent_external_id: string | null
  author_id: string | null
  author_name: string | null
  message: string | null
  permalink: string | null
  commented_at: string | null
  created_at?: string | null
  updated_at?: string | null
  raw?: Record<string, unknown> | null
}

type DeliveryRow = {
  id: string
  campaign_id: string
  comment_id: string | null
  platform: Platform
  comment_external_id: string
  media_external_id: string | null
  author_id: string | null
  author_name: string | null
  comment_text: string | null
  ai_matches: boolean
  ai_confidence: number
  ai_reason: string | null
  normalized_intent: string | null
  reply_message: string | null
  decision: DeliveryDecision
  send_status: DeliverySendStatus
  private_reply_external_id: string | null
  private_reply_channel: string | null
  error: string | null
  processed_at: string | null
  sent_at: string | null
  raw?: Record<string, unknown> | null
  created_at?: string
  updated_at?: string
}

type CampaignMediaRow = {
  id: string
  platform: Platform
  external_id: string
  media_type: string | null
  media_product_type: string | null
  caption: string | null
  permalink: string | null
  thumbnail_url: string | null
  media_url: string | null
  published_at: string | null
  like_count: number
  comments_count: number
}

type AiDecision = {
  matches: boolean
  confidence: number
  reason: string
  normalizedIntent: string
  safetyFlags: string[]
  suggestedReply?: string
  raw?: unknown
}

type MetaSendResult = {
  external_id?: string
  recipient_id?: string
  channel?: string
  raw?: unknown
}

type MetaMessagePayload =
  | { text: string }
  | {
      attachment: {
        type: 'template'
        payload: {
          template_type: 'button'
          text: string
          buttons: MetaMessageButton[]
        }
      }
    }

type MetaMessageSendPlan = {
  kind: 'button_template' | 'text'
  message: MetaMessagePayload
}

type MetaMessageButton =
  | { type: 'web_url'; url: string; title: string }
  | { type: 'postback'; payload: string; title: string }

type MetaMessageButtonInput = {
  type?: unknown
  url?: unknown
  payload?: unknown
  title?: unknown
  label?: unknown
}

type VoteDiscountFlow = {
  type: 'vote_discount'
  enabled: boolean
  already_voted_label: string
  will_vote_label: string
  already_voted_message: string
  already_voted_button_title: string
  discount_url: string
  vote_message: string
  vote_button_title: string
  vote_url: string
  followup_enabled: boolean
  followup_delay_minutes: number
  followup_message: string
  followup_button_title: string
}

type CommentDmFlowAction = 'JA_VOTEI' | 'VOU_VOTAR'

type FlowFollowupRow = {
  id: string
  campaign_id: string | null
  delivery_id: string | null
  platform: Platform
  recipient_id: string
  sender_id: string | null
  action: string
  status: 'pending' | 'sent' | 'cancelled' | 'error'
  due_at: string
  attempts: number
  message: string
  buttons: unknown[] | null
  idempotency_key: string
  error: string | null
  raw?: Record<string, unknown> | null
  sent_at: string | null
  created_at?: string
  updated_at?: string
}

type WebhookCommentEvent = {
  platform: Platform
  external_id: string
  media_external_id: string | null
  parent_external_id: string | null
  author_id: string | null
  author_name: string | null
  message: string
  commented_at: string | null
  raw: Record<string, unknown>
}

type WebhookMessageEvent = {
  platform: Platform
  thread_id: string | null
  thread_external_id: string
  external_id: string
  sender_id: string
  recipient_id: string
  text: string | null
  postback_payload: string | null
  postback_title: string | null
  attachment_type: string | null
  attachment_url: string | null
  sent_at: string | null
  duplicate: boolean
  raw: Record<string, unknown>
}

const CAMPAIGN_SYSTEM_PROMPT = [
  'Voce decide se um comentario de Meta (Instagram ou Facebook) corresponde a uma campanha de mensagem privada da Pilger.',
  'Nao opere como bot de palavra-chave. Entenda intencao, sinonimos, pequenas variacoes, erros de digitacao e frases com palavras extras.',
  'Exemplo: se a campanha pede "corretor nota 8", comentarios como "eu quero corretor nota 8", "manda o corretor nota 8" ou "quero saber desse corretor nota 8" devem corresponder.',
  'Rejeite comentario claramente fora do assunto, spam, ofensa, reclamacao sem pedido da campanha, ironia, opt-out ou pedido que exija humano.',
  'Retorne somente JSON valido no schema pedido.',
].join('\n')

const COMMENT_DM_POSTBACK_PREFIX = 'COMMENT_DM_FLOW'
const COMMENT_DM_ACTION_ALREADY_VOTED: CommentDmFlowAction = 'JA_VOTEI'
const COMMENT_DM_ACTION_WILL_VOTE: CommentDmFlowAction = 'VOU_VOTAR'
const COMMENT_DM_FLOW_FOLLOWUP_ACTION = 'vote_discount_followup'

const DEFAULT_VOTE_DISCOUNT_FLOW: VoteDiscountFlow = {
  type: 'vote_discount',
  enabled: false,
  already_voted_label: 'Ja votei',
  will_vote_label: 'Vou votar',
  already_voted_message: 'Obrigado por apoiar a votação.\n\nComo agradecimento, liberei 30% de desconto para você garantir o livro Corretor Nota 8.\n\nClique no botão abaixo e aproveite essa condição especial.',
  already_voted_button_title: 'Comprar livro',
  discount_url: '',
  vote_message: 'Perfeito. Clique no botao abaixo para abrir a votacao. Depois volte aqui quando terminar.',
  vote_button_title: 'Votar agora',
  vote_url: '',
  followup_enabled: true,
  followup_delay_minutes: 3,
  followup_message: 'Obrigado por apoiar a votação.\n\nComo agradecimento, liberei 30% de desconto para você garantir o livro Corretor Nota 8.\n\nClique no botão abaixo e aproveite essa condição especial.',
  followup_button_title: 'Comprar livro',
}

function nowIso() {
  return new Date().toISOString()
}

function cleanString(value: unknown, max = 3000) {
  const text = String(value || '').trim()
  return text.length > max ? text.slice(0, max) : text
}

function nullableString(value: unknown, max = 3000) {
  const text = cleanString(value, max)
  return text || null
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), min), max)
}

function cleanBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  const text = String(value || '').trim().toLowerCase()
  if (['true', '1', 'yes', 'sim', 'on'].includes(text)) return true
  if (['false', '0', 'no', 'nao', 'off'].includes(text)) return false
  return fallback
}

function cleanButtonTitle(value: unknown, fallback: string) {
  return cleanString(value || fallback, 20) || cleanString(fallback, 20)
}

function cleanButtonPayload(value: unknown) {
  return cleanString(value, 1000)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function buildCommentDmPostbackPayload(action: CommentDmFlowAction, deliveryId?: string | null) {
  const id = cleanString(deliveryId, 80)
  return id ? `${COMMENT_DM_POSTBACK_PREFIX}:${action}:${id}` : `${COMMENT_DM_POSTBACK_PREFIX}:${action}`
}

function parseCommentDmPostbackPayload(value: unknown): { action: CommentDmFlowAction; deliveryId: string } | null {
  const text = cleanButtonPayload(value)
  const parts = text.split(':')
  if (parts[0] !== COMMENT_DM_POSTBACK_PREFIX) return null
  const action = parts[1] === COMMENT_DM_ACTION_ALREADY_VOTED || parts[1] === COMMENT_DM_ACTION_WILL_VOTE
    ? parts[1]
    : null
  if (!action) return null
  return {
    action,
    deliveryId: cleanString(parts[2], 80),
  }
}

function inferCommentDmFlowActionFromText(value: unknown): CommentDmFlowAction | null {
  const normalized = normalizeText(value)
  if (!normalized) return null
  if (/\b(ja votei|votei|ja fiz|fiz o voto)\b/.test(normalized)) return COMMENT_DM_ACTION_ALREADY_VOTED
  if (/\b(vou votar|votar agora|quero votar|abrir votacao)\b/.test(normalized)) return COMMENT_DM_ACTION_WILL_VOTE
  return null
}

function getCommentDmBatchSendDelayMs() {
  return clampNumber(process.env.META_COMMENT_DM_BATCH_SEND_DELAY_MS, 1200, 0, 5000)
}

function sleep(ms: number) {
  return ms > 0 ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve()
}

function normalizeMode(value: unknown): CampaignMode {
  return value === 'auto' ? 'auto' : 'manual'
}

function normalizePlatform(value: unknown): Platform | null {
  const text = String(value || '').toLowerCase()
  if (text.includes('instagram')) return 'instagram'
  if (text.includes('facebook') || text.includes('page')) return 'facebook'
  return null
}

function normalizeStatus(value: unknown): CampaignStatus {
  const text = String(value || '').toLowerCase()
  if (text === 'active' || text === 'paused' || text === 'archived' || text === 'draft') return text
  return 'draft'
}

function parseExamples(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(item => cleanString(item, 160)).filter(Boolean).slice(0, 12)
  }
  return String(value || '')
    .split(/\r?\n|,/)
    .map(item => cleanString(item, 160))
    .filter(Boolean)
    .slice(0, 12)
}

function cleanJson(text: string) {
  return text
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim()
}

function removeDiacritics(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizeText(value: unknown) {
  return removeDiacritics(String(value || '').toLowerCase())
    .replace(/\boito\b/g, '8')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getSaoPauloGreeting(date = new Date()) {
  const hourText = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    hour12: false,
  }).format(date)
  const hour = Number(hourText)
  if (Number.isFinite(hour)) {
    if (hour < 12) return 'Bom dia'
    if (hour < 18) return 'Boa tarde'
  }
  return 'Boa noite'
}

function formatInstagramUsername(value: unknown) {
  const text = cleanString(value, 120).replace(/^@+/, '').trim()
  return text ? `@${text}` : ''
}

function publicCommentRecipientName(value: unknown) {
  const text = cleanString(value, 120).replace(/^@+/, '').trim()
  if (!text) return ''
  if (/^[a-z0-9._]+$/i.test(text)) return `@${text}`
  return cleanString(text.split(/\s+/)[0], 80)
}

function buildPublicCommentReply(delivery: DeliveryRow) {
  const name = publicCommentRecipientName(delivery.author_name)
  const channelName = delivery.platform === 'facebook' ? 'Messenger' : 'Direct'
  return cleanString(name ? `${name}, te enviei uma mensagem no ${channelName}.` : `Te enviei uma mensagem no ${channelName}.`, 300)
}

function firstInstagramName(value: unknown) {
  const text = cleanString(value, 120).replace(/^@+/, '').trim()
  if (!text) return ''
  if (/^[a-z0-9._]+$/i.test(text)) return formatInstagramUsername(text)
  return cleanString(text.split(/\s+/)[0], 80) || text
}

function repairKnownPortugueseArtifacts(value: string) {
  return value
    .replace(/Est\?/g, 'Est\u00e1')
    .replace(/est\?/g, 'est\u00e1')
    .replace(/n\?o/g, 'n\u00e3o')
    .replace(/seguran\?a/gi, 'seguran\u00e7a')
    .replace(/confirma\?\?o/gi, 'confirma\u00e7\u00e3o')
    .replace(/confirma\?o/gi, 'confirma\u00e7\u00e3o')
    .replace(/vota\?\?o/gi, 'vota\u00e7\u00e3o')
    .replace(/vota\?o/gi, 'vota\u00e7\u00e3o')
    .replace(/espa\?o/gi, 'espa\u00e7o')
    .replace(/pr\?ximo/gi, 'pr\u00f3ximo')
    .replace(/pr\?mio/gi, 'pr\u00eamio')
    .replace(/diferen\?a/gi, 'diferen\u00e7a')
    .replace(/Voc\?/g, 'Voc\u00ea')
    .replace(/voc\?/g, 'voc\u00ea')
    .replace(/receber\?/g, 'receber\u00e1')
}

function stripTrailingUrlPunctuation(value: string) {
  return value.replace(/[)\].,;!?]+$/g, '')
}

function extractFirstHttpUrl(value: string) {
  const match = value.match(/https?:\/\/[^\s<>"']+/i)
  if (!match) return ''
  const candidate = stripTrailingUrlPunctuation(match[0])
  try {
    const url = new URL(candidate)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''
  } catch {
    return ''
  }
}

function normalizeMetaMessageButtons(value: unknown): MetaMessageButton[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item): MetaMessageButton | null => {
      if (!isRecord(item)) return null
      const type = String(item.type || '').toLowerCase()
      const title = cleanButtonTitle(item.title || item.label, '')
      if (!title) return null

      if (type === 'postback' || (!item.url && item.payload)) {
        const payload = cleanButtonPayload(item.payload)
        if (!payload) return null
        return { type: 'postback', title, payload }
      }

      const url = extractFirstHttpUrl(cleanString(item.url, 1600))
      if (!url) return null
      return { type: 'web_url', title, url }
    })
    .filter((button): button is MetaMessageButton => Boolean(button))
    .slice(0, 3)
}

function fallbackTextForButtons(message: string, buttons: MetaMessageButton[]) {
  if (buttons.length === 0) return message

  const lines = buttons
    .map(button => {
      if (button.type === 'web_url') return `${button.title}: ${button.url}`
      return `${button.title}: responda "${button.title}" aqui no Direct.`
    })
    .filter(Boolean)

  return cleanString(`${cleanString(message, 1500)}\n\n${lines.join('\n')}`, 1800)
}

function textWithPostbackFallbackHint(message: string, buttons: MetaMessageButton[], max = 640) {
  const labels = buttons
    .filter(button => button.type === 'postback')
    .map(button => cleanButtonTitle(button.title, ''))
    .filter(Boolean)
    .slice(0, 3)
  if (labels.length === 0) return cleanString(message, max)

  const hint = `Se os botoes nao responderem, digite: ${labels.join(' ou ')}.`
  const separator = '\n\n'
  const base = cleanString(message, Math.max(0, max - hint.length - separator.length))
  return cleanString(`${base}${base ? separator : ''}${hint}`, max)
}

function buttonTitleForUrl(url: string) {
  const normalized = url.toLowerCase()
  if (normalized.includes('awards.atrincarealestate.com.br')) return 'Votar agora'
  if (normalized.includes('perfil-corretor-ideal')) return 'Abrir ferramenta'
  return 'Abrir link'
}

function compactKnownButtonText(originalMessage: string, url: string) {
  const firstLine = originalMessage
    .split(/\r?\n/)
    .map(line => cleanString(line, 140))
    .find(Boolean) || ''
  const normalizedUrl = url.toLowerCase()

  if (normalizedUrl.includes('awards.atrincarealestate.com.br')) {
    return [
      firstLine,
      '',
      'Vou liberar para você o Perfil do Corretor Ideal. Antes, preciso do seu apoio no prêmio de Influenciador do Ano.',
      '',
      'Clique em "Votar agora" e me envie aqui o print da confirmação. Assim que validar, libero seu acesso.',
    ].filter(Boolean).join('\n')
  }

  if (normalizedUrl.includes('perfil-corretor-ideal')) {
    return [
      'Perfeito, agora consegui validar o seu print. Está tudo certo.',
      '',
      'Como prometido, clique abaixo para acessar o Perfil do Corretor Ideal.',
    ].join('\n')
  }

  return ''
}

function removeUrlLabelLines(value: string) {
  return value
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .filter(line => {
      const normalized = normalizeText(line)
      return ![
        'link',
        'link para votacao',
        'link da votacao',
        'link de votacao',
        'link para votar',
        'link da ferramenta',
        'link de acesso',
        'acesse aqui',
      ].includes(normalized.replace(/:$/g, ''))
    })
    .join('\n')
}

function textWithoutUrlForButton(message: string, url: string) {
  const withoutUrl = removeUrlLabelLines(message.replace(url, ''))
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (Buffer.byteLength(withoutUrl, 'utf8') <= 640) return withoutUrl
  return compactKnownButtonText(message, url) || cleanString(withoutUrl, 640)
}

function textFallbackForButtonUrl(message: string, url: string) {
  if (!url || extractFirstHttpUrl(message)) return message
  return cleanString(`${cleanString(message, 1600)}\n\n${url}`, 1800)
}

function buildMetaMessageSendPlans(
  message: string,
  options?: string | {
    buttonUrl?: string
    buttons?: MetaMessageButtonInput[] | MetaMessageButton[]
  },
): MetaMessageSendPlan[] {
  const buttonUrl = typeof options === 'string' ? options : options?.buttonUrl
  const explicitButtons = typeof options === 'string' ? [] : normalizeMetaMessageButtons(options?.buttons)
  if (explicitButtons.length > 0) {
    const fallback: MetaMessageSendPlan = {
      kind: 'text',
      message: { text: fallbackTextForButtons(message, explicitButtons) },
    }

    if (process.env.META_COMMENT_DM_LINK_BUTTONS_ENABLED === 'false') return [fallback]

    const postbackOnly = explicitButtons.every(button => button.type === 'postback')
    const buttonText = postbackOnly
      ? textWithPostbackFallbackHint(message, explicitButtons, 640)
      : cleanString(message, 640)
    if (!buttonText) return [fallback]

    return [
      {
        kind: 'button_template',
        message: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text: buttonText,
              buttons: explicitButtons,
            },
          },
        },
      },
      fallback,
    ]
  }

  const urlFromButtonField = extractFirstHttpUrl(cleanString(buttonUrl, 1600))
  const urlFromMessage = extractFirstHttpUrl(message)
  const url = urlFromButtonField || urlFromMessage
  const fallback: MetaMessageSendPlan = {
    kind: 'text',
    message: { text: textFallbackForButtonUrl(message, urlFromButtonField) },
  }

  if (process.env.META_COMMENT_DM_LINK_BUTTONS_ENABLED === 'false') return [fallback]

  if (!url) return [fallback]

  const buttonText = cleanString(textWithoutUrlForButton(message, url), 640)
  const title = cleanString(buttonTitleForUrl(url), 20)
  if (!buttonText || !title) return [fallback]

  return [
    {
      kind: 'button_template',
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text: buttonText,
            buttons: [{ type: 'web_url', url, title }],
          },
        },
      },
    },
    fallback,
  ]
}

function buildVoteProofApprovedMessage(toolUrl: string) {
  return [
    'Perfeito, agora consegui validar o seu print. Est\u00e1 tudo certo.',
    '',
    'Como prometido, aqui est\u00e1 o acesso ao Perfil do Corretor Ideal:',
    toolUrl,
  ].join('\n')
}

function buildVoteProofRejectedMessage() {
  return 'Recebi o comprovante, mas ainda n\u00e3o consegui validar com seguran\u00e7a. Me envie a tela final de confirma\u00e7\u00e3o do voto, aparecendo Guilherme Pilger e Influenciador do Ano.'
}

function buildVoteProofReminderMessage() {
  return 'Perfeito. Me manda aqui o print da tela final de confirma\u00e7\u00e3o do voto, aparecendo Guilherme Pilger e Influenciador do Ano, que eu valido e libero o acesso.'
}

function renderReplyTemplate(template: string, comment: CommentRow) {
  const raw = (comment.raw || {}) as any
  const username = firstString(raw?.from?.username, raw?.username, comment.author_name)
  const name = firstInstagramName(firstString(raw?.from?.name, raw?.name, comment.author_name, username))
  const userHandle = formatInstagramUsername(username)
  const values: Record<string, string> = {
    saudacao: getSaoPauloGreeting(),
    nome: name || userHandle || 'tudo bem',
    usuario: userHandle || name || '',
  }

  const rendered = template.replace(/\{(saudacao|nome|usuario)\}/gi, (_match, key: string) => values[key.toLowerCase()] || '')
  return cleanString(repairKnownPortugueseArtifacts(rendered), 1800)
}

function significantTokens(value: string) {
  return normalizeText(value)
    .split(' ')
    .filter(token => token.length >= 3 || /^\d+$/.test(token))
}

function toIsoTimestamp(value: unknown): string | null {
  if (typeof value === 'number') {
    const millis = value > 100000000000 ? value : value * 1000
    const date = new Date(millis)
    return Number.isFinite(date.getTime()) ? date.toISOString() : null
  }

  const text = cleanString(value, 80)
  if (!text) return null
  const numeric = Number(text)
  if (Number.isFinite(numeric) && numeric > 0) return toIsoTimestamp(numeric)
  const date = new Date(text)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function firstString(...values: unknown[]) {
  return values.map(value => cleanString(value, 500)).find(Boolean) || ''
}

function getCampaignButtonUrl(campaign: CampaignRow) {
  const raw = (campaign.raw || {}) as Record<string, unknown>
  return extractFirstHttpUrl(firstString(raw.button_url, raw.link_button_url, raw.cta_url, raw.buttonUrl))
}

function getDeliveryButtonUrl(delivery: DeliveryRow) {
  const raw = (delivery.raw || {}) as Record<string, any>
  return extractFirstHttpUrl(firstString(
    raw.button_url,
    raw.link_button_url,
    raw.campaign?.button_url,
    raw.campaign?.link_button_url,
  ))
}

function normalizeVoteDiscountFlow(rawValue: unknown): VoteDiscountFlow {
  const raw = isRecord(rawValue) ? rawValue : {}
  return {
    type: 'vote_discount',
    enabled: cleanBoolean(raw.enabled, DEFAULT_VOTE_DISCOUNT_FLOW.enabled),
    already_voted_label: cleanButtonTitle(raw.already_voted_label, DEFAULT_VOTE_DISCOUNT_FLOW.already_voted_label),
    will_vote_label: cleanButtonTitle(raw.will_vote_label, DEFAULT_VOTE_DISCOUNT_FLOW.will_vote_label),
    already_voted_message: cleanString(raw.already_voted_message, 1800) || DEFAULT_VOTE_DISCOUNT_FLOW.already_voted_message,
    already_voted_button_title: cleanButtonTitle(raw.already_voted_button_title, DEFAULT_VOTE_DISCOUNT_FLOW.already_voted_button_title),
    discount_url: extractFirstHttpUrl(cleanString(raw.discount_url, 1600)),
    vote_message: cleanString(raw.vote_message, 1800) || DEFAULT_VOTE_DISCOUNT_FLOW.vote_message,
    vote_button_title: cleanButtonTitle(raw.vote_button_title, DEFAULT_VOTE_DISCOUNT_FLOW.vote_button_title),
    vote_url: extractFirstHttpUrl(cleanString(raw.vote_url, 1600)),
    followup_enabled: cleanBoolean(raw.followup_enabled, DEFAULT_VOTE_DISCOUNT_FLOW.followup_enabled),
    followup_delay_minutes: clampNumber(raw.followup_delay_minutes, DEFAULT_VOTE_DISCOUNT_FLOW.followup_delay_minutes, 1, 1440),
    followup_message: cleanString(raw.followup_message, 1800) || DEFAULT_VOTE_DISCOUNT_FLOW.followup_message,
    followup_button_title: cleanButtonTitle(raw.followup_button_title, DEFAULT_VOTE_DISCOUNT_FLOW.followup_button_title),
  }
}

function getCampaignVoteDiscountFlow(campaign: CampaignRow): VoteDiscountFlow {
  const raw = (campaign.raw || {}) as Record<string, unknown>
  const flow = isRecord(raw.comment_dm_flow) ? raw.comment_dm_flow : raw
  return normalizeVoteDiscountFlow(flow)
}

function getDeliveryVoteDiscountFlow(delivery: DeliveryRow): VoteDiscountFlow {
  const raw = (delivery.raw || {}) as Record<string, unknown>
  const snapshot = isRecord(raw.campaign_snapshot) ? raw.campaign_snapshot : {}
  const flow = isRecord(raw.comment_dm_flow)
    ? raw.comment_dm_flow
    : isRecord(snapshot.comment_dm_flow)
      ? snapshot.comment_dm_flow
      : raw
  return normalizeVoteDiscountFlow(flow)
}

function buildInitialVoteDiscountButtons(flow: VoteDiscountFlow, deliveryId?: string | null): MetaMessageButton[] {
  if (!flow.enabled) return []
  return [
    {
      type: 'postback',
      title: flow.already_voted_label,
      payload: buildCommentDmPostbackPayload(COMMENT_DM_ACTION_ALREADY_VOTED, deliveryId),
    },
    {
      type: 'postback',
      title: flow.will_vote_label,
      payload: buildCommentDmPostbackPayload(COMMENT_DM_ACTION_WILL_VOTE, deliveryId),
    },
  ]
}

function buildUrlButton(title: string, url: string): MetaMessageButton[] {
  const cleanUrl = extractFirstHttpUrl(url)
  if (!cleanUrl) return []
  return [{ type: 'web_url', title: cleanButtonTitle(title, 'Abrir link'), url: cleanUrl }]
}

function getCampaignProcessCommentsSince(campaign: CampaignRow) {
  const raw = (campaign.raw || {}) as Record<string, unknown>
  return toIsoTimestamp(firstString(raw.process_comments_since, raw.active_from, raw.started_at, raw.start_at))
}

function isCommentInsideCampaignWindow(campaign: CampaignRow, comment: CommentRow) {
  const since = getCampaignProcessCommentsSince(campaign)
  if (!since) return true
  const commentTime = toIsoTimestamp(comment.commented_at || comment.created_at || comment.updated_at)
  if (!commentTime) return true
  return new Date(commentTime).getTime() >= new Date(since).getTime()
}

function deliveryStatusFromDecision(decision: DeliveryDecision): DeliverySendStatus {
  if (decision === 'matched' || decision === 'needs_review') return 'pending_approval'
  if (decision === 'error') return 'error'
  return 'skipped'
}

async function readAppConfig(supabase: SupabaseAdmin): Promise<AppConfig> {
  const keys = [
    'meta_comment_dm_automation_enabled',
    'meta_comment_dm_webhook_autoprocess',
    'meta_comment_dm_cron_enabled',
    'meta_facebook_page_id',
    'facebook_page_access_token',
    'meta_access_token',
    'meta_instagram_account_id',
    'instagram_business_account_id',
    'instagram_business_access_token',
    'instagram_connected_at',
    'instagram_token_expires_at',
    'instagram_token_kind',
  ]
  const { data } = await supabase.from('app_config').select('key, value').in('key', keys)
  const raw = Object.fromEntries((data || []).map((row: { key: string; value: string | null }) => [row.key, String(row.value || '')]))
  const instagramConnection = getInstagramGraphConnection(raw)

  return {
    enabled: raw.meta_comment_dm_automation_enabled !== 'false',
    webhookAutoprocess: raw.meta_comment_dm_webhook_autoprocess !== 'false',
    cronEnabled: raw.meta_comment_dm_cron_enabled !== 'false',
    facebookPageId: raw.meta_facebook_page_id || process.env.META_FACEBOOK_PAGE_ID || '',
    facebookPageToken: raw.facebook_page_access_token || process.env.FACEBOOK_PAGE_ACCESS_TOKEN || '',
    metaAccessToken: raw.meta_access_token || process.env.META_ACCESS_TOKEN || '',
    instagramConnectionIssue: instagramConnection ? '' : getInstagramGraphConnectionIssue(raw),
    instagramOwnedIds: new Set([
      raw.meta_instagram_account_id,
      raw.instagram_business_account_id,
      raw.meta_facebook_page_id,
      process.env.META_INSTAGRAM_ACCOUNT_ID,
      process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
      process.env.META_FACEBOOK_PAGE_ID,
    ].map(item => cleanString(item, 120)).filter(Boolean)),
    raw,
  }
}

async function graphPost<T>(baseUrl: string, path: string, params: Record<string, string>) {
  const response = await fetch(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || `Erro Meta Graph ${response.status}`)
  }
  return payload as T
}

async function graphGet<T>(baseUrl: string, path: string, params: Record<string, string>) {
  const url = new URL(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== '') url.searchParams.set(key, value)
  })
  const response = await fetch(url.toString(), { cache: 'no-store' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || `Erro Meta Graph ${response.status}`)
  }
  return payload as T
}

async function refreshFacebookPageAccessToken(supabase: SupabaseAdmin, configs: AppConfig) {
  if (!configs.facebookPageId || !configs.metaAccessToken) return null

  const page = await graphGet<{ access_token?: string; id?: string; name?: string }>(
    getFacebookGraphBaseUrl(),
    `/${configs.facebookPageId}`,
    {
      fields: 'id,name,access_token',
      access_token: configs.metaAccessToken,
    },
  )
  const token = cleanString(page.access_token, 2000)
  if (!token) return null
  await saveAppConfig(supabase, 'facebook_page_access_token', token)
  configs.facebookPageToken = token
  configs.raw.facebook_page_access_token = token
  return token
}

function buildProfileAssessmentToolUrl() {
  return new URL('/eventos/perfil-corretor-ideal-ao-vivo/perfil-corretor-ideal', getPublicAppUrl()).toString()
}

function isProfileAssessmentReply(value: unknown) {
  const normalized = normalizeText(value)
  return (
    normalized.includes('perfil do corretor ideal')
    || normalized.includes('influenciador do ano')
    || normalized.includes('link da votacao')
    || normalized.includes('comprovante')
  )
}

function campaignRequiresVoteProof(campaign: CampaignRow) {
  const raw = (campaign.raw || {}) as Record<string, unknown>
  if (raw.requires_vote_proof === true) return true
  if (raw.requires_vote_proof === false) return false

  const directOffer = normalizeText(raw.direct_offer || raw.flow || raw.campaign_flow)
  if (directOffer.includes('direct access') || directOffer.includes('acesso direto')) return false

  const reply = normalizeText(campaign.reply_message)
  return (
    reply.includes('print')
    && (reply.includes('voto') || reply.includes('votacao') || reply.includes('influenciador do ano'))
  )
}

function deliveryRequiresVoteProof(delivery: DeliveryRow) {
  const raw = (delivery.raw || {}) as Record<string, any>
  if (raw.requires_vote_proof === true || raw.campaign_snapshot?.requires_vote_proof === true) return true
  if (raw.requires_vote_proof === false || raw.campaign_snapshot?.requires_vote_proof === false) return false

  const directOffer = normalizeText(
    raw.direct_offer
    || raw.campaign_snapshot?.direct_offer
    || raw.flow
    || raw.campaign_snapshot?.flow,
  )
  if (directOffer.includes('direct access') || directOffer.includes('acesso direto')) return false

  const reply = normalizeText(delivery.reply_message)
  return (
    reply.includes('print')
    && (reply.includes('voto') || reply.includes('votacao') || reply.includes('influenciador do ano'))
  )
}

function looksLikeVoteProofFollowUp(event: WebhookMessageEvent) {
  if (event.attachment_url) return true
  const normalized = normalizeText(event.text)
  return /\b(print|screenshot|comprovante|confirmacao|votei|voto|votacao|ja votei|ja fiz|fiz o voto|influenciador)\b/.test(normalized)
}

function resolveAttachment(message: any) {
  const attachment = Array.isArray(message?.attachments)
    ? message.attachments[0]
    : Array.isArray(message?.attachments?.data)
      ? message.attachments.data[0]
      : null
  const type = cleanString(attachment?.type, 80)
  const url = cleanString(
    attachment?.payload?.url
    || attachment?.url
    || attachment?.payload?.href
    || attachment?.payload?.src,
    1600,
  )
  return {
    type: type || null,
    url: url || null,
  }
}

function attachmentKind(type: string | null, mimeType: string | null): VoteProofMediaKind {
  const text = `${type || ''} ${mimeType || ''}`.toLowerCase()
  if (text.includes('video')) return 'video'
  if (text.includes('pdf') || text.includes('document') || text.includes('file')) return 'document'
  return 'image'
}

async function downloadAttachment(url: string) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Nao foi possivel baixar comprovante do Instagram (${response.status}).`)
  const contentType = response.headers.get('content-type') || 'image/jpeg'
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length === 0) throw new Error('Comprovante recebido vazio.')
  if (buffer.length > 12 * 1024 * 1024) throw new Error('Comprovante maior que 12MB.')
  return { buffer, contentType }
}

async function sendInstagramDirectMessageToRecipient(params: {
  recipientId: string
  message: string
  buttonUrl?: string
  buttons?: MetaMessageButtonInput[] | MetaMessageButton[]
  supabase?: SupabaseAdmin
}) {
  const supabase = params.supabase || createAdminClient()
  const configs = await readAppConfig(supabase)
  const recipientId = cleanString(params.recipientId, 160)
  const message = cleanString(repairKnownPortugueseArtifacts(params.message), 1800)
  if (!recipientId) throw new Error('Destinatario Instagram sem ID.')
  if (!message) throw new Error('Mensagem Instagram vazia.')

  const instagramConnection = getInstagramGraphConnection(configs.raw)
  const attempts: Array<{ channel: string; baseUrl: string; endpoint: string; accessToken: string }> = []
  const seen = new Set<string>()
  const addAttempt = (attempt: { channel: string; baseUrl: string; endpoint: string; accessToken: string }) => {
    const key = `${attempt.baseUrl}:${attempt.endpoint}:${attempt.accessToken.slice(0, 18)}`
    if (!attempt.accessToken || seen.has(key)) return
    attempts.push(attempt)
    seen.add(key)
  }

  if (instagramConnection) {
    addAttempt({
      channel: `instagram_${instagramConnection.source}_direct`,
      baseUrl: instagramConnection.baseUrl,
      endpoint: `/${instagramConnection.accountId}/messages`,
      accessToken: instagramConnection.accessToken,
    })
  }

  if (configs.facebookPageId) {
    addAttempt({
      channel: 'facebook_page_messages_instagram_direct',
      baseUrl: getFacebookGraphBaseUrl(),
      endpoint: `/${configs.facebookPageId}/messages`,
      accessToken: configs.facebookPageToken || configs.metaAccessToken,
    })
  }

  let lastError = ''
  const attemptErrors: string[] = []
  const sendPlans = buildMetaMessageSendPlans(message, {
    buttonUrl: params.buttonUrl,
    buttons: params.buttons,
  })
  for (const attempt of attempts) {
    for (const plan of sendPlans) {
      try {
        const result = await graphPost<{ message_id?: string; recipient_id?: string; id?: string }>(
          attempt.baseUrl,
          attempt.endpoint,
          {
            recipient: JSON.stringify({ id: recipientId }),
            message: JSON.stringify(plan.message),
            access_token: attempt.accessToken,
          },
        )
        return {
          external_id: result.message_id || result.id || '',
          recipient_id: result.recipient_id || recipientId,
          channel: `${attempt.channel}_${plan.kind}`,
          raw: { ...result, message_payload_type: plan.kind },
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
        attemptErrors.push(`${attempt.channel}_${plan.kind}: ${lastError}`)
      }
    }
  }

  throw new Error(`Envio Instagram Direct falhou: ${attemptErrors.join(' | ') || lastError || 'nenhuma conexao disponivel'}`)
}

export async function sendInstagramPrivateReply(params: {
  commentExternalId: string
  message: string
  buttonUrl?: string
  buttons?: MetaMessageButtonInput[] | MetaMessageButton[]
  supabase?: SupabaseAdmin
}) {
  const supabase = params.supabase || createAdminClient()
  const configs = await readAppConfig(supabase)
  const reply = cleanString(repairKnownPortugueseArtifacts(params.message), 1800)
  const commentExternalId = cleanString(params.commentExternalId, 120)
  if (!commentExternalId) throw new Error('Comentario Instagram sem ID externo.')
  if (!reply) throw new Error('Mensagem privada vazia.')

  const instagramConnection = getInstagramGraphConnection(configs.raw)
  const attempts: Array<{ channel: string; baseUrl: string; endpoint: string; accessToken: string }> = []
  const seen = new Set<string>()
  const addAttempt = (attempt: { channel: string; baseUrl: string; endpoint: string; accessToken: string }) => {
    const key = `${attempt.baseUrl}:${attempt.endpoint}:${attempt.accessToken.slice(0, 18)}`
    if (!attempt.accessToken || seen.has(key)) return
    attempts.push(attempt)
    seen.add(key)
  }

  if (configs.facebookPageId) {
    addAttempt({
      channel: 'facebook_page_messages',
      baseUrl: getFacebookGraphBaseUrl(),
      endpoint: `/${configs.facebookPageId}/messages`,
      accessToken: configs.facebookPageToken,
    })
    addAttempt({
      channel: 'facebook_page_messages_meta_token',
      baseUrl: getFacebookGraphBaseUrl(),
      endpoint: `/${configs.facebookPageId}/messages`,
      accessToken: configs.metaAccessToken,
    })
  }

  if (instagramConnection) {
    addAttempt({
      channel: `instagram_${instagramConnection.source}_messages`,
      baseUrl: instagramConnection.baseUrl,
      endpoint: `/${instagramConnection.accountId}/messages`,
      accessToken: instagramConnection.accessToken,
    })
  }

  if (attempts.length === 0) {
    throw new Error(configs.instagramConnectionIssue || 'Nenhuma conexao Meta/Instagram disponivel para Private Reply.')
  }

  let lastError = ''
  const attemptErrors: string[] = []
  const sendPlans = buildMetaMessageSendPlans(reply, {
    buttonUrl: params.buttonUrl,
    buttons: params.buttons,
  })
  for (const attempt of attempts) {
    for (const plan of sendPlans) {
      try {
        const result = await graphPost<{ message_id?: string; recipient_id?: string; id?: string }>(
          attempt.baseUrl,
          attempt.endpoint,
          {
            recipient: JSON.stringify({ comment_id: commentExternalId }),
            message: JSON.stringify(plan.message),
            access_token: attempt.accessToken,
          },
        )

        return {
          external_id: result.message_id || result.id || '',
          recipient_id: result.recipient_id || '',
          channel: `${attempt.channel}_${plan.kind}`,
          raw: { ...result, message_payload_type: plan.kind },
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
        attemptErrors.push(`${attempt.channel}_${plan.kind}: ${lastError}`)
      }
    }
  }

  try {
    const refreshedToken = await refreshFacebookPageAccessToken(supabase, configs)
    if (refreshedToken && configs.facebookPageId) {
      for (const plan of sendPlans) {
        try {
          const result = await graphPost<{ message_id?: string; recipient_id?: string; id?: string }>(
            getFacebookGraphBaseUrl(),
            `/${configs.facebookPageId}/messages`,
            {
              recipient: JSON.stringify({ comment_id: commentExternalId }),
              message: JSON.stringify(plan.message),
              access_token: refreshedToken,
            },
          )

          return {
            external_id: result.message_id || result.id || '',
            recipient_id: result.recipient_id || '',
            channel: `facebook_page_messages_refreshed_${plan.kind}`,
            raw: { ...result, message_payload_type: plan.kind },
          }
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error)
          attemptErrors.push(`facebook_page_messages_refreshed_${plan.kind}: ${lastError}`)
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    attemptErrors.push(`facebook_page_token_refresh: ${message}`)
    lastError = message
  }

  throw new Error(`Private Reply Instagram falhou: ${attemptErrors.join(' | ') || lastError}`)
}

async function sendFacebookPrivateReply(params: {
  commentExternalId: string
  message: string
  buttonUrl?: string
  buttons?: MetaMessageButtonInput[] | MetaMessageButton[]
  supabase?: SupabaseAdmin
}) {
  const supabase = params.supabase || createAdminClient()
  const configs = await readAppConfig(supabase)
  const reply = cleanString(repairKnownPortugueseArtifacts(params.message), 1800)
  const commentExternalId = cleanString(params.commentExternalId, 120)
  if (!commentExternalId) throw new Error('Comentario Facebook sem ID externo.')
  if (!reply) throw new Error('Mensagem privada vazia.')
  if (!configs.facebookPageId) throw new Error('Facebook Page ID nao configurado para Private Reply.')

  const attempts: Array<{ channel: string; accessToken: string; commentId: string }> = []
  const seen = new Set<string>()
  const shortCommentId = commentExternalId.includes('_') ? commentExternalId.split('_').pop() || commentExternalId : commentExternalId
  const addAttempt = (attempt: { channel: string; accessToken: string; commentId: string }) => {
    const key = `${attempt.channel}:${attempt.commentId}:${attempt.accessToken.slice(0, 18)}`
    if (!attempt.accessToken || seen.has(key)) return
    attempts.push(attempt)
    seen.add(key)
  }

  addAttempt({ channel: 'facebook_page_messages_comment', accessToken: configs.facebookPageToken, commentId: commentExternalId })
  addAttempt({ channel: 'facebook_page_messages_comment_short', accessToken: configs.facebookPageToken, commentId: shortCommentId })
  addAttempt({ channel: 'facebook_page_messages_comment_meta_token', accessToken: configs.metaAccessToken, commentId: commentExternalId })
  addAttempt({ channel: 'facebook_page_messages_comment_short_meta_token', accessToken: configs.metaAccessToken, commentId: shortCommentId })

  let lastError = ''
  const attemptErrors: string[] = []
  const sendPlans = buildMetaMessageSendPlans(reply, {
    buttonUrl: params.buttonUrl,
    buttons: params.buttons,
  })
  for (const attempt of attempts) {
    for (const plan of sendPlans) {
      try {
        const result = await graphPost<{ id?: string; message_id?: string }>(
          getFacebookGraphBaseUrl(),
          `/${configs.facebookPageId}/messages`,
          {
            recipient: JSON.stringify({ comment_id: attempt.commentId }),
            message: JSON.stringify(plan.message),
            access_token: attempt.accessToken,
          },
        )

        return {
          external_id: result.id || result.message_id || '',
          channel: `${attempt.channel}_${plan.kind}`,
          raw: { ...result, message_payload_type: plan.kind },
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
        attemptErrors.push(`${attempt.channel}_${plan.kind}: ${lastError}`)
      }
    }
  }

  try {
    const refreshedToken = await refreshFacebookPageAccessToken(supabase, configs)
    if (refreshedToken) {
      let result: { id?: string; message_id?: string } | null = null
      let payloadType = ''
      let refreshedError = ''
      for (const commentId of [commentExternalId, shortCommentId]) {
        for (const plan of sendPlans) {
          try {
            result = await graphPost<{ id?: string; message_id?: string }>(
              getFacebookGraphBaseUrl(),
              `/${configs.facebookPageId}/messages`,
              {
                recipient: JSON.stringify({ comment_id: commentId }),
                message: JSON.stringify(plan.message),
                access_token: refreshedToken,
              },
            )
            payloadType = plan.kind
            break
          } catch (error) {
            refreshedError = error instanceof Error ? error.message : String(error)
            attemptErrors.push(`facebook_comment_private_replies_refreshed_${plan.kind}: ${refreshedError}`)
          }
        }
        if (result) break
      }
      if (!result) throw new Error(refreshedError || 'Token atualizado nao enviou a mensagem.')

      return {
        external_id: result.id || result.message_id || '',
        channel: `facebook_comment_private_replies_refreshed_${payloadType || 'unknown'}`,
        raw: { ...result, message_payload_type: payloadType || 'unknown' },
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    attemptErrors.push(`facebook_page_token_refresh: ${message}`)
    lastError = message
  }

  throw new Error(`Private Reply Facebook falhou: ${attemptErrors.join(' | ') || lastError}`)
}

async function sendPrivateReplyForDelivery(params: {
  delivery: DeliveryRow
  message: string
  buttonUrl?: string
  buttons?: MetaMessageButtonInput[] | MetaMessageButton[]
  supabase: SupabaseAdmin
}) {
  if (params.delivery.platform === 'facebook') {
    return sendFacebookPrivateReply({
      commentExternalId: params.delivery.comment_external_id,
      message: params.message,
      buttonUrl: params.buttonUrl,
      buttons: params.buttons,
      supabase: params.supabase,
    })
  }

  return sendInstagramPrivateReply({
    commentExternalId: params.delivery.comment_external_id,
    message: params.message,
    buttonUrl: params.buttonUrl,
    buttons: params.buttons,
    supabase: params.supabase,
  })
}

async function sendInstagramPublicCommentReply(params: {
  commentExternalId: string
  message: string
  supabase?: SupabaseAdmin
}) {
  const supabase = params.supabase || createAdminClient()
  const configs = await readAppConfig(supabase)
  const commentExternalId = cleanString(params.commentExternalId, 120)
  const message = cleanString(repairKnownPortugueseArtifacts(params.message), 300)
  if (!commentExternalId) throw new Error('Comentario Instagram sem ID externo para resposta publica.')
  if (!message) throw new Error('Resposta publica Instagram vazia.')

  const instagramConnection = getInstagramGraphConnection(configs.raw)
  const attempts: Array<{ channel: string; baseUrl: string; endpoint: string; accessToken: string }> = []
  const seen = new Set<string>()
  const addAttempt = (attempt: { channel: string; baseUrl: string; endpoint: string; accessToken: string }) => {
    const key = `${attempt.baseUrl}:${attempt.endpoint}:${attempt.accessToken.slice(0, 18)}`
    if (!attempt.accessToken || seen.has(key)) return
    attempts.push(attempt)
    seen.add(key)
  }

  if (instagramConnection) {
    addAttempt({
      channel: `instagram_${instagramConnection.source}_comment_replies`,
      baseUrl: instagramConnection.baseUrl,
      endpoint: `/${commentExternalId}/replies`,
      accessToken: instagramConnection.accessToken,
    })
  }

  addAttempt({
    channel: 'facebook_page_comment_replies',
    baseUrl: getFacebookGraphBaseUrl(),
    endpoint: `/${commentExternalId}/replies`,
    accessToken: configs.facebookPageToken,
  })
  addAttempt({
    channel: 'meta_token_comment_replies',
    baseUrl: getFacebookGraphBaseUrl(),
    endpoint: `/${commentExternalId}/replies`,
    accessToken: configs.metaAccessToken,
  })

  let lastError = ''
  const attemptErrors: string[] = []
  for (const attempt of attempts) {
    try {
      const result = await graphPost<{ id?: string }>(
        attempt.baseUrl,
        attempt.endpoint,
        {
          message,
          access_token: attempt.accessToken,
        },
      )
      return {
        external_id: result.id || '',
        channel: attempt.channel,
        raw: result,
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      attemptErrors.push(`${attempt.channel}: ${lastError}`)
    }
  }

  throw new Error(`Resposta publica no comentario Instagram falhou: ${attemptErrors.join(' | ') || lastError || 'nenhuma conexao disponivel'}`)
}

async function sendFacebookPublicCommentReply(params: {
  commentExternalId: string
  message: string
  supabase?: SupabaseAdmin
}) {
  const supabase = params.supabase || createAdminClient()
  const configs = await readAppConfig(supabase)
  const commentExternalId = cleanString(params.commentExternalId, 120)
  const message = cleanString(repairKnownPortugueseArtifacts(params.message), 300)
  if (!commentExternalId) throw new Error('Comentario Facebook sem ID externo para resposta publica.')
  if (!message) throw new Error('Resposta publica Facebook vazia.')

  const attempts: Array<{ channel: string; accessToken: string }> = []
  const seen = new Set<string>()
  const addAttempt = (attempt: { channel: string; accessToken: string }) => {
    const key = `${attempt.channel}:${attempt.accessToken.slice(0, 18)}`
    if (!attempt.accessToken || seen.has(key)) return
    attempts.push(attempt)
    seen.add(key)
  }

  addAttempt({ channel: 'facebook_comment_public_reply', accessToken: configs.facebookPageToken })
  addAttempt({ channel: 'facebook_comment_public_reply_meta_token', accessToken: configs.metaAccessToken })

  let lastError = ''
  const attemptErrors: string[] = []
  for (const attempt of attempts) {
    try {
      const result = await graphPost<{ id?: string }>(
        getFacebookGraphBaseUrl(),
        `/${commentExternalId}/comments`,
        {
          message,
          access_token: attempt.accessToken,
        },
      )

      return {
        external_id: result.id || '',
        channel: attempt.channel,
        raw: result,
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      attemptErrors.push(`${attempt.channel}: ${lastError}`)
    }
  }

  throw new Error(`Resposta publica no comentario Facebook falhou: ${attemptErrors.join(' | ') || lastError || 'nenhuma conexao disponivel'}`)
}

async function sendPublicCommentReplyForDelivery(params: {
  delivery: DeliveryRow
  message: string
  supabase: SupabaseAdmin
}) {
  if (params.delivery.platform === 'facebook') {
    return sendFacebookPublicCommentReply({
      commentExternalId: params.delivery.comment_external_id,
      message: params.message,
      supabase: params.supabase,
    })
  }

  return sendInstagramPublicCommentReply({
    commentExternalId: params.delivery.comment_external_id,
    message: params.message,
    supabase: params.supabase,
  })
}

function parseAiDecision(raw: string, campaign: CampaignRow): AiDecision | null {
  try {
    const parsed = JSON.parse(cleanJson(raw))
    const confidence = clampNumber(parsed.confidence, 0, 0, 100)
    return {
      matches: parsed.matches_campaign === true || parsed.matches === true,
      confidence,
      reason: cleanString(parsed.reason, 600) || 'Decisao IA sem justificativa.',
      normalizedIntent: cleanString(parsed.normalized_intent || parsed.normalizedIntent, 160) || campaign.trigger_intent,
      safetyFlags: Array.isArray(parsed.safety_flags)
        ? parsed.safety_flags.map((item: unknown) => cleanString(item, 80)).filter(Boolean).slice(0, 8)
        : [],
      suggestedReply: cleanString(parsed.suggested_reply || parsed.suggestedReply, 1800),
      raw: parsed,
    }
  } catch {
    return null
  }
}

function heuristicDecision(campaign: CampaignRow, comment: CommentRow, reason = 'Gemini indisponivel') {
  const commentText = normalizeText(comment.message)
  const candidates = [campaign.trigger_intent, ...(campaign.trigger_examples || [])].map(normalizeText).filter(Boolean)
  const exactish = candidates.some(candidate => candidate && commentText.includes(candidate))
  const tokenMatch = candidates.some(candidate => {
    const tokens = significantTokens(candidate)
    if (tokens.length === 0) return false
    const matched = tokens.filter(token => commentText.includes(token)).length
    return matched >= Math.max(1, Math.ceil(tokens.length * 0.75))
  })
  const matches = exactish || tokenMatch

  return {
    matches,
    confidence: matches ? 76 : 28,
    reason: `${reason}. Fallback local ${matches ? 'identificou' : 'nao identificou'} a intencao pelo texto normalizado.`,
    normalizedIntent: campaign.trigger_intent,
    safetyFlags: [],
    suggestedReply: campaign.reply_message,
    raw: { fallback: true, exactish, tokenMatch },
  } satisfies AiDecision
}

function shouldPreserveCampaignReply(campaign: CampaignRow) {
  const reply = campaign.reply_message || ''
  const normalized = normalizeText(reply)
  return /https?:\/\//i.test(reply) || /\b(print|comprovante|voto|vote|votacao|votacao|validar)\b/.test(normalized)
}

function buildClassificationUserMessage(campaign: CampaignRow, comment: CommentRow) {
  return JSON.stringify({
    instruction: 'Decida se o comentario corresponde a campanha e retorne somente JSON.',
    output_schema: {
      matches_campaign: 'boolean',
      confidence: '0 a 100',
      normalized_intent: 'string curta',
      reason: 'justificativa curta',
      safety_flags: ['spam|ofensa|reclamacao|opt_out|fora_de_contexto|humano'],
      suggested_reply: 'use a mensagem da campanha ou ajuste suavemente sem mudar oferta',
    },
    campaign: {
      name: campaign.name,
      trigger_intent: campaign.trigger_intent,
      trigger_examples: campaign.trigger_examples || [],
      reply_message: campaign.reply_message,
      confidence_threshold: campaign.confidence_threshold,
    },
    comment: {
      platform: comment.platform,
      author_name: comment.author_name,
      text: comment.message,
      media_external_id: comment.media_external_id,
      commented_at: comment.commented_at,
    },
    decision_rules: [
      'Aceite variacoes naturais que mantenham a intencao da campanha.',
      'Nao exija frase exata.',
      'Marque matches_campaign=false se houver pedido de parar, reclamacao, xingamento, spam ou contexto incerto.',
      'Se corresponder mas houver risco leve, reduza confidence e inclua safety_flags.',
      'A suggested_reply deve ter no maximo 900 caracteres e nunca prometer algo que a campanha nao promete.',
      'Se a reply_message da campanha tiver link, comprovante, print, voto ou passo a passo, preserve a mensagem completa da campanha sem remover etapas.',
    ],
  })
}

function errorText(error: unknown) {
  return cleanString(error instanceof Error ? error.message : String(error || 'Erro desconhecido'), 500)
}

function isMetaAlreadyRepliedError(message: string) {
  const normalized = normalizeText(message)
  return (
    normalized.includes('comentario ao qual voce esta tentando responder ja tem uma resposta')
    || normalized.includes('comment you are trying to reply to already has a response')
    || normalized.includes('already has a response')
    || normalized.includes('already been replied')
  )
}

function tagAiDecision(decision: AiDecision, provider: string, warnings: string[] = []): AiDecision {
  return {
    ...decision,
    reason: warnings.length
      ? cleanString(`${decision.reason} | fallback: ${warnings.join(' | ')}`, 600)
      : decision.reason,
    raw: {
      provider,
      warnings,
      result: decision.raw || null,
    },
  }
}

async function classifyCommentWithOpenAI(campaign: CampaignRow, userMessage: string) {
  const apiKey = await getOpenAIApiKey()
  if (!apiKey) throw new Error('OpenAI API Key nao configurada')
  const model = (await getAIConfig('openai_model')) || 'gpt-4o-mini'

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: CAMPAIGN_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    }),
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || `OpenAI falhou (${response.status})`)
  }

  const raw = cleanString(payload?.choices?.[0]?.message?.content, 4000)
  if (!raw) throw new Error('OpenAI nao retornou conteudo')
  const decision = parseAiDecision(raw, campaign)
  if (!decision) throw new Error('OpenAI nao retornou JSON valido')
  return decision
}

async function classifyComment(campaign: CampaignRow, comment: CommentRow): Promise<AiDecision> {
  const userMessage = buildClassificationUserMessage(campaign, comment)
  const warnings: string[] = []
  const hasGemini = await getGeminiApiKey().catch(() => null)

  if (hasGemini) {
    try {
      const raw = await chatWithGemini({
        systemPrompt: CAMPAIGN_SYSTEM_PROMPT,
        history: [],
        userMessage,
        temperature: 0.1,
        maxTokens: 1200,
      })
      const decision = parseAiDecision(raw, campaign)
      if (decision) return tagAiDecision(decision, 'gemini')
      warnings.push('Gemini retornou JSON invalido')
    } catch (error) {
      warnings.push(`Gemini: ${errorText(error)}`)
    }
  } else {
    warnings.push('Gemini API Key nao configurada')
  }

  try {
    return tagAiDecision(await classifyCommentWithOpenAI(campaign, userMessage), 'openai', warnings)
  } catch (error) {
    warnings.push(`OpenAI: ${errorText(error)}`)
  }

  return heuristicDecision(campaign, comment, warnings.join(' | ') || 'IA indisponivel')
}

async function loadMatchingCampaigns(supabase: SupabaseAdmin, comment: CommentRow) {
  const { data, error } = await supabase
    .from('meta_comment_dm_campaigns')
    .select('id, name, platform, media_external_id, post_permalink, trigger_intent, trigger_examples, reply_message, confidence_threshold, mode, status, max_replies_per_hour, raw, created_at, updated_at')
    .eq('platform', comment.platform)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(80)

  if (error) throw new Error(error.message)
  const campaigns = ((data || []) as CampaignRow[])
    .filter(campaign => !campaign.media_external_id || campaign.media_external_id === comment.media_external_id)
    .filter(campaign => isCommentInsideCampaignWindow(campaign, comment))

  return campaigns.sort((a, b) => {
    const aExact = a.media_external_id && a.media_external_id === comment.media_external_id ? 1 : 0
    const bExact = b.media_external_id && b.media_external_id === comment.media_external_id ? 1 : 0
    return bExact - aExact
  })
}

async function loadCommentById(supabase: SupabaseAdmin, params: { commentId?: string; externalId?: string }) {
  let query = supabase
    .from('meta_social_comments')
    .select('id, platform, external_id, media_external_id, parent_external_id, author_id, author_name, message, permalink, commented_at, raw, created_at, updated_at')
    .in('platform', ['instagram', 'facebook'])

  if (params.commentId) query = query.eq('id', params.commentId)
  else if (params.externalId) query = query.eq('external_id', params.externalId)
  else throw new Error('Informe o comentario.')

  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return (data || null) as CommentRow | null
}

async function getExistingDelivery(supabase: SupabaseAdmin, campaignId: string, commentExternalId: string) {
  const { data, error } = await supabase
    .from('meta_comment_dm_deliveries')
    .select('id, campaign_id, comment_id, platform, comment_external_id, media_external_id, author_id, author_name, comment_text, ai_matches, ai_confidence, ai_reason, normalized_intent, reply_message, decision, send_status, private_reply_external_id, private_reply_channel, error, processed_at, sent_at, raw, created_at, updated_at')
    .eq('campaign_id', campaignId)
    .eq('comment_external_id', commentExternalId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data || null) as DeliveryRow | null
}

async function saveDelivery(
  supabase: SupabaseAdmin,
  campaign: CampaignRow,
  comment: CommentRow,
  decision: AiDecision,
  status: {
    decision: DeliveryDecision
    sendStatus: DeliverySendStatus
    error?: string | null
  },
) {
  const now = nowIso()
  const buttonUrl = getCampaignButtonUrl(campaign)
  const voteDiscountFlow = getCampaignVoteDiscountFlow(campaign)
  const requiresVoteProof = campaignRequiresVoteProof(campaign)
  const campaignRaw = (campaign.raw || {}) as Record<string, unknown>
  const directOffer = cleanString(
    campaignRaw.direct_offer
    || campaignRaw.flow
    || (voteDiscountFlow.enabled ? 'vote_discount_flow' : requiresVoteProof ? 'vote_proof_gate' : 'profile_assessment_direct_access'),
    120,
  )
  const replyTemplate = cleanString(
    shouldPreserveCampaignReply(campaign) ? campaign.reply_message : decision.suggestedReply || campaign.reply_message,
    1800,
  )
  const reply = renderReplyTemplate(replyTemplate, comment)
  const { data, error } = await supabase
    .from('meta_comment_dm_deliveries')
    .upsert({
      campaign_id: campaign.id,
      comment_id: comment.id,
      platform: comment.platform,
      comment_external_id: comment.external_id,
      media_external_id: comment.media_external_id,
      author_id: comment.author_id,
      author_name: comment.author_name,
      comment_text: comment.message,
      ai_matches: decision.matches,
      ai_confidence: decision.confidence,
      ai_reason: decision.reason,
      normalized_intent: decision.normalizedIntent,
      reply_message: reply,
      decision: status.decision,
      send_status: status.sendStatus,
      error: status.error || null,
      processed_at: now,
      raw: {
        ai: decision.raw || null,
        safety_flags: decision.safetyFlags,
        button_url: buttonUrl || null,
        comment_dm_flow: voteDiscountFlow.enabled ? voteDiscountFlow : null,
        direct_offer: directOffer,
        requires_vote_proof: requiresVoteProof,
        campaign_snapshot: {
          id: campaign.id,
          name: campaign.name,
          trigger_intent: campaign.trigger_intent,
          confidence_threshold: campaign.confidence_threshold,
          mode: campaign.mode,
          button_url: buttonUrl || null,
          comment_dm_flow: voteDiscountFlow.enabled ? voteDiscountFlow : null,
          direct_offer: directOffer,
          requires_vote_proof: requiresVoteProof,
        },
      },
      updated_at: now,
    }, { onConflict: 'campaign_id,comment_external_id' })
    .select('id, campaign_id, comment_id, platform, comment_external_id, media_external_id, author_id, author_name, comment_text, ai_matches, ai_confidence, ai_reason, normalized_intent, reply_message, decision, send_status, private_reply_external_id, private_reply_channel, error, processed_at, sent_at, raw, created_at, updated_at')
    .single()

  if (error || !data) throw new Error(error?.message || 'Nao foi possivel salvar entrega da campanha.')
  return data as DeliveryRow
}

async function countSentInCurrentHour(supabase: SupabaseAdmin, campaignId: string) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error } = await supabase
    .from('meta_comment_dm_deliveries')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('send_status', 'sent')
    .gte('sent_at', since)

  if (error) throw new Error(error.message)
  return count || 0
}

async function updateDeliveryAfterSend(
  supabase: SupabaseAdmin,
  delivery: DeliveryRow,
  result: MetaSendResult,
) {
  const now = nowIso()
  const { data, error } = await supabase
    .from('meta_comment_dm_deliveries')
    .update({
      send_status: 'sent',
      decision: 'matched',
      private_reply_external_id: result.external_id || null,
      private_reply_channel: result.channel || null,
      error: null,
      sent_at: now,
      updated_at: now,
      raw: {
        ...(delivery.raw || {}),
        private_reply_result: result.raw || result,
      },
    })
    .eq('id', delivery.id)
    .select('id, campaign_id, comment_id, platform, comment_external_id, media_external_id, author_id, author_name, comment_text, ai_matches, ai_confidence, ai_reason, normalized_intent, reply_message, decision, send_status, private_reply_external_id, private_reply_channel, error, processed_at, sent_at, raw, created_at, updated_at')
    .single()

  if (error || !data) throw new Error(error?.message || 'Nao foi possivel atualizar entrega enviada.')
  return data as DeliveryRow
}

async function updateDeliveryPublicCommentReplyRaw(
  supabase: SupabaseAdmin,
  delivery: DeliveryRow,
  payload: Record<string, unknown>,
) {
  const { data, error } = await supabase
    .from('meta_comment_dm_deliveries')
    .update({
      raw: {
        ...(delivery.raw || {}),
        public_comment_reply: payload,
      },
      updated_at: nowIso(),
    })
    .eq('id', delivery.id)
    .select('id, campaign_id, comment_id, platform, comment_external_id, media_external_id, author_id, author_name, comment_text, ai_matches, ai_confidence, ai_reason, normalized_intent, reply_message, decision, send_status, private_reply_external_id, private_reply_channel, error, processed_at, sent_at, raw, created_at, updated_at')
    .single()

  if (error || !data) throw new Error(error?.message || 'Nao foi possivel registrar resposta publica no comentario.')
  return data as DeliveryRow
}

async function updateDeliveryPublicCommentReplyRawSafe(
  supabase: SupabaseAdmin,
  delivery: DeliveryRow,
  payload: Record<string, unknown>,
) {
  try {
    return await updateDeliveryPublicCommentReplyRaw(supabase, delivery, payload)
  } catch {
    return delivery
  }
}

async function updateDeliveryError(supabase: SupabaseAdmin, delivery: DeliveryRow, errorMessage: string) {
  const { data, error } = await supabase
    .from('meta_comment_dm_deliveries')
    .update({
      send_status: 'error',
      decision: 'error',
      error: errorMessage.slice(0, 900),
      updated_at: nowIso(),
    })
    .eq('id', delivery.id)
    .select('id, campaign_id, comment_id, platform, comment_external_id, media_external_id, author_id, author_name, comment_text, ai_matches, ai_confidence, ai_reason, normalized_intent, reply_message, decision, send_status, private_reply_external_id, private_reply_channel, error, processed_at, sent_at, raw, created_at, updated_at')
    .single()

  if (error || !data) throw new Error(error?.message || 'Nao foi possivel atualizar erro da entrega.')
  return data as DeliveryRow
}

async function upsertSuggestionForDelivery(
  supabase: SupabaseAdmin,
  campaign: CampaignRow,
  comment: CommentRow,
  delivery: DeliveryRow,
) {
  if (!delivery.ai_matches) return

  const status = delivery.send_status === 'sent' ? 'sent' : 'pending'
  const summary = `Comentario corresponde a campanha "${campaign.name}" com ${delivery.ai_confidence}% de confianca.`
  const recommendedAction = delivery.send_status === 'sent'
    ? 'Mensagem privada enviada automaticamente pelo comentario.'
    : delivery.platform === 'facebook'
      ? 'Aprovar ou enviar a mensagem privada sugerida no Messenger.'
      : 'Aprovar ou enviar o Direct privado sugerido pela campanha.'

  await supabase
    .from('meta_social_ai_suggestions')
    .upsert({
      source_type: 'comment',
      source_id: comment.id,
      platform: 'instagram',
      intent: `campanha_dm:${cleanString(campaign.name, 44)}`,
      sentiment: 'positivo',
      priority: delivery.ai_confidence >= 88 ? 'alta' : 'normal',
      lead_score: Math.max(60, delivery.ai_confidence),
      summary,
      suggested_reply: delivery.reply_message,
      recommended_action: recommendedAction,
      status,
      raw: {
        comment_dm_campaign_id: campaign.id,
        comment_dm_delivery_id: delivery.id,
        private_reply: true,
        ai_reason: delivery.ai_reason,
        media_external_id: comment.media_external_id,
      },
      updated_at: nowIso(),
    }, { onConflict: 'source_type,source_id' })
}

async function sendDelivery(
  supabase: SupabaseAdmin,
  delivery: DeliveryRow,
  replyOverride?: string,
) {
  if (delivery.send_status === 'sent') return delivery
  const voteDiscountFlow = getDeliveryVoteDiscountFlow(delivery)
  const initialCommentAction = voteDiscountFlow.enabled
    ? inferCommentDmFlowActionFromText(delivery.comment_text)
    : null
  const reply = cleanString(
    initialCommentAction === COMMENT_DM_ACTION_ALREADY_VOTED
      ? voteDiscountFlow.already_voted_message
      : initialCommentAction === COMMENT_DM_ACTION_WILL_VOTE
        ? voteDiscountFlow.vote_message
        : replyOverride || delivery.reply_message,
    1800,
  )
  const buttonUrl = getDeliveryButtonUrl(delivery)
  const buttons = initialCommentAction === COMMENT_DM_ACTION_ALREADY_VOTED
    ? buildUrlButton(voteDiscountFlow.already_voted_button_title, voteDiscountFlow.discount_url)
    : initialCommentAction === COMMENT_DM_ACTION_WILL_VOTE
      ? buildUrlButton(voteDiscountFlow.vote_button_title, voteDiscountFlow.vote_url)
      : buildInitialVoteDiscountButtons(voteDiscountFlow, delivery.id)
  if (!reply) throw new Error('Entrega sem mensagem para Private Reply.')

  try {
    const result = await sendPrivateReplyForDelivery({
      delivery,
      message: reply,
      buttonUrl,
      buttons,
      supabase,
    })
    const sentDelivery = await updateDeliveryAfterSend(supabase, { ...delivery, reply_message: reply }, result)
    const publicReplyMessage = buildPublicCommentReply(sentDelivery)
    let finalDelivery = sentDelivery

    try {
      const publicReply = await sendPublicCommentReplyForDelivery({
        delivery: sentDelivery,
        message: publicReplyMessage,
        supabase,
      })
      finalDelivery = await updateDeliveryPublicCommentReplyRawSafe(supabase, sentDelivery, {
        success: true,
        message: publicReplyMessage,
        external_id: publicReply.external_id || null,
        channel: publicReply.channel || null,
        raw: publicReply.raw || publicReply,
        sent_at: nowIso(),
      })
    } catch (publicReplyError) {
      const publicReplyErrorMessage = publicReplyError instanceof Error ? publicReplyError.message : String(publicReplyError)
      finalDelivery = await updateDeliveryPublicCommentReplyRawSafe(supabase, sentDelivery, {
        success: false,
        message: publicReplyMessage,
        error: publicReplyErrorMessage.slice(0, 900),
        attempted_at: nowIso(),
      })
    }

    if (initialCommentAction) {
      await applyInitialCommentVoteDiscountAction(supabase, finalDelivery, result, initialCommentAction, voteDiscountFlow)
      return await loadDeliveryById(supabase, finalDelivery.id) || finalDelivery
    }

    return finalDelivery
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (isMetaAlreadyRepliedError(message)) {
      const currentDelivery = await loadDeliveryById(supabase, delivery.id)
      if (
        currentDelivery?.send_status === 'sent'
        && (
          Boolean(currentDelivery.private_reply_external_id)
          || (
            Boolean(currentDelivery.private_reply_channel)
            && currentDelivery.private_reply_channel !== 'meta_private_reply_already_exists'
          )
        )
      ) {
        return currentDelivery
      }

      return await updateDeliveryAfterSend(supabase, { ...delivery, reply_message: reply }, {
        external_id: delivery.private_reply_external_id || '',
        recipient_id: '',
        channel: 'meta_private_reply_already_exists',
        raw: {
          already_replied: true,
          original_error: message,
          button_url: buttonUrl || null,
          buttons: buttons.length > 0 ? buttons : null,
        },
      })
    }
    return await updateDeliveryError(supabase, delivery, message)
  }
}

async function getInstagramAutomationSenderId(supabase: SupabaseAdmin) {
  const configs = await readAppConfig(supabase)
  return cleanString(
    configs.raw.meta_instagram_account_id
    || configs.raw.instagram_business_account_id
    || process.env.META_INSTAGRAM_ACCOUNT_ID
    || process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID
    || configs.facebookPageId,
    160,
  )
}

async function applyInitialCommentVoteDiscountAction(
  supabase: SupabaseAdmin,
  delivery: DeliveryRow,
  result: MetaSendResult,
  action: CommentDmFlowAction,
  flow: VoteDiscountFlow,
) {
  if (delivery.platform !== 'instagram') return null
  const recipientId = extractPrivateReplyRecipientId(delivery) || cleanString(result.recipient_id, 160) || cleanString(delivery.author_id, 160)
  if (!recipientId) return null

  const senderId = await getInstagramAutomationSenderId(supabase)
  const eventExternalId = `comment_action_${delivery.id}_${action}`
  const syntheticEvent: WebhookMessageEvent = {
    platform: 'instagram',
    thread_id: null,
    thread_external_id: `ig_dm_${senderId || 'pilger'}_${recipientId}`,
    external_id: eventExternalId,
    sender_id: recipientId,
    recipient_id: senderId,
    text: nullableString(delivery.comment_text, 4000),
    postback_payload: buildCommentDmPostbackPayload(action, delivery.id),
    postback_title: action === COMMENT_DM_ACTION_ALREADY_VOTED ? flow.already_voted_label : flow.will_vote_label,
    attachment_type: null,
    attachment_url: null,
    sent_at: nowIso(),
    raw: {
      source: 'initial_comment_vote_discount_action',
      comment_external_id: delivery.comment_external_id,
    },
    duplicate: false,
  }

  const followup = action === COMMENT_DM_ACTION_WILL_VOTE
    ? await enqueueVoteDiscountFollowup(supabase, { delivery, event: syntheticEvent, flow })
    : null

  if (action === COMMENT_DM_ACTION_ALREADY_VOTED) {
    await cancelPendingVoteDiscountFollowups(supabase, delivery.id)
  }

  await updateDeliveryFlowRaw(supabase, delivery, {
    initial_comment_action: action,
    initial_comment_processed_at: nowIso(),
    last_action: action,
    last_inbound_message_id: eventExternalId,
    last_outbound_message_id: result.external_id || null,
    followup_id: followup?.id || null,
    processed_inbound_message_ids: [eventExternalId],
    discount_released_at: action === COMMENT_DM_ACTION_ALREADY_VOTED ? nowIso() : undefined,
  })

  return {
    action,
    followup_id: followup?.id || null,
    followup_due_at: followup?.due_at || null,
  }
}

export async function processInstagramCommentForDmAutomation(params: {
  commentId?: string
  externalId?: string
  force?: boolean
  dryRun?: boolean
  source?: string
} = {}) {
  const supabase = createAdminClient()
  const configs = await readAppConfig(supabase)

  if (!configs.enabled) {
    return { success: true, processed: false, reason: 'automation_disabled' }
  }

  const comment = await loadCommentById(supabase, params)
  if (!comment) return { success: true, processed: false, reason: 'comment_not_found' }
  if (!['instagram', 'facebook'].includes(comment.platform)) return { success: true, processed: false, reason: 'not_meta_comment' }
  if (comment.parent_external_id) return { success: true, processed: false, reason: 'comment_reply_skipped' }
  if (!cleanString(comment.message, 4000)) return { success: true, processed: false, reason: 'empty_comment' }
  if (comment.author_id && configs.instagramOwnedIds.has(comment.author_id)) {
    return { success: true, processed: false, reason: 'own_comment_skipped' }
  }

  const campaigns = await loadMatchingCampaigns(supabase, comment)
  if (campaigns.length === 0) {
    return { success: true, processed: false, reason: 'no_active_campaign' }
  }

  const results = []
  for (const campaign of campaigns) {
    const existing = await getExistingDelivery(supabase, campaign.id, comment.external_id)
    if (existing?.send_status === 'sent') {
      results.push({ campaign_id: campaign.id, delivery_id: existing.id, skipped: true, reason: 'already_sent' })
      break
    }
    const existingWasOnlyBlockedByRepeatAuthor = existing?.send_status === 'skipped'
      && (
        Boolean((existing.raw as Record<string, unknown> | null | undefined)?.duplicate_author)
        || normalizeText(existing.error).includes('autor ja recebeu')
      )
    if (existing && !params.force && !existingWasOnlyBlockedByRepeatAuthor) {
      results.push({ campaign_id: campaign.id, delivery_id: existing.id, skipped: true, reason: 'already_processed' })
      if (existing.ai_matches) break
      continue
    }

    const decision = await classifyComment(campaign, comment)
    const blockedBySafety = decision.safetyFlags.some(flag => ['spam', 'ofensa', 'reclamacao', 'opt_out', 'fora_de_contexto', 'humano'].includes(normalizeText(flag)))
    const confidentlyMatched = decision.matches && decision.confidence >= campaign.confidence_threshold && !blockedBySafety
    const needsReview = decision.matches && !confidentlyMatched
    const shouldAutoSend = confidentlyMatched && campaign.mode === 'auto' && !params.dryRun
    const decisionStatus: DeliveryDecision = confidentlyMatched ? 'matched' : needsReview ? 'needs_review' : 'not_matched'

    let sendStatus: DeliverySendStatus = deliveryStatusFromDecision(decisionStatus)
    let error: string | null = null

    if (shouldAutoSend) {
      const sentInHour = await countSentInCurrentHour(supabase, campaign.id)
      if (sentInHour >= campaign.max_replies_per_hour) {
        error = 'Limite horario da campanha atingido; envio automatico mantido para nao perder a janela do Private Reply.'
      }
    }

    let delivery = await saveDelivery(supabase, campaign, comment, decision, {
      decision: decisionStatus,
      sendStatus,
      error,
    })

    if (shouldAutoSend && sendStatus === 'pending_approval') {
      delivery = await sendDelivery(supabase, delivery)
    }

    await upsertSuggestionForDelivery(supabase, campaign, comment, delivery)

    results.push({
      campaign_id: campaign.id,
      delivery_id: delivery.id,
      matched: delivery.ai_matches,
      confidence: delivery.ai_confidence,
      send_status: delivery.send_status,
      decision: delivery.decision,
      error: delivery.error,
    })

    if (delivery.ai_matches) break
  }

  return {
    success: true,
    processed: true,
    comment_id: comment.id,
    comment_external_id: comment.external_id,
    source: params.source || 'manual',
    results,
  }
}

export async function processRecentInstagramCommentsForDm(params: {
  limit?: number
  force?: boolean
  dryRun?: boolean
  source?: string
  requireCronEnabled?: boolean
} = {}) {
  const supabase = createAdminClient()
  const configs = await readAppConfig(supabase)
  if (!configs.enabled) return { success: true, skipped: true, reason: 'automation_disabled' }
  if (params.requireCronEnabled && !configs.cronEnabled) return { success: true, skipped: true, reason: 'cron_disabled' }

  const safeLimit = Math.min(Math.max(Math.trunc(params.limit || 30), 1), 100)
  const { data, error } = await supabase
    .from('meta_social_comments')
    .select('id')
    .in('platform', ['instagram', 'facebook'])
    .is('parent_external_id', null)
    .not('message', 'is', null)
    .order('commented_at', { ascending: false, nullsFirst: false })
    .limit(safeLimit)

  if (error) throw new Error(error.message)

  const results = []
  const batchSendDelayMs = getCommentDmBatchSendDelayMs()
  for (const row of (data || []) as Array<{ id: string }>) {
    const result = await processInstagramCommentForDmAutomation({
      commentId: row.id,
      force: params.force,
      dryRun: params.dryRun,
      source: params.source || 'recent_comments',
    })
    results.push(result)
    const attemptedSend = (result as any)?.results?.some((item: any) => (
      item?.send_status === 'sent'
      || item?.send_status === 'error'
      || Boolean(item?.error)
    ))
    if (attemptedSend) await sleep(batchSendDelayMs)
  }

  const sent = results.reduce((sum, result: any) => sum + (result.results || []).filter((item: any) => item.send_status === 'sent').length, 0)
  const pending = results.reduce((sum, result: any) => sum + (result.results || []).filter((item: any) => item.send_status === 'pending_approval').length, 0)
  const matched = results.reduce((sum, result: any) => sum + (result.results || []).filter((item: any) => item.matched).length, 0)
  const errors = results.reduce((sum, result: any) => sum + (result.results || []).filter((item: any) => item.send_status === 'error' || item.error).length, 0)

  return {
    success: true,
    scanned: (data || []).length,
    matched,
    sent,
    pending,
    errors,
    results,
  }
}

function buildVoteDiscountFlowFromInput(input: Record<string, unknown>): VoteDiscountFlow {
  const rawFlow = isRecord(input.comment_dm_flow) ? input.comment_dm_flow : {}
  const flowType = cleanString(input.flow_type || rawFlow.type || input.campaign_flow, 80)
  const enabled = flowType === 'vote_discount' || cleanBoolean(input.vote_discount_enabled ?? rawFlow.enabled, false)
  const flow = normalizeVoteDiscountFlow({
    ...rawFlow,
    enabled,
    already_voted_label: input.initial_button_voted_label ?? input.already_voted_label ?? rawFlow.already_voted_label,
    will_vote_label: input.initial_button_vote_label ?? input.will_vote_label ?? rawFlow.will_vote_label,
    already_voted_message: input.voted_message ?? input.already_voted_message ?? rawFlow.already_voted_message,
    already_voted_button_title: input.discount_button_title ?? input.already_voted_button_title ?? rawFlow.already_voted_button_title,
    discount_url: input.discount_button_url ?? input.discount_url ?? rawFlow.discount_url,
    vote_message: input.vote_message ?? rawFlow.vote_message,
    vote_button_title: input.vote_button_title ?? rawFlow.vote_button_title,
    vote_url: input.vote_url ?? rawFlow.vote_url,
    followup_enabled: input.followup_enabled ?? rawFlow.followup_enabled,
    followup_delay_minutes: input.followup_delay_minutes ?? rawFlow.followup_delay_minutes,
    followup_message: input.followup_message ?? rawFlow.followup_message,
    followup_button_title: input.followup_button_title ?? rawFlow.followup_button_title,
  })

  if (!flow.enabled) return flow
  if (!flow.discount_url) throw new Error('Informe o link do livro com desconto.')
  if (!flow.vote_url) throw new Error('Informe o link da votacao.')
  if (!flow.already_voted_message) throw new Error('Informe a mensagem para quem ja votou.')
  if (!flow.vote_message) throw new Error('Informe a mensagem para quem vai votar.')
  if (flow.followup_enabled && !flow.followup_message) throw new Error('Informe a mensagem de follow-up.')
  return flow
}

export async function saveCommentDmCampaign(input: Record<string, unknown>) {
  const supabase = createAdminClient()
  const id = cleanString(input.id, 80)
  const name = cleanString(input.name, 120)
  const triggerIntent = cleanString(input.trigger_intent, 600)
  const replyMessage = cleanString(input.reply_message, 1800)
  const buttonUrlInput = cleanString(input.button_url, 1600)
  const buttonUrl = extractFirstHttpUrl(buttonUrlInput)
  const voteDiscountFlow = buildVoteDiscountFlowFromInput(input)

  if (!name) throw new Error('Informe o nome da campanha.')
  if (!triggerIntent) throw new Error('Informe a intencao esperada da campanha.')
  if (!replyMessage) throw new Error('Informe a mensagem de Direct.')
  if (!voteDiscountFlow.enabled && buttonUrlInput && !buttonUrl) throw new Error('Informe um link valido para o botao ou deixe o campo vazio.')

  const row = {
    name,
    platform: normalizePlatform(input.platform) || 'instagram',
    media_external_id: nullableString(input.media_external_id, 120),
    post_permalink: nullableString(input.post_permalink, 600),
    trigger_intent: triggerIntent,
    trigger_examples: parseExamples(input.trigger_examples),
    reply_message: replyMessage,
    confidence_threshold: clampNumber(input.confidence_threshold, 72, 0, 100),
    mode: normalizeMode(input.mode),
    status: normalizeStatus(input.status),
    max_replies_per_hour: clampNumber(input.max_replies_per_hour, 60, 1, 1000),
    raw: {
      created_from: 'admin_social_inbox',
      flow_type: voteDiscountFlow.enabled ? 'vote_discount' : 'simple_link',
      button_url: voteDiscountFlow.enabled ? null : buttonUrl || null,
      comment_dm_flow: voteDiscountFlow.enabled ? voteDiscountFlow : null,
      direct_offer: voteDiscountFlow.enabled ? 'vote_discount_flow' : 'profile_assessment_direct_access',
      requires_vote_proof: false,
    },
    updated_at: nowIso(),
  }

  const query = id
    ? supabase
        .from('meta_comment_dm_campaigns')
        .update(row)
        .eq('id', id)
        .select('id, name, platform, media_external_id, post_permalink, trigger_intent, trigger_examples, reply_message, confidence_threshold, mode, status, max_replies_per_hour, raw, created_at, updated_at')
        .single()
    : supabase
        .from('meta_comment_dm_campaigns')
        .insert(row)
        .select('id, name, platform, media_external_id, post_permalink, trigger_intent, trigger_examples, reply_message, confidence_threshold, mode, status, max_replies_per_hour, raw, created_at, updated_at')
        .single()

  const { data, error } = await query
  if (error || !data) throw new Error(error?.message || 'Nao foi possivel salvar campanha.')
  return data as CampaignRow
}

export async function deleteCommentDmCampaign(campaignId: string) {
  const supabase = createAdminClient()
  const id = cleanString(campaignId, 80)
  if (!id) throw new Error('Informe a campanha.')

  const { data, error } = await supabase
    .from('meta_comment_dm_campaigns')
    .delete()
    .eq('id', id)
    .select('id, name')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Campanha nao encontrada.')
  return data as { id: string; name: string }
}

export async function listInstagramCampaignMedia(limit = 40, platform: Platform | 'all' = 'instagram') {
  const supabase = createAdminClient()
  const safeLimit = Math.min(Math.max(Math.trunc(limit || 40), 1), 80)
  let query = supabase
    .from('organic_social_media')
    .select('id, platform, external_id, media_type, media_product_type, caption, permalink, thumbnail_url, media_url, published_at, like_count, comments_count')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(safeLimit)

  if (platform === 'all') query = query.in('platform', ['instagram', 'facebook'])
  else query = query.eq('platform', platform)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data || []) as CampaignMediaRow[]
}

export async function listCommentDmAutomation(limit = 60) {
  const supabase = createAdminClient()
  const safeLimit = Math.min(Math.max(Math.trunc(limit || 60), 1), 1000)
  const [
    { data: campaigns, error: campaignsError },
    { data: deliveries, error: deliveriesError },
    { count: deliveriesCount, error: deliveriesCountError },
  ] = await Promise.all([
    supabase
      .from('meta_comment_dm_campaigns')
      .select('id, name, platform, media_external_id, post_permalink, trigger_intent, trigger_examples, reply_message, confidence_threshold, mode, status, max_replies_per_hour, raw, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(80),
    supabase
      .from('meta_comment_dm_deliveries')
      .select('id, campaign_id, comment_id, platform, comment_external_id, media_external_id, author_id, author_name, comment_text, ai_matches, ai_confidence, ai_reason, normalized_intent, reply_message, decision, send_status, private_reply_external_id, private_reply_channel, error, processed_at, sent_at, raw, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(safeLimit),
    supabase
      .from('meta_comment_dm_deliveries')
      .select('id', { count: 'exact', head: true }),
  ])

  if (campaignsError) throw new Error(campaignsError.message)
  if (deliveriesError) throw new Error(deliveriesError.message)
  if (deliveriesCountError) throw new Error(deliveriesCountError.message)

  return {
    campaigns: (campaigns || []) as CampaignRow[],
    deliveries: (deliveries || []) as DeliveryRow[],
    total_deliveries: deliveriesCount || 0,
  }
}

export async function handleCommentDmSuggestionAction(params: {
  suggestionId: string
  action: 'approve' | 'send'
  reply?: string
}) {
  const supabase = createAdminClient()
  const { data: suggestion, error } = await supabase
    .from('meta_social_ai_suggestions')
    .select('id, source_type, source_id, platform, raw, suggested_reply')
    .eq('id', params.suggestionId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  const raw = (suggestion?.raw || {}) as Record<string, unknown>
  const deliveryId = cleanString(raw.comment_dm_delivery_id, 80)
  if (!suggestion || !['instagram', 'facebook'].includes(suggestion.platform) || !deliveryId || raw.private_reply !== true) {
    return { handled: false }
  }

  if (params.action === 'approve') {
    await supabase
      .from('meta_comment_dm_deliveries')
      .update({ send_status: 'pending_approval', updated_at: nowIso() })
      .eq('id', deliveryId)
    await supabase
      .from('meta_social_ai_suggestions')
      .update({ status: 'approved', updated_at: nowIso() })
      .eq('id', params.suggestionId)
    return { handled: true, sent: false, action: 'approve', delivery_id: deliveryId }
  }

  const delivery = await loadDeliveryById(supabase, deliveryId)
  if (!delivery) throw new Error('Entrega de Private Reply nao encontrada.')
  const sent = await sendDelivery(supabase, delivery, params.reply || suggestion.suggested_reply || '')
  await supabase
    .from('meta_social_ai_suggestions')
    .update({
      status: sent.send_status === 'sent' ? 'sent' : 'pending',
      suggested_reply: cleanString(params.reply || suggestion.suggested_reply || sent.reply_message, 1800),
      recommended_action: sent.send_status === 'sent' ? 'Mensagem privada enviada pelo comentario.' : 'Falha ao enviar mensagem privada; verificar log da entrega.',
      updated_at: nowIso(),
      raw: {
        ...raw,
        comment_dm_delivery_id: sent.id,
        private_reply_status: sent.send_status,
        private_reply_external_id: sent.private_reply_external_id,
        private_reply_channel: sent.private_reply_channel,
        private_reply_error: sent.error,
      },
    })
    .eq('id', params.suggestionId)

  return {
    handled: true,
    sent: sent.send_status === 'sent',
    platform: sent.platform,
    delivery_id: sent.id,
    external_id: sent.private_reply_external_id || '',
    error: sent.error,
  }
}

async function loadDeliveryById(supabase: SupabaseAdmin, deliveryId: string) {
  const { data, error } = await supabase
    .from('meta_comment_dm_deliveries')
    .select('id, campaign_id, comment_id, platform, comment_external_id, media_external_id, author_id, author_name, comment_text, ai_matches, ai_confidence, ai_reason, normalized_intent, reply_message, decision, send_status, private_reply_external_id, private_reply_channel, error, processed_at, sent_at, raw, created_at, updated_at')
    .eq('id', deliveryId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data || null) as DeliveryRow | null
}

async function loadCampaignById(supabase: SupabaseAdmin, campaignId: string) {
  const id = cleanString(campaignId, 80)
  if (!id) return null

  const { data, error } = await supabase
    .from('meta_comment_dm_campaigns')
    .select('id, name, platform, media_external_id, post_permalink, trigger_intent, trigger_examples, reply_message, confidence_threshold, mode, status, max_replies_per_hour, raw, created_at, updated_at')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data || null) as CampaignRow | null
}

async function resolveCurrentVoteDiscountFlow(supabase: SupabaseAdmin, delivery: DeliveryRow) {
  const campaign = await loadCampaignById(supabase, delivery.campaign_id)
  if (campaign) {
    const currentFlow = getCampaignVoteDiscountFlow(campaign)
    if (currentFlow.enabled) return currentFlow
  }
  return getDeliveryVoteDiscountFlow(delivery)
}

function extractPrivateReplyRecipientId(delivery: DeliveryRow) {
  const raw = (delivery.raw || {}) as Record<string, any>
  return cleanString(
    raw?.private_reply_result?.recipient_id
    || raw?.private_reply_result?.raw?.recipient_id
    || raw?.private_reply_result?.recipientId,
    160,
  )
}

async function findRecentProfileAssessmentDelivery(supabase: SupabaseAdmin, senderId: string) {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('meta_comment_dm_deliveries')
    .select('id, campaign_id, comment_id, platform, comment_external_id, media_external_id, author_id, author_name, comment_text, ai_matches, ai_confidence, ai_reason, normalized_intent, reply_message, decision, send_status, private_reply_external_id, private_reply_channel, error, processed_at, sent_at, raw, created_at, updated_at')
    .eq('platform', 'instagram')
    .eq('send_status', 'sent')
    .gte('sent_at', since)
    .order('sent_at', { ascending: false, nullsFirst: false })
    .limit(120)

  if (error) throw new Error(error.message)
  const safeSenderId = cleanString(senderId, 160)
  return ((data || []) as DeliveryRow[]).find(delivery => {
    const recipientId = extractPrivateReplyRecipientId(delivery)
    return (
      isProfileAssessmentReply(delivery.reply_message)
      && deliveryRequiresVoteProof(delivery)
      && (delivery.author_id === safeSenderId || recipientId === safeSenderId)
    )
  }) || null
}

async function recordInstagramDirectOutbound(supabase: SupabaseAdmin, event: WebhookMessageEvent, message: string, result: {
  external_id?: string
  channel?: string
  raw?: unknown
}, source = 'instagram_vote_proof_automation') {
  const now = nowIso()
  await supabase
    .from('meta_social_messages')
    .upsert({
      thread_id: event.thread_id,
      platform: 'instagram',
      external_id: result.external_id || `outbound_vote_proof_${event.external_id}_${Date.now()}`,
      sender_id: event.recipient_id,
      recipient_id: event.sender_id,
      direction: 'outbound',
      message,
      sent_at: now,
      raw: {
        channel: result.channel || null,
        source,
        result: result.raw || result,
      },
      updated_at: now,
    }, { onConflict: 'platform,external_id' })
}

async function updateDeliveryVoteProofRaw(supabase: SupabaseAdmin, delivery: DeliveryRow, payload: Record<string, unknown>) {
  await supabase
    .from('meta_comment_dm_deliveries')
    .update({
      raw: {
        ...(delivery.raw || {}),
        instagram_vote_proof: payload,
      },
      updated_at: nowIso(),
    })
    .eq('id', delivery.id)
}

function deliveryHasVoteDiscountFlow(delivery: DeliveryRow) {
  return getDeliveryVoteDiscountFlow(delivery).enabled
}

async function findRecentVoteDiscountDelivery(supabase: SupabaseAdmin, event: WebhookMessageEvent) {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('meta_comment_dm_deliveries')
    .select('id, campaign_id, comment_id, platform, comment_external_id, media_external_id, author_id, author_name, comment_text, ai_matches, ai_confidence, ai_reason, normalized_intent, reply_message, decision, send_status, private_reply_external_id, private_reply_channel, error, processed_at, sent_at, raw, created_at, updated_at')
    .eq('platform', 'instagram')
    .eq('send_status', 'sent')
    .gte('sent_at', since)
    .order('sent_at', { ascending: false, nullsFirst: false })
    .limit(120)

  if (error) throw new Error(error.message)
  return ((data || []) as DeliveryRow[]).find(delivery => {
    const recipientId = extractPrivateReplyRecipientId(delivery)
    return (
      deliveryHasVoteDiscountFlow(delivery)
      && (delivery.author_id === event.sender_id || recipientId === event.sender_id)
    )
  }) || null
}

async function resolveVoteDiscountDelivery(supabase: SupabaseAdmin, event: WebhookMessageEvent, deliveryId?: string) {
  if (deliveryId) {
    const delivery = await loadDeliveryById(supabase, deliveryId)
    if (delivery && deliveryHasVoteDiscountFlow(delivery)) return delivery
  }
  return findRecentVoteDiscountDelivery(supabase, event)
}

async function updateDeliveryFlowRaw(supabase: SupabaseAdmin, delivery: DeliveryRow, payload: Record<string, unknown>) {
  await supabase
    .from('meta_comment_dm_deliveries')
    .update({
      raw: {
        ...(delivery.raw || {}),
        comment_dm_flow_state: {
          ...((delivery.raw as Record<string, any> | null | undefined)?.comment_dm_flow_state || {}),
          ...payload,
          updated_at: nowIso(),
        },
      },
      updated_at: nowIso(),
    })
    .eq('id', delivery.id)
}

async function cancelPendingVoteDiscountFollowups(supabase: SupabaseAdmin, deliveryId: string) {
  await supabase
    .from('meta_comment_dm_flow_followups')
    .update({
      status: 'cancelled',
      updated_at: nowIso(),
      raw: {
        cancelled_by: COMMENT_DM_ACTION_ALREADY_VOTED,
        cancelled_at: nowIso(),
      },
    })
    .eq('delivery_id', deliveryId)
    .eq('action', COMMENT_DM_FLOW_FOLLOWUP_ACTION)
    .eq('status', 'pending')
}

async function enqueueVoteDiscountFollowup(supabase: SupabaseAdmin, params: {
  delivery: DeliveryRow
  event: WebhookMessageEvent
  flow: VoteDiscountFlow
}) {
  if (!params.flow.followup_enabled) return null

  const dueAt = new Date(Date.now() + params.flow.followup_delay_minutes * 60 * 1000).toISOString()
  const buttons = buildUrlButton(params.flow.followup_button_title, params.flow.discount_url)
  const { data: existingPending, error: existingError } = await supabase
    .from('meta_comment_dm_flow_followups')
    .select('id, campaign_id, delivery_id, platform, recipient_id, sender_id, action, status, due_at, attempts, message, buttons, idempotency_key, error, raw, sent_at, created_at, updated_at')
    .eq('delivery_id', params.delivery.id)
    .eq('action', COMMENT_DM_FLOW_FOLLOWUP_ACTION)
    .eq('status', 'pending')
    .order('due_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingError) throw new Error(existingError.message)
  if (existingPending) return existingPending as FlowFollowupRow

  const idempotencyKey = [
    params.delivery.id,
    COMMENT_DM_FLOW_FOLLOWUP_ACTION,
    cleanString(params.event.external_id, 240) || Date.now(),
  ].join(':')

  const { data, error } = await supabase
    .from('meta_comment_dm_flow_followups')
    .upsert({
      campaign_id: params.delivery.campaign_id,
      delivery_id: params.delivery.id,
      platform: 'instagram',
      recipient_id: params.event.sender_id,
      sender_id: params.event.recipient_id,
      action: COMMENT_DM_FLOW_FOLLOWUP_ACTION,
      status: 'pending',
      due_at: dueAt,
      message: params.flow.followup_message,
      buttons,
      idempotency_key: idempotencyKey,
      error: null,
      raw: {
        source: 'comment_dm_vote_discount_flow',
        inbound_postback_id: params.event.external_id,
        followup_delay_minutes: params.flow.followup_delay_minutes,
        scheduled_at: nowIso(),
      },
      updated_at: nowIso(),
    }, { onConflict: 'idempotency_key' })
    .select('id, campaign_id, delivery_id, platform, recipient_id, sender_id, action, status, due_at, attempts, message, buttons, idempotency_key, error, raw, sent_at, created_at, updated_at')
    .single()

  if (error || !data) throw new Error(error?.message || 'Nao foi possivel agendar follow-up do livro.')
  return data as FlowFollowupRow
}

export async function processInstagramDirectFlowPostback(event: WebhookMessageEvent) {
  if (event.platform !== 'instagram') return { success: true, processed: false, reason: 'not_instagram' }
  if (event.duplicate) return { success: true, processed: false, reason: 'duplicate_message' }

  const parsed = parseCommentDmPostbackPayload(event.postback_payload)
  const textAction = parsed ? null : inferCommentDmFlowActionFromText(event.text)
  if (!parsed && !textAction) return { success: true, processed: false, reason: 'not_comment_dm_flow_postback' }

  const supabase = createAdminClient()
  const delivery = await resolveVoteDiscountDelivery(supabase, event, parsed?.deliveryId || '')
  if (!delivery) return { success: true, processed: false, reason: 'no_recent_vote_discount_delivery' }
  const flowState = isRecord((delivery.raw as Record<string, unknown> | null | undefined)?.comment_dm_flow_state)
    ? (delivery.raw as Record<string, any>).comment_dm_flow_state
    : {}
  const processedInboundIds = Array.isArray(flowState.processed_inbound_message_ids)
    ? flowState.processed_inbound_message_ids.map((item: unknown) => cleanString(item, 1000)).filter(Boolean)
    : []
  if (
    cleanString(flowState.last_inbound_message_id, 1000) === event.external_id
    || processedInboundIds.includes(event.external_id)
  ) {
    return { success: true, processed: false, reason: 'inbound_already_processed', delivery_id: delivery.id }
  }

  const flow = await resolveCurrentVoteDiscountFlow(supabase, delivery)
  const action = parsed?.action || textAction
  if (!action) return { success: true, processed: false, reason: 'not_comment_dm_flow_postback' }
  const eventSource = rawPathString(event.raw, ['source'])
  if (
    eventSource !== 'initial_comment_vote_discount_action'
    && cleanString(flowState.initial_comment_action, 80) === action
  ) {
    return { success: true, processed: false, reason: 'action_already_started_from_comment', delivery_id: delivery.id, action }
  }
  const responseMessage = action === COMMENT_DM_ACTION_ALREADY_VOTED
    ? flow.already_voted_message
    : flow.vote_message
  const buttons = action === COMMENT_DM_ACTION_ALREADY_VOTED
    ? buildUrlButton(flow.already_voted_button_title, flow.discount_url)
    : buildUrlButton(flow.vote_button_title, flow.vote_url)

  const sent = await sendInstagramDirectMessageToRecipient({
    recipientId: event.sender_id,
    message: responseMessage,
    buttons,
    supabase,
  })

  const followup = action === COMMENT_DM_ACTION_WILL_VOTE
    ? await enqueueVoteDiscountFollowup(supabase, { delivery, event, flow })
    : null

  if (action === COMMENT_DM_ACTION_ALREADY_VOTED) {
    await cancelPendingVoteDiscountFollowups(supabase, delivery.id)
  }

  await Promise.allSettled([
    recordInstagramDirectOutbound(supabase, event, responseMessage, sent, 'instagram_comment_dm_flow_postback'),
    updateDeliveryFlowRaw(supabase, delivery, {
      last_action: action,
      last_inbound_message_id: event.external_id,
      last_outbound_message_id: sent.external_id || null,
      followup_id: followup?.id || null,
      processed_inbound_message_ids: [...new Set([...processedInboundIds, event.external_id])].slice(-20),
      discount_released_at: action === COMMENT_DM_ACTION_ALREADY_VOTED ? nowIso() : undefined,
    }),
  ])

  return {
    success: true,
    processed: true,
    action,
    delivery_id: delivery.id,
    outbound_message_id: sent.external_id || null,
    followup_id: followup?.id || null,
    followup_due_at: followup?.due_at || null,
  }
}

function rawPathString(value: unknown, path: string[]) {
  let current: unknown = value
  for (const key of path) {
    if (!isRecord(current)) return ''
    current = current[key]
  }
  return cleanString(current, 1000)
}

function syncedMessageToWebhookEvent(row: Record<string, any>): WebhookMessageEvent | null {
  const externalId = cleanString(row.external_id, 1000)
  const senderId = cleanString(row.sender_id, 160)
  const recipientId = cleanString(row.recipient_id, 160)
  if (!externalId || !senderId || !recipientId) return null

  const raw = isRecord(row.raw) ? row.raw : {}
  const postbackPayload = cleanString(
    rawPathString(raw, ['postback', 'payload'])
    || rawPathString(raw, ['quick_reply', 'payload']),
    1000,
  )
  const postbackTitle = cleanString(
    rawPathString(raw, ['postback', 'title'])
    || rawPathString(raw, ['quick_reply', 'title']),
    1000,
  )
  const text = nullableString(row.message || postbackTitle, 4000)

  if (!parseCommentDmPostbackPayload(postbackPayload) && !inferCommentDmFlowActionFromText(text)) return null

  return {
    platform: 'instagram',
    thread_id: cleanString(row.thread_id, 120) || null,
    thread_external_id: cleanString(row.thread_external_id, 240) || `ig_dm_${recipientId}_${senderId}`,
    external_id: externalId,
    sender_id: senderId,
    recipient_id: recipientId,
    text,
    postback_payload: nullableString(postbackPayload, 1000),
    postback_title: nullableString(postbackTitle, 1000),
    attachment_type: nullableString(row.attachment_type, 120),
    attachment_url: nullableString(row.attachment_url, 1600),
    sent_at: nullableString(row.sent_at, 120),
    raw,
    duplicate: false,
  }
}

export async function processRecentInstagramDirectFlowMessages(params: {
  limit?: number
  sinceMinutes?: number
} = {}) {
  const supabase = createAdminClient()
  const safeLimit = Math.min(Math.max(Math.trunc(params.limit || 30), 1), 100)
  const sinceMinutes = Math.min(Math.max(Math.trunc(params.sinceMinutes || 180), 5), 24 * 60)
  const since = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('meta_social_messages')
    .select('id, thread_id, external_id, sender_id, recipient_id, message, attachment_type, attachment_url, sent_at, raw, created_at')
    .eq('platform', 'instagram')
    .eq('direction', 'inbound')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(safeLimit)

  if (error) throw new Error(error.message)

  const results = []
  for (const row of ([...(data || [])] as Array<Record<string, any>>).reverse()) {
    const event = syncedMessageToWebhookEvent(row)
    if (!event) continue
    results.push(await processInstagramDirectFlowPostback(event))
  }

  return {
    success: true,
    scanned: (data || []).length,
    candidates: results.length,
    processed: results.filter((item: any) => item?.processed).length,
    results,
  }
}

async function recordInstagramFlowFollowupOutbound(supabase: SupabaseAdmin, followup: FlowFollowupRow, result: {
  external_id?: string
  channel?: string
  raw?: unknown
}) {
  const now = nowIso()
  const threadExternalId = `ig_dm_${followup.sender_id || 'pilger'}_${followup.recipient_id}`
  const { data: thread, error: threadError } = await supabase
    .from('meta_social_threads')
    .upsert({
      platform: 'instagram',
      external_id: threadExternalId,
      thread_type: 'direct',
      participant_id: followup.recipient_id,
      last_message_at: now,
      raw: {
        source: 'comment_dm_flow_followup',
        sender_id: followup.sender_id || null,
      },
      updated_at: now,
    }, { onConflict: 'platform,external_id' })
    .select('id')
    .single()

  if (threadError || !thread) throw new Error(threadError?.message || 'Nao foi possivel registrar conversa do follow-up.')

  await supabase
    .from('meta_social_messages')
    .upsert({
      thread_id: thread.id,
      platform: 'instagram',
      external_id: result.external_id || `outbound_comment_dm_followup_${followup.id}_${Date.now()}`,
      sender_id: followup.sender_id,
      recipient_id: followup.recipient_id,
      direction: 'outbound',
      message: followup.message,
      sent_at: now,
      raw: {
        channel: result.channel || null,
        source: 'comment_dm_flow_followup',
        followup_id: followup.id,
        result: result.raw || result,
      },
      updated_at: now,
    }, { onConflict: 'platform,external_id' })
}

async function markFlowFollowupError(supabase: SupabaseAdmin, followup: FlowFollowupRow, message: string) {
  await supabase
    .from('meta_comment_dm_flow_followups')
    .update({
      status: 'error',
      attempts: Number(followup.attempts || 0) + 1,
      error: message.slice(0, 900),
      updated_at: nowIso(),
    })
    .eq('id', followup.id)
}

async function updateDeliveryFollowupSentRaw(supabase: SupabaseAdmin, followup: FlowFollowupRow) {
  if (!followup.delivery_id) return
  const delivery = await loadDeliveryById(supabase, followup.delivery_id)
  if (!delivery) return
  await supabase
    .from('meta_comment_dm_deliveries')
    .update({
      raw: {
        ...(delivery.raw || {}),
        comment_dm_flow_state: {
          ...((delivery.raw as Record<string, any> | null | undefined)?.comment_dm_flow_state || {}),
          followup_sent_at: nowIso(),
          followup_id: followup.id,
        },
      },
      updated_at: nowIso(),
    })
    .eq('id', followup.delivery_id)
}

export async function processDueCommentDmFlowFollowups(limit = 20) {
  const supabase = createAdminClient()
  const safeLimit = Math.min(Math.max(Math.trunc(limit || 20), 1), 80)
  const { data, error } = await supabase
    .from('meta_comment_dm_flow_followups')
    .select('id, campaign_id, delivery_id, platform, recipient_id, sender_id, action, status, due_at, attempts, message, buttons, idempotency_key, error, raw, sent_at, created_at, updated_at')
    .eq('platform', 'instagram')
    .eq('status', 'pending')
    .lte('due_at', nowIso())
    .order('due_at', { ascending: true })
    .limit(safeLimit)

  if (error) throw new Error(error.message)

  const results = []
  for (const followup of (data || []) as FlowFollowupRow[]) {
    try {
      const buttons = normalizeMetaMessageButtons(followup.buttons)
      const sent = await sendInstagramDirectMessageToRecipient({
        recipientId: followup.recipient_id,
        message: followup.message,
        buttons,
        supabase,
      })

      const { error: updateError } = await supabase
        .from('meta_comment_dm_flow_followups')
        .update({
          status: 'sent',
          attempts: Number(followup.attempts || 0) + 1,
          error: null,
          sent_at: nowIso(),
          updated_at: nowIso(),
          raw: {
            ...(followup.raw || {}),
            outbound_message_id: sent.external_id || null,
            outbound_channel: sent.channel || null,
            sent_result: sent.raw || sent,
          },
        })
        .eq('id', followup.id)

      if (updateError) throw new Error(updateError.message)

      await Promise.allSettled([
        updateDeliveryFollowupSentRaw(supabase, followup),
        recordInstagramFlowFollowupOutbound(supabase, followup, sent),
      ])

      results.push({
        id: followup.id,
        status: 'sent',
        outbound_message_id: sent.external_id || null,
      })
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : String(sendError)
      await markFlowFollowupError(supabase, followup, message)
      results.push({
        id: followup.id,
        status: 'error',
        error: message,
      })
    }
  }

  return {
    success: true,
    processed: results.length,
    sent: results.filter(item => item.status === 'sent').length,
    errors: results.filter(item => item.status === 'error').length,
    results,
  }
}

export function extractMetaWebhookMessageEvents(payload: any): Omit<WebhookMessageEvent, 'thread_id' | 'duplicate'>[] {
  const object = String(payload?.object || '').toLowerCase()
  const defaultPlatform = normalizePlatform(object)
  const events: Omit<WebhookMessageEvent, 'thread_id' | 'duplicate'>[] = []

  for (const entry of payload?.entry || []) {
    for (const messaging of entry?.messaging || []) {
      const message = messaging?.message || {}
      if (message?.is_echo) continue
      const postback = messaging?.postback || message?.postback || null
      const quickReply = message?.quick_reply || null

      const platform = defaultPlatform || normalizePlatform(messaging?.platform) || 'instagram'
      if (platform !== 'instagram') continue

      const senderId = firstString(messaging?.sender?.id, messaging?.from?.id)
      const recipientId = firstString(messaging?.recipient?.id, messaging?.to?.id, entry?.id)
      const postbackPayload = firstString(postback?.payload, quickReply?.payload)
      const postbackTitle = firstString(postback?.title, quickReply?.title, message?.text)
      const timestampKey = cleanString(messaging?.timestamp || entry?.time || Date.now(), 80)
      const externalId = firstString(
        message?.mid,
        message?.id,
        postback?.mid,
        postback?.id,
        postbackPayload ? `postback_${recipientId}_${senderId}_${timestampKey}_${postbackPayload}` : '',
      )
      if (!senderId || !recipientId || !externalId) continue

      const attachment = resolveAttachment(message)
      events.push({
        platform,
        thread_external_id: `ig_dm_${recipientId}_${senderId}`,
        external_id: externalId,
        sender_id: senderId,
        recipient_id: recipientId,
        text: nullableString(message?.text || postbackTitle, 4000),
        postback_payload: nullableString(postbackPayload, 1000),
        postback_title: nullableString(postbackTitle, 1000),
        attachment_type: attachment.type,
        attachment_url: attachment.url,
        sent_at: toIsoTimestamp(messaging?.timestamp || entry?.time),
        raw: {
          object: payload?.object || null,
          entry_id: entry?.id || null,
          entry_time: entry?.time || null,
          postback: postback || null,
          quick_reply: quickReply || null,
          messaging,
        },
      })
    }
  }

  return events
}

export async function ingestMetaWebhookMessages(payload: any) {
  const supabase = createAdminClient()
  const configs = await readAppConfig(supabase)
  const events = extractMetaWebhookMessageEvents(payload)
  const rows: WebhookMessageEvent[] = []

  for (const event of events) {
    if (configs.instagramOwnedIds.has(event.sender_id)) continue

    const { data: existingMessage } = await supabase
      .from('meta_social_messages')
      .select('id')
      .eq('platform', event.platform)
      .eq('external_id', event.external_id)
      .maybeSingle()

    const { data: thread, error: threadError } = await supabase
      .from('meta_social_threads')
      .upsert({
        platform: event.platform,
        external_id: event.thread_external_id,
        thread_type: 'direct',
        participant_id: event.sender_id,
        last_message_at: event.sent_at || nowIso(),
        raw: {
          source: 'meta_webhook_message',
          recipient_id: event.recipient_id,
        },
        updated_at: nowIso(),
      }, { onConflict: 'platform,external_id' })
      .select('id')
      .single()

    if (threadError || !thread) throw new Error(threadError?.message || 'Nao foi possivel salvar conversa Instagram.')

    const { error: messageError } = await supabase
      .from('meta_social_messages')
      .upsert({
        thread_id: thread.id,
        platform: event.platform,
        external_id: event.external_id,
        sender_id: event.sender_id,
        recipient_id: event.recipient_id,
        direction: 'inbound',
        message: event.text,
        attachment_type: event.attachment_type,
        attachment_url: event.attachment_url,
        sent_at: event.sent_at,
        raw: event.raw,
        updated_at: nowIso(),
      }, { onConflict: 'platform,external_id' })

    if (messageError) throw new Error(messageError.message)
    rows.push({ ...event, thread_id: thread.id, duplicate: Boolean(existingMessage?.id) })
  }

  return rows
}

export async function processInstagramDirectVoteProof(event: WebhookMessageEvent) {
  if (event.platform !== 'instagram') return { success: true, processed: false, reason: 'not_instagram' }
  if (event.duplicate) return { success: true, processed: false, reason: 'duplicate_message' }
  if (!looksLikeVoteProofFollowUp(event)) return { success: true, processed: false, reason: 'not_vote_proof_followup' }

  const supabase = createAdminClient()
  const delivery = await findRecentProfileAssessmentDelivery(supabase, event.sender_id)
  if (!delivery) return { success: true, processed: false, reason: 'no_recent_profile_assessment_delivery' }

  const toolUrl = buildProfileAssessmentToolUrl()
  let responseMessage = ''
  let proofApproved = false
  let analysisPayload: Record<string, unknown> = {
    inbound_message_id: event.external_id,
    attachment_type: event.attachment_type,
    attachment_url_present: Boolean(event.attachment_url),
    processed_at: nowIso(),
  }

  if (event.attachment_url) {
    const media = await downloadAttachment(event.attachment_url)
    const analysis = await analyzeVoteProofMedia(
      media.buffer,
      media.contentType,
      attachmentKind(event.attachment_type, media.contentType),
    )
    analysisPayload = {
      ...analysisPayload,
      analysis,
    }

    if (analysis.status === 'approved') {
      proofApproved = true
      responseMessage = buildVoteProofApprovedMessage(toolUrl)
    } else {
      responseMessage = buildVoteProofRejectedMessage()
    }
  } else {
    responseMessage = buildVoteProofReminderMessage()
  }

  responseMessage = cleanString(repairKnownPortugueseArtifacts(responseMessage), 1800)

  const sent = await sendInstagramDirectMessageToRecipient({
    recipientId: event.sender_id,
    message: responseMessage,
    buttonUrl: proofApproved ? toolUrl : undefined,
    supabase,
  })

  await Promise.all([
    recordInstagramDirectOutbound(supabase, event, responseMessage, sent),
    updateDeliveryVoteProofRaw(supabase, delivery, {
      ...analysisPayload,
      response_message: responseMessage,
      outbound_message_id: sent.external_id || null,
      outbound_channel: sent.channel || null,
    }),
  ])

  return {
    success: true,
    processed: true,
    delivery_id: delivery.id,
    sent: true,
    outbound_message_id: sent.external_id || null,
    action: event.attachment_url ? 'vote_proof_processed' : 'vote_proof_requested',
  }
}

export function extractMetaWebhookCommentEvents(payload: any): WebhookCommentEvent[] {
  const object = String(payload?.object || '').toLowerCase()
  const defaultPlatform: Platform = object.includes('page') ? 'facebook' : 'instagram'
  const events: WebhookCommentEvent[] = []

  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      const field = String(change?.field || '').toLowerCase()
      const value = change?.value || {}
      const commentId = firstString(value.comment_id, value.id, value.comment?.id)
      const text = firstString(value.text, value.message, value.comment?.text, value.comment?.message)
      const looksLikeComment = field.includes('comment') || Boolean(commentId && text)
      if (!looksLikeComment || !commentId || !text) continue

      const platform: Platform = object.includes('instagram') || field.includes('instagram') ? 'instagram' : defaultPlatform
      const rawMediaId = firstString(value.media_id, value.media?.id, value.post_id, value.parent_id)
      const rawParentId = firstString(value.parent_comment_id, value.comment?.parent_id)
      const inferredParentId = !rawParentId && value.parent_id && value.post_id && String(value.parent_id) !== String(value.post_id)
        ? String(value.parent_id)
        : ''
      events.push({
        platform,
        external_id: commentId,
        media_external_id: rawMediaId || null,
        parent_external_id: firstString(rawParentId, inferredParentId) || null,
        author_id: firstString(value.from?.id, value.user_id, value.sender_id, value.comment?.from?.id) || null,
        author_name: firstString(value.from?.username, value.from?.name, value.username, value.user_name, value.comment?.from?.username, value.comment?.from?.name) || null,
        message: text,
        commented_at: toIsoTimestamp(value.created_time || value.timestamp || entry?.time),
        raw: {
          object: payload?.object || null,
          entry_id: entry?.id || null,
          entry_time: entry?.time || null,
          field,
          value,
        },
      })
    }
  }

  return events
}

export async function ingestMetaWebhookComments(payload: any) {
  const supabase = createAdminClient()
  const events = extractMetaWebhookCommentEvents(payload)
  if (events.length === 0) return []

  const rows = events.map(event => ({
    platform: event.platform,
    external_id: event.external_id,
    media_external_id: event.media_external_id,
    parent_external_id: event.parent_external_id,
    author_id: event.author_id,
    author_name: event.author_name,
    message: event.message,
    commented_at: event.commented_at,
    raw: event.raw,
    synced_at: nowIso(),
    updated_at: nowIso(),
  }))

  const existingKeys = rows.map(row => row.external_id).filter(Boolean)
  const { data: existingRows } = existingKeys.length
    ? await supabase
        .from('meta_social_comments')
        .select('platform, external_id, author_id, author_name')
        .in('platform', ['instagram', 'facebook'])
        .in('external_id', existingKeys)
    : { data: [] }
  const existingCommentRows = (existingRows || []) as Array<{
    platform: Platform
    external_id: string
    author_id: string | null
    author_name: string | null
  }>
  const existingByKey = new Map(existingCommentRows.map(row => [`${row.platform}:${row.external_id}`, row]))
  const rowsWithPreservedAuthors = rows.map(row => {
    const existing = existingByKey.get(`${row.platform}:${row.external_id}`)
    return {
      ...row,
      author_id: row.author_id || existing?.author_id || null,
      author_name: row.author_name || existing?.author_name || null,
    }
  })

  const { data, error } = await supabase
    .from('meta_social_comments')
    .upsert(rowsWithPreservedAuthors, { onConflict: 'platform,external_id' })
    .select('id, platform, external_id, media_external_id, parent_external_id, author_id, author_name, message, permalink, commented_at, raw, created_at, updated_at')

  if (error) throw new Error(error.message)
  return (data || []) as CommentRow[]
}

export async function shouldAutoprocessWebhook() {
  const supabase = createAdminClient()
  const configs = await readAppConfig(supabase)
  return configs.enabled && configs.webhookAutoprocess
}

export async function recordCommentDmCronResult(result: unknown, error?: unknown) {
  const supabase = createAdminClient()
  if (error) {
    const message = error instanceof Error ? error.message : String(error)
    await Promise.all([
      saveAppConfig(supabase, 'meta_comment_dm_cron_last_error', message.slice(0, 500)),
      saveAppConfig(supabase, 'meta_comment_dm_cron_last_error_at', nowIso()),
    ])
    return
  }

  await Promise.all([
    saveAppConfig(supabase, 'meta_comment_dm_cron_last_run_at', nowIso()),
    saveAppConfig(supabase, 'meta_comment_dm_cron_last_error', ''),
    saveAppConfig(supabase, 'meta_comment_dm_cron_last_result', JSON.stringify(result).slice(0, 2000)),
  ])
}
