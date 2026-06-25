import {
    recordAgentCentralHandoff,
    resolveAgentCentralProfile,
    type AgentCentralProfile,
} from '@/lib/intelligence/agent-runtime'
import type {
    WhatsAppGlobalCommandIntent,
    WhatsAppGlobalIdentity,
} from '@/lib/whatsapp/global-identity'

type SupabaseLike = {
    from: (table: string) => any
}

export type PilgerAgentExecutionMode =
    | 'conversation'
    | 'sync_executor'
    | 'queued_handoff'

type PilgerAgentRouteDefinition = {
    commandType: string
    targetAgent: string
    requiredPermission?: string | null
    label: string
    executionMode: PilgerAgentExecutionMode
    userFacingVerb: string
}

export type PilgerAgentRoute = {
    commandType: string
    label: string
    targetAgentId: string
    targetAgent: AgentCentralProfile
    requiredPermission?: string | null
    executionMode: PilgerAgentExecutionMode
    allowed: boolean
    userFacingVerb: string
    shouldRecordHandoff: boolean
}

const ROUTER_VERSION = 'pilger-agent-router.phase1.2026-06-24'

const PILGER_ROUTE_DEFINITIONS: Record<string, PilgerAgentRouteDefinition> = {
    paid_traffic: {
        commandType: 'paid_traffic',
        targetAgent: 'ads-analyst',
        requiredPermission: 'ads',
        label: 'Trafego pago',
        executionMode: 'sync_executor',
        userFacingVerb: 'vou conversar com o Vitor Trafego Pago',
    },
    paid_traffic_monitoring: {
        commandType: 'paid_traffic_monitoring',
        targetAgent: 'ads-analyst',
        requiredPermission: 'ads',
        label: 'Monitoramento de trafego pago',
        executionMode: 'sync_executor',
        userFacingVerb: 'vou consultar o Vitor Trafego Pago',
    },
    paid_traffic_decision: {
        commandType: 'paid_traffic_decision',
        targetAgent: 'ads-analyst',
        requiredPermission: 'ads',
        label: 'Decisao humana do Vitor',
        executionMode: 'sync_executor',
        userFacingVerb: 'vou registrar sua decisao com o Vitor Trafego Pago',
    },
    content_request: {
        commandType: 'content_request',
        targetAgent: 'blog-intelligence',
        requiredPermission: 'blog',
        label: 'Conteudo editorial',
        executionMode: 'sync_executor',
        userFacingVerb: 'vou conversar com a Isadora Edicao Blog',
    },
    report_request: {
        commandType: 'report_request',
        targetAgent: 'ceo-agent',
        requiredPermission: 'dashboard',
        label: 'Relatorio interno',
        executionMode: 'sync_executor',
        userFacingVerb: 'vou consultar o Arthur CEO IA',
    },
    property_request: {
        commandType: 'property_request',
        targetAgent: 'property-register',
        requiredPermission: 'properties',
        label: 'Consulta de imoveis',
        executionMode: 'sync_executor',
        userFacingVerb: 'vou conversar com a Bianca Cadastro Imoveis',
    },
    finance_request: {
        commandType: 'finance_request',
        targetAgent: 'finance-ops-agent',
        requiredPermission: 'finance',
        label: 'Financeiro',
        executionMode: 'sync_executor',
        userFacingVerb: 'vou encaminhar para o Agente Financeiro',
    },
    identity_check: {
        commandType: 'identity_check',
        targetAgent: 'whatsapp-global-agent',
        requiredPermission: null,
        label: 'Reconhecimento de identidade',
        executionMode: 'conversation',
        userFacingVerb: 'vou conferir seu perfil no WhatsApp Global',
    },
}

function safeText(value: unknown, max = 500) {
    const text = String(value || '').trim().replace(/\s+/g, ' ')
    return text.length > max ? text.slice(0, max) : text
}

function routeDefinitionForIntent(intent: WhatsAppGlobalCommandIntent): PilgerAgentRouteDefinition {
    if (intent.commandType === 'content_request' && (intent.requiredPermission === 'news' || intent.targetAgent === 'news-intelligence')) {
        return {
            commandType: 'content_request',
            targetAgent: 'news-intelligence',
            requiredPermission: 'news',
            label: 'Noticia editorial',
            executionMode: 'sync_executor',
            userFacingVerb: 'vou conversar com a Clara Edicao Noticias',
        }
    }

    return PILGER_ROUTE_DEFINITIONS[intent.commandType] || {
        commandType: intent.commandType || 'general',
        targetAgent: intent.targetAgent || 'whatsapp-global-agent',
        requiredPermission: intent.requiredPermission || null,
        label: intent.label || 'Solicitacao geral',
        executionMode: intent.targetAgent && intent.targetAgent !== 'whatsapp-global-agent'
            ? 'queued_handoff'
            : 'conversation',
        userFacingVerb: 'vou conversar com o agente responsavel',
    }
}

function identityHasPermission(identity: WhatsAppGlobalIdentity, permission?: string | null) {
    if (identity.type === 'blocked') return false
    if (!permission) return true
    return identity.permissions.includes('master_all') || identity.permissions.includes(permission)
}

export function resolvePilgerAgentRoute(params: {
    identity: WhatsAppGlobalIdentity
    intent: WhatsAppGlobalCommandIntent
    allowed?: boolean
}): PilgerAgentRoute {
    const definition = routeDefinitionForIntent(params.intent)
    const targetAgent = resolveAgentCentralProfile(definition.targetAgent)
    const allowed = typeof params.allowed === 'boolean'
        ? params.allowed
        : identityHasPermission(params.identity, definition.requiredPermission ?? params.intent.requiredPermission)

    return {
        commandType: definition.commandType,
        label: definition.label,
        targetAgentId: targetAgent.agentId,
        targetAgent,
        requiredPermission: definition.requiredPermission ?? params.intent.requiredPermission ?? null,
        executionMode: definition.executionMode,
        allowed,
        userFacingVerb: definition.userFacingVerb,
        shouldRecordHandoff: !allowed || targetAgent.agentId !== 'whatsapp-global-agent',
    }
}

export async function recordPilgerAgentRoute(params: {
    supabase: SupabaseLike
    route: PilgerAgentRoute
    identity: WhatsAppGlobalIdentity
    command?: any
    instance?: any
    text?: string | null
    hasMedia?: boolean
    payload?: Record<string, any>
}) {
    const { route, identity, command } = params
    if (!route.shouldRecordHandoff) return null

    const handoffTargets = route.allowed
        ? [route.targetAgentId]
        : ['pilger-ai-rules', 'internal-notifier']

    return recordAgentCentralHandoff({
        supabase: params.supabase as any,
        agentId: 'whatsapp-global-agent',
        eventType: route.allowed
            ? 'pilger_agent_route_created'
            : 'pilger_agent_route_blocked',
        entityType: 'whatsapp_global_command',
        entityId: command?.id || identity.phone,
        source: 'pilger-agent-router',
        label: route.allowed
            ? `Pilger encaminhou ${route.label} para ${route.targetAgent.name}`
            : `Pilger bloqueou ${route.label} por permissao insuficiente`,
        importanceScore: route.allowed ? 76 : 88,
        handoffTargets,
        handoffReason: route.allowed
            ? `Solicitacao classificada como ${route.commandType}`
            : `Permissao exigida: ${route.requiredPermission || 'nenhuma'}`,
        metadata: {
            router_version: ROUTER_VERSION,
            command_id: command?.id || null,
            command_status: command?.status || null,
            command_type: route.commandType,
            target_agent: route.targetAgentId,
            target_agent_name: route.targetAgent.name,
            target_agent_sector: route.targetAgent.sector,
            execution_mode: route.executionMode,
            required_permission: route.requiredPermission || null,
            allowed: route.allowed,
            identity_type: identity.type,
            identity_id: identity.identityId || null,
            identity_label: identity.label,
            identity_source: identity.source,
            permission_keys: identity.permissions,
            instance_id: params.instance?.id || null,
            instance_name: params.instance?.instance_name || null,
            has_media: Boolean(params.hasMedia),
            text_preview: safeText(params.text, 360) || null,
            ...(params.payload || {}),
        },
    })
}

export function buildPilgerAgentRouterAcknowledgement(params: {
    identity: WhatsAppGlobalIdentity
    route: PilgerAgentRoute
}) {
    const { identity, route } = params

    if (!route.allowed) {
        return [
            `${identity.label}, reconheci seu usuario no Pilger, mas este numero nao tem permissao para ${route.label.toLowerCase()}.`,
            'Se precisar desse acesso, solicite a liberacao a um administrador master no painel.',
        ].join('\n')
    }

    if (route.executionMode === 'sync_executor') {
        return [
            `${identity.label}, entendi seu pedido.`,
            `${route.userFacingVerb} e ja te retorno por aqui com o resultado.`,
        ].join('\n')
    }

    if (route.executionMode === 'queued_handoff') {
        return [
            `${identity.label}, entendi seu pedido.`,
            `${route.userFacingVerb}. Assim que o agente responsavel devolver o parecer, eu te aviso por aqui.`,
        ].join('\n')
    }

    return `${identity.label}, estou aqui. Me diga o que voce precisa que eu veja com a equipe.`
}

export function buildPilgerAgentResultMessage(params: {
    identity: WhatsAppGlobalIdentity
    route: PilgerAgentRoute
    agentReply?: string | null
}) {
    const rawReply = String(params.agentReply || '').trim()
    const cleanedReply = rawReply
        .replace(/^Vitor Trafego Pago recebeu seu pedido\.\s*/i, '')
        .replace(/^Vitor Trafego Pago\s*[-–—]\s*/i, '')
        .trim()

    const reply = cleanedReply || [
        'O agente responsavel recebeu o pedido e registrou o parecer no painel.',
        'Nada foi executado automaticamente sem aprovacao humana.',
    ].join('\n')

    return [
        `${params.identity.label}, falei com ${params.route.targetAgent.name} e trouxe o retorno:`,
        '',
        reply,
    ].join('\n')
}
