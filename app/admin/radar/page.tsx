'use client'

import { useState, useEffect } from 'react'
import { Radar, Plus, Trash2, TrendingUp, AlertCircle, Flame, Snowflake } from 'lucide-react'
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  YAxis
} from 'recharts'

interface RadarData {
  id: string
  keyword: string
  location: string
  is_active: boolean
  created_at: string
  market_radar_data: Array<{ date: string; trend_score: number }>
}

function getTrendBadge(score: number) {
  if (score >= 75) return { label: '🔥 Quente', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' }
  if (score >= 40) return { label: '🟡 Morno', color: '#d97706', bg: '#fef3c7', border: '#fde68a' }
  return { label: '❄️ Frio', color: '#2563eb', bg: '#dbeafe', border: '#bfdbfe' }
}

function getScoreBarColor(score: number) {
  if (score >= 75) return '#dc2626'
  if (score >= 40) return '#d97706'
  return '#2563eb'
}

export default function MarketRadarPage() {
  const [radars, setRadars] = useState<RadarData[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [location, setLocation] = useState('BR')
  const [submitting, setSubmitting] = useState(false)

  const fetchRadars = async () => {
    try {
      const res = await fetch('/api/admin/radar')
      const data = await res.json()
      if (data.radars) setRadars(data.radars)
    } catch (err) {
      console.error('Failed to fetch radars', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRadars()
  }, [])

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
        fetchRadars()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover este termo do radar?')) return
    try {
      const res = await fetch(`/api/admin/radar?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchRadars()
      }
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
        <Radar size={40} style={{ margin: '0 auto 12px', opacity: 0.5, animation: 'pulse 2s ease-in-out infinite' }} />
        <p>Carregando radar de mercado...</p>
      </div>
    </div>
  )

  return (
    <div style={{ padding: '0 24px 48px 24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '12px',
          background: '#dbeafe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#2563eb',
          border: '1px solid #bfdbfe'
        }}>
          <Radar size={32} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', color: 'var(--text-primary)' }}>Radar de Mercado Pilger</h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', maxWidth: '600px' }}>
            O Olho de Deus rastreia automaticamente o interesse de busca no Google Trends (semanalmente) e alimenta a inteligência da Diretriz Semanal.
          </p>
        </div>
      </div>

      {/* Add Form */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '32px',
        boxShadow: 'var(--shadow-gold)'
      }}>
        <h2 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
          <Plus size={20} color="var(--gold)" /> Adicionar Termo ao Radar
        </h2>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 300px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Palavra-chave (ex: Imóvel luxo balneário camboriú)
            </label>
            <input
              type="text"
              required
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Digite o termo"
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'border-color 0.2s',
                fontSize: '0.95rem'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--gold)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
          <div style={{ flex: '0 0 200px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Localização (ex: BR, BR-SC)
            </label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="BR"
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'border-color 0.2s',
                fontSize: '0.95rem'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--gold)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '12px 24px',
                background: 'var(--gradient-gold)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
                height: '46px',
                transition: 'opacity 0.2s, transform 0.1s',
                fontSize: '0.95rem'
              }}
            >
              {submitting ? 'Adicionando...' : '+ Monitorar'}
            </button>
          </div>
        </form>
      </div>

      {/* Radar Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
        {radars.length === 0 ? (
          <div style={{
            gridColumn: '1 / -1',
            textAlign: 'center',
            padding: '64px 32px',
            color: 'var(--text-muted)',
            background: 'var(--bg-secondary)',
            borderRadius: '16px',
            border: '2px dashed var(--border)'
          }}>
            <Radar size={56} style={{ margin: '0 auto 16px auto', opacity: 0.4, color: '#2563eb' }} />
            <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontSize: '1.2rem' }}>Nenhum termo sendo monitorado</h3>
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
              Adicione palavras-chave acima para o Olho de Deus começar a rastrear tendências de busca.
            </p>
          </div>
        ) : radars.map(radar => {
          const hasData = radar.market_radar_data && radar.market_radar_data.length > 0
          const latestScore = hasData ? radar.market_radar_data[radar.market_radar_data.length - 1].trend_score : null
          const badge = latestScore !== null ? getTrendBadge(latestScore) : null

          return (
            <div key={radar.id} style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '24px',
              position: 'relative',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--gold)'
              e.currentTarget.style.boxShadow = 'var(--shadow-gold)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.transform = 'translateY(0)'
            }}>
              {/* Delete Button */}
              <button 
                onClick={() => handleDelete(radar.id)}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: '#fee2e2',
                  border: '1px solid #fca5a5',
                  color: '#dc2626',
                  cursor: 'pointer',
                  opacity: 0.7,
                  borderRadius: '6px',
                  padding: '6px',
                  transition: 'opacity 0.2s'
                }}
                title="Remover termo"
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
              >
                <Trash2 size={16} />
              </button>

              {/* Status Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ 
                  color: '#2563eb', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  fontSize: '0.75rem', 
                  fontWeight: 600,
                  background: '#dbeafe',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  border: '1px solid #bfdbfe'
                }}>
                  <TrendingUp size={12} /> RADAR ATIVO
                </div>
                
                {/* Trend Badge */}
                {badge && (
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: '12px',
                    background: badge.bg,
                    color: badge.color,
                    border: `1px solid ${badge.border}`
                  }}>
                    {badge.label}
                  </span>
                )}
              </div>

              {/* Keyword & Location */}
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', color: 'var(--text-primary)', paddingRight: '36px', lineHeight: 1.3 }}>
                {radar.keyword}
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                📍 {radar.location}
              </p>

              {/* Score Section */}
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                {hasData && latestScore !== null ? (
                  <>
                    {/* Score Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', minWidth: '40px', fontWeight: 500 }}>Score</span>
                      <div style={{ flex: 1, height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${latestScore}%`,
                          background: getScoreBarColor(latestScore),
                          borderRadius: '4px',
                          transition: 'width 0.5s ease'
                        }} />
                      </div>
                      <span style={{ 
                        fontSize: '1rem', 
                        fontWeight: 700, 
                        color: getScoreBarColor(latestScore),
                        minWidth: '35px',
                        textAlign: 'right'
                      }}>
                        {latestScore}
                      </span>
                    </div>

                    {/* Sparkline Chart */}
                    {radar.market_radar_data.length > 1 && (
                      <div style={{ height: '60px', marginBottom: '8px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={radar.market_radar_data.map(d => ({ ...d, score: d.trend_score }))}>
                            <YAxis domain={[0, 100]} hide />
                            <Tooltip 
                              contentStyle={{ 
                                background: 'var(--bg-card)', 
                                border: '1px solid var(--border)', 
                                borderRadius: '8px', 
                                fontSize: '0.85rem',
                                padding: '8px 12px',
                                boxShadow: 'var(--shadow-gold)',
                                color: 'var(--text-primary)'
                              }}
                              labelStyle={{ color: 'var(--text-secondary)', marginBottom: '4px' }}
                              formatter={(value: any) => [`${value}/100`, 'Score']}
                              labelFormatter={(label: any) => `📅 ${label}`}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="score" 
                              stroke={getScoreBarColor(latestScore)} 
                              strokeWidth={3} 
                              dot={false}
                              activeDot={{ r: 4, fill: getScoreBarColor(latestScore), stroke: '#fff', strokeWidth: 2 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                      {radar.market_radar_data.length} coletas registradas
                    </p>
                  </>
                ) : (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    padding: '12px', 
                    background: 'var(--bg-secondary)', 
                    borderRadius: '8px',
                    border: '1px dashed var(--border)'
                  }}>
                    <AlertCircle size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Aguardando coleta semanal do Olho de Deus (Seg, 06:00).
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
