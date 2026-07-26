'use client'

import Link from 'next/link'
import { useMemo, useState, type CSSProperties } from 'react'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Brain,
  CheckCircle,
  Clock3,
  DollarSign,
  Eye,
  Gauge,
  History,
  Layers3,
  Megaphone,
  MousePointerClick,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Settings2,
  Sparkles,
  Target,
  WalletCards,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type Campaign = {
  id: string
  name: string
  platform: 'meta' | 'google'
  status: string
  total_budget: number
  daily_budget?: number
  duration_days: number
  start_date?: string
  end_date?: string
  ai_auto_manage: boolean
  external_campaign_id?: string
  target_audience: Record<string, unknown>
  properties?: { title: string } | null
  latest_metrics?: MetricSnapshot | null
}

type MetricSnapshot = {
  id?: string
  snapshot_at?: string
  impressions?: number
  clicks?: number
  ctr?: number
  cpm?: number
  cpc?: number
  spend?: number
  leads_count?: number
  cost_per_lead?: number
  frequency?: number
  thumbstop_ratio?: number
  reach?: number
  landing_page_views?: number
  link_clicks?: number
  quality_ranking?: string
  engagement_rate_ranking?: string
  conversion_rate_ranking?: string
  video_p50?: number
  video_p75?: number
  video_p100?: number
  conversions?: number
}

type AlertRow = {
  id: string
  type: string
  urgency: string
  action_taken?: string
  message: string
  ai_reasoning?: string
  created_at: string
}

type ActionLog = {
  id: string
  action: string
  old_value?: string
  new_value?: string
  reason?: string
  executed_at: string
}

type ChartTab = 'spend' | 'leads' | 'ctr' | 'cpa'

type Props = {
  campaign: Campaign
  metrics: MetricSnapshot[]
  alerts: AlertRow[]
  actionLogs: ActionLog[]
  actionLoading: boolean
  chartTab: ChartTab
  toast: { message: string; type: 'success' | 'error' } | null
  onBack: () => void
  onRefresh: () => void
  onPublish: () => void
  onExecuteAction: (action: string, extraData?: Record<string, unknown>) => void | Promise<void>
  onChartTabChange: (tab: ChartTab) => void
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: '#94a3b8' },
  pending: { label: 'Publicando', color: '#f59e0b' },
  active: { label: 'Ativa', color: '#22c55e' },
  paused: { label: 'Pausada', color: '#f59e0b' },
  completed: { label: 'Encerrada', color: '#6366f1' },
  error: { label: 'Erro', color: '#ef4444' },
}

const URGENCY_COLOR: Record<string, string> = {
  low: '#94a3b8',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
}

const chartOptions: Array<{ key: ChartTab; label: string; color: string; dataKey: string; suffix?: string }> = [
  { key: 'spend', label: 'Gasto', color: '#22c55e', dataKey: 'spend' },
  { key: 'leads', label: 'Resultados', color: '#b8945f', dataKey: 'leads' },
  { key: 'ctr', label: 'CTR', color: '#0ea5e9', dataKey: 'ctr', suffix: '%' },
  { key: 'cpa', label: 'CPA', color: '#f59e0b', dataKey: 'cpa' },
]

function formatCurrency(value: number | null | undefined) {
  return `R$ ${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatNumber(value: number | null | undefined) {
  return Number(value || 0).toLocaleString('pt-BR')
}

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return '-'
  return `${(Number(value) * 100).toFixed(2)}%`
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  return new Date(value.includes('T') ? value : `${value}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function metricResult(metric: MetricSnapshot | null | undefined) {
  return Number(metric?.conversions || metric?.leads_count || 0)
}

function rankingTone(value: string | null | undefined) {
  const normalized = String(value || '').toUpperCase()
  if (normalized.includes('ABOVE')) return '#16a34a'
  if (normalized.includes('BELOW')) return '#dc2626'
  return 'var(--text-primary)'
}

function StatusPill({ status }: { status: { label: string; color: string } }) {
  return (
    <span className="campaign-manager-status" style={{ '--campaign-status': status.color } as CSSProperties}>
      {status.label}
    </span>
  )
}

export default function MetaCampaignDetailView({
  campaign,
  metrics,
  alerts,
  actionLogs,
  actionLoading,
  chartTab,
  toast,
  onBack,
  onRefresh,
  onPublish,
  onExecuteAction,
  onChartTabChange,
}: Props) {
  const [activePanel, setActivePanel] = useState<'overview' | 'daily' | 'ai' | 'setup'>('overview')
  const [renderedAt] = useState(() => Date.now())
  const safeDuration = Math.max(1, Number(campaign.duration_days || 1))
  const dailyTarget = Number(campaign.daily_budget || campaign.total_budget / safeDuration || 0)
  const defaultBudgetInput = dailyTarget > 0 ? dailyTarget.toFixed(2) : ''
  const [budgetDraft, setBudgetDraft] = useState(() => ({ campaignId: campaign.id, value: defaultBudgetInput }))
  const budgetInput = budgetDraft.campaignId === campaign.id ? budgetDraft.value : defaultBudgetInput
  const status = STATUS_MAP[campaign.status] || STATUS_MAP.draft
  const latestMetric = metrics.length > 0 ? metrics[metrics.length - 1] : campaign.latest_metrics || null
  const totalSpend = Number(campaign.latest_metrics?.spend || metrics.reduce((sum, metric) => sum + Number(metric.spend || 0), 0))
  const daysElapsed = campaign.start_date
    ? Math.max(1, Math.ceil((renderedAt - new Date(campaign.start_date).getTime()) / 86400000))
    : 1
  const expectedSpend = dailyTarget * daysElapsed
  const pacingPct = expectedSpend > 0 ? (totalSpend / expectedSpend) * 100 : 0
  const pacingTone = pacingPct > 130 ? 'danger' : pacingPct > 110 || pacingPct < 70 ? 'warn' : 'ok'
  const selectedChart = chartOptions.find(option => option.key === chartTab) || chartOptions[0]

  const chartData = useMemo(() => metrics.map(metric => ({
    date: metric.snapshot_at
      ? new Date(metric.snapshot_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      : '-',
    spend: Number(Number(metric.spend || 0).toFixed(2)),
    leads: metricResult(metric),
    ctr: Number((Number(metric.ctr || 0) * 100).toFixed(2)),
    cpa: Number(Number(metric.cost_per_lead || 0).toFixed(2)),
  })), [metrics])

  const tableRows = useMemo(() => {
    if (metrics.length > 0) return [...metrics].reverse()
    return latestMetric ? [latestMetric] : []
  }, [latestMetric, metrics])

  const funnel = {
    impressions: Number(latestMetric?.impressions || 0),
    clicks: Number(latestMetric?.link_clicks || latestMetric?.clicks || 0),
    lpv: Number(latestMetric?.landing_page_views || 0),
    results: metricResult(latestMetric),
  }

  const submitBudget = () => {
    const parsed = Number(budgetInput.replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed <= 0) return
    onExecuteAction('update_budget', { new_budget: parsed })
  }

  const tabs = [
    { key: 'overview', label: 'Visao geral', count: metrics.length },
    { key: 'daily', label: 'Desempenho diario', count: tableRows.length },
    { key: 'ai', label: 'IA e atividade', count: alerts.length + actionLogs.length },
    { key: 'setup', label: 'Configuracao', count: campaign.ai_auto_manage ? 1 : 0 },
  ] as const

  return (
    <div className="campaign-manager-page">
      {toast && (
        <div className={`campaign-manager-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}

      <div className="campaign-manager-topbar">
        <div className="campaign-manager-title">
          <button type="button" onClick={onBack} aria-label="Voltar para campanhas">
            <ArrowLeft size={18} />
          </button>
          <span className="campaign-manager-avatar">
            {campaign.platform === 'meta' ? 'M' : 'G'}
          </span>
          <div>
            <h1>{campaign.name}</h1>
            <p>
              {campaign.platform === 'meta' ? 'Meta Ads' : 'Google Ads'}
              {campaign.properties?.title ? ` | ${campaign.properties.title}` : ''}
            </p>
          </div>
          <StatusPill status={status} />
        </div>

        <div className="campaign-manager-actions">
          <button type="button" onClick={onRefresh}>
            <RefreshCw size={16} />
            Atualizar
          </button>
          <Link href="/admin/ads">
            <Layers3 size={16} />
            Todas
          </Link>
          {campaign.status === 'draft' && (
            <button type="button" className="primary" onClick={onPublish} disabled={actionLoading}>
              <Megaphone size={16} />
              Publicar
            </button>
          )}
          {campaign.status === 'active' && (
            <button type="button" onClick={() => onExecuteAction('pause')} disabled={actionLoading}>
              <Pause size={16} />
              Pausar
            </button>
          )}
          {campaign.status === 'paused' && (
            <button type="button" className="primary" onClick={() => onExecuteAction('activate')} disabled={actionLoading}>
              <Play size={16} />
              Reativar
            </button>
          )}
        </div>
      </div>

      <section className="campaign-manager-shell">
        <aside className="campaign-manager-left">
          <div className="campaign-manager-left-head">
            <strong>Estrutura</strong>
            <span>{campaign.platform === 'meta' ? 'Meta' : 'Google'}</span>
          </div>
          <button type="button" className="campaign-tree-item active">
            <Megaphone size={16} />
            <span>
              <b>Campanha</b>
              <small>{campaign.name}</small>
            </span>
          </button>
          <button type="button" className="campaign-tree-item muted">
            <Target size={16} />
            <span>
              <b>Conjunto</b>
              <small>Vinculado pela plataforma</small>
            </span>
          </button>
          <button type="button" className="campaign-tree-item muted">
            <Eye size={16} />
            <span>
              <b>Anuncio</b>
              <small>Criativos sincronizados no Meta</small>
            </span>
          </button>

          <div className="campaign-manager-left-summary">
            <span>ID da campanha</span>
            <code>{campaign.external_campaign_id || campaign.id}</code>
          </div>
          <div className="campaign-manager-left-summary">
            <span>Status de IA</span>
            <strong>{campaign.ai_auto_manage ? 'Automatica' : 'Manual'}</strong>
          </div>
        </aside>

        <main className="campaign-manager-main">
          <div className="campaign-manager-tabs">
            {tabs.map(tab => (
              <button
                key={tab.key}
                type="button"
                className={activePanel === tab.key ? 'active' : ''}
                onClick={() => setActivePanel(tab.key)}
              >
                {tab.label}
                <span>{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="campaign-manager-toolbar">
            <button type="button">
              <Pencil size={15} />
              Editar
            </button>
            <button type="button">
              <Settings2 size={15} />
              Colunas
            </button>
            <button type="button" onClick={() => setActivePanel('ai')}>
              <Sparkles size={15} />
              Diagnostico IA
            </button>
            <span>{formatDate(campaign.start_date)} ate {formatDate(campaign.end_date)}</span>
          </div>

          <div className="campaign-manager-kpis">
            <div><span>Gasto</span><strong>{formatCurrency(totalSpend)}</strong></div>
            <div><span>Resultados</span><strong>{formatNumber(metricResult(latestMetric))}</strong></div>
            <div><span>Alcance</span><strong>{formatNumber(latestMetric?.reach)}</strong></div>
            <div><span>Impressoes</span><strong>{formatNumber(latestMetric?.impressions)}</strong></div>
            <div><span>CTR</span><strong>{formatPercent(latestMetric?.ctr)}</strong></div>
            <div><span>CPC</span><strong>{latestMetric?.cpc ? formatCurrency(latestMetric.cpc) : '-'}</strong></div>
            <div><span>CPA</span><strong>{latestMetric?.cost_per_lead ? formatCurrency(latestMetric.cost_per_lead) : '-'}</strong></div>
          </div>

          {activePanel === 'overview' && (
            <div className="campaign-manager-center-scroll">
              <section className="campaign-manager-chart-panel">
                <header>
                  <div>
                    <strong>Evolucao da campanha</strong>
                    <span>{chartData.length} snapshot(s) salvos</span>
                  </div>
                  <div className="campaign-manager-chart-tabs">
                    {chartOptions.map(option => (
                      <button
                        key={option.key}
                        type="button"
                        className={chartTab === option.key ? 'active' : ''}
                        onClick={() => onChartTabChange(option.key)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </header>
                <div className="campaign-manager-chart">
                  {chartData.length === 0 ? (
                    <div className="campaign-manager-empty">
                      <BarChart3 size={30} />
                      <strong>Sem historico de metricas</strong>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(17,24,39,.1)" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                        <Tooltip
                          contentStyle={{
                            background: '#fff',
                            border: '1px solid rgba(17,24,39,.12)',
                            borderRadius: 8,
                            fontSize: '.78rem',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey={selectedChart.dataKey}
                          name={selectedChart.label}
                          stroke={selectedChart.color}
                          fill={selectedChart.color}
                          fillOpacity={0.12}
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>

              <section className="campaign-manager-funnel">
                {[
                  { label: 'Impressoes', value: funnel.impressions, pct: 100 },
                  { label: 'Cliques', value: funnel.clicks, pct: funnel.impressions > 0 ? (funnel.clicks / funnel.impressions) * 100 : 0 },
                  { label: 'LP views', value: funnel.lpv, pct: funnel.impressions > 0 ? (funnel.lpv / funnel.impressions) * 100 : 0 },
                  { label: 'Resultados', value: funnel.results, pct: funnel.impressions > 0 ? (funnel.results / funnel.impressions) * 100 : 0 },
                ].map(item => (
                  <div key={item.label}>
                    <span>{item.label}</span>
                    <strong>{formatNumber(item.value)}</strong>
                    <div><i style={{ width: `${Math.max(3, Math.min(100, item.pct))}%` }} /></div>
                    <small>{item.pct.toFixed(2)}%</small>
                  </div>
                ))}
              </section>

              <DailyTable rows={tableRows.slice(0, 8)} />
            </div>
          )}

          {activePanel === 'daily' && (
            <div className="campaign-manager-center-scroll">
              <DailyTable rows={tableRows} />
            </div>
          )}

          {activePanel === 'ai' && (
            <div className="campaign-manager-center-scroll">
              <section className="campaign-manager-feed">
                <header>
                  <strong>Alertas da IA</strong>
                  <span>{alerts.length} registro(s)</span>
                </header>
                {alerts.length === 0 ? (
                  <div className="campaign-manager-empty">
                    <Brain size={30} />
                    <strong>Nenhum alerta para esta campanha</strong>
                  </div>
                ) : alerts.map(alert => (
                  <article key={alert.id} className="campaign-feed-row" style={{ '--feed-color': URGENCY_COLOR[alert.urgency] || '#94a3b8' } as CSSProperties}>
                    <b>{alert.urgency}</b>
                    <strong>{alert.type}</strong>
                    <span>{formatDateTime(alert.created_at)}</span>
                    <p>{alert.message}</p>
                    {alert.ai_reasoning && <small>{alert.ai_reasoning}</small>}
                  </article>
                ))}
              </section>

              <section className="campaign-manager-feed">
                <header>
                  <strong>Historico de acoes</strong>
                  <span>{actionLogs.length} registro(s)</span>
                </header>
                {actionLogs.length === 0 ? (
                  <div className="campaign-manager-empty">
                    <History size={30} />
                    <strong>Nenhuma acao registrada</strong>
                  </div>
                ) : actionLogs.map(log => (
                  <article key={log.id} className="campaign-feed-row neutral">
                    <b><Clock3 size={13} /></b>
                    <strong>{log.action}</strong>
                    <span>{formatDateTime(log.executed_at)}</span>
                    {log.reason && <p>{log.reason}</p>}
                    {log.new_value && <small>{log.new_value}</small>}
                  </article>
                ))}
              </section>
            </div>
          )}

          {activePanel === 'setup' && (
            <div className="campaign-manager-center-scroll">
              <section className="campaign-manager-setup">
                <div><span>Plataforma</span><strong>{campaign.platform === 'meta' ? 'Meta Ads' : 'Google Ads'}</strong></div>
                <div><span>Status</span><StatusPill status={status} /></div>
                <div><span>Orcamento total</span><strong>{formatCurrency(campaign.total_budget)}</strong></div>
                <div><span>Orcamento diario</span><strong>{formatCurrency(dailyTarget)}</strong></div>
                <div><span>Duracao</span><strong>{safeDuration} dias</strong></div>
                <div><span>Inicio</span><strong>{formatDate(campaign.start_date)}</strong></div>
                <div><span>Termino</span><strong>{formatDate(campaign.end_date)}</strong></div>
                <div><span>IA autonoma</span><strong>{campaign.ai_auto_manage ? 'Ativa' : 'Desativada'}</strong></div>
                <div className="wide"><span>ID interno</span><code>{campaign.id}</code></div>
                {campaign.external_campaign_id && (
                  <div className="wide"><span>ID externo</span><code>{campaign.external_campaign_id}</code></div>
                )}
              </section>
            </div>
          )}
        </main>

        <aside className="campaign-manager-inspector">
          <section>
            <h3>Resumo</h3>
            <div className="campaign-manager-inspector-card">
              <Gauge size={18} />
              <span>Ritmo de verba</span>
              <strong className={`tone-${pacingTone}`}>{pacingPct.toFixed(0)}%</strong>
            </div>
            <div className="campaign-manager-progress">
              <i className={pacingTone} style={{ width: `${Math.max(4, Math.min(100, pacingPct))}%` }} />
            </div>
            <p>{formatCurrency(totalSpend)} gasto de {formatCurrency(campaign.total_budget)}</p>
          </section>

          <section>
            <h3>Acoes</h3>
            <div className="campaign-manager-side-actions">
              {campaign.status === 'draft' && (
                <button type="button" className="primary" onClick={onPublish} disabled={actionLoading}>
                  <Megaphone size={15} /> Publicar
                </button>
              )}
              {campaign.status === 'active' && (
                <button type="button" onClick={() => onExecuteAction('pause')} disabled={actionLoading}>
                  <Pause size={15} /> Pausar
                </button>
              )}
              {campaign.status === 'paused' && (
                <button type="button" className="primary" onClick={() => onExecuteAction('activate')} disabled={actionLoading}>
                  <Play size={15} /> Reativar
                </button>
              )}
              <button type="button" onClick={onRefresh}><RefreshCw size={15} /> Atualizar</button>
            </div>
          </section>

          <section>
            <h3>Orcamento</h3>
            <label className="campaign-manager-budget-edit">
              <span>Diario</span>
              <input value={budgetInput} onChange={event => setBudgetDraft({ campaignId: campaign.id, value: event.target.value })} inputMode="decimal" />
              <button type="button" onClick={submitBudget} disabled={actionLoading}>
                <WalletCards size={14} />
                Salvar
              </button>
            </label>
            <div className="campaign-manager-side-list">
              <span><b>Total</b>{formatCurrency(campaign.total_budget)}</span>
              <span><b>Dia</b>{daysElapsed} de {safeDuration}</span>
              <span><b>Periodo</b>{formatDate(campaign.start_date)} ate {formatDate(campaign.end_date)}</span>
            </div>
          </section>

          <section>
            <h3>Qualidade Meta</h3>
            <div className="campaign-manager-side-list">
              <span><b>Quality</b><em style={{ color: rankingTone(latestMetric?.quality_ranking) }}>{latestMetric?.quality_ranking || '-'}</em></span>
              <span><b>Engajamento</b><em style={{ color: rankingTone(latestMetric?.engagement_rate_ranking) }}>{latestMetric?.engagement_rate_ranking || '-'}</em></span>
              <span><b>Conversao</b><em style={{ color: rankingTone(latestMetric?.conversion_rate_ranking) }}>{latestMetric?.conversion_rate_ranking || '-'}</em></span>
            </div>
          </section>

          <section>
            <h3>Sinais IA</h3>
            {alerts.length === 0 ? (
              <p>Nenhum alerta recente.</p>
            ) : alerts.slice(0, 3).map(alert => (
              <article key={alert.id} className="campaign-manager-alert" style={{ '--alert-color': URGENCY_COLOR[alert.urgency] || '#94a3b8' } as CSSProperties}>
                <strong>{alert.urgency}</strong>
                <span>{alert.message}</span>
              </article>
            ))}
          </section>

          <section>
            <h3>Atividade</h3>
            {actionLogs.length === 0 ? (
              <p>Nenhuma acao registrada.</p>
            ) : actionLogs.slice(0, 4).map(log => (
              <article key={log.id} className="campaign-manager-activity">
                <strong>{log.action}</strong>
                <span>{formatDateTime(log.executed_at)}</span>
              </article>
            ))}
          </section>
        </aside>
      </section>

      <style jsx global>{`
        .campaign-manager-page { min-height: 100vh; color: var(--text-primary); }
        .campaign-manager-topbar { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 0; border-bottom: 1px solid rgba(17,24,39,.1); background: color-mix(in srgb, var(--bg-primary) 94%, transparent); backdrop-filter: blur(12px); }
        .campaign-manager-title { min-width: 0; display: flex; align-items: center; gap: 10px; }
        .campaign-manager-title > button { width: 36px; height: 36px; border: 1px solid rgba(148,163,184,.4); border-radius: 6px; background: #fff; display: inline-grid; place-items: center; cursor: pointer; color: var(--text-primary); flex: 0 0 auto; }
        .campaign-manager-avatar { width: 42px; height: 42px; border-radius: 999px; display: grid; place-items: center; background: rgba(184,148,95,.15); color: var(--gold-dark); font-weight: 900; flex: 0 0 auto; }
        .campaign-manager-title h1 { margin: 0; max-width: min(52vw, 780px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: Inter, sans-serif; font-size: 1.08rem; font-weight: 950; letter-spacing: 0; }
        .campaign-manager-title p { margin: 3px 0 0; max-width: min(52vw, 780px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-muted); font-size: .74rem; font-weight: 800; }
        .campaign-manager-status { display: inline-flex; align-items: center; gap: 6px; height: 26px; border-radius: 999px; padding: 0 9px; background: color-mix(in srgb, var(--campaign-status) 13%, white); color: var(--campaign-status); font-size: .68rem; font-weight: 950; white-space: nowrap; }
        .campaign-manager-status::before { content: ''; width: 7px; height: 7px; border-radius: 999px; background: var(--campaign-status); }
        .campaign-manager-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
        .campaign-manager-actions button, .campaign-manager-actions a, .campaign-manager-toolbar button, .campaign-manager-side-actions button, .campaign-manager-budget-edit button { min-height: 34px; border: 1px solid rgba(148,163,184,.4); border-radius: 6px; background: #fff; color: var(--text-primary); padding: 0 10px; font-size: .74rem; font-weight: 900; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 7px; cursor: pointer; }
        .campaign-manager-actions .primary, .campaign-manager-side-actions .primary { border-color: rgba(184,148,95,.45); background: var(--gold); color: #17120c; }
        .campaign-manager-actions button:disabled, .campaign-manager-side-actions button:disabled, .campaign-manager-budget-edit button:disabled { opacity: .55; cursor: not-allowed; }
        .campaign-manager-shell { margin-top: 14px; height: calc(100vh - 142px); min-height: 690px; display: grid; grid-template-columns: 268px minmax(0, 1fr) 360px; border: 1px solid rgba(17,24,39,.11); border-radius: 8px; background: #fff; overflow: hidden; box-shadow: 0 14px 34px rgba(17,24,39,.06); }
        .campaign-manager-left, .campaign-manager-inspector { min-width: 0; overflow-y: auto; scrollbar-width: thin; background: #fff; }
        .campaign-manager-left { border-right: 1px solid rgba(17,24,39,.11); padding: 12px; }
        .campaign-manager-left-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--text-primary); font-size: .78rem; font-weight: 950; margin-bottom: 10px; }
        .campaign-manager-left-head span { color: var(--text-muted); font-size: .7rem; font-weight: 900; }
        .campaign-tree-item { width: 100%; min-height: 58px; border: 1px solid transparent; border-radius: 7px; background: transparent; display: flex; align-items: center; gap: 10px; text-align: left; padding: 9px; color: var(--text-primary); cursor: pointer; }
        .campaign-tree-item.active { border-color: rgba(184,148,95,.28); background: rgba(184,148,95,.12); }
        .campaign-tree-item.muted { color: var(--text-muted); cursor: default; }
        .campaign-tree-item span { min-width: 0; display: grid; gap: 2px; }
        .campaign-tree-item b, .campaign-tree-item small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .campaign-tree-item b { font-size: .78rem; }
        .campaign-tree-item small { color: var(--text-muted); font-size: .68rem; }
        .campaign-manager-left-summary { margin-top: 12px; padding: 10px; border-top: 1px solid rgba(17,24,39,.08); display: grid; gap: 5px; }
        .campaign-manager-left-summary span { color: var(--text-muted); font-size: .66rem; font-weight: 950; text-transform: uppercase; }
        .campaign-manager-left-summary code, .campaign-manager-left-summary strong { color: var(--text-primary); font-size: .72rem; overflow-wrap: anywhere; }
        .campaign-manager-main { min-width: 0; display: grid; grid-template-rows: auto auto auto minmax(0, 1fr); background: #f3f5f7; }
        .campaign-manager-tabs { display: flex; gap: 7px; overflow-x: auto; padding: 10px 12px; border-bottom: 1px solid rgba(17,24,39,.1); background: #fff; scrollbar-width: thin; }
        .campaign-manager-tabs button { border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--text-primary); padding: 8px 10px; font-size: .76rem; font-weight: 950; display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; cursor: pointer; }
        .campaign-manager-tabs button.active { border-color: rgba(184,148,95,.28); background: rgba(184,148,95,.13); color: var(--gold-dark); }
        .campaign-manager-tabs span { min-width: 21px; height: 21px; border-radius: 999px; display: inline-grid; place-items: center; background: rgba(17,24,39,.08); padding: 0 6px; font-size: .64rem; }
        .campaign-manager-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 12px; border-bottom: 1px solid rgba(17,24,39,.08); background: #fbfbfc; }
        .campaign-manager-toolbar span { margin-left: auto; color: var(--text-muted); font-size: .72rem; font-weight: 850; }
        .campaign-manager-kpis { display: grid; grid-template-columns: repeat(7, minmax(104px, 1fr)); overflow-x: auto; border-bottom: 1px solid rgba(17,24,39,.08); background: linear-gradient(90deg, rgba(250,247,239,.72), #fff); }
        .campaign-manager-kpis div { min-width: 108px; padding: 11px 12px; border-right: 1px solid rgba(17,24,39,.07); }
        .campaign-manager-kpis span { display: block; margin-bottom: 4px; color: var(--text-muted); font-size: .63rem; font-weight: 950; text-transform: uppercase; }
        .campaign-manager-kpis strong { display: block; color: var(--text-primary); font-size: .92rem; white-space: nowrap; }
        .campaign-manager-center-scroll { min-height: 0; overflow: auto; padding: 12px; display: grid; align-content: start; gap: 12px; scrollbar-width: thin; }
        .campaign-manager-chart-panel, .campaign-manager-funnel, .campaign-manager-feed, .campaign-manager-setup, .campaign-manager-daily { border: 1px solid rgba(17,24,39,.1); border-radius: 8px; background: #fff; overflow: hidden; }
        .campaign-manager-chart-panel header, .campaign-manager-feed header, .campaign-manager-daily header { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px; border-bottom: 1px solid rgba(17,24,39,.08); }
        .campaign-manager-chart-panel header strong, .campaign-manager-feed header strong, .campaign-manager-daily header strong { display: block; font-size: .82rem; font-weight: 950; }
        .campaign-manager-chart-panel header span, .campaign-manager-feed header span { color: var(--text-muted); font-size: .7rem; font-weight: 850; }
        .campaign-manager-chart-tabs { display: flex; gap: 5px; flex-wrap: wrap; }
        .campaign-manager-chart-tabs button { min-height: 30px; border: 1px solid rgba(148,163,184,.32); border-radius: 6px; background: #fff; color: var(--text-primary); padding: 0 9px; font-size: .7rem; font-weight: 900; cursor: pointer; }
        .campaign-manager-chart-tabs button.active { border-color: rgba(184,148,95,.32); background: rgba(184,148,95,.14); color: var(--gold-dark); }
        .campaign-manager-chart { height: 280px; padding: 10px 12px 12px; }
        .campaign-manager-empty { min-height: 180px; display: grid; place-items: center; align-content: center; gap: 8px; color: var(--text-muted); text-align: center; }
        .campaign-manager-empty strong { color: var(--text-primary); font-size: .86rem; }
        .campaign-manager-funnel { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 12px; gap: 10px; }
        .campaign-manager-funnel div { min-width: 0; display: grid; gap: 6px; }
        .campaign-manager-funnel span { color: var(--text-muted); font-size: .66rem; font-weight: 950; text-transform: uppercase; }
        .campaign-manager-funnel strong { color: var(--text-primary); font-size: .95rem; }
        .campaign-manager-funnel div div { height: 8px; border-radius: 999px; background: rgba(17,24,39,.08); overflow: hidden; }
        .campaign-manager-funnel i { display: block; height: 100%; border-radius: 999px; background: var(--gold); }
        .campaign-manager-funnel small { color: var(--text-muted); font-size: .68rem; font-weight: 850; }
        .campaign-manager-daily { min-width: 0; }
        .campaign-manager-table-wrap { overflow: auto; scrollbar-width: thin; }
        .campaign-manager-table { width: 100%; min-width: 930px; border-collapse: collapse; font-size: .74rem; }
        .campaign-manager-table th { position: sticky; top: 0; z-index: 2; background: #f8fafc; color: var(--text-muted); border-bottom: 1px solid rgba(17,24,39,.12); padding: 9px 10px; text-align: left; font-size: .64rem; font-weight: 950; text-transform: uppercase; white-space: nowrap; }
        .campaign-manager-table td { border-bottom: 1px solid rgba(17,24,39,.07); padding: 10px; color: var(--text-primary); white-space: nowrap; }
        .campaign-feed-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px 10px; padding: 12px 14px; border-bottom: 1px solid rgba(17,24,39,.07); border-left: 3px solid var(--feed-color); }
        .campaign-feed-row.neutral { border-left-color: rgba(148,163,184,.8); }
        .campaign-feed-row b { display: inline-flex; align-items: center; align-self: start; border-radius: 999px; background: color-mix(in srgb, var(--feed-color, #94a3b8) 13%, white); color: var(--feed-color, #94a3b8); padding: 4px 7px; font-size: .62rem; font-weight: 950; text-transform: uppercase; }
        .campaign-feed-row strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .78rem; }
        .campaign-feed-row > span { color: var(--text-muted); font-size: .68rem; font-weight: 850; }
        .campaign-feed-row p { grid-column: 2 / -1; margin: 0; color: var(--text-secondary); font-size: .76rem; line-height: 1.45; }
        .campaign-feed-row small { grid-column: 2 / -1; color: var(--text-muted); font-size: .72rem; line-height: 1.42; }
        .campaign-manager-setup { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0; }
        .campaign-manager-setup div { min-width: 0; border-right: 1px solid rgba(17,24,39,.07); border-bottom: 1px solid rgba(17,24,39,.07); padding: 12px; display: grid; gap: 5px; }
        .campaign-manager-setup div.wide { grid-column: 1 / -1; }
        .campaign-manager-setup span { color: var(--text-muted); font-size: .64rem; font-weight: 950; text-transform: uppercase; }
        .campaign-manager-setup strong, .campaign-manager-setup code { color: var(--text-primary); font-size: .78rem; overflow-wrap: anywhere; }
        .campaign-manager-inspector { border-left: 1px solid rgba(17,24,39,.11); padding: 14px; display: grid; align-content: start; gap: 14px; }
        .campaign-manager-inspector section { display: grid; gap: 9px; padding-bottom: 13px; border-bottom: 1px solid rgba(17,24,39,.08); }
        .campaign-manager-inspector h3 { margin: 0; font-family: Inter, sans-serif; font-size: .78rem; font-weight: 950; letter-spacing: 0; }
        .campaign-manager-inspector p { margin: 0; color: var(--text-muted); font-size: .72rem; line-height: 1.42; }
        .campaign-manager-inspector-card { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 8px; border: 1px solid rgba(17,24,39,.08); border-radius: 8px; background: rgba(250,247,239,.48); padding: 10px; }
        .campaign-manager-inspector-card svg { color: var(--gold-dark); }
        .campaign-manager-inspector-card span { color: var(--text-muted); font-size: .72rem; font-weight: 850; }
        .campaign-manager-inspector-card strong { font-size: 1rem; }
        .tone-ok { color: #16a34a; }
        .tone-warn { color: #d97706; }
        .tone-danger { color: #dc2626; }
        .campaign-manager-progress { height: 9px; border-radius: 999px; background: rgba(17,24,39,.08); overflow: hidden; }
        .campaign-manager-progress i { display: block; height: 100%; border-radius: 999px; }
        .campaign-manager-progress i.ok { background: #22c55e; }
        .campaign-manager-progress i.warn { background: #f59e0b; }
        .campaign-manager-progress i.danger { background: #ef4444; }
        .campaign-manager-side-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .campaign-manager-budget-edit { display: grid; grid-template-columns: 1fr 112px auto; align-items: center; gap: 8px; }
        .campaign-manager-budget-edit span { color: var(--text-muted); font-size: .72rem; font-weight: 850; }
        .campaign-manager-budget-edit input { min-width: 0; height: 34px; border: 1px solid rgba(148,163,184,.42); border-radius: 6px; background: #fff; color: var(--text-primary); padding: 0 9px; font-size: .76rem; font-weight: 850; }
        .campaign-manager-side-list { display: grid; gap: 7px; }
        .campaign-manager-side-list span { display: flex; justify-content: space-between; gap: 12px; color: var(--text-primary); font-size: .74rem; line-height: 1.35; }
        .campaign-manager-side-list b { color: var(--text-muted); font-size: .66rem; text-transform: uppercase; }
        .campaign-manager-side-list em { font-style: normal; font-weight: 850; text-align: right; }
        .campaign-manager-alert { display: grid; gap: 4px; border-left: 3px solid var(--alert-color); border-radius: 7px; background: rgba(248,250,252,.9); padding: 9px 10px; }
        .campaign-manager-alert strong { color: var(--alert-color); font-size: .64rem; font-weight: 950; text-transform: uppercase; }
        .campaign-manager-alert span { color: var(--text-secondary); font-size: .72rem; line-height: 1.4; }
        .campaign-manager-activity { display: grid; gap: 2px; border-radius: 7px; background: rgba(248,250,252,.9); padding: 9px 10px; }
        .campaign-manager-activity strong { color: var(--text-primary); font-size: .72rem; }
        .campaign-manager-activity span { color: var(--text-muted); font-size: .66rem; font-weight: 850; }
        .campaign-manager-toast { position: fixed; top: 24px; right: 24px; z-index: 10000; display: flex; align-items: center; gap: 10px; border-radius: 12px; background: #fff; padding: 14px 20px; box-shadow: 0 8px 30px rgba(0,0,0,.18); font-size: .9rem; font-weight: 700; animation: campaignToastIn .35s ease-out; }
        .campaign-manager-toast.success { border: 1px solid rgba(34,197,94,.28); color: #16a34a; }
        .campaign-manager-toast.error { border: 1px solid rgba(239,68,68,.28); color: #dc2626; }
        @keyframes campaignToastIn { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 1280px) {
          .campaign-manager-shell { grid-template-columns: 230px minmax(0, 1fr); height: auto; }
          .campaign-manager-inspector { grid-column: 1 / -1; border-left: 0; border-top: 1px solid rgba(17,24,39,.11); grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 860px) {
          .campaign-manager-topbar { position: static; align-items: flex-start; flex-direction: column; }
          .campaign-manager-title { width: 100%; align-items: flex-start; }
          .campaign-manager-title h1, .campaign-manager-title p { max-width: 100%; white-space: normal; }
          .campaign-manager-actions { width: 100%; justify-content: stretch; }
          .campaign-manager-actions button, .campaign-manager-actions a { flex: 1 1 130px; }
          .campaign-manager-shell { grid-template-columns: 1fr; }
          .campaign-manager-left { border-right: 0; border-bottom: 1px solid rgba(17,24,39,.11); }
          .campaign-manager-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .campaign-manager-funnel, .campaign-manager-inspector, .campaign-manager-setup { grid-template-columns: 1fr; }
          .campaign-manager-toolbar span { margin-left: 0; width: 100%; }
        }
      `}</style>
    </div>
  )
}

function DailyTable({ rows }: { rows: MetricSnapshot[] }) {
  return (
    <section className="campaign-manager-daily">
      <header>
        <strong>Detalhamento diario</strong>
        <span>{rows.length} linha(s)</span>
      </header>
      {rows.length === 0 ? (
        <div className="campaign-manager-empty">
          <Activity size={30} />
          <strong>Sem linhas para exibir</strong>
        </div>
      ) : (
        <div className="campaign-manager-table-wrap">
          <table className="campaign-manager-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Gasto</th>
                <th>Resultados</th>
                <th>Alcance</th>
                <th>Impressoes</th>
                <th>Cliques</th>
                <th>CTR</th>
                <th>CPC</th>
                <th>CPA</th>
                <th>Freq.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id || `${row.snapshot_at || 'metric'}-${index}`}>
                  <td>{formatDateTime(row.snapshot_at)}</td>
                  <td>{formatCurrency(row.spend)}</td>
                  <td>{formatNumber(metricResult(row))}</td>
                  <td>{formatNumber(row.reach)}</td>
                  <td>{formatNumber(row.impressions)}</td>
                  <td>{formatNumber(row.link_clicks || row.clicks)}</td>
                  <td>{formatPercent(row.ctr)}</td>
                  <td>{row.cpc ? formatCurrency(row.cpc) : '-'}</td>
                  <td>{row.cost_per_lead ? formatCurrency(row.cost_per_lead) : '-'}</td>
                  <td>{row.frequency ? Number(row.frequency).toFixed(2) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
