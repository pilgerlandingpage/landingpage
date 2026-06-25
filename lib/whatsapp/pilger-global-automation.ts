import { saveAppConfig } from '@/lib/admin/app-config'
import { recordEcosystemEvent } from '@/lib/intelligence/ecosystem'

type SupabaseLike = {
  from: (table: string) => any
}

type RunPilgerGlobalAutomationOptions = {
  dryRun?: boolean
  force?: boolean
  origin?: string | null
  limit?: number
}

type PilgerAutomationEscalation = {
  command_id: string
  target_agent: string
  target_label: string
  status: string
  type: 'open_sla_overdue' | 'return_pending' | 'failed_return_pending'
  severity: 'warn' | 'high' | 'critical'
  age_minutes: number
  threshold_minutes: number
  escalation_key: string
  next_action: string
  identity_label: string | null
  command_preview: string
}

const TARGET_LABELS: Record<string, string> = {
  'ads-analyst': 'Vitor Trafego Pago',
  'blog-intelligence': 'Isadora Edicao Blog',
  'news-intelligence': 'Clara Edicao Noticias',
  'finance-ops-agent': 'Agente Financeiro',
  'property-register': 'Bianca Cadastro Imoveis',
  'ceo-agent': 'Arthur CEO IA',
}

const TARGET_AGENTS = Object.keys(TARGET_LABELS)
const SUPERVISED_STATUSES = ['received', 'queued', 'processing', 'completed', 'failed']
const OPEN_STATUSES = new Set(['received', 'queued', 'processing'])

function cleanString(value: unknown, max = 500) {
  const text = String(value || '').trim()
  return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

function safeRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function safeArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function minutesSince(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY
  return Math.max(0, Math.round((Date.now() - time) / 60000))
}

function parsePositiveInt(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function commandAgeMinutes(command: any) {
  return minutesSince(command?.updated_at || command?.created_at)
}

function targetLabel(targetAgent: string) {
  return TARGET_LABELS[targetAgent] || targetAgent || 'Agente responsavel'
}

function isReturnAlreadySent(command: any) {
  return Boolean(safeRecord(command?.result).pilger_return_sent_at)
}

function isReturnPending(command: any) {
  const status = cleanString(command?.status, 40)
  if (isReturnAlreadySent(command)) return false
  if (!TARGET_AGENTS.includes(cleanString(command?.target_agent, 80))) return false
  if (status === 'completed' || status === 'failed') return true
  return status === 'queued' && safeRecord(command?.result).awaiting_field === 'counterparty_type'
}

function thresholdFor(command: any, type: PilgerAutomationEscalation['type']) {
  const status = cleanString(command?.status, 40)
  const result = safeRecord(command?.result)
  if (type === 'failed_return_pending') return 15
  if (type === 'return_pending') return 30
  if (status === 'processing') return 45
  if (status === 'received') return 20
  if (status === 'queued' && result.awaiting_field === 'counterparty_type') return 240
  if (status === 'queued') return 60
  return 60
}

function severityFor(ageMinutes: number, thresholdMinutes: number): PilgerAutomationEscalation['severity'] {
  if (ageMinutes >= thresholdMinutes * 4) return 'critical'
  if (ageMinutes >= thresholdMinutes * 2) return 'high'
  return 'warn'
}

function nextActionFor(command: any, type: PilgerAutomationEscalation['type']) {
  const status = cleanString(command?.status, 40)
  const result = safeRecord(command?.result)
  if (type === 'failed_return_pending') return 'Revisar falha do agente e enviar retorno educado ao usuario.'
  if (type === 'return_pending') return 'Enviar retorno do Pilger ao usuario pelo painel Global.'
  if (status === 'queued' && result.awaiting_field === 'counterparty_type') return 'Acompanhar resposta CPF/CNPJ para destravar o Financeiro.'
  if (status === 'processing') return 'Verificar o agente responsavel e destravar processamento.'
  return 'Processar o pedido com o agente responsavel ou marcar status correto.'
}

function buildEscalation(command: any): PilgerAutomationEscalation | null {
  const status = cleanString(command?.status, 40)
  const targetAgent = cleanString(command?.target_agent, 80)
  if (!TARGET_AGENTS.includes(targetAgent)) return null

  const ageMinutes = commandAgeMinutes(command)
  if (!Number.isFinite(ageMinutes)) return null

  let type: PilgerAutomationEscalation['type'] | null = null
  if (status === 'failed' && isReturnPending(command)) type = 'failed_return_pending'
  else if (isReturnPending(command)) type = 'return_pending'
  else if (OPEN_STATUSES.has(status)) type = 'open_sla_overdue'

  if (!type) return null

  const thresholdMinutes = thresholdFor(command, type)
  if (ageMinutes < thresholdMinutes) return null

  const label = targetLabel(targetAgent)
  return {
    command_id: String(command.id),
    target_agent: targetAgent,
    target_label: label,
    status,
    type,
    severity: severityFor(ageMinutes, thresholdMinutes),
    age_minutes: ageMinutes,
    threshold_minutes: thresholdMinutes,
    escalation_key: `${type}:${targetAgent}:${status}`,
    next_action: nextActionFor(command, type),
    identity_label: cleanString(command?.identity_label, 160) || null,
    command_preview: cleanString(command?.command_text, 360),
  }
}

function summarizeAgents(commands: any[], escalations: PilgerAutomationEscalation[]) {
  return TARGET_AGENTS.map(agentId => {
    const rows = commands.filter(command => cleanString(command?.target_agent, 80) === agentId)
    const agentEscalations = escalations.filter(item => item.target_agent === agentId)
    return {
      target_agent: agentId,
      target_label: targetLabel(agentId),
      total_count: rows.length,
      open_count: rows.filter(command => OPEN_STATUSES.has(cleanString(command?.status, 40))).length,
      return_pending_count: rows.filter(isReturnPending).length,
      escalated_count: agentEscalations.length,
      highest_severity: agentEscalations.some(item => item.severity === 'critical')
        ? 'critical'
        : agentEscalations.some(item => item.severity === 'high')
          ? 'high'
          : agentEscalations.some(item => item.severity === 'warn')
            ? 'warn'
            : 'ok',
    }
  })
}

async function readAutomationConfig(supabase: SupabaseLike) {
  const { data } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', [
      'pilger_global_automation_enabled',
      'pilger_global_automation_min_repeat_minutes',
    ])

  return Object.fromEntries((data || []).map((row: any) => [String(row.key), String(row.value || '')]))
}

async function saveAutomationState(supabase: SupabaseLike, values: Record<string, string>) {
  await Promise.all(
    Object.entries(values).map(([key, value]) => saveAppConfig(supabase, key, value).catch(() => {})),
  )
}

async function updateCommandEscalation(supabase: SupabaseLike, command: any, escalation: PilgerAutomationEscalation, checkedAt: string) {
  const previousResult = safeRecord(command?.result)
  const timeline = safeArray(previousResult.pilger_phase3_timeline)
  const nextResult = {
    ...previousResult,
    pilger_phase3: {
      last_checked_at: checkedAt,
      last_escalated_at: checkedAt,
      last_escalation_key: escalation.escalation_key,
      severity: escalation.severity,
      type: escalation.type,
      age_minutes: escalation.age_minutes,
      threshold_minutes: escalation.threshold_minutes,
      next_action: escalation.next_action,
    },
    pilger_phase3_timeline: [
      ...timeline,
      {
        at: checkedAt,
        type: escalation.type,
        severity: escalation.severity,
        status: escalation.status,
        target_agent: escalation.target_agent,
        age_minutes: escalation.age_minutes,
        next_action: escalation.next_action,
      },
    ].slice(-16),
  }

  await supabase
    .from('whatsapp_global_commands')
    .update({
      result: nextResult,
      updated_at: checkedAt,
    })
    .eq('id', command.id)
}

async function recordEscalationEvent(supabase: SupabaseLike, command: any, escalation: PilgerAutomationEscalation, checkedAt: string) {
  await recordEcosystemEvent({
    supabase: supabase as any,
    eventType: 'whatsapp_global_pilger_phase3_escalation',
    actorType: 'agent',
    entityType: 'whatsapp_global_command',
    entityId: escalation.command_id,
    source: 'pilger-global-automation',
    label: `Pilger Fase 3 sinalizou ${escalation.target_label}: ${escalation.next_action}`,
    importanceScore: escalation.severity === 'critical' ? 88 : escalation.severity === 'high' ? 78 : 66,
    occurredAt: checkedAt,
    metadata: {
      command_id: escalation.command_id,
      target_agent: escalation.target_agent,
      target_label: escalation.target_label,
      command_type: command?.command_type || null,
      status: escalation.status,
      type: escalation.type,
      severity: escalation.severity,
      age_minutes: escalation.age_minutes,
      threshold_minutes: escalation.threshold_minutes,
      identity_type: command?.identity_type || null,
      identity_label: command?.identity_label || null,
      next_action: escalation.next_action,
      command_preview: escalation.command_preview,
    },
  }).catch((error: any) => {
    console.warn('[Pilger Global Automation] central event failed:', error?.message || error)
  })
}

export async function runPilgerGlobalAutomation(
  supabase: SupabaseLike,
  options: RunPilgerGlobalAutomationOptions = {},
) {
  const checkedAt = new Date().toISOString()
  const dryRun = options.dryRun === true
  const force = options.force === true
  const limit = Math.max(50, Math.min(600, Number(options.limit || 400)))
  const config = await readAutomationConfig(supabase)
  const enabled = config.pilger_global_automation_enabled !== 'false'
  const minRepeatMinutes = parsePositiveInt(config.pilger_global_automation_min_repeat_minutes, 180)

  if (!enabled && !force) {
    if (!dryRun) {
      await saveAutomationState(supabase, {
        pilger_global_cron_last_checked_at: checkedAt,
        pilger_global_cron_last_reason: 'disabled',
      })
    }

    return {
      success: true,
      skipped: true,
      reason: 'disabled',
      checked_at: checkedAt,
      dry_run: dryRun,
      summary: {
        total_commands: 0,
        open_count: 0,
        return_pending_count: 0,
        escalated_count: 0,
        skipped_recent_count: 0,
      },
      agents: summarizeAgents([], []),
      escalations: [],
    }
  }

  const { data, error } = await supabase
    .from('whatsapp_global_commands')
    .select('id, phone, identity_type, identity_label, command_type, target_agent, status, command_text, result, created_at, updated_at')
    .in('target_agent', TARGET_AGENTS)
    .in('status', SUPERVISED_STATUSES)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  const commands = data || []
  const candidates = commands.map(buildEscalation).filter(Boolean) as PilgerAutomationEscalation[]
  const escalations: PilgerAutomationEscalation[] = []
  let skippedRecentCount = 0

  for (const escalation of candidates) {
    const command = commands.find((row: any) => String(row.id) === escalation.command_id)
    const phase3 = safeRecord(safeRecord(command?.result).pilger_phase3)
    const lastKey = cleanString(phase3.last_escalation_key, 160)
    const lastAt = cleanString(phase3.last_escalated_at, 80)
    const recentDuplicate = !force
      && lastKey === escalation.escalation_key
      && minutesSince(lastAt) < minRepeatMinutes

    if (recentDuplicate) {
      skippedRecentCount += 1
      continue
    }

    escalations.push(escalation)
  }

  if (!dryRun) {
    for (const escalation of escalations) {
      const command = commands.find((row: any) => String(row.id) === escalation.command_id)
      if (!command) continue
      await updateCommandEscalation(supabase, command, escalation, checkedAt)
      await recordEscalationEvent(supabase, command, escalation, checkedAt)
    }

    await saveAutomationState(supabase, {
      pilger_global_cron_last_checked_at: checkedAt,
      pilger_global_cron_last_reason: escalations.length ? 'escalations_recorded' : 'no_escalations',
      pilger_global_cron_last_run_at: checkedAt,
      pilger_global_cron_last_escalations: String(escalations.length),
      pilger_global_cron_last_result: JSON.stringify({
        checked_at: checkedAt,
        total_commands: commands.length,
        escalated_count: escalations.length,
        skipped_recent_count: skippedRecentCount,
        agents: summarizeAgents(commands, escalations),
        escalations: escalations.slice(0, 20),
      }).slice(0, 5000),
      pilger_global_cron_last_error: '',
      pilger_global_cron_last_error_at: '',
    })
  }

  const agents = summarizeAgents(commands, escalations)
  return {
    success: true,
    skipped: false,
    reason: escalations.length ? 'escalations_recorded' : 'no_escalations',
    checked_at: checkedAt,
    dry_run: dryRun,
    summary: {
      total_commands: commands.length,
      open_count: commands.filter((command: any) => OPEN_STATUSES.has(cleanString(command?.status, 40))).length,
      return_pending_count: commands.filter(isReturnPending).length,
      escalated_count: escalations.length,
      skipped_recent_count: skippedRecentCount,
    },
    agents,
    escalations,
  }
}
