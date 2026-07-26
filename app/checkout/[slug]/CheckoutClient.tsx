'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, BadgeCheck, Check, Copy, CreditCard, Loader2, LockKeyhole, QrCode, RefreshCw, ShieldCheck } from 'lucide-react'
import type { CheckoutBumpRow, CheckoutOfferRow, CheckoutProductRow } from '@/lib/commerce/checkout'

type CheckoutPayload = {
  success: boolean
  message?: string
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
    pix_qr_code: string
    pix_qr_code_base64: string
    pix_ticket_url: string
    expires_at: string
  }
}

type CheckoutClientProps = {
  checkoutSlug: string
  product: CheckoutProductRow
  offer: CheckoutOfferRow
  bumps: CheckoutBumpRow[]
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

function cleanPhone(value: string) {
  return value.replace(/\D/g, '').slice(0, 13)
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
  if (status === 'rejected' || status === 'cancelled' || status === 'expired') return 'danger'
  return 'warning'
}

export default function CheckoutClient({ checkoutSlug, product, offer, bumps }: CheckoutClientProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [buyerDocument, setBuyerDocument] = useState('')
  const [whatsappOptIn, setWhatsappOptIn] = useState(true)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [selectedBumps, setSelectedBumps] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [error, setError] = useState('')
  const [checkoutResult, setCheckoutResult] = useState<CheckoutPayload | null>(null)
  const [copied, setCopied] = useState(false)

  const selectedBumpRows = useMemo(
    () => bumps.filter((bump) => selectedBumps.includes(bump.id)),
    [bumps, selectedBumps]
  )
  const bumpTotal = selectedBumpRows.reduce((total, bump) => total + bump.price_cents, 0)
  const total = offer.price_cents + bumpTotal
  const coverImage = product.cover_image_url || product.thumbnail_url || '/images/products/corretor-nota-8-cover.webp'
  const paymentStatus = checkoutResult?.payment?.status || checkoutResult?.order?.status
  const tone = statusTone(paymentStatus)

  const toggleBump = (bumpId: string) => {
    setSelectedBumps((current) =>
      current.includes(bumpId)
        ? current.filter((id) => id !== bumpId)
        : [...current, bumpId]
    )
  }

  const validate = () => {
    const doc = cleanDocument(buyerDocument)
    const phoneDigits = cleanPhone(phone)
    if (name.trim().length < 3) return 'Informe seu nome completo.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Informe um e-mail válido.'
    if (phoneDigits.length < 12) return 'Informe seu WhatsApp com DDD.'
    if (doc.length !== 11 && doc.length !== 14) return 'Informe CPF ou CNPJ válido.'
    if (!termsAccepted) return 'Confirme os termos para continuar.'
    return ''
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

    setSubmitting(true)
    try {
      const searchParams = new URLSearchParams(window.location.search)
      const utm = Object.fromEntries(
        Array.from(searchParams.entries()).filter(([key]) => key.startsWith('utm_') || ['src', 'campaign'].includes(key))
      )

      const response = await fetch('/api/checkout/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkout_slug: checkoutSlug,
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
        }),
      })

      const payload = await response.json().catch(() => ({ success: false, message: 'Resposta inválida do checkout.' }))
      if (!response.ok || !payload.success) {
        setError(payload.message || 'Não foi possível gerar seu Pix agora.')
        return
      }

      setCheckoutResult(payload)
      window.setTimeout(() => {
        window.document.getElementById('pix')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    } catch {
      setError('Falha de conexão ao gerar o Pix. Tente novamente.')
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
      const response = await fetch(`/api/checkout/orders/${orderId}`, { cache: 'no-store' })
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
      }) as CheckoutPayload)
    } catch {
      setError('Falha ao verificar pagamento. Tente novamente em instantes.')
    } finally {
      setCheckingStatus(false)
    }
  }

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
              <span><Check size={15} /> Pagamento via Pix</span>
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
                  {submitting ? <Loader2 size={18} className="cn8-spin" /> : <QrCode size={18} />}
                  <span>{submitting ? 'Gerando Pix...' : 'Gerar Pix agora'}</span>
                </button>

                <div className="cn8-safety">
                  <span><ShieldCheck size={15} /> Seus dados são usados para pagamento e acesso.</span>
                  <span><CreditCard size={15} /> Cobrança processada pelo Mercado Pago.</span>
                </div>
              </form>
            </>
          ) : (
            <section id="pix" className="cn8-pix-panel" aria-live="polite">
              <span className={`cn8-status ${tone}`}>
                <BadgeCheck size={16} />
                {statusLabel(paymentStatus)}
              </span>
              <h2>Pix gerado para o pedido {checkoutResult.order?.order_number}</h2>
              <p className="cn8-pix-subtitle">
                Valor: <strong>{checkoutResult.order?.total_display}</strong>. Após o pagamento, a confirmação será registrada no sistema.
              </p>

              {checkoutResult.payment?.pix_qr_code_base64 && (
                <div className="cn8-qr">
                  <img src={`data:image/png;base64,${checkoutResult.payment.pix_qr_code_base64}`} alt="QR Code Pix" />
                </div>
              )}

              {checkoutResult.payment?.pix_qr_code && (
                <div className="cn8-copy-box">
                  <textarea readOnly value={checkoutResult.payment.pix_qr_code} aria-label="Código Pix copia e cola" />
                  <button type="button" onClick={copyPix}>
                    <Copy size={16} />
                    {copied ? 'Copiado' : 'Copiar Pix'}
                  </button>
                </div>
              )}

              <div className="cn8-pix-actions">
                <button type="button" onClick={refreshPaymentStatus} disabled={checkingStatus}>
                  {checkingStatus ? <Loader2 size={16} className="cn8-spin" /> : <RefreshCw size={16} />}
                  Verificar pagamento
                </button>
                {checkoutResult.payment?.pix_ticket_url && (
                  <a href={checkoutResult.payment.pix_ticket_url} target="_blank" rel="noreferrer">
                    Abrir no Mercado Pago
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
        .cn8-copy-box textarea:focus {
          border-color: rgba(231, 180, 82, 0.72);
          box-shadow: 0 0 0 3px rgba(231, 180, 82, 0.12);
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
