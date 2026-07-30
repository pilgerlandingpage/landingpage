'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Edit3,
  FileText,
  ImageIcon,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Video,
} from 'lucide-react'
import AdminLoadingState from '@/components/admin/AdminLoadingState'

type TemplateStatus = 'all' | 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'deleted' | 'drafts'
type HeaderFormat = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
type ButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE'

interface MetaTemplateRow {
  id: string
  template_external_id?: string | null
  name: string
  language: string
  category: string
  status: string
  quality_score?: string | null
  components?: unknown[] | null
  metadata?: unknown
  last_synced_at?: string | null
  updated_at?: string | null
}

interface TemplateDraft {
  id: string
  name: string
  language: string
  category: string
  components: unknown[]
  form?: Partial<TemplateForm>
  created_at: string
  updated_at: string
}

interface ButtonDraft {
  type: ButtonType
  text: string
  url: string
  phoneNumber: string
  example: string
}

interface TemplateForm {
  name: string
  language: string
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  headerFormat: HeaderFormat
  headerText: string
  headerExample: string
  headerMediaHandle: string
  headerMediaUrl: string
  headerMediaR2Key: string
  bodyText: string
  bodyExamples: string
  footerText: string
  buttons: ButtonDraft[]
  messageSendTtlSeconds: string
}

interface MediaPreview {
  url: string
  type: string
  name: string
  format: HeaderFormat
}

interface TemplatePreset {
  id: string
  title: string
  description: string
  name: string
  category: TemplateForm['category']
  headerFormat: HeaderFormat
  bodyText: string
  bodyExamples: string[]
  footerText: string
  buttons: ButtonDraft[]
  messageSendTtlSeconds?: string
  useCase: string
}

interface VariableShortcut {
  label: string
  description: string
  example: string
}

type ApprovalCheckStatus = 'ok' | 'warn' | 'danger'

interface ApprovalCheck {
  label: string
  description: string
  status: ApprovalCheckStatus
}

const emptyButton: ButtonDraft = {
  type: 'QUICK_REPLY',
  text: '',
  url: '',
  phoneNumber: '',
  example: '',
}

const emptyForm: TemplateForm = {
  name: '',
  language: 'pt_BR',
  category: 'MARKETING',
  headerFormat: 'NONE',
  headerText: '',
  headerExample: '',
  headerMediaHandle: '',
  headerMediaUrl: '',
  headerMediaR2Key: '',
  bodyText: '',
  bodyExamples: '',
  footerText: '',
  buttons: [],
  messageSendTtlSeconds: '',
}

const variableShortcuts: VariableShortcut[] = [
  { label: 'Nome do lead', description: 'Personaliza a abertura da mensagem.', example: 'Maria' },
  { label: 'Imovel', description: 'Nome curto da oportunidade ou empreendimento.', example: 'Cobertura frente mar' },
  { label: 'Link', description: 'URL da pagina do imovel, landing page ou blog.', example: 'https://guilhermepilger.ai/imovel' },
  { label: 'Cidade', description: 'Cidade ou bairro de interesse.', example: 'Balneario Camboriu' },
  { label: 'Corretor', description: 'Nome da pessoa que vai atender o lead.', example: 'Guilherme Pilger' },
]

const buttonPresets: Array<ButtonDraft & { label: string; description: string }> = [
  {
    ...emptyButton,
    label: 'Ver oportunidade',
    description: 'Botao de link para pagina do imovel.',
    type: 'URL',
    text: 'Ver detalhes',
    url: 'https://guilhermepilger.ai/imovel/{{1}}',
    example: 'https://guilhermepilger.ai/imovel/cobertura-frente-mar',
  },
  {
    ...emptyButton,
    label: 'Falar no WhatsApp',
    description: 'Leva o lead para atendimento humano ou IA.',
    type: 'URL',
    text: 'Falar com equipe',
    url: 'https://wa.me/554788271085',
  },
  {
    ...emptyButton,
    label: 'Tenho interesse',
    description: 'Resposta rapida para medir interesse.',
    type: 'QUICK_REPLY',
    text: 'Tenho interesse',
  },
]

const templatePresets: TemplatePreset[] = [
  {
    id: 'lancamento_alto_padrao',
    title: 'Lancamento alto padrao',
    description: 'Primeiro contato para lead opt-in que pediu novidades de um empreendimento.',
    name: 'pilger_lancamento_alto_padrao',
    category: 'MARKETING',
    headerFormat: 'IMAGE',
    bodyText: 'Ola {{1}}, separei uma oportunidade de alto padrao para voce em {{2}}.\n\nEla combina com o perfil que voce deixou no nosso site. Toque no botao abaixo para ver os detalhes.',
    bodyExamples: ['Maria', 'Balneario Camboriu'],
    footerText: 'Guilherme Pilger Imoveis',
    buttons: [buttonPresets[0]],
    useCase: 'Campanha para leads novos',
  },
  {
    id: 'follow_up_imovel',
    title: 'Follow-up de imovel',
    description: 'Retomar conversa com quem demonstrou interesse em um imovel especifico.',
    name: 'pilger_followup_imovel',
    category: 'MARKETING',
    headerFormat: 'IMAGE',
    bodyText: 'Ola {{1}}, vi que voce demonstrou interesse em {{2}}.\n\nSeparei os detalhes atualizados para facilitar sua analise. Posso te ajudar com valores, visita ou disponibilidade?',
    bodyExamples: ['Maria', 'Cobertura duplex no Ed. Costa Splendida'],
    footerText: 'Guilherme Pilger Imoveis',
    buttons: [buttonPresets[0], buttonPresets[2]],
    useCase: 'Follow-up ativo',
  },
  {
    id: 'convite_visita',
    title: 'Convite para visita',
    description: 'Convite curto para agendar visita ou chamada com o lead.',
    name: 'pilger_convite_visita',
    category: 'MARKETING',
    headerFormat: 'NONE',
    bodyText: 'Ola {{1}}, tudo bem?\n\nTemos uma janela de atendimento para apresentar {{2}} com mais detalhes. Qual horario fica melhor para voce?',
    bodyExamples: ['Maria', 'as opcoes em Balneario Camboriu'],
    footerText: 'Guilherme Pilger Imoveis',
    buttons: [
      { ...emptyButton, type: 'QUICK_REPLY', text: 'Quero agendar' },
      { ...emptyButton, type: 'QUICK_REPLY', text: 'Enviar opcoes' },
    ],
    useCase: 'Agendamento',
  },
  {
    id: 'conteudo_blog',
    title: 'Conteudo/blog',
    description: 'Enviar noticia, guia ou analise de mercado para lista interessada.',
    name: 'pilger_conteudo_mercado',
    category: 'MARKETING',
    headerFormat: 'IMAGE',
    bodyText: 'Ola {{1}}, publicamos um conteudo novo que pode te ajudar na decisao:\n\n{{2}}\n\nO material esta no link abaixo.',
    bodyExamples: ['Maria', 'Guia para investir em imoveis de alto padrao'],
    footerText: 'Guilherme Pilger Imoveis',
    buttons: [
      { ...emptyButton, type: 'URL', text: 'Ler conteudo', url: 'https://guilhermepilger.ai/blog/{{1}}', example: 'https://guilhermepilger.ai/blog/mercado-alto-padrao' },
    ],
    useCase: 'Nutrir base opt-in',
  },
  {
    id: 'reativacao_lead',
    title: 'Reativacao leve',
    description: 'Mensagem cuidadosa para lead antigo que aceitou contato.',
    name: 'pilger_reativacao_lead',
    category: 'MARKETING',
    headerFormat: 'NONE',
    bodyText: 'Ola {{1}}, tudo bem?\n\nFaz um tempo que voce deixou interesse em imoveis de alto padrao. Ainda faz sentido receber uma selecao atualizada em {{2}}?',
    bodyExamples: ['Maria', 'Balneario Camboriu'],
    footerText: 'Guilherme Pilger Imoveis',
    buttons: [
      { ...emptyButton, type: 'QUICK_REPLY', text: 'Sim, quero' },
      { ...emptyButton, type: 'QUICK_REPLY', text: 'Agora nao' },
    ],
    useCase: 'Base fria opt-in',
  },
  {
    id: 'utility_documentos',
    title: 'Atualizacao operacional',
    description: 'Uso utility para informacoes solicitadas, documentos ou andamento.',
    name: 'pilger_atualizacao_operacional',
    category: 'UTILITY',
    headerFormat: 'DOCUMENT',
    bodyText: 'Ola {{1}}, conforme solicitado, segue a atualizacao sobre {{2}}.\n\nSe precisar, responda esta mensagem que nossa equipe acompanha por aqui.',
    bodyExamples: ['Maria', 'a proposta do imovel'],
    footerText: 'Guilherme Pilger Imoveis',
    buttons: [buttonPresets[1]],
    useCase: 'Follow-up operacional',
  },
]

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function getPanelHeaderMedia(template: MetaTemplateRow | TemplateDraft) {
  const metadata = 'metadata' in template ? asRecord(template.metadata) : {}
  const media = asRecord(metadata.panel_header_media)
  return {
    url: textValue(media.url) || textValue(metadata.header_media_url),
    r2Key: textValue(media.r2Key) || textValue(media.r2_key) || textValue(metadata.header_media_r2_key),
    fileName: textValue(media.fileName) || textValue(media.file_name),
    contentType: textValue(media.contentType) || textValue(media.content_type),
  }
}

function normalizeTemplateName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function extractTemplateVariables(text: string) {
  const matches = Array.from(text.matchAll(/{{\s*(\d+)\s*}}/g))
  return Array.from(new Set(matches.map(match => Number(match[1])))).filter(Number.isFinite).sort((a, b) => a - b)
}

function parseBodyExamples(value: string) {
  return value.split(/[;\n,]+/).map(item => item.trim())
}

function replaceTemplateVariables(text: string, values: string[]) {
  return text.replace(/{{\s*(\d+)\s*}}/g, (_, index: string) => values[Number(index) - 1] || `{{${index}}}`)
}

function getBodyExampleValue(examples: string[], variables: number[], variable: number) {
  const index = variables.indexOf(variable)
  return index >= 0 ? examples[index] || '' : ''
}

function setBodyExampleValue(currentExamples: string[], variables: number[], variable: number, value: string) {
  const nextExamples = [...currentExamples]
  const index = variables.indexOf(variable)
  if (index >= 0) nextExamples[index] = value
  return nextExamples.join('; ')
}

function approvalStatusColor(status: ApprovalCheckStatus) {
  if (status === 'ok') return '#22c55e'
  if (status === 'danger') return '#ef4444'
  return '#f59e0b'
}

function getApprovalChecks(form: TemplateForm, bodyVariables: number[], bodyExamples: string[]): ApprovalCheck[] {
  const body = form.bodyText.trim()
  const filledExamples = bodyVariables.every(variable => getBodyExampleValue(bodyExamples, bodyVariables, variable).trim())
  const hasButton = form.buttons.some(button => button.text.trim())
  const hasMediaHeader = ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(form.headerFormat)
  const hasMediaReady = !hasMediaHeader || Boolean(form.headerMediaHandle.trim() && form.headerMediaUrl.trim())
  const hasClearOptOut = /sair|parar|cancelar|descadastrar|remover/i.test(body)
  const riskyWords = [
    'garantido',
    'sem risco',
    'renda garantida',
    'credito aprovado',
    'ultimas unidades',
    'imperdivel',
    'gratis',
    'clique agora',
  ].filter(word => body.toLowerCase().includes(word))

  return [
    {
      label: 'Corpo da mensagem',
      description: body ? `${body.length}/1024 caracteres` : 'Escreva uma mensagem objetiva antes de enviar.',
      status: !body ? 'danger' : body.length > 1024 ? 'danger' : body.length > 750 ? 'warn' : 'ok',
    },
    {
      label: 'Exemplos das variaveis',
      description: bodyVariables.length ? `${bodyVariables.length} variavel(is) detectada(s)` : 'Sem variaveis obrigatorias no corpo.',
      status: bodyVariables.length && !filledExamples ? 'danger' : 'ok',
    },
    {
      label: 'Midia do header',
      description: hasMediaHeader ? 'A midia precisa estar carregada na Meta e salva para campanhas.' : 'Template sem midia no topo.',
      status: hasMediaReady ? 'ok' : 'danger',
    },
    {
      label: 'CTA',
      description: hasButton ? 'Template tem botao para proxima acao.' : 'Adicionar botao costuma melhorar resposta e rastreio.',
      status: hasButton ? 'ok' : 'warn',
    },
    {
      label: 'Opt-out',
      description: hasClearOptOut ? 'Texto menciona saida/cancelamento.' : 'Para campanhas grandes, inclua uma saida simples quando fizer sentido.',
      status: hasClearOptOut || form.category === 'UTILITY' ? 'ok' : 'warn',
    },
    {
      label: 'Linguagem de risco',
      description: riskyWords.length ? `Revise: ${riskyWords.join(', ')}` : 'Sem termos de promessa exagerada detectados.',
      status: riskyWords.length ? 'warn' : 'ok',
    },
  ]
}

function getApprovalSummary(checks: ApprovalCheck[]) {
  const danger = checks.filter(check => check.status === 'danger').length
  const warn = checks.filter(check => check.status === 'warn').length
  if (danger) return { label: `${danger} item(ns) obrigatorio(s) pendente(s)`, status: 'danger' as ApprovalCheckStatus }
  if (warn) return { label: `${warn} ponto(s) para revisar`, status: 'warn' as ApprovalCheckStatus }
  return { label: 'Pronto para enviar para aprovacao', status: 'ok' as ApprovalCheckStatus }
}

function renderPreviewText(text: string) {
  const parts = text.split(/(```[^`]+```|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g)
  return parts.map((part, index) => {
    if (!part) return null
    if (part.startsWith('```') && part.endsWith('```')) return <code key={index}>{part.slice(3, -3)}</code>
    if (part.startsWith('*') && part.endsWith('*')) return <strong key={index}>{part.slice(1, -1)}</strong>
    if (part.startsWith('_') && part.endsWith('_')) return <em key={index}>{part.slice(1, -1)}</em>
    if (part.startsWith('~') && part.endsWith('~')) return <s key={index}>{part.slice(1, -1)}</s>
    return <span key={index}>{part}</span>
  })
}

function getBodyComponent(components?: unknown[] | null) {
  return (components || []).map(asRecord).find(component => textValue(component.type).toUpperCase() === 'BODY') || null
}

function getButtonsComponent(components?: unknown[] | null) {
  return (components || []).map(asRecord).find(component => textValue(component.type).toUpperCase() === 'BUTTONS') || null
}

function parseTemplateToForm(template: MetaTemplateRow | TemplateDraft): TemplateForm {
  const components = Array.isArray(template.components) ? template.components.map(asRecord) : []
  const header = components.find(component => textValue(component.type).toUpperCase() === 'HEADER')
  const headerExample = asRecord(header?.example)
  const headerHandles = Array.isArray(headerExample.header_handle) ? headerExample.header_handle : []
  const body = components.find(component => textValue(component.type).toUpperCase() === 'BODY')
  const footer = components.find(component => textValue(component.type).toUpperCase() === 'FOOTER')
  const buttons = components.find(component => textValue(component.type).toUpperCase() === 'BUTTONS')
  const rawButtons = Array.isArray(buttons?.buttons) ? buttons?.buttons.map(asRecord) : []
  const panelHeaderMedia = getPanelHeaderMedia(template)

  if ('form' in template && template.form) {
    return { ...emptyForm, ...template.form, name: template.name, language: template.language, category: template.category as TemplateForm['category'] }
  }

  return {
    ...emptyForm,
    name: template.name,
    language: template.language || 'pt_BR',
    category: (template.category || 'MARKETING').toUpperCase() as TemplateForm['category'],
    headerFormat: (textValue(header?.format).toUpperCase() || 'NONE') as HeaderFormat,
    headerText: textValue(header?.text),
    headerMediaHandle: textValue(headerHandles[0]),
    headerMediaUrl: panelHeaderMedia.url,
    headerMediaR2Key: panelHeaderMedia.r2Key,
    bodyText: textValue(body?.text),
    footerText: textValue(footer?.text),
    buttons: rawButtons.map(button => ({
      type: (textValue(button.type).toUpperCase() || 'QUICK_REPLY') as ButtonType,
      text: textValue(button.text),
      url: textValue(button.url),
      phoneNumber: textValue(button.phone_number),
      example: Array.isArray(button.example) ? textValue(button.example[0]) : textValue(button.example),
    })),
  }
}

function statusColor(status: string) {
  const selected = status.toUpperCase()
  if (selected === 'APPROVED') return '#22c55e'
  if (selected === 'PENDING') return '#f59e0b'
  if (selected === 'REJECTED') return '#ef4444'
  if (selected === 'PAUSED') return '#94a3b8'
  if (selected === 'DELETED') return '#64748b'
  return '#c9a96e'
}

function headerMediaAccept(format: HeaderFormat) {
  if (format === 'IMAGE') return 'image/jpeg,image/png'
  if (format === 'VIDEO') return 'video/mp4'
  if (format === 'DOCUMENT') return 'application/pdf'
  return ''
}

function headerMediaLabel(format: HeaderFormat) {
  if (format === 'IMAGE') return 'imagem'
  if (format === 'VIDEO') return 'video'
  if (format === 'DOCUMENT') return 'documento'
  return 'midia'
}

function HeaderMediaPreview({
  format,
  preview,
  handle,
  publicUrl,
  compact = false,
}: {
  format: HeaderFormat
  preview: MediaPreview | null
  handle?: string
  publicUrl?: string
  compact?: boolean
}) {
  const activePreview = preview?.format === format ? preview : null
  const displayUrl = activePreview?.url || publicUrl || ''
  const displayName = activePreview?.name || (publicUrl ? 'midia salva no R2' : '')
  const shellStyle: CSSProperties = {
    width: '100%',
    minHeight: compact ? 106 : 126,
    borderRadius: compact ? 10 : 9,
    background: '#dbe4ec',
    border: compact ? '1px solid var(--border)' : 'none',
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
    color: '#475569',
    fontWeight: 800,
    marginBottom: compact ? 0 : 8,
  }

  if (displayUrl && format === 'IMAGE') {
    return (
      <div style={shellStyle}>
        <img
          src={displayUrl}
          alt={`Previa de ${displayName || headerMediaLabel(format)}`}
          style={{ width: '100%', height: '100%', maxHeight: compact ? 170 : 210, objectFit: 'contain', display: 'block' }}
        />
      </div>
    )
  }

  if (displayUrl && format === 'VIDEO') {
    return (
      <div style={shellStyle}>
        <video
          src={displayUrl}
          controls
          muted
          style={{ width: '100%', maxHeight: compact ? 190 : 230, display: 'block', background: '#0f172a' }}
        />
      </div>
    )
  }

  if (activePreview && format === 'DOCUMENT') {
    return (
      <div style={{ ...shellStyle, padding: 12, boxSizing: 'border-box', alignContent: 'center' }}>
        <FileText size={compact ? 24 : 30} />
        <span style={{ marginTop: 6, textAlign: 'center', fontSize: compact ? '0.78rem' : '0.84rem' }}>{activePreview.name}</span>
      </div>
    )
  }

  if (publicUrl && format === 'DOCUMENT') {
    return (
      <a href={publicUrl} target="_blank" rel="noreferrer" style={{ ...shellStyle, padding: 12, boxSizing: 'border-box', alignContent: 'center', textDecoration: 'none' }}>
        <FileText size={compact ? 24 : 30} />
        <span style={{ marginTop: 6, textAlign: 'center', fontSize: compact ? '0.78rem' : '0.84rem', color: '#475569' }}>documento salvo no R2</span>
      </a>
    )
  }

  const Icon = format === 'IMAGE' ? ImageIcon : format === 'VIDEO' ? Video : FileText
  return (
    <div style={{ ...shellStyle, padding: 12, boxSizing: 'border-box', alignContent: 'center' }}>
      <Icon size={compact ? 24 : 30} />
      <span style={{ marginTop: 6, textAlign: 'center', fontSize: compact ? '0.78rem' : '0.84rem' }}>
        {handle ? `${headerMediaLabel(format)} carregada na Meta` : `Previa de ${headerMediaLabel(format)}`}
      </span>
    </div>
  )
}

export default function MetaTemplatesPage() {
  const [templates, setTemplates] = useState<MetaTemplateRow[]>([])
  const [drafts, setDrafts] = useState<TemplateDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [activeStatus, setActiveStatus] = useState<TemplateStatus>('all')
  const [form, setForm] = useState<TemplateForm>(emptyForm)
  const [editingTemplate, setEditingTemplate] = useState<MetaTemplateRow | null>(null)
  const [editingDraftId, setEditingDraftId] = useState('')
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [mediaFileLabel, setMediaFileLabel] = useState('')
  const [mediaPreview, setMediaPreview] = useState<MediaPreview | null>(null)
  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const mediaPreviewUrlRef = useRef<string | null>(null)

  const bodyVariables = useMemo(() => extractTemplateVariables(form.bodyText), [form.bodyText])
  const headerVariables = useMemo(() => extractTemplateVariables(form.headerText), [form.headerText])
  const bodyExamples = useMemo(() => parseBodyExamples(form.bodyExamples), [form.bodyExamples])
  const approvalChecks = useMemo(() => getApprovalChecks(form, bodyVariables, bodyExamples), [form, bodyVariables, bodyExamples])
  const approvalSummary = useMemo(() => getApprovalSummary(approvalChecks), [approvalChecks])

  const filteredTemplates = useMemo(() => {
    if (activeStatus === 'drafts') return []
    if (activeStatus === 'all') return templates
    return templates.filter(template => String(template.status || '').toUpperCase() === activeStatus.toUpperCase())
  }, [templates, activeStatus])

  const groupedCounts = useMemo(() => ({
    all: templates.length,
    APPROVED: templates.filter(template => String(template.status).toUpperCase() === 'APPROVED').length,
    PENDING: templates.filter(template => String(template.status).toUpperCase() === 'PENDING').length,
    REJECTED: templates.filter(template => String(template.status).toUpperCase() === 'REJECTED').length,
    drafts: drafts.length,
  }), [templates, drafts])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/whatsapp/templates')
      const payload = await response.json()
      if (!payload.success) throw new Error(payload.message || 'Erro ao carregar templates')
      setTemplates(payload.templates || [])
      setDrafts(payload.drafts || [])
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Erro ao carregar templates' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  const updateForm = (patch: Partial<TemplateForm>) => setForm(prev => ({ ...prev, ...patch }))

  useEffect(() => () => {
    if (mediaPreviewUrlRef.current) URL.revokeObjectURL(mediaPreviewUrlRef.current)
  }, [])

  const clearMediaPreview = () => {
    if (mediaPreviewUrlRef.current) {
      URL.revokeObjectURL(mediaPreviewUrlRef.current)
      mediaPreviewUrlRef.current = null
    }
    setMediaPreview(null)
  }

  const setLocalMediaPreview = (file: File, format: HeaderFormat) => {
    clearMediaPreview()
    const url = URL.createObjectURL(file)
    mediaPreviewUrlRef.current = url
    setMediaPreview({
      url,
      type: file.type,
      name: file.name,
      format,
    })
  }

  const insertBodyVariable = (example: string) => {
    const nextVariable = Math.max(0, ...bodyVariables) + 1
    const token = `{{${nextVariable}}}`
    const textarea = bodyTextareaRef.current
    const currentBody = form.bodyText
    const selectionStart = textarea?.selectionStart ?? currentBody.length
    const selectionEnd = textarea?.selectionEnd ?? selectionStart
    const nextBody = `${currentBody.slice(0, selectionStart)}${token}${currentBody.slice(selectionEnd)}`
    const nextExamples = parseBodyExamples(form.bodyExamples)

    while (nextExamples.length < nextVariable) nextExamples.push('')
    if (!nextExamples[nextVariable - 1]) nextExamples[nextVariable - 1] = example

    updateForm({ bodyText: nextBody, bodyExamples: nextExamples.join('; ') })

    requestAnimationFrame(() => {
      const nextPosition = selectionStart + token.length
      bodyTextareaRef.current?.focus()
      bodyTextareaRef.current?.setSelectionRange(nextPosition, nextPosition)
    })
  }

  const buildComponents = () => {
    const components: Record<string, unknown>[] = []
    const normalizedBody = form.bodyText.trim()
    if (!normalizedBody) throw new Error('Corpo do template obrigatorio.')

    if (form.headerFormat !== 'NONE') {
      const header: Record<string, unknown> = {
        type: 'HEADER',
        format: form.headerFormat,
      }
      if (form.headerFormat === 'TEXT') {
        if (!form.headerText.trim()) throw new Error('Texto do header obrigatorio.')
        header.text = form.headerText.trim()
        if (headerVariables.length) {
          if (!form.headerExample.trim()) throw new Error('Exemplo da variavel do header obrigatorio.')
          header.example = { header_text: [form.headerExample.trim()] }
        }
      } else {
        if (!form.headerMediaHandle.trim()) throw new Error('Carregue uma midia de exemplo para o header.')
        header.example = { header_handle: [form.headerMediaHandle.trim()] }
      }
      components.push(header)
    }

    const body: Record<string, unknown> = {
      type: 'BODY',
      text: normalizedBody,
    }
    if (bodyVariables.length) {
      if (bodyVariables.some(variable => !getBodyExampleValue(bodyExamples, bodyVariables, variable).trim())) {
        throw new Error(`Informe ${bodyVariables.length} exemplo(s) para as variaveis do corpo.`)
      }
      body.example = {
        body_text: [bodyVariables.map(variable => getBodyExampleValue(bodyExamples, bodyVariables, variable))],
      }
    }
    components.push(body)

    if (form.footerText.trim()) {
      components.push({ type: 'FOOTER', text: form.footerText.trim().slice(0, 60) })
    }

    const buttons = form.buttons
      .filter(button => button.text.trim())
      .map(button => {
        if (button.type === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: button.text.trim().slice(0, 25) }
        if (button.type === 'URL') {
          if (!button.url.trim()) throw new Error(`URL obrigatoria no botao ${button.text}.`)
          return {
            type: 'URL',
            text: button.text.trim().slice(0, 25),
            url: button.url.trim(),
            ...(extractTemplateVariables(button.url).length && button.example.trim()
              ? { example: [button.example.trim()] }
              : {}),
          }
        }
        if (button.type === 'PHONE_NUMBER') {
          if (!button.phoneNumber.trim()) throw new Error(`Telefone obrigatorio no botao ${button.text}.`)
          return { type: 'PHONE_NUMBER', text: button.text.trim().slice(0, 25), phone_number: button.phoneNumber.trim() }
        }
        return { type: 'COPY_CODE', example: button.example.trim() || 'PILGER' }
      })

    if (buttons.length) components.push({ type: 'BUTTONS', buttons })
    return components
  }

  const resetBuilder = () => {
    setForm(emptyForm)
    setEditingTemplate(null)
    setEditingDraftId('')
    setMediaFileLabel('')
    clearMediaPreview()
  }

  const runAction = async (body: Record<string, unknown>, successFallback: string) => {
    setSaving(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/admin/whatsapp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json()
      if (!payload.success) throw new Error(payload.message || 'Falha na acao')
      setFeedback({ type: 'success', text: payload.message || successFallback })
      if (payload.drafts) setDrafts(payload.drafts)
      await loadTemplates()
      return payload
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Erro ao executar acao' })
      return null
    } finally {
      setSaving(false)
    }
  }

  const saveDraft = async () => {
    const name = normalizeTemplateName(form.name)
    if (!name) {
      setFeedback({ type: 'error', text: 'Defina um nome para salvar o rascunho.' })
      return
    }
    let components: unknown[] = []
    try {
      components = form.bodyText.trim() ? buildComponents() : []
    } catch {
      components = []
    }
    const payload = await runAction({
      action: 'save_draft',
      id: editingDraftId || undefined,
      name,
      language: form.language,
      category: form.category,
      components,
      form: { ...form, name },
    }, 'Rascunho salvo.')
    if (payload?.draft?.id) setEditingDraftId(payload.draft.id)
  }

  const submitToMeta = async () => {
    try {
      const name = normalizeTemplateName(form.name)
      const components = buildComponents()
      if (!name) throw new Error('Nome do template obrigatorio.')
      const hasHeaderMedia = ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(form.headerFormat)
      await runAction({
        action: editingTemplate ? 'edit' : 'create',
        templateId: editingTemplate?.template_external_id,
        name,
        language: form.language,
        category: form.category,
        components,
        messageSendTtlSeconds: Number(form.messageSendTtlSeconds || 0) || undefined,
        panelHeaderMedia: hasHeaderMedia && form.headerMediaUrl ? {
          url: form.headerMediaUrl,
          r2Key: form.headerMediaR2Key,
          handle: form.headerMediaHandle,
          fileName: mediaFileLabel,
          contentType: mediaPreview?.type || '',
          headerFormat: form.headerFormat,
        } : undefined,
      }, editingTemplate ? 'Template atualizado.' : 'Template enviado para Meta.')
      resetBuilder()
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Erro ao montar template' })
    }
  }

  const syncTemplates = async () => {
    setSyncing(true)
    await runAction({ action: 'sync' }, 'Templates sincronizados.')
    setSyncing(false)
  }

  const updateHeaderFormat = (headerFormat: HeaderFormat) => {
    const isMedia = headerFormat === 'IMAGE' || headerFormat === 'VIDEO' || headerFormat === 'DOCUMENT'
    const keepExistingHandle = isMedia && form.headerFormat === headerFormat
    if (!keepExistingHandle) clearMediaPreview()
    updateForm({
      headerFormat,
      ...(keepExistingHandle ? {} : { headerMediaHandle: '', headerMediaUrl: '', headerMediaR2Key: '' }),
    })
    setMediaFileLabel('')
  }

  const uploadHeaderMedia = async (file?: File) => {
    if (!file) return
    setUploadingMedia(true)
    setFeedback(null)
    setMediaFileLabel('')
    setLocalMediaPreview(file, form.headerFormat)
    updateForm({ headerMediaHandle: '', headerMediaUrl: '', headerMediaR2Key: '' })
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('headerFormat', form.headerFormat)

      const response = await fetch('/api/admin/whatsapp/templates/media', {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json()
      if (!payload.success) throw new Error(payload.message || 'Erro ao carregar midia')

      updateForm({
        headerMediaHandle: payload.handle || '',
        headerMediaUrl: payload.publicUrl || '',
        headerMediaR2Key: payload.r2Key || '',
      })
      setMediaFileLabel(payload.file?.name || file.name)
      setFeedback({ type: 'success', text: payload.message || 'Midia carregada na Meta.' })
    } catch (error) {
      updateForm({ headerMediaHandle: '', headerMediaUrl: '', headerMediaR2Key: '' })
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Erro ao carregar midia' })
    } finally {
      setUploadingMedia(false)
    }
  }

  const loadIntoBuilder = (template: MetaTemplateRow | TemplateDraft, mode: 'edit' | 'duplicate' | 'draft') => {
    const nextForm = parseTemplateToForm(template)
    setForm(mode === 'duplicate'
      ? { ...nextForm, name: `${normalizeTemplateName(nextForm.name)}_copia` }
      : nextForm)
    setEditingTemplate(mode === 'edit' && 'template_external_id' in template ? template : null)
    setEditingDraftId(mode === 'draft' && 'id' in template ? template.id : '')
    setMediaFileLabel('')
    clearMediaPreview()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const deleteTemplate = async (template: MetaTemplateRow) => {
    if (!window.confirm(`Excluir o template ${template.name} na Meta?`)) return
    await runAction({
      action: 'delete',
      templateId: template.template_external_id,
      name: template.name,
    }, 'Template excluido.')
  }

  const deleteDraft = async (draft: TemplateDraft) => {
    await runAction({ action: 'delete_draft', id: draft.id }, 'Rascunho removido.')
  }

  const addButton = () => updateForm({ buttons: [...form.buttons, { ...emptyButton }] })

  const updateButton = (index: number, patch: Partial<ButtonDraft>) => {
    updateForm({
      buttons: form.buttons.map((button, current) => current === index ? { ...button, ...patch } : button),
    })
  }

  const removeButton = (index: number) => {
    updateForm({ buttons: form.buttons.filter((_, current) => current !== index) })
  }

  const updateBodyExample = (variable: number, value: string) => {
    updateForm({ bodyExamples: setBodyExampleValue(bodyExamples, bodyVariables, variable, value) })
  }

  const addButtonPreset = (preset: ButtonDraft) => {
    if (form.buttons.length >= 3) {
      setFeedback({ type: 'error', text: 'A Meta permite ate 3 botoes neste formato de template.' })
      return
    }
    updateForm({ buttons: [...form.buttons, { ...emptyButton, ...preset }] })
  }

  const applyPreset = (preset: TemplatePreset) => {
    clearMediaPreview()
    setMediaFileLabel('')
    setEditingTemplate(null)
    setEditingDraftId('')
    setForm({
      ...emptyForm,
      name: preset.name,
      language: form.language || 'pt_BR',
      category: preset.category,
      headerFormat: preset.headerFormat,
      bodyText: preset.bodyText,
      bodyExamples: preset.bodyExamples.join('; '),
      footerText: preset.footerText,
      buttons: preset.buttons.map(button => ({ ...emptyButton, ...button })),
      messageSendTtlSeconds: preset.messageSendTtlSeconds || '',
    })
    setFeedback({ type: 'success', text: `Modelo "${preset.title}" carregado. Ajuste o texto e envie para aprovacao.` })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) return <AdminLoadingState minHeight="420px" />

  const previewBody = replaceTemplateVariables(form.bodyText, bodyExamples)
  const bodyComponentCount = templates.filter(template => getBodyComponent(template.components)).length

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0, fontSize: '1.5rem' }}>
            <FileText size={25} style={{ color: 'var(--gold)' }} /> Templates Meta
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
            Crie, edite, envie para aprovacao, sincronize e exclua templates oficiais sem sair do painel.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/admin/whatsapp/campaigns" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 700, padding: '10px 12px' }}>
            Campanhas Meta WhatsApp
          </Link>
          <button type="button" onClick={syncTemplates} disabled={syncing || saving} style={actionButtonStyle(false)}>
            {syncing ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />} Sincronizar Meta
          </button>
        </div>
      </div>

      {feedback && (
        <div style={{
          padding: '12px 14px',
          borderRadius: 10,
          color: feedback.type === 'success' ? '#22c55e' : '#ef4444',
          background: feedback.type === 'success' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${feedback.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
          fontSize: '0.86rem',
        }}>
          {feedback.text}
        </div>
      )}

      <section style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <h2 style={{ ...sectionTitleStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={18} style={{ color: 'var(--gold)' }} /> Biblioteca imobiliaria
            </h2>
            <p style={{ margin: '5px 0 0', color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.45 }}>
              Comece por uma estrutura segura para leads opt-in e ajuste nomes, links e midia antes de enviar para a Meta.
            </p>
          </div>
          <span style={successPillStyle}>Fase 1: templates guiados</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
          {templatePresets.map(preset => (
            <article key={preset.id} style={{ padding: 13, borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.035)', display: 'grid', gap: 9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>{preset.title}</strong>
                <span style={{ color: 'var(--gold)', fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase' }}>{preset.category}</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.45, margin: 0 }}>{preset.description}</p>
              <div style={{ display: 'flex', gap: 7, alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                <FileText size={13} /> {preset.useCase}
              </div>
              <button type="button" onClick={() => applyPreset(preset)} style={{ ...ghostButtonStyle, justifyContent: 'center' }}>
                <Sparkles size={14} /> Usar modelo
              </button>
            </article>
          ))}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18, alignItems: 'start' }}>
        <section style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 14 }}>
            <h2 style={sectionTitleStyle}>{editingTemplate ? 'Editar template Meta' : editingDraftId ? 'Editar rascunho' : 'Criar template'}</h2>
            <button type="button" onClick={resetBuilder} style={ghostButtonStyle}>Limpar</button>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <Field label="Nome Meta">
                <input value={form.name} onChange={event => updateForm({ name: normalizeTemplateName(event.target.value) })} placeholder="pilger_lancamento_interesse" style={inputStyle} />
              </Field>
              <Field label="Categoria">
                <select value={form.category} onChange={event => updateForm({ category: event.target.value as TemplateForm['category'] })} style={inputStyle}>
                  <option value="MARKETING">Marketing</option>
                  <option value="UTILITY">Utility</option>
                  <option value="AUTHENTICATION">Authentication</option>
                </select>
              </Field>
              <Field label="Idioma">
                <input value={form.language} onChange={event => updateForm({ language: event.target.value })} placeholder="pt_BR" style={inputStyle} />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <Field label="Header">
                <select value={form.headerFormat} onChange={event => updateHeaderFormat(event.target.value as HeaderFormat)} style={inputStyle}>
                  <option value="NONE">Sem header</option>
                  <option value="TEXT">Texto</option>
                  <option value="IMAGE">Imagem</option>
                  <option value="VIDEO">Video</option>
                  <option value="DOCUMENT">Documento</option>
                </select>
              </Field>
              {form.headerFormat === 'TEXT' ? (
                <Field label="Texto do header">
                  <input value={form.headerText} onChange={event => updateForm({ headerText: event.target.value })} placeholder="Oportunidade para {{1}}" style={inputStyle} />
                </Field>
              ) : form.headerFormat !== 'NONE' ? (
                <Field label="Midia de exemplo">
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <label style={{ ...ghostButtonStyle, cursor: uploadingMedia || saving ? 'wait' : 'pointer' }}>
                        {uploadingMedia ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}
                        {uploadingMedia ? 'Carregando' : `Carregar ${headerMediaLabel(form.headerFormat).toLowerCase()}`}
                        <input
                          type="file"
                          accept={headerMediaAccept(form.headerFormat)}
                          disabled={uploadingMedia || saving}
                          onChange={event => {
                            const selectedFile = event.currentTarget.files?.[0]
                            event.currentTarget.value = ''
                            void uploadHeaderMedia(selectedFile)
                          }}
                          style={{ display: 'none' }}
                        />
                      </label>
                      {mediaFileLabel && <span style={successPillStyle}>{mediaFileLabel}</span>}
                    </div>
                    <input value={form.headerMediaHandle} onChange={event => updateForm({ headerMediaHandle: event.target.value })} placeholder="Handle gerado pela Meta" style={inputStyle} />
                    {form.headerMediaUrl && (
                      <div style={{ padding: '9px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.09)', border: '1px solid rgba(34,197,94,0.22)', color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.35, wordBreak: 'break-all' }}>
                        Midia padrao salva para campanhas: {form.headerMediaUrl}
                      </div>
                    )}
                    {(mediaPreview || form.headerMediaHandle || form.headerMediaUrl) && (
                      <HeaderMediaPreview
                        format={form.headerFormat}
                        preview={mediaPreview}
                        handle={form.headerMediaHandle}
                        publicUrl={form.headerMediaUrl}
                        compact
                      />
                    )}
                  </div>
                </Field>
              ) : <div />}
              {form.headerFormat === 'TEXT' && headerVariables.length > 0 ? (
                <Field label="Exemplo do header">
                  <input value={form.headerExample} onChange={event => updateForm({ headerExample: event.target.value })} placeholder="Maria" style={inputStyle} />
                </Field>
              ) : <div />}
            </div>

            <Field label="Corpo">
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {variableShortcuts.map(item => (
                    <button key={item.label} type="button" onClick={() => insertBodyVariable(item.example)} title={item.description} style={ghostButtonStyle}>
                      <Plus size={14} /> {item.label}
                    </button>
                  ))}
                  <button type="button" onClick={() => insertBodyVariable('exemplo')} style={ghostButtonStyle}>
                    <Plus size={14} /> Nova variavel
                  </button>
                </div>
                {bodyVariables.length > 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem', lineHeight: 1.45 }}>
                    Variaveis no texto: {bodyVariables.map(item => `{{${item}}}`).join(', ')}. Os exemplos abaixo seguem essa mesma ordem.
                  </div>
                )}
                <textarea ref={bodyTextareaRef} value={form.bodyText} onChange={event => updateForm({ bodyText: event.target.value })} placeholder={'Ola {{1}}, separei esta oportunidade para voce:\n\n{{2}}\n\nClique no botao abaixo para ver os detalhes.'} rows={6} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.45 }} />
              </div>
            </Field>

            {bodyVariables.length > 0 && (
              <div style={{ display: 'grid', gap: 8 }}>
                <span style={labelStyle}>Exemplos do corpo</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
                  {bodyVariables.map(variable => (
                    <input
                      key={variable}
                      value={getBodyExampleValue(bodyExamples, bodyVariables, variable)}
                      onChange={event => updateBodyExample(variable, event.target.value)}
                      placeholder={`Exemplo para {{${variable}}}`}
                      style={inputStyle}
                    />
                  ))}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem', lineHeight: 1.45 }}>
                  Esses exemplos sao enviados para aprovacao da Meta e tambem ajudam o preview do WhatsApp.
                </div>
              </div>
            )}

            <Field label="Footer">
              <input value={form.footerText} onChange={event => updateForm({ footerText: event.target.value })} maxLength={60} placeholder="Guilherme Pilger Imoveis" style={inputStyle} />
            </Field>

            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={labelStyle}>Botoes</span>
                <button type="button" onClick={addButton} disabled={form.buttons.length >= 3} style={ghostButtonStyle}>
                  <Plus size={14} /> Adicionar botao
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {buttonPresets.map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => addButtonPreset(preset)}
                    title={preset.description}
                    disabled={form.buttons.length >= 3}
                    style={ghostButtonStyle}
                  >
                    {preset.type === 'URL' ? <Link2 size={14} /> : <Plus size={14} />} {preset.label}
                  </button>
                ))}
              </div>
              {form.buttons.map((button, index) => (
                <div key={index} style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)', display: 'grid', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                    <select value={button.type} onChange={event => updateButton(index, { type: event.target.value as ButtonType })} style={inputStyle}>
                      <option value="QUICK_REPLY">Resposta rapida</option>
                      <option value="URL">URL</option>
                      <option value="PHONE_NUMBER">Telefone</option>
                      <option value="COPY_CODE">Copiar codigo</option>
                    </select>
                    <input value={button.text} onChange={event => updateButton(index, { text: event.target.value })} placeholder="Texto do botao" style={inputStyle} />
                    <button type="button" onClick={() => removeButton(index)} style={dangerIconButtonStyle} aria-label="Remover botao">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  {button.type === 'URL' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
                      <input value={button.url} onChange={event => updateButton(index, { url: event.target.value })} placeholder="https://guilhermepilger.ai/imovel/{{1}}" style={inputStyle} />
                      <input value={button.example} onChange={event => updateButton(index, { example: event.target.value })} placeholder="exemplo da URL dinamica" style={inputStyle} />
                    </div>
                  )}
                  {button.type === 'PHONE_NUMBER' && (
                    <input value={button.phoneNumber} onChange={event => updateButton(index, { phoneNumber: event.target.value })} placeholder="+554788271085" style={inputStyle} />
                  )}
                  {button.type === 'COPY_CODE' && (
                    <input value={button.example} onChange={event => updateButton(index, { example: event.target.value })} placeholder="PILGER10" style={inputStyle} />
                  )}
                </div>
              ))}
            </div>

            <Field label="TTL em segundos (opcional)">
              <input value={form.messageSendTtlSeconds} onChange={event => updateForm({ messageSendTtlSeconds: event.target.value.replace(/\D/g, '') })} placeholder="Ex: 86400" style={inputStyle} />
            </Field>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={saveDraft} disabled={saving} style={actionButtonStyle(false)}>
                {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />} Salvar rascunho
              </button>
              <button type="button" onClick={submitToMeta} disabled={saving} style={actionButtonStyle(true)}>
                {saving ? <Loader2 size={16} className="spin" /> : <Send size={16} />} {editingTemplate ? 'Atualizar na Meta' : 'Enviar para aprovacao'}
              </button>
            </div>
          </div>
        </section>

        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>Preview</h2>
          <div style={{ borderRadius: 18, padding: 14, background: '#efe7dc', color: '#111827', minHeight: 360 }}>
            <div style={{ maxWidth: '88%', marginLeft: 'auto', borderRadius: '12px 12px 3px 12px', padding: '10px 12px', background: '#dcf8c6', boxShadow: '0 1px 2px rgba(0,0,0,0.16)', fontSize: '0.86rem', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
              {form.headerFormat !== 'NONE' && form.headerFormat !== 'TEXT' && (
                <HeaderMediaPreview
                  format={form.headerFormat}
                  preview={mediaPreview}
                  handle={form.headerMediaHandle}
                  publicUrl={form.headerMediaUrl}
                />
              )}
              {form.headerFormat === 'TEXT' && form.headerText && (
                <div style={{ fontWeight: 800, marginBottom: 6 }}>
                  {renderPreviewText(replaceTemplateVariables(form.headerText, [form.headerExample || 'Maria']))}
                </div>
              )}
              <div>{renderPreviewText(previewBody || 'Escreva o corpo do template para ver a previa.')}</div>
              {form.footerText && <div style={{ color: '#64748b', fontSize: '0.76rem', marginTop: 8 }}>{form.footerText}</div>}
              {form.buttons.filter(button => button.text).length > 0 && (
                <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
                  {form.buttons.filter(button => button.text).map((button, index) => (
                    <div key={index} style={{ borderTop: '1px solid rgba(15,23,42,0.13)', paddingTop: 7, textAlign: 'center', color: '#0369a1', fontWeight: 800 }}>
                      {button.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}>
            <MiniStat label="Templates" value={templates.length} />
            <MiniStat label="Com corpo" value={bodyComponentCount} />
            <MiniStat label="Rascunhos" value={drafts.length} />
          </div>
          <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: `1px solid ${approvalStatusColor(approvalSummary.status)}33`, background: `${approvalStatusColor(approvalSummary.status)}0f`, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <strong style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 7 }}>
                {approvalSummary.status === 'ok' ? <CheckCircle2 size={16} style={{ color: '#22c55e' }} /> : <AlertTriangle size={16} style={{ color: approvalStatusColor(approvalSummary.status) }} />}
                Assistente de aprovacao
              </strong>
              <span style={{ color: approvalStatusColor(approvalSummary.status), fontSize: '0.76rem', fontWeight: 900 }}>{approvalSummary.label}</span>
            </div>
            <div style={{ display: 'grid', gap: 7 }}>
              {approvalChecks.map(check => (
                <div key={check.label} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 8, alignItems: 'start' }}>
                  {check.status === 'ok' ? (
                    <CheckCircle2 size={15} style={{ color: '#22c55e', marginTop: 2 }} />
                  ) : (
                    <AlertTriangle size={15} style={{ color: approvalStatusColor(check.status), marginTop: 2 }} />
                  )}
                  <div>
                    <div style={{ color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 800 }}>{check.label}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', lineHeight: 1.4 }}>{check.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <h2 style={sectionTitleStyle}>Biblioteca Meta</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {([
              ['all', `Todos (${groupedCounts.all})`],
              ['APPROVED', `Aprovados (${groupedCounts.APPROVED})`],
              ['PENDING', `Em analise (${groupedCounts.PENDING})`],
              ['REJECTED', `Rejeitados (${groupedCounts.REJECTED})`],
              ['drafts', `Rascunhos (${groupedCounts.drafts})`],
            ] as Array<[TemplateStatus, string]>).map(([status, label]) => (
              <button key={status} type="button" onClick={() => setActiveStatus(status)} style={tabButtonStyle(activeStatus === status)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {activeStatus === 'drafts' ? (
          <div style={gridStyle}>
            {drafts.map(draft => (
              <TemplateCard
                key={draft.id}
                title={draft.name}
                subtitle={`${draft.category} | ${draft.language}`}
                status="RASCUNHO"
                statusColorValue="#c9a96e"
                components={draft.components}
                actions={<>
                  <button type="button" onClick={() => loadIntoBuilder(draft, 'draft')} style={ghostButtonStyle}><Edit3 size={14} /> Editar</button>
                  <button type="button" onClick={() => deleteDraft(draft)} style={dangerButtonStyle}><Trash2 size={14} /> Remover</button>
                </>}
              />
            ))}
            {!drafts.length && <EmptyState text="Nenhum rascunho salvo ainda." />}
          </div>
        ) : (
          <div style={gridStyle}>
            {filteredTemplates.map(template => (
              <TemplateCard
                key={template.id}
                title={template.name}
                subtitle={`${template.category} | ${template.language}`}
                status={String(template.status || 'unknown').toUpperCase()}
                statusColorValue={statusColor(template.status)}
                components={template.components || []}
                actions={<>
                  <button type="button" onClick={() => loadIntoBuilder(template, 'duplicate')} style={ghostButtonStyle}><Copy size={14} /> Duplicar</button>
                  {template.template_external_id && (
                    <button type="button" onClick={() => loadIntoBuilder(template, 'edit')} style={ghostButtonStyle}><Edit3 size={14} /> Editar</button>
                  )}
                  <button type="button" onClick={() => deleteTemplate(template)} style={dangerButtonStyle}><Trash2 size={14} /> Excluir</button>
                </>}
              />
            ))}
            {!filteredTemplates.length && <EmptyState text="Nenhum template encontrado neste filtro." />}
          </div>
        )}
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)' }}>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800 }}>{label}</div>
      <strong style={{ color: 'var(--gold)', fontSize: '1.1rem' }}>{value}</strong>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: 28, borderRadius: 12, border: '1px dashed var(--border)', color: 'var(--text-muted)', textAlign: 'center' }}>
      {text}
    </div>
  )
}

function TemplateCard({
  title,
  subtitle,
  status,
  statusColorValue,
  components,
  actions,
}: {
  title: string
  subtitle: string
  status: string
  statusColorValue: string
  components?: unknown[] | null
  actions: ReactNode
}) {
  const body = textValue(getBodyComponent(components)?.text)
  const buttons = getButtonsComponent(components)
  const buttonCount = Array.isArray(buttons?.buttons) ? buttons.buttons.length : 0
  return (
    <article style={{ padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.035)', display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>{title}</strong>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 3 }}>{subtitle}</div>
        </div>
        <span style={{ color: statusColorValue, fontSize: '0.72rem', fontWeight: 900 }}>{status}</span>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.45, margin: 0, minHeight: 38 }}>
        {body ? body.slice(0, 160) : 'Sem corpo sincronizado.'}
      </p>
      <div style={{ display: 'flex', gap: 8, color: 'var(--text-muted)', fontSize: '0.74rem' }}>
        <span>{Array.isArray(components) ? components.length : 0} componente(s)</span>
        <span>{buttonCount} botao(s)</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>
    </article>
  )
}

const panelStyle: CSSProperties = {
  padding: 18,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--bg-secondary)',
}

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.03rem',
  color: 'var(--text-primary)',
}

const labelStyle: CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: '0.74rem',
  fontWeight: 800,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 9,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const ghostButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 10px',
  borderRadius: 9,
  border: '1px solid var(--border)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '0.8rem',
}

function actionButtonStyle(primary: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '10px 13px',
    borderRadius: 10,
    border: primary ? 'none' : '1px solid var(--border)',
    background: primary ? 'linear-gradient(135deg, var(--gold), #b8860b)' : 'rgba(255,255,255,0.05)',
    color: primary ? '#000' : 'var(--text-primary)',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: '0.86rem',
  }
}

function tabButtonStyle(active: boolean): CSSProperties {
  return {
    padding: '8px 10px',
    borderRadius: 9,
    border: `1px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
    background: active ? 'rgba(201,169,110,0.12)' : 'rgba(255,255,255,0.04)',
    color: active ? 'var(--gold)' : 'var(--text-secondary)',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: '0.78rem',
  }
}

const dangerButtonStyle: CSSProperties = {
  ...ghostButtonStyle,
  color: '#ef4444',
}

const dangerIconButtonStyle: CSSProperties = {
  ...dangerButtonStyle,
  justifyContent: 'center',
  padding: '8px 9px',
}

const successPillStyle: CSSProperties = {
  padding: '7px 9px',
  borderRadius: 999,
  color: '#22c55e',
  background: 'rgba(34,197,94,0.1)',
  border: '1px solid rgba(34,197,94,0.22)',
  fontSize: '0.78rem',
  fontWeight: 800,
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
  gap: 12,
}
