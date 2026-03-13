import { getConciergeProvider, getPilgerProvider } from './config'
import { generateGeminiChat, extractGeminiLeadInfo } from './gemini'
import { generateOpenAIChat, extractOpenAILeadInfo } from './openai'

export async function extractLeadInfo(conversation: string) {
    const provider = await getConciergeProvider()

    if (provider === 'openai') {
        try {
            return await extractOpenAILeadInfo(conversation)
        } catch (error: any) {
            console.error('[OpenAI Lead Extraction] Failed:', error.message)
            console.log('[AI Generation] Falling back to Gemini for lead extraction...')
            return await extractGeminiLeadInfo(conversation)
        }
    } else {
        try {
            return await extractGeminiLeadInfo(conversation)
        } catch (error: any) {
            console.error('[Gemini Lead Extraction] Failed:', error.message)
            console.log('[AI Generation] Falling back to OpenAI for lead extraction...')
            return await extractOpenAILeadInfo(conversation)
        }
    }
}

export async function generateChatResponse(history: { role: string; content: string }[], message: string, systemPrompt: string, context: 'concierge' | 'pilger' = 'concierge') {
    const provider = context === 'pilger' ? await getPilgerProvider() : await getConciergeProvider()

    console.log(`[AI Generation] Using provider: ${provider}`)

    if (provider === 'openai') {
        try {
            return await generateOpenAIChat(history, message, systemPrompt)
        } catch (error: any) {
            console.error('[OpenAI Generation] Failed:', error.message)
            console.log('[AI Generation] Falling back to Gemini...')
            return await generateGeminiChat(history, message, systemPrompt)
        }
    } else {
        try {
            return await generateGeminiChat(history, message, systemPrompt)
        } catch (error: any) {
            console.error('[Gemini Generation] Failed:', error.message)
            console.log('[AI Generation] Falling back to OpenAI...')
            return await generateOpenAIChat(history, message, systemPrompt)
        }
    }
}
