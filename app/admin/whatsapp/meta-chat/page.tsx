'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  CheckCircle2,
  Clock3,
  Inbox,
  Loader2,
  MessageCircle,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
  UserRound,
} from 'lucide-react'
import AdminLoadingState from '@/components/admin/AdminLoadingState'

type ConversationStatus = 'open' | 'pending' | 'closed' | 'archived'

type SenderSummary = {
  display_name?: string | null
  phone_number?: string | null
  phone_number_id?: string | null
  meta_status?: string | null
  quality_rating?: string | null
}

type CampaignSummary = {
  id: string
  name: string
  campaign_type?: string | null
  template_name?: string | null
}

type LeadSummary = {
  id: string
  name?: string | null
  email?: string | null
  phone?: string | null
  phone_e164?: string | null
  funnel_stage?: string | null
  lead_classification?: string | null
  lead_purpose?: string | null
  lead_budget?: string | null
  created_at?: string | null
}

type MetaConversation = {
  id: string
  sender_id: string
  contact_phone: string
  contact_name?: string | null
  lead_id?: string | null
  last_campaign_id?: string | null
  status: ConversationStatus
  unread_count: number
  last_message_preview?: string | null
  last_message_at?: string | null
  last_inbound_at?: string | null
  last_outbound_at?: string | null
  customer_window_expires_at?: string | null
  created_at?: string | null
  sender?: SenderSummary | SenderSummary[] | null
  campaign?: CampaignSummary | CampaignSummary[] | null
  lead?: LeadSummary | LeadSummary[] | null
}

type MetaMessage = {
  id: string
  conversation_id: string
  direction: 'inbound' | 'outbound' | 'system'
  message_type: string
  text_body?: string | null
  status: string
  error_code?: string | null
  error_message?: string | null
  sent_at?: string | null
  delivered_at?: string | null
  read_at?: string | null
  failed_at?: string | null
  received_at?: string | null
  created_at: string
}

type ChatPayload = {
  success: boolean
  conversations?: MetaConversation[]
  conversation?: MetaConversation
  messages?: MetaMessage[]
  summary?: {
    total: number
    unread: number
    open: number
    pending: number
    closed: number
    windowActive: number
  }
  error?: string
}

const statusOptions: Array<{ value: 'all' | ConversationStatus; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'open', label: 'Abertas' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'closed', label: 'Fechadas' },
  { value: 'archived', label: 'Arquivadas' },
]

const statusLabels: Record<string, string> = {
  open: 'Aberta',
  pending: 'Pendente',
  closed: 'Fechada',
  archived: 'Arquivada',
}

function asSingle<T>(value?: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function shortText(value?: string | null, max = 120) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return 'Sem mensagem'
  return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

function formatPhone(value?: string | null) {
  const phone = String(value || '').replace(/\D/g, '')
  if (phone.length === 13 && phone.startsWith('55')) {
    return `+55 ${phone.slice(2, 4)} ${phone.slice(4, 9)}-${phone.slice(9)}`
  }
  if (phone.length === 12 && phone.startsWith('55')) {
    return `+55 ${phone.slice(2, 4)} ${phone.slice(4, 8)}-${phone.slice(8)}`
  }
  return phone ? `+${phone}` : '-'
}

function isWindowActive(conversation?: MetaConversation | null) {
  if (!conversation?.customer_window_expires_at) return false
  const time = new Date(conversation.customer_window_expires_at).getTime()
  return Number.isFinite(time) && time > Date.now()
}

function messageTime(message: MetaMessage) {
  return message.received_at || message.sent_at || message.created_at
}

export default function MetaWhatsAppChatPage() {
  const [conversations, setConversations] = useState<MetaConversation[]>([])
  const [summary, setSummary] = useState<ChatPayload['summary']>({
    total: 0,
    unread: 0,
    open: 0,
    pending: 0,
    closed: 0,
    windowActive: 0,
  })
  const [selectedId, setSelectedId] = useState('')
  const [selected, setSelected] = useState<MetaConversation | null>(null)
  const [messages, setMessages] = useState<MetaMessage[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | ConversationStatus>('all')
  const [search, setSearch] = useState('')
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const selectedSender = useMemo(() => asSingle(selected?.sender), [selected])
  const selectedCampaign = useMemo(() => asSingle(selected?.campaign), [selected])
  const selectedLead = useMemo(() => asSingle(selected?.lead), [selected])
  const activeWindow = isWindowActive(selected)

  const loadConversations = async (keepSelection = true) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (search.trim()) params.set('search', search.trim())

      const response = await fetch(`/api/admin/whatsapp/meta-chat?${params.toString()}`, { cache: 'no-store' })
      const payload: ChatPayload = await response.json()
      if (!payload.success) throw new Error(payload.error || 'Erro ao carregar conversas.')

      const rows = payload.conversations || []
      setConversations(rows)
      setSummary(payload.summary)

      if (!keepSelection || !selectedId || !rows.some(row => row.id === selectedId)) {
        const nextId = rows[0]?.id || ''
        setSelectedId(nextId)
      }
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Erro ao carregar conversas.' })
    } finally {
      setLoading(false)
    }
  }

  const loadDetail = async (conversationId: string) => {
    if (!conversationId) {
      setSelected(null)
      setMessages([])
      return
    }

    setLoadingDetail(true)
    try {
      const params = new URLSearchParams({ conversation_id: conversationId })
      const response = await fetch(`/api/admin/whatsapp/meta-chat?${params.toString()}`, { cache: 'no-store' })
      const payload: ChatPayload = await response.json()
      if (!payload.success) throw new Error(payload.error || 'Erro ao carregar conversa.')
      setSelected(payload.conversation || null)
      setMessages(payload.messages || [])
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Erro ao carregar conversa.' })
    } finally {
      setLoadingDetail(false)
    }
  }

  useEffect(() => {
    loadConversations(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  useEffect(() => {
    const timeout = window.setTimeout(() => loadConversations(true), 350)
    return () => window.clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  useEffect(() => {
    loadDetail(selectedId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadConversations(true)
      if (selectedId) loadDetail(selectedId)
    }, 20000)
    return () => window.clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, statusFilter, search])

  const updateStatus = async (status: ConversationStatus) => {
    if (!selectedId) return
    setFeedback(null)
    try {
      const response = await fetch('/api/admin/whatsapp/meta-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', conversation_id: selectedId, status }),
      })
      const payload: ChatPayload = await response.json()
      if (!payload.success) throw new Error(payload.error || 'Erro ao atualizar status.')
      setFeedback({ type: 'success', text: 'Status atualizado.' })
      await Promise.all([loadConversations(true), loadDetail(selectedId)])
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Erro ao atualizar status.' })
    }
  }

  const markRead = async () => {
    if (!selectedId) return
    try {
      const response = await fetch('/api/admin/whatsapp/meta-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', conversation_id: selectedId }),
      })
      const payload: ChatPayload = await response.json()
      if (!payload.success) throw new Error(payload.error || 'Erro ao marcar como lida.')
      await Promise.all([loadConversations(true), loadDetail(selectedId)])
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Erro ao marcar como lida.' })
    }
  }

  const sendReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedId || sending) return
    setSending(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/admin/whatsapp/meta-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reply', conversation_id: selectedId, text: reply }),
      })
      const payload: ChatPayload = await response.json()
      if (!payload.success) throw new Error(payload.error || 'Erro ao enviar resposta.')
      setReply('')
      setFeedback({ type: 'success', text: 'Mensagem enviada pela Cloud API.' })
      await Promise.all([loadConversations(true), loadDetail(selectedId)])
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Erro ao enviar resposta.' })
    } finally {
      setSending(false)
    }
  }

  if (loading && conversations.length === 0) {
    return <AdminLoadingState message="Carregando Chat Meta WhatsApp..." />
  }

  return (
    <div className="meta-chat-page">
      <header className="meta-chat-header">
        <div>
          <h1>
            <MessageCircle size={28} />
            Chat Meta WhatsApp
          </h1>
          <p>Respostas recebidas nos numeros oficiais da Cloud API</p>
        </div>
        <button
          type="button"
          className="ghost-button"
          onClick={() => {
            loadConversations(true)
            if (selectedId) loadDetail(selectedId)
          }}
        >
          <RefreshCw size={16} />
          Atualizar
        </button>
      </header>

      {feedback && (
        <div className={`feedback ${feedback.type}`}>
          {feedback.text}
        </div>
      )}

      <section className="summary-grid">
        <div>
          <Inbox size={18} />
          <strong>{summary?.total || 0}</strong>
          <span>Conversas</span>
        </div>
        <div>
          <MessageSquareText size={18} />
          <strong>{summary?.unread || 0}</strong>
          <span>Nao lidas</span>
        </div>
        <div>
          <Clock3 size={18} />
          <strong>{summary?.windowActive || 0}</strong>
          <span>Janela ativa</span>
        </div>
        <div>
          <CheckCircle2 size={18} />
          <strong>{summary?.closed || 0}</strong>
          <span>Fechadas</span>
        </div>
      </section>

      <div className="toolbar">
        <div className="search-box">
          <Search size={16} />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Buscar por nome, telefone ou mensagem"
          />
        </div>
        <div className="status-tabs">
          {statusOptions.map(option => (
            <button
              key={option.value}
              type="button"
              className={statusFilter === option.value ? 'active' : ''}
              onClick={() => setStatusFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <main className="chat-shell">
        <aside className="conversation-list">
          {conversations.length === 0 ? (
            <div className="empty-list">
              <Inbox size={30} />
              <span>Nenhuma conversa Meta encontrada.</span>
            </div>
          ) : (
            conversations.map(conversation => {
              const sender = asSingle(conversation.sender)
              const active = conversation.id === selectedId
              return (
                <button
                  key={conversation.id}
                  type="button"
                  className={`conversation-row ${active ? 'active' : ''}`}
                  onClick={() => setSelectedId(conversation.id)}
                >
                  <span className="conversation-avatar">
                    <UserRound size={18} />
                  </span>
                  <span className="conversation-main">
                    <span className="conversation-name">
                      {conversation.contact_name || formatPhone(conversation.contact_phone)}
                      {conversation.unread_count > 0 && <strong>{conversation.unread_count}</strong>}
                    </span>
                    <span className="conversation-preview">{shortText(conversation.last_message_preview, 72)}</span>
                    <span className="conversation-meta">
                      {statusLabels[conversation.status] || conversation.status}
                      <small>{sender?.display_name || 'Numero oficial'}</small>
                    </span>
                  </span>
                  <span className="conversation-time">{formatDate(conversation.last_message_at)}</span>
                </button>
              )
            })
          )}
        </aside>

        <section className="message-panel">
          {!selected ? (
            <div className="empty-chat">
              {loadingDetail ? <Loader2 size={28} className="spin" /> : <MessageCircle size={36} />}
              <span>{loadingDetail ? 'Carregando conversa...' : 'Selecione uma conversa.'}</span>
            </div>
          ) : (
            <>
              <div className="message-header">
                <div>
                  <strong>{selected.contact_name || formatPhone(selected.contact_phone)}</strong>
                  <span>{formatPhone(selected.contact_phone)}</span>
                </div>
                <div className="message-actions">
                  <button type="button" onClick={markRead}>Marcar lida</button>
                  <button type="button" onClick={() => updateStatus('open')}>Aberta</button>
                  <button type="button" onClick={() => updateStatus('pending')}>Pendente</button>
                  <button type="button" onClick={() => updateStatus('closed')}>Fechada</button>
                </div>
              </div>

              <div className="window-strip">
                <span className={activeWindow ? 'window-active' : 'window-expired'} />
                {activeWindow
                  ? `Janela aberta ate ${formatDate(selected.customer_window_expires_at)}`
                  : 'Janela expirada: reabra com template aprovado.'}
              </div>

              <div className="messages">
                {messages.length === 0 ? (
                  <div className="empty-chat compact">
                    <MessageSquareText size={30} />
                    <span>Sem mensagens nesta conversa.</span>
                  </div>
                ) : (
                  messages.map(message => (
                    <div key={message.id} className={`message-bubble ${message.direction}`}>
                      <div className="message-text">{message.text_body || `[${message.message_type}]`}</div>
                      <div className="message-status">
                        <span>{formatDate(messageTime(message))}</span>
                        <span>{message.status}</span>
                        {message.error_message && <span className="message-error">{message.error_message}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form className="reply-box" onSubmit={sendReply}>
                <textarea
                  value={reply}
                  onChange={event => setReply(event.target.value)}
                  placeholder={activeWindow ? 'Digite a resposta para o lead' : 'Janela expirada'}
                  disabled={!activeWindow || sending}
                  rows={3}
                />
                <button type="submit" disabled={!activeWindow || sending || !reply.trim()}>
                  {sending ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
                  Enviar
                </button>
              </form>
            </>
          )}
        </section>

        <aside className="context-panel">
          <h2>Contexto</h2>
          <dl>
            <dt>Numero oficial</dt>
            <dd>{selectedSender?.display_name || '-'}</dd>
            <dt>Qualidade</dt>
            <dd>{selectedSender?.quality_rating || selectedSender?.meta_status || '-'}</dd>
            <dt>Ultima campanha</dt>
            <dd>{selectedCampaign?.name || '-'}</dd>
            <dt>Template</dt>
            <dd>{selectedCampaign?.template_name || '-'}</dd>
            <dt>Lead</dt>
            <dd>{selectedLead?.name || selected?.contact_name || '-'}</dd>
            <dt>Email</dt>
            <dd>{selectedLead?.email || '-'}</dd>
            <dt>Etapa</dt>
            <dd>{selectedLead?.funnel_stage || '-'}</dd>
            <dt>Perfil</dt>
            <dd>{selectedLead?.lead_classification || selectedLead?.lead_purpose || '-'}</dd>
          </dl>
        </aside>
      </main>

      <style jsx>{`
        .meta-chat-page {
          min-height: 100vh;
          padding: 32px;
          background: #fbfaf8;
          color: #111827;
        }

        .meta-chat-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 22px;
        }

        .meta-chat-header h1 {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 30px;
          letter-spacing: 0;
        }

        .meta-chat-header p {
          margin: 6px 0 0;
          color: #6b7280;
        }

        .ghost-button,
        .message-actions button,
        .status-tabs button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 38px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #fff;
          color: #111827;
          cursor: pointer;
          padding: 0 14px;
          font-weight: 700;
        }

        .feedback {
          border-radius: 8px;
          padding: 12px 14px;
          margin-bottom: 16px;
          font-weight: 700;
        }

        .feedback.success {
          background: #ecfdf5;
          border: 1px solid #bbf7d0;
          color: #047857;
        }

        .feedback.error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .summary-grid div {
          display: grid;
          grid-template-columns: 24px 1fr;
          gap: 2px 12px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #fff;
          padding: 16px;
        }

        .summary-grid svg {
          grid-row: span 2;
          color: #c0913d;
        }

        .summary-grid strong {
          font-size: 22px;
          line-height: 1;
        }

        .summary-grid span {
          color: #6b7280;
          font-size: 13px;
        }

        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 280px;
          flex: 1;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #fff;
          padding: 0 12px;
        }

        .search-box input {
          width: 100%;
          height: 40px;
          border: 0;
          outline: 0;
          background: transparent;
        }

        .status-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .status-tabs button.active {
          border-color: #c0913d;
          color: #9a6a1d;
          background: #fff7ed;
        }

        .chat-shell {
          display: grid;
          grid-template-columns: minmax(280px, 360px) minmax(420px, 1fr) minmax(240px, 300px);
          min-height: 660px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
          background: #fff;
        }

        .conversation-list,
        .context-panel {
          background: #f8fafc;
        }

        .conversation-list {
          border-right: 1px solid #e5e7eb;
          overflow: auto;
        }

        .conversation-row {
          width: 100%;
          display: grid;
          grid-template-columns: 38px 1fr auto;
          gap: 10px;
          border: 0;
          border-bottom: 1px solid #e5e7eb;
          background: transparent;
          padding: 14px;
          text-align: left;
          cursor: pointer;
        }

        .conversation-row.active {
          background: #fff7ed;
        }

        .conversation-avatar {
          width: 38px;
          height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #e8f7ef;
          color: #059669;
        }

        .conversation-main {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .conversation-name {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-weight: 800;
        }

        .conversation-name strong {
          min-width: 20px;
          height: 20px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: #22c55e;
          color: #fff;
          font-size: 12px;
        }

        .conversation-preview,
        .conversation-meta,
        .conversation-time {
          color: #6b7280;
          font-size: 12px;
        }

        .conversation-meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .conversation-meta small {
          color: #9ca3af;
        }

        .message-panel {
          display: grid;
          grid-template-rows: auto auto 1fr auto;
          min-width: 0;
          background: #f4efe7;
        }

        .message-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px;
          border-bottom: 1px solid #e5e7eb;
          background: #fff;
        }

        .message-header div:first-child {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .message-header span {
          color: #6b7280;
          font-size: 13px;
        }

        .message-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .message-actions button {
          min-height: 34px;
          font-size: 12px;
          padding: 0 10px;
        }

        .window-strip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 16px;
          border-bottom: 1px solid #e5e7eb;
          background: #fff;
          color: #6b7280;
          font-size: 13px;
        }

        .window-strip span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex: 0 0 auto;
        }

        .window-active {
          background: #22c55e;
        }

        .window-expired {
          background: #f97316;
        }

        .messages {
          overflow: auto;
          padding: 18px;
        }

        .message-bubble {
          width: fit-content;
          max-width: min(620px, 82%);
          margin-bottom: 12px;
          border-radius: 8px;
          padding: 10px 12px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
        }

        .message-bubble.inbound {
          background: #fff;
        }

        .message-bubble.outbound {
          margin-left: auto;
          background: #dcfce7;
        }

        .message-bubble.system {
          margin-inline: auto;
          background: #e5e7eb;
        }

        .message-text {
          white-space: pre-wrap;
          line-height: 1.45;
        }

        .message-status {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 6px;
          color: #6b7280;
          font-size: 11px;
        }

        .message-error {
          color: #dc2626;
        }

        .reply-box {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          padding: 14px;
          border-top: 1px solid #e5e7eb;
          background: #fff;
        }

        .reply-box textarea {
          resize: none;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 12px;
          font: inherit;
          outline: 0;
        }

        .reply-box button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-width: 112px;
          border: 0;
          border-radius: 8px;
          background: #c0913d;
          color: #fff;
          font-weight: 800;
          cursor: pointer;
          padding: 0 16px;
        }

        .reply-box button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .context-panel {
          border-left: 1px solid #e5e7eb;
          padding: 18px;
          overflow: auto;
        }

        .context-panel h2 {
          margin: 0 0 16px;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 20px;
          letter-spacing: 0;
        }

        .context-panel dl {
          margin: 0;
          display: grid;
          gap: 12px;
        }

        .context-panel dt {
          color: #6b7280;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .context-panel dd {
          margin: -8px 0 0;
          overflow-wrap: anywhere;
          font-weight: 700;
        }

        .empty-list,
        .empty-chat {
          min-height: 260px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: #9ca3af;
          text-align: center;
          padding: 24px;
        }

        .empty-chat.compact {
          min-height: 220px;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1180px) {
          .chat-shell {
            grid-template-columns: minmax(260px, 340px) 1fr;
          }

          .context-panel {
            display: none;
          }
        }

        @media (max-width: 820px) {
          .meta-chat-page {
            padding: 22px 14px;
          }

          .meta-chat-header,
          .toolbar,
          .message-header {
            align-items: stretch;
            flex-direction: column;
          }

          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .chat-shell {
            grid-template-columns: 1fr;
          }

          .conversation-list {
            max-height: 320px;
            border-right: 0;
            border-bottom: 1px solid #e5e7eb;
          }

          .reply-box {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
