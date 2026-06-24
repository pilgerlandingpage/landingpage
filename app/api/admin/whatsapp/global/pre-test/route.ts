import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getPublicAppUrl } from '@/lib/app-url'
import { getWebhook } from '@/lib/uazapi'
import { isWhatsAppGlobalInstance } from '@/lib/whatsapp/global-identity'

export const dynamic = 'force-dynamic'

type CheckStatus = 'ok' | 'warn' | 'missing'

type CheckItem = {
    key: string
    label: string
    status: CheckStatus
    detail: string
    meta?: Record<string, unknown>
}

type CheckSection = {
    key: string
    label: string
    status: CheckStatus
    score: number
    items: CheckItem[]
}

const REQUIRED_WEBHOOK_EVENTS = ['history', 'messages', 'messages_update', 'connection', 'chats', 'contacts', 'labels', 'chat_labels']
const REQUIRED_WEBHOOK_EXCLUDES = ['wasSentByApi', 'isGroupYes']

const CONFIG_KEYS = [
    'agent_default_instance_id',
    'uazapi_base_url',
    'uazapi_admin_token',
    'whatsapp_global_system_prompt',
    'vitor_creative_review_system_prompt',
    'sector_notification_recipients',
    'vitor_monitoring_cron_last_checked_at',
    'vitor_monitoring_cron_last_reason',
    'vitor_monitoring_cron_last_error',
    'vitor_monitoring_cron_last_whatsapp_sent',
    'vitor_monitoring_cron_last_whatsapp_reason',
    'meta_access_token',
    'meta_ad_account_id',
    'google_ads_customer_id',
]

function cleanString(value: unknown, max = 500) {
    const text = String(value || '').trim()
    return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

function normalizeDigits(value: unknown) {
    return String(value || '').replace(/\D/g, '')
}

function maskPhone(value: unknown) {
    const digits = normalizeDigits(value)
    if (!digits) return ''
    if (digits.length <= 6) return `${digits.slice(0, 2)}***`
    return `${digits.slice(0, 4)}...${digits.slice(-4)}`
}

function safeArray(value: unknown): any[] {
    return Array.isArray(value) ? value : []
}

function safeRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function safeJson(value: unknown) {
    if (!value) return null
    if (typeof value === 'object') return value
    try {
        return JSON.parse(String(value))
    } catch {
        return null
    }
}

function configuredText(value: unknown, minLength = 20) {
    return cleanString(value, 10000).length >= minLength
}

function isMissingRelation(error: any) {
    const message = String(error?.message || error || '').toLowerCase()
    return message.includes('does not exist') || message.includes('schema cache') || message.includes('relation')
}

function normalizeStringList(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.map(item => cleanString(item, 120)).filter(Boolean)
    }

    if (typeof value === 'string') {
        const trimmed = value.trim()
        if (!trimmed) return []
        try {
            const parsed = JSON.parse(trimmed)
            if (Array.isArray(parsed)) return normalizeStringList(parsed)
        } catch {
            // fall through to comma split
        }
        return trimmed.split(',').map(item => cleanString(item, 120)).filter(Boolean)
    }

    return []
}

function item(key: string, label: string, status: CheckStatus, detail: string, meta?: Record<string, unknown>): CheckItem {
    return { key, label, status, detail, ...(meta ? { meta } : {}) }
}

function section(key: string, label: string, items: CheckItem[]): CheckSection {
    const blockers = items.filter(row => row.status === 'missing').length
    const warnings = items.filter(row => row.status === 'warn').length
    const score = Math.max(0, Math.round((items.reduce((sum, row) => {
        if (row.status === 'ok') return sum + 1
        if (row.status === 'warn') return sum + 0.5
        return sum
    }, 0) / Math.max(items.length, 1)) * 100))

    return {
        key,
        label,
        score,
        status: blockers > 0 ? 'missing' : warnings > 0 ? 'warn' : 'ok',
        items,
    }
}

async function safeCount(supabase: any, table: string, filter?: (query: any) => any) {
    try {
        let query = supabase.from(table).select('*', { count: 'exact', head: true })
        if (filter) query = filter(query)
        const { count, error } = await query
        if (error) {
            return { count: 0, ready: !isMissingRelation(error), error: cleanString(error.message, 260) }
        }
        return { count: count || 0, ready: true, error: null }
    } catch (error: any) {
        return { count: 0, ready: false, error: cleanString(error?.message || error, 260) }
    }
}

async function safeLatest(supabase: any, table: string, select: string, order = 'created_at', filter?: (query: any) => any) {
    try {
        let query = supabase.from(table).select(select).order(order, { ascending: false }).limit(1)
        if (filter) query = filter(query)
        const { data, error } = await query
        if (error) return { row: null, ready: !isMissingRelation(error), error: cleanString(error.message, 260) }
        return { row: safeArray(data)[0] || null, ready: true, error: null }
    } catch (error: any) {
        return { row: null, ready: false, error: cleanString(error?.message || error, 260) }
    }
}

async function readConfigMap(supabase: any) {
    try {
        const { data, error } = await supabase
            .from('app_config')
            .select('key, value')
            .in('key', CONFIG_KEYS)

        if (error) return { map: {}, ready: !isMissingRelation(error), error: cleanString(error.message, 260) }
        return {
            map: Object.fromEntries(safeArray(data).map((row: any) => [String(row.key), row.value])),
            ready: true,
            error: null,
        }
    } catch (error: any) {
        return { map: {}, ready: false, error: cleanString(error?.message || error, 260) }
    }
}

async function readInstances(supabase: any) {
    try {
        const { data, error } = await supabase
            .from('whatsapp_instances')
            .select('id, instance_name, instance_type, status, phone_number, instance_token, connected_at, updated_at, created_at')
            .order('updated_at', { ascending: false })
            .limit(120)

        if (!error) return { rows: safeArray(data), ready: true, error: null }
        if (!isMissingRelation(error)) return { rows: [], ready: true, error: cleanString(error.message, 260) }
    } catch {
        // retry without newer columns below
    }

    try {
        const { data, error } = await supabase
            .from('whatsapp_instances')
            .select('id, instance_name, status, phone_number, instance_token, connected_at, updated_at, created_at')
            .order('updated_at', { ascending: false })
            .limit(120)

        if (error) return { rows: [], ready: !isMissingRelation(error), error: cleanString(error.message, 260) }
        return { rows: safeArray(data), ready: true, error: null }
    } catch (error: any) {
        return { rows: [], ready: false, error: cleanString(error?.message || error, 260) }
    }
}

function pickGlobalInstance(instances: any[], configMap: Record<string, any>) {
    const configuredId = cleanString(configMap.agent_default_instance_id, 120)
    if (configuredId) {
        const byConfig = instances.find(instance => String(instance.id) === configuredId)
        if (byConfig) return byConfig
    }

    return instances.find(isWhatsAppGlobalInstance)
        || instances.find(instance => /agente global|whatsapp global/i.test(String(instance?.instance_name || '')))
        || null
}

function serializeInstance(instance: any) {
    if (!instance) return null
    return {
        id: instance.id,
        instance_name: instance.instance_name || null,
        instance_type: isWhatsAppGlobalInstance(instance) ? 'global' : (instance.instance_type || null),
        status: instance.status || null,
        phone_masked: maskPhone(instance.phone_number),
        has_token: Boolean(instance.instance_token),
        connected_at: instance.connected_at || null,
        updated_at: instance.updated_at || null,
    }
}

function webhookFields(webhook: any) {
    const data = safeRecord(webhook)
    const url = cleanString(
        data.url
        || data.webhookUrl
        || data.webhook_url
        || data.callbackUrl
        || data.endpoint
        || data.data?.url,
        500,
    )
    const events = normalizeStringList(data.events || data.webhookEvents || data.eventos || data.data?.events)
    const excludes = normalizeStringList(
        data.excludeMessages
        || data.exclude_messages
        || data.excludedMessages
        || data.exclude
        || data.data?.excludeMessages,
    )
    const enabled = data.enabled !== false && data.active !== false && data.isEnabled !== false && data.data?.enabled !== false

    return { url, events, excludes, enabled }
}

async function readWebhookDiagnostic(globalInstance: any, requiredUrl: string) {
    if (!globalInstance?.instance_token) {
        return {
            ready: false,
            webhook: null,
            error: globalInstance?.id ? 'Instancia global sem token.' : 'Instancia global nao localizada.',
            missingEvents: REQUIRED_WEBHOOK_EVENTS,
            missingExcludes: REQUIRED_WEBHOOK_EXCLUDES,
            urlOk: false,
            enabled: false,
        }
    }

    try {
        const webhook = await getWebhook(globalInstance.instance_token)
        const fields = webhookFields(webhook)
        const missingEvents = fields.events.length
            ? REQUIRED_WEBHOOK_EVENTS.filter(eventName => !fields.events.includes(eventName))
            : []
        const missingExcludes = fields.excludes.length
            ? REQUIRED_WEBHOOK_EXCLUDES.filter(excludeName => !fields.excludes.includes(excludeName))
            : []

        return {
            ready: true,
            webhook: {
                url: fields.url || null,
                enabled: fields.enabled,
                events: fields.events,
                excludes: fields.excludes,
            },
            error: null,
            missingEvents,
            missingExcludes,
            urlOk: fields.url === requiredUrl,
            enabled: fields.enabled,
        }
    } catch (error: any) {
        return {
            ready: false,
            webhook: null,
            error: cleanString(error?.message || error, 400),
            missingEvents: [],
            missingExcludes: [],
            urlOk: false,
            enabled: false,
        }
    }
}

function hasTrafficRecipient(value: unknown) {
    const parsed = safeJson(value)
    const recipients = Array.isArray(parsed) ? parsed : []
    const traffic = recipients.find((recipient: any) => {
        const key = cleanString(recipient?.key || recipient?.label, 120)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '_')
        return key === 'trafego_pago' || key === 'trafego' || key === 'ads'
    })
    if (!traffic || traffic.enabled === false || traffic.delivery_mode === 'muted') return false
    const primaryPhone = normalizeDigits(traffic.phone || traffic.whatsapp)
    const memberPhone = safeArray(traffic.members).some((member: any) =>
        member?.enabled !== false && normalizeDigits(member?.phone || member?.whatsapp).length >= 10
    )
    return primaryPhone.length >= 10 || memberPhone
}

function eventLooksLikeVitor(row: any) {
    const metadata = safeRecord(row?.metadata)
    const handoffs = safeArray(metadata.handoff_targets).map(entry => cleanString(entry, 80))
    const signature = [
        row?.event_type,
        row?.entity_type,
        row?.source,
        row?.label,
        metadata.agent_id,
        metadata.ecosystem_agent,
        metadata.command_type,
    ]
        .map(entry => cleanString(entry, 180).toLowerCase())
        .join(' ')

    return metadata.agent_id === 'ads-analyst'
        || metadata.ecosystem_agent === 'traffic'
        || handoffs.includes('ads-analyst')
        || signature.includes('vitor')
        || signature.includes('paid_traffic')
        || signature.includes('trafego')
        || signature.includes('traffic')
}

async function readRecentVitorCentralEvents(supabase: any) {
    try {
        const since = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
        const { data, error } = await supabase
            .from('ecosystem_events')
            .select('id, event_type, entity_type, source, label, metadata, importance_score, occurred_at')
            .gte('occurred_at', since)
            .order('occurred_at', { ascending: false })
            .limit(160)

        if (error) return { ready: !isMissingRelation(error), rows: [], error: cleanString(error.message, 260) }
        return { ready: true, rows: safeArray(data).filter(eventLooksLikeVitor).slice(0, 8), error: null }
    } catch (error: any) {
        return { ready: false, rows: [], error: cleanString(error?.message || error, 260) }
    }
}

async function readRecentTrafficSnapshots(supabase: any) {
    try {
        const { data, error } = await supabase
            .from('ecosystem_context_snapshots')
            .select('id, agent, scope, status, summary, generated_at, created_by')
            .eq('agent', 'traffic')
            .order('generated_at', { ascending: false })
            .limit(6)

        if (error) return { ready: !isMissingRelation(error), rows: [], error: cleanString(error.message, 260) }
        return { ready: true, rows: safeArray(data), error: null }
    } catch (error: any) {
        return { ready: false, rows: [], error: cleanString(error?.message || error, 260) }
    }
}

function countStatus(result: { count: number; ready: boolean; error: string | null }, warnWhenZero = true): CheckStatus {
    if (!result.ready) return 'missing'
    if (result.count > 0) return 'ok'
    return warnWhenZero ? 'warn' : 'ok'
}

function latestStatus(result: { row: any; ready: boolean; error: string | null }, warnWhenMissing = true): CheckStatus {
    if (!result.ready) return 'missing'
    if (result.row?.id) return 'ok'
    return warnWhenMissing ? 'warn' : 'ok'
}

function summarizeCounts(values: Record<string, { count: number }>) {
    return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.count]))
}

export async function GET(request: NextRequest) {
    const supabase = createAdminClient()
    const generatedAt = new Date().toISOString()
    const publicUrl = getPublicAppUrl(request.nextUrl.origin)
    const requiredWebhookUrl = `${publicUrl}/api/webhooks/whatsapp`

    try {
        const [
            configResult,
            instancesResult,
            totalCommands,
            recentCommands24h,
            sessions,
            overrides,
            adminPhones,
            masterPhones,
            brokerPhones,
            authorizedPhones,
            propertyOwnerPhones,
            privateOwnerRows,
            creatives,
            reviews,
            plans,
            ecosystemEvents,
            ecosystemSnapshots,
            latestCommand,
            latestAdsCommand,
            latestReview,
            latestPlan,
            recentVitorEvents,
            recentTrafficSnapshots,
        ] = await Promise.all([
            readConfigMap(supabase),
            readInstances(supabase),
            safeCount(supabase, 'whatsapp_global_commands'),
            safeCount(supabase, 'whatsapp_global_commands', query => query.gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())),
            safeCount(supabase, 'whatsapp_global_sessions'),
            safeCount(supabase, 'whatsapp_global_identity_overrides', query => query.eq('is_active', true)),
            safeCount(supabase, 'admin_users', query => query.eq('is_active', true).not('phone', 'is', null)),
            safeCount(supabase, 'admin_users', query => query.eq('is_active', true).eq('is_master', true).not('phone', 'is', null)),
            safeCount(supabase, 'virtual_brokers', query => query.eq('is_active', true).not('phone', 'is', null)),
            safeCount(supabase, 'broker_assistant_authorized_phones', query => query.eq('is_active', true)),
            safeCount(supabase, 'properties', query => query.not('owner_phone', 'is', null)),
            safeCount(supabase, 'property_private_details'),
            safeCount(supabase, 'marketing_creatives'),
            safeCount(supabase, 'paid_traffic_creative_reviews'),
            safeCount(supabase, 'paid_traffic_campaign_plans'),
            safeCount(supabase, 'ecosystem_events'),
            safeCount(supabase, 'ecosystem_context_snapshots'),
            safeLatest(supabase, 'whatsapp_global_commands', 'id, command_type, target_agent, identity_type, identity_label, status, created_at'),
            safeLatest(supabase, 'whatsapp_global_commands', 'id, command_type, target_agent, identity_type, identity_label, status, created_at', 'created_at', query => query.eq('target_agent', 'ads-analyst')),
            safeLatest(supabase, 'paid_traffic_creative_reviews', 'id, score, score_label, status, source, created_at'),
            safeLatest(supabase, 'paid_traffic_campaign_plans', 'id, status, review_id, created_at'),
            readRecentVitorCentralEvents(supabase),
            readRecentTrafficSnapshots(supabase),
        ])

        const configMap = configResult.map as Record<string, any>
        const instances = instancesResult.rows || []
        const globalInstance = pickGlobalInstance(instances, configMap)
        const connectedInstances = instances.filter(instance => String(instance?.status || '').toLowerCase() === 'connected')
        const globalStatus = String(globalInstance?.status || '').toLowerCase()
        const webhookDiagnostic = await readWebhookDiagnostic(globalInstance, requiredWebhookUrl)

        const globalSection = section('global', 'WhatsApp Global', [
            item(
                'global_instance',
                'Instancia global',
                globalInstance?.id && globalInstance?.instance_token ? (globalStatus === 'connected' ? 'ok' : 'warn') : 'missing',
                globalInstance?.id
                    ? `${globalInstance.instance_name || 'WhatsApp Global'} esta com status ${globalInstance.status || 'pendente'} e telefone ${maskPhone(globalInstance.phone_number) || 'nao identificado'}.`
                    : 'Nenhuma instancia marcada como global foi localizada.',
                serializeInstance(globalInstance) || undefined,
            ),
            item(
                'global_prompt',
                'Prompt global',
                configuredText(configMap.whatsapp_global_system_prompt) ? 'ok' : 'missing',
                configuredText(configMap.whatsapp_global_system_prompt)
                    ? 'Prompt do WhatsApp Global carregado no app_config.'
                    : 'Configure whatsapp_global_system_prompt antes do teste.',
            ),
            item(
                'global_tables',
                'Tabelas globais',
                totalCommands.ready && sessions.ready && overrides.ready ? 'ok' : 'missing',
                totalCommands.ready && sessions.ready && overrides.ready
                    ? `${totalCommands.count} comando(s), ${sessions.count} sessao(oes) e ${overrides.count} override(s) disponiveis.`
                    : 'A migration do WhatsApp Global ainda nao esta completa no banco.',
                summarizeCounts({ totalCommands, sessions, overrides }),
            ),
            item(
                'recent_commands',
                'Movimento recente',
                recentCommands24h.ready ? (recentCommands24h.count > 0 ? 'ok' : 'warn') : 'missing',
                recentCommands24h.ready
                    ? `${recentCommands24h.count} comando(s) do WhatsApp Global nas ultimas 24h.`
                    : recentCommands24h.error || 'Nao foi possivel consultar comandos recentes.',
            ),
        ])

        const webhookSection = section('webhook', 'Webhook e producao', [
            item(
                'public_url',
                'URL publica',
                publicUrl.includes('localhost') || publicUrl.includes('127.0.0.1') ? 'missing' : 'ok',
                `URL usada para o webhook: ${requiredWebhookUrl}`,
                { public_url: publicUrl, required_webhook_url: requiredWebhookUrl },
            ),
            item(
                'uazapi_config',
                'Credenciais Uazapi',
                configuredText(configMap.uazapi_base_url, 8) && configuredText(configMap.uazapi_admin_token, 8) ? 'ok' : 'missing',
                configuredText(configMap.uazapi_base_url, 8) && configuredText(configMap.uazapi_admin_token, 8)
                    ? 'Base URL e token administrativo da Uazapi encontrados no app_config.'
                    : 'Configure uazapi_base_url e uazapi_admin_token no app_config.',
            ),
            item(
                'webhook_read',
                'Leitura do webhook',
                webhookDiagnostic.ready ? 'ok' : 'warn',
                webhookDiagnostic.ready
                    ? 'Webhook lido diretamente da Uazapi.'
                    : `Nao foi possivel ler o webhook agora: ${webhookDiagnostic.error || 'sem detalhe'}.`,
                {
                    webhook: webhookDiagnostic.webhook,
                    error: webhookDiagnostic.error,
                },
            ),
            item(
                'webhook_url',
                'Destino correto',
                webhookDiagnostic.ready ? (webhookDiagnostic.urlOk ? 'ok' : 'missing') : 'warn',
                webhookDiagnostic.ready
                    ? webhookDiagnostic.urlOk
                        ? 'Webhook aponta para a rota publica correta.'
                        : 'Webhook nao aponta para /api/webhooks/whatsapp na URL publica atual.'
                    : 'Sem leitura da Uazapi para comparar o destino.',
            ),
            item(
                'webhook_filters',
                'Eventos e filtros',
                webhookDiagnostic.ready
                    ? webhookDiagnostic.missingEvents.length || webhookDiagnostic.missingExcludes.length ? 'warn' : 'ok'
                    : 'warn',
                webhookDiagnostic.ready
                    ? webhookDiagnostic.missingEvents.length || webhookDiagnostic.missingExcludes.length
                        ? `Faltam eventos: ${webhookDiagnostic.missingEvents.join(', ') || 'nenhum'}; faltam exclusoes: ${webhookDiagnostic.missingExcludes.join(', ') || 'nenhuma'}.`
                        : 'Eventos necessarios e exclusoes de mensagens enviadas pela API/grupos estao configurados.'
                    : 'Sem leitura da Uazapi para validar eventos e filtros.',
                {
                    required_events: REQUIRED_WEBHOOK_EVENTS,
                    required_excludes: REQUIRED_WEBHOOK_EXCLUDES,
                },
            ),
        ])

        const identitySection = section('identity', 'Identidade e permissoes', [
            item(
                'admin_users',
                'Admins com telefone',
                countStatus(adminPhones),
                adminPhones.ready
                    ? `${adminPhones.count} admin(s) ativo(s) com telefone; ${masterPhones.count} master(s) com telefone.`
                    : adminPhones.error || 'Nao foi possivel consultar admin_users.',
                { admins_with_phone: adminPhones.count, masters_with_phone: masterPhones.count },
            ),
            item(
                'brokers',
                'Corretores ativos',
                countStatus(brokerPhones),
                brokerPhones.ready
                    ? `${brokerPhones.count} corretor(es) ativo(s) com telefone cadastrado.`
                    : brokerPhones.error || 'Nao foi possivel consultar virtual_brokers.',
            ),
            item(
                'authorized_phones',
                'Telefones autorizados',
                authorizedPhones.ready ? (authorizedPhones.count > 0 ? 'ok' : 'warn') : 'missing',
                authorizedPhones.ready
                    ? `${authorizedPhones.count} telefone(s) autorizado(s) para operar por corretor.`
                    : authorizedPhones.error || 'Tabela de telefones autorizados nao encontrada.',
            ),
            item(
                'owners',
                'Proprietarios',
                propertyOwnerPhones.ready || privateOwnerRows.ready
                    ? (propertyOwnerPhones.count + privateOwnerRows.count > 0 ? 'ok' : 'warn')
                    : 'warn',
                propertyOwnerPhones.ready || privateOwnerRows.ready
                    ? `${propertyOwnerPhones.count} imovel(is) com owner_phone e ${privateOwnerRows.count} registro(s) privado(s) de proprietario.`
                    : 'Fontes de proprietario nao puderam ser consultadas agora.',
                { owner_phone_properties: propertyOwnerPhones.count, private_owner_rows: privateOwnerRows.count },
            ),
            item(
                'identity_overrides',
                'Overrides manuais',
                overrides.ready ? 'ok' : 'missing',
                overrides.ready
                    ? `${overrides.count} override(s) ativo(s) para correcao manual de perfil.`
                    : overrides.error || 'Tabela de overrides nao encontrada.',
            ),
        ])

        const vitorSection = section('vitor', 'Vitor Trafego Pago', [
            item(
                'vitor_prompt',
                'Prompt do Vitor',
                configuredText(configMap.vitor_creative_review_system_prompt) ? 'ok' : 'missing',
                configuredText(configMap.vitor_creative_review_system_prompt)
                    ? 'Prompt de analise de criativos carregado.'
                    : 'Configure vitor_creative_review_system_prompt antes do teste com criativo.',
            ),
            item(
                'vitor_tables',
                'Banco do Vitor',
                reviews.ready && plans.ready && creatives.ready ? 'ok' : 'missing',
                reviews.ready && plans.ready && creatives.ready
                    ? `${reviews.count} review(s), ${plans.count} plano(s) e ${creatives.count} criativo(s) disponiveis.`
                    : 'A migration/tabela do Vitor ou criativos ainda nao esta disponivel.',
                summarizeCounts({ reviews, plans, creatives }),
            ),
            item(
                'vitor_command',
                'Comando roteado ao Vitor',
                latestStatus(latestAdsCommand),
                latestAdsCommand.row?.id
                    ? `Ultimo comando ${latestAdsCommand.row.command_type || '-'} em ${latestAdsCommand.row.created_at}; status ${latestAdsCommand.row.status || '-'}.`
                    : 'Ainda nao ha comando real do WhatsApp Global direcionado ao Vitor.',
                latestAdsCommand.row || undefined,
            ),
            item(
                'vitor_review',
                'Review e plano',
                latestReview.row?.id && latestPlan.row?.id ? 'ok' : latestReview.row?.id ? 'warn' : reviews.ready ? 'warn' : 'missing',
                latestReview.row?.id
                    ? `Ultimo review ${latestReview.row.status || '-'} com score ${latestReview.row.score ?? '-'}; plano ${latestPlan.row?.status || 'nao localizado'}.`
                    : 'Nenhum review de criativo encontrado para o Vitor ainda.',
                { latest_review: latestReview.row, latest_plan: latestPlan.row },
            ),
            item(
                'publishing_fallback',
                'Execucao segura',
                'ok',
                configuredText(configMap.meta_access_token, 8) && configuredText(configMap.meta_ad_account_id, 4)
                    ? 'Meta Ads esta configurado para evoluir a execucao quando liberada.'
                    : 'Sem publicacao automatica obrigatoria: o Vitor pode gerar pacote pronto para execucao humana.',
            ),
        ])

        const automationSection = section('automation', 'Monitoramento e alertas', [
            item(
                'cron_secret',
                'Cron protegido',
                process.env.CRON_SECRET ? 'ok' : 'missing',
                process.env.CRON_SECRET
                    ? 'CRON_SECRET disponivel no runtime.'
                    : 'Configure CRON_SECRET para executar rotinas protegidas.',
            ),
            item(
                'vitor_cron',
                'Cron do Vitor',
                process.env.CRON_SECRET
                    ? cleanString(configMap.vitor_monitoring_cron_last_checked_at, 80) ? 'ok' : 'warn'
                    : 'missing',
                cleanString(configMap.vitor_monitoring_cron_last_checked_at, 80)
                    ? `Ultima checagem: ${configMap.vitor_monitoring_cron_last_checked_at}. Motivo: ${cleanString(configMap.vitor_monitoring_cron_last_reason, 120) || 'registrado'}.`
                    : 'O cron ainda nao registrou execucao recente em app_config.',
            ),
            item(
                'vitor_cron_error',
                'Erro recente do cron',
                cleanString(configMap.vitor_monitoring_cron_last_error, 200) ? 'warn' : 'ok',
                cleanString(configMap.vitor_monitoring_cron_last_error, 200)
                    ? `Ultimo erro registrado: ${cleanString(configMap.vitor_monitoring_cron_last_error, 200)}.`
                    : 'Nenhum erro recente registrado para o cron do Vitor.',
            ),
            item(
                'whatsapp_alerts',
                'Alertas por WhatsApp',
                hasTrafficRecipient(configMap.sector_notification_recipients) ? 'ok' : 'warn',
                hasTrafficRecipient(configMap.sector_notification_recipients)
                    ? `Setor Trafego Pago tem destinatario. Ultimo status: ${cleanString(configMap.vitor_monitoring_cron_last_whatsapp_reason, 120) || 'sem envio recente'}.`
                    : 'Configure destinatarios do setor Trafego Pago para receber alertas.',
            ),
        ])

        const centralSection = section('central', 'Central de Inteligencia', [
            item(
                'events_table',
                'Eventos gerais',
                countStatus(ecosystemEvents),
                ecosystemEvents.ready
                    ? `${ecosystemEvents.count} evento(s) registrados na Central.`
                    : ecosystemEvents.error || 'Tabela ecosystem_events indisponivel.',
            ),
            item(
                'snapshots_table',
                'Snapshots gerais',
                countStatus(ecosystemSnapshots),
                ecosystemSnapshots.ready
                    ? `${ecosystemSnapshots.count} snapshot(s) de contexto disponiveis.`
                    : ecosystemSnapshots.error || 'Tabela ecosystem_context_snapshots indisponivel.',
            ),
            item(
                'vitor_events',
                'Sinais do Vitor',
                recentVitorEvents.ready ? (recentVitorEvents.rows.length ? 'ok' : 'warn') : 'missing',
                recentVitorEvents.ready
                    ? `${recentVitorEvents.rows.length} sinal(is) recente(s) do Vitor na Central.`
                    : recentVitorEvents.error || 'Nao foi possivel consultar sinais do Vitor.',
                { events: recentVitorEvents.rows },
            ),
            item(
                'traffic_snapshots',
                'Snapshots de trafego',
                recentTrafficSnapshots.ready ? (recentTrafficSnapshots.rows.length ? 'ok' : 'warn') : 'missing',
                recentTrafficSnapshots.ready
                    ? `${recentTrafficSnapshots.rows.length} snapshot(s) de trafego encontrados.`
                    : recentTrafficSnapshots.error || 'Nao foi possivel consultar snapshots de trafego.',
                { snapshots: recentTrafficSnapshots.rows },
            ),
        ])

        const sections = [globalSection, webhookSection, identitySection, vitorSection, automationSection, centralSection]
        const blockers = sections.flatMap(row => row.items).filter(row => row.status === 'missing')
        const warnings = sections.flatMap(row => row.items).filter(row => row.status === 'warn')
        const score = Math.max(0, Math.round((sections.reduce((sum, row) => sum + row.score, 0) / Math.max(sections.length, 1))))
        const status: CheckStatus = blockers.length > 0 ? 'missing' : warnings.length > 0 ? 'warn' : 'ok'

        return NextResponse.json({
            success: true,
            generated_at: generatedAt,
            status,
            score,
            blockers: blockers.length,
            warnings: warnings.length,
            summary: {
                public_url: publicUrl,
                required_webhook_url: requiredWebhookUrl,
                global_instance: serializeInstance(globalInstance),
                connected_instances: connectedInstances.length,
                latest_command: latestCommand.row || null,
                latest_ads_command: latestAdsCommand.row || null,
                latest_review: latestReview.row || null,
                latest_plan: latestPlan.row || null,
                counts: {
                    whatsapp_global_commands: totalCommands.count,
                    whatsapp_global_sessions: sessions.count,
                    active_identity_overrides: overrides.count,
                    admins_with_phone: adminPhones.count,
                    masters_with_phone: masterPhones.count,
                    brokers_with_phone: brokerPhones.count,
                    authorized_phones: authorizedPhones.count,
                    marketing_creatives: creatives.count,
                    vitor_reviews: reviews.count,
                    vitor_plans: plans.count,
                    ecosystem_events: ecosystemEvents.count,
                    ecosystem_snapshots: ecosystemSnapshots.count,
                },
            },
            sections,
            test_messages: [
                {
                    key: 'identity',
                    label: 'Reconhecimento master',
                    text: 'Sou o Magno Macedo. Voce me reconhece como administrador master da Pilger? Responda apenas qual perfil voce identificou para este numero.',
                },
                {
                    key: 'monitoring',
                    label: 'Status do Vitor',
                    text: 'Vitor, me diga o status do trafego pago hoje.',
                },
                {
                    key: 'creative',
                    label: 'Analise de criativo',
                    text: 'Vitor, analisar este criativo para subir trafego. Objetivo: gerar conversas qualificadas no WhatsApp.',
                },
                {
                    key: 'approval',
                    label: 'Aprovacao humana',
                    text: 'Aprovar plano do Vitor.',
                },
                {
                    key: 'execution',
                    label: 'Pacote de execucao',
                    text: 'Preparar execucao do Vitor.',
                },
            ],
            links: [
                { label: 'WhatsApp Global', href: '/admin/whatsapp/global' },
                { label: 'Painel do Vitor', href: '/admin/ads/vitor' },
                { label: 'Instancias WhatsApp', href: '/admin/whatsapp' },
                { label: 'Manutencao', href: '/admin/maintenance' },
            ],
        })
    } catch (error) {
        console.error('[WhatsApp Global Pre-Test] Error:', error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Erro ao gerar pre-teste.' },
            { status: 500 },
        )
    }
}
