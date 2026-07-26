'use client'

import Link from 'next/link'
import { useState, type CSSProperties } from 'react'
import {
  Activity,
  AlertCircle,
  ArrowDownUp,
  BarChart3,
  CheckCircle,
  Clock3,
  ExternalLink,
  FileText,
  Gauge,
  Home,
  LineChart,
  MousePointerClick,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'

type ChannelRow = {
  channel: string
  sessions: number
  users: number
  views: number
  conversions: number
}

type LandingPageRow = {
  page: string
  sessions: number
  users: number
  views: number
  conversions: number
}

type SearchRow = {
  label: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

type AnalyticsPayload = {
  success: boolean
  configured: boolean
  message?: string
  error?: string
  measurementId?: string
  propertyId?: string
  period?: { startDate: string; endDate: string; days: number }
  summary?: {
    totalSessions: number
    organicSessions: number
    organicUsers: number
    organicViews: number
    organicConversions: number
    organicShare: number
  } | null
  channels: ChannelRow[]
  landingPages: LandingPageRow[]
  sourceMedium: Array<{ sourceMedium: string; sessions: number; users: number; conversions: number }>
  searchConsole: {
    configured: boolean
    queries: SearchRow[]
    pages: SearchRow[]
    totals: { clicks: number; impressions: number } | null
    error: string | null
  }
}

type AnalyticsTab = 'overview' | 'acquisition' | 'pages' | 'search'

type Props = {
  payload: AnalyticsPayload | null
  days: number
  loading: boolean
  error: string
  topChannel?: ChannelRow
  onDaysChange: (value: number) => void
  onRefresh: () => void
}

const numberFormatter = new Intl.NumberFormat('pt-BR')
const percentFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function formatNumber(value: number | null | undefined) {
  return numberFormatter.format(Number(value || 0))
}

function formatPercent(value: number | null | undefined) {
  return `${percentFormatter.format(Number(value || 0))}%`
}

function shortText(value: string | null | undefined, max = 54) {
  const text = String(value || '').trim()
  if (!text) return '-'
  return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

function channelColor(index: number) {
  return ['#f9ab00', '#e8710a', '#1a73e8', '#34a853', '#9334e6', '#ea4335', '#00acc1'][index % 7]
}

export default function GoogleAnalyticsManagerView({
  payload,
  days,
  loading,
  error,
  topChannel,
  onDaysChange,
  onRefresh,
}: Props) {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview')
  const [query, setQuery] = useState('')

  const channels = payload?.channels || []
  const landingPages = payload?.landingPages || []
  const sourceMedium = payload?.sourceMedium || []
  const queries = payload?.searchConsole?.queries || []
  const searchPages = payload?.searchConsole?.pages || []
  const summary = payload?.summary || null
  const maxChannelSessions = Math.max(1, ...channels.map(row => row.sessions || 0))
  const maxPageSessions = Math.max(1, ...landingPages.map(row => row.sessions || 0))
  const maxQueryClicks = Math.max(1, ...queries.map(row => row.clicks || 0))

  const filteredLandingPages = (() => {
    const term = query.trim().toLowerCase()
    if (!term) return landingPages
    return landingPages.filter(row => row.page.toLowerCase().includes(term))
  })()

  const filteredQueries = (() => {
    const term = query.trim().toLowerCase()
    if (!term) return queries
    return queries.filter(row => row.label.toLowerCase().includes(term))
  })()

  const engagementSignal = summary?.totalSessions
    ? Math.min(100, Math.round(((summary.organicViews || 0) / Math.max(1, summary.organicSessions || 1)) * 35))
    : 0

  const organicConversionRate = summary?.organicSessions
    ? ((summary.organicConversions || 0) / Math.max(1, summary.organicSessions)) * 100
    : 0

  const navItems: Array<{ key: AnalyticsTab; label: string; icon: React.ReactNode; count: number }> = [
    { key: 'overview', label: 'Inicio', icon: <Home size={17} />, count: channels.length },
    { key: 'acquisition', label: 'Aquisicao', icon: <ArrowDownUp size={17} />, count: sourceMedium.length },
    { key: 'pages', label: 'Engajamento', icon: <FileText size={17} />, count: landingPages.length },
    { key: 'search', label: 'Search Console', icon: <Search size={17} />, count: queries.length },
  ]

  if (payload && !payload.configured) {
    return (
      <div className="ga-manager-page">
        <Header days={days} loading={loading} onDaysChange={onDaysChange} onRefresh={onRefresh} />
        <div className="ga-setup-shell">
          <span className="ga-logo"><i /><b /><em /></span>
          <h2>Google Analytics ainda nao configurado</h2>
          <p>{payload.message || 'Configure o GA4 e a service account na Sala de Manutencao.'}</p>
          <Link href="/admin/maintenance">Abrir Sala de Manutencao</Link>
        </div>
        <Styles />
      </div>
    )
  }

  return (
    <div className="ga-manager-page">
      <Header days={days} loading={loading} onDaysChange={onDaysChange} onRefresh={onRefresh} />

      <section className="ga-manager-shell">
        <aside className="ga-manager-nav">
          <div className="ga-manager-nav-brand">
            <span className="ga-logo small"><i /><b /><em /></span>
            <strong>Relatorios</strong>
          </div>
          {navItems.map(item => (
            <button
              key={item.key}
              type="button"
              className={activeTab === item.key ? 'active' : ''}
              onClick={() => setActiveTab(item.key)}
            >
              {item.icon}
              <span>{item.label}</span>
              <b>{item.count}</b>
            </button>
          ))}
          <Link href="/admin/ads/google"><Target size={17} /><span>Google Ads</span></Link>
          <Link href="/admin/maintenance"><Settings size={17} /><span>Admin</span></Link>
        </aside>

        <main className="ga-manager-main">
          {error && (
            <div className="ga-warning">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="ga-report-head">
            <div>
              <strong>
                {activeTab === 'overview'
                  ? 'Visao geral de relatorios'
                  : activeTab === 'acquisition'
                    ? 'Aquisicao de trafego'
                    : activeTab === 'pages'
                      ? 'Paginas e telas'
                      : 'Performance na Pesquisa Google'}
              </strong>
              <span>
                Propriedade {payload?.propertyId || '-'}
                {payload?.period ? ` | ${payload.period.startDate} ate ${payload.period.endDate}` : ''}
              </span>
            </div>
            <button type="button" onClick={onRefresh} disabled={loading}>
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
              Atualizar relatorio
            </button>
          </div>

          <div className="ga-summary-strip">
            <Metric label="Sessoes organicas" value={formatNumber(summary?.organicSessions)} detail={`${formatPercent(summary?.organicShare)} do trafego`} />
            <Metric label="Usuarios organicos" value={formatNumber(summary?.organicUsers)} detail="usuarios da busca" />
            <Metric label="Visualizacoes" value={formatNumber(summary?.organicViews)} detail="paginas organicas" />
            <Metric label="Conversoes" value={formatNumber(summary?.organicConversions)} detail={`${formatPercent(organicConversionRate)} taxa organica`} />
            <Metric label="Search clicks" value={formatNumber(payload?.searchConsole?.totals?.clicks)} detail={`${formatNumber(payload?.searchConsole?.totals?.impressions)} impressoes`} />
            <Metric label="Engajamento" value={`${engagementSignal}%`} detail="sinal estimado" />
          </div>

          <div className="ga-toolbar">
            <div className="ga-search">
              <Search size={16} />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={activeTab === 'search' ? 'Pesquisar query' : 'Pesquisar pagina'}
              />
            </div>
            <button type="button"><BarChart3 size={15} /> Comparar</button>
            <button type="button"><Gauge size={15} /> Insights</button>
            <span>{days} dias</span>
          </div>

          {activeTab === 'overview' && (
            <div className="ga-workspace">
              <section className="ga-panel">
                <header>
                  <div>
                    <strong>De onde vem seus usuarios?</strong>
                    <span>{topChannel ? `${topChannel.channel} lidera com ${formatNumber(topChannel.sessions)} sessoes` : 'Sem canal principal no periodo'}</span>
                  </div>
                  <Users size={18} />
                </header>
                <div className="ga-bar-list">
                  {channels.length === 0 ? <Empty message="Nenhum canal retornado pelo GA4." /> : channels.map((row, index) => (
                    <div key={row.channel} className="ga-bar-row">
                      <strong>{row.channel || 'Nao definido'}</strong>
                      <span>{formatNumber(row.sessions)} sessoes</span>
                      <i><b style={{ width: `${Math.max(4, (row.sessions / maxChannelSessions) * 100)}%`, background: channelColor(index) }} /></i>
                      <small>{formatNumber(row.users)} usuarios | {formatNumber(row.conversions)} conv.</small>
                    </div>
                  ))}
                </div>
              </section>

              <section className="ga-panel">
                <header>
                  <div>
                    <strong>Insights automaticos</strong>
                    <span>Sinais para trafego organico e conversao</span>
                  </div>
                  <Sparkles size={18} />
                </header>
                <div className="ga-insight-list">
                  <Insight title="Canal principal" value={topChannel?.channel || 'Sem dados'} detail={topChannel ? `${formatNumber(topChannel.sessions)} sessoes no periodo` : 'Aguardando dados do GA4'} />
                  <Insight title="Participacao organica" value={formatPercent(summary?.organicShare)} detail="peso do organico no trafego total" />
                  <Insight title="Conversao organica" value={formatPercent(organicConversionRate)} detail="conversoes / sessoes organicas" />
                  <Insight title="Search Console" value={payload?.searchConsole?.configured ? 'Conectado' : 'Pendente'} detail={payload?.searchConsole?.error || 'Consultas e paginas da pesquisa'} />
                </div>
              </section>

              <section className="ga-panel wide">
                <header>
                  <div>
                    <strong>Paginas organicas mais acessadas</strong>
                    <span>Entradas por busca no periodo</span>
                  </div>
                  <FileText size={18} />
                </header>
                <LandingPagesTable rows={landingPages.slice(0, 8)} maxSessions={maxPageSessions} />
              </section>
            </div>
          )}

          {activeTab === 'acquisition' && (
            <div className="ga-workspace">
              <section className="ga-panel wide">
                <header>
                  <div>
                    <strong>Canais de aquisicao</strong>
                    <span>Grupo de canal padrao do GA4</span>
                  </div>
                  <ArrowDownUp size={18} />
                </header>
                <AnalyticsTable
                  columns={['Canal', 'Sessoes', 'Usuarios', 'Views', 'Conversoes']}
                  rows={channels.map(row => [
                    row.channel || 'Nao definido',
                    formatNumber(row.sessions),
                    formatNumber(row.users),
                    formatNumber(row.views),
                    formatNumber(row.conversions),
                  ])}
                  empty="Nenhum canal retornado pelo GA4."
                />
              </section>

              <section className="ga-panel wide">
                <header>
                  <div>
                    <strong>Source / medium</strong>
                    <span>Origem detalhada do trafego</span>
                  </div>
                  <ExternalLink size={18} />
                </header>
                <AnalyticsTable
                  columns={['Source / medium', 'Sessoes', 'Usuarios', 'Conversoes']}
                  rows={sourceMedium.map(row => [
                    row.sourceMedium || 'Nao definido',
                    formatNumber(row.sessions),
                    formatNumber(row.users),
                    formatNumber(row.conversions),
                  ])}
                  empty="Nenhuma fonte organica retornada."
                />
              </section>
            </div>
          )}

          {activeTab === 'pages' && (
            <div className="ga-workspace">
              <section className="ga-panel wide">
                <header>
                  <div>
                    <strong>Paginas e telas</strong>
                    <span>Landing pages organicas filtraveis</span>
                  </div>
                  <FileText size={18} />
                </header>
                <LandingPagesTable rows={filteredLandingPages} maxSessions={maxPageSessions} />
              </section>
            </div>
          )}

          {activeTab === 'search' && (
            <div className="ga-workspace">
              <section className="ga-panel wide">
                <header>
                  <div>
                    <strong>Consultas de pesquisa</strong>
                    <span>{payload?.searchConsole?.configured ? 'Dados do Search Console' : 'Search Console pendente'}</span>
                  </div>
                  <Search size={18} />
                </header>
                {payload?.searchConsole?.error && <div className="ga-inline-error">{payload.searchConsole.error}</div>}
                {!payload?.searchConsole?.configured ? (
                  <Empty message="Informe o site do Search Console na Sala de Manutencao." />
                ) : (
                  <SearchConsoleTable rows={filteredQueries} maxClicks={maxQueryClicks} />
                )}
              </section>

              <section className="ga-panel wide">
                <header>
                  <div>
                    <strong>Paginas na Pesquisa Google</strong>
                    <span>URLs com cliques e impressoes</span>
                  </div>
                  <MousePointerClick size={18} />
                </header>
                <SearchConsoleTable rows={searchPages} maxClicks={Math.max(1, ...searchPages.map(row => row.clicks || 0))} />
              </section>
            </div>
          )}
        </main>
      </section>

      <Styles />
    </div>
  )
}

function Header({
  days,
  loading,
  onDaysChange,
  onRefresh,
}: {
  days: number
  loading: boolean
  onDaysChange: (value: number) => void
  onRefresh: () => void
}) {
  return (
    <header className="ga-manager-topbar">
      <div className="ga-manager-brand">
        <span className="ga-logo"><i /><b /><em /></span>
        <div>
          <h1>Google Analytics</h1>
          <p>GA4 e Search Console dentro do Trafego IA.</p>
        </div>
      </div>
      <div className="ga-manager-actions">
        <select value={days} onChange={event => onDaysChange(Number(event.target.value))} aria-label="Periodo">
          <option value={7}>Ultimos 7 dias</option>
          <option value={28}>Ultimos 28 dias</option>
          <option value={90}>Ultimos 90 dias</option>
        </select>
        <button type="button" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          Atualizar
        </button>
      </div>
    </header>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

function Insight({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <article>
      <Sparkles size={15} />
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  )
}

function Empty({ message }: { message: string }) {
  return (
    <div className="ga-empty">
      <Activity size={30} />
      <strong>{message}</strong>
    </div>
  )
}

function AnalyticsTable({ columns, rows, empty }: { columns: string[]; rows: string[][]; empty: string }) {
  if (rows.length === 0) return <Empty message={empty} />
  return (
    <div className="ga-table-wrap">
      <table className="ga-table">
        <thead>
          <tr>{columns.map(column => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${row[0]}-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${cell}-${cellIndex}`} className={cellIndex === 0 ? 'main' : ''}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LandingPagesTable({ rows, maxSessions }: { rows: LandingPageRow[]; maxSessions: number }) {
  if (rows.length === 0) return <Empty message="Nenhuma pagina organica no periodo." />
  return (
    <div className="ga-table-wrap">
      <table className="ga-table">
        <thead>
          <tr>
            <th>Pagina</th>
            <th>Sessoes</th>
            <th>Usuarios</th>
            <th>Views</th>
            <th>Conversoes</th>
            <th>Peso</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.page}>
              <td className="main">{shortText(row.page, 72)}</td>
              <td>{formatNumber(row.sessions)}</td>
              <td>{formatNumber(row.users)}</td>
              <td>{formatNumber(row.views)}</td>
              <td>{formatNumber(row.conversions)}</td>
              <td><BarValue value={row.sessions} max={maxSessions} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SearchConsoleTable({ rows, maxClicks }: { rows: SearchRow[]; maxClicks: number }) {
  if (rows.length === 0) return <Empty message="Nenhuma linha retornada no periodo." />
  return (
    <div className="ga-table-wrap">
      <table className="ga-table">
        <thead>
          <tr>
            <th>Consulta / pagina</th>
            <th>Cliques</th>
            <th>Impressoes</th>
            <th>CTR</th>
            <th>Posicao</th>
            <th>Peso</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.label}>
              <td className="main">{shortText(row.label, 72)}</td>
              <td>{formatNumber(row.clicks)}</td>
              <td>{formatNumber(row.impressions)}</td>
              <td>{formatPercent(row.ctr)}</td>
              <td>{Number(row.position || 0).toFixed(1)}</td>
              <td><BarValue value={row.clicks} max={maxClicks} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BarValue({ value, max }: { value: number; max: number }) {
  return (
    <span className="ga-table-bar">
      <i style={{ width: `${Math.max(4, Math.min(100, (value / Math.max(1, max)) * 100))}%` }} />
    </span>
  )
}

function Styles() {
  return (
    <style jsx global>{`
      .ga-manager-page { min-height: 100vh; color: #202124; }
      .ga-manager-topbar { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 0; border-bottom: 1px solid #dadce0; background: color-mix(in srgb, var(--bg-primary) 94%, transparent); backdrop-filter: blur(12px); }
      .ga-manager-brand { min-width: 0; display: flex; align-items: center; gap: 12px; }
      .ga-manager-brand h1 { margin: 0; font-family: Inter, sans-serif; font-size: 1.35rem; font-weight: 850; letter-spacing: 0; }
      .ga-manager-brand p { margin: 3px 0 0; color: #5f6368; font-size: .74rem; font-weight: 750; }
      .ga-logo { width: 38px; height: 38px; position: relative; flex: 0 0 auto; display: block; }
      .ga-logo.small { width: 30px; height: 30px; }
      .ga-logo i, .ga-logo b, .ga-logo em { position: absolute; bottom: 4px; display: block; border-radius: 999px 999px 4px 4px; }
      .ga-logo i { left: 5px; width: 9px; height: 18px; background: #fbbc04; }
      .ga-logo b { left: 16px; width: 9px; height: 27px; background: #f9ab00; }
      .ga-logo em { left: 27px; width: 9px; height: 34px; background: #e8710a; }
      .ga-logo.small i { left: 4px; width: 7px; height: 14px; }
      .ga-logo.small b { left: 13px; width: 7px; height: 21px; }
      .ga-logo.small em { left: 22px; width: 7px; height: 26px; }
      .ga-manager-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
      .ga-manager-actions button, .ga-manager-actions select, .ga-report-head button, .ga-toolbar button { height: 36px; border: 1px solid #dadce0; border-radius: 18px; background: #fff; color: #202124; padding: 0 12px; font-size: .75rem; font-weight: 850; display: inline-flex; align-items: center; gap: 7px; cursor: pointer; }
      .ga-manager-actions button:disabled, .ga-report-head button:disabled { opacity: .6; cursor: not-allowed; }
      .ga-manager-shell { margin-top: 14px; height: calc(100vh - 142px); min-height: 710px; display: grid; grid-template-columns: 248px minmax(0, 1fr); border: 1px solid #dadce0; border-radius: 8px; background: #fff; overflow: hidden; box-shadow: 0 12px 28px rgba(60,64,67,.08); }
      .ga-manager-nav { border-right: 1px solid #dadce0; background: #f8fafd; padding: 12px 10px; display: grid; align-content: start; gap: 4px; overflow-y: auto; scrollbar-width: thin; }
      .ga-manager-nav-brand { display: flex; align-items: center; gap: 8px; padding: 6px 12px 14px; color: #202124; font-size: .82rem; }
      .ga-manager-nav button, .ga-manager-nav a { min-height: 40px; border: 0; border-radius: 0 20px 20px 0; background: transparent; color: #3c4043; display: grid; grid-template-columns: 22px minmax(0,1fr) auto; align-items: center; gap: 10px; padding: 0 12px; text-align: left; text-decoration: none; font-size: .78rem; font-weight: 800; cursor: pointer; }
      .ga-manager-nav button.active { background: #fff4e5; color: #b06000; }
      .ga-manager-nav button b { min-width: 22px; height: 22px; border-radius: 999px; display: inline-grid; place-items: center; background: rgba(60,64,67,.09); padding: 0 6px; font-size: .64rem; }
      .ga-manager-main { min-width: 0; display: grid; grid-template-rows: auto auto auto minmax(0, 1fr); background: #f1f3f4; }
      .ga-warning, .ga-inline-error { display: flex; align-items: center; gap: 10px; margin: 12px 12px 0; border: 1px solid rgba(234,67,53,.28); border-radius: 8px; background: rgba(234,67,53,.08); color: #b3261e; padding: 11px 13px; font-size: .78rem; font-weight: 800; }
      .ga-inline-error { margin: 0 14px 12px; }
      .ga-report-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 16px; border-bottom: 1px solid #dadce0; background: #fff; }
      .ga-report-head strong { display: block; color: #202124; font-size: 1rem; font-weight: 850; }
      .ga-report-head span { display: block; margin-top: 3px; color: #5f6368; font-size: .72rem; font-weight: 750; }
      .ga-report-head button, .ga-toolbar button { color: #e8710a; }
      .ga-summary-strip { display: grid; grid-template-columns: repeat(6, minmax(120px, 1fr)); overflow-x: auto; border-bottom: 1px solid #dadce0; background: #fff; }
      .ga-summary-strip div { min-width: 120px; padding: 11px 13px; border-right: 1px solid #eceff1; }
      .ga-summary-strip span { display: block; color: #5f6368; font-size: .63rem; font-weight: 950; text-transform: uppercase; margin-bottom: 4px; }
      .ga-summary-strip strong { display: block; color: #202124; font-size: .96rem; white-space: nowrap; }
      .ga-summary-strip small { color: #5f6368; font-size: .66rem; font-weight: 750; }
      .ga-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 12px; border-bottom: 1px solid #dadce0; background: #fff; }
      .ga-toolbar > span { margin-left: auto; color: #5f6368; font-size: .72rem; font-weight: 800; }
      .ga-search { height: 38px; min-width: 300px; display: flex; align-items: center; gap: 8px; border: 1px solid #dadce0; border-radius: 4px; background: #fff; padding: 0 10px; color: #5f6368; }
      .ga-search input { border: 0; outline: none; width: 100%; color: #202124; background: transparent; font-size: .8rem; }
      .ga-workspace { min-height: 0; overflow: auto; padding: 14px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start; gap: 14px; scrollbar-width: thin; }
      .ga-panel { min-width: 0; border: 1px solid #dadce0; border-radius: 8px; background: #fff; overflow: hidden; }
      .ga-panel.wide { grid-column: 1 / -1; }
      .ga-panel header { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid #eceff1; padding: 12px 14px; }
      .ga-panel header strong { display: block; color: #202124; font-size: .84rem; font-weight: 950; }
      .ga-panel header span { display: block; margin-top: 3px; color: #5f6368; font-size: .7rem; font-weight: 750; }
      .ga-panel header svg { color: #e8710a; }
      .ga-bar-list, .ga-insight-list { display: grid; gap: 0; }
      .ga-bar-row { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 6px 12px; padding: 12px 14px; border-bottom: 1px solid #eceff1; }
      .ga-bar-row strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #202124; font-size: .78rem; }
      .ga-bar-row span { color: #202124; font-size: .75rem; font-weight: 850; }
      .ga-bar-row i { grid-column: 1 / -1; height: 8px; border-radius: 999px; background: #eceff1; overflow: hidden; }
      .ga-bar-row i b { display: block; height: 100%; border-radius: 999px; }
      .ga-bar-row small { grid-column: 1 / -1; color: #5f6368; font-size: .68rem; }
      .ga-insight-list article { display: flex; gap: 10px; border-bottom: 1px solid #eceff1; padding: 12px 14px; }
      .ga-insight-list svg { color: #f9ab00; flex: 0 0 auto; margin-top: 2px; }
      .ga-insight-list div { display: grid; gap: 2px; min-width: 0; }
      .ga-insight-list span { color: #5f6368; font-size: .66rem; font-weight: 950; text-transform: uppercase; }
      .ga-insight-list strong { color: #202124; font-size: .86rem; }
      .ga-insight-list small { color: #5f6368; font-size: .72rem; line-height: 1.4; }
      .ga-table-wrap { min-width: 0; overflow: auto; scrollbar-width: thin; }
      .ga-table { width: 100%; min-width: 760px; border-collapse: collapse; font-size: .74rem; }
      .ga-table th { position: sticky; top: 0; z-index: 2; background: #fff; color: #5f6368; border-bottom: 1px solid #dadce0; padding: 10px; text-align: left; font-size: .64rem; font-weight: 950; text-transform: uppercase; white-space: nowrap; }
      .ga-table td { border-bottom: 1px solid #eceff1; padding: 10px; color: #202124; white-space: nowrap; vertical-align: middle; }
      .ga-table td:not(.main) { text-align: right; }
      .ga-table td.main { max-width: 430px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #1a73e8; font-weight: 850; }
      .ga-table tr:hover { background: #f8fafd; }
      .ga-table-bar { display: block; width: 74px; height: 8px; border-radius: 999px; background: #eceff1; overflow: hidden; margin-left: auto; }
      .ga-table-bar i { display: block; height: 100%; border-radius: 999px; background: #e8710a; }
      .ga-empty { min-height: 220px; display: grid; place-items: center; align-content: center; gap: 8px; color: #5f6368; text-align: center; padding: 24px; }
      .ga-empty strong { color: #202124; font-size: .86rem; }
      .ga-setup-shell { min-height: 520px; display: grid; place-items: center; align-content: center; gap: 12px; border: 1px dashed #dadce0; border-radius: 8px; background: #fff; text-align: center; padding: 28px; }
      .ga-setup-shell h2 { margin: 0; font-family: Inter, sans-serif; font-size: 1.1rem; letter-spacing: 0; }
      .ga-setup-shell p { margin: 0; color: #5f6368; max-width: 460px; }
      .ga-setup-shell a { min-height: 36px; border-radius: 18px; background: #e8710a; color: #fff; display: inline-flex; align-items: center; padding: 0 14px; font-weight: 900; text-decoration: none; font-size: .78rem; }
      @media (max-width: 1180px) {
        .ga-manager-shell { grid-template-columns: 78px minmax(0, 1fr); height: auto; }
        .ga-manager-nav { padding-inline: 8px; }
        .ga-manager-nav-brand strong, .ga-manager-nav button span, .ga-manager-nav button b, .ga-manager-nav a span { display: none; }
        .ga-manager-nav button, .ga-manager-nav a { grid-template-columns: 1fr; justify-items: center; border-radius: 22px; padding: 0 8px; }
      }
      @media (max-width: 760px) {
        .ga-manager-topbar { position: static; align-items: flex-start; flex-direction: column; }
        .ga-manager-actions { width: 100%; justify-content: stretch; }
        .ga-manager-actions button, .ga-manager-actions select { flex: 1 1 150px; justify-content: center; }
        .ga-summary-strip { grid-template-columns: repeat(2, minmax(0,1fr)); }
        .ga-search { flex: 1 1 100%; min-width: 0; }
        .ga-toolbar > span { margin-left: 0; width: 100%; }
        .ga-workspace { grid-template-columns: 1fr; }
      }
    `}</style>
  )
}
