import { recordEcosystemEvent } from '@/lib/intelligence/ecosystem'

type SupabaseLike = {
  from: (table: string) => any
}

type GovernanceClosureOptions = {
  outcome?: string | null
  learning?: string | null
  actor?: string | null
}

export const PILGER_GOVERNANCE_POLICIES = [
  {
    target_agent: 'ads-analyst',
    target_label: 'Vitor Trafego Pago',
    sector: 'Marketing',
    required_permission: 'ads',
    sla_minutes: 45,
    approval_required: true,
    return_required: true,
    audit_focus: 'Criativo, score, plano de campanha e decisao humana antes de publicar.',
  },
  {
    target_agent: 'blog-intelligence',
    target_label: 'Isadora Edicao Blog',
    sector: 'Marketing',
    required_permission: 'blog',
    sla_minutes: 60,
    approval_required: true,
    return_required: true,
    audit_focus: 'Tema, status editorial, ID do conteudo e aprovacao antes de distribuicao.',
  },
  {
    target_agent: 'news-intelligence',
    target_label: 'Clara Edicao Noticias',
    sector: 'Marketing',
    required_permission: 'news',
    sla_minutes: 60,
    approval_required: true,
    return_required: true,
    audit_focus: 'Pauta, fonte, status da noticia e aprovacao antes de distribuicao.',
  },
  {
    target_agent: 'finance-ops-agent',
    target_label: 'Agente Financeiro',
    sector: 'Financeiro',
    required_permission: 'finance',
    sla_minutes: 30,
    approval_required: true,
    return_required: true,
    audit_focus: 'CPF/CNPJ, comprovante, acao financeira criada e revisao do financeiro.',
  },
  {
    target_agent: 'property-register',
    target_label: 'Bianca Cadastro Imoveis',
    sector: 'Imoveis',
    required_permission: 'properties',
    sla_minutes: 60,
    approval_required: false,
    return_required: true,
    audit_focus: 'Filtros usados, imoveis selecionados e continuidade do cadastro/estoque.',
  },
  {
    target_agent: 'ceo-agent',
    target_label: 'Arthur CEO IA',
    sector: 'Diretoria',
    required_permission: 'dashboard',
    sla_minutes: 45,
    approval_required: false,
    return_required: true,
    audit_focus: 'Resumo executivo, eventos usados e decisao operacional sugerida.',
  },
]

const POLICY_BY_AGENT = new Map(PILGER_GOVERNANCE_POLICIES.map(policy => [policy.target_agent, policy]))

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

function policyFor(command: any) {
  return POLICY_BY_AGENT.get(cleanString(command?.target_agent, 80)) || null
}

function isReturnSent(command: any) {
  return Boolean(safeRecord(command?.result).pilger_return_sent_at)
}

function isReturnPending(command: any) {
  const status = cleanString(command?.status, 40)
  if (isReturnSent(command)) return false
  if (!policyFor(command)) return false
  return status === 'completed' || status === 'failed' || status === 'queued'
}

function isPhase3Escalated(command: any) {
  return Boolean(safeRecord(safeRecord(command?.result).pilger_phase3).last_escalated_at)
}

function isPhase4Closed(command: any) {
  return Boolean(safeRecord(command?.result).pilger_phase4?.closed_at)
}

function needsGovernanceReview(command: any) {
  const status = cleanString(command?.status, 40)
  if (!policyFor(command)) return false
  if (isPhase4Closed(command)) return false
  if (status === 'failed' || status === 'blocked') return true
  if (isPhase3Escalated(command)) return true
  if (isReturnPending(command)) return true
  return status === 'completed' && !isReturnSent(command)
}

function commandPreview(command: any) {
  return cleanString(command?.command_text, 260) || cleanString(command?.command_type, 80) || 'Comando do Pilger'
}

function summarizeGovernanceCommand(command: any) {
  const policy = policyFor(command)
  const result = safeRecord(command?.result)
  return {
    id: command?.id || null,
    target_agent: command?.target_agent || null,
    target_label: policy?.target_label || command?.target_agent || null,
    status: command?.status || null,
    command_type: command?.command_type || null,
    identity_type: command?.identity_type || null,
    identity_label: command?.identity_label || null,
    command_preview: commandPreview(command),
    return_sent: isReturnSent(command),
    return_pending: isReturnPending(command),
    phase3_escalated: isPhase3Escalated(command),
    phase4_closed: isPhase4Closed(command),
    phase4: safeRecord(result.pilger_phase4),
    updated_at: command?.updated_at || null,
    created_at: command?.created_at || null,
  }
}

function defaultLearning(command: any) {
  const policy = policyFor(command)
  const status = cleanString(command?.status, 40)
  if (status === 'failed') return `${policy?.target_label || 'Agente'} falhou; manter revisao humana antes de retorno final.`
  if (isReturnSent(command)) return 'Solicitacao teve retorno registrado pelo Pilger e pode compor historico operacional.'
  if (isReturnPending(command)) return 'Solicitacao precisa de retorno ao usuario antes de fechamento completo.'
  return 'Solicitacao revisada na governanca do Pilger.'
}

export async function buildPilgerGovernanceSummary(supabase: SupabaseLike) {
  try {
    const targetAgents = PILGER_GOVERNANCE_POLICIES.map(policy => policy.target_agent)
    const { data, error } = await supabase
      .from('whatsapp_global_commands')
      .select('id, phone, identity_type, identity_label, command_type, target_agent, status, command_text, result, created_at, updated_at')
      .in('target_agent', targetAgents)
      .order('updated_at', { ascending: false })
      .limit(500)

    if (error) return { ready: false, error: error.message || String(error), policies: PILGER_GOVERNANCE_POLICIES, totals: {}, review_queue: [] }

    const commands = data || []
    const reviewQueue = commands.filter(needsGovernanceReview).slice(0, 24).map(summarizeGovernanceCommand)
    const closedCommands = commands.filter(isPhase4Closed)
    const policies = PILGER_GOVERNANCE_POLICIES.map(policy => {
      const rows = commands.filter((command: any) => cleanString(command?.target_agent, 80) === policy.target_agent)
      return {
        ...policy,
        total_count: rows.length,
        review_count: rows.filter(needsGovernanceReview).length,
        closed_count: rows.filter(isPhase4Closed).length,
        return_pending_count: rows.filter(isReturnPending).length,
      }
    })

    return {
      ready: true,
      error: null,
      policies,
      totals: {
        policy_count: PILGER_GOVERNANCE_POLICIES.length,
        command_count: commands.length,
        returned_count: commands.filter(isReturnSent).length,
        return_pending_count: commands.filter(isReturnPending).length,
        phase3_escalated_count: commands.filter(isPhase3Escalated).length,
        phase4_closed_count: closedCommands.length,
        review_queue_count: commands.filter(needsGovernanceReview).length,
        failed_count: commands.filter((command: any) => command.status === 'failed').length,
        blocked_count: commands.filter((command: any) => command.status === 'blocked').length,
      },
      review_queue: reviewQueue,
    }
  } catch (error: any) {
    return {
      ready: false,
      error: error?.message || String(error),
      policies: PILGER_GOVERNANCE_POLICIES,
      totals: {},
      review_queue: [],
    }
  }
}

export async function closePilgerGovernanceCommand(
  supabase: SupabaseLike,
  commandId: string,
  options: GovernanceClosureOptions = {},
) {
  const { data: command, error } = await supabase
    .from('whatsapp_global_commands')
    .select('*')
    .eq('id', commandId)
    .maybeSingle()

  if (error) throw error
  if (!command?.id) throw new Error('Comando nao encontrado para governanca do Pilger.')

  const policy = policyFor(command)
  if (!policy) throw new Error('Este comando nao pertence a uma politica de governanca do Pilger.')

  const now = new Date().toISOString()
  const previousResult = safeRecord(command.result)
  const timeline = safeArray(previousResult.pilger_phase4_timeline)
  const outcome = cleanString(options.outcome, 120) || (isReturnSent(command) ? 'resolved_with_return' : 'reviewed_pending_return')
  const learning = cleanString(options.learning, 900) || defaultLearning(command)
  const phase4 = {
    closed_at: now,
    closed_by: cleanString(options.actor, 120) || 'admin_whatsapp_global_panel',
    outcome,
    learning,
    policy_agent: policy.target_agent,
    policy_label: policy.target_label,
    required_permission: policy.required_permission,
    approval_required: policy.approval_required,
    return_required: policy.return_required,
    return_sent: isReturnSent(command),
    phase3_escalated: isPhase3Escalated(command),
    governance_status: outcome.includes('pending') ? 'attention' : 'closed',
  }
  const nextResult = {
    ...previousResult,
    pilger_phase4: phase4,
    pilger_phase4_timeline: [
      ...timeline,
      {
        at: now,
        outcome,
        learning,
        status: command.status || null,
        target_agent: command.target_agent || null,
        return_sent: phase4.return_sent,
        phase3_escalated: phase4.phase3_escalated,
      },
    ].slice(-20),
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
    supabase: supabase as any,
    eventType: 'whatsapp_global_pilger_phase4_closed',
    actorType: 'human',
    entityType: 'whatsapp_global_command',
    entityId: commandId,
    source: 'admin-whatsapp-global',
    label: `Governanca do Pilger fechou comando para ${policy.target_label}`,
    importanceScore: phase4.governance_status === 'closed' ? 64 : 74,
    metadata: {
      command_id: commandId,
      target_agent: policy.target_agent,
      target_label: policy.target_label,
      command_type: command.command_type || null,
      status: command.status || null,
      outcome,
      learning,
      return_sent: phase4.return_sent,
      phase3_escalated: phase4.phase3_escalated,
      identity_type: command.identity_type || null,
      identity_label: command.identity_label || null,
      command_preview: commandPreview(command),
    },
  }).catch((eventError: any) => {
    console.warn('[Pilger Governance] central event failed:', eventError?.message || eventError)
  })

  return {
    command: updated,
    phase4,
  }
}
