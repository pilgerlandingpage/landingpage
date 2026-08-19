'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import Link from 'next/link'
import {
  Archive,
  Check,
  CheckCheck,
  ChevronDown,
  Clock3,
  CircleDot,
  Inbox,
  ListPlus,
  Loader2,
  Mic,
  MessageCircle,
  MessageSquareText,
  MoreVertical,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Smile,
  Settings,
  UsersRound,
  UserRound,
  Video,
  XCircle,
} from 'lucide-react'
import AdminLoadingState from '@/components/admin/AdminLoadingState'

type ConversationStatus = 'open' | 'pending' | 'closed' | 'archived'
type ReplyIntent = 'interested' | 'opt_out' | 'question' | 'unknown'

type SenderSummary = {
  id?: string | null
  display_name?: string | null
  phone_number?: string | null
  phone_number_id?: string | null
  waba_id?: string | null
  meta_status?: string | null
  local_status?: string | null
  quality_rating?: string | null
  conversation_count?: number | null
  unread_count?: number | null
  open_count?: number | null
  pending_count?: number | null
  closed_count?: number | null
  window_active_count?: number | null
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
  avatar_url?: string | null
  avatar_source?: string | null
  avatar_updated_at?: string | null
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

type MetaReplyIntent = {
  id: string
  intent: ReplyIntent
  confidence?: number | null
  source?: 'button' | 'keyword' | 'manual' | 'system' | null
  raw_text?: string | null
  campaign_name?: string | null
  template_name?: string | null
  notified_status?: 'skipped' | 'sent' | 'failed' | null
  notified_phone?: string | null
  notified_at?: string | null
  auto_reply_status?: 'skipped' | 'sent' | 'failed' | null
  created_at?: string | null
  updated_at?: string | null
}

type ChatPayload = {
  success: boolean
  conversations?: MetaConversation[]
  senders?: SenderSummary[]
  conversation?: MetaConversation
  messages?: MetaMessage[]
  replyIntent?: MetaReplyIntent | null
  result?: {
    intent?: ReplyIntent
    notifiedStatus?: 'skipped' | 'sent' | 'failed'
    notifiedPhone?: string | null
    intentId?: string | null
  }
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
  { value: 'all', label: 'Tudo' },
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

const triageLabels: Record<ReplyIntent, string> = {
  interested: 'Interessado',
  opt_out: 'Sair da lista',
  question: 'Duvida',
  unknown: 'Neutro',
}

const triageSourceLabels: Record<string, string> = {
  button: 'Botao',
  keyword: 'Texto',
  manual: 'Manual',
  system: 'Sistema',
}

const notifyStatusLabels: Record<string, string> = {
  sent: 'Aviso enviado',
  failed: 'Aviso falhou',
  skipped: 'Sem aviso',
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

function senderDisplayName(sender?: SenderSummary | null) {
  const phone = String(sender?.phone_number || '').replace(/\D/g, '')
  return sender?.display_name || (phone ? formatPhone(phone) : 'Numero oficial')
}

function isWindowActive(conversation?: MetaConversation | null) {
  if (!conversation?.customer_window_expires_at) return false
  const time = new Date(conversation.customer_window_expires_at).getTime()
  return Number.isFinite(time) && time > Date.now()
}

function messageTime(message: MetaMessage) {
  return message.received_at || message.sent_at || message.created_at
}

function conversationLead(conversation?: MetaConversation | null) {
  return asSingle(conversation?.lead)
}

function conversationName(conversation?: MetaConversation | null) {
  const lead = conversationLead(conversation)
  return lead?.name || conversation?.contact_name || formatPhone(conversation?.contact_phone)
}

function conversationAvatar(conversation?: MetaConversation | null) {
  return conversationLead(conversation)?.avatar_url || null
}

function initials(value?: string | null) {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'GP'
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('')
}

function cleanAvatarUrl(value?: string | null) {
  const url = String(value || '').trim()
  if (!url || url === 'null' || url === 'undefined') return null
  if (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('data:image/')) return url
  return null
}

function statusIcon(status: string) {
  const selected = String(status || '').toLowerCase()
  if (selected === 'read') return <CheckCheck size={15} className="read" />
  if (selected === 'delivered') return <CheckCheck size={15} />
  if (selected === 'sent') return <Check size={15} />
  if (selected === 'failed') return <XCircle size={15} className="failed" />
  return null
}

function LeadAvatar({ name, src, size = 'md' }: { name?: string | null; src?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const avatarUrl = cleanAvatarUrl(src)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showImage = Boolean(avatarUrl && avatarUrl !== failedUrl)

  return (
    <>
      <span className={`lead-avatar ${size}`}>
        {showImage ? (
          <img
            src={avatarUrl || ''}
            alt={`Foto de ${name || 'lead'}`}
            referrerPolicy="no-referrer"
            onError={() => setFailedUrl(avatarUrl)}
          />
        ) : (
          <span>{initials(name)}</span>
        )}
      </span>
      <style jsx>{`
        .lead-avatar {
          width: 49px;
          height: 49px;
          min-width: 49px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          overflow: hidden;
          background: #dfe5e7;
          color: #41525d;
          font-size: 15px;
          font-weight: 600;
          line-height: 1;
          text-transform: uppercase;
          flex: 0 0 auto;
        }

        .lead-avatar.sm {
          width: 36px;
          height: 36px;
          min-width: 36px;
          font-size: 13px;
        }

        .lead-avatar.lg {
          width: 92px;
          height: 92px;
          min-width: 92px;
          font-size: 26px;
        }

        .lead-avatar img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }
      `}</style>
    </>
  )
}

export default function MetaWhatsAppChatPage() {
  const [conversations, setConversations] = useState<MetaConversation[]>([])
  const [chatSenders, setChatSenders] = useState<SenderSummary[]>([])
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
  const [selectedReplyIntent, setSelectedReplyIntent] = useState<MetaReplyIntent | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | ConversationStatus>('all')
  const [senderFilter, setSenderFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [sending, setSending] = useState(false)
  const [triaging, setTriaging] = useState<ReplyIntent | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const adminContent = document.querySelector('.admin-content')
    adminContent?.classList.add('admin-content--whatsapp-chat')

    return () => {
      adminContent?.classList.remove('admin-content--whatsapp-chat')
    }
  }, [])

  const selectedSender = useMemo(() => asSingle(selected?.sender), [selected])
  const selectedCampaign = useMemo(() => asSingle(selected?.campaign), [selected])
  const selectedLead = useMemo(() => asSingle(selected?.lead), [selected])
  const totalSenderConversations = chatSenders.reduce((total, sender) => total + Number(sender.conversation_count || 0), 0)
  const activeWindow = isWindowActive(selected)

  const loadConversations = async (keepSelection = true) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (senderFilter !== 'all') params.set('sender_id', senderFilter)
      if (search.trim()) params.set('search', search.trim())

      const response = await fetch(`/api/admin/whatsapp/meta-chat?${params.toString()}`, { cache: 'no-store' })
      const payload: ChatPayload = await response.json()
      if (!payload.success) throw new Error(payload.error || 'Erro ao carregar conversas.')

      const rows = payload.conversations || []
      setConversations(rows)
      setChatSenders(payload.senders || [])
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
      setSelectedReplyIntent(null)
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
      setSelectedReplyIntent(payload.replyIntent || null)
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Erro ao carregar conversa.' })
    } finally {
      setLoadingDetail(false)
    }
  }

  useEffect(() => {
    loadConversations(false)
  }, [statusFilter, senderFilter])

  useEffect(() => {
    const timeout = window.setTimeout(() => loadConversations(true), 350)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    loadDetail(selectedId)
  }, [selectedId])

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadConversations(true)
      if (selectedId) loadDetail(selectedId)
    }, 20000)
    return () => window.clearInterval(interval)
  }, [selectedId, statusFilter, senderFilter, search])

  useEffect(() => {
    const messagesContainer = messagesEndRef.current?.parentElement
    if (!messagesContainer) return

    messagesContainer.scrollTop = messagesContainer.scrollHeight
  }, [messages, selectedId])

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

  const manualTriage = async (intent: ReplyIntent) => {
    if (!selectedId || triaging) return
    setTriaging(intent)
    setFeedback(null)
    try {
      const response = await fetch('/api/admin/whatsapp/meta-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'triage',
          conversation_id: selectedId,
          intent,
          note: `Marcado manualmente como ${triageLabels[intent]} no chat Meta WhatsApp.`,
        }),
      })
      const payload: ChatPayload = await response.json()
      if (!payload.success) throw new Error(payload.error || 'Erro ao registrar triagem.')

      let message = `${triageLabels[intent]} registrado.`
      if (intent === 'interested') {
        if (payload.result?.notifiedStatus === 'sent') message = 'Lead interessado registrado e aviso interno enviado.'
        if (payload.result?.notifiedStatus === 'failed') message = 'Lead interessado registrado, mas o aviso interno falhou.'
        if (payload.result?.notifiedStatus === 'skipped') message = 'Lead interessado registrado. Configure um numero interno para receber o aviso.'
      }
      if (intent === 'opt_out') message = 'Contato marcado para sair da lista e conversa fechada.'

      setFeedback({ type: payload.result?.notifiedStatus === 'failed' ? 'error' : 'success', text: message })
      await Promise.all([loadConversations(true), loadDetail(selectedId)])
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Erro ao registrar triagem.' })
    } finally {
      setTriaging(null)
    }
  }

  const sendReply = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    const text = reply.trim()
    if (!selectedId || sending || !text) return
    setSending(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/admin/whatsapp/meta-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reply', conversation_id: selectedId, text }),
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

  const handleReplyKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    if (activeWindow && reply.trim() && !sending) void sendReply()
  }

  if (loading && conversations.length === 0) {
    return <AdminLoadingState message="Carregando Chat Meta WhatsApp..." />
  }

  return (
    <div className="wa-page">
      <header className="wa-page-header">
        <div>
          <h1>
            <MessageCircle size={27} />
            Chat Meta WhatsApp
          </h1>
          <p>Caixa de entrada oficial para respostas das campanhas via WhatsApp Cloud API.</p>
        </div>
        <div className="wa-page-actions">
          <Link href="/admin/whatsapp/campaigns#central-respostas" className="meta-button meta-link">
            <Inbox size={16} />
            Central de respostas
          </Link>
          <button
            type="button"
            className="meta-button"
            onClick={() => {
              loadConversations(true)
              if (selectedId) loadDetail(selectedId)
            }}
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
        </div>
      </header>

      {feedback && (
        <div className={`feedback ${feedback.type}`}>
          {feedback.text}
        </div>
      )}

      <main className="wa-shell">
        <aside className="wa-rail" aria-label="Atalhos WhatsApp">
          <div className="wa-rail-top">
            <button type="button" className="rail-button active" aria-label="Conversas">
              <MessageCircle size={22} />
            </button>
            <button type="button" className="rail-button" aria-label="Chamadas">
              <Phone size={21} />
            </button>
            <button type="button" className="rail-button" aria-label="Atualizacoes">
              <CircleDot size={21} />
            </button>
            <button type="button" className="rail-button" aria-label="Comunidades">
              <UsersRound size={21} />
            </button>
            <button type="button" className="rail-button" aria-label="Arquivadas">
              <Archive size={21} />
            </button>
          </div>
          <div className="wa-rail-bottom">
            <button type="button" className="rail-button" aria-label="Configuracoes">
              <Settings size={21} />
            </button>
            <LeadAvatar name={selectedSender?.display_name || 'Conta oficial'} src={null} size="sm" />
          </div>
        </aside>

        <aside className="wa-sidebar">
          <div className="wa-sidebar-header">
            <div className="wa-account">
              <div>
                <strong>WhatsApp</strong>
                <span>{summary?.total || 0} conversa(s)</span>
              </div>
            </div>
            <div className="wa-sidebar-actions">
              <button type="button" className="icon-button" aria-label="Nova conversa">
                <MessageSquareText size={18} />
              </button>
              <button type="button" className="icon-button" onClick={() => loadConversations(true)} aria-label="Atualizar conversas">
                {loading ? <Loader2 size={17} className="spin" /> : <RefreshCw size={17} />}
              </button>
              <button type="button" className="icon-button" aria-label="Mais opcoes">
                <MoreVertical size={18} />
              </button>
            </div>
          </div>

          <div className="wa-search">
            <Search size={16} />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Pesquisar ou começar uma nova conversa"
            />
          </div>

          <div className="wa-tabs">
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

          <div className="wa-senders">
            <button
              type="button"
              className={senderFilter === 'all' ? 'active' : ''}
              onClick={() => setSenderFilter('all')}
              title="Mostrar conversas de todos os numeros oficiais ativos"
            >
              <span>Todos</span>
              <small>{totalSenderConversations || summary?.total || 0}</small>
            </button>
            {chatSenders.map(sender => (
              <button
                key={sender.id || sender.phone_number_id || sender.phone_number}
                type="button"
                className={senderFilter === sender.id ? 'active' : ''}
                onClick={() => setSenderFilter(sender.id || 'all')}
                title={`${senderDisplayName(sender)} | ${formatPhone(sender.phone_number)} | ${sender.quality_rating || sender.meta_status || '-'}`}
              >
                <span>{senderDisplayName(sender)}</span>
                <small>
                  {Number(sender.conversation_count || 0)}
                  {Number(sender.unread_count || 0) > 0 ? ` / ${sender.unread_count} nao lida(s)` : ''}
                </small>
              </button>
            ))}
          </div>

          <div className="wa-summary-row">
            <span><Inbox size={14} /> {summary?.open || 0} abertas</span>
            <span><MessageSquareText size={14} /> {summary?.unread || 0} nao lidas</span>
            <span><Clock3 size={14} /> {summary?.windowActive || 0} janelas</span>
          </div>

          <div className="wa-list">
            {conversations.length === 0 ? (
              <div className="empty-list">
                <Inbox size={30} />
                <span>Nenhuma conversa Meta encontrada.</span>
              </div>
            ) : (
              conversations.map(conversation => {
                const sender = asSingle(conversation.sender)
                const active = conversation.id === selectedId
                const name = conversationName(conversation)
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    className={`wa-row ${active ? 'active' : ''}`}
                    onClick={() => setSelectedId(conversation.id)}
                  >
                    <LeadAvatar name={name} src={conversationAvatar(conversation)} />
                    <span className="wa-row-main">
                      <span className="wa-row-top">
                        <strong>{name}</strong>
                        <time>{formatDate(conversation.last_message_at)}</time>
                      </span>
                      <span className="wa-row-preview">{shortText(conversation.last_message_preview, 88)}</span>
                      <span className="wa-row-meta">
                        {statusLabels[conversation.status] || conversation.status}
                        <small>{senderDisplayName(sender)}</small>
                      </span>
                    </span>
                    {conversation.unread_count > 0 && <span className="unread-badge">{conversation.unread_count}</span>}
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <section className="wa-conversation">
          {!selected ? (
            <div className="empty-chat">
              {loadingDetail ? <Loader2 size={28} className="spin" /> : <MessageCircle size={38} />}
              <strong>{loadingDetail ? 'Carregando conversa...' : 'Selecione uma conversa'}</strong>
              <span>As respostas dos leads aparecerao aqui assim que chegarem pelo webhook da Meta.</span>
            </div>
          ) : (
            <>
              <div className="wa-chat-header">
                <LeadAvatar name={conversationName(selected)} src={conversationAvatar(selected)} />
                <div className="wa-chat-title">
                  <strong>{conversationName(selected)}</strong>
                  <span>{formatPhone(selected.contact_phone)} | {senderDisplayName(selectedSender)}</span>
                </div>
                <div className="wa-chat-actions">
                  <button type="button" className="add-list-button" aria-label="Adicionar a lista">
                    <ListPlus size={17} />
                    <span>Adicionar à lista</span>
                    <ChevronDown size={14} />
                  </button>
                  <button type="button" className="icon-button" aria-label="Video">
                    <Video size={17} />
                  </button>
                  <button type="button" className="icon-button" aria-label="Chamada">
                    <Phone size={17} />
                  </button>
                  <button type="button" className="icon-button" aria-label="Pesquisar na conversa">
                    <Search size={17} />
                  </button>
                  <button type="button" className="icon-button" aria-label="Mais opcoes">
                    <MoreVertical size={17} />
                  </button>
                </div>
              </div>

              <div className={`wa-window ${activeWindow ? 'active' : 'expired'}`}>
                <span />
                {activeWindow
                  ? `Janela de atendimento aberta ate ${formatDate(selected.customer_window_expires_at)}`
                  : 'Janela expirada. Para falar novamente, use um template aprovado.'}
              </div>

              <div className="wa-status-strip">
                <button type="button" onClick={markRead}>Marcar lida</button>
                <button type="button" className={selected.status === 'open' ? 'active' : ''} onClick={() => updateStatus('open')}>Aberta</button>
                <button type="button" className={selected.status === 'pending' ? 'active' : ''} onClick={() => updateStatus('pending')}>Pendente</button>
                <button type="button" className={selected.status === 'closed' ? 'active' : ''} onClick={() => updateStatus('closed')}>Fechada</button>
                <span className="wa-strip-divider" />
                <button
                  type="button"
                  className="triage interested"
                  onClick={() => manualTriage('interested')}
                  disabled={Boolean(triaging)}
                >
                  {triaging === 'interested' ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                  Interessado
                </button>
                <button
                  type="button"
                  className="triage optout"
                  onClick={() => manualTriage('opt_out')}
                  disabled={Boolean(triaging)}
                >
                  {triaging === 'opt_out' ? <Loader2 size={14} className="spin" /> : <XCircle size={14} />}
                  Sair
                </button>
                <button
                  type="button"
                  className="triage question"
                  onClick={() => manualTriage('question')}
                  disabled={Boolean(triaging)}
                >
                  {triaging === 'question' ? <Loader2 size={14} className="spin" /> : <MessageSquareText size={14} />}
                  Duvida
                </button>
                <button
                  type="button"
                  className="triage unknown"
                  onClick={() => manualTriage('unknown')}
                  disabled={Boolean(triaging)}
                >
                  {triaging === 'unknown' ? <Loader2 size={14} className="spin" /> : <CircleDot size={14} />}
                  Neutro
                </button>
              </div>

              <div className="wa-messages">
                {messages.length === 0 ? (
                  <div className="empty-chat compact">
                    <MessageSquareText size={30} />
                    <strong>Sem mensagens nesta conversa.</strong>
                  </div>
                ) : (
                  messages.map(message => (
                    <div key={message.id} className={`wa-bubble ${message.direction}`}>
                      <div className="wa-bubble-text">{message.text_body || `[${message.message_type}]`}</div>
                      <div className="wa-bubble-meta">
                        <time>{formatDate(messageTime(message))}</time>
                        {message.direction === 'outbound' && statusIcon(message.status)}
                        {message.error_message && <span className="message-error">{message.error_message}</span>}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="wa-composer" onSubmit={sendReply}>
                <button type="button" className="icon-button" aria-label="Adicionar">
                  <Plus size={22} />
                </button>
                <button type="button" className="icon-button" aria-label="Emoji">
                  <Smile size={20} />
                </button>
                <textarea
                  value={reply}
                  onChange={event => setReply(event.target.value)}
                  onKeyDown={handleReplyKeyDown}
                  placeholder={activeWindow ? 'Digite uma mensagem' : 'Janela expirada'}
                  disabled={!activeWindow || sending}
                  rows={1}
                />
                <button className="send-button" type="submit" disabled={!activeWindow || sending || !reply.trim()} aria-label="Enviar mensagem">
                  {sending ? <Loader2 size={20} className="spin" /> : reply.trim() ? <Send size={20} /> : <Mic size={20} />}
                </button>
              </form>
            </>
          )}
        </section>

        <aside className="wa-info">
          {selected ? (
            <>
              <div className="wa-profile">
                <LeadAvatar name={conversationName(selected)} src={conversationAvatar(selected)} size="lg" />
                <strong>{conversationName(selected)}</strong>
                <span>{formatPhone(selected.contact_phone)}</span>
              </div>
              <div className="info-card">
                <h2>Dados do lead</h2>
                <dl>
                  <dt>Email</dt>
                  <dd>{selectedLead?.email || '-'}</dd>
                  <dt>Etapa</dt>
                  <dd>{selectedLead?.funnel_stage || '-'}</dd>
                  <dt>Perfil</dt>
                  <dd>{selectedLead?.lead_classification || selectedLead?.lead_purpose || '-'}</dd>
                  <dt>Orcamento</dt>
                  <dd>{selectedLead?.lead_budget || '-'}</dd>
                </dl>
              </div>
              <div className="info-card triage-card">
                <h2>Triagem</h2>
                {selectedReplyIntent ? (
                  <>
                    <span className={`triage-pill ${selectedReplyIntent.intent}`}>
                      {triageLabels[selectedReplyIntent.intent] || 'Neutro'}
                    </span>
                    <dl>
                      <dt>Confianca</dt>
                      <dd>{selectedReplyIntent.confidence != null ? `${Math.round(Number(selectedReplyIntent.confidence))}%` : '-'}</dd>
                      <dt>Origem</dt>
                      <dd>{triageSourceLabels[selectedReplyIntent.source || ''] || '-'}</dd>
                      <dt>Resposta</dt>
                      <dd>{shortText(selectedReplyIntent.raw_text, 80)}</dd>
                      <dt>Aviso interno</dt>
                      <dd>{notifyStatusLabels[selectedReplyIntent.notified_status || ''] || '-'}</dd>
                      <dt>Registrada em</dt>
                      <dd>{formatDate(selectedReplyIntent.created_at)}</dd>
                    </dl>
                  </>
                ) : (
                  <p className="muted">Nenhuma triagem registrada nesta conversa.</p>
                )}
              </div>
              <div className="info-card">
                <h2>Origem</h2>
                <dl>
                  <dt>Ultima campanha</dt>
                  <dd>{selectedCampaign?.name || '-'}</dd>
                  <dt>Template</dt>
                  <dd>{selectedCampaign?.template_name || '-'}</dd>
                  <dt>Numero oficial</dt>
                  <dd>{senderDisplayName(selectedSender)}</dd>
                  <dt>Qualidade</dt>
                  <dd>{selectedSender?.quality_rating || selectedSender?.meta_status || '-'}</dd>
                </dl>
              </div>
            </>
          ) : (
            <div className="empty-info">
              <UserRound size={30} />
              <span>Selecione uma conversa para ver o lead.</span>
            </div>
          )}
        </aside>
      </main>

      <style jsx>{`
        .wa-page {
          min-height: 100vh;
          padding: 26px;
          background: #f5f6f6;
          color: #111827;
        }

        .wa-page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }

        .wa-page-header h1 {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 27px;
          letter-spacing: 0;
        }

        .wa-page-header h1 svg {
          color: #0b8f61;
        }

        .wa-page-header p {
          margin: 5px 0 0;
          color: #667085;
          font-size: 14px;
        }

        .wa-page-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .meta-button,
        .icon-button,
        .wa-tabs button,
        .wa-status-strip button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 36px;
          border: 1px solid #d7dde3;
          border-radius: 8px;
          background: #fff;
          color: #1f2937;
          cursor: pointer;
          font-weight: 700;
        }

        .meta-button {
          padding: 0 13px;
        }

        .meta-link {
          text-decoration: none;
        }

        .icon-button {
          width: 36px;
          padding: 0;
          color: #54656f;
        }

        .feedback {
          border-radius: 8px;
          padding: 11px 13px;
          margin-bottom: 14px;
          font-size: 14px;
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

        .wa-shell {
          display: grid;
          grid-template-columns: minmax(310px, 380px) minmax(470px, 1fr) minmax(260px, 320px);
          height: calc(100vh - 116px);
          min-height: 690px;
          border: 1px solid #d7dde3;
          border-radius: 8px;
          overflow: hidden;
          background: #fff;
          box-shadow: 0 8px 24px rgba(16, 24, 40, 0.06);
        }

        .wa-sidebar {
          display: grid;
          grid-template-rows: auto auto auto auto auto 1fr;
          min-width: 0;
          background: #fff;
          border-right: 1px solid #d7dde3;
        }

        .wa-sidebar-header,
        .wa-chat-header {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 64px;
          padding: 10px 14px;
          background: #f0f2f5;
        }

        .wa-sidebar-header {
          justify-content: space-between;
        }

        .wa-account {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .wa-account-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #d9fdd3;
          color: #0b8f61;
        }

        .wa-account div,
        .wa-chat-title {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .wa-account strong,
        .wa-chat-title strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .wa-account span,
        .wa-chat-title span {
          color: #667085;
          font-size: 12px;
        }

        .wa-search {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 10px 12px;
          min-height: 40px;
          padding: 0 12px;
          border-radius: 8px;
          background: #f0f2f5;
          color: #667085;
        }

        .wa-search input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: #111827;
          font: inherit;
          font-size: 14px;
        }

        .wa-tabs {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 12px 10px;
          color: #667085;
          overflow-x: auto;
        }

        .wa-tabs button {
          flex: 0 0 auto;
          min-height: 30px;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 12px;
        }

        .wa-tabs button.active {
          border-color: #00a884;
          background: #d9fdd3;
          color: #0b8f61;
        }

        .wa-senders {
          display: flex;
          gap: 6px;
          padding: 0 12px 10px;
          overflow-x: auto;
        }

        .wa-senders button {
          flex: 0 0 auto;
          min-width: 116px;
          max-width: 166px;
          min-height: 42px;
          display: grid;
          gap: 2px;
          justify-items: start;
          border: 1px solid #d7dde3;
          border-radius: 8px;
          background: #fff;
          color: #1f2937;
          padding: 6px 9px;
          cursor: pointer;
          text-align: left;
        }

        .wa-senders button.active {
          border-color: #00a884;
          background: #d9fdd3;
          color: #0b8f61;
        }

        .wa-senders button span,
        .wa-senders button small {
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .wa-senders button span {
          font-size: 12px;
          font-weight: 800;
        }

        .wa-senders button small {
          color: #667085;
          font-size: 11px;
        }

        .wa-summary-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
          padding: 0 12px 10px;
          color: #667085;
          font-size: 12px;
        }

        .wa-summary-row span {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-width: 0;
          padding: 7px 8px;
          border: 1px solid #e4e7ec;
          border-radius: 8px;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .wa-list {
          overflow: auto;
          border-top: 1px solid #edf0f2;
        }

        .wa-row {
          position: relative;
          width: 100%;
          display: grid;
          grid-template-columns: 48px 1fr auto;
          gap: 10px;
          align-items: center;
          min-height: 74px;
          border: 0;
          border-bottom: 1px solid #edf0f2;
          background: #fff;
          padding: 10px 12px;
          text-align: left;
          cursor: pointer;
        }

        .wa-row:hover,
        .wa-row.active {
          background: #f0f2f5;
        }

        .wa-row-main {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .wa-row-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .wa-row-top strong {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 15px;
        }

        .wa-row-top time,
        .wa-row-preview,
        .wa-row-meta {
          color: #667085;
          font-size: 12px;
        }

        .wa-row-preview {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .wa-row-meta {
          display: flex;
          gap: 8px;
          overflow: hidden;
          white-space: nowrap;
        }

        .wa-row-meta small {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          color: #98a2b3;
        }

        .unread-badge {
          align-self: end;
          justify-self: end;
          min-width: 20px;
          height: 20px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: #25d366;
          color: #fff;
          font-size: 12px;
          font-weight: 800;
        }

        .lead-avatar {
          width: 44px;
          height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          overflow: hidden;
          background: #dfe5e7;
          color: #41525d;
          font-weight: 800;
          flex: 0 0 auto;
        }

        .lead-avatar.sm {
          width: 34px;
          height: 34px;
        }

        .lead-avatar.lg {
          width: 92px;
          height: 92px;
          font-size: 26px;
        }

        .lead-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .wa-conversation {
          display: grid;
          grid-template-rows: auto auto auto 1fr auto;
          min-width: 0;
          background: #efeae2;
        }

        .wa-chat-header {
          border-bottom: 1px solid #d7dde3;
        }

        .wa-chat-title {
          flex: 1;
        }

        .wa-chat-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .wa-window {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-bottom: 1px solid #e4e7ec;
          background: #fff;
          color: #667085;
          font-size: 12px;
        }

        .wa-window span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #25d366;
        }

        .wa-window.expired span {
          background: #f97316;
        }

        .wa-status-strip {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 8px 14px;
          background: rgba(255, 255, 255, 0.76);
          border-bottom: 1px solid #e4e7ec;
          overflow-x: auto;
        }

        .wa-status-strip button {
          min-height: 30px;
          padding: 0 10px;
          font-size: 12px;
          white-space: nowrap;
        }

        .wa-status-strip button.active {
          border-color: #00a884;
          color: #0b8f61;
          background: #d9fdd3;
        }

        .wa-status-strip button:disabled {
          cursor: wait;
          opacity: 0.7;
        }

        .wa-strip-divider {
          width: 1px;
          height: 24px;
          background: #d7dde3;
          flex: 0 0 auto;
        }

        .wa-status-strip button.triage {
          border-radius: 999px;
        }

        .wa-status-strip button.triage.interested {
          border-color: #bbf7d0;
          background: #ecfdf5;
          color: #047857;
        }

        .wa-status-strip button.triage.optout {
          border-color: #fecaca;
          background: #fef2f2;
          color: #b91c1c;
        }

        .wa-status-strip button.triage.question {
          border-color: #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
        }

        .wa-status-strip button.triage.unknown {
          border-color: #d7dde3;
          background: #f8fafc;
          color: #475467;
        }

        .wa-messages {
          overflow: auto;
          padding: 22px 44px;
          background-color: #efeae2;
          background-image: url("https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/8c98994518b575bfd8c949e91d20548b.jpg");
          background-size: 420px auto;
          background-position: top left;
          background-repeat: repeat;
        }

        .wa-bubble {
          position: relative;
          width: fit-content;
          max-width: min(680px, 82%);
          margin-bottom: 10px;
          border-radius: 8px;
          padding: 8px 10px 6px;
          box-shadow: 0 1px 1px rgba(16, 24, 40, 0.12);
        }

        .wa-bubble.inbound {
          background: #fff;
          border-top-left-radius: 2px;
        }

        .wa-bubble.outbound {
          margin-left: auto;
          background: #d9fdd3;
          border-top-right-radius: 2px;
        }

        .wa-bubble.system {
          margin-inline: auto;
          background: #e6f2f2;
          color: #54656f;
        }

        .wa-bubble-text {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          line-height: 1.45;
          font-size: 14px;
        }

        .wa-bubble-meta {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 4px;
          margin-top: 3px;
          color: #667085;
          font-size: 11px;
        }

        .wa-bubble-meta svg {
          color: #667085;
        }

        .wa-bubble-meta svg.read {
          color: #53bdeb;
        }

        .wa-bubble-meta svg.failed,
        .message-error {
          color: #dc2626;
        }

        .message-error {
          max-width: 280px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .wa-composer {
          display: grid;
          grid-template-columns: auto auto minmax(0, 1fr) auto;
          align-items: end;
          gap: 8px;
          padding: 10px 12px;
          border-top: 1px solid #d7dde3;
          background: #f0f2f5;
        }

        .wa-composer textarea {
          min-height: 42px;
          max-height: 128px;
          resize: none;
          border: 0;
          border-radius: 8px;
          background: #fff;
          padding: 12px 14px;
          color: #111827;
          font: inherit;
          line-height: 1.4;
          outline: 0;
        }

        .send-button {
          width: 42px;
          height: 42px;
          border: 0;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #00a884;
          color: #fff;
          cursor: pointer;
        }

        .send-button:disabled,
        .wa-composer textarea:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .wa-info {
          min-width: 0;
          overflow: auto;
          background: #f0f2f5;
          border-left: 1px solid #d7dde3;
          padding: 16px;
        }

        .wa-profile {
          display: grid;
          justify-items: center;
          gap: 8px;
          padding: 18px 10px;
          margin-bottom: 12px;
          border-radius: 8px;
          background: #fff;
          text-align: center;
        }

        .wa-profile strong {
          font-size: 18px;
        }

        .wa-profile span {
          color: #667085;
          font-size: 13px;
        }

        .info-card {
          padding: 14px;
          margin-bottom: 12px;
          border-radius: 8px;
          background: #fff;
          border: 1px solid #e4e7ec;
        }

        .info-card h2 {
          margin: 0 0 12px;
          font-size: 15px;
        }

        .info-card dl {
          display: grid;
          gap: 10px;
          margin: 0;
        }

        .info-card dt {
          color: #667085;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .info-card dd {
          margin: -7px 0 0;
          overflow-wrap: anywhere;
          color: #111827;
          font-size: 13px;
          font-weight: 700;
        }

        .triage-card {
          display: grid;
          gap: 12px;
        }

        .triage-pill {
          width: fit-content;
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
        }

        .triage-pill.interested {
          background: #dcfce7;
          color: #047857;
        }

        .triage-pill.opt_out {
          background: #fee2e2;
          color: #b91c1c;
        }

        .triage-pill.question {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .triage-pill.unknown {
          background: #f1f5f9;
          color: #475467;
        }

        .muted {
          margin: 0;
          color: #667085;
          font-size: 13px;
          line-height: 1.45;
        }

        .empty-list,
        .empty-chat,
        .empty-info {
          min-height: 240px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 9px;
          color: #667085;
          text-align: center;
          padding: 24px;
        }

        .empty-chat {
          min-height: 100%;
        }

        .empty-chat.compact {
          min-height: 220px;
        }

        .empty-chat span,
        .empty-info span {
          max-width: 360px;
          color: #667085;
          font-size: 13px;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1280px) {
          .wa-shell {
            grid-template-columns: minmax(300px, 360px) minmax(420px, 1fr);
          }

          .wa-info {
            display: none;
          }
        }

        @media (max-width: 860px) {
          .wa-page {
            padding: 18px 10px;
          }

          .wa-page-header {
            align-items: stretch;
            flex-direction: column;
          }

          .wa-shell {
            grid-template-columns: 1fr;
            height: auto;
            min-height: 720px;
          }

          .wa-sidebar {
            max-height: 360px;
            border-right: 0;
            border-bottom: 1px solid #d7dde3;
          }

          .wa-messages {
            min-height: 430px;
            padding: 16px;
          }

          .wa-chat-actions {
            display: none;
          }
        }

        @media (max-width: 560px) {
          .wa-summary-row {
            grid-template-columns: 1fr;
          }

          .wa-status-strip {
            padding-inline: 10px;
          }

          .wa-composer {
            grid-template-columns: auto minmax(0, 1fr) auto;
          }

          .wa-composer .icon-button:first-child {
            display: none;
          }
        }

        /* WhatsApp Web style shell */
        :global(.admin-content.admin-content--whatsapp-chat) {
          flex: 0 0 auto;
          width: calc(100vw - var(--admin-sidebar-expanded-width));
          max-width: calc(100vw - var(--admin-sidebar-expanded-width));
          height: 100vh;
          min-height: 100vh;
          padding: 0;
          overflow: hidden;
        }

        :global(.admin-sidebar.is-auto-collapsed + .admin-content.admin-content--whatsapp-chat) {
          margin-left: var(--admin-sidebar-collapsed-width);
          width: calc(100vw - var(--admin-sidebar-collapsed-width));
          max-width: calc(100vw - var(--admin-sidebar-collapsed-width));
        }

        :global(.admin-sidebar.is-auto-collapsed:not(.is-rail-locked):hover + .admin-content.admin-content--whatsapp-chat),
        :global(.admin-sidebar.is-auto-collapsed:not(.is-rail-locked):focus-within + .admin-content.admin-content--whatsapp-chat) {
          margin-left: var(--admin-sidebar-expanded-width);
          width: calc(100vw - var(--admin-sidebar-expanded-width));
          max-width: calc(100vw - var(--admin-sidebar-expanded-width));
        }

        .wa-page {
          position: relative;
          width: 100%;
          max-width: 100%;
          height: 100vh;
          min-height: 0;
          padding: 0;
          background: #f0f2f5;
          overflow: hidden;
        }

        .wa-page-header {
          display: none;
        }

        .feedback {
          position: absolute;
          top: 12px;
          left: 50%;
          z-index: 5;
          width: min(720px, calc(100% - 40px));
          margin: 0;
          transform: translateX(-50%);
          box-shadow: 0 8px 24px rgba(17, 24, 39, 0.12);
        }

        .wa-shell {
          grid-template-columns: 64px minmax(390px, 470px) minmax(0, 1fr);
          width: 100%;
          max-width: 100%;
          height: 100%;
          min-height: 0;
          overflow: hidden;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          background: #f0f2f5;
        }

        .wa-rail {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
          min-width: 0;
          padding: 10px 0;
          background: #f0f2f5;
          border-right: 1px solid #d1d7db;
        }

        .wa-rail-top,
        .wa-rail-bottom {
          display: grid;
          justify-items: center;
          gap: 10px;
        }

        .rail-button {
          position: relative;
          width: 42px;
          height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: #54656f;
          cursor: pointer;
        }

        .rail-button:hover,
        .rail-button.active {
          background: #d9dbdf;
          color: #111b21;
        }

        .rail-button.active::before {
          content: '';
          position: absolute;
          left: -11px;
          width: 4px;
          height: 22px;
          border-radius: 999px;
          background: #00a884;
        }

        .wa-sidebar {
          grid-template-rows: auto auto auto auto auto 1fr;
          min-height: 0;
          overflow: hidden;
          border-right-color: #d1d7db;
          background: #fff;
        }

        .wa-sidebar-header {
          min-height: 74px;
          padding: 16px;
          background: #fff;
          border-bottom: 1px solid #edf0f2;
        }

        .wa-account strong {
          color: #111b21;
          font-size: 22px;
          font-weight: 800;
        }

        .wa-sidebar-actions,
        .wa-chat-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .wa-sidebar-actions .icon-button,
        .wa-chat-actions .icon-button,
        .wa-composer .icon-button {
          border: 0;
          border-radius: 50%;
          background: transparent;
        }

        .wa-search {
          min-height: 44px;
          margin: 10px 16px;
          border-radius: 22px;
          background: #f0f2f5;
        }

        .wa-search input {
          font-size: 15px;
        }

        .wa-tabs {
          padding: 0 16px 12px;
          gap: 8px;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .wa-tabs::-webkit-scrollbar {
          display: none;
        }

        .wa-tabs button {
          min-height: 34px;
          padding: 0 14px;
          border-color: #d1d7db;
          border-radius: 18px;
          color: #54656f;
          background: #fff;
          font-size: 14px;
          font-weight: 700;
        }

        .wa-tabs button.active {
          border-color: #d9fdd3;
          background: #d9fdd3;
          color: #008069;
        }

        .wa-summary-row {
          display: none;
        }

        .wa-list {
          min-height: 0;
          overflow-y: auto;
          border-top: 0;
          background: #fff;
          overscroll-behavior: contain;
        }

        .wa-row {
          grid-template-columns: 56px minmax(0, 1fr) auto;
          gap: 10px;
          min-height: 72px;
          padding: 10px 16px;
          border-bottom-color: #edf0f2;
        }

        .wa-row:hover,
        .wa-row.active {
          background: #f0f2f5;
        }

        .wa-row-top strong {
          color: #111b21;
          font-size: 16px;
          font-weight: 500;
        }

        .wa-row-preview,
        .wa-row-meta,
        .wa-row-top time {
          color: #667781;
          font-size: 13px;
        }

        .wa-row-meta {
          gap: 7px;
        }

        .unread-badge {
          width: 20px;
          height: 20px;
          background: #25d366;
          font-size: 12px;
        }

        .lead-avatar {
          width: 49px;
          height: 49px;
          background: #dfe5e7;
          color: #41525d;
          font-size: 15px;
        }

        .lead-avatar.sm {
          width: 36px;
          height: 36px;
          font-size: 13px;
        }

        .lead-avatar.lg {
          width: 92px;
          height: 92px;
        }

        .wa-conversation {
          grid-template-rows: auto 1fr auto;
          min-height: 0;
          overflow: hidden;
          background: #efeae2;
        }

        .wa-chat-header {
          min-height: 64px;
          padding: 8px 16px;
          background: #fff;
          border-bottom: 1px solid #d1d7db;
        }

        .wa-chat-title strong {
          color: #111b21;
          font-size: 16px;
          font-weight: 500;
        }

        .wa-chat-title span {
          color: #667781;
          font-size: 13px;
        }

        .add-list-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 40px;
          padding: 0 15px;
          border: 1px solid #d1d7db;
          border-radius: 22px;
          background: #fff;
          color: #111b21;
          cursor: pointer;
          font-weight: 700;
        }

        .wa-window,
        .wa-status-strip,
        .wa-info {
          display: none;
        }

        .wa-messages {
          min-height: 0;
          overflow-y: auto;
          overscroll-behavior: contain;
          padding: 22px 64px 18px;
          background-color: #efeae2;
          background-image: url("https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/8c98994518b575bfd8c949e91d20548b.jpg");
          background-size: 420px auto;
          background-position: top left;
          background-repeat: repeat;
        }

        .wa-bubble {
          max-width: min(620px, 62%);
          margin-bottom: 8px;
          border-radius: 7.5px;
          padding: 6px 8px 5px;
          color: #111b21;
          box-shadow: 0 1px 0.5px rgba(11, 20, 26, 0.13);
        }

        .wa-bubble.inbound::before,
        .wa-bubble.outbound::before {
          content: '';
          position: absolute;
          top: 0;
          width: 0;
          height: 0;
          border-style: solid;
        }

        .wa-bubble.inbound {
          background: #fff;
          border-top-left-radius: 0;
        }

        .wa-bubble.inbound::before {
          left: -8px;
          border-width: 0 8px 8px 0;
          border-color: transparent #fff transparent transparent;
        }

        .wa-bubble.outbound {
          background: #d9fdd3;
          border-top-right-radius: 0;
        }

        .wa-bubble.outbound::before {
          right: -8px;
          border-width: 0 0 8px 8px;
          border-color: transparent transparent transparent #d9fdd3;
        }

        .wa-bubble-text {
          font-size: 14.2px;
          line-height: 1.38;
        }

        .wa-bubble-meta {
          color: #667781;
          font-size: 11px;
          line-height: 1;
        }

        .wa-composer {
          grid-template-columns: auto auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 8px;
          min-height: 64px;
          padding: 9px 14px;
          background: #f0f2f5;
          border-top: 1px solid #d1d7db;
        }

        .wa-composer textarea {
          min-height: 46px;
          max-height: 120px;
          border-radius: 24px;
          padding: 12px 17px;
          font-size: 15px;
        }

        .send-button {
          width: 46px;
          height: 46px;
          background: transparent;
          color: #54656f;
        }

        .send-button:not(:disabled) {
          background: #00a884;
          color: #fff;
        }

        .empty-chat {
          color: #667781;
          background: #f0f2f5;
        }

        @media (max-width: 1280px) {
          .wa-shell {
            grid-template-columns: 64px minmax(350px, 420px) minmax(0, 1fr);
          }
        }

        @media (max-width: 980px) {
          .add-list-button span {
            display: none;
          }
        }

        @media (max-width: 860px) {
          :global(.admin-content.admin-content--whatsapp-chat) {
            width: 100vw;
            max-width: 100vw;
            height: auto;
            min-height: 100vh;
            margin-left: 0;
            padding: 0;
            overflow: auto;
          }

          .wa-page {
            height: auto;
            min-height: 100vh;
          }

          .wa-shell {
            grid-template-columns: 56px minmax(0, 1fr);
            height: auto;
            min-height: 760px;
          }

          .wa-rail {
            grid-row: 1;
            min-height: 360px;
          }

          .wa-sidebar {
            grid-column: 2;
            max-height: 360px;
            border-bottom: 1px solid #d1d7db;
          }

          .wa-conversation {
            grid-column: 1 / -1;
          }

          .wa-chat-actions {
            display: flex;
          }

          .add-list-button {
            display: none;
          }
        }

        @media (max-width: 560px) {
          .wa-chat-actions .icon-button:nth-child(4) {
            display: none;
          }

          .wa-messages {
            padding: 16px 10px;
          }

          .wa-bubble {
            max-width: 86%;
          }

          .wa-composer {
            grid-template-columns: auto minmax(0, 1fr) auto;
          }

          .wa-composer .icon-button:nth-child(2) {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
