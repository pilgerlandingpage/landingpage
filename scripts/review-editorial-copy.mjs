import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

dotenv.config({ path: '.env.local' })
dotenv.config()

const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const limitArg = process.argv.find(arg => arg.startsWith('--limit='))
const offsetArg = process.argv.find(arg => arg.startsWith('--offset='))
const statusArg = process.argv.find(arg => arg.startsWith('--status='))
const idsArg = process.argv.find(arg => arg.startsWith('--ids='))
const providerArg = process.argv.find(arg => arg.startsWith('--provider='))
const localOnly = args.has('--local-only')
const limit = Math.max(1, Math.min(200, Number.parseInt(limitArg?.split('=')[1] || '80', 10) || 80))
const offset = Math.max(0, Number.parseInt(offsetArg?.split('=')[1] || '0', 10) || 0)
const statusFilter = statusArg?.split('=')[1]?.trim()
const idFilter = idsArg?.split('=')[1]?.split(',').map(id => id.trim()).filter(Boolean) || []
const providerOverride = providerArg?.split('=')[1]?.trim().toLowerCase()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Supabase nao configurado. Verifique NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

const CONFIG_KEYS = [
  'ai_provider',
  'gemini_api_key',
  'gemini_model',
  'openai_api_key',
  'openai_model',
  'editorial_copy_review_provider',
]

function safeArray(value, limit = 50) {
  return Array.isArray(value) ? value.slice(0, limit) : []
}

function safeStringArray(value, fallback = [], limit = 50) {
  const source = Array.isArray(value) ? value : fallback
  return safeArray(source, limit).map(String).filter(Boolean)
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isRetryableSupabaseError(error) {
  const message = String(error?.message || error || '').toLowerCase()
  return [
    'fetch failed',
    'headers timeout',
    'connection timed out',
    'canceling statement',
    'error code 520',
    'error code 522',
    'error code 523',
    'error code 524',
    '503',
    '504',
    'timeout',
  ].some(pattern => message.includes(pattern))
}

async function runSupabase(label, queryFactory, attempts = 3) {
  let lastResult = null
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    lastResult = await queryFactory()
    if (!lastResult?.error) return lastResult
    if (!isRetryableSupabaseError(lastResult.error) || attempt === attempts) return lastResult
    console.warn(`[copy-review] ${label} falhou, tentativa ${attempt}/${attempts}: ${lastResult.error?.message || lastResult.error}`)
    await sleep(1200 * attempt)
  }
  return lastResult
}

function cleanJsonText(text) {
  return String(text || '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()
}

function compactText(value, max = 180) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1)}...` : text
}

function extractUrls(value) {
  return Array.from(String(value || '').matchAll(/https?:\/\/[^\s)\]'"<>]+/gi)).map(match => match[0])
}

function preserveUrls(text, transform) {
  const urls = []
  const protectedText = String(text || '').replace(/https?:\/\/[^\s)\]'"<>]+/gi, url => {
    const token = `__EDITORIAL_URL_${urls.length}__`
    urls.push(url)
    return token
  })
  const transformed = transform(protectedText)
  return urls.reduce((output, url, index) => output.replace(`__EDITORIAL_URL_${index}__`, url), transformed)
}

const TEXT_REPLACEMENTS = [
  [/\bBalneario\s+Camboriu\b/gi, 'Balneário Camboriú'],
  [/\bBalneário\s+Camboriu\b/gi, 'Balneário Camboriú'],
  [/\bBalneario\s+Camboriú\b/gi, 'Balneário Camboriú'],
  [/\bCamboriu\b/gi, 'Camboriú'],
  [/\bItajai\b/gi, 'Itajaí'],
  [/\bFlorianopolis\b/gi, 'Florianópolis'],
  [/\bJurere\b/gi, 'Jurerê'],
  [/\bnautico\b/gi, 'náutico'],
  [/\bnautica\b/gi, 'náutica'],
  [/\bimobiliaria\b/gi, 'imobiliária'],
  [/\bimobiliario\b/gi, 'imobiliário'],
  [/\bimobiliarios\b/gi, 'imobiliários'],
  [/\bimobiliarias\b/gi, 'imobiliárias'],
  [/\bimoveis\b/gi, 'imóveis'],
  [/\bimovel\b/gi, 'imóvel'],
  [/\bpadroes\b/gi, 'padrões'],
  [/\bpadrao\b/gi, 'padrão'],
  [/\blancamentos\b/gi, 'lançamentos'],
  [/\blancamento\b/gi, 'lançamento'],
  [/\bconstrucao\b/gi, 'construção'],
  [/\bvalorizacao\b/gi, 'valorização'],
  [/\blocalizacao\b/gi, 'localização'],
  [/\bregioes\b/gi, 'regiões'],
  [/\bregiao\b/gi, 'região'],
  [/\bdecisoes\b/gi, 'decisões'],
  [/\bdecisao\b/gi, 'decisão'],
  [/\bnoticias\b/gi, 'notícias'],
  [/\bnoticia\b/gi, 'notícia'],
  [/\bpublico\b/gi, 'público'],
  [/\bpublica\b/gi, 'pública'],
  [/\bpublicos\b/gi, 'públicos'],
  [/\bpublicas\b/gi, 'públicas'],
  [/\bestrategia\b/gi, 'estratégia'],
  [/\bexperiencia\b/gi, 'experiência'],
  [/\bcriterios\b/gi, 'critérios'],
  [/\bcriterio\b/gi, 'critério'],
  [/\btambem\b/gi, 'também'],
  [/\bdisponivel\b/gi, 'disponível'],
  [/\bavaliacao\b/gi, 'avaliação'],
  [/\brelacao\b/gi, 'relação'],
  [/\bprecos\b/gi, 'preços'],
  [/\bpreco\b/gi, 'preço'],
  [/\bproximas\b/gi, 'próximas'],
  [/\bproxima\b/gi, 'próxima'],
  [/\bproximos\b/gi, 'próximos'],
  [/\bproximo\b/gi, 'próximo'],
  [/\bsecoes\b/gi, 'seções'],
  [/\bsecao\b/gi, 'seção'],
  [/\binformacoes\b/gi, 'informações'],
  [/\binformacao\b/gi, 'informação'],
  [/\batencao\b/gi, 'atenção'],
  [/\bacoes\b/gi, 'ações'],
  [/\bacao\b/gi, 'ação'],
  [/\bvalidacao\b/gi, 'validação'],
  [/\baprovacao\b/gi, 'aprovação'],
  [/\bseguranca\b/gi, 'segurança'],
  [/\bcomparacao\b/gi, 'comparação'],
  [/\binferencia\b/gi, 'inferência'],
  [/\brecomendacao\b/gi, 'recomendação'],
  [/\bcitavel\b/gi, 'citável'],
  [/\bconfiavel\b/gi, 'confiável'],
  [/\butil\b/gi, 'útil'],
  [/\bobvio\b/gi, 'óbvio'],
  [/\bproprias\b/gi, 'próprias'],
  [/\bproprios\b/gi, 'próprios'],
  [/\borgao\b/gi, 'órgão'],
  [/\bnumero\b/gi, 'número'],
  [/\bnumeros\b/gi, 'números'],
  [/\barea\b/gi, 'área'],
  [/\bareas\b/gi, 'áreas'],
  [/\btres\b/gi, 'três'],
  [/\bate\b/gi, 'até'],
  [/\bha\b/gi, 'há'],
  [/\bso\b/gi, 'só'],
  [/\bsera\b/gi, 'será'],
]

const TITLE_LOWERCASE_WORDS = new Set([
  'Premium',
  'Definitivo',
  'Sobre',
  'O',
  'A',
  'Os',
  'As',
  'Vale',
  'Pena',
  'Apartamento',
  'Apartamentos',
  'Coberturas',
  'Penthouses',
  'Frente',
  'Mar',
  'Imóveis',
  'Imóvel',
  'Luxo',
  'Natureza',
  'Mercado',
  'Imobiliário',
  'Contexto',
  'Impacto',
  'Lideram',
  'Metro',
  'Quadrado',
  'Mais',
  'Caro',
  'Renda',
  'Fixa',
  'Comprar',
  'Investir',
  'Investimento',
  'Desejado',
  'Valorização',
  'Obras',
  'Mobilidade',
  'Turismo',
  'Náutico',
  'Litoral',
  'Catarinense',
  'Lançamentos',
  'Imobiliários',
  'Alto',
  'Padrão',
  'Curadoria',
  'Terreno',
  'Melhor',
  'Lugar',
  'Morar',
])

const PROPER_TITLE_WORDS = new Map([
  ['brasil', 'Brasil'],
  ['sc', 'SC'],
  ['santa', 'Santa'],
  ['catarina', 'Catarina'],
  ['praia', 'Praia'],
  ['brava', 'Brava'],
  ['meia', 'Meia'],
  ['itapema', 'Itapema'],
  ['porto', 'Porto'],
  ['belo', 'Belo'],
])

function applyTextReplacements(value) {
  return preserveUrls(value, text => TEXT_REPLACEMENTS.reduce(
    (output, [pattern, replacement]) => output.replace(pattern, replacement),
    String(text || '')
  ))
}

function normalizeTitleCase(value) {
  const corrected = applyTextReplacements(value).replace(/\s+/g, ' ').trim()
  if (!corrected) return corrected

  const words = corrected.split(' ')
  const normalized = words.map((word, index) => {
    const bare = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    const lowerBare = normalize(bare)
    const proper = PROPER_TITLE_WORDS.get(lowerBare)
    if (proper) return word.replace(bare, proper)
    if (index > 0 && TITLE_LOWERCASE_WORDS.has(bare)) {
      return word.replace(bare, bare.toLowerCase())
    }
    return word
  }).join(' ')

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function normalizeCategory(value) {
  const category = applyTextReplacements(value).trim()
  const normalized = normalize(category)
  if (normalized.includes('noticia')) return 'Notícias'
  if (normalized.includes('mercado imobiliario') || normalized.includes('blog')) return 'Mercado Imobiliário'
  return category
}

function localReviewPayload(original) {
  const localReviewNote = 'Revisão local aplicada para acentuação, capitalização e termos editoriais recorrentes.'
  const approvalNotes = safeStringArray(original.approval_notes)
  return {
    ...original,
    title: normalizeTitleCase(original.title),
    excerpt: applyTextReplacements(original.excerpt),
    content_markdown: applyTextReplacements(original.content_markdown),
    category: normalizeCategory(original.category),
    tags: safeStringArray(original.tags).map(applyTextReplacements),
    seo_title: normalizeTitleCase(original.seo_title || original.title),
    meta_description: applyTextReplacements(original.meta_description),
    primary_keyword: applyTextReplacements(original.primary_keyword),
    secondary_keywords: safeStringArray(original.secondary_keywords).map(applyTextReplacements),
    local_entities: safeStringArray(original.local_entities).map(applyTextReplacements),
    aeo_questions: safeArray(original.aeo_questions, 20).map(item => ({
      ...item,
      question: applyTextReplacements(item?.question || ''),
      answer: applyTextReplacements(item?.answer || ''),
    })).filter(item => item.question && item.answer),
    internal_links: safeArray(original.internal_links, 20).map(item => ({
      ...item,
      label: applyTextReplacements(item?.label || ''),
      target: String(item?.target || ''),
      reason: item?.reason ? applyTextReplacements(item.reason) : undefined,
    })).filter(item => item.label && item.target),
    approval_notes: approvalNotes.includes(localReviewNote) ? approvalNotes : [...approvalNotes, localReviewNote],
  }
}

function hasMeaningfulChanges(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after)
}

function pickPostPayload(post) {
  return {
    title: post.title || '',
    excerpt: post.excerpt || '',
    content_markdown: post.content_markdown || '',
    category: post.category || '',
    tags: safeArray(post.tags).map(String),
    seo_title: post.seo_title || '',
    meta_description: post.meta_description || '',
    primary_keyword: post.primary_keyword || '',
    secondary_keywords: safeArray(post.secondary_keywords).map(String),
    local_entities: safeArray(post.local_entities).map(String),
    aeo_questions: safeArray(post.aeo_questions, 20),
    internal_links: safeArray(post.internal_links, 20),
    approval_notes: safeArray(post.approval_notes).map(String),
  }
}

function sanitizeReview(original, reviewed) {
  const reviewedAeoQuestions = safeArray(reviewed?.aeo_questions, 20)
    .filter(item => item?.question && item?.answer)
    .map(item => ({ question: String(item.question), answer: String(item.answer) }))
  const reviewedInternalLinks = safeArray(reviewed?.internal_links, 20)
    .filter(item => item?.label && item?.target)
    .map(item => ({
      label: String(item.label),
      target: String(item.target),
      reason: item.reason ? String(item.reason) : undefined,
    }))

  const output = {
    title: String(reviewed?.title || original.title || '').trim(),
    excerpt: String(reviewed?.excerpt || original.excerpt || '').trim() || null,
    content_markdown: String(reviewed?.content_markdown || original.content_markdown || '').trim(),
    category: String(reviewed?.category || original.category || '').trim() || null,
    tags: safeStringArray(reviewed?.tags, original.tags),
    seo_title: String(reviewed?.seo_title || original.seo_title || '').trim() || null,
    meta_description: String(reviewed?.meta_description || original.meta_description || '').trim() || null,
    primary_keyword: String(reviewed?.primary_keyword || original.primary_keyword || '').trim() || null,
    secondary_keywords: safeStringArray(reviewed?.secondary_keywords, original.secondary_keywords),
    local_entities: safeStringArray(reviewed?.local_entities, original.local_entities),
    aeo_questions: reviewedAeoQuestions.length ? reviewedAeoQuestions : safeArray(original.aeo_questions, 20),
    internal_links: reviewedInternalLinks.length ? reviewedInternalLinks : safeArray(original.internal_links, 20),
    approval_notes: safeStringArray(reviewed?.approval_notes, original.approval_notes),
  }

  if (!output.content_markdown) output.content_markdown = original.content_markdown
  if (!output.title) output.title = original.title
  return output
}

function validateUrls(original, reviewed) {
  const beforeUrls = new Set([
    ...extractUrls(original.content_markdown),
    ...extractUrls(JSON.stringify(original.internal_links || [])),
  ])
  const afterUrls = new Set([
    ...extractUrls(reviewed.content_markdown),
    ...extractUrls(JSON.stringify(reviewed.internal_links || [])),
  ])
  const missing = Array.from(beforeUrls).filter(url => !afterUrls.has(url))
  return { ok: missing.length === 0, missing }
}

function restoreMissingUrls(reviewed, missingUrls) {
  if (!missingUrls.length) return reviewed
  const existingText = `${reviewed.content_markdown || ''}\n${JSON.stringify(reviewed.internal_links || [])}`
  const urlsToRestore = missingUrls.filter(url => !existingText.includes(url))
  if (!urlsToRestore.length) return reviewed

  const restoredSources = urlsToRestore
    .map((url, index) => `- [Fonte original preservada ${index + 1}](${url})`)
    .join('\n')

  return {
    ...reviewed,
    content_markdown: `${reviewed.content_markdown || ''}\n\n## Fontes preservadas\n\n${restoredSources}`.trim(),
  }
}

function mergeSourceSummary(post, before, after) {
  const current = post.source_summary && typeof post.source_summary === 'object' && !Array.isArray(post.source_summary)
    ? post.source_summary
    : {}
  const history = Array.isArray(current.copy_review_history) ? current.copy_review_history : []
  const event = {
    reviewed_at: new Date().toISOString(),
    reviewer: 'scripts/review-editorial-copy.mjs',
    changed_fields: Object.keys(before).filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key])),
    previous_title: before.title || null,
    new_title: after.title || null,
  }

  return {
    ...current,
    editorial_copy_review: event,
    copy_review_history: [event, ...history].slice(0, 12),
  }
}

async function loadConfig() {
  const { data, error } = await runSupabase('loadConfig', () => supabase
    .from('app_config')
    .select('key, value')
    .in('key', CONFIG_KEYS))
  if (error) throw error
  return Object.fromEntries((data || []).map(row => [row.key, String(row.value || '')]))
}

async function loadPosts() {
  let query = supabase
    .from('blog_posts')
    .select('id,title,slug,status,excerpt,content_markdown,category,tags,seo_title,meta_description,primary_keyword,secondary_keywords,local_entities,aeo_questions,internal_links,approval_notes,generated_by,created_at,published_at')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (idFilter.length > 0) {
    query = query.in('id', idFilter)
  } else if (statusFilter) {
    query = query.eq('status', statusFilter)
  } else {
    query = query.neq('status', 'archived')
  }

  const { data, error } = await runSupabase('loadPosts', () => query)
  if (error) throw error
  return data || []
}

async function loadPostSourceSummary(postId) {
  const { data, error } = await runSupabase('loadPostSourceSummary', () => supabase
    .from('blog_posts')
    .select('source_summary')
    .eq('id', postId)
    .maybeSingle())

  if (error) {
    console.warn('[copy-review] source summary unavailable:', error?.message || error)
    return null
  }
  return data?.source_summary || null
}

function buildInstruction() {
  return `
Você é um revisor editorial sênior da Imobiliária Guilherme Pilger.

Tarefa:
- Corrigir ortografia, acentuação, concordância, pontuação, maiúsculas/minúsculas e naturalidade em português do Brasil.
- Revisar título, resumo, SEO, categoria, tags, perguntas AEO, links internos e corpo do artigo/notícia.
- Melhorar títulos e intertítulos para ranqueamento quando for seguro: assunto + cidade/bairro/tipo de imóvel + intenção de busca.
- Manter tom premium, claro, jornalístico quando for notícia e consultivo quando for blog.
- Se houver HTML literal/escapado aparecendo como texto visível, converta para Markdown limpo mantendo o sentido.

Regras inegociaveis:
- Não invente fatos, números, fontes, datas, bairros, preços, nomes de empreendimentos ou links.
- Não altere URLs, slugs, IDs, placeholders, links Markdown, imagens Markdown ou nomes próprios.
- Não remova seções de fontes, referências, links internos, imagens ou CTAs.
- Não mude a tese editorial nem acrescente informação factual nova. Corrija escrita, capitalização e limpeza de markup quebrado.
- Preserve todos os URLs existentes exatamente.
- Retorne somente JSON válido, sem markdown fora do JSON.

Padrão de português e capitalização:
- Use acentos em termos como imóveis, imobiliário, Balneário Camboriú, Itajaí, náutico, valorização, anúncio, região, localização, decisão, notícia, construção, público, estratégia, experiência, próximo, avaliação e patrimônio.
- Use maiúscula em nomes próprios, cidades, bairros, empreendimentos, marcas e início de frase.
- Evite título todo em Title Case. Prefira frase natural em português: "Imóveis de luxo em Balneário Camboriú: como avaliar liquidez, vista e valor".
- "Brasil", "Santa Catarina", "SC", "Praia Brava", "Meia Praia", "Itapema", "Porto Belo", "Balneário Camboriú", "Itajaí", "Florianópolis" e "Jurerê Internacional" devem estar corretos.
- Categorias equivalentes podem ser corrigidas para "Mercado Imobiliário" ou "Notícias", preservando o tipo original.
- Não use "Notícia Pilger", "Blog Pilger", "Pauta Pilger", "Radar Pilger" ou "Leitura Pilger" em título, H1, SEO, resumo ou primeira chamada.

Retorne exatamente os campos:
{
  "title": "string",
  "excerpt": "string",
  "content_markdown": "string",
  "category": "string",
  "tags": ["string"],
  "seo_title": "string",
  "meta_description": "string",
  "primary_keyword": "string",
  "secondary_keywords": ["string"],
  "local_entities": ["string"],
  "aeo_questions": [{"question": "string", "answer": "string"}],
  "internal_links": [{"label": "string", "target": "string", "reason": "string"}],
  "approval_notes": ["string"]
}
`.trim()
}

async function reviewWithGemini(config, payload) {
  const apiKey = config.gemini_api_key || process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('Gemini API Key nao configurada.')
  const modelName = config.gemini_model || 'gemini-2.0-flash'
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: modelName })
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload, null, 2) }] }],
    systemInstruction: { role: 'model', parts: [{ text: buildInstruction() }] },
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  })
  return JSON.parse(cleanJsonText(result.response.text()))
}

async function reviewWithOpenAI(config, payload) {
  const apiKey = config.openai_api_key || process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OpenAI API Key nao configurada.')
  const model = config.openai_model || 'gpt-4o-mini'
  const openai = new OpenAI({ apiKey })
  const result = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: buildInstruction() },
      { role: 'user', content: JSON.stringify(payload, null, 2) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  })
  return JSON.parse(cleanJsonText(result.choices[0]?.message?.content || '{}'))
}

async function reviewPayload(config, payload) {
  if (localOnly) return localReviewPayload(payload)

  const primaryProvider = String(
    providerOverride
    || config.editorial_copy_review_provider
    || config.ai_provider
    || 'gemini'
  ).trim().toLowerCase()
  const providerOrder = Array.from(new Set([
    primaryProvider,
    primaryProvider === 'openai' ? 'gemini' : 'openai',
  ])).filter(provider => provider === 'openai' || provider === 'gemini')

  let lastError = null
  for (const provider of providerOrder) {
    try {
      if (provider === 'openai') return await reviewWithOpenAI(config, payload)
      return await reviewWithGemini(config, payload)
    } catch (error) {
      lastError = error
      const message = error?.message || String(error)
      const hasFallback = providerOrder[providerOrder.indexOf(provider) + 1]
      if (hasFallback) {
        console.warn(`[copy-review] provedor ${provider} falhou; tentando fallback: ${message}`)
        continue
      }
      throw error
    }
  }

  console.warn(`[copy-review] provedores de IA indisponiveis; usando revisao local segura: ${lastError?.message || lastError || 'sem detalhe'}`)
  return localReviewPayload(payload)
}

async function main() {
  const config = await loadConfig()
  const posts = await loadPosts()
  const results = []

  for (const [index, post] of posts.entries()) {
    const before = pickPostPayload(post)
    try {
      console.error(`[copy-review] ${offset + index + 1}/${offset + posts.length} revisando ${post.status || 'sem_status'} ${post.slug || post.id}: ${compactText(post.title, 90)}`)
      const reviewedRaw = await reviewPayload(config, {
        slug: post.slug,
        generated_by: post.generated_by,
        status: post.status,
        ...before,
      })
      let after = sanitizeReview(before, reviewedRaw)
      const firstUrlValidation = validateUrls(before, after)
      after = restoreMissingUrls(after, firstUrlValidation.missing)
      const urlValidation = validateUrls(before, after)
      if (!urlValidation.ok) {
        console.error(`[copy-review] falhou por URL alterada/removida: ${post.slug || post.id}`)
        results.push({
          id: post.id,
          title: post.title,
          ok: false,
          reason: 'url_changed_or_removed',
          missingUrls: urlValidation.missing,
        })
        continue
      }

      const changed = hasMeaningfulChanges(before, after)
      if (!apply) {
        console.error(`[copy-review] dry-run ${changed ? 'alteraria' : 'sem mudancas'}: ${post.slug || post.id}`)
        results.push({
          id: post.id,
          title: post.title,
          status: post.status,
          ok: true,
          dryRun: true,
          changed,
          beforeTitle: compactText(before.title),
          afterTitle: compactText(after.title),
          restoredUrls: firstUrlValidation.missing.length,
          changedFields: Object.keys(before).filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key])),
        })
        continue
      }

      if (!changed) {
        console.error(`[copy-review] sem mudancas: ${post.slug || post.id}`)
        results.push({ id: post.id, title: post.title, status: post.status, ok: true, changed: false, skipped: true })
        continue
      }

      const currentSourceSummary = await loadPostSourceSummary(post.id)
      const { error } = await runSupabase('updatePostCopy', () => supabase
        .from('blog_posts')
        .update({
          ...after,
          source_summary: mergeSourceSummary({ ...post, source_summary: currentSourceSummary }, before, after),
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id))

      if (error) throw error

      console.error(`[copy-review] atualizado: ${post.slug || post.id}`)
      results.push({
        id: post.id,
        title: post.title,
        status: post.status,
        ok: true,
        changed: true,
        beforeTitle: compactText(before.title),
        afterTitle: compactText(after.title),
        restoredUrls: firstUrlValidation.missing.length,
        changedFields: Object.keys(before).filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key])),
      })
    } catch (error) {
      console.error(`[copy-review] erro em ${post.slug || post.id}: ${error?.message || String(error)}`)
      results.push({ id: post.id, title: post.title, ok: false, error: error?.message || String(error) })
    }
  }

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    offset,
    total: results.length,
    changed: results.filter(result => result.ok && result.changed).length,
    unchanged: results.filter(result => result.ok && !result.changed).length,
    failed: results.filter(result => !result.ok).length,
    results,
  }
  console.log(JSON.stringify(summary, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
