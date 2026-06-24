import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { recordEcosystemEvent } from '@/lib/intelligence/ecosystem'
import { isWhatsAppGlobalInstance } from '@/lib/whatsapp/global-identity'

export const dynamic = 'force-dynamic'

const COMMAND_STATUSES = new Set(['received', 'blocked', 'queued', 'processing', 'completed', 'failed', 'cancelled'])

const TARGET_AGENT_LABELS: Record<string, string> = {
    'whatsapp-global-agent': 'WhatsApp Global',
    'ads-analyst': 'Vitor Trafego Pago',
    'blog-intelligence': 'Editorial/Blog',
    'ceo-agent': 'Diretoria/CEO',
    'property-register': 'Imoveis/Estoque',
}

const COMMAND_TYPE_LABELS: Record<string, string> = {
    general: 'Conversa geral',
    media_received: 'Midia recebida',
    identity_check: 'Reconhecimento',
    paid_traffic: 'Trafego pago',
    paid_traffic_decision: 'Decisao Vitor',
    paid_traffic_monitoring: 'Monitoramento Vitor',
    content_request: 'Conteudo editorial',
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
        result: row.result || {},
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
            sessionsCount,
            overridesCount,
            adminUsersCount,
            virtualBrokersCount,
            brokerAuthorizedCount,
            propertyOwnerLegacyCount,
            propertyOwnerPrivateCount,
        ] = await Promise.all([
            getRecentCommands(supabase, { limit, status, target }),
            getMetrics(supabase),
            safeCount(supabase, 'whatsapp_global_sessions'),
            safeCount(supabase, 'whatsapp_global_identity_overrides'),
            safeCount(supabase, 'admin_users', query => query.not('phone', 'is', null).eq('is_active', true)),
            safeCount(supabase, 'virtual_brokers', query => query.not('phone', 'is', null).eq('is_active', true)),
            safeCount(supabase, 'broker_assistant_authorized_phones', query => query.eq('is_active', true)),
            safeCount(supabase, 'properties', query => query.not('owner_phone', 'is', null)),
            safeCount(supabase, 'property_private_details', query => query.not('owner_phones', 'is', null)),
        ])

        return NextResponse.json({
            success: true,
            ready: Boolean(commands.ready && metrics.ready),
            global_instance: serializeInstance(globalInstance),
            migration_ready: Boolean(commands.ready && sessionsCount.ready && overridesCount.ready),
            diagnostics: {
                commands_ready: commands.ready,
                sessions_ready: sessionsCount.ready,
                overrides_ready: overridesCount.ready,
                commands_error: commands.error,
                sessions_error: sessionsCount.error,
                overrides_error: overridesCount.error,
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
        const commandId = cleanText(body?.command_id, 80)
        const nextStatus = cleanText(body?.status, 40)
        const note = cleanText(body?.note, 800)

        if (!commandId) {
            return NextResponse.json({ success: false, error: 'command_id obrigatorio.' }, { status: 400 })
        }
        if (!COMMAND_STATUSES.has(nextStatus)) {
            return NextResponse.json({ success: false, error: 'Status invalido.' }, { status: 400 })
        }

        const supabase = createAdminClient()
        const { data: current, error: readError } = await supabase
            .from('whatsapp_global_commands')
            .select('*')
            .eq('id', commandId)
            .maybeSingle()

        if (readError) throw readError
        if (!current?.id) return NextResponse.json({ success: false, error: 'Comando nao encontrado.' }, { status: 404 })

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
