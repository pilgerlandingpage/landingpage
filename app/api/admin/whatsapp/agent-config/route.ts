import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// Keys that this endpoint manages
const AGENT_CONFIG_KEYS = [
    'agent_company_name',
    'agent_company_creci',
    'agent_company_phone',
    'agent_company_description',
    'agent_social_instagram',
    'agent_social_facebook',
    'agent_social_youtube',
    'agent_social_linkedin',
    'agent_social_tiktok',
    'agent_social_site',
    'agent_company_address',
    'agent_company_maps_link',
    'agent_company_latitude',
    'agent_company_longitude',
    'agent_working_hours',
    'agent_regions',
    'agent_required_documents',
    'agent_transfer_message_lead',
    'agent_transfer_message_broker',
    'agent_tone',
    'agent_transfer_lock_minutes',
    'agent_transfer_score_threshold',
]

// GET — Load all agent config values
export async function GET() {
    try {
        const supabase = getSupabase()
        const { data, error } = await supabase
            .from('app_config')
            .select('key, value')
            .in('key', AGENT_CONFIG_KEYS)

        if (error) throw error

        // Convert array to object
        const config: Record<string, string> = {}
        for (const row of (data || [])) {
            config[row.key] = row.value
        }

        return NextResponse.json({ success: true, config })
    } catch (error) {
        console.error('[Agent Config] GET error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}

// POST — Save agent config values
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const { config } = await request.json()

        if (!config || typeof config !== 'object') {
            return NextResponse.json({ success: false, error: 'Config object required' }, { status: 400 })
        }

        // Upsert each config key
        const upserts = Object.entries(config)
            .filter(([key]) => AGENT_CONFIG_KEYS.includes(key))
            .map(([key, value]) => ({
                key,
                value: typeof value === 'string' ? value : JSON.stringify(value),
            }))

        if (upserts.length === 0) {
            return NextResponse.json({ success: false, error: 'No valid config keys' }, { status: 400 })
        }

        const { error } = await supabase
            .from('app_config')
            .upsert(upserts, { onConflict: 'key' })

        if (error) throw error

        return NextResponse.json({ success: true, saved: upserts.length })
    } catch (error) {
        console.error('[Agent Config] POST error:', error)
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
    }
}
