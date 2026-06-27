import { createClient } from '@supabase/supabase-js'

export interface ConnectyHubConfig {
    apiUrl: string
    apiToken: string
    webhookSecret: string
    webhookUrl: string
}

const CONFIG_ENV_MAP: Record<keyof ConnectyHubConfig, { key: string; env: string }> = {
    apiUrl: { key: 'connectyhub_api_url', env: 'CONNECTYHUB_API_URL' },
    apiToken: { key: 'connectyhub_api_token', env: 'CONNECTYHUB_API_TOKEN' },
    webhookSecret: { key: 'connectyhub_webhook_secret', env: 'CONNECTYHUB_WEBHOOK_SECRET' },
    webhookUrl: { key: 'connectyhub_webhook_url', env: 'CONNECTYHUB_WEBHOOK_URL' },
}

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function cleanUrl(value: string) {
    return value.trim().replace(/\/+$/, '')
}

export async function getConnectyHubConfig(): Promise<ConnectyHubConfig> {
    const config: Record<string, string> = {}

    for (const item of Object.values(CONFIG_ENV_MAP)) {
        const envValue = process.env[item.env]
        if (envValue?.trim()) config[item.key] = envValue.trim()
    }

    try {
        const supabase = getSupabase()
        const { data } = await supabase
            .from('app_config')
            .select('key, value')
            .in('key', Object.values(CONFIG_ENV_MAP).map(item => item.key))

        data?.forEach((row: { key: string; value: string }) => {
            if (row.value?.trim()) config[row.key] = row.value.trim()
        })
    } catch (error) {
        console.warn('[ConnectyHub] Falha ao carregar app_config, usando env como fallback:', error)
    }

    return {
        apiUrl: config.connectyhub_api_url ? cleanUrl(config.connectyhub_api_url) : '',
        apiToken: config.connectyhub_api_token || '',
        webhookSecret: config.connectyhub_webhook_secret || '',
        webhookUrl: config.connectyhub_webhook_url ? cleanUrl(config.connectyhub_webhook_url) : '',
    }
}

export async function resolveConnectyHubWebhookUrl(fallbackOrigin?: string) {
    const config = await getConnectyHubConfig()
    if (config.webhookUrl) return config.webhookUrl

    const origin = fallbackOrigin ? cleanUrl(fallbackOrigin) : ''
    return origin ? `${origin}/api/webhooks/connectyhub` : ''
}

export async function saveConnectyHubWebhookSecretIfMissing(secret: string) {
    const value = secret.trim()
    if (!value) return false

    const current = await getConnectyHubConfig()
    if (current.webhookSecret) return false

    const supabase = getSupabase()
    const { error } = await supabase
        .from('app_config')
        .upsert({
            key: CONFIG_ENV_MAP.webhookSecret.key,
            value,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })

    if (error) {
        console.warn('[ConnectyHub] Falha ao salvar webhook secret gerado:', error.message)
        return false
    }

    return true
}
