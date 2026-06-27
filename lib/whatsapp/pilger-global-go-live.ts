type GoLiveCheckStatus = 'ok' | 'warn' | 'missing'

type GoLiveInput = {
  phase1Ready?: boolean
  phase2Ready?: boolean
  phase3Ready?: boolean
  phase4Ready?: boolean
  hasGlobalInstance?: boolean
  hasInstanceToken?: boolean
  globalInstanceConnected?: boolean
  webhookReady?: boolean | null
  webhookMissingEvents?: number
  webhookMissingExcludes?: number
  accessSources?: number
  routeFailures?: number | null
  agentDeskReady?: boolean
  agentQueueCount?: number
  returnPendingCount?: number
  returnedCount?: number
  hasCronSecret?: boolean
  phase3LastError?: string | null
  governanceReady?: boolean
  governancePolicyCount?: number
  governanceReviewCount?: number
  governanceClosedCount?: number
  finalTestCount?: number
  ecosystemReady?: boolean
}

function cleanString(value: unknown, max = 500) {
  const text = String(value || '').trim()
  return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

function check(
  key: string,
  label: string,
  status: GoLiveCheckStatus,
  detail: string,
  action: string,
  critical = false,
) {
  return { key, label, status, detail, action, critical }
}

function scoreChecks(checks: ReturnType<typeof check>[]) {
  return Math.max(0, Math.round((checks.reduce((sum, row) => {
    if (row.status === 'ok') return sum + 1
    if (row.status === 'warn') return sum + 0.5
    return sum
  }, 0) / Math.max(checks.length, 1)) * 100))
}

export function buildPilgerGoLivePacket(input: GoLiveInput) {
  const webhookKnown = typeof input.webhookReady === 'boolean'
  const routeKnown = typeof input.routeFailures === 'number'
  const phase3Error = cleanString(input.phase3LastError, 240)

  const checks = [
    check(
      'phase_chain',
      'Fases 1 a 4',
      input.phase1Ready && input.phase2Ready && input.phase3Ready && input.phase4Ready ? 'ok' : 'missing',
      input.phase1Ready && input.phase2Ready && input.phase3Ready && input.phase4Ready
        ? 'Reconhecimento, mesa operacional, automacao e governanca estao encadeados.'
        : 'Alguma fase anterior ainda nao esta fechada no nucleo operacional.',
      'Fechar as pendencias das fases anteriores antes de colocar o Pilger em producao assistida.',
      true,
    ),
    check(
      'global_instance',
      'Instancia global',
      input.hasGlobalInstance && input.hasInstanceToken && input.globalInstanceConnected ? 'ok' : 'missing',
      input.hasGlobalInstance
        ? input.globalInstanceConnected
          ? 'Instancia global conectada e pronta para responder como Pilger.'
          : 'Instancia global encontrada, mas ainda nao esta conectada.'
        : 'Nenhuma instancia global foi localizada.',
      'Conectar e marcar a instancia global antes da bateria real pelo WhatsApp.',
      true,
    ),
    check(
      'webhook_gate',
      'Webhook ConnectyHub',
      webhookKnown
        ? input.webhookReady && !input.webhookMissingEvents && !input.webhookMissingExcludes ? 'ok' : 'warn'
        : 'warn',
      webhookKnown
        ? input.webhookReady
          ? 'Webhook validado com eventos e filtros exigidos para o WhatsApp Global.'
          : `${input.webhookMissingEvents || 0} evento(s) e ${input.webhookMissingExcludes || 0} filtro(s) precisam de ajuste.`
        : 'Valide o webhook pelo pre-test antes da bateria final.',
      'Usar Reparar webhook no pre-test se houver divergencia de eventos ou filtros.',
    ),
    check(
      'access_sources',
      'Acessos internos',
      (input.accessSources || 0) > 0 ? 'ok' : 'missing',
      `${input.accessSources || 0} fonte(s) de acesso interno estao disponiveis para o Pilger reconhecer colegas.`,
      'Cadastrar ao menos um acesso controlado para teste real de permissao.',
      true,
    ),
    check(
      'route_matrix',
      'Matriz de rotas',
      routeKnown ? input.routeFailures === 0 ? 'ok' : 'missing' : 'warn',
      routeKnown
        ? input.routeFailures === 0
          ? 'Simulacoes de destino, permissao e executor estao coerentes.'
          : `${input.routeFailures} falha(s) de rota ainda precisam ser corrigidas.`
        : 'Confirme a matriz de rotas no pre-test antes da bateria final.',
      'Rodar a simulacao do Pilger e corrigir qualquer destino ou permissao divergente.',
      routeKnown,
    ),
    check(
      'agent_desk',
      'Mesa dos agentes',
      input.agentDeskReady && (input.agentQueueCount || 0) >= 6 ? 'ok' : 'missing',
      `${input.agentQueueCount || 0} agente(s) aparecem na mesa operacional do Pilger.`,
      'Garantir que Vitor, Isadora, Clara, Financeiro, Bianca e Arthur aparecem na mesa.',
      true,
    ),
    check(
      'return_loop',
      'Retorno ao usuario',
      (input.returnedCount || 0) > 0
        ? 'ok'
        : (input.returnPendingCount || 0) > 0 ? 'warn' : 'warn',
      `${input.returnedCount || 0} retorno(s) enviado(s); ${input.returnPendingCount || 0} retorno(s) pendente(s).`,
      'Na bateria final, concluir ao menos um pedido e enviar a devolutiva pelo Pilger.',
    ),
    check(
      'automation_watch',
      'Monitoramento',
      phase3Error ? 'warn' : 'ok',
      phase3Error || 'Automacao do Pilger sem erro recente registrado.',
      phase3Error ? 'Corrigir o erro recente antes de deixar o cron sem supervisao.' : 'Manter a primeira rodada em producao assistida.',
    ),
    check(
      'cron_secret',
      'CRON_SECRET',
      input.hasCronSecret ? 'ok' : 'warn',
      input.hasCronSecret
        ? 'Rotas automaticas podem rodar protegidas em producao.'
        : 'Runtime atual nao expoe CRON_SECRET; chamadas manuais continuam disponiveis.',
      'Configurar CRON_SECRET em producao antes de depender do Vercel Cron.',
    ),
    check(
      'governance',
      'Governanca',
      input.governanceReady && (input.governancePolicyCount || 0) >= 6 ? 'ok' : 'missing',
      `${input.governancePolicyCount || 0} politica(s), ${input.governanceReviewCount || 0} revisao(oes), ${input.governanceClosedCount || 0} fechamento(s).`,
      'Manter politicas por agente e fechar aprendizados relevantes apos cada pedido real.',
      true,
    ),
    check(
      'governance_evidence',
      'Evidencia de aprendizado',
      (input.governanceClosedCount || 0) > 0 ? 'ok' : 'warn',
      (input.governanceClosedCount || 0) > 0
        ? 'Ja existe ao menos um fechamento de governanca registrado.'
        : 'Ainda falta uma evidencia real de fechamento da Fase 4.',
      'Fechar ao menos um comando real com aprendizado operacional no painel Global.',
    ),
    check(
      'final_test_suite',
      'Bateria final',
      (input.finalTestCount || 0) >= 10 ? 'ok' : 'missing',
      `${input.finalTestCount || 0} cenario(s) estao preparados para a bateria final.`,
      'Executar a bateria final em ordem quando a operacao autorizar os testes.',
      true,
    ),
    check(
      'central',
      'Central de Inteligencia',
      input.ecosystemReady ? 'ok' : 'missing',
      input.ecosystemReady
        ? 'Eventos e aprendizados podem ser consolidados na Central.'
        : 'Central indisponivel para registrar sinais do go-live.',
      'Restaurar a Central antes de promover o Pilger para uso assistido.',
      true,
    ),
  ]

  const blockers = checks.filter(row => row.status === 'missing' && row.critical)
  const warnings = checks.filter(row => row.status === 'warn' || (row.status === 'missing' && !row.critical))
  const score = scoreChecks(checks)
  const status = blockers.length ? 'blocked' : warnings.length ? 'attention' : 'ready'

  return {
    ready: blockers.length === 0,
    status,
    launch_state: blockers.length ? 'blocked' : warnings.length ? 'ready_with_watchpoints' : 'ready_for_final_tests',
    score,
    blockers: blockers.length,
    warnings: warnings.length,
    checks,
    checklist: checks.map(row => ({
      key: row.key,
      label: row.label,
      status: row.status,
      action: row.status === 'ok' ? 'Pronto.' : row.action,
    })),
    final_test_runbook: [
      {
        step: 1,
        label: 'Validar reconhecimento',
        detail: 'Enviar uma mensagem de colega cadastrado e uma mensagem de lead desconhecido.',
        evidence: 'Pilger trata colega como interno e lead como atendimento normal.',
      },
      {
        step: 2,
        label: 'Validar permissoes',
        detail: 'Executar um pedido permitido e um pedido sem permissao.',
        evidence: 'Pedido permitido entra no agente responsavel; pedido bloqueado recebe negativa educada.',
      },
      {
        step: 3,
        label: 'Validar agentes',
        detail: 'Rodar um cenario real para Vitor, Isadora, Clara, Financeiro, Bianca e Arthur.',
        evidence: 'Cada pedido aparece no painel Global com target_agent correto.',
      },
      {
        step: 4,
        label: 'Validar retorno',
        detail: 'Concluir um pedido e enviar a devolutiva pelo Pilger.',
        evidence: 'Comando recebe pilger_return_sent_at e evento na Central.',
      },
      {
        step: 5,
        label: 'Validar governanca',
        detail: 'Fechar um comando com aprendizado operacional.',
        evidence: 'Comando recebe pilger_phase4 e evento whatsapp_global_pilger_phase4_closed.',
      },
      {
        step: 6,
        label: 'Validar monitoramento',
        detail: 'Rodar a automacao manual ou aguardar a primeira execucao protegida.',
        evidence: 'app_config registra pilger_global_cron_last_checked_at e sem erro novo.',
      },
    ],
    required_evidence: [
      'Um lead desconhecido atendido como lead, sem acesso interno.',
      'Um colega reconhecido por telefone e permissao.',
      'Um bloqueio educado por falta de permissao.',
      'Um comando real para cada agente responsavel.',
      'Um retorno enviado pelo Pilger ao usuario.',
      'Um fechamento de governanca com aprendizado registrado.',
      'Uma execucao de automacao do Pilger sem erro recente.',
    ],
    rollback_plan: [
      {
        label: 'Pausar automacao',
        action: 'Definir pilger_global_automation_enabled=false no app_config.',
      },
      {
        label: 'Operar manualmente',
        action: 'Usar o painel WhatsApp Global para processar, retornar e fechar governanca sem depender do cron.',
      },
      {
        label: 'Reverter instancia',
        action: 'Remover a marcacao global/agent_default_instance_id ou trocar para uma instancia de homologacao.',
      },
      {
        label: 'Preservar auditoria',
        action: 'Nao apagar comandos; marcar como cancelled ou blocked para manter historico.',
      },
    ],
    handoff: {
      owner: 'Pilger WhatsApp Global',
      mode: blockers.length ? 'bloqueado' : warnings.length ? 'producao assistida' : 'pronto para bateria final',
      next_gate: blockers.length ? 'corrigir bloqueios criticos' : 'executar bateria final com evidencias',
    },
  }
}
