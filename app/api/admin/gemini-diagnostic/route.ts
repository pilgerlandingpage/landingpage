import { NextResponse } from 'next/server'
import { listAvailableModels, getGeminiModel, getGeminiApiKey } from '@/lib/gemini'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export async function GET() {
    try {
        const currentModel = await getGeminiModel()
        const models = await listAvailableModels()

        // Test each model that supports generateContent
        const results = await Promise.all(
            models.map(async (model) => {
                const supportsGenerate = model.supportedGenerationMethods.includes('generateContent')

                if (!supportsGenerate) {
                    return {
                        ...model,
                        testStatus: 'not_supported' as const,
                        testMessage: 'Não suporta generateContent',
                        isCurrentModel: false,
                    }
                }

                // Quick test with the model
                try {
                    const apiKey = await getGeminiApiKey()
                    if (!apiKey) throw new Error('No API key')

                    const modelId = model.name.replace('models/', '')
                    const res = await fetch(
                        `${GEMINI_API_BASE}/models/${modelId}:generateContent?key=${apiKey}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{ role: 'user', parts: [{ text: 'Responda apenas: OK' }] }],
                                generationConfig: { temperature: 0, maxOutputTokens: 5 },
                            }),
                        }
                    )

                    if (res.ok) {
                        return {
                            ...model,
                            testStatus: 'available' as const,
                            testMessage: 'Modelo funcionando',
                            isCurrentModel: modelId === currentModel,
                        }
                    }

                    const errText = await res.text()
                    let errorMsg = `Erro ${res.status}`
                    try {
                        const errJson = JSON.parse(errText)
                        errorMsg = errJson?.error?.message || errorMsg
                    } catch { /* use raw */ }

                    return {
                        ...model,
                        testStatus: 'error' as const,
                        testMessage: errorMsg.slice(0, 200),
                        isCurrentModel: modelId === currentModel,
                    }
                } catch (err) {
                    return {
                        ...model,
                        testStatus: 'error' as const,
                        testMessage: String(err).slice(0, 200),
                        isCurrentModel: false,
                    }
                }
            })
        )

        // Sort: current model first, then available, then errors, then not_supported
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
        console.error('Gemini diagnostic error:', error)
        return NextResponse.json(
            {
                success: false,
                message: String(error).slice(0, 300),
                summary: null,
                models: [],
            },
            { status: 500 }
        )
    }
}
