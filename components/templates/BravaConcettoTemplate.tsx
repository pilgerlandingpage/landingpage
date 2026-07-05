'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
    ArrowRight,
    ArrowUpRight,
    BedDouble,
    Building2,
    Car,
    Compass,
    Dumbbell,
    KeyRound,
    Lock,
    MapPin,
    Maximize2,
    MessageSquare,
    Minus,
    Navigation,
    Phone,
    Plus,
    ShieldCheck,
    Sparkles,
    Waves,
} from 'lucide-react'
import LandingPageLogic from '@/components/landing/LandingPageLogic'
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
    benefits: Array<{ title: string; description: string; icon: 'ShieldCheck' | 'Waves' | 'Dumbbell' | 'Lock' | 'Compass' | 'Building2' | 'KeyRound' }>
    differentials: Array<{ title: string; description: string }>
    units: Unit[]
    gallery: Array<{ title: string; image: string; category: string }>
    faq: Array<{ question: string; answer: string }>
}

const R2 = 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev'
const GUILHERME_AVATAR = 'https://pub-eaf679ed02634f958b68991d910a997b.r2.dev/IMG_2868.jpg'

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

function asNumber(value: unknown, fallback = 0) {
    const number = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(number) ? number : fallback
}

function normalizeUnit(value: unknown): Unit | null {
    if (!isRecord(value)) return null

    const id = asText(value.id)
    const type = asText(value.type)
    const title = asText(value.title, type)
    const image = asText(value.image)
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
        benefits: benefits.length ? benefits : (fallback?.benefits || []),
        differentials: differentials.length ? differentials : (fallback?.differentials || []),
        units: units.length ? units : (fallback?.units || []),
        gallery: gallery.length ? gallery : (fallback?.gallery || []),
        faq: faq.length ? faq : (fallback?.faq || []),
    }
}

export default function BravaConcettoTemplate({ slug, landingPageId, agentName, greetingMessage, content }: TemplateProps) {
    const contentDevelopment = useMemo(() => normalizeDevelopment(content?.development), [content])
    const [faqOpen, setFaqOpen] = useState<number | null>(0)
    const [broker, setBroker] = useState<{ name?: string; phone?: string; photo_url?: string | null; greeting_message?: string } | null>(null)
    const [failedBrokerPhotoUrl, setFailedBrokerPhotoUrl] = useState<string | null>(null)

    const activeDev = useMemo(() => {
        const contentDevelopmentId = asText(content?.development_id, contentDevelopment?.id || DEFAULT_DEVELOPMENT_ID)
        return contentDevelopment || normalizeDevelopment({ id: contentDevelopmentId }) || DEVELOPMENTS[0]
    }, [content, contentDevelopment])

    useEffect(() => {
        fetch(`/api/broker-for-page?slug=${slug}`)
            .then((response) => response.json())
            .then((payload) => {
                if (payload?.broker) setBroker(payload.broker)
            })
            .catch(() => {})
    }, [slug])

    const brokerPhotoUrl = failedBrokerPhotoUrl === GUILHERME_AVATAR ? null : GUILHERME_AVATAR

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
        <div className="bc-page min-h-screen bg-[#0A0D10] text-zinc-300 antialiased selection:bg-[#D4AF37] selection:text-[#0A0D10]">
            <LandingPageLogic slug={slug} landingPageId={landingPageId} agentName={agentName} greetingMessage={greetingMessage} />

            <div className="bg-[#D4AF37] px-4 py-2 text-center text-[10px] font-black uppercase tracking-[0.28em] text-[#0A0D10]">
                Oportunidades de alto padrao em Balneario Camboriu e Praia Brava
            </div>

            <header className="sticky top-0 z-50 border-b border-[#D4AF37]/15 bg-[#0A0D10]/92 backdrop-blur-xl">
                <div className="mx-auto flex max-w-[1320px] flex-col gap-5 px-4 py-5 md:px-8 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bc-brand-avatar flex h-12 w-12 items-center justify-center rounded-full border border-[#D4AF37] text-[#D4AF37]">
                            {brokerPhotoUrl ? (
                                <img
                                    src={brokerPhotoUrl}
                                    alt={broker?.name || 'Guilherme Pilger'}
                                    className="bc-brand-photo"
                                    referrerPolicy="no-referrer"
                                    onError={() => setFailedBrokerPhotoUrl(brokerPhotoUrl)}
                                />
                            ) : (
                                <span className="font-serif text-sm font-bold tracking-widest">GP</span>
                            )}
                        </div>
                        <div>
                            <p className="font-serif text-lg font-semibold uppercase tracking-[0.18em] text-white md:text-xl">Guilherme Pilger</p>
                            <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Consultoria imobiliaria de luxo</p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => openChat()}
                        className="hidden items-center justify-center gap-2 rounded border border-[#D4AF37]/70 px-6 py-3 text-xs font-black uppercase tracking-[0.16em] text-[#D4AF37] transition hover:bg-[#D4AF37] hover:text-[#0A0D10] lg:flex"
                    >
                        <Phone size={15} />
                        Falar com especialista
                    </button>
                </div>
            </header>

            <main>
                <section className="relative flex min-h-[calc(100vh-120px)] items-center overflow-hidden bg-[#07090C]">
                    <div className="absolute inset-0">
                        <img
                            src={activeDev.heroImage}
                            alt={activeDev.name}
                            className="h-full w-full object-cover opacity-55 transition duration-700"
                            referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0D10] via-[#0A0D10]/45 to-[#0A0D10]/75" />
                        <div className="absolute inset-0 hidden bg-gradient-to-r from-[#0A0D10]/95 via-[#0A0D10]/25 to-transparent lg:block" />
                    </div>

                    <div className="relative z-10 mx-auto flex min-h-[760px] w-full max-w-[1320px] flex-col justify-between gap-12 px-4 py-14 md:px-8 lg:py-20">
                        <div className="max-w-4xl pt-8">
                            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/35 bg-[#11161D]/90 px-4 py-2 text-[10px] font-mono uppercase tracking-[0.22em] text-[#D4AF37]">
                                <Sparkles size={14} />
                                Empreendimento exclusivo
                            </div>

                            <h1 className="mb-6 text-5xl font-semibold leading-[1.02] tracking-tight text-white md:text-7xl lg:text-8xl">
                                {activeDev.name}
                            </h1>

                            <p className="mb-8 max-w-2xl text-lg font-light leading-relaxed text-zinc-200 md:text-2xl">
                                {activeDev.tagline}
                            </p>

                            <div className="flex flex-col gap-4 sm:flex-row">
                                <button
                                    type="button"
                                    onClick={() => openChat()}
                                    className="rounded bg-[#D4AF37] px-8 py-4 text-xs font-black uppercase tracking-[0.18em] text-[#0A0D10] shadow-xl shadow-[#D4AF37]/10 transition hover:bg-[#E5C158]"
                                >
                                    Falar com especialista
                                </button>
                                <button
                                    type="button"
                                    onClick={handleScrollToUnits}
                                    className="group flex items-center justify-center gap-2 rounded border border-zinc-800 bg-[#11161D]/85 px-8 py-4 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:border-[#D4AF37]/50"
                                >
                                    Ver unidades disponiveis
                                    <ArrowRight className="h-4 w-4 text-[#D4AF37] transition group-hover:translate-x-1" />
                                </button>
                            </div>
                        </div>

                        <div className="grid max-w-5xl grid-cols-1 gap-4 rounded-lg border border-zinc-800/70 bg-[#11161D]/85 p-5 shadow-2xl backdrop-blur-md sm:grid-cols-2 lg:grid-cols-4">
                            <HeroMetric icon={MapPin} label="Localizacao" value={activeDev.locationName} note="Regiao nobre" />
                            <HeroMetric icon={KeyRound} label="Faixa de preco" value={activeDev.priceRange} note="Curadoria ativa" />
                            <HeroMetric icon={Maximize2} label="Oportunidade" value={`${activeDev.availableUnitsCount} unidades`} note="Disponiveis agora" highlight />
                            <HeroMetric icon={BedDouble} label="Configuracoes" value={activeDev.suitesRange} note={activeDev.areaRange} />
                        </div>
                    </div>
                </section>

                <section className="border-y border-zinc-800/50 bg-[#11161D] py-10">
                    <div className="mx-auto grid max-w-[1320px] grid-cols-2 gap-6 px-4 text-center md:grid-cols-4 md:px-8">
                        <Stat label="Produto" value="Empreendimento" />
                        <Stat label="Estoque" value={`${activeDev.availableUnitsCount} unidades`} gold />
                        <Stat label="Perfil" value={activeDev.city} />
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

                        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                            {activeDev.units.map((unit) => (
                                <UnitCard key={unit.id} unit={unit} development={activeDev} onOpenChat={() => openChat(unit)} />
                            ))}
                        </div>
                    </div>
                </section>

                <section className="bg-[#0A0D10] py-20 md:py-24">
                    <div className="mx-auto grid max-w-[1320px] grid-cols-1 gap-12 px-4 md:px-8 lg:grid-cols-12">
                        <div className="lg:col-span-4">
                            <span className="mb-3 block text-xs font-mono uppercase tracking-[0.24em] text-[#D4AF37]">Por que este empreendimento</span>
                            <h2 className="text-4xl font-semibold leading-tight text-white md:text-5xl">Mais do que uma unidade, uma tese de moradia e patrimonio.</h2>
                            <p className="mt-5 text-sm leading-relaxed text-zinc-400">{activeDev.description}</p>
                        </div>
                        <div className="grid gap-5 md:grid-cols-3 lg:col-span-8">
                            {activeDev.benefits.map((benefit) => {
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

                <section className="border-y border-zinc-800 bg-[#11161D] py-20">
                    <div className="mx-auto max-w-[1320px] px-4 md:px-8">
                        <div className="mb-12 max-w-2xl">
                            <span className="mb-3 block text-xs font-mono uppercase tracking-[0.24em] text-[#D4AF37]">Diferenciais</span>
                            <h2 className="text-4xl font-semibold text-white md:text-5xl">Leitura tecnica para decidir melhor.</h2>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                            {activeDev.differentials.map((item, index) => (
                                <div key={item.title} className="rounded-lg border border-zinc-800 bg-[#0D1117] p-6">
                                    <div className="mb-6 text-xs font-mono text-[#D4AF37]">0{index + 1}</div>
                                    <h3 className="mb-3 text-xl font-semibold text-white">{item.title}</h3>
                                    <p className="text-sm leading-relaxed text-zinc-400">{item.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="bg-[#0A0D10] py-20 md:py-24">
                    <div className="mx-auto max-w-[1320px] px-4 md:px-8">
                        <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                            <div>
                                <span className="mb-3 block text-xs font-mono uppercase tracking-[0.24em] text-[#D4AF37]">Galeria</span>
                                <h2 className="text-4xl font-semibold text-white md:text-5xl">Visual do empreendimento</h2>
                            </div>
                            <p className="max-w-sm text-sm text-zinc-500">Imagens do empreendimento e das unidades para apoiar a primeira comparacao visual.</p>
                        </div>
                        <div className="grid gap-5 md:grid-cols-3">
                            {activeDev.gallery.map((item, index) => (
                                <div key={`${item.title}-${index}`} className={`group relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 ${index === 0 ? 'md:col-span-2 md:row-span-2' : ''}`}>
                                    <img src={item.image} alt={item.title} className={`w-full object-cover transition duration-700 group-hover:scale-105 ${index === 0 ? 'h-[520px]' : 'h-[250px]'}`} referrerPolicy="no-referrer" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                    <div className="absolute bottom-4 left-4">
                                        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#D4AF37]">{item.category}</p>
                                        <h3 className="mt-1 text-lg font-semibold text-white">{item.title}</h3>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="border-y border-zinc-800 bg-[#11161D] py-20">
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
                        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 lg:col-span-8">
                            <iframe
                                title={`Mapa ${activeDev.name}`}
                                src={`https://maps.google.com/maps?q=${encodeURIComponent(activeDev.address)}&z=15&output=embed&hl=pt-BR`}
                                className="h-[420px] w-full grayscale"
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            />
                        </div>
                    </div>
                </section>

                <section className="bg-[#0A0D10] py-20">
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
            </main>

            <footer className="border-t border-zinc-900 bg-[#07090C] py-14">
                <div className="mx-auto flex max-w-[1320px] flex-col gap-8 px-4 md:px-8 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="font-serif text-xl uppercase tracking-[0.18em] text-white">Guilherme Pilger</p>
                        <p className="mt-2 max-w-xl text-xs leading-relaxed text-zinc-500">Curadoria de empreendimentos e unidades de alto padrao no litoral catarinense.</p>
                    </div>
                    <Link
                        href="/#empreendimentos"
                        className="inline-flex items-center gap-2 rounded border border-zinc-800 px-4 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500 transition hover:border-[#D4AF37]/60 hover:text-[#D4AF37]"
                    >
                        Ver outros empreendimentos
                        <ArrowRight size={13} />
                    </Link>
                </div>
            </footer>

            <div className="bc-floating-actions">
                <button
                    type="button"
                    onClick={() => openChat()}
                    className="bc-floating-chat"
                    aria-label="Abrir conversa com especialista"
                >
                    <MessageSquare size={19} />
                </button>
                <button
                    type="button"
                    onClick={() => openChat()}
                    className="bc-floating-consult"
                >
                    <Phone size={16} />
                    <span className="bc-floating-label-full">Especialista Guilherme Pilger</span>
                    <span className="bc-floating-label-short">Consultar</span>
                </button>
            </div>

            <style jsx global>{`
                .bc-page {
                    min-height: 100vh;
                    background: #0a0d10;
                    color: #d4d4d8;
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

                .bc-page > div:nth-of-type(1) {
                    background: #d4af37;
                    color: #0a0d10;
                    padding: 7px 16px;
                    text-align: center;
                    font-size: 9px;
                    font-weight: 950;
                    letter-spacing: 0.24em;
                    text-transform: uppercase;
                }

                .bc-page header {
                    position: sticky;
                    top: 0;
                    z-index: 50;
                    border-bottom: 1px solid rgba(212, 175, 55, 0.16);
                    background: rgba(10, 13, 16, 0.94);
                    backdrop-filter: blur(18px);
                }

                .bc-page header > div {
                    width: min(1260px, calc(100% - 32px));
                    margin: 0 auto;
                    padding: 12px 0;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 18px;
                }

                .bc-page header > div > div:first-child {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    min-width: 222px;
                }

                .bc-page header > div > div:first-child > div:first-child {
                    width: 40px;
                    height: 40px;
                    border: 1px solid #d4af37;
                    border-radius: 999px;
                    display: grid;
                    place-items: center;
                    color: #d4af37;
                    flex: 0 0 auto;
                    overflow: hidden;
                    background: #0a0d10;
                }

                .bc-brand-photo {
                    width: 100%;
                    height: 100%;
                    display: block;
                    object-fit: cover;
                }

                .bc-page header span {
                    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
                    font-size: 12px;
                    font-weight: 800;
                    letter-spacing: 0.16em;
                }

                .bc-page header p {
                    margin: 0;
                }

                .bc-page header p:first-child {
                    color: #ffffff;
                    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
                    font-size: 17px;
                    font-weight: 700;
                    letter-spacing: 0.14em;
                    line-height: 1.1;
                    text-transform: uppercase;
                }

                .bc-page header p:last-child {
                    margin-top: 4px;
                    color: #858b94;
                    font-size: 9px;
                    letter-spacing: 0.18em;
                    text-transform: uppercase;
                }

                .bc-page header > div > button {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    border: 1px solid rgba(212, 175, 55, 0.7);
                    border-radius: 4px;
                    background: transparent;
                    color: #d4af37;
                    padding: 10px 17px;
                    font-size: 10px;
                    font-weight: 950;
                    letter-spacing: 0.13em;
                    text-transform: uppercase;
                    white-space: nowrap;
                    transition: background 0.2s ease, color 0.2s ease;
                }

                .bc-page header > div > button:hover {
                    background: #d4af37;
                    color: #0a0d10;
                }

                .bc-page main > section {
                    position: relative;
                }

                .bc-page main > section:nth-of-type(1) {
                    min-height: calc(100vh - 88px);
                    display: flex;
                    align-items: center;
                    overflow: hidden;
                    background: #07090c;
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
                    opacity: 0.56;
                }

                .bc-page main > section:nth-of-type(1) > div:first-child > div {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(to top, #0a0d10 0%, rgba(10, 13, 16, 0.48) 52%, rgba(10, 13, 16, 0.76) 100%);
                }

                .bc-page main > section:nth-of-type(1) > div:first-child > div:last-child {
                    background: linear-gradient(90deg, rgba(10, 13, 16, 0.95), rgba(10, 13, 16, 0.28), transparent);
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
                    color: #ffffff;
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
                    color: #e5e7eb;
                    font-size: clamp(0.98rem, 1.1vw, 1.18rem);
                    font-weight: 300;
                    line-height: 1.72;
                }

                .bc-page main > section:nth-of-type(1) > div:last-child > div:first-child > div:first-child {
                    width: fit-content;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 22px;
                    border: 1px solid rgba(212, 175, 55, 0.35);
                    border-radius: 999px;
                    background: rgba(17, 22, 29, 0.9);
                    color: #d4af37;
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
                    box-shadow: 0 18px 38px rgba(212, 175, 55, 0.12);
                }

                .bc-page main > section:nth-of-type(1) > div:last-child > div:first-child button:last-child {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    border: 1px solid #272e38;
                    background: rgba(17, 22, 29, 0.86);
                    color: #ffffff;
                }

                .bc-page main > section:nth-of-type(1) > div:last-child > div:last-child {
                    width: min(100%, 920px);
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 0;
                    border: 1px solid rgba(63, 63, 70, 0.78);
                    border-radius: 8px;
                    background: rgba(17, 22, 29, 0.88);
                    padding: 14px;
                    box-shadow: 0 22px 58px rgba(0, 0, 0, 0.26);
                    backdrop-filter: blur(14px);
                }

                .bc-page main > section:nth-of-type(1) > div:last-child > div:last-child > div {
                    display: flex;
                    gap: 12px;
                    border-right: 1px solid rgba(63, 63, 70, 0.78);
                    padding: 3px 14px;
                }

                .bc-page main > section:nth-of-type(1) > div:last-child > div:last-child > div:last-child {
                    border-right: 0;
                }

                .bc-page main > section:nth-of-type(1) > div:last-child > div:last-child > div > div:first-child {
                    width: 36px;
                    height: 36px;
                    flex: 0 0 auto;
                    display: grid;
                    place-items: center;
                    border: 1px solid #272e38;
                    border-radius: 6px;
                    background: #07090c;
                    color: #d4af37;
                }

                .bc-page main > section:nth-of-type(1) > div:last-child > div:last-child p,
                .bc-page main > section:nth-of-type(1) > div:last-child > div:last-child span {
                    margin: 0;
                }

                .bc-page main > section:nth-of-type(1) > div:last-child > div:last-child p {
                    color: #8c939f;
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 9px;
                    letter-spacing: 0.18em;
                    text-transform: uppercase;
                }

                .bc-page main > section:nth-of-type(1) > div:last-child > div:last-child h3 {
                    margin: 4px 0 3px;
                    color: #ffffff;
                    font-size: 13px;
                    font-weight: 800;
                    line-height: 1.35;
                }

                .bc-page main > section:nth-of-type(1) > div:last-child > div:last-child span {
                    color: #8c939f;
                    font-size: 10px;
                }

                .bc-page main > section:nth-of-type(2) {
                    border-top: 1px solid rgba(63, 63, 70, 0.5);
                    border-bottom: 1px solid rgba(63, 63, 70, 0.5);
                    background: #11161d;
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
                    color: #858b94;
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 10px;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                }

                .bc-page main > section:nth-of-type(2) p:last-child {
                    margin: 4px 0 0;
                    color: #ffffff;
                    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
                    font-size: 18px;
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
                    border-bottom: 1px solid rgba(212, 175, 55, 0.12);
                    background: #0d1117;
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
                    color: #ffffff;
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
                    color: #d4af37;
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
                    color: #a1a1aa;
                    font-size: 14px;
                    line-height: 1.78;
                }

                .bc-page #unidades-disponiveis > div > div:first-child > div:last-child {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    border: 1px solid #272e38;
                    border-radius: 8px;
                    background: #141a24;
                    color: #d4d4d8;
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

                .bc-page article {
                    display: flex;
                    height: 100%;
                    min-width: 0;
                    flex-direction: column;
                    overflow: hidden;
                    border: 1px solid rgba(63, 63, 70, 0.88);
                    border-radius: 8px;
                    background: rgba(17, 22, 29, 0.78);
                    transition: border-color 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease;
                }

                .bc-page article:hover {
                    transform: translateY(-4px);
                    border-color: rgba(212, 175, 55, 0.46);
                    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.32);
                }

                .bc-page article > div:first-child {
                    position: relative;
                    aspect-ratio: 16 / 10;
                    overflow: hidden;
                    background: #18181b;
                }

                .bc-page article > div:first-child img {
                    width: 100%;
                    height: 100%;
                    display: block;
                    object-fit: cover;
                    transition: transform 0.7s ease;
                }

                .bc-page article:hover > div:first-child img {
                    transform: scale(1.05);
                }

                .bc-page article > div:first-child > span {
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
                    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.22);
                }

                .bc-page #unidades-disponiveis article > div:first-child > span {
                    color: #0a0d10;
                    font-size: 9px;
                    letter-spacing: 0.12em;
                }

                .bc-page article > div:first-child > div {
                    position: absolute;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    padding: 42px 18px 16px;
                    background: linear-gradient(to top, rgba(10, 13, 16, 0.96), rgba(10, 13, 16, 0.55), transparent);
                }

                .bc-page article > div:first-child > div p:first-child {
                    margin: 0;
                    color: #a1a1aa;
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 8px;
                    letter-spacing: 0.18em;
                    text-transform: uppercase;
                }

                .bc-page article > div:first-child > div p:last-child {
                    margin: 3px 0 0;
                    color: #ffffff;
                    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
                    font-size: 18px;
                }

                .bc-page article > div:last-child {
                    display: flex;
                    flex: 1;
                    flex-direction: column;
                    padding: 18px;
                }

                .bc-page article > div:last-child > p {
                    margin: 0 0 8px;
                    color: #d4af37;
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 9px;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                }

                .bc-page article h3 {
                    margin: 0 0 16px;
                    color: #ffffff;
                    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
                    font-size: 18px;
                    font-weight: 450;
                    line-height: 1.22;
                }

                .bc-page article > div:last-child > div:nth-of-type(1) {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 8px;
                    margin-bottom: 16px;
                    border-top: 1px solid rgba(63, 63, 70, 0.62);
                    border-bottom: 1px solid rgba(63, 63, 70, 0.62);
                    padding: 12px 0;
                }

                .bc-page article > div:last-child > div:nth-of-type(1) > div {
                    min-height: 62px;
                    border: 1px solid rgba(63, 63, 70, 0.5);
                    border-radius: 5px;
                    background: rgba(24, 24, 27, 0.38);
                    padding: 7px 5px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-direction: column;
                    text-align: center;
                    min-width: 0;
                }

                .bc-page article > div:last-child > div:nth-of-type(1) svg {
                    color: #d4af37;
                    margin-bottom: 5px;
                    flex: 0 0 auto;
                }

                .bc-page article > div:last-child > div:nth-of-type(1) span:first-of-type {
                    color: #858b94;
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 8px;
                    letter-spacing: 0.11em;
                    text-transform: uppercase;
                }

                .bc-page #unidades-disponiveis article > div:last-child > div:nth-of-type(1) span:first-of-type {
                    color: #858b94;
                    font-size: 8px;
                    letter-spacing: 0.11em;
                }

                .bc-page article > div:last-child > div:nth-of-type(1) span:last-of-type {
                    margin-top: 3px;
                    color: #ffffff;
                    font-size: 10px;
                    font-weight: 850;
                }

                .bc-page #unidades-disponiveis article > div:last-child > div:nth-of-type(1) span:last-of-type {
                    color: #ffffff;
                    font-size: 10px;
                    letter-spacing: 0;
                    text-transform: none;
                }

                .bc-page article > div:last-child > div:last-child {
                    margin-top: auto;
                    display: grid;
                    gap: 8px;
                }

                .bc-page article button,
                .bc-page article a {
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

                .bc-page article button {
                    border: 0;
                    background: #25d366;
                    color: #07130c;
                }

                .bc-page article a {
                    border: 1px solid #272e38;
                    color: #a1a1aa;
                    background: transparent;
                }

                .bc-page main > section:nth-of-type(4) {
                    background: #0a0d10;
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
                    border: 1px solid #272e38;
                    border-radius: 8px;
                    background: rgba(17, 22, 29, 0.76);
                    padding: 24px;
                }

                .bc-page main > section:nth-of-type(4) > div > div:last-child > div > div:first-child {
                    width: 44px;
                    height: 44px;
                    display: grid;
                    place-items: center;
                    border: 1px solid rgba(212, 175, 55, 0.25);
                    border-radius: 6px;
                    background: rgba(212, 175, 55, 0.1);
                    color: #d4af37;
                    margin-bottom: 18px;
                }

                .bc-page main > section:nth-of-type(4) h3,
                .bc-page main > section:nth-of-type(5) h3 {
                    margin: 0 0 10px;
                    color: #ffffff;
                    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
                    font-size: 18px;
                    font-weight: 450;
                    line-height: 1.26;
                }

                .bc-page main > section:nth-of-type(5) {
                    border-top: 1px solid #272e38;
                    border-bottom: 1px solid #272e38;
                    background: #11161d;
                }

                .bc-page main > section:nth-of-type(5) > div > div:first-child {
                    max-width: 720px;
                    margin-bottom: 42px;
                }

                .bc-page main > section:nth-of-type(5) > div > div:last-child > div > div:first-child {
                    margin-bottom: 24px;
                    color: #d4af37;
                    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                    font-size: 12px;
                }

                .bc-page main > section:nth-of-type(6) {
                    background: #0a0d10;
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
                    border: 1px solid #272e38;
                    border-radius: 8px;
                    background: #090b0f;
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

                .bc-page main > section:nth-of-type(7) {
                    border-top: 1px solid #272e38;
                    border-bottom: 1px solid #272e38;
                    background: #11161d;
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
                    border: 1px solid #272e38;
                    border-radius: 8px;
                    background: #090b0f;
                }

                .bc-page main > section:nth-of-type(7) iframe {
                    width: 100%;
                    height: 430px;
                    display: block;
                    border: 0;
                    filter: grayscale(1) contrast(0.9);
                }

                .bc-page main > section:nth-of-type(8) {
                    background: #0a0d10;
                }

                .bc-page main > section:nth-of-type(8) button {
                    width: 100%;
                    display: block;
                    border: 0;
                    border-bottom: 1px solid #272e38;
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
                    color: #ffffff;
                    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
                    font-size: 17px;
                    font-weight: 450;
                    line-height: 1.35;
                }

                .bc-page footer {
                    border-top: 1px solid #18181b;
                    background: #07090c;
                    padding: 48px 0;
                }

                .bc-page footer > div {
                    width: min(1320px, calc(100% - 32px));
                    margin: 0 auto;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 32px;
                }

                .bc-page footer p:first-child {
                    margin: 0;
                    color: #ffffff;
                    font-family: "Playfair Display", Georgia, "Times New Roman", serif;
                    font-size: 22px;
                    letter-spacing: 0.16em;
                    text-transform: uppercase;
                }

                .bc-page footer p:last-child {
                    max-width: 610px;
                    margin: 10px 0 0;
                    color: #71717a;
                    font-size: 12px;
                    line-height: 1.6;
                }

                .bc-page footer > div > div:last-child {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    justify-content: flex-end;
                }

                .bc-page .bc-floating-actions {
                    position: fixed;
                    right: 28px;
                    bottom: 22px;
                    z-index: 60;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                }

                .bc-page .bc-floating-chat,
                .bc-page .bc-floating-consult {
                    border: 0;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    text-transform: uppercase;
                    box-shadow: 0 18px 38px rgba(37, 211, 102, 0.18);
                }

                .bc-page .bc-floating-chat {
                    width: 54px;
                    height: 54px;
                    border-radius: 999px;
                    background: #25d366;
                    color: #07130c;
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

                .bc-page .bc-floating-label-short {
                    display: none;
                }

                @media (max-width: 1024px) {
                    .bc-page header > div {
                        flex-direction: column;
                        align-items: stretch;
                    }

                    .bc-page header > div > button {
                        display: none;
                    }

                    .bc-page main > section:nth-of-type(1) > div:last-child > div:last-child {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
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
                }

                @media (max-width: 720px) {
                    .bc-page {
                        padding-bottom: 88px;
                    }

                    .bc-page > div:nth-of-type(1) {
                        font-size: 9px;
                        letter-spacing: 0.14em;
                        line-height: 1.4;
                    }

                    .bc-page header > div {
                        width: min(100% - 32px, 1320px);
                        padding: 13px 0;
                        gap: 12px;
                    }

                    .bc-page header > div > div:first-child {
                        min-width: 0;
                    }

                    .bc-page header > div > div:first-child > div:first-child {
                        width: 38px;
                        height: 38px;
                    }

                    .bc-page header p:first-child {
                        font-size: 15px;
                    }

                    .bc-page header p:last-child {
                        margin-top: 3px;
                        font-size: 8px;
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
                        font-size: clamp(2rem, 8.4vw, 2.35rem);
                    }

                    .bc-page main > section:nth-of-type(1) h1 + p {
                        font-size: 0.98rem;
                    }

                    .bc-page main > section:nth-of-type(1) > div:last-child > div:first-child > div:last-child {
                        flex-direction: column;
                    }

                    .bc-page main > section:nth-of-type(1) > div:last-child > div:first-child button {
                        width: 100%;
                    }

                    .bc-page main > section:nth-of-type(1) > div:last-child > div:last-child {
                        grid-template-columns: 1fr;
                        padding: 16px;
                    }

                    .bc-page main > section:nth-of-type(1) > div:last-child > div:last-child > div {
                        border-right: 0;
                        border-bottom: 1px solid rgba(63, 63, 70, 0.78);
                        padding: 0 0 14px;
                    }

                    .bc-page main > section:nth-of-type(1) > div:last-child > div:last-child > div:last-child {
                        border-bottom: 0;
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

                    .bc-page #unidades-disponiveis > div > div:last-child,
                    .bc-page main > section:nth-of-type(4) > div > div:last-child,
                    .bc-page main > section:nth-of-type(5) > div > div:last-child,
                    .bc-page main > section:nth-of-type(6) > div > div:last-child {
                        grid-template-columns: 1fr;
                    }

                    .bc-page main > section:nth-of-type(6) > div > div:last-child > div:first-child {
                        grid-column: auto;
                        min-height: 280px;
                    }

                    .bc-page main > section:nth-of-type(6) > div > div:last-child > div {
                        min-height: 240px;
                    }

                    .bc-page main > section:nth-of-type(7) iframe {
                        height: 340px;
                    }

                    .bc-page footer > div {
                        width: min(100% - 28px, 1320px);
                        align-items: flex-start;
                        flex-direction: column;
                    }

                    .bc-page footer > div > div:last-child {
                        justify-content: flex-start;
                    }

                    .bc-page .bc-floating-actions {
                        right: auto;
                        left: 50%;
                        bottom: 16px;
                        transform: translateX(-50%);
                        gap: 10px;
                    }

                    .bc-page .bc-floating-chat {
                        width: 50px;
                        height: 50px;
                    }

                    .bc-page .bc-floating-consult {
                        min-height: 50px;
                        padding: 0 23px;
                        font-size: 10px;
                        letter-spacing: 0.1em;
                    }

                    .bc-page .bc-floating-label-full {
                        display: none;
                    }

                    .bc-page .bc-floating-label-short {
                        display: inline;
                    }
                }
            `}</style>
        </div>
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
        <div className="flex gap-4 border-b border-zinc-800/70 pb-4 last:border-b-0 sm:border-b-0 sm:border-r sm:pr-4 sm:last:border-r-0">
            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-950 text-[#D4AF37]">
                <Icon size={20} />
            </div>
            <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">{label}</p>
                <h3 className={`mt-1 text-sm font-semibold ${highlight ? 'text-emerald-400' : 'text-white'}`}>{value}</h3>
                <span className="mt-1 block text-[11px] text-zinc-500">{note}</span>
            </div>
        </div>
    )
}

function Stat({ label, value, gold = false }: { label: string; value: string; gold?: boolean }) {
    return (
        <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500">{label}</p>
            <p className={`mt-1 font-serif text-base md:text-lg ${gold ? 'text-[#D4AF37]' : 'text-white'}`}>{value}</p>
        </div>
    )
}

function UnitCard({ unit, development, onOpenChat }: { unit: Unit; development: Development; onOpenChat: () => void }) {
    return (
        <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-zinc-800/85 bg-[#11161D]/75 transition duration-500 hover:border-[#D4AF37]/45 hover:shadow-2xl hover:shadow-[#D4AF37]/5">
            <div className="relative aspect-[4/3] overflow-hidden bg-zinc-900">
                <img src={unit.image} alt={unit.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
                <span className={`absolute left-4 top-4 rounded px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] shadow-md ${unit.status.toLowerCase().includes('ultima') ? 'bg-amber-500 text-zinc-950' : 'border border-[#D4AF37]/40 bg-[#0A0D10]/95 text-[#D4AF37]'}`}>
                    {unit.status}
                </span>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0A0D10]/95 via-[#0A0D10]/55 to-transparent p-5">
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
                    <button
                        type="button"
                        onClick={onOpenChat}
                        className="flex w-full items-center justify-center gap-2 rounded bg-[#25D366] py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#07130C] transition hover:bg-[#20ba59]"
                    >
                        <MessageSquare size={15} />
                        Falar via WhatsApp
                    </button>
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
