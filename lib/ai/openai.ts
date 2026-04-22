import OpenAI from 'openai'
import { getOpenAIApiKey, getAIConfig } from './config'

export async function generateOpenAIChat(
    history: { role: string; content: string }[],
    message: string,
    systemPrompt: string,
    modelOverride?: string
) {
    const apiKey = await getOpenAIApiKey()

    if (!apiKey) {
        throw new Error('OpenAI API Key não configurada. Configure na Sala de Manutenção.')
    }

    const modelName = modelOverride || (await getAIConfig('openai_model')) || 'gpt-3.5-turbo'
    console.log('[OpenAI Chat] Usando modelo:', modelName)

    try {
        const openai = new OpenAI({ apiKey })

        const messages = [
            { role: 'system', content: systemPrompt },
            ...(history || []).map(msg => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            })),
            { role: 'user', content: message }
        ]

        const completion = await openai.chat.completions.create({
            messages: messages as any,
            model: modelName,
            temperature: 0.7,
        })

        return completion.choices[0].message.content || ''

    } catch (error: any) {
        console.error('[OpenAI Chat] Erro:', error.message || error)
        throw error
    }
}

