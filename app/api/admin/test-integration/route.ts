import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const { service, config } = await request.json()

        switch (service) {
            case 'connectyhub': {
                const apiUrl = config.connectyhub_api_url || process.env.CONNECTYHUB_API_URL
                const apiKey = config.connectyhub_api_key || process.env.CONNECTYHUB_API_KEY
                const instance = config.connectyhub_instance || process.env.CONNECTYHUB_INSTANCE

                if (!apiUrl || !apiKey || !instance) {
                    return NextResponse.json({
                        success: false,
                        message: 'Preencha todos os campos (URL, API Key, Instance)',
                    })
                }

                const res = await fetch(`${apiUrl}/instance/connectionState/${instance}`, {
                    headers: { apikey: apiKey },
                })

                if (!res.ok) {
                    const text = await res.text()
                    return NextResponse.json({
                        success: false,
                        message: `Erro ${res.status}: ${text.slice(0, 100)}`,
                    })
                }

                const data = await res.json()
                const state = data?.instance?.state || data?.state || 'unknown'
                return NextResponse.json({
                    success: true,
                    message: `Conectado! Estado: ${state}`,
                })
            }

            case 'gemini': {
                const apiKey = config.gemini_api_key || process.env.GEMINI_API_KEY

                if (!apiKey) {
                    return NextResponse.json({
                        success: false,
                        message: 'API Key do Gemini não configurada',
                    })
                }

                const res = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ role: 'user', parts: [{ text: 'Responda apenas: OK' }] }],
                            generationConfig: { temperature: 0, maxOutputTokens: 10 },
                        }),
                    }
                )

                if (!res.ok) {
                    const text = await res.text()
                    return NextResponse.json({
                        success: false,
                        message: `Erro ${res.status}: ${text.slice(0, 100)}`,
                    })
                }

                return NextResponse.json({
                    success: true,
                    message: 'API Gemini funcionando! Modelo: gemini-2.0-flash',
                })
            }

            case 'vapid': {
                const subject = config.vapid_subject || process.env.VAPID_SUBJECT
                const publicKey = config.vapid_public_key || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
                const privateKey = config.vapid_private_key || process.env.VAPID_PRIVATE_KEY

                if (!subject || !publicKey || !privateKey) {
                    return NextResponse.json({
                        success: false,
                        message: 'Preencha todos os campos (Subject, Public Key, Private Key)',
                    })
                }

                // Validate format
                if (!subject.startsWith('mailto:')) {
                    return NextResponse.json({
                        success: false,
                        message: 'Subject deve começar com "mailto:"',
                    })
                }

                if (publicKey.length < 40 || privateKey.length < 20) {
                    return NextResponse.json({
                        success: false,
                        message: 'Formato das chaves VAPID parecem inválidos',
                    })
                }

                // Try to import web-push and validate keys
                try {
                    const webpush = await import('web-push')
                    webpush.default.setVapidDetails(subject, publicKey, privateKey)
                    return NextResponse.json({
                        success: true,
                        message: 'Chaves VAPID válidas e configuradas!',
                    })
                } catch (err) {
                    return NextResponse.json({
                        success: false,
                        message: `Chaves VAPID inválidas: ${String(err).slice(0, 100)}`,
                    })
                }
            }

            default:
                return NextResponse.json({
                    success: false,
                    message: `Serviço desconhecido: ${service}`,
                })
        }
    } catch (error) {
        console.error('Test integration error:', error)
        return NextResponse.json({
            success: false,
            message: 'Erro interno ao testar conexão',
        }, { status: 500 })
    }
}
