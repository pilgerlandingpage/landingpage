import { NextRequest, NextResponse } from 'next/server'
import { getConciergeProvider, getOpenAIApiKey, getGeminiApiKey } from '@/lib/ai/config'
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI, { toFile } from 'openai'

export const maxDuration = 30

export async function POST(req: NextRequest) {
    try {
        // Support both FormData (file upload) and JSON (R2 URL)
        const contentType = req.headers.get('content-type') || ''
        let audioBuffer: Buffer
        let mimeType = 'audio/webm'

        if (contentType.includes('application/json')) {
            // Receive R2 URL and download the audio from there
            const body = await req.json()
            const audioUrl = body.audioUrl

            if (!audioUrl) {
                return NextResponse.json({ error: 'No audio URL provided' }, { status: 400 })
            }

            console.log('[Transcribe] Downloading audio from R2:', audioUrl)
            const audioRes = await fetch(audioUrl)
            if (!audioRes.ok) {
                console.error('[Transcribe] R2 download failed:', audioRes.status, audioRes.statusText)
                return NextResponse.json({ error: 'Failed to download audio from R2' }, { status: 500 })
            }
            audioBuffer = Buffer.from(await audioRes.arrayBuffer())
            const r2ContentType = audioRes.headers.get('content-type')?.split(';')[0] || ''
            // R2 often returns application/octet-stream — keep our default 'audio/webm' in that case
            if (r2ContentType && r2ContentType.startsWith('audio/')) {
                mimeType = r2ContentType
            }
            console.log('[Transcribe] R2 content-type header:', r2ContentType, '| Using MIME:', mimeType)
        } else {
            // FormData upload (preferred — raw blob from browser)
            const formData = await req.formData()
            const audioFile = formData.get('audio') as File

            if (!audioFile) {
                return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
            }

            audioBuffer = Buffer.from(await audioFile.arrayBuffer())
            mimeType = (audioFile.type || 'audio/webm').split(';')[0]
            console.log('[Transcribe] FormData file type:', audioFile.type, '| name:', audioFile.name, '| size:', audioFile.size)
        }

        console.log('[Transcribe] Audio size:', audioBuffer.length, 'bytes | MIME:', mimeType)

        if (audioBuffer.length < 500) {
            return NextResponse.json({ error: 'Audio too short' }, { status: 422 })
        }

        // Use the SAME provider configured in Admin Panel for the concierge (text + audio)
        const configuredProvider = await getConciergeProvider()
        const openaiKey = await getOpenAIApiKey()
        const geminiKey = await getGeminiApiKey()
        console.log('[Transcribe] Admin provider:', configuredProvider, '| Keys — OpenAI:', !!openaiKey, '| Gemini:', !!geminiKey)

        let text = ''
        let lastError = ''

        // Try the admin-configured provider first
        if (configuredProvider === 'openai' && openaiKey) {
            try {
                console.log('[Transcribe] Attempting OpenAI Whisper (configured)...')
                text = await transcribeWithOpenAI(audioBuffer, mimeType)
                console.log('[Transcribe] OpenAI result:', text ? `"${text.substring(0, 60)}..."` : '(empty)')
            } catch (err: any) {
                console.error('[Transcribe] OpenAI failed:', err.message)
                lastError = err.message
                text = ''
            }
            // Fallback to Gemini if OpenAI failed
            if (!text.trim() && geminiKey) {
                try {
                    console.log('[Transcribe] Falling back to Gemini...')
                    text = await transcribeWithGemini(audioBuffer, mimeType)
                    console.log('[Transcribe] Gemini fallback result:', text ? `"${text.substring(0, 60)}..."` : '(empty)')
                } catch (err: any) {
                    console.error('[Transcribe] Gemini fallback also failed:', err.message)
                    lastError += ' | Gemini: ' + err.message
                }
            }
        } else {
            // Gemini is configured (or default)
            if (geminiKey) {
                try {
                    console.log('[Transcribe] Attempting Gemini (configured)...')
                    text = await transcribeWithGemini(audioBuffer, mimeType)
                    console.log('[Transcribe] Gemini result:', text ? `"${text.substring(0, 60)}..."` : '(empty)')
                } catch (err: any) {
                    console.error('[Transcribe] Gemini failed:', err.message)
                    lastError = err.message
                    text = ''
                }
            }
            // Fallback to OpenAI Whisper if Gemini failed
            if (!text.trim() && openaiKey) {
                try {
                    console.log('[Transcribe] Falling back to OpenAI Whisper...')
                    text = await transcribeWithOpenAI(audioBuffer, mimeType)
                    console.log('[Transcribe] OpenAI fallback result:', text ? `"${text.substring(0, 60)}..."` : '(empty)')
                } catch (err: any) {
                    console.error('[Transcribe] OpenAI fallback also failed:', err.message)
                    lastError += ' | OpenAI: ' + err.message
                }
            }
        }

        if (!text.trim()) {
            console.log('[Transcribe] All providers returned empty — returning 422. Last error:', lastError)
            return NextResponse.json({ error: 'Could not transcribe audio', details: lastError }, { status: 422 })
        }

        console.log('[Transcribe] Success:', text.substring(0, 80) + (text.length > 80 ? '...' : ''))
        return NextResponse.json({ text })

    } catch (error: any) {
        console.error('[Transcribe] Error:', error.message || error)
        console.error('[Transcribe] Stack:', error.stack)
        return NextResponse.json({ error: 'Transcription failed', details: error.message }, { status: 500 })
    }
}

// ── OpenAI Whisper ──────────────────────────────────────────────
async function transcribeWithOpenAI(audioBuffer: Buffer, mimeType: string): Promise<string> {
    const apiKey = await getOpenAIApiKey()
    if (!apiKey) throw new Error('OpenAI API key not configured')

    const openai = new OpenAI({ apiKey })

    // Determine correct extension from MIME type
    const mimeToExt: Record<string, string> = {
        'audio/webm': 'webm',
        'audio/mp4': 'mp4',
        'audio/ogg': 'ogg',
        'audio/wav': 'wav',
        'audio/mpeg': 'mp3',
    }
    const ext = mimeToExt[mimeType] || 'webm'

    // Use OpenAI SDK's toFile() to create a proper uploadable file
    const uploadableFile = await toFile(audioBuffer, `voice.${ext}`, { type: mimeType })

    console.log('[Transcribe/OpenAI] Sending file:', `voice.${ext}`, '| Buffer size:', audioBuffer.length, '| Key prefix:', apiKey.substring(0, 8))

    const response = await openai.audio.transcriptions.create({
        model: 'whisper-1',
        file: uploadableFile,
        language: 'pt',
        prompt: 'Deixe uma mensagem de voz em português dizendo o que você deseja.',
        temperature: 0,
    })

    let transcribedText = response.text || ''

    // Filter out common hallucinations when the audio is mostly silence
    const lowerText = transcribedText.toLowerCase().trim()
    if (
        lowerText.includes('amara.org') ||
        lowerText === 'obrigado.' ||
        lowerText === 'obrigada.' ||
        lowerText === 'obrigado' ||
        lowerText === 'obrigada' ||
        lowerText === 'obrigado por assistir!' ||
        lowerText === 'legendas pela comunidade amara.org'
    ) {
        console.log('[Transcribe/OpenAI] Silence hallucination detected, clearing text.')
        transcribedText = ''
    }

    return transcribedText
}

// ── Google Gemini ───────────────────────────────────────────────
async function transcribeWithGemini(audioBuffer: Buffer, mimeType: string): Promise<string> {
    const apiKey = await getGeminiApiKey()
    if (!apiKey) throw new Error('Gemini API key not configured')

    const base64Audio = audioBuffer.toString('base64')

    const genAI = new GoogleGenerativeAI(apiKey)
    // Use gemini-1.5-flash for transcription — gemini-2.0-flash has 0 free tier quota
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const result = await model.generateContent([
        {
            inlineData: {
                mimeType,
                data: base64Audio,
            },
        },
        {
            text: 'Transcreva este áudio em português brasileiro. Retorne APENAS o texto transcrito, sem nenhuma formatação, explicação ou comentário adicional. Se não conseguir entender o áudio, retorne uma string vazia.',
        },
    ])

    let transcribedText = result.response.text()?.trim() || ''

    // Filter out common hallucinations
    const lowerText = transcribedText.toLowerCase()
    if (
        lowerText.includes('amara.org') ||
        lowerText === 'obrigado.' ||
        lowerText === 'obrigada.' ||
        lowerText === 'obrigado' ||
        lowerText === 'obrigada' ||
        lowerText === 'obrigado por assistir!'
    ) {
        console.log('[Transcribe/Gemini] Silence hallucination detected, clearing text.')
        transcribedText = ''
    }

    return transcribedText
}
