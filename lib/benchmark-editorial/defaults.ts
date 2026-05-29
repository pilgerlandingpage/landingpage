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

export const DEFAULT_BENCHMARK_COMPETITORS: BenchmarkCompetitor[] = []

export const DEFAULT_BENCHMARK_KEYWORDS: BenchmarkKeyword[] = [
    {
        id: 'keyword-balneario-luxo',
        term: 'imoveis de luxo em Balneario Camboriu',
        region: 'Balneario Camboriu, SC',
        intent: 'blog',
        priority: 'alta',
        status: 'active',
        created_at: '2026-05-27T00:00:00.000Z',
    },
    {
        id: 'keyword-praia-brava-frente-mar',
        term: 'apartamento frente mar Praia Brava',
        region: 'Praia Brava, Itajai, SC',
        intent: 'both',
        priority: 'alta',
        status: 'active',
        created_at: '2026-05-27T00:00:00.000Z',
    },
    {
        id: 'keyword-investimento-litoral-sc',
        term: 'investir em imoveis no litoral de Santa Catarina',
        region: 'Litoral de Santa Catarina',
        intent: 'blog',
        priority: 'alta',
        status: 'active',
        created_at: '2026-05-27T00:00:00.000Z',
    },
    {
        id: 'keyword-mercado-imobiliario-balneario',
        term: 'mercado imobiliario Balneario Camboriu',
        region: 'Balneario Camboriu, SC',
        intent: 'news',
        priority: 'media',
        status: 'active',
        created_at: '2026-05-27T00:00:00.000Z',
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

    const outline = opportunity.outline
        .slice(0, 8)
        .map(item => `- ${item}`)
        .join('\n')

    return [
        `# Briefing Benchmark Editorial: ${opportunity.title}`,
        '',
        '## Resumo da oportunidade',
        opportunity.summary || 'Resumo ainda nao disponivel.',
        '',
        '## Angulo recomendado',
        opportunity.recommended_angle || 'Criar uma pauta original com leitura local Pilger, sem copiar estruturas de terceiros.',
        '',
        '## Estrategia editorial',
        opportunity.strategy_notes || 'Usar SEO, AEO e GEO, com fontes externas no corpo do texto e links internos para estoque, bairros e conteudos relacionados.',
        '',
        outline ? '## Estrutura sugerida' : '',
        outline,
        '',
        sources ? '## Fontes publicas para apuracao' : '',
        sources,
        '',
        '## Regras de uso',
        '- Nao copiar texto, titulo, imagens ou estrutura proprietaria de terceiros.',
        '- Transformar o achado em conteudo original da Imobiliaria Guilherme Pilger.',
        '- Citar fontes externas quando usar fatos publicos.',
        '- Inserir links internos com ancoras descritivas para imoveis, regioes, blog ou noticias relacionadas.',
    ].filter(Boolean).join('\n')
}
