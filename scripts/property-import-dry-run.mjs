#!/usr/bin/env node

import fs from 'fs/promises'
import path from 'path'
import { pathToFileURL } from 'url'

const DEFAULT_FILE = 'c:\\Users\\conne\\Downloads\\dados dos imoveis.txt'

export function parseArgs(argv) {
    const args = {
        file: DEFAULT_FILE,
        sample: 3,
        encoding: 'utf8',
        json: false,
    }

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i]
        if (arg === '--file') args.file = argv[++i]
        else if (arg === '--sample') args.sample = Number(argv[++i] || 3)
        else if (arg === '--encoding') args.encoding = argv[++i] || 'utf8'
        else if (arg === '--json') args.json = true
    }

    return args
}

export function cleanText(value) {
    const trimmed = String(value || '').trim()
    return trimmed
        .replace(/^<!\[CDATA\[/, '')
        .replace(/\]\]>$/, '')
        .replace(/\r\n/g, '\n')
        .trim()
}

export function getTag(xml, tagName) {
    const match = xml.match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i'))
    return match ? cleanText(match[1]) : ''
}

export function getSection(xml, tagName) {
    const match = xml.match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i'))
    return match ? match[1] : ''
}

export function parseNumber(value) {
    const raw = String(value || '').trim()
    if (!raw) return null
    const numeric = raw.replace(/[^\d,.-]/g, '')
    const normalized = numeric.includes(',')
        ? numeric.replace(/\./g, '').replace(',', '.')
        : numeric
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
}

function increment(map, key) {
    const normalized = key || '(vazio)'
    map[normalized] = (map[normalized] || 0) + 1
}

function topEntries(map, limit = 12) {
    return Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name, count]) => ({ name, count }))
}

function parseItems(sectionXml) {
    const items = []
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi
    let match
    while ((match = itemRegex.exec(sectionXml))) {
        items.push(match[1])
    }
    return items
}

export function mapProperty(imovelXml) {
    const caracteristicas = getSection(imovelXml, 'caracteristicas')
    const tipo = getSection(imovelXml, 'tipo')
    const venda = getSection(imovelXml, 'negociacao_venda')
    const aluguel = getSection(imovelXml, 'negociacao_aluguel')
    const localizacao = getSection(imovelXml, 'localizacao')
    const coordenadas = getSection(localizacao, 'coordenadas')
    const proprietario = getSection(imovelXml, 'proprietario')
    const area = getSection(imovelXml, 'area')
    const datas = getSection(imovelXml, 'datas')
    const captacao = getSection(imovelXml, 'captacao')
    const corretor = getSection(captacao, 'corretor')
    const empreendimento = getSection(imovelXml, 'empreendimento')
    const metadata = getSection(imovelXml, 'metadata')

    const imageItems = parseItems(getSection(imovelXml, 'imagens'))
    const images = imageItems.map((itemXml, index) => ({
        order: index + 1,
        original_path: getTag(itemXml, 'path'),
        original_url: getTag(itemXml, 'link'),
        caption: getTag(itemXml, 'legenda'),
        is_featured: getTag(itemXml, 'principal') === '1',
        r2_key: null,
        r2_url: null,
    }))

    const videoItems = parseItems(getSection(getSection(imovelXml, 'midias'), 'videos'))
    const videos = videoItems.map(itemXml => cleanText(itemXml)).filter(Boolean)

    const title = getTag(imovelXml, 'titulo')
    const textualDescription = getTag(caracteristicas, 'textual')
    const baseDescription = getTag(imovelXml, 'descricao')
    const situation = getTag(imovelXml, 'situacao')
    const visible = getTag(imovelXml, 'visivel') === '1'
    const priceSale = parseNumber(getTag(venda, 'valor'))
        ?? parseNumber(getTag(venda, 'valor_com_desconto'))
        ?? parseNumber(getTag(venda, 'valor_sem_desconto'))
    const rent = parseNumber(getTag(aluguel, 'aluguel'))

    return {
        source_reference: getTag(imovelXml, 'referencia'),
        public: {
            title,
            slug: getTag(imovelXml, 'uri'),
            description: textualDescription || baseDescription,
            status: situation === 'Disponível' && visible ? 'active' : 'archived',
            original_status: situation,
            visible,
            purpose: getTag(imovelXml, 'finalidades'),
            property_type: getTag(tipo, 'subtipo') || getTag(tipo, 'grupo'),
            bedrooms: parseNumber(getTag(imovelXml, 'dormitorios')),
            suites: parseNumber(getTag(imovelXml, 'suites')),
            bathrooms: parseNumber(getTag(imovelXml, 'bwcs')),
            parking_spaces: parseNumber(getTag(imovelXml, 'garagens')),
            price: priceSale,
            rent,
            condo_fee: parseNumber(getTag(imovelXml, 'valor_condominio')),
            iptu: parseNumber(getTag(imovelXml, 'valor_iptu')),
            city: getTag(localizacao, 'cidade'),
            state: getTag(localizacao, 'estado'),
            neighborhood: getTag(localizacao, 'bairro'),
            street: getTag(localizacao, 'logradouro'),
            number: getTag(localizacao, 'numero'),
            zip_code: getTag(localizacao, 'CEP'),
            latitude: parseNumber(getTag(coordenadas, 'latitude')),
            longitude: parseNumber(getTag(coordenadas, 'longitude')),
            area_private_m2: parseNumber(getTag(area, 'privativa')),
            area_total_m2: parseNumber(getTag(area, 'total')),
            amenities: [
                getTag(caracteristicas, 'principais'),
                getTag(caracteristicas, 'do_imovel'),
                getTag(caracteristicas, 'do_empreendimento'),
                getTag(caracteristicas, 'ambientes_do_imovel'),
            ].join(',').split(',').map(item => item.trim()).filter(Boolean),
            featured_image_original_url: images.find(image => image.is_featured)?.original_url || images[0]?.original_url || '',
            images_count: images.length,
            videos,
            exclusive: getTag(imovelXml, 'exclusivo') === '1',
            solar_position: getTag(imovelXml, 'posicao_solar'),
            seo_title: getTag(metadata, 'title'),
            seo_description: getTag(metadata, 'description'),
        },
        private: {
            owner_name: getTag(proprietario, 'nome'),
            owner_email: getTag(proprietario, 'email'),
            owner_phones: getTag(proprietario, 'telefones'),
            sale_authorization_signed: getTag(proprietario, 'autorizacao_venda_assinada') === '1',
            registry: getTag(imovelXml, 'matricula'),
            liens: getTag(imovelXml, 'onus'),
            keys: getTag(imovelXml, 'chaves'),
            internal_notes: getTag(imovelXml, 'obs'),
            client_reference: getTag(imovelXml, 'ref_cliente'),
            sign: getTag(imovelXml, 'placa'),
            broker_name: getTag(corretor, 'nome'),
            broker_login: getTag(corretor, 'login'),
            created_by_name: getTag(getSection(imovelXml, 'cadastrado_por'), 'nome'),
            condominium_name: getTag(localizacao, 'empreendimento') || getTag(empreendimento, 'nome'),
            construction_company: getTag(empreendimento, 'construtora'),
            created_at_source: getTag(datas, 'criacao'),
            updated_at_source: getTag(datas, 'atualizacao'),
        },
        media: {
            images,
            videos,
        },
    }
}

export async function readMappedProperties(file, options = {}) {
    const encoding = options.encoding || 'utf8'
    const absoluteFile = path.resolve(file)
    const buffer = await fs.readFile(absoluteFile)
    const text = new TextDecoder(encoding).decode(buffer)
    const start = text.indexOf('<imoveis>')
    if (start < 0) throw new Error('Tag <imoveis> nao encontrada no arquivo.')

    const xml = text.slice(start)
    const imovelRegex = /<imovel[^>]*>([\s\S]*?)<\/imovel>/gi
    const properties = []
    let match
    while ((match = imovelRegex.exec(xml))) {
        properties.push(mapProperty(match[1]))
    }
    return { file: absoluteFile, properties }
}

export function buildImportReport(properties, options = {}) {
    const sampleLimit = Number(options.sample || 0)
    const counters = {
        total: 0,
        images: 0,
        videos: 0,
        visible: 0,
        hidden: 0,
        available: 0,
        archived: 0,
        withOwner: 0,
        withPrivateSensitiveData: 0,
        withoutImage: 0,
        withoutPrice: 0,
        withoutTitle: 0,
        duplicateReferences: 0,
    }
    const references = new Set()
    const status = {}
    const cities = {}
    const types = {}
    const importGroups = {}
    const sample = []

    for (const mapped of properties) {
        const ref = mapped.source_reference
        counters.total += 1
        counters.images += mapped.media.images.length
        counters.videos += mapped.media.videos.length
        counters.visible += mapped.public.visible ? 1 : 0
        counters.hidden += mapped.public.visible ? 0 : 1
        counters.available += mapped.public.original_status === 'Disponível' ? 1 : 0
        counters.archived += mapped.public.status === 'archived' ? 1 : 0
        counters.withOwner += mapped.private.owner_name || mapped.private.owner_phones || mapped.private.owner_email ? 1 : 0
        counters.withPrivateSensitiveData += mapped.private.registry || mapped.private.liens || mapped.private.keys || mapped.private.internal_notes ? 1 : 0
        counters.withoutImage += mapped.media.images.length === 0 ? 1 : 0
        counters.withoutPrice += mapped.public.price === null && mapped.public.rent === null ? 1 : 0
        counters.withoutTitle += mapped.public.title ? 0 : 1
        counters.duplicateReferences += references.has(ref) ? 1 : 0
        references.add(ref)
        increment(status, mapped.public.original_status)
        increment(cities, mapped.public.city)
        increment(types, mapped.public.property_type)
        increment(importGroups, mapped.public.status)

        if (sample.length < sampleLimit) {
            sample.push(mapped)
        }
    }

    return {
        generated_at: new Date().toISOString(),
        counters,
        top_status: topEntries(status, 20),
        top_cities: topEntries(cities, 20),
        top_types: topEntries(types, 20),
        import_groups: topEntries(importGroups, 10),
        proposed_tables: [
            'properties',
            'property_media',
            'property_private_details',
            'property_import_logs',
        ],
        sample,
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2))
    const { file, properties } = await readMappedProperties(args.file, { encoding: args.encoding })
    const report = {
        file,
        ...buildImportReport(properties, { sample: args.sample }),
    }
    const counters = report.counters
    const sample = report.sample

    if (args.json) {
        console.log(JSON.stringify(report, null, 2))
        return
    }

    console.log(`Arquivo: ${report.file}`)
    console.log(`Imoveis: ${counters.total}`)
    console.log(`Imagens: ${counters.images}`)
    console.log(`Videos: ${counters.videos}`)
    console.log(`Visiveis: ${counters.visible} | Ocultos: ${counters.hidden}`)
    console.log(`Disponiveis: ${counters.available} | Arquivados propostos: ${counters.archived}`)
    console.log(`Com proprietario: ${counters.withOwner}`)
    console.log(`Com dados internos sensiveis: ${counters.withPrivateSensitiveData}`)
    console.log(`Sem imagem: ${counters.withoutImage}`)
    console.log(`Sem preco/aluguel: ${counters.withoutPrice}`)
    console.log(`Referencias duplicadas: ${counters.duplicateReferences}`)
    console.log('\nStatus principais:')
    for (const item of report.top_status) console.log(`- ${item.name}: ${item.count}`)
    console.log('\nCidades principais:')
    for (const item of report.top_cities.slice(0, 10)) console.log(`- ${item.name}: ${item.count}`)
    console.log('\nTipos principais:')
    for (const item of report.top_types.slice(0, 10)) console.log(`- ${item.name}: ${item.count}`)
    console.log('\nAmostra mapeada:')
    console.log(JSON.stringify(sample, null, 2))
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(error => {
        console.error(error?.stack || error?.message || error)
        process.exit(1)
    })
}
