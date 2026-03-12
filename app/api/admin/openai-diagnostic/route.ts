import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getOpenAIApiKey, getActiveAIProvider } from '@/lib/ai/config'

export async function GET() {
    try {
        const apiKey = await getOpenAIApiKey()

        if (!apiKey) {
            return NextResponse.json({
                success: false,
                message: 'Chave da API da OpenAI (OpenAI API Key) não configurada na Sala de Manutenção.',
                summary: null,
                models: [],
            }, { status: 400 })
        }

        const openai = new OpenAI({ apiKey })

        // 1. Fetch available models
        let modelsList;
        try {
            const listResponse = await openai.models.list()
            modelsList = listResponse.data.filter(m => m.id.includes('gpt') || m.id.includes('o1') || m.id.includes('o3'))
        } catch (err: any) {
            return NextResponse.json({
                success: false,
                message: `Erro ao buscar modelos da OpenAI: ${err.message}`,
                summary: null,
                models: [],
            }, { status: 500 })
        }

        // We could get the current model from the concierge, but this tests all gpt models.
        const { getAIConfig } = await import('@/lib/ai/config')
        const currentModel = await getAIConfig('openai_concierge_model') || 'gpt-3.5-turbo'

        // 2. Test each model (concurrently, limit to top N to avoid rate limits or map over all)
        // OpenAI has dozens of models including old variations. Let's filter to the most common ones or test all from the filter.
        const relevantModels = modelsList.filter(m =>
            !m.id.includes('vision') &&
            !m.id.includes('instruct') &&
            !m.id.includes('babbage') &&
            !m.id.includes('davinci') &&
            !m.id.includes('audio') &&
            !m.id.includes('dall-e') &&
            !m.id.includes('tts') &&
            !m.id.includes('whisper') &&
            !m.id.includes('embedding')
        ).sort((a, b) => b.created - a.created) // Newest first

        // For OpenAI, testing all might easily hit rate limits, so let's mark them as available directly if they are returned by list(),
        // but test the current one and the latest 5.
        // Even better, just test their generateContent capability by a quick test if we want, or just assume they work if listed.
        // Let's do a quick test on all relevant models.
        const testPromises = relevantModels.map(async (m): Promise<{
            name: string
            displayName: string
            description: string
            version: string
            inputTokenLimit: number
            outputTokenLimit: number
            supportedGenerationMethods: string[]
            testStatus: 'available' | 'error' | 'not_supported'
            testMessage: string
            isCurrentModel: boolean
        }> => {
            const isOType = m.id.startsWith('o1') || m.id.startsWith('o3')

            // Build test data
            const isCurrentModel = m.id === currentModel

            try {
                // OpenAI API key is valid since we got the model list.
                // We will test chat completions
                // Note: some o1/o3 models may not support max_tokens or temperature=0, let's just make a generic call
                const testParams: any = {
                    model: m.id,
                    messages: [{ role: 'user', content: 'Say OK' }]
                };

                if (!isOType) {
                    testParams.temperature = 1; // let's just use default or 1 to avoid unsupported temperature errors
                }

                const completion = await openai.chat.completions.create(testParams);

                return {
                    name: m.id,
                    displayName: m.id,
                    description: `Proprietário: ${m.owned_by} | Criado em: ${new Date(m.created * 1000).toLocaleDateString()}`,
                    version: '',
                    inputTokenLimit: 0, // OpenAI doesn't return limits in the models list API
                    outputTokenLimit: 0,
                    supportedGenerationMethods: ['chat.completions.create'],
                    testStatus: 'available' as const,
                    testMessage: 'Modelo respondendo aos comandos.',
                    isCurrentModel,
                }
            } catch (err: any) {
                return {
                    name: m.id,
                    displayName: m.id,
                    description: `Proprietário: ${m.owned_by} | Criado em: ${new Date(m.created * 1000).toLocaleDateString()}`,
                    version: '',
                    inputTokenLimit: 0,
                    outputTokenLimit: 0,
                    supportedGenerationMethods: ['chat.completions.create'],
                    testStatus: 'error' as const,
                    testMessage: err.message || String(err),
                    isCurrentModel,
                }
            }
        });

        // Resolve tests in smaller batches or all at once? Let's just do all at once, OpenAI limits are usually generous for tiny requests, but might 429.
        // Let's cap at top 15 models to be safe.
        const modelsToTest = testPromises.slice(0, 15);
        const results = await Promise.all(modelsToTest)

        // Find the current model even if it's not in the top 15
        if (!results.some(r => r.isCurrentModel)) {
            const currentM = modelsList.find(m => m.id === currentModel)
            if (currentM) {
                results.push({
                    name: currentM.id,
                    displayName: currentM.id,
                    description: `Proprietário: ${currentM.owned_by}`,
                    version: '',
                    inputTokenLimit: 0,
                    outputTokenLimit: 0,
                    supportedGenerationMethods: ['chat.completions.create'],
                    testStatus: 'not_supported' as const,
                    testMessage: 'Pausado ou limite excedido',
                    isCurrentModel: true,
                })
            }
        }

        const sortOrder = { available: 0, error: 1, not_supported: 2 }
        results.sort((a, b) => {
            if (a.isCurrentModel) return -1
            if (b.isCurrentModel) return 1
            return (sortOrder[a.testStatus] || 2) - (sortOrder[b.testStatus] || 2)
        })

        const summary = {
            total: results.length,
            available: results.filter(r => r.testStatus === 'available').length,
            errors: results.filter(r => r.testStatus === 'error').length,
            notSupported: results.filter(r => r.testStatus === 'not_supported').length,
            currentModel: currentModel,
        }

        return NextResponse.json({ success: true, summary, models: results })
    } catch (error) {
        console.error('OpenAI diagnostic error:', error)
        return NextResponse.json({
            success: false,
            message: String(error).slice(0, 300),
            summary: null,
            models: [],
        }, { status: 500 })
    }
}
