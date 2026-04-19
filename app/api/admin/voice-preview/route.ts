import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

async function loadConfigMap() {
    const supabase = getSupabase()
    const { data } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', ['openai_api_key', 'elevenlabs_api_key', 'whatsapp_tts_voice'])

    const cfg: Record<string, string> = {}
    for (const row of data || []) cfg[row.key] = row.value
    return cfg
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const voiceIdRaw = String(body?.voiceId || '').trim()
        const text = String(body?.text || 'Olá! Esta é uma prévia da minha voz para atendimento no WhatsApp.').trim()

        const cfg = await loadConfigMap()
        let voiceId = voiceIdRaw || cfg['whatsapp_tts_voice'] || ''
        if (!voiceId) {
            return NextResponse.json({ success: false, error: 'Selecione uma voz para ouvir a prévia.' }, { status: 400 })
        }

        const isOpenAI = voiceId.startsWith('openai:')
        if (isOpenAI) {
            const apiKey = cfg['openai_api_key']
            if (!apiKey) {
                return NextResponse.json({ success: false, error: 'OpenAI API key não configurada.' }, { status: 400 })
            }
            const voice = voiceId.replace('openai:', '') || 'onyx'
            const res = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'tts-1',
                    voice,
                    input: text,
                    response_format: 'mp3',
                }),
            })
            if (!res.ok) {
                const err = await res.text()
                return NextResponse.json({ success: false, error: `Falha OpenAI TTS: ${err}` }, { status: 500 })
            }
            const audio = Buffer.from(await res.arrayBuffer())
            return new NextResponse(audio, {
                headers: {
                    'Content-Type': 'audio/mpeg',
                    'Cache-Control': 'no-store',
                },
            })
        }

        const elevenKey = cfg['elevenlabs_api_key']
        if (!elevenKey) {
            return NextResponse.json({ success: false, error: 'ElevenLabs API key não configurada.' }, { status: 400 })
        }

        const elRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'xi-api-key': elevenKey,
                'Content-Type': 'application/json',
                Accept: 'audio/mpeg',
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: { stability: 0.5, similarity_boost: 0.75 },
            }),
        })

        if (!elRes.ok) {
            const err = await elRes.text()
            return NextResponse.json({ success: false, error: `Falha ElevenLabs TTS: ${err}` }, { status: 500 })
        }

        const audio = Buffer.from(await elRes.arrayBuffer())
        return new NextResponse(audio, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'no-store',
            },
        })
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

