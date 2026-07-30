'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, BadgeCheck, Check, Copy, CreditCard, Loader2, LockKeyhole, QrCode, RefreshCw, ShieldCheck } from 'lucide-react'
import type { CheckoutBumpRow, CheckoutOfferRow, CheckoutProductRow } from '@/lib/commerce/checkout'

type CheckoutPayload = {
  success: boolean
  message?: string
  status?: {
    lifecycle_status?: string
    label?: string
    message?: string
    order_status?: string
    payment_status?: string | null
    next_action?: string
    terminal?: boolean
    can_retry_payment?: boolean
    checkout_url?: string
    member_area_url?: string
  }
  fulfillment?: Record<string, any> | null
  order?: {
    id: string
    order_number: string
    status: string
    subtotal_cents: number
    bump_total_cents: number
    discount_cents: number
    total_cents: number
    total_display: string
    pix_expires_at: string
  }
  payment?: {
    id: string
    provider_payment_id: string
    status: string
    status_detail: string
    payment_method?: string
    installments?: number
    card_last_four?: string
    pix_qr_code?: string
    pix_qr_code_base64?: string
    pix_ticket_url?: string
    expires_at?: string
    three_ds_info?: {
      external_resource_url?: string
      creq?: string
    } | null
  }
  subscription?: {
    id: string
    provider_subscription_id?: string
    status: string
    payment_method: string
    frequency: number
    frequency_type: string
    init_point?: string
  }
}

type CheckoutClientProps = {
  checkoutSlug: string
  product: CheckoutProductRow
  offer: CheckoutOfferRow
  bumps: CheckoutBumpRow[]
  mercadoPagoPublicKey: string
  cardPaymentsEnabled: boolean
  subscriptionPaymentsEnabled: boolean
}

type PaymentChoice = 'pix' | 'credit_card' | 'debit_card' | 'subscription_pix' | 'subscription_card'

declare global {
  interface Window {
    MP_DEVICE_SESSION_ID?: string
    MercadoPago?: new (publicKey: string, options?: Record<string, unknown>) => {
      createCardToken?: (input: Record<string, string>) => Promise<{ id?: string }>
      getPaymentMethods?: (input: { bin: string }) => Promise<Record<string, any>>
    }
  }
}

function formatCents(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((Number(cents) || 0) / 100)
}

function cleanDocument(value: string) {
  return value.replace(/\D/g, '').slice(0, 14)
}

function normalizeBrazilPhone(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('55')) return digits.slice(0, 13)
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`
  return digits.slice(0, 15)
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function cardBrand(value: string) {
  const number = value.replace(/\D/g, '')
  if (/^4/.test(number)) return 'visa'
  if (/^(5[1-5]|2[2-7])/.test(number)) return 'master'
  if (/^3[47]/.test(number)) return 'amex'
  if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(number)) return 'elo'
  if (/^(606282|3841)/.test(number)) return 'hipercard'
  return ''
}

function expirationParts(value: string) {
  const [month = '', year = ''] = value.replace(/\s/g, '').split('/')
  return {
    month: month.padStart(2, '0').slice(0, 2),
    year: year.length === 2 ? `20${year}` : year.slice(0, 4),
  }
}

function loadMercadoPagoSdk() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Browser indisponivel.'))
  if (window.MercadoPago) return Promise.resolve()

  return new Promise<void>((resolve, reject) => {
    const existing = window.document.querySelector<HTMLScriptElement>('script[data-mercado-pago-sdk="true"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar Mercado Pago.')), { once: true })
      return
    }

    const script = window.document.createElement('script')
    script.src = 'https://sdk.mercadopago.com/js/v2'
    script.async = true
    script.dataset.mercadoPagoSdk = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Falha ao carregar Mercado Pago.'))
    window.document.head.appendChild(script)
  })
}

function loadMercadoPagoSecurityScript() {
  if (typeof window === 'undefined') return Promise.resolve('')
  if (text(window.MP_DEVICE_SESSION_ID)) return Promise.resolve(text(window.MP_DEVICE_SESSION_ID))

  return new Promise<string>((resolve) => {
    const finish = () => {
      window.setTimeout(() => resolve(text(window.MP_DEVICE_SESSION_ID)), 180)
    }
    const existing = window.document.querySelector<HTMLScriptElement>('script[data-mercado-pago-security="true"]')
    if (existing) {
      existing.addEventListener('load', finish, { once: true })
      existing.addEventListener('error', () => resolve(''), { once: true })
      finish()
      return
    }

    const script = window.document.createElement('script')
    script.src = 'https://www.mercadopago.com/v2/security.js'
    script.async = true
    script.dataset.mercadoPagoSecurity = 'true'
    script.setAttribute('view', 'checkout')
    script.setAttribute('output', 'MP_DEVICE_SESSION_ID')
    script.onload = finish
    script.onerror = () => resolve('')
    window.document.head.appendChild(script)
  })
}

function statusLabel(status?: string) {
  switch (status) {
    case 'approved':
    case 'paid':
      return 'Pagamento aprovado'
    case 'rejected':
      return 'Pagamento recusado'
    case 'cancelled':
      return 'Pagamento cancelado'
    case 'expired':
      return 'Pix expirado'
    default:
      return 'Aguardando pagamento'
  }
}

function statusTone(status?: string) {
  if (status === 'approved' || status === 'paid') return 'success'
  if (status === 'rejected' || status === 'cancelled' || status === 'expired' || status === 'refunded' || status === 'charged_back') return 'danger'
  return 'warning'
}

const approvedPaymentStatuses = new Set(['approved', 'paid'])
const approvedLifecycleStatuses = new Set(['payment_approved', 'access_granted'])
const finalPaymentFailures = new Set(['rejected', 'cancelled', 'expired', 'refunded', 'charged_back'])
const finalLifecycleFailures = new Set(['payment_rejected', 'payment_cancelled', 'payment_expired', 'payment_refunded', 'chargeback'])

export default function CheckoutClient({
  checkoutSlug,
  product,
  offer,
  bumps,
  mercadoPagoPublicKey,
  cardPaymentsEnabled,
  subscriptionPaymentsEnabled,
}: CheckoutClientProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [buyerDocument, setBuyerDocument] = useState('')
  const [whatsappOptIn, setWhatsappOptIn] = useState(true)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>('pix')
  const [cardholderName, setCardholderName] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiration, setCardExpiration] = useState('')
  const [cardSecurityCode, setCardSecurityCode] = useState('')
  const [installments, setInstallments] = useState('1')
  const [selectedBumps, setSelectedBumps] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [error, setError] = useState('')
  const [checkoutResult, setCheckoutResult] = useState<CheckoutPayload | null>(null)
  const [copied, setCopied] = useState(false)
  const threeDSFrameRef = useRef<HTMLIFrameElement | null>(null)

  const selectedBumpRows = useMemo(
    () => bumps.filter((bump) => selectedBumps.includes(bump.id)),
    [bumps, selectedBumps]
  )
  const bumpTotal = selectedBumpRows.reduce((total, bump) => total + bump.price_cents, 0)
  const total = offer.price_cents + bumpTotal
  const coverImage = product.cover_image_url || product.thumbnail_url || '/images/products/corretor-nota-8-cover.webp'
  const lifecycleStatus = checkoutResult?.status?.lifecycle_status
  const paymentStatus = checkoutResult?.status?.payment_status || checkoutResult?.payment?.status || checkoutResult?.order?.status
  const threeDSInfo = checkoutResult?.payment?.three_ds_info
  const isThreeDSChallenge = Boolean(
    threeDSInfo?.external_resource_url
    && threeDSInfo?.creq
    && checkoutResult?.payment?.status === 'pending'
    && checkoutResult.payment.status_detail === 'pending_challenge'
  )
  const isApprovedPayment = Boolean(
    checkoutResult && (
      approvedPaymentStatuses.has(String(paymentStatus || ''))
      || approvedLifecycleStatuses.has(String(lifecycleStatus || ''))
      || checkoutResult.order?.status === 'paid'
    )
  )
  const isFinalPaymentFailure = Boolean(
    checkoutResult && (
      finalPaymentFailures.has(String(paymentStatus || ''))
      || finalLifecycleFailures.has(String(lifecycleStatus || ''))
    )
  )
  const memberAreaUrl = checkoutResult?.status?.member_area_url || '/membros'
  const retryCheckoutUrl = checkoutResult?.status?.checkout_url || `/checkout/${checkoutSlug}`
  const statusText = checkoutResult?.status?.label || statusLabel(paymentStatus)
  const statusMessage = isThreeDSChallenge
    ? 'O banco solicitou uma verificacao de seguranca para aprovar o cartao. Conclua a etapa abaixo para liberarmos o acesso.'
    : checkoutResult?.status?.message
  const tone = statusTone(paymentStatus)
  const offerMethods = useMemo(() => new Set((offer.payment_methods || ['pix']).map(String)), [offer.payment_methods])
  const subscriptionProduct = product.access_model === 'subscription' || offerMethods.has('subscription')
  const availablePaymentChoices = useMemo(() => {
    const choices: Array<{ id: PaymentChoice; title: string; detail: string }> = []
    if (offerMethods.has('pix') || offerMethods.has('all')) {
      choices.push({ id: 'pix', title: 'Pix', detail: 'Aprovacao rapida' })
    }
    if (cardPaymentsEnabled && (offerMethods.has('credit_card') || offerMethods.has('card') || offerMethods.has('all'))) {
      choices.push({ id: 'credit_card', title: 'Credito', detail: offer.max_installments > 1 ? `Ate ${offer.max_installments}x` : 'A vista' })
    }
    if (cardPaymentsEnabled && (offerMethods.has('debit_card') || offerMethods.has('card') || offerMethods.has('all'))) {
      choices.push({ id: 'debit_card', title: 'Debito', detail: 'Pagamento imediato' })
    }
    if (subscriptionPaymentsEnabled && subscriptionProduct) {
      choices.push({ id: 'subscription_card', title: 'Assinatura cartao', detail: 'Cobranca recorrente' })
      choices.push({ id: 'subscription_pix', title: 'Assinatura Pix', detail: 'Ativacao pelo Mercado Pago' })
    }
    return choices.length ? choices : [{ id: 'pix' as PaymentChoice, title: 'Pix', detail: 'Aprovacao rapida' }]
  }, [cardPaymentsEnabled, offer.max_installments, offerMethods, subscriptionPaymentsEnabled, subscriptionProduct])
  const requiresCard = paymentChoice === 'credit_card' || paymentChoice === 'debit_card' || paymentChoice === 'subscription_card'
  const submitLabel = paymentChoice === 'pix'
    ? 'Gerar Pix agora'
    : paymentChoice === 'subscription_pix'
      ? 'Ativar assinatura Pix'
      : paymentChoice === 'subscription_card'
        ? 'Assinar com cartao'
        : paymentChoice === 'debit_card'
          ? 'Pagar no debito'
          : 'Pagar no credito'
  const submittingLabel = paymentChoice === 'pix'
    ? 'Gerando Pix...'
    : 'Processando...'

  const toggleBump = (bumpId: string) => {
    setSelectedBumps((current) =>
      current.includes(bumpId)
        ? current.filter((id) => id !== bumpId)
        : [...current, bumpId]
    )
  }

  const validate = () => {
    const doc = cleanDocument(buyerDocument)
    const phoneDigits = normalizeBrazilPhone(phone)
    if (name.trim().length < 3) return 'Informe seu nome completo.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Informe um e-mail válido.'
    if (phoneDigits.length < 12) return 'Informe seu WhatsApp com DDD.'
    if (doc.length !== 11 && doc.length !== 14) return 'Informe CPF ou CNPJ válido.'
    if (!termsAccepted) return 'Confirme os termos para continuar.'
    return ''
  }

  const createCardToken = async () => {
    await loadMercadoPagoSdk()
    if (!window.MercadoPago) throw new Error('Mercado Pago indisponivel.')

    const mp = new window.MercadoPago(mercadoPagoPublicKey, { locale: 'pt-BR' })
    const { month, year } = expirationParts(cardExpiration)
    const documentNumber = cleanDocument(buyerDocument)
    const bin = cardNumber.replace(/\D/g, '').slice(0, 8)
    let paymentMethodId = cardBrand(cardNumber)
    let issuerId = ''

    if (mp.getPaymentMethods && bin.length >= 6) {
      const methods = await mp.getPaymentMethods({ bin }).catch(() => null)
      const result = Array.isArray(methods?.results) ? methods.results[0] : null
      paymentMethodId = text(result?.id, paymentMethodId)
      issuerId = text(result?.issuer?.id || result?.issuer_id)
    }

    const token = await mp.createCardToken?.({
      cardNumber: cardNumber.replace(/\D/g, ''),
      cardholderName: cardholderName.trim(),
      cardExpirationMonth: month,
      cardExpirationYear: year,
      securityCode: cardSecurityCode.replace(/\D/g, ''),
      identificationType: documentNumber.length === 14 ? 'CNPJ' : 'CPF',
      identificationNumber: documentNumber,
    })

    if (!token?.id) throw new Error('Nao foi possivel tokenizar o cartao.')
    if (!paymentMethodId) throw new Error('Nao foi possivel identificar a bandeira do cartao.')
    return { token: token.id, paymentMethodId, issuerId }
  }

  const submitCheckout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setCopied(false)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    if (requiresCard) {
      const exp = expirationParts(cardExpiration)
      if (!mercadoPagoPublicKey) {
        setError('Mercado Pago Public Key nao configurada para cartao.')
        return
      }
      if (cardholderName.trim().length < 3) {
        setError('Informe o nome impresso no cartao.')
        return
      }
      if (cardNumber.replace(/\D/g, '').length < 13) {
        setError('Informe um numero de cartao valido.')
        return
      }
      if (!exp.month || !exp.year) {
        setError('Informe a validade do cartao no formato MM/AA.')
        return
      }
      if (cardSecurityCode.replace(/\D/g, '').length < 3) {
        setError('Informe o codigo de seguranca do cartao.')
        return
      }
    }

    setSubmitting(true)
    try {
      const searchParams = new URLSearchParams(window.location.search)
      const utm = Object.fromEntries(
        Array.from(searchParams.entries()).filter(([key]) => key.startsWith('utm_') || ['src', 'campaign'].includes(key))
      )
      const deviceSessionId = await loadMercadoPagoSecurityScript().catch(() => text(window.MP_DEVICE_SESSION_ID))

      let endpoint = '/api/checkout/pix'
      const payloadBody: Record<string, any> = {
        checkout_slug: checkoutSlug,
        device_session_id: deviceSessionId,
        selected_bump_ids: selectedBumps,
        customer: {
          name,
          email,
          phone,
          document: buyerDocument,
          whatsapp_opt_in: whatsappOptIn,
          email_opt_in: true,
        },
        utm,
        source: 'checkout_page',
      }

      if (paymentChoice === 'credit_card' || paymentChoice === 'debit_card') {
        const cardToken = await createCardToken()
        endpoint = '/api/checkout/card'
        payloadBody.card = {
          token: cardToken.token,
          payment_method_id: cardToken.paymentMethodId,
          payment_type_id: paymentChoice,
          issuer_id: cardToken.issuerId || undefined,
          installments: paymentChoice === 'credit_card' ? Number(installments) || 1 : 1,
        }
      }

      if (paymentChoice === 'subscription_card' || paymentChoice === 'subscription_pix') {
        endpoint = '/api/checkout/subscription'
        const cardToken = paymentChoice === 'subscription_card' ? await createCardToken() : null
        payloadBody.subscription = {
          payment_method: paymentChoice === 'subscription_card' ? 'credit_card' : 'pix',
          card_token: cardToken?.token,
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBody),
      })

      const payload = await response.json().catch(() => ({ success: false, message: 'Resposta inválida do checkout.' }))
      if (!response.ok || !payload.success) {
        setError(payload.message || 'Não foi possível gerar seu Pix agora.')
        return
      }

      setCheckoutResult(payload)
      window.setTimeout(() => {
        window.document.getElementById('payment-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha de conexao ao iniciar o pagamento. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const copyPix = async () => {
    const code = checkoutResult?.payment?.pix_qr_code
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      setError('Não foi possível copiar automaticamente. Selecione o código Pix abaixo.')
    }
  }

  const refreshPaymentStatus = async () => {
    const orderId = checkoutResult?.order?.id
    if (!orderId) return
    setCheckingStatus(true)
    setError('')
    try {
      const response = await fetch(`/api/checkout/orders/${orderId}/refresh-status`, {
        method: 'POST',
        cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) {
        setError(payload.message || 'Não foi possível verificar o pagamento agora.')
        return
      }
      setCheckoutResult((current) => ({
        ...(current || { success: true }),
        order: {
          ...(current?.order || {}),
          ...payload.order,
        },
        payment: payload.payment || current?.payment,
        subscription: payload.subscription || current?.subscription,
        status: payload.status || current?.status,
        fulfillment: payload.fulfillment || current?.fulfillment,
      }) as CheckoutPayload)
    } catch {
      setError('Falha ao verificar pagamento. Tente novamente em instantes.')
    } finally {
      setCheckingStatus(false)
    }
  }

  useEffect(() => {
    loadMercadoPagoSecurityScript().catch(() => '')
  }, [])

  useEffect(() => {
    if (!isThreeDSChallenge || !threeDSInfo?.external_resource_url || !threeDSInfo.creq) return
    const iframe = threeDSFrameRef.current
    const iframeDocument = iframe?.contentWindow?.document
    if (!iframeDocument) return

    iframeDocument.open()
    iframeDocument.write('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#fff;"></body></html>')
    iframeDocument.close()

    const form = iframeDocument.createElement('form')
    form.method = 'POST'
    form.action = threeDSInfo.external_resource_url
    form.style.display = 'none'

    const creq = iframeDocument.createElement('input')
    creq.type = 'hidden'
    creq.name = 'creq'
    creq.value = threeDSInfo.creq
    form.appendChild(creq)

    iframeDocument.body.appendChild(form)
    form.submit()
  }, [isThreeDSChallenge, threeDSInfo?.external_resource_url, threeDSInfo?.creq])

  useEffect(() => {
    if (!isThreeDSChallenge) return
    const onMessage = (event: MessageEvent) => {
      const data = event.data
      if (!data || typeof data !== 'object') return
      const status = text((data as Record<string, unknown>).status || (data as Record<string, unknown>).type).toLowerCase()
      if (!status.includes('complete') && !status.includes('success')) return
      refreshPaymentStatus()
      window.setTimeout(() => refreshPaymentStatus(), 2500)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [isThreeDSChallenge, checkoutResult?.order?.id])

  useEffect(() => {
    const orderId = checkoutResult?.order?.id
    if (!orderId || isApprovedPayment || isFinalPaymentFailure) return

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/checkout/orders/${orderId}/refresh-status`, {
          method: 'POST',
          cache: 'no-store',
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.success) return

        setCheckoutResult((current) => ({
          ...(current || { success: true }),
          order: {
            ...(current?.order || {}),
            ...payload.order,
          },
          payment: payload.payment || current?.payment,
          subscription: payload.subscription || current?.subscription,
          status: payload.status || current?.status,
          fulfillment: payload.fulfillment || current?.fulfillment,
        }) as CheckoutPayload)
      } catch {
        // A verificacao manual segue disponivel se a consulta automatica falhar.
      }
    }, 8000)

    return () => window.clearInterval(interval)
  }, [checkoutResult?.order?.id, isApprovedPayment, isFinalPaymentFailure])

  useEffect(() => {
    if (!isApprovedPayment) return
    const timeout = window.setTimeout(() => {
      window.location.assign(memberAreaUrl)
    }, 2800)
    return () => window.clearTimeout(timeout)
  }, [isApprovedPayment, memberAreaUrl])

  return (
    <main className="cn8-checkout">
      <div className="cn8-checkout-bg" aria-hidden="true" />
      <header className="cn8-checkout-header">
        <Link href="/corretor-nota-8" className="cn8-back-link">
          <ArrowLeft size={16} />
          <span>Voltar para a página do livro</span>
        </Link>
        <span className="cn8-secure-pill">
          <LockKeyhole size={15} />
          Checkout seguro
        </span>
      </header>

      <section className="cn8-checkout-grid">
        <aside className="cn8-product-panel" aria-label="Resumo do produto">
          <div className="cn8-product-visual">
            <Image src={coverImage} alt={product.title} width={420} height={560} priority />
          </div>
          <div className="cn8-product-copy">
            <span>Livro digital</span>
            <h1>{product.title}</h1>
            <p>{product.subtitle || product.description}</p>
            <div className="cn8-product-points">
              <span><Check size={15} /> Acesso digital</span>
              <span><Check size={15} /> Pix, cartao ou assinatura</span>
              <span><Check size={15} /> Liberação após aprovação</span>
            </div>
          </div>
        </aside>

        <section className="cn8-checkout-panel">
          {!checkoutResult ? (
            <>
              <div className="cn8-panel-head">
                <span>Finalizar compra</span>
                <h2>Garanta seu exemplar</h2>
                <p>Preencha seus dados para gerar o Pix e registrar seu acesso ao produto digital.</p>
              </div>

              <form onSubmit={submitCheckout} className="cn8-form">
                <label>
                  Nome completo
                  <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome" autoComplete="name" />
                </label>
                <label>
                  E-mail de acesso
                  <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" autoComplete="email" inputMode="email" />
                </label>
                <label>
                  WhatsApp
                  <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(47) 99999-9999" autoComplete="tel" inputMode="tel" />
                </label>
                <label>
                  CPF ou CNPJ
                  <input value={buyerDocument} onChange={(event) => setBuyerDocument(event.target.value)} placeholder="Somente números" inputMode="numeric" />
                </label>

                <div className="cn8-payment-methods" aria-label="Meios de pagamento">
                  <span className="cn8-mini-title">Pagamento</span>
                  <div>
                    {availablePaymentChoices.map((choice) => (
                      <button
                        key={choice.id}
                        type="button"
                        className={paymentChoice === choice.id ? 'active' : ''}
                        onClick={() => setPaymentChoice(choice.id)}
                      >
                        {choice.id === 'pix' || choice.id === 'subscription_pix' ? <QrCode size={17} /> : <CreditCard size={17} />}
                        <span>
                          <strong>{choice.title}</strong>
                          <small>{choice.detail}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {requiresCard && (
                  <div className="cn8-card-fields">
                    <label>
                      Nome no cartao
                      <input value={cardholderName} onChange={(event) => setCardholderName(event.target.value)} placeholder="Como esta impresso" autoComplete="cc-name" />
                    </label>
                    <label>
                      Numero do cartao
                      <input value={cardNumber} onChange={(event) => setCardNumber(event.target.value)} placeholder="0000 0000 0000 0000" autoComplete="cc-number" inputMode="numeric" />
                    </label>
                    <label>
                      Validade
                      <input value={cardExpiration} onChange={(event) => setCardExpiration(event.target.value)} placeholder="MM/AA" autoComplete="cc-exp" inputMode="numeric" />
                    </label>
                    <label>
                      CVV
                      <input value={cardSecurityCode} onChange={(event) => setCardSecurityCode(event.target.value)} placeholder="123" autoComplete="cc-csc" inputMode="numeric" />
                    </label>
                    {paymentChoice === 'credit_card' && offer.max_installments > 1 && (
                      <label className="cn8-card-installments">
                        Parcelas
                        <select value={installments} onChange={(event) => setInstallments(event.target.value)}>
                          {Array.from({ length: Math.max(1, offer.max_installments) }, (_, index) => index + 1).map((count) => (
                            <option key={count} value={count}>
                              {count}x de {formatCents(Math.ceil(total / count))}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                )}

                {bumps.length > 0 && (
                  <div className="cn8-bumps" aria-label="Order bumps disponíveis">
                    <span className="cn8-mini-title">Oferta adicional</span>
                    {bumps.map((bump) => {
                      const active = selectedBumps.includes(bump.id)
                      return (
                        <button
                          type="button"
                          key={bump.id}
                          className={`cn8-bump ${active ? 'active' : ''}`}
                          onClick={() => toggleBump(bump.id)}
                        >
                          <span className="cn8-bump-check">{active ? <Check size={15} /> : null}</span>
                          <span>
                            <strong>{bump.title}</strong>
                            {bump.description && <small>{bump.description}</small>}
                          </span>
                          <b>{formatCents(bump.price_cents)}</b>
                        </button>
                      )
                    })}
                  </div>
                )}

                <div className="cn8-consent">
                  <label>
                    <input type="checkbox" checked={whatsappOptIn} onChange={(event) => setWhatsappOptIn(event.target.checked)} />
                    <span>Receber informações da compra pelo WhatsApp.</span>
                  </label>
                  <label>
                    <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
                    <span>Li e aceito os termos de compra digital.</span>
                  </label>
                </div>

                <div className="cn8-order-summary" aria-label="Resumo do pedido">
                  <div>
                    <span>{offer.name}</span>
                    <strong>{formatCents(offer.price_cents)}</strong>
                  </div>
                  {selectedBumpRows.map((bump) => (
                    <div key={bump.id}>
                      <span>{bump.title}</span>
                      <strong>{formatCents(bump.price_cents)}</strong>
                    </div>
                  ))}
                  <div className="total">
                    <span>Total</span>
                    <strong>{formatCents(total)}</strong>
                  </div>
                </div>

                {error && <p className="cn8-error">{error}</p>}

                <button className="cn8-submit" type="submit" disabled={submitting}>
                  {submitting ? <Loader2 size={18} className="cn8-spin" /> : paymentChoice === 'pix' || paymentChoice === 'subscription_pix' ? <QrCode size={18} /> : <CreditCard size={18} />}
                  <span>{submitting ? submittingLabel : submitLabel}</span>
                </button>

                <div className="cn8-safety">
                  <span><ShieldCheck size={15} /> Seus dados são usados para pagamento e acesso.</span>
                  <span><CreditCard size={15} /> Cobrança processada pelo Mercado Pago.</span>
                </div>
              </form>
            </>
          ) : (
            <section id="payment-result" className="cn8-pix-panel" aria-live="polite">
              <span className={`cn8-status ${tone}`}>
                <BadgeCheck size={16} />
                {statusText}
              </span>
              <h2>{isApprovedPayment ? 'Pagamento aprovado' : checkoutResult.subscription ? 'Assinatura criada' : checkoutResult.payment?.pix_qr_code ? 'Pix gerado' : 'Pagamento registrado'} para o pedido {checkoutResult.order?.order_number}</h2>
              <p className="cn8-pix-subtitle">
                {isApprovedPayment
                  ? <>Parabens. Seu acesso foi liberado e enviamos no WhatsApp o link para entrar na area de membros. Abrindo a biblioteca automaticamente...</>
                  : isFinalPaymentFailure
                    ? <>{statusMessage || 'Esse pagamento nao esta mais ativo. Voce pode tentar novamente pelo checkout.'}</>
                    : <>Valor: <strong>{checkoutResult.order?.total_display}</strong>. {statusMessage || 'Esta tela verifica automaticamente a aprovacao e libera o acesso assim que o Mercado Pago confirmar.'}</>}
              </p>

              {isThreeDSChallenge && (
                <div className="cn8-three-ds">
                  <div>
                    <strong>Confirme com o banco para aprovar o cartao</strong>
                    <small>Essa verificacao ajuda o Mercado Pago a aprovar compras que poderiam ser recusadas por seguranca.</small>
                  </div>
                  <iframe ref={threeDSFrameRef} title="Verificacao segura do cartao" />
                  <button type="button" onClick={refreshPaymentStatus} disabled={checkingStatus}>
                    {checkingStatus ? <Loader2 size={16} className="cn8-spin" /> : <RefreshCw size={16} />}
                    Ja confirmei
                  </button>
                </div>
              )}

              {isApprovedPayment && (
                <div className="cn8-access-card">
                  <strong>Acesso liberado na area de membros</strong>
                  <a href={memberAreaUrl}>Entrar agora</a>
                </div>
              )}

              {isFinalPaymentFailure && (
                <div className="cn8-access-card">
                  <strong>Quer tentar novamente?</strong>
                  <a href={retryCheckoutUrl}>Gerar novo pagamento</a>
                </div>
              )}

              {!isApprovedPayment && !isFinalPaymentFailure && checkoutResult.subscription?.init_point && checkoutResult.payment?.status !== 'approved' && (
                <div className="cn8-subscription-link">
                  <strong>Finalize a ativacao recorrente no Mercado Pago.</strong>
                  <a href={checkoutResult.subscription.init_point} target="_blank" rel="noreferrer">
                    Abrir ativacao da assinatura
                  </a>
                </div>
              )}

              {!isApprovedPayment && !isFinalPaymentFailure && checkoutResult.payment?.pix_qr_code_base64 && (
                <div className="cn8-qr">
                  <img src={`data:image/png;base64,${checkoutResult.payment.pix_qr_code_base64}`} alt="QR Code Pix" />
                </div>
              )}

              {!isApprovedPayment && !isFinalPaymentFailure && checkoutResult.payment?.pix_qr_code && (
                <div className="cn8-copy-box">
                  <textarea readOnly value={checkoutResult.payment.pix_qr_code} aria-label="Código Pix copia e cola" />
                  <button type="button" onClick={copyPix}>
                    <Copy size={16} />
                    {copied ? 'Copiado' : 'Copiar Pix'}
                  </button>
                </div>
              )}

              <div className="cn8-pix-actions">
                {!isApprovedPayment && !isFinalPaymentFailure && (
                  <button type="button" onClick={refreshPaymentStatus} disabled={checkingStatus}>
                    {checkingStatus ? <Loader2 size={16} className="cn8-spin" /> : <RefreshCw size={16} />}
                    Verificar pagamento
                  </button>
                )}
                {!isApprovedPayment && !isFinalPaymentFailure && checkoutResult.payment?.pix_ticket_url && (
                  <a href={checkoutResult.payment.pix_ticket_url} target="_blank" rel="noreferrer">
                    Abrir no Mercado Pago
                  </a>
                )}
                {isApprovedPayment && (
                  <a href={memberAreaUrl}>
                    Abrir area de membros
                  </a>
                )}
              </div>

              {error && <p className="cn8-error">{error}</p>}
            </section>
          )}
        </section>
      </section>

      <style jsx global>{`
        .cn8-checkout {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          background: #020607;
          color: #f8f2e8;
          font-family: Montserrat, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: 0;
          padding: 22px;
        }

        .cn8-checkout * {
          box-sizing: border-box;
          letter-spacing: 0;
        }

        .cn8-checkout-bg {
          position: fixed;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(2, 6, 7, 0.96), rgba(2, 6, 7, 0.72)),
            url("/images/products/corretor-nota-8-hero-bg-optimized.jpg") center / cover no-repeat;
          opacity: 0.62;
          transform: scale(1.02);
        }

        .cn8-checkout-header,
        .cn8-checkout-grid {
          position: relative;
          z-index: 1;
          width: min(1120px, 100%);
          margin: 0 auto;
        }

        .cn8-checkout-header {
          min-height: 42px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 24px;
        }

        .cn8-back-link,
        .cn8-secure-pill {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: rgba(248, 242, 232, 0.82);
          text-decoration: none;
          font-size: 0.84rem;
          font-weight: 800;
        }

        .cn8-secure-pill {
          padding: 0 12px;
          border: 1px solid rgba(218, 166, 76, 0.25);
          border-radius: 999px;
          background: rgba(2, 6, 7, 0.44);
          color: #e4b75d;
        }

        .cn8-checkout-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.92fr) minmax(420px, 0.78fr);
          gap: 24px;
          align-items: start;
        }

        .cn8-product-panel,
        .cn8-checkout-panel {
          border: 1px solid rgba(218, 166, 76, 0.22);
          background: rgba(2, 10, 12, 0.82);
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
          backdrop-filter: blur(16px);
        }

        .cn8-product-panel {
          min-height: calc(100vh - 92px);
          display: grid;
          grid-template-columns: 0.78fr 1fr;
          align-items: center;
          gap: 26px;
          padding: 30px;
        }

        .cn8-product-visual {
          width: 100%;
          max-width: 280px;
          justify-self: center;
          border: 1px solid rgba(218, 166, 76, 0.36);
          border-radius: 8px;
          padding: 10px;
          background: linear-gradient(180deg, rgba(218, 166, 76, 0.16), rgba(255, 255, 255, 0.03));
        }

        .cn8-product-visual img {
          display: block;
          width: 100%;
          height: auto;
          border-radius: 4px;
        }

        .cn8-product-copy {
          min-width: 0;
        }

        .cn8-product-copy > span,
        .cn8-panel-head > span,
        .cn8-mini-title {
          display: inline-flex;
          min-height: 24px;
          align-items: center;
          border: 1px solid rgba(218, 166, 76, 0.46);
          border-radius: 6px;
          padding: 0 8px;
          color: #e7b452;
          font-size: 0.72rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .cn8-product-copy h1 {
          margin: 16px 0 12px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(2rem, 4.6vw, 4.2rem);
          line-height: 0.95;
        }

        .cn8-product-copy p {
          max-width: 520px;
          margin: 0;
          color: rgba(248, 242, 232, 0.76);
          line-height: 1.6;
          font-size: 1rem;
        }

        .cn8-product-points {
          display: grid;
          gap: 10px;
          margin-top: 24px;
        }

        .cn8-product-points span {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          color: rgba(248, 242, 232, 0.86);
          font-size: 0.9rem;
          font-weight: 800;
        }

        .cn8-product-points svg {
          color: #e7b452;
        }

        .cn8-checkout-panel {
          padding: 26px;
        }

        .cn8-panel-head h2,
        .cn8-pix-panel h2 {
          margin: 12px 0 8px;
          color: #fff8ec;
          font-size: clamp(1.55rem, 2.4vw, 2.2rem);
          line-height: 1.05;
        }

        .cn8-panel-head p,
        .cn8-pix-subtitle {
          margin: 0;
          color: rgba(248, 242, 232, 0.7);
          line-height: 1.55;
          font-size: 0.94rem;
        }

        .cn8-form {
          display: grid;
          gap: 14px;
          margin-top: 22px;
        }

        .cn8-form label {
          display: grid;
          gap: 7px;
          color: rgba(248, 242, 232, 0.82);
          font-size: 0.82rem;
          font-weight: 900;
        }

        .cn8-form input,
        .cn8-form select,
        .cn8-copy-box textarea {
          width: 100%;
          min-height: 46px;
          border: 1px solid rgba(248, 242, 232, 0.16);
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.06);
          color: #fff8ec;
          padding: 0 13px;
          font: inherit;
          outline: none;
        }

        .cn8-form input:focus,
        .cn8-form select:focus,
        .cn8-copy-box textarea:focus {
          border-color: rgba(231, 180, 82, 0.72);
          box-shadow: 0 0 0 3px rgba(231, 180, 82, 0.12);
        }

        .cn8-payment-methods,
        .cn8-card-fields {
          display: grid;
          gap: 10px;
        }

        .cn8-payment-methods > div {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 9px;
        }

        .cn8-payment-methods button {
          min-height: 58px;
          display: flex;
          align-items: center;
          gap: 9px;
          border: 1px solid rgba(248, 242, 232, 0.16);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          color: #fff8ec;
          padding: 10px;
          text-align: left;
          cursor: pointer;
        }

        .cn8-payment-methods button.active {
          border-color: rgba(231, 180, 82, 0.72);
          background: rgba(231, 180, 82, 0.12);
        }

        .cn8-payment-methods button svg {
          flex: 0 0 auto;
          color: #e7b452;
        }

        .cn8-payment-methods button span {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .cn8-payment-methods button strong {
          font-size: 0.82rem;
        }

        .cn8-payment-methods button small {
          color: rgba(248, 242, 232, 0.58);
          font-size: 0.72rem;
        }

        .cn8-card-fields {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          border: 1px solid rgba(248, 242, 232, 0.12);
          border-radius: 8px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.035);
        }

        .cn8-card-fields label:nth-child(1),
        .cn8-card-fields label:nth-child(2),
        .cn8-card-installments {
          grid-column: 1 / -1;
        }

        .cn8-subscription-link,
        .cn8-access-card {
          display: grid;
          gap: 10px;
          border: 1px solid rgba(231, 180, 82, 0.28);
          border-radius: 8px;
          padding: 14px;
          background: rgba(231, 180, 82, 0.1);
        }

        .cn8-three-ds {
          display: grid;
          gap: 12px;
          margin-top: 18px;
          border: 1px solid rgba(96, 165, 250, 0.34);
          border-radius: 8px;
          padding: 14px;
          background: rgba(37, 99, 235, 0.12);
        }

        .cn8-three-ds > div {
          display: grid;
          gap: 5px;
        }

        .cn8-three-ds strong {
          color: #fff8ec;
          font-size: 0.92rem;
        }

        .cn8-three-ds small {
          color: rgba(248, 242, 232, 0.7);
          line-height: 1.45;
        }

        .cn8-three-ds iframe {
          width: 100%;
          min-height: 430px;
          border: 1px solid rgba(248, 242, 232, 0.18);
          border-radius: 7px;
          background: #fff;
        }

        .cn8-three-ds button {
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid rgba(96, 165, 250, 0.45);
          border-radius: 7px;
          background: rgba(37, 99, 235, 0.2);
          color: #dbeafe;
          font-weight: 900;
          cursor: pointer;
        }

        .cn8-subscription-link strong,
        .cn8-access-card strong {
          color: #fff8ec;
          font-size: 0.9rem;
        }

        .cn8-subscription-link a,
        .cn8-access-card a {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          background: #eab957;
          color: #071013;
          text-decoration: none;
          font-weight: 950;
        }

        .cn8-bumps {
          display: grid;
          gap: 10px;
          margin: 4px 0;
        }

        .cn8-bump {
          display: grid;
          grid-template-columns: 26px minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          text-align: left;
          border: 1px solid rgba(248, 242, 232, 0.16);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          color: #fff8ec;
          padding: 12px;
          cursor: pointer;
        }

        .cn8-bump.active {
          border-color: rgba(231, 180, 82, 0.72);
          background: rgba(231, 180, 82, 0.12);
        }

        .cn8-bump-check {
          width: 24px;
          height: 24px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(231, 180, 82, 0.5);
          border-radius: 50%;
          color: #e7b452;
        }

        .cn8-bump strong,
        .cn8-bump b {
          font-size: 0.88rem;
        }

        .cn8-bump small {
          display: block;
          margin-top: 3px;
          color: rgba(248, 242, 232, 0.62);
          font-size: 0.76rem;
          line-height: 1.35;
        }

        .cn8-consent {
          display: grid;
          gap: 9px;
          margin: 3px 0;
        }

        .cn8-consent label {
          display: flex;
          grid-template-columns: unset;
          align-items: flex-start;
          gap: 9px;
          color: rgba(248, 242, 232, 0.72);
          font-size: 0.78rem;
          line-height: 1.4;
        }

        .cn8-consent input {
          width: 17px;
          height: 17px;
          min-height: 17px;
          margin-top: 1px;
          accent-color: #dba64c;
        }

        .cn8-order-summary {
          display: grid;
          gap: 9px;
          border-top: 1px solid rgba(248, 242, 232, 0.12);
          border-bottom: 1px solid rgba(248, 242, 232, 0.12);
          padding: 14px 0;
        }

        .cn8-order-summary div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: rgba(248, 242, 232, 0.72);
          font-size: 0.86rem;
        }

        .cn8-order-summary .total {
          color: #fff8ec;
          font-size: 1.02rem;
        }

        .cn8-submit,
        .cn8-pix-actions button,
        .cn8-pix-actions a,
        .cn8-copy-box button {
          min-height: 48px;
          border: 0;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          font-weight: 950;
          text-decoration: none;
          cursor: pointer;
        }

        .cn8-submit {
          width: 100%;
          background: linear-gradient(135deg, #eab957, #c98f2f);
          color: #071013;
          text-transform: uppercase;
          font-size: 0.86rem;
        }

        .cn8-submit:disabled,
        .cn8-pix-actions button:disabled {
          opacity: 0.72;
          cursor: wait;
        }

        .cn8-safety {
          display: grid;
          gap: 8px;
          color: rgba(248, 242, 232, 0.58);
          font-size: 0.76rem;
        }

        .cn8-safety span {
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }

        .cn8-error {
          margin: 0;
          border: 1px solid rgba(239, 68, 68, 0.35);
          border-radius: 6px;
          background: rgba(239, 68, 68, 0.11);
          color: #fecaca;
          padding: 10px 12px;
          font-size: 0.84rem;
          line-height: 1.4;
        }

        .cn8-pix-panel {
          display: grid;
          gap: 16px;
        }

        .cn8-status {
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 7px 11px;
          font-size: 0.78rem;
          font-weight: 900;
        }

        .cn8-status.success {
          background: rgba(34, 197, 94, 0.14);
          color: #86efac;
        }

        .cn8-status.warning {
          background: rgba(234, 179, 8, 0.14);
          color: #fde68a;
        }

        .cn8-status.danger {
          background: rgba(239, 68, 68, 0.14);
          color: #fecaca;
        }

        .cn8-qr {
          width: min(260px, 100%);
          border: 1px solid rgba(231, 180, 82, 0.28);
          border-radius: 8px;
          background: #fff;
          padding: 12px;
        }

        .cn8-qr img {
          display: block;
          width: 100%;
          height: auto;
        }

        .cn8-copy-box {
          display: grid;
          gap: 10px;
        }

        .cn8-copy-box textarea {
          min-height: 98px;
          resize: vertical;
          padding: 12px;
          font-size: 0.78rem;
          line-height: 1.35;
        }

        .cn8-copy-box button,
        .cn8-pix-actions button,
        .cn8-pix-actions a {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(248, 242, 232, 0.18);
          color: #fff8ec;
          padding: 0 14px;
        }

        .cn8-pix-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .cn8-spin {
          animation: cn8spin 1s linear infinite;
        }

        @keyframes cn8spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 980px) {
          .cn8-checkout {
            padding: 16px;
          }

          .cn8-checkout-grid {
            grid-template-columns: 1fr;
          }

          .cn8-product-panel {
            min-height: auto;
            grid-template-columns: 150px minmax(0, 1fr);
            padding: 18px;
          }

          .cn8-product-copy h1 {
            font-size: 2.15rem;
          }
        }

        @media (max-width: 640px) {
          .cn8-checkout {
            padding: 12px;
          }

          .cn8-checkout-header {
            align-items: flex-start;
          }

          .cn8-back-link span {
            display: none;
          }

          .cn8-product-panel {
            grid-template-columns: 112px minmax(0, 1fr);
            gap: 14px;
            padding: 14px;
          }

          .cn8-product-visual {
            padding: 6px;
          }

          .cn8-product-copy h1 {
            margin: 10px 0 8px;
            font-size: 1.62rem;
          }

          .cn8-product-copy p {
            font-size: 0.84rem;
            line-height: 1.45;
          }

          .cn8-product-points {
            display: none;
          }

          .cn8-checkout-panel {
            padding: 17px;
          }

          .cn8-payment-methods > div,
          .cn8-card-fields {
            grid-template-columns: 1fr;
          }

          .cn8-panel-head h2,
          .cn8-pix-panel h2 {
            font-size: 1.55rem;
          }

          .cn8-bump {
            grid-template-columns: 24px minmax(0, 1fr);
          }

          .cn8-bump b {
            grid-column: 2;
          }
        }
      `}</style>
    </main>
  )
}
