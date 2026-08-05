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
    originalPriceInCents: 9700,
    originalPriceDisplay: 'R$ 97,00',
    discountPercent: 30,
    discountLabel: 'Seu desconto de 30%',
    discountDescription: 'De R$ 97,00 por R$ 67,90',
    priceInCents: 6790,
    priceDisplay: 'R$ 67,90',
    shortPriceDisplay: 'R$ 67,90',
    primaryCtaLabel: 'QUERO ACESSAR POR R$ 67,90',
    mobileCtaLabel: 'QUERO ACESSAR',
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
    badge: 'Seu desconto de 30% está ativo',
    subtitle: 'Livro de campo para avaliar 25 competências e transformar prioridades em plano de execução.',
    description:
        'O Corretor Nota 8 é um livro digital de campo que combina trajetória, método, diagnóstico de 25 competências e um plano de execução de 30 dias para corretores do mercado imobiliário de alto padrão.',
    coverImage: '/images/products/corretor-nota-8-cover.webp',
    trustItems: [
        '25 competências',
        '5 dimensões',
        'Plano de 30 dias',
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
            description:
                'Metas claras, autorresponsabilidade e controle financeiro para saber aonde você quer chegar e medir o que está construindo.',
        },
        {
            title: 'Execução',
            description:
                'Foco em vendas, proatividade, disciplina, rotina, captação e velocidade contra a procrastinação.',
        },
        {
            title: 'Autoridade',
            description:
                'Posicionamento, imagem, comunicação, conhecimento de mercado, produção de conteúdo e inovação.',
        },
        {
            title: 'Relacionamento e conversão',
            description:
                'Escuta ativa, leitura de pessoas, atendimento estratégico, negociação e fechamento.',
        },
        {
            title: 'Caráter, energia e longevidade',
            description:
                'Presença, resiliência, controle emocional, segurança, ética e consistência no relacionamento com clientes e equipe.',
        },
    ] satisfies ProductTextItem[],
    included: [
        {
            title: 'Livro digital Corretor Nota 8',
            description:
                'Uma trajetória real transformada em princípios sobre posicionamento, presença, conteúdo, conhecimento, rotina, atendimento e mercado imobiliário de alto padrão.',
        },
        {
            title: 'Diagnóstico com 25 competências',
            description:
                'Uma avaliação de zero a dez com espaço para registrar evidências, identificar pontos fracos e definir a próxima ação.',
        },
        {
            title: 'Plano de execução de 30 dias',
            description:
                'Uma estrutura para escolher três prioridades, definir comportamentos, frequência, indicadores e acompanhar a evolução.',
        },
        {
            title: 'Leitor digital protegido na área de membros',
            description:
                'Continue de onde parou e mantenha suas respostas do diagnóstico e do plano salvas no dispositivo.',
        },
    ] satisfies ProductTextItem[],
    authorBio:
        'Guilherme Pilger é corretor de imóveis, empreendedor e produtor de conteúdo especializado no mercado imobiliário de alto padrão. Seu trabalho combina vendas, posicionamento, produção de conteúdo, presença de marca, educação de mercado e construção de experiências para compradores e investidores.',
    authorQuote: 'Nota 8 não é perfeição. É consistência.',
    testimonials: [] as ProductTestimonial[],
    stats: [] as ProductStat[],
    faq: [
        {
            title: 'O que é o Corretor Nota 8?',
            description:
                'É um livro digital de campo que combina trajetória, princípios comerciais, diagnóstico de competências e um plano de execução de 30 dias.',
        },
        {
            title: 'Como funciona o Diagnóstico Nota 8?',
            description:
                'Você avalia 25 competências de zero a dez, registra evidências, identifica os pontos abaixo de 8 e escolhe até três prioridades.',
        },
        {
            title: 'O produto é físico ou digital?',
            description: 'O Corretor Nota 8 é um produto digital. Nenhum livro físico será enviado.',
        },
        {
            title: 'O livro garante aumento de vendas?',
            description:
                'Não. O conteúdo oferece critérios, reflexões e ações para organizar a atuação profissional. Os resultados dependem da aplicação, da experiência e da realidade de cada corretor.',
        },
        {
            title: 'Como receberei o acesso?',
            description:
                'O acesso será enviado após a confirmação do pagamento, conforme o processo utilizado pela plataforma.',
        },
        {
            title: 'O desconto já está aplicado?',
            description:
                'Sim. O valor original de R$ 97,00 está reduzido para R$ 67,90 nesta condição especial.',
        },
    ] satisfies ProductTextItem[],
}
