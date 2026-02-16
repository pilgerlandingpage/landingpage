import { createAdminClient } from '@/lib/supabase/server'

export async function getAIConfig(key: string): Promise<string | null> {
    try {
        const supabase = createAdminClient()
        const { data } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', key)
            .maybeSingle()

        if (data?.value) return data.value
    } catch (error) {
        console.warn(`[Config] Failed to fetch ${key} from DB`, error)
    }

    // Fallback to environment variable (e.g. OPENAI_API_KEY)
    const envKey = key.toUpperCase()
    return process.env[envKey] || null
}

export async function getOpenAIApiKey() {
    return getAIConfig('openai_api_key')
}

export async function getOpenAIModel(type: 'concierge' | 'cloner' = 'concierge') {
    const key = type === 'cloner' ? 'openai_cloner_model' : 'openai_concierge_model'
    const specific = await getAIConfig(key)
    if (specific) return specific

    return (await getAIConfig('openai_model')) || 'gpt-3.5-turbo'
}

export async function getGeminiApiKey() {
    return (await getAIConfig('gemini_api_key')) || process.env.GEMINI_API_KEY
}

export async function getGeminiModel(type: 'concierge' | 'cloner' = 'concierge') {
    const key = type === 'cloner' ? 'gemini_cloner_model' : 'gemini_concierge_model'
    // Fallback to 1.5-flash which is better for free tier
    return (await getAIConfig(key)) || 'gemini-1.5-flash'
}

export async function getActiveAIProvider() {
    return (await getAIConfig('ai_provider')) || 'gemini'
}

export async function getConciergeProvider() {
    return (await getAIConfig('concierge_provider')) || (await getActiveAIProvider())
}

export async function getClonerProvider() {
    return (await getAIConfig('cloner_provider')) || (await getActiveAIProvider())
}

export async function getPilgerProvider() {
    return (await getAIConfig('pilger_provider')) || (await getActiveAIProvider())
}

import { MASTER_LANDING_PAGE_PROMPT, LEAD_EXTRACTION_PROMPT } from './prompts'

export async function getClonerPrompt() {
    return (await getAIConfig('cloner_system_prompt')) || MASTER_LANDING_PAGE_PROMPT
}

export async function getLeadExtractionPrompt() {
    return (await getAIConfig('lead_extraction_prompt')) || LEAD_EXTRACTION_PROMPT
}
