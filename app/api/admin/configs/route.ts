import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
    LEAD_EXTRACTION_PROMPT,
    PILGER_AI_PROMPT,
    PILGER_AI_RULES_PROMPT,
    ADS_ANALYSIS_SYSTEM_PROMPT,
    DAILY_REPORT_PROMPT,
    WEEKLY_REPORT_PROMPT,
    CEO_AGENT_SYSTEM_PROMPT,
} from '@/lib/ai/prompts'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

const ENV_FALLBACKS: Record<string, string> = {
    uazapi_base_url: 'UAZAPI_BASE_URL',
    uazapi_admin_token: 'UAZAPI_ADMIN_TOKEN',
    gemini_api_key: 'GEMINI_API_KEY',
    gemini_model: '',
    vapid_subject: 'VAPID_SUBJECT',
    vapid_public_key: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
    vapid_private_key: 'VAPID_PRIVATE_KEY',
    google_ads_manager_id: 'GOOGLE_ADS_MANAGER_ID',
    google_ads_customer_id: 'GOOGLE_ADS_CUSTOMER_ID',
    serpapi_api_key: 'SERPAPI_API_KEY',
    dataforseo_login: 'DATAFORSEO_LOGIN',
    dataforseo_password: 'DATAFORSEO_PASSWORD',
}

const DEFAULT_PROMPTS: Record<string, string> = {
    pilger_ai_system_prompt: PILGER_AI_PROMPT,
    pilger_ai_rules_prompt: PILGER_AI_RULES_PROMPT,
    lead_extraction_prompt: LEAD_EXTRACTION_PROMPT,
    ads_analyst_system_prompt: ADS_ANALYSIS_SYSTEM_PROMPT,
    pilger_daily_system_prompt: DAILY_REPORT_PROMPT,
    pilger_weekly_system_prompt: WEEKLY_REPORT_PROMPT,
    ceo_agent_system_prompt: CEO_AGENT_SYSTEM_PROMPT,
}

export async function GET() {
    try {
        const supabase = getSupabase()
        const { data, error } = await supabase
            .from('app_config')
            .select('key, value')

        if (error) {
            return NextResponse.json({ success: false, message: error.message }, { status: 500 })
        }

        const existingKeys = new Set((data || []).map((item: { key: string }) => item.key))
        const missingPromptEntries = Object.entries(DEFAULT_PROMPTS)
            .filter(([key]) => !existingKeys.has(key))
            .map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }))

        if (missingPromptEntries.length > 0) {
            await supabase.from('app_config').upsert(missingPromptEntries, { onConflict: 'key' })
        }

        const { data: finalData, error: finalError } = await supabase
            .from('app_config')
            .select('key, value')

        if (finalError) {
            return NextResponse.json({ success: false, message: finalError.message }, { status: 500 })
        }

        const configMap: Record<string, string> = {}
        for (const [configKey, envName] of Object.entries(ENV_FALLBACKS)) {
            const envVal = process.env[envName]
            if (envVal) configMap[configKey] = envVal
        }

        finalData?.forEach((item: { key: string; value: string }) => {
            if (item.value) configMap[item.key] = item.value
        })

        return NextResponse.json({ success: true, configs: configMap })
    } catch (error) {
        console.error('Config load error:', error)
        return NextResponse.json({ success: false, message: 'Erro ao carregar configurações' }, { status: 500 })
    }
}

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
