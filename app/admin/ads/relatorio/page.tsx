'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
    ArrowLeft, ArrowRight, BarChart3, Brain, CheckCircle, ClipboardList, DollarSign,
    RefreshCw, Sparkles, Target, TrendingUp, AlertCircle,
    Eye, Layers, MousePointerClick, Smartphone, Users, Zap,
} from 'lucide-react'
import AdminLoadingState from '@/components/admin/AdminLoadingState'

interface PaidAiReport {
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

interface TrafficManager {
    generated_at: string
    totals: {
        spend: number
        impressions: number
        reach: number
        clicks: number
        leads: number
        conversations: number
        landing_page_views: number
        avg_ctr: number
        avg_cpc: number
        avg_cpm: number
        avg_cpl: number
        frequency: number
    }
    coverage: {
        campaigns: number
        adsets: number
        ads: number
        lead_forms: number
        placements: number
        devices: number
        demographics: number
        daily_points: number
    }
    top_ads: Array<{
        id: string
        name: string
        campaign_name?: string
        adset_name?: string
        spend: number
        leads: number
        cpl: number
        ctr: number
        cpc: number
        quality_ranking?: string
        creative_thumbnail_url?: string
        creative_title?: string
        creative_body?: string
        status?: string
    }>
    placements: Array<{
        publisher_platform?: string
        platform_position?: string
        spend: number
        leads: number
        cpl: number
        ctr: number
    }>
    devices: Array<{
        device_platform?: string
        spend: number
        leads: number
        cpl: number
        ctr: number
    }>
    demographics: Array<{
        age?: string
        gender?: string
        spend: number
        leads: number
        cpl: number
        ctr: number
    }>
    daily_series: Array<{
        date: string
        spend: number
        leads: number
        clicks: number
    }>
    diagnostics: string[]
    crm_attribution: {
        platform_leads: number
        crm_leads: number
        missing_attribution: number
        attribution_rate: number
    }
}

function formatCurrency(value: number) {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(value: string | null | undefined) {
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

function numberMetric(metrics: Record<string, unknown> | null | undefined, key: string) {
    const raw = metrics?.[key]
    const value = typeof raw === 'number' ? raw : Number(raw || 0)
    return Number.isFinite(value) ? value : 0
}

function textMetric(metrics: Record<string, unknown> | null | undefined, key: string) {
    const raw = metrics?.[key]
    return raw == null || raw === '' ? '-' : String(raw)
}

function formatPercent(value: number) {
    return `${Number(value || 0).toFixed(2)}%`
}

function compactText(value: string | null | undefined, max = 72) {
    const text = String(value || '').trim()
    return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

function cleanJsonBlock(value: string) {
    const cleaned = String(value || '')
        .replace(/```json\n?/gi, '')
        .replace(/```\n?/g, '')
        .trim()
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    return firstBrace >= 0 && lastBrace > firstBrace ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned
}

function extractJsonField(value: string, field: string) {
    const match = String(value || '').match(new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`))
    if (!match?.[1]) return ''
    try {
        return JSON.parse(`"${match[1]}"`).trim()
    } catch {
        return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim()
    }
}

function normalizeReport(report: PaidAiReport): PaidAiReport {
    const rawSummary = String(report.summary || '')
    let parsed: Partial<PaidAiReport> | null = null

    try {
        parsed = JSON.parse(cleanJsonBlock(rawSummary))
    } catch {
        parsed = null
    }

    return {
        ...report,
        title: parsed?.title || extractJsonField(rawSummary, 'title') || report.title,
        summary: parsed?.summary || extractJsonField(rawSummary, 'summary') || report.summary,
        insights: (report.insights || []).length > 0
            ? report.insights
            : Array.isArray(parsed?.insights) ? parsed.insights : [],
        recommendations: (report.recommendations || []).length > 0
            ? report.recommendations
            : Array.isArray((parsed as any)?.recommendations) ? (parsed as any).recommendations : [],
        metrics: {
            ...(parsed?.metrics || {}),
            ...(report.metrics || {}),
        },
    }
}

export default function PaidTrafficReportPage() {
    const [reports, setReports] = useState<PaidAiReport[]>([])
    const [activeId, setActiveId] = useState<string | null>(null)
    const [manager, setManager] = useState<TrafficManager | null>(null)
    const [managerDatePreset, setManagerDatePreset] = useState('last_30d')
    const [managerLoading, setManagerLoading] = useState(true)
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [error, setError] = useState('')
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

    const activeReport = useMemo(
        () => reports.find(report => report.id === activeId) || reports[0] || null,
        [activeId, reports],
    )
    const metrics = activeReport?.metrics || null

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 4000)
    }

    const loadReports = async () => {
        try {
            setError('')
            const res = await fetch('/api/admin/paid-traffic/report?limit=12')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erro ao carregar relatorios.')
            const normalized = (data.reports || []).map(normalizeReport)
            setReports(normalized)
            setActiveId(current => current || normalized[0]?.id || null)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar relatorios.')
        } finally {
            setLoading(false)
        }
    }

    const loadManager = async (preset = managerDatePreset) => {
        try {
            setManagerLoading(true)
            const res = await fetch(`/api/admin/paid-traffic/manager?date_preset=${preset}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erro ao carregar gestor de trafego.')
            setManager(data.manager || null)
        } catch (err) {
            setManager(null)
            setError(err instanceof Error ? err.message : 'Erro ao carregar gestor de trafego.')
        } finally {
            setManagerLoading(false)
        }
    }

    const generateReport = async () => {
        setGenerating(true)
        setError('')
        showToast('Gerando analise do gestor de trafego...', 'success')
        try {
            const res = await fetch('/api/admin/paid-traffic/report?days=30', { method: 'POST' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Erro ao gerar relatorio.')
            await loadReports()
            setActiveId(data.report?.id || null)
            showToast('Relatorio de trafego pago gerado.', 'success')
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao gerar relatorio.'
            setError(message)
            showToast(message, 'error')
        } finally {
            setGenerating(false)
        }
    }

    useEffect(() => {
        loadReports()
    }, [])

    useEffect(() => {
        loadManager(managerDatePreset)
    }, [managerDatePreset])

    if (loading) return <AdminLoadingState message="Carregando gestor de trafego pago..." />

    return (
        <div>
            {toast && (
                <div className={`ads-toast ${toast.type}`}>
                    {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    {toast.message}
                </div>
            )}

            <div className="admin-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Link href="/admin/ads" className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>
                        <ArrowLeft size={16} />
                    </Link>
                    <div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                            <Sparkles size={26} /> Gestor de Trafego Pago IA
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '.86rem', marginTop: 4 }}>
                            Relatorio executivo de Meta Ads, Google Ads, leads e eficiencia comercial.
                        </p>
                    </div>
                </div>
                <button onClick={generateReport} disabled={generating} className="btn btn-gold" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <RefreshCw size={17} className={generating ? 'spin' : ''} />
                    {generating ? 'Gerando...' : 'Nova analise'}
                </button>
                <Link href="/admin/ads/vitor" className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                    <ClipboardList size={17} />
                    Area do Vitor
                </Link>
            </div>

            {error && (
                <div style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: 'rgba(239,68,68,.08)',
                    border: '1px solid rgba(239,68,68,.2)',
                    color: '#b91c1c',
                    fontWeight: 700,
                    marginBottom: 16,
                }}>
                    {error}
                </div>
            )}

            <section className="chart-card traffic-manager-panel" style={{ padding: 18, marginBottom: 18 }}>
                <div className="traffic-manager-header">
                    <div>
                        <div style={{ color: 'var(--gold)', fontSize: '.68rem', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 5 }}>
                            Central do gestor de trafego
                        </div>
                        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 9, fontSize: '1.25rem' }}>
                            <Zap size={21} color="var(--gold)" /> Diagnostico Meta Ads 360
                        </h2>
                        <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '.84rem' }}>
                            Campanhas, conjuntos, anuncios, criativos, posicionamentos, publico e atribuicao CRM.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <select
                            value={managerDatePreset}
                            onChange={event => setManagerDatePreset(event.target.value)}
                            className="traffic-manager-select"
                        >
                            <option value="today">Hoje</option>
                            <option value="yesterday">Ontem</option>
                            <option value="last_7d">Ultimos 7 dias</option>
                            <option value="last_30d">Ultimos 30 dias</option>
                            <option value="this_month">Este mes</option>
                            <option value="last_month">Mes passado</option>
                            <option value="maximum">Vitalicio</option>
                        </select>
                        <button onClick={() => loadManager(managerDatePreset)} className="btn btn-outline" disabled={managerLoading} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <RefreshCw size={16} className={managerLoading ? 'spin' : ''} />
                            Atualizar
                        </button>
                    </div>
                </div>

                {managerLoading ? (
                    <div style={{ padding: 24, color: 'var(--text-muted)', fontWeight: 700 }}>
                        Carregando leitura de gestor...
                    </div>
                ) : !manager ? (
                    <div style={{
                        padding: 16,
                        borderRadius: 12,
                        background: 'rgba(245,158,11,.08)',
                        border: '1px solid rgba(245,158,11,.22)',
                        color: '#92400e',
                        fontWeight: 800,
                    }}>
                        Nao foi possivel carregar a leitura 360 da Meta agora.
                    </div>
                ) : (
                    <>
                        <div className="traffic-manager-kpis">
                            {[
                                { icon: <DollarSign size={18} />, label: 'Investimento Meta', value: formatCurrency(manager.totals.spend) },
                                { icon: <Target size={18} />, label: 'Leads Meta', value: manager.totals.leads.toLocaleString('pt-BR') },
                                { icon: <TrendingUp size={18} />, label: 'CPL Meta', value: manager.totals.avg_cpl > 0 ? formatCurrency(manager.totals.avg_cpl) : '-' },
                                { icon: <MousePointerClick size={18} />, label: 'CTR medio', value: formatPercent(manager.totals.avg_ctr) },
                                { icon: <Users size={18} />, label: 'Leads no CRM', value: manager.crm_attribution.crm_leads.toLocaleString('pt-BR') },
                                { icon: <AlertCircle size={18} />, label: 'Falta atribuir', value: manager.crm_attribution.missing_attribution.toLocaleString('pt-BR') },
                            ].map((item, index) => (
                                <article key={index} className="traffic-manager-kpi">
                                    <span>{item.icon}{item.label}</span>
                                    <strong>{item.value}</strong>
                                </article>
                            ))}
                        </div>

                        <div className="traffic-manager-grid">
                            <article className="traffic-manager-card">
                                <h3><Layers size={18} /> Cobertura da Meta</h3>
                                <div className="coverage-grid">
                                    {[
                                        ['Campanhas', manager.coverage.campaigns],
                                        ['Conjuntos', manager.coverage.adsets],
                                        ['Anuncios', manager.coverage.ads],
                                        ['Formularios', manager.coverage.lead_forms],
                                        ['Posicionamentos', manager.coverage.placements],
                                        ['Publicos', manager.coverage.demographics],
                                    ].map(([label, value]) => (
                                        <div key={String(label)}>
                                            <span>{label}</span>
                                            <strong>{Number(value).toLocaleString('pt-BR')}</strong>
                                        </div>
                                    ))}
                                </div>
                            </article>

                            <article className="traffic-manager-card">
                                <h3><Eye size={18} /> Melhores posicionamentos</h3>
                                <div className="traffic-list">
                                    {manager.placements.slice(0, 5).map((item, index) => (
                                        <div key={`${item.publisher_platform}-${item.platform_position}-${index}`}>
                                            <strong>{compactText(`${item.publisher_platform || '-'} / ${item.platform_position || '-'}`, 48)}</strong>
                                            <span>{formatCurrency(item.spend)} | {item.leads} lead(s) | CPL {item.cpl > 0 ? formatCurrency(item.cpl) : '-'}</span>
                                        </div>
                                    ))}
                                    {manager.placements.length === 0 && <p>Sem breakdown de posicionamentos neste periodo.</p>}
                                </div>
                            </article>

                            <article className="traffic-manager-card">
                                <h3><Smartphone size={18} /> Dispositivo e publico</h3>
                                <div className="traffic-list">
                                    {manager.devices.slice(0, 3).map((item, index) => (
                                        <div key={`${item.device_platform}-${index}`}>
                                            <strong>{item.device_platform || 'Dispositivo nao informado'}</strong>
                                            <span>{formatCurrency(item.spend)} | CTR {formatPercent(item.ctr)} | CPL {item.cpl > 0 ? formatCurrency(item.cpl) : '-'}</span>
                                        </div>
                                    ))}
                                    {manager.demographics.slice(0, 2).map((item, index) => (
                                        <div key={`${item.age}-${item.gender}-${index}`}>
                                            <strong>{item.age || '-'} / {item.gender || '-'}</strong>
                                            <span>{formatCurrency(item.spend)} | {item.leads} lead(s) | CTR {formatPercent(item.ctr)}</span>
                                        </div>
                                    ))}
                                </div>
                            </article>
                        </div>

                        <div className="traffic-manager-card" style={{ marginTop: 12 }}>
                            <h3><Brain size={18} /> Anuncios e criativos que pedem decisao</h3>
                            <div className="traffic-ads-list">
                                {manager.top_ads.slice(0, 6).map(item => (
                                    <article key={item.id}>
                                        {item.creative_thumbnail_url ? (
                                            <img src={item.creative_thumbnail_url} alt="" />
                                        ) : (
                                            <div className="traffic-ad-thumb"><Sparkles size={18} /></div>
                                        )}
                                        <div style={{ minWidth: 0 }}>
                                            <strong>{compactText(item.name || item.creative_title || 'Anuncio Meta', 84)}</strong>
                                            <p>{compactText(item.creative_body || item.campaign_name || item.adset_name || 'Sem texto do criativo.', 130)}</p>
                                            <span>{formatCurrency(item.spend)} | {item.leads} lead(s) | CPL {item.cpl > 0 ? formatCurrency(item.cpl) : '-'} | CTR {formatPercent(item.ctr)}</span>
                                        </div>
                                        <em>{item.status || 'Meta'}</em>
                                    </article>
                                ))}
                                {manager.top_ads.length === 0 && <p style={{ margin: 0, color: 'var(--text-muted)' }}>Sem leitura por anuncio neste periodo.</p>}
                            </div>
                        </div>

                        {manager.diagnostics.length > 0 && (
                            <div className="traffic-diagnostics">
                                {manager.diagnostics.map((item, index) => (
                                    <span key={index}><AlertCircle size={14} /> {item}</span>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </section>

            {!activeReport ? (
                <div className="chart-card" style={{ padding: 38, textAlign: 'center' }}>
                    <Brain size={44} color="var(--gold)" style={{ marginBottom: 12 }} />
                    <h2 style={{ margin: '0 0 8px' }}>Nenhum relatorio de trafego pago ainda</h2>
                    <p style={{ margin: '0 auto 18px', color: 'var(--text-muted)', maxWidth: 560 }}>
                        Gere a primeira analise para o agente cruzar gasto, campanhas, leads, alertas e oportunidades.
                    </p>
                    <button onClick={generateReport} disabled={generating} className="btn btn-gold">
                        <Sparkles size={16} /> Gerar primeira analise
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 18 }} className="paid-report-layout">
                    <main style={{ display: 'grid', gap: 16, minWidth: 0 }}>
                        <section className="chart-card paid-report-hero" style={{ padding: 22, background: '#17120c', color: '#fffaf0' }}>
                            <div style={{ color: 'var(--gold)', fontSize: '.74rem', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                                {formatDate(activeReport.period_start)} a {formatDate(activeReport.period_end)}
                            </div>
                            <h2 style={{ margin: '0 0 12px', color: '#fffaf0', fontSize: '1.55rem', lineHeight: 1.08 }}>
                                {activeReport.title}
                            </h2>
                            <p style={{ margin: 0, color: 'rgba(255,250,240,.82)', fontSize: '.96rem', lineHeight: 1.55 }}>
                                {activeReport.summary}
                            </p>
                        </section>

                        <section className="paid-report-kpis">
                            {[
                                { icon: <DollarSign size={18} />, label: 'Investimento', value: formatCurrency(numberMetric(metrics, 'spend')) },
                                { icon: <Target size={18} />, label: 'Leads plataforma', value: numberMetric(metrics, 'leads').toLocaleString('pt-BR') },
                                { icon: <TrendingUp size={18} />, label: 'CPL medio', value: numberMetric(metrics, 'avg_cpl') > 0 ? formatCurrency(numberMetric(metrics, 'avg_cpl')) : '-' },
                                { icon: <BarChart3 size={18} />, label: 'CTR medio', value: `${numberMetric(metrics, 'avg_ctr').toFixed(2)}%` },
                                { icon: <Brain size={18} />, label: 'Campanhas com dados', value: numberMetric(metrics, 'campaigns_with_metrics').toLocaleString('pt-BR') },
                                { icon: <AlertCircle size={18} />, label: 'Risco principal', value: textMetric(metrics, 'main_risk') },
                            ].map((item, index) => (
                                <div key={index} className="chart-card" style={{ padding: 15 }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-muted)', fontSize: '.68rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                                        <span style={{ color: 'var(--gold)' }}>{item.icon}</span> {item.label}
                                    </span>
                                    <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '1.08rem', lineHeight: 1.2 }}>
                                        {item.value}
                                    </strong>
                                </div>
                            ))}
                        </section>

                        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="paid-report-columns">
                            <div className="chart-card" style={{ padding: 18 }}>
                                <h3 style={{ margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <BarChart3 size={19} color="var(--gold)" /> Insights do agente
                                </h3>
                                <div style={{ display: 'grid', gap: 10 }}>
                                    {(activeReport.insights || []).map((item, index) => (
                                        <article key={index} className="paid-report-note">
                                            <span>{item.impact || 'leitura'}</span>
                                            <strong>{item.title || 'Insight'}</strong>
                                            <p>{item.detail || '-'}</p>
                                        </article>
                                    ))}
                                </div>
                            </div>

                            <div className="chart-card" style={{ padding: 18 }}>
                                <h3 style={{ margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <ArrowRight size={19} color="var(--gold)" /> Acoes recomendadas
                                </h3>
                                <div style={{ display: 'grid', gap: 10 }}>
                                    {(activeReport.recommendations || []).map((item, index) => (
                                        <article key={index} className="paid-report-note action">
                                            <span>{item.priority || 'prioridade'}</span>
                                            <strong>{item.title || 'Acao'}</strong>
                                            <p>{item.action || '-'}</p>
                                        </article>
                                    ))}
                                </div>
                            </div>
                        </section>
                    </main>

                    <aside className="chart-card" style={{ padding: 14, alignSelf: 'start' }}>
                        <div style={{ fontSize: '.74rem', fontWeight: 900, color: 'var(--gold)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                            Historico
                        </div>
                        <div style={{ display: 'grid', gap: 8 }}>
                            {reports.map(report => (
                                <button
                                    key={report.id}
                                    onClick={() => setActiveId(report.id)}
                                    className="paid-report-history-button"
                                    style={{
                                        textAlign: 'left',
                                        border: `1px solid ${activeReport.id === report.id ? 'rgba(201,169,110,.55)' : 'var(--border-color)'}`,
                                        background: activeReport.id === report.id ? 'rgba(201,169,110,.08)' : 'var(--bg-secondary)',
                                        color: 'var(--text-primary)',
                                        borderRadius: 10,
                                        padding: 11,
                                        cursor: 'pointer',
                                    }}
                                >
                                    <strong style={{ display: 'block', fontSize: '.82rem', lineHeight: 1.25, marginBottom: 5 }}>
                                        {report.title}
                                    </strong>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '.72rem' }}>
                                        {formatDateTime(report.created_at)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </aside>
                </div>
            )}

            <style>{`
                .ads-toast { position: fixed; top: 24px; right: 24px; padding: 14px 24px; border-radius: 12px; font-size: 0.9rem; font-weight: 500; display: flex; align-items: center; gap: 10px; z-index: 10000; animation: paidReportToastIn 0.35s ease-out; box-shadow: 0 8px 30px rgba(0,0,0,0.24); }
                .ads-toast.success { background: rgba(74,222,128,0.15); border: 1px solid rgba(74,222,128,0.3); color: var(--success); }
                .ads-toast.error { background: rgba(248,113,113,0.15); border: 1px solid rgba(248,113,113,0.3); color: var(--danger); }
                @keyframes paidReportToastIn { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }
                .traffic-manager-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
                .traffic-manager-select { min-height: 38px; border: 1px solid var(--border-color); border-radius: 10px; background: var(--bg-secondary); color: var(--text-primary); padding: 0 12px; font-weight: 800; }
                .traffic-manager-kpis { display: grid; grid-template-columns: repeat(6,minmax(0,1fr)); gap: 10px; margin-bottom: 12px; }
                .traffic-manager-kpi { border: 1px solid var(--border-color); border-radius: 12px; padding: 12px; background: rgba(255,255,255,.72); min-width: 0; }
                .traffic-manager-kpi span { display: flex; align-items: center; gap: 7px; color: var(--text-muted); font-size: .65rem; font-weight: 900; letter-spacing: .04em; text-transform: uppercase; margin-bottom: 7px; }
                .traffic-manager-kpi span svg { color: var(--gold); flex-shrink: 0; }
                .traffic-manager-kpi strong { display: block; color: var(--text-primary); font-size: 1rem; line-height: 1.15; overflow-wrap: anywhere; }
                .traffic-manager-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
                .traffic-manager-card { border: 1px solid var(--border-color); border-radius: 12px; background: rgba(255,255,255,.68); padding: 14px; min-width: 0; }
                .traffic-manager-card h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; font-size: .95rem; }
                .traffic-manager-card h3 svg { color: var(--gold); flex-shrink: 0; }
                .coverage-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }
                .coverage-grid div { border: 1px solid rgba(17,24,39,.08); border-radius: 10px; padding: 10px; background: rgba(255,255,255,.72); }
                .coverage-grid span { display: block; color: var(--text-muted); font-size: .66rem; font-weight: 900; margin-bottom: 3px; }
                .coverage-grid strong { font-size: 1.02rem; color: var(--text-primary); }
                .traffic-list { display: grid; gap: 8px; }
                .traffic-list div { border-bottom: 1px solid rgba(17,24,39,.07); padding-bottom: 8px; }
                .traffic-list div:last-child { border-bottom: 0; padding-bottom: 0; }
                .traffic-list strong { display: block; color: var(--text-primary); font-size: .84rem; margin-bottom: 3px; }
                .traffic-list span, .traffic-list p { color: var(--text-muted); font-size: .75rem; line-height: 1.4; margin: 0; }
                .traffic-ads-list { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
                .traffic-ads-list article { display: grid; grid-template-columns: 58px minmax(0,1fr) auto; gap: 10px; align-items: center; border: 1px solid rgba(17,24,39,.08); border-radius: 12px; padding: 10px; background: rgba(255,255,255,.72); }
                .traffic-ads-list img, .traffic-ad-thumb { width: 58px; height: 58px; border-radius: 10px; object-fit: cover; background: rgba(201,169,110,.13); display: grid; place-items: center; color: var(--gold); }
                .traffic-ads-list strong { display: block; font-size: .86rem; color: var(--text-primary); margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .traffic-ads-list p { margin: 0 0 4px; color: var(--text-muted); font-size: .75rem; line-height: 1.35; }
                .traffic-ads-list span { color: var(--text-muted); font-size: .72rem; font-weight: 800; }
                .traffic-ads-list em { font-style: normal; color: #92400e; border: 1px solid rgba(201,169,110,.28); background: rgba(201,169,110,.1); border-radius: 999px; padding: 4px 8px; font-size: .62rem; font-weight: 900; white-space: nowrap; }
                .traffic-diagnostics { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
                .traffic-diagnostics span { display: inline-flex; align-items: center; gap: 6px; border: 1px solid rgba(245,158,11,.22); background: rgba(245,158,11,.08); color: #92400e; border-radius: 999px; padding: 7px 10px; font-size: .72rem; font-weight: 800; }
                .paid-report-kpis { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 12px; }
                .paid-report-note { border: 1px solid rgba(17,24,39,.08); background: rgba(255,255,255,.78); border-radius: 12px; padding: 13px; }
                .paid-report-note span { display: inline-block; color: var(--gold); font-size: .62rem; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 7px; }
                .paid-report-note.action span { color: #b45309; }
                .paid-report-note strong { display: block; color: var(--text-primary); font-size: .9rem; line-height: 1.25; margin-bottom: 6px; }
                .paid-report-note p { margin: 0; color: var(--text-muted); font-size: .8rem; line-height: 1.5; }
                .paid-report-history-button { transition: border-color .2s, transform .15s; }
                .paid-report-history-button:hover { border-color: var(--gold) !important; transform: translateX(2px); }
                @media (max-width: 980px) {
                    .traffic-manager-header,
                    .paid-report-layout,
                    .paid-report-columns {
                        grid-template-columns: 1fr !important;
                        flex-direction: column;
                    }
                    .traffic-manager-kpis { grid-template-columns: repeat(3,minmax(0,1fr)); }
                    .traffic-manager-grid,
                    .traffic-ads-list {
                        grid-template-columns: 1fr;
                    }
                    .paid-report-kpis {
                        grid-template-columns: repeat(2,minmax(0,1fr));
                    }
                }
                @media (max-width: 620px) {
                    .traffic-manager-kpis,
                    .paid-report-kpis {
                        grid-template-columns: 1fr;
                    }
                    .traffic-ads-list article {
                        grid-template-columns: 48px minmax(0,1fr);
                    }
                    .traffic-ads-list em {
                        grid-column: 2;
                        justify-self: start;
                    }
                }
            `}</style>
        </div>
    )
}
