'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
    ArrowRight,
    ArrowUpRight,
    BedDouble,
    Building2,
    Camera,
    Car,
    ChevronLeft,
    ChevronRight,
    Compass,
    Dumbbell,
    Heart,
    KeyRound,
    Lock,
    MapPinned,
    MapPin,
    Maximize2,
    Menu,
    Minus,
    Navigation,
    Phone,
    Plus,
    ShieldCheck,
    Share2,
    Sparkles,
    Waves,
    X,
} from 'lucide-react'
import LandingPageLogic from '@/components/landing/LandingPageLogic'
import Footer from '@/components/layout/Footer'
import GoogleReviewsSection from '@/components/marketplace/GoogleReviewsSection'
import HomeBlogSection, { type HomeBlogPost } from '@/components/marketplace/HomeBlogSection'
import PropertyLocationMap, { type PropertyLocationMapProperty } from '@/components/property/PropertyLocationMap'
import PropertyLandingStyles from '@/app/imovel/[id]/PropertyLandingStyles'
import type { HomepageGoogleReviews } from '@/lib/google-reviews'
import { openWhatsAppWithLeadCapture } from '@/lib/tracking/whatsapp-capture'
import { TemplateProps } from './types'

type Unit = {
    id: string
    type: string
    title: string
    area: string
    suites: string
    vagas: string
    price: string
    image: string
    images?: string[]
    status: string
    sourceSlug: string
}

type Development = {
    id: string
    name: string
    pageSlug?: string
    city: string
    locationName: string
    tagline: string
    priceRange: string
    availableUnitsCount: number
    areaRange: string
    suitesRange: string
    heroImage: string
    description: string
    address: string
    latitude?: number | null
    longitude?: number | null
    benefits: Array<{ title: string; description: string; icon: 'ShieldCheck' | 'Waves' | 'Dumbbell' | 'Lock' | 'Compass' | 'Building2' | 'KeyRound' }>
    differentials: Array<{ title: string; description: string }>
    units: Unit[]
    gallery: Array<{ title: string; image: string; category: string }>
    faq: Array<{ question: string; answer: string }>
}

type RelatedDevelopment = {
    slug: string
    name: string
    locationName: string
    availableUnitsCount: number | null
    heroImage: string
}

type UnitPropertyMedia = {
    source_slug?: string | null
    featured_image?: string | null
    images?: string[] | null
    latitude?: number | string | null
    longitude?: number | string | null
}

type DevelopmentLocationMode = 'map' | 'street'

const R2 = 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev'
const GOOGLE_STATIC_PREVIEW_SIZE = '320x190'
const DEVELOPMENTS: Development[] = [
    {
        id: 'brava-concetto',
        name: 'Brava Concetto',
        pageSlug: 'bravaconceto',
        city: 'Itajai',
        locationName: 'Praia Brava, Itajai - SC',
        tagline: 'O privilegio de viver na Praia Brava com elegancia, exclusividade e design atemporal.',
        priceRange: 'R$ 8.600.000 a R$ 21.000.000',
        availableUnitsCount: 3,
        areaRange: '280m2 a 592m2',
        suitesRange: '4 suites',
        heroImage: '/images/brava-concetto/1_CL_BC_FACHADA_DIURNA_R01.jpg',
        description: 'Um empreendimento de poucas unidades na Praia Brava, pensado para quem busca privacidade, arquitetura autoral e uma experiencia residencial com leitura de patrimonio.',
        address: 'Av. Carlos Drummond de Andrade, 111 - Praia Brava',
        latitude: -26.95665680834595,
        longitude: -48.62979654548911,
        benefits: [
            { title: 'Privacidade e Exclusividade', description: 'Poucas unidades, plantas amplas e uma atmosfera residencial reservada.', icon: 'ShieldCheck' },
            { title: 'Lazer com Essencia de Resort', description: 'Piscina, salao de festas, espaco gourmet, fitness e areas sociais integradas.', icon: 'Waves' },
            { title: 'Rotina de Praia Sofisticada', description: 'Entrada para banhistas, bicicletario, box de praia e acesso rapido a orla.', icon: 'Compass' },
        ],
        differentials: [
            { title: 'Design Assinado', description: 'Arquitetura contemporanea, fachada marcante e interiores com acabamento de alto padrao.' },
            { title: 'Localizacao Praia Brava', description: 'Entre mar, gastronomia, servicos premium e conexao rapida com Balneario Camboriu.' },
            { title: 'Unidades de Alto Ticket', description: 'Garden, apartamento tipo e cobertura duplex com areas generosas e vagas amplas.' },
        ],
        units: [
            {
                id: 'bc-2299',
                type: 'Apartamento Tipo',
                title: 'Apartamento no Ed. Brava Concetto',
                area: '280m2',
                suites: '4 suites',
                vagas: '3 vagas',
                price: 'R$ 8.600.000',
                image: `${R2}/properties/imported/2299/001-2_cl_bc_fachada_noturna_r01-17690304118299.jpg`,
                status: 'Ultima Unidade',
                sourceSlug: 'apartamento-garden-no-ed-brava-concetto-na-praia-brava-em-itajaisc',
            },
            {
                id: 'bc-2298',
                type: 'Apartamento Garden',
                title: 'Apartamento Garden no Ed. Brava Concetto',
                area: '368m2',
                suites: '4 suites',
                vagas: '3 vagas',
                price: 'R$ 10.000.000',
                image: `${R2}/properties/imported/2298/001-5_cl_bc_voo_passaro_r01-1769030411830.jpg`,
                status: 'Disponivel',
                sourceSlug: 'apartamento-garden-no-ed-brava-concetto-na-praia-brava-em-itajaisc',
            },
            {
                id: 'bc-2300',
                type: 'Cobertura Duplex',
                title: 'Cobertura Duplex no Ed. Brava Concetto',
                area: '592m2',
                suites: '4 suites',
                vagas: '5 vagas',
                price: 'R$ 21.000.000',
                image: `${R2}/properties/imported/2300/001-6_cl_bc_detalhe_fachada_ang_01_ef-17690304118301.jpg`,
                status: 'Disponivel',
                sourceSlug: 'apartamento-garden-no-ed-brava-concetto-na-praia-brava-em-itajaisc',
            },
        ],
        gallery: [
            { title: 'Fachada diurna', image: '/images/brava-concetto/1_CL_BC_FACHADA_DIURNA_R01.jpg', category: 'Fachada' },
            { title: 'Fachada noturna', image: '/images/brava-concetto/2_CL_BC_FACHADA_NOTURNA_R01.jpg', category: 'Fachada' },
            { title: 'Vista aerea', image: '/images/brava-concetto/5_CL_BC_VOO_PASSARO_R01.jpg', category: 'Implantacao' },
            { title: 'Hall de entrada', image: '/images/brava-concetto/8_CL_BC_HALL_DE_ENTRADA_EF_web.jpg', category: 'Hall' },
            { title: 'Piscina', image: '/images/brava-concetto/15_CL_BC_PISCINA_EF_web.jpg', category: 'Lazer' },
            { title: 'Living', image: '/images/brava-concetto/22_CL_BC_LIVING_FINAL_02_EF_web.jpg', category: 'Interior' },
        ],
        faq: [
            { question: 'Quantas unidades ainda aparecem disponiveis?', answer: 'Hoje a vitrine trabalha com 3 unidades ativas no Brava Concetto: apartamento tipo, garden e cobertura duplex.' },
            { question: 'Posso receber uma leitura comparativa das unidades?', answer: 'Sim. O especialista pode comparar area, valor, posicao, vagas e liquidez de cada unidade para o seu objetivo.' },
            { question: 'A disponibilidade muda?', answer: 'Sim. Imoveis de alto padrao podem mudar de status rapidamente, entao a confirmacao final deve ser feita com o atendimento.' },
        ],
    },
    {
        id: 'ibiza-towers',
        name: 'Ibiza Towers',
        pageSlug: 'ibiza-towers',
        city: 'Balneario Camboriu',
        locationName: 'Barra Sul, Balneario Camboriu - SC',
        tagline: 'Frente mar real, lazer monumental e unidades amplas em uma das torres mais desejadas da Barra Sul.',
        priceRange: 'R$ 8.900.000 a R$ 29.500.000',
        availableUnitsCount: 18,
        areaRange: '230m2 a 490m2',
        suitesRange: '4 a 5 suites',
        heroImage: `${R2}/properties/imported/2523/001-whatsapp-image-2026-05-09-at-130333-17785968756664.jpeg`,
        description: 'Uma vitrine de alto padrao para quem procura frente mar, liquidez e estrutura de lazer completa em Balneario Camboriu.',
        address: 'Avenida Atlantica - Barra Sul',
        benefits: [
            { title: 'Frente Mar', description: 'Localizacao de alta procura, com vista e acesso privilegiado a orla.', icon: 'Waves' },
            { title: 'Lazer Completo', description: 'Piscina, spa, sauna, cinema, salao de festas, quadra e fitness.', icon: 'Dumbbell' },
            { title: 'Portfolio Amplo', description: 'Mais opcoes de unidades para comparar valor, andar e configuracao.', icon: 'Building2' },
        ],
        differentials: [
            { title: 'Barra Sul Consolidada', description: 'Regiao com forte demanda qualificada, turismo premium e alta liquidez.' },
            { title: 'Unidades Grandes', description: 'Apartamentos e coberturas com metragens generosas e vagas robustas.' },
            { title: 'Comparacao Imediata', description: 'Bom empreendimento para mostrar ao lead varias alternativas no mesmo predio.' },
        ],
        units: [
            {
                id: 'ib-2523',
                type: 'Apartamento Frente Mar',
                title: 'Apartamento no Ed. Ibiza Towers',
                area: '230m2',
                suites: '4 suites',
                vagas: '4 vagas',
                price: 'R$ 8.900.000',
                image: `${R2}/properties/imported/2523/001-whatsapp-image-2026-05-09-at-130333-17785968756664.jpeg`,
                status: 'Oportunidade',
                sourceSlug: 'apartamento-no-ed-ibiza-towers-em-balneario-camboriu',
            },
            {
                id: 'ib-282',
                type: 'Apartamento Mobiliado',
                title: 'Apartamento frente mar no Ibiza Towers',
                area: '237m2',
                suites: '4 suites',
                vagas: '4 vagas',
                price: 'R$ 9.980.000',
                image: `${R2}/properties/imported/282/001-thumb-2-16284623018784.jpg`,
                status: 'Disponivel',
                sourceSlug: 'apartamento-mobiliado-com-vista-para-o-mar-no-ibiza-towers-em-balneario-camboriu',
            },
            {
                id: 'ib-2185',
                type: 'Apartamento Vista Mar',
                title: 'Apartamento no Ed. Ibiza Towers',
                area: '237m2',
                suites: '4 suites',
                vagas: '4 vagas',
                price: 'R$ 10.000.000',
                image: `${R2}/properties/imported/2185/001-0b2e2b3c-800f-4886-b8e0-cc3b4707d374-17291740271884.jpeg`,
                status: 'Disponivel',
                sourceSlug: 'apartamnto-mobiliado-vista-para-o-mar-ibiza-tower-em-balneario-camboriu',
            },
        ],
        gallery: [
            { title: 'Ibiza Towers', image: `${R2}/properties/imported/2523/001-whatsapp-image-2026-05-09-at-130333-17785968756664.jpeg`, category: 'Fachada' },
            { title: 'Living', image: `${R2}/properties/imported/282/001-thumb-2-16284623018784.jpg`, category: 'Interior' },
            { title: 'Vista', image: `${R2}/properties/imported/2185/001-0b2e2b3c-800f-4886-b8e0-cc3b4707d374-17291740271884.jpeg`, category: 'Unidade' },
            { title: 'Ambiente', image: `${R2}/properties/imported/1279/001-_dsc2949-hdr-editar-17667054205826.jpg`, category: 'Interior' },
        ],
        faq: [
            { question: 'Quantas unidades do Ibiza aparecem na base?', answer: 'A varredura encontrou 18 unidades ativas associadas ao Ibiza Towers.' },
            { question: 'O Ibiza serve para comprador frente mar?', answer: 'Sim. Ele e uma das melhores vitrines para quem quer comparar frente mar em Balneario Camboriu.' },
            { question: 'Da para enviar unidades especificas?', answer: 'Sim. Cada card pode levar o lead direto para o especialista com a unidade de interesse.' },
        ],
    },
    {
        id: 'one-tower',
        name: 'One Tower',
        pageSlug: 'one-tower',
        city: 'Balneario Camboriu',
        locationName: 'Centro, Balneario Camboriu - SC',
        tagline: 'Um endereco frente mar iconico para quem busca exclusividade, vista e solidez patrimonial.',
        priceRange: 'R$ 9.800.000 a R$ 15.000.000',
        availableUnitsCount: 13,
        areaRange: '194m2 a 215m2',
        suitesRange: '4 suites',
        heroImage: `${R2}/properties/imported/746/003-whatsapp-image-2024-01-02-at-112504-1-17042062907829.jpeg`,
        description: 'O One Tower concentra alto padrao, frente mar e unidades com perfil de comprador exigente em Balneario Camboriu.',
        address: 'Avenida Atlantica, Centro - Balneario Camboriu',
        benefits: [
            { title: 'Frente Mar Iconico', description: 'Endereco de visibilidade e desejo para moradia ou investimento.', icon: 'Waves' },
            { title: 'Seguranca de Liquidez', description: 'Produto conhecido, com forte procura no mercado de alto padrao.', icon: 'Lock' },
            { title: 'Unidades Comparaveis', description: 'Boa leitura para comparar andar, acabamento, preco e area.', icon: 'KeyRound' },
        ],
        differentials: [
            { title: 'Endereco Consolidado', description: 'Localizacao em eixo nobre e com leitura clara de valorizacao.' },
            { title: 'Padrao Frente Mar', description: 'Unidades amplas, vistas abertas e configuracoes consistentes.' },
            { title: 'Curadoria Objetiva', description: 'Ideal para lead que quer poucas opcoes fortes e comparacao direta.' },
        ],
        units: [
            {
                id: 'ot-746',
                type: 'Apartamento Decorado',
                title: 'Apartamento no Ed. One Tower Decorado Frente Mar',
                area: '194m2',
                suites: '4 suites',
                vagas: '3 vagas',
                price: 'R$ 9.800.000',
                image: `${R2}/properties/imported/746/003-whatsapp-image-2024-01-02-at-112504-1-17042062907829.jpeg`,
                status: 'Oportunidade',
                sourceSlug: 'apartamento-no-ed-one-tower-em-balneario-camboriu',
            },
            {
                id: 'ot-809',
                type: 'Apartamento Frente Mar',
                title: 'Apartamento no Ed. One Tower',
                area: '196m2',
                suites: '4 suites',
                vagas: '3 vagas',
                price: 'R$ 10.000.000',
                image: `${R2}/properties/imported/809/005-whatsapp-image-2024-01-02-at-112506-17042064294075.jpeg`,
                status: 'Disponivel',
                sourceSlug: 'apartamento-no-ed-one-tower-em-balneario-camboriu',
            },
            {
                id: 'ot-375',
                type: 'Apartamento Vista Mar',
                title: 'Apartamento no Ed. One Tower',
                area: '196m2',
                suites: '4 suites',
                vagas: '3 vagas',
                price: 'R$ 10.900.000',
                image: `${R2}/properties/imported/375/003-whatsapp-image-2024-01-02-at-112503-17042058358438.jpeg`,
                status: 'Disponivel',
                sourceSlug: 'apartamento-no-ed-one-tower-em-balneario-camboriu',
            },
        ],
        gallery: [
            { title: 'One Tower', image: `${R2}/properties/imported/746/003-whatsapp-image-2024-01-02-at-112504-1-17042062907829.jpeg`, category: 'Unidade' },
            { title: 'Vista', image: `${R2}/properties/imported/809/005-whatsapp-image-2024-01-02-at-112506-17042064294075.jpeg`, category: 'Interior' },
            { title: 'Living', image: `${R2}/properties/imported/375/003-whatsapp-image-2024-01-02-at-112503-17042058358438.jpeg`, category: 'Interior' },
        ],
        faq: [
            { question: 'Quantas unidades do One Tower aparecem disponiveis?', answer: 'A varredura encontrou 13 unidades ativas relacionadas ao One Tower.' },
            { question: 'Ele e indicado para investidor?', answer: 'Sim, especialmente para quem procura endereco frente mar consolidado e produto de alta liquidez.' },
            { question: 'Posso comparar com Ibiza e Brava?', answer: 'Sim. Use o seletor da propria pagina para alternar entre empreendimentos e entender as diferencas.' },
        ],
    },
]

const iconMap = {
    ShieldCheck,
    Waves,
    Dumbbell,
    Lock,
    Compass,
    Building2,
    KeyRound,
}

const DEFAULT_DEVELOPMENT_ID = 'brava-concetto'

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asText(value: unknown, fallback = '') {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function normalizeSlug(value: unknown) {
    return asText(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
}

function asNumber(value: unknown, fallback = 0) {
    const number = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(number) ? number : fallback
}

function asOptionalNumber(value: unknown) {
    if (value === null || value === undefined) return null
    if (typeof value === 'string' && !value.trim()) return null

    const number = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'))
    return Number.isFinite(number) ? number : null
}

function normalizeUnit(value: unknown): Unit | null {
    if (!isRecord(value)) return null

    const id = asText(value.id)
    const type = asText(value.type)
    const title = asText(value.title, type)
    const image = asText(value.image)
    const images = Array.isArray(value.images)
        ? value.images.map(item => asText(item)).filter(Boolean)
        : []
    const sourceSlug = asText(value.sourceSlug ?? value.source_slug)

    if (!id || !type || !title || !image || !sourceSlug) return null

    return {
        id,
        type,
        title,
        area: asText(value.area, 'Consulte'),
        suites: asText(value.suites, 'Consulte'),
        vagas: asText(value.vagas, 'Consulte'),
        price: asText(value.price, 'Consulte'),
        image,
        images,
        status: asText(value.status, 'Disponivel'),
        sourceSlug,
    }
}

function normalizeGalleryItem(value: unknown): Development['gallery'][number] | null {
    if (!isRecord(value)) return null

    const image = asText(value.image)
    if (!image) return null

    return {
        title: asText(value.title, 'Imagem do empreendimento'),
        image,
        category: asText(value.category, 'Empreendimento'),
    }
}

function normalizeBenefit(value: unknown): Development['benefits'][number] | null {
    if (!isRecord(value)) return null

    const icon = asText(value.icon, 'Building2') as keyof typeof iconMap
    if (!iconMap[icon]) return null

    return {
        title: asText(value.title),
        description: asText(value.description),
        icon,
    }
}

function normalizeDifferential(value: unknown): Development['differentials'][number] | null {
    if (!isRecord(value)) return null

    const title = asText(value.title)
    const description = asText(value.description)
    if (!title || !description) return null

    return { title, description }
}

function normalizeFaq(value: unknown): Development['faq'][number] | null {
    if (!isRecord(value)) return null

    const question = asText(value.question)
    const answer = asText(value.answer)
    if (!question || !answer) return null

    return { question, answer }
}

function normalizeDevelopment(value: unknown): Development | null {
    if (!isRecord(value)) return null

    const id = asText(value.id)
    if (!id) return null

    const fallback = DEVELOPMENTS.find((item) => item.id === id)
    const name = asText(value.name, fallback?.name)
    if (!name) return null

    const benefits = Array.isArray(value.benefits)
        ? value.benefits.map(normalizeBenefit).filter((item): item is Development['benefits'][number] => Boolean(item))
        : []
    const differentials = Array.isArray(value.differentials)
        ? value.differentials.map(normalizeDifferential).filter((item): item is Development['differentials'][number] => Boolean(item))
        : []
    const units = Array.isArray(value.units)
        ? value.units.map(normalizeUnit).filter((item): item is Unit => Boolean(item))
        : []
    const gallery = Array.isArray(value.gallery)
        ? value.gallery.map(normalizeGalleryItem).filter((item): item is Development['gallery'][number] => Boolean(item))
        : []
    const faq = Array.isArray(value.faq)
        ? value.faq.map(normalizeFaq).filter((item): item is Development['faq'][number] => Boolean(item))
        : []
    const locationRecord = isRecord(value.location) ? value.location : null
    const coordinatesRecord = isRecord(value.coordinates) ? value.coordinates : null
    const latitude = asOptionalNumber(
        value.latitude
        ?? value.lat
        ?? value.location_latitude
        ?? value.locationLatitude
        ?? value.map_lat
        ?? value.mapLatitude
        ?? value.geo_latitude
        ?? coordinatesRecord?.latitude
        ?? coordinatesRecord?.lat
        ?? locationRecord?.latitude
        ?? locationRecord?.lat
    )
    const longitude = asOptionalNumber(
        value.longitude
        ?? value.lng
        ?? value.lon
        ?? value.location_longitude
        ?? value.locationLongitude
        ?? value.map_lng
        ?? value.mapLongitude
        ?? value.geo_longitude
        ?? coordinatesRecord?.longitude
        ?? coordinatesRecord?.lng
        ?? coordinatesRecord?.lon
        ?? locationRecord?.longitude
        ?? locationRecord?.lng
        ?? locationRecord?.lon
    )

    return {
        id,
        name,
        pageSlug: asText(value.pageSlug ?? value.page_slug ?? value.slug, fallback?.pageSlug),
        city: asText(value.city, fallback?.city || 'Santa Catarina'),
        locationName: asText(value.locationName ?? value.location_name, fallback?.locationName || 'Localizacao privilegiada'),
        tagline: asText(value.tagline, fallback?.tagline || 'Empreendimento de alto padrao com curadoria Guilherme Pilger.'),
        priceRange: asText(value.priceRange ?? value.price_range, fallback?.priceRange || 'Consulte'),
        availableUnitsCount: asNumber(value.availableUnitsCount ?? value.available_units_count, fallback?.availableUnitsCount || units.length),
        areaRange: asText(value.areaRange ?? value.area_range, fallback?.areaRange || 'Consulte'),
        suitesRange: asText(value.suitesRange ?? value.suites_range, fallback?.suitesRange || 'Consulte'),
        heroImage: asText(value.heroImage ?? value.hero_image, fallback?.heroImage || gallery[0]?.image || '/placeholder-house.jpg'),
        description: asText(value.description, fallback?.description || 'Empreendimento selecionado pela curadoria Guilherme Pilger.'),
        address: asText(value.address, fallback?.address || asText(value.locationName ?? value.location_name, 'Santa Catarina')),
        latitude: latitude ?? fallback?.latitude ?? null,
        longitude: longitude ?? fallback?.longitude ?? null,
        benefits: benefits.length ? benefits : (fallback?.benefits || []),
        differentials: differentials.length ? differentials : (fallback?.differentials || []),
        units: units.length ? units : (fallback?.units || []),
        gallery: gallery.length ? gallery : (fallback?.gallery || []),
        faq: faq.length ? faq : (fallback?.faq || []),
    }
}

function summarizeUnitTypes(development: Development) {
    const types = Array.from(new Set(development.units.map(unit => unit.type).filter(Boolean))).slice(0, 3)
    if (!types.length) return 'unidades selecionadas'
    if (types.length === 1) return types[0].toLowerCase()
    if (types.length === 2) return `${types[0].toLowerCase()} e ${types[1].toLowerCase()}`
    return `${types.slice(0, -1).map(type => type.toLowerCase()).join(', ')} e ${types[types.length - 1].toLowerCase()}`
}

function buildDevelopmentSellingDescription(development: Development) {
    const unitTypes = summarizeUnitTypes(development)
    return `O ${development.name} reune ${development.availableUnitsCount} ${development.availableUnitsCount === 1 ? 'unidade ativa' : 'unidades ativas'} em ${development.locationName}. A pagina ajuda voce a comparar ${unitTypes}, faixa de valor, metragens, imagens e entorno antes de conversar com o especialista.`
}

function buildDevelopmentBenefits(development: Development): Development['benefits'] {
    const unitTypes = summarizeUnitTypes(development)
    return [
        {
            title: `Endereco em ${development.locationName}`,
            description: `Uma leitura clara do entorno para entender rotina, acesso, conveniencia e potencial de valorizacao antes da visita.`,
            icon: 'Compass',
        },
        {
            title: 'Comparacao no mesmo empreendimento',
            description: `Veja ${unitTypes} lado a lado, com area, suites, vagas, valor estimado e fotos para comparar com calma.`,
            icon: 'Building2',
        },
        {
            title: 'Curadoria para escolher melhor',
            description: `A equipe confirma disponibilidade, condicoes de negociacao e detalhes relevantes para avancar com seguranca.`,
            icon: 'ShieldCheck',
        },
    ]
}

function buildDevelopmentDifferentials(development: Development): Development['differentials'] {
    return [
        {
            title: 'Unidades em comparacao real',
            description: `${development.availableUnitsCount} opcoes ativas aparecem reunidas para comparar preco, metragem, suites e vagas sem alternar entre varias paginas.`,
        },
        {
            title: 'Fotos, mapa e Street View',
            description: `A galeria padronizada mostra o empreendimento, o entorno no mapa e a rua pelo Street View para uma primeira leitura visual mais completa.`,
        },
        {
            title: 'Proximo passo objetivo',
            description: `Abra os detalhes da unidade que chamou atencao ou chame o especialista para receber uma comparacao direta entre as melhores opcoes.`,
        },
    ]
}

function mapQueryFor(development: Development) {
    return encodeURIComponent([development.address, development.locationName].filter(Boolean).join(', '))
}

function validLatLng(latValue: unknown, lngValue: unknown): [number, number] | null {
    const lat = asOptionalNumber(latValue)
    const lng = asOptionalNumber(lngValue)

    if (
        typeof lat === 'number'
        && typeof lng === 'number'
        && Number.isFinite(lat)
        && Number.isFinite(lng)
        && lat >= -90
        && lat <= 90
        && lng >= -180
        && lng <= 180
    ) {
        return [lat, lng]
    }

    return null
}

function developmentLatLngFor(development: Development) {
    return validLatLng(development.latitude, development.longitude)
}

function buildMapEmbedSrc(development: Development, latLng?: [number, number] | null) {
    const coordinates = latLng || developmentLatLngFor(development)
    const coordinatesQuery = coordinates
        ? `${coordinates[0]},${coordinates[1]}`
        : ''
    const query = coordinatesQuery ? encodeURIComponent(coordinatesQuery) : mapQueryFor(development)
    return `https://maps.google.com/maps?q=${query}&z=16&output=embed&hl=pt-BR`
}

function buildStreetViewEmbedSrc(development: Development, latLng?: [number, number] | null) {
    const coordinates = latLng || developmentLatLngFor(development)

    if (coordinates) {
        return `https://maps.google.com/maps?layer=c&cbll=${coordinates[0]},${coordinates[1]}&cbp=12,0,0,0,0&output=svembed&hl=pt-BR`
    }

    return `https://maps.google.com/maps?q=${mapQueryFor(development)}&layer=c&z=17&output=svembed&hl=pt-BR`
}

function buildStaticStreetViewPreviewUrl(latLng?: [number, number] | null) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey || !latLng) return null

    const [lat, lng] = latLng
    const params = new URLSearchParams({
        size: GOOGLE_STATIC_PREVIEW_SIZE,
        location: `${lat},${lng}`,
        fov: '80',
        heading: '0',
        pitch: '0',
        source: 'outdoor',
        return_error_code: 'true',
        key: apiKey,
    })

    return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`
}

function uniqueImages(images: string[]) {
    const seen = new Set<string>()
    return images.filter((image) => {
        if (!image || seen.has(image)) return false
        seen.add(image)
        return true
    })
}

function galleryForUnit(unit: Unit, propertyMedia: UnitPropertyMedia | undefined, development: Development) {
    const propertyImages = Array.isArray(propertyMedia?.images)
        ? propertyMedia.images.map((image) => asText(image)).filter(Boolean)
        : []

    return uniqueImages([
        unit.image,
        ...(unit.images || []),
        asText(propertyMedia?.featured_image),
        ...propertyImages,
        ...development.gallery.map((item) => item.image),
    ]).slice(0, 12)
}

function numberFromText(value: string) {
    const match = value.match(/\d+(?:[,.]\d+)?/)
    if (!match) return null

    const parsed = Number(match[0].replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : null
}

function buildDevelopmentLocationProperty(development: Development): PropertyLocationMapProperty {
    return {
        id: `development-${development.id}`,
        title: development.name,
        description: development.description,
        seo_title: development.name,
        seo_description: development.description,
        city: development.city,
        state: 'SC',
        neighborhood: development.locationName.split(',')[0]?.trim() || development.locationName,
        suites: numberFromText(development.suitesRange),
        area_m2: numberFromText(development.areaRange),
        area_private_m2: numberFromText(development.areaRange),
        property_type: 'Empreendimento',
        exclusive: true,
    }
}

export default function BravaConcettoTemplate({ slug, landingPageId, agentName, greetingMessage, content }: TemplateProps) {
    const contentDevelopment = useMemo(() => normalizeDevelopment(content?.development), [content])
    const [faqOpen, setFaqOpen] = useState<number | null>(0)
    const [broker, setBroker] = useState<{ name?: string; phone?: string; photo_url?: string | null; greeting_message?: string } | null>(null)
    const [googleReviews, setGoogleReviews] = useState<HomepageGoogleReviews | null>(null)
    const [editorialPosts, setEditorialPosts] = useState<HomeBlogPost[]>([])
    const [publicDevelopments, setPublicDevelopments] = useState<RelatedDevelopment[]>([])
    const [unitMediaBySlug, setUnitMediaBySlug] = useState<Record<string, UnitPropertyMedia>>({})
    const [locationModal, setLocationModal] = useState<DevelopmentLocationMode | null>(null)

    const activeDev = useMemo(() => {
        const contentDevelopmentId = asText(content?.development_id, contentDevelopment?.id || DEFAULT_DEVELOPMENT_ID)
        return contentDevelopment || normalizeDevelopment({ id: contentDevelopmentId }) || DEVELOPMENTS[0]
    }, [content, contentDevelopment])

    const unitSlugKey = useMemo(
        () => Array.from(new Set(activeDev.units.map(unit => unit.sourceSlug).filter(Boolean))).join(','),
        [activeDev.units]
    )

    useEffect(() => {
        fetch(`/api/broker-for-page?slug=${slug}`)
            .then((response) => response.json())
            .then((payload) => {
                if (payload?.broker) setBroker(payload.broker)
            })
            .catch(() => {})
    }, [slug])

    useEffect(() => {
        let cancelled = false

        async function loadLandingSupportSections() {
            try {
                const [reviewsResponse, editorialResponse, developmentsResponse] = await Promise.all([
                    fetch('/api/public/google-reviews'),
                    fetch('/api/public/editorial?limit=4'),
                    fetch('/api/public/developments'),
                ])

                if (cancelled) return

                if (reviewsResponse.ok) {
                    const payload = await reviewsResponse.json()
                    setGoogleReviews(payload?.data || null)
                }

                if (editorialResponse.ok) {
                    const payload = await editorialResponse.json()
                    setEditorialPosts(Array.isArray(payload?.posts) ? payload.posts : [])
                }

                if (developmentsResponse.ok) {
                    const payload = await developmentsResponse.json()
                    setPublicDevelopments(Array.isArray(payload?.developments) ? payload.developments : [])
                }
            } catch {
                if (!cancelled) {
                    setGoogleReviews(null)
                    setEditorialPosts([])
                    setPublicDevelopments([])
                }
            }
        }

        loadLandingSupportSections()

        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        let cancelled = false

        async function loadUnitMedia() {
            if (!unitSlugKey) {
                setUnitMediaBySlug({})
                return
            }

            try {
                const response = await fetch(`/api/public/properties?slugs=${encodeURIComponent(unitSlugKey)}`)
                if (!response.ok) throw new Error('properties unavailable')
                const payload = await response.json()
                if (cancelled) return

                const mediaMap: Record<string, UnitPropertyMedia> = {}
                const properties = Array.isArray(payload?.properties) ? payload.properties : []
                properties.forEach((property: UnitPropertyMedia) => {
                    const sourceSlug = asText(property.source_slug)
                    if (sourceSlug) mediaMap[sourceSlug] = property
                })
                setUnitMediaBySlug(mediaMap)
            } catch {
                if (!cancelled) setUnitMediaBySlug({})
            }
        }

        loadUnitMedia()

        return () => {
            cancelled = true
        }
    }, [unitSlugKey])

    const relatedDevelopments = useMemo(() => {
        const activeIdentifiers = new Set([
            normalizeSlug(activeDev.id),
            normalizeSlug(activeDev.pageSlug || ''),
            normalizeSlug(activeDev.name),
        ])
        const fromPublic = publicDevelopments
            .filter((development) => {
                const slug = normalizeSlug(development.slug)
                const name = normalizeSlug(development.name)
                return slug && !activeIdentifiers.has(slug) && !activeIdentifiers.has(name)
            })
            .slice(0, 6)

        if (fromPublic.length) return fromPublic

        return DEVELOPMENTS
            .filter((development) => development.id !== activeDev.id)
            .slice(0, 6)
            .map((development) => ({
                slug: development.pageSlug || development.id,
                name: development.name,
                locationName: development.locationName,
                availableUnitsCount: development.availableUnitsCount,
                heroImage: development.heroImage,
            }))
    }, [activeDev.id, activeDev.name, activeDev.pageSlug, publicDevelopments])
    const sellingDescription = useMemo(() => buildDevelopmentSellingDescription(activeDev), [activeDev])
    const sellingBenefits = useMemo(() => buildDevelopmentBenefits(activeDev), [activeDev])
    const decisionDifferentials = useMemo(() => buildDevelopmentDifferentials(activeDev), [activeDev])
    const developmentLocationProperty = useMemo(() => buildDevelopmentLocationProperty(activeDev), [activeDev])
    const unitMediaLatLng = useMemo<[number, number] | null>(() => {
        for (const unit of activeDev.units) {
            const latLng = validLatLng(
                unitMediaBySlug[unit.sourceSlug]?.latitude,
                unitMediaBySlug[unit.sourceSlug]?.longitude
            )
            if (latLng) return latLng
        }

        return null
    }, [activeDev.units, unitMediaBySlug])
    const developmentLatLng = useMemo<[number, number] | null>(() => {
        return developmentLatLngFor(activeDev) || unitMediaLatLng
    }, [activeDev, unitMediaLatLng])
    const mapEmbedSrc = useMemo(() => buildMapEmbedSrc(activeDev, developmentLatLng), [activeDev, developmentLatLng])
    const streetViewEmbedSrc = useMemo(() => buildStreetViewEmbedSrc(activeDev, developmentLatLng), [activeDev, developmentLatLng])

    useEffect(() => {
        if (!locationModal) return

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setLocationModal(null)
            }
        }

        document.body.classList.add('bc-location-modal-open')
        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.body.classList.remove('bc-location-modal-open')
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [locationModal])

    const openChat = useCallback((unit?: Unit) => {
        if (!broker?.phone) return

        const message = unit
            ? `Ola! Vi a pagina do empreendimento ${activeDev.name} e quero mais informacoes sobre ${unit.type} (${unit.area}, ${unit.price}).`
            : broker.greeting_message || `Ola! Quero falar com um especialista sobre o empreendimento ${activeDev.name}.`

        openWhatsAppWithLeadCapture({
            phone: broker.phone,
            message,
            slug,
            template: 'brava-concetto',
        })
    }, [activeDev.name, broker, slug])

    const handleScrollToUnits = () => {
        document.getElementById('unidades-disponiveis')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    return (
        <div className="bc-page min-h-screen bg-[#F7F5F0] text-[#2F2A22] antialiased selection:bg-[#D4AF37] selection:text-[#0A0D10]">
            <LandingPageLogic slug={slug} landingPageId={landingPageId} agentName={agentName} greetingMessage={greetingMessage} />
            <LandingMobileHeader />

            <main>
                <section className="relative flex min-h-[calc(100vh-120px)] items-center overflow-hidden bg-[#07090C]">
                    <div className="absolute inset-0">
                        <img
                            src={activeDev.heroImage}
                            alt={activeDev.name}
                            className="h-full w-full object-cover opacity-90 transition duration-700"
                            referrerPolicy="no-referrer"
                        />
                        <div className="bc-hero-depth-overlay absolute inset-0 bg-gradient-to-t from-[#0A0D10] via-[#0A0D10]/45 to-[#0A0D10]/75" />
                        <div className="bc-hero-side-fade absolute inset-0 hidden bg-gradient-to-r from-[#0A0D10]/95 via-[#0A0D10]/25 to-transparent lg:block" />
                        <div className="bc-hero-top-fade" />
                    </div>

                    <div className="relative z-10 mx-auto flex min-h-[760px] w-full max-w-[1320px] flex-col justify-between gap-12 px-4 py-14 md:px-8 lg:py-20">
                        <div className="bc-hero-copy max-w-4xl pt-8">
                            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/35 bg-[#11161D]/90 px-4 py-2 text-[10px] font-mono uppercase tracking-[0.22em] text-[#D4AF37]">
                                <Sparkles size={14} />
                                Empreendimento exclusivo
                            </div>

                            <h1 className="mb-6 text-5xl font-semibold leading-[1.02] tracking-tight text-white md:text-7xl lg:text-8xl">
                                {activeDev.name}
                            </h1>

                            <p className="mb-8 max-w-2xl text-lg font-bold leading-relaxed text-zinc-200 md:text-2xl">
                                {activeDev.tagline}
                            </p>

                            <div className="bc-hero-cta bc-hero-cta--desktop flex flex-col gap-4 sm:flex-row">
                                <HeroUnitsButton onClick={handleScrollToUnits} />
                            </div>
                        </div>

                        <div className="bc-hero-metrics grid max-w-5xl grid-cols-2 rounded-lg border border-zinc-800/70 bg-[#11161D]/85 shadow-2xl backdrop-blur-md lg:grid-cols-4">
                            <HeroMetric icon={MapPin} label="Localizacao" value={activeDev.locationName} note="Regiao nobre" />
                            <HeroMetric icon={KeyRound} label="Faixa de preco" value={activeDev.priceRange} note="Curadoria ativa" />
                            <HeroMetric icon={Maximize2} label="Oportunidade" value={`${activeDev.availableUnitsCount} unidades`} note="Disponiveis agora" highlight />
                            <HeroMetric icon={BedDouble} label="Configuracoes" value={activeDev.suitesRange} note={activeDev.areaRange} />
                        </div>

                        <div className="bc-hero-cta bc-hero-cta--mobile">
                            <HeroUnitsButton onClick={handleScrollToUnits} />
                        </div>
                    </div>
                </section>

                <section className="border-y border-zinc-800/50 bg-[#11161D] py-10">
                    <div className="mx-auto grid max-w-[1320px] grid-cols-2 gap-6 px-4 text-center md:grid-cols-4 md:px-8">
                        <Stat label="Produto" value="Empreendimento" />
                        <Stat label="Estoque" value={`${activeDev.availableUnitsCount} unidades`} gold />
                        <Stat label="Localizacao" value={activeDev.city} />
                        <Stat label="Padrao" value="Alto luxo" />
                    </div>
                </section>

                <section id="unidades-disponiveis" className="border-b border-[#D4AF37]/10 bg-[#0D1117] py-20 md:py-24">
                    <div className="mx-auto max-w-[1320px] px-4 md:px-8">
                        <div className="mb-14 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                            <div className="max-w-2xl">
                                <span className="mb-3 block text-xs font-mono uppercase tracking-[0.24em] text-[#D4AF37]">Inventario exclusivo</span>
                                <h2 className="text-4xl font-semibold tracking-tight text-white md:text-6xl">Unidades Disponiveis</h2>
                                <p className="mt-5 text-sm font-light leading-relaxed text-zinc-400 md:text-base">
                                    Apenas <strong className="font-semibold text-[#D4AF37]">{activeDev.availableUnitsCount} unidades</strong> aparecem ativas neste empreendimento. Compare as opcoes e fale com o especialista.
                                </p>
                            </div>
                            <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-zinc-800 bg-[#141A24] px-4 py-3 text-xs font-mono uppercase tracking-[0.14em] text-zinc-300">
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                Estoque atualizado
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
                            {activeDev.units.map((unit) => (
                                <UnitCard
                                    key={unit.id}
                                    unit={unit}
                                    development={activeDev}
                                    propertyMedia={unitMediaBySlug[unit.sourceSlug]}
                                />
                            ))}
                        </div>
                    </div>
                </section>

                <section className="bc-development-gallery-section bg-[#0A0D10] py-20 md:py-24">
                    <div className="mx-auto max-w-[1320px] px-4 md:px-8">
                        <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                            <div>
                                <span className="mb-3 block text-xs font-mono uppercase tracking-[0.24em] text-[#D4AF37]">Galeria</span>
                                <h2 className="text-4xl font-semibold text-white md:text-5xl">Visual do empreendimento</h2>
                            </div>
                            <p className="max-w-sm text-sm text-zinc-500">Imagens, mapa e Street View para entender o empreendimento e o entorno antes da visita.</p>
                        </div>
                        <DevelopmentMediaShowcase
                            development={activeDev}
                            latLng={developmentLatLng}
                            mapEmbedSrc={mapEmbedSrc}
                            onOpenLocation={setLocationModal}
                            property={developmentLocationProperty}
                            streetViewEmbedSrc={streetViewEmbedSrc}
                        />
                    </div>
                </section>

                <section className="bc-compare-section bg-[#0A0D10] py-20 md:py-24">
                    <div className="mx-auto grid max-w-[1320px] grid-cols-1 gap-12 px-4 md:px-8 lg:grid-cols-12">
                        <div className="lg:col-span-4">
                            <span className="mb-3 block text-xs font-mono uppercase tracking-[0.24em] text-[#D4AF37]">Por que este empreendimento</span>
                            <h2 className="text-4xl font-semibold leading-tight text-white md:text-5xl">Compare o empreendimento antes da visita.</h2>
                            <p className="mt-5 text-sm leading-relaxed text-zinc-400">{sellingDescription}</p>
                        </div>
                        <div className="grid gap-5 md:grid-cols-3 lg:col-span-8">
                            {sellingBenefits.map((benefit) => {
                                const Icon = iconMap[benefit.icon]
                                return (
                                    <div key={benefit.title} className="rounded-lg border border-zinc-800 bg-[#11161D]/75 p-6">
                                        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-md border border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#D4AF37]">
                                            <Icon size={21} />
                                        </div>
                                        <h3 className="mb-3 text-xl font-semibold text-white">{benefit.title}</h3>
                                        <p className="text-sm leading-relaxed text-zinc-400">{benefit.description}</p>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </section>

                <section className="bc-differentials-section border-y border-zinc-800 bg-[#11161D] py-20">
                    <div className="mx-auto max-w-[1320px] px-4 md:px-8">
                        <div className="mb-12 max-w-2xl">
                            <span className="mb-3 block text-xs font-mono uppercase tracking-[0.24em] text-[#D4AF37]">Diferenciais</span>
                            <h2 className="text-4xl font-semibold text-white md:text-5xl">Pontos para comparar melhor.</h2>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                            {decisionDifferentials.map((item, index) => (
                                <div key={item.title} className="rounded-lg border border-zinc-800 bg-[#0D1117] p-6">
                                    <div className="mb-6 text-xs font-mono text-[#D4AF37]">0{index + 1}</div>
                                    <h3 className="mb-3 text-xl font-semibold text-white">{item.title}</h3>
                                    <p className="text-sm leading-relaxed text-zinc-400">{item.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="bc-location-section border-y border-zinc-800 bg-[#11161D] py-20">
                    <div className="mx-auto grid max-w-[1320px] grid-cols-1 gap-10 px-4 md:px-8 lg:grid-cols-12">
                        <div className="lg:col-span-4">
                            <span className="mb-3 block text-xs font-mono uppercase tracking-[0.24em] text-[#D4AF37]">Localizacao</span>
                            <h2 className="text-4xl font-semibold text-white md:text-5xl">{activeDev.locationName}</h2>
                            <p className="mt-5 text-sm leading-relaxed text-zinc-400">{activeDev.address}</p>
                            <a
                                href={`https://www.google.com/maps/search/${encodeURIComponent(activeDev.address)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-8 inline-flex items-center gap-2 rounded border border-[#D4AF37]/60 px-5 py-3 text-xs font-black uppercase tracking-[0.15em] text-[#D4AF37] transition hover:bg-[#D4AF37] hover:text-[#0A0D10]"
                            >
                                Abrir mapa
                                <Navigation size={15} />
                            </a>
                        </div>
                        <div className="bc-location-address-card lg:col-span-8">
                            <span>Mapa e Street View</span>
                            <h3>Explore o entorno na galeria acima.</h3>
                            <p>O mapa e a rua do empreendimento ficam juntos das fotos para comparar fachada, acesso e localizacao em uma unica leitura visual.</p>
                            <button type="button" onClick={() => setLocationModal('map')}>
                                Ver mapa em tela cheia
                                <ArrowUpRight size={15} />
                            </button>
                        </div>
                    </div>
                </section>

                <section className="bc-faq-section bg-[#0A0D10] py-20">
                    <div className="mx-auto grid max-w-[1320px] grid-cols-1 gap-10 px-4 md:px-8 lg:grid-cols-12">
                        <div className="lg:col-span-4">
                            <span className="mb-3 block text-xs font-mono uppercase tracking-[0.24em] text-[#D4AF37]">Duvidas frequentes</span>
                            <h2 className="text-4xl font-semibold text-white md:text-5xl">Antes de falar com o especialista</h2>
                        </div>
                        <div className="lg:col-span-8">
                            {activeDev.faq.map((item, index) => (
                                <button
                                    key={item.question}
                                    type="button"
                                    onClick={() => setFaqOpen(faqOpen === index ? null : index)}
                                    className="block w-full border-b border-zinc-800 py-6 text-left"
                                >
                                    <div className="flex items-center justify-between gap-6">
                                        <h3 className="text-lg font-semibold text-white">{item.question}</h3>
                                        {faqOpen === index ? <Minus className="h-5 w-5 text-[#D4AF37]" /> : <Plus className="h-5 w-5 text-zinc-500" />}
                                    </div>
                                    {faqOpen === index && <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-400">{item.answer}</p>}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                <RelatedDevelopmentsSection activeDev={activeDev} developments={relatedDevelopments} />

                <GoogleReviewsSection data={googleReviews} />

                <HomeBlogSection posts={editorialPosts} />
            </main>

            <Footer />

            {locationModal && createPortal(
                <DevelopmentLocationModal
                    fallbackSrc={locationModal === 'street' ? streetViewEmbedSrc : mapEmbedSrc}
                    latLng={developmentLatLng}
                    mode={locationModal}
                    onClose={() => setLocationModal(null)}
                    property={developmentLocationProperty}
                    title={locationModal === 'street' ? `Street View de ${activeDev.name}` : `Mapa de ${activeDev.name}`}
                />,
                document.body,
            )}

            <div className="bc-floating-actions">
                <button
                    type="button"
                    onClick={() => openChat()}
                    className="bc-floating-consult"
                >
                    <Phone size={16} />
                    <span>Falar com especialista</span>
                </button>
            </div>

            <PropertyLandingStyles />

            <style jsx global>{`
                .bc-page {
                    min-height: 100vh;
                    background: #f7f5f0;
                    color: #2f2a22;
                    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                    overflow-x: clip;
                    padding-bottom: 82px;
                    letter-spacing: 0;
                }

                .bc-page * {
                    box-sizing: border-box;
                }

                .bc-page button,
                .bc-page a {
                    font: inherit;
                }

                .bc-page button {
                    cursor: pointer;
                }

                .bc-page main > section {
                    position: relative;
                }

                .bc-page main > section:nth-of-type(1) {
                    min-height: calc(100vh - 88px);
                    display: flex;
                    align-items: center;
                    overflow: hidden;
                    background: #f0ede8;
                }

                .bc-page main > section:nth-of-type(1) > div:first-child {
                    position: absolute;
                    inset: 0;
                }

                .bc-page main > section:nth-of-type(1) > div:first-child img {
                    width: 100%;
                    height: 100%;
                    display: block;
                    object-fit: cover;
                    opacity: 1;
                    filter: saturate(1.04) contrast(1.06);
                }

                .bc-page .bc-hero-depth-overlay,
                .bc-page .bc-hero-side-fade {
                    position: absolute;
                    inset: 0;
                }

                .bc-page .bc-hero-depth-overlay {
                    background: linear-gradient(to top, rgba(247, 245, 240, 0.24) 0%, rgba(247, 245, 240, 0.07) 46%, rgba(247, 245, 240, 0.11) 100%);
                }

                .bc-page .bc-hero-side-fade {
                    background: linear-gradient(90deg, rgba(247, 245, 240, 0.28), rgba(247, 245, 240, 0.08) 38%, rgba(247, 245, 240, 0) 78%);
                }

                .bc-page .bc-hero-top-fade {
                    position: absolute;
                    inset: 0 0 auto;
                    height: clamp(70px, 7vw, 112px);
                    pointer-events: none;
                    background: linear-gradient(
                        to bottom,
                        rgba(255, 255, 255, 0.24) 0%,
                        rgba(255, 255, 255, 0.14) 34%,
                        rgba(255, 255, 255, 0.04) 74%,
                        rgba(255, 255, 255, 0) 100%
                    );
                }

                .bc-page main > section:nth-of-type(1) > div:last-child {
                    position: relative;
                    z-index: 1;
                    width: min(1260px, calc(100% - 32px));
                    min-height: 690px;
                    margin: 0 auto;
                    padding: 52px 0 48px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    gap: 48px;
                }

                .bc-page main > section:nth-of-type(1) > div:last-child > div:first-child {
                    max-width: 700px;
                    padding-top: 24px;
                }

                .bc-page main > section:nth-of-type(1) h1 {
                    max-width: 700px;
                    margin: 0 0 22px;
                    color: #211d18;
                    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
                    font-size: clamp(2.75rem, 3vw, 3.7rem);
                    font-weight: 400;
                    line-height: 1.04;
                    letter-spacing: 0;
                }

                .bc-page main > section:nth-of-type(1) p {
                    margin: 0;
                }

                .bc-page main > section:nth-of-type(1) h1 + p {
                    max-width: 640px;
                    margin-bottom: 30px;
                    color: #4c4539;
                    font-size: clamp(0.98rem, 1.1vw, 1.18rem);
                    font-weight: 700;
                    line-height: 1.72;
                }

                .bc-page main > section:nth-of-type(1) > div:last-child > div:first-child > div:first-child {
                    width: fit-content;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 22px;
                    border: 1px solid rgba(184, 148, 95, 0.34);
                    border-radius: 999px;
                    background: rgba(255, 255, 255, 0.72);
                    color: #9b761f;
                    padding: 8px 13px;
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 9px;
                    font-weight: 900;
                    letter-spacing: 0.22em;
                    text-transform: uppercase;
                }

                .bc-page main > section:nth-of-type(1) > div:last-child > div:first-child > div:last-child {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 14px;
                }

                .bc-page main > section:nth-of-type(1) > div:last-child > div:first-child button {
                    min-height: 43px;
                    border-radius: 4px;
                    padding: 13px 24px;
                    font-size: 10px;
                    font-weight: 950;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                    transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease;
                }

                .bc-page main > section:nth-of-type(1) > div:last-child > div:first-child button:hover {
                    transform: translateY(-1px);
                }

                .bc-page main > section:nth-of-type(1) > div:last-child > div:first-child button:first-child {
                    border: 0;
                    background: #d4af37;
                    color: #0a0d10;
                    box-shadow: 0 18px 38px rgba(184, 148, 95, 0.18);
                }

                .bc-page main > section:nth-of-type(1) > div:last-child > div:first-child button:last-child {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    border: 0;
                    background: #d4af37;
                    color: #0a0d10;
                    box-shadow: 0 18px 38px rgba(184, 148, 95, 0.18);
                }

                .bc-page .bc-hero-metrics {
                    width: min(100%, 920px);
                    position: relative;
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 0;
                    overflow: hidden;
                    border: 1px solid rgba(184, 148, 95, 0.22);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.82);
                    padding: 14px;
                    box-shadow: 0 22px 58px rgba(31, 27, 21, 0.1);
                    backdrop-filter: blur(14px);
                }

                .bc-page .bc-hero-metrics::before,
                .bc-page .bc-hero-metrics::after {
                    content: "";
                    position: absolute;
                    z-index: 1;
                    display: none;
                    pointer-events: none;
                    background: rgba(31, 27, 21, 0.14);
                }

                .bc-page .bc-hero-metric {
                    position: relative;
                    z-index: 2;
                    display: flex;
                    min-width: 0;
                    gap: 11px;
                    border-right: 1px solid rgba(31, 27, 21, 0.12);
                    padding: 3px 14px;
                }

                .bc-page .bc-hero-metric:last-child {
                    border-right: 0;
                }

                .bc-page .bc-hero-metric-icon {
                    width: 36px;
                    height: 36px;
                    flex: 0 0 auto;
                    display: grid;
                    place-items: center;
                    border: 1px solid rgba(184, 148, 95, 0.18);
                    border-radius: 6px;
                    background: #fbf8f1;
                    color: #d4af37;
                }

                .bc-page .bc-hero-metric p,
                .bc-page .bc-hero-metric span {
                    margin: 0;
                }

                .bc-page .bc-hero-metric p {
                    color: #8a7a5d;
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 9px;
                    font-weight: 500;
                    letter-spacing: 0.18em;
                    text-transform: uppercase;
                }

                .bc-page .bc-hero-metric h3 {
                    margin: 4px 0 3px;
                    color: #211d18;
                    font-size: 13px;
                    font-weight: 500;
                    line-height: 1.35;
                    overflow-wrap: anywhere;
                }

                .bc-page .bc-hero-metric h3.text-emerald-400 {
                    color: #0f8d54;
                }

                .bc-page .bc-hero-metric span {
                    color: #7c7468;
                    font-size: 10px;
                }

                .bc-page main > section:nth-of-type(2) {
                    border-top: 1px solid rgba(184, 148, 95, 0.16);
                    border-bottom: 1px solid rgba(184, 148, 95, 0.16);
                    background: #ffffff;
                    padding: 26px 0;
                }

                .bc-page main > section:nth-of-type(2) > div {
                    width: min(1320px, calc(100% - 32px));
                    margin: 0 auto;
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 24px;
                    text-align: center;
                }

                .bc-page main > section:nth-of-type(2) p:first-child {
                    margin: 0;
                    color: #8a7a5d;
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 10px;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                }

                .bc-page main > section:nth-of-type(2) p:last-child {
                    margin: 4px 0 0;
                    color: #211d18;
                    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
                    font-size: 18px;
                }

                .bc-page main > section:nth-of-type(2) .bc-stat-value.is-gold {
                    color: #b58a28;
                }

                .bc-page #unidades-disponiveis,
                .bc-page main > section:nth-of-type(4),
                .bc-page main > section:nth-of-type(5),
                .bc-page main > section:nth-of-type(6),
                .bc-page main > section:nth-of-type(7),
                .bc-page main > section:nth-of-type(8) {
                    padding: 96px 0;
                }

                .bc-page #unidades-disponiveis {
                    border-bottom: 1px solid rgba(184, 148, 95, 0.16);
                    background: #f7f5f0;
                    scroll-margin-top: 86px;
                }

                .bc-page #unidades-disponiveis > div,
                .bc-page main > section:nth-of-type(4) > div,
                .bc-page main > section:nth-of-type(5) > div,
                .bc-page main > section:nth-of-type(6) > div,
                .bc-page main > section:nth-of-type(7) > div,
                .bc-page main > section:nth-of-type(8) > div {
                    width: min(1320px, calc(100% - 32px));
                    margin: 0 auto;
                }

                .bc-page #unidades-disponiveis > div {
                    width: min(1220px, calc(100% - 32px));
                }

                .bc-page #unidades-disponiveis > div > div:first-child,
                .bc-page main > section:nth-of-type(6) > div > div:first-child {
                    margin-bottom: 56px;
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    gap: 28px;
                }

                .bc-page #unidades-disponiveis h2,
                .bc-page main > section:nth-of-type(4) h2,
                .bc-page main > section:nth-of-type(5) h2,
                .bc-page main > section:nth-of-type(6) h2,
                .bc-page main > section:nth-of-type(7) h2,
                .bc-page main > section:nth-of-type(8) h2 {
                    max-width: 720px;
                    margin: 0;
                    color: #211d18;
                    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
                    font-size: clamp(1.95rem, 2.1vw, 2.85rem);
                    font-weight: 400;
                    line-height: 1.12;
                    letter-spacing: 0;
                }

                .bc-page #unidades-disponiveis span,
                .bc-page main > section:nth-of-type(4) span,
                .bc-page main > section:nth-of-type(5) span,
                .bc-page main > section:nth-of-type(6) span,
                .bc-page main > section:nth-of-type(7) span,
                .bc-page main > section:nth-of-type(8) span {
                    color: #b58a28;
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 11px;
                    font-weight: 850;
                    letter-spacing: 0.22em;
                    text-transform: uppercase;
                }

                .bc-page #unidades-disponiveis p,
                .bc-page main > section:nth-of-type(4) p,
                .bc-page main > section:nth-of-type(5) p,
                .bc-page main > section:nth-of-type(6) p,
                .bc-page main > section:nth-of-type(7) p,
                .bc-page main > section:nth-of-type(8) p {
                    margin: 16px 0 0;
                    color: #655f55;
                    font-size: 14px;
                    line-height: 1.78;
                }

                .bc-page #unidades-disponiveis > div > div:first-child > div:last-child {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    border: 1px solid rgba(184, 148, 95, 0.2);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.82);
                    color: #3d362b;
                    padding: 12px 14px;
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 11px;
                    letter-spacing: 0.13em;
                    text-transform: uppercase;
                    white-space: nowrap;
                }

                .bc-page #unidades-disponiveis > div > div:first-child > div:last-child span {
                    width: 10px;
                    height: 10px;
                    border-radius: 999px;
                    background: #22c55e;
                    display: inline-block;
                }

                .bc-page #unidades-disponiveis > div > div:last-child {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 22px;
                }

                .bc-page #unidades-disponiveis article {
                    display: flex;
                    height: 100%;
                    min-width: 0;
                    flex-direction: column;
                    overflow: hidden;
                    border: 1px solid rgba(184, 148, 95, 0.18);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.92);
                    box-shadow: 0 12px 30px rgba(31, 27, 21, 0.06);
                    transition: border-color 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease;
                }

                .bc-page #unidades-disponiveis article:hover {
                    transform: translateY(-4px);
                    border-color: rgba(212, 175, 55, 0.46);
                    box-shadow: 0 24px 58px rgba(31, 27, 21, 0.12);
                }

                .bc-page #unidades-disponiveis article > div:first-child {
                    position: relative;
                    aspect-ratio: 16 / 10;
                    overflow: hidden;
                    background: #e8dfcf;
                }

                .bc-page #unidades-disponiveis article > div:first-child img {
                    width: 100%;
                    height: 100%;
                    display: block;
                    object-fit: cover;
                    transition: transform 0.7s ease;
                }

                .bc-page #unidades-disponiveis article:hover > div:first-child img {
                    transform: scale(1.05);
                }

                .bc-page #unidades-disponiveis article > div:first-child > span {
                    position: absolute;
                    top: 12px;
                    left: 12px;
                    border-radius: 4px;
                    background: #d4af37;
                    color: #0a0d10;
                    padding: 6px 9px;
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 9px;
                    font-weight: 900;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    box-shadow: 0 10px 20px rgba(31, 27, 21, 0.18);
                }

                .bc-page #unidades-disponiveis article > div:first-child > span {
                    color: #0a0d10;
                    font-size: 9px;
                    letter-spacing: 0.12em;
                }

                .bc-page #unidades-disponiveis article > div:first-child > div {
                    position: absolute;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    padding: 42px 18px 16px;
                    background: linear-gradient(to top, rgba(10, 13, 16, 0.96), rgba(10, 13, 16, 0.55), transparent);
                }

                .bc-page #unidades-disponiveis article > div:first-child > div p:first-child {
                    margin: 0;
                    color: #a1a1aa;
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 8px;
                    letter-spacing: 0.18em;
                    text-transform: uppercase;
                }

                .bc-page #unidades-disponiveis article > div:first-child > div p:last-child {
                    margin: 3px 0 0;
                    color: #ffffff;
                    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
                    font-size: 18px;
                }

                .bc-page #unidades-disponiveis article > div:last-child {
                    display: flex;
                    flex: 1;
                    flex-direction: column;
                    padding: 18px;
                }

                .bc-page #unidades-disponiveis article > div:last-child > p {
                    margin: 0 0 8px;
                    color: #b58a28;
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 9px;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                }

                .bc-page #unidades-disponiveis article h3 {
                    margin: 0 0 16px;
                    color: #211d18;
                    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
                    font-size: 18px;
                    font-weight: 450;
                    line-height: 1.22;
                }

                .bc-page #unidades-disponiveis article > div:last-child > div:nth-of-type(1) {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 8px;
                    margin-bottom: 16px;
                    border-top: 1px solid rgba(184, 148, 95, 0.16);
                    border-bottom: 1px solid rgba(184, 148, 95, 0.16);
                    padding: 12px 0;
                }

                .bc-page #unidades-disponiveis article > div:last-child > div:nth-of-type(1) > div {
                    min-height: 62px;
                    border: 1px solid rgba(184, 148, 95, 0.14);
                    border-radius: 5px;
                    background: #faf8f2;
                    padding: 7px 5px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-direction: column;
                    text-align: center;
                    min-width: 0;
                }

                .bc-page #unidades-disponiveis article > div:last-child > div:nth-of-type(1) svg {
                    color: #d4af37;
                    margin-bottom: 5px;
                    flex: 0 0 auto;
                }

                .bc-page #unidades-disponiveis article > div:last-child > div:nth-of-type(1) span:first-of-type {
                    color: #8a8170;
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 8px;
                    letter-spacing: 0.11em;
                    text-transform: uppercase;
                }

                .bc-page #unidades-disponiveis article > div:last-child > div:nth-of-type(1) span:first-of-type {
                    color: #8a8170;
                    font-size: 8px;
                    letter-spacing: 0.11em;
                }

                .bc-page #unidades-disponiveis article > div:last-child > div:nth-of-type(1) span:last-of-type {
                    margin-top: 3px;
                    color: #211d18;
                    font-size: 10px;
                    font-weight: 850;
                }

                .bc-page #unidades-disponiveis article > div:last-child > div:nth-of-type(1) span:last-of-type {
                    color: #211d18;
                    font-size: 10px;
                    letter-spacing: 0;
                    text-transform: none;
                }

                .bc-page #unidades-disponiveis article > div:last-child > div:last-child {
                    margin-top: auto;
                    display: grid;
                    gap: 8px;
                }

                .bc-page #unidades-disponiveis article a {
                    min-height: 38px;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    text-decoration: none;
                    font-size: 9px;
                    font-weight: 950;
                    letter-spacing: 0.12em;
                    line-height: 1.2;
                    text-transform: uppercase;
                }

                .bc-page #unidades-disponiveis article a {
                    border: 1px solid rgba(184, 148, 95, 0.18);
                    color: #4f4636;
                    background: rgba(255, 255, 255, 0.74);
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo::after {
                    content: "";
                    position: absolute;
                    inset: auto 0 0;
                    z-index: 1;
                    height: 42%;
                    background: linear-gradient(to top, rgba(10, 13, 16, 0.34), rgba(10, 13, 16, 0.12) 58%, transparent);
                    pointer-events: none;
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo > span:first-of-type {
                    z-index: 5;
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo-price {
                    z-index: 2;
                    max-width: calc(100% - 24px);
                    border-radius: 6px;
                    padding: 8px 10px;
                    color: #ffffff;
                    isolation: isolate;
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo-price::before {
                    content: "";
                    position: absolute;
                    inset: 0;
                    z-index: -1;
                    border-radius: inherit;
                    background: linear-gradient(180deg, rgba(10, 13, 16, 0.48), rgba(10, 13, 16, 0.62));
                    box-shadow: 0 10px 24px rgba(10, 13, 16, 0.12);
                    backdrop-filter: blur(2px);
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo-price p {
                    position: relative;
                    z-index: 1;
                    text-shadow: 0 1px 8px rgba(0, 0, 0, 0.28);
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo-price p:first-child {
                    color: rgba(255, 255, 255, 0.66);
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo-controls {
                    position: absolute;
                    inset: 0;
                    z-index: 3;
                    padding: 0;
                    background: none;
                    pointer-events: none;
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo-nav {
                    position: absolute;
                    top: 50%;
                    z-index: 4;
                    width: 34px;
                    height: 34px;
                    min-height: 0;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid rgba(255, 255, 255, 0.42);
                    border-radius: 999px;
                    background: rgba(10, 13, 16, 0.66);
                    color: #ffffff;
                    pointer-events: auto;
                    transform: translateY(-50%);
                    transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo-nav:hover {
                    border-color: rgba(212, 175, 55, 0.72);
                    background: rgba(10, 13, 16, 0.92);
                    transform: translateY(-50%) scale(1.04);
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo-nav--prev {
                    left: 10px;
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo-nav--next {
                    right: 10px;
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo-count {
                    position: absolute;
                    right: 12px;
                    top: 12px;
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    min-height: 26px;
                    border-radius: 999px;
                    background: rgba(10, 13, 16, 0.7);
                    color: #ffffff;
                    padding: 0 9px;
                    font-size: 10px;
                    font-weight: 800;
                    letter-spacing: 0;
                    pointer-events: none;
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo-dots {
                    position: absolute;
                    left: 50%;
                    bottom: 92px;
                    display: inline-flex;
                    gap: 5px;
                    transform: translateX(-50%);
                    pointer-events: none;
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo-dot {
                    width: 5px;
                    height: 5px;
                    border-radius: 999px;
                    background: rgba(255, 255, 255, 0.48);
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo-dot.is-active {
                    width: 14px;
                    background: #d4af37;
                }

                .bc-page main > section:nth-of-type(4) {
                    background: #ffffff;
                }

                .bc-page main > section:nth-of-type(4) > div,
                .bc-page main > section:nth-of-type(7) > div,
                .bc-page main > section:nth-of-type(8) > div {
                    display: grid;
                    grid-template-columns: 4fr 8fr;
                    gap: 48px;
                    align-items: start;
                }

                .bc-page main > section:nth-of-type(4) > div > div:last-child,
                .bc-page main > section:nth-of-type(5) > div > div:last-child {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 18px;
                }

                .bc-page main > section:nth-of-type(4) > div > div:last-child > div,
                .bc-page main > section:nth-of-type(5) > div > div:last-child > div {
                    border: 1px solid rgba(184, 148, 95, 0.16);
                    border-radius: 8px;
                    background: rgba(255, 255, 255, 0.9);
                    padding: 24px;
                    box-shadow: 0 12px 30px rgba(31, 27, 21, 0.045);
                }

                .bc-page main > section:nth-of-type(4) > div > div:last-child > div > div:first-child {
                    width: 44px;
                    height: 44px;
                    display: grid;
                    place-items: center;
                    border: 1px solid rgba(184, 148, 95, 0.2);
                    border-radius: 6px;
                    background: rgba(184, 148, 95, 0.1);
                    color: #d4af37;
                    margin-bottom: 18px;
                }

                .bc-page main > section:nth-of-type(4) h3,
                .bc-page main > section:nth-of-type(5) h3 {
                    margin: 0 0 10px;
                    color: #211d18;
                    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
                    font-size: 18px;
                    font-weight: 450;
                    line-height: 1.26;
                }

                .bc-page main > section:nth-of-type(5) {
                    border-top: 1px solid rgba(184, 148, 95, 0.16);
                    border-bottom: 1px solid rgba(184, 148, 95, 0.16);
                    background: #f4efe6;
                }

                .bc-page main > section:nth-of-type(5) > div > div:first-child {
                    max-width: 720px;
                    margin-bottom: 42px;
                }

                .bc-page main > section:nth-of-type(5) > div > div:last-child > div > div:first-child {
                    margin-bottom: 24px;
                    color: #b58a28;
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 12px;
                }

                .bc-page main > section:nth-of-type(6) {
                    background: #ffffff;
                }

                .bc-page main > section:nth-of-type(6) > div > div:last-child {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 18px;
                }

                .bc-page main > section:nth-of-type(6) > div > div:last-child > div {
                    position: relative;
                    min-height: 250px;
                    overflow: hidden;
                    border: 1px solid rgba(184, 148, 95, 0.18);
                    border-radius: 8px;
                    background: #ebe3d4;
                }

                .bc-page main > section:nth-of-type(6) > div > div:last-child > div:first-child {
                    grid-column: span 2;
                    grid-row: span 2;
                    min-height: 520px;
                }

                .bc-page main > section:nth-of-type(6) img {
                    width: 100%;
                    height: 100%;
                    display: block;
                    object-fit: cover;
                    transition: transform 0.7s ease;
                }

                .bc-page main > section:nth-of-type(6) > div > div:last-child > div:hover img {
                    transform: scale(1.05);
                }

                .bc-page main > section:nth-of-type(6) > div > div:last-child > div::after {
                    content: "";
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(to top, rgba(0, 0, 0, 0.82), transparent 58%);
                }

                .bc-page main > section:nth-of-type(6) > div > div:last-child > div > div {
                    position: absolute;
                    left: 18px;
                    bottom: 16px;
                    z-index: 1;
                }

                .bc-page main > section:nth-of-type(6) h3 {
                    margin: 4px 0 0;
                    color: #ffffff;
                    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
                    font-size: 18px;
                    font-weight: 450;
                }

                .bc-page main > section:nth-of-type(6) .bc-development-media-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 18px;
                }

                .bc-page main > section:nth-of-type(6) .bc-development-media-grid > .bc-development-media-card,
                .bc-page main > section:nth-of-type(6) .bc-development-media-grid > .bc-development-media-card:first-child {
                    position: relative;
                    grid-column: auto;
                    grid-row: auto;
                    aspect-ratio: 4 / 3;
                    min-height: 0;
                    overflow: hidden;
                    border: 1px solid rgba(184, 148, 95, 0.18);
                    border-radius: 8px;
                    background: #ebe3d4;
                    box-shadow: 0 14px 34px rgba(31, 27, 21, 0.07);
                }

                .bc-page main > section:nth-of-type(6) .bc-development-media-card img,
                .bc-page main > section:nth-of-type(6) .bc-development-media-card iframe {
                    width: 100%;
                    height: 100%;
                    display: block;
                    border: 0;
                    object-fit: cover;
                }

                .bc-page main > section:nth-of-type(6) .bc-development-media-card iframe {
                    pointer-events: none;
                }

                .bc-page main > section:nth-of-type(6) .bc-development-media-card:hover img {
                    transform: scale(1.05);
                }

                .bc-page main > section:nth-of-type(6) .bc-development-media-card--embed iframe {
                    filter: grayscale(0.15) contrast(0.95);
                }

                .bc-page main > section:nth-of-type(6) .bc-development-media-frame-label {
                    position: absolute;
                    left: 16px;
                    right: 16px;
                    bottom: 14px;
                    z-index: 2;
                    display: grid;
                    gap: 2px;
                    color: #ffffff;
                }

                .bc-page main > section:nth-of-type(6) .bc-development-media-frame-label svg {
                    color: #d4af37;
                    margin-bottom: 4px;
                }

                .bc-page main > section:nth-of-type(6) .bc-development-media-frame-label span {
                    color: #d4af37;
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 9px;
                    font-weight: 850;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                }

                .bc-page main > section:nth-of-type(6) .bc-development-media-frame-label strong {
                    color: #ffffff;
                    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
                    font-size: 18px;
                    font-weight: 450;
                    line-height: 1.15;
                }

                .bc-page main > section:nth-of-type(6) .bc-development-media-frame-hit {
                    position: absolute;
                    inset: 0;
                    z-index: 3;
                    display: flex;
                    align-items: flex-end;
                    justify-content: flex-end;
                    border: 0;
                    background: linear-gradient(180deg, transparent 42%, rgba(0, 0, 0, 0.62));
                    padding: 16px;
                    color: #ffffff;
                    cursor: pointer;
                    text-align: left;
                }

                .bc-page main > section:nth-of-type(6) .bc-development-media-frame-hit span {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    min-height: 34px;
                    border-radius: 999px;
                    background: rgba(31, 27, 21, 0.78);
                    padding: 0 13px;
                    color: #ffffff;
                    font-size: 11px;
                    font-weight: 900;
                    letter-spacing: 0.02em;
                    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
                    backdrop-filter: blur(8px);
                }

                .bc-page main > section:nth-of-type(6) .bc-development-media-frame-hit span svg {
                    color: #d4af37;
                }

                .bc-page main > section:nth-of-type(7) {
                    border-top: 1px solid rgba(184, 148, 95, 0.16);
                    border-bottom: 1px solid rgba(184, 148, 95, 0.16);
                    background: #f4efe6;
                }

                .bc-page main > section:nth-of-type(7) a {
                    margin-top: 30px;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    border: 1px solid rgba(212, 175, 55, 0.6);
                    border-radius: 4px;
                    color: #d4af37;
                    padding: 12px 18px;
                    text-decoration: none;
                    font-size: 11px;
                    font-weight: 950;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                }

                .bc-page main > section:nth-of-type(7) > div > div:last-child {
                    overflow: hidden;
                    border: 1px solid rgba(184, 148, 95, 0.18);
                    border-radius: 8px;
                    background: #ffffff;
                }

                .bc-page main > section:nth-of-type(7) iframe {
                    width: 100%;
                    height: 430px;
                    display: block;
                    border: 0;
                    filter: grayscale(1) contrast(0.9);
                }

                .bc-page .bc-location-address-card {
                    min-height: 300px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    gap: 12px;
                    border: 1px solid rgba(184, 148, 95, 0.18);
                    border-radius: 8px;
                    background:
                        linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(245, 239, 230, 0.72)),
                        radial-gradient(circle at top right, rgba(212, 175, 55, 0.18), transparent 34%);
                    padding: clamp(24px, 4vw, 44px);
                    box-shadow: 0 18px 44px rgba(31, 27, 21, 0.08);
                }

                .bc-page .bc-location-address-card span {
                    color: #b58a28;
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 10px;
                    font-weight: 850;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                }

                .bc-page .bc-location-address-card h3 {
                    margin: 0;
                    color: #211d18;
                    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
                    font-size: clamp(1.55rem, 2.2vw, 2.3rem);
                    font-weight: 420;
                    line-height: 1.1;
                }

                .bc-page .bc-location-address-card p {
                    max-width: 620px;
                    margin: 0;
                    color: #655f55;
                    font-size: 14px;
                    line-height: 1.65;
                }

                .bc-page .bc-location-address-card button {
                    width: fit-content;
                    margin-top: 6px;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    border: 1px solid rgba(212, 175, 55, 0.55);
                    border-radius: 999px;
                    background: #d4af37;
                    color: #11100d;
                    padding: 12px 18px;
                    font-size: 11px;
                    font-weight: 950;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    cursor: pointer;
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }

                .bc-page .bc-location-address-card button:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 14px 28px rgba(212, 175, 55, 0.22);
                }

                .bc-page main > section:nth-of-type(8) {
                    background: #ffffff;
                }

                .bc-page main > section:nth-of-type(8) button {
                    width: 100%;
                    display: block;
                    border: 0;
                    border-bottom: 1px solid rgba(184, 148, 95, 0.18);
                    background: transparent;
                    color: inherit;
                    padding: 24px 0;
                    text-align: left;
                }

                .bc-page main > section:nth-of-type(8) button > div:first-child {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 18px;
                }

                .bc-page main > section:nth-of-type(8) h3 {
                    margin: 0;
                    color: #211d18;
                    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
                    font-size: 17px;
                    font-weight: 450;
                    line-height: 1.35;
                }

                .bc-page .bc-related-developments-section {
                    border-top: 1px solid rgba(184, 148, 95, 0.16);
                    background: #f7f5f0;
                    padding: 76px 0 82px;
                }

                .bc-page .bc-related-developments-inner {
                    width: min(1320px, calc(100% - 32px));
                    margin: 0 auto;
                }

                .bc-page .bc-related-developments-header {
                    display: grid;
                    grid-template-columns: minmax(0, 1.15fr) minmax(260px, 0.85fr);
                    gap: 28px;
                    align-items: end;
                    margin-bottom: 24px;
                }

                .bc-page .bc-related-developments-header span {
                    color: #b58a28;
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 11px;
                    font-weight: 850;
                    letter-spacing: 0.22em;
                    text-transform: uppercase;
                }

                .bc-page .bc-related-developments-header h2 {
                    max-width: 780px;
                    margin: 10px 0 0;
                    color: #211d18;
                    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
                    font-size: clamp(1.9rem, 2.2vw, 2.85rem);
                    font-weight: 400;
                    line-height: 1.1;
                    letter-spacing: 0;
                }

                .bc-page .bc-related-developments-header p {
                    margin: 0;
                    color: #655f55;
                    font-size: 14px;
                    font-weight: 500;
                    line-height: 1.62;
                }

                .bc-page .bc-related-developments-grid {
                    display: flex;
                    gap: 16px;
                    overflow-x: auto;
                    padding: 2px 2px 16px;
                    scroll-snap-type: x mandatory;
                    scrollbar-width: none;
                    -webkit-overflow-scrolling: touch;
                }

                .bc-page .bc-related-developments-grid::-webkit-scrollbar {
                    display: none;
                }

                .bc-page .bc-related-development-card {
                    position: relative;
                    flex: 0 0 min(320px, 78vw);
                    min-height: 210px;
                    overflow: hidden;
                    border: 1px solid rgba(184, 148, 95, 0.18);
                    border-radius: 8px;
                    background: #1f1a14;
                    color: #fff;
                    text-decoration: none;
                    scroll-snap-align: start;
                    box-shadow: 0 16px 36px rgba(31, 27, 21, 0.08);
                    transition: transform 0.24s ease, border-color 0.24s ease, box-shadow 0.24s ease;
                }

                .bc-page .bc-related-development-card:hover {
                    transform: translateY(-3px);
                    border-color: rgba(184, 148, 95, 0.45);
                    box-shadow: 0 24px 54px rgba(31, 27, 21, 0.14);
                }

                .bc-page .bc-related-development-card img {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 0.7s ease;
                }

                .bc-page .bc-related-development-card:hover img {
                    transform: scale(1.05);
                }

                .bc-page .bc-related-development-shade {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(180deg, rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.75));
                }

                .bc-page .bc-related-development-copy {
                    position: absolute;
                    inset: auto 16px 16px;
                    z-index: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .bc-page .bc-related-development-copy small,
                .bc-page .bc-related-development-copy em {
                    color: #e9d28a;
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 10px;
                    font-style: normal;
                    font-weight: 900;
                    letter-spacing: 0.12em;
                    line-height: 1.35;
                    text-transform: uppercase;
                }

                .bc-page .bc-related-development-copy strong {
                    color: #fff;
                    font-size: 23px;
                    font-weight: 500;
                    line-height: 1.04;
                }

                .bc-page .google-reviews-section {
                    border-top: 1px solid rgba(184, 148, 95, 0.16);
                }

                .bc-page .home-blog-section {
                    border-top: 1px solid rgba(184, 148, 95, 0.16);
                }

                .bc-page .bc-floating-actions {
                    position: fixed;
                    right: 28px;
                    bottom: 22px;
                    z-index: 60;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }

                .bc-page .bc-floating-consult {
                    border: 0;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    text-transform: uppercase;
                    box-shadow: 0 18px 38px rgba(212, 175, 55, 0.24);
                }

                .bc-page .bc-floating-consult {
                    min-height: 54px;
                    gap: 10px;
                    border-radius: 999px;
                    background: #d4af37;
                    color: #07130c;
                    padding: 15px 22px;
                    font-size: 13px;
                    font-weight: 950;
                    letter-spacing: 0.11em;
                }

                body.bc-location-modal-open {
                    overflow: hidden;
                }

                .bc-location-modal {
                    position: fixed;
                    inset: 0;
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(17, 13, 8, 0.72);
                    padding: 24px;
                    backdrop-filter: blur(8px);
                }

                .bc-location-modal-close {
                    position: fixed;
                    top: 18px;
                    right: 18px;
                    z-index: 2;
                    width: 44px;
                    height: 44px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid rgba(255, 255, 255, 0.32);
                    border-radius: 999px;
                    background: rgba(17, 13, 8, 0.72);
                    color: #ffffff;
                    cursor: pointer;
                    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28);
                }

                .bc-location-modal-body {
                    width: min(1120px, 100%);
                    height: min(76vh, 780px);
                    overflow: hidden;
                    border: 1px solid rgba(255, 255, 255, 0.24);
                    border-radius: 12px;
                    background: #f5f1e8;
                    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.38);
                }

                .bc-location-modal-body iframe {
                    width: 100%;
                    height: 100%;
                    display: block;
                    border: 0;
                }

                @media (max-width: 1024px) {
                    .bc-page .bc-hero-metrics {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        grid-auto-rows: minmax(82px, auto);
                    }

                    .bc-page .bc-hero-metrics::before {
                        top: 14px;
                        bottom: 14px;
                        left: 50%;
                        display: block;
                        width: 1px;
                        transform: translateX(-0.5px);
                    }

                    .bc-page .bc-hero-metrics::after {
                        top: 50%;
                        right: 14px;
                        left: 14px;
                        display: block;
                        height: 1px;
                        transform: translateY(-0.5px);
                    }

                    .bc-page .bc-hero-metric {
                        border-right: 0;
                        border-bottom: 0;
                        min-height: 82px;
                        align-items: flex-start;
                    }

                    .bc-page #unidades-disponiveis > div > div:last-child,
                    .bc-page main > section:nth-of-type(4) > div > div:last-child,
                    .bc-page main > section:nth-of-type(5) > div > div:last-child {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }

                    .bc-page main > section:nth-of-type(4) > div,
                    .bc-page main > section:nth-of-type(7) > div,
                    .bc-page main > section:nth-of-type(8) > div {
                        grid-template-columns: 1fr;
                    }

                    .bc-page .bc-related-developments-header {
                        grid-template-columns: 1fr;
                        align-items: start;
                    }

                    .bc-page .bc-related-developments-grid {
                        margin-right: -32px;
                        padding-right: 32px;
                    }
                }

                @media (max-width: 720px) {
                    .bc-page {
                        padding-bottom: 88px;
                    }

                    .bc-page main > section:nth-of-type(1) {
                        min-height: auto;
                    }

                    .bc-page main > section:nth-of-type(1) > div:last-child {
                        width: min(100% - 32px, 1320px);
                        min-height: 690px;
                        padding: 42px 0 36px;
                        gap: 30px;
                    }

                    .bc-page main > section:nth-of-type(1) h1 {
                        font-size: clamp(1.72rem, 6.8vw, 1.92rem);
                        line-height: 1.08;
                    }

                    .bc-page main > section:nth-of-type(1) h1 + p {
                        width: min(100%, 330px);
                        margin-bottom: 24px;
                        border-left: 2px solid rgba(184, 148, 95, 0.5);
                        border-radius: 6px;
                        background: linear-gradient(90deg, rgba(255, 255, 255, 0.76), rgba(255, 255, 255, 0.36));
                        padding: 9px 11px 9px 12px;
                        color: #2c251c;
                        font-size: 0.91rem;
                        font-weight: 850;
                        line-height: 1.55;
                        text-shadow: 0 1px 0 rgba(255, 255, 255, 0.55);
                        backdrop-filter: blur(3px);
                    }

                    .bc-page main > section:nth-of-type(1) > div:last-child > div:first-child > div:last-child {
                        flex-direction: column;
                    }

                    .bc-page main > section:nth-of-type(1) > div:last-child > div:first-child button {
                        width: 100%;
                    }

                    .bc-page .bc-hero-metrics {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        grid-auto-rows: minmax(78px, auto);
                        padding: 10px;
                    }

                    .bc-page .bc-hero-metric {
                        gap: 8px;
                        min-height: 78px;
                        padding: 12px 10px;
                        border-right: 0;
                        border-bottom: 0;
                    }

                    .bc-page .bc-hero-metric:last-child {
                        border-bottom: 0;
                    }

                    .bc-page .bc-hero-metric-icon {
                        width: 34px;
                        height: 34px;
                    }

                    .bc-page .bc-hero-metric p {
                        font-size: 8px;
                        letter-spacing: 0.15em;
                    }

                    .bc-page .bc-hero-metric h3 {
                        font-size: 12px;
                        font-weight: 500;
                    }

                    .bc-page .bc-hero-metric span {
                        font-size: 9px;
                    }

                    .bc-page main > section:nth-of-type(2) > div {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }

                    .bc-page #unidades-disponiveis,
                    .bc-page main > section:nth-of-type(4),
                    .bc-page main > section:nth-of-type(5),
                    .bc-page main > section:nth-of-type(6),
                    .bc-page main > section:nth-of-type(7),
                    .bc-page main > section:nth-of-type(8) {
                        padding: 68px 0;
                    }

                    .bc-page #unidades-disponiveis {
                        scroll-margin-top: 172px;
                        padding-bottom: 112px;
                    }

                    .bc-page #unidades-disponiveis h2,
                    .bc-page main > section:nth-of-type(4) h2,
                    .bc-page main > section:nth-of-type(5) h2,
                    .bc-page main > section:nth-of-type(6) h2,
                    .bc-page main > section:nth-of-type(7) h2,
                    .bc-page main > section:nth-of-type(8) h2 {
                        font-size: clamp(1.75rem, 7.3vw, 2.05rem);
                        line-height: 1.12;
                    }

                    .bc-page #unidades-disponiveis > div,
                    .bc-page main > section:nth-of-type(4) > div,
                    .bc-page main > section:nth-of-type(5) > div,
                    .bc-page main > section:nth-of-type(6) > div,
                    .bc-page main > section:nth-of-type(7) > div,
                    .bc-page main > section:nth-of-type(8) > div {
                        width: min(100% - 28px, 1320px);
                    }

                    .bc-page #unidades-disponiveis > div > div:first-child,
                    .bc-page main > section:nth-of-type(6) > div > div:first-child {
                        flex-direction: column;
                        align-items: flex-start;
                    }

                    .bc-page main > section:nth-of-type(4) > div > div:last-child,
                    .bc-page main > section:nth-of-type(5) > div > div:last-child,
                    .bc-page main > section:nth-of-type(6) > div > div:last-child {
                        grid-template-columns: 1fr;
                    }

                    .bc-page #unidades-disponiveis > div > div:last-child {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 12px;
                    }

                    .bc-page #unidades-disponiveis article {
                        border-radius: 7px;
                        box-shadow: 0 10px 22px rgba(31, 27, 21, 0.06);
                    }

                    .bc-page #unidades-disponiveis article:hover {
                        transform: none;
                    }

                    .bc-page #unidades-disponiveis article > div:first-child {
                        aspect-ratio: 1 / 0.92;
                    }

                    .bc-page #unidades-disponiveis article > div:first-child > span {
                        top: 8px;
                        left: 8px;
                        max-width: calc(100% - 16px);
                        padding: 5px 6px;
                        font-size: 7px;
                        letter-spacing: 0.08em;
                    }

                    .bc-page #unidades-disponiveis article .bc-unit-photo-price {
                        bottom: 8px;
                        left: 8px;
                        max-width: calc(100% - 16px);
                        padding: 6px 7px;
                    }

                    .bc-page #unidades-disponiveis article .bc-unit-photo-price p:first-child {
                        font-size: 7px;
                        letter-spacing: 0.12em;
                    }

                    .bc-page #unidades-disponiveis article .bc-unit-photo-price p:last-child {
                        font-size: 14px;
                        line-height: 1.12;
                    }

                    .bc-page #unidades-disponiveis article > div:last-child {
                        padding: 10px;
                    }

                    .bc-page #unidades-disponiveis article > div:last-child > p {
                        display: none;
                    }

                    .bc-page #unidades-disponiveis article h3 {
                        margin-bottom: 10px;
                        font-size: 15px;
                        line-height: 1.12;
                    }

                    .bc-page #unidades-disponiveis article > div:last-child > div:nth-of-type(1) {
                        gap: 5px;
                        margin-bottom: 10px;
                        padding: 8px 0;
                    }

                    .bc-page #unidades-disponiveis article > div:last-child > div:nth-of-type(1) > div {
                        min-height: 58px;
                        padding: 5px 3px;
                    }

                    .bc-page #unidades-disponiveis article > div:last-child > div:nth-of-type(1) svg {
                        width: 13px;
                        height: 13px;
                        margin-bottom: 5px;
                    }

                    .bc-page #unidades-disponiveis article > div:last-child > div:nth-of-type(1) span:first-of-type {
                        font-size: 7px;
                        letter-spacing: 0.08em;
                    }

                    .bc-page #unidades-disponiveis article > div:last-child > div:nth-of-type(1) span:last-of-type {
                        font-size: 10px;
                        line-height: 1.12;
                    }

                    .bc-page #unidades-disponiveis article a {
                        min-height: 36px;
                        padding: 0 8px;
                        font-size: 8px;
                        letter-spacing: 0.08em;
                        line-height: 1.15;
                    }

                    .bc-page #unidades-disponiveis article .bc-unit-photo-nav {
                        width: 28px;
                        height: 28px;
                    }

                    .bc-page #unidades-disponiveis article .bc-unit-photo-nav--prev {
                        left: 6px;
                    }

                    .bc-page #unidades-disponiveis article .bc-unit-photo-nav--next {
                        right: 6px;
                    }

                    .bc-page #unidades-disponiveis article .bc-unit-photo-count {
                        right: 8px;
                        top: 8px;
                        min-height: 22px;
                        padding: 0 7px;
                        font-size: 8px;
                    }

                    .bc-page #unidades-disponiveis article .bc-unit-photo-dots {
                        bottom: 74px;
                    }

                    .bc-page .bc-related-developments-section {
                        padding: 54px 0 58px;
                    }

                    .bc-page .bc-related-developments-inner {
                        width: min(100% - 28px, 1320px);
                    }

                    .bc-page .bc-related-developments-header {
                        gap: 14px;
                        margin-bottom: 18px;
                    }

                    .bc-page .bc-related-developments-header h2 {
                        font-size: clamp(1.7rem, 7vw, 2rem);
                    }

                    .bc-page .bc-related-development-card {
                        flex-basis: min(236px, 72vw);
                        min-height: 165px;
                    }

                    .bc-page .bc-related-development-copy {
                        inset: auto 11px 11px;
                    }

                    .bc-page .bc-related-development-copy small,
                    .bc-page .bc-related-development-copy em {
                        font-size: 8px;
                        letter-spacing: 0.08em;
                    }

                    .bc-page .bc-related-development-copy strong {
                        font-size: 17px;
                    }

                    .bc-page main > section:nth-of-type(6) > div > div:last-child > div:first-child {
                        grid-column: auto;
                        min-height: 280px;
                    }

                    .bc-page main > section:nth-of-type(6) > div > div:last-child > div {
                        min-height: 240px;
                    }

                    .bc-page main > section:nth-of-type(6) .bc-development-media-grid,
                    .bc-page main > section:nth-of-type(6) > div > .bc-development-media-grid,
                    .bc-page main > section:nth-of-type(6) > div > div:last-child.bc-development-media-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 10px;
                    }

                    .bc-page main > section:nth-of-type(6) .bc-development-media-grid > .bc-development-media-card,
                    .bc-page main > section:nth-of-type(6) .bc-development-media-grid > .bc-development-media-card:first-child,
                    .bc-page main > section:nth-of-type(6) > div > .bc-development-media-grid > .bc-development-media-card {
                        grid-column: auto;
                        grid-row: auto;
                        aspect-ratio: 1 / 0.86;
                        min-height: 0;
                        border-radius: 7px;
                    }

                    .bc-page main > section:nth-of-type(6) .bc-development-media-card--embed {
                        min-height: 158px;
                    }

                    .bc-page main > section:nth-of-type(6) .bc-development-media-frame-label {
                        left: 10px;
                        right: 10px;
                        bottom: 42px;
                    }

                    .bc-page main > section:nth-of-type(6) .bc-development-media-frame-label svg {
                        width: 13px;
                        height: 13px;
                        margin-bottom: 2px;
                    }

                    .bc-page main > section:nth-of-type(6) .bc-development-media-frame-label span {
                        font-size: 7px;
                        letter-spacing: 0.12em;
                    }

                    .bc-page main > section:nth-of-type(6) .bc-development-media-frame-label strong {
                        font-size: 14px;
                    }

                    .bc-page main > section:nth-of-type(6) .bc-development-media-frame-hit {
                        padding: 9px;
                    }

                    .bc-page main > section:nth-of-type(6) .bc-development-media-frame-hit span {
                        min-height: 28px;
                        padding: 0 9px;
                        font-size: 9px;
                        gap: 5px;
                    }

                    .bc-page main > section:nth-of-type(6) .bc-development-media-frame-hit span svg {
                        width: 12px;
                        height: 12px;
                    }

                    .bc-page .bc-location-address-card {
                        min-height: 220px;
                    }

                    .bc-location-modal {
                        padding: 0;
                    }

                    .bc-location-modal-close {
                        top: 12px;
                        right: 12px;
                    }

                    .bc-location-modal-body {
                        width: 100vw;
                        height: 100dvh;
                        border: 0;
                        border-radius: 0;
                    }

                    .bc-page main > section:nth-of-type(7) iframe {
                        height: 340px;
                    }

                    .bc-page .bc-floating-actions {
                        right: auto;
                        left: 50%;
                        bottom: 16px;
                        transform: translateX(-50%);
                    }

                    .bc-page .bc-floating-consult {
                        min-height: 50px;
                        padding: 0 22px;
                        font-size: 10px;
                        letter-spacing: 0.1em;
                    }

                }

                .bc-page .bc-hero-cta--mobile {
                    display: none;
                }

                .bc-page .bc-hero-cta button {
                    display: inline-grid;
                    grid-template-columns: minmax(0, max-content) 18px;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    min-height: 43px;
                    border-radius: 4px;
                    padding: 13px 24px;
                    border: 0;
                    background: #d4af37;
                    color: #0a0d10;
                    font-size: 10px;
                    font-weight: 950;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                    box-shadow: 0 18px 38px rgba(184, 148, 95, 0.18);
                    transition: transform 0.2s ease, background 0.2s ease;
                }

                .bc-page .bc-hero-units-label {
                    display: block;
                    line-height: 1;
                }

                .bc-page .bc-hero-units-button svg {
                    width: 18px;
                    height: 18px;
                    display: block;
                    align-self: center;
                    justify-self: center;
                }

                .bc-page .bc-hero-cta button:hover {
                    transform: translateY(-1px);
                }

                .bc-page .bc-development-gallery-section {
                    border-top: 1px solid rgba(184, 148, 95, 0.16);
                    border-bottom: 1px solid rgba(184, 148, 95, 0.16);
                    background: #ffffff !important;
                }

                .bc-page .bc-development-gallery-section > div {
                    display: block !important;
                    width: min(1320px, calc(100% - 32px));
                    margin: 0 auto;
                }

                .bc-page .bc-development-gallery-section > div > div:first-child {
                    margin-bottom: 42px;
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    gap: 28px;
                }

                .bc-page .bc-development-gallery-section h2,
                .bc-page .bc-compare-section h2,
                .bc-page .bc-differentials-section h2 {
                    max-width: 720px;
                    margin: 0;
                    color: #211d18 !important;
                    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
                    font-size: clamp(1.95rem, 2.1vw, 2.85rem);
                    font-weight: 400;
                    line-height: 1.12;
                    letter-spacing: 0;
                }

                .bc-page .bc-development-gallery-section span,
                .bc-page .bc-compare-section span,
                .bc-page .bc-differentials-section span {
                    color: #b58a28;
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 11px;
                    font-weight: 850;
                    letter-spacing: 0.22em;
                    text-transform: uppercase;
                }

                .bc-page .bc-development-gallery-section p,
                .bc-page .bc-compare-section p,
                .bc-page .bc-differentials-section p {
                    color: #655f55 !important;
                }

                .bc-page .bc-development-gallery-section .bc-development-media-grid {
                    display: grid !important;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 18px;
                }

                .bc-page .bc-development-gallery-section .bc-development-media-card {
                    position: relative !important;
                    min-height: 0 !important;
                    aspect-ratio: 4 / 3;
                    overflow: hidden !important;
                    border: 1px solid rgba(184, 148, 95, 0.18) !important;
                    border-radius: 8px !important;
                    background: #ebe3d4 !important;
                    padding: 0 !important;
                    box-shadow: 0 14px 34px rgba(31, 27, 21, 0.07);
                }

                .bc-page .bc-development-gallery-section .bc-development-media-card::after,
                .bc-page .bc-development-gallery-section .bc-development-media-shade {
                    display: none !important;
                    content: none !important;
                }

                .bc-page .bc-development-gallery-section .bc-development-media-card img,
                .bc-page .bc-development-gallery-section .bc-development-media-card iframe,
                .bc-page .bc-development-gallery-section .bc-development-location-map {
                    width: 100%;
                    height: 100%;
                    display: block;
                    border: 0;
                    object-fit: cover;
                }

                .bc-page .bc-development-gallery-section .bc-development-media-card iframe {
                    pointer-events: none;
                }

                .bc-page .bc-development-gallery-section .bc-development-media-card:hover img {
                    transform: scale(1.035);
                }

                .bc-page .bc-development-media-copy,
                .bc-page .bc-development-media-frame-label {
                    position: absolute;
                    left: 12px;
                    right: 12px;
                    bottom: 12px;
                    z-index: 2;
                    width: fit-content;
                    max-width: calc(100% - 24px);
                    display: grid;
                    gap: 2px;
                    border: 1px solid rgba(184, 148, 95, 0.22);
                    border-radius: 7px;
                    background: rgba(255, 255, 255, 0.86);
                    padding: 8px 10px;
                    box-shadow: 0 10px 24px rgba(31, 27, 21, 0.12);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                }

                .bc-page .bc-development-media-copy p,
                .bc-page .bc-development-media-frame-label span {
                    margin: 0;
                    color: #b58a28 !important;
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 8px;
                    font-weight: 850;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                }

                .bc-page .bc-development-media-copy h3,
                .bc-page .bc-development-media-frame-label strong {
                    margin: 0;
                    color: #211d18 !important;
                    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
                    font-size: 16px;
                    font-weight: 500;
                    line-height: 1.12;
                }

                .bc-page .bc-development-media-frame-label svg {
                    display: none;
                }

                .bc-page .bc-development-media-frame-hit {
                    position: absolute;
                    inset: 0;
                    z-index: 3;
                    display: flex;
                    align-items: flex-start;
                    justify-content: flex-end;
                    border: 0;
                    background: transparent !important;
                    padding: 12px;
                    color: #ffffff;
                    cursor: pointer;
                    text-align: left;
                }

                .bc-page .bc-development-media-frame-hit span {
                    display: inline-flex;
                    align-items: center;
                    gap: 7px;
                    min-height: 32px;
                    border-radius: 999px;
                    background: rgba(31, 27, 21, 0.74);
                    padding: 0 12px;
                    color: #ffffff;
                    font-size: 11px;
                    font-weight: 900;
                    letter-spacing: 0.02em;
                    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
                    backdrop-filter: blur(8px);
                }

                .bc-page .bc-development-media-frame-hit span svg {
                    color: #d4af37;
                }

                .bc-page .bc-development-showcase {
                    color: #211d18;
                }

                .bc-page .bc-development-showcase-toolbar {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-bottom: 12px;
                }

                .bc-page .bc-development-showcase-pill {
                    min-height: 36px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    border: 1px solid rgba(36, 31, 24, 0.14);
                    border-radius: 999px;
                    background: #ffffff;
                    padding: 0 14px;
                    color: #211d18;
                    font-size: 12px;
                    font-weight: 850;
                    letter-spacing: 0;
                    line-height: 1;
                    box-shadow: 0 8px 18px rgba(31, 27, 21, 0.04);
                }

                .bc-page .bc-development-showcase-pill svg {
                    color: #b58a28;
                }

                .bc-page .bc-development-showcase-pill strong {
                    min-width: 22px;
                    height: 20px;
                    display: inline-grid;
                    place-items: center;
                    border-radius: 999px;
                    background: #9b7427;
                    color: #ffffff;
                    font-size: 11px;
                    font-weight: 900;
                }

                .bc-page .bc-development-showcase-stage {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) 162px;
                    gap: 12px;
                    align-items: stretch;
                }

                .bc-page .bc-development-showcase-main {
                    position: relative;
                    min-height: clamp(430px, 44vw, 570px);
                    overflow: hidden;
                    border: 1px solid rgba(36, 31, 24, 0.1);
                    border-radius: 8px;
                    background: #efe8db;
                    box-shadow: 0 18px 46px rgba(31, 27, 21, 0.08);
                    touch-action: pan-y;
                }

                .bc-page .bc-development-showcase-main > img,
                .bc-page .bc-development-showcase-main > iframe,
                .bc-page .bc-development-showcase-thumb > img,
                .bc-page .bc-development-showcase-thumb > iframe {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    display: block;
                    border: 0;
                    object-fit: cover;
                }

                .bc-page .bc-development-showcase-main > iframe,
                .bc-page .bc-development-showcase-thumb > iframe {
                    background: #d8eef5;
                }

                .bc-page .bc-development-showcase-thumb > iframe {
                    pointer-events: none;
                }

                .bc-page .bc-development-location-thumb {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    display: grid;
                    place-items: center;
                    align-content: center;
                    gap: 5px;
                    background:
                        linear-gradient(135deg, rgba(33, 29, 24, 0.92), rgba(33, 29, 24, 0.68)),
                        radial-gradient(circle at 78% 22%, rgba(212, 175, 55, 0.24), transparent 32%);
                    color: #ffffff;
                    text-align: center;
                }

                .bc-page .bc-development-location-thumb svg {
                    color: #d4af37;
                }

                .bc-page .bc-development-location-thumb strong {
                    color: #ffffff;
                    font-size: 11px;
                    font-weight: 900;
                    line-height: 1;
                }

                .bc-page .bc-development-location-thumb span {
                    color: rgba(255, 255, 255, 0.68) !important;
                    font-family: Arial, Helvetica, sans-serif !important;
                    font-size: 9px !important;
                    font-weight: 700 !important;
                    letter-spacing: 0 !important;
                    line-height: 1 !important;
                    text-transform: none !important;
                }

                .bc-page .bc-development-location-static-thumb {
                    position: absolute;
                    inset: 0;
                    display: block;
                    width: 100%;
                    height: 100%;
                    background: #d8eef5;
                }

                .bc-page .bc-development-location-static-thumb img {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    display: block;
                    object-fit: cover;
                }

                .bc-page .bc-development-location-static-thumb::after {
                    content: "";
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(to top, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.03) 62%);
                    pointer-events: none;
                }

                .bc-page .bc-development-showcase-nav {
                    position: absolute;
                    top: 50%;
                    z-index: 4;
                    width: 52px;
                    height: 52px;
                    display: grid;
                    place-items: center;
                    border: 0;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.94);
                    color: #211d18;
                    box-shadow: 0 12px 28px rgba(31, 27, 21, 0.14);
                    transform: translateY(-50%);
                }

                .bc-page .bc-development-showcase-nav--prev {
                    left: 18px;
                }

                .bc-page .bc-development-showcase-nav--next {
                    right: 18px;
                }

                .bc-page .bc-development-showcase-open {
                    position: absolute;
                    left: 18px;
                    top: 18px;
                    z-index: 5;
                    min-height: 36px;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    border: 0;
                    border-radius: 999px;
                    background: rgba(31, 31, 31, 0.84);
                    padding: 0 14px;
                    color: #ffffff;
                    font-size: 12px;
                    font-weight: 900;
                    letter-spacing: 0;
                    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                }

                .bc-page .bc-development-showcase-open svg {
                    color: #d4af37;
                }

                .bc-page .bc-development-showcase-rail {
                    max-height: clamp(430px, 44vw, 570px);
                    display: grid;
                    gap: 10px;
                    overflow-y: auto;
                    padding-right: 4px;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(181, 138, 40, 0.55) rgba(239, 232, 219, 0.8);
                    -webkit-overflow-scrolling: touch;
                }

                .bc-page .bc-development-showcase-thumb {
                    position: relative;
                    width: 100%;
                    min-height: 0;
                    aspect-ratio: 4 / 3;
                    overflow: hidden;
                    border: 2px solid transparent;
                    border-radius: 8px;
                    background: #efe8db;
                    padding: 0;
                    box-shadow: 0 10px 22px rgba(31, 27, 21, 0.08);
                }

                .bc-page .bc-development-showcase-thumb.is-active {
                    border-color: #d4af37;
                }

                .bc-page .bc-development-showcase-thumb-label {
                    position: absolute;
                    left: 8px;
                    bottom: 8px;
                    z-index: 3;
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    max-width: calc(100% - 16px);
                    min-height: 28px;
                    border-radius: 999px;
                    background: rgba(31, 31, 31, 0.82);
                    padding: 0 9px;
                    color: #ffffff !important;
                    font-family: Arial, Helvetica, sans-serif !important;
                    font-size: 11px !important;
                    font-weight: 900 !important;
                    letter-spacing: 0 !important;
                    line-height: 1 !important;
                    text-transform: none !important;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .bc-page .bc-development-showcase-thumb-label svg {
                    flex: 0 0 auto;
                    color: #ffffff;
                }

                .bc-page .bc-development-gallery-section .bc-development-showcase {
                    width: 100% !important;
                    height: auto !important;
                    display: block !important;
                    grid-template-columns: none !important;
                    gap: 0 !important;
                }

                .bc-page .bc-development-gallery-section .bc-development-showcase > .bc-development-showcase-toolbar,
                .bc-page .bc-development-gallery-section .bc-development-showcase > .bc-development-showcase-stage {
                    position: static !important;
                    grid-column: auto !important;
                    grid-row: auto !important;
                    width: 100% !important;
                    min-height: 0 !important;
                    height: auto !important;
                    overflow: visible !important;
                    border: 0 !important;
                    border-radius: 0 !important;
                    background: transparent !important;
                    padding: 0 !important;
                    box-shadow: none !important;
                }

                .bc-page .bc-development-gallery-section .bc-development-showcase > .bc-development-showcase-toolbar {
                    display: flex !important;
                    margin-bottom: 12px !important;
                }

                .bc-page .bc-development-gallery-section .bc-development-showcase > .bc-development-showcase-stage {
                    display: grid !important;
                    grid-template-columns: minmax(0, 1fr) 162px !important;
                    gap: 12px !important;
                    align-items: stretch !important;
                }

                .bc-page .bc-development-gallery-section .bc-development-showcase > .bc-development-showcase-toolbar::after,
                .bc-page .bc-development-gallery-section .bc-development-showcase > .bc-development-showcase-stage::after {
                    display: none !important;
                    content: none !important;
                }

                .bc-page .bc-development-gallery-section .bc-development-showcase-stage > .bc-development-showcase-main,
                .bc-page .bc-development-gallery-section .bc-development-showcase-stage > .bc-development-showcase-rail {
                    grid-column: auto !important;
                    grid-row: auto !important;
                    min-height: 0 !important;
                    overflow: visible;
                    border-radius: 0;
                    padding: 0 !important;
                    transform: none !important;
                }

                .bc-page .bc-development-gallery-section .bc-development-showcase-stage > .bc-development-showcase-main {
                    position: relative !important;
                    width: auto !important;
                    height: auto !important;
                    min-height: clamp(430px, 44vw, 570px) !important;
                    display: block !important;
                    overflow: hidden !important;
                    border: 1px solid rgba(36, 31, 24, 0.1) !important;
                    border-radius: 8px !important;
                    background: #efe8db !important;
                }

                .bc-page .bc-development-gallery-section .bc-development-showcase-stage > .bc-development-showcase-rail {
                    position: static !important;
                    width: 162px !important;
                    height: auto !important;
                    max-height: clamp(430px, 44vw, 570px) !important;
                    display: grid !important;
                    overflow-y: auto !important;
                    border: 0 !important;
                    background: transparent !important;
                }

                .bc-page .bc-development-gallery-section .bc-development-showcase-pill {
                    height: auto !important;
                    min-height: 36px !important;
                    padding: 0 14px !important;
                }

                .bc-mobile-landing-header {
                    display: none;
                }

                .bc-page .bc-development-location-map,
                .bc-location-modal .bc-development-location-map {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                }

                .bc-page .bc-development-location-map .plp-location-explorer,
                .bc-location-modal .bc-development-location-map .plp-location-explorer {
                    position: absolute;
                    inset: 0;
                    display: block;
                    width: 100%;
                    height: 100%;
                    min-height: 0;
                    overflow: hidden;
                    border-radius: inherit;
                }

                .bc-page .bc-development-location-map .plp-location-context,
                .bc-page .bc-development-location-map .plp-location-actions,
                .bc-location-modal .bc-development-location-map .plp-location-context,
                .bc-location-modal .bc-development-location-map .plp-location-actions {
                    display: none !important;
                }

                .bc-page .bc-development-location-map .property-feed-map-shell,
                .bc-page .bc-development-location-map .property-feed-map-canvas,
                .bc-page .bc-development-location-map .property-feed-map-street-view,
                .bc-page .bc-development-location-map .property-feed-map-street-frame,
                .bc-page .bc-development-location-map .property-feed-map-street-native,
                .bc-page .bc-development-location-map .property-feed-map-street-native-canvas,
                .bc-page .bc-development-location-map .plp-nearby-map-shell,
                .bc-page .bc-development-location-map .plp-nearby-real-map,
                .bc-page .bc-development-location-map .leaflet-container,
                .bc-location-modal .bc-development-location-map .property-feed-map-shell,
                .bc-location-modal .bc-development-location-map .property-feed-map-canvas,
                .bc-location-modal .bc-development-location-map .property-feed-map-street-view,
                .bc-location-modal .bc-development-location-map .property-feed-map-street-frame,
                .bc-location-modal .bc-development-location-map .property-feed-map-street-native,
                .bc-location-modal .bc-development-location-map .property-feed-map-street-native-canvas,
                .bc-location-modal .bc-development-location-map .plp-nearby-map-shell,
                .bc-location-modal .bc-development-location-map .plp-nearby-real-map,
                .bc-location-modal .bc-development-location-map .leaflet-container {
                    width: 100% !important;
                    height: 100% !important;
                    min-height: 0 !important;
                    border-radius: inherit;
                }

                .bc-page .bc-development-location-map .plp-nearby-map-shell,
                .bc-location-modal .bc-development-location-map .plp-nearby-map-shell {
                    border: 0;
                    border-radius: inherit;
                    box-shadow: none;
                }

                .bc-page .bc-development-location-map .property-feed-map-style-control,
                .bc-page .bc-development-location-map .property-feed-map-caption,
                .bc-page .bc-development-location-map .property-feed-map-street-toggle,
                .bc-page .bc-development-location-map .property-feed-map-street-guide,
                .bc-location-modal .bc-development-location-map .property-feed-map-style-control,
                .bc-location-modal .bc-development-location-map .property-feed-map-caption {
                    display: none !important;
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo::after {
                    display: none !important;
                    content: none !important;
                }

                .bc-page #unidades-disponiveis article > div:first-child > div.bc-unit-photo-price,
                .bc-page #unidades-disponiveis article .bc-unit-photo-price {
                    background: rgba(255, 255, 255, 0.84) !important;
                    color: #211d18 !important;
                    padding: 8px 10px !important;
                    box-shadow: 0 10px 22px rgba(31, 27, 21, 0.12);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo-price::before {
                    display: none !important;
                    content: none !important;
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo-price p {
                    text-shadow: none !important;
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo-price p:first-child {
                    color: #8a7a5d !important;
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo-price p:last-child {
                    color: #211d18 !important;
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo::before,
                .bc-page #unidades-disponiveis article .bc-unit-photo::after {
                    display: none !important;
                    content: none !important;
                    background: transparent !important;
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo-controls {
                    background: transparent !important;
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo-price,
                .bc-page #unidades-disponiveis article > div:first-child > .bc-unit-photo-price {
                    position: absolute !important;
                    left: 10px !important;
                    right: auto !important;
                    bottom: 10px !important;
                    top: auto !important;
                    width: auto !important;
                    max-width: calc(100% - 20px) !important;
                    min-height: 0 !important;
                    border: 1px solid rgba(184, 148, 95, 0.16) !important;
                    border-radius: 7px !important;
                    background: rgba(255, 255, 255, 0.9) !important;
                    padding: 7px 9px !important;
                    color: #211d18 !important;
                    box-shadow: 0 10px 22px rgba(31, 27, 21, 0.1) !important;
                    backdrop-filter: blur(10px) !important;
                    -webkit-backdrop-filter: blur(10px) !important;
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo-price::before,
                .bc-page #unidades-disponiveis article .bc-unit-photo-price::after {
                    display: none !important;
                    content: none !important;
                    background: transparent !important;
                    box-shadow: none !important;
                    backdrop-filter: none !important;
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo-price p {
                    color: #211d18 !important;
                    text-shadow: none !important;
                }

                .bc-page #unidades-disponiveis article .bc-unit-photo-price p:first-child {
                    color: #8a7a5d !important;
                }

                .bc-page .bc-compare-section {
                    background: #ffffff !important;
                }

                .bc-page .bc-compare-section > div {
                    display: grid !important;
                    grid-template-columns: 4fr 8fr;
                    gap: 48px;
                    align-items: start;
                    width: min(1320px, calc(100% - 32px));
                    margin: 0 auto;
                }

                .bc-page .bc-compare-section > div > div:last-child,
                .bc-page .bc-differentials-section > div > div:last-child {
                    display: grid !important;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 18px;
                }

                .bc-page .bc-compare-section > div > div:last-child > div,
                .bc-page .bc-differentials-section > div > div:last-child > div {
                    position: static !important;
                    min-height: 0 !important;
                    overflow: visible !important;
                    border: 1px solid rgba(184, 148, 95, 0.16) !important;
                    border-radius: 8px !important;
                    background: rgba(255, 255, 255, 0.9) !important;
                    padding: 24px !important;
                    box-shadow: 0 12px 30px rgba(31, 27, 21, 0.045);
                }

                .bc-page .bc-compare-section > div > div:last-child > div::after,
                .bc-page .bc-differentials-section > div > div:last-child > div::after {
                    display: none !important;
                    content: none !important;
                }

                .bc-page .bc-compare-section > div > div:last-child > div > div:first-child {
                    width: 44px;
                    height: 44px;
                    display: grid;
                    place-items: center;
                    border: 1px solid rgba(184, 148, 95, 0.2);
                    border-radius: 6px;
                    background: rgba(184, 148, 95, 0.1);
                    color: #d4af37;
                    margin-bottom: 18px;
                }

                .bc-page .bc-compare-section h3,
                .bc-page .bc-differentials-section h3 {
                    margin: 0 0 10px;
                    color: #211d18 !important;
                    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
                    font-size: 18px;
                    font-weight: 450;
                    line-height: 1.26;
                }

                .bc-page .bc-differentials-section {
                    border-top: 1px solid rgba(184, 148, 95, 0.16) !important;
                    border-bottom: 1px solid rgba(184, 148, 95, 0.16) !important;
                    background: #f4efe6 !important;
                }

                .bc-page .bc-differentials-section > div {
                    display: block !important;
                    width: min(1320px, calc(100% - 32px));
                    margin: 0 auto;
                }

                .bc-page .bc-differentials-section > div > div:first-child {
                    max-width: 720px;
                    margin-bottom: 42px;
                }

                .bc-page .bc-differentials-section > div > div:last-child > div > div:first-child {
                    margin-bottom: 24px;
                    color: #b58a28;
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 12px;
                }

                @media (max-width: 1024px) {
                    .bc-page .bc-compare-section > div {
                        grid-template-columns: 1fr;
                    }

                    .bc-page .bc-compare-section > div > div:last-child,
                    .bc-page .bc-differentials-section > div > div:last-child {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }
                }

                @media (max-width: 720px) {
                    body:has(.bc-page) .gh-wrap {
                        display: none !important;
                    }

                    .bc-mobile-landing-header {
                        position: sticky;
                        top: 0;
                        z-index: 80;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 14px;
                        min-height: 68px;
                        border-bottom: 1px solid rgba(184, 148, 95, 0.16);
                        background: #ffffff;
                        padding: 12px 18px;
                        color: #211d18;
                        box-shadow: 0 12px 26px rgba(31, 27, 21, 0.05);
                    }

                    .bc-mobile-landing-logo {
                        display: grid;
                        gap: 1px;
                        min-width: 0;
                        color: #b58a28;
                        text-decoration: none;
                    }

                    .bc-mobile-landing-logo strong {
                        overflow: hidden;
                        font-family: "Playfair Display", Georgia, "Times New Roman", serif;
                        font-size: clamp(19px, 5.1vw, 24px);
                        font-weight: 700;
                        letter-spacing: 0.06em;
                        line-height: 1;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }

                    .bc-mobile-landing-logo span {
                        color: #8a6a2a !important;
                        font-size: 10px !important;
                        font-weight: 800 !important;
                        letter-spacing: 0.12em !important;
                        line-height: 1 !important;
                        text-transform: uppercase !important;
                    }

                    .bc-mobile-landing-actions {
                        display: inline-flex;
                        align-items: center;
                        gap: 10px;
                        flex: 0 0 auto;
                    }

                    .bc-mobile-landing-icon {
                        width: 42px;
                        height: 42px;
                        display: grid;
                        place-items: center;
                        border: 1px solid rgba(184, 148, 95, 0.22);
                        border-radius: 50%;
                        background: #ffffff;
                        color: #b58a28;
                        box-shadow: 0 8px 20px rgba(31, 27, 21, 0.05);
                    }

                    .bc-page .bc-hero-copy {
                        order: 1;
                    }

                    .bc-page .bc-hero-metrics {
                        order: 2;
                    }

                    .bc-page .bc-hero-cta--desktop {
                        display: none !important;
                    }

                    .bc-page .bc-hero-cta--mobile {
                        order: 3;
                        display: flex;
                        width: 100%;
                    }

                    .bc-page .bc-hero-cta--mobile button {
                        width: 100%;
                    }

                    .bc-page .bc-development-gallery-section > div,
                    .bc-page .bc-compare-section > div,
                    .bc-page .bc-differentials-section > div {
                        width: min(100% - 28px, 1320px);
                    }

                    .bc-page .bc-development-gallery-section > div > div:first-child {
                        flex-direction: column;
                        align-items: flex-start;
                        margin-bottom: 28px;
                    }

                    .bc-page .bc-development-showcase-toolbar {
                        gap: 7px;
                        overflow-x: auto;
                        padding-bottom: 2px;
                    }

                    .bc-page .bc-development-showcase-pill {
                        flex: 0 0 auto;
                        min-height: 34px;
                        padding: 0 12px;
                        font-size: 11px;
                    }

                    .bc-page .bc-development-showcase-stage {
                        grid-template-columns: 1fr !important;
                        gap: 10px !important;
                    }

                    .bc-page .bc-development-gallery-section .bc-development-showcase > .bc-development-showcase-stage {
                        grid-template-columns: 1fr !important;
                        gap: 10px !important;
                    }

                    .bc-page .bc-development-showcase-main {
                        min-height: 0 !important;
                        aspect-ratio: 16 / 10;
                        border-radius: 8px;
                    }

                    .bc-page .bc-development-gallery-section .bc-development-showcase-stage > .bc-development-showcase-main {
                        width: 100% !important;
                        min-height: 0 !important;
                        aspect-ratio: 16 / 10;
                    }

                    .bc-page .bc-development-showcase-nav {
                        width: 42px;
                        height: 42px;
                    }

                    .bc-page .bc-development-showcase-nav--prev {
                        left: 10px;
                    }

                    .bc-page .bc-development-showcase-nav--next {
                        right: 10px;
                    }

                    .bc-page .bc-development-showcase-open {
                        left: 10px;
                        top: 10px;
                        min-height: 32px;
                        padding: 0 11px;
                        font-size: 11px;
                    }

                    .bc-page .bc-development-showcase-rail {
                        width: 100% !important;
                        max-height: none !important;
                        display: flex !important;
                        gap: 8px;
                        overflow-x: auto;
                        overflow-y: hidden !important;
                        padding: 0 0 4px;
                        scroll-snap-type: x proximity;
                        touch-action: pan-x;
                    }

                    .bc-page .bc-development-gallery-section .bc-development-showcase-stage > .bc-development-showcase-rail {
                        width: 100% !important;
                        max-height: none !important;
                        display: flex !important;
                        overflow-x: auto !important;
                        overflow-y: hidden !important;
                    }

                    .bc-page .bc-development-showcase-thumb {
                        flex: 0 0 132px;
                        scroll-snap-align: start;
                    }

                    .bc-page .bc-development-showcase-thumb-label {
                        left: 7px;
                        bottom: 7px;
                        min-height: 25px;
                        max-width: calc(100% - 14px);
                        padding: 0 8px;
                        font-size: 10px !important;
                    }

                    .bc-page .bc-development-gallery-section .bc-development-media-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 10px;
                    }

                    .bc-page .bc-development-gallery-section .bc-development-media-card {
                        aspect-ratio: 1 / 0.86;
                        border-radius: 7px !important;
                    }

                    .bc-page .bc-development-gallery-section .bc-development-media-card:first-child {
                        grid-column: 1 / -1;
                        aspect-ratio: 16 / 10;
                    }

                    .bc-page .bc-development-gallery-section .bc-development-media-card--embed {
                        min-height: 158px !important;
                    }

                    .bc-page .bc-development-media-copy,
                    .bc-page .bc-development-media-frame-label {
                        left: 8px;
                        right: 8px;
                        bottom: 8px;
                        max-width: calc(100% - 16px);
                        padding: 7px 8px;
                    }

                    .bc-page .bc-development-media-copy p,
                    .bc-page .bc-development-media-frame-label span {
                        font-size: 7px;
                        letter-spacing: 0.11em;
                    }

                    .bc-page .bc-development-media-copy h3,
                    .bc-page .bc-development-media-frame-label strong {
                        font-size: 14px;
                    }

                    .bc-page .bc-development-media-frame-hit {
                        padding: 8px;
                    }

                    .bc-page .bc-development-media-frame-hit span {
                        min-height: 28px;
                        padding: 0 9px;
                        font-size: 9px;
                        gap: 5px;
                    }

                    .bc-page .bc-compare-section > div > div:last-child,
                    .bc-page .bc-differentials-section > div > div:last-child {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    )
}

function RelatedDevelopmentsSection({ activeDev, developments }: { activeDev: Development; developments: RelatedDevelopment[] }) {
    if (!developments.length) return null

    return (
        <section className="bc-related-developments-section" aria-labelledby="bc-related-developments-title">
            <div className="bc-related-developments-inner">
                <div className="bc-related-developments-header">
                    <div>
                        <span>Empreendimentos semelhantes</span>
                        <h2 id="bc-related-developments-title">Outras oportunidades para comparar com {activeDev.name}.</h2>
                    </div>
                    <p>Veja outros predios e condominios com unidades selecionadas pela curadoria Guilherme Pilger.</p>
                </div>

                <div className="bc-related-developments-grid">
                    {developments.map((development) => (
                        <Link
                            key={development.slug}
                            href={`/${development.slug}`}
                            className="bc-related-development-card"
                        >
                            <img src={development.heroImage} alt={development.name} referrerPolicy="no-referrer" />
                            <span className="bc-related-development-shade" />
                            <span className="bc-related-development-copy">
                                <small>{development.locationName}</small>
                                <strong>{development.name}</strong>
                                <em>{development.availableUnitsCount ? `${development.availableUnitsCount} unidades` : 'Consultar unidades'}</em>
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    )
}

function LandingMobileHeader() {
    const openGlobalMenu = () => {
        window.dispatchEvent(new CustomEvent('pilger:open-global-menu'))
    }

    return (
        <header className="bc-mobile-landing-header" aria-label="Cabecalho mobile da landing page">
            <Link href="/" className="bc-mobile-landing-logo">
                <strong>GUILHERME PILGER</strong>
                <span>CRECI/SC 6772-J</span>
            </Link>

            <div className="bc-mobile-landing-actions">
                <button
                    type="button"
                    className="bc-mobile-landing-icon"
                    onClick={openGlobalMenu}
                    aria-label="Abrir menu global"
                    aria-expanded={false}
                >
                    <Menu size={25} />
                </button>
            </div>
        </header>
    )
}

type DevelopmentShowcaseMediaItem =
    | {
        type: 'photo'
        title: string
        label: string
        kicker: string
        src: string
        photoIndex: number
    }
    | {
        type: DevelopmentLocationMode
        title: string
        label: string
        kicker: string
        fallbackSrc: string
        icon: React.ComponentType<{ size?: number; className?: string }>
    }

function DevelopmentMediaShowcase({ development, mapEmbedSrc, streetViewEmbedSrc, property, latLng, onOpenLocation }: {
    development: Development
    mapEmbedSrc: string
    streetViewEmbedSrc: string
    property: PropertyLocationMapProperty
    latLng: [number, number] | null
    onOpenLocation: (mode: DevelopmentLocationMode) => void
}) {
    const mediaItems = useMemo<DevelopmentShowcaseMediaItem[]>(() => {
        const photoItems: DevelopmentShowcaseMediaItem[] = development.gallery.map((item, index) => ({
            type: 'photo',
            title: item.title,
            label: index === 0 ? 'Foto principal' : `Imagem ${index + 1}`,
            kicker: item.category,
            src: item.image,
            photoIndex: index,
        }))
        const items: DevelopmentShowcaseMediaItem[] = []

        if (photoItems[0]) items.push(photoItems[0])

        items.push({
            type: 'street',
            title: 'Street View',
            label: 'Street View',
            kicker: 'Rua e acesso',
            fallbackSrc: streetViewEmbedSrc,
            icon: Navigation,
        })
        items.push({
            type: 'map',
            title: 'Mapa do entorno',
            label: 'Mapa',
            kicker: 'Proximidades',
            fallbackSrc: mapEmbedSrc,
            icon: MapPinned,
        })
        items.push(...photoItems.slice(1))

        return items
    }, [development.gallery, mapEmbedSrc, streetViewEmbedSrc])
    const [activeMediaIndex, setActiveMediaIndex] = useState(0)
    const touchStartRef = useRef<{ x: number; y: number } | null>(null)
    const touchCurrentRef = useRef<{ x: number; y: number } | null>(null)
    const galleryCount = development.gallery.length
    const safeActiveIndex = Math.min(activeMediaIndex, Math.max(mediaItems.length - 1, 0))
    const activeMedia = mediaItems[safeActiveIndex]
    const canBrowse = mediaItems.length > 1

    if (!activeMedia) return null

    const selectMedia = (targetIndex: number) => {
        if (!mediaItems.length) return
        setActiveMediaIndex((targetIndex + mediaItems.length) % mediaItems.length)
    }
    const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
        const touch = event.touches[0]
        if (!touch) return

        touchStartRef.current = { x: touch.clientX, y: touch.clientY }
        touchCurrentRef.current = { x: touch.clientX, y: touch.clientY }
    }
    const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
        const touch = event.touches[0]
        if (!touch) return

        touchCurrentRef.current = { x: touch.clientX, y: touch.clientY }
    }
    const handleTouchEnd = () => {
        const start = touchStartRef.current
        const current = touchCurrentRef.current
        touchStartRef.current = null
        touchCurrentRef.current = null

        if (!start || !current || !canBrowse) return

        const deltaX = current.x - start.x
        const deltaY = current.y - start.y
        const isHorizontalSwipe = Math.abs(deltaX) > 42 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25

        if (!isHorizontalSwipe) return
        selectMedia(safeActiveIndex + (deltaX < 0 ? 1 : -1))
    }
    const isLocationMedia = activeMedia.type === 'map' || activeMedia.type === 'street'

    return (
        <div className="bc-development-showcase" aria-label={`Midias de ${development.name}`}>
            <div className="bc-development-showcase-toolbar">
                <button type="button" className="bc-development-showcase-pill" onClick={() => selectMedia(0)}>
                    <Camera size={15} />
                    Fotos
                    <strong>{galleryCount}</strong>
                </button>
                <button type="button" className="bc-development-showcase-pill">
                    <Heart size={15} />
                    Salvar
                </button>
                <button type="button" className="bc-development-showcase-pill">
                    <Share2 size={15} />
                    Compartilhar
                </button>
            </div>

            <div className="bc-development-showcase-stage">
                <div
                    className={`bc-development-showcase-main bc-development-showcase-main--${activeMedia.type}`}
                    onTouchCancel={handleTouchEnd}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                    onTouchStart={handleTouchStart}
                >
                    <DevelopmentMediaContent
                        item={activeMedia}
                        latLng={latLng}
                        property={property}
                    />

                    {canBrowse && (
                        <>
                            <button
                                type="button"
                                className="bc-development-showcase-nav bc-development-showcase-nav--prev"
                                onClick={() => selectMedia(safeActiveIndex - 1)}
                                aria-label="Midia anterior"
                            >
                                <ChevronLeft size={24} />
                            </button>
                            <button
                                type="button"
                                className="bc-development-showcase-nav bc-development-showcase-nav--next"
                                onClick={() => selectMedia(safeActiveIndex + 1)}
                                aria-label="Proxima midia"
                            >
                                <ChevronRight size={24} />
                            </button>
                        </>
                    )}

                    {isLocationMedia && (
                        <button
                            type="button"
                            className="bc-development-showcase-open"
                            onClick={() => onOpenLocation(activeMedia.type)}
                        >
                            {activeMedia.type === 'map' ? <MapPinned size={16} /> : <Navigation size={16} />}
                            {activeMedia.type === 'map' ? 'Ver mapa' : 'Abrir Street View'}
                        </button>
                    )}
                </div>

                <div className="bc-development-showcase-rail" aria-label="Selecionar midia">
                    {mediaItems.map((item, index) => (
                        <button
                            key={`${item.type}-${item.type === 'photo' ? item.photoIndex : item.title}`}
                            type="button"
                            className={`bc-development-showcase-thumb ${index === safeActiveIndex ? 'is-active' : ''}`}
                            onClick={() => selectMedia(index)}
                            aria-label={`Abrir ${item.label}`}
                        >
                            <DevelopmentMediaContent
                                compact
                                item={item}
                                latLng={latLng}
                                property={property}
                            />
                            <span className="bc-development-showcase-thumb-label">
                                {item.type === 'map' ? <MapPinned size={13} /> : item.type === 'street' ? <Navigation size={13} /> : <Camera size={13} />}
                                {item.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}

function DevelopmentMediaContent({ item, property, latLng, compact = false }: {
    item: DevelopmentShowcaseMediaItem
    property: PropertyLocationMapProperty
    latLng: [number, number] | null
    compact?: boolean
}) {
    if (item.type === 'photo') {
        return (
            <img
                src={item.src}
                alt={item.title}
                loading={compact ? 'lazy' : undefined}
                referrerPolicy="no-referrer"
            />
        )
    }

    if (item.type === 'street' && compact) {
        return (
            <StaticDevelopmentStreetViewThumb
                fallbackSrc={item.fallbackSrc}
                latLng={latLng}
                title={`${item.label} de ${property.title}`}
            />
        )
    }

    if (item.type === 'street' && latLng) {
        return (
            <div className="bc-development-location-map bc-development-location-map--street">
                <PropertyLocationMap
                    property={property}
                    latLng={latLng}
                    initialView="street"
                    allowedViews={['street']}
                    showViewControl={false}
                />
            </div>
        )
    }

    if (item.type === 'map' && latLng && !compact) {
        return (
            <div className="bc-development-location-map">
                <PropertyLocationMap
                    property={property}
                    latLng={latLng}
                    initialView="luxury"
                    allowedViews={['luxury']}
                    showViewControl={false}
                    showNearbyBenefits
                />
            </div>
        )
    }

    return (
        <iframe
            title={item.title}
            src={item.fallbackSrc}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allow="geolocation; accelerometer; gyroscope"
            allowFullScreen
            tabIndex={compact ? -1 : undefined}
        />
    )
}

function StaticDevelopmentStreetViewThumb({ fallbackSrc, latLng, title }: {
    fallbackSrc: string
    latLng: [number, number] | null
    title: string
}) {
    const [failed, setFailed] = useState(false)
    const previewUrl = useMemo(() => buildStaticStreetViewPreviewUrl(latLng), [latLng])

    if (!previewUrl || failed) {
        return (
            <iframe
                title={title}
                src={fallbackSrc}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allow="geolocation; accelerometer; gyroscope"
                allowFullScreen
                tabIndex={-1}
            />
        )
    }

    return (
        <span className="bc-development-location-static-thumb">
            <img
                src={previewUrl}
                alt={title}
                loading="lazy"
                onError={() => setFailed(true)}
            />
        </span>
    )
}

function DevelopmentLocationModal({ mode, fallbackSrc, title, property, latLng, onClose }: {
    mode: DevelopmentLocationMode
    fallbackSrc: string
    title: string
    property: PropertyLocationMapProperty
    latLng: [number, number] | null
    onClose: () => void
}) {
    return (
        <div className={`bc-location-modal bc-location-modal--${mode}`} role="dialog" aria-modal="true" aria-label={title}>
            <button type="button" className="bc-location-modal-close" onClick={onClose} aria-label="Fechar">
                <X size={22} />
            </button>
            <div className="bc-location-modal-body">
                {latLng && mode === 'map' ? (
                    <div className="bc-development-location-map">
                        <PropertyLocationMap
                            property={property}
                            latLng={latLng}
                            initialView="luxury"
                            allowedViews={['luxury']}
                            showViewControl={false}
                            showNearbyBenefits
                        />
                    </div>
                ) : latLng && mode === 'street' ? (
                    <div className="bc-development-location-map bc-development-location-map--street">
                        <PropertyLocationMap
                            property={property}
                            latLng={latLng}
                            initialView="street"
                            allowedViews={['street']}
                            showViewControl={false}
                        />
                    </div>
                ) : (
                    <iframe
                        title={title}
                        src={fallbackSrc}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        allow="geolocation; accelerometer; gyroscope"
                        allowFullScreen
                    />
                )}
            </div>
        </div>
    )
}

function HeroUnitsButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="bc-hero-units-button group flex items-center justify-center gap-2 rounded bg-[#D4AF37] px-8 py-4 text-xs font-black uppercase tracking-[0.18em] text-[#0A0D10] shadow-xl shadow-[#D4AF37]/10 transition hover:bg-[#E5C158]"
        >
            <span className="bc-hero-units-label">Ver unidades disponiveis</span>
            <ArrowRight className="h-4 w-4 text-[#0A0D10] transition group-hover:translate-x-1" />
        </button>
    )
}

function HeroMetric({ icon: Icon, label, value, note, highlight = false }: {
    icon: React.ComponentType<{ size?: number; className?: string }>
    label: string
    value: string
    note: string
    highlight?: boolean
}) {
    return (
        <div className="bc-hero-metric">
            <div className="bc-hero-metric-icon">
                <Icon size={18} />
            </div>
            <div className="min-w-0">
                <p>{label}</p>
                <h3 className={highlight ? 'text-emerald-400' : 'text-white'}>{value}</h3>
                <span>{note}</span>
            </div>
        </div>
    )
}

function Stat({ label, value, gold = false }: { label: string; value: string; gold?: boolean }) {
    return (
        <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">{label}</p>
            <p className={`bc-stat-value mt-1 font-serif text-base md:text-lg ${gold ? 'is-gold text-[#D4AF37]' : 'text-white'}`}>{value}</p>
        </div>
    )
}

function UnitCard({ unit, development, propertyMedia }: { unit: Unit; development: Development; propertyMedia?: UnitPropertyMedia }) {
    const touchStartX = useRef<number | null>(null)
    const gallery = useMemo(() => galleryForUnit(unit, propertyMedia, development), [development, propertyMedia, unit])
    const [activeImageIndex, setActiveImageIndex] = useState(0)
    const safeImageIndex = gallery.length ? activeImageIndex % gallery.length : 0
    const activeImage = gallery[safeImageIndex] || unit.image
    const showGalleryControls = gallery.length > 1

    const moveGallery = useCallback((direction: number) => {
        if (!gallery.length) return
        setActiveImageIndex((current) => (current + direction + gallery.length) % gallery.length)
    }, [gallery.length])

    const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
        const startX = touchStartX.current
        const endX = event.changedTouches[0]?.clientX
        touchStartX.current = null

        if (startX == null || endX == null) return

        const distance = endX - startX
        if (Math.abs(distance) < 34) return
        moveGallery(distance < 0 ? 1 : -1)
    }

    return (
        <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-zinc-800/85 bg-[#11161D]/75 transition duration-500 hover:border-[#D4AF37]/45 hover:shadow-2xl hover:shadow-[#D4AF37]/5">
            <div
                className="bc-unit-photo relative aspect-[4/3] overflow-hidden bg-zinc-900"
                onTouchStart={(event) => {
                    touchStartX.current = event.touches[0]?.clientX ?? null
                }}
                onTouchEnd={handleTouchEnd}
            >
                <img src={activeImage} alt={unit.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
                <span className={`absolute left-4 top-4 rounded px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] shadow-md ${unit.status.toLowerCase().includes('ultima') ? 'bg-amber-500 text-zinc-950' : 'border border-[#D4AF37]/40 bg-[#0A0D10]/95 text-[#D4AF37]'}`}>
                    {unit.status}
                </span>
                {showGalleryControls && (
                    <div className="bc-unit-photo-controls">
                        <button
                            type="button"
                            className="bc-unit-photo-nav bc-unit-photo-nav--prev"
                            aria-label={`Foto anterior de ${unit.type}`}
                            onClick={() => moveGallery(-1)}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            type="button"
                            className="bc-unit-photo-nav bc-unit-photo-nav--next"
                            aria-label={`Proxima foto de ${unit.type}`}
                            onClick={() => moveGallery(1)}
                        >
                            <ChevronRight size={16} />
                        </button>
                        <div className="bc-unit-photo-count">
                            <Camera size={13} />
                            {safeImageIndex + 1}/{gallery.length}
                        </div>
                        <div className="bc-unit-photo-dots" aria-hidden="true">
                            {gallery.slice(0, 5).map((image, index) => (
                                <span key={`${image}-${index}`} className={`bc-unit-photo-dot ${index === safeImageIndex ? 'is-active' : ''}`} />
                            ))}
                        </div>
                    </div>
                )}
                <div className="bc-unit-photo-price absolute bottom-3 left-3">
                    <p className="text-[9px] font-mono uppercase tracking-[0.22em] text-zinc-400">Preco estimado</p>
                    <p className="mt-1 font-serif text-xl text-white">{unit.price}</p>
                </div>
            </div>

            <div className="flex flex-1 flex-col p-6">
                <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.18em] text-[#D4AF37]">{development.name}</p>
                <h3 className="mb-5 text-2xl font-semibold tracking-wide text-white">{unit.type}</h3>

                <div className="mb-6 grid grid-cols-3 gap-3 border-y border-zinc-800/60 py-4">
                    <Spec icon={Maximize2} label="Area" value={unit.area} />
                    <Spec icon={BedDouble} label="Suites" value={unit.suites} />
                    <Spec icon={Car} label="Vagas" value={unit.vagas} />
                </div>

                <div className="mt-auto flex flex-col gap-3">
                    <Link
                        href={`/imovel/${unit.sourceSlug}`}
                        className="flex w-full items-center justify-center gap-2 rounded border border-zinc-800 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 transition hover:border-[#D4AF37]/50 hover:text-white"
                    >
                        Ver detalhes
                        <ArrowUpRight size={14} className="text-[#D4AF37]" />
                    </Link>
                </div>
            </div>
        </article>
    )
}

function Spec({ icon: Icon, label, value }: {
    icon: React.ComponentType<{ size?: number; className?: string }>
    label: string
    value: string
}) {
    return (
        <div className="flex min-h-20 flex-col items-center justify-center rounded border border-zinc-800/40 bg-zinc-900/30 p-2 text-center">
            <Icon size={16} className="mb-2 text-[#D4AF37]" />
            <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-zinc-500">{label}</span>
            <span className="mt-1 text-xs font-bold text-white">{value}</span>
        </div>
    )
}
