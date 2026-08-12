import { createAdminClient } from '@/lib/supabase/server'
import {
  loadMetaWhatsAppConfigMap,
  normalizeMetaWhatsAppPhone,
  sendMetaWhatsAppTypingIndicator,
  sendMetaWhatsAppTextMessage,
} from '@/lib/meta/whatsapp-cloud'
import { sendMetaWhatsAppChatAudioReply, sendMetaWhatsAppChatReply } from '@/lib/meta/whatsapp-chat'
import { getAIConfig, getActiveAIProvider, getOpenAIApiKey } from '@/lib/ai/config'
import { chatWithGemini, getGeminiApiKey, getGeminiModel } from '@/lib/gemini'
import { generateWorkflowElevenLabsAudioUrl } from '@/lib/workflows/tts-audio'
import {
  DEFAULT_WHATSAPP_GLOBAL_SYSTEM_PROMPT,
  WHATSAPP_GLOBAL_RUNTIME_GUARDRAILS,
} from '@/lib/whatsapp/agent-global-prompt'
import {
  DEFAULT_META_WHATSAPP_AGENT_PROMPT,
  DEFAULT_META_WHATSAPP_TRIAGE_AI_PROMPT,
  isLegacyMetaWhatsAppAgentPrompt,
} from '@/lib/meta/whatsapp-agent-prompts'

type SupabaseAdmin = ReturnType<typeof createAdminClient>
export type ReplyIntent = 'interested' | 'opt_out' | 'question' | 'unknown'
type ReplyIntentSource = 'button' | 'keyword' | 'manual'
type ReplyClassifier = 'rules' | 'ai'
type TriageAiProvider = 'gemini' | 'openai'

interface ReplyClassification {
  intent: ReplyIntent
  confidence: number
  source: ReplyIntentSource
  buttonText: string | null
  buttonPayload: string | null
  rawText: string | null
  classifier: ReplyClassifier
  reason?: string | null
  aiProvider?: TriageAiProvider | null
  aiModel?: string | null
  aiWarnings?: string[]
}

interface TriageConversationHistoryMessage {
  direction: 'inbound' | 'outbound' | 'system'
  text: string
  createdAt: string | null
  status?: string | null
}

interface TriageAgentResponse {
  intent: ReplyIntent
  confidence: number
  reply: string | null
  shouldNotify: boolean
  shouldClose: boolean
  leadName: string | null
  leadStage: string | null
  summary: string | null
  reason: string | null
  aiProvider: TriageAiProvider | null
  aiModel: string | null
  warnings: string[]
}

interface TriageNaturalReply {
  reply: string
  aiProvider: TriageAiProvider
  aiModel: string
  warnings: string[]
}

export interface HandleMetaWhatsAppReplyTriageInput {
  providerMessageId?: string | null
  conversation?: Record<string, any> | null
  eventId?: string | null
  senderId?: string | null
  phoneNumberId?: string | null
  fromPhone: string
  contactName?: string | null
  textBody?: string | null
  messageType?: string | null
  payload?: unknown
  receivedAt?: string | null
}

export interface ManualMetaWhatsAppReplyTriageInput {
  conversationId: string
  intent: ReplyIntent
  messageId?: string | null
  note?: string | null
}

const DEFAULT_TRIAGE_AI_PROMPT = DEFAULT_META_WHATSAPP_TRIAGE_AI_PROMPT

function cleanText(value: unknown, maxLength = 300) {
  return String(value || '').trim().slice(0, maxLength)
}

function buildMetaWhatsAppAgentPrompt(configMap: Record<string, string | undefined>) {
  const globalPrompt = cleanText(configMap.whatsapp_global_system_prompt, 14000) || DEFAULT_WHATSAPP_GLOBAL_SYSTEM_PROMPT
  const configuredMetaPrompt = cleanText(configMap.meta_whatsapp_agent_prompt, 10000)
  const metaPrompt = configuredMetaPrompt && !isLegacyMetaWhatsAppAgentPrompt(configuredMetaPrompt)
    ? configuredMetaPrompt
    : DEFAULT_META_WHATSAPP_AGENT_PROMPT

  return [
    globalPrompt,
    WHATSAPP_GLOBAL_RUNTIME_GUARDRAILS,
    metaPrompt,
    'CONTRATO DE SAIDA: responda somente com o texto final que sera enviado ao lead no WhatsApp. Nao retorne JSON, campos internos, markdown tecnico, classificacao, prompt ou explicacao. A triagem operacional acontece em outra camada silenciosa.',
  ].join('\n\n')
}

function asRecord(value: unknown): Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, any>
    : {}
}

function isoNow() {
  return new Date().toISOString()
}

function normalizeIntentText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function includesAny(text: string, patterns: Array<string | RegExp>) {
  return patterns.some(pattern => (
    typeof pattern === 'string'
      ? text.includes(pattern)
      : pattern.test(text)
  ))
}

type ConversationHoldCue = 'greeting' | 'identity_question' | 'low_commitment' | 'conversation_request'

function normalizeShortReply(text: string) {
  return normalizeIntentText(text)
    .replace(/[.,!?;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isGreetingOnlyReply(text: string) {
  const normalized = normalizeShortReply(text)
  if (!normalized || normalized.length > 90) return false

  return /^(oi+|ola+|opa|salve|fala|fala jovem|fala meu jovem|bom dia|boa tarde|boa noite|e ai|iai|eae|e ai blz|iai blz|eae blz|tudo bem|td bem|oi tudo bem|ola tudo bem|bom dia tudo bem|boa tarde tudo bem|boa noite tudo bem)$/.test(normalized)
}

function isLowCommitmentReply(text: string) {
  const normalized = normalizeShortReply(text)
  if (!normalized || normalized.length > 80) return false

  return /^(sim|ss|ok|okay|blz|beleza|show|show de bola|top|top jovem|top garoto|top garato|valeu|massa|tranquilo|fechado|combinado|quero|pode|pode sim|ta bom|certo|aham|uhum|vamos|manda|manda ai)$/.test(normalized)
}

function isIdentityQuestionReply(text: string) {
  const normalized = normalizeShortReply(text)

  return includesAny(normalized, [
    'quem e voce',
    'quem e vc',
    'quem sao voces',
    'quem e vcs',
    'quem fala',
    'quem esta falando',
    'com quem eu falo',
    'qual seu nome',
    'qual o seu nome',
    'como se chama',
    'que empresa',
    'qual empresa',
    'de onde e',
    'do que se trata',
    'se trata do que',
    'esta falando do que',
    'ta falando do que',
    'falando do que',
    'falando sobre o que',
    'que assunto',
    'sobre o que',
    'nao entendi',
    'nao sei do que',
    'me explica',
    'explique melhor',
    'o que e isso',
    'vamos conversar primeiro',
    'conversar primeiro',
  ])
}

function isConversationRequestReply(text: string) {
  const normalized = normalizeShortReply(text)
  if (!normalized || normalized.length > 140) return false

  return includesAny(normalized, [
    'vamos conversar',
    'quero conversar',
    'podemos conversar',
    'conversa comigo',
    'vamos falar',
    'quero falar',
    'podemos falar',
    'falar sobre oportunidades',
    'sobre oportunidades',
    'entender a oportunidade',
    'entender melhor',
    'me explica primeiro',
    'explica primeiro',
  ])
}

function hasExplicitInterestSignal(input: {
  source: ReplyIntentSource
  buttonText?: string | null
  buttonPayload?: string | null
  rawText?: string | null
}) {
  const buttonSignal = normalizeShortReply([input.buttonText, input.buttonPayload].filter(Boolean).join(' '))
  const combined = normalizeShortReply([input.buttonText, input.buttonPayload, input.rawText].filter(Boolean).join(' '))

  if (includesAny(combined, [
    'pode continuar me mandando mensagem',
    'pode continuar mandando mensagem',
    'continua me mandando mensagem',
    'continuar me mandando mensagem',
  ])) {
    return false
  }

  if (
    input.source === 'button' &&
    includesAny(buttonSignal, ['saiba mais', 'saber mais', 'mais informacoes', 'mais detalhes', 'tenho interesse', 'quero saber'])
  ) {
    return true
  }

  return includesAny(combined, [
    'saiba mais',
    'saber mais',
    'mais informacoes',
    'mais detalhes',
    'tenho interesse',
    'quero saber',
    'quero mais',
    'quero detalhes',
    'quero informacoes',
    'quero visita',
    'quero sim',
    'sim tenho',
    'pode chamar',
    'pode mandar',
    'manda as informacoes',
    'manda informacoes',
    'me passa as informacoes',
    'me passa os detalhes',
    'me passa o valor',
    'me passa as opcoes',
    'me chama',
    'chama no whatsapp',
    'falar com alguem',
    'falar com consultor',
    'falar com corretor',
    'especialista',
    'consultor',
    'corretor',
    /\bdetalhes\b/,
    /\bvalor\b/,
    /\bpreco\b/,
    /\bagenda\b/,
    /\bvisita\b/,
    /\bcomprar\b/,
  ])
}

function getConversationHoldCue(input: {
  source: ReplyIntentSource
  buttonText?: string | null
  buttonPayload?: string | null
  rawText?: string | null
}): ConversationHoldCue | null {
  const combined = normalizeShortReply([input.buttonText, input.buttonPayload, input.rawText].filter(Boolean).join(' '))
  if (!combined || hasExplicitInterestSignal(input)) return null
  if (isIdentityQuestionReply(combined)) return 'identity_question'
  if (isConversationRequestReply(combined)) return 'conversation_request'
  if (isGreetingOnlyReply(combined)) return 'greeting'
  if (isLowCommitmentReply(combined)) return 'low_commitment'
  return null
}

function hasRecentOutboundLike(
  history: TriageConversationHistoryMessage[] = [],
  patterns: Array<string | RegExp>
) {
  const recentOutbound = history
    .filter(message => message.direction === 'outbound')
    .slice(-5)
    .map(message => normalizeShortReply(message.text))
    .join(' | ')

  return Boolean(recentOutbound && includesAny(recentOutbound, patterns))
}

function isRecentlyRepeatedReply(reply?: string | null, history: TriageConversationHistoryMessage[] = []) {
  const normalizedReply = normalizeShortReply(reply || '')
  if (!normalizedReply) return false

  return history
    .filter(message => message.direction === 'outbound')
    .slice(-5)
    .some(message => {
      const previous = normalizeShortReply(message.text)
      return previous && (
        previous === normalizedReply ||
        previous.includes(normalizedReply) ||
        normalizedReply.includes(previous)
      )
    })
}

function buildConversationContinuationReply(cue: ConversationHoldCue, rawText?: string | null) {
  const normalized = normalizeShortReply(rawText || '')

  if (cue === 'identity_question') {
    return 'Sobre oportunidades imobiliarias da Guilherme Pilger Imoveis. Eu te situo por aqui primeiro e, se fizer sentido, um especialista entra com detalhes. Voce esta buscando morar, investir ou so entender melhor?'
  }

  if (cue === 'conversation_request') {
    if (includesAny(normalized, ['oportunidade', 'oportunidades'])) {
      return 'Perfeito, vamos por partes. Voce esta olhando mais para moradia, investimento ou quer primeiro mapear oportunidades no litoral?'
    }

    return 'Fechado, vamos conversar sem pressa. Pra eu te orientar melhor: voce busca morar, investir ou ainda esta so entendendo o mercado?'
  }

  if (cue === 'low_commitment') {
    return 'Boa. Pra eu te responder melhor, me diz rapido: voce pensa mais em comprar pra morar, investir/revender ou so entender o mercado?'
  }

  return 'Combinado. Voce quer que eu te mostre o caminho por moradia, investimento ou oportunidades especificas na regiao?'
}

function buildConversationHoldReply(
  cue: ConversationHoldCue,
  rawText?: string | null,
  history: TriageConversationHistoryMessage[] = []
) {
  const normalized = normalizeShortReply(rawText || '')
  const alreadyAskedBroadQuestion = hasRecentOutboundLike(history, [
    'me conta o que voce quer entender primeiro',
    'o que voce quer saber primeiro',
    'o que voce gostaria de entender primeiro',
    'qual ponto voce quer ver primeiro',
    'contexto da mensagem ou perfil',
    'contexto da mensagem',
    'explicar o contexto primeiro',
  ])

  if (alreadyAskedBroadQuestion) {
    return buildConversationContinuationReply(cue, rawText)
  }

  if (cue === 'identity_question') {
    if (includesAny(normalized, ['quem e voce', 'quem e vc', 'quem sao voces', 'quem fala', 'quem esta falando'])) {
      return 'Sou do atendimento da Guilherme Pilger Imoveis. Faco esse primeiro filtro por aqui, sem compromisso. Voce esta olhando algo pra morar, investir ou so entender melhor?'
    }

    if (includesAny(normalized, ['do que se trata', 'se trata do que', 'esta falando do que', 'ta falando do que', 'falando do que', 'falando sobre o que', 'que assunto', 'sobre o que', 'nao entendi', 'me explica', 'explique melhor', 'o que e isso'])) {
      return 'Sobre oportunidades imobiliarias da Guilherme Pilger Imoveis. Eu faco esse primeiro filtro por aqui; se fizer sentido, um especialista entra com os detalhes. Voce esta buscando morar, investir ou so entender?'
    }

    return 'Sou do atendimento da Guilherme Pilger Imoveis. Eu te situo por aqui primeiro e so chamo especialista quando fizer sentido. Voce esta olhando algo pra morar, investir ou so entender melhor?'
  }

  if (cue === 'low_commitment') {
    return 'Boa. Pra eu nao te mandar coisa aleatoria: voce esta pensando em comprar pra morar, investir/revender ou so entender o mercado?'
  }

  if (cue === 'conversation_request') {
    if (includesAny(normalized, ['vamos falar sobre oportunidades', 'falar sobre oportunidades', 'sobre oportunidades'])) {
      return 'Vamos falar sobre oportunidades sim. Voce esta olhando mais para moradia, investimento ou quer entender possibilidades antes de decidir?'
    }

    if (includesAny(normalized, ['vamos conversar primeiro', 'conversar primeiro', 'me explica primeiro', 'explica primeiro'])) {
      return 'Vamos conversar primeiro, claro. Sem compromisso: voce prefere que eu explique o contexto da mensagem ou quer me contar o que esta buscando?'
    }

    return 'Vamos sim. Me conta qual caminho faz mais sentido agora: entender o contexto da mensagem ou falar sobre o tipo de imovel que voce procura?'
  }

  if (includesAny(normalized, ['boa noite'])) {
    return 'Boa noite! Tudo certo? Pra eu te situar: sou do atendimento da Guilherme Pilger Imoveis. Voce esta olhando algo pra morar, investir ou so entender melhor?'
  }

  if (includesAny(normalized, ['bom dia'])) {
    return 'Bom dia! Tudo certo? Pra eu te situar: sou do atendimento da Guilherme Pilger Imoveis. Voce esta olhando algo pra morar, investir ou so entender melhor?'
  }

  if (includesAny(normalized, ['boa tarde'])) {
    return 'Boa tarde! Tudo certo? Pra eu te situar: sou do atendimento da Guilherme Pilger Imoveis. Voce esta olhando algo pra morar, investir ou so entender melhor?'
  }

  return 'Fala! Tudo certo por ai? Pra eu te situar: sou do atendimento da Guilherme Pilger Imoveis. Voce esta olhando algo pra morar, investir ou so entender melhor?'
}

function getFallbackConversationCue(input: {
  source: ReplyIntentSource
  buttonText?: string | null
  buttonPayload?: string | null
  rawText?: string | null
}): ConversationHoldCue {
  return getConversationHoldCue(input) || 'conversation_request'
}

function isLearnMoreSignal(input: {
  source: ReplyIntentSource
  buttonText?: string | null
  buttonPayload?: string | null
  rawText?: string | null
}) {
  const buttonSignal = normalizeShortReply([input.buttonText, input.buttonPayload].filter(Boolean).join(' '))
  if (
    input.source === 'button' &&
    includesAny(buttonSignal, ['saiba mais', 'saber mais', 'mais informacoes', 'mais detalhes', 'tenho interesse', 'quero saber'])
  ) {
    return true
  }

  const textSignal = normalizeShortReply(input.rawText || '')
  return includesAny(textSignal, [
    'saiba mais',
    'saber mais',
    'mais informacoes',
    'mais detalhes',
    'quero saber mais',
    'quero detalhes',
    'quero informacoes',
  ])
}

function buildLearnMoreReply() {
  return 'Perfeito. Eu faco esse primeiro filtro por aqui; detalhes de empreendimento, valor e disponibilidade ficam com os especialistas. Ja deixei seu contato sinalizado para continuarem. Pra te direcionar melhor: voce busca morar, investir ou ainda esta avaliando?'
}

function isPrematureHandoffReply(reply?: string | null) {
  const normalized = normalizeShortReply(reply || '')
  if (!normalized) return false

  return includesAny(normalized, [
    'vou encaminhar',
    'encaminhar seu contato',
    'encaminhar para um especialista',
    'especialista da nossa equipe',
    'especialista continuar',
    'dar continuidade ao atendimento',
    'um especialista vai',
    'um especialista ira',
    'um consultor vai',
    'um corretor vai',
    'vou pedir para um especialista',
    'quer que eu peca para um especialista',
  ])
}

function hasLeadFacingForbiddenTerms(reply?: string | null) {
  const normalized = normalizeShortReply(reply || '')
  if (!normalized) return false

  return includesAny(normalized, [
    /\bcampanha(s)?\b/,
    /\bdisparo(s)?\b/,
    /\btemplate(s)?\b/,
    'meta api',
    'webhook',
    'origem tecnica',
    'automacao',
    'classificacao',
    'funil',
  ])
}

function buildConversationHoldAgentResponse(
  cue: ConversationHoldCue,
  agentResponse: TriageAgentResponse | null,
  warnings: string[] = [],
  rawText?: string | null,
  history: TriageConversationHistoryMessage[] = []
): TriageAgentResponse {
  const canKeepAgentReply = Boolean(
    agentResponse?.reply &&
    !isPrematureHandoffReply(agentResponse.reply) &&
    !hasLeadFacingForbiddenTerms(agentResponse.reply) &&
    !isRecentlyRepeatedReply(agentResponse.reply, history)
  )

  return {
    intent: 'unknown',
    confidence: Math.max(agentResponse?.confidence || 0, 88),
    reply: canKeepAgentReply ? agentResponse?.reply || null : buildConversationHoldReply(cue, rawText, history),
    shouldNotify: false,
    shouldClose: false,
    leadName: agentResponse?.leadName || null,
    leadStage: cue,
    summary: 'Lead em conversa inicial, ainda sem pedido claro de atendimento humano.',
    reason: 'Guardrail de conversa inicial antes de encaminhar especialista.',
    aiProvider: agentResponse?.aiProvider || null,
    aiModel: agentResponse?.aiModel || null,
    warnings: [
      ...(agentResponse?.warnings || []),
      ...warnings,
      'guardrail: conversa inicial sem handoff',
    ],
  }
}

function softenLearnMoreAgentResponse(
  agentResponse: TriageAgentResponse | null,
  warnings: string[] = []
): TriageAgentResponse {
  const canKeepAgentReply = Boolean(
    agentResponse?.reply &&
    !hasLeadFacingForbiddenTerms(agentResponse.reply)
  )

  return {
    intent: 'interested',
    confidence: Math.max(agentResponse?.confidence || 0, 92),
    reply: canKeepAgentReply ? agentResponse?.reply || null : buildLearnMoreReply(),
    shouldNotify: true,
    shouldClose: false,
    leadName: agentResponse?.leadName || null,
    leadStage: agentResponse?.leadStage || 'clicked_learn_more',
    summary: agentResponse?.summary || 'Lead clicou em saiba mais e demonstrou intencao de entender melhor.',
    reason: agentResponse?.reason || 'Lead acionou botao de interesse.',
    aiProvider: agentResponse?.aiProvider || null,
    aiModel: agentResponse?.aiModel || null,
    warnings: [
      ...(agentResponse?.warnings || []),
      ...warnings,
      'guardrail: saiba mais com resposta conversacional',
    ],
  }
}

function extractButtonSignal(payload: unknown) {
  const source = asRecord(payload)
  const button = asRecord(source.button)
  const interactive = asRecord(source.interactive)
  const buttonReply = asRecord(interactive.button_reply)
  const listReply = asRecord(interactive.list_reply)

  return {
    text: cleanText(button.text || buttonReply.title || listReply.title, 240),
    payload: cleanText(button.payload || buttonReply.id || listReply.id, 240),
  }
}

function extractTextSignal(payload: unknown, fallback?: string | null) {
  const source = asRecord(payload)
  const text = asRecord(source.text)
  const image = asRecord(source.image)
  const video = asRecord(source.video)
  const document = asRecord(source.document)

  return cleanText(
    fallback
      || text.body
      || image.caption
      || video.caption
      || document.caption,
    4096
  )
}

function classifyMetaWhatsAppReply(input: {
  textBody?: string | null
  payload?: unknown
}): ReplyClassification {
  const button = extractButtonSignal(input.payload)
  const rawText = extractTextSignal(input.payload, input.textBody)
  const source: ReplyIntentSource = button.text || button.payload ? 'button' : 'keyword'
  const combined = normalizeIntentText([button.text, button.payload, rawText].filter(Boolean).join(' '))

  const optOutPatterns: Array<string | RegExp> = [
    /\bsair\b/,
    /\bstop\b/,
    'cancelar',
    'parar',
    'descadastrar',
    'remover',
    'remova',
    'retirar',
    'tirar da lista',
    'me tire',
    'me tira',
    'nao quero',
    'nao tenho interesse',
    'sem interesse',
    'apagar meu numero',
    'excluir meu numero',
    'pare de enviar',
    'nao mande',
    'nao enviar',
  ]

  const interestedPatterns: Array<string | RegExp> = [
    'saiba mais',
    'saber mais',
    'mais informacoes',
    'mais detalhes',
    'tenho interesse',
    /\binteresse\b/,
    'quero saber',
    'quero mais',
    'quero detalhes',
    'quero informacoes',
    'quero visita',
    'pode chamar',
    'pode mandar',
    'manda as informacoes',
    'manda informacoes',
    'me passa as informacoes',
    'me passa os detalhes',
    'me passa o valor',
    'me passa as opcoes',
    'me chama',
    'chama no whatsapp',
    'falar com alguem',
    'falar com consultor',
    'falar com corretor',
    'quero sim',
    'sim tenho',
    'especialista',
    'consultor',
    'corretor',
    /\bdetalhes\b/,
    /\bvalor\b/,
    /\bpreco\b/,
    'agenda',
    'visita',
    'comprar',
  ]

  const privacyPatterns: Array<string | RegExp> = [
    'onde pegou',
    'onde conseguiu',
    'como conseguiu',
    'meu numero',
    'meus dados',
    'lgpd',
    'privacidade',
    'cadastro',
    'base de dados',
  ]

  if (includesAny(combined, optOutPatterns)) {
    return {
      intent: 'opt_out',
      confidence: source === 'button' ? 98 : 90,
      source,
      buttonText: button.text || null,
      buttonPayload: button.payload || null,
      rawText: rawText || null,
      classifier: 'rules',
      reason: 'Pedido de remocao ou rejeicao identificado por regra.',
    }
  }

  if (includesAny(combined, privacyPatterns)) {
    return {
      intent: 'question',
      confidence: 78,
      source,
      buttonText: button.text || null,
      buttonPayload: button.payload || null,
      rawText: rawText || null,
      classifier: 'rules',
      reason: 'Pergunta sobre origem do contato ou privacidade identificada por regra.',
    }
  }

  if (hasExplicitInterestSignal({
    source,
    buttonText: button.text,
    buttonPayload: button.payload,
    rawText,
  }) || includesAny(combined, interestedPatterns)) {
    return {
      intent: 'interested',
      confidence: source === 'button' ? 98 : 86,
      source,
      buttonText: button.text || null,
      buttonPayload: button.payload || null,
      rawText: rawText || null,
      classifier: 'rules',
      reason: 'Interesse identificado por botao ou palavra-chave.',
    }
  }

  const conversationHoldCue = getConversationHoldCue({
    source,
    buttonText: button.text,
    buttonPayload: button.payload,
    rawText,
  })
  if (conversationHoldCue) {
    return {
      intent: 'unknown',
      confidence: 68,
      source,
      buttonText: button.text || null,
      buttonPayload: button.payload || null,
      rawText: rawText || null,
      classifier: 'rules',
      reason: 'Conversa inicial sem sinal claro para encaminhar especialista.',
    }
  }

  return {
    intent: 'unknown',
    confidence: 25,
    source,
    buttonText: button.text || null,
    buttonPayload: button.payload || null,
    rawText: rawText || null,
    classifier: 'rules',
    reason: 'Resposta sem intencao operacional clara pelas regras.',
  }
}

function clampInteger(value: unknown, fallback: number, min = 0, max = 100) {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

const META_AGENT_MAX_TOTAL_HUMAN_DELAY_MS = 9000

function configBoolean(configMap: Record<string, string | undefined>, key: string, fallback: boolean) {
  const value = String(configMap[key] ?? '').trim().toLowerCase()
  if (!value) return fallback
  if (['false', '0', 'off', 'no', 'nao', 'não'].includes(value)) return false
  if (['true', '1', 'on', 'yes', 'sim'].includes(value)) return true
  return fallback
}

function normalizeMetaAgentResponseMode(value: unknown) {
  const mode = cleanText(value, 20).toLowerCase()
  if (mode === 'audio' || mode === 'mirror') return mode
  return 'text'
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)))
}

function humanizedDelay(
  configMap: Record<string, string | undefined>,
  text: string,
  variant: 'initial' | 'chunk'
) {
  const minKey = variant === 'chunk'
    ? 'meta_whatsapp_agent_chunk_delay_min_ms'
    : 'meta_whatsapp_agent_response_delay_min_ms'
  const maxKey = variant === 'chunk'
    ? 'meta_whatsapp_agent_chunk_delay_max_ms'
    : 'meta_whatsapp_agent_response_delay_max_ms'

  const fallbackMin = variant === 'chunk' ? 700 : 900
  const fallbackMax = variant === 'chunk' ? 2200 : 4200
  const min = clampInteger(configMap[minKey], fallbackMin, 0, 8000)
  const max = Math.max(min, clampInteger(configMap[maxKey], fallbackMax, 0, 10000))
  const charMs = clampInteger(configMap.meta_whatsapp_agent_typing_ms_per_char, 18, 0, 80)
  const proportional = text.length * charMs
  const clamped = Math.min(max, Math.max(min, proportional))
  return Math.floor(clamped * (0.75 + Math.random() * 0.5))
}

function splitMetaAgentReplyIntoChunks(text: string) {
  const selected = cleanText(text, 1200)
  if (selected.length <= 120) return [selected]

  const sentences = selected.split(/(?<=[.!?])\s+|\n+/).map(item => item.trim()).filter(Boolean)
  if (sentences.length <= 1) return [selected]

  const chunks: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if (current && current.length + sentence.length + 1 > 130) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current = current ? `${current} ${sentence}` : sentence
    }
  }
  if (current.trim()) chunks.push(current.trim())

  if (chunks.length <= 4) return chunks

  const merged: string[] = []
  const perGroup = Math.ceil(chunks.length / 4)
  for (let index = 0; index < chunks.length; index += perGroup) {
    merged.push(chunks.slice(index, index + perGroup).join(' ').trim())
  }
  return merged.filter(Boolean)
}

async function showMetaAgentTypingIndicator(input: {
  configMap: Record<string, string | undefined>
  phoneNumberId?: string | null
  providerMessageId?: string | null
}) {
  if (!configBoolean(input.configMap, 'meta_whatsapp_agent_typing_indicator_enabled', true)) return
  const messageId = cleanText(input.providerMessageId, 300)
  if (!messageId) return

  try {
    await sendMetaWhatsAppTypingIndicator({
      messageId,
      phoneNumberId: cleanText(input.phoneNumberId, 120) || undefined,
      config: input.configMap,
    })
  } catch (error) {
    console.warn('[Meta WhatsApp Agent] typing indicator skipped:', error)
  }
}

async function sendHumanizedMetaWhatsAppReply(input: {
  supabase: SupabaseAdmin
  conversationId: string
  text: string
  configMap: Record<string, string | undefined>
  phoneNumberId?: string | null
  providerMessageId?: string | null
  messageType?: string | null
}) {
  const replyText = cleanText(input.text, 1200)
  if (!replyText) return { sentAs: 'skipped' as const, parts: 0 }

  const humanizeEnabled = configBoolean(input.configMap, 'meta_whatsapp_agent_humanize_enabled', true)
  const responseMode = normalizeMetaAgentResponseMode(input.configMap.meta_whatsapp_agent_response_mode)
  const audioEnabled = configBoolean(input.configMap, 'meta_whatsapp_agent_audio_enabled', false)
  const shouldTryAudio = audioEnabled
    && (responseMode === 'audio' || (responseMode === 'mirror' && cleanText(input.messageType, 30).toLowerCase() === 'audio'))

  if (shouldTryAudio) {
    if (humanizeEnabled) {
      await showMetaAgentTypingIndicator(input)
      await sleep(Math.min(humanizedDelay(input.configMap, replyText, 'initial'), 3500))
    }

    try {
      const audioUrl = await generateWorkflowElevenLabsAudioUrl(replyText)
      await sendMetaWhatsAppChatAudioReply({
        conversationId: input.conversationId,
        audioUrl,
        textFallback: replyText,
      }, input.supabase)
      return { sentAs: 'audio' as const, parts: 1 }
    } catch (error) {
      console.warn('[Meta WhatsApp Agent] audio reply failed, falling back to text:', error)
    }
  }

  const splitEnabled = configBoolean(input.configMap, 'meta_whatsapp_agent_split_messages', true)
  const chunks = splitEnabled ? splitMetaAgentReplyIntoChunks(replyText) : [replyText]
  let totalDelayMs = 0

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index]
    if (!chunk) continue

    if (humanizeEnabled) {
      await showMetaAgentTypingIndicator(input)
      const desiredDelay = humanizedDelay(input.configMap, chunk, index === 0 ? 'initial' : 'chunk')
      const allowedDelay = Math.max(0, Math.min(desiredDelay, META_AGENT_MAX_TOTAL_HUMAN_DELAY_MS - totalDelayMs))
      totalDelayMs += allowedDelay
      if (allowedDelay > 0) await sleep(allowedDelay)
    }

    await sendMetaWhatsAppChatReply({
      conversationId: input.conversationId,
      text: chunk,
    }, input.supabase)
  }

  return { sentAs: 'text' as const, parts: chunks.length }
}

function normalizeAiConfidence(value: unknown, fallback = 50) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  const scaled = numeric <= 1 ? numeric * 100 : numeric
  return Math.min(100, Math.max(0, Math.round(scaled)))
}

function stripJsonFences(value: string) {
  const text = String(value || '').trim()
  const withoutFence = text
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim()
  const start = withoutFence.indexOf('{')
  const end = withoutFence.lastIndexOf('}')
  if (start >= 0 && end > start) return withoutFence.slice(start, end + 1)
  return withoutFence
}

function stripMarkdownFences(value: string) {
  return String(value || '')
    .trim()
    .replace(/^```(?:json|text)?/i, '')
    .replace(/```$/i, '')
    .trim()
}

function normalizeAiIntent(value: unknown): ReplyIntent | null {
  const intent = normalizeIntentText(value)
  if (intent === 'interested' || intent === 'opt_out' || intent === 'question' || intent === 'unknown') {
    return intent
  }
  if (['interesse', 'interessado', 'interessada', 'positivo', 'hot'].includes(intent)) return 'interested'
  if (['sair', 'optout', 'opt out', 'remover', 'cancelar', 'rejeicao'].includes(intent)) return 'opt_out'
  if (['duvida', 'pergunta', 'privacidade', 'origem'].includes(intent)) return 'question'
  return null
}

function parseAiClassification(raw: string) {
  try {
    const parsed = JSON.parse(stripJsonFences(raw))
    const intent = normalizeAiIntent(parsed?.intent)
    if (!intent) return null

    return {
      intent,
      confidence: normalizeAiConfidence(parsed?.confidence, 50),
      reason: cleanText(parsed?.reason, 240) || null,
    }
  } catch {
    return null
  }
}

function shouldUseAiClassification(classification: ReplyClassification) {
  const hasSignal = Boolean(classification.rawText || classification.buttonText || classification.buttonPayload)
  if (!hasSignal) return false

  if (
    (classification.intent === 'interested' || classification.intent === 'opt_out') &&
    classification.confidence >= 85
  ) {
    return false
  }

  return true
}

function buildTriageAiUserMessage(input: {
  classification: ReplyClassification
  contactPhone: string
  contactName?: string | null
  campaignName?: string | null
  templateName?: string | null
  campaignType?: string | null
}) {
  return [
    'Classifique esta resposta recebida em uma campanha oficial de WhatsApp Meta.',
    '',
    `Telefone do lead: +${input.contactPhone}`,
    `Nome do lead: ${cleanText(input.contactName, 160) || 'Nao informado'}`,
    `Campanha: ${cleanText(input.campaignName, 180) || 'Nao encontrada'}`,
    `Template: ${cleanText(input.templateName, 180) || 'Nao encontrado'}`,
    `Tipo da campanha: ${cleanText(input.campaignType, 80) || 'Nao informado'}`,
    '',
    'Sinais recebidos:',
    `Botao: ${input.classification.buttonText || '-'}`,
    `Payload do botao: ${input.classification.buttonPayload || '-'}`,
    `Texto: ${input.classification.rawText || '-'}`,
    '',
    `Classificacao inicial por regras: ${input.classification.intent} (${input.classification.confidence}/100)`,
  ].join('\n')
}

async function classifyReplyWithOpenAI(input: {
  prompt: string
  userMessage: string
}) {
  const apiKey = await getOpenAIApiKey()
  if (!apiKey) return null

  const model = cleanText(await getAIConfig('openai_model'), 80) || 'gpt-4o-mini'
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 300,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: input.prompt },
        { role: 'user', content: input.userMessage },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI triage error: ${errorText.slice(0, 500)}`)
  }

  const data = await response.json()
  const parsed = parseAiClassification(data?.choices?.[0]?.message?.content || '')
  if (!parsed) return null

  return {
    ...parsed,
    aiProvider: 'openai' as TriageAiProvider,
    aiModel: model,
  }
}

async function classifyReplyWithGemini(input: {
  prompt: string
  userMessage: string
}) {
  const apiKey = await getGeminiApiKey()
  if (!apiKey) return null

  const model = await getGeminiModel().catch(async () => (
    cleanText(await getAIConfig('gemini_model'), 80) || 'gemini-2.5-flash'
  ))
  const content = await chatWithGemini({
    systemPrompt: input.prompt,
    history: [],
    userMessage: input.userMessage,
    temperature: 0.1,
    maxTokens: 300,
    responseMimeType: 'application/json',
  })
  const parsed = parseAiClassification(content)
  if (!parsed) return null

  return {
    ...parsed,
    aiProvider: 'gemini' as TriageAiProvider,
    aiModel: model,
  }
}

async function classifyMetaWhatsAppReplyWithAI(input: {
  baseClassification: ReplyClassification
  configMap: Record<string, string | undefined>
  contactPhone: string
  contactName?: string | null
  campaignName?: string | null
  templateName?: string | null
  campaignType?: string | null
}) {
  const baseClassification = input.baseClassification
  const aiEnabled = String(input.configMap.meta_whatsapp_triage_ai_enabled ?? 'true') !== 'false'
  if (!aiEnabled || !shouldUseAiClassification(baseClassification)) return baseClassification
  const conversationHoldCue = getConversationHoldCue({
    source: baseClassification.source,
    buttonText: baseClassification.buttonText,
    buttonPayload: baseClassification.buttonPayload,
    rawText: baseClassification.rawText,
  })

  const prompt = cleanText(input.configMap.meta_whatsapp_triage_ai_prompt, 6000) || DEFAULT_TRIAGE_AI_PROMPT
  const minConfidence = clampInteger(input.configMap.meta_whatsapp_triage_ai_min_confidence, 70, 0, 100)
  const userMessage = buildTriageAiUserMessage({
    classification: baseClassification,
    contactPhone: input.contactPhone,
    contactName: input.contactName,
    campaignName: input.campaignName,
    templateName: input.templateName,
    campaignType: input.campaignType,
  })

  const activeProvider = normalizeIntentText(await getActiveAIProvider())
  const providers: TriageAiProvider[] = activeProvider === 'openai'
    ? ['openai', 'gemini']
    : ['gemini', 'openai']
  const warnings: string[] = []

  for (const provider of providers) {
    try {
      const aiClassification = provider === 'openai'
        ? await classifyReplyWithOpenAI({ prompt, userMessage })
        : await classifyReplyWithGemini({ prompt, userMessage })

      if (!aiClassification) {
        warnings.push(`${provider}: sem credencial ou resposta invalida`)
        continue
      }

      if (aiClassification.confidence < minConfidence) {
        warnings.push(`${provider}: confianca baixa (${aiClassification.confidence}/100)`)
        continue
      }

      if (conversationHoldCue && aiClassification.intent === 'interested') {
        warnings.push(`${provider}: interesse bloqueado por conversa inicial`)
        continue
      }

      return {
        ...baseClassification,
        intent: aiClassification.intent,
        confidence: aiClassification.confidence,
        classifier: 'ai' as ReplyClassifier,
        reason: aiClassification.reason || baseClassification.reason || null,
        aiProvider: aiClassification.aiProvider,
        aiModel: aiClassification.aiModel,
        aiWarnings: warnings,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      warnings.push(`${provider}: ${message.slice(0, 180)}`)
    }
  }

  if (!warnings.length) return baseClassification
  return {
    ...baseClassification,
    aiWarnings: warnings,
  }
}

function parseAgentBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  const normalized = normalizeIntentText(value)
  if (['true', '1', 'sim', 'yes', 'y', 'ativo'].includes(normalized)) return true
  if (['false', '0', 'nao', 'no', 'n', 'inativo'].includes(normalized)) return false
  return fallback
}

function plainTextAgentReply(raw: string) {
  const text = cleanText(stripMarkdownFences(raw), 1200)
  const normalized = normalizeShortReply(text)
  if (!text || !normalized) return null
  if (/^\{|\}$/.test(text)) return null
  if (includesAny(normalized, [
    'intent',
    'should notify',
    'should close',
    'lead stage',
    'lead name',
    'confidence',
    'json valido',
  ])) return null
  if (hasLeadFacingForbiddenTerms(text)) return null

  return text
    .replace(/^resposta\s*(ao lead)?\s*:\s*/i, '')
    .trim()
}

function parseSilentTriageResponse(
  raw: string,
  fallbackIntent: ReplyIntent,
  naturalReply: TriageNaturalReply,
  provider: TriageAiProvider,
  model: string,
  warnings: string[] = []
): TriageAgentResponse | null {
  try {
    const parsed = asRecord(JSON.parse(stripJsonFences(raw)))
    const intent = normalizeAiIntent(parsed.intent) || fallbackIntent
    const confidence = normalizeAiConfidence(parsed.confidence, intent === fallbackIntent ? 65 : 50)

    return {
      intent,
      confidence,
      reply: naturalReply.reply,
      shouldNotify: parseAgentBoolean(parsed.should_notify ?? parsed.shouldNotify, intent === 'interested'),
      shouldClose: parseAgentBoolean(parsed.should_close ?? parsed.shouldClose, intent === 'opt_out'),
      leadName: cleanText(parsed.lead_name ?? parsed.leadName, 160) || null,
      leadStage: cleanText(parsed.lead_stage ?? parsed.leadStage, 80) || null,
      summary: cleanText(parsed.summary ?? parsed.resumo, 800) || null,
      reason: cleanText(parsed.reason ?? parsed.motivo, 240) || null,
      aiProvider: provider,
      aiModel: model,
      warnings: [...naturalReply.warnings, ...warnings],
    }
  } catch {
    return null
  }
}

async function loadConversationHistory(
  supabase: SupabaseAdmin,
  conversationId?: string | null,
  limit = 12
): Promise<TriageConversationHistoryMessage[]> {
  const selectedConversationId = cleanText(conversationId, 80)
  if (!selectedConversationId) return []

  const { data, error } = await supabase
    .from('meta_whatsapp_messages')
    .select('direction, text_body, message_type, status, created_at')
    .eq('conversation_id', selectedConversationId)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, limit))

  if (error) throw error

  return (data || [])
    .reverse()
    .map((message: Record<string, any>): TriageConversationHistoryMessage => ({
      direction: (['inbound', 'outbound', 'system'].includes(String(message.direction))
        ? message.direction
        : 'system') as TriageConversationHistoryMessage['direction'],
      text: cleanText(message.text_body || message.message_type, 700),
      createdAt: message.created_at || null,
      status: message.status || null,
    }))
    .filter((message: TriageConversationHistoryMessage) => Boolean(message.text))
}

function buildAgentUserMessage(input: {
  classification: ReplyClassification
  contactPhone: string
  contactName?: string | null
  campaignName?: string | null
  templateName?: string | null
  campaignType?: string | null
  rawText?: string | null
  history: TriageConversationHistoryMessage[]
}) {
  const historyLines = input.history.length
    ? input.history.map(message => (
      `[${message.direction}${message.status ? `/${message.status}` : ''}${message.createdAt ? ` ${message.createdAt}` : ''}] ${message.text}`
    ))
    : ['Sem historico recente.']

  return [
    'Responda ao lead desta conversa do WhatsApp oficial da imobiliaria.',
    '',
    `Telefone do lead: +${input.contactPhone}`,
    `Nome conhecido: ${cleanText(input.contactName, 160) || 'Nao informado'}`,
    'Contexto interno: o lead respondeu a uma mensagem ativa da imobiliaria. Nao cite campanha, disparo, template, origem tecnica ou detalhes do produto.',
    '',
    'Mensagem atual:',
    `Botao: ${input.classification.buttonText || '-'}`,
    `Payload: ${input.classification.buttonPayload || '-'}`,
    `Texto: ${input.rawText || input.classification.rawText || '-'}`,
    '',
    `Classificacao operacional inicial: ${input.classification.intent} (${input.classification.confidence}/100)`,
    input.classification.reason ? `Motivo inicial: ${input.classification.reason}` : '',
    '',
    'Historico recente:',
    ...historyLines,
    '',
    'Regras finais:',
    '- Responda como atendente humano de primeiro contato, com naturalidade de WhatsApp.',
    '- Use o historico como memoria para nao repetir a mesma frase e para continuar a conversa.',
    '- Se o lead fizer pergunta direta, responda essa pergunta antes de qualificar. Nao ignore a pergunta.',
    '- Nao use resposta padrao de menu. Varie o texto conforme a mensagem atual e o historico.',
    '- Se o lead perguntar seu nome, responda que voce e o Guilherme, do primeiro atendimento da Guilherme Pilger Imoveis, e siga a conversa de forma natural.',
    '- Nao revele detalhes de imovel, empreendimento, produto, preco, disponibilidade, endereco exato ou condicao comercial.',
    '- Nunca use a palavra "campanha" com o lead.',
    '- Se a mensagem atual for cumprimento, identidade ou conversa inicial, responda com contexto e uma pergunta leve.',
    '- Se a mensagem atual for o botao "saiba mais", reconheca o interesse, diga que os detalhes ficam com especialistas e faca uma pergunta de qualificacao.',
    '- Se perceber interesse claro depois da conversa, diga que ja sinalizou o contato para um especialista continuar e siga com tom natural.',
    '- Se perceber pedido de saida/remocao, confirme que removeu da lista.',
    '- Se perguntarem de onde veio o contato, responda com transparencia e ofereca saida da lista sem pressionar.',
    '- Nao repita a mesma frase do historico recente; avance a conversa com uma pergunta curta quando necessario.',
    '- Exemplos de tom: "Fala! Tudo certo por ai?", "Boa. Pra eu te situar...", "Sobre oportunidades imobiliarias da Guilherme Pilger Imoveis...".',
    '- Retorne somente o texto final para o WhatsApp. Nao retorne JSON nem campos internos.',
  ].filter(Boolean).join('\n')
}

async function runNaturalReplyWithOpenAI(input: {
  prompt: string
  userMessage: string
  warnings?: string[]
}): Promise<TriageNaturalReply | null> {
  const apiKey = await getOpenAIApiKey()
  if (!apiKey) return null

  const model = cleanText(await getAIConfig('openai_model'), 80) || 'gpt-4o-mini'
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.75,
      max_tokens: 500,
      messages: [
        { role: 'system', content: input.prompt },
        { role: 'user', content: input.userMessage },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI agent error: ${errorText.slice(0, 500)}`)
  }

  const data = await response.json()
  const reply = plainTextAgentReply(data?.choices?.[0]?.message?.content || '')
  if (!reply) return null

  return {
    reply,
    aiProvider: 'openai',
    aiModel: model,
    warnings: input.warnings || [],
  }
}

async function runNaturalReplyWithGemini(input: {
  prompt: string
  userMessage: string
  warnings?: string[]
}): Promise<TriageNaturalReply | null> {
  const apiKey = await getGeminiApiKey()
  if (!apiKey) return null

  const model = await getGeminiModel().catch(async () => (
    cleanText(await getAIConfig('gemini_model'), 80) || 'gemini-2.5-flash'
  ))
  const content = await chatWithGemini({
    systemPrompt: input.prompt,
    history: [],
    userMessage: input.userMessage,
    temperature: 0.75,
    maxTokens: 500,
  })
  const reply = plainTextAgentReply(content)
  if (!reply) return null

  return {
    reply,
    aiProvider: 'gemini',
    aiModel: model,
    warnings: input.warnings || [],
  }
}

function buildSilentTriageSystemPrompt(configMap: Record<string, string | undefined>) {
  const configuredPrompt = cleanText(configMap.meta_whatsapp_triage_ai_prompt, 6000) || DEFAULT_TRIAGE_AI_PROMPT

  return [
    configuredPrompt,
    '',
    'CAMADA DE TRIAGEM SILENCIOSA DO AGENTE GUILHERME',
    'Voce nao esta conversando com o lead. A resposta ao lead ja foi formulada por outra camada.',
    'Sua tarefa e decidir, de forma interna, se a conversa deve gerar CRM/notificacao, opt-out ou apenas continuar conversando.',
    'Nunca use frases prontas para o lead e nunca reescreva a resposta. Apenas classifique.',
    '',
    'Regras adicionais:',
    '- Cumprimento, pergunta de identidade, pergunta "qual seu nome", "como conseguiu meu numero", "do que se trata", aceitacao para continuar recebendo mensagens ou conversa inicial sem pedido de produto NAO e interessado.',
    '- "Nao fica tranquilo pode continuar me mandando mensagem" significa permissao para conversar, nao interesse comercial confirmado.',
    '- interested exige sinal real sobre o produto/imovel/oportunidade: pedir detalhes, valor, visita, especialista, consultor, corretor, proposta, opcoes ou continuidade humana sobre o produto.',
    '- opt_out vence qualquer outro sinal quando o lead pede para sair, parar, remover, apagar dados ou nao receber mais.',
    '- question cobre duvidas de origem do contato, privacidade, identidade ou contexto quando nao houver interesse real nem pedido de remocao.',
    '- unknown cobre conversa casual, cumprimento, resposta curta ou intencao ainda inconclusiva.',
    '- should_notify so pode ser true quando intent for interested e houver interesse real.',
    '- should_close so pode ser true quando intent for opt_out ou houver pedido claro de encerramento/remocao.',
    '',
    'Retorne somente JSON valido, sem markdown, neste formato:',
    '{"intent":"interested|opt_out|question|unknown","confidence":0-100,"should_notify":true|false,"should_close":true|false,"lead_name":"nome extraido ou null","lead_stage":"short stage","summary":"resumo curto","reason":"motivo curto"}',
  ].join('\n')
}

function buildAgentTriageUserMessage(input: {
  classification: ReplyClassification
  contactPhone: string
  contactName?: string | null
  rawText?: string | null
  history: TriageConversationHistoryMessage[]
  proposedReply: string
}) {
  const historyLines = input.history.length
    ? input.history.map(message => (
      `[${message.direction}${message.status ? `/${message.status}` : ''}${message.createdAt ? ` ${message.createdAt}` : ''}] ${message.text}`
    ))
    : ['Sem historico recente.']

  return [
    'Classifique silenciosamente este turno do Agente Guilherme.',
    '',
    `Telefone do lead: +${input.contactPhone}`,
    `Nome conhecido: ${cleanText(input.contactName, 160) || 'Nao informado'}`,
    '',
    'Mensagem atual do lead:',
    `Botao: ${input.classification.buttonText || '-'}`,
    `Payload: ${input.classification.buttonPayload || '-'}`,
    `Texto: ${input.rawText || input.classification.rawText || '-'}`,
    '',
    `Classificacao inicial por regras/triagem: ${input.classification.intent} (${input.classification.confidence}/100)`,
    input.classification.reason ? `Motivo inicial: ${input.classification.reason}` : '',
    '',
    'Historico recente:',
    ...historyLines,
    '',
    'Resposta natural proposta ao lead pela camada conversacional:',
    input.proposedReply,
    '',
    'Decida apenas a intencao operacional interna. Nao reescreva a resposta.',
  ].filter(Boolean).join('\n')
}

async function runSilentTriageWithOpenAI(input: {
  prompt: string
  userMessage: string
  fallbackIntent: ReplyIntent
  naturalReply: TriageNaturalReply
  warnings?: string[]
}) {
  const apiKey = await getOpenAIApiKey()
  if (!apiKey) return null

  const model = cleanText(await getAIConfig('openai_model'), 80) || 'gpt-4o-mini'
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: input.prompt },
        { role: 'user', content: input.userMessage },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI silent triage error: ${errorText.slice(0, 500)}`)
  }

  const data = await response.json()
  return parseSilentTriageResponse(
    data?.choices?.[0]?.message?.content || '',
    input.fallbackIntent,
    input.naturalReply,
    'openai',
    model,
    input.warnings || []
  )
}

async function runSilentTriageWithGemini(input: {
  prompt: string
  userMessage: string
  fallbackIntent: ReplyIntent
  naturalReply: TriageNaturalReply
  warnings?: string[]
}) {
  const apiKey = await getGeminiApiKey()
  if (!apiKey) return null

  const model = await getGeminiModel().catch(async () => (
    cleanText(await getAIConfig('gemini_model'), 80) || 'gemini-2.5-flash'
  ))
  const content = await chatWithGemini({
    systemPrompt: input.prompt,
    history: [],
    userMessage: input.userMessage,
    temperature: 0.1,
    maxTokens: 500,
    responseMimeType: 'application/json',
  })

  return parseSilentTriageResponse(
    content,
    input.fallbackIntent,
    input.naturalReply,
    'gemini',
    model,
    input.warnings || []
  )
}

function buildFallbackAgentTriageResponse(
  classification: ReplyClassification,
  naturalReply: TriageNaturalReply,
  warnings: string[] = []
): TriageAgentResponse {
  return {
    intent: classification.intent,
    confidence: classification.confidence,
    reply: naturalReply.reply,
    shouldNotify: classification.intent === 'interested',
    shouldClose: classification.intent === 'opt_out',
    leadName: null,
    leadStage: classification.intent === 'unknown' ? 'conversation' : classification.intent,
    summary: 'Resposta conversacional gerada por LLM; triagem silenciosa usou classificacao inicial por fallback.',
    reason: classification.reason || 'Fallback de triagem silenciosa.',
    aiProvider: naturalReply.aiProvider,
    aiModel: naturalReply.aiModel,
    warnings: [...naturalReply.warnings, ...warnings, 'silent_triage: fallback para classificacao inicial'],
  }
}

async function generateMetaWhatsAppAgentResponse(input: {
  supabase: SupabaseAdmin
  conversation: Record<string, any> | null
  classification: ReplyClassification
  configMap: Record<string, string | undefined>
  contactPhone: string
  contactName?: string | null
  campaignName?: string | null
  templateName?: string | null
  campaignType?: string | null
  rawText?: string | null
  history?: TriageConversationHistoryMessage[]
  warnings?: string[]
}) {
  const agentEnabled = String(input.configMap.meta_whatsapp_agent_enabled ?? 'true') !== 'false'
  if (!agentEnabled) return null

  const prompt = buildMetaWhatsAppAgentPrompt(input.configMap)
  const historyLimit = clampInteger(input.configMap.meta_whatsapp_agent_history_limit, 12, 4, 30)
  const history = input.history || await loadConversationHistory(input.supabase, input.conversation?.id, historyLimit)
  const userMessage = buildAgentUserMessage({
    classification: input.classification,
    contactPhone: input.contactPhone,
    contactName: input.contactName,
    campaignName: input.campaignName,
    templateName: input.templateName,
    campaignType: input.campaignType,
    rawText: input.rawText,
    history,
  })

  const activeProvider = normalizeIntentText(await getActiveAIProvider())
  const providers: TriageAiProvider[] = activeProvider === 'openai'
    ? ['openai', 'gemini']
    : ['gemini', 'openai']
  const warnings: string[] = []
  let naturalReply: TriageNaturalReply | null = null

  for (const provider of providers) {
    try {
      naturalReply = provider === 'openai'
        ? await runNaturalReplyWithOpenAI({
          prompt,
          userMessage,
          warnings: [...warnings],
        })
        : await runNaturalReplyWithGemini({
          prompt,
          userMessage,
          warnings: [...warnings],
        })

      if (!naturalReply) {
        warnings.push(`${provider}: sem credencial ou resposta conversacional invalida`)
        continue
      }

      break
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      warnings.push(`${provider}: conversa ${message.slice(0, 180)}`)
    }
  }

  if (!naturalReply) {
    input.warnings?.push(...warnings)
    return null
  }

  const triagePrompt = buildSilentTriageSystemPrompt(input.configMap)
  const triageUserMessage = buildAgentTriageUserMessage({
    classification: input.classification,
    contactPhone: input.contactPhone,
    contactName: input.contactName,
    rawText: input.rawText,
    history,
    proposedReply: naturalReply.reply,
  })
  const triageWarnings: string[] = []

  for (const provider of providers) {
    try {
      const triageResponse = provider === 'openai'
        ? await runSilentTriageWithOpenAI({
          prompt: triagePrompt,
          userMessage: triageUserMessage,
          fallbackIntent: input.classification.intent,
          naturalReply,
          warnings: [...warnings, ...triageWarnings],
        })
        : await runSilentTriageWithGemini({
          prompt: triagePrompt,
          userMessage: triageUserMessage,
          fallbackIntent: input.classification.intent,
          naturalReply,
          warnings: [...warnings, ...triageWarnings],
        })

      if (!triageResponse) {
        triageWarnings.push(`${provider}: triagem silenciosa invalida`)
        continue
      }

      return {
        ...triageResponse,
        warnings: [...warnings, ...triageWarnings, ...triageResponse.warnings],
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      triageWarnings.push(`${provider}: triagem ${message.slice(0, 180)}`)
    }
  }

  input.warnings?.push(...warnings, ...triageWarnings)
  return buildFallbackAgentTriageResponse(input.classification, naturalReply, [...warnings, ...triageWarnings])
}

async function findExistingIntent(
  supabase: SupabaseAdmin,
  eventId?: string | null,
  providerMessageId?: string | null
) {
  if (eventId) {
    const { data, error } = await supabase
      .from('meta_whatsapp_reply_intents')
      .select('id, intent, campaign_id, recipient_id')
      .eq('event_id', eventId)
      .maybeSingle()
    if (error) throw error
    if (data) return data
  }

  if (!providerMessageId) return null
  const { data, error } = await supabase
    .from('meta_whatsapp_reply_intents')
    .select('id, intent, campaign_id, recipient_id')
    .eq('provider_message_id', providerMessageId)
    .maybeSingle()

  if (error) throw error
  return data || null
}

async function getInboundMessageId(
  supabase: SupabaseAdmin,
  providerMessageId?: string | null
) {
  const selected = cleanText(providerMessageId, 200)
  if (!selected) return null

  const { data, error } = await supabase
    .from('meta_whatsapp_messages')
    .select('id')
    .eq('provider_message_id', selected)
    .maybeSingle()

  if (error) throw error
  return data?.id || null
}

async function loadRecipientContext(
  supabase: SupabaseAdmin,
  conversation: Record<string, any> | null | undefined,
  contactPhone: string,
  senderId?: string | null
) {
  const conversationRecipientId = cleanText(conversation?.last_recipient_id, 80)
  if (conversationRecipientId) {
    const { data, error } = await supabase
      .from('meta_whatsapp_campaign_recipients')
      .select(`
        id,
        campaign_id,
        sender_id,
        recipient_name,
        recipient_phone,
        template_parameters,
        metadata,
        campaign:meta_whatsapp_campaigns(id, name, template_name, template_language, campaign_type)
      `)
      .eq('id', conversationRecipientId)
      .maybeSingle()
    if (error) throw error
    if (data) return data
  }

  let query = supabase
    .from('meta_whatsapp_campaign_recipients')
    .select(`
      id,
      campaign_id,
      sender_id,
      recipient_name,
      recipient_phone,
      template_parameters,
      metadata,
      campaign:meta_whatsapp_campaigns(id, name, template_name, template_language, campaign_type)
    `)
    .eq('recipient_phone', contactPhone)
    .order('created_at', { ascending: false })
    .limit(1)

  const selectedSenderId = cleanText(senderId || conversation?.sender_id, 80)
  if (selectedSenderId) query = query.eq('sender_id', selectedSenderId)

  const { data, error } = await query
  if (error) throw error
  return data?.[0] || null
}

async function updateReplyIntent(
  supabase: SupabaseAdmin,
  id: string | undefined,
  values: Record<string, unknown>
) {
  if (!id) return
  await supabase
    .from('meta_whatsapp_reply_intents')
    .update({
      ...values,
      updated_at: isoNow(),
    })
    .eq('id', id)
}

async function upsertOptOut(input: {
  supabase: SupabaseAdmin
  contactPhone: string
  campaignId?: string | null
  recipientId?: string | null
  senderId?: string | null
  rawPayload?: unknown
  requestedAt: string
}) {
  await input.supabase
    .from('meta_whatsapp_opt_outs')
    .upsert({
      phone_e164: input.contactPhone,
      source: 'meta_whatsapp_triage',
      campaign_id: input.campaignId || null,
      recipient_id: input.recipientId || null,
      sender_id: input.senderId || null,
      reason: 'user_requested_opt_out',
      raw_payload: input.rawPayload || {},
      requested_at: input.requestedAt,
    }, { onConflict: 'phone_e164' })
}

function buildInternalNotification(input: {
  contactPhone: string
  contactName?: string | null
  recipientName?: string | null
  campaignName?: string | null
  templateName?: string | null
  responseText?: string | null
  leadStage?: string | null
  summary?: string | null
  agentReply?: string | null
  reason?: string | null
}) {
  const name = cleanText(input.contactName || input.recipientName, 160) || 'Nao informado'
  const response = cleanText(input.responseText, 500) || '-'
  const stage = cleanText(input.leadStage, 100)
  const summary = cleanText(input.summary, 700)
  const agentReply = cleanText(input.agentReply, 700)
  const reason = cleanText(input.reason, 240)

  return [
    'Novo lead interessado no WhatsApp Meta',
    '',
    `Nome: ${name}`,
    `Telefone: +${input.contactPhone}`,
    `Campanha: ${cleanText(input.campaignName, 160) || '-'}`,
    `Template: ${cleanText(input.templateName, 160) || '-'}`,
    `Resposta: ${response}`,
    stage ? `Etapa IA: ${stage}` : null,
    summary ? `Resumo IA: ${summary}` : null,
    agentReply ? `Resposta enviada: ${agentReply}` : null,
    reason ? `Motivo: ${reason}` : null,
    '',
    'Origem: Campanhas Meta WhatsApp',
  ].filter(Boolean).join('\n')
}

async function findLeadForMetaWhatsAppAgent(input: {
  supabase: SupabaseAdmin
  conversation: Record<string, any> | null
  contactPhone: string
}) {
  const conversationLeadId = cleanText(input.conversation?.lead_id, 80)
  const select = 'id,name,phone,phone_e164,metadata,ai_summary,funnel_stage,lead_classification'

  if (conversationLeadId) {
    const { data, error } = await input.supabase
      .from('leads')
      .select(select)
      .eq('id', conversationLeadId)
      .maybeSingle()

    if (!error && data) return data
  }

  const phone = normalizeMetaWhatsAppPhone(input.contactPhone)
  if (!phone) return null

  const candidates = [`+${phone}`, phone]
  for (const value of candidates) {
    const { data, error } = await input.supabase
      .from('leads')
      .select(select)
      .eq('phone_e164', value)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (!error && data?.[0]) return data[0]
  }

  const { data, error } = await input.supabase
    .from('leads')
    .select(select)
    .eq('phone', phone)
    .order('updated_at', { ascending: false })
    .limit(1)

  if (!error && data?.[0]) return data[0]
  return null
}

async function updateLeadWithAgentSignal(input: {
  supabase: SupabaseAdmin
  conversation: Record<string, any> | null
  contactPhone: string
  contactName?: string | null
  campaignName?: string | null
  templateName?: string | null
  rawText?: string | null
  effectiveIntent: ReplyIntent
  confidence: number
  notifiedStatus: 'skipped' | 'sent' | 'failed'
  notifiedPhone?: string | null
  agentResponse?: TriageAgentResponse | null
  reason?: string | null
}) {
  const lead = await findLeadForMetaWhatsAppAgent({
    supabase: input.supabase,
    conversation: input.conversation,
    contactPhone: input.contactPhone,
  })

  if (!lead?.id) return

  const now = isoNow()
  const metadata = asRecord(lead.metadata)
  const agentMetadata = {
    intent: input.effectiveIntent,
    confidence: input.confidence,
    notified_status: input.notifiedStatus,
    notified_phone: input.notifiedPhone || null,
    campaign_name: cleanText(input.campaignName, 180) || null,
    template_name: cleanText(input.templateName, 180) || null,
    last_response: cleanText(input.rawText, 500) || null,
    reply: cleanText(input.agentResponse?.reply, 800) || null,
    lead_stage: cleanText(input.agentResponse?.leadStage, 80) || null,
    summary: cleanText(input.agentResponse?.summary, 800) || null,
    reason: cleanText(input.reason || input.agentResponse?.reason, 240) || null,
    ai_provider: input.agentResponse?.aiProvider || null,
    ai_model: input.agentResponse?.aiModel || null,
    at: now,
  }

  const update: Record<string, unknown> = {
    metadata: {
      ...metadata,
      meta_whatsapp_agent: agentMetadata,
    },
    updated_at: now,
  }

  const currentName = cleanText(lead.name, 160)
  const agentName = cleanText(input.agentResponse?.leadName || input.contactName, 160)
  if (agentName && (!currentName || /^\+?\d{8,}$/.test(currentName))) {
    update.name = agentName
  }

  if (input.effectiveIntent === 'interested' || input.agentResponse?.shouldNotify) {
    update.funnel_stage = 'qualified'
    update.lead_classification = 'hot'
    if (agentMetadata.summary) update.ai_summary = agentMetadata.summary
  } else if (input.effectiveIntent === 'question' || input.effectiveIntent === 'unknown') {
    const stage = cleanText(lead.funnel_stage, 40).toLowerCase()
    if (!['qualified', 'converted'].includes(stage)) update.funnel_stage = 'lead'
    if (agentMetadata.summary) update.ai_summary = agentMetadata.summary
  }

  await input.supabase
    .from('leads')
    .update(update)
    .eq('id', lead.id)
}

async function loadManualTriageMessage(
  supabase: SupabaseAdmin,
  conversationId: string,
  messageId?: string | null
) {
  const selectedMessageId = cleanText(messageId, 80)

  if (selectedMessageId) {
    const { data, error } = await supabase
      .from('meta_whatsapp_messages')
      .select('*')
      .eq('id', selectedMessageId)
      .eq('conversation_id', conversationId)
      .maybeSingle()

    if (error) throw error
    return data || null
  }

  const { data, error } = await supabase
    .from('meta_whatsapp_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw error
  return data?.[0] || null
}

async function findManualTriageIntent(
  supabase: SupabaseAdmin,
  providerMessageId?: string | null,
  messageId?: string | null
) {
  const selectedProviderMessageId = cleanText(providerMessageId, 200)
  if (selectedProviderMessageId) {
    const { data, error } = await supabase
      .from('meta_whatsapp_reply_intents')
      .select('*')
      .eq('provider_message_id', selectedProviderMessageId)
      .maybeSingle()
    if (error) throw error
    if (data) return data
  }

  const selectedMessageId = cleanText(messageId, 80)
  if (!selectedMessageId) return null

  const { data, error } = await supabase
    .from('meta_whatsapp_reply_intents')
    .select('*')
    .eq('message_id', selectedMessageId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw error
  return data?.[0] || null
}

export async function manuallyClassifyMetaWhatsAppConversationReply(
  input: ManualMetaWhatsAppReplyTriageInput,
  supabase = createAdminClient()
) {
  const conversationId = cleanText(input.conversationId, 80)
  if (!conversationId) throw new Error('conversation_id obrigatorio.')

  const intent = normalizeAiIntent(input.intent) as ReplyIntent | null
  if (!intent) throw new Error('Intencao manual invalida.')

  const { data: conversation, error: conversationError } = await supabase
    .from('meta_whatsapp_conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle()

  if (conversationError) throw conversationError
  if (!conversation) throw new Error('Conversa Meta WhatsApp nao encontrada.')

  const contactPhone = normalizeMetaWhatsAppPhone(conversation.contact_phone)
  if (!contactPhone) throw new Error('Conversa sem telefone valido.')

  const message = await loadManualTriageMessage(supabase, conversationId, input.messageId)
  const providerMessageId = cleanText(message?.provider_message_id, 200) || null
  const messageId = cleanText(message?.id || input.messageId, 80) || null
  const recipient = await loadRecipientContext(supabase, conversation, contactPhone, conversation.sender_id)
  const campaign = Array.isArray(recipient?.campaign) ? recipient.campaign[0] : recipient?.campaign
  const now = isoNow()
  const senderId = cleanText(conversation.sender_id || recipient?.sender_id, 80) || null
  const phoneNumberId = cleanText(conversation.phone_number_id, 120) || null
  const campaignId = cleanText(campaign?.id || recipient?.campaign_id || conversation.last_campaign_id, 80) || null
  const recipientId = cleanText(recipient?.id || conversation.last_recipient_id, 80) || null
  const contactName = cleanText(conversation.contact_name || recipient?.recipient_name, 160) || null
  const rawText = cleanText(message?.text_body || input.note, 4096) || null
  const note = cleanText(input.note, 500) || null
  const existingIntent = await findManualTriageIntent(supabase, providerMessageId, messageId)
  const previousMetadata = asRecord(existingIntent?.metadata)

  const intentValues = {
    conversation_id: conversationId,
    message_id: messageId,
    campaign_id: campaignId,
    recipient_id: recipientId,
    sender_id: senderId,
    phone_number_id: phoneNumberId,
    provider_message_id: providerMessageId,
    contact_phone: contactPhone,
    contact_name: contactName,
    intent,
    confidence: 100,
    source: 'manual',
    button_text: null,
    button_payload: null,
    raw_text: rawText,
    campaign_name: cleanText(campaign?.name, 180) || null,
    template_name: cleanText(campaign?.template_name, 180) || null,
    auto_reply_status: 'skipped',
    auto_reply_message: null,
    auto_reply_error: null,
    metadata: {
      ...previousMetadata,
      manual: {
        note,
        previous_intent: existingIntent?.intent || null,
        at: now,
      },
      triage: {
        classifier: 'manual',
        reason: note || 'Classificacao manual registrada no chat.',
        intent,
      },
    },
    updated_at: now,
  }

  const { data: intentRow, error: intentError } = existingIntent?.id
    ? await supabase
      .from('meta_whatsapp_reply_intents')
      .update(intentValues)
      .eq('id', existingIntent.id)
      .select('*')
      .single()
    : await supabase
      .from('meta_whatsapp_reply_intents')
      .insert({
        ...intentValues,
        created_at: now,
      })
      .select('*')
      .single()

  if (intentError) throw intentError

  if (intent === 'opt_out') {
    await upsertOptOut({
      supabase,
      contactPhone,
      campaignId,
      recipientId,
      senderId,
      rawPayload: {
        source: 'manual',
        conversation_id: conversationId,
        message_id: messageId,
        note,
      },
      requestedAt: now,
    })
  }

  const conversationMetadata = asRecord(conversation.metadata)
  const conversationUpdate: Record<string, unknown> = {
    metadata: {
      ...conversationMetadata,
      triage: {
        intent,
        source: 'manual',
        intent_id: intentRow?.id || null,
        at: now,
      },
    },
  }

  if (intent === 'opt_out') {
    conversationUpdate.status = 'closed'
    conversationUpdate.unread_count = 0
  } else if (intent === 'interested') {
    conversationUpdate.status = 'pending'
    conversationUpdate.unread_count = 0
  }

  await supabase
    .from('meta_whatsapp_conversations')
    .update(conversationUpdate)
    .eq('id', conversationId)

  let notifiedStatus: 'skipped' | 'sent' | 'failed' = 'skipped'
  let notifiedPhone: string | null = existingIntent?.notified_phone || null
  const alreadyNotified = existingIntent?.notified_status === 'sent'

  if (intent === 'interested' && !alreadyNotified) {
    const configMap = await loadMetaWhatsAppConfigMap(supabase)
    const notifyPhone = normalizeMetaWhatsAppPhone(
      configMap.meta_whatsapp_triage_interest_notify_phone
      || configMap.meta_whatsapp_support_redirect_phone
    )
    notifiedPhone = notifyPhone || null

    if (notifyPhone) {
      try {
        await sendMetaWhatsAppTextMessage({
          to: notifyPhone,
          text: buildInternalNotification({
            contactPhone,
            contactName,
            recipientName: recipient?.recipient_name || null,
            campaignName: campaign?.name || null,
            templateName: campaign?.template_name || null,
            responseText: rawText,
            reason: note || 'Lead marcado manualmente como interessado no chat.',
          }),
          phoneNumberId: phoneNumberId || undefined,
          config: configMap,
        })
        notifiedStatus = 'sent'
        await updateReplyIntent(supabase, intentRow?.id, {
          notified_status: 'sent',
          notified_phone: notifyPhone,
          notified_at: now,
          notified_error: null,
        })
      } catch (error) {
        notifiedStatus = 'failed'
        await updateReplyIntent(supabase, intentRow?.id, {
          notified_status: 'failed',
          notified_phone: notifyPhone,
          notified_error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
        })
      }
    } else {
      await updateReplyIntent(supabase, intentRow?.id, {
        notified_status: 'skipped',
        notified_phone: null,
        notified_error: 'Numero interno nao configurado.',
      })
    }
  } else if (intent !== 'interested') {
    await updateReplyIntent(supabase, intentRow?.id, {
      notified_status: 'skipped',
      notified_phone: null,
      notified_error: null,
    })
  } else if (alreadyNotified) {
    notifiedStatus = 'sent'
  }

  if (recipientId) {
    await supabase
      .from('meta_whatsapp_campaign_recipients')
      .update({
        metadata: {
          ...(recipient?.metadata || {}),
          meta_reply_triage: {
            intent,
            source: 'manual',
            confidence: 100,
            classifier: 'manual',
            reason: note || null,
            intent_id: intentRow?.id || null,
            at: now,
          },
        },
      })
      .eq('id', recipientId)
  }

  return {
    intent,
    campaignId,
    recipientId,
    notifiedStatus,
    notifiedPhone,
    intentId: intentRow?.id || null,
  }
}

export async function handleMetaWhatsAppReplyTriage(
  input: HandleMetaWhatsAppReplyTriageInput,
  supabase = createAdminClient()
) {
  const contactPhone = normalizeMetaWhatsAppPhone(input.fromPhone)
  if (!contactPhone) return null

  const configMap = await loadMetaWhatsAppConfigMap(supabase)
  if (String(configMap.meta_whatsapp_triage_enabled ?? 'true') === 'false') {
    return { intent: 'unknown' as ReplyIntent, skipped: true }
  }

  const providerMessageId = cleanText(input.providerMessageId, 200) || null
  const existing = await findExistingIntent(supabase, input.eventId, providerMessageId)
  if (existing?.id) {
    return {
      intent: existing.intent as ReplyIntent,
      campaignId: existing.campaign_id || null,
      recipientId: existing.recipient_id || null,
      skipped: true,
    }
  }

  const baseClassification = classifyMetaWhatsAppReply({
    textBody: input.textBody,
    payload: input.payload,
  })
  const conversation = input.conversation || null
  const recipient = await loadRecipientContext(supabase, conversation, contactPhone, input.senderId)
  const campaign = Array.isArray(recipient?.campaign) ? recipient.campaign[0] : recipient?.campaign
  const messageId = await getInboundMessageId(supabase, providerMessageId)
  const receivedAt = input.receivedAt || isoNow()
  const senderId = cleanText(input.senderId || conversation?.sender_id || recipient?.sender_id, 80) || null
  const phoneNumberId = cleanText(input.phoneNumberId || conversation?.phone_number_id, 120) || null
  const campaignId = cleanText(campaign?.id || recipient?.campaign_id || conversation?.last_campaign_id, 80) || null
  const recipientId = cleanText(recipient?.id || conversation?.last_recipient_id, 80) || null
  const contactName = cleanText(input.contactName || conversation?.contact_name || recipient?.recipient_name, 160) || null
  const classification = await classifyMetaWhatsAppReplyWithAI({
    baseClassification,
    configMap,
    contactPhone,
    contactName,
    campaignName: campaign?.name || null,
    templateName: campaign?.template_name || null,
    campaignType: campaign?.campaign_type || null,
  })
  const rawText = classification.rawText || classification.buttonText || classification.buttonPayload || ''
  let agentResponse: TriageAgentResponse | null = null
  const agentWarnings: string[] = []
  let agentHistory: TriageConversationHistoryMessage[] = []

  if (conversation?.id) {
    try {
      const historyLimit = clampInteger(configMap.meta_whatsapp_agent_history_limit, 12, 4, 30)
      agentHistory = await loadConversationHistory(supabase, conversation.id, historyLimit)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      agentWarnings.push(`history: ${message.slice(0, 180)}`)
    }
  }

  try {
    agentResponse = await generateMetaWhatsAppAgentResponse({
      supabase,
      conversation,
      classification,
      configMap,
      contactPhone,
      contactName,
      campaignName: campaign?.name || null,
      templateName: campaign?.template_name || null,
      campaignType: campaign?.campaign_type || null,
      rawText,
      history: agentHistory,
      warnings: agentWarnings,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    agentWarnings.push(`agent: ${message.slice(0, 180)}`)
  }

  const conversationHoldCue = getConversationHoldCue({
    source: classification.source,
    buttonText: classification.buttonText,
    buttonPayload: classification.buttonPayload,
    rawText: classification.rawText || rawText,
  })
  if (conversationHoldCue) {
    agentResponse = buildConversationHoldAgentResponse(
      conversationHoldCue,
      agentResponse,
      [],
      classification.rawText || rawText,
      agentHistory
    )
  } else if (isLearnMoreSignal({
    source: classification.source,
    buttonText: classification.buttonText,
    buttonPayload: classification.buttonPayload,
    rawText: classification.rawText || rawText,
  })) {
    agentResponse = softenLearnMoreAgentResponse(agentResponse)
  } else if (
    agentResponse?.reply &&
    isPrematureHandoffReply(agentResponse.reply) &&
    !hasExplicitInterestSignal({
      source: classification.source,
      buttonText: classification.buttonText,
      buttonPayload: classification.buttonPayload,
      rawText: classification.rawText || rawText,
    })
  ) {
    agentResponse = buildConversationHoldAgentResponse(
      getFallbackConversationCue({
        source: classification.source,
        buttonText: classification.buttonText,
        buttonPayload: classification.buttonPayload,
        rawText: classification.rawText || rawText,
      }),
      agentResponse,
      ['guardrail: resposta generica ou encaminhamento prematuro neutralizada'],
      classification.rawText || rawText,
      agentHistory
    )
  }

  const effectiveIntent = agentResponse?.intent || classification.intent
  const effectiveConfidence = agentResponse ? agentResponse.confidence : classification.confidence
  const effectiveReason = agentResponse?.reason || classification.reason || null
  const effectiveClassifier: ReplyClassifier = agentResponse?.aiProvider ? 'ai' : classification.classifier
  const effectiveAiProvider = agentResponse?.aiProvider || classification.aiProvider || null
  const effectiveAiModel = agentResponse?.aiModel || classification.aiModel || null
  const combinedWarnings = [
    ...(classification.aiWarnings || []),
    ...(agentResponse?.warnings || []),
    ...agentWarnings,
  ].filter(Boolean)

  const { data: intentRow, error: intentError } = await supabase
    .from('meta_whatsapp_reply_intents')
    .insert({
      conversation_id: conversation?.id || null,
      message_id: messageId,
      event_id: input.eventId || null,
      campaign_id: campaignId,
      recipient_id: recipientId,
      sender_id: senderId,
      phone_number_id: phoneNumberId,
      provider_message_id: providerMessageId,
      contact_phone: contactPhone,
      contact_name: contactName,
      intent: effectiveIntent,
      confidence: effectiveConfidence,
      source: classification.source,
      button_text: classification.buttonText,
      button_payload: classification.buttonPayload,
      raw_text: classification.rawText,
      campaign_name: cleanText(campaign?.name, 180) || null,
      template_name: cleanText(campaign?.template_name, 180) || null,
      metadata: {
        message_type: input.messageType || null,
        received_at: receivedAt,
        triage: {
          classifier: effectiveClassifier,
          reason: effectiveReason,
          ai_provider: effectiveAiProvider,
          ai_model: effectiveAiModel,
          ai_warnings: combinedWarnings,
          rule_intent: baseClassification.intent,
          rule_confidence: baseClassification.confidence,
          triage_intent: classification.intent,
          triage_confidence: classification.confidence,
          agent: agentResponse ? {
            reply: agentResponse.reply,
            should_notify: agentResponse.shouldNotify,
            should_close: agentResponse.shouldClose,
            lead_name: agentResponse.leadName,
            lead_stage: agentResponse.leadStage,
            summary: agentResponse.summary,
            reason: agentResponse.reason,
          } : null,
        },
      },
      created_at: receivedAt,
    })
    .select('*')
    .single()

  if (intentError) throw intentError

  if (effectiveIntent === 'opt_out' || agentResponse?.shouldClose) {
    await upsertOptOut({
      supabase,
      contactPhone,
      campaignId,
      recipientId,
      senderId,
      rawPayload: input.payload,
      requestedAt: receivedAt,
    })
  }

  const optOutFallback = 'Pronto. Vou remover seu contato da nossa lista. Voce nao recebera novas mensagens por este canal.'
  const privacyFallback = 'Seu numero estava em uma base de contatos autorizados da imobiliaria. Se nao fizer sentido pra voce, eu removo seu contato por aqui mesmo.'
  let replyText = cleanText(agentResponse?.reply, 1200)
  if (!replyText && effectiveIntent === 'interested') {
    replyText = buildLearnMoreReply()
  } else if (!replyText && effectiveIntent === 'opt_out') {
    replyText = optOutFallback
  } else if (!replyText && effectiveIntent === 'question') {
    replyText = privacyFallback
  } else if (!replyText && String(configMap.meta_whatsapp_agent_enabled ?? 'true') !== 'false') {
    const fallbackCue = getConversationHoldCue({
      source: classification.source,
      buttonText: classification.buttonText,
      buttonPayload: classification.buttonPayload,
      rawText: classification.rawText || rawText,
    })
    const conversationalFallback = fallbackCue
      ? buildConversationHoldReply(fallbackCue, classification.rawText || rawText, agentHistory)
      : buildConversationHoldReply('conversation_request', classification.rawText || rawText, agentHistory)
    replyText = conversationalFallback
  }

  if (replyText && hasLeadFacingForbiddenTerms(replyText)) {
    if (effectiveIntent === 'interested') {
      replyText = buildLearnMoreReply()
    } else if (effectiveIntent === 'opt_out') {
      replyText = optOutFallback
    } else if (effectiveIntent === 'question') {
      replyText = privacyFallback
    } else {
      const fallbackCue = getFallbackConversationCue({
        source: classification.source,
        buttonText: classification.buttonText,
        buttonPayload: classification.buttonPayload,
        rawText: classification.rawText || rawText,
      })
      replyText = buildConversationHoldReply(fallbackCue, classification.rawText || rawText, agentHistory)
    }
  }

  if (replyText && conversation?.id) {
    try {
      await sendHumanizedMetaWhatsAppReply({
        supabase,
        conversationId: String(conversation.id),
        text: replyText,
        configMap,
        phoneNumberId,
        providerMessageId,
        messageType: input.messageType,
      })
      await updateReplyIntent(supabase, intentRow?.id, {
        auto_reply_status: 'sent',
        auto_reply_message: replyText,
        auto_reply_error: null,
      })
    } catch (error) {
      await updateReplyIntent(supabase, intentRow?.id, {
        auto_reply_status: 'failed',
        auto_reply_message: replyText,
        auto_reply_error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
      })
    }
  }

  if ((effectiveIntent === 'opt_out' || agentResponse?.shouldClose) && conversation?.id) {
    await supabase
      .from('meta_whatsapp_conversations')
      .update({
        status: 'closed',
        unread_count: 0,
        metadata: {
          ...(conversation.metadata || {}),
          triage: {
            intent: effectiveIntent,
            intent_id: intentRow?.id || null,
            at: isoNow(),
          },
        },
      })
      .eq('id', conversation.id)
  }

  let notifiedStatus: 'skipped' | 'sent' | 'failed' = 'skipped'
  let notifiedPhoneForLead: string | null = null
  if (effectiveIntent === 'interested' || agentResponse?.shouldNotify) {
    const notifyPhone = normalizeMetaWhatsAppPhone(
      configMap.meta_whatsapp_triage_interest_notify_phone
      || configMap.meta_whatsapp_support_redirect_phone
    )
    notifiedPhoneForLead = notifyPhone || null

    if (notifyPhone) {
      try {
        await sendMetaWhatsAppTextMessage({
          to: notifyPhone,
          text: buildInternalNotification({
            contactPhone,
            contactName,
            recipientName: recipient?.recipient_name || null,
            campaignName: campaign?.name || null,
            templateName: campaign?.template_name || null,
            responseText: rawText,
            leadStage: agentResponse?.leadStage || null,
            summary: agentResponse?.summary || null,
            agentReply: replyText,
            reason: effectiveReason,
          }),
          phoneNumberId: phoneNumberId || undefined,
          config: configMap,
        })
        notifiedStatus = 'sent'
        await updateReplyIntent(supabase, intentRow?.id, {
          notified_status: 'sent',
          notified_phone: notifyPhone,
          notified_at: isoNow(),
          notified_error: null,
        })
      } catch (error) {
        notifiedStatus = 'failed'
        await updateReplyIntent(supabase, intentRow?.id, {
          notified_status: 'failed',
          notified_phone: notifyPhone,
          notified_error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
        })
      }
    }
  }

  if (recipientId) {
    await supabase
      .from('meta_whatsapp_campaign_recipients')
      .update({
        metadata: {
          ...(recipient?.metadata || {}),
          meta_reply_triage: {
            intent: classification.intent,
            source: classification.source,
            effective_intent: effectiveIntent,
            confidence: effectiveConfidence,
            classifier: effectiveClassifier,
            reason: effectiveReason,
            ai_provider: effectiveAiProvider,
            ai_model: effectiveAiModel,
            ai_warnings: combinedWarnings,
            intent_id: intentRow?.id || null,
            agent: agentResponse ? {
              reply: agentResponse.reply,
              should_notify: agentResponse.shouldNotify,
              should_close: agentResponse.shouldClose,
              lead_name: agentResponse.leadName,
              lead_stage: agentResponse.leadStage,
              summary: agentResponse.summary,
            } : null,
            at: isoNow(),
          },
        },
      })
      .eq('id', recipientId)
  }

  await updateLeadWithAgentSignal({
    supabase,
    conversation,
    contactPhone,
    contactName,
    campaignName: campaign?.name || null,
    templateName: campaign?.template_name || null,
    rawText,
    effectiveIntent,
    confidence: effectiveConfidence,
    notifiedStatus,
    notifiedPhone: notifiedPhoneForLead,
    agentResponse,
    reason: effectiveReason,
  }).catch(() => undefined)

  return {
    intent: effectiveIntent,
    campaignId,
    recipientId,
    classifier: effectiveClassifier,
    autoReplyStatus: replyText ? 'processed' : 'skipped',
    notifiedStatus,
  }
}

type ReplyIntentRow = Record<string, any>

function incrementReplyGroup(map: Map<string, ReplyIntentRow>, key: string, reply: ReplyIntentRow) {
  const intent = String(reply.intent || 'unknown')
  const existing = map.get(key) || {
    key,
    campaign_id: reply.campaign_id || null,
    campaign_name: reply.campaign_name || '',
    template_name: reply.template_name || '',
    count: 0,
    interested: 0,
    optOut: 0,
    question: 0,
    unknown: 0,
    lastSeenAt: null,
  }

  existing.count += 1
  if (intent === 'interested') existing.interested += 1
  else if (intent === 'opt_out') existing.optOut += 1
  else if (intent === 'question') existing.question += 1
  else existing.unknown += 1

  const createdAt = reply.created_at ? String(reply.created_at) : ''
  if (createdAt && (!existing.lastSeenAt || new Date(createdAt).getTime() > new Date(String(existing.lastSeenAt)).getTime())) {
    existing.lastSeenAt = createdAt
  }

  map.set(key, existing)
}

function buildReplyIntentSummary(replies: ReplyIntentRow[]) {
  const byTemplate = new Map<string, ReplyIntentRow>()
  const byCampaign = new Map<string, ReplyIntentRow>()
  const byIntent: Record<string, number> = {}

  for (const reply of replies) {
    const intent = String(reply.intent || 'unknown')
    byIntent[intent] = (byIntent[intent] || 0) + 1
    incrementReplyGroup(byTemplate, String(reply.template_name || 'Sem template'), reply)
    incrementReplyGroup(byCampaign, String(reply.campaign_id || reply.campaign_name || 'Sem campanha'), reply)
  }

  return {
    total: replies.length,
    interested: byIntent.interested || 0,
    optOut: byIntent.opt_out || 0,
    question: byIntent.question || 0,
    unknown: byIntent.unknown || 0,
    autoRepliesSent: replies.filter(reply => reply.auto_reply_status === 'sent').length,
    autoRepliesFailed: replies.filter(reply => reply.auto_reply_status === 'failed').length,
    notificationsSent: replies.filter(reply => reply.notified_status === 'sent').length,
    notificationsFailed: replies.filter(reply => reply.notified_status === 'failed').length,
    byIntent,
    byTemplate: Array.from(byTemplate.values()).sort((a, b) => Number(b.count || 0) - Number(a.count || 0)),
    byCampaign: Array.from(byCampaign.values()).sort((a, b) => Number(b.count || 0) - Number(a.count || 0)),
  }
}

export async function listMetaWhatsAppReplyIntents(
  input: {
    campaignId?: string | null
    intent?: ReplyIntent | string | null
    limit?: number
  } = {},
  supabase = createAdminClient()
) {
  const limit = Math.min(Math.max(Number(input.limit || 200), 1), 500)
  let query = supabase
    .from('meta_whatsapp_reply_intents')
    .select(`
      id,
      conversation_id,
      message_id,
      event_id,
      campaign_id,
      recipient_id,
      sender_id,
      phone_number_id,
      provider_message_id,
      contact_phone,
      contact_name,
      intent,
      confidence,
      source,
      button_text,
      button_payload,
      raw_text,
      campaign_name,
      template_name,
      auto_reply_status,
      auto_reply_message,
      auto_reply_error,
      notified_status,
      notified_phone,
      notified_at,
      notified_error,
      metadata,
      created_at,
      updated_at
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (input.campaignId) query = query.eq('campaign_id', input.campaignId)
  if (input.intent) query = query.eq('intent', input.intent)

  const { data, error } = await query
  if (error) throw error

  const replies = Array.isArray(data) ? data as ReplyIntentRow[] : []
  return {
    replies,
    summary: buildReplyIntentSummary(replies),
  }
}
