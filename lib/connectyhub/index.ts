interface SendMessageOptions {
    phone: string
    message: string
    instanceName?: string
    apiKey?: string
    apiUrl?: string
}

interface ConnectyHubConfig {
    apiUrl: string
    apiKey: string
    instance: string
}

export async function getConnectyHubConfig(): Promise<ConnectyHubConfig> {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', ['connectyhub_api_url', 'connectyhub_api_key', 'connectyhub_instance'])

    const config: Record<string, string> = {}
    data?.forEach((row: { key: string; value: string }) => {
        config[row.key] = row.value
    })

    return {
        apiUrl: config.connectyhub_api_url || process.env.CONNECTYHUB_API_URL || '',
        apiKey: config.connectyhub_api_key || process.env.CONNECTYHUB_API_KEY || '',
        instance: config.connectyhub_instance || process.env.CONNECTYHUB_INSTANCE || '',
    }
}

export async function sendWhatsAppMessage({ phone, message, instanceName, apiKey, apiUrl }: SendMessageOptions) {
    const config = await getConnectyHubConfig()
    const instance = instanceName || config.instance
    const baseUrl = apiUrl || config.apiUrl

    let cleanPhone = phone.replace(/\D/g, '')

    // Auto-prepend Brazil country code '55' if it's missing (10 or 11 digits)
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
        cleanPhone = `55${cleanPhone}`
    }

    const response = await fetch(`${baseUrl}/message/sendText/${instance}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': apiKey || config.apiKey,
        },
        body: JSON.stringify({
            number: cleanPhone,
            text: message,
        }),
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`ConnectyHub error: ${error}`)
    }

    return response.json()
}

export function interpolateTemplate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || `{{${key}}}`)
}
