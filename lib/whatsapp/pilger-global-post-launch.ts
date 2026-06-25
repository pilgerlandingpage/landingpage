type PostLaunchStatus = 'ok' | 'watch' | 'missing'

type PostLaunchInput = {
  phase5Ready?: boolean
  goLiveScore?: number
  totalCommands?: number
  openCommands?: number
  completedCommands?: number
  failedCommands?: number
  blockedCommands?: number
  returnPendingCount?: number
  returnedCount?: number
  governanceReviewCount?: number
  governanceClosedCount?: number
  phase3Escalations?: number
  phase3LastError?: string | null
  finalTestCount?: number
  accessSources?: number
  agentCount?: number
  ecosystemEvents?: number
  ecosystemReady?: boolean
}

function cleanString(value: unknown, max = 500) {
  const text = String(value || '').trim()
  return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

function pct(part: number, total: number) {
  if (!total) return 0
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)))
}

function signal(
  key: string,
  label: string,
  status: PostLaunchStatus,
  detail: string,
  nextAction: string,
  critical = false,
) {
  return { key, label, status, detail, next_action: nextAction, critical }
}

function signalScore(signals: ReturnType<typeof signal>[]) {
  return Math.max(0, Math.round((signals.reduce((sum, row) => {
    if (row.status === 'ok') return sum + 1
    if (row.status === 'watch') return sum + 0.5
    return sum
  }, 0) / Math.max(signals.length, 1)) * 100))
}

export function buildPilgerPostLaunchReport(input: PostLaunchInput) {
  const totalCommands = Number(input.totalCommands || 0)
  const completedCommands = Number(input.completedCommands || 0)
  const failedCommands = Number(input.failedCommands || 0)
  const blockedCommands = Number(input.blockedCommands || 0)
  const returnedCount = Number(input.returnedCount || 0)
  const returnPendingCount = Number(input.returnPendingCount || 0)
  const governanceClosedCount = Number(input.governanceClosedCount || 0)
  const governanceReviewCount = Number(input.governanceReviewCount || 0)
  const finalTestCount = Number(input.finalTestCount || 0)
  const phase3Error = cleanString(input.phase3LastError, 260)
  const commandResolutionRate = pct(completedCommands + failedCommands + blockedCommands, totalCommands)
  const returnCoverageRate = pct(returnedCount, returnedCount + returnPendingCount)
  const governanceCoverageRate = pct(governanceClosedCount, governanceClosedCount + governanceReviewCount)

  const signals = [
    signal(
      'go_live_gate',
      'Portao Fase 5',
      input.phase5Ready ? 'ok' : 'missing',
      input.phase5Ready
        ? `Go-live liberado com score ${input.goLiveScore || 0}%.`
        : `Go-live ainda nao liberado; score atual ${input.goLiveScore || 0}%.`,
      'Fechar os bloqueios do pacote de go-live antes de considerar a operacao estabilizada.',
      true,
    ),
    signal(
      'final_test_plan',
      'Bateria final',
      finalTestCount >= 10 ? 'ok' : 'missing',
      `${finalTestCount} cenario(s) documentados para validacao final.`,
      'Executar a bateria final em ordem e registrar evidencias no painel Global.',
      true,
    ),
    signal(
      'agent_coverage',
      'Cobertura de agentes',
      (input.agentCount || 0) >= 6 ? 'ok' : 'missing',
      `${input.agentCount || 0} agente(s) aparecem na camada operacional do Pilger.`,
      'Garantir que Vitor, Isadora, Clara, Financeiro, Bianca e Arthur estejam cobertos.',
      true,
    ),
    signal(
      'internal_access',
      'Acessos internos',
      (input.accessSources || 0) > 0 ? 'ok' : 'missing',
      `${input.accessSources || 0} fonte(s) de acesso reconheciveis pelo Pilger.`,
      'Manter ao menos um usuario interno cadastrado para teste controlado.',
      true,
    ),
    signal(
      'command_resolution',
      'Resolucao de comandos',
      totalCommands === 0 ? 'watch' : commandResolutionRate >= 70 ? 'ok' : 'watch',
      totalCommands === 0
        ? 'Ainda nao ha comandos suficientes para medir resolucao.'
        : `${commandResolutionRate}% dos comandos possuem estado de conclusao, falha ou bloqueio.`,
      'Depois da bateria final, revisar comandos que ficaram recebidos, em fila ou processando.',
    ),
    signal(
      'return_coverage',
      'Cobertura de retorno',
      returnedCount > 0 ? 'ok' : returnPendingCount > 0 ? 'watch' : 'watch',
      `${returnedCount} retorno(s) enviado(s) e ${returnPendingCount} retorno(s) pendente(s).`,
      'Enviar ao menos uma devolutiva real pelo Pilger e zerar retornos pendentes criticos.',
    ),
    signal(
      'governance_closure',
      'Fechamento de governanca',
      governanceClosedCount > 0 ? 'ok' : governanceReviewCount > 0 ? 'watch' : 'watch',
      `${governanceClosedCount} fechamento(s) e ${governanceReviewCount} revisao(oes) abertas.`,
      'Registrar aprendizado operacional para ao menos um comando real da bateria final.',
    ),
    signal(
      'automation_health',
      'Saude da automacao',
      phase3Error ? 'watch' : 'ok',
      phase3Error || `${input.phase3Escalations || 0} escalonamento(s) recentes sem erro registrado.`,
      phase3Error ? 'Corrigir erro recente antes de liberar acompanhamento automatico sem supervisao.' : 'Acompanhar a primeira janela de cron pos-go-live.',
    ),
    signal(
      'central_audit',
      'Auditoria na Central',
      input.ecosystemReady ? 'ok' : 'missing',
      input.ecosystemReady
        ? `${input.ecosystemEvents || 0} evento(s) disponiveis para trilha de auditoria.`
        : 'Central indisponivel para consolidar auditoria do Pilger.',
      'Confirmar eventos de retorno, governanca e automacao apos a bateria final.',
      true,
    ),
  ]

  const blockers = signals.filter(row => row.status === 'missing' && row.critical)
  const watchpoints = signals.filter(row => row.status === 'watch' || (row.status === 'missing' && !row.critical))
  const score = signalScore(signals)

  return {
    ready: blockers.length === 0,
    status: blockers.length ? 'blocked' : watchpoints.length ? 'watch' : 'stable',
    score,
    blockers: blockers.length,
    watchpoints: watchpoints.length,
    signals,
    metrics: {
      total_commands: totalCommands,
      open_commands: Number(input.openCommands || 0),
      completed_commands: completedCommands,
      failed_commands: failedCommands,
      blocked_commands: blockedCommands,
      command_resolution_rate: commandResolutionRate,
      return_coverage_rate: returnCoverageRate,
      governance_coverage_rate: governanceCoverageRate,
      phase3_escalations: Number(input.phase3Escalations || 0),
    },
    stabilization_checklist: [
      'Executar a bateria final do pre-test em ordem.',
      'Registrar evidencia de colega reconhecido e lead tratado como lead.',
      'Confirmar um bloqueio por permissao com resposta educada.',
      'Confirmar um comando por agente responsavel.',
      'Enviar ao menos um retorno real pelo Pilger.',
      'Fechar ao menos um comando com aprendizado de governanca.',
      'Verificar a primeira janela de automacao sem erro novo.',
    ],
    executive_summary: blockers.length
      ? 'Pilger ainda nao deve ser considerado estabilizado; ha bloqueios criticos antes do pos-go-live.'
      : watchpoints.length
        ? 'Pilger pode seguir em producao assistida com acompanhamento das evidencias e watchpoints.'
        : 'Pilger esta pronto para ser tratado como estabilizado apos a bateria final registrada.',
    next_operating_window: {
      label: blockers.length ? 'correcao antes do teste' : 'producao assistida',
      duration: blockers.length ? 'ate zerar bloqueios criticos' : 'primeiras 24 horas apos bateria final',
      cadence: blockers.length ? 'revisao por ajuste' : 'revisao a cada ciclo de comandos e cron',
    },
  }
}
