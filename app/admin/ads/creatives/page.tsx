'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  ImageIcon,
  Megaphone,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Video,
  Wand2,
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

const platformOptions = ['instagram', 'facebook', 'tiktok', 'youtube', 'meta_ads', 'google_ads']
const statusOrder = ['draft', 'review', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'cancelled']

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

export default function MarketingCreativesPage() {
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [updatingId, setUpdatingId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [copyDraft, setCopyDraft] = useState<CopyDraft | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    asset_url: '',
    thumbnail_url: '',
    asset_type: 'image',
    content_type: 'post',
    campaign_type: 'organic',
    platform_targets: ['instagram', 'facebook'],
    property_sku: '',
    ai_context: '',
    status: 'draft',
    scheduled_for: '',
  })

  const loadCreatives = async () => {
    const response = await fetch('/api/admin/marketing-creatives?limit=100')
    const payload = await response.json()
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Erro ao carregar criativos.')
    setCreatives(payload.creatives || [])
  }

  const loadScheduledPosts = async () => {
    const response = await fetch('/api/admin/marketing-scheduled-posts?limit=120')
    const payload = await response.json()
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Erro ao carregar agenda editorial.')
    setScheduledPosts(payload.posts || [])
  }

  const loadAll = async () => {
    setError('')
    await Promise.all([loadCreatives(), loadScheduledPosts()])
  }

  useEffect(() => {
    loadAll()
      .catch(err => setError(err instanceof Error ? err.message : 'Erro ao carregar criativos.'))
      .finally(() => setLoading(false))
  }, [])

  const summary = useMemo(() => {
    const pendingQueue = scheduledPosts.filter(item => ['draft', 'review', 'approved', 'scheduled'].includes(item.status)).length
    const nextPost = scheduledPosts.find(item => item.scheduled_for && ['approved', 'scheduled'].includes(item.status))
    return creatives.reduce(
      (acc, item) => {
        acc.total += 1
        if (item.campaign_type === 'organic' || item.campaign_type === 'both') acc.organic += 1
        if (item.campaign_type === 'paid' || item.campaign_type === 'both') acc.paid += 1
        if (item.status === 'approved') acc.approved += 1
        return acc
      },
      {
        total: 0,
        organic: 0,
        paid: 0,
        approved: 0,
        scheduled: scheduledPosts.filter(item => item.status === 'scheduled').length,
        published: scheduledPosts.filter(item => item.status === 'published').length,
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
      .slice(0, 6)
  }, [scheduledPosts])

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

  const generateCopy = async () => {
    setGenerating(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch('/api/admin/marketing-creatives/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Erro ao gerar copy.')

      const nextCopy = payload.copy as CopyDraft
      setCopyDraft(nextCopy)
      setForm(prev => ({
        ...prev,
        description: nextCopy.caption || prev.description,
        ai_context: [
          prev.ai_context,
          nextCopy.angles?.length ? `Angulos IA: ${nextCopy.angles.join(' | ')}` : '',
          nextCopy.paid_headline ? `Headline pago: ${nextCopy.paid_headline}` : '',
          nextCopy.paid_primary_text ? `Texto pago: ${nextCopy.paid_primary_text}` : '',
          nextCopy.cta ? `CTA: ${nextCopy.cta}` : '',
        ].filter(Boolean).join('\n'),
      }))
      setSuccess('Copy gerada pela IA.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar copy.')
    } finally {
      setGenerating(false)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/admin/marketing-creatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Erro ao salvar criativo.')

      setSuccess('Criativo salvo e enviado para a operacao.')
      setCopyDraft(null)
      setForm(prev => ({
        ...prev,
        title: '',
        description: '',
        asset_url: '',
        thumbnail_url: '',
        property_sku: '',
        ai_context: '',
        scheduled_for: '',
      }))
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar criativo.')
    } finally {
      setSaving(false)
    }
  }

  const updateCreativeStatus = async (creativeId: string, status: string) => {
    setUpdatingId(creativeId)
    setError('')
    try {
      const response = await fetch(`/api/admin/marketing-creatives/${creativeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Erro ao atualizar criativo.')
      await loadCreatives()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar criativo.')
    } finally {
      setUpdatingId('')
    }
  }

  const updatePostStatus = async (postId: string, status: string) => {
    setUpdatingId(postId)
    setError('')
    try {
      const response = await fetch('/api/admin/marketing-scheduled-posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: postId, status }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Erro ao atualizar agenda.')
      await loadScheduledPosts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar agenda.')
    } finally {
      setUpdatingId('')
    }
  }

  if (loading) return <AdminLoadingState message="Carregando operacao de criativos..." />

  return (
    <div>
      <div className="admin-header creative-admin-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={26} /> Central de Criativos IA
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '.85rem', marginTop: 4 }}>
            Briefing, copy, aprovacao e agenda editorial para organico e trafego pago.
          </p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => loadAll()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <RefreshCw size={18} /> Atualizar
        </button>
      </div>

      {(error || success) && (
        <div className={`chart-card creative-alert ${error ? 'error' : ''}`}>
          {error || success}
        </div>
      )}

      <div className="creative-command-grid">
        <div className="creative-command-card hero">
          <span className="creative-eyebrow">Operacao de conteudo</span>
          <h2>{summary.pendingQueue} itens na fila</h2>
          <p>
            A area ja separa criativo, copy e agendamento. A publicacao automatica entra depois que Direct/Instagram
            estiverem conectados e o modo autopiloto for aprovado.
          </p>
          <div className="creative-hero-row">
            <strong>Proximo post</strong>
            <b>{formatDate(summary.nextPost?.scheduled_for)}</b>
          </div>
        </div>
        <div className="creative-command-card">
          <ImageIcon size={18} />
          <span>Criativos</span>
          <strong>{summary.total}</strong>
          <small>{summary.organic} organicos</small>
        </div>
        <div className="creative-command-card">
          <Megaphone size={18} />
          <span>Pago</span>
          <strong>{summary.paid}</strong>
          <small>Para campanhas</small>
        </div>
        <div className="creative-command-card">
          <CalendarClock size={18} />
          <span>Agendados</span>
          <strong>{summary.scheduled}</strong>
          <small>{summary.published} publicados</small>
        </div>
      </div>

      <div className="creative-grid">
        <form className="chart-card creative-form" onSubmit={submit}>
          <div className="creative-section-title">
            <span>Novo criativo</span>
            <strong>briefing + IA</strong>
          </div>

          <div className="form-group">
            <label className="form-label">Titulo</label>
            <input
              className="form-input"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Reel Atmosphere Home Spa"
              required
            />
          </div>

          <div className="creative-two">
            <div className="form-group">
              <label className="form-label">Uso</label>
              <select className="form-input" value={form.campaign_type} onChange={e => setForm({ ...form, campaign_type: e.target.value })}>
                <option value="organic">Organico</option>
                <option value="paid">Trafego pago</option>
                <option value="both">Organico + pago</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Formato</label>
              <select className="form-input" value={form.content_type} onChange={e => setForm({ ...form, content_type: e.target.value })}>
                <option value="post">Post</option>
                <option value="reel">Reel</option>
                <option value="story">Story</option>
                <option value="ad">Anuncio</option>
                <option value="short">Short</option>
              </select>
            </div>
          </div>

          <div className="creative-two">
            <div className="form-group">
              <label className="form-label">Midia</label>
              <select className="form-input" value={form.asset_type} onChange={e => setForm({ ...form, asset_type: e.target.value })}>
                <option value="image">Imagem</option>
                <option value="video">Video</option>
                <option value="carousel">Carrossel</option>
                <option value="document">Documento</option>
                <option value="other">Outro</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="draft">Rascunho</option>
                <option value="review">Revisao</option>
                <option value="approved">Aprovado</option>
                <option value="scheduled">Agendado</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Canais</label>
            <div className="creative-platforms">
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
          </div>

          <div className="form-group">
            <label className="form-label">URL do arquivo</label>
            <input
              className="form-input"
              value={form.asset_url}
              onChange={e => setForm({ ...form, asset_url: e.target.value })}
              placeholder="https://.../video.mp4 ou imagem"
            />
          </div>

          <div className="creative-two">
            <div className="form-group">
              <label className="form-label">Thumbnail</label>
              <input
                className="form-input"
                value={form.thumbnail_url}
                onChange={e => setForm({ ...form, thumbnail_url: e.target.value })}
                placeholder="https://.../thumb.jpg"
              />
            </div>
            <div className="form-group">
              <label className="form-label">SKU do imovel</label>
              <input
                className="form-input"
                value={form.property_sku}
                onChange={e => setForm({ ...form, property_sku: e.target.value })}
                placeholder="Ex: PIL-000123"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Legenda/briefing</label>
            <textarea
              className="form-input"
              rows={5}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Texto inicial, gancho, oferta, detalhes do imovel..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contexto para IA</label>
            <textarea
              className="form-input"
              rows={4}
              value={form.ai_context}
              onChange={e => setForm({ ...form, ai_context: e.target.value })}
              placeholder="Objetivo, publico, tom de voz, restricoes, referencias..."
            />
          </div>

          <div className="creative-two">
            <div className="form-group">
              <label className="form-label">Agendar para</label>
              <input
                className="form-input"
                type="datetime-local"
                value={form.scheduled_for}
                onChange={e => setForm({ ...form, scheduled_for: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Atalho</label>
              <button
                type="button"
                className="btn"
                onClick={() => setForm(prev => ({ ...prev, scheduled_for: todayInputValue(), status: 'scheduled' }))}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Clock3 size={16} /> Usar agora
              </button>
            </div>
          </div>

          <div className="creative-form-actions">
            <button type="button" className="btn" disabled={generating || !form.title.trim()} onClick={generateCopy}>
              <Wand2 size={18} /> {generating ? 'Gerando...' : 'Gerar copy IA'}
            </button>
            <button type="submit" className="btn btn-gold" disabled={saving}>
              <Plus size={18} /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>

          {copyDraft && (
            <div className="creative-copy-box">
              <strong>Rascunho IA</strong>
              <p>{copyDraft.short_caption || copyDraft.caption}</p>
              <div>
                {(copyDraft.angles || []).slice(0, 4).map(angle => <span key={angle}>{angle}</span>)}
              </div>
            </div>
          )}
        </form>

        <section className="chart-card creative-queue">
          <div className="creative-section-title">
            <span>Fila editorial</span>
            <strong>{upcomingPosts.length} pendentes</strong>
          </div>
          <div className="creative-queue-list">
            {upcomingPosts.map(item => {
              const creative = normalizeCreative(item.marketing_creatives)
              return (
                <article key={item.id} className="creative-queue-item">
                  <div>
                    <b>{platformLabel(item.platform)}</b>
                    <strong>{creative?.title || item.caption || 'Post sem titulo'}</strong>
                    <small>{formatDate(item.scheduled_for)} - {statusLabel(item.status)}</small>
                  </div>
                  <p>{item.caption || item.ai_context || 'Sem legenda definida.'}</p>
                  <div className="creative-action-row">
                    <button type="button" onClick={() => updatePostStatus(item.id, 'approved')} disabled={updatingId === item.id}>
                      Aprovar
                    </button>
                    <button type="button" onClick={() => updatePostStatus(item.id, 'scheduled')} disabled={updatingId === item.id}>
                      Agendar
                    </button>
                    <button type="button" onClick={() => updatePostStatus(item.id, 'published')} disabled={updatingId === item.id}>
                      Publicado
                    </button>
                    <button type="button" onClick={() => updatePostStatus(item.id, 'cancelled')} disabled={updatingId === item.id}>
                      Cancelar
                    </button>
                  </div>
                </article>
              )
            })}
            {upcomingPosts.length === 0 && (
              <div className="creative-empty">Nenhum post pendente. Salve um criativo com data para alimentar a fila.</div>
            )}
          </div>
        </section>
      </div>

      <div className="creative-bottom-grid">
        <section className="chart-card">
          <div className="creative-section-title">
            <span>Biblioteca</span>
            <strong>{creatives.length} itens</strong>
          </div>
          <div className="creative-list">
            {creatives.map(item => (
              <article key={item.id} className="creative-card">
                <div className="creative-thumb">
                  {item.thumbnail_url || item.asset_url ? (
                    item.asset_type === 'video' ? <Video size={22} /> : <img src={item.thumbnail_url || item.asset_url || ''} alt="" />
                  ) : (
                    <ImageIcon size={22} />
                  )}
                </div>
                <div className="creative-card-body">
                  <div className="creative-card-head">
                    <strong>{item.title}</strong>
                    <span>{statusLabel(item.status)}</span>
                  </div>
                  <p>{item.description || item.ai_context || 'Sem briefing informado.'}</p>
                  <div className="creative-tags">
                    <i>{campaignLabel(item.campaign_type)}</i>
                    <i>{item.content_type}</i>
                    {item.property_sku && <i>{item.property_sku}</i>}
                  </div>
                  <div className="creative-platform-row">
                    {(item.platform_targets || []).map(platform => <b key={platform}>{platformLabel(platform)}</b>)}
                  </div>
                  <div className="creative-action-row">
                    <button type="button" onClick={() => updateCreativeStatus(item.id, 'review')} disabled={updatingId === item.id}>
                      Revisao
                    </button>
                    <button type="button" onClick={() => updateCreativeStatus(item.id, 'approved')} disabled={updatingId === item.id}>
                      Aprovar
                    </button>
                    <button type="button" onClick={() => updateCreativeStatus(item.id, 'archived')} disabled={updatingId === item.id}>
                      Arquivar
                    </button>
                  </div>
                  <small>Atualizado em {formatDate(item.updated_at)}</small>
                </div>
              </article>
            ))}
            {creatives.length === 0 && (
              <div className="creative-empty">Nenhum criativo cadastrado ainda.</div>
            )}
          </div>
        </section>

        <section className="chart-card">
          <div className="creative-section-title">
            <span>Historico</span>
            <strong>{recentPublished.length} publicados</strong>
          </div>
          <div className="creative-published-list">
            {recentPublished.map(item => {
              const creative = normalizeCreative(item.marketing_creatives)
              return (
                <div key={item.id} className="creative-published-item">
                  <CheckCircle2 size={16} />
                  <div>
                    <strong>{creative?.title || item.caption || 'Post publicado'}</strong>
                    <small>{platformLabel(item.platform)} - {formatDate(item.published_at || item.updated_at)}</small>
                  </div>
                  {item.permalink && (
                    <a href={item.permalink} target="_blank" rel="noreferrer">
                      <Send size={14} />
                    </a>
                  )}
                </div>
              )
            })}
            {recentPublished.length === 0 && <div className="creative-empty">Ainda nao ha publicacoes marcadas como publicadas.</div>}
          </div>
        </section>
      </div>

      <style jsx global>{`
        .creative-admin-header {
          gap: 16px;
        }
        .creative-command-grid {
          display: grid;
          grid-template-columns: minmax(280px, 1.5fr) repeat(3, minmax(150px, .55fr));
          gap: 14px;
          margin-bottom: 18px;
        }
        .creative-command-card {
          border: 1px solid var(--border-color);
          border-radius: 14px;
          background: var(--bg-secondary);
          padding: 16px;
          min-height: 128px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          color: var(--text-primary);
        }
        .creative-command-card svg {
          color: var(--gold);
        }
        .creative-command-card span,
        .creative-eyebrow {
          color: var(--gold);
          font-size: .68rem;
          font-weight: 900;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        .creative-command-card strong {
          font-family: var(--font-heading);
          font-size: 2rem;
          line-height: 1;
        }
        .creative-command-card small,
        .creative-command-card p {
          color: var(--text-muted);
          font-size: .76rem;
          line-height: 1.45;
        }
        .creative-command-card.hero {
          background:
            radial-gradient(circle at top right, rgba(201, 169, 110, .2), transparent 38%),
            var(--bg-secondary);
        }
        .creative-command-card.hero h2 {
          margin: 8px 0;
          font-family: var(--font-heading);
          font-size: clamp(1.8rem, 3vw, 3rem);
        }
        .creative-hero-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 8px;
          padding-top: 10px;
          border-top: 1px solid var(--border-color);
        }
        .creative-hero-row strong,
        .creative-hero-row b {
          font-size: .82rem;
          font-family: inherit;
        }
        .creative-grid {
          display: grid;
          grid-template-columns: minmax(320px, .78fr) minmax(0, 1.22fr);
          gap: 18px;
          align-items: start;
        }
        .creative-bottom-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(280px, .75fr);
          gap: 18px;
          margin-top: 18px;
        }
        .creative-form {
          display: grid;
          gap: 12px;
        }
        .creative-section-title {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 4px;
        }
        .creative-section-title span {
          color: var(--gold);
          font-size: .72rem;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .creative-section-title strong {
          color: var(--text-muted);
          font-size: .78rem;
        }
        .creative-two {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .creative-platforms {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .creative-platforms button,
        .creative-action-row button {
          border: 1px solid var(--border-color);
          border-radius: 999px;
          background: var(--bg-primary);
          color: var(--text-primary);
          padding: 7px 10px;
          font-size: .74rem;
          font-weight: 800;
          cursor: pointer;
        }
        .creative-platforms button.active,
        .creative-action-row button:hover {
          border-color: var(--gold);
          background: rgba(201, 169, 110, .14);
          color: var(--gold);
        }
        .creative-form-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .creative-form-actions .btn,
        .creative-two .btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .creative-copy-box {
          border: 1px solid rgba(201, 169, 110, .28);
          border-radius: 12px;
          padding: 12px;
          background: rgba(201, 169, 110, .08);
        }
        .creative-copy-box strong {
          color: var(--gold);
          font-size: .78rem;
          text-transform: uppercase;
          letter-spacing: .08em;
        }
        .creative-copy-box p {
          margin: 8px 0;
          color: var(--text-primary);
          font-size: .82rem;
          line-height: 1.45;
        }
        .creative-copy-box div,
        .creative-tags,
        .creative-platform-row,
        .creative-action-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .creative-copy-box span,
        .creative-tags i,
        .creative-platform-row b {
          border-radius: 999px;
          padding: 3px 7px;
          font-size: .66rem;
          font-style: normal;
          font-weight: 800;
          background: rgba(148, 163, 184, .12);
          color: var(--text-muted);
        }
        .creative-platform-row b {
          background: rgba(201, 169, 110, .12);
          color: var(--gold);
        }
        .creative-queue-list,
        .creative-list,
        .creative-published-list {
          display: grid;
          gap: 12px;
        }
        .creative-queue-item {
          display: grid;
          grid-template-columns: minmax(220px, .45fr) minmax(0, 1fr);
          gap: 14px;
          padding: 12px;
          border: 1px solid var(--border-color);
          border-radius: 14px;
          background: var(--bg-primary);
        }
        .creative-queue-item b {
          color: var(--gold);
          font-size: .68rem;
          text-transform: uppercase;
          letter-spacing: .08em;
        }
        .creative-queue-item strong {
          display: block;
          margin-top: 5px;
          color: var(--text-primary);
          font-size: .9rem;
        }
        .creative-queue-item small,
        .creative-card small,
        .creative-published-item small {
          color: var(--text-muted);
          font-size: .7rem;
        }
        .creative-queue-item p {
          margin: 0;
          color: var(--text-muted);
          font-size: .8rem;
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .creative-card {
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr);
          gap: 12px;
          padding: 12px;
          border: 1px solid var(--border-color);
          border-radius: 14px;
          background: var(--bg-primary);
        }
        .creative-thumb {
          width: 92px;
          aspect-ratio: 1 / 1;
          border-radius: 12px;
          display: grid;
          place-items: center;
          overflow: hidden;
          color: var(--gold);
          background: rgba(201, 169, 110, .1);
        }
        .creative-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .creative-card-body {
          min-width: 0;
        }
        .creative-card-head {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 7px;
        }
        .creative-card-head strong {
          color: var(--text-primary);
          font-size: .92rem;
        }
        .creative-card-head span {
          color: var(--gold);
          font-size: .68rem;
          font-weight: 900;
          text-transform: uppercase;
        }
        .creative-card p {
          margin: 0 0 8px;
          color: var(--text-muted);
          font-size: .8rem;
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .creative-published-item {
          display: grid;
          grid-template-columns: 22px minmax(0, 1fr) 24px;
          gap: 8px;
          align-items: center;
          padding: 10px;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          background: var(--bg-primary);
        }
        .creative-published-item svg {
          color: #22c55e;
        }
        .creative-published-item strong {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--text-primary);
          font-size: .8rem;
        }
        .creative-published-item a {
          color: var(--gold);
        }
        .creative-empty {
          padding: 18px;
          border: 1px dashed var(--border-color);
          border-radius: 14px;
          color: var(--text-muted);
          text-align: center;
          font-size: .84rem;
        }
        .creative-alert {
          margin-bottom: 18px;
          color: #22c55e;
          border-color: rgba(34, 197, 94, .28);
        }
        .creative-alert.error {
          color: #ef4444;
          border-color: rgba(239, 68, 68, .28);
        }
        @media (max-width: 1180px) {
          .creative-command-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .creative-grid,
          .creative-bottom-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 680px) {
          .creative-command-grid,
          .creative-two,
          .creative-form-actions,
          .creative-queue-item,
          .creative-card {
            grid-template-columns: 1fr;
          }
          .creative-thumb {
            width: 100%;
            max-height: 180px;
          }
        }
      `}</style>
    </div>
  )
}
