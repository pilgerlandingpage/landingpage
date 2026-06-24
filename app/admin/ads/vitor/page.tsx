'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Copy,
  Edit3,
  FileText,
  ImageIcon,
  Loader2,
  Megaphone,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  Trash2,
  UploadCloud,
  XCircle,
} from 'lucide-react'
import AdminLoadingState from '@/components/admin/AdminLoadingState'

type Creative = {
  id: string
  title: string
  description: string | null
  asset_url: string | null
  thumbnail_url: string | null
  asset_type: string
  content_type: string
  campaign_type: string
  platform_targets: string[]
  property_sku: string | null
  ai_context: string | null
  status: string
}

type VitorPlan = {
  id: string
  status: string
  objective: string | null
  audience: Record<string, unknown>
  locations: Array<Record<string, unknown>>
  budget_suggestion: Record<string, unknown>
  duration_days: number | null
  copy_variations: Array<Record<string, unknown>>
  utm: Record<string, unknown>
  pause_scale_rules: Record<string, unknown>
  raw_plan?: Record<string, unknown> | null
}

type ExecutionPackage = {
  generated_at?: string | null
  campaign_name?: string | null
  platform?: string | null
  publication_mode?: string | null
  publication_guardrail?: string | null
  setup?: Record<string, unknown>
  tracking?: Record<string, unknown>
  guardrails?: Record<string, unknown>
  human_execution_steps?: string[]
  plain_text?: string | null
}

type VitorMonitoringAlert = {
  type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  message: string
  recommendation: string
  entity?: Record<string, unknown> | null
}

type VitorMonitoringLearning = {
  type: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  title: string
  insight: string
  recommendation: string
  evidence?: Record<string, unknown> | null
}

type VitorMonitoring = {
  generated_at: string
  health: {
    score: number
    label: string
    tone: 'good' | 'medium' | 'risk'
  }
  metrics: Record<string, number>
  alerts: VitorMonitoringAlert[]
  recommendations: Array<{
    title: string
    action: string
    priority: string
  }>
  learnings: VitorMonitoringLearning[]
  top_ads: Array<Record<string, unknown>>
  pending_execution_plans: Array<Record<string, unknown>>
  diagnostics: string[]
}

type VitorReadinessItem = {
  key: string
  label: string
  status: 'ok' | 'warn' | 'missing'
  detail: string
}

type VitorReadiness = {
  score: number
  status: 'ok' | 'warn' | 'missing'
  blockers: number
  warnings: number
  items: VitorReadinessItem[]
  test_commands: string[]
}

type VitorReview = {
  id: string
  requested_by_phone: string | null
  requested_by_label: string | null
  source: string
  asset_summary: string | null
  briefing: string | null
  score: number | null
  score_label: string | null
  status: string
  recommendation: string | null
  decision: string | null
  strengths: string[]
  risks: string[]
  improvements: string[]
  persona: Record<string, unknown>
  locations: Array<Record<string, unknown>>
  campaign_angle: Record<string, unknown>
  expected_lead_quality: Record<string, unknown>
  approval_question: string | null
  created_at: string
  updated_at: string
  creative: Creative | null
  command: {
    id: string
    identity_label: string | null
    identity_type: string | null
    command_text: string | null
    created_at: string
  } | null
  campaign_plan: VitorPlan | null
}

type VitorPayload = {
  success: boolean
  ready: boolean
  error?: string
  metrics: {
    total_reviews: number
    avg_score: number
    inbox: number
    needs_improvement: number
    approved_reviews: number
    draft_plans: number
    approved_plans: number
    pending_human_decision: number
    high_risk: number
  }
  reviews: VitorReview[]
  latest_report: { id: string; title: string; summary: string | null; created_at: string } | null
  monitoring?: VitorMonitoring | null
  readiness?: VitorReadiness | null
}

type PanelMedia = {
  url: string
  mime: string
  kind: string
  filename: string | null
}

const statusLabels: Record<string, string> = {
  queued: 'Na fila',
  processing: 'Processando',
  reviewed: 'Revisado',
  failed: 'Falhou',
  cancelled: 'Cancelado',
  approved: 'Aprovado',
  needs_improvement: 'Melhorar',
  draft: 'Rascunho',
  exported: 'Exportado',
  published: 'Publicado',
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function compact(value: unknown, max = 140) {
  const text = String(value || '').trim()
  return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

function statusLabel(value?: string | null) {
  return statusLabels[String(value || '')] || String(value || '-')
}

function scoreTone(score?: number | null) {
  const value = Number(score || 0)
  if (value >= 75) return 'good'
  if (value >= 55) return 'medium'
  return 'risk'
}

function moneyLabel(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return '-'
  return `R$ ${number.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}

function percentLabel(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return `${number.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

function integerLabel(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0'
  return number.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

function severityLabel(value?: string | null) {
  if (value === 'critical') return 'Critico'
  if (value === 'high') return 'Alto'
  if (value === 'medium') return 'Medio'
  return 'Baixo'
}

function readinessStatusLabel(value?: string | null) {
  if (value === 'ok') return 'Ok'
  if (value === 'warn') return 'Atencao'
  return 'Pendente'
}

function readinessSummary(readiness?: VitorReadiness | null) {
  if (!readiness) return 'Sem diagnostico'
  if (readiness.status === 'ok') return 'Pronto para teste'
  if (readiness.blockers > 0) return `${readiness.blockers} pendencia(s)`
  return `${readiness.warnings} atencao(oes)`
}

function stringField(value: Record<string, unknown> | null | undefined, key: string) {
  const raw = value?.[key]
  return raw == null || raw === '' ? '-' : String(raw)
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringRows(value: unknown) {
  return Array.isArray(value)
    ? value.map(item => String(item || '').trim()).filter(Boolean)
    : []
}

function getExecutionPackage(review: VitorReview | null): ExecutionPackage | null {
  const rawPlan = asRecord(review?.campaign_plan?.raw_plan)
  const executionPackage = asRecord(rawPlan.execution_package)
  return Object.keys(executionPackage).length ? executionPackage as ExecutionPackage : null
}

function buildExecutionPackageText(review: VitorReview) {
  const stored = getExecutionPackage(review)?.plain_text
  if (stored && stored.trim()) return stored

  const plan = review.campaign_plan
  const copies = plan?.copy_variations || []
  return [
    'PACOTE DE EXECUCAO HUMANA - VITOR TRAFEGO PAGO',
    `Campanha: ${stringField(plan?.utm, 'campaign')}`,
    `Status: ${statusLabel(plan?.status)}`,
    `Score: ${Number(review.score || 0)} (${review.score_label || '-'})`,
    `Recomendacao: ${review.recommendation || '-'}`,
    '',
    'SETUP',
    `Objetivo: ${plan?.objective || '-'}`,
    `Verba diaria: ${moneyLabel(plan?.budget_suggestion?.daily_budget_brl)}`,
    `Duracao: ${plan?.duration_days || '-'} dias`,
    '',
    'CRIATIVO',
    `Titulo: ${review.creative?.title || '-'}`,
    `URL: ${review.creative?.asset_url || review.creative?.thumbnail_url || '-'}`,
    '',
    'COPYS',
    ...(copies.length
      ? copies.slice(0, 3).flatMap((copy, index) => [
        `${index + 1}. ${String(copy.headline || copy.label || `Copy ${index + 1}`)}`,
        `Texto: ${String(copy.primary_text || copy.text || copy.caption || '-')}`,
        `CTA: ${String(copy.cta || 'Falar no WhatsApp')}`,
      ])
      : ['- Sem variacoes registradas.']),
    '',
    'RISCOS',
    ...((review.risks || []).slice(0, 5).map(row => `- ${row}`)),
    '',
    'MELHORIAS',
    ...((review.improvements || []).slice(0, 5).map(row => `- ${row}`)),
    '',
    'OBSERVACAO',
    'Nada foi publicado automaticamente. Este pacote exige execucao e conferencia humana.',
  ].join('\n')
}

function ListBlock({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div className="vitor-list-block">
      <strong>{title}</strong>
      {rows.length ? rows.slice(0, 5).map((row, index) => <span key={`${row}-${index}`}>{row}</span>) : <span>-</span>}
    </div>
  )
}

export default function VitorTrafficManagerPage() {
  const [payload, setPayload] = useState<VitorPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [updating, setUpdating] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [monitoringSaving, setMonitoringSaving] = useState(false)
  const [panelMedia, setPanelMedia] = useState<PanelMedia[]>([])
  const [intakeForm, setIntakeForm] = useState({
    title: '',
    briefing: '',
    asset_type: 'image',
    content_type: 'ad',
  })

  const loadData = async (nextFilter = filter, silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ limit: '80' })
      if (nextFilter !== 'all') params.set('status', nextFilter)
      const response = await fetch(`/api/admin/paid-traffic/vitor?${params.toString()}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Erro ao carregar Vitor.')
      setPayload(data)
      setActiveId(current => current || data.reviews?.[0]?.id || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar Vitor.')
      setPayload(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadData(filter)
  }, [filter])

  const reviews = payload?.reviews || []
  const metrics = payload?.metrics
  const monitoring = payload?.monitoring || null
  const readiness = payload?.readiness || null
  const activeReview = useMemo(
    () => reviews.find(review => review.id === activeId) || reviews[0] || null,
    [activeId, reviews],
  )
  const activeExecutionPackage = getExecutionPackage(activeReview)
  const activeExecutionSetup = asRecord(activeExecutionPackage?.setup)
  const activeExecutionTracking = asRecord(activeExecutionPackage?.tracking)
  const activeExecutionGuardrails = asRecord(activeExecutionPackage?.guardrails)
  const activeExecutionChecklist = stringRows(activeExecutionGuardrails.pre_launch_checklist)
  const activeExecutionSteps = stringRows(activeExecutionPackage?.human_execution_steps)

  const decide = async (action: 'approve' | 'improve' | 'cancel' | 'export') => {
    if (!activeReview) return
    setUpdating(action)
    setError('')
    setToast('')
    try {
      const response = await fetch('/api/admin/paid-traffic/vitor', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_id: activeReview.id, action }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Erro ao atualizar decisao.')
      setToast(action === 'approve' ? 'Plano aprovado para execucao humana.' : action === 'improve' ? 'Criativo marcado para melhoria.' : action === 'export' ? 'Pacote de execucao preparado.' : 'Plano cancelado.')
      await loadData(filter, true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar decisao.')
    } finally {
      setUpdating('')
    }
  }

  const copyExecutionPackage = async () => {
    if (!activeReview) return
    setError('')
    setToast('')
    try {
      await navigator.clipboard.writeText(buildExecutionPackageText(activeReview))
      setToast(activeExecutionPackage ? 'Pacote de execucao copiado.' : 'Rascunho de execucao copiado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao consegui copiar o pacote de execucao.')
    }
  }

  const copyReadinessCommand = async (command: string) => {
    setError('')
    setToast('')
    try {
      await navigator.clipboard.writeText(command)
      setToast('Mensagem de teste copiada.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao consegui copiar a mensagem de teste.')
    }
  }

  const registerMonitoring = async () => {
    setMonitoringSaving(true)
    setError('')
    setToast('')
    try {
      const response = await fetch('/api/admin/paid-traffic/vitor/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date_preset: 'last_7d' }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Erro ao registrar monitoramento.')
      setPayload(current => current ? { ...current, monitoring: data.monitoring } : current)
      setToast('Monitoramento do Vitor registrado na Central.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar monitoramento.')
    } finally {
      setMonitoringSaving(false)
    }
  }

  const uploadPanelFiles = async (files?: FileList | null) => {
    const selected = Array.from(files || []).slice(0, 8)
    if (selected.length === 0) return
    setUploading(true)
    setError('')
    setToast('')
    try {
      const uploaded: PanelMedia[] = []
      for (const file of selected) {
        const kind = file.type.startsWith('video/')
          ? 'video'
          : file.type.startsWith('image/')
            ? 'image'
            : 'document'
        const formData = new FormData()
        formData.append('file', file)
        formData.append('folder', 'vitor-creatives')
        formData.append('kind', kind)
        const response = await fetch('/api/upload', { method: 'POST', body: formData })
        const data = await response.json().catch(() => ({}))
        if (!response.ok || !data.url) throw new Error(data.error || data.details || `Falha ao enviar ${file.name}.`)
        uploaded.push({
          url: data.url,
          mime: file.type,
          kind,
          filename: file.name,
        })
      }
      setPanelMedia(current => [...current, ...uploaded].slice(0, 10))
      setIntakeForm(current => ({
        ...current,
        asset_type: uploaded.length + panelMedia.length > 1 ? 'carousel' : uploaded[0]?.kind || current.asset_type,
      }))
      setToast(`${uploaded.length} arquivo(s) enviados para o Vitor.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar criativo.')
    } finally {
      setUploading(false)
    }
  }

  const submitPanelCreative = async () => {
    setCreating(true)
    setError('')
    setToast('')
    try {
      const response = await fetch('/api/admin/paid-traffic/vitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...intakeForm,
          asset_type: panelMedia.length > 1 ? 'carousel' : intakeForm.asset_type,
          media: panelMedia,
          requested_by_label: 'Painel do Vitor',
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Erro ao analisar criativo.')
      setToast(`Vitor analisou o criativo. Score: ${data.score}/100.`)
      setIntakeForm({ title: '', briefing: '', asset_type: 'image', content_type: 'ad' })
      setPanelMedia([])
      setFilter('all')
      await loadData('all', true)
      if (data.reviewId) setActiveId(data.reviewId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao analisar criativo.')
    } finally {
      setCreating(false)
    }
  }

  if (loading && !payload) return <AdminLoadingState message="Carregando area do Vitor..." />

  if (payload && !payload.ready) {
    return (
      <div className="chart-card vitor-not-ready">
        <AlertTriangle size={30} />
        <h1>Area do Vitor aguardando banco</h1>
        <p>A API nao encontrou as tabelas de reviews e planos. Confirme a migration do Vitor no Supabase e atualize a pagina.</p>
        <button type="button" className="btn btn-gold" onClick={() => loadData(filter)}>
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>
    )
  }

  return (
    <div>
      {(toast || error) && (
        <div className={`vitor-toast ${error ? 'error' : 'success'}`}>
          {error ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          {error || toast}
        </div>
      )}

      <div className="admin-header vitor-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/admin/ads" className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
              <Sparkles size={26} /> Vitor Trafego Pago
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '.86rem', marginTop: 4 }}>
              Caixa de entrada, score de criativos, planos em rascunho e aprovacao humana.
            </p>
          </div>
        </div>
        <div className="vitor-header-actions">
          <Link href="/admin/ads/creatives" className="btn btn-outline" style={{ textDecoration: 'none' }}>
            <ImageIcon size={17} /> Criativos
          </Link>
          <Link href="/admin/ads/relatorio" className="btn btn-outline" style={{ textDecoration: 'none' }}>
            <BarChart3 size={17} /> Relatorios
          </Link>
          <button type="button" className="btn btn-gold" disabled={refreshing} onClick={() => loadData(filter, true)}>
            <RefreshCw size={17} className={refreshing ? 'spin' : ''} /> Atualizar
          </button>
        </div>
      </div>

      <section className="vitor-metrics-grid">
        {[
          { icon: <ClipboardList size={18} />, label: 'Inbox', value: metrics?.inbox || 0, detail: `${metrics?.pending_human_decision || 0} aguardam decisao` },
          { icon: <Target size={18} />, label: 'Score medio', value: metrics?.avg_score || 0, detail: `${metrics?.high_risk || 0} risco alto` },
          { icon: <Edit3 size={18} />, label: 'Melhorias', value: metrics?.needs_improvement || 0, detail: 'criativos para ajustar' },
          { icon: <CheckCircle2 size={18} />, label: 'Aprovados', value: metrics?.approved_plans || 0, detail: `${metrics?.draft_plans || 0} planos em rascunho` },
        ].map(item => (
          <article key={item.label} className="vitor-metric-card">
            <span>{item.icon}{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </section>

      <section className="chart-card vitor-readiness-card">
        <div className="vitor-section-title">
          <span>Diagnostico de teste</span>
          <strong>{readinessSummary(readiness)}</strong>
        </div>
        <div className="vitor-readiness-head">
          <div className={`vitor-readiness-score ${readiness?.status || 'missing'}`}>
            <span>Preparo</span>
            <strong>{readiness?.score ?? '-'}</strong>
            <small>{readinessStatusLabel(readiness?.status)}</small>
          </div>
          <div className="vitor-readiness-grid">
            {(readiness?.items || []).map(item => (
              <article key={item.key} className={`vitor-readiness-item ${item.status}`}>
                <span>
                  {item.status === 'ok' ? <CheckCircle2 size={15} /> : item.status === 'warn' ? <AlertTriangle size={15} /> : <XCircle size={15} />}
                  {item.label}
                </span>
                <strong>{readinessStatusLabel(item.status)}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
        {readiness?.test_commands?.length ? (
          <div className="vitor-test-commands">
            {readiness.test_commands.map((command, index) => (
              <div key={`${command}-${index}`}>
                <span>{command}</span>
                <button type="button" onClick={() => copyReadinessCommand(command)} aria-label="Copiar mensagem de teste">
                  <Copy size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="chart-card vitor-monitoring-card">
        <div className="vitor-section-title">
          <span>Gestao continua</span>
          <strong>{monitoring ? `Atualizado ${formatDateTime(monitoring.generated_at)}` : 'Sem leitura'}</strong>
        </div>
        <div className="vitor-monitoring-head">
          <div className={`vitor-health-ring ${monitoring?.health?.tone || 'medium'}`}>
            <span>Saude</span>
            <strong>{monitoring?.health?.score ?? '-'}</strong>
            <small>{monitoring?.health?.label || 'Aguardando'}</small>
          </div>
          <div className="vitor-monitoring-kpis">
            {[
              { icon: <TrendingUp size={16} />, label: 'Gasto', value: moneyLabel(monitoring?.metrics?.spend) },
              { icon: <Target size={16} />, label: 'Leads Meta', value: integerLabel(monitoring?.metrics?.leads) },
              { icon: <Activity size={16} />, label: 'CPL', value: moneyLabel(monitoring?.metrics?.avg_cpl) },
              { icon: <BarChart3 size={16} />, label: 'Qualidade CRM', value: percentLabel(monitoring?.metrics?.crm_quality_rate) },
            ].map(item => (
              <div key={item.label}>
                <span>{item.icon}{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
          <div className="vitor-monitoring-action">
            <button type="button" className="btn btn-gold" disabled={monitoringSaving} onClick={registerMonitoring}>
              {monitoringSaving ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}
              {monitoringSaving ? 'Registrando...' : 'Registrar na Central'}
            </button>
            <span>{monitoring?.alerts?.length || 0} alerta(s) ativos</span>
          </div>
        </div>
        <div className="vitor-monitoring-grid">
          <article>
            <h3><AlertTriangle size={17} /> Alertas do Vitor</h3>
            <div className="vitor-monitoring-list">
              {(monitoring?.alerts || []).slice(0, 4).map((alert, index) => (
                <div key={`${alert.title}-${index}`} className={`vitor-alert-item ${alert.severity}`}>
                  <strong>{alert.title}</strong>
                  <span>{severityLabel(alert.severity)} | {alert.message}</span>
                  <p>{alert.recommendation}</p>
                </div>
              ))}
              {(!monitoring?.alerts || monitoring.alerts.length === 0) && (
                <p className="vitor-muted">Sem alertas relevantes nos ultimos dados.</p>
              )}
            </div>
          </article>
          <article>
            <h3><ClipboardList size={17} /> Recomendacoes</h3>
            <div className="vitor-monitoring-list">
              {(monitoring?.recommendations || []).slice(0, 4).map((item, index) => (
                <div key={`${item.title}-${index}`}>
                  <strong>{item.title}</strong>
                  <p>{item.action}</p>
                </div>
              ))}
              {(!monitoring?.recommendations || monitoring.recommendations.length === 0) && (
                <p className="vitor-muted">Nada urgente para recomendar agora.</p>
              )}
            </div>
          </article>
          <article>
            <h3><Megaphone size={17} /> Criativos em campanha</h3>
            <div className="vitor-monitoring-list">
              {(monitoring?.top_ads || []).slice(0, 4).map((ad, index) => (
                <div key={`${String(ad.id || ad.name || index)}`}>
                  <strong>{String(ad.name || ad.creative_title || `Anuncio ${index + 1}`)}</strong>
                  <span>
                    {moneyLabel(ad.spend)} | {integerLabel(ad.leads)} lead(s) | CPL {moneyLabel(ad.cpl)}
                  </span>
                </div>
              ))}
              {(!monitoring?.top_ads || monitoring.top_ads.length === 0) && (
                <p className="vitor-muted">Sem anuncios lidos da Meta neste periodo.</p>
              )}
            </div>
          </article>
          <article>
            <h3><Sparkles size={17} /> Aprendizados</h3>
            <div className="vitor-monitoring-list">
              {(monitoring?.learnings || []).slice(0, 4).map((item, index) => (
                <div key={`${item.title}-${index}`} className={`vitor-alert-item ${item.priority}`}>
                  <strong>{item.title}</strong>
                  <span>{severityLabel(item.priority)} | {item.insight}</span>
                  <p>{item.recommendation}</p>
                </div>
              ))}
              {(!monitoring?.learnings || monitoring.learnings.length === 0) && (
                <p className="vitor-muted">Ainda sem aprendizados suficientes nesta janela.</p>
              )}
            </div>
          </article>
        </div>
        {monitoring?.diagnostics?.length ? (
          <div className="vitor-monitoring-diagnostics">
            {monitoring.diagnostics.slice(0, 4).map((item, index) => (
              <span key={`${item}-${index}`}>{item}</span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="chart-card vitor-intake">
        <div className="vitor-section-title">
          <span>Novo criativo para analise</span>
          <strong>Nada sera publicado automaticamente</strong>
        </div>
        <div className="vitor-intake-grid">
          <label>
            <span>Titulo</span>
            <input
              value={intakeForm.title}
              onChange={event => setIntakeForm(current => ({ ...current, title: event.target.value }))}
              placeholder="Ex: Reel frente mar - teste Balneario"
            />
          </label>
          <label>
            <span>Formato</span>
            <select
              value={intakeForm.asset_type}
              onChange={event => setIntakeForm(current => ({ ...current, asset_type: event.target.value }))}
            >
              <option value="image">Imagem</option>
              <option value="video">Video</option>
              <option value="carousel">Carrossel</option>
              <option value="document">Documento</option>
              <option value="other">Outro</option>
            </select>
          </label>
          <label>
            <span>Canal</span>
            <select
              value={intakeForm.content_type}
              onChange={event => setIntakeForm(current => ({ ...current, content_type: event.target.value }))}
            >
              <option value="ad">Anuncio</option>
              <option value="reel">Reel</option>
              <option value="story">Story</option>
              <option value="post">Post</option>
              <option value="short">Short</option>
              <option value="other">Outro</option>
            </select>
          </label>
        </div>
        <label className="vitor-briefing-field">
          <span>Briefing para o Vitor</span>
          <textarea
            value={intakeForm.briefing}
            onChange={event => setIntakeForm(current => ({ ...current, briefing: event.target.value }))}
            placeholder="Descreva objetivo, imovel, regiao, verba desejada, publico e qualquer contexto comercial relevante."
          />
        </label>
        <div className="vitor-upload-row">
          <label className={`vitor-upload-button ${uploading ? 'disabled' : ''}`}>
            {uploading ? <Loader2 size={18} className="spin" /> : <UploadCloud size={18} />}
            {uploading ? 'Enviando...' : 'Enviar imagem, video ou PDF'}
            <input
              type="file"
              accept="image/*,video/mp4,video/webm,application/pdf"
              multiple
              disabled={uploading || creating}
              onChange={event => {
                void uploadPanelFiles(event.target.files)
                event.currentTarget.value = ''
              }}
            />
          </label>
          <button
            type="button"
            className="btn btn-gold"
            disabled={creating || uploading || (!intakeForm.title.trim() && !intakeForm.briefing.trim() && panelMedia.length === 0)}
            onClick={submitPanelCreative}
          >
            {creating ? <Loader2 size={17} className="spin" /> : <Send size={17} />}
            {creating ? 'Analisando...' : 'Analisar com Vitor'}
          </button>
        </div>
        {panelMedia.length > 0 && (
          <div className="vitor-media-chips">
            {panelMedia.map((media, index) => (
              <span key={`${media.url}-${index}`}>
                {media.kind === 'video' ? <Megaphone size={14} /> : media.kind === 'image' ? <ImageIcon size={14} /> : <FileText size={14} />}
                {media.filename || `Arquivo ${index + 1}`}
                <button
                  type="button"
                  onClick={() => setPanelMedia(current => current.filter((_, itemIndex) => itemIndex !== index))}
                  disabled={creating || uploading}
                  aria-label="Remover arquivo"
                >
                  <Trash2 size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {payload?.latest_report && (
        <section className="chart-card vitor-report-strip">
          <FileText size={18} />
          <div>
            <strong>{payload.latest_report.title}</strong>
            <span>{compact(payload.latest_report.summary, 220)}</span>
          </div>
          <Link href="/admin/ads/relatorio" className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>
            Ver
          </Link>
        </section>
      )}

      <div className="vitor-toolbar">
        <div className="vitor-tabs">
          {[
            ['all', 'Todos'],
            ['reviewed', 'Revisados'],
            ['needs_improvement', 'Melhorar'],
            ['approved', 'Aprovados'],
            ['cancelled', 'Cancelados'],
          ].map(([key, label]) => (
            <button key={key} type="button" className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>
              {label}
            </button>
          ))}
        </div>
        <span>{reviews.length} analise(s)</span>
      </div>

      <div className="vitor-layout">
        <section className="chart-card vitor-inbox">
          <div className="vitor-section-title">
            <span>Inbox de criativos</span>
            <strong>{reviews.length}</strong>
          </div>
          <div className="vitor-review-list">
            {reviews.map(review => (
              <button
                key={review.id}
                type="button"
                className={`vitor-review-item ${activeReview?.id === review.id ? 'active' : ''}`}
                onClick={() => setActiveId(review.id)}
              >
                <div className={`vitor-score-pill ${scoreTone(review.score)}`}>
                  {Number(review.score || 0)}
                </div>
                <div>
                  <strong>{review.creative?.title || compact(review.briefing, 80) || 'Criativo recebido'}</strong>
                  <p>{compact(review.recommendation || review.briefing || 'Sem recomendacao registrada.', 150)}</p>
                  <span>{statusLabel(review.status)} | {formatDateTime(review.created_at)}</span>
                </div>
              </button>
            ))}
            {reviews.length === 0 && (
              <div className="vitor-empty">Nenhum criativo analisado neste filtro.</div>
            )}
          </div>
        </section>

        <main className="vitor-detail">
          {!activeReview ? (
            <section className="chart-card vitor-empty-detail">
              <Megaphone size={34} />
              <h2>Aguardando primeiro comando</h2>
              <p>Quando o WhatsApp Global receber pedidos de trafego, o Vitor vai listar score, riscos e plano aqui.</p>
            </section>
          ) : (
            <>
              <section className="chart-card vitor-detail-hero">
                <div className="vitor-creative-preview">
                  {activeReview.creative?.thumbnail_url || activeReview.creative?.asset_url ? (
                    <img src={activeReview.creative.thumbnail_url || activeReview.creative.asset_url || ''} alt="" />
                  ) : (
                    <ImageIcon size={34} />
                  )}
                </div>
                <div className="vitor-detail-main">
                  <div className="vitor-detail-kicker">
                    <span>{statusLabel(activeReview.status)}</span>
                    <span>{activeReview.creative?.asset_type || 'criativo'}</span>
                    <span>{activeReview.requested_by_label || activeReview.command?.identity_label || 'WhatsApp Global'}</span>
                  </div>
                  <h2>{activeReview.creative?.title || 'Criativo recebido pelo WhatsApp Global'}</h2>
                  <p>{activeReview.recommendation || activeReview.briefing || 'Sem recomendacao registrada.'}</p>
                  <div className="vitor-decision-row">
                    <button type="button" className="btn btn-gold" disabled={Boolean(updating)} onClick={() => decide('approve')}>
                      <CheckCircle2 size={16} /> {updating === 'approve' ? 'Aprovando...' : 'Aprovar plano'}
                    </button>
                    <button type="button" className="btn btn-outline" disabled={Boolean(updating)} onClick={() => decide('improve')}>
                      <Edit3 size={16} /> Melhorar criativo
                    </button>
                    <button type="button" className="btn btn-outline" disabled={Boolean(updating)} onClick={() => decide('export')}>
                      <ClipboardList size={16} /> {updating === 'export' ? 'Preparando...' : 'Preparar execucao'}
                    </button>
                    <button type="button" className="btn btn-outline danger" disabled={Boolean(updating)} onClick={() => decide('cancel')}>
                      <XCircle size={16} /> Cancelar
                    </button>
                  </div>
                </div>
                <div className={`vitor-score-card ${scoreTone(activeReview.score)}`}>
                  <span>Score</span>
                  <strong>{Number(activeReview.score || 0)}</strong>
                  <small>{activeReview.score_label || '-'}</small>
                </div>
              </section>

              <section className="vitor-analysis-grid">
                <ListBlock title="Pontos fortes" rows={activeReview.strengths || []} />
                <ListBlock title="Riscos" rows={activeReview.risks || []} />
                <ListBlock title="Melhorias" rows={activeReview.improvements || []} />
              </section>

              <section className="vitor-bottom-grid">
                <article className="chart-card vitor-plan-card">
                  <div className="vitor-section-title">
                    <span>Rascunho de campanha</span>
                    <strong>{statusLabel(activeReview.campaign_plan?.status)}</strong>
                  </div>
                  <div className="vitor-plan-lines">
                    <div>
                      <span>Objetivo</span>
                      <strong>{activeReview.campaign_plan?.objective || '-'}</strong>
                    </div>
                    <div>
                      <span>Verba teste</span>
                      <strong>
                        {moneyLabel(activeReview.campaign_plan?.budget_suggestion?.daily_budget_brl)}
                        {' / dia'}
                      </strong>
                    </div>
                    <div>
                      <span>Duracao</span>
                      <strong>{activeReview.campaign_plan?.duration_days || '-'} dias</strong>
                    </div>
                    <div>
                      <span>UTM</span>
                      <strong>{stringField(activeReview.campaign_plan?.utm, 'campaign')}</strong>
                    </div>
                  </div>
                  <div className="vitor-copy-list">
                    {(activeReview.campaign_plan?.copy_variations || []).slice(0, 3).map((copy, index) => (
                      <div key={index}>
                        <strong>{String(copy.headline || copy.label || `Copy ${index + 1}`)}</strong>
                        <p>{compact(copy.primary_text || copy.text || copy.caption, 220)}</p>
                        <span>{String(copy.cta || 'Falar no WhatsApp')}</span>
                      </div>
                    ))}
                    {(activeReview.campaign_plan?.copy_variations || []).length === 0 && (
                      <p className="vitor-muted">Sem variacoes de copy registradas.</p>
                    )}
                  </div>
                </article>

                <article className="chart-card vitor-intel-card">
                  <div className="vitor-section-title">
                    <span>Leitura comercial</span>
                    <strong>{activeReview.approval_question || 'Aguardando decisao'}</strong>
                  </div>
                  <div className="vitor-intel-grid">
                    <div>
                      <span>Persona</span>
                      <strong>{stringField(activeReview.persona, 'label')}</strong>
                      <p>{stringField(activeReview.persona, 'intent')}</p>
                    </div>
                    <div>
                      <span>Gancho</span>
                      <strong>{stringField(activeReview.campaign_angle, 'hook')}</strong>
                      <p>{stringField(activeReview.campaign_angle, 'cta')}</p>
                    </div>
                    <div>
                      <span>Qualidade esperada</span>
                      <strong>{stringField(activeReview.expected_lead_quality, 'quality')}</strong>
                      <p>{stringField(activeReview.expected_lead_quality, 'reason')}</p>
                    </div>
                  </div>
                </article>
              </section>

              <section className="chart-card vitor-execution-card">
                <div className="vitor-section-title">
                  <span>Pacote de execucao humana</span>
                  <strong>
                    {activeExecutionPackage
                      ? `Gerado ${formatDateTime(activeExecutionPackage.generated_at)}`
                      : 'Aguardando preparo'}
                  </strong>
                </div>
                <div className="vitor-execution-grid">
                  <div>
                    <span>Campanha</span>
                    <strong>{activeExecutionPackage?.campaign_name || stringField(activeReview.campaign_plan?.utm, 'campaign')}</strong>
                  </div>
                  <div>
                    <span>Plataforma</span>
                    <strong>{activeExecutionPackage?.platform || 'meta_ads'}</strong>
                  </div>
                  <div>
                    <span>Verba diaria</span>
                    <strong>{moneyLabel(activeExecutionSetup.daily_budget_brl || activeReview.campaign_plan?.budget_suggestion?.daily_budget_brl)}</strong>
                  </div>
                  <div>
                    <span>UTM</span>
                    <strong>{stringField(activeExecutionTracking, 'utm_campaign')}</strong>
                  </div>
                </div>
                <div className="vitor-execution-warning">
                  <AlertTriangle size={16} />
                  <span>{activeExecutionPackage?.publication_guardrail || 'Nada foi publicado automaticamente.'}</span>
                </div>
                <div className="vitor-execution-actions">
                  <button type="button" className="btn btn-outline" onClick={copyExecutionPackage}>
                    <Copy size={16} /> {activeExecutionPackage ? 'Copiar pacote' : 'Copiar rascunho'}
                  </button>
                  <span>{activeExecutionPackage ? statusLabel(activeReview.campaign_plan?.status) : 'Rascunho disponivel'}</span>
                </div>
                <div className="vitor-execution-lists">
                  <div>
                    <strong>Checklist</strong>
                    {(activeExecutionChecklist.length
                      ? activeExecutionChecklist
                      : [
                        'Conferir criativo, publico e verba.',
                        'Validar copy e destino antes de ativar.',
                        'Aplicar UTM e registrar origem no CRM.',
                      ]
                    ).slice(0, 5).map((row, index) => (
                      <span key={`check-${index}`}>{row}</span>
                    ))}
                  </div>
                  <div>
                    <strong>Passos</strong>
                    {(activeExecutionSteps.length
                      ? activeExecutionSteps
                      : [
                        'Criar campanha em rascunho no gerenciador.',
                        'Adicionar criativo, copy e publico sugerido.',
                        'Publicar somente apos conferencia humana.',
                      ]
                    ).slice(0, 5).map((row, index) => (
                      <span key={`step-${index}`}>{row}</span>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}
        </main>
      </div>

      <style jsx>{`
        .vitor-header {
          gap: 16px;
        }

        .vitor-header-actions,
        .vitor-decision-row,
        .vitor-toolbar,
        .vitor-tabs {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .vitor-metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 16px;
        }

        .vitor-intake {
          padding: 16px;
          margin-bottom: 16px;
        }

        .vitor-intake-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(160px, .45fr) minmax(160px, .45fr);
          gap: 12px;
          margin-bottom: 12px;
        }

        .vitor-intake label,
        .vitor-briefing-field {
          display: grid;
          gap: 6px;
        }

        .vitor-intake label > span,
        .vitor-briefing-field > span {
          color: var(--text-muted);
          font-size: .68rem;
          font-weight: 900;
          letter-spacing: .07em;
          text-transform: uppercase;
        }

        .vitor-intake input,
        .vitor-intake select,
        .vitor-intake textarea {
          width: 100%;
          border: 1px solid var(--border-color);
          border-radius: 10px;
          background: #fff;
          color: var(--text-primary);
          font: inherit;
          font-size: .86rem;
          padding: 10px 12px;
          outline: none;
        }

        .vitor-intake textarea {
          min-height: 96px;
          resize: vertical;
        }

        .vitor-intake input:focus,
        .vitor-intake select:focus,
        .vitor-intake textarea:focus {
          border-color: rgba(201, 169, 110, .72);
          box-shadow: 0 0 0 3px rgba(201, 169, 110, .14);
        }

        .vitor-upload-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 12px;
        }

        .vitor-upload-button {
          display: inline-flex !important;
          align-items: center;
          gap: 8px !important;
          width: auto;
          border: 1px dashed rgba(201, 169, 110, .6);
          border-radius: 10px;
          background: rgba(201, 169, 110, .08);
          color: #92400e;
          cursor: pointer;
          font-size: .82rem;
          font-weight: 900;
          padding: 10px 13px;
        }

        .vitor-upload-button input {
          display: none;
        }

        .vitor-upload-button.disabled {
          cursor: wait;
          opacity: .68;
        }

        .vitor-media-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .vitor-media-chips > span {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          max-width: 280px;
          border: 1px solid rgba(17, 24, 39, .08);
          border-radius: 999px;
          background: #fff;
          color: var(--text-primary);
          font-size: .75rem;
          font-weight: 800;
          padding: 7px 8px 7px 10px;
        }

        .vitor-media-chips > span svg {
          color: var(--gold);
          flex: 0 0 auto;
        }

        .vitor-media-chips button {
          display: grid;
          place-items: center;
          width: 24px;
          height: 24px;
          border: 0;
          border-radius: 999px;
          background: rgba(185, 28, 28, .08);
          color: #b91c1c;
          cursor: pointer;
          margin-left: 2px;
        }

        .vitor-metric-card {
          border: 1px solid var(--border-color);
          border-radius: 10px;
          background: #fff;
          padding: 16px;
          min-height: 132px;
          display: grid;
          gap: 7px;
        }

        .vitor-metric-card span {
          display: flex;
          align-items: center;
          gap: 7px;
          color: var(--text-muted);
          font-size: .72rem;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .vitor-metric-card span svg {
          color: var(--gold);
        }

        .vitor-metric-card strong {
          color: var(--text-primary);
          font-size: 2rem;
          line-height: 1;
        }

        .vitor-metric-card small,
        .vitor-toolbar > span,
        .vitor-muted {
          color: var(--text-muted);
          font-size: .78rem;
        }

        .vitor-monitoring-card {
          padding: 16px;
          margin-bottom: 16px;
        }

        .vitor-readiness-card {
          padding: 16px;
          margin-bottom: 16px;
        }

        .vitor-readiness-head {
          display: grid;
          grid-template-columns: 118px minmax(0, 1fr);
          gap: 12px;
          align-items: stretch;
        }

        .vitor-readiness-score {
          display: grid;
          place-items: center;
          align-content: center;
          min-height: 118px;
          border-radius: 10px;
          color: #fff;
          padding: 12px;
        }

        .vitor-readiness-score.ok {
          background: #047857;
        }

        .vitor-readiness-score.warn {
          background: #b45309;
        }

        .vitor-readiness-score.missing {
          background: #b91c1c;
        }

        .vitor-readiness-score span,
        .vitor-readiness-score small {
          font-size: .66rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .vitor-readiness-score strong {
          font-size: 2.1rem;
          line-height: 1;
        }

        .vitor-readiness-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 9px;
        }

        .vitor-readiness-item {
          border: 1px solid rgba(17, 24, 39, .08);
          border-radius: 10px;
          background: rgba(255,255,255,.72);
          padding: 10px;
          min-width: 0;
        }

        .vitor-readiness-item span {
          display: flex;
          align-items: center;
          gap: 7px;
          color: var(--text-muted);
          font-size: .66rem;
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 5px;
        }

        .vitor-readiness-item.ok span svg {
          color: #047857;
        }

        .vitor-readiness-item.warn span svg {
          color: #b45309;
        }

        .vitor-readiness-item.missing span svg {
          color: #b91c1c;
        }

        .vitor-readiness-item strong {
          display: block;
          color: var(--text-primary);
          font-size: .82rem;
          margin-bottom: 4px;
        }

        .vitor-readiness-item p {
          color: var(--text-muted);
          font-size: .72rem;
          line-height: 1.35;
          margin: 0;
        }

        .vitor-test-commands {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 8px;
          margin-top: 12px;
        }

        .vitor-test-commands div {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 32px;
          gap: 8px;
          align-items: center;
          border: 1px solid rgba(17, 24, 39, .08);
          border-radius: 10px;
          background: rgba(255,255,255,.72);
          padding: 9px;
          min-width: 0;
        }

        .vitor-test-commands span {
          color: var(--text-primary);
          font-size: .75rem;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .vitor-test-commands button {
          width: 32px;
          height: 32px;
          border: 1px solid rgba(17, 24, 39, .1);
          border-radius: 8px;
          background: #fff;
          color: var(--text-primary);
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .vitor-monitoring-head {
          display: grid;
          grid-template-columns: 132px minmax(0, 1fr) auto;
          gap: 14px;
          align-items: stretch;
          margin-bottom: 14px;
        }

        .vitor-health-ring {
          display: grid;
          place-items: center;
          align-content: center;
          min-height: 132px;
          border-radius: 12px;
          color: #fff;
          padding: 12px;
        }

        .vitor-health-ring.good {
          background: #047857;
        }

        .vitor-health-ring.medium {
          background: #b45309;
        }

        .vitor-health-ring.risk {
          background: #b91c1c;
        }

        .vitor-health-ring span,
        .vitor-health-ring small {
          font-size: .68rem;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .vitor-health-ring strong {
          font-size: 2.4rem;
          line-height: 1;
        }

        .vitor-monitoring-kpis,
        .vitor-monitoring-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .vitor-monitoring-kpis div,
        .vitor-monitoring-grid article {
          border: 1px solid rgba(17, 24, 39, .08);
          border-radius: 10px;
          background: rgba(255,255,255,.72);
          padding: 12px;
          min-width: 0;
        }

        .vitor-monitoring-kpis span {
          display: flex;
          align-items: center;
          gap: 7px;
          color: var(--text-muted);
          font-size: .66rem;
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .vitor-monitoring-kpis span svg,
        .vitor-monitoring-grid h3 svg {
          color: var(--gold);
          flex-shrink: 0;
        }

        .vitor-monitoring-kpis strong {
          color: var(--text-primary);
          font-size: 1rem;
          line-height: 1.2;
        }

        .vitor-monitoring-action {
          display: grid;
          gap: 8px;
          align-content: center;
          justify-items: end;
          min-width: 180px;
        }

        .vitor-monitoring-action span {
          color: var(--text-muted);
          font-size: .74rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .vitor-monitoring-grid {
          grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
        }

        .vitor-monitoring-grid h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 0 10px;
          color: var(--text-primary);
          font-size: .92rem;
        }

        .vitor-monitoring-list {
          display: grid;
          gap: 8px;
        }

        .vitor-monitoring-list div {
          border-top: 1px solid rgba(17, 24, 39, .07);
          padding-top: 8px;
        }

        .vitor-monitoring-list div:first-child {
          border-top: 0;
          padding-top: 0;
        }

        .vitor-monitoring-list strong {
          display: block;
          color: var(--text-primary);
          font-size: .82rem;
          line-height: 1.28;
          margin-bottom: 4px;
        }

        .vitor-monitoring-list span,
        .vitor-monitoring-list p {
          display: block;
          color: var(--text-muted);
          font-size: .74rem;
          line-height: 1.38;
          margin: 0;
        }

        .vitor-alert-item.critical strong,
        .vitor-alert-item.high strong {
          color: #b91c1c;
        }

        .vitor-alert-item.medium strong {
          color: #92400e;
        }

        .vitor-alert-item.low strong {
          color: #047857;
        }

        .vitor-monitoring-diagnostics {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .vitor-monitoring-diagnostics span {
          border: 1px solid rgba(245, 158, 11, .22);
          border-radius: 999px;
          background: rgba(245, 158, 11, .08);
          color: #92400e;
          font-size: .7rem;
          font-weight: 800;
          padding: 7px 10px;
        }

        .vitor-report-strip {
          display: grid;
          grid-template-columns: 28px minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
          margin-bottom: 16px;
          padding: 14px;
        }

        .vitor-report-strip svg {
          color: var(--gold);
        }

        .vitor-report-strip strong {
          display: block;
          color: var(--text-primary);
          font-size: .9rem;
          margin-bottom: 3px;
        }

        .vitor-report-strip span {
          display: block;
          color: var(--text-muted);
          font-size: .78rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .vitor-toolbar {
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .vitor-tabs button {
          border: 1px solid var(--border-color);
          border-radius: 999px;
          background: #fff;
          color: var(--text-primary);
          padding: 8px 12px;
          font-size: .74rem;
          font-weight: 900;
          cursor: pointer;
        }

        .vitor-tabs button.active {
          background: #17120c;
          color: #fffaf0;
          border-color: rgba(201, 169, 110, .55);
        }

        .vitor-layout {
          display: grid;
          grid-template-columns: 380px minmax(0, 1fr);
          gap: 18px;
          align-items: start;
        }

        .vitor-inbox {
          padding: 14px;
          position: sticky;
          top: 18px;
        }

        .vitor-section-title {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .vitor-section-title span {
          color: var(--gold);
          font-size: .7rem;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .vitor-section-title strong {
          color: var(--text-muted);
          font-size: .78rem;
          text-align: right;
        }

        .vitor-review-list {
          display: grid;
          gap: 10px;
          max-height: 760px;
          overflow: auto;
          padding-right: 4px;
        }

        .vitor-review-item {
          width: 100%;
          display: grid;
          grid-template-columns: 54px minmax(0, 1fr);
          gap: 10px;
          align-items: start;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          background: #fff;
          color: var(--text-primary);
          padding: 11px;
          text-align: left;
          cursor: pointer;
        }

        .vitor-review-item.active,
        .vitor-review-item:hover {
          border-color: rgba(201, 169, 110, .55);
          background: rgba(201, 169, 110, .08);
        }

        .vitor-review-item strong {
          display: block;
          color: var(--text-primary);
          font-size: .86rem;
          line-height: 1.25;
          margin-bottom: 5px;
        }

        .vitor-review-item p {
          margin: 0 0 6px;
          color: var(--text-muted);
          font-size: .75rem;
          line-height: 1.38;
        }

        .vitor-review-item span {
          color: var(--text-muted);
          font-size: .68rem;
          font-weight: 800;
        }

        .vitor-score-pill,
        .vitor-score-card {
          display: grid;
          place-items: center;
          border-radius: 12px;
          font-weight: 900;
        }

        .vitor-score-pill {
          height: 54px;
          color: #fff;
        }

        .vitor-score-pill.good,
        .vitor-score-card.good {
          background: #047857;
        }

        .vitor-score-pill.medium,
        .vitor-score-card.medium {
          background: #b45309;
        }

        .vitor-score-pill.risk,
        .vitor-score-card.risk {
          background: #b91c1c;
        }

        .vitor-detail {
          display: grid;
          gap: 16px;
          min-width: 0;
        }

        .vitor-detail-hero {
          display: grid;
          grid-template-columns: 156px minmax(0, 1fr) 116px;
          gap: 16px;
          align-items: stretch;
          padding: 16px;
        }

        .vitor-creative-preview {
          border: 1px solid var(--border-color);
          border-radius: 12px;
          background: rgba(201, 169, 110, .1);
          display: grid;
          place-items: center;
          overflow: hidden;
          min-height: 156px;
          color: var(--gold);
        }

        .vitor-creative-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .vitor-detail-kicker {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-bottom: 10px;
        }

        .vitor-detail-kicker span {
          border: 1px solid rgba(201, 169, 110, .28);
          border-radius: 999px;
          background: rgba(201, 169, 110, .1);
          color: #92400e;
          padding: 4px 8px;
          font-size: .66rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .vitor-detail-main h2 {
          margin: 0 0 8px;
          color: var(--text-primary);
          font-size: 1.35rem;
          line-height: 1.15;
        }

        .vitor-detail-main p {
          margin: 0 0 14px;
          color: var(--text-muted);
          font-size: .88rem;
          line-height: 1.5;
        }

        .vitor-score-card {
          color: #fff;
          min-height: 156px;
          align-content: center;
          gap: 4px;
          padding: 12px;
        }

        .vitor-score-card span,
        .vitor-score-card small {
          font-size: .7rem;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .vitor-score-card strong {
          font-size: 2.7rem;
          line-height: 1;
        }

        .vitor-analysis-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .vitor-list-block {
          border: 1px solid var(--border-color);
          border-radius: 12px;
          background: #fff;
          padding: 14px;
          display: grid;
          gap: 8px;
        }

        .vitor-list-block strong {
          color: var(--text-primary);
          font-size: .88rem;
        }

        .vitor-list-block span {
          color: var(--text-muted);
          font-size: .78rem;
          line-height: 1.38;
        }

        .vitor-bottom-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.12fr) minmax(320px, .88fr);
          gap: 16px;
        }

        .vitor-plan-card,
        .vitor-intel-card,
        .vitor-execution-card {
          padding: 16px;
        }

        .vitor-plan-lines,
        .vitor-intel-grid,
        .vitor-execution-grid,
        .vitor-execution-lists {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 12px;
        }

        .vitor-plan-lines div,
        .vitor-intel-grid div,
        .vitor-copy-list div,
        .vitor-execution-grid div,
        .vitor-execution-lists div {
          border: 1px solid rgba(17, 24, 39, .08);
          border-radius: 10px;
          background: rgba(255,255,255,.72);
          padding: 11px;
        }

        .vitor-plan-lines span,
        .vitor-intel-grid span,
        .vitor-execution-grid span {
          display: block;
          color: var(--text-muted);
          font-size: .66rem;
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .vitor-plan-lines strong,
        .vitor-intel-grid strong,
        .vitor-copy-list strong,
        .vitor-execution-grid strong,
        .vitor-execution-lists strong {
          color: var(--text-primary);
          font-size: .86rem;
          line-height: 1.3;
        }

        .vitor-copy-list {
          display: grid;
          gap: 9px;
        }

        .vitor-copy-list p,
        .vitor-intel-grid p {
          margin: 6px 0 0;
          color: var(--text-muted);
          font-size: .77rem;
          line-height: 1.4;
        }

        .vitor-copy-list span {
          display: inline-block;
          margin-top: 6px;
          color: var(--gold);
          font-size: .7rem;
          font-weight: 900;
        }

        .vitor-execution-warning,
        .vitor-execution-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .vitor-execution-warning {
          border: 1px solid rgba(180, 83, 9, .22);
          border-radius: 10px;
          background: rgba(180, 83, 9, .07);
          color: #92400e;
          font-size: .78rem;
          font-weight: 800;
          padding: 10px 12px;
        }

        .vitor-execution-warning svg {
          flex: 0 0 auto;
        }

        .vitor-execution-actions {
          justify-content: space-between;
        }

        .vitor-execution-actions > span {
          color: var(--text-muted);
          font-size: .74rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .vitor-execution-lists {
          margin-bottom: 0;
        }

        .vitor-execution-lists div {
          display: grid;
          gap: 7px;
        }

        .vitor-execution-lists span {
          color: var(--text-muted);
          font-size: .76rem;
          line-height: 1.38;
        }

        .vitor-empty,
        .vitor-empty-detail,
        .vitor-not-ready {
          border: 1px dashed var(--border-color);
          border-radius: 12px;
          color: var(--text-muted);
          text-align: center;
          padding: 28px;
        }

        .vitor-empty-detail,
        .vitor-not-ready {
          display: grid;
          justify-items: center;
          gap: 10px;
        }

        .vitor-empty-detail svg,
        .vitor-not-ready svg {
          color: var(--gold);
        }

        .vitor-empty-detail h2,
        .vitor-not-ready h1 {
          margin: 0;
          color: var(--text-primary);
        }

        .vitor-empty-detail p,
        .vitor-not-ready p {
          margin: 0;
          max-width: 520px;
        }

        .btn.danger,
        .btn.btn-outline.danger {
          border-color: rgba(185, 28, 28, .28);
          color: #b91c1c;
        }

        .vitor-toast {
          position: fixed;
          top: 24px;
          right: 24px;
          z-index: 10000;
          display: flex;
          align-items: center;
          gap: 10px;
          border-radius: 12px;
          padding: 13px 18px;
          font-weight: 800;
          box-shadow: 0 8px 30px rgba(0,0,0,.18);
        }

        .vitor-toast.success {
          border: 1px solid rgba(34, 197, 94, .28);
          background: rgba(34, 197, 94, .12);
          color: #047857;
        }

        .vitor-toast.error {
          border: 1px solid rgba(239, 68, 68, .28);
          background: rgba(239, 68, 68, .1);
          color: #b91c1c;
        }

        @media (max-width: 1180px) {
          .vitor-metrics-grid,
          .vitor-readiness-grid,
          .vitor-monitoring-kpis,
          .vitor-monitoring-grid,
          .vitor-analysis-grid,
          .vitor-bottom-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .vitor-monitoring-head {
            grid-template-columns: 132px minmax(0, 1fr);
          }

          .vitor-monitoring-action {
            grid-column: 1 / -1;
            justify-items: start;
          }

          .vitor-layout {
            grid-template-columns: 1fr;
          }

          .vitor-inbox {
            position: static;
          }
        }

        @media (max-width: 760px) {
          .vitor-metrics-grid,
          .vitor-readiness-head,
          .vitor-readiness-grid,
          .vitor-test-commands,
          .vitor-monitoring-head,
          .vitor-monitoring-kpis,
          .vitor-monitoring-grid,
          .vitor-analysis-grid,
          .vitor-bottom-grid,
          .vitor-plan-lines,
          .vitor-intel-grid,
          .vitor-execution-grid,
          .vitor-execution-lists,
          .vitor-intake-grid,
          .vitor-detail-hero,
          .vitor-report-strip {
            grid-template-columns: 1fr;
          }

          .vitor-score-card {
            min-height: 110px;
          }
        }
      `}</style>
    </div>
  )
}
