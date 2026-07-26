'use client'

import { FormEvent, useMemo, useState } from 'react'
import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from 'react'
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  Film,
  ImageIcon,
  Instagram,
  Layers3,
  Megaphone,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Video,
  Wand2,
} from 'lucide-react'

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
  created_at: string
  updated_at: string
}

type ScheduledCreative = Pick<
  Creative,
  'id' | 'title' | 'asset_url' | 'thumbnail_url' | 'asset_type' | 'content_type' | 'campaign_type' | 'property_sku' | 'status'
>

type ScheduledPost = {
  id: string
  creative_id: string | null
  platform: string
  status: string
  caption: string | null
  ai_context: string | null
  scheduled_for: string | null
  published_at: string | null
  permalink: string | null
  error_message: string | null
  created_at: string
  updated_at: string
  marketing_creatives?: ScheduledCreative | ScheduledCreative[] | null
}

type CopyDraft = {
  caption?: string
  short_caption?: string
  paid_headline?: string
  paid_primary_text?: string
  cta?: string
  hashtags?: string[]
  angles?: string[]
  schedule_suggestion?: {
    platforms?: string[]
    best_window?: string
  }
}

type CreativeFormState = {
  title: string
  description: string
  asset_url: string
  thumbnail_url: string
  asset_type: string
  content_type: string
  campaign_type: string
  platform_targets: string[]
  property_sku: string
  ai_context: string
  status: string
  scheduled_for: string
}

type StudioTab = 'studio' | 'queue' | 'library' | 'published' | 'ai'

type Props = {
  creatives: Creative[]
  scheduledPosts: ScheduledPost[]
  form: CreativeFormState
  setForm: Dispatch<SetStateAction<CreativeFormState>>
  saving: boolean
  generating: boolean
  updatingId: string
  error: string
  success: string
  copyDraft: CopyDraft | null
  onRefresh: () => void | Promise<void>
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onGenerateCopy: () => void
  onUpdateCreativeStatus: (creativeId: string, status: string) => void
  onUpdatePostStatus: (postId: string, status: string) => void
}

const platformOptions = ['instagram', 'facebook', 'tiktok', 'youtube', 'meta_ads', 'google_ads']
const statusOrder = ['draft', 'review', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'cancelled']
const formatter = new Intl.NumberFormat('pt-BR')

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function platformLabel(value: string) {
  const labels: Record<string, string> = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    meta_ads: 'Meta Ads',
    google_ads: 'Google Ads',
    site: 'Site',
  }
  return labels[value] || value
}

function platformColor(value: string) {
  const colors: Record<string, string> = {
    instagram: '#d62976',
    facebook: '#1877f2',
    tiktok: '#111827',
    youtube: '#ef4444',
    meta_ads: '#0ea5e9',
    google_ads: '#f9ab00',
    site: '#22c55e',
  }
  return colors[value] || '#b08a43'
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    draft: 'Rascunho',
    review: 'Revisao',
    approved: 'Aprovado',
    scheduled: 'Agendado',
    publishing: 'Publicando',
    published: 'Publicado',
    failed: 'Falhou',
    cancelled: 'Cancelado',
    archived: 'Arquivado',
  }
  return labels[value] || value
}

function campaignLabel(value: string) {
  const labels: Record<string, string> = {
    organic: 'Organico',
    paid: 'Trafego pago',
    both: 'Organico + pago',
  }
  return labels[value] || value
}

function normalizeCreative(value: ScheduledPost['marketing_creatives']) {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function todayInputValue() {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function compactText(value: string | null | undefined, max = 92) {
  const text = String(value || '').trim()
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

export default function CreativeStudioManagerView({
  creatives,
  scheduledPosts,
  form,
  setForm,
  saving,
  generating,
  updatingId,
  error,
  success,
  copyDraft,
  onRefresh,
  onSubmit,
  onGenerateCopy,
  onUpdateCreativeStatus,
  onUpdatePostStatus,
}: Props) {
  const [activeTab, setActiveTab] = useState<StudioTab>('studio')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedCreativeId, setSelectedCreativeId] = useState('')

  const summary = useMemo(() => {
    const pendingQueue = scheduledPosts.filter(item => ['draft', 'review', 'approved', 'scheduled'].includes(item.status)).length
    const nextPost = scheduledPosts.find(item => item.scheduled_for && ['approved', 'scheduled'].includes(item.status))
    return creatives.reduce(
      (acc, item) => {
        acc.total += 1
        if (item.campaign_type === 'organic' || item.campaign_type === 'both') acc.organic += 1
        if (item.campaign_type === 'paid' || item.campaign_type === 'both') acc.paid += 1
        if (item.status === 'review') acc.review += 1
        if (item.status === 'approved') acc.approved += 1
        if (item.status === 'archived') acc.archived += 1
        return acc
      },
      {
        total: 0,
        organic: 0,
        paid: 0,
        review: 0,
        approved: 0,
        archived: 0,
        scheduled: scheduledPosts.filter(item => item.status === 'scheduled').length,
        published: scheduledPosts.filter(item => item.status === 'published').length,
        failed: scheduledPosts.filter(item => item.status === 'failed').length,
        pendingQueue,
        nextPost,
      },
    )
  }, [creatives, scheduledPosts])

  const upcomingPosts = useMemo(() => {
    return [...scheduledPosts]
      .filter(item => ['draft', 'review', 'approved', 'scheduled', 'publishing'].includes(item.status))
      .sort((a, b) => {
        const aTime = a.scheduled_for ? new Date(a.scheduled_for).getTime() : Number.MAX_SAFE_INTEGER
        const bTime = b.scheduled_for ? new Date(b.scheduled_for).getTime() : Number.MAX_SAFE_INTEGER
        if (aTime !== bTime) return aTime - bTime
        return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)
      })
  }, [scheduledPosts])

  const recentPublished = useMemo(() => {
    return scheduledPosts
      .filter(item => item.status === 'published')
      .sort((a, b) => new Date(b.published_at || b.updated_at).getTime() - new Date(a.published_at || a.updated_at).getTime())
      .slice(0, 14)
  }, [scheduledPosts])

  const filteredCreatives = useMemo(() => {
    const term = query.trim().toLowerCase()
    return creatives.filter(item => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter
      const haystack = [
        item.title,
        item.description,
        item.ai_context,
        item.property_sku,
        item.campaign_type,
        item.content_type,
        ...(item.platform_targets || []),
      ].join(' ').toLowerCase()
      return matchesStatus && (!term || haystack.includes(term))
    })
  }, [creatives, query, statusFilter])

  const selectedCreative = useMemo(() => {
    return creatives.find(item => item.id === selectedCreativeId)
      || filteredCreatives[0]
      || creatives[0]
      || null
  }, [creatives, filteredCreatives, selectedCreativeId])

  const visibleListTitle = activeTab === 'queue'
    ? 'Fila editorial'
    : activeTab === 'published'
      ? 'Publicados'
      : activeTab === 'ai'
        ? 'Criativos para IA'
        : 'Biblioteca'

  const activeListCount = activeTab === 'queue'
    ? upcomingPosts.length
    : activeTab === 'published'
      ? recentPublished.length
      : filteredCreatives.length

  const navItems: Array<{ key: StudioTab; label: string; icon: ReactNode; count: number }> = [
    { key: 'studio', label: 'Studio', icon: <PenLine size={17} />, count: creatives.length },
    { key: 'queue', label: 'Fila', icon: <CalendarClock size={17} />, count: upcomingPosts.length },
    { key: 'library', label: 'Biblioteca', icon: <Layers3 size={17} />, count: creatives.length },
    { key: 'published', label: 'Publicados', icon: <CheckCircle2 size={17} />, count: recentPublished.length },
    { key: 'ai', label: 'Copy IA', icon: <Sparkles size={17} />, count: copyDraft ? 1 : 0 },
  ]

  const togglePlatform = (platform: string) => {
    setForm(prev => {
      const exists = prev.platform_targets.includes(platform)
      return {
        ...prev,
        platform_targets: exists
          ? prev.platform_targets.filter(item => item !== platform)
          : [...prev.platform_targets, platform],
      }
    })
  }

  const hasDraftContext = Boolean(form.title.trim() || form.description.trim() || form.ai_context.trim())

  return (
    <div className="creative-studio-page">
      <header className="creative-studio-topbar">
        <div className="creative-studio-brand">
          <span className="creative-studio-mark"><Sparkles size={18} /><ImageIcon size={16} /></span>
          <div>
            <h1>Central de Criativos IA</h1>
            <p>Briefing, copy, aprovacao e agenda editorial para pago e organico.</p>
          </div>
        </div>
        <div className="creative-studio-actions">
          <button type="button" onClick={onGenerateCopy} disabled={generating || !form.title.trim()}>
            <Wand2 size={16} className={generating ? 'spin' : ''} />
            {generating ? 'Gerando' : 'Gerar copy'}
          </button>
          <button type="button" onClick={onRefresh}>
            <RefreshCw size={16} />
            Atualizar
          </button>
          <button type="button" className="primary" onClick={() => {
            const formElement = document.querySelector<HTMLFormElement>('#creative-studio-form')
            formElement?.requestSubmit()
          }}>
            <Plus size={16} />
            Salvar criativo
          </button>
        </div>
      </header>

      {(error || success) && (
        <div className={`creative-studio-alert ${error ? 'error' : ''}`}>
          {error ? <Archive size={17} /> : <CheckCircle2 size={17} />}
          <span>{error || success}</span>
        </div>
      )}

      <section className="creative-studio-shell">
        <aside className="creative-studio-sidebar">
          <div className="creative-sidebar-title">
            <span>Clara IA</span>
            <strong>Operacao criativa</strong>
          </div>
          <div className="creative-studio-nav">
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
          </div>
          <div className="creative-sidebar-block">
            <span>Proximo post</span>
            <strong>{formatDate(summary.nextPost?.scheduled_for)}</strong>
            <small>{summary.pendingQueue} itens esperando decisao</small>
          </div>
          <div className="creative-sidebar-block">
            <span>Mix de campanha</span>
            <strong>{summary.organic} org. / {summary.paid} pago</strong>
            <small>{summary.approved} aprovados para uso</small>
          </div>
        </aside>

        <main className="creative-studio-main">
          <div className="creative-studio-head">
            <div>
              <strong>{activeTab === 'studio' ? 'Creative Studio' : visibleListTitle}</strong>
              <span>{summary.total} criativos, {summary.scheduled} agendados e {summary.published} publicados.</span>
            </div>
            <div className="creative-live-pill">
              <Clock3 size={15} />
              <span>Fila</span>
              <b>{summary.pendingQueue}</b>
            </div>
          </div>

          <div className="creative-summary-strip">
            <Metric label="Criativos" value={formatter.format(summary.total)} detail="na biblioteca" />
            <Metric label="Revisao" value={formatter.format(summary.review)} detail="aguardando decisao" />
            <Metric label="Aprovados" value={formatter.format(summary.approved)} detail="prontos para uso" />
            <Metric label="Agendados" value={formatter.format(summary.scheduled)} detail="fila ativa" />
            <Metric label="Publicados" value={formatter.format(summary.published)} detail="historico recente" />
            <Metric label="Falhas" value={formatter.format(summary.failed)} detail="precisam ajuste" />
          </div>

          <div className="creative-toolbar">
            <div className="creative-search">
              <Search size={16} />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Pesquisar criativo, SKU ou canal" />
            </div>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="Filtrar status">
              <option value="all">Todos os status</option>
              <option value="draft">Rascunho</option>
              <option value="review">Revisao</option>
              <option value="approved">Aprovado</option>
              <option value="scheduled">Agendado</option>
              <option value="archived">Arquivado</option>
            </select>
            <button type="button" onClick={() => setActiveTab('queue')}><CalendarClock size={15} /> Fila</button>
            <button type="button" onClick={() => setActiveTab('ai')}><Sparkles size={15} /> IA</button>
            <span>{activeListCount} itens visiveis</span>
          </div>

          <div className="creative-board">
            <section className="creative-list-pane">
              <PanelHeader title={visibleListTitle} detail="Selecione para revisar ou aprovar" icon={<Layers3 size={18} />} />
              <div className="creative-list-scroll">
                {activeTab === 'queue' ? (
                  upcomingPosts.length === 0 ? <EmptyState title="Fila vazia" detail="Cadastre um criativo com data para alimentar a agenda." /> : upcomingPosts.map(item => {
                    const creative = normalizeCreative(item.marketing_creatives)
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (creative?.id) setSelectedCreativeId(creative.id)
                        }}
                      >
                        <span className="creative-mini-asset"><CalendarClock size={18} /></span>
                        <div>
                          <strong>{creative?.title || compactText(item.caption, 70) || 'Post sem titulo'}</strong>
                          <span>{platformLabel(item.platform)} | {formatDate(item.scheduled_for)}</span>
                          <small>{statusLabel(item.status)}</small>
                        </div>
                        <i style={{ '--status-color': platformColor(item.platform) } as CSSProperties}>{platformLabel(item.platform).slice(0, 2)}</i>
                      </button>
                    )
                  })
                ) : activeTab === 'published' ? (
                  recentPublished.length === 0 ? <EmptyState title="Sem publicados" detail="Quando uma publicacao for marcada como publicada ela aparece aqui." /> : recentPublished.map(item => {
                    const creative = normalizeCreative(item.marketing_creatives)
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (creative?.id) setSelectedCreativeId(creative.id)
                        }}
                      >
                        <span className="creative-mini-asset success"><CheckCircle2 size={18} /></span>
                        <div>
                          <strong>{creative?.title || compactText(item.caption, 70) || 'Post publicado'}</strong>
                          <span>{platformLabel(item.platform)} | {formatDate(item.published_at || item.updated_at)}</span>
                          <small>Publicado</small>
                        </div>
                        {item.permalink ? <Send size={16} /> : null}
                      </button>
                    )
                  })
                ) : (
                  filteredCreatives.length === 0 ? <EmptyState title="Nada encontrado" detail="Limpe a busca ou cadastre um novo criativo." /> : filteredCreatives.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      className={selectedCreative?.id === item.id ? 'active' : ''}
                      onClick={() => setSelectedCreativeId(item.id)}
                    >
                      <CreativeThumb creative={item} />
                      <div>
                        <strong>{item.title}</strong>
                        <span>{campaignLabel(item.campaign_type)} | {item.content_type} | {formatDate(item.updated_at)}</span>
                        <small>{statusLabel(item.status)}</small>
                      </div>
                      <i style={{ '--status-color': statusColor(item.status) } as CSSProperties}>{statusLabel(item.status).slice(0, 2)}</i>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className="creative-preview-pane">
              <PanelHeader
                title={activeTab === 'ai' ? 'Copy e angulos IA' : 'Preview do criativo'}
                detail={selectedCreative ? statusLabel(selectedCreative.status) : 'Aguardando criativo'}
                icon={activeTab === 'ai' ? <Sparkles size={18} /> : <Film size={18} />}
              />
              {activeTab === 'ai' ? (
                <AiPreview copyDraft={copyDraft} form={form} hasDraftContext={hasDraftContext} onGenerateCopy={onGenerateCopy} generating={generating} />
              ) : selectedCreative ? (
                <CreativePreview
                  creative={selectedCreative}
                  updatingId={updatingId}
                  onUpdateCreativeStatus={onUpdateCreativeStatus}
                />
              ) : (
                <EmptyState title="Sem criativo selecionado" detail="Escolha um item da biblioteca para ver o preview." />
              )}
            </section>

            <section className="creative-composer-pane">
              <PanelHeader title="Novo criativo" detail="Briefing, midia, canais e agenda" icon={<PenLine size={18} />} />
              <form id="creative-studio-form" onSubmit={onSubmit} className="creative-composer-form">
                <Field label="Titulo">
                  <input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Ex: Reel Balneario vista mar" required />
                </Field>

                <div className="creative-form-grid">
                  <Field label="Uso">
                    <select value={form.campaign_type} onChange={event => setForm({ ...form, campaign_type: event.target.value })}>
                      <option value="organic">Organico</option>
                      <option value="paid">Trafego pago</option>
                      <option value="both">Organico + pago</option>
                    </select>
                  </Field>
                  <Field label="Formato">
                    <select value={form.content_type} onChange={event => setForm({ ...form, content_type: event.target.value })}>
                      <option value="post">Post</option>
                      <option value="reel">Reel</option>
                      <option value="story">Story</option>
                      <option value="ad">Anuncio</option>
                      <option value="short">Short</option>
                    </select>
                  </Field>
                </div>

                <div className="creative-form-grid">
                  <Field label="Midia">
                    <select value={form.asset_type} onChange={event => setForm({ ...form, asset_type: event.target.value })}>
                      <option value="image">Imagem</option>
                      <option value="video">Video</option>
                      <option value="carousel">Carrossel</option>
                      <option value="document">Documento</option>
                      <option value="other">Outro</option>
                    </select>
                  </Field>
                  <Field label="Status">
                    <select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}>
                      <option value="draft">Rascunho</option>
                      <option value="review">Revisao</option>
                      <option value="approved">Aprovado</option>
                      <option value="scheduled">Agendado</option>
                    </select>
                  </Field>
                </div>

                <Field label="Canais">
                  <div className="creative-platform-picker">
                    {platformOptions.map(platform => (
                      <button
                        key={platform}
                        type="button"
                        className={form.platform_targets.includes(platform) ? 'active' : ''}
                        onClick={() => togglePlatform(platform)}
                      >
                        {platformLabel(platform)}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="URL do arquivo">
                  <input value={form.asset_url} onChange={event => setForm({ ...form, asset_url: event.target.value })} placeholder="https://.../video.mp4 ou imagem" />
                </Field>

                <div className="creative-form-grid">
                  <Field label="Thumbnail">
                    <input value={form.thumbnail_url} onChange={event => setForm({ ...form, thumbnail_url: event.target.value })} placeholder="https://.../thumb.jpg" />
                  </Field>
                  <Field label="SKU do imovel">
                    <input value={form.property_sku} onChange={event => setForm({ ...form, property_sku: event.target.value })} placeholder="PIL-000123" />
                  </Field>
                </div>

                <Field label="Legenda / briefing">
                  <textarea rows={5} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Gancho, oferta, detalhes do imovel, publico e objetivo..." />
                </Field>

                <Field label="Contexto para IA">
                  <textarea rows={4} value={form.ai_context} onChange={event => setForm({ ...form, ai_context: event.target.value })} placeholder="Tom de voz, restricoes, referencias e angulos desejados..." />
                </Field>

                <div className="creative-form-grid">
                  <Field label="Agendar para">
                    <input type="datetime-local" value={form.scheduled_for} onChange={event => setForm({ ...form, scheduled_for: event.target.value })} />
                  </Field>
                  <Field label="Atalho">
                    <button
                      type="button"
                      className="creative-input-button"
                      onClick={() => setForm(prev => ({ ...prev, scheduled_for: todayInputValue(), status: 'scheduled' }))}
                    >
                      <Clock3 size={15} />
                      Usar agora
                    </button>
                  </Field>
                </div>

                <div className="creative-submit-row">
                  <button type="button" onClick={onGenerateCopy} disabled={generating || !form.title.trim()}>
                    <Wand2 size={16} />
                    {generating ? 'Gerando...' : 'Gerar copy'}
                  </button>
                  <button type="submit" className="primary" disabled={saving}>
                    <Plus size={16} />
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </section>
          </div>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="creative-field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="creative-empty-state">
      <FileText size={28} />
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  )
}

function statusColor(status: string) {
  const colors: Record<string, string> = {
    draft: '#94a3b8',
    review: '#f59e0b',
    approved: '#22c55e',
    scheduled: '#0ea5e9',
    publishing: '#8b5cf6',
    published: '#16a34a',
    failed: '#ef4444',
    cancelled: '#64748b',
    archived: '#71717a',
  }
  return colors[status] || '#b08a43'
}

function CreativeThumb({ creative }: { creative: Pick<Creative, 'thumbnail_url' | 'asset_url' | 'asset_type'> }) {
  const source = creative.thumbnail_url || creative.asset_url || ''
  return (
    <span className="creative-mini-thumb">
      {source && creative.asset_type !== 'video' ? <img src={source} alt="" /> : creative.asset_type === 'video' ? <Video size={18} /> : <ImageIcon size={18} />}
    </span>
  )
}

function CreativePreview({
  creative,
  updatingId,
  onUpdateCreativeStatus,
}: {
  creative: Creative
  updatingId: string
  onUpdateCreativeStatus: (creativeId: string, status: string) => void
}) {
  const assetSource = creative.thumbnail_url || creative.asset_url || ''
  return (
    <div className="creative-preview-content">
      <div className="creative-canvas-preview">
        {assetSource && creative.asset_type !== 'video' ? (
          <img src={assetSource} alt="" />
        ) : creative.asset_type === 'video' && creative.asset_url ? (
          <video src={creative.asset_url} controls muted playsInline />
        ) : (
          <div>
            {creative.asset_type === 'video' ? <Video size={34} /> : <ImageIcon size={34} />}
            <span>{creative.asset_type || 'midia'}</span>
          </div>
        )}
      </div>
      <div className="creative-preview-copy">
        <div className="creative-preview-head">
          <div>
            <strong>{creative.title}</strong>
            <span>{campaignLabel(creative.campaign_type)} | {creative.content_type} | atualizado {formatDate(creative.updated_at)}</span>
          </div>
          <i style={{ '--status-color': statusColor(creative.status) } as CSSProperties}>{statusLabel(creative.status)}</i>
        </div>
        <p>{creative.description || creative.ai_context || 'Sem briefing informado para este criativo.'}</p>
        <div className="creative-tag-row">
          {(creative.platform_targets || []).map(platform => (
            <b key={platform} style={{ '--tag-color': platformColor(platform) } as CSSProperties}>{platformLabel(platform)}</b>
          ))}
          {creative.property_sku && <b>{creative.property_sku}</b>}
        </div>
        <div className="creative-decision-row">
          <button type="button" onClick={() => onUpdateCreativeStatus(creative.id, 'review')} disabled={updatingId === creative.id}>Revisao</button>
          <button type="button" onClick={() => onUpdateCreativeStatus(creative.id, 'approved')} disabled={updatingId === creative.id}>Aprovar</button>
          <button type="button" onClick={() => onUpdateCreativeStatus(creative.id, 'archived')} disabled={updatingId === creative.id}>Arquivar</button>
          {creative.asset_url && <a href={creative.asset_url} target="_blank" rel="noreferrer">Abrir arquivo</a>}
        </div>
      </div>
    </div>
  )
}

function AiPreview({
  copyDraft,
  form,
  hasDraftContext,
  onGenerateCopy,
  generating,
}: {
  copyDraft: CopyDraft | null
  form: CreativeFormState
  hasDraftContext: boolean
  onGenerateCopy: () => void
  generating: boolean
}) {
  if (!copyDraft) {
    return (
      <div className="creative-ai-empty">
        <Sparkles size={34} />
        <strong>{hasDraftContext ? 'Briefing pronto para IA' : 'Crie um briefing primeiro'}</strong>
        <p>{hasDraftContext ? 'Clique em Gerar copy para transformar esse briefing em legenda, angulos e CTA.' : 'Informe titulo, objetivo e contexto para a Clara montar os primeiros angulos.'}</p>
        <button type="button" onClick={onGenerateCopy} disabled={generating || !form.title.trim()}>
          <Wand2 size={16} />
          {generating ? 'Gerando...' : 'Gerar copy IA'}
        </button>
      </div>
    )
  }

  return (
    <div className="creative-ai-preview">
      <section>
        <span>Legenda principal</span>
        <p>{copyDraft.caption || copyDraft.short_caption || 'Sem legenda retornada.'}</p>
      </section>
      <section>
        <span>Headline pago</span>
        <strong>{copyDraft.paid_headline || 'Nao informado'}</strong>
        <p>{copyDraft.paid_primary_text || 'Sem texto primario para anuncio.'}</p>
      </section>
      <section>
        <span>CTA</span>
        <strong>{copyDraft.cta || 'Chamar no direct'}</strong>
      </section>
      <div className="creative-ai-chip-list">
        {(copyDraft.angles || []).slice(0, 6).map(angle => <b key={angle}>{angle}</b>)}
        {(copyDraft.hashtags || []).slice(0, 8).map(tag => <b key={tag}>{tag}</b>)}
        {copyDraft.schedule_suggestion?.best_window && <b>{copyDraft.schedule_suggestion.best_window}</b>}
      </div>
    </div>
  )
}

function Styles() {
  return (
    <style jsx global>{`
      .creative-studio-page { min-height: 100vh; color: #171717; }
      .creative-studio-topbar { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 0; border-bottom: 1px solid #ded7c8; background: color-mix(in srgb, var(--bg-primary) 94%, transparent); backdrop-filter: blur(12px); }
      .creative-studio-brand { min-width: 0; display: flex; align-items: center; gap: 12px; }
      .creative-studio-mark { position: relative; width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, #171717, #b08a43); box-shadow: 0 10px 24px rgba(176,138,67,.24); flex: 0 0 auto; }
      .creative-studio-mark svg + svg { position: absolute; right: -4px; bottom: -4px; width: 21px; height: 21px; padding: 3px; border-radius: 8px; color: #b08a43; background: #fff; box-shadow: 0 2px 8px rgba(17,24,39,.16); }
      .creative-studio-brand h1 { margin: 0; font-family: Inter, sans-serif; font-size: 1.35rem; font-weight: 900; letter-spacing: 0; color: #171717; }
      .creative-studio-brand p { margin: 3px 0 0; color: #6b7280; font-size: .74rem; font-weight: 750; }
      .creative-studio-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
      .creative-studio-actions button, .creative-toolbar button, .creative-toolbar select { height: 36px; border: 1px solid #ded7c8; border-radius: 18px; background: #fff; color: #171717; padding: 0 12px; font-size: .75rem; font-weight: 850; display: inline-flex; align-items: center; gap: 7px; cursor: pointer; white-space: nowrap; }
      .creative-studio-actions button.primary { background: #b08a43; border-color: #b08a43; color: #fffaf2; }
      .creative-studio-actions button:disabled, .creative-toolbar button:disabled { opacity: .62; cursor: not-allowed; }
      .creative-studio-alert { display: flex; align-items: center; gap: 9px; margin: 12px 0; border: 1px solid rgba(34,197,94,.26); border-radius: 8px; background: rgba(34,197,94,.08); color: #15803d; padding: 11px 13px; font-size: .78rem; font-weight: 850; }
      .creative-studio-alert.error { border-color: rgba(239,68,68,.28); background: rgba(239,68,68,.08); color: #b91c1c; }
      .creative-studio-shell { margin-top: 14px; height: calc(100vh - 142px); min-height: 780px; display: grid; grid-template-columns: 254px minmax(0, 1fr); border: 1px solid #ded7c8; border-radius: 8px; background: #fff; overflow: hidden; box-shadow: 0 14px 30px rgba(47,43,36,.08); }
      .creative-studio-sidebar { border-right: 1px solid #ded7c8; background: #fbfaf7; padding: 12px 10px; display: grid; align-content: start; gap: 12px; overflow-y: auto; scrollbar-width: thin; }
      .creative-sidebar-title { padding: 7px 12px 4px; }
      .creative-sidebar-title span, .creative-sidebar-block span { display: block; color: #b08a43; font-size: .62rem; font-weight: 950; text-transform: uppercase; letter-spacing: .08em; }
      .creative-sidebar-title strong { display: block; margin-top: 4px; color: #171717; font-size: .86rem; }
      .creative-studio-nav { display: grid; gap: 4px; }
      .creative-studio-nav button { min-height: 42px; border: 0; border-radius: 0 22px 22px 0; background: transparent; color: #3f3f46; display: grid; grid-template-columns: 24px minmax(0,1fr) auto; align-items: center; gap: 9px; padding: 0 12px; text-align: left; font-size: .78rem; font-weight: 850; cursor: pointer; }
      .creative-studio-nav button.active { background: #f5ead9; color: #8b6426; }
      .creative-studio-nav button svg { color: #b08a43; }
      .creative-studio-nav button b { min-width: 23px; height: 22px; border-radius: 999px; display: inline-grid; place-items: center; background: rgba(39,39,42,.08); padding: 0 6px; color: #6b7280; font-size: .64rem; }
      .creative-sidebar-block { display: grid; gap: 5px; margin: 0 6px; padding: 12px; border: 1px solid #eadfce; border-radius: 8px; background: #fff; }
      .creative-sidebar-block strong { color: #171717; font-size: .82rem; }
      .creative-sidebar-block small { color: #6b7280; font-size: .68rem; font-weight: 750; }
      .creative-studio-main { min-width: 0; display: grid; grid-template-rows: auto auto auto minmax(0, 1fr); background: #f4f1ea; }
      .creative-studio-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 1px solid #ded7c8; background: #fff; }
      .creative-studio-head strong { display: block; color: #171717; font-size: 1rem; font-weight: 900; }
      .creative-studio-head span { display: block; margin-top: 3px; color: #6b7280; font-size: .72rem; font-weight: 750; }
      .creative-live-pill { min-height: 32px; display: inline-flex; align-items: center; gap: 7px; border-radius: 999px; padding: 0 11px; background: #f5ead9; color: #8b6426; font-size: .72rem; font-weight: 900; white-space: nowrap; }
      .creative-live-pill b { color: inherit; }
      .creative-summary-strip { display: grid; grid-template-columns: repeat(6, minmax(126px, 1fr)); overflow-x: auto; border-bottom: 1px solid #ded7c8; background: #fff; }
      .creative-summary-strip div { min-width: 120px; padding: 11px 13px; border-right: 1px solid #ece7dc; }
      .creative-summary-strip span { display: block; color: #6b7280; font-size: .62rem; font-weight: 950; text-transform: uppercase; margin-bottom: 4px; white-space: nowrap; }
      .creative-summary-strip strong { display: block; color: #171717; font-size: .97rem; white-space: nowrap; }
      .creative-summary-strip small { color: #6b7280; font-size: .66rem; font-weight: 750; }
      .creative-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 12px; border-bottom: 1px solid #ded7c8; background: #fff; }
      .creative-toolbar > span { margin-left: auto; color: #6b7280; font-size: .72rem; font-weight: 850; }
      .creative-search { height: 38px; min-width: 310px; display: flex; align-items: center; gap: 8px; border: 1px solid #ded7c8; border-radius: 4px; background: #fff; padding: 0 10px; color: #6b7280; }
      .creative-search input { border: 0; outline: none; width: 100%; color: #171717; background: transparent; font-size: .8rem; }
      .creative-board { min-height: 0; overflow: hidden; padding: 14px; display: grid; grid-template-columns: 360px minmax(0, 1fr) 410px; align-content: stretch; gap: 14px; }
      .creative-list-pane, .creative-preview-pane, .creative-composer-pane { min-width: 0; min-height: 0; border: 1px solid #ded7c8; border-radius: 8px; background: #fff; overflow: hidden; display: grid; grid-template-rows: auto minmax(0, 1fr); }
      .creative-list-pane header, .creative-preview-pane header, .creative-composer-pane header { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid #ece7dc; padding: 12px 14px; }
      .creative-list-pane header strong, .creative-preview-pane header strong, .creative-composer-pane header strong { display: block; color: #171717; font-size: .84rem; font-weight: 950; }
      .creative-list-pane header span, .creative-preview-pane header span, .creative-composer-pane header span { display: block; margin-top: 3px; color: #6b7280; font-size: .7rem; font-weight: 750; }
      .creative-list-pane header svg, .creative-preview-pane header svg, .creative-composer-pane header svg { color: #b08a43; }
      .creative-list-scroll { min-height: 0; overflow: auto; scrollbar-width: thin; }
      .creative-list-scroll button { width: 100%; min-height: 86px; border: 0; border-bottom: 1px solid #ece7dc; background: #fff; display: grid; grid-template-columns: 52px minmax(0,1fr) auto; align-items: center; gap: 11px; padding: 12px 13px; text-align: left; cursor: pointer; }
      .creative-list-scroll button:hover, .creative-list-scroll button.active { background: #f8f3eb; }
      .creative-list-scroll button.active { box-shadow: inset 4px 0 0 #b08a43; }
      .creative-list-scroll button div { min-width: 0; display: grid; gap: 4px; }
      .creative-list-scroll button strong { color: #171717; font-size: .82rem; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .creative-list-scroll button span { color: #6b7280; font-size: .68rem; font-weight: 750; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .creative-list-scroll button small { color: #6b7280; font-size: .68rem; font-weight: 900; text-transform: uppercase; }
      .creative-list-scroll button > i { min-width: 28px; height: 24px; border-radius: 999px; display: inline-grid; place-items: center; background: color-mix(in srgb, var(--status-color) 14%, #fff); color: var(--status-color); font-size: .58rem; font-style: normal; font-weight: 950; text-transform: uppercase; }
      .creative-mini-thumb, .creative-mini-asset { width: 52px; height: 52px; border-radius: 50%; overflow: hidden; background: #f5ead9; display: grid; place-items: center; color: #b08a43; }
      .creative-mini-asset.success { color: #16a34a; background: #dcfce7; }
      .creative-mini-thumb img { width: 100%; height: 100%; object-fit: cover; }
      .creative-preview-content { min-height: 0; overflow: auto; scrollbar-width: thin; }
      .creative-canvas-preview { min-height: 430px; background: linear-gradient(135deg, #191714, #3a2e1d); display: grid; place-items: center; overflow: hidden; color: #f5ead9; }
      .creative-canvas-preview img, .creative-canvas-preview video { width: 100%; height: 100%; object-fit: contain; display: block; background: #111; }
      .creative-canvas-preview > div { display: grid; place-items: center; gap: 10px; }
      .creative-canvas-preview > div span { color: #f5ead9; font-size: .78rem; font-weight: 900; text-transform: uppercase; }
      .creative-preview-copy { padding: 15px; display: grid; gap: 12px; }
      .creative-preview-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
      .creative-preview-head strong { display: block; color: #171717; font-size: 1.05rem; line-height: 1.2; }
      .creative-preview-head span { display: block; margin-top: 4px; color: #6b7280; font-size: .72rem; font-weight: 750; }
      .creative-preview-head i { border-radius: 999px; padding: 5px 9px; background: color-mix(in srgb, var(--status-color) 12%, #fff); color: var(--status-color); font-style: normal; font-size: .65rem; font-weight: 950; white-space: nowrap; }
      .creative-preview-copy p { margin: 0; max-height: 160px; overflow: auto; color: #3f3f46; font-size: .8rem; line-height: 1.5; scrollbar-width: thin; }
      .creative-tag-row, .creative-decision-row, .creative-platform-picker, .creative-submit-row, .creative-ai-chip-list { display: flex; flex-wrap: wrap; gap: 7px; }
      .creative-tag-row b, .creative-ai-chip-list b { border-radius: 999px; padding: 4px 8px; background: color-mix(in srgb, var(--tag-color, #b08a43) 11%, #fff); color: var(--tag-color, #8b6426); font-size: .66rem; font-weight: 900; }
      .creative-decision-row button, .creative-decision-row a, .creative-submit-row button, .creative-input-button, .creative-ai-empty button { min-height: 34px; border: 1px solid #ded7c8; border-radius: 17px; background: #fff; color: #171717; padding: 0 11px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; text-decoration: none; font-size: .72rem; font-weight: 900; cursor: pointer; }
      .creative-decision-row button:hover, .creative-decision-row a:hover { border-color: #b08a43; color: #8b6426; background: #fffaf2; }
      .creative-composer-form { min-height: 0; overflow: auto; scrollbar-width: thin; padding: 14px; display: grid; gap: 11px; align-content: start; }
      .creative-field { display: grid; gap: 6px; }
      .creative-field > span { color: #71717a; font-size: .64rem; font-weight: 950; text-transform: uppercase; letter-spacing: .06em; }
      .creative-field input, .creative-field textarea, .creative-field select { width: 100%; border: 1px solid #ded7c8; border-radius: 6px; background: #fff; color: #171717; padding: 9px 10px; font-size: .78rem; outline: none; resize: vertical; }
      .creative-field input:focus, .creative-field textarea:focus, .creative-field select:focus { border-color: #b08a43; box-shadow: 0 0 0 3px rgba(176,138,67,.12); }
      .creative-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .creative-platform-picker button { border: 1px solid #ded7c8; border-radius: 999px; background: #fff; color: #3f3f46; padding: 7px 9px; font-size: .7rem; font-weight: 900; cursor: pointer; }
      .creative-platform-picker button.active { border-color: #b08a43; background: #f5ead9; color: #8b6426; }
      .creative-input-button { width: 100%; min-height: 37px; border-radius: 6px; }
      .creative-submit-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .creative-submit-row button.primary { background: #b08a43; border-color: #b08a43; color: #fffaf2; }
      .creative-submit-row button:disabled, .creative-input-button:disabled, .creative-ai-empty button:disabled { opacity: .62; cursor: not-allowed; }
      .creative-ai-empty { min-height: 100%; display: grid; place-items: center; align-content: center; gap: 10px; padding: 24px; text-align: center; color: #6b7280; }
      .creative-ai-empty strong { color: #171717; font-size: 1rem; }
      .creative-ai-empty p { max-width: 430px; margin: 0; font-size: .78rem; line-height: 1.48; }
      .creative-ai-preview { min-height: 0; overflow: auto; padding: 14px; display: grid; align-content: start; gap: 12px; scrollbar-width: thin; }
      .creative-ai-preview section { border: 1px solid #ece7dc; border-radius: 8px; padding: 13px; background: #fffaf2; }
      .creative-ai-preview section span { display: block; color: #8b6426; font-size: .63rem; font-weight: 950; text-transform: uppercase; margin-bottom: 7px; }
      .creative-ai-preview section strong { color: #171717; font-size: .94rem; }
      .creative-ai-preview section p { margin: 0; color: #3f3f46; font-size: .8rem; line-height: 1.5; white-space: pre-wrap; }
      .creative-empty-state { min-height: 220px; display: grid; place-items: center; align-content: center; gap: 7px; color: #6b7280; text-align: center; padding: 24px; }
      .creative-empty-state strong { color: #171717; font-size: .86rem; }
      .creative-empty-state span { max-width: 330px; font-size: .73rem; line-height: 1.4; }
      @media (max-width: 1380px) {
        .creative-board { grid-template-columns: 330px minmax(0, 1fr); overflow: auto; }
        .creative-composer-pane { grid-column: 1 / -1; min-height: 520px; }
      }
      @media (max-width: 1080px) {
        .creative-studio-shell { height: auto; min-height: 0; grid-template-columns: 1fr; }
        .creative-studio-sidebar { border-right: 0; border-bottom: 1px solid #ded7c8; }
        .creative-studio-nav { grid-template-columns: repeat(2, minmax(0,1fr)); }
        .creative-studio-nav button { border-radius: 20px; }
        .creative-board { grid-template-columns: 1fr; overflow: visible; }
        .creative-list-pane, .creative-preview-pane, .creative-composer-pane { min-height: 520px; }
      }
      @media (max-width: 720px) {
        .creative-studio-topbar, .creative-studio-head { align-items: stretch; flex-direction: column; }
        .creative-studio-actions { justify-content: stretch; }
        .creative-studio-actions button { flex: 1 1 0; justify-content: center; }
        .creative-summary-strip { grid-template-columns: repeat(2, minmax(140px, 1fr)); }
        .creative-search { min-width: 100%; }
        .creative-toolbar > span { margin-left: 0; width: 100%; }
        .creative-board { padding: 10px; }
        .creative-form-grid, .creative-submit-row { grid-template-columns: 1fr; }
        .creative-canvas-preview { min-height: 300px; }
        .creative-preview-head { flex-direction: column; }
      }
    `}</style>
  )
}
