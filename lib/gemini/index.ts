import { createClient } from '@supabase/supabase-js'
import { recordGeminiUsage } from '@/lib/ai/gemini-costs'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const DEFAULT_MODEL = 'gemini-2.5-flash'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

export async function getGeminiApiKey(): Promise<string | null> {
    try {
        const supabase = getSupabase()
        const { data } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', 'gemini_api_key')
            .maybeSingle()
        if (data?.value) return data.value
    } catch { /* fallback to env */ }
    return process.env.GEMINI_API_KEY || null
}

export async function getGeminiModel(type: 'concierge' | 'cloner' = 'concierge'): Promise<string> {
    const key = type === 'cloner' ? 'gemini_cloner_model' : 'gemini_concierge_model'
    try {
        const supabase = getSupabase()
        const { data } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', key)
            .maybeSingle()

        if (data?.value) return data.value

        // Fallback for legacy key
        if (type === 'concierge') {
            const { data: legacy } = await supabase
                .from('app_config')
                .select('value')
                .eq('key', 'gemini_model')
                .maybeSingle()
            if (legacy?.value) return legacy.value
        }
    } catch { /* fallback to default */ }

    // Default optimized for each task
    return type === 'cloner' ? 'gemini-1.5-pro' : DEFAULT_MODEL
}

export interface GeminiModel {
    name: string
    displayName: string
    description: string
    version: string
    inputTokenLimit: number
    outputTokenLimit: number
    supportedGenerationMethods: string[]
}

export async function listAvailableModels(): Promise<GeminiModel[]> {
    const apiKey = await getGeminiApiKey()
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

    const response = await fetch(
        `${GEMINI_API_BASE}/models?key=${apiKey}&pageSize=100`
    )

    if (!response.ok) {
        const err = await response.text()
        throw new Error(`Gemini API error listing models: ${err}`)
    }

    const data = await response.json()
    return (data.models || []).map((m: Record<string, unknown>) => ({
        name: m.name || '',
        displayName: m.displayName || '',
        description: m.description || '',
        version: m.version || '',
        inputTokenLimit: m.inputTokenLimit || 0,
        outputTokenLimit: m.outputTokenLimit || 0,
        supportedGenerationMethods: m.supportedGenerationMethods || [],
    }))
}

interface GeminiMessage {
    role: 'user' | 'model'
    parts: { text: string }[]
}

interface ChatOptions {
    systemPrompt: string
    history: GeminiMessage[]
    userMessage: string
    temperature?: number
    maxTokens?: number
}

export async function chatWithGemini({
    systemPrompt,
    history,
    userMessage,
    temperature = 0.7,
    maxTokens = 1024,
}: ChatOptions): Promise<string> {
    const apiKey = await getGeminiApiKey()
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured')
    const modelName = await getGeminiModel()

    const response = await fetch(
        `${GEMINI_API_BASE}/models/${modelName}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: systemPrompt }],
                },
                contents: [
                    ...history,
                    { role: 'user', parts: [{ text: userMessage }] },
                ],
                generationConfig: {
                    temperature,
                    maxOutputTokens: maxTokens,
                },
            }),
        }
    )

    if (!response.ok) {
        const err = await response.text()
        throw new Error(`Gemini API error: ${err}`)
    }

    const data = await response.json()
    await recordGeminiUsage({
        model: modelName,
        feature: 'gemini_chat_rest',
        usageMetadata: data.usageMetadata,
    })
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

export interface ExtractedLeadData {
    name?: string
    phone?: string
    email?: string
    budget?: string
    preferences?: string[]
    is_vip?: boolean
}

export async function extractLeadData(
    conversationText: string
): Promise<ExtractedLeadData> {
    const apiKey = await getGeminiApiKey()
    if (!apiKey) return {}

    const supabase = getSupabase()
    const { data: promptConfig } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'lead_extraction_prompt')
        .maybeSingle()

    const basePrompt = String(promptConfig?.value || '').trim()
    if (!basePrompt) return {}

    const extractionPrompt = `${basePrompt}\n\nConversa:\n${conversationText}`
    const modelName = await getGeminiModel()

    const response = await fetch(
        `${GEMINI_API_BASE}/models/${modelName}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: extractionPrompt }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
            }),
        }
    )

    if (!response.ok) return {}

    const data = await response.json()
    await recordGeminiUsage({
        model: modelName,
        feature: 'lead_extraction',
        usageMetadata: data.usageMetadata,
    })
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

    try {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        return JSON.parse(cleaned) as ExtractedLeadData
    } catch {
        return {}
    }
}

export async function summarizeLead(conversationText: string): Promise<string> {
    const apiKey = await getGeminiApiKey()
    if (!apiKey) return ''

    const summaryPrompt = `Com base na conversa abaixo, resuma o perfil do lead em exatamente 3 tópicos curtos:
1. Poder Aquisitivo
2. Urgência 
3. Preferências

Conversa:
${conversationText}`

    const result = await chatWithGemini({
        systemPrompt: 'Você é um analista de vendas imobiliárias.',
        history: [],
        userMessage: summaryPrompt,
        temperature: 0.3,
        maxTokens: 300,
    })

    return result
}
