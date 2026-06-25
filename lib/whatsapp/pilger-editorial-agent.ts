import { getPublicAppUrl } from '@/lib/app-url'
import { runBlogAgentDraft } from '@/lib/blog/runner'
import { recordAgentCentralSignal, saveAgentCentralSnapshot } from '@/lib/intelligence/agent-runtime'
import { runNewsAgentDraft } from '@/lib/news/runner'
import { sendWhatsAppMessage } from '@/lib/uazapi'

type SupabaseLike = {
  from: (table: string) => any
}

type EditorialKind = 'blog' | 'news'
type EditorialAction = 'status' | 'create'

type ProcessPilgerEditorialCommandParams = {
  supabase: SupabaseLike
  command: any
  instance?: any
  instanceToken?: string | null
  origin?: string | null
  sendResponse?: boolean
}

export type ProcessPilgerEditorialCommandResult = {
  handled: boolean
  whatsappSent: boolean
  action?: EditorialAction
  kind?: EditorialKind
  postId?: string
  postTitle?: string
  status?: string
  error?: string
}

const CREATE_WORD_RE = /\b(crie|criar|gera|gerar|gere|escreva|escrever|produza|produzir|faca|fazer|monte|montar|prepare|preparar|rascunho|pauta)\b/
const STATUS_WORD_RE = /\b(qual|status|hoje|agora|andamento|ultimo|ultima|publicado|publicada|revisao|analise|temos|ver|veja)\b/

function cleanString(value: unknown, max = 3000) {
  const text = String(value || '').trim().replace(/\s+/g, ' ')
  return text.length > max ? text.slice(0, max) : text
}

function normalizeText(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferEditorialKind(command: any): EditorialKind {
  const normalized = normalizeText(command?.command_text)
  if (command?.required_permission === 'news' || command?.target_agent === 'news-intelligence') return 'news'
  return normalized.includes('noticia') || normalized.includes('noticias') ? 'news' : 'blog'
}

function inferEditorialAction(command: any): EditorialAction {
  const normalized = normalizeText(command?.command_text)
  if (CREATE_WORD_RE.test(normalized)) return 'create'
  if (STATUS_WORD_RE.test(normalized)) return 'status'
  return 'status'
}

function extractEditorialTopic(command: any, kind: EditorialKind) {
  const original = cleanString(command?.command_text, 500)
  if (!original) return undefined

  const explicitTopic = original.match(/\b(?:sobre|tema|pauta)\b\s*[:\-]?\s*(.+)$/i)?.[1]
  const candidate = cleanString(explicitTopic || original, 240)
    .replace(/\b(pilger|isadora|clara)\b/gi, ' ')
    .replace(/\b(crie|criar|gera|gerar|gere|escreva|escrever|produza|produzir|faca|fazer|monte|montar|prepare|preparar)\b/gi, ' ')
    .replace(/\b(um|uma|o|a|de|do|da|para|pra|por favor|rascunho|pauta|post|conteudo|conteudo editorial|blog|noticia)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (candidate.length >= 8) return candidate
  return kind === 'news' ? 'noticia do mercado imobiliario' : 'mercado imobiliario de alto padrao'
}

async function updateCommandStatus(
  supabase: SupabaseLike,
  commandId: string | null,
  status: string,
  result: Record<string, unknown>,
) {
  if (!commandId) return
  await supabase
    .from('whatsapp_global_commands')
    .update({
      status,
      result,
      updated_at: new Date().toISOString(),
    })
    .eq('id', commandId)
}

async function sendEditorialResponse(params: {
  phone: string
  message: string
  instanceToken?: string | null
}) {
  const phone = cleanString(params.phone, 40)
  if (!phone || !params.instanceToken) return false
  try {
    await sendWhatsAppMessage({
      phone,
      message: params.message,
      instanceToken: params.instanceToken,
    })
    return true
  } catch (error: any) {
    console.warn('[Pilger Editorial] WhatsApp response failed:', error?.message || error)
    return false
  }
}

function adminReviewUrl(post: any, kind: EditorialKind, origin?: string | null) {
  const path = kind === 'news' ? '/admin/noticias' : '/admin/blog'
  return `${getPublicAppUrl(origin)}${path}?review=${encodeURIComponent(String(post?.id || ''))}`
}

function publicPostUrl(post: any, origin?: string | null) {
  const slug = cleanString(post?.slug, 180)
  return slug ? `${getPublicAppUrl(origin)}/blog/${encodeURIComponent(slug)}` : ''
}

function statusLabel(status: unknown) {
  switch (String(status || '').toLowerCase()) {
    case 'under_review':
      return 'aguardando revisao'
    case 'published':
      return 'publicado'
    case 'archived':
      return 'arquivado'
    case 'draft':
      return 'rascunho'
    default:
      return cleanString(status, 80) || 'sem status'
  }
}

async function loadLatestEditorialPosts(supabase: SupabaseLike, kind: EditorialKind) {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('id,title,slug,status,category,primary_keyword,generated_by,created_at,updated_at,published_at')
    .order('updated_at', { ascending: false })
    .limit(12)

  if (error) throw error

  const posts = Array.isArray(data) ? data : []
  if (kind === 'news') {
    return posts.filter((post: any) => {
      const category = normalizeText(post?.category)
      const generatedBy = normalizeText(post?.generated_by)
      return category.includes('noticia') || generatedBy.includes('news')
    })
  }

  return posts.filter((post: any) => {
    const category = normalizeText(post?.category)
    const generatedBy = normalizeText(post?.generated_by)
    return !category.includes('noticia') && !generatedBy.includes('news')
  })
}

function buildStatusMessage(params: {
  command: any
  kind: EditorialKind
  posts: any[]
  origin?: string | null
}) {
  const { command, kind, posts, origin } = params
  const requester = cleanString(command?.identity_label, 80) || 'pessoal'
  const agentName = kind === 'news' ? 'Clara Edicao Noticias' : 'Isadora Edicao Blog'
  const contentLabel = kind === 'news' ? 'noticia' : 'blog'
  const preferred = posts.find(post => post?.status === 'under_review')
    || posts.find(post => post?.status === 'published')
    || posts[0]

  if (!preferred) {
    return [
      `${requester}, conversei com a ${agentName}.`,
      `Nao encontrei ${contentLabel} recente cadastrado agora. Posso pedir para ela criar um rascunho quando voce enviar o tema.`,
    ].join('\n')
  }

  const reviewLink = preferred.status === 'under_review' ? adminReviewUrl(preferred, kind, origin) : ''
  const publishedLink = preferred.status === 'published' ? publicPostUrl(preferred, origin) : ''
  const extraCount = Math.max(0, posts.length - 1)

  return [
    `${requester}, falei com a ${agentName}.`,
    `${kind === 'news' ? 'Noticia' : 'Blog'} atual: ${preferred.title || 'Sem titulo'}`,
    `Status: ${statusLabel(preferred.status)}.`,
    preferred.primary_keyword ? `Palavra-chave: ${preferred.primary_keyword}` : '',
    reviewLink ? `Link de revisao: ${reviewLink}` : '',
    publishedLink ? `Publicado: ${publishedLink}` : '',
    extraCount ? `Tambem encontrei mais ${extraCount} registro(s) editorial(is) recentes no historico.` : '',
  ].filter(Boolean).join('\n')
}

function buildCreationMessage(params: {
  command: any
  kind: EditorialKind
  post: any
  origin?: string | null
}) {
  const { command, kind, post, origin } = params
  const requester = cleanString(command?.identity_label, 80) || 'pessoal'
  const agentName = kind === 'news' ? 'Clara Edicao Noticias' : 'Isadora Edicao Blog'
  const reviewLink = adminReviewUrl(post, kind, origin)

  return [
    `${requester}, a ${agentName} ja deixou o rascunho pronto para revisao.`,
    `${kind === 'news' ? 'Noticia' : 'Blog'}: ${post?.title || 'Sem titulo'}`,
    `Status: ${statusLabel(post?.status || 'under_review')}.`,
    post?.primary_keyword ? `Palavra-chave: ${post.primary_keyword}` : '',
    `Revisar: ${reviewLink}`,
  ].filter(Boolean).join('\n')
}

async function loadPostById(supabase: SupabaseLike, postId?: string | null) {
  if (!postId) return null
  const { data, error } = await supabase
    .from('blog_posts')
    .select('id,title,slug,status,category,primary_keyword,generated_by,created_at,updated_at,published_at')
    .eq('id', postId)
    .maybeSingle()
  if (error) throw error
  return data || null
}

async function recordEditorialSignal(params: {
  supabase: SupabaseLike
  command: any
  kind: EditorialKind
  action: EditorialAction
  post?: any
  result?: Record<string, unknown>
}) {
  const agentId = params.kind === 'news' ? 'news-intelligence' : 'blog-intelligence'
  const agentName = params.kind === 'news' ? 'Clara' : 'Isadora'
  const contentLabel = params.kind === 'news' ? 'noticia' : 'blog'
  await recordAgentCentralSignal({
    supabase: params.supabase as any,
    agentId,
    eventType: params.action === 'create'
      ? 'pilger_editorial_draft_completed'
      : 'pilger_editorial_status_checked',
    entityType: params.post?.id ? 'blog_post' : 'whatsapp_global_command',
    entityId: params.post?.id || params.command?.id || null,
    source: 'pilger-editorial-agent',
    label: params.action === 'create'
      ? `${agentName} respondeu ao Pilger com rascunho de ${contentLabel}`
      : `${agentName} respondeu ao Pilger com status editorial`,
    importanceScore: params.action === 'create' ? 72 : 58,
    metadata: {
      command_id: params.command?.id || null,
      command_type: params.command?.command_type || null,
      requested_by_phone: params.command?.phone || null,
      requested_by_label: params.command?.identity_label || null,
      post_id: params.post?.id || null,
      post_title: params.post?.title || null,
      post_status: params.post?.status || null,
      editorial_kind: params.kind,
      action: params.action,
      ...(params.result || {}),
    },
    handoffTargets: ['whatsapp-global-agent', 'content-publisher-agent', 'internal-notifier'],
  }).catch((error: any) => {
    console.warn('[Pilger Editorial] central signal failed:', error?.message || error)
  })

  if (params.post?.id) {
    await saveAgentCentralSnapshot({
      supabase: params.supabase as any,
      agentId,
      scope: params.action === 'create' ? 'draft_created' : 'status_checked',
      subjectId: params.post.id,
      createdBy: 'pilger-editorial-agent',
      summary: `${agentName} retornou ao Pilger: ${params.post.title || contentLabel} esta ${statusLabel(params.post.status)}.`,
      context: {
        command_id: params.command?.id || null,
        post: params.post,
        action: params.action,
      },
      signals: {
        status: params.post.status || null,
        editorial_kind: params.kind,
        pilger_returned_to_user: true,
      },
    }).catch((error: any) => {
      console.warn('[Pilger Editorial] central snapshot failed:', error?.message || error)
    })
  }
}

export async function processPilgerEditorialCommand(
  params: ProcessPilgerEditorialCommandParams,
): Promise<ProcessPilgerEditorialCommandResult> {
  const { supabase, command } = params
  if (!command?.id) return { handled: false, whatsappSent: false, error: 'missing_command' }
  if (command.status === 'blocked') return { handled: false, whatsappSent: false, error: 'blocked_command' }
  if (command.command_type !== 'content_request') return { handled: false, whatsappSent: false }

  const kind = inferEditorialKind(command)
  const action = inferEditorialAction(command)
  const instanceToken = params.instanceToken || params.instance?.instance_token || null
  const shouldSendResponse = params.sendResponse !== false

  try {
    await updateCommandStatus(supabase, command.id, 'processing', {
      stage: 'pilger_editorial_processing_started',
      kind,
      action,
      started_at: new Date().toISOString(),
    })

    if (action === 'status') {
      const posts = await loadLatestEditorialPosts(supabase, kind)
      const preferred = posts.find(post => post?.status === 'under_review')
        || posts.find(post => post?.status === 'published')
        || posts[0]
      const result = {
        stage: 'pilger_editorial_status_completed',
        kind,
        post_count: posts.length,
        post_id: preferred?.id || null,
        post_title: preferred?.title || null,
        post_status: preferred?.status || null,
        completed_at: new Date().toISOString(),
      }

      await updateCommandStatus(supabase, command.id, 'completed', result)
      await recordEditorialSignal({ supabase, command, kind, action, post: preferred, result })

      const whatsappSent = shouldSendResponse
        ? await sendEditorialResponse({
          phone: command.phone,
          message: buildStatusMessage({ command, kind, posts, origin: params.origin }),
          instanceToken,
        })
        : false

      return {
        handled: true,
        whatsappSent,
        action,
        kind,
        postId: preferred?.id,
        postTitle: preferred?.title,
        status: preferred?.status,
      }
    }

    const topic = extractEditorialTopic(command, kind)
    const draftResult = kind === 'news'
      ? await runNewsAgentDraft({
        topic,
        origin: params.origin || null,
        source: 'whatsapp_global_pilger',
      })
      : await runBlogAgentDraft({
        topic,
        origin: params.origin || null,
        source: 'whatsapp_global_pilger',
      })
    const resultPost = await loadPostById(supabase, draftResult?.post?.id) || draftResult?.post || null
    const result = {
      stage: 'pilger_editorial_draft_completed',
      kind,
      topic: topic || null,
      post_id: resultPost?.id || draftResult?.post?.id || null,
      post_title: resultPost?.title || draftResult?.post?.title || null,
      post_status: resultPost?.status || draftResult?.post?.status || null,
      completed_at: new Date().toISOString(),
    }

    await updateCommandStatus(supabase, command.id, 'completed', result)
    await recordEditorialSignal({ supabase, command, kind, action, post: resultPost, result })

    const whatsappSent = shouldSendResponse
      ? await sendEditorialResponse({
        phone: command.phone,
        message: buildCreationMessage({ command, kind, post: resultPost || draftResult?.post, origin: params.origin }),
        instanceToken,
      })
      : false

    return {
      handled: true,
      whatsappSent,
      action,
      kind,
      postId: resultPost?.id || draftResult?.post?.id,
      postTitle: resultPost?.title || draftResult?.post?.title,
      status: resultPost?.status || draftResult?.post?.status,
    }
  } catch (error: any) {
    const message = error?.message || String(error)
    console.error('[Pilger Editorial] command failed:', message)
    await updateCommandStatus(supabase, command.id, 'failed', {
      stage: 'pilger_editorial_failed',
      kind,
      action,
      error: message,
      failed_at: new Date().toISOString(),
    }).catch(() => null)

    const agentName = kind === 'news' ? 'Clara Edicao Noticias' : 'Isadora Edicao Blog'
    const whatsappSent = shouldSendResponse
      ? await sendEditorialResponse({
        phone: command.phone,
        message: [
          `${agentName} recebeu seu pedido, mas nao conseguiu concluir agora.`,
          'O comando ficou registrado no Pilger para revisao interna.',
        ].join('\n'),
        instanceToken,
      })
      : false

    return {
      handled: true,
      whatsappSent,
      action,
      kind,
      error: message,
    }
  }
}
