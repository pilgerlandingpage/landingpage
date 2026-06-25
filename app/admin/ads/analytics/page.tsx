'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  ExternalLink,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react'
import AdminLoadingState from '@/components/admin/AdminLoadingState'

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

const numberFormatter = new Intl.NumberFormat('pt-BR')
const percentFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function formatNumber(value: number | null | undefined) {
  return numberFormatter.format(Number(value || 0))
}

function formatPercent(value: number | null | undefined) {
  return `${percentFormatter.format(Number(value || 0))}%`
}

function MetricCard({ label, value, helper, icon }: { label: string; value: string; helper: string; icon: React.ReactNode }) {
  return (
    <div className="analytics-card">
      <div className="analytics-card-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="analytics-empty">{message}</div>
}

export default function GoogleAnalyticsPage() {
  const [days, setDays] = useState(28)
  const [payload, setPayload] = useState<AnalyticsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = async (selectedDays = days) => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/ads/google-analytics?days=${selectedDays}`, { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.success === false) {
        throw new Error(data.error || data.message || 'Nao foi possivel carregar Google Analytics.')
      }
      setPayload(data)
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar Google Analytics.')
      setPayload(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData(days)
  }, [days])

  const topChannel = useMemo(() => {
    return [...(payload?.channels || [])].sort((a, b) => b.sessions - a.sessions)[0]
  }, [payload?.channels])

  if (loading && !payload) return <AdminLoadingState message="Carregando Google Analytics..." />

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>Google Analytics</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '4px' }}>
            GA4 e Search Console dentro do ambiente de Trafego IA.
          </p>
        </div>
        <div className="analytics-actions">
          <select
            value={days}
            onChange={event => setDays(Number(event.target.value))}
            className="form-input"
            style={{ width: 150 }}
          >
            <option value={7}>Ultimos 7 dias</option>
            <option value={28}>Ultimos 28 dias</option>
            <option value={90}>Ultimos 90 dias</option>
          </select>
          <button className="btn" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Atualizar
          </button>
        </div>
      </div>

      {error && <div className="analytics-warning">{error}</div>}

      {payload && !payload.configured ? (
        <div className="chart-card analytics-setup">
          <Search size={28} />
          <h2>Google Analytics ainda nao configurado</h2>
          <p>{payload.message || 'Configure o GA4 e a service account na Sala de Manutencao.'}</p>
          <Link href="/admin/maintenance" className="btn btn-gold">Abrir Sala de Manutencao</Link>
        </div>
      ) : payload ? (
        <>
          <section className="analytics-grid">
            <MetricCard
              label="Sessoes organicas"
              value={formatNumber(payload.summary?.organicSessions)}
              helper={`${formatPercent(payload.summary?.organicShare)} do trafego total`}
              icon={<Search size={20} />}
            />
            <MetricCard
              label="Usuarios organicos"
              value={formatNumber(payload.summary?.organicUsers)}
              helper="Usuarios vindos de busca"
              icon={<Users size={20} />}
            />
            <MetricCard
              label="Visualizacoes organicas"
              value={formatNumber(payload.summary?.organicViews)}
              helper="Paginas vistas no organico"
              icon={<BarChart3 size={20} />}
            />
            <MetricCard
              label="Conversoes organicas"
              value={formatNumber(payload.summary?.organicConversions)}
              helper="Conversoes registradas no GA4"
              icon={<TrendingUp size={20} />}
            />
          </section>

          <section className="analytics-board">
            <div className="chart-card analytics-panel">
              <div className="analytics-section-title">
                <div>
                  <span><Activity size={16} /> Canais GA4</span>
                  <h2>Origem do trafego</h2>
                </div>
                {topChannel && <strong>{topChannel.channel}: {formatNumber(topChannel.sessions)} sessoes</strong>}
              </div>
              <div className="analytics-table">
                {(payload.channels || []).length === 0 ? <EmptyState message="Nenhum canal retornado pelo GA4." /> : payload.channels.map(row => (
                  <div key={row.channel} className="analytics-row">
                    <strong>{row.channel || 'Nao definido'}</strong>
                    <span>{formatNumber(row.sessions)} sessoes</span>
                    <span>{formatNumber(row.users)} usuarios</span>
                    <span>{formatNumber(row.conversions)} conversoes</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="chart-card analytics-panel">
              <div className="analytics-section-title">
                <div>
                  <span><ArrowUpRight size={16} /> Paginas organicas</span>
                  <h2>Entradas por busca</h2>
                </div>
              </div>
              <div className="analytics-table">
                {(payload.landingPages || []).length === 0 ? <EmptyState message="Nenhuma pagina organica no periodo." /> : payload.landingPages.map(row => (
                  <div key={row.page} className="analytics-row">
                    <strong>{row.page || '/'}</strong>
                    <span>{formatNumber(row.sessions)} sessoes</span>
                    <span>{formatNumber(row.views)} views</span>
                    <span>{formatNumber(row.conversions)} conv.</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="analytics-board">
            <div className="chart-card analytics-panel">
              <div className="analytics-section-title">
                <div>
                  <span><Search size={16} /> Search Console</span>
                  <h2>Buscas que encontram o site</h2>
                </div>
                {payload.searchConsole?.error && <strong className="analytics-error-pill">Search Console: {payload.searchConsole.error}</strong>}
              </div>
              <div className="analytics-table">
                {!payload.searchConsole?.configured ? (
                  <EmptyState message="Informe o site do Search Console na Sala de Manutencao." />
                ) : payload.searchConsole.queries.length === 0 ? (
                  <EmptyState message="Nenhuma query retornada no periodo." />
                ) : payload.searchConsole.queries.map(row => (
                  <div key={row.label} className="analytics-row">
                    <strong>{row.label}</strong>
                    <span>{formatNumber(row.clicks)} cliques</span>
                    <span>{formatNumber(row.impressions)} impressoes</span>
                    <span>pos. {row.position.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="chart-card analytics-panel">
              <div className="analytics-section-title">
                <div>
                  <span><ExternalLink size={16} /> Fontes organicas</span>
                  <h2>Source / medium</h2>
                </div>
              </div>
              <div className="analytics-table">
                {(payload.sourceMedium || []).length === 0 ? <EmptyState message="Nenhuma fonte organica retornada." /> : payload.sourceMedium.map(row => (
                  <div key={row.sourceMedium} className="analytics-row">
                    <strong>{row.sourceMedium || 'Nao definido'}</strong>
                    <span>{formatNumber(row.sessions)} sessoes</span>
                    <span>{formatNumber(row.users)} usuarios</span>
                    <span>{formatNumber(row.conversions)} conv.</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="analytics-footnote">
            Propriedade GA4: {payload.propertyId || '-'} {payload.period ? `| ${payload.period.startDate} ate ${payload.period.endDate}` : ''}
          </div>
        </>
      ) : null}

      <style jsx>{`
        .analytics-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .analytics-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 16px;
        }

        .analytics-card {
          border: 1px solid var(--border-color);
          border-radius: 10px;
          padding: 16px;
          background: #fff;
          display: grid;
          gap: 6px;
          min-height: 136px;
        }

        .analytics-card-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(201, 169, 110, .18);
          color: var(--gold-dark);
          display: grid;
          place-items: center;
        }

        .analytics-card span,
        .analytics-section-title span {
          color: var(--text-muted);
          font-size: .76rem;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .analytics-card strong {
          font-size: 2rem;
          line-height: 1;
          color: var(--text-primary);
        }

        .analytics-card small,
        .analytics-footnote {
          color: var(--text-muted);
          font-size: .84rem;
        }

        .analytics-board {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 16px;
        }

        .analytics-panel {
          min-height: 360px;
        }

        .analytics-section-title {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 14px;
        }

        .analytics-section-title h2 {
          margin: 4px 0 0;
          font-size: 1.35rem;
        }

        .analytics-section-title span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .analytics-section-title > strong {
          border: 1px solid rgba(201, 169, 110, .3);
          background: rgba(201, 169, 110, .08);
          border-radius: 999px;
          padding: 8px 10px;
          font-size: .78rem;
          color: var(--gold-dark);
          white-space: nowrap;
        }

        .analytics-table {
          display: grid;
          gap: 8px;
        }

        .analytics-row {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) repeat(3, minmax(88px, .5fr));
          gap: 10px;
          align-items: center;
          border: 1px solid var(--border-color);
          border-radius: 9px;
          padding: 11px 12px;
          background: var(--bg-secondary);
        }

        .analytics-row strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--text-primary);
        }

        .analytics-row span {
          color: var(--text-muted);
          font-size: .84rem;
          text-align: right;
        }

        .analytics-empty,
        .analytics-warning,
        .analytics-setup {
          border: 1px dashed var(--border-color);
          border-radius: 12px;
          padding: 22px;
          color: var(--text-muted);
          text-align: center;
        }

        .analytics-warning {
          border-color: rgba(239, 68, 68, .35);
          background: rgba(239, 68, 68, .05);
          color: #b91c1c;
          margin-bottom: 16px;
        }

        .analytics-setup {
          display: grid;
          justify-items: center;
          gap: 12px;
        }

        .analytics-error-pill {
          border-color: rgba(239, 68, 68, .28) !important;
          color: #b91c1c !important;
          background: rgba(239, 68, 68, .05) !important;
          white-space: normal !important;
          text-align: right;
        }

        @media (max-width: 1100px) {
          .analytics-grid,
          .analytics-board {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .analytics-row {
            grid-template-columns: 1fr;
          }

          .analytics-row span {
            text-align: left;
          }
        }
      `}</style>
    </div>
  )
}
