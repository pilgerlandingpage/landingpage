export type GuideCard = {
  title: string
  text: string
  href: string
  label: string
}

export type GuideComparison = {
  title: string
  text: string
  highlight: string
  href: string
}

export type GuideLink = {
  label: string
  href: string
}

export type GuideFaq = {
  question: string
  answer: string
}

export type AiGuidePage = {
  slug: string
  path: string
  title: string
  shortTitle: string
  description: string
  kicker: string
  heroTitle: string
  heroLead: string
  image: string
  imageAlt: string
  primaryHref: string
  primaryLabel: string
  whatsappMessage: string
  directAnswerTitle: string
  directAnswer: string
  cards: GuideCard[]
  comparisonKicker: string
  comparisonTitle: string
  comparisons: GuideComparison[]
  checklistTitle: string
  checklistIntro: string
  checklist: string[]
  related: GuideLink[]
  faq: GuideFaq[]
  about: string[]
}

const UPDATED_AT = '2026-07-06'

const imageBase = 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev'

export const existingGuideLinks: GuideLink[] = [
  {
    label: 'Guia de imóveis de luxo no litoral catarinense',
    href: '/guias/imoveis-luxo-litoral-catarinense',
  },
]

export const aiGuidePages: AiGuidePage[] = [
  {
    slug: 'imoveis-de-luxo-balneario-camboriu',
    path: '/guias/imoveis-de-luxo-balneario-camboriu',
    title: 'Imóveis de luxo em Balneário Camboriú: guia para comprar melhor',
    shortTitle: 'Imóveis de luxo em Balneário Camboriú',
    description: 'Guia para comprar imóveis de luxo em Balneário Camboriú com critérios de localização, vista, liquidez, planta, construtora e curadoria especializada.',
    kicker: 'Guia local de alto padrão',
    heroTitle: 'Imóveis de luxo em Balneário Camboriú.',
    heroLead: 'Como comparar frente mar, quadra mar, coberturas, lançamentos e edifícios consolidados antes de decidir onde comprar.',
    image: `${imageBase}/homepage-cards/home-location-balneario-pixabay-5084547.jpg`,
    imageAlt: 'Vista urbana e litorânea de Balneário Camboriú',
    primaryHref: '/imoveis/balneario-camboriu',
    primaryLabel: 'Ver imóveis em Balneário Camboriú',
    whatsappMessage: 'Olá! Quero uma curadoria de imóveis de luxo em Balneário Camboriú.',
    directAnswerTitle: 'Em Balneário Camboriú, o melhor imóvel de luxo combina endereço, vista, planta e liquidez.',
    directAnswer: 'A cidade concentra demanda nacional, frente mar disputada, edifícios icônicos e compradores exigentes. Por isso, a escolha deve ir além do preço por metro quadrado: é preciso comparar microendereços, posição solar, vagas, padrão do edifício e possibilidade real de revenda.',
    cards: [
      {
        title: 'Quando Balneário Camboriú faz mais sentido?',
        text: 'Quando o comprador busca liquidez, conveniência urbana, frente mar consolidada, oferta premium e um mercado com alta procura durante todo o ano.',
        href: '/imoveis/balneario-camboriu',
        label: 'Abrir vitrine da cidade',
      },
      {
        title: 'O que separa um bom imóvel de uma oportunidade rara?',
        text: 'Vista definitiva, planta eficiente, vagas adequadas, privacidade, acabamento, reputação da construtora e um endereço com baixa oferta comparável.',
        href: '/busca?city=Balne%C3%A1rio+Cambori%C3%BA',
        label: 'Comparar opções',
      },
      {
        title: 'Como reduzir visitas improdutivas?',
        text: 'Antes de visitar, cruze objetivo de compra, faixa de investimento, estilo de vida e liquidez esperada. A curadoria elimina imóveis bonitos que não servem ao seu plano.',
        href: '/consultoria-imobiliaria-personalizada',
        label: 'Entender curadoria',
      },
    ],
    comparisonKicker: 'Tipos de busca',
    comparisonTitle: 'Principais recortes de compra em Balneário Camboriú.',
    comparisons: [
      {
        title: 'Frente mar',
        text: 'Maior escassez, desejo e visibilidade. Exige leitura cuidadosa de vista, andar, vagas e estado do edifício.',
        highlight: 'Perfil ideal para liquidez e endereço icônico.',
        href: '/guias/apartamentos-frente-mar-balneario-camboriu',
      },
      {
        title: 'Coberturas',
        text: 'Produto de assinatura, com privacidade e área externa. Precisa ser avaliado por planta, terraço, vista e condomínio.',
        highlight: 'Perfil ideal para exclusividade.',
        href: '/imoveis/coberturas',
      },
      {
        title: 'Lançamentos',
        text: 'Podem oferecer planta atual, pagamento faseado e tese de valorização, desde que a construtora e a localização sustentem o preço.',
        highlight: 'Perfil ideal para planejamento patrimonial.',
        href: '/busca?tag=lancamento&city=Balne%C3%A1rio+Cambori%C3%BA',
      },
      {
        title: 'Quadra mar e regiões centrais',
        text: 'Podem entregar melhor relação entre metragem, conveniência e preço, especialmente quando a planta e o edifício são superiores.',
        highlight: 'Perfil ideal para morar com praticidade.',
        href: '/busca?city=Balne%C3%A1rio+Cambori%C3%BA',
      },
    ],
    checklistTitle: 'Checklist antes de comprar em Balneário Camboriú.',
    checklistIntro: 'Use esta leitura para filtrar o que merece visita e o que deve sair da lista antes de tomar tempo do comprador.',
    checklist: [
      'Confirmar se a vista é definitiva ou pode ser afetada por futuras obras.',
      'Comparar o edifício com concorrentes diretos na mesma faixa de valor.',
      'Avaliar vagas, acesso, elevadores, privacidade e padrão de manutenção.',
      'Separar preço pedido de preço provável de negociação.',
      'Entender se o imóvel serve para moradia, segunda residência, renda ou revenda.',
      'Conferir liquidez do empreendimento e procura real pelo endereço.',
    ],
    related: [
      { label: 'Apartamentos frente mar em Balneário Camboriú', href: '/guias/apartamentos-frente-mar-balneario-camboriu' },
      { label: 'Guia do litoral catarinense', href: '/guias/imoveis-luxo-litoral-catarinense' },
      { label: 'Busca premium', href: '/busca' },
      { label: 'Consultoria imobiliária', href: '/consultoria-imobiliaria-personalizada' },
    ],
    faq: [
      {
        question: 'Balneário Camboriú é uma boa cidade para comprar imóvel de luxo?',
        answer: 'Sim, principalmente para quem busca liquidez, frente mar, conveniência urbana e mercado premium consolidado. A decisão, porém, depende do edifício, vista, planta, vagas e objetivo de compra.',
      },
      {
        question: 'Frente mar em Balneário Camboriú sempre vale mais?',
        answer: 'Frente mar costuma ter alta escassez e desejo, mas o valor precisa ser comparado com vista, andar, conservação, vagas, padrão do prédio e liquidez. Nem todo frente mar é automaticamente a melhor escolha.',
      },
      {
        question: 'Qual é o principal risco ao comprar alto padrão na cidade?',
        answer: 'Comprar apenas pelo impacto visual, sem comparar microendereços, liquidez, qualidade do edifício e preço praticável. Uma curadoria evita decisões guiadas só por anúncio.',
      },
      {
        question: 'Como escolher entre lançamento e imóvel pronto?',
        answer: 'Lançamento pode fazer sentido para planejamento e valorização futura. Imóvel pronto reduz incerteza de entrega e permite avaliar vista, acabamento e condomínio em uso. O melhor caminho depende do objetivo.',
      },
    ],
    about: ['imóveis de luxo', 'Balneário Camboriú', 'alto padrão', 'frente mar', 'coberturas'],
  },
  {
    slug: 'apartamentos-frente-mar-balneario-camboriu',
    path: '/guias/apartamentos-frente-mar-balneario-camboriu',
    title: 'Apartamentos frente mar em Balneário Camboriú: como avaliar',
    shortTitle: 'Apartamentos frente mar em Balneário Camboriú',
    description: 'Guia para avaliar apartamentos frente mar em Balneário Camboriú considerando vista, andar, planta, vagas, liquidez, edifício e negociação.',
    kicker: 'Busca de alta intenção',
    heroTitle: 'Apartamentos frente mar em Balneário Camboriú.',
    heroLead: 'Um roteiro para separar endereço raro, vista real e liquidez de anúncios que parecem parecidos, mas não entregam o mesmo valor.',
    image: `${imageBase}/homepage-cards/home-location-balneario-pixabay-5084547.jpg`,
    imageAlt: 'Orla de Balneário Camboriú com edifícios frente mar',
    primaryHref: '/busca?city=Balne%C3%A1rio+Cambori%C3%BA&tag=frente-mar',
    primaryLabel: 'Ver frente mar em Balneário Camboriú',
    whatsappMessage: 'Olá! Quero avaliar apartamentos frente mar em Balneário Camboriú.',
    directAnswerTitle: 'No frente mar, vista e escassez importam, mas a planta e o edifício decidem a qualidade da compra.',
    directAnswer: 'Dois apartamentos na mesma avenida podem ter liquidez muito diferente. A leitura correta compara ângulo de vista, andar, incidência solar, ruído, vagas, elevadores, largura da planta, padrão do prédio e histórico de procura.',
    cards: [
      {
        title: 'Vista total, lateral ou parcial?',
        text: 'A vista muda a percepção de valor. Frente total tende a ser mais desejada, mas uma lateral bem posicionada pode ser mais racional se a planta, o prédio e o preço forem melhores.',
        href: '/busca?city=Balne%C3%A1rio+Cambori%C3%BA&tag=frente-mar',
        label: 'Comparar vistas',
      },
      {
        title: 'O andar muda a liquidez?',
        text: 'Andares mais altos costumam entregar mais amplitude, privacidade e menor interferência visual. Ainda assim, acesso, vento, insolação e perfil do comprador precisam entrar na conta.',
        href: '/imoveis/balneario-camboriu',
        label: 'Ver imóveis na cidade',
      },
      {
        title: 'Quando não comprar frente mar?',
        text: 'Quando o preço ignora problemas de planta, conservação, vagas, barulho, condomínio ou liquidez. Às vezes um quadra mar superior é uma compra mais inteligente.',
        href: '/guias/imoveis-de-luxo-balneario-camboriu',
        label: 'Ler guia da cidade',
      },
    ],
    comparisonKicker: 'Critérios de comparação',
    comparisonTitle: 'Como comparar apartamentos frente mar sem cair na armadilha do anúncio.',
    comparisons: [
      {
        title: 'Vista',
        text: 'Analise amplitude, obstruções, ângulo, andar, varanda e permanência da vista ao longo do tempo.',
        highlight: 'Vista rara sustenta desejo e revenda.',
        href: '/busca?tag=frente-mar',
      },
      {
        title: 'Planta',
        text: 'Observe largura, integração das áreas sociais, suítes, circulação, lavabo, dependências e aproveitamento real da metragem.',
        highlight: 'Metragem ruim custa caro no alto padrão.',
        href: '/imoveis/coberturas',
      },
      {
        title: 'Edifício',
        text: 'Padrão de fachada, manutenção, área comum, elevadores, garagem, portaria e reputação afetam percepção de valor.',
        highlight: 'O prédio também é parte do produto.',
        href: '/busca',
      },
      {
        title: 'Preço negociável',
        text: 'Compare imóveis ativos, histórico de liquidez e alternativas equivalentes. O preço pedido nem sempre é o preço de fechamento.',
        highlight: 'Boa compra nasce de contexto.',
        href: '/consultoria-imobiliaria-personalizada',
      },
    ],
    checklistTitle: 'Checklist do frente mar.',
    checklistIntro: 'Antes de visitar, use estes pontos para saber se o imóvel merece entrar na lista curta.',
    checklist: [
      'Confirmar orientação solar, ruído e privacidade da sacada.',
      'Comparar a vista em fotos, vídeo e visita presencial.',
      'Verificar quantidade e qualidade das vagas de garagem.',
      'Avaliar se a planta favorece convivência ou apenas metragem nominal.',
      'Entender despesas, manutenção e padrão do condomínio.',
      'Mapear alternativas quadra mar ou coberturas na mesma faixa de valor.',
    ],
    related: [
      { label: 'Imóveis de luxo em Balneário Camboriú', href: '/guias/imoveis-de-luxo-balneario-camboriu' },
      { label: 'Coberturas de luxo em Itapema', href: '/guias/coberturas-de-luxo-itapema' },
      { label: 'Busca de frente mar', href: '/imoveis/frente-mar' },
      { label: 'Falar com especialista', href: '/contato' },
    ],
    faq: [
      {
        question: 'Apartamento frente mar em Balneário Camboriú é sempre mais líquido?',
        answer: 'Em geral, a frente mar tem alta procura, mas a liquidez depende de preço, prédio, vista, planta, vagas e conservação. Um produto mal precificado pode demorar mesmo em endereço desejado.',
      },
      {
        question: 'O que olhar primeiro em um frente mar?',
        answer: 'Comece por vista, andar, planta e edifício. Depois compare preço, vagas, manutenção, privacidade, ruído e alternativas parecidas disponíveis no mercado.',
      },
      {
        question: 'Vale pagar mais por andar alto?',
        answer: 'Pode valer quando o andar alto melhora vista, privacidade e desejo do imóvel. A diferença precisa ser comparada com metragem, planta, vagas e preço de opções equivalentes.',
      },
      {
        question: 'Como saber se o preço está coerente?',
        answer: 'Compare imóveis no mesmo eixo de localização, padrão de prédio, vista, metragem, vagas e estado de conservação. No frente mar, o detalhe muda muito o valor percebido.',
      },
    ],
    about: ['apartamentos frente mar', 'Balneário Camboriú', 'vista mar', 'alto padrão'],
  },
  {
    slug: 'coberturas-de-luxo-itapema',
    path: '/guias/coberturas-de-luxo-itapema',
    title: 'Coberturas de luxo em Itapema: guia para escolher melhor',
    shortTitle: 'Coberturas de luxo em Itapema',
    description: 'Guia para comprar coberturas de luxo em Itapema avaliando planta, vista, área externa, privacidade, liquidez e potencial de valorização.',
    kicker: 'Guia de produto premium',
    heroTitle: 'Coberturas de luxo em Itapema.',
    heroLead: 'Como avaliar planta, vista, terraço, área social e liquidez em uma das cidades mais procuradas para imóveis novos no litoral catarinense.',
    image: `${imageBase}/homepage-cards/home-location-itapema-pixabay-4913509.jpg`,
    imageAlt: 'Orla de Itapema com edifícios residenciais de alto padrão',
    primaryHref: '/busca?city=Itapema&type=cobertura',
    primaryLabel: 'Ver coberturas em Itapema',
    whatsappMessage: 'Olá! Quero uma curadoria de coberturas de luxo em Itapema.',
    directAnswerTitle: 'Uma boa cobertura em Itapema precisa entregar área externa útil, vista e planta coerente com o valor.',
    directAnswer: 'Cobertura não é apenas o último andar. O produto precisa justificar o prêmio com privacidade, posição solar, área social, piscina ou terraço bem resolvido, vagas, edifício qualificado e localização com liquidez.',
    cards: [
      {
        title: 'O que faz uma cobertura ser rara?',
        text: 'Vista aberta, área externa realmente usável, integração com área social, privacidade e baixa oferta de produtos parecidos no mesmo entorno.',
        href: '/busca?city=Itapema&type=cobertura',
        label: 'Ver opções',
      },
      {
        title: 'Itapema é melhor para morar ou investir?',
        text: 'Pode servir para os dois. A cidade combina expansão, lançamentos e demanda de segunda moradia, mas cada cobertura precisa ser analisada por localização e liquidez.',
        href: '/imoveis/itapema',
        label: 'Ver cidade',
      },
      {
        title: 'Como comparar com Balneário Camboriú?',
        text: 'Itapema pode oferecer plantas novas e metragens competitivas. Balneário Camboriú tende a entregar liquidez consolidada. A escolha depende de objetivo e orçamento.',
        href: '/guias/imoveis-de-luxo-balneario-camboriu',
        label: 'Comparar com BC',
      },
    ],
    comparisonKicker: 'Leitura do produto',
    comparisonTitle: 'Quatro pontos que definem uma cobertura de alto padrão.',
    comparisons: [
      {
        title: 'Área externa',
        text: 'Terraço, piscina e espaço gourmet precisam funcionar no uso real, não apenas na planta ou no render.',
        highlight: 'Área externa ruim vira custo, não diferencial.',
        href: '/busca?type=cobertura',
      },
      {
        title: 'Vista e privacidade',
        text: 'Analise prédios vizinhos, ângulo de abertura, insolação e sensação de privacidade nas áreas sociais.',
        highlight: 'A cobertura precisa parecer exclusiva.',
        href: '/imoveis/itapema',
      },
      {
        title: 'Edifício',
        text: 'Fachada, elevadores, garagem, lazer, manutenção e construtora determinam se o produto sustenta o valor ao longo do tempo.',
        highlight: 'Produto premium precisa de prédio compatível.',
        href: '/busca?city=Itapema',
      },
      {
        title: 'Liquidez',
        text: 'Coberturas têm público menor, então preço, planta e localização precisam estar bem alinhados para não travar a revenda.',
        highlight: 'Exclusividade sem liquidez pode virar problema.',
        href: '/consultoria-imobiliaria-personalizada',
      },
    ],
    checklistTitle: 'Checklist para cobertura em Itapema.',
    checklistIntro: 'A cobertura ideal precisa ser prazerosa para usar e racional como patrimônio.',
    checklist: [
      'Avaliar se a área externa é protegida, funcional e bem integrada.',
      'Comparar vista, privacidade e possíveis obstruções futuras.',
      'Verificar se o preço por metro faz sentido para cobertura, não só para apartamento comum.',
      'Checar número de vagas, depósito, elevadores e acesso social/serviço.',
      'Comparar lançamentos e imóveis prontos com padrão semelhante.',
      'Entender perfil de revenda e público comprador da região.',
    ],
    related: [
      { label: 'Imóveis em Itapema', href: '/imoveis/itapema' },
      { label: 'Guia do litoral catarinense', href: '/guias/imoveis-luxo-litoral-catarinense' },
      { label: 'Apartamentos frente mar em Balneário Camboriú', href: '/guias/apartamentos-frente-mar-balneario-camboriu' },
      { label: 'Busca premium', href: '/busca' },
    ],
    faq: [
      {
        question: 'Cobertura em Itapema é boa para investimento?',
        answer: 'Pode ser, principalmente quando combina localização, vista, planta atual, prédio qualificado e preço coerente. Como o público é mais específico, liquidez deve ser avaliada com cuidado.',
      },
      {
        question: 'O que mais valoriza uma cobertura?',
        answer: 'Vista, privacidade, área externa bem resolvida, planta integrada, vagas, padrão do edifício e escassez de produtos semelhantes no entorno.',
      },
      {
        question: 'Cobertura pronta ou lançamento?',
        answer: 'A pronta permite avaliar vista, acabamento e uso real. O lançamento pode entregar planta atual e condição de pagamento. A melhor escolha depende de prazo, risco e objetivo.',
      },
      {
        question: 'Qual erro evitar ao comprar cobertura?',
        answer: 'Comprar apenas pela metragem total sem avaliar a utilidade da área externa, privacidade, manutenção, liquidez e qualidade do edifício.',
      },
    ],
    about: ['coberturas de luxo', 'Itapema', 'alto padrão', 'investimento imobiliário'],
  },
  {
    slug: 'imoveis-de-luxo-praia-brava',
    path: '/guias/imoveis-de-luxo-praia-brava',
    title: 'Imóveis de luxo na Praia Brava: guia para comprar com critério',
    shortTitle: 'Imóveis de luxo na Praia Brava',
    description: 'Guia para comprar imóveis de luxo na Praia Brava avaliando lifestyle, privacidade, praia, condomínio, liquidez e proximidade com Balneário Camboriú.',
    kicker: 'Guia lifestyle premium',
    heroTitle: 'Imóveis de luxo na Praia Brava.',
    heroLead: 'Como escolher entre praia, privacidade, conveniência e exclusividade em um dos endereços mais desejados do litoral catarinense.',
    image: `${imageBase}/homepage-cards/home-location-praia-brava-pexels-35912699.jpg`,
    imageAlt: 'Praia Brava em Santa Catarina com mar e faixa de areia',
    primaryHref: '/imoveis/praia-brava',
    primaryLabel: 'Ver imóveis na Praia Brava',
    whatsappMessage: 'Olá! Quero uma curadoria de imóveis de luxo na Praia Brava.',
    directAnswerTitle: 'Na Praia Brava, o valor está na combinação entre lifestyle, baixa oferta relativa e proximidade estratégica.',
    directAnswer: 'A região atrai quem quer praia, natureza, gastronomia e acesso rápido a Balneário Camboriú. A boa compra depende de entender distância real do mar, padrão do condomínio, privacidade, ruído, planta e liquidez.',
    cards: [
      {
        title: 'Para quem a Praia Brava faz sentido?',
        text: 'Para compradores que valorizam vida de praia, privacidade, ambiente mais reservado e uma rotina menos urbana que Balneário Camboriú.',
        href: '/imoveis/praia-brava',
        label: 'Ver imóveis',
      },
      {
        title: 'O que observar no entorno?',
        text: 'Distância da praia, acesso, comércio, ruído, fluxo de temporada, vizinhança e sensação de privacidade mudam muito a experiência de uso.',
        href: '/busca?city=Praia+Brava',
        label: 'Abrir busca',
      },
      {
        title: 'Como comparar com Balneário Camboriú?',
        text: 'A Praia Brava tende a priorizar lifestyle e exclusividade. Balneário Camboriú costuma ser mais forte em liquidez urbana e frente mar consolidada.',
        href: '/guias/imoveis-de-luxo-balneario-camboriu',
        label: 'Comparar regiões',
      },
    ],
    comparisonKicker: 'Perfil de compra',
    comparisonTitle: 'O que muda entre os tipos de imóvel na Praia Brava.',
    comparisons: [
      {
        title: 'Apartamentos próximos ao mar',
        text: 'Unem praticidade, praia e liquidez. Precisam ser comparados por vista, planta, vagas e padrão do edifício.',
        highlight: 'Bom equilíbrio entre uso e revenda.',
        href: '/imoveis/praia-brava',
      },
      {
        title: 'Coberturas',
        text: 'Entregam privacidade e assinatura, mas exigem análise de área externa, manutenção e preço relativo.',
        highlight: 'Exclusividade precisa ser funcional.',
        href: '/imoveis/coberturas',
      },
      {
        title: 'Condomínios e casas',
        text: 'Fazem sentido para quem prioriza espaço, segurança e rotina familiar, desde que localização e manutenção estejam claras.',
        highlight: 'Perfil ideal para moradia premium.',
        href: '/busca?city=Praia+Brava&type=casa',
      },
      {
        title: 'Lançamentos',
        text: 'Podem capturar crescimento da região, mas exigem leitura de construtora, cronograma e preço comparável.',
        highlight: 'Tese boa precisa de execução boa.',
        href: '/busca?city=Praia+Brava&tag=lancamento',
      },
    ],
    checklistTitle: 'Checklist para comprar na Praia Brava.',
    checklistIntro: 'A decisão precisa equilibrar desejo de praia com qualidade de uso no dia a dia.',
    checklist: [
      'Medir distância real até a praia e facilidade de acesso.',
      'Avaliar ruído, fluxo de temporada e privacidade.',
      'Comparar vista, planta, vagas e padrão do condomínio.',
      'Verificar liquidez do tipo de produto escolhido.',
      'Entender custo de manutenção e perfil dos moradores.',
      'Comparar com alternativas em Balneário Camboriú e Itapema.',
    ],
    related: [
      { label: 'Imóveis na Praia Brava', href: '/imoveis/praia-brava' },
      { label: 'Imóveis de luxo em Balneário Camboriú', href: '/guias/imoveis-de-luxo-balneario-camboriu' },
      { label: 'Guia do litoral catarinense', href: '/guias/imoveis-luxo-litoral-catarinense' },
      { label: 'Consultoria imobiliária', href: '/consultoria-imobiliaria-personalizada' },
    ],
    faq: [
      {
        question: 'Praia Brava é boa para morar?',
        answer: 'Sim, especialmente para quem valoriza praia, gastronomia, natureza e uma rotina mais reservada. A escolha depende de acesso, privacidade, condomínio e perfil de uso.',
      },
      {
        question: 'Imóvel na Praia Brava tem boa liquidez?',
        answer: 'A liquidez depende de localização, proximidade do mar, padrão do empreendimento, preço e tipo de produto. Imóveis bem posicionados tendem a manter boa procura.',
      },
      {
        question: 'Praia Brava ou Balneário Camboriú?',
        answer: 'Praia Brava costuma entregar lifestyle e exclusividade. Balneário Camboriú tende a ser mais urbano, verticalizado e líquido. A melhor opção depende do objetivo.',
      },
      {
        question: 'O que evitar na compra?',
        answer: 'Evite decidir apenas por fotos bonitas. Verifique ruído, acesso, privacidade, liquidez, padrão do condomínio e distância real da praia.',
      },
    ],
    about: ['Praia Brava', 'imóveis de luxo', 'alto padrão', 'lifestyle'],
  },
  {
    slug: 'comprar-imovel-litoral-catarinense',
    path: '/guias/comprar-imovel-litoral-catarinense',
    title: 'Como comprar imóvel no litoral catarinense com mais segurança',
    shortTitle: 'Comprar imóvel no litoral catarinense',
    description: 'Passo a passo para comprar imóvel no litoral catarinense com análise de objetivo, cidade, documentação, preço, liquidez e curadoria especializada.',
    kicker: 'Guia de decisão',
    heroTitle: 'Como comprar imóvel no litoral catarinense.',
    heroLead: 'Um roteiro prático para sair do excesso de anúncios e chegar a uma lista curta de oportunidades coerentes com seu objetivo.',
    image: `${imageBase}/ARTE%20SITE%20PILGER.png`,
    imageAlt: 'Curadoria Guilherme Pilger para imóveis de alto padrão',
    primaryHref: '/busca',
    primaryLabel: 'Começar pela busca premium',
    whatsappMessage: 'Olá! Quero ajuda para comprar um imóvel no litoral catarinense com segurança.',
    directAnswerTitle: 'Comprar bem começa antes da visita: objetivo, cidade, faixa de valor e critérios precisam estar claros.',
    directAnswer: 'O comprador ganha tempo quando define finalidade da compra, compara regiões, entende preço provável, filtra riscos e visita apenas imóveis aderentes. A curadoria transforma busca dispersa em decisão com contexto.',
    cards: [
      {
        title: 'Primeiro: objetivo de compra',
        text: 'Morar, investir, segunda residência, renda ou preservação patrimonial pedem imóveis diferentes. Sem objetivo claro, a busca vira volume.',
        href: '/consultoria-imobiliaria-personalizada',
        label: 'Definir estratégia',
      },
      {
        title: 'Segundo: cidade e microendereço',
        text: 'Balneário Camboriú, Praia Brava, Itapema e Porto Belo podem ser bons, mas por motivos diferentes. A cidade certa depende do uso real.',
        href: '/guias/imoveis-luxo-litoral-catarinense',
        label: 'Comparar regiões',
      },
      {
        title: 'Terceiro: preço e liquidez',
        text: 'Preço pedido não é sinônimo de preço justo. É preciso comparar imóveis equivalentes, motivação de venda, estoque e liquidez.',
        href: '/busca',
        label: 'Ver mercado',
      },
    ],
    comparisonKicker: 'Processo de compra',
    comparisonTitle: 'Etapas para comprar com menos ruído.',
    comparisons: [
      {
        title: 'Diagnóstico',
        text: 'Defina objetivo, prazo, faixa de investimento, cidade preferida, uso do imóvel e critérios eliminatórios.',
        highlight: 'A busca fica objetiva.',
        href: '/consultoria-imobiliaria-personalizada',
      },
      {
        title: 'Curadoria',
        text: 'Filtre imóveis por aderência real, não por volume de anúncios. Compare pontos fortes, riscos e alternativas.',
        highlight: 'Menos visitas, mais precisão.',
        href: '/busca',
      },
      {
        title: 'Visita qualificada',
        text: 'Vá ao imóvel com perguntas prontas sobre vista, condomínio, manutenção, vizinhança, documentação e negociação.',
        highlight: 'A visita vira validação.',
        href: '/contato',
      },
      {
        title: 'Negociação',
        text: 'Negocie com base em comparáveis, liquidez, prazo, forma de pagamento e contexto do vendedor.',
        highlight: 'Contexto protege o comprador.',
        href: '/consultoria-imobiliaria-personalizada',
      },
    ],
    checklistTitle: 'Checklist do comprador no litoral catarinense.',
    checklistIntro: 'Antes de avançar, confira se o imóvel responde aos critérios técnicos e ao seu uso real.',
    checklist: [
      'Definir objetivo principal e objetivo secundário da compra.',
      'Escolher regiões compatíveis com rotina, liquidez e orçamento.',
      'Comparar imóveis equivalentes antes de negociar.',
      'Verificar documentação, matrícula, condomínio e condição do imóvel.',
      'Avaliar potencial de revenda e público comprador futuro.',
      'Usar curadoria para evitar excesso de visitas e decisões emocionais.',
    ],
    related: [
      { label: 'Guia do litoral catarinense', href: '/guias/imoveis-luxo-litoral-catarinense' },
      { label: 'Imóveis de luxo em Balneário Camboriú', href: '/guias/imoveis-de-luxo-balneario-camboriu' },
      { label: 'Imóveis de luxo na Praia Brava', href: '/guias/imoveis-de-luxo-praia-brava' },
      { label: 'Busca premium', href: '/busca' },
    ],
    faq: [
      {
        question: 'Qual o primeiro passo para comprar imóvel no litoral catarinense?',
        answer: 'Definir objetivo, faixa de investimento, cidade desejada, prazo e critérios eliminatórios. Isso evita uma busca ampla demais e melhora a qualidade das visitas.',
      },
      {
        question: 'Qual cidade escolher?',
        answer: 'Balneário Camboriú favorece liquidez e frente mar consolidado. Praia Brava entrega lifestyle. Itapema combina expansão e lançamentos. Porto Belo pode fazer sentido para condomínios, terrenos e crescimento planejado.',
      },
      {
        question: 'Como saber se estou pagando caro?',
        answer: 'Compare imóveis semelhantes por localização, vista, planta, padrão, vagas, estado de conservação, construtora e liquidez. O preço precisa ser lido dentro do contexto.',
      },
      {
        question: 'A curadoria substitui a busca online?',
        answer: 'Não. A busca online mostra o mercado; a curadoria interpreta o que faz sentido para o comprador, reduz opções ruins e organiza a decisão.',
      },
    ],
    about: ['comprar imóvel', 'litoral catarinense', 'curadoria imobiliária', 'alto padrão'],
  },
]

export const allGuideLinks: GuideLink[] = [
  ...existingGuideLinks,
  ...aiGuidePages.map(guide => ({ label: guide.shortTitle, href: guide.path })),
]

export function getAiGuidePage(slug: string) {
  return aiGuidePages.find(guide => guide.slug === slug) || null
}

export function guideLastModified() {
  return UPDATED_AT
}
