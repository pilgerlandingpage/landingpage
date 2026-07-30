'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  Film,
  Instagram,
  MousePointerClick,
  Plus,
  Play,
  MessageSquareText,
  RefreshCw,
  Share2,
  ShoppingCart,
  Sparkles,
  Target,
  Trash2,
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
  media_external_id: string | null
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

type CommentDmCampaign = {
  id: string
  name: string
  platform: 'instagram' | 'facebook'
  media_external_id: string | null
  post_permalink: string | null
  trigger_intent: string
  trigger_examples: string[] | null
  reply_message: string
  confidence_threshold: number
  mode: 'manual' | 'auto'
  status: 'draft' | 'active' | 'paused' | 'archived'
  max_replies_per_hour: number
  raw?: Record<string, unknown> | null
  updated_at: string
}

type CommentDmDelivery = {
  id: string
  campaign_id: string
  platform: 'instagram' | 'facebook'
  comment_external_id: string
  media_external_id: string | null
  author_name: string | null
  comment_text: string | null
  ai_matches: boolean
  ai_confidence: number
  ai_reason: string | null
  reply_message: string | null
  decision: 'matched' | 'not_matched' | 'needs_review' | 'skipped' | 'error'
  send_status: 'pending_approval' | 'sent' | 'skipped' | 'error'
  private_reply_channel: string | null
  error: string | null
  processed_at: string | null
  sent_at: string | null
  raw?: Record<string, unknown> | null
  updated_at: string
}

type CommentDmPayload = {
  success: boolean
  campaigns: CommentDmCampaign[]
  deliveries: CommentDmDelivery[]
  total_deliveries?: number
  error?: string
}

type CommentDmStatusFilter = 'all' | 'sent' | 'pending_approval' | 'error' | 'skipped' | 'matched'
type MetaSuiteTab = 'all' | 'messenger' | 'instagram' | 'facebook_comments' | 'instagram_comments' | 'automation' | 'ai'
type MetaSuiteFilter = 'all' | 'comments' | 'priority' | 'sent'

type CommentDmMedia = {
  id: string
  platform: 'instagram' | 'facebook'
  external_id: string
  media_type: string | null
  media_product_type: string | null
  caption: string | null
  permalink: string | null
  thumbnail_url: string | null
  media_url: string | null
  published_at: string | null
  like_count: number
  comments_count: number
}

type CampaignForm = {
  id: string
  platform: 'instagram' | 'facebook'
  name: string
  media_external_id: string
  post_permalink: string
  trigger_intent: string
  trigger_examples: string
  reply_message: string
  button_url: string
  flow_type: 'simple_link' | 'vote_discount'
  initial_button_voted_label: string
  initial_button_vote_label: string
  voted_message: string
  discount_button_title: string
  discount_button_url: string
  vote_message: string
  vote_button_title: string
  vote_url: string
  followup_enabled: boolean
  followup_delay_minutes: number
  followup_message: string
  followup_button_title: string
  confidence_threshold: number
  mode: 'manual' | 'auto'
  status: 'draft' | 'active' | 'paused' | 'archived'
  max_replies_per_hour: number
}

type MetaSuiteItem = {
  id: string
  kind: 'comment' | 'thread' | 'delivery' | 'suggestion'
  platform: 'instagram' | 'facebook'
  title: string
  subtitle: string
  preview: string
  timeLabel: string
  timestamp: number
  badge: string
  tone: 'neutral' | 'success' | 'warning' | 'danger' | 'ai'
  comment?: CommentRow
  thread?: ThreadRow
  delivery?: CommentDmDelivery
  suggestion?: AiSuggestion
}

const platformLabel = {
  instagram: 'Instagram',
  facebook: 'Facebook',
}

const emptyCampaignForm: CampaignForm = {
  id: '',
  platform: 'instagram',
  name: 'Votacao + livro com desconto',
  media_external_id: '',
  post_permalink: '',
  trigger_intent: 'A pessoa comentou no video demonstrando interesse no livro com desconto ou na campanha de votacao.',
  trigger_examples: 'quero o livro\nlivro com desconto\nja votei\nvou votar\nquero votar\nmanda o desconto\npilger',
  reply_message: `{saudacao}, {nome}.

Vou liberar um desconto especial no livro para quem apoiar a votacao.

Escolha uma opcao abaixo para eu te mandar o proximo passo.`,
  button_url: '',
  flow_type: 'vote_discount',
  initial_button_voted_label: 'Ja votei',
  initial_button_vote_label: 'Vou votar',
  voted_message: 'Obrigado por apoiar a votação.\n\nComo agradecimento, liberei 30% de desconto para você garantir o livro Corretor Nota 8.\n\nClique no botão abaixo e aproveite essa condição especial.',
  discount_button_title: 'Comprar livro',
  discount_button_url: '',
  vote_message: 'Perfeito. Clique no botao abaixo para abrir a votacao. Depois volte aqui quando terminar.',
  vote_button_title: 'Votar agora',
  vote_url: '',
  followup_enabled: true,
  followup_delay_minutes: 3,
  followup_message: 'Obrigado por apoiar a votação.\n\nComo agradecimento, liberei 30% de desconto para você garantir o livro Corretor Nota 8.\n\nClique no botão abaixo e aproveite essa condição especial.',
  followup_button_title: 'Comprar livro',
  confidence_threshold: 72,
  mode: 'manual',
  status: 'draft',
  max_replies_per_hour: 60,
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

function shortText(value: string | null | undefined, max = 92) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return 'Sem legenda'
  return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

function extractFirstHttpUrl(value: string | null | undefined) {
  const match = String(value || '').match(/https?:\/\/[^\s<>"']+/i)
  return match?.[0]?.replace(/[)\].,;!?]+$/g, '') || ''
}

function campaignButtonUrl(campaign: CommentDmCampaign | null | undefined) {
  const raw = (campaign?.raw || {}) as Record<string, unknown>
  return extractFirstHttpUrl(String(raw.button_url || raw.link_button_url || raw.cta_url || ''))
    || extractFirstHttpUrl(campaign?.reply_message)
}

function rawRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function rawString(value: unknown, fallback = '') {
  return String(value || fallback)
}

function rawNumber(value: unknown, fallback: number) {
  const parsed = Number(value ?? fallback)
  return Number.isFinite(parsed) ? parsed : fallback
}

function rawBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value
  const text = String(value || '').toLowerCase()
  if (['true', '1', 'sim', 'yes', 'on'].includes(text)) return true
  if (['false', '0', 'nao', 'no', 'off'].includes(text)) return false
  return fallback
}

function campaignVoteDiscountFlow(campaign: CommentDmCampaign | null | undefined) {
  const raw = rawRecord(campaign?.raw)
  return rawRecord(raw.comment_dm_flow)
}

function campaignFlowType(campaign: CommentDmCampaign | null | undefined): CampaignForm['flow_type'] {
  const raw = rawRecord(campaign?.raw)
  const flow = campaignVoteDiscountFlow(campaign)
  return rawString(raw.flow_type || flow.type) === 'vote_discount' && rawBoolean(flow.enabled, false)
    ? 'vote_discount'
    : 'simple_link'
}

function campaignFlowSummary(campaign: CommentDmCampaign) {
  if (campaignFlowType(campaign) !== 'vote_discount') return 'Botao simples'
  const flow = campaignVoteDiscountFlow(campaign)
  const delay = rawNumber(flow.followup_delay_minutes, 3)
  return `Votacao + livro | follow-up ${delay} min`
}

function campaignToForm(campaign: CommentDmCampaign): CampaignForm {
  const flow = campaignVoteDiscountFlow(campaign)
  const flowType = campaignFlowType(campaign)
  return {
    id: campaign.id,
    platform: campaign.platform,
    name: campaign.name,
    media_external_id: campaign.media_external_id || '',
    post_permalink: campaign.post_permalink || '',
    trigger_intent: campaign.trigger_intent,
    trigger_examples: (campaign.trigger_examples || []).join('\n'),
    reply_message: campaign.reply_message,
    button_url: campaignButtonUrl(campaign),
    flow_type: flowType,
    initial_button_voted_label: rawString(flow.already_voted_label, emptyCampaignForm.initial_button_voted_label),
    initial_button_vote_label: rawString(flow.will_vote_label, emptyCampaignForm.initial_button_vote_label),
    voted_message: rawString(flow.already_voted_message, emptyCampaignForm.voted_message),
    discount_button_title: rawString(flow.already_voted_button_title, emptyCampaignForm.discount_button_title),
    discount_button_url: extractFirstHttpUrl(rawString(flow.discount_url, '')),
    vote_message: rawString(flow.vote_message, emptyCampaignForm.vote_message),
    vote_button_title: rawString(flow.vote_button_title, emptyCampaignForm.vote_button_title),
    vote_url: extractFirstHttpUrl(rawString(flow.vote_url, '')),
    followup_enabled: rawBoolean(flow.followup_enabled, emptyCampaignForm.followup_enabled),
    followup_delay_minutes: rawNumber(flow.followup_delay_minutes, emptyCampaignForm.followup_delay_minutes),
    followup_message: rawString(flow.followup_message, emptyCampaignForm.followup_message),
    followup_button_title: rawString(flow.followup_button_title, emptyCampaignForm.followup_button_title),
    confidence_threshold: campaign.confidence_threshold,
    mode: campaign.mode,
    status: campaign.status,
    max_replies_per_hour: campaign.max_replies_per_hour,
  }
}

function isAutomationPublicReply(comment: CommentRow) {
  const authorName = String(comment.author_name || '').toLowerCase()
  const message = String(comment.message || '').toLowerCase()
  const looksLikePilger = authorName.includes('guilherme') || authorName.includes('pilger')
  const looksLikeAutomationReply =
    message.includes('te enviei uma mensagem no direct') ||
    message.includes('te enviei uma mensagem no messenger') ||
    message.includes('te enviei no direct') ||
    message.includes('te enviei no messenger')

  return Boolean(comment.parent_external_id || (looksLikePilger && looksLikeAutomationReply))
}

function deliveryAuthorName(delivery: CommentDmDelivery) {
  if (delivery.author_name) return delivery.author_name
  return delivery.platform === 'facebook' ? 'Contato Facebook' : 'Perfil Instagram'
}

function timestampValue(value: string | null | undefined) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function initials(value: string | null | undefined) {
  const text = String(value || 'Contato').replace(/^@/, '').trim()
  const parts = text.split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] || 'C'
  const second = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1]
  return `${first || 'C'}${second || ''}`.toUpperCase()
}

const deliveryStatusLabel: Record<CommentDmDelivery['send_status'], string> = {
  pending_approval: 'Pendente',
  sent: 'Enviada',
  skipped: 'Ignorada',
  error: 'Erro',
}

const deliveryDecisionLabel: Record<CommentDmDelivery['decision'], string> = {
  matched: 'Bateu com a campanha',
  not_matched: 'Fora da campanha',
  needs_review: 'Precisa revisar',
  skipped: 'Ignorada',
  error: 'Erro',
}

function mediaKind(media: Pick<CommentDmMedia, 'media_product_type' | 'media_type'>) {
  const product = String(media.media_product_type || '').toUpperCase()
  if (product === 'REELS') return 'Reel'
  const type = String(media.media_type || '').toUpperCase()
  if (type === 'VIDEO') return 'Video'
  if (type === 'CAROUSEL_ALBUM') return 'Carrossel'
  if (type === 'IMAGE') return 'Post'
  return 'Midia'
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
  const [activeMetaTab, setActiveMetaTab] = useState<MetaSuiteTab>('all')
  const [inboxSearch, setInboxSearch] = useState('')
  const [inboxFilter, setInboxFilter] = useState<MetaSuiteFilter>('all')
  const [selectedInboxItemId, setSelectedInboxItemId] = useState('')
  const [commentDmData, setCommentDmData] = useState<CommentDmPayload | null>(null)
  const [commentDmMedia, setCommentDmMedia] = useState<CommentDmMedia[]>([])
  const [campaignForm, setCampaignForm] = useState<CampaignForm>(emptyCampaignForm)
  const [savingCampaign, setSavingCampaign] = useState(false)
  const [processingCommentDm, setProcessingCommentDm] = useState(false)
  const [loadingMedia, setLoadingMedia] = useState(false)
  const [deletingCampaignId, setDeletingCampaignId] = useState('')
  const [commentDmMessage, setCommentDmMessage] = useState('')
  const [commentDmStatusFilter, setCommentDmStatusFilter] = useState<CommentDmStatusFilter>('all')
  const [commentDmLimit, setCommentDmLimit] = useState(80)

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

  const loadCommentDmAutomation = async (limit = commentDmLimit) => {
    const response = await fetch(`/api/admin/social-inbox/comment-dm/campaigns?limit=${limit}`)
    const payload = await response.json()
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Erro ao carregar campanhas de Direct.')
    setCommentDmData(payload)
  }

  const loadCommentDmMedia = async (sync = false) => {
    setLoadingMedia(true)
    try {
      const response = await fetch(`/api/admin/social-inbox/comment-dm/media?limit=40&platform=${campaignForm.platform}${sync ? '&sync=1' : ''}`)
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Erro ao carregar posts/reels.')
      setCommentDmMedia(payload.media || [])
      if (sync) setCommentDmMessage(`${campaignForm.platform === 'facebook' ? 'Posts do Facebook' : 'Posts e reels do Instagram'} atualizados.`)
    } finally {
      setLoadingMedia(false)
    }
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
      await loadCommentDmAutomation()
      await loadCommentDmMedia()
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
      await loadCommentDmAutomation()
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
      await Promise.all([loadInbox(), loadSuggestions(), loadCommentDmAutomation()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar sugestao.')
    } finally {
      setSendingSuggestionId('')
    }
  }

  const saveCommentDmCampaign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSavingCampaign(true)
    setError('')
    setCommentDmMessage('')
    try {
      const response = await fetch('/api/admin/social-inbox/comment-dm/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignForm),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Erro ao salvar campanha.')
      setCampaignForm(payload.campaign ? campaignToForm(payload.campaign) : {
        ...campaignForm,
        id: payload.campaign?.id || '',
      })
      setCommentDmMessage('Campanha salva.')
      await loadCommentDmAutomation()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar campanha de Direct.')
    } finally {
      setSavingCampaign(false)
    }
  }

  const processCommentDm = async () => {
    setProcessingCommentDm(true)
    setError('')
    setCommentDmMessage('')
    try {
      const response = await fetch('/api/admin/social-inbox/comment-dm/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 40 }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Erro ao processar Directs.')
      const followups = payload.followups?.processed ? ` | ${payload.followups.sent || 0} follow-up(s)` : ''
      setCommentDmMessage(`${payload.matched || 0} comentario(s) compativeis, ${payload.sent || 0} enviado(s), ${payload.pending || 0} pendente(s).${followups}`)
      await Promise.all([loadSuggestions(), loadCommentDmAutomation()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar comentarios para Direct.')
    } finally {
      setProcessingCommentDm(false)
    }
  }

  const loadMoreCommentDmHistory = async () => {
    const nextLimit = Math.min(commentDmLimit + 80, 1000)
    setCommentDmLimit(nextLimit)
    await loadCommentDmAutomation(nextLimit)
  }

  const editCommentDmCampaign = (campaign: CommentDmCampaign) => {
    setCampaignForm(campaignToForm(campaign))
  }

  const startNewCommentDmCampaign = () => {
    setCampaignForm(emptyCampaignForm)
    setCommentDmMessage('Formulario limpo para criar nova campanha.')
  }

  const selectCommentDmMedia = (media: CommentDmMedia) => {
    setCampaignForm(prev => ({
      ...prev,
      platform: media.platform,
      media_external_id: media.external_id,
      post_permalink: media.permalink || prev.post_permalink,
    }))
    setCommentDmMessage(`${media.platform === 'facebook' ? 'Post Facebook' : 'Post/reel Instagram'} ${media.external_id} selecionado como alvo.`)
  }

  const startCampaignFromMedia = (media: CommentDmMedia) => {
    setCampaignForm(prev => ({
      ...emptyCampaignForm,
      name: prev.name || emptyCampaignForm.name,
      trigger_intent: prev.trigger_intent || emptyCampaignForm.trigger_intent,
      trigger_examples: prev.trigger_examples || emptyCampaignForm.trigger_examples,
      reply_message: prev.reply_message || emptyCampaignForm.reply_message,
      button_url: prev.button_url || emptyCampaignForm.button_url,
      flow_type: prev.flow_type || emptyCampaignForm.flow_type,
      initial_button_voted_label: prev.initial_button_voted_label || emptyCampaignForm.initial_button_voted_label,
      initial_button_vote_label: prev.initial_button_vote_label || emptyCampaignForm.initial_button_vote_label,
      voted_message: prev.voted_message || emptyCampaignForm.voted_message,
      discount_button_title: prev.discount_button_title || emptyCampaignForm.discount_button_title,
      discount_button_url: prev.discount_button_url || emptyCampaignForm.discount_button_url,
      vote_message: prev.vote_message || emptyCampaignForm.vote_message,
      vote_button_title: prev.vote_button_title || emptyCampaignForm.vote_button_title,
      vote_url: prev.vote_url || emptyCampaignForm.vote_url,
      followup_enabled: prev.followup_enabled,
      followup_delay_minutes: prev.followup_delay_minutes || emptyCampaignForm.followup_delay_minutes,
      followup_message: prev.followup_message || emptyCampaignForm.followup_message,
      followup_button_title: prev.followup_button_title || emptyCampaignForm.followup_button_title,
      platform: media.platform,
      media_external_id: media.external_id,
      post_permalink: media.permalink || '',
      mode: 'manual',
      status: 'draft',
    }))
    setCommentDmMessage(`Nova campanha preparada para o ${mediaKind(media).toLowerCase()} selecionado. Revise e clique em Salvar.`)
  }

  const clearCommentDmTarget = () => {
    setCampaignForm(prev => ({
      ...prev,
      media_external_id: '',
      post_permalink: '',
    }))
    setCommentDmMessage('Alvo removido. Se salvar assim, a campanha fica para todas as midias.')
  }

  const handleCommentMediaAsTarget = (comment: CommentRow) => {
    if (!comment.media_external_id) return
    setCampaignForm(prev => ({
      ...prev,
      platform: comment.platform,
      media_external_id: comment.media_external_id || '',
    }))
    setCommentDmMessage(`Midia ${comment.media_external_id} selecionada como alvo do formulario.`)
  }

  const deleteCommentDmCampaign = async (campaign: CommentDmCampaign) => {
    const confirmed = window.confirm(`Excluir a campanha "${campaign.name}" e seu historico de entregas?`)
    if (!confirmed) return

    setDeletingCampaignId(campaign.id)
    setError('')
    setCommentDmMessage('')
    try {
      const response = await fetch('/api/admin/social-inbox/comment-dm/campaigns', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: campaign.id }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Erro ao excluir campanha.')
      if (campaignForm.id === campaign.id) setCampaignForm(emptyCampaignForm)
      setCommentDmMessage('Campanha excluida.')
      await loadCommentDmAutomation()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir campanha de Direct.')
    } finally {
      setDeletingCampaignId('')
    }
  }

  useEffect(() => {
    Promise.all([loadInbox(), loadSuggestions(), loadCommentDmAutomation(), loadCommentDmMedia()])
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
  const visibleComments = comments.filter(comment => !isAutomationPublicReply(comment))
  const threads = data?.threads || []
  const messages = data?.messages || []
  const hotSuggestions = suggestions.filter(item => item.lead_score >= 60 || item.priority === 'alta' || item.priority === 'urgente')
  const filteredComments = visibleComments
  const filteredThreads = threads
  const instagramComments = visibleComments.filter(comment => comment.platform === 'instagram').length
  const facebookComments = visibleComments.filter(comment => comment.platform === 'facebook').length
  const hiddenAutomationReplies = comments.length - visibleComments.length
  const instagramThreads = threads.filter(thread => thread.platform === 'instagram').length
  const facebookThreads = threads.filter(thread => thread.platform === 'facebook').length
  const instagramDirectWarning = warnings.some(item => item.toLowerCase().includes('direct do instagram'))
  const commentDmCampaigns = commentDmData?.campaigns || []
  const commentDmDeliveries = commentDmData?.deliveries || []
  const selectedCommentDmCampaign = campaignForm.id
    ? commentDmCampaigns.find(campaign => campaign.id === campaignForm.id) || null
    : null
  const campaignById = new Map(commentDmCampaigns.map(campaign => [campaign.id, campaign]))
  const activeDmCampaigns = commentDmCampaigns.filter(campaign => campaign.status === 'active').length
  const sentDmDeliveries = commentDmDeliveries.filter(delivery => delivery.send_status === 'sent').length
  const pendingDmDeliveries = commentDmDeliveries.filter(delivery => delivery.send_status === 'pending_approval').length
  const errorDmDeliveries = commentDmDeliveries.filter(delivery => delivery.send_status === 'error' || delivery.decision === 'error').length
  const skippedDmDeliveries = commentDmDeliveries.filter(delivery => delivery.send_status === 'skipped' || delivery.decision === 'skipped' || delivery.decision === 'not_matched').length
  const matchedDmDeliveries = commentDmDeliveries.filter(delivery => delivery.ai_matches).length
  const totalDmDeliveries = commentDmData?.total_deliveries ?? commentDmDeliveries.length
  const filteredCommentDmDeliveries = commentDmDeliveries.filter(delivery => {
    if (commentDmStatusFilter === 'all') return true
    if (commentDmStatusFilter === 'matched') return delivery.ai_matches
    if (commentDmStatusFilter === 'error') return delivery.send_status === 'error' || delivery.decision === 'error'
    if (commentDmStatusFilter === 'skipped') return delivery.send_status === 'skipped' || delivery.decision === 'skipped' || delivery.decision === 'not_matched'
    return delivery.send_status === commentDmStatusFilter
  })
  const commentDmDeliveryFilters: Array<{ key: CommentDmStatusFilter; label: string; count: number }> = [
    { key: 'all', label: 'Todos', count: commentDmDeliveries.length },
    { key: 'sent', label: 'Enviadas', count: sentDmDeliveries },
    { key: 'pending_approval', label: 'Pendentes', count: pendingDmDeliveries },
    { key: 'error', label: 'Erros', count: errorDmDeliveries },
    { key: 'skipped', label: 'Ignoradas', count: skippedDmDeliveries },
    { key: 'matched', label: 'Matches IA', count: matchedDmDeliveries },
  ]
  const metaSuiteTabs: Array<{ key: MetaSuiteTab; label: string; count: number }> = [
    { key: 'all', label: 'Todas as mensagens', count: visibleComments.length + threads.length },
    { key: 'messenger', label: 'Messenger', count: facebookThreads },
    { key: 'instagram', label: 'Instagram', count: instagramThreads },
    { key: 'facebook_comments', label: 'Comentarios do Facebook', count: facebookComments },
    { key: 'instagram_comments', label: 'Comentarios do Instagram', count: instagramComments },
    { key: 'automation', label: 'Automacao', count: commentDmDeliveries.length },
    { key: 'ai', label: 'Triagem IA', count: suggestions.length },
  ]
  const commentItems: MetaSuiteItem[] = visibleComments.map(comment => ({
    id: `comment-${comment.id}`,
    kind: 'comment',
    platform: comment.platform,
    title: comment.author_name || 'Autor nao identificado',
    subtitle: comment.media_external_id ? `Midia ${comment.media_external_id}` : 'Comentario sincronizado',
    preview: comment.message || 'Comentario sem texto.',
    timeLabel: formatDate(comment.commented_at),
    timestamp: timestampValue(comment.commented_at),
    badge: comment.platform === 'facebook' ? 'Comentario Facebook' : 'Comentario Instagram',
    tone: 'neutral',
    comment,
  }))
  const threadItems: MetaSuiteItem[] = threads.map(thread => {
    const latestMessages = messagesByThread.get(thread.id) || []
    const latestMessage = latestMessages[0]
    return {
      id: `thread-${thread.id}`,
      kind: 'thread',
      platform: thread.platform,
      title: thread.participant_name || 'Contato Meta',
      subtitle: `${thread.unread_count} nao lidas`,
      preview: latestMessage?.message || latestMessage?.attachment_type || 'Conversa sincronizada.',
      timeLabel: formatDate(thread.last_message_at),
      timestamp: timestampValue(thread.last_message_at),
      badge: thread.platform === 'facebook' ? 'Messenger' : 'Instagram',
      tone: thread.unread_count > 0 ? 'warning' : 'neutral',
      thread,
    }
  })
  const deliveryItems: MetaSuiteItem[] = filteredCommentDmDeliveries.map(delivery => ({
    id: `delivery-${delivery.id}`,
    kind: 'delivery',
    platform: delivery.platform,
    title: deliveryAuthorName(delivery),
    subtitle: campaignById.get(delivery.campaign_id)?.name || 'Campanha removida',
    preview: delivery.comment_text || 'Comentario sem texto.',
    timeLabel: formatDate(delivery.sent_at || delivery.processed_at || delivery.updated_at),
    timestamp: timestampValue(delivery.sent_at || delivery.processed_at || delivery.updated_at),
    badge: deliveryStatusLabel[delivery.send_status] || delivery.send_status,
    tone: delivery.send_status === 'sent' ? 'success' : delivery.send_status === 'error' ? 'danger' : delivery.send_status === 'pending_approval' ? 'warning' : 'neutral',
    delivery,
  }))
  const suggestionItems: MetaSuiteItem[] = suggestions.map(item => ({
    id: `suggestion-${item.id}`,
    kind: 'suggestion',
    platform: item.platform,
    title: item.summary || item.intent || 'Sugestao da IA',
    subtitle: `${item.lead_score}% | ${item.priority}`,
    preview: item.suggested_reply || item.recommended_action || 'Sugestao sem resposta pronta.',
    timeLabel: formatDate(item.updated_at),
    timestamp: timestampValue(item.updated_at),
    badge: 'IA',
    tone: item.priority === 'alta' || item.priority === 'urgente' ? 'danger' : 'ai',
    suggestion: item,
  }))
  const socialInboxItems = [...commentItems, ...threadItems].sort((a, b) => b.timestamp - a.timestamp)
  const tabInboxItems = (() => {
    if (activeMetaTab === 'messenger') return threadItems.filter(item => item.platform === 'facebook')
    if (activeMetaTab === 'instagram') return threadItems.filter(item => item.platform === 'instagram')
    if (activeMetaTab === 'facebook_comments') return commentItems.filter(item => item.platform === 'facebook')
    if (activeMetaTab === 'instagram_comments') return commentItems.filter(item => item.platform === 'instagram')
    if (activeMetaTab === 'automation') return deliveryItems
    if (activeMetaTab === 'ai') return suggestionItems
    return socialInboxItems
  })().sort((a, b) => b.timestamp - a.timestamp)
  const searchTerm = inboxSearch.trim().toLowerCase()
  const searchedInboxItems = tabInboxItems.filter(item => {
    if (!searchTerm) return true
    return [item.title, item.subtitle, item.preview, item.badge].join(' ').toLowerCase().includes(searchTerm)
  })
  const visibleInboxItems = searchedInboxItems.filter(item => {
    if (inboxFilter === 'comments') return item.kind === 'comment' || item.kind === 'delivery'
    if (inboxFilter === 'priority') return item.tone === 'danger' || item.tone === 'warning'
    if (inboxFilter === 'sent') return item.delivery?.send_status === 'sent' || item.thread?.unread_count === 0
    return true
  })
  const selectedInboxItem = visibleInboxItems.find(item => item.id === selectedInboxItemId) || visibleInboxItems[0] || null
  const selectedThreadMessages = selectedInboxItem?.thread ? messagesByThread.get(selectedInboxItem.thread.id) || [] : []
  const selectedDeliveryCampaign = selectedInboxItem?.delivery ? campaignById.get(selectedInboxItem.delivery.campaign_id) || null : null
  const selectedCommentCampaigns = selectedInboxItem?.comment
    ? commentDmCampaigns
        .filter(campaign => campaign.platform === selectedInboxItem.comment?.platform && (!campaign.media_external_id || campaign.media_external_id === selectedInboxItem.comment?.media_external_id))
        .slice(0, 3)
    : []
  const inboxQuickFilters: Array<{ key: MetaSuiteFilter; label: string }> = [
    { key: 'all', label: 'Todos' },
    { key: 'comments', label: 'Comentarios' },
    { key: 'priority', label: 'Prioridade' },
    { key: 'sent', label: 'Resolvidos' },
  ]

  if (loading) return <AdminLoadingState message="Carregando inbox Meta..." />

  return (
    <div className="meta-inbox-page">
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

      <div className="meta-suite-tabs">
        {metaSuiteTabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            className={activeMetaTab === tab.key ? 'active' : ''}
            onClick={() => {
              setActiveMetaTab(tab.key)
              setSelectedInboxItemId('')
            }}
          >
            {tab.label}
            <span>{tab.count}</span>
          </button>
        ))}
        <span>{messages.length} mensagens salvas no historico</span>
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

      <section className="meta-suite-app">
        <div className="meta-suite-metrics">
          <div>
            <Share2 size={16} />
            <span>
              <strong>Messenger</strong>
              <small>{facebookThreads} conversas | {facebookComments} comentarios</small>
            </span>
          </div>
          <div>
            <Instagram size={16} />
            <span>
              <strong>Instagram</strong>
              <small>{instagramThreads} directs | {instagramComments} comentarios</small>
            </span>
          </div>
          <div className={instagramDirectWarning ? 'warn' : ''}>
            <MessageSquareText size={16} />
            <span>
              <strong>Automacao</strong>
              <small>{sentDmDeliveries} enviadas | {pendingDmDeliveries} pendentes | {errorDmDeliveries} erros</small>
            </span>
          </div>
          <div>
            <Sparkles size={16} />
            <span>
              <strong>Triagem IA</strong>
              <small>{hotSuggestions.length} quentes de {suggestions.length} sugestoes</small>
            </span>
          </div>
        </div>

        <div className="meta-suite-workspace">
          <aside className="meta-suite-left">
            <div className="meta-suite-search">
              <input
                value={inboxSearch}
                onChange={event => setInboxSearch(event.target.value)}
                placeholder="Pesquisa"
              />
            </div>
            <div className="meta-suite-filter-row">
              {inboxQuickFilters.map(filter => (
                <button
                  key={filter.key}
                  type="button"
                  className={inboxFilter === filter.key ? 'active' : ''}
                  onClick={() => setInboxFilter(filter.key)}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="meta-suite-list">
              {visibleInboxItems.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={`meta-suite-list-item tone-${item.tone} ${selectedInboxItem?.id === item.id ? 'active' : ''}`}
                  onClick={() => setSelectedInboxItemId(item.id)}
                >
                  <span className={`meta-suite-avatar ${item.platform}`}>{initials(item.title)}</span>
                  <span className="meta-suite-list-copy">
                    <span className="meta-suite-list-head">
                      <strong>{item.title}</strong>
                      <em>{item.timeLabel}</em>
                    </span>
                    <span className="meta-suite-list-preview">{shortText(item.preview, 96)}</span>
                    <span className="meta-suite-list-meta">
                      <PlatformBadge platform={item.platform} />
                      <small>{item.badge}</small>
                    </span>
                  </span>
                </button>
              ))}
              {visibleInboxItems.length === 0 && (
                <div className="meta-suite-empty">Nenhum item encontrado neste filtro.</div>
              )}
              {activeMetaTab === 'automation' && commentDmDeliveries.length < totalDmDeliveries && (
                <button type="button" className="meta-suite-load" onClick={loadMoreCommentDmHistory}>
                  Carregar mais historico
                </button>
              )}
            </div>
          </aside>

          <section className="meta-suite-center">
            {selectedInboxItem ? (
              <>
                <header className="meta-suite-center-head">
                  <span className={`meta-suite-avatar large ${selectedInboxItem.platform}`}>{initials(selectedInboxItem.title)}</span>
                  <div>
                    <strong>{selectedInboxItem.title}</strong>
                    <span>{selectedInboxItem.subtitle}</span>
                  </div>
                  <PlatformBadge platform={selectedInboxItem.platform} />
                  <em className={`meta-suite-status tone-${selectedInboxItem.tone}`}>{selectedInboxItem.badge}</em>
                </header>

                <div className="meta-suite-center-scroll">
                  {selectedInboxItem.thread && (
                    <div className="meta-suite-chat">
                      {selectedThreadMessages.length === 0 && (
                        <div className="meta-suite-empty">Conversa sincronizada sem mensagens recentes.</div>
                      )}
                      {selectedThreadMessages.slice().reverse().map(message => (
                        <div key={message.id} className={`meta-suite-bubble ${message.direction}`}>
                          <strong>{message.direction === 'outbound' ? 'Pilger' : message.sender_name || 'Contato'}</strong>
                          <p>{message.message || message.attachment_type || 'Mensagem sem texto.'}</p>
                          <small>{formatDate(message.sent_at)}</small>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedInboxItem.comment && (
                    <div className="meta-suite-detail">
                      <span className="meta-suite-date">{formatDate(selectedInboxItem.comment.commented_at)}</span>
                      <div className="meta-suite-message-card">
                        <small>Comentario recebido</small>
                        <p>{selectedInboxItem.comment.message || 'Comentario sem texto.'}</p>
                      </div>
                      <div className="meta-suite-meta-line">
                        <span>{selectedInboxItem.comment.like_count} curtidas</span>
                        <span>{selectedInboxItem.comment.reply_count} respostas</span>
                        {selectedInboxItem.comment.media_external_id && <span>Midia {selectedInboxItem.comment.media_external_id}</span>}
                      </div>
                      <div className="meta-suite-detail-actions">
                        {selectedInboxItem.comment.media_external_id && (
                          <button type="button" onClick={() => handleCommentMediaAsTarget(selectedInboxItem.comment as CommentRow)}>
                            <Target size={14} />
                            Usar midia como alvo
                          </button>
                        )}
                        {selectedInboxItem.comment.permalink && (
                          <a href={selectedInboxItem.comment.permalink} target="_blank" rel="noreferrer">
                            <ExternalLink size={14} />
                            Abrir comentario
                          </a>
                        )}
                      </div>
                      {selectedCommentCampaigns.length > 0 && (
                        <div className="meta-suite-related">
                          <strong>Campanhas que podem atender este comentario</strong>
                          {selectedCommentCampaigns.map(campaign => (
                            <button key={campaign.id} type="button" onClick={() => editCommentDmCampaign(campaign)}>
                              {campaign.name}
                              <span>{campaign.status} | {campaign.mode} | {campaign.confidence_threshold}%</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedInboxItem.delivery && (
                    <div className="meta-suite-detail">
                      <span className="meta-suite-date">{formatDate(selectedInboxItem.delivery.sent_at || selectedInboxItem.delivery.processed_at || selectedInboxItem.delivery.updated_at)}</span>
                      <div className="meta-suite-message-card inbound">
                        <small>Comentario que disparou a automacao</small>
                        <p>{selectedInboxItem.delivery.comment_text || 'Comentario sem texto.'}</p>
                      </div>
                      <div className="meta-suite-meta-line">
                        <span>{selectedInboxItem.delivery.ai_confidence}% IA</span>
                        <span>{deliveryDecisionLabel[selectedInboxItem.delivery.decision] || selectedInboxItem.delivery.decision}</span>
                        {selectedInboxItem.delivery.media_external_id && <span>Midia {selectedInboxItem.delivery.media_external_id}</span>}
                      </div>
                      {selectedInboxItem.delivery.reply_message && (
                        <div className="meta-suite-message-card outbound">
                          <small>Mensagem enviada</small>
                          <p>{selectedInboxItem.delivery.reply_message}</p>
                        </div>
                      )}
                      {selectedInboxItem.delivery.ai_reason && (
                        <details className="meta-suite-details">
                          <summary>Motivo da IA</summary>
                          <p>{selectedInboxItem.delivery.ai_reason}</p>
                        </details>
                      )}
                      {selectedInboxItem.delivery.error && (
                        <details className="meta-suite-details error" open>
                          <summary>Erro registrado</summary>
                          <p>{selectedInboxItem.delivery.error}</p>
                        </details>
                      )}
                      {selectedDeliveryCampaign?.post_permalink && (
                        <a className="meta-suite-link" href={selectedDeliveryCampaign.post_permalink} target="_blank" rel="noreferrer">
                          <ExternalLink size={14} />
                          Abrir midia alvo
                        </a>
                      )}
                    </div>
                  )}

                  {selectedInboxItem.suggestion && (
                    <div className="meta-suite-detail">
                      <span className="meta-suite-date">{formatDate(selectedInboxItem.suggestion.updated_at)}</span>
                      <div className="meta-suite-message-card">
                        <small>{selectedInboxItem.suggestion.intent} | {selectedInboxItem.suggestion.sentiment}</small>
                        <p>{selectedInboxItem.suggestion.summary || 'Sugestao sem resumo.'}</p>
                      </div>
                      {selectedInboxItem.suggestion.suggested_reply && (
                        <div className="meta-suite-message-card outbound">
                          <small>Resposta sugerida</small>
                          <p>{selectedInboxItem.suggestion.suggested_reply}</p>
                        </div>
                      )}
                      {selectedInboxItem.suggestion.recommended_action && (
                        <p className="meta-suite-recommendation">{selectedInboxItem.suggestion.recommended_action}</p>
                      )}
                      <div className="meta-suite-detail-actions">
                        <button
                          type="button"
                          onClick={() => handleSuggestionAction(selectedInboxItem.suggestion as AiSuggestion, 'approve')}
                          disabled={sendingSuggestionId === `approve-${selectedInboxItem.suggestion.id}` || selectedInboxItem.suggestion.status === 'approved' || selectedInboxItem.suggestion.status === 'sent'}
                        >
                          Aprovar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSuggestionAction(selectedInboxItem.suggestion as AiSuggestion, 'send')}
                          disabled={sendingSuggestionId === `send-${selectedInboxItem.suggestion.id}` || selectedInboxItem.suggestion.status === 'sent' || !selectedInboxItem.suggestion.suggested_reply}
                        >
                          Enviar resposta
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="meta-suite-empty center">Selecione um item na lista.</div>
            )}
          </section>

          <aside className="meta-suite-right">
            <div className="meta-suite-profile">
              <span className={`meta-suite-avatar large ${selectedInboxItem?.platform || 'instagram'}`}>
                {initials(selectedInboxItem?.title)}
              </span>
              <div>
                <strong>{selectedInboxItem?.title || 'Caixa Meta'}</strong>
                <span>{selectedInboxItem?.subtitle || `${messages.length} mensagens salvas no historico`}</span>
              </div>
            </div>

            <div className="meta-suite-action-row">
              <button type="button" onClick={startNewCommentDmCampaign}>
                <Plus size={15} />
                Nova
              </button>
              <button type="button" onClick={processCommentDm} disabled={processingCommentDm}>
                <Play size={15} className={processingCommentDm ? 'spin' : ''} />
                Processar
              </button>
              <button type="button" onClick={() => loadCommentDmMedia(true)} disabled={loadingMedia}>
                <RefreshCw size={15} className={loadingMedia ? 'spin' : ''} />
                Midias
              </button>
            </div>
            {commentDmMessage && <div className="meta-suite-toast">{commentDmMessage}</div>}

            <form className="meta-suite-compact-form" onSubmit={saveCommentDmCampaign}>
              <div className="meta-suite-panel-title">
                <span>
                  <Bot size={15} />
                  Campanha
                </span>
                {selectedCommentDmCampaign && (
                  <button
                    type="button"
                    className="danger"
                    onClick={() => deleteCommentDmCampaign(selectedCommentDmCampaign)}
                    disabled={deletingCampaignId === selectedCommentDmCampaign.id}
                  >
                    <Trash2 size={14} />
                    Excluir
                  </button>
                )}
              </div>

              <label>
                Plataforma
                <select
                  value={campaignForm.platform}
                  onChange={event => {
                    const platform = event.target.value as CampaignForm['platform']
                    setCampaignForm({ ...campaignForm, platform, media_external_id: '', post_permalink: '' })
                    setCommentDmMedia([])
                    setCommentDmMessage(platform === 'facebook'
                      ? 'Facebook selecionado. Atualize os posts para escolher o alvo.'
                      : 'Instagram selecionado. Atualize os posts/reels para escolher o alvo.')
                  }}
                >
                  <option value="instagram">Instagram Direct</option>
                  <option value="facebook">Facebook Messenger</option>
                </select>
              </label>

              <label>
                Nome
                <input
                  value={campaignForm.name}
                  onChange={event => setCampaignForm({ ...campaignForm, name: event.target.value })}
                  placeholder="Perfil do Corretor Ideal"
                />
              </label>

              <label>
                ID da midia alvo
                <input
                  value={campaignForm.media_external_id}
                  onChange={event => setCampaignForm({ ...campaignForm, media_external_id: event.target.value })}
                  placeholder="Vazio = todas"
                />
              </label>

              <label>
                Intencao
                <textarea
                  rows={3}
                  value={campaignForm.trigger_intent}
                  onChange={event => setCampaignForm({ ...campaignForm, trigger_intent: event.target.value })}
                />
              </label>

              <label>
                Frases gatilho
                <textarea
                  rows={4}
                  value={campaignForm.trigger_examples}
                  onChange={event => setCampaignForm({ ...campaignForm, trigger_examples: event.target.value })}
                  placeholder={'nota 8\ncorretor nota 8\nquero a ferramenta'}
                />
                <small>Uma frase por linha. Use aqui o que a pessoa pode comentar para receber a mensagem.</small>
              </label>

              <label>
                Mensagem no Direct/Messenger
                <textarea
                  rows={5}
                  value={campaignForm.reply_message}
                  onChange={event => setCampaignForm({ ...campaignForm, reply_message: event.target.value })}
                />
              </label>

              <label>
                Fluxo do Direct
                <select
                  value={campaignForm.flow_type}
                  onChange={event => setCampaignForm({ ...campaignForm, flow_type: event.target.value as CampaignForm['flow_type'] })}
                >
                  <option value="vote_discount">Votacao + livro</option>
                  <option value="simple_link">Mensagem com botao simples</option>
                </select>
              </label>

              {campaignForm.flow_type === 'simple_link' ? (
                <label>
                  Link do botao
                  <input
                    value={campaignForm.button_url}
                    onChange={event => setCampaignForm({ ...campaignForm, button_url: event.target.value })}
                    placeholder="https://..."
                  />
                  <small>Quando preenchido, vira o botao da mensagem. Se a Meta recusar o botao, o link entra no texto como fallback.</small>
                </label>
              ) : (
                <div className="meta-comment-dm-flow-box">
                  <div className="meta-comment-dm-flow-title">
                    <MousePointerClick size={16} />
                    <strong>Botoes iniciais</strong>
                  </div>
                  <div className="meta-comment-dm-two even">
                    <label>
                      Botao 1
                      <input
                        value={campaignForm.initial_button_voted_label}
                        maxLength={20}
                        onChange={event => setCampaignForm({ ...campaignForm, initial_button_voted_label: event.target.value })}
                      />
                    </label>
                    <label>
                      Botao 2
                      <input
                        value={campaignForm.initial_button_vote_label}
                        maxLength={20}
                        onChange={event => setCampaignForm({ ...campaignForm, initial_button_vote_label: event.target.value })}
                      />
                    </label>
                  </div>

                  <div className="meta-comment-dm-flow-title">
                    <ShoppingCart size={16} />
                    <strong>Se clicar em Ja votei</strong>
                  </div>
                  <label>
                    Mensagem do desconto
                    <textarea
                      rows={3}
                      value={campaignForm.voted_message}
                      onChange={event => setCampaignForm({ ...campaignForm, voted_message: event.target.value })}
                    />
                  </label>
                  <div className="meta-comment-dm-two">
                    <label>
                      Link do livro
                      <input
                        value={campaignForm.discount_button_url}
                        onChange={event => setCampaignForm({ ...campaignForm, discount_button_url: event.target.value })}
                        placeholder="https://..."
                      />
                    </label>
                    <label>
                      Botao
                      <input
                        value={campaignForm.discount_button_title}
                        maxLength={20}
                        onChange={event => setCampaignForm({ ...campaignForm, discount_button_title: event.target.value })}
                      />
                    </label>
                  </div>

                  <div className="meta-comment-dm-flow-title">
                    <ExternalLink size={16} />
                    <strong>Se clicar em Vou votar</strong>
                  </div>
                  <label>
                    Mensagem de votacao
                    <textarea
                      rows={3}
                      value={campaignForm.vote_message}
                      onChange={event => setCampaignForm({ ...campaignForm, vote_message: event.target.value })}
                    />
                  </label>
                  <div className="meta-comment-dm-two">
                    <label>
                      Link da votacao
                      <input
                        value={campaignForm.vote_url}
                        onChange={event => setCampaignForm({ ...campaignForm, vote_url: event.target.value })}
                        placeholder="https://..."
                      />
                    </label>
                    <label>
                      Botao
                      <input
                        value={campaignForm.vote_button_title}
                        maxLength={20}
                        onChange={event => setCampaignForm({ ...campaignForm, vote_button_title: event.target.value })}
                      />
                    </label>
                  </div>

                  <div className="meta-comment-dm-flow-title with-control">
                    <span>
                      <Clock size={16} />
                      <strong>Follow-up automatico</strong>
                    </span>
                    <label className="meta-comment-dm-check">
                      <input
                        type="checkbox"
                        checked={campaignForm.followup_enabled}
                        onChange={event => setCampaignForm({ ...campaignForm, followup_enabled: event.target.checked })}
                      />
                      Ativo
                    </label>
                  </div>
                  <div className="meta-comment-dm-two">
                    <label>
                      Mensagem depois do atraso
                      <textarea
                        rows={3}
                        value={campaignForm.followup_message}
                        onChange={event => setCampaignForm({ ...campaignForm, followup_message: event.target.value })}
                      />
                    </label>
                    <label>
                      Minutos
                      <input
                        type="number"
                        min={1}
                        max={1440}
                        value={campaignForm.followup_delay_minutes}
                        onChange={event => setCampaignForm({ ...campaignForm, followup_delay_minutes: Number(event.target.value || 3) })}
                      />
                    </label>
                  </div>
                  <label>
                    Texto do botao do follow-up
                    <input
                      value={campaignForm.followup_button_title}
                      maxLength={20}
                      onChange={event => setCampaignForm({ ...campaignForm, followup_button_title: event.target.value })}
                    />
                    <small>O follow-up usa o mesmo link do livro cadastrado acima.</small>
                  </label>
                </div>
              )}

              <div className="meta-suite-form-grid">
                <label>
                  Confianca
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={campaignForm.confidence_threshold}
                    onChange={event => setCampaignForm({ ...campaignForm, confidence_threshold: Number(event.target.value || 72) })}
                  />
                </label>
                <label>
                  Modo
                  <select
                    value={campaignForm.mode}
                    onChange={event => setCampaignForm({ ...campaignForm, mode: event.target.value as CampaignForm['mode'] })}
                  >
                    <option value="manual">Manual</option>
                    <option value="auto">Automatico</option>
                  </select>
                </label>
                <label>
                  Status
                  <select
                    value={campaignForm.status}
                    onChange={event => setCampaignForm({ ...campaignForm, status: event.target.value as CampaignForm['status'] })}
                  >
                    <option value="draft">Rascunho</option>
                    <option value="active">Ativa</option>
                    <option value="paused">Pausada</option>
                    <option value="archived">Arquivada</option>
                  </select>
                </label>
              </div>

              <div className="meta-suite-form-actions">
                <button type="submit" disabled={savingCampaign}>
                  <CheckCircle2 size={15} />
                  {savingCampaign ? 'Salvando...' : campaignForm.id ? 'Salvar' : 'Criar campanha'}
                </button>
                <button type="button" onClick={startNewCommentDmCampaign}>Limpar</button>
              </div>
            </form>

            <details className="meta-suite-side-section" open>
              <summary>Campanhas</summary>
              <div className="meta-suite-campaign-list">
                {commentDmCampaigns.slice(0, 6).map(campaign => (
                  <article key={campaign.id} className={`meta-suite-campaign status-${campaign.status}`}>
                    <button type="button" onClick={() => editCommentDmCampaign(campaign)}>
                      <strong>{campaign.name}</strong>
                      <span>{platformLabel[campaign.platform]} | {campaign.status} | {campaign.mode}</span>
                      <small>{campaign.media_external_id ? `Midia ${campaign.media_external_id}` : 'Todas as midias'}</small>
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => deleteCommentDmCampaign(campaign)}
                      disabled={deletingCampaignId === campaign.id}
                    >
                      <Trash2 size={13} />
                    </button>
                  </article>
                ))}
                {commentDmCampaigns.length === 0 && <div className="meta-suite-empty">Nenhuma campanha cadastrada.</div>}
              </div>
            </details>

            <details className="meta-suite-side-section">
              <summary>Posts e reels</summary>
              <div className="meta-suite-media-list">
                {commentDmMedia.slice(0, 8).map(media => (
                  <article key={media.id} className={campaignForm.media_external_id === media.external_id ? 'active' : ''}>
                    {(media.thumbnail_url || media.media_url) ? (
                      <img src={media.thumbnail_url || media.media_url || ''} alt="" />
                    ) : (
                      <span><Film size={16} /></span>
                    )}
                    <div>
                      <strong>{platformLabel[media.platform]} | {mediaKind(media)}</strong>
                      <p>{shortText(media.caption, 78)}</p>
                      <small>{media.comments_count || 0} comentarios</small>
                    </div>
                    <button type="button" onClick={() => selectCommentDmMedia(media)}>
                      <Target size={13} />
                    </button>
                  </article>
                ))}
                {commentDmMedia.length === 0 && <div className="meta-suite-empty">Atualize as midias para escolher um alvo.</div>}
              </div>
            </details>
          </aside>
        </div>
      </section>

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
        <div className={`meta-inbox-status-card ${instagramDirectWarning ? 'warning' : 'neutral'}`}>
          <MessageSquareText size={18} />
          <div>
            <strong>Instagram Direct</strong>
            <span>{instagramThreads > 0 ? `${instagramThreads} conversas sincronizadas` : 'Private Reply por comentario fica no painel abaixo; conversas do Direct aparecem aqui quando a capability estiver liberada.'}</span>
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

      <section className="chart-card meta-comment-dm-panel">
        <div className="meta-inbox-section-title">
          <span>Automacao comentario para conversa</span>
          <strong>{activeDmCampaigns} ativas | {sentDmDeliveries} enviadas | {pendingDmDeliveries} pendentes</strong>
        </div>

        <div className="meta-comment-dm-layout">
          <form className="meta-comment-dm-form" onSubmit={saveCommentDmCampaign}>
            <div className="meta-comment-dm-form-head">
              <span>
                <Bot size={18} />
                <strong>{campaignForm.id ? 'Editando campanha' : 'Criando nova campanha'}</strong>
              </span>
              <div className="meta-comment-dm-form-head-actions">
                <button type="button" onClick={startNewCommentDmCampaign}>
                  <Plus size={14} />
                  Nova
                </button>
                {selectedCommentDmCampaign && (
                  <button
                    type="button"
                    className="danger"
                    onClick={() => deleteCommentDmCampaign(selectedCommentDmCampaign)}
                    disabled={deletingCampaignId === selectedCommentDmCampaign.id}
                  >
                    <Trash2 size={14} />
                    Excluir
                  </button>
                )}
              </div>
            </div>

            <div className={`meta-comment-dm-editor-state ${campaignForm.id ? 'editing' : 'new'}`}>
              <strong>{campaignForm.id ? 'Modo edicao' : 'Novo cadastro'}</strong>
              <span>{platformLabel[campaignForm.platform]} | {campaignForm.status} | {campaignForm.mode}</span>
            </div>

            <label>
              Plataforma
              <select
                value={campaignForm.platform}
                onChange={event => {
                  const platform = event.target.value as CampaignForm['platform']
                  setCampaignForm({ ...campaignForm, platform, media_external_id: '', post_permalink: '' })
                  setCommentDmMedia([])
                  setCommentDmMessage(platform === 'facebook'
                    ? 'Facebook selecionado. Atualize os posts para escolher o alvo.'
                    : 'Instagram selecionado. Atualize os posts/reels para escolher o alvo.')
                }}
              >
                <option value="instagram">Instagram Direct</option>
                <option value="facebook">Facebook Messenger</option>
              </select>
            </label>

            <div className={`meta-comment-dm-target ${campaignForm.media_external_id ? 'selected' : ''}`}>
              <Target size={16} />
              <div>
                <strong>{campaignForm.media_external_id ? 'Campanha limitada a uma midia' : 'Campanha para todas as midias da plataforma'}</strong>
                <span>{campaignForm.media_external_id || 'Escolha um criativo/post ao lado para limitar o disparo.'}</span>
              </div>
              {campaignForm.media_external_id && (
                <button type="button" onClick={clearCommentDmTarget}>
                  Limpar alvo
                </button>
              )}
            </div>

            <label>
              Nome
              <input
                value={campaignForm.name}
                onChange={event => setCampaignForm({ ...campaignForm, name: event.target.value })}
                placeholder="Corretor Nota 8"
              />
            </label>

            <div className="meta-comment-dm-two">
              <label>
                ID da midia alvo
                <input
                  value={campaignForm.media_external_id}
                  onChange={event => setCampaignForm({ ...campaignForm, media_external_id: event.target.value })}
                  placeholder="Cole o ID do post/reel"
                />
                <small className="meta-comment-dm-helper">
                  Vazio = todas as midias. Para um video especifico, use o botao Usar midia nos comentarios abaixo.
                </small>
              </label>
              <label>
                Confiança
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={campaignForm.confidence_threshold}
                  onChange={event => setCampaignForm({ ...campaignForm, confidence_threshold: Number(event.target.value || 72) })}
                />
              </label>
            </div>

            <label>
              Intencao
              <textarea
                rows={3}
                value={campaignForm.trigger_intent}
                onChange={event => setCampaignForm({ ...campaignForm, trigger_intent: event.target.value })}
              />
            </label>

            <label>
              Frases gatilho
              <textarea
                rows={3}
                value={campaignForm.trigger_examples}
                onChange={event => setCampaignForm({ ...campaignForm, trigger_examples: event.target.value })}
                placeholder={'nota 8\ncorretor nota 8\nquero a ferramenta'}
              />
              <small className="meta-comment-dm-helper">
                Uma frase por linha. Use aqui o que a pessoa pode comentar para receber a mensagem.
              </small>
            </label>

            <label>
              Mensagem no Direct
              <textarea
                rows={4}
                value={campaignForm.reply_message}
                onChange={event => setCampaignForm({ ...campaignForm, reply_message: event.target.value })}
              />
            </label>

            <label>
              Fluxo do Direct
              <select
                value={campaignForm.flow_type}
                onChange={event => setCampaignForm({ ...campaignForm, flow_type: event.target.value as CampaignForm['flow_type'] })}
              >
                <option value="vote_discount">Votacao + livro</option>
                <option value="simple_link">Mensagem com botao simples</option>
              </select>
            </label>

            {campaignForm.flow_type === 'simple_link' ? (
              <label>
                Link do botao
                <input
                  value={campaignForm.button_url}
                  onChange={event => setCampaignForm({ ...campaignForm, button_url: event.target.value })}
                  placeholder="https://..."
                />
                <small className="meta-comment-dm-helper">
                  Este campo vira o botao da mensagem. Deixe o texto sem link para o Direct ficar limpo.
                </small>
              </label>
            ) : (
              <div className="meta-comment-dm-flow-box">
                <div className="meta-comment-dm-flow-title">
                  <MousePointerClick size={16} />
                  <strong>Botoes iniciais</strong>
                </div>
                <div className="meta-comment-dm-two even">
                  <label>
                    Botao 1
                    <input
                      value={campaignForm.initial_button_voted_label}
                      maxLength={20}
                      onChange={event => setCampaignForm({ ...campaignForm, initial_button_voted_label: event.target.value })}
                    />
                  </label>
                  <label>
                    Botao 2
                    <input
                      value={campaignForm.initial_button_vote_label}
                      maxLength={20}
                      onChange={event => setCampaignForm({ ...campaignForm, initial_button_vote_label: event.target.value })}
                    />
                  </label>
                </div>

                <div className="meta-comment-dm-flow-title">
                  <ShoppingCart size={16} />
                  <strong>Se clicar em Ja votei</strong>
                </div>
                <label>
                  Mensagem do desconto
                  <textarea
                    rows={3}
                    value={campaignForm.voted_message}
                    onChange={event => setCampaignForm({ ...campaignForm, voted_message: event.target.value })}
                  />
                </label>
                <div className="meta-comment-dm-two">
                  <label>
                    Link do livro
                    <input
                      value={campaignForm.discount_button_url}
                      onChange={event => setCampaignForm({ ...campaignForm, discount_button_url: event.target.value })}
                      placeholder="https://..."
                    />
                  </label>
                  <label>
                    Botao
                    <input
                      value={campaignForm.discount_button_title}
                      maxLength={20}
                      onChange={event => setCampaignForm({ ...campaignForm, discount_button_title: event.target.value })}
                    />
                  </label>
                </div>

                <div className="meta-comment-dm-flow-title">
                  <ExternalLink size={16} />
                  <strong>Se clicar em Vou votar</strong>
                </div>
                <label>
                  Mensagem de votacao
                  <textarea
                    rows={3}
                    value={campaignForm.vote_message}
                    onChange={event => setCampaignForm({ ...campaignForm, vote_message: event.target.value })}
                  />
                </label>
                <div className="meta-comment-dm-two">
                  <label>
                    Link da votacao
                    <input
                      value={campaignForm.vote_url}
                      onChange={event => setCampaignForm({ ...campaignForm, vote_url: event.target.value })}
                      placeholder="https://..."
                    />
                  </label>
                  <label>
                    Botao
                    <input
                      value={campaignForm.vote_button_title}
                      maxLength={20}
                      onChange={event => setCampaignForm({ ...campaignForm, vote_button_title: event.target.value })}
                    />
                  </label>
                </div>

                <div className="meta-comment-dm-flow-title with-control">
                  <span>
                    <Clock size={16} />
                    <strong>Follow-up automatico</strong>
                  </span>
                  <label className="meta-comment-dm-check">
                    <input
                      type="checkbox"
                      checked={campaignForm.followup_enabled}
                      onChange={event => setCampaignForm({ ...campaignForm, followup_enabled: event.target.checked })}
                    />
                    Ativo
                  </label>
                </div>
                <div className="meta-comment-dm-two">
                  <label>
                    Mensagem depois do atraso
                    <textarea
                      rows={3}
                      value={campaignForm.followup_message}
                      onChange={event => setCampaignForm({ ...campaignForm, followup_message: event.target.value })}
                    />
                  </label>
                  <label>
                    Minutos
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      value={campaignForm.followup_delay_minutes}
                      onChange={event => setCampaignForm({ ...campaignForm, followup_delay_minutes: Number(event.target.value || 3) })}
                    />
                  </label>
                </div>
                <label>
                  Texto do botao do follow-up
                  <input
                    value={campaignForm.followup_button_title}
                    maxLength={20}
                    onChange={event => setCampaignForm({ ...campaignForm, followup_button_title: event.target.value })}
                  />
                  <small className="meta-comment-dm-helper">
                    O follow-up usa o mesmo link do livro cadastrado acima.
                  </small>
                </label>
              </div>
            )}

            <div className="meta-comment-dm-two">
              <label>
                Modo
                <select
                  value={campaignForm.mode}
                  onChange={event => setCampaignForm({ ...campaignForm, mode: event.target.value as CampaignForm['mode'] })}
                >
                  <option value="manual">Manual</option>
                  <option value="auto">Automatico</option>
                </select>
              </label>
              <label>
                Status
                <select
                  value={campaignForm.status}
                  onChange={event => setCampaignForm({ ...campaignForm, status: event.target.value as CampaignForm['status'] })}
                >
                  <option value="draft">Rascunho</option>
                  <option value="active">Ativa</option>
                  <option value="paused">Pausada</option>
                  <option value="archived">Arquivada</option>
                </select>
              </label>
            </div>

            <div className="meta-comment-dm-actions">
              <button type="submit" disabled={savingCampaign}>
                <CheckCircle2 size={16} />
                {savingCampaign ? 'Salvando...' : campaignForm.id ? 'Salvar alteracoes' : 'Criar campanha'}
              </button>
              <button
                type="button"
                onClick={startNewCommentDmCampaign}
              >
                Limpar formulario
              </button>
              {selectedCommentDmCampaign && (
                <button
                  type="button"
                  className="danger"
                  onClick={() => deleteCommentDmCampaign(selectedCommentDmCampaign)}
                  disabled={deletingCampaignId === selectedCommentDmCampaign.id}
                >
                  <Trash2 size={16} />
                  Excluir esta campanha
                </button>
              )}
            </div>
          </form>

          <div className="meta-comment-dm-side">
            <div className="meta-comment-dm-toolbar">
              <button type="button" onClick={startNewCommentDmCampaign}>
                <Plus size={16} />
                Nova campanha
              </button>
              <button type="button" onClick={processCommentDm} disabled={processingCommentDm}>
                <Play size={16} className={processingCommentDm ? 'spin' : ''} />
                {processingCommentDm ? 'Processando...' : 'Processar recentes'}
              </button>
              <button type="button" onClick={() => loadCommentDmMedia(true)} disabled={loadingMedia}>
                <RefreshCw size={16} className={loadingMedia ? 'spin' : ''} />
                {loadingMedia ? 'Atualizando...' : campaignForm.platform === 'facebook' ? 'Atualizar posts Facebook' : 'Atualizar posts/reels'}
              </button>
              {commentDmMessage && <span>{commentDmMessage}</span>}
            </div>

            <div className="meta-comment-dm-media-picker">
              <div className="meta-comment-dm-subtitle">
                <Film size={16} />
                <strong>{campaignForm.platform === 'facebook' ? 'Escolher post Facebook alvo' : 'Escolher criativo/reel alvo'}</strong>
              </div>
              <div className="meta-comment-dm-media-list">
                {commentDmMedia.slice(0, 8).map(media => (
                  <article
                    key={media.id}
                    className={`meta-comment-dm-media ${campaignForm.media_external_id === media.external_id ? 'active' : ''}`}
                  >
                    <div className="meta-comment-dm-media-info">
                      {(media.thumbnail_url || media.media_url) ? (
                        <img src={media.thumbnail_url || media.media_url || ''} alt="" />
                      ) : (
                        <span className="meta-comment-dm-thumb">
                          <Film size={18} />
                        </span>
                      )}
                      <span>
                        <strong>{platformLabel[media.platform]} | {mediaKind(media)} | {formatDate(media.published_at)}</strong>
                        <p>{shortText(media.caption)}</p>
                        <small>{media.comments_count || 0} comentarios | ID {media.external_id}</small>
                      </span>
                    </div>
                    <div className="meta-comment-dm-media-actions">
                      <button type="button" onClick={() => selectCommentDmMedia(media)}>
                        <Target size={14} />
                        Usar como alvo
                      </button>
                      <button type="button" onClick={() => startCampaignFromMedia(media)}>
                        <Plus size={14} />
                        Nova campanha nesta midia
                      </button>
                      {media.permalink && (
                        <a href={media.permalink} target="_blank" rel="noreferrer">
                          <ExternalLink size={14} />
                          Abrir
                        </a>
                      )}
                    </div>
                  </article>
                ))}
                {commentDmMedia.length === 0 && (
                  <div className="meta-inbox-empty">
                    Clique em Atualizar posts para carregar midias recentes de {platformLabel[campaignForm.platform]}.
                  </div>
                )}
              </div>
            </div>

            <div className="meta-comment-dm-campaigns">
              {commentDmCampaigns.slice(0, 8).map(campaign => (
                <article
                  key={campaign.id}
                  className={`meta-comment-dm-campaign status-${campaign.status}`}
                >
                  <button type="button" className="edit" onClick={() => editCommentDmCampaign(campaign)}>
                    <strong>{campaign.name}</strong>
                    <span>{platformLabel[campaign.platform]} | {campaign.status} | {campaign.mode} | {campaign.confidence_threshold}%</span>
                    <small>{campaignFlowSummary(campaign)}</small>
                    <small>{campaign.media_external_id ? `Midia ${campaign.media_external_id}` : 'Todas as midias (igual automacao global)'}</small>
                    <em>Editar campanha</em>
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => deleteCommentDmCampaign(campaign)}
                    disabled={deletingCampaignId === campaign.id}
                    title="Excluir campanha"
                  >
                    <Trash2 size={15} />
                    Excluir
                  </button>
                </article>
              ))}
              {commentDmCampaigns.length === 0 && (
                <div className="meta-inbox-empty">Nenhuma campanha cadastrada.</div>
              )}
            </div>

            <div className="meta-comment-dm-history">
              <div className="meta-comment-dm-history-head">
                <span>
                  <MessageSquareText size={16} />
                  <strong>Historico de automacao</strong>
                </span>
                <small>
                  {commentDmDeliveries.length} carregadas de {totalDmDeliveries}
                </small>
              </div>

              <div className="meta-comment-dm-history-stats">
                <span><strong>{sentDmDeliveries}</strong> enviadas</span>
                <span><strong>{pendingDmDeliveries}</strong> pendentes</span>
                <span><strong>{errorDmDeliveries}</strong> erros</span>
                <span><strong>{skippedDmDeliveries}</strong> ignoradas</span>
              </div>

              <div className="meta-comment-dm-filters">
                {commentDmDeliveryFilters.map(filter => (
                  <button
                    key={filter.key}
                    type="button"
                    className={commentDmStatusFilter === filter.key ? 'active' : ''}
                    onClick={() => setCommentDmStatusFilter(filter.key)}
                  >
                    {filter.label}
                    <span>{filter.count}</span>
                  </button>
                ))}
              </div>

              <div className="meta-comment-dm-deliveries">
                {filteredCommentDmDeliveries.map(delivery => {
                  const campaign = campaignById.get(delivery.campaign_id)
                  const eventDate = delivery.sent_at || delivery.processed_at || delivery.updated_at
                  return (
                    <article key={delivery.id} className={`meta-comment-dm-delivery send-${delivery.send_status}`}>
                      <div className="meta-comment-dm-delivery-main">
                        <span>
                          <strong>{deliveryAuthorName(delivery)}</strong>
                          <small>{campaign?.name || 'Campanha removida'}</small>
                        </span>
                        <em>{deliveryStatusLabel[delivery.send_status] || delivery.send_status}</em>
                      </div>

                      <div className="meta-comment-dm-delivery-meta">
                        <span>{formatDate(eventDate)}</span>
                        <span>{platformLabel[delivery.platform]}</span>
                        <span>{delivery.ai_confidence}% IA</span>
                        <span>{deliveryDecisionLabel[delivery.decision] || delivery.decision}</span>
                        {delivery.media_external_id && <span>Midia {delivery.media_external_id}</span>}
                      </div>

                      <p className="meta-comment-dm-comment">{delivery.comment_text || 'Comentario sem texto.'}</p>

                      {delivery.reply_message && (
                        <details className="meta-comment-dm-reply">
                          <summary>Ver mensagem enviada</summary>
                          <p>{delivery.reply_message}</p>
                        </details>
                      )}

                      {delivery.ai_reason && (
                        <details className="meta-comment-dm-note">
                          <summary>Motivo da IA</summary>
                          <small className="meta-comment-dm-reason">{delivery.ai_reason}</small>
                        </details>
                      )}
                      {delivery.error && (
                        <details className="meta-comment-dm-note error">
                          <summary>Ver erro</summary>
                          <small className="meta-comment-dm-error">{delivery.error}</small>
                        </details>
                      )}
                      {campaign?.post_permalink && (
                        <a className="meta-comment-dm-link" href={campaign.post_permalink} target="_blank" rel="noreferrer">
                          <ExternalLink size={13} />
                          Abrir midia alvo
                        </a>
                      )}
                    </article>
                  )
                })}
                {filteredCommentDmDeliveries.length === 0 && (
                  <div className="meta-inbox-empty">Nenhum registro neste filtro ainda.</div>
                )}
              </div>

              {commentDmDeliveries.length < totalDmDeliveries && (
                <button type="button" className="meta-comment-dm-load-more" onClick={loadMoreCommentDmHistory}>
                  Carregar mais historico
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

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
            <strong>{hiddenAutomationReplies > 0 ? `${filteredComments.length} visiveis | ${hiddenAutomationReplies} respostas ocultas` : filteredComments.length}</strong>
          </div>
          <div className="meta-inbox-list">
            {filteredComments.slice(0, 45).map(comment => (
              <article
                key={comment.id}
                className="meta-inbox-comment"
              >
                <div>
                  <div className="meta-inbox-row-head">
                    <strong>{comment.author_name || 'Autor nao identificado'}</strong>
                    <PlatformBadge platform={comment.platform} />
                  </div>
                  <p>{comment.message || 'Comentario sem texto.'}</p>
                  <span>
                    {formatDate(comment.commented_at)} | {comment.like_count} curtidas | {comment.reply_count} respostas
                    {comment.media_external_id ? ` | Midia ${comment.media_external_id}` : ''}
                  </span>
                  <div className="meta-inbox-comment-actions">
                    {comment.media_external_id && (
                      <button
                        type="button"
                        onClick={() => handleCommentMediaAsTarget(comment)}
                      >
                        <Target size={14} />
                        Usar midia
                      </button>
                    )}
                    {comment.permalink && (
                      <a href={comment.permalink} target="_blank" rel="noreferrer">
                        Abrir
                      </a>
                    )}
                  </div>
                </div>
              </article>
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
        .meta-inbox-page {
          min-height: 100vh;
          color: var(--text-primary);
        }
        .meta-inbox-page .admin-header {
          position: sticky;
          top: 0;
          z-index: 12;
          align-items: center;
          padding: 12px 0;
          background: color-mix(in srgb, var(--bg-primary) 92%, transparent);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(17, 24, 39, .08);
        }
        .meta-inbox-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .meta-suite-app {
          border: 1px solid rgba(17, 24, 39, .1);
          border-radius: 0 0 8px 8px;
          background: #fff;
          min-height: 680px;
          overflow: hidden;
          box-shadow: 0 14px 38px rgba(17, 24, 39, .06);
        }
        .meta-suite-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          border-bottom: 1px solid rgba(17, 24, 39, .1);
          background: linear-gradient(90deg, rgba(250, 247, 239, .72), rgba(255, 255, 255, .94));
        }
        .meta-suite-metrics > div {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
          padding: 12px 16px;
          border-right: 1px solid rgba(17, 24, 39, .08);
          color: var(--text-primary);
        }
        .meta-suite-metrics > div:last-child {
          border-right: 0;
        }
        .meta-suite-metrics svg {
          color: var(--gold);
          flex: 0 0 auto;
        }
        .meta-suite-metrics .warn svg {
          color: #d97706;
        }
        .meta-suite-metrics span {
          display: grid;
          gap: 2px;
          min-width: 0;
        }
        .meta-suite-metrics strong {
          font-size: .78rem;
          font-weight: 900;
        }
        .meta-suite-metrics small {
          color: var(--text-muted);
          font-size: .68rem;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .meta-suite-workspace {
          display: grid;
          grid-template-columns: 348px minmax(420px, 1fr) 366px;
          height: calc(100vh - 220px);
          min-height: 660px;
          background: #f3f5f7;
        }
        .meta-suite-left,
        .meta-suite-center,
        .meta-suite-right {
          min-width: 0;
          min-height: 0;
        }
        .meta-suite-left {
          display: grid;
          grid-template-rows: auto auto minmax(0, 1fr);
          border-right: 1px solid rgba(17, 24, 39, .12);
          background: #fff;
        }
        .meta-suite-search {
          padding: 12px 14px 8px;
        }
        .meta-suite-search input {
          width: 100%;
          height: 38px;
          border: 1px solid rgba(148, 163, 184, .55);
          border-radius: 6px;
          background: #fff;
          color: var(--text-primary);
          padding: 0 12px;
          font-size: .84rem;
          outline: none;
        }
        .meta-suite-search input:focus {
          border-color: rgba(201, 169, 110, .8);
          box-shadow: 0 0 0 3px rgba(201, 169, 110, .13);
        }
        .meta-suite-filter-row {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          padding: 0 14px 10px;
          scrollbar-width: thin;
        }
        .meta-suite-filter-row button {
          border: 1px solid transparent;
          border-radius: 6px;
          background: rgba(17, 24, 39, .05);
          color: var(--text-primary);
          padding: 7px 9px;
          font-size: .72rem;
          font-weight: 800;
          white-space: nowrap;
          cursor: pointer;
        }
        .meta-suite-filter-row button.active {
          border-color: rgba(201, 169, 110, .3);
          background: rgba(201, 169, 110, .15);
          color: var(--gold);
        }
        .meta-suite-list {
          overflow-y: auto;
          scrollbar-width: thin;
          padding-bottom: 10px;
        }
        .meta-suite-list-item {
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr);
          gap: 10px;
          width: 100%;
          border: 0;
          border-left: 4px solid transparent;
          border-bottom: 1px solid rgba(17, 24, 39, .07);
          background: #fff;
          color: var(--text-primary);
          padding: 12px 12px 12px 10px;
          text-align: left;
          cursor: pointer;
        }
        .meta-suite-list-item:hover,
        .meta-suite-list-item.active {
          background: rgba(201, 169, 110, .1);
          border-left-color: var(--gold);
        }
        .meta-suite-list-item.tone-danger {
          border-left-color: #ef4444;
        }
        .meta-suite-list-item.tone-warning {
          border-left-color: #d97706;
        }
        .meta-suite-list-item.tone-success.active,
        .meta-suite-list-item.tone-success:hover {
          border-left-color: #16a34a;
        }
        .meta-suite-avatar {
          width: 42px;
          height: 42px;
          display: inline-grid;
          place-items: center;
          border-radius: 999px;
          background: rgba(201, 169, 110, .16);
          color: var(--gold);
          font-size: .78rem;
          font-weight: 900;
          flex: 0 0 auto;
        }
        .meta-suite-avatar.facebook {
          background: rgba(24, 119, 242, .1);
          color: #1877f2;
        }
        .meta-suite-avatar.instagram {
          background: rgba(193, 53, 132, .1);
          color: #c13584;
        }
        .meta-suite-avatar.large {
          width: 50px;
          height: 50px;
          font-size: .86rem;
        }
        .meta-suite-list-copy {
          display: grid;
          gap: 5px;
          min-width: 0;
        }
        .meta-suite-list-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          min-width: 0;
        }
        .meta-suite-list-head strong {
          min-width: 0;
          color: var(--text-primary);
          font-size: .84rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .meta-suite-list-head em {
          color: var(--text-muted);
          font-size: .68rem;
          font-style: normal;
          white-space: nowrap;
        }
        .meta-suite-list-preview {
          color: var(--text-primary);
          font-size: .75rem;
          line-height: 1.35;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .meta-suite-list-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
        }
        .meta-suite-list-meta small {
          min-width: 0;
          color: var(--text-muted);
          font-size: .66rem;
          font-weight: 800;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .meta-suite-center {
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          border-right: 1px solid rgba(17, 24, 39, .12);
          background: #f3f5f7;
        }
        .meta-suite-center-head {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 72px;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(17, 24, 39, .1);
          background: #fff;
        }
        .meta-suite-center-head > div {
          display: grid;
          gap: 2px;
          min-width: 0;
          margin-right: auto;
        }
        .meta-suite-center-head strong {
          color: var(--text-primary);
          font-size: 1rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .meta-suite-center-head span {
          color: var(--text-muted);
          font-size: .72rem;
          font-weight: 800;
        }
        .meta-suite-status {
          border-radius: 999px;
          background: rgba(148, 163, 184, .12);
          color: var(--text-muted);
          padding: 5px 8px;
          font-size: .68rem;
          font-style: normal;
          font-weight: 900;
          white-space: nowrap;
        }
        .meta-suite-status.tone-success {
          background: rgba(22, 163, 74, .11);
          color: #16a34a;
        }
        .meta-suite-status.tone-warning {
          background: rgba(217, 119, 6, .11);
          color: #d97706;
        }
        .meta-suite-status.tone-danger {
          background: rgba(239, 68, 68, .1);
          color: #dc2626;
        }
        .meta-suite-status.tone-ai {
          background: rgba(201, 169, 110, .14);
          color: var(--gold);
        }
        .meta-suite-center-scroll {
          overflow-y: auto;
          scrollbar-width: thin;
          padding: 18px 22px 28px;
        }
        .meta-suite-chat,
        .meta-suite-detail {
          display: grid;
          gap: 12px;
          max-width: 760px;
          margin: 0 auto;
        }
        .meta-suite-date {
          justify-self: center;
          border-radius: 999px;
          background: rgba(17, 24, 39, .06);
          color: var(--text-muted);
          padding: 5px 9px;
          font-size: .7rem;
          font-weight: 800;
        }
        .meta-suite-bubble {
          display: grid;
          gap: 4px;
          width: fit-content;
          max-width: min(620px, 82%);
          border-radius: 16px;
          background: #fff;
          color: var(--text-primary);
          padding: 10px 12px;
          box-shadow: 0 8px 18px rgba(17, 24, 39, .06);
        }
        .meta-suite-bubble.outbound {
          justify-self: end;
          background: rgba(201, 169, 110, .18);
        }
        .meta-suite-bubble strong,
        .meta-suite-message-card small {
          color: var(--text-muted);
          font-size: .68rem;
          font-weight: 900;
        }
        .meta-suite-bubble p,
        .meta-suite-message-card p,
        .meta-suite-details p,
        .meta-suite-recommendation {
          margin: 0;
          color: var(--text-primary);
          font-size: .84rem;
          line-height: 1.48;
          overflow-wrap: anywhere;
          white-space: pre-wrap;
        }
        .meta-suite-bubble small {
          color: var(--text-muted);
          font-size: .64rem;
        }
        .meta-suite-message-card {
          display: grid;
          gap: 7px;
          border: 1px solid rgba(17, 24, 39, .08);
          border-radius: 8px;
          background: #fff;
          padding: 13px;
          box-shadow: 0 8px 18px rgba(17, 24, 39, .04);
        }
        .meta-suite-message-card.inbound {
          border-left: 4px solid var(--gold);
        }
        .meta-suite-message-card.outbound {
          border-left: 4px solid #16a34a;
          background: rgba(250, 247, 239, .95);
        }
        .meta-suite-meta-line,
        .meta-suite-detail-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .meta-suite-meta-line span {
          border-radius: 999px;
          background: rgba(17, 24, 39, .06);
          color: var(--text-muted);
          padding: 5px 8px;
          font-size: .68rem;
          font-weight: 900;
        }
        .meta-suite-detail-actions button,
        .meta-suite-detail-actions a,
        .meta-suite-link,
        .meta-suite-load {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 1px solid rgba(201, 169, 110, .35);
          border-radius: 6px;
          background: rgba(201, 169, 110, .12);
          color: var(--gold);
          padding: 8px 10px;
          font-size: .72rem;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
        }
        .meta-suite-detail-actions button:disabled {
          cursor: not-allowed;
          opacity: .55;
        }
        .meta-suite-details {
          border: 1px solid rgba(17, 24, 39, .08);
          border-radius: 8px;
          background: rgba(255, 255, 255, .82);
          padding: 9px 11px;
        }
        .meta-suite-details.error {
          border-color: rgba(239, 68, 68, .18);
          background: rgba(239, 68, 68, .06);
        }
        .meta-suite-details summary {
          color: var(--text-muted);
          cursor: pointer;
          font-size: .72rem;
          font-weight: 900;
        }
        .meta-suite-related {
          display: grid;
          gap: 8px;
          border-top: 1px solid rgba(17, 24, 39, .08);
          padding-top: 12px;
        }
        .meta-suite-related > strong {
          color: var(--text-primary);
          font-size: .78rem;
        }
        .meta-suite-related button {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          border: 1px solid rgba(17, 24, 39, .08);
          border-radius: 8px;
          background: #fff;
          color: var(--text-primary);
          padding: 9px 10px;
          font-size: .76rem;
          font-weight: 900;
          text-align: left;
          cursor: pointer;
        }
        .meta-suite-related span {
          color: var(--text-muted);
          font-size: .68rem;
          white-space: nowrap;
        }
        .meta-suite-right {
          display: grid;
          grid-template-rows: auto auto auto auto auto minmax(0, 1fr);
          gap: 12px;
          overflow-y: auto;
          scrollbar-width: thin;
          padding: 14px;
          background: #fff;
        }
        .meta-suite-profile {
          display: flex;
          align-items: center;
          gap: 11px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(17, 24, 39, .08);
        }
        .meta-suite-profile > div {
          display: grid;
          gap: 2px;
          min-width: 0;
        }
        .meta-suite-profile strong {
          color: var(--text-primary);
          font-size: .92rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .meta-suite-profile span:not(.meta-suite-avatar) {
          color: var(--text-muted);
          font-size: .72rem;
          font-weight: 800;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .meta-suite-action-row,
        .meta-suite-form-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .meta-suite-action-row button,
        .meta-suite-form-actions button,
        .meta-suite-panel-title button,
        .meta-suite-campaign > button.danger,
        .meta-suite-media-list article > button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border: 1px solid rgba(201, 169, 110, .35);
          border-radius: 6px;
          background: rgba(201, 169, 110, .12);
          color: var(--gold);
          padding: 7px 9px;
          font-size: .7rem;
          font-weight: 900;
          cursor: pointer;
        }
        .meta-suite-action-row button:disabled,
        .meta-suite-form-actions button:disabled,
        .meta-suite-panel-title button:disabled,
        .meta-suite-campaign > button:disabled,
        .meta-suite-media-list article > button:disabled {
          cursor: not-allowed;
          opacity: .55;
        }
        .meta-suite-toast {
          border-radius: 8px;
          background: rgba(22, 163, 74, .1);
          color: #15803d;
          padding: 9px 10px;
          font-size: .72rem;
          font-weight: 900;
        }
        .meta-suite-compact-form {
          display: grid;
          gap: 10px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(17, 24, 39, .08);
        }
        .meta-suite-panel-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .meta-suite-panel-title span {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: var(--text-primary);
          font-size: .82rem;
          font-weight: 900;
        }
        .meta-suite-panel-title svg {
          color: var(--gold);
        }
        .meta-suite-panel-title button.danger,
        .meta-suite-campaign > button.danger {
          border-color: rgba(239, 68, 68, .25);
          background: rgba(239, 68, 68, .08);
          color: #dc2626;
        }
        .meta-suite-compact-form label {
          display: grid;
          gap: 5px;
          color: var(--text-muted);
          font-size: .66rem;
          font-weight: 900;
          text-transform: uppercase;
        }
        .meta-suite-compact-form input,
        .meta-suite-compact-form textarea,
        .meta-suite-compact-form select {
          width: 100%;
          border: 1px solid rgba(148, 163, 184, .45);
          border-radius: 6px;
          background: #fff;
          color: var(--text-primary);
          padding: 8px 9px;
          font-size: .78rem;
          line-height: 1.35;
          outline: none;
        }
        .meta-suite-compact-form textarea {
          min-height: 78px;
          resize: vertical;
        }
        .meta-suite-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
        }
        .meta-suite-compact-form .meta-comment-dm-flow-box {
          margin-top: 2px;
        }
        .meta-suite-compact-form .meta-comment-dm-two {
          grid-template-columns: minmax(0, 1fr) minmax(82px, .42fr);
          gap: 8px;
        }
        .meta-suite-compact-form .meta-comment-dm-two.even {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .meta-suite-compact-form .meta-comment-dm-flow-title {
          text-transform: none;
        }
        .meta-suite-compact-form .meta-comment-dm-check {
          display: inline-flex;
          grid-template-columns: unset;
          align-items: center;
          gap: 6px;
          color: var(--text-muted);
          font-size: .68rem;
          letter-spacing: 0;
          text-transform: none;
          cursor: pointer;
        }
        .meta-suite-compact-form .meta-comment-dm-check input {
          width: 16px;
          height: 16px;
          padding: 0;
          accent-color: var(--gold);
        }
        .meta-suite-side-section {
          border-bottom: 1px solid rgba(17, 24, 39, .08);
          padding-bottom: 10px;
        }
        .meta-suite-side-section summary {
          color: var(--text-primary);
          cursor: pointer;
          font-size: .78rem;
          font-weight: 900;
          margin-bottom: 9px;
        }
        .meta-suite-campaign-list,
        .meta-suite-media-list {
          display: grid;
          gap: 8px;
        }
        .meta-suite-campaign {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 34px;
          gap: 7px;
          border: 1px solid rgba(17, 24, 39, .08);
          border-radius: 8px;
          padding: 8px;
          background: rgba(250, 247, 239, .45);
        }
        .meta-suite-campaign.status-active {
          border-color: rgba(22, 163, 74, .24);
        }
        .meta-suite-campaign > button:first-child {
          display: grid;
          gap: 3px;
          border: 0;
          background: transparent;
          color: var(--text-primary);
          padding: 0;
          text-align: left;
          cursor: pointer;
        }
        .meta-suite-campaign strong,
        .meta-suite-media-list strong {
          color: var(--text-primary);
          font-size: .76rem;
        }
        .meta-suite-campaign span,
        .meta-suite-campaign small,
        .meta-suite-media-list small {
          color: var(--text-muted);
          font-size: .66rem;
          font-weight: 800;
        }
        .meta-suite-media-list article {
          display: grid;
          grid-template-columns: 44px minmax(0, 1fr) 34px;
          gap: 8px;
          align-items: center;
          border: 1px solid rgba(17, 24, 39, .08);
          border-radius: 8px;
          background: #fff;
          padding: 7px;
        }
        .meta-suite-media-list article.active {
          border-color: rgba(22, 163, 74, .35);
          background: rgba(22, 163, 74, .06);
        }
        .meta-suite-media-list img,
        .meta-suite-media-list article > span {
          width: 44px;
          height: 44px;
          border-radius: 6px;
          object-fit: cover;
          background: rgba(201, 169, 110, .12);
          color: var(--gold);
        }
        .meta-suite-media-list article > span {
          display: grid;
          place-items: center;
        }
        .meta-suite-media-list div {
          display: grid;
          gap: 2px;
          min-width: 0;
        }
        .meta-suite-media-list p {
          margin: 0;
          color: var(--text-primary);
          font-size: .7rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .meta-suite-empty {
          border: 1px dashed rgba(148, 163, 184, .5);
          border-radius: 8px;
          color: var(--text-muted);
          padding: 14px;
          font-size: .78rem;
          line-height: 1.4;
          text-align: center;
        }
        .meta-suite-empty.center {
          place-self: center;
          width: min(360px, 90%);
        }
        .meta-suite-tabs {
          position: sticky;
          top: 74px;
          z-index: 11;
          display: flex;
          align-items: center;
          gap: 8px;
          overflow-x: auto;
          margin: 0;
          padding: 10px 12px;
          background: #fff;
          border: 1px solid rgba(17, 24, 39, .1);
          border-bottom: 0;
          border-radius: 8px 8px 0 0;
          backdrop-filter: blur(12px);
          scrollbar-width: thin;
        }
        .meta-suite-tabs button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid transparent;
          border-radius: 8px;
          background: transparent;
          color: var(--text-primary);
          padding: 9px 12px;
          font-size: .78rem;
          font-weight: 900;
          white-space: nowrap;
          cursor: pointer;
        }
        .meta-suite-tabs button.active {
          border-color: rgba(201, 169, 110, .28);
          background: rgba(201, 169, 110, .14);
          color: var(--gold);
        }
        .meta-suite-tabs button span {
          display: inline-grid;
          min-width: 22px;
          height: 22px;
          place-items: center;
          border-radius: 999px;
          background: rgba(17, 24, 39, .08);
          color: inherit;
          padding: 0 6px;
          font-size: .68rem;
        }
        .meta-suite-tabs > span {
          margin-left: auto;
          color: var(--text-muted);
          font-size: .72rem;
          font-weight: 900;
          white-space: nowrap;
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
          border-radius: 8px;
          padding: 12px;
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
        .meta-comment-dm-panel {
          margin-bottom: 18px;
          overflow: hidden;
        }
        .meta-comment-dm-layout {
          display: grid;
          grid-template-columns: minmax(330px, 420px) minmax(0, 1fr);
          gap: 12px;
          align-items: start;
          min-height: 640px;
          height: calc(100vh - 265px);
          max-height: 880px;
          overflow: hidden;
        }
        .meta-comment-dm-form,
        .meta-comment-dm-side {
          display: grid;
          gap: 10px;
          min-height: 0;
        }
        .meta-comment-dm-form {
          border: 1px solid rgba(17, 24, 39, .08);
          border-radius: 8px;
          padding: 12px;
          background: rgba(255, 255, 255, .72);
          align-content: start;
          max-height: 100%;
          overflow-y: auto;
          scrollbar-width: thin;
        }
        .meta-comment-dm-side {
          grid-template-columns: minmax(320px, .9fr) minmax(390px, 1.1fr);
          grid-template-rows: auto minmax(0, 1fr) minmax(150px, .42fr);
          grid-template-areas:
            "toolbar toolbar"
            "media history"
            "campaigns history";
          overflow: hidden;
        }
        .meta-comment-dm-form-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
          color: var(--text-primary);
          font-size: .86rem;
        }
        .meta-comment-dm-form-head > span {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .meta-comment-dm-form-head svg {
          color: var(--gold);
        }
        .meta-comment-dm-form-head-actions {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .meta-comment-dm-form-head-actions button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid rgba(201, 169, 110, .35);
          border-radius: 999px;
          background: rgba(201, 169, 110, .1);
          color: var(--gold);
          padding: 6px 9px;
          font-size: .68rem;
          font-weight: 900;
          cursor: pointer;
        }
        .meta-comment-dm-form-head-actions button.danger,
        .meta-comment-dm-actions button.danger {
          border-color: rgba(220, 38, 38, .28);
          background: rgba(220, 38, 38, .08);
          color: #b91c1c;
        }
        .meta-comment-dm-form-head-actions button.danger svg,
        .meta-comment-dm-actions button.danger svg {
          color: #b91c1c;
        }
        .meta-comment-dm-form-head-actions button:disabled {
          cursor: not-allowed;
          opacity: .58;
        }
        .meta-comment-dm-editor-state {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          border: 1px solid rgba(148, 163, 184, .22);
          border-radius: 10px;
          background: rgba(148, 163, 184, .07);
          color: var(--text-muted);
          padding: 8px 10px;
          font-size: .7rem;
          font-weight: 900;
        }
        .meta-comment-dm-editor-state strong {
          color: var(--text-primary);
        }
        .meta-comment-dm-editor-state.editing {
          border-color: rgba(201, 169, 110, .35);
          background: rgba(201, 169, 110, .1);
        }
        .meta-comment-dm-target {
          display: grid;
          grid-template-columns: 18px minmax(0, 1fr) auto;
          gap: 9px;
          align-items: center;
          border: 1px dashed var(--border-color);
          border-radius: 8px;
          padding: 10px;
          background: rgba(148, 163, 184, .06);
          color: var(--text-muted);
        }
        .meta-comment-dm-target.selected {
          border-color: rgba(22, 163, 74, .38);
          background: rgba(22, 163, 74, .06);
          color: #15803d;
        }
        .meta-comment-dm-target > svg {
          color: currentColor;
        }
        .meta-comment-dm-target strong {
          display: block;
          color: var(--text-primary);
          font-size: .78rem;
          margin-bottom: 2px;
        }
        .meta-comment-dm-target span {
          display: block;
          color: var(--text-muted);
          font-size: .7rem;
          font-weight: 800;
          overflow-wrap: anywhere;
        }
        .meta-comment-dm-target button {
          border: 1px solid rgba(22, 163, 74, .25);
          border-radius: 999px;
          background: white;
          color: #15803d;
          padding: 6px 9px;
          font-size: .68rem;
          font-weight: 900;
          cursor: pointer;
        }
        .meta-comment-dm-form label {
          display: grid;
          gap: 5px;
          color: var(--text-muted);
          font-size: .68rem;
          font-weight: 900;
          letter-spacing: .04em;
          text-transform: uppercase;
        }
        .meta-comment-dm-helper {
          color: var(--text-muted);
          font-size: .66rem;
          font-weight: 800;
          letter-spacing: 0;
          line-height: 1.35;
          text-transform: none;
        }
        .meta-comment-dm-form input,
        .meta-comment-dm-form textarea,
        .meta-comment-dm-form select {
          width: 100%;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          background: var(--bg-primary);
          color: var(--text-primary);
          padding: 9px 10px;
          font-size: .82rem;
          line-height: 1.35;
          outline: none;
        }
        .meta-comment-dm-form textarea {
          resize: vertical;
          min-height: 72px;
        }
        .meta-comment-dm-two {
          display: grid;
          grid-template-columns: 1fr 120px;
          gap: 10px;
        }
        .meta-comment-dm-two.even {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .meta-comment-dm-flow-box {
          display: grid;
          gap: 10px;
          border: 1px solid rgba(201, 169, 110, .24);
          border-radius: 8px;
          background: rgba(201, 169, 110, .06);
          padding: 10px;
        }
        .meta-comment-dm-flow-title {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--text-primary);
          font-size: .76rem;
          font-weight: 900;
        }
        .meta-comment-dm-flow-title svg {
          color: var(--gold);
        }
        .meta-comment-dm-flow-title.with-control {
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }
        .meta-comment-dm-flow-title.with-control > span,
        .meta-comment-dm-flow-title .meta-comment-dm-check {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .meta-comment-dm-flow-title .meta-comment-dm-check {
          color: var(--text-muted);
          font-size: .68rem;
          letter-spacing: 0;
          text-transform: none;
          cursor: pointer;
        }
        .meta-comment-dm-flow-title .meta-comment-dm-check input {
          width: 16px;
          height: 16px;
          padding: 0;
          accent-color: var(--gold);
        }
        .meta-comment-dm-actions,
        .meta-comment-dm-toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .meta-comment-dm-toolbar {
          grid-area: toolbar;
          position: sticky;
          top: 0;
          z-index: 2;
          padding: 0 0 2px;
          background: rgba(255, 255, 255, .88);
          backdrop-filter: blur(10px);
        }
        .meta-comment-dm-actions button,
        .meta-comment-dm-toolbar button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: 1px solid var(--border-color);
          border-radius: 999px;
          background: var(--bg-primary);
          color: var(--text-primary);
          padding: 8px 11px;
          font-size: .72rem;
          font-weight: 900;
          cursor: pointer;
        }
        .meta-comment-dm-actions button:first-child,
        .meta-comment-dm-toolbar button {
          border-color: rgba(201, 169, 110, .45);
          background: rgba(201, 169, 110, .13);
          color: var(--gold);
        }
        .meta-comment-dm-actions button:disabled,
        .meta-comment-dm-toolbar button:disabled {
          cursor: not-allowed;
          opacity: .58;
        }
        .meta-comment-dm-toolbar span {
          color: var(--text-muted);
          font-size: .76rem;
          font-weight: 800;
        }
        .meta-comment-dm-media-picker {
          grid-area: media;
          display: grid;
          gap: 8px;
          border: 1px solid rgba(17, 24, 39, .08);
          border-radius: 8px;
          padding: 11px;
          background: rgba(255, 255, 255, .72);
          min-height: 0;
          overflow: hidden;
        }
        .meta-comment-dm-subtitle {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-primary);
        }
        .meta-comment-dm-subtitle svg {
          color: var(--gold);
        }
        .meta-comment-dm-subtitle strong {
          font-size: .82rem;
        }
        .meta-comment-dm-media-list {
          display: grid;
          gap: 7px;
          max-height: 100%;
          overflow: auto;
          padding-right: 3px;
          scrollbar-width: thin;
        }
        .meta-comment-dm-media {
          display: grid;
          gap: 9px;
          border: 1px solid rgba(17, 24, 39, .08);
          border-radius: 8px;
          background: var(--bg-primary);
          padding: 7px;
        }
        .meta-comment-dm-media.active {
          border-color: rgba(22, 163, 74, .42);
          background: rgba(22, 163, 74, .06);
        }
        .meta-comment-dm-media-info {
          display: grid;
          grid-template-columns: 52px minmax(0, 1fr);
          align-items: center;
          gap: 9px;
          color: var(--text-primary);
          text-align: left;
        }
        .meta-comment-dm-media img {
          width: 52px;
          height: 52px;
          border-radius: 8px;
          object-fit: cover;
          background: rgba(148, 163, 184, .18);
        }
        .meta-comment-dm-thumb {
          width: 52px;
          height: 52px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          background: rgba(201, 169, 110, .12);
          color: var(--gold);
        }
        .meta-comment-dm-media-info span,
        .meta-comment-dm-media p,
        .meta-comment-dm-media small {
          min-width: 0;
        }
        .meta-comment-dm-media strong {
          display: block;
          color: var(--text-primary);
          font-size: .76rem;
          margin-bottom: 3px;
        }
        .meta-comment-dm-media p {
          margin: 0 0 3px;
          color: var(--text-primary);
          font-size: .74rem;
          line-height: 1.3;
          overflow-wrap: anywhere;
        }
        .meta-comment-dm-media small {
          color: var(--text-muted);
          font-size: .64rem;
          font-weight: 800;
        }
        .meta-comment-dm-media-actions {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
        }
        .meta-comment-dm-media-actions button,
        .meta-comment-dm-media-actions a {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid var(--border-color);
          border-radius: 999px;
          background: white;
          color: var(--text-muted);
          padding: 6px 9px;
          font-size: .66rem;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
        }
        .meta-comment-dm-media-actions button:first-child {
          border-color: rgba(201, 169, 110, .45);
          background: rgba(201, 169, 110, .12);
          color: var(--gold);
        }
        .meta-comment-dm-campaigns,
        .meta-comment-dm-deliveries {
          display: grid;
          gap: 8px;
        }
        .meta-comment-dm-campaigns {
          grid-area: campaigns;
          min-height: 0;
          overflow-y: auto;
          padding-right: 3px;
          scrollbar-width: thin;
        }
        .meta-comment-dm-campaign {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          align-items: stretch;
          width: 100%;
          border: 1px solid rgba(17, 24, 39, .08);
          border-radius: 8px;
          background: rgba(255, 255, 255, .72);
          color: var(--text-primary);
          padding: 8px;
          text-align: left;
        }
        .meta-comment-dm-campaign.status-active {
          border-color: rgba(22, 163, 74, .28);
        }
        .meta-comment-dm-campaign > button.edit {
          border: 0;
          background: transparent;
          color: inherit;
          padding: 3px;
          text-align: left;
          cursor: pointer;
        }
        .meta-comment-dm-campaign > button.danger {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          border: 1px solid rgba(239, 68, 68, .18);
          border-radius: 9px;
          background: rgba(239, 68, 68, .06);
          color: #dc2626;
          padding: 0 10px;
          font-size: .7rem;
          font-weight: 900;
          cursor: pointer;
        }
        .meta-comment-dm-campaign > button:disabled {
          cursor: not-allowed;
          opacity: .55;
        }
        .meta-comment-dm-campaign strong,
        .meta-comment-dm-delivery strong {
          color: var(--text-primary);
          font-size: .86rem;
        }
        .meta-comment-dm-campaign span,
        .meta-comment-dm-campaign small,
        .meta-comment-dm-campaign em,
        .meta-comment-dm-delivery span,
        .meta-comment-dm-delivery small {
          color: var(--text-muted);
          font-size: .7rem;
          font-weight: 800;
        }
        .meta-comment-dm-campaign em {
          display: inline-flex;
          width: fit-content;
          margin-top: 6px;
          border-radius: 999px;
          background: rgba(201, 169, 110, .12);
          color: var(--gold);
          padding: 4px 8px;
          font-style: normal;
        }
        .meta-comment-dm-history {
          grid-area: history;
          display: grid;
          grid-template-rows: auto auto auto minmax(0, 1fr) auto;
          gap: 10px;
          border: 1px solid rgba(17, 24, 39, .08);
          border-radius: 8px;
          background: rgba(255, 255, 255, .78);
          padding: 12px;
          min-height: 0;
          overflow: hidden;
        }
        .meta-comment-dm-history-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .meta-comment-dm-history-head > span {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--text-primary);
        }
        .meta-comment-dm-history-head strong {
          font-size: .88rem;
        }
        .meta-comment-dm-history-head small {
          color: var(--text-muted);
          font-size: .72rem;
          font-weight: 900;
        }
        .meta-comment-dm-history-stats,
        .meta-comment-dm-filters {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
        }
        .meta-comment-dm-history-stats span {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border-radius: 999px;
          background: rgba(148, 163, 184, .1);
          color: var(--text-muted);
          padding: 5px 8px;
          font-size: .68rem;
          font-weight: 900;
        }
        .meta-comment-dm-history-stats strong {
          color: var(--text-primary);
          font-size: .76rem;
        }
        .meta-comment-dm-filters button,
        .meta-comment-dm-load-more {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid var(--border-color);
          border-radius: 999px;
          background: white;
          color: var(--text-muted);
          padding: 7px 10px;
          font-size: .7rem;
          font-weight: 900;
          cursor: pointer;
        }
        .meta-comment-dm-filters button.active {
          border-color: rgba(201, 169, 110, .45);
          background: rgba(201, 169, 110, .14);
          color: var(--gold);
        }
        .meta-comment-dm-filters button span {
          min-width: 22px;
          border-radius: 999px;
          background: rgba(17, 24, 39, .06);
          color: inherit;
          padding: 2px 6px;
          text-align: center;
        }
        .meta-comment-dm-load-more {
          justify-content: center;
          width: 100%;
          border-color: rgba(201, 169, 110, .38);
          background: rgba(201, 169, 110, .12);
          color: var(--gold);
        }
        .meta-comment-dm-history .meta-comment-dm-deliveries {
          max-height: none;
          min-height: 0;
          overflow-y: auto;
          overscroll-behavior: contain;
          padding-right: 4px;
          scrollbar-width: thin;
        }
        .meta-comment-dm-delivery {
          display: grid;
          gap: 7px;
          border: 1px solid rgba(17, 24, 39, .08);
          border-left: 4px solid #94a3b8;
          border-radius: 8px;
          background: rgba(255, 255, 255, .72);
          padding: 10px 11px;
        }
        .meta-comment-dm-delivery.send-sent {
          border-left-color: #16a34a;
        }
        .meta-comment-dm-delivery.send-pending_approval {
          border-left-color: var(--gold);
        }
        .meta-comment-dm-delivery.send-error {
          border-left-color: #ef4444;
        }
        .meta-comment-dm-delivery-main {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .meta-comment-dm-delivery-main > span {
          display: grid;
          gap: 2px;
          min-width: 0;
        }
        .meta-comment-dm-delivery-main em {
          flex: 0 0 auto;
          border-radius: 999px;
          background: rgba(148, 163, 184, .12);
          color: var(--text-muted);
          padding: 4px 8px;
          font-size: .66rem;
          font-style: normal;
          font-weight: 900;
        }
        .meta-comment-dm-delivery.send-sent .meta-comment-dm-delivery-main em {
          background: rgba(22, 163, 74, .12);
          color: #16a34a;
        }
        .meta-comment-dm-delivery.send-pending_approval .meta-comment-dm-delivery-main em {
          background: rgba(201, 169, 110, .13);
          color: var(--gold);
        }
        .meta-comment-dm-delivery.send-error .meta-comment-dm-delivery-main em {
          background: rgba(239, 68, 68, .1);
          color: #dc2626;
        }
        .meta-comment-dm-delivery-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .meta-comment-dm-delivery-meta span {
          border-radius: 999px;
          background: rgba(148, 163, 184, .1);
          padding: 4px 7px;
        }
        .meta-comment-dm-comment {
          margin: 0;
          color: var(--text-primary);
          font-size: .76rem;
          line-height: 1.45;
          overflow-wrap: anywhere;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .meta-comment-dm-reply {
          border: 1px solid rgba(201, 169, 110, .2);
          border-radius: 10px;
          background: rgba(201, 169, 110, .07);
          padding: 8px 10px;
        }
        .meta-comment-dm-reply summary {
          color: var(--gold);
          cursor: pointer;
          font-size: .72rem;
          font-weight: 900;
        }
        .meta-comment-dm-reply p {
          margin-top: 8px;
          white-space: pre-wrap;
          color: var(--text-primary);
          font-size: .74rem;
          line-height: 1.5;
        }
        .meta-comment-dm-note {
          border-radius: 8px;
          background: rgba(148, 163, 184, .08);
          padding: 7px 9px;
        }
        .meta-comment-dm-note.error {
          background: rgba(239, 68, 68, .08);
        }
        .meta-comment-dm-note summary {
          cursor: pointer;
          color: var(--text-muted);
          font-size: .7rem;
          font-weight: 900;
        }
        .meta-comment-dm-note small {
          display: block;
          margin-top: 7px;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }
        .meta-comment-dm-reason {
          color: var(--text-muted);
        }
        .meta-comment-dm-error {
          color: #dc2626;
        }
        .meta-comment-dm-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          width: fit-content;
          color: var(--gold);
          font-size: .7rem;
          font-weight: 900;
          text-decoration: none;
        }
        .meta-ai-panel {
          margin-bottom: 18px;
          overflow: hidden;
        }
        .meta-ai-suggestions {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding-bottom: 3px;
          scrollbar-width: thin;
        }
        .meta-ai-card {
          position: relative;
          display: grid;
          gap: 9px;
          flex: 0 0 278px;
          border: 1px solid rgba(17, 24, 39, .08);
          border-radius: 8px;
          padding: 12px;
          background: rgba(255, 255, 255, .88);
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
          gap: 8px;
          max-height: 520px;
          overflow: auto;
          padding-right: 4px;
          scrollbar-width: thin;
        }
        .meta-inbox-comment,
        .meta-inbox-thread {
          display: block;
          border: 1px solid rgba(17, 24, 39, .08);
          border-radius: 8px;
          padding: 12px;
          background: rgba(255, 255, 255, .88);
          color: var(--text-primary);
          text-decoration: none;
          overflow: hidden;
        }
        .meta-inbox-comment:hover {
          border-color: var(--gold);
        }
        .meta-inbox-comment-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 10px;
        }
        .meta-inbox-comment-actions button,
        .meta-inbox-comment-actions a {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid var(--border-color);
          border-radius: 999px;
          background: var(--bg-primary);
          color: var(--text-primary);
          padding: 6px 9px;
          font-size: .68rem;
          font-weight: 900;
          line-height: 1;
          text-decoration: none;
          cursor: pointer;
        }
        .meta-inbox-comment-actions button {
          border-color: rgba(201, 169, 110, .45);
          background: rgba(201, 169, 110, .12);
          color: var(--gold);
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
          border-radius: 8px;
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
          .meta-comment-dm-layout {
            grid-template-columns: 1fr;
            height: auto;
            max-height: none;
            overflow: visible;
          }
          .meta-comment-dm-form {
            max-height: none;
          }
          .meta-comment-dm-side {
            grid-template-columns: 1fr;
            grid-template-rows: auto;
            grid-template-areas:
              "toolbar"
              "media"
              "campaigns"
              "history";
            overflow: visible;
          }
          .meta-comment-dm-media-list,
          .meta-comment-dm-campaigns,
          .meta-comment-dm-history .meta-comment-dm-deliveries {
            max-height: 420px;
          }
          .meta-inbox-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 560px) {
          .meta-inbox-page .admin-header {
            position: static;
          }
          .meta-suite-tabs {
            top: 0;
          }
          .meta-inbox-status-grid {
            grid-template-columns: 1fr;
          }
          .meta-inbox-list {
            max-height: 560px;
          }
          .meta-comment-dm-two {
            grid-template-columns: 1fr;
          }
          .meta-comment-dm-delivery-main {
            align-items: flex-start;
            flex-direction: column;
          }
        }
        .meta-inbox-status-grid,
        .meta-comment-dm-panel,
        .meta-ai-panel,
        .meta-inbox-grid {
          display: none !important;
        }
      `}</style>
    </div>
  )
}
