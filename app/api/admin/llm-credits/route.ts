import { NextResponse } from 'next/server'
import { getAIConfig, getOpenAIApiKey, getGeminiApiKey } from '@/lib/ai/config'

type ProviderStatus = 'ok' | 'no_credits' | 'invalid_key' | 'missing_key' | 'error'

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
    if (status === 401 || status === 403 || msg.includes('api key not valid') || msg.includes('invalid argument')) return 'invalid_key'
    if (status === 429 || code.includes('resource_exhausted') || msg.includes('quota') || msg.includes('billing') || msg.includes('credit')) return 'no_credits'
    return 'error'
}

export async function GET() {
    try {
        const [openaiKey, geminiKey, aiProvider, whatsappProvider] = await Promise.all([
            getOpenAIApiKey(),
            getGeminiApiKey(),
            getAIConfig('ai_provider'),
            getAIConfig('whatsapp_provider'),
        ])

        const result = {
            success: true,
            checked_at: new Date().toISOString(),
            active_provider: aiProvider || 'gemini',
            whatsapp_provider: whatsappProvider || null,
            openai: {
                configured: !!openaiKey,
                status: 'missing_key' as ProviderStatus,
                message: 'OpenAI API Key não configurada.',
            },
            gemini: {
                configured: !!geminiKey,
                status: 'missing_key' as ProviderStatus,
                message: 'Gemini API Key não configurada.',
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
                    result.openai.message = 'OpenAI disponível e respondendo.'
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
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: 'Responda apenas OK' }] }],
                        generationConfig: { temperature: 0, maxOutputTokens: 5 },
                    }),
                })

                if (res.ok) {
                    result.gemini.status = 'ok'
                    result.gemini.message = 'Gemini disponível e respondendo.'
                } else {
                    const err = await res.json().catch(() => ({}))
                    const status = classifyGeminiError(res.status, err)
                    result.gemini.status = status
                    result.gemini.message = err?.error?.message || `Gemini erro ${res.status}`
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
            message: 'Erro ao verificar status de créditos/quota das LLMs.',
        }, { status: 500 })
    }
}

