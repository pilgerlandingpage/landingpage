// Touched to force rebuild after cleanup
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

export async function getOpenAIModel(type: 'concierge' = 'concierge') {
    const key = 'openai_concierge_model'
    const specific = await getAIConfig(key)
    if (specific) return specific

    return (await getAIConfig('openai_model')) || 'gpt-3.5-turbo'
}

export async function getGeminiApiKey() {
    return (await getAIConfig('gemini_api_key')) || process.env.GEMINI_API_KEY
}

export async function getGeminiModel(type: 'concierge' = 'concierge') {
    const key = 'gemini_concierge_model'
    // Fallback to 1.5-flash which is better for free tier
    return (await getAIConfig(key)) || 'gemini-1.5-flash'
}

export async function getActiveAIProvider() {
    return (await getAIConfig('ai_provider')) || 'gemini'
}

export async function getConciergeProvider() {
    return (await getAIConfig('concierge_provider')) || (await getActiveAIProvider())
}

export async function getPilgerProvider() {
    return (await getAIConfig('pilger_provider')) || (await getActiveAIProvider())
}

export async function getAdsProvider() {
    return (await getAIConfig('ads_provider')) || (await getActiveAIProvider())
}

export async function getAdsGeminiModel() {
    return (await getAIConfig('gemini_ads_model')) || 'gemini-2.0-flash'
}

export async function getAdsOpenAIModel() {
    return (await getAIConfig('openai_ads_model')) || 'gpt-4o'
}

import { LEAD_EXTRACTION_PROMPT } from './prompts'

export async function getLeadExtractionPrompt() {
    return (await getAIConfig('lead_extraction_prompt')) || LEAD_EXTRACTION_PROMPT
}

export async function getSerpApiKey() {
    return getAIConfig('serpapi_api_key')
}

export async function getDataForSEOLogin() {
    return getAIConfig('dataforseo_login')
}

export async function getDataForSEOPassword() {
    return getAIConfig('dataforseo_password')
}
