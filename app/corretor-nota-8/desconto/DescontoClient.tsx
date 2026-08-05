'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Gift } from 'lucide-react'
import { Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { trackEvent } from '@/lib/tracking/client'

const landingPath = '/corretor-nota-8'
const bridgeOffer = 'votacao_livro_desconto'
const coverImage = '/images/products/corretor-nota-8-cover.webp'

function buildLandingHref(search = '') {
  const params = new URLSearchParams(search)

  if (!params.get('utm_source')) params.set('utm_source', 'instagram')
  if (!params.get('utm_medium')) params.set('utm_medium', 'direct')
  if (!params.get('utm_campaign')) params.set('utm_campaign', 'votacao_livro')
  if (!params.get('oferta')) params.set('oferta', bridgeOffer)
  if (!params.get('desconto')) params.set('desconto', '30')

  const query = params.toString()
  return query ? `${landingPath}?${query}` : landingPath
}

function DiscountBridgeContent({ search = '' }: { search?: string }) {
  const landingHref = useMemo(() => buildLandingHref(search), [search])

  const handleCtaClick = () => {
    void trackEvent('discount_bridge_cta_clicked', {
      product: 'corretor-nota-8',
      discount_percent: 30,
      original_price: 'R$ 97,00',
      promotional_price: 'R$ 67,90',
      source: 'corretor_nota_8_discount_bridge',
      destination_url: landingHref,
      preserved_search_params: typeof window !== 'undefined' ? window.location.search : '',
    })
  }

  return (
    <main className="discount-bridge-page">
      <section className="discount-bridge" aria-labelledby="discount-bridge-title">
        <div className="discount-bridge-shell">
          <div className="discount-bridge-copy">
            <span className="discount-bridge-badge">
              <Gift size={15} aria-hidden="true" />
              Presente de agradecimento
            </span>

            <h1 id="discount-bridge-title">Obrigado pelo apoio.</h1>

            <p className="discount-bridge-lead">
              Como agradecimento pelo seu apoio à votação, liberamos uma condição especial
              para você conhecer o livro digital Corretor Nota 8.
            </p>

            <div className="discount-offer-card" aria-label="Oferta especial do livro Corretor Nota 8">
              <div className="discount-offer-thumb" aria-hidden="true">
                <Image
                  src={coverImage}
                  alt=""
                  width={96}
                  height={124}
                  priority
                  sizes="96px"
                />
              </div>
              <div className="discount-offer-price">
                <span>De R$ 97,00</span>
                <strong>R$ 67,90</strong>
              </div>
            </div>

            <Link className="discount-bridge-cta" href={landingHref} onClick={handleCtaClick}>
              Ver o livro com 30% de desconto
              <ArrowRight size={18} aria-hidden="true" />
            </Link>

            <p className="discount-bridge-note">
              Você poderá conhecer todos os detalhes antes de comprar. O desconto será
              aplicado automaticamente na próxima página.
            </p>
          </div>

          <div className="discount-bridge-visual" aria-hidden="true">
            <div className="discount-book-frame">
              <Image
                src={coverImage}
                alt="Capa do livro Corretor Nota 8"
                width={420}
                height={560}
                sizes="330px"
              />
            </div>
          </div>
        </div>
      </section>

      <style jsx global>{`
        html,
        body {
          background: #020707 !important;
        }

        body {
          margin: 0;
        }

        .discount-bridge-page,
        .discount-bridge-page * {
          box-sizing: border-box;
        }

        .discount-bridge-page {
          min-height: 100svh;
          overflow-x: hidden;
          color: #fffaf0;
          background: #020707;
        }

        .discount-bridge {
          position: relative;
          display: flex;
          min-height: 100svh;
          align-items: center;
          overflow: hidden;
          padding: clamp(30px, 5vh, 54px) 0;
          background:
            radial-gradient(circle at 72% 48%, rgba(232, 176, 73, 0.18), transparent 24rem),
            radial-gradient(circle at 16% 18%, rgba(255, 255, 255, 0.055), transparent 18rem),
            linear-gradient(135deg, #020707 0%, #061010 56%, #020707 100%);
        }

        .discount-bridge::before {
          position: absolute;
          inset: 0;
          content: "";
          pointer-events: none;
          opacity: 0.12;
          background: url("/images/products/corretor-nota-8-hero-bg-optimized.jpg") right center / cover no-repeat;
          mask-image: linear-gradient(90deg, transparent 0%, #000 68%, #000 100%);
        }

        .discount-bridge-shell {
          position: relative;
          z-index: 1;
          display: grid;
          width: min(1160px, calc(100% - 44px));
          margin: 0 auto;
          grid-template-columns: minmax(0, 1fr) minmax(280px, 380px);
          align-items: center;
          gap: clamp(42px, 6vw, 76px);
        }

        .discount-bridge-copy {
          max-width: 650px;
          animation: discountFadeIn 420ms ease-out both;
        }

        .discount-bridge-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 34px;
          margin-bottom: 18px;
          padding: 0 11px;
          border: 1px solid rgba(232, 176, 73, 0.5);
          border-radius: 7px;
          color: #e8b049;
          background: rgba(232, 176, 73, 0.08);
          font-size: 0.72rem;
          font-weight: 950;
          letter-spacing: 0;
          text-transform: uppercase;
        }

        .discount-bridge-page h1 {
          max-width: 610px;
          margin: 0;
          color: #fffaf0;
          font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
          font-size: clamp(3.6rem, 6vw, 5.5rem);
          font-weight: 700;
          letter-spacing: 0;
          line-height: 0.94;
        }

        .discount-bridge-lead {
          max-width: 610px;
          margin: 20px 0 0;
          color: rgba(255, 250, 240, 0.76);
          font-size: clamp(1rem, 1.45vw, 1.12rem);
          line-height: 1.68;
        }

        .discount-offer-card {
          display: inline-grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 18px;
          width: min(100%, 390px);
          margin-top: 28px;
          padding: 16px 18px;
          border: 1px solid rgba(232, 176, 73, 0.2);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.045);
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.2);
        }

        .discount-offer-thumb {
          display: none;
          width: 70px;
          overflow: hidden;
          border: 1px solid rgba(232, 176, 73, 0.28);
          border-radius: 6px;
          background: rgba(232, 176, 73, 0.08);
        }

        .discount-offer-thumb img {
          display: block;
          width: 100%;
          height: auto;
          object-fit: contain;
        }

        .discount-offer-price {
          display: grid;
          gap: 4px;
        }

        .discount-offer-price span {
          color: rgba(255, 250, 240, 0.58);
          font-size: 0.92rem;
          font-weight: 850;
          line-height: 1.2;
          text-decoration: line-through;
        }

        .discount-offer-price strong {
          color: #e8b049;
          font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
          font-size: clamp(2.55rem, 4vw, 3.4rem);
          font-weight: 750;
          letter-spacing: 0;
          line-height: 1;
        }

        .discount-bridge-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-height: 54px;
          width: min(100%, 382px);
          margin-top: 24px;
          padding: 0 20px;
          border: 1px solid rgba(255, 227, 159, 0.12);
          border-radius: 7px;
          color: #041011;
          background: linear-gradient(135deg, #f4c761 0%, #d99a2c 100%);
          box-shadow: 0 18px 36px rgba(232, 176, 73, 0.2);
          font-size: 0.82rem;
          font-weight: 950;
          line-height: 1.12;
          text-align: center;
          text-decoration: none;
          text-transform: uppercase;
          transition:
            transform 160ms ease,
            box-shadow 160ms ease,
            filter 160ms ease;
          white-space: normal;
        }

        .discount-bridge-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 22px 42px rgba(232, 176, 73, 0.28);
          filter: saturate(1.04);
        }

        .discount-bridge-cta:active {
          transform: translateY(0);
          box-shadow: 0 12px 24px rgba(232, 176, 73, 0.2);
        }

        .discount-bridge-cta:focus-visible {
          outline: 3px solid rgba(255, 238, 189, 0.88);
          outline-offset: 4px;
        }

        .discount-bridge-note {
          max-width: 430px;
          margin: 14px 0 0;
          color: rgba(255, 250, 240, 0.62);
          font-size: 0.88rem;
          line-height: 1.55;
        }

        .discount-bridge-visual {
          display: flex;
          justify-content: center;
          animation: discountFadeIn 520ms 90ms ease-out both;
        }

        .discount-book-frame {
          position: relative;
          width: min(100%, 330px);
          padding: 12px;
          border: 1px solid rgba(232, 176, 73, 0.32);
          border-radius: 8px;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.02)),
            rgba(232, 176, 73, 0.06);
          box-shadow:
            0 28px 70px rgba(0, 0, 0, 0.42),
            0 0 90px rgba(232, 176, 73, 0.16);
        }

        .discount-book-frame::before {
          position: absolute;
          inset: 10% -18% -10%;
          z-index: -1;
          content: "";
          border-radius: 999px;
          background: radial-gradient(circle, rgba(232, 176, 73, 0.26), transparent 62%);
          filter: blur(8px);
        }

        .discount-book-frame img {
          display: block;
          width: 100%;
          height: auto;
          border-radius: 5px;
          object-fit: contain;
        }

        @keyframes discountFadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 860px) {
          .discount-bridge {
            align-items: flex-start;
            min-height: 100svh;
            padding: 34px 0 28px;
            background:
              radial-gradient(circle at 82% 8%, rgba(232, 176, 73, 0.16), transparent 16rem),
              radial-gradient(circle at 18% 22%, rgba(255, 255, 255, 0.04), transparent 14rem),
              linear-gradient(180deg, #020707 0%, #061010 58%, #020707 100%);
          }

          .discount-bridge::before {
            display: block;
            opacity: 0.26;
            background-position: right center;
            background-size: auto 100%;
            mask-image: linear-gradient(180deg, #000 0%, #000 72%, transparent 100%);
          }

          .discount-bridge-shell {
            display: block;
            width: min(calc(100% - 40px), 430px);
          }

          .discount-bridge-copy {
            max-width: none;
          }

          .discount-bridge-page h1 {
            max-width: 360px;
            font-size: clamp(2.46rem, 11vw, 3.1rem);
            line-height: 0.96;
          }

          .discount-bridge-lead {
            max-width: 390px;
            margin-top: 16px;
            font-size: 0.96rem;
            line-height: 1.58;
          }

          .discount-offer-card {
            display: grid;
            width: 100%;
            min-height: 112px;
            margin-top: 22px;
            padding: 12px;
          }

          .discount-offer-thumb {
            display: block;
          }

          .discount-offer-price strong {
            font-size: clamp(2.08rem, 9vw, 2.48rem);
          }

          .discount-bridge-cta {
            width: 100%;
            min-height: 56px;
            margin-top: 18px;
            padding: 0 16px;
            font-size: 0.78rem;
          }

          .discount-bridge-note {
            max-width: 100%;
            margin-top: 12px;
            font-size: 0.82rem;
            line-height: 1.48;
          }

          .discount-bridge-visual {
            display: none;
          }
        }

        @media (max-width: 390px) {
          .discount-bridge-shell {
            width: calc(100% - 36px);
          }

          .discount-bridge-page h1 {
            font-size: 2.34rem;
          }

          .discount-bridge-lead {
            font-size: 0.92rem;
          }

          .discount-bridge-cta {
            gap: 8px;
            padding: 0 12px;
            font-size: 0.7rem;
          }

          .discount-offer-card {
            gap: 14px;
          }

          .discount-offer-thumb {
            width: 62px;
          }
        }

        @media (max-width: 370px) {
          .discount-bridge-cta {
            font-size: 0.68rem;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .discount-bridge-copy,
          .discount-bridge-visual {
            animation: none;
          }

          .discount-bridge-cta {
            transition: none;
          }
        }
      `}</style>
    </main>
  )
}

function DiscountBridgeWithParams() {
  const searchParams = useSearchParams()
  return <DiscountBridgeContent search={searchParams.toString()} />
}

export default function DescontoClient() {
  return (
    <Suspense fallback={<DiscountBridgeContent />}>
      <DiscountBridgeWithParams />
    </Suspense>
  )
}
