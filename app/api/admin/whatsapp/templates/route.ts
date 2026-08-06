import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  createMetaWhatsAppTemplate,
  deleteMetaWhatsAppTemplate,
  editMetaWhatsAppTemplate,
  loadMetaWhatsAppConfigMap,
  resolveMetaWhatsAppConfig,
  syncMetaWhatsAppAssets,
  normalizeMetaWhatsAppTemplateName,
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

async function listLocalTemplates(supabase = createAdminClient()) {
  const configMap = await loadMetaWhatsAppConfigMap(supabase)
  const resolved = resolveMetaWhatsAppConfig(configMap)

  let query = supabase
    .from('meta_whatsapp_templates')
    .select('id, waba_id, template_external_id, name, language, category, status, quality_score, components, metadata, last_synced_at, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(300)

  if (resolved.wabaId) query = query.eq('waba_id', resolved.wabaId)

  const { data: templates, error } = await query
  if (error) throw error

  return {
    config: {
      enabled: resolved.enabled,
      wabaId: resolved.wabaId,
      missing: resolved.missing,
    },
    templates: templates || [],
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
}) {
  const resolved = resolveMetaWhatsAppConfig(params.configMap)
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
      const result = await deleteMetaWhatsAppTemplate({ templateId, name }, configMap)
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

        await update
      }
      return NextResponse.json({ success: true, message: 'Template excluido na Meta.', result })
    }

    return NextResponse.json({ success: false, message: 'Acao invalida.' }, { status: 400 })
  } catch (error) {
    console.error('[Meta Templates POST]', error)
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao gerenciar template Meta',
    }, { status: 500 })
  }
}
