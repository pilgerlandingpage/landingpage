import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local', quiet: true })
dotenv.config({ quiet: true })

const apply = process.argv.includes('--apply')
const verifyLocalArg = process.argv.find(arg => arg.startsWith('--verify-local='))
const verifyLocalBaseUrl = verifyLocalArg ? verifyLocalArg.split('=').slice(1).join('=').replace(/\/$/, '') : ''

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE

if (!supabaseUrl || !serviceKey) {
  throw new Error('Supabase env ausente. Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
})

const technicalSummaryPattern = /fallback|JSON válido|JSON valido|IA não retornou|IA nao retornou/i
const imageCreditLinkPattern = /^Fonte da imagem:[^\n]*\s[-–—]\s\[ver origem\]\((https?:\/\/[^\s)]+)\)\.?$/gim

function cleanImageCreditLinks(markdown = '') {
  return String(markdown || '').replace(imageCreditLinkPattern, line => {
    return line
      .replace(/\s[-–—]\s\[ver origem\]\((https?:\/\/[^\s)]+)\)\.?/i, '.')
      .replace(/\s+/g, ' ')
      .trim()
  })
}

function cleanMarkdownSummary(value = '') {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/<[^>]+>/g, ' ')
    .split(/\n{2,}/)
    .map(part => part.replace(/\s+/g, ' ').trim())
    .find(Boolean) || ''
}

function nextPublicSummary(post) {
  const candidates = [
    post.meta_description,
    cleanMarkdownSummary(cleanImageCreditLinks(post.content_markdown)),
  ]
  for (const candidate of candidates) {
    const text = String(candidate || '').trim()
    if (text && !technicalSummaryPattern.test(text)) return text.slice(0, 320)
  }
  return null
}

const { data, error } = await supabase
  .from('blog_posts')
  .select('id,title,slug,status,excerpt,meta_description,content_markdown,category,tags,generated_by,published_at,updated_at')
  .order('published_at', { ascending: false, nullsFirst: false })
  .limit(500)

if (error) throw error

const updates = []

for (const post of data || []) {
  const contentMarkdown = cleanImageCreditLinks(post.content_markdown || '')
  const excerpt = technicalSummaryPattern.test(post.excerpt || '')
    ? nextPublicSummary({ ...post, content_markdown: contentMarkdown })
    : post.excerpt

  const patch = {}
  if (contentMarkdown !== (post.content_markdown || '')) patch.content_markdown = contentMarkdown
  if ((excerpt || null) !== (post.excerpt || null)) patch.excerpt = excerpt

  if (Object.keys(patch).length) {
    updates.push({
      id: post.id,
      title: post.title,
      slug: post.slug,
      status: post.status,
      generated_by: post.generated_by,
      changes: Object.keys(patch),
      patch,
    })
  }
}

console.log(JSON.stringify({
  mode: apply ? 'apply' : 'dry-run',
  checked: data?.length || 0,
  updates: updates.map(({ patch, ...item }) => item),
}, null, 2))

if (apply) {
  for (const update of updates) {
    const { error: updateError } = await supabase
      .from('blog_posts')
      .update(update.patch)
      .eq('id', update.id)

    if (updateError) throw updateError
  }
  console.log(`Applied ${updates.length} update(s).`)
}

function normalize(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function isNewsPost(post) {
  const category = normalize(post.category)
  const generatedBy = normalize(post.generated_by)
  const tags = Array.isArray(post.tags) ? post.tags.map(normalize) : []
  return generatedBy.includes('news') || category.includes('noticia') || tags.some(tag => tag.includes('noticia'))
}

if (verifyLocalBaseUrl) {
  const publishedPosts = (data || []).filter(post => post.status === 'published' && post.slug)
  const pageProblems = []

  for (const post of publishedPosts) {
    const path = isNewsPost(post) ? `/noticias/${post.slug}` : `/blog/${post.slug}`
    const response = await fetch(`${verifyLocalBaseUrl}${path}`)
    const html = await response.text()
    const visibleHtml = html
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    const hasProblem = response.status >= 400
      || /ver origem/i.test(visibleHtml)
      || technicalSummaryPattern.test(visibleHtml)

    if (hasProblem) {
      pageProblems.push({
        title: post.title,
        path,
        status: response.status,
        hasVerOrigem: /ver origem/i.test(visibleHtml),
        hasTechnicalSummary: technicalSummaryPattern.test(visibleHtml),
      })
    }
  }

  console.log(JSON.stringify({
    verifyLocal: verifyLocalBaseUrl,
    checkedPages: publishedPosts.length,
    pageProblems,
  }, null, 2))
}
