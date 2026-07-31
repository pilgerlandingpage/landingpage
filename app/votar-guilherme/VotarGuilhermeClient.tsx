'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BadgeCheck, CheckCircle2, ExternalLink, ShieldCheck } from 'lucide-react'

const steps = [
  {
    title: 'Abra a votação oficial',
    text: 'O botão abaixo leva direto para a página do Real Estate Awards.',
  },
  {
    title: 'Confirme Guilherme Pilger',
    text: 'Confira o nome do candidato antes de finalizar o voto.',
  },
  {
    title: 'Volte para o Direct',
    text: 'Depois de votar, toque em Ja votei no Direct para abrir o desconto do livro.',
  },
]

type VotarGuilhermeClientProps = {
  voteUrl: string
}

export default function VotarGuilhermeClient({ voteUrl }: VotarGuilhermeClientProps) {
  return (
    <main className="vote-page">
      <section className="vote-hero">
        <div className="vote-hero-inner">
          <div className="vote-copy">
            <span className="vote-kicker">
              <BadgeCheck size={15} />
              Votação oficial
            </span>
            <h1>Vote no Guilherme Pilger</h1>
            <p>
              Seu apoio ajuda o Guilherme na categoria Influenciador do Ano. O processo é rápido:
              abra a votação, confirme o candidato e finalize pelo site oficial.
            </p>
            <div className="vote-actions">
              <a className="vote-primary" href={voteUrl}>
                Abrir votação oficial
                <ExternalLink size={17} />
              </a>
              <Link className="vote-secondary" href="/corretor-nota-8/desconto">
                Já votei
                <ArrowRight size={17} />
              </Link>
            </div>
          </div>

          <div className="vote-media" aria-label="Guilherme Pilger">
            <Image
              src="/images/products/corretor-nota-8-guilherme-hero-optimized.jpg"
              alt="Guilherme Pilger"
              width={520}
              height={620}
              priority
            />
          </div>
        </div>
      </section>

      <section className="vote-steps" aria-label="Passo a passo">
        <div className="vote-section-heading">
          <span>Como votar</span>
          <h2>Três passos para concluir</h2>
        </div>
        <div className="vote-step-grid">
          {steps.map((step, index) => (
            <article className="vote-step" key={step.title}>
              <strong>{String(index + 1).padStart(2, '0')}</strong>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="vote-final">
        <ShieldCheck size={20} />
        <p>O voto acontece no ambiente oficial do Real Estate Awards.</p>
        <a href={voteUrl}>
          Votar agora
          <CheckCircle2 size={17} />
        </a>
      </section>

      <style jsx>{`
        .vote-page {
          min-height: 100vh;
          color: #fff;
          background: #020707;
        }

        .vote-hero {
          position: relative;
          min-height: 76vh;
          overflow: hidden;
          border-bottom: 1px solid rgba(232, 176, 73, 0.24);
          background:
            linear-gradient(90deg, rgba(2, 7, 7, 0.98) 0%, rgba(2, 7, 7, 0.84) 48%, rgba(2, 7, 7, 0.62) 100%),
            url("/images/products/corretor-nota-8-hero-bg-optimized.jpg") center / cover no-repeat;
        }

        .vote-hero-inner {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(280px, 420px);
          align-items: center;
          gap: 54px;
          width: min(1180px, calc(100% - 40px));
          min-height: 76vh;
          margin: 0 auto;
          padding: 58px 0 48px;
        }

        .vote-copy {
          max-width: 700px;
        }

        .vote-kicker,
        .vote-actions,
        .vote-final,
        .vote-final a {
          display: inline-flex;
          align-items: center;
        }

        .vote-kicker {
          gap: 8px;
          margin-bottom: 16px;
          padding: 7px 9px;
          border: 1px solid rgba(232, 176, 73, 0.5);
          border-radius: 7px;
          color: #e8b049;
          background: rgba(232, 176, 73, 0.08);
          font-size: 0.72rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        h1,
        h2 {
          margin: 0;
          font-family: Georgia, 'Times New Roman', serif;
          letter-spacing: 0;
        }

        h1 {
          max-width: 690px;
          font-size: 5.2rem;
          line-height: 0.94;
        }

        .vote-copy p {
          max-width: 620px;
          margin: 20px 0 0;
          color: rgba(255, 255, 255, 0.76);
          font-size: 1.05rem;
          line-height: 1.75;
        }

        .vote-actions {
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 28px;
        }

        .vote-primary,
        .vote-secondary,
        .vote-final a {
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

        .vote-primary,
        .vote-final a {
          color: #061014;
          background: #e8b049;
          box-shadow: 0 18px 36px rgba(232, 176, 73, 0.22);
        }

        .vote-secondary {
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.05);
        }

        .vote-media {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(232, 176, 73, 0.34);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.04);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.32);
        }

        .vote-media img {
          display: block;
          width: 100%;
          height: auto;
          object-fit: cover;
        }

        .vote-steps {
          width: min(1180px, calc(100% - 40px));
          margin: 0 auto;
          padding: 56px 0;
        }

        .vote-section-heading span {
          color: #e8b049;
          font-size: 0.72rem;
          font-weight: 950;
          text-transform: uppercase;
        }

        .vote-section-heading h2 {
          margin-top: 8px;
          font-size: 2.6rem;
          line-height: 1;
        }

        .vote-step-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-top: 24px;
        }

        .vote-step {
          min-height: 180px;
          padding: 22px;
          border: 1px solid rgba(232, 176, 73, 0.2);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.045);
        }

        .vote-step strong {
          color: #e8b049;
          font-size: 0.78rem;
        }

        .vote-step h3 {
          margin: 18px 0 8px;
          font-size: 1.05rem;
        }

        .vote-step p {
          margin: 0;
          color: rgba(255, 255, 255, 0.68);
          line-height: 1.65;
        }

        .vote-final {
          justify-content: center;
          gap: 18px;
          width: 100%;
          padding: 22px 20px 28px;
          border-top: 1px solid rgba(232, 176, 73, 0.2);
          background: rgba(255, 255, 255, 0.035);
        }

        .vote-final p {
          margin: 0;
          color: rgba(255, 255, 255, 0.72);
        }

        @media (max-width: 900px) {
          .vote-hero-inner {
            grid-template-columns: 1fr;
            gap: 30px;
          }

          h1 {
            font-size: 3.25rem;
          }

          .vote-media {
            max-width: 360px;
          }

          .vote-step-grid {
            grid-template-columns: 1fr;
          }

          .vote-final {
            flex-direction: column;
            align-items: stretch;
            text-align: center;
          }
        }
      `}</style>
    </main>
  )
}
