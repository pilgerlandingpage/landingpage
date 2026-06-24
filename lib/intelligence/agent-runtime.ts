import {
  buildAgentContextBrief,
  getAgentEcosystemContext,
  recordEcosystemEvent,
  saveEcosystemSnapshot,
  type EcosystemAgent,
} from '@/lib/intelligence/ecosystem'
import { createAdminClient } from '@/lib/supabase/server'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

export type AgentCentralContractStatus = 'full' | 'partial' | 'contracted'

export type AgentCentralProfile = {
  agentId: string
  ecosystemAgent: EcosystemAgent
  name: string
  sector: string
  status: AgentCentralContractStatus
  consumes: string[]
  produces: string[]
  defaultHandoffTargets: string[]
}

export type AgentCentralContext = {
  profile: AgentCentralProfile
  context: any
  brief: string
}

export type AgentCentralSignalInput = {
  supabase?: SupabaseAdmin | any
  agentId: string
  eventType?: string
  label?: string | null
  entityType?: string | null
  entityId?: string | null
  leadId?: string | null
  visitorId?: string | null
  importanceScore?: number
  source?: string | null
  metadata?: Record<string, any>
  handoffTargets?: string[]
  occurredAt?: string
}

const COMMON_COMMERCIAL_CONSUMES = [
  'leads',
  'conversas WhatsApp',
  'imoveis ativos',
  'eventos de funil',
  'radar de mercado',
  'pesquisas externas',
]

const AGENT_CENTRAL_PROFILES: Record<string, AgentCentralProfile> = {
  'pilger-ai-core': {
    agentId: 'pilger-ai-core',
    ecosystemAgent: 'global',
    name: 'Helena Gestao Painel',
    sector: 'Compliance e Governança',
    status: 'contracted',
    consumes: ['estado geral do sistema', 'saude dos agentes', 'eventos da Central'],
    produces: ['orientacoes administrativas', 'solicitacoes de acao', 'decisoes assistidas'],
    defaultHandoffTargets: ['ceo-agent', 'internal-notifier'],
  },
  'pilger-ai-rules': {
    agentId: 'pilger-ai-rules',
    ecosystemAgent: 'global',
    name: 'Tomas Governanca IA',
    sector: 'Compliance e Governança',
    status: 'contracted',
    consumes: ['regras internas', 'eventos sensiveis', 'historico operacional'],
    produces: ['guardrails', 'bloqueios', 'alertas de governanca'],
    defaultHandoffTargets: ['pilger-ai-core', 'internal-notifier'],
  },
  'property-triage': {
    agentId: 'property-triage',
    ecosystemAgent: 'property',
    name: 'Marina Triagem Imoveis',
    sector: 'Imoveis',
    status: 'contracted',
    consumes: ['briefings de imoveis', 'padroes de cadastro', 'demanda dos leads'],
    produces: ['dados faltantes', 'bloqueios de cadastro', 'prioridades de cadastro'],
    defaultHandoffTargets: ['property-register', 'internal-notifier'],
  },
  'property-register': {
    agentId: 'property-register',
    ecosystemAgent: 'property',
    name: 'Bianca Cadastro Imoveis',
    sector: 'Imoveis',
    status: 'full',
    consumes: ['briefing do imovel', 'midias', 'estoque', 'sinais de busca', 'SEO/AEO/GEO'],
    produces: ['rascunho de imovel', 'copy de vendas', 'metadados SEO', 'lacunas do cadastro'],
    defaultHandoffTargets: ['creative-strategy-agent', 'blog-intelligence', 'whatsapp-global-agent'],
  },
  'whatsapp-lead-extraction': {
    agentId: 'whatsapp-lead-extraction',
    ecosystemAgent: 'whatsapp',
    name: 'Laura Extracao Leads',
    sector: 'WhatsApp',
    status: 'full',
    consumes: COMMON_COMMERCIAL_CONSUMES,
    produces: ['perfil do lead', 'orcamento', 'intencao', 'regiao', 'objecoes', 'score comercial'],
    defaultHandoffTargets: ['whatsapp-global-agent', 'ads-analyst', 'blog-intelligence', 'ceo-agent'],
  },
  'whatsapp-attendance-coach': {
    agentId: 'whatsapp-attendance-coach',
    ecosystemAgent: 'whatsapp',
    name: 'Helena Auditoria Comercial',
    sector: 'WhatsApp',
    status: 'full',
    consumes: ['historico de conversas WhatsApp', 'CRM dos leads', 'relatorios de atendimento', 'tempos de resposta'],
    produces: ['score de atendimento', 'oportunidades perdidas', 'leads recuperaveis', 'plano de melhoria do corretor'],
    defaultHandoffTargets: ['whatsapp-lead-extraction', 'whatsapp-followup-agent', 'whatsapp-rescue-agent', 'ceo-agent'],
  },
  'whatsapp-global-agent': {
    agentId: 'whatsapp-global-agent',
    ecosystemAgent: 'whatsapp',
    name: 'Rafael WhatsApp Global',
    sector: 'WhatsApp',
    status: 'full',
    consumes: COMMON_COMMERCIAL_CONSUMES,
    produces: ['atendimento', 'qualificacao', 'necessidades do lead', 'transferencias humanas'],
    defaultHandoffTargets: ['whatsapp-lead-extraction', 'ads-analyst', 'property-register', 'ceo-agent'],
  },
  'whatsapp-rescue-agent': {
    agentId: 'whatsapp-rescue-agent',
    ecosystemAgent: 'whatsapp',
    name: 'Nara Resgate Leads',
    sector: 'WhatsApp',
    status: 'full',
    consumes: ['leads sem conversa', 'origem do lead', 'historico de funil'],
    produces: ['tentativas de resgate', 'leads retomados', 'falhas de contato'],
    defaultHandoffTargets: ['whatsapp-global-agent', 'ceo-agent'],
  },
  'whatsapp-followup-agent': {
    agentId: 'whatsapp-followup-agent',
    ecosystemAgent: 'whatsapp',
    name: 'Caio Follow-up',
    sector: 'WhatsApp',
    status: 'full',
    consumes: ['conversas paradas', 'agenda de follow-up', 'perfil do lead'],
    produces: ['retomadas enviadas', 'paradas por resposta', 'sinais de reengajamento'],
    defaultHandoffTargets: ['whatsapp-global-agent', 'ads-analyst', 'ceo-agent'],
  },
  'user-first-access-agent': {
    agentId: 'user-first-access-agent',
    ecosystemAgent: 'global',
    name: 'Sofia Onboarding',
    sector: 'Operacoes',
    status: 'full',
    consumes: ['usuarios criados', 'instancia global', 'regras de acesso'],
    produces: ['convites enviados', 'falhas de onboarding', 'usuarios aguardando senha'],
    defaultHandoffTargets: ['internal-notifier', 'pilger-ai-core'],
  },
  'user-password-reset-agent': {
    agentId: 'user-password-reset-agent',
    ecosystemAgent: 'global',
    name: 'Bruno Seguranca Acesso',
    sector: 'Operacoes',
    status: 'full',
    consumes: ['solicitacoes de reset', 'usuarios internos', 'regras de seguranca'],
    produces: ['resets enviados', 'falhas de seguranca', 'recuperacoes concluidas'],
    defaultHandoffTargets: ['internal-notifier', 'pilger-ai-rules'],
  },
  'ads-analyst': {
    agentId: 'ads-analyst',
    ecosystemAgent: 'traffic',
    name: 'Vitor Trafego Pago',
    sector: 'Marketing',
    status: 'full',
    consumes: ['metricas de ads', 'leads', 'conversas', 'estoque', 'criativos'],
    produces: ['analises de campanha', 'alertas de CPL', 'recomendacoes de verba'],
    defaultHandoffTargets: ['creative-strategy-agent', 'ceo-agent', 'whatsapp-global-agent'],
  },
  'social-attendance-agent': {
    agentId: 'social-attendance-agent',
    ecosystemAgent: 'social',
    name: 'Livia Atendimento Social',
    sector: 'Marketing',
    status: 'full',
    consumes: ['comentarios', 'directs', 'leads', 'campanhas', 'estoque'],
    produces: ['sugestoes sociais', 'sinais de lead social', 'intencoes e sentimento'],
    defaultHandoffTargets: ['whatsapp-global-agent', 'creative-strategy-agent', 'ads-analyst'],
  },
  'organic-report-agent': {
    agentId: 'organic-report-agent',
    ecosystemAgent: 'social',
    name: 'Renata Trafego Organico',
    sector: 'Marketing',
    status: 'full',
    consumes: ['metricas organicas', 'criativos', 'leads', 'posts publicados'],
    produces: ['relatorios organicos', 'conteudos vencedores', 'oportunidades editoriais'],
    defaultHandoffTargets: ['creative-strategy-agent', 'blog-intelligence', 'ads-analyst'],
  },
  'gaia-analytics-web': {
    agentId: 'gaia-analytics-web',
    ecosystemAgent: 'traffic',
    name: 'Gaia Analytics Web',
    sector: 'Inteligencia',
    status: 'full',
    consumes: ['Google Analytics', 'Search Console', 'tracking do site', 'paginas acessadas', 'origens de trafego'],
    produces: ['sinais de trafego web', 'queries organicas', 'paginas fortes', 'paginas fracas', 'oportunidades SEO'],
    defaultHandoffTargets: ['blog-intelligence', 'news-intelligence', 'ads-analyst', 'ceo-agent'],
  },
  'maya-meta-connections': {
    agentId: 'maya-meta-connections',
    ecosystemAgent: 'social',
    name: 'Maya Conexoes Meta',
    sector: 'Inteligencia',
    status: 'full',
    consumes: ['Facebook OAuth', 'Instagram OAuth', 'tokens Meta', 'paginas', 'contas', 'status de conexao'],
    produces: ['saude das conexoes Meta', 'falhas de permissao', 'status de sync', 'sinais sociais brutos'],
    defaultHandoffTargets: ['social-attendance-agent', 'organic-report-agent', 'ads-analyst', 'content-publisher-agent'],
  },
  'otto-integrations': {
    agentId: 'otto-integrations',
    ecosystemAgent: 'global',
    name: 'Otto Integracoes',
    sector: 'Tecnologia',
    status: 'full',
    consumes: ['diagnosticos de API', 'status de provedores', 'erros de integracao', 'limites e credenciais'],
    produces: ['alertas de integracao', 'impacto por agente', 'proximas acoes tecnicas', 'saude operacional'],
    defaultHandoffTargets: ['internal-notifier', 'ceo-agent', 'pilger-ai-core'],
  },
  'iris-media-voice': {
    agentId: 'iris-media-voice',
    ecosystemAgent: 'creative',
    name: 'Iris Midia e Voz',
    sector: 'Marketing',
    status: 'full',
    consumes: ['assets editoriais', 'uploads', 'R2', 'Pexels', 'Pixabay', 'ElevenLabs', 'OpenAI TTS', 'midias recebidas'],
    produces: ['status de midia', 'falhas de imagem e voz', 'assets recomendados', 'riscos de uso de midia'],
    defaultHandoffTargets: ['creative-strategy-agent', 'blog-intelligence', 'news-intelligence', 'content-publisher-agent'],
  },
  'teo-webhooks-events': {
    agentId: 'teo-webhooks-events',
    ecosystemAgent: 'global',
    name: 'Teo Webhooks e Eventos Externos',
    sector: 'Operacoes',
    status: 'full',
    consumes: ['webhooks WhatsApp', 'webhooks Meta', 'formularios', 'callbacks externos', 'eventos de tracking'],
    produces: ['eventos normalizados', 'sinais comerciais', 'falhas de webhook', 'roteamento para agente responsavel'],
    defaultHandoffTargets: ['whatsapp-global-agent', 'social-attendance-agent', 'ads-analyst', 'otto-integrations'],
  },
  'creative-strategy-agent': {
    agentId: 'creative-strategy-agent',
    ecosystemAgent: 'creative',
    name: 'Clara Criativos',
    sector: 'Marketing',
    status: 'full',
    consumes: ['radar', 'benchmark', 'trafego', 'social', 'imoveis', 'leads'],
    produces: ['copies', 'hooks', 'headlines', 'angulos', 'briefings criativos'],
    defaultHandoffTargets: ['content-publisher-agent', 'ads-analyst', 'organic-report-agent'],
  },
  'content-publisher-agent': {
    agentId: 'content-publisher-agent',
    ecosystemAgent: 'publisher',
    name: 'Miguel Publicacao',
    sector: 'Marketing',
    status: 'full',
    consumes: ['fila editorial', 'criativos aprovados', 'janelas de publicacao', 'sinais da Central'],
    produces: ['publicacoes realizadas', 'falhas de publicacao', 'permalinks'],
    defaultHandoffTargets: ['organic-report-agent', 'ads-analyst', 'ceo-agent'],
  },
  'event-agent': {
    agentId: 'event-agent',
    ecosystemAgent: 'events',
    name: 'Valentina Eventos',
    sector: 'Marketing',
    status: 'full',
    consumes: ['inscritos', 'tracking', 'conversas', 'campanhas', 'leads'],
    produces: ['relatorios de evento', 'leads quentes', 'automacoes e enquetes'],
    defaultHandoffTargets: ['whatsapp-global-agent', 'ceo-agent', 'ads-analyst'],
  },
  'broker-candidate-agent': {
    agentId: 'broker-candidate-agent',
    ecosystemAgent: 'recruiting',
    name: 'Helena Recrutamento',
    sector: 'Recrutamento',
    status: 'full',
    consumes: ['candidatos corretores', 'regioes', 'tracking', 'mercado'],
    produces: ['score de candidato', 'recomendacoes de contato', 'regioes de recrutamento'],
    defaultHandoffTargets: ['ceo-agent', 'internal-notifier'],
  },
  'internal-notifier': {
    agentId: 'internal-notifier',
    ecosystemAgent: 'global',
    name: 'Nina Avisos Internos',
    sector: 'Operacoes',
    status: 'full',
    consumes: ['eventos da Central', 'falhas', 'tarefas internas', 'setores responsaveis'],
    produces: ['avisos internos', 'alertas por setor', 'falhas de comunicacao'],
    defaultHandoffTargets: ['pilger-ai-core', 'ceo-agent'],
  },
  'email-orchestrator': {
    agentId: 'email-orchestrator',
    ecosystemAgent: 'distribution',
    name: 'Gabriel Distribuicao Inteligente',
    sector: 'Marketing',
    status: 'full',
    consumes: ['conteudos publicados', 'leads', 'segmentos', 'comportamento'],
    produces: ['campanhas editoriais', 'envios por canal', 'recomendacoes personalizadas'],
    defaultHandoffTargets: ['whatsapp-global-agent', 'ceo-agent', 'ads-analyst'],
  },
  'pilger-daily-report': {
    agentId: 'pilger-daily-report',
    ecosystemAgent: 'ceo',
    name: 'Elisa Relatorio Diario',
    sector: 'Diretoria',
    status: 'full',
    consumes: ['todos os sinais da Central', 'metricas do dia', 'erros e oportunidades'],
    produces: ['relatorio diario', 'riscos', 'prioridades operacionais'],
    defaultHandoffTargets: ['ceo-agent', 'pilger-weekly-report'],
  },
  'pilger-weekly-report': {
    agentId: 'pilger-weekly-report',
    ecosystemAgent: 'ceo',
    name: 'Augusto Diretriz Semanal',
    sector: 'Diretoria',
    status: 'full',
    consumes: ['relatorios diarios', 'tendencias semanais', 'resultados comerciais'],
    produces: ['diretrizes semanais', 'prioridades por setor', 'tarefas estrategicas'],
    defaultHandoffTargets: ['ceo-agent', 'ads-analyst', 'blog-intelligence'],
  },
  'ceo-agent': {
    agentId: 'ceo-agent',
    ecosystemAgent: 'ceo',
    name: 'Arthur CEO IA',
    sector: 'Diretoria',
    status: 'full',
    consumes: ['todos os sinais da Central', 'relatorios', 'eventos', 'mercado'],
    produces: ['decisoes recomendadas', 'alertas executivos', 'prioridades estrategicas'],
    defaultHandoffTargets: ['pilger-ai-core', 'internal-notifier'],
  },
  'market-radar': {
    agentId: 'market-radar',
    ecosystemAgent: 'radar',
    name: 'Lara Radar Mercado',
    sector: 'Inteligencia',
    status: 'full',
    consumes: ['termos monitorados', 'estoque', 'buscas', 'mercado'],
    produces: ['insights de mercado', 'oportunidades comerciais', 'alertas de tendencia'],
    defaultHandoffTargets: ['blog-intelligence', 'news-intelligence', 'ads-analyst'],
  },
  'blog-intelligence': {
    agentId: 'blog-intelligence',
    ecosystemAgent: 'blog',
    name: 'Isadora Edicao Blog',
    sector: 'Marketing',
    status: 'full',
    consumes: ['benchmark', 'research', 'radar', 'leads', 'estoque', 'SEO/AEO/GEO'],
    produces: ['artigos', 'palavras-chave', 'links internos', 'pautas evergreen'],
    defaultHandoffTargets: ['content-publisher-agent', 'email-orchestrator', 'ceo-agent'],
  },
  'news-intelligence': {
    agentId: 'news-intelligence',
    ecosystemAgent: 'news',
    name: 'Clara Edicao Noticias',
    sector: 'Marketing',
    status: 'full',
    consumes: ['research', 'benchmark', 'fontes publicas', 'radar', 'eventos locais'],
    produces: ['noticias', 'fontes verificadas', 'pautas atuais'],
    defaultHandoffTargets: ['content-publisher-agent', 'email-orchestrator', 'ceo-agent'],
  },
  'research-pilger': {
    agentId: 'research-pilger',
    ecosystemAgent: 'research',
    name: 'Mateus Pesquisa Externa',
    sector: 'Inteligencia',
    status: 'full',
    consumes: ['lacunas da Central', 'temas monitorados', 'demanda dos agentes'],
    produces: ['relatorios externos', 'fontes', 'queries', 'achados verificaveis'],
    defaultHandoffTargets: ['benchmark-editorial', 'blog-intelligence', 'news-intelligence', 'ceo-agent'],
  },
  'benchmark-editorial': {
    agentId: 'benchmark-editorial',
    ecosystemAgent: 'benchmark',
    name: 'Lara Benchmark Editorial',
    sector: 'Inteligencia',
    status: 'full',
    consumes: ['SERP publica', 'portais ranqueados', 'respostas de IA', 'estoque', 'SEO/AEO/GEO'],
    produces: ['oportunidades editoriais', 'lacunas de ranking', 'briefings para conteudo'],
    defaultHandoffTargets: ['blog-intelligence', 'news-intelligence', 'creative-strategy-agent'],
  },
}

const BROKER_AGENT_PROFILE: AgentCentralProfile = {
  agentId: 'broker-whatsapp-agent',
  ecosystemAgent: 'whatsapp',
  name: 'Corretor IA WhatsApp',
  sector: 'Comercial',
  status: 'full',
  consumes: COMMON_COMMERCIAL_CONSUMES,
  produces: ['conversas comerciais', 'preferencias de compra', 'objecoes', 'agendamentos', 'transferencias'],
  defaultHandoffTargets: ['whatsapp-lead-extraction', 'ceo-agent', 'ads-analyst'],
}

export function resolveAgentCentralProfile(agentId: string): AgentCentralProfile {
  const normalized = String(agentId || '').trim()
  if (normalized.startsWith('broker-')) {
    return { ...BROKER_AGENT_PROFILE, agentId: normalized }
  }
  return AGENT_CENTRAL_PROFILES[normalized] || {
    agentId: normalized || 'unknown-agent',
    ecosystemAgent: 'global',
    name: normalized || 'Agente sem identificacao',
    sector: 'Sistema',
    status: 'partial',
    consumes: ['Central de Inteligencia'],
    produces: ['evento operacional'],
    defaultHandoffTargets: ['pilger-ai-core'],
  }
}

export function listAgentCentralProfiles() {
  return Object.values(AGENT_CENTRAL_PROFILES)
}

export async function getAgentCentralContext(options: {
  supabase?: SupabaseAdmin | any
  agentId: string
  ecosystemAgent?: EcosystemAgent
  leadId?: string | null
  phone?: string | null
  days?: number
  limit?: number
  recordRead?: boolean
}): Promise<AgentCentralContext> {
  const profile = resolveAgentCentralProfile(options.agentId)
  const supabase = options.supabase || createAdminClient()
  const context = await getAgentEcosystemContext({
    supabase: supabase as any,
    agent: options.ecosystemAgent || profile.ecosystemAgent,
    leadId: options.leadId,
    phone: options.phone,
    days: options.days || 30,
    limit: options.limit || 100,
  })
  const brief = buildAgentContextBrief(context)

  if (options.recordRead) {
    await recordAgentCentralSignal({
      supabase,
      agentId: profile.agentId,
      eventType: 'agent_central_context_consumed',
      source: 'agent-central-runtime',
      label: `${profile.name} consultou a Central de Inteligencia`,
      importanceScore: 35,
      metadata: {
        ecosystem_agent: profile.ecosystemAgent,
        source_counts: context.source_counts,
      },
    }).catch(() => null)
  }

  return { profile, context, brief }
}

export function buildCentralContextPrompt(central: AgentCentralContext | null | undefined) {
  if (!central?.brief) return ''
  return [
    'CONTEXTO CENTRAL DO ECOSSISTEMA PILGER',
    central.brief,
    '',
    'REGRAS DE USO DA CENTRAL:',
    '- Use estes sinais para executar melhor o seu trabalho.',
    '- Nao revele dados internos, metricas sensiveis, IPs, nomes de outros leads ou informacoes privadas.',
    '- Ao gerar saida, produza dados que possam alimentar outros agentes.',
  ].join('\n')
}

export async function recordAgentCentralSignal(input: AgentCentralSignalInput) {
  const profile = resolveAgentCentralProfile(input.agentId)
  const supabase = input.supabase || createAdminClient()
  const handoffTargets = input.handoffTargets?.length
    ? input.handoffTargets
    : profile.defaultHandoffTargets

  return recordEcosystemEvent({
    supabase: supabase as any,
    eventType: input.eventType || 'agent_central_signal_recorded',
    actorType: 'agent',
    leadId: input.leadId || null,
    visitorId: input.visitorId || null,
    entityType: input.entityType || 'agent_work',
    entityId: input.entityId || profile.agentId,
    source: input.source || 'agent-central-runtime',
    label: input.label || `${profile.name} registrou inteligencia na Central`,
    importanceScore: input.importanceScore ?? 55,
    occurredAt: input.occurredAt,
    metadata: {
      central_contract: 'agent_collects_and_consumes',
      agent_id: profile.agentId,
      agent_name: profile.name,
      ecosystem_agent: profile.ecosystemAgent,
      sector: profile.sector,
      consumes: profile.consumes,
      produces: profile.produces,
      handoff_targets: handoffTargets,
      ...(input.metadata || {}),
    },
  })
}

export async function recordAgentCentralHandoff(input: AgentCentralSignalInput & {
  handoffTargets: string[]
  handoffReason?: string
}) {
  return recordAgentCentralSignal({
    ...input,
    eventType: input.eventType || 'agent_central_handoff_created',
    label: input.label || `${resolveAgentCentralProfile(input.agentId).name} criou handoff para outros agentes`,
    metadata: {
      ...(input.metadata || {}),
      handoff_reason: input.handoffReason || null,
    },
  })
}

export async function saveAgentCentralSnapshot(input: {
  supabase?: SupabaseAdmin | any
  agentId: string
  context: any
  summary?: string
  signals?: Record<string, any>
  createdBy?: string
  scope?: string
  subjectId?: string | null
}) {
  const profile = resolveAgentCentralProfile(input.agentId)
  const supabase = input.supabase || createAdminClient()
  return saveEcosystemSnapshot({
    supabase: supabase as any,
    agent: profile.ecosystemAgent,
    scope: input.scope || 'global',
    subjectId: input.subjectId || null,
    createdBy: input.createdBy || profile.agentId,
    context: {
      ...(input.context || {}),
      agent: profile.ecosystemAgent,
      executive_summary: input.summary || input.context?.executive_summary || '',
      signals: {
        ...(input.context?.signals || {}),
        ...(input.signals || {}),
        agent_central_contract: {
          agent_id: profile.agentId,
          agent_name: profile.name,
          sector: profile.sector,
          consumes: profile.consumes,
          produces: profile.produces,
          handoff_targets: profile.defaultHandoffTargets,
        },
      },
    },
  })
}
