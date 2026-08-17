#!/usr/bin/env node

import dotenv from 'dotenv'
import { mkdir, writeFile } from 'fs/promises'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })
dotenv.config()

const APPLY = process.argv.includes('--apply')
const PAGE_SIZE = 1000
const NOW = new Date()
const STAMP = NOW.toISOString().replace(/[-:.]/g, '').slice(0, 15)
const OUTPUT_PREFIX = `output/development-data-quality-${STAMP}`

const AUTO_REMOVE_IMAGE_DOMAINS = new Set([
  'invictaimoveisbc.com.br',
  'chavesnamao.com.br',
  'static.arboimoveis.com.br',
])

const REVIEW_IMAGE_DOMAINS = new Set([
  'cdn.imoview.com.br',
  'cdn.vistahost.com.br',
  'img.apre.me',
  'litoralvertical.com',
  'rocket.myside.com.br',
  's01.jetimgs.com',
])

const IMAGE_KEYS = new Set([
  'cover',
  'cover_image',
  'custom_hero_image',
  'featured_image',
  'heroImage',
  'hero_image',
  'image',
  'images',
  'logo',
  'og_image',
  'photo',
  'src',
  'thumbnail',
  'thumbnail_url',
  'url',
])

const TECHNICAL_KEYS = new Set([
  'id',
  'pageSlug',
  'page_slug',
  'propertyId',
  'property_id',
  'slug',
  'sourceSlug',
  'source_slug',
])

const WORD_REPLACEMENTS = [
  ['Itajai', 'Itajaí'],
  ['Balneario', 'Balneário'],
  ['Camboriu', 'Camboriú'],
  ['Endereco', 'Endereço'],
  ['endereco', 'endereço'],
  ['Localizacao', 'Localização'],
  ['localizacao', 'localização'],
  ['Configuracao', 'Configuração'],
  ['configuracao', 'configuração'],
  ['Caracteristicas', 'Características'],
  ['caracteristicas', 'características'],
  ['Diferenciais', 'Diferenciais'],
  ['Disponivel', 'Disponível'],
  ['disponivel', 'disponível'],
  ['Disponiveis', 'Disponíveis'],
  ['disponiveis', 'disponíveis'],
  ['Imovel', 'Imóvel'],
  ['imovel', 'imóvel'],
  ['Imoveis', 'Imóveis'],
  ['imoveis', 'imóveis'],
  ['Condominio', 'Condomínio'],
  ['condominio', 'condomínio'],
  ['Condominios', 'Condomínios'],
  ['condominios', 'condomínios'],
  ['Predio', 'Prédio'],
  ['predio', 'prédio'],
  ['Predios', 'Prédios'],
  ['predios', 'prédios'],
  ['Padrao', 'Padrão'],
  ['padrao', 'padrão'],
  ['Preco', 'Preço'],
  ['preco', 'preço'],
  ['Area', 'Área'],
  ['area', 'área'],
  ['Areas', 'Áreas'],
  ['areas', 'áreas'],
  ['Suite', 'Suíte'],
  ['suite', 'suíte'],
  ['Suites', 'Suítes'],
  ['suites', 'suítes'],
  ['Dormitorios', 'Dormitórios'],
  ['dormitorios', 'dormitórios'],
  ['Opcoes', 'Opções'],
  ['opcoes', 'opções'],
  ['Opcao', 'Opção'],
  ['opcao', 'opção'],
  ['Posicao', 'Posição'],
  ['posicao', 'posição'],
  ['Atencao', 'Atenção'],
  ['atencao', 'atenção'],
  ['Decisao', 'Decisão'],
  ['decisao', 'decisão'],
  ['Frequencia', 'Frequência'],
  ['frequencia', 'frequência'],
  ['Condicoes', 'Condições'],
  ['condicoes', 'condições'],
  ['Regiao', 'Região'],
  ['regiao', 'região'],
  ['Servicos', 'Serviços'],
  ['servicos', 'serviços'],
  ['Conexao', 'Conexão'],
  ['conexao', 'conexão'],
  ['Rapida', 'Rápida'],
  ['rapida', 'rápida'],
  ['Rapido', 'Rápido'],
  ['rapido', 'rápido'],
  ['Publica', 'Pública'],
  ['publica', 'pública'],
  ['Publico', 'Público'],
  ['publico', 'público'],
  ['Propria', 'Própria'],
  ['propria', 'própria'],
  ['Pagina', 'Página'],
  ['pagina', 'página'],
  ['Proximas', 'Próximas'],
  ['proximas', 'próximas'],
  ['Proximo', 'Próximo'],
  ['proximo', 'próximo'],
  ['Proxima', 'Próxima'],
  ['proxima', 'próxima'],
  ['Proximos', 'Próximos'],
  ['proximos', 'próximos'],
  ['Seguranca', 'Segurança'],
  ['seguranca', 'segurança'],
  ['Comparacao', 'Comparação'],
  ['comparacao', 'comparação'],
  ['Unica', 'Única'],
  ['unica', 'única'],
  ['Tambem', 'Também'],
  ['tambem', 'também'],
  ['Informacoes', 'Informações'],
  ['informacoes', 'informações'],
  ['Edificio', 'Edifício'],
  ['edificio', 'edifício'],
  ['Carater', 'Caráter'],
  ['carater', 'caráter'],
  ['Reune', 'Reúne'],
  ['reune', 'reúne'],
  ['Ate', 'Até'],
  ['ate', 'até'],
  ['Pe', 'Pé'],
  ['pe', 'pé'],
  ['Nao', 'Não'],
  ['nao', 'não'],
  ['Voce', 'Você'],
  ['voce', 'você'],
]

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

const supabase = createClient(
  requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
  requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false } }
)

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeKey(value) {
  return String(value || '').toLowerCase()
}

function isUrlLike(value) {
  return /^https?:\/\//i.test(value) || value.startsWith('/') || value.startsWith('data:')
}

function domainOf(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

function replaceWord(value, wrong, correct) {
  return value.replace(new RegExp(`\\b${wrong}\\b`, 'g'), correct)
}

function normalizePublicText(value) {
  if (!value || isUrlLike(value)) return value
  let next = value

  next = next
    .replace(/(\d)\s*m2\b/gi, '$1 m²')
    .replace(/\bOla\b/g, 'Olá')
    .replace(/\bDa para\b/g, 'Dá para')
    .replace(/\bha\b/g, 'há')
    .replace(/\bHa\b/g, 'Há')
    .replace(/\be um empreendimento\b/g, 'é um empreendimento')
    .replace(/\be uma vitrine\b/g, 'é uma vitrine')
    .replace(/\bEle e\b/g, 'Ele é')
    .replace(/\bele e\b/g, 'ele é')
    .replace(/\bEntao\b/g, 'Então')
    .replace(/\bentao\b/g, 'então')

  for (const [wrong, correct] of WORD_REPLACEMENTS) {
    next = replaceWord(next, wrong, correct)
  }

  return next
}

function normalizeObjectStrings(value, keyPath = []) {
  const key = normalizeKey(keyPath[keyPath.length - 1] || '')

  if (typeof value === 'string') {
    if (IMAGE_KEYS.has(key) || TECHNICAL_KEYS.has(key)) return value
    return normalizePublicText(value)
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => normalizeObjectStrings(item, [...keyPath, String(index)]))
  }

  if (!asRecord(value) || value === null) return value

  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      normalizeObjectStrings(entryValue, [...keyPath, entryKey]),
    ])
  )
}

function imageFromItem(item) {
  if (typeof item === 'string') return item
  const record = asRecord(item)
  return text(record.image ?? record.url ?? record.src)
}

function filterGallery(value, removed, pageSlug) {
  if (!Array.isArray(value)) return value

  return value.filter((item) => {
    const image = imageFromItem(item)
    const domain = domainOf(image)
    if (!domain || !AUTO_REMOVE_IMAGE_DOMAINS.has(domain)) return true
    removed.push({ slug: pageSlug, image, domain, reason: 'auto_remove_competitor_or_portal_domain' })
    return false
  })
}

function collectImageDomains(content, slug) {
  const development = asRecord(content.development)
  const images = [
    development.heroImage,
    development.hero_image,
    content.custom_hero_image,
    ...asArray(content.custom_gallery).map(imageFromItem),
    ...asArray(development.gallery).map(imageFromItem),
  ].filter(Boolean)

  return images.map((image) => ({
    slug,
    image,
    domain: domainOf(image),
  })).filter(item => item.domain)
}

function removeUnsafeImages(content, slug) {
  const next = structuredClone(content)
  const removed = []
  const development = asRecord(next.development)

  if (slug === 'westarb-business-park') {
    const seo = asRecord(next.seo)
    for (const image of [
      development.heroImage,
      development.hero_image,
      next.custom_hero_image,
      seo.og_image,
      seo.image,
      ...asArray(next.custom_gallery).map(imageFromItem),
      ...asArray(development.gallery).map(imageFromItem),
    ].filter(Boolean)) {
      removed.push({ slug, image, domain: domainOf(image), reason: 'unit_photos_used_as_development_gallery' })
    }

    delete next.custom_hero_image
    next.custom_gallery = []
    development.gallery = []
    delete development.heroImage
    delete development.hero_image
    delete seo.og_image
    delete seo.image
    const curatedDescription = 'Westarb Business Park é um empreendimento comercial em Limeira Baixa, Brusque - SC, indicado para empresas que buscam endereço funcional, apoio logístico e leitura objetiva de acesso regional. As imagens do empreendimento ficam em curadoria para evitar fotos internas de unidades ou mídias de terceiros.'
    next.custom_description = curatedDescription
    next.meta_description = curatedDescription
    seo.description = curatedDescription
    development.description = curatedDescription
    development.benefits = [
      {
        icon: 'Building2',
        title: 'Perfil empresarial',
        description: 'Empreendimento voltado a operação comercial, armazenagem e rotina corporativa em Brusque.',
      },
      {
        icon: 'MapPin',
        title: 'Contexto regional',
        description: 'Localização em Limeira Baixa, com leitura de acesso para empresas que avaliam logística e mobilidade.',
      },
      {
        icon: 'ShieldCheck',
        title: 'Curadoria de disponibilidade',
        description: 'Unidades e condições são conferidas com a equipe Guilherme Pilger antes da visita ou proposta.',
      },
    ]
    development.differentials = [
      {
        title: 'Uso comercial',
        description: 'Cadastro direcionado para análise de imóvel empresarial, não residencial.',
      },
      {
        title: 'Imagens em revisão',
        description: 'A página permanece sem galeria enquanto não houver mídia própria ou autorizada do empreendimento.',
      },
      {
        title: 'Validação guiada',
        description: 'A equipe valida metragens, documentação e disponibilidade antes de qualquer visita ou proposta.',
      },
    ]
    development.faq = [
      {
        question: 'Onde fica o Westarb Business Park?',
        answer: 'O empreendimento fica em Limeira Baixa, Brusque - SC.',
      },
      {
        question: 'A página usa fotos internas de unidade?',
        answer: 'Não. As fotos internas foram removidas da galeria do empreendimento para preservar a curadoria visual.',
      },
      {
        question: 'Há unidades disponíveis?',
        answer: 'Existe unidade vinculada ao empreendimento, mas disponibilidade, valores e condições precisam ser confirmados com o atendimento.',
      },
      {
        question: 'Como confirmar informações comerciais?',
        answer: 'Envie seus dados pelo formulário ou WhatsApp para receber metragens, condições e próximos passos com a equipe Guilherme Pilger.',
      },
    ]
    next.seo = seo
    next.development = development
    return { content: next, removed }
  }

  next.custom_gallery = filterGallery(next.custom_gallery, removed, slug)
  development.gallery = filterGallery(development.gallery, removed, slug)

  for (const key of ['custom_hero_image']) {
    const image = text(next[key])
    const domain = domainOf(image)
    if (domain && AUTO_REMOVE_IMAGE_DOMAINS.has(domain)) {
      removed.push({ slug, image, domain, reason: 'auto_remove_competitor_or_portal_domain' })
      delete next[key]
    }
  }

  for (const key of ['heroImage', 'hero_image']) {
    const image = text(development[key])
    const domain = domainOf(image)
    if (domain && AUTO_REMOVE_IMAGE_DOMAINS.has(domain)) {
      removed.push({ slug, image, domain, reason: 'auto_remove_competitor_or_portal_domain' })
      delete development[key]
    }
  }

  const fallbackHero = imageFromItem(asArray(next.custom_gallery)[0]) || imageFromItem(asArray(development.gallery)[0])
  if (!text(next.custom_hero_image) && !text(development.heroImage) && !text(development.hero_image) && fallbackHero) {
    development.heroImage = fallbackHero
  }

  next.development = development
  return { content: next, removed }
}

function stableJson(value) {
  return JSON.stringify(value)
}

async function fetchAllLandingPages() {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('landing_pages')
      .select('id, slug, title, description, status, content, metadata, updated_at')
      .eq('status', 'published')
      .range(from, to)
      .order('created_at', { ascending: true })

    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) break
  }
  return rows
}

function nextRowDescription(row) {
  if (row.slug === 'westarb-business-park') {
    return 'Westarb Business Park é um empreendimento comercial em Limeira Baixa, Brusque - SC, indicado para operação empresarial, armazenagem e leitura logística regional.'
  }

  return normalizePublicText(text(row.description))
}

function buildMarkdown(report) {
  const lines = [
    '# Curadoria de dados dos empreendimentos',
    '',
    `Gerado em: ${report.generated_at}`,
    `Modo: ${report.apply ? 'aplicado' : 'prévia'}`,
    '',
    '## Totais',
    '',
    `- Páginas analisadas: ${report.totals.pages_analyzed}`,
    `- Páginas com texto corrigido: ${report.totals.text_rows}`,
    `- Páginas com imagens removidas automaticamente: ${report.totals.media_rows}`,
    `- Imagens removidas automaticamente: ${report.totals.images_removed}`,
    `- Imagens em domínios para revisão visual: ${report.totals.images_for_visual_review}`,
    '',
    '## Remoções automáticas',
    '',
  ]

  if (!report.removed_images.length) lines.push('- Nenhuma imagem removida automaticamente nesta execução.')
  for (const item of report.removed_images.slice(0, 80)) {
    lines.push(`- ${item.slug}: ${item.domain || 'sem domínio'} | ${item.reason}`)
  }

  lines.push('', '## Revisão visual pendente', '')
  for (const item of report.review_domains.slice(0, 30)) {
    lines.push(`- ${item.domain}: ${item.count} imagens | exemplos: ${item.sample_slugs.join(', ')}`)
  }

  return `${lines.join('\n')}\n`
}

async function main() {
  const rows = await fetchAllLandingPages()
  const backupRows = []
  const updates = []
  const removedImages = []
  const reviewDomainMap = new Map()

  for (const row of rows) {
    const content = asRecord(row.content)
    const development = asRecord(content.development)
    if (!Object.keys(development).length) continue

    for (const imageInfo of collectImageDomains(content, row.slug)) {
      if (!REVIEW_IMAGE_DOMAINS.has(imageInfo.domain)) continue
      const current = reviewDomainMap.get(imageInfo.domain) || { domain: imageInfo.domain, count: 0, sample_slugs: [] }
      current.count += 1
      if (current.sample_slugs.length < 8 && !current.sample_slugs.includes(row.slug)) current.sample_slugs.push(row.slug)
      reviewDomainMap.set(imageInfo.domain, current)
    }

    const normalizedContent = normalizeObjectStrings(content)
    const mediaResult = removeUnsafeImages(normalizedContent, row.slug)
    const nextContent = mediaResult.content
    const nextDescription = nextRowDescription(row)
    const nextDevelopment = asRecord(nextContent.development)
    if (Array.isArray(nextDevelopment.units) && nextDevelopment.units.length === 0) {
      nextDevelopment.availableUnitsCount = 0
      nextDevelopment.available_units_count = 0
      nextContent.available_units_count = 0
      nextContent.development = nextDevelopment
    }
    const nextMetadata = {
      ...asRecord(row.metadata),
      development_data_quality: {
        reviewed_at: NOW.toISOString(),
        text_normalized: stableJson(content) !== stableJson(normalizedContent),
        removed_image_count: mediaResult.removed.length,
        removed_image_domains: Array.from(new Set(mediaResult.removed.map(item => item.domain).filter(Boolean))),
        script: 'repair-development-data-quality',
      },
    }

    const descriptionChanged = text(row.description) !== nextDescription
    const changed = stableJson(content) !== stableJson(nextContent) || stableJson(asRecord(row.metadata)) !== stableJson(nextMetadata) || descriptionChanged
    if (!changed) continue

    updates.push({
      id: row.id,
      slug: row.slug,
      textChanged: stableJson(content) !== stableJson(normalizedContent),
      descriptionChanged,
      mediaChanged: mediaResult.removed.length > 0,
      removedImages: mediaResult.removed.length,
      before: { content: row.content, metadata: row.metadata },
      after: { content: nextContent, metadata: nextMetadata, description: nextDescription },
    })
    removedImages.push(...mediaResult.removed)
    backupRows.push(row)
  }

  await mkdir('output', { recursive: true })
  await writeFile(`${OUTPUT_PREFIX}-backup.json`, JSON.stringify(backupRows, null, 2), 'utf8')
  await writeFile(`${OUTPUT_PREFIX}-updates.json`, JSON.stringify(updates.map(({ before, after, ...summary }) => summary), null, 2), 'utf8')

  if (APPLY) {
    for (const update of updates) {
      const { error } = await supabase
        .from('landing_pages')
        .update({
          content: update.after.content,
          metadata: update.after.metadata,
          description: update.after.description,
          updated_at: NOW.toISOString(),
        })
        .eq('id', update.id)

      if (error) throw error
    }
  }

  const reviewDomains = Array.from(reviewDomainMap.values()).sort((a, b) => b.count - a.count)
  const report = {
    generated_at: NOW.toISOString(),
    apply: APPLY,
    outputs: {
      backup: `${OUTPUT_PREFIX}-backup.json`,
      updates: `${OUTPUT_PREFIX}-updates.json`,
    },
    totals: {
      pages_analyzed: rows.length,
      text_rows: updates.filter(item => item.textChanged).length,
      media_rows: updates.filter(item => item.mediaChanged).length,
      images_removed: removedImages.length,
      images_for_visual_review: reviewDomains.reduce((sum, item) => sum + item.count, 0),
    },
    removed_images: removedImages,
    review_domains: reviewDomains,
  }

  await writeFile(`${OUTPUT_PREFIX}.json`, JSON.stringify(report, null, 2), 'utf8')
  await writeFile(`${OUTPUT_PREFIX}.md`, buildMarkdown(report), 'utf8')

  console.log('Development data quality repair')
  console.log(`- mode: ${APPLY ? 'apply' : 'dry-run'}`)
  for (const [key, value] of Object.entries(report.totals)) console.log(`- ${key}: ${value}`)
  console.log(`- report: ${OUTPUT_PREFIX}.md`)
  console.log(`- backup: ${OUTPUT_PREFIX}-backup.json`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
