'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Instagram,
  MessageCircle,
  MessageSquareText,
  RefreshCw,
  Send,
  Share2,
  Sparkles,
} from 'lucide-react'
import AdminLoadingState from '@/components/admin/AdminLoadingState'

type ThreadRow = {
  id: string
  platform: 'instagram' | 'facebook'
  external_id: string
  participant_name: string | null
  status: string
  unread_count: number
  last_message_at: string | null
}

type MessageRow = {
  id: string
  thread_id: string
  platform: 'instagram' | 'facebook'
  sender_name: string | null
  direction: 'inbound' | 'outbound' | 'unknown'
  message: string | null
  attachment_type: string | null
  sent_at: string | null
}

type CommentRow = {
  id: string
  platform: 'instagram' | 'facebook'
  external_id: string
  parent_external_id: string | null
  author_name: string | null
  message: string | null
  like_count: number
  reply_count: number
  permalink: string | null
  commented_at: string | null
}

type InboxPayload = {
  success: boolean
  threads: ThreadRow[]
  messages: MessageRow[]
  comments: CommentRow[]
  error?: string
}

type AiSuggestion = {
  id: string
  source_type: 'comment' | 'message' | 'thread'
  source_id: string
  platform: 'instagram' | 'facebook'
  intent: string
  sentiment: string
  priority: 'baixa' | 'normal' | 'alta' | 'urgente'
  lead_score: number
  summary: string | null
  suggested_reply: string | null
  recommended_action: string | null
  status: string
  updated_at: string
}

const platformLabel = {
  instagram: 'Instagram',
  facebook: 'Facebook',
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function PlatformBadge({ platform }: { platform: 'instagram' | 'facebook' }) {
  return (
    <span className={`meta-inbox-platform ${platform}`}>
      {platform === 'instagram' ? <Instagram size={13} /> : <Share2 size={13} />}
      {platformLabel[platform]}
    </span>
  )
}

export default function MetaInboxPage() {
  const [data, setData] = useState<InboxPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([])
  const [sendingSuggestionId, setSendingSuggestionId] = useState('')
  const [activePlatform, setActivePlatform] = useState<'all' | 'instagram' | 'facebook'>('all')

  const loadInbox = async () => {
    setError('')
    const response = await fetch('/api/admin/social-inbox?limit=60')
    const payload = await response.json()
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Erro ao carregar inbox Meta.')
    setData(payload)
  }

  const loadSuggestions = async () => {
    const response = await fetch('/api/admin/social-inbox/analyze?limit=40')
    const payload = await response.json()
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Erro ao carregar sugestoes da IA.')
    setSuggestions(payload.suggestions || [])
  }

  const syncInbox = async () => {
    setSyncing(true)
    setWarnings([])
    setError('')
    try {
      const response = await fetch('/api/admin/social-inbox/sync?platform=all&scope=all&mediaLimit=8&commentsPerMedia=25&conversationLimit=20', {
        method: 'POST',
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Erro ao sincronizar inbox Meta.')
      setWarnings(Array.isArray(payload.warnings) ? payload.warnings : [])
      await loadInbox()
      await loadSuggestions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao sincronizar inbox Meta.')
    } finally {
      setSyncing(false)
    }
  }

  const analyzeInbox = async () => {
    setAnalyzing(true)
    setError('')
    try {
      const response = await fetch('/api/admin/social-inbox/analyze?limit=25&force=1', {
        method: 'POST',
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Erro ao analisar inbox com IA.')
      await loadSuggestions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao analisar inbox com IA.')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSuggestionAction = async (suggestion: AiSuggestion, action: 'approve' | 'send') => {
    setSendingSuggestionId(`${action}-${suggestion.id}`)
    setError('')
    try {
      const response = await fetch('/api/admin/social-inbox/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestion_id: suggestion.id,
          action,
          reply: suggestion.suggested_reply,
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Erro ao processar sugestao.')
      await Promise.all([loadInbox(), loadSuggestions()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar sugestao.')
    } finally {
      setSendingSuggestionId('')
    }
  }

  useEffect(() => {
    Promise.all([loadInbox(), loadSuggestions()])
      .catch(err => setError(err instanceof Error ? err.message : 'Erro ao carregar inbox Meta.'))
      .finally(() => setLoading(false))
  }, [])

  const messagesByThread = useMemo(() => {
    const grouped = new Map<string, MessageRow[]>()
    for (const message of data?.messages || []) {
      const rows = grouped.get(message.thread_id) || []
      rows.push(message)
      grouped.set(message.thread_id, rows)
    }
    return grouped
  }, [data?.messages])

  const comments = data?.comments || []
  const threads = data?.threads || []
  const messages = data?.messages || []
  const hotSuggestions = suggestions.filter(item => item.lead_score >= 60 || item.priority === 'alta' || item.priority === 'urgente')
  const filteredComments = activePlatform === 'all' ? comments : comments.filter(comment => comment.platform === activePlatform)
  const filteredThreads = activePlatform === 'all' ? threads : threads.filter(thread => thread.platform === activePlatform)
  const instagramComments = comments.filter(comment => comment.platform === 'instagram').length
  const facebookComments = comments.filter(comment => comment.platform === 'facebook').length
  const instagramThreads = threads.filter(thread => thread.platform === 'instagram').length
  const facebookThreads = threads.filter(thread => thread.platform === 'facebook').length
  const instagramDirectWarning = warnings.some(item => item.toLowerCase().includes('direct do instagram'))
  const platformTabs = [
    { key: 'all' as const, label: 'Todos', count: comments.length + threads.length },
    { key: 'instagram' as const, label: 'Instagram', count: instagramComments + instagramThreads },
    { key: 'facebook' as const, label: 'Facebook', count: facebookComments + facebookThreads },
  ]

  if (loading) return <AdminLoadingState message="Carregando inbox Meta..." />

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MessageSquareText size={26} /> Caixa Meta
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '.85rem', marginTop: 4 }}>
            Comentarios, Direct do Instagram e Messenger do Facebook em uma fila unica.
          </p>
        </div>
        <div className="meta-inbox-actions">
          <button
            type="button"
            className="btn"
            onClick={analyzeInbox}
            disabled={analyzing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <Sparkles size={18} className={analyzing ? 'spin' : ''} />
            {analyzing ? 'Analisando...' : 'Analisar com IA'}
          </button>
          <button
            type="button"
            className="btn btn-gold"
            onClick={syncInbox}
            disabled={syncing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <RefreshCw size={18} className={syncing ? 'spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar Meta'}
          </button>
        </div>
      </div>

      {(error || warnings.length > 0) && (
        <div className={`chart-card meta-inbox-alert ${error ? 'error' : ''}`}>
          {error || (
            <>
              <strong>Avisos da Meta</strong>
              {warnings.slice(0, 4).map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
            </>
          )}
        </div>
      )}

      <div className="meta-inbox-status-grid">
        <div className="meta-inbox-status-card ok">
          <Share2 size={18} />
          <div>
            <strong>Facebook Messenger</strong>
            <span>{facebookThreads} conversas e {facebookComments} comentarios sincronizados</span>
          </div>
        </div>
        <div className="meta-inbox-status-card ok">
          <Instagram size={18} />
          <div>
            <strong>Instagram comentarios</strong>
            <span>{instagramComments} comentarios sincronizados</span>
          </div>
        </div>
        <div className={`meta-inbox-status-card ${instagramDirectWarning || instagramThreads === 0 ? 'warning' : 'ok'}`}>
          <MessageSquareText size={18} />
          <div>
            <strong>Instagram Direct</strong>
            <span>{instagramThreads > 0 ? `${instagramThreads} conversas sincronizadas` : 'Aguardando token valido/capability de mensagens'}</span>
          </div>
        </div>
        <div className="meta-inbox-status-card neutral">
          <Sparkles size={18} />
          <div>
            <strong>Triagem IA</strong>
            <span>{hotSuggestions.length} leads quentes de {suggestions.length} sugestoes</span>
          </div>
        </div>
      </div>

      <div className="meta-inbox-toolbar">
        <div className="meta-inbox-tabs">
          {platformTabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              className={activePlatform === tab.key ? 'active' : ''}
              onClick={() => setActivePlatform(tab.key)}
            >
              {tab.label}
              <span>{tab.count}</span>
            </button>
          ))}
        </div>
        <span>{messages.length} mensagens salvas no historico</span>
      </div>

      <section className="chart-card meta-ai-panel">
        <div className="meta-inbox-section-title">
          <span>Triagem IA</span>
          <strong>{suggestions.length} sugestoes</strong>
        </div>
        <div className="meta-ai-suggestions">
          {suggestions.slice(0, 5).map(item => (
            <article key={item.id} className={`meta-ai-card priority-${item.priority}`}>
              <div className="meta-ai-card-head">
                <PlatformBadge platform={item.platform} />
                <strong>{item.lead_score}</strong>
              </div>
              <div className="meta-ai-tags">
                <span>{item.intent}</span>
                <span>{item.sentiment}</span>
                <span>{item.priority}</span>
              </div>
              <p>{item.summary || 'Sem resumo.'}</p>
              {item.suggested_reply && (
                <blockquote>{item.suggested_reply}</blockquote>
              )}
              {item.recommended_action && <small>{item.recommended_action}</small>}
              <div className="meta-ai-actions">
                <button
                  type="button"
                  onClick={() => handleSuggestionAction(item, 'approve')}
                  disabled={sendingSuggestionId === `approve-${item.id}` || item.status === 'approved' || item.status === 'sent'}
                >
                  {item.status === 'approved' ? 'Aprovada' : 'Aprovar'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSuggestionAction(item, 'send')}
                  disabled={sendingSuggestionId === `send-${item.id}` || item.status === 'sent' || !item.suggested_reply}
                >
                  {item.status === 'sent' ? 'Enviada' : 'Enviar resposta'}
                </button>
              </div>
            </article>
          ))}
          {suggestions.length === 0 && (
            <div className="meta-inbox-empty">Clique em Analisar com IA para gerar respostas sugeridas e detectar leads quentes.</div>
          )}
        </div>
      </section>

      <div className="meta-inbox-grid">
        <section className="chart-card">
          <div className="meta-inbox-section-title">
            <span>Comentarios recentes</span>
            <strong>{filteredComments.length}</strong>
          </div>
          <div className="meta-inbox-list">
            {filteredComments.slice(0, 45).map(comment => (
              <a
                key={comment.id}
                href={comment.permalink || '#'}
                target="_blank"
                rel="noreferrer"
                className="meta-inbox-comment"
              >
                <div>
                  <div className="meta-inbox-row-head">
                    <strong>{comment.author_name || 'Autor nao identificado'}</strong>
                    <PlatformBadge platform={comment.platform} />
                  </div>
                  <p>{comment.message || 'Comentario sem texto.'}</p>
                  <span>{formatDate(comment.commented_at)} | {comment.like_count} curtidas | {comment.reply_count} respostas</span>
                </div>
              </a>
            ))}
            {filteredComments.length === 0 && (
              <div className="meta-inbox-empty">Nenhum comentario sincronizado ainda.</div>
            )}
          </div>
        </section>

        <section className="chart-card">
          <div className="meta-inbox-section-title">
            <span>Conversas</span>
            <strong>{filteredThreads.length}</strong>
          </div>
          <div className="meta-inbox-list">
            {filteredThreads.slice(0, 35).map(thread => {
              const latestMessages = messagesByThread.get(thread.id) || []
              return (
                <div key={thread.id} className="meta-inbox-thread">
                  <div className="meta-inbox-row-head">
                    <strong>{thread.participant_name || 'Contato Meta'}</strong>
                    <PlatformBadge platform={thread.platform} />
                  </div>
                  <span>{formatDate(thread.last_message_at)} | {thread.unread_count} nao lidas</span>
                  <div className="meta-inbox-message-stack">
                    {latestMessages.slice(0, 3).map(message => (
                      <p key={message.id} className={message.direction}>
                        <b>{message.direction === 'outbound' ? 'Pilger' : message.sender_name || 'Contato'}:</b>
                        {' '}
                        {message.message || message.attachment_type || 'Mensagem sem texto.'}
                      </p>
                    ))}
                  </div>
                </div>
              )
            })}
            {filteredThreads.length === 0 && (
              <div className="meta-inbox-empty">
                Nenhuma conversa para este filtro. Messenger do Facebook usa Page Token; Direct do Instagram depende do token Instagram valido e da capability de mensagens.
              </div>
            )}
          </div>
        </section>
      </div>

      <style jsx global>{`
        .meta-inbox-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .meta-inbox-status-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 14px;
        }
        .meta-inbox-status-card {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          border: 1px solid var(--border-color);
          border-radius: 14px;
          padding: 13px;
          background: var(--bg-primary);
        }
        .meta-inbox-status-card svg {
          flex: 0 0 auto;
          margin-top: 2px;
        }
        .meta-inbox-status-card.ok svg {
          color: #16a34a;
        }
        .meta-inbox-status-card.warning svg {
          color: #d97706;
        }
        .meta-inbox-status-card.neutral svg {
          color: var(--gold);
        }
        .meta-inbox-status-card strong {
          display: block;
          color: var(--text-primary);
          font-size: .84rem;
          margin-bottom: 4px;
        }
        .meta-inbox-status-card span {
          display: block;
          color: var(--text-muted);
          font-size: .72rem;
          line-height: 1.35;
        }
        .meta-inbox-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
          flex-wrap: wrap;
        }
        .meta-inbox-toolbar > span {
          color: var(--text-muted);
          font-size: .76rem;
          font-weight: 800;
        }
        .meta-inbox-tabs {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .meta-inbox-tabs button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--border-color);
          border-radius: 999px;
          background: var(--bg-primary);
          color: var(--text-primary);
          padding: 8px 12px;
          font-size: .76rem;
          font-weight: 900;
          cursor: pointer;
        }
        .meta-inbox-tabs button.active {
          border-color: rgba(201, 169, 110, .5);
          background: var(--bg-dark);
          color: white;
        }
        .meta-inbox-tabs button span {
          display: inline-grid;
          min-width: 22px;
          height: 22px;
          place-items: center;
          border-radius: 999px;
          background: rgba(201, 169, 110, .14);
          color: var(--gold);
          font-size: .68rem;
        }
        .meta-inbox-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(320px, .8fr);
          gap: 18px;
          align-items: start;
        }
        .meta-ai-panel {
          margin-bottom: 18px;
        }
        .meta-ai-suggestions {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 12px;
        }
        .meta-ai-card {
          position: relative;
          display: grid;
          gap: 9px;
          border: 1px solid rgba(17, 24, 39, .08);
          border-radius: 14px;
          padding: 13px;
          background: linear-gradient(135deg, rgba(255,255,255,.98), rgba(248,244,235,.72));
          overflow: hidden;
        }
        .meta-ai-card::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          width: 4px;
          height: 100%;
          background: #94a3b8;
        }
        .meta-ai-card.priority-alta::before,
        .meta-ai-card.priority-urgente::before {
          background: #ef4444;
        }
        .meta-ai-card.priority-normal::before {
          background: var(--gold);
        }
        .meta-ai-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .meta-ai-card-head strong {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: rgba(201, 169, 110, .14);
          color: var(--gold);
          font-family: Playfair Display, serif;
          font-size: 1.05rem;
        }
        .meta-ai-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .meta-ai-tags span {
          padding: 3px 7px;
          border-radius: 999px;
          background: rgba(148, 163, 184, .12);
          color: var(--text-muted);
          font-size: .66rem;
          font-weight: 900;
          text-transform: uppercase;
        }
        .meta-ai-card p,
        .meta-ai-card blockquote,
        .meta-ai-card small {
          margin: 0;
          color: var(--text-primary);
          font-size: .82rem;
          line-height: 1.45;
        }
        .meta-ai-card blockquote {
          padding: 9px 10px;
          border-left: 3px solid var(--gold);
          border-radius: 8px;
          background: rgba(201, 169, 110, .1);
        }
        .meta-ai-card small {
          color: var(--text-muted);
        }
        .meta-ai-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .meta-ai-actions button {
          border: 1px solid var(--border-color);
          border-radius: 999px;
          background: var(--bg-primary);
          color: var(--text-primary);
          padding: 7px 10px;
          font-size: .72rem;
          font-weight: 900;
          cursor: pointer;
        }
        .meta-ai-actions button:last-child {
          border-color: var(--gold);
          background: rgba(201, 169, 110, .14);
          color: var(--gold);
        }
        .meta-ai-actions button:disabled {
          cursor: not-allowed;
          opacity: .55;
        }
        .meta-inbox-section-title {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }
        .meta-inbox-section-title span {
          color: var(--gold);
          font-size: .72rem;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .meta-inbox-section-title strong {
          color: var(--text-muted);
          font-size: .8rem;
        }
        .meta-inbox-list {
          display: grid;
          gap: 10px;
          max-height: 760px;
          overflow: auto;
          padding-right: 4px;
        }
        .meta-inbox-comment,
        .meta-inbox-thread {
          display: block;
          border: 1px solid rgba(17, 24, 39, .08);
          border-radius: 14px;
          padding: 13px;
          background:
            linear-gradient(135deg, rgba(255,255,255,.96), rgba(248,244,235,.65));
          color: var(--text-primary);
          text-decoration: none;
          overflow: hidden;
        }
        .meta-inbox-comment:hover {
          border-color: var(--gold);
        }
        .meta-inbox-row-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        }
        .meta-inbox-row-head strong {
          color: var(--text-primary);
          font-size: .92rem;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .meta-inbox-comment p,
        .meta-inbox-message-stack p {
          margin: 0 0 8px;
          color: var(--text-primary);
          font-size: .86rem;
          line-height: 1.45;
          overflow-wrap: anywhere;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .meta-inbox-comment span,
        .meta-inbox-thread > span {
          color: var(--text-muted);
          font-size: .72rem;
        }
        .meta-inbox-platform {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 8px;
          border-radius: 999px;
          font-size: .68rem;
          font-weight: 900;
          letter-spacing: .03em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .meta-inbox-platform.instagram {
          color: #c13584;
          background: rgba(193, 53, 132, .1);
        }
        .meta-inbox-platform.facebook {
          color: #1877f2;
          background: rgba(24, 119, 242, .1);
        }
        .meta-inbox-message-stack {
          display: grid;
          gap: 7px;
          margin-top: 10px;
        }
        .meta-inbox-message-stack p {
          margin: 0;
          padding: 8px 10px;
          border-radius: 10px;
          background: rgba(148, 163, 184, .12);
          -webkit-line-clamp: 2;
        }
        .meta-inbox-message-stack p.outbound {
          background: rgba(201, 169, 110, .15);
        }
        .meta-inbox-empty {
          padding: 18px;
          border: 1px dashed var(--border-color);
          border-radius: 14px;
          color: var(--text-muted);
          font-size: .84rem;
          text-align: center;
          line-height: 1.45;
        }
        .meta-inbox-helper {
          margin-top: 4px;
          color: var(--text-muted);
          font-size: .7rem;
        }
        .meta-inbox-alert {
          display: grid;
          gap: 6px;
          margin-bottom: 18px;
          border-color: rgba(245, 158, 11, .35);
          color: #b45309;
          font-size: .82rem;
        }
        .meta-inbox-alert.error {
          border-color: rgba(239, 68, 68, .35);
          color: #ef4444;
        }
        @media (max-width: 880px) {
          .meta-inbox-status-grid {
            grid-template-columns: 1fr 1fr;
          }
          .meta-inbox-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 560px) {
          .meta-inbox-status-grid {
            grid-template-columns: 1fr;
          }
          .meta-inbox-list {
            max-height: 560px;
          }
        }
      `}</style>
    </div>
  )
}
