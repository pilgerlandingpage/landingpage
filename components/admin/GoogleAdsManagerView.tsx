'use client'

import Link from 'next/link'
import { useState, type CSSProperties } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock3,
  CreditCard,
  Eye,
  FileText,
  Gauge,
  History,
  LineChart,
  Megaphone,
  MousePointerClick,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Target,
  Users,
  X,
} from 'lucide-react'

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
    engagement_rate_ranking?: string
    conversion_rate_ranking?: string
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

type GoogleAccountHealth = {
  account_id?: string
  name?: string
  customer_status?: string
  customer_status_label: string
  billing_status?: string | null
  billing_status_label?: string | null
  payments_account?: string | null
  currency?: string | null
  timezone_name?: string | null
  is_active: boolean
  is_payment_issue: boolean
  severity: 'ok' | 'warning' | 'error'
  message: string
}

type InternalStats = {
  totalLeads: number
  recentLeads: Array<{
    name?: string | null
    phone?: string | null
    created_at?: string | null
    funnel_stage?: string | null
  }>
}

type GoogleAdsTab = 'overview' | 'campaigns' | 'recommendations' | 'conversions'

type Props = {
  campaigns: Campaign[]
  alerts: AlertRow[]
  reports: Report[]
  internalStats: InternalStats
  googleAccountHealth: GoogleAccountHealth | null
  toast: { message: string; type: 'success' | 'error' } | null
  datePreset: string
  startDate: string
  endDate: string
  filter: 'all' | 'active' | 'paused'
  syncing: boolean
  analyzing: boolean
  latestScore: number | null
  showHistory: boolean
  expandedReport: string | null
  onDatePresetChange: (value: string) => void
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onCustomDateSearch: () => void
  onSync: () => void
  onAnalyze: () => void
  onFilterChange: (value: 'all' | 'active' | 'paused') => void
  onShowHistoryChange: (value: boolean) => void
  onExpandedReportChange: (value: string | null) => void
  renderMarkdown: (value: string) => string
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: 'Rascunho', color: '#5f6368' },
  pending: { label: 'Publicando', color: '#fbbc04' },
  active: { label: 'Qualificada', color: '#34a853' },
  paused: { label: 'Pausada', color: '#f9ab00' },
  completed: { label: 'Encerrada', color: '#1a73e8' },
  error: { label: 'Reprovada', color: '#ea4335' },
}

const URGENCY_COLOR: Record<string, string> = {
  low: '#5f6368',
  medium: '#fbbc04',
  high: '#f9ab00',
  critical: '#ea4335',
}

function formatCurrency(value: number | null | undefined) {
  return `R$ ${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatNumber(value: number | null | undefined) {
  return Number(value || 0).toLocaleString('pt-BR')
}

function formatPercentDecimal(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return '-'
  return `${(Number(value) * 100).toFixed(2)}%`
}

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return '-'
  return `${Number(value).toFixed(1)}%`
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

function metricResults(campaign: Campaign) {
  const metrics = campaign.latest_metrics
  return Number(metrics?.conversions || metrics?.leads_count || 0)
}

function optimizationScore(campaign: Campaign) {
  const metrics = campaign.latest_metrics
  if (!metrics) return 0
  let score = 62
  if (campaign.status === 'active') score += 10
  if (Number(metrics.ctr || 0) >= 0.015) score += 10
  if (Number(metrics.cost_per_lead || 0) > 0 && Number(metrics.cost_per_lead || 0) < 80) score += 8
  if (Number(metrics.conversions || metrics.leads_count || 0) > 0) score += 7
  if (Number(metrics.spend || 0) === 0) score -= 12
  return Math.max(0, Math.min(100, score))
}

function shortText(value: string | null | undefined, max = 44) {
  const text = String(value || '').trim()
  if (!text) return '-'
  return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

function StatusBadge({ campaign }: { campaign: Campaign }) {
  const status = STATUS_MAP[campaign.status] || STATUS_MAP.draft
  return (
    <span className="google-manager-status" style={{ '--google-status': status.color } as CSSProperties}>
      {status.label}
    </span>
  )
}

export default function GoogleAdsManagerView({
  campaigns,
  alerts,
  reports,
  internalStats,
  googleAccountHealth,
  toast,
  datePreset,
  startDate,
  endDate,
  filter,
  syncing,
  analyzing,
  latestScore,
  showHistory,
  expandedReport,
  onDatePresetChange,
  onStartDateChange,
  onEndDateChange,
  onCustomDateSearch,
  onSync,
  onAnalyze,
  onFilterChange,
  onShowHistoryChange,
  onExpandedReportChange,
  renderMarkdown,
}: Props) {
  const [activeTab, setActiveTab] = useState<GoogleAdsTab>('campaigns')
  const [query, setQuery] = useState('')
  const [selectedCampaignId, setSelectedCampaignId] = useState('')
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null)

  const filteredCampaigns = campaigns.filter(campaign =>
    filter === 'all' ||
    (filter === 'active' && campaign.status === 'active') ||
    (filter === 'paused' && campaign.status === 'paused')
  )

  const searchedCampaigns = filteredCampaigns.filter(campaign => {
    const term = query.trim().toLowerCase()
    if (!term) return true
    return [
      campaign.name,
      campaign.status,
      campaign.properties?.title || '',
      campaign.latest_metrics?.quality_ranking || '',
    ].join(' ').toLowerCase().includes(term)
  })

  const selectedCampaign = searchedCampaigns.find(campaign => campaign.id === selectedCampaignId) || searchedCampaigns[0] || null
  const selectedMetrics = selectedCampaign?.latest_metrics || null
  const selectedAlerts = selectedCampaign
    ? alerts.filter(alert => alert.campaign_id === selectedCampaign.id || alert.campaign_name === selectedCampaign.name)
    : []

  const totals = (() => {
    const spend = filteredCampaigns.reduce((sum, campaign) => sum + Number(campaign.latest_metrics?.spend || 0), 0)
    const impressions = filteredCampaigns.reduce((sum, campaign) => sum + Number(campaign.latest_metrics?.impressions || 0), 0)
    const clicks = filteredCampaigns.reduce((sum, campaign) => sum + Number(campaign.latest_metrics?.clicks || 0), 0)
    const reach = filteredCampaigns.reduce((sum, campaign) => sum + Number(campaign.latest_metrics?.reach || 0), 0)
    const conversions = filteredCampaigns.reduce((sum, campaign) => sum + metricResults(campaign), 0)
    return {
      spend,
      impressions,
      clicks,
      reach,
      conversions,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpa: conversions > 0 ? spend / conversions : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
    }
  })()

  const activeCampaigns = campaigns.filter(campaign => campaign.status === 'active').length
  const pausedCampaigns = campaigns.filter(campaign => campaign.status === 'paused').length
  const avgOptimization = searchedCampaigns.length
    ? Math.round(searchedCampaigns.reduce((sum, campaign) => sum + optimizationScore(campaign), 0) / searchedCampaigns.length)
    : 0

  const tabs: Array<{ key: GoogleAdsTab; label: string; count: number }> = [
    { key: 'overview', label: 'Visao geral', count: campaigns.length },
    { key: 'campaigns', label: 'Campanhas', count: searchedCampaigns.length },
    { key: 'recommendations', label: 'Recomendacoes', count: alerts.length },
    { key: 'conversions', label: 'Conversoes', count: internalStats.totalLeads },
  ]

  return (
    <div className="google-manager-page">
      {toast && (
        <div className={`google-manager-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}

      <header className="google-manager-topbar">
        <div className="google-manager-brand">
          <span className="google-manager-logo"><span /> <i /> <b /></span>
          <div>
            <h1>Google Ads</h1>
            <p>{campaigns.length} campanha(s) sincronizadas | {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>

        <div className="google-manager-actions">
          <select value={datePreset} onChange={event => onDatePresetChange(event.target.value)} aria-label="Periodo">
            <option value="today">Hoje</option>
            <option value="yesterday">Ontem</option>
            <option value="last_7d">Ultimos 7 dias</option>
            <option value="last_30d">Ultimos 30 dias</option>
            <option value="this_month">Este mes</option>
            <option value="last_month">Mes passado</option>
            <option value="maximum">Todo periodo</option>
            <option value="custom">Personalizado</option>
          </select>
          {datePreset === 'custom' && (
            <div className="google-manager-date-range">
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
            IA
          </button>
          <Link href="/admin/ads/new" className="primary">
            <Plus size={16} />
            Nova campanha
          </Link>
        </div>
      </header>

      <section className="google-manager-shell">
        <aside className="google-manager-nav">
          <Link href="/admin/ads/new" className="google-manager-create">
            <Plus size={22} />
            Criar
          </Link>
          {tabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? 'active' : ''}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.key === 'overview' ? <Gauge size={17} /> : tab.key === 'campaigns' ? <Megaphone size={17} /> : tab.key === 'recommendations' ? <Sparkles size={17} /> : <Target size={17} />}
              <span>{tab.label}</span>
              <b>{tab.count}</b>
            </button>
          ))}
          <Link href="/admin/ads/relatorio"><FileText size={17} /><span>Relatorios</span></Link>
          <Link href="/admin/ads/vitor"><Brain size={17} /><span>Vitor IA</span></Link>
          <button type="button" onClick={() => onShowHistoryChange(true)}><History size={17} /><span>Historico IA</span><b>{reports.length}</b></button>
          <div className="google-manager-nav-status">
            <span>Conta</span>
            <strong>{googleAccountHealth?.customer_status_label || 'Google Ads'}</strong>
            {googleAccountHealth?.billing_status_label && <small>{googleAccountHealth.billing_status_label}</small>}
          </div>
        </aside>

        <main className="google-manager-main">
          {googleAccountHealth && googleAccountHealth.severity !== 'ok' && (
            <div className={`google-manager-warning severity-${googleAccountHealth.severity}`}>
              <AlertTriangle size={18} />
              <div>
                <strong>{googleAccountHealth.is_payment_issue ? 'Conta com pendencia de pagamento' : 'Conta precisa de atencao'}</strong>
                <span>
                  {googleAccountHealth.message} Status: {googleAccountHealth.customer_status_label}
                  {googleAccountHealth.billing_status_label ? ` | Faturamento: ${googleAccountHealth.billing_status_label}` : ''}.
                </span>
              </div>
            </div>
          )}

          <div className="google-manager-headerline">
            <div>
              <strong>{activeTab === 'campaigns' ? 'Campanhas' : activeTab === 'recommendations' ? 'Recomendacoes' : activeTab === 'conversions' ? 'Conversoes' : 'Visao geral'}</strong>
              <span>Conta {googleAccountHealth?.account_id || 'Google Ads'} | {datePreset === 'maximum' ? 'todo periodo' : datePreset}</span>
            </div>
            <button type="button" onClick={onAnalyze} disabled={analyzing || campaigns.length === 0}>
              <Sparkles size={15} />
              Gerar recomendacoes
            </button>
          </div>

          <div className="google-manager-kpis">
            <div><span>Custo</span><strong>{formatCurrency(totals.spend)}</strong></div>
            <div><span>Conversoes</span><strong>{formatNumber(totals.conversions)}</strong></div>
            <div><span>Custo/conv.</span><strong>{totals.cpa > 0 ? formatCurrency(totals.cpa) : '-'}</strong></div>
            <div><span>Cliques</span><strong>{formatNumber(totals.clicks)}</strong></div>
            <div><span>Impressoes</span><strong>{formatNumber(totals.impressions)}</strong></div>
            <div><span>CTR</span><strong>{formatPercent(totals.ctr)}</strong></div>
            <div><span>Leads CRM</span><strong>{formatNumber(internalStats.totalLeads)}</strong></div>
            <div><span>Score otimizacao</span><strong>{latestScore ?? avgOptimization}%</strong></div>
          </div>

          <div className="google-manager-toolbar">
            <div className="google-manager-search">
              <Search size={16} />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Pesquisar campanhas" />
            </div>
            <div className="google-manager-segments">
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
            <button type="button"><Settings2 size={15} /> Colunas</button>
            <button type="button"><LineChart size={15} /> Segmento</button>
            <span>{activeCampaigns} ativas | {pausedCampaigns} pausadas</span>
          </div>

          {activeTab === 'recommendations' ? (
            <RecommendationsView alerts={alerts} expandedAlert={expandedAlert} onExpandedAlertChange={setExpandedAlert} />
          ) : activeTab === 'conversions' ? (
            <ConversionsView internalStats={internalStats} />
          ) : (
            <div className="google-manager-workspace">
              <div className="google-manager-table-wrap">
                {searchedCampaigns.length === 0 ? (
                  <div className="google-manager-empty">
                    <Megaphone size={34} />
                    <strong>Nenhuma campanha encontrada</strong>
                    <span>Sincronize o Google Ads ou ajuste os filtros.</span>
                  </div>
                ) : (
                  <table className="google-manager-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Status</th>
                        <th>Campanha</th>
                        <th>Tipo</th>
                        <th>Orcamento</th>
                        <th>Custo</th>
                        <th>Conversoes</th>
                        <th>Custo/conv.</th>
                        <th>Cliques</th>
                        <th>Impressoes</th>
                        <th>CTR</th>
                        <th>CPC medio</th>
                        <th>Otimizacao</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchedCampaigns.map(campaign => {
                        const selected = selectedCampaign?.id === campaign.id
                        const metrics = campaign.latest_metrics
                        const score = optimizationScore(campaign)
                        return (
                          <tr
                            key={campaign.id}
                            className={selected ? 'selected' : ''}
                            onClick={() => setSelectedCampaignId(campaign.id)}
                          >
                            <td><input type="checkbox" readOnly checked={selected} /></td>
                            <td><StatusBadge campaign={campaign} /></td>
                            <td className="google-manager-name-cell">
                              <Link href={`/admin/ads/${campaign.id}`} onClick={event => event.stopPropagation()}>{campaign.name}</Link>
                              <small>{campaign.properties?.title || 'Pesquisa / Performance Max'}</small>
                            </td>
                            <td>{campaign.platform === 'google' ? 'Google Ads' : campaign.platform}</td>
                            <td>{campaign.daily_budget ? formatCurrency(campaign.daily_budget) : formatCurrency(campaign.total_budget || 0)}</td>
                            <td>{formatCurrency(metrics?.spend)}</td>
                            <td>{formatNumber(metricResults(campaign))}</td>
                            <td>{metrics?.cost_per_lead ? formatCurrency(metrics.cost_per_lead) : '-'}</td>
                            <td>{formatNumber(metrics?.clicks)}</td>
                            <td>{formatNumber(metrics?.impressions)}</td>
                            <td>{formatPercentDecimal(metrics?.ctr)}</td>
                            <td>{metrics?.cpc ? formatCurrency(metrics.cpc) : '-'}</td>
                            <td><OptimizationScore value={score} /></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <aside className="google-manager-inspector">
                {selectedCampaign ? (
                  <>
                    <section className="google-manager-inspector-head">
                      <span className="google-manager-campaign-dot">G</span>
                      <div>
                        <strong>{selectedCampaign.name}</strong>
                        <small>{selectedCampaign.properties?.title || 'Campanha Google Ads'}</small>
                      </div>
                    </section>
                    <section>
                      <h3>Status</h3>
                      <StatusBadge campaign={selectedCampaign} />
                      <p>{selectedCampaign.ai_auto_manage ? 'Gerenciamento automatico por IA ativo.' : 'Gerenciamento manual.'}</p>
                    </section>
                    <section>
                      <h3>Resumo da campanha</h3>
                      <div className="google-manager-detail-grid">
                        <div><span>Custo</span><strong>{formatCurrency(selectedMetrics?.spend)}</strong></div>
                        <div><span>Conversoes</span><strong>{formatNumber(metricResults(selectedCampaign))}</strong></div>
                        <div><span>CPA</span><strong>{selectedMetrics?.cost_per_lead ? formatCurrency(selectedMetrics.cost_per_lead) : '-'}</strong></div>
                        <div><span>CTR</span><strong>{formatPercentDecimal(selectedMetrics?.ctr)}</strong></div>
                        <div><span>Cliques</span><strong>{formatNumber(selectedMetrics?.clicks)}</strong></div>
                        <div><span>Alcance</span><strong>{formatNumber(selectedMetrics?.reach)}</strong></div>
                      </div>
                    </section>
                    <section>
                      <h3>Recomendacoes</h3>
                      {selectedAlerts.length === 0 ? (
                        <p>Nenhuma recomendacao especifica para esta campanha.</p>
                      ) : selectedAlerts.slice(0, 4).map(alert => (
                        <article key={alert.id} className="google-manager-alert" style={{ '--recommendation-color': URGENCY_COLOR[alert.urgency] || '#5f6368' } as CSSProperties}>
                          <strong>{alert.type}</strong>
                          <span>{alert.message}</span>
                        </article>
                      ))}
                    </section>
                    <section>
                      <h3>Acoes</h3>
                      <div className="google-manager-detail-actions">
                        <Link href={`/admin/ads/${selectedCampaign.id}`}>Abrir campanha <ArrowRight size={14} /></Link>
                        <button type="button" onClick={onAnalyze} disabled={analyzing}><Sparkles size={14} /> IA</button>
                      </div>
                    </section>
                  </>
                ) : (
                  <div className="google-manager-empty small">
                    <Megaphone size={30} />
                    <strong>Selecione uma campanha</strong>
                  </div>
                )}
              </aside>
            </div>
          )}
        </main>
      </section>

      {showHistory && (
        <div className="google-manager-modal">
          <div className="google-manager-modal-card">
            <header>
              <strong><History size={20} /> Historico de Analises IA - Google Ads</strong>
              <button type="button" onClick={() => onShowHistoryChange(false)}><X size={20} /></button>
            </header>
            <div>
              {reports.length === 0 ? (
                <div className="google-manager-empty">
                  <Brain size={34} />
                  <strong>Nenhum relatorio gerado ainda</strong>
                  <span>Os relatorios aparecem aqui quando o agente gerar analises.</span>
                </div>
              ) : reports.map(report => {
                const expanded = expandedReport === report.id
                return (
                  <article key={report.id} className="google-manager-report" onClick={() => onExpandedReportChange(expanded ? null : report.id)}>
                    <div>
                      <strong>{report.type === 'daily' ? 'Fechamento Diario' : 'Diretriz Semanal'}</strong>
                      {report.performance_score != null && <span>{report.performance_score}/100</span>}
                      <small>{formatDateTime(report.created_at)}</small>
                      {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                    {expanded && <div dangerouslySetInnerHTML={{ __html: renderMarkdown(report.content_markdown || '') }} />}
                  </article>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .google-manager-page { min-height: 100vh; color: #202124; }
        .google-manager-topbar { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 0; border-bottom: 1px solid #dadce0; background: color-mix(in srgb, var(--bg-primary) 94%, transparent); backdrop-filter: blur(12px); }
        .google-manager-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .google-manager-brand h1 { margin: 0; font-family: Inter, sans-serif; font-size: 1.35rem; font-weight: 850; letter-spacing: 0; }
        .google-manager-brand p { margin: 3px 0 0; color: #5f6368; font-size: .74rem; font-weight: 750; }
        .google-manager-logo { width: 38px; height: 38px; display: grid; place-items: center; position: relative; flex: 0 0 auto; }
        .google-manager-logo span, .google-manager-logo i, .google-manager-logo b { position: absolute; display: block; border-radius: 999px; }
        .google-manager-logo span { width: 11px; height: 31px; background: #1a73e8; transform: rotate(30deg); left: 10px; top: 4px; }
        .google-manager-logo i { width: 11px; height: 31px; background: #34a853; transform: rotate(-30deg); right: 10px; top: 4px; }
        .google-manager-logo b { width: 13px; height: 13px; background: #fbbc04; left: 6px; bottom: 5px; }
        .google-manager-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
        .google-manager-actions button, .google-manager-actions a, .google-manager-actions select, .google-manager-date-range input { height: 36px; border: 1px solid #dadce0; border-radius: 18px; background: #fff; color: #202124; padding: 0 12px; font-size: .75rem; font-weight: 850; text-decoration: none; display: inline-flex; align-items: center; gap: 7px; cursor: pointer; }
        .google-manager-actions .primary, .google-manager-create { border-color: #1a73e8; background: #1a73e8; color: #fff; }
        .google-manager-actions button:disabled { opacity: .58; cursor: not-allowed; }
        .google-manager-date-range { display: inline-flex; align-items: center; gap: 6px; }
        .google-manager-date-range input { width: 130px; border-radius: 7px; }
        .google-manager-shell { margin-top: 14px; height: calc(100vh - 142px); min-height: 710px; display: grid; grid-template-columns: 248px minmax(0, 1fr); border: 1px solid #dadce0; border-radius: 8px; background: #fff; overflow: hidden; box-shadow: 0 12px 28px rgba(60,64,67,.08); }
        .google-manager-nav { border-right: 1px solid #dadce0; background: #f8fafd; padding: 12px 10px; display: grid; align-content: start; gap: 4px; overflow-y: auto; scrollbar-width: thin; }
        .google-manager-create { min-height: 44px; border-radius: 22px; padding: 0 18px; margin: 2px 6px 12px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-size: .82rem; font-weight: 900; box-shadow: 0 2px 8px rgba(26,115,232,.24); }
        .google-manager-nav button, .google-manager-nav a { min-height: 40px; border: 0; border-radius: 0 20px 20px 0; background: transparent; color: #3c4043; display: grid; grid-template-columns: 22px minmax(0,1fr) auto; align-items: center; gap: 10px; padding: 0 12px; text-align: left; text-decoration: none; font-size: .78rem; font-weight: 800; cursor: pointer; }
        .google-manager-nav button.active { background: #e8f0fe; color: #1967d2; }
        .google-manager-nav button b { min-width: 22px; height: 22px; border-radius: 999px; display: inline-grid; place-items: center; background: rgba(60,64,67,.09); padding: 0 6px; font-size: .64rem; }
        .google-manager-nav-status { margin: 14px 6px 0; border-top: 1px solid #dadce0; padding: 12px 6px; display: grid; gap: 3px; }
        .google-manager-nav-status span { color: #5f6368; font-size: .65rem; font-weight: 950; text-transform: uppercase; }
        .google-manager-nav-status strong { color: #202124; font-size: .76rem; }
        .google-manager-nav-status small { color: #5f6368; font-size: .68rem; }
        .google-manager-main { min-width: 0; display: grid; grid-template-rows: auto auto auto auto minmax(0, 1fr); background: #f1f3f4; }
        .google-manager-warning { display: flex; align-items: flex-start; gap: 10px; margin: 12px 12px 0; border-radius: 8px; padding: 12px 14px; font-size: .8rem; }
        .google-manager-warning strong { display: block; margin-bottom: 3px; }
        .google-manager-warning span { color: #5f6368; line-height: 1.4; }
        .google-manager-warning.severity-error { border: 1px solid rgba(234,67,53,.28); background: rgba(234,67,53,.08); }
        .google-manager-warning.severity-warning { border: 1px solid rgba(251,188,4,.32); background: rgba(251,188,4,.12); }
        .google-manager-headerline { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 16px; border-bottom: 1px solid #dadce0; background: #fff; }
        .google-manager-headerline strong { display: block; color: #202124; font-size: 1rem; font-weight: 850; }
        .google-manager-headerline span { display: block; margin-top: 3px; color: #5f6368; font-size: .72rem; font-weight: 750; }
        .google-manager-headerline button, .google-manager-toolbar button { height: 34px; border: 1px solid #dadce0; border-radius: 17px; background: #fff; color: #1a73e8; padding: 0 11px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; font-size: .72rem; font-weight: 900; cursor: pointer; }
        .google-manager-headerline button:disabled { opacity: .58; cursor: not-allowed; }
        .google-manager-kpis { display: grid; grid-template-columns: repeat(8, minmax(112px, 1fr)); overflow-x: auto; border-bottom: 1px solid #dadce0; background: #fff; }
        .google-manager-kpis div { min-width: 112px; padding: 11px 13px; border-right: 1px solid #eceff1; }
        .google-manager-kpis span { display: block; color: #5f6368; font-size: .63rem; font-weight: 950; text-transform: uppercase; margin-bottom: 4px; }
        .google-manager-kpis strong { display: block; color: #202124; font-size: .93rem; white-space: nowrap; }
        .google-manager-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 12px; border-bottom: 1px solid #dadce0; background: #fff; }
        .google-manager-toolbar > span { margin-left: auto; color: #5f6368; font-size: .72rem; font-weight: 800; }
        .google-manager-search { height: 38px; min-width: 280px; display: flex; align-items: center; gap: 8px; border: 1px solid #dadce0; border-radius: 4px; background: #fff; padding: 0 10px; color: #5f6368; }
        .google-manager-search input { border: 0; outline: none; width: 100%; color: #202124; background: transparent; font-size: .8rem; }
        .google-manager-segments { display: inline-flex; align-items: center; gap: 4px; }
        .google-manager-segments button { height: 34px; border: 1px solid #dadce0; border-radius: 17px; background: #fff; color: #3c4043; padding: 0 12px; font-size: .72rem; font-weight: 900; cursor: pointer; }
        .google-manager-segments button.active { border-color: #1a73e8; background: #e8f0fe; color: #1967d2; }
        .google-manager-workspace { min-height: 0; display: grid; grid-template-columns: minmax(620px, 1fr) 360px; background: #f1f3f4; }
        .google-manager-table-wrap { min-width: 0; overflow: auto; background: #fff; scrollbar-width: thin; }
        .google-manager-table { width: 100%; min-width: 1220px; border-collapse: collapse; font-size: .74rem; }
        .google-manager-table th { position: sticky; top: 0; z-index: 2; background: #fff; color: #5f6368; border-bottom: 1px solid #dadce0; padding: 10px 9px; text-align: left; font-size: .64rem; font-weight: 950; text-transform: uppercase; white-space: nowrap; }
        .google-manager-table td { border-bottom: 1px solid #eceff1; padding: 10px 9px; color: #202124; white-space: nowrap; vertical-align: middle; }
        .google-manager-table tr { cursor: pointer; }
        .google-manager-table tr:hover, .google-manager-table tr.selected { background: #f8fafd; }
        .google-manager-table input { width: 15px; height: 15px; accent-color: #1a73e8; }
        .google-manager-status { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; color: var(--google-status); background: color-mix(in srgb, var(--google-status) 11%, white); padding: 5px 8px; font-size: .68rem; font-weight: 900; }
        .google-manager-status::before { content: ''; width: 7px; height: 7px; border-radius: 999px; background: var(--google-status); }
        .google-manager-name-cell { min-width: 280px; max-width: 390px; }
        .google-manager-name-cell a { display: block; max-width: 350px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #1a73e8; text-decoration: none; font-weight: 900; }
        .google-manager-name-cell small { display: block; margin-top: 3px; color: #5f6368; font-size: .66rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .google-manager-optimization { display: inline-flex; align-items: center; gap: 7px; color: #202124; }
        .google-manager-optimization i { width: 54px; height: 7px; border-radius: 999px; background: #eceff1; overflow: hidden; }
        .google-manager-optimization b { display: block; height: 100%; border-radius: 999px; background: var(--optimization-color); }
        .google-manager-inspector { min-width: 0; overflow-y: auto; border-left: 1px solid #dadce0; background: #fff; padding: 14px; display: grid; align-content: start; gap: 14px; scrollbar-width: thin; }
        .google-manager-inspector section { display: grid; gap: 9px; padding-bottom: 13px; border-bottom: 1px solid #eceff1; }
        .google-manager-inspector h3 { margin: 0; color: #202124; font-family: Inter, sans-serif; font-size: .78rem; font-weight: 950; letter-spacing: 0; }
        .google-manager-inspector p { margin: 0; color: #5f6368; font-size: .72rem; line-height: 1.42; }
        .google-manager-inspector-head { display: flex !important; align-items: center; gap: 10px; }
        .google-manager-campaign-dot { width: 42px; height: 42px; border-radius: 999px; display: grid; place-items: center; background: #e8f0fe; color: #1a73e8; font-weight: 950; flex: 0 0 auto; }
        .google-manager-inspector-head div { min-width: 0; display: grid; gap: 2px; }
        .google-manager-inspector-head strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .88rem; }
        .google-manager-inspector-head small { color: #5f6368; font-size: .7rem; }
        .google-manager-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .google-manager-detail-grid div { border: 1px solid #eceff1; border-radius: 6px; background: #f8fafd; padding: 9px; min-width: 0; }
        .google-manager-detail-grid span { display: block; margin-bottom: 4px; color: #5f6368; font-size: .62rem; font-weight: 950; text-transform: uppercase; }
        .google-manager-detail-grid strong { color: #202124; font-size: .84rem; }
        .google-manager-alert { display: grid; gap: 4px; border-left: 3px solid var(--recommendation-color); border-radius: 6px; background: #f8fafd; padding: 9px 10px; }
        .google-manager-alert strong { color: var(--recommendation-color); font-size: .64rem; font-weight: 950; text-transform: uppercase; }
        .google-manager-alert span { color: #3c4043; font-size: .72rem; line-height: 1.4; }
        .google-manager-detail-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .google-manager-detail-actions a, .google-manager-detail-actions button { height: 34px; border: 1px solid #dadce0; border-radius: 17px; background: #fff; color: #1a73e8; padding: 0 11px; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; font-size: .72rem; font-weight: 900; cursor: pointer; }
        .google-manager-empty { min-height: 260px; display: grid; place-items: center; align-content: center; gap: 8px; color: #5f6368; text-align: center; padding: 24px; }
        .google-manager-empty.small { min-height: 320px; }
        .google-manager-empty strong { color: #202124; font-size: .9rem; }
        .google-manager-empty span { max-width: 360px; font-size: .76rem; line-height: 1.4; }
        .google-manager-cards-view { min-height: 0; overflow: auto; padding: 14px; display: grid; align-content: start; gap: 12px; scrollbar-width: thin; }
        .google-manager-card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
        .google-manager-rec-card, .google-manager-conversion-card { border: 1px solid #dadce0; border-radius: 8px; background: #fff; padding: 14px; display: grid; gap: 9px; }
        .google-manager-rec-card { border-left: 4px solid var(--rec-color); }
        .google-manager-rec-card header, .google-manager-conversion-card header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .google-manager-rec-card header strong, .google-manager-conversion-card header strong { color: #202124; font-size: .84rem; }
        .google-manager-rec-card header span { color: var(--rec-color); font-size: .66rem; font-weight: 950; text-transform: uppercase; }
        .google-manager-rec-card p, .google-manager-conversion-card p { margin: 0; color: #3c4043; font-size: .76rem; line-height: 1.45; }
        .google-manager-rec-card small { color: #5f6368; font-size: .7rem; line-height: 1.4; }
        .google-manager-rec-card button { justify-self: start; min-height: 30px; border: 1px solid #dadce0; border-radius: 15px; background: #fff; color: #1a73e8; padding: 0 10px; font-size: .7rem; font-weight: 900; cursor: pointer; }
        .google-manager-conversion-list { display: grid; gap: 8px; }
        .google-manager-conversion-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 12px; border: 1px solid #eceff1; border-radius: 7px; background: #f8fafd; padding: 10px; }
        .google-manager-conversion-row strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #202124; font-size: .78rem; }
        .google-manager-conversion-row span { color: #5f6368; font-size: .68rem; font-weight: 800; }
        .google-manager-conversion-row small { grid-column: 1 / -1; color: #5f6368; font-size: .68rem; }
        .google-manager-modal { position: fixed; inset: 0; z-index: 99999; display: grid; place-items: center; padding: 24px; background: rgba(32,33,36,.56); backdrop-filter: blur(4px); }
        .google-manager-modal-card { width: min(860px, 100%); max-height: 88vh; display: grid; grid-template-rows: auto minmax(0, 1fr); border-radius: 10px; background: #fff; overflow: hidden; box-shadow: 0 24px 64px rgba(32,33,36,.28); }
        .google-manager-modal-card header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; border-bottom: 1px solid #dadce0; }
        .google-manager-modal-card header strong { display: inline-flex; align-items: center; gap: 8px; }
        .google-manager-modal-card header button { border: 0; background: transparent; color: #5f6368; cursor: pointer; }
        .google-manager-modal-card > div { overflow-y: auto; padding: 16px; display: grid; gap: 10px; }
        .google-manager-report { border: 1px solid #dadce0; border-radius: 8px; padding: 12px; cursor: pointer; }
        .google-manager-report > div:first-child { display: flex; align-items: center; gap: 10px; }
        .google-manager-report strong { color: #202124; }
        .google-manager-report span { border-radius: 999px; background: #e8f0fe; color: #1967d2; padding: 4px 8px; font-size: .68rem; font-weight: 900; }
        .google-manager-report small { margin-left: auto; color: #5f6368; font-size: .68rem; }
        .google-manager-toast { position: fixed; top: 24px; right: 24px; z-index: 10000; display: flex; align-items: center; gap: 10px; border-radius: 12px; background: #fff; padding: 14px 20px; box-shadow: 0 8px 30px rgba(0,0,0,.18); font-size: .9rem; font-weight: 700; animation: googleToastIn .35s ease-out; }
        .google-manager-toast.success { border: 1px solid rgba(52,168,83,.28); color: #188038; }
        .google-manager-toast.error { border: 1px solid rgba(234,67,53,.28); color: #d93025; }
        @keyframes googleToastIn { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 1180px) {
          .google-manager-shell { grid-template-columns: 78px minmax(0,1fr); height: auto; }
          .google-manager-nav { padding-inline: 8px; }
          .google-manager-nav button, .google-manager-nav a { grid-template-columns: 1fr; justify-items: center; border-radius: 22px; padding: 0 8px; }
          .google-manager-nav span, .google-manager-nav b, .google-manager-nav-status, .google-manager-create { display: none; }
          .google-manager-workspace { grid-template-columns: 1fr; }
          .google-manager-inspector { border-left: 0; border-top: 1px solid #dadce0; }
        }
        @media (max-width: 760px) {
          .google-manager-topbar { position: static; align-items: flex-start; flex-direction: column; }
          .google-manager-actions { justify-content: stretch; width: 100%; }
          .google-manager-actions button, .google-manager-actions a, .google-manager-actions select { flex: 1 1 145px; justify-content: center; }
          .google-manager-search { flex: 1 1 100%; min-width: 0; }
          .google-manager-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .google-manager-toolbar > span { margin-left: 0; width: 100%; }
          .google-manager-table { min-width: 980px; }
        }
      `}</style>
    </div>
  )
}

function OptimizationScore({ value }: { value: number }) {
  const color = value >= 80 ? '#34a853' : value >= 55 ? '#fbbc04' : '#ea4335'
  return (
    <span className="google-manager-optimization">
      <i><b style={{ width: `${value}%`, '--optimization-color': color } as CSSProperties} /></i>
      {value}%
    </span>
  )
}

function RecommendationsView({
  alerts,
  expandedAlert,
  onExpandedAlertChange,
}: {
  alerts: AlertRow[]
  expandedAlert: string | null
  onExpandedAlertChange: (value: string | null) => void
}) {
  return (
    <div className="google-manager-cards-view">
      {alerts.length === 0 ? (
        <div className="google-manager-empty">
          <Sparkles size={34} />
          <strong>Nenhuma recomendacao gerada</strong>
          <span>Use a analise com IA para criar recomendacoes de otimizacao.</span>
        </div>
      ) : (
        <div className="google-manager-card-grid">
          {alerts.map(alert => {
            const expanded = expandedAlert === alert.id
            return (
              <article key={alert.id} className="google-manager-rec-card" style={{ '--rec-color': URGENCY_COLOR[alert.urgency] || '#5f6368' } as CSSProperties}>
                <header>
                  <strong>{shortText(alert.campaign_name || alert.type, 36)}</strong>
                  <span>{alert.urgency}</span>
                </header>
                <p>{alert.message}</p>
                {expanded && alert.ai_reasoning && <small>{alert.ai_reasoning}</small>}
                {alert.ai_reasoning && (
                  <button type="button" onClick={() => onExpandedAlertChange(expanded ? null : alert.id)}>
                    {expanded ? 'Ocultar raciocinio' : 'Ver raciocinio'}
                  </button>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ConversionsView({ internalStats }: { internalStats: InternalStats }) {
  return (
    <div className="google-manager-cards-view">
      <div className="google-manager-card-grid">
        <article className="google-manager-conversion-card">
          <header>
            <strong>Conversoes CRM</strong>
            <Users size={18} color="#1a73e8" />
          </header>
          <p>{formatNumber(internalStats.totalLeads)} lead(s) detectados como Google Ads no periodo selecionado.</p>
        </article>
        <article className="google-manager-conversion-card">
          <header>
            <strong>Acoes de conversao</strong>
            <Target size={18} color="#34a853" />
          </header>
          <p>Comparacao entre conversoes reportadas pela plataforma e leads reais capturados no CRM.</p>
        </article>
        <article className="google-manager-conversion-card">
          <header>
            <strong>Faturamento</strong>
            <CreditCard size={18} color="#fbbc04" />
          </header>
          <p>Use os alertas da conta para identificar travas de pagamento ou entrega.</p>
        </article>
      </div>

      <section className="google-manager-conversion-card">
        <header>
          <strong>Leads recentes</strong>
          <Clock3 size={18} color="#5f6368" />
        </header>
        {internalStats.recentLeads.length === 0 ? (
          <p>Nenhum lead recente de Google Ads encontrado.</p>
        ) : (
          <div className="google-manager-conversion-list">
            {internalStats.recentLeads.map((lead, index) => (
              <div key={`${lead.created_at || 'lead'}-${index}`} className="google-manager-conversion-row">
                <strong>{lead.name || 'Lead sem nome'}</strong>
                <span>{formatDateTime(lead.created_at)}</span>
                <small>{lead.funnel_stage || 'Sem etapa'}{lead.phone ? ` | ${lead.phone}` : ''}</small>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
