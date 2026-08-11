import { createAdminClient } from '@/lib/supabase/server'
import {
  loadMetaWhatsAppConfigMap,
  normalizeMetaWhatsAppPhone,
  sendMetaWhatsAppTextMessage,
} from '@/lib/meta/whatsapp-cloud'
import { sendMetaWhatsAppChatReply } from '@/lib/meta/whatsapp-chat'
import { getAIConfig, getActiveAIProvider, getOpenAIApiKey } from '@/lib/ai/config'
import { chatWithGemini, getGeminiApiKey, getGeminiModel } from '@/lib/gemini'

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

const DEFAULT_TRIAGE_AI_PROMPT = [
  'Voce e um agente de triagem de respostas de campanhas oficiais de WhatsApp da imobiliaria.',
  'Sua tarefa e classificar a intencao do lead sem entregar detalhes do imovel, campanha, preco ou oferta.',
  'Retorne somente JSON valido, sem markdown, neste formato:',
  '{"intent":"interested|opt_out|question|unknown","confidence":0-100,"reason":"motivo curto"}',
  '',
  'Regras:',
  '- interested: o lead pede "saiba mais", quer detalhes, pergunta valor, agenda visita, pede atendimento ou demonstra curiosidade positiva.',
  '- opt_out: o lead pede para sair, parar, remover, apagar dados, nao receber mais, ou expressa rejeicao clara.',
  '- question: o lead pergunta sobre origem do contato, privacidade, cadastro ou dados, sem pedir remocao e sem demonstrar interesse.',
  '- unknown: mensagens vagas, saudacoes soltas ou textos sem decisao operacional.',
  'Quando houver interesse misturado com duvida, prefira interested. Quando houver pedido de remocao, sempre prefira opt_out.',
].join('\n')

function cleanText(value: unknown, maxLength = 300) {
  return String(value || '').trim().slice(0, maxLength)
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
    'pode chamar',
    'me chama',
    'chama no whatsapp',
    'quero sim',
    'sim tenho',
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

  if (includesAny(combined, interestedPatterns)) {
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

  if (includesAny(combined, privacyPatterns)) {
    return {
      intent: 'question',
      confidence: 72,
      source,
      buttonText: button.text || null,
      buttonPayload: button.payload || null,
      rawText: rawText || null,
      classifier: 'rules',
      reason: 'Pergunta sobre origem do contato ou privacidade identificada por regra.',
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

function templateReply(config: Record<string, string | undefined>, key: string, fallback: string) {
  return cleanText(config[key], 600) || fallback
}

function buildInternalNotification(input: {
  contactPhone: string
  contactName?: string | null
  recipientName?: string | null
  campaignName?: string | null
  templateName?: string | null
  responseText?: string | null
  reason?: string | null
}) {
  const name = cleanText(input.contactName || input.recipientName, 160) || 'Nao informado'
  const response = cleanText(input.responseText, 500) || '-'
  const reason = cleanText(input.reason, 240)

  return [
    'Novo lead interessado no WhatsApp Meta',
    '',
    `Nome: ${name}`,
    `Telefone: +${input.contactPhone}`,
    `Campanha: ${cleanText(input.campaignName, 160) || '-'}`,
    `Template: ${cleanText(input.templateName, 160) || '-'}`,
    `Resposta: ${response}`,
    reason ? `Motivo: ${reason}` : null,
    '',
    'Origem: Campanhas Meta WhatsApp',
  ].filter(Boolean).join('\n')
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
      intent: classification.intent,
      confidence: classification.confidence,
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
          classifier: classification.classifier,
          reason: classification.reason || null,
          ai_provider: classification.aiProvider || null,
          ai_model: classification.aiModel || null,
          ai_warnings: classification.aiWarnings || [],
        },
      },
      created_at: receivedAt,
    })
    .select('*')
    .single()

  if (intentError) throw intentError

  if (classification.intent === 'opt_out') {
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

  let replyText = ''
  if (classification.intent === 'interested') {
    replyText = templateReply(
      configMap,
      'meta_whatsapp_triage_interest_reply',
      'Perfeito. Vou encaminhar seu contato para um especialista da nossa equipe dar continuidade ao atendimento.'
    )
  } else if (classification.intent === 'opt_out') {
    replyText = templateReply(
      configMap,
      'meta_whatsapp_triage_opt_out_reply',
      'Pronto. Removemos seu contato da nossa lista. Voce nao recebera novas campanhas por este canal.'
    )
  } else if (classification.intent === 'question') {
    replyText = templateReply(
      configMap,
      'meta_whatsapp_triage_privacy_reply',
      'Voce estava em nossa base de contatos de campanhas anteriores da imobiliaria. Se quiser sair da lista, responda SAIR que removemos seu contato.'
    )
  }

  if (replyText && conversation?.id) {
    try {
      await sendMetaWhatsAppChatReply({
        conversationId: String(conversation.id),
        text: replyText,
      }, supabase)
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

  if (classification.intent === 'opt_out' && conversation?.id) {
    await supabase
      .from('meta_whatsapp_conversations')
      .update({
        status: 'closed',
        unread_count: 0,
        metadata: {
          ...(conversation.metadata || {}),
          triage: {
            intent: classification.intent,
            intent_id: intentRow?.id || null,
            at: isoNow(),
          },
        },
      })
      .eq('id', conversation.id)
  }

  let notifiedStatus: 'skipped' | 'sent' | 'failed' = 'skipped'
  if (classification.intent === 'interested') {
    const notifyPhone = normalizeMetaWhatsAppPhone(
      configMap.meta_whatsapp_triage_interest_notify_phone
      || configMap.meta_whatsapp_support_redirect_phone
    )

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
            reason: classification.reason || null,
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
            confidence: classification.confidence,
            classifier: classification.classifier,
            reason: classification.reason || null,
            ai_provider: classification.aiProvider || null,
            ai_model: classification.aiModel || null,
            ai_warnings: classification.aiWarnings || [],
            intent_id: intentRow?.id || null,
            at: isoNow(),
          },
        },
      })
      .eq('id', recipientId)
  }

  return {
    intent: classification.intent,
    campaignId,
    recipientId,
    classifier: classification.classifier,
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
