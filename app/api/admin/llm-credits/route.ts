import { NextResponse } from 'next/server'
import { getAIConfig, getOpenAIApiKey, getGeminiApiKey } from '@/lib/ai/config'
import { buildGeminiGenerationConfig } from '@/lib/ai/gemini-controls'

type ProviderStatus = 'ok' | 'no_credits' | 'invalid_key' | 'missing_key' | 'error'

const GEMINI_FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash']

function normalizeGeminiModel(model?: string | null) {
    return String(model || '').trim().replace(/^models\//, '')
}

function classifyOpenAIError(status: number, payload: any): ProviderStatus {
    const code = String(payload?.error?.code || '').toLowerCase()
    const type = String(payload?.error?.type || '').toLowerCase()
    const msg = String(payload?.error?.message || '').toLowerCase()

    if (!status) return 'error'
    if (status === 401 || code.includes('invalid_api_key') || msg.includes('incorrect api key')) return 'invalid_key'
    if (code.includes('insufficient_quota') || msg.includes('quota') || msg.includes('billing') || msg.includes('credit')) return 'no_credits'
    if (type.includes('insufficient_quota')) return 'no_credits'
    return 'error'
}

function classifyGeminiError(status: number, payload: any): ProviderStatus {
    const code = String(payload?.error?.status || '').toLowerCase()
    const msg = String(payload?.error?.message || '').toLowerCase()

    if (!status) return 'error'
    if (status === 401 || status === 403 || msg.includes('api key not valid')) return 'invalid_key'
    if (status === 429 || code.includes('resource_exhausted') || msg.includes('quota') || msg.includes('billing') || msg.includes('credit')) return 'no_credits'
    return 'error'
}

async function testGeminiModel(apiKey: string, model: string) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Responda apenas OK' }] }],
            generationConfig: buildGeminiGenerationConfig(model, { temperature: 0, maxOutputTokens: 5 }),
        }),
    })

    if (res.ok) return { ok: true, model, status: res.status, payload: null as any }

    const payload = await res.json().catch(() => ({}))
    return { ok: false, model, status: res.status, payload }
}

async function listGeminiGenerationModels(apiKey: string): Promise<string[]> {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`)
    if (!res.ok) return []

    const data = await res.json().catch(() => ({}))
    const models = Array.isArray(data?.models) ? data.models : []
    return models
        .filter((model: any) => Array.isArray(model?.supportedGenerationMethods) && model.supportedGenerationMethods.includes('generateContent'))
        .map((model: any) => normalizeGeminiModel(model?.name))
        .filter(Boolean)
        .sort((a: string, b: string) => {
            const score = (model: string) => {
                if (model.includes('2.5') && model.includes('flash')) return 0
                if (model.includes('flash')) return 1
                if (model.includes('pro')) return 2
                return 3
            }
            return score(a) - score(b)
        })
}

export async function GET() {
    try {
        const [openaiKey, geminiKey, aiProvider, configuredGeminiModelRaw] = await Promise.all([
            getOpenAIApiKey(),
            getGeminiApiKey(),
            getAIConfig('ai_provider'),
            getAIConfig('gemini_model'),
        ])
        const configuredGeminiModel = normalizeGeminiModel(configuredGeminiModelRaw)

        const result = {
            success: true,
            checked_at: new Date().toISOString(),
            active_provider: aiProvider || 'gemini',
            openai: {
                configured: !!openaiKey,
                status: 'missing_key' as ProviderStatus,
                message: 'OpenAI API Key nao configurada.',
            },
            gemini: {
                configured: !!geminiKey,
                status: 'missing_key' as ProviderStatus,
                message: 'Gemini API Key nao configurada.',
            },
        }

        if (openaiKey) {
            try {
                const res = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${openaiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: [{ role: 'user', content: 'Responda apenas OK' }],
                        max_tokens: 5,
                        temperature: 0,
                    }),
                })

                if (res.ok) {
                    result.openai.status = 'ok'
                    result.openai.message = 'OpenAI disponivel e respondendo.'
                } else {
                    const err = await res.json().catch(() => ({}))
                    const status = classifyOpenAIError(res.status, err)
                    result.openai.status = status
                    result.openai.message = err?.error?.message || `OpenAI erro ${res.status}`
                }
            } catch (e: any) {
                result.openai.status = 'error'
                result.openai.message = e?.message || 'Falha ao testar OpenAI.'
            }
        }

        if (geminiKey) {
            try {
                const preferredModels: string[] = Array.from(new Set([
                    configuredGeminiModel,
                    ...GEMINI_FALLBACK_MODELS,
                ].filter(Boolean) as string[]))

                let lastTest: Awaited<ReturnType<typeof testGeminiModel>> | null = null

                for (const model of preferredModels) {
                    lastTest = await testGeminiModel(geminiKey, model)
                    if (lastTest.ok) {
                        result.gemini.status = 'ok'
                        result.gemini.message = `Gemini disponivel e respondendo. Modelo testado: ${model}.`
                        break
                    }
                }

                if (result.gemini.status !== 'ok') {
                    const listedModels = await listGeminiGenerationModels(geminiKey)
                    const remainingModels = listedModels.filter(model => !preferredModels.includes(model)).slice(0, 5)

                    for (const model of remainingModels) {
                        lastTest = await testGeminiModel(geminiKey, model)
                        if (lastTest.ok) {
                            result.gemini.status = 'ok'
                            result.gemini.message = `Gemini disponivel e respondendo. Modelo testado: ${model}.`
                            break
                        }
                    }
                }

                if (result.gemini.status !== 'ok' && lastTest) {
                    const status = classifyGeminiError(lastTest.status, lastTest.payload)
                    result.gemini.status = status
                    result.gemini.message = lastTest.payload?.error?.message || `Gemini erro ${lastTest.status}`
                }
            } catch (e: any) {
                result.gemini.status = 'error'
                result.gemini.message = e?.message || 'Falha ao testar Gemini.'
            }
        }

        return NextResponse.json(result)
    } catch (error) {
        console.error('[LLM Credits] Error:', error)
        return NextResponse.json({
            success: false,
            message: 'Erro ao verificar status de creditos/quota das LLMs.',
        }, { status: 500 })
    }
}
