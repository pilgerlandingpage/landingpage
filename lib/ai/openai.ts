import OpenAI from 'openai'
import { getOpenAIApiKey, getOpenAIModel, getClonerPrompt, getLeadExtractionPrompt } from './config'

export async function generateOpenAILandingPage(htmlContent: string, customPrompt: string) {
    const apiKey = await getOpenAIApiKey()
    if (!apiKey) throw new Error('OpenAI API Key não configurada.')

    // For cloning, we prefer a model with larger context if possible, but use the configured one
    // or fallback to gpt-3.5-turbo-16k if we could detect it, but for now just use configured.
    const modelName = await getOpenAIModel('cloner')

    const openai = new OpenAI({ apiKey })

    const systemPrompt = await getClonerPrompt()
    const userPrompt = `
        CUSTOM PROMPT FROM ADMIN: "${customPrompt}"
        
        HTML CONTENT:
        \`\`\`html
        ${htmlContent.substring(0, 50000)}
        \`\`\`
    `

    try {
        const completion = await openai.chat.completions.create({
            model: modelName,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.5,
        })

        const content = completion.choices[0].message.content
        if (!content) throw new Error('No content returned')

        return JSON.parse(content)
    } catch (error: any) {
        console.error('[OpenAI Cloning] Error:', error)
        throw error
    }
}

export async function extractOpenAILeadInfo(conversation: string) {
    const apiKey = await getOpenAIApiKey()
    if (!apiKey) return null

    const modelName = await getOpenAIModel()
    const openai = new OpenAI({ apiKey })

    const prompt = await getLeadExtractionPrompt()

    const fullPrompt = `
        ${prompt}

        CONVERSATION LOG:
        ${conversation}
    `

    try {
        const completion = await openai.chat.completions.create({
            model: modelName,
            messages: [
                { role: 'system', content: 'You are a JSON extraction engine.' },
                { role: 'user', content: fullPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
        })

        const content = completion.choices[0].message.content
        return content ? JSON.parse(content) : null
    } catch (error) {
        console.error('[OpenAI Extraction] Error:', error)
        return null
    }
}

export async function generateOpenAIChat(
    history: { role: string; content: string }[],
    message: string,
    systemPrompt: string
) {
    const apiKey = await getOpenAIApiKey()

    if (!apiKey) {
        throw new Error('OpenAI API Key não configurada. Configure na Sala de Manutenção.')
    }

    const modelName = await getOpenAIModel()
    console.log('[OpenAI Chat] Using model:', modelName)

    try {
        const openai = new OpenAI({ apiKey })

        // Map history to OpenAI format (user/assistant)
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
        console.error('[OpenAI Chat] Error:', error.message || error)
        throw error
    }
}
