import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

/**
 * POST — Fetch available voices from ElevenLabs account
 * Returns both pre-made and cloned voices
 */
export async function POST(request: NextRequest) {
    try {
        const { apiKey: bodyApiKey } = await request.json().catch(() => ({ apiKey: null }))

        // Get API key from body or from DB config
        let apiKey = bodyApiKey
        if (!apiKey) {
            const supabase = getSupabase()
            const { data } = await supabase
                .from('app_config')
                .select('value')
                .eq('key', 'elevenlabs_api_key')
                .single()
            apiKey = data?.value
        }

        if (!apiKey) {
            return NextResponse.json({
                success: false,
                message: 'ElevenLabs API key não configurada'
            }, { status: 400 })
        }

        const res = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: { 'xi-api-key': apiKey }
        })

        if (!res.ok) {
            const errText = await res.text()
            return NextResponse.json({
                success: false,
                message: `Erro ElevenLabs: ${res.status} - ${errText}`
            }, { status: res.status })
        }

        const data = await res.json()
        const voices = (data.voices || []).map((v: any) => ({
            voice_id: v.voice_id,
            name: v.name,
            category: v.category || 'premade', // premade, cloned, professional
            preview_url: v.preview_url,
            labels: v.labels || {},
            description: v.description,
        }))

        // Sort: cloned first, then by name
        voices.sort((a: any, b: any) => {
            if (a.category === 'cloned' && b.category !== 'cloned') return -1
            if (a.category !== 'cloned' && b.category === 'cloned') return 1
            return a.name.localeCompare(b.name)
        })

        return NextResponse.json({ success: true, voices })
    } catch (error) {
        console.error('[ElevenLabs Voices Error]', error)
        return NextResponse.json({
            success: false,
            message: `Erro: ${error instanceof Error ? error.message : String(error)}`
        }, { status: 500 })
    }
}
