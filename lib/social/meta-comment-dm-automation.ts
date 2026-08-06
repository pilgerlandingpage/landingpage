import { chatWithGemini, getGeminiApiKey } from '@/lib/gemini'
import { AI_TOKEN_AUTOMATION_PAUSE_KEY } from '@/lib/ai/automation-control'
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
  aiTokenPauseActive: boolean
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

type MetaQuickReply = {
  content_type: 'text'
  title: string
  payload: string
}

type MetaUrlButton = {
  type: 'web_url'
  url: string
  title: string
}

type MetaMessagePayload =
  | { text: string; quick_replies?: MetaQuickReply[] }
  | {
      attachment: {
        type: 'template'
        payload: {
          template_type: 'button'
          text: string
          buttons: MetaUrlButton[]
        }
      }
    }

type MetaMessageSendPlan = {
  kind: 'button_template' | 'quick_replies' | 'text'
  message: MetaMessagePayload
}

type CommentDmFlow = {
  type: 'vote_discount'
  voteUrl: string
  discountUrl: string
  voteMessage: string
  alreadyVotedMessage: string
  followupMessage: string
  willVoteLabel: string
  alreadyVotedLabel: string
  voteButtonTitle: string
  alreadyVotedButtonTitle: string
  followupButtonTitle: string
  followupDelayMinutes: number
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

function cleanButtonTitle(value: unknown, fallback: string) {
  return cleanString(repairKnownPortugueseArtifacts(cleanString(value, 40)), 20) || cleanString(fallback, 20)
}

function getCommentDmFlowFromRaw(rawInput: unknown): CommentDmFlow | null {
  const raw = rawInput && typeof rawInput === 'object' ? rawInput as Record<string, any> : {}
  const nestedSource = raw.comment_dm_flow && typeof raw.comment_dm_flow === 'object'
    ? raw.comment_dm_flow as Record<string, any>
    : null
  const directFlowType = normalizeText(raw.type || raw.flow_type || raw.direct_offer || raw.flow || raw.campaign_flow)
  const directIsVoteDiscount = directFlowType.includes('vote discount') || directFlowType.includes('votacao livro')
  const source = nestedSource || (directIsVoteDiscount ? raw : null)
  const flowType = normalizeText(source?.type || raw.flow_type || raw.direct_offer || raw.flow || raw.campaign_flow)
  const isVoteDiscount = flowType.includes('vote discount') || flowType.includes('votacao livro')
  if (!source && !isVoteDiscount) return null
  if (source?.enabled === false) return null
  if (!isVoteDiscount && normalizeText(source?.type) !== 'vote discount') return null

  const voteUrl = extractFirstHttpUrl(firstString(source?.vote_url, raw.vote_url))
  const discountUrl = extractFirstHttpUrl(firstString(source?.discount_url, raw.discount_url))
  if (!voteUrl || !discountUrl) return null

  const defaultDiscountMessage = [
    'Obrigado por apoiar a votacao.',
    '',
    'Como agradecimento, liberei 30% de desconto para voce garantir o livro Corretor Nota 8.',
    '',
    'Clique no botao abaixo e aproveite essa condicao especial.',
  ].join('\n')

  return {
    type: 'vote_discount',
    voteUrl,
    discountUrl,
    voteMessage: cleanString(source?.vote_message, 1200)
      || 'Perfeito. Clique no botao abaixo para abrir a votacao. Depois volte aqui quando terminar.',
    alreadyVotedMessage: cleanString(source?.already_voted_message, 1200)
      || cleanString(source?.followup_message, 1200)
      || defaultDiscountMessage,
    followupMessage: cleanString(source?.followup_message, 1200)
      || cleanString(source?.already_voted_message, 1200)
      || defaultDiscountMessage,
    willVoteLabel: cleanButtonTitle(source?.will_vote_label, 'Vou votar'),
    alreadyVotedLabel: cleanButtonTitle(source?.already_voted_label, 'Ja votei'),
    voteButtonTitle: cleanButtonTitle(source?.vote_button_title, 'Votar agora'),
    alreadyVotedButtonTitle: cleanButtonTitle(source?.already_voted_button_title, 'Comprar livro'),
    followupButtonTitle: cleanButtonTitle(source?.followup_button_title, 'Comprar livro'),
    followupDelayMinutes: clampNumber(source?.followup_delay_minutes, 3, 0, 1440),
  }
}

function getCampaignCommentDmFlow(campaign: CampaignRow) {
  return getCommentDmFlowFromRaw(campaign.raw)
}

function getDeliveryCommentDmFlow(delivery: DeliveryRow) {
  const raw = (delivery.raw || {}) as Record<string, any>
  return getCommentDmFlowFromRaw(raw.comment_dm_flow || raw.campaign_snapshot?.comment_dm_flow || raw)
}

function serializeCommentDmFlow(flow: CommentDmFlow) {
  return {
    type: flow.type,
    enabled: true,
    vote_url: flow.voteUrl,
    discount_url: flow.discountUrl,
    vote_message: flow.voteMessage,
    will_vote_label: flow.willVoteLabel,
    followup_message: flow.followupMessage,
    vote_button_title: flow.voteButtonTitle,
    already_voted_label: flow.alreadyVotedLabel,
    already_voted_message: flow.alreadyVotedMessage,
    followup_button_title: flow.followupButtonTitle,
    followup_delay_minutes: flow.followupDelayMinutes,
    already_voted_button_title: flow.alreadyVotedButtonTitle,
  }
}

function buildCommentDmFlowPayload(campaignId: string, action: 'already_voted' | 'will_vote') {
  return `comment_dm_flow:${cleanString(campaignId, 80)}:${action}`
}

function buildCommentDmFlowQuickReplies(campaignId: string, flow: CommentDmFlow): MetaQuickReply[] {
  return [
    {
      content_type: 'text',
      title: flow.alreadyVotedLabel,
      payload: buildCommentDmFlowPayload(campaignId, 'already_voted'),
    },
    {
      content_type: 'text',
      title: flow.willVoteLabel,
      payload: buildCommentDmFlowPayload(campaignId, 'will_vote'),
    },
  ]
}

function buildCommentDmFlowUrlButtons(flow: CommentDmFlow): MetaUrlButton[] {
  return [
    {
      type: 'web_url',
      title: flow.alreadyVotedLabel,
      url: flow.discountUrl,
    },
    {
      type: 'web_url',
      title: flow.willVoteLabel,
      url: flow.voteUrl,
    },
  ]
}

function textFallbackForQuickReplies(message: string, quickReplies: MetaQuickReply[]) {
  const options = quickReplies
    .map(reply => cleanString(reply.title, 40))
    .filter(Boolean)
    .join(' ou ')
  if (!options) return message
  return cleanString(`${cleanString(message, 1600)}\n\nResponda aqui com: ${options}.`, 1800)
}

function textFallbackForUrlButtons(message: string, buttons: MetaUrlButton[]) {
  const links = buttons
    .map(button => {
      const title = cleanButtonTitle(button.title, '')
      const url = extractFirstHttpUrl(button.url)
      return title && url ? `${title}: ${url}` : ''
    })
    .filter(Boolean)
    .join('\n')
  if (!links || extractFirstHttpUrl(message)) return message
  return cleanString(`${cleanString(message, 1500)}\n\n${links}`, 1800)
}

function buttonTitleForUrl(url: string, overrideTitle?: string) {
  const override = cleanButtonTitle(overrideTitle, '')
  if (override) return override
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

function buildMetaMessageSendPlans(message: string, buttonUrl?: string, options: {
  quickReplies?: MetaQuickReply[]
  buttons?: MetaUrlButton[]
  buttonTitle?: string
} = {}): MetaMessageSendPlan[] {
  const urlFromButtonField = extractFirstHttpUrl(cleanString(buttonUrl, 1600))
  const urlFromMessage = extractFirstHttpUrl(message)
  const url = urlFromButtonField || urlFromMessage
  const buttons = (options.buttons || [])
    .map(button => ({
      type: 'web_url' as const,
      title: cleanButtonTitle(button.title, ''),
      url: extractFirstHttpUrl(button.url),
    }))
    .filter(button => button.title && button.url)
    .slice(0, 3)
  const quickReplies = (options.quickReplies || [])
    .map(reply => ({
      content_type: 'text' as const,
      title: cleanButtonTitle(reply.title, ''),
      payload: cleanString(reply.payload, 1000),
    }))
    .filter(reply => reply.title && reply.payload)
    .slice(0, 13)
  const fallback: MetaMessageSendPlan = {
    kind: 'text',
    message: {
      text: buttons.length
        ? textFallbackForUrlButtons(message, buttons)
        : quickReplies.length
        ? textFallbackForQuickReplies(message, quickReplies)
        : textFallbackForButtonUrl(message, urlFromButtonField),
    },
  }

  if (process.env.META_COMMENT_DM_LINK_BUTTONS_ENABLED === 'false') return [fallback]

  if (buttons.length > 0) {
    const buttonText = cleanString(message, 640)
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
              buttons,
            },
          },
        },
      },
      fallback,
    ]
  }

  if (quickReplies.length > 0) {
    return [
      {
        kind: 'quick_replies',
        message: {
          text: cleanString(message, 1800),
          quick_replies: quickReplies,
        },
      },
      fallback,
    ]
  }

  if (!url) return [fallback]

  const buttonText = cleanString(textWithoutUrlForButton(message, url), 640)
  const title = cleanString(buttonTitleForUrl(url, options.buttonTitle), 20)
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
    AI_TOKEN_AUTOMATION_PAUSE_KEY,
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
    aiTokenPauseActive: raw[AI_TOKEN_AUTOMATION_PAUSE_KEY] === 'true',
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
  buttonTitle?: string
  quickReplies?: MetaQuickReply[]
  buttons?: MetaUrlButton[]
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
  const sendPlans = buildMetaMessageSendPlans(message, params.buttonUrl, {
    buttonTitle: params.buttonTitle,
    quickReplies: params.quickReplies,
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
  buttonTitle?: string
  quickReplies?: MetaQuickReply[]
  buttons?: MetaUrlButton[]
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
  const sendPlans = buildMetaMessageSendPlans(reply, params.buttonUrl, {
    buttonTitle: params.buttonTitle,
    quickReplies: params.quickReplies,
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
  buttonTitle?: string
  quickReplies?: MetaQuickReply[]
  buttons?: MetaUrlButton[]
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
  const sendPlans = buildMetaMessageSendPlans(reply, params.buttonUrl, {
    buttonTitle: params.buttonTitle,
    quickReplies: params.quickReplies,
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
  buttonTitle?: string
  quickReplies?: MetaQuickReply[]
  buttons?: MetaUrlButton[]
  supabase: SupabaseAdmin
}) {
  if (params.delivery.platform === 'facebook') {
    return sendFacebookPrivateReply({
      commentExternalId: params.delivery.comment_external_id,
      message: params.message,
      buttonUrl: params.buttonUrl,
      buttonTitle: params.buttonTitle,
      quickReplies: params.quickReplies,
      buttons: params.buttons,
      supabase: params.supabase,
    })
  }

  return sendInstagramPrivateReply({
    commentExternalId: params.delivery.comment_external_id,
    message: params.message,
    buttonUrl: params.buttonUrl,
    buttonTitle: params.buttonTitle,
    quickReplies: params.quickReplies,
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
  const requiresVoteProof = campaignRequiresVoteProof(campaign)
  const campaignRaw = (campaign.raw || {}) as Record<string, unknown>
  const commentDmFlow = getCampaignCommentDmFlow(campaign)
  const commentDmFlowRaw = commentDmFlow ? serializeCommentDmFlow(commentDmFlow) : null
  const directOffer = cleanString(
    campaignRaw.direct_offer || campaignRaw.flow || (requiresVoteProof ? 'vote_proof_gate' : 'profile_assessment_direct_access'),
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
        direct_offer: directOffer,
        requires_vote_proof: requiresVoteProof,
        comment_dm_flow: commentDmFlowRaw,
        campaign_snapshot: {
          id: campaign.id,
          name: campaign.name,
          trigger_intent: campaign.trigger_intent,
          confidence_threshold: campaign.confidence_threshold,
          mode: campaign.mode,
          button_url: buttonUrl || null,
          direct_offer: directOffer,
          requires_vote_proof: requiresVoteProof,
          comment_dm_flow: commentDmFlowRaw,
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
  const reply = cleanString(replyOverride || delivery.reply_message, 1800)
  const buttonUrl = getDeliveryButtonUrl(delivery)
  const commentDmFlow = getDeliveryCommentDmFlow(delivery)
  const buttons = commentDmFlow ? buildCommentDmFlowUrlButtons(commentDmFlow) : undefined
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

    try {
      const publicReply = await sendPublicCommentReplyForDelivery({
        delivery: sentDelivery,
        message: publicReplyMessage,
        supabase,
      })
      return await updateDeliveryPublicCommentReplyRawSafe(supabase, sentDelivery, {
        success: true,
        message: publicReplyMessage,
        external_id: publicReply.external_id || null,
        channel: publicReply.channel || null,
        raw: publicReply.raw || publicReply,
        sent_at: nowIso(),
      })
    } catch (publicReplyError) {
      const publicReplyErrorMessage = publicReplyError instanceof Error ? publicReplyError.message : String(publicReplyError)
      return await updateDeliveryPublicCommentReplyRawSafe(supabase, sentDelivery, {
        success: false,
        message: publicReplyMessage,
        error: publicReplyErrorMessage.slice(0, 900),
        attempted_at: nowIso(),
      })
    }
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
        },
      })
    }
    return await updateDeliveryError(supabase, delivery, message)
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
  if (configs.aiTokenPauseActive) {
    return { success: true, processed: false, reason: 'ai_token_automation_paused' }
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
  if (configs.aiTokenPauseActive) return { success: true, skipped: true, reason: 'ai_token_automation_paused' }
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

export async function saveCommentDmCampaign(input: Record<string, unknown>) {
  const supabase = createAdminClient()
  const id = cleanString(input.id, 80)
  const name = cleanString(input.name, 120)
  const triggerIntent = cleanString(input.trigger_intent, 600)
  const replyMessage = cleanString(input.reply_message, 1800)
  const buttonUrlInput = cleanString(input.button_url, 1600)
  const buttonUrl = extractFirstHttpUrl(buttonUrlInput)

  if (!name) throw new Error('Informe o nome da campanha.')
  if (!triggerIntent) throw new Error('Informe a intencao esperada da campanha.')
  if (!replyMessage) throw new Error('Informe a mensagem de Direct.')
  if (buttonUrlInput && !buttonUrl) throw new Error('Informe um link valido para o botao ou deixe o campo vazio.')

  let existingRaw: Record<string, unknown> = {}
  if (id) {
    const { data: existing, error: existingError } = await supabase
      .from('meta_comment_dm_campaigns')
      .select('raw')
      .eq('id', id)
      .maybeSingle()
    if (existingError) throw new Error(existingError.message)
    existingRaw = existing?.raw && typeof existing.raw === 'object'
      ? existing.raw as Record<string, unknown>
      : {}
  }

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
      ...existingRaw,
      created_from: 'admin_social_inbox',
      button_url: buttonUrl || null,
      direct_offer: cleanString(existingRaw.direct_offer || existingRaw.flow || existingRaw.campaign_flow, 120)
        || 'profile_assessment_direct_access',
      requires_vote_proof: typeof existingRaw.requires_vote_proof === 'boolean'
        ? existingRaw.requires_vote_proof
        : false,
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
}, options: {
  source?: string
  metadata?: Record<string, unknown>
} = {}) {
  const now = nowIso()
  const source = cleanString(options.source, 120) || 'instagram_vote_proof_automation'
  await supabase
    .from('meta_social_messages')
    .upsert({
      thread_id: event.thread_id,
      platform: 'instagram',
      external_id: result.external_id || `outbound_${source}_${event.external_id}_${Date.now()}`,
      sender_id: event.recipient_id,
      recipient_id: event.sender_id,
      direction: 'outbound',
      message,
      sent_at: now,
      raw: {
        channel: result.channel || null,
        source,
        ...(options.metadata || {}),
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

async function updateDeliveryCommentDmFlowRaw(supabase: SupabaseAdmin, delivery: DeliveryRow, payload: Record<string, unknown>) {
  const raw = (delivery.raw || {}) as Record<string, any>
  const history = Array.isArray(raw.comment_dm_flow_history) ? raw.comment_dm_flow_history : []
  await supabase
    .from('meta_comment_dm_deliveries')
    .update({
      raw: {
        ...raw,
        comment_dm_flow_last: payload,
        comment_dm_flow_history: [...history.slice(-9), payload],
      },
      updated_at: nowIso(),
    })
    .eq('id', delivery.id)
}

function getInstagramQuickReplyPayload(event: WebhookMessageEvent) {
  const raw = (event.raw || {}) as Record<string, any>
  return cleanString(
    raw?.messaging?.message?.quick_reply?.payload
    || raw?.message?.quick_reply?.payload
    || raw?.quick_reply?.payload,
    1000,
  )
}

function getCommentDmFlowCampaignIdFromPayload(payload: string) {
  const match = payload.match(/^comment_dm_flow:([^:]+):(already_voted|will_vote)$/)
  return match?.[1] || ''
}

function detectCommentDmFlowAction(event: WebhookMessageEvent): {
  action: 'already_voted' | 'will_vote'
  campaignId?: string
  source: 'quick_reply' | 'text'
} | null {
  const payload = getInstagramQuickReplyPayload(event)
  const normalizedPayload = normalizeText(payload)
  if (normalizedPayload.includes('comment dm flow') && normalizedPayload.includes('already voted')) {
    return { action: 'already_voted', campaignId: getCommentDmFlowCampaignIdFromPayload(payload), source: 'quick_reply' }
  }
  if (normalizedPayload.includes('comment dm flow') && normalizedPayload.includes('will vote')) {
    return { action: 'will_vote', campaignId: getCommentDmFlowCampaignIdFromPayload(payload), source: 'quick_reply' }
  }

  const normalizedText = normalizeText(event.text)
  if (!normalizedText) return null
  if (
    normalizedText.includes('vou votar')
    || normalizedText.includes('quero votar')
    || normalizedText.includes('votar agora')
    || normalizedText.includes('ainda nao votei')
    || normalizedText.includes('nao votei')
  ) {
    return { action: 'will_vote', source: 'text' }
  }
  if (
    normalizedText.includes('ja votei')
    || normalizedText === 'votei'
    || normalizedText.includes('eu votei')
    || normalizedText.includes('voto feito')
  ) {
    return { action: 'already_voted', source: 'text' }
  }

  return null
}

async function loadCommentDmFlowForCampaign(supabase: SupabaseAdmin, campaignId: string) {
  const selected = cleanString(campaignId, 80)
  if (!selected) return null
  const { data, error } = await supabase
    .from('meta_comment_dm_campaigns')
    .select('raw')
    .eq('id', selected)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return getCommentDmFlowFromRaw(data?.raw)
}

async function findRecentCommentDmFlowDelivery(supabase: SupabaseAdmin, senderId: string, campaignId?: string) {
  const safeSenderId = cleanString(senderId, 160)
  if (!safeSenderId) return null

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  let query = supabase
    .from('meta_comment_dm_deliveries')
    .select('id, campaign_id, comment_id, platform, comment_external_id, media_external_id, author_id, author_name, comment_text, ai_matches, ai_confidence, ai_reason, normalized_intent, reply_message, decision, send_status, private_reply_external_id, private_reply_channel, error, processed_at, sent_at, raw, created_at, updated_at')
    .eq('platform', 'instagram')
    .eq('send_status', 'sent')
    .gte('sent_at', since)
    .order('sent_at', { ascending: false, nullsFirst: false })
    .limit(200)

  if (campaignId) query = query.eq('campaign_id', campaignId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  for (const delivery of ((data || []) as DeliveryRow[])) {
    const recipientId = extractPrivateReplyRecipientId(delivery)
    if (delivery.author_id !== safeSenderId && recipientId !== safeSenderId) continue

    const deliveryFlow = getDeliveryCommentDmFlow(delivery)
    if (deliveryFlow) return { delivery, flow: deliveryFlow }

    const campaignFlow = await loadCommentDmFlowForCampaign(supabase, delivery.campaign_id)
    if (campaignFlow) return { delivery, flow: campaignFlow }
  }

  return null
}

export async function processInstagramDirectCommentDmFlow(event: WebhookMessageEvent) {
  if (event.platform !== 'instagram') return { success: true, processed: false, reason: 'not_instagram' }
  if (event.duplicate) return { success: true, processed: false, reason: 'duplicate_message' }

  const choice = detectCommentDmFlowAction(event)
  if (!choice) return { success: true, processed: false, reason: 'not_comment_dm_flow_reply' }

  const supabase = createAdminClient()
  const found = await findRecentCommentDmFlowDelivery(supabase, event.sender_id, choice.campaignId)
  if (!found) return { success: true, processed: false, reason: 'no_recent_comment_dm_flow_delivery' }

  const { delivery, flow } = found
  const isAlreadyVoted = choice.action === 'already_voted'
  const responseMessage = cleanString(repairKnownPortugueseArtifacts(
    isAlreadyVoted ? flow.alreadyVotedMessage : flow.voteMessage
  ), 1800)
  const buttonUrl = isAlreadyVoted ? flow.discountUrl : flow.voteUrl
  const buttonTitle = isAlreadyVoted ? flow.alreadyVotedButtonTitle : flow.voteButtonTitle

  const sent = await sendInstagramDirectMessageToRecipient({
    recipientId: event.sender_id,
    message: responseMessage,
    buttonUrl,
    buttonTitle,
    supabase,
  })

  const flowPayload = {
    inbound_message_id: event.external_id,
    inbound_text: event.text,
    quick_reply_payload: getInstagramQuickReplyPayload(event) || null,
    choice: choice.action,
    source: choice.source,
    response_message: responseMessage,
    button_url: buttonUrl,
    button_title: buttonTitle,
    outbound_message_id: sent.external_id || null,
    outbound_channel: sent.channel || null,
    processed_at: nowIso(),
  }

  await Promise.all([
    recordInstagramDirectOutbound(supabase, event, responseMessage, sent, {
      source: isAlreadyVoted ? 'instagram_comment_dm_flow_already_voted' : 'instagram_comment_dm_flow_will_vote',
      metadata: {
        comment_dm_campaign_id: delivery.campaign_id,
        comment_dm_delivery_id: delivery.id,
        choice: choice.action,
        button_url: buttonUrl,
      },
    }),
    updateDeliveryCommentDmFlowRaw(supabase, delivery, flowPayload),
  ])

  return {
    success: true,
    processed: true,
    action: choice.action,
    delivery_id: delivery.id,
    outbound_message_id: sent.external_id || null,
    sent: true,
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

      const platform = defaultPlatform || normalizePlatform(messaging?.platform) || 'instagram'
      if (platform !== 'instagram') continue

      const senderId = firstString(messaging?.sender?.id, messaging?.from?.id)
      const recipientId = firstString(messaging?.recipient?.id, messaging?.to?.id, entry?.id)
      const externalId = firstString(message?.mid, message?.id)
      if (!senderId || !recipientId || !externalId) continue

      const attachment = resolveAttachment(message)
      events.push({
        platform,
        thread_external_id: `ig_dm_${recipientId}_${senderId}`,
        external_id: externalId,
        sender_id: senderId,
        recipient_id: recipientId,
        text: nullableString(message?.text, 4000),
        attachment_type: attachment.type,
        attachment_url: attachment.url,
        sent_at: toIsoTimestamp(messaging?.timestamp || entry?.time),
        raw: {
          object: payload?.object || null,
          entry_id: entry?.id || null,
          entry_time: entry?.time || null,
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
  return configs.enabled && !configs.aiTokenPauseActive && configs.webhookAutoprocess
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
