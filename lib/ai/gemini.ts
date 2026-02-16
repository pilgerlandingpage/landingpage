import { GoogleGenerativeAI } from '@google/generative-ai'
import { getGeminiApiKey, getGeminiModel, getClonerPrompt, getLeadExtractionPrompt } from './config'

export async function generateGeminiLandingPage(htmlContent: string, customPrompt: string = '') {
  try {
    const apiKey = await getGeminiApiKey()
    if (!apiKey) throw new Error('Gemini API Key not configured in Admin Panel')

    const modelName = await getGeminiModel('cloner')
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: modelName })

    const masterPrompt = await getClonerPrompt()

    const prompt = `
        ${masterPrompt}

        CUSTOM PROMPT FROM ADMIN:
        "${customPrompt}"

        HTML CONTENT (Scraped):
        \`\`\`html
        ${htmlContent.substring(0, 30000)} 
        \`\`\`
        `
    // Truncate HTML to 30k chars to avoid token limits if necessary, though Gemini 1.5 has huge context.

    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text()

    // Clean up markdown code blocks if present
    const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim()

    return JSON.parse(jsonString)
  } catch (error) {
    console.error('Gemini Generation Error:', error)
    throw new Error('Failed to generate content with Gemini')
  }
}

export async function generateGeminiChat(history: { role: string; content: string }[], message: string, systemPrompt: string) {
  const apiKey = await getGeminiApiKey()
  if (!apiKey) throw new Error('Gemini API Key not configured. Configure em Admin > Manutenção.')

  const modelName = await getGeminiModel('concierge')
  console.log('[Gemini Chat] Using model:', modelName)

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt
    })

    const chat = model.startChat({
      history: (() => {
        // Gemini requires first message to be 'user', and alternating roles
        const mapped = (history || []).map(h => ({
          role: (h.role === 'user' ? 'user' : 'model') as 'user' | 'model',
          parts: [{ text: h.content }]
        }))
        // Drop leading 'model' messages (e.g. the initial AI greeting)
        while (mapped.length > 0 && mapped[0].role === 'model') {
          mapped.shift()
        }
        // Remove consecutive same-role messages (keep last of each run)
        return mapped.filter((msg, i, arr) =>
          i === arr.length - 1 || msg.role !== arr[i + 1].role
        )
      })()
    })

    const result = await chat.sendMessage(message)
    const response = result.response
    return response.text()
  } catch (error: any) {
    console.error('[Gemini Chat] Error details:', error?.message || error)
    console.error('[Gemini Chat] Model:', modelName, '| Key length:', apiKey?.length)
    throw error
  }
}

export async function extractGeminiLeadInfo(conversation: string) {
  try {
    const apiKey = await getGeminiApiKey()
    if (!apiKey) return null

    const modelName = await getGeminiModel() // Use same model or maybe a faster/cheaper one if preferred, but standardization is safer
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: 'application/json' }
    })

    const extractionPrompt = await getLeadExtractionPrompt()

    const prompt = `
        ${extractionPrompt}

        CONVERSATION LOG:
        ${conversation}
    `

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    console.log('[Gemini Extraction] Raw response:', text) // Debug log

    const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim()
    return JSON.parse(jsonString)
  } catch (error) {
    console.error('Gemini Extraction Error:', error)
    return null
  }
}
