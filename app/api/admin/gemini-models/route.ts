import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const { apiKey } = await request.json()

        if (!apiKey) {
            return NextResponse.json({
                success: false,
                message: 'API Key é obrigatória',
            })
        }

        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
            {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            }
        )

        if (!res.ok) {
            const text = await res.text()
            return NextResponse.json({
                success: false,
                message: `Erro ao buscar modelos: ${text.slice(0, 100)}`,
            })
        }

        const data = await res.json()

        // Filter for models that support content generation and are stable or latest
        const models = data.models
            ?.filter((m: any) =>
                m.supportedGenerationMethods?.includes('generateContent')
            )
            .map((m: any) => ({
                id: m.name.replace('models/', ''), // remove prefix for cleaner ID
                name: m.displayName,
                description: m.description
            })) || []

        return NextResponse.json({
            success: true,
            models,
        })

    } catch (error) {
        console.error('Error fetching Gemini models:', error)
        return NextResponse.json({
            success: false,
            message: 'Erro interno ao buscar modelos',
        }, { status: 500 })
    }
}
