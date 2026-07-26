'use client'

import { useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  Activity,
  AlertCircle,
  BarChart3,
  CalendarClock,
  ExternalLink,
  Eye,
  Facebook,
  Film,
  Heart,
  Home,
  Instagram,
  LayoutGrid,
  MessageCircle,
  Play,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  SimpleBarChart,
  SimpleDonutChart,
  SimpleLineChart,
} from '@/components/admin/SimpleCharts'

type PlatformKey = 'instagram' | 'facebook'

type OrganicMedia = {
  id: string
  external_id: string
  media_type: string | null
  media_product_type: string | null
  caption: string | null
  permalink: string | null
  thumbnail_url: string | null
  media_url: string | null
  published_at: string | null
  like_count: number
  comments_count: number
  reach: number
  views: number
  total_interactions: number
  saved: number
  shares: number
}

type EnrichedMedia = OrganicMedia & { platform: PlatformKey }

type OrganicPayload = {
  profile: {
    username: string | null
    display_name: string | null
    profile_picture_url: string | null
    followers_count: number
    media_count: number
    last_synced_at: string | null
  } | null
  media: OrganicMedia[]
  reels: OrganicMedia[]
  totals: {
    followers: number
    media: number
    reach: number
    views: number
    totalInteractions: number
    likes: number
    comments: number
    saved: number
    shares: number
  }
  cached: boolean
  stale: boolean
  syncedAt: string | null
  warning?: string
}

type OrganicAiReport = {
  id: string
  title: string
  summary: string | null
  period_start: string | null
  period_end: string | null
  insights: Array<{ title?: string; detail?: string; impact?: string }>
  recommendations: Array<{ title?: string; action?: string; priority?: string }>
  metrics: Record<string, unknown>
  created_at: string
}

type OrganicTab = 'overview' | 'content' | 'reels' | 'insights'

type Props = {
  platform: PlatformKey
  data: Record<PlatformKey, OrganicPayload | null>
  reports: OrganicAiReport[]
  syncing: boolean
  reportLoading: boolean
  reportError: string
  error: Record<PlatformKey, string>
  onPlatformChange: (value: PlatformKey) => void
  onSync: (force?: boolean, target?: PlatformKey | 'all') => void
  onGenerateReport: () => void
}

const platformMeta: Record<PlatformKey, { label: string; short: string; icon: ReactNode; color: string; accent: string }> = {
  instagram: {
    label: 'Instagram',
    short: 'IG',
    icon: <Instagram size={17} />,
    color: '#d62976',
    accent: '#fdf2f8',
  },
  facebook: {
    label: 'Facebook',
    short: 'FB',
    icon: <Facebook size={17} />,
    color: '#1877f2',
    accent: '#eff6ff',
  },
}

const compact = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const full = new Intl.NumberFormat('pt-BR')
const percent = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
})

function formatNumber(value: number | null | undefined) {
  return full.format(Number(value || 0))
}

function formatShort(value: number | null | undefined) {
  return compact.format(Number(value || 0))
}

function formatPercent(value: number | null | undefined) {
  return `${percent.format(Number(value || 0))}%`
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateOnly(value: string | null | undefined) {
  if (!value) return '-'
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function mediaTitle(media: Pick<OrganicMedia, 'caption' | 'media_product_type' | 'media_type'>, max = 86) {
  const firstLine = media.caption?.split('\n').find(Boolean)?.trim()
  const title = firstLine || media.media_product_type || media.media_type || 'Publicacao'
  return title.length > max ? `${title.slice(0, max - 3)}...` : title
}

function mediaKind(media: OrganicMedia) {
  return media.media_product_type || media.media_type || 'Midia'
}

function mediaScore(media: Pick<OrganicMedia, 'views' | 'reach' | 'total_interactions' | 'like_count' | 'comments_count' | 'shares' | 'saved'>) {
  return (media.views || 0)
    + (media.reach || 0)
    + ((media.total_interactions || 0) * 2)
    + (media.like_count || 0)
    + ((media.comments_count || 0) * 4)
    + ((media.shares || 0) * 5)
    + ((media.saved || 0) * 3)
}

function getTrend(current: number, previous: number) {
  if (previous <= 0 && current > 0) return { direction: 'up' as const, percent: 100 }
  if (previous <= 0) return { direction: 'flat' as const, percent: 0 }
  const delta = ((current - previous) / previous) * 100
  return {
    direction: delta > 3 ? 'up' as const : delta < -3 ? 'down' as const : 'flat' as const,
    percent: delta,
  }
}

function emptyTotals() {
  return {
    followers: 0,
    media: 0,
    reach: 0,
    views: 0,
    totalInteractions: 0,
    likes: 0,
    comments: 0,
    saved: 0,
    shares: 0,
  }
}

export default function OrganicTrafficManagerView({
  platform,
  data,
  reports,
  syncing,
  reportLoading,
  reportError,
  error,
  onPlatformChange,
  onSync,
  onGenerateReport,
}: Props) {
  const [activeTab, setActiveTab] = useState<OrganicTab>('overview')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string>('')

  const activeData = data[platform]
  const activeMeta = platformMeta[platform]
  const latestReport = reports[0] || null

  const combinedTotals = useMemo(() => {
    return ([data.instagram, data.facebook].filter(Boolean) as OrganicPayload[]).reduce(
      (acc, item) => {
        acc.followers += item.totals.followers || 0
        acc.media += item.totals.media || 0
        acc.reach += item.totals.reach || 0
        acc.views += item.totals.views || 0
        acc.totalInteractions += item.totals.totalInteractions || 0
        acc.likes += item.totals.likes || 0
        acc.comments += item.totals.comments || 0
        acc.saved += item.totals.saved || 0
        acc.shares += item.totals.shares || 0
        return acc
      },
      emptyTotals(),
    )
  }, [data.facebook, data.instagram])

  const allMedia = useMemo<EnrichedMedia[]>(() => {
    return [
      ...(data.instagram?.media || []).map(item => ({ ...item, platform: 'instagram' as const })),
      ...(data.facebook?.media || []).map(item => ({ ...item, platform: 'facebook' as const })),
    ].sort((a, b) => mediaScore(b) - mediaScore(a))
  }, [data.facebook, data.instagram])

  const activeMedia = useMemo<EnrichedMedia[]>(() => {
    const source = activeTab === 'reels'
      ? activeData?.reels || []
      : activeData?.media || []
    return source.map(item => ({ ...item, platform }))
  }, [activeData, activeTab, platform])

  const filteredMedia = useMemo(() => {
    const term = query.trim().toLowerCase()
    const rows = activeMedia.sort((a, b) => {
      const aDate = new Date(a.published_at || '').getTime() || 0
      const bDate = new Date(b.published_at || '').getTime() || 0
      return bDate - aDate
    })
    if (!term) return rows
    return rows.filter(item => {
      const haystack = `${item.caption || ''} ${item.media_type || ''} ${item.media_product_type || ''} ${item.external_id || ''}`.toLowerCase()
      return haystack.includes(term)
    })
  }, [activeMedia, query])

  const selectedMedia = useMemo(() => {
    if (filteredMedia.length === 0) return null
    return filteredMedia.find(item => item.id === selectedId) || filteredMedia[0]
  }, [filteredMedia, selectedId])

  const chronological = useMemo(() => {
    return [...(activeData?.media || [])]
      .sort((a, b) => new Date(a.published_at || '').getTime() - new Date(b.published_at || '').getTime())
  }, [activeData])

  const lineData = useMemo(() => {
    return chronological.map((item, index) => ({
      label: `${index + 1}`,
      Performance: mediaScore(item),
      Views: item.views || 0,
      Alcance: item.reach || 0,
    }))
  }, [chronological])

  const topContent = useMemo(() => allMedia.slice(0, 8), [allMedia])
  const bestPost = topContent[0] || null
  const activeTotals = activeData?.totals || emptyTotals()
  const activeFollowers = activeTotals.followers || 0
  const activeEngagement = activeFollowers > 0
    ? ((activeTotals.totalInteractions || 0) / activeFollowers) * 100
    : 0
  const averageScore = activeData?.media.length
    ? Math.round(activeData.media.reduce((sum, item) => sum + mediaScore(item), 0) / activeData.media.length)
    : 0

  const momentum = useMemo(() => {
    if (chronological.length < 2) return { direction: 'flat' as const, percent: 0 }
    const midpoint = Math.max(1, Math.floor(chronological.length / 2))
    const previousRows = chronological.slice(0, midpoint)
    const currentRows = chronological.slice(midpoint)
    const previous = previousRows.reduce((sum, item) => sum + mediaScore(item), 0) / Math.max(previousRows.length, 1)
    const current = currentRows.reduce((sum, item) => sum + mediaScore(item), 0) / Math.max(currentRows.length, 1)
    return getTrend(current, previous)
  }, [chronological])

  const signalData = useMemo(() => {
    return [
      { name: 'Views', value: activeTotals.views || 0 },
      { name: 'Alcance', value: activeTotals.reach || 0 },
      { name: 'Interacoes', value: activeTotals.totalInteractions || 0 },
      { name: 'Comentarios', value: activeTotals.comments || 0 },
      { name: 'Salvos', value: activeTotals.saved || 0 },
      { name: 'Compart.', value: activeTotals.shares || 0 },
    ].filter(item => item.value > 0)
  }, [activeTotals])

  const rankingData = useMemo(() => {
    return [...(activeData?.media || [])]
      .sort((a, b) => mediaScore(b) - mediaScore(a))
      .slice(0, 7)
      .map(item => ({ name: mediaTitle(item, 24), value: mediaScore(item) }))
  }, [activeData])

  const networkData = useMemo(() => {
    return (Object.keys(platformMeta) as PlatformKey[]).map(key => ({
      name: platformMeta[key].label,
      value: data[key]?.totals.followers || 0,
    }))
  }, [data])

  const suggestions = useMemo(() => {
    const rows: Array<{ title: string; detail: string; tone: 'good' | 'warn' | 'neutral' }> = []
    if (bestPost) {
      rows.push({
        title: 'Transformar o campeao em serie',
        detail: `${platformMeta[bestPost.platform].label}: "${mediaTitle(bestPost, 72)}" concentra o melhor sinal recente.`,
        tone: 'good',
      })
    }
    if ((data.instagram?.reels.length || 0) > 0) {
      rows.push({
        title: 'Comparar ganchos dos Reels',
        detail: `${data.instagram?.reels.length || 0} Reels recentes estao prontos para cruzar tema, gancho e retencao.`,
        tone: 'neutral',
      })
    }
    if (momentum.direction === 'down') {
      rows.push({
        title: 'Ritmo recente pede revisao',
        detail: `A media de performance caiu ${formatPercent(Math.abs(momentum.percent))}. Revisar thumbnail, tema e primeira frase.`,
        tone: 'warn',
      })
    } else if (momentum.direction === 'up') {
      rows.push({
        title: 'Ritmo recente em alta',
        detail: `A media de performance subiu ${formatPercent(Math.abs(momentum.percent))}. Vale repetir o padrao vencedor.`,
        tone: 'good',
      })
    }
    if (rows.length === 0) {
      rows.push({
        title: 'Aguardando mais dados',
        detail: 'Sincronize Instagram e Facebook para formar uma leitura organica mais confiavel.',
        tone: 'neutral',
      })
    }
    return rows.slice(0, 4)
  }, [bestPost, data.instagram?.reels.length, momentum.direction, momentum.percent])

  const profileName = activeData?.profile?.username
    ? `@${activeData.profile.username}`
    : activeData?.profile?.display_name || activeMeta.label

  const tabItems: Array<{ key: OrganicTab; label: string; icon: ReactNode; count: number }> = [
    { key: 'overview', label: 'Inicio', icon: <Home size={17} />, count: topContent.length },
    { key: 'content', label: 'Conteudos', icon: <LayoutGrid size={17} />, count: activeData?.media.length || 0 },
    { key: 'reels', label: 'Reels', icon: <Film size={17} />, count: activeData?.reels.length || 0 },
    { key: 'insights', label: 'Insights IA', icon: <Sparkles size={17} />, count: reports.length },
  ]

  const visibleMedia = activeTab === 'overview' ? topContent : filteredMedia
  const warning = error[platform] || activeData?.warning || ''

  return (
    <div className="organic-manager-page">
      <header className="organic-manager-topbar">
        <div className="organic-manager-brand">
          <span className="organic-brand-mark"><Instagram size={18} /><Facebook size={15} /></span>
          <div>
            <h1>Trafego Organico</h1>
            <p>{profileName} | Instagram e Facebook em operacao unica.</p>
          </div>
        </div>
        <div className="organic-manager-actions">
          <button type="button" onClick={onGenerateReport} disabled={reportLoading}>
            <Sparkles size={16} className={reportLoading ? 'spin' : ''} />
            {reportLoading ? 'Analisando' : 'Relatorio IA'}
          </button>
          <button type="button" onClick={() => onSync(true, platform)} disabled={syncing}>
            <RefreshCw size={16} className={syncing ? 'spin' : ''} />
            {activeMeta.short}
          </button>
          <button type="button" className="primary" onClick={() => onSync(true, 'all')} disabled={syncing}>
            <RefreshCw size={16} className={syncing ? 'spin' : ''} />
            Sincronizar
          </button>
        </div>
      </header>

      <section className="organic-manager-shell">
        <aside className="organic-manager-sidebar">
          <div className="organic-sidebar-title">
            <span>Central</span>
            <strong>Conteudo organico</strong>
          </div>
          <div className="organic-platform-switch">
            {(Object.keys(platformMeta) as PlatformKey[]).map(key => (
              <button
                key={key}
                type="button"
                className={platform === key ? 'active' : ''}
                onClick={() => onPlatformChange(key)}
              >
                {platformMeta[key].icon}
                <span>{platformMeta[key].label}</span>
                <b>{formatShort(data[key]?.totals.followers || 0)}</b>
              </button>
            ))}
          </div>
          <div className="organic-tab-list">
            {tabItems.map(item => (
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
          </div>
          <div className="organic-sync-card">
            <CalendarClock size={17} />
            <span>Atualizado</span>
            <strong>{formatDate(activeData?.syncedAt || activeData?.profile?.last_synced_at)}</strong>
          </div>
        </aside>

        <main className="organic-manager-main">
          {warning && (
            <div className={`organic-warning ${error[platform] ? 'error' : ''}`}>
              <AlertCircle size={18} />
              <span>{warning}</span>
            </div>
          )}
          {reportError && (
            <div className="organic-warning error">
              <AlertCircle size={18} />
              <span>{reportError}</span>
            </div>
          )}

          <div className="organic-page-head">
            <div>
              <strong>{activeTab === 'overview' ? 'Visao geral' : activeTab === 'content' ? 'Biblioteca de conteudos' : activeTab === 'reels' ? 'Reels e videos' : 'Leitura da IA'}</strong>
              <span>{activeMeta.label}: {formatNumber(activeTotals.media)} midias, {formatShort(activeTotals.reach)} alcance, {formatShort(activeTotals.views)} views.</span>
            </div>
            <div className={`organic-trend-pill ${momentum.direction}`}>
              <TrendingUp size={15} />
              <span>{momentum.direction === 'up' ? 'Subindo' : momentum.direction === 'down' ? 'Descendo' : 'Estavel'}</span>
              <b>{formatPercent(Math.abs(momentum.percent))}</b>
            </div>
          </div>

          <div className="organic-summary-strip">
            <Metric label="Seguidores" value={formatShort(activeTotals.followers)} detail="base atual" />
            <Metric label="Alcance" value={formatShort(activeTotals.reach)} detail="midias recentes" />
            <Metric label="Views" value={formatShort(activeTotals.views)} detail="videos e posts" />
            <Metric label="Interacoes" value={formatShort(activeTotals.totalInteractions)} detail="sinais totais" />
            <Metric label="Engajamento" value={formatPercent(activeEngagement)} detail="sobre seguidores" />
            <Metric label="Score medio" value={formatShort(averageScore)} detail="por conteudo" />
          </div>

          <div className="organic-toolbar">
            <div className="organic-search">
              <Search size={16} />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Pesquisar conteudo"
              />
            </div>
            <button type="button" onClick={() => setActiveTab('content')}><LayoutGrid size={15} /> Biblioteca</button>
            <button type="button" onClick={() => setActiveTab('insights')}><Sparkles size={15} /> Insights</button>
            <span>{formatNumber(combinedTotals.media)} midias no total</span>
          </div>

          {activeTab === 'insights' ? (
            <div className="organic-workspace insights">
              <section className="organic-panel wide">
                <PanelHeader title="Relatorio do agente" detail={latestReport ? `${formatDateOnly(latestReport.period_start)} ate ${formatDateOnly(latestReport.period_end)}` : 'Nenhum relatorio gerado'} icon={<Sparkles size={18} />} />
                {latestReport ? (
                  <div className="organic-report-layout">
                    <div className="organic-report-lead">
                      <strong>{latestReport.title}</strong>
                      <p>{latestReport.summary || 'Relatorio salvo sem resumo.'}</p>
                    </div>
                    <div className="organic-report-columns">
                      <ReportList title="Insights" rows={(latestReport.insights || []).slice(0, 4).map(item => ({
                        title: item.title || 'Insight',
                        detail: item.detail || '-',
                        tag: item.impact || 'impacto',
                      }))} />
                      <ReportList title="Acoes" rows={(latestReport.recommendations || []).slice(0, 4).map(item => ({
                        title: item.title || 'Acao',
                        detail: item.action || '-',
                        tag: item.priority || 'prioridade',
                      }))} />
                    </div>
                  </div>
                ) : (
                  <EmptyState title="Relatorio ainda nao gerado" detail="Clique em Relatorio IA para cruzar conteudos, alcance, comentarios e proximas acoes." />
                )}
              </section>

              <section className="organic-panel">
                <PanelHeader title="Recomendacoes rapidas" detail="Sinais calculados agora" icon={<Sparkles size={18} />} />
                <div className="organic-suggestion-list">
                  {suggestions.map(item => (
                    <article key={item.title} className={item.tone}>
                      <span>{item.tone === 'good' ? 'bom sinal' : item.tone === 'warn' ? 'atencao' : 'neutro'}</span>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="organic-panel">
                <PanelHeader title="Base por rede" detail="Seguidores conectados" icon={<Users size={18} />} />
                <SimpleBarChart data={networkData} color="#b08a43" name="Seguidores" height={270} valueFormatter={value => formatShort(value)} />
              </section>
            </div>
          ) : (
            <div className="organic-workspace">
              <section className="organic-feed-panel">
                <PanelHeader
                  title={activeTab === 'overview' ? 'Conteudos prioritarios' : activeTab === 'reels' ? 'Reels recentes' : 'Publicacoes recentes'}
                  detail={`${visibleMedia.length} itens visiveis`}
                  icon={<Film size={18} />}
                />
                <div className="organic-feed-list">
                  {visibleMedia.length === 0 ? (
                    <EmptyState title="Nenhum conteudo encontrado" detail="Sincronize a rede ou limpe a pesquisa para ver publicacoes." />
                  ) : visibleMedia.map(item => (
                    <button
                      key={`${item.platform}-${item.id}`}
                      type="button"
                      className={selectedMedia?.id === item.id ? 'active' : ''}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <MediaThumb media={item} platform={item.platform} />
                      <div>
                        <strong>{mediaTitle(item, 72)}</strong>
                        <span>{platformMeta[item.platform].label} | {mediaKind(item)} | {formatDate(item.published_at)}</span>
                        <small>
                          <Eye size={13} /> {formatShort(item.reach)}
                          <Play size={13} /> {formatShort(item.views)}
                          <Heart size={13} /> {formatShort(item.like_count)}
                          <MessageCircle size={13} /> {formatShort(item.comments_count)}
                        </small>
                      </div>
                      <b>{formatShort(mediaScore(item))}</b>
                    </button>
                  ))}
                </div>
              </section>

              <section className="organic-detail-panel">
                <PanelHeader title="Detalhes do conteudo" detail={selectedMedia ? formatDate(selectedMedia.published_at) : 'Aguardando selecao'} icon={<Activity size={18} />} />
                {selectedMedia ? (
                  <>
                    <div className="organic-preview">
                      <MediaThumb media={selectedMedia} platform={selectedMedia.platform} large />
                      <div>
                        <span className="organic-platform-badge" style={{ '--badge-color': platformMeta[selectedMedia.platform].color } as CSSProperties}>
                          {platformMeta[selectedMedia.platform].icon}
                          {platformMeta[selectedMedia.platform].label}
                        </span>
                        <strong>{mediaTitle(selectedMedia, 120)}</strong>
                        <p>{selectedMedia.caption || 'Sem legenda salva para esta midia.'}</p>
                        {selectedMedia.permalink && (
                          <a href={selectedMedia.permalink} target="_blank" rel="noreferrer">
                            <ExternalLink size={15} />
                            Abrir publicacao
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="organic-detail-metrics">
                      <Metric label="Score" value={formatShort(mediaScore(selectedMedia))} detail="peso geral" />
                      <Metric label="Views" value={formatShort(selectedMedia.views)} detail="visualizacoes" />
                      <Metric label="Alcance" value={formatShort(selectedMedia.reach)} detail="pessoas" />
                      <Metric label="Comentarios" value={formatShort(selectedMedia.comments_count)} detail="conversas" />
                      <Metric label="Salvos" value={formatShort(selectedMedia.saved)} detail="intencao" />
                      <Metric label="Compart." value={formatShort(selectedMedia.shares)} detail="distribuicao" />
                    </div>
                  </>
                ) : (
                  <EmptyState title="Sem conteudo selecionado" detail="Escolha uma publicacao na lista." />
                )}
              </section>

              <section className="organic-panel chart">
                <PanelHeader title="Performance por publicacao" detail="Sequencia cronologica da rede ativa" icon={<TrendingUp size={18} />} />
                <SimpleLineChart
                  data={lineData}
                  height={290}
                  valueFormatter={value => formatShort(value)}
                  series={[
                    { key: 'Performance', name: 'Performance', color: '#b08a43' },
                    { key: 'Views', name: 'Views', color: '#d62976' },
                    { key: 'Alcance', name: 'Alcance', color: '#1877f2' },
                  ]}
                />
              </section>

              <section className="organic-panel chart">
                <PanelHeader title="Sinais organicos" detail="Composicao da rede ativa" icon={<BarChart3 size={18} />} />
                <SimpleDonutChart
                  data={signalData}
                  colors={['#d62976', '#1877f2', '#b08a43', '#22c55e', '#f59e0b', '#8b5cf6']}
                  height={290}
                  valueFormatter={value => formatShort(value)}
                />
              </section>

              <section className="organic-panel wide chart">
                <PanelHeader title="Ranking de conteudos" detail="Maior score de performance" icon={<TrendingUp size={18} />} />
                <SimpleBarChart data={rankingData} color="#b08a43" name="Score" height={300} layout="horizontal" valueFormatter={value => formatShort(value)} />
              </section>
            </div>
          )}
        </main>
      </section>
      <Styles />
    </div>
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

function PanelHeader({ title, detail, icon }: { title: string; detail: string; icon: ReactNode }) {
  return (
    <header>
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      {icon}
    </header>
  )
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="organic-empty">
      <Activity size={28} />
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  )
}

function MediaThumb({ media, platform, large = false }: { media: OrganicMedia; platform: PlatformKey; large?: boolean }) {
  const source = media.thumbnail_url || media.media_url || ''
  return (
    <div className={large ? 'organic-thumb large' : 'organic-thumb'}>
      {source ? (
        <img src={source} alt="" />
      ) : (
        <span>{platformMeta[platform].icon}</span>
      )}
      <i style={{ background: platformMeta[platform].color }}>{platformMeta[platform].short}</i>
    </div>
  )
}

function ReportList({ title, rows }: { title: string; rows: Array<{ title: string; detail: string; tag: string }> }) {
  return (
    <div className="organic-report-list">
      <strong>{title}</strong>
      {rows.length === 0 ? (
        <p>Nenhum item salvo.</p>
      ) : rows.map(row => (
        <article key={`${title}-${row.title}`}>
          <span>{row.tag}</span>
          <b>{row.title}</b>
          <p>{row.detail}</p>
        </article>
      ))}
    </div>
  )
}

function Styles() {
  return (
    <style jsx global>{`
      .organic-manager-page { min-height: 100vh; color: #1f2933; }
      .organic-manager-topbar { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 0; border-bottom: 1px solid #ded7c8; background: color-mix(in srgb, var(--bg-primary) 94%, transparent); backdrop-filter: blur(12px); }
      .organic-manager-brand { min-width: 0; display: flex; align-items: center; gap: 12px; }
      .organic-brand-mark { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, #d62976, #b08a43 48%, #1877f2); box-shadow: 0 10px 24px rgba(176,138,67,.22); position: relative; flex: 0 0 auto; }
      .organic-brand-mark svg + svg { position: absolute; right: -2px; bottom: -2px; width: 19px; height: 19px; padding: 3px; border-radius: 50%; color: #1877f2; background: #fff; box-shadow: 0 2px 8px rgba(17,24,39,.15); }
      .organic-manager-brand h1 { margin: 0; font-family: Inter, sans-serif; font-size: 1.35rem; font-weight: 900; letter-spacing: 0; color: #171717; }
      .organic-manager-brand p { margin: 3px 0 0; color: #6b7280; font-size: .74rem; font-weight: 750; }
      .organic-manager-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
      .organic-manager-actions button, .organic-toolbar button { height: 36px; border: 1px solid #ded7c8; border-radius: 18px; background: #fff; color: #171717; padding: 0 12px; font-size: .75rem; font-weight: 850; display: inline-flex; align-items: center; gap: 7px; cursor: pointer; white-space: nowrap; }
      .organic-manager-actions button.primary { background: #b08a43; border-color: #b08a43; color: #fffaf2; }
      .organic-manager-actions button:disabled { opacity: .62; cursor: not-allowed; }
      .organic-manager-shell { margin-top: 14px; height: calc(100vh - 142px); min-height: 760px; display: grid; grid-template-columns: 254px minmax(0, 1fr); border: 1px solid #ded7c8; border-radius: 8px; background: #fff; overflow: hidden; box-shadow: 0 14px 30px rgba(47,43,36,.08); }
      .organic-manager-sidebar { border-right: 1px solid #ded7c8; background: #fbfaf7; padding: 12px 10px; display: grid; align-content: start; gap: 12px; overflow-y: auto; scrollbar-width: thin; }
      .organic-sidebar-title { padding: 7px 12px 4px; }
      .organic-sidebar-title span { display: block; color: #b08a43; font-size: .62rem; font-weight: 950; text-transform: uppercase; letter-spacing: .08em; }
      .organic-sidebar-title strong { display: block; margin-top: 4px; color: #171717; font-size: .86rem; }
      .organic-platform-switch, .organic-tab-list { display: grid; gap: 4px; }
      .organic-platform-switch button, .organic-tab-list button { min-height: 42px; border: 0; border-radius: 0 22px 22px 0; background: transparent; color: #3f3f46; display: grid; grid-template-columns: 24px minmax(0,1fr) auto; align-items: center; gap: 9px; padding: 0 12px; text-align: left; font-size: .78rem; font-weight: 850; cursor: pointer; }
      .organic-platform-switch button.active, .organic-tab-list button.active { background: #f5ead9; color: #8b6426; }
      .organic-platform-switch button svg, .organic-tab-list button svg { color: #b08a43; }
      .organic-platform-switch button b, .organic-tab-list button b { min-width: 23px; height: 22px; border-radius: 999px; display: inline-grid; place-items: center; background: rgba(39,39,42,.08); padding: 0 6px; color: #6b7280; font-size: .64rem; }
      .organic-sync-card { display: grid; gap: 4px; margin: 4px 6px 0; padding: 12px; border: 1px solid #eadfce; border-radius: 8px; background: #fff; color: #6b7280; }
      .organic-sync-card svg { color: #b08a43; }
      .organic-sync-card span { font-size: .64rem; font-weight: 950; text-transform: uppercase; letter-spacing: .06em; }
      .organic-sync-card strong { color: #171717; font-size: .82rem; }
      .organic-manager-main { min-width: 0; display: grid; grid-template-rows: auto auto auto minmax(0, 1fr); background: #f4f1ea; }
      .organic-warning { display: flex; align-items: center; gap: 10px; margin: 12px 12px 0; border: 1px solid rgba(245,158,11,.25); border-radius: 8px; background: rgba(245,158,11,.1); color: #92400e; padding: 11px 13px; font-size: .78rem; font-weight: 850; }
      .organic-warning.error { border-color: rgba(239,68,68,.28); background: rgba(239,68,68,.08); color: #b91c1c; }
      .organic-page-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 1px solid #ded7c8; background: #fff; }
      .organic-page-head strong { display: block; color: #171717; font-size: 1rem; font-weight: 900; }
      .organic-page-head span { display: block; margin-top: 3px; color: #6b7280; font-size: .72rem; font-weight: 750; }
      .organic-trend-pill { min-height: 32px; display: inline-flex; align-items: center; gap: 7px; border-radius: 999px; padding: 0 11px; background: #f3f4f6; color: #6b7280; font-size: .72rem; font-weight: 900; white-space: nowrap; }
      .organic-trend-pill.up { background: #dcfce7; color: #15803d; }
      .organic-trend-pill.down { background: #fee2e2; color: #b91c1c; }
      .organic-trend-pill b { color: inherit; }
      .organic-summary-strip { display: grid; grid-template-columns: repeat(6, minmax(126px, 1fr)); overflow-x: auto; border-bottom: 1px solid #ded7c8; background: #fff; }
      .organic-summary-strip div, .organic-detail-metrics div { min-width: 120px; padding: 11px 13px; border-right: 1px solid #ece7dc; }
      .organic-summary-strip span, .organic-detail-metrics span { display: block; color: #6b7280; font-size: .62rem; font-weight: 950; text-transform: uppercase; margin-bottom: 4px; white-space: nowrap; }
      .organic-summary-strip strong, .organic-detail-metrics strong { display: block; color: #171717; font-size: .97rem; white-space: nowrap; }
      .organic-summary-strip small, .organic-detail-metrics small { color: #6b7280; font-size: .66rem; font-weight: 750; }
      .organic-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 12px; border-bottom: 1px solid #ded7c8; background: #fff; }
      .organic-toolbar > span { margin-left: auto; color: #6b7280; font-size: .72rem; font-weight: 850; }
      .organic-search { height: 38px; min-width: 310px; display: flex; align-items: center; gap: 8px; border: 1px solid #ded7c8; border-radius: 4px; background: #fff; padding: 0 10px; color: #6b7280; }
      .organic-search input { border: 0; outline: none; width: 100%; color: #171717; background: transparent; font-size: .8rem; }
      .organic-workspace { min-height: 0; overflow: auto; padding: 14px; display: grid; grid-template-columns: minmax(320px, .78fr) minmax(360px, 1.22fr); align-content: start; gap: 14px; scrollbar-width: thin; }
      .organic-workspace.insights { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .organic-feed-panel, .organic-detail-panel, .organic-panel { min-width: 0; border: 1px solid #ded7c8; border-radius: 8px; background: #fff; overflow: hidden; }
      .organic-panel.wide { grid-column: 1 / -1; }
      .organic-panel.chart { min-height: 340px; }
      .organic-feed-panel { max-height: 670px; display: grid; grid-template-rows: auto minmax(0, 1fr); }
      .organic-feed-panel header, .organic-detail-panel header, .organic-panel header { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid #ece7dc; padding: 12px 14px; }
      .organic-feed-panel header strong, .organic-detail-panel header strong, .organic-panel header strong { display: block; color: #171717; font-size: .84rem; font-weight: 950; }
      .organic-feed-panel header span, .organic-detail-panel header span, .organic-panel header span { display: block; margin-top: 3px; color: #6b7280; font-size: .7rem; font-weight: 750; }
      .organic-feed-panel header svg, .organic-detail-panel header svg, .organic-panel header svg { color: #b08a43; }
      .organic-feed-list { min-height: 0; overflow: auto; scrollbar-width: thin; }
      .organic-feed-list button { width: 100%; min-height: 94px; border: 0; border-bottom: 1px solid #ece7dc; background: #fff; display: grid; grid-template-columns: 58px minmax(0,1fr) auto; align-items: center; gap: 12px; padding: 12px 14px; text-align: left; cursor: pointer; }
      .organic-feed-list button:hover, .organic-feed-list button.active { background: #f8f3eb; }
      .organic-feed-list button.active { box-shadow: inset 4px 0 0 #b08a43; }
      .organic-feed-list button > div:nth-child(2) { min-width: 0; display: grid; gap: 4px; }
      .organic-feed-list button strong { color: #171717; font-size: .82rem; line-height: 1.28; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .organic-feed-list button span { color: #6b7280; font-size: .68rem; font-weight: 750; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .organic-feed-list button small { display: flex; align-items: center; gap: 8px; color: #6b7280; font-size: .68rem; white-space: nowrap; overflow: hidden; }
      .organic-feed-list button small svg { color: #b08a43; flex: 0 0 auto; }
      .organic-feed-list button > b { min-width: 52px; justify-self: end; color: #171717; font-size: .78rem; }
      .organic-thumb { position: relative; width: 58px; height: 58px; border-radius: 50%; overflow: hidden; background: #efe7da; display: grid; place-items: center; color: #b08a43; flex: 0 0 auto; }
      .organic-thumb.large { width: 210px; height: 260px; border-radius: 8px; }
      .organic-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .organic-thumb > span { display: grid; place-items: center; }
      .organic-thumb i { position: absolute; right: 2px; bottom: 2px; min-width: 22px; height: 22px; border-radius: 999px; display: inline-grid; place-items: center; color: #fff; font-size: .58rem; font-style: normal; font-weight: 950; border: 2px solid #fff; }
      .organic-preview { display: grid; grid-template-columns: 210px minmax(0,1fr); gap: 16px; padding: 16px; border-bottom: 1px solid #ece7dc; }
      .organic-preview > div:last-child { min-width: 0; display: grid; align-content: start; gap: 10px; }
      .organic-preview strong { color: #171717; font-size: 1rem; line-height: 1.32; }
      .organic-preview p { margin: 0; max-height: 118px; overflow: auto; color: #3f3f46; font-size: .78rem; line-height: 1.46; scrollbar-width: thin; }
      .organic-preview a { width: fit-content; display: inline-flex; align-items: center; gap: 7px; min-height: 34px; border: 1px solid #ded7c8; border-radius: 17px; padding: 0 12px; color: #8b6426; background: #fffaf2; text-decoration: none; font-size: .73rem; font-weight: 900; }
      .organic-platform-badge { width: fit-content; display: inline-flex; align-items: center; gap: 7px; border-radius: 999px; padding: 5px 10px; color: var(--badge-color); background: color-mix(in srgb, var(--badge-color) 11%, #fff); font-size: .68rem; font-weight: 950; text-transform: uppercase; }
      .organic-detail-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); background: #fff; }
      .organic-panel.chart .simple-chart-frame, .organic-panel.chart .simple-donut-frame { padding: 14px; }
      .organic-report-layout { display: grid; grid-template-columns: minmax(260px, .72fr) minmax(0, 1.28fr); gap: 14px; padding: 14px; }
      .organic-report-lead { border-radius: 8px; background: #171717; color: #fffaf2; padding: 18px; min-height: 230px; }
      .organic-report-lead strong { display: block; font-size: 1.08rem; line-height: 1.2; }
      .organic-report-lead p { margin: 10px 0 0; color: rgba(255,250,242,.78); font-size: .82rem; line-height: 1.55; }
      .organic-report-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .organic-report-list { border: 1px solid #ece7dc; border-radius: 8px; overflow: hidden; }
      .organic-report-list > strong { display: block; padding: 11px 12px; border-bottom: 1px solid #ece7dc; color: #171717; font-size: .8rem; }
      .organic-report-list > p { margin: 0; padding: 12px; color: #6b7280; font-size: .75rem; }
      .organic-report-list article { padding: 12px; border-bottom: 1px solid #ece7dc; }
      .organic-report-list article:last-child { border-bottom: 0; }
      .organic-report-list span, .organic-suggestion-list span { display: inline-block; margin-bottom: 6px; color: #8b6426; background: #f5ead9; border-radius: 999px; padding: 3px 7px; font-size: .58rem; font-weight: 950; text-transform: uppercase; }
      .organic-report-list b, .organic-suggestion-list strong { display: block; color: #171717; font-size: .8rem; line-height: 1.26; }
      .organic-report-list p, .organic-suggestion-list p { margin: 5px 0 0; color: #6b7280; font-size: .72rem; line-height: 1.45; }
      .organic-suggestion-list { display: grid; gap: 0; }
      .organic-suggestion-list article { padding: 13px 14px; border-bottom: 1px solid #ece7dc; }
      .organic-suggestion-list article.good { box-shadow: inset 4px 0 0 #22c55e; }
      .organic-suggestion-list article.warn { box-shadow: inset 4px 0 0 #ef4444; }
      .organic-empty { min-height: 220px; display: grid; place-items: center; align-content: center; gap: 7px; color: #6b7280; text-align: center; padding: 24px; }
      .organic-empty strong { color: #171717; font-size: .86rem; }
      .organic-empty span { max-width: 360px; font-size: .73rem; line-height: 1.4; }
      @media (max-width: 1180px) {
        .organic-manager-shell { height: auto; min-height: 0; grid-template-columns: 1fr; }
        .organic-manager-sidebar { border-right: 0; border-bottom: 1px solid #ded7c8; }
        .organic-platform-switch, .organic-tab-list { grid-template-columns: repeat(2, minmax(0,1fr)); }
        .organic-platform-switch button, .organic-tab-list button { border-radius: 20px; }
        .organic-workspace, .organic-workspace.insights, .organic-report-layout { grid-template-columns: 1fr; }
        .organic-feed-panel { max-height: none; }
      }
      @media (max-width: 720px) {
        .organic-manager-topbar, .organic-page-head { align-items: stretch; flex-direction: column; }
        .organic-manager-actions { justify-content: stretch; }
        .organic-manager-actions button { flex: 1 1 0; justify-content: center; }
        .organic-summary-strip { grid-template-columns: repeat(2, minmax(140px, 1fr)); }
        .organic-search { min-width: 100%; }
        .organic-toolbar > span { margin-left: 0; width: 100%; }
        .organic-workspace { grid-template-columns: 1fr; padding: 10px; }
        .organic-preview { grid-template-columns: 1fr; }
        .organic-thumb.large { width: 100%; height: auto; aspect-ratio: 4 / 5; }
        .organic-detail-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .organic-report-columns { grid-template-columns: 1fr; }
        .organic-feed-list button { grid-template-columns: 52px minmax(0,1fr); }
        .organic-feed-list button > b { grid-column: 2; justify-self: start; }
      }
    `}</style>
  )
}
