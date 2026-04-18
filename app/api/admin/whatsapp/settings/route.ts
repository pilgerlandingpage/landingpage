import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { configurePrivacy, setPresenceAvailable, setPresenceUnavailable } from '@/lib/uazapi'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEFAULT_CONFIG: Record<string, any> = {
    agent_enabled: true,
    always_online: true,
    mark_as_read: true,
    response_mode: 'mirror', // text | audio | mirror
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
            .select('config, instance_token')
            .eq('id', instance_id)
            .single()

        const mergedConfig = { ...(existing?.config || {}), ...settings }

        // Normalize response strategy and keep legacy flags in sync.
        const mode = mergedConfig.response_mode
        if (mode === 'text') {
            mergedConfig.audio_response = false
            mergedConfig.mirror_mode = false
        } else if (mode === 'audio') {
            mergedConfig.audio_response = true
            mergedConfig.mirror_mode = false
        } else if (mode === 'mirror') {
            mergedConfig.audio_response = true
            mergedConfig.mirror_mode = true
        } else {
            mergedConfig.response_mode = mergedConfig.mirror_mode ? 'mirror' : (mergedConfig.audio_response ? 'audio' : 'text')
        }

        const { error } = await supabase
            .from('whatsapp_instances')
            .update({ config: mergedConfig, updated_at: new Date().toISOString() })
            .eq('id', instance_id)

        if (error) return NextResponse.json({ error: error.message }, { status: 400 })

        // Sync WhatsApp privacy settings so "online" and "read receipts"
        // in the phone app match the toggles configured in admin panel.
        const instanceToken = existing?.instance_token
        if (instanceToken) {
            await configurePrivacy({
                readreceipts: mergedConfig.mark_as_read === false ? 'none' : 'all',
                online: mergedConfig.always_online === false ? 'match_last_seen' : 'all',
            }, instanceToken).catch((privacyErr) => {
                console.warn('[WhatsApp Settings] Privacy sync failed:', privacyErr)
            })

            // Apply current presence immediately so UI toggle effect is visible without waiting cron.
            if (mergedConfig.always_online === false || mergedConfig.always_online === 'false') {
                await setPresenceUnavailable(instanceToken).catch((presenceErr) => {
                    console.warn('[WhatsApp Settings] Presence unavailable failed:', presenceErr)
                })
            } else {
                await setPresenceAvailable(instanceToken).catch((presenceErr) => {
                    console.warn('[WhatsApp Settings] Presence available failed:', presenceErr)
                })
            }
        }

        return NextResponse.json({ success: true, config: mergedConfig })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
