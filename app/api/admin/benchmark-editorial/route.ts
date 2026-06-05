import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { BENCHMARK_EDITORIAL_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import { createResearchReport } from '@/lib/research/pilger'
import { buildAgentContextBrief, getAgentEcosystemContext, recordEcosystemEvent, saveEcosystemSnapshot } from '@/lib/intelligence/ecosystem'
import { runBlogAgentDraft } from '@/lib/blog/runner'
import { runNewsAgentDraft } from '@/lib/news/runner'
import {
    BENCHMARK_CONFIG_KEYS,
    DEFAULT_BENCHMARK_COMPETITORS,
    DEFAULT_BENCHMARK_KEYWORDS,
    BenchmarkCompetitor,
    BenchmarkKeyword,
    BenchmarkOpportunity,
    BenchmarkRun,
    BenchmarkIntent,
    getDomainFromUrl,
    mergeBenchmarkDefaults,
    normalizeBenchmarkIntent,
    normalizeBenchmarkStatus,
    parseBenchmarkArray,
} from '@/lib/benchmark-editorial/defaults'

type BenchmarkState = {
    competitors: BenchmarkCompetitor[]
    keywords: BenchmarkKeyword[]
    opportunities: BenchmarkOpportunity[]
    runs: BenchmarkRun[]
}

const ALL_KEYS = Object.values(BENCHMARK_CONFIG_KEYS)
const BENCHMARK_PROMPT_MARKER = 'vigiar a internet publica'

function nowIso() {
    return new Date().toISOString()
}

function clampScore(value: unknown, fallback = 70) {
    const parsed = Number.parseInt(String(value || ''), 10)
    if (!Number.isFinite(parsed)) return fallback
    return Math.min(100, Math.max(0, parsed))
}

function cleanText(value: unknown, limit = 500) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit)
}

function extractTitle(markdown: string, fallback: string) {
    const heading = String(markdown || '')
        .split(/\r?\n/)
        .map(line => line.replace(/^#{1,6}\s*/, '').replace(/\*\*/g, '').trim())
        .find(line => line.length >= 18 && line.length <= 120)
    return heading || fallback
}

function extractOutline(markdown: string) {
    return String(markdown || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => /^#{2,4}\s+/.test(line) || /^[-*]\s+/.test(line))
        .map(line => line.replace(/^#{2,4}\s+/, '').replace(/^[-*]\s+/, '').replace(/\*\*/g, '').trim())
        .filter(line => line.length >= 12 && line.length <= 180)
        .slice(0, 10)
}

function priorityWeight(priority: string) {
    if (priority === 'alta') return 3
    if (priority === 'media') return 2
    return 1
}

function findCompetitorForSources(competitors: BenchmarkCompetitor[], sources: Array<{ uri: string }>) {
    return competitors.find(competitor => {
        const competitorDomain = getDomainFromUrl(competitor.site_url)
        if (!competitorDomain) return false
        return sources.some(source => getDomainFromUrl(source.uri) === competitorDomain)
    })
}

async function readState(supabase: ReturnType<typeof createAdminClient>): Promise<BenchmarkState> {
    const { data, error } = await supabase
        .from('app_config')
        .select('key,value')
        .in('key', ALL_KEYS)

    if (error) throw error

    const rows = Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))

    const configuredCompetitors = parseBenchmarkArray<BenchmarkCompetitor>(rows[BENCHMARK_CONFIG_KEYS.competitors], [])
    const configuredKeywords = parseBenchmarkArray<BenchmarkKeyword>(rows[BENCHMARK_CONFIG_KEYS.keywords], [])

    return {
        competitors: mergeBenchmarkDefaults(configuredCompetitors, DEFAULT_BENCHMARK_COMPETITORS)
            .sort((a, b) => b.priority - a.priority),
        keywords: mergeBenchmarkDefaults(configuredKeywords, DEFAULT_BENCHMARK_KEYWORDS)
            .sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority)),
        opportunities: parseBenchmarkArray<BenchmarkOpportunity>(rows[BENCHMARK_CONFIG_KEYS.opportunities], []),
        runs: parseBenchmarkArray<BenchmarkRun>(rows[BENCHMARK_CONFIG_KEYS.runs], []),
    }
}

async function saveState(supabase: ReturnType<typeof createAdminClient>, state: Partial<BenchmarkState>) {
    const rows = Object.entries({
        [BENCHMARK_CONFIG_KEYS.competitors]: state.competitors,
        [BENCHMARK_CONFIG_KEYS.keywords]: state.keywords,
        [BENCHMARK_CONFIG_KEYS.opportunities]: state.opportunities,
        [BENCHMARK_CONFIG_KEYS.runs]: state.runs,
    })
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => ({
            key,
            value: JSON.stringify(value),
            updated_at: nowIso(),
        }))

    if (rows.length === 0) return

    const { error } = await supabase
        .from('app_config')
        .upsert(rows, { onConflict: 'key' })

    if (error) throw error
}

async function ensureBenchmarkRuntimeConfig(supabase: ReturnType<typeof createAdminClient>) {
    const keys = [
        'benchmark_editorial_system_prompt',
        'benchmark_editorial_weekdays',
        'benchmark_editorial_run_times',
        BENCHMARK_CONFIG_KEYS.competitors,
        BENCHMARK_CONFIG_KEYS.keywords,
    ]
    const { data, error } = await supabase
        .from('app_config')
        .select('key,value')
        .in('key', keys)

    if (error) throw error

    const rows = Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))
    const updates: Array<{ key: string; value: string; updated_at: string }> = []
    const updatedAt = nowIso()

    if (!rows.benchmark_editorial_system_prompt || !rows.benchmark_editorial_system_prompt.includes(BENCHMARK_PROMPT_MARKER)) {
        updates.push({
            key: 'benchmark_editorial_system_prompt',
            value: BENCHMARK_EDITORIAL_SYSTEM_PROMPT,
            updated_at: updatedAt,
        })
    }

    const configuredCompetitors = parseBenchmarkArray<BenchmarkCompetitor>(rows[BENCHMARK_CONFIG_KEYS.competitors], [])
    if (configuredCompetitors.length === 0) {
        updates.push({
            key: BENCHMARK_CONFIG_KEYS.competitors,
            value: JSON.stringify(DEFAULT_BENCHMARK_COMPETITORS),
            updated_at: updatedAt,
        })
    }

    const configuredKeywords = parseBenchmarkArray<BenchmarkKeyword>(rows[BENCHMARK_CONFIG_KEYS.keywords], [])
    if (configuredKeywords.length === 0) {
        updates.push({
            key: BENCHMARK_CONFIG_KEYS.keywords,
            value: JSON.stringify(DEFAULT_BENCHMARK_KEYWORDS),
            updated_at: updatedAt,
        })
    }

    if (!rows.benchmark_editorial_weekdays || rows.benchmark_editorial_weekdays === 'tue,thu') {
        updates.push({
            key: 'benchmark_editorial_weekdays',
            value: 'mon,tue,wed,thu,fri',
            updated_at: updatedAt,
        })
    }

    if (!rows.benchmark_editorial_run_times || rows.benchmark_editorial_run_times === '10,16') {
        updates.push({
            key: 'benchmark_editorial_run_times',
            value: '09,15',
            updated_at: updatedAt,
        })
    }

    if (updates.length === 0) return

    const { error: upsertError } = await supabase
        .from('app_config')
        .upsert(updates, { onConflict: 'key' })

    if (upsertError) throw upsertError
}

function normalizeCompetitor(input: any, existing?: BenchmarkCompetitor): BenchmarkCompetitor {
    const createdAt = existing?.created_at || nowIso()
    return {
        id: String(input?.id || existing?.id || randomUUID()),
        name: cleanText(input?.name || existing?.name, 120),
        site_url: cleanText(input?.site_url || existing?.site_url, 260),
        focus: cleanText(input?.focus || existing?.focus, 180),
        status: normalizeBenchmarkStatus(input?.status || existing?.status),
        priority: clampScore(input?.priority ?? existing?.priority, 50),
        notes: cleanText(input?.notes || existing?.notes, 400),
        created_at: createdAt,
    }
}

function normalizeKeyword(input: any, existing?: BenchmarkKeyword): BenchmarkKeyword {
    const priority = ['alta', 'media', 'baixa'].includes(String(input?.priority || existing?.priority))
        ? String(input?.priority || existing?.priority) as BenchmarkKeyword['priority']
        : 'media'

    return {
        id: String(input?.id || existing?.id || randomUUID()),
        term: cleanText(input?.term || existing?.term, 180),
        region: cleanText(input?.region || existing?.region, 120),
        intent: normalizeBenchmarkIntent(input?.intent || existing?.intent),
        priority,
        status: normalizeBenchmarkStatus(input?.status || existing?.status),
        created_at: existing?.created_at || nowIso(),
    }
}

function buildOpportunityFromReport(params: {
    topic: string
    intent: BenchmarkIntent
    report: any
    competitors: BenchmarkCompetitor[]
}): BenchmarkOpportunity {
    const markdown = String(params.report?.report_markdown || params.report?.executive_summary || '')
    const sources = Array.isArray(params.report?.sources) ? params.report.sources : []
    const queries = Array.isArray(params.report?.queries) ? params.report.queries.map(String) : []
    const matchedCompetitor = findCompetitorForSources(params.competitors, sources)
    const firstSource = sources[0]
    const title = extractTitle(markdown, `Oportunidade editorial: ${params.topic}`)
    const sourceCountScore = Math.min(20, sources.length * 3)
    const queryScore = Math.min(10, queries.length)
    const score = clampScore(62 + sourceCountScore + queryScore)

    return {
        id: randomUUID(),
        title,
        keyword: params.topic,
        intent: params.intent,
        target_agent: params.intent,
        source_url: firstSource?.uri || '',
        source_domain: firstSource?.uri ? getDomainFromUrl(firstSource.uri) : '',
        competitor_name: matchedCompetitor?.name || '',
        opportunity_score: score,
        format: params.intent === 'news' ? 'noticia curta verificavel' : params.intent === 'blog' ? 'artigo evergreen SEO/AEO/GEO' : 'pauta editorial para blog ou noticia',
        summary: cleanText(params.report?.executive_summary || markdown, 900),
        strategy_notes: 'Material de inteligencia para Clara e Isadora: usar o achado para criar conteudo original, com fontes no corpo do texto, links internos para estoque/regioes e respostas diretas para buscas conversacionais. Separar fato, inferencia e recomendacao antes de publicar.',
        recommended_angle: `Superar as fontes observadas para "${params.topic}" com uma pauta premium, util e local, conectando contexto publico com oportunidades reais da Imobiliaria Guilherme Pilger.`,
        sources: sources.slice(0, 12),
        queries: queries.slice(0, 12),
        outline: extractOutline(markdown),
        status: 'new',
        created_at: nowIso(),
        updated_at: nowIso(),
    }
}

function buildHandoffContext(opportunity: BenchmarkOpportunity, type: 'blog' | 'news') {
    const targetAgent = type === 'news' ? 'Clara Edicao Noticias' : 'Isadora Edicao Blog'
    const sourceDomains = opportunity.sources
        .map(source => getDomainFromUrl(source.uri))
        .filter(Boolean)

    return {
        source: 'lara_benchmark_editorial',
        target_agent: targetAgent,
        instruction: [
            'Use este material como inteligencia competitiva, nao como texto final.',
            'Crie conteudo original com titulo proprio, estrutura editorial completa e linguagem premium.',
            'Nao use "Benchmark Editorial", "Lara" ou "pauta a partir de benchmark" no titulo, resumo, SEO title ou primeiro paragrafo.',
            'Nao copie texto, titulo, imagens, estrutura ou listas de terceiros.',
            type === 'news'
                ? 'Gere noticia somente se houver fato publico verificavel; se o achado for educativo, trate como contexto e produza uma leitura jornalistica prudente.'
                : 'Gere artigo evergreen SEO/AEO/GEO com resposta direta, FAQ, links internos, estoque relacionado e leitura local.',
        ].join(' '),
        opportunity: {
            id: opportunity.id,
            title: opportunity.title,
            keyword: opportunity.keyword,
            intent: opportunity.intent,
            format: opportunity.format,
            score: opportunity.opportunity_score,
            summary: opportunity.summary,
            recommended_angle: opportunity.recommended_angle,
            strategy_notes: opportunity.strategy_notes,
            source_url: opportunity.source_url,
            source_domain: opportunity.source_domain,
            competitor_name: opportunity.competitor_name,
            sources: opportunity.sources,
            source_domains: sourceDomains,
            queries: opportunity.queries,
            outline: opportunity.outline,
            created_at: opportunity.created_at,
        },
        required_output: type === 'news'
            ? 'noticia final em revisao, escrita pela Clara, com fatos verificados e fontes no corpo'
            : 'artigo final em revisao, escrito pela Isadora, com SEO/AEO/GEO e links internos',
    }
}

function isDefaultCompetitor(id: string) {
    return DEFAULT_BENCHMARK_COMPETITORS.some(item => item.id === id)
}

function isDefaultKeyword(id: string) {
    return DEFAULT_BENCHMARK_KEYWORDS.some(item => item.id === id)
}

function handoffTargets(intent: BenchmarkIntent) {
    if (intent === 'blog') return ['isadora-blog']
    if (intent === 'news') return ['clara-news']
    return ['isadora-blog', 'clara-news']
}

export async function GET() {
    try {
        const supabase = createAdminClient()
        await ensureBenchmarkRuntimeConfig(supabase)
        const state = await readState(supabase)

        return NextResponse.json({
            ...state,
            health: {
                competitors: state.competitors.filter(item => item.status === 'active').length,
                keywords: state.keywords.filter(item => item.status === 'active').length,
                opportunities: state.opportunities.length,
                lastRun: state.runs[0]?.created_at || null,
            },
        })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || String(error) }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const action = String(body?.action || '')
        const supabase = createAdminClient()
        await ensureBenchmarkRuntimeConfig(supabase)
        const state = await readState(supabase)

        if (action === 'save_competitor') {
            const existing = state.competitors.find(item => item.id === body?.competitor?.id)
            const competitor = normalizeCompetitor(body?.competitor, existing)
            if (!competitor.name || !competitor.site_url) {
                return NextResponse.json({ error: 'Nome e URL do concorrente sao obrigatorios.' }, { status: 400 })
            }
            const competitors = existing
                ? state.competitors.map(item => item.id === competitor.id ? competitor : item)
                : [competitor, ...state.competitors]
            await saveState(supabase, { competitors })
            return NextResponse.json({ competitors })
        }

        if (action === 'delete_competitor') {
            const id = String(body?.id || '')
            const competitors = isDefaultCompetitor(id)
                ? state.competitors.map(item => item.id === id ? { ...item, status: 'paused' as const } : item)
                : state.competitors.filter(item => item.id !== id)
            await saveState(supabase, { competitors })
            return NextResponse.json({ competitors })
        }

        if (action === 'save_keyword') {
            const existing = state.keywords.find(item => item.id === body?.keyword?.id)
            const keyword = normalizeKeyword(body?.keyword, existing)
            if (!keyword.term) {
                return NextResponse.json({ error: 'Termo de pesquisa e obrigatorio.' }, { status: 400 })
            }
            const keywords = existing
                ? state.keywords.map(item => item.id === keyword.id ? keyword : item)
                : [keyword, ...state.keywords]
            await saveState(supabase, { keywords })
            return NextResponse.json({ keywords })
        }

        if (action === 'delete_keyword') {
            const id = String(body?.id || '')
            const keywords = isDefaultKeyword(id)
                ? state.keywords.map(item => item.id === id ? { ...item, status: 'paused' as const } : item)
                : state.keywords.filter(item => item.id !== id)
            await saveState(supabase, { keywords })
            return NextResponse.json({ keywords })
        }

        if (action === 'archive_opportunity') {
            const opportunities = state.opportunities.map(item =>
                item.id === String(body?.id || '') ? { ...item, status: 'archived' as const, updated_at: nowIso() } : item
            )
            await saveState(supabase, { opportunities })
            return NextResponse.json({ opportunities })
        }

        if (action === 'run_benchmark') {
            const selectedKeyword = state.keywords
                .filter(item => item.status === 'active')
                .sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority))[0]
            const topic = cleanText(body?.topic || selectedKeyword?.term, 220)
            const intent = normalizeBenchmarkIntent(body?.intent || selectedKeyword?.intent)
            const depth = ['leve', 'media', 'profunda'].includes(String(body?.depth)) ? String(body.depth) as 'leve' | 'media' | 'profunda' : 'media'

            if (!topic) {
                return NextResponse.json({ error: 'Informe um tema ou cadastre termos monitorados.' }, { status: 400 })
            }

            try {
                const ecosystemContext = await getAgentEcosystemContext({ supabase, agent: 'benchmark', days: 30, limit: 100 }).catch((error: any) => {
                    console.warn('[Benchmark Editorial] Ecosystem context unavailable:', error?.message || error)
                    return null
                })
                const ecosystemBrief = ecosystemContext ? buildAgentContextBrief(ecosystemContext) : ''
                const report = await createResearchReport({
                    topic: `Benchmark editorial competitivo: ${topic}`,
                    requester: 'benchmark-editorial',
                    depth,
                    promptKey: 'benchmark_editorial_system_prompt',
                    promptFallback: BENCHMARK_EDITORIAL_SYSTEM_PROMPT,
                    context: {
                        monitored_topic: topic,
                        intent,
                        ecosystem_brief: ecosystemBrief,
                        ecosystem_source_counts: ecosystemContext?.source_counts || null,
                        ecosystem_signals: ecosystemContext?.signals || null,
                        active_competitors: state.competitors.filter(item => item.status === 'active'),
                        active_keywords: state.keywords.filter(item => item.status === 'active').slice(0, 20),
                        instruction: [
                            'Pesquise somente fontes publicas, sem login, scraping proibido por termos ou dados privados.',
                            'Varra resultados organicos, paginas ranqueadas, portais de luxo, concorrentes locais e fontes que respostas de IA tenderiam a citar.',
                            'Mapeie consultas SEO, AEO e GEO: termos transacionais, perguntas conversacionais, comparativos, bairros, empreendimentos e cidades.',
                            'Para cada fonte importante, registre URL, dominio, tipo de pagina, sinais de autoridade, estrutura, perguntas respondidas, entidades locais e motivo provavel de ranqueamento.',
                            'Identifique lacunas para a Pilger: perguntas sem boa resposta, paginas fracas, dados desatualizados, ausencia de leitura local, falta de links internos ou falta de estoque conectado.',
                            'Nao copie concorrentes. Converta o achado em inteligencia original para a Central de Inteligencia.',
                            'Entregue material separado para Isadora Edicao Blog e Clara Edicao Noticias, dizendo quando o achado deve virar blog, noticia ou apenas observacao.',
                            'Liste fontes externas, queries usadas, ideias de links internos e riscos de validacao humana.',
                        ].join(' '),
                    },
                })

                const opportunity = buildOpportunityFromReport({ topic, intent, report, competitors: state.competitors })
                const opportunities = [opportunity, ...state.opportunities].slice(0, 100)
                const run: BenchmarkRun = {
                    id: randomUUID(),
                    topic,
                    intent,
                    depth,
                    status: 'completed',
                    executive_summary: opportunity.summary,
                    report_id: report.id,
                    created_at: nowIso(),
                }
                const runs = [run, ...state.runs].slice(0, 40)

                await saveState(supabase, { opportunities, runs })

                await recordEcosystemEvent({
                    supabase,
                    eventType: 'benchmark_editorial_opportunity_created',
                    actorType: 'agent',
                    entityType: 'benchmark_opportunity',
                    entityId: opportunity.id,
                    source: 'benchmark-editorial',
                    label: opportunity.title,
                    importanceScore: opportunity.opportunity_score || 70,
                    metadata: {
                        topic,
                        intent,
                        depth,
                        report_id: report.id,
                        intelligence_use: 'public_serp_ai_benchmark',
                        handoff_targets: handoffTargets(intent),
                        source_domains: opportunity.sources.map(source => getDomainFromUrl(source.uri)).filter(Boolean),
                        monitored_competitors: state.competitors
                            .filter(item => item.status === 'active')
                            .map(item => ({ name: item.name, site_url: item.site_url, focus: item.focus }))
                            .slice(0, 20),
                        monitored_keywords: state.keywords
                            .filter(item => item.status === 'active')
                            .map(item => ({ term: item.term, region: item.region, intent: item.intent }))
                            .slice(0, 20),
                        opportunity,
                    },
                }).catch((eventError: any) => {
                    console.warn('[Benchmark Editorial] ecosystem event failed:', eventError?.message || eventError)
                })

                if (ecosystemContext) {
                    await saveEcosystemSnapshot({
                        supabase,
                        agent: 'benchmark',
                        scope: 'global',
                        createdBy: 'benchmark-editorial',
                        context: {
                            ...ecosystemContext,
                            executive_summary: [
                                `Benchmark Editorial criou uma oportunidade: "${opportunity.title}".`,
                                ecosystemContext.executive_summary || '',
                            ].filter(Boolean).join(' '),
                            signals: {
                                ...(ecosystemContext.signals || {}),
                                latest_benchmark_opportunity: opportunity,
                                latest_benchmark_handoff: {
                                    topic,
                                    targets: handoffTargets(intent),
                                    for_isadora: intent === 'blog' || intent === 'both'
                                        ? 'Criar artigo evergreen SEO/AEO/GEO a partir do achado publico, conectando a estoque real e links internos.'
                                        : null,
                                    for_clara: intent === 'news' || intent === 'both'
                                        ? 'Criar noticia somente se houver fato publico atual e verificavel; caso contrario observar.'
                                        : null,
                                },
                            },
                        },
                    }).catch((snapshotError: any) => {
                        console.warn('[Benchmark Editorial] ecosystem snapshot failed:', snapshotError?.message || snapshotError)
                    })
                }

                return NextResponse.json({ opportunity, opportunities, runs, report })
            } catch (error: any) {
                const run: BenchmarkRun = {
                    id: randomUUID(),
                    topic,
                    intent,
                    depth,
                    status: 'failed',
                    executive_summary: '',
                    error: error?.message || String(error),
                    created_at: nowIso(),
                }
                const runs = [run, ...state.runs].slice(0, 40)
                await saveState(supabase, { runs })
                throw error
            }
        }

        if (action === 'send_to_blog' || action === 'send_to_news') {
            const type = action === 'send_to_news' ? 'news' : 'blog'
            const opportunity = state.opportunities.find(item => item.id === String(body?.id || ''))
            if (!opportunity) return NextResponse.json({ error: 'Oportunidade nao encontrada.' }, { status: 404 })

            const handoffContext = buildHandoffContext(opportunity, type)
            const result = type === 'news'
                ? await runNewsAgentDraft({
                    topic: opportunity.keyword,
                    origin: request.nextUrl.origin,
                    source: 'lara_benchmark_handoff',
                    contextAugmentation: handoffContext,
                })
                : await runBlogAgentDraft({
                    topic: opportunity.keyword,
                    origin: request.nextUrl.origin,
                    source: 'lara_benchmark_handoff',
                    contextAugmentation: handoffContext,
                })
            const post = result.post

            const status = type === 'news' ? 'sent_to_news' : 'sent_to_blog'
            const opportunities = state.opportunities.map(item =>
                item.id === opportunity.id ? { ...item, status: status as any, updated_at: nowIso() } : item
            )
            await saveState(supabase, { opportunities })

            await recordEcosystemEvent({
                supabase,
                eventType: type === 'news' ? 'benchmark_sent_to_news' : 'benchmark_sent_to_blog',
                actorType: 'agent',
                entityType: 'blog_post',
                entityId: post.id,
                source: 'benchmark-editorial',
                label: post.title,
                importanceScore: 68,
                metadata: {
                    opportunity_id: opportunity.id,
                    opportunity_title: opportunity.title,
                    benchmark_keyword: opportunity.keyword,
                    benchmark_source_url: opportunity.source_url,
                    handoff_target: type === 'news' ? 'clara-news' : 'isadora-blog',
                    type,
                    generated_by: type === 'news' ? 'news-intelligence' : 'blog-intelligence',
                    handoff_context: handoffContext,
                    status: post.status,
                },
            }).catch((eventError: any) => {
                console.warn('[Benchmark Editorial] send ecosystem event failed:', eventError?.message || eventError)
            })

            return NextResponse.json({ post, result, opportunities })
        }

        return NextResponse.json({ error: 'Acao invalida.' }, { status: 400 })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || String(error) }, { status: 500 })
    }
}
