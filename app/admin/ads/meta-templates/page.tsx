'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import {
  Copy,
  Edit3,
  FileText,
  ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Send,
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
  bodyText: '',
  bodyExamples: '',
  footerText: '',
  buttons: [],
  messageSendTtlSeconds: '',
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value : ''
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

function replaceTemplateVariables(text: string, values: string[]) {
  return text.replace(/{{\s*(\d+)\s*}}/g, (_, index: string) => values[Number(index) - 1] || `{{${index}}}`)
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
  compact = false,
}: {
  format: HeaderFormat
  preview: MediaPreview | null
  handle?: string
  compact?: boolean
}) {
  const activePreview = preview?.format === format ? preview : null
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

  if (activePreview && format === 'IMAGE') {
    return (
      <div style={shellStyle}>
        <img
          src={activePreview.url}
          alt={`Previa de ${activePreview.name}`}
          style={{ width: '100%', height: '100%', maxHeight: compact ? 170 : 210, objectFit: 'contain', display: 'block' }}
        />
      </div>
    )
  }

  if (activePreview && format === 'VIDEO') {
    return (
      <div style={shellStyle}>
        <video
          src={activePreview.url}
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
  const bodyExamples = useMemo(() => form.bodyExamples.split(/[;\n,]+/).map(item => item.trim()).filter(Boolean), [form.bodyExamples])

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
    const nextExamples = form.bodyExamples.split(/[;\n,]+/).map(item => item.trim()).filter(Boolean)

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
      if (bodyExamples.length < bodyVariables.length) {
        throw new Error(`Informe ${bodyVariables.length} exemplo(s) para as variaveis do corpo.`)
      }
      body.example = {
        body_text: [bodyVariables.map((_, index) => bodyExamples[index] || `exemplo_${index + 1}`)],
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
      await runAction({
        action: editingTemplate ? 'edit' : 'create',
        templateId: editingTemplate?.template_external_id,
        name,
        language: form.language,
        category: form.category,
        components,
        messageSendTtlSeconds: Number(form.messageSendTtlSeconds || 0) || undefined,
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
      ...(keepExistingHandle ? {} : { headerMediaHandle: '' }),
    })
    setMediaFileLabel('')
  }

  const uploadHeaderMedia = async (file?: File) => {
    if (!file) return
    setUploadingMedia(true)
    setFeedback(null)
    setMediaFileLabel('')
    setLocalMediaPreview(file, form.headerFormat)
    updateForm({ headerMediaHandle: '' })
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

      updateForm({ headerMediaHandle: payload.handle || '' })
      setMediaFileLabel(payload.file?.name || file.name)
      setFeedback({ type: 'success', text: payload.message || 'Midia carregada na Meta.' })
    } catch (error) {
      updateForm({ headerMediaHandle: '' })
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
                    {(mediaPreview || form.headerMediaHandle) && (
                      <HeaderMediaPreview
                        format={form.headerFormat}
                        preview={mediaPreview}
                        handle={form.headerMediaHandle}
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
                  {[
                    { label: 'Nome', example: 'Maria' },
                    { label: 'Imovel', example: 'Apartamento frente mar' },
                    { label: 'Link', example: 'https://guilhermepilger.ai/imovel' },
                    { label: 'Corretor', example: 'Guilherme Pilger' },
                  ].map(item => (
                    <button key={item.label} type="button" onClick={() => insertBodyVariable(item.example)} style={ghostButtonStyle}>
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
              <Field label={`Exemplos do corpo (${bodyVariables.map(item => `{{${item}}}`).join(', ')})`}>
                <input value={form.bodyExamples} onChange={event => updateForm({ bodyExamples: event.target.value })} placeholder="Maria; Apartamento frente mar; https://..." style={inputStyle} />
              </Field>
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
