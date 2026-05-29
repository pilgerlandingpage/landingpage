import { NextResponse } from 'next/server'
import { getAIConfig, getActiveAIProvider, getGeminiApiKey, getOpenAIApiKey } from '@/lib/ai/config'
import { getResearchTopicBank } from '@/lib/research/pilger'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
    const health = {
        tableExists: false,
        enabled: true,
        provider: 'gemini',
        depth: 'media',
        geminiKeyConfigured: false,
        openaiKeyConfigured: false,
        systemPromptConfigured: false,
        liveWebSearch: false,
        activeTopics: 0,
        scheduledTopics: 0,
        warnings: [] as string[],
    }

    try {
        const supabase = createAdminClient()
        const { error: tableError } = await supabase
            .from('ai_research_reports')
            .select('id')
            .limit(1)

        health.tableExists = !tableError
        if (tableError) {
            health.warnings.push('Tabela ai_research_reports nao encontrada. Aplique a migration de Pesquisa Profunda no Supabase.')
        }

        const [
            provider,
            enabled,
            depth,
            prompt,
            geminiKey,
            openaiKey,
        ] = await Promise.all([
            getActiveAIProvider(),
            getAIConfig('research_pilger_enabled'),
            getAIConfig('research_pilger_depth'),
            getAIConfig('research_pilger_system_prompt'),
            getGeminiApiKey(),
            getOpenAIApiKey(),
        ])

        health.provider = String(provider || 'gemini').toLowerCase()
        health.enabled = enabled !== 'false'
        health.depth = depth || 'media'
        health.geminiKeyConfigured = Boolean(geminiKey)
        health.openaiKeyConfigured = Boolean(openaiKey)
        health.systemPromptConfigured = Boolean(prompt)
        health.liveWebSearch = health.provider === 'gemini' && health.geminiKeyConfigured
        const topics = await getResearchTopicBank()
        health.activeTopics = topics.length
        health.scheduledTopics = topics.filter(topic => topic.frequency !== 'uma_vez').length

        if (!health.enabled) health.warnings.push('Research Pilger esta desativado nas configuracoes.')
        if (health.provider === 'gemini' && !health.geminiKeyConfigured) health.warnings.push('Gemini API Key nao configurada.')
        if (health.provider === 'openai') health.warnings.push('Provider atual e OpenAI: este modo nao faz busca web em tempo real.')
        if (health.provider === 'openai' && !health.openaiKeyConfigured) health.warnings.push('OpenAI API Key nao configurada.')
        if (!health.systemPromptConfigured) health.warnings.push('Prompt da Pesquisa Pilger nao encontrado; sera usado o prompt padrao do codigo.')

        return NextResponse.json({ success: true, health })
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            health,
            message: error?.message || String(error),
        }, { status: 500 })
    }
}
