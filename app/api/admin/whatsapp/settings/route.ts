import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

const SETTINGS_KEYS = [
    'whatsapp_always_online',
    'whatsapp_mark_as_read',
    'whatsapp_audio_enabled',
    'whatsapp_transcription_enabled',
    'whatsapp_human_intervention',
    'whatsapp_human_intervention_minutes',
    'whatsapp_mirror_mode',
    'whatsapp_agent_enabled',
    'whatsapp_split_messages',
    'whatsapp_debounce_seconds',
]

const DEFAULTS: Record<string, string> = {
    whatsapp_always_online: 'true',
    whatsapp_mark_as_read: 'true',
    whatsapp_audio_enabled: 'true',
    whatsapp_transcription_enabled: 'true',
    whatsapp_human_intervention: 'true',
    whatsapp_human_intervention_minutes: '60',
    whatsapp_mirror_mode: 'true',
    whatsapp_agent_enabled: 'true',
    whatsapp_split_messages: 'true',
    whatsapp_debounce_seconds: '15',
}

// GET — Load all settings
export async function GET() {
    try {
        const supabase = getSupabase()
        const { data } = await supabase
            .from('app_config')
            .select('key, value')
            .in('key', SETTINGS_KEYS)

        const settings: Record<string, string> = { ...DEFAULTS }
        data?.forEach((row: any) => {
            settings[row.key] = row.value
        })

        return NextResponse.json({ success: true, settings })
    } catch (error) {
        console.error('[Settings] GET error:', error)
        return NextResponse.json({ success: false, message: 'Erro ao carregar configurações' }, { status: 500 })
    }
}

// POST — Save settings
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const supabase = getSupabase()
        const now = new Date().toISOString()

        const upserts = SETTINGS_KEYS
            .filter(key => body[key] !== undefined)
            .map(key => ({
                key,
                value: String(body[key]),
                updated_at: now,
            }))

        if (upserts.length > 0) {
            const { error } = await supabase
                .from('app_config')
                .upsert(upserts, { onConflict: 'key' })

            if (error) {
                console.error('[Settings] Upsert error:', error)
                return NextResponse.json({ success: false, message: error.message }, { status: 500 })
            }
        }

        return NextResponse.json({ success: true, saved: upserts.length })
    } catch (error) {
        console.error('[Settings] POST error:', error)
        return NextResponse.json({ success: false, message: 'Erro ao salvar configurações' }, { status: 500 })
    }
}
