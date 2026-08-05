import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Award, CheckCircle2, ExternalLink, ShieldCheck } from 'lucide-react'

const AWARDS_VOTE_URL = 'https://awards.atrincarealestate.com.br/#/categoria/influenciador-do-ano/candidato/2ba4d003-3f4b-4d1a-b079-43c8a253c9b7'
const DISCOUNT_URL = '/corretor-nota-8/desconto?utm_source=instagram&utm_medium=direct&utm_campaign=votacao_livro&acao=ja_votei'

export const metadata: Metadata = {
  title: 'Votar no Guilherme | Corretor Nota 8',
  description: 'Apoie Guilherme Pilger como Influenciador do Ano no Real Estate Awards e volte para liberar a condicao especial do Corretor Nota 8.',
  robots: {
    index: false,
    follow: true,
  },
}

export default function VoteGuilhermePage() {
  return (
    <main className="vote-campaign-page">
      <section className="vote-campaign-hero">
        <div className="vote-campaign-media" aria-hidden="true">
          <Image
            src="/images/products/corretor-nota-8-guilherme-hero-optimized.jpg"
            alt=""
            fill
            priority
            sizes="(max-width: 900px) 100vw, 50vw"
          />
        </div>

        <div className="vote-campaign-copy">
          <span className="vote-campaign-kicker">
            <Award size={18} />
            Real Estate Awards
          </span>
          <h1>Vote no Guilherme como Influenciador do Ano</h1>
          <p>
            Seu voto ajuda a fortalecer o trabalho de conteudo, educacao e posicionamento para corretores do mercado imobiliario.
          </p>

          <div className="vote-campaign-actions">
            <a href={AWARDS_VOTE_URL} className="vote-campaign-primary" target="_blank" rel="noopener noreferrer">
              <span>Votar agora</span>
              <ExternalLink size={18} />
            </a>
            <Link href={DISCOUNT_URL} className="vote-campaign-secondary">
              <span>Ja votei</span>
              <ArrowRight size={18} />
            </Link>
          </div>

          <div className="vote-campaign-steps" aria-label="Passos para liberar o desconto">
            <div>
              <CheckCircle2 size={18} />
              <span>Abra a pagina oficial da votacao.</span>
            </div>
            <div>
              <CheckCircle2 size={18} />
              <span>Conclua seu voto no Real Estate Awards.</span>
            </div>
            <div>
              <ShieldCheck size={18} />
              <span>Volte e garanta o Corretor Nota 8 com 30% de desconto.</span>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        .vote-campaign-page {
          min-height: 100vh;
          background: #0d0f12;
          color: #f7f1e7;
          font-family: var(--font-sans, Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
        }

        .vote-campaign-hero {
          min-height: 100vh;
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(360px, 1.1fr);
          overflow: hidden;
        }

        .vote-campaign-media {
          position: relative;
          min-height: 100vh;
          background: #171717;
        }

        .vote-campaign-media img {
          object-fit: cover;
          object-position: center;
        }

        .vote-campaign-media::after {
          position: absolute;
          inset: 0;
          content: "";
          background: linear-gradient(90deg, rgba(13, 15, 18, 0.02), rgba(13, 15, 18, 0.7));
        }

        .vote-campaign-copy {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 24px;
          padding: clamp(32px, 6vw, 96px);
          max-width: 760px;
        }

        .vote-campaign-kicker {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          width: fit-content;
          color: #d6b16b;
          font-size: 0.78rem;
          font-weight: 800;
          letter-spacing: 0;
          text-transform: uppercase;
        }

        .vote-campaign-copy h1 {
          margin: 0;
          max-width: 720px;
          font-size: clamp(2.65rem, 4.7vw, 5.6rem);
          line-height: 0.94;
          letter-spacing: 0;
          font-family: Georgia, "Times New Roman", serif;
        }

        .vote-campaign-copy p {
          margin: 0;
          max-width: 580px;
          color: rgba(247, 241, 231, 0.78);
          font-size: clamp(1rem, 1.5vw, 1.18rem);
          line-height: 1.7;
        }

        .vote-campaign-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 4px;
        }

        .vote-campaign-primary,
        .vote-campaign-secondary {
          display: inline-flex;
          min-height: 52px;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border-radius: 6px;
          padding: 0 20px;
          font-weight: 800;
          text-decoration: none;
          transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
        }

        .vote-campaign-primary {
          background: #d6b16b;
          color: #111111;
        }

        .vote-campaign-secondary {
          border: 1px solid rgba(247, 241, 231, 0.32);
          color: #f7f1e7;
        }

        .vote-campaign-primary:hover,
        .vote-campaign-secondary:hover {
          transform: translateY(-1px);
        }

        .vote-campaign-secondary:hover {
          border-color: rgba(247, 241, 231, 0.72);
          background: rgba(247, 241, 231, 0.08);
        }

        .vote-campaign-steps {
          display: grid;
          gap: 10px;
          max-width: 640px;
          margin-top: 8px;
        }

        .vote-campaign-steps div {
          display: flex;
          align-items: center;
          gap: 10px;
          color: rgba(247, 241, 231, 0.82);
          font-size: 0.96rem;
        }

        .vote-campaign-steps svg {
          flex: 0 0 auto;
          color: #d6b16b;
        }

        @media (max-width: 900px) {
          .vote-campaign-hero {
            min-height: 100vh;
            grid-template-columns: 1fr;
          }

          .vote-campaign-media {
            min-height: 44vh;
          }

          .vote-campaign-media::after {
            background: linear-gradient(180deg, rgba(13, 15, 18, 0.05), #0d0f12);
          }

          .vote-campaign-copy {
            padding: 28px 22px 40px;
          }

          .vote-campaign-actions a {
            width: 100%;
          }
        }
      `}</style>
    </main>
  )
}
