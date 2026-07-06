import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Compass,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
} from 'lucide-react'
import GlobalHeader from '@/components/layout/GlobalHeader'
import Footer from '@/components/layout/Footer'
import WhatsAppCaptureLink from '@/components/common/WhatsAppCaptureLink'
import {
  BRAND_NAME,
  DEFAULT_OG_IMAGE,
  JsonLd,
  absoluteUrl,
  breadcrumbJsonLd,
  faqPageJsonLd,
  organizationJsonLd,
  webPageJsonLd,
} from '@/lib/seo/json-ld'

const GUIDE_PATH = '/guias/imoveis-luxo-litoral-catarinense'
const UPDATED_AT = '2026-07-06'
const GUIDE_TITLE = 'Guia de imóveis de luxo no litoral catarinense'
const GUIDE_DESCRIPTION = 'Guia para comprar imóveis de luxo em Balneário Camboriú, Praia Brava, Itapema e Porto Belo com critérios de mercado, localização, liquidez e curadoria especializada.'

export const metadata: Metadata = {
  title: GUIDE_TITLE,
  description: GUIDE_DESCRIPTION,
  alternates: {
    canonical: GUIDE_PATH,
  },
  openGraph: {
    title: GUIDE_TITLE,
    description: GUIDE_DESCRIPTION,
    url: GUIDE_PATH,
    type: 'article',
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: GUIDE_TITLE,
    description: GUIDE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
}

const directAnswers = [
  {
    icon: MapPin,
    question: 'Onde procurar imóveis de luxo no litoral catarinense?',
    answer: 'Balneário Camboriú concentra liquidez, verticalização premium e frente mar. Praia Brava combina lifestyle, natureza e exclusividade. Itapema tem forte expansão de lançamentos e boa relação entre metragem, localização e preço. Porto Belo atrai quem busca condomínios, terreno e crescimento planejado.',
    href: '/imoveis',
    cta: 'Ver buscas por cidade',
  },
  {
    icon: BarChart3,
    question: 'O que mais pesa na decisão de compra?',
    answer: 'No alto padrão, preço por metro quadrado isolado não basta. A decisão deve comparar vista, posição solar, construtora, planta, vagas, privacidade, liquidez, vizinhança, histórico de valorização e escassez real do endereço.',
    href: '/busca',
    cta: 'Abrir busca completa',
  },
  {
    icon: ShieldCheck,
    question: 'Como reduzir risco antes da visita?',
    answer: 'A melhor estratégia é filtrar antes: definir objetivo da compra, excluir imóveis fora de perfil, comparar produtos parecidos e visitar apenas oportunidades com contexto. Isso evita perder tempo com imóveis bonitos, mas mal posicionados para o seu momento.',
    href: '/consultoria-imobiliaria-personalizada',
    cta: 'Entender a consultoria',
  },
]

const cityComparisons = [
  {
    city: 'Balneário Camboriú',
    profile: 'Liquidez, frente mar, edifícios icônicos e procura nacional.',
    bestFor: 'Compradores que priorizam endereço consolidado, vista, revenda e mercado de alto desejo.',
    href: '/imoveis/balneario-camboriu',
  },
  {
    city: 'Praia Brava',
    profile: 'Lifestyle de praia, baixa oferta relativa, gastronomia, natureza e condomínios premium.',
    bestFor: 'Quem quer exclusividade, privacidade e proximidade com Balneário Camboriú sem abrir mão de praia.',
    href: '/imoveis/praia-brava',
  },
  {
    city: 'Itapema',
    profile: 'Expansão, lançamentos, frente mar e mercado com variedade de metragens.',
    bestFor: 'Investidores e famílias que querem produto novo, boa planta e potencial de crescimento.',
    href: '/imoveis/itapema',
  },
  {
    city: 'Porto Belo',
    profile: 'Crescimento planejado, condomínios, terrenos e perfil de segunda moradia premium.',
    bestFor: 'Quem busca casa, terreno, privacidade e uma tese de valorização de médio prazo.',
    href: '/busca?city=Porto+Belo',
  },
]

const decisionCriteria = [
  'Localização e microendereço: rua, vista, ruído, acesso e vizinhança.',
  'Produto: planta, metragem útil, vagas, área social, privacidade e padrão de acabamento.',
  'Condomínio e construtora: entrega, manutenção, reputação e liquidez do empreendimento.',
  'Escassez: frente mar, vista definitiva, cobertura, terreno ou assinatura rara.',
  'Momento de mercado: estoque disponível, margem de negociação, lançamentos e procura.',
  'Uso real: moradia, segunda residência, renda, preservação patrimonial ou revenda.',
]

const faqItems = [
  {
    question: 'Qual cidade do litoral catarinense é melhor para comprar imóvel de luxo?',
    answer: 'Depende do objetivo. Balneário Camboriú costuma ser mais forte em liquidez e frente mar consolidado. Praia Brava entrega lifestyle e exclusividade. Itapema oferece expansão e lançamentos. Porto Belo tende a atrair quem busca condomínios, terrenos e crescimento planejado.',
  },
  {
    question: 'Imóvel frente mar sempre é melhor investimento?',
    answer: 'Frente mar tem escassez e alto desejo, mas ainda precisa ser comparado por planta, posição, conservação, condomínio, vagas e preço. Um bom quadra mar ou uma cobertura bem localizada pode fazer mais sentido dependendo do perfil.',
  },
  {
    question: 'Como saber se o preço de um imóvel de luxo está coerente?',
    answer: 'Compare imóveis semelhantes por cidade, bairro, vista, idade do empreendimento, metragem privativa, construtora, vagas, padrão de acabamento e liquidez. No alto padrão, preço por metro quadrado deve ser lido junto com raridade e qualidade do produto.',
  },
  {
    question: 'Por que usar curadoria antes de visitar imóveis?',
    answer: 'A curadoria reduz ruído. Em vez de visitar muitas opções parecidas, o comprador recebe um recorte com contexto de mercado, pontos fortes, riscos e comparativos para decidir com mais segurança.',
  },
]

function buildJsonLd() {
  const url = absoluteUrl(GUIDE_PATH)

  return [
    organizationJsonLd(),
    webPageJsonLd({
      path: GUIDE_PATH,
      name: GUIDE_TITLE,
      description: GUIDE_DESCRIPTION,
      type: 'Article',
      image: DEFAULT_OG_IMAGE,
    }),
    breadcrumbJsonLd([
      { name: 'Home', url: '/' },
      { name: 'Guias', url: '/imoveis' },
      { name: GUIDE_TITLE, url: GUIDE_PATH },
    ]),
    faqPageJsonLd(faqItems),
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: GUIDE_TITLE,
      description: GUIDE_DESCRIPTION,
      image: [DEFAULT_OG_IMAGE],
      datePublished: UPDATED_AT,
      dateModified: UPDATED_AT,
      author: {
        '@type': 'Person',
        name: BRAND_NAME,
        url: absoluteUrl('/sobre'),
      },
      publisher: {
        '@id': `${absoluteUrl('/')}#organization`,
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
      },
      articleSection: 'Guia imobiliário',
      inLanguage: 'pt-BR',
      about: [
        { '@type': 'Thing', name: 'imóveis de luxo' },
        { '@type': 'Place', name: 'Balneário Camboriú' },
        { '@type': 'Place', name: 'Praia Brava' },
        { '@type': 'Place', name: 'Itapema' },
        { '@type': 'Place', name: 'Porto Belo' },
      ],
      mentions: cityComparisons.map(item => ({
        '@type': 'WebPage',
        name: `Imóveis em ${item.city}`,
        url: absoluteUrl(item.href),
      })),
    },
  ]
}

export default function LuxuryCoastGuidePage() {
  return (
    <>
      <GlobalHeader />
      <JsonLd data={buildJsonLd()} />
      <main className="ai-guide">
        <section className="ai-guide-hero">
          <span>Guia premium para busca humana e busca por IA</span>
          <h1>Como escolher imóveis de luxo no litoral catarinense.</h1>
          <p>
            Um ponto de partida claro para comparar Balneário Camboriú, Praia Brava, Itapema e Porto Belo antes de visitar imóveis, negociar ou pedir uma curadoria.
          </p>
          <div className="ai-guide-actions">
            <Link href="/busca" className="ai-guide-primary">
              <Search size={17} />
              Ver imóveis selecionados
            </Link>
            <WhatsAppCaptureLink
              phone="5547992528080"
              message="Olá! Li o guia de imóveis de luxo no litoral catarinense e quero uma curadoria."
              slug="guia-imoveis-luxo"
              template="guide-luxury-coast-whatsapp"
              className="ai-guide-whatsapp"
            >
              <MessageCircle size={17} />
              Pedir curadoria
            </WhatsAppCaptureLink>
          </div>
        </section>

        <section className="ai-guide-answer">
          <div>
            <span>Resposta direta</span>
            <h2>O melhor imóvel de luxo é o que combina localização, escassez e objetivo de compra.</h2>
          </div>
          <p>
            Para comprar melhor no litoral catarinense, comece pela cidade certa, depois compare microendereço, vista, planta, construtora, liquidez e momento de negociação. A decisão não deve nascer de volume de anúncios, mas de contexto.
          </p>
        </section>

        <section className="ai-guide-cards" aria-label="Perguntas principais sobre imóveis de luxo">
          {directAnswers.map(item => {
            const Icon = item.icon
            return (
              <article key={item.question}>
                <Icon size={22} />
                <h2>{item.question}</h2>
                <p>{item.answer}</p>
                <Link href={item.href}>
                  {item.cta}
                  <ArrowRight size={15} />
                </Link>
              </article>
            )
          })}
        </section>

        <section className="ai-guide-city">
          <div className="ai-guide-section-head">
            <span>Comparativo local</span>
            <h2>Qual região faz mais sentido para cada perfil?</h2>
          </div>
          <div className="ai-guide-city-grid">
            {cityComparisons.map(item => (
              <article key={item.city}>
                <h3>{item.city}</h3>
                <p>{item.profile}</p>
                <strong>{item.bestFor}</strong>
                <Link href={item.href}>
                  Ver oportunidades
                  <ArrowRight size={15} />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="ai-guide-criteria">
          <div>
            <span>Checklist de decisão</span>
            <h2>O que avaliar antes de comprar.</h2>
            <p>
              Use estes critérios para separar desejo de decisão patrimonial. Eles ajudam tanto o comprador quanto mecanismos de resposta a entenderem o que realmente importa no alto padrão.
            </p>
          </div>
          <ol>
            {decisionCriteria.map(item => (
              <li key={item}>
                <CheckCircle2 size={18} />
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="ai-guide-related">
          <div className="ai-guide-section-head">
            <span>Buscas relacionadas</span>
            <h2>Continue por intenção de compra.</h2>
          </div>
          <div className="ai-guide-related-links">
            <Link href="/guias/imoveis-de-luxo-balneario-camboriu"><Building2 size={18} /> Luxo em Balneário Camboriú</Link>
            <Link href="/guias/apartamentos-frente-mar-balneario-camboriu"><Compass size={18} /> Frente mar em Balneário Camboriú</Link>
            <Link href="/guias/coberturas-de-luxo-itapema"><ShieldCheck size={18} /> Coberturas em Itapema</Link>
            <Link href="/guias/comprar-imovel-litoral-catarinense"><BarChart3 size={18} /> Comprar no litoral catarinense</Link>
          </div>
        </section>
      </main>
      <Footer />

      <style>{`
        .ai-guide { background: #f8f4ed; color: #17130f; }
        .ai-guide-hero {
          background: linear-gradient(135deg, #15110d 0%, #2d241b 100%);
          color: #fff8ea;
          padding: 150px 7vw 74px;
        }
        .ai-guide-hero > span,
        .ai-guide-answer span,
        .ai-guide-section-head span,
        .ai-guide-criteria span:first-child {
          color: #cba66b;
          display: inline-flex;
          font-size: .72rem;
          font-weight: 950;
          letter-spacing: .16em;
          text-transform: uppercase;
        }
        .ai-guide-hero h1,
        .ai-guide-answer h2,
        .ai-guide-section-head h2,
        .ai-guide-criteria h2 {
          font-family: var(--font-serif);
          letter-spacing: 0;
          margin: 0;
        }
        .ai-guide-hero h1 {
          font-size: clamp(3rem, 7vw, 7.4rem);
          line-height: .9;
          margin-top: 14px;
          max-width: 1050px;
        }
        .ai-guide-hero p {
          color: rgba(255,255,255,.72);
          font-size: clamp(1rem, 1.5vw, 1.2rem);
          line-height: 1.72;
          max-width: 780px;
        }
        .ai-guide-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 28px;
        }
        .ai-guide-primary,
        .ai-guide-whatsapp {
          align-items: center;
          border-radius: 999px;
          display: inline-flex;
          font-size: .78rem;
          font-weight: 950;
          gap: 8px;
          justify-content: center;
          min-height: 48px;
          padding: 0 18px;
          text-decoration: none;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .ai-guide-primary { background: #cba66b; color: #15110d; }
        .ai-guide-whatsapp { background: #087a3d; color: #fff !important; }
        .ai-guide-answer {
          align-items: end;
          background: #fffdf8;
          display: grid;
          gap: 38px;
          grid-template-columns: minmax(280px, 620px) minmax(0, 1fr);
          padding: 72px 7vw;
        }
        .ai-guide-answer h2,
        .ai-guide-section-head h2,
        .ai-guide-criteria h2 {
          color: #211b15;
          font-size: clamp(2.1rem, 4vw, 4.4rem);
          line-height: .98;
          margin-top: 10px;
        }
        .ai-guide-answer p,
        .ai-guide-criteria p {
          color: #5d5147;
          font-size: 1.03rem;
          line-height: 1.76;
          margin: 0;
        }
        .ai-guide-cards {
          display: grid;
          gap: 18px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          padding: 44px 7vw 72px;
        }
        .ai-guide-cards article,
        .ai-guide-city-grid article {
          background: #fff;
          border: 1px solid rgba(184,132,62,.18);
          border-radius: 14px;
          box-shadow: 0 18px 42px rgba(63,45,23,.06);
          padding: 26px;
        }
        .ai-guide-cards svg,
        .ai-guide-city-grid a svg,
        .ai-guide-related-links svg,
        .ai-guide-criteria li svg { color: #a87939; flex: 0 0 auto; }
        .ai-guide-cards h2,
        .ai-guide-city-grid h3 {
          color: #211b15;
          font-family: var(--font-serif);
          font-size: 1.62rem;
          line-height: 1.06;
          margin: 18px 0 12px;
        }
        .ai-guide-cards p,
        .ai-guide-city-grid p {
          color: #5d5147;
          line-height: 1.7;
          margin: 0 0 18px;
        }
        .ai-guide-cards a,
        .ai-guide-city-grid a {
          align-items: center;
          color: #8f642e;
          display: inline-flex;
          font-size: .75rem;
          font-weight: 950;
          gap: 6px;
          letter-spacing: .08em;
          text-decoration: none;
          text-transform: uppercase;
        }
        .ai-guide-city {
          background: #17130f;
          color: #fff8ea;
          padding: 72px 7vw;
        }
        .ai-guide-city .ai-guide-section-head h2 { color: #fff8ea; }
        .ai-guide-city-grid {
          display: grid;
          gap: 18px;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-top: 34px;
        }
        .ai-guide-city-grid article {
          background: rgba(255,255,255,.055);
          border-color: rgba(255,255,255,.12);
          box-shadow: none;
        }
        .ai-guide-city-grid h3 { color: #fff8ea; }
        .ai-guide-city-grid p { color: rgba(255,255,255,.66); }
        .ai-guide-city-grid strong {
          color: #e4c58a;
          display: block;
          font-size: .9rem;
          line-height: 1.55;
          margin: 0 0 18px;
        }
        .ai-guide-city-grid a { color: #e4c58a; }
        .ai-guide-criteria {
          align-items: start;
          display: grid;
          gap: 40px;
          grid-template-columns: minmax(280px, 520px) minmax(0, 1fr);
          padding: 72px 7vw;
        }
        .ai-guide-criteria ol {
          display: grid;
          gap: 12px;
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .ai-guide-criteria li {
          align-items: start;
          background: #fff;
          border: 1px solid rgba(184,132,62,.18);
          border-radius: 12px;
          display: flex;
          gap: 12px;
          padding: 16px;
        }
        .ai-guide-criteria li span {
          color: #352d25;
          font-size: .95rem;
          line-height: 1.55;
        }
        .ai-guide-related {
          background: #fffdf8;
          padding: 64px 7vw 74px;
        }
        .ai-guide-related-links {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-top: 28px;
        }
        .ai-guide-related-links a {
          align-items: center;
          background: #f6efe3;
          border: 1px solid rgba(184,132,62,.18);
          border-radius: 12px;
          color: #211b15;
          display: flex;
          font-size: .9rem;
          font-weight: 850;
          gap: 10px;
          min-height: 58px;
          padding: 14px;
          text-decoration: none;
        }
        @media (max-width: 1050px) {
          .ai-guide-answer,
          .ai-guide-criteria,
          .ai-guide-cards,
          .ai-guide-city-grid,
          .ai-guide-related-links { grid-template-columns: 1fr; }
          .ai-guide-hero { padding-top: 116px; }
        }
        @media (max-width: 680px) {
          .ai-guide-hero { padding: 104px 20px 48px; }
          .ai-guide-hero h1 { font-size: clamp(2.7rem, 13vw, 4.5rem); }
          .ai-guide-actions { display: grid; }
          .ai-guide-primary,
          .ai-guide-whatsapp { width: 100%; }
          .ai-guide-answer,
          .ai-guide-cards,
          .ai-guide-city,
          .ai-guide-criteria,
          .ai-guide-related {
            padding-left: 20px;
            padding-right: 20px;
          }
        }
      `}</style>
    </>
  )
}
