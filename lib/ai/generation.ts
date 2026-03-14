import { getPilgerProvider } from './config'
import { generateGeminiChat } from './gemini'
import { generateOpenAIChat } from './openai'

export async function generateChatResponse(history: { role: string; content: string }[], message: string, systemPrompt: string) {
    const provider = await getPilgerProvider()

    console.log(`[AI Generation] Usando provider: ${provider}`)

    if (provider === 'openai') {
        try {
            return await generateOpenAIChat(history, message, systemPrompt)
        } catch (error: any) {
            console.error('[OpenAI Generation] Falhou:', error.message)
            console.log('[AI Generation] Fallback para Gemini...')
            return await generateGeminiChat(history, message, systemPrompt)
        }
    } else {
        try {
            return await generateGeminiChat(history, message, systemPrompt)
        } catch (error: any) {
            console.error('[Gemini Generation] Falhou:', error.message)
            console.log('[AI Generation] Fallback para OpenAI...')
            return await generateOpenAIChat(history, message, systemPrompt)
        }
    }
}

