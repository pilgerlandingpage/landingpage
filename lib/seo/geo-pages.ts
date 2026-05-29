export type GeoPageConfig = {
  slug: string
  title: string
  h1: string
  eyebrow: string
  description: string
  searchHref: string
  filters: {
    city?: string
    type?: 'casa' | 'apartamento'
    subtype?: string
    tag?: string
    priceMin?: number
    textTerms?: string[]
  }
  faqs: Array<{ question: string; answer: string }>
  highlights: string[]
}

export const geoPages: GeoPageConfig[] = [
  {
    slug: 'balneario-camboriu',
    title: 'Imoveis de luxo em Balneario Camboriu',
    h1: 'Imoveis de luxo em Balneario Camboriu',
    eyebrow: 'Mercado mais desejado de Santa Catarina',
    description: 'Apartamentos, coberturas e casas de alto padrao em Balneario Camboriu com curadoria para quem busca vista, liquidez e localizacao premium.',
    searchHref: '/busca?city=Balneario%20Camboriu',
    filters: { city: 'Balneario Camboriu' },
    highlights: ['Frente mar e quadra mar', 'Barra Sul, Centro e Norte', 'Liquidez e alto padrao'],
    faqs: [
      {
        question: 'Por que Balneario Camboriu e um dos mercados mais fortes do alto padrao?',
        answer: 'A cidade combina escassez de terrenos, verticalizacao premium, procura nacional e infraestrutura urbana. Isso sustenta desejo, liquidez e comparativos de preco acima da media regional.',
      },
      {
        question: 'Qual perfil de imovel costuma ter maior procura em Balneario Camboriu?',
        answer: 'Frente mar, quadra mar, coberturas, apartamentos com vista definitiva e unidades em empreendimentos assinados por construtoras reconhecidas tendem a concentrar mais atencao.',
      },
    ],
  },
  {
    slug: 'praia-brava',
    title: 'Imoveis de luxo na Praia Brava',
    h1: 'Imoveis de luxo na Praia Brava',
    eyebrow: 'Natureza, desejo e exclusividade',
    description: 'Curadoria de casas, apartamentos e oportunidades de alto padrao na Praia Brava para quem busca praia, privacidade e vida sofisticada.',
    searchHref: '/busca?city=Itajai',
    filters: { city: 'Itajai' },
    highlights: ['Lifestyle de praia', 'Condominios e casas premium', 'Proximidade de Balneario Camboriu'],
    faqs: [
      {
        question: 'Praia Brava e Itajai sao a mesma busca no sistema?',
        answer: 'No cadastro oficial muitos imoveis aparecem como Itajai, mas comercialmente a busca do alto padrao usa Praia Brava como referencia de desejo e localizacao.',
      },
      {
        question: 'Quem compra na Praia Brava procura que tipo de experiencia?',
        answer: 'Normalmente busca uma combinacao de praia, privacidade, gastronomia, natureza e acesso rapido a Balneario Camboriu, sem abrir mao de padrao construtivo.',
      },
    ],
  },
  {
    slug: 'itapema',
    title: 'Imoveis de luxo em Itapema',
    h1: 'Imoveis de luxo em Itapema',
    eyebrow: 'Crescimento e valorizacao no litoral',
    description: 'Apartamentos, frente mar e lancamentos em Itapema com leitura de mercado para compra, investimento e moradia no litoral catarinense.',
    searchHref: '/busca?city=Itapema',
    filters: { city: 'Itapema' },
    highlights: ['Meia Praia e frente mar', 'Lancamentos premium', 'Mercado em expansao'],
    faqs: [
      {
        question: 'Itapema ainda tem potencial de valorizacao?',
        answer: 'Itapema segue atraindo incorporadoras, compradores e investidores por ter boa oferta de lancamentos, faixa de preco competitiva e forte demanda por segunda moradia.',
      },
      {
        question: 'Qual regiao de Itapema costuma ser mais procurada?',
        answer: 'Meia Praia, frente mar e regioes com facil acesso ao comercio e a BR-101 concentram boa parte da procura por imoveis de alto padrao.',
      },
    ],
  },
  {
    slug: 'frente-mar',
    title: 'Imoveis frente mar em Santa Catarina',
    h1: 'Imoveis frente mar no litoral catarinense',
    eyebrow: 'Vista, escassez e liquidez',
    description: 'Selecao de apartamentos, coberturas e casas frente mar para quem busca vista definitiva, exclusividade e alto valor percebido.',
    searchHref: '/busca?tag=frente-mar',
    filters: { textTerms: ['frente', 'mar'] },
    highlights: ['Vista definitiva', 'Alta demanda', 'Endereco premium'],
    faqs: [
      {
        question: 'O que diferencia frente mar de quadra mar?',
        answer: 'Frente mar tem exposicao direta para a praia e geralmente maior escassez. Quadra mar fica proximo da praia, mas sem a mesma condicao de vista e exclusividade.',
      },
      {
        question: 'Imoveis frente mar tendem a ter maior liquidez?',
        answer: 'Em mercados consolidados, a combinacao de vista, localizacao e escassez costuma sustentar maior liquidez, especialmente quando o produto tem planta e padrao compativeis.',
      },
    ],
  },
  {
    slug: 'casas-alto-padrao',
    title: 'Casas de alto padrao no litoral catarinense',
    h1: 'Casas de alto padrao no litoral catarinense',
    eyebrow: 'Privacidade, terreno e assinatura',
    description: 'Casas, mansoes e residencias em condominios premium para quem busca privacidade, arquitetura e experiencia completa no litoral.',
    searchHref: '/busca?type=casa&priceMin=5000000',
    filters: { type: 'casa', priceMin: 5000000, textTerms: ['casa'] },
    highlights: ['Condominios premium', 'Casas acima de R$ 5 mi', 'Privacidade e terreno'],
    faqs: [
      {
        question: 'O que define uma casa de alto padrao?',
        answer: 'Mais do que preco, uma casa de alto padrao combina terreno, privacidade, arquitetura, materiais, localizacao, seguranca e uma experiencia de uso superior.',
      },
      {
        question: 'Casas em condominio valorizam bem no litoral?',
        answer: 'Quando unem seguranca, boa localizacao, baixa oferta e padrao construtivo consistente, tendem a manter alta procura entre familias e compradores de alto poder aquisitivo.',
      },
    ],
  },
  {
    slug: 'coberturas',
    title: 'Coberturas de luxo em Santa Catarina',
    h1: 'Coberturas de luxo no litoral catarinense',
    eyebrow: 'Privacidade no alto',
    description: 'Coberturas e duplex de alto padrao com vista, areas sociais amplas e curadoria para compradores exigentes.',
    searchHref: '/busca?subtype=cobertura',
    filters: { subtype: 'cobertura', textTerms: ['cobertura'] },
    highlights: ['Vista e amplitude', 'Plantas exclusivas', 'Endereco de desejo'],
    faqs: [
      {
        question: 'Por que coberturas sao tao desejadas no alto padrao?',
        answer: 'Coberturas entregam privacidade, vista, area social ampliada e sensacao de casa dentro de um edificio, pontos muito valorizados no mercado premium.',
      },
      {
        question: 'O que analisar antes de comprar uma cobertura?',
        answer: 'E importante avaliar vista, insolacao, posicao no edificio, areas externas, padrao do condominio, vagas, privacidade e comparativo real de preco por metro quadrado.',
      },
    ],
  },
]

export function getGeoPage(slug: string) {
  return geoPages.find(page => page.slug === slug)
}

export function getGeoPages() {
  return geoPages
}
