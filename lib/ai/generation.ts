import { getActiveAIProvider, getClonerProvider, getConciergeProvider, getPilgerProvider } from './config'
import { generateGeminiChat, generateGeminiLandingPage, extractGeminiLeadInfo } from './gemini'
import { generateOpenAIChat, generateOpenAILandingPage, extractOpenAILeadInfo } from './openai'

export async function generateLandingPageContent(htmlContent: string, customPrompt: string = '') {
    const provider = await getClonerProvider()
    console.log(`[AI Generation] Cloning with provider: ${provider}`)

    if (provider === 'openai') {
        return generateOpenAILandingPage(htmlContent, customPrompt)
    }
    return generateGeminiLandingPage(htmlContent, customPrompt)
}

export async function extractLeadInfo(conversation: string) {
    const provider = await getConciergeProvider()
    // Use the concierge provider since lead extraction is from chat conversations
    if (provider === 'openai') {
        return extractOpenAILeadInfo(conversation)
    }
    return extractGeminiLeadInfo(conversation)
}

export async function generateChatResponse(history: { role: string; content: string }[], message: string, systemPrompt: string, context: 'concierge' | 'pilger' = 'concierge') {
    const provider = context === 'pilger' ? await getPilgerProvider() : await getConciergeProvider()

    console.log(`[AI Generation] Using provider: ${provider}`)

    if (provider === 'openai') {
        try {
            return await generateOpenAIChat(history, message, systemPrompt)
        } catch (error: any) {
            console.error('[OpenAI Generation] Failed:', error.message)
            // Optional: fallback to Gemini? For now, just throw to let the chat route handle it.
            throw error
        }
    }

    // Default to Gemini
    return generateGeminiChat(history, message, systemPrompt)
}
