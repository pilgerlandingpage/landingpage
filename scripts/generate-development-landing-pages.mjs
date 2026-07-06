#!/usr/bin/env node

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })
dotenv.config()

const APPLY = process.argv.includes('--apply')
const AUDIT_ONLY = process.argv.includes('--audit-only')
const NOW = new Date().toISOString()
const PAGE_SIZE = 1000
const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'blog',
  'busca',
  'contato',
  'eventos',
  'favoritos',
  'imovel',
  'imoveis',
  'noticias',
  'sobre',
])

const PROPERTY_SELECT = [
  'id',
  'source_reference',
  'source_slug',
  'title',
  'seo_title',
  'description',
  'seo_description',
  'address',
  'street',
  'number',
  'complement',
  'city',
  'state',
  'neighborhood',
  'price',
  'property_type',
  'bedrooms',
  'bathrooms',
  'suites',
  'parking_spaces',
  'area_m2',
  'area_private_m2',
  'area_total_m2',
  'featured_image',
  'images',
  'status',
  'source_status',
  'purpose',
  'amenities',
  'latitude',
  'longitude',
  'created_at',
  'updated_at',
].join(', ')

const PRIVATE_SELECT = [
  'property_id',
  'source_reference',
  'condominium_name',
  'construction_company',
].join(', ')

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

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function normalizeKey(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeLooseKey(value) {
  return normalizeKey(value)
    .replace(/\b(edificio|ed|condominio|cond|residencial|res)\b/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function slugify(value, fallback = 'empreendimento') {
  const slug = normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
  return slug || fallback
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function text(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function number(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function compact(value, limit = 160) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim()
  if (clean.length <= limit) return clean
  return `${clean.slice(0, limit - 1).trim()}...`
}

function uniq(values) {
  return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)))
}

function mostCommon(values, fallback = '') {
  const counts = new Map()
  for (const value of values.map(item => String(item || '').trim()).filter(Boolean)) {
    counts.set(value, (counts.get(value) || 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0]?.[0] || fallback
}

function formatCurrency(value) {
  const numeric = number(value)
  if (numeric === null || numeric <= 0) return ''
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(numeric)
}

function formatMoneyRange(values) {
  const numbers = values.map(number).filter(value => value !== null && value > 0).sort((a, b) => a - b)
  if (!numbers.length) return 'Consultar valores'
  const min = numbers[0]
  const max = numbers[numbers.length - 1]
  if (min === max) return formatCurrency(min)
  return `${formatCurrency(min)} a ${formatCurrency(max)}`
}

function formatNumberRange(values, suffix, fallback) {
  const numbers = values.map(number).filter(value => value !== null && value > 0).sort((a, b) => a - b)
  if (!numbers.length) return fallback
  const min = numbers[0]
  const max = numbers[numbers.length - 1]
  const fmt = value => Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  if (min === max) return `${fmt(min)}${suffix}`
  return `${fmt(min)}${suffix} a ${fmt(max)}${suffix}`
}

function formatCountRange(values, singular, plural, fallback) {
  const numbers = values.map(number).filter(value => value !== null && value > 0).sort((a, b) => a - b)
  if (!numbers.length) return fallback
  const min = numbers[0]
  const max = numbers[numbers.length - 1]
  const label = max === 1 ? singular : plural
  if (min === max) return `${min} ${label}`
  return `${min} a ${max} ${plural}`
}

function firstImage(property) {
  return text(property.featured_image) || text(asArray(property.images)[0]) || '/placeholder-house.jpg'
}

function imageList(property) {
  return uniq([property.featured_image, ...asArray(property.images)]).slice(0, 8)
}

function unitType(property) {
  const rawType = text(property.property_type, 'Imovel')
  const title = normalizeText(property.title)
  if (title.includes('cobertura')) return 'Cobertura'
  if (title.includes('garden')) return 'Apartamento Garden'
  if (title.includes('duplex')) return 'Duplex'
  if (title.includes('triplex')) return 'Triplex'
  return rawType
}

function stageFromText(value) {
  const normalized = normalizeText(value)
  if (/\b(lancamento|pre lancamento|pre-lancamento|na planta)\b/.test(normalized)) return 'launch'
  if (/\b(em construcao|construcao|obra|em obra|entrega prevista)\b/.test(normalized)) return 'construction'
  if (/\b(pronto|pronta|pronto para morar|entregue)\b/.test(normalized)) return 'ready'
  return null
}

function inferStage(properties) {
  const joined = properties.map(property => [
    property.title,
    property.description,
    property.seo_description,
    property.source_status,
    property.property_type,
    ...asArray(property.amenities),
  ].join(' ')).join(' ')
  return stageFromText(joined) || 'ready'
}

function inferredDevelopmentName(property) {
  const title = text(property.title)
  if (!title) return ''
  const boundary = String.raw`(?=\s+(?:em|na|no|nos|nas)\b|\s*[-–]\s*|$)`
  const patterns = [
    new RegExp(String.raw`\b(?:no|na|nos|nas)\s+((?:ed\.?|edificio|cond\.?|condominio|residencial)\s+.+?)${boundary}`, 'i'),
    new RegExp(String.raw`\b(?:no|na|nos|nas)\s+(VivaPark)${boundary}`, 'i'),
    new RegExp(String.raw`^((?:condominio|residencial)\s+.+?)${boundary}`, 'i'),
    new RegExp(String.raw`\b(?:casa\s+)?((?:residencial)\s+.+?)${boundary}`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = title.match(pattern)
    const candidate = text(match?.[1])
    if (candidate && normalizeKey(candidate).length >= 4) {
      return candidate.replace(/\s+/g, ' ').trim()
    }
  }

  return ''
}

function stageLabel(stage) {
  if (stage === 'launch') return 'Lancamento'
  if (stage === 'construction') return 'Em construcao'
  return 'Pronto'
}

function commonLocation(properties) {
  const city = mostCommon(properties.map(property => property.city), 'Litoral catarinense')
  const state = mostCommon(properties.map(property => property.state), 'SC')
  const neighborhood = mostCommon(properties.map(property => property.neighborhood), '')
  const parts = [neighborhood, city].filter(Boolean)
  return {
    city,
    state,
    neighborhood,
    locationName: parts.length ? `${parts.join(', ')} - ${state}` : `${city} - ${state}`,
  }
}

function addressFromGroup(properties, location) {
  const street = mostCommon(properties.map(property => property.street || property.address), '')
  if (street) return [street, location.neighborhood, location.city, location.state].filter(Boolean).join(', ')
  return [location.neighborhood, location.city, location.state].filter(Boolean).join(', ')
}

function coordinateFromGroup(properties, key) {
  const values = properties.map(property => number(property[key])).filter(value => value !== null)
  if (!values.length) return null
  return values[Math.floor(values.length / 2)]
}

function developmentDescription(name, properties, location, priceRange, areaRange, suitesRange) {
  const unitTypes = uniq(properties.map(unitType)).slice(0, 4).join(', ') || 'unidades'
  return `O ${name} reune ${properties.length} ${properties.length === 1 ? 'imovel ativo' : 'imoveis ativos'} em ${location.locationName}, com ${unitTypes.toLowerCase()}, faixa de valor ${priceRange}, metragens de ${areaRange} e configuracao de ${suitesRange}.`
}

function buildFaq(name, properties, location, priceRange, areaRange, suitesRange) {
  const unitsText = properties.length === 1 ? '1 unidade ativa' : `${properties.length} unidades ativas`
  return [
    {
      question: `O que e o ${name}?`,
      answer: `${name} e um empreendimento/condominio em ${location.locationName} com ${unitsText} na curadoria da Guilherme Pilger Imoveis.`,
    },
    {
      question: `Quais unidades estao disponiveis no ${name}?`,
      answer: `A pagina consolida as unidades ativas do ${name}, incluindo tipo, metragem, suites, vagas, faixa de preco e link para os detalhes de cada imovel.`,
    },
    {
      question: `Onde fica o ${name}?`,
      answer: `O ${name} fica em ${location.locationName}. Quando ha coordenadas no cadastro, a pagina tambem exibe o mapa para leitura do entorno.`,
    },
    {
      question: `Qual a faixa de valor do ${name}?`,
      answer: `A faixa atual informada no cadastro publico e ${priceRange}, com areas de ${areaRange} e configuracoes de ${suitesRange}. Os valores podem mudar conforme disponibilidade.`,
    },
    {
      question: `Como agendar uma visita ao ${name}?`,
      answer: `Use o botao de atendimento da pagina para falar com a equipe Guilherme Pilger, validar disponibilidade e receber uma curadoria das unidades mais adequadas ao seu perfil.`,
    },
  ]
}

function buildUnits(properties, developmentName) {
  return properties
    .sort((a, b) => (number(a.price) || 0) - (number(b.price) || 0))
    .map(property => {
      const sourceSlug = text(property.source_slug) || text(property.id)
      return {
        id: text(property.source_reference) || text(property.id),
        propertyId: property.id,
        property_id: property.id,
        sourceReference: text(property.source_reference),
        source_reference: text(property.source_reference),
        type: unitType(property),
        title: text(property.title, `${unitType(property)} no ${developmentName}`),
        area: formatNumberRange([property.area_private_m2 || property.area_m2], 'm2', 'Consulte'),
        suites: formatCountRange([property.suites || property.bedrooms], 'suite', 'suites', 'Consulte'),
        vagas: formatCountRange([property.parking_spaces], 'vaga', 'vagas', 'Consulte'),
        price: formatCurrency(property.price) || 'Consulte',
        image: firstImage(property),
        images: imageList(property),
        status: text(property.source_status, 'Disponivel'),
        sourceSlug,
        source_slug: sourceSlug,
      }
    })
}

function buildGallery(properties, name) {
  const seen = new Set()
  const gallery = []
  for (const property of properties) {
    for (const image of imageList(property)) {
      if (!image || seen.has(image)) continue
      seen.add(image)
      gallery.push({
        title: text(property.title, name),
        image,
        category: unitType(property),
      })
      if (gallery.length >= 14) return gallery
    }
  }
  return gallery
}

function buildBenefits(name, location) {
  return [
    {
      icon: 'Building2',
      title: 'Unidades reunidas',
      description: `As opcoes ativas do ${name} ficam centralizadas para comparacao rapida.`,
    },
    {
      icon: 'Compass',
      title: 'Leitura de localizacao',
      description: `Contexto de ${location.locationName} para avaliar entorno, mobilidade e liquidez.`,
    },
    {
      icon: 'ShieldCheck',
      title: 'Curadoria Pilger',
      description: 'Atendimento consultivo para validar disponibilidade, perfil de compra e proxima visita.',
    },
  ]
}

function buildDifferentials(name, properties) {
  const amenities = uniq(properties.flatMap(property => asArray(property.amenities))).slice(0, 5)
  const base = amenities.length
    ? amenities.map(item => ({ title: item, description: `Diferencial citado nos cadastros ativos do ${name}.` }))
    : []
  return [
    ...base,
    {
      title: 'Comparacao direta',
      description: 'Unidades do mesmo predio ou condominio apresentadas em uma pagina unica.',
    },
    {
      title: 'Atendimento com contexto',
      description: 'O lead que chega pelo imovel tambem encontra o caminho para entender o empreendimento completo.',
    },
  ].slice(0, 8)
}

function mergeUnits(existingUnits, generatedUnits) {
  const byKey = new Map()
  for (const unit of [...asArray(existingUnits), ...generatedUnits]) {
    const record = asRecord(unit)
    const key = normalizeText(record.propertyId || record.property_id || record.sourceSlug || record.source_slug || record.id || record.sourceReference || record.source_reference)
    if (!key || byKey.has(key)) continue
    byKey.set(key, record)
  }
  return [...byKey.values()]
}

function mergeGallery(existingGallery, generatedGallery) {
  const seen = new Set()
  const merged = []
  for (const item of [...asArray(existingGallery), ...generatedGallery]) {
    const record = typeof item === 'string' ? { image: item, title: 'Empreendimento', category: 'Empreendimento' } : asRecord(item)
    const image = text(record.image || record.url || record.src)
    if (!image || seen.has(image)) continue
    seen.add(image)
    merged.push({
      title: text(record.title, 'Empreendimento'),
      image,
      category: text(record.category, 'Empreendimento'),
    })
  }
  return merged.slice(0, 18)
}

function uniqueSlugForName(name, usedSlugs, preferredSlug) {
  if (preferredSlug) return preferredSlug
  const base = RESERVED_SLUGS.has(slugify(name)) ? `empreendimento-${slugify(name)}` : slugify(name)
  let candidate = base
  let index = 2
  while (usedSlugs.has(candidate)) {
    candidate = `${base}-${index}`
    index += 1
  }
  usedSlugs.add(candidate)
  return candidate
}

function buildContent(group, slug, existingPage = null) {
  const existingContent = asRecord(existingPage?.content)
  const existingDevelopment = asRecord(existingContent.development)
  const properties = group.properties
  const location = commonLocation(properties)
  const name = text(existingDevelopment.name, group.name)
  const stage = inferStage(properties)
  const units = buildUnits(properties, name)
  const gallery = buildGallery(properties, name)
  const heroImage = text(existingDevelopment.heroImage || existingDevelopment.hero_image || existingContent.custom_hero_image, gallery[0]?.image || '/placeholder-house.jpg')
  const priceRange = formatMoneyRange(properties.map(property => property.price))
  const areaRange = formatNumberRange(properties.map(property => property.area_private_m2 || property.area_m2), 'm2', 'area sob consulta')
  const suitesRange = formatCountRange(properties.map(property => property.suites || property.bedrooms), 'suite', 'suites', 'configuracao sob consulta')
  const description = developmentDescription(name, properties, location, priceRange, areaRange, suitesRange)
  const faq = buildFaq(name, properties, location, priceRange, areaRange, suitesRange)
  const title = `${name} em ${location.city} | Empreendimento Guilherme Pilger`
  const metaDescription = compact(`${description} Compare unidades, valores, metragens e fale com a Guilherme Pilger Imoveis.`, 158)
  const canonicalPath = `/${slug}`
  const latitude = coordinateFromGroup(properties, 'latitude')
  const longitude = coordinateFromGroup(properties, 'longitude')
  const localEntities = uniq([
    name,
    location.neighborhood,
    location.city,
    location.state,
    mostCommon(properties.map(property => property.construction_company), ''),
  ])
  const generatedDevelopment = {
    id: `development-${group.key}`,
    name,
    pageSlug: slug,
    page_slug: slug,
    city: location.city,
    locationName: location.locationName,
    location_name: location.locationName,
    tagline: text(existingDevelopment.tagline, `${stageLabel(stage)} em ${location.locationName}`),
    priceRange,
    price_range: priceRange,
    availableUnitsCount: properties.length,
    available_units_count: properties.length,
    areaRange,
    area_range: areaRange,
    suitesRange,
    suites_range: suitesRange,
    heroImage,
    hero_image: heroImage,
    description: text(existingDevelopment.description, description),
    address: text(existingDevelopment.address, addressFromGroup(properties, location)),
    latitude,
    longitude,
    stage,
    stageLabel: stageLabel(stage),
    stage_label: stageLabel(stage),
    sourceCondominiumName: group.rawName,
    source_condominium_name: group.rawName,
    sourceCondominiumKey: group.key,
    source_condominium_key: group.key,
    sourceCondominiumAliases: uniq(group.names || [group.rawName]),
    source_condominium_aliases: uniq(group.names || [group.rawName]),
    showOnHome: existingPage ? existingDevelopment.showOnHome : false,
    show_on_home: existingPage ? existingDevelopment.show_on_home : false,
    benefits: asArray(existingDevelopment.benefits).length ? existingDevelopment.benefits : buildBenefits(name, location),
    differentials: asArray(existingDevelopment.differentials).length ? existingDevelopment.differentials : buildDifferentials(name, properties),
    units: mergeUnits(existingDevelopment.units, units),
    gallery: mergeGallery(existingDevelopment.gallery, gallery),
    faq: asArray(existingDevelopment.faq).length ? existingDevelopment.faq : faq,
  }

  const seo = {
    title: text(asRecord(existingContent.seo).title, title),
    description: text(asRecord(existingContent.seo).description, metaDescription),
    canonical_path: canonicalPath,
    primary_keyword: `${name} ${location.city}`,
    secondary_keywords: uniq([
      `${name} ${location.neighborhood}`.trim(),
      `empreendimento ${location.city}`,
      `condominio ${location.city}`,
      `imoveis no ${name}`,
      `apartamentos no ${name}`,
    ]),
    og_image: heroImage,
    entity_type: 'RealEstateDevelopment',
    schema_types: ['WebPage', 'Residence', 'ItemList', 'FAQPage'],
    updated_at: NOW,
  }

  return {
    ...existingContent,
    template: 'brava-concetto',
    custom_title: text(existingContent.custom_title, title),
    custom_description: text(existingContent.custom_description, metaDescription),
    custom_hero_image: heroImage,
    custom_price: priceRange,
    custom_cta: text(existingContent.custom_cta, 'Falar com especialista'),
    custom_gallery: mergeGallery(existingContent.custom_gallery, gallery),
    available_units_count: properties.length,
    home_featured: existingPage ? existingContent.home_featured : false,
    show_on_home: existingPage ? existingContent.show_on_home : false,
    development: generatedDevelopment,
    seo,
    aeo_questions: faq,
    geo: {
      city: location.city,
      state: location.state,
      neighborhood: location.neighborhood,
      address: generatedDevelopment.address,
      latitude,
      longitude,
      local_entities: localEntities,
    },
    schema: {
      version: 'development-landing-v1',
      main_entity: name,
      entity_type: 'Residence',
      has_faq: true,
      has_item_list: generatedDevelopment.units.length > 0,
      has_geo: latitude !== null && longitude !== null,
      unit_count: generatedDevelopment.units.length,
    },
    ai_ranking: {
      generated_for: ['seo', 'aeo', 'geo', 'schema'],
      answer_engine_summary: `${name} e um empreendimento em ${location.locationName} com ${properties.length} unidades ativas, faixa de valor ${priceRange} e pagina dedicada para comparar unidades.`,
      internal_links: [
        canonicalPath,
        '/busca',
        '/#empreendimentos',
        ...generatedDevelopment.units.slice(0, 12).map(unit => `/imovel/${encodeURIComponent(unit.sourceSlug)}`),
      ],
      updated_at: NOW,
    },
  }
}

function rowForGroup(group, slug, existingPage = null) {
  const content = buildContent(group, slug, existingPage)
  return {
    title: content.seo.title,
    slug,
    description: content.seo.description,
    status: 'published',
    property_id: null,
    content,
    metadata: {
      ...asRecord(existingPage?.metadata),
      generated_by: 'generate-development-landing-pages',
      generated_at: NOW,
      source_table: group.sourceKind === 'title_inference' ? 'properties' : 'property_private_details',
      source_column: group.sourceKind === 'title_inference' ? 'title_inference' : 'condominium_name',
      source_kind: group.sourceKind,
      source_condominium_name: group.rawName,
      source_condominium_key: group.key,
      source_condominium_aliases: uniq(group.names || [group.rawName]),
      property_count: group.properties.length,
      stage: content.development.stage,
      ranking_requirements: {
        seo: true,
        aeo: true,
        geo: true,
        schema: true,
      },
    },
    primary_color: '#948369',
    updated_at: NOW,
  }
}

async function fetchAll(table, select, configure = query => query) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1
    const query = configure(supabase.from(table).select(select).range(from, to))
    const { data, error } = await query
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) break
  }
  return rows
}

async function loadData() {
  const [properties, privateRows, landingPages] = await Promise.all([
    fetchAll('properties', PROPERTY_SELECT, query => query.eq('status', 'active').order('updated_at', { ascending: false })),
    fetchAll('property_private_details', PRIVATE_SELECT),
    fetchAll('landing_pages', 'id, slug, title, description, content, metadata, status, created_at, updated_at', query => query.order('created_at', { ascending: true })),
  ])

  const privateByProperty = new Map(privateRows.map(row => [row.property_id, row]))
  const activeProperties = properties.map(property => ({
    ...property,
    private_details: privateByProperty.get(property.id) || null,
    condominium_name: text(privateByProperty.get(property.id)?.condominium_name),
    construction_company: text(privateByProperty.get(property.id)?.construction_company),
  }))

  return { activeProperties, landingPages }
}

function buildGroups(activeProperties) {
  const groups = new Map()
  const unnamed = []
  const inferred = []

  for (const property of activeProperties) {
    const privateName = text(property.condominium_name)
    const inferredName = privateName ? '' : inferredDevelopmentName(property)
    const rawName = privateName || inferredName
    const key = normalizeKey(rawName)
    if (!key) {
      unnamed.push(property)
      continue
    }

    if (!privateName && inferredName) inferred.push(property)

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        rawName,
        names: [],
        properties: [],
        sourceKind: privateName ? 'private_condominium_name' : 'title_inference',
      })
    }
    const group = groups.get(key)
    group.names.push(rawName)
    group.properties.push({
      ...property,
      condominium_name: rawName,
      inferred_development_name: inferredName || null,
    })
  }

  return {
    groups: [...groups.values()].map(group => ({
      ...group,
      looseKey: normalizeLooseKey(group.rawName),
      name: mostCommon(group.names, group.rawName),
    })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    unnamed,
    inferred,
  }
}

function existingPageIndexes(landingPages) {
  const bySlug = new Map()
  const byDevelopmentKey = new Map()

  for (const page of landingPages) {
    const content = asRecord(page.content)
    const development = asRecord(content.development)
    bySlug.set(page.slug, page)
    for (const candidate of [
      development.sourceCondominiumKey,
      development.source_condominium_key,
      development.sourceCondominiumName,
      development.source_condominium_name,
      ...asArray(development.sourceCondominiumAliases),
      ...asArray(development.source_condominium_aliases),
      ...asArray(asRecord(page.metadata).source_condominium_aliases),
      development.name,
      content.custom_title,
      page.title,
      page.slug,
    ]) {
      const key = normalizeKey(candidate)
      if (key && !byDevelopmentKey.has(key)) byDevelopmentKey.set(key, page)
      const looseKey = normalizeLooseKey(candidate)
      if (looseKey && !byDevelopmentKey.has(looseKey)) byDevelopmentKey.set(looseKey, page)
    }
  }

  return { bySlug, byDevelopmentKey }
}

function prepareRows(groups, landingPages) {
  const usedSlugs = new Set(landingPages.map(page => page.slug).filter(Boolean))
  const { byDevelopmentKey } = existingPageIndexes(landingPages)
  const insertRows = []
  const updateRows = []
  const matchedExistingIds = new Set()
  const updateTargets = new Map()
  const targets = []

  for (const group of groups) {
    const existing = byDevelopmentKey.get(group.key) || byDevelopmentKey.get(group.looseKey)
    if (existing) {
      const current = updateTargets.get(existing.id)
      if (current) {
        const propertyById = new Map(current.group.properties.map(property => [property.id, property]))
        for (const property of group.properties) propertyById.set(property.id, property)
        current.group = {
          ...current.group,
          names: uniq([...(current.group.names || []), ...(group.names || []), group.name]),
          properties: [...propertyById.values()],
        }
        continue
      }
      const target = { group: { ...group, properties: [...group.properties] }, existing }
      updateTargets.set(existing.id, target)
      targets.push(target)
      continue
    }

    targets.push({ group, existing: null })
  }

  for (const target of targets) {
    const { group, existing } = target
    const slug = uniqueSlugForName(group.name, usedSlugs, existing?.slug)
    const row = rowForGroup(group, slug, existing)

    if (existing) {
      matchedExistingIds.add(existing.id)
      updateRows.push({ id: existing.id, row })
    } else {
      insertRows.push(row)
    }
  }

  return { insertRows, updateRows, matchedExistingIds }
}

function pageHasRankingRequirements(page) {
  const content = asRecord(page.content)
  const development = asRecord(content.development)
  const seo = asRecord(content.seo)
  const geo = asRecord(content.geo)
  const schema = asRecord(content.schema)
  const faq = asArray(development.faq).length ? development.faq : content.aeo_questions

  return {
    seo: Boolean(seo.title && seo.description && (seo.canonical_path || content.canonical_path)),
    aeo: asArray(faq).some(item => asRecord(item).question && asRecord(item).answer),
    geo: Boolean(geo.city || development.city || development.locationName || development.location_name),
    schema: Boolean(schema.version || asArray(seo.schema_types).length || asArray(development.units).length),
    units: asArray(development.units).length > 0,
  }
}

function auditLandingCoverage(groups, landingPages) {
  const { byDevelopmentKey } = existingPageIndexes(landingPages.filter(page => page.status === 'published'))
  const missingGroups = groups.filter(group => !byDevelopmentKey.has(group.key))
  const pages = landingPages.filter(page => page.status === 'published')
  const developmentPages = pages.filter(page => {
    const content = asRecord(page.content)
    return !content.template || content.template === 'brava-concetto'
  })
  const rankingGaps = developmentPages
    .map(page => ({ page, checks: pageHasRankingRequirements(page) }))
    .filter(item => !item.checks.seo || !item.checks.aeo || !item.checks.geo || !item.checks.schema || !item.checks.units)

  const sourceSlugsInPages = new Set()
  for (const page of developmentPages) {
    const units = asArray(asRecord(asRecord(page.content).development).units)
    for (const unit of units) {
      const record = asRecord(unit)
      for (const key of [record.sourceSlug, record.source_slug, record.propertyId, record.property_id, record.id, record.sourceReference, record.source_reference]) {
        const normalized = normalizeText(key)
        if (normalized) sourceSlugsInPages.add(normalized)
      }
    }
  }

  const linkedProperties = groups.flatMap(group => group.properties).filter(property => {
    return [property.source_slug, property.id, property.source_reference].some(key => sourceSlugsInPages.has(normalizeText(key)))
  })

  return {
    publishedDevelopmentPages: developmentPages.length,
    missingGroups: missingGroups.length,
    rankingGaps: rankingGaps.length,
    linkedProperties: linkedProperties.length,
    rankingGapSamples: rankingGaps.slice(0, 12).map(item => ({
      slug: item.page.slug,
      checks: item.checks,
    })),
  }
}

async function applyRows(insertRows, updateRows) {
  for (const update of updateRows) {
    const { error } = await supabase
      .from('landing_pages')
      .update(update.row)
      .eq('id', update.id)
    if (error) throw error
  }

  for (let i = 0; i < insertRows.length; i += 100) {
    const batch = insertRows.slice(i, i + 100)
    const { error } = await supabase
      .from('landing_pages')
      .insert(batch)
    if (error) throw error
  }
}

function printSummary(label, data) {
  console.log(`\n${label}`)
  for (const [key, value] of Object.entries(data)) {
    console.log(`- ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
  }
}

async function main() {
  const { activeProperties, landingPages } = await loadData()
  const { groups, unnamed, inferred } = buildGroups(activeProperties)
  const missingPrivateNameCount = activeProperties.filter(property => !text(property.condominium_name)).length

  if (AUDIT_ONLY) {
    const audit = auditLandingCoverage(groups, landingPages)
    printSummary('Audit development landing pages', {
      activeProperties: activeProperties.length,
      condominiumGroups: groups.length,
      activePropertiesMissingPrivateCondominiumName: missingPrivateNameCount,
      activePropertiesWithoutDevelopmentName: unnamed.length,
      propertiesUsingInferredDevelopmentName: inferred.length,
      ...audit,
    })
    if (audit.rankingGapSamples.length) {
      console.log('\nRanking gap samples:')
      console.log(JSON.stringify(audit.rankingGapSamples, null, 2))
    }
    return
  }

  const { insertRows, updateRows } = prepareRows(groups, landingPages)
  printSummary(APPLY ? 'Apply plan' : 'Dry-run plan', {
    activeProperties: activeProperties.length,
    condominiumGroups: groups.length,
    activePropertiesMissingPrivateCondominiumName: missingPrivateNameCount,
    activePropertiesWithoutDevelopmentName: unnamed.length,
    propertiesUsingInferredDevelopmentName: inferred.length,
    pagesToInsert: insertRows.length,
    pagesToUpdate: updateRows.length,
  })

  if (!APPLY) {
    console.log('\nDry-run only. Run with --apply to insert/update landing pages.')
    return
  }

  await applyRows(insertRows, updateRows)

  const refreshedLandingPages = await fetchAll('landing_pages', 'id, slug, title, description, content, metadata, status, created_at, updated_at', query => query.order('created_at', { ascending: true }))
  const audit = auditLandingCoverage(groups, refreshedLandingPages)
  printSummary('Post-apply audit', {
    inserted: insertRows.length,
    updated: updateRows.length,
    ...audit,
  })
  if (audit.rankingGapSamples.length) {
    console.log('\nRanking gap samples:')
    console.log(JSON.stringify(audit.rankingGapSamples, null, 2))
  }
}

main().catch(error => {
  console.error(error?.message || error)
  process.exitCode = 1
})
