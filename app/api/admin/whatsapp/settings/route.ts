import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEFAULT_CONFIG: Record<string, any> = {
    agent_enabled: true,
    always_online: true,
    mark_as_read: true,
    split_messages: true,
    mirror_mode: false,
    audio_response: true,
    audio_transcription: true,
    human_intervention: true,
    debounce_seconds: 15,
    human_intervention_minutes: 60,
}

// GET /api/admin/whatsapp/settings?instance_id=xxx
export async function GET(req: NextRequest) {
    try {
        const instanceId = req.nextUrl.searchParams.get('instance_id')

        if (instanceId) {
            // Per-instance config
            const { data, error } = await supabase
                .from('whatsapp_instances')
                .select('config')
                .eq('id', instanceId)
                .single()

            if (error) return NextResponse.json({ error: error.message }, { status: 400 })

            const config = { ...DEFAULT_CONFIG, ...(data?.config || {}) }
            return NextResponse.json({ settings: config, instance_id: instanceId })
        }

        // Fallback: return defaults (for global)
        return NextResponse.json({ settings: DEFAULT_CONFIG, instance_id: null })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}

// POST /api/admin/whatsapp/settings  { instance_id, settings }
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { instance_id, settings } = body

        if (!instance_id) {
            return NextResponse.json({ error: 'instance_id is required' }, { status: 400 })
        }

        // Merge with existing config
        const { data: existing } = await supabase
            .from('whatsapp_instances')
            .select('config')
            .eq('id', instance_id)
            .single()

        const mergedConfig = { ...(existing?.config || {}), ...settings }

        const { error } = await supabase
            .from('whatsapp_instances')
            .update({ config: mergedConfig, updated_at: new Date().toISOString() })
            .eq('id', instance_id)

        if (error) return NextResponse.json({ error: error.message }, { status: 400 })

        return NextResponse.json({ success: true, config: mergedConfig })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
