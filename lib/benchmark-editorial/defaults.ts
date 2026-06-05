export type BenchmarkIntent = 'blog' | 'news' | 'both'
export type BenchmarkStatus = 'active' | 'paused'
export type BenchmarkOpportunityStatus = 'new' | 'briefed' | 'sent_to_blog' | 'sent_to_news' | 'archived'

export type BenchmarkCompetitor = {
    id: string
    name: string
    site_url: string
    focus: string
    status: BenchmarkStatus
    priority: number
    notes?: string
    created_at: string
}

export type BenchmarkKeyword = {
    id: string
    term: string
    region: string
    intent: BenchmarkIntent
    priority: 'alta' | 'media' | 'baixa'
    status: BenchmarkStatus
    created_at: string
}

export type BenchmarkOpportunity = {
    id: string
    title: string
    keyword: string
    intent: BenchmarkIntent
    target_agent: BenchmarkIntent
    source_url?: string
    source_domain?: string
    competitor_name?: string
    opportunity_score: number
    format: string
    summary: string
    strategy_notes: string
    recommended_angle: string
    sources: Array<{ title: string; uri: string }>
    queries: string[]
    outline: string[]
    status: BenchmarkOpportunityStatus
    created_at: string
    updated_at?: string
}

export type BenchmarkRun = {
    id: string
    topic: string
    intent: BenchmarkIntent
    depth: 'leve' | 'media' | 'profunda'
    status: 'completed' | 'failed'
    executive_summary: string
    report_id?: string
    error?: string
    created_at: string
}

export const BENCHMARK_CONFIG_KEYS = {
    competitors: 'benchmark_editorial_competitors',
    keywords: 'benchmark_editorial_keywords',
    opportunities: 'benchmark_editorial_opportunities',
    runs: 'benchmark_editorial_runs',
}

export const DEFAULT_BENCHMARK_COMPETITORS: BenchmarkCompetitor[] = [
    {
        id: 'competitor-zap-imoveis',
        name: 'ZAP Imoveis',
        site_url: 'https://www.zapimoveis.com.br/',
        focus: 'Portal nacional com paginas transacionais por cidade, bairro, tipo e preco.',
        status: 'active',
        priority: 100,
        notes: 'Monitorar padroes publicos de SEO programatico, filtros, titulos e snippets. Nao copiar.',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'competitor-imovelweb',
        name: 'Imovelweb',
        site_url: 'https://www.imovelweb.com.br/',
        focus: 'Portal nacional com forte cobertura de busca local e paginas de listagem.',
        status: 'active',
        priority: 96,
        notes: 'Observar estrutura de categorias, perguntas respondidas e combinacoes cidade/tipologia.',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'competitor-olx-imoveis',
        name: 'OLX Imoveis',
        site_url: 'https://www.olx.com.br/imoveis',
        focus: 'Classificados nacionais com autoridade de dominio e forte intencao transacional.',
        status: 'active',
        priority: 92,
        notes: 'Observar padroes de cauda longa, paginas locais e filtros de alta intencao.',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'competitor-luxuryestate-brasil',
        name: 'LuxuryEstate Brasil',
        site_url: 'https://www.luxuryestate.com/pt/brazil',
        focus: 'Marketplace internacional de imoveis de luxo com leitura premium e entidades globais.',
        status: 'active',
        priority: 90,
        notes: 'Monitorar linguagem de luxo, atributos de destaque, internacionalizacao e estrutura de fichas.',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'competitor-jamesedition-brazil',
        name: 'JamesEdition Brazil',
        site_url: 'https://www.jamesedition.com/real_estate/brazil',
        focus: 'Portal global de luxo com catalogo e taxonomia internacional.',
        status: 'active',
        priority: 88,
        notes: 'Observar termos de alto padrao, comparativos internacionais e entidades usadas por IA.',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'competitor-date-a-home',
        name: 'Date a Home',
        site_url: 'https://www.dateahome.com/pt-PT',
        focus: 'Portal de luxo e alto padrao com curadoria editorial e imoveis selecionados.',
        status: 'active',
        priority: 84,
        notes: 'Monitorar curadoria, categorias de luxo, chamadas e perguntas comerciais.',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'competitor-casa-luxuosa',
        name: 'Casa Luxuosa',
        site_url: 'https://casaluxuosa.com.br/',
        focus: 'Portal brasileiro de imoveis de luxo e propriedades especiais.',
        status: 'active',
        priority: 82,
        notes: 'Observar editoriais, taxonomia premium e posicionamento de autoridade em luxo.',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'competitor-myside-balneario',
        name: 'MySide Balneario Camboriu',
        site_url: 'https://myside.com.br/guia-balneario-camboriu/apartamentos-de-luxo-balneario-camboriu-sc',
        focus: 'Guia local com formato explicativo para AEO/GEO sobre apartamentos de luxo em Balneario Camboriu.',
        status: 'active',
        priority: 80,
        notes: 'Monitorar estrutura de guias, respostas diretas, entidades locais e perguntas relacionadas.',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'competitor-guilherme-imoveis',
        name: 'Guilherme Ramalho Imoveis',
        site_url: 'https://guilhermeimoveis.com.br/',
        focus: 'Player local de Balneario Camboriu com paginas de estoque e tipologias de alto padrao.',
        status: 'active',
        priority: 78,
        notes: 'Observar como trabalha bairros, empreendimentos, filtros e copy local.',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'competitor-cfl-imoveis',
        name: 'CFL Imoveis',
        site_url: 'https://cflimoveis.com.br/',
        focus: 'Imobiliaria de Florianopolis e Jurere com autoridade local em alto padrao.',
        status: 'active',
        priority: 76,
        notes: 'Monitorar paginas locais, artigos e conteudos de bairro em Florianopolis.',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'competitor-cassaro-imoveis',
        name: 'Cassaro Imoveis',
        site_url: 'https://www.imobiliariacassaro.com.br/',
        focus: 'Player local de Florianopolis com clusters editoriais e listagens.',
        status: 'active',
        priority: 74,
        notes: 'Observar conteudos de bairros, guias e relacao blog/estoque.',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'competitor-luxes-props',
        name: 'Luxes Props',
        site_url: 'https://www.luxesprops.com/',
        focus: 'Imoveis de luxo em Florianopolis e Santa Catarina.',
        status: 'active',
        priority: 72,
        notes: 'Monitorar linguagem premium, filtros e posicionamento de luxo local.',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'competitor-qualite-imoveis',
        name: 'Qualite Imoveis',
        site_url: 'https://imobiliariaqualite.com.br/',
        focus: 'Imobiliaria catarinense de imoveis exclusivos e alto padrao.',
        status: 'active',
        priority: 70,
        notes: 'Observar termos de exclusividade, segmentacao e paginas de alto valor.',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'competitor-maritima-imoveis',
        name: 'Maritima Imoveis',
        site_url: 'https://imobiliariamaritima.com.br/',
        focus: 'Player de Itapema e litoral catarinense com estoque e paginas locais.',
        status: 'active',
        priority: 68,
        notes: 'Monitorar termos de Itapema, Meia Praia, frente mar e investimento.',
        created_at: '2026-06-05T00:00:00.000Z',
    },
]

export const DEFAULT_BENCHMARK_KEYWORDS: BenchmarkKeyword[] = [
    {
        id: 'keyword-balneario-luxo',
        term: 'imoveis de luxo em Balneario Camboriu',
        region: 'Balneario Camboriu, SC',
        intent: 'both',
        priority: 'alta',
        status: 'active',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'keyword-apartamentos-luxo-balneario',
        term: 'apartamentos de luxo em Balneario Camboriu',
        region: 'Balneario Camboriu, SC',
        intent: 'blog',
        priority: 'alta',
        status: 'active',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'keyword-cobertura-frente-mar-balneario',
        term: 'cobertura frente mar Balneario Camboriu',
        region: 'Balneario Camboriu, SC',
        intent: 'both',
        priority: 'alta',
        status: 'active',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'keyword-praia-brava-frente-mar',
        term: 'apartamento frente mar Praia Brava',
        region: 'Praia Brava, Itajai, SC',
        intent: 'both',
        priority: 'alta',
        status: 'active',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'keyword-praia-brava-luxo',
        term: 'imoveis de luxo Praia Brava Itajai',
        region: 'Praia Brava, Itajai, SC',
        intent: 'both',
        priority: 'alta',
        status: 'active',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'keyword-itapema-luxo',
        term: 'imoveis de luxo Itapema',
        region: 'Itapema, SC',
        intent: 'both',
        priority: 'alta',
        status: 'active',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'keyword-cobertura-itapema',
        term: 'cobertura de luxo Itapema',
        region: 'Itapema, SC',
        intent: 'blog',
        priority: 'alta',
        status: 'active',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'keyword-florianopolis-luxo',
        term: 'imoveis de luxo Florianopolis',
        region: 'Florianopolis, SC',
        intent: 'both',
        priority: 'media',
        status: 'active',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'keyword-jurere-casas-luxo',
        term: 'casas de luxo Jurere Internacional',
        region: 'Jurere Internacional, Florianopolis, SC',
        intent: 'blog',
        priority: 'media',
        status: 'active',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'keyword-frente-mar-sc',
        term: 'imoveis frente mar Santa Catarina',
        region: 'Santa Catarina',
        intent: 'blog',
        priority: 'alta',
        status: 'active',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'keyword-melhores-apartamentos-balneario',
        term: 'melhores apartamentos de luxo em Balneario Camboriu',
        region: 'Balneario Camboriu, SC',
        intent: 'blog',
        priority: 'alta',
        status: 'active',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'keyword-bairros-valorizados-sc',
        term: 'bairros mais valorizados do litoral de Santa Catarina',
        region: 'Litoral de Santa Catarina',
        intent: 'blog',
        priority: 'alta',
        status: 'active',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'keyword-investimento-litoral-sc',
        term: 'investir em imoveis no litoral de Santa Catarina',
        region: 'Litoral de Santa Catarina',
        intent: 'blog',
        priority: 'alta',
        status: 'active',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'keyword-comprar-luxo-sc',
        term: 'onde comprar imovel de luxo em Santa Catarina',
        region: 'Santa Catarina',
        intent: 'blog',
        priority: 'alta',
        status: 'active',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'keyword-mercado-imobiliario-balneario',
        term: 'mercado imobiliario Balneario Camboriu',
        region: 'Balneario Camboriu, SC',
        intent: 'news',
        priority: 'media',
        status: 'active',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'keyword-mercado-praia-brava',
        term: 'mercado imobiliario Praia Brava',
        region: 'Praia Brava, Itajai, SC',
        intent: 'news',
        priority: 'media',
        status: 'active',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'keyword-senna-tower-investimento',
        term: 'Senna Tower Balneario Camboriu investimento',
        region: 'Balneario Camboriu, SC',
        intent: 'both',
        priority: 'media',
        status: 'active',
        created_at: '2026-06-05T00:00:00.000Z',
    },
    {
        id: 'keyword-yachthouse-balneario',
        term: 'Yachthouse Balneario Camboriu apartamento',
        region: 'Balneario Camboriu, SC',
        intent: 'both',
        priority: 'media',
        status: 'active',
        created_at: '2026-06-05T00:00:00.000Z',
    },
]

export function parseBenchmarkArray<T>(value: string | null | undefined, fallback: T[]): T[] {
    try {
        const parsed = JSON.parse(String(value || '[]'))
        return Array.isArray(parsed) ? parsed as T[] : fallback
    } catch {
        return fallback
    }
}

export function mergeBenchmarkDefaults<T extends { id: string }>(configured: T[], defaults: T[]) {
    const byId = new Map<string, T>()
    for (const item of defaults) byId.set(item.id, item)
    for (const item of configured) {
        if (!item?.id) continue
        const base = byId.get(item.id) || ({} as T)
        byId.set(item.id, { ...base, ...item })
    }
    return Array.from(byId.values())
}

export function normalizeBenchmarkIntent(value: unknown): BenchmarkIntent {
    const selected = String(value || '').trim()
    return selected === 'blog' || selected === 'news' || selected === 'both' ? selected : 'both'
}

export function normalizeBenchmarkStatus(value: unknown): BenchmarkStatus {
    return String(value || '').trim() === 'paused' ? 'paused' : 'active'
}

export function normalizeOpportunityStatus(value: unknown): BenchmarkOpportunityStatus {
    const selected = String(value || '').trim()
    if (selected === 'briefed' || selected === 'sent_to_blog' || selected === 'sent_to_news' || selected === 'archived') return selected
    return 'new'
}

export function getDomainFromUrl(url: string) {
    try {
        return new URL(url).hostname.replace(/^www\./, '')
    } catch {
        return ''
    }
}

export function buildBenchmarkMarkdownSummary(opportunity: BenchmarkOpportunity) {
    const sources = opportunity.sources
        .slice(0, 10)
        .map(source => `- [${source.title || getDomainFromUrl(source.uri)}](${source.uri})`)
        .join('\n')

    const queries = opportunity.queries
        .slice(0, 10)
        .map(query => `- ${query}`)
        .join('\n')

    const outline = opportunity.outline
        .slice(0, 8)
        .map(item => `- ${item}`)
        .join('\n')

    const targetAgents = [
        opportunity.target_agent === 'blog' || opportunity.target_agent === 'both' ? 'Isadora Edicao Blog' : '',
        opportunity.target_agent === 'news' || opportunity.target_agent === 'both' ? 'Clara Edicao Noticias' : '',
    ].filter(Boolean).join(' e ') || 'Isadora Edicao Blog e Clara Edicao Noticias'

    return [
        `# Inteligencia Lara Benchmark: ${opportunity.title}`,
        '',
        '## Destino do material',
        `Este material foi preparado pela Lara para ${targetAgents}. Ele deve ser usado como inteligencia competitiva, nao como texto final publicavel.`,
        '',
        '## O que a Lara encontrou',
        opportunity.summary || 'Resumo ainda nao disponivel.',
        '',
        '## Mapa de busca SEO/AEO/GEO',
        queries || `- ${opportunity.keyword}`,
        '',
        '## Fontes ranqueadas ou citadas em IA',
        sources || '- Nenhuma fonte publica retornada nesta execucao. Rodar nova pesquisa profunda antes de publicar.',
        '',
        '## Por que isso pode estar ranqueando',
        [
            '- Autoridade de dominio, pagina de categoria ou guia local com intencao clara.',
            '- Resposta direta para perguntas de compradores, investidores e proprietarios.',
            '- Entidades locais bem conectadas: cidade, bairro, praia, empreendimento, tipologia e faixa de valor.',
            '- Estrutura facil para mecanismos de resposta: titulos claros, FAQs, listas, dados verificaveis e links.',
        ].join('\n'),
        '',
        '## Oportunidade para a Pilger',
        opportunity.recommended_angle || 'Criar uma pauta original com leitura local Pilger, sem copiar estruturas de terceiros.',
        '',
        '## Estrategia editorial',
        opportunity.strategy_notes || 'Usar SEO, AEO e GEO, com fontes externas no corpo do texto e links internos para estoque, bairros e conteudos relacionados.',
        '',
        '## Material para Isadora Edicao Blog',
        [
            `- Transformar o achado em artigo evergreen para a palavra-chave: ${opportunity.keyword}.`,
            '- Comecar com resposta direta, depois aprofundar criterio de compra, liquidez, localizacao, estilo de vida e comparativos.',
            '- Incluir FAQ com perguntas conversacionais que o comprador faria para IA ou Google.',
            '- Conectar o conteudo a estoque real, paginas de busca, bairros, empreendimentos e outros artigos.',
        ].join('\n'),
        '',
        '## Material para Clara Edicao Noticias',
        [
            '- Usar somente se houver fato publico atual, dado verificavel, obra, mercado, cidade, turismo, evento ou economia.',
            '- Separar fato, contexto e impacto imobiliario sem promessa de valorizacao.',
            '- Citar a fonte perto da afirmacao e manter tom jornalistico premium.',
            '- Se o achado for apenas educativo, Clara deve observar e deixar a pauta para Isadora.',
        ].join('\n'),
        '',
        outline ? '## Estrutura sugerida' : '',
        outline,
        '',
        '## Registro para Central de Inteligencia',
        [
            `- Palavra-chave monitorada: ${opportunity.keyword}`,
            `- Formato recomendado: ${opportunity.format}`,
            `- Score de oportunidade: ${opportunity.opportunity_score}`,
            `- Fonte principal: ${opportunity.source_domain || opportunity.source_url || 'nao definida'}`,
            `- Concorrente/portal associado: ${opportunity.competitor_name || 'nao identificado'}`,
        ].join('\n'),
        '',
        '## Regras de uso',
        '- Nao copiar texto, titulo, imagens ou estrutura proprietaria de terceiros.',
        '- Transformar o achado em conteudo original da Imobiliaria Guilherme Pilger.',
        '- Citar fontes externas quando usar fatos publicos.',
        '- Inserir links internos com ancoras descritivas para imoveis, regioes, blog ou noticias relacionadas.',
    ].filter(Boolean).join('\n')
}
