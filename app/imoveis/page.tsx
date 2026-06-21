import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Building2, MapPin, Search } from 'lucide-react'
import GlobalHeader from '@/components/layout/GlobalHeader'
import Footer from '@/components/layout/Footer'
import { getGeoPages } from '@/lib/seo/geo-pages'
import { JsonLd, absoluteUrl, breadcrumbJsonLd, organizationJsonLd, webPageJsonLd, DEFAULT_OG_IMAGE } from '@/lib/seo/json-ld'

export const metadata: Metadata = {
  title: 'Imóveis de luxo no litoral catarinense',
  description: 'Guias de busca para imóveis de luxo, frente mar, casas de alto padrão, coberturas e cidades premium de Santa Catarina.',
  alternates: {
    canonical: '/imoveis',
  },
  openGraph: {
    title: 'Imóveis de luxo no litoral catarinense',
    description: 'Encontre a busca certa para comprar melhor com a curadoria de Guilherme Pilger.',
    url: '/imoveis',
    type: 'website',
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Imóveis de luxo no litoral catarinense',
    description: 'Encontre a busca certa para comprar melhor com a curadoria de Guilherme Pilger.',
    images: [DEFAULT_OG_IMAGE],
  },
}

function buildJsonLd() {
  const pages = getGeoPages()

  return [
    organizationJsonLd(),
    webPageJsonLd({
      path: '/imoveis',
      name: 'Imóveis de luxo no litoral catarinense',
      description: 'Guias de busca para imóveis de luxo, frente mar, casas de alto padrão, coberturas e cidades premium de Santa Catarina.',
      type: 'CollectionPage',
    }),
    breadcrumbJsonLd([
      { name: 'Home', url: '/' },
      { name: 'Imóveis', url: '/imoveis' },
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Imóveis de luxo no litoral catarinense',
      url: absoluteUrl('/imoveis'),
      description: metadata.description,
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: pages.map((page, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: page.h1,
          description: page.description,
          url: absoluteUrl(`/imoveis/${page.slug}`),
        })),
      },
    },
  ]
}

export default function ImoveisHubPage() {
  const pages = getGeoPages()

  return (
    <>
      <GlobalHeader />
      <JsonLd data={buildJsonLd()} />
      <main className="geo-hub">
        <section className="geo-hub-hero">
          <span>Pilger Luxury Search</span>
          <h1>Escolha a busca certa para comprar melhor.</h1>
          <p>
            Páginas criadas para organizar as buscas mais importantes do alto padrão no litoral catarinense,
            com contexto, filtros e oportunidades do estoque ativo.
          </p>
          <Link href="/busca">
            Abrir busca completa
            <Search size={16} />
          </Link>
        </section>

        <section className="geo-hub-grid" aria-label="Buscas premium">
          {pages.map(page => (
            <Link href={`/imoveis/${page.slug}`} className="geo-card" key={page.slug}>
              <div className="geo-card-icon">
                <MapPin size={19} />
              </div>
              <span>{page.eyebrow}</span>
              <h2>{page.h1}</h2>
              <p>{page.description}</p>
              <div className="geo-card-tags">
                {page.highlights.slice(0, 3).map(item => (
                  <small key={item}>{item}</small>
                ))}
              </div>
              <strong>
                Ver curadoria
                <ArrowRight size={15} />
              </strong>
            </Link>
          ))}
        </section>

        <section className="geo-hub-note">
          <Building2 size={22} />
          <div>
            <h2>Conteúdo feito para busca humana e busca por IA.</h2>
            <p>
              Cada pagina ajuda Google, assistentes de IA e leads a entenderem exatamente onde procurar:
              cidade, frente mar, cobertura, casa de alto padrão e outras intenções de compra.
            </p>
          </div>
        </section>
      </main>
      <Footer />

      <style>{`
        .geo-hub { background: #faf7f1; color: #181511; }
        .geo-hub-hero {
          background: linear-gradient(135deg, #17120d, #342a1f);
          color: #fff8ea;
          padding: 150px 7vw 70px;
        }
        .geo-hub-hero span {
          color: #d6b677;
          display: block;
          font-size: .72rem;
          font-weight: 950;
          letter-spacing: .18em;
          margin-bottom: 14px;
          text-transform: uppercase;
        }
        .geo-hub-hero h1 {
          font-family: var(--font-serif);
          font-size: clamp(2.4rem, 6vw, 5.6rem);
          line-height: .94;
          margin: 0;
          max-width: 900px;
        }
        .geo-hub-hero p {
          color: rgba(255,255,255,.72);
          font-size: 1.03rem;
          line-height: 1.7;
          max-width: 760px;
        }
        .geo-hub-hero a {
          align-items: center;
          background: #c9a96e;
          border-radius: 999px;
          color: #111;
          display: inline-flex;
          font-size: .78rem;
          font-weight: 950;
          gap: 8px;
          min-height: 44px;
          padding: 0 17px;
          text-decoration: none;
          text-transform: uppercase;
        }
        .geo-hub-grid {
          display: grid;
          gap: 18px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          padding: 34px 7vw 44px;
        }
        .geo-card {
          background: #fff;
          border: 1px solid rgba(201,169,110,.22);
          border-radius: 16px;
          color: inherit;
          min-height: 340px;
          padding: 22px;
          text-decoration: none;
          transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
        }
        .geo-card:hover {
          border-color: rgba(201,169,110,.45);
          box-shadow: 0 18px 42px rgba(31,27,21,.08);
          transform: translateY(-4px);
        }
        .geo-card-icon {
          align-items: center;
          background: #f5efe4;
          border-radius: 12px;
          color: #9a7135;
          display: inline-flex;
          height: 42px;
          justify-content: center;
          margin-bottom: 18px;
          width: 42px;
        }
        .geo-card span {
          color: #b58d52;
          display: block;
          font-size: .68rem;
          font-weight: 950;
          letter-spacing: .14em;
          margin-bottom: 10px;
          text-transform: uppercase;
        }
        .geo-card h2 {
          font-family: var(--font-serif);
          font-size: 1.7rem;
          line-height: 1.05;
          margin: 0 0 12px;
        }
        .geo-card p {
          color: #665b50;
          font-size: .92rem;
          line-height: 1.62;
        }
        .geo-card-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 18px 0 22px;
        }
        .geo-card-tags small {
          background: #f8f3ea;
          border: 1px solid rgba(201,169,110,.2);
          border-radius: 999px;
          color: #6f5c43;
          font-size: .68rem;
          font-weight: 800;
          padding: 7px 9px;
        }
        .geo-card strong {
          align-items: center;
          color: #9a7135;
          display: inline-flex;
          font-size: .75rem;
          gap: 6px;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .geo-hub-note {
          align-items: center;
          background: #fff;
          border: 1px solid rgba(201,169,110,.22);
          border-radius: 18px;
          display: flex;
          gap: 18px;
          margin: 0 7vw 72px;
          padding: 24px;
        }
        .geo-hub-note svg { color: #9a7135; flex: 0 0 auto; }
        .geo-hub-note h2 {
          font-family: var(--font-serif);
          font-size: 1.9rem;
          line-height: 1.05;
          margin: 0 0 8px;
        }
        .geo-hub-note p { color: #665b50; line-height: 1.65; margin: 0; }
        @media (max-width: 980px) {
          .geo-hub-grid { grid-template-columns: 1fr; }
          .geo-hub-hero { padding-top: 112px; }
          .geo-hub-note { align-items: flex-start; }
        }
      `}</style>
    </>
  )
}
