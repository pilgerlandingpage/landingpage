'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BadgeCheck, BookOpen, CheckCircle2, Gift, ShieldCheck } from 'lucide-react'

const checkoutHref = '/checkout/corretor-nota-8?utm_source=instagram&utm_medium=direct&utm_campaign=votacao_livro_desconto'

const included = [
  'Livro digital Corretor Nota 8',
  'Acesso liberado após aprovação do pagamento',
  'Conteúdo sobre posicionamento, método e disciplina comercial',
]

export default function DescontoClient() {
  return (
    <main className="discount-page">
      <section className="discount-hero">
        <div className="discount-hero-inner">
          <div className="discount-copy">
            <span className="discount-kicker">
              <Gift size={15} />
              Presente especial
            </span>
            <h1>Seu desconto de 30% está liberado.</h1>
            <p>
              Obrigado por apoiar a votação. Como agradecimento, você pode garantir o
              livro digital Corretor Nota 8 por uma condição especial.
            </p>
            <div className="price-row" aria-label="Preço promocional">
              <span>De R$ 97,00</span>
              <strong>R$ 67,90</strong>
            </div>
            <div className="discount-actions">
              <Link className="discount-primary" href={checkoutHref}>
                Comprar com 30% de desconto
                <ArrowRight size={17} />
              </Link>
              <Link className="discount-secondary" href="/corretor-nota-8">
                Ver página do livro
                <BookOpen size={17} />
              </Link>
            </div>
          </div>

          <div className="book-cover">
            <Image
              src="/images/products/corretor-nota-8-cover.webp"
              alt="Capa do livro Corretor Nota 8"
              width={420}
              height={560}
              priority
            />
          </div>
        </div>
      </section>

      <section className="discount-details">
        <div className="details-heading">
          <span>Corretor Nota 8</span>
          <h2>O que você recebe</h2>
        </div>
        <div className="included-list">
          {included.map((item) => (
            <div className="included-item" key={item}>
              <CheckCircle2 size={18} />
              <p>{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="checkout-band">
        <BadgeCheck size={20} />
        <p>Condição aplicada no checkout do livro digital.</p>
        <Link href={checkoutHref}>
          Garantir agora
          <ShieldCheck size={17} />
        </Link>
      </section>

      <style jsx>{`
        .discount-page {
          min-height: 100vh;
          color: #fff;
          background: #020707;
        }

        .discount-hero {
          min-height: 78vh;
          overflow: hidden;
          border-bottom: 1px solid rgba(232, 176, 73, 0.24);
          background:
            linear-gradient(90deg, rgba(2, 7, 7, 0.98) 0%, rgba(2, 7, 7, 0.88) 45%, rgba(2, 7, 7, 0.66) 100%),
            url("/images/products/corretor-nota-8-hero-bg-optimized.jpg") center / cover no-repeat;
        }

        .discount-hero-inner {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(240px, 360px);
          align-items: center;
          gap: 58px;
          width: min(1160px, calc(100% - 40px));
          min-height: 78vh;
          margin: 0 auto;
          padding: 58px 0 50px;
        }

        .discount-copy {
          max-width: 720px;
        }

        .discount-kicker,
        .discount-actions,
        .checkout-band,
        .checkout-band a,
        .included-item {
          display: inline-flex;
          align-items: center;
        }

        .discount-kicker {
          gap: 8px;
          margin-bottom: 16px;
          padding: 7px 9px;
          border: 1px solid rgba(232, 176, 73, 0.5);
          border-radius: 7px;
          color: #e8b049;
          background: rgba(232, 176, 73, 0.08);
          font-size: 0.72rem;
          font-weight: 950;
          text-transform: uppercase;
        }

        h1,
        h2 {
          margin: 0;
          font-family: Georgia, 'Times New Roman', serif;
          letter-spacing: 0;
        }

        h1 {
          max-width: 760px;
          font-size: 5rem;
          line-height: 0.94;
        }

        .discount-copy > p {
          max-width: 610px;
          margin: 20px 0 0;
          color: rgba(255, 255, 255, 0.76);
          font-size: 1.05rem;
          line-height: 1.75;
        }

        .price-row {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 14px;
          margin-top: 26px;
        }

        .price-row span {
          color: rgba(255, 255, 255, 0.58);
          font-weight: 800;
          text-decoration: line-through;
        }

        .price-row strong {
          color: #e8b049;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 3rem;
          line-height: 1;
        }

        .discount-actions {
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 28px;
        }

        .discount-primary,
        .discount-secondary,
        .checkout-band a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          min-height: 46px;
          border-radius: 7px;
          padding: 0 18px;
          font-size: 0.78rem;
          font-weight: 950;
          text-decoration: none;
          text-transform: uppercase;
        }

        .discount-primary,
        .checkout-band a {
          color: #061014;
          background: #e8b049;
          box-shadow: 0 18px 36px rgba(232, 176, 73, 0.22);
        }

        .discount-secondary {
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.05);
        }

        .book-cover {
          justify-self: center;
          width: min(100%, 320px);
          padding: 12px;
          border: 1px solid rgba(232, 176, 73, 0.34);
          border-radius: 8px;
          background: rgba(232, 176, 73, 0.08);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.34);
        }

        .book-cover img {
          display: block;
          width: 100%;
          height: auto;
          border-radius: 5px;
        }

        .discount-details {
          width: min(1160px, calc(100% - 40px));
          margin: 0 auto;
          padding: 54px 0;
        }

        .details-heading span {
          color: #e8b049;
          font-size: 0.72rem;
          font-weight: 950;
          text-transform: uppercase;
        }

        .details-heading h2 {
          margin-top: 8px;
          font-size: 2.5rem;
          line-height: 1;
        }

        .included-list {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-top: 24px;
        }

        .included-item {
          gap: 12px;
          min-height: 92px;
          padding: 18px;
          border: 1px solid rgba(232, 176, 73, 0.2);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.045);
        }

        .included-item svg {
          flex: 0 0 auto;
          color: #e8b049;
        }

        .included-item p {
          margin: 0;
          color: rgba(255, 255, 255, 0.72);
          line-height: 1.5;
        }

        .checkout-band {
          justify-content: center;
          gap: 18px;
          width: 100%;
          padding: 22px 20px 28px;
          border-top: 1px solid rgba(232, 176, 73, 0.2);
          background: rgba(255, 255, 255, 0.035);
        }

        .checkout-band p {
          margin: 0;
          color: rgba(255, 255, 255, 0.72);
        }

        @media (max-width: 900px) {
          .discount-hero-inner {
            grid-template-columns: 1fr;
            gap: 32px;
          }

          h1 {
            font-size: 3.05rem;
          }

          .price-row strong {
            font-size: 2.35rem;
          }

          .book-cover {
            justify-self: start;
            width: min(100%, 260px);
          }

          .included-list {
            grid-template-columns: 1fr;
          }

          .checkout-band {
            flex-direction: column;
            align-items: stretch;
            text-align: center;
          }
        }
      `}</style>
    </main>
  )
}
