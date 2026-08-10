import { recordAgentCentralSignal } from '@/lib/intelligence/agent-runtime'
import { sendWhatsAppMessage } from '@/lib/connectyhub/whatsapp'
import { generateChatResponse } from '@/lib/ai/generation'

type SupabaseLike = {
  from: (table: string) => any
}

type FinanceEntityType = 'pf' | 'pj'
type FinanceCounterpartyType = 'pessoa_fisica' | 'pessoa_juridica'
type FinanceAssistantAction =
  | 'query_payables'
  | 'ask_missing'
  | 'awaiting_confirmation'
  | 'expense_created'
  | 'payables_created'
  | 'cancelled'
  | 'not_understood'

type FinanceDraftKind = 'paid_expense' | 'payable_installments'

type FinanceDraft = {
  kind: FinanceDraftKind
  amount?: number | null
  installment_count?: number | null
  entity_type?: FinanceEntityType | null
  entity_id?: string | null
  entity_name?: string | null
  counterparty_type?: FinanceCounterpartyType | null
  description?: string | null
  counterparty_name?: string | null
  category?: string | null
  subcategory?: string | null
  payment_method?: string | null
  cost_center_id?: string | null
  cost_center?: string | null
  payment_status?: 'paid' | 'pending' | 'cancelled' | null
  entry_date?: string | null
  due_date?: string | null
  first_due_date?: string | null
  competence_date?: string | null
  attachment_url?: string | null
  media_filename?: string | null
  source_text?: string | null
  media_analysis?: string | null
  requested_category?: string | null
  requested_subcategory?: string | null
  requested_payment_method?: string | null
  requested_counterparty?: string | null
  requested_cost_center?: string | null
  operational_tags?: string[]
  category_creation?: {
    category?: string | null
    subcategory?: string | null
    needs_confirmation?: boolean
  } | null
  payment_method_creation?: {
    name?: string | null
    needs_confirmation?: boolean
  } | null
  counterparty_creation?: {
    name?: string | null
    party_type?: FinanceCounterpartyType | null
    needs_confirmation?: boolean
  } | null
  cost_center_creation?: {
    name?: string | null
    needs_confirmation?: boolean
  } | null
}

type PendingFinanceAction = {
  assistant_action: 'global_finance'
  draft: FinanceDraft
  awaiting_confirmation?: boolean
  missing_fields?: string[]
  source_command_id?: string | null
  updated_at?: string
}

type FinanceState = {
  pending_action?: PendingFinanceAction | null
  last_action?: string | null
  last_entry_id?: string | null
  last_payable_ids?: string[]
  last_error?: string | null
}

type DateWindow = {
  label: string
  startDate: string
  endDate: string
  includeOverdue: boolean
}

type GlobalFinanceContextIntent =
  | 'query_payables'
  | 'create_or_update_finance_record'
  | 'finance_question'
  | 'not_finance'

export type GlobalFinanceContextDecision = {
  isFinance: boolean
  intent: GlobalFinanceContextIntent
  confidence: number
  reason?: string | null
  dateWindow?: 'today' | 'tomorrow' | 'week' | 'month' | 'overdue' | null
  interpretedText?: string | null
  source: 'pending_finance_state' | 'media_context' | 'ai' | 'deterministic'
}

type ProcessPilgerFinanceCommandParams = {
  supabase: SupabaseLike
  command: any
  instance?: any
  instanceToken?: string | null
  sendResponse?: boolean
}

export type ProcessPilgerFinanceCommandResult = {
  handled: boolean
  whatsappSent: boolean
  action?: FinanceAssistantAction
  awaitingField?: string
  missingFields?: string[]
  counterpartyType?: FinanceCounterpartyType
  pendingCommandId?: string | null
  financeActionId?: string | null
  financeEntryId?: string | null
  financePayableIds?: string[]
  responseText?: string | null
  error?: string
}

type FinanceEntrySchema = {
  dateField: 'entry_date' | 'date' | 'occurred_at' | 'created_at'
  hasOccurredAt: boolean
  hasCategory: boolean
  hasSubcategory: boolean
  hasPaymentMethod: boolean
  hasPaymentStatus: boolean
  hasCounterpartyName: boolean
  hasCounterpartyType: boolean
  hasReferenceCompany: boolean
  hasDueDate: boolean
  hasCompetenceDate: boolean
  hasCostCenterId: boolean
  hasBankAccountId: boolean
  hasEntityId: boolean
  hasSourceModule: boolean
  hasExternalReference: boolean
  hasNotes: boolean
  hasAttachmentUrl: boolean
  hasCreatedBy: boolean
  hasUpdatedAt: boolean
}

type FinancePayablesSchema = {
  hasDescription: boolean
  hasAmount: boolean
  hasDueDate: boolean
  hasCompetenceDate: boolean
  hasStatus: boolean
  hasCategory: boolean
  hasSubcategory: boolean
  hasCounterpartyName: boolean
  hasCounterpartyType: boolean
  hasPaymentMethod: boolean
  hasCostCenterId: boolean
  hasBankAccountId: boolean
  hasNotes: boolean
  hasEntityId: boolean
  hasCreatedBy: boolean
  hasUpdatedAt: boolean
  hasPaidAmount: boolean
}

type FinanceCatalogStatus = {
  draft: FinanceDraft
  needsConfirmation: boolean
  categoryCreated?: boolean
  subcategoryCreated?: boolean
  paymentMethodCreated?: boolean
  counterpartyCreated?: boolean
  costCenterCreated?: boolean
}

type FinanceTagCatalogResult = {
  ids: string[]
  createdCount: number
}

const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo'
const GLOBAL_FINANCE_STATE_KEY = 'finance_assistant'
const GENERIC_DESCRIPTIONS = new Set([
  'despesa enviada pelo whatsapp',
  'comprovante recebido',
  'pagamento informado pelo whatsapp',
  'pagamento parcelado informado pelo whatsapp',
])

function cleanString(value: unknown, max = 1200) {
  const text = String(value || '').trim().replace(/\s+/g, ' ')
  return text.length > max ? text.slice(0, max) : text
}

function normalizeText(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s.,/:-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatCurrencyBR(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0))
}

function saoPauloDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value || 0)
  return { year: get('year'), month: get('month'), day: get('day') }
}

function dateKeyFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function saoPauloDateKey(date = new Date()) {
  const parts = saoPauloDateParts(date)
  return dateKeyFromParts(parts.year, parts.month, parts.day)
}

function dateFromKey(dateKey: string) {
  const [year, month, day] = String(dateKey || '').split('-').map(Number)
  return new Date(Date.UTC(year || 1970, (month || 1) - 1, day || 1, 12, 0, 0))
}

function addDays(dateKey: string, days: number) {
  const date = dateFromKey(dateKey)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function addMonthsWithDay(baseDateKey: string, monthOffset: number, requestedDay: number) {
  const [baseYear, baseMonth] = baseDateKey.split('-').map(Number)
  const zeroBased = (baseMonth || 1) - 1 + monthOffset
  const year = (baseYear || 1970) + Math.floor(zeroBased / 12)
  const month = ((zeroBased % 12) + 12) % 12 + 1
  const day = Math.min(Math.max(1, requestedDay), daysInMonth(year, month))
  return dateKeyFromParts(year, month, day)
}

function nextMonthlyDate(dayOfMonth: number, forceNextMonth = false) {
  const today = saoPauloDateKey()
  const todayParts = saoPauloDateParts()
  const offset = forceNextMonth || dayOfMonth < todayParts.day ? 1 : 0
  return addMonthsWithDay(today, offset, dayOfMonth)
}

function parseDateFromText(text: unknown): string | null {
  const raw = String(text || '')
  const normalized = normalizeText(raw)
  const today = saoPauloDateKey()
  if (/\bhoje\b/.test(normalized)) return today
  if (/\bamanha\b/.test(normalized)) return addDays(today, 1)

  const match = raw.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/)
  if (!match) return null

  const day = Number(match[1])
  const month = Number(match[2])
  const yearRaw = match[3] ? Number(match[3]) : Number(today.slice(0, 4))
  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000) return null
  return dateKeyFromParts(year, month, day)
}

function parseBrazilianNumber(raw: string): number | null {
  let value = String(raw || '')
    .replace(/r\$/gi, '')
    .replace(/\s+/g, '')
    .trim()
  if (!value) return null

  const multiplier = /\b(mil|k)\b/i.test(raw) ? 1000 : 1
  value = value.replace(/\b(mil|k)\b/gi, '')

  if (value.includes(',')) {
    value = value.replace(/\./g, '').replace(',', '.')
  } else if ((value.match(/\./g) || []).length > 1) {
    value = value.replace(/\./g, '')
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Number((parsed * multiplier).toFixed(2))
}

function extractMoneyValues(text: unknown): number[] {
  const source = String(text || '')
  const values: number[] = []
  const seen = new Set<string>()
  const patterns = [
    /r\$\s*\d[\d.\s]*(?:,\d{1,2})?(?:\s*(?:mil|k))?/gi,
    /\b\d+(?:[.,]\d+)?\s*(?:mil|k)\b/gi,
    /\b\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?\b/g,
    /\b\d+[,.]\d{2}\b/g,
  ]

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const parsed = parseBrazilianNumber(match[0])
      if (!parsed) continue
      const key = parsed.toFixed(2)
      if (seen.has(key)) continue
      seen.add(key)
      values.push(parsed)
    }
  }

  return values
}

function extractAmountFromText(text: unknown, previous?: number | null) {
  const source = String(text || '')
  const perInstallment = source.match(/\bparcelas?\s+de\s+(r\$\s*)?(\d[\d.\s]*(?:,\d{1,2})?|\d+(?:[.,]\d+)?\s*(?:mil|k))\b/i)
  if (perInstallment) {
    const parsed = parseBrazilianNumber(perInstallment[2])
    if (parsed) return parsed
  }

  const values = extractMoneyValues(source)
  if (values.length > 0) return values[0]
  return previous || null
}

function detectEntityType(text: unknown): FinanceEntityType | null {
  const normalized = normalizeText(text)
  if (/\b(pj|cnpj|pessoa juridica|juridica|empresa|imobiliaria|finance_party_pj)\b/.test(normalized)) return 'pj'
  if (/\b(pf|cpf|pessoa fisica|fisica|pessoal|meu carro|minha pessoa|finance_party_pf)\b/.test(normalized)) return 'pf'
  return null
}

function entityTypeToCounterpartyType(entityType?: FinanceEntityType | null): FinanceCounterpartyType {
  return entityType === 'pf' ? 'pessoa_fisica' : 'pessoa_juridica'
}

function cleanupCatalogName(value: unknown, max = 90) {
  const cleaned = cleanString(value, max)
    .replace(/\b(via|no|na|em|com|pela|pelo|para|por|dia|vencimento|valor|r\$|pf|pj|cnpj|cpf|pessoa fisica|pessoa juridica).*$/i, '')
    .replace(/[.,;:]+$/g, '')
    .trim()
  if (cleaned.length < 2) return null
  return sentenceCase(cleaned)
}

function canonicalPaymentMethod(value: unknown) {
  const normalized = normalizeText(value)
  if (!normalized) return null
  if (/\b(mercado pago|mercadopago)\b/.test(normalized)) return normalized.includes('pix') ? 'Mercado Pago Pix' : 'Mercado Pago'
  if (/\bpix\b/.test(normalized)) return 'PIX'
  if (/\b(cartao|credito|debito|visa|mastercard|elo)\b/.test(normalized)) return 'Cartao'
  if (/\b(boleto|linha digitavel)\b/.test(normalized)) return 'Boleto'
  if (/\bted\b/.test(normalized)) return 'TED'
  if (/\bdoc\b/.test(normalized)) return 'DOC'
  if (/\b(dinheiro|especie)\b/.test(normalized)) return 'Dinheiro'
  return cleanupCatalogName(value, 70)
}

function extractExplicitPaymentMethod(text: unknown) {
  const raw = cleanString(text, 1200)
  const patterns = [
    /\b(?:forma de pagamento|metodo de pagamento|meio de pagamento)\s+([\p{L}0-9\s&.-]{2,70})/iu,
    /\b(?:paguei|pago|pagamento|quitado)\s+(?:via|no|na|pelo|pela)\s+([\p{L}0-9\s&.-]{2,70})/iu,
    /\b(?:via|no|na|pelo|pela)\s+(pix|cartao|cartao de credito|cartao de debito|boleto|ted|doc|dinheiro|mercado pago(?: pix)?|stone|cielo|sicredi|itau|bradesco|santander|nubank)\b/iu,
  ]
  for (const pattern of patterns) {
    const candidate = canonicalPaymentMethod(raw.match(pattern)?.[1])
    if (candidate) return candidate
  }
  return null
}

function detectPaymentMethod(text: unknown): string | null {
  const normalized = normalizeText(text)
  const explicit = extractExplicitPaymentMethod(text)
  if (explicit) return explicit
  if (/\bpix\b/.test(normalized)) return 'PIX'
  if (/\b(cartao|credito|debito|visa|mastercard|elo)\b/.test(normalized)) return 'Cartao'
  if (/\b(boleto|linha digitavel)\b/.test(normalized)) return 'Boleto'
  if (/\b(ted)\b/.test(normalized)) return 'TED'
  if (/\b(doc)\b/.test(normalized)) return 'DOC'
  if (/\b(dinheiro|especie)\b/.test(normalized)) return 'Dinheiro'
  return null
}

function knownCounterpartyFromText(text: unknown) {
  const normalized = normalizeText(text)
  if (/\bunifique\b/.test(normalized)) return 'Unifique'
  if (/\bcelesc\b/.test(normalized)) return 'Celesc'
  if (/\bcasan\b/.test(normalized)) return 'Casan'
  if (/\bvivo\b/.test(normalized)) return 'Vivo'
  if (/\bclaro\b/.test(normalized)) return 'Claro'
  if (/\btim\b/.test(normalized)) return 'TIM'
  return null
}

function looksLikeUtilityBill(text: unknown) {
  return /\b(unifique|internet|telefone|telefonia|fibra|banda larga|celesc|energia|luz|casan|agua|saneamento)\b/.test(normalizeText(text))
}

function shouldIgnoreDocumentCardPayment(method: string | null, allText: unknown, userText: unknown) {
  if (method !== 'Cartao') return false
  if (!looksLikeUtilityBill(allText)) return false
  const userNormalized = normalizeText(userText)
  return !/\b(paguei|pagamento|quitado|foi|vai|lanca|lancar)\b.{0,80}\b(cartao|credito|debito)\b/.test(userNormalized)
}

function detectCategory(text: unknown) {
  const normalized = normalizeText(text)
  if (/\b(padaria|bakery|mercado|supermercado|restaurante|lanchonete|cafe|almoco|jantar|alimentacao)\b/.test(normalized)) {
    return {
      category: 'Consumo despesas',
      subcategory: 'Alimentacao',
      description: /\bpadaria\b/.test(normalized) ? 'Compra em padaria' : 'Despesa de alimentacao',
      counterpartyName: null,
      known: true,
    }
  }
  if (/\b(abastec|combustivel|gasolina|etanol|diesel|posto)\b/.test(normalized)) {
    return {
      category: 'Consumo despesas',
      subcategory: 'Combustivel',
      description: 'Abastecimento do carro',
      counterpartyName: 'Posto de combustivel',
      known: true,
    }
  }
  if (/\b(unifique|internet|telefone|telefonia|celular|fibra|banda larga|vivo|claro|tim)\b/.test(normalized)) {
    const counterpartyName = knownCounterpartyFromText(normalized)
    return {
      category: 'Custos Fixos',
      subcategory: 'Internet',
      description: counterpartyName ? `Pagamento de internet - ${counterpartyName}` : 'Pagamento de internet/telefonia',
      counterpartyName,
      known: true,
    }
  }
  if (/\b(energia|luz|agua|saneamento|celesc|casan)\b/.test(normalized)) {
    return {
      category: 'Custos Fixos',
      subcategory: /\b(agua|saneamento|casan)\b/.test(normalized) ? 'Agua' : 'Energia',
      description: /\b(agua|saneamento|casan)\b/.test(normalized) ? 'Pagamento de agua' : 'Pagamento de energia',
      counterpartyName: null,
      known: true,
    }
  }
  if (/\b(cartao|fatura)\b/.test(normalized)) {
    return {
      category: 'Custos Fixos',
      subcategory: 'Cartao',
      description: 'Pagamento de cartao de credito',
      counterpartyName: 'Cartao de credito',
      known: true,
    }
  }
  if (/\b(alugue(?:l|is)|locacao)\b/.test(normalized)) {
    return {
      category: 'Custos Fixos',
      subcategory: 'Aluguel',
      description: 'Pagamento de aluguel',
      counterpartyName: null,
      known: true,
    }
  }
  if (/\b(contador|contabilidade|honorario contabil)\b/.test(normalized)) {
    return {
      category: 'Custos Fixos',
      subcategory: 'Contabilidade',
      description: 'Pagamento de contabilidade',
      counterpartyName: null,
      known: true,
    }
  }
  if (/\b(cartorio|registro|certidao|reconhecimento de firma)\b/.test(normalized)) {
    return {
      category: 'Juridico',
      subcategory: 'Cartorio',
      description: 'Despesa de cartorio',
      counterpartyName: null,
      known: true,
    }
  }
  if (/\b(material de escritorio|papelaria|impressao|toner|moveis|mesa|cadeira)\b/.test(normalized)) {
    return {
      category: 'Estrutura',
      subcategory: /\b(moveis|mesa|cadeira)\b/.test(normalized) ? 'Moveis loja' : 'Administrativo',
      description: 'Despesa de estrutura',
      counterpartyName: null,
      known: true,
    }
  }
  if (/\b(boleto)\b/.test(normalized)) {
    return {
      category: 'Custos Fixos',
      subcategory: 'Boleto',
      description: 'Pagamento de boleto',
      counterpartyName: null,
      known: true,
    }
  }
  if (/\b(meta|google ads|trafego|campanha)\b/.test(normalized)) {
    return {
      category: 'Marketing',
      subcategory: normalized.includes('google') ? 'Google Ads' : 'Meta Ads',
      description: 'Despesa de trafego pago',
      counterpartyName: normalized.includes('google') ? 'Google Ads' : 'Meta Ads',
      known: true,
    }
  }
  return {
    category: 'Consumo despesas',
    subcategory: 'Comprovante recebido',
    description: 'Despesa enviada pelo WhatsApp',
    counterpartyName: null,
    known: false,
  }
}

function cleanupClassificationName(value: unknown) {
  const cleaned = cleanString(value, 90)
    .replace(/\b(no|na|em|com|pela|pelo|para|por|dia|vencimento|valor|r\$|pf|pj|cnpj|cpf|pessoa fisica|pessoa juridica).*$/i, '')
    .replace(/[.,;:]+$/g, '')
    .trim()
  if (cleaned.length < 3) return null
  return sentenceCase(cleaned)
}

function extractExplicitClassification(text: unknown, fallbackCategory: boolean) {
  const raw = cleanString(text, 1200)
  const categoryMatch = raw.match(/\b(?:categoria financeira|classificacao financeira|classificar em|classifique em|categoria|classificacao)\s+([\p{L}0-9\s&.-]{3,90})/iu)
  const subcategoryMatch = raw.match(/\b(?:subcategoria|sub categoria)\s+([\p{L}0-9\s&.-]{3,90})/iu)
  const comoMatch = fallbackCategory
    ? raw.match(/\bcomo\s+([\p{L}0-9\s&.-]{3,90})/iu)
    : null

  return {
    category: cleanupClassificationName(categoryMatch?.[1]),
    subcategory: cleanupClassificationName(subcategoryMatch?.[1] || comoMatch?.[1]),
  }
}

function extractInstallmentCount(text: unknown): number | null {
  const normalized = normalizeText(text)
  const match = normalized.match(/\b(?:em\s+)?(\d{1,2})\s*(?:parcelas?|vezes)\b/)
  if (!match) return null
  const count = Number(match[1])
  return Number.isFinite(count) && count >= 2 && count <= 60 ? count : null
}

function extractMonthlyDueDay(text: unknown): number | null {
  const normalized = normalizeText(text)
  const match = normalized.match(/\bdia\s+(\d{1,2})\b/)
  if (!match) return null
  const day = Number(match[1])
  return Number.isFinite(day) && day >= 1 && day <= 31 ? day : null
}

function detectQueryWindow(text: unknown): DateWindow | null {
  const normalized = normalizeText(text)
  const createVerb = /\b(lanca|lancar|lance|cria|criar|cadastro|cadastra|registrar|registra|inclui|incluir)\b/.test(normalized)
  const queryVerb = /\b(o que|quais|qual|listar|lista|mostra|mostre|consulta|consultar|ver|veja|vencem|vencendo|tenho que pagar|tem que pagar)\b/.test(normalized)
  const payableWords = /\b(pagar|contas a pagar|vencimento|vencimentos|boleto|boletos|fatura|faturas|pagamentos)\b/.test(normalized)
  if (createVerb || !queryVerb || !payableWords) return null

  const today = saoPauloDateKey()
  if (/\bamanha\b/.test(normalized)) {
    const tomorrow = addDays(today, 1)
    return { label: `amanha (${formatDateBR(tomorrow)})`, startDate: tomorrow, endDate: tomorrow, includeOverdue: true }
  }
  if (/\b(semana|proximos 7 dias|proximos sete dias)\b/.test(normalized)) {
    return { label: `nos proximos 7 dias`, startDate: today, endDate: addDays(today, 7), includeOverdue: true }
  }
  if (/\b(mes|este mes|mes atual)\b/.test(normalized)) {
    const parts = saoPauloDateParts()
    const endDay = daysInMonth(parts.year, parts.month)
    return {
      label: `este mes`,
      startDate: today,
      endDate: dateKeyFromParts(parts.year, parts.month, endDay),
      includeOverdue: true,
    }
  }
  if (/\batrasad/.test(normalized)) {
    return { label: 'atrasadas', startDate: today, endDate: today, includeOverdue: true }
  }
  return { label: `hoje (${formatDateBR(today)})`, startDate: today, endDate: today, includeOverdue: true }
}

function queryWindowFromContext(value?: string | null): DateWindow | null {
  const today = saoPauloDateKey()
  if (value === 'tomorrow') {
    const tomorrow = addDays(today, 1)
    return { label: `amanha (${formatDateBR(tomorrow)})`, startDate: tomorrow, endDate: tomorrow, includeOverdue: true }
  }
  if (value === 'week') {
    return { label: 'nos proximos 7 dias', startDate: today, endDate: addDays(today, 7), includeOverdue: true }
  }
  if (value === 'month') {
    const parts = saoPauloDateParts()
    return {
      label: 'este mes',
      startDate: today,
      endDate: dateKeyFromParts(parts.year, parts.month, daysInMonth(parts.year, parts.month)),
      includeOverdue: true,
    }
  }
  if (value === 'overdue') {
    return { label: 'atrasadas', startDate: today, endDate: today, includeOverdue: true }
  }
  if (value === 'today') {
    return { label: `hoje (${formatDateBR(today)})`, startDate: today, endDate: today, includeOverdue: true }
  }
  return null
}

function extractJsonObject(text: unknown): any | null {
  const raw = String(text || '').trim()
  if (!raw) return null
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = fenced || raw
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch {
    return null
  }
}

function normalizeContextIntent(value: unknown): GlobalFinanceContextIntent {
  const normalized = normalizeText(value)
  if (normalized === 'query_payables' || /\b(consulta|consultar|contas a pagar|vencimento|pagar hoje|pagar amanha)\b/.test(normalized)) {
    return 'query_payables'
  }
  if (normalized === 'create_or_update_finance_record' || /\b(lancamento|lancar|criar|parcelas|comprovante|despesa|pagamento)\b/.test(normalized)) {
    return 'create_or_update_finance_record'
  }
  if (normalized === 'finance_question' || /\b(financeir|fluxo|saldo|dre|receita|despesa)\b/.test(normalized)) {
    return 'finance_question'
  }
  return 'not_finance'
}

function normalizeContextDateWindow(value: unknown): GlobalFinanceContextDecision['dateWindow'] {
  const normalized = normalizeText(value)
  if (['today', 'hoje'].includes(normalized)) return 'today'
  if (['tomorrow', 'amanha'].includes(normalized)) return 'tomorrow'
  if (['week', 'semana'].includes(normalized)) return 'week'
  if (['month', 'mes'].includes(normalized)) return 'month'
  if (['overdue', 'atrasadas', 'atrasados'].includes(normalized)) return 'overdue'
  return null
}

function pendingFinanceStateFromSession(session: any): PendingFinanceAction | null {
  const state = session?.state && typeof session.state === 'object' ? session.state : {}
  const financeState = state[GLOBAL_FINANCE_STATE_KEY]
  const pending = financeState?.pending_action
  return pending?.assistant_action === 'global_finance' ? pending : null
}

function sessionTextContext(session: any) {
  const messages = Array.isArray(session?.messages) ? session.messages : []
  return messages
    .slice(-10)
    .map((message: any) => `${message?.role === 'assistant' ? 'Assistente' : 'Usuario'}: ${cleanString(message?.content, 500)}`)
    .filter((line: string) => line.length > 12)
    .join('\n')
}

function mediaContextText(media: any[] | undefined, explicitMediaAnalysis?: string | null) {
  const mediaLines = Array.isArray(media)
    ? media.map((item: any) => [
      item?.filename || item?.fileName || '',
      item?.mime || item?.mimetype || '',
      item?.media_kind || item?.kind || '',
      item?.finance_receipt_analysis?.raw_summary || '',
      item?.finance_receipt_analysis?.description || '',
    ].filter(Boolean).join(' ')).filter(Boolean)
    : []
  return [explicitMediaAnalysis, ...mediaLines].filter(Boolean).map(value => cleanString(value, 900)).join('\n')
}

function looksLikeNonFinanceMediaContext(text: unknown) {
  const normalized = normalizeText(text)
  if (!normalized) return false
  const ordinaryMedia = /\b(foto|imagem|midia|video|arquivo)\b.{0,80}\b(caneca|objeto|ambiente|produto|mesa|sala|paisagem|selfie|rosto|pessoa|decoracao)\b/.test(normalized)
    || /\b(caneca|objeto|ambiente|produto|paisagem|selfie|decoracao)\b/.test(normalized)
  const negativeFinanceDocument = /\b(nao|sem|nenhum|nenhuma|not)\b.{0,90}\b(comprovante|recibo|nota fiscal|boleto|fatura|valor|pagamento|receipt|invoice|amount|payment)\b/.test(normalized)
    || /\bno\s+(receipt|invoice|amount|payment)\b/.test(normalized)
    || /\b(comprovante|recibo|nota fiscal|boleto|fatura|valor|pagamento|receipt|invoice|amount|payment)\b.{0,90}\b(nao|ausente|sem|not|missing|unavailable)\b/.test(normalized)
  return ordinaryMedia || negativeFinanceDocument
}

function deterministicFinanceContext(params: {
  text: string
  hasMedia?: boolean
  mediaText?: string | null
}): GlobalFinanceContextDecision | null {
  const combined = normalizeText([params.text, params.mediaText].filter(Boolean).join('\n'))
  if (!combined && params.hasMedia) return null
  const userText = normalizeText(params.text)
  const userAskedFinance = detectQueryWindow(userText) || looksLikeFinanceCreation(userText, Boolean(params.hasMedia))
  if (params.hasMedia && !userAskedFinance && looksLikeNonFinanceMediaContext(params.mediaText)) {
    return {
      isFinance: false,
      intent: 'not_finance',
      confidence: 0.8,
      reason: 'midia comum sem pedido ou evidencias financeiras',
      dateWindow: null,
      interpretedText: params.text,
      source: 'deterministic',
    }
  }

  if (detectQueryWindow(combined)) {
    return {
      isFinance: true,
      intent: 'query_payables',
      confidence: 0.82,
      reason: 'pedido de consulta financeira identificado',
      dateWindow: queryWindowFromContext('today') ? 'today' : null,
      interpretedText: params.text,
      source: 'deterministic',
    }
  }

  if (looksLikeFinanceCreation(combined, Boolean(params.hasMedia))) {
    return {
      isFinance: true,
      intent: 'create_or_update_finance_record',
      confidence: 0.78,
      reason: 'pedido de lancamento ou comprovante financeiro identificado',
      dateWindow: null,
      interpretedText: params.text,
      source: 'deterministic',
    }
  }

  return null
}

function isSimpleInternalSmallTalk(text: unknown) {
  const normalized = normalizeText(text)
  if (!normalized) return false
  const hasGreeting = /\b(bom dia|boa tarde|boa noite|oi|ola|tudo bem|td bem|como vai|beleza|obrigad|valeu)\b/.test(normalized)
  if (!hasGreeting) return false
  if (/\b(lanca|lancar|pagar|paguei|pagamento|comprovante|boleto|fatura|cartao|financeiro|categoria|subcategoria|trafego|blog|noticia|imovel|relatorio|crm|lead)\b/.test(normalized)) {
    return false
  }
  return normalized.length <= 90
}

export function buildGlobalFinanceOnlyReply(identityLabel: unknown, requestedArea?: string | null, messageText?: string | null) {
  if (isSimpleInternalSmallTalk(messageText)) {
    return [
      `Oi, ${firstName(identityLabel)}! Tudo bem por aqui.`,
      'E por ai, tudo certo?',
    ].join('\n')
  }

  const area = cleanString(requestedArea, 80)
  return [
    `${firstName(identityLabel)}, por enquanto deixei o WhatsApp Global interno ativo somente para o financeiro.`,
    area ? `Esse pedido parece ser de ${area.toLowerCase()}, entao nao vou acionar esse setor agora.` : '',
    'Se for uma demanda financeira, pode me mandar em linguagem natural que eu consulto, preparo o lancamento ou pergunto o que faltar.',
  ].filter(Boolean).join('\n')
}

function looksLikeDisabledOperationalRequest(messageText?: string | null, requestedArea?: string | null) {
  const normalized = normalizeText([messageText, requestedArea].filter(Boolean).join(' '))
  return /\b(trafego|campanha|ads|vitor|blog|noticia|imovel|estoque|crm|lead|leads|relatorio|dashboard|agenda)\b/.test(normalized)
}

function isDisabledConfigValue(value: unknown) {
  return ['0', 'false', 'off', 'disabled', 'desligado', 'nao', 'não'].includes(normalizeText(value))
}

function isGlobalInternalLlmDisabled(configs?: Record<string, string>) {
  if (!configs) return false
  return [
    'whatsapp_global_llm_enabled',
    'whatsapp_global_internal_llm_enabled',
    'pilger_finance_llm_enabled',
    'finance_agent_llm_enabled',
  ].some(key => isDisabledConfigValue(configs[key]))
}

function buildGlobalInternalPartnerFallback(identityLabel: unknown, requestedArea?: string | null, messageText?: string | null) {
  const name = firstName(identityLabel)
  if (looksLikeDisabledOperationalRequest(messageText, requestedArea)) {
    return [
      `${name}, entendi.`,
      'Consigo conversar contigo e ajudar a organizar o raciocinio, mas por enquanto nao vou acionar esse setor no sistema.',
      'Se for financeiro, pode me mandar direto que eu consulto ou preparo o lancamento.',
    ].join('\n')
  }

  if (isSimpleInternalSmallTalk(messageText)) {
    return [
      `Oi, ${name}! Tudo bem por aqui.`,
      'E por ai, tudo certo?',
    ].join('\n')
  }

  return [
    `${name}, estou por aqui.`,
    'Pode falar comigo normal que eu vou acompanhando contigo.',
  ].join('\n')
}

export async function buildGlobalInternalPartnerReply(params: {
  identityLabel?: string | null
  messageText?: string | null
  requestedArea?: string | null
  history?: { role: string; content: string }[]
  configs?: Record<string, string>
}) {
  const messageText = cleanString(params.messageText, 1800)
  if (!messageText) return buildGlobalInternalPartnerFallback(params.identityLabel, params.requestedArea, messageText)
  if (isSimpleInternalSmallTalk(messageText)) {
    return buildGlobalInternalPartnerFallback(params.identityLabel, params.requestedArea, messageText)
  }
  if (isGlobalInternalLlmDisabled(params.configs)) {
    return buildGlobalInternalPartnerFallback(params.identityLabel, params.requestedArea, messageText)
  }

  const systemPrompt = [
    'Voce e o WhatsApp Global interno da Pilger.',
    'Converse com integrantes internos como uma secretaria executiva/colega de trabalho: natural, curto, prestativo e humano.',
    'Nunca trate a pessoa interna como lead e nunca qualifique interesse de compra.',
    'Nao puxe o assunto financeiro sozinho. So entre no modo financeiro quando a pessoa falar de pagamento, comprovante, vencimento, conta, categoria, fornecedor, despesa, receita, caixa ou lancamento.',
    'Ferramentas operacionais internas habilitadas agora: financeiro e identificacao do proprio perfil.',
    'Setores como trafego pago, blog, noticias, imoveis, CRM, leads, agenda e relatorios estao desligados para execucao/consulta pelo Global interno neste momento.',
    'Se o usuario pedir uma acao ou consulta real em setor desligado, responda de forma natural que entendeu, mas nao vai acionar esse setor agora. Voce pode ajudar a organizar o pedido ou pensar junto, sem fingir que viu o sistema.',
    'Se for conversa geral, saudacao, alinhamento, brainstorming ou desabafo operacional sem necessidade de sistema, converse normalmente.',
    'Nao mencione financeiro em saudacoes ou conversas gerais se o usuario nao falou disso.',
    'Nao invente dados do sistema, numeros, status, ids, resultados de campanhas, posts, imoveis, leads ou agenda.',
    'Responda somente com o texto final para WhatsApp, em portugues do Brasil, sem markdown longo.',
    `Pessoa interna: ${cleanString(params.identityLabel, 120) || 'integrante interno'}.`,
    params.requestedArea ? `Area detectada pelo roteador: ${cleanString(params.requestedArea, 80)}.` : '',
  ].filter(Boolean).join('\n')

  try {
    const raw = await generateChatResponse(
      (params.history || []).slice(-12),
      messageText,
      systemPrompt,
      {
        provider: params.configs?.ai_provider === 'openai' ? 'openai' : params.configs?.ai_provider === 'gemini' ? 'gemini' : undefined,
        geminiModel: params.configs?.gemini_model || undefined,
        openaiModel: params.configs?.openai_model || undefined,
      },
    )
    const sanitized = cleanString(raw, 1200)
      .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
      .replace(/\[thought\][\s\S]*?\[\/thought\]/gi, '')
      .replace(/Thought:[^\n]*\n?/gi, '')
      .trim()
    return sanitized || buildGlobalInternalPartnerFallback(params.identityLabel, params.requestedArea, messageText)
  } catch (error: any) {
    console.warn('[Pilger Finance] internal partner reply failed:', error?.message || error)
    return buildGlobalInternalPartnerFallback(params.identityLabel, params.requestedArea, messageText)
  }
}

export async function resolveGlobalFinanceContext(params: {
  text?: string | null
  hasMedia?: boolean
  media?: any[]
  mediaAnalysis?: string | null
  session?: any
  identityLabel?: string | null
  configs?: Record<string, string>
}): Promise<GlobalFinanceContextDecision> {
  const text = cleanString(params.text, 3000)
  const pending = pendingFinanceStateFromSession(params.session)
  if (pending) {
    return {
      isFinance: true,
      intent: 'create_or_update_finance_record',
      confidence: 0.96,
      reason: 'existe um rascunho financeiro aguardando continuidade',
      dateWindow: null,
      interpretedText: text,
      source: 'pending_finance_state',
    }
  }

  const mediaText = mediaContextText(params.media, params.mediaAnalysis)
  const deterministic = deterministicFinanceContext({
    text,
    hasMedia: params.hasMedia,
    mediaText,
  })
  if (deterministic?.isFinance === false && deterministic.confidence >= 0.75) return deterministic
  if (isGlobalInternalLlmDisabled(params.configs)) {
    return deterministic || {
      isFinance: false,
      intent: 'not_finance',
      confidence: 0.55,
      reason: 'classificador LLM interno desligado',
      dateWindow: null,
      interpretedText: text || null,
      source: 'deterministic',
    }
  }

  const systemPrompt = [
    'Voce classifica mensagens internas do WhatsApp Global da Pilger.',
    'Os setores internos estao desligados por enquanto, exceto o financeiro.',
    'Sua tarefa nao e responder ao usuario; e decidir se a mensagem deve ir para a assistente financeira.',
    'Use contexto, nao palavras isoladas. Considere historico, continuidade, audio transcrito e leitura de midia.',
    'Financeiro inclui: contas a pagar, contas a receber, vencimentos, boletos, faturas, cartao, comprovantes, despesas, abastecimento, reembolsos, parcelas, lancamentos, fluxo de caixa e duvidas financeiras.',
    'Foto de objeto, ambiente, caneca, produto ou midia comum sem comprovante, valor, pagamento, compra para lancar ou pedido financeiro NAO e financeiro; nesse caso classifique como not_finance.',
    'Se a pessoa enviar um objeto e disser que comprou/quer lancar/cadastrar no financeiro, classifique como financeiro e deixe o executor perguntar valor, PF/PJ, forma de pagamento e categoria quando faltar.',
    'Nao financeiro inclui: trafego pago, blog, noticias, imoveis, CRM, leads, agenda, relatorio comercial e pedidos gerais sem ligacao financeira.',
    'Responda somente JSON valido no formato:',
    '{"is_finance":true,"intent":"query_payables|create_or_update_finance_record|finance_question|not_finance","confidence":0.0,"date_window":"today|tomorrow|week|month|overdue|null","interpreted_text":"resumo curto","reason":"motivo curto"}',
  ].join('\n')

  const prompt = [
    `Usuario: ${cleanString(params.identityLabel, 120) || 'membro interno'}`,
    '',
    params.session ? `Historico recente:\n${sessionTextContext(params.session) || 'sem historico'}` : 'Historico recente: sem historico',
    '',
    `Mensagem atual:\n${text || (params.hasMedia ? '[midia sem texto]' : '')}`,
    mediaText ? `\nContexto de midia/leitura:\n${mediaText}` : '',
  ].filter(Boolean).join('\n')

  try {
    const raw = await generateChatResponse([], prompt, systemPrompt, {
      provider: params.configs?.ai_provider === 'openai' ? 'openai' : params.configs?.ai_provider === 'gemini' ? 'gemini' : undefined,
      geminiModel: params.configs?.gemini_model || undefined,
      openaiModel: params.configs?.openai_model || undefined,
    })
    const parsed = extractJsonObject(raw)
    const intent = normalizeContextIntent(parsed?.intent)
    const confidence = Math.max(0, Math.min(1, Number(parsed?.confidence || 0)))
    if (parsed && intent !== 'not_finance' && parsed.is_finance !== false && confidence >= 0.48) {
      return {
        isFinance: true,
        intent,
        confidence,
        reason: cleanString(parsed.reason, 240) || null,
        dateWindow: normalizeContextDateWindow(parsed.date_window),
        interpretedText: cleanString(parsed.interpreted_text, 600) || text || null,
        source: 'ai',
      }
    }
    if (parsed && parsed.is_finance === false && confidence >= 0.7) {
      return {
        isFinance: false,
        intent: 'not_finance',
        confidence,
        reason: cleanString(parsed.reason, 240) || null,
        dateWindow: null,
        interpretedText: cleanString(parsed.interpreted_text, 600) || text || null,
        source: 'ai',
      }
    }
  } catch (error: any) {
    console.warn('[Pilger Finance] contextual finance classifier failed:', error?.message || error)
  }

  if (deterministic) return deterministic

  return {
    isFinance: false,
    intent: 'not_finance',
    confidence: 0.55,
    reason: 'sem contexto financeiro suficiente',
    dateWindow: null,
    interpretedText: text || null,
    source: 'deterministic',
  }
}

function firstMedia(payload: any) {
  const media = Array.isArray(payload?.media) ? payload.media : []
  return media.find((item: any) => item?.r2_url || item?.stored_url || item?.url || item?.original_url) || null
}

function receiptAnalysisFromPayload(payload: any) {
  if (payload?.receipt_analysis && typeof payload.receipt_analysis === 'object') return payload.receipt_analysis
  if (payload?.finance_receipt_analysis && typeof payload.finance_receipt_analysis === 'object') return payload.finance_receipt_analysis
  const media = firstMedia(payload)
  if (media?.finance_receipt_analysis && typeof media.finance_receipt_analysis === 'object') return media.finance_receipt_analysis
  if (media?.receipt_analysis && typeof media.receipt_analysis === 'object') return media.receipt_analysis
  return null
}

function receiptAnalysisText(receipt: any) {
  if (!receipt || typeof receipt !== 'object') return ''
  return [
    receipt.amount ? `Valor: R$ ${receipt.amount}` : '',
    receipt.date ? `Data principal: ${receipt.date}` : '',
    receipt.due_date ? `Vencimento: ${receipt.due_date}` : '',
    receipt.document_date ? `Emissao: ${receipt.document_date}` : '',
    receipt.merchant ? `Favorecido/fornecedor: ${receipt.merchant}` : '',
    receipt.service_type ? `Servico identificado: ${receipt.service_type}` : '',
    receipt.reference_period ? `Periodo/referencia: ${receipt.reference_period}` : '',
    receipt.description ? `Descricao: ${receipt.description}` : '',
    receipt.payment_method ? `Forma de pagamento: ${receipt.payment_method}` : '',
    receipt.category_hint ? `Categoria: ${receipt.category_hint}` : '',
    receipt.subcategory_hint ? `Subcategoria: ${receipt.subcategory_hint}` : '',
    receipt.document_number ? `Documento: ${receipt.document_number}` : '',
    receipt.raw_summary ? `Resumo: ${receipt.raw_summary}` : '',
  ].filter(Boolean).join('\n')
}

function receiptAmount(receipt: any): number | null {
  const value = Number(receipt?.amount || 0)
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null
}

function receiptDate(receipt: any): string | null {
  const candidates = [
    receipt?.payment_date,
    receipt?.date,
    receipt?.due_date,
    receipt?.document_date,
  ]
  for (const candidate of candidates) {
    const value = cleanString(candidate, 20)
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  }
  return null
}

function payloadMediaText(payload: any) {
  const receipt = receiptAnalysisFromPayload(payload)
  return cleanString([
    payload?.media_analysis || '',
    receiptAnalysisText(receipt),
  ].filter(Boolean).join('\n'), 3000)
}

function extractCounterpartyName(text: unknown): string | null {
  const raw = cleanString(text, 800)
  const patterns = [
    /\b(?:pagamento|paguei|transferencia|pix|boleto)?\s*(?:para|pra|pro|ao|a)\s+(?:o|a|os|as)?\s*([\p{L}0-9\s&.'-]{3,90})/iu,
    /\b(?:favorecido|fornecedor|prestador|beneficiario|empresa)\s*:?\s*(?:o|a|ao|do|da|de)?\s*([\p{L}0-9\s&.'-]{3,90})/iu,
  ]
  for (const pattern of patterns) {
    const match = raw.match(pattern)
    const cleaned = cleanCounterpartyName(match?.[1])
    if (cleaned) return cleaned
  }
  return null
}

function looksLikeBadCounterpartyCandidate(value: unknown) {
  const normalized = normalizeText(value)
  if (!normalized) return true
  if (/^(periodo|data|vencimento|valor|total|dia|forma|pagamento|descricao|categoria|subcategoria|documento|numero|competencia|emissao|conta|codigo|protocolo)\b/.test(normalized)) return true
  if (/^\d+(?:[./-]\d+)*$/.test(normalized)) return true
  return normalized.length < 3
}

function cleanCounterpartyName(value: unknown) {
  const cleaned = cleanupCatalogName(value, 90)
  if (!cleaned || looksLikeBadCounterpartyCandidate(cleaned)) return null
  return cleaned
}

function extractCostCenterName(text: unknown): string | null {
  const raw = cleanString(text, 1000)
  const match = raw.match(/\b(?:centro de custo|projeto|obra|evento)\s+([\p{L}0-9\s&.'-]{3,90})/iu)
  return cleanupCatalogName(match?.[1], 90)
}

function inferCounterpartyType(name: unknown, text: unknown, entityType?: FinanceEntityType | null): FinanceCounterpartyType {
  const normalized = normalizeText([name, text].filter(Boolean).join(' '))
  if (/\b(cpf|pessoa fisica|autonomo|freela|freelancer)\b/.test(normalized)) return 'pessoa_fisica'
  if (/\b(cnpj|pessoa juridica|empresa|ltda|mei|eireli|imobiliaria|mercado|supermercado|padaria|restaurante|cartorio|posto)\b/.test(normalized)) return 'pessoa_juridica'
  return entityTypeToCounterpartyType(entityType)
}

function tagFromValue(prefix: string, value?: string | null) {
  const normalized = normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized ? `${prefix}:${normalized}` : null
}

function inferOperationalTags(draft: FinanceDraft) {
  return [
    tagFromValue('categoria', draft.category),
    tagFromValue('subcategoria', draft.subcategory),
    tagFromValue('fornecedor', draft.counterparty_name),
    tagFromValue('metodo', draft.payment_method),
    tagFromValue('entidade', draft.entity_type),
    tagFromValue('centro', draft.cost_center),
  ].filter(Boolean) as string[]
}

function inferDescription(text: unknown, previous?: string | null) {
  const raw = cleanString(text, 1000)
  const normalized = normalizeText(raw)
  const category = detectCategory(raw)
  const current = cleanString(previous, 160)
  const currentCategoryIsClear = category.known && !isGenericDescription(category.description)
  if (currentCategoryIsClear && looksLikeUtilityBill(raw)) return category.description
  if (current && !GENERIC_DESCRIPTIONS.has(normalizeText(current)) && !currentCategoryIsClear) return current

  const como = raw.match(/\bcomo\s+(.{3,120})/i)
  if (como?.[1]) {
    const extracted = cleanString(
      como[1].replace(/\b(no|na|em|pela|pelo|para|por|dia|valor|r\$|pf|pj|cnpj|cpf|pessoa).*$/i, ''),
      120,
    )
    if (extracted.length >= 3) return sentenceCase(extracted)
  }

  if (/\babastec/.test(normalized)) return 'Abastecimento do carro'
  if (looksLikeUtilityBill(raw)) return category.description
  if (/\bcartao|fatura/.test(normalized)) return 'Pagamento de cartao de credito'
  if (/\balugue(?:l|is)|locacao/.test(normalized)) return 'Pagamento de aluguel'
  if (/\bboleto/.test(normalized)) return 'Pagamento de boleto'
  return category.description
}

function sentenceCase(value: string) {
  const text = cleanString(value, 160)
  if (!text) return ''
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}

function isConfirmationText(text: unknown) {
  return /\b(sim|confirmo|confirma|confirmar|pode|pode lancar|pode gravar|isso|isso mesmo|ok|fechado|perfeito|autorizo)\b/.test(normalizeText(text))
}

function isCancelText(text: unknown) {
  return /\b(nao|cancela|cancelar|descarta|deixa|esquece|errado|nao lanca|nao grava)\b/.test(normalizeText(text))
}

function hasExplicitExecutionIntent(text: unknown) {
  return /\b(lanca|lancar|lance|cadastra|cadastrar|cadastre|registra|registrar|registre|inclui|incluir|inclua|cria|criar|crie)\b/.test(normalizeText(text))
}

function looksLikeFinanceCreation(text: unknown, hasMedia: boolean) {
  const normalized = normalizeText(text)
  const financeDomainSignal = /\b(comprovante|recibo|nota fiscal|cupom|pagamento|paguei|despesa|gasto|abastec|combustivel|gasolina|etanol|diesel|posto|alugue(?:l|is)|locacao|cartao|fatura|boleto|pix|ted|doc|parcela|parcelas|financeiro|caixa|receita|reembolso)\b/.test(normalized)
  const financeCatalogSignal = /\b(categoria|subcategoria|plano de contas|metodo de pagamento|forma de pagamento|fornecedor|prestador|favorecido|centro de custo|tag|tags)\b/.test(normalized)
  const executionFinanceSignal = hasExplicitExecutionIntent(normalized) && (
    financeDomainSignal
    || financeCatalogSignal
    || /\b(valor|reais|r\$|pf|pj|cnpj|cpf)\b/.test(normalized)
  )
  const mediaFinanceReference = Boolean(hasMedia && /\b(essa|esse|isso|isto|foto|imagem|anexo|arquivo|midia)\b/.test(normalized) && /\b(lanca|lancar|lance|cadastra|cadastrar|cadastre|registrar|registre|financeiro|comprovante|recibo|pagamento|paguei|despesa|gasto)\b/.test(normalized))
  return financeDomainSignal || executionFinanceSignal || mediaFinanceReference
}

function formatDateBR(dateKey?: string | null) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return '-'
  const [year, month, day] = dateKey.split('-')
  return `${day}/${month}/${year}`
}

function buildDraftFromCommand(command: any, previous?: FinanceDraft | null): FinanceDraft {
  const payload = command?.payload || {}
  const media = firstMedia(payload)
  const receipt = receiptAnalysisFromPayload(payload)
  const mediaAnalysis = payloadMediaText(payload)
  const interpretedText = cleanString(payload?.finance_context?.interpretedText || payload?.finance_context?.interpreted_text || '', 1200)
  const commandText = cleanString(command?.command_text, 3000)
  const fullText = [commandText, interpretedText, mediaAnalysis].filter(Boolean).join('\n')
  const hasMedia = Boolean(payload?.has_media || media || mediaAnalysis)
  const installmentCount = extractInstallmentCount(fullText) || previous?.installment_count || null
  const kind: FinanceDraftKind = installmentCount ? 'payable_installments' : (previous?.kind || 'paid_expense')
  const category = detectCategory(fullText)
  const explicitClassification = extractExplicitClassification(fullText, !category.known)
  const receiptCategory = cleanString(receipt?.category_hint, 90) || null
  const receiptSubcategory = cleanString(receipt?.subcategory_hint, 90) || null
  const requestedCategory = explicitClassification.category || previous?.requested_category || receiptCategory || null
  const requestedSubcategory = explicitClassification.subcategory || previous?.requested_subcategory || receiptSubcategory || null
  const entityType = detectEntityType(fullText) || previous?.entity_type || null
  const explicitDate = parseDateFromText(fullText) || receiptDate(receipt)
  const monthlyDay = extractMonthlyDueDay(fullText)
  const forceNextMonth = /\b(mes que vem|proximo mes|proximos meses|meses seguintes)\b/.test(normalizeText(fullText))
  const firstDueDate = explicitDate
    || (monthlyDay ? nextMonthlyDate(monthlyDay, forceNextMonth) : previous?.first_due_date || previous?.due_date || null)
  const entryDate = kind === 'paid_expense'
    ? (explicitDate || previous?.entry_date || saoPauloDateKey())
    : (previous?.entry_date || saoPauloDateKey())
  const amount = receiptAmount(receipt) || extractAmountFromText(fullText, previous?.amount || null)
  const userPaymentMethod = detectPaymentMethod([commandText, interpretedText].filter(Boolean).join('\n'))
  const receiptPaymentMethod = detectPaymentMethod(receipt?.payment_method)
  const mediaPaymentMethod = detectPaymentMethod(mediaAnalysis)
  const paymentMethod = userPaymentMethod
    || (shouldIgnoreDocumentCardPayment(receiptPaymentMethod, fullText, commandText) ? null : receiptPaymentMethod)
    || (shouldIgnoreDocumentCardPayment(mediaPaymentMethod, fullText, commandText) ? null : mediaPaymentMethod)
    || previous?.payment_method
    || null
  const costCenter = extractCostCenterName(fullText) || previous?.cost_center || null
  const receiptMerchant = cleanCounterpartyName(receipt?.merchant)
  const knownCounterparty = knownCounterpartyFromText(fullText)
  const counterpartyName = extractCounterpartyName(commandText)
    || receiptMerchant
    || knownCounterparty
    || extractCounterpartyName(mediaAnalysis)
    || previous?.counterparty_name
    || category.counterpartyName
    || null
  const counterpartyType = previous?.counterparty_type || inferCounterpartyType(counterpartyName, fullText, entityType)
  let description = inferDescription(fullText, previous?.description)
  const receiptDescription = cleanString(receipt?.description, 160)
  if (receiptDescription && (isGenericDescription(description) || (receipt && looksLikeUtilityBill(fullText)))) {
    description = receiptDescription
  }
  if (kind === 'payable_installments' && isGenericDescription(description) && counterpartyName) {
    description = `Pagamento - ${counterpartyName}`
  }

  const draft: FinanceDraft = {
    ...(previous || {}),
    kind,
    amount,
    installment_count: installmentCount,
    entity_type: entityType,
    counterparty_type: counterpartyType,
    description,
    counterparty_name: counterpartyName,
    category: requestedCategory || previous?.category || category.category,
    subcategory: requestedSubcategory || previous?.subcategory || category.subcategory,
    payment_method: paymentMethod,
    cost_center: costCenter,
    payment_status: kind === 'paid_expense' ? 'paid' : 'pending',
    entry_date: entryDate,
    due_date: kind === 'paid_expense' ? entryDate : firstDueDate,
    first_due_date: firstDueDate,
    competence_date: kind === 'paid_expense' ? entryDate : firstDueDate,
    attachment_url: previous?.attachment_url || media?.r2_url || media?.stored_url || media?.url || media?.original_url || null,
    media_filename: previous?.media_filename || media?.filename || media?.fileName || null,
    source_text: [previous?.source_text, commandText].filter(Boolean).join('\n').slice(-2400) || null,
    media_analysis: previous?.media_analysis || mediaAnalysis || null,
    requested_category: requestedCategory,
    requested_subcategory: requestedSubcategory,
    requested_payment_method: paymentMethod || previous?.requested_payment_method || null,
    requested_counterparty: counterpartyName || previous?.requested_counterparty || null,
    requested_cost_center: costCenter || previous?.requested_cost_center || null,
  }
  return {
    ...draft,
    operational_tags: inferOperationalTags(draft),
  }
}

function isGenericDescription(description?: string | null) {
  const normalized = normalizeText(description)
  return !normalized || GENERIC_DESCRIPTIONS.has(normalized)
}

function missingFieldsForDraft(draft: FinanceDraft): string[] {
  const missing: string[] = []
  if (!Number.isFinite(Number(draft.amount)) || Number(draft.amount) <= 0) missing.push('valor')
  if (!draft.entity_type) missing.push('pessoa fisica ou juridica')

  if (draft.kind === 'payable_installments') {
    if (!draft.installment_count || draft.installment_count < 2) missing.push('quantidade de parcelas')
    if (!draft.first_due_date) missing.push('primeiro vencimento')
    if (isGenericDescription(draft.description)) missing.push('descricao/fornecedor')
  }

  if (draft.kind === 'paid_expense' && isGenericDescription(draft.description) && !draft.media_analysis) {
    missing.push('como classificar')
  }
  if (draft.kind === 'paid_expense' && !draft.payment_method) {
    missing.push('forma de pagamento')
  }

  return missing
}

function humanMissingField(field: string) {
  const normalized = normalizeText(field)
  if (normalized === 'valor') return 'o valor'
  if (normalized === 'pessoa fisica ou juridica') return 'se eu lanco na pessoa fisica ou juridica'
  if (normalized === 'forma de pagamento') return 'como foi pago'
  if (normalized === 'quantidade de parcelas') return 'em quantas parcelas'
  if (normalized === 'primeiro vencimento') return 'qual e o primeiro vencimento'
  if (normalized === 'descricao fornecedor') return 'quem e o favorecido ou a descricao'
  if (normalized === 'como classificar') return 'como voce quer classificar'
  return field
}

function humanJoin(items: string[]) {
  const cleanItems = items.map(item => cleanString(item, 120)).filter(Boolean)
  if (cleanItems.length <= 1) return cleanItems[0] || ''
  if (cleanItems.length === 2) return `${cleanItems[0]} e ${cleanItems[1]}`
  return `${cleanItems.slice(0, -1).join(', ')} e ${cleanItems[cleanItems.length - 1]}`
}

function buildMissingFieldAsk(missing: string[]) {
  const readable = humanJoin(missing.map(humanMissingField))
  if (!readable) return 'Se faltar algum detalhe, eu te pergunto por aqui.'
  return `Para eu fechar certinho, me diga ${readable}.`
}

function asksToSendFinanceDocument(text: unknown) {
  const normalized = normalizeText(text)
  return /\b(posso|pode|vou|quer|quer que|consigo)\b.{0,80}\b(enviar|mandar|anexar|te enviar|te mandar)\b.{0,80}\b(comprovante|recibo|nota fiscal|cupom|pdf|arquivo|foto)\b/.test(normalized)
    || /\b(comprovante|recibo|nota fiscal|cupom|pdf|arquivo|foto)\b.{0,80}\b(posso|pode|vou|quer|consigo)\b.{0,80}\b(enviar|mandar|anexar)\b/.test(normalized)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function lowerFirst(value: string) {
  return value ? `${value.charAt(0).toLowerCase()}${value.slice(1)}` : ''
}

function cleanDescriptionForContext(description: string | null | undefined, counterparty?: string | null) {
  let cleaned = cleanString(description, 160)
  if (!cleaned || isGenericDescription(cleaned)) return ''
  if (counterparty) {
    cleaned = cleaned.replace(new RegExp(`\\s*-\\s*${escapeRegExp(counterparty)}$`, 'i'), '').trim()
  }
  return lowerFirst(cleaned)
}

function friendlyDraftContext(draft: FinanceDraft) {
  const amount = Number(draft.amount || 0) > 0 ? formatCurrencyBR(Number(draft.amount)) : ''
  const counterparty = cleanCounterpartyName(draft.counterparty_name)
  const description = cleanDescriptionForContext(draft.description, counterparty)
  const category = [draft.category, draft.subcategory].filter(Boolean).join(' / ')
  const date = draft.entry_date && draft.kind === 'paid_expense' ? formatDateBR(draft.entry_date) : ''
  const firstDueDate = draft.first_due_date && draft.kind === 'payable_installments' ? formatDateBR(draft.first_due_date) : ''

  if (draft.kind === 'paid_expense' && looksLikeUtilityBill([draft.description, draft.category, draft.subcategory, draft.counterparty_name].filter(Boolean).join(' '))) {
    return [
      counterparty ? `a fatura da ${counterparty}` : 'uma fatura',
      amount ? `de ${amount}` : '',
      date ? `do dia ${date}` : '',
    ].filter(Boolean).join(' ')
  }

  if (draft.kind === 'payable_installments') {
    return [
      amount ? `${draft.installment_count || ''} parcelas de ${amount}`.trim() : `${draft.installment_count || ''} parcelas`.trim(),
      description || category,
      counterparty ? `para ${counterparty}` : '',
      firstDueDate ? `com primeiro vencimento em ${firstDueDate}` : '',
    ].filter(Boolean).join(', ')
  }

  const subject = description || category || 'lancamento'
  return [
    amount ? `${amount} de ${subject}` : subject,
    counterparty ? `para ${counterparty}` : '',
    date ? `do dia ${date}` : '',
  ].filter(Boolean).join(' ')
}

function buildMissingQuestion(
  identityLabel: string,
  draft: FinanceDraft,
  missing: string[],
  sourceText?: string | null,
  options?: { hasPendingDraft?: boolean; hasFreshReceiptData?: boolean },
) {
  const name = firstName(identityLabel)
  const text = [sourceText, draft.source_text].filter(Boolean).join('\n')
  const ask = buildMissingFieldAsk(missing)
  const context = friendlyDraftContext(draft)

  if (options?.hasPendingDraft) {
    const readable = humanJoin(missing.map(humanMissingField))
    if (options.hasFreshReceiptData && (draft.media_analysis || draft.attachment_url)) {
      return [
        `${name}, li o comprovante${context ? `: ${context}.` : ' e deixei o lancamento rascunhado.'}`,
        readable ? `So falta me dizer ${readable}.` : 'Ja tenho tudo para seguir.',
      ].join('\n')
    }
    return readable
      ? `${name}, perfeito. Falta so me dizer ${readable}.`
      : `${name}, perfeito. Ja tenho o que preciso para continuar.`
  }

  if (asksToSendFinanceDocument(text) && !draft.attachment_url && !draft.media_analysis) {
    return [
      `${name}, pode me enviar sim.`,
      'Assim que chegar, eu olho o comprovante e preparo o lancamento.',
      missing.length > 0
        ? `Se o comprovante nao trouxer tudo, eu te pergunto ${humanJoin(missing.map(humanMissingField))}.`
        : 'Se faltar algum detalhe, eu te pergunto por aqui.',
    ].join('\n')
  }

  const intro = draft.media_analysis || draft.attachment_url
    ? `${name}, vi o comprovante e ja comecei o lancamento.`
    : `${name}, certo, eu preparo esse lancamento.`

  return [
    intro,
    context ? `Pelo que entendi, e ${context}.` : '',
    ask,
  ].filter(Boolean).join('\n')
}

function pendingCatalogCreationLabels(draft: FinanceDraft) {
  const labels: string[] = []
  if (draft.category_creation?.needs_confirmation) {
    const category = cleanString(draft.category_creation.category || draft.category, 90)
    const subcategory = cleanString(draft.category_creation.subcategory || draft.subcategory, 90)
    const label = [category, subcategory].filter(Boolean).join(' / ')
    if (label) labels.push(label)
  }
  if (draft.counterparty_creation?.needs_confirmation) {
    const name = cleanCounterpartyName(draft.counterparty_creation.name || draft.counterparty_name)
    if (name) labels.push(name)
  }
  if (draft.payment_method_creation?.needs_confirmation) {
    const name = canonicalPaymentMethod(draft.payment_method_creation.name || draft.payment_method)
    if (name) labels.push(name)
  }
  if (draft.cost_center_creation?.needs_confirmation) {
    const name = cleanupCatalogName(draft.cost_center_creation.name || draft.cost_center, 90)
    if (name) labels.push(name)
  }
  return Array.from(new Set(labels))
}

function buildConfirmationQuestion(identityLabel: string, draft: FinanceDraft) {
  const context = friendlyDraftContext(draft)
  const catalogLabels = pendingCatalogCreationLabels(draft)
  const catalogNote = catalogLabels.length
    ? `Tambem vou criar no financeiro: ${humanJoin(catalogLabels)}.`
    : ''
  const account = draft.entity_type
    ? `Vai na ${draft.entity_type === 'pj' ? 'pessoa juridica' : 'pessoa fisica'}`
    : ''
  const payment = draft.payment_method ? `pago por ${draft.payment_method}` : ''
  const attachment = draft.attachment_url ? 'com o comprovante anexado' : ''
  const details = humanJoin([account, payment, attachment].filter(Boolean))
  const action = draft.kind === 'payable_installments' ? 'criar essas contas a pagar' : 'salvar esse lancamento'

  return [
    `${firstName(identityLabel)}, fechou. ${context ? `Deixei pronto: ${context}.` : 'Ja deixei tudo pronto.'}`,
    details ? `${details}.` : '',
    catalogNote,
    `Posso ${action} assim?`,
  ].filter(Boolean).join('\n')
}

function firstName(label: unknown) {
  return cleanString(label, 80).split(/\s+/)[0] || 'Certo'
}

async function columnExists(supabase: SupabaseLike, tableName: string, columnName: string): Promise<boolean> {
  try {
    const { error } = await supabase.from(tableName).select(columnName).limit(1)
    return !error
  } catch {
    return false
  }
}

async function getFinanceEntrySchema(supabase: SupabaseLike): Promise<FinanceEntrySchema | null> {
  const [
    hasEntryDate,
    hasDate,
    hasOccurredAt,
    hasCreatedAt,
    hasCategory,
    hasSubcategory,
    hasPaymentMethod,
    hasPaymentStatus,
    hasCounterpartyName,
    hasCounterpartyType,
    hasReferenceCompany,
    hasDueDate,
    hasCompetenceDate,
    hasCostCenterId,
    hasBankAccountId,
    hasEntityId,
    hasSourceModule,
    hasExternalReference,
    hasNotes,
    hasAttachmentUrl,
    hasCreatedBy,
    hasUpdatedAt,
  ] = await Promise.all([
    columnExists(supabase, 'finance_entries', 'entry_date'),
    columnExists(supabase, 'finance_entries', 'date'),
    columnExists(supabase, 'finance_entries', 'occurred_at'),
    columnExists(supabase, 'finance_entries', 'created_at'),
    columnExists(supabase, 'finance_entries', 'category'),
    columnExists(supabase, 'finance_entries', 'subcategory'),
    columnExists(supabase, 'finance_entries', 'payment_method'),
    columnExists(supabase, 'finance_entries', 'payment_status'),
    columnExists(supabase, 'finance_entries', 'counterparty_name'),
    columnExists(supabase, 'finance_entries', 'counterparty_type'),
    columnExists(supabase, 'finance_entries', 'reference_company'),
    columnExists(supabase, 'finance_entries', 'due_date'),
    columnExists(supabase, 'finance_entries', 'competence_date'),
    columnExists(supabase, 'finance_entries', 'cost_center_id'),
    columnExists(supabase, 'finance_entries', 'bank_account_id'),
    columnExists(supabase, 'finance_entries', 'entity_id'),
    columnExists(supabase, 'finance_entries', 'source_module'),
    columnExists(supabase, 'finance_entries', 'external_reference'),
    columnExists(supabase, 'finance_entries', 'notes'),
    columnExists(supabase, 'finance_entries', 'attachment_url'),
    columnExists(supabase, 'finance_entries', 'created_by'),
    columnExists(supabase, 'finance_entries', 'updated_at'),
  ])

  const dateField = hasEntryDate ? 'entry_date' : hasDate ? 'date' : hasOccurredAt ? 'occurred_at' : hasCreatedAt ? 'created_at' : null
  if (!dateField) return null

  return {
    dateField,
    hasOccurredAt,
    hasCategory,
    hasSubcategory,
    hasPaymentMethod,
    hasPaymentStatus,
    hasCounterpartyName,
    hasCounterpartyType,
    hasReferenceCompany,
    hasDueDate,
    hasCompetenceDate,
    hasCostCenterId,
    hasBankAccountId,
    hasEntityId,
    hasSourceModule,
    hasExternalReference,
    hasNotes,
    hasAttachmentUrl,
    hasCreatedBy,
    hasUpdatedAt,
  }
}

async function getFinancePayablesSchema(supabase: SupabaseLike): Promise<FinancePayablesSchema | null> {
  const [
    hasId,
    hasDescription,
    hasAmount,
    hasDueDate,
    hasCompetenceDate,
    hasStatus,
    hasCategory,
    hasSubcategory,
    hasCounterpartyName,
    hasCounterpartyType,
    hasPaymentMethod,
    hasCostCenterId,
    hasBankAccountId,
    hasNotes,
    hasEntityId,
    hasCreatedBy,
    hasUpdatedAt,
    hasPaidAmount,
  ] = await Promise.all([
    columnExists(supabase, 'finance_payables', 'id'),
    columnExists(supabase, 'finance_payables', 'description'),
    columnExists(supabase, 'finance_payables', 'amount'),
    columnExists(supabase, 'finance_payables', 'due_date'),
    columnExists(supabase, 'finance_payables', 'competence_date'),
    columnExists(supabase, 'finance_payables', 'status'),
    columnExists(supabase, 'finance_payables', 'category'),
    columnExists(supabase, 'finance_payables', 'subcategory'),
    columnExists(supabase, 'finance_payables', 'counterparty_name'),
    columnExists(supabase, 'finance_payables', 'counterparty_type'),
    columnExists(supabase, 'finance_payables', 'payment_method'),
    columnExists(supabase, 'finance_payables', 'cost_center_id'),
    columnExists(supabase, 'finance_payables', 'bank_account_id'),
    columnExists(supabase, 'finance_payables', 'notes'),
    columnExists(supabase, 'finance_payables', 'entity_id'),
    columnExists(supabase, 'finance_payables', 'created_by'),
    columnExists(supabase, 'finance_payables', 'updated_at'),
    columnExists(supabase, 'finance_payables', 'paid_amount'),
  ])

  if (!hasId || !hasDescription || !hasAmount || !hasDueDate) return null
  return {
    hasDescription,
    hasAmount,
    hasDueDate,
    hasCompetenceDate,
    hasStatus,
    hasCategory,
    hasSubcategory,
    hasCounterpartyName,
    hasCounterpartyType,
    hasPaymentMethod,
    hasCostCenterId,
    hasBankAccountId,
    hasNotes,
    hasEntityId,
    hasCreatedBy,
    hasUpdatedAt,
    hasPaidAmount,
  }
}

async function findFinanceCategoryByName(supabase: SupabaseLike, name?: string | null) {
  const categoryName = cleanString(name, 90)
  if (!categoryName) return null
  try {
    const { data, error } = await supabase
      .from('finance_categories')
      .select('id, name, entry_type, is_active')
      .ilike('name', categoryName)
      .limit(1)
      .maybeSingle()
    if (error) return null
    return data || null
  } catch {
    return null
  }
}

async function findFinanceSubcategoryByName(supabase: SupabaseLike, categoryId?: string | null, name?: string | null) {
  const subcategoryName = cleanString(name, 90)
  if (!categoryId || !subcategoryName) return null
  try {
    const { data, error } = await supabase
      .from('finance_subcategories')
      .select('id, name, category_id, is_active')
      .eq('category_id', categoryId)
      .ilike('name', subcategoryName)
      .limit(1)
      .maybeSingle()
    if (error) return null
    return data || null
  } catch {
    return null
  }
}

async function findFinancePaymentMethodByName(supabase: SupabaseLike, name?: string | null) {
  const paymentMethodName = cleanString(name, 70)
  if (!paymentMethodName) return null
  try {
    const { data, error } = await supabase
      .from('finance_payment_methods')
      .select('id, name, is_active')
      .ilike('name', paymentMethodName)
      .limit(1)
      .maybeSingle()
    if (error) return null
    return data || null
  } catch {
    return null
  }
}

async function findFinanceCounterpartyByName(supabase: SupabaseLike, name?: string | null) {
  const counterpartyName = cleanString(name, 90)
  if (!counterpartyName) return null
  try {
    const { data, error } = await supabase
      .from('finance_counterparties')
      .select('id, name, party_type, is_active')
      .ilike('name', counterpartyName)
      .limit(1)
      .maybeSingle()
    if (error) return null
    return data || null
  } catch {
    return null
  }
}

async function findFinanceCostCenterByName(supabase: SupabaseLike, name?: string | null) {
  const costCenterName = cleanString(name, 90)
  if (!costCenterName) return null
  try {
    const { data, error } = await supabase
      .from('finance_cost_centers')
      .select('id, name, code, is_active')
      .ilike('name', costCenterName)
      .limit(1)
      .maybeSingle()
    if (error) return null
    return data || null
  } catch {
    return null
  }
}

async function findFinanceTagByName(supabase: SupabaseLike, name?: string | null) {
  const tagName = cleanString(name, 80)
  if (!tagName) return null
  try {
    const { data, error } = await supabase
      .from('finance_tags')
      .select('id, name, is_active')
      .ilike('name', tagName)
      .limit(1)
      .maybeSingle()
    if (error) return null
    return data || null
  } catch {
    return null
  }
}

async function ensureFinanceTags(supabase: SupabaseLike, tags?: string[] | null): Promise<FinanceTagCatalogResult> {
  const hasTagsTable = await columnExists(supabase, 'finance_tags', 'id')
  if (!hasTagsTable) return { ids: [], createdCount: 0 }

  const names = Array.from(new Set((tags || []).map(tag => cleanString(tag, 80)).filter(Boolean)))
  const ids: string[] = []
  let createdCount = 0
  const now = new Date().toISOString()

  for (const name of names) {
    let tag = await findFinanceTagByName(supabase, name)
    if (!tag?.id) {
      const { data, error } = await supabase
        .from('finance_tags')
        .insert({
          name,
          is_active: true,
          updated_at: now,
        })
        .select('id, name')
        .single()
      if (error) throw error
      tag = data
      createdCount += 1
    }
    if (tag?.id) ids.push(String(tag.id))
  }

  return { ids, createdCount }
}

async function linkFinanceEntryTags(supabase: SupabaseLike, entryId?: string | null, tagIds?: string[] | null) {
  const ids = Array.from(new Set((tagIds || []).filter(Boolean)))
  if (!entryId || !ids.length) return
  const hasLinkTable = await columnExists(supabase, 'finance_entry_tags', 'entry_id')
  if (!hasLinkTable) return

  const { error } = await supabase
    .from('finance_entry_tags')
    .upsert(
      ids.map(tagId => ({ entry_id: entryId, tag_id: tagId })),
      { onConflict: 'entry_id,tag_id', ignoreDuplicates: true },
    )
  if (error) throw error
}

async function linkFinancePayableTags(supabase: SupabaseLike, payableIds?: string[] | null, tagIds?: string[] | null) {
  const payables = Array.from(new Set((payableIds || []).filter(Boolean)))
  const tags = Array.from(new Set((tagIds || []).filter(Boolean)))
  if (!payables.length || !tags.length) return
  const hasLinkTable = await columnExists(supabase, 'finance_payable_tags', 'payable_id')
  if (!hasLinkTable) return

  const rows = payables.flatMap(payableId => tags.map(tagId => ({ payable_id: payableId, tag_id: tagId })))
  const { error } = await supabase
    .from('finance_payable_tags')
    .upsert(rows, { onConflict: 'payable_id,tag_id', ignoreDuplicates: true })
  if (error) throw error
}

async function resolveDraftCatalogStatus(supabase: SupabaseLike, draft: FinanceDraft): Promise<FinanceCatalogStatus> {
  const requestedCategory = cleanString(draft.requested_category, 90)
  const requestedSubcategory = cleanString(draft.requested_subcategory, 90)
  const paymentMethodName = cleanString(draft.payment_method, 70)
  const counterpartyName = cleanString(draft.counterparty_name, 90)
  const costCenterName = cleanString(draft.requested_cost_center || draft.cost_center, 90)
  let resolvedDraft: FinanceDraft = { ...draft }
  let needsConfirmation = false

  const categoryName = requestedCategory || cleanString(draft.category, 90)
  const subcategoryName = requestedSubcategory || cleanString(draft.subcategory, 90)
  const shouldCheckCategory = Boolean(categoryName && (
    requestedCategory
    || requestedSubcategory
    || subcategoryName !== 'Comprovante recebido'
  ))
  if (shouldCheckCategory && categoryName) {
    const existingCategory = await findFinanceCategoryByName(supabase, categoryName)
    const existingSubcategory = subcategoryName && existingCategory?.id
      ? await findFinanceSubcategoryByName(supabase, existingCategory.id, subcategoryName)
      : null
    const needsCategoryCreation = !existingCategory
    const needsSubcategoryCreation = Boolean(subcategoryName && !existingSubcategory)

    if (needsCategoryCreation || needsSubcategoryCreation) {
      needsConfirmation = true
      resolvedDraft = {
        ...resolvedDraft,
        category: categoryName,
        subcategory: subcategoryName || resolvedDraft.subcategory || null,
        category_creation: {
          category: categoryName,
          subcategory: needsSubcategoryCreation ? subcategoryName : null,
          needs_confirmation: true,
        },
      }
    } else {
      resolvedDraft = {
        ...resolvedDraft,
        category_creation: null,
      }
    }
  }

  if (paymentMethodName) {
    const existingPaymentMethod = await findFinancePaymentMethodByName(supabase, paymentMethodName)
    if (!existingPaymentMethod) {
      needsConfirmation = true
      resolvedDraft = {
        ...resolvedDraft,
        payment_method_creation: {
          name: paymentMethodName,
          needs_confirmation: true,
        },
      }
    } else {
      resolvedDraft = {
        ...resolvedDraft,
        payment_method: existingPaymentMethod.name || paymentMethodName,
        payment_method_creation: null,
      }
    }
  }

  if (counterpartyName) {
    const existingCounterparty = await findFinanceCounterpartyByName(supabase, counterpartyName)
    if (!existingCounterparty) {
      needsConfirmation = true
      resolvedDraft = {
        ...resolvedDraft,
        counterparty_creation: {
          name: counterpartyName,
          party_type: resolvedDraft.counterparty_type || inferCounterpartyType(counterpartyName, draft.source_text, draft.entity_type),
          needs_confirmation: true,
        },
      }
    } else {
      resolvedDraft = {
        ...resolvedDraft,
        counterparty_name: existingCounterparty.name || counterpartyName,
        counterparty_type: existingCounterparty.party_type || resolvedDraft.counterparty_type,
        counterparty_creation: null,
      }
    }
  }

  if (costCenterName) {
    const existingCostCenter = await findFinanceCostCenterByName(supabase, costCenterName)
    if (!existingCostCenter) {
      needsConfirmation = true
      resolvedDraft = {
        ...resolvedDraft,
        cost_center: costCenterName,
        cost_center_creation: {
          name: costCenterName,
          needs_confirmation: true,
        },
      }
    } else {
      resolvedDraft = {
        ...resolvedDraft,
        cost_center: existingCostCenter.name || costCenterName,
        cost_center_id: existingCostCenter.id || null,
        cost_center_creation: null,
      }
    }
  }

  return {
    draft: {
      ...resolvedDraft,
      operational_tags: inferOperationalTags(resolvedDraft),
    },
    needsConfirmation,
  }
}

async function ensureFinanceCatalogForDraft(supabase: SupabaseLike, draft: FinanceDraft): Promise<FinanceCatalogStatus> {
  let resolvedDraft: FinanceDraft = { ...draft }
  let categoryCreated = false
  let subcategoryCreated = false
  let paymentMethodCreated = false
  let counterpartyCreated = false
  let costCenterCreated = false
  const now = new Date().toISOString()

  if (draft.category_creation?.needs_confirmation) {
    const categoryName = cleanString(draft.category_creation.category || draft.category, 90)
    const subcategoryName = cleanString(draft.category_creation.subcategory || draft.subcategory, 90)
    if (categoryName) {
      let category = await findFinanceCategoryByName(supabase, categoryName)
      if (!category?.id) {
        const { data, error } = await supabase
          .from('finance_categories')
          .insert({
            name: categoryName,
            entry_type: 'expense',
            is_active: true,
            updated_at: now,
          })
          .select('id, name')
          .single()
        if (error) throw error
        category = data
        categoryCreated = true
      }

      if (subcategoryName && category?.id) {
        const existingSubcategory = await findFinanceSubcategoryByName(supabase, category.id, subcategoryName)
        if (!existingSubcategory?.id) {
          const { error } = await supabase
            .from('finance_subcategories')
            .insert({
              category_id: category.id,
              name: subcategoryName,
              is_active: true,
              updated_at: now,
            })
          if (error) throw error
          subcategoryCreated = true
        }
      }

      resolvedDraft = {
        ...resolvedDraft,
        category: category?.name || categoryName,
        subcategory: subcategoryName || resolvedDraft.subcategory || null,
        category_creation: null,
      }
    }
  }

  if (draft.payment_method_creation?.needs_confirmation) {
    const paymentMethodName = cleanString(draft.payment_method_creation.name || draft.payment_method, 70)
    if (paymentMethodName) {
      let paymentMethod = await findFinancePaymentMethodByName(supabase, paymentMethodName)
      if (!paymentMethod?.id) {
        const { data, error } = await supabase
          .from('finance_payment_methods')
          .insert({
            name: paymentMethodName,
            is_active: true,
            updated_at: now,
          })
          .select('id, name')
          .single()
        if (error) throw error
        paymentMethod = data
        paymentMethodCreated = true
      }
      resolvedDraft = {
        ...resolvedDraft,
        payment_method: paymentMethod?.name || paymentMethodName,
        payment_method_creation: null,
      }
    }
  }

  if (draft.counterparty_creation?.needs_confirmation) {
    const counterpartyName = cleanString(draft.counterparty_creation.name || draft.counterparty_name, 90)
    if (counterpartyName) {
      let counterparty = await findFinanceCounterpartyByName(supabase, counterpartyName)
      if (!counterparty?.id) {
        const { data, error } = await supabase
          .from('finance_counterparties')
          .insert({
            name: counterpartyName,
            party_type: draft.counterparty_creation.party_type || draft.counterparty_type || 'pessoa_juridica',
            is_active: true,
            updated_at: now,
          })
          .select('id, name, party_type')
          .single()
        if (error) throw error
        counterparty = data
        counterpartyCreated = true
      }
      resolvedDraft = {
        ...resolvedDraft,
        counterparty_name: counterparty?.name || counterpartyName,
        counterparty_type: counterparty?.party_type || resolvedDraft.counterparty_type,
        counterparty_creation: null,
      }
    }
  }

  if (draft.cost_center_creation?.needs_confirmation) {
    const costCenterName = cleanString(draft.cost_center_creation.name || draft.cost_center, 90)
    if (costCenterName) {
      let costCenter = await findFinanceCostCenterByName(supabase, costCenterName)
      if (!costCenter?.id) {
        const { data, error } = await supabase
          .from('finance_cost_centers')
          .insert({
            name: costCenterName,
            is_active: true,
            updated_at: now,
          })
          .select('id, name')
          .single()
        if (error) throw error
        costCenter = data
        costCenterCreated = true
      }
      resolvedDraft = {
        ...resolvedDraft,
        cost_center: costCenter?.name || costCenterName,
        cost_center_id: costCenter?.id || null,
        cost_center_creation: null,
      }
    }
  }

  return {
    draft: {
      ...resolvedDraft,
      operational_tags: inferOperationalTags(resolvedDraft),
    },
    needsConfirmation: false,
    categoryCreated,
    subcategoryCreated,
    paymentMethodCreated,
    counterpartyCreated,
    costCenterCreated,
  }
}

async function ensureFinanceDateUnlocked(supabase: SupabaseLike, dateKey?: string | null): Promise<string | null> {
  const date = String(dateKey || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const periodMonth = `${date.slice(0, 7)}-01`
  try {
    const { data, error } = await supabase
      .from('finance_closing_periods')
      .select('status')
      .eq('period_month', periodMonth)
      .maybeSingle()
    if (error) return null
    if (String(data?.status || '').trim().toLowerCase() === 'locked') {
      return `O periodo ${periodMonth.slice(5, 7)}/${periodMonth.slice(0, 4)} esta bloqueado para alteracoes.`
    }
  } catch {
    return null
  }
  return null
}

async function resolveFinanceEntity(supabase: SupabaseLike, draft: FinanceDraft) {
  if (!draft.entity_type) return { id: null, name: null }
  try {
    const { data } = await supabase
      .from('finance_entities')
      .select('id, name, entity_type, is_default')
      .eq('is_active', true)
      .eq('entity_type', draft.entity_type)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true })
      .limit(1)
      .maybeSingle()
    return { id: data?.id || null, name: data?.name || null }
  } catch {
    return { id: null, name: draft.entity_type === 'pj' ? 'Pessoa juridica' : 'Pessoa fisica' }
  }
}

function createdByFromCommand(command: any, instance?: any) {
  if (command?.identity_type === 'admin_user' && command?.identity_id) return command.identity_id
  return instance?.admin_user_id || null
}

function compactFinanceNote(value: unknown, max = 220) {
  const text = cleanString(value, max * 2).replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

function buildFinanceRecordNotes(params: {
  command: any
  draft: FinanceDraft
  includeCommandId?: boolean
}) {
  const { command, draft } = params
  return [
    'Lancado pela assistente financeira do WhatsApp Global.',
    command?.identity_label ? `Solicitante: ${command.identity_label}` : '',
    command?.phone ? `Telefone: ${command.phone}` : '',
    params.includeCommandId !== false ? `Comando global: ${command?.id || '-'}` : '',
    compactFinanceNote(command?.command_text || draft.source_text) ? `Pedido: ${compactFinanceNote(command?.command_text || draft.source_text)}` : '',
    draft.attachment_url ? 'Comprovante: anexado.' : '',
    draft.media_filename ? `Arquivo: ${compactFinanceNote(draft.media_filename, 120)}` : '',
    draft.cost_center ? `Centro de custo: ${draft.cost_center}` : '',
    draft.operational_tags?.length ? `Tags operacionais: ${draft.operational_tags.join(', ')}` : '',
  ].filter(Boolean).join('\n')
}

async function createFinanceEntry(params: {
  supabase: SupabaseLike
  command: any
  instance?: any
  draft: FinanceDraft
}) {
  const { supabase, command, instance, draft } = params
  const schema = await getFinanceEntrySchema(supabase)
  if (!schema) throw new Error('Tabela finance_entries incompativel.')

  const entryDate = draft.entry_date || saoPauloDateKey()
  const lockError = await ensureFinanceDateUnlocked(supabase, entryDate)
  if (lockError) throw new Error(lockError)

  const entity = schema.hasEntityId ? await resolveFinanceEntity(supabase, draft) : { id: null, name: null }
  const insertData: any = {
    description: draft.description || 'Despesa enviada pelo WhatsApp',
    entry_type: 'expense',
    amount: Number(draft.amount || 0),
  }

  if (schema.hasCategory) insertData.category = draft.category || 'Consumo despesas'
  if (schema.hasSubcategory) insertData.subcategory = draft.subcategory || null
  if (schema.hasPaymentMethod) insertData.payment_method = draft.payment_method || null
  if (schema.hasPaymentStatus) insertData.payment_status = draft.payment_status || 'paid'
  if (schema.hasCounterpartyName) insertData.counterparty_name = draft.counterparty_name || null
  if (schema.hasCounterpartyType) insertData.counterparty_type = draft.counterparty_type || entityTypeToCounterpartyType(draft.entity_type)
  if (schema.hasReferenceCompany) insertData.reference_company = entity.name || (draft.entity_type === 'pj' ? 'Pessoa juridica' : 'Pessoa fisica')
  if (schema.hasDueDate) insertData.due_date = draft.due_date || entryDate
  if (schema.hasCompetenceDate) insertData.competence_date = draft.competence_date || entryDate
  if (schema.hasCostCenterId) insertData.cost_center_id = draft.cost_center_id || null
  if (schema.hasBankAccountId) insertData.bank_account_id = null
  if (schema.hasEntityId) insertData.entity_id = entity.id
  if (schema.hasSourceModule) insertData.source_module = 'whatsapp_global_finance'
  if (schema.hasExternalReference) insertData.external_reference = `whatsapp-global:${command?.id || Date.now()}`
  if (schema.hasAttachmentUrl) insertData.attachment_url = draft.attachment_url || null
  if (schema.hasCreatedBy) insertData.created_by = createdByFromCommand(command, instance)
  if (schema.hasUpdatedAt) insertData.updated_at = new Date().toISOString()
  if (schema.hasNotes) {
    insertData.notes = buildFinanceRecordNotes({ command, draft })
  }

  if (schema.dateField === 'created_at' || schema.dateField === 'occurred_at') {
    insertData[schema.dateField] = `${entryDate}T12:00:00.000Z`
  } else {
    insertData[schema.dateField] = entryDate
  }
  if (schema.hasOccurredAt && !insertData.occurred_at) insertData.occurred_at = `${entryDate}T12:00:00.000Z`

  const { data, error } = await supabase
    .from('finance_entries')
    .insert(insertData)
    .select('id, description, amount')
    .single()

  if (error) throw error
  return data
}

function installmentDueDates(draft: FinanceDraft) {
  const count = Number(draft.installment_count || 0)
  const firstDueDate = draft.first_due_date || draft.due_date
  if (!firstDueDate || !count) return []
  const day = Number(firstDueDate.slice(8, 10))
  return Array.from({ length: count }, (_, index) => addMonthsWithDay(firstDueDate, index, day))
}

async function createFinancePayables(params: {
  supabase: SupabaseLike
  command: any
  instance?: any
  draft: FinanceDraft
}) {
  const { supabase, command, instance, draft } = params
  const schema = await getFinancePayablesSchema(supabase)
  if (!schema) throw new Error('Tabela finance_payables incompativel.')

  const dueDates = installmentDueDates(draft)
  if (!dueDates.length) throw new Error('Vencimentos das parcelas nao definidos.')

  for (const dueDate of dueDates) {
    const lockError = await ensureFinanceDateUnlocked(supabase, dueDate)
    if (lockError) throw new Error(lockError)
  }

  const entity = schema.hasEntityId ? await resolveFinanceEntity(supabase, draft) : { id: null, name: null }
  const nowIso = new Date().toISOString()
  const rows = dueDates.map((dueDate, index) => {
    const row: any = {}
    const description = `${draft.description || 'Pagamento'} (${index + 1}/${dueDates.length})`
    if (schema.hasDescription) row.description = description
    if (schema.hasAmount) row.amount = Number(draft.amount || 0)
    if (schema.hasDueDate) row.due_date = dueDate
    if (schema.hasCompetenceDate) row.competence_date = dueDate
    if (schema.hasStatus) row.status = 'open'
    if (schema.hasCategory) row.category = draft.category || 'Custos Fixos'
    if (schema.hasSubcategory) row.subcategory = draft.subcategory || null
    if (schema.hasCounterpartyName) row.counterparty_name = draft.counterparty_name || null
    if (schema.hasCounterpartyType) row.counterparty_type = draft.counterparty_type || entityTypeToCounterpartyType(draft.entity_type)
    if (schema.hasPaymentMethod) row.payment_method = draft.payment_method || null
    if (schema.hasCostCenterId) row.cost_center_id = draft.cost_center_id || null
    if (schema.hasBankAccountId) row.bank_account_id = null
    if (schema.hasEntityId) row.entity_id = entity.id
    if (schema.hasCreatedBy) row.created_by = createdByFromCommand(command, instance)
    if (schema.hasUpdatedAt) row.updated_at = nowIso
    if (schema.hasPaidAmount) row.paid_amount = 0
    if (schema.hasNotes) {
      row.notes = buildFinanceRecordNotes({ command, draft })
    }
    return row
  })

  const { data, error } = await supabase
    .from('finance_payables')
    .insert(rows)
    .select('id, description, amount, due_date, status')

  if (error) throw error
  return data || []
}

function buildPayablesSelect(schema: FinancePayablesSchema) {
  const columns = ['id', 'created_at']
  if (schema.hasDescription) columns.push('description')
  if (schema.hasAmount) columns.push('amount')
  if (schema.hasDueDate) columns.push('due_date')
  if (schema.hasStatus) columns.push('status')
  if (schema.hasCounterpartyName) columns.push('counterparty_name')
  if (schema.hasCategory) columns.push('category')
  if (schema.hasEntityId) columns.push('entity_id')
  if (schema.hasPaidAmount) columns.push('paid_amount')
  return columns.join(', ')
}

async function queryOpenPayables(supabase: SupabaseLike, window: DateWindow) {
  const schema = await getFinancePayablesSchema(supabase)
  if (!schema) throw new Error('Tabela finance_payables incompativel.')

  const select = buildPayablesSelect(schema)
  const openStatuses = ['open', 'partially_paid', 'overdue']
  let dueQuery = supabase
    .from('finance_payables')
    .select(select)
    .gte('due_date', window.startDate)
    .lte('due_date', window.endDate)
    .order('due_date', { ascending: true })
    .limit(40)

  if (schema.hasStatus) dueQuery = dueQuery.in('status', openStatuses)
  const { data: dueItems, error: dueError } = await dueQuery
  if (dueError) throw dueError

  let overdueItems: any[] = []
  if (window.includeOverdue) {
    let overdueQuery = supabase
      .from('finance_payables')
      .select(select)
      .lt('due_date', saoPauloDateKey())
      .order('due_date', { ascending: true })
      .limit(40)
    if (schema.hasStatus) overdueQuery = overdueQuery.in('status', openStatuses)
    const { data, error } = await overdueQuery
    if (error) throw error
    overdueItems = data || []
  }

  return {
    dueItems: dueItems || [],
    overdueItems,
  }
}

function payableRemainingAmount(item: any) {
  return Math.max(0, Number(item?.amount || 0) - Number(item?.paid_amount || 0))
}

function formatPayablesList(items: any[], limit = 8) {
  return items.slice(0, limit).map((item, index) => {
    const counterparty = item.counterparty_name ? ` - ${item.counterparty_name}` : ''
    return `${index + 1}. ${item.description || 'Conta'}${counterparty}: ${formatCurrencyBR(payableRemainingAmount(item))} - vence ${formatDateBR(item.due_date)}`
  }).join('\n')
}

function buildPayablesReply(identityLabel: string, window: DateWindow, result: { dueItems: any[]; overdueItems: any[] }) {
  const dueTotal = result.dueItems.reduce((sum, item) => sum + payableRemainingAmount(item), 0)
  const overdueTotal = result.overdueItems.reduce((sum, item) => sum + payableRemainingAmount(item), 0)
  const total = dueTotal + overdueTotal
  const name = firstName(identityLabel)

  if (!result.dueItems.length && !result.overdueItems.length) {
    return `${name}, olhei o financeiro e nao encontrei contas em aberto para ${window.label}.`
  }

  return [
    `${name}, olhei o financeiro. Para ${window.label}, encontrei ${result.dueItems.length} conta(s) em aberto${result.overdueItems.length ? ` e ${result.overdueItems.length} atrasada(s)` : ''}.`,
    `Total em aberto considerado: ${formatCurrencyBR(total)}.`,
    result.overdueItems.length ? `\nAtrasadas:\n${formatPayablesList(result.overdueItems, 5)}` : '',
    result.dueItems.length ? `\nVencendo no periodo:\n${formatPayablesList(result.dueItems, 8)}` : '',
  ].filter(Boolean).join('\n')
}

function buildCreatedExpenseReply(identityLabel: string, draft: FinanceDraft, entryId?: string | null) {
  const context = friendlyDraftContext(draft)
  return [
    `${firstName(identityLabel)}, lancado.`,
    context ? `Gravei ${context}.` : `Gravei ${formatCurrencyBR(Number(draft.amount || 0))} no financeiro.`,
    draft.entity_type ? `Ficou na ${draft.entity_type === 'pj' ? 'pessoa juridica' : 'pessoa fisica'}.` : '',
    draft.attachment_url ? 'Anexei o comprovante ao registro.' : '',
    entryId ? 'Ja aparece em Financeiro > Lancamentos.' : '',
  ].filter(Boolean).join('\n')
}

function buildCreatedPayablesReply(identityLabel: string, draft: FinanceDraft, payables: any[]) {
  const first = payables[0]?.due_date || draft.first_due_date
  const last = payables[payables.length - 1]?.due_date || first
  return [
    `${firstName(identityLabel)}, criado.`,
    `Registrei ${payables.length} parcela(s) de ${formatCurrencyBR(Number(draft.amount || 0))} em contas a pagar.`,
    `Primeiro vencimento: ${formatDateBR(first)}. Ultimo vencimento: ${formatDateBR(last)}.`,
    draft.entity_type ? `Ficou na ${draft.entity_type === 'pj' ? 'pessoa juridica' : 'pessoa fisica'}.` : '',
  ].filter(Boolean).join('\n')
}

async function loadGlobalSession(supabase: SupabaseLike, command: any) {
  try {
    if (command?.session_id) {
      const { data } = await supabase
        .from('whatsapp_global_sessions')
        .select('*')
        .eq('id', command.session_id)
        .maybeSingle()
      if (data) return data
    }
    if (command?.phone) {
      const { data } = await supabase
        .from('whatsapp_global_sessions')
        .select('*')
        .eq('phone', command.phone)
        .maybeSingle()
      return data || null
    }
  } catch {
    return null
  }
  return null
}

function getFinanceState(session: any): FinanceState {
  const state = session?.state && typeof session.state === 'object' ? session.state : {}
  const financeState = state[GLOBAL_FINANCE_STATE_KEY]
  return financeState && typeof financeState === 'object' ? financeState : {}
}

async function updateFinanceState(supabase: SupabaseLike, session: any, financeState: FinanceState) {
  if (!session?.id) return
  const current = session?.state && typeof session.state === 'object' ? session.state : {}
  await supabase
    .from('whatsapp_global_sessions')
    .update({
      state: {
        ...current,
        [GLOBAL_FINANCE_STATE_KEY]: {
          ...financeState,
          updated_at: new Date().toISOString(),
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.id)
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

async function sendFinanceReply(params: {
  phone?: string | null
  instanceToken?: string | null
  message: string
  sendResponse: boolean
}) {
  if (!params.sendResponse || !params.phone || !params.instanceToken || !params.message.trim()) return false
  try {
    await sendWhatsAppMessage({
      phone: params.phone,
      message: params.message,
      instanceToken: params.instanceToken,
    })
    return true
  } catch (error: any) {
    console.warn('[Pilger Finance] WhatsApp response failed:', error?.message || error)
    return false
  }
}

async function recordFinanceSignal(params: {
  supabase: SupabaseLike
  command: any
  action: FinanceAssistantAction
  metadata?: Record<string, unknown>
}) {
  await recordAgentCentralSignal({
    supabase: params.supabase as any,
    agentId: 'finance-ops-agent',
    eventType: `pilger_global_finance_${params.action}`,
    entityType: 'whatsapp_global_command',
    entityId: params.command?.id || params.command?.phone || null,
    source: 'pilger-finance-agent',
    label: `Assistente financeira Global: ${params.action}`,
    importanceScore: ['expense_created', 'payables_created'].includes(params.action) ? 82 : 68,
    metadata: {
      command_id: params.command?.id || null,
      requested_by_phone: params.command?.phone || null,
      requested_by_label: params.command?.identity_label || null,
      text_preview: cleanString(params.command?.command_text, 360) || null,
      ...(params.metadata || {}),
    },
    handoffTargets: ['whatsapp-global-agent', 'ceo-agent'],
  }).catch((error: any) => {
    console.warn('[Pilger Finance] central signal failed:', error?.message || error)
  })
}

function buildNotUnderstoodReply(identityLabel: string) {
  return [
    `${firstName(identityLabel)}, consigo te ajudar no financeiro.`,
    'Pode me pedir em linguagem natural, por exemplo: o que vence hoje, lance este comprovante na pessoa juridica, ou crie 4 parcelas de R$ 5.000 no dia 10.',
  ].join('\n')
}

async function handleDraftExecution(params: {
  supabase: SupabaseLike
  command: any
  instance?: any
  session: any
  draft: FinanceDraft
  sendResponse: boolean
  instanceToken?: string | null
}): Promise<ProcessPilgerFinanceCommandResult> {
  const { supabase, command, instance, session, draft, sendResponse, instanceToken } = params
  const catalogStatus = await ensureFinanceCatalogForDraft(supabase, draft)
  const executableDraft = catalogStatus.draft
  const catalogMetadata = {
    category_created: Boolean(catalogStatus.categoryCreated),
    subcategory_created: Boolean(catalogStatus.subcategoryCreated),
    payment_method_created: Boolean(catalogStatus.paymentMethodCreated),
    counterparty_created: Boolean(catalogStatus.counterpartyCreated),
    cost_center_created: Boolean(catalogStatus.costCenterCreated),
    tag_count: 0,
    tags_created: 0,
  }

  if (executableDraft.kind === 'payable_installments') {
    const payables = await createFinancePayables({ supabase, command, instance, draft: executableDraft })
    const ids = payables.map((item: any) => String(item.id)).filter(Boolean)
    const tagCatalog = await ensureFinanceTags(supabase, executableDraft.operational_tags)
    await linkFinancePayableTags(supabase, ids, tagCatalog.ids)
    catalogMetadata.tag_count = tagCatalog.ids.length
    catalogMetadata.tags_created = tagCatalog.createdCount
    const responseText = buildCreatedPayablesReply(command.identity_label, executableDraft, payables)
    await updateFinanceState(supabase, session, {
      pending_action: null,
      last_action: 'payables_created',
      last_payable_ids: ids,
      last_error: null,
    })
    await updateCommandStatus(supabase, command.id, 'completed', {
      stage: 'global_finance_payables_created',
      payable_ids: ids,
      count: ids.length,
      ...catalogMetadata,
      completed_at: new Date().toISOString(),
    })
    await recordFinanceSignal({ supabase, command, action: 'payables_created', metadata: { payable_ids: ids, ...catalogMetadata } })
    const whatsappSent = await sendFinanceReply({ phone: command.phone, instanceToken, message: responseText, sendResponse })
    return { handled: true, whatsappSent, action: 'payables_created', financePayableIds: ids, responseText }
  }

  const entry = await createFinanceEntry({ supabase, command, instance, draft: executableDraft })
  const tagCatalog = await ensureFinanceTags(supabase, executableDraft.operational_tags)
  await linkFinanceEntryTags(supabase, entry?.id || null, tagCatalog.ids)
  catalogMetadata.tag_count = tagCatalog.ids.length
  catalogMetadata.tags_created = tagCatalog.createdCount
  const responseText = buildCreatedExpenseReply(command.identity_label, executableDraft, entry?.id || null)
  await updateFinanceState(supabase, session, {
    pending_action: null,
    last_action: 'expense_created',
    last_entry_id: entry?.id || null,
    last_error: null,
  })
  await updateCommandStatus(supabase, command.id, 'completed', {
    stage: 'global_finance_expense_created',
    finance_entry_id: entry?.id || null,
    ...catalogMetadata,
    completed_at: new Date().toISOString(),
  })
  await recordFinanceSignal({ supabase, command, action: 'expense_created', metadata: { finance_entry_id: entry?.id || null, ...catalogMetadata } })
  const whatsappSent = await sendFinanceReply({ phone: command.phone, instanceToken, message: responseText, sendResponse })
  return { handled: true, whatsappSent, action: 'expense_created', financeEntryId: entry?.id || null, responseText }
}

async function queueDraftAndReply(params: {
  supabase: SupabaseLike
  command: any
  session: any
  draft: FinanceDraft
  missingFields?: string[]
  awaitingConfirmation?: boolean
  responseText: string
  action: 'ask_missing' | 'awaiting_confirmation'
  sendResponse: boolean
  instanceToken?: string | null
}): Promise<ProcessPilgerFinanceCommandResult> {
  const { supabase, command, session, draft, responseText, action, sendResponse, instanceToken } = params
  const missingFields = params.missingFields || []
  await updateFinanceState(supabase, session, {
    pending_action: {
      assistant_action: 'global_finance',
      draft,
      awaiting_confirmation: params.awaitingConfirmation || action === 'awaiting_confirmation',
      missing_fields: missingFields,
      source_command_id: command?.id || null,
      updated_at: new Date().toISOString(),
    },
    last_action: action,
    last_error: null,
  })
  await updateCommandStatus(supabase, command.id, 'queued', {
    stage: action === 'ask_missing' ? 'global_finance_awaiting_data' : 'global_finance_awaiting_confirmation',
    missing_fields: missingFields,
    draft,
    queued_at: new Date().toISOString(),
  })
  await recordFinanceSignal({ supabase, command, action, metadata: { missing_fields: missingFields, draft_kind: draft.kind } })
  const whatsappSent = await sendFinanceReply({ phone: command.phone, instanceToken, message: responseText, sendResponse })
  return {
    handled: true,
    whatsappSent,
    action,
    awaitingField: missingFields[0] || (action === 'awaiting_confirmation' ? 'confirmacao' : undefined),
    missingFields,
    responseText,
  }
}

export async function processPilgerFinanceCommand(
  params: ProcessPilgerFinanceCommandParams,
): Promise<ProcessPilgerFinanceCommandResult> {
  const { supabase, command, instance } = params
  if (!command?.id) return { handled: false, whatsappSent: false, error: 'missing_command' }
  if (command.status === 'blocked') return { handled: false, whatsappSent: false, error: 'blocked_command' }
  if (command.command_type !== 'finance_request') return { handled: false, whatsappSent: false }

  const instanceToken = params.instanceToken || params.instance?.instance_token || null
  const shouldSendResponse = params.sendResponse !== false

  try {
    await updateCommandStatus(supabase, command.id, 'processing', {
      stage: 'global_finance_processing_started',
      started_at: new Date().toISOString(),
    })

    const session = await loadGlobalSession(supabase, command)
    const financeState = getFinanceState(session)
    const pending = financeState.pending_action?.assistant_action === 'global_finance'
      ? financeState.pending_action
      : null
    const text = command.command_text || ''

    if (pending && isCancelText(text)) {
      const responseText = `${firstName(command.identity_label)}, sem problema. Descartei esse rascunho financeiro antes de gravar.`
      await updateFinanceState(supabase, session, {
        pending_action: null,
        last_action: 'cancelled',
        last_error: null,
      })
      await updateCommandStatus(supabase, command.id, 'cancelled', {
        stage: 'global_finance_cancelled_by_user',
        cancelled_at: new Date().toISOString(),
      })
      await recordFinanceSignal({ supabase, command, action: 'cancelled' })
      const whatsappSent = await sendFinanceReply({ phone: command.phone, instanceToken, message: responseText, sendResponse: shouldSendResponse })
      return { handled: true, whatsappSent, action: 'cancelled', responseText }
    }

    const financeContext = command?.payload?.finance_context || null
    const contextualQueryWindow = financeContext?.intent === 'query_payables'
      ? queryWindowFromContext(financeContext?.dateWindow || financeContext?.date_window || 'today')
      : null
    const queryWindow = !pending ? (contextualQueryWindow || detectQueryWindow(text)) : null
    if (queryWindow) {
      const payables = await queryOpenPayables(supabase, queryWindow)
      const responseText = buildPayablesReply(command.identity_label, queryWindow, payables)
      await updateFinanceState(supabase, session, {
        ...financeState,
        last_action: 'query_payables',
        last_error: null,
      })
      await updateCommandStatus(supabase, command.id, 'completed', {
        stage: 'global_finance_payables_queried',
        window: queryWindow,
        due_count: payables.dueItems.length,
        overdue_count: payables.overdueItems.length,
        completed_at: new Date().toISOString(),
      })
      await recordFinanceSignal({
        supabase,
        command,
        action: 'query_payables',
        metadata: { due_count: payables.dueItems.length, overdue_count: payables.overdueItems.length },
      })
      const whatsappSent = await sendFinanceReply({ phone: command.phone, instanceToken, message: responseText, sendResponse: shouldSendResponse })
      return { handled: true, whatsappSent, action: 'query_payables', responseText }
    }

    const currentReceipt = receiptAnalysisFromPayload(command?.payload || {})
    const hasMedia = Boolean(command?.payload?.has_media || firstMedia(command?.payload) || payloadMediaText(command?.payload))
    const shouldStartFinanceDraft = pending || looksLikeFinanceCreation(text, hasMedia)
    if (!shouldStartFinanceDraft) {
      const responseText = buildNotUnderstoodReply(command.identity_label)
      await updateCommandStatus(supabase, command.id, 'completed', {
        stage: 'global_finance_not_understood',
        completed_at: new Date().toISOString(),
      })
      const whatsappSent = await sendFinanceReply({ phone: command.phone, instanceToken, message: responseText, sendResponse: shouldSendResponse })
      return { handled: true, whatsappSent, action: 'not_understood', responseText }
    }

    const catalogStatus = await resolveDraftCatalogStatus(
      supabase,
      buildDraftFromCommand(command, pending?.draft || null),
    )
    const draft = catalogStatus.draft
    const missingFields = missingFieldsForDraft(draft)
    if (missingFields.length > 0) {
      return queueDraftAndReply({
        supabase,
        command,
        session,
        draft,
        missingFields,
        responseText: buildMissingQuestion(command.identity_label, draft, missingFields, text, {
          hasPendingDraft: Boolean(pending),
          hasFreshReceiptData: Boolean(currentReceipt),
        }),
        action: 'ask_missing',
        sendResponse: shouldSendResponse,
        instanceToken,
      })
    }

    const confirmedPendingDraft = Boolean(pending?.awaiting_confirmation && isConfirmationText(text))
    const needsCatalogConfirmation = catalogStatus.needsConfirmation && !confirmedPendingDraft
    const autoExecute = (hasExplicitExecutionIntent(text) && !needsCatalogConfirmation) || confirmedPendingDraft
    if (!autoExecute) {
      return queueDraftAndReply({
        supabase,
        command,
        session,
        draft,
        awaitingConfirmation: true,
        responseText: buildConfirmationQuestion(command.identity_label, draft),
        action: 'awaiting_confirmation',
        sendResponse: shouldSendResponse,
        instanceToken,
      })
    }

    return await handleDraftExecution({
      supabase,
      command,
      instance,
      session,
      draft,
      sendResponse: shouldSendResponse,
      instanceToken,
    })
  } catch (error: any) {
    const message = error?.message || String(error)
    console.error('[Pilger Finance] command failed:', message)
    await updateCommandStatus(supabase, command.id, 'failed', {
      stage: 'global_finance_failed',
      error: message,
      failed_at: new Date().toISOString(),
    }).catch(() => null)

    const session = await loadGlobalSession(supabase, command).catch(() => null)
    if (session) {
      await updateFinanceState(supabase, session, {
        ...getFinanceState(session),
        last_error: message,
      }).catch(() => null)
    }

    const responseText = [
      `${firstName(command.identity_label)}, tentei cuidar dessa solicitacao financeira, mas encontrei um erro operacional.`,
      'Deixei o comando registrado para revisao no painel.',
    ].join('\n')
    const whatsappSent = await sendFinanceReply({
      phone: command.phone,
      message: responseText,
      instanceToken,
      sendResponse: shouldSendResponse,
    })

    return {
      handled: true,
      whatsappSent,
      action: 'not_understood',
      responseText,
      error: message,
    }
  }
}
