'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle,
  History,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  X,
} from 'lucide-react'
import AdsTrackingSettingsCard from './AdsTrackingSettingsCard'

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
  created_at: string
  properties?: { title: string } | null
  latest_metrics?: {
    impressions: number
    clicks: number
    ctr: number
    spend: number
    leads_count: number
    cost_per_lead?: number
    cpm: number
    cpc: number
    reach?: number
    conversions?: number
    quality_ranking?: string
    snapshot_at?: string
    source?: 'live' | 'stored' | 'stored_historical'
  } | null
}

type AlertRow = {
  id: string
  campaign_id: string
  type: string
  urgency: string
  action_taken?: string
  message: string
  ai_reasoning?: string
  created_at: string
  campaign_name?: string
}

type Report = {
  id: string
  type: string
  date: string
  platform: string
  content_markdown: string
  performance_score: number | null
  created_at: string
}

type PaidAiReport = {
  id: string
  title: string
  summary: string | null
  period_start: string | null
  period_end: string | null
  metrics: Record<string, unknown>
}

type MetaAccountHealth = {
  status: number
  status_label: string
  is_payment_issue: boolean
  severity: 'ok' | 'warning' | 'error'
  message: string
}

type MetricsFallback = {
  active: boolean
  campaignCount: number
  latestSnapshotAt: string | null
  mode: 'selected_period' | 'latest_historical'
}

type AdsManagerTab = 'campaigns' | 'adsets' | 'ads'

type Props = {
  campaigns: Campaign[]
  alerts: AlertRow[]
  reports: Report[]
  paidReports: PaidAiReport[]
  paidReportError: string
  paidReportLoading: boolean
  toast: { message: string; type: 'success' | 'error' } | null
  datePreset: string
  startDate: string
  endDate: string
  filter: 'all' | 'active' | 'paused'
  adsManagerTab: AdsManagerTab
  campaignSearch: string
  selectedCampaignId: string
  showHistory: boolean
  expandedReport: string | null
  syncing: boolean
  analyzing: boolean
  liveAccountStats: { spend: number } | null
  metaAccountHealth: MetaAccountHealth | null
  metaConnectionIssue: string
  metricsFallback: MetricsFallback | null
  latestScore: number | null
  onDatePresetChange: (value: string) => void
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onCustomDateSearch: () => void
  onSync: () => void
  onAnalyze: () => void
  onPaidReport: () => void
  onFilterChange: (value: 'all' | 'active' | 'paused') => void
  onTabChange: (value: AdsManagerTab) => void
  onCampaignSearchChange: (value: string) => void
  onSelectedCampaignChange: (value: string) => void
  onShowHistoryChange: (value: boolean) => void
  onExpandedReportChange: (value: string | null) => void
  onNotify: (message: string, type: 'success' | 'error') => void
  renderMarkdown: (value: string) => string
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: '#94a3b8' },
  pending: { label: 'Publicando', color: '#f59e0b' },
  active: { label: 'Ativa', color: '#22c55e' },
  paused: { label: 'Pausada', color: '#f59e0b' },
  completed: { label: 'Encerrada', color: '#6366f1' },
  error: { label: 'Erro', color: '#ef4444' },
}

function formatCurrency(value: number) {
  return `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDateOnly(value: string | null | undefined) {
  if (!value) return '-'
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', {
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
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function metricNumber(metrics: Record<string, unknown> | null | undefined, key: string) {
  const raw = metrics?.[key]
  const parsed = typeof raw === 'number' ? raw : Number(raw || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function metricText(metrics: Record<string, unknown> | null | undefined, key: string) {
  const raw = metrics?.[key]
  return raw == null || raw === '' ? '-' : String(raw)
}

function shortCell(value: string | null | undefined, max = 42) {
  const text = String(value || '').trim()
  if (!text) return '-'
  return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

function ScoreDot({ status }: { status: { label: string; color: string } }) {
  return (
    <span className="ads-manager-status" style={{ '--row-status': status.color } as CSSProperties}>
      {status.label}
    </span>
  )
}

export default function MetaAdsManagerView({
  campaigns,
  alerts,
  reports,
  paidReports,
  paidReportError,
  paidReportLoading,
  toast,
  datePreset,
  startDate,
  endDate,
  filter,
  adsManagerTab,
  campaignSearch,
  selectedCampaignId,
  showHistory,
  expandedReport,
  syncing,
  analyzing,
  liveAccountStats,
  metaAccountHealth,
  metaConnectionIssue,
  metricsFallback,
  latestScore,
  onDatePresetChange,
  onStartDateChange,
  onEndDateChange,
  onCustomDateSearch,
  onSync,
  onAnalyze,
  onPaidReport,
  onFilterChange,
  onTabChange,
  onCampaignSearchChange,
  onSelectedCampaignChange,
  onShowHistoryChange,
  onExpandedReportChange,
  onNotify,
  renderMarkdown,
}: Props) {
  const filteredCampaigns = campaigns.filter(campaign =>
    filter === 'all' ||
    (filter === 'active' && campaign.status === 'active') ||
    (filter === 'paused' && campaign.status === 'paused')
  )
  const campaignSearchTerm = campaignSearch.trim().toLowerCase()
  const managerCampaigns = filteredCampaigns.filter(campaign => {
    if (!campaignSearchTerm) return true
    return [
      campaign.name,
      campaign.status,
      campaign.properties?.title || '',
      campaign.latest_metrics?.quality_ranking || '',
      campaign.latest_metrics?.source || '',
    ].join(' ').toLowerCase().includes(campaignSearchTerm)
  })
  const selectedCampaign = managerCampaigns.find(campaign => campaign.id === selectedCampaignId) || managerCampaigns[0] || null
  const selectedMetrics = selectedCampaign?.latest_metrics || null
  const selectedStatus = selectedCampaign ? STATUS_MAP[selectedCampaign.status] || STATUS_MAP.draft : STATUS_MAP.draft
  const selectedCampaignAlerts = selectedCampaign
    ? alerts.filter(alert => alert.campaign_id === selectedCampaign.id || alert.campaign_name === selectedCampaign.name)
    : []
  const campaignSpend = filteredCampaigns.reduce((sum, campaign) => sum + (campaign.latest_metrics?.spend || 0), 0)
  const liveTodaySpend = datePreset === 'today' ? liveAccountStats?.spend || 0 : 0
  const totalSpend = datePreset === 'today' && liveTodaySpend > campaignSpend ? liveTodaySpend : campaignSpend
  const totalImpressions = filteredCampaigns.reduce((sum, campaign) => sum + (campaign.latest_metrics?.impressions || 0), 0)
  const totalClicks = filteredCampaigns.reduce((sum, campaign) => sum + (campaign.latest_metrics?.clicks || 0), 0)
  const totalReach = filteredCampaigns.reduce((sum, campaign) => sum + (campaign.latest_metrics?.reach || 0), 0)
  const totalConversions = filteredCampaigns.reduce((sum, campaign) => sum + (campaign.latest_metrics?.conversions || campaign.latest_metrics?.leads_count || 0), 0)
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const avgCpa = totalConversions > 0 ? totalSpend / totalConversions : 0
  const activeCampaigns = campaigns.filter(campaign => campaign.status === 'active').length
  const pausedCampaigns = campaigns.filter(campaign => campaign.status === 'paused').length
  const latestPaidReport = paidReports[0] || null
  const latestPaidMetrics = latestPaidReport?.metrics || null
  const adsManagerTabs: Array<{ key: AdsManagerTab; label: string; count: number }> = [
    { key: 'campaigns', label: 'Campanhas', count: managerCampaigns.length },
    { key: 'adsets', label: 'Conjuntos de anuncios', count: 0 },
    { key: 'ads', label: 'Anuncios', count: 0 },
  ]

  return (
    <div className="ads-manager-page">
      {toast && (
        <div className={`ads-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}

      <div className="ads-manager-topbar">
        <div>
          <h1><Megaphone size={24} /> Meta Ads</h1>
          <p>{campaigns.length} campanha(s) sincronizadas | Atualizado em {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="ads-manager-actions">
          <select value={datePreset} onChange={event => onDatePresetChange(event.target.value)} aria-label="Periodo">
            <option value="today">Hoje</option>
            <option value="yesterday">Ontem</option>
            <option value="last_7d">Ultimos 7 dias</option>
            <option value="last_30d">Ultimos 30 dias</option>
            <option value="this_month">Este mes</option>
            <option value="last_month">Mes passado</option>
            <option value="maximum">Vitalicio</option>
            <option value="custom">Personalizado</option>
          </select>
          {datePreset === 'custom' && (
            <div className="ads-manager-date-range">
              <input type="date" value={startDate} onChange={event => onStartDateChange(event.target.value)} />
              <input type="date" value={endDate} onChange={event => onEndDateChange(event.target.value)} />
              <button type="button" onClick={onCustomDateSearch}><Search size={15} /></button>
            </div>
          )}
          <button type="button" onClick={onSync} disabled={syncing}>
            <RefreshCw size={16} className={syncing ? 'spin' : ''} />
            Sincronizar
          </button>
          <button type="button" onClick={onAnalyze} disabled={analyzing || campaigns.length === 0}>
            <Brain size={16} className={analyzing ? 'spin' : ''} />
            Analisar com IA
          </button>
          <Link href="/admin/ads/new" className="primary">
            <Plus size={16} />
            Criar campanha
          </Link>
        </div>
      </div>

      {metaAccountHealth && metaAccountHealth.severity !== 'ok' && (
        <div className={`ads-manager-warning severity-${metaAccountHealth.severity}`}>
          <AlertTriangle size={18} />
          <div>
            <strong>{metaAccountHealth.is_payment_issue ? 'Conta Meta com pendencia de pagamento' : 'Conta Meta precisa de atencao'}</strong>
            <span>{metaAccountHealth.message} Status: {metaAccountHealth.status_label} ({metaAccountHealth.status}).</span>
          </div>
        </div>
      )}

      {metaConnectionIssue && (
        <div className="ads-manager-warning severity-warning">
          <AlertTriangle size={18} />
          <div>
            <strong>Meta Ads sem leitura ao vivo</strong>
            <span>
              {metaConnectionIssue}
              {metricsFallback?.active && (
                <> Historico salvo: {metricsFallback.campaignCount} campanha(s){metricsFallback.latestSnapshotAt ? ` em ${formatDateTime(metricsFallback.latestSnapshotAt)}` : ''}.</>
              )}
            </span>
          </div>
        </div>
      )}

      <section className="ads-manager-shell">
        <div className="ads-manager-tabs">
          {adsManagerTabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              className={adsManagerTab === tab.key ? 'active' : ''}
              onClick={() => onTabChange(tab.key)}
            >
              {tab.label}
              <span>{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="ads-manager-toolbar">
          <div className="ads-manager-search">
            <Search size={16} />
            <input
              value={campaignSearch}
              onChange={event => onCampaignSearchChange(event.target.value)}
              placeholder="Pesquisar campanha"
            />
          </div>
          <div className="ads-manager-segments">
            {(['all', 'active', 'paused'] as const).map(item => (
              <button
                key={item}
                type="button"
                className={filter === item ? 'active' : ''}
                onClick={() => onFilterChange(item)}
              >
                {item === 'all' ? 'Todas' : item === 'active' ? 'Ativas' : 'Pausadas'}
              </button>
            ))}
          </div>
          <Link href="/admin/ads/relatorio">
            <Sparkles size={15} />
            Gestor IA
          </Link>
          <Link href="/admin/ads/vitor">
            <Brain size={15} />
            Vitor
          </Link>
          <button type="button" onClick={() => onShowHistoryChange(true)}>
            <History size={15} />
            Historico
          </button>
          <button type="button" onClick={onPaidReport} disabled={paidReportLoading}>
            <Sparkles size={15} className={paidReportLoading ? 'spin' : ''} />
            Relatorio IA
          </button>
        </div>

        <div className="ads-manager-kpis">
          <div><span>Gasto</span><strong>{formatCurrency(totalSpend)}</strong></div>
          <div><span>Resultados</span><strong>{totalConversions.toLocaleString('pt-BR')}</strong></div>
          <div><span>Alcance</span><strong>{totalReach.toLocaleString('pt-BR')}</strong></div>
          <div><span>Impressoes</span><strong>{totalImpressions.toLocaleString('pt-BR')}</strong></div>
          <div><span>CTR</span><strong>{avgCtr.toFixed(2)}%</strong></div>
          <div><span>CPA</span><strong>{avgCpa > 0 ? formatCurrency(avgCpa) : '-'}</strong></div>
          <div><span>Ativas</span><strong>{activeCampaigns}</strong></div>
          <div><span>Pausadas</span><strong>{pausedCampaigns}</strong></div>
        </div>

        <div className="ads-manager-workspace">
          <div className="ads-manager-table-wrap">
            {adsManagerTab !== 'campaigns' ? (
              <div className="ads-manager-empty">
                <Target size={30} />
                <strong>{adsManagerTab === 'adsets' ? 'Conjuntos de anuncios' : 'Anuncios'}</strong>
                <span>Quando a API trouxer estes niveis, eles entram aqui no mesmo modelo de tabela.</span>
              </div>
            ) : managerCampaigns.length === 0 ? (
              <div className="ads-manager-empty">
                <Megaphone size={30} />
                <strong>Nenhuma campanha encontrada</strong>
                <span>Ajuste o filtro ou sincronize a conta Meta.</span>
              </div>
            ) : (
              <table className="ads-manager-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Status</th>
                    <th>Campanha</th>
                    <th>Orcamento</th>
                    <th>Gasto</th>
                    <th>Resultados</th>
                    <th>Alcance</th>
                    <th>Impressoes</th>
                    <th>CPM</th>
                    <th>CPC</th>
                    <th>CTR</th>
                    <th>CPA</th>
                    <th>Ranking</th>
                  </tr>
                </thead>
                <tbody>
                  {managerCampaigns.map(campaign => {
                    const status = STATUS_MAP[campaign.status] || STATUS_MAP.draft
                    const metrics = campaign.latest_metrics
                    const results = metrics?.conversions || metrics?.leads_count || 0
                    const selected = selectedCampaign?.id === campaign.id
                    return (
                      <tr
                        key={campaign.id}
                        className={selected ? 'selected' : ''}
                        onClick={() => onSelectedCampaignChange(campaign.id)}
                      >
                        <td><input type="checkbox" readOnly checked={selected} /></td>
                        <td><ScoreDot status={status} /></td>
                        <td className="name-cell">
                          <Link href={`/admin/ads/${campaign.id}`} onClick={event => event.stopPropagation()}>{campaign.name}</Link>
                          <small>{campaign.properties?.title || 'Meta Ads'}{metrics?.source && metrics.source !== 'live' ? ' | historico salvo' : ''}</small>
                        </td>
                        <td>{campaign.daily_budget ? formatCurrency(campaign.daily_budget) : formatCurrency(campaign.total_budget || 0)}</td>
                        <td>{formatCurrency(metrics?.spend || 0)}</td>
                        <td>{results.toLocaleString('pt-BR')}</td>
                        <td>{metrics?.reach?.toLocaleString('pt-BR') || '-'}</td>
                        <td>{metrics?.impressions?.toLocaleString('pt-BR') || '-'}</td>
                        <td>{metrics?.cpm ? formatCurrency(metrics.cpm) : '-'}</td>
                        <td>{metrics?.cpc ? formatCurrency(metrics.cpc) : '-'}</td>
                        <td>{metrics?.ctr ? `${(metrics.ctr * 100).toFixed(2)}%` : '-'}</td>
                        <td>{metrics?.cost_per_lead ? formatCurrency(metrics.cost_per_lead) : '-'}</td>
                        <td>{shortCell(metrics?.quality_ranking, 24)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          <aside className="ads-manager-detail">
            {selectedCampaign ? (
              <>
                <div className="ads-manager-detail-head">
                  <span className="ads-manager-detail-avatar">M</span>
                  <div>
                    <strong>{selectedCampaign.name}</strong>
                    <small>{selectedCampaign.properties?.title || 'Campanha Meta Ads'}</small>
                  </div>
                </div>

                <div className="ads-manager-detail-actions">
                  <Link href={`/admin/ads/${selectedCampaign.id}`}>Abrir detalhes <ArrowRight size={14} /></Link>
                  <button type="button" onClick={onAnalyze} disabled={analyzing}>IA</button>
                </div>

                <section>
                  <h3>Status</h3>
                  <div className="ads-manager-status-card">
                    <ScoreDot status={selectedStatus} />
                    <small>{selectedCampaign.ai_auto_manage ? 'IA ativa na campanha' : 'Gerenciamento manual'}</small>
                  </div>
                </section>

                <section>
                  <h3>Resumo</h3>
                  <div className="ads-manager-detail-grid">
                    <div><span>Gasto</span><strong>{formatCurrency(selectedMetrics?.spend || 0)}</strong></div>
                    <div><span>Resultados</span><strong>{(selectedMetrics?.conversions || selectedMetrics?.leads_count || 0).toLocaleString('pt-BR')}</strong></div>
                    <div><span>CPA</span><strong>{selectedMetrics?.cost_per_lead ? formatCurrency(selectedMetrics.cost_per_lead) : '-'}</strong></div>
                    <div><span>CTR</span><strong>{selectedMetrics?.ctr ? `${(selectedMetrics.ctr * 100).toFixed(2)}%` : '-'}</strong></div>
                    <div><span>Alcance</span><strong>{selectedMetrics?.reach?.toLocaleString('pt-BR') || '-'}</strong></div>
                    <div><span>Cliques</span><strong>{selectedMetrics?.clicks?.toLocaleString('pt-BR') || '-'}</strong></div>
                  </div>
                </section>

                <section>
                  <h3>Periodo e verba</h3>
                  <div className="ads-manager-detail-list">
                    <span><b>Inicio</b>{formatDateOnly(selectedCampaign.start_date)}</span>
                    <span><b>Fim</b>{formatDateOnly(selectedCampaign.end_date)}</span>
                    <span><b>Dias</b>{selectedCampaign.duration_days || '-'}</span>
                    <span><b>Total</b>{formatCurrency(selectedCampaign.total_budget || 0)}</span>
                  </div>
                </section>

                <section>
                  <h3>Diagnostico</h3>
                  {selectedCampaignAlerts.length === 0 ? (
                    <p className="ads-manager-muted">Nenhum alerta especifico para esta campanha.</p>
                  ) : selectedCampaignAlerts.slice(0, 4).map(alert => (
                    <article key={alert.id} className={`ads-manager-alert urgency-${alert.urgency}`}>
                      <strong>{alert.type}</strong>
                      <p>{alert.message}</p>
                    </article>
                  ))}
                </section>

                {latestPaidReport && (
                  <section>
                    <h3>Relatorio IA</h3>
                    <p className="ads-manager-muted">{latestPaidReport.summary}</p>
                    <div className="ads-manager-detail-list">
                      <span><b>Score</b>{metricText(latestPaidMetrics, 'health_score')}</span>
                      <span><b>Risco</b>{metricText(latestPaidMetrics, 'main_risk')}</span>
                      <span><b>Periodo</b>{formatDateOnly(latestPaidReport.period_start)} a {formatDateOnly(latestPaidReport.period_end)}</span>
                    </div>
                  </section>
                )}

                {latestScore != null && (
                  <section>
                    <h3>Termometro IA</h3>
                    <div className="ads-manager-score">
                      <strong>{latestScore}</strong>
                      <span>Performance do periodo</span>
                    </div>
                  </section>
                )}

                {paidReportError && <div className="ads-manager-warning severity-error"><AlertTriangle size={16} /><span>{paidReportError}</span></div>}

                <details className="ads-manager-side-details">
                  <summary>Tracking Meta</summary>
                  <AdsTrackingSettingsCard platform="meta" onNotify={onNotify} />
                </details>
              </>
            ) : (
              <div className="ads-manager-empty small">
                <Megaphone size={28} />
                <strong>Selecione uma campanha</strong>
                <span>Os detalhes aparecem aqui.</span>
              </div>
            )}
          </aside>
        </div>
      </section>

      {showHistory && (
        <div className="ads-manager-modal">
          <div className="ads-manager-modal-card">
            <header>
              <strong><History size={20} /> Historico de Analises IA - Meta Ads</strong>
              <button type="button" onClick={() => onShowHistoryChange(false)}><X size={20} /></button>
            </header>
            <div>
              {reports.length === 0 ? (
                <div className="ads-manager-empty">
                  <Brain size={34} />
                  <strong>Nenhum relatorio gerado ainda</strong>
                  <span>Os relatorios aparecem aqui quando o agente gerar analises.</span>
                </div>
              ) : reports.map(report => {
                const isExpanded = expandedReport === report.id
                return (
                  <article key={report.id} className="ads-manager-report" onClick={() => onExpandedReportChange(isExpanded ? null : report.id)}>
                    <div>
                      <strong>{report.type === 'daily' ? 'Fechamento Diario' : 'Diretriz Semanal'}</strong>
                      {report.performance_score != null && <span>{report.performance_score}/100</span>}
                      <small>{formatDateTime(report.created_at)}</small>
                    </div>
                    {isExpanded && <div dangerouslySetInnerHTML={{ __html: renderMarkdown(report.content_markdown || '') }} />}
                  </article>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .ads-manager-page { min-height: 100vh; color: var(--text-primary); }
        .ads-manager-topbar { position: sticky; top: 0; z-index: 20; display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(17,24,39,.08); background: color-mix(in srgb, var(--bg-primary) 93%, transparent); backdrop-filter: blur(12px); }
        .ads-manager-topbar h1 { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 1.5rem; }
        .ads-manager-topbar p { margin: 4px 0 0; color: var(--text-muted); font-size: .78rem; font-weight: 800; }
        .ads-manager-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
        .ads-manager-actions button, .ads-manager-actions a, .ads-manager-actions select, .ads-manager-date-range input { height: 36px; border: 1px solid rgba(148,163,184,.42); border-radius: 6px; background: #fff; color: var(--text-primary); padding: 0 10px; font-size: .75rem; font-weight: 900; text-decoration: none; display: inline-flex; align-items: center; gap: 7px; cursor: pointer; }
        .ads-manager-actions a.primary { border-color: rgba(201,169,110,.45); background: var(--gold); color: #17120c; }
        .ads-manager-actions button:disabled { opacity: .55; cursor: not-allowed; }
        .ads-manager-date-range { display: inline-flex; align-items: center; gap: 6px; }
        .ads-manager-date-range input { width: 132px; }
        .ads-manager-warning { display: flex; align-items: flex-start; gap: 10px; border-radius: 8px; margin: 12px 0; padding: 12px 14px; font-size: .8rem; }
        .ads-manager-warning strong { display: block; margin-bottom: 3px; }
        .ads-manager-warning span { color: var(--text-muted); line-height: 1.4; }
        .ads-manager-warning.severity-error { border: 1px solid rgba(239,68,68,.25); background: rgba(239,68,68,.08); }
        .ads-manager-warning.severity-warning { border: 1px solid rgba(245,158,11,.25); background: rgba(245,158,11,.08); }
        .ads-manager-shell { margin-top: 14px; border: 1px solid rgba(17,24,39,.11); border-radius: 8px; background: #fff; overflow: hidden; box-shadow: 0 14px 34px rgba(17,24,39,.06); }
        .ads-manager-tabs { display: flex; gap: 8px; overflow-x: auto; padding: 10px 12px; border-bottom: 1px solid rgba(17,24,39,.1); background: #fff; scrollbar-width: thin; }
        .ads-manager-tabs button { border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--text-primary); padding: 9px 11px; font-size: .78rem; font-weight: 900; display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; cursor: pointer; }
        .ads-manager-tabs button.active { border-color: rgba(201,169,110,.28); background: rgba(201,169,110,.13); color: var(--gold); }
        .ads-manager-tabs span { min-width: 22px; height: 22px; border-radius: 999px; display: inline-grid; place-items: center; background: rgba(17,24,39,.08); padding: 0 6px; font-size: .66rem; }
        .ads-manager-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 12px; border-bottom: 1px solid rgba(17,24,39,.08); background: #fbfbfc; }
        .ads-manager-search { height: 38px; min-width: 260px; display: flex; align-items: center; gap: 8px; border: 1px solid rgba(148,163,184,.42); border-radius: 6px; background: #fff; padding: 0 10px; color: var(--text-muted); }
        .ads-manager-search input { border: 0; outline: none; width: 100%; color: var(--text-primary); background: transparent; font-size: .8rem; }
        .ads-manager-segments { display: inline-flex; align-items: center; gap: 4px; }
        .ads-manager-segments button, .ads-manager-toolbar > button, .ads-manager-toolbar > a { height: 34px; border: 1px solid rgba(148,163,184,.32); border-radius: 6px; background: #fff; color: var(--text-primary); padding: 0 10px; font-size: .72rem; font-weight: 900; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
        .ads-manager-toolbar > button:disabled { opacity: .55; cursor: not-allowed; }
        .ads-manager-segments button.active { border-color: rgba(201,169,110,.3); background: rgba(201,169,110,.13); color: var(--gold); }
        .ads-manager-kpis { display: grid; grid-template-columns: repeat(8, minmax(110px, 1fr)); border-bottom: 1px solid rgba(17,24,39,.08); background: linear-gradient(90deg, rgba(250,247,239,.72), #fff); overflow-x: auto; }
        .ads-manager-kpis div { padding: 11px 12px; border-right: 1px solid rgba(17,24,39,.07); min-width: 112px; }
        .ads-manager-kpis span { display: block; color: var(--text-muted); font-size: .64rem; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; }
        .ads-manager-kpis strong { color: var(--text-primary); font-size: .94rem; white-space: nowrap; }
        .ads-manager-workspace { display: grid; grid-template-columns: minmax(620px, 1fr) 360px; height: calc(100vh - 286px); min-height: 620px; background: #f3f5f7; }
        .ads-manager-table-wrap { min-width: 0; overflow: auto; scrollbar-width: thin; background: #fff; }
        .ads-manager-table { width: 100%; min-width: 1180px; border-collapse: collapse; font-size: .75rem; }
        .ads-manager-table th { position: sticky; top: 0; z-index: 2; background: #f8fafc; color: var(--text-muted); border-bottom: 1px solid rgba(17,24,39,.12); padding: 10px 9px; text-align: left; font-size: .66rem; font-weight: 900; text-transform: uppercase; white-space: nowrap; }
        .ads-manager-table td { border-bottom: 1px solid rgba(17,24,39,.07); padding: 10px 9px; color: var(--text-primary); white-space: nowrap; vertical-align: middle; }
        .ads-manager-table tr { cursor: pointer; }
        .ads-manager-table tr:hover, .ads-manager-table tr.selected { background: rgba(201,169,110,.09); }
        .ads-manager-table input { width: 15px; height: 15px; accent-color: var(--gold); }
        .ads-manager-status { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; background: color-mix(in srgb, var(--row-status) 13%, white); color: var(--row-status); padding: 5px 8px; font-size: .68rem; font-weight: 900; }
        .ads-manager-status::before { content: ''; width: 7px; height: 7px; border-radius: 999px; background: var(--row-status); }
        .name-cell { min-width: 280px; max-width: 380px; }
        .name-cell a { display: block; max-width: 340px; color: var(--text-primary); text-decoration: none; font-weight: 900; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .name-cell small { display: block; margin-top: 3px; color: var(--text-muted); font-size: .66rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ads-manager-detail { min-width: 0; overflow-y: auto; border-left: 1px solid rgba(17,24,39,.12); background: #fff; padding: 14px; display: grid; align-content: start; gap: 14px; scrollbar-width: thin; }
        .ads-manager-detail-head { display: flex; gap: 10px; align-items: center; padding-bottom: 12px; border-bottom: 1px solid rgba(17,24,39,.08); }
        .ads-manager-detail-avatar { width: 46px; height: 46px; display: grid; place-items: center; border-radius: 999px; background: rgba(201,169,110,.15); color: var(--gold); font-weight: 900; }
        .ads-manager-detail-head div { min-width: 0; display: grid; gap: 2px; }
        .ads-manager-detail-head strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .92rem; }
        .ads-manager-detail-head small, .ads-manager-muted { color: var(--text-muted); font-size: .72rem; line-height: 1.4; }
        .ads-manager-detail-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .ads-manager-detail-actions a, .ads-manager-detail-actions button { height: 34px; border: 1px solid rgba(201,169,110,.35); border-radius: 6px; background: rgba(201,169,110,.12); color: var(--gold); padding: 0 10px; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; font-size: .72rem; font-weight: 900; cursor: pointer; }
        .ads-manager-detail-actions button:disabled { opacity: .55; cursor: not-allowed; }
        .ads-manager-detail section { display: grid; gap: 9px; padding-bottom: 12px; border-bottom: 1px solid rgba(17,24,39,.08); }
        .ads-manager-detail h3 { margin: 0; color: var(--text-primary); font-size: .78rem; font-weight: 900; }
        .ads-manager-status-card { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .ads-manager-status-card small { color: var(--text-muted); font-size: .68rem; font-weight: 800; }
        .ads-manager-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .ads-manager-detail-grid div { border: 1px solid rgba(17,24,39,.08); border-radius: 8px; background: rgba(250,247,239,.45); padding: 9px; min-width: 0; }
        .ads-manager-detail-grid span { display: block; color: var(--text-muted); font-size: .62rem; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; }
        .ads-manager-detail-grid strong { color: var(--text-primary); font-size: .86rem; }
        .ads-manager-detail-list { display: grid; gap: 7px; }
        .ads-manager-detail-list span { display: flex; justify-content: space-between; gap: 12px; color: var(--text-primary); font-size: .75rem; }
        .ads-manager-detail-list b { color: var(--text-muted); font-size: .68rem; text-transform: uppercase; }
        .ads-manager-score { border: 1px solid rgba(201,169,110,.22); border-radius: 8px; background: rgba(201,169,110,.09); padding: 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .ads-manager-score strong { font-family: Playfair Display, serif; color: var(--gold); font-size: 1.5rem; }
        .ads-manager-score span { color: var(--text-muted); font-size: .72rem; font-weight: 900; }
        .ads-manager-alert { border-radius: 8px; border-left: 3px solid #94a3b8; background: rgba(248,250,252,.86); padding: 9px 10px; }
        .ads-manager-alert.urgency-critical, .ads-manager-alert.urgency-high { border-left-color: #ef4444; }
        .ads-manager-alert.urgency-medium { border-left-color: #f59e0b; }
        .ads-manager-alert strong { display: block; font-size: .72rem; text-transform: uppercase; color: var(--text-primary); margin-bottom: 4px; }
        .ads-manager-alert p { margin: 0; color: var(--text-muted); font-size: .72rem; line-height: 1.4; }
        .ads-manager-side-details summary { cursor: pointer; color: var(--text-primary); font-size: .78rem; font-weight: 900; margin-bottom: 8px; }
        .ads-manager-side-details .ads-tracking-card { margin: 0; box-shadow: none; }
        .ads-manager-empty { min-height: 240px; display: grid; place-items: center; align-content: center; gap: 8px; color: var(--text-muted); text-align: center; padding: 24px; }
        .ads-manager-empty.small { min-height: 340px; }
        .ads-manager-empty strong { color: var(--text-primary); font-size: .92rem; }
        .ads-manager-empty span { max-width: 360px; font-size: .78rem; line-height: 1.4; }
        .ads-manager-modal { position: fixed; inset: 0; z-index: 99999; display: grid; place-items: center; padding: 24px; background: rgba(17,24,39,.55); backdrop-filter: blur(4px); }
        .ads-manager-modal-card { width: min(860px, 100%); max-height: 88vh; display: grid; grid-template-rows: auto minmax(0, 1fr); border-radius: 10px; background: #fff; overflow: hidden; box-shadow: 0 24px 64px rgba(17,24,39,.28); }
        .ads-manager-modal-card header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; border-bottom: 1px solid rgba(17,24,39,.08); }
        .ads-manager-modal-card header strong { display: inline-flex; align-items: center; gap: 8px; }
        .ads-manager-modal-card header button { border: 0; background: transparent; color: var(--text-muted); cursor: pointer; }
        .ads-manager-modal-card > div { overflow-y: auto; padding: 16px; display: grid; gap: 10px; }
        .ads-manager-report { border: 1px solid rgba(17,24,39,.08); border-radius: 8px; padding: 12px; cursor: pointer; }
        .ads-manager-report > div:first-child { display: flex; align-items: center; gap: 10px; }
        .ads-manager-report strong { color: var(--text-primary); }
        .ads-manager-report span { border-radius: 999px; background: rgba(201,169,110,.14); color: var(--gold); padding: 4px 8px; font-size: .68rem; font-weight: 900; }
        .ads-manager-report small { margin-left: auto; color: var(--text-muted); font-size: .68rem; }
        .ads-toast { position: fixed; top: 24px; right: 24px; padding: 14px 24px; border-radius: 12px; font-size: 0.9rem; font-weight: 500; display: flex; align-items: center; gap: 10px; z-index: 10000; animation: adsToastIn 0.35s ease-out; box-shadow: 0 8px 30px rgba(0,0,0,0.2); background: #fff; }
        .ads-toast.success { border: 1px solid rgba(74,222,128,0.3); color: #16a34a; }
        .ads-toast.error { border: 1px solid rgba(248,113,113,0.3); color: #dc2626; }
        @keyframes adsToastIn { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }
        @media (max-width: 1180px) {
          .ads-manager-workspace { grid-template-columns: 1fr; height: auto; }
          .ads-manager-detail { border-left: 0; border-top: 1px solid rgba(17,24,39,.12); }
        }
        @media (max-width: 760px) {
          .ads-manager-topbar { position: static; align-items: flex-start; flex-direction: column; }
          .ads-manager-actions { justify-content: stretch; width: 100%; }
          .ads-manager-actions button, .ads-manager-actions a, .ads-manager-actions select { flex: 1 1 145px; justify-content: center; }
          .ads-manager-search { flex: 1 1 100%; min-width: 0; }
          .ads-manager-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .ads-manager-table { min-width: 980px; }
        }
      `}</style>
    </div>
  )
}
