import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BookOpen, Search } from 'lucide-react'
import GlobalHeader from '@/components/layout/GlobalHeader'
import Footer from '@/components/layout/Footer'
import { allGuideLinks } from '@/lib/seo/ai-guide-pages'
import { JsonLd, DEFAULT_OG_IMAGE, itemListJsonLd, organizationJsonLd, webPageJsonLd } from '@/lib/seo/json-ld'

const PAGE_TITLE = 'Guias imobiliários | Guilherme Pilger'
const PAGE_DESCRIPTION = 'Guias para comprar imóveis de luxo, apartamentos frente mar, coberturas e oportunidades de alto padrão no litoral catarinense.'

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: '/guias',
  },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/guias',
    type: 'website',
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
}

function buildJsonLd() {
  return [
    organizationJsonLd(),
    webPageJsonLd({
      path: '/guias',
      name: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      image: DEFAULT_OG_IMAGE,
    }),
    itemListJsonLd({
      path: '/guias',
      name: 'Guias imobiliários Guilherme Pilger',
      description: PAGE_DESCRIPTION,
      items: allGuideLinks.map(item => ({
        name: item.label,
        url: item.href,
        type: 'Article',
      })),
    }),
  ]
}

export default function GuidesHubPage() {
  return (
    <>
      <GlobalHeader />
      <JsonLd data={buildJsonLd()} />
      <main className="guides-hub">
        <section className="guides-hub-hero">
          <span>SEO, AEO e curadoria premium</span>
          <h1>Guias para comprar imóveis de luxo com mais contexto.</h1>
          <p>
            Conteúdos estruturados para compradores humanos e mecanismos de resposta entenderem regiões, tipologias e critérios de decisão no litoral catarinense.
          </p>
          <Link href="/busca" className="guides-hub-primary">
            <Search size={17} />
            Abrir busca premium
          </Link>
        </section>

        <section className="guides-hub-list" aria-label="Guias imobiliários">
          {allGuideLinks.map(item => (
            <Link href={item.href} key={item.href} className="guides-hub-card">
              <BookOpen size={22} />
              <span>{item.label}</span>
              <ArrowRight size={16} />
            </Link>
          ))}
        </section>
      </main>
      <Footer />

      <style>{`
        .guides-hub {
          background: #f8f4ed;
          color: #17130f;
          min-height: 70vh;
        }
        .guides-hub-hero {
          background: linear-gradient(135deg, #15110d 0%, #2d241b 100%);
          color: #fff8ea;
          padding: 150px 7vw 72px;
        }
        .guides-hub-hero span {
          color: #d8b979;
          display: inline-flex;
          font-size: .72rem;
          font-weight: 950;
          letter-spacing: .16em;
          text-transform: uppercase;
        }
        .guides-hub-hero h1 {
          font-family: var(--font-serif);
          font-size: clamp(3rem, 7vw, 7rem);
          letter-spacing: 0;
          line-height: .9;
          margin: 14px 0 18px;
          max-width: 1050px;
        }
        .guides-hub-hero p {
          color: rgba(255,255,255,.72);
          font-size: clamp(1rem, 1.5vw, 1.2rem);
          line-height: 1.72;
          max-width: 780px;
        }
        .guides-hub-primary {
          align-items: center;
          background: #d8b979;
          border-radius: 999px;
          color: #17130f;
          display: inline-flex;
          font-size: .76rem;
          font-weight: 950;
          gap: 8px;
          justify-content: center;
          margin-top: 20px;
          min-height: 48px;
          padding: 0 18px;
          text-decoration: none;
          text-transform: uppercase;
        }
        .guides-hub-list {
          display: grid;
          gap: 14px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          padding: 56px 7vw 78px;
        }
        .guides-hub-card {
          align-items: center;
          background: #fff;
          border: 1px solid rgba(184,132,62,.18);
          border-radius: 12px;
          box-shadow: 0 18px 42px rgba(63,45,23,.06);
          color: #211b15;
          display: grid;
          gap: 12px;
          grid-template-columns: auto 1fr auto;
          min-height: 86px;
          padding: 18px;
          text-decoration: none;
        }
        .guides-hub-card svg {
          color: #a87939;
        }
        .guides-hub-card span {
          font-size: 1rem;
          font-weight: 850;
          line-height: 1.32;
        }
        @media (max-width: 980px) {
          .guides-hub-list {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 680px) {
          .guides-hub-hero {
            padding: 104px 20px 48px;
          }
          .guides-hub-hero h1 {
            font-size: clamp(2.7rem, 13vw, 4.5rem);
          }
          .guides-hub-primary {
            width: 100%;
          }
          .guides-hub-list {
            padding-left: 20px;
            padding-right: 20px;
          }
        }
      `}</style>
    </>
  )
}
