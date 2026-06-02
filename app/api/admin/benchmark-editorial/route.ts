import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { BENCHMARK_EDITORIAL_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import { createResearchReport } from '@/lib/research/pilger'
import { buildAgentContextBrief, getAgentEcosystemContext, recordEcosystemEvent, saveEcosystemSnapshot } from '@/lib/intelligence/ecosystem'
import { getAvailableBlogSlug, slugifyBlog } from '@/lib/blog/types'
import { notifyBlogReviewReady } from '@/lib/blog/review-notifications'
import {
    BENCHMARK_CONFIG_KEYS,
    DEFAULT_BENCHMARK_COMPETITORS,
    DEFAULT_BENCHMARK_KEYWORDS,
    BenchmarkCompetitor,
    BenchmarkKeyword,
    BenchmarkOpportunity,
    BenchmarkRun,
    BenchmarkIntent,
    buildBenchmarkMarkdownSummary,
    getDomainFromUrl,
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

    const keywords = parseBenchmarkArray<BenchmarkKeyword>(rows[BENCHMARK_CONFIG_KEYS.keywords], DEFAULT_BENCHMARK_KEYWORDS)

    return {
        competitors: parseBenchmarkArray<BenchmarkCompetitor>(rows[BENCHMARK_CONFIG_KEYS.competitors], DEFAULT_BENCHMARK_COMPETITORS),
        keywords: keywords.length > 0 ? keywords : DEFAULT_BENCHMARK_KEYWORDS,
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
        strategy_notes: 'Criar conteudo original com leitura editorial especializada, fontes no corpo do texto, links internos para estoque/regioes e resposta direta para buscas conversacionais.',
        recommended_angle: `Transformar "${params.topic}" em uma pauta premium, util e local, conectando contexto publico com oportunidades reais da Imobiliaria Guilherme Pilger.`,
        sources: sources.slice(0, 12),
        queries: queries.slice(0, 12),
        outline: extractOutline(markdown),
        status: 'new',
        created_at: nowIso(),
        updated_at: nowIso(),
    }
}

function buildBlogPayload(opportunity: BenchmarkOpportunity, type: 'blog' | 'news') {
    const baseTitle = type === 'news'
        ? `Noticia a partir de benchmark: ${opportunity.title}`
        : `Pauta de blog a partir de benchmark: ${opportunity.title}`

    return {
        title: baseTitle.slice(0, 180),
        slug: slugifyBlog(baseTitle),
        excerpt: opportunity.summary.slice(0, 280),
        content_markdown: buildBenchmarkMarkdownSummary(opportunity),
        status: 'under_review',
        cover_image_url: null,
        author_name: 'Lara Benchmark Editorial',
        category: type === 'news' ? 'Noticias' : 'Mercado Imobiliario',
        tags: [
            'Benchmark Editorial',
            type === 'news' ? 'Noticias' : 'Blog',
            opportunity.keyword,
            opportunity.format,
            ...opportunity.queries.slice(0, 4),
        ].filter(Boolean),
        seo_title: baseTitle.slice(0, 180),
        meta_description: opportunity.summary.slice(0, 280),
        primary_keyword: opportunity.keyword,
        secondary_keywords: opportunity.queries,
        local_entities: [],
        aeo_questions: [],
        internal_links: [
            { label: 'ver imoveis de luxo no litoral', target: '/', reason: 'Conectar pauta ao estoque e a homepage.' },
            { label: 'acompanhar noticias do mercado', target: '/noticias', reason: 'Fortalecer cluster editorial.' },
            { label: 'ler artigos do blog', target: '/blog', reason: 'Fortalecer interligacao editorial.' },
        ],
        source_summary: {
            benchmark_opportunity_id: opportunity.id,
            benchmark_source_url: opportunity.source_url,
            benchmark_sources: opportunity.sources,
            benchmark_queries: opportunity.queries,
            note: 'Briefing criado pelo agente Lara Benchmark Editorial. Revisar, enriquecer e escrever conteudo final original antes de publicar.',
        },
        approval_notes: [
            'Usar este briefing como inteligencia competitiva, nao como texto final.',
            'Revisar fatos, fontes, acentuacao, imagens e links internos antes de publicar.',
        ],
        generated_by: 'benchmark-editorial',
    }
}

export async function GET() {
    try {
        const supabase = createAdminClient()
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
            const competitors = state.competitors.filter(item => item.id !== String(body?.id || ''))
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
            const keywords = state.keywords.filter(item => item.id !== String(body?.id || ''))
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
                            'Pesquise somente fontes publicas.',
                            'Procure padroes de conteudo ranqueado, perguntas respondidas, lacunas, formatos e oportunidades para SEO/AEO/GEO.',
                            'Nao copie concorrentes. Gere leitura original para alimentar Isadora Edicao Blog e Clara Edicao Noticias.',
                            'Liste links externos e ideias de links internos para o ecossistema Guilherme Pilger.',
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

            const payload = buildBlogPayload(opportunity, type)
            const slug = await getAvailableBlogSlug(supabase, payload.slug || payload.title)
            const { data: post, error } = await supabase
                .from('blog_posts')
                .insert({ ...payload, slug })
                .select('*')
                .single()

            if (error) throw error

            const notification = await notifyBlogReviewReady({
                supabase,
                post,
                origin: request.nextUrl.origin,
            })

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
                    type,
                    slug: post.slug,
                    status: post.status,
                },
            }).catch((eventError: any) => {
                console.warn('[Benchmark Editorial] send ecosystem event failed:', eventError?.message || eventError)
            })

            return NextResponse.json({ post, notification, opportunities })
        }

        return NextResponse.json({ error: 'Acao invalida.' }, { status: 400 })
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || String(error) }, { status: 500 })
    }
}
