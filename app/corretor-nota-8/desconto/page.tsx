import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BadgeCheck, BookOpen, Check, LockKeyhole, Sparkles } from 'lucide-react'
import { corretorNota8Content, corretorNota8Offer } from '@/lib/products/corretor-nota-8-content'

const CHECKOUT_URL = '/checkout/corretor-nota-8?utm_source=instagram&utm_medium=direct&utm_campaign=votacao_livro&acao=ja_votei'
const VOTE_URL = '/votar-guilherme?utm_source=instagram&utm_medium=direct&utm_campaign=votacao_livro&acao=vou_votar'

export const metadata: Metadata = {
  title: 'Corretor Nota 8 com desconto',
  description: 'Condicao especial de 30% para garantir o livro digital Corretor Nota 8.',
  robots: {
    index: false,
    follow: true,
  },
}

export default function CorretorNota8DescontoPage() {
  return (
    <main className="discount-campaign-page">
      <section className="discount-campaign-hero">
        <div className="discount-campaign-copy">
          <span className="discount-campaign-kicker">
            <BadgeCheck size={18} />
            Desconto liberado
          </span>
          <h1>Corretor Nota 8 com 30% de desconto</h1>
          <p>
            Obrigado por apoiar a votacao. Como agradecimento, a condicao especial do Manual Corretor Nota 8 esta ativa para voce.
          </p>

          <div className="discount-campaign-price" aria-label="Preco da oferta">
            <span>{corretorNota8Offer.originalPriceDisplay}</span>
            <strong>{corretorNota8Offer.priceDisplay}</strong>
            <small>{corretorNota8Offer.discountDescription}</small>
          </div>

          <div className="discount-campaign-actions">
            <Link href={CHECKOUT_URL} className="discount-campaign-primary">
              <span>Comprar com desconto</span>
              <ArrowRight size={18} />
            </Link>
            <Link href={VOTE_URL} className="discount-campaign-secondary">
              <span>Ainda vou votar</span>
            </Link>
          </div>

          <div className="discount-campaign-points" aria-label="Itens inclusos">
            {corretorNota8Content.included.slice(0, 3).map((item) => (
              <div key={item.title}>
                <Check size={17} />
                <span>{item.title}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="discount-campaign-product">
          <div className="discount-campaign-product-card">
            <Image
              src="/images/products/corretor-nota-8-cover.webp"
              alt="Capa do livro Corretor Nota 8"
              width={420}
              height={560}
              priority
            />
            <div>
              <span>
                <BookOpen size={15} />
                Livro digital
              </span>
              <strong>Acesso apos confirmacao do Pix</strong>
            </div>
          </div>
          <div className="discount-campaign-trust">
            <LockKeyhole size={17} />
            <span>Checkout seguro via Pix</span>
          </div>
        </div>
      </section>

      <section className="discount-campaign-summary">
        <div>
          <Sparkles size={20} />
          <h2>O que voce leva</h2>
          <p>{corretorNota8Content.description}</p>
        </div>
        <Link href={CHECKOUT_URL}>
          <span>Ir para o checkout</span>
          <ArrowRight size={17} />
        </Link>
      </section>

      <style>{`
        .discount-campaign-page {
          min-height: 100vh;
          background: #f5f0e8;
          color: #17130f;
          font-family: var(--font-sans, Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
        }

        .discount-campaign-hero {
          min-height: 92vh;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(320px, 0.82fr);
          align-items: center;
          gap: clamp(28px, 6vw, 96px);
          width: min(1180px, calc(100% - 40px));
          margin: 0 auto;
          padding: 54px 0 40px;
        }

        .discount-campaign-copy {
          display: flex;
          flex-direction: column;
          gap: 22px;
        }

        .discount-campaign-kicker {
          display: inline-flex;
          width: fit-content;
          align-items: center;
          gap: 10px;
          color: #946d2f;
          font-size: 0.78rem;
          font-weight: 900;
          letter-spacing: 0;
          text-transform: uppercase;
        }

        .discount-campaign-copy h1 {
          margin: 0;
          max-width: 760px;
          font-size: clamp(2.7rem, 5.4vw, 6.1rem);
          line-height: 0.94;
          letter-spacing: 0;
          font-family: Georgia, "Times New Roman", serif;
        }

        .discount-campaign-copy p {
          margin: 0;
          max-width: 640px;
          color: rgba(23, 19, 15, 0.72);
          font-size: clamp(1rem, 1.5vw, 1.18rem);
          line-height: 1.7;
        }

        .discount-campaign-price {
          display: grid;
          gap: 3px;
          width: fit-content;
          min-width: min(100%, 310px);
          border-left: 4px solid #b9863d;
          padding: 12px 0 12px 18px;
        }

        .discount-campaign-price span {
          color: rgba(23, 19, 15, 0.54);
          text-decoration: line-through;
          font-size: 1rem;
        }

        .discount-campaign-price strong {
          font-size: clamp(2.4rem, 4vw, 4.2rem);
          line-height: 1;
        }

        .discount-campaign-price small {
          color: rgba(23, 19, 15, 0.7);
          font-weight: 700;
        }

        .discount-campaign-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .discount-campaign-primary,
        .discount-campaign-secondary,
        .discount-campaign-summary a {
          display: inline-flex;
          min-height: 52px;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border-radius: 6px;
          padding: 0 20px;
          font-weight: 900;
          text-decoration: none;
          transition: transform 180ms ease, background 180ms ease, border-color 180ms ease;
        }

        .discount-campaign-primary {
          background: #17130f;
          color: #fffaf2;
        }

        .discount-campaign-secondary {
          border: 1px solid rgba(23, 19, 15, 0.22);
          color: #17130f;
        }

        .discount-campaign-primary:hover,
        .discount-campaign-secondary:hover,
        .discount-campaign-summary a:hover {
          transform: translateY(-1px);
        }

        .discount-campaign-secondary:hover {
          border-color: rgba(23, 19, 15, 0.44);
          background: rgba(23, 19, 15, 0.05);
        }

        .discount-campaign-points {
          display: grid;
          gap: 10px;
          max-width: 620px;
          margin-top: 4px;
        }

        .discount-campaign-points div {
          display: flex;
          align-items: center;
          gap: 10px;
          color: rgba(23, 19, 15, 0.76);
          font-size: 0.96rem;
        }

        .discount-campaign-points svg {
          flex: 0 0 auto;
          color: #946d2f;
        }

        .discount-campaign-product {
          display: grid;
          gap: 14px;
          justify-items: center;
        }

        .discount-campaign-product-card {
          display: grid;
          gap: 18px;
          width: min(100%, 430px);
          border: 1px solid rgba(23, 19, 15, 0.12);
          border-radius: 8px;
          background: #fffaf2;
          padding: clamp(18px, 4vw, 28px);
          box-shadow: 0 24px 60px rgba(50, 38, 25, 0.18);
        }

        .discount-campaign-product-card img {
          width: 100%;
          height: auto;
          border-radius: 6px;
          box-shadow: 0 18px 36px rgba(23, 19, 15, 0.18);
        }

        .discount-campaign-product-card div {
          display: grid;
          gap: 8px;
        }

        .discount-campaign-product-card span,
        .discount-campaign-trust {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: rgba(23, 19, 15, 0.68);
          font-size: 0.9rem;
          font-weight: 800;
        }

        .discount-campaign-product-card strong {
          font-size: 1.15rem;
        }

        .discount-campaign-trust {
          border-radius: 6px;
          background: #17130f;
          color: #fffaf2;
          padding: 10px 14px;
        }

        .discount-campaign-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          width: min(1180px, calc(100% - 40px));
          margin: 0 auto;
          border-top: 1px solid rgba(23, 19, 15, 0.12);
          padding: 28px 0 44px;
        }

        .discount-campaign-summary div {
          display: grid;
          gap: 8px;
          max-width: 760px;
        }

        .discount-campaign-summary h2,
        .discount-campaign-summary p {
          margin: 0;
        }

        .discount-campaign-summary h2 {
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(1.8rem, 3vw, 2.5rem);
        }

        .discount-campaign-summary p {
          color: rgba(23, 19, 15, 0.72);
          line-height: 1.65;
        }

        .discount-campaign-summary a {
          flex: 0 0 auto;
          border: 1px solid rgba(23, 19, 15, 0.22);
          color: #17130f;
        }

        @media (max-width: 900px) {
          .discount-campaign-hero {
            grid-template-columns: 1fr;
            padding-top: 30px;
          }

          .discount-campaign-product {
            order: -1;
          }

          .discount-campaign-product-card {
            max-width: 360px;
          }

          .discount-campaign-actions a,
          .discount-campaign-summary a {
            width: 100%;
          }

          .discount-campaign-summary {
            display: grid;
          }
        }
      `}</style>
    </main>
  )
}
