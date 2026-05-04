import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

type AgentLogSeverity = 'info' | 'success' | 'warning' | 'error'

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

function clampNumber(raw: string | null, fallback: number, min: number, max: number) {
    const parsed = Number.parseInt(String(raw || ''), 10)
    if (!Number.isFinite(parsed)) return fallback
    return Math.min(max, Math.max(min, parsed))
}

function isAgentRuntimeRow(row: any) {
    const action = String(row?.action || '').toLowerCase()
    return row?.event_type === 'agent_runtime'
        || action.startsWith('agent_')
        || action === 'dispatched'
        || action === 'responded_fast_webhook'
        || action === 'broker_assistant_handled'
        || action.startsWith('ignored_')
        || action === 'error'
}

function getSeverity(row: any): AgentLogSeverity {
    const action = String(row?.action || '').toLowerCase()
    const statusCode = Number(row?.status_code || 200)
    if (row?.error || statusCode >= 500 || /(error|erro|fail|failed|timeout|exception)/.test(action)) return 'error'
    if (/(skip|ignored|empty|stale|no_queue|no_pending|already_processed|consumed)/.test(action)) return 'warning'
    if (/(sent|responded|processed|dispatched|handled|ready|read)/.test(action)) return 'success'
    return 'info'
}

function getSummary(row: any) {
    const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {}
    const action = String(row?.action || '')
    const reason = typeof payload.reason === 'string' ? payload.reason : ''
    const queueReason = typeof payload.queueReason === 'string' ? payload.queueReason : ''
    const count = typeof payload.count === 'number' ? payload.count : null
    const responseLength = typeof payload.responseLength === 'number' ? payload.responseLength : null

    if (action === 'agent_skip_stale_queue') return 'Execucao antiga ignorada para nao consumir uma mensagem nova.'
    if (action === 'agent_batch_read') return count != null ? `Lote lido com ${count} item(ns).` : 'Lote de mensagens lido.'
    if (action === 'agent_response_sent') return responseLength != null ? `Resposta enviada (${responseLength} caracteres).` : 'Resposta enviada.'
    if (action === 'agent_no_pending_after_debounce') return 'Fila vazia depois da espera de agrupamento.'
    if (action === 'agent_empty_input') return 'Entrada vazia depois do processamento.'
    if (reason || queueReason) return reason || queueReason
    if (row?.error) return String(row.error)
    return action.replace(/_/g, ' ')
}

async function loadAppConfigAgentLogs(supabase: ReturnType<typeof getSupabase>, since: string, limit: number) {
    const { data, error } = await supabase
        .from('app_config')
        .select('key, value, updated_at')
        .like('key', '_agentlog_%')
        .gte('updated_at', since)
        .order('updated_at', { ascending: false })
        .limit(limit)

    if (error) throw error

    return (data || [])
        .map((row: any) => {
            try {
                const parsed = JSON.parse(String(row.value || '{}'))
                return {
                    ...parsed,
                    id: parsed.id || row.key,
                    created_at: parsed.created_at || row.updated_at,
                    event_type: parsed.event_type || 'agent_runtime',
                }
            } catch {
                return null
            }
        })
        .filter(Boolean)
}

export async function GET(request: NextRequest) {
    try {
        const params = request.nextUrl.searchParams
        const limit = clampNumber(params.get('limit'), 100, 10, 200)
        const hours = clampNumber(params.get('hours'), 24, 1, 168)
        const phone = String(params.get('phone') || '').replace(/\D/g, '')
        const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
        const queryLimit = Math.min(600, Math.max(limit * 4, limit))

        const supabase = getSupabase()
        let query = supabase
            .from('whatsapp_webhook_audit_logs')
            .select('id, created_at, instance_name, event_type, message_type, action, status_code, from_phone, sender_name, payload, error')
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(queryLimit)

        if (phone) query = query.eq('from_phone', phone)

        const { data, error } = await query
        let auditRows: any[] = []
        let auditWarning: string | null = null
        if (error) {
            const message = String(error.message || '')
            if (/whatsapp_webhook_audit_logs|schema cache|could not find/i.test(message)) {
                auditWarning = message
            } else {
                return NextResponse.json({ success: false, message: error.message }, { status: 500 })
            }
        } else {
            auditRows = data || []
        }

        const appConfigRows = await loadAppConfigAgentLogs(supabase, since, queryLimit)
        const combinedRows = [
            ...appConfigRows,
            ...auditRows.filter(row => row?.event_type !== 'agent_runtime'),
        ]
            .filter(isAgentRuntimeRow)
            .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())

        if (phone) {
            combinedRows.splice(0, combinedRows.length, ...combinedRows.filter((row: any) => String(row.from_phone || '').replace(/\D/g, '') === phone))
        }

        const logs = combinedRows
            .slice(0, limit)
            .map((row: any) => {
                const severity = getSeverity(row)
                return {
                    id: row.id,
                    created_at: row.created_at,
                    instance_name: row.instance_name,
                    event_type: row.event_type,
                    message_type: row.message_type,
                    action: row.action,
                    status_code: row.status_code,
                    from_phone: row.from_phone,
                    sender_name: row.sender_name,
                    payload: row.payload || {},
                    error: row.error || null,
                    severity,
                    summary: getSummary(row),
                }
            })

        const summary = logs.reduce(
            (acc, log) => {
                acc.total += 1
                acc[log.severity] += 1
                return acc
            },
            { total: 0, info: 0, success: 0, warning: 0, error: 0 } as Record<AgentLogSeverity | 'total', number>
        )

        return NextResponse.json({
            success: true,
            logs,
            summary,
            hours,
            audit_warning: auditWarning,
            generated_at: new Date().toISOString(),
        })
    } catch (error) {
        console.error('[Admin][Agent Logs] Failed to load logs:', error)
        return NextResponse.json({ success: false, message: 'Erro ao carregar logs dos agentes' }, { status: 500 })
    }
}
