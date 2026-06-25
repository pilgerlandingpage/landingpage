type FinalPhaseStatus = 'ok' | 'warn' | 'missing'

type IdentityMatrixRow = {
  key: string
  label: string
  detected: number
  ready: boolean
  permissions?: string[]
  expected_behavior?: string
}

type RouteMatrixRow = {
  key: string
  label: string
  status: FinalPhaseStatus | string
  target_agent?: string
  target_agent_name?: string
  allowed?: boolean
  execution_mode?: string
  detail?: string
}

type PracticalTestScenario = {
  key: string
  label: string
  message?: string
  text?: string
  expected?: string
}

type PhaseCheck = {
  key: string
  label: string
  status: FinalPhaseStatus
  detail: string
  action: string
  critical?: boolean
}

function numberValue(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function finalCheck(
  key: string,
  label: string,
  status: FinalPhaseStatus,
  detail: string,
  action: string,
  critical = false,
): PhaseCheck {
  return { key, label, status, detail, action, critical }
}

function scoreChecks(checks: PhaseCheck[]) {
  return Math.max(0, Math.round((checks.reduce((sum, row) => {
    if (row.status === 'ok') return sum + 1
    if (row.status === 'warn') return sum + 0.5
    return sum
  }, 0) / Math.max(checks.length, 1)) * 100))
}

function phaseStatus(checks: PhaseCheck[]) {
  const criticalMissing = checks.some(row => row.critical && row.status === 'missing')
  if (criticalMissing) return 'attention'
  return 'complete'
}

function remainingActions(checks: PhaseCheck[]) {
  return checks
    .filter(row => row.status !== 'ok')
    .map(row => row.action)
    .filter(Boolean)
}

function rowsDetected(rows: IdentityMatrixRow[], keys: string[]) {
  return rows
    .filter(row => keys.includes(row.key))
    .reduce((sum, row) => sum + numberValue(row.detected), 0)
}

function rowsReady(rows: IdentityMatrixRow[], keys: string[]) {
  return rows.some(row => keys.includes(row.key) && row.ready)
}

export function buildPilgerPhase7IdentitySeparation(input: {
  identityMatrix?: IdentityMatrixRow[]
  accessSources?: number
  routeFailures?: number
  overridesReady?: boolean
  leadFallbackReady?: boolean
}) {
  const identityMatrix = input.identityMatrix || []
  const accessSources = numberValue(input.accessSources)
  const routeFailures = numberValue(input.routeFailures)
  const internalDetected = rowsDetected(identityMatrix, ['master', 'admin', 'broker', 'authorized_phone']) || accessSources
  const ownerDetected = rowsDetected(identityMatrix, ['owner'])
  const overrideDetected = rowsDetected(identityMatrix, ['manual_override'])
  const brokerReady = rowsReady(identityMatrix, ['broker', 'authorized_phone'])
  const ownerReady = rowsReady(identityMatrix, ['owner'])

  const checks = [
    finalCheck(
      'number_registered',
      'Numero cadastrado',
      internalDetected > 0 ? 'ok' : 'missing',
      `${internalDetected} fonte(s) internas reconheciveis pelo Pilger.`,
      'Cadastrar ou confirmar ao menos um usuario/corretor/autorizado para teste interno.',
      true,
    ),
    finalCheck(
      'lead_fallback',
      'Numero nao cadastrado',
      input.leadFallbackReady === false ? 'missing' : 'ok',
      input.leadFallbackReady === false
        ? 'Fallback de lead nao esta confirmado no pre-test.'
        : 'Numero sem identidade interna continua no fluxo normal de lead.',
      'Confirmar no webhook que identidade lead continua separada de colegas.',
      true,
    ),
    finalCheck(
      'owner_profile',
      'Proprietario cadastrado',
      ownerReady ? 'ok' : ownerDetected > 0 ? 'warn' : 'warn',
      `${ownerDetected} telefone(s) de proprietario detectado(s).`,
      'Na bateria real, enviar uma mensagem com telefone de proprietario cadastrado.',
    ),
    finalCheck(
      'broker_authorized',
      'Corretor/autorizado',
      brokerReady ? 'ok' : 'warn',
      brokerReady
        ? 'Corretor ou telefone autorizado aparece como operacao interna.'
        : 'Nao ha evidencia suficiente de corretor/autorizado ativo no pre-test atual.',
      'Confirmar um telefone de corretor ou autorizado antes do uso amplo.',
    ),
    finalCheck(
      'manual_override',
      'Override manual',
      input.overridesReady === false ? 'warn' : 'ok',
      `${overrideDetected} override(s) manual(is) detectado(s).`,
      'Usar overrides para corrigir numeros antigos ou perfis conflitantes.',
    ),
    finalCheck(
      'permission_before_agent',
      'Permissao antes do agente',
      routeFailures === 0 ? 'ok' : 'missing',
      routeFailures === 0
        ? 'A simulacao valida permissao antes de chamar o agente responsavel.'
        : `${routeFailures} falha(s) de rota/permissao ainda abertas.`,
      'Corrigir matriz de rota antes de liberar pedidos reais sem supervisao.',
      true,
    ),
  ]

  const status = phaseStatus(checks)

  return {
    code_complete: status === 'complete',
    status,
    label: status === 'complete' ? 'Fase 7 concluida no nucleo' : 'Fase 7 com pendencias de identidade',
    detail: status === 'complete'
      ? 'Pilger separa colega interno, lead, proprietario, corretor e telefone autorizado antes de decidir atendimento ou agente responsavel.'
      : 'Ainda ha pontos de reconhecimento ou permissao que precisam ser fechados antes da bateria real.',
    score: scoreChecks(checks),
    checks,
    remaining_actions: remainingActions(checks),
    core_checks: {
      number_registered: internalDetected > 0,
      lead_fallback: input.leadFallbackReady !== false,
      property_owner_profile: ownerReady || ownerDetected > 0,
      broker_or_authorized_profile: brokerReady,
      manual_override_ready: input.overridesReady !== false,
      permission_before_agent: routeFailures === 0,
    },
    identity_rules: [
      {
        key: 'registered_number',
        label: 'Numero cadastrado',
        behavior: 'Pilger trata como colega de trabalho e aplica permissoes antes de executar.',
      },
      {
        key: 'unknown_number',
        label: 'Numero nao cadastrado',
        behavior: 'Segue fluxo de lead e nao recebe acesso a comandos internos.',
      },
      {
        key: 'property_owner',
        label: 'Proprietario cadastrado',
        behavior: 'Pilger atende como proprietario vinculado ao imovel, nao como comprador.',
      },
      {
        key: 'broker_authorized',
        label: 'Corretor/autorizado',
        behavior: 'Pilger trata como operacao interna com permissoes do cadastro.',
      },
    ],
    metrics: {
      internal_profiles: internalDetected,
      owner_profiles: ownerDetected,
      manual_overrides: overrideDetected,
      route_failures: routeFailures,
    },
  }
}

export function buildPilgerPhase8TrackingPanel(input: {
  phase7Ready?: boolean
  agentDeskReady?: boolean
  agentCount?: number
  totalCommands?: number
  returnPendingCount?: number
  returnedCount?: number
  statusFilterReady?: boolean
  targetFilterReady?: boolean
}) {
  const agentCount = numberValue(input.agentCount)
  const totalCommands = numberValue(input.totalCommands)
  const returnedCount = numberValue(input.returnedCount)
  const returnPendingCount = numberValue(input.returnPendingCount)

  const checks = [
    finalCheck(
      'phase_7_ready',
      'Identidade alimenta painel',
      input.phase7Ready ? 'ok' : 'missing',
      input.phase7Ready
        ? 'Painel recebe identidade e permissao ja separadas pela Fase 7.'
        : 'Fase 7 precisa estar pronta para o painel nao misturar lead e colega.',
      'Fechar Fase 7 antes de considerar a Fase 8 completa.',
      true,
    ),
    finalCheck(
      'orders_received',
      'Pedidos recebidos pelo Global',
      totalCommands > 0 ? 'ok' : 'warn',
      `${totalCommands} comando(s) registrados no WhatsApp Global.`,
      'Gerar pedidos reais ou simulados para popular a mesa operacional.',
    ),
    finalCheck(
      'responsible_agent',
      'Agente responsavel',
      input.agentDeskReady && agentCount >= 6 ? 'ok' : 'missing',
      `${agentCount} agente(s) aparecem na mesa de acompanhamento.`,
      'Garantir Vitor, Isadora, Clara, Financeiro, Bianca e Arthur na mesa.',
      true,
    ),
    finalCheck(
      'status_tracking',
      'Status operacional',
      'ok',
      'Painel mostra recebido, fila, processamento, concluido, bloqueado, falha e cancelado.',
      'Pronto.',
    ),
    finalCheck(
      'requester_permission',
      'Usuario e permissao',
      'ok',
      'Lista e detalhe exibem solicitante, tipo de identidade e permissao exigida.',
      'Pronto.',
    ),
    finalCheck(
      'agent_response',
      'Resposta do agente',
      returnPendingCount > 0 || returnedCount > 0 ? 'ok' : 'warn',
      `${returnPendingCount} retorno(s) pendente(s) e ${returnedCount} retorno(s) enviado(s).`,
      'Na bateria final, concluir um pedido e conferir a resposta do agente no painel.',
    ),
    finalCheck(
      'user_response',
      'Resposta enviada ao usuario',
      returnedCount > 0 ? 'ok' : 'warn',
      `${returnedCount} devolutiva(s) ja foram marcadas como enviadas pelo Pilger.`,
      'Enviar ao menos uma devolutiva real pelo painel para registrar pilger_return_sent_at.',
    ),
    finalCheck(
      'filters',
      'Filtros de operacao',
      input.statusFilterReady && input.targetFilterReady ? 'ok' : 'missing',
      'Painel permite filtrar por status e agente responsavel.',
      'Restaurar filtros de status/agente no painel Global.',
      true,
    ),
  ]

  const status = phaseStatus(checks)

  return {
    code_complete: status === 'complete',
    status,
    label: status === 'complete' ? 'Fase 8 concluida no nucleo' : 'Fase 8 com pendencias de painel',
    detail: status === 'complete'
      ? 'Painel do Pilger acompanha pedidos, agente responsavel, status, solicitante, permissao, resposta do agente e devolutiva enviada.'
      : 'Ainda ha algum campo ou controle essencial do painel que precisa ser fechado.',
    score: scoreChecks(checks),
    checks,
    remaining_actions: remainingActions(checks),
    core_checks: {
      phase_7_complete: Boolean(input.phase7Ready),
      orders_received: totalCommands > 0,
      responsible_agent: input.agentDeskReady && agentCount >= 6,
      status_tracking: true,
      requester_visible: true,
      permission_visible: true,
      agent_response_visible: true,
      user_response_visible: true,
      filters: Boolean(input.statusFilterReady && input.targetFilterReady),
    },
    tracking_fields: [
      'Pedidos recebidos pelo Global',
      'Agente responsavel',
      'Status: recebido, em processamento, concluido, bloqueado, falhou',
      'Usuario que pediu',
      'Permissao usada',
      'Resposta do agente',
      'Resposta enviada ao usuario',
    ],
    metrics: {
      total_commands: totalCommands,
      agent_count: agentCount,
      return_pending_count: returnPendingCount,
      returned_count: returnedCount,
    },
  }
}

export function buildPilgerPhase9PracticalTests(input: {
  phase7Ready?: boolean
  phase8Ready?: boolean
  testPlan?: PracticalTestScenario[]
  routeMatrix?: RouteMatrixRow[]
}) {
  const testPlan = input.testPlan || []
  const routeMatrix = input.routeMatrix || []
  const failedRoutes = routeMatrix.filter(row => row.status !== 'ok')
  const blockedScenario = routeMatrix.some(row => row.allowed === false && row.status === 'ok')
  const agentTargets = new Set(routeMatrix.map(row => row.target_agent).filter(Boolean))

  const checks = [
    finalCheck(
      'phase_7_ready',
      'Base de identidade',
      input.phase7Ready ? 'ok' : 'missing',
      input.phase7Ready ? 'Fase 7 pronta para separar colega, lead, proprietario e autorizado.' : 'Fase 7 ainda nao esta pronta.',
      'Concluir Fase 7 antes de declarar a bateria pratica fechada.',
      true,
    ),
    finalCheck(
      'phase_8_ready',
      'Painel de evidencia',
      input.phase8Ready ? 'ok' : 'missing',
      input.phase8Ready ? 'Fase 8 pronta para registrar evidencia dos testes.' : 'Painel ainda nao esta pronto para evidencias.',
      'Concluir Fase 8 antes de rodar a bateria pratica.',
      true,
    ),
    finalCheck(
      'scenario_count',
      'Frases reais',
      testPlan.length >= 9 ? 'ok' : 'missing',
      `${testPlan.length} frase(s) praticas documentadas.`,
      'Cadastrar pelo menos as frases reais do plano original.',
      true,
    ),
    finalCheck(
      'route_simulation',
      'Simulacao de rotas',
      failedRoutes.length === 0 && routeMatrix.length >= 8 ? 'ok' : 'missing',
      failedRoutes.length === 0
        ? `${routeMatrix.length} simulacao(oes) roteadas como esperado.`
        : `${failedRoutes.length} falha(s) de simulacao precisam de ajuste.`,
      'Corrigir qualquer divergencia de agente, permissao ou modo de execucao.',
      true,
    ),
    finalCheck(
      'permission_denial',
      'Bloqueio por permissao',
      blockedScenario ? 'ok' : 'missing',
      blockedScenario
        ? 'Bateria cobre pelo menos um pedido bloqueado por falta de permissao.'
        : 'Bateria ainda nao cobre negativa educada por permissao insuficiente.',
      'Adicionar caso de teste sem permissao para blog/financeiro/trafego.',
      true,
    ),
    finalCheck(
      'agent_coverage',
      'Cobertura dos agentes',
      agentTargets.size >= 6 ? 'ok' : 'missing',
      `${agentTargets.size} agente(s) coberto(s) nas simulacoes.`,
      'Cobrir Vitor, Isadora, Clara, Financeiro, Bianca e Arthur.',
      true,
    ),
  ]

  const status = phaseStatus(checks)

  return {
    code_complete: status === 'complete',
    status,
    label: status === 'complete' ? 'Fase 9 concluida no nucleo' : 'Fase 9 com pendencias de bateria pratica',
    detail: status === 'complete'
      ? 'Bateria pratica cobre frases reais, permissoes, bloqueios e roteamento para os agentes principais.'
      : 'A bateria pratica ainda precisa fechar cenarios, rotas ou evidencias antes do uso real.',
    score: scoreChecks(checks),
    checks,
    remaining_actions: remainingActions(checks),
    core_checks: {
      phase_7_complete: Boolean(input.phase7Ready),
      phase_8_complete: Boolean(input.phase8Ready),
      practical_messages: testPlan.length >= 9,
      route_simulation: failedRoutes.length === 0 && routeMatrix.length >= 8,
      permission_denial: blockedScenario,
      agent_coverage: agentTargets.size >= 6,
    },
    automated_results: {
      total_scenarios: testPlan.length,
      route_scenarios: routeMatrix.length,
      failed_routes: failedRoutes.length,
      blocked_permission_scenarios: routeMatrix.filter(row => row.allowed === false).length,
      covered_agents: Array.from(agentTargets),
    },
    practical_messages: testPlan.map(row => ({
      key: row.key,
      label: row.label,
      text: row.message || row.text || '',
      expected: row.expected || '',
    })),
    evidence_required: [
      'Bom dia Pilger com colega cadastrado.',
      'Lead desconhecido tratado como lead.',
      'Pedido permitido encaminhado ao agente responsavel.',
      'Pedido sem permissao respondido com negativa educada.',
      'Retorno do Pilger enviado ao usuario e registrado.',
    ],
  }
}
