import { NextRequest, NextResponse } from 'next/server'
import { markAgentCompleted, markAgentFailed, markAgentStarted, saveAppConfig } from '@/lib/admin/app-config'
import { generatePaidMarketingReport } from '@/lib/ads/paid-report-agent'
import { runBlogAgentDraft } from '@/lib/blog/runner'
import { runNewsAgentDraft } from '@/lib/news/runner'
import { runEcosystemSnapshotCycle } from '@/lib/intelligence/ecosystem'
import { publishDueScheduledPosts } from '@/lib/social/meta-publisher'
import { syncFacebookOrganic } from '@/lib/social/facebook'
import { syncInstagramOrganic } from '@/lib/social/instagram'
import { generateOrganicMarketingReport } from '@/lib/social/organic-report-agent'
import { runScheduledResearchTopics } from '@/lib/research/pilger'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type AgentStatus = 'healthy' | 'warning' | 'danger' | 'standby'

function dateOrNull(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function ageHours(value: unknown) {
  const date = dateOrNull(value)
  if (!date) return null
  return Math.round((Date.now() - new Date(date).getTime()) / 36_000) / 100
}

function recentStatus(value: unknown, healthyHours: number, warningHours: number, fallback: AgentStatus = 'warning'): AgentStatus {
  const hours = ageHours(value)
  if (hours === null) return fallback
  if (hours <= healthyHours) return 'healthy'
  if (hours <= warningHours) return 'warning'
  return 'danger'
}

function statusLabel(status: AgentStatus) {
  if (status === 'healthy') return 'Operando'
  if (status === 'warning') return 'Atenção'
  if (status === 'danger') return 'Parado'
  return 'Em espera'
}

async function safeCount(supabase: any, table: string, apply?: (query: any) => any) {
  try {
    let query = supabase.from(table).select('*', { count: 'exact', head: true })
    if (apply) query = apply(query)
    const { count, error } = await query
    if (error) return { count: 0, error: error.message || String(error) }
    return { count: count || 0, error: null }
  } catch (error: any) {
    return { count: 0, error: error?.message || String(error) }
  }
}

async function safeLatest(supabase: any, table: string, select: string, order: string, apply?: (query: any) => any) {
  try {
    let query = supabase.from(table).select(select).order(order, { ascending: false }).limit(1)
    if (apply) query = apply(query)
    const { data, error } = await query
    if (error) return { data: null, error: error.message || String(error) }
    return { data: data?.[0] || null, error: null }
  } catch (error: any) {
    return { data: null, error: error?.message || String(error) }
  }
}

async function readConfigs(supabase: any) {
  const { data } = await supabase
    .from('app_config')
    .select('key,value')

  return Object.fromEntries((data || []).map((row: any) => [row.key, String(row.value || '')]))
}

function metric(label: string, value: unknown) {
  return { label, value: String(value ?? '-') }
}

function buildAgent(params: {
  id: string
  title: string
  area: string
  description: string
  status: AgentStatus
  lastActivity?: string | null
  lastError?: string | null
  metrics?: Array<{ label: string; value: string }>
  action?: { key: string; label: string; danger?: boolean }
}) {
  return {
    ...params,
    statusLabel: statusLabel(params.status),
  }
}

export async function GET() {
  try {
    const supabase = createAdminClient()
    const configs = await readConfigs(supabase)

    const [
      conversations,
      activeConversations,
      latestConversation,
      instances,
      connectedInstances,
      brokers,
      workflowRuns,
      latestWorkflowRun,
      researchReports,
      latestResearch,
      ecosystemSnapshots,
      latestEcosystem,
      radarInsights,
      latestRadar,
      ceoReports,
      latestCeo,
      paidReports,
      latestPaidReport,
      organicReports,
      latestOrganicReport,
      organicMedia,
      latestOrganicMedia,
      scheduledPosts,
      duePosts,
      blogPosts,
      latestBlog,
      pendingBlog,
      newsPosts,
      latestNews,
      pendingNews,
      adSnapshots,
      latestAdSnapshot,
    ] = await Promise.all([
      safeCount(supabase, 'whatsapp_ai_conversations'),
      safeCount(supabase, 'whatsapp_ai_conversations', q => q.eq('status', 'active')),
      safeLatest(supabase, 'whatsapp_ai_conversations', 'id,status,lead_phone,updated_at', 'updated_at'),
      safeCount(supabase, 'whatsapp_instances'),
      safeCount(supabase, 'whatsapp_instances', q => q.in('status', ['connected', 'open'])),
      safeCount(supabase, 'virtual_brokers', q => q.eq('is_active', true)),
      safeCount(supabase, 'agent_workflow_runs'),
      safeLatest(supabase, 'agent_workflow_runs', 'id,status,trigger_type,error_message,updated_at', 'updated_at'),
      safeCount(supabase, 'ai_research_reports'),
      safeLatest(supabase, 'ai_research_reports', 'id,topic,status,created_at,updated_at', 'created_at'),
      safeCount(supabase, 'ecosystem_context_snapshots'),
      safeLatest(supabase, 'ecosystem_context_snapshots', 'id,agent,created_by,created_at', 'created_at'),
      safeCount(supabase, 'market_radar_insights'),
      safeLatest(supabase, 'market_radar_insights', 'id,keyword,location,opportunity_score,created_at', 'created_at'),
      safeCount(supabase, 'pilger_ai_reports'),
      safeLatest(supabase, 'pilger_ai_reports', 'id,type,date,platform,performance_score,created_at', 'created_at'),
      safeCount(supabase, 'marketing_ai_reports', q => q.eq('report_type', 'paid')),
      safeLatest(supabase, 'marketing_ai_reports', 'id,report_type,title,status,created_at', 'created_at', q => q.eq('report_type', 'paid')),
      safeCount(supabase, 'marketing_ai_reports', q => q.eq('report_type', 'organic')),
      safeLatest(supabase, 'marketing_ai_reports', 'id,report_type,title,status,created_at', 'created_at', q => q.eq('report_type', 'organic')),
      safeCount(supabase, 'organic_social_media'),
      safeLatest(supabase, 'organic_social_media', 'id,platform,published_at,last_synced_at,created_at', 'published_at'),
      safeCount(supabase, 'marketing_scheduled_posts'),
      safeCount(supabase, 'marketing_scheduled_posts', q => q.in('status', ['approved', 'scheduled']).not('scheduled_for', 'is', null).lte('scheduled_for', new Date().toISOString())),
      safeCount(supabase, 'blog_posts'),
      safeLatest(supabase, 'blog_posts', 'id,title,status,generated_by,created_at,updated_at', 'created_at'),
      safeCount(supabase, 'blog_posts', q => q.eq('generated_by', 'blog-intelligence').eq('status', 'under_review')),
      safeCount(supabase, 'blog_posts', q => q.eq('category', 'Noticias')),
      safeLatest(supabase, 'blog_posts', 'id,title,status,generated_by,category,created_at,updated_at', 'created_at', q => q.eq('category', 'Noticias')),
      safeCount(supabase, 'blog_posts', q => q.eq('generated_by', 'news-intelligence').eq('status', 'under_review')),
      safeCount(supabase, 'ad_metrics_snapshots'),
      safeLatest(supabase, 'ad_metrics_snapshots', 'id,campaign_id,snapshot_at,impressions,clicks,spend,leads_count', 'snapshot_at'),
    ])

    const agents = [
      buildAgent({
        id: 'whatsapp',
        title: 'WhatsApp IA',
        area: 'Atendimento',
        description: 'Atende leads, registra conversas e usa o contexto central para recomendar imóveis.',
        status: connectedInstances.count > 0 && activeConversations.count > 0
          ? recentStatus(latestConversation.data?.updated_at, 24, 168)
          : 'danger',
        lastActivity: dateOrNull(latestConversation.data?.updated_at),
        metrics: [
          metric('Conversas', conversations.count),
          metric('Ativas', activeConversations.count),
          metric('Instâncias conectadas', connectedInstances.count),
          metric('Corretores IA ativos', brokers.count),
        ],
      }),
      buildAgent({
        id: 'research',
        title: 'Pesquisa Profunda IA',
        area: 'Inteligência',
        description: 'Investiga notícias, prefeitura, economia local e mercado para alimentar Blog, Notícias e CEO.',
        status: configs.research_pilger_enabled === 'false'
          ? 'danger'
          : recentStatus(latestResearch.data?.created_at, 72, 336),
        lastActivity: dateOrNull(latestResearch.data?.created_at),
        metrics: [
          metric('Relatórios', researchReports.count),
          metric('Último tema', latestResearch.data?.topic || '-'),
          metric('Agendamento', configs.research_pilger_schedule_enabled === 'false' ? 'desligado' : 'ativo'),
        ],
        action: { key: 'research', label: 'Rodar 1 tema' },
      }),
      buildAgent({
        id: 'ecosystem',
        title: 'Central de Inteligência',
        area: 'Inteligência',
        description: 'Sincroniza a memória compartilhada que todos os agentes consultam.',
        status: configs.ecosystem_intelligence_enabled === 'false'
          ? 'danger'
          : recentStatus(latestEcosystem.data?.created_at, 8, 48),
        lastActivity: dateOrNull(latestEcosystem.data?.created_at),
        metrics: [
          metric('Snapshots', ecosystemSnapshots.count),
          metric('Último agente', latestEcosystem.data?.agent || '-'),
          metric('Intervalo', `${configs.ecosystem_intelligence_interval_hours || 6}h`),
        ],
        action: { key: 'ecosystem', label: 'Sincronizar agora' },
      }),
      buildAgent({
        id: 'radar',
        title: 'Radar de Mercado',
        area: 'Inteligência',
        description: 'Monitora termos estratégicos e cria insights de oportunidade.',
        status: recentStatus(latestRadar.data?.created_at, 24, 96),
        lastActivity: dateOrNull(latestRadar.data?.created_at),
        metrics: [
          metric('Insights', radarInsights.count),
          metric('Último termo', latestRadar.data?.keyword || '-'),
          metric('Score', latestRadar.data?.opportunity_score || '-'),
        ],
      }),
      buildAgent({
        id: 'ceo',
        title: 'CEO Pilger AI',
        area: 'Diretoria',
        description: 'Gera leitura executiva diária/semanal para decisão.',
        status: recentStatus(latestCeo.data?.created_at, 36, 168),
        lastActivity: dateOrNull(latestCeo.data?.created_at),
        metrics: [
          metric('Relatórios', ceoReports.count),
          metric('Último tipo', latestCeo.data?.type || '-'),
          metric('Score', latestCeo.data?.performance_score || '-'),
        ],
      }),
      buildAgent({
        id: 'paid_report',
        title: 'Agente de Tráfego Pago',
        area: 'Marketing',
        description: 'Analisa campanhas pagas, desperdício, CPL, gargalos e recomenda ações.',
        status: configs.paid_report_agent_enabled === 'false'
          ? 'danger'
          : recentStatus(configs.paid_report_agent_last_run_at || latestPaidReport.data?.created_at, 48, 168),
        lastActivity: dateOrNull(configs.paid_report_agent_last_run_at || latestPaidReport.data?.created_at),
        lastError: configs.paid_report_agent_last_error || null,
        metrics: [
          metric('Relatórios', paidReports.count),
          metric('Último', latestPaidReport.data?.title || '-'),
          metric('Erro', configs.paid_report_agent_last_error || '-'),
        ],
        action: { key: 'paid_report', label: 'Gerar relatório' },
      }),
      buildAgent({
        id: 'organic_sync',
        title: 'Sincronizador Orgânico',
        area: 'Marketing',
        description: 'Busca métricas recentes do Instagram/Facebook para alimentar relatórios e decisões.',
        status: configs.organic_social_sync_enabled === 'false'
          ? 'danger'
          : recentStatus(configs.organic_social_sync_last_run_at || latestOrganicMedia.data?.last_synced_at || latestOrganicMedia.data?.created_at, 72, 240),
        lastActivity: dateOrNull(configs.organic_social_sync_last_run_at || latestOrganicMedia.data?.last_synced_at || latestOrganicMedia.data?.created_at),
        lastError: configs.organic_social_sync_last_error || null,
        metrics: [
          metric('Mídias', organicMedia.count),
          metric('Última plataforma', latestOrganicMedia.data?.platform || '-'),
          metric('Erro', configs.organic_social_sync_last_error || '-'),
        ],
        action: { key: 'organic_sync', label: 'Sincronizar' },
      }),
      buildAgent({
        id: 'organic_report',
        title: 'Agente de Tráfego Orgânico',
        area: 'Marketing',
        description: 'Transforma dados orgânicos em leitura executiva e ações recomendadas.',
        status: configs.organic_report_agent_enabled === 'false'
          ? 'danger'
          : recentStatus(configs.organic_report_agent_last_run_at || latestOrganicReport.data?.created_at, 72, 240),
        lastActivity: dateOrNull(configs.organic_report_agent_last_run_at || latestOrganicReport.data?.created_at),
        lastError: configs.organic_report_agent_last_error || null,
        metrics: [
          metric('Relatórios', organicReports.count),
          metric('Último', latestOrganicReport.data?.title || '-'),
          metric('Erro', configs.organic_report_agent_last_error || '-'),
        ],
        action: { key: 'organic_report', label: 'Gerar relatório' },
      }),
      buildAgent({
        id: 'blog',
        title: 'Agente de Blog',
        area: 'Marketing',
        description: 'Cria rascunhos de artigos com base em radar, pesquisa profunda, leads e imóveis.',
        status: configs.blog_agent_enabled === 'false'
          ? 'danger'
          : recentStatus(configs.blog_agent_last_run_at || latestBlog.data?.created_at, 240, 720, 'warning'),
        lastActivity: dateOrNull(configs.blog_agent_last_run_at || latestBlog.data?.created_at),
        lastError: configs.blog_agent_last_error || null,
        metrics: [
          metric('Posts', blogPosts.count),
          metric('Em análise', pendingBlog.count),
          metric('Último', latestBlog.data?.title || '-'),
        ],
        action: { key: 'blog', label: 'Gerar rascunho' },
      }),
      buildAgent({
        id: 'news',
        title: 'Agente de Noticias',
        area: 'Marketing',
        description: 'Cria rascunhos de noticias com base em pesquisas externas, prefeitura, economia e mercado.',
        status: configs.news_agent_enabled === 'false'
          ? 'danger'
          : recentStatus(configs.news_agent_last_run_at || latestNews.data?.created_at, 240, 720, 'warning'),
        lastActivity: dateOrNull(configs.news_agent_last_run_at || latestNews.data?.created_at),
        lastError: configs.news_agent_last_error || null,
        metrics: [
          metric('Noticias', newsPosts.count),
          metric('Em analise', pendingNews.count),
          metric('Ultima', latestNews.data?.title || '-'),
        ],
        action: { key: 'news', label: 'Gerar noticia' },
      }),
      buildAgent({
        id: 'publisher',
        title: 'Publicador de Conteúdo',
        area: 'Marketing',
        description: 'Publica conteúdos aprovados e vencidos quando o autopilot está ligado.',
        status: scheduledPosts.count === 0
          ? 'standby'
          : configs.marketing_publisher_autopilot === 'true'
            ? recentStatus(configs.marketing_publisher_last_run_at, 2, 24, 'warning')
            : 'standby',
        lastActivity: dateOrNull(configs.marketing_publisher_last_run_at),
        lastError: configs.marketing_publisher_last_error || null,
        metrics: [
          metric('Fila editorial', scheduledPosts.count),
          metric('Vencidos/aprovados', duePosts.count),
          metric('Autopilot', configs.marketing_publisher_autopilot === 'true' ? 'ligado' : 'aprovação'),
        ],
        action: { key: 'publisher', label: 'Checar fila' },
      }),
      buildAgent({
        id: 'workflows',
        title: 'Workflows de Atendimento',
        area: 'Comercial',
        description: 'Executa follow-ups e ações automatizadas com histórico de tarefas.',
        status: workflowRuns.count === 0 || ageHours(latestWorkflowRun.data?.updated_at) === null || Number(ageHours(latestWorkflowRun.data?.updated_at)) > 336
          ? 'standby'
          : recentStatus(latestWorkflowRun.data?.updated_at, 168, 720, 'standby'),
        lastActivity: dateOrNull(latestWorkflowRun.data?.updated_at),
        lastError: latestWorkflowRun.data?.error_message || null,
        metrics: [
          metric('Execuções', workflowRuns.count),
          metric('Último status', latestWorkflowRun.data?.status || '-'),
          metric('Último gatilho', latestWorkflowRun.data?.trigger_type || '-'),
        ],
      }),
      buildAgent({
        id: 'ads_sync',
        title: 'Sincronizador de Ads',
        area: 'Marketing',
        description: 'Atualiza métricas de campanhas pagas para o agente de tráfego.',
        status: recentStatus(configs.ads_sync_last_run_at || latestAdSnapshot.data?.snapshot_at, 2, 24),
        lastActivity: dateOrNull(configs.ads_sync_last_run_at || latestAdSnapshot.data?.snapshot_at),
        lastError: configs.ads_sync_last_error || null,
        metrics: [
          metric('Snapshots', adSnapshots.count),
          metric('Último spend', latestAdSnapshot.data?.spend || '-'),
          metric('Últimos leads', latestAdSnapshot.data?.leads_count || 0),
        ],
      }),
    ]

    await saveAppConfig(supabase, 'agent_health_last_checked_at', new Date().toISOString()).catch(() => {})

    const summary = agents.reduce((acc: Record<string, number>, agent) => {
      acc[agent.status] = (acc[agent.status] || 0) + 1
      return acc
    }, { healthy: 0, warning: 0, danger: 0, standby: 0 })

    return NextResponse.json({
      success: true,
      checked_at: new Date().toISOString(),
      summary,
      agents,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const action = String(body?.action || '')
  const supabase = createAdminClient()

  try {
    if (action === 'ecosystem') {
      await markAgentStarted(supabase, 'ecosystem_intelligence')
      const result = await runEcosystemSnapshotCycle({ supabase, days: 30, createdBy: 'agent-health' })
      await markAgentCompleted(supabase, 'ecosystem_intelligence', { source: 'agent_health', ...result })
      return NextResponse.json({ success: true, result })
    }

    if (action === 'paid_report') {
      await markAgentStarted(supabase, 'paid_report_agent')
      const result = await generatePaidMarketingReport({ days: 30 })
      await markAgentCompleted(supabase, 'paid_report_agent', { report_id: result.report?.id, title: result.report?.title, source: 'agent_health' })
      return NextResponse.json(result)
    }

    if (action === 'organic_report') {
      await markAgentStarted(supabase, 'organic_report_agent')
      const result = await generateOrganicMarketingReport({ days: 30 })
      await markAgentCompleted(supabase, 'organic_report_agent', { report_id: result.report?.id, title: result.report?.title, source: 'agent_health' })
      return NextResponse.json(result)
    }

    if (action === 'organic_sync') {
      await markAgentStarted(supabase, 'organic_social_sync')
      const [instagram, facebook] = await Promise.all([
        syncInstagramOrganic(12),
        syncFacebookOrganic(12),
      ])
      const result = { success: true, instagram, facebook }
      await markAgentCompleted(supabase, 'organic_social_sync', { source: 'agent_health', instagram: instagram?.media?.length || 0, facebook: facebook?.media?.length || 0 })
      return NextResponse.json(result)
    }

    if (action === 'publisher') {
      await markAgentStarted(supabase, 'marketing_publisher')
      const result = await publishDueScheduledPosts({ limit: 10, dryRun: true })
      await markAgentCompleted(supabase, 'marketing_publisher', { source: 'agent_health', ...result })
      return NextResponse.json({ success: true, result })
    }

    if (action === 'blog') {
      const result = await runBlogAgentDraft({ origin: request.nextUrl.origin, source: 'agent_health' })
      return NextResponse.json({ success: true, result })
    }

    if (action === 'news') {
      const result = await runNewsAgentDraft({ origin: request.nextUrl.origin, source: 'agent_health' })
      return NextResponse.json({ success: true, result })
    }

    if (action === 'research') {
      const result = await runScheduledResearchTopics({ limit: 1, slot: 'health' })
      return NextResponse.json({ success: true, result })
    }

    return NextResponse.json({ success: false, error: 'Acao de agente desconhecida.' }, { status: 400 })
  } catch (error: any) {
    const prefixByAction: Record<string, string> = {
      paid_report: 'paid_report_agent',
      organic_report: 'organic_report_agent',
      organic_sync: 'organic_social_sync',
      publisher: 'marketing_publisher',
      blog: 'blog_agent',
      news: 'news_agent',
      ecosystem: 'ecosystem_intelligence',
    }
    const prefix = prefixByAction[action]
    if (prefix) await markAgentFailed(supabase, prefix, error).catch(() => {})
    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 })
  }
}
