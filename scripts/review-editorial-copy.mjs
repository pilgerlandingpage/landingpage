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
const limit = Math.max(1, Math.min(200, Number.parseInt(limitArg?.split('=')[1] || '80', 10) || 80))
const offset = Math.max(0, Number.parseInt(offsetArg?.split('=')[1] || '0', 10) || 0)
const statusFilter = statusArg?.split('=')[1]?.trim()
const idFilter = idsArg?.split('=')[1]?.split(',').map(id => id.trim()).filter(Boolean) || []

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
]

function safeArray(value, limit = 50) {
  return Array.isArray(value) ? value.slice(0, limit) : []
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
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
  const output = {
    title: String(reviewed?.title || original.title || '').trim(),
    excerpt: String(reviewed?.excerpt || original.excerpt || '').trim() || null,
    content_markdown: String(reviewed?.content_markdown || original.content_markdown || '').trim(),
    category: original.category || null,
    tags: safeArray(reviewed?.tags).map(String).filter(Boolean),
    seo_title: String(reviewed?.seo_title || original.seo_title || '').trim() || null,
    meta_description: String(reviewed?.meta_description || original.meta_description || '').trim() || null,
    primary_keyword: String(reviewed?.primary_keyword || original.primary_keyword || '').trim() || null,
    secondary_keywords: safeArray(reviewed?.secondary_keywords).map(String).filter(Boolean),
    local_entities: safeArray(reviewed?.local_entities).map(String).filter(Boolean),
    aeo_questions: safeArray(reviewed?.aeo_questions, 20)
      .filter(item => item?.question && item?.answer)
      .map(item => ({ question: String(item.question), answer: String(item.answer) })),
    internal_links: safeArray(reviewed?.internal_links, 20)
      .filter(item => item?.label && item?.target)
      .map(item => ({
        label: String(item.label),
        target: String(item.target),
        reason: item.reason ? String(item.reason) : undefined,
      })),
    approval_notes: safeArray(reviewed?.approval_notes).map(String).filter(Boolean),
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
  const { data, error } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', CONFIG_KEYS)
  if (error) throw error
  return Object.fromEntries((data || []).map(row => [row.key, String(row.value || '')]))
}

async function loadPosts() {
  let query = supabase
    .from('blog_posts')
    .select('id,title,slug,status,excerpt,content_markdown,category,tags,seo_title,meta_description,primary_keyword,secondary_keywords,local_entities,aeo_questions,internal_links,approval_notes,source_summary,generated_by,created_at,published_at')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (idFilter.length > 0) {
    query = query.in('id', idFilter)
  } else if (statusFilter) {
    query = query.eq('status', statusFilter)
  } else {
    query = query.neq('status', 'archived')
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

function buildInstruction() {
  return `
Voce e um revisor editorial senior da Imobiliaria Guilherme Pilger.

Tarefa:
- Corrigir ortografia, acentuacao, concordancia, pontuacao e naturalidade em portugues do Brasil.
- Revisar titulo, resumo, SEO, categoria, tags, perguntas AEO, links internos e corpo do artigo/noticia.
- Manter tom premium, claro, jornalistico quando for noticia e consultivo quando for blog.
- Se houver HTML literal/escapado aparecendo como texto visivel, converta para Markdown limpo mantendo o sentido.

Regras inegociaveis:
- Nao invente fatos, numeros, fontes, datas, bairros, precos, nomes de empreendimentos ou links.
- Nao altere URLs, slugs, IDs, placeholders, links Markdown, imagens Markdown ou nomes proprios.
- Nao remova secoes de fontes, referencias, links internos, imagens ou CTAs.
- Nao mude a estrategia editorial. Corrija apenas a escrita e limpeza de markup quebrado.
- Preserve todos os URLs existentes exatamente.
- Retorne somente JSON valido, sem markdown fora do JSON.

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
  const provider = String(config.ai_provider || 'gemini').trim().toLowerCase()
  if (provider === 'openai') return reviewWithOpenAI(config, payload)
  return reviewWithGemini(config, payload)
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

      const { error } = await supabase
        .from('blog_posts')
        .update({
          ...after,
          source_summary: mergeSourceSummary(post, before, after),
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id)

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
