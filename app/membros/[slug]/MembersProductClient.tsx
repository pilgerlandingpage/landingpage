'use client'

import { useMemo, useRef, useState } from 'react'
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
import MemberLogoutButton from '../MemberLogoutButton'

type MembersProductClientProps = {
  product: MemberProduct
  contents: MemberContent[]
  progress: MemberProgress[]
  memberName: string
  canTrackProgress?: boolean
  adminPreview?: boolean
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
    ebook: 'Livro online',
    bonus: 'Bônus',
    external_link: 'Link',
    digital_download: 'Ferramenta',
  }
  return labels[type] || 'Conteúdo'
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm|ogg)(\?|#|$)/i.test(url)
}

function isInternalUrl(url: string) {
  return url.startsWith('/')
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

function protectedBookAssetUrl(product: MemberProduct, content?: MemberContent | null) {
  if (product.slug === 'corretor-nota-8' && content?.content_type === 'ebook') {
    return `/membros/${product.slug}/livro`
  }
  return ''
}

export default function MembersProductClient({
  product,
  contents,
  progress,
  memberName,
  canTrackProgress = true,
  adminPreview = false,
}: MembersProductClientProps) {
  const isBookOnlyProduct = product.slug === 'corretor-nota-8'
  const productContents = useMemo(() => {
    if (!isBookOnlyProduct) return contents

    const bookContent = contents.find((item) => item.content_type === 'ebook')
    return bookContent ? [bookContent] : contents.filter((item) => item.content_type !== 'module').slice(0, 1)
  }, [contents, isBookOnlyProduct])
  const [selectedId, setSelectedId] = useState(firstPlayable(productContents)?.id || '')
  const contentRef = useRef<HTMLElement | null>(null)
  const [progressMap, setProgressMap] = useState(() => {
    const map = new Map<string, MemberProgress>()
    progress.forEach((item) => map.set(item.product_content_id, item))
    return map
  })
  const [savingId, setSavingId] = useState('')
  const [error, setError] = useState('')

  const modules = useMemo(() => {
    const moduleRows = productContents.filter((item) => item.content_type === 'module')
    const orphanLessons = productContents.filter((item) => item.content_type !== 'module' && !item.parent_id)

    if (!moduleRows.length) {
      return [{
        id: 'default',
        title: 'Conteúdos',
        description: product.subtitle || product.description,
        items: productContents.filter((item) => item.content_type !== 'module'),
      }]
    }

    return [
      ...moduleRows.map((module) => ({
        id: module.id,
        title: module.title,
        description: module.description,
        items: productContents.filter((item) => item.parent_id === module.id && item.content_type !== 'module'),
      })),
      ...(orphanLessons.length ? [{
        id: 'extras',
        title: 'Materiais extras',
        description: 'Conteúdos sem módulo definido.',
        items: orphanLessons,
      }] : []),
    ]
  }, [productContents, product.description, product.subtitle])

  const playable = productContents.filter((item) => item.content_type !== 'module')
  const selected = productContents.find((item) => item.id === selectedId) || firstPlayable(productContents)
  const selectedIndex = selected ? playable.findIndex((item) => item.id === selected.id) : -1
  const nextContent = selectedIndex >= 0 ? playable[selectedIndex + 1] : null
  const completedCount = playable.filter((item) => progressStatus(progressMap.get(item.id)) === 'completed').length
  const overallProgress = playable.length ? Math.round((completedCount / playable.length) * 100) : 0

  async function saveProgress(content: MemberContent, status: ProgressStatus) {
    if (!canTrackProgress) return

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
  const assetUrl = selected?.asset_url || protectedBookAssetUrl(product, selected)
  const iframeUrl = assetUrl ? embedUrl(assetUrl) : ''
  const isBookViewer = Boolean(assetUrl && selected?.content_type === 'ebook')
  const isProfileAssessment = product.slug === 'perfil-corretor-ideal'
  const opensInsidePlatform = Boolean(assetUrl && isInternalUrl(assetUrl))

  function selectContent(contentId: string) {
    setSelectedId(contentId)

    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 980px)').matches) {
      window.setTimeout(() => {
        contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 40)
    }
  }

  return (
    <main className={`member-player ${isBookOnlyProduct ? 'is-book-only' : ''}`}>
      {!isBookOnlyProduct && (
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
            <span>{adminPreview ? 'Modo admin' : 'Seu progresso'}</span>
            <strong>{adminPreview ? 'Preview' : `${overallProgress}%`}</strong>
          </div>
          {!adminPreview && <progress value={overallProgress} max={100} />}
          <small>
            {adminPreview
              ? 'Acesso de revisão liberado para admin ativo.'
              : `${completedCount} de ${playable.length} conteúdo${playable.length === 1 ? '' : 's'} concluído${playable.length === 1 ? '' : 's'}`}
          </small>
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
                      onClick={() => selectContent(item.id)}
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
      )}

      <section className="member-content" ref={contentRef}>
        <div className="member-topbar">
          <Link href="/membros" className="member-mobile-back">
            <ArrowLeft size={16} />
            Biblioteca
          </Link>
          <MemberLogoutButton />
        </div>

        <header className="member-content-header">
          <div>
            <span>Olá, {memberName.split(' ')[0] || 'membro'}</span>
            <h2>{selected?.title || 'Conteúdo em preparação'}</h2>
            {selected?.description && <p>{selected.description}</p>}
          </div>
          {selected && !isBookOnlyProduct && (
            <div className={`member-pill is-${selectedProgress}`}>
              {selectedProgress === 'completed' ? 'Concluído' : selectedProgress === 'in_progress' ? 'Em andamento' : 'Não iniciado'}
            </div>
          )}
        </header>

        {error && <div className="member-error">{error}</div>}

        {selected ? (
          <>
            <div className={`member-viewer ${isBookViewer ? 'is-book' : ''}`}>
              {assetUrl && iframeUrl ? (
                <iframe src={iframeUrl} title={selected.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
              ) : assetUrl && (selected.content_type === 'video' || isVideoUrl(assetUrl)) ? (
                <video controls src={assetUrl} />
              ) : assetUrl && (selected.content_type === 'pdf' || selected.content_type === 'ebook' || isPdfUrl(assetUrl)) ? (
                <iframe src={assetUrl} title={selected.title} allow="fullscreen" allowFullScreen />
              ) : assetUrl && selected.content_type === 'external_link' ? (
                <div className={`member-link-view ${isProfileAssessment ? 'is-assessment' : ''}`}>
                  <LinkIcon size={42} />
                  <h3>{isProfileAssessment ? 'Perfil do Corretor Ideal' : 'Material externo'}</h3>
                  <p>
                    {isProfileAssessment
                      ? 'Diagnóstico gratuito com 36 perguntas para mapear sua postura comercial.'
                      : 'Abra o material em uma nova aba para estudar com mais conforto.'}
                  </p>
                  <a href={assetUrl} target={opensInsidePlatform ? undefined : '_blank'} rel={opensInsidePlatform ? undefined : 'noreferrer'}>
                    {isProfileAssessment ? 'Abrir diagnóstico' : 'Abrir material'}
                    {opensInsidePlatform ? <ChevronRight size={16} /> : <ExternalLink size={16} />}
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

            {!isBookOnlyProduct && (
            <footer className="member-actions">
              {canTrackProgress && (
                <>
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
                </>
              )}
              {nextContent && (
                <button type="button" onClick={() => selectContent(nextContent.id)}>
                  Próximo
                  <ChevronRight size={16} />
                </button>
              )}
            </footer>
            )}
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

        .member-player.is-book-only {
          grid-template-columns: 1fr;
        }

        .member-player.is-book-only .member-content {
          width: 100%;
          max-width: 1120px;
          margin: 0 auto;
        }

        .member-player.is-book-only .member-content-header {
          margin-bottom: 14px;
        }

        .member-player.is-book-only .member-content-header h2 {
          max-width: 680px;
          font-size: clamp(1.45rem, 3.2vw, 2.45rem);
          line-height: 1.06;
          font-weight: 650;
        }

        .member-player.is-book-only .member-content-header p {
          max-width: 640px;
          margin-top: 8px;
          color: rgba(255, 255, 255, 0.68);
          font-size: 0.9rem;
          line-height: 1.45;
        }

        .member-player.is-book-only .member-mobile-back {
          display: inline-flex;
        }

        .member-player.is-book-only .member-topbar {
          display: flex;
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
        .member-mobile-back,
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

        .member-mobile-back {
          display: none;
          width: fit-content;
          min-height: 34px;
          color: rgba(255, 255, 255, 0.72);
          font-size: 0.8rem;
          font-weight: 850;
          text-transform: uppercase;
        }

        .member-topbar {
          display: none;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
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
          scroll-margin-top: 12px;
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

        .member-viewer.is-book {
          min-height: min(78vh, 860px);
        }

        .member-viewer iframe,
        .member-viewer video {
          width: 100%;
          height: min(56vw, 640px);
          display: block;
          border: 0;
          background: #000;
        }

        .member-viewer.is-book iframe {
          height: min(78vh, 860px);
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

        .member-link-view.is-assessment {
          position: relative;
          overflow: hidden;
          background:
            linear-gradient(135deg, rgba(232, 176, 73, 0.13), transparent 38%),
            #050b0d;
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

          .member-content {
            order: 1;
          }

          .member-sidebar {
            order: 2;
            position: static;
            height: auto;
            border-right: 0;
            border-top: 1px solid rgba(232, 176, 73, 0.16);
          }

          .member-back {
            display: none;
          }

          .member-mobile-back {
            display: inline-flex;
          }

          .member-topbar {
            display: flex;
          }
        }

        @media (max-width: 640px) {
          .member-sidebar {
            padding: 14px;
          }

          .member-content {
            padding: 14px;
          }

          .member-mobile-back {
            margin-bottom: 0;
          }

          .member-topbar {
            margin-bottom: 10px;
          }

          .member-product-card {
            grid-template-columns: 64px minmax(0, 1fr);
            gap: 12px;
            margin: 0 0 14px;
          }

          .member-product-card h1 {
            font-size: 1rem;
            line-height: 1.05;
          }

          .member-product-card p {
            font-size: 0.74rem;
            line-height: 1.35;
          }

          .member-progress-box {
            padding: 12px;
          }

          .member-lessons {
            gap: 16px;
            margin-top: 16px;
          }

          .member-lessons section > p {
            display: -webkit-box;
            margin: 6px 0 8px;
            overflow: hidden;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            font-size: 0.75rem;
            line-height: 1.45;
          }

          .member-lessons button {
            grid-template-columns: 26px minmax(0, 1fr) 18px;
            min-height: 52px;
            padding: 8px 9px;
            border-radius: 7px;
          }

          .member-status-dot {
            width: 26px;
            height: 26px;
          }

          .member-lessons strong {
            display: -webkit-box;
            white-space: normal;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            font-size: 0.82rem;
            line-height: 1.15;
          }

          .member-lessons small {
            white-space: nowrap;
          }

          .member-content-header {
            display: grid;
            gap: 10px;
            margin-bottom: 14px;
          }

          .member-content-header h2 {
            font-size: clamp(1.72rem, 10.5vw, 2.55rem);
            line-height: 1;
          }

          .member-content-header p {
            margin-top: 10px;
            font-size: 0.9rem;
            line-height: 1.55;
          }

          .member-pill {
            width: 100%;
            justify-content: center;
            text-align: center;
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

          .member-viewer.is-book,
          .member-viewer.is-book iframe {
            min-height: min(70vh, 620px);
            height: min(70vh, 620px);
          }

          .member-body {
            margin-top: 18px;
            font-size: 0.95rem;
            line-height: 1.55;
          }

          .member-actions {
            display: grid;
          }
        }
      `}</style>
    </main>
  )
}
