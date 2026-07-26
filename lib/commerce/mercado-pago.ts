import { splitName } from './checkout'

export type MercadoPagoPixInput = {
  accessToken: string
  idempotencyKey: string
  amountCents: number
  description: string
  payer: {
    name: string
    email: string
    document?: string | null
  }
  externalReference: string
  notificationUrl?: string
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

export function getMercadoPagoPaymentMethod(value: unknown) {
  const method = String(value || '').toLowerCase()
  if (method === 'pix') return 'pix'
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
    metadata: input.metadata || {},
  }

  if (input.notificationUrl) body.notification_url = input.notificationUrl

  const response = await fetch('https://api.mercadopago.com/v1/payments', {
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
