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
    title: 'Imóveis de luxo em Balneário Camboriú',
    h1: 'Imóveis de luxo em Balneário Camboriú',
    eyebrow: 'Mercado mais desejado de Santa Catarina',
    description: 'Apartamentos, coberturas e casas de alto padrão em Balneário Camboriú com curadoria para quem busca vista, liquidez e localização premium.',
    searchHref: '/busca?city=Balneario%20Camboriu',
    filters: { city: 'Balneario Camboriu' },
    highlights: ['Frente mar e quadra mar', 'Barra Sul, Centro e Norte', 'Liquidez e alto padrão'],
    faqs: [
      {
        question: 'Por que Balneário Camboriú é um dos mercados mais fortes do alto padrão?',
        answer: 'A cidade combina escassez de terrenos, verticalização premium, procura nacional e infraestrutura urbana. Isso sustenta desejo, liquidez e comparativos de preço acima da média regional.',
      },
      {
        question: 'Qual perfil de imóvel costuma ter maior procura em Balneário Camboriú?',
        answer: 'Frente mar, quadra mar, coberturas, apartamentos com vista definitiva e unidades em empreendimentos assinados por construtoras reconhecidas tendem a concentrar mais atenção.',
      },
    ],
  },
  {
    slug: 'praia-brava',
    title: 'Imóveis de luxo na Praia Brava',
    h1: 'Imóveis de luxo na Praia Brava',
    eyebrow: 'Natureza, desejo e exclusividade',
    description: 'Curadoria de casas, apartamentos e oportunidades de alto padrão na Praia Brava para quem busca praia, privacidade e vida sofisticada.',
    searchHref: '/busca?city=Praia%20Brava',
    filters: { city: 'Praia Brava' },
    highlights: ['Lifestyle de praia', 'Condomínios e casas premium', 'Proximidade de Balneário Camboriú'],
    faqs: [
      {
        question: 'Como funciona a curadoria de imóveis na Praia Brava?',
        answer: 'A busca destaca os empreendimentos e endereços da Praia Brava com foco em alto padrão, lifestyle de praia, privacidade e localização desejada.',
      },
      {
        question: 'Quem compra na Praia Brava procura que tipo de experiência?',
        answer: 'Normalmente busca uma combinação de praia, privacidade, gastronomia, natureza e acesso rápido a Balneário Camboriú, sem abrir mão de padrão construtivo.',
      },
    ],
  },
  {
    slug: 'itapema',
    title: 'Imóveis de luxo em Itapema',
    h1: 'Imóveis de luxo em Itapema',
    eyebrow: 'Crescimento e valorização no litoral',
    description: 'Apartamentos, frente mar e lançamentos em Itapema com leitura de mercado para compra, investimento e moradia no litoral catarinense.',
    searchHref: '/busca?city=Itapema',
    filters: { city: 'Itapema' },
    highlights: ['Meia Praia e frente mar', 'Lançamentos premium', 'Mercado em expansão'],
    faqs: [
      {
        question: 'Itapema ainda tem potencial de valorização?',
        answer: 'Itapema segue atraindo incorporadoras, compradores e investidores por ter boa oferta de lançamentos, faixa de preço competitiva e forte demanda por segunda moradia.',
      },
      {
        question: 'Qual região de Itapema costuma ser mais procurada?',
        answer: 'Meia Praia, frente mar e regiões com fácil acesso ao comércio e à BR-101 concentram boa parte da procura por imóveis de alto padrão.',
      },
    ],
  },
  {
    slug: 'frente-mar',
    title: 'Imóveis frente mar em Santa Catarina',
    h1: 'Imóveis frente mar no litoral catarinense',
    eyebrow: 'Vista, escassez e liquidez',
    description: 'Seleção de apartamentos, coberturas e casas frente mar para quem busca vista definitiva, exclusividade e alto valor percebido.',
    searchHref: '/busca?tag=frente-mar',
    filters: { textTerms: ['frente', 'mar'] },
    highlights: ['Vista definitiva', 'Alta demanda', 'Endereço premium'],
    faqs: [
      {
        question: 'O que diferencia frente mar de quadra mar?',
        answer: 'Frente mar tem exposição direta para a praia e geralmente maior escassez. Quadra mar fica próximo da praia, mas sem a mesma condição de vista e exclusividade.',
      },
      {
        question: 'Imóveis frente mar tendem a ter maior liquidez?',
        answer: 'Em mercados consolidados, a combinação de vista, localização e escassez costuma sustentar maior liquidez, especialmente quando o produto tem planta e padrão compatíveis.',
      },
    ],
  },
  {
    slug: 'casas-alto-padrao',
    title: 'Casas de alto padrão no litoral catarinense',
    h1: 'Casas de alto padrão no litoral catarinense',
    eyebrow: 'Privacidade, terreno e assinatura',
    description: 'Casas, mansões e residências em condomínios premium para quem busca privacidade, arquitetura e experiência completa no litoral.',
    searchHref: '/busca?type=casa&priceMin=5000000',
    filters: { type: 'casa', priceMin: 5000000, textTerms: ['casa'] },
    highlights: ['Condomínios premium', 'Casas acima de R$ 5 mi', 'Privacidade e terreno'],
    faqs: [
      {
        question: 'O que define uma casa de alto padrão?',
        answer: 'Mais do que preço, uma casa de alto padrão combina terreno, privacidade, arquitetura, materiais, localização, segurança e uma experiência de uso superior.',
      },
      {
        question: 'Casas em condomínio valorizam bem no litoral?',
        answer: 'Quando unem segurança, boa localização, baixa oferta e padrão construtivo consistente, tendem a manter alta procura entre famílias e compradores de alto poder aquisitivo.',
      },
    ],
  },
  {
    slug: 'coberturas',
    title: 'Coberturas de luxo em Santa Catarina',
    h1: 'Coberturas de luxo no litoral catarinense',
    eyebrow: 'Privacidade no alto',
    description: 'Coberturas e duplex de alto padrão com vista, áreas sociais amplas e curadoria para compradores exigentes.',
    searchHref: '/busca?subtype=cobertura',
    filters: { subtype: 'cobertura', textTerms: ['cobertura'] },
    highlights: ['Vista e amplitude', 'Plantas exclusivas', 'Endereço de desejo'],
    faqs: [
      {
        question: 'Por que coberturas são tão desejadas no alto padrão?',
        answer: 'Coberturas entregam privacidade, vista, área social ampliada e sensação de casa dentro de um edifício, pontos muito valorizados no mercado premium.',
      },
      {
        question: 'O que analisar antes de comprar uma cobertura?',
        answer: 'É importante avaliar vista, insolação, posição no edifício, áreas externas, padrão do condomínio, vagas, privacidade e comparativo real de preço por metro quadrado.',
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
