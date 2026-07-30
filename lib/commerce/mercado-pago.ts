import { splitName } from './checkout'

export type MercadoPagoPixInput = {
  accessToken: string
  idempotencyKey: string
  amountCents: number
  description: string
  deviceSessionId?: string | null
  payer: {
    name: string
    email: string
    document?: string | null
    phone?: string | null
    registrationDate?: string | null
  }
  items?: MercadoPagoAdditionalInfoItem[]
  externalReference: string
  notificationUrl?: string
  metadata?: Record<string, unknown>
}

export type MercadoPagoAdditionalInfoItem = {
  id?: string | null
  title: string
  description?: string | null
  quantity?: number | null
  unitAmountCents: number
  pictureUrl?: string | null
}

export type MercadoPagoCardPaymentInput = {
  accessToken: string
  idempotencyKey: string
  amountCents: number
  description: string
  deviceSessionId?: string | null
  token: string
  paymentMethodId: string
  issuerId?: string | null
  installments: number
  payer: {
    name: string
    email: string
    document?: string | null
    phone?: string | null
    registrationDate?: string | null
  }
  items?: MercadoPagoAdditionalInfoItem[]
  externalReference: string
  notificationUrl?: string
  statementDescriptor?: string | null
  metadata?: Record<string, unknown>
}

export type MercadoPagoPreapprovalInput = {
  accessToken: string
  idempotencyKey: string
  reason: string
  payerEmail: string
  externalReference: string
  amountCents: number
  currency: string
  frequency: number
  frequencyType: 'days' | 'weeks' | 'months' | 'years'
  status: 'pending' | 'authorized'
  cardTokenId?: string | null
  backUrl?: string | null
  notificationUrl?: string | null
  metadata?: Record<string, unknown>
}

export type MercadoPagoPaymentPayload = Record<string, any>

export type MercadoPagoCredentialKind = 'missing' | 'test' | 'production' | 'unknown'

export function classifyMercadoPagoCredential(value: unknown): MercadoPagoCredentialKind {
  const credential = String(value || '').trim()
  if (!credential) return 'missing'
  if (/^TEST[-_]/i.test(credential)) return 'test'
  if (/^APP_USR[-_]/i.test(credential) || /^PROD[-_]/i.test(credential)) return 'production'
  return 'unknown'
}

export function assertMercadoPagoCredentialEnvironment(params: {
  environment: 'sandbox' | 'production'
  accessToken: string
}) {
  const kind = classifyMercadoPagoCredential(params.accessToken)
  if (params.environment === 'sandbox' && kind === 'production') {
    throw new Error('O ambiente está em sandbox, mas o Access Token parece ser de produção. Troque para uma credencial de teste antes de gerar Pix sandbox.')
  }
  if (params.environment === 'production' && kind === 'test') {
    throw new Error('O ambiente está em produção, mas o Access Token parece ser de teste. Troque para uma credencial de produção antes de vender.')
  }
  return kind
}

export function normalizeMercadoPagoPaymentStatus(value: unknown) {
  const status = String(value || 'pending')
  const allowed = new Set([
    'pending',
    'approved',
    'authorized',
    'in_process',
    'in_mediation',
    'rejected',
    'cancelled',
    'refunded',
    'charged_back',
  ])
  return allowed.has(status) ? status : 'pending'
}

export function mercadoPagoAmountToCents(value: unknown) {
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount)) return 0
  return Math.round(amount * 100)
}

export function extractMercadoPagoPixData(payment: MercadoPagoPaymentPayload) {
  const transactionData = payment?.point_of_interaction?.transaction_data || {}
  return {
    qrCode: String(transactionData.qr_code || ''),
    qrCodeBase64: String(transactionData.qr_code_base64 || ''),
    ticketUrl: String(transactionData.ticket_url || ''),
  }
}

export function getMercadoPagoPaymentMethod(value: unknown, paymentType?: unknown) {
  const method = String(value || '').toLowerCase()
  const type = String(paymentType || '').toLowerCase()
  if (method === 'pix') return 'pix'
  if (type === 'debit_card') return 'debit_card'
  if (type === 'credit_card') return 'credit_card'
  if (type === 'account_money') return 'account_money'
  if (method.includes('deb') || method.includes('debit')) return 'debit_card'
  if (method.includes('visa') || method.includes('master') || method.includes('amex') || method.includes('elo')) return 'credit_card'
  if (method === 'bolbradesco' || method === 'boleto') return 'boleto'
  return 'unknown'
}

function mercadoPagoErrorMessage(status: number, payload: unknown, fallback: string) {
  const record = payload && typeof payload === 'object' ? payload as Record<string, any> : {}
  const cause = Array.isArray(record.cause) && record.cause.length
    ? ` ${record.cause.map((item: any) => item?.description || item?.code).filter(Boolean).join(' ')}`
    : ''
  return `Mercado Pago (${status}): ${record.message || record.error || fallback}.${cause}`.slice(0, 260)
}

function cleanText(value: unknown, maxLength = 300) {
  return String(value || '').trim().slice(0, maxLength)
}

function phonePayload(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '')
  const local = digits.startsWith('55') ? digits.slice(2) : digits
  if (local.length < 10) return undefined
  return {
    area_code: local.slice(0, 2),
    number: local.slice(2, 11),
  }
}

function buildAdditionalInfo(input: {
  payer: {
    name: string
    phone?: string | null
    registrationDate?: string | null
  }
  items?: MercadoPagoAdditionalInfoItem[]
}) {
  const { firstName, lastName } = splitName(input.payer.name)
  const phone = phonePayload(input.payer.phone)
  const items = (input.items || [])
    .filter(item => item.title && item.unitAmountCents > 0)
    .slice(0, 20)
    .map((item) => ({
      id: cleanText(item.id, 80) || undefined,
      title: cleanText(item.title, 120),
      description: cleanText(item.description, 240) || undefined,
      quantity: Math.max(1, Math.round(Number(item.quantity || 1))),
      unit_price: Math.max(0, item.unitAmountCents) / 100,
      picture_url: cleanText(item.pictureUrl, 500) || undefined,
    }))

  return {
    ...(items.length ? { items } : {}),
    payer: {
      first_name: firstName,
      last_name: lastName || undefined,
      phone,
      registration_date: cleanText(input.payer.registrationDate, 40) || undefined,
    },
  }
}

function mercadoPagoHeaders(input: {
  accessToken: string
  idempotencyKey: string
  deviceSessionId?: string | null
}) {
  return {
    accept: 'application/json',
    'content-type': 'application/json',
    Authorization: `Bearer ${input.accessToken}`,
    'X-Idempotency-Key': input.idempotencyKey,
    ...(cleanText(input.deviceSessionId, 120) ? { 'X-meli-session-id': cleanText(input.deviceSessionId, 120) } : {}),
  }
}

export async function createMercadoPagoPixPayment(input: MercadoPagoPixInput) {
  const { firstName, lastName } = splitName(input.payer.name)
  const document = String(input.payer.document || '').replace(/\D/g, '')
  const body: Record<string, unknown> = {
    transaction_amount: input.amountCents / 100,
    description: input.description.slice(0, 255),
    payment_method_id: 'pix',
    payer: {
      email: input.payer.email,
      first_name: firstName,
      last_name: lastName,
      identification: document
        ? {
            type: document.length === 14 ? 'CNPJ' : 'CPF',
            number: document,
          }
        : undefined,
    },
    external_reference: input.externalReference,
    additional_info: buildAdditionalInfo({
      payer: input.payer,
      items: input.items,
    }),
    metadata: input.metadata || {},
  }

  if (input.notificationUrl) body.notification_url = input.notificationUrl

  const response = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: mercadoPagoHeaders(input),
    body: JSON.stringify(body),
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : {}

  if (!response.ok) {
    throw new Error(mercadoPagoErrorMessage(response.status, payload, response.statusText))
  }

  return payload as MercadoPagoPaymentPayload
}

export async function createMercadoPagoCardPayment(input: MercadoPagoCardPaymentInput) {
  const { firstName, lastName } = splitName(input.payer.name)
  const document = String(input.payer.document || '').replace(/\D/g, '')
  const body: Record<string, unknown> = {
    transaction_amount: input.amountCents / 100,
    token: input.token,
    description: input.description.slice(0, 255),
    installments: Math.max(1, Math.round(input.installments || 1)),
    payment_method_id: input.paymentMethodId,
    issuer_id: input.issuerId || undefined,
    capture: true,
    binary_mode: false,
    three_d_secure_mode: 'optional',
    statement_descriptor: input.statementDescriptor || undefined,
    payer: {
      email: input.payer.email,
      first_name: firstName,
      last_name: lastName,
      identification: document
        ? {
            type: document.length === 14 ? 'CNPJ' : 'CPF',
            number: document,
          }
        : undefined,
    },
    external_reference: input.externalReference,
    additional_info: buildAdditionalInfo({
      payer: input.payer,
      items: input.items,
    }),
    metadata: input.metadata || {},
  }

  if (input.notificationUrl) body.notification_url = input.notificationUrl

  const response = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: mercadoPagoHeaders(input),
    body: JSON.stringify(body),
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : {}

  if (!response.ok) {
    throw new Error(mercadoPagoErrorMessage(response.status, payload, response.statusText))
  }

  return payload as MercadoPagoPaymentPayload
}

export async function createMercadoPagoPreapproval(input: MercadoPagoPreapprovalInput) {
  const body: Record<string, unknown> = {
    reason: input.reason.slice(0, 255),
    external_reference: input.externalReference,
    payer_email: input.payerEmail,
    status: input.status,
    auto_recurring: {
      frequency: input.frequency,
      frequency_type: input.frequencyType,
      transaction_amount: input.amountCents / 100,
      currency_id: input.currency || 'BRL',
    },
    metadata: input.metadata || {},
  }

  if (input.cardTokenId) body.card_token_id = input.cardTokenId
  if (input.backUrl) body.back_url = input.backUrl
  if (input.notificationUrl) body.notification_url = input.notificationUrl

  const response = await fetch('https://api.mercadopago.com/preapproval', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: `Bearer ${input.accessToken}`,
      'X-Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify(body),
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : {}

  if (!response.ok) {
    throw new Error(mercadoPagoErrorMessage(response.status, payload, response.statusText))
  }

  return payload as MercadoPagoPaymentPayload
}

export async function getMercadoPagoPayment(accessToken: string, paymentId: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : {}

  if (!response.ok) {
    throw new Error(mercadoPagoErrorMessage(response.status, payload, response.statusText))
  }

  return payload as MercadoPagoPaymentPayload
}

export async function getMercadoPagoPreapproval(accessToken: string, preapprovalId: string) {
  const response = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(preapprovalId)}`, {
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : {}

  if (!response.ok) {
    throw new Error(mercadoPagoErrorMessage(response.status, payload, response.statusText))
  }

  return payload as MercadoPagoPaymentPayload
}

export async function getMercadoPagoChargeback(accessToken: string, chargebackId: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/chargebacks/${encodeURIComponent(chargebackId)}`, {
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : {}

  if (!response.ok) {
    throw new Error(mercadoPagoErrorMessage(response.status, payload, response.statusText))
  }

  return payload as MercadoPagoPaymentPayload
}

export async function getMercadoPagoCurrentUser(accessToken: string) {
  const response = await fetch('https://api.mercadopago.com/users/me', {
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : {}

  if (!response.ok) {
    throw new Error(mercadoPagoErrorMessage(response.status, payload, response.statusText))
  }

  return payload as MercadoPagoPaymentPayload
}
