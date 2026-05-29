// Touched to force rebuild after cleanup
import { createAdminClient } from '@/lib/supabase/server'

const LEGACY_AGENT_NAME_REPLACEMENTS: Array<[string, string]> = [
    ['Helena Duarte', 'Helena Gestao Painel'],
    ['Tomas Valente', 'Tomas Governanca IA'],
    ['Marina Castro', 'Marina Triagem Imoveis'],
    ['Bianca Alvares', 'Bianca Cadastro Imoveis'],
    ['Laura Campos', 'Laura Extracao Leads'],
    ['Rafael Nexo', 'Rafael WhatsApp Global'],
    ['Nara Costa', 'Nara Resgate Leads'],
    ['Caio Linhares', 'Caio Follow-up'],
    ['Sofia Portas', 'Sofia Onboarding'],
    ['Bruno Ferraz', 'Bruno Seguranca Acesso'],
    ['Vitor Mello', 'Vitor Trafego Pago'],
    ['Livia Andrade', 'Livia Atendimento Social'],
    ['Renata Alcance', 'Renata Trafego Organico'],
    ['Clara Conteudo', 'Clara Criativos'],
    ['Miguel Agenda', 'Miguel Publicacao'],
    ['Gabriel Correio', 'Gabriel Distribuicao Inteligente'],
    ['Gabriel E-mails', 'Gabriel Distribuicao Inteligente'],
    ['Gabriel E-mail & WhatsApp', 'Gabriel Distribuicao Inteligente'],
    ['Elisa Martins', 'Elisa Relatorio Diario'],
    ['Augusto Prado', 'Augusto Diretriz Semanal'],
    ['Arthur Reis', 'Arthur CEO IA'],
    ['Lara Horizonte', 'Lara Radar Mercado'],
    ['Lara Benchmark', 'Lara Benchmark Editorial'],
    ['Isadora Vale', 'Isadora Edicao Blog'],
    ['Clara Nogueira', 'Clara Edicao Noticias'],
    ['Mateus Fonte', 'Mateus Pesquisa Externa'],
]

export function normalizeAgentNamesInConfig(key: string, value: string) {
    if (!/(prompt|message|template)/i.test(key)) return value

    return LEGACY_AGENT_NAME_REPLACEMENTS.reduce(
        (current, [legacyName, newName]) => current.replaceAll(legacyName, newName),
        value
    )
}

export async function getAIConfig(key: string): Promise<string | null> {
    try {
        const supabase = createAdminClient()
        const { data } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', key)
            .maybeSingle()

        if (data?.value) return normalizeAgentNamesInConfig(key, data.value)
    } catch (error) {
        console.warn(`[Config] Failed to fetch ${key} from DB`, error)
    }

    // Fallback to environment variable (e.g. OPENAI_API_KEY)
    const envKey = key.toUpperCase()
    return process.env[envKey] ? normalizeAgentNamesInConfig(key, process.env[envKey] as string) : null
}

export async function getOpenAIApiKey() {
    return getAIConfig('openai_api_key')
}



export async function getGeminiApiKey() {
    return (await getAIConfig('gemini_api_key')) || process.env.GEMINI_API_KEY
}



export async function getActiveAIProvider() {
    return (await getAIConfig('ai_provider')) || 'gemini'
}



export async function getPilgerProvider() {
    return getActiveAIProvider()
}

export async function getCeoProvider() {
    return getActiveAIProvider()
}

export async function getAdsProvider() {
    return getActiveAIProvider()
}

export async function getAdsGeminiModel() {
    return (await getAIConfig('gemini_model')) || 'gemini-2.5-flash'
}

export async function getAdsOpenAIModel() {
    return (await getAIConfig('openai_model')) || 'gpt-4o-mini'
}

export async function getCeoOpenAIModel() {
    return (await getAIConfig('openai_model')) || 'gpt-4o-mini'
}

export async function getCeoGeminiModel() {
    return (await getAIConfig('gemini_model')) || 'gemini-2.5-flash'
}

export async function getLeadExtractionPrompt() {
    return await getAIConfig('lead_extraction_prompt')
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
