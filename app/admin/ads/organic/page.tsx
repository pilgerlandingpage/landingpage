'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  BarChart3,
  Bookmark,
  ExternalLink,
  Eye,
  Flame,
  Heart,
  Instagram,
  Lightbulb,
  MessageCircle,
  Play,
  RefreshCw,
  Share2,
  Sparkles,
  Trophy,
  TrendingUp,
  Users,
} from 'lucide-react'
import AdminLoadingState from '@/components/admin/AdminLoadingState'
import OrganicTrafficManagerView from '@/components/admin/OrganicTrafficManagerView'
import {
  SimpleBarChart,
  SimpleDonutChart,
  SimpleLineChart,
} from '@/components/admin/SimpleCharts'

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

type PlatformKey = 'instagram' | 'facebook'

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

const PLATFORM_META: Record<PlatformKey, { label: string; endpoint: string; fallback: string; icon: ReactNode }> = {
  instagram: { label: 'Instagram', endpoint: '/api/instagram', fallback: 'guilhermepilger', icon: <Instagram size={16} /> },
  facebook: { label: 'Facebook', endpoint: '/api/facebook', fallback: 'Guilherme Pilger', icon: <Share2 size={16} /> },
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

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function mediaTitle(media: OrganicMedia) {
  const firstLine = media.caption?.split('\n').find(Boolean)?.trim()
  return firstLine || media.media_product_type || media.media_type || 'Publicacao'
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

function formatShort(value: number) {
  return compact.format(value || 0)
}

function formatPercentValue(value: number) {
  return `${percent.format(value)}%`
}

function shortTitle(value: string, max = 18) {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value
}

function formatDateOnly(value: string | null | undefined) {
  if (!value) return '-'
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
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

function MetricCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string
  value: number
  helper: string
  icon: ReactNode
}) {
  return (
    <div className="kpi-card">
      <div style={{ color: 'var(--gold)', marginBottom: 8 }}>{icon}</div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{compact.format(value)}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>{helper}</div>
    </div>
  )
}

export default function OrganicTrafficPage() {
  const [platform, setPlatform] = useState<PlatformKey>('instagram')
  const [data, setData] = useState<Record<PlatformKey, OrganicPayload | null>>({
    instagram: null,
    facebook: null,
  })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<Record<PlatformKey, string>>({
    instagram: '',
    facebook: '',
  })
  const [reports, setReports] = useState<OrganicAiReport[]>([])
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')

  const activeData = data[platform]
  const activeMeta = PLATFORM_META[platform]
  const latestReport = reports[0] || null

  const combinedTotals = useMemo(() => {
    const sources = [data.instagram, data.facebook].filter(Boolean) as OrganicPayload[]
    return sources.reduce(
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
      { followers: 0, media: 0, reach: 0, views: 0, totalInteractions: 0, likes: 0, comments: 0, saved: 0, shares: 0 },
    )
  }, [data.facebook, data.instagram])

  const allMedia = useMemo<EnrichedMedia[]>(() => {
    return [
      ...(data.instagram?.media || []).map(item => ({ ...item, platform: 'instagram' as const })),
      ...(data.facebook?.media || []).map(item => ({ ...item, platform: 'facebook' as const })),
    ].sort((a, b) => mediaScore(b) - mediaScore(a))
  }, [data.facebook, data.instagram])

  const topOverallMedia = useMemo(() => allMedia.slice(0, 5), [allMedia])
  const bestPost = topOverallMedia[0]
  const bestPostScore = bestPost ? mediaScore(bestPost) : 0
  const activeMediaChronological = useMemo(() => {
    return [...(activeData?.media || [])]
      .sort((a, b) => new Date(a.published_at || '').getTime() - new Date(b.published_at || '').getTime())
  }, [activeData])
  const activeFollowers = activeData?.totals.followers || 0
  const activeEngagementRate = activeFollowers > 0
    ? ((activeData?.totals.totalInteractions || 0) / activeFollowers) * 100
    : 0
  const averageScore = activeData?.media.length
    ? Math.round(activeData.media.reduce((sum, item) => sum + mediaScore(item), 0) / activeData.media.length)
    : 0
  const momentum = useMemo(() => {
    const rows = activeMediaChronological
    if (rows.length < 2) return { direction: 'flat' as const, percent: 0, current: 0, previous: 0 }
    const midpoint = Math.max(1, Math.floor(rows.length / 2))
    const previousRows = rows.slice(0, midpoint)
    const currentRows = rows.slice(midpoint)
    const previous = previousRows.reduce((sum, item) => sum + mediaScore(item), 0) / Math.max(previousRows.length, 1)
    const current = currentRows.reduce((sum, item) => sum + mediaScore(item), 0) / Math.max(currentRows.length, 1)
    return { ...getTrend(current, previous), current, previous }
  }, [activeMediaChronological])
  const lineData = useMemo(() => {
    return activeMediaChronological.map((item, index) => ({
      label: `${index + 1}`,
      Performance: mediaScore(item),
      Views: item.views || 0,
      Interacoes: item.total_interactions || item.like_count + item.comments_count + item.shares,
    }))
  }, [activeMediaChronological])
  const barData = useMemo(() => {
    return [...(activeData?.media || [])]
      .sort((a, b) => mediaScore(b) - mediaScore(a))
      .slice(0, 7)
      .map(item => ({
        name: shortTitle(mediaTitle(item), 20),
        value: mediaScore(item),
      }))
  }, [activeData])
  const donutData = useMemo(() => {
    const totals = activeData?.totals
    if (!totals) return []
    return [
      { name: 'Views', value: totals.views || 0 },
      { name: 'Alcance', value: totals.reach || 0 },
      { name: 'Interacoes', value: totals.totalInteractions || 0 },
      { name: 'Comentarios', value: totals.comments || 0 },
      { name: 'Compart.', value: totals.shares || 0 },
    ].filter(item => item.value > 0)
  }, [activeData])
  const networkBarData = useMemo(() => {
    return (Object.keys(PLATFORM_META) as PlatformKey[]).map(key => ({
      name: PLATFORM_META[key].label,
      value: data[key]?.totals.followers || 0,
    }))
  }, [data])
  const bestPlatform = (data.instagram?.totals.followers || 0) >= (data.facebook?.totals.followers || 0)
    ? 'Instagram'
    : 'Facebook'

  const recommendations = useMemo(() => {
    const rows = []
    if (bestPost) {
      rows.push({
        title: 'Conteudo com potencial de impulso',
        text: `${PLATFORM_META[bestPost.platform].label}: "${mediaTitle(bestPost)}" concentra os melhores sinais organicos recentes.`,
      })
    }
    if ((data.instagram?.reels.length || 0) > 0) {
      rows.push({
        title: 'Reels seguem como formato prioritario',
        text: `Existem ${data.instagram?.reels.length || 0} Reels recentes no Instagram para comparar ganchos, temas e formatos com melhor resposta.`,
      })
    }
    if ((data.facebook?.totals.followers || 0) > 0) {
      rows.push({
        title: 'Facebook ja esta conectado ao funil organico',
        text: `A pagina soma ${compact.format(data.facebook?.totals.followers || 0)} seguidores e agora entra no mesmo acompanhamento do Instagram.`,
      })
    }
    if (momentum.direction === 'down') {
      rows.push({
        title: 'Atenção ao ritmo recente',
        text: `A performance media caiu ${formatPercentValue(Math.abs(momentum.percent))}. Vale revisar gancho, thumbnail e tema dos ultimos conteudos.`,
      })
    } else if (momentum.direction === 'up') {
      rows.push({
        title: 'Ritmo recente em alta',
        text: `A performance media subiu ${formatPercentValue(Math.abs(momentum.percent))}. Este padrao merece virar roteiro recorrente no organico.`,
      })
    }
    return rows.slice(0, 3)
  }, [bestPost, data.facebook, data.instagram, momentum.direction, momentum.percent])

  const topMedia = useMemo(() => {
    return [...(activeData?.media || [])]
      .sort((a, b) => mediaScore(b) - mediaScore(a))
      .slice(0, 8)
  }, [activeData])

  const loadPlatform = async (target: PlatformKey, force = false) => {
    setError(prev => ({ ...prev, [target]: '' }))
    const meta = PLATFORM_META[target]
    const response = await fetch(`${meta.endpoint}?limit=12${force ? '&force=1' : ''}`)
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || `Erro ao carregar ${meta.label}.`)
    setData(prev => ({ ...prev, [target]: payload }))
  }

  const loadReports = async () => {
    try {
      setReportError('')
      const response = await fetch('/api/admin/organic-social/report?limit=5')
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Erro ao carregar relatorios da IA.')
      setReports(payload.reports || [])
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Erro ao carregar relatorios da IA.')
    }
  }

  const generateReport = async () => {
    setReportLoading(true)
    setReportError('')

    try {
      const response = await fetch('/api/admin/organic-social/report?days=30', { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Erro ao gerar relatorio organico.')
      await loadReports()
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Erro ao gerar relatorio organico.')
    } finally {
      setReportLoading(false)
    }
  }

  const fetchData = async (force = false, target: PlatformKey | 'all' = 'all') => {
    if (force) setSyncing(true)

    try {
      if (target === 'all') {
        const results = await Promise.allSettled([
          loadPlatform('instagram', force),
          loadPlatform('facebook', force),
        ])

        results.forEach((result, index) => {
          if (result.status === 'fulfilled') return
          const key = index === 0 ? 'instagram' : 'facebook'
          setError(prev => ({ ...prev, [key]: result.reason instanceof Error ? result.reason.message : 'Erro ao carregar trafego organico.' }))
        })
      } else {
        await loadPlatform(target, force)
      }
    } catch (err) {
      if (target !== 'all') {
        setError(prev => ({ ...prev, [target]: err instanceof Error ? err.message : 'Erro ao carregar trafego organico.' }))
      }
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }

  useEffect(() => {
    fetchData()
    loadReports()
  }, [])

  if (loading) return <AdminLoadingState message="Carregando trafego organico..." />

  if (process.env.NEXT_PUBLIC_ORGANIC_TRAFFIC_MANAGER_LAYOUT !== 'legacy') {
    return (
      <OrganicTrafficManagerView
        platform={platform}
        data={data}
        reports={reports}
        syncing={syncing}
        reportLoading={reportLoading}
        reportError={reportError}
        error={error}
        onPlatformChange={setPlatform}
        onSync={fetchData}
        onGenerateReport={generateReport}
      />
    )
  }

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Instagram size={26} /> Central de Trafego Organico
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
            Instagram + Facebook em uma leitura organica. {activeMeta.label}: {activeData?.profile?.username ? `@${activeData.profile.username}` : activeData?.profile?.display_name || activeMeta.fallback} | Atualizado em {formatDate(activeData?.syncedAt || activeData?.profile?.last_synced_at)}
          </p>
        </div>
        <div className="organic-header-actions">
          <button
            type="button"
            onClick={generateReport}
            disabled={reportLoading}
            className="btn"
            style={{
              background: '#17120c',
              border: '1px solid rgba(201, 169, 110, .45)',
              color: '#fffaf0',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Sparkles size={18} className={reportLoading ? 'spin' : ''} />
            {reportLoading ? 'Gerando IA...' : 'Gerar relatorio IA'}
          </button>
          <button
            type="button"
            onClick={() => fetchData(true, platform)}
            disabled={syncing}
            className="btn"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <RefreshCw size={18} className={syncing ? 'spin' : ''} />
            {syncing ? 'Sincronizando...' : `Sincronizar ${activeMeta.label}`}
          </button>
          <button
            type="button"
            onClick={() => fetchData(true, 'all')}
            disabled={syncing}
            className="btn btn-gold"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <RefreshCw size={18} className={syncing ? 'spin' : ''} />
            Tudo
          </button>
        </div>
      </div>

      <div className="organic-executive-grid">
        <div className="organic-command-card organic-command-main">
          <div className="organic-card-eyebrow"><BarChart3 size={15} /> Visao organica</div>
          <h2>{compact.format(combinedTotals.reach || 0)} pessoas alcancadas</h2>
          <p>
            Este painel acompanha somente sinais organicos: conteudo, audiencia, alcance, views,
            interacoes e oportunidades para melhorar a producao de conteudo.
          </p>
          <div className="organic-command-metrics">
            <span><Eye size={14} /> {compact.format(combinedTotals.reach)} alcance</span>
            <span><Play size={14} /> {compact.format(combinedTotals.views)} views</span>
            <span><Heart size={14} /> {compact.format(combinedTotals.totalInteractions)} interacoes</span>
          </div>
        </div>

        <div className="organic-command-card">
          <div className="organic-card-eyebrow"><Users size={15} /> Base organica</div>
          <h3>{compact.format(combinedTotals.followers)}</h3>
          <p>{bestPlatform} lidera a base atual entre as redes conectadas.</p>
          <strong>{compact.format(combinedTotals.media)} midias</strong>
        </div>

        <div className="organic-command-card">
          <div className="organic-card-eyebrow"><Flame size={15} /> Conteudo quente</div>
          <h3>{bestPost ? PLATFORM_META[bestPost.platform].label : '-'}</h3>
          <p>{bestPost ? mediaTitle(bestPost) : 'Sincronize para gerar leitura.'}</p>
          <strong>{bestPost ? compact.format(mediaScore(bestPost)) : '-'}</strong>
        </div>
      </div>

      <div className="chart-card organic-report-card">
        <div className="organic-section-title">
          <div>
            <span>Agente organico IA</span>
            <h2><Sparkles size={18} /> Relatorio de performance</h2>
          </div>
          <button
            type="button"
            onClick={generateReport}
            disabled={reportLoading}
            className="btn btn-gold organic-report-button"
          >
            <Sparkles size={16} className={reportLoading ? 'spin' : ''} />
            {reportLoading ? 'Analisando...' : 'Nova analise'}
          </button>
        </div>
        {reportError && <div className="organic-report-error">{reportError}</div>}
        {latestReport ? (
          <div className="organic-report-content">
            <div className="organic-report-summary">
              <div className="organic-report-date">
                {formatDateOnly(latestReport.period_start)} a {formatDateOnly(latestReport.period_end)}
              </div>
              <h3>{latestReport.title}</h3>
              <p>{latestReport.summary}</p>
            </div>
            <div className="organic-report-lists">
              <div>
                <strong>Insights</strong>
                {(latestReport.insights || []).slice(0, 3).map((item, index) => (
                  <div key={`insight-${index}`} className="organic-report-note">
                    <span>{item.impact || 'leitura'}</span>
                    <b>{item.title || 'Insight'}</b>
                    <p>{item.detail || '-'}</p>
                  </div>
                ))}
              </div>
              <div>
                <strong>Acoes recomendadas</strong>
                {(latestReport.recommendations || []).slice(0, 3).map((item, index) => (
                  <div key={`recommendation-${index}`} className="organic-report-note">
                    <span>{item.priority || 'prioridade'}</span>
                    <b>{item.title || 'Acao'}</b>
                    <p>{item.action || '-'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="organic-empty-state">
            Gere o primeiro relatorio para a IA cruzar conteudos, sinais de lead e criativos em preparo.
          </div>
        )}
      </div>

      <div className="organic-dashboard-grid">
        <div className="chart-card organic-ranking-card">
          <div className="organic-section-title">
            <div>
              <span>Ranking geral</span>
              <h2><Trophy size={18} /> Conteudos para analisar</h2>
            </div>
            <strong>{topOverallMedia.length} itens</strong>
          </div>
          <div className="organic-ranking-list">
            {topOverallMedia.map((item, index) => (
              <a key={`${item.platform}-${item.id}`} href={item.permalink || '#'} target="_blank" rel="noreferrer" className="organic-ranking-row">
                <div className="organic-ranking-index">{index + 1}</div>
                <div>
                  <strong>{mediaTitle(item)}</strong>
                  <span>{PLATFORM_META[item.platform].label} | {formatDate(item.published_at)}</span>
                </div>
                <div className="organic-ranking-score">
                  <strong>{compact.format(mediaScore(item))}</strong>
                  <span>sinal</span>
                </div>
              </a>
            ))}
            {topOverallMedia.length === 0 && (
              <div className="organic-empty-state">Nenhum conteudo sincronizado ainda.</div>
            )}
          </div>
        </div>

        <div className="chart-card organic-ai-card">
          <div className="organic-section-title">
            <div>
              <span>Leitura IA</span>
              <h2><Lightbulb size={18} /> Proximas acoes</h2>
            </div>
          </div>
          <div className="organic-recommendation-list">
            {recommendations.map(item => (
              <div key={item.title} className="organic-recommendation-item">
                <strong>{item.title}</strong>
                <p>{item.text}</p>
              </div>
            ))}
            {recommendations.length === 0 && (
              <div className="organic-empty-state">Sincronize as redes para gerar recomendacoes.</div>
            )}
          </div>
        </div>
      </div>

      <div className="organic-meta-board">
        <div className="organic-meta-tile">
          <span>Alcance organico</span>
          <strong>{compact.format(combinedTotals.reach)}</strong>
          <small>Instagram + Facebook</small>
        </div>
        <div className="organic-meta-tile">
          <span>Views organicas</span>
          <strong>{compact.format(combinedTotals.views)}</strong>
          <small>Videos e midias recentes</small>
        </div>
        <div className="organic-meta-tile">
          <span>Interacoes</span>
          <strong>{compact.format(combinedTotals.totalInteractions)}</strong>
          <small>Curtidas, comentarios e acoes</small>
        </div>
        <div className="organic-meta-tile">
          <span>Base organica</span>
          <strong>{compact.format(combinedTotals.followers)}</strong>
          <small>{bestPlatform} lidera</small>
        </div>
      </div>

      <div className="organic-platform-tabs">
        {(Object.keys(PLATFORM_META) as PlatformKey[]).map(key => (
          <button
            key={key}
            type="button"
            className={platform === key ? 'active' : ''}
            onClick={() => setPlatform(key)}
          >
            {PLATFORM_META[key].icon}
            <span>{PLATFORM_META[key].label}</span>
            <strong>{compact.format(data[key]?.totals.followers || 0)}</strong>
          </button>
        ))}
      </div>

      {(error[platform] || activeData?.warning) && (
        <div
          className="chart-card"
          style={{
            marginBottom: 18,
            borderColor: error[platform] ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.35)',
            color: error[platform] ? '#ef4444' : '#f59e0b',
          }}
        >
          {error[platform] || activeData?.warning}
        </div>
      )}

      <div className="kpi-grid ads-kpi-grid" style={{ marginBottom: 24 }}>
        <MetricCard label="Seguidores" value={activeData?.totals.followers || 0} helper="Base organica atual" icon={<TrendingUp size={20} />} />
        <MetricCard label="Midias" value={activeData?.totals.media || 0} helper="Publicacoes no perfil" icon={<Instagram size={20} />} />
        <MetricCard label="Alcance" value={activeData?.totals.reach || 0} helper="Ultimas midias sincronizadas" icon={<Eye size={20} />} />
        <MetricCard label="Views" value={activeData?.totals.views || 0} helper="Videos recentes" icon={<Play size={20} />} />
        <MetricCard label="Interacoes" value={activeData?.totals.totalInteractions || 0} helper="Curtidas, comentarios e acoes" icon={<Heart size={20} />} />
      </div>

      <div className="organic-performance-grid">
        <div className="chart-card organic-chart-card organic-chart-wide">
          <div className="organic-section-title">
            <div>
              <span>Subida e descida</span>
              <h2><TrendingUp size={18} /> Performance por publicacao</h2>
            </div>
            <div className={`organic-trend-pill ${momentum.direction}`}>
              {momentum.direction === 'up' ? 'Subindo' : momentum.direction === 'down' ? 'Descendo' : 'Estavel'}
              <strong>{formatPercentValue(Math.abs(momentum.percent))}</strong>
            </div>
          </div>
          <SimpleLineChart
            data={lineData}
            height={310}
            valueFormatter={formatShort}
            series={[
              { key: 'Performance', name: 'Performance', color: '#c9a96e' },
              { key: 'Views', name: 'Views', color: '#38bdf8' },
              { key: 'Interacoes', name: 'Interacoes', color: '#22c55e' },
            ]}
          />
        </div>

        <div className="chart-card organic-chart-card">
          <div className="organic-section-title">
            <div>
              <span>Diagnostico</span>
              <h2><BarChart3 size={18} /> Saude da rede</h2>
            </div>
          </div>
          <div className="organic-health-list">
            <div>
              <span>Taxa de interacao</span>
              <strong>{formatPercentValue(activeEngagementRate)}</strong>
              <i style={{ width: `${Math.min(100, activeEngagementRate * 12)}%` }} />
            </div>
            <div>
              <span>Score medio por post</span>
              <strong>{compact.format(averageScore)}</strong>
              <i style={{ width: `${Math.min(100, averageScore / Math.max(bestPostScore, 1) * 100)}%` }} />
            </div>
            <div>
              <span>Conteudos analisados</span>
              <strong>{full.format(activeData?.media.length || 0)}</strong>
              <i style={{ width: `${Math.min(100, ((activeData?.media.length || 0) / 12) * 100)}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="organic-charts-grid">
        <div className="chart-card organic-chart-card">
          <div className="organic-section-title">
            <div>
              <span>Ranking visual</span>
              <h2><Trophy size={18} /> Top conteudos</h2>
            </div>
          </div>
          <SimpleBarChart
            data={barData}
            color="#c9a96e"
            name="Score"
            height={310}
            layout="horizontal"
            valueFormatter={formatShort}
          />
        </div>

        <div className="chart-card organic-chart-card">
          <div className="organic-section-title">
            <div>
              <span>Composicao</span>
              <h2><Flame size={18} /> Sinais organicos</h2>
            </div>
          </div>
          <SimpleDonutChart
            data={donutData}
            colors={['#38bdf8', '#c9a96e', '#22c55e', '#f59e0b', '#8b5cf6']}
            height={310}
            valueFormatter={formatShort}
          />
        </div>

        <div className="chart-card organic-chart-card">
          <div className="organic-section-title">
            <div>
              <span>Base</span>
              <h2><BarChart3 size={18} /> Seguidores por rede</h2>
            </div>
          </div>
          <SimpleBarChart
            data={networkBarData}
            color="#22c55e"
            name="Seguidores"
            height={310}
            valueFormatter={formatShort}
          />
        </div>
      </div>

      <div className="chart-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div>
            <div className="chart-title" style={{ marginBottom: 4 }}>Ultimas publicacoes</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
              Conteudos puxados da Meta Graph API.
            </p>
          </div>
          <strong style={{ color: 'var(--gold)' }}>{activeData?.reels.length || 0} Reels</strong>
        </div>

        <div className="organic-media-grid">
          {topMedia.map(item => (
            <a
              key={item.id}
              href={item.permalink || '#'}
              target="_blank"
              rel="noreferrer"
              className="organic-media-card"
            >
              <div className="organic-media-thumb">
                {item.thumbnail_url || item.media_url ? (
                  <img src={item.thumbnail_url || item.media_url || ''} alt="" />
                ) : (
                  PLATFORM_META[platform].icon
                )}
                <span>{item.media_product_type || item.media_type || 'Midia'}</span>
              </div>
              <div className="organic-media-body">
                <h3>{mediaTitle(item)}</h3>
                <p>{formatDate(item.published_at)}</p>
                <div className="organic-media-metrics">
                  <span><Eye size={13} /> {full.format(item.reach)}</span>
                  <span><Play size={13} /> {full.format(item.views)}</span>
                  <span><Heart size={13} /> {full.format(item.like_count)}</span>
                  <span><MessageCircle size={13} /> {full.format(item.comments_count)}</span>
                  <span><Bookmark size={13} /> {full.format(item.saved)}</span>
                  <span><Share2 size={13} /> {full.format(item.shares)}</span>
                </div>
              </div>
              <ExternalLink size={15} className="organic-media-open" />
            </a>
          ))}
        </div>
      </div>

      <style jsx global>{`
        .organic-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .organic-executive-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(180px, .75fr) minmax(180px, .75fr);
          gap: 14px;
          margin-bottom: 18px;
        }
        .organic-command-card {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(201, 169, 110, .18);
          border-radius: 18px;
          background:
            linear-gradient(145deg, rgba(255,255,255,.96), rgba(248,244,235,.9));
          padding: 20px;
          min-height: 168px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-shadow: 0 22px 60px rgba(15, 23, 42, .07);
        }
        .organic-command-card::after {
          content: '';
          position: absolute;
          inset: auto 16px 0 16px;
          height: 3px;
          border-radius: 999px 999px 0 0;
          background: linear-gradient(90deg, rgba(201,169,110,.15), rgba(201,169,110,.75), rgba(56,189,248,.3));
        }
        .organic-command-main {
          background:
            radial-gradient(circle at top right, rgba(201, 169, 110, .22), transparent 36%),
            linear-gradient(145deg, #17120c, #34291e 52%, #f7f2e8 52%, #fff 100%);
        }
        .organic-command-main .organic-card-eyebrow,
        .organic-command-main h2 {
          color: #fffaf0;
        }
        .organic-command-main p {
          max-width: 620px;
          color: rgba(255, 250, 240, .78);
        }
        .organic-command-main .organic-command-metrics span {
          background: rgba(255, 250, 240, .08);
          border-color: rgba(255, 250, 240, .24);
          color: #fffaf0;
        }
        .organic-card-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--gold);
          font-size: .72rem;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .organic-command-card h2,
        .organic-command-card h3 {
          margin: 10px 0 8px;
          color: var(--text-primary);
          line-height: 1.05;
        }
        .organic-command-card h2 {
          font-size: clamp(1.65rem, 3vw, 2.6rem);
        }
        .organic-command-card h3 {
          font-size: 1.35rem;
        }
        .organic-command-card p {
          margin: 0;
          color: var(--text-muted);
          font-size: .88rem;
          line-height: 1.45;
        }
        .organic-command-card > strong {
          margin-top: 12px;
          color: var(--gold);
          font-size: 1.35rem;
          font-family: Playfair Display, serif;
        }
        .organic-report-card {
          margin-bottom: 18px;
          background:
            radial-gradient(circle at top left, rgba(201, 169, 110, .12), transparent 34%),
            linear-gradient(135deg, #ffffff, #fbfaf7);
        }
        .organic-report-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 38px;
          white-space: nowrap;
        }
        .organic-report-error {
          margin-bottom: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          color: #b91c1c;
          background: rgba(239, 68, 68, .08);
          border: 1px solid rgba(239, 68, 68, .18);
          font-size: .82rem;
          font-weight: 700;
        }
        .organic-report-content {
          display: grid;
          grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr);
          gap: 16px;
          align-items: start;
        }
        .organic-report-summary {
          padding: 16px;
          border-radius: 14px;
          background: #17120c;
          color: #fffaf0;
          min-height: 100%;
        }
        .organic-report-date {
          color: var(--gold);
          font-size: .72rem;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        .organic-report-summary h3 {
          margin: 0 0 10px;
          font-size: 1.24rem;
          line-height: 1.08;
          color: #fffaf0;
        }
        .organic-report-summary p {
          margin: 0;
          color: rgba(255, 250, 240, .78);
          font-size: .88rem;
          line-height: 1.52;
        }
        .organic-report-lists {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .organic-report-lists > div > strong {
          display: block;
          color: var(--text-primary);
          font-size: .85rem;
          margin-bottom: 8px;
        }
        .organic-report-note {
          padding: 12px;
          border: 1px solid rgba(17, 24, 39, .07);
          border-radius: 12px;
          background: rgba(255, 255, 255, .86);
          margin-bottom: 8px;
        }
        .organic-report-note span {
          display: inline-block;
          margin-bottom: 6px;
          color: var(--gold);
          font-size: .64rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .08em;
        }
        .organic-report-note b {
          display: block;
          color: var(--text-primary);
          font-size: .84rem;
          line-height: 1.25;
          margin-bottom: 5px;
        }
        .organic-report-note p {
          margin: 0;
          color: var(--text-muted);
          font-size: .77rem;
          line-height: 1.42;
        }
        .organic-command-metrics {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 16px;
        }
        .organic-command-metrics span {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(201, 169, 110, .24);
          color: var(--text-primary);
          font-size: .78rem;
          font-weight: 700;
        }
        .organic-dashboard-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(280px, .65fr);
          gap: 16px;
          margin-bottom: 18px;
        }
        .organic-dashboard-grid .chart-card,
        .organic-performance-grid .chart-card,
        .organic-charts-grid .chart-card,
        .chart-card:has(.organic-media-grid) {
          border: 1px solid rgba(17, 24, 39, .08);
          border-radius: 18px;
          background: rgba(255,255,255,.9);
          box-shadow: 0 18px 46px rgba(15, 23, 42, .05);
        }
        .organic-meta-board {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }
        .organic-meta-tile {
          position: relative;
          overflow: hidden;
          padding: 16px;
          border-radius: 16px;
          border: 1px solid rgba(201, 169, 110, .16);
          background:
            radial-gradient(circle at top right, rgba(201,169,110,.16), transparent 34%),
            #fff;
          box-shadow: 0 14px 34px rgba(15, 23, 42, .05);
        }
        .organic-meta-tile::before {
          content: '';
          display: block;
          position: absolute;
          left: 0;
          top: 0;
          width: 4px;
          height: 100%;
          background: linear-gradient(180deg, #c9a96e, #22c55e);
        }
        .organic-meta-tile span,
        .organic-meta-tile small {
          display: block;
          color: var(--text-muted);
          font-size: .72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .04em;
        }
        .organic-meta-tile strong {
          display: block;
          color: var(--text-primary);
          font-size: 1.55rem;
          line-height: 1;
          margin: 8px 0 7px;
          font-family: Playfair Display, serif;
        }
        .organic-meta-tile small {
          text-transform: none;
          letter-spacing: 0;
          font-weight: 600;
        }
        .organic-performance-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.45fr) minmax(280px, .55fr);
          gap: 16px;
          margin-bottom: 18px;
        }
        .organic-charts-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        .organic-charts-grid-two {
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        }
        .organic-chart-card {
          overflow: hidden;
        }
        .organic-trend-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 10px;
          border-radius: 999px;
          font-size: .72rem;
          font-weight: 900;
          background: rgba(148, 163, 184, .12);
          color: var(--text-muted);
          white-space: nowrap;
        }
        .organic-trend-pill strong {
          color: inherit;
        }
        .organic-trend-pill.up {
          background: rgba(34, 197, 94, .12);
          color: #22c55e;
        }
        .organic-trend-pill.down {
          background: rgba(239, 68, 68, .12);
          color: #ef4444;
        }
        .organic-health-list {
          display: grid;
          gap: 16px;
          margin-top: 10px;
        }
        .organic-health-list div {
          display: grid;
          gap: 7px;
        }
        .organic-health-list span {
          color: var(--text-muted);
          font-size: .76rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .04em;
        }
        .organic-health-list strong {
          color: var(--text-primary);
          font-size: 1.35rem;
          font-family: Playfair Display, serif;
        }
        .organic-health-list div::after {
          content: '';
          display: block;
          width: 100%;
          height: 8px;
          border-radius: 999px;
          background: rgba(148, 163, 184, .15);
          grid-row: 3;
        }
        .organic-health-list i {
          display: block;
          height: 8px;
          border-radius: 999px;
          background: linear-gradient(90deg, #c9a96e, #22c55e);
          margin-top: -15px;
          position: relative;
          z-index: 1;
        }
        .organic-section-title {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }
        .organic-section-title span {
          display: block;
          color: var(--gold);
          font-size: .68rem;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .organic-section-title h2 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          color: var(--text-primary);
          font-size: 1.05rem;
        }
        .organic-section-title > strong {
          color: var(--text-muted);
          font-size: .78rem;
        }
        .organic-ranking-list,
        .organic-recommendation-list {
          display: grid;
          gap: 9px;
        }
        .organic-ranking-row {
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          padding: 11px;
          border-radius: 12px;
          border: 1px solid rgba(17, 24, 39, .07);
          background: linear-gradient(135deg, rgba(255,255,255,.96), rgba(248,250,252,.88));
          color: var(--text-primary);
          text-decoration: none;
        }
        .organic-ranking-row:hover {
          border-color: var(--gold);
        }
        .organic-ranking-index {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: rgba(201, 169, 110, .12);
          color: var(--gold);
          font-weight: 900;
        }
        .organic-ranking-row strong {
          display: block;
          color: var(--text-primary);
          font-size: .88rem;
          line-height: 1.25;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .organic-ranking-row span {
          color: var(--text-muted);
          font-size: .72rem;
        }
        .organic-ranking-score {
          text-align: right;
        }
        .organic-ranking-score strong {
          color: var(--gold);
          font-size: .94rem;
        }
        .organic-recommendation-item {
          padding: 13px;
          border-radius: 12px;
          border: 1px solid rgba(201, 169, 110, .22);
          background:
            linear-gradient(135deg, rgba(201, 169, 110, .11), rgba(255,255,255,.72));
        }
        .organic-recommendation-item strong {
          display: block;
          color: var(--text-primary);
          font-size: .88rem;
          margin-bottom: 6px;
        }
        .organic-recommendation-item p {
          margin: 0;
          color: var(--text-muted);
          font-size: .8rem;
          line-height: 1.45;
        }
        .organic-empty-state {
          padding: 18px;
          border: 1px dashed var(--border-color);
          border-radius: 12px;
          color: var(--text-muted);
          text-align: center;
          font-size: .84rem;
        }
        .organic-platform-tabs {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }
        .organic-platform-tabs button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 44px;
          border-radius: 12px;
          border: 1px solid var(--border-color);
          background: #fff;
          color: var(--text-primary);
          cursor: pointer;
          font-weight: 800;
          letter-spacing: .02em;
          box-shadow: 0 10px 26px rgba(15, 23, 42, .04);
        }
        .organic-platform-tabs button.active {
          border-color: var(--gold);
          color: var(--gold);
          box-shadow: 0 10px 30px rgba(201, 169, 110, .12);
        }
        .organic-platform-tabs strong {
          margin-left: 4px;
          color: var(--text-muted);
          font-size: .78rem;
        }
        .organic-media-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 14px;
        }
        .organic-media-card {
          position: relative;
          display: grid;
          grid-template-columns: 96px minmax(0, 1fr);
          gap: 12px;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid var(--border-color);
          background: #fff;
          color: var(--text-primary);
          text-decoration: none;
          transition: border-color .2s, transform .15s;
        }
        .organic-media-card:hover {
          border-color: var(--gold);
          transform: translateY(-1px);
        }
        .organic-media-thumb {
          position: relative;
          width: 96px;
          aspect-ratio: 1 / 1;
          border-radius: 10px;
          overflow: hidden;
          display: grid;
          place-items: center;
          color: var(--gold);
          background: rgba(201, 169, 110, 0.08);
        }
        .organic-media-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .organic-media-thumb span {
          position: absolute;
          left: 6px;
          bottom: 6px;
          padding: 2px 6px;
          border-radius: 999px;
          background: rgba(0, 0, 0, .72);
          color: #fff;
          font-size: .58rem;
          font-weight: 800;
          letter-spacing: .04em;
          text-transform: uppercase;
        }
        .organic-media-body {
          min-width: 0;
          padding-right: 14px;
        }
        .organic-media-body h3 {
          margin: 0 0 6px;
          font-size: .9rem;
          line-height: 1.25;
          color: var(--text-primary);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .organic-media-body p {
          margin: 0 0 10px;
          font-size: .72rem;
          color: var(--text-muted);
        }
        .organic-media-metrics {
          display: flex;
          flex-wrap: wrap;
          gap: 6px 10px;
          font-size: .72rem;
          color: var(--text-muted);
        }
        .organic-media-metrics span {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .organic-media-open {
          position: absolute;
          right: 10px;
          top: 10px;
          color: var(--text-muted);
        }
        @media (max-width: 720px) {
          .organic-executive-grid,
          .organic-dashboard-grid,
          .organic-performance-grid,
          .organic-charts-grid,
          .organic-charts-grid-two,
          .organic-meta-board {
            grid-template-columns: 1fr;
          }
          .organic-command-card {
            min-height: auto;
          }
          .organic-header-actions {
            width: 100%;
          }
          .organic-header-actions .btn {
            flex: 1;
            justify-content: center;
          }
          .organic-command-metrics {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .organic-command-metrics span {
            justify-content: center;
            padding: 6px;
            font-size: .64rem;
          }
          .organic-ranking-row {
            grid-template-columns: 30px minmax(0, 1fr);
          }
          .organic-ranking-score {
            grid-column: 2;
            text-align: left;
          }
          .organic-media-grid {
            grid-template-columns: 1fr;
          }
          .organic-media-card {
            grid-template-columns: 86px minmax(0, 1fr);
          }
          .organic-media-thumb {
            width: 86px;
          }
          .organic-report-content,
          .organic-report-lists {
            grid-template-columns: 1fr;
          }
          .organic-report-button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}
