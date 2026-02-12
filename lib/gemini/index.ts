import { createClient } from '@supabase/supabase-js'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

async function getGeminiApiKey(): Promise<string | null> {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        const { data } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', 'gemini_api_key')
            .single()
        if (data?.value) return data.value
    } catch { /* fallback to env */ }
    return process.env.GEMINI_API_KEY || null
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

    const response = await fetch(
        `${GEMINI_API_BASE}/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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

    const extractionPrompt = `Analise a conversa abaixo e extraia os dados do lead, se disponíveis.
Responda SOMENTE com um JSON válido, sem markdown, sem texto adicional.
Campos possíveis: name, phone, email, budget, preferences (array de strings), is_vip (boolean).
Se um campo não foi mencionado, omita-o do JSON.
Um lead é VIP se mencionar heliponto, cobertura premium, valores acima de R$ 5 milhões, ou demonstrar alto poder aquisitivo.

Conversa:
${conversationText}`

    const response = await fetch(
        `${GEMINI_API_BASE}/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
