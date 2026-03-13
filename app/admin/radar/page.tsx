'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Radar, Plus, Trash2, TrendingUp, 
  Flame, Snowflake, RefreshCw, MapPin, Search,
  TrendingDown, Minus, Clock, X, ChevronRight,
  Activity, ExternalLink, Calendar
} from 'lucide-react'
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  YAxis,
  XAxis,
  CartesianGrid
} from 'recharts'

interface RadarData {
  id: string
  keyword: string
  location: string
  is_active: boolean
  created_at: string
  market_radar_data: Array<{ 
    date: string; 
    trend_score: number;
    time_slot?: string;
    collected_at?: string;
  }>
}

function getTrendBadge(score: number) {
  if (score >= 75) return { label: 'ALTO VOLUME', icon: <Flame size={12} />, color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' }
  if (score >= 40) return { label: 'MÉDIO', icon: <TrendingUp size={12} />, color: '#d97706', bg: '#fef3c7', border: '#fde68a' }
  return { label: 'BAIXO', icon: <Snowflake size={12} />, color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' }
}

function getTrendDirection(data: any[]) {
  if (!data || data.length < 2) return { icon: <Minus size={14} />, color: 'var(--text-muted)', label: 'Estável', diff: 0 }
  const current = data[data.length - 1].trend_score
  const previous = data[data.length - 2].trend_score
  const diff = current - previous

  if (diff > 5) return { icon: <TrendingUp size={14} />, color: '#10b981', label: `+${diff}%`, diff }
  if (diff < -5) return { icon: <TrendingDown size={14} />, color: '#ef4444', label: `${diff}%`, diff }
  return { icon: <Minus size={14} />, color: 'var(--text-muted)', label: 'Estável', diff: 0 }
}

function timeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'agora mesmo'
  if (diffMins < 60) return `há ${diffMins} min`
  if (diffHours < 24) return `há ${diffHours} hora${diffHours > 1 ? 's' : ''}`
  return `há ${diffDays} dia${diffDays > 1 ? 's' : ''}`
}

function formatScore(score: number | null): string {
  if (score === null) return '--'
  return String(score)
}

export default function MarketRadarPage() {
  const [radars, setRadars] = useState<RadarData[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [location, setLocation] = useState('BR')
  const [submitting, setSubmitting] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [filterLocation, setFilterLocation] = useState<string>('all')

  const fetchRadars = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/radar')
      const data = await res.json()
      if (data.radars) {
        setRadars(data.radars)
        let mostRecent: any = null
        data.radars.forEach((r: any) => {
            r.market_radar_data?.forEach((d: any) => {
                if (!mostRecent || new Date(d.collected_at || d.date) > new Date(mostRecent)) {
                    mostRecent = d.collected_at || d.date
                }
            })
        })
        if (mostRecent) setLastUpdate(mostRecent)
      }
    } catch (err) {
      console.error('Failed to fetch radars', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRadars()
  }, [fetchRadars])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!keyword) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, location })
      })
      if (res.ok) {
        setKeyword('')
        setShowAddForm(false)
        fetchRadars()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCollect = async () => {
    setCollecting(true)
    try {
        const res = await fetch('/api/admin/radar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'collect' })
        })
        if (res.ok) {
            await fetchRadars()
        }
    } catch (err) {
        console.error(err)
    } finally {
        setCollecting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover este termo do radar?')) return
    try {
      const res = await fetch(`/api/admin/radar?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        if (selectedId === id) setSelectedId(null)
        fetchRadars()
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Get unique locations for filter
  const locations = Array.from(new Set(radars.map(r => r.location)))

  // Filter radars
  const filteredRadars = filterLocation === 'all' 
    ? radars 
    : radars.filter(r => r.location === filterLocation)

  // Sort: by latest score descending
  const sortedRadars = [...filteredRadars].sort((a, b) => {
    const scoreA = a.market_radar_data?.slice(-1)[0]?.trend_score ?? -1
    const scoreB = b.market_radar_data?.slice(-1)[0]?.trend_score ?? -1
    return scoreB - scoreA
  })

  const selectedRadar = selectedId ? radars.find(r => r.id === selectedId) : null

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
        <Radar size={40} style={{ margin: '0 auto 12px', opacity: 0.5, animation: 'pulse 2s ease-in-out infinite' }} />
        <p>Acessando o Radar de Mercado...</p>
      </div>
    </div>
  )

  return (
    <div style={{ padding: '0 24px 48px 24px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* ═══ HEADER ═══ */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '48px', height: '48px',
            borderRadius: '12px',
            background: 'var(--gradient-gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff',
            boxShadow: 'var(--shadow-gold)',
            flexShrink: 0
          }}>
            <Radar size={26} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.75rem', color: 'var(--text-primary)', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Radar de Mercado
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              <Clock size={12} />
              <span>Monitoramento automático 3x ao dia</span>
              {lastUpdate && (
                <>
                  <span style={{ opacity: 0.3 }}>•</span>
                  <span>Atualizado {timeAgo(lastUpdate)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 18px',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              fontWeight: 600, fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Plus size={16} /> Novo Monitoramento
          </button>
          <button
            onClick={handleCollect}
            disabled={collecting}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 18px',
              background: 'var(--gradient-gold)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 600, fontSize: '0.85rem',
              cursor: collecting ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(201, 169, 110, 0.3)',
              opacity: collecting ? 0.7 : 1
            }}
          >
            <RefreshCw size={16} className={collecting ? 'spin-animation' : ''} />
            {collecting ? 'Coletando...' : 'Coletar Agora'}
          </button>
        </div>
      </div>

      {/* ═══ ADD FORM (expandable) ═══ */}
      {showAddForm && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--gold)',
          borderRadius: '14px',
          padding: '24px',
          marginBottom: '20px',
          animation: 'slideDown 0.2s ease-out',
          boxShadow: '0 8px 24px rgba(201, 169, 110, 0.12)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Adicionar Palavra-chave ao Radar
            </h3>
            <button onClick={() => setShowAddForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <div style={{ flex: '2 1 300px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                Palavra-chave
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text" required value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Ex: apartamento luxo balneário camboriú"
                  style={{
                    width: '100%', padding: '10px 12px 10px 38px',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: '8px', color: 'var(--text-primary)',
                    outline: 'none', fontSize: '0.9rem'
                  }}
                />
              </div>
            </div>
            <div style={{ flex: '0 0 140px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                Região
              </label>
              <div style={{ position: 'relative' }}>
                <MapPin size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text" required value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="BR"
                  style={{
                    width: '100%', padding: '10px 12px 10px 36px',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: '8px', color: 'var(--text-primary)',
                    outline: 'none', fontSize: '0.9rem', textTransform: 'uppercase'
                  }}
                />
              </div>
            </div>
            <button
              type="submit" disabled={submitting}
              style={{
                padding: '10px 24px', height: '42px',
                background: 'var(--gradient-gold)', color: '#fff',
                border: 'none', borderRadius: '8px',
                fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s', fontSize: '0.9rem',
                boxShadow: '0 4px 12px rgba(201, 169, 110, 0.3)',
                whiteSpace: 'nowrap'
              }}
            >
              {submitting ? 'Adicionando...' : 'Adicionar'}
            </button>
          </form>
        </div>
      )}

      {/* ═══ FILTER BAR ═══ */}
      <div style={{
        display: 'flex', gap: '8px', marginBottom: '4px', alignItems: 'center',
        padding: '12px 16px',
        background: 'var(--bg-card)',
        borderRadius: '12px 12px 0 0',
        border: '1px solid var(--border)',
        borderBottom: 'none'
      }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <MapPin size={14} style={{ color: 'var(--text-muted)' }} />
          <button
            onClick={() => setFilterLocation('all')}
            style={{
              padding: '4px 12px', borderRadius: '16px', fontSize: '0.78rem', fontWeight: 600,
              border: filterLocation === 'all' ? '1px solid var(--gold)' : '1px solid var(--border)',
              background: filterLocation === 'all' ? 'rgba(201, 169, 110, 0.12)' : 'transparent',
              color: filterLocation === 'all' ? 'var(--gold)' : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            Todas Regiões
          </button>
          {locations.map(loc => (
            <button
              key={loc}
              onClick={() => setFilterLocation(loc)}
              style={{
                padding: '4px 12px', borderRadius: '16px', fontSize: '0.78rem', fontWeight: 600,
                border: filterLocation === loc ? '1px solid var(--gold)' : '1px solid var(--border)',
                background: filterLocation === loc ? 'rgba(201, 169, 110, 0.12)' : 'transparent',
                color: filterLocation === loc ? 'var(--gold)' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              {loc}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {sortedRadars.length} termo{sortedRadars.length !== 1 ? 's' : ''} monitorado{sortedRadars.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ═══ MAIN CONTENT: TABLE + DETAIL PANEL ═══ */}
      <div style={{ display: 'flex', gap: '0', minHeight: '500px' }}>

        {/* ── LEFT: TRENDS TABLE ── */}
        <div style={{ 
          flex: selectedRadar ? '0 0 60%' : '1 1 100%',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: selectedRadar ? '0 0 0 12px' : '0 0 12px 12px',
          overflow: 'hidden',
          transition: 'flex 0.3s ease'
        }}>
          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '40px 1fr 100px 110px 100px 130px',
            padding: '10px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'rgba(0,0,0,0.02)',
            gap: '8px',
            alignItems: 'center'
          }}>
            <span style={thStyle}>#</span>
            <span style={thStyle}>
              <Search size={12} style={{ marginRight: '4px' }} />
              Tendências
            </span>
            <span style={{ ...thStyle, textAlign: 'center' }}>Score</span>
            <span style={{ ...thStyle, textAlign: 'center' }}>Variação</span>
            <span style={thStyle}>Coletado</span>
            <span style={{ ...thStyle, textAlign: 'right' }}>Últimas 24h</span>
          </div>

          {/* Table Rows */}
          {sortedRadars.length === 0 ? (
            <div style={{ 
              padding: '60px 40px', textAlign: 'center', color: 'var(--text-muted)'
            }}>
              <Radar size={48} style={{ margin: '0 auto 16px', opacity: 0.2, color: 'var(--gold)' }} />
              <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                Nenhum termo monitorado
              </p>
              <p style={{ fontSize: '0.85rem', margin: 0 }}>
                Clique em &quot;Novo Monitoramento&quot; para começar.
              </p>
            </div>
          ) : sortedRadars.map((radar, index) => {
            const hasData = radar.market_radar_data && radar.market_radar_data.length > 0
            const latestData = hasData ? radar.market_radar_data[radar.market_radar_data.length - 1] : null
            const latestScore = latestData?.trend_score ?? null
            const trend = getTrendDirection(radar.market_radar_data)
            const isSelected = selectedId === radar.id
            const collectedTime = latestData?.collected_at || latestData?.date

            return (
              <div
                key={radar.id}
                onClick={() => setSelectedId(isSelected ? null : radar.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr 100px 110px 100px 130px',
                  padding: '14px 16px',
                  gap: '8px',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  background: isSelected ? 'rgba(201, 169, 110, 0.06)' : 'transparent',
                  borderLeft: isSelected ? '3px solid var(--gold)' : '3px solid transparent',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'rgba(0,0,0,0.02)'
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent'
                }}
              >
                {/* # */}
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {index + 1}
                </span>

                {/* Keyword + Location */}
                <div>
                  <div style={{ 
                    fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    {radar.keyword}
                    {isSelected && <ChevronRight size={14} style={{ color: 'var(--gold)' }} />}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={10} /> {radar.location}
                  </div>
                </div>

                {/* Score */}
                <div style={{ textAlign: 'center' }}>
                  {latestScore !== null ? (
                    <span style={{ 
                      fontSize: '1.1rem', fontWeight: 800, 
                      color: latestScore >= 75 ? 'var(--gold)' : latestScore >= 40 ? 'var(--text-primary)' : 'var(--text-muted)'
                    }}>
                      {latestScore}
                      <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-muted)' }}>/100</span>
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>--</span>
                  )}
                </div>

                {/* Trend */}
                <div style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  color: trend.color, fontSize: '0.82rem', fontWeight: 600
                }}>
                  {trend.icon}
                  <span>{trend.label}</span>
                </div>

                {/* Collected Time */}
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {collectedTime ? timeAgo(collectedTime) : (
                    <span style={{ color: '#d97706', fontSize: '0.72rem' }}>Pendente</span>
                  )}
                </div>

                {/* Mini Sparkline */}
                <div style={{ height: '36px', width: '100%' }}>
                  {hasData && radar.market_radar_data.length >= 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={radar.market_radar_data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                        <defs>
                          <linearGradient id={`mini-grad-${radar.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={trend.diff >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0.3}/>
                            <stop offset="100%" stopColor={trend.diff >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <YAxis domain={[0, 100]} hide />
                        <Area 
                          type="monotone" dataKey="trend_score" 
                          stroke={trend.diff >= 0 ? '#10b981' : trend.diff < -5 ? '#ef4444' : '#9ca3af'}
                          strokeWidth={1.5} fillOpacity={1} fill={`url(#mini-grad-${radar.id})`}
                          animationDuration={800}
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ 
                      height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.5
                    }}>
                      Sem dados
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── RIGHT: DETAIL PANEL ── */}
        {selectedRadar && (() => {
          const hasData = selectedRadar.market_radar_data && selectedRadar.market_radar_data.length > 0
          const latestData = hasData ? selectedRadar.market_radar_data[selectedRadar.market_radar_data.length - 1] : null
          const latestScore = latestData?.trend_score ?? null
          const badge = latestScore !== null ? getTrendBadge(latestScore) : null
          const trend = getTrendDirection(selectedRadar.market_radar_data)
          const daysMonitored = Math.floor((Date.now() - new Date(selectedRadar.created_at).getTime()) / 86400000)

          return (
            <div style={{
              flex: '0 0 40%',
              background: 'var(--bg-card)',
              borderRadius: '0 0 12px 0',
              border: '1px solid var(--border)',
              borderLeft: 'none',
              overflow: 'hidden',
              animation: 'fadeInRight 0.25s ease-out',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Detail Header */}
              <div style={{ 
                padding: '20px 24px 16px',
                borderBottom: '1px solid var(--border)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ 
                      margin: '0 0 6px 0', fontSize: '1.3rem', fontWeight: 700, 
                      color: 'var(--text-primary)', lineHeight: 1.2 
                    }}>
                      {selectedRadar.keyword}
                    </h2>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {badge && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          fontSize: '0.68rem', fontWeight: 800,
                          padding: '3px 8px', borderRadius: '12px',
                          background: badge.bg, color: badge.color,
                          border: `1px solid ${badge.border}`,
                          textTransform: 'uppercase', letterSpacing: '0.04em'
                        }}>
                          {badge.icon} {badge.label}
                        </span>
                      )}
                      <span style={{ 
                        color: trend.color, display: 'inline-flex', alignItems: 'center', 
                        gap: '3px', fontSize: '0.75rem', fontWeight: 700
                      }}>
                        {trend.icon} {trend.label}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedId(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Detail Chart */}
              <div style={{ height: '220px', padding: '16px 8px 0 8px' }}>
                {hasData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart 
                      data={selectedRadar.market_radar_data.map(d => ({ 
                        ...d, 
                        displayDate: d.time_slot ? `${d.date.split('-').slice(1).join('/')} ${d.time_slot}h` : d.date 
                      }))}
                      margin={{ top: 5, right: 16, left: 0, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="detail-gradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--gold)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--gold)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                      <XAxis 
                        dataKey="displayDate" 
                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis domain={[0, 100]} hide />
                      <Tooltip 
                        contentStyle={{ 
                          background: 'rgba(255, 255, 255, 0.98)', 
                          border: '1px solid var(--gold)', 
                          borderRadius: '10px', 
                          fontSize: '0.82rem',
                          padding: '10px 14px',
                          boxShadow: '0 8px 20px rgba(201, 169, 110, 0.2)',
                        }}
                        labelStyle={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}
                        formatter={(value: any) => [`${value}/100`, 'Score']}
                      />
                      <Area 
                        type="monotone" dataKey="trend_score" 
                        stroke="var(--gold)" strokeWidth={2.5} 
                        fillOpacity={1} fill="url(#detail-gradient)"
                        animationDuration={1000}
                        dot={{ r: 3, fill: 'var(--gold)', stroke: '#fff', strokeWidth: 2 }}
                        activeDot={{ r: 5, fill: 'var(--gold)', stroke: '#fff', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{
                    height: '100%', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: '8px',
                    color: 'var(--text-muted)'
                  }}>
                    <Activity size={32} style={{ opacity: 0.3 }} />
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>Aguardando primeira coleta</p>
                  </div>
                )}
              </div>

              {/* Detail Timestamps */}
              <div style={{ 
                display: 'flex', justifyContent: 'space-between', 
                padding: '6px 24px', fontSize: '0.7rem', color: 'var(--text-muted)'
              }}>
                <span>Histórico 24h</span>
                <span>Agora</span>
              </div>

              {/* Detail Info */}
              <div style={{ 
                padding: '16px 24px', 
                flex: 1,
                display: 'flex', flexDirection: 'column', gap: '12px'
              }}>
                {/* Score Display */}
                {latestScore !== null && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '10px',
                    border: '1px solid var(--border)'
                  }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Score Atual</span>
                    <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--gold)' }}>
                      {latestScore}
                      <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>/100</span>
                    </span>
                  </div>
                )}

                {/* Metadata */}
                <div style={{ 
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'
                }}>
                  <div style={{ 
                    padding: '12px 14px', background: 'var(--bg-secondary)', 
                    borderRadius: '8px', border: '1px solid var(--border)' 
                  }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Região
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={12} /> {selectedRadar.location}
                    </div>
                  </div>
                  <div style={{ 
                    padding: '12px 14px', background: 'var(--bg-secondary)', 
                    borderRadius: '8px', border: '1px solid var(--border)' 
                  }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Monitorado há
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} /> {daysMonitored} dia{daysMonitored !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                {latestData?.time_slot && (
                  <div style={{ 
                    padding: '12px 14px', background: 'var(--bg-secondary)', 
                    borderRadius: '8px', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={12} /> Último Slot
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {latestData.time_slot}:00h
                    </span>
                  </div>
                )}

                {/* Google Trends Link */}
                <a
                  href={`https://trends.google.com.br/trending?geo=${selectedRadar.location}&q=${encodeURIComponent(selectedRadar.keyword)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    padding: '10px 16px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text-secondary)',
                    fontSize: '0.82rem', fontWeight: 500,
                    textDecoration: 'none',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                >
                  <ExternalLink size={14} />
                  Ver no Google Trends
                </a>

                {/* Delete Button */}
                <button
                  onClick={() => handleDelete(selectedRadar.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '10px 16px', marginTop: 'auto',
                    background: 'transparent',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '8px',
                    color: '#ef4444',
                    fontSize: '0.82rem', fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.06)'
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)'
                  }}
                >
                  <Trash2 size={14} />
                  Remover do Radar
                </button>
              </div>
            </div>
          )
        })()}
      </div>

      <style jsx global>{`
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .spin-animation {
            animation: spin 2s linear infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 0.5; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.1); }
        }
        @keyframes slideDown {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInRight {
            from { opacity: 0; transform: translateX(12px); }
            to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}

// Shared table header style
const thStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  display: 'flex',
  alignItems: 'center'
}
