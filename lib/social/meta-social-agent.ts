import { chatWithGemini } from '@/lib/gemini'
import { createAdminClient } from '@/lib/supabase/server'

type PlatformKey = 'instagram' | 'facebook'
type SourceType = 'comment' | 'message'
type SupabaseAdmin = ReturnType<typeof createAdminClient>

type InboxItem = {
  source_type: SourceType
  source_id: string
  platform: PlatformKey
  author_name: string | null
  text: string
  created_at: string | null
  context?: string | null
}

type AgentSuggestion = {
  source_type: SourceType
  source_id: string
  platform: PlatformKey
  intent: string
  sentiment: string
  priority: 'baixa' | 'normal' | 'alta' | 'urgente'
  lead_score: number
  summary: string
  suggested_reply: string
  recommended_action: string
}

const SYSTEM_PROMPT = [
  'Voce e o agente de atendimento social da Pilger Luxury Search.',
  'Sua funcao e analisar comentarios e mensagens vindos de Instagram/Facebook para identificar oportunidade imobiliaria.',
  'Classifique intencao, prioridade, score de lead e sugira uma resposta curta, natural e profissional em portugues do Brasil.',
  'Nunca prometa dados que nao estao no texto.',
  'Se a pessoa demonstrar interesse em comprar, vender, visitar, preco, condominio, dormitorios, frente mar, alto padrao ou SKU, aumente o lead_score.',
  'Se houver reclamacao, urgencia ou risco de reputacao, marque prioridade alta ou urgente.',
  'Retorne somente JSON valido.',
].join('\n')

function cleanJson(text: string) {
  return text
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim()
}

function safePriority(value: unknown): AgentSuggestion['priority'] {
  const text = String(value || '').toLowerCase()
  if (text === 'baixa' || text === 'normal' || text === 'alta' || text === 'urgente') return text
  return 'normal'
}

function normalizeScore(value: unknown) {
  const parsed = Number(value || 0)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(100, Math.max(0, Math.round(parsed)))
}

function truncate(value: string | null | undefined, max = 1200) {
  const text = String(value || '').trim()
  return text.length > max ? `${text.slice(0, max - 3)}...` : text
}

async function getExistingSuggestionKeys(supabase: SupabaseAdmin, items: InboxItem[]) {
  if (items.length === 0) return new Set<string>()

  const sourceIds = items.map(item => item.source_id)
  const { data } = await supabase
    .from('meta_social_ai_suggestions')
    .select('source_type, source_id')
    .in('source_id', sourceIds)

  return new Set(((data || []) as Array<{ source_type: string; source_id: string }>).map(item => `${item.source_type}:${item.source_id}`))
}

async function loadInboxItems(limit: number, force: boolean): Promise<InboxItem[]> {
  const supabase = createAdminClient()
  const safeLimit = Math.min(Math.max(limit, 1), 50)

  const [{ data: comments }, { data: messages }] = await Promise.all([
    supabase
      .from('meta_social_comments')
      .select('id, platform, author_name, message, commented_at, media_external_id')
      .not('message', 'is', null)
      .order('commented_at', { ascending: false, nullsFirst: false })
      .limit(safeLimit),
    supabase
      .from('meta_social_messages')
      .select('id, platform, sender_name, direction, message, sent_at')
      .eq('direction', 'inbound')
      .not('message', 'is', null)
      .order('sent_at', { ascending: false, nullsFirst: false })
      .limit(safeLimit),
  ])

  const items: InboxItem[] = [
    ...((comments || []) as any[]).map(item => ({
      source_type: 'comment' as const,
      source_id: item.id,
      platform: item.platform,
      author_name: item.author_name || null,
      text: truncate(item.message),
      created_at: item.commented_at || null,
      context: item.media_external_id ? `Comentario no conteudo ${item.media_external_id}` : null,
    })),
    ...((messages || []) as any[]).map(item => ({
      source_type: 'message' as const,
      source_id: item.id,
      platform: item.platform,
      author_name: item.sender_name || null,
      text: truncate(item.message),
      created_at: item.sent_at || null,
      context: 'Mensagem privada recebida',
    })),
  ]
    .filter(item => item.text)
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, safeLimit)

  if (force) return items

  const existing = await getExistingSuggestionKeys(supabase, items)
  return items.filter(item => !existing.has(`${item.source_type}:${item.source_id}`))
}

function buildUserPrompt(items: InboxItem[]) {
  return JSON.stringify({
    instruction: 'Analise cada item e retorne um array JSON em "items".',
    output_schema: {
      items: [{
        source_type: 'comment|message',
        source_id: 'uuid original',
        platform: 'instagram|facebook',
        intent: 'compra|venda|visita|preco|duvida|reclamacao|elogio|parceria|geral',
        sentiment: 'positivo|neutro|negativo',
        priority: 'baixa|normal|alta|urgente',
        lead_score: '0 a 100',
        summary: 'resumo curto',
        suggested_reply: 'resposta curta e pronta para enviar',
        recommended_action: 'proxima acao objetiva',
      }],
    },
    items,
  })
}

function parseSuggestions(raw: string, items: InboxItem[]): AgentSuggestion[] {
  const itemMap = new Map(items.map(item => [item.source_id, item]))

  try {
    const parsed = JSON.parse(cleanJson(raw))
    const rows = Array.isArray(parsed) ? parsed : parsed.items
    if (!Array.isArray(rows)) return []

    return rows
      .map((row: any) => {
        const sourceId = String(row?.source_id || '')
        const original = itemMap.get(sourceId)
        if (!original) return null

        return {
          source_type: original.source_type,
          source_id: original.source_id,
          platform: original.platform,
          intent: truncate(row?.intent, 60) || 'geral',
          sentiment: truncate(row?.sentiment, 40) || 'neutro',
          priority: safePriority(row?.priority),
          lead_score: normalizeScore(row?.lead_score),
          summary: truncate(row?.summary, 600),
          suggested_reply: truncate(row?.suggested_reply, 1200),
          recommended_action: truncate(row?.recommended_action, 600),
        } satisfies AgentSuggestion
      })
      .filter(Boolean) as AgentSuggestion[]
  } catch {
    return []
  }
}

async function saveSuggestions(suggestions: AgentSuggestion[], rawResponse: string) {
  if (suggestions.length === 0) return []

  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const rows = suggestions.map(item => ({
    source_type: item.source_type,
    source_id: item.source_id,
    platform: item.platform,
    intent: item.intent,
    sentiment: item.sentiment,
    priority: item.priority,
    lead_score: item.lead_score,
    summary: item.summary,
    suggested_reply: item.suggested_reply,
    recommended_action: item.recommended_action,
    raw: { model_response: rawResponse },
    updated_at: now,
  }))

  const { data, error } = await supabase
    .from('meta_social_ai_suggestions')
    .upsert(rows, { onConflict: 'source_type,source_id' })
    .select('id, source_type, source_id, platform, intent, sentiment, priority, lead_score, summary, suggested_reply, recommended_action, status, updated_at')

  if (error) throw new Error(error.message)
  return data || []
}

export async function analyzeMetaSocialInbox({
  limit = 20,
  force = false,
}: {
  limit?: number
  force?: boolean
} = {}) {
  const items = await loadInboxItems(limit, force)
  if (items.length === 0) {
    return {
      success: true,
      analyzed: 0,
      suggestions: [],
      message: 'Nao ha novos itens para analisar.',
    }
  }

  const raw = await chatWithGemini({
    systemPrompt: SYSTEM_PROMPT,
    history: [],
    userMessage: buildUserPrompt(items),
    temperature: 0.2,
    maxTokens: 4096,
  })

  const suggestions = parseSuggestions(raw, items)
  const saved = await saveSuggestions(suggestions, raw)

  return {
    success: true,
    analyzed: items.length,
    suggestions: saved,
    message: `${saved.length} sugestao(oes) geradas.`,
  }
}

export async function listMetaSocialSuggestions(limit = 40) {
  const supabase = createAdminClient()
  const safeLimit = Math.min(Math.max(limit, 1), 100)
  const { data, error } = await supabase
    .from('meta_social_ai_suggestions')
    .select('id, source_type, source_id, platform, intent, sentiment, priority, lead_score, summary, suggested_reply, recommended_action, status, updated_at')
    .order('lead_score', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(safeLimit)

  if (error) throw new Error(error.message)
  return data || []
}
