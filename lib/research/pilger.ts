import { RESEARCH_PILGER_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import {
    getActiveAIProvider,
    getAIConfig,
    getGeminiApiKey,
    getOpenAIApiKey,
} from '@/lib/ai/config'
import { createAdminClient } from '@/lib/supabase/server'
import { buildAgentContextBrief, getAgentEcosystemContext, recordEcosystemEvent } from '@/lib/intelligence/ecosystem'
import { saveAgentCentralSnapshot } from '@/lib/intelligence/agent-runtime'
import { buildGeminiGenerationConfig } from '@/lib/ai/gemini-controls'
import { recordGeminiUsage } from '@/lib/ai/gemini-costs'
import OpenAI from 'openai'

type ResearchDepth = 'leve' | 'media' | 'profunda'

type ResearchSource = {
    title: string
    uri: string
}

type ResearchReportInput = {
    topic: string
    requester?: string
    depth?: ResearchDepth
    context?: Record<string, unknown> | null
    promptKey?: string
    promptFallback?: string
}

export type ResearchTopicBankItem = {
    id: string
    topic: string
    region: string
    intent: string
    priority: string
    frequency: string
    status: string
    lastRun?: string
    nextRun?: string
    lastError?: string
}

function parseResearchTopicBank(value: string | null | undefined): ResearchTopicBankItem[] {
    try {
        const parsed = JSON.parse(String(value || '[]'))
        if (!Array.isArray(parsed)) return []
        return parsed
            .map((item: any, index: number) => ({
                id: String(item?.id || `tema-${index}`),
                topic: String(item?.topic || '').trim(),
                region: String(item?.region || '').trim(),
                intent: String(item?.intent || 'geral'),
                priority: String(item?.priority || 'media'),
                frequency: String(item?.frequency || 'semanal'),
                status: String(item?.status || 'ativo'),
                lastRun: item?.lastRun ? String(item.lastRun) : '',
                nextRun: item?.nextRun ? String(item.nextRun) : '',
                lastError: item?.lastError ? String(item.lastError) : '',
            }))
            .filter(item => item.topic)
    } catch {
        return []
    }
}

function priorityWeight(priority: string) {
    if (priority === 'alta') return 3
    if (priority === 'media') return 2
    return 1
}

export async function getResearchTopicBank(intent?: string) {
    const raw = await getAIConfig('research_pilger_topics')
    const topics = parseResearchTopicBank(raw)
        .filter(topic => topic.status !== 'inativo')
        .filter(topic => !intent || topic.intent === intent || topic.intent === 'geral')
        .sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority))
    return topics
}

export async function chooseResearchTopicFromBank(intent?: string) {
    const topics = await getResearchTopicBank(intent)
    return topics[0] || null
}

function getFrequencyDays(frequency: string) {
    if (frequency === 'diaria') return 1
    if (frequency === 'quinzenal') return 14
    if (frequency === 'mensal') return 30
    if (frequency === 'uma_vez') return null
    return 7
}

function addDays(date: Date, days: number) {
    const next = new Date(date)
    next.setDate(next.getDate() + days)
    return next
}

function parseDate(value?: string) {
    if (!value) return null
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date : null
}

function getNextRun(topic: ResearchTopicBankItem, from = new Date()) {
    const days = getFrequencyDays(topic.frequency)
    if (!days) return ''
    return addDays(from, days).toISOString()
}

function topicIsDue(topic: ResearchTopicBankItem, now = new Date()) {
    if (topic.status === 'inativo') return false
    if (topic.frequency === 'uma_vez' && topic.lastRun) return false

    const nextRun = parseDate(topic.nextRun)
    if (nextRun) return nextRun.getTime() <= now.getTime()

    const lastRun = parseDate(topic.lastRun)
    const days = getFrequencyDays(topic.frequency)
    if (!lastRun || !days) return true

    return addDays(lastRun, days).getTime() <= now.getTime()
}

async function saveResearchTopicBank(topics: ResearchTopicBankItem[]) {
    const supabase = createAdminClient()
    const { error } = await supabase
        .from('app_config')
        .upsert({
            key: 'research_pilger_topics',
            value: JSON.stringify(topics),
            updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })

    if (error) throw error
}

export async function runScheduledResearchTopics(options: { limit?: number; slot?: string } = {}) {
    const enabled = (await getAIConfig('research_pilger_enabled')) !== 'false'
    const scheduleEnabled = (await getAIConfig('research_pilger_schedule_enabled')) !== 'false'
    if (!enabled || !scheduleEnabled) {
        return { skipped: true, reason: enabled ? 'schedule_disabled' : 'research_disabled', ran: 0, failed: 0 }
    }

    const raw = await getAIConfig('research_pilger_topics')
    const topics = parseResearchTopicBank(raw)
    const limitConfig = Number.parseInt(String(await getAIConfig('research_pilger_daily_limit') || '8'), 10)
    const limit = Math.max(0, Math.min(50, options.limit ?? (Number.isFinite(limitConfig) ? limitConfig : 8)))
    const now = new Date()
    const dueTopics = topics
        .filter(topic => topicIsDue(topic, now))
        .sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority))
        .slice(0, limit)

    let ran = 0
    let failed = 0
    const results: Array<{ id: string; topic: string; status: 'completed' | 'failed'; reportId?: string; error?: string }> = []

    for (const topic of dueTopics) {
        const researchTopic = [topic.topic, topic.region].filter(Boolean).join(' - ')
        try {
            const report = await createResearchReport({
                topic: researchTopic,
                requester: `research-monitor${options.slot ? `-${options.slot}` : ''}`,
                context: {
                    monitored_topic_id: topic.id,
                    intent: topic.intent,
                    priority: topic.priority,
                    frequency: topic.frequency,
                    region: topic.region,
                    instruction: 'Investigue fontes externas, noticias recentes, sinais de prefeitura, economia local, mercado imobiliario e oportunidades para Blog, Noticias, Radar, CEO, Trafego e agentes de atendimento.',
                },
            })

            ran += 1
            topic.lastRun = now.toISOString()
            topic.nextRun = getNextRun(topic, now)
            topic.lastError = ''
            results.push({ id: topic.id, topic: topic.topic, status: 'completed', reportId: report.id })
        } catch (error: any) {
            failed += 1
            topic.lastRun = now.toISOString()
            topic.nextRun = addDays(now, 1).toISOString()
            topic.lastError = error?.message || String(error)
            results.push({ id: topic.id, topic: topic.topic, status: 'failed', error: topic.lastError })
        }
    }

    if (dueTopics.length > 0) {
        await saveResearchTopicBank(topics)
    }

    return {
        skipped: false,
        ran,
        failed,
        due: dueTopics.length,
        totalTopics: topics.length,
        results,
    }
}

function extractSummary(markdown: string) {
    const text = String(markdown || '').replace(/[#*_`>-]/g, ' ').replace(/\s+/g, ' ').trim()
    return text.slice(0, 420)
}

function depthInstruction(depth: ResearchDepth) {
    if (depth === 'leve') return 'Faca uma pesquisa objetiva com foco nos 5 principais achados.'
    if (depth === 'profunda') return 'Faca uma pesquisa profunda, comparando fontes, intencao de busca, oportunidades de pauta e riscos.'
    return 'Faca uma pesquisa completa, mas concisa, com fontes e recomendacoes praticas.'
}

function normalizeSources(raw: any): ResearchSource[] {
    const chunks = raw?.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    return chunks
        .map((chunk: any) => chunk?.web)
        .filter((web: any) => web?.uri)
        .map((web: any) => ({ title: String(web.title || web.uri), uri: String(web.uri) }))
        .filter((source: ResearchSource, index: number, arr: ResearchSource[]) =>
            arr.findIndex(item => item.uri === source.uri) === index
        )
        .slice(0, 20)
}

function normalizeQueries(raw: any): string[] {
    const queries = raw?.candidates?.[0]?.groundingMetadata?.webSearchQueries || []
    return Array.isArray(queries) ? queries.map(String).slice(0, 12) : []
}

async function callGeminiSearch(topic: string, prompt: string, depth: ResearchDepth, context?: Record<string, unknown> | null) {
    const apiKey = await getGeminiApiKey()
    if (!apiKey) throw new Error('Gemini API Key nao configurada.')

    const model = (await getAIConfig('gemini_model')) || 'gemini-2.5-flash'
    const body = {
        contents: [{
            role: 'user',
            parts: [{
                text: [
                    `Tema: ${topic}`,
                    depthInstruction(depth),
                    context ? `Contexto interno resumido:\n${JSON.stringify(context, null, 2)}` : '',
                    'Entregue o relatorio em Markdown e liste as fontes consultadas.',
                ].filter(Boolean).join('\n\n'),
            }],
        }],
        systemInstruction: { role: 'model', parts: [{ text: prompt }] },
        tools: [{ google_search: {} }],
        generationConfig: buildGeminiGenerationConfig(model, {
            temperature: 0.25,
            maxOutputTokens: depth === 'profunda' ? 2200 : 1400,
        }),
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })

    const json = await response.json().catch(() => ({}))
    if (!response.ok) {
        throw new Error(json?.error?.message || `Gemini Search falhou (${response.status}).`)
    }

    await recordGeminiUsage({
        model,
        feature: 'research_gemini_search',
        usageMetadata: json?.usageMetadata,
        metadata: { depth, topic },
    })

    const markdown = json?.candidates?.[0]?.content?.parts
        ?.map((part: any) => part?.text || '')
        .join('\n')
        .trim() || ''

    return {
        markdown,
        sources: normalizeSources(json),
        queries: normalizeQueries(json),
        raw: json,
    }
}

async function callOpenAIResearchFallback(topic: string, prompt: string, depth: ResearchDepth, context?: Record<string, unknown> | null) {
    const apiKey = await getOpenAIApiKey()
    if (!apiKey) throw new Error('OpenAI API Key nao configurada.')

    const model = (await getAIConfig('openai_model')) || 'gpt-4o-mini'
    const openai = new OpenAI({ apiKey })
    const response = await openai.chat.completions.create({
        model,
        messages: [
            { role: 'system', content: `${prompt}\n\nImportante: neste modo, voce nao possui busca web em tempo real. Use apenas o contexto recebido e declare essa limitacao.` },
            {
                role: 'user',
                content: [
                    `Tema: ${topic}`,
                    depthInstruction(depth),
                    context ? `Contexto interno:\n${JSON.stringify(context, null, 2)}` : '',
                ].filter(Boolean).join('\n\n'),
            },
        ],
        temperature: 0.3,
    })

    return {
        markdown: response.choices[0]?.message?.content || '',
        sources: [] as ResearchSource[],
        queries: [] as string[],
        raw: response,
    }
}

export async function createResearchReport(input: ResearchReportInput) {
    const topic = String(input.topic || '').trim()
    if (!topic) throw new Error('Tema da pesquisa e obrigatorio.')

    const supabase = createAdminClient()
    const depth = input.depth || ((await getAIConfig('research_pilger_depth')) as ResearchDepth) || 'media'
    const promptKey = input.promptKey || 'research_pilger_system_prompt'
    const prompt = (await getAIConfig(promptKey)) || input.promptFallback || RESEARCH_PILGER_SYSTEM_PROMPT
    const ecosystemContext = await getAgentEcosystemContext({ supabase, agent: 'research', days: 30, limit: 100 })
        .catch((error: any) => {
            console.warn('[Research Pilger] Ecosystem context unavailable:', error?.message || error)
            return null
        })
    const enrichedContext = {
        ...(input.context || {}),
        ecosystem_brief: input.context?.ecosystem_brief || (ecosystemContext ? buildAgentContextBrief(ecosystemContext) : undefined),
        ecosystem_source_counts: input.context?.ecosystem_source_counts || ecosystemContext?.source_counts,
        ecosystem_signals: input.context?.ecosystem_signals || ecosystemContext?.signals,
    }

    const { data: inserted, error: insertError } = await supabase
        .from('ai_research_reports')
        .insert({
            topic,
            requester: input.requester || 'manual',
            depth,
            status: 'running',
            valid_until: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select('*')
        .single()

    if (insertError) throw insertError

    try {
        const enabled = (await getAIConfig('research_pilger_enabled')) !== 'false'
        if (!enabled) throw new Error('Research Pilger esta desativado.')

        const provider = await getActiveAIProvider()
        const result = provider === 'openai'
            ? await callOpenAIResearchFallback(topic, prompt, depth, enrichedContext)
            : await callGeminiSearch(topic, prompt, depth, enrichedContext)

        const { data: report, error } = await supabase
            .from('ai_research_reports')
            .update({
                status: 'completed',
                executive_summary: extractSummary(result.markdown),
                report_markdown: result.markdown,
                sources: result.sources,
                queries: result.queries,
                raw_response: result.raw,
                error_message: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', inserted.id)
            .select('*')
            .single()

        if (error) throw error
        await recordEcosystemEvent({
            supabase,
            eventType: 'research_report_completed',
            actorType: 'agent',
            entityType: 'ai_research_report',
            entityId: report.id,
            source: input.requester || 'research-pilger',
            label: report.topic,
            importanceScore: depth === 'profunda' ? 76 : 66,
            metadata: {
                topic,
                requester: input.requester || 'manual',
                depth,
                executive_summary: report.executive_summary,
                sources_count: Array.isArray(report.sources) ? report.sources.length : 0,
                queries: report.queries || [],
            },
        }).catch((eventError: any) => {
            console.warn('[Research Pilger] ecosystem event failed:', eventError?.message || eventError)
        })
        await saveAgentCentralSnapshot({
            supabase,
            agentId: 'research-pilger',
            createdBy: input.requester || 'research-pilger',
            context: ecosystemContext || {
                agent: 'research',
                period: { label: 'ultimos 30 dias' },
                source_counts: {},
            },
            summary: `Pesquisa externa concluida: "${report.topic}". ${report.executive_summary || ''}`.trim(),
            signals: {
                latest_research_report: {
                    id: report.id,
                    topic: report.topic,
                    requester: input.requester || 'manual',
                    depth,
                    summary: report.executive_summary,
                    sources_count: Array.isArray(report.sources) ? report.sources.length : 0,
                    queries: report.queries || [],
                    created_at: report.created_at,
                    updated_at: report.updated_at,
                },
            },
        }).catch((snapshotError: any) => {
            console.warn('[Research Pilger] central snapshot failed:', snapshotError?.message || snapshotError)
        })
        return report
    } catch (error: any) {
        await supabase
            .from('ai_research_reports')
            .update({
                status: 'failed',
                error_message: error?.message || String(error),
                updated_at: new Date().toISOString(),
            })
            .eq('id', inserted.id)

        await recordEcosystemEvent({
            supabase,
            eventType: 'research_report_failed',
            actorType: 'agent',
            entityType: 'ai_research_report',
            entityId: inserted.id,
            source: input.requester || 'research-pilger',
            label: topic,
            importanceScore: 45,
            metadata: {
                topic,
                requester: input.requester || 'manual',
                depth,
                error: error?.message || String(error),
            },
        }).catch((eventError: any) => {
            console.warn('[Research Pilger] failed event record failed:', eventError?.message || eventError)
        })

        throw error
    }
}
