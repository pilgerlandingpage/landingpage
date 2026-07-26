export type ProductTextItem = {
    title: string
    description: string
}

export type ProductTestimonial = {
    quote: string
    name: string
    role: string
}

export type ProductStat = {
    value: string
    label: string
}

export const CORRETOR_NOTA_8_CHECKOUT_URL = '/checkout/corretor-nota-8'
export const CORRETOR_NOTA_8_PROFILE_ASSESSMENT_CHECKOUT_URL = '/checkout/corretor-nota-8-perfil-corretor-ideal'
export const CORRETOR_NOTA_8_PROFILE_ASSESSMENT_LANDING_URL = '/corretor-nota-8?oferta=perfil-corretor-ideal'

export const corretorNota8Offer = {
    productName: 'Corretor Nota 8',
    author: 'Guilherme Pilger',
    format: 'Livro digital',
    priceInCents: 9700,
    priceDisplay: 'R$ 97,00',
    shortPriceDisplay: 'R$ 97',
    primaryCtaLabel: 'Quero garantir meu exemplar',
    mobileCtaLabel: 'Comprar agora',
    checkoutUrl: CORRETOR_NOTA_8_CHECKOUT_URL,
}

export const corretorNota8ProfileAssessmentOffer = {
    priceInCents: 4850,
    priceDisplay: 'R$ 48,50',
    checkoutUrl: CORRETOR_NOTA_8_PROFILE_ASSESSMENT_CHECKOUT_URL,
    landingUrl: CORRETOR_NOTA_8_PROFILE_ASSESSMENT_LANDING_URL,
    source: 'perfil-corretor-ideal',
}

export const corretorNota8Content = {
    badge: 'Livro digital',
    subtitle: 'Posicionamento, método e disciplina para corretores que querem atuar melhor no alto padrão',
    description:
        'Um livro de campo para o corretor que quer sair do improviso, organizar sua rotina comercial e construir uma presença mais clara diante de clientes exigentes.',
    coverImage: '/images/products/corretor-nota-8-cover.webp',
    trustItems: [
        'Formato digital',
        'Criado para o mercado imobiliário',
        'Foco em posicionamento e método',
    ],
    problems: [
        {
            title: 'Você sabe vender, mas ainda depende demais do improviso',
            description:
                'A falta de método faz cada atendimento parecer uma corrida isolada. O livro ajuda a organizar critério, postura e sequência para trabalhar com mais clareza.',
        },
        {
            title: 'O cliente de alto padrão compara mais do que preço',
            description:
                'Ele avalia repertório, segurança, autoridade e leitura de contexto. O Corretor Nota 8 posiciona essas frentes como parte da venda.',
        },
        {
            title: 'Disciplina comercial precisa sobreviver aos dias comuns',
            description:
                'Performance consistente nasce de agenda, presença, follow-up e relacionamento, mesmo quando não existe urgência aparente.',
        },
    ] satisfies ProductTextItem[],
    benefits: [
        {
            title: 'Clareza de posicionamento',
            description:
                'Entenda como ser lembrado por uma especialidade, uma região ou um tipo de cliente, sem parecer apenas mais uma opção no mercado.',
        },
        {
            title: 'Método para conduzir conversas',
            description:
                'Organize abordagem, diagnóstico, critério de recomendação e próximos passos para transformar conhecimento em processo comercial.',
        },
        {
            title: 'Disciplina para evoluir com consistência',
            description:
                'Use o conceito de Nota 8 para identificar pontos fracos e manter uma rotina de melhoria sem depender de motivação ocasional.',
        },
    ] satisfies ProductTextItem[],
    dimensions: [
        {
            title: 'Direção',
            description: 'Escolha de mercado, clareza de jogo e foco no tipo de corretor que você quer se tornar.',
        },
        {
            title: 'Execução',
            description: 'Rotina, processos simples e capacidade de fazer o trabalho importante acontecer.',
        },
        {
            title: 'Autoridade',
            description: 'Repertório, comunicação e sinais que fazem o cliente confiar antes da proposta.',
        },
        {
            title: 'Relacionamento',
            description: 'Leitura de pessoas, networking e continuidade depois do primeiro contato.',
        },
        {
            title: 'Longevidade',
            description: 'Reputação, energia e disciplina para permanecer relevante no mercado.',
        },
    ] satisfies ProductTextItem[],
    included: [
        {
            title: 'Livro digital Corretor Nota 8',
            description:
                'Conteúdo estruturado para profissionais do mercado imobiliário que querem atuar com mais método no alto padrão.',
        },
        {
            title: 'Raciocínio de autoavaliação',
            description:
                'Um jeito prático de observar onde sua rotina comercial está abaixo do potencial e o que precisa ser ajustado.',
        },
        {
            title: 'Princípios de posicionamento e relacionamento',
            description:
                'Ideias para fortalecer autoridade, postura consultiva e constância nas relações comerciais.',
        },
    ] satisfies ProductTextItem[],
    authorBio:
        'Guilherme Pilger atua no mercado imobiliário de alto padrão e organiza neste livro princípios de posicionamento, método comercial, relacionamento e disciplina para corretores que querem evoluir com mais critério.',
    authorQuote: 'O corretor que organiza método, postura e disciplina passa a vender com mais clareza.',
    testimonials: [] as ProductTestimonial[],
    stats: [] as ProductStat[],
    faq: [
        {
            title: 'Para quem é o Corretor Nota 8?',
            description:
                'Para corretores, gestores e profissionais do mercado imobiliário que querem atuar com mais posicionamento, método, autoridade, relacionamento e disciplina.',
        },
        {
            title: 'O produto é físico ou digital?',
            description: 'O formato confirmado para esta oferta é livro digital.',
        },
        {
            title: 'Quanto custa?',
            description: 'O preço oficial confirmado é R$ 97,00.',
        },
        {
            title: 'O livro promete resultado financeiro?',
            description:
                'Não. A proposta é organizar critérios, postura e rotina comercial. Resultado depende da execução, do mercado e da realidade de cada profissional.',
        },
        {
            title: 'O conteúdo serve para quem está começando?',
            description:
                'Sim, desde que a pessoa queira construir base profissional. Também faz sentido para corretores experientes que precisam refinar método e posicionamento.',
        },
    ] satisfies ProductTextItem[],
}
