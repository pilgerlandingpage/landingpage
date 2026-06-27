import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getPublicAppUrl } from '@/lib/app-url'
import { configureWebhook, getWebhook, resolveConnectyHubWebhookUrl } from '@/lib/connectyhub/whatsapp'
import { recordEcosystemEvent } from '@/lib/intelligence/ecosystem'
import {
    detectWhatsAppGlobalCommandIntent,
    isWhatsAppGlobalInstance,
    type WhatsAppGlobalIdentity,
} from '@/lib/whatsapp/global-identity'
import { resolvePilgerAgentRoute } from '@/lib/whatsapp/pilger-agent-router'
import { getAgentOfficeSnapshot } from '@/lib/pilger-ai/agent-office'
import { verifyPilgerGlobalManagerAccess } from '@/lib/whatsapp/pilger-admin-access'
import { buildPilgerGovernanceSummary } from '@/lib/whatsapp/pilger-global-governance'
import { buildPilgerGoLivePacket } from '@/lib/whatsapp/pilger-global-go-live'
import { buildPilgerPostLaunchReport } from '@/lib/whatsapp/pilger-global-post-launch'
import {
    buildPilgerPhase7IdentitySeparation,
    buildPilgerPhase8TrackingPanel,
    buildPilgerPhase9PracticalTests,
} from '@/lib/whatsapp/pilger-global-final-phases'

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
const PILGER_OFFICE_AGENTS = [
    { id: 'whatsapp-global-agent', label: 'Pilger WhatsApp Global', sector: 'Diretoria' },
    { id: 'ads-analyst', label: 'Vitor Trafego Pago', sector: 'Marketing' },
    { id: 'blog-intelligence', label: 'Isadora Edicao Blog', sector: 'Marketing' },
    { id: 'news-intelligence', label: 'Clara Edicao Noticias', sector: 'Marketing' },
    { id: 'finance-ops-agent', label: 'Agente Financeiro', sector: 'Financeiro' },
    { id: 'property-register', label: 'Bianca Cadastro Imoveis', sector: 'Imoveis' },
    { id: 'ceo-agent', label: 'Arthur CEO IA', sector: 'Diretoria' },
]

const CONFIG_KEYS = [
    'agent_default_instance_id',
    'connectyhub_api_url',
    'connectyhub_api_token',
    'connectyhub_webhook_secret',
    'connectyhub_webhook_url',
    'whatsapp_global_system_prompt',
    'vitor_creative_review_system_prompt',
    'sector_notification_recipients',
    'vitor_monitoring_cron_last_checked_at',
    'vitor_monitoring_cron_last_reason',
    'vitor_monitoring_cron_last_error',
    'vitor_monitoring_cron_last_whatsapp_sent',
    'vitor_monitoring_cron_last_whatsapp_reason',
    'pilger_global_automation_enabled',
    'pilger_global_cron_last_checked_at',
    'pilger_global_cron_last_reason',
    'pilger_global_cron_last_run_at',
    'pilger_global_cron_last_escalations',
    'pilger_global_cron_last_result',
    'pilger_global_cron_last_error',
    'pilger_global_cron_last_error_at',
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
            .select('id, instance_name, instance_type, status, phone_number, instance_token, broker_id, admin_user_id, connected_at, updated_at, created_at')
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
            .select('id, instance_name, status, phone_number, instance_token, broker_id, admin_user_id, connected_at, updated_at, created_at')
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
        has_broker_link: Boolean(instance.broker_id),
        broker_id: instance.broker_id || null,
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

async function configurePilgerGlobalWebhook(request: NextRequest) {
    const supabase = createAdminClient()
    const publicUrl = getPublicAppUrl(request.nextUrl.origin)
    const requiredWebhookUrl = await resolveConnectyHubWebhookUrl(publicUrl)
    const [configResult, instancesResult] = await Promise.all([
        readConfigMap(supabase),
        readInstances(supabase),
    ])

    const globalInstance = pickGlobalInstance(instancesResult.rows, configResult.map)
    if (!globalInstance?.id) {
        return NextResponse.json({ success: false, error: 'Instancia global nao localizada.' }, { status: 404 })
    }

    if (!globalInstance.instance_token) {
        return NextResponse.json({ success: false, error: 'Instancia global sem token.' }, { status: 400 })
    }

    const setupResult = await configureWebhook({
        enabled: true,
        url: requiredWebhookUrl,
        events: REQUIRED_WEBHOOK_EVENTS,
        excludeMessages: REQUIRED_WEBHOOK_EXCLUDES,
        addUrlEvents: false,
        addUrlTypesMessages: false,
    }, globalInstance.instance_token)

    const verification = await readWebhookDiagnostic(globalInstance, requiredWebhookUrl)

    recordEcosystemEvent({
        supabase,
        eventType: 'pilger.global_webhook_configured',
        actorType: 'admin',
        entityType: 'whatsapp_instance',
        entityId: globalInstance.id,
        source: 'whatsapp_global_pre_test',
        label: 'Webhook Global configurado para Pilger',
        metadata: {
            required_webhook_url: requiredWebhookUrl,
            required_events: REQUIRED_WEBHOOK_EVENTS,
            required_excludes: REQUIRED_WEBHOOK_EXCLUDES,
            verification,
        },
        importanceScore: 65,
    }).catch(error => {
        console.warn('[Pilger PreTest] Falha ao registrar evento de webhook:', error)
    })

    return NextResponse.json({
        success: true,
        message: 'Webhook global configurado para o Pilger.',
        webhook_url: requiredWebhookUrl,
        instance: serializeInstance(globalInstance),
        setup_result: setupResult,
        verification,
    })
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

function pilgerReturnAlreadySent(row: any) {
    return Boolean(safeRecord(row?.result).pilger_return_sent_at)
}

function pilgerReturnPending(row: any) {
    const targetAgent = cleanString(row?.target_agent, 80)
    const status = cleanString(row?.status, 40)
    const result = safeRecord(row?.result)
    const agentIds = PILGER_OFFICE_AGENTS.filter(agent => agent.id !== 'whatsapp-global-agent').map(agent => agent.id)
    if (!agentIds.includes(targetAgent)) return false
    if (pilgerReturnAlreadySent(row)) return false
    if (status === 'completed' || status === 'failed') return true
    return status === 'queued' && result.awaiting_field === 'counterparty_type'
}

async function readPilgerLifecycleSummary(supabase: any) {
    const agentIds = PILGER_OFFICE_AGENTS.filter(agent => agent.id !== 'whatsapp-global-agent').map(agent => agent.id)
    try {
        const { data, error } = await supabase
            .from('whatsapp_global_commands')
            .select('id, target_agent, command_type, identity_type, identity_label, status, result, created_at, updated_at')
            .in('target_agent', agentIds)
            .order('created_at', { ascending: false })
            .limit(300)

        if (error) return { ready: !isMissingRelation(error), rows: [], agents: [], openCount: 0, returnPendingCount: 0, returnedCount: 0, error: cleanString(error.message, 260) }

        const rows = safeArray(data)
        const agents = agentIds.map(agentId => {
            const agentRows = rows.filter(row => row.target_agent === agentId)
            return {
                id: agentId,
                label: PILGER_OFFICE_AGENTS.find(agent => agent.id === agentId)?.label || agentId,
                total_count: agentRows.length,
                open_count: agentRows.filter(row => ['received', 'queued', 'processing'].includes(cleanString(row.status, 40))).length,
                return_pending_count: agentRows.filter(pilgerReturnPending).length,
                returned_count: agentRows.filter(pilgerReturnAlreadySent).length,
                latest_command: agentRows[0] || null,
            }
        })

        return {
            ready: true,
            rows,
            agents,
            openCount: rows.filter(row => ['received', 'queued', 'processing'].includes(cleanString(row.status, 40))).length,
            returnPendingCount: rows.filter(pilgerReturnPending).length,
            returnedCount: rows.filter(pilgerReturnAlreadySent).length,
            error: null,
        }
    } catch (error: any) {
        return {
            ready: false,
            rows: [],
            agents: [],
            openCount: 0,
            returnPendingCount: 0,
            returnedCount: 0,
            error: cleanString(error?.message || error, 260),
        }
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

function buildIdentityMatrix(params: {
    adminPhones: { count: number; ready: boolean }
    masterPhones: { count: number; ready: boolean }
    brokerPhones: { count: number; ready: boolean }
    authorizedPhones: { count: number; ready: boolean }
    propertyOwnerPhones: { count: number; ready: boolean }
    privateOwnerRows: { count: number; ready: boolean }
    overrides: { count: number; ready: boolean }
}) {
    const ownerCount = params.propertyOwnerPhones.count + params.privateOwnerRows.count
    return [
        {
            key: 'master',
            label: 'Master/admin',
            detected: params.masterPhones.count,
            ready: params.adminPhones.ready && params.masterPhones.count > 0,
            permissions: ['master_all'],
            expected_behavior: 'Responder como diretoria/master, permitir comandos internos e Vitor.',
        },
        {
            key: 'admin',
            label: 'Admin comum',
            detected: Math.max(0, params.adminPhones.count - params.masterPhones.count),
            ready: params.adminPhones.ready && params.adminPhones.count > 0,
            permissions: ['conforme setores do painel'],
            expected_behavior: 'Responder como usuario interno e bloquear somente acoes sem permissao.',
        },
        {
            key: 'broker',
            label: 'Corretor cadastrado',
            detected: params.brokerPhones.count,
            ready: params.brokerPhones.ready && params.brokerPhones.count > 0,
            permissions: ['properties', 'leads', 'crm'],
            expected_behavior: 'Apoiar leads, CRM, agenda e estoque sem tratar como comprador.',
        },
        {
            key: 'authorized_phone',
            label: 'Telefone autorizado',
            detected: params.authorizedPhones.count,
            ready: params.authorizedPhones.ready && params.authorizedPhones.count > 0,
            permissions: ['conforme cadastro do telefone'],
            expected_behavior: 'Atender como representante do corretor e respeitar flags de permissao.',
        },
        {
            key: 'owner',
            label: 'Proprietario',
            detected: ownerCount,
            ready: (params.propertyOwnerPhones.ready || params.privateOwnerRows.ready) && ownerCount > 0,
            permissions: ['owner_properties'],
            expected_behavior: 'Atender como proprietario, separado do funil de leads compradores.',
        },
        {
            key: 'manual_override',
            label: 'Override manual',
            detected: params.overrides.count,
            ready: params.overrides.ready,
            permissions: ['permission_keys do override'],
            expected_behavior: 'Corrigir perfil quando o historico ou cadastro antigo conflitar com o numero real.',
        },
    ]
}

function buildEndToEndTestPlan() {
    return [
        {
            key: 'identity_master',
            label: 'Reconhecer master',
            message: 'Sou o Magno Macedo. Voce me reconhece como administrador master da Pilger? Responda apenas qual perfil voce identificou para este numero.',
            expected: 'Responder master/admin e nunca lead.',
        },
        {
            key: 'identity_broker',
            label: 'Reconhecer corretor',
            message: 'Sou corretor cadastrado da Pilger. Qual perfil voce identificou para este numero?',
            expected: 'Responder corretor/usuario interno se o telefone estiver cadastrado.',
        },
        {
            key: 'identity_owner',
            label: 'Reconhecer proprietario',
            message: 'Sou proprietario de um imovel cadastrado. Qual perfil voce identificou para este numero?',
            expected: 'Responder proprietario quando houver owner_phone/privado vinculado.',
        },
        {
            key: 'vitor_creative',
            label: 'Criativo para Vitor',
            message: 'Vitor, analisar este criativo para subir trafego. Objetivo: gerar conversas qualificadas no WhatsApp.',
            expected: 'Criar comando, review, score, riscos e plano no painel do Vitor.',
        },
        {
            key: 'vitor_monitoring',
            label: 'Monitoramento',
            message: 'Vitor, me diga o status do trafego pago hoje.',
            expected: 'Gerar leitura de monitoramento ou registrar indisponibilidade sem inventar metricas.',
        },
        {
            key: 'vitor_approval',
            label: 'Aprovacao humana',
            message: 'Aprovar plano do Vitor.',
            expected: 'Atualizar status do plano/review sem publicar campanha automaticamente.',
        },
        {
            key: 'vitor_execution',
            label: 'Pacote de execucao',
            message: 'Preparar execucao do Vitor.',
            expected: 'Gerar pacote humano com nome de campanha, copy, UTM, checklist e regras de pausa/escala.',
        },
        {
            key: 'isadora_status',
            label: 'Status com Isadora',
            message: 'Pilger, veja pra mim qual o blog de hoje.',
            expected: 'Consultar a Isadora e responder o status do blog sem gerar novo rascunho.',
        },
        {
            key: 'isadora_create',
            label: 'Criar blog',
            message: 'Pilger, crie um blog sobre apartamentos frente mar em Balneario Camboriu.',
            expected: 'Gerar rascunho em revisao e avisar com link de aprovacao.',
        },
        {
            key: 'clara_news',
            label: 'Criar noticia',
            message: 'Pilger, crie uma noticia sobre valorizacao imobiliaria no litoral catarinense.',
            expected: 'Roteamento para Clara Noticias e rascunho em revisao.',
        },
        {
            key: 'finance_receipt',
            label: 'Comprovante financeiro',
            message: 'Pilger, recebi um comprovante do posto de gasolina.',
            expected: 'Perguntar se o lancamento e CPF ou CNPJ antes de encaminhar ao financeiro.',
        },
        {
            key: 'bianca_properties',
            label: 'Consultar imoveis',
            message: 'Pilger, veja os imoveis disponiveis frente mar.',
            expected: 'Consultar a Bianca no estoque ativo e devolver opcoes com links.',
        },
        {
            key: 'arthur_report',
            label: 'Resumo executivo',
            message: 'Pilger, me traga um relatorio geral da operacao hoje.',
            expected: 'Consultar o Arthur CEO IA e devolver resumo dos sinais da Central.',
        },
    ]
}

function simulatedIdentity(label: string, permissions: string[]): WhatsAppGlobalIdentity {
    return {
        type: 'admin_user',
        phone: '5547999999999',
        label,
        identityId: `sim-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        permissions,
        source: 'pre_test_simulation',
        confidence: 1,
    }
}

function buildPilgerRouteMatrix() {
    const master = simulatedIdentity('Master', ['master_all'])
    const traffic = simulatedIdentity('Trafego', ['ads'])
    const editorial = simulatedIdentity('Marketing', ['blog', 'news'])
    const finance = simulatedIdentity('Financeiro', ['finance'])
    const withoutFinance = simulatedIdentity('Sem Financeiro', ['blog'])
    const withoutBlog = simulatedIdentity('Sem Blog', ['news'])

    const scenarios = [
        {
            key: 'traffic_create',
            label: 'Subir campanha',
            message: 'Pilger, suba uma campanha de trafego com esse criativo.',
            identity: traffic,
            hasMedia: true,
            expectedTarget: 'ads-analyst',
            expectedAllowed: true,
            expectedMode: 'sync_executor',
        },
        {
            key: 'traffic_status',
            label: 'Status trafego',
            message: 'Pilger, veja como esta a campanha de trafego hoje.',
            identity: master,
            expectedTarget: 'ads-analyst',
            expectedAllowed: true,
            expectedMode: 'sync_executor',
        },
        {
            key: 'blog_status',
            label: 'Blog de hoje',
            message: 'Pilger, veja pra mim qual o blog de hoje.',
            identity: editorial,
            expectedTarget: 'blog-intelligence',
            expectedAllowed: true,
            expectedMode: 'sync_executor',
        },
        {
            key: 'blog_create',
            label: 'Criar blog',
            message: 'Pilger, crie um blog sobre apartamentos frente mar em Balneario Camboriu.',
            identity: editorial,
            expectedTarget: 'blog-intelligence',
            expectedAllowed: true,
            expectedMode: 'sync_executor',
        },
        {
            key: 'blog_blocked',
            label: 'Bloqueio blog',
            message: 'Pilger, crie um blog sobre apartamentos frente mar em Balneario Camboriu.',
            identity: withoutBlog,
            expectedTarget: 'blog-intelligence',
            expectedAllowed: false,
            expectedMode: 'sync_executor',
        },
        {
            key: 'news_create',
            label: 'Criar noticia',
            message: 'Pilger, crie uma noticia sobre valorizacao imobiliaria no litoral catarinense.',
            identity: editorial,
            expectedTarget: 'news-intelligence',
            expectedAllowed: true,
            expectedMode: 'sync_executor',
        },
        {
            key: 'finance_receipt',
            label: 'Comprovante',
            message: 'Pilger, recebi um comprovante do posto de gasolina.',
            identity: finance,
            hasMedia: true,
            expectedTarget: 'finance-ops-agent',
            expectedAllowed: true,
            expectedMode: 'sync_executor',
        },
        {
            key: 'finance_blocked',
            label: 'Bloqueio financeiro',
            message: 'Pilger, lance esse comprovante do posto no financeiro.',
            identity: withoutFinance,
            hasMedia: true,
            expectedTarget: 'finance-ops-agent',
            expectedAllowed: false,
            expectedMode: 'sync_executor',
        },
        {
            key: 'property_handoff',
            label: 'Consulta imovel',
            message: 'Pilger, veja os imoveis disponiveis frente mar.',
            identity: master,
            expectedTarget: 'property-register',
            expectedAllowed: true,
            expectedMode: 'sync_executor',
        },
        {
            key: 'report_summary',
            label: 'Resumo geral',
            message: 'Pilger, me traga um relatorio geral da operacao hoje.',
            identity: master,
            expectedTarget: 'ceo-agent',
            expectedAllowed: true,
            expectedMode: 'sync_executor',
        },
    ]

    return scenarios.map((scenario) => {
        const intent = detectWhatsAppGlobalCommandIntent(scenario.message, Boolean(scenario.hasMedia))
        const route = resolvePilgerAgentRoute({ identity: scenario.identity, intent })
        const passed = route.targetAgentId === scenario.expectedTarget
            && route.executionMode === scenario.expectedMode
            && route.allowed === scenario.expectedAllowed

        return {
            key: scenario.key,
            label: scenario.label,
            message: scenario.message,
            identity_label: scenario.identity.label,
            permissions: scenario.identity.permissions,
            command_type: intent.commandType,
            required_permission: route.requiredPermission || null,
            target_agent: route.targetAgentId,
            target_agent_name: route.targetAgent.name,
            execution_mode: route.executionMode,
            allowed: route.allowed,
            expected_target: scenario.expectedTarget,
            expected_allowed: scenario.expectedAllowed,
            expected_mode: scenario.expectedMode,
            status: passed ? 'ok' : 'missing',
            detail: passed
                ? `Roteou para ${route.targetAgent.name} como esperado.`
                : `Esperado ${scenario.expectedTarget}/${scenario.expectedMode}/${scenario.expectedAllowed ? 'permitido' : 'bloqueado'}, recebido ${route.targetAgentId}/${route.executionMode}/${route.allowed ? 'permitido' : 'bloqueado'}.`,
        }
    })
}

async function readPilgerOfficeDiagnostic() {
    try {
        const snapshot = await getAgentOfficeSnapshot()
        const agentsById = new Map((snapshot.agents || []).map((agent: any) => [String(agent.id || ''), agent]))
        const globalAgent = agentsById.get('whatsapp-global-agent') as any
        const globalTargets = safeArray(globalAgent?.centralContract?.defaultHandoffTargets).map(item => String(item || ''))
        const rows = PILGER_OFFICE_AGENTS.map(agent => {
            const officeAgent = agentsById.get(agent.id) as any
            return {
                id: agent.id,
                label: officeAgent?.personaName || officeAgent?.name || agent.label,
                expected_label: agent.label,
                sector: officeAgent?.sector || null,
                expected_sector: agent.sector,
                status: officeAgent?.status || null,
                exists: Boolean(officeAgent?.id),
                global_handoff: agent.id === 'whatsapp-global-agent' || globalTargets.includes(agent.id),
            }
        })

        return {
            ready: true,
            totalAgents: snapshot.totalAgents,
            globalTargets,
            rows,
            missingAgents: rows.filter(row => !row.exists).map(row => row.id),
            missingHandoffs: rows.filter(row => row.id !== 'whatsapp-global-agent' && !row.global_handoff).map(row => row.id),
            error: null,
        }
    } catch (error: any) {
        return {
            ready: false,
            totalAgents: 0,
            globalTargets: [],
            rows: [],
            missingAgents: PILGER_OFFICE_AGENTS.map(agent => agent.id),
            missingHandoffs: PILGER_OFFICE_AGENTS.filter(agent => agent.id !== 'whatsapp-global-agent').map(agent => agent.id),
            error: error?.message || 'Nao foi possivel carregar a Sala de Escritorios.',
        }
    }
}

export async function POST(request: NextRequest) {
    try {
        const access = await verifyPilgerGlobalManagerAccess()
        if (!access) return NextResponse.json({ success: false, error: 'Acesso negado.' }, { status: 403 })
        return configurePilgerGlobalWebhook(request)
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error?.message || 'Erro ao configurar webhook global.' },
            { status: 500 },
        )
    }
}

export async function GET(request: NextRequest) {
    const supabase = createAdminClient()
    const generatedAt = new Date().toISOString()
    const publicUrl = getPublicAppUrl(request.nextUrl.origin)
    const requiredWebhookUrl = await resolveConnectyHubWebhookUrl(publicUrl)

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
            latestBlogCommand,
            latestNewsCommand,
            latestFinanceCommand,
            latestPropertyCommand,
            latestReportCommand,
            blogCommands,
            newsCommands,
            financeCommands,
            financeActions,
            propertyCommands,
            reportCommands,
            latestReview,
            latestPlan,
            recentVitorEvents,
            recentTrafficSnapshots,
            pilgerOffice,
            pilgerLifecycle,
            pilgerGovernance,
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
            safeLatest(supabase, 'whatsapp_global_commands', 'id, command_type, target_agent, identity_type, identity_label, status, created_at', 'created_at', query => query.eq('target_agent', 'blog-intelligence')),
            safeLatest(supabase, 'whatsapp_global_commands', 'id, command_type, target_agent, identity_type, identity_label, status, created_at', 'created_at', query => query.eq('target_agent', 'news-intelligence')),
            safeLatest(supabase, 'whatsapp_global_commands', 'id, command_type, target_agent, identity_type, identity_label, status, created_at', 'created_at', query => query.eq('target_agent', 'finance-ops-agent')),
            safeLatest(supabase, 'whatsapp_global_commands', 'id, command_type, target_agent, identity_type, identity_label, status, created_at', 'created_at', query => query.eq('target_agent', 'property-register')),
            safeLatest(supabase, 'whatsapp_global_commands', 'id, command_type, target_agent, identity_type, identity_label, status, created_at', 'created_at', query => query.eq('target_agent', 'ceo-agent')),
            safeCount(supabase, 'whatsapp_global_commands', query => query.eq('target_agent', 'blog-intelligence')),
            safeCount(supabase, 'whatsapp_global_commands', query => query.eq('target_agent', 'news-intelligence')),
            safeCount(supabase, 'whatsapp_global_commands', query => query.eq('target_agent', 'finance-ops-agent')),
            safeCount(supabase, 'broker_assistant_actions', query => query.eq('action_type', 'create_finance_entry')),
            safeCount(supabase, 'whatsapp_global_commands', query => query.eq('target_agent', 'property-register')),
            safeCount(supabase, 'whatsapp_global_commands', query => query.eq('target_agent', 'ceo-agent')),
            safeLatest(supabase, 'paid_traffic_creative_reviews', 'id, score, score_label, status, source, created_at'),
            safeLatest(supabase, 'paid_traffic_campaign_plans', 'id, status, review_id, created_at'),
            readRecentVitorCentralEvents(supabase),
            readRecentTrafficSnapshots(supabase),
            readPilgerOfficeDiagnostic(),
            readPilgerLifecycleSummary(supabase),
            buildPilgerGovernanceSummary(supabase),
        ])

        const configMap = configResult.map as Record<string, any>
        const instances = instancesResult.rows || []
        const globalInstance = pickGlobalInstance(instances, configMap)
        const connectedInstances = instances.filter(instance => String(instance?.status || '').toLowerCase() === 'connected')
        const globalStatus = String(globalInstance?.status || '').toLowerCase()
        const webhookDiagnostic = await readWebhookDiagnostic(globalInstance, requiredWebhookUrl)
        const pilgerRouteMatrix = buildPilgerRouteMatrix()
        const pilgerRouteFailures = pilgerRouteMatrix.filter(row => row.status !== 'ok')
        const pilgerAccessSourcesCount = adminPhones.count + brokerPhones.count + authorizedPhones.count + overrides.count
        const pilgerPermissionGuardOk = pilgerRouteMatrix.some(row => row.key === 'finance_blocked' && row.allowed === false && row.target_agent === 'finance-ops-agent')
        const pilgerRealTestReady = Boolean(
            globalInstance?.id
            && globalStatus === 'connected'
            && pilgerAccessSourcesCount > 0
            && pilgerRouteFailures.length === 0
            && pilgerPermissionGuardOk
        )

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
                'global_finance_context',
                'Vinculo financeiro',
                globalInstance?.id
                    ? globalInstance?.broker_id ? 'ok' : 'warn'
                    : 'missing',
                globalInstance?.id
                    ? globalInstance?.broker_id
                        ? 'Instancia Global esta vinculada a um broker, entao o Agente Financeiro consegue criar a acao de lancamento.'
                        : 'Instancia Global existe, mas esta sem broker_id; pedidos financeiros podem responder no WhatsApp, mas nao entram na fila do financeiro.'
                    : 'Sem instancia Global para validar contexto financeiro.',
                { broker_id: globalInstance?.broker_id || null },
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
                'connectyhub_config',
                'Credenciais ConnectyHub',
                configuredText(configMap.connectyhub_api_url, 8) && configuredText(configMap.connectyhub_api_token, 8) && configuredText(configMap.connectyhub_webhook_secret, 8) ? 'ok' : 'missing',
                configuredText(configMap.connectyhub_api_url, 8) && configuredText(configMap.connectyhub_api_token, 8) && configuredText(configMap.connectyhub_webhook_secret, 8)
                    ? 'URL, token e segredo de webhook da ConnectyHub encontrados no app_config.'
                    : 'Configure connectyhub_api_url, connectyhub_api_token e connectyhub_webhook_secret no app_config.',
            ),
            item(
                'webhook_read',
                'Leitura do webhook',
                webhookDiagnostic.ready ? 'ok' : 'warn',
                webhookDiagnostic.ready
                    ? 'Webhook lido pela API da ConnectyHub.'
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
                        : 'Webhook nao aponta para /api/webhooks/connectyhub na URL publica atual.'
                    : 'Sem leitura da ConnectyHub para comparar o destino.',
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
                    : 'Sem leitura da ConnectyHub para validar eventos e filtros.',
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
            item(
                'pilger_access_manager',
                'Acessos do Pilger',
                overrides.ready ? (overrides.count > 0 ? 'ok' : 'warn') : 'missing',
                overrides.ready
                    ? overrides.count > 0
                        ? 'Ha acessos manuais ativos para testar colega/permissao no painel Global.'
                        : 'A tela de Acessos do Pilger esta pronta, mas ainda nao ha override manual ativo cadastrado.'
                    : overrides.error || 'Nao foi possivel consultar overrides manuais.',
                {
                    active_identity_overrides: overrides.count,
                    admin_users_with_phone: adminPhones.count,
                    brokers_with_phone: brokerPhones.count,
                    authorized_phones: authorizedPhones.count,
                },
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

        const pilgerSection = section('pilger', 'Pilger Orquestrador', [
            item(
                'pilger_route_matrix',
                'Matriz de rotas',
                pilgerRouteFailures.length ? 'missing' : 'ok',
                pilgerRouteFailures.length
                    ? `${pilgerRouteFailures.length} simulacao(oes) nao bateram com o destino esperado.`
                    : `${pilgerRouteMatrix.length} simulacao(oes) de Pilger bateram com destino, permissao e modo de execucao.`,
                { routes: pilgerRouteMatrix },
            ),
            item(
                'pilger_agent_office',
                'Sala de Escritorios',
                pilgerOffice.ready && !pilgerOffice.missingAgents.length && !pilgerOffice.missingHandoffs.length ? 'ok' : 'missing',
                pilgerOffice.ready
                    ? pilgerOffice.missingAgents.length || pilgerOffice.missingHandoffs.length
                        ? `Faltam agentes: ${pilgerOffice.missingAgents.join(', ') || 'nenhum'}; faltam handoffs do Global: ${pilgerOffice.missingHandoffs.join(', ') || 'nenhum'}.`
                        : `Todos os ${PILGER_OFFICE_AGENTS.length} colegas do Pilger estao na Sala e o Global entrega para eles.`
                    : pilgerOffice.error || 'Nao foi possivel carregar a Sala de Escritorios.',
                {
                    total_agents: pilgerOffice.totalAgents,
                    global_targets: pilgerOffice.globalTargets,
                    office_agents: pilgerOffice.rows,
                },
            ),
            item(
                'pilger_editorial_commands',
                'Isadora e Clara',
                blogCommands.ready && newsCommands.ready
                    ? (blogCommands.count + newsCommands.count > 0 ? 'ok' : 'warn')
                    : 'missing',
                blogCommands.ready && newsCommands.ready
                    ? `${blogCommands.count} comando(s) para Isadora e ${newsCommands.count} para Clara registrados.`
                    : 'Nao foi possivel consultar comandos editoriais do WhatsApp Global.',
                { latest_blog_command: latestBlogCommand.row, latest_news_command: latestNewsCommand.row },
            ),
            item(
                'pilger_finance_commands',
                'Agente Financeiro',
                financeCommands.ready && financeActions.ready
                    ? (financeCommands.count > 0 || financeActions.count > 0 ? 'ok' : 'warn')
                    : 'missing',
                financeCommands.ready && financeActions.ready
                    ? `${financeCommands.count} comando(s) financeiro(s) do Pilger e ${financeActions.count} acao(oes) financeiras na fila do concierge.`
                    : financeCommands.error || financeActions.error || 'Nao foi possivel consultar comandos/acoes financeiras.',
                { latest_finance_command: latestFinanceCommand.row, finance_actions_count: financeActions.count },
            ),
            item(
                'pilger_property_commands',
                'Bianca Imoveis',
                countStatus(propertyCommands),
                propertyCommands.ready
                    ? `${propertyCommands.count} comando(s) de imoveis registrados pelo Pilger.`
                    : propertyCommands.error || 'Nao foi possivel consultar comandos de imoveis.',
                { latest_property_command: latestPropertyCommand.row },
            ),
            item(
                'pilger_report_commands',
                'Arthur CEO IA',
                countStatus(reportCommands),
                reportCommands.ready
                    ? `${reportCommands.count} comando(s) executivo(s) registrados pelo Pilger.`
                    : reportCommands.error || 'Nao foi possivel consultar comandos executivos.',
                { latest_report_command: latestReportCommand.row },
            ),
            item(
                'pilger_permission_guard',
                'Guarda de permissao',
                pilgerPermissionGuardOk ? 'ok' : 'missing',
                'Simulacao valida que um usuario sem permissao financeira e bloqueado antes do Agente Financeiro executar.',
            ),
            item(
                'pilger_simulator_panel',
                'Simulador operacional',
                pilgerRouteFailures.length ? 'missing' : 'ok',
                pilgerRouteFailures.length
                    ? 'O simulador depende da mesma matriz de rotas; corrija os destinos divergentes antes do teste real.'
                    : 'Simulador do painel Global pode validar telefone, mensagem, identidade, permissao e agente sem enviar WhatsApp real.',
                { simulator_route: '/api/admin/whatsapp/global/simulate' },
            ),
            item(
                'pilger_agent_desk',
                'Mesa operacional por agente',
                pilgerLifecycle.ready ? 'ok' : 'missing',
                pilgerLifecycle.ready
                    ? `${pilgerLifecycle.agents.length} agente(s) com fila monitorada; ${pilgerLifecycle.openCount} pedido(s) aberto(s) e ${pilgerLifecycle.returnPendingCount} retorno(s) pendente(s).`
                    : pilgerLifecycle.error || 'Nao foi possivel consultar o ciclo dos pedidos do Pilger.',
                {
                    agents: pilgerLifecycle.agents,
                    open_count: pilgerLifecycle.openCount,
                    return_pending_count: pilgerLifecycle.returnPendingCount,
                    returned_count: pilgerLifecycle.returnedCount,
                },
            ),
            item(
                'pilger_return_action',
                'Retorno ao usuario',
                pilgerLifecycle.ready ? 'ok' : 'missing',
                pilgerLifecycle.ready
                    ? 'Painel Global prepara mensagem de retorno pelo Pilger, envia pela instancia global e grava pilger_return_sent_at no comando.'
                    : 'Sem leitura da fila, nao foi possivel validar o retorno auditado.',
                { action: 'send_pilger_return', route: '/api/admin/whatsapp/global' },
            ),
            item(
                'pilger_governance_policy',
                'Governanca Fase 4',
                pilgerGovernance.ready && (pilgerGovernance.totals as any).policy_count >= 6 ? 'ok' : 'missing',
                pilgerGovernance.ready
                    ? `${(pilgerGovernance.totals as any).policy_count || 0} politica(s) cobrem os agentes do Pilger; ${(pilgerGovernance.totals as any).review_queue_count || 0} comando(s) em revisao.`
                    : pilgerGovernance.error || 'Nao foi possivel consultar governanca do Pilger.',
                {
                    policies: pilgerGovernance.policies,
                    totals: pilgerGovernance.totals,
                    review_queue: pilgerGovernance.review_queue,
                },
            ),
            item(
                'pilger_real_test_ready',
                'Pronto para teste real',
                pilgerRealTestReady ? 'ok' : globalInstance?.id && pilgerRouteFailures.length === 0 ? 'warn' : 'missing',
                pilgerRealTestReady
                    ? 'Ha instancia global conectada, fontes de colegas reconheciveis e matriz de permissao validada.'
                    : globalInstance?.id
                        ? `Faltam ajustes antes do teste real: instancia ${globalStatus || 'sem status'}, ${pilgerAccessSourcesCount} fonte(s) de acesso, ${pilgerRouteFailures.length} falha(s) de rota.`
                        : 'Sem instancia Global localizada para receber o teste real pelo WhatsApp.',
                {
                    global_status: globalStatus || null,
                    pilger_access_sources: pilgerAccessSourcesCount,
                    route_failures: pilgerRouteFailures.length,
                    permission_guard_ok: pilgerPermissionGuardOk,
                },
            ),
        ])

        const automationSection = section('automation', 'Monitoramento e alertas', [
            item(
                'cron_secret',
                'Cron protegido',
                process.env.CRON_SECRET ? 'ok' : 'warn',
                process.env.CRON_SECRET
                    ? 'CRON_SECRET disponivel no runtime.'
                    : 'Configure CRON_SECRET para ativar rotinas automaticas protegidas em producao; testes manuais do Pilger continuam disponiveis.',
            ),
            item(
                'vitor_cron',
                'Cron do Vitor',
                process.env.CRON_SECRET
                    ? cleanString(configMap.vitor_monitoring_cron_last_checked_at, 80) ? 'ok' : 'warn'
                    : 'warn',
                cleanString(configMap.vitor_monitoring_cron_last_checked_at, 80)
                    ? `Ultima checagem: ${configMap.vitor_monitoring_cron_last_checked_at}. Motivo: ${cleanString(configMap.vitor_monitoring_cron_last_reason, 120) || 'registrado'}.`
                    : process.env.CRON_SECRET
                        ? 'O cron ainda nao registrou execucao recente em app_config.'
                        : 'Sem CRON_SECRET no runtime local, a rota automatica permanece protegida e nao deve ser chamada sem segredo.',
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
                'pilger_global_cron',
                'Cron do Pilger Global',
                process.env.CRON_SECRET
                    ? cleanString(configMap.pilger_global_cron_last_checked_at, 80) ? 'ok' : 'warn'
                    : 'warn',
                cleanString(configMap.pilger_global_cron_last_checked_at, 80)
                    ? `Ultima checagem: ${configMap.pilger_global_cron_last_checked_at}. Motivo: ${cleanString(configMap.pilger_global_cron_last_reason, 120) || 'registrado'}; escalonamentos: ${cleanString(configMap.pilger_global_cron_last_escalations, 20) || '0'}.`
                    : process.env.CRON_SECRET
                        ? 'Cron /api/cron/pilger-global esta criado, mas ainda nao registrou execucao em app_config.'
                        : 'Cron /api/cron/pilger-global esta criado; falta CRON_SECRET no runtime para execucao protegida.',
                {
                    cron_path: '/api/cron/pilger-global',
                    schedule: '*/15 * * * *',
                    last_result: safeJson(configMap.pilger_global_cron_last_result),
                },
            ),
            item(
                'pilger_global_cron_error',
                'Erro recente do Pilger',
                cleanString(configMap.pilger_global_cron_last_error, 200) ? 'warn' : 'ok',
                cleanString(configMap.pilger_global_cron_last_error, 200)
                    ? `Ultimo erro registrado: ${cleanString(configMap.pilger_global_cron_last_error, 200)}.`
                    : 'Nenhum erro recente registrado para a automacao do Pilger.',
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

        const sections = [globalSection, webhookSection, identitySection, pilgerSection, vitorSection, automationSection, centralSection]
        const blockers = sections.flatMap(row => row.items).filter(row => row.status === 'missing')
        const warnings = sections.flatMap(row => row.items).filter(row => row.status === 'warn')
        const score = Math.max(0, Math.round((sections.reduce((sum, row) => sum + row.score, 0) / Math.max(sections.length, 1))))
        const status: CheckStatus = blockers.length > 0 ? 'missing' : warnings.length > 0 ? 'warn' : 'ok'
        const phase1CoreReady = Boolean(
            globalInstance?.id
            && globalInstance?.instance_token
            && globalInstance?.broker_id
            && totalCommands.ready
            && sessions.ready
            && overrides.ready
            && pilgerRouteFailures.length === 0
            && pilgerPermissionGuardOk
            && pilgerOffice.ready
            && pilgerOffice.missingAgents.length === 0
            && pilgerOffice.missingHandoffs.length === 0
            && reviews.ready
            && plans.ready
            && creatives.ready
            && ecosystemEvents.ready
            && ecosystemSnapshots.ready
        )
        const remainingPhase1Actions = [
            webhookDiagnostic.ready && (webhookDiagnostic.missingEvents.length || webhookDiagnostic.missingExcludes.length)
                ? 'Clique em Reparar webhook para atualizar os eventos/filtros remotos da ConnectyHub.'
                : '',
            overrides.count === 0
                ? 'Cadastre ao menos um acesso manual em Acessos do Pilger para testar um colega especifico.'
                : '',
            blogCommands.count + newsCommands.count + financeCommands.count + propertyCommands.count + reportCommands.count === 0
                ? 'Rode a bateria do simulador e depois envie a bateria real pelo WhatsApp Global.'
                : '',
            !process.env.CRON_SECRET
                ? 'Configure CRON_SECRET em producao antes de depender das rotinas automaticas.'
                : '',
            !hasTrafficRecipient(configMap.sector_notification_recipients)
                ? 'Configure destinatarios de Trafego Pago para os alertas do Vitor.'
                : '',
        ].filter(Boolean)
        const phase2AgentIds = PILGER_OFFICE_AGENTS.filter(agent => agent.id !== 'whatsapp-global-agent').map(agent => agent.id)
        const phase2AgentsCovered = phase2AgentIds.every(agentId => pilgerLifecycle.agents.some((agent: any) => agent.id === agentId))
        const phase2CoreReady = Boolean(
            phase1CoreReady
            && pilgerLifecycle.ready
            && phase2AgentsCovered
            && totalCommands.ready
            && ecosystemEvents.ready
        )
        const remainingPhase2Actions = [
            pilgerLifecycle.openCount === 0
                ? 'Gere pedidos reais ou simulados para ver a mesa dos agentes com movimento operacional.'
                : '',
            pilgerLifecycle.returnPendingCount > 0
                ? `${pilgerLifecycle.returnPendingCount} retorno(s) aguardam envio manual pelo painel Global.`
                : '',
            pilgerLifecycle.returnedCount === 0
                ? 'Quando um agente concluir uma tarefa real, envie um retorno pelo painel para validar a marca pilger_return_sent_at.'
                : '',
        ].filter(Boolean)
        const phase3CronResult = safeJson(configMap.pilger_global_cron_last_result) as Record<string, any> | null
        const phase3CoreReady = Boolean(
            phase2CoreReady
            && pilgerLifecycle.ready
            && ecosystemEvents.ready
        )
        const remainingPhase3Actions = [
            !process.env.CRON_SECRET
                ? 'Configure CRON_SECRET em producao para o Vercel Cron executar /api/cron/pilger-global.'
                : '',
            !cleanString(configMap.pilger_global_cron_last_checked_at, 80)
                ? 'Rode a Fase 3 manualmente no painel Global ou aguarde a primeira execucao do cron.'
                : '',
            cleanString(configMap.pilger_global_cron_last_error, 200)
                ? `Corrija o erro recente da automacao do Pilger: ${cleanString(configMap.pilger_global_cron_last_error, 180)}.`
                : '',
        ].filter(Boolean)
        const phase4CoreReady = Boolean(
            phase3CoreReady
            && pilgerGovernance.ready
            && (pilgerGovernance.totals as any).policy_count >= 6
            && ecosystemEvents.ready
        )
        const remainingPhase4Actions = [
            (pilgerGovernance.totals as any).review_queue_count > 0
                ? `${(pilgerGovernance.totals as any).review_queue_count} comando(s) aguardam fechamento/aprendizado de governanca.`
                : '',
            (pilgerGovernance.totals as any).phase4_closed_count === 0
                ? 'Feche ao menos um comando real no painel Global para validar o historico de aprendizado da Fase 4.'
                : '',
        ].filter(Boolean)
        const testPlan = buildEndToEndTestPlan()
        const phase5GoLive = buildPilgerGoLivePacket({
            phase1Ready: phase1CoreReady,
            phase2Ready: phase2CoreReady,
            phase3Ready: phase3CoreReady,
            phase4Ready: phase4CoreReady,
            hasGlobalInstance: Boolean(globalInstance?.id),
            hasInstanceToken: Boolean(globalInstance?.instance_token),
            globalInstanceConnected: globalStatus === 'connected',
            webhookReady: Boolean(webhookDiagnostic.ready && !webhookDiagnostic.missingEvents.length && !webhookDiagnostic.missingExcludes.length),
            webhookMissingEvents: webhookDiagnostic.missingEvents.length,
            webhookMissingExcludes: webhookDiagnostic.missingExcludes.length,
            accessSources: pilgerAccessSourcesCount,
            routeFailures: pilgerRouteFailures.length,
            agentDeskReady: pilgerLifecycle.ready,
            agentQueueCount: pilgerLifecycle.agents.length,
            returnPendingCount: pilgerLifecycle.returnPendingCount,
            returnedCount: pilgerLifecycle.returnedCount,
            hasCronSecret: Boolean(process.env.CRON_SECRET),
            phase3LastError: cleanString(configMap.pilger_global_cron_last_error, 200) || null,
            governanceReady: pilgerGovernance.ready,
            governancePolicyCount: (pilgerGovernance.totals as any).policy_count || 0,
            governanceReviewCount: (pilgerGovernance.totals as any).review_queue_count || 0,
            governanceClosedCount: (pilgerGovernance.totals as any).phase4_closed_count || 0,
            finalTestCount: testPlan.length,
            ecosystemReady: ecosystemEvents.ready,
        })
        const phase5CoreReady = Boolean(phase4CoreReady && phase5GoLive.ready && phase5GoLive.final_test_runbook.length >= 6)
        const remainingPhase5Actions = phase5GoLive.checklist
            .filter((row: any) => row.status !== 'ok')
            .map((row: any) => row.action)
            .filter(Boolean)
        const phase6PostLaunch = buildPilgerPostLaunchReport({
            phase5Ready: phase5CoreReady,
            goLiveScore: phase5GoLive.score,
            totalCommands: totalCommands.count,
            openCommands: pilgerLifecycle.openCount,
            completedCommands: pilgerLifecycle.rows.filter((row: any) => row.status === 'completed').length,
            failedCommands: pilgerLifecycle.rows.filter((row: any) => row.status === 'failed').length,
            blockedCommands: pilgerLifecycle.rows.filter((row: any) => row.status === 'blocked').length,
            returnPendingCount: pilgerLifecycle.returnPendingCount,
            returnedCount: pilgerLifecycle.returnedCount,
            governanceReviewCount: (pilgerGovernance.totals as any).review_queue_count || 0,
            governanceClosedCount: (pilgerGovernance.totals as any).phase4_closed_count || 0,
            phase3Escalations: Number(configMap.pilger_global_cron_last_escalations || 0) || 0,
            phase3LastError: cleanString(configMap.pilger_global_cron_last_error, 200) || null,
            finalTestCount: testPlan.length,
            accessSources: pilgerAccessSourcesCount,
            agentCount: pilgerLifecycle.agents.length,
            ecosystemEvents: ecosystemEvents.count,
            ecosystemReady: ecosystemEvents.ready,
        })
        const phase6CoreReady = Boolean(phase5CoreReady && phase6PostLaunch.ready && phase6PostLaunch.stabilization_checklist.length >= 7)
        const remainingPhase6Actions = phase6PostLaunch.signals
            .filter((row: any) => row.status !== 'ok')
            .map((row: any) => row.next_action)
            .filter(Boolean)
        const identityMatrix = buildIdentityMatrix({
            adminPhones,
            masterPhones,
            brokerPhones,
            authorizedPhones,
            propertyOwnerPhones,
            privateOwnerRows,
            overrides,
        })
        const phase7Identity = buildPilgerPhase7IdentitySeparation({
            identityMatrix,
            accessSources: pilgerAccessSourcesCount,
            routeFailures: pilgerRouteFailures.length,
            overridesReady: overrides.ready,
            leadFallbackReady: true,
        })
        const phase8Panel = buildPilgerPhase8TrackingPanel({
            phase7Ready: phase7Identity.code_complete,
            agentDeskReady: pilgerLifecycle.ready,
            agentCount: pilgerLifecycle.agents.length,
            totalCommands: totalCommands.count,
            returnPendingCount: pilgerLifecycle.returnPendingCount,
            returnedCount: pilgerLifecycle.returnedCount,
            statusFilterReady: true,
            targetFilterReady: true,
        })
        const phase9Practical = buildPilgerPhase9PracticalTests({
            phase7Ready: phase7Identity.code_complete,
            phase8Ready: phase8Panel.code_complete,
            testPlan,
            routeMatrix: pilgerRouteMatrix,
        })

        return NextResponse.json({
            success: true,
            generated_at: generatedAt,
            status,
            score,
            blockers: blockers.length,
            warnings: warnings.length,
            phase_1: {
                code_complete: phase1CoreReady,
                status: phase1CoreReady ? 'complete' : 'attention',
                label: phase1CoreReady ? 'Fase 1 concluida no nucleo' : 'Fase 1 com pendencias de nucleo',
                detail: phase1CoreReady
                    ? 'Pilger reconhece colegas/leads, valida permissoes, conversa com os agentes responsaveis e possui simulador/pre-teste operacional.'
                    : 'Ainda ha algum item estrutural do Pilger, Sala de Escritorios, tabelas ou matriz de permissoes que precisa ser corrigido.',
                remaining_actions: remainingPhase1Actions,
                core_checks: {
                    global_instance: Boolean(globalInstance?.id && globalInstance?.instance_token),
                    broker_link: Boolean(globalInstance?.broker_id),
                    command_tables: Boolean(totalCommands.ready && sessions.ready && overrides.ready),
                    route_matrix: pilgerRouteFailures.length === 0,
                    permission_guard: pilgerPermissionGuardOk,
                    agent_office: Boolean(pilgerOffice.ready && !pilgerOffice.missingAgents.length && !pilgerOffice.missingHandoffs.length),
                    simulator: pilgerRouteFailures.length === 0,
                    vitor_tables: Boolean(reviews.ready && plans.ready && creatives.ready),
                    central: Boolean(ecosystemEvents.ready && ecosystemSnapshots.ready),
                },
            },
            phase_2: {
                code_complete: phase2CoreReady,
                status: phase2CoreReady ? 'complete' : 'attention',
                label: phase2CoreReady ? 'Fase 2 concluida no nucleo' : 'Fase 2 com pendencias de nucleo',
                detail: phase2CoreReady
                    ? 'Pilger possui mesa operacional por agente, acompanha pedidos abertos, identifica retornos pendentes e consegue enviar devolutiva auditada ao usuario.'
                    : 'Ainda ha algum ponto estrutural da mesa operacional, ciclo de pedidos ou auditoria de retorno que precisa ser corrigido.',
                remaining_actions: remainingPhase2Actions,
                core_checks: {
                    phase_1_complete: phase1CoreReady,
                    agent_desk_api: pilgerLifecycle.ready,
                    all_agent_queues: phase2AgentsCovered,
                    command_lifecycle: totalCommands.ready,
                    return_pending_detector: pilgerLifecycle.ready,
                    audited_return_action: true,
                    central_events: ecosystemEvents.ready,
                },
                totals: {
                    open_count: pilgerLifecycle.openCount,
                    return_pending_count: pilgerLifecycle.returnPendingCount,
                    returned_count: pilgerLifecycle.returnedCount,
                    agents: pilgerLifecycle.agents,
                },
            },
            phase_3: {
                code_complete: phase3CoreReady,
                status: phase3CoreReady ? 'complete' : 'attention',
                label: phase3CoreReady ? 'Fase 3 concluida no nucleo' : 'Fase 3 com pendencias de nucleo',
                detail: phase3CoreReady
                    ? 'Pilger possui automacao protegida para monitorar SLA dos agentes, registrar escalonamentos e manter a Central informada sem depender so do painel.'
                    : 'Ainda ha algum ponto estrutural da automacao, ciclo operacional ou Central que precisa ser corrigido.',
                remaining_actions: remainingPhase3Actions,
                core_checks: {
                    phase_2_complete: phase2CoreReady,
                    cron_route: true,
                    vercel_schedule: true,
                    admin_manual_run: true,
                    sla_supervision: pilgerLifecycle.ready,
                    central_events: ecosystemEvents.ready,
                    cron_secret_runtime: Boolean(process.env.CRON_SECRET),
                    no_recent_error: !cleanString(configMap.pilger_global_cron_last_error, 200),
                },
                automation: {
                    enabled: configMap.pilger_global_automation_enabled !== 'false',
                    cron_path: '/api/cron/pilger-global',
                    schedule: '*/15 * * * *',
                    last_checked_at: configMap.pilger_global_cron_last_checked_at || null,
                    last_reason: configMap.pilger_global_cron_last_reason || null,
                    last_run_at: configMap.pilger_global_cron_last_run_at || null,
                    last_escalations: Number(configMap.pilger_global_cron_last_escalations || 0) || 0,
                    last_result: phase3CronResult,
                    last_error: configMap.pilger_global_cron_last_error || null,
                },
            },
            phase_4: {
                code_complete: phase4CoreReady,
                status: phase4CoreReady ? 'complete' : 'attention',
                label: phase4CoreReady ? 'Fase 4 concluida no nucleo' : 'Fase 4 com pendencias de nucleo',
                detail: phase4CoreReady
                    ? 'Pilger possui politicas por agente, fila de revisao, fechamento de governanca e aprendizado operacional registrado na Central.'
                    : 'Ainda ha algum ponto estrutural da governanca, politica por agente ou Central que precisa ser corrigido.',
                remaining_actions: remainingPhase4Actions,
                core_checks: {
                    phase_3_complete: phase3CoreReady,
                    policy_matrix: pilgerGovernance.ready && (pilgerGovernance.totals as any).policy_count >= 6,
                    review_queue: pilgerGovernance.ready,
                    closure_action: true,
                    learning_history: true,
                    central_events: ecosystemEvents.ready,
                },
                governance: {
                    policies: pilgerGovernance.policies,
                    totals: pilgerGovernance.totals,
                    review_queue: pilgerGovernance.review_queue,
                },
            },
            phase_5: {
                code_complete: phase5CoreReady,
                status: phase5CoreReady ? 'complete' : 'attention',
                label: phase5CoreReady ? 'Fase 5 concluida no nucleo' : 'Fase 5 com pendencias de go-live',
                detail: phase5CoreReady
                    ? 'Pilger possui pacote de go-live com checklist, runbook da bateria final, evidencias obrigatorias e rollback operacional.'
                    : 'O pacote de go-live esta montado, mas ainda ha bloqueios ou watchpoints antes da bateria final.',
                remaining_actions: remainingPhase5Actions,
                core_checks: {
                    phase_4_complete: phase4CoreReady,
                    go_live_packet: true,
                    critical_gate: phase5GoLive.ready,
                    final_test_runbook: phase5GoLive.final_test_runbook.length >= 6,
                    evidence_plan: phase5GoLive.required_evidence.length >= 6,
                    rollback_plan: phase5GoLive.rollback_plan.length >= 3,
                    central_events: ecosystemEvents.ready,
                },
                go_live: phase5GoLive,
            },
            phase_6: {
                code_complete: phase6CoreReady,
                status: phase6CoreReady ? 'complete' : 'attention',
                label: phase6CoreReady ? 'Fase 6 concluida no nucleo' : 'Fase 6 com pendencias de pos-go-live',
                detail: phase6CoreReady
                    ? 'Pilger possui relatorio pos-go-live com sinais de estabilizacao, metricas, watchpoints e janela de acompanhamento.'
                    : 'A camada pos-go-live esta montada, mas ainda depende das evidencias reais da bateria final para estabilizar.',
                remaining_actions: remainingPhase6Actions,
                core_checks: {
                    phase_5_complete: phase5CoreReady,
                    post_launch_report: true,
                    stabilization_checklist: phase6PostLaunch.stabilization_checklist.length >= 7,
                    executive_summary: Boolean(phase6PostLaunch.executive_summary),
                    operating_window: Boolean(phase6PostLaunch.next_operating_window?.label),
                    audit_signals: phase6PostLaunch.signals.length >= 8,
                    central_events: ecosystemEvents.ready,
                },
                post_launch: phase6PostLaunch,
            },
            phase_7: phase7Identity,
            phase_8: phase8Panel,
            phase_9: phase9Practical,
            summary: {
                public_url: publicUrl,
                required_webhook_url: requiredWebhookUrl,
                global_instance: serializeInstance(globalInstance),
                connected_instances: connectedInstances.length,
                latest_command: latestCommand.row || null,
                latest_ads_command: latestAdsCommand.row || null,
                latest_blog_command: latestBlogCommand.row || null,
                latest_news_command: latestNewsCommand.row || null,
                latest_finance_command: latestFinanceCommand.row || null,
                latest_property_command: latestPropertyCommand.row || null,
                latest_report_command: latestReportCommand.row || null,
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
                    pilger_access_sources: pilgerAccessSourcesCount,
                    marketing_creatives: creatives.count,
                    blog_commands: blogCommands.count,
                    news_commands: newsCommands.count,
                    finance_commands: financeCommands.count,
                    property_commands: propertyCommands.count,
                    report_commands: reportCommands.count,
                    pilger_lifecycle_open: pilgerLifecycle.openCount,
                    pilger_return_pending: pilgerLifecycle.returnPendingCount,
                    pilger_returned: pilgerLifecycle.returnedCount,
                    pilger_phase3_escalations: Number(configMap.pilger_global_cron_last_escalations || 0) || 0,
                    pilger_phase4_reviews: (pilgerGovernance.totals as any).review_queue_count || 0,
                    pilger_phase4_closed: (pilgerGovernance.totals as any).phase4_closed_count || 0,
                    pilger_phase5_score: phase5GoLive.score,
                    pilger_phase5_blockers: phase5GoLive.blockers,
                    pilger_phase6_score: phase6PostLaunch.score,
                    pilger_phase6_watchpoints: phase6PostLaunch.watchpoints,
                    pilger_phase7_score: phase7Identity.score,
                    pilger_phase8_score: phase8Panel.score,
                    pilger_phase9_score: phase9Practical.score,
                    pilger_phase9_failed_routes: phase9Practical.automated_results.failed_routes,
                    vitor_reviews: reviews.count,
                    vitor_plans: plans.count,
                    ecosystem_events: ecosystemEvents.count,
                    ecosystem_snapshots: ecosystemSnapshots.count,
                },
            },
            identity_matrix: identityMatrix,
            pilger_route_matrix: pilgerRouteMatrix,
            sections,
            test_plan: testPlan,
            test_messages: testPlan.map(step => ({
                key: step.key,
                label: step.label,
                text: step.message,
                expected: step.expected,
            })),
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
