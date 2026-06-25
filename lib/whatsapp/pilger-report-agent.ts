import { recordAgentCentralSignal, saveAgentCentralSnapshot } from '@/lib/intelligence/agent-runtime'
import { sendWhatsAppMessage } from '@/lib/uazapi'

type SupabaseLike = {
  from: (table: string) => any
}

type ProcessPilgerReportCommandParams = {
  supabase: SupabaseLike
  command: any
  instance?: any
  instanceToken?: string | null
  sendResponse?: boolean
}

export type ProcessPilgerReportCommandResult = {
  handled: boolean
  whatsappSent: boolean
  snapshotCount?: number
  eventCount?: number
  error?: string
}

function cleanString(value: unknown, max = 1200) {
  const text = String(value || '').trim().replace(/\s+/g, ' ')
  return text.length > max ? text.slice(0, max) : text
}

function formatDate(value: unknown) {
  if (!value) return ''
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function updateCommandStatus(
  supabase: SupabaseLike,
  commandId: string | null,
  status: string,
  result: Record<string, unknown>,
) {
  if (!commandId) return
  await supabase
    .from('whatsapp_global_commands')
    .update({
      status,
      result,
      updated_at: new Date().toISOString(),
    })
    .eq('id', commandId)
}

async function loadExecutiveContext(supabase: SupabaseLike) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [snapshotsResult, eventsResult] = await Promise.all([
    supabase
      .from('ecosystem_context_snapshots')
      .select('id,agent,scope,status,summary,generated_at,created_by')
      .order('generated_at', { ascending: false })
      .limit(8),
    supabase
      .from('ecosystem_events')
      .select('id,event_type,entity_type,source,label,importance_score,occurred_at,metadata')
      .gte('occurred_at', since)
      .order('importance_score', { ascending: false })
      .limit(8),
  ])

  if (snapshotsResult.error) throw snapshotsResult.error
  if (eventsResult.error) throw eventsResult.error

  return {
    snapshots: Array.isArray(snapshotsResult.data) ? snapshotsResult.data : [],
    events: Array.isArray(eventsResult.data) ? eventsResult.data : [],
  }
}

function buildExecutiveReportMessage(params: {
  command: any
  snapshots: any[]
  events: any[]
}) {
  const requester = cleanString(params.command?.identity_label, 80) || 'pessoal'
  const snapshotLines = params.snapshots.slice(0, 4).map((snapshot: any) => {
    const when = formatDate(snapshot.generated_at)
    return `- ${snapshot.agent || 'agente'}${snapshot.scope ? `/${snapshot.scope}` : ''}: ${cleanString(snapshot.summary, 260)}${when ? ` (${when})` : ''}`
  })
  const eventLines = params.events.slice(0, 4).map((event: any) => {
    const score = Number(event.importance_score || 0)
    return `- ${cleanString(event.label || event.event_type, 220)}${score ? ` | score ${score}` : ''}`
  })

  return [
    `${requester}, consultei o Arthur CEO IA na Central.`,
    '',
    'Resumo executivo:',
    snapshotLines.length ? snapshotLines.join('\n') : '- Ainda nao encontrei snapshot executivo recente.',
    '',
    'Sinais importantes das ultimas 24h:',
    eventLines.length ? eventLines.join('\n') : '- Sem evento critico recente registrado na Central.',
    '',
    'Use isso como leitura operacional; quando precisar de um relatorio formal, eu gero a versao completa no painel.',
  ].join('\n')
}

async function sendReportResponse(params: {
  phone: string
  message: string
  instanceToken?: string | null
}) {
  const phone = cleanString(params.phone, 40)
  if (!phone || !params.instanceToken) return false
  try {
    await sendWhatsAppMessage({
      phone,
      message: params.message,
      instanceToken: params.instanceToken,
    })
    return true
  } catch (error: any) {
    console.warn('[Pilger Report] WhatsApp response failed:', error?.message || error)
    return false
  }
}

async function recordReportSignal(params: {
  supabase: SupabaseLike
  command: any
  snapshots: any[]
  events: any[]
}) {
  await recordAgentCentralSignal({
    supabase: params.supabase as any,
    agentId: 'ceo-agent',
    eventType: 'pilger_executive_report_returned',
    entityType: 'whatsapp_global_command',
    entityId: params.command?.id || null,
    source: 'pilger-report-agent',
    label: 'Arthur CEO IA retornou resumo executivo ao Pilger',
    importanceScore: 64,
    metadata: {
      command_id: params.command?.id || null,
      requested_by_phone: params.command?.phone || null,
      requested_by_label: params.command?.identity_label || null,
      snapshot_count: params.snapshots.length,
      event_count: params.events.length,
      snapshot_ids: params.snapshots.map(snapshot => snapshot.id).filter(Boolean),
      event_ids: params.events.map(event => event.id).filter(Boolean),
      text_preview: cleanString(params.command?.command_text, 360) || null,
    },
    handoffTargets: ['whatsapp-global-agent', 'internal-notifier'],
  }).catch((error: any) => {
    console.warn('[Pilger Report] central signal failed:', error?.message || error)
  })

  await saveAgentCentralSnapshot({
    supabase: params.supabase as any,
    agentId: 'ceo-agent',
    scope: 'whatsapp_global_report',
    subjectId: params.command?.id || null,
    createdBy: 'pilger-report-agent',
    summary: `Arthur retornou ao Pilger um resumo com ${params.snapshots.length} snapshot(s) e ${params.events.length} evento(s).`,
    context: {
      command_id: params.command?.id || null,
      snapshots: params.snapshots,
      events: params.events,
    },
    signals: {
      snapshot_count: params.snapshots.length,
      event_count: params.events.length,
      pilger_returned_to_user: true,
    },
  }).catch((error: any) => {
    console.warn('[Pilger Report] central snapshot failed:', error?.message || error)
  })
}

export async function processPilgerReportCommand(
  params: ProcessPilgerReportCommandParams,
): Promise<ProcessPilgerReportCommandResult> {
  const { supabase, command } = params
  if (!command?.id) return { handled: false, whatsappSent: false, error: 'missing_command' }
  if (command.status === 'blocked') return { handled: false, whatsappSent: false, error: 'blocked_command' }
  if (command.command_type !== 'report_request') return { handled: false, whatsappSent: false }

  const instanceToken = params.instanceToken || params.instance?.instance_token || null
  const shouldSendResponse = params.sendResponse !== false

  try {
    await updateCommandStatus(supabase, command.id, 'processing', {
      stage: 'pilger_report_processing_started',
      started_at: new Date().toISOString(),
    })

    const context = await loadExecutiveContext(supabase)
    const result = {
      stage: 'pilger_report_completed',
      snapshot_count: context.snapshots.length,
      event_count: context.events.length,
      completed_at: new Date().toISOString(),
    }

    await updateCommandStatus(supabase, command.id, 'completed', result)
    await recordReportSignal({ supabase, command, snapshots: context.snapshots, events: context.events })

    const whatsappSent = shouldSendResponse
      ? await sendReportResponse({
        phone: command.phone,
        message: buildExecutiveReportMessage({ command, snapshots: context.snapshots, events: context.events }),
        instanceToken,
      })
      : false

    return {
      handled: true,
      whatsappSent,
      snapshotCount: context.snapshots.length,
      eventCount: context.events.length,
    }
  } catch (error: any) {
    const message = error?.message || String(error)
    console.error('[Pilger Report] command failed:', message)
    await updateCommandStatus(supabase, command.id, 'failed', {
      stage: 'pilger_report_failed',
      error: message,
      failed_at: new Date().toISOString(),
    }).catch(() => null)

    const whatsappSent = shouldSendResponse
      ? await sendReportResponse({
        phone: command.phone,
        message: [
          'O Arthur CEO IA recebeu seu pedido de relatorio, mas nao conseguiu montar a leitura agora.',
          'O comando ficou registrado no Pilger para revisao interna.',
        ].join('\n'),
        instanceToken,
      })
      : false

    return {
      handled: true,
      whatsappSent,
      error: message,
    }
  }
}
