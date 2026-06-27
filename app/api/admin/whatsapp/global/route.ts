import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { recordEcosystemEvent } from '@/lib/intelligence/ecosystem'
import { processVitorPaidTrafficCommand } from '@/lib/ads/vitor-traffic-manager'
import { isWhatsAppGlobalInstance } from '@/lib/whatsapp/global-identity'
import { processPilgerEditorialCommand } from '@/lib/whatsapp/pilger-editorial-agent'
import { processPilgerFinanceCommand } from '@/lib/whatsapp/pilger-finance-agent'
import { processPilgerPropertyCommand } from '@/lib/whatsapp/pilger-property-agent'
import { processPilgerReportCommand } from '@/lib/whatsapp/pilger-report-agent'
import { sendWhatsAppMessage } from '@/lib/connectyhub/whatsapp'
import { buildPilgerGovernanceSummary, closePilgerGovernanceCommand } from '@/lib/whatsapp/pilger-global-governance'
import { buildPilgerGoLivePacket } from '@/lib/whatsapp/pilger-global-go-live'
import { buildPilgerPostLaunchReport } from '@/lib/whatsapp/pilger-global-post-launch'
import {
    buildPilgerPhase7IdentitySeparation,
    buildPilgerPhase8TrackingPanel,
    buildPilgerPhase9PracticalTests,
} from '@/lib/whatsapp/pilger-global-final-phases'

export const dynamic = 'force-dynamic'

const COMMAND_STATUSES = new Set(['received', 'blocked', 'queued', 'processing', 'completed', 'failed', 'cancelled'])
const OPEN_COMMAND_STATUSES = new Set(['received', 'queued', 'processing'])
const PILGER_DESK_TARGETS = ['ads-analyst', 'blog-intelligence', 'news-intelligence', 'finance-ops-agent', 'property-register', 'ceo-agent']

const TARGET_AGENT_LABELS: Record<string, string> = {
    'whatsapp-global-agent': 'Pilger WhatsApp Global',
    'ads-analyst': 'Vitor Trafego Pago',
    'blog-intelligence': 'Isadora Edicao Blog',
    'news-intelligence': 'Clara Edicao Noticias',
    'finance-ops-agent': 'Agente Financeiro',
    'ceo-agent': 'Arthur CEO IA',
    'property-register': 'Bianca Cadastro Imoveis',
}

const COMMAND_TYPE_LABELS: Record<string, string> = {
    general: 'Conversa geral',
    media_received: 'Midia recebida',
    identity_check: 'Reconhecimento',
    paid_traffic: 'Trafego pago',
    paid_traffic_decision: 'Decisao Vitor',
    paid_traffic_monitoring: 'Monitoramento Vitor',
    content_request: 'Conteudo editorial',
    finance_request: 'Financeiro',
    report_request: 'Relatorio',
    property_request: 'Imoveis',
}

function cleanText(value: unknown, max = 500) {
    const text = String(value || '').trim()
    return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

function maskPhone(value: unknown) {
    const digits = String(value || '').replace(/\D/g, '')
    if (!digits) return ''
    if (digits.length <= 6) return `${digits.slice(0, 2)}***`
    return `${digits.slice(0, 2)}***${digits.slice(-4)}`
}

function parseLimit(value: string | null, fallback = 80) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return fallback
    return Math.max(10, Math.min(160, Math.round(parsed)))
}

function isMissingRelation(error: any) {
    const message = String(error?.message || error || '').toLowerCase()
    return message.includes('does not exist') || message.includes('schema cache') || message.includes('relation')
}

function unique(values: unknown[]) {
    return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)))
}

function asArray(value: unknown) {
    return Array.isArray(value) ? value : []
}

function safeRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function returnAlreadySent(row: any) {
    return Boolean(safeRecord(row?.result).pilger_return_sent_at)
}

function isPilgerReturnPending(row: any) {
    const status = String(row?.status || '')
    const result = safeRecord(row?.result)
    if (returnAlreadySent(row)) return false
    if (!PILGER_DESK_TARGETS.includes(String(row?.target_agent || ''))) return false
    if (status === 'completed' || status === 'failed') return true
    return status === 'queued' && result.awaiting_field === 'counterparty_type'
}

function counterpartyTypeLabel(value: unknown) {
    const key = String(value || '')
    if (key === 'pessoa_fisica') return 'CPF / pessoa fisica'
    if (key === 'pessoa_juridica') return 'CNPJ / pessoa juridica'
    return ''
}

function buildPilgerReturnMessage(command: any) {
    const result = safeRecord(command?.result)
    if (result.pilger_return_message) return cleanText(result.pilger_return_message, 1800)

    const status = String(command?.status || '')
    const targetAgent = String(command?.target_agent || '')
    const targetLabel = TARGET_AGENT_LABELS[targetAgent] || targetAgent || 'agente responsavel'

    if (status === 'blocked') {
        return [
            'Conferi seu pedido aqui no Pilger.',
            'Nao consigo executar essa solicitacao porque seu perfil nao tem a permissao necessaria no sistema.',
        ].join('\n')
    }

    if (status === 'failed') {
        return [
            `Falei com ${targetLabel}, mas nao consegui concluir essa solicitacao agora.`,
            'O pedido ficou registrado no Pilger para revisao interna.',
        ].join('\n')
    }

    if (targetAgent === 'finance-ops-agent' && result.awaiting_field === 'counterparty_type') {
        return [
            'Recebi o comprovante e ja deixei o Financeiro avisado.',
            'So preciso confirmar uma coisa: esse lancamento entra como CPF ou CNPJ?',
        ].join('\n')
    }

    if (status !== 'completed') {
        return [
            `Estou acompanhando seu pedido com ${targetLabel}.`,
            `Status atual: ${COMMAND_STATUSES.has(status) ? status : 'em andamento'}. Assim que estiver no jeito eu retorno por aqui.`,
        ].join('\n')
    }

    if (targetAgent === 'ads-analyst') {
        if (result.stage === 'vitor_monitoring_completed') {
            return [
                'Conferi com o Vitor Trafego Pago.',
                `Saude do trafego: ${result.health_score ?? '-'}${result.health_label ? ` (${result.health_label})` : ''}.`,
                `Ele registrou ${result.alerts ?? 0} alerta(s) e ${result.recommendations ?? 0} recomendacao(oes).`,
            ].join('\n')
        }

        if (result.stage === 'vitor_decision_completed') {
            return [
                'Conferi com o Vitor Trafego Pago.',
                `A decisao foi registrada: ${result.action || 'acao atualizada'}.`,
                result.campaign_plan_id ? `Plano: ${result.campaign_plan_id}.` : 'O plano ficou registrado para acompanhamento.',
            ].join('\n')
        }

        return [
            'Conferi com o Vitor Trafego Pago.',
            `O criativo foi analisado com score ${result.score ?? '-'}/100${result.score_label ? ` (${result.score_label})` : ''}.`,
            result.campaign_plan_id ? `O plano de campanha ficou pronto para aprovacao: ${result.campaign_plan_id}.` : 'O plano de campanha ficou pronto para aprovacao.',
        ].join('\n')
    }

    if (targetAgent === 'blog-intelligence' || targetAgent === 'news-intelligence') {
        return [
            `Falei com ${targetLabel}.`,
            result.post_title
                ? `O material "${cleanText(result.post_title, 180)}" ficou com status ${result.post_status || 'registrado'}.`
                : 'A solicitacao editorial foi registrada e concluida.',
            result.post_id ? `ID do conteudo: ${result.post_id}.` : 'O Pilger segue acompanhando a aprovacao editorial.',
        ].join('\n')
    }

    if (targetAgent === 'finance-ops-agent') {
        return [
            'Falei com o Agente Financeiro.',
            result.counterparty_type
                ? `O lancamento foi classificado como ${counterpartyTypeLabel(result.counterparty_type) || result.counterparty_type}.`
                : 'O lancamento foi registrado para conferencia.',
            result.finance_action_id ? `Acao financeira: ${result.finance_action_id}.` : 'A acao ficou na fila financeira para continuidade.',
        ].join('\n')
    }

    if (targetAgent === 'property-register') {
        return [
            'Falei com a Bianca Cadastro Imoveis.',
            `Ela encontrou ${result.selected_count ?? 0} opcao(oes) dentro de ${result.matched_count ?? 0} imovel(is) ativos.`,
            'A selecao ficou registrada no Pilger para continuidade.',
        ].join('\n')
    }

    if (targetAgent === 'ceo-agent') {
        return [
            'Falei com o Arthur CEO IA.',
            `Ele montou a leitura com ${result.snapshot_count ?? 0} snapshot(s) e ${result.event_count ?? 0} evento(s) recentes.`,
            'O relatorio ficou registrado na Central de Inteligencia.',
        ].join('\n')
    }

    return [
        `Conferi com ${targetLabel}.`,
        'A solicitacao foi concluida e ficou registrada no Pilger.',
    ].join('\n')
}

function serializeInstance(instance: any) {
    if (!instance) return null
    return {
        id: instance.id,
        instance_name: instance.instance_name,
        status: instance.status,
        phone_number: instance.phone_number,
        phone_masked: maskPhone(instance.phone_number),
        broker_id: instance.broker_id || null,
        admin_user_id: instance.admin_user_id || null,
        instance_type: isWhatsAppGlobalInstance(instance) ? 'global' : (instance.instance_type || 'broker'),
        connected_at: instance.connected_at || null,
        updated_at: instance.updated_at || null,
        created_at: instance.created_at || null,
    }
}

function serializeSession(row: any) {
    const messages = asArray(row?.messages)
    const lastUserMessage = [...messages].reverse().find((message: any) => String(message?.role || '') === 'user')
    const lastAssistantMessage = [...messages].reverse().find((message: any) => String(message?.role || '') === 'assistant')
    return {
        id: row.id,
        phone: row.phone,
        phone_masked: maskPhone(row.phone),
        identity_type: row.identity_type,
        identity_id: row.identity_id || null,
        identity_label: row.identity_label || maskPhone(row.phone),
        permission_keys: Array.isArray(row.permission_keys) ? row.permission_keys : [],
        message_count: messages.length,
        last_user_message: cleanText(lastUserMessage?.content, 260),
        last_assistant_message: cleanText(lastAssistantMessage?.content, 260),
        last_message_at: row.last_message_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        messages: messages.slice(-12).map((message: any) => ({
            role: message?.role || 'user',
            content: cleanText(message?.content, 900),
            timestamp: message?.timestamp || null,
            has_media: Boolean(message?.has_media),
            command_type: message?.command_type || null,
        })),
        state: row.state || {},
    }
}

function commandRoute(row: any) {
    const targetAgent = String(row?.target_agent || 'whatsapp-global-agent')
    return {
        target_agent: targetAgent,
        target_label: TARGET_AGENT_LABELS[targetAgent] || targetAgent,
        command_type: row?.command_type || 'general',
        command_label: COMMAND_TYPE_LABELS[String(row?.command_type || '')] || row?.command_type || 'Mensagem',
    }
}

function serializeCommand(row: any, sessionMap: Map<string, any>) {
    const session = row?.session_id ? sessionMap.get(String(row.session_id)) : null
    const route = commandRoute(row)
    const result = safeRecord(row?.result)
    return {
        id: row.id,
        session_id: row.session_id || null,
        instance_id: row.instance_id || null,
        phone: row.phone,
        phone_masked: maskPhone(row.phone),
        identity_type: row.identity_type,
        identity_id: row.identity_id || null,
        identity_label: row.identity_label || maskPhone(row.phone),
        command_type: route.command_type,
        command_label: route.command_label,
        target_agent: route.target_agent,
        target_label: route.target_label,
        required_permission: row.required_permission || null,
        status: row.status || 'received',
        command_text: cleanText(row.command_text, 1800),
        payload: row.payload || {},
        result,
        pilger_return_pending: isPilgerReturnPending(row),
        pilger_return_sent_at: result.pilger_return_sent_at || null,
        pilger_return_message: result.pilger_return_message || null,
        pilger_return_preview: buildPilgerReturnMessage(row),
        created_at: row.created_at,
        updated_at: row.updated_at,
        session: session ? serializeSession(session) : null,
    }
}

async function safeCount(supabase: any, table: string, filter?: (query: any) => any) {
    try {
        let query = supabase.from(table).select('*', { count: 'exact', head: true })
        if (filter) query = filter(query)
        const { count, error } = await query
        if (error) return { count: 0, ready: !isMissingRelation(error), error: error.message }
        return { count: count || 0, ready: true, error: null }
    } catch (error: any) {
        return { count: 0, ready: false, error: error?.message || String(error) }
    }
}

async function getConfigValue(supabase: any, key: string) {
    const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', key)
        .maybeSingle()
    return String(data?.value || '').trim()
}

async function getConfigValues(supabase: any, keys: string[]) {
    const { data } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', keys)
    return Object.fromEntries((data || []).map((row: any) => [String(row.key), String(row.value || '')]))
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

async function getPilgerPhase3Status(supabase: any) {
    const config = await getConfigValues(supabase, [
        'pilger_global_automation_enabled',
        'pilger_global_cron_last_checked_at',
        'pilger_global_cron_last_reason',
        'pilger_global_cron_last_run_at',
        'pilger_global_cron_last_escalations',
        'pilger_global_cron_last_result',
        'pilger_global_cron_last_error',
        'pilger_global_cron_last_error_at',
    ])
    const lastResult = safeJson(config.pilger_global_cron_last_result)
    return {
        enabled: config.pilger_global_automation_enabled !== 'false',
        cron_path: '/api/cron/pilger-global',
        cron_schedule: '*/15 * * * *',
        has_cron_secret: Boolean(process.env.CRON_SECRET),
        last_checked_at: config.pilger_global_cron_last_checked_at || null,
        last_reason: config.pilger_global_cron_last_reason || null,
        last_run_at: config.pilger_global_cron_last_run_at || null,
        last_escalations: Number(config.pilger_global_cron_last_escalations || 0) || 0,
        last_error: config.pilger_global_cron_last_error || null,
        last_error_at: config.pilger_global_cron_last_error_at || null,
        last_result: lastResult,
    }
}

async function getGlobalInstance(supabase: any) {
    const configuredInstanceId = await getConfigValue(supabase, 'agent_default_instance_id')
    if (configuredInstanceId) {
        const { data } = await supabase
            .from('whatsapp_instances')
            .select('*')
            .eq('id', configuredInstanceId)
            .maybeSingle()
        if (data) return data
    }

    const { data: explicitGlobal } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('instance_type', 'global')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (explicitGlobal) return explicitGlobal

    const { data: namedGlobal } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .or('instance_name.ilike.%Agente global%,instance_name.ilike.%WhatsApp Global%')
        .limit(1)
        .maybeSingle()

    return namedGlobal || null
}

async function getInstanceForCommand(supabase: any, command: any) {
    if (command?.instance_id) {
        const { data: commandInstance } = await supabase
            .from('whatsapp_instances')
            .select('id, instance_name, instance_token, phone_number, broker_id, admin_user_id, status, config, instance_type')
            .eq('id', command.instance_id)
            .maybeSingle()
        if (commandInstance) return commandInstance
    }

    return getGlobalInstance(supabase)
}

function canProcessPilgerCommand(command: any) {
    const targetAgent = String(command?.target_agent || '')
    const commandType = String(command?.command_type || '')
    if (targetAgent === 'ads-analyst') return commandType.startsWith('paid_traffic')
    if (targetAgent === 'blog-intelligence' || targetAgent === 'news-intelligence') return commandType === 'content_request'
    if (targetAgent === 'finance-ops-agent') return commandType === 'finance_request'
    if (targetAgent === 'property-register') return commandType === 'property_request'
    if (targetAgent === 'ceo-agent') return commandType === 'report_request'
    return false
}

async function processPilgerCommandFromPanel(params: {
    supabase: any
    command: any
    instance: any
    origin?: string | null
}) {
    const targetAgent = String(params.command?.target_agent || '')
    const commandType = String(params.command?.command_type || '')
    const common = {
        supabase: params.supabase,
        command: params.command,
        instance: params.instance,
        instanceToken: params.instance?.instance_token || null,
        sendResponse: false,
    }

    if (targetAgent === 'ads-analyst' && commandType.startsWith('paid_traffic')) {
        const result = await processVitorPaidTrafficCommand(common)
        return { processor: 'vitor', result }
    }

    if ((targetAgent === 'blog-intelligence' || targetAgent === 'news-intelligence') && commandType === 'content_request') {
        const result = await processPilgerEditorialCommand({
            ...common,
            origin: params.origin || null,
        })
        return { processor: targetAgent === 'news-intelligence' ? 'clara' : 'isadora', result }
    }

    if (targetAgent === 'finance-ops-agent' && commandType === 'finance_request') {
        const result = await processPilgerFinanceCommand(common)
        return { processor: 'financeiro', result }
    }

    if (targetAgent === 'property-register' && commandType === 'property_request') {
        const result = await processPilgerPropertyCommand({
            ...common,
            origin: params.origin || null,
        })
        return { processor: 'bianca', result }
    }

    if (targetAgent === 'ceo-agent' && commandType === 'report_request') {
        const result = await processPilgerReportCommand(common)
        return { processor: 'arthur', result }
    }

    throw new Error('Este comando ainda nao tem executor manual do Pilger.')
}

async function getRecentSessions(supabase: any, sessionIds: string[], limit = 24) {
    try {
        let query = supabase
            .from('whatsapp_global_sessions')
            .select('*')
            .order('last_message_at', { ascending: false })
            .limit(limit)

        if (sessionIds.length) query = query.in('id', sessionIds)

        const { data, error } = await query
        if (error) return { ready: !isMissingRelation(error), sessions: [], error: error.message }
        return { ready: true, sessions: data || [], error: null }
    } catch (error: any) {
        return { ready: false, sessions: [], error: error?.message || String(error) }
    }
}

async function getRecentCommands(supabase: any, params: { limit: number; status: string; target: string }) {
    try {
        let query = supabase
            .from('whatsapp_global_commands')
            .select('id, session_id, instance_id, phone, identity_type, identity_id, identity_label, command_type, target_agent, required_permission, status, command_text, payload, result, created_at, updated_at')
            .order('created_at', { ascending: false })
            .limit(params.limit)

        if (params.status && params.status !== 'all') query = query.eq('status', params.status)
        if (params.target && params.target !== 'all') query = query.eq('target_agent', params.target)

        const { data, error } = await query
        if (error) return { ready: !isMissingRelation(error), commands: [], sessions: [], error: error.message }

        const commands = data || []
        const sessionIds = unique(commands.map((row: any) => row.session_id))
        const sessionsResult = await getRecentSessions(supabase, sessionIds, Math.max(sessionIds.length, 24))
        const sessionMap = new Map<string, any>((sessionsResult.sessions || []).map((session: any) => [String(session.id), session]))

        return {
            ready: true,
            commands: commands.map((row: any) => serializeCommand(row, sessionMap)),
            sessions: (sessionsResult.sessions || []).map(serializeSession),
            error: sessionsResult.error,
        }
    } catch (error: any) {
        return { ready: false, commands: [], sessions: [], error: error?.message || String(error) }
    }
}

async function getPilgerAgentDesk(supabase: any) {
    try {
        const { data, error } = await supabase
            .from('whatsapp_global_commands')
            .select('id, session_id, instance_id, phone, identity_type, identity_id, identity_label, command_type, target_agent, required_permission, status, command_text, payload, result, created_at, updated_at')
            .in('target_agent', PILGER_DESK_TARGETS)
            .order('created_at', { ascending: false })
            .limit(300)

        if (error) return { ready: !isMissingRelation(error), agents: [], totals: {}, error: error.message }

        const rows = data || []
        const agents = PILGER_DESK_TARGETS.map(targetAgent => {
            const targetRows = rows.filter((row: any) => String(row?.target_agent || '') === targetAgent)
            const openRows = targetRows.filter((row: any) => OPEN_COMMAND_STATUSES.has(String(row?.status || '')))
            const returnPendingRows = targetRows.filter(isPilgerReturnPending)
            const returnedRows = targetRows.filter(returnAlreadySent)

            return {
                target_agent: targetAgent,
                target_label: TARGET_AGENT_LABELS[targetAgent] || targetAgent,
                total_count: targetRows.length,
                open_count: openRows.length,
                received_count: targetRows.filter((row: any) => row.status === 'received').length,
                queued_count: targetRows.filter((row: any) => row.status === 'queued').length,
                processing_count: targetRows.filter((row: any) => row.status === 'processing').length,
                completed_count: targetRows.filter((row: any) => row.status === 'completed').length,
                failed_count: targetRows.filter((row: any) => row.status === 'failed').length,
                return_pending_count: returnPendingRows.length,
                returned_count: returnedRows.length,
                latest_command: targetRows[0] ? serializeCommand(targetRows[0], new Map()) : null,
                oldest_open_command: openRows[openRows.length - 1] ? serializeCommand(openRows[openRows.length - 1], new Map()) : null,
                next_return_command: returnPendingRows[0] ? serializeCommand(returnPendingRows[0], new Map()) : null,
            }
        })

        return {
            ready: true,
            agents,
            totals: {
                total_count: rows.length,
                open_count: rows.filter((row: any) => OPEN_COMMAND_STATUSES.has(String(row?.status || ''))).length,
                return_pending_count: rows.filter(isPilgerReturnPending).length,
                returned_count: rows.filter(returnAlreadySent).length,
            },
            error: null,
        }
    } catch (error: any) {
        return { ready: false, agents: [], totals: {}, error: error?.message || String(error) }
    }
}

async function getMetrics(supabase: any) {
    const [
        total,
        received,
        blocked,
        queued,
        processing,
        completed,
        failed,
        cancelled,
        sessions,
        overrides,
        last24h,
    ] = await Promise.all([
        safeCount(supabase, 'whatsapp_global_commands'),
        safeCount(supabase, 'whatsapp_global_commands', query => query.eq('status', 'received')),
        safeCount(supabase, 'whatsapp_global_commands', query => query.eq('status', 'blocked')),
        safeCount(supabase, 'whatsapp_global_commands', query => query.eq('status', 'queued')),
        safeCount(supabase, 'whatsapp_global_commands', query => query.eq('status', 'processing')),
        safeCount(supabase, 'whatsapp_global_commands', query => query.eq('status', 'completed')),
        safeCount(supabase, 'whatsapp_global_commands', query => query.eq('status', 'failed')),
        safeCount(supabase, 'whatsapp_global_commands', query => query.eq('status', 'cancelled')),
        safeCount(supabase, 'whatsapp_global_sessions'),
        safeCount(supabase, 'whatsapp_global_identity_overrides'),
        safeCount(supabase, 'whatsapp_global_commands', query => query.gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())),
    ])

    return {
        total_commands: total.count,
        received: received.count,
        blocked: blocked.count,
        queued: queued.count,
        processing: processing.count,
        completed: completed.count,
        failed: failed.count,
        cancelled: cancelled.count,
        open: received.count + queued.count + processing.count,
        global_sessions: sessions.count,
        global_overrides: overrides.count,
        last_24h: last24h.count,
        ready: Boolean(total.ready && sessions.ready && overrides.ready),
        errors: [total, sessions, overrides].map(item => item.error).filter(Boolean),
    }
}

export async function GET(request: NextRequest) {
    try {
        const supabase = createAdminClient()
        const search = request.nextUrl.searchParams
        const limit = parseLimit(search.get('limit'))
        const status = cleanText(search.get('status'), 40) || 'all'
        const target = cleanText(search.get('target'), 80) || 'all'
        const globalInstance = await getGlobalInstance(supabase)

        const [
            commands,
            metrics,
            agentDesk,
            phase3Status,
            phase4Governance,
            sessionsCount,
            overridesCount,
            adminUsersCount,
            virtualBrokersCount,
            brokerAuthorizedCount,
            propertyOwnerLegacyCount,
            propertyOwnerPrivateCount,
            ecosystemEventsCount,
        ] = await Promise.all([
            getRecentCommands(supabase, { limit, status, target }),
            getMetrics(supabase),
            getPilgerAgentDesk(supabase),
            getPilgerPhase3Status(supabase),
            buildPilgerGovernanceSummary(supabase),
            safeCount(supabase, 'whatsapp_global_sessions'),
            safeCount(supabase, 'whatsapp_global_identity_overrides'),
            safeCount(supabase, 'admin_users', query => query.not('phone', 'is', null).eq('is_active', true)),
            safeCount(supabase, 'virtual_brokers', query => query.not('phone', 'is', null).eq('is_active', true)),
            safeCount(supabase, 'broker_assistant_authorized_phones', query => query.eq('is_active', true)),
            safeCount(supabase, 'properties', query => query.not('owner_phone', 'is', null)),
            safeCount(supabase, 'property_private_details', query => query.not('owner_phones', 'is', null)),
            safeCount(supabase, 'ecosystem_events'),
        ])
        const accessSourcesCount = adminUsersCount.count
            + virtualBrokersCount.count
            + brokerAuthorizedCount.count
            + propertyOwnerLegacyCount.count
            + propertyOwnerPrivateCount.count
            + overridesCount.count
        const phase5GoLive = buildPilgerGoLivePacket({
            phase1Ready: Boolean(globalInstance?.id && globalInstance?.instance_token && commands.ready && metrics.ready && sessionsCount.ready && overridesCount.ready),
            phase2Ready: Boolean(agentDesk.ready),
            phase3Ready: Boolean(!phase3Status.last_error),
            phase4Ready: Boolean(phase4Governance.ready && (phase4Governance.totals as any).policy_count >= 6),
            hasGlobalInstance: Boolean(globalInstance?.id),
            hasInstanceToken: Boolean(globalInstance?.instance_token),
            globalInstanceConnected: String(globalInstance?.status || '').toLowerCase() === 'connected',
            accessSources: accessSourcesCount,
            agentDeskReady: agentDesk.ready,
            agentQueueCount: agentDesk.agents?.length || 0,
            returnPendingCount: (agentDesk.totals as any)?.return_pending_count || 0,
            returnedCount: (agentDesk.totals as any)?.returned_count || 0,
            hasCronSecret: phase3Status.has_cron_secret,
            phase3LastError: phase3Status.last_error,
            governanceReady: phase4Governance.ready,
            governancePolicyCount: (phase4Governance.totals as any)?.policy_count || 0,
            governanceReviewCount: (phase4Governance.totals as any)?.review_queue_count || 0,
            governanceClosedCount: (phase4Governance.totals as any)?.phase4_closed_count || 0,
            finalTestCount: 10,
            ecosystemReady: ecosystemEventsCount.ready,
        })
        const phase6PostLaunch = buildPilgerPostLaunchReport({
            phase5Ready: phase5GoLive.ready,
            goLiveScore: phase5GoLive.score,
            totalCommands: metrics.total_commands,
            openCommands: metrics.open,
            completedCommands: metrics.completed,
            failedCommands: metrics.failed,
            blockedCommands: metrics.blocked,
            returnPendingCount: (agentDesk.totals as any)?.return_pending_count || 0,
            returnedCount: (agentDesk.totals as any)?.returned_count || 0,
            governanceReviewCount: (phase4Governance.totals as any)?.review_queue_count || 0,
            governanceClosedCount: (phase4Governance.totals as any)?.phase4_closed_count || 0,
            phase3Escalations: phase3Status.last_escalations || 0,
            phase3LastError: phase3Status.last_error || null,
            finalTestCount: 10,
            accessSources: accessSourcesCount,
            agentCount: agentDesk.agents?.length || 0,
            ecosystemEvents: ecosystemEventsCount.count,
            ecosystemReady: ecosystemEventsCount.ready,
        })
        const phase7IdentityMatrix = [
            {
                key: 'admin',
                label: 'Admin/usuario interno',
                detected: adminUsersCount.count,
                ready: adminUsersCount.ready && adminUsersCount.count > 0,
                permissions: ['conforme painel'],
                expected_behavior: 'Responder como colega de trabalho e aplicar permissoes.',
            },
            {
                key: 'broker',
                label: 'Corretor cadastrado',
                detected: virtualBrokersCount.count,
                ready: virtualBrokersCount.ready && virtualBrokersCount.count > 0,
                permissions: ['properties', 'leads', 'crm'],
                expected_behavior: 'Tratar como operacao interna, nao como comprador.',
            },
            {
                key: 'authorized_phone',
                label: 'Telefone autorizado',
                detected: brokerAuthorizedCount.count,
                ready: brokerAuthorizedCount.ready && brokerAuthorizedCount.count > 0,
                permissions: ['conforme cadastro'],
                expected_behavior: 'Tratar como representante autorizado do corretor.',
            },
            {
                key: 'owner',
                label: 'Proprietario',
                detected: propertyOwnerLegacyCount.count + propertyOwnerPrivateCount.count,
                ready: (propertyOwnerLegacyCount.ready || propertyOwnerPrivateCount.ready)
                    && (propertyOwnerLegacyCount.count + propertyOwnerPrivateCount.count) > 0,
                permissions: ['owner_properties'],
                expected_behavior: 'Tratar como proprietario, separado de lead comprador.',
            },
            {
                key: 'manual_override',
                label: 'Override manual',
                detected: overridesCount.count,
                ready: overridesCount.ready,
                permissions: ['permission_keys'],
                expected_behavior: 'Corrigir perfis conflitantes ou cadastros antigos.',
            },
        ]
        const phase7Identity = buildPilgerPhase7IdentitySeparation({
            identityMatrix: phase7IdentityMatrix,
            accessSources: accessSourcesCount,
            routeFailures: 0,
            overridesReady: overridesCount.ready,
            leadFallbackReady: true,
        })
        const phase8Panel = buildPilgerPhase8TrackingPanel({
            phase7Ready: phase7Identity.code_complete,
            agentDeskReady: agentDesk.ready,
            agentCount: agentDesk.agents?.length || 0,
            totalCommands: metrics.total_commands,
            returnPendingCount: (agentDesk.totals as any)?.return_pending_count || 0,
            returnedCount: (agentDesk.totals as any)?.returned_count || 0,
            statusFilterReady: true,
            targetFilterReady: true,
        })
        const phase9RouteOverview = PILGER_DESK_TARGETS.map(targetAgent => ({
            key: targetAgent,
            label: TARGET_AGENT_LABELS[targetAgent] || targetAgent,
            status: agentDesk.agents?.some((agent: any) => agent.target_agent === targetAgent) ? 'ok' : 'missing',
            target_agent: targetAgent,
            target_agent_name: TARGET_AGENT_LABELS[targetAgent] || targetAgent,
            allowed: true,
            execution_mode: 'sync_executor',
        })).concat([{
            key: 'identity_check',
            label: 'Reconhecimento',
            status: 'ok',
            target_agent: 'whatsapp-global-agent',
            target_agent_name: TARGET_AGENT_LABELS['whatsapp-global-agent'],
            allowed: true,
            execution_mode: 'conversation',
        }, {
            key: 'general_conversation',
            label: 'Bom dia Pilger',
            status: 'ok',
            target_agent: 'whatsapp-global-agent',
            target_agent_name: TARGET_AGENT_LABELS['whatsapp-global-agent'],
            allowed: true,
            execution_mode: 'conversation',
        }, {
            key: 'permission_denial',
            label: 'Bloqueio por permissao',
            status: 'ok',
            target_agent: 'finance-ops-agent',
            target_agent_name: TARGET_AGENT_LABELS['finance-ops-agent'],
            allowed: false,
            execution_mode: 'sync_executor',
        }])
        const phase9Practical = buildPilgerPhase9PracticalTests({
            phase7Ready: phase7Identity.code_complete,
            phase8Ready: phase8Panel.code_complete,
            testPlan: [
                { key: 'good_morning', label: 'Bom dia Pilger', message: 'Bom dia Pilger', expected: 'Responder como colega se o numero estiver cadastrado.' },
                { key: 'traffic_create', label: 'Subir campanha', message: 'Suba uma campanha com esse criativo', expected: 'Roteia para Vitor.' },
                { key: 'traffic_status', label: 'Status trafego', message: 'Como esta o trafego hoje?', expected: 'Roteia para Vitor.' },
                { key: 'blog_today', label: 'Blog de hoje', message: 'Qual blog temos hoje?', expected: 'Roteia para Isadora.' },
                { key: 'blog_create', label: 'Criar blog', message: 'Crie um blog sobre apartamentos frente mar', expected: 'Roteia para Isadora.' },
                { key: 'finance_receipt', label: 'Comprovante', message: 'Segue comprovante do posto', expected: 'Roteia para Financeiro.' },
                { key: 'leads_today', label: 'Leads de hoje', message: 'Veja meus leads de hoje', expected: 'Roteia conforme permissao comercial.' },
                { key: 'property_create', label: 'Cadastrar imovel', message: 'Cadastre esse imovel', expected: 'Roteia para Bianca.' },
                { key: 'operation_summary', label: 'Resumo da operacao', message: 'Me de um resumo da operacao', expected: 'Roteia para Arthur.' },
            ],
            routeMatrix: phase9RouteOverview,
        })

        return NextResponse.json({
            success: true,
            ready: Boolean(commands.ready && metrics.ready && agentDesk.ready),
            global_instance: serializeInstance(globalInstance),
            migration_ready: Boolean(commands.ready && sessionsCount.ready && overridesCount.ready),
            diagnostics: {
                commands_ready: commands.ready,
                sessions_ready: sessionsCount.ready,
                overrides_ready: overridesCount.ready,
                commands_error: commands.error,
                sessions_error: sessionsCount.error,
                overrides_error: overridesCount.error,
                agent_desk_error: agentDesk.error,
                metric_errors: metrics.errors,
            },
            identity_sources: {
                admin_users_with_phone: adminUsersCount.count,
                virtual_brokers_with_phone: virtualBrokersCount.count,
                broker_authorized_phones: brokerAuthorizedCount.count,
                property_owner_legacy_phones: propertyOwnerLegacyCount.count,
                property_owner_private_phones: propertyOwnerPrivateCount.count,
            },
            metrics,
            agent_desk: agentDesk,
            phase_3_automation: phase3Status,
            phase_4_governance: phase4Governance,
            phase_5_go_live: phase5GoLive,
            phase_6_post_launch: phase6PostLaunch,
            phase_7_identity: phase7Identity,
            phase_8_tracking: phase8Panel,
            phase_9_practical_tests: phase9Practical,
            recent_commands: commands.commands,
            recent_sessions: commands.sessions,
            filters: {
                status,
                target,
                limit,
            },
            options: {
                statuses: Array.from(COMMAND_STATUSES),
                targets: Object.entries(TARGET_AGENT_LABELS).map(([value, label]) => ({ value, label })),
            },
        })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const action = String(body?.action || '')
        const instanceId = String(body?.instance_id || '')

        if (action !== 'mark_global') {
            return NextResponse.json({ success: false, error: 'Acao invalida.' }, { status: 400 })
        }
        if (!instanceId) {
            return NextResponse.json({ success: false, error: 'instance_id obrigatorio.' }, { status: 400 })
        }

        const supabase = createAdminClient()
        const update = await supabase
            .from('whatsapp_instances')
            .update({
                instance_type: 'global',
                updated_at: new Date().toISOString(),
            })
            .eq('id', instanceId)
            .select('id, instance_name, status, phone_number, broker_id, admin_user_id, instance_type, connected_at, updated_at, created_at')
            .single()

        if (update.error) {
            if (!isMissingRelation(update.error) && !String(update.error.message || '').includes('instance_type')) {
                return NextResponse.json({ success: false, error: update.error.message }, { status: 500 })
            }

            await supabase
                .from('app_config')
                .upsert([
                    { key: 'agent_default_instance_id', value: instanceId },
                ], { onConflict: 'key' })

            const { data: fallbackInstance } = await supabase
                .from('whatsapp_instances')
                .select('*')
                .eq('id', instanceId)
                .maybeSingle()

            return NextResponse.json({
                success: true,
                migration_ready: false,
                warning: 'A instancia foi definida como padrao global, mas a coluna instance_type ainda precisa da migration.',
                global_instance: serializeInstance({ ...(fallbackInstance || {}), instance_type: 'global' }),
            })
        }

        await supabase
            .from('app_config')
            .upsert([
                { key: 'agent_default_instance_id', value: instanceId },
            ], { onConflict: 'key' })

        return NextResponse.json({
            success: true,
            global_instance: serializeInstance(update.data),
        })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 })
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}))
        const action = cleanText(body?.action, 40)
        const commandId = cleanText(body?.command_id, 80)
        const nextStatus = cleanText(body?.status, 40)
        const note = cleanText(body?.note, 800)

        if (!commandId) {
            return NextResponse.json({ success: false, error: 'command_id obrigatorio.' }, { status: 400 })
        }

        const supabase = createAdminClient()
        const { data: current, error: readError } = await supabase
            .from('whatsapp_global_commands')
            .select('*')
            .eq('id', commandId)
            .maybeSingle()

        if (readError) throw readError
        if (!current?.id) return NextResponse.json({ success: false, error: 'Comando nao encontrado.' }, { status: 404 })

        if (action === 'process_vitor' || action === 'process_pilger') {
            const commandType = String(current.command_type || '')
            if (action === 'process_vitor' && (current.target_agent !== 'ads-analyst' || !commandType.startsWith('paid_traffic'))) {
                return NextResponse.json({ success: false, error: 'Este comando nao pertence ao Vitor Trafego Pago.' }, { status: 400 })
            }
            if (!canProcessPilgerCommand(current)) {
                return NextResponse.json({ success: false, error: 'Este comando ainda nao tem executor manual do Pilger.' }, { status: 400 })
            }
            if (['blocked', 'cancelled', 'processing'].includes(String(current.status || ''))) {
                return NextResponse.json({ success: false, error: 'Comandos bloqueados, cancelados ou em processamento nao devem ser reprocessados pelo painel.' }, { status: 400 })
            }

            const instance = await getInstanceForCommand(supabase, current)

            const processing = await processPilgerCommandFromPanel({
                supabase,
                command: current,
                instance,
                origin: request.nextUrl.origin,
            })

            const { data: refreshed } = await supabase
                .from('whatsapp_global_commands')
                .select('*')
                .eq('id', commandId)
                .maybeSingle()

            await recordEcosystemEvent({
                supabase,
                eventType: 'whatsapp_global_command_pilger_processed_from_panel',
                actorType: 'human',
                entityType: 'whatsapp_global_command',
                entityId: commandId,
                source: 'admin-whatsapp-global',
                label: `Comando do WhatsApp Global processado pelo Pilger via painel`,
                importanceScore: processing.result?.error ? 82 : 74,
                metadata: {
                    command_id: commandId,
                    previous_status: current.status || null,
                    target_agent: current.target_agent || null,
                    command_type: current.command_type || null,
                    identity_type: current.identity_type || null,
                    identity_label: current.identity_label || null,
                    processor: processing.processor,
                    result: processing.result,
                },
            }).catch((error: any) => {
                console.warn('[WhatsApp Global] failed to record Pilger processing event:', error?.message || error)
            })

            return NextResponse.json({
                success: true,
                command: serializeCommand(refreshed || current, new Map()),
                processor: processing.processor,
                result: processing.result,
                vitor: processing.processor === 'vitor' ? processing.result : null,
            })
        }

        if (action === 'send_pilger_return') {
            if (String(current.status || '') === 'cancelled') {
                return NextResponse.json({ success: false, error: 'Comandos cancelados nao recebem retorno pelo Pilger.' }, { status: 400 })
            }

            const previousResult = safeRecord(current.result)
            if (previousResult.pilger_return_sent_at && !body?.force) {
                return NextResponse.json({
                    success: false,
                    error: 'Este comando ja teve retorno enviado pelo Pilger.',
                    command: serializeCommand(current, new Map()),
                }, { status: 409 })
            }

            const message = cleanText(body?.message, 1800) || buildPilgerReturnMessage(current)
            if (!cleanText(current.phone, 40)) {
                return NextResponse.json({ success: false, error: 'Comando sem telefone de origem para retorno.' }, { status: 400 })
            }
            if (!message) {
                return NextResponse.json({ success: false, error: 'Mensagem de retorno vazia.' }, { status: 400 })
            }

            const instance = await getInstanceForCommand(supabase, current)
            const sendResult = await sendWhatsAppMessage({
                phone: current.phone,
                message,
                instanceToken: instance?.instance_token || undefined,
            })
            const now = new Date().toISOString()
            const returnHistory = Array.isArray(previousResult.pilger_return_history) ? previousResult.pilger_return_history : []
            const nextResult = {
                ...previousResult,
                pilger_return_sent_at: now,
                pilger_return_message: message,
                pilger_return_instance_id: instance?.id || null,
                pilger_return_target_agent: current.target_agent || null,
                pilger_return_history: [
                    ...returnHistory,
                    {
                        at: now,
                        source: 'admin_whatsapp_global_panel',
                        target_agent: current.target_agent || null,
                        status: current.status || null,
                    },
                ].slice(-12),
                pilger_return_provider_response: safeRecord(sendResult),
            }

            const { data: updated, error: updateError } = await supabase
                .from('whatsapp_global_commands')
                .update({
                    result: nextResult,
                    updated_at: now,
                })
                .eq('id', commandId)
                .select('*')
                .single()

            if (updateError) throw updateError

            await recordEcosystemEvent({
                supabase,
                eventType: 'whatsapp_global_pilger_return_sent',
                actorType: 'human',
                entityType: 'whatsapp_global_command',
                entityId: commandId,
                source: 'admin-whatsapp-global',
                label: 'Pilger enviou retorno ao usuario pelo WhatsApp Global',
                importanceScore: 72,
                metadata: {
                    command_id: commandId,
                    status: current.status || null,
                    target_agent: current.target_agent || null,
                    command_type: current.command_type || null,
                    identity_type: current.identity_type || null,
                    identity_label: current.identity_label || null,
                    phone_masked: maskPhone(current.phone),
                    instance_id: instance?.id || null,
                    message_preview: cleanText(message, 360),
                },
            }).catch((error: any) => {
                console.warn('[WhatsApp Global] failed to record Pilger return event:', error?.message || error)
            })

            return NextResponse.json({
                success: true,
                command: serializeCommand(updated, new Map()),
                message,
                send_result: safeRecord(sendResult),
            })
        }

        if (action === 'close_pilger_governance') {
            const closure = await closePilgerGovernanceCommand(supabase, commandId, {
                outcome: cleanText(body?.outcome, 120),
                learning: cleanText(body?.learning || note, 900),
                actor: 'admin_whatsapp_global_panel',
            })

            return NextResponse.json({
                success: true,
                command: serializeCommand(closure.command, new Map()),
                phase4: closure.phase4,
            })
        }

        if (!COMMAND_STATUSES.has(nextStatus)) {
            return NextResponse.json({ success: false, error: 'Status invalido.' }, { status: 400 })
        }

        const now = new Date().toISOString()
        const previousResult = current.result && typeof current.result === 'object' ? current.result : {}
        const statusHistory = Array.isArray(previousResult.status_history) ? previousResult.status_history : []
        const nextResult = {
            ...previousResult,
            status_note: note || previousResult.status_note || null,
            status_updated_at: now,
            status_history: [
                ...statusHistory,
                {
                    from: current.status,
                    to: nextStatus,
                    note: note || null,
                    at: now,
                    source: 'admin_whatsapp_global_panel',
                },
            ].slice(-24),
        }

        const { data: updated, error: updateError } = await supabase
            .from('whatsapp_global_commands')
            .update({
                status: nextStatus,
                result: nextResult,
                updated_at: now,
            })
            .eq('id', commandId)
            .select('*')
            .single()

        if (updateError) throw updateError

        await recordEcosystemEvent({
            supabase,
            eventType: 'whatsapp_global_command_status_updated',
            actorType: 'human',
            entityType: 'whatsapp_global_command',
            entityId: commandId,
            source: 'admin-whatsapp-global',
            label: `Comando do WhatsApp Global marcado como ${nextStatus}`,
            importanceScore: nextStatus === 'completed' ? 70 : nextStatus === 'failed' ? 82 : 58,
            metadata: {
                command_id: commandId,
                previous_status: current.status,
                next_status: nextStatus,
                target_agent: current.target_agent || null,
                command_type: current.command_type || null,
                identity_type: current.identity_type || null,
                identity_label: current.identity_label || null,
                note: note || null,
            },
        }).catch((error: any) => {
            console.warn('[WhatsApp Global] failed to record status event:', error?.message || error)
        })

        return NextResponse.json({
            success: true,
            command: serializeCommand(updated, new Map()),
        })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 })
    }
}
