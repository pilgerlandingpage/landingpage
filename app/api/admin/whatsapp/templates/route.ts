import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  createMetaWhatsAppTemplate,
  deleteMetaWhatsAppTemplate,
  editMetaWhatsAppTemplate,
  getMetaWhatsAppErrorInfo,
  loadMetaWhatsAppConfigMap,
  resolveMetaWhatsAppAccountConfigs,
  resolveMetaWhatsAppConfig,
  resolveMetaWhatsAppConfigForWaba,
  syncMetaWhatsAppAssets,
  normalizeMetaWhatsAppTemplateName,
  uploadMetaWhatsAppTemplateHeaderMedia,
} from '@/lib/meta/whatsapp-cloud'

const DRAFT_CONFIG_KEY = 'meta_whatsapp_template_drafts'

type TemplateDraft = {
  id: string
  name: string
  language: string
  category: string
  components: unknown[]
  form?: Record<string, unknown>
  created_at: string
  updated_at: string
}

type LocalTemplateRecord = {
  name: string
  language: string
  category: string
  status?: string | null
  components?: unknown[] | null
  metadata?: unknown
}

type ExistingTemplateRecord = {
  waba_id: string
  name: string
  language: string
  status?: string | null
  metadata?: unknown
}

function nowIso() {
  return new Date().toISOString()
}

function cleanText(value: unknown, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength)
}

function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function normalizeCategory(value: unknown) {
  const selected = cleanText(value, 40).toUpperCase()
  return ['MARKETING', 'UTILITY', 'AUTHENTICATION'].includes(selected) ? selected : 'MARKETING'
}

function asMetadata(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function normalizeLanguage(value: unknown) {
  const selected = cleanText(value || 'pt_BR', 12).replace('-', '_')
  return /^[a-z]{2}_[A-Z]{2}$/.test(selected) ? selected : 'pt_BR'
}

function isMetaApplicationLimit(error: unknown) {
  const metaError = getMetaWhatsAppErrorInfo(error)
  const message = metaError.message || ''
  return String(metaError.code || '') === '4'
    || message.includes('Application request limit reached')
    || message.includes('(#4)')
}

function formatMetaErrorDetails(error: unknown) {
  const metaError = getMetaWhatsAppErrorInfo(error)
  return [
    metaError.details ? `detalhes ${metaError.details}` : '',
    metaError.status ? `status ${metaError.status}` : '',
    metaError.code ? `codigo ${metaError.code}` : '',
    metaError.subcode ? `subcodigo ${metaError.subcode}` : '',
    metaError.type ? `tipo ${metaError.type}` : '',
    metaError.fbtraceId ? `fbtrace ${metaError.fbtraceId}` : '',
  ].filter(Boolean).join(' | ')
}

function isTemplatePayloadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  return [
    'Nome do template',
    'Template precisa',
    'Header',
    'Corpo do template',
    'variave',
    'midia',
    'botao',
    'exemplo',
    'component',
  ].some(fragment => message.toLowerCase().includes(fragment.toLowerCase()))
}

async function readDrafts(supabase = createAdminClient()): Promise<TemplateDraft[]> {
  const { data } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', DRAFT_CONFIG_KEY)
    .maybeSingle()

  try {
    const parsed = JSON.parse(String(data?.value || '[]'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeDrafts(drafts: TemplateDraft[], supabase = createAdminClient()) {
  const { error } = await supabase
    .from('app_config')
    .upsert({
      key: DRAFT_CONFIG_KEY,
      value: JSON.stringify(drafts.slice(0, 100)),
      description: 'Rascunhos internos de templates Meta WhatsApp criados no painel.',
      updated_at: nowIso(),
    }, { onConflict: 'key' })

  if (error) throw error
}

function normalizeWabaIdList(value: unknown) {
  const raw = Array.isArray(value)
    ? value
    : String(value || '').split(/[\n,;]+/g)
  return Array.from(new Set(raw.map(item => cleanText(item, 120)).filter(Boolean)))
}

function firstTemplateExampleList(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.isArray(value[0]) ? value[0] : value
}

function inferHeaderMediaFileType(headerFormat: string, responseType: string) {
  const contentType = cleanText(responseType, 120).toLowerCase().split(';')[0]?.trim()
  if (contentType && contentType !== 'application/octet-stream') return contentType
  if (headerFormat === 'VIDEO') return 'video/mp4'
  if (headerFormat === 'DOCUMENT') return 'application/pdf'
  return 'image/jpeg'
}

async function refreshTemplateHeaderMediaHandles(input: {
  template: LocalTemplateRecord
  configMap: Record<string, string | undefined>
  cache: Map<string, string>
}) {
  const components = safeArray(input.template.components).map(component => (
    typeof component === 'object' && component !== null && !Array.isArray(component)
      ? { ...(component as Record<string, unknown>) }
      : component
  ))

  for (const component of components) {
    if (typeof component !== 'object' || component === null || Array.isArray(component)) continue
    const record = component as Record<string, unknown>
    const type = cleanText(record.type, 30).toUpperCase()
    const format = cleanText(record.format, 30).toUpperCase()
    if (type !== 'HEADER' || !['IMAGE', 'VIDEO', 'DOCUMENT'].includes(format)) continue

    const example = asMetadata(record.example)
    const sourceUrl = cleanText(firstTemplateExampleList(example.header_handle)[0], 2000)
    if (!/^https?:\/\//i.test(sourceUrl)) continue

    const cacheKey = `${format}:${sourceUrl}`
    let handle = input.cache.get(cacheKey)
    if (!handle) {
      const mediaResponse = await fetch(sourceUrl, { cache: 'no-store' })
      if (!mediaResponse.ok) {
        throw new Error(`Nao foi possivel baixar a midia do template ${input.template.name} (${mediaResponse.status}).`)
      }

      const fileType = inferHeaderMediaFileType(format, mediaResponse.headers.get('content-type') || '')
      const upload = await uploadMetaWhatsAppTemplateHeaderMedia({
        fileName: `${input.template.name}.${fileType.split('/')[1] || 'jpg'}`.slice(0, 180),
        fileType,
        fileBuffer: Buffer.from(await mediaResponse.arrayBuffer()),
        config: input.configMap,
      })
      handle = upload.handle
      input.cache.set(cacheKey, handle)
    }

    record.example = {
      ...example,
      header_handle: [handle],
    }
  }

  return components
}

async function listLocalTemplates(supabase = createAdminClient()) {
  const configMap = await loadMetaWhatsAppConfigMap(supabase)
  const resolved = resolveMetaWhatsAppConfig(configMap)
  const accounts = resolveMetaWhatsAppAccountConfigs(configMap)
    .filter(account => account.enabled && !account.missing.length)
  const visibleWabaIds = Array.from(new Set(
    (accounts.length ? accounts.map(account => account.wabaId) : [resolved.wabaId])
      .filter(Boolean)
  ))

  let query = supabase
    .from('meta_whatsapp_templates')
    .select('id, waba_id, template_external_id, name, language, category, status, quality_score, components, metadata, last_synced_at, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(300)

  if (visibleWabaIds.length) query = query.in('waba_id', visibleWabaIds)

  const { data: templates, error } = await query
  if (error) throw error
  const visibleTemplates = (templates || []).filter((template: any) => {
    const metadata = asMetadata(template.metadata)
    return !metadata.hidden_from_panel_at
      && !metadata.deleted_from_panel_at
      && !metadata.deleted_from_meta_at
  })

  return {
    config: {
      enabled: resolved.enabled,
      wabaId: resolved.wabaId,
      accounts: accounts.map(account => ({
        wabaId: account.wabaId,
        label: account.label,
        primary: account.primary,
      })),
      missing: resolved.missing,
    },
    templates: visibleTemplates,
    drafts: await readDrafts(supabase),
  }
}

async function markTemplateManagedFromPanel(params: {
  supabase: ReturnType<typeof createAdminClient>
  configMap: Record<string, string | undefined>
  templateName: unknown
  language: unknown
  category?: unknown
  components?: unknown[]
  templateId?: unknown
  result?: unknown
  panelHeaderMedia?: unknown
  wabaId?: unknown
}) {
  const requestedWabaId = cleanText(params.wabaId, 120)
  const resolved = resolveMetaWhatsAppConfigForWaba(params.configMap, requestedWabaId)
  const name = normalizeMetaWhatsAppTemplateName(params.templateName)
  const language = normalizeLanguage(params.language || resolved.defaultLanguage)
  const templateId = cleanText(params.templateId, 120)

  if (!resolved.wabaId || !name) return

  const { data: existing } = await params.supabase
    .from('meta_whatsapp_templates')
    .select('id, metadata, template_external_id, status')
    .eq('waba_id', resolved.wabaId)
    .eq('name', name)
    .eq('language', language)
    .maybeSingle()

  const existingMetadata = asMetadata(existing?.metadata)
  const panelHeaderMedia = asMetadata(params.panelHeaderMedia)
  const panelHeaderMediaUrl = cleanText(panelHeaderMedia.url, 2000)
  const panelHeaderMediaPatch = panelHeaderMediaUrl ? {
    panel_header_media: {
      url: panelHeaderMediaUrl,
      r2Key: cleanText(panelHeaderMedia.r2Key || panelHeaderMedia.r2_key, 500),
      handle: cleanText(panelHeaderMedia.handle, 5000),
      fileName: cleanText(panelHeaderMedia.fileName || panelHeaderMedia.file_name, 255),
      contentType: cleanText(panelHeaderMedia.contentType || panelHeaderMedia.content_type, 120),
      headerFormat: cleanText(panelHeaderMedia.headerFormat || panelHeaderMedia.header_format, 30).toUpperCase(),
      uploadedAt: cleanText(panelHeaderMedia.uploadedAt || panelHeaderMedia.uploaded_at, 80) || nowIso(),
    },
    header_media_url: panelHeaderMediaUrl,
    header_media_r2_key: cleanText(panelHeaderMedia.r2Key || panelHeaderMedia.r2_key, 500),
    header_media_type: cleanText(panelHeaderMedia.contentType || panelHeaderMedia.content_type, 120),
    header_format: cleanText(panelHeaderMedia.headerFormat || panelHeaderMedia.header_format, 30).toUpperCase(),
  } : {}

  await params.supabase
    .from('meta_whatsapp_templates')
    .upsert({
      waba_id: resolved.wabaId,
      template_external_id: templateId || cleanText((params.result as any)?.id, 120) || existing?.template_external_id || null,
      name,
      language,
      category: normalizeCategory(params.category),
      status: cleanText((params.result as any)?.status, 60) || existing?.status || 'PENDING',
      components: safeArray(params.components),
      metadata: {
        ...existingMetadata,
        managed_from_panel: true,
        created_from_panel: true,
        created_from_panel_at: existingMetadata.created_from_panel_at || nowIso(),
        last_panel_mutation_at: nowIso(),
        panel_mutation_response: params.result || null,
        ...panelHeaderMediaPatch,
      },
      updated_at: nowIso(),
    }, { onConflict: 'waba_id,name,language' })
}

export async function GET() {
  try {
    const supabase = createAdminClient()
    const result = await listLocalTemplates(supabase)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[Meta Templates GET]', error)
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao listar templates Meta',
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()
    const action = cleanText(body.action, 40)
    const configMap = await loadMetaWhatsAppConfigMap(supabase)

    if (action === 'sync') {
      const sync = await syncMetaWhatsAppAssets(configMap, supabase)
      const result = await listLocalTemplates(supabase)
      return NextResponse.json({
        success: true,
        message: `Sincronizado: ${sync.templateCount} template(s) e ${sync.senderCount} numero(s).`,
        sync,
        ...result,
      })
    }

    if (action === 'clone_to_wabas') {
      const sourceWabaId = cleanText(body.sourceWabaId || body.source_waba_id, 120)
      const targetWabaIds = normalizeWabaIdList(body.targetWabaIds || body.target_waba_ids || body.targetWabaId || body.target_waba_id)
        .filter(wabaId => wabaId !== sourceWabaId)
      const selectedTemplateNames = normalizeWabaIdList(body.templateNames || body.template_names || body.names)
      const refreshHeaderMedia = Boolean(body.refreshHeaderMediaHandles || body.refresh_header_media_handles)
      const pauseMs = Math.min(Math.max(Number(body.pauseMs || body.pause_ms || 250), 0), 5000)

      if (!sourceWabaId) {
        return NextResponse.json({ success: false, message: 'WABA de origem obrigatoria.' }, { status: 400 })
      }
      if (!targetWabaIds.length) {
        return NextResponse.json({ success: false, message: 'Informe ao menos uma WABA de destino.' }, { status: 400 })
      }

      const { data: sourceTemplates, error: sourceError } = await supabase
        .from('meta_whatsapp_templates')
        .select('name, language, category, status, components, metadata')
        .eq('waba_id', sourceWabaId)
        .eq('status', 'APPROVED')
        .order('name', { ascending: true })
        .limit(200)

      if (sourceError) throw sourceError

      const templates = ((sourceTemplates || []) as LocalTemplateRecord[]).filter(template => {
        const metadata = asMetadata(template.metadata)
        return !metadata.deleted_from_panel_at
          && !metadata.deleted_from_meta_at
          && (!selectedTemplateNames.length || selectedTemplateNames.includes(template.name))
      })
      const names = Array.from(new Set(templates.map(template => template.name).filter(Boolean)))
      let existingKeys = new Set<string>()

      if (names.length) {
        const { data: existing, error: existingError } = await supabase
          .from('meta_whatsapp_templates')
          .select('waba_id, name, language, status, metadata')
          .in('waba_id', targetWabaIds)
          .in('name', names)
          .limit(1000)

        if (existingError) throw existingError
        existingKeys = new Set(((existing || []) as ExistingTemplateRecord[])
          .filter(template => {
            const metadata = asMetadata(template.metadata)
            return String(template.status || '').toLowerCase() !== 'deleted'
              && !metadata.deleted_from_panel_at
              && !metadata.deleted_from_meta_at
          })
          .map(template => `${template.waba_id}:${template.name}:${template.language}`))
      }

      const cloneResults: Array<Record<string, unknown>> = []
      const mediaHandleCache = new Map<string, string>()
      let rateLimited = false

      for (const targetWabaId of targetWabaIds) {
        for (const template of templates) {
          const key = `${targetWabaId}:${template.name}:${template.language}`
          if (existingKeys.has(key)) {
            cloneResults.push({
              targetWabaId,
              templateName: template.name,
              language: template.language,
              status: 'skipped',
              reason: 'already_exists',
            })
            continue
          }

          try {
            const components = refreshHeaderMedia
              ? await refreshTemplateHeaderMediaHandles({ template, configMap, cache: mediaHandleCache })
              : safeArray(template.components)
            const result = await createMetaWhatsAppTemplate({
              name: template.name,
              language: template.language,
              category: template.category,
              components,
              wabaId: targetWabaId,
            }, configMap)
            await markTemplateManagedFromPanel({
              supabase,
              configMap,
              templateName: template.name,
              language: template.language,
              category: template.category,
              components,
              wabaId: targetWabaId,
              result,
            })
            cloneResults.push({
              targetWabaId,
              templateName: template.name,
              language: template.language,
              status: 'submitted',
              providerStatus: result.status || null,
              providerId: result.id || null,
            })
            existingKeys.add(key)
          } catch (error) {
            const limited = isMetaApplicationLimit(error)
            rateLimited = rateLimited || limited
            cloneResults.push({
              targetWabaId,
              templateName: template.name,
              language: template.language,
              status: 'failed',
              retryable: limited,
              message: getMetaWhatsAppErrorInfo(error).userMessage || (error instanceof Error ? error.message : String(error)),
            })
            if (limited) break
          }

          if (pauseMs > 0) await new Promise(resolve => setTimeout(resolve, pauseMs))
        }
        if (rateLimited) break
      }

      const sync = await syncMetaWhatsAppAssets(configMap, supabase)
      const submitted = cloneResults.filter(result => result.status === 'submitted').length
      const skipped = cloneResults.filter(result => result.status === 'skipped').length
      const failed = cloneResults.filter(result => result.status === 'failed').length
      return NextResponse.json({
        success: failed === 0 || submitted > 0,
        message: `Clonagem enviada: ${submitted} template(s), ${skipped} ja existentes, ${failed} falha(s).`,
        sourceWabaId,
        targetWabaIds,
        counts: {
          sourceTemplates: templates.length,
          submitted,
          skipped,
          failed,
        },
        rateLimited,
        results: cloneResults,
        sync,
      }, { status: failed > 0 && submitted === 0 ? 400 : 200 })
    }

    if (action === 'save_draft') {
      const drafts = await readDrafts(supabase)
      const id = cleanText(body.id, 80) || `draft_${Date.now()}`
      const existing = drafts.find(draft => draft.id === id)
      const draft: TemplateDraft = {
        id,
        name: normalizeMetaWhatsAppTemplateName(body.name),
        language: cleanText(body.language, 20) || 'pt_BR',
        category: normalizeCategory(body.category),
        components: safeArray(body.components),
        form: typeof body.form === 'object' && body.form !== null ? body.form : undefined,
        created_at: existing?.created_at || nowIso(),
        updated_at: nowIso(),
      }

      if (!draft.name) {
        return NextResponse.json({ success: false, message: 'Nome do rascunho obrigatorio.' }, { status: 400 })
      }

      const nextDrafts = [draft, ...drafts.filter(item => item.id !== id)]
      await writeDrafts(nextDrafts, supabase)
      return NextResponse.json({ success: true, message: 'Rascunho salvo no painel.', drafts: nextDrafts, draft })
    }

    if (action === 'delete_draft') {
      const id = cleanText(body.id, 80)
      const drafts = await readDrafts(supabase)
      const nextDrafts = drafts.filter(draft => draft.id !== id)
      await writeDrafts(nextDrafts, supabase)
      return NextResponse.json({ success: true, message: 'Rascunho removido.', drafts: nextDrafts })
    }

    if (action === 'create') {
      const normalizedName = normalizeMetaWhatsAppTemplateName(body.name)
      const normalizedLanguage = normalizeLanguage(body.language)
      const components = safeArray(body.components)
      const result = await createMetaWhatsAppTemplate({
        name: normalizedName,
        language: normalizedLanguage,
        category: body.category,
        components,
        wabaId: body.wabaId || body.waba_id,
        messageSendTtlSeconds: Number(body.messageSendTtlSeconds || 0) || undefined,
      }, configMap)
      const sync = await syncMetaWhatsAppAssets(configMap, supabase)
      await markTemplateManagedFromPanel({
        supabase,
        configMap,
        templateName: normalizedName,
        language: normalizedLanguage,
        category: body.category,
        components,
        wabaId: body.wabaId || body.waba_id,
        panelHeaderMedia: body.panelHeaderMedia,
        result,
      })
      return NextResponse.json({
        success: true,
        message: 'Template enviado para aprovacao da Meta.',
        result,
        sync,
      })
    }

    if (action === 'edit') {
      const components = safeArray(body.components)
      const result = await editMetaWhatsAppTemplate({
        templateId: body.templateId || body.template_external_id,
        category: body.category,
        components,
        wabaId: body.wabaId || body.waba_id,
        messageSendTtlSeconds: Number(body.messageSendTtlSeconds || 0) || undefined,
      }, configMap)
      const sync = await syncMetaWhatsAppAssets(configMap, supabase)
      await markTemplateManagedFromPanel({
        supabase,
        configMap,
        templateName: body.name,
        language: body.language,
        category: body.category,
        components,
        templateId: body.templateId || body.template_external_id,
        wabaId: body.wabaId || body.waba_id,
        panelHeaderMedia: body.panelHeaderMedia,
        result,
      })
      return NextResponse.json({
        success: true,
        message: 'Template atualizado na Meta. Ele pode voltar para analise.',
        result,
        sync,
      })
    }

    if (action === 'delete') {
      const templateId = cleanText(body.templateId || body.template_external_id, 120)
      const name = normalizeMetaWhatsAppTemplateName(body.name)
      const requestedWabaId = cleanText(body.wabaId || body.waba_id, 120)
      const result = await deleteMetaWhatsAppTemplate({ templateId, name, wabaId: requestedWabaId || undefined }, configMap)
      if (templateId || name) {
        let update = supabase
          .from('meta_whatsapp_templates')
          .update({
            status: 'deleted',
            metadata: {
              deleted_from_panel_at: nowIso(),
              meta_delete_response: result,
            },
            updated_at: nowIso(),
          })

        update = templateId
          ? update.eq('template_external_id', templateId)
          : update.eq('name', name)
        if (requestedWabaId) update = update.eq('waba_id', requestedWabaId)

        await update
      }
      return NextResponse.json({ success: true, message: 'Template excluido na Meta.', result })
    }

    return NextResponse.json({ success: false, message: 'Acao invalida.' }, { status: 400 })
  } catch (error) {
    console.error('[Meta Templates POST]', error)
    const limited = isMetaApplicationLimit(error)
    const metaError = getMetaWhatsAppErrorInfo(error)
    const details = formatMetaErrorDetails(error)
    const status = limited
      ? 429
      : metaError.status && metaError.status >= 400 && metaError.status < 500
        ? 400
        : isTemplatePayloadError(error)
          ? 400
        : 500
    const message = limited
      ? 'A Meta bloqueou temporariamente a criacao do template por limite de requisicoes do App ID. Aguarde o limite reduzir ou configure um Meta WhatsApp App ID dedicado na sala de manutencao.'
      : [
          metaError.userMessage || metaError.message || 'Erro ao gerenciar template Meta',
          details ? `Detalhes: ${details}` : '',
        ].filter(Boolean).join(' ')

    return NextResponse.json({
      success: false,
      retryable: limited,
      message,
      details,
      metaError,
    }, { status })
  }
}
