'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  Layers,
  Link as LinkIcon,
  Loader2,
  Play,
} from 'lucide-react'
import type { MemberContent, MemberProduct, MemberProgress } from '@/lib/members/access'

type MembersProductClientProps = {
  product: MemberProduct
  contents: MemberContent[]
  progress: MemberProgress[]
  memberName: string
}

type ProgressStatus = 'not_started' | 'in_progress' | 'completed'

function progressStatus(progress?: MemberProgress): ProgressStatus {
  return progress?.status || 'not_started'
}

function formatDuration(seconds?: number | null) {
  const value = Number(seconds || 0)
  if (!value) return ''
  const minutes = Math.max(1, Math.round(value / 60))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}min` : `${hours}h`
}

function kindLabel(type: string) {
  const labels: Record<string, string> = {
    module: 'Módulo',
    lesson: 'Aula',
    video: 'Vídeo',
    pdf: 'PDF',
    ebook: 'E-book',
    bonus: 'Bônus',
    external_link: 'Link',
  }
  return labels[type] || 'Conteúdo'
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm|ogg)(\?|#|$)/i.test(url)
}

function isPdfUrl(url: string) {
  return /\.pdf(\?|#|$)/i.test(url)
}

function embedUrl(url: string) {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('youtube.com')) {
      const videoId = parsed.searchParams.get('v')
      if (videoId) return `https://www.youtube.com/embed/${videoId}`
    }
    if (parsed.hostname.includes('youtu.be')) {
      const videoId = parsed.pathname.replace('/', '')
      if (videoId) return `https://www.youtube.com/embed/${videoId}`
    }
    if (parsed.hostname.includes('vimeo.com')) {
      const videoId = parsed.pathname.split('/').filter(Boolean).pop()
      if (videoId) return `https://player.vimeo.com/video/${videoId}`
    }
  } catch {
    return ''
  }
  return ''
}

function firstPlayable(contents: MemberContent[]) {
  return contents.find((item) => item.content_type !== 'module') || contents[0] || null
}

export default function MembersProductClient({
  product,
  contents,
  progress,
  memberName,
}: MembersProductClientProps) {
  const [selectedId, setSelectedId] = useState(firstPlayable(contents)?.id || '')
  const [progressMap, setProgressMap] = useState(() => {
    const map = new Map<string, MemberProgress>()
    progress.forEach((item) => map.set(item.product_content_id, item))
    return map
  })
  const [savingId, setSavingId] = useState('')
  const [error, setError] = useState('')

  const modules = useMemo(() => {
    const moduleRows = contents.filter((item) => item.content_type === 'module')
    const orphanLessons = contents.filter((item) => item.content_type !== 'module' && !item.parent_id)

    if (!moduleRows.length) {
      return [{
        id: 'default',
        title: 'Conteúdos',
        description: product.subtitle || product.description,
        items: contents.filter((item) => item.content_type !== 'module'),
      }]
    }

    return [
      ...moduleRows.map((module) => ({
        id: module.id,
        title: module.title,
        description: module.description,
        items: contents.filter((item) => item.parent_id === module.id && item.content_type !== 'module'),
      })),
      ...(orphanLessons.length ? [{
        id: 'extras',
        title: 'Materiais extras',
        description: 'Conteúdos sem módulo definido.',
        items: orphanLessons,
      }] : []),
    ]
  }, [contents, product.description, product.subtitle])

  const playable = contents.filter((item) => item.content_type !== 'module')
  const selected = contents.find((item) => item.id === selectedId) || firstPlayable(contents)
  const selectedIndex = selected ? playable.findIndex((item) => item.id === selected.id) : -1
  const nextContent = selectedIndex >= 0 ? playable[selectedIndex + 1] : null
  const completedCount = playable.filter((item) => progressStatus(progressMap.get(item.id)) === 'completed').length
  const overallProgress = playable.length ? Math.round((completedCount / playable.length) * 100) : 0

  async function saveProgress(content: MemberContent, status: ProgressStatus) {
    setSavingId(content.id)
    setError('')
    try {
      const response = await fetch('/api/members/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_content_id: content.id,
          status,
          progress_percent: status === 'completed' ? 100 : 25,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.message || 'Não foi possível salvar seu progresso.')

      setProgressMap((current) => {
        const next = new Map(current)
        next.set(content.id, payload.progress)
        return next
      })
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar seu progresso.')
    } finally {
      setSavingId('')
    }
  }

  const selectedProgress = selected ? progressStatus(progressMap.get(selected.id)) : 'not_started'
  const assetUrl = selected?.asset_url || ''
  const iframeUrl = assetUrl ? embedUrl(assetUrl) : ''

  return (
    <main className="member-player">
      <aside className="member-sidebar">
        <Link href="/membros" className="member-back">
          <ArrowLeft size={16} />
          Biblioteca
        </Link>

        <div className="member-product-card">
          <div className="member-product-cover">
            {product.thumbnail_url || product.cover_image_url ? (
              <img src={product.thumbnail_url || product.cover_image_url || ''} alt={product.title} />
            ) : (
              <BookOpen size={34} />
            )}
          </div>
          <div>
            <span>{kindLabel(product.product_type)}</span>
            <h1>{product.title}</h1>
            <p>{product.subtitle || product.description}</p>
          </div>
        </div>

        <div className="member-progress-box">
          <div>
            <span>Seu progresso</span>
            <strong>{overallProgress}%</strong>
          </div>
          <progress value={overallProgress} max={100} />
          <small>{completedCount} de {playable.length} conteúdo{playable.length === 1 ? '' : 's'} concluído{playable.length === 1 ? '' : 's'}</small>
        </div>

        <nav className="member-lessons" aria-label="Conteúdos do produto">
          {modules.map((module) => (
            <section key={module.id}>
              <h2>
                <Layers size={15} />
                {module.title}
              </h2>
              {module.description && <p>{module.description}</p>}
              <div>
                {module.items.map((item) => {
                  const status = progressStatus(progressMap.get(item.id))
                  const active = selected?.id === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={active ? 'is-active' : ''}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <span className={`member-status-dot is-${status}`}>
                        {status === 'completed' ? <CheckCircle2 size={14} /> : <Play size={12} fill="currentColor" />}
                      </span>
                      <span>
                        <strong>{item.title}</strong>
                        <small>{kindLabel(item.content_type)} {formatDuration(item.duration_seconds)}</small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </nav>
      </aside>

      <section className="member-content">
        <header className="member-content-header">
          <div>
            <span>Olá, {memberName.split(' ')[0] || 'membro'}</span>
            <h2>{selected?.title || 'Conteúdo em preparação'}</h2>
            {selected?.description && <p>{selected.description}</p>}
          </div>
          {selected && (
            <div className={`member-pill is-${selectedProgress}`}>
              {selectedProgress === 'completed' ? 'Concluído' : selectedProgress === 'in_progress' ? 'Em andamento' : 'Não iniciado'}
            </div>
          )}
        </header>

        {error && <div className="member-error">{error}</div>}

        {selected ? (
          <>
            <div className="member-viewer">
              {assetUrl && iframeUrl ? (
                <iframe src={iframeUrl} title={selected.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
              ) : assetUrl && (selected.content_type === 'video' || isVideoUrl(assetUrl)) ? (
                <video controls src={assetUrl} />
              ) : assetUrl && (selected.content_type === 'pdf' || selected.content_type === 'ebook' || isPdfUrl(assetUrl)) ? (
                <iframe src={assetUrl} title={selected.title} />
              ) : assetUrl && selected.content_type === 'external_link' ? (
                <div className="member-link-view">
                  <LinkIcon size={42} />
                  <h3>Material externo</h3>
                  <p>Abra o material em uma nova aba para estudar com mais conforto.</p>
                  <a href={assetUrl} target="_blank" rel="noreferrer">
                    Abrir material
                    <ExternalLink size={16} />
                  </a>
                </div>
              ) : (
                <div className="member-text-view">
                  <FileText size={40} />
                  <h3>{selected.title}</h3>
                  {(selected.body || selected.description || 'Conteúdo em preparação.').split(/\n{2,}/).map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              )}
            </div>

            {selected.body && assetUrl && (
              <article className="member-body">
                {selected.body.split(/\n{2,}/).map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </article>
            )}

            <footer className="member-actions">
              <button
                type="button"
                onClick={() => saveProgress(selected, 'in_progress')}
                disabled={savingId === selected.id || selectedProgress === 'completed'}
              >
                {savingId === selected.id ? <Loader2 className="animate-spin" size={16} /> : <Clock3 size={16} />}
                Marcar em andamento
              </button>
              <button
                type="button"
                className="is-primary"
                onClick={() => saveProgress(selected, 'completed')}
                disabled={savingId === selected.id}
              >
                {savingId === selected.id ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                Concluir conteúdo
              </button>
              {nextContent && (
                <button type="button" onClick={() => setSelectedId(nextContent.id)}>
                  Próximo
                  <ChevronRight size={16} />
                </button>
              )}
            </footer>
          </>
        ) : (
          <div className="member-empty-player">
            <BookOpen size={36} />
            <h3>Conteúdo em preparação</h3>
            <p>Este produto já está na sua biblioteca. Assim que as aulas forem cadastradas no admin, elas aparecem aqui.</p>
          </div>
        )}
      </section>

      <style jsx>{`
        .member-player {
          min-height: 100vh;
          display: grid;
          grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
          background: #020607;
          color: #fff;
          font-family: Inter, Arial, sans-serif;
        }

        .member-sidebar {
          position: sticky;
          top: 0;
          height: 100vh;
          overflow: auto;
          border-right: 1px solid rgba(232, 176, 73, 0.16);
          background: linear-gradient(180deg, #051113, #020607);
          padding: 18px;
        }

        .member-back,
        .member-actions button,
        .member-link-view a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          text-decoration: none;
        }

        .member-back {
          min-height: 36px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.82rem;
          font-weight: 800;
          text-transform: uppercase;
        }

        .member-product-card {
          display: grid;
          grid-template-columns: 86px minmax(0, 1fr);
          gap: 14px;
          align-items: center;
          margin: 20px 0;
        }

        .member-product-cover {
          aspect-ratio: 3 / 4;
          display: grid;
          place-items: center;
          overflow: hidden;
          border: 1px solid rgba(232, 176, 73, 0.28);
          border-radius: 8px;
          color: #e8b049;
          background: rgba(232, 176, 73, 0.08);
        }

        .member-product-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .member-product-card span,
        .member-progress-box span,
        .member-content-header span {
          color: #e8b049;
          font-size: 0.72rem;
          font-weight: 950;
          text-transform: uppercase;
        }

        .member-product-card h1 {
          margin: 5px 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 1.35rem;
          line-height: 1.08;
        }

        .member-product-card p,
        .member-lessons section > p,
        .member-content-header p,
        .member-body p,
        .member-text-view p,
        .member-empty-player p,
        .member-link-view p {
          color: rgba(255, 255, 255, 0.68);
          line-height: 1.6;
        }

        .member-product-card p {
          margin: 0;
          font-size: 0.82rem;
        }

        .member-progress-box {
          display: grid;
          gap: 9px;
          padding: 14px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.04);
        }

        .member-progress-box div {
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }

        .member-progress-box strong {
          color: #fff;
        }

        .member-progress-box progress {
          width: 100%;
          height: 8px;
          overflow: hidden;
          border: 0;
          border-radius: 99px;
          background: rgba(255, 255, 255, 0.1);
        }

        .member-progress-box progress::-webkit-progress-bar {
          background: rgba(255, 255, 255, 0.1);
        }

        .member-progress-box progress::-webkit-progress-value {
          background: #e8b049;
        }

        .member-progress-box small {
          color: rgba(255, 255, 255, 0.55);
        }

        .member-lessons {
          display: grid;
          gap: 18px;
          margin-top: 18px;
        }

        .member-lessons h2 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          color: rgba(255, 255, 255, 0.92);
          font-size: 0.9rem;
        }

        .member-lessons section > p {
          margin: 6px 0 9px;
          font-size: 0.78rem;
        }

        .member-lessons section > div {
          display: grid;
          gap: 7px;
        }

        .member-lessons button {
          display: grid;
          grid-template-columns: 28px minmax(0, 1fr) auto;
          align-items: center;
          gap: 9px;
          width: 100%;
          padding: 10px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          color: #fff;
          background: rgba(255, 255, 255, 0.035);
          cursor: pointer;
          text-align: left;
        }

        .member-lessons button.is-active {
          border-color: rgba(232, 176, 73, 0.7);
          background: rgba(232, 176, 73, 0.12);
        }

        .member-status-dot {
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          color: rgba(255, 255, 255, 0.75);
          background: rgba(255, 255, 255, 0.08);
        }

        .member-status-dot.is-completed {
          color: #061014;
          background: #e8b049;
        }

        .member-lessons strong,
        .member-lessons small {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .member-lessons strong {
          font-size: 0.86rem;
        }

        .member-lessons small {
          margin-top: 3px;
          color: rgba(255, 255, 255, 0.52);
          font-size: 0.72rem;
        }

        .member-content {
          min-width: 0;
          padding: clamp(22px, 4vw, 46px);
        }

        .member-content-header {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .member-content-header h2 {
          max-width: 920px;
          margin: 8px 0 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(2rem, 4vw, 4.7rem);
          line-height: 0.96;
          letter-spacing: 0;
        }

        .member-content-header p {
          max-width: 760px;
          margin: 14px 0 0;
        }

        .member-pill {
          flex: 0 0 auto;
          padding: 8px 10px;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 999px;
          color: rgba(255,255,255,0.72);
          font-size: 0.76rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .member-pill.is-completed {
          color: #061014;
          border-color: #e8b049;
          background: #e8b049;
        }

        .member-error {
          margin-bottom: 14px;
          padding: 12px 14px;
          border: 1px solid rgba(239, 68, 68, 0.32);
          border-radius: 8px;
          color: #fecaca;
          background: rgba(239, 68, 68, 0.08);
        }

        .member-viewer {
          min-height: min(56vw, 640px);
          overflow: hidden;
          border: 1px solid rgba(232, 176, 73, 0.18);
          border-radius: 8px;
          background: #050b0d;
        }

        .member-viewer iframe,
        .member-viewer video {
          width: 100%;
          height: min(56vw, 640px);
          display: block;
          border: 0;
          background: #000;
        }

        .member-text-view,
        .member-link-view,
        .member-empty-player {
          min-height: min(56vw, 640px);
          display: grid;
          align-content: center;
          justify-items: center;
          gap: 12px;
          padding: 34px;
          text-align: center;
        }

        .member-text-view svg,
        .member-link-view svg,
        .member-empty-player svg {
          color: #e8b049;
        }

        .member-text-view h3,
        .member-link-view h3,
        .member-empty-player h3 {
          margin: 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 2rem;
        }

        .member-text-view p {
          max-width: 760px;
          margin: 0;
          text-align: left;
        }

        .member-link-view a {
          min-height: 42px;
          padding: 0 16px;
          border-radius: 7px;
          color: #061014;
          background: #e8b049;
          font-size: 0.82rem;
          font-weight: 950;
          text-transform: uppercase;
        }

        .member-body {
          max-width: 880px;
          margin: 24px 0 0;
          padding: 20px 0 0;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .member-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 22px;
        }

        .member-actions button {
          min-height: 42px;
          padding: 0 15px;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 7px;
          color: #fff;
          background: rgba(255,255,255,0.04);
          font-size: 0.8rem;
          font-weight: 950;
          text-transform: uppercase;
          cursor: pointer;
        }

        .member-actions button.is-primary {
          color: #061014;
          border-color: #e8b049;
          background: #e8b049;
        }

        .member-actions button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        @media (max-width: 980px) {
          .member-player {
            grid-template-columns: 1fr;
          }

          .member-sidebar {
            position: static;
            height: auto;
            border-right: 0;
            border-bottom: 1px solid rgba(232, 176, 73, 0.16);
          }
        }

        @media (max-width: 640px) {
          .member-sidebar,
          .member-content {
            padding: 16px;
          }

          .member-content-header {
            display: grid;
          }

          .member-content-header h2 {
            font-size: clamp(2rem, 13vw, 3rem);
          }

          .member-viewer,
          .member-viewer iframe,
          .member-viewer video,
          .member-text-view,
          .member-link-view,
          .member-empty-player {
            min-height: 420px;
            height: auto;
          }

          .member-actions {
            display: grid;
          }
        }
      `}</style>
    </main>
  )
}
