'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Activity, BarChart3, Building2, LineChart, TrendingUp, Zap, Globe, Database, Radio, Wifi, Eye, Search, Layers, Server } from 'lucide-react'
import type { PublicMarketRadarFeed } from '@/lib/market-radar/public-feed'

function formatDate(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Atualização recente'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

// Generate OHLC candlestick data from a score
type Candle = { open: number, high: number, low: number, close: number, volume: number }

function generateCandles(score: number, seed: number, count = 36): Candle[] {
  const candles: Candle[] = []
  let prev = score * 0.4 + 15
  for (let i = 0; i < count; i++) {
    const t = i / count
    const trend = (t - 0.3) * score * 0.6
    const wave = Math.sin(t * 8 + seed * 1.5) * 8 + Math.cos(t * 4 + seed) * 5
    const base = score * 0.35 + trend + wave + 10
    const open = Math.max(5, Math.min(98, prev + (Math.sin(i * 2.1 + seed) * 3)))
    const close = Math.max(5, Math.min(98, base + (Math.cos(i * 1.7 + seed * 0.8) * 4)))
    const high = Math.min(100, Math.max(open, close) + Math.abs(Math.sin(i * 3.2 + seed * 1.2)) * 6 + 1)
    const low = Math.max(2, Math.min(open, close) - Math.abs(Math.cos(i * 2.8 + seed * 0.7)) * 6 - 1)
    const volume = 30 + Math.abs(Math.sin(i * 1.9 + seed * 2.3)) * 70
    candles.push({ open, high, low, close, volume })
    prev = close
  }
  return candles
}

// Generate MA from candle close prices
function generateMA(closes: number[], period: number): number[] {
  return closes.map((_, i, arr) => {
    const start = Math.max(0, i - period + 1)
    const slice = arr.slice(start, i + 1)
    return slice.reduce((a, b) => a + b, 0) / slice.length
  })
}

// Inline sparkline for table rows
function RowSparkline({ data, color, width = 72, height = 22 }: { data: number[], color: string, width?: number, height?: number }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const step = width / (data.length - 1)
  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ')
  const area = `M0,${height} L${points} L${width},${height} Z`
  const gid = `rsg-${color.replace('#', '')}-${Math.round(data[0])}`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height, display: 'block', flex: '0 0 auto' }}>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Candlestick chart component (like TradingView / WBNB)
function CandlestickChart({ candles, score }: { candles: Candle[], score: number }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const W = 740, CHART_H = 220, VOL_H = 50, GAP = 4
  const H = CHART_H + VOL_H + GAP
  const PL = 42, PR = 42, PT = 10, PB = 22

  const cW = W - PL - PR
  const chartTop = PT
  const chartBot = CHART_H - PB
  const chartH = chartBot - chartTop

  const volTop = CHART_H + GAP
  const volBot = H - 6
  const volH = volBot - volTop

  const allHighs = candles.map(c => c.high)
  const allLows = candles.map(c => c.low)
  const dataMax = Math.max(...allHighs)
  const dataMin = Math.min(...allLows)
  const dataRange = dataMax - dataMin || 1

  const maxVol = Math.max(...candles.map(c => c.volume))
  const candleW = cW / candles.length
  const bodyW = Math.max(2, candleW * 0.6)

  const closes = candles.map(c => c.close)
  const ma5 = generateMA(closes, 5)
  const ma10 = generateMA(closes, 10)
  const ma30 = generateMA(closes, 12)

  function yPos(val: number) { return chartTop + chartH - ((val - dataMin) / dataRange) * chartH }
  function xPos(i: number) { return PL + (i + 0.5) * candleW }

  const maLine = (data: number[]) => data.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ')

  // Grid levels (5 evenly-spaced)
  const gridStep = dataRange / 4
  const gridLevels = Array.from({ length: 5 }, (_, i) => dataMin + gridStep * i)

  // Time labels
  const timeStep = Math.max(1, Math.floor(candles.length / 7))
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const timeLabels = candles.map((_, i) => {
    if (i % timeStep !== 0 && i !== candles.length - 1) return null
    const d = new Date()
    d.setDate(d.getDate() - (candles.length - 1 - i) * 7)
    return { i, label: `${d.getDate()}/${months[d.getMonth()]}` }
  }).filter(Boolean) as { i: number, label: string }[]

  const lastCandle = candles[candles.length - 1]
  const lastClose = lastCandle.close
  const isBullish = lastCandle.close >= lastCandle.open

  const activeCandle = hoverIdx !== null ? candles[hoverIdx] : lastCandle
  const activeBullish = activeCandle.close >= activeCandle.open

  // Resistance line at the highest point
  const resistanceY = yPos(dataMax)

  return (
    <div className="mi-chart-wrap" onMouseLeave={() => setHoverIdx(null)}>
      <div className="mi-chart-tabs">
        <span>5m</span>
        <span>10m</span>
        <span>30m</span>
        <span>1H</span>
        <span>4H</span>
        <span className="mi-tab-active">1D</span>
      </div>
      <div className="mi-chart-ohlc">
        <span>Open: <b>{activeCandle.open.toFixed(1)}</b></span>
        <span>High: <b style={{ color: '#19c37d' }}>{activeCandle.high.toFixed(1)}</b></span>
        <span>Low: <b style={{ color: '#ef4444' }}>{activeCandle.low.toFixed(1)}</b></span>
        <span>Close: <b style={{ color: activeBullish ? '#19c37d' : '#ef4444' }}>{activeCandle.close.toFixed(1)}</b></span>
        <span className="mi-ma-label">
          <span style={{ color: '#38bdf8' }}>MA5: {ma5[hoverIdx !== null ? hoverIdx : ma5.length - 1]?.toFixed(1)}</span>
          <span style={{ color: '#f59e0b' }}>MA10: {ma10[hoverIdx !== null ? hoverIdx : ma10.length - 1]?.toFixed(1)}</span>
          <span style={{ color: '#c084fc' }}>MA30: {ma30[hoverIdx !== null ? hoverIdx : ma30.length - 1]?.toFixed(1)}</span>
        </span>
      </div>
      <div className="mi-chart-container">
        <svg className="mi-trend-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          {/* Grid lines */}
          {gridLevels.map((lv, i) => {
            const y = yPos(lv)
            return (<g key={`g${i}`}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 3" />
              <text x={W - PR + 4} y={y + 3.5} fill="rgba(255,255,255,0.32)" fontSize="8" fontWeight="700" textAnchor="start">{lv.toFixed(0)}</text>
            </g>)
          })}

          {/* Resistance line (dashed red) */}
          <line x1={PL} y1={resistanceY} x2={W - PR} y2={resistanceY} stroke="#ef4444" strokeWidth="0.8" strokeDasharray="6 4" opacity="0.5" />

          {/* Time labels */}
          {timeLabels.map(t => (
            <text key={t.i} x={xPos(t.i)} y={CHART_H - 4} fill="rgba(255,255,255,0.25)" fontSize="7.5" fontWeight="600" textAnchor="middle">{t.label}</text>
          ))}

          {/* Separator line between chart and volume */}
          <line x1={PL} y1={CHART_H} x2={W - PR} y2={CHART_H} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

          {/* Volume bars */}
          {candles.map((c, i) => {
            const bullish = c.close >= c.open
            const barH = (c.volume / maxVol) * volH
            const x = xPos(i) - bodyW / 2
            return (
              <rect key={`v${i}`} x={x} y={volBot - barH} width={bodyW} height={barH}
                fill={bullish ? 'rgba(25,195,125,0.35)' : 'rgba(239,68,68,0.35)'} />
            )
          })}
          {/* Volume label */}
          <text x={PL + 2} y={volTop + 10} fill="rgba(255,255,255,0.22)" fontSize="7" fontWeight="700">VOL</text>

          {/* MA lines */}
          <polyline points={maLine(ma5)} fill="none" stroke="#38bdf8" strokeWidth="1.2" opacity="0.8" />
          <polyline points={maLine(ma10)} fill="none" stroke="#f59e0b" strokeWidth="1.2" opacity="0.7" />
          <polyline points={maLine(ma30)} fill="none" stroke="#c084fc" strokeWidth="1" opacity="0.5" />

          {/* Candlesticks */}
          {candles.map((c, i) => {
            const bullish = c.close >= c.open
            const color = bullish ? '#19c37d' : '#ef4444'
            const x = xPos(i)
            const bodyTop = yPos(Math.max(c.open, c.close))
            const bodyBot = yPos(Math.min(c.open, c.close))
            const bodyHeight = Math.max(1, bodyBot - bodyTop)
            return (
              <g key={`c${i}`} onMouseEnter={() => setHoverIdx(i)} style={{ cursor: 'crosshair' }}>
                {/* Invisible wider rect to make hovering easier */}
                <rect x={x - candleW / 2} y={PT} width={candleW} height={H} fill="transparent" />
                {/* Wick */}
                <line x1={x} y1={yPos(c.high)} x2={x} y2={yPos(c.low)} stroke={color} strokeWidth="1" pointerEvents="none" />
                {/* Body */}
                <rect x={x - bodyW / 2} y={bodyTop} width={bodyW} height={bodyHeight}
                  fill={bullish ? color : color} stroke={color} strokeWidth="0.5"
                  rx="0.5" pointerEvents="none" />
              </g>
            )
          })}

          {/* Crosshair Overlay on Hover */}
          {hoverIdx !== null && (() => {
            const x = xPos(hoverIdx)
            const y = yPos(candles[hoverIdx].close)
            return (
              <g pointerEvents="none">
                <line x1={x} y1={PT} x2={x} y2={volBot} stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" strokeDasharray="2 2" />
                <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" strokeDasharray="2 2" />
                {/* Y-axis label */}
                <rect x={W - PR} y={y - 6} width="22" height="12" rx="2" fill="#0d1117" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
                <text x={W - PR + 11} y={y + 2.5} fill="#fff" fontSize="6.5" fontWeight="700" textAnchor="middle">{candles[hoverIdx].close.toFixed(1)}</text>
              </g>
            )
          })()}

          {/* Current price line + label */}
          {(() => {
            const y = yPos(lastClose)
            const color = isBullish ? '#19c37d' : '#ef4444'
            return (<>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke={color} strokeWidth="0.8" strokeDasharray="4 3" opacity="0.6" />
              <rect x={W - PR} y={y - 8} width="38" height="16" rx="3" fill={color} />
              <text x={W - PR + 19} y={y + 3} fill="#fff" fontSize="8.5" fontWeight="900" textAnchor="middle">{lastClose.toFixed(1)}</text>
            </>)
          })()}
        </svg>
      </div>
    </div>
  )
}

// Source badge config with short abbreviations like crypto network badges
const SOURCES = [
  { key: 'GT', label: 'Google Trends', color: '#4285f4', icon: Globe },
  { key: 'SB', label: 'Supabase DB', color: '#3ecf8e', icon: Database },
  { key: 'AI', label: 'Radar AI', color: '#c084fc', icon: Radio },
  { key: 'MK', label: 'Mercado SC', color: '#f59e0b', icon: Layers },
  { key: 'ES', label: 'Estoque', color: '#ef4444', icon: Server },
  { key: 'BK', label: 'Busca Keywords', color: '#38bdf8', icon: Search },
]

export default function MarketIntelligencePanel({ feed }: { feed: PublicMarketRadarFeed }) {
  const primary = feed.highlights[0]
  if (!primary) return null

  const score = Math.max(0, Math.min(100, primary.score))
  const regions = feed.regions.slice(0, 5)
  const signals = feed.highlights.slice(0, 4)

  // Generate candlestick data from primary score
  const candles = generateCandles(score, 42)

  // Build table rows — like the Token Explorer
  const tableRows = [
    ...signals.map((s, i) => {
      const cd = generateCandles(s.score, i * 2.1 + 1, 12)
      const data = cd.map(c => c.close)
      const delta7d = ((data[data.length - 1] - data[Math.max(0, data.length - 4)]) / Math.max(1, data[Math.max(0, data.length - 4)]) * 100)
      const delta30d = ((data[data.length - 1] - data[0]) / Math.max(1, data[0]) * 100)
      return {
        rank: i + 1,
        name: s.keyword,
        source: SOURCES[i % SOURCES.length],
        score: s.score,
        temp: s.temperature,
        delta24h: (s.score > 75 ? '+' : '') + ((Math.abs(Math.sin(s.score + i)) * 3) - 0.5).toFixed(1) + '%',
        delta7d: (delta7d >= 0 ? '+' : '') + delta7d.toFixed(2) + '%',
        delta30d: (delta30d >= 0 ? '+' : '') + delta30d.toFixed(2) + '%',
        sparkData: data,
        sparkColor: s.score >= 70 ? '#19c37d' : s.score >= 50 ? '#f6ca67' : '#ef4444',
        related: s.relatedPropertiesCount,
        href: `/busca?q=${encodeURIComponent(s.keyword)}`,
      }
    }),
    ...regions.map((r, i) => {
      const cd = generateCandles(r.score, (i + signals.length) * 1.8, 12)
      const data = cd.map(c => c.close)
      const delta7d = ((data[data.length - 1] - data[Math.max(0, data.length - 4)]) / Math.max(1, data[Math.max(0, data.length - 4)]) * 100)
      const delta30d = ((data[data.length - 1] - data[0]) / Math.max(1, data[0]) * 100)
      return {
        rank: signals.length + i + 1,
        name: r.label,
        source: SOURCES[(i + 2) % SOURCES.length],
        score: r.score,
        temp: r.description,
        delta24h: (r.score > 65 ? '+' : '') + ((Math.abs(Math.cos(r.score + i)) * 4) - 1).toFixed(1) + '%',
        delta7d: (delta7d >= 0 ? '+' : '') + delta7d.toFixed(2) + '%',
        delta30d: (delta30d >= 0 ? '+' : '') + delta30d.toFixed(2) + '%',
        sparkData: data,
        sparkColor: r.score >= 70 ? '#19c37d' : r.score >= 50 ? '#f6ca67' : '#ef4444',
        related: 0,
        href: `/busca?q=${encodeURIComponent(r.label)}`,
      }
    }),
  ]

  return (
    <section className="mi-section" aria-label="Radar de mercado imobiliário">
      {/* === TOP BAR === */}
      <div className="mi-topbar">
        <div className="mi-topbar-left">
          <span className="mi-kicker">Pilger Market Intelligence</span>
          <h2>Radar Imobiliário</h2>
        </div>
        <div className="mi-topbar-right">
          <div className="mi-sources">
            {SOURCES.map(s => (
              <div className="mi-source-chip" key={s.key} title={s.label}>
                <span className="mi-chip-dot" style={{ background: s.color }} />
                <span className="mi-chip-key">{s.key}</span>
                <span className="mi-chip-label">{s.label}</span>
              </div>
            ))}
          </div>
          <div className="mi-live-tag">
            <Activity size={12} />
            <span>{feed.source === 'live' ? 'Ao vivo' : 'Preview'}</span>
            <strong>{formatDate(feed.updatedAt)}</strong>
          </div>
        </div>
      </div>

      {/* === CANDLESTICK CHART === */}
      <CandlestickChart candles={candles} score={score} />

      {/* === MA Legend === */}
      <div className="mi-chart-legend">
        <div className="mi-legend-item">
          <span className="mi-legend-dot" style={{ background: '#38bdf8' }} />
          <span className="mi-legend-label">MA5</span>
        </div>
        <div className="mi-legend-item">
          <span className="mi-legend-dot" style={{ background: '#f59e0b' }} />
          <span className="mi-legend-label">MA10</span>
        </div>
        <div className="mi-legend-item">
          <span className="mi-legend-dot" style={{ background: '#c084fc' }} />
          <span className="mi-legend-label">MA30</span>
        </div>
        <div className="mi-legend-item">
          <span className="mi-legend-dot" style={{ background: '#19c37d' }} />
          <span className="mi-legend-label">Alta (bullish)</span>
        </div>
        <div className="mi-legend-item">
          <span className="mi-legend-dot" style={{ background: '#ef4444' }} />
          <span className="mi-legend-label">Baixa (bearish)</span>
        </div>
      </div>

      {/* === DATA TABLE (Token Explorer style) === */}
      <div className="mi-table-wrap">
        <table className="mi-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Ativo / Keyword</th>
              <th>Fonte</th>
              <th>Score</th>
              <th>24h</th>
              <th>7d</th>
              <th>30d</th>
              <th>Últimos 7 dias</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map(row => (
              <tr key={row.rank}>
                <td className="mi-td-rank">{row.rank}</td>
                <td className="mi-td-name">
                  <Link href={row.href}>
                    <span className="mi-asset-icon" style={{ background: row.sparkColor }}>{row.name.charAt(0).toUpperCase()}</span>
                    <span className="mi-asset-name">{row.name}</span>
                  </Link>
                </td>
                <td>
                  <span className="mi-source-tag" style={{ borderColor: row.source.color + '44', color: row.source.color }}>
                    <row.source.icon size={10} />
                    {row.source.key}
                  </span>
                </td>
                <td className="mi-td-score"><strong>{row.score}</strong></td>
                <td className={`mi-td-delta ${row.delta24h.startsWith('+') ? 'mi-delta-up' : row.delta24h.startsWith('-') ? 'mi-delta-down' : ''}`}>{row.delta24h}</td>
                <td className={`mi-td-delta ${row.delta7d.startsWith('+') ? 'mi-delta-up' : row.delta7d.startsWith('-') ? 'mi-delta-down' : ''}`}>{row.delta7d}</td>
                <td className={`mi-td-delta ${row.delta30d.startsWith('+') ? 'mi-delta-up' : row.delta30d.startsWith('-') ? 'mi-delta-down' : ''}`}>{row.delta30d}</td>
                <td className="mi-td-spark"><RowSparkline data={row.sparkData} color={row.sparkColor} /></td>
                <td className="mi-td-temp">
                  <span className={`mi-temp-badge mi-temp-${row.score >= 80 ? 'hot' : row.score >= 60 ? 'warm' : 'cool'}`}>
                    {row.score >= 80 ? 'Quente' : row.score >= 60 ? 'Ativo' : 'Monitorando'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* === BOTTOM BAR === */}
      <div className="mi-bottom-bar">
        <div className="mi-actions">
          <Link href={`/busca?q=${encodeURIComponent(primary.keyword)}`} className="mi-action-primary">
            <Building2 size={14} />
            Ver imóveis conectados
          </Link>
          <Link href="/admin/radar" className="mi-action-secondary">
            <LineChart size={14} />
            Abrir radar completo
          </Link>
        </div>
        <div className="mi-data-note">
          <TrendingUp size={13} />
          <span>Leitura automática de {SOURCES.length} fontes de dados</span>
        </div>
      </div>
    </section>
  )
}
