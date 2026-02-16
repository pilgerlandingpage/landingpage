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

        const res = await fetch('https://api.openai.com/v1/models', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            }
        })

        if (!res.ok) {
            const error = await res.json()
            return NextResponse.json({
                success: false,
                message: `Erro OpenAI: ${error.error?.message || res.statusText}`,
            })
        }

        const data = await res.json()

        // Filter for chat models (gpt-*)
        const models = data.data
            .filter((m: any) => m.id.startsWith('gpt-'))
            .map((m: any) => ({
                id: m.id,
                name: m.id,
                description: `Created: ${new Date(m.created * 1000).toLocaleDateString()}`
            }))
            .sort((a: any, b: any) => b.id.localeCompare(a.id)) // rough sort by newness

        return NextResponse.json({
            success: true,
            models,
        })

    } catch (error) {
        console.error('Error fetching OpenAI models:', error)
        return NextResponse.json({
            success: false,
            message: 'Erro interno ao buscar modelos OpenAI',
        }, { status: 500 })
    }
}
