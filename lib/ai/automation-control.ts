import { createAdminClient } from '@/lib/supabase/server'

export const AI_TOKEN_AUTOMATION_PAUSE_KEY = 'ai_token_automation_pause_active'

type SupabaseAdminLike = {
    from: (table: string) => any
}

export type AiAutomationGate = {
    allowed: boolean
    reason: string
    paused: boolean
    enabled: boolean
    agentId: string
    enabledKey?: string
}

const WHATSAPP_ATTENDANCE_AGENT_IDS = new Set([
    'whatsapp-agent',
    'whatsapp-global-agent',
    'whatsapp-lead-extraction',
    'whatsapp-attendance-coach',
    'whatsapp-rescue-agent',
    'whatsapp-followup-agent',
    'pilger-global-whatsapp',
])

export function isWhatsAppAttendanceAgent(agentId: string) {
    return WHATSAPP_ATTENDANCE_AGENT_IDS.has(agentId)
}

async function readConfigValues(supabase: SupabaseAdminLike, keys: string[]) {
    const uniqueKeys = [...new Set(keys.filter(Boolean))]
    if (uniqueKeys.length === 0) return {}

    const { data, error } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', uniqueKeys)

    if (error) throw new Error(`Erro ao ler trava de IA: ${error.message}`)

    return Object.fromEntries(
        (data || []).map((row: { key: string; value: string | null }) => [row.key, String(row.value || '')])
    ) as Record<string, string>
}

export async function getAiAutomationGate(params: {
    agentId: string
    enabledKey?: string
    defaultEnabled?: boolean
    allowDuringTokenPause?: boolean
    supabase?: SupabaseAdminLike
}): Promise<AiAutomationGate> {
    const supabase = params.supabase || createAdminClient()
    const config = await readConfigValues(supabase, [
        AI_TOKEN_AUTOMATION_PAUSE_KEY,
        params.enabledKey || '',
    ])
    const paused = config[AI_TOKEN_AUTOMATION_PAUSE_KEY] === 'true'
    const enabled = params.enabledKey
        ? (config[params.enabledKey] ? config[params.enabledKey] !== 'false' : params.defaultEnabled !== false)
        : true
    const allowDuringPause = params.allowDuringTokenPause ?? isWhatsAppAttendanceAgent(params.agentId)

    if (paused && !allowDuringPause) {
        return {
            allowed: false,
            reason: 'ai_token_automation_paused',
            paused,
            enabled,
            agentId: params.agentId,
            enabledKey: params.enabledKey,
        }
    }

    if (!enabled) {
        return {
            allowed: false,
            reason: params.enabledKey ? `${params.enabledKey}_disabled` : 'agent_disabled',
            paused,
            enabled,
            agentId: params.agentId,
            enabledKey: params.enabledKey,
        }
    }

    return {
        allowed: true,
        reason: 'ready',
        paused,
        enabled,
        agentId: params.agentId,
        enabledKey: params.enabledKey,
    }
}
