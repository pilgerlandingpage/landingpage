import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// Map config keys → environment variable names
const ENV_FALLBACKS: Record<string, string> = {
    connectyhub_api_url: 'CONNECTYHUB_API_URL',
    connectyhub_api_key: 'CONNECTYHUB_API_KEY',
    connectyhub_instance: 'CONNECTYHUB_INSTANCE',
    gemini_api_key: 'GEMINI_API_KEY',
    gemini_model: '',  // no env var, default handled in lib
    vapid_subject: 'VAPID_SUBJECT',
    vapid_public_key: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
    vapid_private_key: 'VAPID_PRIVATE_KEY',
}

// GET — Load all configs (database values override env vars)
export async function GET() {
    try {
        const supabase = getSupabase()
        const { data, error } = await supabase
            .from('app_config')
            .select('key, value')

        if (error) {
            return NextResponse.json({ success: false, message: error.message }, { status: 500 })
        }

        // Start with env var fallbacks
        const configMap: Record<string, string> = {}
        for (const [configKey, envName] of Object.entries(ENV_FALLBACKS)) {
            const envVal = process.env[envName]
            if (envVal) configMap[configKey] = envVal
        }

        // Override with database values (DB has priority)
        data?.forEach((item: { key: string; value: string }) => {
            if (item.value) configMap[item.key] = item.value
        })

        return NextResponse.json({ success: true, configs: configMap })
    } catch (error) {
        console.error('Config load error:', error)
        return NextResponse.json({ success: false, message: 'Erro ao carregar configurações' }, { status: 500 })
    }
}

// POST — Save configs
export async function POST(request: NextRequest) {
    try {
        const { configs } = await request.json() as { configs: Record<string, string> }
        const supabase = getSupabase()

        const results: { key: string; success: boolean; error?: string }[] = []

        for (const [key, value] of Object.entries(configs)) {
            const { error } = await supabase
                .from('app_config')
                .upsert(
                    { key, value, updated_at: new Date().toISOString() },
                    { onConflict: 'key' }
                )

            results.push({
                key,
                success: !error,
                error: error?.message,
            })
        }

        const allSuccess = results.every(r => r.success)
        return NextResponse.json({
            success: allSuccess,
            message: allSuccess ? 'Configurações salvas!' : 'Alguns itens falharam',
            results,
        })
    } catch (error) {
        console.error('Config save error:', error)
        return NextResponse.json({ success: false, message: 'Erro ao salvar configurações' }, { status: 500 })
    }
}
