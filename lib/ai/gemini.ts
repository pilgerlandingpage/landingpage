import { GoogleGenerativeAI } from '@google/generative-ai'
import { getGeminiApiKey, getAIConfig } from './config'
import { recordGeminiUsage } from './gemini-costs'
import { buildGeminiGenerationConfig } from './gemini-controls'

export async function generateGeminiChat(history: { role: string; content: string }[], message: string, systemPrompt: string, modelOverride?: string) {
  const apiKey = await getGeminiApiKey()
  if (!apiKey) throw new Error('Gemini API Key not configured. Configure em Admin > Manutenção.')

  const modelName = modelOverride || (await getAIConfig('gemini_model')) || 'gemini-2.5-flash'
  console.log('[Gemini Chat] Usando modelo:', modelName)

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
      generationConfig: buildGeminiGenerationConfig(modelName, {
        temperature: 0.7,
        maxOutputTokens: 900,
      }) as any,
    })

    const chat = model.startChat({
      history: (() => {
        const mapped = (history || []).map(h => ({
          role: (h.role === 'user' ? 'user' : 'model') as 'user' | 'model',
          parts: [{ text: h.content }]
        }))
        while (mapped.length > 0 && mapped[0].role === 'model') {
          mapped.shift()
        }
        return mapped.filter((msg, i, arr) =>
          i === arr.length - 1 || msg.role !== arr[i + 1].role
        )
      })()
    })

    const result = await chat.sendMessage(message)
    const response = result.response
    await recordGeminiUsage({
      model: modelName,
      feature: 'gemini_chat',
      usageMetadata: (response as any).usageMetadata || (result as any).response?.usageMetadata,
    })
    return response.text()
  } catch (error: any) {
    console.error('[Gemini Chat] Erro:', error?.message || error)
    console.error('[Gemini Chat] Modelo:', modelName, '| Key length:', apiKey?.length)
    throw error
  }
}

